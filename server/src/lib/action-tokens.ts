import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { actionTokens, type ACTION_TOKEN_PURPOSES } from "../db/schema";
import type { Keyring } from "./crypto";
import { env } from "./env";

/**
 * Signed links (api-auth-security-50, 05-api 10.4 and 13.5, _db/platform.md 4.10): tamper-proof, expiring and bound to
 * one purpose, one entity and one user.
 *
 * Token: base64url(payload) "." base64url(HMAC-SHA256(key, base64url(payload))), payload JSON
 * { p: purpose, e: entityId, u: userTag, x: expiry in epoch seconds }. userTag is the first 16 bytes of SHA-256 of the
 * user id, so a link never carries the id itself and two users' links for the same entity and expiry differ.
 *
 * Keys: LINK_SIGNING_KEY is a ring like DATA_KEKS (`v2:...,v1:...`). The first entry signs; a token verifies when any
 * entry's HMAC matches, so the version is not in the token and nothing is parsed before the signature checks out.
 * Rotation: prepend a new version, deploy the api and the worker, and drop the old entry once the longest lifetime
 * below (90 days) has passed (docs/runbook/keys.md).
 *
 * Single use: the purposes in action_tokens store only SHA-256(token); consumeActionToken sets used_at once, in the
 * action's transaction. resume_pdf is stateless and reusable until it expires (05-api 13.5), so it has no row.
 */

export type StoredPurpose = (typeof ACTION_TOKEN_PURPOSES)[number];
export type LinkPurpose = StoredPurpose | "resume_pdf";

const DAY = 86_400_000;
/** The longest a link of each purpose may live; action_tokens_lifetime_ck enforces the stored ones again. */
export const LINK_LIFETIME_MS: Record<LinkPurpose, number> = { resend: 7 * DAY, offer_pause_undo: 7 * DAY, unsubscribe: 90 * DAY, resume_pdf: DAY };

export interface LinkClaims {
  purpose: LinkPurpose;
  /** Application id, offer_pause_candidates id or mail kind: at most 64 characters (action_tokens_entity_ck). */
  entityId: string;
  userId: string;
  /** Derive it from the triggering event's time, not now(), so a retried step mints the same token. */
  expiresAt: Date;
}

/** Longer than any token we mint; a longer input is refused before any hashing. */
const MAX_TOKEN = 512;
const B64URL = /^[A-Za-z0-9_-]+$/;

const b64url = (buf: Buffer) => buf.toString("base64url");
const mac = (key: Buffer, payload: string) => b64url(createHmac("sha256", key).update(payload).digest());
export const userTag = (userId: string) => b64url(createHash("sha256").update(userId).digest().subarray(0, 16));

/** The process's link key ring. Throws when LINK_SIGNING_KEY is not set, so no link is minted or accepted without it. */
export function linkKeys(): Keyring {
  const keys = env().LINK_SIGNING_KEY;
  if (!keys) throw new Error("LINK_SIGNING_KEY is not set");
  return keys;
}

export function signLink(claims: LinkClaims, keys: Keyring = linkKeys(), now = Date.now()): string {
  const x = Math.floor(claims.expiresAt.getTime() / 1000);
  if (x * 1000 - now > LINK_LIFETIME_MS[claims.purpose]) throw new Error(`a ${claims.purpose} link cannot outlive its lifetime`);
  if (claims.entityId.length < 1 || claims.entityId.length > 64) throw new Error("a link's entity id is 1 to 64 characters");
  const payload = b64url(Buffer.from(JSON.stringify({ p: claims.purpose, e: claims.entityId, u: userTag(claims.userId), x })));
  return `${payload}.${mac(keys.byVersion.get(keys.current)!, payload)}`;
}

export interface VerifiedLink {
  entityId: string;
  userTag: string;
  expiresAt: Date;
}

/**
 * The claims of a well-formed, correctly signed, unexpired token of `purpose`; null for anything else, without saying
 * which (05-api 10.4: one 410 page for every failure). Does not check single use: see consumeActionToken.
 */
