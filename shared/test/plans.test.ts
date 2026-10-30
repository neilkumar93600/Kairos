import { describe, expect, it } from "vitest";
import { PLANS, PLAN_IDS, creditsPerInvoice, getPlan, type PlanId } from "../src/plans";

/** The spec's cap table (01-architecture B.7.4, 04-matching 8.1): any change to these numbers is a product decision. */
const CAPS: Record<PlanId, { dailyScoringCap: number; dailyModelSpendCapUsd: number; matchCadenceMinutes: number; autopilotDailySendCap: number }> = {
  free: { dailyScoringCap: 20, dailyModelSpendCapUsd: 0.05, matchCadenceMinutes: 60, autopilotDailySendCap: 0 },
  starter: { dailyScoringCap: 120, dailyModelSpendCapUsd: 0.2, matchCadenceMinutes: 60, autopilotDailySendCap: 35 },
  pro: { dailyScoringCap: 140, dailyModelSpendCapUsd: 0.25, matchCadenceMinutes: 15, autopilotDailySendCap: 45 },
  max: { dailyScoringCap: 350, dailyModelSpendCapUsd: 0.5, matchCadenceMinutes: 5, autopilotDailySendCap: 110 },
};

describe("plans.ts cap table", () => {
  it.each(PLAN_IDS)("%s matches the spec's caps", (id) => {
    const p = getPlan(id);
    expect({
      dailyScoringCap: p.dailyScoringCap,
      dailyModelSpendCapUsd: p.dailyModelSpendCapUsd,
      matchCadenceMinutes: p.matchCadenceMinutes,
      autopilotDailySendCap: p.autopilotDailySendCap,
    }).toEqual(CAPS[id]);
  });

  it("pins the product numbers the launch depends on", () => {
    expect(getPlan("starter").applicationsPerCycle).toBe(1000);
    expect(getPlan("starter").priceUsd.month).toBe(19);
    expect(PLANS.map((p) => p.applicationsPerCycle)).toEqual([25, 1000, 1200, 3000]);
    expect(creditsPerInvoice("starter", "month")).toBe(1000);
  });

  it("scoring caps let a paid plan reach its allowance (spec formula, rounded)", () => {
    for (const p of PLANS.filter((x) => x.id !== "free")) {
      const formula = Math.ceil((1.1 * (p.applicationsPerCycle / 30)) / (0.35 * 0.9));
      expect(Math.abs(p.dailyScoringCap - formula)).toBeLessThanOrEqual(5);
    }
  });

  it("autopilot caps are about 1.1x the daily share of the allowance, and Free has none", () => {
    expect(getPlan("free").autopilotDailySendCap).toBe(0);
    for (const p of PLANS.filter((x) => x.id !== "free")) {
      const daily = (p.applicationsPerCycle / 30) * 1.1;
      expect(Math.abs(p.autopilotDailySendCap - daily)).toBeLessThanOrEqual(2);
    }
  });

  it("higher plans never get less: scoring cap, spend cap and autopilot rise, cadence falls", () => {
    for (let i = 1; i < PLANS.length; i++) {
      const a = PLANS[i - 1]!;
      const b = PLANS[i]!;
      expect(b.dailyScoringCap).toBeGreaterThanOrEqual(a.dailyScoringCap);
      expect(b.dailyModelSpendCapUsd).toBeGreaterThanOrEqual(a.dailyModelSpendCapUsd);
      expect(b.autopilotDailySendCap).toBeGreaterThanOrEqual(a.autopilotDailySendCap);
      expect(b.matchCadenceMinutes).toBeLessThanOrEqual(a.matchCadenceMinutes);
    }
  });

  it("the cloud channel and autopilot stay consistent with plan flags", () => {
    // Starter autopilot pre-approves into the extension queue (spec B.10), so it needs no cloud applier.
    expect(getPlan("starter").cloudApplier).toBe(false);
    expect(getPlan("pro").cloudApplier && getPlan("max").cloudApplier).toBe(true);
  });
});
