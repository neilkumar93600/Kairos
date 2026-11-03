import { BREAKER_FAILURES, type LlmErrorCode } from "./errors";
import type { ClaudeModel } from "../agents/types";

/**
 * Circuit breakers per (process, workspace, model), in memory (03-agent-runtime.md 5.3). Only
 * overloaded, server_error, timeout and connection count as failures.
 */

export type BreakerState = "closed" | "open" | "half_open";

interface Breaker {
  consecutiveFailures: number;
  recent: { at: number; failed: boolean }[];
  state: BreakerState;
  openedAt: number;
  openMs: number;
  /** Trips since the breaker last stayed closed for 10 minutes; picks the open period. */
  trips: number;
  closedAt: number;
  /** A half-open breaker lets one call through; this marks it as taken. */
  probing: boolean;
}

/** 30 s, then 60 s, then 120 s on repeated trips (5.3). */
const OPEN_MS = [30_000, 60_000, 120_000] as const;
const TRIP_RESET_MS = 10 * 60_000;

const windows: Map<string, Breaker> = new Map();

const key = (workspace: string, model: string) => `${workspace}:${model}`;

function fresh(): Breaker {
  return { consecutiveFailures: 0, recent: [], state: "closed", openedAt: 0, openMs: OPEN_MS[0], trips: 0, closedAt: 0, probing: false };
}

function get(workspace: string, model: string): Breaker {
  let b = windows.get(key(workspace, model));
  if (!b) {
    b = fresh();
    windows.set(key(workspace, model), b);
  }
  return b;
}

export function breakerState(workspace: "batch" | "interactive", model: ClaudeModel): BreakerState {
  const b = get(workspace, model);
  if (b.state === "open" && Date.now() - b.openedAt >= b.openMs) {
    b.state = "half_open";
    b.probing = false;
  }
  return b.state;
}

/** Returns true when the call may proceed: always when closed, for one probe when half-open, never when open. */
export function allow(workspace: "batch" | "interactive", model: ClaudeModel): boolean {
  const state = breakerState(workspace, model);
  if (state === "closed") return true;
  const b = get(workspace, model);
  if (state === "half_open" && !b.probing) {
    b.probing = true;
    return true;
  }
  return false;
}

function open(b: Breaker, now: number): void {
  if (b.closedAt && now - b.closedAt >= TRIP_RESET_MS) b.trips = 0;
  b.openMs = OPEN_MS[Math.min(b.trips, OPEN_MS.length - 1)]!;
  b.trips += 1;
  b.state = "open";
  b.openedAt = now;
  b.probing = false;
}

export function record(workspace: "batch" | "interactive", model: ClaudeModel, code: LlmErrorCode): void {
  const b = get(workspace, model);
  if (!BREAKER_FAILURES.has(code)) {
    if (b.state === "half_open") b.probing = false; // the probe proved nothing either way; let the next one try
    return;
  }
  const now = Date.now();
  b.recent.push({ at: now, failed: true });
  b.recent = b.recent.filter((r) => now - r.at <= 30_000);
  b.consecutiveFailures += 1;
  if (b.state === "half_open") return open(b, now); // the probe failed
  const failures = b.recent.filter((r) => r.failed).length;
  const tripped = b.consecutiveFailures >= 5 || (b.recent.length >= 20 && failures / b.recent.length >= 0.5);
  if (tripped && b.state === "closed") open(b, now);
}

export function recordSuccess(workspace: "batch" | "interactive", model: ClaudeModel): void {
  const b = get(workspace, model);
  const now = Date.now();
  b.consecutiveFailures = 0;
  b.recent.push({ at: now, failed: false });
  b.recent = b.recent.filter((r) => now - r.at <= 30_000);
  if (b.state === "half_open") {
    b.state = "closed";
    b.closedAt = now;
    b.probing = false;
  }
}

/** Test helper. */
export function resetBreakers(): void {
  windows.clear();
}
