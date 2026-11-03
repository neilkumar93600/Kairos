import * as Sentry from "@sentry/node";
import type { NextFunction, Request, Response } from "express";
import { HttpError, nextUtcMidnight } from "../lib/errors";
import { logger, logUserHash } from "../lib/logger";
import { AgentError } from "../llm/errors";
import { LlmError } from "../services/llm";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "route_not_found", "No such route"));
}

/** body-parser errors, by their `type`, so malformed or oversized bodies are a 4xx the sender can act on, not a 500. */
const BODY_ERRORS: Record<string, [status: number, code: string, message: string]> = {
  "entity.parse.failed": [400, "invalid_json", "The request body is not valid JSON"],
  "entity.too.large": [413, "payload_too_large", "The request body is too large"],
};

/**
 * A model failure on a route (03-agent-runtime 5.5, 9.3): 422 ai_refused for a refusal, 429 rate_limited when a budget
 * scope stopped the call (daily_allowance for the user's own caps, service_budget for agent, global and shed), and 503
 * ai_unavailable for everything else. Never a 500, never the internal message.
 */
function aiError(err: AgentError | LlmError): HttpError {
  if (err instanceof AgentError && err.code === "refusal") {
    return new HttpError(422, "ai_refused", "The assistant could not write this one. Try a different line or add a fact.");
  }
  const scope = err instanceof AgentError ? err.budget?.scope : undefined;
  if (scope === "user_pipeline" || scope === "user_interactive") {
    return new HttpError(429, "rate_limited", "You have used today's AI allowance. It resets at 00:00 UTC.", { reason: "daily_allowance", resetsAt: nextUtcMidnight() });
  }
  if (scope === "agent" || scope === "global" || scope === "shed") {
    return new HttpError(429, "rate_limited", "The AI assistant is paused to stay within its daily budget. Try again later.", { reason: "service_budget" });
  }
  return new HttpError(503, "ai_unavailable", "The writing assistant is busy. Try again in a minute.");
}

/** Every error leaves as { error: { code, message, details?, requestId? } }. Unknown errors never leak internals. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = res.getHeader("x-request-id");
  const rid = typeof requestId === "string" ? { requestId } : {};
  if (err instanceof AgentError || err instanceof LlmError) {
    const code = err instanceof AgentError ? err.code : "legacy_client";
    // A bad input or precheck is our bug; the rest is the provider or a budget doing its job.
    const level = code === "invalid_request" || code === "precheck_failed" ? "error" : "warn";
    logger[level]({ aiCode: code, requestId, path: req.path, method: req.method }, "model call failed on a route");
    err = aiError(err);
  }
  if (err instanceof HttpError) {
    res.locals.errorCode = err.code; // for requestMetrics: a designed 503 is not downtime
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details, ...rid } });
    return;
  }
  const parser = err as { type?: string; status?: number; expose?: boolean } | null;
  const known = parser?.type ? BODY_ERRORS[parser.type] : undefined;
  if (known) {
    res.status(known[0]).json({ error: { code: known[1], message: known[2], ...rid } });
    return;
  }
  if (parser?.expose && typeof parser.status === "number" && parser.status >= 400 && parser.status < 500) {
    res.status(parser.status).json({ error: { code: "bad_request", message: "The request could not be read", ...rid } });
    return;
  }
  logger.error({ err, requestId, path: req.path, method: req.method }, "unhandled error");
  // Tags and the userHash only; lib/sentry.ts scrubs the rest. A no-op without SENTRY_DSN.
  Sentry.captureException(err, {
    tags: { requestId: rid.requestId, method: req.method, path: req.path },
    user: req.user ? { id: logUserHash(req.user.id) } : undefined,
  });
  res.status(500).json({ error: { code: "internal", message: "Something went wrong on our side", ...rid } });
}
