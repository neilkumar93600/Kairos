# Worker spec 10: `inbound-email` (reply tracking)

Revision 1, 2026-10-25. Tier: **critical**. Process: api (route and `ingestInboundEmail`) and worker (`classifyEmail`, `reconcile-inbox`). Module: `server/src/modules/inbox/`. Agent: `reply-classifier` (spec in `agents/`).

This document implements `01-architecture.md` B.6.11 (offer pause, candidate side only), B.6.12 (replies, event ledger, reply-driven stage), the `ingestInboundEmail` and `classifyEmail` rows of B.5.4, and the inbound row of B.5.8. It uses the schema of `02-database.md` section 7.5 and the messaging state machines of `_db/messaging.md` section 6, the webhook route of `05-api.md` section 14.3, and the `reply-classifier` runtime row of `03-agent-runtime.md` section 3.3. Where those documents disagree, the resolution is stated in place and listed in section 13.

---

## 1. Purpose and place in the lifecycle

A user forwards employer mail to a private address `u-<id8>-<hex8>@replies.kairos.app` (`profiles.forwarding_address`). Kairos never reads a mailbox; this address is the only inbound channel (INV-6). For each forwarded message this worker:

1. **Handles the Gmail forwarding confirmation.** Gmail sends a code and link to the new address before it will forward anything. Kairos extracts both, stores them in `forwarding_verifications` for at most 3 days, shows them in the app and emails them to the user's account address. The confirmation never becomes a visible inbox row and its body is never stored.
2. **Tags the reply** with an `email_kind` (`confirmation`, `rejection`, `interview`, `assessment`, `offer`, `other`): the kept regex rules with their tested offer guard first, then `reply-classifier` (Haiku 5.5) only for mail the rules cannot tag (about 25%).
3. **Links the reply to an application**, domain first: the sender's domain against `companies.domains` and the shared ATS mail domains; the company name only with word boundaries and only under the length rule (fixes the "Box", "Ramp", "Scale" defect D-26).
4. **Drives the reply-driven stage and the event ledger (F5).** A linked reply appends one `application_events` row (`reply_*`) and moves `applications.stage` forward only (`rejected` is final). It never changes `applications.status` or credits.
5. **Creates offer-pause candidates**, and only for mail that the deterministic offer rule tagged and that is linked by domain to a `submitted` application of a user with an active subscription. The user gets a signed undo link; the billing worker (`billing-events`, `offer-pause-apply`) pauses Stripe collection 48 hours later if the user did nothing. The model can never cause a pause.
6. **Feeds** the inbox (`GET /api/inbox`, frozen shape), the timeline (`GET /api/applications/:id/events`), in-app notifications (`reply_important`, `forwarding_code`), the reminders schedule (`no_reply` nudges read "has a linked reply"), the ghost-job signal (`ghost-signals` reads silent applications) and the weekly outcome report.

```mermaid
sequenceDiagram
  autonumber
  participant G as Employer or ATS
  participant U as User mailbox (Gmail, Outlook)
  participant PM as Postmark inbound
  participant API as api: POST /api/webhooks/postmark/inbound/:pathSecret
  participant DB as Postgres kairos
  participant ING as ingestInboundEmail (api, request workflow)
  participant Q as DBOS queue email
  participant CL as classifyEmail (worker)
  participant RC as reply-classifier (Haiku 5.5)
  participant N as notify queue
  G->>U: reply to an application
  U->>PM: auto-forward to u-...@replies.kairos.app
  PM->>API: JSON (Basic + path secret)
  API->>DB: storeInboundEmail tx (body truncated, encrypted; or hidden row)
  API->>ING: start mail:<MessageID> {inboundEmailId, route}
  API-->>PM: 200 {stored}
  ING->>Q: enqueue classify:<inboundEmailId>
  ING->>N: or enqueue notify:forwarding_code:<inboundEmailId>
  Q->>CL: dequeue
  CL->>DB: step classifyAndLink: read, decrypt, rules, link candidates
  CL->>RC: only when no rule matched and spam_score < 5
  CL->>DB: tx applyClassification: classified_at, kind, link, stage, event, candidate, notification
  CL->>N: enqueue notify:offer_pause_notice:<candidateId> when a candidate was created
```

Lifecycle position: downstream of `submission-settlement` (an application becomes `submitted` and gets `stage = 'applied'` from `recordOutcome`), upstream of `billing-events` (`offer-pause-apply` consumes `offer_pause_candidates`) and `engagement-notify` (reminders, digests, outcome report). It shares no lock or code path with approval, sending or charging (boundary rule 3 of `03-agent-runtime.md` section 1: billing, submission and approval code cannot import agents, and this module cannot import billing or submission writers).

---

## 2. Trigger, schedule and payload (a TypeScript type), plus the idempotency key

### 2.1 Triggers

| Trigger | Process | What it starts |
|---|---|---|
| `POST /api/webhooks/postmark/inbound/:pathSecret` (05-api 14.3) and, for one week, the legacy `POST /api/webhooks/inbound-email?token=` (05-api 14.4) | api | `storeInboundEmail(tx, mail)` in a plain transaction, then the request workflow `ingestInboundEmail` |
| `ingestInboundEmail` body | api | Enqueues `classifyEmail` on queue `email`, or `notify` for a forwarding code, or nothing |
| `reconcile-inbox` schedule, every 5 minutes | worker | Redrives unclassified mail, re-runs the model for deferred rows, and writes the poison fallback (section 5.5) |

There is no other trigger. `classifyEmail` is never started by a user route. Personal free text is stored by the route before any workflow starts (05-api decision A-14), so every workflow input is an id.

### 2.2 Payload types

```ts
// server/src/modules/inbox/workflow-types.ts (specification-level)
import { z } from "zod";
import { EMAIL_KINDS } from "@auto-career/shared";

/** Input of the request workflow ingestInboundEmail. Ids and enums only (rule D4). */
export const ingestInboundEmailInput = z.strictObject({
  inboundEmailId: z.uuid(),
  /** Decided by the route from what it stored: a visible row is classified, a Gmail confirmation
   *  is emailed to the user, a spam-hidden row needs nothing. */
  route: z.enum(["classify", "forwarding_code", "none"]),
});
export type IngestInboundEmailInput = z.infer<typeof ingestInboundEmailInput>;

/** Input of classifyEmail on queue "email". */
export const classifyEmailInput = z.strictObject({
  inboundEmailId: z.uuid(),
  /** "full": first classification. "model_only": a reconciler re-run for a row whose model call
   *  was deferred (kind null after classification); rules and link are not recomputed. */
  mode: z.enum(["full", "model_only"]).default("full"),
});
export type ClassifyEmailInput = z.infer<typeof classifyEmailInput>;

/** Output of step classifyAndLink, checkpointed: ids, enums, numbers only. Never a subject, body,
 *  sender, code or link. */
export interface ClassifyStepResult {
  outcome: "ready" | "already_classified" | "not_found" | "hidden_confirmation";
  ruleKind: (typeof EMAIL_KINDS)[number] | null;
  modelKind: (typeof EMAIL_KINDS)[number] | null;
  modelConfidence: number | null;               // 0..1, rounded to 2 decimals
  modelStatus: "not_called" | "ok" | "deferred" | "failed_final";
  modelErrorCode: string | null;                 // LlmErrorCode, matches ^[a-z_]{1,40}$
  llmCallId: string | null;                      // llm_calls.id as a decimal string
  candidateApplicationId: string | null;         // uuid, re-validated in the transaction
  linkedBy: "domain" | "company_name" | "none";
  restricted: boolean;                           // spam_score >= 5
  rulesVersion: number;                          // RULES_VERSION
}

/** Output of the transaction applyClassification. */
export interface ApplyClassificationResult {
  applied: boolean;                              // false: another run classified it first (rule D1)
  kind: (typeof EMAIL_KINDS)[number] | null;
  applicationId: string | null;
  stageChanged: boolean;
  offerCandidateId: string | null;               // set only when a pending candidate was inserted
}
```

A CI test (the B.5.6 schema test) asserts that none of these schemas contains an unconstrained string.

### 2.3 Idempotency keys

