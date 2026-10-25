import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { AuthGateway } from "../src/lib/auth";
import { FROZEN_ROUTES } from "./helpers/frozen-routes";

/**
 * Recorded contract suite, level 1 (S-C1 in ADR-001 B.14 P0). Every route the frozen clients call
 * (web/lib/api.ts, web/hooks/*.ts, extension/src/lib/api.ts, recorded 2026-10-23) must stay mounted and
 * auth-guarded: signed out gives 401 "unauthorized", unverified email gives 403 "email_unverified", never 404.
 * A rename or removal of any of these paths breaks a shipped client.
 */
const gateway = (session: Awaited<ReturnType<AuthGateway["getSession"]>>): AuthGateway => ({
  handler: async () => new Response("{}", { headers: { "content-type": "application/json" } }),
  getSession: async () => session,
});

const signedOut = createApp({ auth: gateway(null), corsOrigins: [], healthChecks: {} });
const unverified = createApp({
  auth: gateway({ user: { id: "u1", email: "u1@test.local", name: "U", emailVerified: false }, sessionId: "s1" }),
  corsOrigins: [],
  healthChecks: {},
});

describe("frozen client routes stay mounted and auth-guarded", () => {
  it.each(FROZEN_ROUTES)("%s %s answers 401 unauthorized when signed out", async (method, path) => {
    const res = await request(signedOut)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it.each(FROZEN_ROUTES)("%s %s answers 403 email_unverified before verification", async (method, path) => {
    const res = await request(unverified)[method](path).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("email_unverified");
  });

  it("an unknown route is a 404 route_not_found, so the checks above are not vacuous", async () => {
    const res = await request(signedOut).get("/api/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("route_not_found");
  });
});
