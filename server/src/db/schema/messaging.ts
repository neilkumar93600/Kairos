import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
  (t) => [index("inbound_emails_user_idx").on(t.userId, t.receivedAt)],
);

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
