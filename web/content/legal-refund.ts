import type { LegalSection } from "@/components/legal/legal-document";
import { siteConfig } from "@/lib/site";

const support = `[${siteConfig.supportEmail}](mailto:${siteConfig.supportEmail})`;

/**
 * The refund terms (README D10): one object, rendered by terms, privacy and cookies, so the copies cannot drift.
 * The heading makes the anchor #refunds; /refunds redirects to /terms#refunds. Every line is checked against the code;
 * docs/superpowers/specs/2026-11-03-marketing-surfaces/03-legal-owner-checks.md lists what the owner still has to decide.
 */
export const refundSection: LegalSection = {
  heading: "Refunds",
  body: [
    "These refund terms are the same on our terms, privacy and cookie pages.",
    "**Credits.** You pay for applications that go through. One credit is used when the employer's page shows its confirmation to the Kairos extension or the cloud applier. If a submission fails, or Kairos cannot confirm it, no credit is used. A credit that was used does not come back automatically, so write to us if you think one was used by mistake.",
    "**Charges.** Refunds of plan charges are not automatic, so write to " + support + " with the date and amount. If you write within 14 days of a charge and have not sent an application with its credits, we refund it. A person reviews every other request. A refund goes back through Stripe, our payment processor, and we remove the unused credits it paid for.",
    "**Cancelling.** Cancel at any time from the Billing page, which opens Stripe's customer portal. After you cancel, Stripe does not charge you again. Your plan runs to the end of the period you paid for and then moves to Free. Cancelling does not refund that period.",
    "**Got the job?** Kairos does not pause or cancel your plan by itself. It labels a forwarded offer email in Replies, and that label changes nothing in billing. To stop being charged, cancel from the Billing page.",
    "**Deleting your account.** This cancels your subscription straight away and removes your unused credits. It does not refund a charge by itself.",
    "Nothing here limits any refund or cancellation right the law gives you where you live.",
  ],
};
