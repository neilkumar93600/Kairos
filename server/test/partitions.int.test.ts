import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, testDb, testDbUrl } from "./helpers/test-db";

// database-88, llm-agents-v04, ops-50: the daily partitions schedule. Migration 0002 created partitions once, up to
// about 2026-12-14; without this job every later llm_calls row lands in llm_calls_default and nothing is ever dropped.
process.env.DATABASE_URL = testDbUrl("partitions");

const signal = vi.fn();
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const WEEK_MS = 7 * 86_400_000;

describe.skipIf(!hasTestDb)("llm_calls partition upkeep against Postgres", () => {
  let db: Db;
  let platform: typeof import("../src/db/schema/platform");
  let processPartitions: typeof import("../src/jobs/partitions").processPartitions;

  beforeAll(async () => {
    db = await testDb("partitions");
    platform = await import("../src/db/schema/platform");
    ({ processPartitions } = await import("../src/jobs/partitions"));
  });
  beforeEach(async () => {
    signal.mockReset();
    await resetDb(db);
    await processPartitions(); // a dropped partition from an earlier test comes back
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  const call = (createdAt: Date) => ({
    createdAt,
    agentId: "fit-scorer",
    promptVersion: 1,
    promptSha256: Buffer.alloc(32, 1),
    model: "claude-haiku-5-5",
    workspace: "batch",
    inputHash: Buffer.alloc(32, 3),
    status: "ok",
    costUsd: "0.001",
  });

  /** The partition a row dated `at` is stored in: a weekly name, or llm_calls_default. */
  async function insertCall(at: Date): Promise<string> {
    const [row] = await db.insert(platform.llmCalls).values(call(at)).returning({ part: sql<string>`tableoid::regclass::text` });
    return row!.part;
  }

  const partitions = async () =>
    (await db.select({ name: sql<string>`c.relname` }).from(sql`pg_inherits i join pg_class c on c.oid = i.inhrelid`).where(sql`i.inhparent = 'public.llm_calls'::regclass`))
      .map((r) => r.name)
      .sort();

  /** Name and bounds of the ISO week `weeks` after the current one (negative: before), from the database's clock. */
  async function week(weeks: number) {
    const [w] = await db
      .select({ name: sql<string>`'llm_calls_' || to_char(m, 'IYYY') || 'w' || to_char(m, 'IW')`, lo: sql<string>`m::text`, hi: sql<string>`(m + 7)::text` })
      .from(sql`(select date_trunc('week', now() at time zone 'UTC')::date + ${weeks * 7}::int as m) w`);
    return w!;
  }

  it("keeps a partition six weeks ahead, so a row dated then never lands in llm_calls_default", async () => {
    const last = await week(6);
    await db.execute(sql.raw(`drop table public.${last.name}`));
    expect(await insertCall(new Date(Date.now() + 6 * WEEK_MS))).toBe("llm_calls_default");
    await resetDb(db);

    await expect(processPartitions()).resolves.toMatchObject({ defaultRows: 0, created: 1, dropped: [] });
    expect(await insertCall(new Date(Date.now() + 6 * WEEK_MS))).toBe(last.name);
    await expect(processPartitions()).resolves.toMatchObject({ created: 0 }); // idempotent
    expect(signal).not.toHaveBeenCalled();
  });

  it("a row in llm_calls_default raises the signal; ensure then fails loudly on a week it must create", async () => {
    expect(await insertCall(new Date(Date.now() + 30 * WEEK_MS))).toBe("llm_calls_default");
    await expect(processPartitions()).resolves.toMatchObject({ defaultRows: 1, created: 0 });
    expect(signal).toHaveBeenCalledWith("llm_calls_default_rows", 1);

    signal.mockReset();
    const last = await week(6);
    await db.execute(sql.raw(`drop table public.${last.name}`));
    expect(await insertCall(new Date(Date.now() + 6 * WEEK_MS))).toBe("llm_calls_default");
    await expect(processPartitions()).rejects.toThrow();
    expect(signal).toHaveBeenCalledWith("llm_calls_default_rows", 2); // counted before ensure threw
  });

  it("drops a week older than 90 days after rolling it up, and keeps the younger weeks", async () => {
    const old = await week(-14);
    await db.execute(sql.raw(`create table public.${old.name} partition of public.llm_calls for values from ('${old.lo} 00:00:00+00') to ('${old.hi} 00:00:00+00')`));
    expect(await insertCall(new Date(`${old.lo}T12:00:00Z`))).toBe(old.name); // never rolled up by the minute schedule

    const result = await processPartitions();
    expect(result.dropped).toEqual([old.name]);
    expect(await partitions()).not.toContain(old.name);
    expect(await partitions()).toContain((await week(0)).name);
    // The roll-up kept the dropped rows' cost.
    const [day] = await db.select({ calls: platform.llmCostDaily.calls }).from(platform.llmCostDaily).where(sql`day = ${old.lo}::date`);
    expect(day?.calls).toBe(1);
  });

  it("two workers running it at once create each partition once and agree", async () => {
    const last = await week(6);
    await db.execute(sql.raw(`drop table public.${last.name}`));
    const results = await Promise.all([processPartitions(), processPartitions()]);
    expect(results.map((r) => r.created).sort()).toEqual([0, 1]);
    expect(await partitions()).toContain(last.name);
  });
});
