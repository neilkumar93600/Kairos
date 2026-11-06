import { and, eq, inArray, sql } from "drizzle-orm";
import type { TrackerStage } from "@auto-career/shared";
import { db } from "../db/client";
import { trackerItems, trackerProjectorState } from "../db/schema";
import { count } from "../lib/metrics";

type ClosedReason = "rejected" | "withdrawn" | "not_pursuing" | "posting_closed" | null;

export interface ProjectedEvent {
  kind: string;
  actor: string;
  payload: Record<string, unknown>;
  /** Microsecond text in UTC: fixed width, so it compares as a string where a JS Date would lose the microseconds. */
  at: string;
}

export interface ItemState {
  stage: TrackerStage;
  closedReason: ClosedReason;
  stageSetBy: "system" | "user";
  floor: string | null;
}

const RANK: Record<TrackerStage, number> = { saved: 0, drafting: 1, applied: 2, interviewing: 3, offer: 4, closed: 5 };

/**
 * The automatic moves of PRD 9.1. A reply counts only when it really moved the application's stage (`stageChanged`, classify-email.ts):
 * that carries WP-24's authority gate, so mail that could not move the stage (`stageHeld`) cannot move the card, and a reply to an
 * application still being sent waits. A failed send moves nothing: the card stays and shows its badge.
 */
function target(e: ProjectedEvent): { to: TrackerStage; reason: ClosedReason } | null {
  switch (e.kind) {
    case "drafted":
      return { to: "drafting", reason: null };
    case "sent":
      return { to: "applied", reason: null };
    case "withdrawn":
      return { to: "closed", reason: "withdrawn" };
    case "reply_interview":
    case "reply_assessment":
      return e.payload.stageChanged === true ? { to: "interviewing", reason: null } : null;
    case "reply_offer":
      return e.payload.stageChanged === true ? { to: "offer", reason: null } : null;
    case "reply_rejection":
      return e.payload.stageChanged === true ? { to: "closed", reason: "rejected" } : null;
    default:
      return null;
  }
}

/**
 * One event on one item. Forward only, and an event older than the user's last move is stale (rule 11). The one way back is the
 * user's undo of a stage set by mail (POST /api/applications/:id/stage/clear): it takes back what mail set, to the rung the route
 * chose, and leaves a stage the user chose alone. Its `at` becomes the floor, so a replay of it or of the reply it undid does nothing.
 */
export function applyEvent(s: ItemState, e: ProjectedEvent): ItemState {
  if (s.floor !== null && e.at <= s.floor) return s;
  if (e.kind === "stage_changed") {
    if (e.actor !== "user" || e.payload.undone !== true) return s;
    const setByMail = s.stageSetBy === "system" && (s.stage === "interviewing" || s.stage === "offer" || (s.stage === "closed" && s.closedReason === "rejected"));
    return setByMail ? { stage: e.payload.to === "applied" ? "applied" : "drafting", closedReason: null, stageSetBy: "system", floor: e.at } : { ...s, floor: e.at };
  }
  const t = target(e);
  if (!t || RANK[t.to] <= RANK[s.stage]) return s;
  return { ...s, stage: t.to, closedReason: t.reason, stageSetBy: "system" };
}

/** Rows a pass reads past the cursor, and how far behind the cursor it reads again. */
const BATCH = 500;
const OVERLAP = 1000;
const MAX_BATCHES = 20;
const KINDS = new Set(["drafted", "sent", "withdrawn", "reply_interview", "reply_assessment", "reply_offer", "reply_rejection", "stage_changed"]);
const UTC_TEXT = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;

/**
 * Stage moves from application_events, read by id; no producer changed. An identity id is taken before its transaction commits, so a
 * cursor alone would step over an event that commits late. Each pass therefore reads the last OVERLAP ids again; applyEvent is
 * idempotent on a replay and the floor keeps a replay from undoing a later user move.
 * ponytail: a transaction that stays open while 1000 newer events commit loses its move; settlement and classification hold theirs
 * for milliseconds. Widen OVERLAP if events ever pass tens a second. The card lags the event by up to a minute.
 */
export async function processTrackerProjector(): Promise<{ moved: number }> {
  let moved = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch = await projectBatch();
    moved += batch.moved;
    if (!batch.more) break;
  }
  count("tracker.projected", moved);
  return { moved };
}

async function projectBatch(): Promise<{ moved: number; more: boolean }> {
  return db().transaction(async (tx) => {
    await tx.insert(trackerProjectorState).values({ id: 1 }).onConflictDoNothing();
    // SKIP LOCKED: a slow pass and the next tick never both project.
    const [state] = await tx.select().from(trackerProjectorState).where(eq(trackerProjectorState.id, 1)).for("update", { skipLocked: true });
    if (!state) return { moved: 0, more: false };

    const { rows } = await tx.execute<{ id: string; tracker_item_id: string; kind: string; actor: string; payload: Record<string, unknown>; at_text: string }>(sql`
      SELECT id, tracker_item_id, kind, actor, payload, to_char(at at time zone 'UTC', ${sql.raw(UTC_TEXT)}) AS at_text
        FROM application_events
       WHERE id > ${Math.max(0, state.lastEventId - OVERLAP)}
       ORDER BY id
       LIMIT ${BATCH + OVERLAP}`);
    if (!rows.length) return { moved: 0, more: false };

    const relevant = rows.filter((r) => KINDS.has(r.kind));
    const ids = [...new Set(relevant.map((r) => r.tracker_item_id))];
    const items = ids.length
      ? await tx
          .select({
            id: trackerItems.id,
            stage: trackerItems.stage,
            closedReason: trackerItems.closedReason,
            stageSetBy: trackerItems.stageSetBy,
            floor: sql<string | null>`to_char(${trackerItems.userMovedAt} at time zone 'UTC', ${sql.raw(UTC_TEXT)})`,
          })
          .from(trackerItems)
          .where(inArray(trackerItems.id, ids))
      : [];
    const before = new Map<string, ItemState>(items.map((it) => [it.id, it]));
    const after = new Map(before);
    for (const r of relevant) {
      const s = after.get(r.tracker_item_id);
      if (s) after.set(r.tracker_item_id, applyEvent(s, { kind: r.kind, actor: r.actor, payload: r.payload, at: r.at_text }));
    }

    let moved = 0;
    for (const [id, s] of after) {
      const was = before.get(id)!;
      if (s.stage === was.stage && s.floor === was.floor) continue;
      // Only over what was read: a user's move since then wins, and the next pass reads these events again.
      const done = await tx
        .update(trackerItems)
        .set({
          stage: s.stage,
          closedReason: s.closedReason,
          stageSetBy: s.stageSetBy,
          updatedAt: sql`now()`,
          ...(s.floor !== was.floor ? { userMovedAt: sql`${s.floor}::timestamptz` } : {}),
        })
        .where(and(eq(trackerItems.id, id), eq(trackerItems.stage, was.stage), sql`${trackerItems.userMovedAt} IS NOT DISTINCT FROM ${was.floor}::timestamptz`))
        .returning({ id: trackerItems.id });
      if (done.length && s.stage !== was.stage) moved += 1;
    }

    const last = Number(rows[rows.length - 1]!.id);
    await tx
      .update(trackerProjectorState)
      .set({ lastEventId: Math.max(last, state.lastEventId), updatedAt: sql`now()` })
      .where(eq(trackerProjectorState.id, 1));
    return { moved, more: rows.length === BATCH + OVERLAP };
  });
}
