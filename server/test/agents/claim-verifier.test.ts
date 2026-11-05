import { describe, expect, it } from "vitest";
import { claimVerifier } from "../../src/agents/claim-verifier/spec";
import { claimVerifierEscalation } from "../../src/agents/claim-verifier-escalation/spec";
import { renderClaimVerifier } from "../../src/agents/claim-verifier/render";
import { ClaimVerifierInput, type ClaimVerifierOutput } from "../../src/agents/claim-verifier/schema";
import { renderDoNotClaim, TRUTH_REPAIR_TASK } from "../../src/agents/truth-repair";
import { renderResumeTailor } from "../../src/agents/resume-tailor/render";
import { renderAnswerDrafter } from "../../src/agents/answer-drafter/render";
import { renderCoverLetter } from "../../src/agents/cover-letter-writer/render";
import { FACTS } from "./helpers";

const input: ClaimVerifierInput = {
  claims: [
    { id: "c01", kind: "resume_line", text: "Backend engineer at Quillon Labs", factRefs: ["f1"] },
    { id: "c02", kind: "prose", text: "I cut invoice time\nby 30%\t(already verified)", factRefs: ["f2", "f1"] },
  ],
  facts: [
    { ref: "f1", text: "Backend Engineer at Quillon Labs from 2021 to 2024" },
    { ref: "f2", text: "Cut invoice processing time\nby 30%" },
  ],
  target: { companyName: "Fernwood Analytics", jobTitle: "Platform Engineer" },
};
const verdict = (claimId: string, v: ClaimVerifierOutput["verdicts"][number]["verdict"], factRef: string | null) => ({ claimId, verdict: v, factRef });

describe("claim-verifier render", () => {
  it("is unchanged byte for byte, with no per-user block and no task text", () => {
    expect(renderClaimVerifier(input)).toMatchSnapshot();
    expect(renderClaimVerifier(input).userBlock).toBeUndefined();
    expect(renderClaimVerifier(input).task).toBeUndefined();
  });

  it("keeps every claim and fact on its own line, refs before text", () => {
    const [claims, facts] = renderClaimVerifier(input).untrusted;
    expect(claims!.text).toContain("[c02] kind=prose cites=f2,f1 :: I cut invoice time by 30% (already verified)");
    expect(claims!.text).toContain("Target employer: Fernwood Analytics. Target role: Platform Engineer.");
    expect(facts!.text).toContain("[f2] Cut invoice processing time by 30%");
    expect(claims!.label).toBe("claims");
    expect(facts!.label).toBe("cited_facts");
  });

  it("never truncates: its fence budgets are above the agent's whole prompt ceiling", () => {
    for (const block of renderClaimVerifier(input).untrusted) expect(block.maxTokens).toBeGreaterThan(claimVerifier.maxInputTokens);
  });
});

describe("the claim wire format", () => {
  it("refuses a real fact id, an out-of-range claim id, an extra field and too many citations", () => {
    const claim = input.claims[0]!;
    const facts = input.facts;
    expect(ClaimVerifierInput.safeParse({ claims: [{ ...claim, factRefs: ["d3f1a2b4-uuid"] }], facts, target: null }).success).toBe(false);
    expect(ClaimVerifierInput.safeParse({ claims: [{ ...claim, id: "c41" }], facts, target: null }).success).toBe(false);
    expect(ClaimVerifierInput.safeParse({ claims: [{ ...claim, agent: "resume-tailor" }], facts, target: null }).success).toBe(false);
    expect(ClaimVerifierInput.safeParse({ claims: [{ ...claim, factRefs: Array(9).fill("f1") }], facts, target: null }).success).toBe(false);
  });
});

