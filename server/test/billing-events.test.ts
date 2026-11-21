import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { getPlan } from "@auto-career/shared";
import type { Db } from "../src/db/client";
import { logger } from "../src/lib/logger";
import {
  cancelBillingForDeletedUser,
  couponIdsOf,
  effectivePlan,
  buildEventExtract,
  classifyError,
  BillingAnomaly,
  fetchStripeState,
  invoiceExtract,
  invoiceGrant,
  processStripeEvent,
  stripeEventPayload,
  subscriptionRow,
  type StoredEvent,
  type StripeEventDeps,
  type StripeFetchDeps,
} from "../src/services/billing-events";
import { planFor } from "../src/services/submissions";
import { creditsPerInvoice } from "../src/services/stripe";
import { grantNote, rolloverCap, rolloverExpiry } from "../src/services/credits";
import { priceMismatches, redriveDue } from "../src/jobs/billing-reconcile";

// env() is read lazily; this runs before the first read.
vi.hoisted(() => {
  process.env.STRIPE_GRANT_COUPONS = "BETA100";
});

function sub(status: string, opts: { price?: string; userId?: string; id?: string } = {}): Stripe.Subscription {
  return {
    id: opts.id ?? "sub_1",
    status,
    customer: "cus_1",
    metadata: opts.userId === undefined ? { userId: "u1" } : opts.userId ? { userId: opts.userId } : {},
    cancel_at_period_end: false,
    pause_collection: null,
    items: { data: [{ price: { id: opts.price ?? "price_pro_week" }, current_period_end: 1_900_000_000 }] },
  } as unknown as Stripe.Subscription;
}

type InvoiceOpts = { id?: string; amountPaid?: number; total?: number; paidAt?: number | null; userId?: string | null; hasMore?: boolean; subscription?: string | null };
const PAID_AT = 1_800_000_000;
const PERIOD_END = PAID_AT + 30 * 86_400;
const line = (price: string, proration = false, end = PERIOD_END) => ({
  pricing: { price_details: { price } },
  parent: { subscription_item_details: { proration } },
  period: { start: end - 30 * 86_400, end },
});

function invoice(prices: string[], opts: InvoiceOpts = {}): Stripe.Invoice {
  const metadata = opts.userId === null ? {} : { userId: opts.userId ?? "u1" };
  return {
    id: opts.id ?? "in_1",
    amount_paid: opts.amountPaid ?? 1900,
    total: opts.total ?? opts.amountPaid ?? 1900,
    status_transitions: { paid_at: opts.paidAt === undefined ? PAID_AT : opts.paidAt },
    customer: "cus_1",
    discounts: [],
    lines: { data: prices.map((price) => line(price)), has_more: opts.hasMore ?? false },
    parent: { subscription_details: { metadata, subscription: opts.subscription === undefined ? "sub_1" : opts.subscription } },
  } as unknown as Stripe.Invoice;
}

function event(type: string, object: unknown): Stripe.Event {
  return { id: "evt_1", type, created: 1_800_000_000, data: { object } } as unknown as Stripe.Event;
}

/** The event as processing sees it: through the same extract the route stores. */
function stored(type: string, object: unknown): StoredEvent {
  const e = event(type, object);
  return { id: e.id, type, created: new Date(e.created * 1000), payload: buildEventExtract(e).payload };
}
const inv = (prices: string[], opts: InvoiceOpts = {}) => invoiceExtract(invoice(prices, opts));

function deps(overrides: Partial<StripeEventDeps> = {}): StripeEventDeps {
  return {
    userExists: vi.fn(async () => true),
    userForCustomer: vi.fn(async () => null),
    customerErased: vi.fn(async () => false),
    userErased: vi.fn(async () => false),
    saveSubscription: vi.fn(async () => "saved" as const),
    grantCredits: vi.fn(async () => "applied" as const),
    ...overrides,
  };
}

function fetchDeps(overrides: Partial<StripeFetchDeps> = {}): StripeFetchDeps {
  return {
    retrieveSubscription: vi.fn(async (id: string) => sub("active", { id })),
    listInvoiceLines: vi.fn(async () => []),
    invoiceCouponIds: vi.fn(async () => []),
    ...overrides,
  };
}

