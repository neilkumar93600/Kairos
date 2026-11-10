"use client";

import { certificationFact } from "@/lib/onboarding/form-facts";
import { FactEntries, type SectionProps } from "./kit";

/** One confirmed certification fact each: "Cloud Practitioner, Sample Institute, 2023". */
export function CertificationsSection({ bind }: SectionProps) {
  return (
    <FactEntries
      name="certifications"
      kind="certification"
      bind={bind}
      noun="certification"
      text={certificationFact}
      fields={[
        { key: "name", label: "Certification", maxLength: 120, required: "Enter the certification name.", autoComplete: "off" },
        { key: "issuer", label: "Issued by", maxLength: 120, autoComplete: "organization" },
        {
          key: "year",
          label: "Year",
          maxLength: 4,
          inputMode: "numeric",
          autoComplete: "off",
          placeholder: "2023",
          check: (v) => (/^\d{4}$/.test(v) ? undefined : "Use a 4 digit year, for example 2023."),
        },
      ]}
    />
  );
}
