-- billing_past_due_since (WP-10; _db/billing.md 3.1 D8): the 7-day past_due grace anchor of effectivePlan.
-- Expand-only. The CHECK (status = 'past_due') = (past_due_since IS NOT NULL) ships with the other subscriptions
-- constraints in WP-12. Generated with drizzle-kit; the backfill is appended by hand.
ALTER TABLE "subscriptions" ADD COLUMN "past_due_since" timestamp with time zone;
--> statement-breakpoint
-- Rows already past_due start their grace at migration time (Q-6 of _db/billing.md).
UPDATE "subscriptions" SET "past_due_since" = now() WHERE "status" = 'past_due';
