import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { Db } from "../src/db/client";
import {
  cancelBillingForDeletedUser,
  invoiceGrant,
  processStripeEvent,
  subscriptionRow,
  type StripeEventDeps,
} from "../src/services/billing-events";
import { planFor } from "../src/services/submissions";
import { creditsPerInvoice } from "../src/services/stripe";

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

function invoice(prices: string[], id = "in_1"): Stripe.Invoice {
  return {
    id,
    lines: { data: prices.map((price) => ({ pricing: { price_details: { price } } })) },
    parent: { subscription_details: { metadata: { userId: "u1" } } },
  } as unknown as Stripe.Invoice;
}

function event(type: string, object: unknown): Stripe.Event {
  return { id: "evt_1", type, data: { object } } as unknown as Stripe.Event;
}

function deps(overrides: Partial<StripeEventDeps> = {}): StripeEventDeps {
  return {
    recordEvent: vi.fn(async () => true),
    retrieveSubscription: vi.fn(async (id: string) => sub("active", { id })),
    saveSubscription: vi.fn(async () => undefined),
    grantCredits: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("subscriptionRow", () => {
  it("maps a past_due subscription to its paid plan", () => {
    const row = subscriptionRow(sub("past_due"));
    expect(row?.userId).toBe("u1");
    expect(row?.values.plan).toBe("pro");
    expect(row?.values.interval).toBe("week");
  });

  it("maps a canceled subscription to free", () => {
    const row = subscriptionRow(sub("canceled"));
    expect(row?.values.plan).toBe("free");
    expect(row?.values.interval).toBeNull();
    expect(row?.values.status).toBe("canceled");
  });

  it("returns null without a userId", () => {
    expect(subscriptionRow(sub("active", { userId: "" }))).toBeNull();
  });
});

describe("invoiceGrant", () => {
  it("grants from the first line with a known price", () => {
    expect(invoiceGrant(invoice(["price_unknown", "price_starter_month"]))).toEqual({ userId: "u1", delta: 1000, stripeInvoiceId: "in_1" });
  });
});

describe("processStripeEvent", () => {
  it("skips handlers for a duplicate event", async () => {
    const d = deps({ recordEvent: vi.fn(async () => false) });
    await expect(processStripeEvent(event("invoice.paid", invoice(["price_starter_month"])), d)).resolves.toBe("duplicate");
    expect(d.grantCredits).not.toHaveBeenCalled();
    expect(d.saveSubscription).not.toHaveBeenCalled();
  });

  it("saves the fetched subscription, not the payload", async () => {
    const d = deps({ retrieveSubscription: vi.fn(async (id: string) => sub("canceled", { id })) });
    await expect(processStripeEvent(event("customer.subscription.updated", sub("active")), d)).resolves.toBe("processed");
    expect(d.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    const saved = vi.mocked(d.saveSubscription).mock.calls[0]?.[0];
    expect(saved?.values.plan).toBe("free");
    expect(saved?.values.status).toBe("canceled");
  });

  it("rejects when a handler fails", async () => {
    const d = deps({ grantCredits: vi.fn(async () => Promise.reject(new Error("db blip"))) });
    await expect(processStripeEvent(event("invoice.paid", invoice(["price_starter_month"])), d)).rejects.toThrow("db blip");
  });

  it("ignores unrelated event types", async () => {
    const d = deps();
    await expect(processStripeEvent(event("charge.succeeded", {}), d)).resolves.toBe("processed");
    expect(d.retrieveSubscription).not.toHaveBeenCalled();
    expect(d.saveSubscription).not.toHaveBeenCalled();
    expect(d.grantCredits).not.toHaveBeenCalled();
  });
});

describe("planFor", () => {
  const dbWith = (row: { plan: string; status: string }) =>
    ({ select: () => ({ from: () => ({ where: async () => [row] }) }) }) as unknown as Db;

  it("keeps the paid plan while past_due", async () => {
    await expect(planFor(dbWith({ plan: "pro", status: "past_due" }), "u1")).resolves.toBe("pro");
  });

  it("falls back to free when canceled", async () => {
    await expect(planFor(dbWith({ plan: "pro", status: "canceled" }), "u1")).resolves.toBe("free");
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
      lines: { data: [line("price_starter_month", true), line("price_pro_week", true), line("price_pro_week", false)] },
      parent: { subscription_details: { metadata: { userId: "u1" } } },
    } as unknown as Stripe.Invoice;
    expect(invoiceGrant(upgraded)).toEqual({ userId: "u1", delta: creditsPerInvoice("pro", "week"), stripeInvoiceId: "in_2" });
  });

  it("grants nothing for an invoice made only of prorations", () => {
    const onlyProrations = {
      id: "in_3",
      lines: { data: [{ pricing: { price_details: { price: "price_pro_week" } }, parent: { subscription_item_details: { proration: true } } }] },
      parent: { subscription_details: { metadata: { userId: "u1" } } },
    } as unknown as Stripe.Invoice;
    expect(invoiceGrant(onlyProrations)).toBeNull();
  });
});
