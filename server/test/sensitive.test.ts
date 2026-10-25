import { describe, expect, it } from "vitest";
import { classifySensitive } from "../src/services/sensitive";

describe("classifySensitive", () => {
  const cases: [string, ReturnType<typeof classifySensitive>][] = [
    ["Will you now or in the future require sponsorship?", "sponsorship"],
    ["Are you legally authorized to work in the United States?", "work_authorization"],
    ["Desired salary", "salary"],
    ["Veteran status", "eeo"],
    ["Why this team?", null],
    ["Disability status", "eeo"],
    ["What is your gender?", "eeo"],
    ["Race / Ethnicity", "eeo"],
    ["Sexual orientation", "eeo"],
    ["Preferred pronouns", "eeo"],
    ["Are you Hispanic/Latino?", "eeo"],
    ["Do you need a visa to work here?", "sponsorship"],
    ["Expected salary", "salary"],
    ["Compensation expectations", "salary"],
    ["What is your desired pay?", "salary"],
    ["Describe a time you raised the bar", null],
    ["Tell us about a project you are proud of", null],
    ["What interests you about our mission?", null],
    // Review findings: these reached the model before.
    ["Are you a U.S. citizen or permanent resident?", "work_authorization"],
    ["Can you legally work in the United States?", "work_authorization"],
    ["Are you legally able to work in the US?", "work_authorization"],
    ["expected CTC?", "salary"],
    ["What pay are you looking for?", "salary"],
    ["Do you identify as LGBTQ+?", "eeo"],
    ["green card", "work_authorization"],
    ["Immigration status", "work_authorization"],
    ["Will you require green card sponsorship?", "sponsorship"],
    ["Monthly stipend expected", "salary"],
    ["Do you have experience with PayPal integrations?", null],
  ];
  it.each(cases)("%s", (label, expected) => {
    expect(classifySensitive(label)).toBe(expected);
  });
});
