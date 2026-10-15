import type { Metadata } from "next";
import { CreditLedger } from "@/components/dashboard/billing/credit-ledger";
import { PlanSummary } from "@/components/dashboard/billing/plan-summary";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <>
      <PageTitle title="Billing" body="Credits are only used when an application goes through. Failed submits never cost one." />
      <div className="flex flex-col gap-12">
        <PlanSummary />
        <section className="flex flex-col gap-4">
          <h2 className="">Credit ledger</h2>
          <CreditLedger />
        </section>
      </div>
    </>
  );
}
