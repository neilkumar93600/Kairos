import { and, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * F11 daily allowances against Postgres (01-architecture B.8.10, 05-api 11.5; CISO mustFix 3). The counter is one guarded
 * upsert on ai_usage, so it holds across api replicas: here two connection pools, and two app instances.
 */

// Before anything can call env() or db(): the app's global client must point at this file's own database.
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("allowance");

const fetchPostingFromBoard = vi.hoisted(() => vi.fn());
vi.mock("../src/services/job-import", async (orig) => ({ ...(await orig<typeof import("../src/services/job-import")>()), fetchPostingFromBoard }));

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const { aiUsage } = await import("../src/db/schema/platform");
const { consumeAllowance, refundAllowance, metered } = await import("../src/services/allowance");

const posting = {
  externalId: "4012345",
  title: "Software Engineer",
  location: "Remote",
  remote: true,
  department: null,
  descriptionText: "Build APIs.",
  applyUrl: "https://boards.greenhouse.io/newco/jobs/4012345",
  postedAt: null,
  salaryMinUsd: null,
  salaryMaxUsd: null,
  raw: {},
};

describe.skipIf(!hasTestDb)("daily AI allowance against Postgres", () => {
  let tdb: Db;
  let userId: string;

  beforeAll(async () => {
    tdb = await testDb("allowance");
  });
  beforeEach(async () => {
    await resetDb(tdb);
    vi.clearAllMocks();
    userId = await seedUser(tdb);
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  const used = async (feature: string) =>
    (await tdb.select({ used: aiUsage.used }).from(aiUsage).where(and(eq(aiUsage.userId, userId), eq(aiUsage.feature, feature))))[0]?.used ?? 0;

  it("gives the unit back when the deadline already answered 503, and does not throw on the late header", async () => {
    const res = { headersSent: true, locals: {}, setHeader: () => { throw new Error("ERR_HTTP_HEADERS_SENT"); } } as never;
    await metered(res, { userId, plan: "free", feature: "resumeSuggestions" }, async () => "late output");
    expect(await used("resumeSuggestions")).toBe(0);
  });

  it("refunds a failure that follows an aborted deadline even when the error is not refundable", async () => {
    const aborted = new AbortController();
    aborted.abort();
    const res = { headersSent: false, locals: { deadline: aborted.signal }, setHeader: () => {} } as never;
    await expect(metered(res, { userId, plan: "free", feature: "resumeSuggestions" }, async () => { throw new Error("model reply refused after abort"); })).rejects.toThrow();
    expect(await used("resumeSuggestions")).toBe(0);
  });

  it("takes units up to the plan limit, then answers 429 daily_allowance without moving the counter", async () => {
    for (let i = 0; i < 10; i++) await consumeAllowance({ userId, plan: "free", feature: "resumeSuggestions" });
    const err = await consumeAllowance({ userId, plan: "free", feature: "resumeSuggestions" }).catch((e: unknown) => e);
    expect(err).toMatchObject({
      status: 429,
      code: "rate_limited",
      details: { reason: "daily_allowance", feature: "resumeSuggestions", limit: 10, used: 10 },
    });
    expect((err as { details: { resetsAt: string } }).details.resetsAt).toMatch(/T00:00:00Z$/);
    expect(await used("resumeSuggestions")).toBe(10);
  });

  it("never lets concurrent requests on two pools pass the limit", async () => {
    const req = { userId, plan: "free" as const, feature: "jobTailor" as const }; // Free: 5 a day
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => (i % 2 ? consumeAllowance(req) : consumeAllowance(req, tdb))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.status === 429)).toBe(true);
    expect(await used("jobTailor")).toBe(5);
  });

  it("refunds into the same day, and a 4-unit request never overshoots", async () => {
    for (let i = 0; i < 2; i++) await consumeAllowance({ userId, plan: "free", feature: "resumeSuggestions", units: 4 }); // 8 of 10
    await expect(consumeAllowance({ userId, plan: "free", feature: "resumeSuggestions", units: 4 })).rejects.toMatchObject({ status: 429 });
    expect(await used("resumeSuggestions")).toBe(8);
    const grant = await consumeAllowance({ userId, plan: "free", feature: "resumeSuggestions", units: 2 });
    await refundAllowance(grant);
    expect(await used("resumeSuggestions")).toBe(8);
  });

  describe("a scripted Free account through two api instances", () => {
    const app = () => {
      const user = { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true };
      return createApp({ auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user, sessionId: "s", createdAt: new Date() }) }, corsOrigins: [], healthChecks: {} });
    };

    it("stops at the jobImports allowance with 429 daily_allowance, and every success carries Kairos-Allowance", async () => {
      fetchPostingFromBoard.mockResolvedValue(posting);
      const replicas = [app(), app()];
      const url = "https://boards.greenhouse.io/newco/jobs/4012345";
      const responses = [];
      for (let i = 0; i < 4; i++) responses.push(await request(replicas[i % 2]!).post("/api/jobs/import").send({ url }));
      expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 429]);
      expect(responses[2]!.headers["kairos-allowance"]).toMatch(/^feature=jobImports;used=3;limit=3;resets=\d{4}-\d{2}-\d{2}T00:00:00Z$/);
      expect(responses[3]!.body.error).toMatchObject({ code: "rate_limited", details: { reason: "daily_allowance", feature: "jobImports", limit: 3, used: 3 } });
    });

    it("an import that fails before any work refunds its unit", async () => {
      const a = app();
      for (let i = 0; i < 5; i++) {
        const res = await request(a).post("/api/jobs/import").send({ url: "https://example.com/jobs/123" });
        expect(res.body.error.code).toBe("unsupported_board");
      }
      expect(await used("jobImports")).toBe(0);
    });
  });
});
