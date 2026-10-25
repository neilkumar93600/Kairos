import { z } from "zod";
import { FACT_KINDS } from "@auto-career/shared";
import { runAgent } from "../llm/gateway";
import { resumeParser } from "../agents/resume-parser/spec";
import { gatewayEnabled } from "../llm/wire";
import type { AgentCallContext } from "../agents/types";
import { chatJson } from "./llm";

const parsedFactsSchema = z.object({
  facts: z
    .array(z.object({ kind: z.enum(FACT_KINDS), text: z.string().min(3).max(400), sourceSpan: z.string().max(400) }))
    .min(1)
    .max(200),
});
export type ParsedFact = z.infer<typeof parsedFactsSchema>["facts"][number];

/** Splits resume text into atomic facts the user confirms during onboarding. */
export async function parseResumeToFacts(resumeText: string, callCtx?: AgentCallContext): Promise<ParsedFact[]> {
  if (callCtx ?? gatewayEnabled()) {
    // The gateway path (LLM_GATEWAY=anthropic). Contact redaction joins when the route passes the
    // profile (10.2); the resume arrives fenced already.
    const out = await runAgent(resumeParser, { resumeText }, callCtx ?? {});
    return out.data.facts;
  }
  const result = await chatJson({
    tier: "fast",
    agent: "resume-parser",
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
