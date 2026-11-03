import { describe, expect, it } from "vitest";
import { resumeTailor } from "../../src/agents/resume-tailor/spec";
import { renderResumeTailor } from "../../src/agents/resume-tailor/render";
import type { ResumeTailorInput } from "../../src/agents/resume-tailor/schema";
import { FACTS, POSTING, stable } from "./helpers";

const input: ResumeTailorInput = {
  facts: [...FACTS, { id: "f4", kind: "project", text: "Published the ledger tool at github.com/rowan-ellery/ledger, ask rowan@example.com" }],
  job: { title: "Platform Engineer", companyName: "Fernwood Analytics", descriptionText: POSTING },
};
const ctx = { userId: "u-render" };

describe("resume-tailor render", () => {
  it("puts the confirmed facts, contact details redacted, in the fenced per-user block", () => {
    const r = renderResumeTailor(input, ctx);
    expect(r.userBlock?.label).toBe("facts");
    expect(r.userBlock?.text).toContain("Confirmed facts (cite by id):\n[f2] (metric) Cut invoice processing time by 30% at Quillon Labs");
    expect(r.userBlock?.text).toContain("[f4] (project) Published the ledger tool at [link], ask [email]");
    for (const leak of ["github.com/rowan-ellery", "rowan@example.com"]) expect(r.userBlock?.text).not.toContain(leak);
  });

  it("fences the posting as one per-call block and gives the model no task text of its own", () => {
    const r = renderResumeTailor(input, ctx);
    expect(r.task).toBeUndefined();
    expect(r.untrusted).toEqual([{ label: "job_description", text: `Platform Engineer at Fernwood Analytics\n\n${POSTING}`, maxTokens: 2_000 }]);
  });

  it("is unchanged byte for byte", () => {
    expect(stable(renderResumeTailor(input, ctx))).toMatchSnapshot();
  });
});

describe("resume-tailor postValidate", () => {
  const check = (...lines: string[][]) =>
    resumeTailor.postValidate!({ lines: lines.map((factIds, i) => ({ id: `l${i}`, section: "Experience", text: "Built billing APIs", factIds })) }, input);

  it("accepts lines citing known facts", () => {
    expect(check(["f1"], ["f2", "f3"])).toEqual([]);
  });

  it("names every line that cites nothing or an unknown fact", () => {
    expect(check([], ["f1", "f8"])).toEqual([
      { code: "missing_citation", path: "lines[0].factIds" },
      { code: "unknown_fact_id", path: "lines[1].factIds[1]" },
    ]);
  });
});
