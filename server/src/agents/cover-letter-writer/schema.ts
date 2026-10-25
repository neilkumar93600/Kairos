import { z } from "zod";

export const CoverLetterInput = z.object({
  facts: z.array(z.object({ id: z.string().min(1), kind: z.string().min(1).max(40), text: z.string().min(1).max(400) })).max(60),
  job: z.object({ title: z.string().min(1).max(200), company: z.string().min(1).max(200), descriptionText: z.string().min(1).max(20_000) }),
});
export type CoverLetterInput = z.infer<typeof CoverLetterInput>;

export const CoverLetterOutput = z.object({
  paragraphs: z.array(z.object({ text: z.string().min(1).max(5_000), factIds: z.array(z.string()).max(30) })).min(1).max(12),
});
export type CoverLetterOutput = z.infer<typeof CoverLetterOutput>;
