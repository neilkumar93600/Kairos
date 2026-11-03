import { Worker, type Job } from "bullmq";
import { sql } from "drizzle-orm";
import { closeDb, db } from "./db/client";
import { baseEnv, setProcessRole } from "./lib/env";
import { closeServer, onShutdown, serveHealth, startHeartbeat } from "./lib/lifecycle";
import { logger } from "./lib/logger";
import { captureJobFailure, initSentry } from "./lib/sentry";
import { processClassifyEmail } from "./jobs/classify-email";
import { processCostRollup } from "./jobs/cost-rollup";
import { processLedgerWatch } from "./jobs/ledger-watch";
import { processParseResume } from "./jobs/parse-resume";
import { processPollBoards } from "./jobs/poll-boards";
import { closeQueues, queue, QUEUES, redisConnection } from "./jobs/queues";
import { processScoreMatches } from "./jobs/score-matches";
import { processTailorApplication } from "./jobs/tailor-application";

setProcessRole("worker");
initSentry("worker");

/** Background worker: polling, scoring, tailoring, resume parsing and reply tagging. */
const handlers: Record<string, { run: (job: Job) => Promise<unknown>; concurrency: number }> = {
  [QUEUES.pollBoards]: { run: processPollBoards, concurrency: 8 },
  [QUEUES.scoreMatches]: { run: processScoreMatches, concurrency: 4 },
  [QUEUES.tailorApplication]: { run: processTailorApplication, concurrency: 4 },
  [QUEUES.parseResume]: { run: processParseResume, concurrency: 2 },
  [QUEUES.classifyEmail]: { run: processClassifyEmail, concurrency: 4 },
  [QUEUES.costRollup]: { run: processCostRollup, concurrency: 1 },
  [QUEUES.ledgerWatch]: { run: processLedgerWatch, concurrency: 1 },
};

const workers = Object.entries(handlers).map(([name, h]) => {
  const worker = new Worker(name, h.run, { connection: redisConnection(), concurrency: h.concurrency });
  worker.on("failed", (job, err) => {
    logger.error({ queue: name, jobId: job?.id, err }, "job failed");
    captureJobFailure(name, job, err);
  });
  return worker;
});

// One scheduler job a minute decides which boards are due.
await queue("poll-boards").upsertJobScheduler("schedule-board-polls", { every: 60_000 }, { name: "poll-boards", data: { schedule: true } });
// The spend roll-up the per-agent and global budget scopes read (03-agent-runtime 8.4).
await queue("cost-rollup").upsertJobScheduler("cost-rollup", { every: 60_000 }, { name: "cost-rollup", data: { schedule: true } });
// admin_adjustment ledger rows to Sentry (CISO mustFix 10); once per 15 minutes across replicas.
await queue("ledger-watch").upsertJobScheduler("ledger-watch", { every: 15 * 60_000 }, { name: "ledger-watch", data: { schedule: true } });
logger.info({ queues: Object.keys(handlers) }, "worker started");

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
const health = serveHealth(baseEnv().PORT, checks);
startHeartbeat(baseEnv().HEARTBEAT_URL, checks);

// 30 s for jobs in flight (architecture D9); a job still running then is retried by BullMQ as stalled.
onShutdown("worker", 30_000, () => Promise.all(workers.map((w) => w.close())), () => Promise.allSettled([closeServer(health), closeQueues(), closeDb()]));
