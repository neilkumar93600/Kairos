"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { PLANS, type BillingInterval } from "@auto-career/shared";
import { cn } from "@/lib/utils";
import { ButtonLink } from "./button";

// Exported for the landing fork (components/landing/islands/billing-plans.tsx).
export const INTERVAL_LABEL: Record<BillingInterval, string> = { week: "Weekly", month: "Monthly", quarter: "Quarterly" };
export const PER: Record<BillingInterval, string> = { week: "/week", month: "/month", quarter: "/quarter" };

/** Plan cards with an interval switch. Renders from the shared PLANS list the server also bills from. */
export function PricingPlans() {
  const [interval, setInterval] = useState<BillingInterval>("month");

  return (
    <div className="flex flex-col gap-8">
      <div role="radiogroup" aria-label="Billing interval" className="inline-flex w-fit gap-1 rounded-pill bg-sunk p-1">
        {(Object.keys(INTERVAL_LABEL) as BillingInterval[]).map((i) => (
          <button
            key={i}
            role="radio"
            aria-checked={interval === i}
            onClick={() => setInterval(i)}
            // A8 toggle (09 8): Bone track, active segment a Paper White pill with ring. Never Espresso, never lime.
            className={cn(
              "min-h-10 rounded-pill px-4 text-[15px] font-medium text-ink transition-colors duration-300 ease-out",
              interval === i ? "bg-surface shadow-edge" : "text-body hover:text-ink",
            )}
          >
            {INTERVAL_LABEL[i]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const price = plan.id === "free" ? 0 : plan.priceUsd[interval];
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col gap-6 rounded-card bg-surface p-6 md:p-8",
                plan.highlighted ? "shadow-[inset_0_0_0_1px_var(--ink)]" : "shadow-edge",
              )}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl tracking-[-0.02em]">{plan.name}</h3>
                  {plan.highlighted ? <span className="rounded-pill bg-sunk px-2.5 py-0.5 text-xs font-medium text-ink">Most chosen</span> : null}
                </div>
                <p className="text-sm text-body">{plan.tagline}</p>
              </div>
              <p className="flex items-baseline gap-1">
                <span className="font-display text-5xl leading-none tracking-[-0.045em] text-ink tabular-nums">${price ?? "-"}</span>
                <span className="text-sm text-body">{plan.id === "free" ? "once" : PER[interval]}</span>
              </p>
              <ul className="flex flex-1 flex-col gap-2 text-sm text-body">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check size={16} weight="regular" className="mt-0.5 shrink-0 text-icon" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <ButtonLink href={plan.id === "free" ? "/sign-up" : `/sign-up?plan=${plan.id}&interval=${interval}`} variant={plan.highlighted ? "primary" : "secondary"}>
                {plan.id === "free" ? "Start free" : `Choose ${plan.name}`}
              </ButtonLink>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-body">You are only charged a credit when an application is actually submitted. Failed submits never count.</p>
    </div>
  );
}
