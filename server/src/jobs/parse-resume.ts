import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { facts, profiles, resumeProfiles } from "../db/schema";
import { parseResumeToFacts } from "../services/resume-parser";
import type { JobData } from "./queues";

/** Turns an uploaded resume into unconfirmed facts; onboarding asks the user to confirm them. */
export async function processParseResume(job: Job<JobData["parse-resume"]>) {
  const [resume] = await db().select().from(resumeProfiles).where(eq(resumeProfiles.id, job.data.resumeProfileId));
  if (!resume) return { facts: 0 };
  const parsed = await parseResumeToFacts(resume.sourceText);
  await db().transaction(async (tx) => {
    await tx.delete(facts).where(eq(facts.resumeProfileId, resume.id));
    await tx.insert(facts).values(parsed.map((f) => ({ ...f, userId: resume.userId, resumeProfileId: resume.id, confirmed: false })));
    await tx.update(profiles).set({ onboardingStep: "confirm-facts", updatedAt: new Date() }).where(eq(profiles.userId, resume.userId));
  });
  return { facts: parsed.length };
}
