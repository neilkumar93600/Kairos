import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { BILLING_INTERVALS, getPlan, PLAN_IDS, type BillingInterval, type PlanId } from "@auto-career/shared";
import { db } from "../db/client";
import { creditLedger, outbox, stripeEvents, subscriptions } from "../db/schema";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { gauge } from "../lib/metrics";
import { signal } from "../lib/sentry";
import { applyWithoutEvent, BillingAnomaly, invoiceExtract, liveStripeFetch, lockStripeCustomer, markStripeEventDead, PAST_DUE_GRACE_MS, redriveStripeEvent, refetchTrackedSubscription, stripeEventKey, subscriptionRow, type StripeFetchDeps } from "../services/billing-events";
import { lockCreditBalance } from "../services/credits";
import { stripe } from "../services/stripe";
import { BALANCE_DRIFT } from "./invariants";

/** A stored event this long past receipt pages (A-BILL-2). */
const STUCK_PAGE_S = 30 * 60;
/** A received row older than this with no live job behind it is the sweep's to reopen. */
const STUCK_AFTER = sql`now() - interval '10 minutes'`;
const MAX_REDRIVES = 6;
const REDRIVE_SPACING_MS = 12 * 3600_000;

/** Whether this row may be reopened now: the first at once, each next one 12 hours further on from receipt. */
export const redriveDue = (receivedAt: Date, redrives: number, now = Date.now()): boolean => receivedAt.getTime() + redrives * REDRIVE_SPACING_MS <= now;

/**
 * Every 5 minutes (billing-17 and R6 of workers/09): the backlog gauges, and a received event whose job came to nothing, which
 * opens its outbox row again up to 6 times, or is dead with retries_exhausted after that. A row whose job is still moving is
 * left alone: the outbox has its own retries.
 */
export async function processStripeSweep(): Promise<{ redriven: number; dead: number; oldestS: number }> {
  const [head] = await db()
    .select({
      oldestS: sql<number>`coalesce(extract(epoch from now() - min(${stripeEvents.receivedAt}) filter (where ${stripeEvents.status} = 'received')), 0)::float8`,
      dead: sql<number>`(count(*) filter (where ${stripeEvents.status} = 'dead'))::int`,
    })
    .from(stripeEvents)
    .where(inArray(stripeEvents.status, ["received", "dead"]));
  const oldestS = head?.oldestS ?? 0;
  gauge("billing.stripe_unprocessed_oldest_age_s", oldestS);
  gauge("billing.stripe_dead", head?.dead ?? 0);
  if (oldestS > STUCK_PAGE_S) {
    logger.error({ oldestS }, "stripe events stuck");
    signal("stripe_event_stuck");
  }
  const stuck = await db()
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(and(eq(stripeEvents.status, "received"), sql`${stripeEvents.receivedAt} < ${STUCK_AFTER}`))
    .orderBy(asc(stripeEvents.receivedAt))
    .limit(200);
  let [redriven, dead] = [0, 0];
  for (const { id } of stuck) {
    const moved = await db().transaction(async (tx) => {
      // SKIP LOCKED: a job holds this row while Stripe answers, so the event is moving.
      const [row] = await tx
        .select({ redrives: stripeEvents.redrives, receivedAt: stripeEvents.receivedAt })
        .from(stripeEvents)
        .where(and(eq(stripeEvents.id, id), eq(stripeEvents.status, "received")))
        .for("update", { skipLocked: true });
      if (!row) return null;
      const [job] = await tx.select({ status: outbox.status }).from(outbox).where(eq(outbox.dedupeKey, stripeEventKey(id)));
      if (job?.status === "pending" || job?.status === "enqueued") return null;
      if (row.redrives >= MAX_REDRIVES) {
        await markStripeEventDead(tx, id, "retries_exhausted");
        return "dead";
      }
      if (!redriveDue(row.receivedAt, row.redrives)) return null;
      await redriveStripeEvent(tx, id);
      return "redriven";
    });
    if (moved === "dead") dead++;
    if (moved === "redriven") redriven++;
  }
  if (redriven || dead) logger.warn({ redriven, dead }, "stripe sweep");
  return { redriven, dead, oldestS };
}

/** Stripe's reads of one reconcile, behind an interface so the tests never call Stripe. */
export interface ReconcileApi {
  paidInvoicesSince(since: Date): Promise<Stripe.Invoice[]>;
  allSubscriptions(): Promise<Stripe.Subscription[]>;
  /** Null when Stripe has no such price. */
  price(id: string): Promise<Stripe.Price | null>;
  fetch: StripeFetchDeps;
}

const READ = { timeout: 20_000, maxNetworkRetries: 2 } satisfies Stripe.RequestOptions;

