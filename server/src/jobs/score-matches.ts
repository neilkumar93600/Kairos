import type { Job } from "bullmq";
import { and, asc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getPlan, type PlanId, type Preferences } from "@auto-career/shared";
import { fitScorer } from "../agents/fit-scorer/spec";
import type { AgentCallContext } from "../agents/types";
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
import { passesHardFilters, scoreFit, type FitJob } from "../services/fit";
import { computeJobFit } from "../services/job-fit";
import type { ScoredPair } from "../services/job-import";
import { dailyScoringCap, jobsForUser, toUserPrefilter, usersForJob } from "../services/prefilter";
import { enqueue, QUEUES, redisLane, type JobData, type Lane } from "./queues";

/** Follow-up attempts for pairs a retryable model failure skipped (matching-v02). */
const MAX_ATTEMPTS = 3;
/** Pairs one user job scores before that user goes to the back of the queue (03-fit-scoring: CHUNK_PAIRS). */
export const CHUNK = 5;
/** Users one page of the fan-out takes. */
export const USER_PAGE = 500;
/** The F1 pre-rank floor (04-matching 7.2, matching-49, v10): pairs under it cost no model call and are not stored. */
export const F1_FLOOR = 35;
/** A thin profile (under COLD_START_FACTS confirmed facts) reads low on F1 for reasons that are not the job's (04-matching 16). */
export const F1_FLOOR_COLD_START = 20;
export const COLD_START_FACTS = 8;
/** Backfill: how far back it looks, and the most postings one run reads (04-matching 5.4: min(4 x K, 400)). */
const BACKFILL_WINDOW_DAYS = 30;
const BACKFILL_MAX_RECALL = 400;
/** matches.scorer_version: the prompt that ran; null on the legacy client, which has no versioned prompt. */
const scorerVersion = (promptVersion: number | undefined): string | null => (promptVersion === undefined ? null : `${fitScorer.id}@v${promptVersion}`);

let lane: Lane | undefined;
const scoreLane = () => (lane ??= redisLane(QUEUES.scoreUser));
/** Tests drain an in-memory lane (test/helpers/lanes.ts). */
export function setScoreLane(next: Lane): void {
  lane = next;
}

/** One user's eligibility, read again when their lane runs or a backfill starts (the fan-out's is services/prefilter.ts). */
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

/**
 * pause_scoring, a stop on the model itself (llm_paused, agent_disabled:fit-scorer), or flags nobody could read: spend
 * stops rather than runs blind, and a lane keeps its members instead of having the gateway refuse them one by one.
 */
async function scoringPaused(): Promise<boolean> {
  const f = await getFlags();
  return f.pauseScoring || f.llmPaused || f.agentDisabled.has(fitScorer.id) || !f.loaded;
}

/** How long a lane held by a pause waits before it looks again. */
export const PAUSE_RETRY_MS = 15 * 60_000;

/**
 * The gateway refusing on a flag this process has not read yet: its flag cache and ours can differ by up to 10 s. Nothing
 * was billed and the pair is fine, so it is held, not failed.
 */
const refusedByFlag = (err: unknown): boolean => err instanceof AgentError && (err.code === "llm_paused" || err.code === "agent_disabled");

/**
 * Looks at the user's lane again after a pause, so it resumes by itself rather than on the user's next posting. One job a
 * user per PAUSE_RETRY_MS while paused. A plain delayed job, not the lane's own wake: BullMQ's keepLastIfActive stores the
 * next job from inside the active one, and this must not come back at once.
 * ponytail: it can overlap a posting's wake of the same user at the moment scoring resumes; scoreChunk's matches check then
 * limits the cost to a pair in flight.
 */
const wakeLater = (userId: string, delayMs: number) => enqueue("score-user", { userId }, `wake-${userId}-${Math.floor(Date.now() / PAUSE_RETRY_MS)}`, delayMs);

/** A lane member: the posting, the follow-up attempt after a retryable model failure, and a backfill's mark. */
const toMember = (jobId: string, attempt: number) => (attempt ? `${jobId}:${attempt}` : jobId);
const backfillMember = (jobId: string) => `${jobId}:0:b`;
const fromMember = (m: string) => {
  const [jobId, attempt, mark] = m.split(":");
  return { jobId: jobId!, attempt: Number(attempt ?? 0), selection: mark === "b" ? ("backfill" as const) : ("ranked" as const) };
};

type ConfirmedFact = { id: string; kind: string; text: string; confirmed: boolean };

