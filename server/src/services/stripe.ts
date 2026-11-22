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

/** Stripe's default, stated so a library change can never widen or disable the replay window. */
const SIGNATURE_TOLERANCE_S = 300;

/**
 * Verifies a webhook's raw body against each configured secret in turn (current, then the previous one during a
 * roll). Anything that does not verify, including a missing header or no secret at all, is 400 bad_signature.
 */
export function verifyStripeEvent(body: Buffer, signature: string | undefined, secrets: (string | undefined)[]): Stripe.Event {
  for (const secret of secrets) {
    if (!secret || !signature) continue;
    try {
      return stripe().webhooks.constructEvent(body, signature, secret, SIGNATURE_TOLERANCE_S);
    } catch {
      // try the next secret
    }
  }
  throw new HttpError(400, "bad_signature", "Invalid Stripe signature");
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
 * The two Stripe calls of the offer pause (WP-33, workers/09-billing-events 3.5). Only jobs/offer-pause.ts calls them, and
 * only while the offer_pause_stripe flag is on. The metadata is what the subscription sync reads as pause_source
 * 'offer_email'; the resume clears it ("" unsets a metadata key). Tests pass fakes instead.
 */
export interface OfferPauseStripe {
  pause(subscriptionId: string, idempotencyKey: string): Promise<void>;
  resume(subscriptionId: string): Promise<void>;
}

export const liveOfferPauseStripe: OfferPauseStripe = {
  async pause(subscriptionId, idempotencyKey) {
    await stripe().subscriptions.update(
      subscriptionId,
      { pause_collection: { behavior: "void" }, metadata: { pausedBy: "offer-email" } },
      { ...INLINE_REQUEST, idempotencyKey },
    );
  },
  async resume(subscriptionId) {
    await stripe().subscriptions.update(subscriptionId, { pause_collection: "", metadata: { pausedBy: "" } }, INLINE_REQUEST);
  },
};
