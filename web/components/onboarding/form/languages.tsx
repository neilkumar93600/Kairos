"use client";

import { useProfileActions } from "@/hooks/use-profile";
import { languagesFact } from "@/lib/onboarding/form-facts";
import { ChipsInput } from "../chips-input";
import { SectionAlert, syncFacts, useSection, type SectionProps } from "./kit";

/** Chips, saved as one confirmed skill fact "Languages: English, Hindi" (there is no language fact kind). */
export function LanguagesSection({ bind }: SectionProps) {
  const actions = useProfileActions();
  const s = useSection<string[]>({
    name: "languages",
    bind,
    keep: true,
    initial: () => [],
    validate: () => ({}),
    save: (langs, track) => syncFacts("skill", [languagesFact(langs)].filter((t) => t !== null), track, actions),
  });
  return (
    <>
      <ChipsInput
        id="ob-languages"
        label="Languages you speak"
        placeholder="English, then press Enter"
        values={s.value}
        onChange={s.set}
        max={10}
        minLen={2}
        maxLen={30}
        help="Press Enter after each one."
      />
      <SectionAlert message={s.alert} />
    </>
  );
}
