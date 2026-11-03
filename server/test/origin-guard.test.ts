import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

/**
 * originGuard (05-api 5.6, CISO should-fix "origin guard"): a cookie-authenticated write from another site is 403
 * origin_not_allowed before any handler runs. Signed out here, so a request the guard lets through ends 401 unauthorized.
 */
const WEB = "https://kairos.example";
const app = createApp({
  auth: { handler: async () => new Response("{}", { headers: { "content-type": "application/json" } }), getSession: async () => null },
  corsOrigins: [WEB],
  csrfOrigins: [WEB, "https://preview.kairos.example"],
  healthChecks: {},
});
const COOKIE = "better-auth.session_token=abc.def";
const post = (path = "/api/applications/approve") => request(app).post(path).send({});

describe("originGuard", () => {
  it("refuses a cross-site POST carrying the session cookie with 403 origin_not_allowed", async () => {
    const res = await post().set("cookie", COOKIE).set("origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: "origin_not_allowed", details: { origin: "https://evil.example" } });
  });

  it.each(["put", "patch", "delete"] as const)("guards %s the same way, the __Secure- cookie included", async (method) => {
    const res = await request(app)[method]("/api/profile/facts/00000000-0000-4000-8000-000000000000")
      .set("cookie", `__Secure-${COOKIE}`)
      .set("origin", "null");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: "origin_not_allowed", details: { origin: "null" } });
  });

  it("without Origin, accepts Sec-Fetch-Site same-origin or none and refuses anything else", async () => {
    expect((await post().set("cookie", COOKIE).set("sec-fetch-site", "same-origin")).status).toBe(401);
    expect((await post().set("cookie", COOKIE).set("sec-fetch-site", "none")).status).toBe(401);
    const cross = await post().set("cookie", COOKIE).set("sec-fetch-site", "cross-site");
    expect(cross.status).toBe(403);
    expect(cross.body.error).toMatchObject({ code: "origin_not_allowed", details: { origin: null } });
    expect((await post().set("cookie", COOKIE)).status).toBe(403);
  });

  it("lets the web origin and a listed preview origin through to authentication", async () => {
    for (const origin of [WEB, "https://preview.kairos.example"]) {
      const res = await post().set("cookie", COOKIE).set("origin", origin);
      expect(res.body.error.code, origin).toBe("unauthorized");
    }
  });

  it("skips a bearer token, a request with no credential and a safe method", async () => {
    const evil = "https://evil.example";
    expect((await post().set("authorization", "Bearer t").set("cookie", COOKIE).set("origin", evil)).body.error.code).toBe("unauthorized");
    expect((await post().set("origin", evil)).body.error.code).toBe("unauthorized");
    expect((await request(app).get("/api/me").set("cookie", COOKIE).set("origin", evil)).body.error.code).toBe("unauthorized");
  });

  it("leaves /api/auth and /api/webhooks to their own checks", async () => {
    const auth = await request(app).post("/api/auth/sign-out").set("cookie", COOKIE).set("origin", "https://evil.example");
    expect(auth.status).toBe(200);
    const hook = await request(app).post("/api/webhooks/inbound-email").set("cookie", COOKIE).set("origin", "https://evil.example").send({});
    expect(hook.body?.error?.code).not.toBe("origin_not_allowed");
  });
});
