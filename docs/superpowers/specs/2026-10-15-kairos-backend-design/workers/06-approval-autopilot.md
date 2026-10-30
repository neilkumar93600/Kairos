# Worker spec 06: `approval-autopilot` (Approval, resend and Autopilot)

Tier: **critical**. Owner module: `server/src/modules/applications/` (approval, Autopilot guards, spread, return to draft), with workflow sequencing in `server/src/durable/workflows/`. Agents invoked: **none**. This worker never calls a model, and a gateway spy test asserts that (`03-agent-runtime.md` section 13, privileged paths).

Sources this spec implements exactly: `01-architecture.md` B.5.3, B.5.4, B.6.2 to B.6.4, B.6.10, B.11.1, B.11.3; `02-database.md` sections 5, 7.1.9, 7.3, 8.3, 9; `_db/applications.md` 4.1, 5.3, 6.1, 6.2; `_db/identity-profile.md` 3.12, 4.5; `05-api.md` 2.3, 7, 10.1, 10.3, 10.4, 10.7; `06-infrastructure.md` 6.7, 9.3, 9.4; spike S-D1 (`_research/spike-s-d1-local.md`). Where this spec needs something those documents do not have, it is listed in section 13.

---

## 1. Purpose and place in the lifecycle

This worker is the only code that moves an application into `approved`. It owns five durable units and one shared function:

| Unit | Kind | Process | What it does |
|---|---|---|---|
| `approveCore(tx, actor, request)` | function in `modules/applications/approve-core.ts` | api and worker | One approval transaction for three callers: the user's approve route, resend, and Autopilot. Takes the per-user balance lock, runs every human-path check, then, for the Autopilot actor, the ten Autopilot guards; reserves credits through the `in_flight` trigger |
| `queueMatch` | request workflow | api (also run as the body of `autopilotApprove`) | Turns a match into a draft (`draft_state = 'pending'`) and enqueues `prepareApplication` |
| `approveApplications` | request workflow | api | `approveCore(actor user)`, then enqueues `applyCloud` per cloud row |
| `resendApplication` | request workflow | api | `approveCore(actor user, mode resend)` from the route or the signed link, then enqueues `applyCloud` for the cloud channel |
| `autopilotApprove` | queued workflow, queue `autopilot` | worker | Two entry kinds: a qualifying match (runs the `queueMatch` body as actor `autopilot`) or a ready Autopilot draft (runs `approveCore(actor autopilot)` and enqueues `applyCloud` with a spread delay) |
| `submission-health` | scheduled workflow, every 15 minutes | worker | Per-ATS failure and challenge rules (extension-only switch), the per-user Autopilot failure-spike pause, and the global Autopilot freeze |
| `reconcile-autopilot` | scheduled workflow, every 5 minutes | worker | Liveness backstop for lost Autopilot hand-offs (new, section 13) |

It also owns `returnAutopilotApprovals(tx, userId, why)`, the off switch body. That function is called by `PUT /api/autopilot` (enabled false), the failure-spike pause, the admin pause (`owner_freeze`), the billing sync (`plan_change`) and the global-freeze fan-out.

Place in the lifecycle (`01-architecture.md` B.6.1):

```mermaid
sequenceDiagram
  autonumber
  participant U as Web app
  participant API as api (request workflows)
  participant SU as scoreUser (worker)
  participant AP as autopilotApprove (queue autopilot)
  participant PR as prepareApplication (queue prepare)
  participant PG as Postgres kairos
  participant CA as applyCloud (queue cloud-apply)

  alt human path
    U->>API: POST /api/matches/:id/queue
    API->>PG: queueMatch tx (actor user)
    API-->>PR: enqueue prepare:APP:1 (priority 10)
    PR->>PG: markReady (draft_state ready)
    U->>API: POST /api/applications/approve
    API->>PG: approveCore(actor user) under the balance lock
    API-->>CA: enqueue apply:APP:N (priority by plan)
  else Autopilot (opt-in)
    SU-->>AP: enqueue autopilot-queue:MATCH
    AP->>PG: pre-guards, then queueMatch body (actor autopilot)
    AP-->>PR: enqueue prepare:APP:1 (priority 50)
    PR->>PG: markReady; drafted actor is autopilot
    PR-->>AP: enqueue autopilot:APP:REV
    AP->>PG: approveCore(actor autopilot): human checks plus ten guards; send_not_before
    AP-->>CA: enqueue apply:APP:N with delaySeconds (priority 40)
  end
```

Downstream, `applyCloud` (worker spec `cloud-applier`) claims the row with `claim_cloud_attempt`, and `settleAttempt` (worker spec `submission-settlement`) charges the one credit through `recordOutcome`. This worker never writes the ledger, never opens a browser, and never changes a row out of `submitting`.

---

## 2. Trigger, schedule and payload (a TypeScript type), plus the idempotency key

### 2.1 Triggers

| Unit | Started by | Queue and partition key | Priority |
|---|---|---|---|
| `queueMatch` | `POST /api/matches/:id/queue` through `runRequestWorkflow` | none (runs on the api replica that starts it) | n/a |
| `approveApplications` | `POST /api/applications/approve` | none | n/a |
| `resendApplication` | `POST /api/applications/:id/resend` and `POST /api/applications/:id/resend-link` | none | n/a |
| `autopilotApprove` kind `match` | `scoreUser` (worker spec `fit-scoring`) for a new `pipeline` match at or above the user's effective Autopilot bar | `autopilot`, partition key `user_id` | none (queue has no priority) |
| `autopilotApprove` kind `draft` | `prepareApplication` step `markReady` when the application's `drafted` event has `actor = 'autopilot'`; `reconcile-autopilot` | `autopilot`, partition key `user_id` | none |
| `submission-health` | DBOS schedule, every 15 minutes, worker only (`DBOS.registerScheduled`) | n/a | n/a |
| `reconcile-autopilot` | DBOS schedule, every 5 minutes, worker only | n/a | n/a |

Follow-up work this worker enqueues:

| Enqueued workflow | Queue | Partition key | Priority | Workflow id |
|---|---|---|---|---|
| `prepareApplication` | `prepare` | `user_id` | 10 when queued by the user, 50 when queued by Autopilot | `prepare:<applicationId>:<revision>` (revision is 1 for a new draft) |
| `applyCloud` | `cloud-apply` | `companies.apply_host` | user approval and resend: Max 10, Pro 20; Autopilot 40 | `apply:<applicationId>:<attemptNo>` |
| `reverifyDraft` | `reverify` | none | 20 | `reverify:<applicationId>:<rowVersion>` (on a `facts_changed` skip) |
| `notify` | `notify` | none | none | `notify:autopilot_paused:<userId>:<pausedAtEpochSeconds>` |

The `autopilot` queue is registered after `DBOS.launch()` in `server/src/durable/queues.ts`, as spike S-D1 requires:

```ts
// server/src/durable/queues.ts (excerpt; specification-level)
await DBOS.registerQueue("autopilot", { partitionConcurrency: 1, globalConcurrency: 8 }); // partitioned: every enqueue passes user_id
```

### 2.2 Payloads

Every input is ids, enums, small integers and hashes only (rule D4, B.5.6), validated by zod at the start of the workflow. `userId` is Better Auth's text id, which the ids-only rule admits.

```ts
// server/src/durable/workflows/approval-types.ts
export type ApprovalChannel = "extension" | "cloud";

/** queueMatch: started by the route (actor user) or run as the body of autopilotApprove kind "match" (actor autopilot). */
export interface QueueMatchInput {
  userId: string;
  matchId: string;                 // uuid
  actor: "user" | "autopilot";
}
export type QueueMatchValue =
  | { kind: "created"; applicationId: string; revision: 1 }
  | { kind: "refused"; reason: "already_queued" | "company_cap" | "too_many_pending"; existingApplicationId?: string };

/** approveApplications: ids deduplicated and sorted by the route before the workflow id is computed. */
export interface ApproveApplicationsInput {
  userId: string;
  applicationIds: string[];        // 1..50 uuids, sorted ascending, unique
  channel: ApprovalChannel;
  requestHash: string;             // sha256 hex of canonical JSON {applicationIds, channel} (05-api 7.2)
}
export interface ApproveApplicationsValue {
  approved: string[];                                    // frozen field
  skipped?: { id: string; reason: SkipReason }[];        // additive, present only when non-empty
}

/** resendApplication: the route reads attempt_no once (plain read) to build the workflow id. */
export interface ResendApplicationInput {
  userId: string;
  applicationId: string;
  expectedAttemptNo: number;       // attempt_no read by the route; the transaction requires it unchanged
  channel: ApprovalChannel;        // default "extension"; the signed link always uses "extension"
  acknowledgeUnconfirmed: boolean;
  tokenHash?: string;              // sha256 hex of the signed-link token; consumed inside the approval transaction
}
export interface ResendApplicationValue { applicationId: string; status: "approved"; attemptNo: number }

/** autopilotApprove: two entry kinds, one queue. */
export type AutopilotApproveInput =
  | { kind: "match"; userId: string; matchId: string }
  | { kind: "draft"; userId: string; applicationId: string; revision: number };
export type AutopilotApproveValue =
  | { result: "drafted"; applicationId: string }
  | { result: "approved"; applicationId: string; attemptNo: number; channel: ApprovalChannel; delaySeconds: number }
  | { result: "skipped"; stage: "match" | "approve"; reason: SkipReason | "match_not_new" | "not_autopilot_draft" | "revision_moved" | "draft_budget" | "spend_cap" | "shed_level" };

/** submission-health and reconcile-autopilot: DBOS scheduled workflows receive the scheduled time. */
export interface ScheduledInput { scheduledAt: string /* ISO time from DBOS */ }

export type { SkipReason } from "@auto-career/shared/api"; // SKIP_REASONS, 05-api 9.4
```

The request workflows return the seam's `Outcome<T>` (`05-api.md` 2.3): `{ ok: true, value }` or `{ ok: false, status, code, message, details }` with scalar details only.

