import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { getPlan } from "@auto-career/shared";
import type { Db } from "../src/db/client";
import { logger } from "../src/lib/logger";
import {
  cancelBillingForDeletedUser,
  couponIdsOf,
  effectivePlan,
  fetchStripeState,
  invoiceGrant,
  processStripeEvent,
  subscriptionRow,
  type StripeEventDeps,
  type StripeFetchDeps,
} from "../src/services/billing-events";
import { planFor } from "../src/services/submissions";
import { creditsPerInvoice } from "../src/services/stripe";

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

type InvoiceOpts = { id?: string; amountPaid?: number; userId?: string | null; hasMore?: boolean; subscription?: string | null };
const line = (price: string, proration = false) => ({ pricing: { price_details: { price } }, parent: { subscription_item_details: { proration } } });

function invoice(prices: string[], opts: InvoiceOpts = {}): Stripe.Invoice {
  const metadata = opts.userId === null ? {} : { userId: opts.userId ?? "u1" };
  return {
    id: opts.id ?? "in_1",
    amount_paid: opts.amountPaid ?? 1900,
    customer: "cus_1",
    discounts: [],
    lines: { data: prices.map((price) => line(price)), has_more: opts.hasMore ?? false },
    parent: { subscription_details: { metadata, subscription: opts.subscription === undefined ? "sub_1" : opts.subscription } },
  } as unknown as Stripe.Invoice;
}

function event(type: string, object: unknown): Stripe.Event {
  return { id: "evt_1", type, data: { object } } as unknown as Stripe.Event;
}

function deps(overrides: Partial<StripeEventDeps> = {}): StripeEventDeps {
  return {
    recordEvent: vi.fn(async () => true),
    userExists: vi.fn(async () => true),
    userForCustomer: vi.fn(async () => null),
    saveSubscription: vi.fn(async () => undefined),
    grantCredits: vi.fn(async () => undefined),
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

  it("throws on a price missing from STRIPE_PRICES, so the event is retried instead of lost", () => {
    expect(() => subscriptionRow(sub("active", { price: "price_retired" }), "u1")).toThrow(/anomaly_unmapped_price/);
  });
});

