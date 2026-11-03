# R-DEPLOY-2: Failed migration

Trigger: the `sd1-api` pre-deploy command (`node dist/migrate.js`) fails. Last rehearsed: never.

## Symptoms

The new api deployment shows a failed pre-deploy step. Railway does not start a deployment whose pre-deploy command fails, so the old one keeps serving. The worker and the applier may already run the new code, because they have no pre-deploy step.

## Impact

Usually none for users: the old api keeps serving on the old schema. The risk is a worker or applier on new code that expects the new schema. Look for `column ... does not exist` (`42703`) or `relation ... does not exist` (`42P01`) in their logs.

## Check

1. Read the pre-deploy log: the migration file and the Postgres error code.
2. Did part of it run? Migrations run in a transaction unless the file says otherwise (for example `CREATE INDEX CONCURRENTLY`). Then:
   - A transactional file that failed applied nothing.
   - A non-transactional file may have applied some statements. Check them with `\d <table>`, or look for the index.
3. Is the migration recorded as applied? `select * from drizzle.__drizzle_migrations order by created_at desc limit 3;` [the table moves with WP-12's runner; check its README].

## Fix

1. If the worker or applier logs show schema errors, roll them back first ([R-DEPLOY-1](R-DEPLOY-1.md)).
2. Fix forward. Write a new migration that does what the failed one meant to, idempotently (`if not exists`, `create index concurrently if not exists`), and never edit a migration file that has been applied anywhere.
3. For a half-applied non-transactional file: make its statements idempotent, then re-run the deploy.
4. Ship the fix through [R-DEPLOY-3](R-DEPLOY-3.md).

## Verify

The pre-deploy log ends with `migrations applied`, the new api deployment is `Active`, and no `42703` or `42P01` errors appear in any service for 15 minutes.

## Escalate

If the failure left data inconsistent (a partial backfill), stop the writers that touch it and treat it as SEV1 under [incident.md](incident.md).
