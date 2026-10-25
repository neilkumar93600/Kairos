import { describe, expect, it } from "vitest";
import { PROFILE_ONLY } from "@/hooks/use-drafts";
import { isProfileOnly } from "@/hooks/use-drafts";
import { SUPPORTED_BOARD } from "@/hooks/use-jobs";

describe("SUPPORTED_BOARD", () => {
  it("accepts Greenhouse, Lever and Ashby posting URLs", () => {
    for (const u of [
      "https://boards.greenhouse.io/company014/jobs/4012345",
      "https://job-boards.greenhouse.io/company014/jobs/4012345",
      "https://jobs.lever.co/company014/0a1b2c3d-1111-2222-3333-444455556666",
      "https://jobs.ashbyhq.com/company014/0a1b2c3d-1111-2222-3333-444455556666",
    ]) expect(SUPPORTED_BOARD.test(u), u).toBe(true);
  });

  it("rejects http, other hosts, javascript: and look-alike hosts", () => {
    for (const u of [
      "http://boards.greenhouse.io/company014/jobs/1",
      "https://www.linkedin.com/jobs/view/123",
      "javascript:alert(1)",
      "https://jobs.lever.co.evil.com/company/1",
      "https://evil.com/jobs.lever.co/company/1",
      "https://jobs.lever.co@evil.com/company/1",
      "https://notjobs.lever.co/company/1",
      "https://jobs.lever.co/",
      "https://jobs.lever.co/company 1",
      "",
    ]) expect(SUPPORTED_BOARD.test(u), u).toBe(false);
  });
});

describe("PROFILE_ONLY", () => {
  it("catches protected questions by key or by label", () => {
    for (const q of [
      "gender", "What is your gender?", "race", "Race / ethnicity", "ethnicity", "Hispanic or Latino?",
      "veteran_status", "Are you a protected veteran?", "disability", "Do you have a disability?",
      "visa", "Do you require a visa?", "sponsorship", "Will you require sponsorship?",
      "Are you authorized to work in the US?", "Work authorisation status",
      "salary", "Expected salary (USD)", "compensation", "Desired compensation", "Pay expectations",
    ]) expect(PROFILE_ONLY.test(q), q).toBe(true);
  });

  it("leaves open-ended questions to the drafter", () => {
    for (const q of ["Why do you want to work here?", "Describe a project you are proud of", "why_company", "project_pride", "Tell us about a time you led a team"])
      expect(PROFILE_ONLY.test(q), q).toBe(false);
  });
});

describe("isProfileOnly (field key and label)", () => {
  it("catches snake_case keys the raw regex misses", () => {
    expect(PROFILE_ONLY.test("work_authorization")).toBe(false); // hook regex: needs a space, recommend work[\s_-]*authori[sz]ation
    expect(isProfileOnly("work_authorization", "Status")).toBe(true);
    expect(isProfileOnly("why_company", "Why do you want to work here?")).toBe(false);
    // "_" is a word character, so a word boundary never fires inside these keys without the normalising step.
    for (const k of ["eeo_gender", "sponsorship_required", "eeo-race", "desired_salary", "veteran-status"]) expect(isProfileOnly(k), k).toBe(true);
    // Server parity: terms the backend review added.
    for (const q of ["Are you a US citizen?", "citizenship_status", "Do you hold a green card?", "Immigration status", "Are you legally able to work in Canada?",
      "Current CTC (INR)", "expected_ctc", "Desired pay", "Do you identify as LGBTQ+?"]) expect(isProfileOnly(q), q).toBe(true);
    for (const q of ["Are you able to work weekends?", "Experience with payment systems?", "Describe a project you are proud of"])
      expect(isProfileOnly(q), q).toBe(false);
  });
});
