import { and, asc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db, type Db } from "../db/client";
import { applications, opsAudit, outbox, submissionAttempts } from "../db/schema";
import { queue, QUEUE_CONFIG, redrive, type JobData, type OutboxQueue, type QueueName } from "../jobs/queues";
import { HttpError, notFound } from "../lib/errors";
import { deadline } from "../lib/lifecycle";
import { logger } from "../lib/logger";
import { gauge } from "../lib/metrics";
import { signal } from "../lib/sentry";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The durable seam for money and sending (WP-22, ADR-001 Revision 3): a Postgres outbox drained into BullMQ. To use it:
 *
 *   1. In the transaction of the business change: await emitOutbox(tx, "cloud-apply", { applicationId, attemptNo }, key).
 *      The key is stable for one piece of work (a retry reuses it, a new attempt gets its own) and becomes the job id.
 *   2. Write the consumer as an ordinary BullMQ processor that is safe to run twice: delivery is at least once. It marks
 *      nothing here. A job BullMQ calls completed is the row's completion, which keeps the applier free of any outbox grant.
 *   3. Add the queue to OUTBOX_QUEUES (jobs/queues.ts) and its refusal to RESUME_REFUSALS below; the compiler asks for both.
 *
 * What runs it: startOutboxDrain in the worker (rows to jobs, 1 s poll) and sweepOutbox on the maintenance queue (jobs to
 * outcomes, every minute). A crash between the commit and the add leaves the row pending for the next drain. A crash between
 * the add and the mark rolls the mark back, and the next add is a no-op on the job id. A crash in a consumer leaves the job
 * to BullMQ's stall handling, and a job that fails for good or vanishes from Redis goes back through the drain, at most
 * MAX_ATTEMPTS times with back-off, then the row is dead until an operator resumes it (/api/admin/outbox).
 */

const BATCH = 100;
const POLL_MS = 1000;
/** Well under the worker role's 30 s idle-in-transaction limit: the drain holds its row locks while it talks to Redis. */
const REDIS_DEADLINE_MS = 10_000;
export const MAX_ATTEMPTS = 5;
/** Oldest undelivered row, seconds; the same bar as the queues' lag alert (jobs/alerts.ts). */
const LAG_BAR_S = 300;

/** Shaped like an id, a code or a number. ponytail: a shape, not a meaning (one word passes); JobData's types and review do the rest. */
const ID_SHAPE = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Throws on anything that is not id-shaped, so free text can never reach a row: the row outlives the work by days. No user
 * id either, which keeps the table out of erasure's scope: a consumer reads the owner from the row the payload names.
 */
export function assertIdsOnly(data: object): void {
  for (const [field, value] of Object.entries(data)) {
    if (field === "userId") throw new Error("outbox payload field userId is not allowed: name the row, not its owner");
    if (value === undefined || typeof value === "number" || typeof value === "boolean") continue;
    if (typeof value !== "string" || !ID_SHAPE.test(value)) throw new Error(`outbox payload field ${field} is not an id`);
  }
}

/**
 * One key per attempt, so a resend is its own row and job: a `done` row under one key would swallow the next attempt through
 * ON CONFLICT DO NOTHING. Rows of the previous release keep `apply-<id>`; processReconcileApply reads both forms.
 */
export const cloudApplyKey = (applicationId: string, attemptNo: number): string => `apply-${applicationId}-${attemptNo}`;

/**
 * Records follow-up work in the caller's transaction. The same key twice is one row. Throws (which rolls the caller back) on
 * a key or payload that is not ids.
 */
export async function emitOutbox<N extends OutboxQueue>(tx: Db | Tx, name: N, data: JobData[N], key: string): Promise<void> {
  assertIdsOnly(data);
  if (!ID_SHAPE.test(key)) throw new Error("outbox key is not id-shaped");
  await tx.insert(outbox).values({ queue: name, dedupeKey: key, payload: data }).onConflictDoNothing({ target: outbox.dedupeKey });
}

/**
 * One pass: up to BATCH due rows become BullMQ jobs. SKIP LOCKED lets replicas share the work, and the locks are held over
 * the Redis calls so the mark commits only after its add. An add that Redis could not take leaves the row pending and costs
 * no attempt: Redis being down delays the work, it does not fail it. An add BullMQ refuses spends one (addSpendsAttempt), so
 * a poison row dies and pages like a poison job. The add replaces a finished job of the same id, or a re-delivered row's add
 * would be a no-op on the failed job BullMQ keeps for 7 days.
 */
