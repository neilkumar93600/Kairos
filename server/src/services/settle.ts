import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { ApplicationAnswer, SubmissionReport } from "@auto-career/shared";
import type { Db } from "../db/client";
import { applications, companies, jobs, matches, submissionAttempts, type ApplicationFailureCode, type Receipt } from "../db/schema";
import { addNotification, enqueueNotify } from "../jobs/notify";
import { HttpError, notFound } from "../lib/errors";
import { logger } from "../lib/logger";
import { count, slo } from "../lib/metrics";
import { signal } from "../lib/sentry";
import { chargeSubmission } from "./credits";
import { recordEvent } from "./events";
import { redactConfirmation } from "./sensitive";
import { AMBIGUOUS, boundedEvidence, FAILURE_MESSAGES, RESENDABLE, type FailureCode } from "./submissions";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Attempt = typeof submissionAttempts.$inferSelect;
type App = typeof applications.$inferSelect;

/**
 * Settlement (WP-29; workers/08-submission-settlement): an application is `submitted` and charged one credit, or `failed`
 * with a code and no charge. recordOutcome below is the only charge path. The employer's form submit is the pivot: before
 * it a failure releases the reservation, after it only forward recovery is allowed, and when we cannot tell which side we
 * are on we neither charge nor resend (needs_check). No ops flag pauses this: a send that happened is always recordable.
 *
 * The applier writes attempt rows only, through its definer functions. An attempt with settled_at NULL is its own durable
 * record, so settlement needs no queue and no outbox row: the sweep (jobs/reconcile.ts, every 30 s) settles every closed
 * attempt, and a crash anywhere leaves the row for its next pass. Settling twice is a no-op under the row locks.
 */

/**
 * The state a stale attempt closes in, by the phase it stopped in (08 3.2). ponytail: no ap2_verified branch. Interception
 * of the apply POST (submit_seen, applications-60) needs per-ATS proof on a throwaway posting, so `filling` may always
 * follow a click and reads as ambiguous. When S-AP2 passes, `filling` without submit_seen_at can close as applier_error.
 */
export function closeByPhase(attempt: Pick<Attempt, "channel" | "phase">): { state: "failed" | "needs_check"; code: FailureCode } {
  if (attempt.channel === "extension") return { state: "needs_check", code: "no_report" };
  return attempt.phase === "claimed" || attempt.phase === "navigating" ? { state: "failed", code: "applier_error" } : { state: "needs_check", code: "unconfirmed" };
}

/** The decision table (08 3.2, D1 to D10) over a closed attempt. Only D1 charges. */
export function decideSettlement(attempt: Pick<Attempt, "state" | "failureCode" | "submitSeenAt">): { outcome: "submitted" } | { outcome: "failed"; code: FailureCode } {
  if (attempt.state === "submitted") return { outcome: "submitted" };
  const code = attempt.failureCode ?? "unconfirmed";
  // D2: a failure after the apply POST was seen is ambiguous whatever the applier said.
  if (attempt.submitSeenAt && !AMBIGUOUS.has(code)) return { outcome: "failed", code: "unconfirmed" };
  return { outcome: "failed", code };
}

function receiptSummary(filled: { fieldKey: string; value: string }[], app: Pick<App, "answers" | "questions">): { filled: number; total: number; skipped: number; generated: number } {
  const total = app.questions?.length ?? app.answers.length;
  const done = filled.filter((f) => f.value !== "").length;
  const generated = new Set(app.answers.filter((a) => a.source === "generated").map((a) => a.fieldKey));
  return { filled: done, total, skipped: Math.max(0, total - done), generated: filled.filter((f) => generated.has(f.fieldKey)).length };
}

/** A cloud receipt's rows come from the stored answers, never from labels or values the page wrote. */
function cloudReceipt(evidence: unknown, answers: ApplicationAnswer[]): Receipt {
  const e = (evidence ?? {}) as { filledFieldKeys?: string[]; confirmationText?: string };
  const stored = new Map(answers.map((a) => [a.fieldKey, a]));
  const filledFields = (e.filledFieldKeys ?? []).flatMap((key) => {
    const a = stored.get(key);
    return a ? [{ fieldKey: a.fieldKey, label: a.label, value: a.value }] : [];
  });
  return { filledFields, confirmationText: e.confirmationText, channel: "cloud" };
}

