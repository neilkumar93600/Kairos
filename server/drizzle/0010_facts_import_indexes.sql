-- kairos:no-transaction
-- facts import indexes and validations (WP-17; 02-database 7.1.5): facts and resume_revisions may pass 100,000 rows, so
-- the indexes are built CONCURRENTLY and the constraints 0009 added NOT VALID are validated here, out of 0009's
-- transaction (VALIDATE takes SHARE UPDATE EXCLUSIVE, so writes go on). Hand-written (drizzle-kit generate --custom);
-- the schema in src/db/schema/profile.ts declares the same indexes and constraints.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "facts_import_identity_uq" ON "facts" USING btree ("resume_profile_id","source_span_hash");--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "facts_import_idx" ON "facts" USING btree ("import_id") WHERE "facts"."import_id" is not null;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "facts_employment_idx" ON "facts" USING btree ("employment_id") WHERE "facts"."employment_id" is not null;--> statement-breakpoint
ALTER TABLE "facts" VALIDATE CONSTRAINT "facts_import_id_resume_imports_id_fk";--> statement-breakpoint
ALTER TABLE "facts" VALIDATE CONSTRAINT "facts_employment_id_employments_id_fk";--> statement-breakpoint
ALTER TABLE "facts" VALIDATE CONSTRAINT "facts_span_hash_ck";--> statement-breakpoint
ALTER TABLE "resume_revisions" VALIDATE CONSTRAINT "resume_revisions_reason_ck";--> statement-breakpoint
ALTER TABLE "resume_revisions" VALIDATE CONSTRAINT "resume_revisions_name_ck";--> statement-breakpoint
ALTER TABLE "resume_revisions" VALIDATE CONSTRAINT "resume_revisions_created_by_ck";--> statement-breakpoint
ALTER TABLE "resumes" VALIDATE CONSTRAINT "resumes_document_ck";
