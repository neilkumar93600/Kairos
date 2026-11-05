import { and, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { applications } from "../db/schema";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { scrubContent } from "../services/sensitive";

/**
 * Retention and scrubs (WP-25; 02-database 12.2; messaging-38, matching-79, database-101..102, applications-84). Daily,
 * idempotent, in batches of 5,000 rows (at most 50 a run), so two workers or a rerun change nothing twice. Periods are
 * the spec's defaults, overridable per rule with RETENTION_DAYS and pending counsel (owner-actions/WP-25.md).
 *
 * Rules for columns other packages are adding wait for them: hidden inbound rows (WP-44, messaging), the spam status
 * of contact messages, submission_attempts.evidence at 90 days (WP-42's to schedule). below_bar keys on
 * status_changed_at (matches_retention_idx); the scrub selects on terminal_at (applications_scrub_due_idx) and nulls
 * questions. jobs_closed marks a purge by the emptied description_text (still NOT NULL), so no description_purged_at.
 * A closed job a tracker item or a tailored resume (WP-17) points at is never deleted, only purged: both are
 * ON DELETE SET NULL, so the item would silently lose its posting (DB-reviewer round 2).
 * ponytail: inbound_body scans inbound_emails per batch; add (received_at) WHERE text_body <> '' at scale.
 * ponytail: jobs has no closed_at index, so jobs_closed scans jobs once per batch; add jobs_closed_idx (02-database 11)
 * when jobs passes a few hundred thousand rows.
 */

const BATCH = 5000;
const MAX_BATCHES = 50;

/** Runs a statement that touches at most BATCH rows until a batch comes back short. */
async function batched(statement: () => ReturnType<typeof sql>): Promise<number> {
  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const n = (await db().execute(statement())).rowCount ?? 0;
    total += n;
    if (n < BATCH) break;
  }
  return total;
}

const before = (days: number) => sql`now() - make_interval(days => ${days}::int)`;

export const RETENTION_RULES = {
  /** Third-party reply bodies; the metadata stays with the account. */
  inbound_body: {
    days: 180,
    run: (d: number) =>
      batched(() => sql`update inbound_emails set text_body = '' where id in (
        select id from inbound_emails where text_body <> '' and received_at < ${before(d)} limit ${BATCH})`),
  },
  /** Finished reminders (WP-35, _db/applications.md 3.5): 90 days after they were sent or cancelled. A few rows a day, no index needed. */
  reminders: {
    days: 90,
    run: (d: number) =>
      batched(() => sql`delete from reminders where id in (
        select id from reminders where coalesce(sent_at, cancelled_at) < ${before(d)} limit ${BATCH})`),
  },
  contact_messages: {
    days: 365,
    run: (d: number) => batched(() => sql`delete from contact_messages where id in (select id from contact_messages where created_at < ${before(d)} limit ${BATCH})`),
  },
  matches_below_bar: {
    days: 30,
    run: (d: number) =>
      batched(() => sql`delete from matches where id in (
        select id from matches where status = 'below_bar' and status_changed_at < ${before(d)} limit ${BATCH})`),
  },
  /** Closed postings: deleted when no application or tracker item points at them, else their description and raw purged. */
  jobs_closed: {
    days: 180,
    run: async (d: number) =>
      (await batched(() => sql`delete from jobs where id in (
        select j.id from jobs j where j.closed_at < ${before(d)}
          and not exists (select 1 from applications a where a.job_id = j.id)
          and not exists (select 1 from tracker_items t where t.job_id = j.id)
          and not exists (select 1 from resumes r where r.job_id = j.id) limit ${BATCH})`)) +
      (await batched(() => sql`update jobs set description_text = '', raw = null where id in (
        select id from jobs where closed_at < ${before(d)} and (description_text <> '' or raw is not null) limit ${BATCH})`)),
  },
  /** Sensitive answer and receipt values, after submitted or withdrawn (processScrubApplications). */
  scrub_applications: { days: 7, run: null },
} as const;
export type RetentionRule = keyof typeof RETENTION_RULES;

/** Each rule's period: RETENTION_DAYS where set, else the default. Throws on a name no rule has. */
export function retentionDays(overrides: Record<string, number> = env().RETENTION_DAYS): Record<RetentionRule, number> {
  for (const name of Object.keys(overrides)) if (!(name in RETENTION_RULES)) throw new Error(`unknown retention rule ${name} in RETENTION_DAYS`);
  return Object.fromEntries(Object.entries(RETENTION_RULES).map(([k, r]) => [k, overrides[k] ?? r.days])) as Record<RetentionRule, number>;
}

/** Daily: every table rule, in order; one failing rule does not stop the others, and the job then fails. */
export async function processRetention(): Promise<Record<string, number>> {
  const days = retentionDays();
  const out: Record<string, number> = {};
  const failed: unknown[] = [];
  for (const [name, rule] of Object.entries(RETENTION_RULES)) {
    if (!rule.run) continue;
    try {
      out[name] = await rule.run(days[name as RetentionRule]);
    } catch (err) {
      failed.push(err);
      logger.warn({ err, rule: name }, "retention rule failed");
    }
  }
  logger.info(out, "retention");
  if (failed.length) throw new AggregateError(failed, `retention: ${failed.length} rule(s) failed`);
  return out;
}

const SCRUB_BATCH = 500;

/**
 * Daily: blanks sensitive answer and receipt values of applications submitted or withdrawn at least 7 days ago
 * (CISO should-fix scrub, INV-9), nulls the question snapshot, and stamps content_scrubbed_at, so each row is scrubbed
 * once. terminal_at is WP-42's (backfilled for older rows); applications_scrub_due_idx serves the select.
 */
export async function processScrubApplications(): Promise<{ scrubbed: number }> {
  const days = retentionDays().scrub_applications;
  let scrubbed = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const n = await db().transaction(async (tx) => {
      const rows = await tx
        .select({ id: applications.id, answers: applications.answers, receipt: applications.receipt })
        .from(applications)
        .where(
          and(
            isNull(applications.contentScrubbedAt),
            inArray(applications.status, ["submitted", "withdrawn"]),
            sql`${applications.terminalAt} < ${before(days)}`,
          ),
        )
        .limit(SCRUB_BATCH)
        .for("update", { skipLocked: true });
      for (const r of rows) {
        await tx
          .update(applications)
          .set({ ...scrubContent(r.answers, r.receipt), questions: null, contentScrubbedAt: new Date() })
          .where(sql`${applications.id} = ${r.id}`);
      }
      return rows.length;
    });
    scrubbed += n;
    if (n < SCRUB_BATCH) break;
  }
  if (scrubbed) logger.info({ scrubbed }, "sensitive application content scrubbed");
  return { scrubbed };
}
