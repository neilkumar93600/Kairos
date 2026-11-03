import type { Job } from "bullmq";
import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getPlan, type PlanId } from "@auto-career/shared";
import { db } from "../db/client";
import { applications, companies, creditLedger, facts, jobs, matches, profiles, session, subscriptions } from "../db/schema";
import { userDailyUsage } from "../db/schema/platform";
import { getFlags } from "../lib/flags";
import { nextUtcMidnight } from "../lib/errors";
import { logger, logUserHash } from "../lib/logger";
import { AgentError } from "../llm/errors";
import { gatewayCtx } from "../llm/wire";
import { refundable } from "../services/allowance";
import { PAID_STATUSES } from "../services/billing-events";
import { passesHardFilters, scoreFit } from "../services/fit";
import { enqueue, QUEUES, redisLane, type JobData, type Lane } from "./queues";

/** Follow-up attempts for pairs a retryable model failure skipped (matching-v02). */
const MAX_ATTEMPTS = 3;
/** Pairs one user job scores before that user goes to the back of the queue (03-fit-scoring: CHUNK_PAIRS). */
export const CHUNK = 5;

let lane: Lane | undefined;
const scoreLane = () => (lane ??= redisLane(QUEUES.scoreUser));
/** Tests drain an in-memory lane (test/helpers/lanes.ts). */
export function setScoreLane(next: Lane): void {
  lane = next;
}

/**
 * Users who may be scored (WP-06, CISO mustFix 3): preferences set, active in the last 14 days, credits left, billing
 * not paused. ponytail: per-candidate queries; WP-42's set-based prefilter and paged users take over at scale.
 */
function candidates(userIds?: string[]) {
  return db()
    .select({ userId: profiles.userId, preferences: profiles.preferences, plan: subscriptions.plan, status: subscriptions.status })
    .from(profiles)
    .leftJoin(subscriptions, eq(subscriptions.userId, profiles.userId))
    .where(
      and(
        isNotNull(profiles.preferences),
        userIds ? inArray(profiles.userId, userIds) : undefined,
        // Active in the last 14 days: Better Auth moves updated_at forward as the session is used.
        sql`exists (select 1 from ${session} where ${session.userId} = ${profiles.userId} and ${session.updatedAt} > now() - interval '14 days')`,
        // Credits left: a user who cannot send an application is not scored for one.
        sql`(select coalesce(sum(${creditLedger.delta}), 0) from ${creditLedger} where ${creditLedger.userId} = ${profiles.userId}) > 0`,
        // Billing not paused.
        sql`(${subscriptions.status} is null or ${subscriptions.status} <> 'paused')`,
        sql`(${subscriptions.pausedUntil} is null or ${subscriptions.pausedUntil} <= now())`,
      ),
    );
}

type Posting = { job: typeof jobs.$inferSelect; companyName: string };

const fitJob = (row: Posting) => ({
  title: row.job.title,
  companyName: row.companyName,
  location: row.job.location,
  remote: row.job.remote,
  descriptionText: row.job.descriptionText,
  salaryMaxUsd: row.job.salaryMaxUsd,
});

/** A lane member: the posting, and the follow-up attempt after a retryable model failure. */
const toMember = (jobId: string, attempt: number) => (attempt ? `${jobId}:${attempt}` : jobId);
const fromMember = (m: string) => ({ jobId: m.split(":")[0]!, attempt: Number(m.split(":")[1] ?? 0) });

/**
 * Fans one new posting out to the users it could matter to. Hard filters run here, so the model is only called for
 * jobs a user could plausibly want; each passing user gets the posting in their scoring lane, and the model calls run
 * per user, a chunk at a time (processScoreUser), so one user's backlog never holds up another's (scale-06).
 *
 * Interim controls (WP-06) until the matching pipeline of WP-42 replaces this loop: the pause_scoring flag stops it, only
 * candidates() are considered, each call first reserves one of the plan's dailyScoringCap slots, and a retryable model
 * failure comes back as a delayed follow-up of this job for that user (userIds and attempt set).
 */
