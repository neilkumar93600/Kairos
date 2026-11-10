"use client";

import { parseLanguages, skillFacts } from "@/lib/onboarding/form-facts";
import { FactChips, type SectionProps } from "./kit";

/**
 * Chips, saved as one confirmed skill fact per group of up to 10 (36 characters a skill keeps 10 inside a 400
 * character fact). Skill facts already in the profile show read-only, except the languages fact, which is the
 * Languages section's.
 */
export function SkillsSection({ bind }: SectionProps) {
  return (
    <FactChips
      name="skills"
      bind={bind}
      texts={skillFacts}
      seed={(facts) => ({ chips: [], groups: [], kept: facts.filter((f) => parseLanguages(f.text) === null).map(({ id, text }) => ({ id, text })) })}
      label="Add your skills"
      placeholder="TypeScript, then press Enter"
      max={50}
      minLen={1}
      maxLen={36}
      help="Press Enter after each one. Tools, programming languages and methods all count."
    />
  );
}
