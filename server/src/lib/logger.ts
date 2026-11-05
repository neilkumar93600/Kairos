import { createHmac, randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import pino, { type DestinationStream, type Logger } from "pino";
import { pinoHttp } from "pino-http";
import { userHash } from "../llm/redact";
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
  "*.preview",
  "*.sourceText",
  "*.answers",
  "*.resumeLines",
  "*.coverLetter",
  "*.messages",
];

const MESSAGE_CAP = 500;

/** An error message up to drizzle's `params:` line, capped. Sentry events use the same cut (lib/sentry.ts). */
export const safeMessage = (message: string) => message.split(/\r?\nparams:/)[0]!.slice(0, MESSAGE_CAP);

/**
 * Error serializer for every `err` field. Keeps the type, the code and the message up to drizzle's `params:` line,
 * and drops `params`, `query` and the stack header. The stack is rebuilt from the safe message plus its `at` frames,
 * because V8 puts the message (and drizzle's params) at the top of the stack.
 * A `cause` keeps its type, code and the pg location fields; its message only for a constraint violation (class 23),
 * because pg quotes the offending value in 22P02, enum and json input errors.
 */
export function serializeErr(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { type: typeof err, message: "non-error thrown" };
  const safe = (e: Error) => safeMessage(e.message);
  const field = (e: Error, k: string) => (e as unknown as Record<string, unknown>)[k];
  const message = safe(err);
  const type = err.constructor.name || err.name;
  const out: Record<string, unknown> = { type, message };
  if (field(err, "code") !== undefined) out.code = field(err, "code");
  if (err.stack) out.stack = [`${type}: ${message}`, ...err.stack.split("\n").filter((l) => /^\s+at /.test(l))].join("\n");
  if (err.cause instanceof Error) {
    const c = err.cause;
    const cause: Record<string, unknown> = { type: c.constructor.name };
    for (const k of ["code", "constraint", "table", "column", "routine"]) if (field(c, k) !== undefined) cause[k] = field(c, k);
    if (String(cause.code ?? "").startsWith("23")) cause.message = safe(c);
    out.cause = cause;
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

/** The Postmark inbound route's path secret (05-api 14.3): a path segment, so it is cut like a query string. */
const INBOUND_PATH_SECRET = /(\/postmark\/inbound\/)[^/]*/i;

/**
 * Cuts the query string (the inbound webhook's ?token=, OAuth ?code=, anything a client put there) and the inbound
 * route's path secret before a URL or path reaches the logs, Sentry or a metric label.
 */
export function redactUrl(url: string): string {
  const q = url.indexOf("?");
  return (q === -1 ? url : url.slice(0, q)).replace(INBOUND_PATH_SECRET, "$1:pathSecret");
}

/**
 * The only form of a user id that may appear in a log line: llm_calls.user_hash (llm/redact.ts), so an operator can
 * join a log line to the ledger. USER_HASH_KEY is optional outside the anthropic gateway; without it the id is hashed
 * under a key derived from the auth secret for this one purpose, so a log call never throws (lines then do not join).
 */
export function logUserHash(userId: string): string {
  try {
    return userHash(userId);
  } catch {
    const key = createHmac("sha256", env().BETTER_AUTH_SECRET).update("log-user-hash").digest();
    return createHmac("sha256", key).update(userId).digest("hex").slice(0, 32);
  }
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
    // The uptime checks call both every minute (WP-11); a failing check logs its own line.
    autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/api/health" },
    // pino-http builds its own child logger, so it needs the err serializer too; the parsed query is dropped whole.
    serializers: {
      err: serializeErr,
      req: (req: { url: string }) => Object.assign(req, { url: redactUrl(req.url), query: undefined, params: undefined }),
    },
  });
}
