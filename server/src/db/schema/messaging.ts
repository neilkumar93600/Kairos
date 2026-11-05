import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, primaryKey, real, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { applications } from "./applications";
import { user } from "./auth";
import { emailKind } from "./enums";
// The column type only; platform.ts's tables stay out of schema/index.ts.
import { bytea } from "./platform";

/** Attachment metadata kept from Postmark's payload; the content is dropped before storage. */
export type InboundAttachment = { name: string; type: string; size: number };

/**
 * Replies forwarded to the user's address, tagged to an application when we can match them (_db/messaging.md 4).
 * WP-24 expand: the body and a 280-character preview are encrypted (lib/crypto.ts, AAD inbound_emails:<id>:text_body
 * and :preview). text_body is the legacy plaintext, nullable now: written only while INBOUND_PLAINTEXT_DUAL_WRITE is on
 * (for the previous release, which reads it), nulled by `backfill-inbound --null-plaintext`, dropped by WP-46.
 * classified_at is the classify job's idempotency marker. The checks old rows or the legacy classify job would break
 * (sender_len, subject_len, link_reason, classified, offer_needs_rule) come with WP-46, after the backfill and the drain.
 */
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
    textBody: text("text_body"),
    textBodyEnc: bytea("text_body_enc"),
    previewEnc: bytea("preview_enc"),
    attachments: jsonb("attachments").$type<InboundAttachment[]>().notNull().default([]),
    /** Postmark's X-Spam-Score: 5 restricts automation, 8 hides the row (services/inbound.ts). */
    spamScore: real("spam_score"),
    hiddenReason: text("hidden_reason").$type<"forwarding_confirmation" | "spam">(),
    /**
     * Domains with a valid DKIM signature over this mail, checked at receipt on Postmark's raw message, which is not
     * kept (services/forwarding.ts). Only the classify job's terminal stage moves read it. Empty: unauthenticated.
     */
    verifiedDomains: text("verified_domains").array().$type<string[]>().notNull().default(sql`'{}'::text[]`),
    kind: emailKind("kind"),
    ruleKind: emailKind("rule_kind"),
    modelKind: emailKind("model_kind"),
    linkedBy: text("linked_by").$type<"domain" | "company_name" | "none">(),
    classifiedAt: timestamp("classified_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inbound_emails_user_idx").on(t.userId, t.receivedAt),
    index("inbound_emails_application_idx").on(t.applicationId, t.receivedAt).where(sql`${t.applicationId} is not null`),
    index("inbound_emails_unclassified_idx").on(t.receivedAt).where(sql`${t.classifiedAt} IS NULL`),
    index("inbound_emails_body_purge_idx").on(t.receivedAt).where(sql`${t.textBodyEnc} IS NOT NULL`),
    index("inbound_emails_hidden_idx").on(t.receivedAt).where(sql`${t.hiddenReason} IS NOT NULL`),
    check("inbound_emails_hidden_reason_ck", sql`hidden_reason IS NULL OR hidden_reason IN ('forwarding_confirmation','spam')`),
    check("inbound_emails_linked_by_ck", sql`linked_by IS NULL OR linked_by IN ('domain','company_name','none')`),
    check("inbound_emails_one_classifier_ck", sql`rule_kind IS NULL OR model_kind IS NULL`),
    check("inbound_emails_attachments_ck", sql`jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 50`),
    check("inbound_emails_body_preview_pair_ck", sql`(text_body_enc IS NULL) = (preview_enc IS NULL)`),
    check("inbound_emails_body_size_ck", sql`octet_length(text_body_enc) <= 16448`),
    check("inbound_emails_preview_size_ck", sql`octet_length(preview_enc) <= 1200`),
    check("inbound_emails_hidden_no_body_ck", sql`hidden_reason IS NULL OR (text_body IS NULL AND text_body_enc IS NULL AND preview_enc IS NULL)`),
    check("inbound_emails_verified_domains_ck", sql`cardinality(verified_domains) <= 2`),
  ],
);

