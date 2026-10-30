import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

/**
 * The real Better Auth instance (lib/auth.ts) against a throwaway Postgres: email+OTP, Google, linking policy,
 * token encryption and reset revocation. Google's token endpoint is stubbed; mail goes to MAIL_SINK_FILE.
 * Skipped unless TEST_DATABASE_URL is set.
 */

const WEB = "http://localhost:3000"; // WEB_ORIGIN and BETTER_AUTH_URL in test/setup-env.ts
const mailDir = mkdtempSync(join(tmpdir(), "kairos-auth-mail-"));
const sink = join(mailDir, "mail.jsonl");

// Before anything can call env() or db().
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("auth");
process.env.GOOGLE_CLIENT_ID = "test-google-client";
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
process.env.MAIL_SINK_FILE = sink;

const { createApp } = await import("../src/app");
const { authGateway } = await import("../src/lib/auth");
const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");

const PASSWORD = "correct-horse-battery";
const GOOGLE_ACCESS = "ya29.plain-access-token";
const GOOGLE_REFRESH = "1//plain-refresh-token";

/** Each request gets its own client address, so Better Auth's per-IP buckets (3 per 10 s) never trip between tests. */
let ipSeq = 0;
const nextIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`;

function lastCode(email: string, tag: string): string {
  if (!existsSync(sink)) throw new Error("no mail sent");
  const mail = readFileSync(sink, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { to: string; tag?: string; text: string });
  const hit = mail.filter((m) => m.to === email && m.tag === tag).at(-1);
  const code = hit?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no ${tag} code for ${email}`);
  return code;
}

