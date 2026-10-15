import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { ApplicationAnswer, ResumeLine } from "@auto-career/shared";
import { user } from "./auth";
import { applicationStatus, emailKind, submitChannel } from "./enums";
import { jobs, matches } from "./jobs";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("applications_user_job_uq").on(t.userId, t.jobId),
    index("applications_user_status_idx").on(t.userId, t.status),
  ],
);

/** Replies forwarded to the user's address, tagged to an application when we can match them. */
export const inboundEmails = pgTable(
  "inbound_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    providerMessageId: text("provider_message_id").notNull().unique(),
    sender: text("sender").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull(),
    kind: emailKind("kind"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inbound_emails_user_idx").on(t.userId, t.receivedAt)],
);
