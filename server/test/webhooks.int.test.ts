import request from "supertest";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// The app's global db() and env() read these lazily, so they must be set before the app module loads.
process.env.DATABASE_URL = testDbUrl("webhooks");
process.env.STRIPE_SECRET_KEY = "sk_test_webhooks";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_webhooks";

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

  it("re-fetches with a short timeout and no retries, because the call runs inside a transaction", async () => {
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

  it("grants credits once per invoice even when two different events carry it", async () => {
    const userId = await seedUser(db);
    const invoice = {
      id: "in_once",
      lines: { data: [{ pricing: { price_details: { price: "price_pro_week" } }, parent: { subscription_item_details: { proration: false } } }] },
      parent: { subscription_details: { metadata: { userId } } },
    };
    expect((await send("evt_paid_1", "invoice.paid", invoice)).status).toBe(200);
    expect((await send("evt_paid_2", "invoice.paid", invoice)).status).toBe(200);
    const { eq } = await import("drizzle-orm");
    const grants = await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.stripeInvoiceId, "in_once"));
    expect(grants).toHaveLength(1);
  });
});
