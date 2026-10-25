import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { redactUrl } from "../src/lib/logger";

describe("redactUrl", () => {
  it("masks the inbound webhook token and keeps the rest of the URL", () => {
    expect(redactUrl("/api/webhooks/inbound-email?token=abc&x=1")).toBe("/api/webhooks/inbound-email?token=[redacted]&x=1");
  });

  it("leaves a URL without a query unchanged", () => {
    expect(redactUrl("/api/me")).toBe("/api/me");
  });
});

describe("POST /api/webhooks/inbound-email", () => {
  it("answers 422 invalid_body for a malformed payload instead of 500", async () => {
    const app = createApp({ auth: { handler: async () => new Response("{}"), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
    const res = await request(app).post("/api/webhooks/inbound-email?token=test-inbound-secret").send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_body");
  });
});

describe("body parser errors leave as 4xx, not 500", () => {
  const app = createApp({ auth: { handler: async () => new Response("{}"), getSession: async () => null }, corsOrigins: [], healthChecks: {} });

  it("malformed JSON is 400 invalid_json", async () => {
    const res = await request(app).post("/api/webhooks/inbound-email?token=test-inbound-secret").set("content-type", "application/json").send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_json");
  });

  it("an oversized body is 413 payload_too_large", async () => {
    const res = await request(app).post("/api/contact").send({ name: "x".repeat(1_200_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("payload_too_large");
  });

  it("an inbound mail with a few MB of attachments is parsed, so a reply is never lost to the size limit", async () => {
    const res = await request(app)
      .post("/api/webhooks/inbound-email?token=test-inbound-secret")
      .send({ Attachments: [{ Content: "A".repeat(3_000_000) }] }); // no MessageID: parses, then fails validation
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid_body");
  });
});
