import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { broadcastMissing } from "../lib/broadcast";
import { env } from "../lib/env";
import { escapeHtml, oneLine } from "../lib/html";
import { logger } from "../lib/logger";
import { recordEvent } from "../services/events";
import { enqueueNotify, RENDERERS, type Rendered } from "./notify";

/**
 * Saved-search digests (F6, messaging-49; _db/identity-profile.md 3.13, workers/12-engagement-notify.md 3.2).
 *
 * The hourly `digests` tick claims every search due at 08:00 in its owner's time zone (the claim moves next_digest_at
 * to the next 08:00 and last_digest_at to now, and keeps the window it covers in window_start), drops the searches
 * whose owner turned digests off, has been away 30 days, or has nothing new, and queues one `digest` email per rest
 * through the notify core. That core checks the opt-out again when it sends, so a toggle after the tick still stops
 * the email. The email itself is built here (renderDigest), from the database, at send time.
 */

const CLAIM_BATCH = 500;
/** 500 a round, six rounds a tick: above the estimated peak hour of about 900 searches. */
const MAX_ROUNDS = 6;
const REMINDER_STALE_DAYS = 30;

/** A match belongs in a search's digest: new, in the window (at most 7 days back), open, and inside the search's filters. Aliases s, m, j, c. */
const NEWS = sql`
  m.user_id = s.user_id AND m.status = 'new' AND m.created_at > greatest(s.window_start, s.last_digest_at - interval '7 days')
  AND j.id = m.job_id AND j.closed_at IS NULL AND c.id = j.company_id
  AND m.score >= coalesce((s.filters->>'minScore')::int, 0)
  AND (jsonb_array_length(coalesce(s.filters->'roles', '[]'::jsonb)) = 0
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(s.filters->'roles') r WHERE position(lower(r) in j.title_lc) > 0))
  AND (jsonb_array_length(coalesce(s.filters->'companies', '[]'::jsonb)) = 0
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(s.filters->'companies') x WHERE lower(c.name) = lower(x)))
  AND (NOT coalesce((s.filters->>'remoteOnly')::boolean, false) OR j.remote)`;

/** Reminder nudges ride only with the digest of the user's first active search: the oldest one that is not off. */
const FIRST_ACTIVE = sql`s.id = (SELECT f.id FROM saved_searches f WHERE f.user_id = s.user_id AND f.frequency <> 'off' ORDER BY f.created_at, f.id LIMIT 1)`;

type Claimed = {
  id: string;
  user_id: string;
  claimed_at: Date;
  window_start: Date;
};

/** One statement: lock and advance up to 500 due searches. SKIP LOCKED, so two ticks never take the same row. */
async function claimDue(): Promise<Claimed[]> {
  const { rows } = await db().execute<Claimed>(sql`
    WITH due AS (
      SELECT s.id, s.user_id FROM saved_searches s
       WHERE s.frequency <> 'off' AND s.next_digest_at <= now()
       ORDER BY s.next_digest_at LIMIT ${CLAIM_BATCH}
         FOR UPDATE OF s SKIP LOCKED)
    UPDATE saved_searches s
       SET window_start = coalesce(s.last_digest_at, s.created_at),
           last_digest_at = now(),
           next_digest_at = saved_search_next_due(s.frequency, p.timezone, now())
      FROM due JOIN profiles p ON p.user_id = due.user_id
     WHERE s.id = due.id
    RETURNING s.id, s.user_id, s.last_digest_at AS claimed_at, s.window_start`);
  return rows;
}

/** Of claimed searches, those worth an email now: digests on, active in the last 30 days, and news or a due reminder. */
async function worthSending(ids: string[]): Promise<{ id: string; user_id: string; local_date: string }[]> {
  if (!ids.length) return [];
  const { rows } = await db().execute<{ id: string; user_id: string; local_date: string }>(sql`
    SELECT s.id, s.user_id, user_local_day(s.last_digest_at, p.timezone) AS local_date
      FROM saved_searches s JOIN profiles p ON p.user_id = s.user_id
     WHERE s.id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
       AND NOT ('digest' = ANY(p.mail_opt_out))
       AND EXISTS (SELECT 1 FROM session x WHERE x.user_id = s.user_id AND x.updated_at > now() - interval '30 days')
       AND (EXISTS (SELECT 1 FROM matches m, jobs j, companies c WHERE ${NEWS})
            OR (NOT ('reminders' = ANY(p.mail_opt_out)) AND ${FIRST_ACTIVE}
                AND EXISTS (SELECT 1 FROM reminders r WHERE r.user_id = s.user_id AND r.sent_at IS NULL AND r.cancelled_at IS NULL AND r.due_at <= now())))`);
  return rows;
}

