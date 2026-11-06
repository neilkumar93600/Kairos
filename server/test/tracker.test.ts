import { describe, expect, it } from "vitest";
import { INSIGHTS_MIN_SAMPLE, type TrackerStage } from "@auto-career/shared";
import { applyEvent, type ItemState, type ProjectedEvent } from "../src/jobs/tracker-projector";
import { foldLine, icsText, interviewIcs } from "../src/lib/ics";
import { encodeCursor, pageParams } from "../src/lib/pagination";
import { checkMove, summarizeInsights, type SentRow } from "../src/services/tracker";

const reason = (from: TrackerStage, to: TrackerStage, status: string | null) => {
  try {
    checkMove(from, to, status);
    return null;
  } catch (err) {
    const e = err as { status: number; code: string; message: string; details: { reason: string } };
    expect(e.status).toBe(409);
    expect(e.code).toBe("stage_owned_by_pipeline");
    return e.details.reason;
  }
};

describe("checkMove (PRD 9.1)", () => {
  it.each(["draft", "approved", "submitting", "failed", "withdrawn"])("refuses Applied for a Kairos application that is %s", (status) => {
    expect(reason("drafting", "applied", status)).toBe("approve_in_review_queue");
  });

  it("a submitted application may go back to Applied, the only way back from a mis-drag", () => {
    expect(reason("saved", "applied", "submitted")).toBeNull();
  });

  it.each(["approved", "submitting"])("refuses Closed while %s, and says to withdraw", (status) => {
    expect(reason("drafting", "closed", status)).toBe("withdraw_first");
  });

  it("allows the free stages for any application, and Closed for a draft", () => {
    for (const to of ["saved", "interviewing", "offer"] as const) expect(reason("drafting", to, "approved")).toBeNull();
    expect(reason("drafting", "closed", "draft")).toBeNull();
  });

  it("Drafting follows real state", () => {
    expect(reason("saved", "drafting", "draft")).toBeNull();
    expect(reason("saved", "drafting", "failed")).toBeNull();
    expect(reason("saved", "drafting", "approved")).toBe("pipeline_stage");
    expect(reason("saved", "drafting", "submitted")).toBe("pipeline_stage");
  });

  it("an item with no application can go to Applied but not Drafting", () => {
    expect(reason("saved", "applied", null)).toBeNull();
    expect(reason("saved", "drafting", null)).toBe("pipeline_stage");
  });

  it("staying put is never refused", () => {
    expect(reason("applied", "applied", "approved")).toBeNull();
  });
});

const at = (n: number) => `2026-11-06T10:00:${String(n).padStart(2, "0")}.000000Z`;
const ev = (kind: string, n: number, payload: Record<string, unknown> = {}, actor = "system"): ProjectedEvent => ({ kind, actor, payload, at: at(n) });
const start = (over: Partial<ItemState> = {}): ItemState => ({ stage: "saved", closedReason: null, stageSetBy: "system", floor: null, ...over });
const moved = { stageChanged: true };
const run = (s: ItemState, ...events: ProjectedEvent[]) => events.reduce(applyEvent, s);

