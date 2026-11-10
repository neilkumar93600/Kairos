import { eq, sql } from "drizzle-orm";
import { DEFAULT_PREFERENCES } from "@auto-career/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import type { SessionUser } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/** Migration 0019: new profiles start at goals, the forward-only guard uses the seven-step order, goals and targets are checked. CI only (no local Postgres). */
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("onboarding");
process.env.DATA_KEKS ??= `v1:${Buffer.from([...Array(32).keys()]).toString("base64")}`;

const { createApp } = await import("../src/app");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");

describe.skipIf(!hasTestDb)("onboarding wizard columns", () => {
  let tdb: Db;
  let userId: string;
  let app: ReturnType<typeof createApp>;
  const row = async () => (await tdb.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)))[0]!;
  const set = (v: Partial<typeof schema.profiles.$inferInsert>) => tdb.update(schema.profiles).set(v).where(eq(schema.profiles.userId, userId));
  /** drizzle wraps the driver's error in `cause`; the check constraint's name is on it. */
  const constraintOf = async (run: () => PromiseLike<unknown>) => {
    try {
      await run();
    } catch (err) {
      const e = err as { constraint?: string; cause?: { constraint?: string } };
      return e.cause?.constraint ?? e.constraint;
    }
    return undefined;
  };

  beforeAll(async () => {
    tdb = await testDb("onboarding");
  });
  afterAll(async () => {
    if (tdb) await resetDb(tdb);
    await closeDb();
    await closeTestDbs();
  });
  beforeEach(async () => {
    await resetDb(tdb);
    userId = await seedUser(tdb);
    await tdb.insert(schema.profiles).values({ userId, forwardingAddress: `u-${userId}@replies.test` });
    const user: SessionUser = { id: userId, email: `${userId}@test.local`, name: "Test User", emailVerified: true };
    app = createApp({
      auth: { handler: async () => new Response(null, { status: 404 }), getSession: async () => ({ user, sessionId: "s", createdAt: new Date() }) },
      corsOrigins: [],
      healthChecks: {},
    });
  });

  it("new profiles start at goals", async () => {
    const p = await row();
    expect(p.onboardingStep).toBe("goals");
    expect(p.goals).toEqual([]);
    expect(p.targetRoles).toEqual([]);
    expect(p.targetCompanies).toEqual([]);
  });

  it("step only moves forward under the new ranks", async () => {
    await set({ onboardingStep: "rules" });
    await set({ onboardingStep: "target" });
    expect((await row()).onboardingStep).toBe("rules");
  });

  it("old rows keep their meaning", async () => {
    await set({ onboardingStep: "resume" });
    await set({ onboardingStep: "confirm-facts" });
    expect((await row()).onboardingStep).toBe("confirm-facts");
    await set({ onboardingStep: "resume" });
    expect((await row()).onboardingStep).toBe("confirm-facts");
  });

  it("goals check rejects unknown values", async () => {
    expect(await constraintOf(() => tdb.execute(sql`update profiles set goals = '{"post"}' where user_id = ${userId}`))).toBe("profiles_goals_ck");
  });

  it("look is exclusive", async () => {
    expect(await constraintOf(() => tdb.execute(sql`update profiles set goals = '{"look","find"}' where user_id = ${userId}`))).toBe("profiles_goals_ck");
  });

  it("PUT /api/profile/onboarding saves goals and targets", async () => {
    const res = await request(app).put("/api/profile/onboarding").send({ goals: ["find", "build"], targetRoles: ["Frontend Developer"] });
    expect(res.status).toBe(200);
    expect(res.body.profile.goals).toEqual(["find", "build"]);
    expect(res.body.profile.targetRoles).toEqual(["Frontend Developer"]);
    expect(res.body.profile.targetCompanies).toEqual([]);
  });

  it("a backward step is ignored, not an error", async () => {
    await set({ onboardingStep: "rules" });
    const res = await request(app).put("/api/profile/onboarding").send({ step: "target" });
    expect(res.status).toBe(200);
    expect(res.body.profile.onboardingStep).toBe("rules");
  });

  it("invalid body is 422", async () => {
    const res = await request(app).put("/api/profile/onboarding").send({ goals: ["look", "find"] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_body");
  });

  it("saving preferences no longer finishes onboarding", async () => {
    await set({ onboardingStep: "rules" });
    const res = await request(app).put("/api/profile/preferences").send({ ...DEFAULT_PREFERENCES, roles: ["Software Engineer"], workAuthorization: "citizen_or_pr" });
    expect(res.status).toBe(200);
    expect((await row()).onboardingStep).toBe("rules");
  });

  it("GET /api/me exposes goals and targets", async () => {
    await set({ goals: ["find"], targetRoles: ["Designer"], targetCompanies: ["Acme"] });
    const res = await request(app).get("/api/me");
    expect(res.body).toMatchObject({ goals: ["find"], targetRoles: ["Designer"], targetCompanies: ["Acme"], onboardingStep: "goals" });
  });
  it("application details round trip, encrypted at rest and merged with other stored answers", async () => {
    const empty = await request(app).get("/api/profile/application-details");
    expect(empty.body.details).toEqual({ noticePeriod: null, openToRelocation: null, expectedSalary: null });
    const body = { noticePeriod: "1_month", openToRelocation: true, expectedSalary: { amount: 90000, currency: "USD" } };
    const put = await request(app).put("/api/profile/application-details").send(body);
    expect(put.status).toBe(200);
    expect(put.body.details).toEqual(body);
    expect((await request(app).get("/api/profile/application-details")).body.details).toEqual(body);
    const enc = (await row()).sensitiveAnswersEnc!;
    expect(() => JSON.parse(Buffer.from(enc).toString("utf8"))).toThrow();
    const { decrypt } = await import("../src/lib/crypto");
    const { detailsAad } = await import("../src/services/application-details");
    expect(JSON.parse(decrypt(enc, detailsAad(userId)).toString("utf8"))).toEqual(body);
    expect((await request(app).get("/api/profile")).body.profile).not.toHaveProperty("sensitiveAnswersEnc");
    expect((await request(app).put("/api/profile/application-details").send({ noticePeriod: "soon" })).status).toBe(422);
  });
});
