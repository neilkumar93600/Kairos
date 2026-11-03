import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const user = { id: "u1", email: "u1@test.local", name: "U", emailVerified: true };
const hours = (h: number) => new Date(Date.now() - h * 3_600_000);
const app = (createdAt: unknown) => {
  const seen: (boolean | undefined)[] = [];
  const a = createApp({
    auth: { handler: async () => new Response(null), getSession: async (_h, opts) => (seen.push(opts?.fresh), { user, sessionId: "s", createdAt: createdAt as Date }) },
    corsOrigins: [],
    healthChecks: {},
  });
  return { a, seen };
};

describe("session-fresh routes", () => {
  it.each([["/api/billing/checkout"], ["/api/billing/portal"]])("POST %s refuses a session older than a day with 403 reauth_required", async (path) => {
    const { a, seen } = app(hours(25));
    const res = await request(a).post(path).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: "reauth_required", details: { maxAgeSec: 86_400 } });
    expect(seen).toEqual([true]);
  });

  it("fails closed when the gateway reports no creation time, or one that is not a Date (a cached cookie would give a string)", async () => {
    for (const bad of [undefined, "2026-11-03T00:00:00.000Z", null]) {
      const res = await request(app(bad).a).post("/api/billing/portal").send({});
      expect(res.status, String(bad)).toBe(403);
      expect(res.body.error.code).toBe("reauth_required");
    }
  });

  it("lets a session from the last day through to the route's own validation", async () => {
    expect((await request(app(hours(2)).a).post("/api/billing/checkout").send({})).status).toBe(422);
  });

  it("approve reads the session uncached but, with FRESH_SESSION_ENFORCE off, does not age it out", async () => {
    const { a, seen } = app(hours(500));
    const res = await request(a).post("/api/applications/approve").send({});
    expect(res.status).toBe(422);
    expect(seen).toEqual([true]);
  });

  it("leaves every other route on the cached session, however old", async () => {
    const { a, seen } = app(hours(500));
    expect((await request(a).get("/api/me")).status).not.toBe(403);
    expect(seen.every((f) => f === false)).toBe(true);
  });
});
