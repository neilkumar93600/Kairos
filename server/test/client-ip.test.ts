import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { AuthGateway } from "../src/lib/auth";
import { clientIp, clientIpResolver } from "../src/middleware/client-ip";

const SECRET = "edge-secret-edge-secret-edge-secret";

/** Echoes the resolved address and whether the edge secret reached the handler. */
function appWith(secret: string | undefined, hops?: number) {
  const app = express();
  app.use(clientIpResolver(secret, hops));
  app.get("/ip", (req, res) => res.json({ ip: clientIp(req), edgeSeen: req.headers["x-kairos-edge"] !== undefined }));
  return app;
}

// Railway's edge appends the address it saw, so the rightmost X-Forwarded-For entry is real and everything to its
// left is whatever the caller sent (05-api 5.5).
describe("clientIpResolver", () => {
  it("ignores a forged x-vercel-id and X-Forwarded-For sent straight to the api: the rightmost hop wins", async () => {
    const res = await request(appWith(SECRET)).get("/ip").set("x-vercel-id", "fra1::abc").set("x-forwarded-for", "1.2.3.4, 203.0.113.9");
    expect(res.body.ip).toBe("203.0.113.9");
  });

  it("ignores x-kairos-client-ip without the edge secret, or with a wrong one", async () => {
    const forged = await request(appWith(SECRET)).get("/ip").set("x-kairos-client-ip", "1.2.3.4").set("x-forwarded-for", "203.0.113.9");
    expect(forged.body.ip).toBe("203.0.113.9");
    const wrong = await request(appWith(SECRET))
      .get("/ip")
      .set("x-kairos-edge", "not-the-secret")
      .set("x-kairos-client-ip", "1.2.3.4")
      .set("x-forwarded-for", "203.0.113.9");
    expect(wrong.body.ip).toBe("203.0.113.9");
  });

  it("trusts nothing as edge traffic when the api has no secret, even an empty x-kairos-edge", async () => {
    const res = await request(appWith(undefined)).get("/ip").set("x-kairos-edge", "").set("x-kairos-client-ip", "1.2.3.4").set("x-forwarded-for", "203.0.113.9");
    expect(res.body.ip).toBe("203.0.113.9");
  });

  it("uses x-kairos-client-ip when the edge secret matches, and never passes the secret on", async () => {
    const res = await request(appWith(SECRET))
      .get("/ip")
      .set("x-kairos-edge", SECRET)
      .set("x-kairos-client-ip", "198.51.100.7")
      .set("x-forwarded-for", "198.51.100.7, 76.76.21.21");
    expect(res.body).toEqual({ ip: "198.51.100.7", edgeSeen: false });
  });

  it("falls back to the rightmost hop when the edge sends something that is not an address", async () => {
    const res = await request(appWith(SECRET)).get("/ip").set("x-kairos-edge", SECRET).set("x-kairos-client-ip", "1.2.3.4, 5.6.7.8").set("x-forwarded-for", "203.0.113.9");
    expect(res.body.ip).toBe("203.0.113.9");
  });

  it("skips the configured inner proxies from the right", async () => {
    const res = await request(appWith(SECRET, 1)).get("/ip").set("x-forwarded-for", "1.2.3.4, 203.0.113.9, 10.0.0.2");
    expect(res.body.ip).toBe("203.0.113.9");
  });

  it("uses the socket peer when there is no X-Forwarded-For", async () => {
    const res = await request(appWith(SECRET)).get("/ip");
    expect(res.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });
});

describe("createApp", () => {
  /** The headers Better Auth receives for one /api/auth request. */
  async function authSees(headers: Record<string, string>) {
    let seen: Headers | undefined;
    const auth: AuthGateway = {
      handler: async (r) => ((seen = r.headers), new Response(null, { status: 204 })),
      getSession: async () => null,
    };
    let req = request(createApp({ auth, corsOrigins: [], healthChecks: {}, edgeSecret: SECRET })).get("/api/auth/get-session");
    for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
    await req;
    return seen!;
  }

  it("hands Better Auth the resolved address and never the edge secret", async () => {
    const viaEdge = await authSees({ "x-kairos-edge": SECRET, "x-kairos-client-ip": "198.51.100.7", "x-forwarded-for": "76.76.21.21" });
    expect(viaEdge.get("x-kairos-client-ip")).toBe("198.51.100.7");
    expect(viaEdge.has("x-kairos-edge")).toBe(false);

    const forged = await authSees({ "x-vercel-id": "fra1::abc", "x-kairos-client-ip": "1.2.3.4", "x-forwarded-for": "1.2.3.4, 203.0.113.9" });
    expect(forged.get("x-kairos-client-ip")).toBe("203.0.113.9");
  });
});
