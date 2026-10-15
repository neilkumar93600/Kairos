import { z } from "zod";
import { resumeLineSchema, type ResumeLine } from "@auto-career/shared";
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
export async function tailorResume(facts: FactForTailoring[], job: { title: string; companyName: string; descriptionText: string }) {
  const factList = facts.map((f) => `[${f.id}] (${f.kind}) ${f.text}`).join("\n");
  const result = await chatJson({
    tier: "smart",
    schema: tailoredSchema,
    maxTokens: 2500,
    messages: [
      {
        role: "system",
        content:
          'Rewrite resume lines for the target job. Every line must cite the ids of the facts it uses in factIds. Never add a skill, employer, number or date that is not in the cited facts. Reply as JSON {"lines":[{"id","section","text","factIds"}]}.',
      },
      {
        role: "user",
        content: `Facts:\n${factList}\n\nTarget job: ${job.title} at ${job.companyName}\n${job.descriptionText.slice(0, 6000)}`,
      },
    ],
  });
  return enforceTruthLock(result.lines, new Set(facts.map((f) => f.id)));
}
