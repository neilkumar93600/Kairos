-- kairos:no-transaction
-- lifecycle_indexes (WP-42; database-53, 67; matching-23; 02-database 11.2): the jobs, matches and applications indexes
-- of 0009, built CONCURRENTLY IF NOT EXISTS so no write waits on a build and a rerun is safe (hand edit: drizzle-kit
-- generated them plain in 0009). Then the checks 0009 added NOT VALID are validated where every row was written by
-- 0011 or holds only new columns; the checks over legacy data wait for the pre-check in owner-actions/WP-42.md.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "jobs_visible_open_idx" ON "jobs" USING btree ("visible_at") WHERE "jobs"."closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "jobs_title_lc_trgm_idx" ON "jobs" USING gin ("title_lc" gin_trgm_ops) WHERE "jobs"."closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "jobs_location_lc_trgm_idx" ON "jobs" USING gin ("location_lc" gin_trgm_ops) WHERE "jobs"."closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "jobs_company_open_idx" ON "jobs" USING btree ("company_id") WHERE "jobs"."closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "jobs_hints_stale_idx" ON "jobs" USING btree ("hints_version") WHERE "jobs"."closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "jobs_closed_idx" ON "jobs" USING btree ("closed_at") WHERE "jobs"."closed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "matches_user_new_idx" ON "matches" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "matches"."status" = 'new';--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "matches_retention_idx" ON "matches" USING btree ("status_changed_at") WHERE "matches"."status" IN ('below_bar','expired');--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_list_idx" ON "applications" USING btree ("user_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_user_status_updated_idx" ON "applications" USING btree ("user_id","status","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_ext_queue_idx" ON "applications" USING btree ("user_id","approved_at","id") WHERE "applications"."status" = 'approved' AND "applications"."channel" = 'extension';--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_ext_claim_idx" ON "applications" USING btree ("id") WHERE "applications"."status" = 'submitting' AND "applications"."channel" = 'extension';--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_cloud_approved_idx" ON "applications" USING btree ("approved_at") WHERE "applications"."status" = 'approved' AND "applications"."channel" = 'cloud';--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_draft_work_idx" ON "applications" USING btree ("updated_at") WHERE "applications"."status" = 'draft' AND "applications"."draft_state" IN ('pending','stale');--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_failed_age_idx" ON "applications" USING btree ("terminal_at") WHERE "applications"."status" = 'failed';--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_submitted_at_idx" ON "applications" USING btree ("submitted_at") WHERE "applications"."submitted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_scrub_due_idx" ON "applications" USING btree ("terminal_at") WHERE "applications"."content_scrubbed_at" IS NULL AND "applications"."status" IN ('submitted','withdrawn');--> statement-breakpoint
ALTER TABLE "companies" VALIDATE CONSTRAINT "companies_counters_ck";--> statement-breakpoint
ALTER TABLE "companies" VALIDATE CONSTRAINT "companies_discovered_by_ck";--> statement-breakpoint
ALTER TABLE "companies" VALIDATE CONSTRAINT "companies_active_reason_ck";--> statement-breakpoint
ALTER TABLE "companies" VALIDATE CONSTRAINT "companies_domains_lc_ck";--> statement-breakpoint
ALTER TABLE "companies" VALIDATE CONSTRAINT "companies_hosts_ck";--> statement-breakpoint
ALTER TABLE "jobs" VALIDATE CONSTRAINT "jobs_closed_by_ck";--> statement-breakpoint
ALTER TABLE "jobs" VALIDATE CONSTRAINT "jobs_closed_coherent_ck";--> statement-breakpoint
ALTER TABLE "jobs" VALIDATE CONSTRAINT "jobs_seniority_hint_ck";--> statement-breakpoint
ALTER TABLE "jobs" VALIDATE CONSTRAINT "jobs_sponsorship_hint_ck";--> statement-breakpoint
ALTER TABLE "jobs" VALIDATE CONSTRAINT "jobs_card_ck";--> statement-breakpoint
ALTER TABLE "jobs" VALIDATE CONSTRAINT "jobs_apply_url_host_ck";--> statement-breakpoint
ALTER TABLE "matches" VALIDATE CONSTRAINT "matches_prerank_ck";--> statement-breakpoint
ALTER TABLE "matches" VALIDATE CONSTRAINT "matches_source_ck";--> statement-breakpoint
ALTER TABLE "matches" VALIDATE CONSTRAINT "matches_selection_ck";--> statement-breakpoint
ALTER TABLE "matches" VALIDATE CONSTRAINT "matches_source_selection_ck";--> statement-breakpoint
ALTER TABLE "matches" VALIDATE CONSTRAINT "matches_failed_gate_ck";--> statement-breakpoint
ALTER TABLE "matches" VALIDATE CONSTRAINT "matches_must_have_ck";--> statement-breakpoint
ALTER TABLE "matches" VALIDATE CONSTRAINT "matches_scorer_version_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_draft_state_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_draft_issue_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_counters_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_approved_by_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_failure_code_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_stage_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_lease_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_autopilot_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_expired_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_scrub_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_snapshot_ck";--> statement-breakpoint
ALTER TABLE "applications" VALIDATE CONSTRAINT "applications_file_key_ck";
