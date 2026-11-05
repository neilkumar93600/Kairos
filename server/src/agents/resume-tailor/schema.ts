import { z } from "zod";
import { resumeLineSchema } from "@auto-career/shared";
import { doNotClaim } from "../truth-repair";

export const ResumeTailorInput = z.object({
  /** The user's confirmed facts, id, kind and text. Only these may be cited. */
  facts: z
    .array(z.object({ id: z.string().min(1), kind: z.string().min(1).max(40), text: z.string().min(1).max(400) }))
    .min(1)
    .max(60),
  job: z.object({
    title: z.string().min(1).max(200),
    companyName: z.string().min(1).max(200),
    descriptionText: z.string().min(1).max(20_000),
  }),
  /** Truth repair only (WP-26): lines verification dropped, which the repaired lines must not repeat. */
  doNotClaim: doNotClaim(400, 20),
});
export type ResumeTailorInput = z.infer<typeof ResumeTailorInput>;

export const ResumeTailorOutput = z.object({
  lines: z.array(resumeLineSchema).min(1).max(60),
});
export type ResumeTailorOutput = z.infer<typeof ResumeTailorOutput>;
