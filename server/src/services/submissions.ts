import { and, eq, inArray, sql } from "drizzle-orm";
import { getPlan, type PlanId, type SubmissionReport, type SubmitChannel } from "@auto-career/shared";
import type { Db } from "../db/client";
import { applications, jobs, subscriptions } from "../db/schema";
import { baseEnv, type BaseEnv } from "../lib/env";
import { conflict, forbidden, HttpError, notFound, paymentRequired } from "../lib/errors";
import { getFlags } from "../lib/flags";
import { effectivePlan } from "./billing-events";
import { availableCreditsNow, chargeSubmission } from "./credits";
import { redactConfirmation } from "./sensitive";

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
 * The only failure reasons the cloud applier stores (spec 08 FAILURE_MESSAGES, shown by the web as they are). Never an
 * exception message or the page's own text: both can carry URLs, stack traces or whatever a hostile page chose.
 * `unconfirmed` is the needs_check outcome: the submit may have reached the employer, so it is never resent
 * automatically (WP-29 adds resend with the user's acknowledgement). No failure costs a credit.
 */
export const FAILURE_MESSAGES = {
  challenge: "The employer's site asked for a human check, so the cloud applier stopped. Nothing was sent and no credit was used. You can send it from the extension.",
  posting_closed: "This posting has closed. Nothing was sent and no credit was used.",
  required_missing: "A required question had no answer, so nothing was sent and no credit was used. Fill it in, then resend.",
  applier_error: "The cloud applier stopped before the submit step. Nothing was sent and no credit was used. You can resend it.",
  plan_lapsed: "Your plan no longer includes the cloud applier. Nothing was sent and no credit was used. You can send it from the extension.",
  unconfirmed: "We could not confirm whether the employer received this application. No credit was used. Check your email for the employer's confirmation before you resend.",
} as const;
export type FailureCode = keyof typeof FAILURE_MESSAGES;

/**
 * Moves ready drafts to approved; the cloud channel only for users cloudAllowed lets through. A draft is ready
 * when tailoring has written resume lines AND answers (the profile fields), so an empty or nameless application
 * can never reach an employer. Credits are checked against the drafts that actually moved; a shortfall throws,
 * which rolls the whole approval back.
 */
export async function approveApplications(db: Db, userId: string, ids: string[], channel: SubmitChannel): Promise<string[]> {
  const flags = await getFlags(db);
  // A money invariant broke (jobs/invariants.ts) or the owner froze approvals: nothing new is approved until it is lifted.
  // An api replica that cannot read ops_flags cannot know a freeze is on: it refuses rather than charge blind.
  if (flags.approvalsFrozen || !flags.loaded) throw new HttpError(503, "approvals_frozen", "Approvals are paused while we check an issue. Your drafts are safe; try again soon.");
  if (channel === "cloud") {
    if (flags.pauseCloudApply) throw new HttpError(503, "cloud_paused", "The cloud applier is paused. Send from the extension, or try again later.");
    if (!(await cloudAllowed(db, userId))) throw forbidden(flags.cloudApplierOpen ? "The cloud applier is on Pro and Max" : "The cloud applier is not open yet");
    if (flags.extensionOnly.size > 0) {
      const rows = await db.select({ url: jobs.applyUrl }).from(applications).innerJoin(jobs, eq(jobs.id, applications.jobId)).where(and(eq(applications.userId, userId), inArray(applications.id, ids)));
      if (rows.some((r) => flags.extensionOnly.has(atsOf(r.url)))) throw new HttpError(409, "extension_only", "This employer's cloud sending is off for now. Send it from the extension.");
    }
  }

  return db.transaction(async (tx) => {
    // One approval at a time per user: two tabs reading the same balance would otherwise both commit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const available = await availableCreditsNow(tx, userId);

    const updated = await tx
      .update(applications)
      .set({ status: "approved", channel, approvedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(applications.userId, userId),
          inArray(applications.id, ids),
          eq(applications.status, "draft"),
          sql`jsonb_array_length(${applications.resumeLines}) > 0`,
          sql`jsonb_array_length(${applications.answers}) > 0`,
        ),
      )
      .returning({ id: applications.id });
    if (updated.length > available) {
      throw paymentRequired(`You have ${available} credits left for ${updated.length} applications`, { available, requested: updated.length });
    }
    return updated.map((u) => u.id);
  });
}

/**
 * The cloud applier's claim: approved -> submitting in one conditional update, so a withdraw that lands after the
 * job was queued wins and the form is never opened. Returns false when there is nothing to send.
 */
export async function claimForCloud(db: Db, applicationId: string): Promise<boolean> {
  const claimed = await db
    .update(applications)
    .set({ status: "submitting", updatedAt: new Date() })
    .where(and(eq(applications.id, applicationId), eq(applications.status, "approved"), eq(applications.channel, "cloud")))
    .returning({ id: applications.id });
  return claimed.length > 0;
}

/**
 * The stuck-submitting sweep (ops-18 interim, until WP-29's leases): a cloud claim older than 10 minutes belongs to an
 * applier that died mid-run (a run is bounded at about 4 minutes, its drain at 3). It settles the way the applier
 * settles a click it cannot confirm: failed with the `unconfirmed` sentence, never resent. No ledger row is written:
 * nothing was charged, and in-flight counts only approved and submitting, so the reserved credit is free again. One
 * conditional update, so two workers settle each row once; a late report from a live applier then gets 409.
 */
export async function sweepStuckSubmitting(db: Db): Promise<string[]> {
  const swept = await db
    .update(applications)
    .set({ status: "failed", failureReason: FAILURE_MESSAGES.unconfirmed, updatedAt: new Date() })
    .where(and(eq(applications.status, "submitting"), eq(applications.channel, "cloud"), sql`${applications.updatedAt} < now() - interval '10 minutes'`))
    .returning({ id: applications.id });
  return swept.map((s) => s.id);
}

/**
 * Records what the extension or cloud applier saw. Only a successful submission costs a credit. submitted_at is
 * server time: the report's own clock is the browser's, or in the cloud the employer page's (applications-v01).
 */
export async function recordSubmission(db: Db, userId: string, report: SubmissionReport, channel: SubmitChannel) {
  return db.transaction(async (tx) => {
    const [app] = await tx
      .select()
      .from(applications)
      .where(and(eq(applications.id, report.applicationId), eq(applications.userId, userId)))
      .for("update");
    if (!app) throw notFound("Application");
    if (app.status === "submitted") return app; // duplicate report: already recorded and charged
    if (!["approved", "submitting"].includes(app.status)) throw conflict(`Application is ${app.status}, not approved`);
    // Only the applier settles a cloud send in progress: a stale extension tab's 'failed' would release the credit
    // while the form may still go out, and the applier's 'submitted' would then hit 409 (applications-v07).
    if (channel === "extension" && report.outcome === "failed" && app.channel === "cloud" && app.status === "submitting") {
      throw conflict("Application is being sent by the cloud applier");
    }

    if (report.outcome === "submitted") {
      await chargeSubmission(tx, userId, app.id);
      const [updated] = await tx
        .update(applications)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          // The employer's page wrote the confirmation: no addresses or phone numbers in it, 4 KB at most (WP-25).
          receipt: { filledFields: report.filledFields, confirmationText: redactConfirmation(report.confirmationText), channel },
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(eq(applications.id, app.id))
        .returning();
      return updated;
    }

    const [updated] = await tx
      .update(applications)
      .set({ status: "failed", failureReason: report.failureReason ?? "Unknown failure", updatedAt: new Date() })
      .where(eq(applications.id, app.id))
      .returning();
    return updated;
  });
}
