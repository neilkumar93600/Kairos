"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { DEFAULT_PREFERENCES, preferencesSchema, SENIORITY_LEVELS, WORK_AUTHORIZATIONS, type Preferences } from "@auto-career/shared";
import { useProfileActions } from "@/hooks/use-profile";
import { Button } from "../../shared/button";
import { ErrorNote } from "../../shared/error-note";
import { Input, Select, Textarea } from "../../shared/field";
import { Panel } from "../../shared/panel";
import { StatusWord } from "../../shared/status";

const AUTH_LABEL: Record<(typeof WORK_AUTHORIZATIONS)[number], string> = {
  citizen_or_pr: "Citizen or permanent resident",
  needs_sponsorship_now: "Need visa sponsorship now",
  needs_sponsorship_later: "Will need sponsorship later",
  opt_stem_opt: "On OPT or STEM OPT",
};

/** Control id per schema key (focus goes to the first invalid one) and the message a person reads; zod's own are for developers. */
const FIELD: Record<keyof Preferences, { id: string; error: string }> = {
  roles: { id: "roles", error: "Add 1 to 10 roles, one per line, each 2 to 80 characters." },
  seniority: { id: "seniority-intern", error: "Pick at least one level." },
  locations: { id: "locations", error: "Up to 20 places, one per line, each 2 to 80 characters." },
  remoteOk: { id: "remoteOk", error: "Choose whether remote roles are fine." },
  workAuthorization: { id: "workAuthorization", error: "Pick the option closest to your status." },
  salaryFloorUsd: { id: "salaryFloorUsd", error: "Enter a whole number from 0 to 1,000,000, or leave it empty." },
  excludedCompanies: { id: "excludedCompanies", error: "Up to 200 names, one per line, each under 120 characters." },
  excludedKeywords: { id: "excludedKeywords", error: "Up to 100 keywords, one per line, each under 60 characters." },
  fitThreshold: { id: "fitThreshold", error: "Pick a bar from 50 to 95." },
  maxApplicationsPerCompanyPer30Days: { id: "cap-1", error: "Pick a number from 1 to 5." },
};

/** One value per line, so a value can hold a comma ("Austin, TX", "Company 900, LLC"). */
const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Textarea for a list field: saved values render back one per line; grows with its content up to a cap. */
function Lines({ id, values, placeholder, describedBy, invalid }: { id: string; values: string[]; placeholder?: string; describedBy: string; invalid?: boolean }) {
  return (
    <Textarea
      id={id}
      name={id}
      rows={3}
      defaultValue={values.join("\n")}
      placeholder={placeholder}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      className="max-h-60 min-h-22 field-sizing-content leading-relaxed"
    />
  );
}

/** One rule per row: what it is and what it does on the left, the control on the right. Shared with the skeleton. */
export const RULE_ROW = "grid gap-3 border-t border-line px-6 py-5 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-8";

const PILL =
  "inline-flex h-11 cursor-pointer select-none items-center gap-2.5 rounded-pill border border-rule bg-surface px-4 text-[15px] text-ink transition-colors duration-300 ease-out hover:bg-sunk active:bg-sunk has-checked:border-ink has-checked:bg-sunk has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-ink";

