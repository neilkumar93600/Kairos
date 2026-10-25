"use client";

import { useSearchParams } from "next/navigation";

/** Shown after Stripe returns with ?checkout=success. Needs a Suspense boundary (useSearchParams). */
export function CheckoutNote() {
  if (useSearchParams().get("checkout") !== "success") return null;
  return (
    <p role="status" className="mb-6 flex max-w-5xl items-center gap-3 glass-panel rounded-card px-5 py-4 text-sm text-ink">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-lime shadow-[0_0_0_1px_var(--ink)]" />
      Payment received. Your plan and credits update within a minute; reload if the numbers below look old.
    </p>
  );
}
