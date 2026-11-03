import { text } from "node:stream/consumers";
import { APPLICATION_STATUSES, CREDIT_REASONS, SUBMIT_CHANNELS } from "@auto-career/shared";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { signal } from "../lib/sentry";
import { storage, storageConfig, type Storage } from "../lib/storage";

/**
 * The money journal (06-infrastructure 5.4, ops-39). Every minute the worker writes the credit_ledger rows, application
 * status changes and processed Stripe events of each closed minute to R2 `backups/journal/<yyyymmddThhmm>Z.ndjson`,
 * ids, enums and times only. After a restore to an older point, scripts/journal-replay.ts puts the ledger back and
 * stops a sent application from being sent again (R-DR-2).
 *
 * One object per minute of commit time, not per run (the spec's `<hhmm>-<executor>`): a window's object is a sorted
 * union of every line ever derived for it, so re-running a window writes the same bytes, two workers write the same
 * object, and a row committed after its window was written is merged by the hourly reconcile without losing a line.
 * 1-minute windows written SETTLE_MS after they close keep the worst case near 1 minute 15 seconds, inside the
 * 2-minute RPO of the plan's Reliability section.
 *
 * ponytail: each run scans credit_ledger (created_at), applications (updated_at) and stripe_events (processed_at) for
 * the range; none has an index on that column. Fine at beta size, like ledger-watch. Add BRIN indexes on the two
 * append-only tables and a btree on applications.updated_at when any of them nears a million rows.
 */

export const WINDOW_MS = 60_000;
/** A window is written this long after it closes, so the transactions of its last seconds have committed. */
export const SETTLE_MS = 15_000;
/** Windows per run: after an outage the journal catches up an hour a minute. */
const MAX_WINDOWS = 60;
/** The reconcile re-derives this much history before the cursor (late commits, gaps). */
const RECONCILE_MS = 2 * 3600_000;
/** A cursor this far behind means the journal job has stopped. */
const STALE_MS = 10 * 60_000;

export const CURSOR_KEY = "backups/journal/cursor.json";