function Rule({ id, label, help, error, group, children }: { id: string; label: string; help: string; error?: string; group?: boolean; children: ReactNode }) {
  const labelClass = "text-[15px] font-medium text-ink";
  return (
    <div className={RULE_ROW} role={group ? "group" : undefined} aria-labelledby={group ? `${id}-label` : undefined} aria-describedby={group ? `${id}-help` : undefined}>
      <div className="flex flex-col gap-1">
        {group ? (
          <p id={`${id}-label`} className={labelClass}>
            {label}
          </p>
        ) : (
          <label htmlFor={id} className={labelClass}>
            {label}
          </label>
        )}
        <p id={`${id}-help`} className="text-sm text-body">
          {help}
        </p>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-2">
        {children}
        {error ? (
          <p role="alert" id={`${id}-error`} className="text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Bottom bar for a step or form: sticky so the main action stays in reach on long pages and on phones.
 * It sits on top of the phone tab bar (`--app-tabbar-h`, set by the dashboard layout, 0 from lg).
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[var(--app-tabbar-h,0px)] z-10 flex flex-wrap items-center gap-3 glass-panel rounded-card px-4 py-3">
      {children}
    </div>
  );
}

/** The rules the fit gate enforces before any model call. */
export function PreferencesForm({ initial, onSaved, onBack }: { initial: Preferences | null; onSaved?: () => void; onBack?: () => void }) {
  const { savePreferences } = useProfileActions();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const start = initial ?? { ...DEFAULT_PREFERENCES, roles: [], workAuthorization: "citizen_or_pr" as const };
  const [fit, setFit] = useState(start.fitThreshold);

  const describe = (key: keyof Preferences, id = FIELD[key].id) => (errors[key] ? `${id}-help ${id}-error` : `${id}-help`);
  const invalid = (key: keyof Preferences) => (errors[key] ? true : undefined);

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
      const next: Record<string, string> = Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), FIELD[i.path[0] as keyof Preferences]?.error ?? i.message]),
      );
      setErrors(next);
      const first = (Object.keys(FIELD) as (keyof Preferences)[]).find((k) => next[k]);
      if (first) document.getElementById(FIELD[first].id)?.focus();
      return;
    }
    setErrors({});
    savePreferences.mutate(parsed.data, { onSuccess: () => onSaved?.() });
  }

  const errorCount = Object.keys(errors).length;

  return (
    <form
      onSubmit={onSubmit}
      onChange={() => (savePreferences.isSuccess ? savePreferences.reset() : undefined)}
      className="flex max-w-4xl flex-col gap-6"
      noValidate
    >
      <Panel flush title="Roles and level">
        <Rule id="roles" label="Roles" help="One role per line, up to 10. A job title must contain every word of one role." error={errors.roles}>
          <Lines id="roles" values={start.roles} placeholder={"Software engineer\nBackend engineer"} describedBy={describe("roles")} invalid={invalid("roles")} />
        </Rule>
        <Rule id="seniority" group label="Seniority" help="Pick every level you would take. Only intern or entry drops senior and lead titles." error={errors.seniority}>
          <div className="flex flex-wrap gap-2">
            {SENIORITY_LEVELS.map((s) => (
              <label key={s} className={PILL}>
                <input
                  id={`seniority-${s}`}
                  type="checkbox"
                  name="seniority"
                  value={s}
                  defaultChecked={start.seniority.includes(s)}
                  aria-invalid={invalid("seniority")}
                  className="size-4 accent-action focus-visible:outline-none"
                />
                <span className="capitalize">{s}</span>
              </label>
            ))}
          </div>
        </Rule>
      </Panel>

      <Panel flush title="Location and visa">
        <Rule id="locations" label="Locations" help="One place per line. A job must be in one of them; leave empty for anywhere." error={errors.locations}>
          <Lines id="locations" values={start.locations} placeholder={"Austin, TX\nDenver, CO"} describedBy={describe("locations")} invalid={invalid("locations")} />
        </Rule>
        <Rule id="remote" group label="Remote" help="Remote jobs pass even when they are outside your locations.">
          <label className={`${PILL} w-fit`}>
            <input id="remoteOk" type="checkbox" name="remoteOk" defaultChecked={start.remoteOk} className="size-4 accent-action focus-visible:outline-none" />
            Remote roles are fine
          </label>
        </Rule>
        <Rule
          id="workAuthorization"
          label="Work authorization"
          help="If you need sponsorship or are on OPT, postings that say they will not sponsor are dropped."
          error={errors.workAuthorization}
        >
          <Select
            id="workAuthorization"
            name="workAuthorization"
            defaultValue={start.workAuthorization}
            aria-describedby={describe("workAuthorization")}
            aria-invalid={invalid("workAuthorization")}
            className="h-11"
          >
            {WORK_AUTHORIZATIONS.map((w) => (
              <option key={w} value={w}>
                {AUTH_LABEL[w]}
              </option>
            ))}
          </Select>
        </Rule>
      </Panel>

      <Panel flush title="Deal breakers">
        <Rule id="salaryFloorUsd" label="Salary floor (USD per year)" help="Drops jobs whose posted pay tops out below this. Jobs with no salary listed still pass." error={errors.salaryFloorUsd}>
          <Input
            id="salaryFloorUsd"
            name="salaryFloorUsd"
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            defaultValue={start.salaryFloorUsd ?? ""}
            placeholder="No floor"
            aria-describedby={describe("salaryFloorUsd")}
            aria-invalid={invalid("salaryFloorUsd")}
            className="sm:max-w-60"
          />
        </Rule>
        <Rule id="excludedCompanies" label="Exclude companies" help="One company per line, exact names. These are never matched." error={errors.excludedCompanies}>
          <Lines id="excludedCompanies" values={start.excludedCompanies} describedBy={describe("excludedCompanies")} invalid={invalid("excludedCompanies")} />
        </Rule>
        <Rule id="excludedKeywords" label="Exclude keywords" help="One per line. Drops a job whose title or description mentions any of them." error={errors.excludedKeywords}>
          <Lines id="excludedKeywords" values={start.excludedKeywords} placeholder={"clearance\nunpaid"} describedBy={describe("excludedKeywords")} invalid={invalid("excludedKeywords")} />
        </Rule>
      </Panel>

      <Panel flush title="How strict">
        <Rule
          id="fitThreshold"
          label="Fit bar"
          help="Jobs that pass every rule above get a fit score against your facts. A higher bar means fewer matches, each a closer fit."
          error={errors.fitThreshold}
        >
          <div className="flex items-baseline gap-3">
            <output htmlFor="fitThreshold" className="font-display text-[32px] leading-none tracking-[-0.03em] text-ink tabular-nums">
              {fit}
            </output>
            <span className="text-sm text-body">Matches scored below {fit} never reach your queue.</span>
          </div>
          <input
            id="fitThreshold"
            name="fitThreshold"
            type="range"
            min={50}
            max={95}
            step={1}
            value={fit}
            onChange={(e) => setFit(Number(e.currentTarget.value))}
            aria-describedby={describe("fitThreshold")}
            aria-invalid={invalid("fitThreshold")}
            className="h-11 w-full cursor-pointer accent-action"
          />
          <div aria-hidden className="flex justify-between text-sm text-faint tabular-nums">
            <span>50: more matches</span>
            <span>95: closer fits</span>
          </div>
        </Rule>
        <Rule
          id="maxPerCompany"
          group
          label="Per-company cap"
          help="At most this many applications to one company in any 30 days."
          error={errors.maxApplicationsPerCompanyPer30Days}
        >
          <div className="inline-flex w-fit gap-1 rounded-pill bg-sunk p-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n}>
                <input
                  id={`cap-${n}`}
                  type="radio"
                  name="maxPerCompany"
                  value={n}
                  defaultChecked={start.maxApplicationsPerCompanyPer30Days === n}
                  className="peer sr-only"
                />
                <span className="grid h-11 min-w-11 cursor-pointer place-items-center rounded-pill px-3 text-[15px] text-body tabular-nums transition-colors duration-300 ease-out hover:text-ink active:bg-surface peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-edge peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-ink">
                  {n}
                </span>
              </label>
            ))}
          </div>
        </Rule>
      </Panel>

      {savePreferences.isError ? <ErrorNote error={savePreferences.error} /> : null}

      <ActionBar>
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-4">
          <span role="status" className="text-sm">
            {savePreferences.isSuccess ? <StatusWord tone="positive">Saved</StatusWord> : null}
            {errorCount ? <span className="text-bad">{errorCount === 1 ? "Fix the rule marked above." : `Fix the ${errorCount} rules marked above.`}</span> : null}
          </span>
          <Button type="submit" disabled={savePreferences.isPending}>
            {savePreferences.isPending ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </ActionBar>
    </form>
  );
}