/** An unsigned id token: Better Auth's Google provider decodes the token it gets from the (stubbed) token endpoint. */
function idToken(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: "https://accounts.google.com", aud: "test-google-client", iat: now, exp: now + 3600, ...claims })}.sig`;
}

describe.skipIf(!hasTestDb)("Better Auth end to end", () => {
  let tdb: Db;
  let app: ReturnType<typeof createApp>;
  let googleClaims: Record<string, unknown>;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    tdb = await testDb("auth");
    await resetDb(tdb);
    app = createApp({ auth: authGateway(), corsOrigins: [WEB], healthChecks: {} });
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return Response.json({ access_token: GOOGLE_ACCESS, refresh_token: GOOGLE_REFRESH, id_token: idToken(googleClaims), expires_in: 3600, token_type: "Bearer", scope: "openid email profile" });
      }
      if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url)) return realFetch(input, init);
      throw new Error(`unexpected network call to ${url}`);
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (tdb) await resetDb(tdb);
    await closeDb();
    await closeTestDbs();
    rmSync(mailDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetDb(tdb);
  });

  const post = (agent: ReturnType<typeof request.agent>, path: string, body: object) =>
    agent.post(`/api/auth${path}`).set("origin", WEB).set("x-forwarded-for", nextIp()).send(body);

  async function signUp(agent: ReturnType<typeof request.agent>, email: string, password = PASSWORD) {
    return post(agent, "/sign-up/email", { email, password, name: "Test User" });
  }

  /** Starts the Google flow and completes the callback as Google would, with `claims` in the id token. */
  async function googleSignIn(agent: ReturnType<typeof request.agent>, claims: Record<string, unknown>) {
    googleClaims = claims;
    const start = await post(agent, "/sign-in/social", { provider: "google", callbackURL: "/dashboard" });
    expect(start.status).toBe(200);
    const authorize = new URL(start.body.url);
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${WEB}/api/auth/callback/google`);
    return agent
      .get(`/api/auth/callback/google?code=test-code&state=${encodeURIComponent(authorize.searchParams.get("state")!)}`)
      .set("x-forwarded-for", nextIp());
  }

  const accountsOf = (userId: string) => tdb.select().from(schema.account).where(eq(schema.account.userId, userId));
  const sessionsOf = (userId: string) => tdb.select().from(schema.session).where(eq(schema.session.userId, userId));
  const userByEmail = async (email: string) => (await tdb.select().from(schema.user).where(eq(schema.user.email, email)))[0];

  it("does not link Google to an unverified password account for the same email (pre-hijack)", async () => {
    const email = "victim@test.local";
    const attacker = request.agent(app);
    expect((await signUp(attacker, email)).status).toBe(200);
    const squatted = await userByEmail(email);
    expect(squatted?.emailVerified).toBe(false);

    const victim = request.agent(app);
    const callback = await googleSignIn(victim, { sub: "google-victim", email, email_verified: true, name: "Victim" });
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toContain("account_not_linked");

    expect((await accountsOf(squatted!.id)).map((a) => a.providerId)).toEqual(["credential"]);
    expect(await sessionsOf(squatted!.id)).toHaveLength(0);
    expect(await tdb.select().from(schema.account).where(eq(schema.account.providerId, "google"))).toHaveLength(0);
  });

  it("links Google to a verified account and stores the OAuth tokens encrypted", async () => {
    const userId = await seedUser(tdb);
    const email = `${userId}@test.local`;
    const agent = request.agent(app);
    const callback = await googleSignIn(agent, { sub: "google-owner", email, email_verified: true, name: "Owner" });
    expect(callback.status).toBe(302);
    expect(callback.headers.location).not.toContain("error");

    const [google] = await tdb
      .select()
      .from(schema.account)
      .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "google")));
    expect(google?.accountId).toBe("google-owner");
    expect(google?.accessToken).toBeTruthy();
    expect(google?.accessToken).not.toContain(GOOGLE_ACCESS);
    expect(google?.refreshToken).not.toContain(GOOGLE_REFRESH);
    expect(await sessionsOf(userId)).toHaveLength(1);
  });

  it("refuses a password longer than 128 characters", async () => {
    const res = await signUp(request.agent(app), "long@test.local", "p".repeat(129));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PASSWORD_TOO_LONG");
    expect(await userByEmail("long@test.local")).toBeUndefined();
  });

  it("signs out every session when the password is reset by email code", async () => {
    const email = "reset@test.local";
    const agent = request.agent(app);
    expect((await signUp(agent, email)).status).toBe(200);
    expect((await post(agent, "/email-otp/verify-email", { email, otp: lastCode(email, "otp-email-verification") })).status).toBe(200);
    const signedIn = await post(agent, "/sign-in/email", { email, password: PASSWORD });
    expect(signedIn.status).toBe(200);
    expect((await agent.get("/api/me")).status).toBe(200);
    const user = await userByEmail(email);
    expect((await sessionsOf(user!.id)).length).toBeGreaterThan(0);

    const other = request.agent(app);
    expect((await post(other, "/email-otp/send-verification-otp", { email, type: "forget-password" })).status).toBe(200);
    const reset = await post(other, "/email-otp/reset-password", { email, otp: lastCode(email, "otp-forget-password"), password: "another-long-password" });
    expect(reset.status).toBe(200);

    expect(await sessionsOf(user!.id)).toHaveLength(0);
    expect((await agent.get("/api/me")).status).toBe(401);
  });

  it("passes scripts/smoke.mjs against a local API (sign up, OTP, sign in, /api/me, Google redirect)", async () => {
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const script = fileURLToPath(new URL("../../scripts/smoke.mjs", import.meta.url));
      const { stdout } = await promisify(execFile)(process.execPath, [script], {
        env: { ...process.env, SMOKE_BASE_URL: `http://127.0.0.1:${port}`, SMOKE_WEB_ORIGIN: WEB, SMOKE_MAIL_SINK: sink },
        timeout: 30_000,
      });
      expect(stdout).toContain("GET /api/me ok");
      expect(stdout).toContain("google redirect ok");
      expect(stdout).toMatch(/smoke passed/);
      expect(await tdb.select().from(schema.user)).toHaveLength(0); // the script deletes its user

    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
