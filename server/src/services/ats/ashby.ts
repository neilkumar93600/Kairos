import { z } from "zod";
import { BoardNotFoundError, getJson, htmlToText, looksRemote, type AtsAdapter, type NormalizedJob } from "./types";

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

export function normalizeAshby(body: unknown): NormalizedJob[] {
  return ashbyBoard
    .parse(body)
    .jobs.filter((j) => j.isListed !== false)
    .map((j) => {
      const salary = j.compensation?.summaryComponents?.find(
        (c) => c.compensationType === "Salary" && c.currencyCode === "USD" && (c.interval ?? "").includes("YEAR"),
      );
      return {
        externalId: j.id,
        title: j.title.trim(),
        location: j.location ?? null,
        remote: j.isRemote === true || looksRemote(j.location),
        department: j.department ?? null,
        descriptionText: j.descriptionPlain?.trim() || htmlToText(j.descriptionHtml ?? ""),
        applyUrl: j.applyUrl ?? `${j.jobUrl}/application`,
        postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
        salaryMinUsd: salary?.minValue ?? null,
        salaryMaxUsd: salary?.maxValue ?? null,
        raw: j,
      };
    });
}

/** Public posting API: GET api.ashbyhq.com/posting-api/job-board/{name}, no key needed. */
export const ashby: AtsAdapter = {
  provider: "ashby",
  async fetchBoard(boardToken, fetchImpl = fetch) {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardToken)}?includeCompensation=true`;
    const { status, body } = await getJson(url, fetchImpl);
    if (status === 404) throw new BoardNotFoundError("ashby", boardToken);
    return normalizeAshby(body);
  },
  // ponytail: Ashby's public API has no single-posting endpoint, so this reads the whole board and picks one; fine until a board holds thousands of postings.
  async fetchPosting(boardToken, postingId, fetchImpl = fetch) {
    try {
      return (await ashby.fetchBoard(boardToken, fetchImpl)).find((j) => j.externalId === postingId) ?? null;
    } catch (err) {
      if (err instanceof BoardNotFoundError) return null;
      throw err;
    }
  },
};