| Unit | Key | Why it is safe to repeat |
|---|---|---|
| Postmark delivery | `inbound_emails.provider_message_id` unique (`inbound_emails_provider_message_id_unique`); the route inserts `ON CONFLICT DO NOTHING` | A redelivery stores nothing and still starts the workflow (05-api 14.3 step 6) |
| `ingestInboundEmail` | Workflow id `mail:<MessageID>` | A duplicate start returns the existing workflow (D3; S-D1 check 3) |
| First classification | Workflow id `classify:<inboundEmailId>` | A duplicate enqueue is ignored |
| Reconciler redrive | Workflow id `classify:<inboundEmailId>:r<n>`, where `n` is the new `inbound_emails.classify_attempts` value returned by the reconciler's `UPDATE ... RETURNING` (section 13, AR-1) | A terminal workflow id cannot be re-run, so each redrive needs a new deterministic id; the counter makes it unique and bounds redrives at 6 |
| Classification effects | `UPDATE inbound_emails ... WHERE id = $1 AND classified_at IS NULL` (mode `full`) or `... AND kind IS NULL AND rule_kind IS NULL AND model_kind IS NULL AND hidden_reason IS NULL` (mode `model_only`); zero rows ends the transaction | Rule D1: Postgres decides, so a fork from step 0 (S-D1 check 5) or a duplicate run is a no-op |
| Event | `application_events_dedupe_uq (application_id, dedupe_key)` with `dedupe_key = 'reply:<inboundEmailId>'` | Insert-once |
| Notification | `notifications_dedupe_uq (user_id, kind, entity_id)`, `entity_id = <inboundEmailId>` | Insert-once |
| Offer-pause candidate | `offer_pause_candidates_email_uq (inbound_email_id)` and `offer_pause_one_pending_uq (user_id) WHERE state = 'pending'`; `ON CONFLICT DO NOTHING` | One candidate per email, one pending per user |
| Follow-up mail | `notify:offer_pause_notice:<candidateId>`, `notify:forwarding_code:<inboundEmailId>`; `email_sends (kind, entity_id)` claimed before the send | Insert-once claim |
| Model call | `llm_calls` row per send (ledger, not a dedupe key) | A replayed step may call the model again (at most about $0.0006); the conditional `UPDATE` keeps only one result |

---

## 3. Algorithm, step by step: for every step name the tables and columns read and written, the agents invoked and the external calls made

Notation: R = rows read, W = rows written, A = agents, X = external calls.

### 3.0 Route `storeInboundEmail` (owned by 05-api 14.3; listed because this worker depends on its output)

Runs in the api as one plain transaction (role `kairos_api`), after the path secret and Basic checks.

| # | Action | Tables and columns |
|---|---|---|
| 0.1 | Resolve the recipient from `OriginalRecipient`, falling back to `To`; lower-case | R `profiles.user_id` by `forwarding_address` (unique index). No row: 200 `{stored: false}` |
| 0.2 | Flood cap: at most 400 stored rows per user in 24 hours | R `count(*) FROM inbound_emails WHERE user_id = $u AND received_at > now() - interval '24 hours'` (`inbound_emails_user_idx`). At the cap: 200, count `inbound.dropped{reason="flood_cap"}` |
| 0.3 | `parseGmailForwardingConfirmation(from, subject, body, authResults)` (section 3.4) | On a match: W `forwarding_verifications` upsert (`code`, `confirm_url`, `received_at`, `expires_at = received_at + 3 days`, `acknowledged_at = NULL`); W `profiles.forwarding_state = 'awaiting_verification'` where it is `not_started`, `awaiting_verification`, `verified_pending_first_mail` or `stale`; W `notifications (kind 'forwarding_code', entity_id = <inboundEmailId>)` `ON CONFLICT DO NOTHING`; the row below is inserted hidden. `route = 'forwarding_code'` |
| 0.4 | Spam score from header `X-Spam-Score` | `>= 8`: hidden row, `hidden_reason = 'spam'`, no body, `route = 'none'`. `>= 5`: stored and visible; `classifyEmail` restricts automation |
| 0.5 | Insert the row with an application-generated uuid (the encryption AAD needs it) | W `inbound_emails (id, user_id, provider_message_id, sender (320), subject (500), text_body_enc, preview_enc, attachments (name, type, size), spam_score, hidden_reason, classified_at = now() for hidden rows)` `ON CONFLICT (provider_message_id) DO NOTHING RETURNING id`. A duplicate re-reads `id`, `hidden_reason` to recompute `route` |
| 0.6 | Start `ingestInboundEmail` with id `mail:<MessageID>`, input `{inboundEmailId, route}` | X DBOS system database (direct connection) |
| 0.7 | Answer 200 `{stored: true}` or `{stored: false, duplicate: true}` | A failure in 0.5 or 0.6 answers 503; Postmark retries 10 times over about 10 hours |

Body handling: plain text only (`HtmlBody` ignored), truncated at a character boundary to 16,384 bytes, AES-256-GCM under `DATA_KEKS` with AAD `inbound_emails:<id>:body`; the preview is the first 280 characters with whitespace collapsed, AAD `inbound_emails:<id>:preview`.

### 3.1 Workflow `ingestInboundEmail` (api, request workflow, timeout 5 s)

```ts
// server/src/modules/inbox/ingest.ts (specification-level)
import dbosSdk from "@dbos-inc/dbos-sdk";          // CJS package: default import (S-D1)
const { DBOS } = dbosSdk;

async function ingestInboundEmailFn(input: IngestInboundEmailInput): Promise<void> {
  ingestInboundEmailInput.parse(input);
  if (input.route === "classify") {
    await DBOS.startWorkflow(classifyEmail, {
      workflowID: `classify:${input.inboundEmailId}`, queueName: "email", timeoutMS: 120_000,
    })({ inboundEmailId: input.inboundEmailId, mode: "full" });
  } else if (input.route === "forwarding_code") {
    await DBOS.startWorkflow(notify, {
      workflowID: `notify:forwarding_code:${input.inboundEmailId}`, queueName: "notify", timeoutMS: 120_000,
    })({ kind: "forwarding_code", entityId: input.inboundEmailId });
  }
}
export const ingestInboundEmail = DBOS.registerWorkflow(ingestInboundEmailFn, { name: "ingestInboundEmail" });
```

No step, no transaction: R none, W none (DBOS writes its own checkpoint rows), A none, X none. The api listens to no queue (`listenQueues: []`), so the enqueue lands in `kairos_dbos` and a worker dequeues it (S-D1 check 4). The `notify` workflow reads the code from `forwarding_verifications` at send time and suppresses the mail (`email_sends.status = 'suppressed'`, `error_code = 'expired'`) if the row has expired or was deleted.

### 3.2 Workflow `classifyEmail` (worker, queue `email`, timeout 2 min)

```ts
// server/src/modules/inbox/classify.ts (specification-level)
async function classifyEmailFn(input: ClassifyEmailInput): Promise<void> {
  classifyEmailInput.parse(input);
  const startedAt = Date.now();
  const s = await DBOS.runStep(() => classifyAndLink(input, { deadlineAt: startedAt + 90_000 }), {
    name: "classifyAndLink", retriesAllowed: true, maxAttempts: 3, intervalSeconds: 2, backoffRate: 2,
  });
  if (s.outcome !== "ready") return;                                    // not_found, already_classified, hidden_confirmation
  const r = await kairosDs.runTransaction(() => applyClassification(input, s), { name: "applyClassification" });
  if (r.offerCandidateId) {
    await DBOS.startWorkflow(notify, {
      workflowID: `notify:offer_pause_notice:${r.offerCandidateId}`, queueName: "notify", timeoutMS: 120_000,
    })({ kind: "offer_pause_notice", entityId: r.offerCandidateId });
  }
}
export const classifyEmail = DBOS.registerWorkflow(classifyEmailFn, { name: "classifyEmail" });
```

#### Step A: `classifyAndLink` (reads and model call; no business writes except the `llm_calls` ledger and the confirmation safety net)

| # | Action | Tables and columns | A / X |
|---|---|---|---|
| A1 | Load the row | R `inbound_emails (id, user_id, sender, subject, text_body_enc, spam_score, hidden_reason, kind, rule_kind, model_kind, classified_at, classify_attempts, received_at)` by primary key. None: `not_found`. Mode `full` and `classified_at IS NOT NULL`: `already_classified`. Mode `model_only` and not (`kind IS NULL AND rule_kind IS NULL AND model_kind IS NULL AND hidden_reason IS NULL`): `already_classified` | |
| A2 | Decrypt the body in memory | `text_body_enc` with `DATA_KEKS`; failure throws `KairosStepError("decrypt_failed")` | |
| A3 | Safety net for Gmail confirmations (a template variant the route missed) | `parseGmailForwardingConfirmation`. On a match, one transaction inside the step: W `forwarding_verifications` upsert; W `profiles.forwarding_state = 'awaiting_verification'` (same predicate as 0.3); W `inbound_emails SET hidden_reason = 'forwarding_confirmation', text_body_enc = NULL, preview_enc = NULL, classified_at = now() WHERE id = $1 AND classified_at IS NULL`; W `notifications (forwarding_code)`. Return `hidden_confirmation`. The workflow then enqueues nothing; the reconciler sees the notification row without an `email_sends` row and enqueues `notify:forwarding_code:<id>` (section 5.5) | |
| A4 | Normalize for rules: `stripQuoted(body)` removes lines starting with `>`, "On ... wrote:" blocks and text after a `-- ` signature marker, but keeps a forwarded-message header block | none | |
| A5 | Rules (mode `full` only): `classifyByRules(subject, normalizedBody)`, `RULES_VERSION = 1`, the skeleton regex set byte-for-byte (section 3.3) | none | |
| A6 | Restriction: `restricted = spam_score >= 5` | none | |
| A7 | Model, only when `ruleKind` is null, not restricted, and the deadline leaves at least 25 s | R `"user".name` (for `[candidate]` replacement); input `subject = redactContact(subject)` cut to 300 characters with the user's name replaced, `excerpt = redactEmailBody(body, { name })` (550 tokens). Context `{ userId, inputRefs: { inbound_emails: [id] }, plan, budgetClass: "pipeline", workspace: "batch", traceId, deadlineAt }`, `callKind: "primary"`. W `llm_calls` (one row per send, by the gateway) | A `reply-classifier`; X Anthropic Messages API with `ANTHROPIC_KEY_BATCH` (not the Batch API) |
| A8 | Map the model result (table below) | none | |
| A9 | Link (mode `full` only): `linkReply(...)` (section 3.5) | R `applications`, `companies`, `jobs` (section 3.5) | |
| A10 | Return `ClassifyStepResult` | | |

