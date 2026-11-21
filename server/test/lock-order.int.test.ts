import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeTestDbs, hasTestDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * T-DB-2 (02-database, tests-49): random interleavings of every path that takes the money locks, for one user, and zero
 * deadlocks. Written without a local Postgres: it skips here and runs in CI, so none of it has run.
 *
 * Real code for: approveCore, the extension report (recordOutcome), settleAttempt, withdraw, claim and release,
 * claim_cloud_attempt and the applier's result, return-to-draft, the legacy repair, the visibility lease, a Stripe grant and a
 * subscription sync through processStoredEvent, an operator adjustment and the stale-attempt close. Statement stand-ins, because
 * their real path needs a model or a mail: classifyEmail's stage write (one application row) and an identity write (the profile
 * row). Autopilot off and the offer-pause apply do not exist yet: WP-36 and WP-33 add theirs here.
 *
 * recordExtensionReport retries one 40P01 by design, so catching rejections alone would hide a deadlock. pg_stat_database counts
 * every one, and the control test proves this harness sees them. This file has its own database, so no other file's count mixes in.
 */
const ROUNDS = Number(process.env.LOCK_ORDER_ROUNDS ?? 1000);
const ERASURE_ROUNDS = Math.ceil(ROUNDS / 10);

if (hasTestDb) process.env.DATABASE_URL = testDbUrl("lock_order");
process.env.STRIPE_PRICES = JSON.stringify({ "starter:month": "price_starter_month", "pro:week": "price_pro_week" });

const enqueue = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));
const signal = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const { closeDb, db: appDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processStoredEvent, storeStripeEvent } = await import("../src/services/billing-events");
const { adjustCredits } = await import("../src/services/credits");
const { eraseUser } = await import("../src/services/erasure");
const { closeStaleAttempts, recordExtensionReport, repairLegacyRows, returnStaleApprovals, settleAttempt } = await import("../src/services/settle");
const { approveApplications, claimForExtension, leaseExtensionQueue, releaseForExtension, withdrawApplication } = await import("../src/services/submissions");

const ANSWER = { fieldKey: "first_name", label: "First name", value: "Test", source: "profile" as const };
const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: [] as string[] };
const SESSION = "lock-order-session";

