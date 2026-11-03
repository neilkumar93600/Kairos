import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { ImportSourceKind, ParseStatus, Preferences, ResumeInput, ResumeKind, RevisionReason } from "@auto-career/shared";
import { applications } from "./applications";
import { user } from "./auth";
import { jobs } from "./catalog";
import { factKind } from "./enums";
import { bytea } from "./platform";

export const FORWARDING_STATES = ["not_started", "awaiting_verification", "verified_pending_first_mail", "active", "stale"] as const;
export const MAIL_OPT_OUTS = ["digest", "outcome_report", "autopilot_summary", "reminders"] as const;

/**
 * One row per user: contact details, search preferences, their reply-forwarding address, the offer pause, opt-outs
 * and version counters (02-database 7.1.2). profiles_guard (migration 0007) owns preferences_version, keeps
 * onboarding forward-only and the forwarding address fixed. sensitive_answers_enc and normalized_email_hash never
 * leave the server: routes select the columns they return.
 */
export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    phone: text("phone"),
    city: text("city"),
    country: text("country"),
    linkedinUrl: text("linkedin_url"),
    githubUrl: text("github_url"),
    portfolioUrl: text("portfolio_url"),
    preferences: jsonb("preferences").$type<Preferences>(),
    onboardingStep: text("onboarding_step").notNull().default("resume"),
    forwardingAddress: text("forwarding_address").notNull().unique(),
    /** Reply-forwarding setup, owned by messaging (16.x). */
    forwardingState: text("forwarding_state").$type<(typeof FORWARDING_STATES)[number]>().notNull().default("not_started"),
    /** Set while an offer pause holds this user's sends (approveCore skips them). */
    applicationsPausedAt: timestamp("applications_paused_at", { withTimezone: true }),
    /** HMAC of the normalized sign-up address, for the free-grant abuse rule. */
    normalizedEmailHash: text("normalized_email_hash"),
    /** EEO, disability, veteran, visa and salary answers, AES-256-GCM (lib/crypto.ts); never sent to a model. */
    sensitiveAnswersEnc: bytea("sensitive_answers_enc"),
    timezone: text("timezone").notNull().default("UTC"),
    preferencesVersion: integer("preferences_version").notNull().default(0),
    factsVersion: integer("facts_version").notNull().default(0),
    /** Non-transactional mail kinds the user stopped. */
    mailOptOut: text("mail_opt_out").array().$type<(typeof MAIL_OPT_OUTS)[number][]>().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("profiles_normalized_email_idx").on(t.normalizedEmailHash).where(sql`${t.normalizedEmailHash} is not null`),
    check("profiles_onboarding_step_ck", sql`onboarding_step IN ('resume','confirm-facts','done')`),
    check(
      "profiles_forwarding_address_ck",
      sql`forwarding_address = lower(forwarding_address) AND forwarding_address ~ '^[a-z0-9._+-]+@[a-z0-9.-]+\\.[a-z]{2,}$'`,
    ),
    check(
      "profiles_forwarding_state_ck",
      sql`forwarding_state IN ('not_started','awaiting_verification','verified_pending_first_mail','active','stale')`,
    ),
    check("profiles_lengths_ck", sql`char_length(phone) <= 40 AND char_length(city) <= 120 AND char_length(country) <= 120`),
    check(
      "profiles_urls_ck",
      sql`linkedin_url ~* '^https?://[^[:space:]]+$' AND char_length(linkedin_url) <= 300
        AND github_url ~* '^https?://[^[:space:]]+$' AND char_length(github_url) <= 300
        AND portfolio_url ~* '^https?://[^[:space:]]+$' AND char_length(portfolio_url) <= 300`,
    ),
    check("profiles_email_hash_ck", sql`normalized_email_hash ~ '^[0-9a-f]{64}$'`),
    check("profiles_sensitive_enc_ck", sql`octet_length(sensitive_answers_enc) BETWEEN 29 AND 16384`),
    check("profiles_preferences_ck", sql`preferences IS NULL OR preferences_valid(preferences)`),
    check("profiles_versions_ck", sql`preferences_version >= 0 AND facts_version >= 0`),
    check(
      "profiles_mail_opt_out_ck",
      sql`mail_opt_out <@ ARRAY['digest','outcome_report','autopilot_summary','reminders']::text[] AND cardinality(mail_opt_out) <= 4`,
    ),
  ],
);

