import v1 from "./prompts/v1.md";
import snap from "./schema.snap.json";
import { AnswerDrafterInput, AnswerDrafterOutput } from "./schema";
import { renderAnswerDrafter } from "./render";
import { promptAsset } from "../prompt-asset";
import type { AgentSpec, Violation } from "../types";

/**
 * answer-drafter (03-agent-runtime.md 3.3, 4.7): one application answer from confirmed facts.
 * Sensitive questions never reach this agent; the route classifies first and the service refuses too.
 */
export const answerDrafter: AgentSpec<AnswerDrafterInput, AnswerDrafterOutput> = {
  id: "answer-drafter",
  stakes: "high",
  promptVersion: 1,
  prompts: { 1: promptAsset("answer-drafter", 1, v1, snap) },
  model: "claude-haiku-5-5",
  tierUp: { model: "claude-sonnet-5-5", maxShareOfDailyCalls: 0.02, minDailyAllowance: 20, maxCostPerCallUsd: 0.02 },
  onFailure: "tier_up_then_defer",
  thinking: "disabled",
  input: AnswerDrafterInput,
  output: AnswerDrafterOutput,
  schemaSnapshot: snap,
  maxTokens: 900,
  maxInputTokens: 5_000,
  timeoutMs: 45_000,
  expectedCostUsd: 0.00048,
  maxCostPerCallUsd: 0.0012,
  dailyEnvelopeUsd: 12,
  workspace: "interactive",
  budgetClass: "pipeline",
  batchEligible: "never",
  cache: { static: "5m", user: "5m" },
  render: renderAnswerDrafter,
  postValidate: (out, input) => {
    const known = new Set(input.facts.map((f) => f.id));
    const violations: Violation[] = [];
    if (out.factIds.length === 0) violations.push({ code: "missing_citation", path: "factIds" });
    out.factIds.forEach((id, j) => {
      if (!known.has(id)) violations.push({ code: "unknown_fact_id", path: `factIds[${j}]` });
    });
    return violations;
  },
  evalSet: "server/evals/answer-drafter/cases.jsonl",
};
