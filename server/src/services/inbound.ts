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
import { FORWARDING_CODE_TTL_MS, parseGmailForwardingConfirmation, type KeyLookup } from "./forwarding";

/**
 * Storing a forwarded reply (05-api 14.3, _db/messaging.md 4.7, 4.10), shared by the Postmark route and the legacy
 * ?token= route. One transaction; the classify or forwarding_code job is queued after it commits. Runs as kairos_api,
 * which may insert inbound mail but never update or delete it.
 */

/** Only these fields are read; Attachments' content, HtmlBody and every other header are dropped at once. */
export const postmarkInboundSchema = z.looseObject({
  MessageID: z.string().min(1).max(100),
  From: z.string().min(3).max(320),
  OriginalRecipient: z.string().max(320).optional(),
  To: z.string().max(2000),
  Subject: z.string().max(2000).default(""),
  TextBody: z.string().default(""),
  Headers: z.array(z.object({ Name: z.string().max(200), Value: z.string().max(2000) })).max(500).optional(),
  Attachments: z.array(z.looseObject({ Name: z.string().max(500).default(""), ContentType: z.string().max(200).default(""), ContentLength: z.number().int().min(0).default(0) })).optional(),
  /** Postmark's "Include raw email content" (owner-actions/WP-24.md); read only to verify a Gmail confirmation's DKIM. */
  RawEmail: z.string().optional(),
});
export type PostmarkInbound = z.infer<typeof postmarkInboundSchema>;

/** Rows one user may store in 24 hours (messaging-09): about 3 times the busiest real day. */
export const FLOOD_CAP = 400;
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

/**
 * Files one Postmark message. No profile for the recipient, or the user's flood cap reached: nothing stored, 200 (so
 * Postmark does not retry junk). A redelivery stores nothing and queues the stored row's classification again while
 * it is unclassified (a crash between the insert and the enqueue). Throws on a database or queue failure, which the
 * route answers 500 and Postmark retries.
 */
export async function storeInboundEmail(mail: PostmarkInbound, keyLookup?: KeyLookup): Promise<StoreResult> {
  const recipient = (mail.OriginalRecipient || mail.To).toLowerCase().match(/[a-z0-9._+-]+@[a-z0-9.-]+/)?.[0];
  const [profile] = recipient ? await db().select({ userId: profiles.userId }).from(profiles).where(eq(profiles.forwardingAddress, recipient)) : [];
  if (!profile) {
    count("inbound.dropped", 1, "no_profile");
    return { stored: false };
  }
  const userId = profile.userId;

  const existing = await queuePending(mail.MessageID);
  if (existing) return { stored: false, duplicate: true };

  // ponytail: count then insert, so concurrent deliveries can pass the cap by a few rows; a per-user advisory lock
  // makes it exact if that ever matters.
  const [recent] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(inboundEmails)
    .where(and(eq(inboundEmails.userId, userId), sql`${inboundEmails.receivedAt} > now() - interval '24 hours'`));
  if ((recent?.n ?? 0) >= FLOOD_CAP) {
    count("inbound.dropped", 1, "flood_cap");
    logger.warn({ cap: FLOOD_CAP }, "inbound mail over the per-user flood cap dropped");
    return { stored: false };
  }

  const spam = spamScore(mail.Headers);
  const confirmation = await parseGmailForwardingConfirmation(
    { from: mail.From, subject: mail.Subject, textBody: mail.TextBody, rawEmail: mail.RawEmail },
    keyLookup,
  );
  const hidden = confirmation ? "forwarding_confirmation" : spam !== null && spam >= SPAM_HIDE ? "spam" : null;
  const id = randomUUID();
  const now = new Date();
  const body = capBody(mail.TextBody);
  const plaintext = env().INBOUND_PLAINTEXT_DUAL_WRITE || !env().DATA_KEKS;
  const attachments: InboundAttachment[] = (mail.Attachments ?? []).slice(0, 50).map((a) => ({ name: a.Name.slice(0, 200), type: a.ContentType, size: a.ContentLength }));

  const inserted = await db().transaction(async (tx) => {
    const [row] = await tx
      .insert(inboundEmails)
      .values({
        id,
        userId,
        providerMessageId: mail.MessageID,
        sender: mail.From.slice(0, 320),
        subject: mail.Subject.slice(0, 500),
        ...(hidden ? { textBody: null, textBodyEnc: null, previewEnc: null } : { textBody: plaintext ? body : null, ...encryptBody(id, body) }),
        attachments,
        spamScore: spam,
        hiddenReason: hidden,
        classifiedAt: hidden ? now : null,
        receivedAt: now,
      })
      .onConflictDoNothing({ target: inboundEmails.providerMessageId })
      .returning({ id: inboundEmails.id });
    if (!row || !confirmation) return Boolean(row);

    // A newer confirmation replaces the older code; a Postmark retry writes the same values.
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
          acknowledgedAt: null,
        },
      });
    // An active connection stays active: the code is still stored and mailed (_db/messaging.md 6.1).
    await tx
      .update(profiles)
      .set({ forwardingState: "awaiting_verification" })
      .where(and(eq(profiles.userId, userId), sql`${profiles.forwardingState} <> 'active'`));
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