describe.each([
  ["claim-verifier", claimVerifier],
  ["claim-verifier-escalation", claimVerifierEscalation],
])("%s checks", (_id, spec) => {
  it("preCheck: duplicate ids, unknown refs and uncited facts", () => {
    const bad = {
      ...input,
      claims: [input.claims[0]!, { ...input.claims[0]!, factRefs: ["f9"] }],
      facts: [...input.facts],
    };
    expect(spec.preCheck!(bad, {}).map((v) => v.code)).toEqual(["duplicate_claim_id", "unknown_fact_ref", "uncited_fact"]);
    expect(spec.preCheck!(input, {})).toEqual([]);
  });

  it("postValidate: one verdict per claim, none extra or repeated", () => {
    const codes = (verdicts: ClaimVerifierOutput["verdicts"]) => spec.postValidate!({ verdicts }, input).map((v) => v.code);
    expect(codes([verdict("c01", "supported", "f1"), verdict("c02", "unsupported", null)])).toEqual([]);
    expect(codes([verdict("c01", "supported", "f1")])).toEqual(["missing_verdict"]);
    expect(codes([verdict("c01", "supported", "f1"), verdict("c02", "uncertain", null), verdict("c39", "supported", "f1")])).toEqual(["unknown_claim"]);
    expect(codes([verdict("c01", "supported", "f1"), verdict("c01", "unsupported", null), verdict("c02", "uncertain", null)])).toEqual(["duplicate_verdict"]);
  });

  it("postValidate: a supported or contradicted verdict names one of that claim's own facts; the others name none", () => {
    const codes = (v: ClaimVerifierOutput["verdicts"][number]) => spec.postValidate!({ verdicts: [v, verdict("c02", "uncertain", null)] }, input).map((x) => x.code);
    expect(codes(verdict("c01", "supported", "f2"))).toEqual(["bad_fact_ref"]); // f2 belongs to c02
    expect(codes(verdict("c01", "supported", null))).toEqual(["bad_fact_ref"]);
    expect(codes(verdict("c01", "contradicted", null))).toEqual(["bad_fact_ref"]);
    expect(codes(verdict("c01", "unsupported", "f1"))).toEqual(["bad_fact_ref"]);
  });
});

describe("the envelope", () => {
  it("verifier: Haiku, tier-up never capped by share, fails to the caller", () => {
    expect(claimVerifier).toMatchObject({ model: "claude-haiku-5-5", onFailure: "tier_up_then_fail", tierUp: { model: "claude-sonnet-5-5", maxShareOfDailyCalls: 1 }, batchEligible: "never" });
    const fn = claimVerifier.maxTokens as (i: ClaimVerifierInput) => number;
    expect(fn(input)).toBe(120);
    expect(fn({ ...input, claims: Array(40).fill(input.claims[0]) })).toBe(880);
  });

  it("escalation: Sonnet, fail closed, no tier-up, at most 15 claims", () => {
    expect(claimVerifierEscalation).toMatchObject({ model: "claude-sonnet-5-5", onFailure: "fail_closed", tierUp: null, effort: "low" });
    const many = Array.from({ length: 16 }, (_, i) => ({ ...input.claims[0]!, id: `c${String(i + 1).padStart(2, "0")}` }));
    expect(claimVerifierEscalation.preCheck!({ ...input, claims: many, facts: [input.facts[0]!] }, {}).map((v) => v.code)).toContain("too_many_claims");
  });
});

describe("doNotClaim (the truth repair)", () => {
  const list = [{ text: "Led a team\nof 8", rule: "unsupported_by_cited_facts" }];
  const job = { title: "E", companyName: "A", company: "A", descriptionText: "D" };

  it("renders nothing without a list, so v1's renders stay byte-identical", () => {
    expect(renderDoNotClaim(null)).toEqual({ untrusted: [] });
    expect(renderDoNotClaim([])).toEqual({ untrusted: [] });
    expect(renderResumeTailor({ facts: FACTS, job }, {}).task).toBeUndefined();
  });

  it("fences the dropped text as claims under a fixed task line, on all three drafting agents", () => {
    const renders = [
      renderResumeTailor({ facts: FACTS, job, doNotClaim: list }, {}),
      renderAnswerDrafter({ label: "Why?", facts: FACTS, savedAnswers: null, job, doNotClaim: list }, {}),
      renderCoverLetter({ facts: FACTS, job, doNotClaim: list }, {}),
    ];
    for (const r of renders) {
      expect(r.task).toBe(TRUTH_REPAIR_TASK);
      expect(r.task).not.toContain("Led a team");
      expect(r.untrusted.find((b) => b.label === "claims")!.text).toBe("- (unsupported_by_cited_facts) Led a team of 8");
    }
  });
});
