import { z } from "zod";
import { parseJobUrl } from "../job-url";
import { MiB } from "../safe-fetch";
import { BoardNotFoundError, getJson, htmlToText, looksRemote, type AtsAdapter, type NormalizedJob } from "./types";

const HOST = "api.ashbyhq.com";

const ashbyJob = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string().nullish(),
  department: z.string().nullish(),
  isRemote: z.boolean().nullish(),
  isListed: z.boolean().nullish(),
  descriptionPlain: z.string().nullish(),
  descriptionHtml: z.string().nullish(),
  publishedAt: z.string().nullish(),
  jobUrl: z.string(),
  applyUrl: z.string().nullish(),
  compensation: z
    .object({
      summaryComponents: z
        .array(
          z.object({
            compensationType: z.string().nullish(),
            interval: z.string().nullish(),
            currencyCode: z.string().nullish(),
            minValue: z.number().nullish(),
            maxValue: z.number().nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
});
const ashbyBoard = z.object({ jobs: z.array(ashbyJob) });

/** The hosted form, built from the board name and posting id, never the payload's URLs (see leverApplyUrl). */
export function ashbyApplyUrl(board: string, postingId: string): string | null {
  const url = `https://jobs.ashbyhq.com/${board}/${postingId}/application`;
  const parsed = parseJobUrl(url);
  return parsed?.boardToken === board && parsed.postingId === postingId.toLowerCase() ? url : null;
}

export function normalizeAshby(body: unknown, board: string): NormalizedJob[] {
  return ashbyBoard
    .parse(body)
    .jobs.filter((j) => j.isListed !== false)
    .flatMap((j) => {
      const applyUrl = ashbyApplyUrl(board, j.id);
      if (!applyUrl) return [];
      const salary = j.compensation?.summaryComponents?.find(
        (c) => c.compensationType === "Salary" && c.currencyCode === "USD" && (c.interval ?? "").includes("YEAR"),
      );
      return [{
        externalId: j.id,
        title: j.title.trim(),
        location: j.location ?? null,
        remote: j.isRemote === true || looksRemote(j.location),
        department: j.department ?? null,
        descriptionText: j.descriptionPlain?.trim() || htmlToText(j.descriptionHtml ?? ""),
        applyUrl,
        postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
        salaryMinUsd: salary?.minValue ?? null,
        salaryMaxUsd: salary?.maxValue ?? null,
        raw: j,
      }];
    });
}

/** Public posting API: GET api.ashbyhq.com/posting-api/job-board/{name}, no key needed. */
export const ashby: AtsAdapter = {
  provider: "ashby",
  async fetchBoard(boardToken, req = {}) {
    const url = `https://${HOST}/posting-api/job-board/${encodeURIComponent(boardToken)}?includeCompensation=true`;
    const res = await getJson(url, { host: HOST, maxBytes: 12 * MiB, etag: req.etag, fetcher: req.fetcher });
    if (res.status === 404) throw new BoardNotFoundError("ashby", boardToken);
    if (res.status === 304) return { kind: "not_modified" };
    return { kind: "listing", postings: normalizeAshby(res.body, boardToken), etag: res.etag };
  },
  // ponytail: Ashby's public API has no single-posting endpoint, so this reads the whole board and picks one; fine until a board holds thousands of postings.
  async fetchPosting(boardToken, postingId, req = {}) {
    try {
      const board = await ashby.fetchBoard(boardToken, { fetcher: req.fetcher });
      return board.kind === "listing" ? (board.postings.find((j) => j.externalId === postingId) ?? null) : null;
    } catch (err) {
      if (err instanceof BoardNotFoundError) return null;
      throw err;
    }
  },
};