describe("subscriptionRow", () => {
  it("maps a past_due subscription to its paid plan", () => {
    const row = subscriptionRow(sub("past_due"), "u1");
    expect(row.userId).toBe("u1");
    expect(row.values.plan).toBe("pro");
    expect(row.values.interval).toBe("week");
  });

  it("maps a canceled subscription to free", () => {
    const row = subscriptionRow(sub("canceled"), "u1");
    expect(row.values.plan).toBe("free");
    expect(row.values.interval).toBeNull();
    expect(row.values.status).toBe("canceled");
  });

  it("throws on a price missing from STRIPE_PRICES, so the event goes dead for an operator instead of being lost", () => {
    expect(() => subscriptionRow(sub("active", { price: "price_retired" }), "u1")).toThrow(/anomaly_unmapped_price/);
  });
});

describe("invoiceGrant", () => {
  const starter = { delta: 1000, stripeInvoiceId: "in_1", plan: "starter", interval: "month", periodEnd: new Date(PERIOD_END * 1000), paidAt: new Date(PAID_AT * 1000) };

  it("grants from the first line with a known price", () => {
    expect(invoiceGrant(inv(["price_unknown", "price_starter_month"]))).toEqual(starter);
  });

  it("grants nothing for a $0 invoice (a 100% promotion code or a trial)", () => {
    expect(invoiceGrant(inv(["price_starter_month"], { amountPaid: 0 }))).toEqual({ outcome: "zero_amount" });
  });

  it("grants a $0 invoice only when one of its coupons is in STRIPE_GRANT_COUPONS", () => {
    const free = inv(["price_starter_month"], { amountPaid: 0 });
    expect(invoiceGrant(free, free.lines, ["BETA100"])).toEqual(starter);
    expect(invoiceGrant(free, free.lines, ["OTHER100"])).toEqual({ outcome: "zero_amount" });
  });

  it("throws when no regular line has a known price, so a paid invoice is never silently dropped", () => {
    expect(() => invoiceGrant(inv(["price_retired"]))).toThrow(/anomaly_unmapped_price/);
  });

  it("decides from the full line list when the event's inline lines were truncated", () => {
    expect(invoiceGrant(inv([], { hasMore: true }), [{ priceId: "price_pro_week", proration: false, periodEnd: PERIOD_END }])).toEqual({
      delta: creditsPerInvoice("pro", "week"),
      stripeInvoiceId: "in_1",
      plan: "pro",
      interval: "week",
      periodEnd: new Date(PERIOD_END * 1000),
      paidAt: new Date(PAID_AT * 1000),
    });
  });

  it("a missing amount never counts as paid", () => {
    expect(invoiceExtract({ ...invoice(["price_pro_week"]), amount_paid: undefined } as unknown as Stripe.Invoice).amountPaid).toBe(0);
    expect(invoiceExtract({ ...invoice(["price_pro_week"]), total: undefined } as unknown as Stripe.Invoice).total).toBe(0);
  });

  it("grants a renewal the customer's balance paid: amount_paid 0, total above 0 (a downgrade's proration credit)", () => {
    expect(invoiceGrant(inv(["price_starter_month"], { amountPaid: 0, total: 1900 }))).toEqual(starter);
  });

  it("grants nothing when the total is 0 or below, whatever was charged", () => {
    expect(invoiceGrant(inv(["price_starter_month"], { amountPaid: 0, total: 0 }))).toEqual({ outcome: "zero_amount" });
    expect(invoiceGrant(inv(["price_starter_month"], { amountPaid: 0, total: -500 }))).toEqual({ outcome: "zero_amount" });
  });

  it("takes paidAt from status_transitions.paid_at and periodEnd from the line that decides, not a proration line", () => {
    const extract = invoiceExtract({
      ...invoice([]),
      lines: { data: [line("price_starter_month", true, PERIOD_END - 86_400), line("price_pro_week", false, PAID_AT + 7 * 86_400)], has_more: false },
    } as unknown as Stripe.Invoice);
    expect(extract.paidAt).toBe(PAID_AT);
    expect(extract.lines.map((l) => l.periodEnd)).toEqual([PERIOD_END - 86_400, PAID_AT + 7 * 86_400]);
    expect(invoiceGrant(extract)).toMatchObject({ plan: "pro", periodEnd: new Date((PAID_AT + 7 * 86_400) * 1000), paidAt: new Date(PAID_AT * 1000) });
  });

  it("null when Stripe gave no paid moment or no period", () => {
    const extract = invoiceExtract({ ...invoice([], { paidAt: null }), lines: { data: [{ pricing: { price_details: { price: "price_pro_week" } } }], has_more: false } } as unknown as Stripe.Invoice);
    expect(extract.paidAt).toBeNull();
    expect(invoiceGrant(extract)).toMatchObject({ periodEnd: null, paidAt: null });
  });
});

