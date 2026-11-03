import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Budget, type SpendSnapshot, type SpendStore, type UserSpend } from "../../src/llm/budget";
import { answerDrafter } from "../../src/agents/answer-drafter/spec";
import { fitScorer } from "../../src/agents/fit-scorer/spec";
import { resumeTailor } from "../../src/agents/resume-tailor/spec";
import { resumeWriter } from "../../src/agents/resume-writer/spec";

/** The five budget scopes of 03-agent-runtime.md 9 (llm-agents-25, tests-31). */
const HAIKU = { usd: 0.0001, model: "claude-haiku-5-5" as const };
const SONNET = { usd: 0.01, model: "claude-sonnet-5-5" as const };

function store(over: { snap?: Partial<SpendSnapshot>; user?: Partial<UserSpend> } = {}) {
  const calls = { snapshot: 0, user: 0 };
  const s: SpendStore = {
    snapshotToday: async () => {
      calls.snapshot += 1;
      return { globalUsd: 0, agentUsd: {}, tierUpCallsToday: {}, callsYesterday: {}, ...over.snap };
    },
    userSpend: async () => {
      calls.user += 1;
      return { pipelineUsd: 0, interactiveUsd: 0, ...over.user };
    },
  };
  return { s, calls };
}

describe("Budget.checkBudget", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("scope 1, per call: refuses an estimate above the call cap, and the tier-up cap when given", async () => {
    const b = new Budget(store().s);
    expect(await b.checkBudget(fitScorer, { usd: 0.0007, model: "claude-haiku-5-5" }, {})).toEqual({ ok: false, scope: "call", retryAfter: "now" });
    expect(await b.checkBudget(resumeTailor, { usd: 0.01, model: "claude-sonnet-5-5" }, {}, 0.03)).toEqual({ ok: true });
  });

  it("scope 3, per user: the pipeline cap from plans.ts, 1.5x for user-initiated interactive-workspace work", async () => {
    const free = new Budget(store({ user: { pipelineUsd: 0.05 } }).s);
    expect(await free.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "free" })).toEqual({ ok: false, scope: "user_pipeline", retryAfter: "next_utc_day" });
    expect(await free.checkBudget(resumeTailor, HAIKU, { userId: "u", plan: "free" })).toEqual({ ok: true }); // 0.05 < 0.075
    const max = new Budget(store({ user: { pipelineUsd: 0.05 } }).s);
    expect(await max.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "max" })).toEqual({ ok: true }); // cap 0.50
  });

  it("scope 3, per user: the interactive backstop, and a call's budgetClass override picks the scope", async () => {
    const b = new Budget(store({ user: { interactiveUsd: 0.62 } }).s);
    expect(await b.checkBudget(resumeWriter, SONNET, { userId: "u", plan: "free" })).toEqual({ ok: false, scope: "user_interactive", retryAfter: "next_utc_day" });
    // The drafts route runs answer-drafter as interactive work (3.3), so the interactive backstop applies.
    expect(await b.checkBudget(answerDrafter, HAIKU, { userId: "u", plan: "free", budgetClass: "interactive" })).toMatchObject({ scope: "user_interactive" });
    expect(await b.checkBudget(answerDrafter, HAIKU, { userId: "u", plan: "free" })).toEqual({ ok: true });
  });

  it("counts this process's own spend since the cache was filled", async () => {
    const b = new Budget(store().s);
    expect(await b.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "free" })).toEqual({ ok: true });
    b.recordSpend("fit-scorer", { userId: "u" }, 0.05, "batch");
    expect(await b.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "free" })).toMatchObject({ scope: "user_pipeline" });
  });

  it("scope 4, per agent: a batch agent stops at its envelope until the next UTC day; an interactive agent continues (9.4)", async () => {
    const b = new Budget(store({ snap: { agentUsd: { "fit-scorer": 40, "resume-writer": 50 } } }).s);
    expect(await b.checkBudget(fitScorer, HAIKU, {})).toEqual({ ok: false, scope: "agent", retryAfter: "next_utc_day" });
    expect(await b.checkBudget(resumeWriter, SONNET, {})).toEqual({ ok: true });
  });

  it("scope 5, global: refuses everything at $260 a day", async () => {
    const b = new Budget(store({ snap: { globalUsd: 260 } }).s);
    expect(await b.checkBudget(answerDrafter, HAIKU, {})).toEqual({ ok: false, scope: "global", retryAfter: "now" });
  });

  it("shed level 2 from global spend ($220) stops Free and Starter scoring only (9.5)", async () => {
    const b = new Budget(store({ snap: { globalUsd: 220 } }).s);
    expect(await b.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "free" })).toEqual({ ok: false, scope: "shed", retryAfter: "now" });
    expect(await b.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "starter" })).toMatchObject({ scope: "shed" });
    expect(await b.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "pro" })).toEqual({ ok: true });
    expect(await b.checkBudget(resumeWriter, SONNET, { userId: "u", plan: "free" })).toEqual({ ok: true });
  });

  it("shed level 3 from env stops all scoring and builder suggestions, never drafting or tailoring (9.5)", async () => {
    const b = new Budget(store().s, () => 3);
    expect(await b.checkBudget(fitScorer, HAIKU, { plan: "max" })).toMatchObject({ scope: "shed" });
    expect(await b.checkBudget(resumeWriter, SONNET, { plan: "max" })).toMatchObject({ scope: "shed" });
    expect(await b.checkBudget(answerDrafter, HAIKU, { plan: "free" })).toEqual({ ok: true });
    expect(await b.checkBudget(resumeTailor, HAIKU, { plan: "free" })).toEqual({ ok: true });
  });

  it("reads the spend counters through a 10-second cache", async () => {
    const { s, calls } = store();
    const b = new Budget(s);
    await b.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "free" });
    await b.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "free" });
    expect(calls).toEqual({ snapshot: 1, user: 1 });
    vi.advanceTimersByTime(10_001);
    await b.checkBudget(fitScorer, HAIKU, { userId: "u", plan: "free" });
    expect(calls).toEqual({ snapshot: 2, user: 2 });
  });
});
