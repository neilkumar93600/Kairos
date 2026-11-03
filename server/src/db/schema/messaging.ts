import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { applications } from "./applications";
import { user } from "./auth";
import { emailKind } from "./enums";

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
  (t) => [
    index("inbound_emails_user_idx").on(t.userId, t.receivedAt),
    index("inbound_emails_application_idx").on(t.applicationId, t.receivedAt).where(sql`${t.applicationId} is not null`),
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
