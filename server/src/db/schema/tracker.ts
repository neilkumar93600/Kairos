import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { applications } from "./applications";
import { user } from "./auth";
import { jobs } from "./catalog";

/**
 * One job on the user's tracker board (PRD 9.1, 12; 02-database 7.7). Every application has one, linked by
 * application_id; a tracker-only item has none. WP-42 lands the table because application_events is keyed by it; WP-21
 * builds the board, contacts and interviews on it. notes and salary_text are private: never in an event, a log or a prompt.
 */
export const trackerItems = pgTable(
  "tracker_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** SET NULL: a purged posting must not delete the user's item (job_snapshot keeps the text). */
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    title: text("title"),
    company: text("company"),
    location: text("location"),
    url: text("url"),
    stage: text("stage").$type<"saved" | "drafting" | "applied" | "interviewing" | "offer" | "closed">().notNull().default("saved"),
    stageSetBy: text("stage_set_by").$type<"system" | "user">().notNull().default("system"),
    closedReason: text("closed_reason").$type<"rejected" | "withdrawn" | "not_pursuing" | "posting_closed">(),
    /**
     * A fractional-index key compared byte-wise (ORDER BY position COLLATE "C"; shared positionBetween). The default is the
     * insert time, so a new card sorts after older ones and two cards rarely tie, which a key between them could not split.
     */
    position: text("position")
      .notNull()
      .default(sql`'t' || lpad(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint), 12, '0')`),
    notes: text("notes"),
    salaryText: text("salary_text"),
    /** The posting as saved (PRD 9.3), kept after the job is purged. */
    jobSnapshot: jsonb("job_snapshot"),
    /** When the user last moved the stage: an automatic move older than this is stale (PRD rule 11; jobs/tracker-projector.ts). */
    userMovedAt: timestamp("user_moved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One item per application and per (user, job): INV-4 makes "Save to tracker" and the events helper idempotent.
    uniqueIndex("tracker_items_application_uq").on(t.applicationId).where(sql`${t.applicationId} IS NOT NULL`),
    uniqueIndex("tracker_items_user_job_uq").on(t.userId, t.jobId).where(sql`${t.jobId} IS NOT NULL`),
    index("tracker_items_user_stage_idx").on(t.userId, t.stage),
    index("tracker_items_job_idx").on(t.jobId).where(sql`${t.jobId} IS NOT NULL`),
    check("tracker_items_stage_ck", sql`stage IN ('saved','drafting','applied','interviewing','offer','closed')`),
    check("tracker_items_stage_set_by_ck", sql`stage_set_by IN ('system','user')`),
    check(
      "tracker_items_closed_ck",
      sql`(stage = 'closed') = (closed_reason IS NOT NULL)
        AND (closed_reason IS NULL OR closed_reason IN ('rejected','withdrawn','not_pursuing','posting_closed'))`,
    ),
    check(
      "tracker_items_text_ck",
      sql`(title IS NULL OR char_length(title) BETWEEN 1 AND 500) AND (company IS NULL OR char_length(company) BETWEEN 1 AND 200)
        AND (location IS NULL OR char_length(location) <= 500) AND (url IS NULL OR (char_length(url) <= 2000 AND url ~* '^https?://'))
        AND (notes IS NULL OR char_length(notes) <= 20000) AND (salary_text IS NULL OR char_length(salary_text) <= 200)
        AND char_length(position) BETWEEN 1 AND 64`,
    ),
    check("tracker_items_snapshot_ck", sql`job_snapshot IS NULL OR (jsonb_typeof(job_snapshot) = 'object' AND octet_length(job_snapshot::text) <= 65536)`),
  ],
);

/**
 * The stored timeline kinds (02-database 7.3.4; the last five are the tracker's own, PRD 9.3). Richer than the API's
 * APPLICATION_EVENT_KINDS (shared/src/types.ts): services/events.ts#toApiEvent maps each row to the shared contract.
 */
export const DB_EVENT_KINDS = [
  "drafted",
  "verified",
  "edited",
  "approved",
  "auto_approved",
  "sent",
  "failed",
  "resent",
  "withdrawn",
  "reply_confirmation",
  "reply_rejection",
  "reply_interview",
  "reply_assessment",
  "reply_offer",
  "gone_quiet",
  "reminder_sent",
  "saved",
  "resume_linked",
  "stage_changed",
  "interview_added",
  "note_added",
] as const;
export type DbEventKind = (typeof DB_EVENT_KINDS)[number];
export type EventActor = "user" | "autopilot" | "system" | "employer";

/**
 * Append-only history keyed by tracker item, with a link to the application (owner decision "PRD authoritative";
 * 02-database 7.3.4). Ids, codes and counts only: scalars, 1 KB, no string over 200 characters. Write it through
 * services/events.ts; application_events_immutable refuses UPDATE and DELETE to everyone but a cascade.
 */
