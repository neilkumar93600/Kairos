# Worker 07: `cloud-applier` (cloud submit and form scan)

Tier: **critical**. Process: `applier` (`server/src/applier.ts`, image `server/Dockerfile.applier`). Workflows: `applyCloud` (queue `cloud-apply`) and `scanForm` (queue `scan-form`). Agents invoked: **none**. Revision 1, 2026-10-25.

Foundation documents this spec implements: `01-architecture.md` B.4.1, B.5, B.6.7, B.6.8, B.10.4, B.11.5, B.12.4, B.13 (S-AP1 to S-AP3); `02-database.md` sections 4.3, 7.3.2, 8.3 and `_db/applications.md` 3.2 and 5.7 (final text of the applier functions); `06-infrastructure.md` 1.6, 4.3, 6.4, 6.7, 7.5, 7.9 (H1, H2, H4), 9.3, 9.4; spike S-D1 (`_research/spike-s-d1-local.md`). Where those documents give a name, this spec uses it unchanged.

---

## 1. Purpose and place in the lifecycle

The cloud applier is the only component that submits an application to an employer without the user's browser. It runs only for applications that are already `approved` on the `cloud` channel (Pro and Max plans, by a human through `approveApplications` or `resendApplication`, or by Autopilot through `autopilotApprove`). It never approves, never charges, never writes the ledger and never calls a model.

`applyCloud` does five things, in order:

1. **Claims** the application through `claim_cloud_attempt` (`approved` to `submitting`, one open `submission_attempts` row).
2. **Prechecks** the claim: the plan still has `cloudApplier`, the ATS is not extension-only, the posting is still open (re-fetched from the ATS API through `safeFetchJson`).
3. **Runs the browser once** behind the `mark_browser_launched` replay guard: a fresh Chromium context through the egress guard, the attempt phases `navigating`, `filling` and `submit_seen`, the tailored PDF attached with `setInputFiles`, the unchanged `extension/dist/filler.js` injected and called once with `submit: true`, and challenge detection before and after the fill.
4. **Records** the result through `record_attempt_result` (`submitted`, or `failed` with one of the seven codes the applier may report).
5. **Enqueues** `settleAttempt` (`settle:<attemptId>`) on the worker. Settlement reads the attempt row, applies the B.6.8 decision table and, through `recordOutcome`, charges one credit only for `submitted`.

`scanForm` opens the public application form of a Lever or Ashby job, reads its questions without filling or submitting anything, and stores them through `store_form_questions`. `prepareApplication` starts it as a child workflow from its `ensureFormQuestions` step. Greenhouse questions come from its public API and never reach this worker.

```mermaid
sequenceDiagram
  autonumber
  participant API as api / worker (approve, resend, Autopilot)
  participant Q as DBOS queue cloud-apply (kairos_dbos)
  participant AP as applier: applyCloud
  participant PG as Postgres kairos (definer functions)
  participant R2 as R2 kairos-renders
  participant EG as egress guard (127.0.0.1)
  participant ATS as ATS host
  participant W as worker: settleAttempt

  API->>Q: enqueue apply:APP:N (partition = apply_host, priority 10/20/40)
  Q->>AP: dequeue (workerConcurrency 4)
  AP->>PG: step claim: claim_cloud_attempt(APP, N, executorId)
  AP->>PG: step precheck: get_applier_payload, ops_flag_on
  AP->>ATS: precheck posting re-fetch (safeFetchJson, API host)
  AP->>PG: step runBrowser: get_applier_payload, then mark_browser_launched
  AP->>R2: GetObject resume_pdf_key
  AP->>EG: Chromium context (proxy 127.0.0.1)
  EG->>ATS: navigate apply_url (allowlisted host)
  AP->>PG: mark_attempt_phase navigating / filling (+ heartbeat every 10 s)
  AP->>ATS: setInputFiles(PDF); inject filler.js; __kairosFill({submit:true})
  Note over AP,ATS: route handler sees the apply POST
  AP->>PG: mark_attempt_phase submit_seen (before route.continue)
  AP->>ATS: route.continue()
  AP->>PG: record_attempt_result(attempt, state, code, evidence)
  AP->>W: enqueue settle:ATTEMPT (queue settle)
```

---

## 2. Trigger, schedule and payload (a TypeScript type), plus the idempotency key

**Triggers.** No schedule. `applyCloud` is enqueued by `approveApplications` and `resendApplication` (request workflows on the api) and by `autopilotApprove` (worker), each after its `approveCore` transaction commits, once per cloud row of `ApproveResult.approved`. The worker's reconciler "cloud approval with no live apply workflow" (B.5.8, every 5 minutes) enqueues a recovery run (section 5). `scanForm` is started by `prepareApplication` (`ensureFormQuestions`) for a Lever or Ashby job whose `form_questions` row is missing, older than 14 days, of an older `parser_version`, or `unknown` for more than 6 hours.

```ts
// server/src/durable/workflows/apply-cloud.ts (specification-level code)
import { z } from "zod";

export const applyCloudInput = z.object({
  applicationId: z.uuid(),
  attemptNo: z.number().int().min(1).max(1000),          // applications.attempt_no set by approveCore
}).strict();
export type ApplyCloudInput = z.infer<typeof applyCloudInput>;

/** The seven codes record_attempt_result accepts from the applier (_db/applications.md 5.7). */
export type ApplierFailureCode =
  | "challenge" | "posting_closed" | "required_missing" | "applier_error"
  | "timeout" | "plan_lapsed" | "cloud_unavailable_for_ats";

/** Workflow output: ids and enums only (rule D4). */
export type ApplyCloudOutput =
  | { outcome: "no_op" }                                  // claim returned null: withdrawn, switched off, handled
  | { outcome: "paused" }                                 // ops_flags.pause_cloud_apply: nothing claimed
  | { outcome: "not_owner"; attemptId: string }           // another run owns the open attempt, or it is closed
  | { outcome: "replayed"; attemptId: string }            // browser already launched for this attempt: settle by phase
  | { outcome: "reported"; attemptId: string; state: "submitted" | "failed"; failureCode: ApplierFailureCode | null };

/** How every enqueuer calls the durable seam (server/src/durable/queues.ts). */
export interface ApplyCloudEnqueue {
  workflowId: `apply:${string}:${number}` | `apply:${string}:${number}:r${number}`;
  queue: "cloud-apply";
  partitionKey: string;            // companies.apply_host (ApproveResult.approved[].atsHost); required, the queue is partitioned
  priority: 10 | 20 | 40;          // Max 10, Pro 20 (human approval or resend); Autopilot 40
  delaySeconds?: number;           // Autopilot spread only (B.6.3)
  timeoutMs: 480_000;              // rule D7: the cloud apply finishes in under 8 minutes
}

// server/src/durable/workflows/scan-form.ts
export const scanFormInput = z.object({
  jobId: z.uuid(),
  parserVersion: z.number().int().min(1).max(32767),     // SCAN_PARSER_VERSION in server/src/applier/scan.ts, currently 1
}).strict();
export type ScanFormInput = z.infer<typeof scanFormInput>;

export type ScanUnknownReason =
  | "not_a_scan_target" | "closed" | "challenge" | "login_required" | "no_form"
  | "navigation_error" | "too_many_questions" | "invalid_shape" | "deadline";

export type ScanFormOutput =
  | { source: "browser_scan"; questionCount: number }
  | { source: "unknown"; reason: ScanUnknownReason };    // prepareApplication writes the 'unknown' row (worker role)
```

**Idempotency keys.**

| Key | Where | Effect |
|---|---|---|
| Workflow id `apply:<applicationId>:<attemptNo>` | DBOS, deterministic (B.5.4) | A second enqueue of the same approval returns the existing workflow (S-D1 check 3) |
| Recovery id `apply:<applicationId>:<attemptNo>:r<epochMinute>` | Reconciler only, when the original workflow is terminal and no attempt row exists (section 5; requested in section 13, A3) | A fresh workflow for the same approval; the database keys below keep it from sending twice |
| `submission_attempts_app_attempt_uq (application_id, attempt_no, channel)` | `claim_cloud_attempt` | A replayed or duplicate claim returns the same attempt id |
| `submission_attempts_one_open_uq (application_id) WHERE state = 'open'` | Database | Two senders can never hold open attempts for one application (INV-4) |
| `submission_attempts.browser_launched_at` | `mark_browser_launched`, a committed write outside the checkpoint | The browser is launched at most once per attempt; a replay never clicks again (rule D6) |
| Workflow id `scan:<jobId>:<parserVersion>` | `prepareApplication` | One scan per job and parser version, shared by every user's prepare; a retry after `unknown` uses `scan:<jobId>:<parserVersion>:r<floor(epochHours / 6)>` (A3) |
| `form_questions` primary key `(job_id)` | `store_form_questions` upsert | A repeated scan overwrites the same row |

---

