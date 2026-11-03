# Incident runbook

For any incident: an outage, wrong money, a duplicate send, a leaked secret, or personal data that may have left the system (CISO mustFix 10; 06-infrastructure 6.10, 7.8 and 8.9). The alert-specific runbooks are listed at the end. Last rehearsed: never. Rehearse as a tabletop before launch.

## Who decides

The owner is the incident commander and decides everything below: kill switches, rotations, rollbacks, user notices and regulator notifications. Nobody else holds production access today. Regulator filings go out only after counsel has read them, unless counsel cannot be reached before the deadline. Then the owner files and tells counsel the same day.

| Severity | Meaning | Respond |
|---|---|---|
| SEV1 | Money wrong, duplicate sends, personal data exposed, or a full outage | Within 15 minutes, at any hour |
| SEV2 | A function degraded, with a workaround | The same business day |
| SEV3 | Minor | At the weekly review |

## First 15 minutes

1. **Acknowledge** the page, then open an incident note: `docs/runbook/postmortems/<yyyy-mm-dd>-<slug>.md`. Record times in UTC as they happen: when you noticed it, what you saw, what you changed.
2. **Export evidence before you change anything.** A rotation, restart or redeploy is fine afterwards, but the window has to be saved first.
   - Railway logs for `sd1-api`, `sd1-worker` and `sd1-applier` over the window. Use `railway logs --service <name> --json > <name>.jsonl` for each service, or the log explorer [verify the CLI flags for a time range].
   - Sentry: the issues in `kairos-server` and `kairos-applier` (each has a permalink and a request id).
   - In Postgres, the rows for the window: `credit_ledger`, `applications` (status and timestamps only), `session` (ids and `created_at`, not tokens), `llm_calls`, `stripe_events`.
   - The vendors' own records: Anthropic usage, Stripe events, the Postmark activity feed.
   - Keep everything in one private folder outside the repository. These exports hold personal data.
3. **Contain.** Use whichever switches stop the harm:

| To stop | Do |
|---|---|
| Cloud sends | Admin flag `pause_cloud_apply` (new claims stop within 10 s, no deploy; running sends finish), or `extension_only:<ats>` for one employer system. For a hard stop also set `CLOUD_APPLIER_OPEN=0` and `OWNER_USER_IDS=` (empty) on `sd1-api` and `sd1-applier`, or remove the `sd1-applier` deployment |
| All approvals | Admin flag `approvals_frozen` (the invariant checks set it themselves; see below) |
| AI spend | Admin flags `pause_scoring`, `llm_shed_level` = 3, or `llm_paused` (every model call, drafting included); within 10 s, no deploy. The env values `PAUSE_SCORING=true` and `LLM_SHED_LEVEL=3` on the api and the worker still work and are never lowered by a flag. For a hard stop, set the Anthropic Console workspace limit to its current spend |
| One user's sessions | `delete from session where user_id = '<id>';` (this also ends their extension token) |
| Every session | Rotate `BETTER_AUTH_SECRET` (below) and run `delete from session;` |
| Inbound mail | Rotate `INBOUND_WEBHOOK_SECRET`. Postmark retries the deliveries it could not make |
| A bad deploy | [R-DEPLOY-1](R-DEPLOY-1.md) |

4. For SEV1 availability, post "Investigating" on the status page. Mention no cause and no data.

## Secret rotation order

Rotate in this order when a credential may have leaked: the ones that open the most come first. Each one is rotated by changing the value at its source, then in Railway, then redeploying the services that read it.

| # | Secret | Where | What breaks |
|---|---|---|---|
| 1 | Database credentials: the `postgres` superuser, then `kairos_applier` | `ALTER ROLE ... PASSWORD`, then update each service's `DATABASE_URL`; a `${{Postgres.*}}` reference updates itself [verify that Railway re-reads it on redeploy] | Every service until it is redeployed |
| 2 | `BETTER_AUTH_SECRET` | Railway (api and worker) | Every session ends; everyone signs in again |
| 3 | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard > Developers. Roll the key; roll the webhook secret with the old one in `STRIPE_WEBHOOK_SECRET_PREVIOUS` | Nothing, if the order is followed |
| 4 | `ANTHROPIC_KEY_*`, `ANTHROPIC_API_KEY` | Anthropic Console: revoke and create, then check the spend for the window | AI routes until the redeploy |
| 5 | `POSTMARK_SERVER_TOKEN` | Postmark > Server > API Tokens | Outgoing mail until the redeploy |
| 6 | `INBOUND_WEBHOOK_SECRET` | Railway, then the inbound webhook URL's `?token=` in Postmark | Inbound mail is retried by Postmark |
| 7 | Then: `GOOGLE_CLIENT_SECRET`, `KAIROS_EDGE_SECRET` (Vercel and Railway together), the Redis password, the Railway, Vercel and GitHub tokens | Each provider's console | Sign-in with Google, the edge header, the queues |

