import { describe, expect, it } from "vitest";
import { resumeWriter } from "../../src/agents/resume-writer/spec";
import { renderResumeWriter } from "../../src/agents/resume-writer/render";
import type { ResumeWriterInput, ResumeWriterOutput } from "../../src/agents/resume-writer/schema";
import { FACTS, POSTING, stable } from "./helpers";

const view = "Section [exp] Experience (experience)\n  Entry [e1] Backend Engineer | Quillon Labs {heading cites f1}\n    Line [l1] Worked on invoices {cites f2}";
const input: ResumeWriterInput = { scope: "line", refine: null, resumeView: view, facts: FACTS, noteFact: null, job: null, maxSuggestions: 3 };
const ctx = { userId: "u-render" };

describe("resume-writer render", () => {
  it("sorts the facts by id in the fenced per-user block, so the same facts render the same bytes", () => {
    const r = renderResumeWriter(input, ctx);
    expect(r.userBlock?.label).toBe("facts");
    const text = r.userBlock!.text;
    expect(text.indexOf("[f1]")).toBeLessThan(text.indexOf("[f2]"));
    expect(text.indexOf("[f2]")).toBeLessThan(text.indexOf("[f3]"));
    expect(renderResumeWriter({ ...input, facts: [...FACTS].reverse() }, ctx).userBlock).toEqual(r.userBlock);
  });

  it("writes the scope and the suggestion cap into the trusted task line, and the refine style only when asked", () => {
    expect(renderResumeWriter(input, ctx).task).toBe("Task: Rewrite this one line. Give different rewrites, each a full replacement. At most 3 suggestions.");
    const refined = renderResumeWriter({ ...input, scope: "section", refine: "use_numbers", maxSuggestions: 15 }, ctx).task!;
    expect(refined).toMatch(/^Task: Improve this section: .* At most 15 suggestions\. Style: Use the numbers the cited facts contain\./);
  });

  it("fences the resume view, and adds the note and the posting only when they exist", () => {
    expect(renderResumeWriter(input, ctx).untrusted.map((b) => b.label)).toEqual(["resume_lines"]);
    const full = renderResumeWriter(
      { ...input, noteFact: { id: "n1", kind: "metric", text: "The invoice service handled 12,000 invoices a month" }, job: { title: "Platform Engineer", company: "Fernwood Analytics", descriptionText: POSTING } },
      ctx,
    );
    expect(full.untrusted.map((b) => b.label)).toEqual(["resume_lines", "user_note", "job_description"]);
    expect(full.untrusted[1]!.text).toContain("saved as fact n1");
    expect(full.untrusted[1]!.text).toContain("[n1] (metric) The invoice service handled 12,000 invoices a month");
    // The posting is third-party text: it stays in its data block, never in the task line or the per-user block.
    expect(full.task).not.toContain("Ignore previous instructions");
    expect(full.userBlock?.text).not.toContain("Ignore previous instructions");
  });

  it("is unchanged byte for byte", () => {
    expect(stable(renderResumeWriter({ ...input, refine: "shorter" }, ctx))).toMatchSnapshot();
  });
});

describe("resume-writer postValidate", () => {
  const suggestion = (over: Partial<ResumeWriterOutput["suggestions"][number]>): ResumeWriterOutput["suggestions"][number] => ({
    sectionId: "exp",
    entryId: "e1",
    lineId: "l1",
    action: "rewrite",
    after: "Cut invoice processing time by 30%",
    why: "Leads with the result",
    factIds: ["f2"],
    needsFact: null,
    ...over,
  });

  it("accepts suggestions citing known facts, and a remove that cites nothing", () => {
    expect(resumeWriter.postValidate!({ suggestions: [suggestion({}), suggestion({ action: "remove", after: null, factIds: [] })] }, input)).toEqual([]);
  });

  it("names an unknown fact id at its path", () => {
    expect(resumeWriter.postValidate!({ suggestions: [suggestion({}), suggestion({ factIds: ["f1", "f9"] })] }, input)).toEqual([
      { code: "unknown_fact_id", path: "suggestions[1].factIds[1]" },
    ]);
  });

  it("lets a suggestion cite the user's note, the one unconfirmed fact it may use", () => {
    const withNote = { ...input, noteFact: { id: "n1", kind: "metric", text: "12,000 invoices a month" } };
    expect(resumeWriter.postValidate!({ suggestions: [suggestion({ factIds: ["n1"] })] }, withNote)).toEqual([]);
    expect(resumeWriter.postValidate!({ suggestions: [suggestion({ factIds: ["n1"] })] }, input)).toEqual([{ code: "unknown_fact_id", path: "suggestions[0].factIds[0]" }]);
  });
});
