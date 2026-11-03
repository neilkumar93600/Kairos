-- kairos:no-transaction
-- kairos:contract resumes_user_uq: one resume per user ends; PRD 6.1 allows 10 bases per profile and a copy per job
-- (WP-17; database-48, database-112). The api before WP-17 upserts on this index (ON CONFLICT (user_id) on GET and PUT
-- /api/resume) and gets 42P10 once it is gone, so this file runs with the WP-17 api and a rollback of the api code
-- past WP-17 breaks /resume until the index is rebuilt (owner-actions/WP-17.md). Hand-written (generate --custom);
-- drizzle-kit put the drop in 0009, from where it was moved.
DROP INDEX CONCURRENTLY IF EXISTS "resumes_user_uq";
