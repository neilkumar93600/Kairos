import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/env";

/** WP-06 env keys, in their own file so the role split of WP-04 (env.test.ts) merges cleanly. */
const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  WEB_ORIGIN: "http://localhost:3000",
  INBOUND_WEBHOOK_SECRET: "y".repeat(16),
};

describe("AI spend env", () => {
  it("LLM_SHED_LEVEL defaults to 0 and takes 0 to 3 only", () => {
    expect(parseEnv(base).LLM_SHED_LEVEL).toBe(0);
    expect(parseEnv({ ...base, LLM_SHED_LEVEL: "2" }).LLM_SHED_LEVEL).toBe(2);
    expect(() => parseEnv({ ...base, LLM_SHED_LEVEL: "4" })).toThrow(/LLM_SHED_LEVEL/);
  });
});
