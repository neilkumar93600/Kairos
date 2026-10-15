import { describe, expect, it } from "vitest";
import sampleJson from "@/content/fit-sample.json";
import { comboIndex, computeRun, SENIORITIES, type Cap, type FitSample } from "@/lib/landing/fit-run";

const sample = sampleJson as FitSample;

describe("computeRun", () => {
  it("keeps every count consistent for all 18 combos and every bar (spec 11)", () => {
    const combos = new Set<number>();
    for (const s of SENIORITIES)
      for (const v of ["yes", "no"] as const)
        for (const c of [1, 2, 3] as Cap[]) combos.add(comboIndex(s, v, c));
    expect([...combos].sort((a, b) => a - b)).toEqual([...Array(18).keys()]);

    for (const combo of combos) {
      const masks = sample.combos[combo];
      for (let bar = 50; bar <= 95; bar += 5) {
        const r = computeRun(sample, combo, bar);
        expect(r.skipped + r.passed).toBe(48);
        expect(r.kept + r.below).toBe(r.passed);
        for (const row of r.rows) expect(row.count).toBe(masks.filter((m) => m & (1 << row.code)).length);
        for (const card of r.cards) expect(card.validIn).toContain(combo);
        expect(r.more).toBe(r.kept - r.cards.length);
      }
    }
  });
});
