import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getPlan, type PlanId, type SubmitChannel } from "@auto-career/shared";
import type { Db } from "../db/client";
import { applications, companies, facts, jobs, profiles, resumes, submissionAttempts, subscriptions, type ApplicationFailureCode } from "../db/schema";
import { baseEnv, type BaseEnv } from "../lib/env";
import { cloudApplyKey, emitOutbox } from "../durable/outbox";
import { forbidden, HttpError, notFound, paymentRequired } from "../lib/errors";
import { getFlags } from "../lib/flags";
import { effectivePlan } from "./billing-events";
import { availableCreditsNow } from "./credits";
import { recordEvent } from "./events";
import { redactConfirmation } from "./sensitive";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The user's effective plan: past_due keeps the paid plan for 7 days, then counts as Free. */
export async function planFor(db: Db, userId: string): Promise<PlanId> {
  const [row] = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status, pastDueSince: subscriptions.pastDueSince })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  return row ? effectivePlan(row) : "free";
}

/** The ATS of an apply URL, for the extension_only flags; mirrors APPLY_HOSTS in jobs/cloud-apply.ts (not imported: it loads Playwright). */
function atsOf(url: string): string {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)greenhouse\.io$/.test(host) ? "greenhouse" : /(^|\.)lever\.co$/.test(host) ? "lever" : /(^|\.)ashbyhq\.com$/.test(host) ? "ashby" : "";
  } catch {
    return "";
  }
}

/**
 * Who may use the cloud channel: the owners on any plan (they test it), everyone else only once CLOUD_APPLIER_OPEN
 * is set and their plan has cloudApplier (CISO mustFix 1: closed until WP-04 passes on staging and S-AP4 is settled).
 */
export function cloudOpenTo(userId: string, plan: PlanId, e: Pick<BaseEnv, "OWNER_USER_IDS" | "CLOUD_APPLIER_OPEN">): boolean {
  return e.OWNER_USER_IDS.includes(userId) || (e.CLOUD_APPLIER_OPEN && getPlan(plan).cloudApplier);
}

export async function cloudAllowed(db: Db, userId: string): Promise<boolean> {
  return cloudOpenTo(userId, await planFor(db, userId), { OWNER_USER_IDS: baseEnv().OWNER_USER_IDS, CLOUD_APPLIER_OPEN: (await getFlags(db)).cloudApplierOpen });
}

/**
 * The failure-code catalog (applications-78, _db/applications.md 4.8), in plain words: applications.failure_reason, shown
 * by the web as it is. Never an exception message or the page's own text: both can carry URLs, stack traces or whatever
 * a hostile page chose. No failure costs a credit.
 */
export const FAILURE_MESSAGES: Record<ApplicationFailureCode, string> = {
  challenge: "The employer's site asked for a human check, so the cloud applier stopped. Nothing was sent and no credit was used. You can send it from the extension.",
  posting_closed: "This posting has closed. Nothing was sent and no credit was used.",
  required_missing: "A required question had no answer, so nothing was sent and no credit was used. Fill it in, then resend.",
  applier_error: "The cloud applier stopped before the submit step. Nothing was sent and no credit was used. You can resend it.",
  plan_lapsed: "Your plan no longer includes the cloud applier. Nothing was sent and no credit was used. You can send it from the extension.",
  cloud_unavailable_for_ats: "Cloud sending is paused for this job board. Nothing was sent and no credit was used. You can send it from the extension.",
  unconfirmed: "We could not confirm whether the employer received this application. No credit was used. Check your email for the employer's confirmation before you resend.",
  timeout: "The employer's site did not confirm in time after the submit step. No credit was used. Check your email for the employer's confirmation before you resend.",
  no_report: "No report from the extension within 10 minutes. Check for the employer's confirmation email before you resend.",
  extension_reported: "The extension could not finish this application. No credit was used.",
  render_failed: "We could not prepare your resume file, so nothing was sent and no credit was used. You can resend it.",
};
export type FailureCode = ApplicationFailureCode;

