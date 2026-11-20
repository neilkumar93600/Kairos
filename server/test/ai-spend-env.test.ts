import { memoryLane } from "./helpers/lanes";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("PAUSE_SCORING is off by default and takes true, 1 or on", () => {
    expect(parseEnv(base).PAUSE_SCORING).toBe(false);
    expect(parseEnv({ ...base, PAUSE_SCORING: "" }).PAUSE_SCORING).toBe(false);
    for (const on of ["true", "1", "on"]) expect(parseEnv({ ...base, PAUSE_SCORING: on }).PAUSE_SCORING).toBe(true);
    expect(parseEnv({ ...base, PAUSE_SCORING: "false" }).PAUSE_SCORING).toBe(false);
  });
});

describe("gatewayCtx", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("hands services the caller's context only while LLM_GATEWAY=anthropic", async () => {
    vi.resetModules();
    const legacy = await import("../src/llm/wire");
    expect(legacy.gatewayCtx({ userId: "u", plan: "pro" })).toBeUndefined();
    vi.stubEnv("LLM_GATEWAY", "anthropic");
    vi.resetModules();
    const live = await import("../src/llm/wire");
    expect(live.gatewayCtx({ userId: "u", plan: "pro", jobId: "j" })).toEqual({ userId: "u", plan: "pro", jobId: "j" });
  });
});

describe("PAUSE_SCORING", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("stops the scoring loop before it reads anything", async () => {
    vi.stubEnv("PAUSE_SCORING", "true");
    vi.resetModules();
    const { processScoreMatches, processScoreUser, setScoreLane } = await import("../src/jobs/score-matches");
    // A paused user job does read its lane, to look again later if it holds anything (F6), so the lane is in memory.
    setScoreLane(memoryLane());
    // No database or Redis is reachable here, so any query would throw. Both the fan-out and the user's chunk stop.
    expect(await processScoreMatches({ data: { jobId: "00000000-0000-4000-8000-000000000000" } } as never)).toEqual({ queued: 0, paused: true });
    expect(await processScoreUser({ data: { userId: "u" } } as never)).toEqual({ stored: 0, retrying: 0, paused: true });
  });
});
