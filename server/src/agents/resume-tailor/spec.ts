import v1 from "./prompts/v1.md";
import snap from "./schema.snap.json";
import { ResumeTailorInput, ResumeTailorOutput } from "./schema";
import { renderResumeTailor } from "./render";
import { promptAsset } from "../prompt-asset";
import type { AgentSpec, Violation } from "../types";

/**
 * resume-tailor (03-agent-runtime.md 3.3, 4.7): legacy mode, no base resume. The service applies the
 * truth lock to the result; postValidate rejects unknown or missing citations so the repair re-ask
 * can fix a stray id before the service ever sees it.
 */
export const resumeTailor: AgentSpec<ResumeTailorInput, ResumeTailorOutput> = {
  id: "resume-tailor",
  stakes: "high",
  promptVersion: 1,
  prompts: { 1: promptAsset("resume-tailor", 1, v1, snap) },
  model: "claude-haiku-5-5",
  tierUp: { model: "claude-sonnet-5-5", maxShareOfDailyCalls: 0.02, minDailyAllowance: 20, maxCostPerCallUsd: 0.03 },
  onFailure: "tier_up_then_defer",
  thinking: "disabled",
  input: ResumeTailorInput,
  output: ResumeTailorOutput,
  schemaSnapshot: snap,
  maxTokens: 1_800,
  maxInputTokens: 6_000,
  timeoutMs: 45_000,
  expectedCostUsd: 0.00082,
  maxCostPerCallUsd: 0.002,
  dailyEnvelopeUsd: 36,
  workspace: "interactive",
  budgetClass: "pipeline",
  batchEligible: "never",
  cache: { static: "5m", user: "5m" },
  render: renderResumeTailor,
  postValidate: (out, input) => {
    const known = new Set(input.facts.map((f) => f.id));
    const violations: Violation[] = [];
    out.lines.forEach((line, i) => {
      if (line.factIds.length === 0) violations.push({ code: "missing_citation", path: `lines[${i}].factIds` });
      line.factIds.forEach((id, j) => {
        if (!known.has(id)) violations.push({ code: "unknown_fact_id", path: `lines[${i}].factIds[${j}]` });
      });
    });
    return violations;
  },
  evalSet: "server/evals/resume-tailor/cases.jsonl",
};
