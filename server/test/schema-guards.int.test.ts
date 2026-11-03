import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb } from "./helpers/test-db";

/**
 * The database backstops of WP-12 (02-database 9, 11.4; CISO should-fix "database backstops"), exercised directly in
 * SQL so they hold whatever the application code does. Skipped without TEST_DATABASE_URL.
 */

describe.skipIf(!hasTestDb)("database backstops", () => {
  let db: Db;
  beforeAll(async () => {
    db = await testDb("schema_guards");
  });
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await closeTestDbs();
  });

  /** The SQLSTATE a statement fails with; drizzle wraps the driver's error in `cause`. */
  const failure = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (err) {
      const e = err as { code?: string; cause?: { code?: string } };
      return e.cause?.code ?? e.code;
    }
    return "ok";
  };

  it("every foreign key is served by an index on its leading columns (11.4)", async () => {
    const { rows } = await db.execute(sql`
      SELECT c.conrelid::regclass::text AS table_name, c.conname AS foreign_key
        FROM pg_constraint c
       WHERE c.contype = 'f'
         AND c.connamespace = 'public'::regnamespace
         AND NOT EXISTS (
               SELECT 1 FROM pg_index i
                WHERE i.indrelid = c.conrelid
                  AND (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] = c.conkey)`);
    expect(rows).toEqual([]);
  });

  it("one free grant per user, one grant and one expiry per invoice", async () => {
    const userId = await seedUser(db, { credits: 25 });
    expect(await failure(() => db.insert(schema.creditLedger).values({ userId, delta: 25, reason: "free_grant" }))).toBe("23505");

    const invoice = `in_${randomUUID()}`;
    await db.insert(schema.creditLedger).values({ userId, delta: 100, reason: "plan_grant", stripeInvoiceId: invoice });
    expect(await failure(() => db.insert(schema.creditLedger).values({ userId, delta: 100, reason: "plan_grant", stripeInvoiceId: invoice }))).toBe(
      "23505",
    );
    expect(await failure(() => db.insert(schema.creditLedger).values({ userId, delta: -40, reason: "expiry", stripeInvoiceId: invoice }))).toBe("ok");
  });

  /** A company, a job and an application in `status` for `userId`. */
  async function application(userId: string, status: "draft" | "approved" = "draft") {
    const [company] = await db.insert(schema.companies).values({ name: "Acme", ats: "greenhouse", boardToken: `acme-${randomUUID().slice(0, 8)}` }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: "1", title: "Engineer", descriptionText: "x", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const approved = status === "approved" ? { channel: "cloud" as const, approvedAt: new Date() } : {};
    const [row] = await db.insert(schema.applications).values({ userId, jobId: job!.id, status, ...approved }).returning();
    return row!.id;
  }

  describe("credit_ledger is append-only (INV-13), the owner included", () => {
    it("refuses UPDATE and DELETE even to the table owner", async () => {
      const userId = await seedUser(db, { credits: 25 });
      expect(await failure(() => db.update(schema.creditLedger).set({ delta: 100 }).where(sql`true`))).toBe("42501");
      expect(await failure(() => db.delete(schema.creditLedger).where(sql`true`))).toBe("42501");
      expect(await db.select().from(schema.creditLedger).where(sql`${schema.creditLedger.userId} = ${userId}`)).toHaveLength(1);
    });

    it("lets the referential actions through: an application's deletion nulls its link, an account's deletion cascades", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const appId = await application(userId, "approved");
      await db.insert(schema.creditLedger).values({ userId, delta: -1, reason: "submission", applicationId: appId });
      await db.delete(schema.applications).where(sql`${schema.applications.id} = ${appId}`);
      const rows = await db.select().from(schema.creditLedger).where(sql`${schema.creditLedger.userId} = ${userId}`);
      expect(rows.map((r) => r.applicationId)).toEqual([null, null]);
      await db.delete(schema.user).where(sql`${schema.user.id} = ${userId}`);
      expect(await db.select().from(schema.creditLedger).where(sql`${schema.creditLedger.userId} = ${userId}`)).toEqual([]);
    });

    it.each([
      ["a submission of more than one credit", { delta: -2, reason: "submission" }],
      ["a plan grant without its invoice", { delta: 100, reason: "plan_grant" }],
      ["an expiry that adds credits", { delta: 5, reason: "expiry", stripeInvoiceId: "in_1" }],
      ["an adjustment without a note", { delta: 3, reason: "admin_adjustment" }],
      ["a note with an address in it", { delta: 3, reason: "admin_adjustment", note: "asked by a@b.co" }],
    ] as const)("refuses %s (credit_ledger checks)", async (_, row) => {
      const userId = await seedUser(db);
      expect(await failure(() => db.insert(schema.creditLedger).values({ userId, ...row }))).toBe("23514");
    });
  });

  describe("applications: status guard v1 and the approval shape (INV-3)", () => {
    const move = (id: string, set: Partial<typeof schema.applications.$inferInsert>) =>
      failure(() => db.update(schema.applications).set(set).where(sql`${schema.applications.id} = ${id}`));

    it("rejects an illegal transition in the database, whatever the code does", async () => {
      const userId = await seedUser(db);
      const draft = await application(userId);
      expect(await move(draft, { status: "submitted", channel: "cloud", approvedAt: new Date() })).toBe("23514");
      expect(await move(draft, { status: "submitting", channel: "cloud", approvedAt: new Date() })).toBe("23514");

      const approved = await application(userId, "approved");
      expect(await move(approved, { status: "submitting" })).toBe("ok");
      expect(await move(approved, { status: "approved" })).toBe("23514"); // only an extension claim is released
      expect(await move(approved, { status: "submitted", submittedAt: new Date() })).toBe("ok");
      expect(await move(approved, { status: "draft", channel: null, approvedAt: null })).toBe("23514"); // submitted is final
    });

    it("refuses a row past draft without an approval time and a channel", async () => {
      const userId = await seedUser(db);
      const draft = await application(userId);
      expect(await move(draft, { status: "approved", channel: "cloud" })).toBe("23514");
      expect(await move(draft, { status: "approved", channel: "cloud", approvedAt: new Date() })).toBe("ok");
    });
  });

  describe("facts_guard and kairos.actor (INV-2)", () => {
    /** One write as `actor` ('' is a worker: no actor); the test pool itself writes as 'ops'. */
    const as = (actor: string, run: (tx: Parameters<Parameters<Db["transaction"]>[0]>[0]) => Promise<unknown>) =>
      failure(() =>
        db.transaction(async (tx) => {
          await tx.execute(sql`select set_config('kairos.actor', ${actor}, true)`);
          await run(tx);
        }),
      );
    const factOf = async (id: string) => (await db.select().from(schema.facts).where(sql`${schema.facts.id} = ${id}`))[0]!;

    it("refuses a worker UPDATE that confirms a fact or edits its text, and lets the user do both", async () => {
      const userId = await seedUser(db);
      const [f] = await db.insert(schema.facts).values({ userId, kind: "skill", text: "Parsed skill" }).returning();
      const confirm = (tx: Parameters<Parameters<Db["transaction"]>[0]>[0]) =>
        tx.update(schema.facts).set({ confirmed: true }).where(sql`${schema.facts.id} = ${f!.id}`);
      expect(await as("", confirm)).toBe("23514");
      expect(await as("autopilot", confirm)).toBe("23514");
      expect(await as("", (tx) => tx.update(schema.facts).set({ text: "Invented" }).where(sql`${schema.facts.id} = ${f!.id}`))).toBe("23514");
      expect((await factOf(f!.id)).confirmed).toBe(false);

      expect(await as("user", confirm)).toBe("ok");
      expect(await factOf(f!.id)).toMatchObject({ confirmed: true, assertedBy: "import" });
      expect((await factOf(f!.id)).confirmedAt).toBeInstanceOf(Date);
      expect(await as("user", (tx) => tx.update(schema.facts).set({ text: "My words" }).where(sql`${schema.facts.id} = ${f!.id}`))).toBe("ok");
      expect((await factOf(f!.id)).assertedBy).toBe("user");
    });

    it("lets a worker insert only unconfirmed, imported facts; a user inserts only their own words", async () => {
      const userId = await seedUser(db);
      expect(await as("", (tx) => tx.insert(schema.facts).values({ userId, kind: "skill", text: "Parsed" }))).toBe("ok");
      expect(await as("", (tx) => tx.insert(schema.facts).values({ userId, kind: "skill", text: "Sneaky", confirmed: true }))).toBe("23514");
      expect(await as("user", (tx) => tx.insert(schema.facts).values({ userId, kind: "skill", text: "Mine", assertedBy: "import" }))).toBe("23514");
      expect(await as("user", (tx) => tx.insert(schema.facts).values({ userId, kind: "skill", text: "Mine", assertedBy: "user", confirmed: true }))).toBe("ok");
    });
  });

  it.each([
    ["jobs.source", sql`update jobs set source = 'scraped'`],
    ["contact_messages.topic", sql`insert into contact_messages (name, email, topic, message) values ('A', 'a@b.co', 'spam', 'hello there')`],
    ["subscriptions.status", sql`update subscriptions set status = 'bogus'`],
    ["subscriptions past_due without its anchor", sql`update subscriptions set status = 'past_due', past_due_since = null`],
    ["profiles.onboarding_step", sql`update profiles set onboarding_step = 'skipped'`],
  ])("names a CHECK on the closed set %s (database-98)", async (_, statement) => {
    const userId = await seedUser(db);
    await application(userId);
    await db.insert(schema.profiles).values({ userId, forwardingAddress: `${userId}@inbound.test` });
    expect(await failure(() => db.execute(statement))).toBe("23514");
  });
});
