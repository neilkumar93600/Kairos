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

/** Accepts the session cookie (web, via the /api rewrite) or a bearer token (extension). */
export function requireAuth(gateway: AuthGateway) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const session = await gateway.getSession(fromNodeHeaders(req.headers));
    if (!session) return next(new HttpError(401, "unauthorized", "Sign in to continue"));
    if (!session.user.emailVerified) return next(new HttpError(403, "email_unverified", "Verify your email first"));
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
