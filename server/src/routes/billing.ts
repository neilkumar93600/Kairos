import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { BILLING_INTERVALS } from "@auto-career/shared";
import { db } from "../db/client";
import { subscriptions } from "../db/schema";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";
import { priceIdFor, stripe } from "../services/stripe";

/** Stripe Checkout and the customer portal (cancel, pause, change plan). Mounted at /api/billing. */
export const billingRouter = Router();

const checkoutSchema = z.object({ plan: z.enum(["starter", "pro", "max"]), interval: z.enum(BILLING_INTERVALS) });

async function customerIdFor(userId: string, email: string): Promise<string> {
  const [sub] = await db().select().from(subscriptions).where(eq(subscriptions.userId, userId));
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;
  const customer = await stripe().customers.create({ email, metadata: { userId } });
  await db().update(subscriptions).set({ stripeCustomerId: customer.id, updatedAt: new Date() }).where(eq(subscriptions.userId, userId));
  return customer.id;
}

billingRouter.post("/checkout", validateBody(checkoutSchema), async (req, res) => {
  const me = currentUser(req);
  const { plan, interval } = req.body as z.infer<typeof checkoutSchema>;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await customerIdFor(me.id, me.email),
    line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
    client_reference_id: me.id,
    subscription_data: { metadata: { userId: me.id } },
    allow_promotion_codes: true,
    success_url: `${env().WEB_ORIGIN}/billing?checkout=success`,
    cancel_url: `${env().WEB_ORIGIN}/pricing?checkout=cancelled`,
  });
  if (!session.url) throw new HttpError(502, "checkout_failed", "Stripe did not return a checkout URL");
  res.json({ url: session.url });
});

billingRouter.post("/portal", async (req, res) => {
  const me = currentUser(req);
  const portal = await stripe().billingPortal.sessions.create({
    customer: await customerIdFor(me.id, me.email),
    return_url: `${env().WEB_ORIGIN}/billing`,
  });
  res.json({ url: portal.url });
});
