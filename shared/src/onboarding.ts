/** Onboarding wizard contracts: goals, steps, target roles, employment entries, application details. */
import { z } from "zod";

export const GOALS = ["find", "build", "interview", "look"] as const;
export type Goal = (typeof GOALS)[number];

export const ONBOARDING_STEPS = ["goals", "target", "resume", "confirm-facts", "rules", "template", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const goalsSchema = z
  .array(z.enum(GOALS))
  .min(1)
  .max(4)
  .refine((g) => new Set(g).size === g.length, { message: "goals must be unique" })
  .refine((g) => !g.includes("look") || g.length === 1, { message: "look stands alone" });

export const onboardingUpdateSchema = z
  .object({
    goals: goalsSchema,
    targetRoles: z.array(z.string().trim().min(2).max(80)).max(5),
    targetCompanies: z.array(z.string().trim().min(1).max(120)).max(10),
    step: z.enum(ONBOARDING_STEPS),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field is required" });
export type OnboardingUpdate = z.infer<typeof onboardingUpdateSchema>;

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "expected YYYY-MM");

// Plain object so Task 4's PATCH can `.partial()` it (zod 4 refuses .partial() on a refined object).
export const employmentFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().max(120).nullable(),
  startMonth: month.nullable(),
  endMonth: month.nullable(),
  isCurrent: z.boolean(),
  results: z.array(z.string().trim().min(3).max(400)).max(20),
});

export const employmentInputSchema = employmentFieldsSchema
  .refine((e) => !(e.isCurrent && e.endMonth), { message: "a current job has no end month", path: ["endMonth"] })
  .refine((e) => !(e.startMonth && e.endMonth) || e.startMonth <= e.endMonth, {
    message: "start must not be after end",
    path: ["startMonth"],
  });
export type EmploymentInput = z.infer<typeof employmentInputSchema>;

export const applicationDetailsSchema = z.object({
  noticePeriod: z.enum(["immediate", "2_weeks", "1_month", "2_months_plus"]).nullable(),
  openToRelocation: z.boolean().nullable(),
  expectedSalary: z
    .object({ amount: z.number().int().min(0).max(10_000_000), currency: z.string().regex(/^[A-Z]{3}$/) })
    .nullable(),
});
export type ApplicationDetails = z.infer<typeof applicationDetailsSchema>;

export type OnboardingState = {
  goals: Goal[];
  targetRoles: string[];
  targetCompanies: string[];
  onboardingStep: OnboardingStep;
};
