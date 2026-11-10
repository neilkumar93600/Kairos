"use client";

import { languagesFact, parseLanguages } from "@/lib/onboarding/form-facts";
import { FactChips, type SectionProps } from "./kit";

/**
 * Chips, saved as one confirmed skill fact "Languages: English, Hindi" (there is no language fact kind). An existing
 * languages fact refills the chips and is patched on the next save; any extra one shows read-only.
 */
export function LanguagesSection({ bind }: SectionProps) {
  return (
    <FactChips
      name="languages"
      bind={bind}
      texts={(langs) => [languagesFact(langs)].filter((t) => t !== null)}
      seed={(facts) => {
        const [first, ...rest] = facts.filter((f) => parseLanguages(f.text) !== null).map(({ id, text }) => ({ id, text }));
        return { chips: first ? (parseLanguages(first.text) ?? []) : [], groups: first ? [first] : [], kept: rest };
      }}
      label="Languages you speak"
      placeholder="English, then press Enter"
      max={10}
      minLen={2}
      maxLen={30}
      help="Press Enter after each one."
    />
  );
}
