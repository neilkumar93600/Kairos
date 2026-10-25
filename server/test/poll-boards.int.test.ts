import { eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { companies, jobs } from "../src/db/schema";
import { closeMissingJobs } from "../src/jobs/poll-boards";
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
});
