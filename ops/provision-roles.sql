-- Database roles and grants (02-database 4.1, 4.2), run by the owner as the Railway Postgres superuser, never by a
-- migration or a service. Re-runnable: every statement is idempotent, each run resets every runtime role to no
-- privileges and grants the matrix below again, and a role's password changes only when its variable is passed.
--
--   psql "$DATABASE_PUBLIC_URL" -v ON_ERROR_STOP=1 \
--     -v migrator_password="$(openssl rand -hex 24)" -v api_password="$(openssl rand -hex 24)" ... \
--     -f ops/provision-roles.sql
--
-- Variables (each optional): migrator_password, api_password, worker_password, applier_password, readonly_password,
-- metrics_password, backup_password. owner-actions/WP-12.md is the cutover runbook; WP-04.md set up kairos_applier.
-- Run it after migrations, and again after a migration that adds a table: it names tables the migrations create.
-- ponytail: grants live here, not in the creating migration as 02-database 4.1 plans, because development and test
-- databases have no roles. Move them into migrations once every test database is provisioned first (14.1 step 5).

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['kairos_migrator', 'kairos_api', 'kairos_worker', 'kairos_applier', 'kairos_readonly', 'kairos_metrics', 'kairos_backup'] LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I', r);
    END IF;
    EXECUTE format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', r);
  END LOOP;
END $$;

\if :{?migrator_password}
ALTER ROLE kairos_migrator PASSWORD :'migrator_password';
\endif
\if :{?api_password}
ALTER ROLE kairos_api PASSWORD :'api_password';
\endif
\if :{?worker_password}
ALTER ROLE kairos_worker PASSWORD :'worker_password';
\endif
\if :{?applier_password}
ALTER ROLE kairos_applier PASSWORD :'applier_password';
\endif
\if :{?readonly_password}
ALTER ROLE kairos_readonly PASSWORD :'readonly_password';
\endif
\if :{?metrics_password}
ALTER ROLE kairos_metrics PASSWORD :'metrics_password';
\endif
\if :{?backup_password}
ALTER ROLE kairos_backup PASSWORD :'backup_password';
\endif

-- Per-role timeouts (4.1). The migrator has none: the runner sets lock_timeout itself and the deploy has its own budget.
ALTER ROLE kairos_readonly CONNECTION LIMIT 3;
ALTER ROLE kairos_metrics CONNECTION LIMIT 3;
ALTER ROLE kairos_api SET statement_timeout = '10s';
ALTER ROLE kairos_worker SET statement_timeout = '120s';
ALTER ROLE kairos_applier SET statement_timeout = '5s';
ALTER ROLE kairos_readonly SET statement_timeout = '60s';
ALTER ROLE kairos_metrics SET statement_timeout = '10s';
ALTER ROLE kairos_backup SET statement_timeout = 0;
ALTER ROLE kairos_api SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE kairos_worker SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE kairos_applier SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE kairos_readonly SET default_transaction_read_only = on;
ALTER ROLE kairos_metrics SET default_transaction_read_only = on;
GRANT pg_read_all_data TO kairos_backup;

-- kairos_migrator owns the database and every object in it, so migrations run as it and never as the superuser.
-- Each llm_calls partition is its own table (the definer functions drop them as their owner). A sequence owned by a
-- column (llm_calls_id_seq, serials) moves with its table; extension members stay with their extension.
DO $$
DECLARE o record;
BEGIN
  EXECUTE format('ALTER DATABASE %I OWNER TO kairos_migrator', current_database());
  ALTER SCHEMA public OWNER TO kairos_migrator;
  FOR o IN
    SELECT c.oid::regclass AS name, c.relkind FROM pg_class c
     WHERE c.relnamespace IN ('public'::regnamespace, to_regnamespace('drizzle'))
       AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
       AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
                          AND (d.deptype = 'e' OR (c.relkind = 'S' AND d.deptype IN ('a', 'i'))))
  LOOP
    EXECUTE format(CASE o.relkind WHEN 'S' THEN 'ALTER SEQUENCE %s OWNER TO kairos_migrator'
                                  WHEN 'v' THEN 'ALTER VIEW %s OWNER TO kairos_migrator'
                                  WHEN 'm' THEN 'ALTER MATERIALIZED VIEW %s OWNER TO kairos_migrator'
                                  ELSE 'ALTER TABLE %s OWNER TO kairos_migrator' END, o.name);
  END LOOP;
  FOR o IN SELECT p.oid::regprocedure AS name FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e') LOOP
    EXECUTE format('ALTER ROUTINE %s OWNER TO kairos_migrator', o.name);
  END LOOP;
  FOR o IN SELECT t.oid::regtype AS name FROM pg_type t
            WHERE t.typnamespace = 'public'::regnamespace AND t.typtype IN ('e', 'd')
              AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e') LOOP
    EXECUTE format('ALTER TYPE %s OWNER TO kairos_migrator', o.name);
  END LOOP;
  IF to_regnamespace('drizzle') IS NOT NULL THEN
    ALTER SCHEMA drizzle OWNER TO kairos_migrator;
  END IF;
END $$;

-- Tables the migrator creates from now on: rows for the api and worker, narrowed below; functions run by them only
-- (a validator a CHECK calls is granted to PUBLIC by its migration). Functions already here keep PUBLIC's EXECUTE:
-- they run with the caller's table privileges, except the three definer functions handled below.
ALTER DEFAULT PRIVILEGES FOR ROLE kairos_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kairos_api, kairos_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE kairos_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kairos_api, kairos_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE kairos_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE kairos_migrator IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO kairos_api, kairos_worker;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO kairos_api, kairos_worker, kairos_applier, kairos_readonly, kairos_metrics;

