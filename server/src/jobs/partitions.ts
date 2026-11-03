import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { logger } from "../lib/logger";
import { signal } from "../lib/sentry";

/** The current ISO week plus this many are kept as partitions (_db/platform.md 4.1). */
const WEEKS_AHEAD = 6;
/** llm_calls retention; the function refuses less than 90 (Q-7). */
const RETENTION_DAYS = 90;

/**
 * The daily `partitions` schedule (_db/platform.md 7, ops-50), at 03:00 UTC. Every step is idempotent and serialized
 * by the functions' advisory locks, so two workers or a retry change nothing twice.
 * 1. Count the rows in llm_calls_default, which must stay empty: a row there means a week had no partition. Counted
 *    first, so the signal fires even when step 2 then fails on that row (which it does, loudly, by design).
 * 2. llm_calls_ensure_partitions(6): the current week and six more.
 * 3. Roll up again the two weeks before the 90-day cutoff, so a day the minute roll-up missed (the worker down across
 *    a midnight) cannot keep its partition forever; an empty day changes nothing.
 * 4. llm_calls_drop_old_partitions(90): detach and drop the weeks past 90 days that are fully rolled up; a week whose
 *    lock is busy is left for tomorrow.
 * ponytail: step 1 reads llm_calls_default through the parent, which kairos_worker can SELECT (WP-12's grants), so it
 * scans every partition: seconds at 25 million rows, once a day. Grant SELECT on llm_calls_default and read it alone if
 * that gets slow.
 */
export async function processPartitions(): Promise<{ defaultRows: number; created: number; dropped: string[] }> {
  const [stray] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(sql`llm_calls`)
    .where(sql`tableoid = 'public.llm_calls_default'::regclass`);
  const defaultRows = Number(stray?.n ?? 0);
  if (defaultRows > 0) {
    logger.error({ defaultRows }, "llm_calls_default holds rows; move them into a weekly partition (runbook: Security signals)");
    signal("llm_calls_default_rows", defaultRows);
  }

  const [ensured] = await db().select({ n: sql<number>`n` }).from(sql`llm_calls_ensure_partitions(${WEEKS_AHEAD}::int) as n`);
  await db().execute(sql`
    select llm_cost_rollup_day(d::date)
      from generate_series((now() at time zone 'UTC')::date - ${RETENTION_DAYS + 14}::int,
                           (now() at time zone 'UTC')::date - ${RETENTION_DAYS + 1}::int, interval '1 day') as d`);
  const [old] = await db().select({ names: sql<string[]>`names` }).from(sql`llm_calls_drop_old_partitions(${RETENTION_DAYS}::int) as names`);

  const result = { defaultRows, created: Number(ensured?.n ?? 0), dropped: old?.names ?? [] };
  if (result.created || result.dropped.length) logger.info(result, "llm_calls partitions maintained");
  return result;
}
