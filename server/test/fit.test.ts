import { afterEach, describe, expect, it } from "vitest";
import type { Preferences } from "@auto-career/shared";
import { passesHardFilters, scoreFit, type FitJob } from "../src/services/fit";
import { configureGateway } from "../src/llm/gateway";
import { Budget } from "../src/llm/budget";
import { memorySpendStore } from "../src/llm/spend-store";
import { fakeAnthropic } from "../src/llm/testing";
import { resetBreakers } from "../src/llm/breaker";
import { resetLimiter } from "../src/llm/limiter";

const prefs: Preferences = {
  roles: ["software engineer"],
  seniority: ["entry"],
  locations: ["New York"],
  remoteOk: true,
  workAuthorization: "opt_stem_opt",
  salaryFloorUsd: 90_000,
  excludedCompanies: ["Initech"],
  excludedKeywords: ["clearance"],
  fitThreshold: 75,
  maxApplicationsPerCompanyPer30Days: 2,
};

const job: FitJob = {
  title: "Software Engineer, New Grad",
  companyName: "Acme",
  location: "New York, NY",
  remote: false,
  descriptionText: "Build APIs in TypeScript.",
  salaryMaxUsd: 140_000,
};

describe("passesHardFilters", () => {
  it("passes a job that fits every rule", () => {
    expect(passesHardFilters(job, prefs, 0)).toEqual({ pass: true, reasons: [] });
  });

  it("rejects a senior title for an entry-level search", () => {
    const r = passesHardFilters({ ...job, title: "Senior Software Engineer" }, prefs, 0);
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain("Title is more senior than you asked for");
  });

  it("rejects postings that say they do not sponsor when the user needs sponsorship", () => {
    const r = passesHardFilters({ ...job, descriptionText: "We are unable to sponsor visas for this role." }, prefs, 0);
    expect(r.reasons).toContain("Posting says it does not sponsor visas");
  });

  it("accepts a remote job outside the location list when remote is ok", () => {
    expect(passesHardFilters({ ...job, location: "Austin, TX", remote: true }, prefs, 0).pass).toBe(true);
  });

  it("rejects an office job outside the location list", () => {
    expect(passesHardFilters({ ...job, location: "Austin, TX" }, prefs, 0).reasons).toContain("Location is outside your list");
  });

  it("enforces the per-company cap", () => {
    expect(passesHardFilters(job, prefs, 2).reasons).toContain("You hit your per-company limit for the last 30 days");
  });

  it("rejects excluded companies, keywords and low salaries", () => {
    const r = passesHardFilters({ ...job, companyName: "initech", descriptionText: "Requires clearance", salaryMaxUsd: 70_000 }, prefs, 0);
    expect(r.reasons).toEqual(
      expect.arrayContaining(["Company is on your exclude list", 'Mentions excluded keyword "clearance"', "Posted salary is below your floor"]),
    );
  });
});

describe("scoreFit on the gateway path", () => {
  afterEach(() => configureGateway({ writeRow: async () => null }));

  it("clips an oversized summary and posting to the agent's input schema, so the call still goes out (llm-agents-v01)", async () => {
    resetBreakers();
    resetLimiter();
    const fake = fakeAnthropic([
      { content: [{ type: "text", text: JSON.stringify({ score: 70, reasons: ["Meets the API requirement"] }) }], stop_reason: "end_turn", usage: { input_tokens: 900, output_tokens: 30 } },
    ]);
    configureGateway({
      client: () => fake,
      budget: new Budget(memorySpendStore()),
      writeRow: async () => "call-1",
      sleep: async () => {},
      flags: () => ({ llmPaused: false, batchPaused: false, disabled: {}, promptPin: {} }),
    });
    const huge = { ...job, title: "Software Engineer ".repeat(20), location: "New York; ".repeat(40), descriptionText: "Build APIs in TypeScript. ".repeat(1_200) };
    const out = await scoreFit(huge, "- (skill) TypeScript APIs\n".repeat(400), { userId: "u1" });
    expect(out.score).toBe(70);
    expect(fake.requests).toHaveLength(1);
  });
});
