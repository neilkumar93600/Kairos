import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { jobs } from "./catalog";
import { matchStatus } from "./enums";

/**
 * A job scored for one user. Only rows with passedFilters and score >= the user's threshold reach the queue; a score
 * below it is kept as below_bar (server only) so it is never paid for twice. matches_status_guard: a user decision
 * (queued, skipped) is never overridden by the system.
 */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    passedFilters: boolean("passed_filters").notNull(),
    score: integer("score"),
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    status: matchStatus("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").$type<"pipeline" | "manual_url">().notNull().default("pipeline"),
    selection: text("selection")
      .$type<"ranked" | "explore" | "express" | "backfill" | "rebalance" | "rescore" | "import">()
      .notNull()
      .default("ranked"),
    prerankScore: smallint("prerank_score"),
    /** 'fit-scorer@v<N>'. */
    scorerVersion: text("scorer_version"),
    mustHaveHits: jsonb("must_have_hits"),
    /** llm_calls.id; no FK, the partition may be dropped. */
    llmCallId: bigint("llm_call_id", { mode: "number" }),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    /** Set by matches_status_guard; the retention clock. */
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("matches_user_job_uq").on(t.userId, t.jobId),
    index("matches_user_status_idx").on(t.userId, t.status),
    index("matches_job_idx").on(t.jobId),
    index("matches_user_new_idx").on(t.userId, t.createdAt.desc()).where(sql`${t.status} = 'new'`),
    index("matches_retention_idx").on(t.statusChangedAt).where(sql`${t.status} IN ('below_bar','expired')`),
    check("matches_score_ck", sql`score IS NULL OR score BETWEEN 0 AND 100`),
    check("matches_prerank_ck", sql`prerank_score IS NULL OR prerank_score BETWEEN 0 AND 100`),
    check("matches_source_ck", sql`source IN ('pipeline','manual_url')`),
    check("matches_selection_ck", sql`selection IN ('ranked','explore','express','backfill','rebalance','rescore','import')`),
    check("matches_source_selection_ck", sql`(source = 'manual_url') = (selection = 'import')`),
    check("matches_failed_gate_ck", sql`passed_filters OR (source = 'manual_url' AND status <> 'new')`),
    check(
      "matches_must_have_ck",
      sql`must_have_hits IS NULL OR (jsonb_typeof(must_have_hits) IN ('array','object') AND octet_length(must_have_hits::text) <= 2048)`,
    ),
    check("matches_scorer_version_ck", sql`scorer_version IS NULL OR scorer_version ~ '^[a-z][a-z0-9-]{1,40}@v[0-9]{1,4}$'`),
  ],
);
