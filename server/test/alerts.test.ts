import { describe, expect, it } from "vitest";
import { ENVELOPE_USD, evaluate, type AlertInput } from "../src/jobs/alerts";
import { PII_PATTERNS } from "../src/jobs/invariants";
import { burnRate } from "../src/lib/slo";

const quiet: AlertInput = { hour: {}, sixHours: {}, month: {}, spendUsd: 0, calls: 0, tieredUpCalls: 0, submissionsToday: 0, cloudRuns: { submitted: 0, failed: 0 }, queueLagS: {} };
const names = (i: Partial<AlertInput>) => evaluate({ ...quiet, ...i }).map((a) => a.signal);

describe("burnRate", () => {
  it("is 1 when the error rate equals the budget, and null without traffic", () => {
    expect(burnRate(995, 1000, 0.995)).toBeCloseTo(1);
    expect(burnRate(0, 0, 0.995)).toBeNull();
  });
});

describe("alert evaluator", () => {
  it("raises nothing on quiet inputs", () => expect(names({})).toEqual([]));

  it("pages a fast burn: 8% errors on S1 over an hour is 16x", () => {
    expect(names({ hour: { s1: { good: 920, total: 1000 } } })).toEqual(["slo_burn_fast"]);
  });

  it("warns a slow burn: 4% errors over 6 hours is 8x", () => {
    expect(names({ sixHours: { s1: { good: 960, total: 1000 } } })).toEqual(["slo_burn_slow"]);
  });

  it("ignores a window with too few events", () => {
    expect(names({ hour: { s1: { good: 0, total: 5 } } })).toEqual([]);
  });

  it("applies the error-budget policy to S1 and S5 only", () => {
    // 0.3% errors over 30 days on S1 (0.5% budget) is 60% of the budget burned.
    expect(names({ month: { s1: { good: 99_700, total: 100_000 } } })).toEqual(["slo_budget_half"]);
    expect(names({ month: { s3: { good: 90, total: 100 } } })).toEqual([]);
  });

  it("warns at 80% of the model envelope and pages at 100%", () => {
    expect(names({ spendUsd: ENVELOPE_USD * 0.8 })).toEqual(["llm_envelope_80"]);
    expect(names({ spendUsd: ENVELOPE_USD })).toEqual(["llm_envelope_100"]);
  });

  it("flags escalation share, cost per submission, cloud failures and queue lag", () => {
    expect(names({ calls: 200, tieredUpCalls: 30 })).toEqual(["llm_escalation_cap"]);
    expect(names({ spendUsd: 40, submissionsToday: 10 })).toEqual(["cost_per_submission"]);
    expect(names({ cloudRuns: { submitted: 4, failed: 8 } })).toEqual(["cloud_run_failures"]);
    expect(names({ cloudRuns: { submitted: 1, failed: 3 } })).toEqual([]);
    expect(names({ queueLagS: { "score-user": 900, maintenance: 3 } })).toEqual(["queue_lag"]);
  });
});

describe("PII shapes for the nightly scan", () => {
  const hit = (p: string, s: string) => new RegExp(p).test(s);
  it("match an address, a phone number and a JWT, and not a code", () => {
    expect(hit(PII_PATTERNS.email, "failed for jane.doe@example.com")).toBe(true);
    expect(hit(`^${PII_PATTERNS.phone}$`, "+1 (555) 010-0199")).toBe(true);
    expect(hit(PII_PATTERNS.jwt, "eyJhbGciOiJIUzI1NiJ9.abcdef")).toBe(true);
    for (const code of ["http_429", "required_missing", "company:3f2b0c1e-0000-4000-8000-000000000001", "queue_lag"]) {
      expect(hit(PII_PATTERNS.email, code) || hit(`^${PII_PATTERNS.phone}$`, code) || hit(PII_PATTERNS.jwt, code), code).toBe(false);
    }
  });
});
