import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { ApplicationAnswer, ResumeLine } from "@auto-career/shared";
import { user } from "./auth";
import { jobs } from "./catalog";
import { applicationStatus, submitChannel } from "./enums";
import { matches } from "./matching";
import { resumeProfiles } from "./profile";

export interface Receipt {
  filledFields: { fieldKey: string; label: string; value: string }[];
  confirmationText?: string;
  channel: "extension" | "cloud";
  /** The extension's own clock, kept here only: applications.submitted_at is server time (applications-v01). */
  clientSubmittedAt?: string;
}

/** The failure codes (_db/applications.md 4.8): which charge, which are resendable, which are ambiguous (needs_check). */
export const FAILURE_CODES = [
  "challenge",
  "posting_closed",
  "required_missing",
  "applier_error",
  "unconfirmed",
  "timeout",
  "no_report",
  "plan_lapsed",
  "cloud_unavailable_for_ats",
  "extension_reported",
  "render_failed",
] as const;
export type ApplicationFailureCode = (typeof FAILURE_CODES)[number];
export type DraftState = "pending" | "ready" | "failed" | "needs_facts" | "stale" | "expired";
/** Reply-driven, forward only (applications_guard_stage); rejected is final. */
export type ApplicationStage = "applied" | "in_review" | "assessment" | "interviewing" | "offer" | "rejected";

