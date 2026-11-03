import { describe, expect, it } from "vitest";
import { factHash, finalizeFacts, normalizeForHash } from "../src/services/import/finalize";

const SOURCE = [
  "EXPERIENCE",
  "Data Analyst, Brightwater Parcel Co - Columbus, OH",
  "Automated the weekly carrier scorecard in Python, saving 6 hours a week",
  "Built Tableau dashboards for 12 regional managers",
].join("\n");

describe("finalizeFacts: the checks between the parser and the fact bank", () => {
  it("keeps grounded facts with their identity hash", () => {
    const { kept, counts } = finalizeFacts([{ kind: "metric", text: "Saved 6 hours a week on the carrier scorecard", sourceSpan: "saving 6 hours a week" }], SOURCE);
    expect(kept).toEqual([expect.objectContaining({ text: "Saved 6 hours a week on the carrier scorecard", sourceSpanHash: factHash("metric", "saved 6 hours  a week on the carrier scorecard") })]);
    expect(counts).toEqual({ notInSource: 0, sensitive: 0, deduped: 0 });
  });

  it("drops a fact with a number, employer or tool the source does not hold (V6)", () => {
    const { kept, counts } = finalizeFacts(
      [
        { kind: "metric", text: "Built Tableau dashboards for 40 regional managers", sourceSpan: "x" },
        { kind: "role", text: "Data Analyst at Globex", sourceSpan: "x" },
        { kind: "skill", text: "Looker", sourceSpan: "x" },
      ],
      SOURCE,
    );
    expect(kept).toEqual([]);
    expect(counts.notInSource).toBe(3);
  });

  it("drops sensitive and contact facts, cleans bullets, brackets short skills and dedupes (V7, V9, V10)", () => {
    const { kept, counts } = finalizeFacts(
      [
        { kind: "role", text: "Visa Status: H-1B", sourceSpan: "x" },
        { kind: "role", text: "Reach me at sample@example.com", sourceSpan: "x" },
        { kind: "role", text: "[email]", sourceSpan: "x" },
        { kind: "role", text: "• Automated the weekly carrier scorecard in Python", sourceSpan: "x" },
        { kind: "role", text: "automated the weekly   carrier scorecard in Python", sourceSpan: "x" },
        { kind: "skill", text: "R", sourceSpan: "x" },
      ],
      `${SOURCE}\nSkills: R`,
    );
    expect(counts).toEqual({ notInSource: 0, sensitive: 3, deduped: 1 });
    expect(kept.map((f) => f.text)).toEqual(["Automated the weekly carrier scorecard in Python", "R (skill)"]);
  });

  it("normalizes for the hash: case, width and spaces", () => {
    expect(normalizeForHash("  Ｐython\tSQL ")).toBe("python sql");
  });
});
