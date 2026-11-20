import { afterEach, describe, expect, it } from "vitest";
import { CHUNK, fanOutStopped, PAUSE_RETRY_MS, retryDelayMs, runChunk } from "../src/jobs/score-matches";
import { AgentError } from "../src/llm/errors";
import { configureGateway } from "../src/llm/gateway";
import { refundable } from "../src/services/allowance";
import { scoreFit } from "../src/services/fit";
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

describe("a lane held by a refusal (F6)", () => {
  it("runChunk marks done only what was not held, and does not queue the user again", async () => {
    const lane = memoryLane();
    await lane.add("u", ["a", "b", "c"]);
    await lane.drain((userId) => runChunk(lane, userId, async (members) => ({ held: members.slice(1) })));
    expect(lane.pending.get("u")).toEqual(["b", "c"]);
    // Nothing is waiting: the drain ended after one run, so a refusal cannot spin.
    expect(await lane.drain(async () => "ran again")).toEqual([]);
  });
});

describe("what stops a fan-out (F6)", () => {
  it("pause_scoring and unreadable flags do; llm_paused and agent_disabled, which it does not read, do not", () => {
    const f = (over: object) => ({ pauseScoring: false, llmPaused: true, agentDisabled: new Set(["fit-scorer"]), loaded: true, ...over });
    expect(fanOutStopped(f({}))).toBe(false);
    expect(fanOutStopped(f({ pauseScoring: true }))).toBe(true);
    expect(fanOutStopped(f({ loaded: false }))).toBe(true);
  });
});

describe("the gateway's flag refusals, as the scoring lane reads them (F6)", () => {
  const paused = (over: object) => () => ({ llmPaused: false, batchPaused: false, disabled: {}, promptPin: {}, ...over });
  const job = { title: "Engineer", companyName: "Acme", location: null, remote: false, descriptionText: "Build.", salaryMaxUsd: null };
  afterEach(() => configureGateway({ flags: paused({}) }));

  it.each([
    ["llm_paused", { llmPaused: true }],
    ["agent_disabled", { disabled: { "fit-scorer": true } }],
  ])("%s from the real gateway: retried on the long delay at any attempt, and refunded", async (code, over) => {
    configureGateway({ flags: paused(over) });
    const err = await scoreFit(job, "- (skill) TypeScript", { userId: "u", jobId: "j" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AgentError);
    expect(err).toMatchObject({ code, retryable: true });
    for (const attempt of [0, 2, 9]) expect(retryDelayMs(err, attempt)).toBe(PAUSE_RETRY_MS);
    expect(refundable(err)).toBe(true);
  });

  it("other retryable errors keep their short ladder and their attempt limit", () => {
    const err = new AgentError("overloaded", "x", true);
    expect(retryDelayMs(err, 0)).toBe(60_000);
    expect(retryDelayMs(err, 1)).toBe(120_000);
    expect(retryDelayMs(err, 2)).toBeNull();
  });
});
