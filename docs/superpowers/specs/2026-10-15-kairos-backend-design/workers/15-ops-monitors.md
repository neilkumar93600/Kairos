# Worker 15: `ops-monitors` (Monitors and invariant checks)

Tier: ops. Process: `worker`. Revision 1, 2026-10-25. Foundation documents: `01-architecture.md` (B.5.8, B.6.3, B.6.8, B.9.6, B.11), `02-database.md` (7.6, 8.5, 9), `03-agent-runtime.md` (8.4, 8.5, 9, 13.6, 14), `06-infrastructure.md` (5.4, 6.4, 6.7, 6.8), `_db/applications.md` 6.1 and 6.2, `_db/billing.md` 6, and the S-D1 spike corrections (`_research/spike-s-d1-local.md`).

The worker is the watchdog. It reads business state and telemetry, writes gauges, flags and audit rows, and calls a model in exactly one place (the verifier shadow audit, `claim-verifier-escalation`). It never changes an application's status, a credit balance or a Stripe object. Every repair it makes goes through an existing workflow or a conditional statement owned by another worker.

---

## 1. Purpose and place in the lifecycle

`ops-monitors` sits beside the lifecycle (match, prepare, approve, apply, settle, charge, reply), not inside it. It answers four questions the other workers cannot answer about themselves:

1. **Did money and sends stay correct?** Ledger and in-flight drift, negative balance, dual submission, submitted without a charge, charged without a submission, invoice paid without a grant (invariants INV-4, INV-5, INV-6 of `02-database.md` section 9).
2. **Is the truth lock still holding?** Citation integrity of stored drafts (I-8), verification coverage (I-7), and the weekly shadow audit that estimates the verifier's false-accept rate (INV-2, INV-7).
3. **Are we spending what we planned?** `llm_cost_daily` roll-up, envelopes, shed levels, cost per submitted application, reconciliation with Anthropic, model availability and drift.
4. **Is sending healthy?** Per-ATS failure and challenge rates (`extension_only:<ats>`), Autopilot failure spikes (per-user pause, global `autopilot_frozen`), and the alert path itself.

Its outputs are `metrics_minute` rows, `ops_flags` rows (freezes and switches), `autopilot_settings` pauses, `eval_runs` and `verification_results` rows, `ops_audit` rows (written by trigger or explicitly), emails and pages. Its freezes are the fail-closed controls the lifecycle workers read: `approvals_frozen` (read by `approveCore`), `autopilot_frozen` (read by `approveCore` and `autopilotApprove`), `extension_only:<ats>` (read by `approveCore` and the applier precheck), `llm_shed_level` and `llm_batch_paused` (read by the gateway).

Position in the phases: `cost-rollup`, `metrics` and `money-journal` ship in P1 and P2; `invariants-*` and `submission-health` in P2 (dual submission, ledger) and P5 (Autopilot rules); the shadow audit in P3 (7-day shadow week) and is required clean before `apps_06_guard_v3` and Autopilot (P5); `llm-usage-reconcile` and `eval-nightly` in P6; `model-drift` in P1 (list models only) and complete in P3.

---

## 2. Trigger, schedule and payload (a TypeScript type), plus the idempotency key

All schedules are registered with `DBOS.registerScheduled` in the worker entry point only (01 section B.5.2). DBOS runs each scheduled tick exactly once across replicas. Each tick is one workflow with several steps; a tick that finds the previous tick of the same schedule still running does not start a second copy because the workflow id is deterministic (below).

| Schedule (workflow name) | Cron (UTC) | Queue | Purpose |
|---|---|---|---|
| `costRollup` | every minute | none (runs inline on the schedule) | `llm_cost_daily` roll-up, shed level, budget thresholds, LLM gauges |
| `metricsTick` | every minute, offset 20 s | none | Gauges of 06 section 6.4 that no other worker writes |
| `alertEvaluator` | every minute, offset 40 s | none | Evaluates `ALERT_RULES`, sends messages |
| `moneyJournal` | every 2 minutes | none | Appends the money journal to R2 (06 section 5.4) |
| `submissionHealth` | every 15 minutes | none | Per-ATS rates, `extension_only`, Autopilot spike rules |
| `invariantsHourly` | minute 7 of every hour | none | I-1, I-2, I-3, I-4, I-6, I-7 and BL-2 to BL-5 over a 2-day window |
| `invariantsNightly` | 03:10 daily | none | I-1 to I-10 and BL-1 unwindowed (BL-1 chunked), FK index check |
| `evalNightly` | 03:00 daily | `batch-llm` | 03 section 13.6 row `eval-nightly` |
| `modelDrift` | 04:20 daily | none | `GET /v1/models`, deprecation reading, model-availability probe |
| `weeklyCanary` | Mondays 04:00 | `batch-llm` | 03 section 13.6 row `weekly-canary` |
| `llmUsageReconcile` | 02:30 daily | none | 03 section 8.5 |
| `verifierShadowAuditSlice` | 05:00 daily | `batch-llm` | One day's slice of the 2% audit (section 3.9) |
| `verifierShadowAuditRollup` | Mondays 06:00 | none | The weekly `eval_runs` row, estimate, freeze |

`submissionHealth` runs at minutes 2, 17, 32 and 47 so it never coincides with `invariantsHourly` (minute 7) or `metricsTick`.

```ts
// server/src/modules/ops/monitors/types.ts
export type MonitorName =
  | "costRollup" | "metricsTick" | "alertEvaluator" | "moneyJournal" | "submissionHealth"
  | "invariantsHourly" | "invariantsNightly" | "evalNightly" | "modelDrift" | "weeklyCanary"
  | "llmUsageReconcile" | "verifierShadowAuditSlice" | "verifierShadowAuditRollup";

/** The only input of every monitor workflow. Ids, enums and timestamps only (rule B.5.6). */
export interface MonitorTick {
  monitor: MonitorName;
  /** The scheduled instant, truncated to the monitor's period (minute, 2 minutes, 15 minutes, hour, UTC day, ISO week). */
  period: string;                // ISO-8601, UTC, e.g. "2026-10-25T14:00:00Z" or "2026-W43"
  /** Chunk cursor for chunked checks (BL-1 drift): last user_id processed; absent on the first chunk. */
  afterUserId?: string;
}

export type Finding = { check: string; count: number; sampleIds: string[] /* at most 5 uuids */ };

export interface MonitorResult {
  monitor: MonitorName;
  period: string;
  findings: Finding[];           // empty means clean
  flagsSet: string[];            // ops_flags keys written this run
  alertsRaised: string[];        // ALERT_RULES ids that this run caused to be recorded (the evaluator pages)
}
```

**Idempotency key (workflow id).** `mon:<monitor>:<period>`, for example `mon:invariantsHourly:2026-10-25T14`, `mon:costRollup:2026-10-25T14:31`, `mon:verifierShadowAuditSlice:2026-10-24` (the UTC day being audited), `mon:verifierShadowAuditRollup:2026-W43`, `mon:invariantsNightly:2026-10-25:u:<afterUserId>` for a drift chunk. A replay or a double tick returns the first execution's result. The DBOS scheduled-workflow id that the SDK assigns is the transport; the wrapper `runMonitor(tick, body)` starts the real workflow with `DBOS.startWorkflow(body, { workflowID })` so the id is ours [verify in S-D1 that a scheduled body can start a child with an explicit id; fallback: derive the id from the scheduled time passed to the scheduled function].

Every external effect inside a monitor is itself idempotent by construction (flag upsert is last-writer-wins on a fixed key, `ops_audit.request_id = mon:<monitor>:<period>:<check>`, email idempotency by `email_sends (kind, entity_id)`, metrics by `(name, labels, minute)` primary key, `verification_results` by `verification_results_run_item_uq`, R2 journal object name by minute and executor).

---

## 3. Algorithm, step by step

Notation: "reads" and "writes" list tables and columns. Role `kairos_worker` unless stated. Each step is a `DBOS.runStep` or a datasource transaction; steps return counts, enums and uuids only (checkpoint rule B.5.6). Checkpoint writes are counted in section 9.

### 3.1 `costRollup` (every minute)

Steps:

