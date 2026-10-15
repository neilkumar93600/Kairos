import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";
const pretty = process.env.NODE_ENV === "development";

export const logger = pino({
  level,
  base: { service: process.env.RAILWAY_SERVICE_NAME ?? "auto-career" },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.otp", "*.token"],
    censor: "[redacted]",
  },
  ...(pretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
});
