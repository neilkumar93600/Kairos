import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ashby, normalizeAshby } from "../src/services/ats/ashby";
import { greenhouse, normalizeGreenhouse } from "../src/services/ats/greenhouse";
import { lever, normalizeLever } from "../src/services/ats/lever";
import { BoardNotFoundError } from "../src/services/ats/types";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

describe("ATS normalizers", () => {
  it("normalizes Greenhouse postings, decoding HTML and detecting remote", () => {
    const [job] = normalizeGreenhouse(fixture("greenhouse"), "acme");
    expect(job).toMatchObject({
      externalId: "4012345",
      title: "Software Engineer, New Grad",
      remote: true,
      department: "Engineering",
      applyUrl: "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=4012345",
    });
    expect(job?.descriptionText).toContain("Build things & ship.");
    expect(job?.descriptionText).not.toContain("<");
    expect(job?.postedAt?.toISOString()).toBe("2026-09-30T13:00:00.000Z");
  });

  it("normalizes Lever postings with yearly USD salary", () => {
    const [job] = normalizeLever(fixture("lever"));
    expect(job).toMatchObject({ externalId: "a1b2c3", remote: false, salaryMinUsd: 120000, salaryMaxUsd: 160000, department: "Platform" });
    expect(job?.descriptionText).toContain("Node.js");
    expect(job?.descriptionText).not.toMatch(/<|&amp;/);
  });

  it("normalizes Ashby postings and skips unlisted ones", () => {
    const jobs = normalizeAshby(fixture("ashby"));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ externalId: "9f8e", salaryMinUsd: 150000, salaryMaxUsd: 190000 });
  });

  it("gives every board request a 15 s abort signal", async () => {
    const signals: (AbortSignal | null | undefined)[] = [];
    const fake = async (_url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      return new Response("not found", { status: 404 });
    };
    await greenhouse.fetchPosting("acme", "1", fake);
    await lever.fetchPosting("acme", "1", fake);
    await ashby.fetchPosting("acme", "1", fake);
    expect(signals).toHaveLength(3);
    for (const s of signals) expect(s).toBeInstanceOf(AbortSignal);
  });

  it("raises BoardNotFoundError on a 404 board", async () => {
    const fake = async () => new Response("not found", { status: 404 });
    await expect(greenhouse.fetchBoard("gone", fake)).rejects.toBeInstanceOf(BoardNotFoundError);
  });
});
