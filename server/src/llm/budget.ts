import type { AgentCallContext, ClaudeModel } from "../agents/types";
import type { AgentSpec } from "../agents/types";
import { PLANS, type PlanId } from "@auto-career/shared";

/**
 * The five budget scopes (03-agent-runtime.md 9). Reads use a 10-second in-process cache of
 * llm_cost_daily and user_daily_usage plus the process's own spend since the cache was filled, so
 * a check costs no query on most calls. The worst overshoot is about one minute of spend across
 * replicas, well under the provider caps.
 */

export type BudgetDecision =
  | { ok: true }
  | { ok: false; scope: "call" | "user_pipeline" | "user_interactive" | "agent" | "global" | "shed"; retryAfter: "next_utc_day" | "now" };

/** Global daily thresholds: warn, then shed levels 1..3 (9.5). */
export const GLOBAL_WARN_USD = 165;
export const SHED_LEVELS: readonly [number, number, number] = [190, 220, 260];

export interface SpendSnapshot {
  globalUsd: number;
  agentUsd: Record<string, number>;
  tierUpCallsToday: Record<string, number>;
  callsYesterday: Record<string, number>;
}

export interface UserSpend {
  pipelineUsd: number;
  interactiveUsd: number;
}

/** The gateway's view of Postgres spend counters; a memory implementation backs the unit tests. */
export interface SpendStore {
  snapshotToday(day: string): Promise<SpendSnapshot>;
  userSpend(userId: string, day: string): Promise<UserSpend>;
}

const CACHE_MS = 10_000;

const utCday = (now = new Date()): string => now.toISOString().slice(0, 10);

/** Per-user pipeline cap a day, from plans.ts (9.1). [est] until the owner pins numbers. */
export function dailyPipelineCapUsd(plan: PlanId | undefined): number {
  const p = PLANS.find((x) => x.id === (plan ?? "free"));
  return p?.dailyModelSpendCapUsd ?? 0.5;
}

/** Interactive backstop per user a day: 1.5 x sum(allowance x unit max cost) from 9.1, [est]. */
export function interactiveBackstopUsd(plan: PlanId | undefined): number {
  const p = PLANS.find((x) => x.id === (plan ?? "free"));
  return p?.interactiveSpendBackstopUsd ?? 0.62;
}