1. **Roll-up** (one datasource transaction). `SELECT llm_cost_rollup_day($day)` for the current and the previous UTC day. Reads `llm_calls` (`created_at`, `agent_id`, `workspace`, `plan`, `model`, `is_batch`, `status`, `tiered_up`, token columns, `cost_usd`, `latency_ms`); writes `llm_cost_daily` (all columns) by `INSERT ... SELECT ... GROUP BY ... ON CONFLICT DO UPDATE` (03 section 8.4). Idempotent, no watermark. The previous day is included to absorb late `llm_calls` rows and the batch results that finish after midnight.
2. **Thresholds.** Reads `llm_cost_daily` for the current day. Computes global spend, per-agent spend against `spec.dailyEnvelopeUsd` (registry constants), escalation share (`claim-verifier-escalation` calls divided by draft-size `claim-verifier` calls of the day). Decisions, exactly as 03 section 9.4 and 9.5:
   - global at least $190, or any batch-workspace agent at 100% of its envelope, or all-in cost per submission above $0.01 over 24 hours, sets level 1; $220 sets 2; $260 or a console workspace limit within 5% sets 3. The level only rises during a UTC day; it resets to 0 at 00:00 UTC. A level the owner raised by hand (`set_by` starting `operator:`) is never lowered by this step.
   - Writes `ops_flags` key `llm_shed_level` with `active = true`, `detail = {"value": <0..3>}`, `reason = 'cost_threshold'`, `set_by = 'system:ops-monitors'` (the value constraint `ops_flags_value_ck` accepts 0 to 3). A change writes `ops_audit` through the flag trigger.
   - Agent at 100% of the envelope for a batch-workspace agent: sets `ops_flags.llm_batch_paused` (`reason = 'envelope_exhausted'`, `expires_at` = next 00:00 UTC) and raises `alert` `A-LLM-2`.
   - Escalations at 15% of the day's draft-size verifications: writes `ops_flags` key `agent_disabled:claim-verifier-escalation` with `expires_at` next 00:00 UTC, `reason = 'escalation_cap'`; uncertain claims are then dropped with rule `unverified` by the prepare worker (03 section 9.4).
3. **Gauges.** Writes `metrics_minute` rows (`name`, `labels`, `minute`, `value`): `llm.calls.<agent>.<status>`, `llm.cost_usd.<agent>`, `llm.cost_usd.today`, `llm.cache_read_share.<agent>`, `llm.latency_ms_p50.<agent>`, `llm.latency_ms_p95.<agent>`, `llm.schema_invalid_rate.<agent>`, `llm.repair_success_rate.<agent>`, `llm.tier_up_rate.<agent>`, `llm.escalation_rate`, `llm.refusal_rate.<agent>`, `llm.max_tokens_rate.<agent>`, `llm.budget_stopped.<agent>`, `llm.shed_level`, `llm.cost_per_submitted_24h`. The last is model spend over the rolling 24 hours (`llm_calls.cost_usd`, `budget_class IN ('pipeline','interactive')`, excluding `call_kind IN ('shadow','canary','audit','nightly')`) divided by the count of `applications` with `status = 'submitted'` and `submitted_at` in the same window (index `applications_submitted_at_idx`). Percentiles come from `latency_ms` of the last 15 minutes of `llm_calls` (`llm_calls_agent_time_idx`).

External calls: none. Agents: none.

### 3.2 `metricsTick` (every minute)

Writes the gauges that no other worker owns (06 section 6.4), each with one cheap statement:

| Series | Source (tables, columns, functions) |
|---|---|
| `durable.queue.enqueued/pending/oldest_age_s{queue}`, `durable.queue.wait_p95_s{queue}` | `durable.queueStats()` over `kairos_dbos` through the read-only views `kairos_ops.queue_depth_v` |
| `durable.orphans`, `durable.executors_alive{service}` | `dbos_executors` (`last_seen_at`, `orphan_suspected_at`, `service`) |
| `durable.sys_db_size_gb`, `pg.db_size_gb`, `pg.connections{role,state}`, `pg.oldest_xact_s`, `pg.xid_age`, `pg.wal_archive_lag_s` | `SECURITY DEFINER` functions over `pg_stat_*`, `ops_archive_status()` |
| `submissions.submitted_1h`, `submissions.unconfirmed_1h` | `submission_attempts` (`state`, `failure_code`, `started_at`; BRIN `submission_attempts_started_brin`) |
| `autopilot.sends_1h`, `autopilot.skips_1h{reason}`, `autopilot.failure_rate_1h` | `submission_attempts` (`approved_by = 'autopilot'`), `application_events` (kind `auto_skipped` if the applications worker records it; otherwise `autopilot_decisions` counters it writes into `metrics_minute` itself and this step skips the series) |
| `billing.stripe_unprocessed_oldest_age_s` | `stripe_events` (`status = 'received'`, `received_at`) via `stripe_events_open_idx` |
| `inbound.unclassified_oldest_age_s` | `inbound_emails` (`classified_at IS NULL`, `received_at`) |
| `ingest.injection_suspects` | `jobs.injection_suspect` counted over the last minute of `first_seen_at` |
| `durable.checkpoint_writes_per_submitted` (hourly, at minute 0 only) | `kairos_dbos` write counters through `kairos_ops.queue_depth_v` companion view plus `dbos.transaction_completion` row count delta, divided by `applications` reaching `submitted`; target 60, email at 80 |
| `ops.alert_evaluator_ok` | Written by `alertEvaluator` (3.3), not here |

Gauges that other workers own (poll lateness, matching, email) are not recomputed here; the evaluator reads them from `metrics_minute` as written.

### 3.3 `alertEvaluator` (every minute)

1. Loads `ALERT_RULES` (`server/src/ops/alerts.ts`: `{ id, query, for, severity, runbook, dedupeWindow, resolves }`).
2. For each rule, runs `query` against `metrics_minute` (window functions over the last `for` minutes) or the named business view. Reads `ops_flags` key `alerts_muted` (a mute never applies to SEV1 invariant rules `A-SUB-2`, `A-BILL-1`, `A-AUTO-1`, `A-INV-1`).
3. Writes `metrics_minute` series `alert.firing{id}` (0 or 1).
4. On a new firing: sends one email (and, for page severity, one call to `ALERT_PAGE_WEBHOOK_URL`) with idempotency by `email_sends (kind = 'alert', entity_id = '<id>:<firstFiredAt>')`. While a page rule keeps firing it re-notifies every 30 minutes. On resolution it sends one "resolved" email.
5. Writes `ops.alert_evaluator_ok = 1`. An external heartbeat (`HEARTBEAT_URL`) is pinged at the end of each run; its silence is the dead-man's switch.

External calls: Postmark (email, through the existing `email_sends` sender), the paging webhook, the heartbeat URL. All through `safeFetchJson` with the host allowlist of 06 section 7. Payloads carry rule id, summary, runbook path and dashboard link, never user data.

### 3.4 `moneyJournal` (every 2 minutes)

1. Reads the cursor object `journal/cursor.json` from R2 (`kairos-backups`), or re-derives it from the newest journal object.
2. One read-only transaction: `credit_ledger` rows with `id` above the cursor (`id`, `user_id`, `delta`, `reason`, `application_id`, `created_at`); `submission_attempts` with `settled_at`, `finished_at` or `started_at` after the cursor timestamps (`id`, `application_id`, `attempt_no`, `channel`, `phase`, `state`, `failure_code`); `applications` whose status changed to `submitted` after the cursor.
3. Writes one NDJSON object `journal/<yyyy>/<mm>/<dd>/<hhmm>-<executor>.ndjson` and then the new cursor (cursor last, so a crash re-writes an identical object under the same name). Ids and enums only.
4. Pings nothing; `A-DATA-2` fires when the newest object is older than 10 minutes (metric `backup.last_success_age_s{kind=journal}` written here).

External calls: R2 `PutObject` and `GetObject` (`@aws-sdk/client-s3`). Agents: none.

### 3.5 `submissionHealth` (every 15 minutes)

Reads `submission_attempts` (`ats`, `channel`, `state`, `failure_code`, `approved_by`, `user_id`, `started_at`) through `submission_attempts_started_brin` (about 22,000 rows in the last 24 hours), plus `autopilot_settings` and `ops_flags`.

Step A, per-ATS statement (the first statement of `_db/applications.md` 6.1) for the last 24 hours and, with the extra `started_at > now() - interval '1 hour'` filter, the last hour. Writes `submissions.failed_rate{ats,channel}` and `applier.challenge_rate{ats}`.

