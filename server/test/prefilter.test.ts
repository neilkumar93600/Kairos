import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "../src/lib/env";

const ceiling = vi.hoisted(() => ({ value: 140 }));
vi.mock("../src/lib/env", async (orig) => ({ ...(await orig<typeof import("../src/lib/env")>()), env: () => ({ MATCHING_DAILY_CAP_MAX: ceiling.value }) }));

const { dailyScoringCap } = await import("../src/services/prefilter");
const { COLD_START_FACTS, F1_FLOOR, F1_FLOOR_COLD_START, f1Floor } = await import("../src/jobs/score-matches");

describe("the scoring cap: the plan's number, under MATCHING_DAILY_CAP_MAX", () => {
  beforeEach(() => {
    ceiling.value = 140;
  });

  it("leaves plans under the ceiling alone and holds Max to it until the owner pins the caps", () => {
    expect([dailyScoringCap("free"), dailyScoringCap("starter"), dailyScoringCap("pro"), dailyScoringCap("max")]).toEqual([20, 120, 140, 140]);
  });

  it("a lower ceiling cuts every plan at once, and 0 stops pipeline scoring", () => {
    ceiling.value = 5;
    expect(dailyScoringCap("free")).toBe(5);
    ceiling.value = 0;
    expect(dailyScoringCap("max")).toBe(0);
  });

  it("the env defaults to 140 and refuses junk", () => {
    const base = { DATABASE_URL: "postgres://x/y", REDIS_URL: "redis://x", BETTER_AUTH_SECRET: "x".repeat(32), BETTER_AUTH_URL: "https://a.example", WEB_ORIGIN: "https://a.example", INBOUND_WEBHOOK_SECRET: "x".repeat(16) };
    expect(parseEnv(base).MATCHING_DAILY_CAP_MAX).toBe(140);
    expect(parseEnv({ ...base, MATCHING_DAILY_CAP_MAX: "30" }).MATCHING_DAILY_CAP_MAX).toBe(30);
    expect(() => parseEnv({ ...base, MATCHING_DAILY_CAP_MAX: "many" })).toThrow();
  });
});

describe("the F1 floor (04-matching 7.2, 16)", () => {
  it("is 20 under 8 confirmed facts and 35 from there", () => {
    expect(F1_FLOOR).toBe(35);
    expect(F1_FLOOR_COLD_START).toBe(20);
    expect(f1Floor(1)).toBe(20);
    expect(f1Floor(COLD_START_FACTS - 1)).toBe(20);
    expect(f1Floor(COLD_START_FACTS)).toBe(35);
  });
});