/** One application. A unique (user, job) pair means a retry can never send twice. */
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
    resumeProfileId: uuid("resume_profile_id").references(() => resumeProfiles.id, { onDelete: "set null" }),
    status: applicationStatus("status").notNull().default("draft"),
    channel: submitChannel("channel"),
    resumeLines: jsonb("resume_lines").$type<ResumeLine[]>().notNull().default([]),
    answers: jsonb("answers").$type<ApplicationAnswer[]>().notNull().default([]),
    coverLetter: text("cover_letter"),
    receipt: jsonb("receipt").$type<Receipt>(),
    failureReason: text("failure_reason"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Lifecycle columns (02-database 7.3.1; WP-42). Their writers arrive with WP-29 (attempts, leases, settlement) and WP-41 (prepare).
    approvedBy: text("approved_by").$type<"user" | "autopilot">(),
    draftState: text("draft_state").$type<DraftState>().notNull().default("pending"),
    draftIssue: text("draft_issue"),
    /** Preparation generation: prepare:<id>:<revision>. */
    revision: integer("revision").notNull().default(1),
    /** The ETag; owned by applications_row_version_bu, which moves it by one on a client-visible change. */
    rowVersion: integer("row_version").notNull().default(0),
    /** Incremented by every approval: apply:<id>:<attempt_no>. */
    attemptNo: integer("attempt_no").notNull().default(0),
    /** Soft pointer to submission_attempts (no FK), verified nightly. */
    currentAttemptId: uuid("current_attempt_id"),
    leaseSessionId: text("lease_session_id"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    resumeLineEntries: jsonb("resume_line_entries").$type<Record<string, string>>(),
    /** Question snapshot with plan and sensitive flag; null after the scrub. */
    questions: jsonb("questions").$type<unknown[]>(),
    verification: jsonb("verification").$type<{ state: "none" | "pending" | "passed" | "failed" } & Record<string, unknown>>(),
    factsSnapshotHash: text("facts_snapshot_hash"),
    /**
     * The tailored resume document with its template, accent and page size (PRD 6.1, 7.6), written by every approval in
     * the approving transaction (a resend after failed writes a new one). applications_guard_snapshot keeps it fixed
     * while the application is approved, submitting or submitted; return-to-draft clears it. The authoritative sent
     * document: the receipt, the render job and the applier's attach read it, never resumes.application_id (a soft
     * link for the library UI only).
     */
    resumeSnapshot: jsonb("resume_snapshot"),
    /** R2 key of the rendered snapshot PDF under snapshots/<user_id>/, set once per approval by the render job. */
    resumeFileKey: text("resume_file_key"),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    /** A below_bar manual import the user chose to prepare; Autopilot never sends it. */
    gateOverride: boolean("gate_override").notNull().default(false),
    receiptSummary: jsonb("receipt_summary").$type<{ filled: number; total: number; skipped: number; generated: number }>(),
    stage: text("stage").$type<ApplicationStage>(),
    failureCode: text("failure_code").$type<ApplicationFailureCode>(),
    /** Set by applications_guard_status on entering submitted, failed or withdrawn. */
    terminalAt: timestamp("terminal_at", { withTimezone: true }),
    contentScrubbedAt: timestamp("content_scrubbed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("applications_user_job_uq").on(t.userId, t.jobId),
    index("applications_user_status_idx").on(t.userId, t.status),
    index("applications_job_idx").on(t.jobId),
    index("applications_match_idx").on(t.matchId).where(sql`${t.matchId} is not null`),
    index("applications_resume_profile_idx").on(t.resumeProfileId).where(sql`${t.resumeProfileId} is not null`),
    // INV-3: nothing past draft without an approval time and a channel (02-database 7.3.1, before approved_by exists).
    check(
      "applications_approval_shape_ck",
      sql`(status IN ('approved','submitting','submitted','failed') AND approved_at IS NOT NULL AND channel IS NOT NULL)
        OR (status = 'draft' AND approved_at IS NULL AND channel IS NULL) OR status IN ('withdrawn','refunded')`,
    ),
    // Not here yet: the spec's approval shape with approved_by, failed_shape, stage_shape and submitting_ck. A NOT VALID
    // check still holds every new write, and today's approve, report and claim code writes none of those columns; they
    // arrive with the writers that satisfy them (WP-29, then the contract migration).
    check("applications_draft_state_ck", sql`draft_state IN ('pending','ready','failed','needs_facts','stale','expired')`),
    check("applications_draft_issue_ck", sql`draft_issue IS NULL OR draft_issue ~ '^[a-z0-9_:.-]{1,80}$'`),
    check("applications_counters_ck", sql`revision >= 1 AND row_version >= 0 AND attempt_no >= 0`),
    check("applications_approved_by_ck", sql`approved_by IS NULL OR approved_by IN ('user','autopilot')`),
    check(
      "applications_failure_code_ck",
      sql`failure_code IS NULL OR failure_code IN ('challenge','posting_closed','required_missing','applier_error','unconfirmed','timeout',
        'no_report','plan_lapsed','cloud_unavailable_for_ats','extension_reported','render_failed')`,
    ),
    check("applications_stage_ck", sql`stage IS NULL OR stage IN ('applied','in_review','assessment','interviewing','offer','rejected')`),
    check(
      "applications_lease_ck",
      sql`(lease_session_id IS NULL) = (lease_expires_at IS NULL)
        AND (lease_session_id IS NULL OR (status IN ('approved','submitting') AND channel = 'extension'))`,
    ),
    check("applications_autopilot_ck", sql`approved_by IS DISTINCT FROM 'autopilot' OR gate_override = false`),
    check(
      "applications_expired_ck",
      sql`draft_state <> 'expired' OR (status IN ('draft','withdrawn') AND resume_lines = '[]'::jsonb AND answers = '[]'::jsonb
        AND cover_letter IS NULL AND resume_file_key IS NULL AND resume_snapshot IS NULL)`,
    ),
    check("applications_scrub_ck", sql`content_scrubbed_at IS NULL OR status IN ('submitted','withdrawn')`),
    check("applications_file_key_ck", sql`resume_file_key IS NULL OR starts_with(resume_file_key, 'snapshots/' || user_id || '/')`),
    check(
      "applications_snapshot_ck",
      sql`(status <> 'draft' OR (resume_snapshot IS NULL AND resume_file_key IS NULL))
        AND (resume_snapshot IS NULL OR octet_length(resume_snapshot::text) <= 400000)`,
    ),
    check(
      "applications_json_ck",
      sql`jsonb_typeof(resume_lines) = 'array' AND jsonb_array_length(resume_lines) <= 200
        AND jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) <= 200
        AND (questions IS NULL OR (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) <= 200))
        AND (verification IS NULL OR (jsonb_typeof(verification) = 'object'
             AND verification->>'state' IN ('none','pending','passed','failed') AND pg_column_size(verification) <= 16384))
        AND (resume_line_entries IS NULL OR (jsonb_typeof(resume_line_entries) = 'object' AND pg_column_size(resume_line_entries) <= 16384))
        AND (receipt IS NULL OR jsonb_typeof(receipt) = 'object')
        AND (receipt_summary IS NULL OR jsonb_typeof(receipt_summary) = 'object')`,
    ),
    check(
      "applications_text_ck",
      sql`(facts_snapshot_hash IS NULL OR facts_snapshot_hash ~ '^[0-9a-f]{64}$')
        AND (resume_file_key IS NULL OR char_length(resume_file_key) <= 200)
        AND (failure_reason IS NULL OR char_length(failure_reason) <= 500)
        AND (lease_session_id IS NULL OR char_length(lease_session_id) <= 100)`,
    ),
    // The lifecycle's reads (02-database 11.2), built concurrently.
    index("applications_list_idx").on(t.userId, t.updatedAt.desc(), t.id.desc()),
    index("applications_user_status_updated_idx").on(t.userId, t.status, t.updatedAt.desc(), t.id.desc()),
    index("applications_ext_queue_idx").on(t.userId, t.approvedAt, t.id).where(sql`${t.status} = 'approved' AND ${t.channel} = 'extension'`),
    index("applications_ext_claim_idx").on(t.id).where(sql`${t.status} = 'submitting' AND ${t.channel} = 'extension'`),
    index("applications_cloud_approved_idx").on(t.approvedAt).where(sql`${t.status} = 'approved' AND ${t.channel} = 'cloud'`),
    index("applications_draft_work_idx").on(t.updatedAt).where(sql`${t.status} = 'draft' AND ${t.draftState} IN ('pending','stale')`),
    index("applications_failed_age_idx").on(t.terminalAt).where(sql`${t.status} = 'failed'`),
    index("applications_submitted_at_idx").on(t.submittedAt).where(sql`${t.submittedAt} IS NOT NULL`),
    index("applications_scrub_due_idx")
      .on(t.terminalAt)
      .where(sql`${t.contentScrubbedAt} IS NULL AND ${t.status} IN ('submitted','withdrawn')`),
  ],
);
