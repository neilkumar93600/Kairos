import { describe, expect, it } from "vitest";
import { dropSensitiveLines, redactContact, redactEmailBody, redactResumeHeader, userHash } from "../../src/llm/redact";

/** Every PII pattern of 10.2 must be removed (10.2: a unit test asserts nothing survives). */
describe("redactContact", () => {
  it.each([
    ["reach me at jane.doe+kairos@example.com today", "reach me at [email] today"],
    ["call +1 (415) 555-0132 now", "call [phone] now"],
    ["call +91 98765 43210 now", "call [phone] now"],
    ["see https://linkedin.com/in/janedoe for details", "see [link] for details"],
    ["1234 Market Street, SF", "[address], SF"],
    ["12 Main Road, Pune", "[address], Pune"],
    ["portfolio at github.com/janedoe/site", "portfolio at [link]"],
  ])("redacts %s", (input, expected) => {
    expect(redactContact(input)).toBe(expected);
  });

  it.each([
    "Software Engineer, Nordbeam, 2019 - 2023",
    "Cut costs by 30 percent by rewriting the billing pipeline in a new way",
    "Led 4 engineers to drive the migration\nBuilt the court filing system",
  ])("leaves resume text alone: %s", (input) => {
    expect(redactContact(input)).toBe(input);
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

  it("matches the name as a word in any case, and the profile's links without their scheme", () => {
    const out = redactResumeHeader("ANA LIMA\nlinkedin.com/in/analima\nAnalytics lead at Nordbeam", {
      name: "Ana Lima",
      email: "ana@example.com",
      links: ["https://www.linkedin.com/in/analima/"],
    });
    expect(out).toBe("Analytics lead at Nordbeam");
    expect(redactResumeHeader("Ana\nAnalytics lead", { name: "Ana", email: "ana@example.com", links: [] })).toBe("Analytics lead");
  });
});

/**
 * The seeded fail-closed set (CISO mustFix 6): every line must go. Adding a category means adding a line here.
 * ponytail: keyword and id-shape lines; the survivors below are the tech-resume words a broad match would eat.
 */
describe("dropSensitiveLines", () => {
  const sensitive = [
    "Date of Birth: 14/03/1994",
    "DOB - 14 March 1994",
    "Born on 14 March 1994 in Pune",
    "Age: 29",
    "Nationality: Indian",
    "Visa Status: H-1B, valid until 2027",
    "Requires visa sponsorship for employment",
    "Authorized to work in the US without sponsorship",
    "Work Authorization: EAD (STEM OPT)",
    "US Citizen",
    "Green card holder since 2020",
    "Citizenship: Canadian",
    "Current CTC: 18 LPA | Expected CTC: 25 LPA",
    "Salary expectations: $140,000",
    "Expected salary 120k USD",
    "Passport No: K1234567",
    "SSN: 123-45-6789",
    "Tax id 123-45-6789 on file",
    "Aadhaar: 1234 5678 9012",
    "PAN: ABCPD1234E",
    "Driver's License: D1234567",
    "Disability: None",
    "Disability status: prefer not to say",
    "Veteran Status: Protected veteran",
    "U.S. Army veteran",
    "Gender: Female",
    "Pronouns: she/her",
    "Jane Doe (she/her)",
    "Ethnicity: Asian",
    "Race: White",
    "Marital Status: Married",
    "Religion: Hindu",
    "Phone: [phone] | DOB: 01/01/1990",
  ];
  const survivors = [
    "Fixed race conditions in the job scheduler",
    "Integrated Visa and Mastercard payments for 3 markets",
    "Built sign-in with passport.js and OAuth",
    "Rolled out pan-India payouts in 2021",
    "Executive sponsor for the platform migration",
    "Software Engineer, Nordbeam, 2019 - 2023",
  ];

  it.each(sensitive)("drops %s", (line) => {
    expect(dropSensitiveLines(`Experience\n${line}\nBuilt billing`)).toBe("Experience\nBuilt billing");
  });

  it("drops every seeded line from one resume and keeps the rest", () => {
    const out = dropSensitiveLines([...sensitive, ...survivors].join("\n"));
    expect(out.split("\n")).toEqual(survivors);
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
