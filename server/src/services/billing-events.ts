import { and, eq, isNull, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";
import type { BillingInterval, PlanId } from "@auto-career/shared";
import type { Db } from "../db/client";
import { deletionTasks, stripeEvents, subscriptions, user, type StripeEventOutcome } from "../db/schema";
import { emitOutbox, reopenOutbox } from "../durable/outbox";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { slo } from "../lib/metrics";
import { signal } from "../lib/sentry";
import { applyInvoiceGrant, lockCreditBalance } from "./credits";
import { stripeCustomerHash } from "./erasure";
import { creditsPerInvoice, INLINE_REQUEST, planForPriceId, stripe } from "./stripe";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Stripe events, store then process (billing-12 to 19; workers/09, on the outbox seam of ADR-001 Revision 3 instead of DBOS).
 *
 *   route:  verifies the signature, stores a row in `received` with the minimized payload, emits an outbox row in the same
 *           transaction, answers 2xx. A 2xx means stored, never applied. It never calls Stripe.
 *   queue:  `stripe` runs processStoredEvent, at least once. The row's status makes a second run a no-op.
 *
 * Ordering. Per customer, one event at a time: processStoredEvent holds the customer's advisory lock across the refetch and
 * the commit, so whichever event commits last read Stripe after every earlier commit. Stripe's own order is not assumed. The
 * guard stripe_event_created then ignores an event strictly older than the one already applied. Two events in the same
 * second (created has one-second resolution, and subscription.created and .updated often share one) both run, in whichever
 * order the queue gives them; that is safe only because of the lock: the later run's refetch sees whatever the earlier one
 * saw, or newer, so it can never put an older snapshot back. Grants ignore order altogether: one per invoice by the unique
 * index, from the signed invoice body, and an invoice.paid ahead of its subscription.created still grants.
 *
 * ponytail: the lock pins one connection per event while Stripe answers, at most 10 s (INLINE_REQUEST, under the worker's 30 s
 * idle-in-transaction limit) and at most `concurrency` of them per replica. BullMQ's own groups are a paid feature; a lease
 * table would let the connection go, and is worth it only if refetches get slow.
 *
 * Retries. BullMQ tries a transient failure 8 times over about 6 minutes, the outbox delivers that job up to 5 times over about
 * 8 more, and processStripeSweep then reopens the row up to 6 times, 12 hours apart, about 60 hours in all, close to Stripe's
 * own window (billing-17). Then, and at once for anything no retry can fix, the row is dead and pages.
 */

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
    collectionPaused: boolean;
    pauseSource: "offer_email" | "customer" | null;
  };
}

export interface InvoiceGrant {
  userId: string;
  delta: number;
  stripeInvoiceId: string;
  plan: PlanId;
  interval: BillingInterval;
}

const stripeId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
/** Worst case about 2.5 KB: 20 lines of two short fields and a few ids, under stripe_events_payload_ck's 4 KB. */
const MAX_LINES = 20;

/**
 * What survives of an event (billing-14, _db/billing.md 3.5): ids and integers from an allowlist, per kind. A raw event holds
 * the customer's name, address and card details; none of them is read, and none can pass this schema's id shape. The only
 * person's id here is the invoice's metadata userId, and erasure scrubs these rows (services/erasure.ts).
 */
export const stripeEventPayload = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("subscription"), subscriptionId: stripeId, customerId: stripeId.nullable() }),
  z.strictObject({
    kind: z.literal("invoice"),
    invoiceId: stripeId,
    customerId: stripeId.nullable(),
    userId: stripeId.nullable(),
    amountPaid: z.number().int().nonnegative(),
    lines: z.array(z.strictObject({ priceId: stripeId.nullable(), proration: z.boolean() })).max(MAX_LINES),
    linesTruncated: z.boolean(),
  }),
  z.strictObject({ kind: z.literal("payment_failed"), invoiceId: stripeId.nullable(), customerId: stripeId.nullable(), subscriptionId: stripeId.nullable() }),
  z.strictObject({ kind: z.literal("money_movement"), objectId: stripeId, customerId: stripeId.nullable(), amount: z.number().int() }),
]);
export type StripeEventPayload = z.infer<typeof stripeEventPayload>;
export type InvoiceExtract = Extract<StripeEventPayload, { kind: "invoice" }>;

