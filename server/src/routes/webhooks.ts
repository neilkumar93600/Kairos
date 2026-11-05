import express, { Router, type NextFunction, type Request, type Response } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { deletionTasks, emailSuppressions, stripeEvents, subscriptions, user } from "../db/schema";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";
import { count, slo } from "../lib/metrics";
import { signal } from "../lib/sentry";
import { addressHash } from "../lib/mailer";
import { bodyPermit } from "../middleware/deadline";
import { couponIdsOf, fetchStripeState, processStripeEvent } from "../services/billing-events";
import { grantPlanCredits } from "../services/credits";
import { stripeCustomerHash } from "../services/erasure";
import { optOutOfBroadcast } from "../services/mail-preferences";
import { postmarkInboundSchema, storeInboundEmail } from "../services/inbound";
import { INLINE_REQUEST, stripe, verifyStripeEvent } from "../services/stripe";

/** Provider webhooks. Mounted at /api/webhooks BEFORE express.json(), because Stripe signs the raw body. */
export const webhooksRouter = Router();

/** Constant-time compare that also hides the secret's length: both sides are hashed to 32 bytes first. */
function safeEqual(a: string, b: string): boolean {
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(a), digest(b));
}

// 1 MB: a real event is under 100 KB, but an invoice with many lines can pass Express's 100 KB default.
async function stripeWebhook(req: Request, res: Response) {
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
      customerErased: async (customerId) =>
        (await tx.select({ h: deletionTasks.userHash }).from(deletionTasks).where(eq(deletionTasks.stripeCustomerHash, stripeCustomerHash(customerId)))).length > 0,
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
  slo("s7", true);
  logger.info({ eventId: event.id, type: event.type, outcome }, "stripe event");
  res.json(outcome === "duplicate" ? { received: true, duplicate: true } : { received: true });
}

// S7 counts the events we tried to process: a bad signature (a 4xx) is not one, anything that throws is a miss.
webhooksRouter.post("/stripe", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  try {
    await stripeWebhook(req, res);
  } catch (err) {
    if (!(err instanceof HttpError && err.status < 500)) slo("s7", false);
    throw err;
  }
});

/**
 * Inbound mail, the route Postmark posts to (05-api 14.3): `POST /api/webhooks/postmark/inbound/:pathSecret` behind
 * three checks: the path secret, HTTP Basic credentials embedded in the webhook URL, and TLS. The current and the
 * previous secret and password both pass while a rotation is in progress. Every comparison hashes both sides first
 * (safeEqual), so neither content nor length leaks, and all checks run whatever the first one said. A failure answers
 * exactly as a route that does not exist, before any byte of the body is read; the path is logged as :pathSecret.
 */
function requirePostmarkInbound(req: Request, _res: Response, next: NextFunction) {
  const e = env();
  const auth = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(req.header("authorization") ?? "")?.[1];
  const decoded = auth ? Buffer.from(auth, "base64").toString("utf8") : "";
  const colon = decoded.indexOf(":");
  const [user, password] = colon < 0 ? ["", ""] : [decoded.slice(0, colon), decoded.slice(colon + 1)];
  const oneOf = (value: string, secrets: (string | undefined)[]) => secrets.map((s) => (s ? safeEqual(value, s) : false)).includes(true);
  const configured = Boolean(e.POSTMARK_INBOUND_PATH_SECRET && e.POSTMARK_INBOUND_BASIC_USER && e.POSTMARK_INBOUND_BASIC_PASSWORD);
  const pathOk = oneOf(String(req.params.pathSecret ?? ""), [e.POSTMARK_INBOUND_PATH_SECRET, e.POSTMARK_INBOUND_PATH_SECRET_PREVIOUS]);
  const userOk = oneOf(user, [e.POSTMARK_INBOUND_BASIC_USER]);
  const passwordOk = oneOf(password, [e.POSTMARK_INBOUND_BASIC_PASSWORD, e.POSTMARK_INBOUND_BASIC_PASSWORD_PREVIOUS]);
  if (!(configured && pathOk && userOk && passwordOk && req.protocol === "https")) {
    // Only with the path secret right: a scanner guessing paths cannot raise the alert, and a real mismatch (a rotation
    // that left the password behind, a leaked path) can.
    if (pathOk) signal("inbound_token_rejected");
    throw new HttpError(404, "route_not_found", "No such route");
  }
  next();
}

/** One body over 5 MB at a time per replica (05-api 2.4, 14.3); a second answers 503 and Postmark retries it. */
const LARGE_BODY = 5 * 1024 * 1024;
const largeBodyPermit = bodyPermit(1, 0);
export const largeBodyGate = (req: Request, res: Response, next: NextFunction) => {
  const length = req.headers["content-length"];
  if (length !== undefined && Number(length) <= LARGE_BODY) return next();
  largeBodyPermit(req, res, next);
};

