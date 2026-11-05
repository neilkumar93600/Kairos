import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, type Preferences } from "@auto-career/shared";
import { HttpError } from "../src/lib/errors";
import { greenhouse } from "../src/services/ats/greenhouse";
import { lever } from "../src/services/ats/lever";
import { ashby } from "../src/services/ats/ashby";
import type { Fetcher, NormalizedJob } from "../src/services/ats";
import { belowBarReason, companyNameFromToken, importJob, jobUpsertValues, NO_PREFERENCES_REASON, type ImportIo } from "../src/services/job-import";
import { SafeFetchError } from "../src/services/safe-fetch";

const posting: NormalizedJob = {
  externalId: "4012345",
  title: "Software Engineer",
  location: "Remote",
  remote: true,
  department: null,
  descriptionText: "Build things.",
  applyUrl: "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=4012345",
  postedAt: null,
  salaryMinUsd: null,
  salaryMaxUsd: null,
  raw: {},
};
const prefs = { ...DEFAULT_PREFERENCES, roles: ["Software Engineer"], workAuthorization: "citizen" } as unknown as Preferences;
const URL_OK = "https://boards.greenhouse.io/acme/jobs/4012345";

const scoredAt = (score: number, reasons: string[] = ["Thin"]) => ({ score, reasons, scorerVersion: "fit-scorer@v2", prerankScore: 40 });

function io(over: Partial<ImportIo> = {}) {
  const calls: string[] = [];
  const stored: Parameters<ImportIo["ensureMatch"]>[0][] = [];
  const fake: ImportIo = {
    async fetchPosting(ats, token, id) {
      calls.push(`fetch ${ats}/${token}/${id}`);
      return posting;
    },
    async upsertCompany(_a, _t, name) {
      calls.push(`company ${name}`);
      return { id: "c1", name, active: false };
    },
    async upsertJob() {
      return { id: "j1", inserted: true };
    },
    async loadPreferences() {
      return prefs;
    },
    async recentApplicationsToCompany() {
      return 0;
    },
    async findMatch() {
      return null;
    },
    async ensureMatch(m) {
      calls.push(`match ${m.status}`);
      stored.push(m);
      return "m1";
    },
    async applyScore(_id, scored, status) {
      calls.push(`apply ${status} ${scored.score}`);
    },
    async scorePair() {
      calls.push("score");
      return scoredAt(90, ["Strong match"]);
    },
    async fanOut() {
      calls.push("fan-out");
    },
    async boardForHost() {
      return null;
    },
    async recordBoardRequest(_u, link) {
      calls.push(`board request ${link.host}${link.path} ${link.detectedAts}`);
    },
    ...over,
  };
  return { fake, calls, stored };
}

