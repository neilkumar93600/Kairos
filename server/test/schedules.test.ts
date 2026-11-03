import { describe, expect, it } from "vitest";
import { processMaintenance, SCHEDULES } from "../src/jobs/schedules";

// WP-09: every repeatable job is one entry of SCHEDULES, upserted by the worker at boot. The cadences are what the
// acceptance times rest on, so they are pinned here.
const byId = Object.fromEntries(SCHEDULES.map((s) => [s.id, s]));

describe("job schedules", () => {
  it("ids are unique, and every maintenance scheduler names a task", () => {
    expect(new Set(SCHEDULES.map((s) => s.id)).size).toBe(SCHEDULES.length);
    for (const s of SCHEDULES) expect(s.queue === "maintenance", s.id).toBe(Boolean(s.run));
  });

  it("keeps the schedulers that predate the list, by id and cadence", () => {
    expect(byId["schedule-board-polls"]).toMatchObject({ queue: "poll-boards", repeat: { every: 60_000 } });
    expect(byId["cost-rollup"]).toMatchObject({ queue: "cost-rollup", repeat: { every: 60_000 } });
    expect(byId["ledger-watch"]).toMatchObject({ queue: "ledger-watch", repeat: { every: 15 * 60_000 } });
  });

  it("llm_calls partitions are kept daily at 03:00 UTC (ensure, default check, drop)", () => {
    expect(byId["llm-partitions"]).toMatchObject({ queue: "maintenance", repeat: { pattern: "0 3 * * *", tz: "UTC" } });
  });

  it("an unknown maintenance job fails instead of passing silently", async () => {
    await expect(processMaintenance({ name: "nope" } as never)).rejects.toThrow(/nope/);
  });
});
