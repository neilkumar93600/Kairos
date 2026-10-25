import type { Job } from "bullmq";
import { and, eq, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { db, type Db } from "../db/client";
import { companies, jobs } from "../db/schema";
import { logger } from "../lib/logger";
import { atsAdapters, BoardNotFoundError } from "../services/ats";
import { enqueue, type JobData } from "./queues";

const STANDARD_INTERVAL_MIN = 30;
const PRIORITY_INTERVAL_MIN = 5;

/** Finds companies due for a poll and fans out one job each. Runs every minute via a job scheduler. */
async function scheduleDuePolls(): Promise<number> {
  const due = await db()
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
    .limit(500);
  // jobId per company and minute keeps a slow poll from being queued twice.
  const minute = Math.floor(Date.now() / 60_000);
  await Promise.all(due.map((c) => enqueue("poll-boards", { companyId: c.id }, `poll-${c.id}-${minute}`)));
  return due.length;
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
    const message = err instanceof Error ? err.message : String(err);
    await db()
      .update(companies)
      .set({ lastPolledAt: new Date(), lastPollError: message, active: !(err instanceof BoardNotFoundError) })
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