Model result mapping (A8). The gateway already retried transient errors (03-agent-runtime section 5), so no model error escapes the step:

| Gateway result | `modelStatus` | `modelKind` | Resolved `kind` (in step B) |
|---|---|---|---|
| `ok`, kind not `offer`, `confidence >= 0.6` | `ok` | the kind | the kind |
| `ok`, kind not `offer`, `confidence < 0.6` | `ok` | the kind | `other` |
| `ok`, kind `offer` | `ok` | `offer` (kept as evidence) | `other`; counted `inbound.model_offer_rejected` (the deterministic offer rule already declined this mail in A5) |
| `AgentError` `rate_limited`, `spend_limit`, `overloaded`, `server_error`, `timeout`, `connection`, `circuit_open`, `budget_stopped`, `agent_disabled`, `llm_paused`, or the deadline reached | `deferred` | null | null (row classified, kind unknown; the reconciler re-runs the model, section 5.5) |
| `AgentError` `schema_invalid` (after the one repair), `max_tokens`, `refusal`, `injection_echo`, `invalid_request`, `request_too_large`, `precheck_failed` | `failed_final` | null | `other`; `injection_echo` also counts `inbound.injection_suspect` |
| `AgentError` `auth`, `permission`, `billing`, `model_not_found` | `deferred` | null | null; these also page through the gateway's own alerts (A-LLM) |

The 0.6 confidence floor is the constant `MODEL_MIN_CONFIDENCE` in `inbox/config.ts`; it changes only together with an eval run of `reply-classifier`.

#### Step B: transaction `applyClassification` (role `kairos_worker`, one datasource transaction, exactly once)

Lock order (02-database 5.1): `profiles` row (2) only when the forwarding state changes, then the one `applications` row (5), then inserts. This adds rank 2 to the `classifyEmail` row of 02 5.1, which today lists rank 5 only (section 13, AR-4).

| # | Statement | Tables and columns |
|---|---|---|
| B1 | Resolve `kind` from the mapping above. Validate the link candidate: `SELECT id, status, failure_code, stage FROM applications WHERE id = $cand AND user_id = $u AND (status IN ('submitted','submitting') OR (status = 'failed' AND failure_code IN ('unconfirmed','timeout','no_report')))` (no lock yet). A vanished or ineligible candidate becomes `linked_by = 'none'` | R `applications` |
| B2 | Commit the classification. Mode `full`: `UPDATE inbound_emails SET kind = $kind, rule_kind = $ruleKind, model_kind = $modelKind, application_id = $app, linked_by = $linkedBy, classified_at = now() WHERE id = $id AND classified_at IS NULL RETURNING user_id`. Mode `model_only`: `UPDATE inbound_emails SET kind = $kind, model_kind = $modelKind WHERE id = $id AND classified_at IS NOT NULL AND kind IS NULL AND rule_kind IS NULL AND model_kind IS NULL AND hidden_reason IS NULL RETURNING user_id, application_id, linked_by`. Zero rows: return `applied = false` (rule D1). A deferred model result in mode `model_only` writes nothing | W `inbound_emails.kind, rule_kind, model_kind, application_id, linked_by, classified_at` |
| B3 | Forwarding activation, only when the row is visible and `spam_score` is null or below 5, and only in mode `full`: `UPDATE profiles SET forwarding_state = 'active' WHERE user_id = $u AND forwarding_state <> 'active'`; if one row changed, `DELETE FROM forwarding_verifications WHERE user_id = $u` | W `profiles.forwarding_state`; D `forwarding_verifications` |
| B4 | Stage, when linked and `kind` maps to a stage (`confirmation` to `in_review`, `assessment` to `assessment`, `interview` to `interviewing`, `offer` to `offer`, `rejection` to `rejected`; `other` and null: none): `UPDATE applications SET stage = $s WHERE id = $a AND (stage IS NULL OR array_position($ranks, stage) < array_position($ranks, $s) OR $s = 'rejected') AND stage IS DISTINCT FROM 'rejected' RETURNING id`. The predicate makes the `applications_guard_stage_bu` trigger a backstop that never fires on this path | W `applications.stage` (row lock 5); `applications_row_version_bu` bumps `row_version` |
| B5 | Event, when linked and `kind` is not `other` or null: `INSERT INTO application_events (application_id, user_id, kind, actor, detail, dedupe_key) VALUES ($a, $u, 'reply_' \|\| $kind, 'employer', jsonb_build_object('inboundEmailId', $id, 'linkedBy', $linkedBy, 'source', $source, 'stageChanged', $changed), 'reply:' \|\| $id) ON CONFLICT DO NOTHING` (`source` is `rule` or `model`) | W `application_events` |
| B6 | Offer-pause candidate, only when all hold: `kind = 'offer'` (so `rule_kind = 'offer'`, enforced by `inbound_emails_offer_needs_rule_ck`), `linked_by = 'domain'`, the application `status = 'submitted'`, `spam_score` null or below 5, `profiles.applications_paused_at IS NULL`, and `SELECT 1 FROM subscriptions WHERE user_id = $u AND status IN ('active','trialing') AND NOT collection_paused`. Then `INSERT INTO offer_pause_candidates (user_id, inbound_email_id, application_id, apply_after) VALUES ($u, $id, $a, now() + interval '48 hours') ON CONFLICT DO NOTHING RETURNING id` | R `subscriptions`, `profiles.applications_paused_at`; W `offer_pause_candidates` |
| B7 | Notification, when linked, not restricted, and `kind` is `interview`, `assessment` or `offer`, or `kind = 'confirmation'` on an application in `failed` with an ambiguous code: `INSERT INTO notifications (user_id, kind, entity_id, detail) VALUES ($u, 'reply_important', $id, jsonb_build_object('applicationId', $a, 'kind', $kind, 'hint', $hint)) ON CONFLICT DO NOTHING`; `hint` is `confirmation_for_unconfirmed` for the second case ("the employer confirmed receipt; do not resend"), else null | W `notifications` |
| B8 | Return `ApplyClassificationResult` | |

The transaction never touches `applications.status`, `credit_ledger`, `credit_balances`, `subscriptions`, `approveCore` or `recordOutcome`. A confirmation email for an ambiguous failure is evidence for the user, not a charge: late confirmation stays the job of `recordOutcome` on a real report (section 13, open item O-2).

### 3.3 Rules (`server/src/modules/inbox/rules.ts`)

The skeleton's `classifyByRules` moves here unchanged (`RULES_VERSION = 1`), including the `OFFER` expression with its negative lookaheads for "offer you an interview" and "extend an offer to interview". First match wins in this order: `offer`, `rejection`, `assessment`, `interview`, `confirmation`. The rules read the subject and the first 4,000 characters of the normalized body. A change to any expression requires a `RULES_VERSION` bump, a green run of the golden file `server/test/fixtures/inbox/rules-golden.jsonl` (at least 200 cases, including all 40 "offer you an interview" cases of the `reply-classifier` eval set, which must never yield `offer`), and an owner review, because the offer rule is the only path to a billing pause.

### 3.4 Gmail confirmation parser (`server/src/modules/inbox/forwarding.ts`)

`parseGmailForwardingConfirmation(from, subject, body, authResults)` returns `{ code, confirmUrl } | null`. It matches only when all hold: the sender address is exactly `forwarding-noreply@google.com`; the subject starts with "Gmail Forwarding Confirmation"; and DKIM passed for `google.com` according to the `Authentication-Results` header (section 13, AR-3). It extracts `code` with `\b\d{9}\b` (the database allows 6 to 12 digits until spike S-G1 pins the sample) and `confirmUrl` only when its host is in `FORWARDING_LINK_HOSTS = ["mail-settings.google.com", "mail.google.com"]` [verify in S-G1]; any other link is dropped and only the code is kept. The server never fetches the link. Without DKIM evidence the mail is treated as ordinary mail, so a spoofed "confirmation" cannot make Kairos email a phishing link to the user.

### 3.5 Linking (`server/src/modules/inbox/link.ts`)