function liveApi(): ReconcileApi {
  return {
    paidInvoicesSince: (since) => stripe().invoices.list({ status: "paid", created: { gte: Math.floor(since.getTime() / 1000) }, limit: 100 }, READ).autoPagingToArray({ limit: 100_000 }),
    allSubscriptions: () => stripe().subscriptions.list({ status: "all", limit: 100 }, READ).autoPagingToArray({ limit: 100_000 }),
    price: async (id) => {
      try {
        return await stripe().prices.retrieve(id, {}, READ);
      } catch (err) {
        if ((err as { code?: string } | null)?.code === "resource_missing") return null;
        throw err;
      }
    },
    fetch: liveStripeFetch(),
  };
}

const LIVE_ENDED = new Set(["canceled", "incomplete_expired"]);
const customerOf = (s: { customer: string | { id: string } | null }): string | null => (typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null));

/**
 * R1: a paid invoice created in the last 30 days with no grant gets it now, through the event's own decision. 30 days, not 7:
 * Stripe lists by creation, and a renewal paid after about two weeks of card retries was created that long before it was paid.
 * Insert-once, so a racing event is harmless.
 */
const INVOICE_WINDOW_MS = 30 * 24 * 3600_000;
async function reconcileInvoices(api: ReconcileApi): Promise<{ listed: number; granted: number; anomalies: number }> {
  const invoices = await api.paidInvoicesSince(new Date(Date.now() - INVOICE_WINDOW_MS));
  const ids = invoices.flatMap((i) => (i.id ? [i.id] : []));
  const granted = new Set(
    ids.length ? (await db().select({ id: creditLedger.stripeInvoiceId }).from(creditLedger).where(and(eq(creditLedger.reason, "plan_grant"), inArray(creditLedger.stripeInvoiceId, ids)))).map((r) => r.id) : [],
  );
  const out = { listed: invoices.length, granted: 0, anomalies: 0 };
  for (const invoice of invoices) {
    if (!invoice.id || granted.has(invoice.id)) continue;
    try {
      const done = await applyWithoutEvent(db(), customerOf(invoice), invoiceExtract(invoice), api.fetch);
      if (done.outcome === "grant_applied") {
        out.granted++;
        logger.warn({ invoiceId: invoice.id, userId: done.userId }, "billing reconcile: a paid invoice had no grant");
      }
    } catch (err) {
      if (!(err instanceof BillingAnomaly)) throw err;
      out.anomalies++;
      logger.error({ invoiceId: invoice.id, code: err.outcome }, "billing reconcile: paid invoice needs an operator");
    }
  }
  return out;
}

/** The columns a local row must agree on with Stripe; plans and intervals through the same mapping an event uses. */
function differs(local: typeof subscriptions.$inferSelect, sub: Stripe.Subscription): boolean {
  const { values: v } = subscriptionRow(sub, local.userId);
  return (
    local.plan !== v.plan || local.interval !== v.interval || local.status !== v.status || local.cancelAtPeriodEnd !== v.cancelAtPeriodEnd ||
    local.collectionPaused !== v.collectionPaused || local.currentPeriodEnd?.getTime() !== v.currentPeriodEnd?.getTime()
  );
}

/**
 * R2: subscriptions that differ from Stripe are synced now, from a fresh refetch under the customer's lock, so a snapshot of
 * the list can never overwrite a newer event. A live subscription the local row does not track is one whose events were lost.
 * Two live on one customer (a double checkout) is reported, for an operator: nothing here picks one.
 */
async function reconcileSubscriptions(api: ReconcileApi): Promise<{ drifted: number; synced: number; doubleLive: number; anomalies: number }> {
  const [remote, locals] = [await api.allSubscriptions(), await db().select().from(subscriptions).where(isNotNull(subscriptions.stripeCustomerId))];
  const byId = new Map(remote.map((s) => [s.id, s]));
  const live = new Map<string, Stripe.Subscription[]>();
  for (const s of remote) {
    const customer = customerOf(s);
    if (customer && !LIVE_ENDED.has(s.status)) live.set(customer, [...(live.get(customer) ?? []), s]);
  }
  const out = { drifted: 0, synced: 0, doubleLive: [...live.values()].filter((subs) => subs.length > 1).length, anomalies: 0 };
  const sync = async (customer: string, sub: Stripe.Subscription) => {
    out.drifted++;
    try {
      const done = await applyWithoutEvent(db(), customer, { kind: "subscription", subscriptionId: sub.id, customerId: customer }, api.fetch);
      if (done.outcome === "subscription_synced") out.synced++;
    } catch (err) {
      if (!(err instanceof BillingAnomaly)) throw err;
      out.anomalies++;
      logger.error({ subscriptionId: sub.id, code: err.outcome }, "billing reconcile: subscription needs an operator");
    }
  };
  for (const local of locals) {
    const customer = local.stripeCustomerId!;
    const tracked = local.stripeSubscriptionId ? byId.get(local.stripeSubscriptionId) : undefined;
    const liveHere = live.get(customer) ?? [];
    if (local.stripeSubscriptionId && !tracked) {
      // Not in the list: deleted at Stripe, or created after the list was taken. Stripe is asked before anything is written.
      out.drifted++;
      let status: string | null = null;
      try {
        status = await refetchTrackedSubscription(db(), customer, local.userId, local.stripeSubscriptionId, api.fetch);
      } catch (err) {
        if (!(err instanceof BillingAnomaly)) throw err;
        out.anomalies++;
        logger.error({ subscriptionId: local.stripeSubscriptionId, code: err.outcome }, "billing reconcile: subscription needs an operator");
        continue;
      }
      if (status) out.synced++;
      // Still live at Stripe, or the save was refused: the row keeps tracking it, and no listed subscription replaces it.
      if (!status || !LIVE_ENDED.has(status)) continue;
    }
    // Compared under a catch: an unmapped price is an anomaly to report, and the next row must still be checked.
    let stale = false;
    try {
      stale = tracked ? differs(local, tracked) : false;
    } catch (err) {
      if (!(err instanceof BillingAnomaly)) throw err;
      out.anomalies++;
    }
    // Stripe's only live subscription replaces an ended tracked one first: syncing the ended one would only write Free.
    const replacement = liveHere.length === 1 && liveHere[0]!.id !== local.stripeSubscriptionId && (!tracked || LIVE_ENDED.has(tracked.status)) ? liveHere[0] : undefined;
    if (replacement) await sync(customer, replacement);
    else if (tracked && stale) await sync(customer, tracked);
  }
  return out;
}

