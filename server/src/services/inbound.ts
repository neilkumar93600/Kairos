import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { forwardingVerifications, inboundEmails, profiles, type InboundAttachment } from "../db/schema";
import { decrypt, encrypt, type Aad } from "../lib/crypto";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { count } from "../lib/metrics";
import { enqueue } from "../jobs/queues";
import { addNotification, enqueueNotify } from "../jobs/notify";
import { dnsKeyLookup, FORWARDING_CODE_TTL_MS, parseGmailForwardingConfirmation, verifiedDomains, type KeyLookup } from "./forwarding";
import { alignedDomains, atsOfDomain, linkCandidates, parseAddress } from "./linker";

/**
 * Storing a forwarded reply (05-api 14.3, _db/messaging.md 4.7, 4.10), shared by the Postmark route and the legacy
 * ?token= route. One transaction; the classify or forwarding_code job is queued after it commits. Runs as kairos_api,
 * which may insert inbound mail but never update or delete it.
 */

const FROM_MAX = 320;
const SUBJECT_MAX = 500;
const HEADER_VALUE_MAX = 100;
/**
 * Over this the raw message is not read at all, so the mail is simply unauthenticated. Attachments sit base64-encoded in
 * the raw mail, so a real rejection with a 700 KB PDF must fit; two signatures and memoised body hashes keep the work bounded.
 */
export const RAW_EMAIL_MAX = 4 * 1024 * 1024;
const cut = (max: number) => z.string().transform((v) => v.slice(0, max));

/**
 * Only these fields are read; Attachments' content, HtmlBody and every other header are dropped at once. Nothing is
 * refused for its length, because a parse failure loses the mail: real headers run to several KB, so long values are cut
 * and only the header that is read is kept. From keeps its end, where the address is. The structure is still checked.
 */
export const postmarkInboundSchema = z.looseObject({
  MessageID: z.string().min(1).max(100),
  From: z.string().min(3).transform((v) => (v.length > FROM_MAX ? v.slice(-FROM_MAX) : v)),
  OriginalRecipient: cut(320).optional(),
  To: cut(2000),
  Subject: cut(SUBJECT_MAX).default(""),
  TextBody: z.string().default(""),
  Headers: z.preprocess(
    (headers) =>
      Array.isArray(headers) ? headers.filter((h: { Name?: unknown } | null) => typeof h?.Name === "string" && h.Name.toLowerCase() === "x-spam-score") : headers,
    z.array(z.object({ Name: z.string(), Value: cut(HEADER_VALUE_MAX) })).optional(),
  ),
  Attachments: z.array(z.looseObject({ Name: cut(200).default(""), ContentType: cut(200).default(""), ContentLength: z.number().int().min(0).default(0) })).optional(),
  /** Postmark's "Include raw email content" (owner-actions/WP-24.md); read only to verify DKIM. */
  RawEmail: z
    .string()
    .optional()
    .transform((v) => (v !== undefined && v.length > RAW_EMAIL_MAX ? undefined : v)),
});
export type PostmarkInbound = z.infer<typeof postmarkInboundSchema>;

/** Visible rows one user may store in 24 hours (messaging-09): about 3 times the busiest real day. Hidden rows do not count, so junk cannot silence real replies. */
export const FLOOD_CAP = 400;
/** Hidden rows (forged or likely spam) one user may store in 24 hours; they only serve support, for 30 days. */
export const HIDDEN_CAP = 2_000;
/** Gmail confirmations one user may store in 24 hours: each mails them a code, and anyone can point a Gmail at the address. */
export const CONFIRMATION_CAP = 3;
/** X-Spam-Score at or above this restricts automation: no name-only link, no important-reply notification. */
export const SPAM_RESTRICT = 5;
/** At or above this the row is stored hidden and without a body, and deleted after 30 days. */
export const SPAM_HIDE = 8;
/** Plaintext kept of a body (a reply is read in its first 4,000 characters anyway). */
const BODY_MAX_BYTES = 16_384;
const PREVIEW_CHARS = 280;

export const bodyAad = (id: string): Aad => ({ table: "inbound_emails", id, column: "text_body" });
export const previewAad = (id: string): Aad => ({ table: "inbound_emails", id, column: "preview" });

/** Cuts to a UTF-8 byte budget; a character split by the cut decodes to U+FFFD, which is trimmed off the end. */
export const capBody = (text: string) => Buffer.from(text).subarray(0, BODY_MAX_BYTES).toString().replace(/�+$/, "");

/** The first 280 characters (code points) with whitespace collapsed. */
export const previewOf = (body: string) => [...body.replace(/\s+/g, " ").trim()].slice(0, PREVIEW_CHARS).join("");

