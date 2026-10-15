import { describe, expect, it } from "vitest";
import { formatCredits, formatPerApp, formatStamp, formatTime, formatUsd } from "@/lib/landing/format";

describe("formatUsd", () => {
  it("prints two decimals from integer cents", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(3900)).toBe("$39.00");
    expect(formatUsd(5)).toBe("$0.05");
    expect(formatUsd(18900)).toBe("$189.00");
    expect(formatUsd(123456)).toBe("$1,234.56");
  });
});

describe("formatPerApp", () => {
  it("prints three decimals from integer thousandths", () => {
    expect(formatPerApp(65)).toBe("$0.065");
    expect(formatPerApp(33)).toBe("$0.033");
    expect(formatPerApp(0)).toBe("$0.000");
    expect(formatPerApp(39000)).toBe("$39.000");
    expect(formatPerApp(189000)).toBe("$189.000");
    expect(formatPerApp(1890)).toBe("$1.890");
  });
});

describe("formatCredits", () => {
  it("groups thousands with en-US commas", () => {
    expect(formatCredits(1200)).toBe("1,200");
    expect(formatCredits(0)).toBe("0");
  });
});

describe("formatStamp", () => {
  it("uses short date and short time in the runtime locale", () => {
    const iso = "2026-10-15T14:02:00.000Z";
    const want = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
    expect(formatStamp(iso)).toBe(want);
  });
  it("falls back to the word sample for an unparseable value", () => {
    expect(formatStamp("nope")).toBe("sample");
  });
});

describe("formatTime", () => {
  it("prints a time for an ISO string and nothing for garbage", () => {
    expect(formatTime("2026-10-15T14:05:00.000Z")).toMatch(/\d/);
    expect(formatTime("not a date")).toBe("");
  });
});
