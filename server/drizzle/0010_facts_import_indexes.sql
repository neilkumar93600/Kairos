-- kairos:no-transaction
-- facts import indexes (WP-17; 02-database 7.1.5): facts may pass 100,000 rows, so these three are built CONCURRENTLY,
-- out of 0009's transaction. Hand-written (drizzle-kit generate --custom); the columns come from 0009 and the schema
-- in src/db/schema/profile.ts declares the same three indexes.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "facts_import_identity_uq" ON "facts" USING btree ("resume_profile_id","source_span_hash");--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "facts_import_idx" ON "facts" USING btree ("import_id") WHERE "facts"."import_id" is not null;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "facts_employment_idx" ON "facts" USING btree ("employment_id") WHERE "facts"."employment_id" is not null;
