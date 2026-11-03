import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allow, breakerState, record, recordSuccess, resetBreakers } from "../../src/llm/breaker";

/** The breaker of 03-agent-runtime.md 5.3 (llm-agents-17): one per (process, workspace, model). */
const W = "batch" as const;
const M = "claude-haiku-5-5" as const;
const trip = () => {
  for (let i = 0; i < 5; i++) record(W, M, "overloaded");
};

describe("breaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetBreakers();
  });
  afterEach(() => vi.useRealTimers());

  it("opens after 5 consecutive counted failures, and only counted classes trip it", () => {
    for (let i = 0; i < 10; i++) record(W, M, "rate_limited");
    for (let i = 0; i < 10; i++) record(W, M, "schema_invalid");
    expect(allow(W, M)).toBe(true);
    trip();
    expect(breakerState(W, M)).toBe("open");
    expect(allow(W, M)).toBe(false);
  });

  it("the first trip opens for 30 s, then lets exactly one probe through", () => {
    trip();
    vi.advanceTimersByTime(29_000);
    expect(allow(W, M)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(allow(W, M)).toBe(true); // the probe
    expect(allow(W, M)).toBe(false); // everyone else waits for it
    recordSuccess(W, M);
    expect(breakerState(W, M)).toBe("closed");
    expect(allow(W, M)).toBe(true);
  });

  it("a failed probe reopens for 60 s, then 120 s", () => {
    trip();
    vi.advanceTimersByTime(30_000);
    expect(allow(W, M)).toBe(true);
    record(W, M, "timeout");
    expect(breakerState(W, M)).toBe("open");
    vi.advanceTimersByTime(59_000);
    expect(allow(W, M)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(allow(W, M)).toBe(true);
    record(W, M, "server_error");
    vi.advanceTimersByTime(119_000);
    expect(allow(W, M)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(allow(W, M)).toBe(true);
  });

  it("a probe that ends in an uncounted error frees the probe slot instead of wedging half-open", () => {
    trip();
    vi.advanceTimersByTime(30_000);
    expect(allow(W, M)).toBe(true);
    record(W, M, "rate_limited");
    expect(allow(W, M)).toBe(true); // the next probe
  });

  it("the open period resets to 30 s after 10 minutes closed", () => {
    trip();
    vi.advanceTimersByTime(30_000);
    allow(W, M);
    recordSuccess(W, M);
    vi.advanceTimersByTime(10 * 60_000);
    trip();
    vi.advanceTimersByTime(30_000);
    expect(allow(W, M)).toBe(true);
  });
});
