import { describe, expect, it } from "vitest";
import { FAILURE_CODES } from "../src/db/schema";
import { cloudApplyKey, emitOutbox } from "../src/durable/outbox";
import { closeByPhase, decideSettlement } from "../src/services/settle";
import { AMBIGUOUS, boundedEvidence, factsSnapshotHash, FAILURE_MESSAGES, RESENDABLE } from "../src/services/submissions";

describe("closeByPhase (08 3.2): nothing before the fill can have reached the employer", () => {
  it.each([
    ["cloud", "claimed", "failed", "applier_error"],
    ["cloud", "navigating", "failed", "applier_error"],
    ["cloud", "filling", "needs_check", "unconfirmed"],
    ["cloud", "submit_seen", "needs_check", "unconfirmed"],
    ["extension", "claimed", "needs_check", "no_report"],
    ["extension", "filling", "needs_check", "no_report"],
  ] as const)("%s in %s closes %s, %s", (channel, phase, state, code) => {
    expect(closeByPhase({ channel, phase })).toEqual({ state, code });
  });
});

describe("decideSettlement (08 3.2): only D1 charges", () => {
  const STATES = ["submitted", "failed", "needs_check"] as const;
  const seen = [null, new Date()];

  it("every combination of state, code and submit_seen yields submitted only from a submitted attempt", () => {
    for (const state of STATES) {
      for (const failureCode of [null, ...FAILURE_CODES]) {
        for (const submitSeenAt of seen) {
          const d = decideSettlement({ state, failureCode, submitSeenAt });
          expect(d.outcome).toBe(state === "submitted" ? "submitted" : "failed");
        }
      }
    }
  });

  it("D2: a failure after the apply POST was seen is ambiguous whatever the applier said", () => {
    for (const failureCode of [...RESENDABLE, "posting_closed"] as const) {
      expect(decideSettlement({ state: "failed", failureCode, submitSeenAt: new Date() })).toEqual({ outcome: "failed", code: "unconfirmed" });
    }
    expect(decideSettlement({ state: "failed", failureCode: "timeout", submitSeenAt: new Date() })).toEqual({ outcome: "failed", code: "timeout" });
  });

  it("D3 to D10: the code passes through when no POST was seen, and an unknown code is the ambiguous one", () => {
    for (const failureCode of FAILURE_CODES) expect(decideSettlement({ state: "failed", failureCode, submitSeenAt: null })).toEqual({ outcome: "failed", code: failureCode });
    expect(decideSettlement({ state: "needs_check", failureCode: null, submitSeenAt: null })).toEqual({ outcome: "failed", code: "unconfirmed" });
  });
});

describe("the failure catalog (applications-78)", () => {
  it("has a message for every code, each fitting failure_reason", () => {
    for (const code of FAILURE_CODES) {
      expect(FAILURE_MESSAGES[code]).toBeTruthy();
      expect(FAILURE_MESSAGES[code].length).toBeLessThanOrEqual(500);
    }
  });

  it("RESENDABLE and AMBIGUOUS partition the codes, with posting_closed alone outside both", () => {
    const outside = FAILURE_CODES.filter((c) => !RESENDABLE.has(c) && !AMBIGUOUS.has(c));
    expect(outside).toEqual(["posting_closed"]);
    expect([...RESENDABLE].filter((c) => AMBIGUOUS.has(c))).toEqual([]);
  });
});

describe("boundedEvidence", () => {
  it("never holds a field value, and fits submission_attempts_evidence_ck however large the input", () => {
    const keys = Array.from({ length: 300 }, (_, i) => `custom_question_with_a_long_key_${i}`);
    const evidence = boundedEvidence(keys, "é".repeat(4000));
    expect(Buffer.byteLength(JSON.stringify(evidence))).toBeLessThanOrEqual(3800);
    expect(Object.keys(evidence).sort()).toEqual(["confirmationText", "filledFieldKeys"]);
  });

  it("drops a NUL, which jsonb refuses, and redacts the confirmation", () => {
    const evidence = boundedEvidence(["a\u0000b"], "Thanks jane@example.com\u0000!");
    expect(JSON.stringify(evidence)).not.toContain("\\u0000");
    expect(evidence.filledFieldKeys).toEqual(["ab"]);
    expect(evidence.confirmationText).not.toContain("jane@example.com");
  });
});

describe("factsSnapshotHash", () => {
  const a = { id: "a", text: "Built x", confirmedAt: new Date("2026-01-01") };
  const b = { id: "b", text: "Ran y", confirmedAt: new Date("2026-01-02") };
  it("ignores citation order and moves when a fact's text or confirmation moves", () => {
    expect(factsSnapshotHash([a, b])).toBe(factsSnapshotHash([b, a]));
    expect(factsSnapshotHash([a])).not.toBe(factsSnapshotHash([{ ...a, text: "Built z" }]));
    expect(factsSnapshotHash([a])).not.toBe(factsSnapshotHash([{ ...a, confirmedAt: null }]));
    expect(factsSnapshotHash([a])).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the outbox key of a send", () => {
  it("carries the attempt number, so a resend is its own row and job, in a shape emitOutbox and BullMQ take", async () => {
    const id = "6f1d7c1e-0a7e-4b52-9a54-3f1f6a0a7d11";
    expect(cloudApplyKey(id, 2)).toBe(`apply-${id}-2`);
    expect(cloudApplyKey(id, 2)).not.toBe(cloudApplyKey(id, 3));
    expect(cloudApplyKey(id, 2)).not.toContain(":");
    const inserted: unknown[] = [];
    const tx = { insert: () => ({ values: (v: unknown) => (inserted.push(v), { onConflictDoNothing: async () => {} }) }) };
    await emitOutbox(tx as never, "cloud-apply", { applicationId: id, attemptNo: 2 }, cloudApplyKey(id, 2));
    expect(inserted).toEqual([{ queue: "cloud-apply", dedupeKey: `apply-${id}-2`, payload: { applicationId: id, attemptNo: 2 } }]);
  });
});
