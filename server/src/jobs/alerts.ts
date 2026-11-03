import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { metricsMinute } from "../db/schema";
import { llmCostDaily } from "../db/schema/platform";
import { SHED_LEVELS } from "../llm/budget";
import { gauge } from "../lib/metrics";
import { signal, type Signal } from "../lib/sentry";
import { burnRate, SLOS, sloWindow, type SloId } from "../lib/slo";
import { QUEUES, queue, type QueueName } from "./queues";

/**
 * The in-house alert evaluator (WP-27; Grafana waits for WP-40). Every 5 minutes it reads metrics_minute and the model
 * ledger and raises Sentry signals (lib/sentry.ts), which the Sentry alert rules turn into pages. Unlike the per-process
 * signals, these count across every replica.
 */

/** Fewer events than this in a window is noise, not a burn. */
const MIN_EVENTS = 20;
/** 1 h window: the 30-day budget gone in 2 days. */
export const FAST_BURN = 14.4;
/** 6 h window: gone in 5 days. */
export const SLOW_BURN = 6;
/** S1 and S5: half the 30-day budget burned means only reliability work ships (README error-budget policy). */
const BUDGET_POLICY: SloId[] = ["s1", "s5"];

/** Today's model-spend envelope: the first shed threshold. ponytail: the owner pins a real number after beta data. */
export const ENVELOPE_USD = SHED_LEVELS[0];
/** Escalation (tier-up) calls above this share of a day's calls, with at least 100 calls. */
export const ESCALATION_SHARE_CAP = 0.1;
/** Model dollars per submitted application above which someone looks. ponytail: a guess until beta data. */
export const COST_PER_SUBMISSION_USD = 2;
/** Oldest waiting job age, seconds. */
export const QUEUE_LAG_BAR_S = 300;

type Window = Record<string, { good: number; total: number }>;

export interface AlertInput {
  hour: Window;
  sixHours: Window;
  month: Window;
  spendUsd: number;
  calls: number;
  tieredUpCalls: number;
  submissionsToday: number;
  /** cloud.run counters over the last 30 minutes. */
  cloudRuns: { submitted: number; failed: number };
  /** Latest queue_lag_s gauge by queue. */
  queueLagS: Record<string, number>;
}

/** Pure: every signal the inputs call for, with a reason for the log. */
export function evaluate(i: AlertInput): { signal: Signal; why: string }[] {
  const out: { signal: Signal; why: string }[] = [];
  for (const [id, { target }] of Object.entries(SLOS)) {
    const burn = (w: Window) => ((w[id]?.total ?? 0) >= MIN_EVENTS ? burnRate(w[id]!.good, w[id]!.total, target) : null);
    if ((burn(i.hour) ?? 0) > FAST_BURN) out.push({ signal: "slo_burn_fast", why: id });
    else if ((burn(i.sixHours) ?? 0) > SLOW_BURN) out.push({ signal: "slo_burn_slow", why: id });
    if (BUDGET_POLICY.includes(id as SloId) && (burn(i.month) ?? 0) >= 0.5) out.push({ signal: "slo_budget_half", why: id });
  }
  if (i.spendUsd >= ENVELOPE_USD) out.push({ signal: "llm_envelope_100", why: `$${i.spendUsd.toFixed(0)}` });
  else if (i.spendUsd >= ENVELOPE_USD * 0.8) out.push({ signal: "llm_envelope_80", why: `$${i.spendUsd.toFixed(0)}` });
  if (i.calls >= 100 && i.tieredUpCalls / i.calls > ESCALATION_SHARE_CAP) out.push({ signal: "llm_escalation_cap", why: `${i.tieredUpCalls}/${i.calls}` });
  if (i.submissionsToday >= 5 && i.spendUsd / i.submissionsToday > COST_PER_SUBMISSION_USD) {
    out.push({ signal: "cost_per_submission", why: `$${(i.spendUsd / i.submissionsToday).toFixed(2)}` });
  }
  const runs = i.cloudRuns.submitted + i.cloudRuns.failed;
  if (runs >= 10 && i.cloudRuns.failed / runs > 0.5) out.push({ signal: "cloud_run_failures", why: `${i.cloudRuns.failed}/${runs}` });
  for (const [name, lag] of Object.entries(i.queueLagS)) if (lag > QUEUE_LAG_BAR_S) out.push({ signal: "queue_lag", why: name });
  return out;
}

