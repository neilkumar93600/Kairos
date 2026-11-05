import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENTS } from "../../src/agents/registry";
import { EMAIL, LINK, phonesIn } from "../../src/llm/redact";
import { EVALS_DIR, formatReport, runEval } from "../../evals/harness";

const REPO = join(EVALS_DIR, "..", "..");

describe("the committed golden sets", () => {
  it("exist for every enabled agent at its spec.evalSet path", () => {
    for (const spec of Object.values(AGENTS)) expect(existsSync(join(REPO, spec.evalSet)), spec.evalSet).toBe(true);
  });

  it("pass on their fixtures, and every negative is caught (npm run eval)", async () => {
    const report = await runEval({ mode: "fixtures" });
    expect(report.passed, formatReport(report)).toBe(true);
    // Each drafting agent seeds injection cases; the answer drafter covers every kind of protected question.
    for (const id of ["resume-tailor", "resume-writer", "answer-drafter", "cover-letter-writer", "fit-scorer", "resume-parser", "claim-verifier", "claim-verifier-escalation"]) {
      expect(report.results.some((r) => r.agentId === id && r.tags.includes("injection")), id).toBe(true);
      expect(report.results.some((r) => r.agentId === id && r.negative), id).toBe(true);
    }
    expect(report.results.filter((r) => r.agentId === "answer-drafter" && r.tags.includes("sensitive")).length).toBeGreaterThanOrEqual(8);
  });

  it("hold no real-looking contact data: emails and links on example.com, phones in the fictional 555 range (13.2)", () => {
    const files = Object.keys(AGENTS).flatMap((id) => {
      const dir = join(EVALS_DIR, id);
      const fixtures = existsSync(join(dir, "fixtures")) ? readdirSync(join(dir, "fixtures")).map((f) => join(dir, "fixtures", f)) : [];
      return [join(dir, "cases.jsonl"), join(dir, "negatives.jsonl"), ...fixtures].filter((f) => existsSync(f));
    });
    const bad: string[] = [];
    for (const file of files) {
      // The fingerprint and input hash are hex, and hex has phone-shaped digit runs.
      const text = readFileSync(file, "utf8").replace(/"(?:promptSha256|inputHash)": "[0-9a-f]+"/g, "");
      for (const email of text.match(EMAIL) ?? []) if (!/@example\.(com|org|net)$/i.test(email)) bad.push(`${file}: ${email}`);
      for (const link of text.match(LINK) ?? []) if (!/\bexample\.(com|org|net)\b/i.test(link)) bad.push(`${file}: ${link}`);
      for (const phone of phonesIn(text)) if (!phone.replace(/\D/g, "").includes("555")) bad.push(`${file}: ${phone}`);
    }
    expect(bad).toEqual([]);
  });
});
