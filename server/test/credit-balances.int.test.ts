import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * The balance cache against Postgres (billing-38, database-79): the triggers, the migration's backfill, the reads, the recount
 * that finds a wrong row, and /api/me on a 40,000-row ledger. Written without a local Postgres: it skips here and runs in CI, so
 * none of it has run. The fixtures run as actor `ops`, which no trigger here reads; what a real role may do is in
 * applier-role.int.test.ts, the one file that provisions roles.
 */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("credit_balances");
const signal = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const { createApp } = await import("../src/app");
const { closeDb, db: appDb } = await import("../src/db/client");
const { readMigrations, runMigrations } = await import("../src/db/migrator");
const schema = await import("../src/db/schema");
const { effectivePlan } = await import("../src/services/billing-events");
const { adjustCredits, applyInvoiceGrant, grantNote, lockCreditBalance, readCredits } = await import("../src/services/credits");
const { eraseUser } = await import("../src/services/erasure");
const { processInvariantsNightly } = await import("../src/jobs/invariants");
const { getFlags, resetFlagCache, setFlag } = await import("../src/lib/flags");

describe.skipIf(!hasTestDb)("credit_balances against Postgres", () => {
  let tdb: Awaited<ReturnType<typeof testDb>>;
  let me: SessionUser;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    tdb = await testDb("credit_balances");
    app = createApp({
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user: me, sessionId: "s", createdAt: new Date() }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });
  beforeEach(async () => {
    await resetDb(tdb);
    resetFlagCache();
    signal.mockClear();
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  async function application(userId: string, status: "draft" | "approved" | "submitting" = "draft", key = String(Math.random())) {
    const [company] = await tdb.insert(schema.companies).values({ name: `Co ${key}`, ats: "greenhouse", boardToken: `co-${key}` }).returning();
    const [job] = await tdb.insert(schema.jobs).values({ companyId: company!.id, externalId: key, title: "Engineer", descriptionText: "d", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" }).returning();
    const [row] = await tdb
      .insert(schema.applications)
      .values({ userId, jobId: job!.id, status, channel: status === "draft" ? null : "extension", approvedAt: status === "draft" ? null : new Date() })
      .returning({ id: schema.applications.id });
    return row!.id;
  }
  const cache = async (userId: string) => (await tdb.select().from(schema.creditBalances).where(eq(schema.creditBalances.userId, userId)))[0];
  const setStatus = (id: string, status: "approved" | "submitted" | "failed" | "withdrawn" | "draft", extra: Partial<typeof schema.applications.$inferInsert> = {}) =>
    tdb.update(schema.applications).set({ status, ...extra }).where(eq(schema.applications.id, id));

  it("balance follows the ledger: every kind of row, and a first row creates the cache row", async () => {
    const userId = await seedUser(tdb);
    expect(await cache(userId)).toBeUndefined();
    await expect(readCredits(tdb, userId)).resolves.toEqual({ balance: 0, inFlight: 0, available: 0 });
    await tdb.insert(schema.creditLedger).values({ userId, delta: 25, reason: "free_grant" });
    expect(await cache(userId)).toMatchObject({ balance: 25, inFlight: 0 });
    await tdb.insert(schema.creditLedger).values({ userId, delta: 1000, reason: "plan_grant", stripeInvoiceId: "in_1" });
    await tdb.insert(schema.creditLedger).values({ userId, delta: -5, reason: "expiry", stripeInvoiceId: "in_1", note: "rollover" });
    await tdb.insert(schema.creditLedger).values({ userId, delta: 2, reason: "admin_adjustment", note: "goodwill" });
    expect(await cache(userId)).toMatchObject({ balance: 1022 });
    await expect(readCredits(tdb, userId)).resolves.toEqual({ balance: 1022, inFlight: 0, available: 1022 });
  });

  it("a no-op insert changes nothing: a duplicate charge or grant is not counted", async () => {
    const userId = await seedUser(tdb, { credits: 5 });
    await tdb.transaction((tx) => applyInvoiceGrant(tx, { userId, delta: 100, stripeInvoiceId: "in_dup", note: "plan=pro interval=week", at: new Date() }));
    await tdb.transaction((tx) => applyInvoiceGrant(tx, { userId, delta: 100, stripeInvoiceId: "in_dup", note: "plan=pro interval=week", at: new Date() }));
    expect(await cache(userId)).toMatchObject({ balance: 105 });
  });

  it("in_flight follows the status across the boundary, and only across it", async () => {
    const userId = await seedUser(tdb, { credits: 5 });
    const a = await application(userId);
    expect(await cache(userId)).toMatchObject({ inFlight: 0 });
    await setStatus(a, "approved", { channel: "extension", approvedAt: new Date() });
    expect(await cache(userId)).toMatchObject({ inFlight: 1 });
    await tdb.update(schema.applications).set({ status: "submitting" }).where(eq(schema.applications.id, a));
    expect(await cache(userId)).toMatchObject({ inFlight: 1 });
    await tdb.update(schema.applications).set({ status: "approved" }).where(eq(schema.applications.id, a));
    expect(await cache(userId)).toMatchObject({ inFlight: 1 });
    await setStatus(a, "failed", { failureCode: "extension_reported" });
    expect(await cache(userId)).toMatchObject({ inFlight: 0 });
    await setStatus(a, "approved", { failureCode: null });
    expect(await cache(userId)).toMatchObject({ inFlight: 1 });
    await setStatus(a, "submitted", { submittedAt: new Date() });
    expect(await cache(userId)).toMatchObject({ inFlight: 0 });

    const b = await application(userId, "approved");
    expect(await cache(userId)).toMatchObject({ inFlight: 1 });
    await setStatus(b, "withdrawn");
    expect(await cache(userId)).toMatchObject({ inFlight: 0 });

    const c = await application(userId, "approved");
    await setStatus(c, "draft", { channel: null, approvedAt: null });
    expect(await cache(userId)).toMatchObject({ inFlight: 0 });
  });

  it("an approved row deleted outside an erasure gives its reservation back", async () => {
    const userId = await seedUser(tdb, { credits: 5 });
    const a = await application(userId, "approved");
    await tdb.delete(schema.applications).where(eq(schema.applications.id, a));
    expect(await cache(userId)).toMatchObject({ inFlight: 0 });
  });

  it("an in-flight application created for a user with no row yet makes one", async () => {
    const userId = await seedUser(tdb);
    await application(userId, "approved");
    expect(await cache(userId)).toMatchObject({ balance: 0, inFlight: 1 });
  });

  it("erasing a user with an in-flight application and a balance removes the row and does not fail its foreign key", async () => {
    const userId = await seedUser(tdb, { credits: 5 });
    await application(userId, "approved");
    await application(userId, "submitting");
    await tdb.insert(schema.stripeEvents).values({ id: "evt_unresolved", type: "invoice.paid", status: "received", processedAt: null, stripeCustomerId: "cus_erase", payload: { kind: "invoice", userId } });
    await tdb.insert(schema.stripeEvents).values({ id: "evt_done", type: "invoice.paid", status: "processed", userId, stripeCustomerId: "cus_erase", outcome: "grant_applied" });
    await tdb.update(schema.subscriptions).set({ stripeCustomerId: "cus_erase" }).where(eq(schema.subscriptions.userId, userId));
    await expect(eraseUser(tdb, userId, "operator")).resolves.toBeTruthy();
    expect(await cache(userId)).toBeUndefined();
    // A row tied to the user cascades. One not yet tied keeps neither id, and nothing will process it.
    const rows = await tdb.select().from(schema.stripeEvents);
    expect(rows.map((r) => r.id)).toEqual(["evt_unresolved"]);
    expect(rows[0]).toMatchObject({ status: "ignored", outcome: "user_deleted", payload: null, stripeCustomerId: null });
    expect(rows[0]!.processedAt).toBeInstanceOf(Date);
  });

  it("the lock returns the row, and creates it when missing", async () => {
    const userId = await seedUser(tdb);
    await expect(tdb.transaction((tx) => lockCreditBalance(tx, userId))).resolves.toEqual({ balance: 0, inFlight: 0 });
    expect(await cache(userId)).toMatchObject({ balance: 0, inFlight: 0 });
  });

  it("the rollover keeps what approved applications hold (the worked example of _db/billing.md 4.2)", async () => {
    const userId = await seedUser(tdb, { credits: 2500 });
    for (let i = 0; i < 20; i++) await application(userId, "approved", `held-${i}`);
    expect(await cache(userId)).toMatchObject({ balance: 2500, inFlight: 20 });
    await tdb.transaction((tx) => applyInvoiceGrant(tx, { userId, delta: 1000, stripeInvoiceId: "in_roll", note: "plan=starter interval=month", at: new Date() }));
    expect(await cache(userId)).toMatchObject({ balance: 2020, inFlight: 20 });
    const expiry = await tdb.select().from(schema.creditLedger).where(eq(schema.creditLedger.reason, "expiry"));
    expect(expiry.map((r) => [r.delta, r.note, r.stripeInvoiceId])).toEqual([[-1480, "rollover cap 2x grant=1000", "in_roll"]]);
  });

  it("the cap is taken at the invoice's paid moment, from the notes, never the clock (WP-32 G3 option B)", async () => {
    // Every moment is years in the past: a cap read from now() would see the quarter as over and expire 2,600 at the first month.
    const userId = await seedUser(tdb);
    const day = (d: string) => new Date(`${d}T00:00:00Z`);
    const grant = (id: string, delta: number, plan: string, interval: string, paid: string, until: string) =>
      tdb.transaction((tx) => applyInvoiceGrant(tx, { userId, delta, stripeInvoiceId: id, note: grantNote(plan, interval, day(until)), at: day(paid) }));
    const expiries = async () =>
      (await tdb.select().from(schema.creditLedger).where(eq(schema.creditLedger.reason, "expiry"))).map((r) => [r.stripeInvoiceId, r.delta, r.note]).sort();

    await grant("in_q", 3600, "pro", "quarter", "2020-01-01", "2020-04-01");
    // A move to Starter monthly, paid mid-quarter: the quarter is still paid for, so its cap holds. 3,600 + 1,000 is under 7,200.
    await grant("in_m1", 1000, "starter", "month", "2020-02-01", "2020-03-01");
    expect(await expiries()).toEqual([]);
    // Another month inside the quarter: 4,600 + 1,000 is 5,600, still under 2 x 3,600.
    await grant("in_m2", 1000, "starter", "month", "2020-03-01", "2020-04-01");
    expect(await expiries()).toEqual([]);
    // The quarter has ended: Starter's own cap, 2,000. 5,600 + 1,000 - 2,000 = 4,600 expire.
    await grant("in_m3", 1000, "starter", "month", "2020-04-01", "2020-05-01");
    expect(await expiries()).toEqual([["in_m3", -4600, "rollover cap 2x grant=1000"]]);
    expect(await cache(userId)).toMatchObject({ balance: 2000 });

    // A redrive of the first renewal much later writes nothing new: one grant and one expiry per invoice.
    await grant("in_m1", 1000, "starter", "month", "2020-02-01", "2020-03-01");
    expect(await cache(userId)).toMatchObject({ balance: 2000 });
  });

  it("the same grants on a second user give the same ledger, whenever they run", async () => {
    const run = async () => {
      const userId = await seedUser(tdb);
      for (const [id, delta, paid, until] of [["in_a", 3600, "2021-01-01", "2021-04-01"], ["in_b", 1000, "2021-03-15", "2021-04-15"], ["in_c", 1000, "2021-04-15", "2021-05-15"]] as const) {
        await tdb.transaction((tx) => applyInvoiceGrant(tx, { userId, delta, stripeInvoiceId: `${id}_${userId}`, note: grantNote("pro", "month", new Date(`${until}T00:00:00Z`)), at: new Date(`${paid}T00:00:00Z`) }));
      }
      const rows = await tdb.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId));
      return rows.map((r) => [r.reason, r.delta, r.stripeInvoiceId?.replace(`_${userId}`, ""), r.note]).sort();
    };
    const first = await run();
    expect(first).toContainEqual(["expiry", -3600, "in_c", "rollover cap 2x grant=1000"]);
    expect(await run()).toEqual(first);
  });

  describe("LEDGER-2, the recount", () => {
    const corrupt = (userId: string, set: string) => tdb.execute(sql.raw(`update credit_balances set ${set} where user_id = '${userId}'`));
    const ledger2 = async () => (await processInvariantsNightly()).find((v) => v.id === "LEDGER-2");

    it("is clean on healthy rows, and with work in flight", async () => {
      const userId = await seedUser(tdb, { credits: 5 });
      await application(userId, "approved");
      await seedUser(tdb);
      expect(await ledger2()).toBeUndefined();
    });

    it.each([
      ["a wrong balance", "balance = balance + 1"],
      ["a wrong in_flight", "in_flight = in_flight + 1"],
    ])("finds %s, and freezes approvals", async (_what, set) => {
      const userId = await seedUser(tdb, { credits: 5 });
      await corrupt(userId, set);
      expect(await ledger2()).toMatchObject({ n: 1, freezes: true });
      resetFlagCache();
      expect((await getFlags(tdb)).approvalsFrozen).toBe(true);
      expect(signal).toHaveBeenCalledWith("invariant_breach", expect.any(Number));
      await setFlag("approvals_frozen", false, "test");
    });

    it("finds a row that went missing while the ledger holds credits", async () => {
      const userId = await seedUser(tdb, { credits: 5 });
      await tdb.delete(schema.creditBalances).where(eq(schema.creditBalances.userId, userId));
      expect(await ledger2()).toMatchObject({ n: 1 });
      await setFlag("approvals_frozen", false, "test");
    });

    it("finds a user with a balance and an in-flight count both wrong as one, and a correction by a new row does not hide it", async () => {
      const userId = await seedUser(tdb, { credits: 5 });
      await corrupt(userId, "balance = 0, in_flight = 9");
      await tdb.transaction((tx) => adjustCredits(tx, { userId, delta: 5, note: "does not repair" }));
      expect(await ledger2()).toMatchObject({ n: 1 });
      await setFlag("approvals_frozen", false, "test");
    });
  });

  it("effective_plan in SQL gives what effectivePlan gives (T-9, the vectors of billing-events.test.ts)", async () => {
    const now = Date.now();
    const vectors: [string, number | null][] = [["active", null], ["trialing", null], ["past_due", 0], ["past_due", 6], ["past_due", 8], ["past_due", null], ["unpaid", null], ["canceled", null], ["incomplete", null], ["incomplete_expired", null], ["paused", null]];
    for (const [status, days] of vectors) {
      const pastDueSince = days === null ? null : new Date(now - days * 86_400_000);
      const { rows } = await tdb.execute<{ plan: string }>(sql`select effective_plan('pro'::plan_id, ${status}, ${pastDueSince?.toISOString() ?? null}::timestamptz)::text as plan`);
      expect(rows[0]!.plan, `${status}, ${days}`).toBe(effectivePlan({ plan: "pro", status, pastDueSince }));
    }
  });

  it("/api/me and /api/credits answer from the cache, /api/credits is a keyset, and a crafted cursor is 400", async () => {
    const userId = await seedUser(tdb);
    me = { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true };
    await tdb.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test` });
    // One transaction, one created_at: the page edge falls inside a tie, and the id breaks it.
    await tdb.transaction(async (tx) => {
      await tx.insert(schema.creditLedger).values({ userId, delta: 25, reason: "free_grant" });
      for (let i = 0; i < 4; i++) await tx.insert(schema.creditLedger).values({ userId, delta: 1, reason: "admin_adjustment", note: `row ${i}` });
    });
    await application(userId, "approved");

    const mine = await request(app).get("/api/me");
    expect(mine.status).toBe(200);
    expect(mine.body.credits).toEqual({ balance: 29, inFlight: 1, available: 28 });

    const all = await request(app).get("/api/credits");
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ balance: 29, inFlight: 1, available: 28 });
    expect(all.body.entries).toHaveLength(5);
    expect(all.body.nextCursor).toBeUndefined();

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await request(app).get("/api/credits").query({ limit: 2, ...(cursor ? { cursor } : {}) });
      expect(page.status).toBe(200);
      seen.push(...(page.body.entries as { id: string }[]).map((e) => e.id));
      cursor = page.body.nextCursor;
    } while (cursor);
    expect(seen).toEqual((all.body.entries as { id: string }[]).map((e) => e.id));
    expect(new Set(seen).size).toBe(5);

    const crafted = await request(app).get("/api/credits").query({ cursor: Buffer.from(JSON.stringify({ v: 1, t: "credits", k: ["not a time"], id: "x" })).toString("base64url") });
    expect(crafted.status).toBe(400);
    expect(crafted.body.error?.code ?? crafted.body.code).toBe("invalid_param");
  });

  it("/api/me stays under 300 ms at p95 for a user with a 40,000-row ledger", async () => {
    const userId = await seedUser(tdb, { credits: 5 });
    me = { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true };
    await tdb.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test` });
    await tdb.execute(sql`insert into credit_ledger (user_id, delta, reason, note) select ${userId}::text, 1, 'admin_adjustment'::credit_reason, 'load ' || g from generate_series(1, 40000) g`);
    await tdb.execute(sql`analyze credit_ledger`);
    expect(await cache(userId)).toMatchObject({ balance: 40005 });
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t = performance.now();
      const res = await request(app).get("/api/me");
      times.push(performance.now() - t);
      expect(res.status).toBe(200);
      expect(res.body.credits.balance).toBe(40005);
    }
    const p95 = times.sort((a, b) => a - b)[94]!;
    console.log(`/api/me over a 40,000-row ledger: p95 ${p95.toFixed(1)} ms, median ${times[49]!.toFixed(1)} ms`);
    expect(p95).toBeLessThan(300);
  }, 120_000);

  it("the migration's backfill: rows that existed before it get the balance and in-flight of their recount, and later writes add to them", async () => {
    // A database of its own, stopped at the migration before: this is the one moment the cache is computed rather than kept.
    const url = testDbUrl("credit_balances_backfill");
    const name = new URL(url).pathname.slice(1);
    const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.connect();
    await admin.query(`drop database if exists "${name}"`);
    await admin.query(`create database "${name}"`);
    await admin.end();
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const all = readMigrations(fileURLToPath(new URL("../drizzle", import.meta.url)));
      const at = all.findIndex((m) => m.tag.endsWith("_wp32_billing"));
      expect(at).toBeGreaterThan(0);
      await runMigrations(client, all.slice(0, at));
      // Plain SQL with named columns: the schema module moves on, and these rows must fit the tables as they stood.
      await client.query(`insert into "user" (id, name, email, email_verified) values ('rich', 'R', 'r@test.local', true), ('empty', 'E', 'e@test.local', true)`);
      const company = (await client.query(`insert into companies (name, ats, board_token) values ('Co', 'greenhouse', 'backfill') returning id`)).rows[0].id as string;
      await client.query(`insert into credit_ledger (user_id, delta, reason) values ('rich', 40, 'free_grant')`);
      await client.query(`insert into credit_ledger (user_id, delta, reason, note) values ('rich', -1, 'admin_adjustment', 'before')`);
      for (const [key, status] of [["a", "approved"], ["b", "submitting"], ["c", "draft"], ["d", "failed"]] as const) {
        const job = (await client.query(`insert into jobs (company_id, external_id, title, description_text, apply_url) values ($1, $2, 'E', 'd', 'https://job-boards.greenhouse.io/x/jobs/1') returning id`, [company, key])).rows[0].id as string;
        await client.query(`insert into applications (user_id, job_id, status, channel, approved_at) values ('rich', $1, $2::application_status, $3::submit_channel, $4)`, [job, status, status === "draft" ? null : "extension", status === "draft" ? null : new Date()]);
      }
      await client.query(`insert into stripe_events (id, type) values ('evt_old', 'invoice.paid')`);
      const before = (await client.query(`select processed_at from stripe_events`)).rows[0].processed_at as Date;

      await runMigrations(client, all);
      const rows = (await client.query(`select user_id, balance, in_flight from credit_balances order by user_id`)).rows;
      expect(rows).toEqual([{ user_id: "empty", balance: 0, in_flight: 0 }, { user_id: "rich", balance: 39, in_flight: 2 }]);
      // The previous release's rows read as finished, with their real day, and its insert still passes every check.
      const event = (await client.query(`select status, outcome, received_at from stripe_events`)).rows[0];
      expect(event).toMatchObject({ status: "processed", outcome: null });
      expect((event.received_at as Date).getTime()).toBe(before.getTime());
      await client.query(`insert into stripe_events (id, type) values ('evt_previous_release', 'invoice.paid')`);
      await client.query(`insert into credit_ledger (user_id, delta, reason, note) values ('rich', 1, 'admin_adjustment', 'after')`);
      expect((await client.query(`select balance from credit_balances where user_id = 'rich'`)).rows[0].balance).toBe(40);
    } finally {
      await client.end();
    }
  }, 120_000);
});