/** "2026-11-03T14:02:00.000Z" -> backups/journal/20261103T1402Z.ndjson; keys sort by time. */
export const windowKey = (start: number) => `backups/journal/${new Date(start).toISOString().slice(0, 16).replace(/[-:]/g, "")}Z.ndjson`;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,255}$/);
const time = z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,6})?Z$/);
const lineSchema = z.discriminatedUnion("t", [
  z.strictObject({
    t: z.literal("ledger"),
    id,
    user: id,
    delta: z.number().int(),
    reason: z.enum(CREDIT_REASONS),
    application: id.nullable(),
    invoice: id.nullable(),
    // credit_ledger_note_ck: a code, never free text.
    note: z.string().regex(/^[A-Za-z0-9 _:=.,/#-]{1,200}$/).nullable(),
    at: time,
  }),
  z.strictObject({
    t: z.literal("status"),
    application: id,
    user: id,
    status: z.enum(APPLICATION_STATUSES),
    channel: z.enum(SUBMIT_CHANNELS).nullable(),
    submitted_at: time.nullable(),
    at: time,
  }),
  z.strictObject({ t: z.literal("stripe"), id, type: z.string().regex(/^[a-z0-9_.]{1,100}$/), at: time }),
]);
export type JournalLine = z.infer<typeof lineSchema>;

/** One journal object's lines. Throws on any line that is not one of the three shapes. */
export function parseJournal(ndjson: string): JournalLine[] {
  return ndjson
    .split("\n")
    .filter(Boolean)
    .map((line, i) => {
      try {
        return lineSchema.parse(JSON.parse(line));
      } catch {
        throw new Error(`journal line ${i + 1} is not a ledger, status or stripe line`);
      }
    });
}

const UTC_TEXT = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;
const ts = (column: string) => sql.raw(`to_char(${column} at time zone 'UTC', ${UTC_TEXT})`);

/** The three tables' rows whose time falls in [from, to), as journal lines. Timestamps keep their microseconds. */
export async function readJournalRows(from: number, to: number): Promise<JournalLine[]> {
  const [lo, hi] = [new Date(from).toISOString(), new Date(to).toISOString()];
  const run = async (query: ReturnType<typeof sql>) => (await db().execute(query)).rows as Record<string, unknown>[];
  const [ledger, status, stripe] = await Promise.all([
    run(sql`select id, user_id, delta, reason, application_id, stripe_invoice_id, note, ${ts("created_at")} as at
      from credit_ledger where created_at >= ${lo}::timestamptz and created_at < ${hi}::timestamptz`),
    run(sql`select id, user_id, status, channel, ${ts("submitted_at")} as submitted_at, ${ts("updated_at")} as at
      from applications where updated_at >= ${lo}::timestamptz and updated_at < ${hi}::timestamptz`),
    run(sql`select id, type, ${ts("processed_at")} as at
      from stripe_events where processed_at >= ${lo}::timestamptz and processed_at < ${hi}::timestamptz`),
  ]);
  const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return [
    ...ledger.map((r): JournalLine => ({
      t: "ledger", id: String(r.id), user: String(r.user_id), delta: Number(r.delta), reason: r.reason as (typeof CREDIT_REASONS)[number],
      application: s(r.application_id), invoice: s(r.stripe_invoice_id), note: s(r.note), at: String(r.at),
    })),
    ...status.map((r): JournalLine => ({
      t: "status", application: String(r.id), user: String(r.user_id), status: r.status as (typeof APPLICATION_STATUSES)[number],
      channel: s(r.channel) as (typeof SUBMIT_CHANNELS)[number] | null, submitted_at: s(r.submitted_at), at: String(r.at),
    })),
    ...stripe.map((r): JournalLine => ({ t: "stripe", id: String(r.id), type: String(r.type), at: String(r.at) })),
  ];
}

export interface JournalDeps {
  store: Pick<Storage, "get" | "put">;
  read: (from: number, to: number) => Promise<JournalLine[]>;
}

/** The worker's journal deps, or null on a process that holds no backups token (local, or before owner-actions/WP-14). */
function defaultDeps(): JournalDeps | null {
  return storageConfig(env()).buckets.backups ? { store: storage(), read: readJournalRows } : null;
}

async function getText(store: JournalDeps["store"], key: string): Promise<string | null> {
  const file = await store.get(key);
  return file ? text(file.body) : null;
}

async function readCursor(store: JournalDeps["store"]): Promise<number | null> {
  const raw = await getText(store, CURSOR_KEY);
  const next = raw === null ? NaN : Date.parse((JSON.parse(raw) as { next?: string }).next ?? "");
  return Number.isFinite(next) ? next : null;
}

/** Merges `lines` into the window's object; writes only when the window is new or gained a line. */
async function mergeWindow(store: JournalDeps["store"], start: number, lines: JournalLine[]) {
  const key = windowKey(start);
  const old = await getText(store, key);
  const before = old === null ? [] : old.split("\n").filter(Boolean);
  const merged = [...new Set([...before, ...lines.map((l) => JSON.stringify(l))])].sort();
  const added = merged.length - before.length;
  if (old === null || added > 0) await store.put(key, merged.map((l) => `${l}\n`).join(""), "application/x-ndjson");
  return { created: old === null, added };
}

/** Writes every window in [from, to) from one read of the range. `late` counts lines added to windows already written. */
async function journalRange(deps: JournalDeps, from: number, to: number) {
  const lines = await deps.read(from, to);
  const byWindow = new Map<number, JournalLine[]>();
  for (const line of lines) {
    const start = Math.floor(Date.parse(line.at) / WINDOW_MS) * WINDOW_MS;
    byWindow.set(start, [...(byWindow.get(start) ?? []), line]);
  }
  let [windows, created, late] = [0, 0, 0];
  for (let start = from; start < to; start += WINDOW_MS, windows++) {
    const r = await mergeWindow(deps.store, start, byWindow.get(start) ?? []);
    if (r.created) created++;
    else late += r.added;
  }
  return { windows, lines: lines.length, created, late };
}

/** Every minute: the closed windows since the cursor, then the cursor. Safe on two workers at once. */
export async function processMoneyJournal(deps: JournalDeps | null = defaultDeps(), now = Date.now()) {
  if (!deps) return { skipped: "no backups bucket" };
  const closed = Math.floor((now - SETTLE_MS) / WINDOW_MS) * WINDOW_MS;
  const cursor = (await readCursor(deps.store)) ?? closed - WINDOW_MS;
  const to = Math.min(closed, cursor + MAX_WINDOWS * WINDOW_MS);
  if (to <= cursor) return { windows: 0, lines: 0 };
  const out = await journalRange(deps, cursor, to);
  await deps.store.put(CURSOR_KEY, JSON.stringify({ next: new Date(to).toISOString() }), "application/json");
  return out;
}

/**
 * Hourly: re-derives the two hours before the cursor. Merges rows that committed after their window was written
 * (journal_late_rows) and writes windows that were never written (journal_gaps_filled; the first run after deploy fills
 * the two hours before the journal started), and reports a cursor that stopped moving (journal_stalled).
 */
export async function processJournalReconcile(deps: JournalDeps | null = defaultDeps(), now = Date.now()) {
  if (!deps) return { skipped: "no backups bucket" };
  const cursor = await readCursor(deps.store);
  if (cursor === null || now - cursor > STALE_MS) {
    logger.error({ cursor: cursor && new Date(cursor).toISOString() }, "money journal stalled");
    signal("journal_stalled");
    if (cursor === null) return { stalled: true };
  }
  const out = await journalRange(deps, cursor - RECONCILE_MS, cursor);
  if (out.late) {
    logger.warn({ late: out.late }, "money journal: rows committed after their window was written");
    signal("journal_late_rows", out.late);
  }
  if (out.created) {
    logger.warn({ windows: out.created }, "money journal: unwritten windows filled");
    signal("journal_gaps_filled", out.created);
  }
  return out;
}
