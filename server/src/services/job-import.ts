import type { AtsProvider, Preferences } from "@auto-career/shared";
import { HttpError } from "../lib/errors";
import { atsAdapters, type NormalizedJob, type Region } from "./ats";
import { passesHardFilters } from "./fit";
import { normalizePosting } from "./normalize-posting";
import { employerLink, parseJobUrl, type EmployerLink, type ParsedJobUrl } from "./job-url";
import { SafeFetchError } from "./safe-fetch";

export interface ImportResult {
  jobId: string;
  /** Only when the match is in the feed (status new): a below-bar match is server-only (matching-85). */
  matchId: string | null;
  fit: { passed: boolean; reasons: string[] };
}

export interface ExistingMatch {
  id: string;
  status: string;
  score: number | null;
}

/** Everything that touches the network or the database, so the decisions below run in unit tests. */
export interface ImportIo {
  fetchPosting(ats: AtsProvider, boardToken: string, postingId: string, region?: Region): Promise<NormalizedJob | null>;
  /** Insert-or-get on (ats, boardToken). `name` is only used when the company is new. */
  upsertCompany(ats: AtsProvider, boardToken: string, name: string, region?: Region): Promise<{ id: string; name: string; active: boolean }>;
  /** Insert-or-update on (companyId, externalId), using jobUpsertValues so an existing row keeps its source. */
  upsertJob(companyId: string, job: NormalizedJob): Promise<{ id: string; inserted: boolean }>;
  loadPreferences(userId: string): Promise<Preferences | null>;
  recentApplicationsToCompany(userId: string, companyId: string): Promise<number>;
  findMatch(userId: string, jobId: string): Promise<ExistingMatch | null>;
  /** Insert-or-get on (userId, jobId). Writes the row as given only when none exists. */
  ensureMatch(m: { userId: string; jobId: string; passed: boolean; reasons: string[]; status: "new" | "below_bar"; score: number | null }): Promise<string>;
  /** One scorer call for the pair, or null when it cannot run: see scoreImported. */
  scorePair(userId: string, jobId: string, job: NormalizedJob, companyName: string): Promise<{ score: number; reasons: string[] } | null>;
  /** A new posting of an active company reaches the other users the way a polled one does. */
  fanOut(jobId: string): Promise<void>;
  /** The Greenhouse board an employer's host belongs to, when a company names that host. */
  boardForHost(host: string): Promise<string | null>;
  /** Queues a link Kairos cannot read for the owner (board_requests). Never fetches it. */
  recordBoardRequest(userId: string, link: EmployerLink): Promise<void>;
}

export const NO_PREFERENCES_REASON = "Add your preferences to check fit";
export const belowBarReason = (score: number, bar: number) => `Scored ${score}, under your fit bar of ${bar}`;

