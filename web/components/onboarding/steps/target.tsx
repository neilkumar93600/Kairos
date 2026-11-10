"use client";

import { useEffect } from "react";
import { ChipsInput } from "../chips-input";
import { useWizard, type StepProps } from "../wizard";

// ponytail: a static list of common titles; swap for a server list when one exists.
const TITLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Analyst",
  "Data Scientist",
  "Product Manager",
  "Product Designer",
  "Project Manager",
  "Marketing Manager",
  "Sales Executive",
  "Customer Support Specialist",
] as const;

export function TargetStep({ onReady }: StepProps) {
  const { state, setTargets } = useWizard();
  useEffect(() => {
    onReady(state.targetRoles.length > 0);
  }, [state.targetRoles, onReady]);

  return (
    <>
      <h1 tabIndex={-1} className="ob-h1">
        Which job are you going for?
      </h1>
      <p className="ob-sub">Kairos uses this to match jobs, word your resume and prepare your interviews.</p>
      <ChipsInput
        id="ob-roles"
        label="Desired position"
        placeholder="Type a title and press Enter"
        autoComplete="organization-title"
        values={state.targetRoles}
        onChange={(targetRoles) => setTargets({ targetRoles })}
        max={5}
        minLen={2}
        maxLen={80}
        options={TITLES}
        help="Add up to 5. A job title must contain every word of one of them."
      />
      <ChipsInput
        id="ob-companies"
        label="Companies you want to work at"
        optional
        placeholder="Type a company and press Enter"
        values={state.targetCompanies}
        onChange={(targetCompanies) => setTargets({ targetCompanies })}
        max={10}
        minLen={1}
        maxLen={120}
      />
    </>
  );
}
