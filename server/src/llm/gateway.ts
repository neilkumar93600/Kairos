import { createHash } from "node:crypto";
import { defaultBudget } from "./spend-store";
import type { AgentCallContext, AgentResult, AgentSpec, CallKind, ClaudeModel, DataLabel, RenderedPrompt, Violation } from "../agents/types";
import { Budget } from "./budget";
import * as breaker from "./breaker";
import { createAnthropicClient, type AnthropicLike, type SentResponse } from "./client";
import { AgentError, classifyError, retryAfterMs, retryPolicy, type LlmErrorCode } from "./errors";
import { MAX_PROMPT_TOKENS, estimateCallUsd, estimateInputTokens } from "./estimate";
import { callNonce, echoCanaryHit, fence as fenceBlock } from "./fence";
import { logger } from "../lib/logger";
import { writeCallRow, type CallRow } from "./ledger";
import { acquire, on429, onResponseHeaders, type Permit } from "./limiter";
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

/**
 * The failures a tier-up may follow (2.6, llm-agents-12): a reply that failed validation, ran out of tokens or was
 * refused, or a model that is overloaded. A budget refusal, auth, billing, bad request or injection echo never tiers up:
 * a cheaper model is never substituted for a spent budget and a pricier one never buys past it.
 */
const TIER_UP_ON: ReadonlySet<LlmErrorCode> = new Set(["schema_invalid", "max_tokens", "refusal", "overloaded", "circuit_open"]);

/** Fence labels of user-authored data (11.1 T2), the only text that exempts an echo-canary pattern. */
const USER_LABELS: ReadonlySet<DataLabel> = new Set(["facts", "profile", "resume_text", "resume_lines", "user_note", "user_answer", "saved_answers"]);

export interface GatewayDeps {
  client: (workspace: "interactive" | "batch") => AnthropicLike;
  budget: Budget;
  writeRow: typeof writeCallRow;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Resolves ops flags; kill switches read through this (4.5). api.ts and worker.ts wire lib/flags gatewayFlags. */
  flags: () => GatewayFlags;
}

export interface GatewayFlags {
  llmPaused: boolean;
  batchPaused: boolean;
  disabled: Record<string, boolean>;
  promptPin: Record<string, number>;
  /** model_pin:<agentId> (14.2): the rollback lever for a model change. */
  modelPin?: Record<string, ClaudeModel>;
  /** prompt_canary:<agentId> (4.5): a share of calls on another version. Never for the verifiers. */
  promptCanary?: Record<string, { version: number; percent: number }>;
  /** prompt_shadow:<agentId> (4.5): another version runs too, on the same input; only its metrics are kept. */
  promptShadow?: Record<string, { version: number; percent: number }>;
}

/** The truth-lock gate: a candidate verifier version never decides a verdict, so it runs only in shadow (4.5). */
const NO_CANARY: ReadonlySet<string> = new Set(["claim-verifier", "claim-verifier-escalation"]);

/**
 * The canary and shadow bucket (4.5): int(sha256(userHash + agentId)[0..8], 16) mod 100, by job when there is no user,
 * and never for a call with neither (a share of nothing is not a share).
 */
export function rolloutBucket(agentId: string, ctx: Pick<AgentCallContext, "userId" | "jobId">): number | null {
  const seed = ctx.userId ? userHash(ctx.userId) : ctx.jobId;
  if (!seed) return null;
  return parseInt(sha256(`${seed}${agentId}`).toString("hex").slice(0, 8), 16) % 100;
}

/** The prompt version a call of this agent runs now, without a canary: the pin, else the active version. */
export function activePromptVersion(spec: Pick<AgentSpec<unknown, unknown>, "id" | "promptVersion">): number {
  return deps.flags().promptPin[spec.id] ?? spec.promptVersion;
}

/**
 * For an agent whose versions are separate spec objects (agents/03-fit-scorer.md 9), which object a call should use: the
 * pin, else its canary share, else the caller's default. runAgent then resolves the same version from the same flags
 * inside that object, and records a canary as a canary. A pin to a version with no object fails there, closed.
 */