/** The send may have reached the employer: never resent without the user's acknowledgement, and a later report can settle it forward. */
export const AMBIGUOUS: ReadonlySet<FailureCode> = new Set(["unconfirmed", "timeout", "no_report"]);
/** Nothing reached the employer: resent on request. posting_closed alone is in neither set (INV-23). */
export const RESENDABLE: ReadonlySet<FailureCode> = new Set(["challenge", "required_missing", "applier_error", "plan_lapsed", "cloud_unavailable_for_ats", "extension_reported", "render_failed"]);
/** The cloud applier cannot send these (a bot check, the plan, the board): a resend goes through the extension (INV-8). */
const EXTENSION_ONLY_RESEND: ReadonlySet<FailureCode> = new Set(["challenge", "plan_lapsed", "cloud_unavailable_for_ats"]);

/** Field keys and the redacted confirmation only, cut to fit submission_attempts_evidence_ck: never field values. */
export function boundedEvidence(fieldKeys: string[], confirmationText?: string): Record<string, unknown> {
  const keys: string[] = [];
  const evidence: Record<string, unknown> = { filledFieldKeys: keys };
  // jsonb refuses a NUL, and a page writes this text: a refused result would read as an unconfirmed send.
  const confirmation = redactConfirmation(confirmationText)?.replaceAll("\u0000", "");
  if (confirmation) evidence.confirmationText = Buffer.from(confirmation.slice(0, 2048)).subarray(0, 2800).toString();
  for (const key of fieldKeys.map((k) => k.replaceAll("\u0000", ""))) {
    if (Buffer.byteLength(JSON.stringify(evidence)) + Buffer.byteLength(key) + 3 > 3800) break;
    keys.push(key);
  }
  return evidence;
}

/**
 * The hash of the facts a draft cites (id, text, confirmed time), sorted so citation order does not matter. WP-41 stores
 * it as facts_snapshot_hash when it prepares a draft; approval compares it.
 */
