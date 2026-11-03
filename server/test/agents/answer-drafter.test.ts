import { describe, expect, it } from "vitest";
import { answerDrafter } from "../../src/agents/answer-drafter/spec";
import { renderAnswerDrafter } from "../../src/agents/answer-drafter/render";
import type { AnswerDrafterInput } from "../../src/agents/answer-drafter/schema";
import { FACTS, POSTING, stable } from "./helpers";

const input: AnswerDrafterInput = {
  label: "Why do you want to join Fernwood Analytics?",
  facts: FACTS,
  savedAnswers: null,
  job: { title: "Platform Engineer", company: "Fernwood Analytics", descriptionText: POSTING },
};
const ctx = { userId: "u-render" };

describe("answer-drafter render", () => {
  it("puts the facts in the fenced per-user block and the question and posting in per-call data blocks", () => {
    const r = renderAnswerDrafter(input, ctx);
    expect(r.userBlock?.label).toBe("facts");
    expect(r.userBlock?.text).toMatch(/^<<DATA kind=facts id=[0-9a-f]{16}>>\n/);
    expect(r.userBlock?.text).toContain("[f1] (role) Backend Engineer at Quillon Labs from 2021 to 2024");
    expect(r.task).toBeUndefined();
    expect(r.untrusted.map((b) => b.label)).toEqual(["form_questions", "job_description"]);
    expect(r.untrusted[0]!.text).toBe(`Question:\n${input.label}`);
    expect(r.untrusted[1]!.text).toContain("Platform Engineer at Fernwood Analytics");
    // Third-party text never lands in the cached per-user block.
    expect(r.userBlock?.text).not.toContain("Ignore previous instructions");
  });

  it("renders the same user's facts byte-identically, so the cached prefix holds", () => {
    expect(renderAnswerDrafter(input, ctx).userBlock).toEqual(renderAnswerDrafter(input, ctx).userBlock);
    expect(renderAnswerDrafter(input, { userId: "someone-else" }).userBlock?.nonce).not.toBe(renderAnswerDrafter(input, ctx).userBlock?.nonce);
  });

  it("adds the saved answers as a third fenced block only when there are some", () => {
    const r = renderAnswerDrafter({ ...input, savedAnswers: [{ label: "Why us?", answer: "I like billing systems." }] }, ctx);
    expect(r.untrusted.map((b) => b.label)).toEqual(["form_questions", "job_description", "saved_answers"]);
    expect(r.untrusted[2]!.text).toContain("- Why us?: I like billing systems.");
  });

  it("is unchanged byte for byte", () => {
    expect(stable(renderAnswerDrafter(input, ctx))).toMatchSnapshot();
  });
});

describe("answer-drafter postValidate", () => {
  const check = (factIds: string[]) => answerDrafter.postValidate!({ text: "I cut invoice processing time by 30%.", factIds }, input);

  it("accepts an answer citing known facts", () => {
    expect(check(["f2", "f1"])).toEqual([]);
  });

  it("rejects an answer that cites no fact", () => {
    expect(check([])).toEqual([{ code: "missing_citation", path: "factIds" }]);
  });

  it("rejects an unknown fact id at its path", () => {
    expect(check(["f2", "f9"])).toEqual([{ code: "unknown_fact_id", path: "factIds[1]" }]);
  });
});