/**
 * Gmail forwarding confirmations (_db/messaging.md 5.1): the code and link Gmail sent to the user's Kairos address,
 * shown in the app and emailed to the account address, then forgotten. One live row per user and provider; a newer
 * confirmation replaces it. Kept in clear: a short-lived code for a rule only the user's own Gmail can create.
 */
export const forwardingVerifications = pgTable(
  "forwarding_verifications",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").$type<"gmail">().notNull(),
    code: text("code"),
    /** Never fetched by the server; its host is allowlisted by the parser (services/forwarding.ts). */
    confirmUrl: text("confirm_url"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.provider] }),
    check("forwarding_verifications_provider_ck", sql`provider IN ('gmail')`),
    check("forwarding_verifications_payload_ck", sql`code IS NOT NULL OR confirm_url IS NOT NULL`),
    check("forwarding_verifications_code_ck", sql`code IS NULL OR code ~ '^[0-9]{6,12}$'`),
    check("forwarding_verifications_url_ck", sql`confirm_url IS NULL OR (confirm_url ~ '^https://' AND char_length(confirm_url) <= 2048)`),
    check("forwarding_verifications_expiry_ck", sql`expires_at > received_at`),
  ],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    topic: text("topic").notNull(),
    message: text("message").notNull(),
    /** WP-25: keyed hash of the normalized sender address, so erasure finds a +tag or dotted alias of the account's address. */
    emailHash: text("email_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("contact_messages_topic_ck", sql`topic IN ('support','billing','partnership','press','other')`),
    check("contact_messages_email_hash_ck", sql`email_hash ~ '^[0-9a-f]{64}$'`),
    index("contact_messages_email_hash_idx").on(t.emailHash).where(sql`${t.emailHash} is not null`),
  ],
);

// Outbound mail core (WP-44): _db/messaging.md 5.2 and 5.3, _db/platform.md 4.10. Ids use gen_random_uuid(), not
// uuidv7() (R-6): the test and production databases are Postgres 17, which has no uuidv7.
const tstz = (name: string) => timestamp(name, { withTimezone: true });

/** Email kinds that go through the notify ledger; broadcast ones can be opted out of (05-api 12.1). */
export const EMAIL_KINDS = [
  "digest", "autopilot_hourly", "autopilot_paused", "resend_available", "offer_pause_notice", "offer_pause_applied",
  "forwarding_code", "outcome_report", "return_to_draft", "contact_message",
] as const;
export const NOTIFICATION_KINDS = ["autopilot_sent", "autopilot_paused", "resend_available", "offer_pause_notice", "reply_important", "forwarding_code"] as const;
export const ACTION_TOKEN_PURPOSES = ["resend", "offer_pause_undo", "unsubscribe"] as const;
const list = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(","));

/**
 * Claim-before-send ledger (messaging-43): one row per email about a state change, claimed before the Postmark call
 * with a 10-minute lease and at most 5 attempts (jobs/notify.ts). Better Auth's OTP mail is sent directly, not here.
 */
