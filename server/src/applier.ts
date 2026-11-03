import { Worker } from "bullmq";
import { sql } from "drizzle-orm";
import { closeDb, db, sizeDbPool } from "./db/client";
import { applierEnv, setProcessRole } from "./lib/env";
import { closeServer, deadline, onShutdown, serveHealth, startHeartbeat } from "./lib/lifecycle";
import { logger } from "./lib/logger";
import { assertNoEviction, redis } from "./lib/redis";
import { captureJobFailure, initSentry } from "./lib/sentry";
import { applierPool, closeBrowser, warmBrowser, watchMemory } from "./jobs/browser-pool";
import { processCloudApply } from "./jobs/cloud-apply";
import { QUEUES, workerOptions } from "./jobs/queues";

// The applier opens hostile employer pages, so it runs on its own schema (envFor("applier")): no auth, Stripe,
// model, mail or webhook secret, and env() throws here. Production refuses to boot when one of them is set.
setProcessRole("applier");
const e = applierEnv();
// Its own Sentry project and DSN (a compromised applier holds it); types, our frames and signals only (lib/sentry.ts).
initSentry("applier");
if (!e.APPLIER_CHROMIUM_SANDBOX) logger.warn("Chromium sandbox is off (APPLIER_CHROMIUM_SANDBOX=0): only with the signed S-AP4 risk acceptance");

// A Redis that evicts loses approved sends silently: refuse to start (platform-68).
await deadline(assertNoEviction(), 10_000);
// One connection per run plus the health check (scale-v12).
sizeDbPool(e.APPLIER_CONCURRENCY + 1);

/** Cloud applier: submits approved cloud applications from headless Chromium. */
const worker = new Worker(QUEUES.cloudApply, processCloudApply, workerOptions(QUEUES.cloudApply, e.APPLIER_CONCURRENCY));
worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "cloud apply failed");
  captureJobFailure(QUEUES.cloudApply, job, err);
});
logger.info({ concurrency: e.APPLIER_CONCURRENCY, sandbox: e.APPLIER_CHROMIUM_SANDBOX }, "applier started");
void warmBrowser();
watchMemory(applierPool(), e.APPLIER_MEMORY_LIMIT_MB);

// Chromium is not checked: a dead browser is relaunched by the next job (jobs/browser-pool.ts). The DB check runs as kairos_applier.
const checks = {
  database: async () => void (await db().execute(sql`select 1`)),
  redis: async () => {
    if ((await worker.backend.client).status !== "ready") throw new Error("redis not ready");
  },
  consumer: async () => {
    if (!worker.isRunning()) throw new Error("the consumer stopped");
  },
};
const health = serveHealth(e.PORT, checks);
startHeartbeat(e.HEARTBEAT_URL, checks);

// 170 s: a submit that already reached the employer is allowed to finish and report (06-infrastructure 1.6).
onShutdown("applier", 170_000, () => worker.close(), () => Promise.allSettled([closeServer(health), closeBrowser(), closeDb(), redis().quit()]));
