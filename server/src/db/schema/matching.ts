import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { jobs } from "./catalog";
import { matchStatus } from "./enums";

/** A job scored for one user. Only rows with passedFilters and score >= the user's threshold reach the queue. */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    passedFilters: boolean("passed_filters").notNull(),
    score: integer("score"),
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    status: matchStatus("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("matches_user_job_uq").on(t.userId, t.jobId),
    index("matches_user_status_idx").on(t.userId, t.status),
  ],
);
