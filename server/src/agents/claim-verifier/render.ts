import type { ClaimVerifierInput } from "./schema";
import type { RenderedPrompt } from "../types";

/** One line per claim or fact: newlines inside a text would let it forge a line of its own ("[c02] ..."), so they go. */
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Pure render (agents/08-claim-verifier.md 3). Both blocks are per-call T2 data, fenced: the claims are model output
 * steered by employer text, the facts are the user's. No per-user block (the cited set differs per call, cache.user
 * null) and no task line. Each claim's ref and citations come before its text, so text cannot pose as either. The
 * fence budget is above maxInputTokens on purpose: a claim is never cut short (a truncated claim could read as
 * supported); an oversize call is refused by the gateway instead, and services/verify.ts chunks below that.
 */
export function renderClaimVerifier(input: ClaimVerifierInput): RenderedPrompt {
  const target = input.target
    ? `Target employer: ${oneLine(input.target.companyName) || "(none)"}. Target role: ${oneLine(input.target.jobTitle) || "(none)"}.\n`
    : "Target: none (resume lines).\n";
  const claims = input.claims.map((c) => `[${c.id}] kind=${c.kind} cites=${c.factRefs.join(",")} :: ${oneLine(c.text)}`).join("\n");
  const facts = input.facts.map((f) => `[${f.ref}] ${oneLine(f.text)}`).join("\n");
  return {
    untrusted: [
      { label: "claims", text: `${target}Claims:\n${claims}`, maxTokens: 6_000 },
      { label: "cited_facts", text: `Cited facts:\n${facts}`, maxTokens: 6_000 },
    ],
  };
}
