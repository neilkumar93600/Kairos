import type { AnswerDrafterInput } from "./schema";
import type { RenderedPrompt } from "../types";
import { fenceUserBlock } from "../../llm/fence";

/** Pure render: facts are the cached per-user block; question, saved answers and posting are fenced. */
export function renderAnswerDrafter(input: AnswerDrafterInput, ctx: { userId?: string }): RenderedPrompt {
  const factList = input.facts.map((f) => `[${f.id}] (${f.kind}) ${f.text}`).join("\n");
  const factsBlock = `Facts:\n${factList || "(none)"}`;

  const blocks: RenderedPrompt["untrusted"] = [
    { label: "form_questions", text: `Question:\n${input.label}`, maxTokens: 180 },
    {
      label: "job_description",
      text: `Target job:\n${input.job.title} at ${input.job.company}\n\n${input.job.descriptionText}`,
      maxTokens: 2_000,
    },
  ];
  if (input.savedAnswers?.length) {
    blocks.push({
      label: "saved_answers",
      text: `Answers the user approved before (match their voice):\n${input.savedAnswers.map((s) => `- ${s.label}: ${s.answer}`).join("\n")}`,
      maxTokens: 1_000,
    });
  }

  return {
    userBlock: fenceUserBlock("facts", factsBlock, "answer-drafter", ctx),
    untrusted: blocks,
  };
}