export function rolloutVersion(agentId: string, fallback: number, ctx: Pick<AgentCallContext, "userId" | "jobId">): number {
  const flags = deps.flags();
  const pinned = flags.promptPin[agentId];
  if (pinned !== undefined) return pinned;
  const canary = flags.promptCanary?.[agentId];
  const bucket = canary ? rolloutBucket(agentId, ctx) : null;
  return canary && bucket !== null && bucket < canary.percent ? canary.version : fallback;
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
  /** Internal: the version a shadow run uses. */
  promptVersion?: number;
  /** Called with the shadow version's output and the production output when a prompt shadow ran (4.5). */
  onShadow?: (shadow: unknown, production: unknown) => void;
}

/** Collapses identical concurrent calls inside one process (7.2); stores nothing after settling. */
const inFlight: Map<string, Promise<unknown>> = new Map();

export async function runAgent<I, O>(spec: AgentSpec<I, O>, input: I, ctx: AgentCallContext, opts: RunOptions = {}): Promise<AgentResult<O>> {
  const key = sha256(`${spec.id}:${spec.promptVersion}:${canonicalJson(input)}:${ctx.userId ?? ""}`).toString("hex");
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<AgentResult<O>>;
  const run = runUncached(spec, input, ctx, opts);
  inFlight.set(key, run);
  let result: AgentResult<O>;
  try {
    result = await run;
  } finally {
    inFlight.delete(key);
  }
  startShadow(spec, input, ctx, opts, result);
  return result;
}

/**
 * The prompt shadow (4.5): after a production success, a share of calls runs the shadow version on the same input, in
 * the background, as call_kind 'shadow' and budget class 'ops'. It runs with no user id, so it never counts against the
 * user's caps or the per-user counters; the global and per-agent spend still see it. Its output only reaches
 * opts.onShadow; a failure is logged. The production result is already returned.
 */
function startShadow<I, O>(spec: AgentSpec<I, O>, input: I, ctx: AgentCallContext, opts: RunOptions, production: AgentResult<O>): void {
  if (opts.callKind === "shadow" || opts.callKind === "truth_repair") return;
  const shadow = deps.flags().promptShadow?.[spec.id];
  if (!shadow || shadow.version === production.promptVersion || !spec.prompts[shadow.version]) return;
  const bucket = rolloutBucket(spec.id, ctx);
  if (bucket === null || bucket >= Math.min(shadow.percent, 5)) return;
  const { signal: _signal, deadlineAt: _deadline, userId: _userId, ...rest } = ctx;
  runUncached(spec, input, { ...rest, budgetClass: "ops" }, { callKind: "shadow", promptVersion: shadow.version }).then(
    (r) => opts.onShadow?.(r.data, production.data),
    (err: unknown) => logger.warn({ agent: spec.id, version: shadow.version, code: (err as { code?: string }).code }, "prompt shadow failed"),
  );
}

