import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { auth, configuredProviders, type AuthGateway } from "../src/lib/auth";
import { parseEnv } from "../src/lib/env";

const envBase = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: "http://localhost:3000",
  INBOUND_WEBHOOK_SECRET: "y".repeat(16),
};

const signedOut: AuthGateway = {
  handler: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  getSession: async () => null,
};

describe("createApp", () => {
  it("reports healthy when every check passes", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: { database: async () => {}, redis: async () => {} } });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { database: "ok", redis: "ok" } });
  });

  it("reports 503 when a dependency is down", async () => {
    const app = createApp({
      auth: signedOut,
      corsOrigins: [],
      healthChecks: { database: async () => { throw new Error("down"); } },
    });
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe("down");
  });

  it("returns 401 on protected routes without a session", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("hands /api/auth/* to Better Auth", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });
    const res = await request(app).get("/api/auth/ok");
    expect(res.status).toBe(200);
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("route_not_found");
  });
});

describe("GET /api/auth-providers", () => {
  it("lists only the sign-in methods the API has configured", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });
    const res = await request(app).get("/api/auth-providers");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ providers: ["email"] });
  });

  // Static per deploy and fetched on every login page view, which would otherwise spend the anonymous per-address limit.
  it("is cacheable, so login page views do not spend the anonymous budget", async () => {
    const app = createApp({ auth: signedOut, corsOrigins: [], healthChecks: {} });
    const res = await request(app).get("/api/auth-providers");
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
  });

  it("adds google only when both Google credentials are set", () => {
    expect(configuredProviders(parseEnv({ ...envBase, GOOGLE_CLIENT_ID: "id" }))).toEqual(["email"]);
    expect(configuredProviders(parseEnv({ ...envBase, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }))).toEqual(["email", "google"]);
  });
});

// Regression guards: these match Better Auth 1.7.7 defaults today, so the int tests alone would not notice
// the explicit settings being dropped and a later default changing.
describe("Better Auth options", () => {
  it("pins password length, reset revocation, token encryption and the account linking policy", () => {
    const { emailAndPassword, account } = auth().options;
    expect(emailAndPassword).toMatchObject({ maxPasswordLength: 128, revokeSessionsOnPasswordReset: true, requireEmailVerification: true });
    expect(account).toMatchObject({
      encryptOAuthTokens: true,
      accountLinking: { enabled: true, trustedProviders: ["google"], requireLocalEmailVerified: true },
    });
  });
});

// better-call reads the whole body with no limit (CISO mustFix 2); Better Auth's own JSON bodies are tiny.
describe("/api/auth body cap", () => {
  let reached = 0;
  const counting: AuthGateway = { ...signedOut, handler: async () => (reached++, new Response(null, { status: 204 })) };
  const app = () => createApp({ auth: counting, corsOrigins: [], healthChecks: {} });

  it("answers 413 above 64 KB without handing the request to Better Auth", async () => {
    reached = 0;
    const res = await request(app()).post("/api/auth/sign-in/email").set("content-type", "application/json").send(`"${"x".repeat(64 * 1024)}"`);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("payload_too_large");
    expect(reached).toBe(0);
    expect((await request(app()).post("/api/auth/sign-in/email").set("content-type", "application/json").send(`"${"x".repeat(64 * 1024 - 2)}"`)).status).toBe(204);
    expect(reached).toBe(1);
  });

  it("answers 413 to a chunked body that declares no length", async () => {
    reached = 0;
    const server = app().listen(0);
    try {
      const status = await new Promise<number>((resolve, reject) => {
        // write() before end() with no content-length: Node sends Transfer-Encoding: chunked.
        const req = http.request({ port: (server.address() as AddressInfo).port, method: "POST", path: "/api/auth/sign-in/email", headers: { "content-type": "application/json" } }, (res) => {
          res.resume();
          resolve(res.statusCode!);
        });
        req.on("error", reject);
        req.write("{");
        req.end("}");
      });
      expect(status).toBe(413);
      expect(reached).toBe(0);
    } finally {
      server.close();
    }
  });
});
