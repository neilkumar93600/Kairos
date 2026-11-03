import { eq } from "drizzle-orm";
import request from "supertest";
import Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/** POST /api/billing/checkout and /portal against Postgres. Never reaches Stripe: every call is spied. */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("billing");
process.env.STRIPE_SECRET_KEY = "sk_test_billing";

const INLINE = { timeout: 10_000, maxNetworkRetries: 0 };

describe.skipIf(!hasTestDb)("billing routes against Postgres", () => {
  let db: Awaited<ReturnType<typeof testDb>>;
  let schema: typeof import("../src/db/schema");
  let app: ReturnType<typeof import("../src/app").createApp>;
  let stripeClient: Stripe;
  let userId = "";

  beforeAll(async () => {
    db = await testDb("billing");
    schema = await import("../src/db/schema");
    stripeClient = (await import("../src/services/stripe")).stripe();
    const { createApp } = await import("../src/app");
    app = createApp({
      auth: {
        handler: async () => new Response("{}"),
        getSession: async () => ({ user: { id: userId, email: `${userId}@test.local`, name: "B", emailVerified: true }, sessionId: "s" }),
      },
      corsOrigins: [],
      healthChecks: {},
    });
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDb(db);
    userId = await seedUser(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  const checkout = () => request(app).post("/api/billing/checkout").send({ plan: "starter", interval: "month" });
  const storedCustomer = async () => (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)))[0]?.stripeCustomerId;

  it("two concurrent checkouts create one customer: one idempotency key per user, and the first stored id wins", async () => {
    // Stripe answers the same key with the same customer; cus_B stands for a key that expired between the two calls.
    const create = vi
      .spyOn(stripeClient.customers, "create")
      .mockResolvedValueOnce({ id: "cus_A" } as never)
      .mockResolvedValueOnce({ id: "cus_B" } as never);
    const session = vi.spyOn(stripeClient.checkout.sessions, "create").mockResolvedValue({ url: "https://checkout.test/s" } as never);
    vi.spyOn(stripeClient.subscriptions, "list").mockResolvedValue({ data: [] } as never); // the race loser checks for a live plan

    const [a, b] = await Promise.all([checkout(), checkout()]);
    expect([a.status, b.status]).toEqual([200, 200]);
    for (const call of create.mock.calls) expect(call[1]).toEqual({ ...INLINE, idempotencyKey: `customer:${userId}` });
    const stored = await storedCustomer();
    expect(["cus_A", "cus_B"]).toContain(stored);
    expect(session.mock.calls.map((c) => c[0]?.customer)).toEqual([stored, stored]);
  });

  it("checkout uses a five-minute idempotency key and INLINE_REQUEST", async () => {
    vi.spyOn(stripeClient.customers, "create").mockResolvedValue({ id: "cus_A" } as never);
    const session = vi.spyOn(stripeClient.checkout.sessions, "create").mockResolvedValue({ url: "https://checkout.test/s" } as never);
    expect((await checkout()).status).toBe(200);
    expect(session.mock.calls[0]?.[1]).toEqual({ ...INLINE, idempotencyKey: expect.stringMatching(new RegExp(`^checkout:${userId}:starter:month:\\d+$`)) });
  });

  it("a user with a live subscription is sent to the portal with 409, and no second checkout is created", async () => {
    await db.update(schema.subscriptions).set({ stripeCustomerId: "cus_live" }).where(eq(schema.subscriptions.userId, userId));
    const list = vi.spyOn(stripeClient.subscriptions, "list").mockResolvedValue({ data: [{ id: "sub_1", status: "past_due" }] } as never);
    const portal = vi.spyOn(stripeClient.billingPortal.sessions, "create").mockResolvedValue({ url: "https://portal.test/p" } as never);
    const session = vi.spyOn(stripeClient.checkout.sessions, "create");

    const res = await checkout();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "already_subscribed", details: { portalUrl: "https://portal.test/p" } });
    expect(list).toHaveBeenCalledWith({ customer: "cus_live", limit: 10 }, INLINE);
    expect(portal.mock.calls[0]?.[1]).toEqual(INLINE);
    expect(session).not.toHaveBeenCalled();
  });

  it("an abandoned (incomplete) subscription does not block a new checkout", async () => {
    await db.update(schema.subscriptions).set({ stripeCustomerId: "cus_old" }).where(eq(schema.subscriptions.userId, userId));
    vi.spyOn(stripeClient.subscriptions, "list").mockResolvedValue({ data: [{ id: "sub_1", status: "incomplete" }] } as never);
    vi.spyOn(stripeClient.checkout.sessions, "create").mockResolvedValue({ url: "https://checkout.test/s" } as never);
    expect((await checkout()).status).toBe(200);
  });

  it("a Stripe outage is 503 billing_unavailable, not a 500", async () => {
    vi.spyOn(stripeClient.customers, "create").mockRejectedValue(new Stripe.errors.StripeConnectionError({ message: "down" }));
    const res = await checkout();
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("billing_unavailable");
    expect(await storedCustomer()).toBeNull();
  });

  it("the portal reuses the stored customer and calls Stripe with INLINE_REQUEST", async () => {
    await db.update(schema.subscriptions).set({ stripeCustomerId: "cus_live" }).where(eq(schema.subscriptions.userId, userId));
    const create = vi.spyOn(stripeClient.customers, "create");
    const portal = vi.spyOn(stripeClient.billingPortal.sessions, "create").mockResolvedValue({ url: "https://portal.test/p" } as never);
    const res = await request(app).post("/api/billing/portal");
    expect(res.body).toEqual({ url: "https://portal.test/p" });
    expect(portal.mock.calls[0]?.[0]).toMatchObject({ customer: "cus_live" });
    expect(portal.mock.calls[0]?.[1]).toEqual(INLINE);
    expect(create).not.toHaveBeenCalled();
  });
});
