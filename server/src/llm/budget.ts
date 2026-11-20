import type { AgentCallContext, CallKind, ClaudeModel } from "../agents/types";
import type { AgentSpec } from "../agents/types";
import { PLANS, type PlanId } from "@auto-career/shared";
import type { BudgetRefusal } from "./errors";

/**
 * The five budget scopes (03-agent-runtime.md 9). Reads use a 10-second in-process cache of
 * llm_cost_daily and user_daily_usage plus the process's own spend since the cache was filled, so
 * a check costs no query on most calls. The worst overshoot is about one minute of spend across
 * replicas, well under the provider caps.
 */

export type BudgetDecision = { ok: true } | ({ ok: false } & BudgetRefusal);

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

/** The shed level global spend implies (9.5): $190 is level 1, $220 level 2, $260 level 3. */
export function shedLevelFor(globalUsd: number): 0 | 1 | 2 | 3 {
  return globalUsd >= SHED_LEVELS[2] ? 3 : globalUsd >= SHED_LEVELS[1] ? 2 : globalUsd >= SHED_LEVELS[0] ? 1 : 0;
}

/** Scoring and builder agents, the work 9.5 sheds by level. Drafting, tailoring and parsing are never shed. */
const SCORING = new Set<string>(["fit-scorer"]);
const BUILDER = new Set<string>(["resume-writer"]);

/**
 * What a shed level stops (9.5): level 1 low-stakes batch ops work; level 2 also Free and Starter scoring; level 3 all
 * scoring and builder suggestions. User-initiated drafting, tailoring and parsing continue at every level.
 */
function shedRefuses(level: number, spec: AnyAgentSpec, plan: PlanId | undefined, budgetClass: string, workspace: string): boolean {
  if (level >= 1 && budgetClass === "pipeline" && workspace === "batch" && spec.stakes === "low") return true;
  if (level >= 2 && SCORING.has(spec.id) && plan !== "pro" && plan !== "max") return true;
  return level >= 3 && (SCORING.has(spec.id) || BUILDER.has(spec.id));
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
    private readonly shedLevel: () => 0 | 1 | 2 | 3 | Promise<0 | 1 | 2 | 3> = () => 0,
    /** The llm_paused ops flag (WP-27): every model call is refused while true. */
    private readonly paused: () => boolean | Promise<boolean> = () => false,
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
   * Order: per call, then shed level against the agent and budget class (9.5), then per user, then per agent, then
   * global (9.3). `perCallCapUsd` is the tier-up cap when the call runs on the tier-up model (2.6); it defaults to the
   * spec's own cap. The call's budget class and workspace overrides (3.3: the drafts and tailor routes run as
   * interactive work) pick the scope, as they pick the counter the ledger bumps.
   */
  async checkBudget(spec: AnyAgentSpec, est: { usd: number; model: ClaudeModel }, ctx: AgentCallContext, perCallCapUsd: number = spec.maxCostPerCallUsd, callKind?: CallKind): Promise<BudgetDecision> {
    const budgetClass = ctx.budgetClass ?? spec.budgetClass;
    const workspace = ctx.workspace ?? spec.workspace;

    // Scope 1: per call.
    if (est.usd > perCallCapUsd) return { ok: false, scope: "call", retryAfter: "now" };

    const day = utCday();
    const snap = await this.snapshot(day);
    const globalUsd = snap.globalUsd + this.processDelta;

    // Scope 2: shed level (9.5), the higher of the manual level (ops flag, env) and the one global spend implies; llm_paused stops all.
    if ((await this.paused()) || shedRefuses(Math.max(await this.shedLevel(), shedLevelFor(globalUsd)), spec, ctx.plan, budgetClass, workspace)) {
      return { ok: false, scope: "shed", retryAfter: "now" };
    }

    // Scope 3: per user, per day (pipeline cap from plans.ts; interactive backstop from 9.1).
    if (ctx.userId) {
      const spend = await this.userSpend(ctx.userId, day);
      const delta = this.processUserDelta.get(ctx.userId) ?? { pipelineUsd: 0, interactiveUsd: 0 };
      if (budgetClass === "pipeline") {
        const cap = dailyPipelineCapUsd(ctx.plan) * (workspace === "interactive" ? 1.5 : 1);
        if (spend.pipelineUsd + delta.pipelineUsd >= cap) return { ok: false, scope: "user_pipeline", retryAfter: "next_utc_day" };
      } else if (budgetClass === "interactive") {
        const backstop = interactiveBackstopUsd(ctx.plan);
        if (spend.interactiveUsd + delta.interactiveUsd >= backstop) {
          return { ok: false, scope: "user_interactive", retryAfter: "next_utc_day" };
        }
      }
    }

    // Scope 4: per agent, per day. A spent envelope stops batch work until 00:00 UTC; interactive work carries on to
    // the global ceiling, because a user is waiting (9.4). A prompt shadow stops too whatever its workspace: nobody waits
    // on it, and with no user and the ops class no other cap holds it. ponytail: the page at 100% lands with WP-27's alerts.
    const agentSpend = (snap.agentUsd[spec.id] ?? 0) + (this.processAgentDelta[spec.id] ?? 0);
    if (agentSpend >= spec.dailyEnvelopeUsd && (workspace === "batch" || callKind === "shadow")) {
      return { ok: false, scope: "agent", retryAfter: "next_utc_day" };
    }

    // Scope 5: global, per day. A hard ceiling for every agent at the level-3 threshold.
    if (globalUsd >= SHED_LEVELS[2]) {
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
