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
});