describe("applyEvent (rule 11)", () => {
  it("walks the pipeline forward", () => {
    let s = run(start(), ev("drafted", 1));
    expect(s.stage).toBe("drafting");
    s = run(s, ev("sent", 2));
    expect(s.stage).toBe("applied");
    s = run(s, ev("reply_interview", 3, moved));
    expect(s.stage).toBe("interviewing");
    s = run(s, ev("reply_offer", 4, moved));
    expect(s.stage).toBe("offer");
    expect(run(s, ev("reply_rejection", 5, moved))).toMatchObject({ stage: "closed", closedReason: "rejected" });
  });

  it("an assessment is Interviewing, a withdrawal closes with its reason, a failure and a confirmation move nothing", () => {
    expect(run(start({ stage: "applied" }), ev("reply_assessment", 1, moved)).stage).toBe("interviewing");
    expect(run(start({ stage: "drafting" }), ev("withdrawn", 1))).toMatchObject({ stage: "closed", closedReason: "withdrawn" });
    expect(run(start({ stage: "drafting" }), ev("failed", 1)).stage).toBe("drafting");
    expect(run(start({ stage: "applied" }), ev("reply_confirmation", 1, moved)).stage).toBe("applied");
  });

  it("never moves back, and never over a later stage the user set", () => {
    expect(run(start({ stage: "interviewing" }), ev("sent", 1)).stage).toBe("interviewing");
    expect(run(start({ stage: "offer", stageSetBy: "user" }), ev("reply_interview", 1, moved)).stage).toBe("offer");
    expect(run(start({ stage: "closed", closedReason: "not_pursuing", stageSetBy: "user" }), ev("reply_offer", 1, moved))).toMatchObject({ stage: "closed", closedReason: "not_pursuing" });
  });

  it("a reply that did not move the application's stage does not move the card: held by the authority gate, or not sent yet", () => {
    const held = { stageChanged: false, stageHeld: true, authenticated: false };
    expect(run(start({ stage: "applied" }), ev("reply_rejection", 1, held)).stage).toBe("applied");
    expect(run(start({ stage: "applied" }), ev("reply_offer", 1, held)).stage).toBe("applied");
    expect(run(start({ stage: "drafting" }), ev("reply_interview", 1, { stageChanged: false })).stage).toBe("drafting");
  });

  it("an event older than the user's last move is stale", () => {
    expect(run(start({ floor: at(5) }), ev("drafted", 4)).stage).toBe("saved");
    expect(run(start({ floor: at(5) }), ev("drafted", 6)).stage).toBe("drafting");
  });

  it("the user's undo takes back what mail set, and a replay of the pass changes nothing", () => {
    const reply = ev("reply_rejection", 2, moved);
    const undo = ev("stage_changed", 3, { from: "rejected", to: "applied", undone: true }, "user");
    const once = run(start({ stage: "applied" }), reply, undo);
    expect(once).toEqual({ stage: "applied", closedReason: null, stageSetBy: "system", floor: at(3) });
    // The next pass reads the same ids again, over the row it wrote.
    expect(run(once, reply, undo)).toEqual(once);
    // A clear with no sent application goes back to Drafting.
    expect(run(start({ stage: "offer" }), ev("stage_changed", 3, { from: "offer", to: null, undone: true }, "user")).stage).toBe("drafting");
  });

  it("the undo leaves a stage the user chose, or a close that was not mail's", () => {
    const undo = ev("stage_changed", 3, { to: "applied", undone: true }, "user");
    expect(run(start({ stage: "offer", stageSetBy: "user" }), undo)).toMatchObject({ stage: "offer", floor: at(3) });
    expect(run(start({ stage: "closed", closedReason: "withdrawn" }), undo)).toMatchObject({ stage: "closed", closedReason: "withdrawn" });
  });

  it("a user's own move event is the route's, not the projector's", () => {
    expect(run(start({ stage: "offer" }), ev("stage_changed", 1, { from: "saved", to: "offer" }, "user")).stage).toBe("offer");
  });
});

const sent = (n: number, over: Partial<SentRow> = {}): SentRow[] => Array.from({ length: n }, () => ({ firstReplyDays: null, interviewed: false, offered: false, resumeId: null, resumeName: null, ...over }));

describe("summarizeInsights (PRD 9.6)", () => {
  it("below 5 sent: counts on every path and no rate, the median included", () => {
    const i = summarizeInsights("30d", sent(INSIGHTS_MIN_SAMPLE - 1, { firstReplyDays: 3, interviewed: true, offered: true, resumeId: "r1", resumeName: "Base" }), {});
    expect(i).toMatchObject({ lowSample: true, sent: 4, replies: 4, interviews: 4, offers: 4, replyRate: null, interviewRate: null, medianDaysToFirstReply: null });
    expect(i.byResume).toEqual([{ resumeId: "r1", name: "Base", sent: 4, replies: 4, replyRate: null }]);
  });

  it("a small group stays counts-only beside a large total", () => {
    const rows = [...sent(5, { firstReplyDays: 2, resumeId: "big", resumeName: "Big" }), ...sent(2, { resumeId: "small", resumeName: "Small" })];
    const i = summarizeInsights("all", rows, {});
    expect(i.lowSample).toBe(false);
    expect(i.replyRate).toBeCloseTo(5 / 7, 3);
    expect(i.byResume.find((g) => g.resumeId === "big")?.replyRate).toBe(1);
    expect(i.byResume.find((g) => g.resumeId === "small")).toMatchObject({ sent: 2, replies: 0, replyRate: null });
  });

  it("the median is of the replies, and is null with none", () => {
    const rows = [...sent(1, { firstReplyDays: 2 }), ...sent(1, { firstReplyDays: 4 }), ...sent(1, { firstReplyDays: 9 }), ...sent(3)];
    expect(summarizeInsights("90d", rows, {}).medianDaysToFirstReply).toBe(4);
    expect(summarizeInsights("90d", sent(6), {}).medianDaysToFirstReply).toBeNull();
  });

  it("the funnel names every stage, in order", () => {
    const f = summarizeInsights("all", [], { applied: 2 }).funnel;
    expect(f.map((x) => x.stage)).toEqual(["saved", "drafting", "applied", "interviewing", "offer", "closed"]);
    expect(f.find((x) => x.stage === "applied")?.count).toBe(2);
  });
});

