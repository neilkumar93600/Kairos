import { describe, expect, it } from "vitest";
import { backfillJobId, preferencesCause } from "../src/routes/profile";

const MINUTE = 60_000;

describe("the backfill job id (Contract round 1)", () => {
  it("coalesces the same cause in one minute, and runs it again the next", () => {
    expect(backfillJobId("u1", "facts", 10 * MINUTE)).toBe(backfillJobId("u1", "facts", 10 * MINUTE + 59_000));
    // BullMQ refuses an id it still holds, completed or not.
    expect(backfillJobId("u1", "facts", 10 * MINUTE)).not.toBe(backfillJobId("u1", "facts", 11 * MINUTE));
  });

  it("gives a second, different save in the same minute its own id", () => {
    const a = preferencesCause({ roles: ["Engineer"] });
    const b = preferencesCause({ roles: ["Designer"] });
    expect(a).not.toBe(b);
    expect(a).toBe(preferencesCause({ roles: ["Engineer"] }));
    expect(backfillJobId("u1", a, 0)).not.toBe(backfillJobId("u1", b, 0));
  });

  it("holds no colon, which BullMQ refuses in a custom id", () => {
    expect(backfillJobId("u1", preferencesCause({}), 0)).not.toContain(":");
  });
});
