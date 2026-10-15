import type { Redis } from "ioredis";

/**
 * Daily model spend caps: global, per agent and per user, in USD, reset at UTC midnight.
 * Counters live in Redis because every worker replica checks them before each call;
 * llm_calls in Postgres stays the source of truth for reporting.
 */

export interface SpendStore {
  get(keys: string[]): Promise<number[]>;
  add(keys: string[], usd: number): Promise<void>;
}

export interface BudgetLimits {
  globalDailyUsd: number;
  userDailyUsd: number;
  /** Agents not listed have no agent-level cap (the global cap still applies). */
  agentDailyUsd: Readonly<Record<string, number>>;
}

export class BudgetExceededError extends Error {
  override name = "BudgetExceededError";
  constructor(readonly scope: "global" | "agent" | "user") {
    super(`daily model budget exhausted (${scope})`);
  }
}

const day = (now: Date) => now.toISOString().slice(0, 10);

export function spendKeys(agentId: string, userId: string | null | undefined, now = new Date()) {
  const prefix = `llm:spend:${day(now)}`;
  return {
    global: `${prefix}:global`,
    agent: `${prefix}:agent:${agentId}`,
    user: userId ? `${prefix}:user:${userId}` : null,
  };
}

export class Budget {
  constructor(
    private readonly store: SpendStore,
    private readonly limits: BudgetLimits,
  ) {}

  /** Throws before a call if any cap is already reached. A call in flight may overshoot by its own cost. */
  async check(agentId: string, userId?: string | null): Promise<void> {
    const k = spendKeys(agentId, userId);
    const [globalUsd = 0, agentUsd = 0, userUsd = 0] = await this.store.get([k.global, k.agent, k.user ?? k.global]);
    if (globalUsd >= this.limits.globalDailyUsd) throw new BudgetExceededError("global");
    const agentCap = this.limits.agentDailyUsd[agentId];
    if (agentCap !== undefined && agentUsd >= agentCap) throw new BudgetExceededError("agent");
    if (k.user && userUsd >= this.limits.userDailyUsd) throw new BudgetExceededError("user");
  }

  async record(agentId: string, userId: string | null | undefined, usd: number): Promise<void> {
    if (usd <= 0) return;
    const k = spendKeys(agentId, userId);
    await this.store.add([k.global, k.agent, ...(k.user ? [k.user] : [])], usd);
  }
}

const TTL_SECONDS = 2 * 24 * 3600;

export function redisSpendStore(client: Redis): SpendStore {
  return {
    async get(keys) {
      const values = await client.mget(...keys);
      return values.map((v) => Number(v ?? 0));
    },
    async add(keys, usd) {
      // ponytail: two round trips per key, not atomic; a lost EXPIRE only keeps a stale key one extra day.
      await Promise.all(keys.map(async (key) => {
        await client.incrbyfloat(key, usd);
        await client.expire(key, TTL_SECONDS);
      }));
    },
  };
}

/** For tests and local runs without Redis. */
export function memorySpendStore(): SpendStore & { values: Map<string, number> } {
  const values = new Map<string, number>();
  return {
    values,
    async get(keys) {
      return keys.map((k) => values.get(k) ?? 0);
    },
    async add(keys, usd) {
      for (const k of keys) values.set(k, (values.get(k) ?? 0) + usd);
    },
  };
}
