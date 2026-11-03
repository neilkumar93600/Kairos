import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/env";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: "http://localhost:3000",
  INBOUND_WEBHOOK_SECRET: "y".repeat(16),
};

describe("parseEnv", () => {
  it("lets development run without an email token", () => {
    expect(parseEnv({ ...base, NODE_ENV: "development" }).POSTMARK_SERVER_TOKEN).toBeUndefined();
  });

  it("refuses production without an email token, so codes never land in logs", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).toThrow(/POSTMARK_SERVER_TOKEN: required in production/);
  });

  const prod = { ...base, NODE_ENV: "production", POSTMARK_SERVER_TOKEN: "pm-token", BETTER_AUTH_URL: "https://kairos.app", WEB_ORIGIN: "https://kairos.app" };

  it("accepts production with an email token", () => {
    expect(parseEnv(prod).NODE_ENV).toBe("production");
  });

  // The browser reaches Better Auth through the web rewrite, so the session cookie and the OAuth state
  // live on the web host: in production BETTER_AUTH_URL must be that https origin exactly.
  it("refuses production when BETTER_AUTH_URL is not the web origin", () => {
    expect(() => parseEnv({ ...prod, BETTER_AUTH_URL: "https://api.kairos.app" })).toThrow(/BETTER_AUTH_URL: must equal WEB_ORIGIN/);
  });

  it("refuses plain http origins in production", () => {
    expect(() => parseEnv({ ...prod, BETTER_AUTH_URL: "http://kairos.app", WEB_ORIGIN: "http://kairos.app" })).toThrow(/WEB_ORIGIN: must be https in production/);
  });

  it("refuses a BETTER_AUTH_URL with a path in production, so basePath stays /api/auth on the web origin", () => {
    expect(() => parseEnv({ ...prod, BETTER_AUTH_URL: "https://kairos.app/app" })).toThrow(/BETTER_AUTH_URL: must be a bare origin/);
    expect(parseEnv({ ...prod, BETTER_AUTH_URL: "https://kairos.app/" }).NODE_ENV).toBe("production");
  });

  // Every listed origin is trusted by Better Auth as a request origin and a redirect target.
  it("refuses plain http entries in CSRF_ALLOWED_ORIGINS in production", () => {
    expect(() => parseEnv({ ...prod, CSRF_ALLOWED_ORIGINS: "https://www.kairos.app,http://preview.kairos.app" })).toThrow(
      /CSRF_ALLOWED_ORIGINS: "http:\/\/preview.kairos.app" must be https in production/,
    );
    expect(parseEnv({ ...prod, CSRF_ALLOWED_ORIGINS: "https://www.kairos.app" }).CSRF_ALLOWED_ORIGINS).toEqual(["https://www.kairos.app"]);
    expect(parseEnv({ ...base, CSRF_ALLOWED_ORIGINS: "http://localhost:3001" }).CSRF_ALLOWED_ORIGINS).toEqual(["http://localhost:3001"]);
  });

  it("parses CSRF_ALLOWED_ORIGINS as a list of exact origins", () => {
    expect(parseEnv({ ...base, CSRF_ALLOWED_ORIGINS: "https://kairos-git-main-team.vercel.app, https://www.kairos.app" }).CSRF_ALLOWED_ORIGINS).toEqual([
      "https://kairos-git-main-team.vercel.app",
      "https://www.kairos.app",
    ]);
    expect(parseEnv(base).CSRF_ALLOWED_ORIGINS).toEqual([]);
  });

  it("refuses wildcard or non-origin entries in CSRF_ALLOWED_ORIGINS", () => {
    expect(() => parseEnv({ ...base, CSRF_ALLOWED_ORIGINS: "https://*.vercel.app" })).toThrow(/CSRF_ALLOWED_ORIGINS/);
    expect(() => parseEnv({ ...base, CSRF_ALLOWED_ORIGINS: "https://kairos.app/path" })).toThrow(/CSRF_ALLOWED_ORIGINS/);
  });

  it("allows the mail sink file outside production only, so codes are never written to disk in production", () => {
    expect(parseEnv({ ...base, MAIL_SINK_FILE: "/tmp/mail.jsonl" }).MAIL_SINK_FILE).toBe("/tmp/mail.jsonl");
    expect(() => parseEnv({ ...prod, MAIL_SINK_FILE: "/tmp/mail.jsonl" })).toThrow(/MAIL_SINK_FILE: not allowed in production/);
  });

  it("OWNER_USER_IDS is empty by default (nobody owns the cloud channel) and splits a comma list", () => {
    expect(parseEnv(base).OWNER_USER_IDS).toEqual([]);
    expect(parseEnv({ ...base, OWNER_USER_IDS: " a1 ,b2,," }).OWNER_USER_IDS).toEqual(["a1", "b2"]);
  });

  it("STRIPE_GRANT_COUPONS is empty by default (no $0 invoice grants) and splits a comma list", () => {
    expect(parseEnv(base).STRIPE_GRANT_COUPONS).toEqual([]);
    expect(parseEnv({ ...base, STRIPE_GRANT_COUPONS: "" }).STRIPE_GRANT_COUPONS).toEqual([]);
    expect(parseEnv({ ...base, STRIPE_GRANT_COUPONS: " BETA100 ,founders," }).STRIPE_GRANT_COUPONS).toEqual(["BETA100", "founders"]);
  });

  // Checkout with automatic_tax fails until Stripe Tax is activated, so production keeps today's checkout until the owner flips it.
  it("STRIPE_AUTOMATIC_TAX is off by default and reads 1/true as on", () => {
    expect(parseEnv(base).STRIPE_AUTOMATIC_TAX).toBe(false);
    expect(parseEnv({ ...base, STRIPE_AUTOMATIC_TAX: "" }).STRIPE_AUTOMATIC_TAX).toBe(false);
    expect(parseEnv({ ...base, STRIPE_AUTOMATIC_TAX: "1" }).STRIPE_AUTOMATIC_TAX).toBe(true);
    expect(parseEnv({ ...base, STRIPE_AUTOMATIC_TAX: "true" }).STRIPE_AUTOMATIC_TAX).toBe(true);
    expect(() => parseEnv({ ...base, STRIPE_AUTOMATIC_TAX: "yes" })).toThrow(/STRIPE_AUTOMATIC_TAX/);
  });

  it("reads STRIPE_WEBHOOK_SECRET_PREVIOUS for a secret roll", () => {
    expect(parseEnv(base).STRIPE_WEBHOOK_SECRET_PREVIOUS).toBeUndefined();
    expect(parseEnv({ ...base, STRIPE_WEBHOOK_SECRET_PREVIOUS: "whsec_old" }).STRIPE_WEBHOOK_SECRET_PREVIOUS).toBe("whsec_old");
  });

  // A live key without a webhook secret takes real money while every webhook answers 400: no plan, no credits.
  it("refuses production with a live Stripe key but no webhook secret", () => {
    expect(() => parseEnv({ ...prod, STRIPE_SECRET_KEY: "sk_live_x" })).toThrow(/STRIPE_WEBHOOK_SECRET: required in production with a live STRIPE_SECRET_KEY/);
    expect(parseEnv({ ...prod, STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x" }).STRIPE_SECRET_KEY).toBe("sk_live_x");
    expect(parseEnv({ ...prod, STRIPE_SECRET_KEY: "sk_test_x" }).STRIPE_SECRET_KEY).toBe("sk_test_x");
  });

  // The edge secret is the only thing that lets a request choose its client IP (05-api 5.5).
  it("refuses a short KAIROS_EDGE_SECRET; no inner proxy hops unless set", () => {
    expect(() => parseEnv({ ...base, KAIROS_EDGE_SECRET: "short" })).toThrow(/KAIROS_EDGE_SECRET/);
    expect(parseEnv({ ...base, KAIROS_EDGE_SECRET: "" }).KAIROS_EDGE_SECRET).toBeUndefined();
    expect(parseEnv(base).TRUSTED_PROXY_HOPS_DIRECT).toBe(0);
    expect(parseEnv({ ...base, TRUSTED_PROXY_HOPS_DIRECT: "1" }).TRUSTED_PROXY_HOPS_DIRECT).toBe(1);
  });

  // WP-14: each bucket has its own token, so half a bucket is a deploy mistake, caught at boot instead of the first upload.
  const r2 = {
    R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
    R2_BUCKET_SNAPSHOTS: "kairos-snapshots",
    R2_SNAPSHOTS_ACCESS_KEY_ID: "key-id",
    R2_SNAPSHOTS_SECRET_ACCESS_KEY: "key-secret",
  };

  it("runs with no R2 variables at all (storage then refuses each call)", () => {
    expect(parseEnv(base).R2_ENDPOINT).toBeUndefined();
    expect(parseEnv({ ...base, ...r2 }).R2_BUCKET_SNAPSHOTS).toBe("kairos-snapshots");
  });

  it("takes a bucket's name and both key halves together, and R2_ENDPOINT with any of them", () => {
    expect(() => parseEnv({ ...base, ...r2, R2_SNAPSHOTS_SECRET_ACCESS_KEY: "" })).toThrow(/R2_SNAPSHOTS_SECRET_ACCESS_KEY: required with R2_BUCKET_SNAPSHOTS/);
    expect(() => parseEnv({ ...base, R2_RENDERS_ACCESS_KEY_ID: "key-id" })).toThrow(/R2_BUCKET_RENDERS: required with R2_RENDERS_ACCESS_KEY_ID/);
    expect(() => parseEnv({ ...base, ...r2, R2_ENDPOINT: "" })).toThrow(/R2_ENDPOINT: required with an R2 bucket/);
  });

  it("refuses a plain http R2_ENDPOINT in production (a local MinIO is fine elsewhere)", () => {
    expect(() => parseEnv({ ...prod, ...r2, R2_ENDPOINT: "http://minio.internal:9000" })).toThrow(/R2_ENDPOINT: must be https in production/);
    expect(parseEnv({ ...base, ...r2, R2_ENDPOINT: "http://localhost:9000" }).R2_ENDPOINT).toBe("http://localhost:9000");
  });
});
