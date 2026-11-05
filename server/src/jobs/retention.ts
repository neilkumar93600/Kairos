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
 * Rules for columns other packages are adding wait for them: the spam status of contact messages, submission_attempts.evidence at 90 days (WP-42's to schedule). below_bar keys on
 * status_changed_at (matches_retention_idx); the scrub selects on terminal_at (applications_scrub_due_idx) and nulls
 * questions. jobs_closed marks a purge by the emptied description_text (still NOT NULL), so no description_purged_at.
 * A closed job a tracker item or a tailored resume (WP-17) points at is never deleted, only purged: both are
 * ON DELETE SET NULL, so the item would silently lose its posting (DB-reviewer round 2).
 * ponytail: inbound_body's OR over the legacy plaintext keeps it off inbound_emails_body_purge_idx; drop the text_body
 * half with the column (WP-46) and the index serves it.
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
  /** Third-party reply bodies and previews (and the legacy plaintext); the metadata stays with the account. */
  inbound_body: {
    days: 180,
    run: (d: number) =>
      batched(() => sql`update inbound_emails set text_body = null, text_body_enc = null, preview_enc = null where id in (
        select id from inbound_emails where (text_body_enc is not null or text_body <> '') and received_at < ${before(d)} limit ${BATCH})`),
  },
  /** Hidden rows (a Gmail confirmation, likely spam) hold no body and are kept for support only (_db/messaging.md 4.6). */
  inbound_hidden: {
    days: 30,
    run: (d: number) =>
      batched(() => sql`delete from inbound_emails where id in (
        select id from inbound_emails where hidden_reason is not null and received_at < ${before(d)} limit ${BATCH})`),
  },
  /**
   * Gmail forwarding codes past expires_at (receipt + 3 days, set at ingest; the days value is not read): deleted, and
   * an owner still awaiting verification goes back to not_started (_db/messaging.md 6.1). A few hundred rows at most.
   */
  forwarding_codes: {
    days: 3,
    run: async () =>
      (
        await db().execute(sql`
          WITH gone AS (DELETE FROM forwarding_verifications WHERE expires_at < now() RETURNING user_id)
          UPDATE profiles p SET forwarding_state = 'not_started' FROM gone
           WHERE p.user_id = gone.user_id AND p.forwarding_state = 'awaiting_verification'`)
      ).rowCount ?? 0,
  },
  /** An active forwarding connection with no visible mail for this long shows as stale (informational only). */
  forwarding_stale: {
    days: 30,
    run: async (d: number) =>
      (
        await db().execute(sql`
          UPDATE profiles p SET forwarding_state = 'stale'
           WHERE p.forwarding_state = 'active'
             AND NOT EXISTS (SELECT 1 FROM inbound_emails e
                              WHERE e.user_id = p.user_id AND e.hidden_reason IS NULL AND e.received_at > ${before(d)})`)
      ).rowCount ?? 0,
  },
  /** Finished reminders (WP-35, _db/applications.md 3.5): 90 days after they were sent or cancelled. A few rows a day, no index needed yet: when reminders passes a few hundred thousand rows add partial indexes `(sent_at) WHERE sent_at IS NOT NULL` and `(cancelled_at) WHERE cancelled_at IS NOT NULL` and select with two ORed conditions instead of the coalesce. */
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
  /**
   * Newsletter sign-ups that never confirmed, or unsubscribed (WP-50): nothing to keep them for once the confirm link is
   * long dead or the person has left. Unsubscribed rows outlive the unsubscribe by this long, so a late click still finds
   * its row. The partial index on status <> 'confirmed' keeps the scan to these rows.
   */
  newsletter_inactive: {
    days: 30,
    run: (d: number) =>
      batched(() => sql`delete from newsletter_subscribers where id in (
        select id from newsletter_subscribers where status <> 'confirmed' and coalesce(unsubscribed_at, confirm_requested_at) < ${before(d)} limit ${BATCH})`),
  },
  matches_below_bar: {
    days: 30,
    run: (d: number) =>
      batched(() => sql`delete from matches where id in (
        select id from matches where status = 'below_bar' and status_changed_at < ${before(d)} limit ${BATCH})`),
  },
  /** WP-23, database-101: a pasted link nobody has sent again in six months. ponytail: scans a table the size of the owner's queue. */
  board_requests: {
    days: 180,
    run: (d: number) => batched(() => sql`delete from board_requests where id in (select id from board_requests where last_seen_at < ${before(d)} limit ${BATCH})`),
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
  /** The verifier memo (WP-26): rows past their own expires_at (24 hours at most); the day count is not used. */
  verified_claims: {
    days: 1,
    run: () => batched(() => sql`delete from verified_claims where claim_hash in (select claim_hash from verified_claims where expires_at < now() limit ${BATCH})`),
  },
  /**
   * Finished outbox rows (WP-22): only ids, and nothing reads them once the job is done; a week is for looking back at an
   * incident. ponytail: each batch scans, since the live index leaves done rows out; fine at a week of approvals, and past
   * about a million rows add a partial index on (updated_at) WHERE status = 'done'.
   */
  outbox_done: {
    days: 7,
    run: (d: number) => batched(() => sql`delete from outbox where id in (select id from outbox where status = 'done' and updated_at < ${before(d)} limit ${BATCH})`),
  },
  /** A dead row nobody resumed: by then the application behind it has been settled or withdrawn by hand. */
  outbox_dead: {
    days: 90,
    run: (d: number) => batched(() => sql`delete from outbox where id in (select id from outbox where status = 'dead' and updated_at < ${before(d)} limit ${BATCH})`),
  },
  /** Sensitive answer and receipt values, after submitted or withdrawn (processScrubApplications). */
  scrub_applications: { days: 7, run: null },
} as const;
export type RetentionRule = keyof typeof RETENTION_RULES;

/**
 * Each rule's period: RETENTION_DAYS where set, else the default. Throws on a name no rule has. An override of
 * forwarding_codes has no effect: that rule keys on expires_at, set at ingest.
 */
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
