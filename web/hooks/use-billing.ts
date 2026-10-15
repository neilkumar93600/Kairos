"use client";

import { useMutation } from "@tanstack/react-query";
import type { BillingInterval, PlanId } from "@auto-career/shared";
import { post } from "@/lib/api";

/** Both actions redirect the browser to Stripe. */
export function useBilling() {
  return {
    checkout: useMutation({
      mutationFn: (input: { plan: Exclude<PlanId, "free">; interval: BillingInterval }) => post<{ url: string }>("/billing/checkout", input),
      onSuccess: ({ url }) => window.location.assign(url),
    }),
    portal: useMutation({
      mutationFn: () => post<{ url: string }>("/billing/portal"),
      onSuccess: ({ url }) => window.location.assign(url),
    }),
  };
}
