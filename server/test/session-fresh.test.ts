import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const user = { id: "u1", email: "u1@test.local", name: "U", emailVerified: true };
const hours = (h: number) => new Date(Date.now() - h * 3_600_000);
const app = (createdAt?: Date) => {
  const seen: (boolean | undefined)[] = [];
  const a = createApp({
    auth: { handler: async () => new Response(null), getSession: async (_h, opts) => (seen.push(opts?.fresh), { user, sessionId: "s", createdAt }) },
    corsOrigins: [],
    healthChecks: {},
  });
  return { a, seen };
};

describe("session-fresh routes", () => {
  it.each([
    ["post", "/api/applications/approve"],
    ["post", "/api/billing/checkout"],
    ["post", "/api/billing/portal"],
  ] as const)("%s %s refuses a session older than a day with 403 reauth_required", async (method, path) => {
    const { a, seen } = app(hours(25));
    const res = await request(a)[method](path).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: "reauth_required", details: { maxAgeSec: 86_400 } });
    expect(seen[0]).toBe(true);
  });

  it("lets a session from the last day through to the route's own validation", async () => {
    const res = await request(app(hours(2)).a).post("/api/applications/approve").send({});
    expect(res.status).toBe(422);
  });

  it("leaves every other route on the cached session, however old", async () => {
    const { a, seen } = app(hours(500));
    expect((await request(a).get("/api/me")).status).not.toBe(403);
    expect(seen.every((f) => f === undefined || f === false)).toBe(true);
  });
});
