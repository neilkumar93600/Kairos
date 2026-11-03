# R-DR-2: Restore Postgres from an encrypted dump, then replay the money journal

Triggers: the PITR archive is lost or truncated, PITR is off, the restore point is outside its window, or Railway's Postgres service cannot be used (06-infrastructure 5.5). Targets: RPO 24 hours for the core tables and 7 days for `jobs`, narrowed to about 2 minutes for the ledger and sends by the money journal; RTO 6 hours (60 minutes for the restore itself). The same steps, on staging, are the monthly restore drill (section 7). Last rehearsed: never (owner-actions/WP-13.md step 7).

What exists in R2 (`kairos-backups`, bucket prefixes):

| Prefix | Written by | Kept | Content |
|---|---|---|---|
| `core/kairos-<stamp>.dump.age` and `.manifest.json` | `pgbackup`, daily 02:10 UTC | 7 days | Every table's schema and data, except the data of `jobs`, `llm_calls*`, `metrics_minute`, `session`, `verification` and the unlogged tables |
| `full/...` | `pgbackup`, Sundays | 28 days | The same plus `jobs` |
| `core/latest.json`, `full/latest.json` | `pgbackup` | rewritten each run | A copy of the newest manifest |
| `journal/<yyyymmddThhmm>Z.ndjson` | the worker, every minute | 35 days | Ledger rows, application statuses and Stripe event ids of that minute |

A dump is `pg_dump --format=custom`, encrypted with age to the two public keys in `BACKUP_AGE_RECIPIENTS`. Only the private keys in the emergency kit ([keys.md](keys.md) section 3) decrypt it, so the restore runs on your machine, never on a Railway service. The manifest holds the dump's `snapshotAt`, the row count of every dumped table at that snapshot, and the sha256 of the encrypted and the decrypted file.

## 0. Your machine, once

- Git Bash and Node 22, a checkout of the running release, `npm ci` at the repository root.
- PostgreSQL 18 command-line tools: the EDB Windows installer with only "Command Line Tools" selected, then `export PATH="/c/Program Files/PostgreSQL/18/bin:$PATH"`. Check: `pg_restore --version` prints 18.x. An older pg_restore cannot read an 18 dump.
- The Railway CLI, signed in.
- The backups bucket and the pgbackup token (owner-actions/WP-13.md step 5) from the password manager. The token variables are sealed on Railway, and `railway run` cannot see sealed values, so export them in the shell you restore from:

  ```bash
  read -rs R2_ENDPOINT && export R2_ENDPOINT
  read -rs R2_BUCKET_BACKUPS && export R2_BUCKET_BACKUPS
  read -rs R2_BACKUPS_ACCESS_KEY_ID && export R2_BACKUPS_ACCESS_KEY_ID
  read -rs R2_BACKUPS_SECRET_ACCESS_KEY && export R2_BACKUPS_SECRET_ACCESS_KEY
  ```

## 1. Stop anything that sends or charges

As R-DR-1 step 1. In a full loss the services are failing already; leave them stopped (remove the worker and applier deployments) until step 5.

## 2. A new Postgres 18 (10 minutes)

Railway > the project > New > Database > PostgreSQL, then in its settings set the image to the PITR-capable `postgres-ssl:18` image, or deploy into a new project or region if Railway itself is the problem (R-DR-3). Wait for it to boot. From its Connect tab, copy the public URL as `RESTORE_DATABASE_URL` (`read -rs RESTORE_DATABASE_URL && export RESTORE_DATABASE_URL`).

A database created by hand is not in `.railway/railway.ts`: while it exists every plan shows it as a deletion and the apply jobs stop (they never delete). For the drill, delete it the same day. For a real recovery, the cut-over (step 5) includes the pull request that declares it in the file in place of `Postgres`.

## 3. Restore the newest dump (target: under 60 minutes)

From `server/`, with the kit's age key typed or pasted (`read -rs AGE_IDENTITY && export AGE_IDENTITY`; the owner's or the recovery key, either decrypts):

```bash
npx tsx scripts/backup.ts restore core
```