### 2.3 Idempotency keys (workflow ids)

| Workflow | Id | Why it is safe to repeat |
|---|---|---|
| `queueMatch` (user) | `queue:<matchId>:<epochMinute>` (`05-api.md` 7.5, AR-1) | `applications_user_job_uq` makes the insert once-only; a repeat after success returns `already_queued` |
| `approveApplications` | `approve:<sha256(userId, sorted ids, channel)>:<epochMinute>`; with `Idempotency-Key: K`, `approve:<sha256(userId, K)>` | The approval `UPDATE ... WHERE status = 'draft'` changes a row once; a repeat in a later minute returns `approved: []` for rows already approved; the bucket stops a stored refusal from being replayed for 14 days |
| `resendApplication` | `resend:<applicationId>:<attemptNo + 1>:<epochMinute>` | `expectedAttemptNo` must equal the row's `attempt_no`, which only moves forward |
| `autopilotApprove` kind `match` | `autopilot-queue:<matchId>` | One hand-off per match, forever; `matches_status_guard` lets the Autopilot actor move a match only from `new` to `queued` |
| `autopilotApprove` kind `draft` | `autopilot:<applicationId>:<revision>` | One Autopilot decision per preparation generation; the transaction requires `revision` unchanged and `status = 'draft'` |
| `applyCloud` (enqueued) | `apply:<applicationId>:<attemptNo>` | Every approval increments `attempt_no`; `claim_cloud_attempt` requires the same number |
| `submission-health`, `reconcile-autopilot` | DBOS scheduled workflow id (schedule name plus scheduled time) | Each interval runs once across replicas; every write is a conditional statement |

Inside the transactions, the effects that a replay could repeat are idempotent in the database: `application_events.dedupe_key` (`drafted`, `approved:<attemptNo>`, `resent:<attemptNo>`), `notifications_dedupe_uq (user_id, kind, entity_id)`, `email_sends (kind, entity_id)` claimed before the send, and conditional `UPDATE ... WHERE status = <expected>`.

---

## 3. Algorithm, step by step

Notation: **R** rows read, **W** rows written, **X** external calls. No step calls an agent. Every transaction is a DBOS datasource transaction on the `kairos` pool through PgBouncer, starts with `asActor(tx, actor)` (`02-database.md` 3.2), and follows the global lock order of `02-database.md` 5.1: `credit_balances` row, then `profiles` (never locked here), then `autopilot_settings`, then `applications` by `id`, then `submission_attempts`.

### 3.1 `approveCore(tx, actor, request)`

Signature as in `01-architecture.md` B.6.4, extended with the Autopilot context:

```ts
// server/src/modules/applications/approve-core.ts
export type ApproveActor = { kind: "user"; userId: string } | { kind: "autopilot"; userId: string };
export interface ApproveRequest {
  applicationIds: string[];              // 1..50 for users; exactly 1 for Autopilot and resend
  channel: "extension" | "cloud";
  mode?: "approve" | "resend";
  acknowledgeUnconfirmed?: boolean;
  expectedAttemptNo?: number;            // resend only
  expectedRevision?: number;             // Autopilot only
  tokenHash?: string;                    // signed-link resend only
}
export interface ApprovedRow { id: string; attemptNo: number; applyHost: string; channel: "extension" | "cloud"; priority: number; delaySeconds: number }
export interface ApproveResult { approved: ApprovedRow[]; skipped: { id: string; reason: SkipReason }[] }
/** Throws Refusal (rolls the transaction back): 402 payment_required (user actor), 403 forbidden, 409 conflict,
 *  409 not_approvable, 409 acknowledgement_required, 410 link_expired. */
export declare function approveCore(tx: Tx, actor: ApproveActor, req: ApproveRequest): Promise<ApproveResult>;
```

| # | Step | Reads (R) and writes (W) | Outcome |
|---|---|---|---|
| 1 | Plan gate | R `subscriptions` (`plan`, `status`, `past_due_since`) through `effective_plan()`; `getPlan()` from `shared/src/plans.ts` | Cloud channel without `cloudApplier`: Refusal 403 `forbidden` "The cloud applier is on Pro and Max" (AC-8) before any lock |
| 2 | Signed-link token (resend through the link only) | W `action_tokens`: `UPDATE action_tokens SET used_at = now() WHERE token_hash = $h AND purpose = 'resend' AND entity_id = $app AND user_id = $u AND used_at IS NULL AND expires_at > now() RETURNING 1` | Zero rows: Refusal 410 `link_expired`. A later refusal rolls the token use back, so a user without credits can buy credits and use the same link again |
| 3 | Balance lock | `SELECT ensure_credit_balance($u)`; R and lock `credit_balances (balance, in_flight) FOR UPDATE` | Serialization point for this user (rule L1) |
| 4 | Autopilot settings (Autopilot actor only) | R `autopilot_settings (enabled, threshold, daily_send_cap, paused_at)` without a lock: every writer of `enabled = false` or `paused_at` takes the balance lock first (rule A1), so this read is consistent | Input to guards 1 and 9 |
| 5 | Candidate rows | R and lock `applications a JOIN jobs j JOIN companies c` as in B.6.4, `WHERE a.user_id = $u AND a.id = ANY($ids) AND a.status = (resend ? 'failed' : 'draft') ORDER BY a.id FOR UPDATE OF a`; also `a.revision`, `a.match_id`, `a.draft_issue`, `j.ghost_verdict`, `job_fresh_at(j, c)`, `c.ats`, `c.apply_host` | Ids that are not the caller's or not in the expected status are skipped silently (frozen behavior). Resend: zero rows is Refusal 409 `conflict` with `details { status }`; `attempt_no <> expectedAttemptNo` is 409 `conflict` |
| 6 | Resend code check (resend only) | the row's `failure_code` | `posting_closed`: Refusal 409 `not_approvable`, `details { reason: "posting_closed" }`. `unconfirmed`, `timeout`, `no_report` without `acknowledgeUnconfirmed`: Refusal 409 `acknowledgement_required`, `details { failureCode }`. Resendable: `challenge`, `applier_error`, `required_missing`, `plan_lapsed`, `cloud_unavailable_for_ats`, `extension_reported` |
| 7 | Human-path checks per row, in order; first failure is the skip reason | R `facts` through `facts_snapshot_hash($u, cited ids)`; R `profiles (applications_paused_at, preferences)`; R `ops_flags` (`approvals_frozen`, `extension_only:<ats>`) through the 10-second flag cache; company-cap count over `applications_company_cap_idx`; Free plan only: R `profiles.normalized_email_hash` and a submitted Free application of another account with the same hash | Skip reasons in B.6.4 order: `not_ready`, `verification_pending`, `facts_changed`, `required_answers_missing`, `cover_letter_required`, `company_cap`, `paused`, `posting_closed`, `cloud_unavailable_for_ats`, `free_grant_used` |
| 8 | Autopilot guards (Autopilot actor only; guard 1 runs before step 7, guards 3 to 10 after it) | section 3.5 | Skip reasons of B.6.3 |
| 9 | Credit rule | `available = balance - in_flight` from step 3 | User actor: `available < approvable.length` is Refusal 402 `payment_required` "You have {available} credits left for {requested} applications", `details { available, requested }`, nothing changed. Autopilot: `available < 1` is skip `no_credits` |
| 10 | Spread (Autopilot cloud only) | section 3.6 | `send_not_before`, `delaySeconds` |
| 11 | Approve | W `applications`: `UPDATE applications SET status = 'approved', channel = $channel, approved_at = now(), approved_by = $actorKind, attempt_no = attempt_no + 1, draft_issue = NULL, failure_code = NULL, failure_reason = NULL, send_not_before = $sendNotBefore WHERE id = ANY($approvable) AND status = ANY($from) RETURNING id, attempt_no`. Triggers: `applications_guard_status_bu` (guard v3 refuses unless `draft_state = 'ready'` and verification `passed`), `applications_row_version_bu`, then `applications_in_flight_aiud` adds 1 to `credit_balances.in_flight` per row | A row count below `$approvable.length` cannot happen under the row locks; if it does, Refusal 409 `conflict` and an error log |
| 12 | Events and counters | W `application_events`: `approved` (actor `user`, `dedupe_key = 'approved:<attemptNo>'`) or `auto_approved` (actor `autopilot`, same key); resend adds `resent` (`resent:<attemptNo>`, `detail.acknowledged`); `ON CONFLICT DO NOTHING`. Autopilot: W `user_daily_usage.autopilot_sends + 1` for today (upsert) | Receipt trail of B.6.3 step 5 |
| 13 | Autopilot skip record | W `applications.draft_issue = 'autopilot_skipped:<reason>'` on the locked row | The draft stays in the review queue for the user (B.6.3 step 3) |
| 14 | Facts changed | When the skip reason is `facts_changed`: W `applications.draft_state = 'stale'`; the workflow body enqueues `reverifyDraft` | The draft cannot be approved until re-verified |

### 3.2 `queueMatch`

| Step | Kind | Reads and writes | External |
|---|---|---|---|
| 1 `queueTx` | datasource transaction | R `matches` (owned, `status`, `source`, `score`, `job_id`); R `jobs.closed_at`; company-cap count (`draft`, `approved`, `submitting`, `submitted` in 30 days, `applications_company_cap_idx`) against `preferences.maxApplicationsPerCompanyPer30Days`; count of the user's drafts with `draft_state = 'pending'` (limit 50); W `applications` `INSERT (user_id, job_id, match_id, resume_profile_id, gate_override) ... ON CONFLICT (user_id, job_id) DO NOTHING RETURNING id` (`gate_override = true` only for a `below_bar` match with `source = 'manual_url'`); W `matches.status = 'queued'` (actor `user` or `autopilot`; `matches_status_guard_bu` enforces the actor rule); W `application_events (drafted, dedupe_key 'drafted', detail.source)`; W `user_daily_usage.match_actions + 1` | none |
| 2 `enqueuePrepare` | enqueue (checkpointed) | none | DBOS enqueue `prepareApplication` with `prepare:<id>:1`, partition `user_id`, priority 10 or 50 |

