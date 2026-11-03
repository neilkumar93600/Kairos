import express, { Router, type NextFunction, type Request, type Response } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { emailSuppressions, inboundEmails, profiles, stripeEvents, subscriptions, user } from "../db/schema";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";
import { addressHash } from "../lib/mailer";
import { enqueue } from "../jobs/queues";
import { couponIdsOf, fetchStripeState, processStripeEvent } from "../services/billing-events";
import { grantPlanCredits } from "../services/credits";
import { INLINE_REQUEST, stripe, verifyStripeEvent } from "../services/stripe";

/** Provider webhooks. Mounted at /api/webhooks BEFORE express.json(), because Stripe signs the raw body. */
export const webhooksRouter = Router();

/** Constant-time compare that also hides the secret's length: both sides are hashed to 32 bytes first. */
function safeEqual(a: string, b: string): boolean {
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(a), digest(b));
}

// 1 MB: a real event is under 100 KB, but an invoice with many lines can pass Express's 100 KB default.
webhooksRouter.post("/stripe", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const { STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_PREVIOUS } = env();
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const event = verifyStripeEvent(body, req.header("stripe-signature"), [STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_PREVIOUS]);

  // Stripe first, outside the transaction, so a slow Stripe never pins a pooled connection; a failure is a 500 Stripe retries.
  const fetched = await fetchStripeState(event, {
    retrieveSubscription: (id) => stripe().subscriptions.retrieve(id, {}, INLINE_REQUEST),
    listInvoiceLines: (id) => stripe().invoices.listLineItems(id, { limit: 100 }, INLINE_REQUEST).autoPagingToArray({ limit: 1000 }),
    invoiceCouponIds: async (id) => couponIdsOf(await stripe().invoices.retrieve(id, { expand: ["discounts"] }, INLINE_REQUEST)),
  });

  // One transaction: if any effect fails, the event row rolls back too and Stripe's retry processes it again.
  // ponytail: no per-customer ordering, so two events for one customer can commit their snapshots out of order; the
  // stripe_event_created guard and the customer-partitioned queue come with store-then-process (billing-12, billing-19).
  const outcome = await db().transaction((tx) =>
    processStripeEvent(event, fetched, {
      recordEvent: async (id, type) => (await tx.insert(stripeEvents).values({ id, type }).onConflictDoNothing().returning()).length > 0,
      userExists: async (id) => (await tx.select({ id: user.id }).from(user).where(eq(user.id, id))).length > 0,
      userForCustomer: async (customerId) =>
        (await tx.select({ userId: subscriptions.userId }).from(subscriptions).where(eq(subscriptions.stripeCustomerId, customerId)))[0]?.userId ?? null,
      saveSubscription: async ({ userId, values }) => {
        // An unpaid state only overwrites the row when it is about the subscription the row tracks (or none yet),
        // so a late event for an old, cancelled subscription cannot drop a user who has since subscribed again.
        const tracksThis = or(isNull(subscriptions.stripeSubscriptionId), eq(subscriptions.stripeSubscriptionId, values.stripeSubscriptionId));
        // The grace anchor is set on entering past_due and kept while it lasts, so repeated events never extend it.
        const pastDueSince = values.status === "past_due" ? sql`coalesce(${subscriptions.pastDueSince}, now())` : null;
        await tx
          .update(subscriptions)
          .set({ ...values, pastDueSince, updatedAt: new Date() })
          .where(and(eq(subscriptions.userId, userId), values.plan === "free" ? tracksThis : undefined));
      },
      grantCredits: async (grant) => void (await grantPlanCredits(tx, grant)),
    }),
  );
  logger.info({ eventId: event.id, type: event.type, outcome }, "stripe event");
  res.json(outcome === "duplicate" ? { received: true, duplicate: true } : { received: true });
});

const postmarkInbound = z.object({
  MessageID: z.string(),
  From: z.string(),
  OriginalRecipient: z.string().optional(),
  To: z.string(),
  Subject: z.string().default(""),
  TextBody: z.string().default(""),
});

/** Stored mail text is capped here, so a 35 MB reply cannot fill the table; the classifier reads the first 4,000 characters anyway. */
const INBOUND_TEXT_MAX_BYTES = 16_384;

/** Cuts to a UTF-8 byte budget; a character split by the cut decodes to U+FFFD, which is trimmed off the end. */
const capText = (text: string) => Buffer.from(text).subarray(0, INBOUND_TEXT_MAX_BYTES).toString().replace(/\uFFFD+$/, "");

/** The token rides in the query string, so it is checked before any byte of the body is read or inflated. */
function requireInboundToken(req: Request, _res: Response, next: NextFunction) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!safeEqual(token, env().INBOUND_WEBHOOK_SECRET)) throw new HttpError(403, "forbidden", "Bad inbound token");
  next();
}