Do not rotate `USER_HASH_KEY` unless it leaked: a new key re-keys every `user_hash` from then on. Rotate a Sentry DSN only if its project is being spammed (delete the key in the Sentry project settings).

## Within 24 hours: assess

Answer these and write them into the incident note:
- Which data classes were involved (03 section 10, 06 section 8.2)?
- How many users, and in which jurisdictions (EU and UK, India, elsewhere)?
- Was the data encrypted? `DATA_KEKS` columns, once WP-18 lands, are not exposed by a database-only leak.
- Were special categories involved (EEO answers, visa status, health)?
- Did data leave the system, and how do you know (Postgres logs, Anthropic usage, egress)?

## Regulator and user deadlines

The clocks run from the moment you became aware of a personal-data breach, not from when it started. Confirm each one with counsel at the time [verify].

| Regime | Who | When |
|---|---|---|
| GDPR Art. 33 (EU, UK GDPR alike) | The lead supervisory authority, when the breach is likely to put people's rights at risk | Within 72 hours. Late means a filing with reasons |
| GDPR Art. 34 | The affected users, when the risk to them is high | Without undue delay |
| India, DPDP Rules 2025 | The Data Protection Board and every affected user | Without delay; the detailed report to the Board within 72 hours [verify which DPDP Rules are in force on the date] |
| India, CERT-In directions (2022) | CERT-In, for a data breach or unauthorised access | Within 6 hours of noticing [verify that it applies to Kairos] |
| Elsewhere (US states and others) | As counsel advises | |

## User notice (template)

Send it from the owner's address with the support address in reply-to. Keep it plain text, with no links other than to kairos.app.

> Subject: Important: a security incident affecting your Kairos account
>
> On <date>, we found that <what happened, in one sentence>. It affected <the data, by kind: for example "the email address and resume text you uploaded">. It did not affect <what was not involved: for example "payment details, which Stripe holds">.
>
> What we have done: <contained: rotated credentials, closed the hole, on what date>.
>
> What you can do: <a concrete step, or "nothing is needed on your side">.
>
> We have told <the regulators, if any>. If you have questions, reply to this email and the founder will answer.
>
> <name>, Kairos

## After

- A blameless postmortem within 48 hours for every SEV1, and for any SEV2 that used error budget (plan README, Reliability). Write it in the incident note: a timeline, five whys, and at least one prevention task with an owner and a date.
- At 100% of the S1 or S5 budget: roll back, write the postmortem, and freeze features for 7 days.
- Add the detection that would have caught it sooner (a Sentry signal, a redaction path, an alert rule).

## Runbooks for specific alerts

| Id | Alert |
|---|---|
| [R-HEALTH-1](R-HEALTH-1.md) | API unavailable, or a 5xx spike |
| [R-HEALTH-2](R-HEALTH-2.md) | A worker or applier heartbeat is missing |
| [R-PG-1](R-PG-1.md) | Database unreachable |
| [R-PG-4](R-PG-4.md) | Connection exhaustion |
| [R-DR-1](R-DR-1.md) | Restore to a point in time (PITR), then replay the money journal |
| [R-DR-2](R-DR-2.md) | Restore from the encrypted dump, then replay the money journal; the monthly restore drill |
| [R-DEPLOY-1](R-DEPLOY-1.md) | Roll back a deploy |
| [R-DEPLOY-2](R-DEPLOY-2.md) | A migration failed |
| [R-DEPLOY-3](R-DEPLOY-3.md) | Hotfix |

The rest of the 06-infrastructure section 10 catalogue is written by the package that creates each risk (the full list is in WP-40).

## Admin flags and the invariant freeze

`PUT /api/admin/flags/<key>` with `{"value": true}` (also `GET /api/admin/flags`, `GET /api/admin/info`). Only a user in `ADMIN_USER_IDS` whose sign-in is under 15 minutes old may call it (otherwise 404, or 403 `reauth_required`: sign in again); an empty list closes the surface. Every write leaves an `ops_audit` row (`select * from ops_audit order by at desc limit 20`). Keys: `pause_cloud_apply`, `pause_scoring`, `llm_paused`, `approvals_frozen`, `cloud_applier_open`, `llm_shed_level` (0 to 3), `extension_only:greenhouse|lever|ashby`. A flip takes effect on every replica within 10 s. How env and flags combine: the pause and shed values take the stricter of the two (an env pause is never lowered by a flag); `cloud_applier_open` is the env value until a flag row exists, then the row wins.

