import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("keeps same-site paths with their query and hash", () => {
    expect(safeNext("/matches?status=new#top")).toBe("/matches?status=new#top");
    expect(safeNext("/")).toBe("/");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNext(bad)).toBe("/dashboard");
    }
  });

  it("uses the given fallback", () => {
    expect(safeNext("//evil.com", "/onboarding")).toBe("/onboarding");
  });
});
