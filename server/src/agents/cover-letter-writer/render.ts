import type { CoverLetterInput } from "./schema";
import type { RenderedPrompt } from "../types";
import { fenceUserBlock } from "../../llm/fence";

/** Pure render: facts are the cached per-user block; the posting is fenced per call. */
export function renderCoverLetter(input: CoverLetterInput, ctx: { userId?: string }): RenderedPrompt {
  const factList = input.facts.map((f) => `[${f.id}] (${f.kind}) ${f.text}`).join("\n");
  const factsBlock = `Facts:\n${factList || "(none)"}`;
  return {
    userBlock: fenceUserBlock("facts", factsBlock, "cover-letter-writer", ctx),
    untrusted: [
      {
        label: "job_description",
        text: `Target job:\n${input.job.title} at ${input.job.company}\n\n${input.job.descriptionText}`,
        maxTokens: 2_000,
      },
    ],
  };
}
