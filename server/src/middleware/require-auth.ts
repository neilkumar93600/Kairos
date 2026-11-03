import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AuthGateway, SessionUser } from "../lib/auth";
import { HttpError } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

/** A "session-fresh" route (05-api 5.2) needs a session created within this many seconds: it moves money or changes security posture. */
export const FRESH_SESSION_MAX_AGE_SEC = 86_400;

export type AuthKind = "session" | "session-fresh";

export interface AuthOptions {
  /** Age limit for "session-fresh"; default FRESH_SESSION_MAX_AGE_SEC. */
  maxAgeSec?: number;
  /** Whether the age is enforced for this request; default always. The cache bypass (revocation check) never switches off. */
  enforceAge?: () => boolean;
}

/**
 * Accepts the session cookie (web, via the /api rewrite) or a bearer token (extension). "session-fresh" also reads the
 * session with the cookie cache bypassed and refuses a session older than the limit: 403 reauth_required. A session whose
 * creation time is not a Date counts as stale (fails closed): AuthGateway.getSession must report it.
 * `kind` may be a function of the request, so one mount can hold both kinds and the session is read once.
 */
export function requireAuth(gateway: AuthGateway, kind: AuthKind | ((req: Request) => AuthKind) = "session", opts: AuthOptions = {}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const fresh = (typeof kind === "function" ? kind(req) : kind) === "session-fresh";
    const session = await gateway.getSession(fromNodeHeaders(req.headers), { fresh });
    if (!session) return next(new HttpError(401, "unauthorized", "Sign in to continue"));
    if (!session.user.emailVerified) return next(new HttpError(403, "email_unverified", "Verify your email first"));
    if (fresh && (opts.enforceAge?.() ?? true)) {
      const maxAgeSec = opts.maxAgeSec ?? FRESH_SESSION_MAX_AGE_SEC;
      const created = session.createdAt instanceof Date ? session.createdAt.getTime() : Number.NaN;
      if (!(Date.now() - created <= maxAgeSec * 1000)) return next(new HttpError(403, "reauth_required", "Sign in again to continue", { maxAgeSec }));
    }
    req.user = session.user;
    req.sessionId = session.sessionId;
    next();
  };
}

/** Narrows req.user after requireAuth has run. */
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new HttpError(401, "unauthorized", "Sign in to continue");
  return req.user;
}