describe.skipIf(!hasTestDb)("the lock order (T-DB-2)", () => {
  let tdb: Awaited<ReturnType<typeof testDb>>;
  let companyId: string;

  beforeAll(async () => {
    tdb = await testDb("lock_order");
    const [company] = await tdb.insert(schema.companies).values({ name: "Lock Order", ats: "greenhouse", boardToken: `lock-order-${randomUUID()}` }).returning();
    companyId = company!.id;
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  const shuffled = <T,>(items: T[]): T[] =>
    items
      .map((item) => ({ item, key: Math.random() }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.item);

  type AppState = "draft" | "approved-extension" | "approved-cloud" | "stale-approved" | "legacy-submitting";

  /** One bulk insert per kind of row: a round's setup must stay cheap. Returns ids in the order of `states`. */
  async function apps(userId: string, states: AppState[]): Promise<string[]> {
    const jobs = await tdb
      .insert(schema.jobs)
      .values(states.map(() => ({ companyId, externalId: randomUUID(), title: "Engineer", descriptionText: "Build things", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })))
      .returning({ id: schema.jobs.id });
    const old = new Date(Date.now() - 15 * 24 * 3600_000);
    const rows = await tdb
      .insert(schema.applications)
      .values(
        states.map((state, i) => ({
          userId,
          jobId: jobs[i]!.id,
          resumeLines: [LINE],
          answers: [ANSWER],
          status: state === "draft" ? ("draft" as const) : state === "legacy-submitting" ? ("submitting" as const) : ("approved" as const),
          channel: state === "draft" ? null : state === "approved-extension" || state === "stale-approved" ? ("extension" as const) : ("cloud" as const),
          approvedBy: state === "draft" ? null : ("user" as const),
          approvedAt: state === "draft" ? null : state === "stale-approved" ? old : new Date(),
          updatedAt: state === "legacy-submitting" ? old : new Date(),
          attemptNo: state === "draft" ? 0 : 1,
        })),
      )
      .returning({ id: schema.applications.id });
    return rows.map((r) => r.id);
  }

  const subscription = (id: string, userId: string, customer: string): Stripe.Subscription =>
    ({
      id,
      status: "active",
      customer,
      metadata: { userId },
      cancel_at_period_end: false,
      pause_collection: null,
      items: { data: [{ price: { id: "price_pro_week" }, current_period_end: 1_900_000_000 }] },
    }) as unknown as Stripe.Subscription;

  const stripeEvent = (id: string, type: string, object: unknown): Stripe.Event => ({ id, object: "event", created: Math.floor(Date.now() / 1000), type, data: { object } }) as unknown as Stripe.Event;

  const invoice = (id: string, userId: string, customer: string) => ({
    id,
    amount_paid: 1900,
    customer,
    lines: { data: [{ pricing: { price_details: { price: "price_starter_month" } }, parent: { subscription_item_details: { proration: false } } }], has_more: false },
    parent: { subscription_details: { metadata: { userId }, subscription: `sub_${customer}` } },
  });

  const report = (applicationId: string, outcome: "submitted" | "failed") => ({ applicationId, outcome, filledFields: [], submittedAt: new Date().toISOString(), ...(outcome === "failed" ? { failureReason: "the extension stopped" } : {}) }) as never;

  /** Every rejection's code. A refusal (409, 402, 404) is a right answer in some interleavings; only a lock failure or a crash is not. */
  const codeOf = (err: unknown): string => {
    const e = err as { status?: number; code?: string; cause?: { code?: string } };
    if (typeof e.status === "number") return "http";
    return e.cause?.code ?? e.code ?? String(err).slice(0, 200);
  };

  async function run(ops: (() => Promise<unknown>)[]): Promise<string[]> {
    const started = shuffled(ops).map(async (op) => {
      // Up to 3 ms apart: enough to change who holds what first, without losing the overlap.
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 3));
      return op();
    });
    const settled = await Promise.allSettled(started);
    return settled.flatMap((r) => (r.status === "rejected" ? [codeOf(r.reason)] : []));
  }

  /** What Postgres counted, after a pool close has flushed its backends' statistics. */
  async function deadlocksSoFar(): Promise<number> {
    await closeDb();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await tdb.execute(sql`select pg_stat_clear_snapshot()`);
    const { rows } = await tdb.execute<{ n: string }>(sql`select deadlocks as n from pg_stat_database where datname = current_database()`);
    return Number(rows[0]?.n ?? 0);
  }

  async function recount(userId: string) {
    const [cache] = await tdb.select().from(schema.creditBalances).where(eq(schema.creditBalances.userId, userId));
    const { rows } = await tdb.execute<{ total: number; n: number }>(sql`
      select (select coalesce(sum(delta), 0)::int from credit_ledger where user_id = ${userId}) as total,
             (select count(*)::int from applications where user_id = ${userId} and status in ('approved', 'submitting')) as n`);
    return { balance: cache?.balance, inFlight: cache?.inFlight, total: rows[0]!.total, n: rows[0]!.n };
  }

  const claim = async (id: string) => (await appDb().execute<{ id: string | null }>(sql`select claim_cloud_attempt(${id}, 1, 'lock-order') as id`)).rows[0]!.id;
  const result = (attempt: string, state: "submitted" | "failed") =>
    appDb().execute(sql`select record_attempt_result(${attempt}, ${state}, ${state === "failed" ? "applier_error" : null}, '{}'::jsonb)`);

  const api = (userId: string, customer: string) => ({
    retrieveSubscription: async (id: string) => subscription(id, userId, customer),
    listInvoiceLines: async () => [],
    invoiceCouponIds: async () => [],
  });

  it("the harness sees a deadlock: two transactions in opposite orders are counted", async () => {
    const userId = await seedUser(tdb, { credits: 5 });
    const [app] = await apps(userId, ["approved-extension"]);
    const before = await deadlocksSoFar();
    // The wrong way round on purpose: the application first, then the balance through the trigger, against rule L1.
    let release: () => void = () => {};
    const both = new Promise<void>((resolve) => (release = resolve));
    let ready = 0;
    const meet = async () => {
      if (++ready === 2) release();
      await both;
    };
    const outcomes = await Promise.allSettled([
      appDb().transaction(async (tx) => {
        await tx.execute(sql`select 1 from applications where id = ${app!} for update`);
        await meet();
        await tx.execute(sql`select 1 from credit_balances where user_id = ${userId} for update`);
      }),
      appDb().transaction(async (tx) => {
        await tx.execute(sql`select 1 from credit_balances where user_id = ${userId} for update`);
        await meet();
        await tx.execute(sql`select 1 from applications where id = ${app!} for update`);
      }),
    ]);
    expect(outcomes.filter((o) => o.status === "rejected").map((o) => codeOf((o as PromiseRejectedResult).reason))).toEqual(["40P01"]);
    expect((await deadlocksSoFar()) - before).toBe(1);
  }, 30_000);

  it(`${ROUNDS} interleavings of every money path: no deadlock, and the cache equals its recount`, async () => {
    const userId = await seedUser(tdb, { credits: 1000 });
    await tdb.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test` });
    const customer = `cus_lock_${userId}`.replaceAll("-", "");
    await tdb.update(schema.subscriptions).set({ stripeCustomerId: customer }).where(eq(schema.subscriptions.userId, userId));
    const before = await deadlocksSoFar();
    const failures = new Map<string, number>();

    for (let round = 0; round < ROUNDS; round++) {
      const [approveA, approveB, reported, failed, withdrawn, released, claimed, cloudSent, cloudFailed, stale, legacy, stage] = await apps(userId, [
        "draft", "draft", "approved-extension", "approved-extension", "approved-extension", "approved-extension", "approved-extension", "approved-cloud", "approved-cloud", "stale-approved", "legacy-submitting", "approved-extension",
      ]);
      const paid = `evt_paid_${round}`;
      const synced = `evt_sync_${round}`;
      await storeStripeEvent(appDb(), stripeEvent(paid, "invoice.paid", invoice(`in_${round}`, userId, customer)));
      await storeStripeEvent(appDb(), stripeEvent(synced, "customer.subscription.updated", { id: `sub_${customer}`, customer }));

      const errors = await run([
        () => approveApplications(appDb(), userId, [approveA!, approveB!], "extension"),
        () => recordExtensionReport(appDb(), userId, SESSION, report(reported!, "submitted")),
        () => recordExtensionReport(appDb(), userId, SESSION, report(failed!, "failed")),
        () => withdrawApplication(appDb(), userId, withdrawn!),
        async () => {
          await claimForExtension(appDb(), userId, SESSION, released!);
          await releaseForExtension(appDb(), userId, SESSION, released!);
        },
        async () => {
          await claimForExtension(appDb(), userId, SESSION, claimed!);
          await recordExtensionReport(appDb(), userId, SESSION, report(claimed!, "submitted"));
        },
        async () => {
          const attempt = await claim(cloudSent!);
          if (!attempt) return;
          await result(attempt, "submitted");
          await settleAttempt(appDb(), attempt);
        },
        async () => {
          const attempt = await claim(cloudFailed!);
          if (!attempt) return;
          await result(attempt, "failed");
          await settleAttempt(appDb(), attempt);
        },
        () => returnStaleApprovals(appDb()),
        () => repairLegacyRows(appDb()),
        () => leaseExtensionQueue(appDb(), userId, SESSION),
        () => closeStaleAttempts(appDb()),
        () => processStoredEvent(appDb(), paid, api(userId, customer)),
        () => processStoredEvent(appDb(), synced, api(userId, customer)),
        () => appDb().transaction((tx) => adjustCredits(tx, { userId, delta: 1, note: `lock-order round ${round}` })),
        // classifyEmail's write: one application row.
        () => appDb().execute(sql`update applications set updated_at = now() where id = ${stage!}`),
        // An identity write: the profile row is its per-user mutex.
        () =>
          appDb().transaction(async (tx) => {
            await tx.execute(sql`select 1 from profiles where user_id = ${userId} for no key update`);
            await tx.execute(sql`update profiles set updated_at = now() where user_id = ${userId}`);
          }),
      ]);
      for (const code of errors) failures.set(code, (failures.get(code) ?? 0) + 1);
    }

    // A refusal is a right answer; anything else, and a lock failure above all, is the finding.
    const unexpected = [...failures.entries()].filter(([code]) => code !== "http");
    expect(unexpected).toEqual([]);
    expect((await deadlocksSoFar()) - before).toBe(0);
    const counted = await recount(userId);
    expect(counted.balance).toBe(counted.total);
    expect(counted.inFlight).toBe(counted.n);
  }, 900_000);

  it(`${ERASURE_ROUNDS} erasures against a report, a claim, a settlement and a grant: no deadlock`, async () => {
    const before = await deadlocksSoFar();
    const failures = new Map<string, number>();
    for (let round = 0; round < ERASURE_ROUNDS; round++) {
      const userId = await seedUser(tdb, { credits: 50 });
      const customer = `cus_gone_${round}`;
      await tdb.update(schema.subscriptions).set({ stripeCustomerId: customer }).where(eq(schema.subscriptions.userId, userId));
      const [reported, claimed, cloudSent] = await apps(userId, ["approved-extension", "approved-extension", "approved-cloud"]);
      const paid = `evt_gone_${round}`;
      await storeStripeEvent(appDb(), stripeEvent(paid, "invoice.paid", invoice(`in_gone_${round}`, userId, customer)));
      const errors = await run([
        () => eraseUser(appDb(), userId, "operator"),
        () => recordExtensionReport(appDb(), userId, SESSION, report(reported!, "submitted")),
        () => claimForExtension(appDb(), userId, SESSION, claimed!),
        async () => {
          const attempt = await claim(cloudSent!);
          if (!attempt) return;
          await result(attempt, "submitted");
          await settleAttempt(appDb(), attempt);
        },
        () => processStoredEvent(appDb(), paid, api(userId, customer)),
      ]);
      for (const code of errors) failures.set(code, (failures.get(code) ?? 0) + 1);
    }
    // A write that loses to the erasure fails its foreign key: the account is gone, and that is the right end for it.
    const unexpected = [...failures.entries()].filter(([code]) => code !== "http" && code !== "23503");
    expect(unexpected).toEqual([]);
    expect((await deadlocksSoFar()) - before).toBe(0);
    // Whatever the order, no balance row outlives its account.
    const { rows } = await tdb.execute<{ n: number }>(sql`select count(*)::int as n from credit_balances b where not exists (select 1 from "user" u where u.id = b.user_id)`);
    expect(rows[0]!.n).toBe(0);
  }, 300_000);
});
