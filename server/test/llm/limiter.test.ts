import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquire, on429, onResponseHeaders, resetLimiter, type Permit } from "../../src/llm/limiter";

/**
 * The limiter of 03-agent-runtime.md 6.3 (llm-agents-18, v08, scale-v01). The api defaults apply in tests: Haiku 150
 * requests a minute (one token every 400 ms) in a bucket of 20, and a semaphore of 20.
 */
const HAIKU = "claude-haiku-5-5" as const;

async function drain(n = 20): Promise<void> {
  for (let i = 0; i < n; i++) (await acquire("interactive", HAIKU, 0)).release();
}

describe("limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetLimiter();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for a refill when the bucket is empty instead of failing at once (llm-agents-18)", async () => {
    await drain();
    let settled = false;
    const next = acquire("interactive", HAIKU, 2_000).then((p) => {
      settled = true;
      return p;
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(settled).toBe(true);
    (await next).release();
  });

  it("rejects with limiter_timeout when no token can arrive within maxWaitMs", async () => {
    await drain();
    await expect(acquire("interactive", HAIKU, 100)).rejects.toThrow("limiter_timeout");
  });

  it("a 429 halves the refill for 60 s and never refills the bucket to a full burst (scale-v01)", async () => {
    await drain();
    on429("interactive", HAIKU);
    // Before the fix the bucket was deleted and came back with 20 tokens.
    await expect(acquire("interactive", HAIKU, 0)).rejects.toThrow("limiter_timeout");
    // At half rate a token takes 800 ms, so 600 ms is not enough.
    await expect(acquire("interactive", HAIKU, 600)).rejects.toThrow("limiter_timeout");
    const halved = acquire("interactive", HAIKU, 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    (await halved).release();
    // After 60 s the full rate is back: 400 ms per token.
    await vi.advanceTimersByTimeAsync(60_000);
    await drain();
    const full = acquire("interactive", HAIKU, 450);
    await vi.advanceTimersByTimeAsync(450);
    (await full).release();
  });

  it("low remaining headroom cuts the refill by a quarter for 60 s", async () => {
    await drain();
    onResponseHeaders("interactive", HAIKU, { requests: 50, limit: 2_000 });
    await expect(acquire("interactive", HAIKU, 450)).rejects.toThrow("limiter_timeout"); // 533 ms per token now
    const slower = acquire("interactive", HAIKU, 600);
    await vi.advanceTimersByTimeAsync(600);
    (await slower).release();
  });

  it("wakes a waiter for a semaphore slot when a permit is released (llm-agents-v08)", async () => {
    const held: Permit[] = [];
    for (let i = 0; i < 20; i++) held.push(await acquire("interactive", HAIKU, 0)); // 20 slots, 20 tokens
    let settled = false;
    const waiter = acquire("interactive", HAIKU, 2_000).then((p) => {
      settled = true;
      return p;
    });
    await vi.advanceTimersByTimeAsync(500); // a token has arrived, but every slot is taken
    expect(settled).toBe(false);
    held.pop()!.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    (await waiter).release();
    for (const p of held) p.release();
  });

  it("a waiter that times out on the semaphore gives its token back", async () => {
    const held: Permit[] = [];
    for (let i = 0; i < 20; i++) held.push(await acquire("interactive", HAIKU, 0));
    await vi.advanceTimersByTimeAsync(400); // one token
    const late = acquire("interactive", HAIKU, 50);
    const rejected = expect(late).rejects.toThrow("limiter_timeout");
    await vi.advanceTimersByTimeAsync(50);
    await rejected;
    for (const p of held) p.release();
    (await acquire("interactive", HAIKU, 0)).release(); // the returned token is still there
  });
});
