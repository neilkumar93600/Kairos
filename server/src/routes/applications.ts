import { Router } from "express";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { APPLICATION_STATUSES, approveApplicationsSchema, draftRequestSchema, getPlan, resendRequestSchema, updateApplicationSchema } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, facts, inboundEmails, jobs, savedAnswers, trackerItems, type ApplicationStage } from "../db/schema";
import { asActor } from "../lib/actor";
import { HttpError, notFound } from "../lib/errors";
import { keysetBefore, pageParams, slicePage, tsKey } from "../lib/pagination";
import { APPLICATION_COLUMNS, JOB_COLUMNS } from "../lib/serializers";
import { currentUser } from "../middleware/require-auth";
import { parseParam, validateBody } from "../middleware/validate";
import { eventPage, recordEvent } from "../services/events";
import { draftAnswer, draftCoverLetter } from "../services/draft-writer";
import { classifySensitive, isProfileQuestion } from "../services/sensitive";
import { approveWithSkips, planFor, resendApplication, withdrawApplication } from "../services/submissions";
import { metered } from "../services/allowance";
import { topFacts } from "../services/job-fit";
import { gatewayCtx } from "../llm/wire";
import { enforceTruthLock } from "../services/tailor";
import { lineKey } from "../services/resume-doc";
import { checkClaims, type ClaimViolation } from "../llm/claims";
import { writerLimiter } from "./resume";

/** Review queue, approvals and receipts. Mounted at /api/applications. */
export const applicationsRouter = Router();

const listQuery = z.object({ status: z.enum(APPLICATION_STATUSES).optional() });

applicationsRouter.get("/", async (req, res) => {
  const { status } = parseParam(listQuery, req.query);
  const { limit, after } = pageParams(req.query, 200, "applications", ["ts"]);
  const me = currentUser(req);
  const rows = await db()
    .select({
      id: applications.id,
      status: applications.status,
      channel: applications.channel,
      approvedAt: applications.approvedAt,
      submittedAt: applications.submittedAt,
      failureReason: applications.failureReason,
      updatedAt: applications.updatedAt,
      cursorTs: tsKey(applications.updatedAt),
      job: { id: jobs.id, title: jobs.title, location: jobs.location, applyUrl: jobs.applyUrl },
      company: { name: companies.name, ats: companies.ats },
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(
      and(
        eq(applications.userId, me.id),
        status ? eq(applications.status, status) : undefined,
        after && keysetBefore([applications.updatedAt], ["timestamptz"], applications.id, after),
      ),
    )
    .orderBy(desc(applications.updatedAt), desc(applications.id))
    .limit(limit + 1);
  const page = slicePage(rows, limit, "applications", (r) => [r.cursorTs], (r) => r.id);
  res.json({ applications: page.rows.map(({ cursorTs: _, ...row }) => row), nextCursor: page.nextCursor });
});

applicationsRouter.get("/:id", async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const [row] = await db()
    // stage is additive and beside the frozen `application` keys: reply-driven (WP-24), and the user can clear it below.
    .select({ application: APPLICATION_COLUMNS, stage: applications.stage, job: JOB_COLUMNS, companyName: companies.name })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(eq(applications.id, id), eq(applications.userId, currentUser(req).id)));
  if (!row) throw notFound("Application");
  res.json(row);
});

/**
 * Edits a draft (05-api 10.6, layers 1 and 2). Every line must cite confirmed facts of this user; lines and cover-letter
 * paragraphs that changed must also pass checkClaims. Any failure is 422 truth_lock and nothing is stored.
 * ponytail: answers are not claim-checked. 10.6 step 6 checks only free-text questions from a questions snapshot, which
 * does not exist yet; profile and sensitive answers are the user's own assertion. Add it with the snapshot (prepare v2).
 */
