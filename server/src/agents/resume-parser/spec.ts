import v1 from "./prompts/v1.md";
import snap from "./schema.snap.json";
import { ResumeParserInput, ResumeParserOutput } from "./schema";
import { renderResumeParser } from "./render";
import { promptAsset } from "../prompt-asset";
import type { AgentSpec } from "../types";

/**
 * resume-parser (03-agent-runtime.md 3.3, 4.7): one call per uploaded resume. Output facts are
 * stored with `asserted_by = 'import'` and `confirmed = false`; the user confirms each one.
 */
export const resumeParser: AgentSpec<ResumeParserInput, ResumeParserOutput> = {
  id: "resume-parser",
  stakes: "medium",
  promptVersion: 1,
  prompts: { 1: promptAsset("resume-parser", 1, v1, snap) },
  model: "claude-haiku-5-5",
  tierUp: { model: "claude-sonnet-5-5", maxShareOfDailyCalls: 0.05, minDailyAllowance: 20, maxCostPerCallUsd: 0.06 },
  onFailure: "tier_up_then_defer",
  thinking: "disabled",
  input: ResumeParserInput,
  output: ResumeParserOutput,
  schemaSnapshot: snap,
  maxTokens: 4_000,
  maxInputTokens: 9_000,
  timeoutMs: 45_000,
  expectedCostUsd: 0.0019,
  maxCostPerCallUsd: 0.005,
  dailyEnvelopeUsd: 1,
  workspace: "batch",
  budgetClass: "pipeline",
  batchEligible: "never",
  cache: { static: "5m", user: null },
  render: renderResumeParser,
  evalSet: "server/evals/resume-parser/cases.jsonl",
};
