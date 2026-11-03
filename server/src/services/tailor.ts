import { z } from "zod";
import { resumeLineSchema, type ResumeLine } from "@auto-career/shared";
import { UNTRUSTED_RULES, untrusted } from "../ai/untrusted";
import { runAgent } from "../llm/gateway";
import { resumeTailor } from "../agents/resume-tailor/spec";
import { gatewayEnabled } from "../llm/wire";
import type { AgentCallContext } from "../agents/types";
import { checkClaims, type ClaimRule } from "../llm/claims";
import { redactContact } from "../llm/redact";
import { chatJson } from "./llm";

export interface TruthLockResult {
  kept: ResumeLine[];
  rejected: { line: ResumeLine; reason: string; rule: ClaimRule | "no_fact" | "unknown_fact" }[];
}

/**
 * The truth lock, layers 1 and 2 of B.9.6: a line survives only if it cites at least one fact, every cited id is in
 * `facts` (id to text: the user's own, confirmed facts), and checkClaims finds nothing the cited facts lack.
 * `changed` limits the claim check to lines that differ from what is stored (PATCH resends every line on every save);
 * the id check always runs, so a stored line citing a fact that was since unconfirmed still fails.
 */
export function enforceTruthLock(
  lines: ResumeLine[],
  facts: ReadonlyMap<string, string>,
  changed: (line: ResumeLine) => boolean = () => true,
): TruthLockResult {
  const kept: ResumeLine[] = [];
  const rejected: TruthLockResult["rejected"] = [];
  for (const line of lines) {
    if (line.factIds.length === 0) {
      rejected.push({ line, reason: "cites no fact", rule: "no_fact" });
      continue;
    }
    const unknown = line.factIds.filter((id) => !facts.has(id));
    if (unknown.length > 0) {
      rejected.push({ line, reason: `cites unknown facts: ${unknown.join(", ")}`, rule: "unknown_fact" });
      continue;
    }
    const [claim] = changed(line) ? checkClaims(line.text, line.factIds.map((id) => facts.get(id)!)) : [];
    if (claim) {
      rejected.push({ line, reason: `not in the cited facts: ${claim.value}`, rule: claim.rule });
      continue;
    }
    kept.push(line);
  }
  return { kept, rejected };
}

export interface FactForTailoring {
  id: string;
  kind: string;
  text: string;
}

const tailoredSchema = z.object({ lines: z.array(resumeLineSchema).min(1).max(60) });

/** Rewrites resume lines for one job, then drops any line the truth lock rejects. Contact details never reach the model. */
export async function tailorResume(
  facts: FactForTailoring[],
  job: { title: string; companyName: string; descriptionText: string },
  callCtx?: AgentCallContext,
) {
  const factTexts = new Map(facts.map((f) => [f.id, f.text]));
  if (callCtx ?? gatewayEnabled()) {
    // The gateway path (LLM_GATEWAY=anthropic); the truth lock below still owns the final word.
    const out = await runAgent(resumeTailor, { facts, job }, callCtx ?? {});
    return enforceTruthLock(out.data.lines, factTexts);
  }
  const factList = facts.map((f) => `[${f.id}] (${f.kind}) ${redactContact(f.text)}`).join("\n");
  const result = await chatJson({
    tier: "fast",
    agent: "tailor",
    schema: tailoredSchema,
    maxTokens: 2500,
    messages: [
      {
        role: "system",
        content: `Rewrite resume lines for the target job. Every line must cite the ids of the facts it uses in factIds. Never add a skill, employer, number or date that is not in the cited facts. Reply as JSON {"lines":[{"id","section","text","factIds"}]}.\n\n${UNTRUSTED_RULES}`,
      },
      {
        role: "user",
        content: `Facts:\n${factList}\n\nTarget job:\n${untrusted("job", `${job.title} at ${job.companyName}\n\n${job.descriptionText}`, 6300)}`,
      },
    ],
  });
  return enforceTruthLock(result.lines, factTexts);
}
