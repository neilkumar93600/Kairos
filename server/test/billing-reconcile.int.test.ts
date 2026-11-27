import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * billingReconcile, the stuck-event sweep and the operator CLI against Postgres, with a fake Stripe (T-BE-17). Written without a
 * local Postgres: it skips here and runs in CI, so none of it has run.
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("billing_reconcile");
process.env.STRIPE_PRICES = JSON.stringify({ "starter:month": "price_starter_month", "pro:week": "price_pro_week" });
const signal = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const { closeDb, db: appDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processBillingReconcile, processStripeSweep } = await import("../src/jobs/billing-reconcile");
const { processInvariantsHourly } = await import("../src/jobs/invariants");
const { markStripeEventDead, processStoredEvent, storeStripeEvent, stripeEventKey } = await import("../src/services/billing-events");
const { resumeOutbox } = await import("../src/durable/outbox");
const { adjust, redrive, refund, repairBalance } = await import("../scripts/ops-billing");

describe.skipIf(!hasTestDb)("the billing reconcile", () => {
  let tdb: Awaited<ReturnType<typeof testDb>>;

  beforeAll(async () => {
    tdb = await testDb("billing_reconcile");
  });
  beforeEach(async () => {
    await resetDb(tdb);
    signal.mockClear();
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  const sub = (id: string, customer: string, userId: string, status = "active", price = "price_pro_week", extra: object = {}) =>
    ({ id, status, customer, metadata: { userId }, cancel_at_period_end: false, pause_collection: null, items: { data: [{ price: { id: price }, current_period_end: 1_900_000_000 }] }, ...extra }) as unknown as Stripe.Subscription;

  const paid = (id: string, customer: string, userId: string | null, amount = 1900, price = "price_starter_month") =>
    ({
      id,
      amount_paid: amount,
      total: amount,
      status_transitions: { paid_at: 1_800_000_000 },
      customer,
      discounts: [],
      lines: { data: [{ pricing: { price_details: { price } }, parent: { subscription_item_details: { proration: false } }, amount }], has_more: false },
      parent: { subscription_details: { metadata: userId ? { userId } : {}, subscription: "sub_x" } },
    }) as unknown as Stripe.Invoice;

  /** Prices that all match plans.ts, so a test sees only the finding it sets up. */
  const goodPrice = async (id: string) =>
    (id === "price_starter_month"
      ? { unit_amount: 1900, currency: "usd", recurring: { interval: "month", interval_count: 1 } }
      : { unit_amount: 1200, currency: "usd", recurring: { interval: "week", interval_count: 1 } }) as unknown as Stripe.Price;

  function api(opts: { invoices?: Stripe.Invoice[]; subs?: Stripe.Subscription[]; price?: (id: string) => Promise<Stripe.Price | null> } = {}) {
    const byId = new Map((opts.subs ?? []).map((s) => [s.id, s]));
    return {
      paidInvoicesSince: async () => opts.invoices ?? [],
      allSubscriptions: async () => opts.subs ?? [],
      price: opts.price ?? goodPrice,
      fetch: {
        // As Stripe answers for a subscription it does not have.
        retrieveSubscription: async (id: string) => byId.get(id) ?? Promise.reject(Object.assign(new Error("No such subscription"), { type: "StripeInvalidRequestError", code: "resource_missing" })),
        listInvoiceLines: async () => [],
        invoiceCouponIds: async () => [],
      },
    };
  }

  async function linked(customer: string, set: Partial<typeof schema.subscriptions.$inferInsert> = {}) {
    const userId = await seedUser(tdb);
    await tdb.update(schema.subscriptions).set({ stripeCustomerId: customer, ...set }).where(eq(schema.subscriptions.userId, userId));
    return userId;
  }
  const row = async (userId: string) => (await tdb.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)))[0]!;
  const grants = async (userId: string) => tdb.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId));

  it("a clean account: no findings, no signal, and the success mark", async () => {
    const userId = await linked("cus_clean", { plan: "pro", interval: "week", status: "active", stripeSubscriptionId: "sub_clean", currentPeriodEnd: new Date(1_900_000_000_000) });
    await tdb.insert(schema.creditLedger).values({ userId, delta: 1000, reason: "plan_grant", stripeInvoiceId: "in_clean" });
    const report = await processBillingReconcile(api({ invoices: [paid("in_clean", "cus_clean", userId)], subs: [sub("sub_clean", "cus_clean", userId)] }));
    expect(report).toEqual({ invoicesListed: 1, missingGrants: 0, subscriptionDrift: 0, synced: 0, doubleLive: 0, anomalies: 0, priceMismatch: 0, graceExpired: 0, balanceDrift: 0 });
    expect(signal).not.toHaveBeenCalled();
  });

  it("a paid invoice no event delivered gets its grant and its rollover, once, and a $0 one gets none", async () => {
    const userId = await linked("cus_lost");
    await tdb.insert(schema.creditLedger).values({ userId, delta: 2500, reason: "admin_adjustment", note: "fixture balance" });
    const a = api({ invoices: [paid("in_lost", "cus_lost", null), paid("in_zero", "cus_lost", null, 0)] });
    expect(await processBillingReconcile(a)).toMatchObject({ invoicesListed: 2, missingGrants: 1 });
    expect((await grants(userId)).filter((g) => g.stripeInvoiceId).map((g) => [g.reason, g.delta]).sort()).toEqual([["expiry", -1500], ["plan_grant", 1000]]);
    expect(signal).toHaveBeenCalledWith("billing_grants_missing", 1);
    expect(await processBillingReconcile(a)).toMatchObject({ missingGrants: 0 });
    expect((await grants(userId)).filter((g) => g.stripeInvoiceId)).toHaveLength(2);
  });

  it("an event for the same invoice afterwards is a duplicate: the reconcile and the event cannot both grant", async () => {
    const userId = await linked("cus_both");
    await processBillingReconcile(api({ invoices: [paid("in_both", "cus_both", userId)] }));
    const event = { id: "evt_both", object: "event", created: 1_800_000_000, type: "invoice.paid", data: { object: paid("in_both", "cus_both", userId) } } as unknown as Stripe.Event;
    await storeStripeEvent(appDb(), event);
    await expect(processStoredEvent(appDb(), "evt_both", api().fetch)).resolves.toBe("grant_duplicate");
    expect((await grants(userId)).filter((g) => g.reason === "plan_grant")).toHaveLength(1);
  });

  it("an invoice that needs an operator is counted, and does not stop the others", async () => {
    const userId = await linked("cus_ok");
    const report = await processBillingReconcile(api({ invoices: [paid("in_unknown", "cus_nobody", null), paid("in_retired", "cus_ok", null, 1900, "price_retired"), paid("in_ok", "cus_ok", null)] }));
    expect(report).toMatchObject({ missingGrants: 1, anomalies: 2 });
    expect(signal).toHaveBeenCalledWith("billing_reconcile_findings", expect.any(Number));
    expect((await grants(userId)).map((g) => g.stripeInvoiceId)).toEqual(["in_ok"]);
  });

  it("a subscription that differs from Stripe is synced from a fresh refetch, and the guard does not move", async () => {
    const guard = new Date(1_800_000_000_000);
    const userId = await linked("cus_drift", { plan: "pro", interval: "week", status: "active", stripeSubscriptionId: "sub_drift", currentPeriodEnd: new Date(1_900_000_000_000), stripeEventCreated: guard });
    const report = await processBillingReconcile(api({ subs: [sub("sub_drift", "cus_drift", userId, "past_due", "price_pro_week", { cancel_at_period_end: true })] }));
    expect(report).toMatchObject({ subscriptionDrift: 1, synced: 1 });
    expect(await row(userId)).toMatchObject({ status: "past_due", cancelAtPeriodEnd: true, stripeEventCreated: guard });
    expect((await row(userId)).pastDueSince).toBeInstanceOf(Date);
  });

  it("a tracked subscription missing from the list is asked for, not written Free: still live at Stripe, it stays (R2 finding 2)", async () => {
    const userId = await linked("cus_late", { plan: "pro", interval: "week", status: "active", stripeSubscriptionId: "sub_late" });
    let asked = 0;
    const a = api();
    a.fetch.retrieveSubscription = async () => {
      asked++;
      return sub("sub_late", "cus_late", userId);
    };
    const report = await processBillingReconcile(a);
    expect(asked).toBe(1);
    expect(await row(userId)).toMatchObject({ plan: "pro", status: "active", stripeSubscriptionId: "sub_late" });
    expect(report).toMatchObject({ subscriptionDrift: 1, synced: 1, anomalies: 0 });
  });

  it("only Stripe's resource_missing ends a tracked subscription; another Stripe error writes nothing and fails the run", async () => {
    const gone = await linked("cus_gone", { plan: "pro", interval: "week", status: "active", stripeSubscriptionId: "sub_gone" });
    const a = api();
    a.fetch.retrieveSubscription = async () => Promise.reject(Object.assign(new Error("No such subscription"), { type: "StripeInvalidRequestError", code: "resource_missing" }));
    await processBillingReconcile(a);
    expect(await row(gone)).toMatchObject({ plan: "free", status: "canceled", stripeSubscriptionId: "sub_gone" });

    const blip = await linked("cus_blip", { plan: "pro", interval: "week", status: "active", stripeSubscriptionId: "sub_blip" });
    const b = api();
    b.fetch.retrieveSubscription = async () => Promise.reject(Object.assign(new Error("timeout"), { type: "StripeConnectionError" }));
    await expect(processBillingReconcile(b)).rejects.toThrow(/timeout/);
    expect(await row(blip)).toMatchObject({ plan: "pro", status: "active" });
  });

  it("a renewal paid three weeks after it was created is still in the window (R2 finding 6)", async () => {
    const asked: Date[] = [];
    const a = {
      ...api(),
      paidInvoicesSince: async (since: Date) => {
        asked.push(since);
        return [];
      },
    };
    await processBillingReconcile(a);
    expect(Date.now() - asked[0]!.getTime()).toBeGreaterThanOrEqual(30 * 24 * 3600_000 - 60_000);
  });

  it("a live subscription whose events were lost is picked up, and Stripe's only one replaces a dead tracked one", async () => {
    const fresh = await linked("cus_new");
    const moved = await linked("cus_moved", { plan: "free", status: "canceled", stripeSubscriptionId: "sub_old" });
    const report = await processBillingReconcile(api({ subs: [sub("sub_new", "cus_new", fresh), sub("sub_old", "cus_moved", moved, "canceled"), sub("sub_moved", "cus_moved", moved)] }));
    expect(report).toMatchObject({ subscriptionDrift: 2, synced: 2, doubleLive: 0 });
    expect(await row(fresh)).toMatchObject({ plan: "pro", stripeSubscriptionId: "sub_new" });
    expect(await row(moved)).toMatchObject({ plan: "pro", stripeSubscriptionId: "sub_moved" });
  });

  it("two live subscriptions on a customer are counted, and nothing picks one", async () => {
    const userId = await linked("cus_double", { plan: "pro", interval: "week", status: "active", stripeSubscriptionId: "sub_a", currentPeriodEnd: new Date(1_900_000_000_000) });
    const report = await processBillingReconcile(api({ subs: [sub("sub_a", "cus_double", userId), sub("sub_b", "cus_double", userId)] }));
    expect(report).toMatchObject({ doubleLive: 1, subscriptionDrift: 0 });
    expect((await row(userId)).stripeSubscriptionId).toBe("sub_a");
  });

  it("a local subscription Stripe does not have at all ends as cancelled", async () => {
    const userId = await linked("cus_wiped", { plan: "pro", interval: "week", status: "past_due", stripeSubscriptionId: "sub_wiped", pastDueSince: new Date() });
    expect(await processBillingReconcile(api())).toMatchObject({ subscriptionDrift: 1, synced: 1 });
    expect(await row(userId)).toMatchObject({ plan: "free", interval: null, status: "canceled", pastDueSince: null });
  });

  it("reports a price mismatch, a grace that ran out and a balance that drifted", async () => {
    const lapsed = await seedUser(tdb);
    await tdb.update(schema.subscriptions).set({ plan: "pro", interval: "week", status: "past_due", pastDueSince: new Date(Date.now() - 8 * 86_400_000) }).where(eq(schema.subscriptions.userId, lapsed));
    const drifted = await seedUser(tdb, { credits: 5 });
    await tdb.execute(sql`update credit_balances set balance = 99 where user_id = ${drifted}`);
    const report = await processBillingReconcile(api({ price: async (id) => (id === "price_pro_week" ? null : goodPrice(id)) }));
    expect(report).toMatchObject({ priceMismatch: 1, graceExpired: 1, balanceDrift: 1 });
    expect(signal).toHaveBeenCalledWith("billing_reconcile_findings", expect.any(Number));
  });

  it("BILL-7: silent on a database where it never ran, and pages once a success is over 26 hours old", async () => {
    expect((await processInvariantsHourly()).find((v) => v.id === "BILL-7")).toBeUndefined();
    await tdb.insert(schema.metricsMinute).values({ minute: new Date(Date.now() - 27 * 3600_000), name: "billing.reconcile.success", label: "", value: 1 });
    expect((await processInvariantsHourly()).find((v) => v.id === "BILL-7")).toMatchObject({ n: 1, freezes: false });
    await tdb.insert(schema.metricsMinute).values({ minute: new Date(Date.now() - 3600_000), name: "billing.reconcile.success", label: "", value: 1 });
    expect((await processInvariantsHourly()).find((v) => v.id === "BILL-7")).toBeUndefined();
  });

  describe("the stuck-event sweep", () => {
    const store = async (id: string, minutesAgo: number, redrives = 0, outboxStatus: "pending" | "enqueued" | "done" | "dead" | null = "dead") => {
      await tdb.insert(schema.stripeEvents).values({ id, type: "invoice.paid", status: "received", processedAt: null, receivedAt: new Date(Date.now() - minutesAgo * 60_000), redrives });
      if (outboxStatus) await tdb.insert(schema.outbox).values({ queue: "stripe", dedupeKey: stripeEventKey(id), payload: { eventId: id }, status: outboxStatus, attempts: outboxStatus === "dead" ? 5 : 0 });
    };
    const event = async (id: string) => (await tdb.select().from(schema.stripeEvents).where(eq(schema.stripeEvents.id, id)))[0]!;
    const job = async (id: string) => (await tdb.select().from(schema.outbox).where(eq(schema.outbox.dedupeKey, stripeEventKey(id))))[0];

    it("leaves a young row and a row whose job is still moving", async () => {
      await store("evt_young", 5);
      await store("evt_pending", 60, 0, "pending");
      await store("evt_enqueued", 60, 0, "enqueued");
      expect(await processStripeSweep()).toMatchObject({ redriven: 0, dead: 0 });
      expect(await event("evt_pending")).toMatchObject({ redrives: 0 });
    });

    it("reopens a row whose job gave up, and writes one retention took", async () => {
      await store("evt_gaveup", 60);
      await store("evt_noRow", 60, 0, null);
      expect(await processStripeSweep()).toMatchObject({ redriven: 2 });
      expect(await event("evt_gaveup")).toMatchObject({ status: "received", redrives: 1 });
      expect(await job("evt_gaveup")).toMatchObject({ status: "pending", attempts: 0, lastError: null });
      expect(await job("evt_noRow")).toMatchObject({ status: "pending", queue: "stripe", payload: { eventId: "evt_noRow" } });
      // Its job is moving again now, so the next tick does nothing more.
      expect(await processStripeSweep()).toMatchObject({ redriven: 0 });
    });

    it("spaces the rounds 12 hours apart, then goes dead with a page after the sixth", async () => {
      await store("evt_tooSoon", 11 * 60, 1);
      await store("evt_due", 13 * 60, 1);
      await store("evt_spent", 80 * 60, 6);
      expect(await processStripeSweep()).toMatchObject({ redriven: 1, dead: 1 });
      expect(await event("evt_tooSoon")).toMatchObject({ redrives: 1, status: "received" });
      expect(await event("evt_due")).toMatchObject({ redrives: 2, status: "received" });
      expect(await event("evt_spent")).toMatchObject({ status: "dead", lastError: "retries_exhausted" });
      expect(signal).toHaveBeenCalledWith("stripe_event_dead");
    });

    it("pages when the oldest is over 30 minutes behind", async () => {
      await store("evt_old", 31, 0, "pending");
      await processStripeSweep();
      expect(signal).toHaveBeenCalledWith("stripe_event_stuck");
    });

    it("an operator's resume of its outbox row is refused once the event has moved on", async () => {
      await store("evt_moved", 60);
      await tdb.update(schema.stripeEvents).set({ status: "ignored", outcome: "unhandled_type", processedAt: new Date() }).where(eq(schema.stripeEvents.id, "evt_moved"));
      const row = await job("evt_moved");
      await expect(resumeOutbox(row!.id, "ops", "test")).rejects.toMatchObject({ status: 409 });
    });
  });

  describe("the operator CLI", () => {
    const audit = async () => tdb.select().from(schema.opsAudit);
    const ACTOR = "owner-1";

    it("adjust writes one ledger row and one audit row, and refuses what a code must not hold", async () => {
      const userId = await seedUser(tdb, { credits: 5 });
      await expect(adjust(appDb(), { actor: ACTOR, userId, delta: -2, note: "goodwill reversal" })).resolves.toMatchObject({ balance: 3 });
      expect(await grants(userId)).toHaveLength(2);
      expect(await audit()).toEqual([expect.objectContaining({ actor: ACTOR, action: "credit.adjust", target: `user:${userId}`, before: { balance: 5 }, after: { balance: 3, delta: -2, note: "goodwill reversal" } })]);
      await expect(adjust(appDb(), { actor: "ann@example.com", userId, delta: 1, note: "x" })).rejects.toThrow(/refused/);
      await expect(adjust(appDb(), { actor: ACTOR, userId, delta: 1, note: "ann@example.com" })).rejects.toThrow(/refused/);
      await expect(adjust(appDb(), { actor: ACTOR, userId, delta: 0, note: "x" })).rejects.toThrow(/refused/);
      await expect(adjust(appDb(), { actor: ACTOR, userId, delta: 1.5, note: "x" })).rejects.toThrow(/refused/);
      expect(await grants(userId)).toHaveLength(2);
    });

    it("refund: only a charged submission, once", async () => {
      const userId = await seedUser(tdb, { credits: 5 });
      const [company] = await tdb.insert(schema.companies).values({ name: "c", ats: "greenhouse", boardToken: randomUUID() }).returning();
      const [j] = await tdb.insert(schema.jobs).values({ companyId: company!.id, externalId: "1", title: "t", descriptionText: "d", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" }).returning();
      const [app] = await tdb.insert(schema.applications).values({ userId, jobId: j!.id, status: "approved", channel: "extension", approvedAt: new Date() }).returning();
      await expect(refund(appDb(), { actor: ACTOR, applicationId: app!.id, note: "employer bounced" })).rejects.toThrow(/never charged/);
      await tdb.insert(schema.creditLedger).values({ userId, delta: -1, reason: "submission", applicationId: app!.id });
      await expect(refund(appDb(), { actor: ACTOR, applicationId: app!.id, note: "employer bounced" })).resolves.toMatchObject({ balance: 5 });
      await expect(refund(appDb(), { actor: ACTOR, applicationId: app!.id, note: "employer bounced" })).rejects.toThrow(/already refunded/);
      expect((await audit()).map((a) => a.action)).toEqual(["credit.refund"]);
    });

    it("redrive: a dead event only; it runs again, and the audit says so", async () => {
      const userId = await seedUser(tdb);
      const event = { id: "evt_cli", object: "event", created: 1_800_000_000, type: "invoice.paid", data: { object: paid("in_cli", "cus_cli", userId) } } as unknown as Stripe.Event;
      await storeStripeEvent(appDb(), event);
      await expect(redrive(appDb(), { actor: ACTOR, eventId: "evt_cli" })).rejects.toThrow(/not dead/);
      await markStripeEventDead(appDb(), "evt_cli", "anomaly_no_user", "anomaly_no_user");
      await tdb.update(schema.outbox).set({ status: "done" }).where(eq(schema.outbox.dedupeKey, stripeEventKey("evt_cli")));
      await expect(redrive(appDb(), { actor: ACTOR, eventId: "evt_cli" })).resolves.toMatchObject({ redrives: 1 });
      expect((await tdb.select().from(schema.outbox))[0]).toMatchObject({ status: "pending" });
      await expect(processStoredEvent(appDb(), "evt_cli", api().fetch)).resolves.toBe("grant_applied");
      expect((await grants(userId)).map((g) => g.reason)).toEqual(["plan_grant"]);
      expect((await audit()).map((a) => a.action)).toEqual(["stripe_event.redrive"]);
    });

    it("repair-balance puts the row back to its recount, and the audit keeps both", async () => {
      const userId = await seedUser(tdb, { credits: 5 });
      await tdb.execute(sql`update credit_balances set balance = 99, in_flight = 7 where user_id = ${userId}`);
      await expect(repairBalance(appDb(), { actor: ACTOR, userId })).resolves.toMatchObject({ before: { balance: 99, inFlight: 7 }, after: { balance: 5, inFlight: 0 } });
      expect((await audit())[0]).toMatchObject({ action: "credit_balance.repair", before: { balance: 99, inFlight: 7 }, after: { balance: 5, inFlight: 0 } });
    });
  });
});
