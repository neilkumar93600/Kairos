import { describe, expect, it } from "vitest";
import { retentionDays, RETENTION_RULES } from "../src/jobs/retention";
import { redactConfirmation, scrubContent } from "../src/services/sensitive";

describe("retention rules (WP-25)", () => {
  it("defaults to the spec's periods, pending counsel", () => {
    expect(Object.fromEntries(Object.entries(RETENTION_RULES).map(([k, r]) => [k, r.days]))).toEqual({
      inbound_body: 180,
      inbound_hidden: 30,
      forwarding_codes: 3,
      forwarding_stale: 30,
      contact_messages: 365,
      matches_below_bar: 30,
      jobs_closed: 180,
      verified_claims: 1,
      scrub_applications: 7,
    });
  });

  it("takes an override and refuses an unknown rule name", () => {
    expect(retentionDays({ contact_messages: 400 })).toMatchObject({ contact_messages: 400, inbound_body: 180 });
    expect(() => retentionDays({ inbound_bodies: 90 })).toThrow(/unknown retention rule inbound_bodies/);
  });
});

describe("scrubContent (INV-9, 7 days after a terminal status)", () => {
  it("blanks the values of sensitive questions in answers and the receipt, and keeps the rest", () => {
    const answers = [
      { fieldKey: "g", label: "Gender", value: "Female", source: "saved_answer" as const },
      { fieldKey: "v", label: "Will you require visa sponsorship?", value: "Yes", source: "saved_answer" as const },
      { fieldKey: "s", label: "Desired salary", value: "150000", source: "user_edit" as const },
      { fieldKey: "w", label: "Why this company?", value: "I love it", source: "generated" as const },
    ];
    const receipt = { filledFields: answers.map(({ fieldKey, label, value }) => ({ fieldKey, label, value })), confirmationText: "Thanks!", channel: "extension" as const };
    const out = scrubContent(answers, receipt);
    expect(out.answers.map((a) => a.value)).toEqual(["", "", "", "I love it"]);
    expect(out.receipt?.filledFields.map((f) => f.value)).toEqual(["", "", "", "I love it"]);
    expect(out.receipt?.confirmationText).toBe("Thanks!");
    expect(scrubContent([], null).receipt).toBeNull();
  });
});

describe("redactConfirmation (receipt evidence)", () => {
  it("drops addresses and phone numbers and caps the text at 4 KB", () => {
    expect(redactConfirmation("Thanks ann@example.com, we will call +1 415 555 0100.")).toBe("Thanks [email], we will call [phone].");
    expect(redactConfirmation("x".repeat(10_000))).toHaveLength(4096);
    expect(redactConfirmation(undefined)).toBeUndefined();
  });
});
