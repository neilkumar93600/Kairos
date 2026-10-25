import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "route_not_found", "No such route"));
}

/** body-parser errors, by their `type`, so malformed or oversized bodies are a 4xx the sender can act on, not a 500. */
const BODY_ERRORS: Record<string, [status: number, code: string, message: string]> = {
  "entity.parse.failed": [400, "invalid_json", "The request body is not valid JSON"],
  "entity.too.large": [413, "payload_too_large", "The request body is too large"],
};

/** Every error leaves as { error: { code, message, details? } }. Unknown errors never leak internals. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  const parser = err as { type?: string; status?: number; expose?: boolean } | null;
  const known = parser?.type ? BODY_ERRORS[parser.type] : undefined;
  if (known) {
    res.status(known[0]).json({ error: { code: known[1], message: known[2] } });
    return;
  }
  if (parser?.expose && typeof parser.status === "number" && parser.status >= 400 && parser.status < 500) {
    res.status(parser.status).json({ error: { code: "bad_request", message: "The request could not be read" } });
    return;
  }
  logger.error({ err, path: req.path, method: req.method }, "unhandled error");
  res.status(500).json({ error: { code: "internal", message: "Something went wrong on our side" } });
}
