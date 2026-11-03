import type { NextFunction, Request, Response } from "express";
import { ipKeyGenerator, rateLimit, type Options, type Store } from "express-rate-limit";
import { getSessionCookie } from "better-auth/cookies";
import { fromNodeHeaders } from "better-auth/node";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";
import { clientIp } from "./client-ip";
import { currentUser } from "./require-auth";

/**
 * Counts one hit on `key` in a fixed window of `windowMs`: one upsert on rate_limits, so every api replica shares the
 * count and a deploy keeps it (05-api 6.1). Returns the count including this hit and the end of the window.
 */
export async function hit(key: string, windowMs: number): Promise<{ count: number; resetAt: Date }> {
  const now = Date.now();
  // ponytail: expired rows are swept on about one hit in a thousand; move to rate_limits_purge() on the worker's
  // housekeeping schedule once that exists (02-database 0004).
  if (Math.random() < 0.001) void db().execute(sql`delete from rate_limits where expire <= ${now}::bigint`).catch(() => {});
  const { rows } = await db().execute<{ points: number; expire: string }>(sql`
    insert into rate_limits (key, points, expire) values (${key}, 1, ${now + windowMs}::bigint)
    on conflict (key) do update set
      points = case when rate_limits.expire <= ${now}::bigint then 1 else rate_limits.points + 1 end,
      expire = case when rate_limits.expire <= ${now}::bigint then excluded.expire else rate_limits.expire end
    returning points, expire`);
  return { count: rows[0]!.points, resetAt: new Date(Number(rows[0]!.expire)) };
}

/** express-rate-limit's store over hit(); `prefix` (the class name) keeps the classes apart in one table. */
class PostgresStore implements Store {
  windowMs = 60_000;
  constructor(readonly prefix: string) {}
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  async increment(key: string) {
    const { count, resetAt } = await hit(this.prefix + key, this.windowMs);
    return { totalHits: count, resetTime: resetAt };
  }
  async decrement(key: string) {
    await db().execute(sql`update rate_limits set points = points - 1 where key = ${this.prefix + key}`);
  }
  async resetKey(key: string) {
    await db().execute(sql`delete from rate_limits where key = ${this.prefix + key}`);
  }
}

/** Store errors go to pino, whose err serializer drops drizzle's params: the key is a client address or a user id. */
const storeLog = {
  error: (err: unknown, message?: string) => logger.error({ err }, message ?? "rate limiter"),
  warn: (err: unknown, message?: string) => logger.warn({ err }, message ?? "rate limiter"),
};

/**
 * A model-backed route's per-minute cap, by user (class `ai_burst`, 10 a minute, 05-api 6.2); one bucket for every such
 * route. The routers that use it are built at import time, before an app exists, so the choice between counting in
 * Postgres (every replica shares it) and in memory (tests) is made per request from `app.locals.sharedLimits`, which
 * createApp sets from the same flag as createLimiters.
 */
export function aiLimiter(bucket = "ai_burst", limit = 10) {
  const make = (store: Store | undefined) =>
    rateLimit({
      limit,
      windowMs: 60_000,
      identifier: bucket,
      keyGenerator: byUser,
      store,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      passOnStoreError: true,
      logger: storeLog,
      handler: (_req, res, next) => {
        const retry = Number(res.getHeader("retry-after"));
        next(new HttpError(429, "rate_limited", "Too many AI requests. Try again in a minute.", { reason: "user_limit", bucket, ...(Number.isFinite(retry) ? { retryAfterSec: retry } : {}) }));
      },
    });
  const inMemory = make(undefined);
  const inPostgres = make(new PostgresStore(`${bucket}:`));
  return (req: Request, res: Response, next: NextFunction) => (req.app.locals.sharedLimits ? inPostgres : inMemory)(req, res, next);
}

/** A session cookie or a bearer token, valid or not. */
export const hasCredentials = (req: Request) => Boolean(req.headers.authorization || getSessionCookie(fromNodeHeaders(req.headers)));

// IPv6 by /56, so rotating addresses inside one allocation is still one client.
const byIp = (req: Request) => ipKeyGenerator(clientIp(req));
const byUser = (req: Request) => currentUser(req).id;

/**
 * The Express limit classes of 05-api 6.2. `shared`: counters in Postgres (production); otherwise in memory per app
 * (tests). Every class fails open on a store error: a database blip must not take the api down with it. The AI-route
 * limiters (aiLimiter below) follow the same switch; auth routes are limited by Better Auth (lib/auth.ts).
 */
export function createLimiters(shared: boolean) {
  const limiter = (bucket: string, limit: number, windowMs: number, byUserId: boolean, skip?: (req: Request, res: Response) => boolean) =>
    rateLimit({
      limit,
      windowMs,
      skip,
      keyGenerator: byUserId ? byUser : byIp,
      identifier: bucket,
      store: shared ? new PostgresStore(`${bucket}:`) : undefined,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      passOnStoreError: true,
      logger: storeLog,
      handler: (_req, res, next) => {
        const retry = Number(res.getHeader("retry-after"));
        const details = { reason: byUserId ? "user_limit" : "ip_limit", bucket, ...(Number.isFinite(retry) ? { retryAfterSec: retry } : {}) };
        next(new HttpError(429, "rate_limited", "Too many requests. Try again later.", details));
      },
    });
  return {
    /**
     * Requests without credentials, by client IP. Signed-in traffic skips it (it meets `user`), so one campus NAT is not
     * one bucket. A credentialed request that ends 401 is counted after the fact (countFailedSignIn).
     */
    anon: limiter("anon", 120, 60_000, false, (req, res) => hasCredentials(req) && !res.locals.signInFailed),
    /** Every signed-in route, by user id. Mounted right after requireAuth. */
    user: limiter("user_api", 600, 60_000, true),
    /** Checkout and portal each create Stripe objects. */
    billing: limiter("billing", 10, 600_000, true, (req) => req.method !== "POST"),
    contact: limiter("contact", 5, 3_600_000, false),
    /** Stripe and Postmark send from shared ranges: this only blunts floods. Runs before any body is read. */
    webhook: limiter("webhook_ip", 600, 60_000, false),
    /** Signed-link pages, GET and POST (WP-44, routes/links.ts): a guessed or replayed link costs its sender here. */
    link: limiter("link", 20, 60_000, false),
  };
}

export type Limiters = ReturnType<typeof createLimiters>;

/** Error middleware: a request whose credentials failed was anonymous after all, so it counts against its IP (05-api 2.1). */
export function countFailedSignIn(limits: Limiters) {
  return (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!(err instanceof HttpError && err.status === 401 && hasCredentials(req))) return next(err);
    res.locals.signInFailed = true;
    limits.anon(req, res, (refused?: unknown) => next(refused ?? err));
  };
}
