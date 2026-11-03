import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => null }, corsOrigins: ["https://kairos.test"], healthChecks: {} });

describe("CORS and contract headers", () => {
  it("allows X-Kairos-Client and the conditional-request headers on preflight", async () => {
    const res = await request(app)
      .options("/api/me")
      .set("origin", "https://kairos.test")
      .set("access-control-request-method", "PATCH")
      .set("access-control-request-headers", "x-kairos-client,if-match,idempotency-key");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-headers"]).toBe("content-type,authorization,idempotency-key,if-match,if-none-match,x-kairos-client,x-request-id");
    expect(res.headers["access-control-max-age"]).toBe("600");
  });

  it("exposes Retry-After and the contract headers to the browser", async () => {
    const res = await request(app).get("/api/me").set("origin", "https://kairos.test");
    expect(res.headers["access-control-expose-headers"]).toContain("retry-after");
    expect(res.headers["access-control-expose-headers"]).toContain("kairos-contract");
  });

  it("stamps every /api answer with Kairos-Contract, errors included", async () => {
    expect((await request(app).get("/api/me")).headers["kairos-contract"]).toBe("2026-10-23");
    expect((await request(app).get("/api/nope")).headers["kairos-contract"]).toBe("2026-10-23");
  });
});