// Postmark accepts messages up to 35 MB and posts attachments base64-encoded in the JSON, so the body can be larger
// still. A reply (offer or rejection) must never be lost to a size limit, hence 50 MB on these routes, but only after
// the credentials pass. inflate:false: Postmark sends plain JSON, and a small gzip body must not expand into 50 MB.
// ponytail: the whole body is parsed in memory; stream-parse and drop Attachments if large mail becomes common.
const inboundJson = express.json({ limit: "50mb", inflate: false });

webhooksRouter.post("/postmark/inbound/:pathSecret", requirePostmarkInbound, largeBodyGate, inboundJson, async (req, res) => {
  const parsed = postmarkInboundSchema.safeParse(req.body);
  // 400 on this route only (05-api 14.3): Postmark retries a non-200 a few times, then marks it "Inbound Error".
  if (!parsed.success) throw new HttpError(400, "invalid_body", "Some fields are invalid", parsed.error.issues.map((i) => i.path.join(".")));
  res.json(await storeInboundEmail(parsed.data));
});

/** The legacy ?token= route (05-api 14.4), checked before any byte of the body is read; same store, one table. */
function requireInboundToken(req: Request, _res: Response, next: NextFunction) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!safeEqual(token, env().INBOUND_WEBHOOK_SECRET)) throw new HttpError(403, "forbidden", "Bad inbound token");
  next();
}

// Kept for the week Postmark is moved to the new URL; removal gate in owner-actions/WP-24.md.
webhooksRouter.post("/inbound-email", requireInboundToken, inboundJson, async (req, res) => {
  count("inbound.legacy_calls");
  logger.warn("legacy inbound route called; point Postmark at /api/webhooks/postmark/inbound/:pathSecret");
  const parsed = postmarkInboundSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(422, "invalid_body", "Some fields are invalid", parsed.error.issues.map((i) => i.path.join(".")));
  const { stored } = await storeInboundEmail(parsed.data);
  res.json({ stored });
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
    MessageStream: z.string().nullish(),
  }),
]);

const HANDLED = new Set<unknown>(["SpamComplaint", "Bounce", "SubscriptionChange"]);

function requireEventsToken(req: Request, _res: Response, next: NextFunction) {
  const secret = env().POSTMARK_EVENTS_SECRET;
  const token = typeof req.query.token === "string" ? req.query.token : "";
  // Unset secret: the route refuses everything rather than accepting an empty token.
  if (!secret || !safeEqual(token, secret)) throw new HttpError(403, "forbidden", "Bad events token");
  next();
}

webhooksRouter.post("/postmark-events", requireEventsToken, express.json({ limit: "256kb", inflate: false }), async (req, res) => {
  // Delivery, open and click events (and anything new) are acknowledged and ignored, so Postmark stops retrying them.
  const recordType = (req.body as { RecordType?: unknown } | undefined)?.RecordType;
  if (!HANDLED.has(recordType)) return void res.json({ recorded: false });
  // A type we act on but cannot read is a format change or a forged call: never a silent 200 that drops a complaint.
  const parsed = postmarkEvent.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ recordType, issues: parsed.error.issues.map((i) => i.path.join(".")) }, "postmark delivery event of a handled type failed its shape check");
    throw new HttpError(422, "invalid_body", "Unreadable delivery event");
  }
  const e = parsed.data;
  // Postmark suppresses a recipient who unsubscribes on a broadcast stream with ManualSuppression. That is an objection
  // to optional mail, not to account mail (sign-in codes, resend links, forwarding codes): it goes through the
  // preferences, never into the address-wide suppression list. A missing stream counts as broadcast: only an event that
  // names another stream is address-wide, so an unsubscribe can never lock a person out of sign-in codes.
  if (e.RecordType === "SubscriptionChange" && e.SuppressSending && e.SuppressionReason === "ManualSuppression" && (e.MessageStream == null || e.MessageStream === env().POSTMARK_BROADCAST_STREAM)) {
    await db().transaction((tx) => optOutOfBroadcast(tx, e.Recipient));
    logger.info({ recordType: e.RecordType, stream: e.MessageStream ?? "(absent, read as broadcast)" }, "postmark broadcast unsubscribe");
    return void res.json({ recorded: true });
  }
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
  logger.info({ recordType: e.RecordType, ...(e.RecordType === "SubscriptionChange" ? { stream: e.MessageStream ?? null, reason: e.SuppressionReason ?? null } : {}) }, "postmark delivery event");
  res.json({ recorded: true });
});
