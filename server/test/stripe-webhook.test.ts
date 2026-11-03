import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// env() is read lazily, so these must be set before the first call; vi.hoisted runs before the imports below.
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_unit";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_current";
});

const { createApp } = await import("../src/app");
const { stripe, verifyStripeEvent } = await import("../src/services/stripe");

const payload = JSON.stringify({ id: "evt_1", object: "event", type: "charge.succeeded", data: { object: {} } });
const sign = (secret: string, opts: { body?: string; timestamp?: number } = {}) =>
  stripe().webhooks.generateTestHeaderString({ payload: opts.body ?? payload, secret, timestamp: opts.timestamp });

describe("verifyStripeEvent", () => {
  const secrets = ["whsec_current", "whsec_previous"];

  it("accepts the current secret", () => {
    expect(verifyStripeEvent(Buffer.from(payload), sign("whsec_current"), secrets).id).toBe("evt_1");
  });

  it("accepts the previous secret during a roll", () => {
    expect(verifyStripeEvent(Buffer.from(payload), sign("whsec_previous"), secrets).id).toBe("evt_1");
  });

  it("refuses an unknown secret, a tampered body and a missing header with 400 bad_signature", () => {
    for (const [body, header] of [
      [payload, sign("whsec_other")],
      [payload.replace("evt_1", "evt_2"), sign("whsec_current")],
      [payload, undefined],
    ] as const) {
      expect(() => verifyStripeEvent(Buffer.from(body), header, secrets)).toThrow(expect.objectContaining({ status: 400, code: "bad_signature" }));
    }
  });

  it("refuses a signature older than 300 seconds", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(verifyStripeEvent(Buffer.from(payload), sign("whsec_current", { timestamp: now - 290 }), secrets).id).toBe("evt_1");
    expect(() => verifyStripeEvent(Buffer.from(payload), sign("whsec_current", { timestamp: now - 310 }), secrets)).toThrow(
      expect.objectContaining({ code: "bad_signature" }),
    );
  });

  it("refuses everything when no secret is configured", () => {
    expect(() => verifyStripeEvent(Buffer.from(payload), sign("whsec_current"), [undefined, undefined])).toThrow(expect.objectContaining({ code: "bad_signature" }));
  });
});

describe("POST /api/webhooks/stripe before any database work", () => {
  const app = createApp({ auth: { handler: async () => new Response("{}"), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
  const post = (body: string, signature: string) =>
    request(app).post("/api/webhooks/stripe").set("stripe-signature", signature).set("content-type", "application/json").send(body);

  it("answers 400 bad_signature to a wrong signature", async () => {
    const res = await post(payload, sign("whsec_wrong"));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("bad_signature");
  });

  it("reads bodies up to 1 MB (an invoice with many lines) and refuses larger ones", async () => {
    const big = JSON.stringify({ id: "evt_big", pad: "x".repeat(500_000) });
    expect((await post(big, sign("whsec_wrong", { body: big }))).body.error.code).toBe("bad_signature");
    const huge = JSON.stringify({ id: "evt_huge", pad: "x".repeat(1_100_000) });
    expect((await post(huge, sign("whsec_current", { body: huge }))).status).toBe(413);
  });
});
