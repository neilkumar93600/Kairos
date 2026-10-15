import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { AuthGateway } from "../src/lib/auth";

const signedOut: AuthGateway = {
  handler: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  getSession: async () => null,
};

describe("createApp", () => {
  it("reports healthy when every check passes", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: { database: async () => {}, redis: async () => {} } });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { database: "ok", redis: "ok" } });
  });

  it("reports 503 when a dependency is down", async () => {
    const app = createApp({
      auth: signedOut,
      corsOrigins: [],
      healthChecks: { database: async () => { throw new Error("down"); } },
    });
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe("down");
  });

  it("returns 401 on protected routes without a session", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("hands /api/auth/* to Better Auth", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });
    const res = await request(app).get("/api/auth/ok");
    expect(res.status).toBe(200);
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("route_not_found");
  });
});
