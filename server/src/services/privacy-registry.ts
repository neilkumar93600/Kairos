/**
 * The privacy registry (WP-25; 02-database 16.1): every table that holds a user's data, how erasure removes it and what
 * an access request exports. test/privacy-registry.test.ts (Drizzle schema) and privacy-registry.int.test.ts (the live
 * catalog, SQL-only tables included) fail when a table with a user_id column or a foreign key to "user" has no entry,
 * so a new table must be added here in the same change. erasure.ts verifies every user-keyed entry counts zero rows
 * after an erasure; scripts/export-user.ts reads every exported entry.
 *
 * Blind spot: the tests only see a user_id column or a foreign key. A table keyed by something derived from the user
 * (a hash of the address, an id inside a text key, an actor column) must be added by hand, as rate_limits and the
 * audit columns are; reviewers check new tables for such keys.
 */

export type EraseHow =
  /** The "user" row itself, deleted in the erasure transaction (services/erasure.ts). */
  | "root"
  /** Removed by its ON DELETE CASCADE from "user" (or from `parent`) in that transaction; verified zero afterwards. */
  | "cascade"
  /** Copied to credit_ledger_archive under the user hash in that transaction, then cascaded (INV-13). */
  | "archive"
  /** Deleted explicitly in that transaction (rows found by `column`, an address). */
  | "delete"
  /** `column` (a pseudonymous hash) is nulled by the erasure worker (jobs/erasure.ts). */
  | "scrub"
  /**
   * Kept, with `column` (a user id) rewritten to `erased:<first 32 hex of the user hash>` by the erasure worker once the
   * user row is gone (jobs/erasure.ts): audit rows outlive the account. ops_audit's trigger refuses any other rewrite.
   */
  | "pseudonymise"
  /** Kept: it holds only keyed hashes, no user id; `why` says why. */
  | "keep";

export interface PrivacyEntry {
  table: string;
  /** The column that names the owner: the user id unless `by` says otherwise, or the parent's id when `parent` is set. */
  column: string;
  by?: "email" | "hash";
  /** Owned through this table's row (resume_revisions -> resumes): `column` holds the parent's id. */
  parent?: string;
  erase: EraseHow;
  /**
   * The access export: only `columns` when given (tables holding credentials), else every column minus `omit` (keyed
   * hashes, storage keys). `decrypt` maps an encrypted column to the column name its AAD uses (lib/crypto.ts).
   */
  export: { columns?: string[]; omit?: string[]; decrypt?: Record<string, string> } | false;
  why?: string;
}

const ALL = {};

export const PRIVACY_REGISTRY: readonly PrivacyEntry[] = [
  { table: "user", column: "id", erase: "root", export: ALL },
  { table: "session", column: "user_id", erase: "cascade", export: { columns: ["id", "created_at", "updated_at", "expires_at", "ip_address", "user_agent"] } },
  {
    table: "account",
    column: "user_id",
    erase: "cascade",
    export: { columns: ["id", "provider_id", "account_id", "scope", "created_at", "updated_at"] },
  },
  {
    table: "profiles",
    column: "user_id",
    erase: "cascade",
    export: { omit: ["normalized_email_hash"], decrypt: { sensitive_answers_enc: "sensitive_answers_enc" } },
  },
  { table: "consent_records", column: "user_id", erase: "cascade", export: ALL },
  { table: "resume_profiles", column: "user_id", erase: "cascade", export: ALL },
  { table: "resumes", column: "user_id", erase: "cascade", export: ALL },
  { table: "resume_revisions", column: "resume_id", parent: "resumes", erase: "cascade", export: ALL },
  { table: "facts", column: "user_id", erase: "cascade", export: ALL },
  { table: "saved_answers", column: "user_id", erase: "cascade", export: ALL },
  { table: "matches", column: "user_id", erase: "cascade", export: ALL },
  { table: "applications", column: "user_id", erase: "cascade", export: ALL },
  { table: "inbound_emails", column: "user_id", erase: "cascade", export: ALL },
  { table: "subscriptions", column: "user_id", erase: "cascade", export: ALL },
  { table: "credit_ledger", column: "user_id", erase: "archive", export: ALL },
  { table: "user_daily_usage", column: "user_id", erase: "cascade", export: ALL },
  { table: "ai_usage", column: "user_id", erase: "cascade", export: ALL },
  { table: "contact_messages", column: "email", by: "email", erase: "delete", export: { omit: ["email_hash"] } },
  {
    table: "llm_calls",
    column: "user_hash",
    by: "hash",
    erase: "scrub",
    export: false,
    why: "telemetry under a keyed hash (agent, tokens, cost), no content; the hash is nulled at erasure and the rows age out at 90 days",
  },
  { table: "credit_ledger_archive", column: "user_hash", by: "hash", erase: "keep", export: false, why: "only ever holds erased users' ledgers" },
  { table: "deletion_tasks", column: "user_hash", by: "hash", erase: "keep", export: false, why: "the erasure's own record; it exists only after the account is gone" },
  { table: "erased_emails", column: "email_hash", by: "hash", erase: "keep", export: false, why: "keyed hashes of erased addresses: blocks a second free grant" },
  {
    table: "rate_limits",
    column: "key",
    by: "hash",
    erase: "keep",
    export: false,
    why: "per-email auth counters under the keyed address hash (lib/auth.ts limitByEmail); each row expires within its window, at most an hour",
  },
  { table: "auth_rate_limit", column: "key", by: "hash", erase: "keep", export: false, why: "Better Auth's per-IP and path counters, no user key; pruned by the library" },
];

