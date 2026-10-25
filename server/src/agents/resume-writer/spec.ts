import v1 from "./prompts/v1.md";
import snap from "./schema.snap.json";
import { ResumeWriterInput, ResumeWriterOutput } from "./schema";
import { renderResumeWriter } from "./render";
import { promptAsset } from "../prompt-asset";
import type { AgentSpec, Effort, Violation } from "../types";

/**
 * resume-writer (03-agent-runtime.md 3.3): the interactive builder agent on Sonnet 5.5. The service
 * verifies every suggestion in code (ids owned, no invented details); postValidate rejects unknown
 * fact ids so the repair re-ask fixes them before the service sees them.
 */
export const resumeWriter: AgentSpec<ResumeWriterInput, ResumeWriterOutput> = {
  id: "resume-writer",
  stakes: "high",
  promptVersion: 1,
  prompts: { 1: promptAsset("resume-writer", 1, v1, snap) },
  model: "claude-sonnet-5-5",
  tierUp: null,
  onFailure: "fail_closed",
  thinking: "between_tools",
  effort: (input) => ((input.scope === "line" || input.scope === "entry") ? "low" : "medium"),
  input: ResumeWriterInput,
  output: ResumeWriterOutput,
  schemaSnapshot: snap,
  maxTokens: (input) => (input.scope === "line" || input.scope === "entry" ? 800 : 2_600),
  maxInputTokens: 12_000,
  timeoutMs: 60_000,
  expectedCostUsd: 0.0112,
  maxCostPerCallUsd: 0.05,
  dailyEnvelopeUsd: 50,
  workspace: "interactive",
  budgetClass: "interactive",
  batchEligible: "never",
  cache: { static: "5m", user: "5m" },
  render: renderResumeWriter,
  postValidate: (out, input) => {
    const known = new Set([...input.facts, ...(input.noteFact ? [input.noteFact] : [])].map((f) => f.id));
    const violations: Violation[] = [];
    out.suggestions.forEach((s, i) => {
      s.factIds.forEach((id, j) => {
        if (!known.has(id)) violations.push({ code: "unknown_fact_id", path: `suggestions[${i}].factIds[${j}]` });
      });
    });
    return violations;
  },
  evalSet: "server/evals/resume-writer/cases.jsonl",
};

export type { Effort };
