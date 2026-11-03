import { describe, expect, it } from "vitest";
import { CHUNK, runChunk } from "../src/jobs/score-matches";
import { memoryLane } from "./helpers/lanes";

/**
 * WP-45 acceptance (scale-06): one user with 500 pending score jobs does not delay another user's job by more than one
 * chunk. Each user has one lane; the queue holds one job per user, which scores a chunk and re-queues behind the others.
 */

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("per-user scoring lanes", () => {
  it("chunks are 5 pairs (03-fit-scoring: CHUNK_PAIRS)", () => {
    expect(CHUNK).toBe(5);
  });

  it("a user with 500 pending pairs delays another user's pair by one chunk", async () => {
    const lane = memoryLane();
    await lane.add("heavy", ids("h", 500));
    await lane.add("light", ["l0"]);
    const scored: string[] = [];
    await lane.drain((userId) => runChunk(lane, userId, async (members) => void scored.push(...members)));
    expect(scored.indexOf("l0")).toBe(CHUNK);
    expect(scored).toHaveLength(501);
    expect(lane.pending.get("heavy")).toEqual([]);
  });

  it("a pair that arrives mid-backlog waits only for the chunk in flight", async () => {
    const lane = memoryLane();
    await lane.add("heavy", ids("h", 500));
    const scored: string[] = [];
    let chunks = 0;
    await lane.drain((userId) =>
      runChunk(lane, userId, async (members) => {
        chunks += 1;
        if (chunks === 40) await lane.add("light", ["l0"]); // during heavy's 40th chunk
        scored.push(...members);
      }),
    );
    expect(scored.indexOf("l0")).toBe(40 * CHUNK);
  });

  it("several busy users take turns a chunk at a time", async () => {
    const lane = memoryLane();
    for (const u of ["a", "b", "c"]) await lane.add(u, ids(u, 12));
    const order: string[] = [];
    await lane.drain((userId) => runChunk(lane, userId, async () => void order.push(userId)));
    expect(order).toEqual(["a", "b", "c", "a", "b", "c", "a", "b", "c"]);
  });

  it("marks a chunk done only after it was scored, so a failed run leaves its pairs for the retry", async () => {
    const lane = memoryLane();
    await lane.add("u", ids("p", 7));
    await expect(runChunk(lane, "u", async () => Promise.reject(new Error("database down")))).rejects.toThrow(/database/);
    expect(lane.pending.get("u")).toEqual(ids("p", 7));
  });
});
