import pino, { type DestinationStream, type Logger } from "pino";
import { pinoHttp } from "pino-http";

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
  "*.password",
  "*.otp",
  "*.token",
];

export function createLogger(destination?: DestinationStream, level = process.env.LOG_LEVEL ?? "info"): Logger {
  return pino(
    {
      level,
      base: { service: process.env.RAILWAY_SERVICE_NAME ?? "auto-career" },
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      ...(pretty && !destination ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
    },
    destination,
  );
}

export const logger = createLogger();

/** Masks secrets that travel in query strings (the inbound webhook's ?token=) before a URL reaches the logs. */
export function redactUrl(url: string): string {
  return url.replace(/([?&](?:token|code)=)[^&]*/gi, "$1[redacted]");
}

/** Request logging for the API. The req serializer gets pino's serialized copy, so the live request is untouched. */
export function httpLogger(target: Logger = logger) {
  return pinoHttp({
    logger: target,
    autoLogging: { ignore: (req) => req.url === "/health" },
    serializers: { req: (req: { url: string }) => Object.assign(req, { url: redactUrl(req.url) }) },
  });
}