export function verifyLink(token: string, purpose: LinkPurpose, keys: Keyring = linkKeys(), now = Date.now()): VerifiedLink | null {
  if (token.length > MAX_TOKEN) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts as [string, string];
  if (!B64URL.test(payload) || !B64URL.test(sig)) return null;
  // String compare of the canonical encoding: a second spelling of the same signature bytes is refused too.
  const given = Buffer.from(sig);
  const signed = [...keys.byVersion.values()].some((key) => {
    const expected = Buffer.from(mac(key, payload));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
  if (!signed) return null;
  let claims: { p?: unknown; e?: unknown; u?: unknown; x?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (claims.p !== purpose || typeof claims.e !== "string" || typeof claims.u !== "string" || typeof claims.x !== "number") return null;
  if (claims.x * 1000 <= now) return null;
  return { entityId: claims.e, userTag: claims.u, expiresAt: new Date(claims.x * 1000) };
}

/** What action_tokens stores: SHA-256 of the whole token string. */
export const tokenHash = (token: string) => createHash("sha256").update(token).digest();

/** An emailed link on the public api origin (05-api 5.1). Throws without API_PUBLIC_ORIGIN. */
export function linkUrl(path: string, token: string, origin = env().API_PUBLIC_ORIGIN): string {
  if (!origin) throw new Error("API_PUBLIC_ORIGIN is not set");
  return `${origin}${path}?t=${encodeURIComponent(token)}`;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Mints a single-use link and registers it. Idempotent: the same claims give the same token, and a second insert is a
 * no-op. Null when the claims have already expired (a very late retry): there is nothing worth mailing.
 */
export async function issueActionToken(tx: Db | Tx, claims: LinkClaims & { purpose: StoredPurpose }, keys: Keyring = linkKeys()): Promise<string | null> {
  if (claims.expiresAt.getTime() <= Date.now()) return null;
  const token = signLink(claims, keys);
  await tx
    .insert(actionTokens)
    .values({ tokenHash: tokenHash(token), purpose: claims.purpose, entityId: claims.entityId, userId: claims.userId, expiresAt: claims.expiresAt })
    .onConflictDoNothing();
  return token;
}

export interface LinkTarget {
  entityId: string;
  userId: string;
}

/**
 * The target of a live link, for the GET page: reads only, so a mail scanner's GET changes nothing. Unused only, unless
 * `reusable` (an idempotent action such as unsubscribe, whose second click must still work): then a used link counts too.
 */
export async function peekActionToken(tx: Db | Tx, token: string, purpose: StoredPurpose, keys: Keyring = linkKeys(), reusable = false): Promise<LinkTarget | null> {
  const claims = verifyLink(token, purpose, keys);
  if (!claims) return null;
  const [row] = await tx
    .select({ entityId: actionTokens.entityId, userId: actionTokens.userId })
    .from(actionTokens)
    .where(
      and(
        eq(actionTokens.tokenHash, tokenHash(token)),
        eq(actionTokens.purpose, purpose),
        reusable ? undefined : isNull(actionTokens.usedAt),
        gt(actionTokens.expiresAt, sql`now()`),
      ),
    );
  return row && matches(row, claims) ? row : null;
}

/**
 * Uses the link up, once: one conditional UPDATE, so of any number of parallel clicks exactly one gets the target. Run
 * it in the action's own transaction, so a failed action leaves the link usable. Null: forged, expired, used or unknown.
 */
export async function consumeActionToken(tx: Db | Tx, token: string, purpose: StoredPurpose, keys: Keyring = linkKeys()): Promise<LinkTarget | null> {
  const claims = verifyLink(token, purpose, keys);
  if (!claims) return null;
  const [row] = await tx
    .update(actionTokens)
    .set({ usedAt: sql`now()` })
    .where(and(eq(actionTokens.tokenHash, tokenHash(token)), eq(actionTokens.purpose, purpose), isNull(actionTokens.usedAt), gt(actionTokens.expiresAt, sql`now()`)))
    .returning({ entityId: actionTokens.entityId, userId: actionTokens.userId });
  return row && matches(row, claims) ? row : null;
}

const matches = (row: LinkTarget, claims: VerifiedLink) => row.entityId === claims.entityId && userTag(row.userId) === claims.userTag;