applicationsRouter.patch("/:id", validateBody(updateApplicationSchema), async (req, res) => {
  const me = currentUser(req);
  const id = parseParam(z.uuid(), req.params.id);
  const body = req.body as z.infer<typeof updateApplicationSchema>;

  let resumeLines = body.resumeLines;
  if (resumeLines || body.coverLetter) {
    const [current] = await db()
      .select({ resumeLines: applications.resumeLines, coverLetter: applications.coverLetter, companyName: companies.name })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(and(eq(applications.id, id), eq(applications.userId, me.id), eq(applications.status, "draft"), ne(applications.draftState, "expired")));
    if (!current) throw notFound("Draft application");
    // Confirmed only: a note the writer made citable stays unconfirmed until the user confirms it, and must not reach a draft.
    const confirmed = await db()
      .select({ id: facts.id, text: facts.text })
      .from(facts)
      .where(and(eq(facts.userId, me.id), eq(facts.confirmed, true)));
    const failures: object[] = [];
    if (resumeLines) {
      const stored = new Set(current.resumeLines.map(lineKey));
      const { kept, rejected } = enforceTruthLock(resumeLines, new Map(confirmed.map((f) => [f.id, f.text])), (l) => !stored.has(lineKey(l)));
      failures.push(...rejected);
      resumeLines = kept;
    }
    // A letter cites no fact ids (frozen schema), so each paragraph is checked against every confirmed fact (F-8).
    let letterClaim: ClaimViolation | undefined;
    if (body.coverLetter && body.coverLetter !== current.coverLetter) {
      const sources = confirmed.map((f) => f.text);
      [letterClaim] = body.coverLetter
        .split(/\n\s*\n/)
        .flatMap((p) => checkClaims(p, sources, { allow: [current.companyName, me.name] }));
      if (letterClaim) failures.push({ coverLetter: true, reason: `not in your confirmed facts: ${letterClaim.value}`, rule: letterClaim.rule });
    }
    if (failures.length) {
      const message =
        letterClaim && failures.length === 1
          ? `Your cover letter mentions "${letterClaim.value}", which is not in your confirmed facts`
          : "Some lines cite facts that are not confirmed in your profile, or add details those facts do not contain";
      throw new HttpError(422, "truth_lock", message, failures);
    }
  }

  // A failed send whose required question had no answer can have its answers fixed before the resend, and nothing else (Q-4, X7).
  const answersOnly = !resumeLines && body.coverLetter === undefined;
  const editable = or(
    and(eq(applications.status, "draft"), ne(applications.draftState, "expired")),
    answersOnly ? and(eq(applications.status, "failed"), eq(applications.failureCode, "required_missing")) : undefined,
  );
  const [updated] = await db()
    .update(applications)
    .set({
      ...(resumeLines ? { resumeLines } : {}),
      ...(body.answers ? { answers: body.answers.map((a) => ({ ...a, source: "user_edit" as const })) } : {}),
      ...(body.coverLetter !== undefined ? { coverLetter: body.coverLetter } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, me.id), editable))
    .returning(APPLICATION_COLUMNS);
  if (!updated) throw notFound("Draft application");
  res.json({ application: updated });
});

applicationsRouter.post("/approve", validateBody(approveApplicationsSchema), async (req, res) => {
  const me = currentUser(req);
  const { applicationIds, channel } = req.body as z.infer<typeof approveApplicationsSchema>;
  const { approved, skipped } = await approveWithSkips(db(), me.id, applicationIds, channel);
  // `skipped` is additive and absent when empty, so a plain success stays byte-identical to the frozen `{ approved }`.
  res.json({ approved: approved.map((a) => a.id), ...(skipped.length ? { skipped } : {}) });
});

/** Sends a failed application again under a new attempt (05-api 10.4). Money: session-fresh like approve. */
applicationsRouter.post("/:id/resend", validateBody(resendRequestSchema), async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const { channel, acknowledgeUnconfirmed } = req.body as z.infer<typeof resendRequestSchema>;
  res.json(await resendApplication(db(), currentUser(req).id, id, channel, acknowledgeUnconfirmed));
});

/** Drafts one answer or the cover letter from confirmed facts. Saves nothing: the user accepts it through PATCH. */
applicationsRouter.post("/:id/drafts", writerLimiter, validateBody(draftRequestSchema), async (req, res) => {
  const me = currentUser(req);
  const id = parseParam(z.uuid(), req.params.id);
  const body = req.body as z.infer<typeof draftRequestSchema>;
  const [row] = await db()
    .select({ application: applications, job: jobs, companyName: companies.name })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(eq(applications.id, id), eq(applications.userId, me.id), eq(applications.status, "draft")));
  if (!row) throw notFound("Draft application");
  const job = { title: row.job.title, company: row.companyName, descriptionText: row.job.descriptionText };

  const plan = await planFor(db(), me.id);
  let label = "";
  if (body.kind === "answer") {
    const answer = row.application.answers.find((a) => a.fieldKey === body.fieldKey);
    if (!answer) throw notFound("Answer");
    if (classifySensitive(answer.label) || isProfileQuestion(answer.label) || answer.source === "profile") {
      throw new HttpError(422, "profile_only", "This question is answered from your profile, never by AI");
    }
    label = answer.label;
  } else if (!getPlan(plan).coverLetters) {
    throw new HttpError(403, "forbidden", "Tailored cover letters are on Starter and up");
  }

  const confirmed = await db()
    .select({ id: facts.id, kind: facts.kind, text: facts.text })
    .from(facts)
    .where(and(eq(facts.userId, me.id), eq(facts.confirmed, true)));

  const allowance = { userId: me.id, plan, feature: "applicationDrafts" as const };
  // The drafts route is interactive work (03-agent-runtime 3.3); the facts sent are the 60 (letter) or 25 (answer) the
  // posting needs most (resume-47), never the whole fact bank.
  const deps = { callCtx: gatewayCtx({ userId: me.id, plan, applicationId: id, jobId: row.job.id, feature: "applicationDrafts", budgetClass: "interactive", signal: res.locals.deadline }) };
  const posting = `${job.title}\n${job.descriptionText}`;
  if (body.kind === "cover_letter") {
    return void res.json(await metered(res, allowance, () => draftCoverLetter({ job, facts: topFacts(confirmed, posting, 60) }, deps)));
  }
  const saved = await db()
    .select({ label: savedAnswers.label, answer: savedAnswers.answer })
    .from(savedAnswers)
    .where(and(eq(savedAnswers.userId, me.id), eq(savedAnswers.approved, true), eq(savedAnswers.label, label)))
    .limit(3);
  const answerFacts = topFacts(confirmed, `${label}\n${posting}`, 25);
  res.json(await metered(res, allowance, () => draftAnswer({ label, job, facts: answerFacts, savedAnswers: saved }, deps)));
});