export const emailSends = pgTable(
  "email_sends",
  {
    kind: text("kind").notNull(),
    /** Ids, dates and counters only (_db/messaging.md 5.2); for contact_message, contact_messages.id, never an address or name. */
    entityId: text("entity_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("claimed"),
    attempts: smallint("attempts").notNull().default(1),
    claimedAt: tstz("claimed_at").notNull().defaultNow(),
    sentAt: tstz("sent_at"),
    providerMessageId: text("provider_message_id"),
    errorCode: text("error_code"),
  },
  (t) => [
    primaryKey({ columns: [t.kind, t.entityId] }),
    index("email_sends_user_idx").on(t.userId, t.kind, t.claimedAt.desc()).where(sql`${t.userId} IS NOT NULL`),
    index("email_sends_stale_idx").on(t.claimedAt).where(sql`${t.status} = 'claimed'`),
    index("email_sends_age_idx").on(t.claimedAt),
    check("email_sends_kind_ck", sql`${t.kind} IN (${list(EMAIL_KINDS)})`),
    check("email_sends_status_ck", sql`${t.status} IN ('claimed','sent','failed','suppressed')`),
    check("email_sends_sent_at_ck", sql`(${t.status} = 'sent') = (${t.sentAt} IS NOT NULL)`),
    check("email_sends_error_ck", sql`${t.status} NOT IN ('failed','suppressed') OR ${t.errorCode} IS NOT NULL`),
    check("email_sends_attempts_ck", sql`${t.attempts} BETWEEN 1 AND 5`),
    check("email_sends_entity_len_ck", sql`char_length(${t.entityId}) BETWEEN 1 AND 200`),
    check("email_sends_user_ck", sql`${t.userId} IS NOT NULL OR ${t.kind} = 'contact_message'`),
  ],
);

/** In-app notifications (messaging-31): ids and codes only; titles are joined when the list is read. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    detail: jsonb("detail").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    createdAt: tstz("created_at").notNull().defaultNow(),
    readAt: tstz("read_at"),
  },
  (t) => [
    uniqueIndex("notifications_dedupe_uq").on(t.userId, t.kind, t.entityId),
    index("notifications_user_created_idx").on(t.userId, t.createdAt.desc(), t.id.desc()),
    index("notifications_unread_idx").on(t.userId).where(sql`${t.readAt} IS NULL`),
    index("notifications_age_idx").on(t.createdAt),
    check("notifications_kind_ck", sql`${t.kind} IN (${list(NOTIFICATION_KINDS)})`),
    check("notifications_entity_len_ck", sql`char_length(${t.entityId}) BETWEEN 1 AND 200`),
    check("notifications_detail_ck", sql`jsonb_typeof(${t.detail}) = 'object' AND pg_column_size(${t.detail}) <= 1024`),
    check("notifications_read_after_create_ck", sql`${t.readAt} IS NULL OR ${t.readAt} >= ${t.createdAt}`),
  ],
);

/**
 * Single-use signed links (api-auth-security-50, lib/action-tokens.ts): only the SHA-256 of a token is stored, and the
 * consuming transaction sets used_at once.
 */
export const actionTokens = pgTable(
  "action_tokens",
  {
    tokenHash: bytea("token_hash").primaryKey(),
    purpose: text("purpose").notNull(),
    entityId: text("entity_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: tstz("created_at").notNull().defaultNow(),
    expiresAt: tstz("expires_at").notNull(),
    usedAt: tstz("used_at"),
  },
  (t) => [
    index("action_tokens_user_idx").on(t.userId),
    check("action_tokens_hash_ck", sql`octet_length(${t.tokenHash}) = 32`),
    check("action_tokens_purpose_ck", sql`${t.purpose} IN (${list(ACTION_TOKEN_PURPOSES)})`),
    check("action_tokens_entity_ck", sql`char_length(${t.entityId}) BETWEEN 1 AND 64`),
    check("action_tokens_expiry_ck", sql`${t.expiresAt} > ${t.createdAt}`),
    check(
      "action_tokens_lifetime_ck",
      sql`(${t.purpose} = 'unsubscribe' AND ${t.expiresAt} <= ${t.createdAt} + interval '90 days') OR (${t.purpose} <> 'unsubscribe' AND ${t.expiresAt} <= ${t.createdAt} + interval '7 days')`,
    ),
    check("action_tokens_used_ck", sql`${t.usedAt} IS NULL OR ${t.usedAt} >= ${t.createdAt}`),
  ],
);

/**
 * Addresses Kairos never mails again (messaging-59): a hard bounce or spam complaint from Postmark's delivery webhook,
 * or a 406 inactive recipient on a send (jobs/notify.ts). Keyed by HMAC(USER_HASH_KEY, "suppress:" + lower-cased
 * address) (lib/mailer.ts addressHash): no address is stored, and the list cannot be tested against guessed addresses
 * without the key, which must never rotate. A spam complaint stops broadcast mail; any other reason stops all of it.
 */
export const emailSuppressions = pgTable(
  "email_suppressions",
  {
    addressHash: bytea("address_hash").primaryKey(),
    reason: text("reason").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("email_suppressions_hash_ck", sql`octet_length(${t.addressHash}) = 32`),
    check("email_suppressions_reason_ck", sql`${t.reason} IN ('hard_bounce','spam_complaint','manual')`),
  ],
);