export const digestEntityId = (searchId: string, localDate: string) => `${searchId}:${localDate}`;

/** The hourly tick. Returns what it did, for the log and the tests. */
export async function processDigests(): Promise<{ claimed: number; enqueued: number; heldBack?: string[] }> {
  // Without the link key, the public origin and the postal address a digest cannot be sent lawfully: leave the searches
  // unclaimed, so nothing is lost and the first tick after the owner sets them sends the digests.
  const missing = broadcastMissing();
  if (missing.length) {
    logger.warn({ missing }, "digests held back: broadcast mail is not configured");
    return { claimed: 0, enqueued: 0, heldBack: missing };
  }
  let claimed = 0;
  let enqueued = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const batch = await claimDue();
    claimed += batch.length;
    const send = await worthSending(batch.map((b) => b.id));
    for (const s of send) {
      try {
        await enqueueNotify("digest", digestEntityId(s.id, s.local_date), s.user_id);
        enqueued += 1;
      } catch (err) {
        // Redis is down: put the search back, due now, with the window it had, so the next tick sends it.
        logger.error({ err }, "digest enqueue failed; the search goes back to due");
        await db().execute(sql`
          UPDATE saved_searches SET last_digest_at = window_start, next_digest_at = now()
           WHERE id = ${s.id} AND frequency <> 'off'`);
      }
    }
    if (batch.length < CLAIM_BATCH) break;
  }
  if (claimed) logger.info({ claimed, enqueued }, "digests claimed");
  return { claimed, enqueued };
}

const ENTITY = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{4}-\d{2}-\d{2})$/;

type Reminder = {
  id: string;
  kind: "no_reply" | "saved_job_ageing";
  application_id: string;
  due_at: string | Date;
  status: string;
  stage: string | null;
  draft_state: string;
  title: string;
  company: string;
  has_reply: boolean;
};

/**
 * The user's due reminders, decided against the live application (_db/applications.md 3.5: the digest validates and
 * is the only thing that cancels). Invalid ones are cancelled with their reason now, because a cancellation is final
 * whatever happens to the email; the valid ones come back.
 */
export async function dueReminders(userId: string, optedOut: boolean): Promise<Reminder[]> {
  const { rows } = await db().execute<Reminder>(sql`
    SELECT r.id, r.kind, r.application_id, r.due_at, a.status, a.stage, a.draft_state, j.title, c.name AS company,
           (EXISTS (SELECT 1 FROM application_events e WHERE e.application_id = a.id AND e.kind LIKE 'reply\\_%')
            OR EXISTS (SELECT 1 FROM inbound_emails ie WHERE ie.application_id = a.id)) AS has_reply
      FROM reminders r
      JOIN applications a ON a.id = r.application_id
      JOIN jobs j ON j.id = a.job_id
      JOIN companies c ON c.id = j.company_id
     WHERE r.user_id = ${userId} AND r.sent_at IS NULL AND r.cancelled_at IS NULL AND r.due_at <= now()
     ORDER BY r.due_at LIMIT 10`);
  const valid: Reminder[] = [];
  const cancel = new Map<string, string[]>();
  const stale = Date.now() - REMINDER_STALE_DAYS * 86_400_000;
  for (const r of rows) {
    const reason = optedOut
      ? "user_opted_out"
      : new Date(r.due_at).getTime() < stale
        ? "expired"
        : r.kind === "no_reply"
          ? r.status === "submitted" && (r.stage === null || r.stage === "applied") && !r.has_reply
            ? null
            : "reply_received"
          : r.status === "draft" && r.draft_state === "ready"
            ? null
            : "draft_resolved";
    if (reason) cancel.set(reason, [...(cancel.get(reason) ?? []), r.id]);
    else valid.push(r);
  }
  for (const [reason, ids] of cancel) {
    await db().execute(sql`
      UPDATE reminders SET cancelled_at = now(), cancel_reason = ${reason}
       WHERE id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}) AND sent_at IS NULL AND cancelled_at IS NULL`);
  }
  return valid;
}

