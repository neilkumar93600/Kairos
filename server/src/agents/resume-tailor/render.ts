import type { ResumeTailorInput } from "./schema";
import type { RenderedPrompt } from "../types";
import { fenceUserBlock } from "../../llm/fence";
import { redactContact } from "../../llm/redact";
import { renderDoNotClaim } from "../truth-repair";

/** Pure render: the confirmed facts, contact details redacted (10.1 P2), are the cached per-user block; the posting is fenced, uncached. */
export function renderResumeTailor(input: ResumeTailorInput, ctx: { userId?: string }): RenderedPrompt {
  const factList = input.facts.map((f) => `[${f.id}] (${f.kind}) ${redactContact(f.text)}`).join("\n");
  const factsBlock = `Confirmed facts (cite by id):\n${factList}`;
  const job = `${input.job.title} at ${input.job.companyName}\n\n${input.job.descriptionText}`;
  const repair = renderDoNotClaim(input.doNotClaim);
  return {
    userBlock: fenceUserBlock("facts", factsBlock, "resume-tailor", ctx),
    ...(repair.task ? { task: repair.task } : {}),
    untrusted: [{ label: "job_description", text: job, maxTokens: 2_000 }, ...repair.untrusted],
  };
}
