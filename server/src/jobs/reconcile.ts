import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { applications } from "../db/schema";
import { logger } from "../lib/logger";
import { signal } from "../lib/sentry";
import { sweepStuckSubmitting } from "../services/submissions";
import { redrive } from "./queues";

/**
 * State reconcilers on the maintenance queue (platform-v02, interim BullMQ form until DBOS). Each one repairs by a
 * conditional statement or an idempotent job id, so a slow run overlapping the next tick, or two workers, change
 * nothing twice.
 */

/** Runs `fn` for each id; one failure does not stop the rest, and the job then fails so Sentry hears of it. */
async function each(task: string, ids: string[], fn: (id: string) => Promise<boolean>): Promise<number> {
  let done = 0;
  const failed: unknown[] = [];
  for (const id of ids) {
    try {
      if (await fn(id)) done += 1;
    } catch (err) {
      failed.push(err);
      logger.warn({ err, task }, "reconcile item failed");
    }
  }
  if (failed.length) throw new AggregateError(failed, `${task}: ${failed.length} of ${ids.length} failed`);
  return done;
}

/** Every 30 seconds, so a claim leaves submitting within 10.5 minutes (the acceptance allows 11). */
export async function processSweepSubmitting(): Promise<{ swept: number }> {
  const swept = await sweepStuckSubmitting(db());
  if (swept.length) {
    logger.warn({ applicationIds: swept }, "stuck cloud sends settled as unconfirmed");
    signal("submitting_swept", swept.length);
  }
  return { swept: swept.length };
}

/**
 * Every minute: an approved cloud application with no live cloud-apply job (the approve route enqueues after its
 * commit, so a Redis blip or a lost job leaves the credit reserved and nothing sending). Two minutes old first, so the
 * route's own enqueue lands. The job goes through the applier's claim and its plan and posting prechecks, which are
 * what decide; a finished job is replaced, since an approved row was never claimed and so nothing was sent.
 * ponytail: the oldest 200 per tick, one Redis lookup each; a backlog larger than that hides newer losses. Add an
 * enqueued_at column, or WP-22's outbox, when the applier queue runs that deep.
 */
export async function processReconcileApply(): Promise<{ checked: number; added: number }> {
  const rows = await db()
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.status, "approved"), eq(applications.channel, "cloud"), sql`${applications.approvedAt} < now() - interval '2 minutes'`))
    .orderBy(asc(applications.approvedAt))
    .limit(200);
  const added = await each("reconcile-apply", rows.map((r) => r.id), (id) => redrive("cloud-apply", { applicationId: id }, `apply-${id}`, true));
  if (added) logger.warn({ added }, "lost cloud-apply jobs re-added");
  return { checked: rows.length, added };
}
