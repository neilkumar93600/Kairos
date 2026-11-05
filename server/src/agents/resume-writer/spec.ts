import v1 from "./prompts/v1.md";
import v2 from "./prompts/v2.md";
import snap from "./schema.snap.json";
import snapV2 from "./schema.v2.snap.json";
import { shapeViolations } from "./checks";
import { ResumeWriterInput, ResumeWriterInputV2, ResumeWriterOutput, ResumeWriterOutputV2 } from "./schema";
import { renderResumeWriter, renderResumeWriterV2 } from "./render";
import { promptAsset } from "../prompt-asset";
import type { AgentSpec, Effort, Violation } from "../types";

const citationViolations = (out: Pick<ResumeWriterOutput, "suggestions">, input: Pick<ResumeWriterInput, "facts" | "noteFact">): Violation[] => {
  const known = new Set([...input.facts, ...(input.noteFact ? [input.noteFact] : [])].map((f) => f.id));
  return out.suggestions.flatMap((s, i) =>
    s.factIds.flatMap((id, j) => (known.has(id) ? [] : [{ code: "unknown_fact_id", path: `suggestions[${i}].factIds[${j}]` }])),
  );
};

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
  postValidate: citationViolations,
  evalSet: "server/evals/resume-writer/cases.jsonl",
};


/**
 * resume-writer@v2 (agents/05): level, tag, priority, the headline scope. A second object with the same id, because the
 * input changes (agents/03 9): a pin to 1 must not render v2 input under v1 text, so services/resume-writer.ts picks
 * the object by version (pickWriter) and the gateway never sees a mismatch. Shares the agent's $50 envelope by id.
 */
export const resumeWriterV2: AgentSpec<ResumeWriterInputV2, ResumeWriterOutputV2> = {
  ...(resumeWriter as unknown as AgentSpec<ResumeWriterInputV2, ResumeWriterOutputV2>),
  promptVersion: 2,
  prompts: { 2: promptAsset("resume-writer", 2, v2, snapV2) },
  effort: (input) => (input.scope === "line" || input.scope === "entry" || input.scope === "headline" ? "low" : "medium"),
  input: ResumeWriterInputV2,
  output: ResumeWriterOutputV2,
  schemaSnapshot: snapV2,
  // Eight suggestions do not fit in 800 tokens, and a cut reply loses them all; twenty with long ids take about 4,000.
  maxTokens: (input) => (input.scope === "line" || input.scope === "headline" ? 800 : input.scope === "resume" ? 4_000 : 2_600),
  maxCostPerCallUsd: 0.065,
  render: renderResumeWriterV2,
  postValidate: (out, input) => [...citationViolations(out, input), ...shapeViolations(out, input)],
};
export type { Effort };
