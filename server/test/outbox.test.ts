import { describe, expect, it, vi } from "vitest";
import { verdict, type ChaosFacts } from "../../ops/chaos/verdict";
import { addSpendsAttempt, afterJobState, assertIdsOnly, emitOutbox, MAX_ATTEMPTS } from "../src/durable/outbox";
import { completedRetention, OUTBOX_QUEUES, QUEUE_CONFIG, type QueueName } from "../src/jobs/queues";

const APP = "3f0e8a52-6a41-4d6e-9f7a-0a1b2c3d4e5f";

describe("the outbox's payload guard", () => {
  it("takes ids, codes and numbers", () => {
    expect(() => assertIdsOnly({ applicationId: APP, kind: "resend_available", attemptNo: 2, late: false, note: undefined })).not.toThrow();
  });

  it.each([
    ["an address", { email: "jane@example.com" }],
    ["a name with a space", { name: "Jane Doe" }],
    ["an empty string", { x: "" }],
    ["a long text", { x: "a".repeat(129) }],
    ["a nested object", { x: { y: APP } }],
    ["an array", { x: [APP] }],
    ["a null", { x: null }],
  ])("refuses %s", (_, data) => {
    expect(() => assertIdsOnly(data)).toThrow(/is not an id/);
  });

  it("refuses a user id, which would put the table in erasure's scope", () => {
    expect(() => assertIdsOnly({ userId: "user-1" })).toThrow(/userId/);
  });

  it("emitOutbox throws before it touches the transaction, which rolls the caller back", async () => {
    const tx = { insert: vi.fn() };
    await expect(emitOutbox(tx as never, "cloud-apply", { applicationId: "Jane Doe" }, "apply-x")).rejects.toThrow(/is not an id/);
    await expect(emitOutbox(tx as never, "cloud-apply", { applicationId: APP }, "settle:has-a-colon")).rejects.toThrow(/key/);
    expect(tx.insert).not.toHaveBeenCalled();
  });
});

describe("the sweep's decision", () => {
  it("a completed job finishes the row; a live one is left alone at any attempt count", () => {
    expect(afterJobState("completed", 0)).toBe("done");
    expect(afterJobState("completed", MAX_ATTEMPTS)).toBe("done");
    for (const state of ["waiting", "active", "delayed", "prioritized", "waiting-children"]) expect(afterJobState(state, MAX_ATTEMPTS - 1)).toBe("wait");
  });

  it("a failed or vanished job is delivered again until the last attempt, then dies", () => {
    for (const state of ["failed", "unknown"]) {
      expect(afterJobState(state, 0)).toBe("retry");
      expect(afterJobState(state, MAX_ATTEMPTS - 2)).toBe("retry");
      expect(afterJobState(state, MAX_ATTEMPTS - 1)).toBe("dead");
    }
  });
});

describe("a failed add", () => {
  it.each<[string, unknown]>([
    ["the drain's deadline", new Error("timeout")],
    ["a socket error", Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })],
    ["a closed connection", new Error("Connection is closed.")],
    ["a full Redis", Object.assign(new Error("OOM command not allowed"), { name: "ReplyError" })],
    ["a Redis reloading", Object.assign(new Error("LOADING"), { name: "ReplyError" })],
  ])("spends no attempt on %s", (_, err) => {
    expect(addSpendsAttempt(err)).toBe(false);
  });

  it.each<[string, unknown]>([
    ["BullMQ refusing the id", new Error("Custom Id cannot contain :")],
    ["a broken row", new TypeError("cannot read properties of undefined")],
  ])("spends one on %s", (_, err) => {
    expect(addSpendsAttempt(err)).toBe(true);
  });
});

describe("the completed job the sweep reads", () => {
  it("an outbox-fed queue removes completed jobs by age alone, and that age outlives many sweeps", () => {
    expect(OUTBOX_QUEUES.length).toBeGreaterThan(0);
    for (const name of OUTBOX_QUEUES) {
      const kept = completedRetention(name);
      expect(kept.count, `${name}: a count evicts finished work the sweep has not read`).toBeUndefined();
      expect(kept.age).toBeGreaterThanOrEqual(3600);
    }
  });

  it("every other queue keeps its count and its 24 hours", () => {
    for (const name of Object.keys(QUEUE_CONFIG) as QueueName[]) {
      if (!(OUTBOX_QUEUES as readonly string[]).includes(name)) expect(completedRetention(name)).toEqual({ age: 24 * 3600, count: 5000 });
    }
  });
});

describe("the chaos verdict", () => {
  const facts = (over: Partial<ChaosFacts> = {}): ChaosFacts => ({
    approvals: 2,
    limitMs: 600_000,
    apps: [
      { id: "a", status: "submitted", settleMs: 1000 },
      { id: "b", status: "failed", settleMs: 590_000 },
    ],
    clicks: ["a", "b"],
    charges: ["a"],
    outbox: { done: 2, live: 0, dead: 0 },
    reported: [],
    crashesByPhase: { filling: 50 },
    minCrashes: 50,
    kills: 40,
    pgRestarts: 1,
    ...over,
  });

  it("passes a clean run", () => {
    expect(verdict(facts())).toEqual({ pass: true, failures: [] });
  });

  it.each<[string, Partial<ChaosFacts>, RegExp]>([
    ["a second click", { clicks: ["a", "a", "b"] }, /duplicate attempt.*a/],
    ["a second charge", { charges: ["a", "a"] }, /double charge.*a/],
    ["a charge with no submission", { charges: ["b", "a"] }, /charge on an application not submitted.*b/],
    ["a submission with no charge", { charges: [] }, /submitted without a charge.*a/],
    ["a late settle", { apps: [{ id: "a", status: "submitted", settleMs: 1000 }, { id: "b", status: "failed", settleMs: 600_001 }] }, /over the limit.*b/],
    ["a stuck application", { apps: [{ id: "a", status: "submitted", settleMs: 1000 }, { id: "b", status: "submitting", settleMs: null }] }, /not terminal.*b/],
    ["too few applications", { approvals: 3 }, /3 approvals, 2 applications/],
    ["a dead row", { outbox: { done: 1, live: 0, dead: 1 } }, /dead/],
    ["a row still moving", { outbox: { done: 1, live: 1, dead: 0 } }, /still live/],
    ["no kills", { kills: 0 }, /no process was killed/],
    ["too few crashes in flight", { crashesByPhase: { navigating: 49 } }, /49 crashes with an attempt open/],
    ["a charge nobody reported", { charges: ["a"], reported: [] }, /charge for an attempt nobody reported/],
    ["no Postgres restart", { pgRestarts: 0 }, /Postgres was not restarted/],
  ])("fails on %s", (_, over, why) => {
    const v = verdict(facts(over));
    expect(v.pass).toBe(false);
    expect(v.failures.join("\n")).toMatch(why);
  });
});
