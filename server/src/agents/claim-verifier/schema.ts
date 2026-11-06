import { z } from "zod";

/**
 * The claim wire format (agents/08-claim-verifier.md 3, 4), shared with claim-verifier-escalation. Claims and facts
 * travel under opaque per-call refs (c01.., f1..) that services/verify.ts assigns after shuffling; real fact ids, user
 * ids and which agent wrote a claim never reach the model.
 */
export const CLAIM_ID = /^c(0[1-9]|[1-3][0-9]|40)$/;
export const FACT_REF = /^f([1-9]|[1-5][0-9]|6[0-4])$/;

export const VERDICTS = ["supported", "unsupported", "contradicted", "uncertain"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const ClaimVerifierInput = z
  .object({
    claims: z
      .array(
        z
          .object({
            id: z.string().regex(CLAIM_ID),
            /** resume_line: lines, builder suggestions, headlines. prose: answers and letter paragraphs. */
            kind: z.enum(["resume_line", "prose"]),
            text: z.string().min(1).max(1_500),
            factRefs: z.array(z.string().regex(FACT_REF)).min(1).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    /** Only facts cited by at least one claim, under opaque refs. */
    facts: z.array(z.object({ ref: z.string().regex(FACT_REF), text: z.string().min(1).max(400) }).strict()).min(1).max(64),
    /** Prose may name the target employer and role without a fact. Null for resume lines only. */
    target: z.object({ companyName: z.string().max(200), jobTitle: z.string().max(200) }).strict().nullable(),
  })
  .strict();
export type ClaimVerifierInput = z.infer<typeof ClaimVerifierInput>;

/** No free-text field at all: the reply cannot carry an echo or an instruction, only ids and a closed verdict set. */
export const ClaimVerifierOutput = z
  .object({
    verdicts: z
      .array(
        z
          .object({
            claimId: z.string(),
            verdict: z.enum(VERDICTS),
            /** supported: the fact carrying most of the claim; contradicted: the contradicting fact; otherwise null. */
            factRef: z.string().nullable(),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();
export type ClaimVerifierOutput = z.infer<typeof ClaimVerifierOutput>;
