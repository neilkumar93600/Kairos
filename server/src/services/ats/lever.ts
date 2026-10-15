import { z } from "zod";
import { BoardNotFoundError, getJson, htmlToText, looksRemote, type AtsAdapter, type NormalizedJob } from "./types";

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

export function normalizeLever(body: unknown): NormalizedJob[] {
  return z.array(leverPosting).parse(body).map((p) => {
    const location = p.categories?.location ?? null;
    const isUsdYearly = p.salaryRange?.currency === "USD" && (p.salaryRange.interval ?? "").includes("year");
    const listText = (p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
    return {
      externalId: p.id,
      title: p.text.trim(),
      location,
      remote: p.workplaceType === "remote" || looksRemote(location),
      department: p.categories?.department ?? p.categories?.team ?? null,
      descriptionText: [p.descriptionPlain, listText, p.additionalPlain].filter(Boolean).join("\n\n").trim(),
      applyUrl: p.applyUrl ?? `${p.hostedUrl}/apply`,
      postedAt: p.createdAt ? new Date(p.createdAt) : null,
      salaryMinUsd: isUsdYearly ? (p.salaryRange?.min ?? null) : null,
      salaryMaxUsd: isUsdYearly ? (p.salaryRange?.max ?? null) : null,
      raw: p,
    };
  });
}

/** Public Postings API: GET api.lever.co/v0/postings/{site}?mode=json, no key needed. */
export const lever: AtsAdapter = {
  provider: "lever",
  async fetchBoard(boardToken, fetchImpl = fetch) {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(boardToken)}?mode=json`;
    const { status, body } = await getJson(url, fetchImpl);
    if (status === 404) throw new BoardNotFoundError("lever", boardToken);
    return normalizeLever(body);
  },
};
