import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { session } from "../db/schema";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";

/** An admin session must have signed in within this long. */
export const ADMIN_FRESH_MS = 15 * 60_000;

/**
 * After requireAuth. Fails closed at every step: an empty ADMIN_USER_IDS, or a user not in it, gets the same 404 as a route
 * that does not exist; an admin whose sign-in is older than 15 minutes (or whose session row cannot be read) gets 403
 * reauth_required with details.maxAgeSec. The allowlist check must stay first: a non-admin must never learn that the
 * freshness rule (or the route) exists. The 404 body is byte-identical to a missing route's; its headers also carry the authed chain's no-store and rate-limit headers, which a probe could tell apart. Accepted: it needs a signed-in account and learns only that /api/admin exists, so staleness is only ever reported to a listed admin. Nothing here reads the body.
 * ponytail: WP-30 adds a general "fresh session" kind to require-auth.ts; fold this check into it then.
 */
export function requireAdmin(now: () => number = Date.now) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !env().ADMIN_USER_IDS.includes(req.user.id)) return next(new HttpError(404, "route_not_found", "No such route"));
    const [row] = req.sessionId ? await db().select({ createdAt: session.createdAt }).from(session).where(eq(session.id, req.sessionId)) : [];
    if (!row || now() - row.createdAt.getTime() > ADMIN_FRESH_MS) return next(new HttpError(403, "reauth_required", "Sign in again to use the admin tools", { maxAgeSec: ADMIN_FRESH_MS / 1000 }));
    next();
  };
}
