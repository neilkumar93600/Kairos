import { gzipSync } from "node:zlib";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { redactUrl } from "../src/lib/logger";

describe("redactUrl", () => {
  it("cuts the query string, which can hold the inbound webhook token", () => {
    expect(redactUrl("/api/webhooks/inbound-email?token=abc&x=1")).toBe("/api/webhooks/inbound-email");
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

describe("inbound token is checked before the body is read", () => {
  const app = createApp({ auth: { handler: async () => new Response("{}"), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
  // A decompression bomb: ~50 KB on the wire, 50 MB inflated, and not valid JSON. Anything that inflated or parsed it
  // would take far longer and answer 400 invalid_json, not 403.
  const gzipped = gzipSync(Buffer.alloc(50 * 1024 * 1024, 0x7b));
  const post = (query: string) => request(app).post(`/api/webhooks/inbound-email${query}`).set("content-type", "application/json").set("content-encoding", "gzip").send(gzipped);

  it("a gzip body with a bad token is 403 without being inflated or parsed", async () => {
    expect(gzipped.length).toBeLessThan(200 * 1024);
    const res = await post("?token=wrong-token-wrong-token");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("a missing token is 403", async () => {
    expect((await post("")).status).toBe(403);
  });

  it("a bad token with a plain malformed body is 403, not 400", async () => {
    const res = await request(app).post("/api/webhooks/inbound-email?token=nope").set("content-type", "application/json").send("{not json");
    expect(res.status).toBe(403);
  });

  it("a valid token with a compressed body is refused (inflate is off); Postmark sends plain JSON", async () => {
    const res = await post("?token=test-inbound-secret");
    expect(res.status).toBe(415);
  });
});
