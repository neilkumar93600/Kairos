/**
 * The privacy registry (WP-25; 02-database 16.1): every table that holds a user's data, how erasure removes it and what
 * an access request exports. test/privacy-registry.test.ts (Drizzle schema) and privacy-registry.int.test.ts (the live
 * catalog, SQL-only tables included) fail when a table with a user_id column or a foreign key to "user" has no entry,
 * so a new table must be added here in the same change. erasure.ts verifies every user-keyed entry counts zero rows
 * after an erasure; scripts/export-user.ts reads every exported entry.
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
  /** Rows the access export includes, minus `omit` (credentials, keyed hashes), with `decrypt` columns in plaintext. */
  export: { omit?: string[]; decrypt?: string[] } | false;
  why?: string;
}

const ALL = {};

export const PRIVACY_REGISTRY: readonly PrivacyEntry[] = [
  { table: "user", column: "id", erase: "root", export: ALL },
  { table: "session", column: "user_id", erase: "cascade", export: { omit: ["token"] } },
  { table: "account", column: "user_id", erase: "cascade", export: { omit: ["password", "access_token", "refresh_token", "id_token"] } },
  { table: "profiles", column: "user_id", erase: "cascade", export: { omit: ["normalized_email_hash"], decrypt: ["sensitive_answers_enc"] } },
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
  { table: "contact_messages", column: "email", by: "email", erase: "delete", export: ALL },
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
];

/**
 * Entries for tables other packages add on their own branches (as they reported them). They are not in
 * PRIVACY_REGISTRY yet because their tables are not on this branch; at merge the coordinator moves each into
 * PRIVACY_REGISTRY, and the coverage tests fail until it does. Retention of these tables stays with their owners
 * (WP-44's mail-retention: email_sends 120 d, notifications 90 d, action_tokens 7 d after expiry).
 */
export const AT_MERGE: Record<string, readonly PrivacyEntry[]> = {
  "WP-44": [
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
};

/** Entries whose rows carry the user id directly: the ones erasure verifies are gone and export selects by id. */
export const userKeyed = () => PRIVACY_REGISTRY.filter((e) => !e.by && !e.parent);
