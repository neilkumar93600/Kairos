import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Preferences, ResumeInput } from "@auto-career/shared";
import { user } from "./auth";
import { factKind } from "./enums";

/** One row per user: contact details, search preferences and their reply-forwarding address. */
export const profiles = pgTable("profiles", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  (t) => [uniqueIndex("resumes_user_uq").on(t.userId)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("facts_user_idx").on(t.userId)],
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