const CONFIRMED_FACT = { id: facts.id, kind: facts.kind, text: facts.text, confirmed: facts.confirmed };
const confirmedFacts = (userId: string): Promise<ConfirmedFact[]> =>
  // Stable order: the same 80 each run, so the summary, the score and the F1 floor do not move between runs.
  db().select(CONFIRMED_FACT).from(facts).where(and(eq(facts.userId, userId), eq(facts.confirmed, true))).orderBy(asc(facts.createdAt), asc(facts.id)).limit(80);
const summaryOf = (rows: ConfirmedFact[]) => rows.map((f) => `- (${f.kind}) ${f.text}`).join("\n");

/** F1 in pre-rank mode (04-matching 7.1): no resume text, so a confirmed fact's keyword counts. Never shown, never sent to a model. */
export function prerankScore(job: { id: string; title: string; companyName: string; descriptionText: string }, rows: ConfirmedFact[], prefs: Preferences): number {
  return computeJobFit({ job, facts: rows, resumeText: "", preferences: { roles: prefs.roles, seniority: prefs.seniority } }).score;
}
export const f1Floor = (confirmedFactCount: number): number => (confirmedFactCount < COLD_START_FACTS ? F1_FLOOR_COLD_START : F1_FLOOR);

/**
 * Fans one new posting out to the users it could matter to: one paged SQL prefilter (services/prefilter.ts), then the
 * hard filters on what survives, so the model is only called for jobs a user could plausibly want. Each passing user gets
 * the posting in their scoring lane, and the model calls run per user, a chunk at a time (processScoreUser), so one user's
 * backlog never holds up another's (scale-06). A posting of a company that is not active fans out to nobody: an imported
 * board costs no model call until the owner activates it (CISO mustFix 3). The pause_scoring flag stops it; each call
 * reserves one of the plan's scoring slots; a retryable model failure comes back as a delayed follow-up for that user.
 */
export async function processScoreMatches(job: Job<JobData["score-matches"]>) {
  if (await scoringPaused()) {
    // ponytail: postings that arrive while paused are not scored later; the nightly re-score of WP-34 picks them up.
    logger.info("scoring paused");
    // A follow-up already belongs to its users: it waits in their lanes. Each wakes, sees the pause and looks again later.
    if ("jobId" in job.data && job.data.userIds) {
      const member = toMember(job.data.jobId, job.data.attempt ?? 0);
      await Promise.all(job.data.userIds.map((userId) => scoreLane().add(userId, [member])));
    }
    return { queued: 0, paused: true };
  }
  if ("backfillUserId" in job.data) return backfill(job.data.backfillUserId);
  const { jobId, userIds, attempt } = job.data;
  const [row] = await db()
    .select({ job: jobs, companyName: companies.name, companyActive: companies.active })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(jobs.id, jobId));
  if (!row || row.job.closedAt || !row.companyActive) return { queued: 0 };

  let queued = 0;
  let after: string | undefined;
  for (;;) {
    const page = await usersForJob(db(), row.job, { after, limit: USER_PAGE, userIds });
    for (const candidate of page) {
      if (!passesHardFilters(fitJob(row), candidate.preferences, candidate.recent).pass) continue;
      await scoreLane().add(candidate.userId, [toMember(jobId, attempt ?? 0)]);
      queued += 1;
    }
    if (page.length < USER_PAGE) return { queued };
    after = page.at(-1)!.userId;
  }
}

/** What each company counts toward the per-company limit for this user: the number passesHardFilters takes. */
async function companyCounts(userId: string): Promise<Map<string, number>> {
  const rows = await db()
    .select({ companyId: jobs.companyId, n: sql<number>`count(*)::int` })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.userId, userId), gte(applications.createdAt, sql`now() - interval '30 days'`)))
    .groupBy(jobs.companyId);
  return new Map(rows.map((r) => [r.companyId, r.n]));
}

/**
 * A capped backfill (matching-69), on preference save and on the first confirmed facts, so a new user's feed is not empty
 * until the next posting. K is what today's cap has left; it reads at most 4 x K recent postings, gates them, ranks them
 * by F1 and queues the best K. It draws from the daily cap and never adds to it.
 */
