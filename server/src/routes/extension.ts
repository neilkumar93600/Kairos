import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { submissionReportSchema, type SubmissionReport } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, jobs } from "../db/schema";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";
import { recordSubmission } from "../services/submissions";

/** What the Chrome extension pulls and reports. Mounted at /api/extension; the extension sends a bearer token. */
export const extensionRouter = Router();

extensionRouter.get("/queue", async (req, res) => {
  const rows = await db()
    .select({
      applicationId: applications.id,
      applyUrl: jobs.applyUrl,
      title: jobs.title,
      answers: applications.answers,
      resumeLines: applications.resumeLines,
      coverLetter: applications.coverLetter,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.userId, currentUser(req).id), eq(applications.status, "approved"), eq(applications.channel, "extension")))
    .orderBy(asc(applications.approvedAt))
    .limit(20);
  res.json({ queue: rows });
});

extensionRouter.post("/report", validateBody(submissionReportSchema), async (req, res) => {
  const application = await recordSubmission(db(), currentUser(req).id, req.body as SubmissionReport, "extension");
  res.json({ status: application?.status ?? null });
});
