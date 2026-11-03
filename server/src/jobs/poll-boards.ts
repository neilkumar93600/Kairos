import type { Job } from "bullmq";
import { and, desc, eq, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { db, type Db } from "../db/client";
import { companies, jobs } from "../db/schema";
import { logger } from "../lib/logger";
import { atsAdapters, BoardNotFoundError } from "../services/ats";
import { enqueue, queue, type JobData } from "./queues";

const STANDARD_INTERVAL_MIN = 30;
const PRIORITY_INTERVAL_MIN = 5;

/** The most polls one minute's tick keeps queued, counting those still waiting from earlier ticks. */
const MAX_PENDING_POLLS = 500;

/** Companies due for a poll: priority boards first, then the longest unpolled, never polled first (scale-v06). */
export async function dueCompanies(database: Db, limit: number): Promise<string[]> {
  const due = await database
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.active, true),
        or(
          isNull(companies.lastPolledAt),
          and(eq(companies.priority, false), lt(companies.lastPolledAt, sql`now() - make_interval(mins => ${STANDARD_INTERVAL_MIN})`)),
          and(eq(companies.priority, true), lt(companies.lastPolledAt, sql`now() - make_interval(mins => ${PRIORITY_INTERVAL_MIN})`)),
        ),
      ),
    )
    .orderBy(desc(companies.priority), sql`${companies.lastPolledAt} asc nulls first`)
    .limit(limit);
  return due.map((c) => c.id);
}

/**
 * Fans out one job per due company; runs every minute via a job scheduler. Bounded by the backlog (scale-v06): polls
 * still waiting from earlier ticks leave less room, so a slow minute never piles up more than MAX_PENDING_POLLS.
 */
async function scheduleDuePolls(): Promise<number> {
  const due = await dueCompanies(db(), MAX_PENDING_POLLS);
  if (due.length === 0) return 0;
  const room = MAX_PENDING_POLLS - (await queue("poll-boards").getJobCountByTypes("wait", "delayed"));
  const picked = due.slice(0, Math.max(0, room));
  // jobId per company and minute keeps a slow poll from being queued twice.
  const minute = Math.floor(Date.now() / 60_000);
  await Promise.all(picked.map((id) => enqueue("poll-boards", { companyId: id }, `poll-${id}-${minute}`)));
  return picked.length;
}

/**
 * Closes the company's open jobs that the board no longer lists. An empty board is treated as a transient
 * outage, not "every job closed": closing everything would expire every match and draft for that company.
 */
// ponytail: a board that truly closes every posting stays open until it lists something again; add a second-empty-poll rule (needs a column) if that matters.
export async function closeMissingJobs(database: Db, companyId: string, openIds: string[]): Promise<number> {
  if (openIds.length === 0) return 0;
  const closed = await database
    .update(jobs)
    .set({ closedAt: new Date() })
    .where(and(eq(jobs.companyId, companyId), isNull(jobs.closedAt), notInArray(jobs.externalId, openIds)))
    .returning({ id: jobs.id });
  return closed.length;
}

/** Short code stored in companies.last_poll_error: raw exception text can carry URLs, tokens and payload fragments. */
export function pollErrorCode(err: unknown): string {
  if (err instanceof BoardNotFoundError) return "board_not_found";
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "timeout";
    if (err instanceof SyntaxError || err.name === "ZodError") return "bad_payload";
    const status = /failed with (\d{3})$/.exec(err.message);
    if (status) return `http_${status[1]}`;
  }
  return "poll_failed";
}

async function pollCompany(companyId: string): Promise<{ added: number; closed: number }> {
  const [company] = await db().select().from(companies).where(eq(companies.id, companyId));
  if (!company || !company.active) return { added: 0, closed: 0 };

  try {
    const postings = await atsAdapters[company.ats].fetchBoard(company.boardToken);
    const inserted = postings.length
      ? await db()
          .insert(jobs)
          .values(postings.map((p) => ({ ...p, companyId })))
          .onConflictDoNothing({ target: [jobs.companyId, jobs.externalId] })
          .returning({ id: jobs.id })
      : [];

    const closed = await closeMissingJobs(db(), companyId, postings.map((p) => p.externalId));

    await db().update(companies).set({ lastPolledAt: new Date(), lastPollError: null }).where(eq(companies.id, companyId));
    await Promise.all(inserted.map((j) => enqueue("score-matches", { jobId: j.id }, `score-${j.id}`)));
    return { added: inserted.length, closed };
  } catch (err) {
    await db()
      .update(companies)
      .set({ lastPolledAt: new Date(), lastPollError: pollErrorCode(err), active: !(err instanceof BoardNotFoundError) })
      .where(eq(companies.id, companyId));
    if (err instanceof BoardNotFoundError) return { added: 0, closed: 0 };
    throw err;
  }
}

export async function processPollBoards(job: Job<JobData["poll-boards"]>) {
  if ("schedule" in job.data) {
    const n = await scheduleDuePolls();
    logger.debug({ n }, "scheduled board polls");
    return { scheduled: n };
  }
  const result = await pollCompany(job.data.companyId);
  logger.info({ companyId: job.data.companyId, ...result }, "polled board");
  return result;
}
