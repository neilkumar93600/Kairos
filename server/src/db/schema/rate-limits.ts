import { bigint, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";

/**
 * Rate-limit counters shared by every api replica and kept across deploys (05-api 6; 02-database 7.6.15 and R-16).
 * Migration 0003 creates both UNLOGGED, which drizzle-kit cannot express: a database crash empties them, by design.
 */

/** The Express classes and the per-email auth limits (middleware/rate-limit.ts). Same shape as rate-limiter-flexible's table. */
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 255 }).primaryKey(),
  points: integer("points").notNull().default(0),
  /** Epoch milliseconds when the window ends. */
  expire: bigint("expire", { mode: "number" }),
});

/** Better Auth's own per-IP, per-path limiter (rateLimit.storage = "database"); it prunes its rows itself. */
export const authRateLimit = pgTable("auth_rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique("auth_rate_limit_key_uq"),
  count: integer("count").notNull(),
  /** Epoch milliseconds. */
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
