import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseKey } from "../src/lib/storage";
import { fakeR2 } from "./helpers/fake-r2";

const signal = vi.fn();
vi.mock("../src/lib/sentry", () => ({ signal: (...args: unknown[]) => signal(...args) }));

const {
  CURSOR_KEY,
  SETTLE_MS,
  WINDOW_MS,
  parseJournal,
  processJournalReconcile,
  processMoneyJournal,
  windowKey,
} = await import("../src/jobs/money-journal");
type JournalLine = import("../src/jobs/money-journal").JournalLine;

// WP-13, 06-infrastructure 5.4: ids and enums of new ledger rows, application status changes and Stripe events, one
// R2 object per minute of commits, so a dump-only restore can be brought to within 2 minutes of the failure.

const T0 = Date.parse("2026-11-03T14:00:00Z");
const at = (ms: number) => new Date(ms).toISOString().replace("Z", "500Z"); // microseconds, as Postgres prints them

const ledger = (id: string, ms: number): JournalLine => ({
  t: "ledger", id, user: "u1", delta: -1, reason: "submission", application: "a0000000-0000-4000-8000-000000000001", invoice: null, note: null, at: at(ms),
});
const status = (application: string, s: "submitted" | "refunded", ms: number): JournalLine => ({
  t: "status", application, user: "u1", status: s, channel: "cloud", submitted_at: s === "submitted" ? at(ms) : null, at: at(ms),
});
const stripe = (id: string, ms: number): JournalLine => ({ t: "stripe", id, type: "invoice.paid", at: at(ms) });

/** The database: the rows whose timestamp falls in [from, to), as the three range queries return them. */
function fakeDb(rows: JournalLine[]) {
  const read = vi.fn(async (from: number, to: number) => rows.filter((r) => Date.parse(r.at) >= from && Date.parse(r.at) < to));
  return { rows, read };
}

const body = (r: ReturnType<typeof fakeR2>, key: string) => r.objects.get(`kairos-backups|${key.split("/").slice(1).join("/")}`);
const puts = (r: ReturnType<typeof fakeR2>, prefix: string) => r.calls.filter((c) => c.command === "PutObjectCommand" && c.key?.startsWith(prefix));

beforeEach(() => signal.mockReset());

describe("journal keys", () => {
  it("names one object per minute under journal/, inside the backups bucket's lifecycle prefix", () => {
    expect(windowKey(T0 + 2 * WINDOW_MS)).toBe("backups/journal/20261103T1402Z.ndjson");
    expect(parseKey(windowKey(T0))).toEqual({ bucket: "backups", owner: "journal", name: "20261103T1400Z.ndjson" });
    expect(parseKey(CURSOR_KEY)).toMatchObject({ bucket: "backups", owner: "journal" });
  });
});

describe("processMoneyJournal", () => {
  it("writes every closed window since the cursor, empty ones too, and moves the cursor", async () => {
    const r2 = fakeR2();
    const db = fakeDb([ledger("l1", T0 + 5_000), status("a1", "submitted", T0 + 65_000), stripe("evt_1", T0 + 70_000)]);
    await r2.storage.put(CURSOR_KEY, JSON.stringify({ next: new Date(T0).toISOString() }), "application/json");

    const out = await processMoneyJournal({ store: r2.storage, read: db.read }, T0 + 3 * WINDOW_MS + SETTLE_MS);
    expect(out).toMatchObject({ windows: 3, lines: 3 });
    expect(parseJournal(body(r2, windowKey(T0))!)).toEqual([db.rows[0]]);
    expect(parseJournal(body(r2, windowKey(T0 + WINDOW_MS))!)).toHaveLength(2);
    expect(body(r2, windowKey(T0 + 2 * WINDOW_MS))).toBe("");
    expect(JSON.parse(body(r2, CURSOR_KEY)!)).toEqual({ next: new Date(T0 + 3 * WINDOW_MS).toISOString() });
    // One query for the whole range, not one per window.
    expect(db.read).toHaveBeenCalledTimes(1);
  });

  it("waits SETTLE_MS after a window closes, so its last transactions have committed", async () => {
    const r2 = fakeR2();
    await r2.storage.put(CURSOR_KEY, JSON.stringify({ next: new Date(T0).toISOString() }), "application/json");
    const db = fakeDb([]);
    expect(await processMoneyJournal({ store: r2.storage, read: db.read }, T0 + WINDOW_MS + SETTLE_MS - 1)).toMatchObject({ windows: 0 });
    expect(await processMoneyJournal({ store: r2.storage, read: db.read }, T0 + WINDOW_MS + SETTLE_MS)).toMatchObject({ windows: 1 });
  });

  it("re-running a window writes the same object, and writes nothing when nothing changed", async () => {
    const r2 = fakeR2();
    const db = fakeDb([ledger("l2", T0 + 30_000), ledger("l1", T0 + 10_000), stripe("evt_1", T0 + 20_000)]);
    const reset = () => r2.storage.put(CURSOR_KEY, JSON.stringify({ next: new Date(T0).toISOString() }), "application/json");
    await reset();
    await processMoneyJournal({ store: r2.storage, read: db.read }, T0 + WINDOW_MS + SETTLE_MS);
    const first = body(r2, windowKey(T0));
    await reset();
    await processMoneyJournal({ store: r2.storage, read: db.read }, T0 + WINDOW_MS + SETTLE_MS);
    expect(body(r2, windowKey(T0))).toBe(first);
    expect(puts(r2, "journal/2026")).toHaveLength(1);
  });

  it("starts with the latest closed window when there is no cursor", async () => {
    const r2 = fakeR2();
    const out = await processMoneyJournal({ store: r2.storage, read: fakeDb([]).read }, T0 + 10 * WINDOW_MS + SETTLE_MS);
    expect(out).toMatchObject({ windows: 1 });
    expect(body(r2, windowKey(T0 + 9 * WINDOW_MS))).toBe("");
  });

  it("catches up at most an hour per run after an outage", async () => {
    const r2 = fakeR2();
    await r2.storage.put(CURSOR_KEY, JSON.stringify({ next: new Date(T0).toISOString() }), "application/json");
    const out = await processMoneyJournal({ store: r2.storage, read: fakeDb([]).read }, T0 + 3 * 3600_000);
    expect(out).toMatchObject({ windows: 60 });
    expect(JSON.parse(body(r2, CURSOR_KEY)!)).toEqual({ next: new Date(T0 + 3600_000).toISOString() });
  });

  it("carries ids, enums and times only: no names, emails or text", async () => {
    const r2 = fakeR2();
    await r2.storage.put(CURSOR_KEY, JSON.stringify({ next: new Date(T0).toISOString() }), "application/json");
    const db = fakeDb([ledger("l1", T0), status("a1", "submitted", T0), stripe("evt_1", T0)]);
    await processMoneyJournal({ store: r2.storage, read: db.read }, T0 + WINDOW_MS + SETTLE_MS);
    const keys = parseJournal(body(r2, windowKey(T0))!).flatMap((l) => Object.keys(l));
    expect(new Set(keys)).toEqual(new Set(["t", "id", "user", "delta", "reason", "application", "invoice", "note", "at", "status", "channel", "submitted_at", "type"]));
  });

  it("does nothing on a process without the backups bucket", async () => {
    expect(await processMoneyJournal(null)).toEqual({ skipped: "no backups bucket" });
  });
});

