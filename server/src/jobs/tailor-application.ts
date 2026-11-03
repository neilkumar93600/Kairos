import type { Job } from "bullmq";
import { and, eq, sql } from "drizzle-orm";
import type { ApplicationAnswer, ResumeLine } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, facts, jobs, profiles, resumes, savedAnswers, user } from "../db/schema";
import { HttpError } from "../lib/errors";
import { copyFor, createCopy } from "../services/resume-library";
import { logger } from "../lib/logger";
import { tailorResume } from "../services/tailor";
import { topFacts } from "../services/job-fit";
import { planFor } from "../services/submissions";
import { gatewayCtx } from "../llm/wire";
import type { JobData } from "./queues";

/** Prepares a draft for review: truth-locked resume lines plus answers from the profile and saved answers. */
export async function processTailorApplication(job: Job<JobData["tailor-application"]>) {
  const [row] = await db()
    .select({ app: applications, job: jobs, companyName: companies.name, person: user, profile: profiles })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .innerJoin(user, eq(user.id, applications.userId))
    .innerJoin(profiles, eq(profiles.userId, applications.userId))
    .where(eq(applications.id, job.data.applicationId));
  if (!row || row.app.status !== "draft") return { skipped: true };

  // The web's Create draft queues this job, then PATCHes the user's accepted lines. When those are already here,
  // tailoring would be thrown away by the write below, so the model call is skipped.
  let kept: ResumeLine[] = [];
  if (row.app.resumeLines.length === 0) {
    const userFacts = await db()
      .select({ id: facts.id, kind: facts.kind, text: facts.text })
      .from(facts)
      .where(and(eq(facts.userId, row.app.userId), eq(facts.confirmed, true)));
    const posting = { title: row.job.title, companyName: row.companyName, descriptionText: row.job.descriptionText };
    const ctx = gatewayCtx({ userId: row.app.userId, plan: await planFor(db(), row.app.userId), applicationId: row.app.id, jobId: row.job.id });
    // The 60 confirmed facts the posting needs most (llm-agents-59), never the whole fact bank.
    const tailored = await tailorResume(topFacts(userFacts, `${posting.title}\n${posting.descriptionText}`, 60), posting, ctx);
    kept = tailored.kept;
    if (tailored.rejected.length) logger.info({ applicationId: row.app.id, rejected: tailored.rejected.length }, "truth lock dropped lines");
  }

  const [firstName, ...rest] = row.person.name.trim().split(/\s+/);
  const base: ApplicationAnswer[] = [
    { fieldKey: "first_name", label: "First name", value: firstName ?? "", source: "profile" },
    { fieldKey: "last_name", label: "Last name", value: rest.join(" "), source: "profile" },
    { fieldKey: "email", label: "Email", value: row.person.email, source: "profile" },
    { fieldKey: "phone", label: "Phone", value: row.profile.phone ?? "", source: "profile" },
    { fieldKey: "linkedin", label: "LinkedIn profile", value: row.profile.linkedinUrl ?? "", source: "profile" },
    // Greenhouse labels this "Location (City)" and marks it required on many boards.
    { fieldKey: "location", label: "Location (City)", value: row.profile.city ?? "", source: "profile" },
  ];
  const saved = await db()
    .select()
    .from(savedAnswers)
    .where(and(eq(savedAnswers.userId, row.app.userId), eq(savedAnswers.approved, true)));
  const answers: ApplicationAnswer[] = [
    ...base,
    ...saved.map((s) => ({ fieldKey: s.questionKey, label: s.label, value: s.answer, source: "saved_answer" as const })),
  ];

  // Each column is written only while it is still empty at write time: a PATCH that landed during the model call wins.
  const ifEmpty = (column: typeof applications.resumeLines | typeof applications.answers, value: unknown[]) =>
    sql`CASE WHEN ${column} = '[]'::jsonb THEN ${JSON.stringify(value)}::jsonb ELSE ${column} END`;
  await db()
    .update(applications)
    .set({ resumeLines: ifEmpty(applications.resumeLines, kept), answers: ifEmpty(applications.answers, answers), updatedAt: new Date() })
    .where(and(eq(applications.id, row.app.id), eq(applications.status, "draft")));
  await ensureTailoredCopy(row.app.userId, row.app.id, { id: row.job.id, title: row.job.title, company: row.companyName });
  return { lines: kept.length, answers: answers.length };
}

/**
 * PRD 6.2 and D2: every draft has a tailored copy in the library, started from the base whose target roles best match
 * the job title (else the default), with a before_tailor revision; a copy the user made first is linked to the draft.
 * ponytail: the pipeline's tailored lines stay on applications.resume_lines, not written into the copy's document;
 * mapping them into the document is the resume-tailor suggestion mode of WP-41.
 */
async function ensureTailoredCopy(userId: string, applicationId: string, job: { id: string; title: string; company: string }) {
  const existing = await copyFor(userId, job.id);
  if (existing) {
    if (!existing.applicationId) await db().update(resumes).set({ applicationId }).where(eq(resumes.id, existing.id));
    return;
  }
  try {
    await createCopy({ id: userId }, await planFor(db(), userId), job);
  } catch (err) {
    // A concurrent copy won the unique index: that copy is the job's, which is what was wanted. Before migration 0011
    // (resumes_user_uq still there) the draft simply has no copy yet; the draft itself is already written.
    if (!(err instanceof HttpError && (err.code === "exists" || err.code === "service_unavailable"))) throw err;
  }
  // ponytail: WP-42's recordEvent(tx, { kind: "resume_linked", ... }) is not on this base; the coordinator calls it here
  // (and where an existing copy is linked above) at merge, so the tracker card shows the version chip's event.
}
