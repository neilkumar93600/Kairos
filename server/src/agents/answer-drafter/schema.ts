import { z } from "zod";

export const AnswerDrafterInput = z.object({
  /** The question label from the employer's form. Sensitive labels never reach this agent (B.9.9). */
  label: z.string().min(1).max(500),
  facts: z.array(z.object({ id: z.string().min(1), kind: z.string().min(1).max(40), text: z.string().min(1).max(400) })).max(60),
  /** Answers the user approved before, shown only to match their voice. */
  savedAnswers: z.array(z.object({ label: z.string().min(1).max(500), answer: z.string().min(1).max(5_000) })).max(20).nullable(),
  job: z.object({ title: z.string().min(1).max(200), company: z.string().min(1).max(200), descriptionText: z.string().min(1).max(20_000) }),
});
export type AnswerDrafterInput = z.infer<typeof AnswerDrafterInput>;

export const AnswerDrafterOutput = z.object({
  text: z.string().min(1).max(5_000),
  factIds: z.array(z.string()).max(30),
});
export type AnswerDrafterOutput = z.infer<typeof AnswerDrafterOutput>;
