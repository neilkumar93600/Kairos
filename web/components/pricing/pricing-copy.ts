// /pricing copy. Facts from docs/pricing.md, docs/01-prd.md and shared/src/plans.ts; prices, allowances and plan
// names are never typed here, they are read from PLANS. The notes are the landing's noteLaunch, noteStripe, noteIndia
// and noteRollover (06 copy deck 12.6), moved here by 08 1.7 and cut so no sentence repeats elsewhere on the page.
// No em or en dashes. G3 features carry "(in beta)" (landingCopy.pricing.betaFeatures).
import { landingCopy } from "@/content/landing-copy";

const { betaFeatures, betaTag } = landingCopy.pricing;

/** G3: "Cloud applier: sends ..." becomes "Cloud applier (in beta): sends ...". The same rule as the landing cards. */
export function gateFeature(text: string): string {
  const name = betaFeatures.find((b) => text.startsWith(b));
  return name ? `${name} ${betaTag}${text.slice(name.length)}` : text;
}

export const pricingCopy = {
  hero: {
    title: "Pay for applications that went through.",
    // 08 line 64: the hero microcopy that moved to /pricing, plus the intervals.
    lead: "Credits are only used when an application actually goes through. Bill weekly, monthly or quarterly.",
    artAlt: "A wooden footbridge crosses the river in the valley; a sealed envelope waits on its boards.",
    cards: [
      { title: "Company 014", status: "Submitted", credit: "−1 credit", charged: true },
      { title: "Company 027", status: "Failed · reason shown", credit: "0 credits", charged: false },
    ],
  },
  plans: {
    title: "Every plan keeps the same rules.",
    subline: "Higher plans add volume, resume profiles and the cloud applier (in beta).",
    // Quarterly only, per card, computed by quarterlySaving (pricing-plans.tsx); never typed.
    save: "Saves {n}% vs monthly",
    // Bone-track toggle (DESIGN "Plan Card and Billing Toggle": /pricing keeps it and solid cards).
    notes: [
      {
        label: "Launch prices",
        text: "Prices may change for new customers. Existing subscribers keep theirs for at least 90 days after a change, with 30 days' notice.",
      },
      { label: "Stripe, in US dollars", text: "Every plan is billed through Stripe on the interval you pick." },
      { label: "India", text: "Prices are the same in every country. Regional pricing for India is not in this version." },
    ],
  },
  calc: {
    title: "What your number would cost.",
    subline: "Pick how many applications you expect to send. The fewer you use, the more each one costs.",
    rollover: "Unused paid credits roll over while you subscribe, up to two invoices' worth of your plan.",
    label: "Applications per {unit}",
    valueText: "{n} submitted applications",
    // One result sentence: the smallest paid plan that covers the number, its price and the price per application.
    result: "{plan} fits at {price} a {unit}, which is {perApp} per application.",
    artAlt: "A small stack of receipts held down by a pebble on a stone in the noon meadow.",
  },
  compare: {
    title: "Every plan, line by line.",
    subline: "Allowances are per 30 days. A weekly invoice grants a week's share, a quarterly one three months.",
    feature: "Feature",
    yes: "Yes",
    no: "No",
    once: "{n}, once",
    // PRD: new postings are seen within 30 minutes, 5 on Max (priorityPolling); Max: "checked every 5 minutes".
    polling: { label: "Minutes between checks for new postings", standard: "30", priority: "5" },
  },
  faq: {
    title: "Questions about billing.",
    items: [
      {
        q: "Can I cancel any time?",
        a: "Yes. Cancel from the Stripe customer portal whenever you like. Your plan keeps working until the end of the period you paid for.",
      },
      {
        q: "What happens when I run out of credits?",
        a: "You cannot approve more drafts than you have credits: a larger batch is refused and nothing in it changes. Your next invoice adds new credits.",
      },
      {
        q: "Why is there a weekly plan?",
        a: "For searches on a short clock, such as the last weeks of OPT. Four weeks cost a little more than one month, so monthly stays the better rate for a longer search.",
      },
      {
        q: "Do you offer refunds?",
        a: "A failed submission never uses a credit, so there is nothing to refund for it. For plan charges, read the",
        link: { href: "/refunds", label: "refund policy" },
      },
    ],
  },
} as const;
