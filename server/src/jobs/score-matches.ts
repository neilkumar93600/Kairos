import type { Job } from "bullmq";
import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getPlan, type PlanId } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, creditLedger, facts, jobs, matches, profiles, session, subscriptions } from "../db/schema";
import { userDailyUsage } from "../db/schema/platform";
import { env } from "../lib/env";
import { nextUtcMidnight } from "../lib/errors";
import { logger, logUserHash } from "../lib/logger";
import { AgentError } from "../llm/errors";
import { gatewayCtx } from "../llm/wire";
import { refundable } from "../services/allowance";
import { PAID_STATUSES } from "../services/billing-events";
import { passesHardFilters, scoreFit } from "../services/fit";
import { enqueue, type JobData } from "./queues";

/** Follow-up attempts for pairs a retryable model failure skipped (matching-v02). */
const MAX_ATTEMPTS = 3;

/**
 * Scores one new job for the users it could matter to. Hard filters run first, so the model is only called for jobs a
 * user could plausibly want. Only matches at or above the user's threshold are stored.
 *
 * Interim controls on this loop (WP-06, CISO mustFix 3) until the matching pipeline of WP-42 replaces it: PAUSE_SCORING
 * stops it; only users active in the last 14 days, with credits and billing not paused, are candidates; each call first
 * reserves one of the plan's dailyScoringCap slots in user_daily_usage, refused once the day's pipeline spend reached
 * dailyModelSpendCapUsd; a retryable model failure frees its slot and comes back as a delayed follow-up job.
 * ponytail: one query set per candidate per job; WP-42's set-based prefilter and paged users take over at scale.
 */
export async function processScoreMatches(job: Job<JobData["score-matches"]>) {
  if (env().PAUSE_SCORING) {
    // ponytail: postings that arrive while paused are not scored later; the nightly re-score of WP-42 picks them up.
    logger.info({ jobId: job.data.jobId }, "scoring paused (PAUSE_SCORING)");
    return { stored: 0, paused: true };
  }
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

  const candidates = await db()
    .select({ userId: profiles.userId, preferences: profiles.preferences, plan: subscriptions.plan, status: subscriptions.status })
    .from(profiles)
    .leftJoin(subscriptions, eq(subscriptions.userId, profiles.userId))
    .where(
      and(
        isNotNull(profiles.preferences),
        job.data.userIds ? inArray(profiles.userId, job.data.userIds) : undefined,
        // Active in the last 14 days: Better Auth moves updated_at forward as the session is used.
        sql`exists (select 1 from ${session} where ${session.userId} = ${profiles.userId} and ${session.updatedAt} > now() - interval '14 days')`,
        // Credits left: a user who cannot send an application is not scored for one.
        sql`(select coalesce(sum(${creditLedger.delta}), 0) from ${creditLedger} where ${creditLedger.userId} = ${profiles.userId}) > 0`,
        // Billing not paused.
        sql`(${subscriptions.status} is null or ${subscriptions.status} <> 'paused')`,
        sql`(${subscriptions.pausedUntil} is null or ${subscriptions.pausedUntil} <= now())`,
      ),
    );
  let stored = 0;
  const retry = new Map<number, string[]>(); // delay in ms to the users that wait that long

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

    const plan: PlanId = candidate.plan && PAID_STATUSES.includes(candidate.status ?? "") ? candidate.plan : "free";
    if (!(await reserveScoring(candidate.userId, plan))) continue;

    const summary = userFacts.map((f) => `- (${f.kind}) ${f.text}`).join("\n");
    try {
      const fit = await scoreFit(fitJob, summary, gatewayCtx({ userId: candidate.userId, plan, jobId: row.job.id }));
      if (fit.score < prefs.fitThreshold) continue;
      await db()
        .insert(matches)
        .values({ userId: candidate.userId, jobId: row.job.id, passedFilters: true, score: fit.score, reasons: fit.reasons })
        .onConflictDoNothing();
      stored += 1;
    } catch (err) {
      // No reply was billed: the slot goes back, so the follow-up can take it.
      if (refundable(err)) await releaseScoring(candidate.userId);
      const delay = retryDelayMs(err, job.data.attempt ?? 0);
      if (delay !== null) retry.set(delay, [...(retry.get(delay) ?? []), candidate.userId]);
      logger.warn({ err, userHash: logUserHash(candidate.userId), jobId: row.job.id, retry: delay !== null }, "fit scoring failed");
    }
  }

  const attempt = (job.data.attempt ?? 0) + 1;
  for (const [delay, userIds] of retry) {
    await enqueue("score-matches", { jobId: row.job.id, userIds, attempt }, `rescore-${row.job.id}-${attempt}-${delay}`, delay);
  }
  return { stored, retrying: [...retry.values()].reduce((n, ids) => n + ids.length, 0) };
}

/**
 * Takes one of today's scoring slots for the user: a guarded upsert on user_daily_usage that moves only while scored is
 * under the plan's dailyScoringCap and the day's pipeline spend is under dailyModelSpendCapUsd (scale-12, matching-60).
 */
async function reserveScoring(userId: string, plan: PlanId): Promise<boolean> {
  const { dailyScoringCap, dailyModelSpendCapUsd } = getPlan(plan);
  const [row] = await db()
    .insert(userDailyUsage)
    .values({ userId, day: new Date().toISOString().slice(0, 10), scored: 1 })
    .onConflictDoUpdate({
      target: [userDailyUsage.userId, userDailyUsage.day],
      set: { scored: sql`${userDailyUsage.scored} + 1`, updatedAt: new Date() },
      setWhere: sql`${userDailyUsage.scored} < ${dailyScoringCap} and ${userDailyUsage.pipelineUsd} < ${dailyModelSpendCapUsd}`,
    })
    .returning({ scored: userDailyUsage.scored });
  return Boolean(row);
}

async function releaseScoring(userId: string): Promise<void> {
  await db()
    .update(userDailyUsage)
    .set({ scored: sql`greatest(${userDailyUsage.scored} - 1, 0)`, updatedAt: new Date() })
    .where(and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.day, new Date().toISOString().slice(0, 10))));
}

/**
 * When a failed pair is tried again, or null for never: a retryable AgentError comes back after 1, 2, then 4 minutes,
 * or at 00:00 UTC when a daily budget stopped it. A bad input, an injection echo or a per-call cost refusal would fail
 * the same way again, so it is not retried.
 */
function retryDelayMs(err: unknown, attempt: number): number | null {
  if (!(err instanceof AgentError) || !err.retryable || attempt + 1 >= MAX_ATTEMPTS) return null;
  if (err.code === "invalid_request" || err.code === "precheck_failed" || err.code === "injection_echo" || err.budget?.scope === "call") return null;
  if (err.budget?.retryAfter === "next_utc_day") return Math.max(60_000, Date.parse(nextUtcMidnight()) - Date.now());
  return 60_000 * 2 ** attempt;
}
