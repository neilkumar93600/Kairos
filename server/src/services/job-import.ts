import type { AtsProvider, Preferences } from "@auto-career/shared";
import { HttpError } from "../lib/errors";
import { atsAdapters, type NormalizedJob } from "./ats";
import { passesHardFilters } from "./fit";
import { parseJobUrl } from "./job-url";

export interface ImportResult {
  jobId: string;
  matchId: string | null;
  fit: { passed: boolean; reasons: string[] };
}

/** Everything that touches the network or the database, so the decisions below run in unit tests. */
export interface ImportIo {
  fetchPosting(ats: AtsProvider, boardToken: string, postingId: string): Promise<NormalizedJob | null>;
  /** Insert-or-get on (ats, boardToken). `name` is only used when the company is new. */
  upsertCompany(ats: AtsProvider, boardToken: string, name: string): Promise<{ id: string; name: string }>;
  /** Insert-or-update on (companyId, externalId), using jobUpsertValues so an existing row keeps its source. */
  upsertJob(companyId: string, job: NormalizedJob): Promise<{ id: string }>;
  loadPreferences(userId: string): Promise<Preferences | null>;
  recentApplicationsToCompany(userId: string, companyId: string): Promise<number>;
  /** Insert-or-get on (userId, jobId); returns the match id either way. */
  ensureMatch(m: { userId: string; jobId: string; passed: boolean; reasons: string[] }): Promise<string>;
}

export const NO_PREFERENCES_REASON = "Add your preferences to check fit";

/** "acme-corp" -> "Acme Corp". Good enough until the poller learns the real name. */
export function companyNameFromToken(token: string): string {
  return token
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Column values for the job upsert. `source` is in the insert values only, so polling never loses it and an import never overwrites it. */
export function jobUpsertValues(companyId: string, job: NormalizedJob) {
  const content = {
    title: job.title,
    location: job.location,
    remote: job.remote,
    department: job.department,
    descriptionText: job.descriptionText,
    applyUrl: job.applyUrl,
    salaryMinUsd: job.salaryMinUsd,
    salaryMaxUsd: job.salaryMaxUsd,
    postedAt: job.postedAt,
    raw: job.raw,
  };
  return { insert: { companyId, externalId: job.externalId, source: "manual_url" as const, ...content }, update: { ...content, closedAt: null } };
}

/**
 * Imports one pasted posting link for a user. Only the parsed board token and id ever reach the network
 * (never the pasted URL), so a link cannot steer a request to another host.
 * A match row is always created: passed fits are "new" (they show in the feed), failed fits are
 * "skipped" so the web's "Tailor anyway" can still queue them without polluting the feed.
 */
export async function importJob(userId: string, url: string, io: ImportIo): Promise<ImportResult> {
  const parsed = parseJobUrl(url);
  if (!parsed) throw new HttpError(422, "unsupported_board", "Kairos can read Greenhouse, Lever and Ashby job links");

  const posting = await io.fetchPosting(parsed.ats, parsed.boardToken, parsed.postingId);
  if (!posting) throw new HttpError(404, "posting_not_found", "That posting was not found or is closed");

  const company = await io.upsertCompany(parsed.ats, parsed.boardToken, companyNameFromToken(parsed.boardToken));
  const job = await io.upsertJob(company.id, posting);

  const prefs = await io.loadPreferences(userId);
  let fit: ImportResult["fit"];
  if (prefs) {
    const recent = await io.recentApplicationsToCompany(userId, company.id);
    const r = passesHardFilters({ ...posting, companyName: company.name }, prefs, recent);
    fit = { passed: r.pass, reasons: r.reasons };
  } else {
    fit = { passed: true, reasons: [NO_PREFERENCES_REASON] };
  }

  const matchId = await io.ensureMatch({ userId, jobId: job.id, passed: fit.passed, reasons: fit.passed ? [] : fit.reasons });
  return { jobId: job.id, matchId, fit };
}

/** Production fetch: the adapter's single-posting call against the provider's public API. */
export const fetchPostingFromBoard: ImportIo["fetchPosting"] = (ats, token, id) => atsAdapters[ats].fetchPosting(token, id);