The worker checks the money invariants hourly (`:05`) and nightly (03:45 UTC). Every violation logs `invariant breach` with the check ids and counts and raises `invariant_breach` (a page). Only the money checks, I-4 (a charge without a submit, or a submit without exactly one charge) and LEDGER-1 (a charge on another user's application), also set `approvals_frozen` (actor `system:invariants-hourly` or `-nightly`): approvals then answer 503 `approvals_frozen` and parked cloud sends wait. The others page only: BL-1 (more approved and submitting applications than credits), BL-2 (a negative balance), I-6 (stuck in `submitting` over 30 minutes, so the sweeper is down: R-HEALTH-2) and I-8 (an approved application cites an unconfirmed fact, usually a user who unconfirmed it). Find the rows with the SQL of the check in `jobs/invariants.ts`. Repair by hand with `admin_adjustment` rows only if you have to (that itself raises `admin_adjustment_row`), then set `approvals_frozen` to false. A freeze does not clear itself. I-1, I-2, I-5 and I-7 need tables from WP-42, WP-29 and WP-26 and are not checked yet.

To activate an imported company: `GET /api/admin/companies?active=false`, then `POST /api/admin/companies/<id>/activate` (and `/deactivate` to stop it again).

## Security signals (Sentry)

Railway cannot alert on log lines, so the processes count these and send Sentry one warning per minute per process, titled `signal: <name>`, with the count. The Sentry alert rules fire on them (owner-actions/WP-11.md). Each count has a bar below which nothing is sent (`SIGNALS` in `server/src/lib/sentry.ts`).

| Signal | Bar per minute | Means | Do |
|---|---|---|---|
| `auth_rate_limited` | 20 | Better Auth refused sign-in or OTP attempts | In the api logs, find the 429s on `/api/auth` and their clients. One address: let the limiter hold. Many: R-SEC-4, or the Cloudflare proxy (R-NET-1) |
| `inbound_token_rejected` | 5 | Wrong tokens on the inbound mail webhook | Someone is guessing. Rotate `INBOUND_WEBHOOK_SECRET` if the token could have leaked (a log, a screenshot) |
| `applier_internal_blocked` | 1 | An employer page tried to reach an internal address (metadata IP, private range) | Treat it as a possible attack on the applier (R-SEC-3). Find the line `applier request blocked` with `topLevel` and the application id, look at that posting, and stop cloud sends if the page is hostile |
| `applier_nav_blocked` | 1 | A page navigated off the five ATS hosts | Usually a redirect after submit. If one ATS does it every time, tell the WP-04 owner; if it is a strange host, as above |
| `admin_adjustment_row` | 1 | A `credit_ledger` row with reason `admin_adjustment` was written, which no code does | If you did not write it, treat it as a database compromise: export the evidence, then rotate the database credentials first |
| `submitting_swept` | 1 | A cloud send stayed in `submitting` over 10 minutes: the applier died mid-run. The worker settled it as failed with the "could not confirm" sentence; nothing is resent and no credit is used | Read the applier's logs and Sentry around the claim time (an OOM kill, a crash, a deploy). If several in a row, stop cloud sends (`CLOUD_APPLIER_OPEN=0`) and work R-HEALTH-2 |
| `signup_repaired` | 1 | A user's sign-up hook failed (profile, free plan or free grant missing); the worker finished it | Find `sign-up bootstrap failed` in the api logs at that time. A database blip needs nothing more; a repeated error is a bug to fix |
| `backup_stale` | 1 | The worker's hourly `backup-check` found no core dump in 26 hours, no full dump in 8 days, or no readable `latest.json` | Open the `pgbackup` service's last cron runs on Railway: the log line `backup failed` names the step (`pg_dump exited ...`, an R2 error, `Invalid environment`). Fix it and trigger a run (R-DR-1 step 6). Until a dump exists, R-DR-2 has nothing newer to restore |
| `backup_warning` | 1 | The latest dump's manifest recorded a warning against the previous one: a table lost over 20% of its rows, the dump is under 60% of the last one, or it nears R2's 5 GiB upload limit | A shrink you did not cause (no retention job, no erasure batch) may be data loss: compare the live count with the manifest now, and do not let the older dumps expire (copy them out of `core/`) until you know. Near 5 GiB: ask for multipart uploads in `lib/storage.ts` |
| `journal_stalled` | 1 | The money journal's cursor is over 10 minutes behind, or missing: ledger rows and sends are no longer copied to R2, so the 2-minute RPO of R-DR-2 does not hold | The `money-journal` job's own failures are Sentry issues on queue `maintenance` (usually an R2 error or a missing backups token on the worker). Once fixed, the job catches up an hour per minute and the hourly reconcile fills the rest |
| `journal_late_rows` | 1 | Rows that committed more than 15 seconds after they began, found after their minute was journaled; the reconcile merged them | Nothing to repair. Frequent: a slow transaction on the ledger; look for long `submission` or webhook transactions |
| `journal_gaps_filled` | 1 | The reconcile wrote journal minutes nobody had written | Expected once, the first hour after the journal is deployed. Otherwise the job missed minutes (a worker outage): the gap is now filled from the database |
| `llm_calls_default_rows` | 1 | `llm_calls_default` holds rows: a week had no partition, so the worker's daily `llm-partitions` job (03:00 UTC) has been failing | Fix the job's error first (its failures are Sentry issues on the `maintenance` queue). Then move the rows, below |
| `invariant_breach` | 1 | An invariant check failed; approvals are frozen only if it was I-4 or LEDGER-1 | The section above. Page-level |
| `flags_unreadable` | 1 | The worker, api or applier could not read `ops_flags`: the kill switches run on their last answer (the applier parks cloud runs until it has read them once) | Check the database and the role grants (`ops/provision-roles.sql`); flags set in the admin routes are not in force until it clears |
| `slo_burn_fast` / `slo_burn_slow` | 1 | An SLO burns its 30-day budget 14.4x over 1 hour, or 6x over 6 hours (`GET /api/admin/info` shows the windows). Evaluated every 5 minutes across replicas | Find the failing route group or job in the logs. Fast: treat as an incident. Slow: fix within the day |
| `slo_budget_half` | 1 | S1 or S5 passed half of its 30-day budget | Policy: only reliability work ships until it recovers; at 100% roll back and write a postmortem within 48 hours |
| `llm_envelope_80` / `llm_envelope_100` | 1 | Today's model spend reached 80% / 100% of the daily envelope (the first shed threshold, $190) | 80%: look at `llm_cost_daily` by agent. 100%: set `llm_shed_level` or `llm_paused` |
| `llm_escalation_cap` | 1 | More than 10% of today's model calls tiered up | An agent's schema or max-tokens failures are climbing; read `llm_cost_daily` by agent |
| `cost_per_submission` | 1 | Model spend per submitted application today is over $2 | Scoring volume outgrew submissions; consider `pause_scoring` |
| `queue_lag` | 1 | A queue's oldest waiting job is over 5 minutes old | Check the worker and the applier are up (R-HEALTH-2); `queue_waiting` and `queue_failed` gauges are in `GET /api/admin/info` |
| `cloud_run_failures` | 1 | Over half of the last 30 minutes of cloud runs failed (alert A-SUB-1) | Read the `cloud apply result` log lines for the code; set `pause_cloud_apply` while you look |
| `cross_tenant_row` | 1 | The nightly scan found a row owned by another user than its parent | Treat as a possible data leak: R-SEC-1, find the rows with the SQL of XT-1 and XT-2 |
| `pii_in_column` | 1 | The nightly scan found an address, phone or token shape in a column that must hold codes | Find the writer of that column and stop it; the log line names the column |

**Moving rows out of `llm_calls_default`.** As the owner, in one transaction (the gateway's inserts wait for it):

```sql
begin;
alter table llm_calls detach partition llm_calls_default;
select llm_calls_ensure_partitions(6);
-- Only for rows dated before the current week: create that week by hand, named after its Monday (ISO year and week).
-- create table llm_calls_2026w49 partition of llm_calls for values from ('2026-11-30 00:00:00+00') to ('2026-12-07 00:00:00+00');
insert into llm_calls select * from llm_calls_default;
truncate llm_calls_default;
alter table llm_calls attach partition llm_calls_default default;
commit;
```

Unhandled errors (5xx on the api, a job whose retries ran out, a crash) are ordinary Sentry issues. The applier's events carry the error type and our stack frames, never a message: read the message in the applier's log line at the same time.