describe("couponIdsOf", () => {
  it("reads coupon ids from expanded discounts and skips anything unexpanded", () => {
    const inv = {
      discounts: ["di_unexpanded", { source: { coupon: "BETA100" } }, { source: { coupon: { id: "FOUNDERS" } } }, { source: { coupon: null } }],
    } as unknown as Stripe.Invoice;
    expect(couponIdsOf(inv)).toEqual(["BETA100", "FOUNDERS"]);
  });
});

describe("rolloverCap (WP-32 G3 option B): the grant the cap doubles, at the invoice's paid moment", () => {
  const at = new Date("2020-03-15T00:00:00Z");
  const grant = (delta: number, until: string | null, createdAt = "2020-01-01T00:00:00Z") => ({
    delta,
    note: grantNote("pro", "quarter", until ? new Date(until) : null),
    createdAt: new Date(createdAt),
  });

  it.each([
    ["no earlier grant", [], 1000],
    ["a larger grant whose period still runs", [grant(3600, "2020-04-01T00:00:00Z")], 3600],
    ["a larger grant whose period ended", [grant(3600, "2020-03-14T00:00:00Z")], 1000],
    ["one ending exactly at the paid moment", [grant(3600, "2020-03-15T00:00:00Z")], 1000],
    ["one with an hour or less left: a renewal at the old period's end", [grant(3600, "2020-03-15T01:00:00Z")], 1000],
    ["one with just over an hour left", [grant(3600, "2020-03-15T01:00:01Z")], 3600],
    ["a smaller running grant never lowers the cap", [grant(234, "2020-04-01T00:00:00Z")], 1000],
    ["the largest of several running", [grant(1200, "2020-04-01T00:00:00Z"), grant(3000, "2020-05-01T00:00:00Z"), grant(9000, "2020-03-01T00:00:00Z")], 3000],
    ["a note without an end runs three months from its row", [grant(3600, null, "2019-12-16T00:00:00Z")], 3600],
    ["a note without an end is over after three months", [grant(3600, null, "2019-12-14T00:00:00Z")], 1000],
  ])("%s", (_name, earlier, cap) => {
    expect(rolloverCap(1000, earlier, at)).toBe(cap);
  });

  it("reads only Stripe's moments, never the clock: a replay years later gives the same cap", () => {
    const earlier = [grant(3600, "2020-04-01T00:00:00Z"), grant(1200, "2020-03-01T00:00:00Z")];
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2020-03-15T00:00:00Z"));
      const onTime = rolloverCap(1000, earlier, at);
      vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
      expect(rolloverCap(1000, earlier, at)).toBe(onTime);
      expect(onTime).toBe(3600);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a malformed end falls back to three months, never to 'ended'", () => {
    expect(rolloverCap(1000, [{ delta: 3600, note: "plan=pro interval=quarter until=garbage", createdAt: new Date("2020-02-01T00:00:00Z") }], at)).toBe(3600);
  });
});

describe("rolloverExpiry (billing-37, T-BE-1, T-8)", () => {
  it.each([
    [0 + 1000, 0, 1000, 0],
    [2000, 0, 1000, 0], // exactly at the cap
    [2001, 0, 1000, 1], // one over
    [3500, 20, 1000, 1480], // the worked example of _db/billing.md 4.2
    [2050, 50, 1000, 0], // what approved applications hold never expires
    [3000, 2500, 234, 32], // weekly, in flight above the cap
    [40, 100, 1000, 0], // a balance below its reservations
  ])("balance %i, in flight %i, grant %i expires %i", (balance, inFlight, grant, expiry) => {
    expect(rolloverExpiry(balance, inFlight, grant)).toBe(expiry);
  });
});

