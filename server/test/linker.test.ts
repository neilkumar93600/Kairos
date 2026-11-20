import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { alignedDomains, atsOfDomain, containsName, hostSuffixes, normalizeName, originalSender, parseAddress, pickLink, signedForApplication, type LinkCandidate } from "../src/services/linker";

type GoldenCase = { why: string; sender: string; account?: string; subject: string; body: string; apply: string[]; restricted?: boolean; app: string | null; by: string };
type Golden = { companies: Record<string, Pick<LinkCandidate, "companyName" | "ats" | "domains" | "jobTitle">>; cases: GoldenCase[] };
const golden = JSON.parse(readFileSync(new URL("./fixtures/inbox/linker-golden.json", import.meta.url), "utf8")) as Golden;

const candidate = (key: string, over: Partial<LinkCandidate> = {}): LinkCandidate => ({
  applicationId: key,
  status: "submitted",
  submittedAt: new Date("2026-10-01"),
  approvedAt: null,
  companyId: key,
  ...golden.companies[key]!,
  ...over,
});

describe("pickLink golden cases", () => {
  it.each(golden.cases.map((c) => [c.why, c] as const))("%s", (_why, c) => {
    const result = pickLink(
      { sender: c.sender, subject: c.subject, body: c.body, accountEmail: c.account ?? null, restricted: c.restricted ?? false },
      c.apply.map((k) => candidate(k)),
    );
    expect(result).toEqual({ applicationId: c.app, linkedBy: c.by });
  });
});

describe("the application within a company", () => {
  const input = { sender: "a@globex.com", subject: "Your Senior Analyst application", body: "", accountEmail: null, restricted: false };

  it("prefers the job title sharing two words with the subject", () => {
    const rows = [candidate("globex", { applicationId: "a", jobTitle: "Designer" }), candidate("globex", { applicationId: "b", jobTitle: "Senior Analyst", submittedAt: new Date("2026-01-01") })];
    expect(pickLink(input, rows).applicationId).toBe("b");
  });

  it("then submitted before submitting before failed, then the newest", () => {
    const rows = [
      candidate("globex", { applicationId: "failed", status: "failed", jobTitle: "x" }),
      candidate("globex", { applicationId: "sending", status: "submitting", jobTitle: "x" }),
      candidate("globex", { applicationId: "old", jobTitle: "x", submittedAt: new Date("2026-01-01") }),
      candidate("globex", { applicationId: "new", jobTitle: "x", submittedAt: new Date("2026-09-01") }),
    ];
    expect(pickLink(input, rows).applicationId).toBe("new");
    expect(pickLink(input, rows.slice(0, 2)).applicationId).toBe("sending");
  });
});

describe("helpers", () => {
  it("hostSuffixes stops at two labels", () => {
    expect(hostSuffixes("a.mail.Acme.com")).toEqual(["a.mail.acme.com", "mail.acme.com", "acme.com"]);
  });

  it("normalizeName removes the legal suffix but never the whole name", () => {
    expect(normalizeName("Stripe, Inc.")).toBe("stripe");
    expect(normalizeName("Inc")).toBe("inc");
    expect(normalizeName("Acme Robotics LLC")).toBe("acme robotics");
  });

  it("containsName matches whole words only, across punctuation", () => {
    expect(containsName("Hello from Scale-AI!", "scale ai")).toBe(true);
    expect(containsName("Dropbox", "box")).toBe(false);
    expect(containsName("anything", "")).toBe(false);
  });

  it("parseAddress takes the last address of a From value", () => {
    expect(parseAddress('"Acme <a@a.co>" <jobs@acme.com>')).toEqual({ address: "jobs@acme.com", name: "Acme <a@a.co>" });
    expect(parseAddress("Jobs@Acme.com")).toEqual({ address: "jobs@acme.com", name: "" });
    expect(parseAddress("no address")).toBeNull();
  });

  it("parseAddress stays fast on a multi-megabyte value with no address", () => {
    const started = Date.now();
    expect(parseAddress("x".repeat(5_000_000))).toBeNull();
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("originalSender ignores a forward block unless the mail is from the user or free mail", () => {
    const block = "---------- Forwarded message ---------\nFrom: R <r@globex.com>";
    expect(originalSender("me@gmail.com", block, null)?.address).toBe("r@globex.com");
    expect(originalSender("x@corp.example", block, "me@gmail.com")?.address).toBe("x@corp.example");
    expect(originalSender("me@gmail.com", "no block", "me@gmail.com")?.address).toBe("me@gmail.com");
  });
});

describe("whether a verified domain speaks for an application", () => {
  const app = { domains: ["acme.com"], ats: "greenhouse" };

  it.each([
    ["the company's domain", ["acme.com"], true],
    ["a subdomain of it", ["mail.acme.com"], true],
    ["the application's ATS", ["greenhouse-mail.io"], true],
    ["a subdomain of its ATS", ["us.greenhouse-mail.io"], true],
    ["another ATS", ["hire.lever.co"], false],
    ["a look-alike", ["notacme.com"], false],
    ["a domain holding the company's as a prefix", ["acme.com.evil.example"], false],
    ["nothing verified", [], false],
  ])("%s", (_why, verified, expected) => {
    expect(signedForApplication(verified, app)).toBe(expected);
  });

  it("a parent domain of the company's aligns, but a bare TLD never does", () => {
    expect(signedForApplication(["acme.com"], { domains: ["careers.acme.com"], ats: "lever" })).toBe(true);
    expect(alignedDomains("com", "acme.com")).toBe(false);
  });

  it("atsOfDomain reads the relay's suffixes", () => {
    expect(atsOfDomain("hire.lever.co")).toBe("lever");
    expect(atsOfDomain("x.ashbyhq.com")).toBe("ashby");
    expect(atsOfDomain("acme.com")).toBeUndefined();
  });
});
