import { afterEach, describe, expect, it, vi } from "vitest";
import { isPopupRoute, popupAllowed, POPUP_KEY, readKey, scrollDepthReached, writeKey } from "../components/marketing/popup/gate";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("isPopupRoute", () => {
  it("allows /blog, /blog/* and /about only", () => {
    for (const r of ["/blog", "/blog/how-the-truth-lock-works", "/about"]) expect(isPopupRoute(r)).toBe(true);
    for (const r of ["/", "/pricing", "/login", "/sign-up", "/terms", "/privacy", "/cookies", "/contact", "/dashboard", "/newsletter", "/blogger", "/about-us"])
      expect(isPopupRoute(r)).toBe(false);
  });
});

describe("popupAllowed", () => {
  it("shows when nothing is stored", () => expect(popupAllowed(null, null, NOW)).toBe(true));

  it("holds the 30-day cap to the millisecond", () => {
    expect(popupAllowed(null, String(NOW - 30 * DAY + 1), NOW)).toBe(false);
    expect(popupAllowed(null, String(NOW - 30 * DAY), NOW)).toBe(true);
  });

  it("never shows to a subscriber, whatever the cap says", () => {
    expect(popupAllowed("1", null, NOW)).toBe(false);
    expect(popupAllowed("1", String(NOW - 90 * DAY), NOW)).toBe(false);
  });

  it("fails closed without storage, because the cap cannot be kept", () => {
    expect(popupAllowed(undefined, null, NOW)).toBe(false);
    expect(popupAllowed(null, undefined, NOW)).toBe(false);
  });

  it("treats a corrupt timestamp as none and a future one as just shown", () => {
    expect(popupAllowed(null, "not-a-number", NOW)).toBe(true);
    expect(popupAllowed(null, String(NOW + DAY), NOW)).toBe(false);
  });
});

describe("storage wrappers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("swallow a throwing localStorage and report it", () => {
    const boom = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
    expect(readKey(POPUP_KEY)).toBeUndefined();
    expect(writeKey(POPUP_KEY, "1")).toBe(false);
  });
});

describe("scrollDepthReached", () => {
  it("fires at 60 percent of the scrollable distance, never on a page too short to scroll", () => {
    expect(scrollDepthReached(599, 1000, 2000)).toBe(false);
    expect(scrollDepthReached(600, 1000, 2000)).toBe(true);
    expect(scrollDepthReached(0, 1000, 800)).toBe(false);
  });
});