/** "acme-corp" -> "Acme Corp". Good enough until the poller learns the real name. */
export function companyNameFromToken(token: string): string {
  return token
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Column values for the job upsert, through normalizePosting. `source` is in the insert values only, so polling never
 * loses it and an import never overwrites it. A reopen clears closed_by with closed_at (jobs_closed_coherent_ck).
 */
export function jobUpsertValues(companyId: string, job: NormalizedJob) {
  const { externalId, ...content } = normalizePosting(job);
  return {
    insert: { companyId, externalId, source: "manual_url" as const, ...content },
    update: { ...content, closedAt: null, closedBy: null },
  };
}

const UNSUPPORTED = () => new HttpError(422, "unsupported_board", "Kairos can read Greenhouse, Lever and Ashby job links");

/**
 * The pasted link as a board and posting, or a 422 that queues it for the owner. An employer page carrying ?gh_jid= is
 * read through the company whose domain it is on (matching-87): its board token comes from our own row, and the page
 * itself is never fetched (B.8.6).
 */
async function resolveLink(userId: string, url: string, io: ImportIo): Promise<ParsedJobUrl> {
  const parsed = parseJobUrl(url);
  if (parsed) return parsed;
  const link = employerLink(url);
  if (!link) throw UNSUPPORTED();
  if (link.postingId) {
    const boardToken = await io.boardForHost(link.host);
    if (boardToken) return { ats: "greenhouse", boardToken, postingId: link.postingId };
  }
  await io.recordBoardRequest(userId, link);
  throw UNSUPPORTED();
}

/**
 * Imports one pasted posting link for a user: gate, then scorer, then the bar (matching-85). Only the parsed board token
 * and id ever reach the network (never the pasted URL), so a link cannot steer a request to another host.
 *
 * A gate failure is stored below_bar with passed_filters false, and costs no model call. A pass takes one synchronous
 * scorer call and one dailyScoringCap unit: at or over the user's bar it is "new" (in the feed), under it below_bar. When
 * the scorer cannot run (no preferences, no confirmed fact, cap reached, model down) the match is "new" with no score:
 * the feed shows only scored matches, so it waits there, and the user can still tailor. A second import of the same
 * posting reads the stored match and pays nothing. Below-bar rows stay queueable: "Tailor anyway" queues them by id.
 */
export async function importJob(userId: string, url: string, io: ImportIo): Promise<ImportResult> {
  const parsed = await resolveLink(userId, url, io);

  let posting: NormalizedJob | null;
  try {
    posting = await io.fetchPosting(parsed.ats, parsed.boardToken, parsed.postingId, parsed.region);
  } catch (err) {
    if (err instanceof SafeFetchError || (err as Error).name === "ZodError") {
      throw new HttpError(503, "service_unavailable", "That job board is not answering right now. Try again in a few minutes.", { reason: "board_unavailable" });
    }
    throw err;
  }
  if (!posting) throw new HttpError(404, "posting_not_found", "That posting was not found or is closed");

  const company = await io.upsertCompany(parsed.ats, parsed.boardToken, companyNameFromToken(parsed.boardToken), parsed.region);
  const job = await io.upsertJob(company.id, posting);
  if (job.inserted && company.active) await io.fanOut(job.id);

  const prefs = await io.loadPreferences(userId);
  const existing = await io.findMatch(userId, job.id);
  const matchIdOf = (m: ExistingMatch) => (m.status === "new" ? m.id : null);

  if (!prefs) {
    if (existing) return { jobId: job.id, matchId: matchIdOf(existing), fit: { passed: true, reasons: [NO_PREFERENCES_REASON] } };
    const matchId = await io.ensureMatch({ userId, jobId: job.id, passed: true, reasons: [], status: "new", score: null });
    return { jobId: job.id, matchId, fit: { passed: true, reasons: [NO_PREFERENCES_REASON] } };
  }

  const recent = await io.recentApplicationsToCompany(userId, company.id);
  const gate = passesHardFilters({ ...posting, companyName: company.name }, prefs, recent);
  const bar = prefs.fitThreshold;

  if (existing) {
    const under = existing.score !== null && existing.score < bar;
    const reasons = gate.pass ? (under ? [belowBarReason(existing.score!, bar)] : []) : gate.reasons;
    return { jobId: job.id, matchId: matchIdOf(existing), fit: { passed: gate.pass && !under, reasons } };
  }
  if (!gate.pass) {
    await io.ensureMatch({ userId, jobId: job.id, passed: false, reasons: gate.reasons, status: "below_bar", score: null });
    return { jobId: job.id, matchId: null, fit: { passed: false, reasons: gate.reasons } };
  }

  const scored = await io.scorePair(userId, job.id, posting, company.name);
  if (scored && scored.score < bar) {
    await io.ensureMatch({ userId, jobId: job.id, passed: true, reasons: scored.reasons, status: "below_bar", score: scored.score });
    return { jobId: job.id, matchId: null, fit: { passed: false, reasons: [belowBarReason(scored.score, bar)] } };
  }
  const matchId = await io.ensureMatch({ userId, jobId: job.id, passed: true, reasons: scored?.reasons ?? [], status: "new", score: scored?.score ?? null });
  return { jobId: job.id, matchId, fit: { passed: true, reasons: [] } };
}

/** Production fetch: the adapter's single-posting call against the provider's public API. */
export const fetchPostingFromBoard: ImportIo["fetchPosting"] = (ats, token, id, region) => atsAdapters[ats].fetchPosting(token, id, { region });
