import { appendFileSync } from "node:fs";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { chromium } from "playwright-core";
import { db, sizeDbPool } from "../../server/src/db/client";
import { applications } from "../../server/src/db/schema";
import { startOutboxDrain, sweepOutbox } from "../../server/src/durable/outbox";
import { processCloudApply } from "../../server/src/jobs/cloud-apply";
import { QUEUES, workerOptions } from "../../server/src/jobs/queues";
import { processReconcileApply, processSweepSubmitting } from "../../server/src/jobs/reconcile";
import { approveApplications } from "../../server/src/services/submissions";

/**
 * One process of the chaos run (ops/chaos/run.ts starts, kills and restarts these). The production code under test is
 * real: approveApplications, the outbox drain and sweep, processCloudApply, the reconcilers and BullMQ. Only Chromium is
 * scripted, because the applier must never open a real employer's page from a test.
 *   approver  approves every draft, one at a time, as a user would (a kill mid-approval leaves it draft or approved).
 *   worker    the outbox drain and sweep, and the two reconcilers on their production periods (the lease sweep settles).
 *   applier   the cloud-apply consumer.
 */
const role = process.argv[2];
const CLICK_LOG = process.env.CHAOS_CLICK_LOG!;
const FINISHED_LOG = process.env.CHAOS_FINISHED_LOG!;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/**
 * Chromium's stand-in, with time in every phase so a kill can land in any of them: launch and new context (claimed), goto
 * (navigating), the fill (filling). The click is written before the pause that follows it, so a kill there is a click with no
 * report; `finished` is written just before the run returns `submitted`, independently of anything the database says.
 */
function scriptBrowser(): void {
  const fill = async (payload: { applicationId: string }) => {
    await pause(between(1000, 3000));
    // About 1 in 16 stops before the click: nothing reaches the employer and no credit is used.
    if (payload.applicationId.endsWith("0")) return { outcome: "failed", failureReason: "Unsupported application page", filledFields: [] };
    appendFileSync(CLICK_LOG, `${payload.applicationId}\n`);
    await pause(between(500, 2000));
    appendFileSync(FINISHED_LOG, `${payload.applicationId}\n`);
    return { outcome: "submitted", filledFields: [{ fieldKey: "first_name", label: "First name", value: "Chaos" }] };
  };
  const page = {
    on: () => {},
    url: () => "https://job-boards.greenhouse.io/chaos/jobs/1",
    title: async () => "Apply",
    $: async () => null,
    goto: async () => {
      await pause(between(2000, 6000));
      return { status: () => 200 };
    },
    waitForLoadState: async () => {},
    frames: () => [],
    evaluate: async (fn: unknown, arg: { applicationId: string }) => (typeof fn === "string" ? undefined : fill(arg)),
  };
  const context = { route: async () => {}, on: () => {}, newPage: async () => page, close: async () => {} };
  (chromium as unknown as { launch: () => Promise<unknown> }).launch = async () => {
    await pause(between(500, 1500));
    return {
      newContext: async () => {
        await pause(between(100, 500));
        return context;
      },
      on: () => {},
      close: async () => {},
      version: () => "chaos",
    };
  };
}

/** Runs a reconciler forever on its period; a pass that fails (Postgres restarting) is logged by the harness's stderr and tried again. */
function every(ms: number, task: () => Promise<unknown>): void {
  void (async () => {
    for (;;) {
      await task().catch((err: unknown) => console.error(`${task.name} failed: ${(err as Error).name}`));
      await pause(ms);
    }
  })();
}

if (role === "approver") {
  for (;;) {
    const drafts = await db().select({ id: applications.id, userId: applications.userId }).from(applications).where(eq(applications.status, "draft")).limit(20);
    if (drafts.length === 0) process.exit(0);
    for (const d of drafts) {
      await approveApplications(db(), d.userId, [d.id], "cloud").catch((err: unknown) => console.error(`approve failed: ${(err as Error).name}`));
      await pause(between(10, 100));
    }
  }
} else if (role === "worker") {
  sizeDbPool(8);
  startOutboxDrain();
  every(60_000, sweepOutbox);
  every(30_000, processSweepSubmitting);
  every(60_000, processReconcileApply);
} else if (role === "applier") {
  scriptBrowser();
  sizeDbPool(9);
  // ponytail: no apply gate. It limits rate per ATS and has no part in durability; a killed process's slots would only slow the run.
  const worker = new Worker(QUEUES.cloudApply, (job, token) => processCloudApply(job, { token }), workerOptions(QUEUES.cloudApply, 8));
  worker.on("error", (err) => console.error(`worker error: ${err.name}`));
} else {
  throw new Error(`unknown role ${role}`);
}
