import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
 * empties it, which only costs re-verification); migration 0019 sets that by hand.
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

/**
 * The durable seam for money and sending (WP-22, ADR-001 Revision 3): one row per piece of follow-up work, written in the
 * same transaction as the business change (durable/outbox.ts), so a crash after the commit cannot lose it. Ids and codes
 * only: the checks below are the floor under emitOutbox's own check, and invariant OX-1 scans what got past both.
 * Not in the privacy registry, on purpose: no user id, and emitOutbox and OX-1 refuse one. An application id left in a row
 * points at nothing once the account's rows cascade, the consumer skips it, and retention removes the row (7 or 90 days).
 * available_at is when someone should next look at the row: the drain for pending, the sweep for enqueued.
 */
export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queue: text("queue").notNull(),
    /** The BullMQ job id: one key is one job, however often it is added. */
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").$type<"pending" | "enqueued" | "done" | "dead">().notNull().default("pending"),
    /** Deliveries that came to nothing (a failed or lost job). A refused add does not count: Redis being down is not the work failing. */
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("outbox_dedupe_key_uq").on(t.dedupeKey),
    // ponytail: the admin list sorts its status's rows in memory; live rows are few. Done rows stay out of the index.
    index("outbox_live_idx").on(t.status, t.availableAt).where(sql`${t.status} <> 'done'`),
    check("outbox_status_ck", sql`status IN ('pending','enqueued','done','dead')`),
    // BullMQ refuses most ids with a colon, so the keys use hyphens (apply-<id>, not the apply:<id> of A.11).
    check("outbox_key_ck", sql`dedupe_key ~ '^[A-Za-z0-9._-]{1,128}$'`),
    check("outbox_queue_ck", sql`queue ~ '^[a-z-]{1,40}$'`),
    check("outbox_payload_ck", sql`jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 1024`),
    check("outbox_attempts_ck", sql`attempts >= 0`),
    check("outbox_error_ck", sql`last_error IS NULL OR last_error ~ '^[a-z0-9_]{1,40}$'`),
  ],
);
