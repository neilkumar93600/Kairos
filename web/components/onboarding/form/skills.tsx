"use client";

import { useProfileActions } from "@/hooks/use-profile";
import { skillFacts } from "@/lib/onboarding/form-facts";
import { ChipsInput } from "../chips-input";
import { SectionAlert, syncFacts, useSection, type SectionProps } from "./kit";

/** Chips, saved as one confirmed skill fact per group of up to 10. 36 characters a skill keeps 10 of them inside a 400 character fact. */
export function SkillsSection({ bind }: SectionProps) {
  const actions = useProfileActions();
  const s = useSection<string[]>({
    name: "skills",
    bind,
    keep: true,
    initial: () => [],
    validate: () => ({}),
    save: (skills, track) => syncFacts("skill", skillFacts(skills), track, actions),
  });
  return (
    <>
      <ChipsInput
        id="ob-skills"
        label="Add your skills"
        placeholder="TypeScript, then press Enter"
        values={s.value}
        onChange={s.set}
        max={50}
        minLen={1}
        maxLen={36}
        help="Press Enter after each one. Tools, programming languages and methods all count."
      />
      <SectionAlert message={s.alert} />
    </>
  );
}
