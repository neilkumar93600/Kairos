import { Worker } from "bullmq";
import { closeDb } from "./db/client";
import { applierEnv, setProcessRole } from "./lib/env";
import { logger } from "./lib/logger";
import { closeBrowser, processCloudApply } from "./jobs/cloud-apply";
import { QUEUES, redisConnection } from "./jobs/queues";

// The applier opens hostile employer pages, so it runs on its own schema (envFor("applier")): no auth, Stripe,
// model, mail or webhook secret, and env() throws here. Production refuses to boot when one of them is set.
setProcessRole("applier");
const e = applierEnv();
if (!e.APPLIER_CHROMIUM_SANDBOX) logger.warn("Chromium sandbox is off (APPLIER_CHROMIUM_SANDBOX=0): only with the signed S-AP4 risk acceptance");

/** Cloud applier: submits approved cloud applications from headless Chromium. */
const worker = new Worker(QUEUES.cloudApply, processCloudApply, {
  connection: redisConnection(),
  concurrency: e.APPLIER_CONCURRENCY,
  // Employers' forms are slow; give each job time before BullMQ treats it as stalled.
  lockDuration: 120_000,
});
worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "cloud apply failed"));
logger.info({ concurrency: e.APPLIER_CONCURRENCY, sandbox: e.APPLIER_CHROMIUM_SANDBOX }, "applier started");

async function shutdown(signal: string) {
  logger.info({ signal }, "applier shutting down");
  await worker.close();
  await Promise.allSettled([closeBrowser(), closeDb()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