async function runUncached<I, O>(spec: AgentSpec<I, O>, input: I, ctx: AgentCallContext, opts: RunOptions): Promise<AgentResult<O>> {
  const d = deps;
  const nonces: string[] = [];

  // The input contract (2.1, llm-agents-v01): bounds such as facts .max(60) hold here, not only on paper. Paths only,
  // never values, in the message.
  const parsedInput = spec.input.safeParse(input);
  if (!parsedInput.success) {
    const paths = parsedInput.error.issues.slice(0, 5).map((i) => `${i.path.map(String).join(".") || "$"}: ${i.code}`);
    throw new AgentError("invalid_request", `${spec.id}: input fails its schema (${paths.join(", ")})`, false);
  }

  // Kill switches (4.5): before any spend.
  const flags = d.flags();
  // A pause holds work back, it does not end it: a defer agent's caller may try again later (4.5). Routes answer 503 either way.
  const defers = spec.onFailure === "defer" || spec.onFailure === "tier_up_then_defer";
  if (flags.llmPaused) throw new AgentError("llm_paused", "all model calls are paused", defers);
  if (flags.disabled[spec.id]) throw new AgentError("agent_disabled", `agent ${spec.id} is disabled`, defers);
  if (spec.workspace === "batch" && flags.batchPaused) throw new AgentError("llm_paused", "batch model work is paused", defers);

  // Deterministic checks before any spend (3.1).
  if (spec.preCheck) {
    const violations = spec.preCheck(input, ctx);
    if (violations.length) throw new AgentError("precheck_failed", `precheck failed for ${spec.id}: ${fmt(violations)}`, false, violations);
  }

  // Resolve version (4.5): a shadow run's own version, else the pin, else a canary bucket, else the active version.
  const pinned = flags.promptPin[spec.id];
  const canary = pinned === undefined && opts.promptVersion === undefined && !NO_CANARY.has(spec.id) ? flags.promptCanary?.[spec.id] : undefined;
  const bucket = canary && spec.prompts[canary.version] ? rolloutBucket(spec.id, ctx) : null;
  const onCanary = canary !== undefined && bucket !== null && bucket < canary.percent;
  const promptVersion = opts.promptVersion ?? pinned ?? (onCanary ? canary.version : spec.promptVersion);
  const callKind: CallKind = opts.callKind ?? (onCanary ? "canary" : "primary");
  const prompt = spec.prompts[promptVersion];
  if (!prompt) throw new AgentError("invalid_request", `prompt version ${promptVersion} of ${spec.id} is not loaded`, false);
  const systemText = prompt.system;
  const promptSha = prompt.fingerprint;

  const rendered = spec.render(input, ctx);
  const variableBlock = variableText(rendered, nonces);
  // The user's own data (T2) may legitimately be quoted back; third-party blocks never exempt a canary pattern.
  const canaryExempt = [rendered.userBlock?.text ?? "", ...rendered.untrusted.filter((b) => USER_LABELS.has(b.label)).map((b) => b.text)].join("\n");

  // Per-call budget estimate (9.2): worst case, every input token uncached.
  // The agent's maxInputTokens (2.2) bounds the whole prompt; the render caps keep a schema-valid input under it.
  const inputTokensEstimate = estimateInputTokens([systemText, rendered.userBlock?.text ?? "", variableBlock]);
  const inputCeiling = Math.min(spec.maxInputTokens, MAX_PROMPT_TOKENS);
  if (inputTokensEstimate > inputCeiling) {
    throw new AgentError("invalid_request", `${spec.id}: estimated prompt ${inputTokensEstimate} tokens is above its ${inputCeiling} ceiling`, false);
  }
  const maxTokens = typeof spec.maxTokens === "function" ? spec.maxTokens(input) : spec.maxTokens;
  const effort = typeof spec.effort === "function" ? spec.effort(input) : spec.effort;

  const workspace = ctx.workspace ?? spec.workspace;
  const budgetClass = ctx.budgetClass ?? spec.budgetClass;

  // model_pin (14.2) replaces the primary model; the tier-up model stays Sonnet.
  let model: ClaudeModel = flags.modelPin?.[spec.id] ?? spec.model;
  let tieredUp = false;
  let totalCostUsd = 0;
  let attempts = 0;
  let lastError: AgentError | null = null;

  // The fallback ladder (2.6): the primary model, then the tier-up model if the spec allows and
  // the share cap permits. Defer throws retryable; fail-closed throws non-retryable.
  for (let chain = 0; chain < 2; chain++) {
    // A model_pin is an operator's rollback: its cap is that model's worst case at this agent's own token ceilings, or a
    // pin to a pricier model would refuse every call. The other budget scopes still apply.
    const primaryCap = model === spec.model ? spec.maxCostPerCallUsd : estimateCallUsd(spec.maxInputTokens, maxTokens, model);
    const perCallCap = chain === 0 ? primaryCap : (spec.tierUp?.maxCostPerCallUsd ?? spec.maxCostPerCallUsd);
    const result = await runOnModel(model, perCallCap, chain === 0 ? callKind : "tier_up");
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
    if (chain === 0 && spec.tierUp && model !== "claude-sonnet-5-5" && TIER_UP_ON.has(lastError.code) && (await d.budget.tierUpAllowed(spec))) {
      model = "claude-sonnet-5-5";
      tieredUp = true;
      continue;
    }
    const retryable = spec.onFailure === "defer" || spec.onFailure === "tier_up_then_defer";
    throw new AgentError(lastError.code, `${spec.id}: ${lastError.message}`, retryable, lastError.violations, lastError.budget);
  }
  throw lastError ?? new AgentError("server_error", `${spec.id}: exhausted`, false);

  async function runOnModel(modelNow: ClaudeModel, maxCostPerCallUsd: number, firstKind: CallKind): Promise<{ ok: true; data: O; usage: AgentResult<O>["usage"]; llmCallId: string } | { ok: false; error: AgentError }> {
    // Budget check before every send (9.3); a refusal writes a budget_stopped row. The tier-up
    // model is judged against the tier-up cap, not the primary cap (2.6).
    const estUsd = estimateCallUsd(inputTokensEstimate, maxTokens, modelNow);
    const decision = await d.budget.checkBudget(spec, { usd: estUsd, model: modelNow }, ctx, maxCostPerCallUsd, callKind);
    if (!decision.ok) {
      await record({
        model: modelNow,
        status: "budget_stopped",
        errorCode: "budget_stopped", // llm_calls_error_code_ck: every row that is not ok names its code
        stopReason: null,
        usage: { input_tokens: 0, output_tokens: 0 },
        costUsd: 0,
        latencyMs: 0,
        callKind: firstKind,
        attempts: attempts + 1,
        tieredUp,
        requestId: null,
        retryAfterSeconds: null,
      });
      return { ok: false, error: new AgentError("budget_stopped", `${spec.id} refused by budget scope ${decision.scope}`, false, undefined, { scope: decision.scope, retryAfter: decision.retryAfter }) };
    }

    // Breaker, then a limiter permit per send (5.3, 6.3).
    if (!breaker.allow(workspace, modelNow)) {
      return { ok: false, error: new AgentError("circuit_open", `circuit open for ${modelNow}`, false) };
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      attempts += 1;
      const sent = await sendWithPermit(modelNow, { attempt, kind: attempt === 1 ? firstKind : "retry", repairTurns: [] });
      if (sent.outcome === "ok") {
        breaker.recordSuccess(workspace, modelNow);
        return { ok: true, data: sent.data, usage: sent.usage, llmCallId: sent.llmCallId };
      }
      if (sent.outcome === "failed") {
        breaker.record(workspace, modelNow, sent.error.code);
        lastError = sent.error;
        if (sent.error.code === "rate_limited") on429(workspace, modelNow); // AIMD on every 429, retried or not (6.3)
        const policy = retryPolicy(sent.error.code, workspace);
        if (attempt - 1 >= policy.retries) break; // no retries left for this class
        if (sent.error.code === "rate_limited") {
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
      const repaired = await sendWithPermit(modelNow, {
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
  }

  /** One send under its own limiter permit: every retry and repair takes an RPM token, and no permit is held while a backoff sleeps. */
  async function sendWithPermit(modelNow: ClaudeModel, a: Parameters<typeof sendOnce>[1]): ReturnType<typeof sendOnce> {
    let permit: Permit;
    try {
      permit = await acquire(workspace, modelNow, workspace === "interactive" ? 2_000 : 30_000);
    } catch {
      return { outcome: "failed", error: new AgentError("limiter_timeout", `limiter timeout for ${modelNow}`, true) };
    }
    try {
      return await sendOnce(modelNow, a);
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
    const echo = echoCanaryHit(parsed.data, nonces.filter(Boolean), canaryExempt);
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

