import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { applications, creditLedger, erasedEmails, inboundEmails, profiles, session, subscriptions, user, verification } from "../db/schema";
import { logger } from "../lib/logger";
import { signal } from "../lib/sentry";
import { bootstrapUser } from "../services/bootstrap";
import { archiveLedger } from "../services/erasure";
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

/**
 * Every 5 minutes: a draft tailoring never reached (no lines and no answers; tailoring always writes the profile
 * answers) from the last day, whose tailor job Redis lost: the match route enqueues after its insert. A finished job
 * is never replaced, since each rerun is a model call: a failed one stays failed (kept 7 days, past the lookback).
 */
export async function processRedriveDrafts(): Promise<{ checked: number; added: number }> {
  const rows = await db()
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.status, "draft"),
        sql`${applications.resumeLines} = '[]'::jsonb and ${applications.answers} = '[]'::jsonb`,
        sql`${applications.createdAt} between now() - interval '1 day' and now() - interval '5 minutes'`,
      ),
    )
    .limit(500);
  const added = await each("redrive-drafts", rows.map((r) => r.id), (id) => redrive("tailor-application", { applicationId: id }, `tailor-${id}`, false));
  if (added) logger.warn({ added }, "lost tailoring jobs re-added");
  return { checked: rows.length, added };
}

/**
 * Every 5 minutes: mail still unclassified 5 minutes after it arrived, from the last 7 days (messaging-20 a). The
 * classifier is rules only, so a failed job is simply replaced.
 * ponytail: no attempt counter, so a mail that always fails retries every 5 minutes for 7 days (and Sentry hears of
 * each); add the counter and the poison fallback with the model classifier (messaging-20 b, c).
 */
export async function processRedriveInbox(): Promise<{ checked: number; added: number }> {
  const rows = await db()
    .select({ id: inboundEmails.id })
    .from(inboundEmails)
    .where(and(isNull(inboundEmails.kind), sql`${inboundEmails.receivedAt} between now() - interval '7 days' and now() - interval '5 minutes'`))
    .limit(500);
  const added = await each("redrive-inbox", rows.map((r) => r.id), (id) => redrive("classify-email", { inboundEmailId: id }, `classify-${id}`, true));
  if (added) logger.warn({ added }, "lost classify jobs re-added");
  return { checked: rows.length, added };
}

/**
 * Every minute: a user from the last 2 days, past their first minute, missing the profile, the subscriptions row or the
 * free grant: the sign-up hook failed after Better Auth committed the user (billing-67, R-4). bootstrapUser is the
 * hook's own body and inserts only what is missing, so the grant is written once however often this runs.
 */
export async function processBootstrapUsers(): Promise<{ repaired: number }> {
  const rows = await db()
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        sql`${user.createdAt} between now() - interval '2 days' and now() - interval '1 minute'`,
        sql`(not exists (select 1 from ${profiles} where ${profiles.userId} = ${user.id})
          or not exists (select 1 from ${subscriptions} where ${subscriptions.userId} = ${user.id})
          or (not exists (select 1 from ${creditLedger} where ${creditLedger.userId} = ${user.id} and ${creditLedger.reason} = 'free_grant')
            and not exists (select 1 from ${profiles} join ${erasedEmails} on ${erasedEmails.emailHash} = ${profiles.normalizedEmailHash}
                             where ${profiles.userId} = ${user.id})))`,
      ),
    )
    .limit(200);
  const repaired = await each("bootstrap-users", rows.map((r) => r.id), (id) => bootstrapUser(db(), id));
  if (repaired) {
    logger.warn({ repaired }, "sign-up bootstrap finished by the reconciler");
    signal("signup_repaired", repaired);
  }
  return { repaired };
}

/**
 * Daily at 03:30 UTC (R-1, R-2). Accounts left unverified for 14 days are deleted with everything that cascades from
 * them, oldest first in batches of 500 until none is left: verification comes before any session (FR-3), so they hold
 * no upload, subscription or Stripe customer, only the sign-up rows and the free grant, which is archived under the
 * user hash first like any erased ledger (WP-25). Sessions go 7 days after they expire and verification codes after 1.
 * Locked rows are skipped and deletes are plain, so two workers delete each row once.
 */
export async function processAuthSweep(): Promise<{ users: number; sessions: number; verifications: number }> {
  let users = 0;
  for (;;) {
    const purged = await db().transaction(async (tx) => {
      const ids = (
        await tx
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.emailVerified, false), sql`${user.createdAt} < now() - interval '14 days'`))
          .orderBy(asc(user.createdAt))
          .limit(500)
          .for("update", { skipLocked: true })
      ).map((r) => r.id);
      await archiveLedger(tx, ids);
      return ids.length ? (await tx.delete(user).where(inArray(user.id, ids)).returning({ id: user.id })).length : 0;
    });
    users += purged;
    if (purged < 500) break;
  }
  const sessions = await db().delete(session).where(sql`${session.expiresAt} < now() - interval '7 days'`).returning({ id: session.id });
  const codes = await db().delete(verification).where(sql`${verification.expiresAt} < now() - interval '1 day'`).returning({ id: verification.id });
  const result = { users, sessions: sessions.length, verifications: codes.length };
  logger.info(result, "auth sweep");
  return result;
}
