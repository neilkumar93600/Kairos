import { createHash } from "node:crypto";
import { defaultBudget } from "./spend-store";
import type { AgentCallContext, AgentResult, AgentSpec, CallKind, ClaudeModel, RenderedPrompt, Violation } from "../agents/types";
import { Budget } from "./budget";
import * as breaker from "./breaker";
import { createAnthropicClient, type AnthropicLike, type SentResponse } from "./client";
import { AgentError, classifyError, retryAfterMs, retryPolicy, type LlmErrorCode } from "./errors";
import { MAX_PROMPT_TOKENS, estimateCallUsd, estimateInputTokens } from "./estimate";
import { callNonce, echoCanaryHit, fence as fenceBlock } from "./fence";
import { logger } from "../lib/logger";
import { writeCallRow, type CallRow } from "./ledger";
import { acquire, on429, onResponseHeaders } from "./limiter";
import { userHash, userHashBytes } from "./redact";
import { costOf, type Usage } from "./prices";
import { canonicalJson, normalizeEnumCase } from "./schema";

/**
 * runAgent (03-agent-runtime.md 2): the only way any module calls a model. One llm_calls row per
 * send and per budget refusal; at most 1 primary + 2 retries + 1 repair on the primary model, then
 * the same chain on the tier-up model (8 sends, 8 rows). No prompt or completion body, no fact
 * text, no job text and no provider error message ever reaches a log or a row.
 */

const sha256 = (s: string): Buffer => createHash("sha256").update(s, "utf8").digest();

export interface GatewayDeps {
  client: (workspace: "interactive" | "batch") => AnthropicLike;
  budget: Budget;
  writeRow: typeof writeCallRow;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Resolves ops flags; kill switches read through this (4.5). */
  flags: () => { llmPaused: boolean; batchPaused: boolean; disabled: Record<string, boolean>; promptPin: Record<string, number> };
}

/** Set once at process start (api.ts / worker.ts); the default serves the legacy flag and tests. */
export let deps: GatewayDeps = {
  client: (workspace) => createAnthropicClient(workspace), // throws in tests unless ALLOW_LLM_NETWORK=1 (15.1)
  budget: defaultBudget,
  writeRow: writeCallRow,
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  flags: () => ({ llmPaused: false, batchPaused: false, disabled: {}, promptPin: {} }),
};

export function configureGateway(next: Partial<GatewayDeps>): void {
  deps = { ...deps, ...next };
}

export interface RunOptions {
  callKind?: CallKind;
}

/** Collapses identical concurrent calls inside one process (7.2); stores nothing after settling. */
const inFlight: Map<string, Promise<unknown>> = new Map();

export async function runAgent<I, O>(spec: AgentSpec<I, O>, input: I, ctx: AgentCallContext, opts: RunOptions = {}): Promise<AgentResult<O>> {
  const key = sha256(`${spec.id}:${spec.promptVersion}:${canonicalJson(input)}:${ctx.userId ?? ""}`).toString("hex");
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<AgentResult<O>>;
  const run = runUncached(spec, input, ctx, opts);
  inFlight.set(key, run);
  try {
    return await run;
  } finally {
    inFlight.delete(key);
  }
}

