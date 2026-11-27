import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
    // Shape of each reason (billing-44, billing-v03); a note is a code, never free text or an address (kept forever).
    check(
      "credit_ledger_sign_ck",
      sql`(reason IN ('plan_grant','free_grant','refund_failed_submit') AND delta > 0) OR (reason = 'submission' AND delta = -1)
        OR (reason = 'expiry' AND delta < 0) OR (reason = 'admin_adjustment' AND delta <> 0 AND note IS NOT NULL)`,
    ),
    check(
      "credit_ledger_shape_ck",
      sql`(reason IN ('plan_grant','expiry') AND stripe_invoice_id IS NOT NULL AND application_id IS NULL)
        OR (reason = 'free_grant' AND stripe_invoice_id IS NULL AND application_id IS NULL)
        OR (reason IN ('submission','refund_failed_submit') AND stripe_invoice_id IS NULL)
        OR (reason = 'admin_adjustment' AND stripe_invoice_id IS NULL)`,
    ),
    check("credit_ledger_note_ck", sql`note IS NULL OR note ~ '^[A-Za-z0-9 _:=.,/#-]{1,200}$'`),
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
  /** Stripe's created time of the newest event applied to this row; an event strictly older is ignored (billing-19). */
  stripeEventCreated: timestamp("stripe_event_created", { withTimezone: true }),
  /** True while Stripe reports pause_collection; the sync is the only writer. WP-33 acts on it. */
  collectionPaused: boolean("collection_paused").notNull().default(false),
  pauseSource: text("pause_source"),
}, () => [
  check(
    "subscriptions_status_ck",
    sql`status IN ('active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused')`,
  ),
  check("subscriptions_past_due_ck", sql`(status = 'past_due') = (past_due_since IS NOT NULL)`),
  check("subscriptions_pause_ck", sql`collection_paused = (pause_source IS NOT NULL)`),
  check("subscriptions_pause_source_ck", sql`pause_source IS NULL OR pause_source IN ('offer_email','customer')`),
]);

/**
 * The cached balance and in-flight count of one user (billing-38, _db/billing.md 3.3), and the per-user lock row of rule L1.
 * Changed only by the triggers of its migration: balance by credit_ledger_ai, in_flight by applications_in_flight_aiud. No
 * CHECK, on purpose: a wrong cache must never stop a submission the employer already received from being recorded. The
 * nightly recount (LEDGER-2, jobs/invariants.ts) finds a wrong one. Runtime roles hold SELECT and UPDATE (updated_at) only,
 * which is what SELECT ... FOR UPDATE needs.
 */
export const creditBalances = pgTable("credit_balances", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull(),
  inFlight: integer("in_flight").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const STRIPE_EVENT_OUTCOMES = [
  "subscription_synced", "subscription_stale", "grant_applied", "grant_duplicate", "zero_amount", "proration_only",
  "alert_only", "unhandled_type", "user_deleted", "anomaly_no_user", "anomaly_unmapped_price",
] as const;
export type StripeEventOutcome = (typeof STRIPE_EVENT_OUTCOMES)[number];

/**
 * Store then process (billing-12, 14, 15; _db/billing.md 3.5). The route inserts a row in `received` with a minimized payload
 * of ids and integers, and a 2xx means only that; the stripe queue moves it to processed, ignored or dead. The defaults of
 * status and processed_at are for the previous release's insert, which names neither (WP-46 removes them); a row it writes
 * has no outcome, which is why the consistency check does not ask for one yet.
 */
export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow(),
    status: text("status").notNull().default("processed"),
    outcome: text("outcome").$type<StripeEventOutcome>(),
    objectId: text("object_id"),
    stripeCustomerId: text("stripe_customer_id"),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    /** Stripe's created time, the ordering guard's input. Null only on rows of the previous release. */
    eventCreated: timestamp("event_created", { withTimezone: true }),
    payload: jsonb("payload"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    redrives: smallint("redrives").notNull().default(0),
    lastError: text("last_error"),
  },
  (t) => [
    index("stripe_events_open_idx").on(t.receivedAt).where(sql`status IN ('received','dead')`),
    index("stripe_events_object_idx").on(t.objectId, t.type),
    index("stripe_events_user_idx").on(t.userId).where(sql`user_id IS NOT NULL`),
    check("stripe_events_status_ck", sql`status IN ('received','processed','ignored','dead')`),
    check(
      "stripe_events_outcome_ck",
      sql`outcome IS NULL OR outcome IN ('subscription_synced','subscription_stale','grant_applied','grant_duplicate','zero_amount','proration_only','alert_only','unhandled_type','user_deleted','anomaly_no_user','anomaly_unmapped_price')`,
    ),
    check(
      "stripe_events_consistency_ck",
      sql`(status = 'received' AND processed_at IS NULL AND outcome IS NULL) OR (status IN ('processed','ignored') AND processed_at IS NOT NULL) OR (status = 'dead' AND last_error IS NOT NULL)`,
    ),
    check("stripe_events_last_error_ck", sql`last_error IS NULL OR char_length(last_error) <= 120`),
    check("stripe_events_payload_ck", sql`payload IS NULL OR octet_length(payload::text) <= 4096`),
  ],
);
