import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resumeLineSchema, type ResumeInput, type ResumeLine, type ResumeSuggestion } from "@auto-career/shared";
import { UNTRUSTED_RULES, untrusted } from "../ai/untrusted";
import { runAgent } from "../llm/gateway";
import { resumeTailor } from "../agents/resume-tailor/spec";
import { gatewayEnabled } from "../llm/wire";
import type { AgentCallContext } from "../agents/types";
import { checkClaims, type ClaimRule } from "../llm/claims";
import { redactContact } from "../llm/redact";
import { chatJson } from "./llm";
import type { VerifierPath } from "../lib/flags";
import { logger } from "../lib/logger";
import { requireVerifierOrShadow, verifyClaims } from "./verify";

export interface TruthLockResult {
  kept: ResumeLine[];
  rejected: { line: ResumeLine; reason: string; rule: ClaimRule | "no_fact" | "unknown_fact" | "unverified" }[];
}

/**
 * The truth lock, layers 1 and 2 of B.9.6: a line survives only if it cites at least one fact, every cited id is in
 * `facts` (id to text: the user's own, confirmed facts), and checkClaims finds nothing the cited facts lack.
 * `changed` limits the claim check to lines that differ from what is stored (PATCH resends every line on every save);
 * the id check always runs, so a stored line citing a fact that was since unconfirmed still fails.
 */
