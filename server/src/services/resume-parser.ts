import { z } from "zod";
import { FACT_KINDS } from "@auto-career/shared";
import { runAgent } from "../llm/gateway";
import { resumeParser } from "../agents/resume-parser/spec";
import { gatewayEnabled } from "../llm/wire";
import { dropSensitiveLines, redactResumeHeader } from "../llm/redact";
import { UNTRUSTED_RULES, untrusted } from "../ai/untrusted";
import type { AgentCallContext } from "../agents/types";
import { chatJson } from "./llm";

const parsedFactsSchema = z.object({
  facts: z
    .array(z.object({ kind: z.enum(FACT_KINDS), text: z.string().min(3).max(400), sourceSpan: z.string().max(400) }))
    .min(1)
    .max(200),
});
export type ParsedFact = z.infer<typeof parsedFactsSchema>["facts"][number];

export type ResumeContact = Parameters<typeof redactResumeHeader>[1];

/** Characters of the redacted resume either path sends; the gateway's render may cut deeper by tokens, never longer. */
export const PARSER_INPUT_CHARS = 20_000;

/**
 * Exactly the text the model is given: personal-details lines dropped, the contact header redacted, cut to
 * PARSER_INPUT_CHARS. The parse job checks containment against this same string, so text the model never read cannot
 * ground a fact (Security-reviewer-B).
 */
export const parserInput = (rawText: string, contact: ResumeContact): string =>
  redactResumeHeader(dropSensitiveLines(rawText), contact).slice(0, PARSER_INPUT_CHARS);

/**
 * Splits resume text into atomic facts the user confirms during onboarding. Before either path sees it, the resume
 * loses its personal-details lines and its contact header (10.2, CISO mustFix 6); `contact` is required so no caller
 * can skip that.
 */
export async function parseResumeToFacts(rawText: string, contact: ResumeContact, callCtx?: AgentCallContext): Promise<ParsedFact[]> {
  const resumeText = parserInput(rawText, contact);
  if (callCtx ?? gatewayEnabled()) {
    // The gateway path (LLM_GATEWAY=anthropic); the render fences the redacted text.
    const out = await runAgent(resumeParser, { resumeText }, callCtx ?? {}); // the render fences and may cut deeper
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
        content: `Split this resume into atomic facts. kind is one of ${FACT_KINDS.join(", ")}. text restates one fact in plain words. sourceSpan quotes the resume words it came from. Do not infer anything that is not written. Reply as JSON {"facts":[...]}.\n\n${UNTRUSTED_RULES}`,
      },
      // Fenced like every legacy agent's third-party text: an uploaded file can carry hidden instructions (WP-17 review).
      { role: "user", content: untrusted("resume", resumeText, PARSER_INPUT_CHARS) },
    ],
  });
  return result.facts;
}
