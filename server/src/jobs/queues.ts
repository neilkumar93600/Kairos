import { Queue, type ConnectionOptions, type WorkerOptions } from "bullmq";
import type { EMAIL_KINDS } from "../db/schema";
import { redis } from "../lib/redis";

/** Queue names. The worker service consumes all but `cloud-apply`, which the applier service consumes. */
export const QUEUES = {
  pollBoards: "poll-boards",
  scoreMatches: "score-matches",
  scoreUser: "score-user",
  tailorApplication: "tailor-application",
  parseResume: "parse-resume",
  classifyEmail: "classify-email",
  cloudApply: "cloud-apply",
  costRollup: "cost-rollup",
  ledgerWatch: "ledger-watch",
  maintenance: "maintenance",
  notify: "notify",
} as const;

export interface JobData {
  "poll-boards": { companyId: string } | { schedule: true };
  /** userIds and attempt are set on the delayed follow-up for pairs a retryable model failure skipped. backfillUserId: one user's capped backfill. */
  "score-matches": { jobId: string; userIds?: string[]; attempt?: number } | { backfillUserId: string };
  /** Drains one chunk of the user's scoring lane (jobs/score-matches.ts). */
  "score-user": { userId: string };
  "tailor-application": { applicationId: string };
  /** One import (WP-17). `resumeProfileId` is the shape queued before WP-17; such a job is skipped (backfill-sources). */
  "parse-resume": { importId: string } | { resumeProfileId: string };
  "classify-email": { inboundEmailId: string };
  "cloud-apply": { applicationId: string };
  "cost-rollup": { schedule: true };
  "ledger-watch": { schedule: true };
  /** The job name picks the task (jobs/schedules.ts). */
  maintenance: { schedule: true };
  /** One email of the notify ledger (jobs/notify.ts); rendered from the database at send time. */
  notify: { kind: (typeof EMAIL_KINDS)[number]; entityId: string; userId: string | null };
}

export type QueueName = keyof JobData;

/**
 * The queues the outbox feeds (durable/outbox.ts). emitOutbox takes only these, and resume needs a refusal check for each,
 * so adding one here is what puts a queue on the seam, and the compiler asks for the rest.
 */
export const OUTBOX_QUEUES = ["cloud-apply"] as const;
export type OutboxQueue = (typeof OUTBOX_QUEUES)[number];

/**
 * How long a completed job stays in Redis. An outbox-fed job's completed state IS its row's completion (the sweep reads it
 * every minute), so nothing but age may remove it: a count evicts finished work once the queue completes that many more,
 * the sweep then reads it as lost, and five such reads would mark a finished row dead. Nothing reads a completed job later
 * than the sweep; the drain and reconcile-apply replace a finished job of the same id. Every other queue keeps the count,
 * and its 24 hours of job-id dedupe.
 */
export const completedRetention = (name: QueueName): { age: number; count?: number } =>
  (OUTBOX_QUEUES as readonly QueueName[]).includes(name) ? { age: 2 * 3600 } : { age: 24 * 3600, count: 5000 };

export interface QueueConfig {
  /** Jobs one worker process runs at once; QUEUE_CONCURRENCY overrides it per environment (the applier: APPLIER_CONCURRENCY). */
  concurrency: number;
  attempts: number;
  /** First retry delay; each next one doubles. */
  backoffMs: number;
  /**
   * Longer than the job's own run bound. BullMQ renews the lock while the job runs, so this is how long a missed
   * renewal (a blocked event loop, a Redis blip) is tolerated before another worker takes the job as stalled.
   */
  lockDurationMs: number;
  /** Starts per window across every worker of the queue (BullMQ limiter). */
  limiter?: { max: number; duration: number };
}

const MINUTE = 60_000;
const STANDARD = { attempts: 3, backoffMs: 10_000, lockDurationMs: 30_000 };

/**
 * One row per queue (platform-06 and scale-06 in BullMQ form). cloud-apply has no limiter: its 240 starts a minute are
 * counted by the apply gate (jobs/apply-gate.ts), which counts real starts only, not runs parked for a busy host.
 */
