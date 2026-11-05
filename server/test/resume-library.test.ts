import { describe, expect, it } from "vitest";
import { resumeInputSchema } from "@auto-career/shared";
import { defaultResume, truthLockViolations } from "../src/services/resume-doc";
import { bestBaseFor } from "../src/services/resume-library";

const contact = { name: "A", email: "a@x.io", phone: "", location: "", links: [] };

describe("defaultResume: employment-aware (resume-02)", () => {
  const facts = [
    { id: "f1", kind: "role" as const, text: "Automated the weekly scorecard", confirmed: true, employmentId: "e1" },
    { id: "f2", kind: "metric" as const, text: "Saved 6 hours a week", confirmed: true, employmentId: "e1" },
    { id: "f3", kind: "metric" as const, text: "Unconfirmed result", confirmed: false, employmentId: "e1" },
    { id: "f4", kind: "role" as const, text: "Volunteer tutor", confirmed: true, employmentId: null },
    { id: "f5", kind: "role" as const, text: "Under an unconfirmed role", confirmed: true, employmentId: "e2" },
  ];
  const roles = [
    { id: "e1", title: "Data Analyst", company: "Sample Co", datesText: "Feb 2022 - Present", confirmed: true },
    { id: "e2", title: "Intern", company: "Other Co", datesText: null, confirmed: false },
  ];

  it("puts a confirmed role's confirmed facts under one entry, citing only confirmed facts", () => {
    const doc = defaultResume(facts, contact, roles);
    const exp = doc.sections.find((s) => s.kind === "experience")!;
    expect(exp.entries[0]).toMatchObject({ heading: "Data Analyst", subheading: "Sample Co", meta: "Feb 2022 - Present", headingFactId: "f1" });
    expect(exp.entries[0]!.lines.map((l) => l.text)).toEqual(["Automated the weekly scorecard", "Saved 6 hours a week"]);
    // A fact under an unconfirmed role, and one under none, stay their own entries.
    expect(exp.entries.slice(1).map((e) => e.heading)).toEqual(["Volunteer tutor", "Under an unconfirmed role"]);
    expect(resumeInputSchema.safeParse(doc).success).toBe(true);
    expect(truthLockViolations(doc, new Set(["f1", "f2", "f4", "f5"]))).toEqual([]);
  });

  it("is today's document without employments", () => {
    expect(defaultResume(facts, contact)).toEqual(defaultResume(facts.map(({ employmentId: _, ...f }) => f), contact));
  });
});

describe("bestBaseFor (PRD 6.2)", () => {
  const at = (d: number) => new Date(2026, 0, d);
  const bases = [
    { id: "default", targetRoles: [], updatedAt: at(1), isDefault: true },
    { id: "data", targetRoles: ["Data Analyst"], updatedAt: at(2), isDefault: false },
    { id: "data2", targetRoles: ["Analytics Engineer", "Data Engineer"], updatedAt: at(3), isDefault: false },
  ];
  it("takes the most shared title words, ties to the newest edit, else the default", () => {
    expect(bestBaseFor(bases, "Senior Data Analyst")!.id).toBe("data");
    expect(bestBaseFor(bases, "Data Scientist")!.id).toBe("data2");
    expect(bestBaseFor(bases, "Nurse")!.id).toBe("default");
  });
});
