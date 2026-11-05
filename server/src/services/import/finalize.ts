import { createHash } from "node:crypto";
import type { FactKind } from "@auto-career/shared";
import { checkClaims } from "../../llm/claims";
import { dropSensitiveLines } from "../../llm/redact";

/**
 * The deterministic checks between the parser's reply and the fact bank (agent spec 01-resume-parser 7.2, the parts
 * that do not need line ranges): containment against the text the model saw (V6: a number, entity, skill or contact
 * detail the source does not hold drops the fact), the sensitive scan (V7), hygiene (V9) and dedupe (V10), then the
 * import identity hash (4.4). ponytail: containment is checked against the whole source, not the fact's own lines;
 * resume-parser v2 (line ranges) narrows it to the span.
 */

export interface ParsedFactIn {
  kind: FactKind;
  text: string;
  sourceSpan: string;
}
export interface FinalFact extends ParsedFactIn {
  sourceSpanHash: string;
}
export interface FinalizeCounts {
  notInSource: number;
  sensitive: number;
  deduped: number;
}

/** NFKC, lower case, whitespace collapsed: the identity of a fact's words (normalizeForHash). */
export const normalizeForHash = (t: string): string => t.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** sha256(kind | employment import key or '' | normalized text): facts.source_span_hash. */
export const factHash = (kind: FactKind, text: string, employmentKey = ""): string =>
  createHash("sha256").update(`${kind}|${employmentKey}|${normalizeForHash(text)}`, "utf8").digest("hex");

const PLACEHOLDER = /\[(?:email|phone|link|address|contact)\]/i;

export function finalizeFacts(parsed: ParsedFactIn[], modelSource: string): { kept: FinalFact[]; counts: FinalizeCounts } {
  const counts: FinalizeCounts = { notInSource: 0, sensitive: 0, deduped: 0 };
  const seen = new Set<string>();
  const kept: FinalFact[] = [];
  for (const raw of parsed) {
    // V9: one line, no bullet glyph, at most 400 characters; a short skill gets its bracket (facts.text needs 3).
    let text = raw.text.replace(/\s+/g, " ").replace(/^[-*•·▪◦‣>]+\s*/, "").trim().slice(0, 400);
    if (raw.kind === "skill" && text.length < 3) text = `${text} (skill)`;
    if (text.length < 3) continue;
    if (PLACEHOLDER.test(text) || dropSensitiveLines(text) !== text || checkClaims(text, []).some((v) => v.rule === "contact_data_in_line")) {
      counts.sensitive += 1;
      continue;
    }
    if (checkClaims(text, [modelSource]).length) {
      counts.notInSource += 1;
      continue;
    }
    const sourceSpanHash = factHash(raw.kind, text);
    if (seen.has(sourceSpanHash)) {
      counts.deduped += 1;
      continue;
    }
    seen.add(sourceSpanHash);
    kept.push({ kind: raw.kind, text, sourceSpan: raw.sourceSpan.slice(0, 1000), sourceSpanHash });
  }
  return { kept: kept.slice(0, 200), counts };
}
