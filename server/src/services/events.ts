import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import type { ApplicationEventKind, EventActor } from "../db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Scalars only, at most 1 KB, no string over 200 characters (application_events_payload_ck): ids, codes and counts. */
export type EventPayload = Record<string, string | number | boolean | null>;

interface EventBase {
  userId: string;
  kind: ApplicationEventKind;
  actor: EventActor;
  payload?: EventPayload;
  /** Makes a retried producer insert nothing: unique per tracker item, `^[a-z0-9_:.-]{1,100}$`, e.g. `sent:2`. */
  dedupeKey?: string;
}

/** An application's event names the application; a tracker-only item's (saved, stage_changed, ...) names the item. */
export type EventInput = EventBase & ({ applicationId: string; trackerItemId?: never } | { trackerItemId: string; applicationId?: never });

/**
 * Appends one timeline event (F5, PRD 9.3; 02-database 7.3.4) in the caller's transaction, so it commits with the state
 * change it records. For an application it first finds or creates the application's tracker item (PRD 9.1: every
 * application has one; a job the user saved first is linked, never duplicated), all in one statement. Returns false
 * when the dedupe key was already used, or when the application or item is not the user's.
 */
export async function recordEvent(db: Db | Tx, e: EventInput): Promise<boolean> {
  const item = e.applicationId
    ? sql`INSERT INTO tracker_items (user_id, job_id, application_id, stage, closed_reason, stage_set_by)
          SELECT a.user_id, a.job_id, a.id,
                 CASE a.status WHEN 'withdrawn' THEN 'closed' WHEN 'submitted' THEN 'applied' ELSE 'drafting' END,
                 CASE a.status WHEN 'withdrawn' THEN 'withdrawn' END,
                 'system'
            FROM applications a WHERE a.id = ${e.applicationId} AND a.user_id = ${e.userId}
          ON CONFLICT (user_id, job_id) WHERE job_id IS NOT NULL
          DO UPDATE SET application_id = coalesce(tracker_items.application_id, EXCLUDED.application_id)
          RETURNING id`
    : sql`SELECT id FROM tracker_items WHERE id = ${e.trackerItemId} AND user_id = ${e.userId}`;
  const { rows } = await db.execute(sql`
    WITH item AS (${item})
    INSERT INTO application_events (tracker_item_id, application_id, user_id, kind, actor, payload, dedupe_key)
    SELECT item.id, ${e.applicationId ?? null}::uuid, ${e.userId}, ${e.kind}, ${e.actor}, ${JSON.stringify(e.payload ?? {})}::jsonb,
           ${e.dedupeKey ?? null}
      FROM item
    ON CONFLICT (tracker_item_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING id`);
  return rows.length > 0;
}
