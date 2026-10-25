import { describe, expect, it } from "vitest";
import type { Resume, ResumeSuggestion } from "@auto-career/shared";
import type { Fact } from "@/hooks/use-profile";
import { acceptState, addLine, applySuggestion, resumeCheck, sortNewestFirst, toDraftLines, type FactMap } from "@/components/resume/model";

const fact = (id: string, confirmed = true, kind: Fact["kind"] = "project"): Fact => ({ id, kind, text: id, sourceSpan: null, confirmed });
const facts: FactMap = new Map([fact("f1"), fact("f2", false), fact("f3")].map((f) => [f.id, f]));
const line = (id: string, text: string, factIds: string[]) => ({ id, section: "Experience", text, factIds });

function doc(): Resume {
  return {
    id: "r",
    name: "Base resume",
    updatedAt: "2026-10-23T09:00:00.000Z",
    density: "comfortable",
    contact: { name: "A", email: "a@example.com", phone: "", location: "Austin, TX", links: [] },
    sections: [
      {
        id: "s-exp",
        kind: "experience",
        title: "Experience",
        hidden: false,
        entries: [
          {
            id: "e1",
            heading: "Engineer",
            subheading: "Company 201",
            meta: null,
            headingFactId: null,
            hidden: false,
            lines: [line("l1", "Built a thing.", ["f1"]), line("l2", "Built another.", ["f2"]), line("l3", "Built a third.", ["f3"])],
          },
        ],
      },
      { id: "s-cert", kind: "certifications", title: "Certifications", hidden: false, entries: [] },
      { id: "s-skills", kind: "skills", title: "Skills", hidden: true, entries: [] },
    ],
  };
}

const sug = (over: Partial<ResumeSuggestion>): ResumeSuggestion => ({
  id: "s",
  sectionId: "s-exp",
  entryId: "e1",
  lineId: "l1",
  action: "rewrite",
  before: "Built a thing.",
  after: "Shipped a thing.",
  why: "",
  factIds: ["f1"],
  needsFact: null,
  ...over,
});

describe("resume check", () => {
  it("names every failing line and stays the same for the same input", () => {
    const a = resumeCheck(doc(), facts, { pages: 1, longLineIds: ["l3"] });
    const b = resumeCheck(doc(), facts, { pages: 1, longLineIds: ["l3"] });
    expect(a).toEqual(b);
    const by = Object.fromEntries(a.checks.map((c) => [c.id, c]));
    expect(by.cited.targets.map((t) => t.lineId)).toEqual(["l2"]); // f2 is unconfirmed
    expect(by.contact.status).toBe("fail"); // phone missing
    expect(by.page.status).toBe("pass");
    expect(by.length.targets.map((t) => t.lineId)).toEqual(["l3"]);
    expect(by.verbs.targets.map((t) => t.lineId)).toEqual(["l1", "l2", "l3"]); // "Built" three times
    expect(by.empty.targets.map((t) => t.sectionId)).toEqual(["s-cert"]); // hidden Skills is not flagged
    expect(by.dates.targets.map((t) => t.entryId)).toEqual(["e1"]);
    expect(a.score).toBe(14); // 1 of 7
  });

  it("leaves checks it cannot run yet out of the score", () => {
    const r = resumeCheck(doc(), null, null);
    expect(r.checks.filter((c) => c.status === "pending").map((c) => c.id)).toEqual(["cited", "page", "length"]);
    expect(r.basis).toBe("0 of 4 checks pass, 3 still measuring");
  });

  it("gives an empty page no score instead of passing checks that inspected nothing", () => {
    const d = doc();
    d.sections[0].entries = [];
    const r = resumeCheck(d, facts, { pages: 1, longLineIds: [] });
    expect(r.score).toBeNull();
    expect(r.checks.filter((c) => c.status === "none").map((c) => c.id)).toEqual(["cited", "length", "verbs"]);
  });
});

describe("suggestions keep the truth lock", () => {
  it("never offers Accept for needsFact or text-free suggestions, and waits for unconfirmed facts", () => {
    expect(acceptState(sug({}), facts)).toBe("ok");
    expect(acceptState(sug({ after: null, needsFact: { kind: "metric", question: "How many?" } }), facts)).toBe("needs_fact");
    expect(acceptState(sug({ factIds: [] }), facts)).toBe("needs_fact");
    expect(acceptState(sug({ factIds: ["f2"] }), facts)).toBe("unconfirmed");
    expect(acceptState(sug({ action: "remove", after: null, factIds: [] }), facts)).toBe("ok");
  });

  it("applies rewrite, add and remove, and only to the copy it is given", () => {
    const base = doc();
    const rewritten = applySuggestion(base, sug({}));
    expect(rewritten.sections[0].entries[0].lines[0].text).toBe("Shipped a thing.");
    expect(base.sections[0].entries[0].lines[0].text).toBe("Built a thing.");
    const added = applySuggestion(base, sug({ id: "a", sectionId: "s-skills", entryId: null, lineId: null, action: "add", after: "Containers", factIds: ["f3"] }));
    expect(added.sections[2].entries[0].lines.map((l) => l.text)).toEqual(["Containers"]);
    const removed = applySuggestion(base, sug({ action: "remove", lineId: "l2" }));
    expect(removed.sections[0].entries[0].lines.map((l) => l.id)).toEqual(["l1", "l3"]);
  });
});

describe("document helpers", () => {
  it("sorts newest first with present on top and undated last", () => {
    const e = (id: string, meta: string | null) => ({ id, heading: id, subheading: null, meta, headingFactId: null, hidden: false, lines: [] });
    expect(sortNewestFirst([e("a", "2019 to 2021"), e("b", null), e("c", "2022 to present"), e("d", "2023")]).map((x) => x.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("sends only printed lines to a draft, labelled with their section", () => {
    const d = addLine(doc(), "s-skills", null, "TypeScript", ["f1"]); // Skills is hidden
    expect(toDraftLines(d).map((l) => l.id)).toEqual(["l1", "l2", "l3"]);
  });
});
