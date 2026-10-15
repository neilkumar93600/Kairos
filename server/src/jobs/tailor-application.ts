import type { Job } from "bullmq";
import { and, eq } from "drizzle-orm";
import type { ApplicationAnswer } from "@auto-career/shared";
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

  const userFacts = await db()
    .select({ id: facts.id, kind: facts.kind, text: facts.text })
    .from(facts)
    .where(and(eq(facts.userId, row.app.userId), eq(facts.confirmed, true)));

  const { kept, rejected } = await tailorResume(userFacts, {
    title: row.job.title,
    companyName: row.companyName,
    descriptionText: row.job.descriptionText,
  });
  if (rejected.length) logger.info({ applicationId: row.app.id, rejected: rejected.length }, "truth lock dropped lines");

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

  await db().update(applications).set({ resumeLines: kept, answers, updatedAt: new Date() }).where(eq(applications.id, row.app.id));
  return { lines: kept.length, answers: answers.length };
}
