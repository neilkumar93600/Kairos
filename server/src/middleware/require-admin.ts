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
 * reauth_required. Nothing here reads the request body.
 * ponytail: WP-30 adds a general "fresh session" kind to require-auth.ts; fold this check into it then.
 */
export function requireAdmin(now: () => number = Date.now) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !env().ADMIN_USER_IDS.includes(req.user.id)) return next(new HttpError(404, "route_not_found", "No such route"));
    const [row] = req.sessionId ? await db().select({ createdAt: session.createdAt }).from(session).where(eq(session.id, req.sessionId)) : [];
    if (!row || now() - row.createdAt.getTime() > ADMIN_FRESH_MS) return next(new HttpError(403, "reauth_required", "Sign in again to use the admin tools"));
    next();
  };
}