/** An event as processing sees it: what was stored, never the raw body. `created` is null on the reconcile's own runs. */
export interface StoredEvent {
  id: string;
  type: string;
  created: Date | null;
  payload: StripeEventPayload | null;
}

/** Stripe calls an event needs, inside the customer's lock (the header says why). */
export interface StripeFetchDeps {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  /** Every line of an invoice whose inline list was cut short (has_more), or longer than the payload keeps. */
  listInvoiceLines(invoiceId: string): Promise<Stripe.InvoiceLineItem[]>;
  /** Coupon ids behind the invoice's discounts; the event carries discount ids only. */
  invoiceCouponIds(invoiceId: string): Promise<string[]>;
}

export interface FetchedStripeState {
  subscription?: Stripe.Subscription;
  lines?: Stripe.InvoiceLineItem[];
  couponIds?: string[];
}

/** I/O for one event, on the transaction that also marks its row. */
export interface StripeEventDeps {
  userExists(userId: string): Promise<boolean>;
  /** The user whose subscriptions row holds this Stripe customer. */
  userForCustomer(customerId: string): Promise<string | null>;
  /** True when the customer belonged to an erased account (deletion_tasks.stripe_customer_hash, WP-25). */
  customerErased(customerId: string): Promise<boolean>;
  /** "stale": the ordering guard, or a late free state about a subscription the row no longer tracks. */
  saveSubscription(row: SubscriptionRow, eventCreated: Date | null): Promise<"saved" | "stale">;
  grantCredits(grant: InvoiceGrant): Promise<"applied" | "duplicate">;
}

export interface ProcessResult {
  status: "processed" | "ignored";
  outcome: StripeEventOutcome;
  userId: string | null;
}

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);
/** Money going back to the customer: alert only, an operator decides any credit change (_db/billing.md Q-4). */
const ALERT_EVENTS = new Set(["charge.refunded", "charge.dispute.created"]);

const idOf = (ref: string | { id: string } | null | undefined): string | null => (typeof ref === "string" ? ref : (ref?.id ?? null));

/** A state only a person can fix: the row goes dead at once with this outcome, an operator fixes the cause and redrives. */
export class BillingAnomaly extends Error {
  constructor(
    readonly outcome: "anomaly_no_user" | "anomaly_unmapped_price",
    detail: string,
  ) {
    super(`${outcome}: ${detail}`);
  }
}

/** Maps a subscription to its row. A price missing from STRIPE_PRICES throws instead of dropping a paid state. */
export function subscriptionRow(sub: Stripe.Subscription, userId: string): SubscriptionRow {
  const item = sub.items.data[0];
  const mapped = item ? planForPriceId(item.price.id) : null;
  if (!mapped) throw new BillingAnomaly("anomaly_unmapped_price", `subscription ${sub.id} has no price in STRIPE_PRICES`);
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
      collectionPaused: Boolean(sub.pause_collection),
      pauseSource: sub.pause_collection ? (sub.metadata?.pausedBy === "offer-email" ? "offer_email" : "customer") : null,
    },
  };
}

/** Coupon ids of an invoice fetched with its discounts expanded; an unexpanded discount id is skipped. */
export function couponIdsOf(invoice: Stripe.Invoice): string[] {
  return invoice.discounts.flatMap((d) => (typeof d === "string" ? [] : [idOf(d.source.coupon)])).filter((id): id is string => id !== null);
}

const lineExtract = (line: Stripe.InvoiceLineItem): InvoiceExtract["lines"][number] => {
  const price = line.pricing?.price_details?.price;
  return { priceId: typeof price === "string" ? price : null, proration: Boolean(line.parent?.subscription_item_details?.proration || line.parent?.invoice_item_details?.proration) };
};

/** The invoice branch of the extract: also what the reconcile builds from a listed invoice, so both decide the same way. */
export function invoiceExtract(invoice: Stripe.Invoice): InvoiceExtract {
  return {
    kind: "invoice",
    invoiceId: invoice.id ?? "",
    customerId: idOf(invoice.customer),
    userId: invoice.parent?.subscription_details?.metadata?.userId ?? null,
    // A missing amount must never count as paid.
    amountPaid: invoice.amount_paid > 0 ? invoice.amount_paid : 0,
    lines: invoice.lines.data.slice(0, MAX_LINES).map(lineExtract),
    linesTruncated: invoice.lines.has_more || invoice.lines.data.length > MAX_LINES,
  };
}

