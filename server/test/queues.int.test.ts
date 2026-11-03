import { randomUUID } from "node:crypto";
import { Worker } from "bullmq";
import { afterAll, describe, expect, it } from "vitest";
import { hasTestDb } from "./helpers/test-db";

/**
 * WP-45 against a real Redis and BullMQ: the noeviction check, the scoring lane's queue semantics (the in-memory lane
 * of test/helpers/lanes.ts assumes them) and the apply gate's store. ci.yml runs Redis 7 next to the test Postgres;
 * locally neither is there, so this file skips with the other integration tests.
 */
const hasRedis = hasTestDb;

const { closeQueues, queue, redisLane } = await import("../src/jobs/queues");
const { CHUNK, runChunk } = await import("../src/jobs/score-matches");
const { redisGateStore } = await import("../src/jobs/apply-gate");
const { assertNoEviction, redis } = await import("../src/lib/redis");

async function until(done: () => boolean | Promise<boolean>, ms = 30_000) {
  for (const end = Date.now() + ms; !(await done()); ) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe.skipIf(!hasRedis)("queues against Redis", () => {
  afterAll(async () => {
    await closeQueues();
    await redis().quit();
  });

  it("the CI Redis runs with noeviction, so the boot check passes", async () => {
    await expect(assertNoEviction()).resolves.toBeUndefined();
  });

  it("a user with 500 pending pairs delays another user's pair by one chunk (BullMQ keepLastIfActive)", async () => {
    await queue("score-user").obliterate({ force: true });
    const lane = redisLane("score-user");
    const heavy = `heavy-${randomUUID()}`;
    const light = `light-${randomUUID()}`;
    await lane.add(heavy, Array.from({ length: 500 }, (_, i) => `h${i}`));
    await lane.add(light, ["l0"]);
    // Adding again while the user's job waits adds no second job.
    await lane.add(heavy, ["h0"]);
    expect(await queue("score-user").getWaitingCount()).toBe(2);

    const scored: string[] = [];
    const worker = new Worker<{ userId: string }>("score-user", (job) => runChunk(lane, job.data.userId, async (m) => void scored.push(...m)), {
      connection: redis(),
      concurrency: 1,
    });
    try {
      await until(() => scored.length === 501);
      expect(scored.indexOf("l0")).toBe(CHUNK);
      expect(new Set(scored).size).toBe(501);
      // The last chunk is marked done just after it is scored.
      await until(async () => (await lane.peek(heavy, 1)).length === 0);
    } finally {
      await worker.close();
    }
  });

  it("the apply gate's store: 8 slots per ATS, a redelivered run keeps its own, leases expire, cool-downs count down", async () => {
    const store = redisGateStore(redis());
    const ats = `ats-${randomUUID()}`;
    for (let i = 0; i < 8; i++) expect(await store.take(ats, `r${i}`, 8, 60_000)).toBe(true);
    expect(await store.take(ats, "r8", 8, 60_000)).toBe(false);
    expect(await store.take(ats, "r0", 8, 60_000)).toBe(true);
    await store.give(ats, "r1");
    expect(await store.take(ats, "r8", 8, 60_000)).toBe(true);

    const short = `ats-${randomUUID()}`;
    expect(await store.take(short, "a", 1, 50)).toBe(true);
    expect(await store.take(short, "b", 1, 50)).toBe(false);
    await new Promise((r) => setTimeout(r, 100));
    expect(await store.take(short, "b", 1, 50)).toBe(true);

    expect(await store.coolingMs(ats)).toBe(0);
    await store.coolDown(ats, 5_000);
    expect(await store.coolingMs(ats)).toBeGreaterThan(4_000);

    expect(await store.start(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(await store.start(0)).toBe(false);
  });
});
