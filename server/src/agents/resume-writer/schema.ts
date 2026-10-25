import { z } from "zod";
import { FACT_KINDS, SUGGESTION_SCOPES, REFINE_OPTIONS } from "@auto-career/shared";

export const ResumeWriterInput = z.object({
  scope: z.enum(SUGGESTION_SCOPES),
  refine: z.enum(REFINE_OPTIONS).nullable(),
  /** The part of the resume the scope shows, already rendered with ids by the service. */
  resumeView: z.string().min(1).max(12_000),
  /** Confirmed facts, id, kind and text. Only these may be cited. */
  facts: z.array(z.object({ id: z.string().min(1), kind: z.string().min(1).max(40), text: z.string().min(1).max(400) })).max(60),
  /** The user's note, saved as an unconfirmed fact; citable only for what it says (spec 2.5). */
  noteFact: z.object({ id: z.string().min(1), kind: z.string().min(1).max(40), text: z.string().min(1).max(400) }).nullable(),
  job: z.object({ title: z.string().min(1).max(200), company: z.string().min(1).max(200), descriptionText: z.string().min(1).max(20_000) }).nullable(),
  maxSuggestions: z.number().int().min(1).max(15),
});
export type ResumeWriterInput = z.infer<typeof ResumeWriterInput>;

// No length limits here: structured outputs drop them. Lengths are enforced in code by the service.
export const ResumeWriterOutput = z.object({
  suggestions: z.array(
    z.object({
      sectionId: z.string(),
      entryId: z.string().nullable(),
      lineId: z.string().nullable(),
      action: z.enum(["rewrite", "add", "remove"]),
      after: z.string().nullable(),
      why: z.string(),
      factIds: z.array(z.string()),
      needsFact: z.object({ kind: z.enum(FACT_KINDS), question: z.string() }).nullable(),
    }),
  ),
});
export type ResumeWriterOutput = z.infer<typeof ResumeWriterOutput>;

export const suggestionScopes = SUGGESTION_SCOPES;
export type WriterScope = (typeof SUGGESTION_SCOPES)[number];