/**
 * The stored form of an event, from an allowlist. A handled type that does not fit keeps a null payload: stored, so nothing
 * is lost and Stripe stops retrying, and then dead as payload_invalid for an operator. An unhandled type has one too.
 */
export function buildEventExtract(event: Stripe.Event): { objectId: string | null; customerId: string | null; payload: StripeEventPayload | null } {
  const object = event.data.object as unknown as { id?: string; customer?: string | { id: string } | null; amount?: number };
  const objectId = object.id ?? null;
  const customerId = idOf(object.customer);
  const raw: unknown = SUBSCRIPTION_EVENTS.has(event.type)
    ? { kind: "subscription", subscriptionId: object.id, customerId }
    : event.type === "invoice.paid"
      ? invoiceExtract(event.data.object as Stripe.Invoice)
      : event.type === "invoice.payment_failed"
        ? { kind: "payment_failed", invoiceId: objectId, customerId, subscriptionId: idOf((event.data.object as Stripe.Invoice).parent?.subscription_details?.subscription) }
        : ALERT_EVENTS.has(event.type)
          ? { kind: "money_movement", objectId, customerId, amount: object.amount }
          : null;
  const parsed = raw === null ? null : stripeEventPayload.safeParse(raw);
  return { objectId, customerId, payload: parsed?.success ? parsed.data : null };
}

export const handledEventType = (type: string): boolean => SUBSCRIPTION_EVENTS.has(type) || ALERT_EVENTS.has(type) || type === "invoice.paid" || type === "invoice.payment_failed";

/** Decides nothing but "no credits for this invoice", and why. */
export type NoGrant = { outcome: "zero_amount" | "proration_only" };

/**
 * The credits a paid invoice earns, or why none: nothing was paid and no coupon is in STRIPE_GRANT_COUPONS (a 100% promotion
 * code, a trial), or every line is a proration. The first non-proration line with a known plan price decides: proration lines
 * carry the OLD plan's price ("Unused time on Starter") and come first after a plan change; the next renewal grants the new
 * plan's cycle. Regular lines with no known price throw.
 */
export function invoiceGrant(invoice: InvoiceExtract, lines = invoice.lines, couponIds: string[] = []): Omit<InvoiceGrant, "userId"> | NoGrant {
  if (!(invoice.amountPaid > 0) && !couponIds.some((id) => env().STRIPE_GRANT_COUPONS.includes(id))) return { outcome: "zero_amount" };
  const regular = lines.filter((line) => !line.proration);
  if (regular.length === 0 || !invoice.invoiceId) return { outcome: "proration_only" };
  const mapped = regular.map((line) => (line.priceId ? planForPriceId(line.priceId) : null)).find((plan) => plan !== null);
  if (!mapped) throw new BillingAnomaly("anomaly_unmapped_price", `invoice ${invoice.invoiceId} has no line with a price in STRIPE_PRICES`);
  return { delta: creditsPerInvoice(mapped.plan, mapped.interval), stripeInvoiceId: invoice.invoiceId, plan: mapped.plan, interval: mapped.interval };
}

/** The Stripe calls an event needs: the live subscription (never the event body), every line of a long invoice, and the coupons of a $0 invoice while an allowlist is set. */
export async function fetchStripeState(event: StoredEvent, deps: StripeFetchDeps): Promise<FetchedStripeState> {
  const p = event.payload;
  if (p?.kind === "subscription") return { subscription: await deps.retrieveSubscription(p.subscriptionId) };
  if (p?.kind === "payment_failed") return p.subscriptionId ? { subscription: await deps.retrieveSubscription(p.subscriptionId) } : {};
  if (p?.kind !== "invoice") return {};
  const state: FetchedStripeState = {};
  if (p.linesTruncated) state.lines = await deps.listInvoiceLines(p.invoiceId);
  if (!(p.amountPaid > 0) && env().STRIPE_GRANT_COUPONS.length > 0) state.couponIds = await deps.invoiceCouponIds(p.invoiceId);
  return state;
}

/**
 * The Kairos user an object belongs to: the userId checkout wrote into the metadata, else the user whose subscriptions
 * row holds the customer. Null when that user was erased (the event is ignored, never retried). Throws when nobody
 * matches: an operator looks, then redrives.
 */
