import { describe, expect, it } from "vitest";
import { resumeInputSchema, type ResumeInput } from "@auto-career/shared";
import { defaultResume, profileContactFrom, renderResumeText, truthLockViolations, type ProfileFact } from "../src/services/resume-doc";

describe("profileContactFrom", () => {
  const contact = (over: Partial<ResumeInput["contact"]> = {}): ResumeInput["contact"] => ({
    name: "A",
    email: "a@x.io",
    phone: "",
    location: "",
    links: [],
    ...over,
  });

  it("maps phone, strips the default's country suffix from location, and blanks become null", () => {
    expect(profileContactFrom(contact({ phone: " 555-0100 ", location: "Austin, USA" }), "USA")).toEqual({ phone: "555-0100", city: "Austin" });
    expect(profileContactFrom(contact({ location: "Austin, TX" }), null)).toEqual({ phone: null, city: "Austin, TX" });
    expect(profileContactFrom(contact(), "USA")).toEqual({ phone: null, city: null });
  });

  it("sorts links by host, adds https to bare links and skips junk", () => {
    const out = profileContactFrom(contact({ links: ["www.linkedin.com/in/a", "https://github.com/a", "a.dev", "not a url", "https://b.dev"] }), null);
    expect(out).toMatchObject({
      linkedinUrl: "https://www.linkedin.com/in/a",
      githubUrl: "https://github.com/a",
      portfolioUrl: "https://a.dev/",
    });
  });
});

const fact = (id: string, kind: ProfileFact["kind"], text: string, confirmed = true): ProfileFact => ({ id, kind, text, sourceSpan: null, confirmed });

const facts: ProfileFact[] = [
  fact("r1", "role", "Software Engineer at Initech, 2021 to 2023"),
  fact("r2", "role", "Intern at Hooli, 2020", false),
  fact("p1", "project", "Built a React dashboard used by 2,000 customers"),
  fact("s1", "skill", "TypeScript"),
  fact("s2", "skill", "PostgreSQL"),
  fact("s3", "skill", "Kubernetes", false),
  fact("m1", "metric", "Cut p95 latency by 40%"),
  fact("e1", "education", "B.S. Computer Science, UC Davis, 2020"),
];
const contact = { name: "Ada Lovelace", email: "ada@example.com", phone: "555 0100", location: "Austin, US", links: [] };

describe("defaultResume", () => {
  const doc = defaultResume(facts, contact);

  it("has every default section in order, empty ones included", () => {
    expect(doc.sections.map((s) => s.kind)).toEqual(["summary", "experience", "projects", "skills", "education", "certifications"]);
    expect(doc.sections.find((s) => s.kind === "summary")?.entries).toEqual([]);
    expect(doc.sections.find((s) => s.kind === "certifications")?.entries).toEqual([]);
    expect(doc.contact).toEqual(contact);
    expect(resumeInputSchema.safeParse(doc).success).toBe(true);
  });

  it("builds entries and skill lines from confirmed facts only, each citing its fact", () => {
    const experience = doc.sections.find((s) => s.kind === "experience")!;
    expect(experience.entries.map((e) => [e.heading, e.headingFactId])).toEqual([["Software Engineer at Initech, 2021 to 2023", "r1"]]);
    const skills = doc.sections.find((s) => s.kind === "skills")!;
    expect(skills.entries).toHaveLength(1);
    expect(skills.entries[0]!.lines.map((l) => [l.text, l.factIds])).toEqual([
      ["TypeScript", ["s1"]],
      ["PostgreSQL", ["s2"]],
    ]);
    const cited = JSON.stringify(doc);
    for (const id of ["r2", "s3"]) expect(cited).not.toContain(`"${id}"`);
  });

  it("is deterministic", () => {
    expect(defaultResume(facts, contact)).toEqual(doc);
    expect(truthLockViolations(doc, new Set(facts.filter((f) => f.confirmed).map((f) => f.id)))).toEqual([]);
  });
});

const line = (id: string, text: string, factIds: string[]) => ({ id, section: "Experience", text, factIds });
const sample: ResumeInput = {
  name: "Base resume",
  density: "comfortable",
  contact,
  sections: [
    {
      id: "sx",
      kind: "experience",
      title: "Experience",
      hidden: false,
      entries: [
        { id: "en1", heading: "Engineer at Initech", subheading: "Austin", meta: "2021 to 2023", headingFactId: "r1", hidden: false, lines: [line("l1", "Built a dashboard", ["p1"]), line("l2", "Ran k8s", ["s3"])] },
        { id: "en2", heading: "Intern at Hooli", subheading: null, meta: "2020", headingFactId: "r2", hidden: true, lines: [line("l3", "Shipped a thing", ["nope"])] },
      ],
    },
    { id: "sk", kind: "skills", title: "Skills", hidden: true, entries: [{ id: "en3", heading: "", subheading: null, meta: null, headingFactId: null, hidden: false, lines: [line("l4", "TypeScript", ["s1"])] }] },
  ],
};

describe("truthLockViolations", () => {
  const ok = new Set(["r1", "p1", "s1"]);

  it("reports lines citing unconfirmed or unknown facts by line id, hidden parts included", () => {
    expect(truthLockViolations(sample, ok)).toEqual(["l2", "en2", "l3"]);
  });

  it("reports an entry whose heading cites an unconfirmed fact by the entry id", () => {
    expect(truthLockViolations(sample, new Set([...ok, "s3", "nope"]))).toEqual(["en2"]);
  });

  it("passes a clean document", () => {
    expect(truthLockViolations(sample, new Set([...ok, "s3", "nope", "r2"]))).toEqual([]);
  });
});

describe("renderResumeText", () => {
  it("prints visible sections and entries in order, without hidden ones", () => {
    const text = renderResumeText(sample);
    expect(text).toBe("Experience\nEngineer at Initech | Austin | 2021 to 2023\n- Built a dashboard\n- Ran k8s");
    expect(text).not.toContain("Hooli");
    expect(text).not.toContain("TypeScript");
  });
});
