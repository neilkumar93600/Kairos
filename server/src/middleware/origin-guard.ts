import type { NextFunction, Request, Response } from "express";
import { getSessionCookie } from "better-auth/cookies";
import { fromNodeHeaders } from "better-auth/node";
import { HttpError } from "../lib/errors";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defence in depth (05-api 5.6), behind SameSite=Lax. A write carrying the session cookie must come from one of
 * `allowed` (exact origins), or, with no Origin, say Sec-Fetch-Site same-origin or none; anything else is 403
 * origin_not_allowed. A bearer token is not ambient authority and skips the check; a request with neither credential
 * goes on to fail authentication. Mounted after /api/auth and /api/webhooks, which check their own callers.
 * ponytail: API_PUBLIC_ORIGIN joins `allowed` when the signed-link forms that post to it ship (P6).
 */
export function originGuard(allowed: readonly string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!UNSAFE.has(req.method) || /^bearer /i.test(req.headers.authorization ?? "") || !getSessionCookie(fromNodeHeaders(req.headers))) {
      return next();
    }
    const origin = req.headers.origin;
    const ok = origin === undefined ? ["same-origin", "none"].includes(String(req.headers["sec-fetch-site"])) : allowed.includes(origin);
    next(ok ? undefined : new HttpError(403, "origin_not_allowed", "This request came from a site Kairos does not trust", { origin: origin ?? null }));
  };
}
