import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resumeSchema } from "@auto-career/shared";
import { FROZEN_ROUTES } from "./helpers/frozen-routes";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// Recorded contract suite, level 2 (S-C1): signed in, every frozen route must be routed (never route_not_found)
// and must answer an empty body with a 4xx, not a crash. Auth is mounted per prefix, so only this level catches
// a removed sub-route. The app's global db() reads DATABASE_URL lazily, so it is set before the app loads.
process.env.DATABASE_URL = testDbUrl("contract");
const USER_ID = "contract-user";

type App = ReturnType<typeof import("../src/app").createApp>;

describe.skipIf(!hasTestDb)("frozen client routes, signed in", () => {
  let app: App;

  beforeAll(async () => {
    const db = await testDb("contract");
    await resetDb(db);
    await seedUser(db, { id: USER_ID, credits: 5 });
    const { profiles } = await import("../src/db/schema");
    await db.insert(profiles).values({ userId: USER_ID, forwardingAddress: "u-contract@inbound.test", preferences: null });
    const { createApp } = await import("../src/app");
    app = createApp({
      auth: {
        handler: async () => new Response("{}", { headers: { "content-type": "application/json" } }),
        getSession: async () => ({ user: { id: USER_ID, email: `${USER_ID}@test.local`, name: "Test User", emailVerified: true }, sessionId: "s1" }),
      },
      corsOrigins: [],
      healthChecks: {},
    });
  });

  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  it.each(FROZEN_ROUTES)("%s %s is routed and answers an empty body without a 5xx", async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.body?.error?.code).not.toBe("route_not_found");
    // billing_unavailable (503) is the designed answer when Stripe is not configured, as in this test env.
    if (res.status >= 500) expect(res.body?.error?.code).toBe("billing_unavailable");
  });

  it("a missing sub-route under a guarded prefix is route_not_found when signed in, so the check above can fail", async () => {
    const res = await request(app).get("/api/profile/not-a-route");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("route_not_found");
  });

  it("GET /api/resume parses with the shared resumeSchema the web app uses", async () => {
    const res = await request(app).get("/api/resume");
    expect(res.status).toBe(200);
    expect(() => resumeSchema.parse(res.body.resume)).not.toThrow();
  });
});
