"use client";

import { projectFact } from "@/lib/onboarding/form-facts";
import { FactEntries, type SectionProps } from "./kit";

/** One confirmed project fact each: "Job board: Built a search page (https://example.com)". */
export function ProjectsSection({ bind }: SectionProps) {
  return (
    <FactEntries
      name="projects"
      kind="project"
      bind={bind}
      noun="project"
      text={projectFact}
      fields={[
        { key: "name", label: "Project name", maxLength: 80, required: "Enter the project name.", autoComplete: "off" },
        { key: "link", label: "Link (optional)", maxLength: 200, type: "url", inputMode: "url", autoComplete: "url", placeholder: "https://" },
        {
          key: "what",
          label: "What it did",
          maxLength: 300,
          multiline: true,
          hint: "One or two sentences. Numbers help, for example 2,000 weekly users.",
        },
      ]}
    />
  );
}