export function factsSnapshotHash(cited: { id: string; text: string; confirmedAt: Date | null }[]): string {
  const canonical = cited.map((f) => [f.id, f.text, f.confirmedAt?.toISOString() ?? null]).sort((a, b) => (a[0]! < b[0]! ? -1 : 1));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

const citedFactIds = (lines: { factIds?: string[] }[]) => [...new Set(lines.flatMap((l) => l.factIds ?? []))];
/** facts.id is a uuid: a citation of any other shape is no fact, and would throw in the query. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Why a draft of the caller's was not approved (05-api 9.4), the reasons this release can give. The additive `skipped[]` of approve. */
export type SkipReason = "not_ready" | "facts_changed" | "company_cap" | "paused" | "posting_closed";

export interface ApproveResult {
  approved: { id: string; attemptNo: number }[];
  skipped: { id: string; reason: SkipReason }[];
}

/** The gates in front of the transaction: the kill switches, the cloud plan gate and the extension_only boards. */
async function approvalGates(db: Db, userId: string, ids: string[], channel: SubmitChannel): Promise<void> {
  const flags = await getFlags(db);
  // A money invariant broke (jobs/invariants.ts) or the owner froze approvals: nothing new is approved until it is lifted.
  // An api replica that cannot read ops_flags cannot know a freeze is on: it refuses rather than charge blind.
  if (flags.approvalsFrozen || !flags.loaded) throw new HttpError(503, "approvals_frozen", "Approvals are paused while we check an issue. Your drafts are safe; try again soon.");
  if (channel !== "cloud") return;
  if (flags.pauseCloudApply) throw new HttpError(503, "cloud_paused", "The cloud applier is paused. Send from the extension, or try again later.");
  if (!(await cloudAllowed(db, userId))) throw forbidden(flags.cloudApplierOpen ? "The cloud applier is on Pro and Max" : "The cloud applier is not open yet");
  if (flags.extensionOnly.size > 0) {
    const rows = await db.select({ url: jobs.applyUrl }).from(applications).innerJoin(jobs, eq(jobs.id, applications.jobId)).where(and(eq(applications.userId, userId), inArray(applications.id, ids)));
    if (rows.some((r) => flags.extensionOnly.has(atsOf(r.url)))) throw new HttpError(409, "extension_only", "This employer's cloud sending is off for now. Send it from the extension.");
  }
}

/** The tailored copy's document and design, frozen at approval (PRD 6.1, 7.6). A legacy draft has no copy: its lines are the document. */
async function snapshots(tx: Tx, rows: { id: string; resumeLines: unknown; coverLetter: string | null }[]): Promise<Map<string, object>> {
  const copies = await tx
    .select({ applicationId: resumes.applicationId, document: resumes.document, baseResumeId: resumes.baseResumeId, baseVersion: resumes.baseVersion })
    .from(resumes)
    .where(and(inArray(resumes.applicationId, rows.map((r) => r.id)), eq(resumes.kind, "tailored"), isNull(resumes.archivedAt)));
  const byApp = new Map(copies.map((c) => [c.applicationId!, c]));
  return new Map(
    rows.map((r) => {
      const c = byApp.get(r.id);
      return [r.id, { document: c?.document ?? null, baseResumeId: c?.baseResumeId ?? null, baseVersion: c?.baseVersion ?? null, resumeLines: r.resumeLines, coverLetter: r.coverLetter }];
    }),
  );
}

/**
 * The one approval (applications-35, arch B.6.4), for the approve route and resend; it runs in the caller's transaction.
 * Each candidate passes the checks in order or is skipped with the first reason. Ids that are not the caller's, or not
 * drafts, are skipped silently; a draft approved on the same channel in the last minute is answered as approved, so a
 * double click or a retry after a lost response returns the first result and changes nothing.
 * Not here yet, each with its package: verification_pending and required_answers_missing (WP-41's snapshots),
 * free_grant_used (WP-32), the Autopilot guards (WP-36).
 */
async function approveCore(tx: Tx, userId: string, ids: string[], channel: SubmitChannel, resend = false): Promise<ApproveResult> {
  // One approval at a time per user: two tabs reading the same balance would otherwise both commit. WP-32 moves this to the balance row.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
  const rows = await tx
    .select({ a: applications, companyId: jobs.companyId, closedAt: jobs.closedAt })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.userId, userId), inArray(applications.id, ids), inArray(applications.status, resend ? ["failed"] : ["draft", "approved"])))
    .orderBy(asc(applications.id))
    .for("update", { of: applications });

  const [profile] = await tx.select({ pausedAt: profiles.applicationsPausedAt, preferences: profiles.preferences }).from(profiles).where(eq(profiles.userId, userId));
  const cap = profile?.preferences?.maxApplicationsPerCompanyPer30Days;
  const sent =
    cap === undefined
      ? []
      : await tx
          .select({ companyId: jobs.companyId, n: sql<number>`count(*)::int` })
          .from(applications)
          .innerJoin(jobs, eq(jobs.id, applications.jobId))
          .where(
            and(
              eq(applications.userId, userId),
              inArray(applications.status, ["approved", "submitting", "submitted"]),
              sql`coalesce(${applications.approvedAt}, ${applications.createdAt}) > now() - interval '30 days'`,
            ),
          )
          .groupBy(jobs.companyId);
  const perCompany = new Map(sent.map((s) => [s.companyId, s.n]));

  const factIds = [...new Set(rows.flatMap((r) => citedFactIds(r.a.resumeLines)))].filter((id) => UUID.test(id));
  const factRows = factIds.length
    ? await tx.select({ id: facts.id, text: facts.text, confirmed: facts.confirmed, confirmedAt: facts.confirmedAt }).from(facts).where(and(eq(facts.userId, userId), inArray(facts.id, factIds)))
    : [];
  const factById = new Map(factRows.map((f) => [f.id, f]));

  const result: ApproveResult = { approved: [], skipped: [] };
  const moving: typeof rows = [];
  for (const row of rows) {
    const { a } = row;
    if (a.status === "approved") {
      if (a.channel === channel && a.approvedAt && Date.now() - a.approvedAt.getTime() < 60_000) result.approved.push({ id: a.id, attemptNo: a.attemptNo });
      continue;
    }
    const cited = citedFactIds(a.resumeLines).map((id) => factById.get(id));
    const skip = (reason: SkipReason) => result.skipped.push({ id: a.id, reason });
    // Readiness: the lines and answers proxy until WP-41 sets draft_state; the states it will set first refuse now.
    if (a.resumeLines.length === 0 || a.answers.length === 0 || ["failed", "needs_facts", "expired"].includes(a.draftState)) skip("not_ready");
    else if (cited.some((f) => !f?.confirmed)) skip("facts_changed");
    else if (a.factsSnapshotHash && a.factsSnapshotHash !== factsSnapshotHash(cited.map((f) => f!))) skip("facts_changed");
    else if (cap !== undefined && (perCompany.get(row.companyId) ?? 0) >= cap) skip("company_cap");
    else if (profile?.pausedAt) skip("paused");
    else if (row.closedAt) skip("posting_closed");
    else {
      perCompany.set(row.companyId, (perCompany.get(row.companyId) ?? 0) + 1);
      moving.push(row);
    }
  }

  // Only rows this call moves need a credit: a repeat's reservation is already counted as in flight.
  const available = await availableCreditsNow(tx, userId);
  if (moving.length > available) {
    throw paymentRequired(`You have ${available} credits left for ${moving.length} applications`, { available, requested: moving.length });
  }
  const frozen = moving.length ? await snapshots(tx, moving.map((r) => ({ id: r.a.id, resumeLines: r.a.resumeLines, coverLetter: r.a.coverLetter }))) : new Map<string, object>();
  for (const { a } of moving) {
    const attemptNo = a.attemptNo + 1;
    await tx
      .update(applications)
      .set({
        status: "approved",
        channel,
        approvedBy: "user",
        approvedAt: new Date(),
        attemptNo,
        currentAttemptId: null,
        failureCode: null,
        failureReason: null,
        // A resend sends what the user approved: the stored snapshot and its rendered file stand (arch B.6.4). Written only when absent.
        resumeSnapshot: a.resumeSnapshot ?? frozen.get(a.id),
        updatedAt: new Date(),
      })
      .where(eq(applications.id, a.id));
    await recordEvent(tx, { userId, applicationId: a.id, kind: "approved", actor: "user", dedupeKey: `approved:${attemptNo}`, payload: { channel, attemptNo } });
    if (resend) await recordEvent(tx, { userId, applicationId: a.id, kind: "resent", actor: "user", dedupeKey: `resent:${attemptNo}`, payload: { channel, attemptNo } });
    // In the same transaction (WP-22): an approval cannot commit without the intent to send it, whatever dies next.
    if (channel === "cloud") await emitOutbox(tx, "cloud-apply", { applicationId: a.id, attemptNo }, cloudApplyKey(a.id, attemptNo));
    result.approved.push({ id: a.id, attemptNo });
  }
  return result;
}