export const QUEUE_CONFIG: Record<QueueName, QueueConfig> = {
  "poll-boards": { ...STANDARD, concurrency: 8 },
  // The fan-out only: database reads, no model call.
  "score-matches": { ...STANDARD, concurrency: 2 },
  // Model calls, one chunk of one user per job. 1,200 a minute never binds (03-fit-scoring 4); a safety net.
  "score-user": { ...STANDARD, concurrency: 4, limiter: { max: 1200, duration: MINUTE } },
  "tailor-application": { ...STANDARD, concurrency: 4 },
  "parse-resume": { ...STANDARD, concurrency: 2 },
  "classify-email": { ...STANDARD, concurrency: 4 },
  // 45 s goto + 15 s load + 120 s fill, plus the claim and the result write.
  "cloud-apply": { ...STANDARD, concurrency: 2, lockDurationMs: 4 * MINUTE },
  "cost-rollup": { ...STANDARD, concurrency: 1 },
  "ledger-watch": { ...STANDARD, concurrency: 1 },
  // Partitions, sweeps and reconcilers (jobs/schedules.ts); 4, so a slow daily task never holds up the minute ones.
  maintenance: { ...STANDARD, concurrency: 4 },
  // A send is one 10 s Postmark call (plus a 10 s search on a re-claim). Five attempts, as the email_sends ledger;
  // 30 s, 60 s, 2 min... so a Postmark blip clears before the lease-only path matters (WP-44).
  notify: { concurrency: 8, attempts: 5, backoffMs: 30_000, lockDurationMs: 60_000 },
};

/** Every queue the worker consumes, with its concurrency: the table's, or QUEUE_CONCURRENCY's. Refuses unknown names. */
export function workerConcurrency(overrides: Record<string, number>): Partial<Record<QueueName, number>> {
  const consumed = (Object.keys(QUEUE_CONFIG) as QueueName[]).filter((name) => name !== QUEUES.cloudApply);
  for (const name of Object.keys(overrides)) {
    if (!(consumed as string[]).includes(name)) throw new Error(`QUEUE_CONCURRENCY names ${name}, which the worker does not consume`);
  }
  return Object.fromEntries(consumed.map((name) => [name, overrides[name] ?? QUEUE_CONFIG[name].concurrency]));
}

/** The BullMQ Worker options of one queue, on the process's shared connection. */
export function workerOptions(name: QueueName, concurrency: number): WorkerOptions {
  const c = QUEUE_CONFIG[name];
  return { connection: redisConnection(), concurrency, lockDuration: c.lockDurationMs, ...(c.limiter ? { limiter: c.limiter } : {}) };
}

/**
 * One Redis connection per process (platform-68), shared by every Queue and Worker; each Worker adds only its own
 * blocking connection. BullMQ leaves a shared client open, so each entry point quits it last.
 */
export function redisConnection(): ConnectionOptions {
  return redis();
}

const queues = new Map<QueueName, Queue>();

