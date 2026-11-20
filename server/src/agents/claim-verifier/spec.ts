import v1 from "./prompts/v1.md";
import snap from "./schema.snap.json";
import { ClaimVerifierInput, ClaimVerifierOutput } from "./schema";
import { renderClaimVerifier } from "./render";
import { promptAsset } from "../prompt-asset";
import type { AgentSpec, Violation } from "../types";

/** preCheck (agents/08 7): claim ids unique, every cited ref present, every fact cited. Shared with the escalation. */
export function claimInputViolations(input: ClaimVerifierInput): Violation[] {
  const violations: Violation[] = [];
  const refs = new Set(input.facts.map((f) => f.ref));
  const cited = new Set<string>();
  const ids = new Set<string>();
  input.claims.forEach((c, i) => {
    if (ids.has(c.id)) violations.push({ code: "duplicate_claim_id", path: `claims[${i}].id` });
    ids.add(c.id);
    c.factRefs.forEach((r, j) => {
      cited.add(r);
      if (!refs.has(r)) violations.push({ code: "unknown_fact_ref", path: `claims[${i}].factRefs[${j}]` });
    });
  });
  input.facts.forEach((f, i) => {
    if (!cited.has(f.ref)) violations.push({ code: "uncited_fact", path: `facts[${i}]` });
  });
  return violations;
}

/**
 * postValidate CV1 and CV2 (agents/08 7): one verdict per claim, none extra or repeated; supported and contradicted
 * name one of that claim's own refs, unsupported and uncertain name none. CV3, the echo canary, is the gateway's.
 */
export function verdictViolations(out: ClaimVerifierOutput, input: ClaimVerifierInput): Violation[] {
  const violations: Violation[] = [];
  const claims = new Map(input.claims.map((c) => [c.id, c]));
  const seen = new Set<string>();
  out.verdicts.forEach((v, i) => {
    const claim = claims.get(v.claimId);
    if (!claim) return void violations.push({ code: "unknown_claim", path: `verdicts[${i}].claimId` });
    if (seen.has(v.claimId)) return void violations.push({ code: "duplicate_verdict", path: `verdicts[${i}].claimId` });
    seen.add(v.claimId);
    const needsRef = v.verdict === "supported" || v.verdict === "contradicted";
    if (needsRef ? v.factRef === null || !claim.factRefs.includes(v.factRef) : v.factRef !== null) {
      violations.push({ code: "bad_fact_ref", path: `verdicts[${i}].factRef` });
    }
  });
  input.claims.forEach((c, i) => {
    if (!seen.has(c.id)) violations.push({ code: "missing_verdict", path: `claims[${i}]` });
  });
  return violations;
}

/**
 * claim-verifier (agents/08-claim-verifier.md), truth-lock layer 3: Haiku, tier-up to Sonnet on any failure, never
 * skipped. It can only remove content. Called only through services/verify.ts, which looks up verified_claims first,
 * shuffles, assigns opaque refs and maps the verdicts back.
 */
export const claimVerifier: AgentSpec<ClaimVerifierInput, ClaimVerifierOutput> = {
  id: "claim-verifier",
  stakes: "high",
  promptVersion: 1,
  prompts: { 1: promptAsset("claim-verifier", 1, v1, snap) },
  model: "claude-haiku-5-5",
  // Share 1.0: verification is never skipped for want of a tier-up (agents/08 6).
  tierUp: { model: "claude-sonnet-5-5", maxShareOfDailyCalls: 1, minDailyAllowance: 20, maxCostPerCallUsd: 0.02 },
  onFailure: "tier_up_then_fail",
  thinking: "disabled",
  input: ClaimVerifierInput,
  output: ClaimVerifierOutput,
  schemaSnapshot: snap,
  maxTokens: (input) => Math.min(900, 80 + 20 * input.claims.length),
  maxInputTokens: 4_000,
  timeoutMs: 30_000,
  expectedCostUsd: 0.0005,
  maxCostPerCallUsd: 0.0012,
  dailyEnvelopeUsd: 25,
  workspace: "interactive",
  budgetClass: "interactive",
  batchEligible: "never",
  cache: { static: "5m", user: null },
  preCheck: (input) => claimInputViolations(input),
  render: renderClaimVerifier,
  postValidate: verdictViolations,
  evalSet: "server/evals/claim-verifier/cases.jsonl",
};
