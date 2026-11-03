import { describe, expect, it } from "vitest";
import { fairPriority, QUEUE_CONFIG, QUEUES, workerConcurrency, workerOptions } from "../src/jobs/queues";
import { parseEnv } from "../src/lib/env";
import { assertNoEviction } from "../src/lib/redis";

/** WP-45: the per-queue table (platform-06 in BullMQ form, scale-06) and the Redis boot check (platform-68). */

describe("queue config table", () => {
  it("has one row per queue", () => {
    expect(Object.keys(QUEUE_CONFIG).sort()).toEqual(Object.values(QUEUES).sort());
  });

  it("holds a cloud apply's lock longer than the run itself can take (45 s goto, 15 s load, 120 s fill)", () => {
    expect(QUEUE_CONFIG["cloud-apply"].lockDurationMs).toBeGreaterThan(45_000 + 15_000 + 120_000);
  });

  it("puts the table's concurrency, lock, limiter and job options on the worker and the queue", () => {
    const opts = workerOptions("score-user", 6);
    expect(opts).toMatchObject({ concurrency: 6, lockDuration: QUEUE_CONFIG["score-user"].lockDurationMs, limiter: { max: 1200, duration: 60_000 } });
    expect(workerOptions("poll-boards", 3).limiter).toBeUndefined();
  });
});

describe("worker concurrency", () => {
  it("is the table's value unless QUEUE_CONCURRENCY names the queue", () => {
    const c = workerConcurrency({ "score-user": 8 });
    expect(c["score-user"]).toBe(8);
    expect(c["poll-boards"]).toBe(QUEUE_CONFIG["poll-boards"].concurrency);
    expect(c["cloud-apply"]).toBeUndefined(); // the applier's own APPLIER_CONCURRENCY
  });

  it("refuses an override for a queue the worker does not run, so a typo never silently does nothing", () => {
    expect(() => workerConcurrency({ "score-users": 8 })).toThrow(/score-users/);
    expect(() => workerConcurrency({ "cloud-apply": 4 })).toThrow(/cloud-apply/);
  });

  it("QUEUE_CONCURRENCY parses name=n pairs and refuses anything else", () => {
    const base = {
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      REDIS_URL: "redis://localhost:6379",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      WEB_ORIGIN: "http://localhost:3000",
      INBOUND_WEBHOOK_SECRET: "y".repeat(16),
    };
    expect(parseEnv(base).QUEUE_CONCURRENCY).toEqual({});
    expect(parseEnv({ ...base, QUEUE_CONCURRENCY: "score-user=8, poll-boards=2" }).QUEUE_CONCURRENCY).toEqual({ "score-user": 8, "poll-boards": 2 });
    expect(() => parseEnv({ ...base, QUEUE_CONCURRENCY: "score-user=0" })).toThrow(/QUEUE_CONCURRENCY/);
    expect(() => parseEnv({ ...base, QUEUE_CONCURRENCY: "score-user" })).toThrow(/QUEUE_CONCURRENCY/);
  });
});

describe("fair priority (prepare jobs)", () => {
  it("is the user's count of jobs still waiting, so their k-th waits behind everyone's first, within BullMQ's range", () => {
    expect(fairPriority(1)).toBe(1);
    expect(fairPriority(50)).toBe(50);
    expect(fairPriority(0)).toBe(1);
    expect(fairPriority(5_000_000)).toBe(2_097_152);
  });
});

describe("Redis eviction check", () => {
  const server = (policy?: string) => ({ info: async () => `# Memory\r\nused_memory:1024\r\n${policy ? `maxmemory_policy:${policy}\r\n` : ""}` });

  it("passes noeviction", async () => {
    await expect(assertNoEviction(server("noeviction"))).resolves.toBeUndefined();
  });

  it.each(["allkeys-lru", "volatile-lru", "allkeys-random", "volatile-ttl"])("refuses to boot on %s: BullMQ would lose jobs", async (policy) => {
    await expect(assertNoEviction(server(policy))).rejects.toThrow(new RegExp(`maxmemory-policy is ${policy}`));
  });

  it("refuses when the policy cannot be read", async () => {
    await expect(assertNoEviction(server())).rejects.toThrow(/maxmemory-policy is unknown/);
  });
});
