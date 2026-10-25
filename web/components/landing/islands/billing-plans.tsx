"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react";
import { PLANS, type BillingInterval, type PlanId } from "@auto-career/shared";
import { landingCopy } from "@/content/landing-copy";
import { computeReceipt, type CalcPlanId } from "@/lib/landing/calculator";
import { formatCredits, formatPerApp } from "@/lib/landing/format";
import { useHydrated } from "@/lib/landing/use-hydrated";
import { cn } from "@/lib/utils";
import "./billing-plans.css";

const c = landingCopy.pricing;
const INTERVALS: readonly BillingInterval[] = ["week", "month", "quarter"];
const BETA_TAGLINES: Partial<Record<PlanId, string>> = c.betaTaglines;

/** G3: "Cloud applier: sends ..." -> "Cloud applier (in beta): sends ...". */
function gate(feature: string) {
  const name = c.betaFeatures.find((b) => feature.startsWith(b));
  return name ? `${name} ${c.betaTag}${feature.slice(name.length)}` : feature;
}

/**
 * 08 1.7 / A8: art banner (headline and interval toggle), four plan cards, guarantee banner. Price, period,
 * allowance and the per-application caption all come from plans.ts for the chosen interval (P3), so the period word
 * can never sit beside the wrong price. Only the highlighted plan's button is Espresso; the rest are outlined.
 * ponytail: the page is the only consumer, so the island owns the whole section body instead of taking copy props.
 */
export function BillingPlans() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [live, setLive] = useState("");
  const hydrated = useHydrated();
  const i = INTERVALS.indexOf(interval);

  return (
    <div className="lp-wrap lp-wrap--main">
      <div className="bp-banner lp-reveal">
        <div className="bp-banner__art lp-art" aria-hidden="true">
          <Image src="/landing/art/scene-a-dawn-valley.png" alt="" fill sizes="(min-width: 1280px) 1120px, 100vw" />
        </div>
        <div className="bp-banner__copy">
          <h2 id="pricing-title" className="lp-h2">{c.h2}</h2>
          <p className="lp-body bp-banner__sub">{c.subline}</p>
        </div>
        <fieldset className="lp-seg glass bp-seg">
          <legend>{c.intervalLegend}</legend>
          {INTERVALS.map((v, k) => (
            <label key={v}>
              <input
                type="radio"
                name="billing-interval"
                value={v}
                checked={interval === v}
                disabled={!hydrated}
                onChange={() => {
                  setInterval(v);
                  setLive(c.intervalLive.replace("{interval}", c.intervals[k].toLowerCase()));
                }}
              />
              {c.intervals[k]}
            </label>
          ))}
        </fieldset>
      </div>
      <p role="status" className="lp-sr-only">{live}</p>

      <ul className="bp-plans">
        {PLANS.map((plan, k) => {
          const free = plan.id === "free";
          const featured = plan.highlighted;
          const r = free ? null : computeReceipt({ plan: plan.id as CalcPlanId, interval, submitted: 0, failed: 0 });
          return (
            <li
              key={plan.id}
              className={cn("bp-card glass-panel lp-reveal", featured && "bp-card--featured")}
              style={{ "--i": k } as CSSProperties}
            >
              <div className="bp-panel">
                {featured ? (
                  <>
                    <div className="bp-panel__art lp-art" aria-hidden="true">
                      <Image src="/landing/art/scene-b-footbridge.png" alt="" fill sizes="(min-width: 1280px) 252px, (min-width: 768px) 50vw, 100vw" />
                    </div>
                    <div className="bp-panel__frost glass glass-strong" aria-hidden="true" />
                  </>
                ) : null}
                <div className="bp-head">
                  <h3 className="lp-h4">{plan.name}</h3>
                  {featured ? <span className="lp-pill glass bp-flag">{c.recommended}</span> : null}
                </div>
                <p className="lp-body-sm bp-for">{BETA_TAGLINES[plan.id] ?? plan.tagline}</p>
                <div className="bp-buy">
                  <p className="bp-price">
                    <span className="lp-numeral">${r ? r.priceCents / 100 : 0}</span>
                    {r ? <span className="bp-per">{c.intervalWords[i]}</span> : null}
                  </p>
                  <p className="lp-body-sm bp-allow">
                    {r ? c.allowanceLine.replace("{n}", formatCredits(r.credits)) : c.freeAllowance}
                  </p>
                  <Link
                    href={free ? "/sign-up" : `/sign-up?plan=${plan.id}&interval=${interval}`}
                    className={cn("lp-btn bp-btn", !featured && "lp-btn--outlined")}
                  >
                    {free ? c.ctaFree : c.ctaPaid.replace("{plan}", plan.name)}
                  </Link>
                  <p className="lp-caption bp-note">
                    {r ? c.notePaid.replace("{cost}", formatPerApp(r.fullUseThousandths)) : c.noteFree}
                  </p>
                </div>
              </div>
              <p className="bp-incl">{c.included}</p>
              <ul className="bp-feats">
                {/* features[0] repeats the allowance line in the panel, so the list starts at [1]. */}
                {plan.features.slice(1, 5).map((f) => (
                  <li key={f}>
                    <CheckCircle size={20} weight="light" aria-hidden="true" />
                    <span>{gate(f)}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="bp-promise lp-reveal">
        <p className="bp-promise__bar glass glass-strong">
          <span>{c.guarantee}</span>
          <Link href="/pricing" className="lp-link">{c.fullPricing}</Link>
        </p>
      </div>
    </div>
  );
}