## 3. Algorithm, step by step: for every step name the tables and columns read and written, the agents invoked and the external calls made

No step of either workflow invokes an agent. The applier holds no model key (`06-infrastructure.md` 4.4 forbidden list).

### 3.1 `applyCloud` body

```ts
// server/src/durable/workflows/apply-cloud.ts (continued). The seam (runStep, enqueue) wraps DBOS.runStep and
// DBOS.startWorkflow; this file never imports @dbos-inc/* (B.2 rule 3).
async function applyCloudFn(input: ApplyCloudInput): Promise<ApplyCloudOutput> {
  const c = await runStep(() => claim(input), { name: "claim", maxAttempts: 5, intervalSeconds: 1, backoffRate: 2 });
  if (c.paused) return { outcome: "paused" };
  if (!c.attemptId) return { outcome: "no_op" };
  const attemptId = c.attemptId;

  const p = await runStep(() => precheck(attemptId), { name: "precheck", maxAttempts: 3, intervalSeconds: 2, backoffRate: 2 });
  if (p.kind === "not_owner") return { outcome: "not_owner", attemptId };

  const r: BrowserResult = p.kind === "ok"
    ? await runStep(() => runBrowser(attemptId), { name: "runBrowser", retriesAllowed: false })
    : { kind: "result", state: "failed", failureCode: p.code, detail: p.detail, recorded: false };
  if (r.kind === "not_owner") return { outcome: "not_owner", attemptId };
  if (r.kind === "replayed") {
    await enqueue(settleAttempt, { workflowId: `settle:${attemptId}`, queue: "settle", delaySeconds: 100 }, { attemptId });
    return { outcome: "replayed", attemptId };
  }

  await runStep(() => recordResult(attemptId, r), { name: "recordResult", maxAttempts: 8, intervalSeconds: 2, backoffRate: 2 });
  await enqueue(settleAttempt, { workflowId: `settle:${attemptId}`, queue: "settle" }, { attemptId });
  return { outcome: "reported", attemptId, state: r.state, failureCode: r.failureCode };
}
export const applyCloud = registerWorkflow(applyCloudFn, { name: "applyCloud", maxRecoveryAttempts: 3 });

type BrowserResult =
  | { kind: "not_owner" } | { kind: "replayed" }
  | { kind: "result"; state: "submitted" | "failed"; failureCode: ApplierFailureCode | null; detail: DetailCode; recorded: boolean };
```

Every step output is an id, an enum, a boolean or a `DetailCode` (a closed string union of at most 40 characters, section 3.4), so no answer, resume line, letter, confirmation text or URL ever reaches `kairos_dbos` (B.5.6). The applier runs no datasource transaction (it has no access to schema `dbos`); its database writes are the definer functions, called inside plain steps, so they add no `transaction_completion` rows.

### 3.2 Steps of `applyCloud`

| # | Step | Reads | Writes | External calls | Output |
|---|---|---|---|---|---|
| 1 | `claim` | `ops_flag_on('pause_cloud_apply')` (10-second in-process cache); inside the function: `submission_attempts (application_id, attempt_no, channel)`, `applications (status, channel, attempt_no, approved_by, user_id)`, `jobs.company_id`, `companies.ats` | `SELECT claim_cloud_attempt($applicationId, $attemptNo, $executorId)`: inserts `submission_attempts (application_id, user_id, attempt_no, channel = 'cloud', ats, approved_by, worker_identity, heartbeat_at)` with `phase = 'claimed'`, `state = 'open'`; updates `applications.status = 'submitting'`, `current_attempt_id` (and `row_version` through `applications_row_version_bu`) | None | `{ paused: boolean; attemptId: string \| null }` |
| 2 | `precheck` | `get_applier_payload($attemptId, $executorId)`: `application_id, user_id, status, channel, attempt_no, current_attempt_id, apply_url, closed_at, external_id, ats, apply_host, plan, subscription_status, current_period_end, past_due_since, effective_plan` (the answer, line and letter columns are fetched but discarded in this step); `ops_flag_on('extension_only:<ats>')` | `SELECT mark_attempt_phase($attemptId, 'claimed')` (a heartbeat; phase unchanged) | Posting re-fetch through the catalog adapter's single-posting fetch (the one paste-URL import uses, B.8.6), built on `safeFetchJson` (H4): Greenhouse `GET https://boards-api.greenhouse.io/v1/boards/<token>/jobs/<external_id>`, Lever `GET https://api.lever.co/v0/postings/<site>/<external_id>` (or `api.eu.lever.co`), Ashby `GET https://api.ashbyhq.com/posting-api/job-board/<board>` and look up `external_id`; the board token comes from `parseJobUrl(apply_url)` (`server/src/services/job-url.ts`). 10-second timeout, 2 MB cap, no redirects | `{ kind: "ok" } \| { kind: "fail"; code; detail } \| { kind: "not_owner" }` |
| 3 | `runBrowser` (`retriesAllowed: false`) | `get_applier_payload` again (full payload, in memory only); R2 `GetObject` of `resume_pdf_key` from `kairos-renders` | `mark_browser_launched($attemptId)` (sets `browser_launched_at`, `heartbeat_at`); `mark_attempt_phase` to `navigating`, `filling`, `submit_seen` (the guard trigger sets `submit_seen_at`), heartbeats every 10 seconds; at the end `record_attempt_result` (in-step, up to 3 tries over 6 seconds); failure snapshot to `kairos-failures` (only phases `claimed` and `navigating`) | Chromium through the egress guard to the ATS apply host and the page's public subresources; R2 | `BrowserResult` |
| 4 | `recordResult` | none | When `recorded = false`: `record_attempt_result($attemptId, $state, $failureCode, $evidence)` with `evidence = { detail }` only (the in-memory evidence of step 3 is not in the checkpoint). When `recorded = true`: nothing | None | `{ recorded: true }` |
| body | enqueue `settleAttempt` | | `kairos_dbos` workflow rows for `settle:<attemptId>` on queue `settle` | | |

**Step 1, `claim`, in detail.** If `pause_cloud_apply` is on, the step returns `paused` without calling the function; the application stays `approved` with its credit in flight, and the reconciler re-enqueues it after the flag clears (it skips while the flag is on; A3). Otherwise the function either opens the attempt, returns the existing attempt for this `(application, attemptNo)` (replay or a racing duplicate), or returns null (`withdrawn`, Autopilot switched off and returned to `draft`, already handled). Lock taken: the `applications` row only (`02-database.md` 5.1, rule for `claim_cloud_attempt`); the in-flight trigger does not touch `credit_balances` because `approved` and `submitting` are both in the in-flight set.

**Step 2, `precheck`, in detail.** Checks run in this order; the first failure is the result.

