import type Stripe from "stripe";
import type { BillingInterval, PlanId } from "@auto-career/shared";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { creditsPerInvoice, planForPriceId } from "./stripe";

/**
 * Statuses that keep the paid plan. past_due is a grace period while Stripe retries the card;
 * it grants nothing, because credits only come from a paid invoice.
 */
export const PAID_STATUSES: readonly string[] = ["active", "trialing", "past_due"];

/** How long a failed renewal keeps the paid plan (D-17), counted from subscriptions.past_due_since. */
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The plan a user may use right now. The stored plan stays the subscribed one while past_due, so a card fixed on
 * day 8 restores it at once; the gates read this instead. No anchor counts as expired, like SQL effective_plan().
 */
export function effectivePlan(row: { plan: PlanId; status: string; pastDueSince?: Date | null }, now = new Date()): PlanId {
  if (row.status === "active" || row.status === "trialing") return row.plan;
  if (row.status === "past_due" && row.pastDueSince && now.getTime() < row.pastDueSince.getTime() + PAST_DUE_GRACE_MS) return row.plan;
  return "free";
}

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

/** Stripe calls an event needs, made BEFORE the transaction so no pooled connection waits on Stripe. */
export interface StripeFetchDeps {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  /** Every line of an invoice whose inline list was cut short (has_more). */
  listInvoiceLines(invoiceId: string): Promise<Stripe.InvoiceLineItem[]>;
  /** Coupon ids behind the invoice's discounts; the event carries discount ids only. */
  invoiceCouponIds(invoiceId: string): Promise<string[]>;
}

export interface FetchedStripeState {
  subscription?: Stripe.Subscription;
  lines?: Stripe.InvoiceLineItem[];
  couponIds?: string[];
}

/** I/O for one Stripe event. The webhook builds these on a single transaction so the dedupe row and the effects commit together. */
export interface StripeEventDeps {
  recordEvent(id: string, type: string): Promise<boolean>;
  userExists(userId: string): Promise<boolean>;
  /** The user whose subscriptions row holds this Stripe customer. */
  userForCustomer(customerId: string): Promise<string | null>;
  /** True when the customer belonged to an erased account (deletion_tasks.stripe_customer_hash, WP-25). */
  customerErased(customerId: string): Promise<boolean>;
  saveSubscription(row: SubscriptionRow): Promise<void>;
  grantCredits(grant: InvoiceGrant): Promise<void>;
}

/** processed: applied or alerted. ignored: recorded with nothing to do. duplicate: seen before. */
export type StripeEventOutcome = "processed" | "ignored" | "duplicate";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);
/** Synced from the refetched subscription; a failed payment moves it to past_due (the grace anchor). */
const SYNC_EVENTS = new Set([...SUBSCRIPTION_EVENTS, "invoice.payment_failed"]);
/** Money going back to the customer: alert only, an operator decides any credit change (_db/billing.md Q-4). */
const ALERT_EVENTS = new Set(["charge.refunded", "charge.dispute.created"]);

const idOf = (ref: string | { id: string } | null | undefined): string | null => (typeof ref === "string" ? ref : (ref?.id ?? null));

/** A state only a person can fix. Thrown, so the transaction rolls back and Stripe keeps retrying (up to 3 days) meanwhile. */
const anomaly = (code: string, detail: string) => new Error(`${code}: ${detail}`);

