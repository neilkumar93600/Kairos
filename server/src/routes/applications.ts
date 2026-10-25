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
import { classifySensitive } from "../services/sensitive";
import { approveApplications, planFor } from "../services/submissions";
import { enforceTruthLock } from "../services/tailor";
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

/** Edits a draft. Resume lines go through the truth lock again, so an edit cannot cite facts the user lacks. */
applicationsRouter.patch("/:id", validateBody(updateApplicationSchema), async (req, res) => {
  const me = currentUser(req);
  const id = parseParam(z.uuid(), req.params.id);
  const body = req.body as z.infer<typeof updateApplicationSchema>;

  let resumeLines = body.resumeLines;
  if (resumeLines) {
    // Confirmed only: a note the writer made citable stays unconfirmed until the user confirms it, and must not reach a draft.
    const confirmed = await db()
      .select({ id: facts.id })
      .from(facts)
      .where(and(eq(facts.userId, me.id), eq(facts.confirmed, true)));
    const { kept, rejected } = enforceTruthLock(resumeLines, new Set(confirmed.map((f) => f.id)));
    if (rejected.length) throw new HttpError(422, "truth_lock", "Some lines cite facts that are not confirmed in your profile", rejected);
    resumeLines = kept;
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

  let label = "";
  if (body.kind === "answer") {
    const answer = row.application.answers.find((a) => a.fieldKey === body.fieldKey);
    if (!answer) throw notFound("Answer");
    if (classifySensitive(answer.label) || answer.source === "profile") {
      throw new HttpError(422, "profile_only", "This question is answered from your profile, never by AI");
    }
    label = answer.label;
  } else if (!getPlan(await planFor(db(), me.id)).coverLetters) {
    throw new HttpError(403, "forbidden", "Tailored cover letters are on Starter and up");
  }

  const confirmed = await db()
    .select({ id: facts.id, kind: facts.kind, text: facts.text })
    .from(facts)
    .where(and(eq(facts.userId, me.id), eq(facts.confirmed, true)));

  if (body.kind === "cover_letter") return void res.json(await draftCoverLetter({ job, facts: confirmed }));
  const saved = await db()
    .select({ label: savedAnswers.label, answer: savedAnswers.answer })
    .from(savedAnswers)
    .where(and(eq(savedAnswers.userId, me.id), eq(savedAnswers.approved, true), eq(savedAnswers.label, label)))
    .limit(3);
  res.json(await draftAnswer({ label, job, facts: confirmed, savedAnswers: saved }));
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
