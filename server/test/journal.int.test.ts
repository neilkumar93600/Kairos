import { randomUUID } from "node:crypto";
import { eq, sum } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replay } from "../scripts/journal-replay";
import type { Db } from "../src/db/client";
import { applications, companies, creditLedger, jobs, stripeEvents } from "../src/db/schema";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// WP-13 acceptance: after a dump-only restore, journal replay brings the ledger to within 2 minutes of the failure,
// never twice, and a sent application is not re-opened. `live` is production; `restored` is the dump taken before.
process.env.DATABASE_URL = testDbUrl("journal_live");

describe.skipIf(!hasTestDb)("money journal and replay against Postgres", () => {
  let live: Db;
  let restored: Db;
  const ids = { user: randomUUID(), company: randomUUID(), job: randomUUID(), app: randomUUID(), grant: randomUUID() };

  /** The state both databases share: the dump. */
  async function seed(db: Db) {
    await seedUser(db, { id: ids.user });
    await db.insert(creditLedger).values({ id: ids.grant, userId: ids.user, delta: 5, reason: "free_grant" });
    await db.insert(companies).values({ id: ids.company, name: "Co", ats: "greenhouse", boardToken: "co-journal" });
    await db.insert(jobs).values({ id: ids.job, companyId: ids.company, externalId: "j1", title: "Engineer", descriptionText: "x", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" });
    await db.insert(applications).values({ id: ids.app, userId: ids.user, jobId: ids.job, status: "approved", channel: "cloud", approvedAt: new Date() });
  }

  beforeAll(async () => {
    [live, restored] = await Promise.all([testDb("journal_live"), testDb("journal_restored")]);
  });
  beforeEach(async () => {
    await Promise.all([resetDb(live), resetDb(restored)]);
    await Promise.all([seed(live), seed(restored)]);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  it("reads the three tables into lines the parser accepts, with microsecond times", async () => {
    const { parseJournal, readJournalRows } = await import("../src/jobs/money-journal");
    await live.insert(stripeEvents).values({ id: "evt_journal_1", type: "invoice.paid" });
    const lines = await readJournalRows(Date.now() - 60_000, Date.now() + 60_000);
    expect(lines.map((l) => l.t).sort()).toEqual(["ledger", "status", "stripe"]);
    expect(parseJournal(lines.map((l) => JSON.stringify(l)).join("\n"))).toEqual(lines);
    expect(lines.every((l) => /\.\d{6}Z$/.test(l.at))).toBe(true);
  });

  it("puts the sends after the dump back, once, and closes the application the restore re-opened", async () => {
    const { readJournalRows } = await import("../src/jobs/money-journal");
    const from = Date.now() - 1000;
    // After the dump: the cloud send went out and was charged; a Stripe event was processed; a new user was charged.
    await live.update(applications).set({ status: "submitted", submittedAt: new Date() }).where(eq(applications.id, ids.app));
    await live.insert(creditLedger).values({ userId: ids.user, delta: -1, reason: "submission", applicationId: ids.app });
    await live.insert(stripeEvents).values({ id: "evt_after_dump", type: "invoice.paid" });
    const newcomer = await seedUser(live, { credits: 3 });
    const lines = await readJournalRows(from, Date.now() + 1000);

    const client = new pg.Client({ connectionString: testDbUrl("journal_restored") });
    await client.connect();
    try {
      const dry = await replay(client, lines, false);
      expect(dry.ledger.inserted).toBe(1);
      expect(await statusIn(restored)).toBe("approved");

      const first = await replay(client, lines, true);
      expect(first.ledger).toMatchObject({ inserted: 1, skipped: [{ user: newcomer, why: "user not in the restore" }] });
      expect(first.applications.closed).toEqual([{ application: ids.app, from: "approved", to: "submitted" }]);
      expect(first.stripeEventsToResend).toEqual(["evt_after_dump"]);
      expect(await statusIn(restored)).toBe("submitted");
      expect(await balance(restored, ids.user)).toBe(await balance(live, ids.user));

      const second = await replay(client, lines, true);
      expect(second.ledger).toMatchObject({ inserted: 0, alreadyPresent: first.ledger.alreadyPresent + 1 });
      expect(second.applications.closed).toEqual([]);
      expect(await balance(restored, ids.user)).toBe(4);
    } finally {
      await client.end();
    }
  });

  const statusIn = async (db: Db) => (await db.select({ s: applications.status }).from(applications).where(eq(applications.id, ids.app)))[0]?.s;
  const balance = async (db: Db, userId: string) => Number((await db.select({ b: sum(creditLedger.delta) }).from(creditLedger).where(eq(creditLedger.userId, userId)))[0]?.b);
});