describe("invoiceGrant", () => {
  it("grants from the first line with a known price", () => {
    expect(invoiceGrant(invoice(["price_unknown", "price_starter_month"]))).toEqual({ delta: 1000, stripeInvoiceId: "in_1" });
  });

  it("grants nothing for a $0 invoice (a 100% promotion code or a trial)", () => {
    expect(invoiceGrant(invoice(["price_starter_month"], { amountPaid: 0 }))).toBeNull();
  });

  it("grants a $0 invoice only when one of its coupons is in STRIPE_GRANT_COUPONS", () => {
    const free = invoice(["price_starter_month"], { amountPaid: 0 });
    expect(invoiceGrant(free, free.lines.data, ["BETA100"])).toEqual({ delta: 1000, stripeInvoiceId: "in_1" });
    expect(invoiceGrant(free, free.lines.data, ["OTHER100"])).toBeNull();
  });

  it("throws when no regular line has a known price, so a paid invoice is never silently dropped", () => {
    expect(() => invoiceGrant(invoice(["price_retired"]))).toThrow(/anomaly_unmapped_price/);
  });

  it("decides from the full line list when the event's inline lines were truncated", () => {
    const truncated = invoice([], { hasMore: true });
    expect(invoiceGrant(truncated, [line("price_pro_week")] as unknown as Stripe.InvoiceLineItem[])).toEqual({
      delta: creditsPerInvoice("pro", "week"),
      stripeInvoiceId: "in_1",
    });
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

describe("fetchStripeState (Stripe calls made before the transaction)", () => {
  it("refetches the subscription of a subscription event", async () => {
    const f = fetchDeps();
    const state = await fetchStripeState(event("customer.subscription.updated", sub("active")), f);
    expect(f.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(state.subscription?.id).toBe("sub_1");
  });

  it("refetches the subscription of a failed payment, and nothing for an invoice without one", async () => {
    const f = fetchDeps();
    expect((await fetchStripeState(event("invoice.payment_failed", invoice([], { subscription: "sub_9" })), f)).subscription?.id).toBe("sub_9");
    expect(await fetchStripeState(event("invoice.payment_failed", invoice([], { subscription: null })), f)).toEqual({});
    expect(f.retrieveSubscription).toHaveBeenCalledTimes(1);
  });

  it("fetches all lines only for a truncated invoice, and coupons only for a $0 invoice", async () => {
    const f = fetchDeps({ invoiceCouponIds: vi.fn(async () => ["BETA100"]) });
    expect(await fetchStripeState(event("invoice.paid", invoice(["price_starter_month"])), f)).toEqual({});
    expect(f.listInvoiceLines).not.toHaveBeenCalled();
    expect(f.invoiceCouponIds).not.toHaveBeenCalled();

    expect(await fetchStripeState(event("invoice.paid", invoice([], { hasMore: true, amountPaid: 0 })), f)).toEqual({ lines: [], couponIds: ["BETA100"] });
    expect(f.listInvoiceLines).toHaveBeenCalledWith("in_1");
    expect(f.invoiceCouponIds).toHaveBeenCalledWith("in_1");
  });

  it("fetches nothing for refunds, disputes and other types", async () => {
    const f = fetchDeps();
    for (const type of ["charge.refunded", "charge.dispute.created", "charge.succeeded"]) expect(await fetchStripeState(event(type, {}), f)).toEqual({});
    expect(f.retrieveSubscription).not.toHaveBeenCalled();
  });
});

describe("processStripeEvent", () => {
  it("skips handlers for a duplicate event", async () => {
    const d = deps({ recordEvent: vi.fn(async () => false) });
    await expect(processStripeEvent(event("invoice.paid", invoice(["price_starter_month"])), {}, d)).resolves.toBe("duplicate");
    expect(d.grantCredits).not.toHaveBeenCalled();
    expect(d.saveSubscription).not.toHaveBeenCalled();
  });

  it("saves the fetched subscription, not the payload", async () => {
    const d = deps();
    await expect(processStripeEvent(event("customer.subscription.updated", sub("active")), { subscription: sub("canceled") }, d)).resolves.toBe("processed");
    const saved = vi.mocked(d.saveSubscription).mock.calls[0]?.[0];
    expect(saved?.values.plan).toBe("free");
    expect(saved?.values.status).toBe("canceled");
  });

  it("rejects when a handler fails", async () => {
    const d = deps({ grantCredits: vi.fn(async () => Promise.reject(new Error("db blip"))) });
    await expect(processStripeEvent(event("invoice.paid", invoice(["price_starter_month"])), {}, d)).rejects.toThrow("db blip");
  });

  it("ignores unrelated event types", async () => {
    const d = deps();
    await expect(processStripeEvent(event("charge.succeeded", {}), {}, d)).resolves.toBe("ignored");
    expect(d.recordEvent).toHaveBeenCalledWith("evt_1", "charge.succeeded");
    expect(d.saveSubscription).not.toHaveBeenCalled();
    expect(d.grantCredits).not.toHaveBeenCalled();
  });

  it("grants a paid invoice to the user in its metadata", async () => {
    const d = deps();
    await expect(processStripeEvent(event("invoice.paid", invoice(["price_starter_month"])), {}, d)).resolves.toBe("processed");
    expect(d.grantCredits).toHaveBeenCalledWith({ userId: "u1", delta: 1000, stripeInvoiceId: "in_1" });
  });

  it("records a $0 invoice as ignored and grants nothing", async () => {
    const d = deps();
    await expect(processStripeEvent(event("invoice.paid", invoice(["price_starter_month"], { amountPaid: 0 })), {}, d)).resolves.toBe("ignored");
    expect(d.recordEvent).toHaveBeenCalled();
    expect(d.grantCredits).not.toHaveBeenCalled();
  });

  it("grants a $0 invoice whose prefetched coupon is allowlisted", async () => {
    const d = deps();
    const free = invoice(["price_starter_month"], { amountPaid: 0 });
    await expect(processStripeEvent(event("invoice.paid", free), { couponIds: ["BETA100"] }, d)).resolves.toBe("processed");
    expect(d.grantCredits).toHaveBeenCalledWith({ userId: "u1", delta: 1000, stripeInvoiceId: "in_1" });
  });

  it("throws on an unknown price, for invoices and subscriptions, so the transaction rolls back and Stripe retries", async () => {
    await expect(processStripeEvent(event("invoice.paid", invoice(["price_retired"])), {}, deps())).rejects.toThrow(/anomaly_unmapped_price/);
    const s = sub("active", { price: "price_retired" });
    await expect(processStripeEvent(event("customer.subscription.updated", s), { subscription: s }, deps())).rejects.toThrow(/anomaly_unmapped_price/);
  });

  it("falls back to the user who owns the Stripe customer when the metadata has no userId", async () => {
    const d = deps({ userForCustomer: vi.fn(async () => "u7") });
    await processStripeEvent(event("invoice.paid", invoice(["price_starter_month"], { userId: null })), {}, d);
    expect(d.userForCustomer).toHaveBeenCalledWith("cus_1");
    expect(d.grantCredits).toHaveBeenCalledWith({ userId: "u7", delta: 1000, stripeInvoiceId: "in_1" });

    const s = sub("active", { userId: "" });
    await processStripeEvent(event("customer.subscription.updated", s), { subscription: s }, d);
    expect(vi.mocked(d.saveSubscription).mock.calls[0]?.[0].userId).toBe("u7");
  });

  it("throws when no user matches, so the event is retried while someone looks", async () => {
    await expect(processStripeEvent(event("invoice.paid", invoice(["price_starter_month"], { userId: null })), {}, deps())).rejects.toThrow(/anomaly_no_user/);
  });

  it("ignores events for an erased user: no grant, no write, no retry loop", async () => {
    const d = deps({ userExists: vi.fn(async () => false) });
    await expect(processStripeEvent(event("invoice.paid", invoice(["price_starter_month"])), {}, d)).resolves.toBe("ignored");
    await expect(processStripeEvent(event("customer.subscription.deleted", sub("canceled")), { subscription: sub("canceled") }, d)).resolves.toBe("ignored");
    expect(d.grantCredits).not.toHaveBeenCalled();
    expect(d.saveSubscription).not.toHaveBeenCalled();
  });

  it("syncs a failed payment from the refetched subscription", async () => {
    const d = deps();
    await expect(processStripeEvent(event("invoice.payment_failed", invoice([])), { subscription: sub("past_due") }, d)).resolves.toBe("processed");
    expect(vi.mocked(d.saveSubscription).mock.calls[0]?.[0].values).toMatchObject({ status: "past_due", plan: "pro" });
    await expect(processStripeEvent(event("invoice.payment_failed", invoice([], { subscription: null })), {}, d)).resolves.toBe("ignored");
  });

  it("refunds and disputes alert only: an error log for the operator, no credit or plan change", async () => {
    const alert = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const d = deps();
    const charge = { id: "ch_1", amount: 1900, amount_refunded: 1900, customer: "cus_1", invoice: "in_1" };
    await expect(processStripeEvent(event("charge.refunded", charge), {}, d)).resolves.toBe("processed");
    await expect(processStripeEvent(event("charge.dispute.created", { id: "dp_1", amount: 1900, charge: "ch_1", reason: "fraudulent" }), {}, d)).resolves.toBe("processed");
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

// Shared vectors with the SQL effective_plan() of _db/billing.md 3.1 (T-9) when that function lands.
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
  it("skips proration lines when choosing the plan", () => {
    const line = (price: string, proration: boolean) => ({
      pricing: { price_details: { price } },
      parent: { subscription_item_details: { proration } },
    });
    const upgraded = {
      id: "in_2",
      amount_paid: 2100,
      lines: { data: [line("price_starter_month", true), line("price_pro_week", true), line("price_pro_week", false)] },
      parent: { subscription_details: { metadata: { userId: "u1" } } },
    } as unknown as Stripe.Invoice;
    expect(invoiceGrant(upgraded)).toEqual({ delta: creditsPerInvoice("pro", "week"), stripeInvoiceId: "in_2" });
  });

  it("grants nothing for an invoice made only of prorations", () => {
    const onlyProrations = {
      id: "in_3",
      amount_paid: 900,
      lines: { data: [{ pricing: { price_details: { price: "price_pro_week" } }, parent: { subscription_item_details: { proration: true } } }] },
      parent: { subscription_details: { metadata: { userId: "u1" } } },
    } as unknown as Stripe.Invoice;
    expect(invoiceGrant(onlyProrations)).toBeNull();
  });
});