| # | Check | Result on failure (`code`, `detail`) |
|---|---|---|
| 1 | `get_applier_payload` returns one row (the attempt is open, cloud, claimed by this executor and is the application's `current_attempt_id`) | `not_owner`: end without recording anything; the owner or the sweeper settles it |
| 2 | `PLANS[effective_plan].cloudApplier` is true (`shared/src/plans.ts`, INV-10 and INV-19) | `plan_lapsed`, `plan_lapsed` |
| 3 | `ops_flag_on('extension_only:' + ats)` is false | `cloud_unavailable_for_ats`, `extension_only` |
| 4 | `apply_url` parses as `https:`, has no credentials, its host is in `APPLIER_ALLOWED_HOSTS` and equals `apply_host` (re-validation of untrusted ATS data, `06-infrastructure.md` 7.4) | `applier_error`, `apply_url_rejected` |
| 5 | `closed_at IS NULL` | `posting_closed`, `closed_in_catalog` |
| 6 | The posting re-fetch does not return 404 or 410 and, for Ashby, the posting is in the board listing | `posting_closed`, `closed_by_posting_fetch` |

A re-fetch that times out, returns 5xx or 429, or fails the cap after the step's retries does **not** fail the attempt: the browser run still detects a closed page, so the step returns `ok` and the run carries `detail = "posting_check_unknown"` into its evidence. Retries of this step repeat only reads and the idempotent heartbeat.

**Step 3, `runBrowser`, in detail.** The step never throws: every error is caught and classified (section 3.4), because a thrown error with `retriesAllowed: false` would end the workflow in `ERROR` and leave settlement to the sweeper. Everything before `mark_browser_launched` is a read and may repeat.

1. `get_applier_payload($attemptId, $executorId)`. Zero rows: return `not_owner`.
2. *[Amended 2026-11-10, WP-19: the applier holds no R2 token. After the mark, when `applier_needs_render` says the snapshot has a document, it queues a `render` job with its attempt id and worker identity and waits up to 90 s; the worker renders (or reuses `resume_file_key`) and answers with a 60-second presigned GET only to the holder of the attempt. A failure does not end the run: it travels to the page as a coded reason (item 8). The text below is revision 2.]* When `resume_pdf_key` is set: R2 `GetObject` from `kairos-renders` with the applier's read-only token, at most 5 MB, 3 tries with 1 and 2 seconds of backoff. Failure: return `result` `failed` `applier_error`, detail `pdf_unavailable` (nothing launched; the run is resendable).
3. `SELECT mark_browser_launched($attemptId)`. `false`: the browser was already launched for this attempt by an earlier execution of this step on this executor (DBOS recovery at launch after a process crash). Return `replayed`. The workflow body enqueues `settle:<attemptId>` with a 100-second delay, beyond the 90-second stale-heartbeat threshold, so settlement finds a stale open attempt and settles it by its stored phase (`applier_error` before `filling`; `unconfirmed` with `needs_check` at `filling` while `ap2_verified` is off, or at `submit_seen`). The `leaseSweeper` would enqueue the same id; the id deduplicates.
4. Acquire a context slot from the browser pool (`server/src/applier/browser-pool.ts`): one Chromium per replica launched with the flags of `06-infrastructure.md` 7.5 layer 2 (proxy `127.0.0.1:<guard port>`, `--proxy-bypass-list=<-loopback>`, `--host-resolver-rules`, WebRTC policy, sandbox on unless S-AP4 fails), 5 slots per replica (4 for `cloud-apply`, 1 for `scan-form`). Create a fresh context: `bypassCSP: true` (only because the unchanged filler is injected), `serviceWorkers: "block"`, `permissions: []`, `acceptDownloads: false`, `ignoreHTTPSErrors: false`, default Playwright headless user agent. Popups are closed on creation; dialogs are dismissed.
5. Install one context-level `route` handler: images, fonts and media are aborted; a request that matches the ATS submit pattern of `server/src/applier/apply-endpoints.ts` (method `POST`, host and path per ATS, confirmed by spike S-AP2) runs `mark_attempt_phase($attemptId, 'submit_seen')` with a 3-second client timeout and only then `route.continue()`; if the marker write fails or times out, the handler calls `route.abort("failed")` and the run ends as `applier_error`, detail `marker_write_failed` (nothing reached the employer). Every other request continues. A `response` listener records the HTTP status of the matched submit request.
6. Start the heartbeat timer: `mark_attempt_phase($attemptId, <current phase>)` every 10 seconds until the context closes. A failed heartbeat is logged and counted (`applier.heartbeat_failed`); the marker write in item 5 is the safety gate, not the heartbeat.
7. Phase `navigating`: `mark_attempt_phase(..., 'navigating')`; `page.goto(apply_url, { waitUntil: "domcontentloaded", timeout: 45_000 })`. Main-frame navigations are counted (at most 20) and each target host must be in `APPLIER_ALLOWED_HOSTS`; a violation closes the page and ends the run as `applier_error`, detail `nav_host_not_allowed` (or as `timeout` if `submit_seen` was already marked). Then, in order: the document status is 404 or 410, or a closed-posting marker of the ATS matches: `posting_closed`, detail `closed_on_apply_page`; a visible challenge is present (section 3.5): `challenge`; an `input[type=password]` is visible: `applier_error`, detail `login_required` (Kairos never creates employer accounts or holds passwords, INV-6); `detectAdapter(new URL(page.url()))` from `extension/src/ats` returns null: `applier_error`, detail `unsupported_page`. Only these navigation-phase failures may save a viewport screenshot to `kairos-failures` (`attempts/<attemptId>.png`, at most 1 MB), because no personal field has been filled yet.
8. *[Amended 2026-11-10, WP-19: the attach runs in phase `navigating`, before the `filling` mark, so every failure of it still means nothing was sent. With a PDF: attach, or `applier_error` `attach_failed`. With a failed render and any resume input, required or optional: `render_failed` with the render's coded reason. No document and a required input: `applier_error` `resume_missing`. No resume input: the send goes on without a file. The file is named `{Name} - Resume.pdf`.]* Phase `filling`: `mark_attempt_phase(..., 'filling')`. When a PDF was read and the adapter's `resumeInputSelector` (imported from `extension/src/ats`, so it is the filler's own selector; the extension is not modified) matches: `page.setInputFiles(selector, { name: "resume.pdf", mimeType: "application/pdf", buffer })`. When the selector matches a required input and there is no PDF: `applier_error`, detail `resume_missing`.
9. Inject the filler: `page.addScriptTag({ content: FILLER_SOURCE })`, where `FILLER_SOURCE` is `extension/dist/filler.js` read once at boot from `FILLER_SCRIPT_PATH` (its SHA-256 is logged at boot and must equal the build artifact, section 11). Call it once: `page.evaluate((p) => window.__kairosFill(p), { applicationId, answers, resumeLines, coverLetter, submit: true })` under an outer 120-second `Promise.race`. `resumePdfUrl` is deliberately omitted: the filler then skips its own attach, and no storage URL reaches the page (`06-infrastructure.md` 4.3).
10. After the call returns, rejects or times out: wait up to 5 seconds for the submit response when `submit_seen` is marked and no status was recorded yet; run the visible-challenge check again; classify (section 3.4); build the evidence (section 3.6).
11. `record_attempt_result($attemptId, $state, $failureCode, $evidence::jsonb)`, up to 3 tries over 6 seconds. Return `result` with `recorded` set accordingly.
12. `finally`: stop the heartbeat, close the context, release the slot; the pool recycles the browser after `APPLIER_RECYCLE_AFTER` (25) contexts once its slots drain, and on a `disconnected` event.

A hard in-step deadline of 6 minutes from the start of `runBrowser` aborts the page if anything above hangs; the outcome is classified like a browser crash at the current phase. Together with at most about 40 seconds for `claim` and `precheck`, the attempt ends inside the 8-minute run cap that the `leaseSweeper` enforces on `started_at`.

### 3.3 `scanForm`

One step, `scanAndStore` (`maxAttempts: 2`, `intervalSeconds: 5`; a scan is read-only on the employer's site, so a retry is safe). Workflow `timeoutMs` 180,000, `maxRecoveryAttempts` 2.

| # | Action | Reads | Writes | External calls |
|---|---|---|---|---|
| 1 | `SELECT job_id, apply_url, external_id, ats, apply_host FROM scan_target_v WHERE job_id = $1` | `scan_target_v` (open Lever and Ashby jobs only) | | |
| 2 | No row: return `unknown` `not_a_scan_target`. Re-validate `apply_url` as in precheck check 4. Form URL: Lever `apply_url` with `/apply` appended when absent; Ashby with `/application` appended when absent | | | |
| 3 | Take the scan slot; fresh context with the same policies as 3.2 item 4; the route handler **aborts** every request that matches the ATS submit pattern (a scan can never submit) and blocks images, fonts and media | | | Chromium through the egress guard |
| 4 | `goto` (45 s); 404, 410 or closed marker: `unknown` `closed`; visible challenge: `unknown` `challenge`; password input: `unknown` `login_required`; form not present within 15 s: `unknown` `no_form` | | | ATS apply host |
| 5 | `page.evaluate(extractQuestions)` (10 s): the DOM extractor of `server/src/applier/scan.ts` reads labels, field names, input types, `required`, and options; it never focuses, types, clicks or changes any element | | | |
| 6 | Node side: map each element to `FormQuestion` (`_db/catalog-matching.md` 6.1) and validate with zod: `fieldKey` 1..200, `label` 1..500, `type` in the nine values, at most 100 `options`, `section` (`demographic` for the Lever EEO block and the Ashby EEOC survey, `compliance` for work-authorization blocks, else `standard`), `sensitive = classifySensitive(label) !== null` (`server/src/services/sensitive.ts`, a hint; prepare classifies again). More than 150 questions: `unknown` `too_many_questions`; schema failure: `unknown` `invalid_shape` | | | |
| 7 | `SELECT store_form_questions($jobId, $parserVersion, $questions::jsonb)` | `scan_target_v` (inside the function) | `form_questions (job_id, source = 'browser_scan', parser_version, questions, scanned_at)`; `questions_hash` and `question_count` by `form_questions_derive` | |
| 8 | Close the context in `finally` | | | |

Output `{ source: "browser_scan", questionCount }` or `{ source: "unknown", reason }`. On `unknown`, `prepareApplication` (worker role) writes the `unknown` row and continues with `questions_unknown`; on `closed` it may set `jobs.closed_at` with `closed_by = 'apply_page'`. Both are the worker's writes; the applier has no table privilege. A scan touches no user data at all.

### 3.4 Result classification (`server/src/applier/attempt.ts`, `classifyRun`)

Inputs: the filler's `SubmissionReport` (or the error that replaced it), `submitSeen` (the marker was written), `applyStatus` (status of the submit response, if any), `challengeAfter` (visible challenge after the call), the phase reached, and `ap2Verified = ops_flag_on('ap2_verified')`. `ap2_verified` is set by the owner only after spike S-AP2 proves the interception on all three ATS; until then a click that the route handler did not see is still treated as possibly sent. Rules are evaluated top to bottom; the first match wins.

| # | Condition | `state` | `failure_code` | `detail` |
|---|---|---|---|---|
| 1 | Marker write failed (submit request aborted) | `failed` | `applier_error` | `marker_write_failed` |
| 2 | `report.outcome = 'submitted'` (the filler saw the ATS confirmation) | `submitted` | null | `confirmed` (plus `submit_seen_missed` counted when `submitSeen` is false) |
| 3 | `submitSeen` and `applyStatus` in 404, 410 | `failed` | `posting_closed` | `closed_on_submit` |
| 4 | `submitSeen` and `applyStatus` in 400, 422 | `failed` | `required_missing` | `rejected_on_submit:<status>` |
| 5 | `submitSeen` (any other status, no status, no confirmation, a challenge after the click, a crash or the deadline) | `failed` | `timeout` | `submit_seen_no_confirmation`, `challenge_after_submit`, `crash_after_submit` or `deadline_after_submit` |
| 6 | Visible challenge, `submitSeen` false | `failed` | `challenge` | `challenge` |
| 7 | Filler reason starts with `Required fields left empty` | `failed` | `required_missing` | `required_empty:<n>` |
| 8 | Filler reason starts with `Unsupported application page` or `Submit button not found` (both before the click) | `failed` | `applier_error` | `unsupported_page` or `no_submit_button` |
| 9 | Filler reason starts with `No confirmation` (after the click), or the call crashed, rejected or timed out in phase `filling`, and `ap2Verified` is false | `failed` | `timeout` | `filling_unverified` |
| 10 | Same as 9 with `ap2Verified` true (no submit request left the page) | `failed` | `required_missing` when the reason lists unfilled fields, else `applier_error` | `no_submit_request` |
| 11 | Any failure in phase `claimed` or `navigating` (navigation timeout, browser crash, host violation, PDF read) | `failed` | `applier_error` | the navigation detail |

The applier never reports `unconfirmed`, `no_report` or `extension_reported`; `record_attempt_result` refuses them. An ambiguous outcome is reported as `timeout`, and `settleAttempt` closes it as `needs_check` (`_db/applications.md` 3.2 note). The four filler reason prefixes are pinned by a unit test that reads `extension/src/filler.ts`, so a future filler build that renames a message fails CI instead of silently changing classification.

### 3.5 Challenge detection (`server/src/applier/challenge.ts`)

Many Greenhouse forms load invisible reCAPTCHA on every page, so presence of a script is not a challenge. A challenge is any of: a **visible** (non-zero bounding box, not `visibility: hidden`) iframe whose `src` host is `www.google.com/recaptcha` or `www.recaptcha.net` with the challenge frame (`bframe`) or the checkbox anchor marked required; a visible `hcaptcha.com` challenge iframe; a visible Cloudflare Turnstile or interstitial (`challenges.cloudflare.com`, `cf-chl` markers, "Checking your browser" or "Just a moment" titles); a top-level 403 or 429 document response. The detector never clicks, types into or otherwise interacts with a challenge, and no solver, stealth plugin, fingerprint change or proxy rotation exists in the image (INV-8). `evidence.challenge` takes `recaptcha`, `hcaptcha`, `interstitial` or `other`.

### 3.6 Evidence (`AttemptEvidence`, `_db/applications.md` 3.2)

```ts
// server/src/modules/submission/evidence.ts, shared by the applier and settleAttempt
export interface AttemptEvidence {
  confirmationText?: string;   // report.confirmationText with the applicant's first name, last name, email and phone
                               // (from the in-memory answers) replaced by [name], [email], [phone]; at most 2,048 characters
  filledFieldKeys?: string[];  // report.filledFields[].fieldKey plus "resume" when setInputFiles attached the PDF; at most 60
  applyResponseStatus?: number;
  challenge?: "recaptcha" | "hcaptcha" | "interstitial" | "other";
  detail?: DetailCode;         // the classification detail of 3.4, plus "posting_check_unknown" when precheck could not re-fetch
}
```

Values, labels and the filler's free-text `failureReason` are never stored (the `submission_attempts_evidence_ck` check rejects the keys `filledFields`, `values`, `answers` and `receipt`). The serializer drops `filledFieldKeys` entries from the end, then truncates `confirmationText`, until the JSON is at most 3,800 bytes, below the 4,096-byte check. `settleAttempt` builds the receipt from `filledFieldKeys` and the stored `applications.answers`.

---

## 4. Concurrency, rate limits, ordering, batching and priorities, with numbers at 10,000 users

**Queue registration** (`server/src/durable/queues.ts`, after `DBOS.launch()`, `await DBOS.registerQueue(name, options)` with the default `onConflict: update_if_latest_version`):

| Queue | Options (DBOS 5.3.0 names) | Partition key | Listened by |
|---|---|---|---|
| `cloud-apply` | `partitionConcurrency: 8` (12 requested, A4), `workerConcurrency: 4`, `rateLimit: { limitPerPeriod: 240, periodSec: 60 }`, `priorityEnabled: true` | `companies.apply_host`, passed on every enqueue | applier (`listenQueues: ["cloud-apply", "scan-form"]`) |
| `scan-form` | `globalConcurrency: 4`, `workerConcurrency: 1` | none | applier |

**Numbers (growth; base in brackets).** 8,580 cloud runs a day (7,400), about 15% of them challenged [est, cost model]; 2,000 scans a day (900). Mean run 45 seconds including failures, p95 about 120 seconds [est; S-AP1 measures]. 40% of runs fall in a 2-hour window: 3,432 runs in 7,200 seconds is 0.48 starts a second, 21.5 contexts at 45 seconds (16.4). Slots: 8 replicas x 4 = 32 (6 x 4 = 24), 1.5x headroom. Starts per minute at peak: 29, against the global rate limit of 240.

**Per-host partitions.** One partition key per queue is possible, so `cloud-apply` is partitioned by apply host for politeness and fairness between ATS, not by user. With `job-boards.greenhouse.io` carrying about 40% of cloud runs [est], its peak demand is 0.19 starts a second x 45 seconds = 8.6 concurrent runs, slightly above `partitionConcurrency: 8`; the backlog would grow by about 90 runs over the peak window and approach the 10-minute start SLO (S4). Section 13 (A4) asks for 12. At base the same host needs 6.6, which 8 covers.

**Priorities.** Lower is served first: human approvals and resends of Max users 10, of Pro users 20, Autopilot 40 with `delaySeconds` spread (at most `ceil(dailySendCap / 8)` sends per user per hour, up to 10 minutes of jitter, B.6.3). Within one priority the queue is FIFO. No ordering exists or is needed between applications; within one application, attempts are strictly sequential because each needs a new approval (`attempt_no + 1`) and only one attempt can be open.

**Per-replica concurrency.** `APPLIER_CONCURRENCY = 4` equals `workerConcurrency` of `cloud-apply`; the browser pool has 5 slots (4 apply, 1 scan). Memory at full occupancy: about 0.4 GB for the idle browser plus 5 x about 0.4 GB per context [est] = 2.4 GB of the 4 GB limit; the per-context watchdog kills a context above 900 MB and the replica restarts above 3.6 GB. CPU: about 0.6 vCPU per active context, so 4 busy contexts slightly exceed 2 vCPU; at the peak average occupancy of 67% (2.7 contexts per replica) it is about 1.6 vCPU.

**Connections.** Application pool through PgBouncer, 2 per replica (16 client connections at growth, server pool `kairos_applier`); DBOS system pool 2 plus 1 listener per replica, direct to `kairos_dbos` (24 at growth). Each run issues about 11 small updates to `submission_attempts` and `applications` (claim 2, launch 1, phases 3, about 4 heartbeats, result 1): about 94,000 HOT updates a day, plus 2,000 `form_questions` upserts.

**Batching.** None. One workflow per application attempt and per job scan; a browser run is never shared between users.

**Fairness between users.** Approvals are capped per request (1..50) and Autopilot per day by plan (`autopilotDailySendCap`: Pro 45, Max 110) and per hour by the spread rule; a single user's batch of 50 human approvals occupies at most 8 slots per host and drains in about 5 minutes.

---

## 5. Retries, backoff, timeouts, dead-letter handling, poison messages and compensation

**Step retries.**

| Step | Retries | Backoff | What repeats | When exhausted |
|---|---|---|---|---|
| `claim` | 5 attempts | 1, 2, 4, 8 s | The idempotent function call | Workflow `ERROR`; if the claim committed, the attempt stays open and the `leaseSweeper` settles it `applier_error` after 90 seconds; if not, the application stays `approved` and the reconciler starts a recovery run |
| `precheck` | 3 attempts | 2, 4 s | Reads, the heartbeat and the posting re-fetch (10-second timeout each) | Database failures: workflow `ERROR`, settled by the sweeper; re-fetch failures alone: `ok` with `posting_check_unknown` |
| `runBrowser` | **none** (`retriesAllowed: false`, rule D6) | | Nothing; a replay hits `mark_browser_launched = false` | n/a |
| `recordResult` | 8 attempts | 2 s doubling, about 4 minutes in total | The function call (a no-op once the attempt is closed) | Workflow `ERROR`; the attempt is open at its last phase and the sweeper settles it by phase |
| `scanAndStore` | 2 attempts | 5 s | The whole read-only scan | `unknown` `navigation_error` |

**Timeouts.** Workflow `timeoutMs` 480,000 for `applyCloud` and 180,000 for `scanForm`, set by the enqueuer (DBOS starts the clock when the workflow is dequeued [verify in the Railway half of S-D1]). Inside `runBrowser`: navigation 45 s, filler call 120 s (the filler itself waits 20 s for the confirmation), submit-response wait 5 s, marker write 3 s, in-step hard deadline 6 minutes. Inside `scanAndStore`: navigation 45 s, form wait 15 s, extractor 10 s, in-step deadline 90 s. Database: `kairos_applier` `statement_timeout = 5s`, `idle_in_transaction_session_timeout = 30s`.

**Recovery after a crash.**

| Where the process died | What happens |
|---|---|
| Same replica restarts (same `executorID`) | DBOS recovers the workflow at launch from its last completed step. A replay of `claim` returns the same attempt; a replay of `runBrowser` sees `mark_browser_launched = false`, returns `replayed`, and settlement by phase follows 100 seconds later |
| Executor gone (deploy, replica removed) | The worker's `dbos-orphan-recovery` **cancels** `cloud-apply` and `scan-form` workflows and never resumes them on itself, because a resumed workflow could run in a process without Chromium (there is no public call that recovers another executor's workflow in DBOS 5.3.0, S-D1). The business rows then decide: an open attempt is settled by the `leaseSweeper` by its phase (90-second stale heartbeat or 8-minute run cap); an `approved` application with no attempt gets a recovery run `apply:<id>:<attemptNo>:r<epochMinute>` from the reconciler (A3); a cancelled scan is retried by the next `prepareApplication` with a new bucket id |
| Crash between claim and browser launch | The attempt is open with `browser_launched_at IS NULL`; the sweeper settles it `applier_error` (resendable, no acknowledgement, no charge) |

`ponytail:` a crash in the second or two between claim and launch costs the user one resend, because the open attempt is bound to the dead executor's `worker_identity` and the payload function refuses any other reader. A `reclaim_cloud_attempt` function could hand such an attempt to a new run; add it only if `applier_error` with detail `stale_before_launch` exceeds 0.2% of runs over 14 days.

**Dead letters and poison messages.** DBOS has no dead-letter queue; the equivalent is a workflow in `ERROR`, `CANCELLED` or past `maxRecoveryAttempts` (3 for `applyCloud`, 2 for `scanForm`). None of them can strand money or a send: the business row always reaches a terminal state through the `leaseSweeper` and the reconcilers (B.5.8), and A-DUR-2 pages on any `cloud-apply` workflow pending above 30 minutes. A poison application (a page that crashes Chromium every time) launches the browser at most once per attempt because of the replay guard; it fails `applier_error` and the user can resend through the extension. A poison job page for `scanForm` ends `unknown` after two attempts and is retried at most once every 6 hours.

**Compensation.** The submit is irreversible and has no compensating action; correctness comes from never doing it twice. Every other effect is compensated by settlement: a `failed` attempt releases the in-flight credit through `applications_in_flight_aiud` when `recordOutcome` moves the application to `failed`, and no ledger row is written. A precheck failure never launches a browser. `pause_cloud_apply` leaves the application `approved` with its credit reserved until the flag clears; an operator who wants to release credits instead withdraws or resends through the extension.

---

## 6. State transitions it performs and the invariants it must uphold (and how)

**Transitions performed (all through definer functions; the applier has no table privilege).**

| Object | From | To | Function | Guard |
|---|---|---|---|---|
| `applications.status` | `approved` | `submitting` | `claim_cloud_attempt` | `status = 'approved' AND channel = 'cloud' AND attempt_no = $attemptNo`, row locked `FOR UPDATE`; sets `current_attempt_id` in the same statement (`applications_submitting_ck`); `applications_guard_status_bu` allows the pair |
| `submission_attempts` | (none) | `open`, phase `claimed` | `claim_cloud_attempt` | `submission_attempts_app_attempt_uq`, `submission_attempts_one_open_uq` |
| `submission_attempts.browser_launched_at` | null | now | `mark_browser_launched` | `state = 'open' AND channel = 'cloud' AND browser_launched_at IS NULL` |
| `submission_attempts.phase` | `claimed` | `navigating`, `filling`, `submit_seen` | `mark_attempt_phase` | Forward only (function and `submission_attempts_guard_bu`); `submit_seen_at` set by the guard |
| `submission_attempts.state` | `open` | `submitted` or `failed`, phase `reported` | `record_attempt_result` | `state = 'open'`; code in the applier's seven; evidence check |
| `form_questions` | any | upserted, `source = 'browser_scan'` | `store_form_questions` | Job must be in `scan_target_v`; shape check |

Every other transition of the application (`submitting` to `submitted` or `failed`, `needs_check`, the charge, events, notifications, `jobs.closed_at`, match `expired`) belongs to `settleAttempt` and `recordOutcome` on the worker.

**Invariants and how this worker upholds them.**

| Invariant | How |
|---|---|
| Approval before send; Autopilot only within its guards (INV-3) | `claim_cloud_attempt` succeeds only on `approved`; Autopilot's off switch returns unclaimed rows to `draft`, so the claim returns null |
| One application per (user, job); two sends submit once (INV-4) | Deterministic workflow ids; one attempt per `(application, attempt_no, channel)`; one open attempt per application; `mark_browser_launched` before any browser; settlement never retries the submit; ambiguity becomes `needs_check` with acknowledged resend |
| Credits charged only on `submitted`, never on `failed`, once per application (INV-5) | The applier writes no ledger and holds no billing privilege; `recordOutcome` charges from the attempt row |
| No LinkedIn, no employer passwords, no mailbox (INV-6) | Five-host navigation allowlist (`APPLIER_ALLOWED_HOSTS`, `companies_hosts_ck`, `jobs_apply_url_host_ck`); a visible password field stops the run (`login_required`); no credential column exists |
| No CAPTCHA solving, evasion or proxy rotation; a challenged run fails without charge (INV-8) | Detection only (3.5); `challenge` is a `failed` code; the egress guard keeps the replica's own egress IP and rotates nothing; default user agent |
| Sensitive questions never answered by a model (INV-9) | The applier fills only `applications.answers` produced and verified upstream; it calls no model and invents no value (the filler skips empty answers) |
| Cloud applier only on Pro and Max; limits only from `plans.ts` (INV-10, INV-19) | `approveCore` checks the plan; precheck re-checks `PLANS[effective_plan].cloudApplier` at claim time (`plan_lapsed`) |
| Untrusted input never changes instructions (INV-14) | No model in the loop; `apply_url` re-validated; the page cannot reach the network except through the guard; the filler is injected unchanged and receives only stored answers |
| Minimum data and ids-only checkpoints (INV-15, B.5.6) | Step outputs are enums; the payload stays in memory; evidence carries keys, statuses and a redacted confirmation, never values |
| Filler unchanged; extension frozen (INV-16, INV-17) | `extension/dist/filler.js` injected byte for byte; `extension/src/ats` imported read-only for selectors; diff check on `extension/` |
| Closed postings never charge (INV-23) | Precheck, apply-page and submit-response closed detection all produce `posting_closed`, a `failed` code |

---

## 7. Failure modes table: cause, detection, user-visible effect, recovery

| # | Cause | Detection | User-visible effect | Recovery |
|---|---|---|---|---|
| F1 | Application withdrawn or Autopilot switched off before the claim | `claim_cloud_attempt` returns null | None (already withdrawn or back in review) | Workflow ends `no_op` |
| F2 | Plan downgraded after approval | Precheck check 2 | Failed, "Cloud sending is on Pro and Max"; signed resend link to the extension | Settlement `failed`, no charge |
| F3 | ATS switched to extension-only (challenge rate above 30%) | Precheck check 3 | Failed with a resend link to the extension | No charge; resend allowed |
| F4 | Posting closed | Catalog, posting re-fetch, apply page or submit response | "This posting has closed"; match expired | `posting_closed`, no resend |
| F5 | Bot challenge (reCAPTCHA, hCaptcha, interstitial, 403, 429) | 3.5, before or after the fill | Failed, "the employer's site asked for a human check; send it from the extension" | `challenge`, no charge; A-SUB-4 at 30% sets `extension_only:<ats>` |
| F6 | Required fields the stored answers do not cover | Filler `Required fields left empty`, or 400 or 422 on submit | Failed, "answer the missing questions, then resend" | `required_missing`, resend after edits |
| F7 | Process crash or OOM before the browser launch | Stale heartbeat | Failed, resend link | `leaseSweeper` settles `applier_error` |
| F8 | Crash after launch, before `filling` | Replay guard or stale heartbeat | Failed, resend link | `applier_error` |
| F9 | Crash in `filling` (until `ap2_verified`) or after `submit_seen` | Replay guard or stale heartbeat | "We could not confirm this was sent. Check your inbox before you resend." | `unconfirmed`, `needs_check`; resend only with acknowledgement; a later confirmation is a late confirmation |
| F10 | Submit seen, no confirmation (slow or changed confirmation page) | Rule 5 of 3.4 | As F9 | `timeout`, `needs_check` |
| F11 | Marker write fails (database or PgBouncer blip) at the submit moment | Route handler | Failed, resend link | Request aborted before it left the page: nothing sent; `applier_error` |
| F12 | Database unreachable for the applier for more than 90 seconds mid-run | Heartbeat failures; sweeper closes the attempt by phase; a later `record_attempt_result` is a no-op | Possibly `needs_check` although the employer confirmed | `applier.result_after_close` metric and email; operator reconciles from the forwarded confirmation email (R-SUB-1) |
| F13 | Top-level navigation to a non-allowlisted host | Main-frame listener | Failed, resend link | `applier_error` (`nav_host_not_allowed`), or `timeout` if after the submit |
| F14 | Page tries a private address or internal name | Egress guard refusal | None directly | A-SUB-6 security email; R-SEC-3 recycles the replica |
| F15 | Login wall or account creation required | Visible password input | Failed: "this employer requires an account; apply on their site" | `applier_error` (`login_required`); never automated |
| F16 | PDF missing or R2 unavailable | `GetObject` failure, required resume input without PDF | Failed, resend link | `applier_error` (`pdf_unavailable`, `resume_missing`); renders reconcile on the worker |
| F17 | Chromium crash or memory leak | `disconnected`, watchdog, A-NODE-2 | That run fails by phase | Browser relaunched; R-APPLIER-1 |
| F18 | Queue backlog at peak | A-DUR-6 (`cloud-apply` waiting above 30 for 10 minutes), S4 burn | Sends start later than 10 minutes | Add a replica (R-SCALE-1); A4 partition limit |
| F19 | Deploy during runs | `SIGTERM` | None for runs that finish within 170 seconds | Stop dequeuing, finish in-flight runs, exit; leftovers settled by phase; production deploys wait for no attempt in `submit_seen` |
| F20 | ATS changes its form or submit endpoint | `submit_seen_missed` on confirmed runs; failure-rate alert A-SUB-3 | More `unconfirmed` or `applier_error` failures | Clear `ap2_verified`, update `apply-endpoints.ts` after a fake-ATS fixture, `pause_cloud_apply` or `extension_only:<ats>` meanwhile |
| F21 | Scan fails (closed, challenge, unusual form) | `unknown` result | Draft questions marked unknown; the user sees them during review in the extension | Prepare continues with `questions_unknown`; rescan after 6 hours |

---

## 8. Observability: logs, metrics, traces and alerts with thresholds

**Logs** (pino JSON, `service = "applier"`, fields `replica`, `version`, `workflowId`, `queue`, `applicationId`, `attemptId`, `ats`, `userHash`; never URLs with paths, answers, labels or page text):

| Event (`msg`) | Level | Fields |
|---|---|---|
| `apply claimed` | info | `attemptNo`, `approvedBy`, `priority` |
| `apply precheck failed` | info | `code`, `detail` |
| `apply replay guard` | warn | `phaseAtReplay` |
| `apply result` | info | `state`, `failureCode`, `detail`, `phaseReached`, `submitSeen`, `applyStatus`, `durationMs` |
| `apply result after close` | error | `state` (F12) |
| `egress blocked` | error for `private_address` and `internal_name`, warn otherwise | `reason`, `host` |
| `browser recycled`, `browser crashed` | info, error | `contexts`, `rssMb` |
| `scan stored`, `scan unknown` | info | `jobId`, `questionCount` or `reason` |

**Metrics.** The `06-infrastructure.md` 6.4 series this worker feeds: `applier.contexts_in_use{replica}`, `applier.browser_restarts`, `applier.context_rss_mb_p95`, `applier.egress_blocked{reason}`, `applier.challenge_rate{ats}` (derived by the worker from `submission_attempts`), `durable.queue.*{queue=cloud-apply|scan-form}`, `submissions.*`. New series:

| Metric | Type | Source | Use |
|---|---|---|---|
| `applier.runs{ats,state,code}` | counter | applier | Volume and failure mix |
| `applier.run_duration_ms_bucket{ats,le}` (5,000, 15,000, 30,000, 60,000, 120,000, 240,000, 360,000) | counter | applier | S-AP1, cost model input (45 s) |
| `applier.phase_reached{phase}` | counter | applier | Where runs stop |
| `applier.submit_seen_missed{ats}` | counter | applier | Confirmed runs without the marker: an S-AP2 regression |
| `applier.replays` | counter | applier | `mark_browser_launched = false` |
| `applier.marker_write_failed`, `applier.heartbeat_failed` | counter | applier | Database path health |
| `applier.result_after_close` | counter | applier | F12 |
| `applier.precheck{result}` | counter | applier | Plan lapses, closed postings, extension-only |
| `applier.scans{ats,result}` | counter | applier | Scan health |

The applier role cannot write `metrics_minute`; its process series need the definer function of A2. Until A2 lands they go to Sentry metrics and the log stream, and the worker derives every attempt-level series (runs, phases, failure and challenge rates, durations from `started_at` and `finished_at`) from `submission_attempts`.

**Traces.** DBOS workflow and step spans with the workflow id and queue; the applier adds `kairos.attempt.id`, `kairos.ats`, `kairos.phase`, `kairos.result`, `kairos.failure_code` on `runBrowser`. Sampling follows `06-infrastructure.md` 6.3: 20% for `applyCloud` and `settleAttempt` (evidence lives in the attempt row, not in traces), errors 100%. Sentry `beforeSend` strips request bodies, page text and URLs to their host.

**Alerts.**

| Id | Condition | Window | Action |
|---|---|---|---|
| A-DUR-2 | A `cloud-apply` workflow pending above 30 minutes | 1 min | Page, R-DBOS-2 (never fork `applyCloud`) |
| A-DUR-6 | `cloud-apply` waiting above 30 | 10 min | Email, R-SCALE-1 |
| A-SUB-1 | Open attempt unsettled 10 minutes after the sweeper should have settled it | 1 min | Page, R-SUB-1 |
| A-SUB-2 | More than one `submitted` or `needs_check` attempt for one application | 1 min | Page, sets `approvals_frozen`; set `pause_cloud_apply` by hand (R-SUB-2) |
| A-SUB-3 | Per ATS at least 10 attempts and above 20% failed in an hour | 1 h | Email, R-SUB-3 |
| A-SUB-4 | `applier.challenge_rate{ats}` above 30% with at least 20 attempts in 24 h | 15 min | Email; `extension_only:<ats>` set |
| A-SUB-6 | `applier.egress_blocked{reason=private_address}` above 0 | 0 | Security email, R-SEC-3 |
| A-NODE-2 | RSS per context above 900 MB, or browser restarts above 10 an hour | 15 min | Email, R-APPLIER-1 |
| A-AUTO-1 | Global Autopilot spike (20 attempts in an hour, above 25% failed) | 0 | Page, sets `autopilot_frozen` |
| A-SUB-7 (new, A5) | `applier.submit_seen_missed` above 0 while `ap2_verified` is on | 0 | Email; the runbook clears `ap2_verified` until `apply-endpoints.ts` is fixed |
| A-SUB-8 (new, A5) | `applier.result_after_close` above 0, or `applier.marker_write_failed` above 5 in an hour | 0 / 1 h | Email, R-SUB-1 |
| SLO S4 | Human-approved cloud attempts started within 10 minutes of approval below 95% | burn rate | A-SLO-1 |

---

## 9. Capacity and cost at 10,000 users: runs per day, CPU and memory, model cost per day

| Quantity | Base | Growth | Source |
|---|---|---|---|
| `applyCloud` runs a day | about 7,400 | 8,580 | B.5.7, `06-infrastructure.md` 9.1 |
| Of which challenged and failed without charge | about 1,100 | about 1,300 | cost model 15% [est] |
| `scanForm` runs a day | 900 | 2,000 | cost model |
| Mean run, mean scan | 45 s, 20 s | 45 s, 20 s | cost model [est]; S-AP1 |
| Peak concurrent contexts | 16.4 | 21.5 | 40% of runs in 2 hours |
| Slots | 6 x 4 = 24 | 8 x 4 = 32 | B.4.1 |
| Browser-hours a day | about 97 | 118 | runs plus scans |
| vCPU-hours a day (0.6 vCPU per active context) | about 58 | 71 | cost model unit |
| Memory per replica at full occupancy | about 2.4 GB of 4 GB | same | 3.2, 4 |
| Checkpoint writes per `applyCloud` run | 12 (7 fixed for a queued workflow, 4 steps, 1 child enqueue; no datasource transaction) | 12 | S-D1 |
| Checkpoint writes a day | about 89,000 + 7,200 | about 103,000 + 16,000 | 12 per run, 8 per scan |
| Business row writes a day | about 81,000 + 900 | about 94,000 + 2,000 | 4 |
| Infrastructure cost a month | $82 | $111 (runs $72, scans $7, idle $32) | B.12.2 |
| Cost per cloud run | $0.00037 | $0.00043 | infrastructure / runs |
| Cost per Pro or Max submitted application (0.78 runs each) | $0.0003 | $0.00034 | B.12.3 |
| **Model cost a day** | **$0** | **$0** | No agent; no model key |

Checkpoint budget: 12 writes per run is 103,000 a day at growth, about 14,000 above the 89,000 row of `06-infrastructure.md` 9.3, which adds about 0.7 to the unit metric `durable.checkpoint_writes_per_submitted` (about 55 to about 56, target 60, alert 80). Coarser steps were considered and rejected: `claim` and `recordResult` must stay retryable steps separate from the non-retryable browser step.

Growth beyond 10,000 users scales replicas linearly (about 30 to 40 at 50,000 users, B.12.6); nothing in the design changes.

---

## 10. Security and privacy notes

- **Hostile content.** Every employer page and its third-party scripts are treated as hostile (`06-infrastructure.md` threat T12). Layers: Chromium sandbox (on unless S-AP4 fails, then documented risk acceptance), non-root `pwuser`, the in-process egress guard (`server/src/applier/egress-guard.ts`: ports 80 and 443 only, internal names refused, one resolution and connection to the validated public address, top-level navigation only to `APPLIER_ALLOWED_HOSTS`), a fresh context per attempt closed in `finally`, browser recycling every 25 contexts, and a role that can reach almost nothing.
- **Blast radius of a compromise.** Role `kairos_applier`: `SELECT` on `scan_target_v` and `ops_flags`, `EXECUTE` on seven functions (`claim_cloud_attempt`, `get_applier_payload`, `mark_browser_launched`, `mark_attempt_phase`, `record_attempt_result`, `store_form_questions`, `heartbeat_executor`) and `ops_flag_on`. With H1, a compromised process can read only the payload of an attempt it has claimed. R2: read `kairos-renders` (H2 asks for read without list), write `kairos-failures`. `dbos_applier` reaches only ids-only checkpoints. No Anthropic, Stripe, Postmark, `DATA_KEKS`, `LINK_SIGNING_KEY` or `USER_HASH_KEY` in the environment (enforced by `envFor("applier")` and `env.roles.test.ts`). `userHash` log fields are therefore computed by the worker; the applier logs `applicationId` only.
- **Personal data in flight.** The payload (answers, resume lines, cover letter, including profile-sourced sensitive answers) is read inside `runBrowser`, held only in process memory and in the page for the duration of the run, and is never logged, traced, checkpointed or written to evidence. The PDF buffer is never written to disk.
- **Evidence.** Field keys, HTTP statuses, challenge kind, a detail code and the employer's confirmation text with the applicant's name, email and phone redacted; nulled 90 days after settlement by `retention`.
- **Failure snapshots.** Only for runs that end in `claimed` or `navigating` (no field filled), to `kairos-failures`, deleted after 14 days. Runs that fail later store the detail code and, at most, a DOM path of the failing element in `detail`.
- **Untrusted ATS data.** `apply_url` comes from ATS responses; it is validated when stored (`jobs_apply_url_host_ck`) and again in precheck. The applier fetches nothing a user typed (paste-URL intake never fetches the user's URL, B.8.6).
- **No evasion.** The image contains no stealth plugin, CAPTCHA solver or fingerprint tooling; the egress IP is the replica's own (a static outbound IP, if Railway offers it, is identity, not evasion). Challenged runs fail without charge (INV-8).
- **DPDP and GDPR.** The applier stores no personal data of its own. On erasure, `submission_attempts` rows cascade with the account; `kairos-failures` objects contain no filled personal field and expire in 14 days; `kairos_dbos` holds only ids and is pruned after 14 days (`deleteWorkflows`).

---

## 11. Tests (unit, integration, failure injection) and acceptance criteria

**Unit (`vitest`, no network).**

| Test | Asserts |
|---|---|
| `classify-run.test.ts` | Every row of 3.4 with `ap2Verified` on and off; rule order; no output code outside the seven |
| `filler-reasons.test.ts` | The four reason prefixes still exist in `extension/src/filler.ts` |
| `evidence.test.ts` | Redaction of name, email and phone; no forbidden key; serialized size at most 3,800 bytes with 300 field keys and a 4,000-character confirmation |
| `egress-guard.test.ts` | Refuses loopback, RFC 1918, 169.254.169.254, 100.64/10, `fc00::/7`, IPv4-mapped IPv6, decimal and octal IPv4 forms, `.internal`, `.railway.internal`, `.local`, port 22; allows a public subresource; top-level navigation only to the allowlist |
| `apply-endpoints.test.ts` | Submit patterns match recorded submit requests of the three ATS fixtures and match no upload, analytics or GraphQL query request |
| `challenge.test.ts` | Invisible reCAPTCHA on a Greenhouse fixture is not a challenge; visible bframe, hCaptcha, Turnstile and 403 are |
| `scan-extract.test.ts` | Lever and Ashby fixture forms produce valid `FormQuestion[]`; EEO blocks map to `demographic`; 151 questions give `too_many_questions` |
| `payload-schema.test.ts` | Workflow inputs and every step output pass the ids-only rule of B.5.6 |

**Integration (Testcontainers Postgres 18 with DBOS launched, MinIO for R2, `ops/fake-ats` for the three ATS, the applier process running as `kairos_applier`).**

1. Happy path for each ATS: approve, run, `submitted`, `settle:<attemptId>` enqueued, one ledger row after settlement.
2. Withdraw before dequeue: `no_op`, no attempt row.
3. Plan downgraded, `extension_only:lever`, catalog-closed job, posting fetch 404: the right code, no browser launched (fake ATS saw no page load).
4. Challenge fixtures before and after the click; required-empty fixture; 422 and 404 submit responses.
5. Marker write failure (revoke `EXECUTE` on `mark_attempt_phase` mid-run): the submit request never reaches the fake ATS; `applier_error`.
6. Duplicate enqueue of the same id and a racing recovery id: one attempt, one browser launch, the loser ends `not_owner`.
7. Grant test as `kairos_applier`: every table read or write fails; `get_applier_payload` with another worker identity returns zero rows (T-DB-15).
8. `scanForm` on Lever and Ashby fixtures stores rows; a Greenhouse job is refused by `store_form_questions`; the fake ATS records zero submit requests during scans.
9. PII scan (`durable/pii-scan.test.ts`): after all of the above, no marker string in any `kairos_dbos` table.

**Failure injection.**

| Test | Method | Pass |
|---|---|---|
| 50-crash test (P5 exit) | `process.exit(137)` at random points in each phase across 50 runs, restart on the same and on a new executor id | Zero duplicate submissions at the fake ATS; zero charges for unreported attempts; every attempt terminal within 10 minutes; ambiguous ones `needs_check` |
| Chaos test (P2 exit) | Kill api, worker and applier during 1,000 scripted approvals (half cloud), restart Postgres once | Zero duplicate attempts, zero double charges, all terminal within 10 minutes |
| Database blip | Drop the applier's PgBouncer path for 30 s and for 120 s mid-run | 30 s: run completes; 120 s: sweeper settles by phase, `result_after_close` counted, no duplicate |
| Browser crash | Kill the Chromium process during `filling` | `timeout` (`filling_unverified`) with `ap2_verified` off, `applier_error` or `required_missing` with it on |
| Deploy drain | `SIGTERM` with 4 runs in flight | Runs finish within 170 s; no new dequeue; exit 0 |
| SSRF suite (S-AP3) | Fixture pages that request a private literal, an internal hostname, a rebinding name and a redirect to an internal address | Every request refused and counted; the form still submits |

**Acceptance criteria.**

1. Every frozen route's contract suite stays green; nothing under `extension/` changes (diff check), and the image's `filler.js` SHA-256 equals the extension build artifact.
2. The 50-crash test and the SSRF suite pass (P5 exit); the chaos test passes (P2 exit).
3. No step output or workflow input contains free text (schema rule and PII scan).
4. The applier's environment contains no forbidden variable, and its role can do nothing beyond section 10.
5. On staging against the fake ATS: S4 at least 95% under 1.5x growth load (P8), RSS per context at most 900 MB, at least 4 contexts per 4 GB replica (S-AP1).
6. `submit_seen` is marked before every submit request on all three fake ATS forms and on one real throwaway posting where permitted (S-AP2); only then is `ap2_verified` set.

---

## 12. Migration from the skeleton: which files it replaces and what is kept

| Skeleton | Fate |
|---|---|
| `server/src/applier.ts` (BullMQ `Worker` on `cloud-apply`) | Replaced: `launchDurable("applier")` with `listenQueues: ["cloud-apply", "scan-form"]`, executor heartbeat through `heartbeat_executor`, the shutdown contract of `durable/shutdown.ts` (170 s), internal `GET /health` with browser liveness |
| `server/src/jobs/cloud-apply.ts` (`processCloudApply`) | Replaced by `server/src/durable/workflows/apply-cloud.ts` and `server/src/applier/{browser-pool,egress-guard,attempt,challenge,apply-endpoints,scan}.ts`; `durable/workflows/scan-form.ts` is new |
| `claimForCloud` and the cloud use of `recordSubmission` in `server/src/services/submissions.ts` | Replaced by `claim_cloud_attempt`, `record_attempt_result` and `settleAttempt`/`recordOutcome`; the extension path keeps `recordSubmission` until P2's `recordOutcome` replaces it |
| `extension/dist/filler.js`, injected with `addScriptTag` under `bypassCSP` | **Kept unchanged** |
| `CHROMIUM_EXECUTABLE_PATH`, `FILLER_SCRIPT_PATH`, `APPLIER_CONCURRENCY` | Kept; `APPLIER_CONCURRENCY` default moves from 2 to 4; new `APPLIER_ALLOWED_HOSTS`, `APPLIER_RECYCLE_AFTER` |
| `server/Dockerfile.applier` on `mcr.microsoft.com/playwright:v1.64.0-noble` | Kept; base image to `v1.64.1-noble` with `playwright-core` 1.64.1; `RAILWAY_SHM_SIZE_BYTES=1073741824`; `RAILWAY_RUN_UID` set to `pwuser` |
| One shared Chromium, a context per job, `chromium.launch({ headless: true })` | Kept as the pool's core, with the launch flags of 7.5 and recycling |

**Phases.**

| Phase | What ships | Flag |
|---|---|---|
| P1 | Role `kairos_applier`, `dbos_applier`, per-role env schema; DBOS installed, no traffic | |
| P2 | `applyCloud` with `claim`, `precheck`, `runBrowser` (phases `claimed`, `navigating`, `filling`; host allowlist on navigation), `recordResult`, `settleAttempt`; classification with `ap2_verified` off, so every no-confirmation click is `timeout`. Migration `0012 apps_01_expand` brings the functions. The BullMQ `cloud-apply` queue drains: stop producing (flag), wait for zero waiting and active jobs, keep the consumer until its failed set is empty, delete it | `CLOUD_APPLY_V2` per user, inside the `LIFECYCLE_V2` rollout (1%, 10%, 50%, 100%) |
| P5 | Egress guard and launch flags, `submit_seen` route handler (S-AP2), full challenge detection, extension-only switch, recycling and watchdog, `scanForm` (needs `0018 catalog_02_intake` from P3), sizing to 6 and 8 replicas (S-AP1), sandbox decision (S-AP4); then `ap2_verified` | `CLOUD_APPLY_V2` remains the switch |
| P7 | Remove `bullmq` and `ioredis` from the applier bundle | |

During the overlap, an application is never processed by both engines: the new workflow id and the old job id `apply-<id>` both derive from the application id, and both processors claim conditionally on `status = 'approved'`. The skeleton's claim leaves `current_attempt_id` null, which is why `applications_submitting_ck` is validated only in `0028 apps_08_contract`, after P7.

---

## 13. Additions requested: anything this worker needs that the foundation documents lack (or "none")

| Id | Owner document | Request | Reason |
|---|---|---|---|
| A1 | `02-database.md` 8.3 and `_db/applications.md` 5.7 | `mark_attempt_phase` and `record_attempt_result` return `boolean` (true when a row was updated) instead of `void` (drop and recreate in the same migration; grants unchanged) | The submit route handler must know the attempt is still open before `route.continue()`; until this lands it confirms with a second `get_applier_payload` call. `record_attempt_result = false` drives `applier.result_after_close` (F12) |
| A2 | `02-database.md` 4.3 and `06-infrastructure.md` 6.4 | `record_process_metrics(p_service text, p_replica text, p_metrics jsonb) RETURNS void`, `SECURITY DEFINER`, upserting into `metrics_minute` with the service-match rule of `heartbeat_executor`, names limited to `^(applier|node)\.[a-z0-9_.]{1,80}$`, at most 50 series a call; `EXECUTE` to `kairos_applier` (an eighth function) | The applier has no table privilege, so its process gauges (`applier.contexts_in_use`, `applier.egress_blocked`, RSS, restarts) cannot reach `metrics_minute`, and A-SUB-6 and A-NODE-2 depend on them |
| A3 | `01-architecture.md` B.5.4, B.5.5, B.5.8; `02-database.md` 20 (workflow ids) | (a) Recovery ids `apply:<applicationId>:<attemptNo>:r<epochMinute>` (reconciler, only when no non-terminal apply workflow and no attempt row exist, skipped while `pause_cloud_apply` is on) and `scan:<jobId>:<parserVersion>:r<floor(epochHours / 6)>`. (b) B.5.5 step 3: orphaned `cloud-apply` and `scan-form` workflows are cancelled, never resumed by the worker, and recovered from business rows; replace "re-enqueued to the applier" | A deterministic id that already exists returns the old cancelled workflow, so a recovery needs a new id; a worker-side resume could run the browser step in a process without Chromium |
| A4 | `01-architecture.md` B.5.3; `06-infrastructure.md` 9.4 | `cloud-apply` `partitionConcurrency` 12 instead of 8 | Peak demand on `job-boards.greenhouse.io` is about 8.6 concurrent runs at growth [est], above 8, which threatens S4 (section 4) |
| A5 | `06-infrastructure.md` 6.4, 6.7, 10 | Metrics of section 8 and alerts A-SUB-7 (`submit_seen_missed` with `ap2_verified` on) and A-SUB-8 (`result_after_close`, `marker_write_failed`), both pointing to R-SUB-1 | S-AP2 regressions and the F12 corner otherwise go unseen |
| A6 | Worker spec `submission-settlement`; `05-api.md` (failure messages) | `settleAttempt` accepts a delayed enqueue from the replay path, settles an open attempt only when its heartbeat is older than 90 seconds or the 8-minute run cap passed (otherwise ends without settling and without consuming the id: it must not complete the workflow id while the attempt is live), uses `AttemptEvidence.detail` codes of 3.4 for the user message, and builds the receipt from `filledFieldKeys` and `applications.answers` | Keeps the `settle:<attemptId>` id from being consumed before the attempt can be settled |

**Places this spec follows spike S-D1 (corrections table of `_research/spike-s-d1-local.md`).**

| S-D1 finding | Where it changed this spec |
|---|---|
| Packages are CommonJS | The workflows import only the `server/src/durable/` seam, which uses `import dbosSdk from "@dbos-inc/dbos-sdk"` (3.1) |
| Queues are database-backed and registered after launch with `await DBOS.registerQueue(name, options)`; `WorkflowQueue` is type-only | Section 4 registration table |
| No `partitionQueue`; any `partition*` limit partitions the queue and every enqueue passes a key | `cloud-apply` uses `partitionConcurrency` only and every enqueue passes `apply_host` (2, 4) |
| `concurrency` is deprecated; use `globalConcurrency` | `scan-form` `globalConcurrency: 4` (4) |
| No public recover-for-other-executors call; cancel plus resume is the proven path | Orphaned applier workflows are cancelled only and recovered from business rows (5, A3) |
| `forkWorkflow` replays from step 0 and re-runs effects, so rule D1 is mandatory | Never fork `applyCloud`; `claim_cloud_attempt` and `mark_browser_launched` make every replay state-conditional (2, 5) |
| No garbage-collection call; retention uses `deleteWorkflows` | Terminal `apply:` and `scan:` workflows are deleted after 14 days by `dbos-retention` in batches of 500 (10) |
| About 6 fixed writes per workflow (7 queued), 1 per step, 2 per datasource transaction; target 60, alert 80 | 12 writes per `applyCloud` run and 8 per scan; budget impact in section 9 |
| Pin `pg@8` | The applier's application pool uses `pg` 8.23.1 (12) |

Skills: `dbos-typescript`, `saga-orchestration` and `error-handling-patterns` all loaded and were applied as guidance only.
