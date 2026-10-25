import express, { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";
import { db } from "../db/client";
import { creditLedger, inboundEmails, profiles, stripeEvents, subscriptions } from "../db/schema";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";
import { enqueue } from "../jobs/queues";
import { processStripeEvent } from "../services/billing-events";
import { INLINE_REQUEST, stripe } from "../services/stripe";

/** Provider webhooks. Mounted at /api/webhooks BEFORE express.json(), because Stripe signs the raw body. */
export const webhooksRouter = Router();

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

webhooksRouter.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  const signature = req.header("stripe-signature");
  if (!secret || !signature) throw new HttpError(400, "bad_signature", "Missing Stripe signature");

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(req.body as Buffer, signature, secret);
  } catch {
    throw new HttpError(400, "bad_signature", "Invalid Stripe signature");
  }

  // One transaction: if any effect fails, the event row rolls back too and Stripe's retry processes it again.
  // ponytail: the Stripe re-fetch runs inside the transaction (bounded by INLINE_REQUEST); move it before the transaction if webhook volume grows.
  const outcome = await db().transaction((tx) =>
    processStripeEvent(event, {
      recordEvent: async (id, type) => (await tx.insert(stripeEvents).values({ id, type }).onConflictDoNothing().returning()).length > 0,
      retrieveSubscription: (id) => stripe().subscriptions.retrieve(id, {}, INLINE_REQUEST),
      saveSubscription: async ({ userId, values }) => {
        // An unpaid state only overwrites the row when it is about the subscription the row tracks (or none yet),
        // so a late event for an old, cancelled subscription cannot drop a user who has since subscribed again.
        const tracksThis = or(isNull(subscriptions.stripeSubscriptionId), eq(subscriptions.stripeSubscriptionId, values.stripeSubscriptionId));
        await tx
          .update(subscriptions)
          .set({ ...values, updatedAt: new Date() })
          .where(and(eq(subscriptions.userId, userId), values.plan === "free" ? tracksThis : undefined));
      },
      grantCredits: async ({ userId, delta, stripeInvoiceId }) => {
        await tx.insert(creditLedger).values({ userId, delta, reason: "plan_grant", stripeInvoiceId }).onConflictDoNothing();
      },
    }),
  );
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

/** Postmark inbound webhook for forwarded replies. The URL carries ?token=INBOUND_WEBHOOK_SECRET. */
// Postmark accepts messages up to 35 MB and posts attachments base64-encoded in the JSON, so the body can be larger
// still. A reply (offer or rejection) must never be lost to a size limit, hence 50 MB on this one route.
// ponytail: the whole body is parsed in memory; stream-parse and drop Attachments if large mail becomes common.
webhooksRouter.post("/inbound-email", express.json({ limit: "50mb" }), async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!safeEqual(token, env().INBOUND_WEBHOOK_SECRET)) throw new HttpError(401, "unauthorized", "Bad inbound token");

  const parsed = postmarkInbound.safeParse(req.body);
  if (!parsed.success) throw new HttpError(422, "invalid_body", "Some fields are invalid", parsed.error.issues);
  const mail = parsed.data;
  const recipient = (mail.OriginalRecipient ?? mail.To).toLowerCase().match(/[a-z0-9._+-]+@[a-z0-9.-]+/)?.[0];
  const [profile] = recipient ? await db().select({ userId: profiles.userId }).from(profiles).where(eq(profiles.forwardingAddress, recipient)) : [];
  if (!profile) return void res.json({ stored: false });

  const [stored] = await db()
    .insert(inboundEmails)
    .values({ userId: profile.userId, providerMessageId: mail.MessageID, sender: mail.From, subject: mail.Subject, textBody: mail.TextBody })
    .onConflictDoNothing()
    .returning({ id: inboundEmails.id });
  if (stored) await enqueue("classify-email", { inboundEmailId: stored.id }, `classify-${stored.id}`);
  res.json({ stored: Boolean(stored) });
});
