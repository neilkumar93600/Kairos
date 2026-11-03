import { describe, expect, it } from "vitest";
import { contactInputSchema, createTrackerItemRequestSchema, importJobSchema, resumeContactSchema } from "../src";

/** URL fields accept http(s) only (WP-05, api-auth-security-33): javascript:, data: and friends never get stored. */
const HOSTILE = ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "ftp://files.example.com/x"];

describe("URL fields", () => {
  it.each(HOSTILE)("refuse %j", (url) => {
    expect(importJobSchema.safeParse({ url }).success).toBe(false);
    expect(createTrackerItemRequestSchema.safeParse({ url }).success).toBe(false);
    expect(createTrackerItemRequestSchema.safeParse({ manual: { title: "Engineer", company: "Acme", url } }).success).toBe(false);
    expect(contactInputSchema.safeParse({ name: "Ada", linkedinUrl: url }).success).toBe(false);
  });

  it("accept http and https", () => {
    for (const url of ["https://boards.greenhouse.io/acme/jobs/1", "http://jobs.lever.co/acme/1"]) {
      expect(importJobSchema.safeParse({ url }).success, url).toBe(true);
      expect(contactInputSchema.safeParse({ name: "Ada", linkedinUrl: url }).success, url).toBe(true);
    }
  });

  const links = (...l: string[]) => resumeContactSchema.safeParse({ name: "Ada", email: "ada@example.com", phone: "", location: "", links: l }).success;

  it("resume links may be a bare host or http(s), never another scheme, however it is spelled", () => {
    expect(links("github.com/ada", "linkedin.com/in/ada", "https://ada.dev", "http://ada.dev", "ada.dev:8080/cv")).toBe(true);
    for (const link of [...HOSTILE, " javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "javascript:1/alert(1)", "mailto:ada@example.com"]) {
      expect(links(link), JSON.stringify(link)).toBe(false);
    }
  });
});
