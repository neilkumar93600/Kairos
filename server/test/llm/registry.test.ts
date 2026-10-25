import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENTS } from "../../src/agents/registry";
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

  it("registers the six P1 agents", () => {
    expect(Object.keys(AGENTS).sort()).toEqual(
      ["answer-drafter", "cover-letter-writer", "fit-scorer", "resume-parser", "resume-tailor", "resume-writer"].sort(),
    );
  });

  for (const [id, spec] of Object.entries(AGENTS)) {
    const activePrompt = spec.prompts[spec.promptVersion]!;
    it(`${id}: the active prompt exists and the lock matches the computed fingerprints`, () => {
      expect(activePrompt, `${id} has a prompt for its active version`).toBeDefined();
      expect(lock[id]!.active).toBe(spec.promptVersion);
      for (const [version, asset] of Object.entries(spec.prompts)) {
        const fresh = promptAsset(id, Number(version), asset.system, spec.schemaSnapshot).fingerprint;
        expect(lock[id]!.versions[version], `${id}@v${version} fingerprint must match the lock`).toBe(fresh);
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
      expect(spec.evalSet).toMatch(new RegExp(`evals/${id}/cases.jsonl$`));
    });
  }
});

function maxInputFor(spec: (typeof AGENTS)[keyof typeof AGENTS]): unknown {
  // The maxTokens function of resume-writer keys off the scope; line is the small one.
  return { scope: "resume", refine: null, resumeView: "x", facts: [], noteFact: null, job: null, maxSuggestions: 1 };
}

type _ClaudeModel = ClaudeModel;