type DigestRow = {
  name: string;
  email: string;
  opt_out: string[];
  local_date: string;
  first_active: boolean;
};
type MatchRow = {
  title: string;
  company: string;
  remote: boolean;
  score: number;
  total: number;
};

/** The digest of one search for one local day, built from the database at send time. */
export async function renderDigest(entityId: string, userId: string | null): Promise<Rendered> {
  const parsed = entityId.match(ENTITY);
  if (!parsed || !userId) throw new Error("malformed digest entity");
  const [, searchId, day] = parsed as unknown as [string, string, string];
  const { rows: found } = await db().execute<DigestRow>(sql`
    SELECT s.name, u.email, p.mail_opt_out AS opt_out,
           user_local_day(s.last_digest_at, p.timezone) AS local_date, (${FIRST_ACTIVE}) AS first_active
      FROM saved_searches s JOIN profiles p ON p.user_id = s.user_id JOIN "user" u ON u.id = s.user_id
     WHERE s.id = ${searchId}::uuid AND s.user_id = ${userId}`);
  const me = found[0];
  // The search or the account is gone (an erasure), or a later claim has replaced this day's: nothing to send.
  if (!me) return { skip: "gone" };
  if (me.local_date !== day) return { skip: "superseded" };

  const { rows: matches } = await db().execute<MatchRow>(sql`
    SELECT j.title, c.name AS company, j.remote, m.score, count(*) OVER ()::int AS total
      FROM saved_searches s, matches m, jobs j, companies c
     WHERE s.id = ${searchId}::uuid AND ${NEWS}
     ORDER BY m.score DESC, m.created_at DESC LIMIT 10`);
  const nudges = me.first_active ? await dueReminders(userId, me.opt_out.includes("reminders")) : [];
  if (!matches.length && !nudges.length) return { skip: "empty" };

  const total = matches[0]?.total ?? 0;
  const web = env().WEB_ORIGIN;
  const line = (m: MatchRow) => `${oneLine(m.title, 120)} at ${oneLine(m.company, 80)} (score ${m.score}${m.remote ? ", remote" : ""})`;
  const nudge = (r: Reminder) =>
    r.kind === "no_reply"
      ? `No reply yet from ${oneLine(r.company, 80)} about ${oneLine(r.title, 120)}. Sent over two weeks ago.`
      : `Your draft for ${oneLine(r.title, 120)} at ${oneLine(r.company, 80)} has been ready for a week.`;

  const text = [
    ...(matches.length ? [`New matches for "${oneLine(me.name, 60)}" (${total}):`, ...matches.map((m) => `- ${line(m)}`), ...(total > matches.length ? [`...and ${total - matches.length} more.`] : []), `Open your matches: ${web}/matches`] : []),
    ...(nudges.length ? ["", "Worth a look:", ...nudges.map((r) => `- ${nudge(r)}`), `Open your applications: ${web}/applications`] : []),
  ].join("\n");
  const html = [
    ...(matches.length
      ? [`<h2>New matches for &ldquo;${escapeHtml(oneLine(me.name, 60))}&rdquo; (${total})</h2><ul>`, ...matches.map((m) => `<li>${escapeHtml(line(m))}</li>`), "</ul>",
         ...(total > matches.length ? [`<p>...and ${total - matches.length} more.</p>`] : []), `<p><a href="${escapeHtml(web)}/matches">Open your matches</a></p>`]
      : []),
    ...(nudges.length ? ["<h3>Worth a look</h3><ul>", ...nudges.map((r) => `<li>${escapeHtml(nudge(r))}</li>`), "</ul>", `<p><a href="${escapeHtml(web)}/applications">Open your applications</a></p>`] : []),
  ].join("");

  return {
    to: me.email,
    subject: matches.length ? `${total} new match${total === 1 ? "" : "es"} on Kairos` : "A reminder from Kairos",
    text,
    html,
    onSent: async () => {
      for (const r of nudges) {
        await db().execute(sql`UPDATE reminders SET sent_at = now() WHERE id = ${r.id}::uuid AND sent_at IS NULL AND cancelled_at IS NULL`);
        await recordEvent(db(), { applicationId: r.application_id, userId, kind: "reminder_sent", actor: "system", dedupeKey: `reminder:${r.id}` });
      }
    },
  };
}

RENDERERS.digest = renderDigest;
