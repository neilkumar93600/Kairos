import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { applications, companies, creditLedger, jobs } from "../src/db/schema";
import { recordExtensionReport } from "../src/services/settle";
import { approveApplications } from "../src/services/submissions";
import { settleAll } from "./helpers/settle";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb } from "./helpers/test-db";

const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: [] };
const ANSWER = { fieldKey: "first_name", label: "First name", value: "Test", source: "profile" as const };

describe.skipIf(!hasTestDb)("submissions against Postgres", () => {
  let db: Db;

  beforeAll(async () => {
    db = await testDb("submissions");
  });
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    await closeTestDbs();
  });

  async function draft(
    userId: string,
    externalId: string,
    opts: { tailored?: boolean; answers?: boolean; status?: "draft" | "approved" | "withdrawn"; channel?: "cloud" | "extension" } = {},
  ) {
    const [company] = await db.insert(companies).values({ name: `Co ${externalId}`, ats: "greenhouse", boardToken: `co-${externalId}` }).returning();
    const [job] = await db
      .insert(jobs)
      .values({ companyId: company!.id, externalId, title: "Engineer", descriptionText: "Build things", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [app] = await db
      .insert(applications)
      .values({
        userId,
        jobId: job!.id,
        resumeLines: opts.tailored === false ? [] : [LINE],
        answers: opts.tailored === false || opts.answers === false ? [] : [ANSWER],
        status: opts.status ?? "draft",
        channel: opts.channel ?? null,
        approvedAt: opts.status && opts.status !== "draft" ? new Date() : null,
      })
      .returning();
    return app!.id;
  }

  /** The applier's claim, as its definer function; the attempt's id, or null when there is nothing to send. */
  const claim = async (id: string, attemptNo = 0) => (await db.execute<{ id: string | null }>(sql`select claim_cloud_attempt(${id}, ${attemptNo}::int, 'w') as id`)).rows[0]!.id;
  const statusOf = async (id: string) => (await db.select({ s: applications.status }).from(applications).where(eq(applications.id, id)))[0]?.s;

  it("only tailored drafts are approved", async () => {
    const userId = await seedUser(db, { credits: 5 });
    const tailored = await draft(userId, "a");
    const untailored = await draft(userId, "b", { tailored: false });
    await expect(approveApplications(db, userId, [tailored, untailored], "extension")).resolves.toEqual([tailored]);
    expect(await statusOf(untailored)).toBe("draft");
  });

  it("a draft with resume lines but no answers is not approved (the form would go out without name or email)", async () => {
    const userId = await seedUser(db, { credits: 5 });
    const noAnswers = await draft(userId, "a", { answers: false });
    await expect(approveApplications(db, userId, [noAnswers], "extension")).resolves.toEqual([]);
    expect(await statusOf(noAnswers)).toBe("draft");
  });

  it("credits are checked against the drafts that can move, not every id sent", async () => {
    const userId = await seedUser(db, { credits: 1 });
    const ready = await draft(userId, "a");
    const stillTailoring = await draft(userId, "b", { tailored: false });
    await expect(approveApplications(db, userId, [ready, stillTailoring], "extension")).resolves.toEqual([ready]);
  });

  it("a shortfall is 402 payment_required with details { available, requested }, and nothing moves", async () => {
    const userId = await seedUser(db, { credits: 1 });
    const ids = [await draft(userId, "a"), await draft(userId, "b"), await draft(userId, "c")];
    await expect(approveApplications(db, userId, ids, "extension")).rejects.toMatchObject({
      status: 402,
      code: "payment_required",
      details: { available: 1, requested: 3 },
    });
    expect(await Promise.all(ids.map(statusOf))).toEqual(["draft", "draft", "draft"]);
  });

  it("availableCreditsNow reads balance minus in-flight in one statement", async () => {
    const { availableCreditsNow } = await import("../src/services/credits");
    const userId = await seedUser(db, { credits: 3 });
    await draft(userId, "a", { status: "approved", channel: "extension" });
    await draft(userId, "b", { status: "approved", channel: "extension" });
    await draft(userId, "c");
    await expect(availableCreditsNow(db, userId)).resolves.toBe(1);
  });

  it("concurrent approvals cannot overspend credits", async () => {
    // Eight tabs approve eight different drafts at once with credits for one. Without a per-user lock several
    // transactions read the same balance and all commit.
    const userId = await seedUser(db, { credits: 1 });
    const ids = await Promise.all(["a", "b", "c", "d", "e", "f", "g", "h"].map((x) => draft(userId, x)));
    const results = await Promise.allSettled(ids.map((id) => approveApplications(db, userId, [id], "extension")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r): r is PromiseRejectedResult => r.status === "rejected")) expect(r.reason).toMatchObject({ status: 402 });
  });

  it("claims an approved cloud application once: a replay gets the same attempt, and only one launch mark", async () => {
    const userId = await seedUser(db, { credits: 5 });
    const id = await draft(userId, "a", { status: "approved", channel: "cloud" });
    const attempt = await claim(id);
    expect(attempt).not.toBeNull();
    expect(await statusOf(id)).toBe("submitting");
    expect(await claim(id, 1)).toBe(attempt);
    const mark = async () => (await db.execute<{ ok: boolean }>(sql`select mark_browser_launched(${attempt}, 'w') as ok`)).rows[0]!.ok;
    expect(await mark()).toBe(true);
    expect(await mark()).toBe(false);
  });

  it("never claims a withdrawn application", async () => {
    const userId = await seedUser(db, { credits: 5 });
    const id = await draft(userId, "a", { status: "withdrawn", channel: "cloud" });
    expect(await claim(id)).toBeNull();
    expect(await statusOf(id)).toBe("withdrawn");
  });

  describe("report rules (WP-04)", () => {
    const report = (applicationId: string, outcome: "submitted" | "failed") => ({
      applicationId,
      outcome,
      failureReason: outcome === "failed" ? "Tab closed" : undefined,
      filledFields: [],
      submittedAt: "2001-01-01T00:00:00.000Z",
    });
    const ledger = async (userId: string) => (await db.select().from(creditLedger).where(eq(creditLedger.userId, userId))).filter((l) => l.reason === "submission");

    it("an extension 'failed' report cannot settle a cloud application the applier is sending (applications-v07)", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const id = await draft(userId, "a", { status: "approved", channel: "cloud" });
      const attempt = await claim(id);
      await expect(recordExtensionReport(db, userId, "s1", report(id, "failed"))).rejects.toMatchObject({ status: 409 });
      expect(await statusOf(id)).toBe("submitting");
      // The applier's own result still lands.
      await db.execute(sql`select record_attempt_result(${attempt}, 'submitted', null, '{}')`);
      await settleAll(db);
      expect(await statusOf(id)).toBe("submitted");
      expect(await ledger(userId)).toHaveLength(1);
    });

    it("an extension 'submitted' report on a cloud send in progress is still recorded, and charged once", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const id = await draft(userId, "a", { status: "approved", channel: "cloud" });
      const attempt = await claim(id);
      await recordExtensionReport(db, userId, "s1", report(id, "submitted"));
      await db.execute(sql`select record_attempt_result(${attempt}, 'submitted', null, '{}')`);
      await settleAll(db);
      expect(await statusOf(id)).toBe("submitted");
      expect(await ledger(userId)).toHaveLength(1);
    });

    it("submitted_at is server time, never the report's clock (applications-v01)", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const id = await draft(userId, "a", { status: "approved", channel: "extension" });
      const before = Date.now();
      await recordExtensionReport(db, userId, "s1", report(id, "submitted"));
      const [row] = await db.select({ at: applications.submittedAt }).from(applications).where(eq(applications.id, id));
      expect(row!.at!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });

    it("a non-owner cannot approve cloud while CLOUD_APPLIER_OPEN is off, whatever the plan", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const id = await draft(userId, "a");
      await expect(approveApplications(db, userId, [id], "cloud")).rejects.toMatchObject({ status: 403, message: "The cloud applier is not open yet" });
    });
  });
});
