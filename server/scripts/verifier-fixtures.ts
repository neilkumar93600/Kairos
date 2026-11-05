import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { claimVerifier } from "../src/agents/claim-verifier/spec";
import { claimVerifierEscalation } from "../src/agents/claim-verifier-escalation/spec";
import type { ClaimVerifierInput, Verdict } from "../src/agents/claim-verifier/schema";
import { canonicalJson } from "../src/llm/schema";
import { createHash } from "node:crypto";

/**
 * Writes hand_written fixtures for the verifier eval sets: each reply is the case's gold verdicts, so `npm run eval`
 * proves the plumbing and the graders offline. They say nothing about the model; `npm run llm:record` overwrites them
 * with real replies once a live run is approved, and only those give real false-accept and false-reject rates.
 * Run: node --import tsx --import ./scripts/md-register.mjs scripts/verifier-fixtures.ts
 */
const here = join(import.meta.dirname ?? ".", "..", "evals");
for (const spec of [claimVerifier, claimVerifierEscalation]) {
  const prompt = spec.prompts[spec.promptVersion]!;
  mkdirSync(join(here, spec.id, "fixtures"), { recursive: true });
  for (const line of readFileSync(join(here, spec.id, "cases.jsonl"), "utf8").split(/\r?\n/).filter(Boolean)) {
    const c = JSON.parse(line) as { id: string; input: ClaimVerifierInput; expect: { verdicts: Record<string, Verdict> } };
    const verdicts = c.input.claims.map((claim) => {
      const verdict = c.expect.verdicts[claim.id]!;
      return { claimId: claim.id, verdict, factRef: verdict === "supported" || verdict === "contradicted" ? claim.factRefs[0]! : null };
    });
    const fixture = {
      caseId: c.id,
      promptVersion: spec.promptVersion,
      promptSha256: prompt.fingerprint,
      inputHash: createHash("sha256").update(canonicalJson(c.input)).digest("hex"),
      source: "hand_written",
      responses: [{ text: { verdicts } }],
    };
    writeFileSync(join(here, spec.id, "fixtures", `${c.id}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
  }
}
