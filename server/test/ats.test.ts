import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ashby, normalizeAshby } from "../src/services/ats/ashby";
import { greenhouse, normalizeGreenhouse } from "../src/services/ats/greenhouse";
import { lever, normalizeLever } from "../src/services/ats/lever";
import { BoardNotFoundError, type Fetcher } from "../src/services/ats/types";
import { MiB, type SafeFetchOptions } from "../src/services/safe-fetch";

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

  // safeFetchJson (CISO shouldFix): every adapter call names exactly its own API host, a byte cap and a timeout.
  it("sends every board request through the safe fetch with the exact host, a byte cap and a timeout", async () => {
    const seen: { url: string; opts: SafeFetchOptions }[] = [];
    const fetcher: Fetcher = async (url, opts) => {
      seen.push({ url, opts });
      return { status: 404 };
    };
    await greenhouse.fetchPosting("acme", "1", { fetcher });
    await lever.fetchPosting("acme", "1", { fetcher });
    await lever.fetchPosting("acme", "1", { fetcher, region: "eu" });
    await ashby.fetchPosting("acme", "1", { fetcher });
    await greenhouse.fetchBoard("acme", { fetcher }).catch(() => undefined);
    expect(seen.map((s) => [new URL(s.url).host, s.opts.allowedHosts])).toEqual([
      ["boards-api.greenhouse.io", ["boards-api.greenhouse.io"]],
      ["api.lever.co", ["api.lever.co"]],
      ["api.eu.lever.co", ["api.eu.lever.co"]],
      ["api.ashbyhq.com", ["api.ashbyhq.com"]],
      ["boards-api.greenhouse.io", ["boards-api.greenhouse.io"]],
    ]);
    for (const s of seen) {
      expect(s.opts.maxBytes).toBeGreaterThanOrEqual(2 * MiB);
      expect(s.opts.maxBytes).toBeLessThanOrEqual(24 * MiB);
      expect(s.opts.timeoutMs).toBeGreaterThan(0);
    }
    expect(seen[4]!.opts.maxBytes).toBe(24 * MiB); // a content=true Greenhouse board
  });

  it("raises BoardNotFoundError on a 404 board, and answers not_modified on a 304 with the stored ETag sent", async () => {
    await expect(greenhouse.fetchBoard("gone", { fetcher: async () => ({ status: 404 }) })).rejects.toBeInstanceOf(BoardNotFoundError);
    let etag: string | null | undefined;
    const notModified: Fetcher = async (_u, o) => {
      etag = o.etag;
      return { status: 304 };
    };
    expect(await lever.fetchBoard("acme", { etag: 'W/"1"', fetcher: notModified })).toEqual({ kind: "not_modified" });
    expect(etag).toBe('W/"1"');
  });

  it("returns the listing with the response ETag", async () => {
    const fetcher: Fetcher = async () => ({ status: 200, body: fixture("greenhouse"), etag: 'W/"2"' });
    const r = await greenhouse.fetchBoard("acme", { fetcher });
    expect(r.kind === "listing" && r.postings.length === 1 && r.etag).toBe('W/"2"');
  });

  // matching-28: an EU Lever board is read from api.eu.lever.co and its apply links point at jobs.eu.lever.co.
  it("polls Lever EU boards on the EU host and builds EU apply links", async () => {
    const fetcher: Fetcher = async () => ({ status: 200, body: fixture("lever"), etag: null });
    const r = await lever.fetchBoard("acme", { fetcher, region: "eu" });
    expect(r.kind === "listing" && r.postings[0]!.applyUrl).toBe(`https://jobs.eu.lever.co/acme/${LEVER_ID}/apply`);
  });
});
