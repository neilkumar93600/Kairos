import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { atsProvider } from "./enums";

/** Employers we poll. boardToken is the slug in the public board URL. */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ats: atsProvider("ats").notNull(),
    boardToken: text("board_token").notNull(),
    careersUrl: text("careers_url"),
    priority: boolean("priority").notNull().default(false),
    active: boolean("active").notNull().default(true),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastPollError: text("last_poll_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("companies_ats_board_uq").on(t.ats, t.boardToken)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    remote: boolean("remote").notNull().default(false),
    department: text("department"),
    descriptionText: text("description_text").notNull(),
    applyUrl: text("apply_url").notNull(),
    salaryMinUsd: integer("salary_min_usd"),
    salaryMaxUsd: integer("salary_max_usd"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** "board" when polled, "manual_url" when a user pasted the posting's link. */
    source: text("source").$type<"board" | "manual_url">().notNull().default("board"),
    raw: jsonb("raw"),
  },
  (t) => [
    uniqueIndex("jobs_company_external_uq").on(t.companyId, t.externalId),
    index("jobs_first_seen_idx").on(t.firstSeenAt),
    check("jobs_source_ck", sql`source IN ('board','manual_url')`),
  ],
);
