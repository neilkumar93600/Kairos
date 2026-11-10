import { describe, expect, it } from "vitest";
import { phaseLabel } from "@/lib/onboarding/upload-phase";

describe("phaseLabel", () => {
  it("shows the server's progress words", () => {
    expect(phaseLabel("Finding your roles", 3)).toBe("Finding your roles");
  });

  it("falls back to reading when the server sends none", () => {
    expect(phaseLabel(null, 0)).toBe("Reading your resume");
  });

  it("says it is slow after 40 polls", () => {
    expect(phaseLabel("Finding your roles", 40)).toBe("Finding your roles");
    expect(phaseLabel("Finding your roles", 41).startsWith("This is taking longer")).toBe(true);
  });
});
