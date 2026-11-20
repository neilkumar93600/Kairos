import type { Job } from "bullmq";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Db } from "../db/client";
import { companies, jobs, matches } from "../db/schema";
import { logger } from "../lib/logger";
import { redis } from "../lib/redis";
import { signal } from "../lib/sentry";
import { atsAdapters, BoardNotFoundError, type BoardResult, type NormalizedJob } from "../services/ats";
import { normalizePosting } from "../services/normalize-posting";
import { SafeFetchError } from "../services/safe-fetch";
import { enqueue, queue, type JobData } from "./queues";

/**
 * Board polling (workers/01-ingest-poller, in BullMQ form until WP-22's seam; CISO mustFix 3, matching-02,08..14,28):
 * a claim with a lease on next_poll_at, conditional GETs, per-host back-off, the suspect-listing guard, two-strike 404
 * and a guarded upsert that reopens. A company with discovered_by=import is polled only to close the jobs it already
 * stored: it inserts nothing, updates nothing and scores nothing until the owner activates it (POST
 * /api/admin/companies/:id/activate), which is the only thing that makes a pasted board cost a model call.
 */

const STANDARD_INTERVAL_MIN = 30;
const PRIORITY_INTERVAL_MIN = 5;
const LEASE_STANDARD_MIN = 10;
const LEASE_PRIORITY_MIN = 4;
const SIX_HOURS_MIN = 360;
const MINUTE = 60_000;

/** The most polls one minute's tick keeps queued, counting those still waiting from earlier ticks. */
const MAX_PENDING_POLLS = 500;
export const SHRINK_RATIO = 0.5;
export const SHRINK_MIN_OPEN = 10;
/** One poll in N ignores the stored ETag, so a board stuck on a stale 304 heals (matching-08). */
export const FULL_REFRESH_ONE_IN = 96;
const UPSERT_CHUNK = 500;
/** Pasted postings missing from a listing that one poll re-checks one by one; the rest wait for the next poll. */
const MAX_POSTING_CHECKS = 20;

/** Every API host a company can have (companies_hosts_ck). */
export const API_HOSTS = ["boards-api.greenhouse.io", "api.lever.co", "api.eu.lever.co", "api.ashbyhq.com"] as const;

export type ListingVerdict = { trusted: true } | { trusted: false; kind: "empty" | "shrink" };

/**
 * The suspect-listing guard (01-ingest-poller 3.3): an empty listing, or one under half of at least 10 open jobs, closes
 * nothing on its first sighting; a second consecutive suspect poll (27 to 33 minutes later) is believed. A truncated
 * listing therefore never mass-closes, and a board that really emptied closes half an hour late.
 */
export function decideListing(openBefore: number, listedCount: number, streak: number): ListingVerdict {
  if (openBefore === 0) return { trusted: true };
  const kind = listedCount === 0 ? "empty" : openBefore >= SHRINK_MIN_OPEN && listedCount < SHRINK_RATIO * openBefore ? "shrink" : null;
  return kind && streak < 1 ? { trusted: false, kind } : { trusted: true };
}

export type PollSituation = { kind: "ok"; priority: boolean; firstPoll: boolean } | { kind: "suspect" } | { kind: "error"; priority: boolean; consecutiveErrors: number };

/** Milliseconds to the next poll (01-ingest-poller 3.5), with jitter so seeded or activated boards spread over the cycle. */
export function nextPollDelayMs(s: PollSituation, rand: () => number = Math.random): number {
  const between = (lo: number, hi: number) => lo + (hi - lo) * rand();
  switch (s.kind) {
    case "ok":
      if (s.firstPoll) return STANDARD_INTERVAL_MIN * MINUTE * between(0.5, 1.5);
      return (s.priority ? PRIORITY_INTERVAL_MIN : STANDARD_INTERVAL_MIN) * MINUTE * between(0.95, 1.05);
    case "suspect":
      return STANDARD_INTERVAL_MIN * MINUTE * between(0.9, 1.1);
    case "error": {
      const base = s.priority ? PRIORITY_INTERVAL_MIN : STANDARD_INTERVAL_MIN;
      return Math.min(base * 2 ** Math.max(s.consecutiveErrors - 1, 0), SIX_HOURS_MIN) * MINUTE * between(0.9, 1.1);
    }
  }
}

const BACKOFF_BASE_MIN = 15;
const BACKOFF_MAX_MIN = 120;
const RETRY_AFTER_MAX_MIN = 60;
const LEVEL_TTL_MS = 6 * 60 * MINUTE;

