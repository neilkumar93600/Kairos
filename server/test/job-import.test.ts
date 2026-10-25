import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, type Preferences } from "@auto-career/shared";
import { HttpError } from "../src/lib/errors";
import { greenhouse } from "../src/services/ats/greenhouse";
import { lever } from "../src/services/ats/lever";
import { ashby } from "../src/services/ats/ashby";
import type { NormalizedJob } from "../src/services/ats";
import { companyNameFromToken, importJob, jobUpsertValues, NO_PREFERENCES_REASON, type ImportIo } from "../src/services/job-import";

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

function io(over: Partial<ImportIo> = {}) {
  const calls: string[] = [];
  const fake: ImportIo = {
    async fetchPosting(ats, token, id) {
      calls.push(`fetch ${ats}/${token}/${id}`);
      return posting;
    },
    async upsertCompany(_a, _t, name) {
      calls.push(`company ${name}`);
      return { id: "c1", name };
    },
    async upsertJob() {
      return { id: "j1" };
    },
    async loadPreferences() {
      return prefs;
    },
    async recentApplicationsToCompany() {
      return 0;
    },
    async ensureMatch(m) {
      calls.push(`match ${m.passed}`);
      return "m1";
    },
    ...over,
  };
  return { fake, calls };
}

describe("importJob", () => {
  it("rejects unsupported links with 422 before any I/O", async () => {
    const { fake, calls } = io();
    const err = await importJob("u1", "https://stripe.com/jobs?gh_jid=1", fake).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 422, code: "unsupported_board" });
    expect(calls).toEqual([]);
  });

  it("maps a missing posting to 404 posting_not_found", async () => {
    const { fake } = io({ fetchPosting: async () => null });
    await expect(importJob("u1", URL_OK, fake)).rejects.toMatchObject({ status: 404, code: "posting_not_found" });
  });

  it("fetches by parsed token and id, derives the company name, and creates a match when fit passes", async () => {
    const { fake, calls } = io();
    const r = await importJob("u1", URL_OK, fake);
    expect(r).toEqual({ jobId: "j1", matchId: "m1", fit: { passed: true, reasons: [] } });
    expect(calls).toEqual(["fetch greenhouse/acme/4012345", "company Acme", "match true"]);
  });

  it("reports hard-filter reasons and records a failed match", async () => {
    const { fake, calls } = io({ loadPreferences: async () => ({ ...prefs, excludedKeywords: ["things"] }) });
    const r = await importJob("u1", URL_OK, fake);
    expect(r.fit.passed).toBe(false);
    expect(r.fit.reasons).toEqual(['Mentions excluded keyword "things"']);
    expect(calls).toContain("match false");
  });

  it("passes with a nudge when the user has no preferences", async () => {
    const { fake } = io({ loadPreferences: async () => null });
    const r = await importJob("u1", URL_OK, fake);
    expect(r.fit).toEqual({ passed: true, reasons: [NO_PREFERENCES_REASON] });
  });

  it("counts recent applications toward the per-company limit", async () => {
    const { fake } = io({ recentApplicationsToCompany: async () => 2 });
    const r = await importJob("u1", URL_OK, fake);
    expect(r.fit.passed).toBe(false);
  });
});

describe("job upsert values", () => {
  it("sets source only on insert so a polled job stays 'board'", () => {
    const v = jobUpsertValues("c1", posting);
    expect(v.insert.source).toBe("manual_url");
    expect(v.update).not.toHaveProperty("source");
    expect(v.update).not.toHaveProperty("externalId");
  });

  it("derives a readable company name", () => {
    expect(companyNameFromToken("acme-corp_labs")).toBe("Acme Corp Labs");
  });
});

describe("adapter fetchPosting", () => {
  const json = (b: unknown) => async () => new Response(JSON.stringify(b), { status: 200 });
  const gone = async () => new Response("", { status: 404 });

  it("Greenhouse hits the single-job endpoint and keeps the poller's externalId and applyUrl", async () => {
    let seen = "";
    const f = async (u: string) => {
      seen = u;
      return new Response(JSON.stringify({ id: 4012345, title: "SWE", absolute_url: "https://x.com", content: "hi" }), { status: 200 });
    };
    const j = await greenhouse.fetchPosting("acme", "4012345", f);
    expect(seen).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs/4012345?content=true");
    expect(j).toMatchObject({ externalId: "4012345", applyUrl: "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=4012345" });
    expect(await greenhouse.fetchPosting("acme", "1", gone)).toBeNull();
  });

  it("Lever hits the single-posting endpoint", async () => {
    let seen = "";
    const f = async (u: string) => {
      seen = u;
      return new Response(JSON.stringify({ id: "abc", text: "Eng", hostedUrl: "https://jobs.lever.co/acme/abc" }), { status: 200 });
    };
    const j = await lever.fetchPosting("acme", "abc", f);
    expect(seen).toBe("https://api.lever.co/v0/postings/acme/abc");
    expect(j).toMatchObject({ externalId: "abc", applyUrl: "https://jobs.lever.co/acme/abc/apply" });
    expect(await lever.fetchPosting("acme", "abc", gone)).toBeNull();
  });

  it("Ashby selects the posting from the board, null when absent or board missing", async () => {
    const board = { jobs: [{ id: "a", title: "A", jobUrl: "https://jobs.ashbyhq.com/o/a" }, { id: "b", title: "B", jobUrl: "https://jobs.ashbyhq.com/o/b" }] };
    expect(await ashby.fetchPosting("o", "b", json(board))).toMatchObject({ externalId: "b", applyUrl: "https://jobs.ashbyhq.com/o/b/application" });
    expect(await ashby.fetchPosting("o", "zzz", json(board))).toBeNull();
    expect(await ashby.fetchPosting("o", "a", gone)).toBeNull();
  });
});
