import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { PRIVACY_REGISTRY } from "../src/services/privacy-registry";
import { closeTestDbs, hasTestDb, testDb } from "./helpers/test-db";

// The privacy registry against the migrated catalog (WP-25): it also sees tables created only in SQL (llm_calls,
// user_daily_usage) and any table another package adds by hand, which the Drizzle-side test cannot.
describe.skipIf(!hasTestDb)("privacy registry against the catalog", () => {
  let db: Db;
  beforeAll(async () => {
    db = await testDb("privacy_registry");
  });
  afterAll(closeTestDbs);

  const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];

  it("has an entry for every table with a user_id column or a foreign key to the user", async () => {
    const owning = await rows<{ t: string }>(sql`
      select c.relname as t from pg_class c
       where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relispartition
         and (exists (select from pg_attribute a where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped)
           or exists (select from pg_constraint k where k.conrelid = c.oid and k.contype = 'f' and k.confrelid = '"user"'::regclass))`);
    const registered = new Set(PRIVACY_REGISTRY.map((e) => e.table));
    expect(owning.map((r) => r.t).filter((t) => !registered.has(t))).toEqual([]);
  });

  it("every registered table exists, and each cascade or archive entry cascades from the user row", async () => {
    const present = new Set((await rows<{ t: string }>(sql`select relname as t from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')`)).map((r) => r.t));
    expect(PRIVACY_REGISTRY.filter((e) => !present.has(e.table)).map((e) => e.table)).toEqual([]);
    const cascading = new Set(
      (await rows<{ t: string }>(sql`select conrelid::regclass::text as t from pg_constraint where contype = 'f' and confrelid = '"user"'::regclass and confdeltype = 'c'`)).map((r) =>
        r.t.replaceAll('"', ""),
      ),
    );
    const direct = PRIVACY_REGISTRY.filter((e) => !e.parent && (e.erase === "cascade" || e.erase === "archive")).map((e) => e.table);
    expect(direct.filter((t) => !cascading.has(t))).toEqual([]);
  });
});
