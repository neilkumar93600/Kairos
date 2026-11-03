import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { creditReason } from "./enums";

/**
 * Privacy (WP-25; 02-database 7.6.11, 16). None of these four tables has a foreign key to "user" except consent_records:
 * the rest must outlive the erasure they record, and they hold keyed hashes (services/erasure.ts), never a user id or
 * an address, except deletion_tasks.storage_id while the user's files are still being deleted.
 */

/**
 * One row per erased user, written in the transaction that deletes the user row (services/erasure.ts). The worker then
 * finishes the stores outside Postgres, each step stamping its column (jobs/erasure.ts); a task is complete only when
 * every store is done.
 */
export const deletionTasks = pgTable(
  "deletion_tasks",
  {
    /** HMAC-SHA256(USER_HASH_KEY, user id), hex. Its first 16 bytes are llm_calls.user_hash. */
    userHash: text("user_hash").primaryKey(),
    /** HMAC of the normalized address (erased_emails): the R2 tombstone carries it so a restore re-blocks the free grant. */
    emailHash: text("email_hash").notNull(),
    requestedBy: text("requested_by").$type<"user" | "operator" | "replay">().notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    /** The user id, which is the R2 prefix; nulled once the user's files are gone. */
    storageId: text("storage_id"),
    stripeCustomerId: text("stripe_customer_id"),
    tombstoneWrittenAt: timestamp("tombstone_written_at", { withTimezone: true }),
    stripeDoneAt: timestamp("stripe_done_at", { withTimezone: true }),
    /** Every user-keyed table of the privacy registry counted zero rows for the user. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    r2DoneAt: timestamp("r2_done_at", { withTimezone: true }),
    llmScrubbedAt: timestamp("llm_scrubbed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastErrorCode: text("last_error_code"),
    pagedAt: timestamp("paged_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deletion_tasks_open_idx").on(t.nextAttemptAt).where(sql`${t.completedAt} is null`),
    check("deletion_tasks_hash_ck", sql`user_hash ~ '^[0-9a-f]{64}$' AND email_hash ~ '^[0-9a-f]{64}$'`),
    check("deletion_tasks_by_ck", sql`requested_by IN ('user','operator','replay')`),
    // The verification counts rows by the user id, so it runs before the id is dropped with the files.
    check("deletion_tasks_r2_ck", sql`r2_done_at IS NULL OR (storage_id IS NULL AND verified_at IS NOT NULL)`),
    check("deletion_tasks_stripe_ck", sql`stripe_done_at IS NULL OR stripe_customer_id IS NULL`),
    check(
      "deletion_tasks_complete_ck",
      sql`completed_at IS NULL OR (tombstone_written_at IS NOT NULL AND stripe_done_at IS NOT NULL AND verified_at IS NOT NULL
        AND r2_done_at IS NOT NULL AND llm_scrubbed_at IS NOT NULL)`,
    ),
    check("deletion_tasks_error_ck", sql`last_error_code IS NULL OR last_error_code ~ '^[a-z0-9_]{1,64}$'`),
  ],
);

/** The ledger rows of erased users, kept for the books under the user hash (INV-13: the ledger is pseudonymised, never lost). */
export const creditLedgerArchive = pgTable(
  "credit_ledger_archive",
  {
    /** The credit_ledger id, so archiving twice (a resumed or replayed erasure) adds nothing. */
    id: uuid("id").primaryKey(),
    userHash: text("user_hash").notNull(),
    delta: integer("delta").notNull(),
    reason: creditReason("reason").notNull(),
    /** No foreign key: the application is erased with the user; the id still joins the money journal (R-17). */
    applicationId: uuid("application_id"),
    stripeInvoiceId: text("stripe_invoice_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credit_ledger_archive_user_idx").on(t.userHash), check("credit_ledger_archive_hash_ck", sql`user_hash ~ '^[0-9a-f]{64}$'`)],
);

/** Normalized addresses of erased accounts, as keyed hashes: a new account with one of them gets no free grant (CISO, D-25). */
export const erasedEmails = pgTable(
  "erased_emails",
  {
    emailHash: text("email_hash").primaryKey(),
    erasedAt: timestamp("erased_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [check("erased_emails_hash_ck", sql`email_hash ~ '^[0-9a-f]{64}$'`)],
);

/** What a user agreed to and when (api-auth-security-54): one row per purpose and notice version. */
export const consentRecords = pgTable(
  "consent_records",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** 'terms_privacy' at sign-up; Autopilot, forwarding and AI purposes add their own. */
    purpose: text("purpose").notNull(),
    version: text("version").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.purpose, t.version] }),
    check("consent_records_purpose_ck", sql`purpose ~ '^[a-z_]{1,40}$' AND char_length(version) BETWEEN 1 AND 40`),
  ],
);
