import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The eval gate lives in a YAML file no compiler checks; these pin what WP-20's acceptance rests on.
// CRLF read as LF: a Windows checkout (core.autocrlf) must pass the same patterns as CI.
const yml = readFileSync(new URL("../../../.github/workflows/evals.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("evals.yml", () => {
  it("runs on pull requests that touch an agent, its golden set or the truth checks", () => {
    for (const path of ["server/src/agents/**", "server/evals/**", "server/src/llm/claims.ts", "server/src/services/sensitive.ts"]) expect(yml).toContain(`- ${path}`);
  });

  it("grades the recorded fixtures with no key", () => {
    expect(yml).toMatch(/\n {2}fixtures:[\s\S]*?run: npm run eval\n/);
  });

  it("runs the live eval only with the evals key, never for a fork, under a $5 cap", () => {
    expect(yml).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(yml).toContain("ANTHROPIC_KEY_EVALS: ${{ secrets.ANTHROPIC_KEY_EVALS }}");
    expect(yml).toContain("npm run eval -- --live --repeat 3 --max-usd 5");
    expect(yml).not.toMatch(/ANTHROPIC_KEY_(INTERACTIVE|BATCH)|ANTHROPIC_API_KEY/);
  });
});
