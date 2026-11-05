import v1 from "./prompts/v1.md";
import snap from "./schema.snap.json";
import { ClaimVerifierInput, ClaimVerifierOutput } from "../claim-verifier/schema";
import { renderClaimVerifier } from "../claim-verifier/render";
import { claimInputViolations, verdictViolations } from "../claim-verifier/spec";
import { promptAsset } from "../prompt-asset";
import type { AgentSpec } from "../types";

export const ESCALATION_MAX_CLAIMS = 15;

/**
 * claim-verifier-escalation (agents/09): the verifier's wire format on Sonnet, for claims the verifier called
 * uncertain. Fails closed: any failure, and its own "uncertain", drops the claim as unverified (services/verify.ts).
 * The daily 15% cap needs a database read, so it is enforced in services/verify.ts before this is called (a preCheck
 * is synchronous); this preCheck holds the per-call bound.
 */
export const claimVerifierEscalation: AgentSpec<ClaimVerifierInput, ClaimVerifierOutput> = {
  id: "claim-verifier-escalation",
  stakes: "high",
  promptVersion: 1,
  prompts: { 1: promptAsset("claim-verifier-escalation", 1, v1, snap) },
  model: "claude-sonnet-5-5",
  tierUp: null,
  onFailure: "fail_closed",
  thinking: "between_tools",
  effort: "low",
  input: ClaimVerifierInput,
  output: ClaimVerifierOutput,
  schemaSnapshot: snap,
  maxTokens: 400,
  maxInputTokens: 2_500,
  timeoutMs: 30_000,
  expectedCostUsd: 0.0045,
  maxCostPerCallUsd: 0.012,
  dailyEnvelopeUsd: 10,
  workspace: "interactive",
  budgetClass: "interactive",
  batchEligible: "never",
  cache: { static: "5m", user: null },
  preCheck: (input) => [
    ...(input.claims.length > ESCALATION_MAX_CLAIMS ? [{ code: "too_many_claims", path: "claims" }] : []),
    ...claimInputViolations(input),
  ],
  render: renderClaimVerifier,
  postValidate: verdictViolations,
  evalSet: "server/evals/claim-verifier-escalation/cases.jsonl",
};
