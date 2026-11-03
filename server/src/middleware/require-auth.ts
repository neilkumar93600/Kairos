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

/**
 * Accepts the session cookie (web, via the /api rewrite) or a bearer token (extension). "session-fresh" also reads the
 * session with the cookie cache bypassed and refuses a session older than FRESH_SESSION_MAX_AGE_SEC: 403 reauth_required.
 */
export function requireAuth(gateway: AuthGateway, kind: AuthKind = "session") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const fresh = kind === "session-fresh";
    const session = await gateway.getSession(fromNodeHeaders(req.headers), { fresh });
    if (!session) return next(new HttpError(401, "unauthorized", "Sign in to continue"));
    if (!session.user.emailVerified) return next(new HttpError(403, "email_unverified", "Verify your email first"));
    // A gateway that reports no creation time (a test fake) is not aged out; the real one always reports it.
    if (fresh && session.createdAt && Date.now() - session.createdAt.getTime() > FRESH_SESSION_MAX_AGE_SEC * 1000) {
      return next(new HttpError(403, "reauth_required", "Sign in again to continue", { maxAgeSec: FRESH_SESSION_MAX_AGE_SEC }));
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
