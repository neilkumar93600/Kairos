import { DelayedError } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { admitOrPark, applyGate, APPLY_LIMITS, type GateStore } from "../src/jobs/apply-gate";
import { atsOfApplyUrl } from "../src/jobs/cloud-apply";

/**
 * WP-45 (scale-06, scale-35): cloud applies are admitted per ATS, 8 at a time each and 240 starts a minute in all; a
 * 429 cools that ATS down. The Redis store behind it runs in queues.int.test.ts (CI); this in-memory one has its rules.
 */
function memoryStore(now = () => Date.now()): GateStore {
  const cool = new Map<string, number>();
  const slots = new Map<string, Map<string, number>>();
  const starts = new Map<number, number>();
  return {
    coolingMs: async (ats) => Math.max(0, (cool.get(ats) ?? 0) - now()),
    coolDown: async (ats, ms) => void cool.set(ats, now() + ms),
    async take(ats, runId, limit, leaseMs) {
      const held = slots.get(ats) ?? new Map<string, number>();
      slots.set(ats, held);
      for (const [id, until] of held) if (until <= now()) held.delete(id);
      if (!held.has(runId) && held.size >= limit) return false;
      held.set(runId, now() + leaseMs);
      return true;
    },
    give: async (ats, runId) => void slots.get(ats)?.delete(runId),
    async start(perMinute) {
      const minute = Math.floor(now() / 60_000);
      starts.set(minute, (starts.get(minute) ?? 0) + 1);
      return starts.get(minute)! <= perMinute;
    },
  };
}

const job = (id: string) => ({ id, moveToDelayed: vi.fn(async (_at: number, _token?: string) => {}) });

describe("apply gate", () => {
  it("maps each apply host to its ATS, so both Greenhouse hosts share one limit", () => {
    expect(atsOfApplyUrl("https://job-boards.greenhouse.io/acme/jobs/1")).toBe("greenhouse");
    expect(atsOfApplyUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe("greenhouse");
    expect(atsOfApplyUrl("https://jobs.eu.lever.co/acme/x/apply")).toBe("lever");
    expect(atsOfApplyUrl("https://jobs.ashbyhq.com/acme/x/application")).toBe("ashby");
    expect(atsOfApplyUrl("https://evil.example/")).toBeUndefined();
    expect(atsOfApplyUrl("not a url")).toBeUndefined();
  });

  it("a Greenhouse 429 storm parks Greenhouse runs and does not stall Lever runs", async () => {
    const gate = applyGate(memoryStore());
    const first = await admitOrPark(gate, "greenhouse", job("apply-gh-0"), "token");
    // That run met a 429 (it fails as a challenge, no charge); the ATS now cools down for every replica.
    await gate.coolDown("greenhouse");
    await first();

    for (let i = 1; i <= 50; i++) {
      const j = job(`apply-gh-${i}`);
      await expect(admitOrPark(gate, "greenhouse", j, "token")).rejects.toBeInstanceOf(DelayedError);
      const [until, token] = j.moveToDelayed.mock.calls[0]!;
      expect(until - Date.now()).toBeGreaterThan(APPLY_LIMITS.coolDownMs - 1_000);
      expect(token).toBe("token");
    }
    for (let i = 0; i < 8; i++) await expect(admitOrPark(gate, "lever", job(`apply-lever-${i}`), "token")).resolves.toBeTypeOf("function");
  });

  it("holds each ATS to 8 runs at once across replicas; a ninth waits, other ATS run, leaving frees a slot", async () => {
    const gate = applyGate(memoryStore());
    const leaves = [];
    for (let i = 0; i < 8; i++) leaves.push(await admitOrPark(gate, "greenhouse", job(`gh-${i}`), undefined));
    const ninth = job("gh-8");
    await expect(admitOrPark(gate, "greenhouse", ninth, undefined)).rejects.toBeInstanceOf(DelayedError);
    expect(ninth.moveToDelayed).toHaveBeenCalledOnce();
    await expect(gate.enter("ashby", "ashby-0")).resolves.toMatchObject({ admitted: true });
    await leaves[0]!();
    await expect(gate.enter("greenhouse", "gh-8")).resolves.toMatchObject({ admitted: true });
  });

  it("starts at most 240 runs a minute in all, and a refused start gives its ATS slot back", async () => {
    let now = Date.parse("2026-11-03T10:00:00Z");
    const gate = applyGate(memoryStore(() => now), { ...APPLY_LIMITS, perAts: 1_000 });
    for (let i = 0; i < 240; i++) {
      const a = await gate.enter(["greenhouse", "lever", "ashby"][i % 3]!, `run-${i}`);
      expect(a.admitted).toBe(true);
      if (a.admitted) await a.leave();
    }
    expect(await gate.enter("lever", "run-240")).toMatchObject({ admitted: false, reason: "rate" });
    now += 60_000;
    expect(await gate.enter("lever", "run-240")).toMatchObject({ admitted: true });
  });

  it("a redelivered run keeps its own slot instead of taking a second one", async () => {
    const gate = applyGate(memoryStore(), { ...APPLY_LIMITS, perAts: 1 });
    expect(await gate.enter("lever", "apply-1")).toMatchObject({ admitted: true });
    expect(await gate.enter("lever", "apply-1")).toMatchObject({ admitted: true });
    expect(await gate.enter("lever", "apply-2")).toMatchObject({ admitted: false, reason: "ats_busy" });
  });
});
