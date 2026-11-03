import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { applications, companies, creditLedger, jobs } from "../src/db/schema";
import { approveApplications, claimForCloud, recordSubmission } from "../src/services/submissions";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb } from "./helpers/test-db";

const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: ["f1"] };
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
      })
      .returning();
    return app!.id;
  }

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

  it("claims an approved cloud application once", async () => {
    const userId = await seedUser(db, { credits: 5 });
    const id = await draft(userId, "a", { status: "approved", channel: "cloud" });
    await expect(claimForCloud(db, id)).resolves.toBe(true);
    expect(await statusOf(id)).toBe("submitting");
    await expect(claimForCloud(db, id)).resolves.toBe(false);
  });

  it("never claims a withdrawn application", async () => {
    const userId = await seedUser(db, { credits: 5 });
    const id = await draft(userId, "a", { status: "withdrawn", channel: "cloud" });
    await expect(claimForCloud(db, id)).resolves.toBe(false);
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
      await claimForCloud(db, id);
      await expect(recordSubmission(db, userId, report(id, "failed"), "extension")).rejects.toMatchObject({ status: 409 });
      expect(await statusOf(id)).toBe("submitting");
      // The applier's own result still lands.
      await recordSubmission(db, userId, report(id, "submitted"), "cloud");
      expect(await statusOf(id)).toBe("submitted");
      expect(await ledger(userId)).toHaveLength(1);
    });

    it("an extension 'submitted' report on a cloud send in progress is still recorded, and charged once", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const id = await draft(userId, "a", { status: "approved", channel: "cloud" });
      await claimForCloud(db, id);
      await recordSubmission(db, userId, report(id, "submitted"), "extension");
      await recordSubmission(db, userId, report(id, "submitted"), "cloud");
      expect(await statusOf(id)).toBe("submitted");
      expect(await ledger(userId)).toHaveLength(1);
    });

    it("submitted_at is server time, never the report's clock (applications-v01)", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const id = await draft(userId, "a", { status: "approved", channel: "extension" });
      const before = Date.now();
      await recordSubmission(db, userId, report(id, "submitted"), "extension");
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