describe("buildEventExtract (T-BE-5): the stored form holds ids and integers, never what a raw event carries", () => {
  const MARKERS = { name: "MARKERNAME Doe", customer_name: "MARKERNAME", customer_email: "marker@example.com", customer_address: { line1: "1 MARKER Street" }, billing_details: { email: "marker@example.com" }, description: "MARKER" };

  it.each([
    ["customer.subscription.updated", { ...MARKERS, ...sub("active") }],
    ["customer.subscription.deleted", { ...MARKERS, ...sub("canceled") }],
    ["invoice.paid", { ...MARKERS, ...invoice(["price_pro_week"]) }],
    ["invoice.payment_failed", { ...MARKERS, ...invoice([]) }],
    ["charge.refunded", { ...MARKERS, id: "ch_1", amount: 1900, customer: "cus_1" }],
    ["charge.dispute.created", { ...MARKERS, id: "dp_1", amount: 1900, charge: "ch_1" }],
  ])("%s", (type, object) => {
    const { payload } = buildEventExtract(event(type, object));
    expect(payload).not.toBeNull();
    expect(stripeEventPayload.safeParse(payload).success).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/marker/i);
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThanOrEqual(4096);
  });

  it("stores nothing of a type it does not handle, and keeps the row's ids", () => {
    expect(buildEventExtract(event("customer.updated", { ...MARKERS, id: "cus_1" }))).toEqual({ objectId: "cus_1", customerId: null, payload: null });
  });

  it("a metadata user id that is not id-shaped cannot reach the row: the payload is null, and the handled type goes dead", () => {
    expect(buildEventExtract(event("invoice.paid", invoice(["price_pro_week"], { userId: "ann@example.com" }))).payload).toBeNull();
  });

  it("the worst invoice stays under the row's 4 KB: lines are cut at 20 and flagged, and the rest are fetched", () => {
    const long = invoice(Array.from({ length: 200 }, (_, i) => `price_${"x".repeat(55)}${String(i).padStart(3, "0")}`), {
      id: `in_${"y".repeat(61)}`,
      userId: "u".repeat(64),
      total: -2_000_000_000,
      paidAt: 9_999_999_999,
    });
    const { payload } = buildEventExtract(event("invoice.paid", long));
    expect(payload).toMatchObject({ kind: "invoice", linesTruncated: true });
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThanOrEqual(4096);
  });

  it("an id longer than 64 characters cannot reach the row", () => {
    expect(buildEventExtract(event("invoice.paid", invoice(["price_pro_week"], { id: `in_${"y".repeat(62)}` }))).payload).toBeNull();
  });
});

describe("classifyError (billing-17, T-BE-6)", () => {
  it.each([
    [new BillingAnomaly("anomaly_no_user", "x"), true, "anomaly_no_user"],
    [new BillingAnomaly("anomaly_unmapped_price", "x"), true, "anomaly_unmapped_price"],
    [{ type: "StripeInvalidRequestError", code: "resource_missing" }, true, "stripe_resource_missing"],
    [{ type: "StripeInvalidRequestError" }, true, "stripe_invalid_request"],
    [{ type: "StripeIdempotencyError" }, true, "stripe_idempotency"],
    [{ type: "StripeAuthenticationError" }, false, "stripe_auth"],
    [{ type: "StripePermissionError" }, false, "stripe_permission"],
    [{ type: "StripeRateLimitError" }, false, "stripe_rate_limited"],
    [{ type: "StripeConnectionError" }, false, "stripe_connection"],
    [{ type: "StripeAPIError" }, false, "stripe_5xx"],
    [{ code: "40001" }, false, "db_serialization"],
    [{ cause: { code: "40P01" } }, false, "db_deadlock"],
    [{ code: "55P03" }, false, "db_lock_timeout"],
    [{ code: "08006" }, false, "db_unavailable"],
    [{ code: "57P01" }, false, "db_unavailable"],
    [{ code: "25P03" }, false, "db_unavailable"],
    [{ cause: { code: "23505", constraint: "subscriptions_stripe_customer_id_unique" } }, true, "customer_conflict"],
    [{ cause: { code: "23505", constraint: "subscriptions_stripe_subscription_id_unique" } }, true, "customer_conflict"],
    [{ code: "23505", constraint: "something_else" }, false, "unexpected"],
    [new Error("anything"), false, "unexpected"],
  ])("%j", (err, permanent, code) => {
    expect(classifyError(err)).toMatchObject({ permanent, code });
  });
});

