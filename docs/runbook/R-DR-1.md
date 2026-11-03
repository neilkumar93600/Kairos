# R-DR-1: Restore Postgres to a point in time (PITR)

Triggers: a bad migration or deploy wrote bad data, rows were deleted by mistake, the database is corrupt, or the volume is lost while the PITR archive is intact. Targets: RPO about 2 minutes (5 committed), RTO 2 hours (06-infrastructure 5.5). Use [R-DR-2](R-DR-2.md) instead when PITR is off, its window does not reach back far enough, or the archive is lost. Last rehearsed: never (owner-actions/WP-13.md step 7).

A PITR restore never touches the source service: Railway creates a sibling `postgres-restored-<stamp>` with its own volume, and the cut-over is yours. The sibling is a plain database without PITR until you enable it on it.

## 1. Stop anything that sends or charges (5 minutes)

A restored database can show an application as `approved` that the employer already received. On it, the worker's `reconcile-apply` re-queues every approved cloud application within 2 minutes and the extension can claim it again. So nothing may run against the restored database until step 5 is done.

1. Declare the incident ([incident.md](incident.md), SEV1 when money or sends are involved). Write times down in UTC as you go.
2. If the database still answers: set the admin flags `pause_cloud_apply`, `pause_scoring` and `approvals_frozen` (they take effect within 10 s), and also `CLOUD_APPLIER_OPEN=0` and `PAUSE_SCORING=1` on the api and worker with a redeploy, so the old database stops changing while you work.
3. Do not point any service at the sibling before step 5.

## 2. Choose the restore point (10 minutes)

The last second before the damage, in UTC. Sources: the deploy time of the bad release (Railway deploy log), the first Sentry error of the incident, and `select max(created_at) from credit_ledger` style queries on the damaged tables. When unsure, choose earlier: the money journal (step 5) brings ledger rows and sends back up to the failure.

Check the window first: `railway postgres pitr status --service postgres`. The earliest point is the first base backup after PITR was enabled; a point before it cannot be restored (use R-DR-2).

## 3. Restore into a sibling (20 to 40 minutes)

```bash
railway postgres pitr restore --service postgres --at 2026-11-03T14:02:00Z
```

Wait until `postgres-restored-<stamp>` has finished its first boot and recovery (its deploy log shows `database system is ready to accept connections`). Copy its public URL from the service's Connect tab (the `DATABASE_PUBLIC_URL` variable): this is `RESTORED_URL` below.

## 4. Verify the sibling (10 minutes)

In Git Bash with `RESTORED_URL` set (`read -rs RESTORED_URL && export RESTORED_URL`):

```bash
psql "$RESTORED_URL" -c "select now(), pg_is_in_recovery()"                               # false: recovery finished
psql "$RESTORED_URL" -c "select max(created_at) from credit_ledger"                       # just before the restore point
psql "$RESTORED_URL" -c "select status, count(*) from applications group by 1 order by 1"
psql "$RESTORED_URL" -c "select id from drizzle.__drizzle_migrations order by id desc limit 1"
```

The last migration must be one the code you will run knows. If the restore point is before a migration that the current release needs, redeploy the release before that migration in step 7, or let its pre-deploy step migrate the sibling.

Compare the row counts with the latest core dump's manifest (`backups/core/latest.json`, its `rows`): every table should be at least as large as the manifest says, unless the dump is younger than the restore point.

## 5. Replay the money journal (10 minutes)

From `server/` on a checkout of the running release, with the backups bucket and token exported as in [R-DR-2](R-DR-2.md) section 0 (sealed variables are invisible to `railway run`):

```bash
export RESTORE_DATABASE_URL="$RESTORED_URL"
npx tsx scripts/journal-replay.ts --since 2026-11-03T14:02:00Z            # dry run
npx tsx scripts/journal-replay.ts --since 2026-11-03T14:02:00Z --apply
```

`--since` is the restore point; the script starts 10 minutes earlier on its own. Read the dry run's JSON before applying:

- `gaps`: minutes with no journal object. A gap during the incident means ledger rows of that minute may be missing; find them in Stripe and the applier's logs.
- `ledger.inserted`: rows the restore lacked, put back with their original ids. Running it again inserts nothing.
- `ledger.skipped`: rows whose user or application the restore lacks (created after the restore point). Write them down; their owners must be contacted (the account itself is gone with the restore).
- `applications.closed`: applications moved to `submitted`, `submitting`, `failed` or `withdrawn` as the journal shows, so they cannot be sent again. A `submitting` cloud send settles as "could not confirm" 10 minutes after the worker starts.
- `applications.differs`, `applications.missing`: everything the script will not decide for you. For each, look at the employer's confirmation in the user's receipt or mailbox, and never re-approve an application that may have been sent.
- `stripeEventsToResend`: in the Stripe dashboard (Developers > Events), resend each to the webhook endpoint after the cut-over. The ledger's unique indexes stop a second grant.

**If the damage itself wrote ledger rows** (a bad grant loop), add `--until <restore point>`: the journal would otherwise put the bad rows back.

## 6. Protect the sibling (5 minutes)

```bash
railway postgres pgbouncer add --service postgres-restored-<stamp> --pool-mode transaction
railway postgres pitr enable --service postgres-restored-<stamp>
```

Until its first base backup completes there is no PITR, so start an extra dump at once: on the `pgbackup` service set `DATABASE_BACKUP_URL` to the sibling's private URL (role `kairos_backup`, see step 7) and trigger a run now: set its cron schedule to two minutes from now, and back to `10 2 * * *` once `core/latest.json` is new (the schedule lives in `.railway/railway.ts`, so a plan shows drift until it is back).

## 7. Cut over (15 minutes)

1. Run `ops/provision-roles.sql` against the sibling with the same role passwords, or new ones (`-v api_password=...` etc.); then update every service's database variables. A PITR restore keeps the roles, so usually only the host changes.
2. Change the database host in each service's variables (api, worker, applier, pgbackup) to the sibling, then deploy in this order: api, worker, applier. Keep `CLOUD_APPLIER_OPEN=0` for now.
3. The sibling was created outside `.railway/railway.ts`, so plans show drift and the apply jobs stop. In the same hour, open the pull request that declares it in the file in place of `Postgres`. The old service stays, unused, for 7 days; then remove it from Railway by hand.

## 8. After the cut-over (30 minutes, then 1 hour of watching)

1. Tombstones: replay deleted users (`scripts/replay-tombstones.mjs`, WP-25; until it exists, check the deletion log by hand: a user deleted after the restore point is back and must be deleted again).
2. Resend the Stripe events from step 5. Compare each paying user's plan with Stripe for users with events after the restore point.
3. Watch Sentry and the worker log for an hour; `journal_gaps_filled` is expected once.
4. Lift the switches one by one: scoring, then cloud sends (`CLOUD_APPLIER_OPEN`), checking the dashboards between each.
5. Post-incident review within 48 hours ([incident.md](incident.md)); if user data was lost, the notification steps of 06-infrastructure 8.9.

## Drill (before launch, then monthly for 3 months, then quarterly)

On staging: restore to a point 30 minutes ago into a sibling, do steps 4 and 5 against it with `--apply`, time the whole run from step 3, then delete the sibling. Pass: under 2 hours in total and under 60 minutes for step 3; the replay closes every application you sent after the restore point. Record it below.

| Date | Environment | Restore point | Step 3 | Total | Problems | By |
|---|---|---|---|---|---|---|
| | | | | | | |
