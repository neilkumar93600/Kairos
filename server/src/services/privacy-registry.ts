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
  // WP-35 also writes the mail_* purposes here when a person turns an optional mail kind on and withdraws them when it is turned off.
  // The kinds themselves are profiles.mail_opt_out (exported with the profile); the opt-out goes with the account on purpose:
  // an erased account gets no mail, and a new sign-up starts opted out until it consents (MAIL_CONSENT_DEFAULT).
  { table: "consent_records", column: "user_id", erase: "cascade", export: ALL },
  // WP-35: the person's saved searches (name, filters, digest schedule) and the reminders about their applications.
  { table: "saved_searches", column: "user_id", erase: "cascade", export: ALL },
  { table: "reminders", column: "user_id", erase: "cascade", export: ALL },
  { table: "resume_profiles", column: "user_id", erase: "cascade", export: ALL },
  // WP-17: name, target_roles and document are the user's; revisions go with their resume.
  { table: "resumes", column: "user_id", erase: "cascade", export: ALL },
  { table: "resume_revisions", column: "resume_id", parent: "resumes", erase: "cascade", export: ALL },
  // WP-17's import_id and employment_id go with the row; source_span_hash is an internal identity key.
  { table: "facts", column: "user_id", erase: "cascade", export: { omit: ["source_span_hash"] } },
  // WP-17. The source text is stored only encrypted, AAD resume_imports:<importId>:source_text. file_name is personal
  // and exported; file_key is a storage key (the file itself, uploads/<userId>/<importId>.pdf|docx, is exported from R2
  // and erased with the user's prefix; the bucket's 30-day lifecycle rule is WP-17's owner action).
  {
    table: "resume_imports",
    column: "user_id",
    erase: "cascade",
    export: { omit: ["file_key"], decrypt: { source_text_enc: "source_text" } },
  },
  { table: "employments", column: "user_id", erase: "cascade", export: { omit: ["import_key"] } },
  { table: "saved_answers", column: "user_id", erase: "cascade", export: ALL },
  { table: "matches", column: "user_id", erase: "cascade", export: ALL },
  // WP-23: the host and path of a link the user pasted that Kairos cannot read; never the query string.
  { table: "board_requests", column: "user_id", erase: "cascade", export: ALL },
  // WP-42's columns (resume_snapshot, questions, verification, resume_line_entries, resume_file_key) go with the row;
  // resume_file_key's object sits under the user's R2 prefix, which the worker empties. questions is nulled by the scrub.
  { table: "applications", column: "user_id", erase: "cascade", export: { omit: ["lease_session_id"] } },
  // WP-42. application_events_immutable lets only the cascade from "user" or tracker_items delete a row.
  { table: "tracker_items", column: "user_id", erase: "cascade", export: ALL },
  { table: "application_events", column: "user_id", erase: "cascade", export: ALL },
  { table: "submission_attempts", column: "user_id", erase: "cascade", export: { omit: ["session_id", "worker_identity"] } },
  // WP-24. Body and preview are stored encrypted (AAD inbound_emails:<id>:text_body and :preview); the export decrypts
  // them and keeps the legacy plaintext column until WP-46 drops it.
  {
    table: "inbound_emails",
    column: "user_id",
    erase: "cascade",
    export: { decrypt: { text_body_enc: "text_body", preview_enc: "preview" } },
  },
  // WP-24: a Gmail forwarding code and link Kairos received for the user, kept at most 3 days.
  { table: "forwarding_verifications", column: "user_id", erase: "cascade", export: ALL },
  { table: "subscriptions", column: "user_id", erase: "cascade", export: ALL },
  { table: "credit_ledger", column: "user_id", erase: "archive", export: ALL },
  { table: "user_daily_usage", column: "user_id", erase: "cascade", export: ALL },
  { table: "ai_usage", column: "user_id", erase: "cascade", export: ALL },
  { table: "contact_messages", column: "email", by: "email", erase: "delete", export: { omit: ["email_hash", "message_hash"] } },
  // WP-44. Job payloads in Redis carry ids only and BullMQ keeps finished jobs at most 7 days: no entry, stated in the
  // privacy notice's processor tail (owner-actions/WP-25.md).
  // Rows of kind contact_message have no user_id; their entity_id is the contact_messages id, never an address.
  { table: "email_sends", column: "user_id", erase: "cascade", export: ALL },
  { table: "notifications", column: "user_id", erase: "cascade", export: ALL },
  { table: "action_tokens", column: "user_id", erase: "cascade", export: false, why: "single-use signed-link hashes: a credential, not the user's data" },
  // Retained on purpose: the record of a person's objection to mail, honoured if the address signs up again. Its hash is
  // of the exact address and anyone holding the table can test an address for membership, so the privacy notice says
  // that a suppressed address is kept as a hash after erasure (owner-actions/WP-25.md, counsel item 10).
  {
    table: "email_suppressions",
    column: "address_hash",
    by: "hash",
    erase: "keep",
    export: false,
    why: "the person's objection to mail (GDPR Art. 21, CAN-SPAM), kept after erasure on purpose; a hash, no address or user id",
  },
  // WP-35. Kept after erasure on purpose, like email_suppressions: the person's objection to optional mail (GDPR Art. 21,
  // CAN-SPAM), honoured if the same address signs up again. A keyed hash of the exact address and a kind, no address and no
  // user id; anyone holding the table can test an address for membership, so the privacy notice says an opt-out is kept
  // as a hash after erasure (owner-actions/WP-35.md).
  {
    table: "mail_opt_outs",
    column: "address_hash",
    by: "hash",
    erase: "keep",
    export: false,
    why: "the person's objection to optional mail, kept after erasure on purpose so a new sign-up with the address stays opted out; a hash, no address or user id",
  },
  // WP-27. The admin who acted, as a user id or 'system:<job>'. Rewritten to the pseudonym by the erasure worker; the
  // ops_audit trigger (migration 0015) accepts only that. metrics_minute holds no user data (counters by name and label).
  { table: "ops_audit", column: "actor", erase: "pseudonymise", export: false, why: "internal operator audit log, not user data; pseudonymised at erasure" },
  { table: "ops_flags", column: "updated_by", erase: "pseudonymise", export: false, why: "internal operator switches, not user data; pseudonymised at erasure" },
  { table: "feature_flags", column: "updated_by", erase: "pseudonymise", export: false, why: "internal feature flags, not user data; pseudonymised at erasure" },
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
  {
    // WP-26. Added by hand: no user id or text column, but the key is derived from the user's claim and fact texts.
    table: "verified_claims",
    column: "claim_hash",
    by: "hash",
    erase: "keep",
    export: false,
    why: "verifier verdicts under an HMAC (USER_HASH_KEY) of claim and cited-fact text, no text or user id; every row expires within 24 hours and the retention job deletes it",
  },
];

/**
 * Entries for tables other packages add on branches not merged here yet. At their integration the entries move into
 * PRIVACY_REGISTRY, and the coverage tests fail until they do.
 */
export const AT_MERGE: Record<string, readonly PrivacyEntry[]> = {};

/** Entries whose rows carry the user id directly: the ones erasure verifies are gone and export selects by id. */
export const userKeyed = () => PRIVACY_REGISTRY.filter((e) => !e.by && !e.parent);
