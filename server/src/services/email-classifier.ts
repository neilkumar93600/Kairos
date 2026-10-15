import type { EmailKind } from "@auto-career/shared";

/**
 * An `offer` tag pauses the user's Stripe subscription, so the rule must not fire on
 * "pleased to offer you an interview". It needs an offer of a job, not of a next step.
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

/** Pulls the employer domain so a reply can be matched to an application at that company. */
export function senderDomain(sender: string): string | null {
  const match = sender.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return match?.[1]?.toLowerCase() ?? null;
}
