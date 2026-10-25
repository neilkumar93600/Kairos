import { answerDrafter } from "./answer-drafter/spec";
import { coverLetterWriter } from "./cover-letter-writer/spec";
import { fitScorer } from "./fit-scorer/spec";
import { resumeParser } from "./resume-parser/spec";
import { resumeTailor } from "./resume-tailor/spec";
import { resumeWriter } from "./resume-writer/spec";
import type { AgentId, AgentSpec } from "./types";

/**
 * The registry (03-agent-runtime.md 3.4). Six migrated agents at v1 in P1; jd-analyst,
 * claim-verifier, claim-verifier-escalation join in P3, reply-classifier, outcome-analyst and
 * interview-coach in P6. Modules call agents only through runAgent(getAgent(id), input, ctx).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the registry erases the pair's input/output types; callers use getAgent<K>
type AnyAgentSpec = AgentSpec<any, any>;

export type RegisteredAgent = Extract<AgentId, "fit-scorer" | "resume-parser" | "resume-tailor" | "resume-writer" | "answer-drafter" | "cover-letter-writer">;

export const AGENTS = {
  "fit-scorer": fitScorer,
  "resume-parser": resumeParser,
  "resume-tailor": resumeTailor,
  "resume-writer": resumeWriter,
  "answer-drafter": answerDrafter,
  "cover-letter-writer": coverLetterWriter,
} as const satisfies Record<RegisteredAgent, AnyAgentSpec>;

export function getAgent<K extends RegisteredAgent>(id: K): (typeof AGENTS)[K] {
  return AGENTS[id];
}