describe("the retry rounds", () => {
  const received = new Date("2026-11-01T00:00:00Z");
  it("reopens at once the first time, then 12 hours further on from receipt each time", () => {
    expect(redriveDue(received, 0, received.getTime())).toBe(true);
    expect(redriveDue(received, 1, received.getTime() + 12 * 3600_000 - 1)).toBe(false);
    expect(redriveDue(received, 1, received.getTime() + 12 * 3600_000)).toBe(true);
    expect(redriveDue(received, 5, received.getTime() + 59 * 3600_000)).toBe(false);
    expect(redriveDue(received, 5, received.getTime() + 60 * 3600_000)).toBe(true);
  });
});

describe("priceMismatches (billing-56, T-BE-17)", () => {
  const right = (cents: number, interval = "month", count = 1) => ({ unit_amount: cents, currency: "usd", recurring: { interval, interval_count: count } }) as unknown as Stripe.Price;
  it("is empty when each price equals plans.ts", async () => {
    const prices = { "starter:week": "p1", "starter:month": "p2", "starter:quarter": "p3" };
    const read = async (id: string) => ({ p1: right(600, "week"), p2: right(1900), p3: right(4500, "month", 3) })[id]!;
    await expect(priceMismatches(prices, read)).resolves.toEqual([]);
  });
  it("names an amount, a currency, a period or a price Stripe does not have", async () => {
    const prices = { "pro:week": "amount", "pro:month": "currency", "pro:quarter": "period", "max:week": "gone" };
    const read = async (id: string) => ({ amount: right(1, "week"), currency: { ...right(3900), currency: "inr" } as Stripe.Price, period: right(9500), gone: null })[id] ?? null;
    await expect(priceMismatches(prices, read)).resolves.toEqual(["pro:week", "pro:month", "pro:quarter", "max:week"]);
  });
  it("names a key that is not a plan and an interval", async () => {
    await expect(priceMismatches({ "gold:month": "p" }, async () => right(1))).resolves.toEqual(["gold:month"]);
  });
});

