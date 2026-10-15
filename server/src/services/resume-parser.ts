import { z } from "zod";
import { FACT_KINDS } from "@auto-career/shared";
import { chatJson } from "./llm";

const parsedFactsSchema = z.object({
  facts: z
    .array(z.object({ kind: z.enum(FACT_KINDS), text: z.string().min(3).max(400), sourceSpan: z.string().max(400) }))
    .min(1)
    .max(200),
});
export type ParsedFact = z.infer<typeof parsedFactsSchema>["facts"][number];

/** Splits resume text into atomic facts the user confirms during onboarding. */
export async function parseResumeToFacts(resumeText: string): Promise<ParsedFact[]> {
  const result = await chatJson({
    tier: "smart",
    schema: parsedFactsSchema,
    maxTokens: 4000,
    messages: [
      {
        role: "system",
        content: `Split this resume into atomic facts. kind is one of ${FACT_KINDS.join(", ")}. text restates one fact in plain words. sourceSpan quotes the resume words it came from. Do not infer anything that is not written. Reply as JSON {"facts":[...]}.`,
      },
      { role: "user", content: resumeText.slice(0, 20000) },
    ],
  });
  return result.facts;
}
