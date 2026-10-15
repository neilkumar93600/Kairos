import { Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../lib/env";

/** Queue names. The worker service consumes all but `cloud-apply`, which the applier service consumes. */
export const QUEUES = {
  pollBoards: "poll-boards",
  scoreMatches: "score-matches",
  tailorApplication: "tailor-application",
  parseResume: "parse-resume",
  classifyEmail: "classify-email",
  cloudApply: "cloud-apply",
} as const;

export interface JobData {
  "poll-boards": { companyId: string } | { schedule: true };
  "score-matches": { jobId: string };
  "tailor-application": { applicationId: string };
  "parse-resume": { resumeProfileId: string };
  "classify-email": { inboundEmailId: string };
  "cloud-apply": { applicationId: string };
}

export type QueueName = keyof JobData;

/** Each queue and worker gets its own connection; BullMQ needs maxRetriesPerRequest: null. */
export function redisConnection(): ConnectionOptions {
  return new Redis(env().REDIS_URL, { maxRetriesPerRequest: null, family: 0 });
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

/** Adds a job; the jobId makes enqueueing idempotent (the same application is never tailored twice at once). */
export async function enqueue<N extends QueueName>(name: N, data: JobData[N], jobId?: string): Promise<void> {
  // BullMQ's generic name typing is stricter than we need here.
  await (queue(name) as unknown as Queue).add(name, data, jobId ? { jobId } : undefined);
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
