import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";
import { BILLING_INTERVALS, type BillingInterval, type PlanId } from "@auto-career/shared";
import { db } from "../db/client";
import { subscriptions } from "../db/schema";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";
import { INLINE_REQUEST, priceIdFor, stripe } from "../services/stripe";

/** Stripe Checkout and the customer portal (cancel, pause, change plan). Mounted at /api/billing. */
export const billingRouter = Router();

const checkoutSchema = z.object({ plan: z.enum(["starter", "pro", "max"]), interval: z.enum(BILLING_INTERVALS) });

/** Same user, plan and interval within five minutes is the same Checkout Session (a double click, a retry). */
export const checkoutIdempotencyKey = (userId: string, plan: PlanId, interval: BillingInterval, now = Date.now()) =>
  `checkout:${userId}:${plan}:${interval}:${Math.floor(now / 300_000)}`;

/**
 * A subscription the user pays for or can fix in the portal (past_due, unpaid, paused): a second checkout would be a
 * second subscription, charged twice. Incomplete ones never started and expire on their own.
 */
export const blocksCheckout = (status: string) => !["incomplete", "incomplete_expired", "canceled"].includes(status);

/** A Stripe failure is 503 billing_unavailable for the web. HttpErrors are not logged, so the cause is logged here. */
async function viaStripe<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!(err instanceof Stripe.errors.StripeError)) throw err;
    logger.warn({ stripeError: { type: err.type, code: err.code, requestId: err.requestId } }, "stripe call failed");
    throw new HttpError(503, "billing_unavailable", "Billing is unavailable right now. Try again in a minute.");
  }
}

/**
 * The user's Stripe customer, created once. The idempotency key gives concurrent clicks the same customer, and the
 * conditional update keeps the first stored id if two ever differ (calls further apart than Stripe's 24-hour key window).
 */
async function customerFor(userId: string, email: string): Promise<{ id: string; isNew: boolean }> {
  const stored = async () => (await db().select({ id: subscriptions.stripeCustomerId }).from(subscriptions).where(eq(subscriptions.userId, userId)))[0]?.id;
  const existing = await stored();
  if (existing) return { id: existing, isNew: false };
  const customer = await stripe().customers.create({ email, metadata: { userId } }, { ...INLINE_REQUEST, idempotencyKey: `customer:${userId}` });
  const saved = await db()
    .update(subscriptions)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(and(eq(subscriptions.userId, userId), isNull(subscriptions.stripeCustomerId)))
    .returning({ userId: subscriptions.userId });
  if (saved.length > 0) return { id: customer.id, isNew: true };
  return { id: (await stored()) ?? customer.id, isNew: false };
}

const portalUrl = async (customer: string) =>
  (await stripe().billingPortal.sessions.create({ customer, return_url: `${env().WEB_ORIGIN}/billing` }, INLINE_REQUEST)).url;

billingRouter.post("/checkout", validateBody(checkoutSchema), async (req, res) => {
  const me = currentUser(req);
  const { plan, interval } = req.body as z.infer<typeof checkoutSchema>;
  const price = priceIdFor(plan, interval);
  const url = await viaStripe(async () => {
    const customer = await customerFor(me.id, me.email);
    // ponytail: two Checkout pages opened before either is paid can both complete; Stripe's "limit customers to one
    // subscription" Checkout setting closes that (owner action, WP-10). This check covers everything after a payment.
    if (!customer.isNew) {
      const { data } = await stripe().subscriptions.list({ customer: customer.id, limit: 10 }, INLINE_REQUEST);
      if (data.some((s) => blocksCheckout(s.status))) {
        const details = { portalUrl: await portalUrl(customer.id) };
        throw new HttpError(409, "already_subscribed", "You already have a plan. Change it in the billing portal", details);
      }
    }
    const session = await stripe().checkout.sessions.create(
      {
        mode: "subscription",
        customer: customer.id,
        line_items: [{ price, quantity: 1 }],
        client_reference_id: me.id,
        subscription_data: { metadata: { userId: me.id } },
        allow_promotion_codes: false,
        success_url: `${env().WEB_ORIGIN}/billing?checkout=success`,
        cancel_url: `${env().WEB_ORIGIN}/pricing?checkout=cancelled`,
      },
      { ...INLINE_REQUEST, idempotencyKey: checkoutIdempotencyKey(me.id, plan, interval) },
    );
    return session.url;
  });
  if (!url) throw new HttpError(502, "checkout_failed", "Stripe did not return a checkout URL");
  res.json({ url });
});

billingRouter.post("/portal", async (req, res) => {
  const me = currentUser(req);
  res.json({ url: await viaStripe(async () => portalUrl((await customerFor(me.id, me.email)).id)) });
});
