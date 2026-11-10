import { DelayedError, type Job } from "bullmq";
import type { Redis } from "ioredis";
import { logger } from "../lib/logger";

/**
 * Admission for cloud applies across every applier replica (scale-06, scale-35; 07-cloud-applier 4): at most 8 runs at
 * once per ATS, 240 starts a minute in all, and an ATS that answered 429 cools down while the others keep running.
 * BullMQ has no per-group limits outside BullMQ Pro, so a run that is not admitted is parked: its job goes back as
 * delayed (no attempt used) and the worker slot is free for another ATS's run.
 */

export interface GateStore {
  /** Milliseconds left on the ATS's cool-down; 0 when none. */
  coolingMs(ats: string): Promise<number>;
  coolDown(ats: string, ms: number): Promise<void>;
  /** Takes one of the ATS's `limit` slots for `runId`, leased for `leaseMs`; false when all are held. */
  take(ats: string, runId: string, limit: number, leaseMs: number): Promise<boolean>;
  give(ats: string, runId: string): Promise<void>;
  /** Counts a start in the current minute; false once `perMinute` were counted. */
  start(perMinute: number): Promise<boolean>;
}

export const APPLY_LIMITS = {
  perAts: 8,
  perMinute: 240,
  /** ponytail: fixed; reading the 429's Retry-After would fit the ATS better. */
  coolDownMs: 60_000,
  /** Longer than the worst run (about 305 s with the render wait, jobs/queues.ts); a crashed replica's slots free themselves after it. */
  leaseMs: 6 * 60_000,
  /** How long a run waits for a busy ATS before it is tried again. */
  busyRetryMs: 15_000,
};

export type Admission = { admitted: true; leave: () => Promise<void> } | { admitted: false; reason: "cooling" | "ats_busy" | "rate"; retryInMs: number };

export function applyGate(store: GateStore, limits = APPLY_LIMITS) {
  return {
    async enter(ats: string, runId: string): Promise<Admission> {
      const cooling = await store.coolingMs(ats);
      if (cooling > 0) return { admitted: false, reason: "cooling", retryInMs: cooling };
      if (!(await store.take(ats, runId, limits.perAts, limits.leaseMs))) return { admitted: false, reason: "ats_busy", retryInMs: limits.busyRetryMs };
      if (!(await store.start(limits.perMinute))) {
        await store.give(ats, runId);
        return { admitted: false, reason: "rate", retryInMs: 60_000 - (Date.now() % 60_000) };
      }
      return { admitted: true, leave: () => store.give(ats, runId) };
    },
    /** After a 429 from the ATS's apply page: its runs wait out the cool-down instead of meeting the same 429. */
    coolDown: (ats: string) => store.coolDown(ats, limits.coolDownMs),
  };
}

export type ApplyGate = ReturnType<typeof applyGate>;

/** Admits the run, or parks its job (up to 5 s of jitter, so parked runs do not return together) and throws DelayedError. */
export async function admitOrPark(gate: ApplyGate, ats: string, job: Pick<Job, "id" | "moveToDelayed">, token: string | undefined): Promise<() => Promise<void>> {
  const admission = await gate.enter(ats, job.id!);
  if (admission.admitted) return admission.leave;
  logger.info({ jobId: job.id, ats, reason: admission.reason }, "cloud apply parked");
  await job.moveToDelayed(Date.now() + admission.retryInMs + Math.floor(Math.random() * 5_000), token);
  throw new DelayedError();
}

/**
 * The store in Redis. A slot is a sorted-set member scored by its lease end. Taking one adds first and counts after:
 * every taker counts everyone who added before it, so two replicas racing for the last slot may both back off (one
 * comes back 15 s later), but never both get it. The member is the BullMQ job id, so a redelivered run keeps its slot.
 */
export function redisGateStore(client: Redis): GateStore {
  const key = (part: string) => `kairos:apply-gate:${part}`;
  return {
    coolingMs: async (ats) => Math.max(0, await client.pttl(key(`cool:${ats}`))),
    coolDown: async (ats, ms) => void (await client.set(key(`cool:${ats}`), "1", "PX", ms)),
    async take(ats, runId, limit, leaseMs) {
      const slots = key(`slots:${ats}`);
      const now = Date.now();
      await client.zremrangebyscore(slots, "-inf", now);
      await client.zadd(slots, now + leaseMs, runId);
      await client.pexpire(slots, leaseMs);
      if ((await client.zcard(slots)) <= limit) return true;
      await client.zrem(slots, runId);
      return false;
    },
    give: async (ats, runId) => void (await client.zrem(key(`slots:${ats}`), runId)),
    async start(perMinute) {
      const minute = key(`starts:${Math.floor(Date.now() / 60_000)}`);
      const n = await client.incr(minute);
      await client.pexpire(minute, 120_000);
      return n <= perMinute;
    },
  };
}
