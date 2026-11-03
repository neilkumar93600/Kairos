import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Operator switches (WP-27): pause_cloud_apply, pause_scoring, llm_paused, approvals_frozen, llm_shed_level,
 * extension_only:<ats>. lib/flags.ts reads them with a 10 s cache; env values stay as the fallback.
 */
export const opsFlags = pgTable(
  "ops_flags",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    // Only the keys lib/flags.ts knows: a typo written by hand cannot sit there silently doing nothing.
    check(
      "ops_flags_key_ck",
      sql`key ~ '^(pause_cloud_apply|pause_scoring|llm_paused|approvals_frozen|cloud_applier_open|llm_shed_level|extension_only:(greenhouse|lever|ashby))$'`,
    ),
  ],
);

/** Product feature toggles, read by the same loader. Nothing reads one yet; the table is the home for the first. */
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  note: text("note"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per operator or monitor write (flags, company activation, invariant freezes). Append-only: no runtime role
 * holds UPDATE or DELETE on it (ops/provision-roles.sql) and the trigger in migration 0009 blocks the owner too. `actor` is a user id or "system:<job>"; never free text.
 */
export const opsAudit = pgTable(
  "ops_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    target: text("target").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
  },
  (t) => [index("ops_audit_at_idx").on(t.at.desc())],
);

/**
 * Counters, gauges and SLO good/total pairs, one row per (minute, name, label) (lib/metrics.ts). Aggregates only: a
 * label is a route group, queue or ATS, never a user id or text. Kept 35 days.
 */
export const metricsMinute = pgTable(
  "metrics_minute",
  {
    minute: timestamp("minute", { withTimezone: true }).notNull(),
    name: text("name").notNull(),
    label: text("label").notNull().default(""),
    value: doublePrecision("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.minute, t.name, t.label] }), index("metrics_minute_name_minute_idx").on(t.name, t.minute)],
);
