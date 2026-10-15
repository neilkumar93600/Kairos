import { Worker } from "bullmq";
import { closeDb } from "./db/client";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { closeBrowser, processCloudApply } from "./jobs/cloud-apply";
import { QUEUES, redisConnection } from "./jobs/queues";

/** Cloud applier: submits approved applications from headless Chromium for Pro and Max users. */
const worker = new Worker(QUEUES.cloudApply, processCloudApply, {
  connection: redisConnection(),
  concurrency: env().APPLIER_CONCURRENCY,
  // Employers' forms are slow; give each job time before BullMQ treats it as stalled.
  lockDuration: 120_000,
});
worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "cloud apply failed"));
logger.info({ concurrency: env().APPLIER_CONCURRENCY }, "applier started");

async function shutdown(signal: string) {
  logger.info({ signal }, "applier shutting down");
  await worker.close();
  await Promise.allSettled([closeBrowser(), closeDb()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