Outcomes for the user route (`05-api.md` 10.1): created 201 `{ applicationId }`; existing 200 `{ applicationId: null, reason: "already_queued", existingApplicationId }`; `company_cap` and `too_many_pending` 200 with `applicationId: null`; not owned, `expired`, or `below_bar` without `manual_url` 404 `not_found`; closed job 409 `conflict` "This posting has closed".

### 3.3 `approveApplications` and `resendApplication`

| Step | Kind | What |
|---|---|---|
| 1 `approveTx` | datasource transaction | `approveCore(tx, { kind: "user", userId }, request)` (3.1). Output: `ApproveResult` (ids, attempt numbers, apply hosts, priorities) or a Refusal |
| 2 `enqueueApply` | one enqueue per cloud row | `applyCloud` with id `apply:<id>:<attemptNo>`, queue `cloud-apply`, partition key `apply_host`, priority Max 10 or Pro 20. Extension rows need no enqueue: `GET /api/extension/queue` lists `approved` extension rows |
| 3 `enqueueReverify` | enqueue, only for `facts_changed` skips | `reverifyDraft` with `reverify:<id>:<rowVersion>` |
| 4 return | workflow body | `Outcome` mapped by the route (`05-api.md` 10.3 and 10.4) |

The response is sent only after step 1 committed, so the web's next read sees the new state. The resend route answers `{ applicationId, status: "approved", attemptNo }`; the signed-link POST renders the result page of `05-api.md` 10.4.

### 3.4 `autopilotApprove`

**Kind `match`** (`autopilot-queue:<matchId>`):

| Step | Kind | Reads and writes | Result |
|---|---|---|---|
| 1 `autopilotQueueTx` | datasource transaction, actor `autopilot` | Pre-guards, cheapest first, each read-only: (a) `feature_enabled('AUTOPILOT', $u, plan)`; `ops_flag_on('autopilot_frozen')`, `ops_flag_on('approvals_frozen')`; (b) `autopilot_settings.enabled AND paused_at IS NULL` and plan `autopilotDailySendCap > 0`; (c) `matches.status = 'new' AND source = 'pipeline' AND score >= max(settings.threshold, preferences.fitThreshold)`; (d) `jobs.closed_at IS NULL`, `ghost_verdict = 'none'`, `injection_suspect = false`, `job_fresh_at(j, c) > now() - interval '6 hours'`; (e) cloud plan: `extension_only:<ats>` unset; (f) `profiles.applications_paused_at IS NULL`; (g) `credit_balances.balance - in_flight >= 1` (advisory read, no lock); (h) Autopilot drafts created today below the draft budget `ceil(1.2 x effectiveCap)`, counted as `application_events` rows with `kind = 'drafted' AND actor = 'autopilot'` since 00:00 UTC (`application_events_user_idx`); (i) `user_daily_usage.pipeline_usd < plan.dailyModelSpendCapUsd` (Autopilot stops at 1.0x, B.11.2) and `ops_flags.llm_shed_level < 3` (shed level 3 stops Autopilot-initiated drafting, `03-agent-runtime.md` 9.5). Then the `queueMatch` body (3.2 step 1) with actor `autopilot` | `drafted`, or `skipped` with stage `match` and nothing written |
| 2 `enqueuePrepare` | enqueue | `prepareApplication` with `prepare:<id>:1`, priority 50 | |

A match-stage skip writes no row (there is no application yet); it is counted in `autopilot.handoffs{stage="match",result}` and the match stays `new` in the user's feed.

**Kind `draft`** (`autopilot:<applicationId>:<revision>`):

| Step | Kind | Reads and writes | Result |
|---|---|---|---|
| 1 `autopilotApproveTx` | datasource transaction, actor `autopilot` | Requires `status = 'draft'`, `revision = $revision`, and a `drafted` event with `actor = 'autopilot'` (else no-op `revision_moved` or `not_autopilot_draft`); channel from the effective plan (`cloudApplier` true: `cloud`, else `extension`); then `approveCore(tx, { kind: "autopilot", userId }, { applicationIds: [id], channel, expectedRevision })` | `approved` (with `delaySeconds`) or `skipped` with stage `approve` |
| 2 `enqueueApply` | enqueue, cloud only | `applyCloud` with `apply:<id>:<attemptNo>`, partition `apply_host`, priority 40, `delaySeconds` from step 1 | |
| 3 `enqueueReverify` | enqueue, on `facts_changed` only | `reverifyDraft` | |

The Autopilot never edits the base resume (`resumes`), so no `pre_autopilot` revision is written (`01-architecture.md` B.8.2).

### 3.5 The ten Autopilot guards (inside `approveCore`, Autopilot actor)

Evaluated in this order for each candidate row; guard 2 is the whole human-path list of 3.1 step 7, so guard 1 runs before it and guards 3 to 10 after it. The first failure is the skip reason (B.6.3):

| # | Guard | Data | Skip reason |
|---|---|---|---|
| 1 | `autopilot_settings.enabled AND paused_at IS NULL`; `autopilot_frozen` unset; plan `autopilotDailySendCap > 0`; `AUTOPILOT` feature flag on for the user | settings row (3.1 step 4), `ops_flags`, `feature_flags` | `autopilot_off` |
| 2 | Every human-path check of 3.1 step 7 | as listed | the human-path reason |
| 3 | `matches.score >= max(threshold, preferences.fitThreshold)`; `matches.source = 'pipeline'`; `applications.gate_override = false` | `matches` via `applications.match_id` | `below_autopilot_threshold`, `manual_import`, `gate_override` |
| 4 | `verification.state = 'passed'` and `verification.supported = verification.checked` (no item kept on `uncertain`, no pending escalation) | `applications.verification` | `verification_pending` |
| 5 | Every answer whose question is `sensitive` in the `questions` snapshot has `source = 'profile'`; no required sensitive question is blank | `applications.questions`, `applications.answers` | `sensitive_answer_source`, `required_answers_missing` |
| 6 | `jobs.ghost_verdict = 'none'` | `jobs` | `ghost_risk` |
| 7 | `jobs.injection_suspect = false` | `jobs` | `injection_suspect` |
| 8 | `job_fresh_at(j, c) > now() - interval '6 hours'` | `jobs`, `companies` | `stale_posting` |
| 9 | Autopilot approvals today below `effectiveCap = min(settings.daily_send_cap, plan.autopilotDailySendCap)`: `SELECT count(*) FROM applications WHERE user_id = $u AND approved_by = 'autopilot' AND approved_at >= date_trunc('day', now(), 'UTC')` (`applications_autopilot_idx`); and the spread slot of 3.6 within 24 hours | `applications` | `autopilot_daily_cap` |
| 10 | `balance - in_flight >= 1` | `credit_balances` (locked) | `no_credits` |

### 3.6 Spread delay (Autopilot, cloud channel)

Inside the same transaction, under the balance lock, so two Autopilot approvals of one user can never pick the same slot (the `autopilot` queue also runs one workflow per user at a time):

```ts
// server/src/modules/applications/autopilot-spread.ts
export function nextSendSlot(input: {
  now: Date;
  effectiveCap: number;               // min(settings.daily_send_cap, plan.autopilotDailySendCap), at least 1 here
  lastSlot: Date | null;              // max(send_not_before) of the user's Autopilot approvals with approved_at > now - 24 h
  applicationId: string; attemptNo: number;
}): { sendNotBefore: Date; delaySeconds: number } {
  const perHour = Math.ceil(input.effectiveCap / 8);               // B.6.3 step 4
  const gapSec = Math.floor(3600 / perHour);
  const base = Math.max(input.now.getTime(), (input.lastSlot?.getTime() ?? 0) + gapSec * 1000);
  const jitterSec = fnv1a32(`${input.applicationId}:${input.attemptNo}`) % Math.min(600, Math.floor(gapSec / 2) + 1);
  const at = base + jitterSec * 1000;
  return { sendNotBefore: new Date(at), delaySeconds: Math.round((at - input.now.getTime()) / 1000) };
}
```

Jitter is a deterministic hash, so a replayed transaction computes the same slot. If `delaySeconds` exceeds 86,400 the guard 9 skip `autopilot_daily_cap` applies instead. With the daily cap respected, the largest delay is about 10 hours on Max (110 sends, gap 257 s plus jitter) and about 9.5 hours on Pro (45 sends, gap 600 s). Starter (extension channel) gets no delay: the frozen extension needs the user to press send.

`send_not_before` is stored on the application (section 13, A-1) so that `reconcile-apply` can honor a remaining delay if the delayed enqueue is lost.

### 3.7 `returnAutopilotApprovals(tx, userId, why)` (the off switch)

Caller has already locked the balance row and updated `autopilot_settings` (rule A1). One statement:

```sql
UPDATE applications
   SET status = 'draft', channel = NULL, approved_by = NULL, approved_at = NULL,
       lease_session_id = NULL, lease_expires_at = NULL, send_not_before = NULL,
       draft_issue = 'autopilot_skipped:autopilot_off'
 WHERE id IN (SELECT id FROM applications
               WHERE user_id = $1 AND status = 'approved' AND approved_by = 'autopilot'
                 AND (lease_expires_at IS NULL OR lease_expires_at < now())   -- a Starter item the user is sending now stays
               ORDER BY id FOR UPDATE)
RETURNING id;
```

