import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { creditLedger } from "../db/schema";
import { logger } from "../lib/logger";
import { signal } from "../lib/sentry";

/**
 * Every 15 minutes: credit_ledger admin_adjustment rows created in the last 16 (CISO mustFix 10). No code path writes
 * one, so a new row is a manual write or an intruder's, and Sentry hears of it. The extra minute overlaps the runs, so
 * a row can be reported twice; only a transaction held open over a minute before commit can slip between two runs.
 * ponytail: scans credit_ledger, fine at beta size; index (reason, created_at) or move to the WP-27 alert evaluator
 * when the ledger nears a million rows.
 */
export async function processLedgerWatch(): Promise<{ rows: number }> {
  const [found] = await db()
    .select({ rows: count() })
    .from(creditLedger)
    .where(and(eq(creditLedger.reason, "admin_adjustment"), gt(creditLedger.createdAt, sql`now() - interval '16 minutes'`)));
  const rows = found?.rows ?? 0;
  if (rows > 0) {
    logger.warn({ rows }, "credit_ledger admin_adjustment rows written");
    signal("admin_adjustment_row", rows);
  }
  return { rows };
}
