import { z } from "zod";
import { resumeLineSchema, type ResumeLine } from "@auto-career/shared";
import { UNTRUSTED_RULES, untrusted } from "../ai/untrusted";
import { runAgent } from "../llm/gateway";
import { resumeTailor } from "../agents/resume-tailor/spec";
import { gatewayEnabled } from "../llm/wire";
import type { AgentCallContext } from "../agents/types";
import { chatJson } from "./llm";

export interface TruthLockResult {
  kept: ResumeLine[];
  rejected: { line: ResumeLine; reason: string }[];
}

/**
 * The truth lock: a tailored line survives only if every fact it cites belongs to this user.
 * Lines citing nothing, or citing unknown fact ids, are dropped and reported.
 */
export function enforceTruthLock(lines: ResumeLine[], allowedFactIds: ReadonlySet<string>): TruthLockResult {
  const kept: ResumeLine[] = [];
  const rejected: TruthLockResult["rejected"] = [];
  for (const line of lines) {
    if (line.factIds.length === 0) {
      rejected.push({ line, reason: "cites no fact" });
      continue;
    }
    const unknown = line.factIds.filter((id) => !allowedFactIds.has(id));
    if (unknown.length > 0) {
      rejected.push({ line, reason: `cites unknown facts: ${unknown.join(", ")}` });
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

/** Rewrites resume lines for one job, then drops any line the truth lock rejects. */
export async function tailorResume(
  facts: FactForTailoring[],
  job: { title: string; companyName: string; descriptionText: string },
  callCtx?: AgentCallContext,
) {
  if (callCtx ?? gatewayEnabled()) {
    // The gateway path (LLM_GATEWAY=anthropic); the truth lock below still owns the final word.
    const out = await runAgent(resumeTailor, { facts, job }, callCtx ?? {});
    return enforceTruthLock(out.data.lines, new Set(facts.map((f) => f.id)));
  }
  const factList = facts.map((f) => `[${f.id}] (${f.kind}) ${f.text}`).join("\n");
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
  return enforceTruthLock(result.lines, new Set(facts.map((f) => f.id)));
}
