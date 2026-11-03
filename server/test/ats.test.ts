import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ashby, normalizeAshby } from "../src/services/ats/ashby";
import { greenhouse, normalizeGreenhouse } from "../src/services/ats/greenhouse";
import { lever, normalizeLever } from "../src/services/ats/lever";
import { BoardNotFoundError } from "../src/services/ats/types";

const LEVER_ID = "0f6c1a3e-2b4d-4c5e-8f9a-1b2c3d4e5f60";
const ASHBY_ID = "9f8e7d6c-5b4a-4321-8fed-cba987654321";
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
    const [job] = normalizeLever(fixture("lever"), "acme");
    expect(job).toMatchObject({ externalId: LEVER_ID, remote: false, salaryMinUsd: 120000, salaryMaxUsd: 160000, department: "Platform" });
    expect(job?.descriptionText).toContain("Node.js");
    expect(job?.descriptionText).not.toMatch(/<|&amp;/);
  });

  it("normalizes Ashby postings and skips unlisted ones", () => {
    const jobs = normalizeAshby(fixture("ashby"), "acme");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ externalId: ASHBY_ID, salaryMinUsd: 150000, salaryMaxUsd: 190000 });
  });

  // CISO mustFix 1(2): the board payload must not pick the host the cloud applier opens.
  it("builds the Lever and Ashby apply URLs from the board token and posting id, never the payload's applyUrl", () => {
    const evil = "https://169.254.169.254/latest/meta-data";
    const [l] = normalizeLever([{ ...fixture("lever")[0], applyUrl: evil, hostedUrl: "https://evil.example/x" }], "acme");
    expect(l?.applyUrl).toBe(`https://jobs.lever.co/acme/${LEVER_ID}/apply`);
    const board = fixture("ashby");
    board.jobs[0] = { ...board.jobs[0], applyUrl: evil, jobUrl: "https://evil.example/x" };
    expect(normalizeAshby(board, "acme")[0]?.applyUrl).toBe(`https://jobs.ashbyhq.com/acme/${ASHBY_ID}/application`);
  });

  it("drops a posting whose token or id would not survive job-url validation", () => {
    const lever1 = fixture("lever")[0];
    expect(normalizeLever([{ ...lever1, id: "../../other" }], "acme")).toEqual([]);
    expect(normalizeLever([{ ...lever1, id: `${LEVER_ID}?x=` }], "acme")).toEqual([]);
    expect(normalizeLever([lever1], "acme/evil")).toEqual([]);
    const board = fixture("ashby");
    board.jobs[0].id = "not-a-uuid";
    expect(normalizeAshby(board, "acme")).toEqual([]);
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
