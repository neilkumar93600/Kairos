import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

/** 05-api 2.1 / 12: /api/admin is same-origin only. Neither an Origin-bearing request nor a preflight gets CORS headers. */
const app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => null }, corsOrigins: ["https://web.test"], healthChecks: {} });

describe("admin routes and CORS", () => {
  it("sends no access-control headers to an allowed origin on /api/admin, for a request or a preflight", async () => {
    const get = await request(app).get("/api/admin/flags").set("origin", "https://web.test");
    expect(get.headers["access-control-allow-origin"]).toBeUndefined();
    expect(get.headers["access-control-allow-credentials"]).toBeUndefined();
    const pre = await request(app).options("/api/admin/flags").set("origin", "https://web.test").set("access-control-request-method", "PUT");
    expect(pre.headers["access-control-allow-origin"]).toBeUndefined();
    expect(pre.headers["access-control-allow-methods"]).toBeUndefined();
  });

  it("still sends them for the same origin on an ordinary route", async () => {
    const res = await request(app).get("/api/health").set("origin", "https://web.test");
    expect(res.headers["access-control-allow-origin"]).toBe("https://web.test");
  });
});
