import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { logger } from "../lib/logger";
import { recordEvent } from "../services/events";

/**
 * Reminder creation (F5, messaging-52; _db/applications.md 3.5), hourly. Rows only: a reminder is mailed, if it is still
 * valid, inside the next digest (jobs/digest.ts), which is also the only thing that cancels one. Two kinds:
 *  - no_reply: a submitted application with no reply 14 days after it was sent (scanned in the 14 to 17 day window, so
 *    an outage of up to 3 days heals itself; the unique index makes every repeat a no-op);
 *  - saved_job_ageing: a prepared draft waiting for approval for 7 days (the 7 to 10 day window).
 * At most REMINDER_WEEKLY_CAP new reminders per user per ISO week (both kinds), oldest first, and only for users who
 * keep reminders on and have a digest to carry them.
 */
export const REMINDER_WEEKLY_CAP = 3;
const BATCH = 500;

type Candidate = {
  application_id: string;
  user_id: string;
  due_at: Date;
};

/** Candidates of one kind, already limited to what the user's weekly cap still allows. */
const candidates = (kind: "no_reply" | "saved_job_ageing") => {
  const [pool, due] =
    kind === "no_reply"
      ? [
          sql`a.submitted_at >= now() - interval '17 days' AND a.submitted_at < now() - interval '14 days'
              AND a.status = 'submitted' AND (a.stage IS NULL OR a.stage = 'applied')
              AND NOT EXISTS (SELECT 1 FROM application_events e WHERE e.application_id = a.id AND e.kind LIKE 'reply\\_%')
              AND NOT EXISTS (SELECT 1 FROM inbound_emails ie WHERE ie.application_id = a.id)`,
          sql`a.submitted_at + interval '14 days'`,
        ]
      : [
          sql`a.status = 'draft' AND a.draft_state = 'ready' AND a.updated_at < now() - interval '7 days' AND a.updated_at >= now() - interval '10 days'`,
          sql`a.updated_at + interval '7 days'`,
        ];
  return db().execute<Candidate>(sql`
    WITH cand AS (
      SELECT a.id AS application_id, a.user_id, ${due} AS due_at,
             row_number() OVER (PARTITION BY a.user_id ORDER BY ${due}, a.id) AS rn
        FROM applications a JOIN profiles p ON p.user_id = a.user_id
       WHERE ${pool}
         AND NOT ('reminders' = ANY(p.mail_opt_out)) AND NOT ('digest' = ANY(p.mail_opt_out))
         AND NOT EXISTS (SELECT 1 FROM reminders r WHERE r.application_id = a.id AND r.kind = ${kind})
         AND EXISTS (SELECT 1 FROM saved_searches s WHERE s.user_id = a.user_id AND s.frequency <> 'off'))
    SELECT c.application_id, c.user_id, c.due_at FROM cand c
     WHERE c.rn <= ${REMINDER_WEEKLY_CAP} - (SELECT count(*) FROM reminders r WHERE r.user_id = c.user_id AND r.created_at >= date_trunc('week', now()))
     ORDER BY c.due_at LIMIT ${BATCH}`);
};

/** The hourly reminders schedule. Idempotent and safe on two workers at once (a rare overlap may exceed the cap by one). */
export async function processReminders(): Promise<{ created: number }> {
  let created = 0;
  for (const kind of ["no_reply", "saved_job_ageing"] as const) {
    for (const c of (await candidates(kind)).rows) {
      await db().transaction(async (tx) => {
        const inserted = await tx.execute<{ id: string }>(sql`
          INSERT INTO reminders (user_id, kind, application_id, due_at) VALUES (${c.user_id}, ${kind}, ${c.application_id}::uuid, ${c.due_at})
          ON CONFLICT (application_id, kind) DO NOTHING RETURNING id`);
        if (!inserted.rows.length) return;
        created += 1;
        if (kind === "no_reply") await recordEvent(tx, { applicationId: c.application_id, userId: c.user_id, kind: "gone_quiet", actor: "system", payload: { days: 14 }, dedupeKey: "gone_quiet" });
      });
    }
  }
  if (created) logger.info({ created }, "reminders created");
  return { created };
}
