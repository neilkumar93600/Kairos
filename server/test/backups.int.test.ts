import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { countRows, dumpedTables } from "../src/lib/backups";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// The manifest's row counts (WP-13): every permanent table whose data a dump holds, counted in one statement.

describe.skipIf(!hasTestDb)("backup manifest counts against Postgres", () => {
  let client: pg.Client;

  beforeAll(async () => {
    const db = await testDb("backups");
    await resetDb(db);
    await seedUser(db, { credits: 5 });
    await seedUser(db, { credits: 5 });
    client = new pg.Client({ connectionString: testDbUrl("backups") });
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
    await closeTestDbs();
  });

  it("lists the dumped tables: no unlogged table, no partition, no excluded data", async () => {
    const core = await dumpedTables(client, "core");
    expect(core).toEqual(expect.arrayContaining(["public.credit_ledger", "public.applications", "public.user", "drizzle.__drizzle_migrations"]));
    for (const t of ["public.jobs", "public.session", "public.verification", "public.llm_calls", "public.rate_limits", "public.auth_rate_limit"]) {
      expect(core).not.toContain(t);
    }
    expect(core.some((t) => t.startsWith("public.llm_calls_"))).toBe(false);
    expect(await dumpedTables(client, "full")).toContain("public.jobs");
  });

  it("counts them in one statement", async () => {
    expect(await countRows(client, ["public.user", "public.credit_ledger", "public.jobs"])).toEqual({ "public.user": 2, "public.credit_ledger": 2, "public.jobs": 0 });
  });
});
