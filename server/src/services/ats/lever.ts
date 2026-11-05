import { z } from "zod";
import { parseJobUrl } from "../job-url";
import { MiB } from "../safe-fetch";
import { BoardNotFoundError, getJson, htmlToText, looksRemote, POSTING_MAX_BYTES, type AtsAdapter, type NormalizedJob, type Region } from "./types";

/** The API and hosted-form hosts of each Lever region (matching-28): an EU board 404s on the US API. */
const HOSTS: Record<Region, { api: string; apply: string }> = {
  us: { api: "api.lever.co", apply: "jobs.lever.co" },
  eu: { api: "api.eu.lever.co", apply: "jobs.eu.lever.co" },
};

const leverPosting = z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.string(),
  applyUrl: z.string().nullish(),
  createdAt: z.number().nullish(),
  descriptionPlain: z.string().nullish(),
  additionalPlain: z.string().nullish(),
  workplaceType: z.string().nullish(),
  categories: z
    .object({ location: z.string().nullish(), team: z.string().nullish(), department: z.string().nullish() })
    .nullish(),
  lists: z.array(z.object({ text: z.string(), content: z.string() })).nullish(),
  salaryRange: z
    .object({ min: z.number().nullish(), max: z.number().nullish(), currency: z.string().nullish(), interval: z.string().nullish() })
    .nullish(),
});

/**
 * The hosted form, built from the board token and posting id (CISO mustFix 1(2)): the payload's applyUrl and
 * hostedUrl could name any host. Null unless both parts pass job-url's own patterns unchanged.
 */
export function leverApplyUrl(site: string, postingId: string, region: Region = "us"): string | null {
  const url = `https://${HOSTS[region].apply}/${site}/${postingId}/apply`;
  const parsed = parseJobUrl(url);
  return parsed?.boardToken === site && parsed.postingId === postingId.toLowerCase() ? url : null;
}

export function normalizeLever(body: unknown, site: string, region: Region = "us"): NormalizedJob[] {
  return z.array(leverPosting).parse(body).flatMap((p) => {
    const applyUrl = leverApplyUrl(site, p.id, region);
    if (!applyUrl) return [];
    const location = p.categories?.location ?? null;
    const isUsdYearly = p.salaryRange?.currency === "USD" && (p.salaryRange.interval ?? "").includes("year");
    const listText = (p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
    return [{
      externalId: p.id,
      title: p.text.trim(),
      location,
      remote: p.workplaceType === "remote" || looksRemote(location),
      department: p.categories?.department ?? p.categories?.team ?? null,
      descriptionText: [p.descriptionPlain, listText, p.additionalPlain].filter(Boolean).join("\n\n").trim(),
      applyUrl,
      postedAt: p.createdAt ? new Date(p.createdAt) : null,
      salaryMinUsd: isUsdYearly ? (p.salaryRange?.min ?? null) : null,
      salaryMaxUsd: isUsdYearly ? (p.salaryRange?.max ?? null) : null,
      raw: p,
    }];
  });
}

/** Public Postings API: GET api.lever.co/v0/postings/{site}?mode=json (api.eu.lever.co for EU boards), no key needed. */
export const lever: AtsAdapter = {
  provider: "lever",
  async fetchBoard(boardToken, req = {}) {
    const region = req.region ?? "us";
    const host = HOSTS[region].api;
    const res = await getJson(`https://${host}/v0/postings/${encodeURIComponent(boardToken)}?mode=json`, { host, maxBytes: 8 * MiB, etag: req.etag, fetcher: req.fetcher });
    if (res.status === 404) throw new BoardNotFoundError("lever", boardToken);
    if (res.status === 304) return { kind: "not_modified" };
    return { kind: "listing", postings: normalizeLever(res.body, boardToken, region), etag: res.etag };
  },
  /** Single-posting endpoint: GET api.lever.co/v0/postings/{site}/{id}. */
  async fetchPosting(boardToken, postingId, req = {}) {
    const region = req.region ?? "us";
    const host = HOSTS[region].api;
    const url = `https://${host}/v0/postings/${encodeURIComponent(boardToken)}/${encodeURIComponent(postingId)}`;
    const res = await getJson(url, { host, maxBytes: POSTING_MAX_BYTES, fetcher: req.fetcher });
    if (res.status !== 200) return null;
    return normalizeLever([res.body], boardToken, region)[0] ?? null;
  },
};
