"use client";

import { educationFact } from "@/lib/onboarding/form-facts";
import { FactEntries, type SectionProps } from "./kit";

const year = (v: string) => (/^\d{4}$/.test(v) ? undefined : "Use a 4 digit year, for example 2022.");

/** One confirmed education fact per school: "B.Tech Computer Science, Sample University, 2018 to 2022". */
export function EducationSection({ bind }: SectionProps) {
  return (
    <FactEntries
      name="education"
      kind="education"
      bind={bind}
      noun="school"
      text={educationFact}
      fields={[
        { key: "school", label: "School", maxLength: 120, required: "Enter the school.", autoComplete: "organization" },
        { key: "degree", label: "Degree", maxLength: 80, required: "Enter the degree, for example B.Tech or MBA.", autoComplete: "off" },
        { key: "field", label: "Field of study", maxLength: 80, autoComplete: "off" },
        { key: "grade", label: "Grade (optional)", maxLength: 12, autoComplete: "off", placeholder: "8.4 or 3.7" },
        { key: "start", label: "Start year", maxLength: 4, inputMode: "numeric", autoComplete: "off", placeholder: "2018", check: year },
        { key: "end", label: "End year", maxLength: 4, inputMode: "numeric", autoComplete: "off", placeholder: "2022", check: year },
      ]}
    />
  );
}
