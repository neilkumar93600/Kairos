/**
 * Single source of truth for plans. The web pricing page renders from this list and the
 * server grants credits from it. Stripe price ids live in server env, keyed by `PlanId` + interval.
 * Prices are launch prices (see docs/pricing.md) and are meant to be tested with beta users.
 */

export const PLAN_IDS = ["free", "starter", "pro", "max"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const BILLING_INTERVALS = ["week", "month", "quarter"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** USD price per interval; null when the interval is not sold for this plan. */
  priceUsd: Record<BillingInterval, number | null>;
  /** Successful submissions per 30-day cycle (free plan: one-time grant). */
  applicationsPerCycle: number;
  resumeProfiles: number;
  cloudApplier: boolean;
  priorityPolling: boolean;
  outcomeReport: boolean;
  coverLetters: boolean;
  /** Proposes answers to recurring questions after a submit, for the user to approve. */
  answerMemory: boolean;
  highlighted: boolean;
  features: string[];
}

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try it on 25 real applications.",
    priceUsd: { week: null, month: 0, quarter: null },
    applicationsPerCycle: 25,
    resumeProfiles: 1,
    cloudApplier: false,
    priorityPolling: false,
    outcomeReport: false,
    coverLetters: false,
    answerMemory: false,
    highlighted: false,
    features: [
      "25 submitted applications, once",
      "Fit gate with reasons on every match",
      "Truth-locked resume tailoring",
      "Edit everything before it sends",
      "Chrome extension apply",
      "Reply tracking by forwarding",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For a steady search at your own pace.",
    priceUsd: { week: 6, month: 19, quarter: 45 },
    applicationsPerCycle: 400,
    resumeProfiles: 1,
    cloudApplier: false,
    priorityPolling: false,
    outcomeReport: false,
    coverLetters: true,
    answerMemory: true,
    highlighted: false,
    features: [
      "400 submitted applications per 30 days",
      "Everything in Free",
      "Tailored cover letters",
      "Answer memory you approve",
      "Failed submits cost nothing",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Applies even when your laptop is closed.",
    priceUsd: { week: 12, month: 39, quarter: 95 },
    applicationsPerCycle: 1200,
    resumeProfiles: 3,
    cloudApplier: true,
    priorityPolling: false,
    outcomeReport: true,
    coverLetters: true,
    answerMemory: true,
    highlighted: true,
    features: [
      "1,200 submitted applications per 30 days",
      "Everything in Starter",
      "Cloud applier: sends approved applications with your browser closed",
      "Weekly outcome report and targeting suggestions",
      "3 resume profiles",
    ],
  },
  {
    id: "max",
    name: "Max",
    tagline: "For searches that cannot wait.",
    priceUsd: { week: 25, month: 79, quarter: 189 },
    applicationsPerCycle: 3000,
    resumeProfiles: 10,
    cloudApplier: true,
    priorityPolling: true,
    outcomeReport: true,
    coverLetters: true,
    answerMemory: true,
    highlighted: false,
    features: [
      "3,000 submitted applications per 30 days",
      "Everything in Pro",
      "Priority polling: new postings checked every 5 minutes",
      "10 resume profiles",
      "Priority support",
    ],
  },
];

export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}

/**
 * Credits granted per paid invoice. Plans are sized per 30 days, so a weekly invoice grants a week's share
 * and a quarterly invoice grants three months. Billing and the landing calculator both read this.
 */
export function creditsPerInvoice(plan: PlanId, interval: BillingInterval): number {
  const perCycle = getPlan(plan).applicationsPerCycle;
  if (interval === "week") return Math.ceil((perCycle * 7) / 30);
  if (interval === "quarter") return perCycle * 3;
  return perCycle;
}
