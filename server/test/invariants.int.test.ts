import { and, eq } from "drizzle-orm";
import request from "supertest";
import type { Preferences } from "@auto-career/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// P0 invariant tests (ADR-001 B.14): pinned on the skeleton so the DBOS migration (P2-P4) cannot regress them.
// The app's global db() reads DATABASE_URL lazily, so it is set before any app module loads.
process.env.DATABASE_URL = testDbUrl("invariants");

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
    const [a] = await db.insert(schema.applications).values({ userId, jobId, status, channel, resumeLines: [LINE] }).returning();
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
