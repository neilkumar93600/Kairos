import { describe, expect, it } from "vitest";
import { blocksCheckout, checkoutIdempotencyKey } from "../src/routes/billing";
import { availableCredits } from "../src/services/credits";
import { creditsPerInvoice, planForPriceId } from "../src/services/stripe";

describe("billing math", () => {
  it("grants a week's share on weekly invoices and three months on quarterly ones", () => {
    expect(creditsPerInvoice("starter", "month")).toBe(1000);
    expect(creditsPerInvoice("starter", "week")).toBe(234);
    expect(creditsPerInvoice("starter", "quarter")).toBe(3000);
    expect(creditsPerInvoice("pro", "quarter")).toBe(3600);
  });

  it("maps a Stripe price id back to its plan and interval", () => {
    expect(planForPriceId("price_pro_week")).toEqual({ plan: "pro", interval: "week" });
    expect(planForPriceId("price_unknown")).toBeNull();
  });

  it("never reports negative available credits", () => {
    expect(availableCredits(3, 5)).toBe(0);
    expect(availableCredits(10, 4)).toBe(6);
  });
});

describe("checkout guards", () => {
  it("one checkout idempotency key per user, plan and interval within a five-minute bucket", () => {
    const t = Date.UTC(2026, 10, 3, 10, 0, 0);
    expect(checkoutIdempotencyKey("u1", "pro", "month", t)).toBe(checkoutIdempotencyKey("u1", "pro", "month", t + 299_000));
    expect(checkoutIdempotencyKey("u1", "pro", "month", t)).toMatch(/^checkout:u1:pro:month:\d+$/);
    expect(checkoutIdempotencyKey("u1", "pro", "month", t)).not.toBe(checkoutIdempotencyKey("u1", "pro", "month", t + 300_000));
    expect(checkoutIdempotencyKey("u1", "pro", "month", t)).not.toBe(checkoutIdempotencyKey("u1", "max", "month", t));
    expect(checkoutIdempotencyKey("u1", "pro", "month", t)).not.toBe(checkoutIdempotencyKey("u2", "pro", "month", t));
  });

  // A live subscription sends the user to the portal (change plan, fix the card) instead of a second subscription.
  it.each([
    ["active", true],
    ["trialing", true],
    ["past_due", true],
    ["unpaid", true],
    ["paused", true],
    ["incomplete", false],
    ["incomplete_expired", false],
    ["canceled", false],
  ])("a %s subscription blocks a new checkout: %s", (status, blocks) => {
    expect(blocksCheckout(status)).toBe(blocks);
  });
});
