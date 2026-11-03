import { describe, expect, it } from "vitest";
import { fitScorer } from "../../src/agents/fit-scorer/spec";
import { renderFitScorer } from "../../src/agents/fit-scorer/render";
import type { FitScorerInput } from "../../src/agents/fit-scorer/schema";
import { POSTING, stable } from "./helpers";

const input: FitScorerInput = {
  profileSummary: [
    "- (role) Backend Engineer at Quillon Labs from 2021 to 2024",
    "- (skill) TypeScript and PostgreSQL",
    "- (other) Reach me at rowan@example.com or +1 415 555 0142",
    "- (other) Work Authorization: H-1B, requires sponsorship",
  ].join("\n"),
  job: { title: "Platform Engineer", companyName: "Fernwood Analytics", location: null, remote: true, descriptionText: POSTING },
};
const ctx = { userId: "u-render" };

describe("fit-scorer render", () => {
  it("sends the profile without contact details or personal-details lines, in the fenced per-user block", () => {
    const r = renderFitScorer(input, ctx);
    expect(r.userBlock?.label).toBe("profile");
    expect(r.userBlock?.text).toContain("Candidate summary:\n- (role) Backend Engineer at Quillon Labs from 2021 to 2024");
    for (const leak of ["rowan@example.com", "555 0142", "H-1B", "sponsorship"]) expect(r.userBlock?.text, leak).not.toContain(leak);
  });

  it("fences the posting with its title, company and location, and gives the model no task text of its own", () => {
    const r = renderFitScorer(input, ctx);
    expect(r.task).toBeUndefined();
    expect(r.untrusted).toEqual([
      { label: "job_description", text: `Platform Engineer at Fernwood Analytics\nLocation: unspecified (remote)\n\n${POSTING}`, maxTokens: 1_950 },
    ]);
    expect(renderFitScorer({ ...input, job: { ...input.job, location: "Leeds", remote: false } }, ctx).untrusted[0]!.text).toContain("Location: Leeds\n");
  });

  it("is unchanged byte for byte", () => {
    expect(stable(renderFitScorer(input, ctx))).toMatchSnapshot();
  });
});

// fit-scorer has no postValidate in v1: the zod output schema is its whole post-check (v2 adds grounding, agents/03 7).
describe("fit-scorer post-validation", () => {
  it("has no postValidate; the output schema is the check", () => {
    expect(fitScorer.postValidate).toBeUndefined();
  });

  it.each([
    [{ score: 74, reasons: ["Has the TypeScript the posting asks for"] }, true],
    [{ score: 101, reasons: ["ok"] }, false],
    [{ score: 74.5, reasons: ["ok"] }, false],
    [{ score: 74, reasons: [] }, false],
    [{ score: 74, reasons: ["a", "b", "c", "d", "e"] }, false],
  ])("%j valid: %s", (out, valid) => {
    expect(fitScorer.output.safeParse(out).success).toBe(valid);
  });
});