export function enforceTruthLock(
  lines: ResumeLine[],
  facts: ReadonlyMap<string, string>,
  changed: (line: ResumeLine) => boolean = () => true,
): TruthLockResult {
  const kept: ResumeLine[] = [];
  const rejected: TruthLockResult["rejected"] = [];
  for (const line of lines) {
    if (line.factIds.length === 0) {
      rejected.push({ line, reason: "cites no fact", rule: "no_fact" });
      continue;
    }
    const unknown = line.factIds.filter((id) => !facts.has(id));
    if (unknown.length > 0) {
      rejected.push({ line, reason: `cites unknown facts: ${unknown.join(", ")}`, rule: "unknown_fact" });
      continue;
    }
    const [claim] = changed(line) ? checkClaims(line.text, line.factIds.map((id) => facts.get(id)!)) : [];
    if (claim) {
      rejected.push({ line, reason: `not in the cited facts: ${claim.value}`, rule: claim.rule });
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

/** Layers 1 and 2, then layer 3 on what survived them. In shadow layer 3 only counts; in enforce it drops. */
async function lockAndVerify(lines: ResumeLine[], facts: ReadonlyMap<string, string>, path: VerifierPath, ctx: AgentCallContext): Promise<TruthLockResult> {
  const lock = enforceTruthLock(lines, facts);
  const { dropped } = await verifyClaims(
    lock.kept.map((l, i) => ({ key: String(i), kind: "resume_line" as const, text: l.text, factIds: l.factIds })),
    facts,
    { path, target: null, ctx, escalate: true },
  );
  const rule = new Map(dropped.map((d) => [d.key, d.rule]));
  return {
    kept: lock.kept.filter((_, i) => !rule.has(String(i))),
    rejected: [
      ...lock.rejected,
      ...lock.kept.flatMap((line, i) => {
        const r = rule.get(String(i));
        return r ? [{ line, reason: "not verified against the cited facts", rule: r }] : [];
      }),
    ],
  };
}

/**
 * Rewrites resume lines for one job, then drops any line the truth lock rejects (layers 1 to 3), with one truth repair
 * for what was dropped. Contact details never reach the model. `path` names the verifier_mode flag; prepare's job passes
 * its own.
 */
export async function tailorResume(
  facts: FactForTailoring[],
  job: { title: string; companyName: string; descriptionText: string },
  callCtx?: AgentCallContext,
  opts: { path?: VerifierPath } = {},
) {
  const path = opts.path ?? "tailor";
  const factTexts = new Map(facts.map((f) => [f.id, f.text]));
  if (facts.length === 0) return { kept: [], rejected: [] }; // nothing a line could cite, so no model call
  if (callCtx ?? gatewayEnabled()) {
    // The gateway path (LLM_GATEWAY=anthropic); the truth lock below still owns the final word.
    // Clipped to the input schema (60 facts; the gateway refuses more). Callers pass their best facts first.
    const input = {
      facts: facts.slice(0, 60),
      job: { title: job.title.slice(0, 200), companyName: job.companyName.slice(0, 200), descriptionText: job.descriptionText.slice(0, 20_000) },
    };
    const ctx = callCtx ?? {};
    const out = await runAgent(resumeTailor, input, ctx);
    const first = await lockAndVerify(out.data.lines, factTexts, path, ctx);
    if (!first.rejected.length) return first;
    // The truth repair (B.9.6): one more call told what failed; its new lines pass all three layers too. It only ever
    // adds lines, so a failed repair leaves the verified first result standing.
    try {
      const doNotClaim = first.rejected.slice(0, 20).map((r) => ({ text: r.line.text.slice(0, 400), rule: r.rule }));
      const repaired = await runAgent(resumeTailor, { ...input, doNotClaim }, ctx, { callKind: "truth_repair" });
      const seen = new Set([...first.kept.map((l) => l.text.trim()), ...first.rejected.map((r) => r.line.text.trim())]);
      const fresh = repaired.data.lines.filter((l) => !seen.has(l.text.trim())).map((l, i) => ({ ...l, id: `r${i + 1}` }));
      const second = await lockAndVerify(fresh, factTexts, path, ctx);
      return { kept: [...first.kept, ...second.kept].slice(0, 60), rejected: [...first.rejected, ...second.rejected] };
    } catch (err) {
      logger.warn({ path, code: (err as { code?: string }).code ?? null }, "truth repair failed; keeping the verified lines");
      return first;
    }
  }
  await requireVerifierOrShadow(path); // the legacy client has no layer 3; enforce refuses before any spend
  const factList = facts.map((f) => `[${f.id}] (${f.kind}) ${redactContact(f.text)}`).join("\n");
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
  return enforceTruthLock(result.lines, factTexts);
}

/**
 * The tailor route's suggestions from resume-tailor's truth-locked lines (Haiku instead of the Sonnet writer, resume-34).
 * A tailored line citing a fact that a base-resume line already cites rewrites that line (each base line once); any
 * other line is an add to the section it names, under the entry whose heading it cites. Unchanged lines and sections
 * the resume lacks are skipped.
 * ponytail: maps v1's whole-resume lines onto the document; resume-tailor's suggestion mode (05-resume-workspace 6,
 * WP-41) asks the model for rewrite, add and remove against the document directly, plus the needsFact questions.
 */
export function tailorSuggestions(resume: ResumeInput, lines: ResumeLine[], jobTitle: string, max = 15): ResumeSuggestion[] {
  const sections = resume.sections.filter((s) => !s.hidden).map((s) => ({ ...s, entries: s.entries.filter((e) => !e.hidden) }));
  const why = `Tailored toward ${jobTitle}`.slice(0, 300);
  const claimed = new Set<string>();
  const out: ResumeSuggestion[] = [];
  for (const line of lines) {
    if (out.length >= max) break;
    const cites = new Set(line.factIds);
    const base = sections
      .flatMap((s) => s.entries.flatMap((e) => e.lines.map((l) => ({ sectionId: s.id, entryId: e.id, line: l }))))
      .find((b) => !claimed.has(b.line.id) && b.line.factIds.some((id) => cites.has(id)));
    if (base) {
      claimed.add(base.line.id);
      if (base.line.text.trim() !== line.text.trim()) {
        out.push({ id: randomUUID(), sectionId: base.sectionId, entryId: base.entryId, lineId: base.line.id, before: base.line.text, action: "rewrite", after: line.text, why, factIds: line.factIds, needsFact: null });
      }
      continue;
    }
    const name = line.section.trim().toLowerCase();
    const section = sections.find((s) => s.title.trim().toLowerCase() === name || s.kind === name);
    if (!section) continue;
    const entry = section.entries.find((e) => e.headingFactId !== null && cites.has(e.headingFactId));
    out.push({ id: randomUUID(), sectionId: section.id, entryId: entry?.id ?? null, lineId: null, before: null, action: "add", after: line.text, why, factIds: line.factIds, needsFact: null });
  }
  return out;
}
