import { sql, type SQLWrapper } from "drizzle-orm";
import { db } from "../db/client";
import { llmCalls, userDailyUsage } from "../db/schema/platform";
import { logger } from "../lib/logger";

/**
 * The llm_calls write path (03-agent-runtime.md 8.3): one short transaction on the application pool
 * right after each send. Spend is recorded at call time, outside any business transaction, because
 * the money is spent whether or not the caller's transaction later commits.
 */

export interface CallRow {
  agentId: string;
  promptVersion: number;
  promptSha256: Buffer;
  model: string;
  workspace: "batch" | "interactive";
  isBatch: boolean;
  plan: string | null;
  userHash: Buffer | null;
  applicationId: string | null;
  jobId: string | null;
  inputRefs: Record<string, string[]> | null;
  inputHash: Buffer;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number | null;
  stopReason: string | null;
  status: "ok" | "schema_invalid" | "max_tokens" | "blocked" | "error" | "budget_stopped";
  attempts: number;
  tieredUp: boolean;
  errorCode: string | null;
  providerRequestId: string | null;
  callKind: string;
  budgetClass: "pipeline" | "interactive" | "ops" | "eval";
  traceId: string | null;
}

/** The per-user spend counters to bump alongside the row (8.3). */
export interface SpendUpdate {
  userId: string;
  pipelineUsd: number;
  interactiveUsd: number;
}

/**
 * Inserts the row and, when the call has a user and is not an eval, bumps user_daily_usage in the
 * same transaction. Retries 3 times over 2 seconds, then logs llm_ledger_write_failed; the nightly
 * reconciliation catches anything still missing. Returns the row id, or null when the write failed.
 */
export async function writeCallRow(row: CallRow, spend: SpendUpdate | null): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await db().transaction(async (tx) => {
        const [inserted] = await tx
          .insert(llmCalls)
          .values({
            agentId: row.agentId,
            promptVersion: row.promptVersion,
            promptSha256: row.promptSha256,
            model: row.model,
            workspace: row.workspace,
            isBatch: row.isBatch,
            plan: (row.plan as "free" | "starter" | "pro" | "max" | null) ?? null,
            userHash: row.userHash,
            applicationId: row.applicationId,
            jobId: row.jobId,
            inputRefs: row.inputRefs,
            inputHash: row.inputHash,
            inputTokens: row.inputTokens,
            cacheReadTokens: row.cacheReadTokens,
            cacheWriteTokens: row.cacheWriteTokens,
            outputTokens: row.outputTokens,
            costUsd: row.costUsd.toFixed(8),
            latencyMs: row.latencyMs,
            stopReason: row.stopReason,
            status: row.status,
            attempts: row.attempts,
            tieredUp: row.tieredUp,
            errorCode: row.errorCode,
            providerRequestId: row.providerRequestId,
            callKind: row.callKind,
            budgetClass: row.budgetClass,
            traceId: row.traceId,
          })
          .returning({ id: llmCalls.id });
        if (spend && row.budgetClass !== "eval" && (spend.pipelineUsd > 0 || spend.interactiveUsd > 0)) {
          await tx
            .insert(userDailyUsage)
            .values({
              userId: spend.userId,
              day: new Date().toISOString().slice(0, 10),
              pipelineUsd: spend.pipelineUsd.toFixed(6),
              interactiveUsd: spend.interactiveUsd.toFixed(6),
            })
            .onConflictDoUpdate({
              target: [userDailyUsage.userId, userDailyUsage.day],
              set: {
                pipelineUsd: sqlAdd(userDailyUsage.pipelineUsd, spend.pipelineUsd),
                interactiveUsd: sqlAdd(userDailyUsage.interactiveUsd, spend.interactiveUsd),
                updatedAt: new Date(),
              },
            });
        }
        return String(inserted?.id ?? 0);
      });
    } catch (err) {
      if (attempt === 3) {
        logger.error({ agent: row.agentId, requestId: row.providerRequestId, err: (err as Error).message }, "llm_ledger_write_failed");
        return null;
      }
      await new Promise((r) => setTimeout(r, attempt * 700));
    }
  }
  return null;
}

/** `coalesce(col, 0) + delta` for the numeric counters. */
function sqlAdd(column: SQLWrapper, delta: number) {
  return sql`coalesce(${column}, 0) + ${delta.toFixed(6)}`;
}
