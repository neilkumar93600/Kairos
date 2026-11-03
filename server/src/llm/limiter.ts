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
}

const BURST = 20;
const REDUCED_MS = 60_000;

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
  /** AIMD (6.3): a refill multiplier and when it ends, per (workspace, model). */
  reduced: new Map<string, { factor: number; until: number }>(),
};

const bucketKey = (workspace: string, model: string) => `${workspace}:${model}`;

function bucket(workspace: "batch" | "interactive", model: ClaudeModel): Bucket {
  const key = bucketKey(workspace, model);
  let b = state.buckets.get(key);
  if (!b) {
    b = { tokens: BURST, last: Date.now() };
    state.buckets.set(key, b);
  }
  return b;
}

/** Tokens per millisecond right now: the RPM, times the AIMD factor while one is active. */
function rateNow(workspace: "batch" | "interactive", model: ClaudeModel): number {
  const r = state.reduced.get(bucketKey(workspace, model));
  const factor = r && Date.now() < r.until ? r.factor : 1;
  return (rpmFor(workspace, model) * factor) / 60_000;
}

function refill(b: Bucket, workspace: "batch" | "interactive", model: ClaudeModel): void {
  const now = Date.now();
  b.tokens = Math.min(BURST, b.tokens + (now - b.last) * rateNow(workspace, model));
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

function releaseSlot(): void {
  state.inFlight -= 1;
  const next = state.queue.shift();
  if (next) next();
}

/**
 * Waits for an RPM token for (workspace, model), then a semaphore slot; rejects after maxWaitMs with
 * "limiter_timeout" (2 s interactive, 30 s worker; the caller maps that to 503 or defer). The token comes first so a
 * call waiting on one model's bucket never holds a slot the other model could use; a slot timeout gives the token back.
 */
export async function acquire(workspace: "batch" | "interactive", model: ClaudeModel, maxWaitMs: number): Promise<Permit> {
  const deadline = Date.now() + maxWaitMs;
  const b = bucket(workspace, model);
  for (;;) {
    refill(b, workspace, model);
    if (b.tokens >= 1) break;
    const waitMs = Math.ceil((1 - b.tokens) / rateNow(workspace, model));
    if (Date.now() + waitMs > deadline) throw new Error("limiter_timeout");
    await new Promise((r) => setTimeout(r, waitMs));
  }
  b.tokens -= 1;
  try {
    await acquireSlot(Math.max(0, deadline - Date.now()));
  } catch (err) {
    b.tokens += 1; // nothing was sent
    throw err;
  }
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      releaseSlot();
    },
  };
}

/** Sets an AIMD factor for 60 s; a stronger cut already running is kept. */
function reduce(workspace: "batch" | "interactive", model: ClaudeModel, factor: number): void {
  const key = bucketKey(workspace, model);
  refill(bucket(workspace, model), workspace, model); // tokens earned so far count at the old rate
  const now = Date.now();
  const current = state.reduced.get(key);
  const keep = current && now < current.until && current.factor <= factor;
  state.reduced.set(key, { factor: keep ? current.factor : factor, until: now + REDUCED_MS });
}

/** Adaptive reduction on response headers: below 10% remaining, cut the refill by a quarter for 60 s (6.3). */
export function onResponseHeaders(workspace: "batch" | "interactive", model: ClaudeModel, remaining: { requests: number | null; limit?: number | null }): void {
  if (remaining.requests === null || remaining.limit === undefined || remaining.limit === null) return;
  if (remaining.requests < remaining.limit * 0.1) reduce(workspace, model, 0.75);
}

/** AIMD on a 429: halve the refill for 60 s and halve the tokens on hand, so the bucket never refills on a 429 (6.3). */
export function on429(workspace: "batch" | "interactive", model: ClaudeModel): void {
  reduce(workspace, model, 0.5);
  const b = bucket(workspace, model);
  b.tokens /= 2;
}

/** Test helper: clears all limiter state. */
export function resetLimiter(): void {
  state.inFlight = 0;
  state.queue.length = 0;
  state.buckets.clear();
  state.reduced.clear();
}
