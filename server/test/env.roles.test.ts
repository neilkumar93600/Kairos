import { afterEach, describe, expect, it } from "vitest";
import { APPLIER_FORBIDDEN, ENV_KEYS, baseEnv, env, envFor, setProcessRole } from "../src/lib/env";

/** Per-process env schemas (CISO mustFix 1(3), platform-24): the applier boots with almost nothing and holds no secret. */

const applierOnly = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://kairos_applier:pw@db.internal:5432/kairos",
  REDIS_URL: "redis://redis.internal:6379",
  FILLER_SCRIPT_PATH: "/app/filler.js",
  CHROMIUM_EXECUTABLE_PATH: "/ms-playwright/chromium/chrome",
};

describe("envFor('applier')", () => {
  it("boots in production with only its DB URL, REDIS_URL, FILLER_SCRIPT_PATH and CHROMIUM_EXECUTABLE_PATH", () => {
    const e = envFor("applier", applierOnly);
    expect(e.DATABASE_URL).toBe(applierOnly.DATABASE_URL);
    expect(e.FILLER_SCRIPT_PATH).toBe("/app/filler.js");
    expect(e.OWNER_USER_IDS).toEqual([]);
    expect(e.CLOUD_APPLIER_OPEN).toBe(false);
    expect(e.APPLIER_CHROMIUM_SANDBOX).toBe(true);
  });

  it("the parsed applier env carries no secret field", () => {
    const e = envFor("applier", applierOnly) as Record<string, unknown>;
    for (const key of APPLIER_FORBIDDEN) expect(e).not.toHaveProperty(key);
  });

  // A secret added to the api/worker schema later must not reach the applier just because nobody updated the list.
  it("forbids every secret-like key the applier schema does not declare", () => {
    const secretLike = /SECRET|_KEY|TOKEN|KEKS|PASSWORD/;
    const missing = ENV_KEYS.all.filter((k) => secretLike.test(k) && !ENV_KEYS.applier.includes(k) && !(APPLIER_FORBIDDEN as readonly string[]).includes(k));
    expect(missing).toEqual([]);
  });

  it.each([...APPLIER_FORBIDDEN])("refuses to boot in production when %s is set", (key) => {
    expect(() => envFor("applier", { ...applierOnly, [key]: "leaked-secret-value-1234567890abcdef" })).toThrow(new RegExp(`${key}: must not be set on the applier`));
  });

  it("names the forbidden keys without echoing their values", () => {
    try {
      envFor("applier", { ...applierOnly, STRIPE_SECRET_KEY: "sk_live_shouldnotappear" });
      expect.unreachable();
    } catch (err) {
      expect(String(err)).not.toContain("sk_live_shouldnotappear");
    }
  });

  it("ignores stray secrets outside production, so a local .env still runs the applier", () => {
    expect(envFor("applier", { ...applierOnly, NODE_ENV: "development", BETTER_AUTH_SECRET: "x".repeat(32) }).NODE_ENV).toBe("development");
  });

  it("forbids every Stripe, Anthropic, Postmark, auth and webhook secret", () => {
    for (const key of [
      "BETTER_AUTH_SECRET",
      "INBOUND_WEBHOOK_SECRET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "POSTMARK_SERVER_TOKEN",
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_KEY_INTERACTIVE",
      "ANTHROPIC_KEY_BATCH",
      "ANTHROPIC_KEY_EVALS",
      "USER_HASH_KEY",
      "GOOGLE_CLIENT_SECRET",
    ]) {
      expect(APPLIER_FORBIDDEN).toContain(key);
    }
  });

  it("APPLIER_CHROMIUM_SANDBOX=0 turns the sandbox off (only after a signed risk acceptance)", () => {
    expect(envFor("applier", { ...applierOnly, APPLIER_CHROMIUM_SANDBOX: "0" }).APPLIER_CHROMIUM_SANDBOX).toBe(false);
  });
});

describe("envFor('api') and envFor('worker')", () => {
  it("still require the auth and webhook secrets", () => {
    expect(() => envFor("api", applierOnly)).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => envFor("worker", applierOnly)).toThrow(/INBOUND_WEBHOOK_SECRET/);
  });

  it("CLOUD_APPLIER_OPEN reads 1/true as open and defaults to closed", () => {
    const base = {
      ...applierOnly,
      NODE_ENV: "development",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      WEB_ORIGIN: "http://localhost:3000",
      INBOUND_WEBHOOK_SECRET: "y".repeat(16),
    };
    expect(envFor("api", base).CLOUD_APPLIER_OPEN).toBe(false);
    expect(envFor("api", { ...base, CLOUD_APPLIER_OPEN: "1" }).CLOUD_APPLIER_OPEN).toBe(true);
    expect(envFor("api", { ...base, CLOUD_APPLIER_OPEN: "true" }).CLOUD_APPLIER_OPEN).toBe(true);
    expect(envFor("api", { ...base, CLOUD_APPLIER_OPEN: "0" }).CLOUD_APPLIER_OPEN).toBe(false);
  });
});

describe("role getters", () => {
  afterEach(() => setProcessRole("api"));

  it("env() throws in the applier, so no applier code path can read a secret", () => {
    setProcessRole("applier");
    expect(() => env()).toThrow(/not available in the applier/);
  });

  it("baseEnv() reads the shared fields through the applier schema in the applier and the full schema elsewhere", () => {
    expect(baseEnv().DATABASE_URL).toBe(process.env.DATABASE_URL);
    expect(baseEnv()).toHaveProperty("BETTER_AUTH_SECRET");
    setProcessRole("applier");
    expect(baseEnv().DATABASE_URL).toBe(process.env.DATABASE_URL);
    expect(baseEnv()).not.toHaveProperty("BETTER_AUTH_SECRET");
  });
});
