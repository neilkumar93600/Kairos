import type Stripe from "stripe";
import type { BillingInterval, PlanId } from "@auto-career/shared";
import { logger } from "../lib/logger";
import { creditsPerInvoice, planForPriceId } from "./stripe";

/**
 * Statuses that keep the paid plan. past_due is a grace period while Stripe retries the card;
 * it grants nothing, because credits only come from a paid invoice.
 */
export const PAID_STATUSES: readonly string[] = ["active", "trialing", "past_due"];

export interface SubscriptionRow {
  userId: string;
  values: {
    plan: PlanId;
    interval: BillingInterval | null;
    status: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    pausedUntil: Date | null;
  };
}

export interface InvoiceGrant {
  userId: string;
  delta: number;
  stripeInvoiceId: string;
}

/** I/O for one Stripe event. The webhook builds these on a single transaction so the dedupe row and the effects commit together. */
export interface StripeEventDeps {
  recordEvent(id: string, type: string): Promise<boolean>;
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  saveSubscription(row: SubscriptionRow): Promise<void>;
  grantCredits(grant: InvoiceGrant): Promise<void>;
}

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

export function subscriptionRow(sub: Stripe.Subscription): SubscriptionRow | null {
  const item = sub.items.data[0];
  const mapped = item ? planForPriceId(item.price.id) : null;
  const userId = sub.metadata.userId;
  if (!userId || !mapped) return null;
  const paid = PAID_STATUSES.includes(sub.status);
  return {
    userId,
    values: {
      plan: paid ? mapped.plan : "free",
      interval: paid ? mapped.interval : null,
      status: sub.status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      pausedUntil: sub.pause_collection?.resumes_at ? new Date(sub.pause_collection.resumes_at * 1000) : null,
    },
  };
}

/**
 * Grants for the first non-proration line with a known plan price. Proration lines carry the OLD plan's price
 * ("Unused time on Starter") and come first after a plan change, so they never decide the grant. An invoice made
 * only of prorations grants nothing; the next renewal invoice grants the new plan's cycle.
 */
export function invoiceGrant(invoice: Stripe.Invoice): InvoiceGrant | null {
  const userId = invoice.parent?.subscription_details?.metadata?.userId;
  const mapped = invoice.lines.data
    .filter((line) => !line.parent?.subscription_item_details?.proration && !line.parent?.invoice_item_details?.proration)
    .map((line) => line.pricing?.price_details?.price)
    .map((price) => (typeof price === "string" ? planForPriceId(price) : null))
    .find((plan) => plan !== null);
  if (!invoice.id || !mapped || !userId) return null;
  return { userId, delta: creditsPerInvoice(mapped.plan, mapped.interval), stripeInvoiceId: invoice.id };
}

/**
 * Records the event, then applies it. Any throw must roll back the caller's transaction, so Stripe's retry
 * finds no event row and processes it again. Subscription events re-fetch the subscription, so a late
 * "updated" can never overwrite a newer "deleted".
 */
export async function processStripeEvent(event: Stripe.Event, deps: StripeEventDeps): Promise<"processed" | "duplicate"> {
  if (!(await deps.recordEvent(event.id, event.type))) return "duplicate";

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const { id } = event.data.object as Stripe.Subscription;
    const row = subscriptionRow(await deps.retrieveSubscription(id));
    if (row) await deps.saveSubscription(row);
    else logger.warn({ subscriptionId: id }, "subscription without userId or known price");
  } else if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const grant = invoiceGrant(invoice);
    if (grant) await deps.grantCredits(grant);
    else logger.warn({ invoiceId: invoice.id }, "paid invoice without a known plan or user");
  }
  return "processed";
}

const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);

export interface CustomerSubscriptionsApi {
  list(customerId: string): Promise<{ id: string; status: string }[]>;
  cancel(subscriptionId: string): Promise<unknown>;
}

/**
 * Runs before an account is deleted so billing never outlives the account. Asks Stripe for every subscription of
 * the customer (a double checkout can leave two live ones; the local row tracks only one) and cancels each live one.
 * A subscription Stripe no longer has is fine; any other Stripe error is rethrown, which aborts the deletion so the
 * user can retry. Returns how many subscriptions it cancelled.
 */
export async function cancelBillingForDeletedUser(customerId: string | null, api: CustomerSubscriptionsApi): Promise<number> {
  if (!customerId) return 0;
  const live = (await api.list(customerId)).filter((s) => !ENDED_STATUSES.has(s.status));
  for (const s of live) {
    try {
      await api.cancel(s.id);
    } catch (err) {
      if ((err as { code?: string } | null)?.code !== "resource_missing") throw err;
    }
  }
  return live.length;
}
