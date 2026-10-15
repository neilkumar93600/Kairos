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

  it("accepts production with an email token", () => {
    expect(parseEnv({ ...base, NODE_ENV: "production", POSTMARK_SERVER_TOKEN: "pm-token" }).NODE_ENV).toBe("production");
  });
});
