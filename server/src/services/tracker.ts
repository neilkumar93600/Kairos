import { INSIGHTS_MIN_SAMPLE, TRACKER_STAGES, insightsSchema, type InsightRange, type Insights, type TrackerStage } from "@auto-career/shared";
import { HttpError } from "../lib/errors";
import { AMBIGUOUS, type FailureCode } from "./submissions";

const lock = (reason: "approve_in_review_queue" | "withdraw_first" | "pipeline_stage", message: string) => new HttpError(409, "stage_owned_by_pipeline", message, { reason });

/**
 * Whether the user may drop a card on a stage (PRD 9.1, rule 11). Dragging never sends, approves or withdraws. Drafting and Applied
 * follow real state: an application may be put back on the stage its status already says, which is the only way back from a
 * mis-drag (nothing fires `sent` twice), and nothing else. So Applied needs a submission and is refused while approved or submitting.
 * `status` is the linked application's, null for an item without one.
 */
export function checkMove(from: TrackerStage, to: TrackerStage, status: string | null): void {
  if (to === from) return;
  if (status === null) {
    if (to === "drafting") throw lock("pipeline_stage", "Drafting is set when Kairos drafts an application.");
    return;
  }
  if (to === "applied" && status !== "submitted") throw lock("approve_in_review_queue", "Approve it in the Review queue to send it");
  if (to === "drafting" && status !== "draft" && status !== "failed") throw lock("pipeline_stage", "Drafting is set when Kairos drafts an application.");
  if (to === "closed" && (status === "approved" || status === "submitting")) throw lock("withdraw_first", "It's approved to send. Withdraw it in the Review queue first");
}

/**
 * "Send failed, credit refunded" only for a failure we can call one. Not for an ambiguous code or none, where the mail may have gone,
 * and not after any earlier attempt that rests as needs_check: attempt 1 unconfirmed, attempt 2 a plain failure, and attempt 1 may
 * still have reached the employer.
 */
export function sendFailed(status: string | null, code: string | null, uncertainAttempt: boolean): boolean {
  return status === "failed" && code !== null && !AMBIGUOUS.has(code as FailureCode) && !uncertainAttempt;
}

/** One sent application, as the insights query reads it. */
export interface SentRow {
  firstReplyDays: number | null;
  interviewed: boolean;
  offered: boolean;
  resumeId: string | null;
  resumeName: string | null;
}

const rate = (n: number, sent: number) => (sent >= INSIGHTS_MIN_SAMPLE ? Math.round((n / sent) * 1000) / 1000 : null);

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return Math.round((s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2) * 10) / 10;
}

/**
 * PRD 9.6: below 5 sent in a group, counts and never a rate, on every path. The median counts as a rate here: over one or two replies
 * it reads as a promise. The counts stay (acceptance: "insights show counts below 5"; contract insightsSchema), so nothing is withheld
 * that a total could give back. Parsed against the contract before it leaves, so a change here cannot ship a rate the schema forbids.
 */
export function summarizeInsights(range: InsightRange, rows: SentRow[], stages: Partial<Record<TrackerStage, number>>): Insights {
  const sent = rows.length;
  const replied = rows.filter((r) => r.firstReplyDays !== null);
  const interviews = rows.filter((r) => r.interviewed).length;
  const lowSample = sent < INSIGHTS_MIN_SAMPLE;
  const groups = new Map<string, { resumeId: string; name: string; sent: number; replies: number }>();
  for (const r of rows) {
    if (!r.resumeId) continue;
    const g = groups.get(r.resumeId) ?? { resumeId: r.resumeId, name: r.resumeName ?? "Resume", sent: 0, replies: 0 };
    g.sent += 1;
    if (r.firstReplyDays !== null) g.replies += 1;
    groups.set(r.resumeId, g);
  }
  return insightsSchema.parse({
    range,
    sent,
    replies: replied.length,
    interviews,
    offers: rows.filter((r) => r.offered).length,
    replyRate: rate(replied.length, sent),
    interviewRate: rate(interviews, sent),
    medianDaysToFirstReply: lowSample ? null : median(replied.map((r) => r.firstReplyDays!)),
    lowSample,
    funnel: TRACKER_STAGES.map((stage) => ({ stage, count: stages[stage] ?? 0 })),
    byResume: [...groups.values()].sort((a, b) => b.sent - a.sent || a.resumeId.localeCompare(b.resumeId)).map((g) => ({ ...g, replyRate: rate(g.replies, g.sent) })),
  });
}
