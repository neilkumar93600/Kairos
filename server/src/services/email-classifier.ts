import type { EmailKind } from "@auto-career/shared";

/**
 * Bump with any change to a rule below. A change also needs a green test/fixtures/inbox/rules-golden.jsonl and an owner
 * review, because the offer rule is the only path to a billing pause (workers/10-inbound-email.md 3.3).
 */
export const RULES_VERSION = 1;

/**
 * The `offer` rule must not fire on "pleased to offer you an interview": it needs an offer of a job, not of a next step.
 * The tag is informational only; it changes no billing state (see classify-email.ts).
 */
const OFFER =
  /\b(offer letter|offer of employment|job offer|(?:pleased|happy|delighted|excited|thrilled) to (?:extend|offer) (?:you )?(?:an? |the |this )?(?:offer|position|role|job)(?! to interview)|extend (?:you )?an offer(?! (?:to|for) (?:an? )?interview))\b/i;

const RULES: [EmailKind, RegExp][] = [
  ["offer", OFFER],
  ["rejection", /\b(unfortunately|not (?:be )?moving forward|decided to (?:move|pursue) (?:forward )?with other|regret to inform|position has been filled|will not be proceeding)\b/i],
  ["assessment", /\b(assessment|coding challenge|take-home|hackerrank|codesignal|codility)\b/i],
  ["interview", /\b(interview|phone screen|schedule (?:a|some) time|your availability|book a time|calendly)\b/i],
  ["confirmation", /\b(received your application|thank you for (?:applying|your application|your interest)|application (?:has been )?(?:received|submitted))\b/i],
];

/** First matching rule wins; order puts the costly mistakes (missing an offer or a rejection) first. */
export function classifyByRules(subject: string, body: string): EmailKind | null {
  const text = `${subject}\n${body.slice(0, 4000)}`;
  for (const [kind, pattern] of RULES) if (pattern.test(text)) return kind;
  return null;
}

/**
 * The reply without the history under it (messaging-16): drops lines quoted with `>`, everything from an "On ... wrote:"
 * line or an Outlook "-----Original Message-----" on, and a `-- ` signature. A Gmail "Forwarded message" block stays: in
 * a manual forward it is the employer's mail, and the linker reads its From line.
 */
export function stripQuoted(body: string): string {
  const text = body.replace(/\r\n?/g, "\n");
  const cut = text.search(/^(?:On\b[^\n]{0,300}(?:\n[^\n]{0,300})?\bwrote:[ \t]*$|-{3,}[ \t]*Original Message[ \t]*-{3,}|--[ \t]*$)/im);
  return (cut < 0 ? text : text.slice(0, cut))
    .split("\n")
    .filter((line) => !/^[ \t]*>/.test(line))
    .join("\n")
    .trim();
}
