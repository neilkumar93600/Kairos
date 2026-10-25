import type { ResumeTailorInput } from "./schema";
import type { RenderedPrompt } from "../types";
import { fence, userBlockNonce } from "../../llm/fence";

/** Pure render: the confirmed facts are the cached per-user block; the posting is fenced, uncached. */
export function renderResumeTailor(input: ResumeTailorInput, ctx: { userId?: string }): RenderedPrompt {
  const factList = input.facts.map((f) => `[${f.id}] (${f.kind}) ${f.text}`).join("\n");
  const factsBlock = `Confirmed facts (cite by id):\n${factList}`;
  const nonce = ctx.userId ? userBlockNonce(ctx.userId, 0, "resume-tailor") : undefined;
  const job = `${input.job.title} at ${input.job.companyName}\n\n${input.job.descriptionText}`;
  return {
    userBlock: {
      text: nonce ? fence("facts", factsBlock, nonce, 2_000) : factsBlock,
      label: "facts",
      ...(nonce ? { nonce } : {}),
    },
    untrusted: [{ label: "job_description", text: job, maxTokens: 2_000 }],
  };
}
