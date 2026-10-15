import { creditsPerInvoice, getPlan, type BillingInterval } from "@auto-career/shared";

export { creditsPerInvoice };

/**
 * Receipt calculator (entry 07). Pure, integer arithmetic for money: no float division in any
 * price. Cards, calculator and tests all use this one function.
 */

export type CalcPlanId = "starter" | "pro" | "max";

export interface ReceiptInput {
  plan: CalcPlanId;
  interval: BillingInterval;
  submitted: number;
  failed: number;
}

export interface ReceiptResult {
  /** PLANS price * 100 for the interval. */
  priceCents: number;
  /** Credits granted per invoice for the interval. */
  credits: number;
  /** Clamped to [0, credits]. */
  submitted: number;
  /** Clamped to [0, 99]. */
  failed: number;
  /** Always 0: a failed submit is never charged (PRD AC10). */
  failedCents: 0;
  remaining: number;
  /** null when submitted === 0. */
  perAppThousandths: number | null;
  /** Round half up of priceCents * 10 / credits. */
  fullUseThousandths: number;
  /** submitted / credits, 0..1, four decimals (drives the usage tick; not money). */
  use: number;
}

/** round-half-up(cents * 10 / units) in integers. units must be > 0. */
const thousandths = (cents: number, units: number) => Math.floor((cents * 20 + units) / (units * 2));

const clamp = (v: number, min: number, max: number) => {
  const n = Number.isFinite(v) ? Math.trunc(v) : 0; // NaN and Infinity count as 0
  return Math.min(max, Math.max(min, n));
};

export function computeReceipt(i: ReceiptInput): ReceiptResult {
  const price = getPlan(i.plan).priceUsd[i.interval];
  if (price == null) throw new Error(`Plan ${i.plan} is not sold per ${i.interval}`);
  const priceCents = price * 100;
  const credits = creditsPerInvoice(i.plan, i.interval);
  const submitted = clamp(i.submitted, 0, credits);
  return {
    priceCents,
    credits,
    submitted,
    failed: clamp(i.failed, 0, 99),
    failedCents: 0,
    remaining: credits - submitted,
    perAppThousandths: submitted === 0 ? null : thousandths(priceCents, submitted),
    fullUseThousandths: thousandths(priceCents, credits),
    use: Math.round((submitted * 10000) / credits) / 10000,
  };
}