describe("fetchStripeState (the Stripe calls of one event, inside its customer's lock)", () => {
  it("refetches the subscription of a subscription event", async () => {
    const f = fetchDeps();
    const state = await fetchStripeState(stored("customer.subscription.updated", sub("active")), f);
    expect(f.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(state.subscription?.id).toBe("sub_1");
  });

  it("refetches the subscription of a failed payment, and nothing for an invoice without one", async () => {
    const f = fetchDeps();
    expect((await fetchStripeState(stored("invoice.payment_failed", invoice([], { subscription: "sub_9" })), f)).subscription?.id).toBe("sub_9");
    expect(await fetchStripeState(stored("invoice.payment_failed", invoice([], { subscription: null })), f)).toEqual({});
    expect(f.retrieveSubscription).toHaveBeenCalledTimes(1);
  });

  it("fetches all lines only for a truncated invoice, and coupons only for a $0 invoice", async () => {
    const f = fetchDeps({ invoiceCouponIds: vi.fn(async () => ["BETA100"]) });
    expect(await fetchStripeState(stored("invoice.paid", invoice(["price_starter_month"])), f)).toEqual({});
    expect(f.listInvoiceLines).not.toHaveBeenCalled();
    expect(f.invoiceCouponIds).not.toHaveBeenCalled();

    expect(await fetchStripeState(stored("invoice.paid", invoice([], { hasMore: true, amountPaid: 0 })), f)).toEqual({ lines: [], couponIds: ["BETA100"] });
    expect(f.listInvoiceLines).toHaveBeenCalledWith("in_1");
    expect(f.invoiceCouponIds).toHaveBeenCalledWith("in_1");
  });

  it("fetches nothing for refunds, disputes and other types", async () => {
    const f = fetchDeps();
    const charge = { id: "ch_1", amount: 1900 };
    for (const type of ["charge.refunded", "charge.dispute.created", "charge.succeeded"]) expect(await fetchStripeState(stored(type, charge), f)).toEqual({});
    expect(f.retrieveSubscription).not.toHaveBeenCalled();
  });
});

describe("processStripeEvent", () => {
  const starterGrant = (userId: string) => ({
    userId,
    delta: 1000,
    stripeInvoiceId: "in_1",
    plan: "starter",
    interval: "month",
    periodEnd: new Date(PERIOD_END * 1000),
    paidAt: new Date(PAID_AT * 1000),
  });

  it("saves the fetched subscription, not the payload", async () => {
    const d = deps();
    await expect(processStripeEvent(stored("customer.subscription.updated", sub("active")), { subscription: sub("canceled") }, d)).resolves.toMatchObject({ status: "processed", outcome: "subscription_synced", userId: "u1" });
    const saved = vi.mocked(d.saveSubscription).mock.calls[0]?.[0];
    expect(saved?.values.plan).toBe("free");
    expect(saved?.values.status).toBe("canceled");
    expect(vi.mocked(d.saveSubscription).mock.calls[0]?.[1]).toEqual(new Date(1_800_000_000_000));
  });

  it("reports what the save's guard said", async () => {
    const d = deps({ saveSubscription: vi.fn(async () => "stale" as const) });
    await expect(processStripeEvent(stored("customer.subscription.updated", sub("active")), { subscription: sub("active") }, d)).resolves.toMatchObject({ status: "ignored", outcome: "subscription_stale" });
  });

  it("rejects when a handler fails", async () => {
    const d = deps({ grantCredits: vi.fn(async () => Promise.reject(new Error("db blip"))) });
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"])), {}, d)).rejects.toThrow("db blip");
  });

  it("ignores unrelated event types", async () => {
    const d = deps();
    await expect(processStripeEvent(stored("charge.succeeded", {}), {}, d)).resolves.toMatchObject({ status: "ignored", outcome: "unhandled_type" });
    expect(d.saveSubscription).not.toHaveBeenCalled();
    expect(d.grantCredits).not.toHaveBeenCalled();
  });

  it("grants a paid invoice to the user in its metadata, and says when the grant already existed", async () => {
    const d = deps();
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"])), {}, d)).resolves.toMatchObject({ status: "processed", outcome: "grant_applied", userId: "u1" });
    expect(d.grantCredits).toHaveBeenCalledWith(starterGrant("u1"));
    const again = deps({ grantCredits: vi.fn(async () => "duplicate" as const) });
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"])), {}, again)).resolves.toMatchObject({ status: "processed", outcome: "grant_duplicate" });
  });

  it("records a $0 invoice as ignored and grants nothing", async () => {
    const d = deps();
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"], { amountPaid: 0 })), {}, d)).resolves.toMatchObject({ status: "ignored", outcome: "zero_amount" });
    expect(d.grantCredits).not.toHaveBeenCalled();
  });

  it("grants a $0 invoice whose prefetched coupon is allowlisted", async () => {
    const d = deps();
    const free = invoice(["price_starter_month"], { amountPaid: 0 });
    await expect(processStripeEvent(stored("invoice.paid", free), { couponIds: ["BETA100"] }, d)).resolves.toMatchObject({ status: "processed" });
    expect(d.grantCredits).toHaveBeenCalledWith(starterGrant("u1"));
  });

  it("throws an anomaly on an unknown price, for invoices and subscriptions, so an operator looks instead of the grant being lost", async () => {
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_retired"])), {}, deps())).rejects.toBeInstanceOf(BillingAnomaly);
    const s = sub("active", { price: "price_retired" });
    await expect(processStripeEvent(stored("customer.subscription.updated", s), { subscription: s }, deps())).rejects.toThrow(/anomaly_unmapped_price/);
  });

  it("falls back to the user who owns the Stripe customer when the metadata has no userId", async () => {
    const d = deps({ userForCustomer: vi.fn(async () => "u7") });
    await processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"], { userId: null })), {}, d);
    expect(d.userForCustomer).toHaveBeenCalledWith("cus_1");
    expect(d.grantCredits).toHaveBeenCalledWith(starterGrant("u7"));

    const s = sub("active", { userId: "" });
    await processStripeEvent(stored("customer.subscription.updated", s), { subscription: s }, d);
    expect(vi.mocked(d.saveSubscription).mock.calls[0]?.[0].userId).toBe("u7");
  });

  it("throws when no user matches, so the event waits for someone to look", async () => {
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"], { userId: null })), {}, deps())).rejects.toThrow(/anomaly_no_user/);
  });

  it("ignores events for an erased user: no grant, no write, no retry loop", async () => {
    const d = deps({ userExists: vi.fn(async () => false), userErased: vi.fn(async () => true) });
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"])), {}, d)).resolves.toMatchObject({ status: "ignored", outcome: "user_deleted" });
    await expect(processStripeEvent(stored("customer.subscription.deleted", sub("canceled")), { subscription: sub("canceled") }, d)).resolves.toMatchObject({ outcome: "user_deleted" });
    expect(d.grantCredits).not.toHaveBeenCalled();
    expect(d.saveSubscription).not.toHaveBeenCalled();
  });

  it("throws for a metadata user who neither exists nor was erased, so a typo in the dashboard pages instead of vanishing", async () => {
    const d = deps({ userExists: vi.fn(async () => false) });
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"])), {}, d)).rejects.toThrow(/anomaly_no_user/);
    expect(d.grantCredits).not.toHaveBeenCalled();
  });

  it("throws when the metadata and the customer's owner name different users: never credits the wrong account", async () => {
    const d = deps({ userForCustomer: vi.fn(async () => "u7") });
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"], { userId: "u1" })), {}, d)).rejects.toThrow(/anomaly_no_user/);
    const s = sub("active", { userId: "u1" });
    await expect(processStripeEvent(stored("customer.subscription.updated", s), { subscription: s }, d)).rejects.toThrow(/anomaly_no_user/);
    expect(d.grantCredits).not.toHaveBeenCalled();
    expect(d.saveSubscription).not.toHaveBeenCalled();
  });

  it("agrees when both name the same user", async () => {
    const d = deps({ userForCustomer: vi.fn(async () => "u1") });
    await expect(processStripeEvent(stored("invoice.paid", invoice(["price_starter_month"])), {}, d)).resolves.toMatchObject({ outcome: "grant_applied", userId: "u1" });
  });

  it("ignores a subscription event without metadata for a customer an erasure deleted (WP-25, billing-50)", async () => {
    const d = deps({ customerErased: vi.fn(async (c: string) => c === "cus_1") });
    const s = sub("canceled", { userId: "" });
    await expect(processStripeEvent(stored("customer.subscription.deleted", s), { subscription: s }, d)).resolves.toMatchObject({ outcome: "user_deleted" });
    expect(d.saveSubscription).not.toHaveBeenCalled();
  });

  it("syncs a failed payment from the refetched subscription", async () => {
    const d = deps();
    await expect(processStripeEvent(stored("invoice.payment_failed", invoice([])), { subscription: sub("past_due") }, d)).resolves.toMatchObject({ status: "processed" });
    expect(vi.mocked(d.saveSubscription).mock.calls[0]?.[0].values).toMatchObject({ status: "past_due", plan: "pro" });
    await expect(processStripeEvent(stored("invoice.payment_failed", invoice([], { subscription: null })), {}, d)).resolves.toMatchObject({ status: "ignored" });
  });

  it("refunds and disputes alert only: an error log for the operator, no credit or plan change", async () => {
    const alert = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const d = deps();
    const charge = { id: "ch_1", amount: 1900, amount_refunded: 1900, customer: "cus_1", invoice: "in_1" };
    await expect(processStripeEvent(stored("charge.refunded", charge), {}, d)).resolves.toMatchObject({ status: "processed", outcome: "alert_only" });
    await expect(processStripeEvent(stored("charge.dispute.created", { id: "dp_1", amount: 1900, charge: "ch_1", reason: "fraudulent" }), {}, d)).resolves.toMatchObject({ status: "processed" });
    expect(alert).toHaveBeenCalledTimes(2);
    expect(alert.mock.calls[0]?.[0]).toMatchObject({ type: "charge.refunded", objectId: "ch_1", amount: 1900 });
    expect(d.grantCredits).not.toHaveBeenCalled();
    expect(d.saveSubscription).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});

describe("planFor", () => {
  const dbWith = (row: { plan: string; status: string; pastDueSince?: Date | null }) =>
    ({ select: () => ({ from: () => ({ where: async () => [row] }) }) }) as unknown as Db;
  const DAY = 86_400_000;

  it("keeps the paid plan while past_due", async () => {
    await expect(planFor(dbWith({ plan: "pro", status: "past_due", pastDueSince: new Date(Date.now() - DAY) }), "u1")).resolves.toBe("pro");
  });

  it("drops to free once past_due has lasted 7 days", async () => {
    await expect(planFor(dbWith({ plan: "pro", status: "past_due", pastDueSince: new Date(Date.now() - 8 * DAY) }), "u1")).resolves.toBe("free");
  });

  it("falls back to free when canceled", async () => {
    await expect(planFor(dbWith({ plan: "pro", status: "canceled" }), "u1")).resolves.toBe("free");
  });
});

// The same vectors run against the SQL effective_plan() in credit-balances.int.test.ts (T-9).
describe("effectivePlan", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  it.each([
    ["active", null, "pro"],
    ["trialing", null, "pro"],
    ["past_due", 0, "pro"],
    ["past_due", 6, "pro"],
    ["past_due", 8, "free"],
    ["past_due", null, "free"],
    ["unpaid", null, "free"],
    ["canceled", null, "free"],
    ["incomplete", null, "free"],
    ["incomplete_expired", null, "free"],
    ["paused", null, "free"],
  ] as const)("%s, past due for %s days, is %s", (status, days, expected) => {
    expect(effectivePlan({ plan: "pro", status, pastDueSince: days === null ? null : daysAgo(days) }, now)).toBe(expected);
  });

  it("a past_due user loses the cloud applier after 7 days", () => {
    expect(getPlan(effectivePlan({ plan: "pro", status: "past_due", pastDueSince: daysAgo(6) }, now)).cloudApplier).toBe(true);
    expect(getPlan(effectivePlan({ plan: "pro", status: "past_due", pastDueSince: daysAgo(8) }, now)).cloudApplier).toBe(false);
  });
});

describe("cancelBillingForDeletedUser", () => {
  const api = (subs: { id: string; status: string }[], cancel = vi.fn(async (_id: string) => undefined as unknown)) => ({
    list: vi.fn(async (_customerId: string) => subs),
    cancel,
  });

  it("no Stripe customer means no Stripe call", async () => {
    const stripeApi = api([]);
    await expect(cancelBillingForDeletedUser(null, stripeApi)).resolves.toBe(0);
    expect(stripeApi.list).not.toHaveBeenCalled();
  });

  it("cancels every live subscription of the customer, not just the tracked one", async () => {
    const stripeApi = api([
      { id: "sub_a", status: "active" },
      { id: "sub_b", status: "past_due" },
      { id: "sub_c", status: "canceled" },
      { id: "sub_d", status: "incomplete_expired" },
    ]);
    await expect(cancelBillingForDeletedUser("cus_1", stripeApi)).resolves.toBe(2);
    expect(stripeApi.list).toHaveBeenCalledWith("cus_1");
    expect(stripeApi.cancel.mock.calls.map(([id]) => id)).toEqual(["sub_a", "sub_b"]);
  });

  it("ignores resource_missing", async () => {
    const stripeApi = api([{ id: "sub_a", status: "active" }], vi.fn(async () => Promise.reject({ code: "resource_missing" })));
    await expect(cancelBillingForDeletedUser("cus_1", stripeApi)).resolves.toBe(1);
  });

  it("rethrows other Stripe errors", async () => {
    const stripeApi = api([{ id: "sub_a", status: "active" }], vi.fn(async () => Promise.reject({ code: "api_connection_error" })));
    await expect(cancelBillingForDeletedUser("cus_1", stripeApi)).rejects.toEqual({ code: "api_connection_error" });
  });
});

describe("invoiceGrant with plan changes", () => {
  const line = (price: string, proration: boolean) => ({
    pricing: { price_details: { price } },
    parent: { subscription_item_details: { proration } },
  });
  const inv2 = (id: string, lines: unknown[], amountPaid: number) =>
    invoiceExtract({ id, amount_paid: amountPaid, total: amountPaid, lines: { data: lines, has_more: false }, parent: { subscription_details: { metadata: { userId: "u1" } } } } as unknown as Stripe.Invoice);

  it("skips proration lines when choosing the plan", () => {
    const upgraded = inv2("in_2", [line("price_starter_month", true), line("price_pro_week", true), line("price_pro_week", false)], 2100);
    expect(invoiceGrant(upgraded)).toMatchObject({ delta: creditsPerInvoice("pro", "week"), stripeInvoiceId: "in_2" });
  });

  it("grants nothing for an invoice made only of prorations", () => {
    expect(invoiceGrant(inv2("in_3", [line("price_pro_week", true)], 900))).toEqual({ outcome: "proration_only" });
  });
});