async function backfill(userId: string): Promise<{ queued: number }> {
  const [candidate] = await candidates([userId]);
  if (!candidate?.preferences) return { queued: 0 };
  const prefs = candidate.preferences;
  const plan = planOf(candidate);
  const [usage] = await db()
    .select({ scored: userDailyUsage.scored })
    .from(userDailyUsage)
    .where(and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.day, new Date().toISOString().slice(0, 10))));
  const k = dailyScoringCap(plan) - (usage?.scored ?? 0);
  if (k <= 0) return { queued: 0 };
  const rows = await confirmedFacts(userId);
  if (rows.length === 0) return { queued: 0 };

  const counts = await companyCounts(userId);
  const found = await jobsForUser(db(), userId, toUserPrefilter(prefs, counts), { visibleDays: BACKFILL_WINDOW_DAYS, limit: Math.min(4 * k, BACKFILL_MAX_RECALL) });
  const floor = f1Floor(rows.length);
  const ranked = found
    .filter((j) => passesHardFilters(j, prefs, counts.get(j.companyId) ?? 0).pass)
    .map((j) => ({ id: j.id, f1: prerankScore(j, rows, prefs) }))
    .filter((j) => j.f1 >= floor)
    .sort((x, y) => y.f1 - x.f1) // stable: within a score, the newest first, as jobsForUser read them
    .slice(0, k);
  if (ranked.length) await scoreLane().add(userId, ranked.map((j) => backfillMember(j.id)));
  return { queued: ranked.length };
}

/**
 * One chunk of a user's lane: up to CHUNK members through `score`, marked done only once scored (a run that throws
 * leaves them for BullMQ's retry), then the user queued again behind every other user if members remain. Members the run
 * reports as `held` stay, and the user is not queued again: whoever held them has arranged the next look.
 */
export async function runChunk<R>(from: Lane, userId: string, score: (members: string[]) => Promise<R>): Promise<R> {
  const members = await from.peek(userId, CHUNK);
  const result = await score(members);
  const held = (result as { held?: string[] } | undefined)?.held ?? [];
  await from.done(userId, members.filter((m) => !held.includes(m)));
  if (held.length === 0) await from.next(userId);
  return result;
}

/** Scores the next chunk of one user's lane. A score under the user's bar is stored as below_bar, so it is never paid for twice. */
export async function processScoreUser(job: Job<JobData["score-user"]>) {
  // Paused: the lane keeps its members and looks again later, so it resumes by itself.
  if (await scoringPaused()) {
    if ((await scoreLane().peek(job.data.userId, 1)).length) await wakeLater(job.data.userId, PAUSE_RETRY_MS);
    return { stored: 0, retrying: 0, paused: true };
  }
  return runChunk(scoreLane(), job.data.userId, (members) => scoreChunk(job.data.userId, members));
}

/** An import stored while the scorer could not run: services/prefilter.ts selects these too. */
const UNSCORED_IMPORT = sql`(${matches.status} = 'new' and ${matches.score} is null and ${matches.source} = 'manual_url')`;

const planOf = (c: { plan: PlanId | null; status: string | null }): PlanId => (c.plan && PAID_STATUSES.includes(c.status ?? "") ? c.plan : "free");

async function scoreChunk(userId: string, members: string[]): Promise<{ stored: number; belowBar: number; retrying: number; held?: string[] }> {
  const out: { stored: number; belowBar: number; retrying: number; held?: string[] } = { stored: 0, belowBar: 0, retrying: 0 };
  // Read again: the user may have run out of credits or paused billing since the fan-out.
  const [candidate] = await candidates([userId]);
  if (!candidate?.preferences) return out;
  const prefs = candidate.preferences;
  const rows = await confirmedFacts(userId);
  if (rows.length === 0) return out;
  const summary = summaryOf(rows);
  const floor = f1Floor(rows.length);
  const plan = planOf(candidate);

  const pairs = members.map(fromMember);
  const ids = pairs.map((p) => p.jobId);
  const postings = await db()
    .select({ job: jobs, companyName: companies.name })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(inArray(jobs.id, ids));
  // A posting can be in the lane twice, from a fan-out and a backfill: the pair is paid for once. An import stored while
  // the scorer could not run has no score yet, so it is still to pay for.
  const scored = new Set(
    (await db().select({ jobId: matches.jobId }).from(matches).where(and(eq(matches.userId, userId), inArray(matches.jobId, ids), sql`not ${UNSCORED_IMPORT}`))).map((m) => m.jobId),
  );

  for (const [index, { jobId, attempt, selection }] of pairs.entries()) {
    const row = postings.find((p) => p.job.id === jobId);
    if (!row || row.job.closedAt || scored.has(jobId)) continue;
    const prerank = prerankScore({ id: jobId, title: row.job.title, companyName: row.companyName, descriptionText: row.job.descriptionText }, rows, prefs);
    if (prerank < floor) continue;
    if (!(await reserveScoring(userId, plan))) continue;
    try {
      const fit = await scoreFit(fitJob(row), summary, gatewayCtx({ userId, plan, jobId }));
      const status = fit.score >= prefs.fitThreshold ? ("new" as const) : ("below_bar" as const);
      const result = { score: fit.score, reasons: fit.reasons, status, prerankScore: prerank, scorerVersion: scorerVersion(fit.promptVersion), scoredAt: new Date() };
      await db()
        .insert(matches)
        .values({ userId, jobId, passedFilters: true, selection, ...result })
        // Only an unscored import is filled in, and it stays an import; any other row was scored or decided already.
        .onConflictDoUpdate({ target: [matches.userId, matches.jobId], set: result, setWhere: UNSCORED_IMPORT });
      scored.add(jobId);
      if (status === "new") out.stored += 1;
      else out.belowBar += 1;
    } catch (err) {
      // No reply was billed: the slot goes back, so the follow-up can take it.
      if (refundable(err)) await releaseScoring(userId);
      const delay = retryDelayMs(err, attempt);
      if (refusedByFlag(err)) {
        // This pair and the rest of the chunk stay in the lane: every one of them would be refused the same way.
        out.held = members.slice(index);
        await wakeLater(userId, delay!);
        logger.info({ userHash: logUserHash(userId), held: out.held.length }, "scoring refused by a flag; lane held");
        return out;
      }
      if (delay !== null) {
        await enqueue("score-matches", { jobId, userIds: [userId], attempt: attempt + 1 }, `rescore-${jobId}-${userId}-${attempt + 1}`, delay);
        out.retrying += 1;
      }
      logger.warn({ err, userHash: logUserHash(userId), jobId, retry: delay !== null }, "fit scoring failed");
    }
  }
  return out;
}

