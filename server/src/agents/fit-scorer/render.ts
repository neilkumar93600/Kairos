import type { FitScorerInput } from "./schema";
import type { RenderedPrompt } from "../types";
import { fenceUserBlock } from "../../llm/fence";

/**
 * Pure render (B.2 rule 5): no I/O, no time, no randomness beyond fence nonces (the profile block's is per call only
 * when there is no userId). The profile block is byte-identical for the same user, so the cached prefix holds.
 */
export function renderFitScorer(input: FitScorerInput, ctx: { userId?: string }): RenderedPrompt {
  const profile = `Candidate summary:\n${input.profileSummary}`;
  const job = `${input.job.title} at ${input.job.companyName}\nLocation: ${input.job.location ?? "unspecified"}${input.job.remote ? " (remote)" : ""}\n\n${input.job.descriptionText}`;
  return {
    userBlock: fenceUserBlock("profile", profile, "fit-scorer", ctx),
    untrusted: [{ label: "job_description", text: job, maxTokens: 2_100 }],
  };
}
