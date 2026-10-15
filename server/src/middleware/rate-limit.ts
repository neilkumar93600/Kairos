import { rateLimit } from "express-rate-limit";

/**
 * In-memory limits are enough for a single api instance. When the api scales past one replica,
 * switch to a Redis store so limits are shared (see docs/02-trd.md, Performance).
 */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
