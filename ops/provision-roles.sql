-- Database roles, run by the owner as the Railway Postgres superuser, never by a migration or a service.
-- Re-runnable: every statement is idempotent, and each run starts the role from no privileges.
--
--   APPLIER_PW=$(openssl rand -hex 24)
--   psql "$DATABASE_PUBLIC_URL" -v ON_ERROR_STOP=1 -v applier_password="$APPLIER_PW" -f ops/provision-roles.sql
--
-- Then set sd1-applier's DATABASE_URL to postgresql://kairos_applier:$APPLIER_PW@<same host:port/db>
-- (docs/superpowers/plans/2026-10-30-backend-completion/owner-actions/WP-04.md). Run it after migrations: it names
-- tables and functions they create. WP-12 adds the other roles (migrator, api, worker, readonly) to this file.

-- kairos_applier: the cloud applier's interim role (CISO mustFix 1(4), WP-04). The definer functions of
-- 02-database.md 8.3 replace these table grants in P5. What jobs/cloud-apply.ts and services/submissions.ts run:
--   read the application with its job's apply_url and closed_at, and the owner's plan (the claim prechecks);
--   claim it (approved -> submitting) and record the result (status, submitted_at, receipt, failure_reason);
--   for a submit only, insert the one ledger debit and read back its id.
-- Nothing else: no user, session, account, profiles, facts, resumes, inbound_emails or llm_* table, no other
-- column of jobs, subscriptions or credit_ledger, no UPDATE of answers or channel, no DELETE anywhere.
-- ponytail: it can still SELECT every user's applications (answers included) until the P5 definer functions
-- scope reads to the attempt it claimed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kairos_applier') THEN
    CREATE ROLE kairos_applier;
  END IF;
END $$;

ALTER ROLE kairos_applier WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'applier_password';
ALTER ROLE kairos_applier SET statement_timeout = '5s';
ALTER ROLE kairos_applier SET idle_in_transaction_session_timeout = '30s';

-- Revoking a table's privileges also revokes its column privileges, so this resets everything granted below.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM kairos_applier;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM kairos_applier;
-- Already the default on Postgres 15 and later; the services connect as the schema owner and keep CREATE.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- Functions are executable by PUBLIC by default, and these three run as their owner (SECURITY DEFINER, migration
-- 0002): any login could create or drop llm_calls partitions. The api and worker run them as the owner.
REVOKE EXECUTE ON FUNCTION llm_calls_ensure_partitions(int), llm_calls_partition_rolled_up(text), llm_calls_drop_old_partitions(int) FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO kairos_applier;
GRANT SELECT ON applications TO kairos_applier;
GRANT UPDATE (status, submitted_at, receipt, failure_reason, updated_at) ON applications TO kairos_applier;
GRANT SELECT (id, apply_url, closed_at) ON jobs TO kairos_applier;
GRANT SELECT (user_id, plan, status) ON subscriptions TO kairos_applier;
GRANT INSERT ON credit_ledger TO kairos_applier;
GRANT SELECT (id) ON credit_ledger TO kairos_applier;
