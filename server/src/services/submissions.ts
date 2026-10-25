import { and, eq, inArray, sql } from "drizzle-orm";
import { getPlan, type PlanId, type SubmissionReport, type SubmitChannel } from "@auto-career/shared";
import type { Db } from "../db/client";
import { applications, subscriptions } from "../db/schema";
import { conflict, forbidden, notFound, paymentRequired } from "../lib/errors";
import { PAID_STATUSES } from "./billing-events";
import { availableCreditsNow, chargeSubmission } from "./credits";

export async function planFor(db: Db, userId: string): Promise<PlanId> {
  const [row] = await db.select({ plan: subscriptions.plan, status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.userId, userId));
  if (!row || !PAID_STATUSES.includes(row.status)) return "free";
  return row.plan;
}

/**
 * Moves ready drafts to approved and blocks the cloud channel on plans without the cloud applier. A draft is ready
 * when tailoring has written resume lines AND answers (the profile fields), so an empty or nameless application
 * can never reach an employer. Credits are checked against the drafts that actually moved; a shortfall throws,
 * which rolls the whole approval back.
 */
export async function approveApplications(db: Db, userId: string, ids: string[], channel: SubmitChannel): Promise<string[]> {
  const plan = getPlan(await planFor(db, userId));
  if (channel === "cloud" && !plan.cloudApplier) throw forbidden("The cloud applier is on Pro and Max");

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
    if (updated.length > available) throw paymentRequired(`You have ${available} credits left for ${updated.length} applications`);
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

/** Records what the extension or cloud applier saw. Only a successful submission costs a credit. */
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

    if (report.outcome === "submitted") {
      await chargeSubmission(tx, userId, app.id);
      const [updated] = await tx
        .update(applications)
        .set({
          status: "submitted",
          submittedAt: new Date(report.submittedAt),
          receipt: { filledFields: report.filledFields, confirmationText: report.confirmationText, channel },
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
