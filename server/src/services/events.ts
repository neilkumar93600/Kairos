import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { ApplicationEvent, ApplicationEventKind } from "@auto-career/shared";
import { db, type Db } from "../db/client";
import { applicationEvents, type DbEventKind, type EventActor } from "../db/schema";
import { keysetBefore, slicePage, tsKey, type After } from "../lib/pagination";

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

/** The posting as saved (PRD 9.3), for INSERT ... SELECT. 10,000 characters of any kind stay under tracker_items_snapshot_ck. */
export const jobSnapshotSql = (jobId: SQL) => sql`(SELECT jsonb_build_object('title', j.title, 'company', c.name, 'location', j.location, 'url', j.apply_url, 'descriptionText', left(j.description_text, 10000))
    FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ${jobId})`;

/**
 * Appends one timeline event (F5, PRD 9.3; 02-database 7.3.4) in the caller's transaction, so it commits with the state
 * change it records. For an application it first finds the application's tracker item, or creates it (PRD 9.1: every
 * application has one; a job the user saved first is linked, never duplicated), all in one statement. An item found
 * by application_id wins, so an item whose job_id was nulled by a purged posting is reused, not re-inserted. Returns
 * false when the dedupe key was already used, or when the application or item is not the user's.
 */
export async function recordEvent(conn: Db | Tx, e: EventInput): Promise<boolean> {
  const item = e.applicationId
    ? sql`existing AS (SELECT id FROM tracker_items WHERE application_id = ${e.applicationId} AND user_id = ${e.userId}),
          created AS (
            INSERT INTO tracker_items (user_id, job_id, application_id, stage, closed_reason, stage_set_by, job_snapshot)
            SELECT a.user_id, a.job_id, a.id,
                   CASE a.status WHEN 'withdrawn' THEN 'closed' WHEN 'submitted' THEN 'applied' ELSE 'drafting' END,
                   CASE a.status WHEN 'withdrawn' THEN 'withdrawn' END,
                   'system',
                   ${jobSnapshotSql(sql`a.job_id`)}
              FROM applications a
             WHERE a.id = ${e.applicationId} AND a.user_id = ${e.userId} AND NOT EXISTS (SELECT 1 FROM existing)
            ON CONFLICT (user_id, job_id) WHERE job_id IS NOT NULL
            DO UPDATE SET application_id = coalesce(tracker_items.application_id, EXCLUDED.application_id)
            RETURNING id),
          item AS (SELECT id FROM existing UNION ALL SELECT id FROM created)`
    : sql`item AS (SELECT id FROM tracker_items WHERE id = ${e.trackerItemId} AND user_id = ${e.userId})`;
  const { rows } = await conn.execute(sql`
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

/** The stored kinds the timeline shows, filtered in the query so a page is not thinned after it. */
const TIMELINE_KINDS = (Object.keys(API_KIND) as DbEventKind[]).filter((k) => API_KIND[k] !== null);

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

/** One page of an item's timeline, in the shared shape. Rows of one transaction tie on `at`; the id carries their order. */
export async function eventPage(trackerItemId: string, page: { limit: number; after?: After }, list: string, order: "asc" | "desc") {
  const e = applicationEvents;
  const dir = order === "asc" ? asc : desc;
  const rows = await db()
    .select({ row: e, cursorAt: tsKey(e.at) })
    .from(e)
    .where(and(eq(e.trackerItemId, trackerItemId), inArray(e.kind, TIMELINE_KINDS), page.after && keysetBefore([e.at], ["timestamptz"], e.id, page.after, order, "bigint")))
    .orderBy(dir(e.at), dir(e.id))
    .limit(page.limit + 1);
  const sliced = slicePage(rows, page.limit, list, (r) => [r.cursorAt], (r) => String(r.row.id));
  return { events: sliced.rows.flatMap((r) => toApiEvent(r.row) ?? []), ...(sliced.nextCursor ? { nextCursor: sliced.nextCursor } : {}) };
}
