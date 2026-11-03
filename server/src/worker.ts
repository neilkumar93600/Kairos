import { Worker, type Job } from "bullmq";
import { sql } from "drizzle-orm";
import { closeDb, db, sizeDbPool } from "./db/client";
import { env, setProcessRole } from "./lib/env";
import { closeServer, deadline, onShutdown, serveHealth, startHeartbeat } from "./lib/lifecycle";
import { logger } from "./lib/logger";
import { assertNoEviction, redis } from "./lib/redis";
import { captureJobFailure, initSentry } from "./lib/sentry";
import { processClassifyEmail } from "./jobs/classify-email";
import { processCostRollup } from "./jobs/cost-rollup";
import { processLedgerWatch } from "./jobs/ledger-watch";
import { processNotify } from "./jobs/notify";
import { processParseResume } from "./jobs/parse-resume";
import { processPollBoards } from "./jobs/poll-boards";
import { closeQueues, queue, QUEUES, workerConcurrency, workerOptions, type QueueName } from "./jobs/queues";
import { processMaintenance, SCHEDULES } from "./jobs/schedules";
import { processScoreMatches, processScoreUser } from "./jobs/score-matches";
import { processTailorApplication } from "./jobs/tailor-application";

setProcessRole("worker");
initSentry("worker");

/** Background worker: polling, scoring, tailoring, resume parsing, reply tagging and the maintenance schedules. */
const handlers: Partial<Record<QueueName, (job: Job) => Promise<unknown>>> = {
  [QUEUES.pollBoards]: processPollBoards,
  [QUEUES.scoreMatches]: processScoreMatches,
  [QUEUES.scoreUser]: processScoreUser,
  [QUEUES.tailorApplication]: processTailorApplication,
  [QUEUES.parseResume]: processParseResume,
  [QUEUES.classifyEmail]: processClassifyEmail,
  [QUEUES.costRollup]: processCostRollup,
  [QUEUES.ledgerWatch]: processLedgerWatch,
  [QUEUES.maintenance]: processMaintenance,
  [QUEUES.notify]: processNotify,
};

// A Redis that evicts loses jobs silently: refuse to start (platform-68). 10 s, so a Redis that is down fails the boot too.
await deadline(assertNoEviction(), 10_000);
const concurrency = workerConcurrency(env().QUEUE_CONCURRENCY);
// One connection per job slot plus the health check and the scheduler upserts (scale-v12).
const slots = Object.keys(handlers).reduce((n, name) => n + concurrency[name as QueueName]!, 0);
sizeDbPool(slots + 2);

const workers = (Object.entries(handlers) as [QueueName, (job: Job) => Promise<unknown>][]).map(([name, run]) => {
  const worker = new Worker(name, run, workerOptions(name, concurrency[name]!));
  worker.on("failed", (job, err) => {
    logger.error({ queue: name, jobId: job?.id, err }, "job failed");
    captureJobFailure(name, job, err);
  });
  return worker;
});

for (const s of SCHEDULES) await queue(s.queue).upsertJobScheduler(s.id, s.repeat, { name: s.id, data: { schedule: true } });
logger.info({ concurrency, dbPool: slots + 2 }, "worker started");

/** Postgres, the Redis connection of a consumer (ioredis "ready") and every consumer still running. */
const checks = {
  database: async () => void (await db().execute(sql`select 1`)),
  redis: async () => {
    if ((await workers[0]!.backend.client).status !== "ready") throw new Error("redis not ready");
  },
  consumers: async () => {
    if (!workers.every((w) => w.isRunning())) throw new Error("a consumer stopped");
  },
};
const health = serveHealth(env().PORT, checks);
startHeartbeat(env().HEARTBEAT_URL, checks);

// 30 s for jobs in flight (architecture D9); a job still running then is retried by BullMQ as stalled.
onShutdown("worker", 30_000, () => Promise.all(workers.map((w) => w.close())), () => Promise.allSettled([closeServer(health), closeQueues().then(() => redis().quit()), closeDb()]));
