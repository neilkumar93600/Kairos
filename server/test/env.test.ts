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
});
