import { and, eq } from "drizzle-orm";
import request from "supertest";
import type { Preferences } from "@auto-career/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// P0 invariant tests (ADR-001 B.14): pinned on the skeleton so the DBOS migration (P2-P4) cannot regress them.
// The app's global db() reads DATABASE_URL lazily, so it is set before any app module loads.
process.env.DATABASE_URL = testDbUrl("invariants");
// A filler bundle that does not exist makes the cloud applier fail before it opens a browser (see the INV-5 cloud test).
process.env.FILLER_SCRIPT_PATH = "/nonexistent/filler.js";

const scoreFit = vi.fn(async () => ({ score: 90, reasons: ["Strong match"] }));
vi.mock("../src/services/fit", async (importOriginal) => ({ ...(await importOriginal<typeof import("../src/services/fit")>()), scoreFit }));

const PREFS: Preferences = {
  roles: ["software engineer"],
  seniority: ["entry"],
  locations: ["New York"],
  remoteOk: true,
  workAuthorization: "opt_stem_opt",
  salaryFloorUsd: 90_000,
  excludedCompanies: [],
  excludedKeywords: [],
  fitThreshold: 75,
  maxApplicationsPerCompanyPer30Days: 2,
};
const ANSWER = { fieldKey: "first_name", label: "First name", value: "Test", source: "profile" as const };
const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: ["f1"] };