/** The encrypted body and preview of row `id`, or nulls without DATA_KEKS (development only; production requires it). */
export function encryptBody(id: string, body: string): { textBodyEnc: Buffer | null; previewEnc: Buffer | null } {
  if (!env().DATA_KEKS) return { textBodyEnc: null, previewEnc: null };
  return { textBodyEnc: encrypt(body, bodyAad(id)), previewEnc: encrypt(previewOf(body), previewAad(id)) };
}

/** A row's body: the ciphertext when present, else the legacy plaintext column (rows from before the backfill). */
export function readBody(row: { id: string; textBodyEnc: Buffer | null; textBody: string | null }): string {
  return row.textBodyEnc ? decrypt(row.textBodyEnc, bodyAad(row.id)).toString("utf8") : (row.textBody ?? "");
}

/** The highest X-Spam-Score present: a sender cannot lower Postmark's score by adding a header of its own. */
export function spamScore(headers: PostmarkInbound["Headers"]): number | null {
  const scores = (headers ?? []).filter((h) => h.Name.toLowerCase() === "x-spam-score").map((h) => Number.parseFloat(h.Value));
  const valid = scores.filter(Number.isFinite);
  return valid.length ? Math.max(...valid) : null;
}

export type StoreResult = { stored: boolean; duplicate?: true };

function dropped(reason: string): StoreResult {
  count("inbound.dropped", 1, reason);
  logger.warn({ reason }, "inbound mail dropped");
  return { stored: false };
}

/**
 * The domains signing this mail that could speak for one of the user's applications (linker.signedForApplication), and
 * that align with its From. Nothing else is ever looked up. Never fails the mail: unverified only means unauthenticated.
 */
async function senderVerdict(userId: string, mail: PostmarkInbound, lookup: KeyLookup): Promise<string[]> {
  const fromAddress = parseAddress(mail.From)?.address;
  const host = fromAddress?.split("@")[1];
  if (!mail.RawEmail || !fromAddress || !host) return [];
  try {
    const companyDomains = (await linkCandidates(db(), userId)).flatMap((c) => c.domains);
    const accept = (d: string) => alignedDomains(d, host) && (Boolean(atsOfDomain(d)) || companyDomains.some((c) => alignedDomains(d, c)));
    return await verifiedDomains(mail.RawEmail, { fromAddress, accept }, lookup);
  } catch (err) {
    logger.warn({ err }, "sender verification failed; the mail is stored as unauthenticated");
    return [];
  }
}

/**
 * Files one Postmark message. Kairos's own mail, no profile for the recipient, or the user's flood cap reached: nothing
 * stored, 200 (so Postmark does not retry junk). A redelivery stores nothing and queues the stored row's classification
 * again while it is unclassified (a crash between the insert and the enqueue). Throws on a database or queue failure, which
 * the route answers 500 and Postmark retries.
 */
