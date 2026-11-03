import type { AuthGateway } from "../lib/auth";
import { env } from "../lib/env";
import { requireAuth } from "./require-auth";

/** An admin session must have signed in within this many seconds (the general session-fresh window is a day). */
export const ADMIN_FRESH_SEC = 15 * 60;

/**
 * The admin gate, composed on requireAuth's "session-fresh" path (one session read, cookie cache bypassed, createdAt
 * required): a user outside ADMIN_USER_IDS (or an empty list) gets the 404 of a route that does not exist, checked before
 * anything else; an admin whose sign-in is over 15 minutes old gets 403 reauth_required with details.maxAgeSec. Fails closed.
 * ponytail: the 404 body is byte-identical to a missing route's but its headers also carry the authed chain's no-store and
 * rate-limit headers. Accepted: it takes a signed-in account and reveals only that the prefix exists.
 */
export const requireAdmin = (gateway: AuthGateway) =>
  requireAuth(gateway, "session-fresh", { maxAgeSec: ADMIN_FRESH_SEC, allow: (user) => env().ADMIN_USER_IDS.includes(user.id) });
