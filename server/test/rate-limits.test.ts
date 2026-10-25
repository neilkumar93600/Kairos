import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { AuthGateway } from "../src/lib/auth";

/** A signed-in user of its own per test, so in-memory limiter counts never leak between tests. */
function appFor(userId: string) {
  const auth: AuthGateway = {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async () => ({ sessionId: "s", user: { id: userId, email: "a@b.c", name: "A", emailVerified: true } }),
  };
  return createApp({ auth, corsOrigins: [], healthChecks: {} });
}

// Invalid bodies stop at validation (422) after the limiter counted them, so no request reaches the database.
async function statuses(path: string, n: number) {
  const app = appFor(randomUUID());
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((await request(app).post(path).send({ bogus: true })).status);
  return out;
}

describe("per-user AI and import limits", () => {
  it("limits POST /api/applications/:id/drafts to 10 a minute", async () => {
    const out = await statuses(`/api/applications/${randomUUID()}/drafts`, 11);
    expect(out.slice(0, 10)).toEqual(Array(10).fill(422));
    expect(out[10]).toBe(429);
  });

  it("limits POST /api/jobs/import to 10 a minute with rate_limited", async () => {
    const app = appFor(randomUUID());
    for (let i = 0; i < 10; i++) expect((await request(app).post("/api/jobs/import").send({ url: "nope" })).status).toBe(422);
    const res = await request(app).post("/api/jobs/import").send({ url: "nope" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("rate_limited");
  });
});
