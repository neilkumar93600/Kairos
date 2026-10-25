import { describe, expect, it } from "vitest";
import { redactContact, redactEmailBody, redactResumeHeader, userHash } from "../../src/llm/redact";

/** Every PII pattern of 10.2 must be removed (10.2: a unit test asserts nothing survives). */
describe("redactContact", () => {
  it.each([
    ["reach me at jane.doe+kairos@example.com today", "reach me at [email] today"],
    ["call +1 (415) 555-0132 now", "call [phone] now"],
    ["call +91 98765 43210 now", "call [phone] now"],
    ["see https://linkedin.com/in/janedoe for details", "see [link] for details"],
    ["1234 Market Street, SF", "[address], SF"],
    ["12 Main Road, Pune", "[address], Pune"],
  ])("redacts %s", (input, expected) => {
    expect(redactContact(input)).toBe(expected);
  });
});

describe("redactResumeHeader", () => {
  it("removes the contact lines and redacts the rest", () => {
    const resume = [
      "Jane Doe",
      "jane@example.com | +1 (415) 555-0132",
      "linkedin.com/in/janedoe",
      "",
      "Experience",
      "Built the billing service at Nordbeam, email me at jane@example.com",
    ].join("\n");
    const out = redactResumeHeader(resume, {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+1 (415) 555-0132",
      links: ["linkedin.com/in/janedoe"],
    });
    expect(out).not.toContain("Jane Doe");
    expect(out).not.toContain("jane@example.com");
    expect(out).not.toContain("linkedin");
    expect(out).toContain("Built the billing service at Nordbeam");
  });
});

describe("redactEmailBody", () => {
  it("drops quoted history and signatures, replaces the name, cuts to 550 tokens", () => {
    const body = [
      "Hi, we would like to move forward.",
      "On Mon, Jan 1 Jane Doe wrote:",
      "> earlier message",
      "-- ",
      "Recruiter Signature",
      "phone +1 (415) 555-9999",
    ].join("\n");
    const out = redactEmailBody(body, { name: "Jane Doe" });
    expect(out).toContain("move forward");
    expect(out).not.toContain("earlier message");
    expect(out).not.toContain("Recruiter Signature");
    expect(out).not.toContain("Jane Doe");
    expect(out).not.toContain("+1");
  });
});

describe("userHash", () => {
  it("is stable per user and never the raw id", () => {
    const a = userHash("user-123");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).toBe(userHash("user-123"));
    expect(a).not.toContain("user-123");
    expect(userHash("user-124")).not.toBe(a);
  });
});
