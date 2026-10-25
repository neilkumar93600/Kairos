import { describe, expect, it } from "vitest";
import { computeReceipt, creditsPerInvoice, type ReceiptInput } from "@/lib/landing/calculator";

const r = (o: Partial<ReceiptInput> = {}) =>
  computeReceipt({ plan: "pro", interval: "month", submitted: 600, failed: 3, ...o });

describe("creditsPerInvoice", () => {
  it("grants per invoice: weekly ceil(n*7/30), monthly n, quarterly 3n", () => {
    expect(creditsPerInvoice("starter", "week")).toBe(234);
    expect(creditsPerInvoice("pro", "week")).toBe(280);
    expect(creditsPerInvoice("max", "week")).toBe(700);
    expect(creditsPerInvoice("starter", "month")).toBe(1000);
    expect(creditsPerInvoice("pro", "month")).toBe(1200);
    expect(creditsPerInvoice("max", "month")).toBe(3000);
    expect(creditsPerInvoice("starter", "quarter")).toBe(3000);
    expect(creditsPerInvoice("pro", "quarter")).toBe(3600);
    expect(creditsPerInvoice("max", "quarter")).toBe(9000);
  });
});

describe("computeReceipt full use", () => {
  it("matches the published per-application figures", () => {
    const full = (plan: ReceiptInput["plan"], interval: ReceiptInput["interval"]) =>
      r({ plan, interval, submitted: 1 }).fullUseThousandths;
    expect([full("starter", "month"), full("pro", "month"), full("max", "month")]).toEqual([19, 33, 26]);
    expect([full("starter", "week"), full("pro", "week"), full("max", "week")]).toEqual([26, 43, 36]);
    expect([full("starter", "quarter"), full("pro", "quarter"), full("max", "quarter")]).toEqual([15, 26, 21]);
  });
});

describe("computeReceipt Pro Monthly table", () => {
  const rows: [number, number | null, number, number][] = [
    [0, null, 1200, 0],
    [1, 39000, 1199, 0.0008],
    [120, 325, 1080, 0.1],
    [300, 130, 900, 0.25],
    [600, 65, 600, 0.5],
    [900, 43, 300, 0.75],
    [1200, 33, 0, 1],
  ];
  it.each(rows)("submitted %i", (submitted, perApp, remaining, use) => {
    const res = r({ submitted });
    expect(res.perAppThousandths).toBe(perApp);
    expect(res.remaining).toBe(remaining);
    expect(res.use).toBe(use);
    expect(res.priceCents).toBe(3900);
    expect(res.credits).toBe(1200);
    expect(res.fullUseThousandths).toBe(33);
  });
});

describe("computeReceipt rounding", () => {
  it("rounds half up in integer thousandths", () => {
    expect(r({ plan: "starter", interval: "week", submitted: 47 }).perAppThousandths).toBe(128);
    expect(r({ plan: "max", interval: "quarter", submitted: 100 }).perAppThousandths).toBe(1890);
    expect(r({ plan: "starter", interval: "month", submitted: 400 }).perAppThousandths).toBe(48); // 47.5
    expect(r({ plan: "pro", interval: "month", submitted: 1200 }).perAppThousandths).toBe(33); // 32.5
  });
});

describe("computeReceipt failed submissions", () => {
  it("cost 0 credits and 0 cents for every count, and never change credits", () => {
    const base = r({ failed: 0 });
    for (let f = 0; f <= 99; f++) {
      const res = r({ failed: f });
      expect(res.failedCents).toBe(0);
      expect(res.failed).toBe(f);
      expect(res.remaining).toBe(base.remaining);
      expect(res.perAppThousandths).toBe(base.perAppThousandths);
    }
  });
});

describe("computeReceipt clamping", () => {
  it("clamps submitted to [0, credits] and failed to [0, 99]", () => {
    expect(r({ submitted: -5 }).submitted).toBe(0);
    expect(r({ submitted: 99999 }).submitted).toBe(1200);
    expect(r({ failed: -1 }).failed).toBe(0);
    expect(r({ failed: 500 }).failed).toBe(99);
  });
  it("treats NaN as 0 and truncates floats", () => {
    expect(r({ submitted: Number.NaN }).submitted).toBe(0);
    expect(r({ failed: Number.NaN }).failed).toBe(0);
    expect(r({ submitted: 10.9 }).submitted).toBe(10);
  });
});
