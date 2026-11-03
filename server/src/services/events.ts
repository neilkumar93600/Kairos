import { sql } from "drizzle-orm";
import type { ApplicationEvent, ApplicationEventKind } from "@auto-career/shared";
import type { Db } from "../db/client";
import type { applicationEvents, DbEventKind, EventActor } from "../db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Scalars only, at most 1 KB, no string over 200 characters (application_events_payload_ck): ids, codes and counts. */
export type EventPayload = Record<string, string | number | boolean | null>;

interface EventBase {
  userId: string;
  kind: DbEventKind;
  actor: EventActor;
  payload?: EventPayload;
  /** Makes a retried producer insert nothing: unique per tracker item, `^[a-z0-9_:.-]{1,100}$`, e.g. `sent:2`. */
  dedupeKey?: string;
}

/** An application's event names the application; a tracker-only item's (saved, stage_changed, ...) names the item. */
export type EventInput = EventBase & ({ applicationId: string; trackerItemId?: never } | { trackerItemId: string; applicationId?: never });

/**
 * Appends one timeline event (F5, PRD 9.3; 02-database 7.3.4) in the caller's transaction, so it commits with the state
 * change it records. For an application it first finds the application's tracker item, or creates it (PRD 9.1: every
 * application has one; a job the user saved first is linked, never duplicated), all in one statement. An item found
 * by application_id wins, so an item whose job_id was nulled by a purged posting is reused, not re-inserted. Returns
 * false when the dedupe key was already used, or when the application or item is not the user's.
 */
export async function recordEvent(db: Db | Tx, e: EventInput): Promise<boolean> {
  const item = e.applicationId
    ? sql`existing AS (SELECT id FROM tracker_items WHERE application_id = ${e.applicationId} AND user_id = ${e.userId}),
          created AS (
            INSERT INTO tracker_items (user_id, job_id, application_id, stage, closed_reason, stage_set_by)
            SELECT a.user_id, a.job_id, a.id,
                   CASE a.status WHEN 'withdrawn' THEN 'closed' WHEN 'submitted' THEN 'applied' ELSE 'drafting' END,
                   CASE a.status WHEN 'withdrawn' THEN 'withdrawn' END,
                   'system'
              FROM applications a
             WHERE a.id = ${e.applicationId} AND a.user_id = ${e.userId} AND NOT EXISTS (SELECT 1 FROM existing)
            ON CONFLICT (user_id, job_id) WHERE job_id IS NOT NULL
            DO UPDATE SET application_id = coalesce(tracker_items.application_id, EXCLUDED.application_id)
            RETURNING id),
          item AS (SELECT id FROM existing UNION ALL SELECT id FROM created)`
    : sql`item AS (SELECT id FROM tracker_items WHERE id = ${e.trackerItemId} AND user_id = ${e.userId})`;
  const { rows } = await db.execute(sql`
    WITH ${item}
    INSERT INTO application_events (tracker_item_id, application_id, user_id, kind, actor, payload, dedupe_key)
    SELECT item.id, ${e.applicationId ?? null}::uuid, ${e.userId}, ${e.kind}, ${e.actor}, ${JSON.stringify(e.payload ?? {})}::jsonb,
           ${e.dedupeKey ?? null}
      FROM item
    ON CONFLICT (tracker_item_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING id`);
  return rows.length > 0;
}

/**
 * The stored kinds as the shared contract names them (applicationEventSchema; GET /tracker/:id/events), with what the
 * stored kind adds kept in the payload. null: an internal kind the timeline does not show (PRD 9.3 lists none of them).
 * There is no stored `refunded`: a failure is never charged, so the web shows "credit refunded" on `failed` (7.3.4).
 */
const API_KIND: Record<DbEventKind, [ApplicationEventKind, EventPayload?] | null> = {
  saved: ["saved"],
  drafted: ["drafted"],
  resume_linked: ["resume_linked"],
  approved: ["approved"],
  auto_approved: ["approved", { autopilot: true }],
  resent: ["approved", { resend: true }],
  sent: ["submitted"],
  failed: ["failed"],
  withdrawn: ["withdrawn"],
  reply_confirmation: ["reply_routed", { replyKind: "confirmation" }],
  reply_rejection: ["reply_routed", { replyKind: "rejection" }],
  reply_interview: ["reply_routed", { replyKind: "interview" }],
  reply_assessment: ["reply_routed", { replyKind: "assessment" }],
  reply_offer: ["reply_routed", { replyKind: "offer" }],
  stage_changed: ["stage_changed"],
  interview_added: ["interview_added"],
  note_added: ["note_added"],
  verified: null,
  edited: null,
  gone_quiet: null,
  reminder_sent: null,
};

export function toApiEvent(row: typeof applicationEvents.$inferSelect): ApplicationEvent | null {
  const mapped = API_KIND[row.kind];
  if (!mapped) return null;
  return {
    id: String(row.id),
    trackerItemId: row.trackerItemId,
    kind: mapped[0],
    source: row.source ?? (row.actor === "user" ? "user" : "system"),
    payload: { ...row.payload, ...mapped[1] },
    at: row.at.toISOString(),
  };
}
