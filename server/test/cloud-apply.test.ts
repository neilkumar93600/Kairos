import { describe, expect, it } from "vitest";
import { cloudOpenTo, FAILURE_MESSAGES } from "../src/services/submissions";

/** WP-04 applier containment, the parts that need neither Postgres nor a browser. */

describe("cloud gate", () => {
  const closed = { OWNER_USER_IDS: ["owner"], CLOUD_APPLIER_OPEN: false };
  const open = { ...closed, CLOUD_APPLIER_OPEN: true };

  it("lets the owners through on any plan, open or not", () => {
    expect(cloudOpenTo("owner", "free", closed)).toBe(true);
    expect(cloudOpenTo("owner", "free", open)).toBe(true);
  });

  it("keeps everyone else out until CLOUD_APPLIER_OPEN, then only plans with cloudApplier", () => {
    expect(cloudOpenTo("u", "max", closed)).toBe(false);
    expect(cloudOpenTo("u", "pro", open)).toBe(true);
    expect(cloudOpenTo("u", "max", open)).toBe(true);
    expect(cloudOpenTo("u", "starter", open)).toBe(false);
    expect(cloudOpenTo("u", "free", open)).toBe(false);
  });
});

describe("failure catalog", () => {
  it("every message fits failure_reason, says no credit was used, and never invites a blind resend of an unconfirmed send", () => {
    for (const message of Object.values(FAILURE_MESSAGES)) {
      expect(message.length).toBeLessThanOrEqual(500);
      expect(message).toMatch(/no credit was used/i);
    }
    expect(FAILURE_MESSAGES.unconfirmed).toMatch(/check your email/i);
  });
});
