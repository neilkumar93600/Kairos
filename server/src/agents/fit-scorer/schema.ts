import { z } from "zod";

export const FitScorerInput = z.object({
  /** The user's profile summary: roles, seniority, skills, years. Contact details never reach the model. */
  profileSummary: z.string().min(1).max(6_000),
  job: z.object({
    title: z.string().min(1).max(200),
    companyName: z.string().min(1).max(200),
    location: z.string().max(200).nullable(),
    remote: z.boolean(),
    descriptionText: z.string().min(1).max(20_000),
  }),
});
export type FitScorerInput = z.infer<typeof FitScorerInput>;

export const FitScorerOutput = z.object({
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().min(1).max(200)).min(1).max(4),
});
export type FitScorerOutput = z.infer<typeof FitScorerOutput>;
