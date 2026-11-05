import { describe, expect, it } from "vitest";
import { classifyByRules, stripQuoted } from "../src/services/email-classifier";

describe("classifyByRules", () => {
  it.each([
    ["Your application to Acme", "Thank you for applying. We have received your application.", "confirmation"],
    ["Update on your application", "Unfortunately we will not be moving forward with an interview.", "rejection"],
    ["Next steps", "Please share your availability for a phone screen.", "interview"],
    ["Coding challenge", "Complete this HackerRank assessment within 3 days.", "assessment"],
    ["Offer", "We are pleased to offer you the role.", "offer"],
    ["Good news", "We would like to extend you an offer for the Software Engineer position.", "offer"],
    ["Documents", "Attached is your offer letter.", "offer"],
    ["Interview invite", "We are pleased to offer you an interview for the Analyst role.", "interview"],
    ["Next round", "We're excited to offer you the opportunity to interview with our team.", "interview"],
  ])("tags %s as %s", (subject, body, kind) => {
    expect(classifyByRules(subject, body)).toBe(kind);
  });

  it("returns null when nothing matches", () => {
    expect(classifyByRules("Newsletter", "Our product update")).toBeNull();
  });
});

describe("stripQuoted", () => {
  it("drops quoted lines, a reply header and what follows it, and a signature", () => {
    expect(stripQuoted("Thanks\n> an interview\n> soon")).toBe("Thanks");
    expect(stripQuoted("Thanks\n\nOn Mon, Jan 5, 2026 at 10:00 AM Sam <sam@a.co> wrote:\nmore")).toBe("Thanks");
    expect(stripQuoted("Thanks\n\nOn Mon, Jan 5, 2026 at 10:00 AM Sam <\nsam@a.co> wrote:\nmore")).toBe("Thanks");
    expect(stripQuoted("Thanks\n-----Original Message-----\nFrom: Sam")).toBe("Thanks");
    expect(stripQuoted("Thanks\n-- \nSam")).toBe("Thanks");
  });

  it("keeps a forwarded block: in a manual forward it is the employer's mail", () => {
    const body = "fyi\n---------- Forwarded message ---------\nFrom: Acme <jobs@acme.com>\n\nWe would like to interview you.";
    expect(stripQuoted(body)).toBe(body);
  });

  it("normalizes CRLF and leaves ordinary text alone", () => {
    expect(stripQuoted("a\r\nb\r\n")).toBe("a\nb");
    expect(stripQuoted("On Monday we wrote back.\nSee you then.")).toBe("On Monday we wrote back.\nSee you then.");
  });
});
