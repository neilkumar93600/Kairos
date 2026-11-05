import { z } from "zod";
import { FACT_KINDS, REFINE_OPTIONS, RESUME_LEVELS, RESUME_SUGGESTION_SCOPES, SUGGESTION_PRIORITIES, SUGGESTION_SCOPES, SUGGESTION_TAGS } from "@auto-career/shared";
import { doNotClaim } from "../truth-repair";

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

/** v2 (agents/05 3): a second spec object, because the input changes (agents/03 9). Only code writes level and derived. */
export const ResumeWriterInputV2 = z
  .object({
    scope: z.enum(RESUME_SUGGESTION_SCOPES),
    refine: z.enum(REFINE_OPTIONS).nullable(),
    level: z.enum(RESUME_LEVELS),
    resumeView: z.string().min(1).max(12_000),
    facts: z.array(z.object({ id: z.string().min(1), kind: z.string().min(1).max(40), text: z.string().min(1).max(400) }).strict()).max(60),
    noteFact: z.object({ id: z.string().min(1), kind: z.string().min(1).max(40), text: z.string().min(1).max(400) }).strict().nullable(),
    job: z.object({ title: z.string().min(1).max(200), company: z.string().min(1).max(200), descriptionText: z.string().min(1).max(20_000) }).strict().nullable(),
    /** Headline scope: the current headline, fenced with the view. */
    headline: z.string().max(160).nullable(),
    /** Headline scope: values computed in code (rule 10). Never rendered; the model learns only that one exists. */
    derived: z.array(z.object({ label: z.literal("years_of_experience"), value: z.number().int().min(1).max(60), factIds: z.array(z.string()).min(1) }).strict()).max(1),
    maxSuggestions: z.number().int().min(1).max(20),
    /** Statements that failed the truth check (truth-repair.ts). The rule itself is rule 9 of the static prompt. */
    doNotClaim: doNotClaim(400, 20),
  })
  .strict();
export type ResumeWriterInputV2 = z.infer<typeof ResumeWriterInputV2>;

export const ResumeWriterOutputV2 = z
  .object({
    suggestions: z.array(
      z
        .object({
          sectionId: z.string(),
          entryId: z.string().nullable(),
          lineId: z.string().nullable(),
          action: z.enum(["rewrite", "add", "remove"]),
          after: z.string().nullable(),
          why: z.string(),
          factIds: z.array(z.string()),
          needsFact: z.object({ kind: z.enum(FACT_KINDS), question: z.string() }).strict().nullable(),
          tag: z.enum(SUGGESTION_TAGS),
          priority: z.enum(SUGGESTION_PRIORITIES),
          appendYears: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export type ResumeWriterOutputV2 = z.infer<typeof ResumeWriterOutputV2>;
