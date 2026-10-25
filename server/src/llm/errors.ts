import { z } from "zod";

/**
 * Error classes of the gateway (03-agent-runtime.md 5.2). Every failure of a send maps to exactly
 * one LlmErrorCode; the code decides retry, breaker counting and escalation.
 */
export type LlmErrorCode =
  | "rate_limited"
  | "spend_limit"
  | "overloaded"
  | "server_error"
  | "timeout"
  | "connection"
  | "conflict"
  | "invalid_request"
  | "request_too_large"
  | "auth"
  | "permission"
  | "billing"
  | "model_not_found"
  | "schema_invalid"
  | "max_tokens"
  | "refusal"
  | "injection_echo"
  | "budget_stopped"
  | "circuit_open"
  | "agent_disabled"
  | "llm_paused"
  | "precheck_failed"
  | "limiter_timeout";

/** Which errors the breaker counts as failures (5.3). */
export const BREAKER_FAILURES: ReadonlySet<LlmErrorCode> = new Set(["overloaded", "server_error", "timeout", "connection"]);

/** Classes the gateway retries on the same model, with their backoff shape (5.2). */
export function retryPolicy(code: LlmErrorCode, workspace: "batch" | "interactive"): { retries: number; backoffMs: (attempt: number) => number } {
  switch (code) {
    case "rate_limited":
      // retry-after honoured by the caller; the backoff here is the fallback when no header came.
      return { retries: 2, backoffMs: (attempt) => Math.min(30_000, 500 * 2 ** attempt) };
    case "overloaded":
    case "server_error":
      return { retries: 2, backoffMs: (attempt) => Math.floor(Math.random() * Math.min(8_000, 1_000 * 2 ** attempt)) };
    case "timeout":
      return { retries: workspace === "batch" ? 1 : 0, backoffMs: () => 1_000 };
    case "connection":
      return { retries: 2, backoffMs: (attempt) => Math.floor(Math.random() * 500 * 2 ** attempt) };
    case "conflict":
      return { retries: 1, backoffMs: () => 1_000 };
    default:
      return { retries: 0, backoffMs: () => 0 };
  }
}

export class AgentError extends Error {
  override name = "AgentError";
  constructor(
    readonly code: LlmErrorCode,
    message: string,
    readonly retryable: boolean = false,
    readonly violations?: { code: string; path: string }[],
  ) {
    super(message);
  }
}

const statusOf = (err: unknown): number | undefined => {
  const s = (err as { status?: unknown } | undefined)?.status;
  return typeof s === "number" ? s : undefined;
};

const errorTypeOf = (err: unknown): string | undefined => {
  const e = (err as { error?: { type?: unknown } } | undefined)?.error;
  return typeof e?.type === "string" ? e.type : undefined;
};

const SPEND_LIMIT_PATTERNS = [
  /^You have reached your specified API usage limits/,
  /^.*workspace API usage limits/,
];

/**
 * Maps any thrown failure to one LlmErrorCode (5.2). Provider error messages are never included in
 * the AgentError message; they can quote request content.
 */
export function classifyError(err: unknown): LlmErrorCode {
  const status = statusOf(err);
  const type = errorTypeOf(err);
  const message = err instanceof Error ? err.message : String(err);
  if (type === "rate_limit_error" && status === 429) return "rate_limited";
  if (status === 429) {
    const details = (err as { error?: { details?: { error_code?: string } } })?.error?.details?.error_code;
    if (details === "enforced_spend_limit_reached") return "spend_limit";
    if (SPEND_LIMIT_PATTERNS.some((p) => p.test(message))) return "spend_limit";
    return "rate_limited";
  }
  if (type === "overloaded_error" || status === 529) return "overloaded";
  if (status === 500 && type === "api_error") return "server_error";
  if (status === 504 && type === "timeout_error") return "server_error";
  if (err instanceof Error && err.name === "AbortError") return "timeout";
  if (type === "timeout_error") return "timeout";
  if (type === "invalid_request_error" || status === 400) {
    if (SPEND_LIMIT_PATTERNS.some((p) => p.test(message))) return "spend_limit";
    if (message.includes("413") || type === "request_too_large") return "request_too_large";
    return "invalid_request";
  }
  if (status === 413) return "request_too_large";
  if (status === 401 || type === "authentication_error") return "auth";
  if (status === 403 || type === "permission_error") return "permission";
  if (status === 402 || type === "billing_error") return "billing";
  if (status === 404 || type === "not_found_error") return "model_not_found";
  if (status === 409 || type === "conflict_error") return "conflict";
  if (err instanceof z.ZodError) return "schema_invalid";
  return "connection";
}

/** Backoff wait for a retry-after header, respecting the workspace ceilings of 5.2. */
export function retryAfterMs(headerSeconds: number | null | undefined, workspace: "batch" | "interactive"): number | null {
  if (headerSeconds === null || headerSeconds === undefined || !Number.isFinite(headerSeconds)) return null;
  const ceiling = workspace === "batch" ? 30_000 : 5_000;
  const wait = headerSeconds * 1_000;
  return wait > ceiling ? null : wait; // null: beyond the ceiling, no retry
}