/** Submitted: one charge (the unique index makes a second one a no-op), the receipt, the stage, the event. Server time, always. */
async function recordSubmitted(tx: Tx, app: App, attemptId: string | null, receipt: Receipt, actor: "user" | "system"): Promise<boolean> {
  const late = app.status === "failed";
  const charged = await chargeSubmission(tx, app.userId, app.id);
  await tx
    .update(applications)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      receipt,
      receiptSummary: receiptSummary(receipt.filledFields, app),
      stage: sql`coalesce(${applications.stage}, 'applied')`,
      failureCode: null,
      failureReason: null,
      leaseSessionId: null,
      leaseExpiresAt: null,
      currentAttemptId: attemptId ?? app.currentAttemptId,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, app.id));
  await recordEvent(tx, { userId: app.userId, applicationId: app.id, kind: "sent", actor, dedupeKey: "sent", payload: { channel: receipt.channel, attemptNo: app.attemptNo, charged, late } });
  count("submissions.charged", charged ? 1 : 0);
  if (late) count("submissions.late_confirmations", 1);
  return charged;
}

/** Failed: no ledger row (INV-5), the reservation frees itself with the status. Returns the resend notice's entity, when there is one. */
async function recordFailed(tx: Tx, app: App, code: FailureCode, actor: "user" | "system", reason = FAILURE_MESSAGES[code]): Promise<string | null> {
  await tx
    .update(applications)
    .set({ status: "failed", failureCode: code, failureReason: reason, leaseSessionId: null, leaseExpiresAt: null, updatedAt: new Date() })
    .where(eq(applications.id, app.id));
  await recordEvent(tx, { userId: app.userId, applicationId: app.id, kind: "failed", actor, dedupeKey: `failed:${app.attemptNo}`, payload: { channel: app.channel, attemptNo: app.attemptNo, code } });
  if (code === "posting_closed") await closeOnApplyPage(tx, app.jobId);
  if (!RESENDABLE.has(code) && !AMBIGUOUS.has(code)) return null;
  const entityId = `${app.id}:${app.attemptNo}`;
  await addNotification(tx, { userId: app.userId, kind: "resend_available", entityId, detail: { failureCode: code, ackRequired: AMBIGUOUS.has(code) } });
  return entityId;
}

/**
 * The apply page says the posting is gone (applications-81): the job closes and its open matches expire. In a savepoint,
 * because a NOT VALID check still fires on an update of an old row, and settling the send matters more than the catalog.
 */
async function closeOnApplyPage(tx: Tx, jobId: string): Promise<void> {
  await tx
    .transaction(async (sp) => {
      const closed = await sp.update(jobs).set({ closedAt: new Date(), closedBy: "apply_page" }).where(and(eq(jobs.id, jobId), isNull(jobs.closedAt))).returning({ id: jobs.id });
      if (closed.length) await sp.update(matches).set({ status: "expired" }).where(and(eq(matches.jobId, jobId), inArray(matches.status, ["new", "below_bar"])));
    })
    .catch((err: unknown) => logger.error({ err, jobId }, "posting_closed could not close the job"));
}

const notify = (entityId: string | null, userId: string) => {
  if (entityId) enqueueNotify("resend_available", entityId, userId).catch((err: unknown) => logger.warn({ err, entityId }, "resend notice not enqueued; notify-reconcile will"));
};

export interface SettleResult {
  result: "submitted" | "failed" | "noop";
  charged: boolean;
}

/**
 * Settles one attempt (08 3.2). Lock order: the user's advisory lock (the balance row after WP-32), the application, the
 * attempt. Reads the attempt row and never a job's result, so it can run any number of times.
 */
