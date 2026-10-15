import { describe, expect, it } from "vitest";
import { classifyByRules, senderDomain } from "../src/services/email-classifier";

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

  it("extracts the sender domain", () => {
    expect(senderDomain("Acme Recruiting <jobs@Acme.com>")).toBe("acme.com");
  });
});
