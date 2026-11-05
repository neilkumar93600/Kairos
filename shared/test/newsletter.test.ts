import { describe, expect, it } from "vitest";
import { NEWSLETTER_SOURCES, newsletterSignupSchema } from "../src";

/** POST /api/newsletter's body (WP-50): one spelling per address, and nothing that could become a mail header. */
describe("newsletterSignupSchema", () => {
  it("trims and lower-cases the address, so one address is one row", () => {
    expect(newsletterSignupSchema.parse({ email: "  Ada.Lovelace@Example.COM ", source: "popup" })).toEqual({ email: "ada.lovelace@example.com", source: "popup" });
  });

  it("keeps the honeypot for the route to check", () => {
    expect(newsletterSignupSchema.parse({ email: "a@example.com", source: "about", website: "http://spam" }).website).toBe("http://spam");
  });

  it.each([
    "not-an-email",
    "a@example.com\r\nBcc: victim@example.com",
    "a@example.com\nX-Injected: 1",
    "a b@example.com",
    `${"a".repeat(250)}@example.com`,
    "",
  ])("refuses %j", (email) => {
    expect(newsletterSignupSchema.safeParse({ email, source: "popup" }).success).toBe(false);
  });

  it("accepts only the four form placements", () => {
    expect(NEWSLETTER_SOURCES).toEqual(["popup", "blog-index", "blog-post", "about"]);
    expect(newsletterSignupSchema.safeParse({ email: "a@example.com", source: "footer" }).success).toBe(false);
    expect(newsletterSignupSchema.safeParse({ email: "a@example.com" }).success).toBe(false);
  });
});
