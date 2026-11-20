import type { EmailKind } from "@auto-career/shared";

/**
 * Bump with any change to a rule below. A change also needs a green test/fixtures/inbox/rules-golden.jsonl and an owner
 * review, because the offer rule is the only path to a billing pause (workers/10-inbound-email.md 3.3).
 */
export const RULES_VERSION = 2;

/**
 * The `offer` rule must not fire on "pleased to offer you an interview": it needs an offer of a job, not of a next step,
 * and not one the employer says it cannot make. The tag changes no billing state (see classify-email.ts).
 * Version 2 (found by the golden file; owner-actions/WP-24.md asks for the review): "pleased to extend an offer for an
 * interview" and "a job interview" are next steps; "cannot extend you an offer" is not an offer.
 */
const OFFER =
  /\b(offer letter|offer of employment|job offer|(?:pleased|happy|delighted|excited|thrilled) to (?:extend|offer) (?:you )?(?:an? |the |this )?(?:offer|position|role|job)(?! (?:(?:to|for) (?:an? )?)?interview)|(?<!(?:cannot|can not|can't|won't|not|unable to|not able to) )extend (?:you )?an offer(?! (?:to|for) (?:an? )?interview))\b/i;

/**
 * "Unfortunately" says rejection unless the same sentence is moving a meeting: rejected is final (applications_guard_stage),
 * so "unfortunately we need to reschedule your interview" must not end the application (version 2).
 */
const UNFORTUNATELY = String.raw`unfortunately(?![^.\n]{0,80}?(?<!not )\b(?:reschedul\w*|postpone\w*|move (?:our|your|the) (?:interview|call|meeting|phone screen)))`;

const RULES: [EmailKind, RegExp][] = [
  ["offer", OFFER],
  ["rejection", new RegExp(String.raw`\b(${UNFORTUNATELY}|not (?:be )?moving forward|decided to (?:move|pursue) (?:forward )?with other|regret to inform|position has been filled|will not be proceeding)\b`, "i")],
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
 * a manual forward it is the employer's mail, and the linker reads its From line. Works on the first 4,000 characters,
 * the most the classifier and the linker read, so a crafted body cannot make the reply-header search run long.
 */
export function stripQuoted(body: string): string {
  const text = body.slice(0, 4000).replace(/\r\n?/g, "\n");
  const cut = text.search(/^(?:On\b[^\n]{0,300}(?:\n[^\n]{0,300})?\bwrote:[ \t]*$|-{3,}[ \t]*Original Message[ \t]*-{3,}|--[ \t]*$)/im);
  return (cut < 0 ? text : text.slice(0, cut))
    .split("\n")
    .filter((line) => !/^[ \t]*>/.test(line))
    .join("\n")
    .trim();
}
