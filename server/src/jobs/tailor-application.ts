import type { Job } from "bullmq";
import { and, eq, sql } from "drizzle-orm";
import type { ApplicationAnswer, ResumeLine } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, facts, jobs, profiles, savedAnswers, user } from "../db/schema";
import { logger } from "../lib/logger";
import { tailorResume } from "../services/tailor";
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
    const tailored = await tailorResume(userFacts, {
      title: row.job.title,
      companyName: row.companyName,
      descriptionText: row.job.descriptionText,
    });
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
  return { lines: kept.length, answers: answers.length };
}
