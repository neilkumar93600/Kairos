import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { APPLICATION_STATUSES, approveApplicationsSchema, updateApplicationSchema } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, facts, jobs } from "../db/schema";
import { HttpError, notFound } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { parseParam, validateBody } from "../middleware/validate";
import { enqueue } from "../jobs/queues";
import { approveApplications } from "../services/submissions";
import { enforceTruthLock } from "../services/tailor";

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
    const owned = await db().select({ id: facts.id }).from(facts).where(eq(facts.userId, me.id));
    const { kept, rejected } = enforceTruthLock(resumeLines, new Set(owned.map((f) => f.id)));
    if (rejected.length) throw new HttpError(422, "truth_lock", "Some lines cite facts that are not in your profile", rejected);
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
