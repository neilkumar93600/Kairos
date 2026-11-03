import v1 from "./prompts/v1.md";
import snap from "./schema.snap.json";
import { FitScorerInput, FitScorerOutput } from "./schema";
import { renderFitScorer } from "./render";
import { promptAsset } from "../prompt-asset";
import type { AgentSpec } from "../types";

/**
 * fit-scorer (03-agent-runtime.md 3.2-3.3): scores one GatePassed pair. Runs only after the hard
 * filters (the caller owns the gate), so a job that failed them never costs a token.
 */
export const fitScorer: AgentSpec<FitScorerInput, FitScorerOutput> = {
  id: "fit-scorer",
  stakes: "high",
  promptVersion: 1,
  prompts: { 1: promptAsset("fit-scorer", 1, v1, snap) },
  model: "claude-haiku-5-5",
  tierUp: null, // no tier-up at scoring volume; defer instead
  onFailure: "defer",
  thinking: "disabled",
  input: FitScorerInput,
  output: FitScorerOutput,
  schemaSnapshot: snap,
  maxTokens: 200,
  // ponytail: v1 sends the profile block and the whole posting, so the ceiling is the most the $0.0006 per-call cap
  // allows at 200 output tokens; 3.3's 3,000 is the v2 job-card budget and returns with fit-scorer v2.
  maxInputTokens: 5_000,
  timeoutMs: 20_000,
  expectedCostUsd: 0.00021,
  maxCostPerCallUsd: 0.0006,
  dailyEnvelopeUsd: 40,
  workspace: "batch",
  budgetClass: "pipeline",
  batchEligible: "never",
  cache: { static: "5m", user: "5m" },
  render: renderFitScorer,
  evalSet: "server/evals/fit-scorer/cases.jsonl",
};
