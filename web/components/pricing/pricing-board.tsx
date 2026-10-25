"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PLANS, type BillingInterval, type Plan } from "@auto-career/shared";
import { landingCopy } from "@/content/landing-copy";
import { FloatingCard } from "@/components/landing/floating-card";
import { SectionIntro } from "@/components/landing/section-intro";
import { INTERVAL_LABEL, PricingPlans } from "@/components/shared/pricing-plans";
import { computeReceipt, creditsPerInvoice, type CalcPlanId } from "@/lib/landing/calculator";
import { formatCredits, formatPerApp } from "@/lib/landing/format";
import { useHydrated } from "@/lib/landing/use-hydrated";
import { pricingCopy } from "./pricing-copy";

const p = pricingCopy.plans;
const k = pricingCopy.calc;
const INTERVALS = Object.keys(INTERVAL_LABEL) as BillingInterval[];
const UNIT: Record<BillingInterval, string> = { week: "week", month: "month", quarter: "quarter" };
const PAID = PLANS.filter((plan): plan is Plan & { id: CalcPlanId } => plan.id !== "free");
const HIGHLIGHTED = PAID.find((plan) => plan.highlighted) ?? PAID[0];
// Steps divide every allowance in plans.ts (234, 280, 700 · 1,000, 1,200, 3,000 · 3,000, 3,600, 9,000), so each
// plan's full use is reachable on the range.
const STEP: Record<BillingInterval, number> = { week: 1, month: 10, quarter: 30 };

const maxFor = (i: BillingInterval) => Math.max(...PAID.map((plan) => creditsPerInvoice(plan.id, i)));
/** Half of the recommended plan's allowance, the copy deck's default. */
const startFor = (i: BillingInterval) => Math.round(creditsPerInvoice(HIGHLIGHTED.id, i) / 2 / STEP[i]) * STEP[i];

/** The smallest paid plan whose allowance covers n, priced by computeReceipt (integer money). */
function describe(i: BillingInterval, n: number) {
  const plan = PAID.find((x) => creditsPerInvoice(x.id, i) >= n) ?? PAID[PAID.length - 1];
  const r = computeReceipt({ plan: plan.id, interval: i, submitted: n, failed: 0 });
  return k.result
    .replace("{plan}", plan.name)
    .replace("{price}", `$${r.priceCents / 100}`)
    .replace("{unit}", UNIT[i])
    .replace("{perApp}", r.perAppThousandths == null ? "" : formatPerApp(r.perAppThousandths));
}

/**
 * The interactive half of /pricing: the plans section (Bone-track toggle, cards, the three billing notes) and the
 * compact calculator (one range, one result sentence) share one interval. Without JavaScript both render the
 * Monthly state with the controls disabled. Live regions: the toggle announces at once, the calculator 500 ms after
 * the range stops, so dragging does not flood a screen reader.
 */
export function PricingBoard() {
  const [interval, setIntervalState] = useState<BillingInterval>("month");
  const [n, setN] = useState(() => startFor("month"));
  const [changed, setChanged] = useState(false);
  const [intervalLive, setIntervalLive] = useState("");
  const [calcLive, setCalcLive] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hydrated = useHydrated();
  useEffect(() => () => clearTimeout(timer.current), []);

  const pickInterval = (i: BillingInterval) => {
    setIntervalState(i);
    setN(startFor(i)); // a monthly number means something else per week, so the range restarts at its default
    setChanged(true);
    setIntervalLive(landingCopy.pricing.intervalLive.replace("{interval}", INTERVAL_LABEL[i].toLowerCase()));
  };
  const pickN = (v: number) => {
    setN(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCalcLive(describe(interval, v)), 500);
  };

  const max = maxFor(interval);
  const step = STEP[interval];

  return (
    <>
      <section id="plans" aria-labelledby="plans-title" className="lp-section">
        <div className="lp-wrap lp-wrap--main">
          <div className="pr-head">
            <SectionIntro titleId="plans-title" title={p.title} subline={p.subline} align="start" />
            <fieldset className="lp-seg pr-seg glass-panel">
              <legend>{landingCopy.pricing.intervalLegend}</legend>
              {INTERVALS.map((i) => (
                <label key={i}>
                  <input
                    type="radio"
                    name="pricing-interval"
                    value={i}
                    checked={interval === i}
                    disabled={!hydrated}
                    onChange={() => pickInterval(i)}
                  />
                  {INTERVAL_LABEL[i]}
                </label>
              ))}
            </fieldset>
          </div>
          <p role="status" className="lp-sr-only">
            {intervalLive}
          </p>

          <PricingPlans interval={interval} swap={changed} />

          <dl className="pr-notes">
            {p.notes.map((note) => (
              <div key={note.label}>
                <dt>{note.label}</dt>
                <dd>{note.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="calc-title" className="lp-section">
        <div className="lp-wrap lp-wrap--narrow pr-calc">
          <div>
            <SectionIntro titleId="calc-title" title={k.title} subline={k.subline} align="start" />
            <p className="lp-caption pr-roll">{k.rollover}</p>
          </div>
          <div className="lp-panel pr-calc__panel lp-reveal">
            <div className="lp-panel__art">
              <Image src="/landing/art/scene-c-noon-meadow.png" alt={k.artAlt} fill sizes="(min-width: 1024px) 640px, 100vw" />
            </div>
            <FloatingCard sample={false} className="lp-panel__card pr-calc__card">
              <div className="pr-calc__top">
                <label htmlFor="pr-calc-n" className="pr-calc__label">
                  {k.label.replace("{unit}", UNIT[interval])}
                </label>
                <output htmlFor="pr-calc-n" className="pr-calc__value">
                  {formatCredits(n)}
                </output>
              </div>
              <input
                id="pr-calc-n"
                type="range"
                className="pr-range"
                min={step}
                max={max}
                step={step}
                value={n}
                disabled={!hydrated}
                aria-valuetext={k.valueText.replace("{n}", formatCredits(n))}
                aria-describedby="pr-calc-result"
                onChange={(e) => pickN(Number(e.target.value))}
              />
              <div className="pr-calc__scale" aria-hidden="true">
                <span>{formatCredits(step)}</span>
                <span>{formatCredits(max)}</span>
              </div>
              <p id="pr-calc-result" className="pr-calc__result">
                {describe(interval, n)}
              </p>
            </FloatingCard>
            <p role="status" className="lp-sr-only">
              {calcLive}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
