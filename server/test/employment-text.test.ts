import { describe, expect, it } from "vitest";
import { datesText, roleFactText } from "../src/services/employment-text";

describe("employment text", () => {
  it("formats the dates", () => {
    expect(datesText("2021-03", "2023-11", false)).toBe("Mar 2021 to Nov 2023");
    expect(datesText("2021-03", null, true)).toBe("Mar 2021 to now");
    expect(datesText("2021-03", null, false)).toBe("Mar 2021");
    expect(datesText(null, "2023-11", false)).toBeNull();
    expect(datesText(null, null, true)).toBeNull();
  });

  it("builds the role fact text", () => {
    expect(roleFactText("Engineer", "Acme", "Mar 2021 to now")).toBe("Engineer at Acme, Mar 2021 to now");
    expect(roleFactText("Engineer", "Acme", null)).toBe("Engineer at Acme");
    expect(roleFactText("E".repeat(200), "A".repeat(200), "Mar 2021 to now").length).toBeLessThanOrEqual(400);
  });
});