// Postmark accepts messages up to 35 MB and posts attachments base64-encoded in the JSON, so the body can be larger
// still. A reply (offer or rejection) must never be lost to a size limit, hence 50 MB on this one route, but only
// after the token passes. inflate:false: Postmark sends plain JSON, and a small gzip body must not expand into 50 MB.
// ponytail: the whole body is parsed in memory; stream-parse and drop Attachments if large mail becomes common.
webhooksRouter.post("/inbound-email", requireInboundToken, express.json({ limit: "50mb", inflate: false }), async (req, res) => {
  const parsed = postmarkInbound.safeParse(req.body);
  if (!parsed.success) throw new HttpError(422, "invalid_body", "Some fields are invalid", parsed.error.issues);
  const mail = parsed.data;
  const recipient = (mail.OriginalRecipient ?? mail.To).toLowerCase().match(/[a-z0-9._+-]+@[a-z0-9.-]+/)?.[0];
  const [profile] = recipient ? await db().select({ userId: profiles.userId }).from(profiles).where(eq(profiles.forwardingAddress, recipient)) : [];
  if (!profile) return void res.json({ stored: false });

  const [stored] = await db()
    .insert(inboundEmails)
    .values({ userId: profile.userId, providerMessageId: mail.MessageID, sender: mail.From, subject: mail.Subject, textBody: capText(mail.TextBody) })
    .onConflictDoNothing()
    .returning({ id: inboundEmails.id });
  // A redelivery queues the stored row again while it is unclassified: Postmark retries the 500 of an enqueue that
  // failed after the insert (messaging-08). The job id makes a second add a no-op.
  const [pending] = stored
    ? [stored]
    : await db().select({ id: inboundEmails.id }).from(inboundEmails).where(and(eq(inboundEmails.providerMessageId, mail.MessageID), isNull(inboundEmails.kind)));
  if (pending) await enqueue("classify-email", { inboundEmailId: pending.id }, `classify-${pending.id}`);
  res.json({ stored: Boolean(stored) });
});

/**
 * Postmark's delivery events (messaging-59, WP-44): a spam complaint, a hard bounce that made the address inactive, or a
 * suppression change. Each lands on email_suppressions by address hash, which the notify job checks before every send.
 * A complaint is permanent in Kairos even if Postmark later reactivates the address; any other reactivation lifts it.
 * Configure it on both streams' webhooks as `<API_PUBLIC_ORIGIN>/api/webhooks/postmark-events?token=<POSTMARK_EVENTS_SECRET>`.
 */
const postmarkEvent = z.discriminatedUnion("RecordType", [
  z.object({ RecordType: z.literal("SpamComplaint"), Email: z.string().min(3).max(320) }),
  z.object({ RecordType: z.literal("Bounce"), Email: z.string().min(3).max(320), Inactive: z.boolean().default(false) }),
  z.object({
    RecordType: z.literal("SubscriptionChange"),
    Recipient: z.string().min(3).max(320),
    SuppressSending: z.boolean(),
    SuppressionReason: z.string().nullish(),
  }),
]);

function requireEventsToken(req: Request, _res: Response, next: NextFunction) {
  const secret = env().POSTMARK_EVENTS_SECRET;
  const token = typeof req.query.token === "string" ? req.query.token : "";
  // Unset secret: the route refuses everything rather than accepting an empty token.
  if (!secret || !safeEqual(token, secret)) throw new HttpError(403, "forbidden", "Bad events token");
  next();
}

webhooksRouter.post("/postmark-events", requireEventsToken, express.json({ limit: "256kb", inflate: false }), async (req, res) => {
  const parsed = postmarkEvent.safeParse(req.body);
  // Delivery, open and click events (and anything new) are acknowledged and ignored, so Postmark stops retrying them.
  if (!parsed.success) return void res.json({ recorded: false });
  const e = parsed.data;
  const hash = addressHash(e.RecordType === "SubscriptionChange" ? e.Recipient : e.Email);
  if (e.RecordType === "SpamComplaint" || (e.RecordType === "SubscriptionChange" && e.SuppressSending && e.SuppressionReason === "SpamComplaint")) {
    await db().insert(emailSuppressions).values({ addressHash: hash, reason: "spam_complaint" }).onConflictDoUpdate({ target: emailSuppressions.addressHash, set: { reason: "spam_complaint" } });
  } else if (e.RecordType === "Bounce" ? e.Inactive : e.SuppressSending) {
    const reason = e.RecordType === "Bounce" || e.SuppressionReason === "HardBounce" ? "hard_bounce" : "manual";
    await db().insert(emailSuppressions).values({ addressHash: hash, reason }).onConflictDoNothing();
  } else if (e.RecordType === "SubscriptionChange") {
    await db().delete(emailSuppressions).where(and(eq(emailSuppressions.addressHash, hash), sql`${emailSuppressions.reason} <> 'spam_complaint'`));
  } else {
    return void res.json({ recorded: false });
  }
  logger.info({ recordType: e.RecordType }, "postmark delivery event");
  res.json({ recorded: true });
});
