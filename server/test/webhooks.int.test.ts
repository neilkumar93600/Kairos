import request from "supertest";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// The app's global db() and env() read these lazily, so they must be set before the app module loads.
process.env.DATABASE_URL = testDbUrl("webhooks");
process.env.STRIPE_SECRET_KEY = "sk_test_webhooks";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_webhooks";
process.env.STRIPE_GRANT_COUPONS = "BETA100";

type App = ReturnType<typeof import("../src/app").createApp>;

describe.skipIf(!hasTestDb)("POST /api/webhooks/stripe against Postgres", () => {
  let app: App;
  let db: Awaited<ReturnType<typeof testDb>>;
  let schema: typeof import("../src/db/schema");
  let stripeClient: Stripe;

  beforeAll(async () => {
    db = await testDb("webhooks");
    schema = await import("../src/db/schema");
    const { createApp } = await import("../src/app");
    const { stripe } = await import("../src/services/stripe");
    stripeClient = stripe();
    app = createApp({
      auth: { handler: async () => new Response("{}"), getSession: async () => null },
      corsOrigins: [],
      healthChecks: {},
    });
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDb(db);
  });

  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  const subscription = (id: string, status: string, userId: string) =>
    ({
      id,
      status,
      customer: "cus_1",
      metadata: { userId },
      cancel_at_period_end: false,
      pause_collection: null,
      items: { data: [{ price: { id: "price_pro_week" }, current_period_end: 1_900_000_000 }] },
    }) as unknown as Stripe.Subscription;

  function send(eventId: string, type: string, object: unknown) {
    const payload = JSON.stringify({ id: eventId, object: "event", type, data: { object } });
    const signature = stripeClient.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_webhooks" });
    return request(app).post("/api/webhooks/stripe").set("stripe-signature", signature).set("content-type", "application/json").send(payload);
  }

  async function subscriptionRowFor(userId: string) {
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
    return row;
  }

  it("rolls the event row back when the first attempt fails, so the redelivery is processed", async () => {
    const userId = await seedUser(db);
    const retrieve = vi
      .spyOn(stripeClient.subscriptions, "retrieve")
      .mockRejectedValueOnce(new Error("stripe down"))
      .mockResolvedValueOnce(subscription("sub_1", "active", userId) as never);

    expect((await send("evt_retry", "customer.subscription.updated", { id: "sub_1" })).status).toBe(500);
    expect(await db.select().from(schema.stripeEvents)).toHaveLength(0);

    const second = await send("evt_retry", "customer.subscription.updated", { id: "sub_1" });
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ received: true });
    expect((await subscriptionRowFor(userId))?.plan).toBe("pro");
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it("re-fetches with a short timeout and no retries, because Stripe redelivers a failed webhook anyway", async () => {
    const userId = await seedUser(db);
    const retrieve = vi.spyOn(stripeClient.subscriptions, "retrieve").mockResolvedValue(subscription("sub_1", "active", userId) as never);
    expect((await send("evt_opts", "customer.subscription.updated", { id: "sub_1" })).status).toBe(200);
    expect(retrieve).toHaveBeenCalledWith("sub_1", {}, { timeout: 10_000, maxNetworkRetries: 0 });
  });

  it("a late event for an old subscription does not overwrite the current one", async () => {
    const userId = await seedUser(db);
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.subscriptions)
      .set({ plan: "pro", interval: "week", status: "active", stripeSubscriptionId: "sub_new" })
      .where(eq(schema.subscriptions.userId, userId));
    vi.spyOn(stripeClient.subscriptions, "retrieve").mockResolvedValue(subscription("sub_old", "canceled", userId) as never);

    expect((await send("evt_late", "customer.subscription.updated", { id: "sub_old" })).status).toBe(200);
    const row = await subscriptionRowFor(userId);
    expect(row?.plan).toBe("pro");
    expect(row?.stripeSubscriptionId).toBe("sub_new");
  });

  it("cancelling the current subscription still drops the user to free", async () => {
    const userId = await seedUser(db);
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.subscriptions)
      .set({ plan: "pro", interval: "week", status: "active", stripeSubscriptionId: "sub_new" })
      .where(eq(schema.subscriptions.userId, userId));
    vi.spyOn(stripeClient.subscriptions, "retrieve").mockResolvedValue(subscription("sub_new", "canceled", userId) as never);

    expect((await send("evt_cancel", "customer.subscription.deleted", { id: "sub_new" })).status).toBe(200);
    expect((await subscriptionRowFor(userId))?.plan).toBe("free");
  });

  it("anchors the past_due grace on entry, keeps the anchor while past_due and clears it on recovery", async () => {
    const userId = await seedUser(db);
    const retrieve = vi.spyOn(stripeClient.subscriptions, "retrieve");
    retrieve.mockResolvedValueOnce(subscription("sub_1", "past_due", userId) as never);
    expect((await send("evt_pd_1", "customer.subscription.updated", { id: "sub_1" })).status).toBe(200);
    const anchor = (await subscriptionRowFor(userId))?.pastDueSince;
    expect(anchor).toBeInstanceOf(Date);

    retrieve.mockResolvedValueOnce(subscription("sub_1", "past_due", userId) as never);
    expect((await send("evt_pd_2", "customer.subscription.updated", { id: "sub_1" })).status).toBe(200);
    expect((await subscriptionRowFor(userId))?.pastDueSince).toEqual(anchor);

    retrieve.mockResolvedValueOnce(subscription("sub_1", "active", userId) as never);
    expect((await send("evt_pd_3", "customer.subscription.updated", { id: "sub_1" })).status).toBe(200);
    expect((await subscriptionRowFor(userId))?.pastDueSince).toBeNull();
  });

  it("grants credits once per invoice even when two different events carry it", async () => {
    const userId = await seedUser(db);
    const invoice = paidInvoice("in_once", { userId });
    expect((await send("evt_paid_1", "invoice.paid", invoice)).status).toBe(200);
    expect((await send("evt_paid_2", "invoice.paid", invoice)).status).toBe(200);
    expect(await grantsFor("in_once")).toHaveLength(1);
  });

  /** A paid invoice.paid body; amount in cents, metadata userId omitted when null. */
  const paidInvoice = (id: string, opts: { userId: string | null; amountPaid?: number; price?: string; customer?: string; hasMore?: boolean }) => ({
    id,
    amount_paid: opts.amountPaid ?? 1200,
    customer: opts.customer ?? "cus_1",
    discounts: [],
    lines: {
      data: [{ pricing: { price_details: { price: opts.price ?? "price_pro_week" } }, parent: { subscription_item_details: { proration: false } } }],
      has_more: opts.hasMore ?? false,
    },
    parent: { subscription_details: { metadata: opts.userId ? { userId: opts.userId } : {}, subscription: "sub_1" } },
  });

  async function grantsFor(invoiceId: string) {
    const { eq } = await import("drizzle-orm");
    return db.select().from(schema.creditLedger).where(eq(schema.creditLedger.stripeInvoiceId, invoiceId));
  }

  it("a $0 invoice (100% promotion code or trial) grants nothing, and the event is recorded", async () => {
    const userId = await seedUser(db);
    vi.spyOn(stripeClient.invoices, "retrieve").mockResolvedValue({ discounts: [{ source: { coupon: "NOT_LISTED" } }] } as never);
    expect((await send("evt_zero", "invoice.paid", paidInvoice("in_zero", { userId, amountPaid: 0 }))).status).toBe(200);
    expect(await grantsFor("in_zero")).toHaveLength(0);
    expect(await db.select().from(schema.stripeEvents)).toHaveLength(1);
  });

  it("a $0 invoice grants when its coupon is in STRIPE_GRANT_COUPONS", async () => {
    const userId = await seedUser(db);
    const retrieve = vi.spyOn(stripeClient.invoices, "retrieve").mockResolvedValue({ discounts: [{ source: { coupon: "BETA100" } }] } as never);
    expect((await send("evt_beta", "invoice.paid", paidInvoice("in_beta", { userId, amountPaid: 0 }))).status).toBe(200);
    expect(retrieve).toHaveBeenCalledWith("in_beta", { expand: ["discounts"] }, { timeout: 10_000, maxNetworkRetries: 0 });
    expect(await grantsFor("in_beta")).toHaveLength(1);
  });

  it("an unknown price answers 500 and stores nothing, so Stripe retries instead of the grant being lost", async () => {
    const userId = await seedUser(db);
    expect((await send("evt_unmapped", "invoice.paid", paidInvoice("in_unmapped", { userId, price: "price_retired" }))).status).toBe(500);
    expect(await db.select().from(schema.stripeEvents)).toHaveLength(0);
    expect(await grantsFor("in_unmapped")).toHaveLength(0);
  });

  it("an invoice without metadata grants to the user who owns the Stripe customer", async () => {
    const userId = await seedUser(db);
    const { eq } = await import("drizzle-orm");
    await db.update(schema.subscriptions).set({ stripeCustomerId: "cus_fallback" }).where(eq(schema.subscriptions.userId, userId));
    expect((await send("evt_fallback", "invoice.paid", paidInvoice("in_fallback", { userId: null, customer: "cus_fallback" }))).status).toBe(200);
    expect((await grantsFor("in_fallback"))[0]?.userId).toBe(userId);
  });

  it("an invoice nobody can be matched to answers 500 and is retried", async () => {
    expect((await send("evt_nobody", "invoice.paid", paidInvoice("in_nobody", { userId: null, customer: "cus_unknown" }))).status).toBe(500);
    expect(await db.select().from(schema.stripeEvents)).toHaveLength(0);
  });

  it("an invoice for an erased user is recorded and ignored, not a 3-day 500 loop on the ledger foreign key", async () => {
    expect((await send("evt_erased", "invoice.paid", paidInvoice("in_erased", { userId: "erased-user-id" }))).status).toBe(200);
    expect(await db.select().from(schema.stripeEvents)).toHaveLength(1);
    expect(await grantsFor("in_erased")).toHaveLength(0);
  });

  it("decides a truncated invoice from all of its lines", async () => {
    const userId = await seedUser(db);
    const line = { pricing: { price_details: { price: "price_starter_month" } }, parent: { subscription_item_details: { proration: false } } };
    const list = vi.spyOn(stripeClient.invoices, "listLineItems").mockReturnValue({ autoPagingToArray: async () => [line] } as never);
    const invoice = { ...paidInvoice("in_long", { userId, hasMore: true }), lines: { data: [], has_more: true } };
    expect((await send("evt_long", "invoice.paid", invoice)).status).toBe(200);
    expect(list).toHaveBeenCalledWith("in_long", { limit: 100 }, { timeout: 10_000, maxNetworkRetries: 0 });
    expect((await grantsFor("in_long"))[0]?.delta).toBe(1000);
  });

  it("a failed payment syncs the subscription to past_due and starts the grace", async () => {
    const userId = await seedUser(db);
    const retrieve = vi.spyOn(stripeClient.subscriptions, "retrieve").mockResolvedValue(subscription("sub_1", "past_due", userId) as never);
    expect((await send("evt_failed", "invoice.payment_failed", paidInvoice("in_failed", { userId, amountPaid: 0 }))).status).toBe(200);
    expect(retrieve).toHaveBeenCalledWith("sub_1", {}, { timeout: 10_000, maxNetworkRetries: 0 });
    const row = await subscriptionRowFor(userId);
    expect(row?.status).toBe("past_due");
    expect(row?.pastDueSince).toBeInstanceOf(Date);
    expect(await grantsFor("in_failed")).toHaveLength(0);
  });

  it("refunds and disputes are recorded and change no credits", async () => {
    const userId = await seedUser(db, { credits: 25 });
    expect((await send("evt_refund", "charge.refunded", { id: "ch_1", amount: 1900, customer: "cus_1" })).status).toBe(200);
    expect((await send("evt_dispute", "charge.dispute.created", { id: "dp_1", amount: 1900, charge: "ch_1" })).status).toBe(200);
    expect(await db.select().from(schema.stripeEvents)).toHaveLength(2);
    const { eq } = await import("drizzle-orm");
    expect(await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId))).toHaveLength(1);
  });
});
