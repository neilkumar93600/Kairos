import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// WP-09 reconcilers against Postgres. Redis is not used: redrive (the job-state check and add) is mocked here and its
// decision is unit-tested in reconcile.test.ts. Two calls at once stand in for two workers.
process.env.DATABASE_URL = testDbUrl("reconcile");

const redrive = vi.fn(async () => true);
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), redrive }));
const signal = vi.fn();
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const MINUTE = 60_000;
const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: ["f1"] };
const ANSWER = { fieldKey: "first_name", label: "First name", value: "Test", source: "profile" as const };

describe.skipIf(!hasTestDb)("reconcilers against Postgres", () => {
  let db: Db;
  let reconcile: typeof import("../src/jobs/reconcile");

  beforeAll(async () => {
    db = await testDb("reconcile");
    reconcile = await import("../src/jobs/reconcile");
  });
  beforeEach(async () => {
    redrive.mockClear();
    signal.mockReset();
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  let n = 0;
  async function application(userId: string, values: Partial<typeof schema.applications.$inferInsert> = {}) {
    n += 1;
    const [company] = await db.insert(schema.companies).values({ name: `Co ${n}`, ats: "greenhouse", boardToken: `co-${n}` }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: company!.id, externalId: `j${n}`, title: "Engineer", descriptionText: "Build things", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    const [app] = await db
      .insert(schema.applications)
      .values({ userId, jobId: job!.id, resumeLines: [LINE], answers: [ANSWER], ...values })
      .returning();
    return app!.id;
  }
  const approvedCloud = (userId: string, approvedAgoMs = 0) =>
    application(userId, { status: "approved", channel: "cloud", approvedAt: new Date(Date.now() - approvedAgoMs) });
  const row = async (id: string) => (await db.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;

  describe("stuck-submitting sweep (ops-18 interim)", () => {
    /** An applier that claimed `id` and died `agoMs` ago. */
    async function claimed(id: string, agoMs: number) {
      const { claimForCloud } = await import("../src/services/submissions");
      expect(await claimForCloud(db, id)).toBe(true);
      await db.update(schema.applications).set({ updatedAt: sql`now() - make_interval(secs => ${agoMs / 1000})` }).where(eq(schema.applications.id, id));
    }

    it("a claim older than 10 minutes settles as failed and unconfirmed, frees the credit, and is never resent", async () => {
      const { FAILURE_MESSAGES, recordSubmission } = await import("../src/services/submissions");
      const { availableCreditsNow } = await import("../src/services/credits");
      const { processCloudApply } = await import("../src/jobs/cloud-apply");
      const userId = await seedUser(db, { credits: 1 });
      const id = await approvedCloud(userId);
      await claimed(id, 11 * MINUTE);
      expect(await availableCreditsNow(db, userId)).toBe(0);

      await expect(reconcile.processSweepSubmitting()).resolves.toEqual({ swept: 1 });
      expect(await row(id)).toMatchObject({ status: "failed", failureReason: FAILURE_MESSAGES.unconfirmed });
      expect(await availableCreditsNow(db, userId)).toBe(1);
      expect(signal).toHaveBeenCalledWith("submitting_swept", 1);

      // BullMQ's stalled redelivery skips it, and a late result from an applier that was alive after all changes nothing.
      await expect(processCloudApply({ data: { applicationId: id } } as never)).resolves.toEqual({ skipped: true });
      const late = { applicationId: id, outcome: "submitted" as const, filledFields: [], submittedAt: new Date().toISOString() };
      await expect(recordSubmission(db, userId, late, "cloud")).rejects.toMatchObject({ status: 409 });
      expect((await row(id)).status).toBe("failed");
      expect(await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.reason, "submission"))).toEqual([]);
    });

    it("leaves a claim younger than 10 minutes and every other status alone", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const running = await approvedCloud(userId);
      await claimed(running, 5 * MINUTE);
      const approved = await approvedCloud(userId);
      await expect(reconcile.processSweepSubmitting()).resolves.toEqual({ swept: 0 });
      expect((await row(running)).status).toBe("submitting");
      expect((await row(approved)).status).toBe("approved");
      expect(signal).not.toHaveBeenCalled();
    });

    it("two workers sweeping at once settle each row once", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const ids = [await approvedCloud(userId), await approvedCloud(userId)];
      for (const id of ids) await claimed(id, 11 * MINUTE);
      const results = await Promise.all([reconcile.processSweepSubmitting(), reconcile.processSweepSubmitting()]);
      expect(results[0]!.swept + results[1]!.swept).toBe(2);
      await expect(reconcile.processSweepSubmitting()).resolves.toEqual({ swept: 0 });
    });
  });

  describe("approved cloud applications without a job (applications-40, ops-v04)", () => {
    it("re-adds the cloud-apply job of an approval older than 2 minutes, replacing a finished one", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const lost = await approvedCloud(userId, 3 * MINUTE);
      await approvedCloud(userId); // the route's own enqueue is still landing
      await application(userId, { status: "approved", channel: "extension", approvedAt: new Date(Date.now() - 3 * MINUTE) });
      await application(userId, { status: "withdrawn", channel: "cloud", approvedAt: new Date(Date.now() - 3 * MINUTE) });

      await expect(reconcile.processReconcileApply()).resolves.toEqual({ checked: 1, added: 1 });
      expect(redrive).toHaveBeenCalledExactlyOnceWith("cloud-apply", { applicationId: lost }, `apply-${lost}`, true);
    });

    it("the healed job still goes through the claim, so a doubled job sends once", async () => {
      const { claimForCloud } = await import("../src/services/submissions");
      const userId = await seedUser(db, { credits: 5 });
      const id = await approvedCloud(userId, 3 * MINUTE);
      await Promise.all([reconcile.processReconcileApply(), reconcile.processReconcileApply()]);
      expect(await Promise.all([claimForCloud(db, id), claimForCloud(db, id)])).toEqual(expect.arrayContaining([true, false]));
    });
  });
});
