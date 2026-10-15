import { describe, expect, it } from "vitest";
import { availableCredits } from "../src/services/credits";
import { creditsPerInvoice, planForPriceId } from "../src/services/stripe";

describe("billing math", () => {
  it("grants a week's share on weekly invoices and three months on quarterly ones", () => {
    expect(creditsPerInvoice("starter", "month")).toBe(400);
    expect(creditsPerInvoice("starter", "week")).toBe(94);
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
