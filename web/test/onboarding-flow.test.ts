import { describe, expect, it } from "vitest";
import type { Goal } from "@auto-career/shared";
import { addChip, countedSteps, endFor, mergeRoles, nextAction, openAt, serverStepFor, stepsFor } from "@/lib/onboarding/flow";

const base = {
  goals: [] as Goal[],
  targetRoles: [] as string[],
  onboardingStep: "goals",
  hasConfirmedFacts: false,
  hasBaseResume: false,
  hasPreferences: false,
};

describe("stepsFor", () => {
  it("look alone goes straight to done", () => {
    expect(stepsFor(["look"], null)).toEqual(["goals", "done"]);
  });
  it("find with upload", () => {
    expect(stepsFor(["find"], "upload")).toEqual(["goals", "target", "source", "upload", "rules", "done"]);
  });
  it("build has no rules", () => {
    expect(stepsFor(["build"], "form")).toEqual(["goals", "target", "source", "form", "done"]);
  });
  it("interview only", () => {
    expect(stepsFor(["interview"], null)).toEqual(["goals", "target", "source", "done"]);
  });
  it("existing source adds no sub-step", () => {
    expect(stepsFor(["build"], "existing")).toEqual(["goals", "target", "source", "done"]);
  });
  it("counted steps for find", () => {
    expect(countedSteps(stepsFor(["find"], "upload"))).toEqual(["goals", "target", "source", "rules"]);
  });
});

describe("openAt", () => {
  it("old confirm-facts user opens at the fact check as Find", () => {
    expect(openAt({ ...base, onboardingStep: "confirm-facts" })).toEqual({ goals: ["find"], step: "upload", source: "upload" });
  });
  it("no goals at resume opens at source", () => {
    expect(openAt({ ...base, onboardingStep: "resume" })).toEqual({ goals: ["find"], step: "source", source: null });
  });
  it("no goals at any other step opens at goals", () => {
    expect(openAt({ ...base, onboardingStep: "rules" })).toEqual({ goals: [], step: "goals", source: null });
  });
  it("done users open at goals with answers kept", () => {
    expect(openAt({ ...base, goals: ["build"], onboardingStep: "done" })).toEqual({ goals: ["build"], step: "goals", source: null });
  });
  it("look alone opens at done", () => {
    expect(openAt({ ...base, goals: ["look"], onboardingStep: "goals" })).toEqual({ goals: ["look"], step: "done", source: null });
  });
  it("missing roles opens at target", () => {
    expect(openAt({ ...base, goals: ["find"] }).step).toBe("target");
  });
  it("confirm-facts without a base resume reopens at upload", () => {
    expect(openAt({ ...base, goals: ["find"], targetRoles: ["X"], onboardingStep: "confirm-facts" })).toEqual({
      goals: ["find"], step: "upload", source: "upload",
    });
  });
  it("opens at the first missing step", () => {
    expect(openAt({ ...base, goals: ["build"], targetRoles: ["X"] }).step).toBe("source");
  });
  it("interview with a resume step reached and no resume opens at source", () => {
    expect(openAt({ ...base, goals: ["interview"], targetRoles: ["X"], onboardingStep: "resume" }).step).toBe("source");
  });
  it("interview past resume without a resume skips source", () => {
    expect(openAt({ ...base, goals: ["interview"], targetRoles: ["X"], onboardingStep: "rules" }).step).toBe("done");
  });
  it("find with a resume but no preferences opens at rules", () => {
    expect(openAt({ ...base, goals: ["find"], targetRoles: ["X"], hasBaseResume: true }).step).toBe("rules");
  });
  it("everything present opens at done", () => {
    expect(openAt({ ...base, goals: ["find"], targetRoles: ["X"], hasBaseResume: true, hasPreferences: true }).step).toBe("done");
  });
  it("every opened step belongs to the steps for those goals", () => {
    const steps = ["goals", "target", "resume", "confirm-facts", "rules", "done"];
    const goalSets: Goal[][] = [[], ["find"], ["build"], ["interview"], ["look"], ["find", "build"]];
    for (const goals of goalSets)
      for (const onboardingStep of steps)
        for (const targetRoles of [[], ["X"]])
          for (const hasBaseResume of [false, true])
            for (const hasPreferences of [false, true]) {
              const r = openAt({ goals, targetRoles, onboardingStep, hasConfirmedFacts: false, hasBaseResume, hasPreferences });
              expect(stepsFor(r.goals, r.source)).toContain(r.step);
            }
  });
});

describe("endFor", () => {
  it("build beats find beats interview", () => {
    expect(endFor(["find", "build"])).toEqual({ href: "/resume", others: ["find"] });
    expect(endFor(["interview", "find"]).href).toBe("/matches");
    expect(endFor(["interview"]).href).toBe("/dashboard");
    expect(endFor(["look"]).href).toBe("/dashboard");
  });
});

describe("addChip", () => {
  it("ignores case duplicates and the cap", () => {
    const list = ["Frontend Developer"];
    expect(addChip(list, " frontend  developer ", 5, 2, 80)).toEqual(list);
    const full = ["a1", "b1", "c1", "d1", "e1"];
    expect(addChip(full, "New", 5, 2, 80)).toEqual(full);
    expect(addChip(list, "A", 5, 2, 80)).toEqual(list);
    expect(addChip(list, "x".repeat(81), 5, 2, 80)).toEqual(list);
    expect(addChip(list, "  Data   Analyst ", 5, 2, 80)).toEqual(["Frontend Developer", "Data Analyst"]);
  });
});

describe("mergeRoles", () => {
  it("keeps the first list first, then the saved roles, without case or spacing duplicates, up to 10", () => {
    expect(mergeRoles(["Frontend Developer"], ["frontend  developer", "Data Analyst"])).toEqual(["Frontend Developer", "Data Analyst"]);
    const saved = Array.from({ length: 10 }, (_, i) => `Saved Role ${i}`);
    expect(mergeRoles(["Typed Role"], saved)).toEqual(["Typed Role", ...saved.slice(0, 9)]);
  });
});

describe("nextAction / serverStepFor", () => {
  it("reuse an existing base resume", () => {
    expect(nextAction({ baseResumeId: "r1" })).toBe("reuse");
    expect(nextAction({ baseResumeId: null })).toBe("create");
  });
  it("maps wizard steps to server steps", () => {
    expect(serverStepFor("upload")).toBe("resume");
    expect(serverStepFor("source")).toBe("resume");
    expect(serverStepFor("rules")).toBe("rules");
    expect(serverStepFor("goals")).toBe("goals");
  });
});
