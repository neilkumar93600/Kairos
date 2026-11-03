import { describe, expect, it } from "vitest";
import { confirmationProblem } from "../scripts/erase-user";

// The operator erasure's confirmation (WP-25, Security-reviewer round 1): a mistyped id cannot erase someone else.
describe("erase-user confirmation", () => {
  it("applies only when --confirm repeats the account's address", () => {
    expect(confirmationProblem({ email: "Ann@Example.com" }, " ann@example.com ")).toBeNull();
    expect(confirmationProblem({ email: "ann@example.com" }, undefined)).toMatch(/needs --confirm/);
    expect(confirmationProblem({ email: "ann@example.com" }, "bob@example.com")).toMatch(/does not match/);
    expect(confirmationProblem(undefined, "ann@example.com")).toBe("no such user");
  });
});
