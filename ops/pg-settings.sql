-- Postgres server parameters (06-infrastructure 1.7, database-04, platform-22, WP-13), run by the owner as the Railway
-- Postgres superuser inside the S-P1 maintenance window. Re-runnable. ALTER SYSTEM writes postgresql.auto.conf on the
-- volume; a value the Railway image passes on its command line (the PITR archiver's settings) still wins over it, so
-- nothing here can switch archiving off. Values are for the base size (4 vCPU, 8 GB); growth (16 GB) in comments.
--
--   psql "$DATABASE_PUBLIC_URL" -v ON_ERROR_STOP=1 -f ops/pg-settings.sql
--
-- Then restart the Postgres service once (max_connections, shared_buffers and shared_preload_libraries need it) and
-- run the check at the end again: every row must show the wanted value and pending_restart false.

ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '2GB';                 -- growth: 4GB
ALTER SYSTEM SET effective_cache_size = '6GB';           -- growth: 12GB
ALTER SYSTEM SET work_mem = '16MB';                      -- growth: 24MB
ALTER SYSTEM SET maintenance_work_mem = '512MB';         -- growth: 1GB
ALTER SYSTEM SET max_wal_size = '8GB';
ALTER SYSTEM SET min_wal_size = '2GB';
ALTER SYSTEM SET checkpoint_timeout = '15min';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET synchronous_commit = on;                -- money rows are durable before they are acknowledged
ALTER SYSTEM SET autovacuum_max_workers = 4;
ALTER SYSTEM SET autovacuum_naptime = '20s';
ALTER SYSTEM SET autovacuum_vacuum_cost_limit = 2000;
ALTER SYSTEM SET log_min_duration_statement = '500ms';
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET deadlock_timeout = '1s';
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_activity_query_size = 2048;
-- pg_stat_statements: the library loads at the restart; CREATE EXTENSION after it (below, second run).
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- lz4 last: an image built without it stops the script here with "invalid value", and everything above is already set.
ALTER SYSTEM SET wal_compression = 'lz4';
ALTER SYSTEM SET default_toast_compression = 'lz4';
SELECT pg_reload_conf();

-- Hot tables vacuum at 2% dead rows instead of 20% (the rest of the 1.7 list joins as its tables are created).
ALTER TABLE IF EXISTS applications SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE IF EXISTS matches SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE IF EXISTS user_daily_usage SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE IF EXISTS ai_usage SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE IF EXISTS rate_limits SET (autovacuum_vacuum_scale_factor = 0.02);

-- After the restart only (the library must be loaded first); a no-op before.
DO $$
BEGIN
  IF current_setting('shared_preload_libraries') LIKE '%pg_stat_statements%' THEN
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
  END IF;
END $$;

-- The check: what is running now, and what waits for a restart.
SELECT name, setting, unit, pending_restart FROM pg_settings
 WHERE name IN ('server_version', 'max_connections', 'shared_buffers', 'effective_cache_size', 'work_mem',
                'maintenance_work_mem', 'max_wal_size', 'min_wal_size', 'checkpoint_timeout', 'synchronous_commit',
                'archive_mode', 'archive_timeout', 'autovacuum_max_workers', 'autovacuum_naptime',
                'shared_preload_libraries', 'wal_compression', 'default_toast_compression', 'ssl')
 ORDER BY name;
SELECT name, installed_version, default_version FROM pg_available_extensions
 WHERE name IN ('pg_trgm', 'pg_stat_statements') ORDER BY name;
