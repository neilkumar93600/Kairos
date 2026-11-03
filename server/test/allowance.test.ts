import { describe, expect, it } from "vitest";
import { allowanceHeader, consumeAllowance, refundable } from "../src/services/allowance";
import { HttpError, nextUtcMidnight } from "../src/lib/errors";
import { AgentError } from "../src/llm/errors";

/** The pure parts of the F11 allowance (05-api 11.5); consume and refund against Postgres are in allowance.int.test.ts. */
describe("allowance", () => {
  it("formats Kairos-Allowance as feature;used;limit;resets", () => {
    const header = allowanceHeader({ userId: "u", feature: "resumeSuggestions", day: "2026-10-23", units: 1, used: 3, limit: 15, resetsAt: "2026-10-24T00:00:00Z" });
    expect(header).toBe("feature=resumeSuggestions;used=3;limit=15;resets=2026-10-24T00:00:00Z");
  });

  it("resets at the next 00:00 UTC, also late in a UTC day", () => {
    expect(nextUtcMidnight(new Date("2026-10-23T23:59:59Z"))).toBe("2026-10-24T00:00:00Z");
    expect(nextUtcMidnight(new Date("2026-12-31T00:00:00Z"))).toBe("2027-01-01T00:00:00Z");
  });

  it("a plan with 0 of a feature answers 403 before touching the database", async () => {
    await expect(consumeAllowance({ userId: "u", plan: "free", feature: "rehearsalTurns" })).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("refunds validation and pre-reply gateway failures, never a reply the model already wrote", () => {
    expect(refundable(new HttpError(422, "invalid_scope", "x"))).toBe(true);
    expect(refundable(new HttpError(404, "not_found", "x"))).toBe(true);
    expect(refundable(new HttpError(422, "truth_lock", "x"))).toBe(false);
    for (const code of ["budget_stopped", "circuit_open", "limiter_timeout", "overloaded", "rate_limited", "timeout", "auth"] as const) {
      expect(refundable(new AgentError(code, "x", true)), code).toBe(true);
    }
    for (const code of ["refusal", "schema_invalid", "max_tokens", "injection_echo"] as const) {
      expect(refundable(new AgentError(code, "x", false)), code).toBe(false);
    }
    expect(refundable(new Error("database down"))).toBe(false);
  });
});
