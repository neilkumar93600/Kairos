import { eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { companies, jobs } from "../src/db/schema";
import { closeMissingJobs, dueCompanies } from "../src/jobs/poll-boards";
import { closeTestDbs, hasTestDb, resetDb, testDb } from "./helpers/test-db";

describe.skipIf(!hasTestDb)("closeMissingJobs against Postgres", () => {
  let db: Db;
  let companyId: string;

  beforeAll(async () => {
    db = await testDb("poll_boards");
  });
  beforeEach(async () => {
    await resetDb(db);
    const [company] = await db.insert(companies).values({ name: "Acme", ats: "greenhouse", boardToken: "acme" }).returning();
    companyId = company!.id;
    await db.insert(jobs).values(
      ["ext-a", "ext-b"].map((externalId) => ({ companyId, externalId, title: "Engineer", descriptionText: "Build", applyUrl: "https://job-boards.greenhouse.io/acme/jobs/1" })),
    );
  });
  afterAll(async () => {
    await closeTestDbs();
  });

  const openIds = async () =>
    (await db.select({ id: jobs.externalId }).from(jobs).where(isNull(jobs.closedAt))).map((r) => r.id).sort();

  it("an empty board response closes nothing", async () => {
    await expect(closeMissingJobs(db, companyId, [])).resolves.toBe(0);
    expect(await openIds()).toEqual(["ext-a", "ext-b"]);
  });

  it("closes only postings missing from a non-empty board", async () => {
    await expect(closeMissingJobs(db, companyId, ["ext-a"])).resolves.toBe(1);
    expect(await openIds()).toEqual(["ext-a"]);
    const [closed] = await db.select().from(jobs).where(eq(jobs.externalId, "ext-b"));
    expect(closed?.closedAt).toBeInstanceOf(Date);
  });

  // scale-v06: the 500-row cut used to be arbitrary, so under a backlog priority boards could starve.
  it("lists due boards priority first, then the longest unpolled (never polled first), inactive and fresh ones not at all", async () => {
    const ago = (min: number) => sql`now() - make_interval(mins => ${min})`;
    const add = async (name: string, values: { priority?: boolean; active?: boolean; lastPolledMinAgo?: number }) => {
      const [c] = await db
        .insert(companies)
        .values({ name, ats: "lever", boardToken: name, priority: values.priority ?? false, active: values.active ?? true, inactiveReason: values.active === false ? "owner" : null })
        .returning({ id: companies.id });
      if (values.lastPolledMinAgo !== undefined) await db.update(companies).set({ lastPolledAt: ago(values.lastPolledMinAgo) }).where(eq(companies.id, c!.id));
      return c!.id;
    };
    // beforeEach's "Acme" (greenhouse, never polled, standard) is due too.
    const staleStandard = await add("stale", { lastPolledMinAgo: 120 });
    const olderStandard = await add("older", { lastPolledMinAgo: 240 });
    await add("fresh", { lastPolledMinAgo: 10 });
    const duePriority = await add("hot", { priority: true, lastPolledMinAgo: 6 });
    await add("fresh-priority", { priority: true, lastPolledMinAgo: 2 });
    await add("off", { active: false });

    expect(await dueCompanies(db, 10)).toEqual([duePriority, companyId, olderStandard, staleStandard]);
    expect(await dueCompanies(db, 2)).toEqual([duePriority, companyId]);
  });
});