describe(".ics (RFC 5545)", () => {
  const iv = { id: "i1", startsAt: new Date("2026-11-03T15:00:00.000Z"), durationMinutes: 90, location: "Call, then; dial-in", notes: "Line one\nLine two" };
  const unfold = (ics: string) => ics.replace(/\r\n /g, "");

  it("writes explicit UTC times and escaped text", () => {
    const lines = interviewIcs(iv, "Engineer", "Acme, Inc", new Date("2026-11-01T00:00:00.000Z")).split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("DTSTART:20261103T150000Z");
    expect(lines).toContain("DTEND:20261103T163000Z");
    expect(lines).toContain("DTSTAMP:20261101T000000Z");
    expect(lines).toContain("SUMMARY:Interview: Engineer at Acme\\, Inc");
    expect(lines).toContain("LOCATION:Call\\, then\\; dial-in");
    expect(lines).toContain("DESCRIPTION:Line one\\nLine two");
    expect(lines.at(-1)).toBe("");
  });

  it.each(["x\r\nATTENDEE:mailto:evil@example.com", "x\nBEGIN:VALARM", "x\rEND:VEVENT", "x\u0085\u000bDTSTART:19700101T000000Z"])("user text cannot start a property: %j", (text) => {
    const ics = unfold(interviewIcs({ ...iv, location: text, notes: text }, text, text));
    const props = ics.split("\r\n").map((l) => l.split(/[:;]/)[0]);
    expect(props).not.toContain("ATTENDEE");
    expect(props.filter((p) => p === "END")).toHaveLength(2);
    expect(props.filter((p) => p === "BEGIN")).toHaveLength(2);
    expect(props.filter((p) => p === "DTSTART")).toHaveLength(1);
  });

  it("escapes a backslash first, so an escape cannot be forged", () => {
    expect(icsText("a\\;b")).toBe("a\\\\\\;b");
    expect(icsText("a\\nb")).toBe("a\\\\nb");
  });

  it("folds at 75 octets without splitting a character, and unfolds back", () => {
    const long = "é".repeat(100);
    const folded = foldLine(`SUMMARY:${long}`);
    for (const line of folded.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(folded).not.toContain("�");
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${long}`);
  });
});

describe("pageParams with a bigint id", () => {
  const ts = "2026-11-03T10:00:00.123456Z";
  const page = (cursor: string) => pageParams({ cursor }, 200, "item_events", ["ts"], "bigint");
  const invalid = expect.objectContaining({ status: 400, code: "invalid_param" });

  it("round-trips a cursor of digits", () => {
    expect(page(encodeCursor("item_events", [ts], "42")).after).toEqual({ k: [ts], id: "42" });
  });

  it.each(["abc", "1; drop table x", "-1", "9".repeat(19), "00000000-0000-4000-8000-000000000001"])("refuses the crafted id %s with a 400", (id) => {
    expect(() => page(encodeCursor("item_events", [ts], id))).toThrow(invalid);
  });

  it("a uuid list still refuses digits, and one list refuses another's cursor", () => {
    expect(() => pageParams({ cursor: encodeCursor("contacts", [ts], "42") }, 200, "contacts", ["ts"])).toThrow(invalid);
    expect(() => page(encodeCursor("app_events", [ts], "42"))).toThrow(invalid);
  });
});
