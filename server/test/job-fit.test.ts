import { describe, expect, it } from "vitest";
import { jobFitSchema } from "@auto-career/shared";
import { findSkills } from "../src/services/skills-dictionary";
import { computeJobFit, extractRequirements, type JobFitInput } from "../src/services/job-fit";

const JD = `About Acme
We build payments tooling.

Responsibilities:
- Ship features across the stack

Requirements:
- 3+ years of experience with TypeScript and React
- Strong knowledge of PostgreSQL
- Experience deploying on Kubernetes
- Excellent communication skills

Nice to have:
- Familiarity with GraphQL
- Experience with Terraform

Benefits
- Free lunch`;

const facts = [
  { id: "f1", kind: "project", text: "Built a React and TypeScript dashboard used by 2,000 customers", confirmed: true },
  { id: "f2", kind: "skill", text: "Designed PostgreSQL schemas and tuned queries", confirmed: true },
  { id: "f3", kind: "skill", text: "Ran services on k8s clusters", confirmed: false },
  { id: "f4", kind: "role", text: "Software Engineer at Initech", confirmed: true },
];

const base: JobFitInput = {
  job: { id: "j1", title: "Senior Software Engineer", companyName: "Acme", descriptionText: JD },
  facts,
  resumeText: "Experienced with React.",
  preferences: { roles: ["software engineer"], seniority: ["senior"] },
};

describe("findSkills", () => {
  it("finds aliases and canonical names once, in first-seen order", () => {
    expect(findSkills("We use k8s, JS and Postgres. Also Kubernetes.")).toEqual(["kubernetes", "javascript", "postgresql"]);
  });
  it("handles punctuation terms", () => {
    expect(findSkills("C++, C# and .NET plus Node.js and CI/CD.")).toEqual(["c++", "c#", ".net", "node.js", "ci/cd"]);
  });
  it("does not match go or r in prose", () => {
    expect(findSkills("Ready to go the extra mile? R&D and a go-getter attitude.")).toEqual([]);
    expect(findSkills("We write golang services")).toEqual(["go"]);
  });
  it("does not match inside longer words", () => {
    expect(findSkills("javascripty reactive")).toEqual([]);
  });
});

describe("extractRequirements", () => {
  it("splits required and nice-to-have with stable ids", () => {
    const reqs = extractRequirements(JD);
    expect(reqs.map((r) => r.id)).toEqual(["req-1", "req-2", "req-3", "req-4", "req-5", "req-6"]);
    expect(reqs.filter((r) => r.required)).toHaveLength(4);
    expect(reqs.filter((r) => !r.required).map((r) => r.text)).toEqual(["Familiarity with GraphQL", "Experience with Terraform"]);
    expect(extractRequirements(JD)).toEqual(reqs);
  });
  it("falls back to experience lines without a heading", () => {
    const reqs = extractRequirements("We are hiring.\nYou need 5+ years building APIs.\nProficient in Python.\nWe like cake.");
    expect(reqs.map((r) => r.text)).toEqual(["You need 5+ years building APIs.", "Proficient in Python."]);
    expect(reqs.every((r) => r.required)).toBe(true);
  });
  it("caps at 15", () => {
    const many = "Requirements:\n" + Array.from({ length: 30 }, (_, i) => `- Skill number ${i} thing`).join("\n");
    expect(extractRequirements(many)).toHaveLength(15);
  });
});

describe("computeJobFit", () => {
  it("scores a fixture JD and parses with jobFitSchema", () => {
    const fit = computeJobFit(base);
    expect(() => jobFitSchema.parse(fit)).not.toThrow();
    const byId = Object.fromEntries(fit.requirements.map((r) => [r.text, r]));
    expect(byId["3+ years of experience with TypeScript and React"]!).toMatchObject({ status: "covered", factIds: ["f1"] });
    expect(byId["Strong knowledge of PostgreSQL"]!.status).toBe("covered");
    expect(byId["Experience deploying on Kubernetes"]!).toMatchObject({ status: "unconfirmed", factIds: ["f3"] });
    expect(byId["Excellent communication skills"]!.status).toBe("missing");
    const kw = Object.fromEntries(fit.keywords.map((k) => [k.term, k]));
    expect(kw.react!.status).toBe("in_resume");
    expect(kw.postgresql).toMatchObject({ status: "has_fact", factIds: ["f2"] });
    expect(kw.kubernetes).toMatchObject({ status: "no_fact", factIds: [] });
    expect(fit.categories?.map((c) => c.max)).toEqual([40, 30, 20, 10]);
    expect(fit.basis).toMatch(/^Based on 4 of 4 checks/);
  });

  it("is deterministic", () => {
    expect(computeJobFit(base)).toEqual(computeJobFit(base));
  });

  it("excluded category leaves the denominator instead of scoring zero", () => {
    const mismatch = computeJobFit({ ...base, job: { ...base.job, title: "Junior Software Engineer" } });
    const noMarker = computeJobFit({ ...base, job: { ...base.job, title: "Software Engineer" } });
    const cat = noMarker.categories!.find((c) => c.name === "Seniority Fit")!;
    expect(cat).toMatchObject({ points: 0 });
    expect(cat.reason).toBeTruthy();
    // A mismatch scores 0 of 10; an unmarked title must not be punished like one.
    expect(mismatch.categories!.find((c) => c.name === "Seniority Fit")!.reason).toBeNull();
    expect(noMarker.score).toBeGreaterThan(mismatch.score);
    expect(noMarker.basis).toMatch(/3 of 4 checks/);
  });

  it("unconfirmed facts never raise the score", () => {
    const without = computeJobFit({ ...base, facts: facts.filter((f) => f.id !== "f3") });
    const unconfirmedOnly = computeJobFit({ ...base, facts: facts.map((f) => ({ ...f, confirmed: f.id === "f3" ? false : f.confirmed })) });
    expect(unconfirmedOnly.score).toBe(without.score);
    const allUnconfirmed = computeJobFit({ ...base, facts: facts.map((f) => ({ ...f, confirmed: false })), resumeText: "" });
    expect(allUnconfirmed.requirements.every((r) => r.status !== "covered")).toBe(true);
    expect(allUnconfirmed.keywords.every((k) => k.status === "no_fact")).toBe(true);
  });

  it("assigns bands at 50 and 75", () => {
    const run = (matchedFacts: typeof facts, resumeText: string) => computeJobFit({ ...base, facts: matchedFacts, resumeText, preferences: null });
    const great = computeJobFit({
      ...base,
      job: { ...base.job, descriptionText: "Requirements:\n- React experience" },
      facts: [facts[0]!],
      resumeText: "React",
    });
    expect(great.score).toBe(100);
    expect(great.band).toBe("great");
    const poor = run([], "");
    expect(poor.score).toBeLessThan(50);
    expect(poor.band).toBe("poor");
    const fair = computeJobFit({
      ...base,
      job: { ...base.job, descriptionText: "Requirements:\n- React experience\n- Rust experience" },
      facts: [facts[0]!],
      resumeText: "React",
      preferences: null,
    });
    expect(fair.score).toBe(50);
    expect(fair.band).toBe("fair");
  });

  it("scores 0 and says so when nothing can be evaluated", () => {
    const fit = computeJobFit({ job: { id: "j", title: "Wizard", companyName: "X", descriptionText: "Come work with us." }, facts: [], resumeText: "", preferences: null });
    expect(fit.score).toBe(0);
    expect(fit.basis).toMatch(/no checks/i);
    expect(() => jobFitSchema.parse(fit)).not.toThrow();
  });
});
