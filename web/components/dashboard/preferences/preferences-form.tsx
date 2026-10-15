"use client";

import { useState, type FormEvent } from "react";
import { DEFAULT_PREFERENCES, preferencesSchema, SENIORITY_LEVELS, WORK_AUTHORIZATIONS, type Preferences } from "@auto-career/shared";
import { useProfileActions } from "@/hooks/use-profile";
import { Button } from "../../shared/button";
import { Field, Input, Select } from "../../shared/field";

const AUTH_LABEL: Record<(typeof WORK_AUTHORIZATIONS)[number], string> = {
  citizen_or_pr: "Citizen or permanent resident",
  needs_sponsorship_now: "Need visa sponsorship now",
  needs_sponsorship_later: "Will need sponsorship later",
  opt_stem_opt: "On OPT or STEM OPT",
};

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** The rules the fit gate enforces before any model call. */
export function PreferencesForm({ initial, onSaved }: { initial: Preferences | null; onSaved?: () => void }) {
  const { savePreferences } = useProfileActions();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const start = initial ?? { ...DEFAULT_PREFERENCES, roles: [], workAuthorization: "citizen_or_pr" as const };

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = preferencesSchema.safeParse({
      roles: list(f.get("roles")),
      seniority: f.getAll("seniority").map(String),
      locations: list(f.get("locations")),
      remoteOk: f.get("remoteOk") === "on",
      workAuthorization: f.get("workAuthorization"),
      salaryFloorUsd: f.get("salaryFloorUsd") ? Number(f.get("salaryFloorUsd")) : null,
      excludedCompanies: list(f.get("excludedCompanies")),
      excludedKeywords: list(f.get("excludedKeywords")),
      fitThreshold: Number(f.get("fitThreshold")),
      maxApplicationsPerCompanyPer30Days: Number(f.get("maxPerCompany")),
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    savePreferences.mutate(parsed.data, { onSuccess: () => onSaved?.() });
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2" noValidate>
      <div className="md:col-span-2">
        <Field label="Roles" htmlFor="roles" hint="Comma separated, e.g. software engineer, backend engineer" error={errors.roles}>
          <Input id="roles" name="roles" defaultValue={start.roles.join(", ")} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2 md:col-span-2">
        <legend className="mb-2 text-sm">Seniority</legend>
        <div className="flex flex-wrap gap-4">
          {SENIORITY_LEVELS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm capitalize">
              <input type="checkbox" name="seniority" value={s} defaultChecked={start.seniority.includes(s)} className="accent-action" />
              {s}
            </label>
          ))}
        </div>
        {errors.seniority ? <p className="text-xs text-bad">Pick at least one level.</p> : null}
      </fieldset>
      <Field label="Locations" htmlFor="locations" hint="Cities or countries, comma separated. Leave empty for anywhere.">
        <Input id="locations" name="locations" defaultValue={start.locations.join(", ")} />
      </Field>
      <Field label="Work authorization" htmlFor="workAuthorization">
        <Select id="workAuthorization" name="workAuthorization" defaultValue={start.workAuthorization}>
          {WORK_AUTHORIZATIONS.map((w) => (
            <option key={w} value={w}>
              {AUTH_LABEL[w]}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="remoteOk" defaultChecked={start.remoteOk} className="accent-action" /> Remote roles are fine
      </label>
      <Field label="Salary floor (USD per year)" htmlFor="salaryFloorUsd" hint="Only applied when a posting lists a salary.">
        <Input id="salaryFloorUsd" name="salaryFloorUsd" type="number" min={0} step={1000} defaultValue={start.salaryFloorUsd ?? ""} />
      </Field>
      <Field label="Exclude companies" htmlFor="excludedCompanies" hint="Comma separated">
        <Input id="excludedCompanies" name="excludedCompanies" defaultValue={start.excludedCompanies.join(", ")} />
      </Field>
      <Field label="Exclude keywords" htmlFor="excludedKeywords" hint="e.g. clearance, unpaid">
        <Input id="excludedKeywords" name="excludedKeywords" defaultValue={start.excludedKeywords.join(", ")} />
      </Field>
      <Field label="Fit bar (50 to 95)" htmlFor="fitThreshold" hint="Matches below this never reach your queue." error={errors.fitThreshold}>
        <Input id="fitThreshold" name="fitThreshold" type="number" min={50} max={95} defaultValue={start.fitThreshold} />
      </Field>
      <Field label="Applications per company per 30 days" htmlFor="maxPerCompany" error={errors.maxApplicationsPerCompanyPer30Days}>
        <Input id="maxPerCompany" name="maxPerCompany" type="number" min={1} max={5} defaultValue={start.maxApplicationsPerCompanyPer30Days} />
      </Field>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={savePreferences.isPending}>
          {savePreferences.isPending ? "Saving…" : "Save preferences"}
        </Button>
        {savePreferences.isSuccess ? <span className="text-sm text-good">Saved</span> : null}
      </div>
    </form>
  );
}