export async function storeInboundEmail(mail: PostmarkInbound, keyLookup: KeyLookup = dnsKeyLookup): Promise<StoreResult> {
  const fromAddress = parseAddress(mail.From)?.address;
  // A user who forwards all their mail forwards Kairos's digests here too; those are not replies.
  if (fromAddress && fromAddress === parseAddress(env().EMAIL_FROM)?.address) return dropped("own_mail");

  const recipient = (mail.OriginalRecipient || mail.To).toLowerCase().match(/[a-z0-9._+-]+@[a-z0-9.-]+/)?.[0];
  const [profile] = recipient ? await db().select({ userId: profiles.userId }).from(profiles).where(eq(profiles.forwardingAddress, recipient)) : [];
  if (!profile) return dropped("no_profile");
  const userId = profile.userId;

  const existing = await queuePending(mail.MessageID);
  if (existing) return { stored: false, duplicate: true };

  // ponytail: count then insert, so concurrent deliveries can pass a cap by a few rows; pg_advisory_xact_lock(hashtext(user))
  // with the count in the insert transaction makes it exact if that ever matters.
  const [recent] = await db()
    .select({
      visible: sql<number>`count(*) FILTER (WHERE ${inboundEmails.hiddenReason} IS NULL)::int`,
      hidden: sql<number>`count(*) FILTER (WHERE ${inboundEmails.hiddenReason} IS NOT NULL)::int`,
      confirmations: sql<number>`count(*) FILTER (WHERE ${inboundEmails.hiddenReason} = 'forwarding_confirmation')::int`,
    })
    .from(inboundEmails)
    .where(and(eq(inboundEmails.userId, userId), sql`${inboundEmails.receivedAt} > now() - interval '24 hours'`));
  const { visible = 0, hidden: hiddenRows = 0, confirmations = 0 } = recent ?? {};

  const spam = spamScore(mail.Headers);
  const parsed = await parseGmailForwardingConfirmation(
    { from: mail.From, subject: mail.Subject, textBody: mail.TextBody, rawEmail: mail.RawEmail, recipient: recipient! },
    keyLookup,
  );
  const forged = parsed === "forged";
  const confirmation = forged ? null : parsed;
  if (forged) logger.warn({ rawEmail: Boolean(mail.RawEmail) }, "mail claiming Google's forwarding sender has no valid DKIM signature; hidden");
  const hidden = confirmation ? "forwarding_confirmation" : forged || (spam !== null && spam >= SPAM_HIDE) ? "spam" : null;
  if (confirmation && confirmations >= CONFIRMATION_CAP) return dropped("confirmation_cap");
  if (hidden && hiddenRows >= HIDDEN_CAP) return dropped("hidden_cap");
  if (!hidden && visible >= FLOOD_CAP) return dropped("flood_cap");
  if (forged) count("inbound.dropped", 1, mail.RawEmail ? "forged_confirmation" : "unverifiable_confirmation");

  const verified = confirmation ? ["google.com"] : hidden ? [] : await senderVerdict(userId, mail, keyLookup);
  const id = randomUUID();
  const now = new Date();
  const body = capBody(mail.TextBody);
  const plaintext = env().INBOUND_PLAINTEXT_DUAL_WRITE || !env().DATA_KEKS;
  const attachments: InboundAttachment[] = (mail.Attachments ?? []).slice(0, 50).map((a) => ({ name: a.Name, type: a.ContentType, size: a.ContentLength }));

  const inserted = await db().transaction(async (tx) => {
    const [row] = await tx
      .insert(inboundEmails)
      .values({
        id,
        userId,
        providerMessageId: mail.MessageID,
        sender: mail.From,
        // A confirmation's subject carries the code, which must not outlive forwarding_verifications' 3 days.
        subject: confirmation ? "Gmail Forwarding Confirmation" : mail.Subject,
        ...(hidden ? { textBody: null, textBodyEnc: null, previewEnc: null } : { textBody: plaintext ? body : null, ...encryptBody(id, body) }),
        attachments,
        spamScore: spam,
        hiddenReason: hidden,
        verifiedDomains: verified,
        classifiedAt: hidden ? now : null,
        receivedAt: now,
      })
      .onConflictDoNothing({ target: inboundEmails.providerMessageId })
      .returning({ id: inboundEmails.id });
    if (!row || !confirmation) return Boolean(row);

    // The newest code wins, so a stranger's confirmation cannot hide the user's own, but while a code is live a new
    // mail neither takes back "I have set it up" nor moves the state: anyone can point their Gmail at this address.
    const [live] = await tx
      .select({ userId: forwardingVerifications.userId })
      .from(forwardingVerifications)
      .where(and(eq(forwardingVerifications.userId, userId), eq(forwardingVerifications.provider, "gmail"), sql`${forwardingVerifications.expiresAt} > now()`))
      .for("update");
    await tx
      .insert(forwardingVerifications)
      .values({ userId, provider: "gmail", ...confirmation, receivedAt: now, expiresAt: new Date(now.getTime() + FORWARDING_CODE_TTL_MS) })
      .onConflictDoUpdate({
        target: [forwardingVerifications.userId, forwardingVerifications.provider],
        set: {
          code: confirmation.code,
          confirmUrl: confirmation.confirmUrl,
          receivedAt: now,
          expiresAt: new Date(now.getTime() + FORWARDING_CODE_TTL_MS),
          ...(live ? {} : { acknowledgedAt: null }),
        },
      });
    // An active connection stays active: the code is still stored and mailed (_db/messaging.md 6.1).
    if (!live) {
      await tx
        .update(profiles)
        .set({ forwardingState: "awaiting_verification" })
        .where(and(eq(profiles.userId, userId), sql`${profiles.forwardingState} <> 'active'`));
    }
    await addNotification(tx, { userId, kind: "forwarding_code", entityId: String(Math.floor(now.getTime() / 1000)) });
    return true;
  });

  if (!inserted) {
    // Another delivery of the same message won the insert: queue its row if needed, as for any redelivery.
    await queuePending(mail.MessageID);
    return { stored: false, duplicate: true };
  }
  if (confirmation) await enqueueNotify("forwarding_code", `${userId}:gmail:${Math.floor(now.getTime() / 1000)}`, userId);
  else if (!hidden) await enqueue("classify-email", { inboundEmailId: id }, `classify-${id}`);
  count("inbound.stored", 1, hidden ?? "visible");
  return { stored: true };
}

/** For a stored message: queue its classification when it is visible and unclassified. False when not stored. */
async function queuePending(messageId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: inboundEmails.id, pending: sql<boolean>`${inboundEmails.classifiedAt} IS NULL AND ${inboundEmails.kind} IS NULL AND ${inboundEmails.hiddenReason} IS NULL` })
    .from(inboundEmails)
    .where(eq(inboundEmails.providerMessageId, messageId));
  if (!row) return false;
  if (row.pending) await enqueue("classify-email", { inboundEmailId: row.id }, `classify-${row.id}`);
  return true;
}