/** 15, 30, 60, 120 minutes by level, or Retry-After when longer (honoured up to an hour). */
export function backoffDelayMs(level: number, retryAfterMs?: number): number {
  const ladder = Math.min(BACKOFF_BASE_MIN * 2 ** (Math.max(level, 1) - 1), BACKOFF_MAX_MIN) * MINUTE;
  return Math.max(ladder, Math.min(retryAfterMs ?? 0, RETRY_AFTER_MAX_MIN * MINUTE));
}

/** Which hosts are resting, shared by every worker replica. */
export interface HostBackoff {
  /** Host -> resting until (epoch ms), for the hosts now in back-off. */
  until(hosts: readonly string[]): Promise<Map<string, number>>;
  /** Starts or lengthens the host's rest; the level decays 6 hours after the last hit. Returns when it ends. */
  hit(host: string, retryAfterMs?: number): Promise<number>;
}

/**
 * In Redis with a TTL rather than an ops_flags row (01-ingest-poller 3.4 writes one): ops_flags_key_ck and setFlag's
 * audit trail are for operator switches, and a key that expires by itself cannot get stuck on.
 */
export function redisBackoff(): HostBackoff {
  const key = (host: string) => `kairos:host_backoff:${host}`;
  const levelKey = (host: string) => `kairos:host_backoff_level:${host}`;
  return {
    async until(hosts) {
      const values = await redis().mget(...hosts.map(key));
      const now = Date.now();
      return new Map(hosts.flatMap((host, i) => (Number(values[i]) > now ? [[host, Number(values[i])] as [string, number]] : [])));
    },
    async hit(host, retryAfterMs) {
      const level = await redis().incr(levelKey(host));
      await redis().pexpire(levelKey(host), LEVEL_TTL_MS);
      const delay = backoffDelayMs(level, retryAfterMs);
      const until = Date.now() + delay;
      await redis().set(key(host), String(until), "PX", delay);
      return until;
    },
  };
}

let backoff: HostBackoff | undefined;
const hostBackoff = () => (backoff ??= redisBackoff());
/** Tests keep it in memory. */
export function setHostBackoff(next: HostBackoff): void {
  backoff = next;
}

/**
 * Takes the companies due for a poll, priority first then the longest overdue, and leases them by moving next_poll_at
 * out: a slow poll is not claimed again, and a poll whose job is lost comes back when the lease ends. Hosts in back-off
 * are not claimed at all. An imported company is due only while it has an open job to close.
 * ponytail: the import_pending branch misses companies_due_idx; fine while companies is a few thousand rows.
 */
export async function claimDueCompanies(database: Db, limit: number, restingHosts: readonly string[] = []): Promise<string[]> {
  if (limit <= 0) return [];
  const rows = await database.execute<{ id: string }>(sql`
    with due as (
      select c.id from companies c
       where c.next_poll_at <= now()
         and (c.active or (c.inactive_reason = 'import_pending'
              and exists (select 1 from jobs j where j.company_id = c.id and j.closed_at is null)))
         ${restingHosts.length ? sql`and c.api_host not in (${sql.join(restingHosts.map((h) => sql`${h}`), sql`, `)})` : sql``}
       order by c.priority desc, c.next_poll_at
       limit ${limit}
       for update of c skip locked
    )
    update companies c
       set next_poll_at = now() + make_interval(mins => case when c.priority then ${LEASE_PRIORITY_MIN}::int else ${LEASE_STANDARD_MIN}::int end)
      from due
     where c.id = due.id
    returning c.id`);
  return rows.rows.map((r) => r.id);
}

/**
 * Fans out one job per due company; runs every minute via a job scheduler. Bounded by the backlog (scale-v06): polls
 * still waiting from earlier ticks leave less room, so a slow minute never piles up more than MAX_PENDING_POLLS.
 */
