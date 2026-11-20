import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedCompanies, type SeedRow } from "../scripts/seed-companies";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { closeTestDbs, hasTestDb, resetDb, testDb } from "./helpers/test-db";

/** The seed against Postgres (database-v10): idempotent, and an activation it makes is audited like the admin route's. */

const row = (boardToken: string, over: Partial<SeedRow> = {}): SeedRow => ({ ats: "greenhouse", boardToken, name: boardToken, region: "us", careersUrl: null, domains: [], priority: false, ...over });

describe.skipIf(!hasTestDb)("seedCompanies against Postgres", () => {
  let db: Db;

  beforeAll(async () => {
    db = await testDb("seed_companies");
  });
  beforeEach(async () => resetDb(db));
  afterAll(closeTestDbs);

  const company = async (boardToken: string) => (await db.select().from(schema.companies).where(eq(schema.companies.boardToken, boardToken)))[0]!;

  it("inserts active seed companies, with first polls spread, and writes no audit row", async () => {
    const before = Date.now();
    expect(await seedCompanies(db, [row("a"), row("b", { ats: "lever", region: "eu", domains: ["b.example"] })], () => 1)).toBe(2);
    expect(await company("a")).toMatchObject({ active: true, discoveredBy: "seed", inactiveReason: null });
    expect(await company("b")).toMatchObject({ apiRegion: "eu", apiHost: "api.eu.lever.co", domains: ["b.example"] });
    expect((await company("a")).nextPollAt.getTime()).toBeGreaterThan(before + 29 * 60_000);
    expect(await db.select().from(schema.opsAudit)).toEqual([]);
  });

  it("activates a board waiting as import_pending, audited as system:seed, and forgets its ETag", async () => {
    await db.insert(schema.companies).values({ name: "Pasted", ats: "greenhouse", boardToken: "pasted", active: false, inactiveReason: "import_pending", discoveredBy: "import", etag: 'W/"close-only"' });
    await db.insert(schema.companies).values({ name: "Other", ats: "greenhouse", boardToken: "not-on-the-list", active: false, inactiveReason: "import_pending", discoveredBy: "import" });
    await seedCompanies(db, [row("pasted")]);
    const c = await company("pasted");
    expect(c).toMatchObject({ active: true, inactiveReason: null, discoveredBy: "seed", etag: null });
    expect(await db.select().from(schema.opsAudit)).toMatchObject([
      { actor: "system:seed", action: "company_activate", target: `company:${c.id}`, before: { active: false, inactiveReason: "import_pending" }, after: { active: true, inactiveReason: null } },
    ]);
    expect(await company("not-on-the-list")).toMatchObject({ active: false, inactiveReason: "import_pending" });
  });

  it("leaves a company the owner stopped, or that 404'd, inactive, and a rerun changes nothing twice", async () => {
    await db.insert(schema.companies).values({ name: "Stopped", ats: "greenhouse", boardToken: "stopped", active: false, inactiveReason: "owner" });
    await db.insert(schema.companies).values({ name: "Gone", ats: "greenhouse", boardToken: "gone", active: false, inactiveReason: "board_not_found" });
    await db.insert(schema.companies).values({ name: "Pasted", ats: "greenhouse", boardToken: "pasted", active: false, inactiveReason: "import_pending", discoveredBy: "import" });
    const rows = [row("stopped"), row("gone"), row("pasted")];
    await seedCompanies(db, rows);
    await seedCompanies(db, rows);
    expect(await company("stopped")).toMatchObject({ active: false, inactiveReason: "owner" });
    expect(await company("gone")).toMatchObject({ active: false, inactiveReason: "board_not_found" });
    expect(await db.select().from(schema.opsAudit)).toHaveLength(1);
  });

  it("writes nothing when any row fails", async () => {
    await db.insert(schema.companies).values({ name: "Pasted", ats: "greenhouse", boardToken: "pasted", active: false, inactiveReason: "import_pending", discoveredBy: "import" });
    // A name companies_name_ck refuses, past the file's own validation.
    await expect(seedCompanies(db, [row("pasted"), row(randomUUID(), { name: "x".repeat(201) })])).rejects.toThrow();
    expect(await company("pasted")).toMatchObject({ active: false, inactiveReason: "import_pending" });
    expect(await db.select().from(schema.opsAudit)).toEqual([]);
  });
});