/** A base resume. Plans allow 1, 3 or 10 of these. */
export const resumeProfiles = pgTable(
  "resume_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    sourceText: text("source_text").notNull(),
    fileKey: text("file_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resume_profiles_user_idx").on(t.userId)],
);

/**
 * Base resumes and tailored copies (PRD 6.1, 12; 02-database 7.1.7 as amended): up to 10 bases per resume profile, one
 * default base per profile, at most one active tailored copy per job. Design settings (template, accent, page size,
 * level, headline) live in `document` (ResumeInput), not in columns. resumes_guard (migration) bumps `version` when the
 * document changes; `document_hash` is change detection only.
 */
export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Set on every row the code writes; the migration attaches the old ones to the user's default profile. */
    resumeProfileId: uuid("resume_profile_id").references(() => resumeProfiles.id, { onDelete: "set null" }),
    kind: text("kind").$type<ResumeKind>().notNull().default("base"),
    /** The library name ("Frontend"); the document's own name is the person's. */
    name: text("name").notNull().default("Resume"),
    isDefault: boolean("is_default").notNull().default(false),
    targetRoles: text("target_roles").array().notNull().default(sql`'{}'::text[]`),
    /** A tailored copy's base; null once that base is deleted (PRD 6.1). */
    baseResumeId: uuid("base_resume_id").references((): AnyPgColumn => resumes.id, { onDelete: "set null" }),
    /** The base's version when the copy was made: baseChanged is base.version > this (PRD 6.3). */
    baseVersion: integer("base_version"),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    applicationId: uuid("application_id").references((): AnyPgColumn => applications.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    documentHash: text("document_hash").generatedAlwaysAs(sql`md5(document::text)`),
    document: jsonb("document").$type<ResumeInput>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resumes_resume_profile_idx").on(t.resumeProfileId).where(sql`${t.resumeProfileId} is not null`),
    index("resumes_user_kind_idx").on(t.userId, t.kind, t.updatedAt),
    uniqueIndex("resumes_default_uq").on(t.resumeProfileId).where(sql`${t.isDefault} and ${t.kind} = 'base' and ${t.archivedAt} is null`),
    uniqueIndex("resumes_user_job_uq").on(t.userId, t.jobId).where(sql`${t.kind} = 'tailored' and ${t.archivedAt} is null and ${t.jobId} is not null`),
    index("resumes_base_idx").on(t.baseResumeId).where(sql`${t.baseResumeId} is not null`),
    index("resumes_job_idx").on(t.jobId).where(sql`${t.jobId} is not null`),
    index("resumes_application_idx").on(t.applicationId).where(sql`${t.applicationId} is not null`),
    check("resumes_kind_ck", sql`kind IN ('base','tailored')`),
    check("resumes_shape_ck", sql`(kind = 'base' AND job_id IS NULL AND base_resume_id IS NULL AND application_id IS NULL) OR (kind = 'tailored' AND NOT is_default)`),
    check("resumes_name_ck", sql`char_length(btrim(name)) BETWEEN 1 AND 80`),
    check("resumes_target_roles_ck", sql`cardinality(target_roles) <= 10`),
    check("resumes_version_ck", sql`version >= 1 AND (base_version IS NULL OR base_version >= 1)`),
    check("resumes_document_ck", sql`jsonb_typeof(document) = 'object' AND octet_length(document::text) <= 400000`),
  ],
);

/**
 * The document as it was before a change (F4; PRD 6.1): written only by snapshot_resume() (migration), which coalesces
 * edits within 10 minutes and keeps the 50 newest unnamed revisions and every named one.
 */
