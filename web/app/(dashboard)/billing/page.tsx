import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutNote } from "@/components/dashboard/billing/checkout-note";
import { CreditBalance, CreditLedger } from "@/components/dashboard/billing/credit-ledger";
import { PlanSummary } from "@/components/dashboard/billing/plan-summary";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <>
      <PageTitle title="Billing" body="Credits are only used when an application goes through. Failed submits never cost one." />
      <Suspense fallback={null}>
        <CheckoutNote />
      </Suspense>
      <div className="flex max-w-5xl flex-col gap-6">
        <CreditBalance />
        <PlanSummary />
        <CreditLedger />
      </div>
    </>
  );
}
