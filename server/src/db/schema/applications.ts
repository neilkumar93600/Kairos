import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
}

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
    /** Set by scrub-applications (jobs/retention.ts) once sensitive answer and receipt values are blanked (INV-9). */
    contentScrubbedAt: timestamp("content_scrubbed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
  ],
);
