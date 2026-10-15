import { and, eq, inArray } from "drizzle-orm";
import { getPlan, type PlanId, type SubmissionReport, type SubmitChannel } from "@auto-career/shared";
import type { Db } from "../db/client";
import { applications, subscriptions } from "../db/schema";
import { conflict, forbidden, notFound, paymentRequired } from "../lib/errors";
import { availableCredits, chargeSubmission, countInFlight, getBalance } from "./credits";

export async function planFor(db: Db, userId: string): Promise<PlanId> {
  const [row] = await db.select({ plan: subscriptions.plan, status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.userId, userId));
  if (!row || !["active", "trialing"].includes(row.status)) return "free";
  return row.plan;
}

/**
 * Moves drafts to approved. Checks credits up front so a user never approves more than they can send,
 * and blocks the cloud channel on plans without the cloud applier.
 */
export async function approveApplications(db: Db, userId: string, ids: string[], channel: SubmitChannel): Promise<string[]> {
  const plan = getPlan(await planFor(db, userId));
  if (channel === "cloud" && !plan.cloudApplier) throw forbidden("The cloud applier is on Pro and Max");

  return db.transaction(async (tx) => {
    const available = availableCredits(await getBalance(tx, userId), await countInFlight(tx, userId));
    if (available < ids.length) throw paymentRequired(`You have ${available} credits left for ${ids.length} applications`);

    const updated = await tx
      .update(applications)
      .set({ status: "approved", channel, approvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(applications.userId, userId), inArray(applications.id, ids), eq(applications.status, "draft")))
      .returning({ id: applications.id });
    return updated.map((u) => u.id);
  });
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