export const applicationEvents = pgTable(
  "application_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    trackerItemId: uuid("tracker_item_id")
      .notNull()
      .references(() => trackerItems.id, { onDelete: "cascade" }),
    /** Null for a tracker-only item. */
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<DbEventKind>().notNull(),
    actor: text("actor").$type<EventActor>().notNull(),
    /** The PRD's `source`. */
    source: text("source")
      .$type<"user" | "system">()
      .generatedAlwaysAs(sql`CASE WHEN actor = 'user' THEN 'user' ELSE 'system' END`),
    payload: jsonb("payload").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    dedupeKey: text("dedupe_key"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("application_events_dedupe_uq").on(t.trackerItemId, t.dedupeKey).where(sql`${t.dedupeKey} IS NOT NULL`),
    index("application_events_item_idx").on(t.trackerItemId, t.at, t.id),
    index("application_events_app_idx").on(t.applicationId, t.at, t.id).where(sql`${t.applicationId} IS NOT NULL`),
    index("application_events_user_idx").on(t.userId, t.at.desc()),
    check(
      "application_events_kind_ck",
      sql`kind IN ('drafted','verified','edited','approved','auto_approved','sent','failed','resent','withdrawn','reply_confirmation',
        'reply_rejection','reply_interview','reply_assessment','reply_offer','gone_quiet','reminder_sent',
        'saved','resume_linked','stage_changed','interview_added','note_added')`,
    ),
    check("application_events_actor_ck", sql`actor IN ('user','autopilot','system','employer')`),
    check("application_events_app_ck", sql`application_id IS NOT NULL OR kind IN ('saved','stage_changed','interview_added','note_added')`),
    check("application_events_dedupe_ck", sql`dedupe_key IS NULL OR dedupe_key ~ '^[a-z0-9_:.-]{1,100}$'`),
    check(
      "application_events_payload_ck",
      sql`jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 1024
        AND NOT jsonb_path_exists(payload, '$.* ? (@.type() == "object" || @.type() == "array")')
        AND NOT jsonb_path_exists(payload, '$.* ? (@ like_regex "^.{201}")')`,
    ),
  ],
);

/** How far jobs/tracker-projector.ts has read application_events. One row; the job creates it. No user data. */
export const trackerProjectorState = pgTable(
  "tracker_projector_state",
  {
    id: smallint("id").primaryKey().default(1),
    lastEventId: bigint("last_event_id", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [check("tracker_projector_state_one_ck", sql`id = 1`)],
);

/**
 * The user's own reference (PRD 9.4): third-party personal data, hard deleted, gone with the account. Rule 12: no agent reads
 * it, nothing sends it; the worker role that runs agents holds only (id, user_id) for the erasure check, the readonly role nothing.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title").notNull().default(""),
    company: text("company").notNull().default(""),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contacts_user_idx").on(t.userId, t.createdAt, t.id),
    check(
      "contacts_text_ck",
      sql`char_length(name) BETWEEN 1 AND 120 AND char_length(title) <= 120 AND char_length(company) <= 200
        AND (email IS NULL OR char_length(email) <= 200) AND (phone IS NULL OR char_length(phone) <= 40)
        AND (linkedin_url IS NULL OR (char_length(linkedin_url) <= 300 AND linkedin_url ~* '^https?://')) AND char_length(notes) <= 5000`,
    ),
  ],
);

/** A contact's linked jobs. Both sides are the same user's: routes/contacts.ts checks it before it writes. */
export const contactJobs = pgTable(
  "contact_jobs",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    trackerItemId: uuid("tracker_item_id")
      .notNull()
      .references(() => trackerItems.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.trackerItemId] }), index("contact_jobs_item_idx").on(t.trackerItemId)],
);

/** One interview of a tracked job (PRD 9.5). Kairos never guesses a date: start and zone come from the user. */
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    trackerItemId: uuid("tracker_item_id")
      .notNull()
      .references(() => trackerItems.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    timeZone: text("time_zone").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    kind: text("kind").$type<"phone" | "video" | "onsite" | "assessment" | "other">().notNull(),
    location: text("location"),
    notes: text("notes").notNull().default(""),
    outcome: text("outcome"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("interviews_user_starts_idx").on(t.userId, t.startsAt, t.id),
    index("interviews_item_starts_idx").on(t.trackerItemId, t.startsAt),
    check("interviews_kind_ck", sql`kind IN ('phone','video','onsite','assessment','other')`),
    check(
      "interviews_text_ck",
      sql`char_length(time_zone) BETWEEN 1 AND 64 AND duration_minutes BETWEEN 5 AND 1440 AND (location IS NULL OR char_length(location) <= 500)
        AND char_length(notes) <= 5000 AND (outcome IS NULL OR char_length(outcome) <= 500)`,
    ),
  ],
);

/** An interview's linked contacts; deleting either side removes the link (hard delete, PRD 9.4). */
export const interviewContacts = pgTable(
  "interview_contacts",
  {
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.interviewId, t.contactId] }), index("interview_contacts_contact_idx").on(t.contactId)],
);
