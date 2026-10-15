import { BillingPlans } from "../islands/billing-plans";

/** Entry 07 (A8): pricing. The island renders the art banner, toggle, cards and guarantee banner so they share one state. */
export function Entry07Billing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="lp-section">
      <BillingPlans />
    </section>
  );
}