async function scheduleDuePolls(): Promise<number> {
  const room = MAX_PENDING_POLLS - (await queue("poll-boards").getJobCountByTypes("wait", "delayed"));
  const resting = await hostBackoff().until(API_HOSTS);
  const claimed = await claimDueCompanies(db(), room, [...resting.keys()]);
  const minute = Math.floor(Date.now() / MINUTE);
  await Promise.all(claimed.map((id) => enqueue("poll-boards", { companyId: id }, `poll-${id}-${minute}`)));
  return claimed.length;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Closes open jobs and expires their open matches (01-ingest-poller 3.6). matches_status_guard keeps queued and skipped
 * rows out of reach, and the WHERE never asks it to touch one.
 */
export async function closeJobs(database: Db | Tx, jobIds: string[], closedBy: "poll" | "posting_fetch"): Promise<number> {
  if (jobIds.length === 0) return 0;
  const closed = await database
    .update(jobs)
    .set({ closedAt: new Date(), closedBy })
    .where(and(inArray(jobs.id, jobIds), isNull(jobs.closedAt)))
    .returning({ id: jobs.id });
  if (closed.length) {
    await database
      .update(matches)
      .set({ status: "expired" })
      .where(and(inArray(matches.jobId, closed.map((j) => j.id)), inArray(matches.status, ["new", "below_bar"])));
  }
  return closed.length;
}

const excluded = (column: { name: string }) => sql.raw(`excluded."${column.name}"`);

/** Fields the upsert overwrites: everything normalizePosting returns but the key. */
const UPSERT_COLUMNS = [
  "title", "titleLc", "titleNorm", "location", "locationLc", "locationNorm", "remote", "department", "descriptionText", "applyUrl", "postedAt",
  "salaryMinUsd", "salaryMaxUsd", "titleSeniorFlag", "titleJuniorFlag", "seniorityHint", "sponsorshipHint", "hintsVersion", "contentHash",
  "descriptionHash", "simhash", "raw",
] as const;

/** A change users should see again: a reopen, or anything but cosmetic text (description_hash masks digits and boilerplate). */
const MATERIAL = sql`(${jobs.closedAt} is not null
  or ${jobs.title} is distinct from excluded.title or ${jobs.location} is distinct from excluded.location
  or ${jobs.remote} is distinct from excluded.remote or ${jobs.salaryMinUsd} is distinct from excluded.salary_min_usd
  or ${jobs.salaryMaxUsd} is distinct from excluded.salary_max_usd or ${jobs.applyUrl} is distinct from excluded.apply_url
  or ${jobs.descriptionHash} is distinct from excluded.description_hash)`;
/** An employer's apply page that says closed beats a lagging listing for 24 hours (01-ingest-poller 3.2). */
const STICKY_CLOSE = sql`(${jobs.closedBy} in ('apply_page','questions_404') and ${jobs.closedAt} > now() - interval '24 hours')`;

/**
 * The guarded upsert (matching-14; fixes D-19, closed ids that could never reopen): a row is written only when its
 * content changed or it can reopen. Returns the rows users should see: new, reopened or materially changed, still open.
 */
export async function upsertPostings(tx: Db | Tx, companyId: string, postings: NormalizedJob[]): Promise<{ id: string; visibleAt: Date }[]> {
  const fresh: { id: string; visibleAt: Date }[] = [];
  const rows = [...new Map(postings.map((p) => [p.externalId, p])).values()].map((p) => ({ ...normalizePosting(p), companyId }));
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const written = await tx
      .insert(jobs)
      .values(rows.slice(i, i + UPSERT_CHUNK))
      .onConflictDoUpdate({
        target: [jobs.companyId, jobs.externalId],
        set: {
          ...Object.fromEntries(UPSERT_COLUMNS.map((k) => [k, excluded(jobs[k])])),
          visibleAt: sql`case when ${MATERIAL} then now() else ${jobs.visibleAt} end`,
          closedAt: sql`case when ${STICKY_CLOSE} then ${jobs.closedAt} else null end`,
          closedBy: sql`case when ${STICKY_CLOSE} then ${jobs.closedBy} else null end`,
        },
        setWhere: sql`${jobs.contentHash} is distinct from excluded.content_hash
          or (${jobs.closedAt} is not null and (${jobs.closedBy} in ('poll','posting_fetch') or ${jobs.closedAt} < now() - interval '24 hours'))`,
      })
      .returning({ id: jobs.id, visibleAt: jobs.visibleAt, closedAt: jobs.closedAt, material: sql<boolean>`${jobs.visibleAt} = now()` });
    fresh.push(...written.filter((r) => r.material && !r.closedAt).map(({ id, visibleAt }) => ({ id, visibleAt })));
  }
  return fresh;
}

/** Short code stored in companies.last_poll_error: raw exception text can carry URLs, tokens and payload fragments. */
export function pollErrorCode(err: unknown): string {
  if (err instanceof BoardNotFoundError) return "board_not_found";
  if (err instanceof SafeFetchError) return err.code === "http_error" ? `http_${err.status}` : err.code;
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "timeout";
    if (err instanceof SyntaxError || err.name === "ZodError") return "bad_payload";
  }
  return "poll_failed";
}

