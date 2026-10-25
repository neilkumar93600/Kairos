import { z } from "zod";
import { BoardNotFoundError, getJson, htmlToText, looksRemote, type AtsAdapter, type NormalizedJob } from "./types";

const greenhouseJob = z.object({
  id: z.number(),
  title: z.string(),
  absolute_url: z.string(),
  updated_at: z.string().nullish(),
  first_published: z.string().nullish(),
  content: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  departments: z.array(z.object({ name: z.string() })).nullish(),
});
const greenhouseBoard = z.object({ jobs: z.array(greenhouseJob) });

/**
 * `absolute_url` often points at the employer's own careers page (e.g. stripe.com/jobs/search?gh_jid=...),
 * and boards with a custom domain redirect their hosted job page there. The embed URL serves the
 * application form itself for every board, so the extension and cloud applier fill that page.
 */
export function hostedFormUrl(boardToken: string, jobId: number): string {
  return `https://job-boards.greenhouse.io/embed/job_app?for=${encodeURIComponent(boardToken)}&token=${jobId}`;
}

export function normalizeGreenhouse(body: unknown, boardToken: string): NormalizedJob[] {
  return greenhouseBoard.parse(body).jobs.map((j) => {
    const location = j.location?.name ?? null;
    const published = j.first_published ?? j.updated_at;
    return {
      externalId: String(j.id),
      title: j.title.trim(),
      location,
      remote: looksRemote(location, j.title),
      department: j.departments?.[0]?.name ?? null,
      descriptionText: htmlToText(j.content ?? ""),
      applyUrl: hostedFormUrl(boardToken, j.id),
      postedAt: published ? new Date(published) : null,
      salaryMinUsd: null,
      salaryMaxUsd: null,
      raw: j,
    };
  });
}

/** Public Job Board API: GET boards-api.greenhouse.io/v1/boards/{token}/jobs, no key needed. */
export const greenhouse: AtsAdapter = {
  provider: "greenhouse",
  async fetchBoard(boardToken, fetchImpl = fetch) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
    const { status, body } = await getJson(url, fetchImpl);
    if (status === 404) throw new BoardNotFoundError("greenhouse", boardToken);
    return normalizeGreenhouse(body, boardToken);
  },
  /** Single-posting endpoint: GET boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}?content=true. */
  async fetchPosting(boardToken, postingId, fetchImpl = fetch) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(postingId)}?content=true`;
    const { status, body } = await getJson(url, fetchImpl);
    if (status === 404) return null;
    return normalizeGreenhouse({ jobs: [body] }, boardToken)[0] ?? null;
  },
};
