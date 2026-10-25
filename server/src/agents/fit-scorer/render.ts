import type { FitScorerInput } from "./schema";
import type { RenderedPrompt } from "../types";
import { fence, userBlockNonce } from "../../llm/fence";

/**
 * Pure render (B.2 rule 5): no I/O, no time, no randomness beyond the per-call fence nonce the
 * gateway adds. The profile block is byte-identical for the same user, so the cached prefix holds.
 */
export function renderFitScorer(input: FitScorerInput, ctx: { userId?: string }): RenderedPrompt {
  const profile = `Candidate summary:\n${input.profileSummary}`;
  const job = `${input.job.title} at ${input.job.companyName}\nLocation: ${input.job.location ?? "unspecified"}${input.job.remote ? " (remote)" : ""}\n\n${input.job.descriptionText}`;
  return {
    userBlock: {
      text: ctx.userId ? fence("profile", profile, userBlockNonce(ctx.userId, 0, "fit-scorer"), 2_000) : profile,
      label: "profile",
      ...(ctx.userId ? { nonce: userBlockNonce(ctx.userId, 0, "fit-scorer") } : {}),
    },
    untrusted: [{ label: "job_description", text: job, maxTokens: 2_100 }],
  };
}