`applications_in_flight_aiud` releases one reserved credit per row. `attempt_no` is kept, so an already enqueued `apply:<id>:<n>` finds the row not `approved` and ends as a no-op inside `claim_cloud_attempt`. Rows already `submitting` are in flight and are not touched. No event is written (the event kinds are an API contract; the next approval's higher `attemptNo` shows the undo, `_db/applications.md` 3.4).

| `why` | Caller | Settings write before the call |
|---|---|---|
| `off` | `PUT /api/autopilot { enabled: false }` | `enabled = false` (trigger clears the pause) |
| `failure_spike` | `submission-health` | `paused_at = now(), paused_reason = 'failure_spike'` |
| `owner_freeze` | `POST /api/admin/users/:userId/autopilot/pause` | `paused_reason = 'owner_freeze'`, plus an `ops_audit` row |
| `plan_change` | billing sync (`processStripeEvent`, `billing-reconcile`) | `paused_reason = 'plan_change'` |
| `global_freeze` | `submission-health` fan-out after setting `autopilot_frozen` | none (the flag is global) |

### 3.8 `submission-health` (every 15 minutes)

| Step | Kind | Reads and writes | External |
|---|---|---|---|
| 1 `atsRates` | step (read) | R `submission_attempts` (cloud, last 24 hours, `submission_attempts_started_brin`) grouped by `ats`: attempts, failures, challenges, and the same for the last hour | none |
| 2 `atsActions` | datasource transaction | Per ATS with at least 20 attempts in 24 hours and challenges above 30%: W `ops_flags` `extension_only:<ats>` (`set_by = 'system:submission-health'`, `reason = 'challenge_rate'`, `detail {attempts, challenges}`), `INSERT ... ON CONFLICT (key) DO UPDATE ... WHERE NOT ops_flags.active`; the `ops_flags_audit` trigger writes `ops_audit`. W `metrics_minute` gauges for the hourly per-ATS failure rule (A-SUB-3 is evaluated by the alert evaluator) | none |
| 3 `userSpikes` | step (read) | R the per-user statement below | none |
| 4 `pauseUser` | one datasource transaction per flagged user (usually 0 to 3) | Lock `credit_balances`; W `autopilot_settings SET paused_at = now(), paused_reason = 'failure_spike' WHERE user_id = $u AND enabled AND paused_at IS NULL RETURNING paused_at` (zero rows: already paused or off, no-op); `returnAutopilotApprovals(tx, $u, 'failure_spike')`; W `notifications (kind 'autopilot_paused', entity_id '<pausedAtEpochSeconds>', detail {reason, attempts, failures, topCode})` `ON CONFLICT DO NOTHING` | none in the transaction |
| 5 `notifyPaused` | enqueue | `notify:autopilot_paused:<userId>:<pausedAtEpochSeconds>`; the `notify` workflow claims `email_sends (autopilot_paused, <userId>:<pausedAtEpochSeconds>)` before calling Postmark | Postmark (in the `notify` worker) |
| 6 `globalRate` | step (read) | R Autopilot attempts in the last hour | none |
| 7 `freeze` | datasource transaction, only when attempts at least 20 and failures above 25% | W `ops_flags` `autopilot_frozen` (`reason = 'failure_spike'`, `set_by = 'system:submission-health'`, `detail {attempts, failures}`), insert-or-activate; no expiry: only an operator clears it (runbook R-AUTO-1) | none |
| 8 `freezeFanOut` | one step, only when step 7 changed the flag or the flag is active and unclaimed Autopilot approvals remain | R distinct `user_id` of `applications WHERE status = 'approved' AND approved_by = 'autopilot'` (`applications_autopilot_idx`); per user, a plain transaction on the application pool: lock balance, `returnAutopilotApprovals(tx, $u, 'global_freeze')`. Idempotent by the `WHERE status = 'approved'` condition, so a crash mid-loop re-runs safely | none |
| 9 `gauges` | step | W `metrics_minute`: `autopilot.failure_rate_1h`, `autopilot.paused_users`, `autopilot.frozen`, `submission_health.ok` | none |

Per-user statement (the `02-database.md` statement, extended to honor `counter_reset_at` as `_db/identity-profile.md` 3.12 requires):

```sql
SELECT sa.user_id,
       count(*) AS attempts,
       count(*) FILTER (WHERE sa.state IN ('failed','needs_check')) AS failures,
       mode() WITHIN GROUP (ORDER BY sa.failure_code) FILTER (WHERE sa.state IN ('failed','needs_check')) AS top_code
  FROM submission_attempts sa
  JOIN autopilot_settings s ON s.user_id = sa.user_id AND s.enabled AND s.paused_at IS NULL
 WHERE sa.approved_by = 'autopilot' AND sa.state <> 'open'
   AND sa.started_at > greatest(now() - interval '24 hours', coalesce(s.counter_reset_at, '-infinity'::timestamptz))
 GROUP BY sa.user_id
HAVING count(*) FILTER (WHERE sa.state IN ('failed','needs_check')) >= 3
   AND count(*) FILTER (WHERE sa.state IN ('failed','needs_check'))::numeric / count(*) >= 0.40;
```

Global statement: `SELECT count(*), count(*) FILTER (WHERE state IN ('failed','needs_check')) FROM submission_attempts WHERE approved_by = 'autopilot' AND state <> 'open' AND started_at > now() - interval '1 hour'`.

Human approvals continue while `autopilot_frozen` is set. Approvals returned by the fan-out keep `draft_state = 'ready'` and are approvable by hand; they are not re-approved automatically after the flag clears (their `autopilot:<id>:<revision>` workflow already completed).

### 3.9 `reconcile-autopilot` (every 5 minutes)

```sql
SELECT a.id, a.user_id, a.revision
  FROM applications a
  JOIN application_events e ON e.application_id = a.id AND e.kind = 'drafted' AND e.actor = 'autopilot'
 WHERE a.status = 'draft' AND a.draft_state = 'ready' AND a.draft_issue IS NULL
   AND a.prepared_at < now() - interval '10 minutes' AND a.prepared_at > now() - interval '3 days'
 LIMIT 500;
```

For each row, look up workflow `autopilot:<id>:<revision>` through the seam (`durable.getStatus`): none, enqueue it; `ERROR` or `CANCELLED`, `durable.resume` it once (the seam records the resume in `metrics_minute` `autopilot.dead_letter_resumed`); `PENDING` or `ENQUEUED`, leave it. A row whose workflow is `SUCCESS` cannot match the query (success always approves, sets `draft_issue`, or follows a moved revision). Lost match-stage hand-offs are not reconciled: the match stays in the feed for the user, which is the safe default.

---

## 4. Concurrency, rate limits, ordering, batching and priorities, with numbers at 10,000 users

Volumes at growth (10,000 registered users, 20,200 submitted applications a day; base differs by under 10%) [est, from `01-architecture.md` B.5.7 and the cost model]:

| Flow | Runs a day | Average per second | Peak per second (4x, evening hour) |
|---|---|---|---|
| `queueMatch` by users | 24,350 (27,700 drafts minus Autopilot drafts) | 0.28 | 1.1 |
| `approveApplications` | 4,300 calls, about 17,300 rows (average 4 ids) | 0.05 | 0.2 |
| `resendApplication` (route and link) | 600 | 0.007 | 0.03 |
| `autopilotApprove` kind `match` | 3,350 | 0.04 | 0.4 (bursts after scoring runs) |
| `autopilotApprove` kind `draft` | 3,350, about 2,900 approvals (13% skipped) | 0.04 | 0.3 |
| `submission-health`, `reconcile-autopilot` | 96 and 288 | | |

About 900 users have Autopilot enabled (35% of 2,500 paid users) [est].

**Concurrency controls.**

| Control | Value | Effect |
|---|---|---|
| Per-user serialization | `credit_balances` row `FOR UPDATE` in every approval, report, withdraw and off-switch transaction | Approve, Autopilot, extension report, withdraw and the off switch of one user run one at a time; different users never contend |
| `autopilot` queue | `partitionConcurrency: 1` per user, `globalConcurrency: 8` (S-D1 names) | One Autopilot decision per user at a time, so daily-cap counts and spread slots are exact; 8 across the fleet is 2x the peak of about 4 in flight |
| Request workflows | Run on the api replica that started them; bounded by the `kairos_api` PgBouncer pool (20 server connections) and 3 api replicas | At 1.3 starts a second at peak and about 15 ms each, under 0.1 connection busy on average |
| Rate-limit classes (`05-api.md` 6.2) | `prepare`: 10 per minute per user on `POST /api/matches/:id/queue`; `user_api`: 600 per minute per user on approve and resend; `link`: 20 per minute per IP on the signed-link pages | The queue route cannot flood `prepare` |
| Pending-draft limit | 50 drafts in `pending` per user | Bounds one user's share of `prepare` |
| Autopilot drafting | Draft budget `ceil(1.2 x effectiveCap)` a day; 1.0x `dailyModelSpendCapUsd`; shed level below 3 | Bounds wasted drafting when later guards skip |
| Autopilot sending | `effectiveCap` a day (Starter 35, Pro 45, Max 110); `ceil(effectiveCap / 8)` a hour through `send_not_before` | Spreads Autopilot cloud sends across about 8 to 10 hours, so they never form the applier's peak |

**Ordering.** Rows inside one approval are locked in `id` order, the balance row first (global lock order). `cloud-apply` priorities put human approvals ahead of Autopilot (Max 10, Pro 20, Autopilot 40); a human approval made after an Autopilot one is sent first even when both are due. The `autopilot` queue has no priority: per-user partitions already isolate users, and enqueue order is the order matches were scored.

**Batching.** The user approve route accepts up to 50 ids in one transaction (one balance lock, one `UPDATE`, one event insert). Autopilot approves exactly one application per transaction, so a skip of one never blocks another. The global-freeze fan-out runs one short transaction per affected user (at most about 900, usually under 100).

---

## 5. Retries, backoff, timeouts, dead-letter handling, poison messages and compensation

| Unit | Retry | Backoff | Timeout | On exhaustion |
|---|---|---|---|---|
| Any datasource transaction here | Inside the step, once, on SQLSTATE `40P01` (deadlock) and `40001` (serialization) only (`02-database.md` 5.1); never on a Refusal or a `23514` check violation | immediate | `kairos_api` statement timeout 10 s; `kairos_worker` 120 s | Request workflow: Outcome 503 `service_unavailable`, `Retry-After: 2`. Queue workflow: thrown as transient (next row) |
| Transient connection errors (`08006`, `57P01`, `ECONNRESET`, PgBouncer `server_login_retry`) in a worker step | DBOS step retry: `retriesAllowed: true, maxAttempts: 4, intervalSeconds: 1, backoffRate: 2` | 1, 2, 4 s | | The workflow ends in `ERROR`; `reconcile-autopilot` or `reconcile-apply` or `reconcile-prepare` re-derives the work |
| Enqueue steps | DBOS step retry, `maxAttempts: 4`, 0.5 s doubling; idempotent by workflow id | 0.5, 1, 2 s | | As above |
| Request workflows | No workflow retry; the client retries | | HTTP wait 5 s (`RequestWorkflowOptions.timeoutMs`); DBOS `timeoutMS` 60 s, so a slow commit is never cancelled after it committed | 503 `service_unavailable` with `Retry-After: 2`; a retry in the same minute bucket (or with the same `Idempotency-Key`) joins the same workflow; a success in the previous bucket is replayed through `successLookbackBuckets: 1` |
| `autopilotApprove` | DBOS recovery on crash; `maxRecoveryAttempts: 10` | | `timeoutMS` 120,000 | `ERROR` or `MAX_RECOVERY_ATTEMPTS_EXCEEDED`: dead letter (below) |
| `submission-health` | Steps retry as above | | `timeoutMS` 600,000 | The next run in 15 minutes repeats the whole check; `submission_health.ok` goes stale and alerts (A-AUTO-5) |

**Refusals are values, not errors.** A refusal is raised inside the transaction as `Refusal(status, code, details)` so the transaction rolls back, caught by the workflow body and returned as `{ ok: false, ... }`. DBOS checkpoints the step's thrown refusal, so a replay inside the same bucket returns the same refusal and never re-runs the transaction. Third-party error messages are never rethrown into DBOS; steps throw `KairosStepError(code)` with a short code (B.5.6).

**Dead letter.** A workflow of this worker in `ERROR` or `MAX_RECOVERY_ATTEMPTS_EXCEEDED` appears in `kairos_ops.stuck_workflows_v`. `reconcile-autopilot` resumes an Autopilot draft workflow once; a second failure leaves the draft in the review queue (ready, approvable by hand), increments `autopilot.dead_letter` and emails (A-AUTO-3). An `approveApplications` or `resendApplication` workflow that dies after its transaction committed is healed by `reconcile-apply` (cloud approval older than 5 minutes with no live `apply:<id>:<n>` and `send_not_before` passed); one that dies before the commit changed nothing.

**Poison messages.** An input that fails its zod schema is not retried: a request workflow returns 400 `bad_request`; a queue workflow ends at once with result `skipped` and reason code `invalid_input` in the log, and increments `autopilot.poison`. Unknown or foreign ids are not poison: they are skipped silently (user) or end as no-ops (Autopilot), by rule D1.

**Compensation.** The approval saga has one pivot: the browser submit inside `applyCloud` (`retriesAllowed: false`), after which only forward recovery exists (settlement by attempt phase). Before the pivot, every undo is a forward state transition in Postgres, never a call to another service:

| Situation | Compensation | Credit |
|---|---|---|
| Autopilot switched off, paused, frozen or plan changed before the claim | `returnAutopilotApprovals` (`approved` to `draft`) | Released by the `in_flight` trigger |
| Approval committed, `applyCloud` never enqueued | `reconcile-apply` enqueues it, honoring `send_not_before` | Stays reserved until settlement |
| Approval committed, user withdraws before the claim | Withdraw route (`approved` to `withdrawn`); the enqueued workflow's claim returns null | Released |
| Posting closes during the Autopilot delay | `applyCloud` precheck records `posting_closed`; settlement fails it | Released, never charged (INV-23) |
| Facts changed between preparation and approval | Skip `facts_changed`, `draft_state = 'stale'`, `reverifyDraft` enqueued | Never reserved |
| Signed-link resend refused (no credits) | The token consumption rolls back with the transaction | Never reserved |

---

## 6. State transitions it performs and the invariants it must uphold (and how)

### 6.1 Transitions

| Entity | From | To | Unit | Statement shape | Side effects |
|---|---|---|---|---|---|
| `matches.status` | `new` (user: also `below_bar` with `manual_url`) | `queued` | `queueMatch` | `UPDATE ... WHERE id = $m AND user_id = $u`; `matches_status_guard_bu` (actor `autopilot` may only do `new` to `queued`) | `user_daily_usage.match_actions + 1` |
| `applications` | (none) | `draft` (`draft_state = 'pending'`, `revision = 1`) | `queueMatch` | `INSERT ... ON CONFLICT (user_id, job_id) DO NOTHING` | event `drafted` (actor `user` or `autopilot`) |
| `applications.status` | `draft` | `approved` | `approveCore` (user or Autopilot) | conditional `UPDATE ... WHERE status = 'draft'`; guard v3 | `attempt_no + 1`, `in_flight + 1`, event `approved` or `auto_approved` |
| `applications.status` | `failed` | `approved` | `approveCore` mode resend | conditional `UPDATE ... WHERE status = 'failed'` and `attempt_no = $expected` | `attempt_no + 1`, `in_flight + 1`, events `approved` and `resent` |
| `applications.status` | `approved` (Autopilot, unclaimed, no live lease) | `draft` | `returnAutopilotApprovals` | 3.7 | `in_flight - 1`; `draft_issue = 'autopilot_skipped:autopilot_off'` |
| `applications.draft_issue` | any | `autopilot_skipped:<reason>` | `approveCore` (Autopilot skip) | on the locked row | none |
| `applications.draft_state` | `ready` | `stale` | `approveCore` on `facts_changed` | on the locked row | `reverifyDraft` enqueued |
| `applications.send_not_before` | null | a time | `approveCore` (Autopilot, cloud) | same `UPDATE` as the approval | delayed `applyCloud` |
| `autopilot_settings` | on | paused (`failure_spike`) | `submission-health` | `UPDATE ... WHERE enabled AND paused_at IS NULL` | notification and email |
| `ops_flags` | absent or inactive | `autopilot_frozen` active; `extension_only:<ats>` active | `submission-health` | insert-or-activate | `ops_audit` row by trigger; page (A-AUTO-1) or email (A-SUB-4) |
| `action_tokens.used_at` | null | now | signed-link resend | conditional `UPDATE` inside the approval transaction | none |

This worker never sets `submitting`, `submitted`, `failed`, `withdrawn` or `refunded`, never writes `credit_ledger`, and never turns Autopilot on.

### 6.2 Invariants

| Invariant | How this worker upholds it | Database backstop |
|---|---|---|
| INV-3 Approval before send is the default; Autopilot only within every guard | Only `approveCore` approves (boundary rule 7); Autopilot requires opt-in, the ten guards, the `AUTOPILOT` flag and no freeze; only Autopilot-drafted applications are offered to it (`drafted` actor), so a draft the user queued always waits for the user | Status guard has no `draft` to `submitting` or `submitted` pair; `applications_autopilot_ck`; `autopilot_consent_ck`; `autopilot_pause_enabled_ck` |
| INV-4 One application per (user, job); one submit from two tabs | Insert-once draft; approval by conditional update under row locks; deterministic `apply:<id>:<attemptNo>` | `applications_user_job_uq`; `submission_attempts_one_open_uq`; `claim_cloud_attempt` requires `attempt_no` |
| INV-18 Approval needs available credits | `balance - in_flight` under the balance lock; 402 (user) or `no_credits` (Autopilot) | `in_flight` maintained only by trigger; nightly drift check |
| INV-5 Charged only on `submitted` | This worker reserves, never charges; every exit from `approved` releases through the trigger | `credit_ledger_application_reason_uq` |
| INV-1 Company cap and fit bar | Company cap re-checked at queue and at approval (counting earlier rows of the same batch); Autopilot requires the score at or above `max(threshold, fitThreshold)` and never acts on imports or gate overrides | `applications_company_cap_idx`; `applications_autopilot_ck` |
| INV-2, INV-7 Truth lock and verifier pass | `not_ready`, `verification_pending`, `facts_changed` checks; Autopilot additionally requires every item `supported` | Guard v3 (`apps_06_guard_v3`) refuses approval unless `ready` and `passed` |
| INV-9 Sensitive questions never answered by a model | Autopilot guard 5 re-checks that every sensitive answer came from the profile's fixed table | `saved_answers_not_sensitive_ck` |
| INV-10, INV-19 Plan limits from `plans.ts`; cloud on Pro and Max | `effectivePlan` and `getPlan` only; caps, channel and `dailyModelSpendCapUsd` read from `plans.ts`; grep test | `applier_payload_v.effective_plan` re-checked at claim |
| INV-11 Queries scoped by the session user | `userId` comes from the session (routes) or from the owning row (Autopilot); every statement filters `user_id = $u` | Same-owner triggers |
| INV-14 Untrusted input never changes instructions | No model here; Autopilot skips `injection_suspect` jobs | `jobs.injection_suspect` |
| INV-23 Closed postings never charge | `posting_closed` skip; Autopilot freshness guard (6 hours) | Settlement row `posting_closed` |
| Autopilot hands-off rules | Spike pause, global freeze, off switch, receipts (`auto_approved` then `sent`), notification per send (written by `settleAttempt`) | `notifications_dedupe_uq` |

---

## 7. Failure modes table

| # | Cause | Detection | User-visible effect | Recovery |
|---|---|---|---|---|
| 1 | api replica dies after the approval transaction commits, before `applyCloud` is enqueued | DBOS recovery at relaunch; `dbos-orphan-recovery` (executor unseen 90 s); `reconcile-apply` (5 min) | Application shows `approved`; the cloud send starts up to about 6 minutes late | Workflow resumes at the enqueue; reconciler as the second line |
| 2 | Approval workflow slower than 5 s (lock wait, slow commit) | `kairos_request_workflow_timeouts_total` | 503 with `Retry-After: 2`; the web retries | Retry in the same bucket joins the workflow; the previous-bucket success lookback replays a success |
| 3 | Double click or two tabs approve the same ids | Same workflow id within the minute; conditional update across minutes | Second response equals the first, or `approved: []` | None needed |
| 4 | Approve races an extension report, withdraw or the off switch for the same user | Balance-row lock serializes them | One wins; the other sees the committed state (409 `conflict` on single-row routes) | None needed |
| 5 | Deadlock or serialization failure | SQLSTATE `40P01` or `40001`; `pg.deadlocks` | None after the in-step retry; else 503 | Retry; T-DB-2 proves zero deadlocks in the lock order |
| 6 | Not enough credits | 402 count in `approval.requests{result="payment_required"}` | 402 with available and requested counts; Autopilot skips `no_credits` | User buys credits; Autopilot drafts wait in review |
| 7 | Autopilot switched off while a delayed `applyCloud` waits | `autopilot.returned_to_draft{why="off"}` | Approvals return to review with a note; credits released | `claim_cloud_attempt` returns null; the workflow ends as a no-op |
| 8 | Off switch races a claim for the same application | Lock order; `submitting` rows are excluded | That one application is sent (it was already in flight); the rest return to draft | Documented behavior; receipt and notification as usual |
| 9 | Autopilot workflow fails repeatedly (bug, poison data) | `ERROR` status; `autopilot.dead_letter`; A-AUTO-3 | The draft stays in review, approvable by hand | `reconcile-autopilot` resumes once; then operator triage (R-DBOS-2) |
| 10 | Failure spike for one user (challenges, form changes) | `submission-health` per-user rule | Autopilot paused with the reasons in-app and by email; unclaimed approvals back in review | User fixes the cause and turns Autopilot back on; the counter window restarts |
| 11 | Systemic failure across Autopilot sends | Global rule (20 attempts, above 25% failed in an hour); A-AUTO-1 page | Hands-off sending stops for everyone; human approvals continue | Operator fixes and clears `autopilot_frozen` after one clean hour (R-AUTO-1) |
| 12 | `submission-health` stops running (worker down, schedule bug) | `submission_health.ok` older than 40 minutes (A-AUTO-5) | None immediately; spike protection is late | Page when Autopilot sent anything in the last hour; the operator may set `autopilot_frozen` by hand |
| 13 | Delayed enqueue lost or the delay option misbehaves | `reconcile-apply` finds an approved cloud row past `send_not_before` with no live workflow | Send starts up to 5 minutes after its slot | Reconciler enqueues `apply:<id>:<n>` |
| 14 | Posting closes during the delay | `applyCloud` precheck (ATS API 404) | `failed` with "This posting has closed", no charge | None; not resendable |
| 15 | Ghost verdict turns `possible` or `likely` during the delay | Not detected (the applier role cannot read the verdict) | The application is sent to a job that became suspicious within at most about 10 hours | Residual risk accepted; the daily `ghost-signals` refresh bounds it; section 13 A-9 offers a claim-time re-check |
| 16 | Plan downgrades during the delay | Billing sync pauses Autopilot (`plan_change`); `applyCloud` precheck `plan_lapsed` | Unclaimed approvals return to review; a claimed one fails without charge | User resends through the extension |
| 17 | Facts edited between preparation and Autopilot approval | `facts_changed` skip | Draft becomes `stale`, then `ready` after re-verification, and waits for the user (no second Autopilot decision for the same revision) | User approves by hand |
| 18 | Verifier shadow audit fails | `ops-monitors` sets `autopilot_frozen` (A-LLM-4) | As row 11 | `submission-health` fan-out returns unclaimed approvals; operator clears after the fix |
| 19 | Forged, replayed or expired resend link | Token check inside the transaction | 410 page "This link has expired" | None; the user resends from the app |
| 20 | Postgres unavailable | Health checks, A-PG-1 | 503 on approve and queue; Autopilot workflows retry and wait | DBOS recovery after Postgres returns; nothing was half-written |
| 21 | Anthropic outage | n/a (no model here) | Approvals and sends of ready drafts continue (never shed); Autopilot drafting pauses at shed level 3 | None needed |

---

## 8. Observability: logs, metrics, traces and alerts with thresholds

**Logs** (pino JSON, one line per unit; redaction as `05-api.md` 19.2): `msg: "approval"` with `workflowId`, `unit` (`queueMatch`, `approveApplications`, `resendApplication`, `autopilotApprove`, `submissionHealth`), `actor`, `userHash` (HMAC with `USER_HASH_KEY`), `channel`, `requested`, `approvedCount`, `skipped` (object of reason to count), `outcome` code, `txMs`, `lockWaitMs`, `delaySeconds` (Autopilot), `requestId`. Never answers, lines, letters, job titles or email addresses. Application ids appear only at `debug` level.

**Metrics** (written to `metrics_minute` by the units or the `metrics` schedule; names follow `06-infrastructure.md` 6.3):

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `approval.requests` | counter | `actor` (`user`, `autopilot`), `result` (`ok`, `partial`, `payment_required`, `forbidden`, `conflict`, `not_approvable`, `acknowledgement_required`, `link_expired`, `timeout`) | Every approval attempt |
| `approval.skips` | counter | `actor`, `reason` (`SKIP_REASONS`) | Per-row skips |
| `approval.tx_ms` | histogram (p50, p95) | `actor` | Transaction time |
| `approval.lock_wait_ms` | histogram (p95) | | Time to acquire the balance row |
| `queue_match.results` | counter | `actor`, `result` (`created`, `already_queued`, `company_cap`, `too_many_pending`, `not_found`, `closed`) | |
| `autopilot.handoffs` | counter | `stage` (`match`, `draft`), `result` (`drafted`, `approved`, `skipped`) | Funnel from match to approval |
| `autopilot.sends_1h`, `autopilot.skips_1h{reason}`, `autopilot.failure_rate_1h` | gauge | | Existing names (`06-infrastructure.md`) |
| `autopilot.delay_s` | histogram (p50, p95) | | Spread delays |
| `autopilot.enabled_users`, `autopilot.paused_users{reason}`, `autopilot.frozen` | gauge | | Settings state |
| `autopilot.returned_to_draft` | counter | `why` | Off switch, pause, freeze, plan change |
| `autopilot.dead_letter`, `autopilot.dead_letter_resumed`, `autopilot.poison` | counter | | Section 5 |
| `submission_health.ok` | gauge (timestamp) | | Last successful run |
| `kairos_request_workflow_timeouts_total` | counter | `route` | `05-api.md` 19.3 |

**Traces.** OpenTelemetry through Sentry's provider: one span per workflow (`kairos.workflow.id`, `kairos.queue`, `kairos.actor`) with child spans per step and per datasource transaction (`kairos.approved_count`, `kairos.skipped_count`, `kairos.lock_wait_ms`). The api span of the route links to the workflow span through the request id. Sampling: api 10%, approval workflows 100% for the first beta month, then 10%; errors 100%.

**Alerts.**

| Id | Condition | Window | Severity | Runbook |
|---|---|---|---|---|
| A-AUTO-1 (existing) | Autopilot global spike: at least 20 attempts in an hour and failures above 25% (`autopilot_frozen` set by `submission-health`) | 0 | Page | R-AUTO-1 |
| A-AUTO-2 (new) | More than 10 users paused by `failure_spike` in 24 hours | 24 h | Email | R-AUTO-1 |
| A-AUTO-3 (new) | `autopilot.dead_letter` above 0 | 1 h | Email | R-DBOS-2 |
| A-AUTO-4 (new) | Autopilot post-draft skip rate (skipped / (approved + skipped) at stage `draft`) above 25% with at least 100 hand-offs | 24 h | Email (drafting money is being wasted; tighten match-stage pre-guards) | R-AUTO-1 |
| A-AUTO-5 (new) | `submission_health.ok` older than 40 minutes | 0 | Page when `autopilot.sends_1h > 0`, else email | R-DBOS-2 |
| A-SUB-3, A-SUB-4 (existing) | Per-ATS failure rate; challenge rate with the extension-only switch | as defined | Email | R-SUB-3, R-SUB-4 |
| A-DUR-2 (existing, amended) | `cloud-apply` workflow pending above 30 minutes **after its `send_not_before`** | 1 min | Page | R-DBOS-2 |
| API (existing, `05-api.md` 19.4) | Request-workflow timeouts above 1% of approve and queue requests | 10 min | Email | R-SCALE-1 |
| Funnel watch (dashboard only) | `approval.skips{reason="facts_changed"}` above 5% of approvals | daily review | none | |

Dashboard 7 "Autopilot" (`06-infrastructure.md` 6.9) shows sends, skips by reason and stage, delays, failure rates, paused users and the freeze flag.

---

## 9. Capacity and cost at 10,000 users

**Runs a day and checkpoint writes** (S-D1 rule: about 6 fixed writes per workflow, plus 1 per step or enqueue, plus 2 per datasource transaction; queued workflows add 1):

| Unit | Runs a day | Writes per run | Writes a day |
|---|---|---|---|
| `queueMatch` (user) | 24,350 | 9 (6 + tx 2 + enqueue 1) | 219,000 |
| `approveApplications` | 4,300 | 10 (6 + tx 2 + about 2 cloud enqueues) | 43,000 |
| `resendApplication` | 600 | 9 | 5,400 |
| `autopilotApprove` (both kinds) | 6,700 | 10 (7 + tx 2 + enqueue 1) | 67,000 |
| `submission-health` | 96 | about 14 | 1,300 |
| `reconcile-autopilot` | 288 | about 8 | 2,300 |
| **Total** | | | **about 338,000 (about 16.7 per submitted application)** |

`06-infrastructure.md` 9.3 counts `approveApplications`, `resendApplication` and `autopilotApprove` (87,000) but has **no row for `queueMatch`**; adding it raises the fleet total from about 1.11 million to about 1.33 million writes a day and the unit metric from about 55 to about 66 per submitted application: above the target of 60, below the alert at 80 (section 13, A-5). Average load stays about 15 writes a second, far below the 400 a second trigger in A.7.

**CPU and memory.**

| Resource | Use | Headroom |
|---|---|---|
| api CPU | About 1.3 request workflows a second at peak, about 3 ms of CPU each (zod, seam, serialization): under 0.01 vCPU | More than 100x on 3 replicas of 0.5 vCPU |
| worker CPU | About 0.7 Autopilot workflows a second at peak, about 2 ms each; `submission-health` under 1 s of CPU a run | Negligible against 4 x 1 vCPU |
| Memory | No caches beyond the 10-second flag cache (a few KB); under 5 MB a process | n/a |
| Postgres | `approveCore` is 6 to 10 statements, about 5 to 15 ms with 50 rows; about 30,000 approval and queue transactions a day; `submission-health` scans about 22,000 attempt rows through the BRIN index in under 100 ms | Under 1% of the 4 vCPU primary |
| Connections | api: at most a few concurrent request transactions per replica within the existing 10-connection pool; worker: within its 12-connection pool | No change to the 118 and 134 of 200 budget |
| Applier relief | About 2,200 Autopilot cloud sends a day spread over 8 to 10 hours per user instead of bursting after scoring | Keeps the applier peak at the 21.5 contexts of B.12.4 |

**Model cost per day: $0.** This worker calls no agent. Two indirect costs are attributed here and measured:

| Indirect cost | Estimate | Control |
|---|---|---|
| Drafting spent on Autopilot drafts that are later skipped | About 450 skipped drafts a day x about $0.0026 of drafting and verification per draft [est] = about $1.20 a day, about 1% of growth model spend | Match-stage pre-guards (3.4 step 1), draft budget 1.2x the send cap; A-AUTO-4 at 25% |
| Pause and notification email | Under 50 `autopilot_paused` emails a day, about $0.06 a day on Postmark | n/a |

The hourly Autopilot summary email and the `autopilot_sent` notifications belong to `engagement-notify` and `submission-settlement`.

---

## 10. Security and privacy notes

- **Authorization.** Routes take `userId` only from the session (`session-nocache` on approve, resend and `PUT /api/autopilot`, so a revoked session cannot approve during the cookie-cache window). Every statement filters by `user_id`; foreign ids are skipped silently or answer 404, never 403, so ids cannot be probed. Autopilot workflows take `userId` from the owning row that triggered them.
- **Actor discipline.** Every transaction calls `asActor(tx, actor)` first. The `autopilot` actor can queue a `new` match and nothing else the guards protect (`matches_status_guard`); it cannot confirm facts, edit resumes or change settings.
- **Opt-in and consent.** Autopilot cannot be on without `enabled_at` and `consent_version` (`autopilot_consent_ck`); withdrawal of consent is the off switch, effective in the same transaction. `06-infrastructure.md` recommendation H5 (an email with a signed "turn off" link whenever Autopilot is turned on) is supported by this worker's `returnAutopilotApprovals`; its token purpose is requested in section 13.
- **Signed links.** Only the SHA-256 of a resend token is stored; the token is consumed inside the approval transaction, so a refused resend leaves it usable and a used token is never accepted twice. All failure cases render the same 410 page.
- **Checkpoints carry ids only.** Inputs and outputs are uuids, text user ids, enums, counts, hashes and ATS host names (64 characters at most); the `kairos_dbos` PII scan (`durable/pii-scan.test.ts`) covers every workflow here. Notification and event `detail` objects hold scalars only (codes and counts).
- **Untrusted input.** Job descriptions never reach this worker. Autopilot refuses jobs with `injection_suspect`, any ghost verdict other than `none`, gate overrides and imports, and requires every item verified `supported`.
- **Sensitive data.** Sensitive answers are read only to check their `source`, never logged. Autopilot never sends an application whose sensitive answer came from anywhere but the profile's fixed table (INV-9).
- **No new external surface.** The worker calls no third-party API; Postmark is reached only through the `notify` workflow. It holds no model, Stripe or data-encryption key beyond what its host process already has.
- **Repudiation.** `application_events` (`approved` or `auto_approved` with `attemptNo` and `channel`, `resent` with `acknowledged`) is append-only and is the evidence for "I never approved that" (T22).

---

## 11. Tests (unit, integration, failure injection) and acceptance criteria

**Unit** (`server/src/modules/applications/*.test.ts`, no database):

| Test | Asserts |
|---|---|
| Guard table | For each of the 20 `SKIP_REASONS`, a fixture that fails exactly that guard yields that reason, and the order matches B.6.4 then B.6.3 (first failure wins) |
| `nextSendSlot` | Max (cap 110) schedules 110 slots within 11 hours; Pro (45) within 10 hours; jitter is deterministic for the same `(applicationId, attemptNo)`; a slot beyond 24 hours yields `autopilot_daily_cap` |
| Workflow ids | Bucketed ids change at the minute boundary; the `Idempotency-Key` id has no bucket; `resend` id uses `attemptNo + 1` |
| Outcome mapping | Every Refusal maps to the status, code and `details` of `05-api.md` 10.3 and 10.4; a plain success is byte-identical to `{ approved }` |
| Effective threshold | `max(threshold, fitThreshold)` with `fitThreshold` 90 and threshold 85 requires 90 |
| Spy test | No `runAgent` call in any unit of this worker (`03-agent-runtime.md` privileged paths) |

**Integration** (Testcontainers Postgres 18 with DBOS launched, the real migrations and guard v3):

| Test | Asserts |
|---|---|
| Credit race | 200 concurrent approvals of 1 to 5 ids for a user with 10 available credits: exactly 10 rows approved, every other request 402, `in_flight` equals the count of `approved` plus `submitting` rows |
| Approve vs report vs withdraw | Interleaved approve, extension report, withdraw and off switch for 200 users: zero deadlocks (`40P01`), balances equal the ledger recount (extends T-DB-2) |
| Double submit | Two identical approve requests in one minute run one workflow; a third a minute later returns `approved: []`; the same `Idempotency-Key` with a different body is 422 `idempotency_key_reused` |
| Refusal replay | A 402, then a credit grant, then the same request in the next minute: approved |
| Resend | Each resendable code is re-approved with `attempt_no + 1`; `posting_closed` is 409 `not_approvable`; `unconfirmed` without acknowledgement is 409 `acknowledgement_required`; stale `expectedAttemptNo` is 409 `conflict` |
| Signed link | Valid token approves once; second use 410; a refusal (no credits) leaves the token unused; wrong application id 410 |
| Autopilot end to end | Fake ATS, test user on Pro: a match at 90 is drafted, prepared, auto-approved with `send_not_before`, sent by `applyCloud` after the delay (clock-controlled), charged once, events `drafted`, `verified`, `auto_approved`, `sent` |
| Autopilot guards | Each guard's fixture skips with its reason and sets `draft_issue = 'autopilot_skipped:<reason>'`; match-stage pre-guards write nothing |
| Only Autopilot drafts | A draft the user queued is never auto-approved even with Autopilot on |
| Off switch during a burst | 40 Autopilot approvals pending with delays, switch off: every unclaimed row returns to `draft`, credits released, delayed `applyCloud` workflows end as no-ops, a row with a live extension lease stays `approved` |
| Spike pause | 3 failures out of 5 Autopilot attempts: paused, approvals returned, one notification, one email claim; a resume restarts the window (`counter_reset_at`) so old failures no longer count |
| Global freeze | 20 attempts with 6 failures in an hour: `autopilot_frozen` set once, `ops_audit` row, fan-out returns approvals of every user; human approvals still succeed |
| Extension-only | 20 cloud attempts on one ATS with 7 challenges in 24 hours: `extension_only:<ats>` set; new cloud approvals for that ATS skip `cloud_unavailable_for_ats` |
| Authorization matrix | Every route of this worker with two users: foreign ids are skipped or 404 |

**Failure injection:**

| Test | Asserts |
|---|---|
| Kill the api between the approval commit and the enqueue (hook in the seam) | After relaunch or orphan recovery the `applyCloud` workflow exists exactly once; `reconcile-apply` finds nothing extra to do |
| Kill the worker inside `autopilotApproveTx` and after it | No double approval, no double event (`dedupe_key`), `attempt_no` incremented once |
| `forkWorkflow(id, 0)` of each workflow kind (rule D1) | The fork is a no-op: no new rows, no new enqueue |
| Lose the delayed enqueue (drop the workflow row) | `reconcile-apply` enqueues it within 5 minutes after `send_not_before` |
| PgBouncer restart during approvals | Requests answer 503 or succeed; no partial state |
| Deadlock injection (`deadlock_timeout = 200ms`, adversarial ordering in a test-only path) | The production paths never deadlock; the injected one retries once and succeeds |

**Acceptance criteria.**

1. P2 chaos exit (`01-architecture.md` B.14): during 1,000 scripted approvals with process kills, every application terminal within 10 minutes, zero duplicate attempts, zero double charges.
2. P5 exit: switching Autopilot off during a burst returns every unclaimed approval to draft and releases its credit (100% in the test above).
3. Every frozen-contract call of the approve and queue routes is byte-identical in the recorded contract suite.
4. p95 of `approval.tx_ms` under 50 ms and p95 route latency under 300 ms at the P8 load (1.5x growth).
5. Autopilot opens to users only after guard v3 is live, the verifier has enforced for 14 days, and the shadow audit is at or below 1% false accept.
6. `kairos_dbos` PII scan finds no marker string from any workflow of this worker.

---

## 12. Migration from the skeleton: which files it replaces and what is kept

| Skeleton file | What happens |
|---|---|
| `server/src/services/submissions.ts` `approveApplications` | Replaced by `modules/applications/approve-core.ts` (`approveCore`) |
| `server/src/services/submissions.ts` `planFor` | Replaced by `effectivePlan(subscription)` (billing module) |
| `server/src/services/submissions.ts` `claimForCloud` | Replaced by the SQL function `claim_cloud_attempt` (worker spec `cloud-applier`) |
| `server/src/services/credits.ts` `availableCreditsNow`, `getBalance`, `countInFlight` | Replaced by one locked read of `credit_balances`; the pure `availableCredits(balance, inFlight)` is kept and used by `approveCore` |
| `server/src/routes/applications.ts` `POST /approve` handler | Becomes a thin handler: validate with the frozen `approveApplicationsSchema`, dedupe and sort ids, `runRequestWorkflow(approveApplications, ...)`, `respond` |
| `server/src/routes/matches.ts` `POST /:id/queue` | Thin handler over `runRequestWorkflow(queueMatch, ...)`; the BullMQ `tailor-application` enqueue is replaced by `prepareApplication` |
| `server/src/jobs/queues.ts` calls `enqueue("cloud-apply")` and `enqueue("tailor-application")` from these routes | Removed from these routes; the queues drain in P2 and P3 (`01-architecture.md` B.14) |

New files: `server/src/modules/applications/{approve-core.ts, autopilot-guards.ts, autopilot-spread.ts, return-autopilot.ts, queue-match.ts, resend.ts}`; `server/src/durable/workflows/{queue-match.ts, approve-applications.ts, resend-application.ts, autopilot-approve.ts, submission-health.ts, reconcile-autopilot.ts}`; the `autopilot` queue registration in `server/src/durable/queues.ts`. `PUT /api/autopilot` lives in `profile/autopilot-settings.ts` (identity domain) and calls `returnAutopilotApprovals`.

Kept unchanged: the frozen request schema and response shape `{ approved }`; the 402 wording "You have {available} credits left for {requested} applications"; the 403 wording "The cloud applier is on Pro and Max"; silent skipping of ids that are not the caller's drafts; `INSERT ... ON CONFLICT (user_id, job_id) DO NOTHING` for drafts; the skeleton's credit-race and approve tests (they must pass on both paths).

**Phases.**

| Phase | What lands | Flag | Rollback |
|---|---|---|---|
| P2 | `approveCore` (user actor), `queueMatch`, `approveApplications`, `resendApplication`, signed resend links, the per-ATS rules of `submission-health` | `LIFECYCLE_V2` per user (1%, 10%, 50%, 100%), read once per request | Flag off: the old route path, which the new triggers keep consistent (`in_flight` is maintained for both) |
| P5 | Autopilot guards, `autopilotApprove`, spread delays, `send_not_before`, the Autopilot rules of `submission-health`, `reconcile-autopilot`, the off switch | `AUTOPILOT` (internal accounts, then 10% of Pro and Max, then all paid plans), after guard v3 (`apps_06_guard_v3`) | Flag off: `GET /api/autopilot` answers disabled; set `autopilot_frozen` to stop in-flight hand-offs |

During the overlap an application is never processed by both engines: the new workflow ids and the old job ids derive from the same entity ids, and `claim_cloud_attempt` is the single gate for a send.

**Places this spec follows spike S-D1:**

| Spike result | Where it changed this spec |
|---|---|
| Queues are database-backed, registered after launch with `DBOS.registerQueue`; `globalConcurrency` instead of `concurrency`; no `partitionQueue`, any `partition*` option partitions the queue | 2.1 queue registration; every enqueue in 2.1 passes a partition key (`user_id` for `autopilot` and `prepare`, `apply_host` for `cloud-apply`); 4 concurrency table |
| `forkWorkflow` replays from step 0, so rule D1 is mandatory | Every unit's first step is a conditional transaction (`status = 'draft'`, `revision`, `attempt_no`); events use `dedupe_key`; fork test in 11 |
| No public recover-for-other-executors call | Orphans recovered by cancel and resume (`dbos-orphan-recovery`); `reconcile-autopilot` uses `durable.resume`; `reconcile-apply` re-enqueues cloud work |
| No garbage-collection call; retention by `deleteWorkflows` | The 14-day replay window of `Idempotency-Key` approvals is the `dbos-retention` schedule's (2.3) |
| About 6 fixed writes per workflow, 1 per step, 2 per datasource transaction; target 60, alert 80 | Section 9 write table and the missing `queueMatch` row |
| CommonJS packages; pin `pg@8` | Only `server/src/durable/` imports the SDK (default import); no other effect here |

---

## 13. Additions requested

| Id | Target document | Request | Why |
|---|---|---|---|
| A-1 | `02-database.md` 7.3.1, `_db/applications.md` 6.1 | Add `applications.send_not_before timestamptz` (nullable, not indexed, not in the `applications_row_version` column list, HOT-safe) with `CONSTRAINT applications_send_not_before_ck CHECK (send_not_before IS NULL OR approved_by = 'autopilot')`; `reconcile-apply` selects `... AND coalesce(send_not_before, approved_at) < now() - interval '5 minutes'`; return-to-draft and `returnAutopilotApprovals` clear it | B.5.8 says the reconciler honors "a remaining Autopilot delay", which needs the delay stored; it also makes A-DUR-2 correct (A-4) |
| A-2 | `shared/src/plans.ts` | Add `autopilotDailySendCap` (Free 0, Starter 35, Pro 45, Max 110); the file does not have it yet. Also reconcile `dailyModelSpendCapUsd`: the file has 0.5, 2, 5 and 8, while `01-architecture.md` B.7.4 and `04-matching.md` use 0.05, 0.20, 0.25 and 0.50; Autopilot's 1.0x stop reads this field | INV-10: plan values only from `plans.ts` |
| A-3 | `01-architecture.md` B.5.8, worker spec `durable-ops`, `_db/applications.md` 6.1 | Add the `reconcile-autopilot` schedule (3.9, every 5 minutes) | No existing reconciler recovers a lost or failed `autopilot:<id>:<revision>` hand-off |
| A-4 | `06-infrastructure.md` 6.7 A-DUR-2 and `kairos_ops.stuck_workflows_v` | Measure the age of a `cloud-apply` workflow from `max(enqueued time, send_not_before)`, not from the enqueue | Delayed Autopilot sends sit `ENQUEUED` for hours by design and would page falsely |
| A-5 | `06-infrastructure.md` 9.3, `01-architecture.md` B.5.7 | Add the `queueMatch` row (about 24,350 runs and 219,000 writes a day); the unit metric becomes about 66 per submitted application (above the target of 60). Levers, in order: the `prepareApplication` step merge already named there; then letting the queue route start `prepareApplication` directly after its plain transaction, with `reconcile-prepare` (10 minutes) as the crash backstop, saving about 219,000 writes a day | The budget table omits a workflow that runs once per draft |
| A-6 | worker spec `prepare-application` | In `markReady`, enqueue `autopilotApprove` (`autopilot:<applicationId>:<revision>`, queue `autopilot`, partition `user_id`) exactly when the application's `drafted` event has `actor = 'autopilot'`; enqueue nothing after `needs_facts` or `failed`; use priority 50 for Autopilot drafts | Defines "a draft created by Autopilot" (B.6.5) from one durable source that the reconciler can read too |
| A-7 | `01-architecture.md` B.5.4, `05-api.md` 2.3 | Request workflows: the 5-second figure is the HTTP wait (`RequestWorkflowOptions.timeoutMs`); the DBOS `timeoutMS` of the workflow is 60 seconds | A 5-second DBOS timeout could cancel a workflow after its transaction committed and before its enqueue |
| A-8 | `server/src/durable/` seam (`01-architecture.md` B.5) | `durable.enqueue` accepts `delaySeconds`, mapped to DBOS 5.3.0 delayed enqueue [verify the exact option name in the Railway half of S-D1]; plus `durable.getStatus(workflowId)` and `durable.resume(workflowId)` for reconcilers | Used by 3.4 and 3.9; A-1 is the fallback if the option misbehaves |
| A-9 | worker spec `cloud-applier`, `02-database.md` 8.3 | Optional: add `j.ghost_verdict` and `a.approved_by` to `applier_payload_v` so `applyCloud`'s precheck fails an Autopilot send whose job turned `possible` or `likely` during the delay (failure code `posting_closed` is wrong for this; a new code `ghost_risk` would be needed in `FAILURE_CODES` and both CHECK constraints) | Closes residual risk 15 in section 7; owner decision because it adds a failure code |
| A-10 | `02-database.md` 7.6.10 (`action_tokens_purpose_ck`), `05-api.md` | If owner accepts 06 H5: purpose `autopilot_off` (entity id `autopilot`, 7-day expiry) and `GET`/`POST /api/autopilot/off-link?t=` that call `returnAutopilotApprovals` with `why = 'off'` | A stolen session must not be able to turn on hands-off sending silently |
| A-11 | `02-database.md` 8.5 and `_db/applications.md` 6.1 | Replace the per-user `submission-health` statement with the one in 3.8 (joins `autopilot_settings` and honors `counter_reset_at`) | B.6.3: "the counter window restarts" after a resume; the current statement would re-pause a user at once on old failures |
| A-12 | `01-architecture.md` B.6.3 | State that a global freeze returns every unclaimed Autopilot approval to draft (the fan-out of 3.8 step 8), as `02-database.md` index notes already assume | Without it, Autopilot sends queued before the freeze would still go out during a systemic failure |
| A-13 | `06-infrastructure.md` 6.3 and 6.7 | Register the metrics of section 8 and alerts A-AUTO-2 to A-AUTO-5 | Observability for this worker |

Skill note: `dbos-typescript`, `saga-orchestration` and `error-handling-patterns` loaded and were applied as guidance (queue registration and determinism, pivot-and-compensation analysis, refusal-versus-error handling).