describe("parseJournal", () => {
  it("refuses a line that is not one of the three shapes, so a tampered object cannot reach the replay", () => {
    expect(() => parseJournal('{"t":"ledger","id":"x"}\n')).toThrow(/line 1/);
    expect(() => parseJournal(`${JSON.stringify(ledger("l1", T0))}\nnot json\n`)).toThrow(/line 2/);
  });
});

describe("processJournalReconcile", () => {
  it("merges a row committed after its window was written, keeps what was there, and reports it", async () => {
    const r2 = fakeR2();
    await r2.storage.put(CURSOR_KEY, JSON.stringify({ next: new Date(T0).toISOString() }), "application/json");
    const db = fakeDb([status("a1", "submitted", T0 + 1_000)]);
    const now = T0 + WINDOW_MS + SETTLE_MS;
    await processMoneyJournal({ store: r2.storage, read: db.read }, now);
    // The application moved on (its row now sits in a later window), and a ledger row of window 0 committed late.
    db.rows[0] = status("a1", "refunded", T0 + 2 * WINDOW_MS);
    db.rows.push(ledger("late", T0 + 2_000));

    const out = await processJournalReconcile({ store: r2.storage, read: db.read }, now + 60_000);
    expect(out).toMatchObject({ late: 1 });
    const lines = parseJournal(body(r2, windowKey(T0))!);
    expect(lines.map((l) => ("id" in l ? l.id : l.status))).toEqual(["late", "submitted"]);
    expect(signal).toHaveBeenCalledWith("journal_late_rows", 1);
  });

  it("fills windows that were never written and reports the gap", async () => {
    const r2 = fakeR2();
    await r2.storage.put(CURSOR_KEY, JSON.stringify({ next: new Date(T0 + 3 * WINDOW_MS).toISOString() }), "application/json");
    const out = await processJournalReconcile({ store: r2.storage, read: fakeDb([ledger("l1", T0 + WINDOW_MS)]).read }, T0 + 3 * WINDOW_MS + SETTLE_MS);
    expect(out).toMatchObject({ created: 120 });
    expect(parseJournal(body(r2, windowKey(T0 + WINDOW_MS))!)).toHaveLength(1);
    expect(signal).toHaveBeenCalledWith("journal_gaps_filled", 120);
  });

  it("reports a journal whose cursor stopped moving", async () => {
    const r2 = fakeR2();
    await r2.storage.put(CURSOR_KEY, JSON.stringify({ next: new Date(T0).toISOString() }), "application/json");
    await processJournalReconcile({ store: r2.storage, read: fakeDb([]).read }, T0 + 11 * 60_000);
    expect(signal).toHaveBeenCalledWith("journal_stalled");
    signal.mockReset();
    await processJournalReconcile({ store: fakeR2().storage, read: fakeDb([]).read }, T0);
    expect(signal).toHaveBeenCalledWith("journal_stalled");
  });
});
