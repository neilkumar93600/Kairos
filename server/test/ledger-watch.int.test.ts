import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// CISO mustFix 10: a credit_ledger admin_adjustment row is a manual (or hostile) write and must reach the owner.
process.env.DATABASE_URL = testDbUrl("ledger_watch");

describe.skipIf(!hasTestDb)("ledger watch against Postgres", () => {
  let db: Db;

  beforeAll(async () => {
    db = await testDb("ledger_watch");
  });
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  it("counts admin_adjustment rows from the last 16 minutes and nothing else", async () => {
    const { processLedgerWatch } = await import("../src/jobs/ledger-watch");
    const userId = await seedUser(db, { credits: 25 });
    expect(await processLedgerWatch()).toEqual({ rows: 0 });

    await db.insert(schema.creditLedger).values([
      { userId, delta: 100, reason: "admin_adjustment", note: "manual" },
      { userId, delta: 5, reason: "admin_adjustment", createdAt: new Date(Date.now() - 60 * 60_000) },
      { userId, delta: 10, reason: "plan_grant" },
    ]);
    expect(await processLedgerWatch()).toEqual({ rows: 1 });
  });
});