type Company = typeof companies.$inferSelect;
export type PollOutcome = "skipped" | "deferred" | "throttled" | "failed" | "not_modified" | "not_found" | "suspect" | "listing";
export interface PollResult {
  outcome: PollOutcome;
  added: number;
  closed: number;
}
const result = (outcome: PollOutcome, added = 0, closed = 0): PollResult => ({ outcome, added, closed });

const at = (delayMs: number) => new Date(Date.now() + delayMs);

const updateCompany = (d: Db | Tx, id: string, set: Partial<typeof companies.$inferInsert>) => d.update(companies).set(set).where(eq(companies.id, id));

async function rest(c: Company, until: number, set: Partial<typeof companies.$inferInsert> = {}): Promise<void> {
  // Spread over 5 minutes, so every board of the host does not come back in the same tick.
  await updateCompany(db(), c.id, { nextPollAt: new Date(until + Math.random() * 5 * MINUTE), ...set });
}

async function failed(c: Company, err: unknown): Promise<PollResult> {
  const code = pollErrorCode(err);
  const consecutiveErrors = c.consecutiveErrors + 1;
  await updateCompany(db(), c.id, {
    consecutiveErrors,
    lastPollError: code,
    lastPolledAt: new Date(),
    nextPollAt: at(nextPollDelayMs({ kind: "error", priority: c.priority, consecutiveErrors })),
  });
  // The hosts come from companies_hosts_ck and the adapters, so a refusal here means something is wrong on our side.
  if (code.startsWith("ssrf_")) signal("board_fetch_refused");
  return result("failed");
}

/**
 * 429 always rests the host. A lone 403 is that board's problem (a disabled board must not stop all of Greenhouse), so
 * it rests the host only when a second board of the host answered 403 in the last 10 minutes (01-ingest-poller C4).
 */
async function throttled(c: Company, err: SafeFetchError): Promise<PollResult> {
  if (err.code === "forbidden") {
    await failed(c, err);
    const [others] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(companies)
      .where(and(eq(companies.apiHost, c.apiHost!), eq(companies.lastPollError, "forbidden"), sql`${companies.lastPolledAt} > now() - interval '10 minutes'`));
    if ((others?.n ?? 0) < 2) return result("failed");
  }
  const until = await hostBackoff().hit(c.apiHost!, err.retryAfterMs);
  logger.warn({ host: c.apiHost, until: new Date(until).toISOString(), status: err.status }, "board host in back-off");
  signal("board_host_backoff");
  await rest(c, until, { lastPolledAt: new Date(), lastPollError: err.code });
  return result("throttled");
}

/** First 404: a suspect poll, confirmed 27 to 33 minutes later. Second in a row: deactivated, and its open jobs close. */
async function notFound(c: Company): Promise<PollResult> {
  const now = new Date();
  if (c.lastPollError !== "board_not_found" || c.emptyStreak < 1) {
    await updateCompany(db(), c.id, {
      emptyStreak: c.emptyStreak + 1,
      lastPollError: "board_not_found",
      lastPolledAt: now,
      nextPollAt: at(nextPollDelayMs({ kind: "suspect" })),
    });
    return result("suspect");
  }
  const closed = await db().transaction(async (tx) => {
    const open = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.companyId, c.id), isNull(jobs.closedAt)));
    const n = await closeJobs(tx, open.map((j) => j.id), "poll");
    await updateCompany(tx, c.id, { active: false, inactiveReason: "board_not_found", lastPolledAt: now, lastPollError: "board_not_found" });
    return n;
  });
  return result("not_found", 0, closed);
}

/**
 * A pasted posting a listing no longer shows may still be live: Greenhouse and Lever serve postings their boards do not
 * list (reconciler M-3, 01-ingest-poller 3.8). Ask the posting's own endpoint, and close only on a clean "gone". Ashby has
 * no such endpoint: its fetchPosting would read this same listing, so the listing is the answer. A failed check waits
 * for the next poll.
 */
async function goneFromBoard(c: Company, pasted: { id: string; externalId: string }[]): Promise<string[]> {
  if (c.ats === "ashby") return pasted.map((j) => j.id);
  const gone: string[] = [];
  for (const job of pasted.slice(0, MAX_POSTING_CHECKS)) {
    const posting = await atsAdapters[c.ats].fetchPosting(c.boardToken, job.externalId, { region: c.apiRegion }).catch(() => undefined);
    if (posting === null) gone.push(job.id);
  }
  return gone;
}

