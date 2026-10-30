import { createHmac, randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import pino, { type DestinationStream, type Logger } from "pino";
import { pinoHttp } from "pino-http";
import { env } from "./env";

const pretty = process.env.NODE_ENV === "development";

/**
 * Secrets that can reach a log line: auth headers, the inbound webhook's ?token=, the OAuth callback's ?code=,
 * and the session cookie and bearer token Better Auth sets on responses.
 */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.query.token",
  "req.query.code",
  'res.headers["set-cookie"]',
  'res.headers["set-auth-token"]',
  'req.headers["stripe-signature"]',
  "*.password",
  "*.otp",
  "*.token",
  // Free text from a resume, an email, an application or a prompt. pino's `*` covers one level, so these catch
  // `{ job: { text } }` but not a bare top-level `text`: never log such a value by name.
  "*.text",
  "*.textBody",
  "*.sourceText",
  "*.answers",
  "*.resumeLines",
  "*.coverLetter",
  "*.messages",
];

const MESSAGE_CAP = 500;

/**
 * Error serializer for every `err` field. Keeps the type, the code and the message up to drizzle's `params:` line,
 * and drops `params`, `query` and the body of any `cause` (a pg error's `detail` quotes the row's values).
 * The stack is rebuilt from the safe message because V8 puts the message at the top of the stack.
 */
export function serializeErr(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { type: typeof err, message: "non-error thrown" };
  const safe = (e: Error) => e.message.split(/\r?\nparams:/)[0]!.slice(0, MESSAGE_CAP);
  const code = (e: Error) => (e as { code?: unknown }).code;
  const message = safe(err);
  const out: Record<string, unknown> = { type: err.constructor.name || err.name, message };
  if (code(err) !== undefined) out.code = code(err);
  if (err.stack) out.stack = err.stack.replace(err.message, message);
  if (err.cause instanceof Error) {
    out.cause = { type: err.cause.constructor.name, message: safe(err.cause), ...(code(err.cause) !== undefined ? { code: code(err.cause) } : {}) };
  }
  return out;
}

export function createLogger(destination?: DestinationStream, level = process.env.LOG_LEVEL ?? "info"): Logger {
  return pino(
    {
      level,
      base: { service: process.env.RAILWAY_SERVICE_NAME ?? "auto-career" },
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      serializers: { err: serializeErr },
      ...(pretty && !destination ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
    },
    destination,
  );
}

export const logger = createLogger();

/** Cuts the query string (the inbound webhook's ?token=, OAuth ?code=, anything a client put there) before a URL reaches the logs. */
export function redactUrl(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

/**
 * The only form of a user id that may appear in a log line: the same HMAC as llm_calls.user_hash (llm/redact.ts),
 * so an operator can join a log line to the ledger. Falls back to the auth secret as key when USER_HASH_KEY is unset
 * (local dev), so a log call never throws.
 */
export function logUserHash(userId: string): string {
  const e = env();
  return createHmac("sha256", e.USER_HASH_KEY ?? e.BETTER_AUTH_SECRET).update(userId).digest("hex").slice(0, 32);
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Accepts a well-formed x-request-id (prevents log injection), else makes one; echoes it on the response. Mount first. */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  (req as Request & { id?: string }).id = id;
  res.setHeader("x-request-id", id);
  next();
}

/** Request logging for the API. The req serializer gets pino's serialized copy, so the live request is untouched. */
export function httpLogger(target: Logger = logger) {
  return pinoHttp({
    logger: target,
    genReqId: (req) => (req as { id?: string }).id ?? randomUUID(),
    autoLogging: { ignore: (req) => req.url === "/health" },
    serializers: { req: (req: { url: string }) => Object.assign(req, { url: redactUrl(req.url) }) },
  });
}
