-- wp23_import_backfill (WP-23; 02-database 14.4 B-10, the part 0011 left for this package). A drizzle-kit custom file,
-- written by hand. The import route now stores a gate failure as below_bar. Rows from the old route said skipped, which
-- means a user's decision and is not one: they move to below_bar, and are queueable all the same. A pipeline row with no
-- score can only be an old import of a polled company's posting (the scorer always wrote a score, and stamps a version
-- since this package), so it is marked one, or M-4 would page on it. Unscored 'new' imports stay as they are: the route still writes them when the scorer cannot run,
-- and the feed shows only scored matches. Every statement selects only rows that still need it, so a rerun changes
-- nothing; matches is under 100,000 rows here (14.4).
SELECT set_config('kairos.actor', 'migration:wp23_import_backfill', true);--> statement-breakpoint
UPDATE matches SET status = 'below_bar'
 WHERE source = 'manual_url' AND NOT passed_filters AND status = 'skipped';--> statement-breakpoint
UPDATE matches SET source = 'manual_url', selection = 'import'
 WHERE source = 'pipeline' AND selection = 'ranked' AND score IS NULL AND scorer_version IS NULL;
