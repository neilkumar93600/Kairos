import type { Job } from "bullmq";
import { and, eq } from "drizzle-orm";
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
  const added = await db().transaction(async (tx) => {
    // A re-parse (a queue retry or a later re-import) replaces only this import's unconfirmed facts. Confirmed facts
    // stay, and a parsed fact one of them already holds is not added again (02-database facts, resume-63).
    // ponytail: same text or source span stands in for ON CONFLICT on source_span_hash until DB rev 2 adds the column.
    await tx.delete(facts).where(and(eq(facts.resumeProfileId, resume.id), eq(facts.confirmed, false)));
    const confirmed = await tx.select({ text: facts.text, sourceSpan: facts.sourceSpan }).from(facts).where(eq(facts.resumeProfileId, resume.id));
    const fresh = parsed.filter((f) => !confirmed.some((c) => c.text === f.text || (f.sourceSpan !== "" && c.sourceSpan === f.sourceSpan)));
    if (fresh.length) {
      await tx.insert(facts).values(fresh.map((f) => ({ ...f, userId: resume.userId, resumeProfileId: resume.id, confirmed: false })));
    }
    // Forward only (resume-64): a user past this step who adds a resume is never sent back to confirm-facts.
    await tx
      .update(profiles)
      .set({ onboardingStep: "confirm-facts", updatedAt: new Date() })
      .where(and(eq(profiles.userId, resume.userId), eq(profiles.onboardingStep, "resume")));
    return fresh.length;
  });
  return { facts: added };
}