export async function processScoreMatches(job: Job<JobData["score-matches"]>) {
  if ((await getFlags()).pauseScoring) {
    // ponytail: postings that arrive while paused are not scored later; the nightly re-score of WP-42 picks them up.
    logger.info({ jobId: job.data.jobId }, "scoring paused (pause_scoring)");
    return { queued: 0, paused: true };
  }
  const [row] = await db()
    .select({ job: jobs, companyName: companies.name })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(jobs.id, job.data.jobId));
  if (!row || row.job.closedAt) return { queued: 0 };

  let queued = 0;
  for (const candidate of await candidates(job.data.userIds)) {
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
    if (!candidate.preferences || !passesHardFilters(fitJob(row), candidate.preferences, recent?.n ?? 0).pass) continue;
    await scoreLane().add(candidate.userId, [toMember(row.job.id, job.data.attempt ?? 0)]);
    queued += 1;
  }
  return { queued };
}

/**
 * One chunk of a user's lane: up to CHUNK members through `score`, marked done only once scored (a run that throws
 * leaves them for BullMQ's retry), then the user queued again behind every other user if members remain.
 */
export async function runChunk<R>(from: Lane, userId: string, score: (members: string[]) => Promise<R>): Promise<R> {
  const members = await from.peek(userId, CHUNK);
  const result = await score(members);
  await from.done(userId, members);
  await from.next(userId);
  return result;
}

/** Scores the next chunk of one user's lane. Only matches at or above the user's threshold are stored. */
export async function processScoreUser(job: Job<JobData["score-user"]>) {
  // Paused: the lane keeps its members; the user's next posting wakes it once scoring resumes.
  if ((await getFlags()).pauseScoring) return { stored: 0, retrying: 0, paused: true };
  return runChunk(scoreLane(), job.data.userId, (members) => scoreChunk(job.data.userId, members));
}

async function scoreChunk(userId: string, members: string[]): Promise<{ stored: number; retrying: number }> {
  let stored = 0;
  let retrying = 0;
  // Read again: the user may have run out of credits or paused billing since the fan-out.
  const [candidate] = await candidates([userId]);
  if (!candidate?.preferences) return { stored, retrying };
  const userFacts = await db()
    .select({ kind: facts.kind, text: facts.text })
    .from(facts)
    .where(and(eq(facts.userId, userId), eq(facts.confirmed, true)))
    .limit(80);
  if (userFacts.length === 0) return { stored, retrying };
  const summary = userFacts.map((f) => `- (${f.kind}) ${f.text}`).join("\n");
  const plan: PlanId = candidate.plan && PAID_STATUSES.includes(candidate.status ?? "") ? candidate.plan : "free";

  const pairs = members.map(fromMember);
  const postings = await db()
    .select({ job: jobs, companyName: companies.name })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(inArray(jobs.id, pairs.map((p) => p.jobId)));

  for (const { jobId, attempt } of pairs) {
    const row = postings.find((p) => p.job.id === jobId);
    if (!row || row.job.closedAt) continue;
    if (!(await reserveScoring(userId, plan))) continue;
    try {
      const fit = await scoreFit(fitJob(row), summary, gatewayCtx({ userId, plan, jobId }));
      if (fit.score < candidate.preferences.fitThreshold) continue;
      await db().insert(matches).values({ userId, jobId, passedFilters: true, score: fit.score, reasons: fit.reasons }).onConflictDoNothing();
      stored += 1;
    } catch (err) {
      // No reply was billed: the slot goes back, so the follow-up can take it.
      if (refundable(err)) await releaseScoring(userId);
      const delay = retryDelayMs(err, attempt);
      if (delay !== null) {
        await enqueue("score-matches", { jobId, userIds: [userId], attempt: attempt + 1 }, `rescore-${jobId}-${userId}-${attempt + 1}`, delay);
        retrying += 1;
      }
      logger.warn({ err, userHash: logUserHash(userId), jobId, retry: delay !== null }, "fit scoring failed");
    }
  }
  return { stored, retrying };
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
