import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENTS, LATER_VERSIONS, PLANNED_AGENTS } from "../../src/agents/registry";
import { promptAsset } from "../../src/agents/prompt-asset";
import { estimateCallUsd } from "../../src/llm/estimate";
import type { ClaudeModel } from "../../src/agents/types";

const here = join(import.meta.dirname ?? ".");

/** The registry checks of 03-agent-runtime.md 3.4, P1 scope. */
describe("agent registry", () => {
  const lock = JSON.parse(readFileSync(join(here, "..", "..", "src", "agents", "prompts.lock.json"), "utf8")) as Record<
    string,
    { active: number; versions: Record<string, string> }
  >;

  it("prompt text and fingerprints ignore CRLF, so Windows and Linux checkouts agree", () => {
    const crlf = promptAsset("x", 1, "a\r\nb", {});
    expect(crlf.fingerprint).toBe(promptAsset("x", 1, "a\nb", {}).fingerprint);
    expect(crlf.system).toBe("a\nb");
  });

  it("registers the six P1 agents and the two verifiers", () => {
    expect(Object.keys(AGENTS).sort()).toEqual(
      ["answer-drafter", "claim-verifier", "claim-verifier-escalation", "cover-letter-writer", "fit-scorer", "resume-parser", "resume-tailor", "resume-writer"].sort(),
    );
  });

  it("every agent id is registered or planned, never both, and each planned agent has its spec on disk", () => {
    const allIds = [
      "resume-parser", "jd-analyst", "fit-scorer", "resume-tailor", "resume-writer", "answer-drafter",
      "cover-letter-writer", "claim-verifier", "claim-verifier-escalation", "reply-classifier", "outcome-analyst", "interview-coach",
    ];
    expect([...Object.keys(AGENTS), ...Object.keys(PLANNED_AGENTS)].sort()).toEqual([...allIds].sort());
    const specDir = join(here, "..", "..", "..", "docs", "superpowers", "specs", "2026-10-15-kairos-backend-design");
    for (const [id, planned] of Object.entries(PLANNED_AGENTS)) {
      expect(existsSync(join(specDir, planned.spec)), `${id} spec ${planned.spec}`).toBe(true);
      expect(id in AGENTS, `${id} is planned, so it must not be callable`).toBe(false);
    }
  });

  // agents/03 9: the checks run on the second spec object of a version too, while both exist. The lock's `active` is the AGENTS entry's.
  for (const spec of [...Object.values(AGENTS), ...LATER_VERSIONS] as (typeof AGENTS)[keyof typeof AGENTS][]) {
    const id = LATER_VERSIONS.includes(spec) ? `${spec.id}@v${spec.promptVersion}` : spec.id;
    const activePrompt = spec.prompts[spec.promptVersion]!;
    it(`${id}: the active prompt exists and the lock matches the computed fingerprints`, () => {
      expect(activePrompt, `${id} has a prompt for its active version`).toBeDefined();
      expect(lock[spec.id]!.active).toBe(AGENTS[spec.id as keyof typeof AGENTS].promptVersion);
      for (const [version, asset] of Object.entries(spec.prompts)) {
        const fresh = promptAsset(spec.id, Number(version), asset.system, spec.schemaSnapshot).fingerprint;
        expect(lock[spec.id]!.versions[version], `${id}@v${version} fingerprint must match the lock`).toBe(fresh);
      }
    });

    it(`${id}: static text is at least 2,400 bytes, above the 512-token cache minimum`, () => {
      const bytes = Buffer.byteLength(activePrompt.system, "utf8");
      expect(bytes).toBeGreaterThanOrEqual(2_400);
    });

    it(`${id}: maxCostPerCallUsd covers the worst-case estimate`, () => {
      const maxTokens = typeof spec.maxTokens === "function" ? (spec.maxTokens as (i: never) => number)(maxInputFor(spec) as never) : spec.maxTokens;
      expect(spec.maxCostPerCallUsd).toBeGreaterThanOrEqual(estimateCallUsd(spec.maxInputTokens, maxTokens, spec.model));
      if (spec.tierUp) {
        expect(spec.tierUp.maxCostPerCallUsd).toBeGreaterThanOrEqual(estimateCallUsd(spec.maxInputTokens, maxTokens, "claude-sonnet-5-5"));
      }
    });

    it(`${id}: never batch-eligible for personal data, and models are production models`, () => {
      expect(spec.batchEligible).not.toBe("if_zdr_allows");
      expect(["claude-haiku-5-5", "claude-sonnet-5-5"]).toContain(spec.model);
      expect(spec.dailyEnvelopeUsd).toBeGreaterThan(0);
      expect(spec.evalSet).toMatch(new RegExp(`evals/${spec.id}/cases.jsonl$`));
    });
  }
});

function maxInputFor(spec: (typeof AGENTS)[keyof typeof AGENTS]): unknown {
  // The maxTokens function of resume-writer keys off the scope; line is the small one. The verifier's keys off the claim count.
  if (spec.id === "claim-verifier") return { claims: Array.from({ length: 40 }, () => ({})), facts: [], target: null };
  return { scope: "resume", refine: null, resumeView: "x", facts: [], noteFact: null, job: null, maxSuggestions: 1 };
}

type _ClaudeModel = ClaudeModel;
