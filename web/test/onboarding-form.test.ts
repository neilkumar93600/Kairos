import { describe, expect, it } from "vitest";
import { certificationFact, draftKey, educationFact, languagesFact, parseLanguages, projectFact, skillFacts } from "@/lib/onboarding/form-facts";

describe("educationFact", () => {
  it("joins degree and field, school, and the years", () => {
    expect(educationFact({ school: "Sample University", degree: "B.Tech", field: "Computer Science", start: "2018", end: "2022" })).toBe(
      "B.Tech Computer Science, Sample University, 2018 to 2022",
    );
  });

  it("adds the grade when given", () => {
    expect(educationFact({ school: "Sample University", degree: "B.Tech", field: "Computer Science", start: "2018", end: "2022", grade: "8.4" })).toBe(
      "B.Tech Computer Science, Sample University, 2018 to 2022, grade 8.4",
    );
  });

  it("leaves out what is empty", () => {
    expect(educationFact({ school: " Sample University ", degree: "MBA", field: "", end: "2024" })).toBe("MBA, Sample University, 2024");
    expect(educationFact({ school: "Sample University", degree: "MBA" })).toBe("MBA, Sample University");
  });
});

describe("skillFacts", () => {
  it("groups up to 10 skills per fact", () => {
    const skills = Array.from({ length: 23 }, (_, i) => `Skill ${i + 1}`);
    const facts = skillFacts(skills);
    expect(facts).toHaveLength(3);
    expect(facts[0].split(", ")).toHaveLength(10);
    expect(facts[2]).toBe("Skill 21, Skill 22, Skill 23");
  });

  it("returns nothing for no skills", () => {
    expect(skillFacts([])).toEqual([]);
  });

  it("names a group too short for a fact (3 characters)", () => {
    expect(skillFacts(["Go"])).toEqual(["Skills: Go"]);
  });
});

describe("languagesFact", () => {
  it("lists the languages", () => {
    expect(languagesFact(["English", "Hindi"])).toBe("Languages: English, Hindi");
  });

  it("is null when the list is empty", () => {
    expect(languagesFact([])).toBeNull();
  });

  it("reads back into the list, and only from a languages fact", () => {
    expect(parseLanguages("Languages: English, Hindi")).toEqual(["English", "Hindi"]);
    expect(parseLanguages(languagesFact(["Tamil"]) ?? "")).toEqual(["Tamil"]);
    expect(parseLanguages("TypeScript, SQL")).toBeNull();
  });
});

describe("projectFact and certificationFact", () => {
  it("project: name, what it did, then the link", () => {
    expect(projectFact({ name: "Job board", what: "Built a search page", link: "https://example.com" })).toBe(
      "Job board: Built a search page (https://example.com)",
    );
    expect(projectFact({ name: "Job board", what: "", link: "" })).toBe("Job board");
  });

  it("certification: name, issuer, year", () => {
    expect(certificationFact({ name: "Cloud Practitioner", issuer: "Sample Institute", year: "2023" })).toBe("Cloud Practitioner, Sample Institute, 2023");
    expect(certificationFact({ name: "Cloud Practitioner", issuer: "", year: "" })).toBe("Cloud Practitioner");
  });
});

describe("draftKey", () => {
  it("namespaces the section under the user", () => {
    expect(draftKey("u1", "experience")).toBe("kairos.onboarding.form.u1.experience");
    expect(draftKey("u1", "experience")).not.toBe(draftKey("u10", "experience"));
    expect(draftKey("u10", "x").startsWith(draftKey("u1", ""))).toBe(false);
  });
});