/** Moves ready drafts to approved (POST /api/applications/approve). A credit shortfall throws, which rolls the whole batch back. */
export async function approveWithSkips(db: Db, userId: string, ids: string[], channel: SubmitChannel): Promise<ApproveResult> {
  await approvalGates(db, userId, ids, channel);
  return db.transaction((tx) => approveCore(tx, userId, ids, channel));
}

export async function approveApplications(db: Db, userId: string, ids: string[], channel: SubmitChannel): Promise<string[]> {
  return (await approveWithSkips(db, userId, ids, channel)).approved.map((a) => a.id);
}

export interface ResendResult {
  applicationId: string;
  status: "approved";
  attemptNo: number;
}

/**
 * failed -> approved under a new attempt number (applications-41, 05-api 10.4), in the caller's transaction so a signed
 * link's use and the approval commit together. Throws the route's refusals. Never resends an ambiguous failure without the
 * user's acknowledgement, a closed posting at all, or a bot check through the cloud.
 */
export async function resendCore(tx: Tx, userId: string, id: string, channel: SubmitChannel, acknowledgeUnconfirmed: boolean): Promise<ResendResult> {
  const [app] = await tx
    .select({ status: applications.status, failureCode: applications.failureCode })
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!app) throw notFound("Application");
  if (app.status !== "failed") throw new HttpError(409, "conflict", `Application is ${app.status}, not failed`, { status: app.status });
  // A row the previous release failed has no code until the sweep's first pass: treated as the unknown it is.
  const code = app.failureCode ?? "unconfirmed";
  if (code === "posting_closed") throw new HttpError(409, "not_approvable", "This posting has closed.", { reason: "posting_closed" });
  if (AMBIGUOUS.has(code) && !acknowledgeUnconfirmed) {
    throw new HttpError(409, "acknowledgement_required", "Check your email for the employer's confirmation first: this application may already have reached them.", { failureCode: code });
  }
  if (channel === "cloud" && EXTENSION_ONLY_RESEND.has(code)) throw new HttpError(409, "not_approvable", "This one can only be resent from the extension.", { reason: "cloud_unavailable_for_ats" });
  const [open] = await tx.select({ id: submissionAttempts.id }).from(submissionAttempts).where(and(eq(submissionAttempts.applicationId, id), eq(submissionAttempts.state, "open")));
  if (open) throw new HttpError(409, "conflict", "A send of this application is still open. Try again in a few minutes.", { status: app.status });

  const { approved, skipped } = await approveCore(tx, userId, [id], channel, true);
  const done = approved[0];
  if (!done) throw new HttpError(409, "not_approvable", "This application cannot be resent right now.", { reason: skipped[0]?.reason ?? "not_ready" });
  return { applicationId: id, status: "approved", attemptNo: done.attemptNo };
}

