import { createHash } from "node:crypto";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { jobs } from "../db/schema";
import type { NormalizedJob } from "./ats/types";
import { JUNIOR_TITLE, NO_SPONSORSHIP, SENIOR_TITLE } from "./fit";

/**
 * normalizePosting (04-matching 2.2, 2.3; matching-17, v07): every posting from a poll or an import passes through this
 * pure function before it touches jobs. The gate columns (title_lc, location_lc) hold exactly the strings
 * passesHardFilters compares, so the SQL prefilter and the TypeScript gate agree. Bump HINTS_VERSION when a rule
 * changes; refreshJobHints then recomputes every row below it.
 */
export const HINTS_VERSION = 1;
export const DESCRIPTION_MAX_CHARS = 60_000;

export type SeniorityHint = "intern" | "entry" | "mid" | "senior" | "staff_plus" | "manager" | "unknown";
export type SponsorshipHint = "no_sponsorship" | "sponsors";

export interface NormalizedPosting extends NormalizedJob {
  titleLc: string;
  titleNorm: string;
  locationLc: string;
  locationNorm: string;
  titleSeniorFlag: boolean;
  titleJuniorFlag: boolean;
  seniorityHint: SeniorityHint;
  sponsorshipHint: SponsorshipHint | null;
  hintsVersion: number;
  /** sha256 hex of every field above except raw and hintsVersion: a version bump or payload churn is not a content change. */
  contentHash: string;
  /** sha256 hex of normalizeForHash(descriptionText). */
  descriptionHash: string;
  /** 64-bit SimHash of description shingles, as a signed bigint (the jobs.simhash column). */
  simhash: bigint;
}

