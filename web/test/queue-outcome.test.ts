import { describe, expect, it } from "vitest";
import { queueRefusal } from "../lib/queue-outcome";

describe("queueRefusal", () => {
  it("says what happened for each refusal", () => {
    expect(queueRefusal({ applicationId: null, reason: "already_queued", existingApplicationId: "a" })).toMatch(/already have an application/);
    expect(queueRefusal({ applicationId: null, reason: "company_cap" }, "Acme")).toMatch(/limit of applications to Acme/);
    expect(queueRefusal({ applicationId: null, reason: "too_many_pending" })).toMatch(/still being prepared/);
  });

  it("is silent on a new draft, and on a null id from an api that gives no reason", () => {
    expect(queueRefusal({ applicationId: "a" })).toBeNull();
    expect(queueRefusal({ applicationId: null })).toBeNull();
  });
});
