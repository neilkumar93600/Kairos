import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

// The cursor is checked before any query, so a crafted one is 400 here without a database (the paging itself runs in
// notifications.int.test.ts).
const app = createApp({
  auth: { handler: async () => new Response(null), getSession: async () => ({ sessionId: "s", createdAt: new Date(), user: { id: "u1", email: "a@b.c", name: "A", emailVerified: true } }) },
  corsOrigins: [],
  healthChecks: {},
});
const crafted = (k: unknown, extra: object = {}) =>
  Buffer.from(JSON.stringify({ v: 1, t: "notifications", k: [k], id: "6f1c2a52-6d3e-4a0e-9a59-6e7f1b2c3d4e", ...extra })).toString("base64url");

describe("GET /api/notifications cursor (WP-44)", () => {
  it.each([
    ["junk", "junk"],
    ["a non-time key", crafted("not a time")],
    ["an impossible date", crafted("2026-02-31T00:00:00.000000Z")],
    ["Postgres' local text form", crafted("2026-11-03 12:00:00+00")],
    ["millisecond precision", crafted("2026-11-03T12:00:00.123Z")],
    ["a number", crafted(5)],
    ["another list's cursor", crafted("2026-11-03T12:00:00.000000Z", { t: "inbox" })],
    ["an extra field", crafted("2026-11-03T12:00:00.000000Z", { x: 1 })],
  ])("answers 400 invalid_param for %s", async (_name, cursor) => {
    const res = await request(app).get("/api/notifications").query({ cursor });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_param");
  });
});
