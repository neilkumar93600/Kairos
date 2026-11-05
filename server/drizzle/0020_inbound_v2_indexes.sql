-- kairos:no-transaction
-- inbound messaging v2 indexes and validations (WP-24; _db/messaging.md 4.5, 10.1). inbound_emails may pass 100,000
-- rows, so the indexes are built CONCURRENTLY and the checks 0019 added NOT VALID are validated here, out of 0019's
-- transaction (VALIDATE takes SHARE UPDATE EXCLUSIVE, so writes go on). Hand-written (drizzle-kit generate --custom);
-- src/db/schema/messaging.ts declares the same indexes and checks.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inbound_emails_unclassified_idx" ON "inbound_emails" USING btree ("received_at") WHERE "inbound_emails"."classified_at" IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inbound_emails_body_purge_idx" ON "inbound_emails" USING btree ("received_at") WHERE "inbound_emails"."text_body_enc" IS NOT NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inbound_emails_hidden_idx" ON "inbound_emails" USING btree ("received_at") WHERE "inbound_emails"."hidden_reason" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "inbound_emails" VALIDATE CONSTRAINT "inbound_emails_hidden_reason_ck";--> statement-breakpoint
ALTER TABLE "inbound_emails" VALIDATE CONSTRAINT "inbound_emails_linked_by_ck";--> statement-breakpoint
ALTER TABLE "inbound_emails" VALIDATE CONSTRAINT "inbound_emails_one_classifier_ck";--> statement-breakpoint
ALTER TABLE "inbound_emails" VALIDATE CONSTRAINT "inbound_emails_attachments_ck";--> statement-breakpoint
ALTER TABLE "inbound_emails" VALIDATE CONSTRAINT "inbound_emails_body_preview_pair_ck";--> statement-breakpoint
ALTER TABLE "inbound_emails" VALIDATE CONSTRAINT "inbound_emails_body_size_ck";--> statement-breakpoint
ALTER TABLE "inbound_emails" VALIDATE CONSTRAINT "inbound_emails_preview_size_ck";--> statement-breakpoint
ALTER TABLE "inbound_emails" VALIDATE CONSTRAINT "inbound_emails_hidden_no_body_ck";--> statement-breakpoint
ALTER TABLE "inbound_emails" VALIDATE CONSTRAINT "inbound_emails_verified_domains_ck";