```ts
export interface LinkInput {
  userId: string;
  sender: string;              // From header as stored
  subject: string;
  normalizedBody: string;      // from A4
  accountEmail: string;        // "user".email, to detect manual forwards
  restricted: boolean;         // spam_score >= 5
}
export interface LinkResult { applicationId: string | null; linkedBy: "domain" | "company_name" | "none" }
export declare function linkReply(tx: Tx, input: LinkInput): Promise<LinkResult>;
```

1. **Original sender.** `originalSender(sender, normalizedBody, accountEmail)`: if the `From` address equals the account email or a free-mail address and the body holds a forwarded header block (Gmail "---------- Forwarded message ---------" then `From: Name <addr>`; Outlook `From: Name <addr>` followed by `Sent:`), use the address and display name from the first such block; else use `From`.
2. **Candidates.** `SELECT a.id, a.status, a.failure_code, a.submitted_at, a.approved_at, c.id AS company_id, c.name, c.ats, c.domains, j.title FROM applications a JOIN companies c ON c.id = a.company_id JOIN jobs j ON j.id = a.job_id WHERE a.user_id = $u AND (a.status IN ('submitted','submitting') OR (a.status = 'failed' AND a.failure_code IN ('unconfirmed','timeout','no_report'))) AND a.updated_at > now() - interval '180 days' ORDER BY a.updated_at DESC LIMIT 500` (served by `applications_user_status_updated_idx`). Empty: `none`.
3. **Tier 1, employer domain** (`linked_by = 'domain'`). Hosts are compared as all suffixes with at least two labels (`mail.acme.com` gives `mail.acme.com`, `acme.com`), so no public-suffix list is needed. Free-mail domains (`FREE_MAIL_DOMAINS`: gmail.com, googlemail.com, outlook.com, hotmail.com, live.com, yahoo.com, icloud.com, proton.me, protonmail.com, aol.com, gmx.com, zoho.com, yandex.com, rediffmail.com) never link by domain. Candidates whose `c.domains` contains a suffix are kept. One company: go to step 6. More than one company: no Tier 1 link.
4. **Tier 2, ATS mail domain with name confirmation** (`linked_by = 'domain'`). When the sender host ends with an ATS mail domain (`ATS_MAIL_DOMAINS`: `greenhouse-mail.io` and `greenhouse.io` for `greenhouse`, `hire.lever.co` and `lever.co` for `lever`, `ashbyhq.com` for `ashby` [verify on the beta sample]), keep candidates whose `c.ats` is that ATS and whose company name appears with word boundaries (case-insensitive, punctuation-normalized, `Inc`, `LLC`, `Ltd`, `Corp` suffixes removed) in the sender display name or the subject. The sender domain already narrows the field, so names shorter than 6 characters are allowed here. Exactly one company: step 6. Otherwise no Tier 2 link.
5. **Tier 3, company name** (`linked_by = 'company_name'`), skipped when `restricted`. The company name appears with word boundaries in the subject or the first 4,000 characters of the normalized body, and the name has at least 6 characters (after suffix removal). Exactly one company: step 6. Otherwise `none`.
6. **Pick the application within the company.** Prefer the candidate whose job title shares at least 2 normalized tokens with the subject; else `submitted` before `submitting` before ambiguous `failed`; then the most recent `coalesce(submitted_at, approved_at)`.

Only Tier 1 and Tier 2 links can lead to an offer-pause candidate (B6). Linking reads `companies.domains`, which the catalog must populate (section 13, AR-2); until it does, Tier 2 carries most domain links because most replies are sent by the ATS.

---

## 4. Concurrency, rate limits, ordering, batching and priorities, with numbers at 10,000 users

### 4.1 Queue registration

Queues are database-backed and registered after launch (S-D1 correction); `globalConcurrency` replaces `concurrency`; the queue has no `partition*` option, so enqueues pass no partition key.

```ts
// server/src/durable/queues.ts (excerpt)
await DBOS.registerQueue("email", { globalConcurrency: 8, workerConcurrency: 4 });
```

`email` is in the worker's `listenQueues` only. `ingestInboundEmail` runs on the api replica that received the webhook.

### 4.2 Numbers at 10,000 users

| Quantity | Base | Growth | Source |
|---|---|---|---|
| Stored inbound rows a day | 7,400 | 8,500 | `_db/messaging.md` 4.8 (the `reply-classifier` volume is 25% of all mail) |
| Hidden rows a day (Gmail confirmations about 130, spam about 2%) | about 280 | about 300 | messaging 5.1, [est] |
| `classifyEmail` runs a day (visible rows plus about 1% redrives) | about 7,200 | about 8,300 | |
| `reply-classifier` calls a day | 1,850 | 2,120 | `01-architecture.md` B.12.1 |
| Busiest hour (15% of a day, US morning) | about 1,100 rows (0.31 a second) | about 1,280 (0.36 a second) | [est] |
| Service time per run | rules path about 60 ms wall; model path about 1.5 s wall (p95 4 s) | | [est], verified in P6 load test |
| Concurrency needed at the busiest hour | 0.31 x (0.75 x 0.06 + 0.25 x 1.5) = about 0.13 slots | about 0.15 slots | Little's law |
| Capacity at `globalConcurrency: 8` | about 5 runs a second with every run on the model, about 130 a second rules only | | |

A Postmark backlog after an api outage (10 hours of retries collapsing into the 1 h and 2 h retry slots) delivers at most about 3,500 messages in an hour; the queue drains that in under 12 minutes even if every message needed the model, so SLO S8 (99% classified within 10 minutes) is missed only during such a replay, which the alert A-INBOUND-1 already covers.

### 4.3 Rate limits

| Limit | Value | Where |
|---|---|---|
| Webhook flood | `webhook_ip` 600 a minute per client IP, fails open | 05-api 6 |
| Per-user storage | 400 rows per 24 hours | Route step 0.2 |
| Per-user model calls | Implied: at most 400 x 25% = 100 a day per user; restricted mail (score at least 5) never reaches the model | |
| Large bodies | One permit per api replica above 5 MB; 503 with `Retry-After: 5` otherwise | 05-api 2.4 |
| Anthropic | The gateway's `LLM_RPM_HAIKU` limiter and the `reply-classifier` envelope of $1 a day | 03-agent-runtime 9 |
| Per-user pipeline spend cap | `dailyModelSpendCapUsd` (Free $0.05) applies to `reply-classifier` calls under budget class `pipeline`; a refused call is `deferred` (section 13, AR-5 asks for an exemption) | 03-agent-runtime 9 |

### 4.4 Ordering

No ordering is guaranteed between two mails of one user, and none is needed: the classification of one row touches only that row; the stage update is a forward-only maximum (commutative for every pair except a later re-invitation after a rejection, which stays `rejected` because `rejected` is final by design); events and notifications are keyed by email; one pending offer candidate per user is enforced by a unique index. The queue is therefore not partitioned by user, which saves a partition registration per user and keeps all 8 slots available to a backlog of one heavy user.

### 4.5 Batching and priorities

None. Each email is one workflow. The Message Batches API is not used: it is not covered by zero data retention and email excerpts are personal data (03-agent-runtime 10.5, `batchEligible: "never"`). The queue has no priorities; inbound storage is never shed (B.11.3), and classification is shed only through the gateway's shed levels, which turn model calls into `deferred` rows while rule tagging, linking, stage and events continue.

---

## 5. Retries, backoff, timeouts, dead-letter handling, poison messages and compensation

### 5.1 Timeouts

| Unit | Timeout | On expiry |
|---|---|---|
| Route | `server.requestTimeout` 120 s; typical under 200 ms | Postmark retries |
| `ingestInboundEmail` | 5 s (`timeoutMS: 5_000`) | The route answers 503; Postmark retries; on redelivery step 0.6 starts the same workflow id |
| `classifyEmail` | 120 s (`timeoutMS: 120_000`) | Workflow `CANCELLED`; the reconciler redrives with a new id |
| Model budget inside step A | `deadlineAt = start + 90 s`; no call starts with less than 25 s left; the agent's own timeout is 20 s with up to 2 SDK retries | `deferred` |

### 5.2 Retries and backoff

| Failure | Retry | Backoff |
|---|---|---|
| Transient Postgres errors in step A (connection reset, `57P01`, pool timeout) | DBOS step retry, `maxAttempts: 3` | 2 s, 4 s |
| Serialization or deadlock in step B (`40001`, `40P01`) | The datasource wrapper retries once (02-database 5.1) | immediate |
| Any other error in step B (check violation, guard trigger) | None in the run; the workflow ends `ERROR`; the reconciler redrives | reconciler schedule |
| Anthropic transient errors | Inside the gateway only (03-agent-runtime 5); never a step retry, so a model outage costs at most one gateway retry ladder per run | gateway full jitter |
| Model deferred | Reconciler `model_only` re-run | 1 h, 2 h, 3 h, 4 h, 5 h, 6 h after classification (covers about 21 hours, which crosses a UTC midnight budget reset) |

### 5.3 Errors inside DBOS