export async function drainOutbox(): Promise<number> {
  const out = await db().transaction(async (tx) => {
    const rows = await tx
      .select({ id: outbox.id, queue: outbox.queue, dedupeKey: outbox.dedupeKey, payload: outbox.payload, attempts: outbox.attempts })
      .from(outbox)
      .where(and(eq(outbox.status, "pending"), lte(outbox.availableAt, sql`now()`)))
      .orderBy(asc(outbox.availableAt))
      .limit(BATCH)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return { drained: 0, deadKeys: [] };

    const added = await Promise.allSettled(rows.map((r) => deadline(redrive(r.queue as QueueName, r.payload as never, r.dedupeKey, true), REDIS_DEADLINE_MS)));
    const ok = rows.filter((_, i) => added[i]!.status === "fulfilled").map((r) => r.id);
    // A row of a queue this release does not know is the next release's, mid-deploy: left alone, not poison.
    const spends = (r: (typeof rows)[number], i: number) => {
      const a = added[i]!;
      return a.status === "rejected" && r.queue in QUEUE_CONFIG && addSpendsAttempt(a.reason);
    };
    const poison = rows.filter(spends);
    const refused = rows.filter((r, i) => added[i]!.status === "rejected" && !spends(r, i)).map((r) => r.id);
    if (ok.length) {
      await tx.update(outbox).set({ status: "enqueued", lastError: null, availableAt: sql`now() + interval '1 minute'`, updatedAt: sql`now()` }).where(inArray(outbox.id, ok));
    }
    if (refused.length) {
      logger.warn({ refused: refused.length }, "outbox rows not enqueued");
      await tx.update(outbox).set({ lastError: "enqueue_failed", availableAt: sql`now() + interval '5 seconds'`, updatedAt: sql`now()` }).where(inArray(outbox.id, refused));
    }
    const dead = poison.filter((r) => afterJobState("failed", r.attempts) === "dead");
    await spendAttempt(tx, poison.filter((r) => !dead.includes(r)).map((r) => r.id), "pending", "enqueue_rejected");
    await spendAttempt(tx, dead.map((r) => r.id), "dead", "enqueue_rejected");
    return { drained: rows.length, deadKeys: dead.map((r) => r.dedupeKey) };
  });
  reportDead(out.deadKeys);
  return out.drained;
}

/**
 * Whether a failed add is the row's fault, not Redis's: the deadline, a socket error (it has a code), a closed connection or
 * any reply from Redis (OOM on a full noeviction Redis, READONLY, LOADING) say Redis could not take it, and retrying is right.
 * What is left is BullMQ refusing the id or the data, which no retry will change. The text never reaches the row.
 */
export function addSpendsAttempt(err: unknown): boolean {
  const e = err as { name?: string; code?: unknown; message?: string };
  if (e.code !== undefined || e.name === "ReplyError" || e.name === "MaxRetriesPerRequestError" || e.name === "AbortError") return false;
  return !/^(timeout$|Connection is closed)/.test(e.message ?? "");
}

/** A delivery came to nothing: one attempt spent, and either the back-off (30 s, 1 min, 2 min, 4 min) or the end. The code only: an error's own text can hold anything. */
async function spendAttempt(tx: Tx, ids: string[], status: "pending" | "dead", code: "job_failed" | "job_lost" | "enqueue_rejected"): Promise<void> {
  if (!ids.length) return;
  await tx
    .update(outbox)
    .set({ status, attempts: sql`${outbox.attempts} + 1`, lastError: code, availableAt: sql`now() + make_interval(secs => 30 * power(2, ${outbox.attempts}))`, updatedAt: sql`now()` })
    .where(inArray(outbox.id, ids));
}

function reportDead(keys: string[]): void {
  if (!keys.length) return;
  logger.error({ keys }, "outbox rows dead: an operator must look");
  signal("outbox_dead", keys.length);
}