export async function settleAttempt(db: Db, attemptId: string): Promise<SettleResult> {
  const [seen] = await db.select({ userId: submissionAttempts.userId, settledAt: submissionAttempts.settledAt }).from(submissionAttempts).where(eq(submissionAttempts.id, attemptId));
  if (!seen || seen.settledAt) return { result: "noop", charged: false };

  const out = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${seen.userId}))`);
    const [unlocked] = await tx.select({ applicationId: submissionAttempts.applicationId }).from(submissionAttempts).where(eq(submissionAttempts.id, attemptId));
    if (!unlocked) return { result: "noop" as const, charged: false, entity: null };
    const [app] = await tx.select().from(applications).where(eq(applications.id, unlocked.applicationId)).for("update");
    const [attempt] = await tx.select().from(submissionAttempts).where(eq(submissionAttempts.id, attemptId)).for("update");
    // A live attempt is never settled here: the sweep closes it first, by the heartbeat.
    if (!app || !attempt || attempt.settledAt || attempt.state === "open") return { result: "noop" as const, charged: false, entity: null };

    const decision = decideSettlement(attempt);
    let result: SettleResult["result"] = decision.outcome;
    let charged = false;
    let entity: string | null = null;
    const isCurrent = app.currentAttemptId === attempt.id;
    if (decision.outcome === "submitted") {
      // Forward recovery: the employer has it. Late confirmation, or a resend not yet sent, which this stops.
      const movable = (app.status === "submitting" && isCurrent) || app.status === "approved" || (app.status === "failed" && app.failureCode !== null && AMBIGUOUS.has(app.failureCode));
      if (movable) charged = await recordSubmitted(tx, app, attempt.id, cloudReceipt(attempt.evidence, app.answers), "system");
      else if (app.status !== "submitted" || !isCurrent) {
        logger.error({ attemptId, applicationId: app.id, status: app.status }, "settled a submitted attempt the application has moved past");
        signal("submission_dual_detected");
      }
    } else if (app.status === "submitting" && isCurrent) {
      if (attempt.failureCode !== decision.code) logger.error({ attemptId, code: attempt.failureCode }, "settle_failed_after_submit_seen");
      // An earlier attempt of this application is known to have arrived, so this one's failure changes nothing for the employer:
      // forward recovery, one charge, and no free resend of something they already hold.
      const [sent] = await tx
        .select({ id: submissionAttempts.id, evidence: submissionAttempts.evidence, channel: submissionAttempts.channel })
        .from(submissionAttempts)
        .where(and(eq(submissionAttempts.applicationId, app.id), eq(submissionAttempts.state, "submitted")))
        .limit(1);
      if (sent) {
        charged = await recordSubmitted(tx, app, sent.id, { ...cloudReceipt(sent.evidence, app.answers), channel: sent.channel }, "system");
        result = "submitted";
      } else entity = await recordFailed(tx, app, decision.code, "system");
    } else {
      // An extension report already recorded it, or the previous release's sweep did. The application stays as it is.
      logger.warn({ attemptId, applicationId: app.id, status: app.status }, "settle_app_moved_on");
      result = "noop";
    }

    // S9: an ambiguous failure rests as needs_check (submission_attempts_settled_ck), so a late report can still move it.
    const settledState = attempt.state === "failed" && attempt.failureCode !== null && AMBIGUOUS.has(attempt.failureCode) ? "needs_check" : attempt.state;
    await tx.update(submissionAttempts).set({ state: settledState, settledAt: new Date() }).where(and(eq(submissionAttempts.id, attempt.id), isNull(submissionAttempts.settledAt)));
    if (app.approvedAt) slo("s5", Date.now() - app.approvedAt.getTime() <= 10 * 60_000);
    return { result, charged, entity };
  });
  notify(out.entity, seen.userId);
  return { result: out.result, charged: out.charged };
}

/** The row of this attempt number on the extension channel: one closed row per report, or one more duplicate on it. */
async function upsertExtensionRow(
  tx: Tx,
  app: App,
  ats: Attempt["ats"],
  sessionId: string,
  row: { state: "submitted" | "failed"; failureCode?: FailureCode; evidence: Record<string, unknown>; leaseConflict?: boolean },
): Promise<string> {
  const [saved] = await tx
    .insert(submissionAttempts)
    .values({
      applicationId: app.id,
      userId: app.userId,
      attemptNo: Math.max(app.attemptNo, 1),
      channel: "extension",
      ats,
      approvedBy: app.approvedBy,
      sessionId,
      phase: "reported",
      state: row.state,
      failureCode: row.failureCode ?? null,
      evidence: row.evidence,
      leaseConflict: row.leaseConflict ?? false,
      finishedAt: new Date(),
      settledAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [submissionAttempts.applicationId, submissionAttempts.attemptNo, submissionAttempts.channel],
      set: { duplicateReports: sql`${submissionAttempts.duplicateReports} + 1` },
    })
    .returning({ id: submissionAttempts.id });
  return saved!.id;
}

const notApproved = (status: string) => new HttpError(409, "conflict", `Application is ${status}, not approved`, { status });

/**
 * The report's acceptance table (05-api 13.4, 08 3.3). A real submission is always recorded, in any lease state; a `failed`
 * cannot settle a send someone else may be finishing (applications-v07, a live lease of another session). A 409 for a
 * `submitted` report after a terminal state commits its evidence first, so the throw happens after the transaction.
 */
async function reportTx(db: Db, userId: string, sessionId: string, report: SubmissionReport): Promise<{ status: string; entity: string | null; refuse?: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [row] = await tx
      .select({ a: applications, ats: companies.ats })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(and(eq(applications.id, report.applicationId), eq(applications.userId, userId)))
      .for("update", { of: applications });
    if (!row) throw notFound("Application");
    const { a: app, ats } = row;
    const [open] = await tx.select().from(submissionAttempts).where(and(eq(submissionAttempts.applicationId, app.id), eq(submissionAttempts.state, "open"))).for("update");
    const leaseConflict = app.leaseSessionId !== null && app.leaseSessionId !== sessionId && app.leaseExpiresAt !== null && app.leaseExpiresAt.getTime() > Date.now();
    const evidence = boundedEvidence(report.filledFields.map((f) => f.fieldKey), report.confirmationText);

    if (report.outcome === "submitted") {
      const receipt: Receipt = { filledFields: report.filledFields, confirmationText: redactConfirmation(report.confirmationText), channel: "extension", clientSubmittedAt: report.submittedAt };
      if (app.status === "approved" || app.status === "submitting") {
        let attemptId: string;
        if (open?.channel === "extension") {
          await tx.update(submissionAttempts).set({ state: "submitted", phase: "reported", evidence, leaseConflict, settledAt: new Date() }).where(eq(submissionAttempts.id, open.id));
          attemptId = open.id;
        } else {
          attemptId = await upsertExtensionRow(tx, app, ats, sessionId, { state: "submitted", evidence, leaseConflict });
        }
        await recordSubmitted(tx, app, attemptId, receipt, "user");
        if (leaseConflict) signal("submission_report_anomaly");
        return { status: "submitted", entity: null };
      }
      if (app.status === "submitted") {
        await upsertExtensionRow(tx, app, ats, sessionId, { state: "submitted", evidence });
        count("submissions.duplicate_reports", 1);
        signal("submission_report_anomaly");
        return { status: "submitted", entity: null };
      }
      if (app.status === "failed" && app.failureCode !== null && AMBIGUOUS.has(app.failureCode)) {
        // Late confirmation: the attempt the application points to moves forward, or a closed row records it.
        const [moved] = app.currentAttemptId
          ? await tx
              .update(submissionAttempts)
              .set({ state: "submitted", evidence, settledAt: new Date() })
              .where(and(eq(submissionAttempts.id, app.currentAttemptId), inArray(submissionAttempts.state, ["failed", "needs_check"]), inArray(submissionAttempts.failureCode, ["unconfirmed", "timeout", "no_report"])))
              .returning({ id: submissionAttempts.id })
          : [];
        const attemptId = moved?.id ?? (await upsertExtensionRow(tx, app, ats, sessionId, { state: "submitted", evidence }));
        await recordSubmitted(tx, app, attemptId, receipt, "user");
        return { status: "submitted", entity: null };
      }
      // The employer has it and the row says otherwise. Recorded for an operator (R-SUB-5); no charge and no status change.
      await upsertExtensionRow(tx, app, ats, sessionId, { state: "submitted", evidence, leaseConflict });
      logger.error({ applicationId: app.id, status: app.status }, "report_after_terminal");
      signal("submission_report_anomaly");
      return { status: app.status, entity: null, refuse: app.status };
    }

    if (app.status === "submitted") return { status: "submitted", entity: null };
    if (app.status !== "approved" && app.status !== "submitting") return { status: app.status, entity: null, refuse: app.status };
    // Only the applier settles a cloud send in progress (applications-v07); a live lease's holder may be submitting.
    if ((app.channel === "cloud" && app.status === "submitting") || leaseConflict) return { status: app.status, entity: null, refuse: app.status };
    const reason = report.failureReason?.trim().slice(0, 500) || FAILURE_MESSAGES.extension_reported;
    if (open?.channel === "extension") {
      await tx.update(submissionAttempts).set({ state: "failed", failureCode: "extension_reported", phase: "reported", evidence, settledAt: new Date() }).where(eq(submissionAttempts.id, open.id));
    } else {
      await upsertExtensionRow(tx, app, ats, sessionId, { state: "failed", failureCode: "extension_reported", evidence });
    }
    return { status: "failed", entity: await recordFailed(tx, app, "extension_reported", "user", reason) };
  });
}

const isContention = (err: unknown) => [err, (err as { cause?: unknown } | null)?.cause].some((e) => ["40P01", "55P03"].includes((e as { code?: string } | null)?.code ?? ""));

/** POST /api/extension/report. The frozen extension never retries a report, so one lock timeout or deadlock is retried here (08 3.3 step 5). */
export async function recordExtensionReport(db: Db, userId: string, sessionId: string, report: SubmissionReport): Promise<{ status: string }> {
  const out = await reportTx(db, userId, sessionId, report).catch(async (err: unknown) => {
    if (!isContention(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return reportTx(db, userId, sessionId, report).catch((again: unknown) => {
      throw isContention(again) ? new HttpError(503, "service_unavailable", "Try again shortly") : again;
    });
  });
  if (out.refuse) throw notApproved(out.refuse);
  notify(out.entity, userId);
  return { status: out.status };
}

/**
 * The stale-attempt half of the sweep (08 3.4 A, B): open attempts past their heartbeat or the 8-minute bound close by
 * phase, and explicit extension claims past their lease close as no_report. Each statement is conditional, so a live
 * attempt renewed in between is left alone and two workers close each row once. Only attempt rows are locked here.
 */
export async function closeStaleAttempts(db: Db): Promise<number> {
  const stale = await db
    .select({ id: submissionAttempts.id, channel: submissionAttempts.channel, phase: submissionAttempts.phase })
    .from(submissionAttempts)
    .where(and(eq(submissionAttempts.state, "open"), eq(submissionAttempts.channel, "cloud"), sql`(${submissionAttempts.heartbeatAt} < now() - interval '90 seconds' OR ${submissionAttempts.startedAt} < now() - interval '8 minutes')`))
    .limit(200);
  let closed = 0;
  for (const a of stale) {
    const { state, code } = closeByPhase(a);
    const rows = await db
      .update(submissionAttempts)
      .set({ state, failureCode: code })
      // The phase too: a run that moved on since the read above may have clicked, so this close must not apply the old phase's reading.
      .where(and(eq(submissionAttempts.id, a.id), eq(submissionAttempts.state, "open"), eq(submissionAttempts.phase, a.phase), sql`(${submissionAttempts.heartbeatAt} < now() - interval '90 seconds' OR ${submissionAttempts.startedAt} < now() - interval '8 minutes')`))
      .returning({ id: submissionAttempts.id });
    closed += rows.length;
  }
  const claims = await db
    .update(submissionAttempts)
    .set({ state: "needs_check", failureCode: "no_report" })
    .where(
      and(
        eq(submissionAttempts.state, "open"),
        eq(submissionAttempts.channel, "extension"),
        sql`${submissionAttempts.id} IN (SELECT current_attempt_id FROM applications WHERE status = 'submitting' AND channel = 'extension' AND lease_expires_at < now() LIMIT 200)`,
      ),
    )
    .returning({ id: submissionAttempts.id });
  return closed + claims.length;
}

/** Closed attempts still waiting for settlement, oldest first: applier results, and what the sweep just closed. */
export async function unsettledAttempts(db: Db): Promise<string[]> {
  const rows = await db
    .select({ id: submissionAttempts.id })
    .from(submissionAttempts)
    .where(and(sql`${submissionAttempts.state} <> 'open'`, isNull(submissionAttempts.settledAt)))
    .orderBy(asc(submissionAttempts.finishedAt))
    .limit(500);
  return rows.map((r) => r.id);
}

/**
 * Deploy-window repairs. A cloud claim of the previous release has no attempt row, so it settles the way it always did: past
 * 8 minutes it is failed and unconfirmed, never resent. And that release writes failures with no code, which the resend
 * rules and the late-confirmation guard need. ponytail: both are empty once the previous release is gone; WP-46 removes them.
 */
export async function repairLegacyRows(db: Db): Promise<string[]> {
  const swept = await db
    .update(applications)
    .set({ status: "failed", failureCode: "unconfirmed", failureReason: FAILURE_MESSAGES.unconfirmed, updatedAt: new Date() })
    .where(and(eq(applications.status, "submitting"), eq(applications.channel, "cloud"), isNull(applications.currentAttemptId), sql`${applications.updatedAt} < now() - interval '8 minutes'`))
    .returning({ id: applications.id });
  await db
    .update(applications)
    .set({
      failureCode: sql<ApplicationFailureCode>`CASE
        WHEN ${applications.failureReason} = ${FAILURE_MESSAGES.challenge} THEN 'challenge'
        WHEN ${applications.failureReason} = ${FAILURE_MESSAGES.posting_closed} THEN 'posting_closed'
        WHEN ${applications.failureReason} = ${FAILURE_MESSAGES.required_missing} THEN 'required_missing'
        WHEN ${applications.failureReason} = ${FAILURE_MESSAGES.applier_error} THEN 'applier_error'
        WHEN ${applications.failureReason} = ${FAILURE_MESSAGES.plan_lapsed} THEN 'plan_lapsed'
        WHEN ${applications.channel} = 'extension' THEN 'extension_reported'
        ELSE 'unconfirmed' END`,
    })
    .where(and(eq(applications.status, "failed"), isNull(applications.failureCode)));
  return swept.map((s) => s.id);
}

/**
 * Extension approvals unsent for 14 days go back to draft (applications-43, 08 3.5): the reservation frees itself, the
 * approval fields and the snapshot go (applications_snapshot_ck), attempt_no stays so the next approval takes the next
 * number. A lease in the last 24 hours means a side panel may still hold the item. Returns the rows to email. No event:
 * application_events has no kind for this yet (08 section 13, item 1). Advisory locks in user order keep the lock order.
 */
export async function returnStaleApprovals(db: Db): Promise<{ id: string; userId: string; attemptNo: number }[]> {
  return db.transaction(async (tx) => {
    const eligible = sql`${applications.status} = 'approved' AND ${applications.channel} = 'extension' AND ${applications.approvedAt} < now() - interval '14 days'
      AND (${applications.leaseExpiresAt} IS NULL OR ${applications.leaseExpiresAt} < now() - interval '24 hours')`;
    const rows = await tx.select({ id: applications.id, userId: applications.userId }).from(applications).where(eligible).orderBy(asc(applications.approvedAt)).limit(500);
    for (const userId of [...new Set(rows.map((r) => r.userId))].sort()) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    if (!rows.length) return [];
    return tx
      .update(applications)
      .set({ status: "draft", channel: null, approvedBy: null, approvedAt: null, leaseSessionId: null, leaseExpiresAt: null, resumeSnapshot: null, resumeFileKey: null, updatedAt: new Date() })
      .where(and(inArray(applications.id, rows.map((r) => r.id)), eligible))
      .returning({ id: applications.id, userId: applications.userId, attemptNo: applications.attemptNo });
  });
}

/** Returned drafts whose email never reached the ledger: a draft with an attempt number has been returned. Hourly, one Redis add each. */
export async function lostReturnNotices(db: Db): Promise<{ id: string; userId: string; attemptNo: number }[]> {
  return db
    .select({ id: applications.id, userId: applications.userId, attemptNo: applications.attemptNo })
    .from(applications)
    .where(
      and(
        eq(applications.status, "draft"),
        sql`${applications.attemptNo} > 0 AND ${applications.updatedAt} BETWEEN now() - interval '2 days' AND now() - interval '10 minutes'`,
        sql`NOT EXISTS (SELECT 1 FROM email_sends e WHERE e.kind = 'return_to_draft' AND e.entity_id = ${applications.id}::text || ':' || ${applications.attemptNo})`,
      ),
    )
    .limit(200);
}

/**
 * Drafts not approved within 30 days become expired with their content cleared (applications-44, 08 3.6). updated_at stays,
 * so an expired draft keeps its place in the list. ponytail: no applications_draft_age_idx, so each batch scans; add it
 * (partial, status = 'draft') when applications passes a few hundred thousand rows. Returns the rows expired.
 */
export async function expireDrafts(db: Db): Promise<number> {
  let total = 0;
  for (let i = 0; i < 25; i++) {
    const { rowCount } = await db.execute(sql`
      UPDATE applications
         SET draft_state = 'expired', resume_lines = '[]', answers = '[]', cover_letter = NULL, resume_file_key = NULL, resume_snapshot = NULL,
             resume_line_entries = NULL, questions = NULL, verification = NULL, facts_snapshot_hash = NULL
       WHERE id IN (SELECT id FROM applications
                     WHERE status = 'draft' AND draft_state <> 'expired' AND updated_at < now() - interval '30 days'
                     ORDER BY updated_at LIMIT 2000 FOR UPDATE SKIP LOCKED)`);
    total += rowCount ?? 0;
    if ((rowCount ?? 0) < 2000) break;
  }
  return total;
}
