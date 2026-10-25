export type SensitiveKind = "eeo" | "work_authorization" | "sponsorship" | "salary";

// ponytail: order matters. Sponsorship and visa go first so "authorized to work without sponsorship" asks the sponsorship question.
// Citizenship, green card, permanent residence and immigration status are work_authorization: they ask about status today;
// "green card sponsorship" still lands on sponsorship through the first rule. Broad on purpose: a false positive only
// shows "AI never drafts this answer", a false negative sends a protected question to a model.
const RULES: [SensitiveKind, RegExp][] = [
  ["sponsorship", /\b(sponsor\w*|visa|h-?1b)\b/i],
  [
    "work_authorization",
    /\b(authori[sz]ed|authori[sz]ation|eligible|legally|right) to work\b|\bwork (authori[sz]ation|permit)\b|\b(citizen\w*|green card|permanent resident\w*|immigration|legally (\w+ ){0,2}work)\b/i,
  ],
  ["salary", /\b(salary|salaries|compensation|desired pay|expected pay|pay (expectations?|range)|hourly rate|ctc|stipend|remuneration|pay)\b/i],
  ["eeo", /\b(disabilit\w*|disabled|veteran|gender|race|racial|ethnic\w*|sexual orientation|pronouns?|hispanic|latino|latina|latinx|transgender|eeo|lgbtq\w*)\b/i],
];

/**
 * Questions a model must never answer (INV-9). Returns the kind, or null for ordinary questions.
 * ponytail: keyword match on the label; tighten the patterns if a false positive shows up in production.
 */
export function classifySensitive(label: string): SensitiveKind | null {
  for (const [kind, re] of RULES) if (re.test(label)) return kind;
  return null;
}