async function resolveUser(metadataUserId: string | null | undefined, customerId: string | null, deps: StripeEventDeps): Promise<string | null> {
  const userId = metadataUserId || (customerId ? await deps.userForCustomer(customerId) : null);
  // An erased account's customer is deleted at Stripe, whose cancellation events follow: ignored, never retried (billing-50).
  if (!userId && customerId && (await deps.customerErased(customerId))) return null;
  if (!userId) throw new BillingAnomaly("anomaly_no_user", `no user for customer ${customerId ?? "(none)"}`);
  return (await deps.userExists(userId)) ? userId : null;
}

/**
 * Applies a stored event with the state fetchStripeState prepared. Subscriptions are saved from the refetched object, so a
 * late "updated" never overwrites a newer "deleted"; a grant comes only from a paid invoice, and its amount only from
 * plans.ts. Anything thrown rolls the caller's transaction back.
 */
export async function processStripeEvent(event: StoredEvent, fetched: FetchedStripeState, deps: StripeEventDeps): Promise<ProcessResult> {
  const p = event.payload;
  const ignored = (outcome: StripeEventOutcome, userId: string | null = null): ProcessResult => ({ status: "ignored", outcome, userId });

  if (p?.kind === "money_movement") {
    // Clawback stays manual: this pages (A-BILL-4), and an operator decides with scripts/ops-billing.ts.
    logger.error({ eventId: event.id, type: event.type, objectId: p.objectId, amount: p.amount }, "stripe money movement: no credits changed, operator decision needed");
    signal("stripe_money_movement");
    return { status: "processed", outcome: "alert_only", userId: null };
  }

  if (p?.kind === "subscription" || p?.kind === "payment_failed") {
    const sub = fetched.subscription;
    if (!sub) return ignored("unhandled_type"); // a failed payment on an invoice with no subscription
    const userId = await resolveUser(sub.metadata.userId, idOf(sub.customer), deps);
    if (!userId) return ignored("user_deleted");
    const saved = await deps.saveSubscription(subscriptionRow(sub, userId), event.created);
    return saved === "stale" ? ignored("subscription_stale", userId) : { status: "processed", outcome: "subscription_synced", userId };
  }

  if (p?.kind !== "invoice") return ignored("unhandled_type");
  const grant = invoiceGrant(p, fetched.lines?.map(lineExtract), fetched.couponIds);
  if ("outcome" in grant) return ignored(grant.outcome);
  const userId = await resolveUser(p.userId, p.customerId, deps);
  if (!userId) return ignored("user_deleted");
  const applied = await deps.grantCredits({ userId, ...grant });
  return { status: "processed", outcome: applied === "applied" ? "grant_applied" : "grant_duplicate", userId };
}

