# R-PG-1: Database unreachable

Triggers: `/health` answers 503 and the log line `health check failed` names `database` (A-PG-1), or connection errors (`ECONNREFUSED`, `57P01`, `53300`) flood Sentry. Last rehearsed: never (the staging drill in owner-actions/WP-11.md stops Postgres for 4 minutes).

## Symptoms

- Every service fails its health check, so the uptime checks and the heartbeats fail together.
- The logs show connection errors with codes but no query text (the err serializer drops it).

## Impact

The whole product. Webhooks retry. Credits cannot be lost: a failed write commits nothing.

## Check

1. **Railway, the Postgres service.** Status, recent restarts, and the deploy log of the service itself.
2. **Its metrics.** Is the volume full (disk 100%)? Is memory pinned (OOM restarts)?
3. **Postgres logs:**
   - `too many connections` (`53300`): [R-PG-4](R-PG-4.md).
   - `could not write` or `No space left on device`: the volume is full.
   - `database system is in recovery mode`: wait for the restart to finish.
4. **From your machine:** `psql "$DATABASE_PUBLIC_URL" -c 'select 1'`. If it answers from outside but not from the services, the private network or the services' `DATABASE_URL` is wrong (a rotation that missed a service).

## Fix

- Volume full: resize the volume on Railway (Postgres > Settings > Volume). Then find the growth (`select relname, pg_size_pretty(pg_total_relation_size(oid)) from pg_class order by pg_total_relation_size(oid) desc limit 10;`).
- Crashed or out of memory: restart the Postgres service; resize it if it keeps running out of memory.
- Wrong credentials after a rotation: set the services' `DATABASE_URL` again and redeploy them.
- Volume lost or data damaged: stop the writers first (remove the `sd1-worker` and `sd1-applier` deployments) and restore from the latest backup (Railway volume backups). There is no tested restore until WP-13's drill. Escalate before doing anything destructive.

## Verify

- `select 1` answers from the services: every `/health` is 200 and the heartbeats resume.
- `select count(*) from credit_ledger where created_at > now() - interval '1 hour';` returns rows that look plausible.

## Escalate

Railway support (Pro) for a volume or platform fault. If data may be lost, treat it as SEV1 under [incident.md](incident.md) and stop sends until the ledger is checked.
