"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import type { landingCopy } from "@/content/landing-copy";
import { computeRun, comboIndex, type FitSample, type Sponsorship } from "@/lib/landing/fit-run";
import { useHydrated } from "@/lib/landing/use-hydrated";
import { cn } from "@/lib/utils";
import { Odometer } from "./odometer";

export type SampleRunCopy = (typeof landingCopy)["step1"]["card"];

export interface SampleRunProps {
  sample: FitSample;
  copy: SampleRunCopy;
}

/** 06 sample settings: Entry, 2 per company in 30 days, bar 70. A sample setting, not a product default. */
const FIXED = { seniority: "entry", cap: 2, bar: 70 } as const;
/**
 * Three postings from fit-sample.json, in posting order. 0349 is skipped only by the sponsorship rule, so the
 * radio pair flips it; 0541 always passes; 0103 is always skipped (too senior). Ids missing from a regenerated
 * sample are dropped rather than rendered wrong.
 */
const ROW_IDS = ["0349", "0541", "0103"] as const;

const fillText = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{([^}]+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

const fillNodes = (t: string, v: Record<string, ReactNode>) =>
  t.split(/\{([^}]+)\}/).map((part, i) => <Fragment key={i}>{i % 2 ? v[part] : part}</Fragment>);

const count = (n: number) => <Odometer value={n} intDigits={2} preset="row" align="end" announce={false} />;

/**
 * Step 1 sample card: one control (needs visa sponsorship, Yes or No), three rows and one count line, all from
 * the precomputed hard-rule masks. The first render equals the server render (Yes, radios disabled until hydrated).
 */
export function SampleRun({ sample, copy }: SampleRunProps) {
  const [sponsorship, setSponsorship] = useState<Sponsorship>("yes");
  const [live, setLive] = useState("");
  const enabled = useHydrated();
  const legendId = useId();

  const resultFor = (v: Sponsorship) => computeRun(sample, comboIndex(FIXED.seniority, v, FIXED.cap), FIXED.bar);
  const run = resultFor(sponsorship);
  const masks = sample.combos[comboIndex(FIXED.seniority, sponsorship, FIXED.cap)];

  function choose(v: Sponsorship) {
    setSponsorship(v);
    const r = resultFor(v);
    setLive(
      fillText(copy.liveRegion, {
        value: copy.sponsorshipOptions[v === "yes" ? 0 : 1],
        skipped: r.skipped,
        passed: r.passed,
      }),
    );
  }

  const rows = ROW_IDS.map((id, n) => {
    const i = sample.postings.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const m = masks[i];
    // Only the first row spells out its reason, with the exact fit.ts string for the lowest rule that fired.
    const reason = sample.reasons[Math.max(0, 31 - Math.clz32(m & -m))];
    const text =
      m === 0 ? fillText(copy.passRow, { id }) : fillText(n === 0 ? copy.skippedRow : copy.skipRow, { id, reason });
    return { id, text, passes: m === 0, first: n === 0 };
  }).filter((r) => r !== null);

  return (
    <div className="min-w-0 wrap-break-word">
      <div role="radiogroup" aria-labelledby={legendId}>
        <p id={legendId} className="mb-2 text-[13px] leading-5.5 font-medium text-ink">
          {copy.sponsorshipLegend}
        </p>
        <div className="lp-seg flex w-full">
          {(["yes", "no"] as const).map((v, i) => (
            <label key={v}>
              <input
                type="radio"
                name="step-1-sponsorship"
                value={v}
                checked={sponsorship === v}
                disabled={!enabled}
                onChange={() => choose(v)}
              />
              {copy.sponsorshipOptions[i]}
            </label>
          ))}
        </div>
      </div>

      <ul className="mt-4">
        {rows.map((r) => (
          <li
            key={r.id}
            // The first row keeps two lines of height so flipping Yes to No never moves the card.
            className={cn(
              "border-t border-rule py-2.5 tabular-nums slashed-zero",
              r.passes ? "font-medium text-ink" : "text-body",
              r.first && "min-h-[calc(2lh+20px)]",
            )}
          >
            {r.text}
          </li>
        ))}
      </ul>

      <p className="lp-caption border-t border-rule pt-2.5 tabular-nums slashed-zero">
        {fillNodes(copy.runLine, { total: sample.postings.length, skipped: count(run.skipped), passed: count(run.passed) })}
      </p>

      <p className="lp-sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </p>
    </div>
  );
}
