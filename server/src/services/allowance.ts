import type { Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { getPlan, type AiFeature, type PlanId } from "@auto-career/shared";
import { db as appDb, type Db } from "../db/client";
import { aiUsage } from "../db/schema/platform";
import { forbidden, HttpError, nextUtcMidnight } from "../lib/errors";
import { logger, logUserHash } from "../lib/logger";
import { AgentError } from "../llm/errors";

/**
 * Per-feature daily AI allowances (F11, 01-architecture B.8.10, 05-api 11.5). Limits come only from plans.ts; counters
 * live in ai_usage, so every api replica shares them. A spent allowance is 429 rate_limited with reason daily_allowance
 * (402 stays "no credits"); a limit of 0 means the plan lacks the feature, 403. Never served by a cheaper model.
 */

export interface AllowanceGrant {
  userId: string;
  feature: AiFeature;
  /** The UTC day the units were taken from; a refund goes back to the same day. */
  day: string;
  units: number;
  used: number;
  limit: number;
  resetsAt: string;
}

/** Takes `units` in one guarded upsert: the row only moves when used + units stays within the limit. */
export async function consumeAllowance(
  req: { userId: string; plan: PlanId; feature: AiFeature; units?: number },
  database: Db = appDb(),
): Promise<AllowanceGrant> {
  const { userId, feature } = req;
  const units = req.units ?? 1;
  const limit = getPlan(req.plan).aiDailyAllowance[feature];
  if (limit === 0) throw forbidden("This AI feature is not on your plan");
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const resetsAt = nextUtcMidnight(now);
  const [row] =
    units > limit
      ? []
      : await database
          .insert(aiUsage)
          .values({ userId, day, feature, used: units })
          .onConflictDoUpdate({
            target: [aiUsage.userId, aiUsage.day, aiUsage.feature],
            set: { used: sql`${aiUsage.used} + excluded.used`, updatedAt: now },
            setWhere: sql`${aiUsage.used} + excluded.used <= ${limit}`,
          })
          .returning({ used: aiUsage.used });
  if (row) return { userId, feature, day, units, used: row.used, limit, resetsAt };
  const [current] = await database
    .select({ used: aiUsage.used })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day), eq(aiUsage.feature, feature)));
  throw new HttpError(429, "rate_limited", "You have used today's AI allowance for this. It resets at 00:00 UTC.", {
    reason: "daily_allowance",
    feature,
    limit,
    used: current?.used ?? 0,
    resetsAt,
  });
}

export async function refundAllowance(grant: AllowanceGrant, database: Db = appDb()): Promise<void> {
  await database
    .update(aiUsage)
    .set({ used: sql`greatest(${aiUsage.used} - ${grant.units}, 0)`, updatedAt: new Date() })
    .where(and(eq(aiUsage.userId, grant.userId), eq(aiUsage.day, grant.day), eq(aiUsage.feature, grant.feature)));
}

/** `Kairos-Allowance: feature=resumeSuggestions;used=3;limit=15;resets=2026-10-24T00:00:00Z` (05-api 3.4). */
export const allowanceHeader = (g: AllowanceGrant): string => `feature=${g.feature};used=${g.used};limit=${g.limit};resets=${g.resetsAt}`;

/** Gateway failures that come back after the model wrote billed tokens. */
const BILLED: ReadonlySet<string> = new Set(["refusal", "schema_invalid", "max_tokens", "injection_echo"]);

/**
 * Whether a failed request gives its units back (B.8.10: "fails before any model call"). Validation and lookups refund;
 * so do gateway failures that never got a reply (budget, breaker, limiter, transport). A reply the model wrote and we
 * then refused (truth_lock, a refusal, an invalid reply) does not: refunding it would make a crafted request free.
 * ponytail: the legacy client's LlmError is not refunded either; it cannot tell a transport error from a bad reply.
 */
export function refundable(err: unknown): boolean {
  if (err instanceof HttpError) return err.code !== "truth_lock";
  if (err instanceof AgentError) return !BILLED.has(err.code);
  return false;
}

/** Runs one metered route body: takes the units, refunds them when `run` fails refundably, and sets Kairos-Allowance on success. */
export async function metered<T>(
  res: Response,
  req: { userId: string; plan: PlanId; feature: AiFeature; units?: number },
  run: () => Promise<T>,
): Promise<T> {
  const grant = await consumeAllowance(req);
  try {
    const out = await run();
    res.setHeader("Kairos-Allowance", allowanceHeader(grant));
    return out;
  } catch (err) {
    if (refundable(err)) {
      await refundAllowance(grant).catch((e: unknown) => logger.warn({ err: e, userHash: logUserHash(req.userId), feature: req.feature }, "allowance refund failed"));
    }
    throw err;
  }
}
