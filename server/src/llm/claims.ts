import { findSkills, isSkillWord } from "../services/skills-dictionary";
import { ECHO_PATTERNS } from "./fence";
import { EMAIL, LINK, phonesIn } from "./redact";

/**
 * checkClaims (01-architecture.md B.9.6 layer 2, 03-agent-runtime.md 11.4): deterministic containment, no model.
 * Every number, title, entity, skill, link, email, phone and instruction-like phrase in a resume line, answer or
 * cover-letter paragraph must appear in the text of the facts it cites. Strict on purpose: a false reject costs the
 * user an edit, a false accept sends an invented claim to an employer. Absorbs services/invented-details.ts.
 */

/** The ClaimRule values of 05-api.md 4.5 that this layer emits. */
export type ClaimRule = "number_not_in_facts" | "entity_not_in_facts" | "skill_not_in_facts" | "contact_data_in_line" | "unsupported_by_cited_facts";
export interface ClaimViolation {
  rule: ClaimRule;
  value: string;
}

/** Digit runs without thousands separators or trailing punctuation: "2,000." becomes "2000". */
const numbersIn = (t: string) => (t.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[.,]+$/, "").replace(/,/g, ""));

// "one" is left out: "one of the first", "one-click" are not counts.
const WORD_VALUES: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const NUMBER_WORD = new RegExp(`\\b(?:${Object.keys(WORD_VALUES).join("|")}|(?:hundred|thousand|million|billion|dozen)s?)\\b`, "gi");

// ponytail: a fixed title list. "lead" and "staff" are left out (verbs and plain nouns too); capitalized
// "Tech Lead" or "Staff Engineer" still meets the entity rule.
const TITLE = /\b(?:senior|sr\.?|junior|jr\.?|principal|chief|head of|vice president|vp|director|manager|co-?founder|founder|president|intern|cto|ceo|cfo|coo|cio)(?![\w-])/gi;
const TITLE_CANON: Record<string, string> = { "sr.": "senior", sr: "senior", "jr.": "junior", jr: "junior", vp: "vice president", "co-founder": "cofounder" };
const titlesIn = (t: string) => new Set((t.match(TITLE) ?? []).map((m) => m.toLowerCase()).map((m) => TITLE_CANON[m] ?? m));

/** Letter conventions that are not claims. */
const CONVENTIONS = /\b(?:hiring (?:manager|team)|recruiting team|talent team)\b/gi;
const EXTRA_INSTRUCTIONS = [/\b(?:disregard|forget)\b[^.\n]{0,40}\binstructions?\b/i];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const containsWord = (haystackLower: string, word: string) => new RegExp(`(?<![a-z0-9])${esc(word.toLowerCase())}(?![a-z0-9])`).test(haystackLower);

/**
 * Capitalized words, acronyms and mixed-case names. A plain capitalized word that starts a sentence or bullet is
 * skipped: resume lines start with "Led", "Built". ponytail: so a one-word employer opening a sentence ("Google hired
 * me") is missed; "Goldman Sachs", "IBM" and "PayPal" are not. The claim-verifier (layer 3) covers the rest.
 */
function entitiesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9&+#'’.-]*/g)) {
    const word = m[0].replace(/['’]s$/, "").replace(/[.'’-]+$/, "");
    if (!/[A-Z]/.test(word) || /^I(?:['’].*)?$/.test(word) || isSkillWord(word)) continue;
    // A unit glued to a number ("$1.2M", "40K", "2FA") counts with its number: "$1.2M" in a fact covers it, "$1.2B" does not.
    const glued = text.slice(0, m.index).match(/\d[\d.,]*$/);
    if (glued) {
      out.push(glued[0] + word);
      continue;
    }
    const before = text.slice(0, m.index).trimEnd();
    const startsSentence = before === "" || /[.!?:;•*·(\["“'\-–—]$/.test(before);
    if (startsSentence && /^[A-Z][a-z]*$/.test(word)) continue;
    out.push(word);
  }
  return out;
}

export function checkClaims(text: string, sources: string[], opts: { allow?: string[] } = {}): ClaimViolation[] {
  const src = [...sources, ...(opts.allow ?? [])].join("\n");
  const srcLower = src.toLowerCase();
  const out: ClaimViolation[] = [];
  const add = (rule: ClaimRule, values: Iterable<string>) => {
    for (const value of new Set(values)) out.push({ rule, value });
  };

  // Contact data first, then cut out, so a phone number is not reported again as numbers.
  const contacts = [...(text.match(EMAIL) ?? []), ...(text.match(LINK) ?? []).map((l) => l.replace(/\.+$/, "")), ...phonesIn(text)];
  add("contact_data_in_line", contacts.filter((c) => !srcLower.includes(c.toLowerCase())));
  let rest = text;
  for (const c of contacts) rest = rest.split(c).join(" ");

  add(
    "unsupported_by_cited_facts",
    [...ECHO_PATTERNS, ...EXTRA_INSTRUCTIONS].filter((p) => p.test(rest) && !p.test(src)).map((p) => rest.match(p)![0].trim()),
  );

  const numbers = new Set(numbersIn(src));
  add("number_not_in_facts", numbersIn(rest).filter((n) => !numbers.has(n)));
  add(
    "number_not_in_facts",
    (rest.match(NUMBER_WORD) ?? []).filter((w) => {
      const lower = w.toLowerCase();
      const value = WORD_VALUES[lower];
      if (value !== undefined) return !containsWord(srcLower, lower) && !numbers.has(String(value));
      return !new RegExp(`\\b${lower.replace(/s$/, "")}s?\\b`).test(srcLower);
    }),
  );

  const skills = new Set(findSkills(src));
  add("skill_not_in_facts", findSkills(rest).filter((s) => !skills.has(s)));

  rest = rest.replace(CONVENTIONS, " ");
  const titles = titlesIn(src);
  add("entity_not_in_facts", [...titlesIn(rest)].filter((t) => !titles.has(t)));
  add("entity_not_in_facts", entitiesIn(rest).filter((e) => !containsWord(srcLower, e)));
  return out;
}
