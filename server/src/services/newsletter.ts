import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { NewsletterSource } from "@auto-career/shared";
import { db } from "../db/client";
import { newsletterSubscribers as t } from "../db/schema";
import { tokenHash } from "../lib/action-tokens";
import { env } from "../lib/env";
import type { Rendered } from "../jobs/notify";
import { emailHashIfKeyed } from "./erasure";

/**
 * Newsletter sign-ups with double opt-in (WP-50; marketing-surfaces spec, Backend contract). The sign-up stores the
 * address as pending and queues a newsletter_confirm email on the notify ledger (jobs/notify.ts); the worker renders it
 * here, minting the confirm token then, so a token never sits in Redis or a log. Every valid sign-up under the address's
 * daily cap (routes/newsletter.ts) does the same work (one upsert, one enqueue) whatever the address's state, and every
 * one answers the same 202: nothing tells a caller whether an address is on the list.
 *
 * No GET changes anything, because mail scanners open every link: emailed links go to a web page whose button POSTs the
 * token, and the token sits in that URL's fragment, so it never reaches a server or a log.
 *
 * Tokens are 32 bytes, base64url (43 characters), and only their SHA-256 is stored, looked up by hash:
 *  - confirm: random, 7 days, single use (the confirming UPDATE nulls it);
 *  - unsubscribe: HMAC-SHA256(USER_HASH_KEY, "newsletter-unsubscribe:" + id). Derived, so any later newsletter mail can
 *    carry the same link without the database holding the token; USER_HASH_KEY never rotates (lib/mailer.ts).
 */

/** How long a confirm link works. */
export const CONFIRM_LIFETIME = sql`interval '7 days'`;
/** Sign-ups for one address queue at most one confirm email per this window, within the daily cap (routes/newsletter.ts). */
export const CONFIRM_RESEND_INTERVAL = sql`interval '10 minutes'`;

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
/** The token's SHA-256, or null for anything that is not a token we mint (refused before any query). */
export const newsletterTokenHash = (token: unknown): Buffer | null => (typeof token === "string" && TOKEN.test(token) ? tokenHash(token) : null);

export const newConfirmToken = () => randomBytes(32).toString("base64url");

export function unsubscribeToken(subscriberId: string): string {
  const key = env().USER_HASH_KEY;
  if (!key) throw new Error("USER_HASH_KEY is not set");
  return createHmac("sha256", key).update(`newsletter-unsubscribe:${subscriberId}`).digest("base64url");
}

const webOrigin = () => new URL(env().WEB_ORIGIN).origin;
/** A web page with a button that POSTs the token, never a link that acts on GET. */
const webPage = (page: "confirm" | "unsubscribe", token: string) => `${webOrigin()}/newsletter/${page}#token=${token}`;

/** The unsubscribe link for an email's body. */
export const newsletterUnsubscribeUrl = (subscriberId: string) => webPage("unsubscribe", unsubscribeToken(subscriberId));

/**
 * RFC 2369 and RFC 8058 one-click, through the web's /api rewrite: every newsletter email carries both (DKIM must cover
 * them: owner-actions/WP-50.md).
 */
