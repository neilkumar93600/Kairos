import { describe, expect, it } from "vitest";
import { enforceTruthLock } from "../src/services/tailor";

describe("enforceTruthLock", () => {
  const allowed = new Set(["f1", "f2"]);

  it("keeps lines that cite only the user's facts", () => {
    const line = { id: "l1", section: "Experience", text: "Built a billing API", factIds: ["f1"] };
    expect(enforceTruthLock([line], allowed)).toEqual({ kept: [line], rejected: [] });
  });

  it("drops lines that cite unknown facts or none", () => {
    const invented = { id: "l2", section: "Skills", text: "Kubernetes expert", factIds: ["f9"] };
    const uncited = { id: "l3", section: "Skills", text: "Led 40 engineers", factIds: [] };
    const result = enforceTruthLock([invented, uncited], allowed);
    expect(result.kept).toEqual([]);
    expect(result.rejected.map((r) => r.line.id)).toEqual(["l2", "l3"]);
  });
});
