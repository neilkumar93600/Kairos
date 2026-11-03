import { describe, expect, it, vi } from "vitest";
import { runErasure, type ErasureDeps, type ErasureTask } from "../src/jobs/erasure";
import { emailHash, erasureUserHash } from "../src/services/erasure";

// The erasure worker's per-task steps (WP-25) with every store faked: order, resume after a crash, and refusals.

const HASH = erasureUserHash("u1");
const task = (over: Partial<ErasureTask> = {}): ErasureTask => ({
  userHash: HASH, emailHash: emailHash("a@example.com"), requestedAt: new Date("2026-11-03T10:00:00Z"), storageId: "u1", stripeCustomerId: "cus_1",
  tombstoneWrittenAt: null, stripeDoneAt: null, verifiedAt: null, r2DoneAt: null, llmScrubbedAt: null, ...over,
});

function deps(over: Partial<ErasureDeps> = {}) {
  const log: string[] = [];
  const d: ErasureDeps = {
    production: true,
    mark: vi.fn(async (_hash, set) => void log.push(`mark ${Object.keys(set).sort().join(",")}`)),
    remaining: vi.fn(async () => []),
    scrubLlm: vi.fn(async () => (log.push("llm"), 3)),
    tombstones: { put: vi.fn(async (key: string) => void log.push(`put ${key}`)) },
    files: { deleteUserObjects: vi.fn(async (id: string) => (log.push(`r2 ${id}`), 2)) },
    deleteCustomer: vi.fn(async (id: string, key: string) => void log.push(`stripe ${id} ${key}`)),
    ...over,
  };
  return { d, log };
}

describe("runErasure", () => {
  it("does every store in order, stamping each, and completes", async () => {
    const { d, log } = deps();
    await runErasure(task(), d);
    expect(log).toEqual([
      `put tombstones/users/${HASH}.json`,
      "mark tombstoneWrittenAt",
      `stripe cus_1 erase:${HASH}`,
      "mark stripeCustomerId,stripeDoneAt",
      "mark verifiedAt",
      "r2 u1",
      "mark r2DoneAt,storageId",
      "llm",
      "mark llmScrubbedAt",
      "mark completedAt,lastErrorCode",
    ]);
    expect(d.remaining).toHaveBeenCalledWith("u1");
  });

  it("resumes after a crash: steps already stamped are not repeated", async () => {
    const { d, log } = deps();
    const done = new Date();
    await runErasure(task({ tombstoneWrittenAt: done, stripeDoneAt: done, stripeCustomerId: null, verifiedAt: done }), d);
    expect(log).toEqual(["r2 u1", "mark r2DoneAt,storageId", "llm", "mark llmScrubbedAt", "mark completedAt,lastErrorCode"]);
    expect(d.deleteCustomer).not.toHaveBeenCalled();
  });

  it("refuses to verify while rows remain, and stops before the files and the id go", async () => {
    const { d, log } = deps({ remaining: vi.fn(async () => ["applications"]) });
    await expect(runErasure(task(), d)).rejects.toMatchObject({ code: "rows_remain" });
    expect(log.some((l) => l.startsWith("r2") || l.includes("completedAt"))).toBe(false);
  });

  it("in production, a store it cannot reach fails the step instead of skipping it", async () => {
    await expect(runErasure(task(), deps({ tombstones: null }).d)).rejects.toMatchObject({ code: "tombstones_unconfigured" });
    await expect(runErasure(task({ tombstoneWrittenAt: new Date() }), deps({ deleteCustomer: null }).d)).rejects.toMatchObject({ code: "stripe_unconfigured" });
    const done = new Date();
    const before = { tombstoneWrittenAt: done, stripeDoneAt: done, stripeCustomerId: null, verifiedAt: done };
    await expect(runErasure(task(before), deps({ files: null }).d)).rejects.toMatchObject({ code: "storage_unconfigured" });
  });

  it("outside production an unconfigured store counts as done; no customer means nothing to delete at Stripe", async () => {
    const { d, log } = deps({ production: false, tombstones: null, files: null, deleteCustomer: null });
    await runErasure(task(), d);
    expect(log.filter((l) => !l.startsWith("mark"))).toEqual(["llm"]);
    const live = deps();
    await runErasure(task({ stripeCustomerId: null }), live.d);
    expect(live.d.deleteCustomer).not.toHaveBeenCalled();
  });
});
