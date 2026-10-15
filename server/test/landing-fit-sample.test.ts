import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Preferences } from "@auto-career/shared";
import { passesHardFilters, type FitJob } from "../src/services/fit";
import { buildFitSample, serializeFitSample, SAMPLE_PATH, type FitSample } from "../scripts/build-landing-fit-sample";

const committedText = readFileSync(SAMPLE_PATH, "utf8").replace(/\r\n/g, "\n");
const committed = JSON.parse(committedText) as FitSample;

// Same formula as web/lib/landing/fit-run.ts: seniority * 6 + (needs sponsorship ? 0 : 3) + (cap - 1).
const combo = (seniority: 0 | 1 | 2, yes: boolean, cap: 1 | 2 | 3) => seniority * 6 + (yes ? 0 : 3) + (cap - 1);
const DEFAULT = combo(0, true, 2);
const SENIOR_DEFAULT = combo(2, true, 2);

const prefs: Preferences = {
  roles: ["Software Engineer"],
  seniority: ["entry"],
  locations: ["New York"],
  remoteOk: false,
  workAuthorization: "needs_sponsorship_now",
  salaryFloorUsd: 85_000,
  excludedCompanies: ["Company 031"],
  excludedKeywords: ["clearance"],
  fitThreshold: 70,
  maxApplicationsPerCompanyPer30Days: 1,
};
const job: FitJob = {
  title: "Senior Marketing Manager",
  companyName: "Company 031",
  location: "Seattle, WA",
  remote: false,
  descriptionText: "Requires clearance. We are unable to sponsor visas.",
  salaryMaxUsd: 60_000,
};

const count = (code: number, masks: number[]) => masks.filter((m) => m & (1 << code)).length;

describe("landing fit sample", () => {
  it("matches what the generator produces now (drift)", () => {
    expect(serializeFitSample(buildFitSample())).toBe(committedText);
  });

  it("holds only reason strings that passesHardFilters can produce, and all of them", () => {
    const entry = passesHardFilters(job, prefs, 5).reasons;
    const senior = passesHardFilters({ ...job, title: "Junior Marketing" }, { ...prefs, seniority: ["senior"] }, 5).reasons;
    expect(new Set(committed.reasons)).toEqual(new Set([...entry, ...senior]));
    expect(committed.reasons).toHaveLength(9);
  });

  it("has 48 postings, 18 combinations of 48 masks, and every mask bit names a reason", () => {
    expect(committed.postings).toHaveLength(48);
    expect(new Set(committed.postings.map((p) => p.id)).size).toBe(48);
    expect(committed.combos).toHaveLength(18);
    for (const masks of committed.combos) {
      expect(masks).toHaveLength(48);
      for (const m of masks) expect(m >> committed.reasons.length).toBe(0);
    }
  });

  it("meets the design targets in the default combination", () => {
    const masks = committed.combos[DEFAULT]!;
    const passed = committed.postings.filter((_, i) => masks[i] === 0);
    expect(passed.length).toBeGreaterThanOrEqual(8);
    expect(passed.length).toBeLessThanOrEqual(12);
    const kept = passed.filter((p) => p.score >= 70);
    expect(kept.length).toBeGreaterThanOrEqual(3);
    expect(kept.length).toBeLessThanOrEqual(5);

    const junior = committed.reasons.indexOf("Title is more junior than you asked for");
    committed.reasons.forEach((_, code) => {
      if (code === junior) expect(count(code, masks)).toBe(0); // unreachable under Entry (fit.ts line 47)
      else expect(count(code, masks), committed.reasons[code]).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows the junior reason at least twice under Senior", () => {
    const junior = committed.reasons.indexOf("Title is more junior than you asked for");
    expect(count(junior, committed.combos[SENIOR_DEFAULT]!)).toBeGreaterThanOrEqual(2);
  });

  it("authors three cards that pass in the default combination", () => {
    expect(committed.cards.map((c) => c.title)).toEqual([
      "Company 014 · Software Engineer, Platform",
      "Company 027 · Backend Engineer I",
      "Company 003 · Software Engineer, New Grad",
    ]);
    for (const card of committed.cards) {
      const i = committed.postings.findIndex((p) => p.id === card.id);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(card.validIn).toContain(DEFAULT);
      for (const c of card.validIn) expect(committed.combos[c]![i]).toBe(0);
    }
    expect(committed.cards.map((c) => committed.postings.find((p) => p.id === c.id)!.score)).toEqual([82, 76, 74]);
  });
});