async function runUncached<I, O>(spec: AgentSpec<I, O>, input: I, ctx: AgentCallContext, opts: RunOptions): Promise<AgentResult<O>> {
  const d = deps;
  const callKind = opts.callKind ?? "primary";
  const nonces: string[] = [];

  // Kill switches (4.5): before any spend.
  const flags = d.flags();
  if (flags.llmPaused) throw new AgentError("llm_paused", "all model calls are paused", false);
  if (flags.disabled[spec.id]) throw new AgentError("agent_disabled", `agent ${spec.id} is disabled`, false);
  if (spec.workspace === "batch" && flags.batchPaused) throw new AgentError("llm_paused", "batch model work is paused", false);

  // Deterministic checks before any spend (3.1).
  if (spec.preCheck) {
    const violations = spec.preCheck(input, ctx);
    if (violations.length) throw new AgentError("precheck_failed", `precheck failed for ${spec.id}: ${fmt(violations)}`, false, violations);
  }

  // Resolve version (pin overrides the active version, 4.5).
  const promptVersion = flags.promptPin[spec.id] ?? spec.promptVersion;
  const prompt = spec.prompts[promptVersion];
  if (!prompt) throw new AgentError("invalid_request", `prompt version ${promptVersion} of ${spec.id} is not loaded`, false);
  const systemText = prompt.system;
  const promptSha = prompt.fingerprint;

  const rendered = spec.render(input, ctx);
  const variableBlock = variableText(rendered, nonces);

  // Per-call budget estimate (9.2): worst case, every input token uncached.
  const inputTokensEstimate = estimateInputTokens([systemText, rendered.userBlock?.text ?? "", variableBlock]);
  if (inputTokensEstimate > MAX_PROMPT_TOKENS) {
    throw new AgentError("invalid_request", `estimated prompt ${inputTokensEstimate} tokens is above the ${MAX_PROMPT_TOKENS} ceiling`, false);
  }
  const maxTokens = typeof spec.maxTokens === "function" ? spec.maxTokens(input) : spec.maxTokens;
  const effort = typeof spec.effort === "function" ? spec.effort(input) : spec.effort;

  const workspace = ctx.workspace ?? spec.workspace;
  const budgetClass = ctx.budgetClass ?? spec.budgetClass;

  let model: ClaudeModel = spec.model;
  let tieredUp = false;
  let totalCostUsd = 0;
  let attempts = 0;
  let lastError: AgentError | null = null;

  // The fallback ladder (2.6): the primary model, then the tier-up model if the spec allows and
  // the share cap permits. Defer throws retryable; fail-closed throws non-retryable.
  for (let chain = 0; chain < 2; chain++) {
    const perCallCap = chain === 0 ? spec.maxCostPerCallUsd : (spec.tierUp?.maxCostPerCallUsd ?? spec.maxCostPerCallUsd);
    const result = await runOnModel(model, perCallCap);
    if (result.ok) {
      return {
        data: result.data,
        model,
        promptVersion,
        usage: result.usage,
        attempts,
        tieredUp,
        llmCallId: result.llmCallId,
        totalCostUsd,
      };
    }
    lastError = result.error;
    if (chain === 0 && spec.tierUp && model !== "claude-sonnet-5-5" && (await d.budget.tierUpAllowed(spec))) {
      model = "claude-sonnet-5-5";
      tieredUp = true;
      continue;
    }
    const retryable = spec.onFailure === "defer" || spec.onFailure === "tier_up_then_defer";
    throw new AgentError(lastError.code, `${spec.id}: ${lastError.message}`, retryable, lastError.violations);
  }
  throw lastError ?? new AgentError("server_error", `${spec.id}: exhausted`, false);

  async function runOnModel(modelNow: ClaudeModel, maxCostPerCallUsd: number): Promise<{ ok: true; data: O; usage: AgentResult<O>["usage"]; llmCallId: string } | { ok: false; error: AgentError }> {
    // Budget check before every send (9.3); a refusal writes a budget_stopped row. The tier-up
    // model is judged against the tier-up cap, not the primary cap (2.6).
    const estUsd = estimateCallUsd(inputTokensEstimate, maxTokens, modelNow);
    const decision = await d.budget.checkBudget(spec, { usd: estUsd, model: modelNow }, ctx, maxCostPerCallUsd);
    if (!decision.ok) {
      await record({
        model: modelNow,
        status: "budget_stopped",
        errorCode: null,
        stopReason: null,
        usage: { input_tokens: 0, output_tokens: 0 },
        costUsd: 0,
        latencyMs: 0,
        callKind,
        attempts: attempts + 1,
        tieredUp,
        requestId: null,
        retryAfterSeconds: null,
      });
      return { ok: false, error: new AgentError("budget_stopped", `${spec.id} refused by budget scope ${decision.scope}`, false) };
    }

    // Breaker, then limiter (5.3, 6.3).
    if (!breaker.allow(workspace, modelNow)) {
      return { ok: false, error: new AgentError("circuit_open", `circuit open for ${modelNow}`, false) };
    }
    let permit;
    try {
      permit = await acquire(workspace, modelNow, workspace === "interactive" ? 2_000 : 30_000);
    } catch {
      return { ok: false, error: new AgentError("limiter_timeout", `limiter timeout for ${modelNow}`, true) };
    }

    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        attempts += 1;
        const sent = await sendOnce(modelNow, { attempt, kind: attempt === 1 ? callKind : "retry", repairTurns: [] });
        if (sent.outcome === "ok") {
          breaker.recordSuccess(workspace, modelNow);
          return { ok: true, data: sent.data, usage: sent.usage, llmCallId: sent.llmCallId };
        }
        if (sent.outcome === "failed") {
          breaker.record(workspace, modelNow, sent.error.code);
          lastError = sent.error;
          const policy = retryPolicy(sent.error.code, workspace);
          if (attempt - 1 >= policy.retries) break; // no retries left for this class
          if (sent.error.code === "rate_limited") {
            on429(workspace, modelNow);
            const wait = retryAfterMs(sent.retryAfterSeconds, workspace);
            if (wait === null) break; // beyond the workspace ceiling: no retry (5.2)
            await d.sleep(wait);
          } else {
            await d.sleep(policy.backoffMs(attempt));
          }
          continue;
        }
        // sent.outcome === "invalid": at most one repair re-ask on the same model (2.5), never for
        // max_tokens, refusal or injection_echo.
        breaker.recordSuccess(workspace, modelNow);
        if (sent.error.code === "injection_echo") {
          lastError = sent.error;
          break;
        }
        attempts += 1;
        const repaired = await sendOnce(modelNow, {
          attempt: attempts,
          kind: "repair",
          repairTurns: repairTurns(sent.replyText, sent.violations),
        });
        if (repaired.outcome === "ok") {
          return { ok: true, data: repaired.data, usage: repaired.usage, llmCallId: repaired.llmCallId };
        }
        if (repaired.outcome === "failed") {
          breaker.record(workspace, modelNow, repaired.error.code);
          lastError = repaired.error;
        } else {
          lastError = new AgentError(repaired.error.code, `${spec.id}: repair failed validation`, false, repaired.violations);
        }
        break; // the repair was the last chance on this model
      }
      return { ok: false, error: lastError ?? new AgentError("server_error", `${spec.id}: failed`, false) };
    } finally {
      permit.release();
    }
  }

  async function sendOnce(
    modelNow: ClaudeModel,
    a: { attempt: number; kind: CallKind; repairTurns: { role: "assistant" | "user"; content: { type: "text"; text: string }[] }[] },
  ): Promise<
    | { outcome: "ok"; data: O; usage: AgentResult<O>["usage"]; llmCallId: string }
    | { outcome: "failed"; error: AgentError; retryAfterSeconds?: number | null }
    | { outcome: "invalid"; error: AgentError; violations: Violation[]; replyText: string }
  > {
    if (ctx.deadlineAt && d.now() + spec.timeoutMs > ctx.deadlineAt) {
      return { outcome: "failed", error: new AgentError("timeout", `${spec.id}: deadline passed`, false) };
    }
    const body = buildBody(modelNow, systemText, rendered, variableBlock, spec.schemaSnapshot, maxTokens, effort, ctx, a.repairTurns);
    const started = d.now();
    let sent: SentResponse;
    try {
      sent = await d.client(workspace).messages.create(body, { timeout: spec.timeoutMs + 20_000, signal: ctx.signal });
    } catch (err) {
      const code = classifyError(err);
      const headers = (err as { headers?: Record<string, string> }).headers;
      const retryAfterSeconds = headers?.["retry-after"] !== undefined ? Number(headers["retry-after"]) : null;
      await record({
        model: modelNow,
        status: "error",
        errorCode: code,
        stopReason: null,
        usage: { input_tokens: 0, output_tokens: 0 },
        costUsd: 0,
        latencyMs: d.now() - started,
        callKind: a.kind,
        attempts: a.attempt,
        tieredUp,
        requestId: null,
        retryAfterSeconds,
      });
      return { outcome: "failed", error: new AgentError(code, `${spec.id}: ${code}`, retryableCode(code)), retryAfterSeconds };
    }
    const latencyMs = d.now() - started;
    const usage: Usage = sent.data.usage;
    const costUsd = costOf(modelNow, usage, false);
    onResponseHeaders(workspace, modelNow, { requests: sent.rateRemaining.requests, limit: sent.rateLimitRequests });

    if (sent.data.stop_reason === "refusal") {
      await record({ model: modelNow, status: "blocked", errorCode: "refusal", stopReason: "refusal", usage, costUsd, latencyMs, callKind: a.kind, attempts: a.attempt, tieredUp, requestId: sent.requestId, retryAfterSeconds: sent.retryAfterSeconds });
      return { outcome: "failed", error: new AgentError("refusal", `${spec.id}: model refused`, false), retryAfterSeconds: sent.retryAfterSeconds };
    }
    if (sent.data.stop_reason === "max_tokens") {
      await record({ model: modelNow, status: "max_tokens", errorCode: "max_tokens", stopReason: "max_tokens", usage, costUsd, latencyMs, callKind: a.kind, attempts: a.attempt, tieredUp, requestId: sent.requestId, retryAfterSeconds: sent.retryAfterSeconds });
      return { outcome: "failed", error: new AgentError("max_tokens", `${spec.id}: reply truncated`, false) };
    }
    if (sent.data.stop_reason !== "end_turn") {
      await record({ model: modelNow, status: "error", errorCode: "invalid_request", stopReason: sent.data.stop_reason, usage, costUsd, latencyMs, callKind: a.kind, attempts: a.attempt, tieredUp, requestId: sent.requestId, retryAfterSeconds: sent.retryAfterSeconds });
      return { outcome: "failed", error: new AgentError("invalid_request", `${spec.id}: unexpected stop_reason ${sent.data.stop_reason}`, false) };
    }

    const text = sent.data.content.find((b) => b.type === "text")?.text ?? "";
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      await record({ model: modelNow, status: "schema_invalid", errorCode: "invalid_json", stopReason: "end_turn", usage, costUsd, latencyMs, callKind: a.kind, attempts: a.attempt, tieredUp, requestId: sent.requestId, retryAfterSeconds: sent.retryAfterSeconds });
      return { outcome: "invalid", error: new AgentError("schema_invalid", `${spec.id}: invalid JSON`, false), violations: [{ code: "invalid_json", path: "$" }], replyText: text };
    }
    const normalized = normalizeEnumCase(json, spec.output);
    const parsed = spec.output.safeParse(normalized);
    if (!parsed.success) {
      const violations: Violation[] = parsed.error.issues.slice(0, 10).map((i) => ({ code: String(i.code ?? "invalid"), path: i.path.map(String).join(".") || "$" }));
      await record({ model: modelNow, status: "schema_invalid", errorCode: "schema_invalid", stopReason: "end_turn", usage, costUsd, latencyMs, callKind: a.kind, attempts: a.attempt, tieredUp, requestId: sent.requestId, retryAfterSeconds: sent.retryAfterSeconds });
      return { outcome: "invalid", error: new AgentError("schema_invalid", `${spec.id}: ${fmt(violations)}`, false, violations), violations, replyText: text };
    }
    const violations: Violation[] = [...(spec.postValidate ? spec.postValidate(parsed.data, input) : [])];
    const echo = echoCanaryHit(parsed.data, nonces.filter(Boolean));
    if (echo.hit) violations.push({ code: "injection_echo", path: echo.path ?? "$" });
    if (violations.length) {
      const isEcho = violations.some((v) => v.code === "injection_echo");
      await record({ model: modelNow, status: "schema_invalid", errorCode: isEcho ? "injection_echo" : "postvalidate_failed", stopReason: "end_turn", usage, costUsd, latencyMs, callKind: a.kind, attempts: a.attempt, tieredUp, requestId: sent.requestId, retryAfterSeconds: sent.retryAfterSeconds });
      return { outcome: "invalid", error: new AgentError(isEcho ? "injection_echo" : "schema_invalid", `${spec.id}: ${fmt(violations)}`, false, violations), violations, replyText: text };
    }

    const llmCallId = (await record({ model: modelNow, status: "ok", errorCode: null, stopReason: "end_turn", usage, costUsd, latencyMs, callKind: a.kind, attempts: a.attempt, tieredUp, requestId: sent.requestId, retryAfterSeconds: sent.retryAfterSeconds })) ?? "";
    return {
      outcome: "ok",
      data: parsed.data,
      usage: {
        inputTokens: usage.input_tokens,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
        outputTokens: usage.output_tokens,
        costUsd,
      },
      llmCallId,
    };
  }

  /** Writes one llm_calls row and one spend counter update (8.2, 8.3). */
  async function record(r: {
    model: ClaudeModel;
    status: "ok" | "schema_invalid" | "max_tokens" | "blocked" | "error" | "budget_stopped";
    errorCode: string | null;
    stopReason: string | null;
    usage: Usage;
    costUsd: number;
    latencyMs: number;
    callKind: CallKind;
    attempts: number;
    tieredUp: boolean;
    requestId: string | null;
    retryAfterSeconds: number | null;
  }): Promise<string | null> {
    void r.retryAfterSeconds;
    totalCostUsd += r.costUsd;
    const row: CallRow = {
      agentId: spec.id,
      promptVersion,
      promptSha256: Buffer.from(promptSha, "hex"),
      model: r.model,
      workspace,
      isBatch: false,
      plan: ctx.plan ?? null,
      userHash: ctx.userId ? userHashBytes(ctx.userId) : null,
      applicationId: ctx.applicationId ?? null,
      jobId: ctx.jobId ?? null,
      inputRefs: ctx.inputRefs ?? null,      inputHash: sha256(canonicalJson(input)),
      inputTokens: r.usage.input_tokens,
      cacheReadTokens: r.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: r.usage.cache_creation_input_tokens ?? 0,
      outputTokens: r.usage.output_tokens,
      costUsd: r.status === "budget_stopped" ? 0 : r.costUsd,
      latencyMs: r.latencyMs,
      stopReason: r.stopReason,
      status: r.status,
      attempts: r.attempts,
      tieredUp: r.tieredUp,
      errorCode: r.status === "ok" ? null : r.errorCode,
      providerRequestId: r.requestId,
      callKind: r.callKind,
      budgetClass,
      traceId: ctx.traceId ?? null,
    };
    const spend =
      ctx.userId && budgetClass !== "eval"
        ? {
            userId: ctx.userId,
            pipelineUsd: workspace === "batch" ? r.costUsd : 0,
            interactiveUsd: workspace === "interactive" ? r.costUsd : 0,
          }
        : null;
    d.budget.recordSpend(spec.id, ctx, r.costUsd, workspace);
    logger.info(
      {
        agent: spec.id,
        promptVersion,
        model: r.model,
        callKind: r.callKind,
        status: r.status,
        errorCode: r.errorCode ?? undefined,
        inputTokens: r.usage.input_tokens,
        cacheReadTokens: r.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: r.usage.cache_creation_input_tokens ?? 0,
        outputTokens: r.usage.output_tokens,
        usd: r.costUsd,
        ms: r.latencyMs,
        attempts: r.attempts,
        requestId: r.requestId ?? undefined,
      },
      "llm call",
    );
    return d.writeRow(row, spend);
  }
}