/**
 * Entries for tables other packages add on their own branches (as they reported them). They are not in
 * PRIVACY_REGISTRY yet because their tables are not on this branch; at merge the coordinator moves each into
 * PRIVACY_REGISTRY, and the coverage tests fail until it does. Retention of these tables stays with their owners
 * (WP-44's mail-retention: email_sends 120 d, notifications 90 d, action_tokens 7 d after expiry).
 */
export const AT_MERGE: Record<string, readonly PrivacyEntry[]> = {
  // Job payloads in Redis carry ids only and BullMQ keeps finished jobs at most 7 days: no registry entry, stated in the
  // privacy notice's processor tail (owner-actions/WP-25.md).
  "WP-44": [
    // Rows of kind contact_message have no user_id; their entity_id must be the contact_messages id, never an address.
    { table: "email_sends", column: "user_id", erase: "cascade", export: ALL },
    { table: "notifications", column: "user_id", erase: "cascade", export: ALL },
    { table: "action_tokens", column: "user_id", erase: "cascade", export: false, why: "single-use signed-link hashes: a credential, not the user's data" },
    {
      table: "email_suppressions",
      column: "address_hash",
      by: "hash",
      erase: "keep",
      export: false,
      why: "the user's objection to mail (GDPR Art. 21, CAN-SPAM), honoured even if the address signs up again; holds a hash, no address or user id",
    },
  ],
  // WP-42 merges first. Its new applications columns (resume_snapshot, questions, verification, resume_line_entries,
  // lease_session_id, resume_file_key) cascade with applications; resume_file_key's object sits under the user's R2
  // prefix, which the worker empties. lease_session_id should be omitted from the export at merge. application_events is the user's own timeline, not a record anyone must keep after the account
  // (the ledger archive keeps application_id for the books), so it is erased with the account: its append-only guard
  // must let a referential cascade through, as credit_ledger's does (pg_trigger_depth() >= 2). If it carries no user_id,
  // register it as a parent entry on applications instead. At merge, scrub-applications also nulls
  // applications.questions (jobs/retention.ts says where); resume_snapshot is resume content and stays with the account.
  "WP-42": [
    { table: "tracker_items", column: "user_id", erase: "cascade", export: ALL },
    { table: "application_events", column: "user_id", erase: "cascade", export: ALL },
    { table: "submission_attempts", column: "user_id", erase: "cascade", export: { omit: ["session_id", "worker_identity"] } },
  ],
  // WP-17 (resume library and imports). At merge also: facts gains export omit ["source_span_hash"]. Its uploads live
  // under uploads/<userId>/, emptied by the worker; the 30-day uploads lifecycle rule is WP-17's owner action.
  "WP-17": [
    {
      table: "resume_imports",
      column: "user_id",
      erase: "cascade",
      export: { omit: ["file_key"], decrypt: { source_text_enc: "source_text" } },
    },
    { table: "employments", column: "user_id", erase: "cascade", export: { omit: ["import_key"] } },
  ],
  // WP-24 (reply encryption): inbound_emails gains decrypt { text_body_enc, preview_enc } with their AAD column names.
  // DB-reviewer on WP-27: an admin's id in the audit trail and on the flags they set. metrics_minute and feature_flags hold
  // none. Both are rewritten by the worker (kairos_worker needs UPDATE (actor) on ops_audit, which WP-27 grants, and
  // UPDATE (updated_by) on ops_flags).
  "WP-27": [
    { table: "ops_audit", column: "actor", erase: "pseudonymise", export: ALL },
    { table: "ops_flags", column: "updated_by", erase: "pseudonymise", export: ALL },
  ],
};

/** Entries whose rows carry the user id directly: the ones erasure verifies are gone and export selects by id. */
export const userKeyed = () => PRIVACY_REGISTRY.filter((e) => !e.by && !e.parent);