export async function resendApplication(db: Db, userId: string, id: string, channel: SubmitChannel, acknowledgeUnconfirmed: boolean): Promise<ResendResult> {
  await approvalGates(db, userId, [id], channel);
  return db.transaction((tx) => resendCore(tx, userId, id, channel, acknowledgeUnconfirmed));
}

/**
 * Withdraw (applications-42, 05-api 10.5): a draft or a failure, or an approval with no live lease and no open attempt. One
 * conditional update, so a cloud job already queued finds nothing approved. An approval the extension holds answers 409;
 * everything else that does not move is the frozen 404.
 */
export async function withdrawApplication(db: Db, userId: string, id: string): Promise<void> {
  const held = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(applications)
      .set({ status: "withdrawn", leaseSessionId: null, leaseExpiresAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(applications.id, id),
          eq(applications.userId, userId),
          sql`(${applications.status} IN ('draft','failed')
            OR (${applications.status} = 'approved' AND (${applications.leaseExpiresAt} IS NULL OR ${applications.leaseExpiresAt} < now())
                AND NOT EXISTS (SELECT 1 FROM submission_attempts s WHERE s.application_id = ${applications.id} AND s.state = 'open')))`,
        ),
      )
      .returning({ id: applications.id });
    if (updated) {
      await recordEvent(tx, { userId, applicationId: id, kind: "withdrawn", actor: "user", dedupeKey: "withdrawn" });
      return { moved: true as const };
    }
    const [row] = await tx.select({ status: applications.status, leaseExpiresAt: applications.leaseExpiresAt }).from(applications).where(and(eq(applications.id, id), eq(applications.userId, userId)));
    return { moved: false as const, until: row?.status === "approved" && row.leaseExpiresAt && row.leaseExpiresAt.getTime() > Date.now() ? row.leaseExpiresAt : null };
  });
  if (held.moved) return;
  if (!held.until) throw notFound("Withdrawable application");
  const minutes = Math.max(1, Math.ceil((held.until.getTime() - Date.now()) / 60_000));
  throw new HttpError(409, "conflict", `The extension has this application open. Try again in ${minutes} minutes, or finish it in the extension.`, { status: "approved", leaseExpiresAt: held.until.toISOString() });
}

const LEASE = sql<Date>`now() + interval '10 minutes'`;

/**
 * The extension's claim (05-api 13.3): approved -> submitting with an open attempt and a 10-minute lease bound to the
 * session, in one transaction. The first claim wins, for a second tab of the same session too: the spec answers a repeat
 * from the holder 200, which would let two tabs of one extension both send. A client that lost the response can release and
 * claim again. Another live lease or claim is 409 already_claimed.
 */