/** The classes of billing-17. Only the code reaches a row: an error's own text can hold anything. */
export function classifyError(err: unknown): { permanent: boolean; code: string; outcome?: StripeEventOutcome } {
  if (err instanceof BillingAnomaly) return { permanent: true, code: err.outcome, outcome: err.outcome };
  const e = err as { type?: string; code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  if (e.type === "StripeInvalidRequestError") return { permanent: true, code: e.code === "resource_missing" ? "stripe_resource_missing" : "stripe_invalid_request" };
  if (e.type === "StripeIdempotencyError") return { permanent: true, code: "stripe_idempotency" };
  // Every event would fail the same way, so dead-lettering them would only make operator work: retried, and the backlog pages.
  if (e.type === "StripeAuthenticationError") return { permanent: false, code: "stripe_auth" };
  if (e.type === "StripePermissionError") return { permanent: false, code: "stripe_permission" };
  if (e.type === "StripeRateLimitError") return { permanent: false, code: "stripe_rate_limited" };
  if (e.type === "StripeConnectionError") return { permanent: false, code: "stripe_connection" };
  if (e.type === "StripeAPIError") return { permanent: false, code: "stripe_5xx" };
  const pg = e.cause?.code ? e.cause : e;
  if (pg.code === "23505" && pg.constraint?.includes("stripe_customer")) return { permanent: true, code: "customer_conflict" };
  if (pg.code === "40001") return { permanent: false, code: "db_serialization" };
  if (pg.code === "40P01") return { permanent: false, code: "db_deadlock" };
  if (pg.code === "55P03") return { permanent: false, code: "db_lock_timeout" };
  if (pg.code?.startsWith("08") || pg.code === "57P01") return { permanent: false, code: "db_unavailable" };
  return { permanent: false, code: "unexpected" };
}

/** The Stripe calls of a worker's run: one short try each, since the job is what retries. */
export function liveStripeFetch(): StripeFetchDeps {
  return {
    retrieveSubscription: (id) => stripe().subscriptions.retrieve(id, {}, INLINE_REQUEST),
    listInvoiceLines: (id) => stripe().invoices.listLineItems(id, { limit: 100 }, INLINE_REQUEST).autoPagingToArray({ limit: 1000 }),
    invoiceCouponIds: async (id) => couponIdsOf(await stripe().invoices.retrieve(id, { expand: ["discounts"] }, INLINE_REQUEST)),
  };
}

export const stripeEventKey = (eventId: string): string => `stripe-${eventId}`;

/** Serializes one customer's work, from before the refetch to the commit (the header). First in the lock order; only billing events take it. */
export const lockStripeCustomer = (tx: Tx, customerId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`stripe-customer:${customerId}`}, 0))`);

/** The route's half: the row and the intent to process it, in one transaction. Returns false when the event was seen before. */
export async function storeStripeEvent(db: Db, event: Stripe.Event): Promise<boolean> {
  const { objectId, customerId, payload } = buildEventExtract(event);
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type, status: "received", processedAt: null, objectId, stripeCustomerId: customerId, eventCreated: new Date(event.created * 1000), payload })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    if (inserted.length === 0) return false;
    await emitOutbox(tx, "stripe", { eventId: event.id }, stripeEventKey(event.id));
    return true;
  });
}

function eventDeps(tx: Tx): StripeEventDeps {
  return {
    userExists: async (id) => (await tx.select({ id: user.id }).from(user).where(eq(user.id, id))).length > 0,
    userForCustomer: async (customerId) => (await tx.select({ userId: subscriptions.userId }).from(subscriptions).where(eq(subscriptions.stripeCustomerId, customerId)))[0]?.userId ?? null,
    customerErased: async (customerId) => (await tx.select({ h: deletionTasks.userHash }).from(deletionTasks).where(eq(deletionTasks.stripeCustomerHash, stripeCustomerHash(customerId)))).length > 0,
    saveSubscription: async ({ userId, values }, eventCreated) => {
      // Lock order: the balance, then this row. The guard reads under both.
      await lockCreditBalance(tx, userId);
      const [before] = await tx.select({ created: subscriptions.stripeEventCreated }).from(subscriptions).where(eq(subscriptions.userId, userId)).for("update");
      if (eventCreated && before?.created && eventCreated < before.created) return "stale";
      // An unpaid state only overwrites the row when it is about the subscription the row tracks (or none yet),
      // so a late event for an old, cancelled subscription cannot drop a user who has since subscribed again.
      const tracksThis = or(isNull(subscriptions.stripeSubscriptionId), eq(subscriptions.stripeSubscriptionId, values.stripeSubscriptionId));
      const saved = await tx
        .insert(subscriptions)
        .values({ userId, ...values, pastDueSince: values.status === "past_due" ? sql`now()` : null, stripeEventCreated: eventCreated, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: {
            ...values,
            // The grace anchor is set on entering past_due and kept while it lasts, so repeated events never extend it.
            pastDueSince: values.status === "past_due" ? sql`coalesce(${subscriptions.pastDueSince}, now())` : null,
            // The reconcile passes null: GREATEST skips it, and the guard stays where it was.
            stripeEventCreated: sql`greatest(${subscriptions.stripeEventCreated}, excluded.stripe_event_created)`,
            updatedAt: new Date(),
          },
          ...(values.plan === "free" ? { where: tracksThis } : {}),
        })
        .returning({ userId: subscriptions.userId });
      return saved.length > 0 ? "saved" : "stale";
    },
    grantCredits: ({ plan, interval, ...grant }) => applyInvoiceGrant(tx, { ...grant, note: `plan=${plan} interval=${interval}` }),
  };
}

/** The row goes dead: it pages, and it waits for an operator (scripts/ops-billing.ts redrive). Only a received row: a redelivered job finds nothing. */
export async function markStripeEventDead(db: Db | Tx, eventId: string, code: string, outcome: StripeEventOutcome | null = null): Promise<void> {
  const dead = await db
    .update(stripeEvents)
    .set({ status: "dead", lastError: code, outcome, attempts: sql`${stripeEvents.attempts} + 1` })
    .where(and(eq(stripeEvents.id, eventId), eq(stripeEvents.status, "received")))
    .returning({ id: stripeEvents.id });
  if (!dead.length) return;
  logger.error({ eventId, code }, "stripe event dead");
  signal("stripe_event_dead");
  slo("s7", false);
}

/**
 * Runs one stored event, any number of times. The status is re-read under the customer's lock, and the row, the subscription
 * and the ledger commit together: a crash anywhere leaves `received`, and the next run starts over. Throws what deserves a
 * retry; a state no retry can fix ends the row as dead and returns.
 */
export async function processStoredEvent(db: Db, eventId: string, api: StripeFetchDeps = liveStripeFetch()): Promise<string> {
  const [seen] = await db.select({ status: stripeEvents.status, customer: stripeEvents.stripeCustomerId }).from(stripeEvents).where(eq(stripeEvents.id, eventId));
  if (!seen || seen.status !== "received") return "done";
  try {
    const result = await db.transaction(async (tx) => {
      if (seen.customer) await lockStripeCustomer(tx, seen.customer);
      const [row] = await tx.select().from(stripeEvents).where(and(eq(stripeEvents.id, eventId), eq(stripeEvents.status, "received"))).for("update");
      if (!row) return null;
      const parsed = stripeEventPayload.nullable().safeParse(row.payload);
      if (!parsed.success || (parsed.data === null && handledEventType(row.type))) {
        await markStripeEventDead(tx, eventId, "payload_invalid");
        return { status: "dead" as const, outcome: null, userId: null, receivedAt: row.receivedAt };
      }
      const stored: StoredEvent = { id: row.id, type: row.type, created: row.eventCreated, payload: parsed.data };
      const deps = eventDeps(tx);
      // An erased customer is deleted at Stripe, and a refetch would answer 404 and page for nothing: no call, and no id kept.
      const erased = row.stripeCustomerId !== null && (await deps.customerErased(row.stripeCustomerId));
      const out = erased ? ({ status: "ignored", outcome: "user_deleted", userId: null } as const) : await processStripeEvent(stored, await fetchStripeState(stored, api), deps);
      const forgotten = out.outcome === "user_deleted" ? { payload: null, stripeCustomerId: null } : {};
      await tx.update(stripeEvents).set({ status: out.status, outcome: out.outcome, userId: out.userId, processedAt: sql`now()`, lastError: null, ...forgotten }).where(eq(stripeEvents.id, eventId));
      return { ...out, receivedAt: row.receivedAt };
    });
    if (!result) return "done";
    if (result.status !== "dead") slo("s7", Date.now() - result.receivedAt.getTime() <= 10 * 60_000);
    logger.info({ eventId, status: result.status, outcome: result.outcome, userId: result.userId }, "stripe event processed");
    return result.outcome ?? result.status;
  } catch (err) {
    const c = classifyError(err);
    if (c.permanent) {
      await markStripeEventDead(db, eventId, c.code, c.outcome ?? null);
      return "dead";
    }
    await db.update(stripeEvents).set({ attempts: sql`${stripeEvents.attempts} + 1`, lastError: c.code }).where(and(eq(stripeEvents.id, eventId), eq(stripeEvents.status, "received")));
    logger.warn({ eventId, code: c.code }, "stripe event failed");
    throw err;
  }
}

/** A dead or stuck event back to work: its status to received, one more redrive, and its outbox row open again. In the caller's transaction. */
export async function redriveStripeEvent(tx: Tx, eventId: string): Promise<boolean> {
  const moved = await tx
    .update(stripeEvents)
    .set({ status: "received", outcome: null, processedAt: null, redrives: sql`${stripeEvents.redrives} + 1` })
    .where(and(eq(stripeEvents.id, eventId), sql`${stripeEvents.status} IN ('received','dead')`))
    .returning({ id: stripeEvents.id });
  if (!moved.length) return false;
  await reopenOutbox(tx, "stripe", { eventId }, stripeEventKey(eventId));
  return true;
}

/** The reconcile's run of a listed invoice or a drifted subscription: the same code as an event's, behind any event of that customer. No guard: it read Stripe just now. */
export async function applyWithoutEvent(db: Db, customerId: string | null, payload: StripeEventPayload, api: StripeFetchDeps = liveStripeFetch()): Promise<ProcessResult> {
  return db.transaction(async (tx) => {
    if (customerId) await lockStripeCustomer(tx, customerId);
    const stored: StoredEvent = { id: "reconcile", type: "reconcile", created: null, payload };
    return processStripeEvent(stored, await fetchStripeState(stored, api), eventDeps(tx));
  });
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
