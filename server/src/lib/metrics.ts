import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { metricsMinute } from "../db/schema";
import { logger } from "./logger";
import { redis } from "./redis";

/**
 * In-house metrics (WP-27; Grafana and OTel wait for WP-40). A process buffers counters and gauges and writes them to
 * metrics_minute every 30 s: counters add into the minute's row, gauges replace it. Labels are route groups, queues or
 * ATS names, never ids. SLO pairs are the counters `slo.<id>.good` and `slo.<id>.total`.
 * ponytail: one upsert per distinct (name, label) per flush; fine for tens of series, batch if the set grows past ~500.
 */

const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const key = (name: string, label: string) => `${name}\u0000${label}`;

export function count(name: string, n = 1, label = ""): void {
  counters.set(key(name, label), (counters.get(key(name, label)) ?? 0) + n);
}

export function gauge(name: string, value: number, label = ""): void {
  gauges.set(key(name, label), value);
}

/** One event against an SLO: always `total`, `good` when it met the objective. */
export function slo(id: string, good: boolean): void {
  count(`slo.${id}.total`);
  if (good) count(`slo.${id}.good`);
}

/** Upper bounds in ms; a request lands in the first bucket it fits, the last is +Inf. */
export const LATENCY_BUCKETS_MS = [50, 100, 300, 500, 800, 2000, 5000, 14_000] as const;

/** A latency histogram per route group: counters `lat.<group>` labelled with the bucket, plus `lat_sum_ms`. */
export function observeLatency(group: string, ms: number): void {
  const le = LATENCY_BUCKETS_MS.find((b) => ms <= b);
  count(`lat.${group}`, 1, le === undefined ? "inf" : String(le));
  count(`lat_sum_ms.${group}`, ms);
}

/** Splits a buffer key; exported for the flush test. */
export const split = (k: string): [string, string] => k.split("\u0000") as [string, string];

/** Where the applier's counters go: it holds no write grant on metrics_minute, so they pass through Redis. */
export const APPLIER_METRICS_KEY = "kairos:applier-metrics";
type Sink = (counters: Map<string, number>) => Promise<void>;

/** The applier's sink: one hash, one HINCRBYFLOAT per series. */
export const redisSink: Sink = async (c) => {
  const pipe = redis().multi();
  for (const [k, v] of c) pipe.hincrbyfloat(APPLIER_METRICS_KEY, k, v);
  await pipe.exec();
};

/**
 * Worker side: moves the applier's counters from Redis into this process's buffer (the next flush writes them). The hash is
 * renamed first, so counts that arrive during the fold land in a fresh hash; a leftover from a crashed fold is folded too.
 * ponytail: a worker that dies between the rename and its flush loses up to a minute of applier counts.
 */
export async function foldApplierMetrics(): Promise<void> {
  const tmp = `${APPLIER_METRICS_KEY}:fold`;
  for (const source of [tmp, APPLIER_METRICS_KEY]) {
    if (source === APPLIER_METRICS_KEY && !(await redis().rename(APPLIER_METRICS_KEY, tmp).then(() => true, () => false))) break;
    const h = await redis().hgetall(tmp);
    for (const [k, v] of Object.entries(h)) {
      const [name, label] = split(k);
      count(name, Number(v), label);
    }
    await redis().del(tmp);
  }
}

/**
 * Writes and clears the buffers, in one transaction with the rows sorted by (name, label): two processes writing the same
 * minute then lock rows in the same order and cannot deadlock. A failed write puts the counters back.
 */
export async function flushMetrics(now = new Date(), sink?: Sink): Promise<number> {
  const c = new Map(counters);
  const g = new Map(gauges);
  counters.clear();
  gauges.clear();
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  try {
    if (sink) await sink(c);
    else {
      const rows = [
        ...[...c].map(([k, value]) => ({ k, value, gauge: false })),
        ...[...g].map(([k, value]) => ({ k, value, gauge: true })),
      ].sort((x, y) => (x.k < y.k ? -1 : x.k > y.k ? 1 : 0));
      await db().transaction(async (tx) => {
        for (const r of rows) {
          const [name, label] = split(r.k);
          await tx
            .insert(metricsMinute)
            .values({ minute, name, label, value: r.value })
            .onConflictDoUpdate({ target: [metricsMinute.minute, metricsMinute.name, metricsMinute.label], set: { value: r.gauge ? r.value : sql`${metricsMinute.value} + excluded.value` } });
        }
      });
    }
  } catch (err) {
    logger.warn({ err }, "metrics not written; kept for the next flush");
    for (const [k, v] of c) counters.set(k, (counters.get(k) ?? 0) + v);
    for (const [k, v] of g) if (!gauges.has(k)) gauges.set(k, v);
    return 0;
  }
  return c.size + g.size;
}

/** Flushes every 30 s while the process lives; a last flush runs at shutdown through the returned stop. */
export function startMetricsFlush(sink?: Sink): () => Promise<void> {
  const timer = setInterval(() => void flushMetrics(new Date(), sink), 30_000).unref();
  return async () => {
    clearInterval(timer);
    await flushMetrics(new Date(), sink);
  };
}

/** For tests. */
export function resetMetrics(): void {
  counters.clear();
  gauges.clear();
}
export const bufferedCounters = (): ReadonlyMap<string, number> => counters;
