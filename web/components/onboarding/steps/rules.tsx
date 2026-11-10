"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PREFERENCES, preferencesSchema, SENIORITY_LEVELS, WORK_AUTHORIZATIONS, type Preferences, type Seniority } from "@auto-career/shared";
import { AUTH_LABEL } from "@/components/dashboard/preferences/preferences-form";
import { Field, Input, Select } from "@/components/shared/field";
import { useProfile, useProfileActions } from "@/hooks/use-profile";
import { mergeRoles } from "@/lib/onboarding/flow";
import { cn } from "@/lib/utils";
import { ChipsInput } from "../chips-input";
import { StepError, useWizard, type StepProps } from "../wizard";
import { TITLES } from "./target";

/** The rules this step can get wrong, in screen order: the control that takes focus and what a person reads. */
const PROBLEMS = {
  roles: { id: "ob-pref-roles", text: "Add at least one role." },
  workAuthorization: { id: "ob-work-auth", text: "Choose where you can work." },
  seniority: { id: "ob-seniority-intern", text: "Pick at least one level." },
  salaryFloorUsd: { id: "ob-salary", text: "Enter a whole number from 0 to 1,000,000, or leave it empty." },
} as const;
type Problem = keyof typeof PROBLEMS;

/**
 * Spec 5.4: locations with Remote OK, work authorization, seniority, salary floor and fit bar. Roles are the target
 * roles, then the saved ones, so a returning user keeps theirs; with no target roles (Target skipped) a roles field comes
 * first, opened with the saved roles, and what it holds is the list. Everything else is the saved preferences or the
 * defaults, so a returning user keeps their excluded lists and cap. Continue checks the whole set with the shared
 * schema, then saves it; a refusal from the server shows in the footer.
 */
