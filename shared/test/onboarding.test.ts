import { describe, expect, it } from "vitest";
import { applicationDetailsSchema, employmentFieldsSchema, employmentInputSchema, onboardingUpdateSchema } from "../src";

const job = { title: "Engineer", company: "Acme", location: null, startMonth: "2023-01", endMonth: null, isCurrent: false, results: [] };

describe("onboardingUpdateSchema", () => {
  it("rejects look combined with another goal", () => {
    expect(onboardingUpdateSchema.safeParse({ goals: ["look", "find"] }).success).toBe(false);
  });
  it("accepts find and build", () => {
    const r = onboardingUpdateSchema.safeParse({ goals: ["find", "build"] });
    expect(r.success && r.data.goals).toEqual(["find", "build"]);
  });
  it("caps target roles at 5 and trims", () => {
    expect(onboardingUpdateSchema.safeParse({ targetRoles: ["aa", "bb", "cc", "dd", "ee", "ff"] }).success).toBe(false);
    const r = onboardingUpdateSchema.safeParse({ targetRoles: ["  Frontend Developer "] });
    expect(r.success && r.data.targetRoles).toEqual(["Frontend Developer"]);
  });
  it("rejects an empty update", () => {
    expect(onboardingUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("employmentInputSchema", () => {
  it("rejects current job with an end month", () => {
    expect(employmentInputSchema.safeParse({ ...job, isCurrent: true, endMonth: "2024-05" }).success).toBe(false);
  });
  it("rejects start after end", () => {
    expect(employmentInputSchema.safeParse({ ...job, startMonth: "2025-01", endMonth: "2024-12" }).success).toBe(false);
  });
  it("accepts a valid job", () => {
    expect(employmentInputSchema.safeParse(job).success).toBe(true);
  });
  it("employmentFieldsSchema.partial() accepts a title-only patch", () => {
    expect(employmentFieldsSchema.partial().safeParse({ title: "Lead" }).success).toBe(true);
  });
});

describe("applicationDetailsSchema", () => {
  it("application details accept nulls", () => {
    expect(applicationDetailsSchema.safeParse({ noticePeriod: null, openToRelocation: null, expectedSalary: null }).success).toBe(true);
    expect(applicationDetailsSchema.safeParse({ noticePeriod: null, openToRelocation: null, expectedSalary: { amount: 100, currency: "inr" } }).success).toBe(false);
  });
});
