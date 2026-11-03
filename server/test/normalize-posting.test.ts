import { describe, expect, it } from "vitest";
import type { NormalizedJob } from "../src/services/ats/types";
import { HINTS_VERSION, locationNorm, normalizeForHash, normalizePosting, seniorityOf, simhash, titleNorm } from "../src/services/normalize-posting";

/** normalizePosting (04-matching 2.2, 2.3; matching-17, v07): the pure gate, dedup and hint columns of a posting. */

const job = (over: Partial<NormalizedJob> = {}): NormalizedJob => ({
  externalId: "4411",
  title: "Senior Backend Engineer",
  location: "New York, NY",
  remote: false,
  department: "Engineering",
  descriptionText: "Build APIs.",
  applyUrl: "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=4411",
  postedAt: new Date("2026-10-01T00:00:00Z"),
  salaryMinUsd: null,
  salaryMaxUsd: null,
  raw: { id: 4411 },
  ...over,
});

const LONG = Array.from({ length: 80 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${Math.floor(i / 26)}`).join(" ");

describe("normalizePosting", () => {
  it.each([
    ["Senior Software Engineer (Remote)", "senior software engineer"],
    ["Backend Engineer [Hybrid] - 20231", "backend engineer"],
    ["Staff Engineer, Payments (m/f/d)", "staff engineer payments"],
    ["C++ / C# Developer — REQ-12345", "c++ / c# developer"],
    ["  Data   Scientist  ", "data scientist"],
    ["Node.js Engineer JR 4567", "node.js engineer"],
    ["Ｓｅｎｉｏｒ Engineer", "senior engineer"],
  ])("titleNorm(%j) = %j", (title, norm) => {
    expect(titleNorm(title.toLowerCase())).toBe(norm);
  });

  it.each([
    ["New York, NY", "new ny york"],
    ["NY, New York", "new ny york"],
    ["Remote - US", "us"],
    ["On-site, Berlin", "berlin"],
    ["Anywhere", ""],
    ["Hybrid (London)", "london"],
  ])("locationNorm(%j) = %j", (location, norm) => {
    expect(locationNorm(location.toLowerCase())).toBe(norm);
  });

  it.each([
    ["software engineering intern", "intern"],
    ["new grad software engineer", "entry"],
    ["jr. developer", "entry"],
    ["principal engineer", "staff_plus"],
    ["engineering manager", "manager"],
    ["head of data", "manager"],
    ["senior engineer", "senior"],
    ["tech lead", "senior"],
    ["software engineer ii", "mid"],
    ["software engineer", "unknown"],
    ["staff engineering manager", "staff_plus"],
  ])("seniorityOf(%j) = %j (first match wins)", (titleLc, hint) => {
    expect(seniorityOf(titleLc)).toBe(hint);
  });

  it("lowers title and location exactly as passesHardFilters does, and keeps the flags of services/fit.ts", () => {
    const p = normalizePosting(job({ title: "  Senior   Backend Engineer ", location: null }));
    expect(p).toMatchObject({
      title: "Senior Backend Engineer",
      titleLc: "senior backend engineer",
      locationLc: "",
      locationNorm: "",
      titleSeniorFlag: true,
      titleJuniorFlag: false,
      seniorityHint: "senior",
      hintsVersion: HINTS_VERSION,
    });
  });

  it("reads the sponsorship hint, and a refusal always wins", () => {
    expect(normalizePosting(job({ descriptionText: "We are unable to sponsor visas." })).sponsorshipHint).toBe("no_sponsorship");
    expect(normalizePosting(job({ descriptionText: "We will sponsor the right person." })).sponsorshipHint).toBe("sponsors");
    expect(normalizePosting(job({ descriptionText: "Visa sponsorship available. Cannot sponsor interns." })).sponsorshipHint).toBe(
      "no_sponsorship",
    );
    expect(normalizePosting(job()).sponsorshipHint).toBeNull();
  });

  it("cuts a description to 60,000 characters", () => {
    expect(normalizePosting(job({ descriptionText: "x".repeat(70_000) })).descriptionText).toHaveLength(60_000);
  });

  it("hashes content deterministically; raw payload churn changes nothing, a title edit changes content_hash", () => {
    const a = normalizePosting(job());
    expect(a.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.descriptionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(normalizePosting(job({ raw: { id: 4411, updated_at: "later" } })).contentHash).toBe(a.contentHash);
    expect(normalizePosting(job({ title: "Staff Backend Engineer" })).contentHash).not.toBe(a.contentHash);
    expect(normalizePosting(job({ title: "Staff Backend Engineer" })).descriptionHash).toBe(a.descriptionHash);
  });

  it("normalizeForHash drops digits, case and EEO boilerplate lines", () => {
    expect(normalizeForHash("Pay: $120,000\nWe are an Equal Opportunity Employer.\n  Build   APIs")).toBe("pay: $000,000 build apis");
  });

  it("simhash: 0 under 40 tokens, stable, and near for a light edit, far for other text", () => {
    expect(simhash("too short to matter")).toBe(0n);
    const base = simhash(LONG);
    expect(base).not.toBe(0n);
    expect(simhash(LONG)).toBe(base);
    expect(base).toBeGreaterThanOrEqual(-(2n ** 63n));
    expect(base).toBeLessThan(2n ** 63n);
    const bits = (x: bigint) => BigInt.asUintN(64, x).toString(2).split("").filter((c) => c === "1").length;
    const edited = simhash(`${LONG} extraword`);
    const other = simhash(LONG.split(" ").reverse().join(" "));
    expect(bits(base ^ edited)).toBeLessThanOrEqual(8);
    expect(bits(base ^ other)).toBeGreaterThan(8);
  });
});