/** Maps a subscription to its row. A price missing from STRIPE_PRICES throws instead of dropping a paid state. */
export function subscriptionRow(sub: Stripe.Subscription, userId: string): SubscriptionRow {
  const item = sub.items.data[0];
  const mapped = item ? planForPriceId(item.price.id) : null;
  if (!mapped) throw anomaly("anomaly_unmapped_price", `subscription ${sub.id} has no price in STRIPE_PRICES`);
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

/** Coupon ids of an invoice fetched with its discounts expanded; an unexpanded discount id is skipped. */
export function couponIdsOf(invoice: Stripe.Invoice): string[] {
  return invoice.discounts.flatMap((d) => (typeof d === "string" ? [] : [idOf(d.source.coupon)])).filter((id): id is string => id !== null);
}

/**
 * The credits a paid invoice earns, or null for none: nothing was paid and no coupon is in STRIPE_GRANT_COUPONS
 * (a 100% promotion code, a trial), or every line is a proration. The first non-proration line with a known plan
 * price decides: proration lines carry the OLD plan's price ("Unused time on Starter") and come first after a plan
 * change; the next renewal grants the new plan's cycle. Regular lines with no known price throw.
 */
export function invoiceGrant(invoice: Stripe.Invoice, lines = invoice.lines.data, couponIds: string[] = []): Omit<InvoiceGrant, "userId"> | null {
  // `> 0`, not `=== 0`: a missing amount must never count as paid.
  if (!(invoice.amount_paid > 0) && !couponIds.some((id) => env().STRIPE_GRANT_COUPONS.includes(id))) return null;
  const regular = lines.filter((line) => !line.parent?.subscription_item_details?.proration && !line.parent?.invoice_item_details?.proration);
  if (regular.length === 0 || !invoice.id) return null;
  const mapped = regular
    .map((line) => line.pricing?.price_details?.price)
    .map((price) => (typeof price === "string" ? planForPriceId(price) : null))
    .find((plan) => plan !== null);
  if (!mapped) throw anomaly("anomaly_unmapped_price", `invoice ${invoice.id} has no line with a price in STRIPE_PRICES`);
  return { delta: creditsPerInvoice(mapped.plan, mapped.interval), stripeInvoiceId: invoice.id };
}

/**
 * Makes the Stripe calls an event needs, before the transaction opens: the live subscription (never the event
 * body), every line of a truncated invoice, and the coupons of a $0 invoice while an allowlist is set.
 */
export async function fetchStripeState(event: Stripe.Event, deps: StripeFetchDeps): Promise<FetchedStripeState> {
  if (SUBSCRIPTION_EVENTS.has(event.type)) return { subscription: await deps.retrieveSubscription((event.data.object as Stripe.Subscription).id) };
  if (event.type === "invoice.payment_failed") {
    const subscriptionId = idOf((event.data.object as Stripe.Invoice).parent?.subscription_details?.subscription);
    return subscriptionId ? { subscription: await deps.retrieveSubscription(subscriptionId) } : {};
  }
  if (event.type !== "invoice.paid") return {};
  const invoice = event.data.object as Stripe.Invoice;
  const id = invoice.id ?? "";
  const state: FetchedStripeState = {};
  if (invoice.lines.has_more) state.lines = await deps.listInvoiceLines(id);
  if (!(invoice.amount_paid > 0) && env().STRIPE_GRANT_COUPONS.length > 0) state.couponIds = await deps.invoiceCouponIds(id);
  return state;
}

/**
 * The Kairos user an object belongs to: the userId checkout wrote into the metadata, else the user whose subscriptions
 * row holds the customer. Null when that user was erased (the event is ignored, never retried). Throws when nobody
 * matches, so the event is retried while someone looks.
 */
async function resolveUser(metadataUserId: string | undefined, customerId: string | null, deps: StripeEventDeps): Promise<string | null> {
  const userId = metadataUserId || (customerId ? await deps.userForCustomer(customerId) : null);
  // An erased account's customer is deleted at Stripe, whose cancellation events follow: ignored, never retried (billing-50).
  if (!userId && customerId && (await deps.customerErased(customerId))) return null;
  if (!userId) throw anomaly("anomaly_no_user", `no user for customer ${customerId ?? "(none)"}`);
  return (await deps.userExists(userId)) ? userId : null;
}

/**
 * Records the event, then applies it with the state fetchStripeState prepared. Any throw rolls back the caller's
 * transaction, so Stripe's retry finds no event row and processes it again: an unknown price or user is retried,
 * never dropped. Subscriptions are saved from the refetched object, so a late "updated" never overwrites a newer "deleted".
 */
export async function processStripeEvent(event: Stripe.Event, fetched: FetchedStripeState, deps: StripeEventDeps): Promise<StripeEventOutcome> {
  if (!(await deps.recordEvent(event.id, event.type))) return "duplicate";

  if (ALERT_EVENTS.has(event.type)) {
    const money = event.data.object as Stripe.Charge | Stripe.Dispute;
    // ponytail: a log line is the alert; a Railway log alert on this message pages (WP-11). Clawback stays manual.
    logger.error({ eventId: event.id, type: event.type, objectId: money.id, amount: money.amount }, "stripe refund or dispute: no credits changed, operator decision needed");
    return "processed";
  }

  if (SYNC_EVENTS.has(event.type)) {
    const sub = fetched.subscription;
    if (!sub) return "ignored"; // a failed payment on an invoice with no subscription
    const userId = await resolveUser(sub.metadata.userId, idOf(sub.customer), deps);
    if (!userId) return "ignored";
    await deps.saveSubscription(subscriptionRow(sub, userId));
    return "processed";
  }

  if (event.type !== "invoice.paid") return "ignored";
  const invoice = event.data.object as Stripe.Invoice;
  const grant = invoiceGrant(invoice, fetched.lines, fetched.couponIds);
  if (!grant) return "ignored";
  const userId = await resolveUser(invoice.parent?.subscription_details?.metadata?.userId, idOf(invoice.customer), deps);
  if (!userId) return "ignored";
  await deps.grantCredits({ userId, ...grant });
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
