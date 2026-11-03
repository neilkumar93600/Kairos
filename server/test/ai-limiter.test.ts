import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const as = (id: string) =>
  createApp({
    auth: { handler: async () => new Response(null), getSession: async () => ({ user: { id, email: `${id}@t.local`, name: id, emailVerified: true }, sessionId: "s" }) },
    corsOrigins: [],
    healthChecks: {},
  });

describe("ai_burst limiter without shared limits", () => {
  it("counts per user in memory: the 11th call in a minute is 429, another user is unaffected", async () => {
    const app = as("ai-mem-1");
    // The empty body is refused by validation after the limiter counted it.
    for (let i = 0; i < 10; i++) expect((await request(app).post("/api/resume/suggestions").send({})).status).toBe(422);
    const res = await request(app).post("/api/resume/suggestions").send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: "rate_limited", details: { bucket: "ai_burst", reason: "user_limit" } });
    expect((await request(as("ai-mem-2")).post("/api/resume/suggestions").send({})).status).toBe(422);
  });
});
