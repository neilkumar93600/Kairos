import { describe, expect, it } from "vitest";
import { describeSource, failureText, stateFor, summarize } from "../src/lib/panel";

describe("describeSource", () => {
  it.each([
    ["https://job-boards.greenhouse.io/acme-corp/jobs/123", "Acme corp · Greenhouse"],
    ["https://boards.greenhouse.io/acme/jobs/1", "Acme · Greenhouse"],
    ["https://jobs.lever.co/acme_labs/abc", "Acme labs · Lever"],
    ["https://jobs.ashbyhq.com/acme/uuid/application", "Acme · Ashby"],
  ])("names the company and board of %s", (url, expected) => {
    expect(describeSource(url)).toBe(expected);
  });

  it("does not match a host that only ends with a board's name", () => {
    expect(describeSource("https://evillever.co/acme")).toBe("Acme · evillever.co");
  });

  it("returns nothing for a bad URL instead of throwing, which would blank the whole panel", () => {
    expect(describeSource("not a url")).toBe("");
  });
});

describe("failureText", () => {
  it("never says nothing was sent when the employer may have received it", () => {
    for (const reason of ["No confirmation after submit", "No confirmation; unfilled: Resume"]) {
      const text = failureText(reason);
      expect(text).toContain("could not confirm");
      expect(text).not.toContain("Nothing was sent");
    }
  });

  it("says nothing was sent when the form never went", () => {
    expect(failureText("Submit button not found")).toBe("Submit button not found. Nothing was sent and no credit was used.");
    expect(failureText("Required fields left empty: 3. Review the form in the tab.")).toBe(
      "Required fields left empty: 3. Review the form in the tab. Nothing was sent and no credit was used.",
    );
    expect(failureText()).toBe("Nothing was sent and no credit was used.");
  });
});

describe("stateFor", () => {
  it("offers the buttons again after a closed tab, with a warning to check first", () => {
    const state = stateFor({ outcome: "closed" });
    expect(state.kind).toBe("idle");
    expect(state.kind === "idle" && state.note).toContain("before you send it again");
  });
});

it("summarize pluralizes", () => {
  expect(summarize(1)).toBe("1 approved application waiting.");
  expect(summarize(3)).toBe("3 approved applications waiting.");
  expect(summarize(0)).toBe("Nothing left to send.");
});
