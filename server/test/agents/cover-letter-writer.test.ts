import { describe, expect, it } from "vitest";
import { coverLetterWriter } from "../../src/agents/cover-letter-writer/spec";
import { renderCoverLetter } from "../../src/agents/cover-letter-writer/render";
import type { CoverLetterInput } from "../../src/agents/cover-letter-writer/schema";
import { FACTS, POSTING, stable } from "./helpers";

const input: CoverLetterInput = { facts: FACTS, job: { title: "Platform Engineer", company: "Fernwood Analytics", descriptionText: POSTING } };
const ctx = { userId: "u-render" };

describe("cover-letter-writer render", () => {
  it("puts the facts in the fenced per-user block and the posting in one per-call data block", () => {
    const r = renderCoverLetter(input, ctx);
    expect(r.userBlock?.label).toBe("facts");
    expect(r.userBlock?.text).toContain("[f3] (skill) TypeScript and PostgreSQL");
    expect(r.task).toBeUndefined();
    expect(r.untrusted).toHaveLength(1);
    expect(r.untrusted[0]).toMatchObject({ label: "job_description", maxTokens: 2_000 });
    expect(r.untrusted[0]!.text).toBe(`Target job:\nPlatform Engineer at Fernwood Analytics\n\n${POSTING}`);
    expect(r.userBlock?.text).not.toContain("Ignore previous instructions");
  });

  it("says so when the user has no facts, rather than sending an empty block", () => {
    expect(renderCoverLetter({ ...input, facts: [] }, ctx).userBlock?.text).toContain("Facts:\n(none)");
  });

  it("is unchanged byte for byte", () => {
    expect(stable(renderCoverLetter(input, ctx))).toMatchSnapshot();
  });
});

describe("cover-letter-writer postValidate", () => {
  const check = (...paragraphs: string[][]) =>
    coverLetterWriter.postValidate!({ paragraphs: paragraphs.map((factIds) => ({ text: "I built billing APIs in TypeScript.", factIds })) }, input);

  it("accepts paragraphs citing known facts", () => {
    expect(check(["f1"], ["f2", "f3"])).toEqual([]);
  });

  it("names every paragraph that cites nothing or an unknown fact", () => {
    expect(check(["f1"], [], ["f3", "f7"])).toEqual([
      { code: "missing_citation", path: "paragraphs[1].factIds" },
      { code: "unknown_fact_id", path: "paragraphs[2].factIds[1]" },
    ]);
  });
});