/** Dedup key of a title (04-matching 2.2): suffixes in brackets and requisition ids go, seniority words stay. */
export function titleNorm(titleLc: string): string {
  return titleLc
    .normalize("NFKC")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(req|r|jr|job)[ #-]?\d{3,}\b/g, " ")
    .replace(/\s+-\s+\d{4,}\s*$/, " ")
    .replace(/[^\p{L}\p{N}+#./]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dedup key of a location: work-mode words and punctuation go, tokens sorted ("NY, New York" = "New York, NY"). */
export function locationNorm(locationLc: string): string {
  return locationLc
    .normalize("NFKC")
    .replace(/\b(remote|hybrid|on-?site|anywhere)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

const SENIORITY: [RegExp, SeniorityHint][] = [
  [/\b(intern|internship|co-?op)\b/, "intern"],
  [/\b(new grad|graduate|entry|junior|jr\.?|associate)\b/, "entry"],
  [/\b(staff|principal|distinguished|fellow|architect)\b/, "staff_plus"],
  [/\b(head of|director|vp|vice president|manager)\b/, "manager"],
  [/\b(senior|sr\.?|lead)\b/, "senior"],
  [/\b(ii|iii|2|3|mid)\b/, "mid"],
];

/** First match wins. F1 and the job card read it; the gate never does. */
export function seniorityOf(titleLc: string): SeniorityHint {
  return SENIORITY.find(([re]) => re.test(titleLc))?.[1] ?? "unknown";
}

const SPONSORS = /\b(will|can|able to) sponsor\b|\bvisa sponsorship (is )?available\b|\bsponsorship available\b/i;
const BOILERPLATE = /equal opportunity employer|reasonable accommodation|e-verify/;

/** Lower case, NFKC, digits to 0, EEO and benefits boilerplate lines dropped, whitespace collapsed. Hashes only. */
export function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\d/g, "0")
    .split("\n")
    .filter((line) => !BOILERPLATE.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ponytail: a short English list; the spec names none. Changing it moves every simhash, so bump HINTS_VERSION with it.
const STOP_WORDS = new Set("a an and are as at be by for from has have in is it of on or our the this to we will with you your".split(" "));

/** Standard SimHash over 5-token shingles, each hashed with the first 8 bytes of MD5. Under 40 tokens: 0 (no family). */
export function simhash(description: string): bigint {
  const tokens = normalizeForHash(description)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t && !STOP_WORDS.has(t));
  if (tokens.length < 40) return 0n;
  const weights = new Array<number>(64).fill(0);
  for (let i = 0; i + 5 <= tokens.length; i++) {
    const h = createHash("md5").update(tokens.slice(i, i + 5).join(" ")).digest().readBigUInt64BE(0);
    for (let bit = 0; bit < 64; bit++) weights[bit]! += (h >> BigInt(bit)) & 1n ? 1 : -1;
  }
  let out = 0n;
  for (let bit = 0; bit < 64; bit++) if (weights[bit]! > 0) out |= 1n << BigInt(bit);
  return BigInt.asIntN(64, out);
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export function normalizePosting(job: NormalizedJob): NormalizedPosting {
  const title = job.title.replace(/\s+/g, " ").trim();
  const descriptionText = job.descriptionText.slice(0, DESCRIPTION_MAX_CHARS);
  const titleLc = title.toLowerCase();
  const locationLc = (job.location ?? "").toLowerCase();
  const sponsorshipHint: SponsorshipHint | null = NO_SPONSORSHIP.test(descriptionText)
    ? "no_sponsorship"
    : SPONSORS.test(descriptionText)
      ? "sponsors"
      : null;
  const fields = {
    externalId: job.externalId,
    title,
    titleLc,
    titleNorm: titleNorm(titleLc),
    location: job.location,
    locationLc,
    locationNorm: locationNorm(locationLc),
    remote: job.remote,
    department: job.department,
    descriptionText,
    applyUrl: job.applyUrl,
    postedAt: job.postedAt,
    salaryMinUsd: job.salaryMinUsd,
    salaryMaxUsd: job.salaryMaxUsd,
    titleSeniorFlag: SENIOR_TITLE.test(title),
    titleJuniorFlag: JUNIOR_TITLE.test(title),
    seniorityHint: seniorityOf(titleLc),
    sponsorshipHint,
  };
  return {
    ...fields,
    raw: job.raw,
    hintsVersion: HINTS_VERSION,
    contentHash: sha256(JSON.stringify(fields)),
    descriptionHash: sha256(normalizeForHash(descriptionText)),
    simhash: simhash(descriptionText),
  };
}

/**
 * Backfill B-6 and the HINTS_VERSION refresh: recomputes the derived columns of up to `limit` rows still below
 * HINTS_VERSION with an id above `afterId`, in id order, and returns how many it wrote and the last id. A caller walks
 * the table once by passing that id back, so no batch re-reads the rows earlier batches fixed. Only derived columns
 * change: no visible_at bump, so a refresh never shows an old posting again. Safe to rerun and beside the poller.
 * ponytail: one UPDATE per row; batch it into one statement when a refresh of 150,000 open jobs is too slow.
 */
export async function refreshJobHints(db: Db, limit = 1000, afterId?: string): Promise<{ n: number; lastId: string | undefined }> {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(lt(jobs.hintsVersion, HINTS_VERSION), afterId ? gt(jobs.id, afterId) : undefined))
    .orderBy(asc(jobs.id))
    .limit(limit);
  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx.update(jobs).set(hintColumns(normalizePosting(row))).where(eq(jobs.id, row.id));
    }
  });
  return { n: rows.length, lastId: rows.at(-1)?.id ?? afterId };
}

/** The jobs columns normalizePosting owns (INV-1: no other writer sets them). Spread into every jobs insert and update. */
export function hintColumns(p: NormalizedPosting) {
  return {
    titleLc: p.titleLc,
    titleNorm: p.titleNorm,
    locationLc: p.locationLc,
    locationNorm: p.locationNorm,
    titleSeniorFlag: p.titleSeniorFlag,
    titleJuniorFlag: p.titleJuniorFlag,
    seniorityHint: p.seniorityHint,
    sponsorshipHint: p.sponsorshipHint,
    hintsVersion: p.hintsVersion,
    contentHash: p.contentHash,
    descriptionHash: p.descriptionHash,
    simhash: p.simhash,
  };
}
