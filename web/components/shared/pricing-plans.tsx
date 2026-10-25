"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react";
import { PLANS, creditsPerInvoice, type BillingInterval, type Plan, type PlanId } from "@auto-career/shared";
import { landingCopy } from "@/content/landing-copy";
import { gateFeature, pricingCopy } from "@/components/pricing/pricing-copy";
import { computeReceipt, type CalcPlanId } from "@/lib/landing/calculator";
import { formatCredits, formatPerApp } from "@/lib/landing/format";
import { cn } from "@/lib/utils";

// Exported for the landing fork (components/landing/islands/billing-plans.tsx).
export const INTERVAL_LABEL: Record<BillingInterval, string> = { week: "Weekly", month: "Monthly", quarter: "Quarterly" };
export const PER: Record<BillingInterval, string> = { week: "/week", month: "/month", quarter: "/quarter" };

const c = landingCopy.pricing;
const BETA_TAGLINES: Partial<Record<PlanId, string>> = c.betaTaglines;

/**
 * Whole percent a quarterly invoice saves against three monthly ones, from plans.ts. Rounded down, so it is never
 * overstated. null unless the quarter grants exactly three months of applications (same number of applications for
 * both prices) and is cheaper. Weekly is never compared: four weeks cost more than a month.
 */
export function quarterlySaving(plan: Plan): number | null {
  const m = plan.priceUsd.month;
  const q = plan.priceUsd.quarter;
  if (plan.id === "free" || !m || q == null) return null;
  if (creditsPerInvoice(plan.id, "quarter") !== 3 * creditsPerInvoice(plan.id, "month")) return null;
  const pct = Math.floor(((3 * m - q) * 100) / (3 * m));
  return pct > 0 ? pct : null;
}

/**
 * The /pricing plan cards (DESIGN "Glass everywhere": strong glass cards on the haze). Price, period, allowance and
 * the full-use caption all come from PLANS and computeReceipt for the given interval, so they change together and the
 * period word can never sit beside the wrong price. Free has no weekly or quarterly price, so it stays $0, once.
 * Pro (`highlighted`) gets the ink border, the "Recommended" label and the one Espresso button. The interval toggle
 * lives with the state in PricingBoard. `swap` turns on the price cross-fade once the visitor has changed interval.
 */
export function PricingPlans({ interval, swap = false }: { interval: BillingInterval; swap?: boolean }) {
  return (
    <ul className="pr-plans" data-swap={swap || undefined}>
      {PLANS.map((plan, k) => {
        const free = plan.id === "free";
        const r = free ? null : computeReceipt({ plan: plan.id as CalcPlanId, interval, submitted: 0, failed: 0 });
        // A plan sold only monthly (Free) signs up on the interval it has.
        const saving = interval === "quarter" ? quarterlySaving(plan) : null;
        const signUpInterval = plan.priceUsd[interval] == null ? "month" : interval;
        return (
          <li
            key={plan.id}
            className={cn("pr-card glass-panel lp-reveal", plan.highlighted && "pr-card--featured")}
            style={{ "--i": k } as CSSProperties}
          >
            <div className="pr-panel">
              <div className="pr-top">
                <h3 className="lp-h4">{plan.name}</h3>
                {plan.highlighted ? <span className="pr-flag">{c.recommended}</span> : null}
              </div>
              <p className="lp-body-sm pr-for">{BETA_TAGLINES[plan.id] ?? plan.tagline}</p>
              <div className="pr-buy">
                <p key={`p-${interval}`} className="pr-price pr-swap">
                  <span className="lp-numeral">${r ? r.priceCents / 100 : 0}</span>
                  {r ? <span className="pr-per">{PER[interval]}</span> : null}
                </p>
                <p key={`a-${interval}`} className="lp-body-sm pr-allow pr-swap">
                  {r ? c.allowanceLine.replace("{n}", formatCredits(r.credits)) : c.freeAllowance}
                </p>
                {saving ? (
                  <p className="pr-save pr-swap">{pricingCopy.plans.save.replace("{n}", String(saving))}</p>
                ) : null}
                <Link
                  href={`/sign-up?plan=${plan.id}&interval=${signUpInterval}`}
                  className={cn("lp-btn pr-btn", !plan.highlighted && "lp-btn--outlined")}
                >
                  {free ? c.ctaFree : c.ctaPaid.replace("{plan}", plan.name)}
                </Link>
                <p key={`n-${interval}`} className="lp-caption pr-note pr-swap">
                  {r ? c.notePaid.replace("{cost}", formatPerApp(r.fullUseThousandths)) : c.noteFree}
                </p>
              </div>
            </div>
            <p className="pr-incl">{c.included}</p>
            <ul className="pr-feats">
              {/* features[0] is the 30-day allowance string, false at Weekly and Quarterly; the panel states it. */}
              {plan.features.slice(1).map((f) => (
                <li key={f}>
                  <CheckCircle size={20} weight="light" aria-hidden="true" />
                  <span>{gateFeature(f)}</span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