function retryableCode(code: LlmErrorCode): boolean {
  return ["rate_limited", "overloaded", "server_error", "timeout", "connection", "conflict", "limiter_timeout"].includes(code);
}

function fmt(violations: Violation[]): string {
  return violations.map((v) => `${v.path}: ${v.code}`).join(", ");
}

function repairTurns(replyText: string, violations: Violation[]): { role: "assistant" | "user"; content: { type: "text"; text: string }[] }[] {
  return [
    { role: "assistant", content: [{ type: "text", text: replyText }] },
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "Your previous reply did not pass validation:\n" +
            violations.slice(0, 10).map((v) => `- ${v.path}: ${v.code}`).join("\n") +
            "\nReturn the complete JSON object again, corrected. Change only what these errors require.",
        },
      ],
    },
  ];
}

/** Assembles the request body: cached static system (breakpoint 1), cached user block (breakpoint 2), variable last, uncached (7.1). */
function buildBody(
  model: ClaudeModel,
  system: string,
  rendered: RenderedPrompt,
  variableBlock: string,
  schemaSnapshot: Record<string, unknown>,
  maxTokens: number,
  effort: string | undefined,
  ctx: AgentCallContext,
  repairTurns: { role: "assistant" | "user"; content: { type: "text"; text: string }[] }[],
): Record<string, unknown> {
  const userContent: Record<string, unknown>[] = [];
  if (rendered.userBlock) {
    userContent.push({ type: "text", text: rendered.userBlock.text, cache_control: { type: "ephemeral" } });
  }
  userContent.push({ type: "text", text: variableBlock });
  return {
    model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }, ...repairTurns],
    output_config: {
      format: { type: "json_schema", schema: schemaSnapshot },
      ...(effort ? { effort } : {}),
    },
    thinking: thinkingFor(model),
    metadata: { user_id: ctx.userId ? userHash(ctx.userId) : undefined },
  };
}

function thinkingFor(model: ClaudeModel): Record<string, string> {
  // Haiku 5.5 accepts disabled; Sonnet 5.5 rejects it and runs between_tools (2.7).
  return model === "claude-haiku-5-5" ? { type: "disabled" } : { type: "between_tools" };
}

/** Task line + fenced per-call blocks, uncached, last (7.1). Registers the nonces for the canary. */
function variableText(rendered: RenderedPrompt, nonces: string[]): string {
  const nonce = callNonce();
  nonces.push(nonce);
  if (rendered.userBlock?.nonce) nonces.push(rendered.userBlock.nonce);
  const parts: string[] = [];
  if (rendered.task) parts.push(rendered.task);
  for (const block of rendered.untrusted) {
    parts.push(fenceBlock(block.label, block.text, nonce, Math.min(block.maxTokens, MAX_PROMPT_TOKENS * 3)));
  }
    return parts.join("\n\n");
}

