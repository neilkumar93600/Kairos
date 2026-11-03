import { sql } from "drizzle-orm";
import { db } from "../db/client";

/**
 * The cost-rollup schedule (03-agent-runtime.md 8.4): every minute, recompute yesterday's and today's llm_cost_daily
 * from llm_calls. The per-agent, global and shed budget scopes and the tier-up share cap read it; without it they see
 * only this process's own spend. Idempotent (no watermark), so a missed or doubled run changes nothing.
 * ponytail: metrics_minute and the threshold alerts of 8.4 land with WP-27's ops plumbing.
 */
export async function processCostRollup(): Promise<{ rows: number }> {
  const now = Date.now();
  let rows = 0;
  for (const day of [new Date(now - 86_400_000), new Date(now)].map((d) => d.toISOString().slice(0, 10))) {
    const result = (await db().execute(sql`select llm_cost_rollup_day(${day}::date) as n`)) as unknown as { n: number }[];
    rows += Number(result[0]?.n ?? 0);
  }
  return { rows };
}