/** The reply kind that sets each stage (jobs/classify-email.ts): the replies an undo takes back. */
const KIND_OF_STAGE = { in_review: "confirmation", assessment: "assessment", interviewing: "interview", offer: "offer", rejected: "rejection" } as const;

/**
 * The user's undo of a stage set by mail (WP-24): anyone who learns the forwarding address, or a replayed signed rejection,
 * can reach a final stage, and this is the way back. The stage returns to the bottom of the ladder: `applied` for a
 * submitted application, where every submitted row starts (applications_stage_shape_ck, WP-46), and NULL otherwise. The
 * replies of the kind that set it are detached, so they stop counting for this application; they stay in the inbox. The
 * trigger allows this only under asActor("user"), so no job can do it. Classified rows are never classified again, so
 * nothing re-applies; a later genuine reply can move the stage again. No stage, or `applied`, has nothing to undo: a no-op.
 * Reply rows first, then the application, the classify job's order, so the two cannot deadlock.
 * Not session-fresh: it moves no money and no access, and only touches the caller's own tracking.
 */
applicationsRouter.post("/:id/stage/clear", async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const userId = currentUser(req).id;
  const owned = and(eq(applications.id, id), eq(applications.userId, userId));
  const result = await db().transaction(async (tx) => {
    await asActor(tx, "user");
    const [app] = await tx.select({ stage: applications.stage }).from(applications).where(owned);
    if (!app) throw notFound("Application");
    if (!app.stage || app.stage === "applied") return { stage: app.stage, detached: 0 };

    const rows = await tx
      .update(inboundEmails)
      .set({ applicationId: null, linkedBy: "none" })
      .where(and(eq(inboundEmails.applicationId, id), eq(inboundEmails.userId, userId), eq(inboundEmails.kind, KIND_OF_STAGE[app.stage])))
      .returning({ id: inboundEmails.id });
    const [moved] = await tx
      .update(applications)
      .set({ stage: sql<ApplicationStage | null>`CASE WHEN ${applications.status} = 'submitted' THEN 'applied' END` })
      .where(and(owned, eq(applications.stage, app.stage)))
      .returning({ stage: applications.stage });
    if (!moved) {
      // Changed since the read. A double click has nothing left to do; a reply moving it is rolled back for the user to look again.
      const [now] = await tx.select({ stage: applications.stage }).from(applications).where(owned);
      if (!rows.length && (!now?.stage || now.stage === "applied")) return { stage: now?.stage ?? null, detached: 0 };
      throw new HttpError(409, "conflict", "This application's stage just changed. Look at it again and retry.");
    }
    await recordEvent(tx, { userId, applicationId: id, kind: "stage_changed", actor: "user", payload: { from: app.stage, to: moved.stage, undone: true, detached: rows.length } });
    return { stage: moved.stage, detached: rows.length };
  });
  res.json(result);
});

/**
 * The timeline of an application (05-api 10.5, PRD 9.3), oldest first. Events are keyed by tracker item, so this is the item's whole
 * timeline, the saved and note events too, in the shared event shape; a reply's payload carries stageHeld and authenticated for the
 * "this reply did not move the stage" line. An application with no event yet has no item: an empty list.
 */
applicationsRouter.get("/:id/events", async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const userId = currentUser(req).id;
  const page = pageParams(req.query, 200, "app_events", ["ts"], "bigint");
  const [app] = await db().select({ id: applications.id }).from(applications).where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!app) throw notFound("Application");
  const [item] = await db().select({ id: trackerItems.id }).from(trackerItems).where(and(eq(trackerItems.applicationId, id), eq(trackerItems.userId, userId)));
  res.json(item ? await eventPage(item.id, page, "app_events", "asc") : { events: [] });
});

applicationsRouter.post("/:id/withdraw", async (req, res) => {
  await withdrawApplication(db(), currentUser(req).id, parseParam(z.uuid(), req.params.id));
  res.json({ ok: true });
});