const RECURRING: Record<BillingInterval, { interval: string; count: number }> = { week: { interval: "week", count: 1 }, month: { interval: "month", count: 1 }, quarter: { interval: "month", count: 3 } };

/** R5 (billing-56): each configured price against plans.ts. Reported only: a pricing change is the owner's. */
export async function priceMismatches(prices: Record<string, string>, read: ReconcileApi["price"]): Promise<string[]> {
  const out: string[] = [];
  for (const [key, id] of Object.entries(prices)) {
    const [plan, interval] = key.split(":") as [PlanId, BillingInterval];
    if (!PLAN_IDS.includes(plan) || !BILLING_INTERVALS.includes(interval)) {
      out.push(key);
      continue;
    }
    const price = await read(id);
    const want = RECURRING[interval];
    const usd = getPlan(plan).priceUsd[interval];
    if (usd === null || !price || price.unit_amount !== usd * 100 || price.currency !== "usd" || price.recurring?.interval !== want.interval || price.recurring?.interval_count !== want.count) out.push(key);
  }
  return out;
}

/**
 * Daily (billing-55, 56, v07): the only heal for a webhook lost for good. Grants a paid invoice of the last 7 days that has
 * none, syncs subscriptions that differ from Stripe, counts double-live customers, past-due graces that ran out, Stripe prices
 * that differ from plans.ts, and balances that left their recount. Each step's write is insert-once or a fresh refetch, so a run
 * can overlap an event or another run. A step that cannot reach Stripe fails the run: BullMQ retries it, and tomorrow's run
 * covers the same 7 days. BILL-7 pages if none succeeds for 26 hours.
 *
 * ponytail: a past-due grace needs no write today: effectivePlan reads the anchor, so an expired one is Free at once. The count
 * is here because WP-36 adds what expiry must do to Autopilot (R4). Both listings hold every object in memory: about 5 MB at
 * 10,000 users. At 50,000, compare only rows updated in the last 8 days, as workers/09 section 9 says.
 */
export async function processBillingReconcile(api: ReconcileApi | null = env().STRIPE_SECRET_KEY ? liveApi() : null) {
  if (!api) return { skipped: "no Stripe key" };
  const invoices = await reconcileInvoices(api);
  const subs = await reconcileSubscriptions(api);
  const mismatched = await priceMismatches(env().STRIPE_PRICES, api.price);
  const [grace] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "past_due"), sql`${subscriptions.pastDueSince} < ${new Date(Date.now() - PAST_DUE_GRACE_MS)}::timestamptz`));
  const balanceDrift = (await db().execute(BALANCE_DRIFT)).rows.length;
  const report = {
    invoicesListed: invoices.listed, missingGrants: invoices.granted, subscriptionDrift: subs.drifted, synced: subs.synced, doubleLive: subs.doubleLive,
    anomalies: invoices.anomalies + subs.anomalies, priceMismatch: mismatched.length, graceExpired: grace?.n ?? 0, balanceDrift,
  };
  gauge("billing.reconcile.missing_grants", report.missingGrants);
  gauge("billing.reconcile.subscription_drift", report.subscriptionDrift);
  gauge("billing.reconcile.double_live", report.doubleLive);
  gauge("billing.reconcile.price_mismatch", report.priceMismatch);
  gauge("billing.reconcile.grace_expired", report.graceExpired);
  gauge("billing.reconcile.balance_drift", report.balanceDrift);
  gauge("billing.reconcile.success", 1);
  const findings = report.missingGrants + report.subscriptionDrift + report.doubleLive + report.anomalies + report.priceMismatch + report.balanceDrift;
  logger[findings ? "warn" : "info"]({ ...report, prices: mismatched }, "billing reconcile");
  if (findings) signal("billing_reconcile_findings", findings);
  if (report.missingGrants) signal("billing_grants_missing", report.missingGrants);
  return report;
}
