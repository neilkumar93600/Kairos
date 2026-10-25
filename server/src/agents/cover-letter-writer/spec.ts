import v1 from "./prompts/v1.md";
import snap from "./schema.snap.json";
import { CoverLetterInput, CoverLetterOutput } from "./schema";
import { renderCoverLetter } from "./render";
import { promptAsset } from "../prompt-asset";
import type { AgentSpec, Violation } from "../types";

/**
 * cover-letter-writer (03-agent-runtime.md 3.3, 4.7): plan-gated by the route (coverLetters), never
 * batch. The service drops paragraphs failing verification and enforces four paragraphs, 250 words.
 */
export const coverLetterWriter: AgentSpec<CoverLetterInput, CoverLetterOutput> = {
  id: "cover-letter-writer",
  stakes: "high",
  promptVersion: 1,
  prompts: { 1: promptAsset("cover-letter-writer", 1, v1, snap) },
  model: "claude-haiku-5-5",
  tierUp: { model: "claude-sonnet-5-5", maxShareOfDailyCalls: 0.02, minDailyAllowance: 20, maxCostPerCallUsd: 0.02 },
  onFailure: "tier_up_then_defer",
  thinking: "disabled",
  input: CoverLetterInput,
  output: CoverLetterOutput,
  schemaSnapshot: snap,
  maxTokens: 1_000,
  maxInputTokens: 5_000,
  timeoutMs: 45_000,
  expectedCostUsd: 0.0006,
  maxCostPerCallUsd: 0.0015,
  dailyEnvelopeUsd: 7.5,
  workspace: "interactive",
  budgetClass: "pipeline",
  batchEligible: "never",
  cache: { static: "5m", user: "5m" },
  render: renderCoverLetter,
  postValidate: (out, input) => {
    const known = new Set(input.facts.map((f) => f.id));
    const violations: Violation[] = [];
    out.paragraphs.forEach((p, i) => {
      if (p.factIds.length === 0) violations.push({ code: "missing_citation", path: `paragraphs[${i}].factIds` });
      p.factIds.forEach((id, j) => {
        if (!known.has(id)) violations.push({ code: "unknown_fact_id", path: `paragraphs[${i}].factIds[${j}]` });
      });
    });
    return violations;
  },
  evalSet: "server/evals/cover-letter-writer/cases.jsonl",
};
