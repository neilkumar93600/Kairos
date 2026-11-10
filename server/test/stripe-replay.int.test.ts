import { existsSync, readdirSync, readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";
import { FIXTURE_PRICES, lifecycle, type FixtureEvent } from "./helpers/stripe-fixture";

/**
 * tests-14 (T-BE-10, T-BE-11): a replay of a customer's events produces identical ledgers, through the route and the job's code,
 * with a fake Stripe. Stripe is never called. Written without a local Postgres: it skips here and runs in CI, so none of it has
 * run. The events here are hand-built (helpers/stripe-fixture.ts); recorded ones, when the owner has made them, are replayed by
 * the last block, and only those prove the acceptance as written.
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("stripe_replay");
process.env.STRIPE_SECRET_KEY = "sk_test_replay";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_replay";
process.env.STRIPE_PRICES = JSON.stringify(FIXTURE_PRICES);
const signal = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const { createApp } = await import("../src/app");
const { closeDb, db: appDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processStoredEvent } = await import("../src/services/billing-events");
const { stripe } = await import("../src/services/stripe");

const RECORDED = new URL("./fixtures/stripe/recorded/", import.meta.url);

describe.skipIf(!hasTestDb)("Stripe replay", () => {
  let tdb: Awaited<ReturnType<typeof testDb>>;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    tdb = await testDb("stripe_replay");
    app = createApp({ auth: { handler: async () => new Response("{}"), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
  });
  beforeEach(async () => {
    await resetDb(tdb);
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  const post = (event: Stripe.Event) => {
    const payload = JSON.stringify(event);
    const signature = stripe().webhooks.generateTestHeaderString({ payload, secret: "whsec_test_replay" });
    return request(app).post("/api/webhooks/stripe").set("stripe-signature", signature).set("content-type", "application/json").send(payload);
  };

  /** A fake Stripe whose refetch answers what the fixture recorded for this event, else the newest state it has seen. */
  function fakeStripe(state: { current?: Stripe.Subscription }) {
    return {
      retrieveSubscription: async () => {
        if (!state.current) throw Object.assign(new Error("no such subscription"), { type: "StripeInvalidRequestError", code: "resource_missing" });
        return state.current;
      },
      listInvoiceLines: async () => [],
      invoiceCouponIds: async () => [],
    };
  }

  async function deliver({ event, subscription }: FixtureEvent, state: { current?: Stripe.Subscription }, copies = 1) {
    if (subscription) state.current = subscription;
    const stored = await Promise.all(Array.from({ length: copies }, () => post(event)));
    for (const res of stored) expect(res.status).toBe(200);
    await Promise.all(Array.from({ length: copies }, () => processStoredEvent(appDb(), event.id, fakeStripe(state))));
  }

  /** A ledger with what differs between runs by nature taken out: the row ids, the times and the fixture's own tag. */
  async function ledgerOf(userId: string, tag = "") {
    const rows = await tdb.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId));
    return rows
      .filter((r) => r.reason !== "free_grant")
      .map((r) => ({ reason: r.reason, delta: r.delta, invoice: r.stripeInvoiceId ?? "", note: r.note ?? "" }))
      .map((r) => (tag ? { ...r, invoice: r.invoice.replace(`_${tag}_`, "_T_") } : r))
      .sort((a, b) => a.invoice.localeCompare(b.invoice) || a.reason.localeCompare(b.reason));
  }
  const sortRows = <T extends { invoice: string; reason: string }>(rows: T[], tag = "") =>
    rows.map((r) => (tag ? { ...r, invoice: r.invoice.replace(`_${tag}_`, "_T_") } : r)).sort((a, b) => a.invoice.localeCompare(b.invoice) || a.reason.localeCompare(b.reason));

  const subscriptionOf = async (userId: string) => {
    const [row] = await tdb.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
    return { plan: row!.plan, interval: row!.interval, status: row!.status, cancelAtPeriodEnd: row!.cancelAtPeriodEnd, collectionPaused: row!.collectionPaused };
  };
  const balanceOf = async (userId: string) => {
    const [row] = await tdb.select({ balance: schema.creditBalances.balance }).from(schema.creditBalances).where(eq(schema.creditBalances.userId, userId));
    const { rows } = await tdb.execute<{ total: number }>(sql`select coalesce(sum(delta), 0)::int as total from credit_ledger where user_id = ${userId}`);
    return { cache: row?.balance, recount: rows[0]!.total };
  };

  it("in order: the expected ledger, the expected subscription, every event finished, and no person in a row", async () => {
    const userId = await seedUser(tdb, { credits: 25 });
    const scenario = lifecycle(userId, "one");
    const state: { current?: Stripe.Subscription } = {};
    for (const e of scenario.events) await deliver(e, state);

    expect(await ledgerOf(userId)).toEqual(sortRows(scenario.ledger));
    expect(await subscriptionOf(userId)).toEqual(scenario.subscription);
    const { cache, recount } = await balanceOf(userId);
    expect(cache).toBe(recount);
    expect(cache).toBe(25 + 1000 + 1000 - 25 + 1200 - 800 + 1200 - 1200 + 1000 - 1400);

    const events = await tdb.select().from(schema.stripeEvents);
    expect(events).toHaveLength(scenario.events.length);
    expect(events.filter((e) => e.status === "received" || e.status === "dead")).toEqual([]);
    const outcome = (type: string) => events.filter((e) => e.type === type).map((e) => e.outcome);
    expect(outcome("invoice.paid").sort()).toEqual(["grant_applied", "grant_applied", "grant_applied", "grant_applied", "grant_applied", "proration_only", "zero_amount"]);
    expect(outcome("charge.refunded")).toEqual(["alert_only"]);
    expect(JSON.stringify(events)).not.toMatch(/zqmarker|98765/i);
  });

  it("a second full replay changes nothing: all duplicates, and the same ledger", async () => {
    const userId = await seedUser(tdb, { credits: 25 });
    const scenario = lifecycle(userId, "twice");
    const state: { current?: Stripe.Subscription } = {};
    for (const e of scenario.events) await deliver(e, state);
    const first = await ledgerOf(userId);
    const sub = await subscriptionOf(userId);
    for (const { event } of scenario.events) {
      const res = await post(event);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true, duplicate: true });
      await expect(processStoredEvent(appDb(), event.id, fakeStripe(state))).resolves.toBe("done");
    }
    expect(await ledgerOf(userId)).toEqual(first);
    expect(await subscriptionOf(userId)).toEqual(sub);
  });

  it("two customers replaying the same scenario get identical ledgers, one of them with every event delivered 10 times at once", async () => {
    const [a, b] = [await seedUser(tdb, { credits: 25 }), await seedUser(tdb, { credits: 25 })];
    const once = lifecycle(a, "a");
    const tenfold = lifecycle(b, "b");
    const stateA: { current?: Stripe.Subscription } = {};
    const stateB: { current?: Stripe.Subscription } = {};
    for (const e of once.events) await deliver(e, stateA);
    for (const e of tenfold.events) await deliver(e, stateB, 10);
    expect(await ledgerOf(b, "b")).toEqual(await ledgerOf(a, "a"));
    expect(await subscriptionOf(b)).toEqual(await subscriptionOf(a));
    expect(await balanceOf(b)).toEqual(await balanceOf(a));
  });

  it("every event shuffled and run at once: one grant per paid invoice, the same balance when no cap binds, and Stripe's final state", async () => {
    // Shuffling can move an expiry between invoices of different sizes (credits.ts says so), so this one keeps under the cap: one
    // starter invoice, a refund, and every subscription event, with a refetch that always answers Stripe's final state.
    const userId = await seedUser(tdb);
    const scenario = lifecycle(userId, "shuffle");
    const invoices = scenario.events.filter((e) => e.event.id.endsWith("_2") || e.event.type === "charge.refunded");
    const syncs = scenario.events.filter((e) => e.event.type.startsWith("customer.subscription"));
    const final = syncs.at(-1)!.subscription!;
    const picked = [...invoices, ...syncs].map((e) => ({ e, key: Math.random() })).sort((x, y) => x.key - y.key).map((x) => x.e);
    const state: { current?: Stripe.Subscription } = { current: final };
    for (const { event } of picked) expect((await post(event)).status).toBe(200);
    await Promise.all(picked.flatMap(({ event }) => [processStoredEvent(appDb(), event.id, fakeStripe(state)), processStoredEvent(appDb(), event.id, fakeStripe(state))]));
    expect((await ledgerOf(userId)).map((r) => [r.reason, r.delta])).toEqual([["plan_grant", 1000]]);
    expect((await subscriptionOf(userId)).status).toBe("canceled");
    expect((await tdb.select().from(schema.stripeEvents)).filter((e) => e.status === "received" || e.status === "dead")).toEqual([]);
  });

  it("invoice.paid before subscription.created grants at once, and the plan follows with its event (T-BE-12)", async () => {
    const userId = await seedUser(tdb, { credits: 25 });
    const scenario = lifecycle(userId, "early");
    const [created, paid, updated] = scenario.events;
    const state: { current?: Stripe.Subscription } = {};
    await deliver(paid!, state);
    expect(await ledgerOf(userId)).toEqual([{ reason: "plan_grant", delta: 1000, invoice: "in_fixture_early_1", note: "plan=starter interval=month" }]);
    expect((await subscriptionOf(userId)).plan).toBe("free");
    await deliver(created!, state);
    await deliver(updated!, state);
    expect(await subscriptionOf(userId)).toMatchObject({ plan: "starter", status: "active" });
  });

  const recorded = existsSync(RECORDED) ? readdirSync(RECORDED).filter((f) => f.endsWith(".json")) : [];

  /** The file scripts/stripe-test-clock.ts record writes. Skipped until there is one: this is not a pass of the acceptance before then. */
  it.skipIf(recorded.length === 0).each(recorded)("recorded %s: two replays give identical ledgers, one grant per paid invoice", async (file) => {
    const { userId, events } = JSON.parse(readFileSync(new URL(file, RECORDED), "utf8")) as { userId: string; events: FixtureEvent[] };
    const replay = async () => {
      await resetDb(tdb);
      await seedUser(tdb, { id: userId, credits: 25 });
      const state: { current?: Stripe.Subscription } = {};
      for (const e of events) await deliver(e, state);
      return ledgerOf(userId);
    };
    const first = await replay();
    expect(await replay()).toEqual(first);
    const paid = events.filter((e) => e.event.type === "invoice.paid" && (e.event.data.object as Stripe.Invoice).amount_paid > 0).map((e) => (e.event.data.object as Stripe.Invoice).id);
    expect(first.filter((r) => r.reason === "plan_grant").map((r) => r.invoice).sort()).toEqual([...new Set(paid)].sort());
  });
});
