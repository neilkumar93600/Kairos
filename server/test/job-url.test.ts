import { describe, expect, it } from "vitest";
import { employerLink, parseJobUrl } from "../src/services/job-url";

const U = "0b6f3c1e-5a2d-4e8f-9c7a-1d2e3f4a5b6c";

describe("parseJobUrl", () => {
  it("parses Greenhouse hosted, job-boards and embed links", () => {
    const want = { ats: "greenhouse", boardToken: "acme", postingId: "4012345" };
    expect(parseJobUrl("https://boards.greenhouse.io/acme/jobs/4012345")).toEqual(want);
    expect(parseJobUrl("https://job-boards.greenhouse.io/acme/jobs/4012345/")).toEqual(want);
    expect(parseJobUrl("https://job-boards.greenhouse.io/embed/job_app?for=acme&token=4012345")).toEqual(want);
    expect(parseJobUrl("https://boards.greenhouse.io/embed/job_app?for=acme&token=4012345")).toEqual(want);
  });

  it("parses Lever links with and without /apply", () => {
    const want = { ats: "lever", boardToken: "acme-co", postingId: U };
    expect(parseJobUrl(`https://jobs.lever.co/acme-co/${U}`)).toEqual(want);
    expect(parseJobUrl(`https://jobs.lever.co/acme-co/${U}/apply`)).toEqual(want);
    expect(parseJobUrl(`https://jobs.lever.co/acme-co/${U}/other`)).toBeNull();
  });

  it("parses Ashby links with and without /application", () => {
    const want = { ats: "ashby", boardToken: "acme", postingId: U };
    expect(parseJobUrl(`https://jobs.ashbyhq.com/acme/${U}`)).toEqual(want);
    expect(parseJobUrl(`https://jobs.ashbyhq.com/acme/${U}/application?utm=x`)).toEqual(want);
    expect(parseJobUrl(`https://jobs.ashbyhq.com/acme/${U}/nope`)).toBeNull();
  });

  it("lowercases UUID posting ids, since Ashby looks them up by exact match", () => {
    const upper = U.toUpperCase();
    expect(parseJobUrl(`https://jobs.ashbyhq.com/acme/${upper}`)).toEqual({ ats: "ashby", boardToken: "acme", postingId: U });
    expect(parseJobUrl(`https://jobs.lever.co/acme/${upper}/apply`)).toEqual({ ats: "lever", boardToken: "acme", postingId: U });
  });

  it("rejects http, spoofed hosts, ports and credentials", () => {
    expect(parseJobUrl("http://boards.greenhouse.io/acme/jobs/1")).toBeNull();
    expect(parseJobUrl("https://boards.greenhouse.io.evil.com/acme/jobs/1")).toBeNull();
    expect(parseJobUrl("https://evilboards.greenhouse.io/acme/jobs/1")).toBeNull();
    expect(parseJobUrl("https://evil.com/boards.greenhouse.io/acme/jobs/1")).toBeNull();
    expect(parseJobUrl(`https://jobs.lever.co.evil.com/acme/${U}`)).toBeNull();
    expect(parseJobUrl("https://boards.greenhouse.io:8443/acme/jobs/1")).toBeNull();
    expect(parseJobUrl("https://user:pw@boards.greenhouse.io/acme/jobs/1")).toBeNull();
  });

  it("returns null for employer-domain links and non-URLs", () => {
    expect(parseJobUrl("https://stripe.com/jobs/search?gh_jid=4012345")).toBeNull();
    expect(parseJobUrl("not a url")).toBeNull();
    expect(parseJobUrl("")).toBeNull();
  });

  it("rejects junk tokens and ids", () => {
    expect(parseJobUrl("https://boards.greenhouse.io/acme/jobs/abc")).toBeNull();
    expect(parseJobUrl("https://boards.greenhouse.io/acme/jobs/12;drop")).toBeNull();
    expect(parseJobUrl("https://boards.greenhouse.io/a%2F..%2Fb/jobs/1")).toBeNull();
    expect(parseJobUrl("https://boards.greenhouse.io/acme/jobs")).toBeNull();
    expect(parseJobUrl("https://job-boards.greenhouse.io/embed/job_app?for=acme")).toBeNull();
    expect(parseJobUrl("https://job-boards.greenhouse.io/embed/job_app?for=../x&token=1")).toBeNull();
    expect(parseJobUrl("https://jobs.lever.co/acme/not-a-uuid")).toBeNull();
    expect(parseJobUrl("https://jobs.ashbyhq.com/acme")).toBeNull();
  });
});

describe("Lever EU and token charset (matching-28, 82)", () => {
  it("reads jobs.eu.lever.co as the EU region", () => {
    expect(parseJobUrl(`https://jobs.eu.lever.co/acme/${U}/apply`)).toEqual({ ats: "lever", boardToken: "acme", postingId: U, region: "eu" });
    expect(parseJobUrl(`https://jobs.eu.lever.co.evil.com/acme/${U}`)).toBeNull();
  });

  it("accepts a dot inside a token, never a token that starts with one", () => {
    expect(parseJobUrl("https://boards.greenhouse.io/acme.inc/jobs/1")).toMatchObject({ boardToken: "acme.inc" });
    expect(parseJobUrl("https://boards.greenhouse.io/.acme/jobs/1")).toBeNull();
    expect(parseJobUrl("https://job-boards.greenhouse.io/embed/job_app?for=..&token=1")).toBeNull();
  });
});

describe("employerLink (matching-87): read, never fetched", () => {
  it("finds the Greenhouse posting id on an employer's page and drops the query string", () => {
    expect(employerLink("https://www.Stripe.com/jobs/search?gh_jid=4012345&token=secret")).toEqual({
      host: "stripe.com",
      path: "/jobs/search",
      detectedAts: "greenhouse",
      postingId: "4012345",
    });
  });

  it("reports an unknown page with no posting id, and a junk gh_jid as none", () => {
    expect(employerLink("https://acme.example/careers/1")).toEqual({ host: "acme.example", path: "/careers/1", detectedAts: null, postingId: null });
    expect(employerLink("https://acme.example/c?gh_jid=1;drop")).toMatchObject({ detectedAts: null, postingId: null });
  });

  it("refuses http, ports, credentials, IP hosts and junk", () => {
    for (const bad of ["http://acme.example/x", "https://acme.example:8443/x", "https://u:p@acme.example/x", "https://10.0.0.1/x", "https://[::1]/x", "https://2130706433/x", "nope"]) {
      expect(employerLink(bad)).toBeNull();
    }
  });

  it("fits board_requests_path_ck whatever the path holds", () => {
    const ck = new RegExp("^/[A-Za-z0-9._~%/+=@:,-]{0,199}$");
    for (const url of ["https://a.example/", "https://a.example/a b(c)!'*;$&", "https://a.example/é/日本語", `https://a.example/${"x".repeat(400)}`, `https://a.example/${"é".repeat(150)}`]) {
      expect(employerLink(url)!.path).toMatch(ck);
    }
  });
});
