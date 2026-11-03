import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// Retention rules and the sensitive-answer scrub (WP-25) against Postgres. "Scrubbed rows hold no EEO values."
process.env.DATABASE_URL = testDbUrl("retention");

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

describe.skipIf(!hasTestDb)("retention against Postgres (WP-25)", () => {
  let db: Db;
  let retention: typeof import("../src/jobs/retention");
  beforeAll(async () => {
    db = await testDb("retention");
    retention = await import("../src/jobs/retention");
  });
  beforeEach(() => resetDb(db));
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  async function job(closedDaysAgo: number | null) {
    const [co] = await db.insert(schema.companies).values({ name: "Co", ats: "greenhouse", boardToken: randomUUID() }).returning();
    const [j] = await db
      .insert(schema.jobs)
      .values({ companyId: co!.id, externalId: randomUUID(), title: "E", descriptionText: "desc", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1", raw: { a: 1 }, closedAt: closedDaysAgo === null ? null : ago(closedDaysAgo) })
      .returning();
    return j!.id;
  }

  it("purges old reply bodies and contact messages, and closed jobs by whether an application points at them", async () => {
    const userId = await seedUser(db);
    for (const [days, body] of [[200, "old"], [10, "new"]] as const) {
      await db.insert(schema.inboundEmails).values({ userId, providerMessageId: randomUUID(), sender: "a@b.c", subject: "s", textBody: body, receivedAt: ago(days) });
      await db.insert(schema.contactMessages).values({ name: "n", email: "x@y.z", topic: "support", message: body, createdAt: ago(days * 2) });
    }
    const [unreferenced, referenced, recent] = [await job(200), await job(200), await job(10)];
    await db.insert(schema.applications).values({ userId, jobId: referenced });

    expect(await retention.processRetention()).toEqual({ inbound_body: 1, contact_messages: 1, matches_below_bar: 0, jobs_closed: 2 });
    expect((await db.select().from(schema.inboundEmails)).map((r) => r.textBody).sort()).toEqual(["", "new"]);
    expect((await db.select().from(schema.contactMessages)).map((r) => r.message)).toEqual(["new"]);
    const jobs = await db.select().from(schema.jobs);
    expect(jobs.map((j) => j.id).sort()).toEqual([referenced, recent].sort());
    expect(jobs.find((j) => j.id === referenced)).toMatchObject({ descriptionText: "", raw: null });
    // A second run changes nothing.
    expect(await retention.processRetention()).toEqual({ inbound_body: 0, contact_messages: 0, matches_below_bar: 0, jobs_closed: 0 });
  });

  it("blanks sensitive values 7 days after submitted or withdrawn, once, and leaves the rest", async () => {
    const userId = await seedUser(db);
    const answers = [
      { fieldKey: "g", label: "Gender", value: "Female", source: "saved_answer" as const },
      { fieldKey: "w", label: "Why us?", value: "Mission", source: "generated" as const },
    ];
    const receipt = { filledFields: answers.map(({ fieldKey, label, value }) => ({ fieldKey, label, value })), channel: "extension" as const };
    const sent = { status: "submitted" as const, channel: "extension" as const, approvedAt: ago(9), answers, receipt };
    const [old] = await db.insert(schema.applications).values({ userId, jobId: await job(null), ...sent, submittedAt: ago(8) }).returning();
    const [fresh] = await db.insert(schema.applications).values({ userId, jobId: await job(null), ...sent, submittedAt: ago(2) }).returning();
    const [draft] = await db.insert(schema.applications).values({ userId, jobId: await job(null), answers, updatedAt: ago(30) }).returning();

    expect(await retention.processScrubApplications()).toEqual({ scrubbed: 1 });
    const row = async (id: string) => (await db.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;
    const scrubbed = await row(old!.id);
    expect(scrubbed.answers.map((a) => a.value)).toEqual(["", "Mission"]);
    expect(scrubbed.receipt?.filledFields.map((f) => f.value)).toEqual(["", "Mission"]);
    expect(scrubbed.contentScrubbedAt).not.toBeNull();
    expect(JSON.stringify(scrubbed)).not.toContain("Female");
    expect((await row(fresh!.id)).answers[0]!.value).toBe("Female");
    expect((await row(draft!.id)).answers[0]!.value).toBe("Female");
    expect(await retention.processScrubApplications()).toEqual({ scrubbed: 0 });
    const n = await db.execute<{ n: number }>(sql`select count(*)::int as n from applications where content_scrubbed_at is not null`);
    expect(n.rows[0]!.n).toBe(1);
  });
});
