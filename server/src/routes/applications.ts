import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { APPLICATION_STATUSES, approveApplicationsSchema, draftRequestSchema, getPlan, updateApplicationSchema } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, facts, jobs, savedAnswers } from "../db/schema";
import { HttpError, notFound } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { parseParam, validateBody } from "../middleware/validate";
import { enqueue } from "../jobs/queues";
import { draftAnswer, draftCoverLetter } from "../services/draft-writer";
import { classifySensitive, isProfileQuestion } from "../services/sensitive";
import { approveApplications, planFor } from "../services/submissions";
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
  const me = currentUser(req);
  const rows = await db()
    .select({
      id: applications.id,
      status: applications.status,
      channel: applications.channel,
      approvedAt: applications.approvedAt,
      submittedAt: applications.submittedAt,
      failureReason: applications.failureReason,
      job: { id: jobs.id, title: jobs.title, location: jobs.location, applyUrl: jobs.applyUrl },
      company: { name: companies.name, ats: companies.ats },
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(status ? and(eq(applications.userId, me.id), eq(applications.status, status)) : eq(applications.userId, me.id))
    .orderBy(desc(applications.updatedAt))
    .limit(200);
  res.json({ applications: rows });
});

applicationsRouter.get("/:id", async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const [row] = await db()
    .select({ application: applications, job: jobs, companyName: companies.name })
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
      .where(and(eq(applications.id, id), eq(applications.userId, me.id), eq(applications.status, "draft")));
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

  const [updated] = await db()
    .update(applications)
    .set({
      ...(resumeLines ? { resumeLines } : {}),
      ...(body.answers ? { answers: body.answers.map((a) => ({ ...a, source: "user_edit" as const })) } : {}),
      ...(body.coverLetter !== undefined ? { coverLetter: body.coverLetter } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, me.id), eq(applications.status, "draft")))
    .returning();
  if (!updated) throw notFound("Draft application");
  res.json({ application: updated });
});

applicationsRouter.post("/approve", validateBody(approveApplicationsSchema), async (req, res) => {
  const me = currentUser(req);
  const { applicationIds, channel } = req.body as z.infer<typeof approveApplicationsSchema>;
  const approved = await approveApplications(db(), me.id, applicationIds, channel);
  if (channel === "cloud") {
    await Promise.all(approved.map((id) => enqueue("cloud-apply", { applicationId: id }, `apply-${id}`)));
  }
  res.json({ approved });
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
  const deps = { callCtx: gatewayCtx({ userId: me.id, plan, applicationId: id, jobId: row.job.id, feature: "applicationDrafts", budgetClass: "interactive" }) };
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

applicationsRouter.post("/:id/withdraw", async (req, res) => {
  const id = parseParam(z.uuid(), req.params.id);
  const [updated] = await db()
    .update(applications)
    .set({ status: "withdrawn", updatedAt: new Date() })
    .where(and(eq(applications.id, id), eq(applications.userId, currentUser(req).id), inArray(applications.status, ["draft", "approved"])))
    .returning({ id: applications.id });
  if (!updated) throw notFound("Withdrawable application");
  res.json({ ok: true });
});
