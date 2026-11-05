import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
// The column type only; platform.ts's tables stay out of schema/index.ts.
import { bytea } from "./platform";

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
      // WP-26 adds the per-agent families (03-agent-runtime 4.5, 14.2) and verifier_mode:<path> (agents/08 8).
      sql`key ~ '^(pause_cloud_apply|pause_scoring|llm_paused|approvals_frozen|cloud_applier_open|llm_shed_level|extension_only:(greenhouse|lever|ashby)|verifier_mode:(suggestions|tailor|drafts|prepare|patch)|(agent_disabled|prompt_pin|model_pin|prompt_canary|prompt_shadow):(resume-parser|jd-analyst|fit-scorer|resume-tailor|resume-writer|answer-drafter|cover-letter-writer|claim-verifier|claim-verifier-escalation|reply-classifier|outcome-analyst|interview-coach))$'`,
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

/**
 * 02-database 7.6.5 (WP-26): the 24-hour memo of claim-verifier verdicts. No text and no user id: claim_hash is an
 * HMAC under USER_HASH_KEY of the claim, its cited fact ids and texts, the target and the verifier version
 * (services/verify.ts), so a guessed claim cannot be tested against it. 'uncertain' is never cached. Unlogged (a crash
 * empties it, which only costs re-verification); migration 0018 sets that by hand.
 */
export const verifiedClaims = pgTable(
  "verified_claims",
  {
    claimHash: bytea("claim_hash").primaryKey(),
    verdict: text("verdict").notNull(),
    checkSource: text("check_source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check("verified_claims_hash_ck", sql`octet_length(${t.claimHash}) = 32`),
    check("verified_claims_verdict_ck", sql`${t.verdict} in ('supported', 'unsupported', 'contradicted')`),
    check("verified_claims_source_ck", sql`${t.checkSource} in ('verifier', 'escalation')`),
    check("verified_claims_expiry_ck", sql`${t.expiresAt} > ${t.createdAt} and ${t.expiresAt} <= ${t.createdAt} + interval '24 hours'`),
    index("verified_claims_expires_idx").on(t.expiresAt),
  ],
);