describe("importJob", () => {
  it("answers 422 for a link on no known board, queues its host and path, and never fetches it", async () => {
    const { fake, calls } = io();
    const err = await importJob("u1", "https://stripe.com/jobs?gh_jid=1&secret=x", fake).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 422, code: "unsupported_board" });
    expect(calls).toEqual(["board request stripe.com/jobs greenhouse"]);
  });

  it("queues nothing for a link it cannot normalize: an IP host, http", async () => {
    for (const url of ["https://10.0.0.1/jobs/1", "http://stripe.com/jobs", "not a url"]) {
      const { fake, calls } = io();
      await expect(importJob("u1", url, fake)).rejects.toMatchObject({ status: 422, code: "unsupported_board" });
      expect(calls).toEqual([]);
    }
  });

  // matching-87: the board token comes from our own company row, never from the page.
  it("reads a gh_jid link through the Greenhouse company on that domain, without fetching the page", async () => {
    const { fake, calls } = io({ boardForHost: async (host) => (host === "stripe.com" ? "stripe" : null) });
    const r = await importJob("u1", "https://www.stripe.com/jobs/search?gh_jid=4012345", fake);
    expect(r.jobId).toBe("j1");
    expect(calls[0]).toBe("fetch greenhouse/stripe/4012345");
  });

  it("maps a missing posting to 404 posting_not_found", async () => {
    const { fake } = io({ fetchPosting: async () => null });
    await expect(importJob("u1", URL_OK, fake)).rejects.toMatchObject({ status: 404, code: "posting_not_found" });
  });

  it("maps a refused or failed board fetch to 503, with no URL in the answer, and stores nothing", async () => {
    const { fake, calls } = io({
      fetchPosting: async () => {
        throw new SafeFetchError("throttled", 429);
      },
    });
    await expect(importJob("u1", URL_OK, fake)).rejects.toMatchObject({ status: 503, code: "service_unavailable", details: { reason: "board_unavailable" } });
    expect(calls).toEqual([]);
  });

  it("passes the Lever EU region through to the fetch and the company", async () => {
    const U = "0f6c1a3e-2b4d-4c5e-8f9a-1b2c3d4e5f60";
    const seen: unknown[] = [];
    const { fake } = io({
      fetchPosting: async (_a, _t, _i, region) => {
        seen.push(region);
        return posting;
      },
      upsertCompany: async (_a, _t, name, region) => {
        seen.push(region);
        return { id: "c1", name, active: false };
      },
    });
    await importJob("u1", `https://jobs.eu.lever.co/acme/${U}`, fake);
    expect(seen).toEqual(["eu", "eu"]);
  });

  it("runs gate, then scorer: at or over the bar is new, with the score stored", async () => {
    const { fake, calls, stored } = io();
    const r = await importJob("u1", URL_OK, fake);
    expect(r).toEqual({ jobId: "j1", matchId: "m1", fit: { passed: true, reasons: [] } });
    expect(calls).toEqual(["fetch greenhouse/acme/4012345", "company Acme", "score", "match new"]);
    expect(stored[0]).toMatchObject({ passed: true, status: "new", score: 90, scored: { scorerVersion: "fit-scorer@v2", prerankScore: 40 } });
  });

  it("stores a score under the bar as below_bar, with no match id, and tells the user why", async () => {
    const { fake, stored } = io({ scorePair: async () => scoredAt(60) });
    const r = await importJob("u1", URL_OK, fake);
    expect(r).toEqual({ jobId: "j1", matchId: null, fit: { passed: false, reasons: [belowBarReason(60, prefs.fitThreshold)] } });
    expect(stored[0]).toMatchObject({ passed: true, status: "below_bar", score: 60, reasons: ["Thin"] });
  });

  it("a gate failure is below_bar and costs no model call", async () => {
    const { fake, calls, stored } = io({ loadPreferences: async () => ({ ...prefs, excludedKeywords: ["things"] }) });
    const r = await importJob("u1", URL_OK, fake);
    expect(r).toEqual({ jobId: "j1", matchId: null, fit: { passed: false, reasons: ['Mentions excluded keyword "things"'] } });
    expect(calls).not.toContain("score");
    expect(stored[0]).toMatchObject({ passed: false, status: "below_bar", score: null });
  });

  it("when the scorer cannot run the import still succeeds, unscored", async () => {
    const { fake, stored } = io({ scorePair: async () => null });
    const r = await importJob("u1", URL_OK, fake);
    expect(r).toEqual({ jobId: "j1", matchId: "m1", fit: { passed: true, reasons: [] } });
    expect(stored[0]).toMatchObject({ status: "new", score: null });
  });

  it("a second import of the same posting pays nothing and reads the stored match", async () => {
    const { fake, calls } = io({ findMatch: async () => ({ id: "m9", status: "below_bar", score: 60 }) });
    const r = await importJob("u1", URL_OK, fake);
    expect(r).toEqual({ jobId: "j1", matchId: null, fit: { passed: false, reasons: [belowBarReason(60, prefs.fitThreshold)] } });
    expect(calls).not.toContain("score");
    expect(calls.filter((c) => c.startsWith("match"))).toEqual([]);
    const again = io({ findMatch: async () => ({ id: "m9", status: "new", score: 90 }) });
    expect(await importJob("u1", URL_OK, again.fake)).toEqual({ jobId: "j1", matchId: "m9", fit: { passed: true, reasons: [] } });
  });

  // Contract round 1: "could not score then" must not become "never scored".
  it("re-importing a match stored unscored scores it, and applies the bar", async () => {
    const unscored = { id: "m9", status: "new", score: null };
    const over = io({ findMatch: async () => unscored });
    expect(await importJob("u1", URL_OK, over.fake)).toEqual({ jobId: "j1", matchId: "m9", fit: { passed: true, reasons: [] } });
    expect(over.calls).toContain("apply new 90");
    expect(over.calls.filter((c) => c.startsWith("match"))).toEqual([]);

    const under = io({ findMatch: async () => unscored, scorePair: async () => scoredAt(60) });
    expect(await importJob("u1", URL_OK, under.fake)).toEqual({ jobId: "j1", matchId: null, fit: { passed: false, reasons: [belowBarReason(60, prefs.fitThreshold)] } });
    expect(under.calls).toContain("apply below_bar 60");
  });

  it("leaves it unscored when the scorer still cannot run, or the gate now fails, or the user queued it", async () => {
    const unscored = { id: "m9", status: "new", score: null };
    const down = io({ findMatch: async () => unscored, scorePair: async () => null });
    expect(await importJob("u1", URL_OK, down.fake)).toEqual({ jobId: "j1", matchId: "m9", fit: { passed: true, reasons: [] } });
    expect(down.calls.some((c) => c.startsWith("apply"))).toBe(false);

    const gated = io({ findMatch: async () => unscored, loadPreferences: async () => ({ ...prefs, excludedKeywords: ["things"] }) });
    await importJob("u1", URL_OK, gated.fake);
    expect(gated.calls).not.toContain("score");

    const queued = io({ findMatch: async () => ({ id: "m9", status: "queued", score: null }) });
    expect(await importJob("u1", URL_OK, queued.fake)).toMatchObject({ matchId: null, fit: { passed: true } });
    expect(queued.calls).not.toContain("score");
  });

  it("passes with a nudge, and no model call, when the user has no preferences", async () => {
    const { fake, calls } = io({ loadPreferences: async () => null });
    const r = await importJob("u1", URL_OK, fake);
    expect(r.fit).toEqual({ passed: true, reasons: [NO_PREFERENCES_REASON] });
    expect(calls).not.toContain("score");
  });

  it("counts recent applications toward the per-company limit", async () => {
    const { fake } = io({ recentApplicationsToCompany: async () => 2 });
    const r = await importJob("u1", URL_OK, fake);
    expect(r.fit.passed).toBe(false);
  });

  // An imported company's posting reaches nobody else; one the owner already activated reaches everyone, as a polled one does.
  it("fans a new posting out only when its company is active", async () => {
    const inactive = io();
    await importJob("u1", URL_OK, inactive.fake);
    expect(inactive.calls).not.toContain("fan-out");
    const active = io({ upsertCompany: async (_a, _t, name) => ({ id: "c1", name, active: true }) });
    await importJob("u1", URL_OK, active.fake);
    expect(active.calls).toContain("fan-out");
    const known = io({ upsertCompany: async (_a, _t, name) => ({ id: "c1", name, active: true }), upsertJob: async () => ({ id: "j1", inserted: false }) });
    await importJob("u1", URL_OK, known.fake);
    expect(known.calls).not.toContain("fan-out");
  });
});