export function RulesStep({ onReady }: StepProps) {
  const { state, onNext, setWorkAuthorization } = useWizard();
  const { savePreferences } = useProfileActions();
  // Loaded: the wizard renders no step until the profile is in (wizard.tsx, `me.data && profile.data && facts.data`),
  // so a returning user's excluded lists and cap are here at mount and survive the save.
  const saved = useProfile().data?.preferences;
  // Read once: the refetch after the save must not reset what is on screen.
  const [start] = useState(() => ({ ...DEFAULT_PREFERENCES, ...saved }));
  const [askRoles] = useState(state.targetRoles.length === 0);
  const [roles, setRoles] = useState<string[]>(start.roles ?? []);
  const [locations, setLocations] = useState(start.locations);
  const [remoteOk, setRemoteOk] = useState(start.remoteOk);
  const [seniority, setSeniority] = useState<Seniority[]>(start.seniority);
  const [salary, setSalary] = useState(start.salaryFloorUsd == null ? "" : String(start.salaryFloorUsd));
  const [fit, setFit] = useState(start.fitThreshold);
  const [errors, setErrors] = useState<Partial<Record<Problem, string>>>({});
  const [focus, setFocus] = useState<{ on: Problem } | null>(null);
  const fixed = (k: Problem) => setErrors((e) => ({ ...e, [k]: undefined }));

  useEffect(() => {
    onReady(true);
  }, [onReady]);

  // The stage is inert until the refused Continue settles, so focus waits a frame.
  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => document.getElementById(PROBLEMS[focus.on].id)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  // Re-registered every render so Continue sends what is on screen.
  useEffect(() => {
    onNext(async () => {
      const amount = salary.replace(/[\s,]/g, "");
      const parsed = preferencesSchema.safeParse({
        ...start,
        roles: askRoles ? roles : mergeRoles(state.targetRoles, start.roles ?? []),
        locations,
        remoteOk,
        workAuthorization: state.workAuthorization,
        seniority,
        salaryFloorUsd: amount ? Number(amount) : null,
        fitThreshold: fit,
      } satisfies Record<keyof Preferences, unknown>);
      if (!parsed.success) {
        const keys = new Set(parsed.error.issues.map((i) => String(i.path[0])));
        const found = (Object.keys(PROBLEMS) as Problem[]).filter((k) => keys.has(k));
        setErrors(Object.fromEntries(found.map((k) => [k, PROBLEMS[k].text])));
        if (found[0]) setFocus({ on: found[0] });
        // ponytail: a saved rule this step does not show (excluded lists, cap) can only be fixed in Preferences.
        throw new StepError(found.length ? "Fix the rules marked above." : "One of your saved rules is not valid. Fix it in Preferences.");
      }
      await savePreferences.mutateAsync(parsed.data);
    });
    return () => onNext(null);
  });

  return (
    <>
      <h1 tabIndex={-1} className="ob-h1">
        Set the rules a job must pass
      </h1>
      <p className="ob-sub">They run before any model reads a job, so a job that breaks one never reaches you.</p>
      {askRoles ? (
        <ChipsInput
          id="ob-pref-roles"
          label="Roles"
          placeholder="Type a title and press Enter"
          autoComplete="organization-title"
          values={roles}
          onChange={(v) => {
            setRoles(v);
            fixed("roles");
          }}
          max={10}
          minLen={2}
          maxLen={80}
          options={TITLES}
          help="Add up to 10. A job title must contain every word of one of them."
          error={errors.roles}
        />
      ) : null}
      <div className="ob-field">
        <ChipsInput
          id="ob-locations"
          label="Locations"
          placeholder="Type a city and press Enter"
          values={locations}
          onChange={setLocations}
          max={20}
          minLen={2}
          maxLen={80}
          help="Leave empty for anywhere."
        />
        <label className="ob-check">
          <input type="checkbox" checked={remoteOk} onChange={(e) => setRemoteOk(e.target.checked)} />
          Remote roles are fine
        </label>
      </div>
      <div className="ob-field">
        <Field
          label="Where you can work"
          htmlFor="ob-work-auth"
          hint="If you need sponsorship or are on OPT, postings that say they will not sponsor are dropped."
          error={errors.workAuthorization}
        >
          <Select
            id="ob-work-auth"
            className="sm:max-w-80"
            value={state.workAuthorization ?? ""}
            onChange={(e) => {
              setWorkAuthorization(WORK_AUTHORIZATIONS.find((w) => w === e.target.value) ?? null);
              fixed("workAuthorization");
            }}
          >
            <option value="">Choose one</option>
            {WORK_AUTHORIZATIONS.map((w) => (
              <option key={w} value={w}>
                {AUTH_LABEL[w]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="ob-field" role="group" aria-labelledby="ob-seniority-label" aria-describedby={errors.seniority ? "ob-seniority-help ob-seniority-error" : "ob-seniority-help"}>
        <p id="ob-seniority-label" className="ob-label">
          Seniority
        </p>
        <div className="ob-chips">
          {SENIORITY_LEVELS.map((s) => {
            const on = seniority.includes(s);
            return (
              <button
                key={s}
                id={`ob-seniority-${s}`}
                type="button"
                className={cn("ob-chip", on && "ob-chip--on")}
                aria-pressed={on}
                onClick={() => {
                  setSeniority(SENIORITY_LEVELS.filter((x) => (x === s ? !on : seniority.includes(x))));
                  fixed("seniority");
                }}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>
        <p id="ob-seniority-help" className="ob-help">
          Pick every level you would take. Only intern or entry drops senior and lead titles.
        </p>
        {errors.seniority ? (
          <p id="ob-seniority-error" role="alert" className="ob-help text-bad">
            {errors.seniority}
          </p>
        ) : null}
      </div>
      <div className="ob-field">
        <Field
          label="Salary floor per year (USD)"
          htmlFor="ob-salary"
          hint="Drops jobs whose posted pay tops out below this. Jobs with no salary listed still pass."
          error={errors.salaryFloorUsd}
        >
          <Input
            id="ob-salary"
            className="sm:max-w-60"
            inputMode="numeric"
            autoComplete="off"
            placeholder="No floor"
            value={salary}
            onChange={(e) => {
              setSalary(e.target.value);
              fixed("salaryFloorUsd");
            }}
          />
        </Field>
      </div>
      <div className="ob-field">
        <label htmlFor="ob-fit" className="ob-label">
          Fit bar: <span className="tabular-nums">{fit}</span>
        </label>
        <input
          id="ob-fit"
          type="range"
          min={50}
          max={95}
          step={1}
          value={fit}
          onChange={(e) => setFit(Number(e.target.value))}
          aria-describedby="ob-fit-help"
          className="ob-range"
        />
        <p id="ob-fit-help" className="ob-help">
          Lower means more matches; higher means closer fits.
        </p>
      </div>
    </>
  );
}
