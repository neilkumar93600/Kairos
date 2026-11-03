import { describe, expect, it } from "vitest";
import { loadJournal, planStatus, REPLAY_MARGIN_MS } from "../scripts/journal-replay";
import { WINDOW_MS, windowKey, type JournalLine } from "../src/jobs/money-journal";
import { fakeR2 } from "./helpers/fake-r2";

// R-DR-2: after a restore to an older point, the journal puts the ledger back and stops a sent application from being
// sent again. Only moves the database's own status guard allows, and only into a state nothing resends.

type Status = (JournalLine & { t: "status" })["status"];
const T0 = Date.parse("2026-11-03T14:00:00Z");
const line = (application: string, status: Status, ms: number): JournalLine & { t: "status" } => ({
  t: "status", application, user: "u1", status, channel: "cloud", submitted_at: status === "submitted" ? new Date(ms).toISOString() : null, at: new Date(ms).toISOString(),
});

describe("planStatus", () => {
  it("takes each application's latest journal state", () => {
    const plan = planStatus([line("a1", "submitting", T0 + 2), line("a1", "submitted", T0 + 5), line("a1", "approved", T0 + 1)], new Map([["a1", "approved"]]));
    expect(plan.apply.map((l) => l.status)).toEqual(["submitted"]);
  });

  it("closes what the restore re-opened: sent, in flight, failed or withdrawn after the dump", () => {
    const db = new Map<string, string>([["a1", "approved"], ["a2", "approved"], ["a3", "failed"], ["a4", "approved"], ["a5", "submitting"], ["a6", "draft"]]);
    const plan = planStatus(
      [line("a1", "submitted", T0), line("a2", "submitting", T0), line("a3", "submitted", T0), line("a4", "failed", T0), line("a5", "submitted", T0), line("a6", "withdrawn", T0)],
      db,
    );
    expect(plan.apply.map((l) => `${l.application}:${db.get(l.application)}->${l.status}`)).toEqual([
      "a1:approved->submitted", "a2:approved->submitting", "a3:failed->submitted", "a4:approved->failed", "a5:submitting->submitted", "a6:draft->withdrawn",
    ]);
    expect(plan.differs).toEqual([]);
  });

  it("never approves or re-opens anything: those differences go to the operator", () => {
    const plan = planStatus(
      [line("a1", "approved", T0), line("a2", "draft", T0), line("a3", "submitted", T0), line("a4", "approved", T0)],
      new Map([["a1", "draft"], ["a2", "approved"], ["a3", "withdrawn"], ["a4", "failed"]]),
    );
    expect(plan.apply).toEqual([]);
    expect(plan.differs.map((d) => `${d.application}:${d.db}->${d.journal}`)).toEqual(["a1:draft->approved", "a2:approved->draft", "a3:withdrawn->submitted", "a4:failed->approved"]);
  });

  it("leaves matching rows alone and lists applications the restored database lacks", () => {
    const plan = planStatus([line("a1", "submitted", T0), line("a2", "submitted", T0)], new Map([["a1", "submitted"]]));
    expect(plan).toEqual({ apply: [], differs: [], missing: ["a2"] });
  });
});

describe("loadJournal", () => {
  it("reads every window from the margin before `since`, and names the windows that are missing", async () => {
    const r2 = fakeR2();
    const since = T0 + REPLAY_MARGIN_MS;
    const ledger = { t: "ledger", id: "l1", user: "u1", delta: 5, reason: "plan_grant", application: null, invoice: "in_1", note: null, at: new Date(T0 + 1000).toISOString() };
    await r2.storage.put(windowKey(T0), `${JSON.stringify(ledger)}\n`, "application/x-ndjson");
    for (let w = T0 + WINDOW_MS; w < since + 3 * WINDOW_MS; w += WINDOW_MS) if (w !== since + WINDOW_MS) await r2.storage.put(windowKey(w), "", "application/x-ndjson");

    const out = await loadJournal(r2.storage, since, since + 3 * WINDOW_MS);
    expect(out.lines).toEqual([ledger]);
    expect(out.windows).toBe(13);
    expect(out.gaps).toEqual([new Date(since + WINDOW_MS).toISOString()]);
  });
});
