import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { applications, creditLedger } from "../db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Credits a user can still commit: balance minus applications already approved but not yet sent. */
export function availableCredits(balance: number, inFlight: number): number {
  return Math.max(0, balance - inFlight);
}

export async function getBalance(db: Db | Tx, userId: string): Promise<number> {
  const [row] = await db
    .select({ balance: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return row?.balance ?? 0;
}

export async function countInFlight(db: Db | Tx, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(applications)
    .where(and(eq(applications.userId, userId), inArray(applications.status, ["approved", "submitting"])));
  return row?.n ?? 0;
}

/**
 * Charges one credit for a successful submission. Idempotent: the partial unique index on
 * (application_id, reason) turns a duplicate report into a no-op. Failed submissions are never charged.
 */
export async function chargeSubmission(tx: Tx, userId: string, applicationId: string): Promise<boolean> {
  const inserted = await tx
    .insert(creditLedger)
    .values({ userId, delta: -1, reason: "submission", applicationId })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  return inserted.length === 1;
}

/** Returns a credit when a submission we charged for turns out to have failed (e.g. the employer bounced it). */
export async function refundSubmission(tx: Tx, userId: string, applicationId: string, note: string): Promise<boolean> {
  const inserted = await tx
    .insert(creditLedger)
    .values({ userId, delta: 1, reason: "refund_failed_submit", applicationId, note })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  return inserted.length === 1;
}