export async function claimForExtension(db: Db, userId: string, sessionId: string, id: string): Promise<{ claimed: true; leaseExpiresAt: Date }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ a: applications, ats: companies.ats })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(and(eq(applications.id, id), eq(applications.userId, userId)))
      .for("update", { of: applications });
    if (!row) throw notFound("Application");
    const { a } = row;
    const heldByOther = a.status === "approved" && a.leaseSessionId !== sessionId && a.leaseExpiresAt && a.leaseExpiresAt.getTime() > Date.now();
    if (a.channel === "extension" && (a.status === "submitting" || heldByOther)) {
      throw new HttpError(409, "already_claimed", "This application is already being sent. Try again later.", { leaseExpiresAt: a.leaseExpiresAt?.toISOString() ?? null });
    }
    if (a.status !== "approved" || a.channel !== "extension") throw new HttpError(409, "conflict", `Application is ${a.status}, not approved`, { status: a.status });

    const attemptNo = Math.max(a.attemptNo, 1);
    const [attempt] = await tx
      .insert(submissionAttempts)
      .values({ applicationId: id, userId, attemptNo, channel: "extension", ats: row.ats, approvedBy: a.approvedBy, sessionId })
      .returning({ id: submissionAttempts.id });
    const [held] = await tx
      .update(applications)
      .set({ status: "submitting", attemptNo, currentAttemptId: attempt!.id, leaseSessionId: sessionId, leaseExpiresAt: LEASE, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning({ leaseExpiresAt: applications.leaseExpiresAt });
    return { claimed: true as const, leaseExpiresAt: held!.leaseExpiresAt! };
  });
}

/**
 * The claim's undo (05-api 13.3): this session's claim back to approved with its attempt closed as released, or this
 * session's visibility lease cleared. Anything else, a lease another session holds included, is a no-op answering false.
 * A released claim keeps its closed row, so the application moves to the next attempt number for the next claim or report.
 */
export async function releaseForExtension(db: Db, userId: string, sessionId: string, id: string): Promise<{ released: boolean }> {
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(applications).where(and(eq(applications.id, id), eq(applications.userId, userId))).for("update");
    if (!a) throw notFound("Application");
    if (a.leaseSessionId !== sessionId || !["approved", "submitting"].includes(a.status)) return { released: false };
    const claimed = a.status === "submitting" && a.currentAttemptId;
    if (claimed) {
      await tx
        .update(submissionAttempts)
        .set({ state: "failed", failureCode: "extension_reported", evidence: { detail: "released" }, settledAt: new Date() })
        .where(and(eq(submissionAttempts.id, a.currentAttemptId!), eq(submissionAttempts.state, "open")));
    }
    await tx
      .update(applications)
      .set({ status: "approved", attemptNo: claimed ? a.attemptNo + 1 : a.attemptNo, currentAttemptId: null, leaseSessionId: null, leaseExpiresAt: null, updatedAt: new Date() })
      .where(eq(applications.id, id));
    return { released: true };
  });
}

/**
 * The extension's queue (05-api 13.2): the caller's approved rows whose lease is free, expired or already this session's,
 * each taking or renewing the 10-minute visibility lease. The one GET that writes; a lease never changes a status, so
 * viewing the queue cannot strand an application.
 */
export async function leaseExtensionQueue(db: Db, userId: string, sessionId: string) {
  const { rows } = await db.execute<{ application_id: string; apply_url: string; title: string; answers: unknown; resume_lines: unknown; cover_letter: string | null; approved_at: string }>(sql`
    WITH picked AS (
      SELECT id FROM applications
       WHERE user_id = ${userId} AND status = 'approved' AND channel = 'extension'
         AND (lease_session_id IS NULL OR lease_expires_at < now() OR lease_session_id = ${sessionId})
       ORDER BY approved_at, id
       LIMIT 20
       FOR UPDATE SKIP LOCKED)
    UPDATE applications a
       SET lease_session_id = ${sessionId}, lease_expires_at = now() + interval '10 minutes'
      FROM picked, jobs j
     WHERE a.id = picked.id AND j.id = a.job_id
    RETURNING a.id AS application_id, j.apply_url, j.title, a.answers, a.resume_lines, a.cover_letter, a.approved_at::text AS approved_at`);
  return rows
    .sort((x, y) => (x.approved_at < y.approved_at ? -1 : 1))
    .map((r) => ({ applicationId: r.application_id, applyUrl: r.apply_url, title: r.title, answers: r.answers, resumeLines: r.resume_lines, coverLetter: r.cover_letter }));
}