describe.skipIf(!hasTestDb)("P0 invariants against Postgres", () => {
  let db: Db;
  let schema: typeof import("../src/db/schema");

  beforeAll(async () => {
    db = await testDb("invariants");
    schema = await import("../src/db/schema");
  });
  beforeEach(async () => {
    scoreFit.mockClear();
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  async function company(name: string) {
    const [c] = await db.insert(schema.companies).values({ name, ats: "greenhouse", boardToken: name.toLowerCase() }).returning();
    return c!.id;
  }
  async function job(companyId: string, externalId: string) {
    const [j] = await db
      .insert(schema.jobs)
      .values({ companyId, externalId, title: "Software Engineer, New Grad", location: "New York, NY", remote: false, descriptionText: "Build APIs in TypeScript.", salaryMaxUsd: 140_000, applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
      .returning();
    return j!.id;
  }
  async function application(userId: string, jobId: string, status: "draft" | "approved", channel: "extension" | null) {
    const [a] = await db.insert(schema.applications).values({ userId, jobId, status, channel, resumeLines: [LINE], answers: [ANSWER] }).returning();
    return a!.id;
  }
  async function candidate(id: string, prefs: Preferences) {
    await seedUser(db, { id, credits: 5 });
    await db.insert(schema.profiles).values({ userId: id, forwardingAddress: `${id}@inbound.test`, preferences: prefs });
    await db.insert(schema.facts).values({ userId: id, kind: "skill", text: "TypeScript APIs", confirmed: true });
  }

  it("charges once when the same submission is reported eight times at once", async () => {
    const { recordSubmission } = await import("../src/services/submissions");
    const userId = await seedUser(db, { credits: 5 });
    const appId = await application(userId, await job(await company("Acme"), "a"), "approved", "extension");
    const report = { applicationId: appId, outcome: "submitted" as const, filledFields: [], submittedAt: new Date().toISOString() };

    const results = await Promise.allSettled(Array.from({ length: 8 }, () => recordSubmission(db, userId, report, "extension")));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const charges = await db
      .select()
      .from(schema.creditLedger)
      .where(and(eq(schema.creditLedger.applicationId, appId), eq(schema.creditLedger.reason, "submission")));
    expect(charges).toHaveLength(1);
  });

  describe("INV-5: a failed submission is never charged", () => {
    const failedReport = (applicationId: string) => ({
      applicationId,
      outcome: "failed" as const,
      failureReason: "Form not found",
      filledFields: [],
      submittedAt: new Date().toISOString(),
    });
    const ledgerFor = (userId: string) => db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId));

    it("extension report: no ledger row, the in-flight credit is freed, and a late 'submitted' cannot charge it", async () => {
      const { recordSubmission } = await import("../src/services/submissions");
      const { availableCreditsNow } = await import("../src/services/credits");
      const userId = await seedUser(db, { credits: 5 });
      const appId = await application(userId, await job(await company("Acme"), "a"), "approved", "extension");
      const rowsBefore = (await ledgerFor(userId)).length;
      await expect(availableCreditsNow(db, userId)).resolves.toBe(4); // the approved application holds one credit

      await recordSubmission(db, userId, failedReport(appId), "extension");
      expect(await ledgerFor(userId)).toHaveLength(rowsBefore);
      await expect(availableCreditsNow(db, userId)).resolves.toBe(5);

      // The employer page can still be submitted by hand later; the product must not bill for what it marked failed.
      const late = { ...failedReport(appId), outcome: "submitted" as const };
      await expect(recordSubmission(db, userId, late, "extension")).rejects.toMatchObject({ status: 409 });
      expect(await ledgerFor(userId)).toHaveLength(rowsBefore);
    });

    it("cloud applier: a failed attempt ends the application as failed with zero ledger rows added", async () => {
      const { processCloudApply } = await import("../src/jobs/cloud-apply");
      const userId = await seedUser(db, { credits: 5 });
      const appId = await application(userId, await job(await company("Acme"), "a"), "approved", "cloud");
      const rowsBefore = (await ledgerFor(userId)).length;

      await processCloudApply({ data: { applicationId: appId } } as Parameters<typeof processCloudApply>[0]);

      const [row] = await db.select().from(schema.applications).where(eq(schema.applications.id, appId));
      expect(row?.status).toBe("failed");
      expect(await ledgerFor(userId)).toHaveLength(rowsBefore);
    });
  });

  describe("plan gating: the cloud applier is Pro and Max only", () => {
    async function approveAs(userId: string, channel: "cloud" | "extension", ids: string[]) {
      const { createApp } = await import("../src/app");
      const app = createApp({
        auth: {
          handler: async () => new Response("{}"),
          getSession: async () => ({ user: { id: userId, email: "p@test.local", name: "P", emailVerified: true }, sessionId: "s" }),
        },
        corsOrigins: [],
        healthChecks: {},
      });
      return request(app).post("/api/applications/approve").send({ applicationIds: ids, channel });
    }

    it("a Free user approving the cloud channel gets 403 and nothing moves", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const appId = await application(userId, await job(await company("Acme"), "a"), "draft", null);
      const res = await approveAs(userId, "cloud", [appId]);
      expect(res.status).toBe(403);
      expect(res.body.error?.code ?? res.body.code).toBe("forbidden");
      const [row] = await db.select().from(schema.applications).where(eq(schema.applications.id, appId));
      expect(row?.status).toBe("draft");
    });

    it("a Free user can still approve the extension channel", async () => {
      const userId = await seedUser(db, { credits: 5 });
      const appId = await application(userId, await job(await company("Acme"), "a"), "draft", null);
      const res = await approveAs(userId, "extension", [appId]);
      expect(res.status).toBe(200);
      expect(res.body.approved).toEqual([appId]);
    });
  });

  it("the extension queue never lists a draft: nothing is sent before approval", async () => {
    const userId = await seedUser(db, { id: "queue-user", credits: 5 });
    const companyId = await company("Acme");
    const approved = await application(userId, await job(companyId, "a"), "approved", "extension");
    const draft = await application(userId, await job(companyId, "b"), "draft", null);
    const { createApp } = await import("../src/app");
    const app = createApp({
      auth: {
        handler: async () => new Response("{}"),
        getSession: async () => ({ user: { id: userId, email: "q@test.local", name: "Q", emailVerified: true }, sessionId: "s" }),
      },
      corsOrigins: [],
      healthChecks: {},
    });
    const res = await request(app).get("/api/extension/queue");
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).toContain(approved);
    expect(body).not.toContain(draft);
  });

  it("never calls the fit model for a user who fails the hard filters", async () => {
    const { processScoreMatches } = await import("../src/jobs/score-matches");
    await candidate("excludes-acme", { ...PREFS, excludedCompanies: ["Acme"] });
    await candidate("passes", PREFS);
    const jobId = await job(await company("Acme"), "a");

    await processScoreMatches({ data: { jobId } } as Parameters<typeof processScoreMatches>[0]);
    // Exactly one call: for the passing user (positive control), none for the excluded one.
    expect(scoreFit).toHaveBeenCalledTimes(1);
    const matched = await db.select({ userId: schema.matches.userId }).from(schema.matches);
    expect(matched.map((m) => m.userId)).toEqual(["passes"]);
  });
});