-- Reset: revoking a table's privileges also revokes its column privileges.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM kairos_api, kairos_worker, kairos_applier, kairos_readonly, kairos_metrics;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM kairos_api, kairos_worker, kairos_applier, kairos_readonly, kairos_metrics;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM kairos_applier, kairos_readonly, kairos_metrics;

-- The three SECURITY DEFINER partition functions of 0002 run as their owner: any login could create or drop
-- llm_calls partitions. Only the worker's maintenance schedule calls them.
REVOKE EXECUTE ON FUNCTION llm_calls_ensure_partitions(int), llm_calls_partition_rolled_up(text), llm_calls_drop_old_partitions(int) FROM PUBLIC, kairos_api;
GRANT EXECUTE ON FUNCTION llm_calls_ensure_partitions(int), llm_calls_partition_rolled_up(text), llm_calls_drop_old_partitions(int) TO kairos_worker;

-- The privilege matrix of 02-database 4.2 for the tables that exist (asserted by test T-12, roles.int.test.ts).
-- credit_ledger: no runtime role may UPDATE or DELETE it (INV-13); its trigger blocks the owner too (migration 0005).
-- inbound_emails: the internet-facing api cannot rewrite the evidence that feeds billing pauses (messaging-40).
GRANT SELECT, INSERT, UPDATE, DELETE ON "user", session, account, verification, auth_rate_limit, resume_profiles, facts,
  saved_answers, resumes, resume_revisions, applications, rate_limits TO kairos_api;
GRANT SELECT, INSERT, UPDATE ON profiles, companies, jobs, matches, subscriptions, stripe_events, user_daily_usage, ai_usage TO kairos_api;
GRANT SELECT, INSERT ON credit_ledger, inbound_emails, contact_messages TO kairos_api;
GRANT SELECT ON llm_cost_daily TO kairos_api;
GRANT INSERT ON llm_calls TO kairos_api;
GRANT SELECT (id) ON llm_calls TO kairos_api;
GRANT USAGE ON SEQUENCE llm_calls_id_seq TO kairos_api;

GRANT SELECT, DELETE ON "user", session, verification, ai_usage TO kairos_worker;
GRANT SELECT ON account TO kairos_worker;
GRANT SELECT, UPDATE ON resume_profiles TO kairos_worker;
GRANT SELECT, INSERT, UPDATE ON profiles, saved_answers, resumes, resume_revisions, subscriptions, llm_cost_daily TO kairos_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON facts, companies, jobs, matches, applications, stripe_events, inbound_emails,
  contact_messages, user_daily_usage TO kairos_worker;
GRANT SELECT, INSERT ON credit_ledger, llm_calls TO kairos_worker;
GRANT UPDATE (user_hash) ON llm_calls TO kairos_worker;
GRANT USAGE ON SEQUENCE llm_calls_id_seq TO kairos_worker;

-- kairos_applier: the cloud applier's interim role (CISO mustFix 1(4), WP-04). The definer functions of
-- 02-database.md 8.3 replace these table grants in P5. What jobs/cloud-apply.ts and services/submissions.ts run:
--   read the application with its job's apply_url and closed_at, and the owner's effective plan (plan, status and
--   the past_due grace anchor of WP-10: planFor reads all three) for the claim prechecks;
--   claim it (approved -> submitting) and record the result (status, submitted_at, receipt, failure_reason);
--   for a submit only, insert the one ledger debit and read back its id.
-- Nothing else: no user, session, account, profiles, facts, resumes, inbound_emails or llm_* table, no other
-- column of jobs, subscriptions or credit_ledger, no UPDATE of answers or channel, no DELETE anywhere.
-- ponytail: it can still SELECT every user's applications (answers included) until the P5 definer functions
-- scope reads to the attempt it claimed.
GRANT SELECT ON applications TO kairos_applier;
GRANT UPDATE (status, submitted_at, receipt, failure_reason, updated_at) ON applications TO kairos_applier;
GRANT SELECT (id, apply_url, closed_at) ON jobs TO kairos_applier;
GRANT SELECT (user_id, plan, status, past_due_since) ON subscriptions TO kairos_applier;
GRANT INSERT ON credit_ledger TO kairos_applier;
GRANT SELECT (id) ON credit_ledger TO kairos_applier;

-- kairos_readonly (analytics and support, 06 H3): no message bodies, answers, tokens or free text; column lists are
-- filtered by what exists, so the script runs before and after the columns later migrations add.
GRANT SELECT ON companies, jobs, matches, credit_ledger, llm_cost_daily, user_daily_usage TO kairos_readonly;
DO $$
DECLARE g record;
BEGIN
  FOR g IN
    SELECT c.table_name, c.column_name FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND (
           (c.table_name = 'profiles' AND c.column_name IN ('user_id', 'onboarding_step', 'timezone', 'applications_paused_at', 'forwarding_state', 'created_at'))
        OR (c.table_name = 'resume_profiles' AND c.column_name IN ('id', 'user_id', 'name', 'is_default', 'source_kind', 'parse_status', 'created_at'))
        OR (c.table_name = 'subscriptions' AND c.column_name IN ('user_id', 'plan', 'interval', 'status', 'current_period_end', 'cancel_at_period_end', 'collection_paused', 'created_at'))
        OR (c.table_name = 'applications' AND c.column_name NOT IN ('resume_lines', 'answers', 'cover_letter', 'receipt', 'questions',
                                                                    'resume_line_entries', 'failure_reason', 'lease_session_id')))
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON %I TO kairos_readonly', g.column_name, g.table_name);
  END LOOP;
END $$;

-- kairos_metrics (Grafana): aggregates only, never a user id or free text. metrics_minute and the ops_*_v views join
-- it when they exist (WP-27).
GRANT SELECT ON llm_cost_daily TO kairos_metrics;
