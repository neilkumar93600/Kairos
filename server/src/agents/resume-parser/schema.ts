import { z } from "zod";
import { FACT_KINDS } from "@auto-career/shared";

export const ResumeParserInput = z.object({
  /** The resume text, contact header already redacted by the caller (10.2). */
  resumeText: z.string().min(1).max(30_000),
});
export type ResumeParserInput = z.infer<typeof ResumeParserInput>;

export const ResumeParserOutput = z.object({
  facts: z
    .array(
      z.object({
        kind: z.enum(FACT_KINDS),
        text: z.string().min(3).max(400),
        sourceSpan: z.string().min(1).max(400),
      }),
    )
    .min(1)
    .max(200),
});
export type ResumeParserOutput = z.infer<typeof ResumeParserOutput>;
