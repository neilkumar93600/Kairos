import { describe, expect, it } from "vitest";
import { applicationEventSchema } from "@auto-career/shared";
import { DB_EVENT_KINDS } from "../src/db/schema";
import { toApiEvent } from "../src/services/events";

/** toApiEvent: every stored kind answers the shared applicationEventSchema, or stays off the timeline (WP-42 review). */
describe("toApiEvent", () => {
  const row = (kind: (typeof DB_EVENT_KINDS)[number]) => ({
    id: 7,
    trackerItemId: "6f1c1a3e-2b4d-4c5e-8f9a-1b2c3d4e5f60",
    applicationId: null,
    userId: "u1",
    kind,
    actor: "system" as const,
    source: "system" as const,
    payload: { attemptNo: 1 },
    dedupeKey: null,
    at: new Date("2026-11-03T10:00:00Z"),
  });

  it.each(DB_EVENT_KINDS)("maps %s to the shared contract or hides it", (kind) => {
    const event = toApiEvent(row(kind));
    if (["verified", "edited", "gone_quiet", "reminder_sent"].includes(kind)) expect(event).toBeNull();
    else expect(applicationEventSchema.parse(event)).toEqual(event);
  });

  it("keeps what the stored kind adds in the payload", () => {
    expect(toApiEvent(row("sent"))).toMatchObject({ id: "7", kind: "submitted", payload: { attemptNo: 1 }, at: "2026-11-03T10:00:00.000Z" });
    expect(toApiEvent(row("reply_offer"))).toMatchObject({ kind: "reply_routed", payload: { attemptNo: 1, replyKind: "offer" } });
    expect(toApiEvent(row("auto_approved"))).toMatchObject({ kind: "approved", payload: { autopilot: true } });
  });
});
