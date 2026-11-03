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

/**
 * Agents with a written spec but no build (WP-49). Disabled by construction: they have no AgentSpec, getAgent only
 * accepts RegisteredAgent, so nothing can call them. The satisfies clause makes every AgentId either registered or
 * listed here, never both; the package that builds one adds its spec.ts to AGENTS and deletes its line here.
 * `spec` is relative to docs/superpowers/specs/2026-10-15-kairos-backend-design/.
 */
export const PLANNED_AGENTS = {
  "jd-analyst": { spec: "agents/02-jd-analyst.md", landsIn: "WP-41" },
  "claim-verifier": { spec: "agents/08-claim-verifier.md", landsIn: "WP-26" },
  "claim-verifier-escalation": { spec: "agents/09-claim-verifier-escalation.md", landsIn: "WP-26" },
  "reply-classifier": { spec: "agents/10-reply-classifier.md", landsIn: "WP-40" },
  "outcome-analyst": { spec: "agents/11-outcome-analyst.md", landsIn: "WP-40" },
  "interview-coach": { spec: "agents/12-interview-coach.md", landsIn: "WP-40" },
} as const satisfies Record<Exclude<AgentId, RegisteredAgent>, { spec: string; landsIn: string }>;