export async function processAlerts(): Promise<{ signal: Signal; why: string }[]> {
  const d = db();
  const [hour, sixHours, month] = await Promise.all([sloWindow(d, 60), sloWindow(d, 360), sloWindow(d, 30 * 24 * 60)]);
  const [spend] = await d
    .select({
      usd: sql<number>`coalesce(sum(${llmCostDaily.costUsd}), 0)::float8`,
      calls: sql<number>`coalesce(sum(${llmCostDaily.calls}), 0)::int`,
      tiered: sql<number>`coalesce(sum(${llmCostDaily.callsTieredUp}), 0)::int`,
    })
    .from(llmCostDaily)
    .where(eq(llmCostDaily.day, sql`current_date`));
  const subs = await d.execute(sql`select count(*)::int as n from applications where status = 'submitted' and submitted_at >= date_trunc('day', now())`);
  const runRows = await d
    .select({ label: metricsMinute.label, n: sql<number>`sum(${metricsMinute.value})::float8` })
    .from(metricsMinute)
    .where(and(eq(metricsMinute.name, "cloud.run"), gte(metricsMinute.minute, sql`now() - interval '30 minutes'`)))
    .groupBy(metricsMinute.label);
  const lagRows = await d
    .selectDistinctOn([metricsMinute.label], { label: metricsMinute.label, v: metricsMinute.value })
    .from(metricsMinute)
    .where(and(eq(metricsMinute.name, "queue_lag_s"), gte(metricsMinute.minute, sql`now() - interval '5 minutes'`)))
    .orderBy(metricsMinute.label, desc(metricsMinute.minute));
  const submitted = runRows.find((r) => r.label === "submitted")?.n ?? 0;
  const raised = evaluate({
    hour,
    sixHours,
    month,
    spendUsd: spend?.usd ?? 0,
    calls: spend?.calls ?? 0,
    tieredUpCalls: spend?.tiered ?? 0,
    submissionsToday: Number(subs.rows[0]?.n ?? 0),
    cloudRuns: { submitted, failed: runRows.reduce((n, r) => n + r.n, 0) - submitted },
    queueLagS: Object.fromEntries(lagRows.map((r) => [r.label, r.v])),
  });
  for (const r of raised) signal(r.signal);
  return raised;
}

/** Every minute: each queue's waiting, delayed and failed counts, and the age of its oldest waiting job. */
export async function processMetricsSample(): Promise<void> {
  for (const name of Object.values(QUEUES) as QueueName[]) {
    const q = queue(name);
    const counts = await q.getJobCounts("waiting", "failed");
    // ponytail: asc=true should give the oldest first (BullMQ pushes waiting jobs on the left of the list); confirm on the first staging run.
    const [oldest] = await q.getJobs(["waiting"], 0, 0, true);
    gauge("queue_waiting", counts.waiting ?? 0, name);
    gauge("queue_failed", counts.failed ?? 0, name);
    gauge("queue_lag_s", oldest ? Math.max(0, (Date.now() - oldest.timestamp) / 1000) : 0, name);
  }
}

/** Nightly: metrics older than 35 days (the SLO window is 30). */
export async function processMetricsPrune(): Promise<number> {
  const gone = await db().delete(metricsMinute).where(sql`${metricsMinute.minute} < now() - interval '35 days'`).returning({ m: metricsMinute.minute });
  return gone.length;
}
