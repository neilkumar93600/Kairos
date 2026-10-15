import { Worker, type Job } from "bullmq";
import { closeDb } from "./db/client";
import { logger } from "./lib/logger";
import { processClassifyEmail } from "./jobs/classify-email";
import { processParseResume } from "./jobs/parse-resume";
import { processPollBoards } from "./jobs/poll-boards";
import { closeQueues, queue, QUEUES, redisConnection } from "./jobs/queues";
import { processScoreMatches } from "./jobs/score-matches";
import { processTailorApplication } from "./jobs/tailor-application";

/** Background worker: polling, scoring, tailoring, resume parsing and reply tagging. */
const handlers: Record<string, { run: (job: Job) => Promise<unknown>; concurrency: number }> = {
  [QUEUES.pollBoards]: { run: processPollBoards, concurrency: 8 },
  [QUEUES.scoreMatches]: { run: processScoreMatches, concurrency: 4 },
  [QUEUES.tailorApplication]: { run: processTailorApplication, concurrency: 4 },
  [QUEUES.parseResume]: { run: processParseResume, concurrency: 2 },
  [QUEUES.classifyEmail]: { run: processClassifyEmail, concurrency: 4 },
};

const workers = Object.entries(handlers).map(([name, h]) => {
  const worker = new Worker(name, h.run, { connection: redisConnection(), concurrency: h.concurrency });
  worker.on("failed", (job, err) => logger.error({ queue: name, jobId: job?.id, err }, "job failed"));
  return worker;
});

// One scheduler job a minute decides which boards are due.
await queue("poll-boards").upsertJobScheduler("schedule-board-polls", { every: 60_000 }, { name: "poll-boards", data: { schedule: true } });
logger.info({ queues: Object.keys(handlers) }, "worker started");

async function shutdown(signal: string) {
  logger.info({ signal }, "worker shutting down");
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled([closeQueues(), closeDb()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