- Hourly failure rule (FR-56): at least 10 attempts and failure rate above 20% in the last hour: records the finding; `A-SUB-3` emails (at most once per 6 hours per ATS, enforced by the evaluator's `dedupeWindow`). It does not set a flag by itself (a failure spike can be a bad template on one board).
- Challenge rule: `applier.challenge_rate{ats}` above 30% over 24 hours with at least 20 attempts: upserts `ops_flags` key `extension_only:<ats>` (`active = true`, `reason = 'challenge_rate'`, `detail = {"attempts":N,"challenges":M}`, `set_by = 'system:ops-monitors'`, no `expires_at`). New cloud approvals for that ATS are skipped with `cloud_unavailable_for_ats`. Email the owner (`A-SUB-4`). The step never clears the flag (a blocked ATS gets no new attempts, so the rate cannot recover on its own); an operator clears it after checking the ATS. A weekly reminder email (flag older than 7 days) is part of `metricsTick`'s hourly block. No evasion is ever attempted: the response is always "send through the extension".

Step B, per-user Autopilot spike (second statement of 6.1), restricted to attempts with `started_at >= greatest(now() - interval '24 hours', autopilot_settings.counter_reset_at)`. For every user returned (at least 3 failures and failures at least 40% of that user's Autopilot attempts):

- Calls the applications module function `pauseAutopilot(tx, userId, 'failure_spike')` (identity module export named in `_db/identity-profile.md`). Inside one transaction, following the global lock order (balance row, then application rows by `id`): sets `autopilot_settings.paused_at = now()`, `paused_reason = 'failure_spike'`; returns every `approved_by = 'autopilot'` application not yet `submitting` to `draft` (the same statement the off switch uses, with `row_version` bumped by the trigger); writes an `application_events` row per returned application.
- Notifies the user: `notifications` kind `autopilot_paused`, `entity_id = <pausedAtEpochSeconds>`, and an `email_sends` row (`kind = 'autopilot_paused'`, `entity_id = '<userId>:<pausedAtEpochSeconds>'`). The email lists failure reasons by code, never form content. `profiles.mail_opt_out` containing `autopilot_summary` suppresses the email, never the in-app notification.
- A paused user resumes with `PUT /api/autopilot`, which resets `counter_reset_at`.

Step C, global Autopilot rule: Autopilot attempts in the last hour at least 20 and failure share above 25% (state `failed` or `needs_check`): upserts `ops_flags` key `autopilot_frozen` (`reason = 'global_failure_spike'`), pages (`A-AUTO-1`). Human approvals continue. The step never clears it (R-AUTO-1: an operator clears after one hour of clean `submission-health`; the step records `autopilot.clean_runs` gauge to help).

Step D, writes `metrics_minute`: `submissions.failed_rate`, `applier.challenge_rate`, `autopilot.failure_rate_1h`.

External calls: Postmark for the user email through the notify queue (`notify` enqueue by deterministic id `notify:autopilot_paused:<userId>:<epoch>`; this step does not send mail itself). Agents: none.

### 3.6 `invariantsHourly` and `invariantsNightly`

Checks run as read-only statements, one step per check, so a long check cannot hold up the others. The registry `INVARIANT_CHECKS` in `server/src/modules/ops/monitors/invariants.ts` holds, for each check, `{ id, schedule, sql, window, severity, response }`. `window` restricts to the last 2 days for the hourly run and is absent in the nightly run. Statements are the ones of `_db/applications.md` 6.2 and `_db/billing.md` 6 verbatim, so they are not repeated here.

| Check | Hourly | Nightly | What it proves | Response when count > 0 |
|---|---|---|---|---|
| I-1 Dual submission, hard | yes | yes | More than one attempt in state `submitted` for one application (INV-4) | Set `approvals_frozen`; page `A-SUB-2` |
| I-2 Dual submission, soft | yes | yes | An older `needs_check` attempt, a later `submitted` attempt, and no acknowledged `resent` event for it | Page `A-SUB-2` (no freeze); an acknowledged resend only increments gauge `submissions.possible_duplicates` |
| I-3 Submitted without exactly one submitted attempt | yes | yes | `applications.status = 'submitted'` and the count of `submitted` attempts is not 1 (2-day window) | Page |
| I-4 Submitted without charge, or charged without `submitted` | yes | yes | INV-5 both directions on `credit_ledger (application_id, reason = 'submission')` | Set `approvals_frozen`; page `A-BILL-1` |
| I-5 Pointer integrity | no | yes | `applications.current_attempt_id` points at an attempt of the same application | Page |
| I-6 In-flight cloud row without a live attempt | yes | yes | `status = 'submitting'`, `channel = 'cloud'`, no attempt in state `open` | Page (the `leaseSweeper` should have settled it) |
| I-7 Approved or sent without verification | yes | yes | `status IN ('approved','submitting','submitted')`, `approved_at` after the enforcement date, `verification->>'state' <> 'passed'` (INV-7) | Page; set `autopilot_frozen` if any row has `approved_by = 'autopilot'` |
| I-8 Citation integrity | no | yes | Non-terminal drafts citing a fact id that is missing, not owned by the user, or not confirmed (INV-2) | Page `A-INV-1`; the repair below |
| I-9 Rehearsal counters | no | yes | `rehearsal_sessions.questions_asked` equals the max turn `seq` over 30 days | Email |
| I-10 Autopilot approval with `gate_override` | no | yes | Proves `applications_autopilot_ck` is validated | Page (cannot occur) |
| BL-1 Ledger and in-flight drift | no | yes, 1,000 users per chunk | `credit_balances.balance <> SUM(credit_ledger.delta)` or `in_flight <> count(approved, submitting)` | Set `approvals_frozen`; page `A-BILL-1`; repair script |
| BL-2 Negative balance | yes | yes | `credit_balances.balance < 0` | Page (approvals already skip the user); a late confirmation is the usual cause |
| BL-3 Submitted but uncharged | yes | yes | Statement 2 of billing section 6 (10-minute grace) | Page; `approvals_frozen` when more than 3 |
| BL-4 Charged but not submitted | yes | yes | Statement 3 of billing section 6 | Set `approvals_frozen`; page |
| BL-5 Invoice paid without grant | yes | yes | `stripe_events` with `type = 'invoice.paid'`, `outcome = 'grant_applied'`, no `plan_grant` row for `object_id` after 1 hour | Page `A-BILL-1` |

Hourly checks BL-3 and BL-4 duplicate I-4 on purpose: I-4 is keyed from the application side, BL-3 and BL-4 from the ledger side; a bug in one join does not hide the defect. The freeze is set once; counts differ only in the finding.

**BL-1 chunking.** `invariantsNightly` loops chunks of 1,000 users: each chunk is one step with `afterUserId` carried in the loop variable (an id, so it is checkpoint-safe); a full pass over 10,000 users is 10 steps of 1 to 2 seconds. The statement timeout of the worker is 120 seconds (billing section 6).

**Response sequence for every finding** (one step, one datasource transaction):

1. Insert `ops_audit` (`operator = 'system:ops-monitors'`, `action = 'invariant.violation'`, `entity = 'check:<id>'`, `reason = 'invariant_violation'`, `detail = {"count":N,"sampleIds":[...]}` with at most 5 uuids, `request_id = 'mon:<monitor>:<period>:<check>'`). The unique index `ops_audit_request_uq (operator, request_id)` makes a replay a no-op.
2. If the response includes a freeze: upsert `ops_flags` (`approvals_frozen` or `autopilot_frozen`, `reason = 'inv_<id>'` such as `inv_i1`, `detail` = the same counts, `set_by = 'system:ops-monitors'`). The flag trigger writes a second `ops_audit` row for the flag itself.
3. Write `invariant.violations{check}` to `metrics_minute` (every run writes 0 or the count, so the series is dense and the evaluator can tell a clean run from a missed run).
4. The alert evaluator pages. The monitor itself sends no mail.

Freezes are sticky. A clean later run never clears them; an operator clears with the audited script (R-SUB-2, R-BILL-1). A new violation while a freeze is already active updates `detail` only if the sample ids changed.

**Repairs this worker performs.** Only one, for I-8: drafts with a dangling citation are moved to `draft_state = 'stale'` with a conditional update (`UPDATE applications SET draft_state = 'stale' WHERE id = ANY($ids) AND status = 'draft' AND draft_state IN ('ready','needs_facts')`; the `applications_guard_draft_state_bu` trigger validates the transition and `row_version` is bumped by trigger). The `reconcile-prepare` sweep then enqueues `reverify:<id>:<row_version>`. Approved rows that cite a dangling fact are not touched (approval-time facts hash is the contract); they appear in the finding for the operator. Every other violation is reported, not repaired: repairing money automatically is how a second defect gets written.

External calls: none. Agents: none.

### 3.7 `llmUsageReconcile` (02:30 daily)

Implements 03 section 8.5.

1. Reads `llm_calls` for the previous UTC day: `SUM(cost_usd)` and the four token sums per `workspace` and `model` (`llm_calls_agent_time_idx` or the day's partition).
2. External: `GET https://api.anthropic.com/v1/organizations/cost_report` and `.../usage_report/messages` with `bucket_width=1d` and `group_by[]=workspace_id`, `model`, using `ANTHROPIC_ADMIN_KEY` (held by the worker only if S-A1 finds a read-only usage credential; otherwise the step is a no-op that records `llm.reconcile.skipped = 1` and the weekly owner-run `npm run llm:reconcile` plus `POST /api/admin/llm-reconcile` supplies the numbers). Workspace ids map through `ANTHROPIC_WORKSPACE_ID_INTERACTIVE` and `ANTHROPIC_WORKSPACE_ID_BATCH`.
3. Writes `metrics_minute` `llm.reconcile_drift_pct{workspace,model,class}` and `ops_audit` (`action = 'llm.reconcile'`, `request_id = 'llm-reconcile:<from>:<to>'`, matching the workflow id the admin route uses). Drift above 2% on cost or 3% on a token class emails (`A-LLM-3`); above 10% pages (`A-LLM-2`).

Agents: none.

### 3.8 `modelDrift` (04:20 daily) and `weeklyCanary`, `evalNightly`

`modelDrift`:

1. External: `GET https://api.anthropic.com/v1/models` with the interactive key. Compares the ids in the registry (`ClaudeModel`: `claude-haiku-5-5`, `claude-sonnet-5-5`) with the response. Reads `ops_flags` `model_pin:<agentId>` to know pinned ids.
2. A registered id missing from the list, or a 404 `not_found_error` observed by the gateway today (counter `llm.errors.model_not_found`): pages (`A-LLM-1`), sets `agent_disabled:<agentId>` for every agent whose active model is gone only after a second consecutive failing run, because a transient list error must not stop drafting. A new snapshot id or a deprecation notice (monthly page read by `safeFetchJson` of `docs.anthropic.com`, allowlisted) emails the owner (`A-LLM-5`).
3. Weekly (Mondays, same run): reads `eval_runs` for the latest `kind = 'weekly_canary'` per agent; a missing run younger than 8 days emails.
4. Writes `llm.model_available{model}` (0/1). No model call is made.

`weeklyCanary` (Mondays 04:00): runs `npm run eval -- --kind weekly_canary` programmatically in the worker for the 50 golden cases of each agent against the production models, key `ANTHROPIC_KEY_EVALS`, workspace `kairos-evals`, `budget_class = 'eval'`, writes one `eval_runs` row per agent (`kind = 'weekly_canary'`). Any pass-bar regression emails; for `claim-verifier` a failing bar also sets `autopilot_frozen` (06 section 7 "Model drift" row). `evalNightly` (03:00): runs the three nightly checks of 03 section 13.6 against production data with `call_kind = 'nightly'` (about $0.10); skipped at shed level 1 or higher. These two are the eval runner's work; this worker only schedules them, stores the row and raises the alert. Their agent calls are `budget_class = 'eval'` or `'ops'` and are not part of pipeline cost.

### 3.9 Verifier shadow audit

Purpose: estimate how often `claim-verifier` accepted a claim that the stronger `claim-verifier-escalation` (Sonnet 5.5) would reject, since the verifier shares a model family with the drafters (B.9.6, risk R4).

`verifierShadowAuditSlice` (05:00 daily, audits the previous UTC day). Because 03 section 9.4 puts the whole day's `claim-verifier-escalation` envelope at $10 and the audit costs about $10 a week, the weekly 2% sample is taken in seven daily slices so it never exhausts the envelope in one burst.

1. **Select** (one read transaction). `verification_results v` joined to `applications a` on `a.id = v.application_id`: `v.verdict = 'supported'`, `v.check_source = 'verifier'`, `v.run_kind IN ('prepare','patch','reverify','repair')`, `v.shadow = false`, `v.created_at` within the day, and the deterministic 2% filter `abs(hashtextextended(v.id::text, $dayEpoch)) % 50 = 0`, ordered by that hash, `LIMIT :dailyMax` (320). Items already audited are excluded by `NOT EXISTS (SELECT 1 FROM verification_results x WHERE x.run_id = uuidv5(<audit namespace>, v.id::text) AND x.check_source = 'audit')`. Skip the whole slice when `ops_flags.llm_shed_level >= 1`, `llm_paused` or `agent_disabled:claim-verifier-escalation` is active (a skipped day is recorded as `audit.slices_skipped`; the rollup refuses to certify a week with fewer than 4 audited days).
2. **Group** the selected rows by `application_id` (usually one claim per application at this sampling rate; at most 5 claims per call).
3. **Judge** (one step per group, queue `batch-llm` with `workerConcurrency` 4). Reads, inside the step, the item text (from `applications.resume_lines`, `answers`, `cover_letter`, located by `item_kind` and `item_id`) and the cited facts (`facts` rows for the item's `factIds`; confirmed and owned by the user, checked again). If the item text no longer matches its recorded hash (the draft was edited or expired), the sample is dropped and counted `audit.dropped_stale`. Otherwise calls the agent `claim-verifier-escalation` via `runAgent(spec, input, ctx, { callKind: "audit" })` with `ctx.budgetClass = 'ops'`, `ctx.workspace = 'interactive'`, `ctx.applicationId` set, `userId` set (the gateway hashes it). The job description is not sent (the verifier never sees it). The agent's output is a verdict per item.
4. **Record** (same step, one transaction). Inserts into `verification_results`: `run_id = uuidv5(<audit namespace>, <original verification_results.id>)`, `run_kind = 'audit'`, `item_kind`, `item_id`, `verdict` (the escalation's), `rule` (`unsupported_by_cited_facts` for `unsupported` or `contradicted`, null for `supported`, `unverified` for `uncertain`), `check_source = 'audit'`, `outcome = 'audited'`, `llm_call_id`. The unique index makes a replayed step insert nothing. **The audit never changes the draft or the application.** A flipped claim in a draft that is still `draft` is reported in the finding and, only when the rollup freezes Autopilot, those drafts are covered by the guard (verification for Autopilot is re-required via the freeze).

`verifierShadowAuditRollup` (Mondays 06:00, the ISO week that just ended):

1. Reads `verification_results` with `run_kind = 'audit'` and `created_at` in the week: `sampled = count(*)`, `flipped = count(*) FILTER (WHERE verdict <> 'supported')`, grouped by the audited verifier prompt version (`applications.verification->>'promptVersion'` joined through the original row).
2. `estimatedFalseAcceptRate = flipped / sampled`. A flip is an upper bound on a false accept (the escalation model can itself be wrong), which is the safe direction.
3. Inserts `eval_runs` (one row per prompt version with at least 100 samples): `kind = 'shadow_audit'`, `agent_id = 'claim-verifier'`, `prompt_version`, `model = 'claude-haiku-5-5'`, `workspace = 'kairos-prod-interactive'`, `eval_set_hash` = SHA-256 of the sorted sampled `verification_results.id` values, `cases = sampled`, `failed_cases = flipped`, `failed_case_ids` = at most 50 of the flipped `verification_results.id` values as text, `metrics = {"sampled":N,"flipped":M,"estimatedFalseAcceptRate":r,"auditedDays":d,"effectiveSampleRate":e}`, `gates = {"estimatedFalseAcceptRate":{"max":0.01,"ok":true|false},"minSamples":{"min":300,"ok":...}}`, `passed`, `cost_usd` (sum of `llm_calls.cost_usd` for `call_kind = 'audit'` in the week), `git_sha` (`GIT_SHA`), `judge_version = NULL`.
4. Decision: `estimatedFalseAcceptRate` above 0.01 with at least 300 samples: upsert `ops_flags.autopilot_frozen` (`reason = 'shadow_audit_failed'`), page `A-LLM-4`. Fewer than 300 samples with 5 or more flips freezes as well; fewer than 300 samples with fewer than 5 flips is "inconclusive" (the row has `passed = false`, an email is sent, nothing is frozen, and Autopilot cannot open because it requires a passing recent row). Autopilot opening requires a recent `passed` `shadow_audit` row (02 section 7.6.7), so an inconclusive week blocks first-time opening but does not freeze a running Autopilot.

Cost and the "2%": at growth about 27,700 drafts a day with about 15 verified items each gives roughly 415,000 `supported` claims a day, so 2% is about 8,300 claims a day, far above the `dailyMax` of 320 (about 2,240 a week, about $10 a week at the expected $0.0045 per escalation call). The cap therefore binds at growth and the effective rate is about 0.08%, recorded as `effectiveSampleRate`. 2,200 samples with zero flips bound the true rate below 0.14% at 95% confidence, so the 1% threshold is testable. During beta, below about 16,000 claims a day, the full 2% is audited. This is raised in section 13.

---

## 4. Concurrency, rate limits, ordering, batching and priorities, with numbers at 10,000 users

| Concern | Rule |
|---|---|
| Workflow concurrency | Monitors run on the schedule thread of the worker, not on a queue, except the three that call a model (`evalNightly`, `weeklyCanary`, `verifierShadowAuditSlice`), which use queue `batch-llm` with `workerConcurrency` 4 per replica and a `globalConcurrency` of 4 for the audit (S-D1: `globalConcurrency`, not `concurrency`) |
| Single flight | Deterministic workflow id per period (section 2). A slow run is not duplicated; the next tick's id differs, so a run that outlasts its period overlaps the next. To stop pile-up, `costRollup`, `metricsTick`, `alertEvaluator` and `moneyJournal` take `pg_try_advisory_xact_lock(7281560 + monitorIndex)` in their first step and return `skipped` if held (key range 7281560 to 7281572 reserved; 7281551 is the migration lock) |
| Priority | `alertEvaluator` and `moneyJournal` are never delayed by the others; shed level never skips them. `costRollup` is never shed. `evalNightly`, `weeklyCanary` and the audit slice are skipped at `llm_shed_level >= 1`. `modelDrift` is not shed (no model call) |
| Database load | `costRollup`: one aggregate over today's partition (about 250,000 rows at growth, `llm_calls_agent_time_idx`), 60 to 150 ms. `metricsTick`: about 30 statements of under 10 ms. `submissionHealth`: BRIN range over 22,000 rows, under 50 ms. `invariantsHourly`: under 1 second in total on 2-day windows. `invariantsNightly`: BL-1 about 10 to 20 seconds in 10 chunks, I-8 `jsonb_array_elements` over non-terminal drafts (at most about 30,000 rows, 1 to 3 seconds) |
| Statement timeout | Worker role 120 seconds; every monitor statement sets `SET LOCAL statement_timeout = '30s'` except BL-1 chunks (60 seconds) |
| Pool | One connection per concurrent monitor from the worker's pooled `DATABASE_URL`; reads use a transaction with `SET TRANSACTION READ ONLY`; at most 3 monitor connections open at once (worker pool of the architecture reserves 3) |
| Anthropic | Audit: at most 4 concurrent calls, spaced by the gateway limiter (`LLM_RPM_SONNET`); 320 calls a day is 0.2 per minute, negligible against the Sonnet limit. Admin API: 2 calls a day. `/v1/models`: 1 call a day |
| R2 | One `PutObject` and one `PutObject` for the cursor every 2 minutes (720 + 720 a day) and one `GetObject` of the cursor |
| Ordering | Within a tick: flags and audit rows are written before gauges, so a dashboard never shows a gauge for a freeze that is not yet visible to `approveCore`. Within the invariant run: money checks (I-1, I-4, BL-*) first, then sending, then truth-lock, so a freeze on money lands in the first seconds |

---

## 5. Retries, backoff, timeouts, dead-letter handling, poison messages and compensation

- **Step retries.** Database steps: DBOS step retry `maxAttempts 3`, base 1 second, backoff 2 (1 s, 2 s, 4 s) for connection and timeout errors (SQLSTATE class 08, 57014, 40001, 40P01). A deterministic failure (bad SQL, constraint violation) is not retried.
- **Model steps (audit).** The gateway owns the retry ladder (retry, repair, tier-up, defer). The audit is the top tier already (Sonnet), so a persistent failure defers: the sample is not recorded, so tomorrow's slice excludes nothing and does not re-select it (a different day); the loss is counted in `audit.errors`.
- **External HTTP** (Anthropic Admin and models, Postmark, paging webhook, R2): timeout 10 seconds (30 seconds for R2 put), 3 attempts with 1 s, 4 s backoff, then the step records the failure and the workflow ends `completed` with a `degraded` status in its result. A monitor never fails the schedule because an optional output is down; the evaluator treats a missing series as a rule input (`absent for 5 minutes` on `ops.alert_evaluator_ok`, `backup.last_success_age_s`).
- **Poison input.** A check whose SQL raises a non-retryable error is a defect in the monitor. The step catches it, writes `monitor.errors{monitor,check}` (counter), logs `monitor_check_failed` at `error` with the check id, and continues with the next check. Three consecutive failed runs of the same check fire `A-INV-1` ("monitor blind") so a broken check cannot silently pass as clean. Findings are never swallowed: a check that cannot run counts as a finding with `count = -1` for display only.
- **Dead-letter.** There is none to drain: a monitor tick that exhausts its retries ends `ERROR` in DBOS and is visible through `GET /api/admin/workflows`. `dbos-orphan-recovery` resumes a tick whose executor died. A tick older than 2 periods is cancelled by `dbos-retention`'s terminal cleanup rather than resumed (stale output is useless; the next tick covers it): `costRollup`, `metricsTick`, `alertEvaluator` and `moneyJournal` check `startedAt` in step 1 and exit with `expired` if older than 2 periods.
- **Compensation.** The monitors write only flags, gauges, audit rows and verification-audit rows. Compensating a wrong freeze is an operator action with an audited script (`ops_audit` request id); a flag with an `expires_at` clears itself (`extension_only` has none by design; the cost flags expire at 00:00 UTC). A pause applied to a user by mistake is undone by the user (`PUT /api/autopilot`).
- **Backfill after downtime.** `costRollup` self-heals (it recomputes the current and previous day). `moneyJournal` resumes from its cursor; a gap longer than 10 minutes pages (`A-DATA-2`). Invariant checks use 2-day windows, so a 24-hour outage of the schedule loses nothing; the nightly run is unwindowed.

---

## 6. State transitions it performs and the invariants it must uphold

State it writes and the guard on each write:

| Object | Transition | Guard that makes it safe |
|---|---|---|
| `ops_flags.approvals_frozen` | absent or inactive to active | Upsert on the key; trigger audits; read by `approveCore` under the balance lock, so an approval already past the check completes, but no new approval starts. Never cleared by this worker |
| `ops_flags.autopilot_frozen` | to active | Same; `autopilotApprove` and `approveCore` read it |
| `ops_flags.extension_only:<ats>` | to active | The key regex in `ops_flags_key_ck` accepts only `[a-z0-9_.-]`; the value of `ats` is the `ats_provider` enum, so no free text reaches a key |
| `ops_flags.llm_shed_level`, `llm_batch_paused`, `agent_disabled:claim-verifier-escalation` | raised during the day, expire 00:00 UTC | The shed level is monotonic within a UTC day unless an operator set it; `ops_flags_value_ck` constrains values |
| `autopilot_settings` | `paused_at`, `paused_reason = 'failure_spike'` | Through `pauseAutopilot(tx, ...)`, under the global lock order; `autopilot_pause_enabled_ck` forbids pausing a disabled user, so the step skips users with `enabled = false` |
| `applications.draft_state` | `ready` or `needs_facts` to `stale` (I-8 repair only) | Conditional update on `status = 'draft'`; `applications_guard_draft_state_bu` validates; never touches `approved` rows |
| `verification_results` | insert, `outcome = 'audited'` | `verification_results_run_item_uq`; checks `verification_results_outcome_ck` |
| `eval_runs` | insert | `eval_runs_*_ck`; `kairos_worker` has INSERT; CI never writes `shadow_audit` |
| `llm_cost_daily`, `metrics_minute` | upsert | Primary keys |

Invariants it upholds or enforces:

- **INV-4/INV-5/INV-6 (one submission, one charge, rollover and billing integrity).** Enforced upstream by unique indexes and the balance lock; this worker detects violations (I-1 to I-4, BL-1 to BL-5) and freezes approvals. It cannot create or remove a ledger row.
- **INV-2 and INV-7 (truth lock, independent verification).** Detected by I-7, I-8 and the shadow audit; failure freezes Autopilot (the only path that can send without a human reading the text).
- **Autopilot rules (spike pause, global freeze).** Implemented here (3.5). Human approval is never frozen by an Autopilot rule.
- **Never automate around blocks.** The only response to a challenge rate is `extension_only:<ats>`; the step contains no retry, proxy or evasion path.
- **Cost.** The shed order follows B.11.3; verification of anything that will be stored or sent, approvals, submissions, settlement, billing and inbound email storage are never shed.
- **Privacy.** No monitor reads resume text except the audit step, which reads one item and its cited facts in memory (section 10).
- **No LinkedIn automation, no employer passwords, no mailbox reading:** this worker touches none of those surfaces.

---

## 7. Failure modes table

| Cause | Detection | User-visible effect | Recovery |
|---|---|---|---|
| Worker executor dies mid-tick | `dbos-orphan-recovery`; `durable.orphans` gauge | None (monitors lag one period) | Orphan sweeper resumes; the deterministic id stops a double run |
| `costRollup` stops | `llm.cost_usd.today` series flat 5 minutes (rule on `absent`) | Shed levels stop rising; pipelines still enforce the in-process 10-second budget check (03 section 9.3) | Restart; roll-up recomputes both days |
| `alertEvaluator` dies | `ops.alert_evaluator_ok` absent; external heartbeat silence pages from outside | None directly; incidents go unannounced | External monitor pages; restart worker |
| False-positive freeze (for example a bug in an invariant statement) | The page itself; `ops_audit` has the check id and sample ids | Approvals and resends return 503 `service_unavailable`/skip with `paused` for all users until cleared | Operator verifies with the statement, clears the flag by audited script, fixes the check; the 7-day clean-run test (section 11) prevents shipping an untested statement |
| Check misses a violation (statement wrong) | Cross-checks: I-4 vs BL-3/BL-4; weekly restore drill; `journal-reconcile.mjs` | Possible double charge or lost charge | Fix the statement; add a regression test; repair through `admin_adjustment` with `ops_audit` |
| Late confirmation drives a balance negative | BL-2 hourly | The user sees "no credits" until the next grant | Page; `admin_adjustment` with a note (R14) |
| Dual submission (I-1) | Hourly, `A-SUB-2` | One employer received two applications | Freeze (automatic), tell the user, correct the ledger, root-cause (R-SUB-2) |
| Autopilot spike | `submissionHealth` | User: Autopilot paused, notification and email with failure codes; global: all Autopilot stops | User resumes; operator clears `autopilot_frozen` after one clean hour |
| ATS challenge spike | Challenge rate above 30% (20+ attempts) | New cloud approvals for that ATS skipped (`cloud_unavailable_for_ats`); users told to send through the extension | Operator checks the ATS, clears `extension_only:<ats>` |
| Shadow audit finds a high flip rate | Rollup | Autopilot stops for everyone; human approval continues | Fix the `claim-verifier` prompt (a new version), pin the previous version with `prompt_pin`, re-verify affected drafts by script, clear after a new passing audit week |
| Anthropic Admin credential missing | `llm.reconcile.skipped` | None | Weekly manual reconcile; console limits and envelopes protect meanwhile |
| Model removed (404) | `modelDrift`, gateway counter | Drafts defer (`model_failed:model_not_found`); interactive builder routes return 503 `ai_unavailable` | `model_pin` to the previous id or `agent_disabled`; register the new id and run the upgrade procedure (03 section 14.1) |
| Paging webhook down | Evaluator logs failure; email still sends; heartbeat | Pages delayed | Email path continues; backup channel in `ALERT_EMAIL_TO` |
| R2 down for the journal | `backup.last_success_age_s{journal}` | None | Retries; page after 10 minutes (`A-DATA-2`) |
| Monitor query slows (table growth) | `monitor.duration_ms{monitor}` p95 | None | The `FK index check`, `EXPLAIN` in the nightly slow-query review; `llm_calls` partition pruning |
| Clock skew between replicas | Not used: windows use database `now()` | None | n/a |

---

## 8. Observability: logs, metrics, traces and alerts with thresholds

**Logs** (pino, `service: worker`, `workflowId = mon:...`): one `info` line per tick end `{monitor, period, findings, flagsSet, durationMs}`; `warn` for a degraded external call; `error` for `monitor_check_failed`, `llm_ledger_write_failed` and flag-write failures. No text from users; sample ids are uuids only.

**Metrics** written by this worker (all to `metrics_minute`): the `llm.*` set (3.1); `submissions.*`, `applier.challenge_rate{ats}`, `autopilot.failure_rate_1h` (3.5); `invariant.violations{check}` (0 when clean); `billing.ledger_drift_users`, `billing.negative_balances`, `billing.in_flight_drift_users`; `submissions.possible_duplicates`; `llm.reconcile_drift_pct{workspace,model,class}`; `llm.model_available{model}`; `audit.sampled`, `audit.flipped`, `audit.dropped_stale`, `audit.errors`, `audit.slices_skipped`, `audit.sample_rate_effective`; `monitor.duration_ms{monitor}`, `monitor.errors{monitor,check}`, `monitor.last_ok_epoch{monitor}`; `alert.firing{id}`, `ops.alert_evaluator_ok`; `backup.last_success_age_s{kind=journal}`; `durable.*`, `pg.*` as in 3.2.

**Traces.** Sentry samples at 1% for monitors (they are numerous and uniform); every error produces an event with the monitor name and check id. The audit step carries `kairos.agent.id = claim-verifier-escalation`, `kairos.call.kind = audit`, `kairos.budget.class = ops`.

**Alerts** (ids from 06 section 6.7; threshold, window, action):

| Id | Condition | Action |
|---|---|---|
| `A-SUB-2` | I-1 count above 0, or I-2 unacknowledged above 0 | Page; I-1 sets `approvals_frozen` |
| `A-SUB-3` | Per ATS: 10 or more attempts and above 20% failed in an hour | Email (once per 6 hours per ATS) |
| `A-SUB-4` | `applier.challenge_rate{ats}` above 30% with 20 or more attempts in 24 hours | Email; `extension_only:<ats>` set by `submissionHealth` |
| `A-AUTO-1` | 20 or more Autopilot attempts in an hour and failure share above 25% | Page; `autopilot_frozen` |
| `A-BILL-1` | Negative balance, BL-1 drift, I-4 or BL-3/BL-4, or BL-5 | Page; freeze per section 3.6 |
| `A-LLM-1` | Anthropic 401, 403 or spend-limit errors; model 404 | Page |
| `A-LLM-2` | `llm.cost_per_submitted_24h` plus infrastructure share above $0.01 (all-in over 24 hours), an agent at 100% of its envelope, reconciliation drift above 10% | Page; batch agents pause (`llm_batch_paused`); shed level 1 |
| `A-LLM-3` | Model cost above $0.0075 per submission over 24 hours; envelope at 80%; reconciliation drift above 2%; all-in above $0.009 over 7 days | Email |
| `A-LLM-4` | Shadow-audit `estimatedFalseAcceptRate` above 1% | Page; `autopilot_frozen` |
| `A-LLM-5` | Tier-up above 2% for an agent; escalations above 10% of drafts; model drift or deprecation | Email |
| `A-DATA-2` | Journal object older than 10 minutes | Page |
| `A-INV-1` (new, requested in section 13) | I-5 to I-10 or I-8 above 0; any check blind for 3 runs | Page for I-5, I-6, I-7, I-8, I-10 and blind checks; email for I-9 |

Dashboards: the existing "Spend and cost per submission" and "Submissions and Autopilot" Grafana boards (06 section 6.8). A new panel "Monitor health" shows `monitor.last_ok_epoch` and `monitor.duration_ms` per monitor.

---

## 9. Capacity and cost at 10,000 users

**Runs a day.** `costRollup` 1,440; `metricsTick` 1,440; `alertEvaluator` 1,440; `moneyJournal` 720; `submissionHealth` 96; `invariantsHourly` 24; `invariantsNightly` 1 (about 12 steps with chunks); `evalNightly` 1; `modelDrift` 1; `llmUsageReconcile` 1; `verifierShadowAuditSlice` 1; weekly: `weeklyCanary` and `verifierShadowAuditRollup` once. Total about 5,170 scheduled workflows a day.

**Checkpoint writes (S-D1 budget).** About 6 fixed writes per workflow plus one per step. Averages: 8 for the one-or-two-step per-minute monitors, 12 for `submissionHealth`, 14 for the hourly invariant run, 25 for the nightly run. Sum: (1,440 × 3 × 8) + (720 × 8) + (96 × 12) + (24 × 14) + 40 + 60 about 42,000 writes a day, 3.8% of the 1.1 million a day budget and about 2.1 per submitted application of the budgeted 55 (target 60, alert 80). The shadow audit adds 320 step writes a day. These workflows carry ids and counts only.

**Postgres.** Query time per day: about 1,440 × 100 ms (rollup) + 1,440 × 150 ms (metrics) + 96 × 50 ms + 24 × 1 s + 20 s nightly = under 7 minutes of one core in 24 hours, 0.5% of one connection. `metrics_minute` writes: about 60 series from this worker × 1,440 = 86,000 rows a day, within the 4.3 million row (30 days) projection of platform section 4.14. `ops_audit` rows: a few a day in a clean system (flag changes, reconcile); the 15,000 a year estimate holds.

**CPU and memory.** Negligible: a monitor tick is SQL plus small JSON. Peak memory is the audit step (one item and a handful of facts, under 1 MB) and the journal step (at most 20,200 settled attempts a day, so at most about 30 lines per 2-minute object). No new replica is needed; the worker's 1 vCPU and 1.5 GB (3 replicas at base, 4 at growth) absorb it.

**Model cost.**

| Item | Calls | Cost |
|---|---|---|
| Shadow audit, `claim-verifier-escalation` (Sonnet 5.5, effort low) | up to 320 a day (about 2,240 a week) | about $1.44 a day, about $10 a week at the expected $0.0045 per call; ceiling $0.012 × 320 = $3.84 a day |
| `evalNightly` | about 150 | about $0.10 a night (eval-class accounting) |
| `weeklyCanary` | 50 per agent per week | about $15 a week, workspace `kairos-evals` (limit $400 a month) |
| `modelDrift`, `llmUsageReconcile` | 0 model calls | $0 |

The pipeline-workspace spend of this worker is the audit alone: about $44 a month, 1.2% of the $3,619 model spend at base. Per submitted application: $1.44 / 20,200 = $0.00007, inside the $0.0076 all-in figure (the cost model's `claim-verifier-escalation` line already includes the audit allowance). At beta below 16,000 claims a day the 2% sample is smaller than the cap, so cost falls proportionally.

**Anthropic limits.** Audit rate 0.2 calls a minute; reconciliation 2 Admin calls a day. No effect on the `LLM_RPM_SONNET` budget.

---

## 10. Security and privacy notes

- **Least privilege.** `ops-monitors` runs as `kairos_worker`. It never uses `kairos_readonly` or `kairos_metrics` for writes. `alertEvaluator` reads Grafana-facing views only through `kairos_worker`'s existing grants. No monitor receives `STRIPE_SECRET_KEY` (the worker holds it for billing; the monitor code has no import path to the Stripe SDK, enforced by an import lint rule `no-restricted-imports` for `stripe` under `modules/ops/monitors/`).
- **Admin credential.** `ANTHROPIC_ADMIN_KEY` is read only by `llmUsageReconcile`, loaded through `envFor('worker')` and never logged. If S-A1 finds no read-only usage credential, the key is not provisioned on the worker at all and the step no-ops.
- **Data minimization in findings.** Findings, `ops_audit.detail`, flag `detail`, metrics labels and alert payloads contain check ids, counts and at most 5 uuids. No user id appears in a metric label; `ops_audit_reason_ck` forbids `@` in reasons. Pages carry no email address, no name, no text.
- **Shadow audit and PII.** The audit step is the only monitor that reads personal text. It reads one claim and its cited facts (at most 5 claims per call) in memory, sends them through the gateway's redaction (`redactResumeHeader`, no contact data), under the same ZDR and no-training terms as the drafting path, and stores only the verdict and the `llm_calls` ledger row (no prompt or completion, platform principle 1). The job description is not sent. Item text sits in memory for the duration of the step; checkpoints hold counts only (the `durable/pii-scan.test.ts` CI scan includes a seeded audit run).
- **Untrusted input.** Claim text derives from drafts that derive partly from job text; the audit prompt fences it (nonce fence, echo canary) and the agent output is schema-validated. A verdict that fails validation is recorded as `uncertain` and counted, never trusted.
- **Egress.** The monitors call only: `api.anthropic.com` (models, admin), `docs.anthropic.com` (deprecations), Postmark, the paging webhook and heartbeat hosts, and R2. All go through `safeFetchJson` with a fixed allowlist; none of the URLs derives from user input.
- **Flags as a control plane.** A flag write is an attack target (an attacker who writes `approvals_frozen` stops the service). Only `kairos_worker` and `kairos_api` hold INSERT/UPDATE on `ops_flags`; every change is audited by trigger; `alertEvaluator` pages on any flag set outside `system:ops-monitors`/`operator:*` set_by values.
- **Money journal.** Contains pseudonymous user ids; the same 35-day retention and `age`-encrypted bucket policy as the backups (06 section 5.3). A deleted user's lines are not rewritten (06 section 8.7).
- **No evasion.** Reaction to a challenged ATS is to stop cloud sending for that ATS. The monitors never touch proxies, user agents or CAPTCHA tooling.

---

## 11. Tests and acceptance criteria

**Unit (vitest, no network, no database unless noted)**

- `thresholds.test.ts`: shed-level function over a table of daily spend values ($189, $190, $219, $220, $259, $260), monotonic within a day, reset at 00:00 UTC, never lowers an operator-set level.
- `submission-health.test.ts` (pure decision function on fixture rows): ATS 9 attempts at 50% fails does not alert; 10 at 21% alerts; challenge 19 attempts at 40% does not set `extension_only`; 20 at 31% sets it; user with 2 failures of 2 is not paused; 3 of 7 (43%) is paused; 3 of 8 (37.5%) is not; global 20 attempts at 25% not frozen, 20 at 30% frozen.
- `audit-estimate.test.ts`: the estimate, the minimum-samples rule (299 samples with 4 flips is inconclusive, 299 with 5 freezes, 300 with 4 flips at 1.3% freezes, 2,200 with 22 flips (1.0%) passes, 23 fails).
- `ops-flags-keys.test.ts`: every key the monitors write satisfies `ops_flags_key_ck`, `ops_flags_reason_ck` and `ops_flags_value_ck`.
- `no-pii-in-findings.test.ts`: serialized `MonitorResult`, `ops_audit.detail` and alert payloads contain no `@`, no string of 36 characters that is not a uuid, and no seeded marker.

**Integration (Testcontainers `postgres:18`, the real migrations)**

- **Invariant statements against seeded violations** (the core test, one per check): seed a database with exactly one violation of each of I-1 to I-10 and BL-1 to BL-5 (bypassing triggers with `SET session_replication_role = replica` or the `migration:test` actor where needed) and assert the monitor reports that check's count of 1 and that `approvals_frozen` or `autopilot_frozen` is set exactly where section 3.6 says. A clean seeded database (1,000 users, 10,000 applications through the real workflows) reports zero findings for 24 simulated hourly runs (false-positive test).
- Acknowledged-resend scenario: `needs_check` attempt 1, `resent` event with `acknowledged = true`, `submitted` attempt 2: I-1 clean, I-2 clean, `submissions.possible_duplicates` = 1.
- Late confirmation scenario: `failed unconfirmed` then later `submitted` report: no I-1, BL-1 still clean, BL-2 reports the negative balance only when the balance is actually below zero.
- **Idempotent replay:** run each monitor twice with the same id: one `ops_audit` row, one flag row, one `eval_runs` row, one `verification_results` audit row per sample.
- **Autopilot spike:** seed 8 Autopilot attempts for one user with 3 failures: after one `submissionHealth` run, `autopilot_settings.paused_reason = 'failure_spike'`, approved Autopilot rows returned to `draft`, one notification and one `email_sends` row; a second run adds none; after `PUT /api/autopilot` resets `counter_reset_at`, the same old rows are no longer counted.
- **Lock order:** run `pauseAutopilot` concurrently with `approveCore` for the same user under `pg_stat_activity` observation; no deadlock in 1,000 iterations (A1 lock order).
- **Shadow audit with the fake Anthropic client** (`fakeAnthropic`, scripted verdicts): 400 selected claims, 5 scripted flips; `dailyMax` caps at 320; the rollup writes `eval_runs` with the right `metrics` and `autopilot_frozen` set when the rate exceeds 1%; stale items are dropped; shed level 1 skips the slice.
- **`costRollup` correctness:** insert `llm_calls` rows across a midnight boundary; the previous day is corrected by the next run; `llm_cost_daily_calls_ck` holds.

**Failure injection**

- Kill the worker process during `invariantsNightly` after chunk 4 of 10: the orphan sweeper resumes, chunks 1 to 4 are not re-run (step memoization), the freeze is set once.
- Postgres `statement_timeout` on a check: the step records `monitor.errors`, the other checks still run, three consecutive failures raise the blind-check alert.
- Paging webhook returns 500: email still goes out, `alert.firing` stays 1, re-notify after 30 minutes.
- Anthropic Admin API returns 401: `llm.reconcile.skipped`, `A-LLM-1` fires, no crash.
- Postmark down: notifications row exists, `email_sends` pending, the notify queue retries; the Autopilot pause still holds.
- R2 down for 15 minutes: `A-DATA-2` fires, journal catches up from the cursor with no gap in ledger ids.

**Acceptance criteria**

1. Every row of the section 3.6 table has a passing seeded-violation test and a clean-database false-positive test.
2. Zero false freezes in a 7-day staging soak on production-shaped data before the P2 exit gate, and zero in the first 14 days of enforced verification before `apps_06_guard_v3`.
3. A dual submission injected in staging produces `approvals_frozen` within 60 minutes (hourly run) and a page within 2 minutes of that run.
4. An Autopilot spike on a user pauses the user within 15 minutes plus one tick; a global spike freezes within the same bound.
5. The shadow-audit slice for one day completes in under 30 minutes and its cost, summed in `llm_calls` with `call_kind = 'audit'`, does not exceed $3.84.
6. `costRollup` lag (difference between `llm_calls` now and `llm_cost_daily` today) is under 2 minutes at all times in the load test of P8.
7. Total checkpoint writes from `ops-monitors` are under 50,000 a day (measured, metric `durable.checkpoint_writes_per_submitted` contribution below 3).
8. The `pii-scan` CI job finds no marker in `kairos_dbos` after running every monitor with seeded data.

---

## 12. Migration from the skeleton

The skeleton has no monitoring worker. What exists and what changes:

| Skeleton | Replaced by | Kept |
|---|---|---|
| BullMQ repeatable jobs in `server/src/worker.ts` (poll and scoring loops) | Not this worker's concern (other workers); `ops-monitors` adds new DBOS schedules only | n/a |
| `GET /api/usage` and the in-process cost log in `services/llm.ts` | `llm_calls` (migration `0002_platform_02_llm_ledger.sql`, applied) and `costRollup` | `usage` route contract |
| Manual SQL for balance and sign-up checks (`docs/06-implementation-plan.md` ad hoc) | `invariantsHourly`, `invariantsNightly`, and the 5-minute "sign-up without profile/balance" repairs (owned by `durable-ops`) | n/a |
| Stripe event `processed_at` | `stripe_events.status`, BL-5 (billing migration `billing_01_subscriptions_events`) | Event ids |

Rollout, per phase:

- **P1** (`platform_00_dbos_datasource`, `platform_01_control_plane`): `metricsTick`, `costRollup`, `alertEvaluator` with the `llm.*`, `durable.*` and `pg.*` series; `modelDrift` listing only; `ops_flags` and `ops_audit` are live from migration 0003/0004. Interim caps on the old scoring loop are enforced in code until `llm_shed_level` is wired into the gateway.
- **P2:** `invariantsHourly` (I-1 to I-4, I-6, BL-2 to BL-5) and `invariantsNightly` (BL-1, I-5), `moneyJournal`. First run in report-only mode (a feature flag `OPS_MONITORS_FREEZE=off` in `feature_flags` key `LIFECYCLE_V2` cohort) for 7 days: findings are recorded, freezes are not set. The chaos test of the P2 exit gate runs with freezes on.
- **P3:** I-7 (report-only until the enforcement date), I-8, and the shadow audit in shadow-week mode (rows written, no freeze).
- **P5:** `submissionHealth` Autopilot rules switched on before Autopilot opens; `apps_06_guard_v3` requires 14 clean days of I-7 and a passing shadow-audit row.
- **P6:** `llmUsageReconcile`, `evalNightly`, `weeklyCanary`, I-9.
- **P7:** nothing to remove; no monitor depends on Redis or BullMQ.

Files created: `server/src/modules/ops/monitors/{types,runner,cost-rollup,metrics,alerts,money-journal,submission-health,invariants,shadow-audit,model-drift,usage-reconcile}.ts`, `server/src/ops/alerts.ts` (`ALERT_RULES`), tests under `server/test/ops/`. Modified: `server/src/worker.ts` (register schedules), `server/src/durable/queues.ts` (no new queue; `batch-llm` reused). No existing file is deleted and no route contract changes; `extension/` and `shared/` are untouched.

---

## 13. Additions requested

1. **Shadow-audit cap and daily slices (decision needed).** 03 and 01 say "2% of supported claims weekly, about $10 a week". At growth that is internally inconsistent: 2% is about 58,000 claims a week, roughly 25 times the $10 budget. This spec samples 2% per day up to `dailyMax = 320` calls a day (about $10 a week), which gives about 0.08% at growth and the full 2% during beta, with a statistical bound stated in section 3.9, and spreads the cost over seven days so it does not exhaust the `claim-verifier-escalation` daily envelope. The owner should confirm the cap or raise the budget (each additional $10 a week adds about 2,200 samples). Requested edit: 01 B.9.6, 03 section 13.6 and `_db/platform.md` section 4.7 should say "2% of supported claims, capped at 320 audited claims a day".
2. **New alert `A-INV-1`** in 06 section 6.7 for invariants that have no id there (I-5 to I-8, I-10) and for a monitor check that is blind for three runs.
3. **`ops_flags` reason codes** used here (`cost_threshold`, `envelope_exhausted`, `escalation_cap`, `challenge_rate`, `global_failure_spike`, `shadow_audit_failed`, `inv_i1` ... `inv_bl5`) added to the documented reason vocabulary of `_db/platform.md` section 4.8 (the regex already accepts them).
4. **Advisory lock key range 7281560 to 7281572** reserved for monitor single-flight, next to the migration lock 7281551 in 06 section 4.
5. **`pauseAutopilot(tx, userId, reason)` export** with the global lock order stated in its contract, in `_db/identity-profile.md` (it names `pauseAutopilot` but not the signature or the return-to-draft side effect).
6. **`autopilot.skips_1h{reason}` source.** 06 lists the series; no foundation document says who writes it. This spec assumes `autopilotApprove` or `approveCore` writes counters to `metrics_minute`, or `application_events` records `auto_skipped`; the owner of the approval-autopilot worker spec should confirm one.
7. **Audit namespace and row linkage.** `verification_results` has no column linking an audit row to the original row; this spec uses `run_id = uuidv5(<AUDIT_NAMESPACE>, original_id)`. A named constant `AUDIT_NAMESPACE` in `server/src/llm/claims.ts` is requested.
8. **Verification prompt version per row.** The rollup needs the verifier prompt version of each audited claim; this spec reads `applications.verification->>'promptVersion'`. If a draft is re-verified under a newer version the join attributes the claim to the newest version. A `verification_results.prompt_version smallint` column would remove the ambiguity (low priority).
9. **Scheduled workflow id (S-D1 follow-up).** Confirm that a body started from `DBOS.registerScheduled` can start a workflow with an explicit `workflowID` (section 2), or that the scheduled id is deterministic from the scheduled time; otherwise the ids of section 2 are derived from the scheduled time argument.
10. **Eval runner callable from the worker.** `weeklyCanary` and `evalNightly` need `server/evals/run.ts` exposed as an importable function (`runEvalSuite({ kind, agents })`), not only as the CLI of 03 section 13.4.
