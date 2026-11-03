import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthGateway } from "../src/lib/auth";
import { closeTestDbs, hasTestDb, resetDb, testDb, testDbUrl } from "./helpers/test-db";

/** The shared Postgres limiter store (rate_limits, migration 0003). Skipped unless TEST_DATABASE_URL is set. */

// Before anything can call env() or db().
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("rate_limits");

const { createApp } = await import("../src/app");
const { hit } = await import("../src/middleware/rate-limit");
const { closeDb } = await import("../src/db/client");

const signedOut: AuthGateway = { handler: async () => new Response(null, { status: 404 }), getSession: async () => null };

describe.skipIf(!hasTestDb)("rate limits in Postgres", () => {
  beforeAll(async () => {
    await resetDb(await testDb("rate_limits"));
  });

  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  it("counts within one window, then starts a new one", async () => {
    expect((await hit("t:a", 300)).count).toBe(1);
    expect((await hit("t:a", 300)).count).toBe(2);
    expect((await hit("t:b", 300)).count).toBe(1);
    await new Promise((r) => setTimeout(r, 350));
    const fresh = await hit("t:a", 300);
    expect(fresh.count).toBe(1);
    expect(fresh.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("counts concurrent hits exactly once each", async () => {
    const counts = await Promise.all(Array.from({ length: 25 }, () => hit("t:c", 60_000)));
    expect(counts.map((c) => c.count).sort((x, y) => x - y)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("holds across two api replicas and a redeploy", async () => {
    const replica = () => createApp({ auth: signedOut, corsOrigins: [], healthChecks: {}, sharedLimits: true });
    const [a, b] = [replica(), replica()];
    // Invalid bodies stop at validation (422) after the contact limiter counted them: 5 an hour per client IP.
    const send = (app: ReturnType<typeof replica>) => request(app).post("/api/contact").set("x-forwarded-for", "203.0.113.40").send({});
    for (const app of [a, b, a, b, a]) expect((await send(app)).status).toBe(422);
    expect((await send(b)).status).toBe(429);
    expect((await send(replica())).status).toBe(429);
  });
});