(`restore full` for the weekly dump, or a manifest key such as `backups/core/kairos-20261103T021000Z.manifest.json` for an older one.) It downloads the dump, refuses it unless both checksums match the manifest, decrypts it, runs `pg_restore --no-owner --no-acl --exit-on-error --jobs=4`, then counts every table and compares with the manifest. The last line is either

- `PASS: <n> tables match the manifest; restore took <m> minutes. Next: journal-replay --since <snapshotAt>`, or
- `FAIL: ...` with one `MISMATCH` line per table. A mismatch means the restore is incomplete: do not cut over to it. Try the previous dump (its manifest key), then the full dump.

The script refuses a `RESTORE_DATABASE_URL` equal to `DATABASE_URL`, so a shell that also holds a live database URL cannot restore over it. Run `unset AGE_IDENTITY` when done.

## 4. Roles, migrations and the journal (20 minutes)

1. Roles and grants (the dump carries neither owners nor grants): `psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -v migrator_password=... -v api_password=... -v worker_password=... -v applier_password=... -v readonly_password=... -v metrics_password=... -v backup_password=... -f ../ops/provision-roles.sql` (new passwords: `openssl rand -hex 24` each), then `psql "$RESTORE_DATABASE_URL" -f ../ops/pg-settings.sql` and restart the new service once.
2. Migrations: the dump holds `drizzle.__drizzle_migrations`; the api's pre-deploy step applies any newer ones at the cut-over.
3. Replay the journal from the dump's snapshot. Dry run first, read it, then apply:

   ```bash
   npx tsx scripts/journal-replay.ts --since <snapshotAt from step 3>
   npx tsx scripts/journal-replay.ts --since <snapshotAt from step 3> --apply
   ```

   How to read the report: R-DR-1 step 5. After a dump restore expect more `ledger.skipped` (users who signed up after the dump: their accounts are gone, their ledger rows are listed) and more `applications.missing` (drafts created after the dump: lost, the user re-creates them; a missing application the journal shows as `submitted` was sent, so tell the user).
4. Replay the tombstones (R-DR-1 step 5b) against `$RESTORE_DATABASE_URL`, dry run then `--apply`: every account erased since the dump comes back with it.
5. Matches, drafts and the catalog after the dump are lost; `jobs` comes back by polling (the full dump has it as of Sunday).

## 5. Cut over (15 minutes)

As R-DR-1 step 7, with the new passwords from step 4 in every service's database variables, and `DATABASE_BACKUP_URL` on `pgbackup`. Then enable PITR on the new service (`railway postgres pitr enable --service <new>`) and trigger a `pgbackup` run at once (R-DR-1 step 6).

## 6. After the cut-over

As R-DR-1 step 8. In addition, compare every subscription with Stripe for users with any Stripe event since the snapshot (`stripeEventsToResend` plus a look at Stripe's customer list), and redeliver Postmark inbound messages since the snapshot from Postmark's activity feed (45-day retention).

## 7. The restore drill (monthly, on staging; WP-13 acceptance)

Pass when last night's dump restores into a scratch database in under 60 minutes with every row count matching, and the journal replay brings the ledger to within 2 minutes of the moment you call the failure.

1. Note the time as `T_FAIL` (UTC, for example `2026-11-03T15:00:00Z`). Create a scratch Postgres 18 service on staging (step 2).
2. Step 3 against it, with the staging bucket and token. Record the minutes from the PASS line.
3. Replay up to the failure: `journal-replay.ts --since <snapshotAt> --until $T_FAIL --apply` (as in step 4.3).
4. Compare the ledger with the live staging database up to `T_FAIL`, on both:

   ```sql
   select count(*), sum(delta), max(created_at) from credit_ledger where created_at < '<T_FAIL>';
   ```

   Pass: the counts and sums are equal, or every row the scratch database lacks was created in the last 2 minutes before `T_FAIL`. List those with `select id, created_at from credit_ledger where created_at >= '<T_FAIL>'::timestamptz - interval '3 minutes' and created_at < '<T_FAIL>'` on both.
5. Delete the scratch service. Record the drill below.

| Date | Dump (stamp) | Restore minutes | Counts | Journal gap at T_FAIL | Problems | By |
|---|---|---|---|---|---|---|
| | | | | | | |