async function applyListing(c: Company, postings: NormalizedJob[], etag: string | null): Promise<PollResult> {
  const closeOnly = !c.active;
  const listed = new Set(postings.map((p) => p.externalId));
  const openBefore = await db()
    .select({ id: jobs.id, externalId: jobs.externalId, source: jobs.source })
    .from(jobs)
    .where(and(eq(jobs.companyId, c.id), isNull(jobs.closedAt)));
  const verdict = decideListing(openBefore.length, listed.size, c.emptyStreak);
  // Outside the transaction: no network call while it holds a lock.
  const gonePasted = verdict.trusted ? await goneFromBoard(c, openBefore.filter((j) => j.source === "manual_url" && !listed.has(j.externalId))) : [];

  const now = new Date();
  const { fresh, closed } = await db().transaction(async (tx) => {
    // Serializes a duplicate poll after a lease expiry with this one, for this company.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`catalog-company:${c.id}`}, 0))`);
    const fresh = closeOnly ? [] : await upsertPostings(tx, c.id, postings);
    let closed = 0;
    if (verdict.trusted) {
      const open = await tx
        .select({ id: jobs.id, externalId: jobs.externalId })
        .from(jobs)
        .where(and(eq(jobs.companyId, c.id), isNull(jobs.closedAt), eq(jobs.source, "board")));
      closed += await closeJobs(tx, open.filter((j) => !listed.has(j.externalId)).map((j) => j.id), "poll");
      closed += await closeJobs(tx, gonePasted, "posting_fetch");
    }
    await updateCompany(tx, c.id, {
      lastPolledAt: now,
      consecutiveErrors: 0,
      ...(verdict.trusted
        ? {
            // A suspect body's ETag is not kept, so the confirming poll reads the whole board again.
            etag,
            lastSuccessAt: now,
            emptyStreak: 0,
            lastPollError: null,
            nextPollAt: at(nextPollDelayMs({ kind: "ok", priority: c.priority, firstPoll: c.lastPolledAt === null })),
          }
        : { emptyStreak: c.emptyStreak + 1, lastPollError: "suspect_listing", nextPollAt: at(nextPollDelayMs({ kind: "suspect" })) }),
    });
    return { fresh, closed };
  });

  if (!verdict.trusted) logger.warn({ companyId: c.id, kind: verdict.kind, openBefore: openBefore.length, listed: listed.size }, "poll suspect listing");
  // The job id carries visible_at: a posting that changes or reopens later is fanned out again.
  await Promise.all(fresh.map((j) => enqueue("score-matches", { jobId: j.id }, `score-${j.id}-${j.visibleAt.getTime()}`)));
  return result(verdict.trusted ? "listing" : "suspect", fresh.length, closed);
}

/**
 * One company's poll. A fetch failure is recorded on the company and answered by its own back-off, never thrown: a
 * BullMQ retry would go straight back into a throttling host. A database failure does throw, and BullMQ retries it.
 */
export async function pollCompany(companyId: string): Promise<PollResult> {
  const [c] = await db().select().from(companies).where(eq(companies.id, companyId));
  if (!c || (!c.active && c.inactiveReason !== "import_pending")) return result("skipped");

  const until = (await hostBackoff().until([c.apiHost!])).get(c.apiHost!);
  if (until) {
    await rest(c, until);
    return result("deferred");
  }

  let board: BoardResult;
  try {
    const etag = Math.random() < 1 / FULL_REFRESH_ONE_IN ? null : c.etag;
    board = await atsAdapters[c.ats].fetchBoard(c.boardToken, { region: c.apiRegion, etag });
  } catch (err) {
    if (err instanceof BoardNotFoundError) return notFound(c);
    if (err instanceof SafeFetchError && (err.code === "throttled" || err.code === "forbidden")) return throttled(c, err);
    return failed(c, err);
  }

  if (board.kind === "not_modified") {
    const now = new Date();
    await updateCompany(db(), c.id, {
      lastPolledAt: now,
      lastSuccessAt: now,
      consecutiveErrors: 0,
      emptyStreak: 0,
      lastPollError: null,
      nextPollAt: at(nextPollDelayMs({ kind: "ok", priority: c.priority, firstPoll: false })),
    });
    return result("not_modified");
  }
  return applyListing(c, board.postings, board.etag);
}

export async function processPollBoards(job: Job<JobData["poll-boards"]>) {
  if ("schedule" in job.data) {
    const n = await scheduleDuePolls();
    logger.debug({ n }, "scheduled board polls");
    return { scheduled: n };
  }
  const polled = await pollCompany(job.data.companyId);
  logger.info({ companyId: job.data.companyId, ...polled }, "polled board");
  return polled;
}
