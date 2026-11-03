import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { AuthGateway } from "../src/lib/auth";

/** A signed-in user of its own per test, so in-memory limiter counts never leak between tests. */
function appFor(userId: string) {
  const auth: AuthGateway = {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async () => ({ sessionId: "s", createdAt: new Date(), user: { id: userId, email: "a@b.c", name: "A", emailVerified: true } }),
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

// Limit classes of 05-api 6.2 (CISO mustFix 4). Counters are per app and in memory here; rate-limits.int.test.ts
// covers the shared Postgres store.
describe("limit classes", () => {
  /** "Bearer <id>" is signed in as <id>; "Bearer bad" and no header are signed out. */
  const byBearer: AuthGateway = {
    handler: async () => new Response(null, { status: 404 }),
    getSession: async (headers) => {
      const id = headers.get("authorization")?.replace(/^Bearer /, "");
      return id && id !== "bad" ? { sessionId: "s", createdAt: new Date(), user: { id, email: `${id}@test.local`, name: "U", emailVerified: true } } : null;
    },
  };

  // One listening server per test: hundreds of requests must not each open their own.
  let server: Server | undefined;
  afterEach(() => void server?.close());
  const serve = () => (server = createApp({ auth: byBearer, corsOrigins: [], healthChecks: {}, edgeSecret: "e".repeat(32) }).listen(0));

  it("keys signed-in traffic by user: 300 users behind one address, 2 requests each, see no 429", async () => {
    const s = serve();
    const seen = new Set<number>();
    for (let u = 0; u < 300; u++) {
      for (let i = 0; i < 2; i++) seen.add((await request(s).get("/api/me/none").set("authorization", `Bearer u${u}`).set("x-forwarded-for", "198.51.100.7")).status);
    }
    expect([...seen]).toEqual([404]);
    const res = await request(s).get("/api/me/none").set("authorization", "Bearer u0");
    expect(res.headers["ratelimit-policy"]).toContain('"user_api"; q=600; w=60');
  });

  it("keys anonymous traffic by the resolved address: forged x-vercel-id, x-kairos-client-ip and X-Forwarded-For cannot pick a new bucket", async () => {
    const s = serve();
    const forged = (i: number) =>
      request(s)
        .get("/api/auth-providers")
        .set("x-vercel-id", `fra1::${i}`)
        .set("x-kairos-client-ip", `10.9.0.${i % 250}`)
        .set("x-forwarded-for", `10.8.${i >> 8}.${i % 250}, 203.0.113.9`);
    for (let i = 0; i < 120; i++) expect((await forged(i)).status).toBe(200);
    const refused = await forged(120);
    expect(refused.status).toBe(429);
    expect(refused.body.error).toMatchObject({ code: "rate_limited", details: { reason: "ip_limit", bucket: "anon" } });
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    expect((await request(s).get("/api/auth-providers").set("x-forwarded-for", "203.0.113.10")).status).toBe(200);
  });

  it("counts a credentialed request that ends 401 against its address, so junk tokens do not skip the anonymous limit", async () => {
    const s = serve();
    const junk = () => request(s).get("/api/me").set("authorization", "Bearer bad").set("x-forwarded-for", "203.0.113.20");
    for (let i = 0; i < 120; i++) expect((await junk()).status).toBe(401);
    expect((await junk()).status).toBe(429);
    expect((await request(s).get("/api/auth-providers").set("x-forwarded-for", "203.0.113.20")).status).toBe(429);
  });

  it("limits checkout and portal to 10 per 10 minutes per user", async () => {
    const s = serve();
    const checkout = () => request(s).post("/api/billing/checkout").set("authorization", "Bearer payer").send({});
    for (let i = 0; i < 10; i++) expect((await checkout()).status).toBe(422);
    const refused = await checkout();
    expect(refused.status).toBe(429);
    expect(refused.body.error.details).toMatchObject({ reason: "user_limit", bucket: "billing" });
    expect((await request(s).post("/api/billing/checkout").set("authorization", "Bearer other").send({})).status).toBe(422);
  });

  it("limits the contact form to 5 an hour per resolved address", async () => {
    const s = serve();
    const send = (ip: string, i: number) => request(s).post("/api/contact").set("x-forwarded-for", `10.0.0.${i}, ${ip}`).send({});
    for (let i = 0; i < 5; i++) expect((await send("203.0.113.30", i)).status).toBe(422);
    expect((await send("203.0.113.30", 9)).status).toBe(429);
    expect((await send("203.0.113.31", 9)).status).toBe(422);
  });

  it("meters webhooks per address before the token check", async () => {
    const res = await request(serve()).post("/api/webhooks/inbound-email").set("x-forwarded-for", "203.0.113.50").send({});
    expect(res.status).toBe(403);
    expect(res.headers["ratelimit-policy"]).toContain('"webhook_ip"; q=600; w=60');
  });
});
