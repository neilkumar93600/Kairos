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
}

const windows: Map<string, Breaker> = new Map();

const key = (workspace: string, model: string) => `${workspace}:${model}`;

function fresh(): Breaker {
  return { consecutiveFailures: 0, recent: [], state: "closed", openedAt: 0, openMs: 30_000 };
}

export function breakerState(workspace: "batch" | "interactive", model: ClaudeModel): BreakerState {
  const b = windows.get(key(workspace, model)) ?? fresh();
  if (b.state === "open" && Date.now() - b.openedAt >= b.openMs) {
    b.state = "half_open"; // one probe passes; the others behave as open
  }
  windows.set(key(workspace, model), b);
  return b.state;
}

/** Returns true when the call may proceed. */
export function allow(workspace: "batch" | "interactive", model: ClaudeModel): boolean {
  const state = breakerState(workspace, model);
  if (state === "closed") return true;
  if (state === "half_open") return true; // the probe; concurrent calls see the state after this one settles
  return false;
}

export function record(workspace: "batch" | "interactive", model: ClaudeModel, code: LlmErrorCode): void {
  if (!BREAKER_FAILURES.has(code)) return;
  const b = windows.get(key(workspace, model)) ?? fresh();
  const now = Date.now();
  b.recent.push({ at: now, failed: true });
  b.recent = b.recent.filter((r) => now - r.at <= 30_000);
  b.consecutiveFailures += 1;
  const failures = b.recent.filter((r) => r.failed).length;
  const tripped = b.consecutiveFailures >= 5 || (b.recent.length >= 20 && failures / b.recent.length >= 0.5);
  if (tripped && b.state !== "open") {
    b.state = "open";
    b.openedAt = now;
    b.openMs = Math.min(b.openMs * 2, 120_000); // 30 s, then 60 s, then 120 s on repeated trips
  }
  windows.set(key(workspace, model), b);
}

export function recordSuccess(workspace: "batch" | "interactive", model: ClaudeModel): void {
  const b = windows.get(key(workspace, model));
  if (!b) return;
  b.consecutiveFailures = 0;
  b.recent.push({ at: Date.now(), failed: false });
  b.recent = b.recent.filter((r) => Date.now() - r.at <= 30_000);
  if (b.state === "half_open") {
    b.state = "closed";
    b.openMs = 30_000;
  }
}

/** Test helper. */
export function resetBreakers(): void {
  windows.clear();
}
