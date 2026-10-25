import type { CoverLetterInput } from "./schema";
import type { RenderedPrompt } from "../types";
import { fence, userBlockNonce } from "../../llm/fence";

/** Pure render: facts are the cached per-user block; the posting is fenced per call. */
export function renderCoverLetter(input: CoverLetterInput, ctx: { userId?: string }): RenderedPrompt {
  const factList = input.facts.map((f) => `[${f.id}] (${f.kind}) ${f.text}`).join("\n");
  const factsBlock = `Facts:\n${factList || "(none)"}`;
  const nonce = ctx.userId ? userBlockNonce(ctx.userId, 0, "cover-letter-writer") : undefined;
  return {
    userBlock: {
      text: nonce ? fence("facts", factsBlock, nonce, 2_000) : factsBlock,
      label: "facts",
      ...(nonce ? { nonce } : {}),
    },
    untrusted: [
      {
        label: "job_description",
        text: `Target job:\n${input.job.title} at ${input.job.company}\n\n${input.job.descriptionText}`,
        maxTokens: 2_000,
      },
    ],
  };
}