export const resumeRevisions = pgTable(
  "resume_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    document: jsonb("document").$type<ResumeInput>().notNull(),
    reason: text("reason").$type<RevisionReason>().notNull().default("edit"),
    name: text("name"),
    createdBy: text("created_by").$type<"user" | "system">().notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resume_revisions_resume_idx").on(t.resumeId, t.createdAt),
    check("resume_revisions_reason_ck", sql`reason IN ('edit','named','before_ai','before_tailor','restore')`),
    check("resume_revisions_name_ck", sql`name IS NULL OR char_length(btrim(name)) BETWEEN 1 AND 80`),
    check("resume_revisions_created_by_ck", sql`created_by IN ('user','system')`),
  ],
);

/**
 * One import source of a resume profile (PRD 6.4, 12, D8; 02-database 7.7): pasted text or an uploaded PDF, DOCX or
 * LinkedIn PDF. The extracted text is stored only encrypted (lib/crypto.ts, AAD resume_imports:<id>:source_text); the
 * original file sits in R2 under uploads/<user_id>/. The parse job claims by this row.
 */
export const resumeImports = pgTable(
  "resume_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    resumeProfileId: uuid("resume_profile_id")
      .notNull()
      .references(() => resumeProfiles.id, { onDelete: "cascade" }),
    sourceKind: text("source_kind").$type<ImportSourceKind>().notNull(),
    fileName: text("file_name"),
    fileKey: text("file_key"),
    sourceTextEnc: bytea("source_text_enc").notNull(),
    sourceHash: text("source_hash").notNull(),
    parseStatus: text("parse_status").$type<ParseStatus>().notNull().default("pending"),
    parseAttempts: smallint("parse_attempts").notNull().default(0),
    parseError: text("parse_error"),
    parserVersion: smallint("parser_version"),
    parsedAt: timestamp("parsed_at", { withTimezone: true }),
    /** Bank facts this import found again ("Already in your profile", PRD 6.4); shown, never inserted twice. */
    duplicateFactIds: uuid("duplicate_fact_ids").array().notNull().default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resume_imports_user_idx").on(t.userId),
    check("resume_imports_duplicates_ck", sql`cardinality(duplicate_fact_ids) <= 200`),
    uniqueIndex("resume_imports_source_uq").on(t.resumeProfileId, t.sourceHash),
    index("resume_imports_pending_idx").on(t.updatedAt).where(sql`${t.parseStatus} in ('pending','parsing')`),
    check("resume_imports_kind_ck", sql`source_kind IN ('pdf','docx','linkedin_pdf','text')`),
    check("resume_imports_file_name_ck", sql`char_length(file_name) BETWEEN 1 AND 120`),
    check("resume_imports_file_key_ck", sql`starts_with(file_key, 'uploads/' || user_id || '/')`),
    check("resume_imports_enc_ck", sql`octet_length(source_text_enc) BETWEEN 30 AND 262144`),
    check("resume_imports_hash_ck", sql`source_hash ~ '^[0-9a-f]{64}$'`),
    check("resume_imports_status_ck", sql`parse_status IN ('pending','parsing','parsed','failed')`),
    check("resume_imports_error_ck", sql`parse_error ~ '^[a-z0-9_]{1,40}$'`),
    check("resume_imports_attempts_ck", sql`parse_attempts BETWEEN 0 AND 10`),
    check("resume_imports_shape_ck", sql`(parse_status <> 'failed' OR parse_error IS NOT NULL) AND (parse_status <> 'parsed' OR parsed_at IS NOT NULL)`),
  ],
);

/**
 * Jobs, internships and volunteer roles found by an import (F3; 02-database 7.1.4). Not citable itself: a resume
 * heading uses one only once the user confirmed a fact under it, which confirms the employment (employments_guard).
 */
