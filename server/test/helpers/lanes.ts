import type { Lane } from "../../src/jobs/queues";

/**
 * A scoring lane in memory, with the queue semantics the Redis lane relies on (queues.int.test.ts checks them against
 * BullMQ in CI): user jobs run first in, first out, one worker at a time; waking a user whose job is already waiting
 * does nothing; waking one whose job is running queues it again when that run ends (deduplication keepLastIfActive).
 */
export function memoryLane() {
  const pending = new Map<string, string[]>();
  const waiting: string[] = [];
  const active = new Set<string>();
  const again = new Set<string>();

  const wake = (userId: string) => {
    if (active.has(userId)) again.add(userId);
    else if (!waiting.includes(userId)) waiting.push(userId);
  };
  const lane: Lane = {
    async add(userId, members) {
      const list = pending.get(userId) ?? [];
      for (const m of members) if (!list.includes(m)) list.push(m);
      pending.set(userId, list);
      wake(userId);
    },
    peek: async (userId, n) => (pending.get(userId) ?? []).slice(0, n),
    done: async (userId, members) => void pending.set(userId, (pending.get(userId) ?? []).filter((m) => !members.includes(m))),
    async next(userId) {
      if (pending.get(userId)?.length) wake(userId);
    },
  };

  return {
    ...lane,
    pending,
    /** Runs user jobs in queue order until none is waiting; returns each run's result. */
    async drain<R>(run: (userId: string) => Promise<R>): Promise<R[]> {
      const results: R[] = [];
      while (waiting.length > 0) {
        const userId = waiting.shift()!;
        active.add(userId);
        try {
          results.push(await run(userId));
        } finally {
          active.delete(userId);
          if (again.delete(userId)) waiting.push(userId);
        }
      }
      return results;
    },
  };
}
