import type { Job } from "bullmq";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { applications, companies, facts, jobs, matches, profiles } from "../db/schema";
import { logger } from "../lib/logger";
import { passesHardFilters, scoreFit } from "../services/fit";
import type { JobData } from "./queues";

/**
 * Scores one new job for every user with saved preferences. Hard filters run first, so the model is
 * only called for jobs a user could plausibly want. Only matches at or above the user's threshold are stored.
 */
export async function processScoreMatches(job: Job<JobData["score-matches"]>) {
  const [row] = await db()
    .select({ job: jobs, companyName: companies.name })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(jobs.id, job.data.jobId));
  if (!row || row.job.closedAt) return { stored: 0 };

  const fitJob = {
    title: row.job.title,
    companyName: row.companyName,
    location: row.job.location,
    remote: row.job.remote,
    descriptionText: row.job.descriptionText,
    salaryMaxUsd: row.job.salaryMaxUsd,
  };

  const candidates = await db().select({ userId: profiles.userId, preferences: profiles.preferences }).from(profiles).where(isNotNull(profiles.preferences));
  let stored = 0;

  for (const candidate of candidates) {
    const prefs = candidate.preferences;
    if (!prefs) continue;

    const [recent] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(
        and(
          eq(applications.userId, candidate.userId),
          eq(jobs.companyId, row.job.companyId),
          gte(applications.createdAt, sql`now() - interval '30 days'`),
        ),
      );
    const filters = passesHardFilters(fitJob, prefs, recent?.n ?? 0);
    if (!filters.pass) continue;

    const userFacts = await db()
      .select({ kind: facts.kind, text: facts.text })
      .from(facts)
      .where(and(eq(facts.userId, candidate.userId), eq(facts.confirmed, true)))
      .limit(80);
    if (userFacts.length === 0) continue;

    const summary = userFacts.map((f) => `- (${f.kind}) ${f.text}`).join("\n");
    try {
      const fit = await scoreFit(fitJob, summary);
      if (fit.score < prefs.fitThreshold) continue;
      await db()
        .insert(matches)
        .values({ userId: candidate.userId, jobId: row.job.id, passedFilters: true, score: fit.score, reasons: fit.reasons })
        .onConflictDoNothing();
      stored += 1;
    } catch (err) {
      logger.warn({ err, userId: candidate.userId, jobId: row.job.id }, "fit scoring failed");
    }
  }
  return { stored };
}
