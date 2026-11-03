import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { applications } from "./applications";
import { billingInterval, creditReason, planId } from "./enums";

/** Every credit in or out. Balance = SUM(delta). One debit per application, enforced by the partial index. */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: creditReason("reason").notNull(),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    stripeInvoiceId: text("stripe_invoice_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("credit_ledger_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("credit_ledger_application_reason_uq")
      .on(t.applicationId, t.reason)
      .where(sql`${t.applicationId} is not null`),
    // One grant and one expiry per invoice (billing-v02); replaced credit_ledger_invoice_uq, which allowed one row in all.
    uniqueIndex("credit_ledger_invoice_reason_uq")
      .on(t.stripeInvoiceId, t.reason)
      .where(sql`${t.stripeInvoiceId} is not null`),
    uniqueIndex("credit_ledger_one_free_grant_uq").on(t.userId).where(sql`${t.reason} = 'free_grant'`),
  ],
);

export const subscriptions = pgTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: planId("plan").notNull().default("free"),
  interval: billingInterval("interval"),
  status: text("status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  pausedUntil: timestamp("paused_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Set on entering past_due and kept while it lasts, cleared on leaving it: the 7-day grace anchor of effectivePlan. */
  pastDueSince: timestamp("past_due_since", { withTimezone: true }),
});

/** Stripe event ids we already handled, so a redelivered webhook is a no-op. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