/** The registry erases the pair's input/output types at this boundary. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAgentSpec = AgentSpec<any, any>;

export class Budget {
  private processDelta = 0;
  private processAgentDelta: Record<string, number> = {};
  private processUserDelta: Map<string, UserSpend> = new Map();
  private snap: { day: string; filledAt: number; value: SpendSnapshot } | null = null;
  private users: Map<string, { day: string; filledAt: number; value: UserSpend }> = new Map();

  constructor(
    private readonly store: SpendStore,
    private readonly shedLevel: () => 0 | 1 | 2 | 3 = () => 0,
  ) {}

  recordSpend(agentId: string, ctx: AgentCallContext, usd: number, workspace: "batch" | "interactive"): void {
    this.processDelta += usd;
    this.processAgentDelta[agentId] = (this.processAgentDelta[agentId] ?? 0) + usd;
    if (ctx.userId) {
      const cur = this.processUserDelta.get(ctx.userId) ?? { pipelineUsd: 0, interactiveUsd: 0 };
      if (workspace === "batch") cur.pipelineUsd += usd;
      else cur.interactiveUsd += usd;
      this.processUserDelta.set(ctx.userId, cur);
    }
  }

  private async snapshot(day: string): Promise<SpendSnapshot> {
    if (!this.snap || this.snap.day !== day || Date.now() - this.snap.filledAt > CACHE_MS) {
      const value = await this.store.snapshotToday(day);
      this.snap = { day, filledAt: Date.now(), value };
    }
    return this.snap.value;
  }

  private async userSpend(userId: string, day: string): Promise<UserSpend> {
    const cached = this.users.get(userId);
    if (cached && cached.day === day && Date.now() - cached.filledAt <= CACHE_MS) return cached.value;
    const value = await this.store.userSpend(userId, day);
    this.users.set(userId, { day, filledAt: Date.now(), value });
    return value;
  }

  /**
   * Order: per call, then shed level against the agent and budget class (9.5), then per user, then
   * per agent, then global (9.3). `perCallCapUsd` is the tier-up cap when the call runs on the
   * tier-up model (2.6); it defaults to the spec's own cap.
   */
  async checkBudget(spec: AnyAgentSpec, est: { usd: number; model: ClaudeModel }, ctx: AgentCallContext, perCallCapUsd: number = spec.maxCostPerCallUsd): Promise<BudgetDecision> {
    // Scope 1: per call.
    if (est.usd > perCallCapUsd) return { ok: false, scope: "call", retryAfter: "now" };

    // Scope 2: shed level (9.5). Level 1 pauses batch ops work; 2 halves Free/Starter scoring and
    // stops rehearsal; 3 stops all scoring and builder suggestions. The coarse P1 gate uses the
    // budget class: pipeline batch work sheds first, interactive user work last.
    const shed = this.shedLevel();
    if (shed >= 3 && spec.budgetClass === "pipeline") return { ok: false, scope: "shed", retryAfter: "now" };
    if (shed >= 1 && spec.budgetClass === "pipeline" && spec.workspace === "batch" && spec.stakes === "low") {
      return { ok: false, scope: "shed", retryAfter: "now" };
    }

    const day = utCday();
    const snap = await this.snapshot(day);

    // Scope 3: per user, per day (pipeline cap from plans.ts; interactive backstop from 9.1).
    if (ctx.userId) {
      const spend = await this.userSpend(ctx.userId, day);
      const delta = this.processUserDelta.get(ctx.userId) ?? { pipelineUsd: 0, interactiveUsd: 0 };
      if (spec.budgetClass === "pipeline") {
        const cap = dailyPipelineCapUsd(ctx.plan) * (spec.workspace === "interactive" ? 1.5 : 1);
        if (spend.pipelineUsd + delta.pipelineUsd >= cap) return { ok: false, scope: "user_pipeline", retryAfter: "next_utc_day" };
      } else if (spec.budgetClass === "interactive") {
        const backstop = interactiveBackstopUsd(ctx.plan);
        if (spend.interactiveUsd + delta.interactiveUsd >= backstop) {
          return { ok: false, scope: "user_interactive", retryAfter: "next_utc_day" };
        }
      }
    }

    // Scope 4: per agent, per day.
    const agentSpend = (snap.agentUsd[spec.id] ?? 0) + (this.processAgentDelta[spec.id] ?? 0);
    if (agentSpend >= spec.dailyEnvelopeUsd) {
      return { ok: false, scope: "agent", retryAfter: spec.workspace === "batch" ? "next_utc_day" : "now" };
    }

    // Scope 5: global, per day.
    if (snap.globalUsd + this.processDelta >= SHED_LEVELS[2]) {
      return { ok: false, scope: "global", retryAfter: "now" };
    }

    return { ok: true };
  }

  /** Tier-up share cap of 5.4: `sonnetCallsToday < max(minDailyAllowance, share x callsYesterday)`. */
  async tierUpAllowed(spec: AnyAgentSpec): Promise<boolean> {
    if (!spec.tierUp) return false;
    const snap = await this.snapshot(utCday());
    const today = snap.tierUpCallsToday[spec.id] ?? 0;
    const yesterday = Math.max(1, snap.callsYesterday[spec.id] ?? 0);
    const cap = Math.max(spec.tierUp.minDailyAllowance, spec.tierUp.maxShareOfDailyCalls * yesterday);
    return today < cap;
  }

  /** Test helper: forget the caches and the process deltas. */
  reset(): void {
    this.snap = null;
    this.users.clear();
    this.processDelta = 0;
    this.processAgentDelta = {};
    this.processUserDelta.clear();
  }
}
