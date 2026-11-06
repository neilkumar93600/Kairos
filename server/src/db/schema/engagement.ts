import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { applications } from "./applications";
import { user } from "./auth";

// Saved searches, digests and reminders (WP-35; _db/identity-profile.md 3.13, _db/applications.md 3.5).
const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const SAVED_SEARCH_FREQUENCIES = ["off", "daily", "weekly"] as const;
export type SavedSearchFrequency = (typeof SAVED_SEARCH_FREQUENCIES)[number];
/** Filters over the user's own matches; they add no scoring and no model call (arch B.7.10). Validated by saved_search_filters_valid(). */
export interface SavedSearchFilters {
  minScore?: number;
  roles?: string[];
  companies?: string[];
  remoteOnly?: boolean;
}

/**
 * F6: named filters over the user's matches and a digest frequency. The hourly digest tick (jobs/digest.ts) claims the
 * searches due at 08:00 in the user's time zone. saved_searches_guard (migration 0023) takes the profiles lock for the
 * limit of 10 and computes next_digest_at; the claim writes window_start, last_digest_at and next_digest_at.
 */
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: jsonb("filters").$type<SavedSearchFilters>().notNull().default({}),
    frequency: text("frequency").$type<SavedSearchFrequency>().notNull().default("daily"),
    /** The end of the last claimed window; null until the first claim (the window then starts at created_at). */
    lastDigestAt: tstz("last_digest_at"),
    /** Null exactly when frequency is 'off'. */
    nextDigestAt: tstz("next_digest_at"),
    /**
     * The start of the window the latest claim covers (the previous last_digest_at, or created_at). The digest renders
     * from it, so a retry or a redrive of the same email shows the same matches.
     */
    windowStart: tstz("window_start"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_searches_user_name_uq").on(t.userId, sql`lower(${t.name})`),
    index("saved_searches_due_idx").on(t.nextDigestAt).where(sql`${t.frequency} <> 'off'`),
    check("saved_searches_name_ck", sql`char_length(btrim(${t.name})) BETWEEN 1 AND 60`),
    check("saved_searches_filters_ck", sql`saved_search_filters_valid(${t.filters})`),
    check("saved_searches_frequency_ck", sql`${t.frequency} IN ('off','daily','weekly')`),
    check("saved_searches_next_ck", sql`(${t.frequency} = 'off') = (${t.nextDigestAt} IS NULL)`),
  ],
);

export const REMINDER_KINDS = ["no_reply", "saved_job_ageing"] as const;
export const REMINDER_CANCEL_REASONS = ["reply_received", "draft_resolved", "user_opted_out", "expired"] as const;

/**
 * F5 nudges: an advisory row made by the hourly reminders schedule and consumed by the digest email, which re-reads
 * the live application and cancels the row when it no longer applies (nothing else cancels). It never mails by itself.
 * match_id of the spec is left out until a saved-match feature needs it (an expand-only column then).
 */
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<(typeof REMINDER_KINDS)[number]>().notNull(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    dueAt: tstz("due_at").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
    sentAt: tstz("sent_at"),
    cancelledAt: tstz("cancelled_at"),
    cancelReason: text("cancel_reason").$type<(typeof REMINDER_CANCEL_REASONS)[number]>(),
  },
  (t) => [
    // One reminder per kind per application: the schedule re-scans a 3-day window every hour and relies on ON CONFLICT DO NOTHING.
    uniqueIndex("reminders_app_kind_uq").on(t.applicationId, t.kind),
    index("reminders_due_idx").on(t.dueAt).where(sql`${t.sentAt} IS NULL AND ${t.cancelledAt} IS NULL`),
    index("reminders_user_idx").on(t.userId, t.createdAt.desc()),
    check("reminders_kind_ck", sql`${t.kind} IN ('no_reply','saved_job_ageing')`),
    check(
      "reminders_resolution_ck",
      sql`NOT (${t.sentAt} IS NOT NULL AND ${t.cancelledAt} IS NOT NULL)
        AND ((${t.cancelledAt} IS NULL) = (${t.cancelReason} IS NULL))
        AND (${t.cancelReason} IS NULL OR ${t.cancelReason} IN ('reply_received','draft_resolved','user_opted_out','expired'))`,
    ),
  ],
);