/**
 * The import flow's scorer step (matching-85, 86): one synchronous call for one pasted posting, one dailyScoringCap unit.
 * A user is waiting, so it runs in the interactive workspace and budget (agents/03-fit-scorer 2), not batch with its
 * limiter wait. Null when it cannot run (paused, no confirmed fact, cap reached, the model failed): the import still
 * succeeds, unscored, and the next import of the posting or the next backfill scores it.
 */
export async function scoreImported(userId: string, plan: PlanId, jobId: string, job: FitJob, prefs: Preferences, signal?: AgentCallContext["signal"]): Promise<ScoredPair | null> {
  if (await scoringPaused()) return null;
  const rows = await confirmedFacts(userId);
  if (rows.length === 0 || !(await reserveScoring(userId, plan))) return null;
  try {
    const fit = await scoreFit(job, summaryOf(rows), gatewayCtx({ userId, plan, jobId, workspace: "interactive", budgetClass: "interactive", ...(signal ? { signal } : {}) }));
    return {
      score: fit.score,
      reasons: fit.reasons,
      scorerVersion: scorerVersion(fit.promptVersion),
      prerankScore: prerankScore({ id: jobId, title: job.title, companyName: job.companyName, descriptionText: job.descriptionText }, rows, prefs),
    };
  } catch (err) {
    if (refundable(err)) await releaseScoring(userId);
    logger.warn({ err, userHash: logUserHash(userId), jobId }, "import scoring failed");
    return null;
  }
}

/**
 * Takes one of today's scoring slots for the user: a guarded upsert on user_daily_usage that moves only while scored is
 * under the plan's dailyScoringCap and the day's pipeline spend is under dailyModelSpendCapUsd (scale-12, matching-60).
 */
async function reserveScoring(userId: string, plan: PlanId): Promise<boolean> {
  const { dailyModelSpendCapUsd } = getPlan(plan);
  const [row] = await db()
    .insert(userDailyUsage)
    .values({ userId, day: new Date().toISOString().slice(0, 10), scored: 1 })
    .onConflictDoUpdate({
      target: [userDailyUsage.userId, userDailyUsage.day],
      set: { scored: sql`${userDailyUsage.scored} + 1`, updatedAt: new Date() },
      setWhere: sql`${userDailyUsage.scored} < ${dailyScoringCap(plan)} and ${userDailyUsage.pipelineUsd} < ${dailyModelSpendCapUsd}`,
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
 * When a failed pair is tried again, or null for never: a pause or a disabled agent after PAUSE_RETRY_MS, however many
 * attempts it has had, since neither is the pair's fault. Any other retryable AgentError comes back after 1, 2, then 4
 * minutes, or at 00:00 UTC when a daily budget stopped it. A bad input, an injection echo or a per-call cost refusal
 * would fail the same way again, so it is not retried.
 */
export function retryDelayMs(err: unknown, attempt: number): number | null {
  if (refusedByFlag(err)) return PAUSE_RETRY_MS;
  if (!(err instanceof AgentError) || !err.retryable || attempt + 1 >= MAX_ATTEMPTS) return null;
  if (err.code === "invalid_request" || err.code === "precheck_failed" || err.code === "injection_echo" || err.budget?.scope === "call") return null;
  if (err.budget?.retryAfter === "next_utc_day") return Math.max(60_000, Date.parse(nextUtcMidnight()) - Date.now());
  return 60_000 * 2 ** attempt;
}
