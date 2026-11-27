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
  let processStoredEvent: typeof import("../src/services/billing-events").processStoredEvent;
  let appDb: typeof import("../src/db/client").db;

  beforeAll(async () => {
    db = await testDb("webhooks");
    schema = await import("../src/db/schema");
    ({ processStoredEvent } = await import("../src/services/billing-events"));
    ({ db: appDb } = await import("../src/db/client"));
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

  /** A paid invoice.paid body; amount in cents, metadata userId omitted when null. */
  const paidInvoice = (id: string, opts: { userId: string | null; amountPaid?: number; price?: string; customer?: string; hasMore?: boolean }) => ({
    id,
    amount_paid: opts.amountPaid ?? 1200,
    total: opts.amountPaid ?? 1200,
    status_transitions: { paid_at: 1_800_000_000 },
    customer: opts.customer ?? "cus_1",
    discounts: [],
    lines: {
      data: [{ pricing: { price_details: { price: opts.price ?? "price_pro_week" } }, parent: { subscription_item_details: { proration: false } }, period: { start: 1_800_000_000, end: 1_802_592_000 }, amount: opts.amountPaid ?? 1200 }],
      has_more: opts.hasMore ?? false,
    },
    parent: { subscription_details: { metadata: opts.userId ? { userId: opts.userId } : {}, subscription: "sub_1" } },
  });

  function store(eventId: string, type: string, object: unknown, created = 1_800_000_000) {
    const payload = JSON.stringify({ id: eventId, object: "event", created, type, data: { object } });
    const signature = stripeClient.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_webhooks" });
    return request(app).post("/api/webhooks/stripe").set("stripe-signature", signature).set("content-type", "application/json").send(payload);
  }

  /** The route, then what the stripe queue does with the row. */
  async function send(eventId: string, type: string, object: unknown, created?: number) {
    const res = await store(eventId, type, object, created);
    if (res.status === 200) await processStoredEvent(appDb(), eventId);
    return res;
  }

  async function eventRow(id: string) {
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.stripeEvents).where(eq(schema.stripeEvents.id, id));
    return row!;
  }

  async function subscriptionRowFor(userId: string) {
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
    return row;
  }

  it("a 2xx means stored: a Stripe failure leaves the row received, with its error code, and the next run applies it", async () => {
    const userId = await seedUser(db);
    const retrieve = vi
      .spyOn(stripeClient.subscriptions, "retrieve")
      .mockRejectedValueOnce(Object.assign(new Error("stripe down, secret text"), { type: "StripeAPIError" }))
      .mockResolvedValueOnce(subscription("sub_1", "active", userId) as never);

    const first = await store("evt_retry", "customer.subscription.updated", { id: "sub_1", customer: "cus_1" });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ received: true });
    expect(await eventRow("evt_retry")).toMatchObject({ status: "received", outcome: null, processedAt: null, stripeCustomerId: "cus_1", objectId: "sub_1", eventCreated: new Date(1_800_000_000_000) });
    const outboxRows = await db.select().from(schema.outbox);
    expect(outboxRows.map((r) => [r.queue, r.dedupeKey, r.payload])).toEqual([["stripe", "stripe-evt_retry", { eventId: "evt_retry" }]]);

    await expect(processStoredEvent(appDb(), "evt_retry")).rejects.toThrow("stripe down");
    expect(await eventRow("evt_retry")).toMatchObject({ status: "received", attempts: 1, lastError: "stripe_5xx" });
    expect((await subscriptionRowFor(userId))?.plan).toBe("free");

    await expect(processStoredEvent(appDb(), "evt_retry")).resolves.toBe("subscription_synced");
    expect(await eventRow("evt_retry")).toMatchObject({ status: "processed", outcome: "subscription_synced", userId, lastError: null });
    expect((await subscriptionRowFor(userId))?.plan).toBe("pro");
    expect(retrieve).toHaveBeenCalledTimes(2);
    // A job delivered again finds nothing to do, and calls nothing.
    await expect(processStoredEvent(appDb(), "evt_retry")).resolves.toBe("done");
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it("a redelivery answers duplicate, keeps one row and one outbox row, and the route never calls Stripe", async () => {
    const retrieve = vi.spyOn(stripeClient.subscriptions, "retrieve");
    expect((await store("evt_dup", "customer.subscription.updated", { id: "sub_1", customer: "cus_1" })).body).toEqual({ received: true });
    const again = await store("evt_dup", "customer.subscription.updated", { id: "sub_1", customer: "cus_1" });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ received: true, duplicate: true });
    expect(await db.select().from(schema.stripeEvents)).toHaveLength(1);
    expect(await db.select().from(schema.outbox)).toHaveLength(1);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("stores only the extract: nothing of the raw event's person reaches the row", async () => {
    const userId = await seedUser(db);
    const raw = { ...paidInvoice("in_marker", { userId }), customer_name: "Zqmarker Person", customer_email: "zqmarker@example.com", customer_address: { line1: "1 Zqmarker Road" }, account_name: "Zqmarker" };
    expect((await store("evt_marker", "invoice.paid", raw)).status).toBe(200);
    const row = await eventRow("evt_marker");
    expect(row.payload).toMatchObject({ kind: "invoice", invoiceId: "in_marker", userId, amountPaid: 1200 });
    expect(JSON.stringify(row)).not.toMatch(/zqmarker/i);
  });

  it("the ordering guard: an older event is ignored, an equal second is processed, a newer one moves the guard", async () => {
    const userId = await seedUser(db);
    const retrieve = vi.spyOn(stripeClient.subscriptions, "retrieve");
    const answer = (status: string) => retrieve.mockResolvedValueOnce(subscription("sub_1", status, userId) as never);
    answer("active");
    expect((await send("evt_b", "customer.subscription.updated", { id: "sub_1" }, 2000)).status).toBe(200);
    expect((await subscriptionRowFor(userId))?.stripeEventCreated).toEqual(new Date(2_000_000));

    answer("canceled");
    await send("evt_a_older", "customer.subscription.updated", { id: "sub_1" }, 1999);
    expect(await eventRow("evt_a_older")).toMatchObject({ status: "ignored", outcome: "subscription_stale" });
    expect((await subscriptionRowFor(userId))?.status).toBe("active");

    answer("past_due");
    await send("evt_b_same_second", "customer.subscription.updated", { id: "sub_1" }, 2000);
    expect(await eventRow("evt_b_same_second")).toMatchObject({ status: "processed", outcome: "subscription_synced" });
    expect((await subscriptionRowFor(userId))?.status).toBe("past_due");

    answer("active");
    await send("evt_c", "customer.subscription.updated", { id: "sub_1" }, 2001);
    expect((await subscriptionRowFor(userId))).toMatchObject({ status: "active", stripeEventCreated: new Date(2_001_000) });
  });

  it("two events of one customer in the same second cannot commit out of order: the refetch and the commit are serialized", async () => {
    const userId = await seedUser(db);
    let running = 0;
    let most = 0;
    let call = 0;
    const api = {
      retrieveSubscription: async () => {
        call++;
        running++;
        most = Math.max(most, running);
        // The first refetch reads the older state and is the slow one: unserialized, it would commit last and put it back.
        const status = call === 1 ? "active" : "past_due";
        if (call === 1) await new Promise((resolve) => setTimeout(resolve, 150));
        running--;
        return subscription("sub_1", status, userId);
      },
      listInvoiceLines: async () => [],
      invoiceCouponIds: async () => [],
    };
    await store("evt_s1", "customer.subscription.updated", { id: "sub_1", customer: "cus_1" }, 3000);
    await store("evt_s2", "customer.subscription.updated", { id: "sub_1", customer: "cus_1" }, 3000);
    await Promise.all([processStoredEvent(appDb(), "evt_s1", api), processStoredEvent(appDb(), "evt_s2", api)]);
    expect(most).toBe(1);
    expect((await subscriptionRowFor(userId))?.status).toBe("past_due");
    expect(await eventRow("evt_s1")).toMatchObject({ status: "processed" });
    expect(await eventRow("evt_s2")).toMatchObject({ status: "processed" });
  });

  it("a type it does not handle is stored and ignored", async () => {
    expect((await send("evt_other", "customer.updated", { id: "cus_1", email: "zqmarker@example.com" })).status).toBe(200);
    const row = await eventRow("evt_other");
    expect(row).toMatchObject({ status: "ignored", outcome: "unhandled_type", payload: null });
  });

  it("a handled type whose extract would not parse is stored, then dead for an operator", async () => {
    expect((await send("evt_badshape", "charge.refunded", { id: "ch_1" })).status).toBe(200);
    expect(await eventRow("evt_badshape")).toMatchObject({ status: "dead", lastError: "payload_invalid", payload: null });
  });

  it("a customer owned by another account is permanent: dead before anything is written, and the unique index stays the backstop", async () => {
    const [a, b] = [await seedUser(db), await seedUser(db)];
    const { eq } = await import("drizzle-orm");
    await db.update(schema.subscriptions).set({ stripeCustomerId: "cus_1" }).where(eq(schema.subscriptions.userId, a));
    vi.spyOn(stripeClient.subscriptions, "retrieve").mockResolvedValue(subscription("sub_b", "active", b) as never);
    await send("evt_conflict", "customer.subscription.updated", { id: "sub_b", customer: "cus_1" });
    // The metadata names b, the customer belongs to a: resolveUser refuses before the write that would hit the index.
    expect(await eventRow("evt_conflict")).toMatchObject({ status: "dead", lastError: "anomaly_no_user" });
    expect((await subscriptionRowFor(b))?.plan).toBe("free");
  });

  it("an event for an erased customer makes no Stripe call and keeps no id", async () => {
    const { stripeCustomerHash, erasureUserHash, emailHash } = await import("../src/services/erasure");
    await db.insert(schema.deletionTasks).values({ userHash: erasureUserHash("gone"), emailHash: emailHash("gone@example.com"), requestedBy: "user", stripeCustomerHash: stripeCustomerHash("cus_gone") });
    const retrieve = vi.spyOn(stripeClient.subscriptions, "retrieve");
    await send("evt_gone", "customer.subscription.deleted", { id: "sub_gone", customer: "cus_gone" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(await eventRow("evt_gone")).toMatchObject({ status: "ignored", outcome: "user_deleted", payload: null, stripeCustomerId: null });
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
    expect(await eventRow("evt_late")).toMatchObject({ status: "ignored", outcome: "subscription_stale" });
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
    expect(await eventRow("evt_cancel")).toMatchObject({ status: "processed", outcome: "subscription_synced" });
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
    expect(await eventRow("evt_paid_1")).toMatchObject({ status: "processed", outcome: "grant_applied", userId });
    expect(await eventRow("evt_paid_2")).toMatchObject({ status: "processed", outcome: "grant_duplicate", userId });
  });

  // [pause source, the offer flow's latest applied_at relative to the pause (ms; null: no applied candidate), result]
  it.each([
    ["offer_email", 0, null],
    ["offer_email", 60_000, null],
    ["offer_email", null, "kept"],
    ["offer_email", -60_000, "kept"],
    ["customer", 0, "kept"],
  ] as const)("billing resumed from a %s pause, offer applied at %s: applications paused are %s (09-billing-events 3.3)", async (source, appliedOffset, expected) => {
    const { eq } = await import("drizzle-orm");
    const userId = await seedUser(db);
    const pausedAt = new Date("2026-11-01T00:00:00Z");
    await db.insert(schema.profiles).values({ userId, forwardingAddress: `fwd-${userId}@in.test`, applicationsPausedAt: pausedAt });
    if (appliedOffset !== null) {
      // WP-33: the offer flow's record. Only a pause at or before its latest applied_at is the offer's to clear.
      const appliedAt = new Date(pausedAt.getTime() + appliedOffset);
      const [mail] = await db.insert(schema.inboundEmails).values({ userId, providerMessageId: `m-${userId}`, sender: "hr@acme.com", subject: "Offer", textBody: "offer letter", kind: "offer", ruleKind: "offer" }).returning();
      await db.insert(schema.offerPauseCandidates).values({
        userId, inboundEmailId: mail!.id, state: "applied", appliedAt, createdAt: new Date(appliedAt.getTime() - 49 * 3_600_000), applyAfter: new Date(appliedAt.getTime() - 3_600_000),
      });
    }
    await db
      .update(schema.subscriptions)
      .set({ plan: "pro", interval: "week", status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", collectionPaused: true, pauseSource: source })
      .where(eq(schema.subscriptions.userId, userId));
    // The portal resumed it: Stripe's subscription has no pause_collection any more.
    vi.spyOn(stripeClient.subscriptions, "retrieve").mockResolvedValue(subscription("sub_1", "active", userId) as never);
    expect((await send(`evt_resume_${source}`, "customer.subscription.updated", { id: "sub_1", customer: "cus_1" })).status).toBe(200);
    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
    expect(profile!.applicationsPausedAt).toEqual(expected === null ? null : pausedAt);
    const [row] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
    expect(row).toMatchObject({ collectionPaused: false, pauseSource: null });
  });

  it("a downgrade renewal whose proration credit takes the total below 0 still grants the new plan (R2 finding 3)", async () => {
    const userId = await seedUser(db);
    const downgrade = {
      ...paidInvoice("in_down", { userId, price: "price_starter_month", amountPaid: 0 }),
      total: -4100,
      lines: {
        data: [
          { pricing: { price_details: { price: "price_pro_week" } }, parent: { subscription_item_details: { proration: true } }, amount: -6000 },
          { pricing: { price_details: { price: "price_starter_month" } }, parent: { subscription_item_details: { proration: false } }, period: { start: 1_800_000_000, end: 1_802_592_000 }, amount: 1900 },
        ],
        has_more: false,
      },
    };
    expect((await send("evt_down", "invoice.paid", downgrade)).status).toBe(200);
    expect((await grantsFor("in_down")).map((r) => [r.reason, r.delta])).toEqual([["plan_grant", 1000]]);
    expect(await eventRow("evt_down")).toMatchObject({ status: "processed", outcome: "grant_applied" });
  });

  it("a grant over the cap writes one expiry under the same invoice, and a replay writes nothing more", async () => {
    // An adjustment, not seedUser's credits: those are a free_grant row, and the free grant never expires.
    const userId = await seedUser(db);
    await db.insert(schema.creditLedger).values({ userId, delta: 3000, reason: "admin_adjustment", note: "fixture balance" });
    await send("evt_cap", "invoice.paid", paidInvoice("in_cap", { userId, price: "price_starter_month" }));
    const rows = await grantsFor("in_cap");
    expect(rows.map((r) => [r.reason, r.delta, r.note]).sort()).toEqual([
      ["expiry", -2000, "rollover cap 2x grant=1000"],
      ["plan_grant", 1000, "plan=starter interval=month until=2027-02-14T08:00:00.000Z"],
    ]);
    await send("evt_cap_again", "invoice.paid", paidInvoice("in_cap", { userId, price: "price_starter_month" }));
    expect(await grantsFor("in_cap")).toHaveLength(2);
    const { eq } = await import("drizzle-orm");
    const [balance] = await db.select().from(schema.creditBalances).where(eq(schema.creditBalances.userId, userId));
    expect(balance?.balance).toBe(2000);
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

  it("an unknown price is stored and goes dead for an operator, and a redrive after the fix grants it", async () => {
    const userId = await seedUser(db);
    expect((await send("evt_unmapped", "invoice.paid", paidInvoice("in_unmapped", { userId, price: "price_retired" }))).status).toBe(200);
    expect(await eventRow("evt_unmapped")).toMatchObject({ status: "dead", outcome: "anomaly_unmapped_price", lastError: "anomaly_unmapped_price", attempts: 1 });
    expect(await grantsFor("in_unmapped")).toHaveLength(0);

    const { redriveStripeEvent } = await import("../src/services/billing-events");
    await appDb().transaction((tx) => redriveStripeEvent(tx, "evt_unmapped"));
    expect(await eventRow("evt_unmapped")).toMatchObject({ status: "received", outcome: null, redrives: 1 });
    // Still unmapped here, so it dies again: a redrive is a new try, never a grant by itself.
    await processStoredEvent(appDb(), "evt_unmapped");
    expect(await eventRow("evt_unmapped")).toMatchObject({ status: "dead", attempts: 2 });
    expect(await grantsFor("in_unmapped")).toHaveLength(0);
  });

  it("an invoice without metadata grants to the user who owns the Stripe customer", async () => {
    const userId = await seedUser(db);
    const { eq } = await import("drizzle-orm");
    await db.update(schema.subscriptions).set({ stripeCustomerId: "cus_fallback" }).where(eq(schema.subscriptions.userId, userId));
    expect((await send("evt_fallback", "invoice.paid", paidInvoice("in_fallback", { userId: null, customer: "cus_fallback" }))).status).toBe(200);
    expect((await grantsFor("in_fallback"))[0]?.userId).toBe(userId);
  });

  it("an invoice nobody can be matched to is stored and goes dead for an operator", async () => {
    expect((await send("evt_nobody", "invoice.paid", paidInvoice("in_nobody", { userId: null, customer: "cus_unknown" }))).status).toBe(200);
    expect(await eventRow("evt_nobody")).toMatchObject({ status: "dead", outcome: "anomaly_no_user" });
  });

  it("an invoice for an erased user is recorded and ignored, and keeps no id", async () => {
    const { erasureUserHash, emailHash } = await import("../src/services/erasure");
    await db.insert(schema.deletionTasks).values({ userHash: erasureUserHash("erased-user-id"), emailHash: emailHash("erased@example.com"), requestedBy: "user" });
    expect((await send("evt_erased", "invoice.paid", paidInvoice("in_erased", { userId: "erased-user-id" }))).status).toBe(200);
    expect(await eventRow("evt_erased")).toMatchObject({ status: "ignored", outcome: "user_deleted", userId: null, payload: null, stripeCustomerId: null });
    expect(await grantsFor("in_erased")).toHaveLength(0);
  });

  it("an invoice for a user id that never existed and was never erased goes dead for an operator", async () => {
    expect((await send("evt_typo", "invoice.paid", paidInvoice("in_typo", { userId: "no-such-user" }))).status).toBe(200);
    expect(await eventRow("evt_typo")).toMatchObject({ status: "dead", outcome: "anomaly_no_user" });
    expect(await grantsFor("in_typo")).toHaveLength(0);
  });

  it("decides a truncated invoice from all of its lines", async () => {
    const userId = await seedUser(db);
    const line = { pricing: { price_details: { price: "price_starter_month" } }, parent: { subscription_item_details: { proration: false } }, amount: 1900 };
    const list = vi.spyOn(stripeClient.invoices, "listLineItems").mockResolvedValue({ data: [line], has_more: false } as never);
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
    expect(await eventRow("evt_refund")).toMatchObject({ status: "processed", outcome: "alert_only" });
    expect(await eventRow("evt_dispute")).toMatchObject({ status: "processed", outcome: "alert_only" });
    const { eq } = await import("drizzle-orm");
    expect(await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId))).toHaveLength(1);
  });
});