export const newsletterHeaders = (subscriberId: string) => [
  { Name: "List-Unsubscribe", Value: `<${webOrigin()}/api/newsletter/unsubscribe?token=${unsubscribeToken(subscriberId)}>` },
  { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
];

/**
 * Where GET /unsubscribe sends a client that opened the header URL: the web page for a token of our shape, the invalid
 * page for anything else. The shape check keeps caller input out of the Location header; no row is read, so the redirect
 * says nothing about whether the token exists.
 */
export const unsubscribeRedirect = (token: unknown) =>
  typeof token === "string" && TOKEN.test(token) ? webPage("unsubscribe", token) : `${webOrigin()}/newsletter/unsubscribe`;

/**
 * Records a sign-up and returns the notify entity of the confirm email to queue, `<id>:<confirm_seq>`. A new address is
 * pending; an unsubscribed one is pending again (a fresh double opt-in); a pending or confirmed one keeps its state.
 * confirm_seq moves on a re-subscribing address, or a pending one last asked over 10 minutes ago: otherwise the entity
 * is the one already queued, which the ledger sends once, so a confirmed address or a burst gets no new email.
 */
export async function signUp(email: string, source: NewsletterSource): Promise<string> {
  const resubscribe = sql`${t.status} = 'unsubscribed'`;
  const due = sql`(${resubscribe} OR (${t.status} = 'pending' AND ${t.confirmRequestedAt} < now() - ${CONFIRM_RESEND_INTERVAL}))`;
  const [row] = await db()
    .insert(t)
    .values({ email, source, emailHash: emailHashIfKeyed(email) })
    .onConflictDoUpdate({
      target: t.email,
      set: {
        status: sql`CASE WHEN ${resubscribe} THEN 'pending' ELSE ${t.status} END`,
        source: sql`CASE WHEN ${resubscribe} THEN excluded.source ELSE ${t.source} END`,
        confirmedAt: sql`CASE WHEN ${resubscribe} THEN NULL ELSE ${t.confirmedAt} END`,
        unsubscribedAt: sql`CASE WHEN ${resubscribe} THEN NULL ELSE ${t.unsubscribedAt} END`,
        emailHash: sql`coalesce(excluded.email_hash, ${t.emailHash})`,
        confirmSeq: sql`CASE WHEN ${due} THEN ${t.confirmSeq} + 1 ELSE ${t.confirmSeq} END`,
        confirmRequestedAt: sql`CASE WHEN ${due} THEN now() ELSE ${t.confirmRequestedAt} END`,
      },
    })
    .returning({ id: t.id, seq: t.confirmSeq });
  return `${row!.id}:${row!.seq}`;
}

/** Uses a confirm token once: one conditional UPDATE, so of parallel clicks exactly one confirms. False: unknown, used or expired. */
export async function confirmSubscription(token: unknown): Promise<boolean> {
  const hash = newsletterTokenHash(token);
  if (!hash) return false;
  const rows = await db()
    .update(t)
    .set({ status: "confirmed", confirmedAt: sql`now()`, confirmTokenHash: null, confirmExpiresAt: null })
    .where(and(eq(t.confirmTokenHash, hash), eq(t.status, "pending"), gt(t.confirmExpiresAt, sql`now()`)))
    .returning({ id: t.id });
  return rows.length > 0;
}

/** Unsubscribes the address the token names; idempotent (a second use keeps the first time). False: no such token. */
export async function unsubscribe(token: unknown): Promise<boolean> {
  const hash = newsletterTokenHash(token);
  if (!hash) return false;
  const rows = await db()
    .update(t)
    .set({ status: "unsubscribed", unsubscribedAt: sql`coalesce(${t.unsubscribedAt}, now())`, confirmTokenHash: null, confirmExpiresAt: null })
    .where(eq(t.unsubscribeTokenHash, hash))
    .returning({ id: t.id });
  return rows.length > 0;
}

const ENTITY = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([1-9][0-9]{0,8})$/;

/**
 * The newsletter_confirm renderer (registered in jobs/notify.ts RENDERERS). Mints the confirm token and stores its hash
 * (and the unsubscribe token's) in one UPDATE that matches only while the address is pending and this is its latest
 * confirm email; anything else is skipped: confirmed or unsubscribed since, superseded by a newer sign-up, or erased.
 * A retried send renders again with a new token, so only the email that went out last holds a working link.
 */
export async function renderNewsletterConfirm(entityId: string): Promise<Rendered> {
  const m = entityId.match(ENTITY);
  if (!m) return { skip: "bad_entity" };
  const id = m[1]!;
  const confirm = newConfirmToken();
  const [row] = await db()
    .update(t)
    .set({
      confirmTokenHash: tokenHash(confirm),
      confirmExpiresAt: sql`now() + ${CONFIRM_LIFETIME}`,
      unsubscribeTokenHash: tokenHash(unsubscribeToken(id)),
    })
    .where(and(eq(t.id, id), eq(t.status, "pending"), eq(t.confirmSeq, Number(m[2]))))
    .returning({ email: t.email });
  if (!row) return { skip: "not_pending" };
  return {
    to: row.email,
    subject: "Confirm your Kairos newsletter subscription",
    text: [
      "Someone, hopefully you, asked for the Kairos newsletter at this address.",
      "",
      `Confirm your subscription: ${webPage("confirm", confirm)}`,
      "",
      "The link works once, for 7 days. If you did not ask for this, ignore this email: you will not be subscribed, and",
      "we delete the address within 30 days.",
      "",
      `Unsubscribe: ${newsletterUnsubscribeUrl(id)}`,
    ].join("\n"),
    headers: newsletterHeaders(id),
  };
}