export const employments = pgTable(
  "employments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    resumeProfileId: uuid("resume_profile_id").references(() => resumeProfiles.id, { onDelete: "cascade" }),
    importId: uuid("import_id").references(() => resumeImports.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location"),
    /** The dates as the candidate wrote them, for the heading's meta line. */
    datesText: text("dates_text"),
    startMonth: text("start_month"),
    endMonth: text("end_month"),
    isCurrent: boolean("is_current").notNull().default(false),
    assertedBy: text("asserted_by").$type<"user" | "import" | "model">().notNull().default("import"),
    confirmed: boolean("confirmed").notNull().default(false),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** sha256 of lower(title)|lower(company)|start_month: a re-parse never duplicates a role. */
    importKey: text("import_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("employments_import_uq").on(t.resumeProfileId, t.importKey),
    index("employments_user_idx").on(t.userId),
    index("employments_import_idx").on(t.importId).where(sql`${t.importId} is not null`),
    check("employments_title_ck", sql`char_length(btrim(title)) BETWEEN 1 AND 200`),
    check("employments_company_ck", sql`char_length(btrim(company)) BETWEEN 1 AND 200`),
    check("employments_location_ck", sql`char_length(location) <= 120`),
    check("employments_dates_text_ck", sql`char_length(dates_text) <= 60`),
    check("employments_start_month_ck", sql`start_month ~ '^\\d{4}-(0[1-9]|1[0-2])$'`),
    check("employments_end_month_ck", sql`end_month ~ '^\\d{4}-(0[1-9]|1[0-2])$'`),
    check("employments_dates_ck", sql`start_month IS NULL OR end_month IS NULL OR start_month <= end_month`),
    check("employments_current_ck", sql`NOT is_current OR end_month IS NULL`),
    check("employments_asserted_by_ck", sql`asserted_by IN ('user','import','model')`),
    check("employments_confirmed_at_ck", sql`confirmed = (confirmed_at IS NOT NULL)`),
    check("employments_import_key_ck", sql`import_key ~ '^[0-9a-f]{64}$'`),
  ],
);

/** Atomic facts parsed from a resume. Tailored lines must cite these ids (the truth lock). */
export const facts = pgTable(
  "facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    resumeProfileId: uuid("resume_profile_id").references(() => resumeProfiles.id, { onDelete: "cascade" }),
    kind: factKind("kind").notNull(),
    text: text("text").notNull(),
    sourceSpan: text("source_span"),
    /** sha256(kind|employment key|normalized text): the import identity, never returned by a route (02-database 7.1.5). */
    sourceSpanHash: text("source_span_hash"),
    /** The import this fact came from (PRD 12); a re-parse replaces only that import's unconfirmed facts. */
    importId: uuid("import_id").references(() => resumeImports.id, { onDelete: "set null" }),
    employmentId: uuid("employment_id").references(() => employments.id, { onDelete: "set null" }),
    confirmed: boolean("confirmed").notNull().default(false),
    /** Whose words these are (database-37): the user's own, a resume import, or a model proposal. facts_guard sets 'user' on an edit. */
    assertedBy: text("asserted_by").$type<"user" | "import" | "model">().notNull().default("import"),
    /** Owned by facts_guard: set when the user confirms, cleared when they unconfirm. */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Owned by facts_guard. */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("facts_user_idx").on(t.userId),
    check("facts_asserted_by_ck", sql`asserted_by IN ('user','import','model')`),
    check("facts_confirmed_at_ck", sql`confirmed = (confirmed_at IS NOT NULL)`),
    index("facts_resume_profile_idx").on(t.resumeProfileId).where(sql`${t.resumeProfileId} is not null`),
    check("facts_span_hash_ck", sql`source_span_hash ~ '^[0-9a-f]{64}$'`),
    // Built CONCURRENTLY by hand in their own no-transaction migration (facts may pass 100,000 rows).
    uniqueIndex("facts_import_identity_uq").on(t.resumeProfileId, t.sourceSpanHash),
    index("facts_import_idx").on(t.importId).where(sql`${t.importId} is not null`),
    index("facts_employment_idx").on(t.employmentId).where(sql`${t.employmentId} is not null`),
  ],
);

/** Answers the user approved, reused across applications (e.g. "Are you authorized to work in the US?"). */
export const savedAnswers = pgTable(
  "saved_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionKey: text("question_key").notNull(),
    label: text("label").notNull(),
    answer: text("answer").notNull(),
    approved: boolean("approved").notNull().default(false),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_answers_user_question_uq").on(t.userId, t.questionKey)],
);
