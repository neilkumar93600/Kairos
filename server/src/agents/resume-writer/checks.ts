import type { Violation } from "../types";
import type { ResumeWriterInputV2, ResumeWriterOutputV2 } from "./schema";

/**
 * The writer's deterministic checks (agents/05 7), pure: the v2 postValidate, the service's post-checks and the eval's
 * graders all call these, so the eval fails exactly where production would let something through.
 */

const YEAR_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty";
/** A stated length of experience, in digits or words: "6 years", "5+ yrs", "ten-year", "over a decade". */
export const STATED_YEARS = new RegExp(`\\b(?:\\d+|${YEAR_WORDS})\\s*\\+?[\\s-]*(?:years?|yrs?)\\b|\\bdecades?\\b`, "i");
/**
 * A headline's only legitimate number is the suffix the server appends, so a model's headline holds no digit and no number
 * word at all: "since 2015", "2015-present" and "ten-plus years" would otherwise sit beside the computed years as a false
 * claim. ponytail: this also refuses "K8s" or "Web3" (one repair, then the call fails); the prompt tells the model to leave
 * such a name out. Relax it to digits next to a date or year word if real headlines are lost.
 */
export const HEADLINE_NUMBER = new RegExp(`\\d|\\b(?:${YEAR_WORDS})\\b|\\bdecades?\\b`, "i");

/** "[X]%", "[number]", "<number>", "XX%", "{n}", "TBD". */
export const PLACEHOLDER = /\[[^\]]*\]|<[^>]*>|\{[^}]*\}|\b[xX]{1,3}\s?%|\bTBD\b/;

/** The suffix the server appends to a headline, and only the server (rule 10). */
export const yearsSuffix = (value: number) => ` · ${value} ${value === 1 ? "year" : "years"}`;
/** A headline's trailing years, as the document stores it. */
export const YEARS_SUFFIX = /\s*·\s*(\d+)\s*years?\s*$/i;

const numbersIn = (t: string) => (t.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[.,]+$/, "").replace(/,/g, ""));

/** The result_first list: the first clause holds a number or one of these (workers/05 3.4 step 7). */
const RESULT_VERB =
  /\b(?:achieved|boosted|closed|cut|decreased|delivered|doubled|drove|earned|eliminated|expanded|gained|generated|grew|halved|improved|increased|launched|lifted|lowered|raised|reduced|saved|shipped|shortened|slashed|sped|tripled|won)\b/i;

/** Buzzwords a plain, natural line does not use (PRD 8.2's cliche list). ponytail: a fixed list; the eval's rubric judges the rest. */
const BUZZWORDS =
  /\b(?:best[- ]in[- ]class|cutting[- ]edge|detail[- ]oriented|dynamic|game[- ]chang\w*|go[- ]getter|hard[- ]?working|innovative|leverag\w*|proactive|results?[- ]driven|results?[- ]oriented|rock ?star|seamless\w*|self[- ]starter|spearhead\w*|strategic thinker|synerg\w*|team player|thought leader\w*|utiliz\w*|world[- ]class)\b/i;

export type Refine = "shorter" | "longer" | "result_first" | "natural" | "use_numbers";

export interface RefineTarget {
  /** The line the rewrite replaces, null for an add. */
  before: string | null;
  after: string;
  /** Texts of the cited facts of kind metric. */
  citedMetricTexts: string[];
}