/** Age of the oldest row that has not reached Redis yet. Re-deliveries have their own bound (attempts), so they do not count. */
async function observeLag(): Promise<void> {
  const [row] = await db()
    .select({ s: sql<number>`coalesce(extract(epoch from now() - min(${outbox.createdAt})), 0)::float8` })
    .from(outbox)
    .where(and(eq(outbox.status, "pending"), eq(outbox.attempts, 0)));
  const lag = row?.s ?? 0;
  gauge("queue_lag_s", lag, "outbox");
  // Raised here and not only by the alert evaluator, which is a BullMQ job and cannot tick while Redis is the cause.
  if (lag > LAG_BAR_S) signal("outbox_lag");
}

/** The worker's drain loop. A pass that fails (Postgres restarting) is logged and the next one tries again. Returns the stop. */
export function startOutboxDrain(): () => Promise<void> {
  let stopped = false;
  const loop = (async () => {
    while (!stopped) {
      let drained = 0;
      try {
        drained = await drainOutbox();
        await observeLag();
      } catch (err) {
        logger.warn({ err }, "outbox drain failed");
      }
      if (drained < BATCH && !stopped) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  })();
  return async () => {
    stopped = true;
    await loop;
  };
}

/** What a row marked enqueued becomes, given its job. completed: the consumer finished. failed or gone: deliver it again, or give up. */
export function afterJobState(state: string, attempts: number): "done" | "wait" | "retry" | "dead" {
  if (state === "completed") return "done";
  if (state !== "failed" && state !== "unknown") return "wait";
  return attempts + 1 >= MAX_ATTEMPTS ? "dead" : "retry";
}

/**
 * Every minute: reads each due enqueued row's job and acts on afterJobState. Oldest looked-at first, and a live job's row
 * moves to the back, so a parked backlog cannot hide newer rows. A job whose state cannot be read (Redis down) is left for
 * the next tick; an outage spends no attempts. last_error is a code: a job's own error text can hold anything.
 */
export async function sweepOutbox(): Promise<{ done: number; retried: number; dead: number }> {
  const out = await db().transaction(async (tx) => {
    const rows = await tx
      .select({ id: outbox.id, queue: outbox.queue, dedupeKey: outbox.dedupeKey, attempts: outbox.attempts })
      .from(outbox)
      .where(and(eq(outbox.status, "enqueued"), lte(outbox.availableAt, sql`now()`)))
      .orderBy(asc(outbox.availableAt))
      .limit(BATCH * 2)
      .for("update", { skipLocked: true });
    const stateOf = async (r: (typeof rows)[number]) => {
      const job = await queue(r.queue as QueueName).getJob(r.dedupeKey);
      return job ? await job.getState() : "unknown";
    };
    const states = await Promise.allSettled(rows.map((r) => deadline(stateOf(r), REDIS_DEADLINE_MS)));
    const seen = rows.flatMap((r, i) => {
      const s = states[i]!;
      return s.status === "fulfilled" ? [{ ...r, action: afterJobState(s.value, r.attempts), code: s.value === "failed" ? "job_failed" : "job_lost" }] : [];
    });
    const ids = (keep: (r: (typeof seen)[number]) => boolean) => seen.filter(keep).map((r) => r.id);

    const done = ids((r) => r.action === "done");
    const wait = ids((r) => r.action === "wait");
    if (done.length) await tx.update(outbox).set({ status: "done", lastError: null, updatedAt: sql`now()` }).where(inArray(outbox.id, done));
    if (wait.length) await tx.update(outbox).set({ availableAt: sql`now() + interval '1 minute'` }).where(inArray(outbox.id, wait));
    for (const code of ["job_failed", "job_lost"] as const) {
      await spendAttempt(tx, ids((r) => r.action === "retry" && r.code === code), "pending", code);
      await spendAttempt(tx, ids((r) => r.action === "dead" && r.code === code), "dead", code);
    }
    return { done: done.length, retried: ids((r) => r.action === "retry").length, deadKeys: seen.filter((r) => r.action === "dead").map((r) => r.dedupeKey) };
  });
  reportDead(out.deadKeys);
  const summary = await outboxSummary();
  gauge("outbox_dead", summary.dead);
  gauge("outbox_pending", summary.pending);
  return { done: out.done, retried: out.retried, dead: out.deadKeys.length };
}

/** Live rows per status and the oldest undelivered row's age: the head of the admin list, and the gauges. */
export async function outboxSummary(): Promise<{ pending: number; enqueued: number; dead: number; oldestPendingS: number }> {
  const [row] = await db()
    .select({
      pending: sql<number>`(count(*) filter (where ${outbox.status} = 'pending'))::int`,
      enqueued: sql<number>`(count(*) filter (where ${outbox.status} = 'enqueued'))::int`,
      dead: sql<number>`(count(*) filter (where ${outbox.status} = 'dead'))::int`,
      oldestPendingS: sql<number>`coalesce(extract(epoch from now() - min(${outbox.createdAt}) filter (where ${outbox.status} = 'pending')), 0)::float8`,
    })
    .from(outbox)
    .where(sql`${outbox.status} <> 'done'`);
  return { pending: row?.pending ?? 0, enqueued: row?.enqueued ?? 0, dead: row?.dead ?? 0, oldestPendingS: row?.oldestPendingS ?? 0 };
}

/**
 * Why a dead cloud-apply row may not run again, or null. The job's own claim would stop a second send, but this is the guard
 * for the operator: `submitting` means a browser may have clicked submit, and only settlement may decide that one. Anything
 * else but `approved` has nothing to send. Fails closed on a row with no application. Scoped to the row's attempt: an earlier
 * attempt's settled send does not refuse a resend's row, and a row of an earlier attempt has nothing left to run. A payload
 * of the previous release has no number and means the current attempt.
 */
async function cloudApplyRefusal(tx: Tx, applicationId: unknown, rowAttemptNo: unknown): Promise<string | null> {
  if (typeof applicationId !== "string") return "no_application";
  // Locked, so nothing can claim it between this read and the resume's commit.
  const [app] = await tx.select({ status: applications.status, channel: applications.channel, attemptNo: applications.attemptNo }).from(applications).where(eq(applications.id, applicationId)).for("update");
  if (!app) return "no_application";
  if (app.status === "submitting") return "past_browser_step";
  if (app.status !== "approved" || app.channel !== "cloud") return "not_approved";
  if (typeof rowAttemptNo === "number" && rowAttemptNo !== app.attemptNo) return "stale_attempt";
  const [attempt] = await tx
    .select({ id: submissionAttempts.id })
    .from(submissionAttempts)
    .where(
      and(
        eq(submissionAttempts.applicationId, applicationId),
        eq(submissionAttempts.attemptNo, Math.max(app.attemptNo, 1)),
        eq(submissionAttempts.channel, "cloud"),
        or(isNotNull(submissionAttempts.browserLaunchedAt), isNotNull(submissionAttempts.submitSeenAt), eq(submissionAttempts.state, "open")),
      ),
    )
    .limit(1);
  return attempt ? "past_browser_step" : null;
}

/** What may refuse a resume, per queue the outbox feeds. Default deny: a queue with no entry does not resume (no_refusal_check). */
const RESUME_REFUSALS: Record<OutboxQueue, (tx: Tx, payload: Record<string, unknown>) => Promise<string | null>> = {
  "cloud-apply": (tx, payload) => cloudApplyRefusal(tx, payload.applicationId, payload.attemptNo),
};

/**
 * The operator's resume of a dead row: back to pending with its attempts reset, and an ops_audit row in the same transaction.
 * Only a dead row: the others are moving, or finished. `reason` is a short code (the audit row must hold no free text).
 */
export async function resumeOutbox(id: string, actor: string, reason: string): Promise<{ id: string; status: "pending" }> {
  return db().transaction(async (tx) => {
    const [row] = await tx.select().from(outbox).where(eq(outbox.id, id)).for("update");
    if (!row) throw notFound("Outbox row");
    const check = Object.hasOwn(RESUME_REFUSALS, row.queue) ? RESUME_REFUSALS[row.queue as OutboxQueue] : undefined;
    const refusal = row.status !== "dead" ? "not_dead" : check ? await check(tx, row.payload as Record<string, unknown>) : "no_refusal_check";
    if (refusal) {
      logger.warn({ outboxId: id, refusal, actor }, "outbox resume refused");
      throw new HttpError(409, "resume_refused", "This item cannot be resumed", { reason: refusal });
    }
    await tx.update(outbox).set({ status: "pending", attempts: 0, availableAt: sql`now()`, updatedAt: sql`now()` }).where(eq(outbox.id, id));
    await tx.insert(opsAudit).values({
      actor,
      action: "outbox_resume",
      target: `outbox:${id}`,
      before: { status: row.status, attempts: row.attempts, lastError: row.lastError },
      after: { status: "pending", attempts: 0, reason },
    });
    return { id, status: "pending" as const };
  });
}