export function queue<N extends QueueName>(name: N): Queue<JobData[N]> {
  let q = queues.get(name);
  if (!q) {
    const c = QUEUE_CONFIG[name];
    q = new Queue(name, {
      connection: redisConnection(),
      defaultJobOptions: {
        attempts: c.attempts,
        backoff: { type: "exponential", delay: c.backoffMs },
        removeOnComplete: completedRetention(name),
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
    queues.set(name, q);
  }
  return q as unknown as Queue<JobData[N]>;
}

/**
 * Adds a job; the jobId makes enqueueing idempotent (the same application is never tailored twice at once). delayMs
 * holds it back that long (a delayed retry); a priority (fairPriority) puts it behind lower ones, first in first out
 * among equals.
 */
export async function enqueue<N extends QueueName>(name: N, data: JobData[N], jobId?: string, delayMs?: number, priority?: number): Promise<void> {
  // BullMQ's generic name typing is stricter than we need here.
  await (queue(name) as unknown as Queue).add(name, data, { ...(jobId ? { jobId } : {}), ...(delayMs ? { delay: delayMs } : {}), ...(priority ? { priority } : {}) });
}

/**
 * Per-user fairness for one-job-per-item queues (prepare, scale-06): the priority is the user's count of jobs still
 * waiting there, so their k-th waits behind every other user's first. BullMQ priorities run from 1 to 2^21; jobs
 * without one (a reconciler's redrive) go first.
 */
export const fairPriority = (waiting: number): number => Math.min(Math.max(waiting, 1), 2 ** 21);

/**
 * What a reconciler does with a job id Redis may have lost: add it when Redis has no such job, leave a waiting, delayed
 * or running one alone, and replace a finished one only when `replaceFinished` (BullMQ ignores an add whose id it
 * still holds, so a failed job would otherwise block its own redrive for the 7 days it is kept).
 */
export function redriveAction(state: string, replaceFinished: boolean): "add" | "replace" | "skip" {
  if (state === "unknown") return "add";
  return replaceFinished && (state === "completed" || state === "failed") ? "replace" : "skip";
}

/** Re-adds a job a reconciler found missing (redriveAction). Returns whether it added one. */
export async function redrive<N extends QueueName>(name: N, data: JobData[N], jobId: string, replaceFinished = false): Promise<boolean> {
  const job = await queue(name).getJob(jobId);
  const action = redriveAction(job ? await job.getState() : "unknown", replaceFinished);
  if (action === "skip") return false;
  // A racing worker may have replaced it already; the add below is then a no-op.
  if (action === "replace") await job!.remove().catch(() => {});
  await enqueue(name, data, jobId);
  return true;
}

/**
 * A per-user lane: what one user still has waiting on a queue, drained a chunk per job (scale-06). BullMQ groups are a
 * BullMQ Pro feature, so fairness comes from holding at most one waiting job per user: one user's backlog sits in the
 * lane, not in the queue, and other users' jobs are never behind more than one of its chunks.
 */
export interface Lane {
  /** Adds members (first in, first out; a member already waiting keeps its place) and makes sure a job will drain them. */
  add(userId: string, members: string[]): Promise<void>;
  peek(userId: string, n: number): Promise<string[]>;
  done(userId: string, members: string[]): Promise<void>;
  /** Queues the user's job again, behind every other user's, when members remain. */
  next(userId: string): Promise<void>;
}

/** A lane's members expire this long after the last add, so a lane nobody drains cannot fill a noeviction Redis. */
const LANE_TTL_MS = 7 * 24 * 3600 * 1000;

/**
 * The lane in Redis: a sorted set per user, scored by when each member arrived, and a job deduplicated per user with
 * keepLastIfActive. A wake while the user's job waits does nothing (that job will see the new members); a wake while it
 * runs is kept and becomes a new job, at the back of the queue, once the run ends. So no wake is lost.
 * ponytail: a user job that fails all its attempts leaves its lane until the user's next add; WP-42 replaces this loop.
 */
export function redisLane(name: "score-user"): Lane {
  const key = (userId: string) => `kairos:lane:${name}:${userId}`;
  const wake = (userId: string) =>
    (queue(name) as unknown as Queue).add(name, { userId }, { deduplication: { id: userId, keepLastIfActive: true }, removeOnComplete: true });
  return {
    async add(userId, members) {
      if (members.length === 0) return;
      const now = Date.now();
      await redis().zadd(key(userId), "NX", ...members.flatMap((m, i) => [now + i, m]));
      await redis().pexpire(key(userId), LANE_TTL_MS);
      await wake(userId);
    },
    peek: (userId, n) => redis().zrange(key(userId), 0, n - 1),
    done: async (userId, members) => void (members.length && (await redis().zrem(key(userId), ...members))),
    async next(userId) {
      if ((await redis().zcard(key(userId))) > 0) await wake(userId);
    },
  };
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
