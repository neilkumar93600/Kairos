import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { llmCostDaily, userDailyUsage } from "../db/schema/platform";
import { Budget, type SpendSnapshot, type SpendStore, type UserSpend } from "./budget";

/**
 * Spend counters for the budget checks (03-agent-runtime.md 9.3). The Postgres store sums
 * llm_cost_daily and user_daily_usage; the memory store backs unit tests.
 */

const utcDay = (now = new Date()): string => now.toISOString().slice(0, 10);

export function postgresSpendStore(): SpendStore {
  return {
    async snapshotToday(day: string): Promise<SpendSnapshot> {
      const rows = await db()
        .select({
          agentId: llmCostDaily.agentId,
          costUsd: llmCostDaily.costUsd,
          callsTieredUp: llmCostDaily.callsTieredUp,
        })
        .from(llmCostDaily)
        .where(eq(llmCostDaily.day, day));
      const yesterdayRows = await db()
        .select({ agentId: llmCostDaily.agentId, calls: llmCostDaily.calls })
        .from(llmCostDaily)
        .where(eq(llmCostDaily.day, utcDay(new Date(Date.now() - 86_400_000))));
      const agentUsd: Record<string, number> = {};
      const tierUpCallsToday: Record<string, number> = {};
      let globalUsd = 0;
      for (const r of rows) {
        const usd = Number(r.costUsd);
        agentUsd[r.agentId] = (agentUsd[r.agentId] ?? 0) + usd;
        tierUpCallsToday[r.agentId] = (tierUpCallsToday[r.agentId] ?? 0) + r.callsTieredUp;
        globalUsd += usd;
      }
      const callsYesterday: Record<string, number> = {};
      for (const r of yesterdayRows) callsYesterday[r.agentId] = (callsYesterday[r.agentId] ?? 0) + r.calls;
      return { globalUsd, agentUsd, tierUpCallsToday, callsYesterday };
    },

    async userSpend(userId: string, day: string): Promise<UserSpend> {
      const [row] = await db()
        .select({ pipelineUsd: userDailyUsage.pipelineUsd, interactiveUsd: userDailyUsage.interactiveUsd })
        .from(userDailyUsage)
        .where(and(eq(userDailyUsage.userId, userId), eq(userDailyUsage.day, day)))
        .limit(1);
      return { pipelineUsd: Number(row?.pipelineUsd ?? 0), interactiveUsd: Number(row?.interactiveUsd ?? 0) };
    },
  };
}

export function memorySpendStore(): SpendStore & { values: { global: number; agents: Map<string, number>; users: Map<string, UserSpend> } } {
  const values = { global: 0, agents: new Map<string, number>(), users: new Map<string, UserSpend>() };
  return {
    values,
    async snapshotToday(): Promise<SpendSnapshot> {
      const agentUsd: Record<string, number> = {};
      for (const [agent, usd] of values.agents) agentUsd[agent] = usd;
      return { globalUsd: values.global, agentUsd, tierUpCallsToday: {}, callsYesterday: {} };
    },
    async userSpend(userId: string): Promise<UserSpend> {
      return values.users.get(userId) ?? { pipelineUsd: 0, interactiveUsd: 0 };
    },
  };
}

void gte;
void lt;
void sql;

/** The process-wide budget: Postgres counters, no shed level until ops flags land (P1 control plane). */
export const defaultBudget = new Budget(postgresSpendStore());
