import type { ResumeWriterInput } from "./schema";
import type { RenderedPrompt } from "../types";
import { fence, userBlockNonce } from "../../llm/fence";

const SCOPE_TEXT: Record<ResumeWriterInput["scope"], string> = {
  resume: "Review the whole resume and suggest the edits that matter most.",
  section: "Improve this section: rewrite weak lines and add lines the facts support.",
  entry: "Improve this entry: rewrite weak lines and add lines from the facts that belong to it.",
  line: "Rewrite this one line. Give different rewrites, each a full replacement.",
  summary: "Write or improve the summary: one to three lines that sum up the user from the facts.",
  skills: "Suggest skills the facts show that this section lacks, one skill or a short group per line, and fix weak skill lines.",
};

const REFINE_TEXT: Record<string, string> = {
  shorter: "Make every rewrite strictly shorter than the line it replaces: cut filler, keep the facts.",
  longer: "Make rewrites fuller with context the cited facts contain; never add anything they do not.",
  result_first: "Lead each line with the result or outcome, then how it was done.",
  natural: "Use plain, natural wording a person would say; no buzzwords or stacked adjectives.",
  use_numbers: "Use the numbers the cited facts contain. Never invent, round or estimate one; when a line needs a number no fact gives, return needsFact asking for it.",
};

/**
 * Pure render: facts are the cached per-user block; the resume view, the note and the posting are
 * fenced per call (7.1). No timestamps, sorted input, so identical inputs render identically.
 */
export function renderResumeWriter(input: ResumeWriterInput, ctx: { userId?: string }): RenderedPrompt {
  const factList = [...input.facts]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => `[${f.id}] (${f.kind}) ${f.text}`)
    .join("\n");
  const factsBlock = `Confirmed facts (cite by id):\n${factList || "(none)"}`;
  const nonce = ctx.userId ? userBlockNonce(ctx.userId, 0, "resume-writer") : undefined;

  const blocks: RenderedPrompt["untrusted"] = [
    { label: "resume_lines", text: `Resume view:\n${input.resumeView}`, maxTokens: 2_000 },
  ];
  if (input.noteFact) {
    blocks.push({
      label: "user_note",
      text: `The user's own words, saved as fact ${input.noteFact.id}. Cite it only for what it says; the user confirms it before a line citing it is kept.\n[${input.noteFact.id}] (${input.noteFact.kind}) ${input.noteFact.text}`,
      maxTokens: 250,
    });
  }
  if (input.job) {
    blocks.push({
      label: "job_description",
      text: `Target job. Favour what it asks for, using only the facts:\n${input.job.title} at ${input.job.company}\n\n${input.job.descriptionText}`,
      maxTokens: 2_000,
    });
  }

  const task = [
    `Task: ${SCOPE_TEXT[input.scope]} At most ${input.maxSuggestions} suggestions.`,
    input.refine ? `Style: ${REFINE_TEXT[input.refine]}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    userBlock: {
      text: nonce ? fence("facts", factsBlock, nonce, 2_000) : factsBlock,
      label: "facts",
      ...(nonce ? { nonce } : {}),
    },
    task,
    untrusted: blocks,
  };
}
