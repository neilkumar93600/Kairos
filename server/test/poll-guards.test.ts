import { describe, expect, it } from "vitest";
import { backoffDelayMs, decideListing, nextPollDelayMs } from "../src/jobs/poll-boards";

const MIN = 60_000;

describe("decideListing (01-ingest-poller 3.3)", () => {
  it("trusts any listing when nothing is open", () => {
    expect(decideListing(0, 0, 0)).toEqual({ trusted: true });
    expect(decideListing(0, 1500, 0)).toEqual({ trusted: true });
  });

  it("holds back an empty listing and a truncated one on the first sighting, and believes the second", () => {
    expect(decideListing(3, 0, 0)).toEqual({ trusted: false, kind: "empty" });
    expect(decideListing(3, 0, 1)).toEqual({ trusted: true });
    expect(decideListing(100, 40, 0)).toEqual({ trusted: false, kind: "shrink" });
    expect(decideListing(100, 40, 1)).toEqual({ trusted: true });
  });

  it("applies the shrink guard at its boundaries: 50% and 10 open jobs", () => {
    expect(decideListing(100, 50, 0)).toEqual({ trusted: true });
    expect(decideListing(100, 49, 0)).toEqual({ trusted: false, kind: "shrink" });
    expect(decideListing(10, 4, 0)).toEqual({ trusted: false, kind: "shrink" });
    expect(decideListing(9, 1, 0)).toEqual({ trusted: true });
  });
});

describe("nextPollDelayMs", () => {
  const low = () => 0;
  const high = () => 1;

  it("standard 30 and priority 5 minutes, within 5%", () => {
    expect(nextPollDelayMs({ kind: "ok", priority: false, firstPoll: false }, low)).toBe(28.5 * MIN);
    expect(nextPollDelayMs({ kind: "ok", priority: false, firstPoll: false }, high)).toBe(31.5 * MIN);
    expect(nextPollDelayMs({ kind: "ok", priority: true, firstPoll: false }, low)).toBe(4.75 * MIN);
  });

  it("spreads a first poll over the cycle, so a seeded population does not burst", () => {
    expect(nextPollDelayMs({ kind: "ok", priority: false, firstPoll: true }, low)).toBe(15 * MIN);
    expect(nextPollDelayMs({ kind: "ok", priority: false, firstPoll: true }, high)).toBe(45 * MIN);
  });

  it("confirms a suspect poll 27 to 33 minutes later", () => {
    expect(nextPollDelayMs({ kind: "suspect" }, low)).toBe(27 * MIN);
    expect(nextPollDelayMs({ kind: "suspect" }, high)).toBeCloseTo(33 * MIN);
  });

  it("doubles after each error up to 6 hours", () => {
    const at = (n: number) => nextPollDelayMs({ kind: "error", priority: false, consecutiveErrors: n }, () => 0.5);
    expect([at(1), at(2), at(3), at(4), at(5), at(50)]).toEqual([30, 60, 120, 240, 360, 360].map((m) => m * MIN));
    expect(nextPollDelayMs({ kind: "error", priority: true, consecutiveErrors: 1 }, () => 0.5)).toBe(5 * MIN);
  });
});

describe("backoffDelayMs (scale-v04)", () => {
  it("runs 15, 30, 60, 120 minutes by level, and stays at 120", () => {
    expect([1, 2, 3, 4, 9].map((l) => backoffDelayMs(l) / MIN)).toEqual([15, 30, 60, 120, 120]);
  });

  it("honours a longer Retry-After, up to an hour, and never shortens the ladder", () => {
    expect(backoffDelayMs(1, 40 * MIN)).toBe(40 * MIN);
    expect(backoffDelayMs(1, 5 * MIN)).toBe(15 * MIN);
    expect(backoffDelayMs(1, 24 * 60 * MIN)).toBe(60 * MIN);
    expect(backoffDelayMs(4, 40 * MIN)).toBe(120 * MIN);
  });
});
