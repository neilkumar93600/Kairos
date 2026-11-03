import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { applications, type ApplicationFailureCode } from "./applications";
import { user } from "./auth";
import { atsProvider, submitChannel } from "./enums";

/**
 * One send attempt of one application, on either channel (02-database 7.3.2): the attempt-phase protocol. At most one
 * open attempt per application (INV-4); the phase only moves forward and a settled attempt is final unless its outcome
 * was ambiguous (submission_attempts_guard). WP-29 writes it.
 */
export const submissionAttempts = pgTable(
  "submission_attempts",
  {
    /** settle:<attempt_id>. */
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attemptNo: integer("attempt_no").notNull(),
    channel: submitChannel("channel").notNull(),
    ats: atsProvider("ats").notNull(),
    approvedBy: text("approved_by").$type<"user" | "autopilot">(),
    phase: text("phase").$type<"claimed" | "navigating" | "filling" | "submit_seen" | "reported">().notNull().default("claimed"),
    state: text("state").$type<"open" | "submitted" | "failed" | "needs_check">().notNull().default("open"),
    failureCode: text("failure_code").$type<ApplicationFailureCode>(),
    /** Never field values; nulled 90 days after settlement. */
    evidence: jsonb("evidence"),
    sessionId: text("session_id"),
    leaseConflict: boolean("lease_conflict").notNull().default(false),
    duplicateReports: integer("duplicate_reports").notNull().default(0),
    lateConfirmation: boolean("late_confirmation").notNull().default(false),
    workerIdentity: text("worker_identity"),
    /** Replay guard: a browser that launched never clicks again. */
    browserLaunchedAt: timestamp("browser_launched_at", { withTimezone: true }),
    submitSeenAt: timestamp("submit_seen_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("submission_attempts_app_attempt_uq").on(t.applicationId, t.attemptNo, t.channel),
    uniqueIndex("submission_attempts_one_open_uq").on(t.applicationId).where(sql`${t.state} = 'open'`),
    index("submission_attempts_user_idx").on(t.userId, t.startedAt.desc()),
    index("submission_attempts_unsettled_idx").on(t.finishedAt).where(sql`${t.state} <> 'open' AND ${t.settledAt} IS NULL`),
    check("submission_attempts_no_ck", sql`attempt_no >= 1 AND duplicate_reports >= 0`),
    check("submission_attempts_phase_ck", sql`phase IN ('claimed','navigating','filling','submit_seen','reported')`),
    check("submission_attempts_state_ck", sql`state IN ('open','submitted','failed','needs_check')`),
    check(
      "submission_attempts_code_ck",
      sql`failure_code IS NULL OR failure_code IN ('challenge','posting_closed','required_missing','applier_error','unconfirmed','timeout',
        'no_report','plan_lapsed','cloud_unavailable_for_ats','extension_reported','render_failed')`,
    ),
    check("submission_attempts_approved_by_ck", sql`approved_by IS NULL OR approved_by IN ('user','autopilot')`),
    check("submission_attempts_finished_ck", sql`(state = 'open') = (finished_at IS NULL)`),
    check(
      "submission_attempts_result_ck",
      sql`(state = 'open' AND failure_code IS NULL)
        OR (state = 'submitted' AND (failure_code IS NULL OR late_confirmation))
        OR (state = 'failed' AND failure_code IS NOT NULL)
        OR (state = 'needs_check' AND failure_code IN ('unconfirmed','timeout','no_report'))`,
    ),
    check(
      "submission_attempts_settled_ck",
      sql`(settled_at IS NULL OR state <> 'open')
        AND NOT (state = 'failed' AND settled_at IS NOT NULL AND failure_code IN ('unconfirmed','timeout','no_report'))`,
    ),
    check(
      "submission_attempts_channel_ck",
      sql`(channel = 'extension' OR session_id IS NULL)
        AND (channel = 'cloud' OR (worker_identity IS NULL AND browser_launched_at IS NULL AND submit_seen_at IS NULL AND heartbeat_at IS NULL))`,
    ),
    check(
      "submission_attempts_evidence_ck",
      sql`evidence IS NULL OR (jsonb_typeof(evidence) = 'object' AND pg_column_size(evidence) <= 4096
        AND NOT (evidence ?| ARRAY['filledFields','values','answers','receipt']))`,
    ),
    check(
      "submission_attempts_text_ck",
      sql`(session_id IS NULL OR char_length(session_id) <= 100) AND (worker_identity IS NULL OR char_length(worker_identity) <= 100)`,
    ),
  ],
);
