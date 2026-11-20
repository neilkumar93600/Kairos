import { z } from "zod";
import type { RenderedPrompt } from "./types";

/**
 * The truth repair of 01-architecture B.9.6 (WP-26): after verification drops items, the drafting agent is called once
 * more (`callKind: "truth_repair"`) with what was dropped as `doNotClaim`. The dropped text is model output steered by
 * employer text (T2), so it is fenced as `claims`; the instruction is a fixed task line written by Kairos.
 * ponytail: the rule lives in the task line, not the agents' v1 system prompts, so v1's fingerprints and recorded
 * fixtures stay valid; the v2 prompts (WP-41, WP-31) move it into the static text.
 */
export const doNotClaim = (maxText: number, maxItems: number) =>
  z
    .array(z.object({ text: z.string().min(1).max(maxText), rule: z.string().min(1).max(40) }).strict())
    .max(maxItems)
    .nullable()
    .optional();

export type DoNotClaim = { text: string; rule: string }[];

export const TRUTH_REPAIR_TASK =
  "Truth repair: the statements in the claims block failed the truth check, each with the rule it broke. Write your output again. Do not repeat any of those statements, and do not repeat the detail that failed in other words; leave out anything the cited facts do not state.";

/** The task line and fenced block a render adds when the input carries a doNotClaim list. */
export function renderDoNotClaim(list: DoNotClaim | null | undefined): Pick<RenderedPrompt, "task" | "untrusted"> {
  if (!list?.length) return { untrusted: [] };
  return {
    task: TRUTH_REPAIR_TASK,
    untrusted: [{ label: "claims", text: list.map((d) => `- (${d.rule}) ${d.text.replace(/\s+/g, " ")}`).join("\n"), maxTokens: 600 }],
  };
}