Steps throw `KairosStepError(code)` with codes from this set: `decrypt_failed`, `row_shape_invalid`, `db_unavailable`, `link_query_failed`. Third-party messages and stacks go to Sentry with redaction and are never rethrown into DBOS, so a checkpointed error carries no text (B.5.6).

### 5.4 Dead letter and poison messages

The dead-letter store is the row itself, not a separate queue: a row whose classification failed 6 times holds `classify_attempts = 6` and gets the poison fallback.

| Case | Detection | Handling |
|---|---|---|
| Body cannot be decrypted (missing key version, corrupt ciphertext) | `decrypt_failed` after 3 step attempts | Redriven up to 6 times (a key rollout can be in progress); then the fallback |
| Any deterministic crash on one message (parser bug on a pathological body) | Workflow `ERROR` with the same code repeatedly | Same |
| Poison fallback | `reconcile-inbox` finds `classified_at IS NULL AND classify_attempts >= 6` | `UPDATE inbound_emails SET linked_by = 'none', classified_at = now() WHERE id = $1 AND classified_at IS NULL`: the row shows in the inbox untagged and unlinked, nothing else happens; counted `inbound.poison_total`; alert A-INBOUND-2 emails the owner with the inbound email id |
| Model returns garbage or an injection echo | `failed_final` | `kind = 'other'`; never retried |
| `ERROR` and `CANCELLED` workflows | `GET /api/admin/workflows?status=ERROR&name=classifyEmail` | Kept 14 days by `dbos-retention`, then deleted with `deleteWorkflows` (S-D1) |

### 5.5 Reconciler `reconcile-inbox` (worker schedule, every 5 minutes; replaces the "Unclassified inbound email" row of B.5.8)

One scheduled workflow, three bounded statements, each followed by enqueues with deterministic ids:

```sql
-- (a) unclassified redrive: older than 10 min x (attempts + 1), at most 200 a tick
UPDATE inbound_emails SET classify_attempts = classify_attempts + 1
 WHERE id IN (SELECT id FROM inbound_emails
               WHERE classified_at IS NULL AND classify_attempts < 6
                 AND received_at < now() - interval '10 minutes' * (classify_attempts + 1)
               ORDER BY received_at LIMIT 200 FOR UPDATE SKIP LOCKED)
RETURNING id, classify_attempts;                       -- enqueue classify:<id>:r<n>, mode "full"

-- (b) deferred model re-run, only when llm_paused and agent_disabled:reply-classifier are off and shed level < 3
UPDATE inbound_emails SET classify_attempts = classify_attempts + 1
 WHERE id IN (SELECT id FROM inbound_emails
               WHERE classified_at IS NOT NULL AND hidden_reason IS NULL
                 AND kind IS NULL AND rule_kind IS NULL AND model_kind IS NULL
                 AND classify_attempts < 6 AND (spam_score IS NULL OR spam_score < 5)
                 AND received_at > now() - interval '3 days'
                 AND classified_at < now() - interval '1 hour' * (classify_attempts + 1)
               ORDER BY received_at LIMIT 200 FOR UPDATE SKIP LOCKED)
RETURNING id, classify_attempts;                       -- enqueue classify:<id>:r<n>, mode "model_only"

-- (c) poison fallback (section 5.4), then forwarding-code mails whose notify never started:
--     notifications kind 'forwarding_code' younger than 3 days with no email_sends ('forwarding_code', entity_id) row
--     -> enqueue notify:forwarding_code:<entity_id>
```

Rows (a) need the index `inbound_emails_unclassified_idx`; rows (b) need a small partial index `inbound_emails_model_deferred_idx (classified_at) WHERE kind IS NULL AND rule_kind IS NULL AND model_kind IS NULL AND hidden_reason IS NULL AND classified_at IS NOT NULL` (section 13, AR-1). Poison-fallback rows also match (b)'s predicate but carry `classify_attempts = 6`, so they are excluded.

### 5.6 Compensation

Classification is one local transaction, so there is nothing to undo across services. The only effect with an external consequence is the offer pause, and it is a saga with a human-confirmable compensation window owned by billing: the candidate is `pending` for 48 hours, the user receives a signed undo link (`action_tokens.purpose = 'offer_pause_undo'`, minted deterministically by the `notify` step), `GET` and `POST /api/billing/offer-pause/undo` set `state = 'cancelled'`, and only `offer-pause-apply` calls Stripe (`pause_collection: { behavior: "void" }`, idempotency key `pause:<userId>:<inboundEmailId>`). A wrong stage cannot be moved backward in v1 (guard trigger); stage is advisory and changes neither `status` nor credits, so the cost of a mistake is a wrong label until the next reply.

---

## 6. State transitions it performs and the invariants it must uphold (and how)

### 6.1 Transitions this worker performs

| Entity | From | To | Writer | Condition |
|---|---|---|---|---|
| `inbound_emails` (derived state, messaging 6.2) | `stored` (`classified_at IS NULL`) | `classified` | step B mode `full` | `classified_at IS NULL` |
| `inbound_emails` | `classified` with `kind` null (deferred) | `classified` with `kind` | step B mode `model_only` | the four-null predicate |
| `inbound_emails` | `stored` | `hidden` (`forwarding_confirmation`) | step A3 safety net | parser match with DKIM evidence |
| `inbound_emails` | `stored` | `classified` (untagged, `linked_by = 'none'`) | `reconcile-inbox` poison fallback | `classify_attempts >= 6` |
| `inbound_emails.classify_attempts` | n | n + 1 | `reconcile-inbox` | below 6 |
| `profiles.forwarding_state` | `not_started`, `awaiting_verification`, `verified_pending_first_mail`, `stale` | `active` | step B3 | first visible mail with spam score below 5 |
| `profiles.forwarding_state` | `not_started`, `verified_pending_first_mail`, `stale`, `awaiting_verification` | `awaiting_verification` | route 0.3 and step A3 | Gmail confirmation |
| `forwarding_verifications` | none or older code | current code | route 0.3, step A3 | upsert |
| `forwarding_verifications` | row | deleted | step B3 | forwarding became `active` |
| `applications.stage` | null or lower rank | higher rank, or `rejected` | step B4 | linked, `kind` maps to a stage, forward only |
| `application_events` | | `reply_confirmation`, `reply_rejection`, `reply_interview`, `reply_assessment`, `reply_offer` (actor `employer`) | step B5 | linked, kind not `other` |
| `offer_pause_candidates` | | `pending` | step B6 | all six conditions of B6 |
| `notifications` | | `reply_important`, `forwarding_code` | B7, route 0.3, A3 | insert-once |

### 6.2 Invariants and how they hold

