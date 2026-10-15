import express, { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";
import { db } from "../db/client";
import { creditLedger, inboundEmails, profiles, stripeEvents, subscriptions } from "../db/schema";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";
import { enqueue } from "../jobs/queues";
import { creditsPerInvoice, planForPriceId, stripe } from "../services/stripe";

/** Provider webhooks. Mounted at /api/webhooks BEFORE express.json(), because Stripe signs the raw body. */
export const webhooksRouter = Router();

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const item = sub.items.data[0];
  const mapped = item ? planForPriceId(item.price.id) : null;
  const userId = sub.metadata.userId;
  if (!userId || !mapped) {
    logger.warn({ subscriptionId: sub.id }, "subscription without userId or known price");
    return;
  }
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  await db()
    .update(subscriptions)
    .set({
      plan: active ? mapped.plan : "free",
      interval: active ? mapped.interval : null,
      status: sub.status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      pausedUntil: sub.pause_collection?.resumes_at ? new Date(sub.pause_collection.resumes_at * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.userId, userId));
}

async function grantInvoiceCredits(invoice: Stripe.Invoice): Promise<void> {
  const line = invoice.lines.data[0];
  const priceId = line?.pricing?.price_details?.price;
  const mapped = typeof priceId === "string" ? planForPriceId(priceId) : null;
  const userId = invoice.parent?.subscription_details?.metadata?.userId;
  if (!invoice.id || !mapped || !userId) {
    logger.warn({ invoiceId: invoice.id }, "paid invoice without a known plan or user");
    return;
  }
  await db()
    .insert(creditLedger)
    .values({ userId, delta: creditsPerInvoice(mapped.plan, mapped.interval), reason: "plan_grant", stripeInvoiceId: invoice.id })
    .onConflictDoNothing();
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

  const fresh = await db().insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning();
  if (fresh.length === 0) return void res.json({ received: true, duplicate: true });

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object);
      break;
    case "invoice.paid":
      await grantInvoiceCredits(event.data.object);
      break;
    default:
      break;
  }
  res.json({ received: true });
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
webhooksRouter.post("/inbound-email", express.json({ limit: "2mb" }), async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!safeEqual(token, env().INBOUND_WEBHOOK_SECRET)) throw new HttpError(401, "unauthorized", "Bad inbound token");

  const mail = postmarkInbound.parse(req.body);
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