/** Null when `after` complies with the refine mode, else the rule it broke. Every mode has a check (resume-18). */
export function refineViolation(refine: Refine | null | undefined, t: RefineTarget): string | null {
  switch (refine) {
    case "shorter":
      return t.before !== null && t.after.length >= t.before.length ? "refine_not_shorter" : null;
    case "longer":
      return t.before !== null && t.after.length <= t.before.length ? "refine_not_longer" : null;
    case "result_first": {
      const clause = t.after.split(/[,;:–—]| by | through | using | with /i, 1)[0] ?? "";
      return /\d/.test(clause) || RESULT_VERB.test(clause) ? null : "refine_not_result_first";
    }
    case "natural":
      return BUZZWORDS.test(t.after) || /\b(?:I|my|we|our)\b/.test(t.after) ? "refine_not_natural" : null;
    case "use_numbers": {
      // ponytail: metric facts only, as the spec says, so a number that lives in a project fact is dropped here. Widen
      // it to any cited fact if edit acceptance shows real lines being lost; containment holds either way.
      const allowed = new Set(t.citedMetricTexts.flatMap(numbersIn));
      return numbersIn(t.after).some((n) => allowed.has(n)) ? null : "refine_no_number";
    }
    default:
      return null;
  }
}

/** Levenshtein distance. The callers bound both strings to 400 characters. */
function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length]!;
}

const negationsIn = (t: string) => [...new Set((t.match(/\b(?:not|no|never|without|failed|unable)\b/gi) ?? []).map((w) => w.toLowerCase()))].sort().join();

/**
 * A "Fix spelling" keeps the line's own citations and its meaning: at most 15% of characters change, its numbers are the
 * line's numbers, and its negations are the line's negations, since dropping "not" fits in 15% and inverts the line.
 * Stricter than checkClaims on purpose: wording only, same facts (PRD 8.2).
 */
export function fixSpellingViolation(before: string, after: string, lineFactIds: readonly string[], factIds: readonly string[]): string | null {
  if ([...new Set(lineFactIds)].sort().join() !== [...new Set(factIds)].sort().join()) return "fix_spelling_citations";
  if (editDistance(before, after) > 0.15 * Math.max(before.length, after.length)) return "fix_spelling_too_far";
  if (numbersIn(before).sort().join() !== numbersIn(after).sort().join()) return "fix_spelling_number";
  return negationsIn(before) === negationsIn(after) ? null : "fix_spelling_negation";
}

/** RW2 to RW7. RW1 is the citation check every version shares; RW8, the echo canary, is the gateway's own. */
export function shapeViolations(out: ResumeWriterOutputV2, input: ResumeWriterInputV2): Violation[] {
  const violations: Violation[] = [];
  const headlineScope = input.scope === "headline";
  if (headlineScope && out.suggestions.length > 3) violations.push({ code: "bad_headline_shape", path: "suggestions" });
  out.suggestions.forEach((s, i) => {
    const at = (code: string) => violations.push({ code, path: `suggestions[${i}]` });
    if (headlineScope) {
      if (s.sectionId !== "headline" || s.entryId !== null || s.lineId !== null || s.action === "remove") at("bad_headline_shape");
    } else {
      if (s.sectionId === "headline" || s.appendYears) at("bad_headline_shape");
      if ((s.action === "add") !== (s.lineId === null)) at("bad_action_shape");
    }
    if (s.action === "remove" && (s.after !== null || s.factIds.length > 0 || s.needsFact !== null)) at("bad_action_shape");
    if (s.action !== "remove" && (s.needsFact ? s.after !== null : !s.after?.trim())) at("bad_action_shape");
    if (s.appendYears && !input.derived.length) at("append_without_value");
    if (s.tag === "fix_spelling" && s.action !== "rewrite") at("bad_tag");
    if (s.after && PLACEHOLDER.test(s.after)) at("placeholder");
    if (s.after && headlineScope) {
      if (HEADLINE_NUMBER.test(s.after)) at("model_stated_years");
    } else if (s.after) {
      // A line may repeat a length its own cited fact states ("a 3 years contract"), but every length it states must be one.
      const cited = [...input.facts, ...(input.noteFact ? [input.noteFact] : [])].filter((f) => s.factIds.includes(f.id)).map((f) => f.text.toLowerCase());
      const phrases = [...s.after.matchAll(new RegExp(STATED_YEARS.source, "gi"))].map((m) => m[0].toLowerCase());
      if (phrases.some((phrase) => !cited.some((t) => t.includes(phrase)))) at("model_stated_years");
    }
  });
  return violations;
}