| Invariant | Mechanism here | Backstop |
|---|---|---|
| Billing pauses only on a genuine offer, never on "offer you an interview" (INV-5) | Only the deterministic `OFFER` rule yields `kind = 'offer'`; the model's `offer` becomes `other`; a candidate needs a domain link to a `submitted` application, a score below 5 and an active, unpaused subscription; 48-hour undo; Stripe is called only by `offer-pause-apply` | `inbound_emails_offer_needs_rule_ck`; `offer_pause_one_pending_uq`; golden rules file; `reply-classifier` eval bar (zero `offer` on the 40 interview-offer cases) |
| Never read a mailbox (INV-6) | The only input is Postmark posting mail sent to `profiles.forwarding_address`; no OAuth mail scope exists | Schema check (no mail tokens in `account.scope`), code review gate |
| Untrusted input (INV-14) | Subject and body are T3 data: `fence` with a per-call nonce, `DATA_RULES`, echo canary; the output is one enum and a number; its only effects are a forward-only stage, an event, an in-app notification and a tag | Gateway spy test: no `runAgent` inside billing, approval, submission or Stripe paths (03-agent-runtime 11.5) |
| Minimum data to providers (INV-15) | No sender address, no attachments, no headers; `redactContact` on the subject, `redactEmailBody` (quoted history and signatures removed, contact data replaced, the user's name replaced by `[candidate]`, 550 tokens); `metadata.user_id = userHash(userId)` | Redaction unit test; ZDR addendum before beta (P8) |
| Checkpoints carry ids only (D4) | Inputs and step outputs per section 2.2; the Gmail code never leaves step A3 or the route | `durable/pii-scan.test.ts` seeds marker strings in an inbound subject, body and a Gmail code |
| Stage never changes `status` or credits | Step B never selects `credit_balances` or writes `status`; the module cannot import billing or submission writers | Boundary lint; ledger drift invariant (nightly) |
| Reply-driven stage is forward only | Predicate in B4 | `applications_guard_stage_bu` |
| One classification per email | `classified_at IS NULL` predicate; deterministic workflow ids | `inbound_emails_classified_ck`, `inbound_emails_one_classifier_ck` |
| Events append-only | Insert-once with `dedupe_key` | `application_events_immutable_bud`, revoked `UPDATE` and `DELETE` |
| Hidden rows hold no body | Route and A3 write `hidden_reason` with null body and preview in one statement | `inbound_emails_hidden_no_body_ck` |

---

## 7. Failure modes table: cause, detection, user-visible effect, recovery

| Cause | Detection | User-visible effect | Recovery |
|---|---|---|---|
| Postmark cannot reach the api (outage, deploy) | Postmark retries; `http.requests{group=webhook}` gap; S8 burn | Replies appear late | Automatic: 10 retries over about 10 hours; after that, redeliver from the Postmark activity feed (R-INBOUND-1) |
| Wrong or rotated webhook credentials | 403 rate on the webhook group; Postmark "Inbound Error" | Replies stop appearing | Fix credentials (both URLs set for one day during rotation); redeliver from Postmark |
| Crash between route insert and workflow start | Row with `classified_at IS NULL` and no workflow | Up to 10 to 20 minutes late | Postmark retry restarts `mail:<MessageID>`; `reconcile-inbox` (a) |
| Worker crash mid-step or mid-transaction | DBOS recovery on relaunch, or `dbos-orphan-recovery` (cancel then resume) | Seconds to 2 minutes late | Step re-runs (at most one extra model call); transaction is exactly once |
| Anthropic down, kill switch, or budget refusal | `modelStatus = 'deferred'`; gauge `inbound.model_deferred` | About 25% of new replies show without a tag until the model returns; rule-tagged mail (75%) is unaffected | `reconcile-inbox` (b) with 1 to 6 hour backoff |
| Model returns `offer` | `inbound.model_offer_rejected` | Tagged `other`; no pause, no `offer` stage | Owner reviews weekly; if a real offer template is missed, extend the rule (version bump) |
| Prompt injection in the body | `injection_echo` or canary hit | Tagged `other` | Nothing else to do; counted `inbound.injection_suspect` |
| Spoofed offer text from a stranger who learned the address | Fails the domain link, or is restricted by the spam score | Possibly an untagged or `other` row | The offer path needs a domain link to a submitted application plus a 48-hour undo; the user can rotate nothing today (section 13, O-3) |
| Spoofed Gmail confirmation with a phishing link | No DKIM pass for `google.com`, or link host not allowlisted | Treated as ordinary mail, or code shown without a link | None needed |
| Mis-link to the wrong application (similar company names) | Owner sampling; user report through support | Wrong timeline entry and stage | Tier rules minimize it; ops repair through `ops_audit` (stage cannot move backward; the event stays as history) |
| `companies.domains` empty for most companies | `inbound.linked{by}` share of `company_name` and `none` high | Fewer links, fewer offer candidates (safe direction) | Catalog populates domains (AR-2); Tier 2 covers ATS mail meanwhile |
| Decrypt failure (key rollout error) | `decrypt_failed` codes; A-INBOUND-2 on fallback | Row untagged after 6 redrives | Fix `DATA_KEKS`; ops can reset `classify_attempts` and `classified_at` through an audited script to re-run |
| Flood (someone mails the address hundreds of times) | `inbound.dropped{reason="flood_cap"}` | Mail above 400 a day is not stored | Support issues a new forwarding address manually (O-3) |
| Gmail confirmation code expired before the user acted | `retention` moves `awaiting_verification` to `not_started` | The app asks the user to resend from Gmail | User re-adds the address in Gmail |
| Guard trigger raises on stage (a writer outside this path set a later stage) | Step B error `23514`; workflow `ERROR` | Row classified only after redrive | B4 predicate prevents it on this path; `recordOutcome` must not set `stage` backward (AR-6) |

---

## 8. Observability: logs, metrics, traces and alerts with thresholds

### 8.1 Logs (pino, one line per run, no content)

`msg: "inbox classify"` with `inboundEmailId`, `userHash`, `mode`, `outcome`, `ruleKind`, `modelKind`, `kind`, `modelStatus`, `modelErrorCode`, `linkedBy`, `restricted`, `stageChanged`, `offerCandidate` (boolean), `attempt` (`classify_attempts`), `durationMs`, `workflowId`. Never the sender, subject, body, code or link (pino redaction paths of 06-infrastructure 6.2 cover `*.body`, `*.text`; the module passes none of them to the logger). The route logs `msg: "inbound stored"` with `inboundEmailId`, `userHash`, `hidden`, `duplicate`, `spamBucket` (`lt5`, `5to8`, `ge8`, `none`).

### 8.2 Metrics (stored in `metrics_minute`)

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `inbound.stored` | counter | `hidden` (`none`, `forwarding_confirmation`, `spam`) | Rows inserted |
| `inbound.dropped` | counter | `reason` (`unknown_recipient`, `flood_cap`, `duplicate`) | Not stored |
| `inbound.classified` | counter | `source` (`rule`, `model`, `deferred`, `failed_final`, `fallback`), `kind` | Classification outcomes |
| `inbound.linked` | counter | `by` (`domain`, `company_name`, `none`), `tier` (`employer`, `ats`, `name`) | Link outcomes |
| `inbound.model_offer_rejected` | counter | | Model said `offer`, rules did not |
| `inbound.injection_suspect` | counter | | Echo-canary hits |
| `inbound.offer_candidates` | counter | | Pending candidates created |
| `inbound.stage_changes` | counter | `to` | Stage moves |
| `inbound.unclassified_oldest_age_s` | gauge | | Existing (06-infrastructure); oldest `classified_at IS NULL` |
| `inbound.model_deferred` | gauge | | Rows in the deferred state younger than 3 days |
| `inbound.poison_total` | counter | | Poison fallbacks |
| `inbound.classify_latency_s` | histogram | `path` (`rules`, `model`) | `received_at` to `classified_at` |
| `inbound.forwarding_codes` | counter | | Gmail confirmations stored |
| `llm.*` for `reply-classifier` | per 03-agent-runtime 12.2 | | Calls, cost, cache share, latency, schema-invalid and refusal rates |

### 8.3 Traces

The route span `POST /api/webhooks/postmark/inbound/:pathSecret` (path secret replaced by `[secret]`) links to the `ingestInboundEmail` span and, through the workflow id, to `classifyEmail`. Child spans: `inbox.classifyAndLink`, `gen_ai` span of the gateway (`kairos.agent.id = reply-classifier`, `kairos.call.kind`, `kairos.cost_usd`, `kairos.llm_call_id`), `inbox.applyClassification`. Attributes: `kairos.inbound_email_id`, `kairos.inbox.kind`, `kairos.inbox.linked_by`, `kairos.inbox.model_status`. Content capture is disabled.

### 8.4 Alerts

| Id | Condition | Window | Action | Runbook |
|---|---|---|---|---|
| A-INBOUND-1 (existing) | `inbound.unclassified_oldest_age_s` above 900 | 5 min | Email | R-INBOUND-1 |
| A-INBOUND-2 (new) | `inbound.poison_total` increases | any | Email with the inbound email id | R-INBOUND-1 |
| A-INBOUND-3 (new) | `inbound.model_deferred` above 300 | 2 h | Email (the model path is down for replies) | R-LLM, R-INBOUND-1 |
| A-INBOUND-4 (new) | `inbound.offer_candidates` over 24 h above 3 times the trailing 7-day mean and above 30 | daily | Email (possible rule regression or spoofing campaign); the owner can set `ops_flags.pause_offer_candidates` (AR-7) | R-BILL |
| A-INBOUND-5 (new) | Rule-tag share (`source = rule` over all classified) below 60% over 24 h with at least 500 rows | daily | Review (new ATS template or rules regression; also a cost signal) | R-INBOUND-1 |
| SLO S8 (existing) | 99% classified within 10 minutes | 28 days, burn-rate alerts per 06 6.6 | Page on fast burn | R-INBOUND-1 |

---

## 9. Capacity and cost at 10,000 users: runs per day, CPU and memory, model cost per day

| Item | Base | Growth | Notes |
|---|---|---|---|
| `ingestInboundEmail` runs a day | 7,400 | 8,500 | api |
| `classifyEmail` runs a day | about 7,200 | about 8,300 | worker |
| `reconcile-inbox` runs a day | 288 | 288 | every 5 minutes |
| `reply-classifier` calls a day | 1,850 | 2,120 | plus about 2% re-runs from deferral, inside the same envelope |
| Model cost a day | $0.37 | $0.42 | $0.0002 expected per call; max $0.0006; envelope $1 a day (03-agent-runtime 3.3) |
| Model cost per submitted application | $0.00002 | $0.00002 | 17,600 and 20,200 submitted a day |
| Worker CPU | about 170 CPU-seconds a day (20 ms a run: decrypt, regex on at most 16 KB, redaction, 5 queries) | about 200 | under 0.3% of one worker vCPU on average |
| Worker memory | under 10 MB for 4 runs in flight per replica (bodies at most 16 KB) | same | |
| api CPU and memory | JSON parse of typical payloads (under 200 KB) about 2 ms; the 50 MB worst case is serialized by the large-body gate (one permit per replica, about 150 MB transient heap) | same | 0.75 GB replicas (B.4.1) |
| Postgres writes a day | about 7,400 inserts, about 7,200 classification updates, about 5,500 events, about 2,000 stage updates, about 1,500 notifications [est] | about 8,500 / 8,300 / 6,300 / 2,300 / 1,700 | negligible against a 4 vCPU instance |
| Storage | 1.5 million rows with bodies at the 180-day steady state, about 1.2 GB metadata plus 5 GB bodies (messaging 4.8) | same order | |

**Checkpoint writes** (S-D1 measured costs: about 6 fixed writes per direct workflow, 7 per queued workflow, 1 per step, 2 per datasource transaction, 1 per child enqueue):

| Workflow | Writes per run | Runs a day, growth | Writes a day |
|---|---|---|---|
| `ingestInboundEmail` (direct, one enqueue) | 7 | 8,500 | 59,500 |
| `classifyEmail` (queued, one step, one transaction, enqueue on about 1% of runs) | 10 | 8,300 | 83,000 |
| Step A3 safety net, `model_only` re-runs, redrives | 10 | about 250 | 2,500 |
| `reconcile-inbox` (scheduled, 3 steps plus enqueues) | about 12 | 288 | 3,500 |
| **Total** | | | **about 148,500 a day, 7.4 per submitted application** |

That is about 13% of the about 1.1 million daily writes and 7.4 of the 55 writes per submitted application that S-D1 re-estimated (target 60, alert at 80). Section 13 (AR-8) shows how to remove 59,500 of them.

---

## 10. Security and privacy notes

- **Authentication of the webhook** is 05-api's (path secret plus Basic, constant time, TLS only, 403 stops retries). This worker trusts nothing in the payload except what the route copied: the user is resolved from the recipient address, never from payload fields.
- **Encryption.** Bodies and previews are AES-256-GCM under `DATA_KEKS`, held by api and worker only. The applier has no access to `inbound_emails` (02-database 4.2). `kairos_api` cannot update or delete `inbound_emails`, so the internet-facing role cannot rewrite the evidence that feeds an offer pause.
- **Data minimization to Anthropic.** Only for mail the rules cannot tag and that is not restricted: a redacted subject and a 550-token redacted excerpt; no sender, no attachments, no headers, no user name, no application or job ids; Messages API with zero data retention requested before beta (P8 gate); never the Batch API.
- **Third-party personal data (P4).** Recruiter names and addresses stay encrypted in Kairos, reach Anthropic only redacted, and the body is purged after 180 days (`retention`); hidden rows after 30 days. Account deletion cascades every row; `kairos_dbos` holds only ids and is cleared within 14 days.
- **The Gmail link is never fetched** (no SSRF path); its host is allowlisted and DKIM evidence is required before it is shown or emailed.
- **Prompt injection.** Fenced data, output-only schema, echo canary, and no privileged effect from the model output (section 6.2). The offer rule and the pause path are deterministic.
- **Sensitive content.** A reply may mention salary, visa status or disability accommodations. The worker only classifies it; nothing it produces answers a sensitive question or reaches an employer.
- **Spoofing.** Anyone who learns a forwarding address can send mail to it. Defenses: flood cap, spam restriction, domain-first linking (Tier 3 name links can never create a candidate), 48-hour undo with an email to the account address, and the `pause_offer_candidates` kill switch (AR-7).
- **DPDP and GDPR.** Purpose: reply tracking for the user's own applications. Export (`scripts/export-user.mjs`) includes the user's inbound rows decrypted; erasure is the account cascade plus tombstone replay after a restore.

---

## 11. Tests (unit, integration, failure injection) and acceptance criteria

### 11.1 Unit (vitest, no network)

| File | Covers |
|---|---|
| `inbox/rules.test.ts` | The skeleton's 11 cases kept; `rules-golden.jsonl` (at least 200 cases, including the 40 "offer you an interview" variants, newsletters containing "job offer", rejections that mention a future offer); `RULES_VERSION` bump required when any expected tag changes |
| `inbox/normalize.test.ts` | `stripQuoted` on Gmail, Outlook and Apple Mail reply formats; forwarded blocks kept; `originalSender` for Gmail and Outlook manual forwards, for auto-forwards (original `From` kept) and for free-mail senders |
| `inbox/link.test.ts` | Tier 1 with subdomains; free-mail never links by domain; Tier 2 for each ATS mail domain with name in the display name or subject; Tier 3 length rule ("Box", "Ramp", "Scale" never link by name alone; "Snowflake" does); two companies matching gives no link; restricted mail skips Tier 3; application choice by title tokens, then status, then recency |
| `inbox/forwarding.test.ts` | S-G1 sample parses; wrong sender, wrong subject, missing DKIM pass, non-allowlisted link host each rejected or stripped; code regex bounds |
| `inbox/stage.test.ts` | Every (old stage, kind) pair against the rank table, including `rejected` final and null start |
| `inbox/model-map.test.ts` | Every row of the A8 table: each `LlmErrorCode` maps to the stated `modelStatus` and `kind`; model `offer` becomes `other`; confidence floor |
| `durable/schemas.test.ts` | `ingestInboundEmailInput`, `classifyEmailInput`, `ClassifyStepResult` contain no free-text string |

### 11.2 Integration (Testcontainers Postgres 18, DBOS 5.3.0, `fakeAnthropic`)

1. Route to classification end to end: a forwarded Greenhouse confirmation for a `submitted` application yields `kind = 'confirmation'`, `rule_kind = 'confirmation'`, `linked_by = 'domain'`, `stage = 'in_review'`, one `reply_confirmation` event, `forwarding_state = 'active'`, `forwarding_verifications` row deleted.
2. Ten concurrent deliveries of one `MessageID`: one row, one `classifyEmail` run, one event.
3. Kill the api process between the insert and the workflow start: the reconciler classifies the row within 20 minutes; with a simulated Postmark retry, within one minute.
4. Kill the worker inside step A and inside step B (S-D1 harness): the row is classified exactly once; at most one extra `llm_calls` row.
5. `forkWorkflow(id, 0)` of a completed `classifyEmail` (T-DB-10): zero business changes.
6. Offer path: a rule-tagged offer from the employer domain on a `submitted` application of an active subscriber creates one `pending` candidate and starts `notify:offer_pause_notice:<id>`; the same text linked by company name, from a restricted score, to a `submitting` application, for a Free user, or for a user with `applications_paused_at` set creates none; a second offer mail for the same user while one is pending creates none.
7. Model path: rules miss, `fakeAnthropic` returns `interview` at 0.9, the row gets `model_kind = 'interview'`, `kind = 'interview'`, a `reply_important` notification; returns `offer` at 0.99: `kind = 'other'`, no candidate, no stage change.
8. Deferred path: `llm_paused` on; the row is classified with `kind` null; flag off; `reconcile-inbox` (b) sets the kind within the first backoff window without touching link or forwarding state.
9. Gmail confirmation via the route and via the step A3 safety net: hidden row without body, code stored, `notify:forwarding_code:<id>` sent once; status route returns the code.
10. Ambiguous failure: a confirmation linked to a `failed`/`unconfirmed` application sets `stage = 'in_review'`, creates the `confirmation_for_unconfirmed` notification, and leaves `status`, `credit_ledger` and `credit_balances` unchanged; a later `recordOutcome` late confirmation keeps `stage = 'in_review'` (AR-6).
11. `pii-scan`: markers in subject, body, sender and a Gmail code never appear in `kairos_dbos`, logs, traces or Sentry events.
12. Grants: run the worker paths as `kairos_worker` and the route as `kairos_api` (T-12 matrix); the api cannot `UPDATE inbound_emails`.

### 11.3 Failure injection

| Injection | Expected |
|---|---|
| Anthropic 529 for 30 minutes | Rule-tagged mail unaffected; model rows deferred, then tagged after recovery; no `ERROR` workflows |
| `DATA_KEKS` missing the key version of 5 rows | 6 redrives each, then poison fallback; A-INBOUND-2 fires; other rows unaffected |
| Deadlock injected in step B | One retry; classified once |
| Postgres restart during a burst of 1,000 deliveries | All rows classified within 15 minutes of recovery; zero duplicates |
| Injection corpus (50 bodies telling the model to answer `offer` or to change format) | Zero `kind = 'offer'`, zero candidates; echo-canary hits counted |
| Pathological body (16 KB of nested quote markers, invalid UTF-8, 10,000 "From:" lines) | `classifyAndLink` under 50 ms CPU; no crash |

### 11.4 Acceptance criteria

1. Zero offer-pause candidates from model output, from Tier 3 links, or from restricted mail, across the integration suite and the eval set.
2. Zero `offer` tags on the 40 "offer you an interview" cases (rules and model).
3. Linking precision at least 0.97 and recall at least 0.80 on a labelled set of 300 forwarded replies from the beta sample [measured in P6]; "Box", "Ramp", "Scale" cases never mislink.
4. `reply-classifier` macro F1 at least 0.90 on its 400-case eval set (B.9.10).
5. S8: 99% of rows classified within 10 minutes over a 7-day staging soak at growth volume replayed from fixtures.
6. Duplicate deliveries, crashes and forks never produce a second event, notification or candidate.
7. No personal text in `kairos_dbos`, logs, traces or Sentry (pii-scan green).
8. Model spend for this agent at or below $0.50 a day at growth volume in the P8 load test.

---

## 12. Migration from the skeleton: which files it replaces and what is kept

| Skeleton | Fate |
|---|---|
| `server/src/services/email-classifier.ts` `classifyByRules` | **Kept byte-for-byte**, moved to `server/src/modules/inbox/rules.ts` with `RULES_VERSION = 1`; `senderDomain` replaced by `originalSender` and the suffix match in `link.ts` |
| `server/test/email-classifier.test.ts` (11 cases) | Kept, moved to `inbox/rules.test.ts`, extended by the golden file |
| `server/src/jobs/classify-email.ts` `processClassifyEmail` | **Replaced** by `classifyEmail`. During the drain it becomes a forwarder: the BullMQ consumer only starts DBOS `classifyEmail` with id `classify:<inboundEmailId>` and returns. This removes the direct `pauseForOffer` call (D-26) on the first deploy of P2, so no queued job can pause billing |
| Substring company-name linking | Replaced by the three tiers of section 3.5 |
| `pauseForOffer` called from the classifier | Removed; billing's `offer-pause-apply` is the only caller of Stripe pause |
| `POST /api/webhooks/inbound-email?token=` in `server/src/routes/webhooks.ts` | Kept one week (05-api 14.4), then deleted with `INBOUND_WEBHOOK_SECRET`; it calls the same `storeInboundEmail` and workflow |
| `inbound_emails.text_body` plaintext | Encrypted by the messaging backfill (messaging 10.3); dropped in the contract release |
| BullMQ queue `classify-email` | Drained in P2 (02-database 14.5 order: `cloud-apply`, `classify-email`); removed with Redis in P7 |

Phases:

| Phase | Delivered here | Exit |
|---|---|---|
| P1 | The path-secret route (05-api) storing rows and enqueueing BullMQ as before | Route contract tests green |
| P2 | `ingestInboundEmail`, `classifyEmail` (rules only; `agent_disabled:reply-classifier = true`), linking tiers, stage, events, offer-pause candidates with undo, `reconcile-inbox` (a) and (c), forwarder shim; BullMQ `classify-email` drained | Integration tests 1 to 6, 10 to 12 green; `messaging_02_constraints` (`_offer_needs_rule_ck` and friends) applied after the drain and backfill B-13 |
| P6 | `reply-classifier` (eval gate), deferral and `reconcile-inbox` (b), Gmail confirmation parser with S-G1, `forwarding_state` transitions, `notify:forwarding_code`, notifications `reply_important` | Tests 7 to 9 and all failure injections green; acceptance criteria 3 to 5 on the beta sample |

Deviation from `01-architecture.md` B.14: domain-first linking, the reply-driven stage and the event writes move from P6 to P2, because the P2 offer-pause candidate requires a domain link and removing the skeleton's direct pause in P2 must not leave offers undetected. The model, the Gmail flow and the forwarding states stay in P6.

---

## 13. Additions requested: anything this worker needs that the foundation documents lack (or "none")

| Id | To | Request | Why |
|---|---|---|---|
| AR-1 | `02-database.md` 7.5.1 | Add `inbound_emails.classify_attempts smallint NOT NULL DEFAULT 0 CHECK (classify_attempts BETWEEN 0 AND 6)` (constant default, no rewrite; `kairos_worker` already has `U`), and the partial index `inbound_emails_model_deferred_idx ON inbound_emails (classified_at) WHERE kind IS NULL AND rule_kind IS NULL AND model_kind IS NULL AND hidden_reason IS NULL AND classified_at IS NOT NULL` | Deterministic redrive ids (a terminal DBOS workflow id cannot be re-run), poison bound, deferred-model sweep |
| AR-2 | `04-matching.md` / catalog seed and `05-api.md` 16 | Populate `companies.domains` from the seed file (careers and mail domains per board) and on `POST /api/jobs/import` when the posting page names one; let `PATCH /api/admin/companies/:id` (or the existing admin companies route) set `domains`; a weekly owner report lists the 50 most frequent sender domains of `company_name`-linked replies as candidates | Tier 1 linking and offer candidates depend on it |
| AR-3 | `05-api.md` 14.3 `postmarkInboundSchema` | Read the `Authentication-Results` header (besides `X-Spam-Score`) into a boolean `dkimPassGoogle` passed to `parseGmailForwardingConfirmation`; header name and format pinned in spike S-G1 | Prevents spoofed confirmations from making Kairos email a phishing link |
| AR-4 | `02-database.md` 5.1 lock table | The `classifyEmail` row takes rank 2 (`profiles`, only when the forwarding state changes) before rank 5 | Step B3 updates `profiles` in the same transaction as the stage |
| AR-5 | `03-agent-runtime.md` 9 | Exempt `reply-classifier` calls from the per-user `dailyModelSpendCapUsd` (they stay inside the agent envelope and global limits); worst case about $0.06 per user a day under the flood cap | A user who spent the scoring cap should still get replies tagged the same day; without the exemption the call is deferred to after the UTC midnight reset, which the 1 to 6 hour backoff covers |
| AR-6 | `submission-settlement` worker and `_db/applications.md` 6 | `recordOutcome` sets `stage = COALESCE(stage, 'applied')` instead of `stage = 'applied'` | A reply linked to a `submitting` or ambiguous-`failed` application can set a later stage first; an unconditional `'applied'` would raise `23514` in `applications_guard_stage` and fail the charge transaction |
| AR-7 | `02-database.md` `ops_flags` catalogue and `05-api.md` admin flags | New fixed key `pause_offer_candidates`: when on, step B6 creates no candidate (counted `inbound.offer_candidates_suppressed`) | Kill switch for a rule regression or a spoofing campaign without touching billing |
| AR-8 | `01-architecture.md` B.5.4 and `05-api.md` 14.3 (optional, measured trigger) | When `durable.checkpoint_writes_per_submitted` exceeds 60 for a week, drop the `ingestInboundEmail` wrapper: the route starts `classifyEmail` (or `notify`) on its queue directly with the same deterministic ids. The route has already committed the row, so durability is unchanged | Saves about 59,500 checkpoint writes a day (2.9 per submitted application) |
| AR-9 | `06-infrastructure.md` 6.7 | Add alerts A-INBOUND-2 to A-INBOUND-5 and the metrics of section 8.2 to the catalogue | Section 8.4 |
| AR-10 | Agent spec `agents/reply-classifier` | Input `{ subject: string (300 chars, redacted), excerpt: string (550 tokens, redacted) }`, output `{ kind: EmailKind, confidence: number 0..1 }`; the worker applies the 0.6 floor and the `offer` rejection; the eval set includes the 40 interview-offer cases, 50 injection cases and forwarded-thread cases with quoted history | Contract between this worker and the agent |

Open items with the default this document implements:

- **O-1** Spam thresholds 5 and 8 are SpamAssassin-style defaults; re-tune on the beta sample (relayed ATS mail commonly scores 2 to 4).
- **O-2** A rule-tagged, domain-linked confirmation for an `unconfirmed` application is not treated as a late confirmation (no charge). Default: notify the user only. The owner may later allow it to call `recordOutcome` late confirmation.
- **O-3** No route rotates a leaked forwarding address. Default: support rotates it by hand (new `profiles.forwarding_address`; old address mail returns 200 and is not stored).

### Places changed because of spike S-D1

1. Queue `email` is registered with `await DBOS.registerQueue("email", { globalConcurrency: 8, workerConcurrency: 4 })` after launch, not `new WorkflowQueue`, and uses `globalConcurrency` instead of `concurrency` (section 4.1).
2. No `partitionQueue` option; the `email` queue has no `partition*` limit, so enqueues pass no partition key (section 4.1, 4.4).
3. The DBOS SDK is imported with a default import (`import dbosSdk from "@dbos-inc/dbos-sdk"`) because the packages are CommonJS (section 3.1).
4. Every write path of `classifyEmail` is state-conditional (rule D1 is mandatory because `forkWorkflow` replays from step 0); integration test 5 forks a finished run (sections 2.3, 11.2).
5. Retention of `ERROR` and `CANCELLED` runs uses `deleteWorkflows` through `dbos-retention`, not a garbage-collection call (section 5.4).
6. Orphaned runs are recovered by cancel then resume (no public recover-for-other-executors call) (section 7).
7. Checkpoint arithmetic uses the measured costs (about 6 fixed writes direct, 7 queued, 1 per step, 2 per datasource transaction), giving about 148,500 writes a day and 7.4 per submitted application against the target of 60 and alert of 80 (section 9), and the optional AR-8 saving.
8. Redrives use new deterministic ids (`classify:<id>:r<n>`): S-D1 check 3 confirmed that a second start of an existing workflow id returns the first execution instead of running again, so a reused id could never re-run a failed or cancelled classification (sections 2.3, 5.5).
