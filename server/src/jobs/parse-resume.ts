import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { facts, profiles, resumeProfiles, user } from "../db/schema";
import { parseResumeToFacts } from "../services/resume-parser";
import type { JobData } from "./queues";

/** Turns an uploaded resume into unconfirmed facts; onboarding asks the user to confirm them. */
export async function processParseResume(job: Job<JobData["parse-resume"]>) {
  const [row] = await db()
    .select({
      resume: resumeProfiles,
      name: user.name,
      email: user.email,
      phone: profiles.phone,
      linkedinUrl: profiles.linkedinUrl,
      githubUrl: profiles.githubUrl,
      portfolioUrl: profiles.portfolioUrl,
    })
    .from(resumeProfiles)
    .innerJoin(user, eq(user.id, resumeProfiles.userId))
    .leftJoin(profiles, eq(profiles.userId, resumeProfiles.userId))
    .where(eq(resumeProfiles.id, job.data.resumeProfileId));
  if (!row) return { facts: 0 };
  const { resume } = row;
  // The profile's own contact details are redacted as literals; the parser never sees them (10.2).
  const parsed = await parseResumeToFacts(resume.sourceText, {
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    links: [row.linkedinUrl, row.githubUrl, row.portfolioUrl].filter((l): l is string => Boolean(l)),
  });
  await db().transaction(async (tx) => {
    await tx.delete(facts).where(eq(facts.resumeProfileId, resume.id));
    await tx.insert(facts).values(parsed.map((f) => ({ ...f, userId: resume.userId, resumeProfileId: resume.id, confirmed: false })));
    await tx.update(profiles).set({ onboardingStep: "confirm-facts", updatedAt: new Date() }).where(eq(profiles.userId, resume.userId));
  });
  return { facts: parsed.length };
}
