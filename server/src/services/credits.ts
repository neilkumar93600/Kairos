import { eq, sql } from "drizzle-orm";
import { getPlan } from "@auto-career/shared";
import type { Db } from "../db/client";
import { creditBalances, creditLedger } from "../db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Credits a user can still commit: balance minus applications already approved but not yet sent. */
export function availableCredits(balance: number, inFlight: number): number {
  return Math.max(0, balance - inFlight);
}

/**
 * The expiry of a rollover (billing-37, FR-47): what lies above twice the grant, never the credits approved applications
 * hold. Worked example of _db/billing.md 4.2: balance after the grant 3,500, in flight 20, grant 1,000 expires 1,480.
 */
export function rolloverExpiry(balanceAfterGrant: number, inFlight: number, grant: number): number {
  return Math.max(0, balanceAfterGrant - inFlight - 2 * grant);
}

/**
 * Rule L1, the first lock of every transaction that moves money or crosses an application in or out of approved and
 * submitting: the user's balance row, before any application row, because the in-flight trigger updates this row after the
 * guarded status change, and a path taking them the other way round deadlocks against this one.
 *
 * The one order, from first to last: the Stripe customer's advisory lock (billing events only), credit_balances,
 * subscriptions, applications by id, submission_attempts, everything else. Paths that stay inside the in-flight set hold no
 * balance lock and need none, since the trigger leaves the balance alone: claimForExtension, releaseForExtension and
 * claim_cloud_attempt take applications and then attempts, so nothing they hold can wait on a balance holder that waits on
 * them. test/lock-order.int.test.ts is the proof (T-DB-2); reviews/WP-32.md has the table.
 */
export async function lockCreditBalance(tx: Tx, userId: string): Promise<{ balance: number; inFlight: number }> {
  await tx.execute(sql`select ensure_credit_balance(${userId})`);
  const [row] = await tx.select({ balance: creditBalances.balance, inFlight: creditBalances.inFlight }).from(creditBalances).where(eq(creditBalances.userId, userId)).for("update");
  // No row: the account was erased while this waited. Its applications are gone too, so what follows finds nothing.
  return row ?? { balance: 0, inFlight: 0 };
}

/** Balance, in-flight and available from one cache row (billing-38): O(1) whatever the ledger's length. No row means none of either. */
export async function readCredits(db: Db | Tx, userId: string): Promise<{ balance: number; inFlight: number; available: number }> {
  const [row] = await db.select({ balance: creditBalances.balance, inFlight: creditBalances.inFlight }).from(creditBalances).where(eq(creditBalances.userId, userId));
  const [balance, inFlight] = [row?.balance ?? 0, row?.inFlight ?? 0];
  return { balance, inFlight, available: availableCredits(balance, inFlight) };
}

/**
 * Charges one credit for a successful submission. Idempotent: the partial unique index on
 * (application_id, reason) turns a duplicate report into a no-op. Failed submissions are never charged. The caller holds
 * lockCreditBalance.
 */
export async function chargeSubmission(tx: Tx, userId: string, applicationId: string): Promise<boolean> {
  const inserted = await tx
    .insert(creditLedger)
    .values({ userId, delta: -1, reason: "submission", applicationId })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  return inserted.length === 1;
}

/**
 * The one free grant (billing-46), its size from plans.ts. Exactly once per user: credit_ledger_one_free_grant_uq
 * turns a second insert (a retried hook, the bootstrap reconciler, a racing worker) into a no-op.
 */
export async function grantFreeCredits(tx: Tx, userId: string): Promise<boolean> {
  const inserted = await tx
    .insert(creditLedger)
    .values({ userId, delta: getPlan("free").applicationsPerCycle, reason: "free_grant" })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  return inserted.length === 1;
}

/**
 * A paid invoice's credits and its rollover, under the balance lock (_db/billing.md 4.2). credit_ledger_invoice_reason_uq
 * allows one plan_grant and one expiry per invoice, and the expiry runs only when the grant row was really inserted, so a
 * redelivered invoice, or the reconcile finding one an event already granted, writes nothing. Grants of different sizes
 * delivered out of order can leave a different expiry than in order: the cap applies to the balance at that moment.
 */
export async function applyInvoiceGrant(tx: Tx, grant: { userId: string; delta: number; stripeInvoiceId: string; note: string }): Promise<"applied" | "duplicate"> {
  await lockCreditBalance(tx, grant.userId);
  const inserted = await tx
    .insert(creditLedger)
    .values({ ...grant, reason: "plan_grant" })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  if (inserted.length === 0) return "duplicate";
  // Read after the insert: credit_ledger_ai has added the grant in this transaction.
  const { balance, inFlight } = await readCredits(tx, grant.userId);
  const expiry = rolloverExpiry(balance, inFlight, grant.delta);
  if (expiry > 0) {
    await tx
      .insert(creditLedger)
      .values({ userId: grant.userId, delta: -expiry, reason: "expiry", stripeInvoiceId: grant.stripeInvoiceId, note: `rollover cap 2x grant=${grant.delta}` })
      .onConflictDoNothing();
  }
  return "applied";
}

/** An operator's correction (billing-43): a new row, never an edit. scripts/ops-billing.ts writes its ops_audit row in the same transaction. */
export async function adjustCredits(tx: Tx, adjustment: { userId: string; delta: number; note: string }): Promise<void> {
  await lockCreditBalance(tx, adjustment.userId);
  await tx.insert(creditLedger).values({ ...adjustment, reason: "admin_adjustment" });
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
