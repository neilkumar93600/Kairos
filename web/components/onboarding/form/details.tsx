"use client";

import type { ApplicationDetails } from "@auto-career/shared";
import { Field, Select } from "@/components/shared/field";
import { ErrorNote } from "@/components/shared/error-note";
import { ListSkeleton } from "@/components/shared/skeleton";
import { useApplicationDetails, useOnboarding } from "@/hooks/use-onboarding";
import { SectionAlert, TextField, useSection, type SectionProps } from "./kit";

const NOTICE = [
  ["immediate", "Immediately"],
  ["2_weeks", "2 weeks"],
  ["1_month", "1 month"],
  ["2_months_plus", "2 months or more"],
] as const;
// ponytail: the common ones; a saved currency outside the list is added to it
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD"];

type Details = { notice: string; relocation: "" | "yes" | "no"; amount: string; currency: string };

const digits = (v: string) => v.replace(/[\s,]/g, "");

/** Notice period, relocation and expected salary: encrypted on the server, used only to fill application forms. */
export function DetailsSection({ bind }: SectionProps) {
  const details = useApplicationDetails();
  if (details.error) return <ErrorNote error={details.error} onRetry={() => details.refetch()} />;
  if (!details.data) return <ListSkeleton rows={3} />;
  return <DetailsForm bind={bind} saved={details.data} />;
}

function DetailsForm({ bind, saved }: SectionProps & { saved: ApplicationDetails }) {
  const { saveDetails } = useOnboarding();
  const s = useSection<Details>({
    name: "details",
    bind,
    initial: () => ({
      notice: saved.noticePeriod ?? "",
      relocation: saved.openToRelocation === null ? "" : saved.openToRelocation ? "yes" : "no",
      amount: saved.expectedSalary ? String(saved.expectedSalary.amount) : "",
      currency: saved.expectedSalary?.currency ?? "USD",
    }),
    validate: (v): Record<string, string> => {
      const n = digits(v.amount);
      return n && !(/^\d+$/.test(n) && Number(n) <= 10_000_000) ? { "ob-salary": "Enter a whole number up to 10,000,000, for example 120000." } : {};
    },
    save: async (v) => {
      const n = digits(v.amount);
      await saveDetails.mutateAsync({
        noticePeriod: NOTICE.find(([k]) => k === v.notice)?.[0] ?? null,
        openToRelocation: v.relocation ? v.relocation === "yes" : null,
        expectedSalary: n ? { amount: Number(n), currency: v.currency } : null,
      });
    },
  });
  const v = s.value;
  const currencies = CURRENCIES.includes(v.currency) ? CURRENCIES : [v.currency, ...CURRENCIES];
  return (
    <div className="ob-fields">
      <p className="ob-help ob-wide">Kept encrypted and used only to fill in application forms. All optional.</p>
      <Field label="Notice period" htmlFor="ob-notice">
        <Select id="ob-notice" value={v.notice} onChange={(e) => s.set({ ...v, notice: e.target.value })}>
          <option value="">Not set</option>
          {NOTICE.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Open to relocation" htmlFor="ob-relocation">
        <Select id="ob-relocation" value={v.relocation} onChange={(e) => s.set({ ...v, relocation: e.target.value as Details["relocation"] })}>
          <option value="">Not set</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>
      </Field>
      <TextField
        {...s.field("ob-salary")}
        label="Expected salary per year"
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        placeholder="120000"
        value={v.amount}
        onChange={(amount) => s.set({ ...v, amount })}
      />
      <Field label="Currency" htmlFor="ob-currency">
        <Select id="ob-currency" value={v.currency} onChange={(e) => s.set({ ...v, currency: e.target.value })}>
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <SectionAlert message={s.alert} />
    </div>
  );
}
