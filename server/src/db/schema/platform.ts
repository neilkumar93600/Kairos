import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { planId } from "./enums";

/**
 * The LLM ledger tables of the backend re-architecture (02-database.md 7.6). They are created by the
 * custom migration drizzle/0002_platform_02_llm_ledger.sql because drizzle-kit cannot express the
 * range partitioning, the BRIN index or the SQL functions; this file exists for typed inserts and
 * is deliberately NOT re-exported from schema/index.ts, so `drizzle-kit generate` never diffs
 * against them (the target layout folds it in when the platform domain migration lands).
 * Indexes, checks and partitions are owned by the SQL migration.
 */

/** bytea column; values are digests and hashes, never text. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * One row per billed Anthropic send and per budget refusal. Partitioned weekly by created_at;
 * the partition children (llm_calls_<IYYY>w<IW>, llm_calls_default) exist only in SQL.
 */
export const llmCalls = pgTable("llm_calls", {
  // Sequence-backed in SQL; the .default only tells drizzle the column may be omitted on insert.
  id: bigint("id", { mode: "number" }).notNull().default(sql`nextval('llm_calls_id_seq')`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  agentId: text("agent_id").notNull(),
  promptVersion: smallint("prompt_version").notNull(),
  promptSha256: bytea("prompt_sha256").notNull(),
  model: text("model").notNull(),
  workspace: text("workspace").notNull(),
  isBatch: boolean("is_batch").notNull().default(false),
  plan: planId("plan"),
  userHash: bytea("user_hash"),
  applicationId: uuid("application_id"),
  jobId: uuid("job_id"),
  inputRefs: jsonb("input_refs"),
  inputHash: bytea("input_hash").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 8 }).notNull().default("0"),
  latencyMs: integer("latency_ms"),
  stopReason: text("stop_reason"),
  status: text("status").notNull(),
  attempts: smallint("attempts").notNull().default(1),
  tieredUp: boolean("tiered_up").notNull().default(false),
  errorCode: text("error_code"),
  providerRequestId: text("provider_request_id"),
  callKind: text("call_kind").notNull().default("primary"),
  budgetClass: text("budget_class").notNull().default("pipeline"),
  traceId: text("trace_id"),
  batchId: text("batch_id"),
});

/** Daily roll-up recomputed from llm_calls by llm_cost_rollup_day; kept forever. */
export const llmCostDaily = pgTable("llm_cost_daily", {
  day: date("day").notNull(),
  agentId: text("agent_id").notNull(),
  workspace: text("workspace").notNull(),
  plan: text("plan").notNull(),
  model: text("model").notNull(),
  isBatch: boolean("is_batch").notNull(),
  calls: integer("calls").notNull(),
  callsOk: integer("calls_ok").notNull().default(0),
  callsSchemaInvalid: integer("calls_schema_invalid").notNull().default(0),
  callsMaxTokens: integer("calls_max_tokens").notNull().default(0),
  callsBlocked: integer("calls_blocked").notNull().default(0),
  callsError: integer("calls_error").notNull().default(0),
  callsBudgetStopped: integer("calls_budget_stopped").notNull().default(0),
  callsTieredUp: integer("calls_tiered_up").notNull().default(0),
  inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
  cacheReadTokens: bigint("cache_read_tokens", { mode: "number" }).notNull().default(0),
  cacheWriteTokens: bigint("cache_write_tokens", { mode: "number" }).notNull().default(0),
  outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 14, scale: 8 }).notNull(),
  latencyMsSum: bigint("latency_ms_sum", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user UTC-day counters: spend caps, demand budget, hard-filter counters. */
export const userDailyUsage = pgTable("user_daily_usage", {
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  scored: integer("scored").notNull().default(0),
  filtered: jsonb("filtered").notNull().default({}),
  pipelineUsd: numeric("pipeline_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  interactiveUsd: numeric("interactive_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  drafts: integer("drafts").notNull().default(0),
  matchActions: integer("match_actions").notNull().default(0),
  autopilotSends: integer("autopilot_sends").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** F11: per-feature daily allowance counters. Limits live only in shared/src/plans.ts. */
export const aiUsage = pgTable("ai_usage", {
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  feature: text("feature").notNull(),
  used: integer("used").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
