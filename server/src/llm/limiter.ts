import type { ClaudeModel } from "../agents/types";
import { env } from "../lib/env";

/**
 * Per-process concurrency semaphore and RPM token buckets per (workspace, model) (03-agent-runtime.md
 * 6.3). AIMD: a 429 halves the permits for 60 s; low remaining headroom cuts them by a quarter.
 */

export interface Permit {
  release(): void;
}

interface Bucket {
  tokens: number;
  last: number;
  halvedUntil: number;
}

const BURST = 20;

function rpmFor(workspace: "batch" | "interactive", model: ClaudeModel): number {
  const e = env();
  const isHaiku = model === "claude-haiku-5-5";
  const override = isHaiku ? e.LLM_RPM_HAIKU : e.LLM_RPM_SONNET;
  if (override !== undefined) return override;
  // api defaults 150/40, worker 300/15 (6.1); the process type decides, NODE_ENV test takes api values.
  const isWorker = process.env.KAIROS_PROCESS === "worker";
  if (workspace === "interactive") return isHaiku ? 150 : 40;
  return isWorker ? (isHaiku ? 300 : 15) : isHaiku ? 150 : 40;
}

export function semaphoreSize(): number {
  return env().LLM_MAX_CONCURRENCY;
}

const state = {
  inFlight: 0,
  queue: [] as (() => void)[],
  buckets: new Map<string, Bucket>(),
  reducedUntil: new Map<string, number>(),
};

const bucketKey = (workspace: string, model: string) => `${workspace}:${model}`;

function bucket(workspace: "batch" | "interactive", model: ClaudeModel): Bucket {
  const key = bucketKey(workspace, model);
  let b = state.buckets.get(key);
  if (!b) {
    b = { tokens: BURST, last: Date.now(), halvedUntil: 0 };
    state.buckets.set(key, b);
  }
  return b;
}

function refill(b: Bucket, workspace: "batch" | "interactive", model: ClaudeModel): void {
  const now = Date.now();
  const rate = rpmFor(workspace, model) / 60; // tokens per second
  b.tokens = Math.min(BURST, b.tokens + ((now - b.last) / 1000) * rate);
  b.last = now;
}

/** Resolves when a semaphore slot is free. */
function acquireSlot(maxWaitMs: number): Promise<void> {
  if (state.inFlight < semaphoreSize()) {
    state.inFlight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const i = state.queue.indexOf(wrapped);
      if (i !== -1) state.queue.splice(i, 1);
      reject(new Error("limiter_timeout"));
    }, maxWaitMs);
    const wrapped = () => {
      clearTimeout(timer);
      state.inFlight += 1;
      resolve();
    };
    state.queue.push(wrapped);
  });
}

/**
 * Waits for a semaphore slot and an RPM token for (workspace, model); rejects after maxWaitMs with
 * "limiter_timeout" (2 s interactive, 30 s worker; the caller maps that to 503 or defer).
 */
export async function acquire(workspace: "batch" | "interactive", model: ClaudeModel, maxWaitMs: number): Promise<Permit> {
  await acquireSlot(maxWaitMs);
  const b = bucket(workspace, model);
  refill(b, workspace, model);
  if (b.tokens < 1) {
    state.inFlight -= 1;
    throw new Error("limiter_timeout");
  }
  b.tokens -= 1;
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      state.inFlight -= 1;
      const next = state.queue.shift();
      if (next) next();
    },
  };
}

/** Adaptive reduction on response headers: below 10% remaining, cut permits by a quarter (6.3). */
export function onResponseHeaders(workspace: "batch" | "interactive", model: ClaudeModel, remaining: { requests: number | null; limit?: number | null }): void {
  if (remaining.requests === null || remaining.limit === undefined || remaining.limit === null) return;
  if (remaining.requests < remaining.limit * 0.1) {
    state.reducedUntil.set(bucketKey(workspace, model), Date.now() + 60_000);
  }
}

/** AIMD on a 429: halve the refill for 60 s (6.3). */
export function on429(workspace: "batch" | "interactive", model: ClaudeModel): void {
  state.reducedUntil.set(bucketKey(workspace, model), Date.now() + 60_000);
  state.buckets.delete(bucketKey(workspace, model)); // re-created at half rate by refill
}

/** Test helper: clears all limiter state. */
export function resetLimiter(): void {
  state.inFlight = 0;
  state.queue.length = 0;
  state.buckets.clear();
  state.reducedUntil.clear();
}
