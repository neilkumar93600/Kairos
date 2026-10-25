import Stripe from "stripe";
import { BILLING_INTERVALS, creditsPerInvoice, PLAN_IDS, type BillingInterval, type PlanId } from "@auto-career/shared";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";

let client: Stripe | undefined;

/**
 * For Stripe calls made while holding a DB transaction or a user's request (webhook re-fetch, delete-account cancel).
 * The SDK default is an 80 s timeout with 2 retries, which could pin a pooled connection for minutes; Stripe
 * redelivers webhooks and the user can retry a delete, so fail fast instead.
 */
export const INLINE_REQUEST = { timeout: 10_000, maxNetworkRetries: 0 } satisfies Stripe.RequestOptions;

export function stripe(): Stripe {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new HttpError(503, "billing_unavailable", "Billing is not configured");
  client ??= new Stripe(key);
  return client;
}

export function priceIdFor(plan: PlanId, interval: BillingInterval): string {
  const id = env().STRIPE_PRICES[`${plan}:${interval}`];
  if (!id) throw new HttpError(400, "price_unavailable", `No ${interval} price for the ${plan} plan`);
  return id;
}

/** Reverse lookup used by the webhook to learn which plan a subscription is on. */
export function planForPriceId(priceId: string): { plan: PlanId; interval: BillingInterval } | null {
  for (const [key, value] of Object.entries(env().STRIPE_PRICES)) {
    if (value !== priceId) continue;
    const [plan, interval] = key.split(":");
    if (PLAN_IDS.includes(plan as PlanId) && BILLING_INTERVALS.includes(interval as BillingInterval)) {
      return { plan: plan as PlanId, interval: interval as BillingInterval };
    }
  }
  return null;
}

// The grant math lives in shared so the landing calculator and billing cannot drift; re-exported for existing callers.
export { creditsPerInvoice };

/**
 * Pauses collection when an offer email arrives, so nobody is charged after landing the job.
 * The user resumes from the billing portal; the subscription webhook syncs the paused state.
 */
export async function pauseForOffer(stripeSubscriptionId: string): Promise<void> {
  await stripe().subscriptions.update(stripeSubscriptionId, {
    pause_collection: { behavior: "void" },
    metadata: { pausedBy: "offer-email" },
  });
}
