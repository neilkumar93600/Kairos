import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import type { CallRow } from "../src/llm/ledger";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";

// The llm_calls write path, the spend counters and the roll-up (03-agent-runtime 8.3, 8.4; llm-agents-22, tests-31).
// The app's global db() reads DATABASE_URL lazily, so it is set before any app module loads.
process.env.DATABASE_URL = testDbUrl("llm_ledger");

const row = (over: Partial<CallRow> = {}): CallRow => ({
  agentId: "fit-scorer",
  promptVersion: 1,
  promptSha256: Buffer.alloc(32, 1),
  model: "claude-haiku-5-5",
  workspace: "batch",
  isBatch: false,
  plan: "free",
  userHash: Buffer.alloc(16, 2),
  applicationId: null,
  jobId: randomUUID(),
  inputRefs: null,
  inputHash: Buffer.alloc(32, 3),
  inputTokens: 900,
  cacheReadTokens: 600,
  cacheWriteTokens: 0,
  outputTokens: 30,
  costUsd: 0.0002,
  latencyMs: 800,
  stopReason: "end_turn",
  status: "ok",
  attempts: 1,
  tieredUp: false,
  errorCode: null,
  providerRequestId: "req_1",
  callKind: "primary",
  budgetClass: "pipeline",
  traceId: null,
  ...over,
});

describe.skipIf(!hasTestDb)("llm ledger against Postgres", () => {
  let db: Db;
  let platform: typeof import("../src/db/schema/platform");

  beforeAll(async () => {
    db = await testDb("llm_ledger");
    platform = await import("../src/db/schema/platform");
  });
  beforeEach(async () => {
    await resetDb(db);
  });
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  it("writes one row per send and bumps the user's spend counter in the same transaction", async () => {
    const { writeCallRow } = await import("../src/llm/ledger");
    const userId = await seedUser(db);
    expect(await writeCallRow(row(), { userId, pipelineUsd: 0.0002, interactiveUsd: 0 })).not.toBeNull();
    expect(await writeCallRow(row({ costUsd: 0.0003 }), { userId, pipelineUsd: 0.0003, interactiveUsd: 0 })).not.toBeNull();
    const calls = await db.select().from(platform.llmCalls);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.userHash?.length === 16)).toBe(true);
    const [usage] = await db.select().from(platform.userDailyUsage).where(eq(platform.userDailyUsage.userId, userId));
    expect(Number(usage!.pipelineUsd)).toBeCloseTo(0.0005, 6);
  });

  it("accepts a budget_stopped row now that it carries its error code (the CHECK refused null)", async () => {
    const { writeCallRow } = await import("../src/llm/ledger");
    const stopped = row({ status: "budget_stopped", errorCode: "budget_stopped", costUsd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, stopReason: null, providerRequestId: null });
    expect(await writeCallRow(stopped, null)).not.toBeNull();
  });

  it("the roll-up is idempotent and the spend store reads it, with the user's day counters", async () => {
    const { writeCallRow } = await import("../src/llm/ledger");
    const { processCostRollup } = await import("../src/jobs/cost-rollup");
    const { postgresSpendStore } = await import("../src/llm/spend-store");
    const userId = await seedUser(db);
    await writeCallRow(row(), { userId, pipelineUsd: 0.0002, interactiveUsd: 0 });
    const writer = row({ agentId: "resume-writer", model: "claude-sonnet-5-5", workspace: "interactive", budgetClass: "interactive", costUsd: 0.01 });
    await writeCallRow(writer, { userId, pipelineUsd: 0, interactiveUsd: 0.01 });
    const rollup = async () => {
      await processCostRollup();
      return db.select().from(platform.llmCostDaily).orderBy(platform.llmCostDaily.agentId);
    };
    const first = await rollup();
    const second = await rollup();
    expect(first.length).toBe(2);
    expect(second.map((r) => [r.agentId, r.calls, r.costUsd])).toEqual(first.map((r) => [r.agentId, r.calls, r.costUsd]));

    const day = new Date().toISOString().slice(0, 10);
    const store = postgresSpendStore();
    const snap = await store.snapshotToday(day);
    expect(snap.agentUsd["fit-scorer"]).toBeCloseTo(0.0002, 8);
    expect(snap.agentUsd["resume-writer"]).toBeCloseTo(0.01, 8);
    expect(snap.globalUsd).toBeCloseTo(0.0102, 8);
    expect(await store.userSpend(userId, day)).toEqual({ pipelineUsd: 0.0002, interactiveUsd: 0.01 });
  });

  it("a gateway send with a user writes a row with a user_hash and the plan, and bumps the user's spend", async () => {
    const { runAgent, configureGateway } = await import("../src/llm/gateway");
    const { fakeAnthropic } = await import("../src/llm/testing");
    const { fitScorer } = await import("../src/agents/fit-scorer/spec");
    const { writeCallRow } = await import("../src/llm/ledger");
    const userId = await seedUser(db);
    configureGateway({
      writeRow: writeCallRow,
      client: () =>
        fakeAnthropic([
          { content: [{ type: "text", text: JSON.stringify({ score: 80, reasons: ["Meets the API requirement"] }) }], stop_reason: "end_turn", usage: { input_tokens: 900, output_tokens: 30 } },
        ]),
    });
    const job = { title: "Engineer", companyName: "Acme", location: null, remote: true, descriptionText: "Build APIs." };
    await runAgent(fitScorer, { profileSummary: "TypeScript APIs", job }, { userId, plan: "free" });
    const calls = await db.select().from(platform.llmCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.userHash?.length).toBe(16);
    expect(calls[0]!.plan).toBe("free");
    const [usage] = await db.select().from(platform.userDailyUsage).where(eq(platform.userDailyUsage.userId, userId));
    expect(Number(usage!.pipelineUsd)).toBeGreaterThan(0);
  });
});
