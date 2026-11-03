import { and, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { metricsMinute } from "../db/schema";

/** The SLOs of the README Reliability section, by the id lib/metrics.ts counts them under. */
export const SLOS = {
  s1: { target: 0.995, what: "API requests that are not a 5xx" },
  s1c: { target: 0.999, what: "approve, submission report, Stripe and inbound webhooks that are not a 5xx" },
  lat_read: { target: 0.95, what: "reads under 300 ms" },
  lat_write: { target: 0.95, what: "writes under 500 ms" },
  lat_auth: { target: 0.95, what: "auth calls under 800 ms" },
  lat_ai: { target: 0.95, what: "AI routes under 14 s" },
  s3: { target: 0.95, what: "drafts ready within 60 s" },
  s4: { target: 0.95, what: "approved cloud attempts started within 10 minutes" },
  s5: { target: 0.999, what: "cloud attempts settled within 10 minutes" },
  s7: { target: 0.999, what: "Stripe events processed within 10 minutes" },
  s8: { target: 0.99, what: "replies classified within 10 minutes" },
} as const;
export type SloId = keyof typeof SLOS;

/** Error-budget burn: 1 spends the budget exactly over the SLO window. Null when there is no traffic. */
export function burnRate(good: number, total: number, target: number): number | null {
  return total === 0 ? null : (1 - good / total) / (1 - target);
}

/** Good and total per SLO over the last `minutes`, from metrics_minute. */
export async function sloWindow(db: Pick<Db, "select">, minutes: number): Promise<Record<string, { good: number; total: number }>> {
  const names = Object.keys(SLOS).flatMap((id) => [`slo.${id}.good`, `slo.${id}.total`]);
  const rows = await db
    .select({ name: metricsMinute.name, sum: sql<number>`sum(${metricsMinute.value})::float8` })
    .from(metricsMinute)
    .where(and(inArray(metricsMinute.name, names), sql`${metricsMinute.minute} > now() - make_interval(mins => ${minutes})`))
    .groupBy(metricsMinute.name);
  const out: Record<string, { good: number; total: number }> = {};
  for (const id of Object.keys(SLOS)) out[id] = { good: 0, total: 0 };
  for (const r of rows) {
    const [, id, kind] = r.name.split(".") as [string, string, "good" | "total"];
    if (out[id]) out[id][kind] = r.sum;
  }
  return out;
}
