import type { z } from "zod";
import type { AiFeature, PlanId } from "@auto-career/shared";

/**
 * The agent definition interface (03-agent-runtime.md 3.1). Compared with 01-architecture.md B.9.3
 * this keeps every field name and adds the P1 fields; `render` returns userBlock, task and
 * untrusted, and the gateway attaches the static system text from prompts[promptVersion], which
 * makes "static means static" structural rather than a convention.
 */

export type AgentId =
  | "resume-parser" | "jd-analyst" | "fit-scorer" | "resume-tailor" | "resume-writer" | "answer-drafter"
  | "cover-letter-writer" | "claim-verifier" | "claim-verifier-escalation" | "reply-classifier"
  | "outcome-analyst" | "interview-coach";

/** Production models. Opus 5.5 appears only in evals/judge config, never in this union. */
export type ClaudeModel = "claude-haiku-5-5" | "claude-sonnet-5-5";
export type Effort = "low" | "medium" | "high";
export type ThinkingMode = "disabled" | "between_tools" | "adaptive";
export type Stakes = "high" | "medium" | "low";
export type BudgetClass = "pipeline" | "interactive" | "ops" | "eval";
export type OnFailure = "tier_up_then_defer" | "tier_up_then_fail" | "defer" | "fail_closed";

/** Labels of fenced data blocks. Every label is a fixed identifier; free text never becomes a label. */
export type DataLabel =
  | "job_card" | "job_description" | "job_title" | "form_questions" | "resume_text" | "email"
  | "user_note" | "user_answer" | "claims" | "cited_facts" | "facts" | "profile" | "resume_lines"
  | "requirements" | "transcript" | "metrics" | "saved_answers";

export interface PromptAsset {
  version: number; // N of prompts/v<N>.md
  system: string; // static text, byte-identical for every call of this version
  fingerprint: string; // sha256 over system text and schema snapshot (4.4; render.ts is covered by its own tests)
}

export interface RenderedPrompt {
  /**
   * Per-user stable block (profile or confirmed facts). Must not contain anything that changes per
   * call. The nonce is the stable userBlockNonce(userId, factsVersion, agentId), so the cached
   * prefix stays byte-identical (7.1, 11.3).
   */
  userBlock?: { text: string; label: DataLabel; nonce?: string };
  /** Short, trusted, per-call parameters written by Kairos code: scope, refine option, ids to act on. */
  task?: string;
  /** Third-party or user-authored text, fenced with the per-call nonce; truncated to maxTokens. */
  untrusted: { label: DataLabel; text: string; maxTokens: number }[];
}

export interface Violation {
  code: string; // e.g. "unknown_fact_id", "too_long", "refine_not_shorter", "injection_echo"
  path: string; // JSON path in the output, e.g. "suggestions[2].factIds[0]"
}

export interface AgentSpec<I, O> {
  id: AgentId;
  stakes: Stakes;
  /** Active version; older versions stay in `prompts` for pinning and rollback (4.5). */
  promptVersion: number;
  prompts: Record<number, PromptAsset>;
  model: ClaudeModel;
  tierUp: { model: "claude-sonnet-5-5"; maxShareOfDailyCalls: number; minDailyAllowance: number; maxCostPerCallUsd: number } | null;
  onFailure: OnFailure;
  thinking: ThinkingMode;
  effort?: Effort | ((input: I) => Effort | undefined);
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  /** The committed schema.snap.json, bundled at build time; the gateway sends it unchanged (2.4). */
  schemaSnapshot: Record<string, unknown>;
  maxTokens: number | ((input: I) => number);
  maxInputTokens: number;
  timeoutMs: number; // per attempt; the first call per (agent, version) per process gets +20 s (grammar compile)
  expectedCostUsd: number;
  maxCostPerCallUsd: number; // per-call refusal threshold (9.2)
  dailyEnvelopeUsd: number; // 9.4
  workspace: "batch" | "interactive";
  budgetClass: BudgetClass;
  batchEligible: "public_only" | "if_zdr_allows" | "never"; // "if_zdr_allows" is reserved; no agent uses it (10.5)
  cache: { static: "5m" | "1h"; user: "5m" | null };
  /** Deterministic checks before any spend. Throws AgentError("precheck_failed") with a Violation list. */
  preCheck?(input: I, ctx: AgentCallContext): Violation[];
  /**
   * Pure render. Takes the context (refinement of B.9.3, recorded here): the stable per-user fence
   * nonce of 11.3 is derived from USER_HASH_KEY and the user id, so render must see them to keep
   * the cached prefix byte-identical (7.1).
   */
  render(input: I, ctx: AgentCallContext): RenderedPrompt;
  /** Deterministic checks after zod (ids in the input set, bounds, consistency). */
  postValidate?(out: O, input: I): Violation[];
  evalSet: string; // "server/evals/<id>/cases.jsonl"
}

export interface AgentCallContext {
  userId?: string; // raw inside the process; hashed before it leaves (metadata, llm_calls)
  applicationId?: string;
  jobId?: string;
  /** Ids used to build the prompt, to rebuild a sample (B.9.8). Optional in P1: legacy callers do not have them yet. */
  inputRefs?: Record<string, string[]>;
  plan?: PlanId;
  feature?: AiFeature; // interactive calls metered by an allowance (F11, enforced by routes from P3)
  budgetClass?: BudgetClass; // overrides spec.budgetClass (fit-scorer on an import is "interactive")
  workspace?: "batch" | "interactive"; // overrides spec.workspace
  traceId?: string;
  deadlineAt?: number; // epoch ms; no retry starts if it cannot finish before this
  signal?: AbortSignal;
}

export type CallKind =
  | "primary" | "retry" | "repair" | "tier_up" | "truth_repair" | "shadow" | "canary" | "audit" | "nightly";

export interface AgentResult<O> {
  data: O;
  model: ClaudeModel;
  promptVersion: number;
  usage: { inputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; outputTokens: number; costUsd: number };
  attempts: number;
  tieredUp: boolean;
  llmCallId: string; // id of the row of the successful send
  totalCostUsd: number; // every attempt of this runAgent
}
