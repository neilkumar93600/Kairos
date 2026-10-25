import { findSkills } from "./skills-dictionary";

/** Digit runs without thousands separators or trailing punctuation: "2,000." becomes "2000". */
const numbersIn = (t: string) => (t.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[.,]+$/, "").replace(/,/g, ""));

/**
 * Truth rule 2 in code, shared by every writer: the numbers and dictionary skills in `text` that none of `sources`
 * (the cited facts' text) contain. Empty means nothing invented that this check can see.
 * ponytail: digits and skills-dictionary terms only. Numbers written as words and invented employers, titles or scopes
 * are left to the verifier agent (spec 7.1). Strict on purpose: a skill named only in the job title still fails.
 */
export function inventedDetails(text: string, sources: string[]): string[] {
  const src = sources.join("\n");
  const numbers = new Set(numbersIn(src));
  const skills = new Set(findSkills(src));
  return [...numbersIn(text).filter((n) => !numbers.has(n)), ...findSkills(text).filter((s) => !skills.has(s))];
}