describe("job upsert values", () => {
  it("sets source only on insert so a polled job stays 'board'", () => {
    const v = jobUpsertValues("c1", posting);
    expect(v.insert.source).toBe("manual_url");
    expect(v.update).not.toHaveProperty("source");
    expect(v.update).not.toHaveProperty("externalId");
    // Through normalizePosting (WP-42): the gate columns, and a reopen clears closed_by with closed_at.
    expect(v.insert).toMatchObject({ titleLc: "software engineer", locationLc: "remote", hintsVersion: 1 });
    expect(v.update).toMatchObject({ closedAt: null, closedBy: null, titleLc: "software engineer" });
  });

  it("derives a readable company name", () => {
    expect(companyNameFromToken("acme-corp_labs")).toBe("Acme Corp Labs");
  });
});

describe("adapter fetchPosting", () => {
  const L = "0f6c1a3e-2b4d-4c5e-8f9a-1b2c3d4e5f60";
  const A = "aaaaaaaa-0000-4000-8000-000000000001";
  const B = "bbbbbbbb-0000-4000-8000-000000000002";
  const json = (b: unknown): Fetcher => async () => ({ status: 200, body: b, etag: null });
  const gone: Fetcher = async () => ({ status: 404 });

  it("Greenhouse hits the single-job endpoint and keeps the poller's externalId and applyUrl", async () => {
    let seen = "";
    const fetcher: Fetcher = async (u) => {
      seen = u;
      return { status: 200, body: { id: 4012345, title: "SWE", absolute_url: "https://x.com", content: "hi" }, etag: null };
    };
    const j = await greenhouse.fetchPosting("acme", "4012345", { fetcher });
    expect(seen).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs/4012345?content=true");
    expect(j).toMatchObject({ externalId: "4012345", applyUrl: "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=4012345" });
    expect(await greenhouse.fetchPosting("acme", "1", { fetcher: gone })).toBeNull();
  });

  it("Lever hits the single-posting endpoint", async () => {
    let seen = "";
    const fetcher: Fetcher = async (u) => {
      seen = u;
      return { status: 200, body: { id: L, text: "Eng", hostedUrl: `https://jobs.lever.co/acme/${L}` }, etag: null };
    };
    const j = await lever.fetchPosting("acme", L, { fetcher });
    expect(seen).toBe(`https://api.lever.co/v0/postings/acme/${L}`);
    expect(j).toMatchObject({ externalId: L, applyUrl: `https://jobs.lever.co/acme/${L}/apply` });
    expect(await lever.fetchPosting("acme", L, { fetcher: gone })).toBeNull();
  });

  it("Ashby selects the posting from the board, null when absent or board missing", async () => {
    const board = { jobs: [{ id: A, title: "A", jobUrl: `https://jobs.ashbyhq.com/o/${A}` }, { id: B, title: "B", jobUrl: `https://jobs.ashbyhq.com/o/${B}` }] };
    expect(await ashby.fetchPosting("o", B, { fetcher: json(board) })).toMatchObject({ externalId: B, applyUrl: `https://jobs.ashbyhq.com/o/${B}/application` });
    expect(await ashby.fetchPosting("o", "zzz", { fetcher: json(board) })).toBeNull();
    expect(await ashby.fetchPosting("o", A, { fetcher: gone })).toBeNull();
  });
});
