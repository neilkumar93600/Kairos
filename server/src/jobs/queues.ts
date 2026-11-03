import { Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { baseEnv } from "../lib/env";

/** Queue names. The worker service consumes all but `cloud-apply`, which the applier service consumes. */
export const QUEUES = {
  pollBoards: "poll-boards",
  scoreMatches: "score-matches",
  tailorApplication: "tailor-application",
  parseResume: "parse-resume",
  classifyEmail: "classify-email",
  cloudApply: "cloud-apply",
  costRollup: "cost-rollup",
  ledgerWatch: "ledger-watch",
  maintenance: "maintenance",
} as const;

export interface JobData {
  "poll-boards": { companyId: string } | { schedule: true };
  /** userIds and attempt are set on the delayed follow-up for pairs a retryable model failure skipped. */
  "score-matches": { jobId: string; userIds?: string[]; attempt?: number };
  "tailor-application": { applicationId: string };
  "parse-resume": { resumeProfileId: string };
  "classify-email": { inboundEmailId: string };
  "cloud-apply": { applicationId: string };
  "cost-rollup": { schedule: true };
  "ledger-watch": { schedule: true };
  /** The job name picks the task (jobs/schedules.ts). */
  maintenance: { schedule: true };
}

export type QueueName = keyof JobData;

/** Each queue and worker gets its own connection; BullMQ needs maxRetriesPerRequest: null. */
export function redisConnection(): ConnectionOptions {
  return new Redis(baseEnv().REDIS_URL, { maxRetriesPerRequest: null, family: 0 });
}

const queues = new Map<QueueName, Queue>();

export function queue<N extends QueueName>(name: N): Queue<JobData[N]> {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: redisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { age: 24 * 3600, count: 5000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
    queues.set(name, q);
  }
  return q as unknown as Queue<JobData[N]>;
}

/**
 * Adds a job; the jobId makes enqueueing idempotent (the same application is never tailored twice at once). delayMs
 * holds it back that long (a delayed retry).
 */
export async function enqueue<N extends QueueName>(name: N, data: JobData[N], jobId?: string, delayMs?: number): Promise<void> {
  // BullMQ's generic name typing is stricter than we need here.
  await (queue(name) as unknown as Queue).add(name, data, { ...(jobId ? { jobId } : {}), ...(delayMs ? { delay: delayMs } : {}) });
}

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

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
