import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Preferences, ResumeInput } from "@auto-career/shared";
import { user } from "./auth";
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
 * The structured base resume the workspace edits (web contract: GET/PUT /api/resume).
 * ponytail: one per user while the web contract has a single resume; key on (userId, resumeProfileId) when slots ship.
 */
export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    resumeProfileId: uuid("resume_profile_id").references(() => resumeProfiles.id, { onDelete: "set null" }),
    document: jsonb("document").$type<ResumeInput>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("resumes_user_uq").on(t.userId),
    index("resumes_resume_profile_idx").on(t.resumeProfileId).where(sql`${t.resumeProfileId} is not null`),
  ],
);

/** A snapshot per save, so every change to the base resume can be undone. */
export const resumeRevisions = pgTable(
  "resume_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    document: jsonb("document").$type<ResumeInput>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resume_revisions_resume_idx").on(t.resumeId, t.createdAt)],
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
