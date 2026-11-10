import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetOnboarding } from "@/lib/onboarding/session";

/** Just enough of sessionStorage for the helper: length, key(i), removeItem. */
function fakeStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("forgetOnboarding", () => {
  it("drops every kairos.onboarding. key and nothing else", () => {
    const store = fakeStorage({
      "kairos.onboarding.importId": "imp-1",
      "kairos.onboarding.resumeId": "{}",
      "kairos.onboarding.form.u2.contact": "{}",
      "kairos.newsletter.seen": "1",
    });
    vi.stubGlobal("sessionStorage", store);
    forgetOnboarding();
    expect([...store.map.keys()]).toEqual(["kairos.newsletter.seen"]);
  });

  it("does nothing when storage is blocked", () => {
    vi.stubGlobal("sessionStorage", {
      get length(): number {
        throw new Error("blocked");
      },
    });
    expect(() => forgetOnboarding()).not.toThrow();
  });
});
