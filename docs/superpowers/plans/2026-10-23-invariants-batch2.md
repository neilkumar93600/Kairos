# Invariants Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix audit defects D-07, D-08, D-11, D-19, P-03 and P-05: approval only of tailored drafts, no credit overspend under concurrent approvals, no cloud submit after a withdraw, no mass job closing on an empty board response, no webhook secret in logs, and a 400 for malformed inbound mail.

**Architecture:** Each fix sits in the function that owns the invariant, so every caller gets it. Database invariants are proven with integration tests on a disposable Postgres (`server/test/helpers/test-db.ts`, skipped unless `TEST_DATABASE_URL` is set).

**Tech Stack:** Node 22, TypeScript 5.9, Express 5.3, Drizzle 0.45 on Postgres 17, pino-http, Vitest 5, supertest.

**Spec:** `docs/superpowers/specs/2026-10-15-kairos-backend-design/_research/as-built.md` §7.1 (D-07, D-08, D-11, D-19) and §7.3 (P-03, P-05).

## Global Constraints

- No git commands (shared checkout, see `2026-10-23-billing-facts-correctness.md`). No schema change, no migration, no package.json change.
- Route paths, fields and error codes stay as they are (`invalid_body` 400, `payment_required` 402).
- Files: `services/submissions.ts`, `jobs/cloud-apply.ts`, `jobs/poll-boards.ts`, `lib/logger.ts`, `app.ts` (pinoHttp line), `routes/webhooks.ts` (inbound route), new tests.

## Review Focus

1. Two browser tabs approve different drafts at the same instant with credits for one: exactly one approval succeeds, the other gets 402. Pinned in Task 1.
2. A draft whose tailoring failed (empty `resume_lines`) is approved together with good ones: only the good ones move to approved. Pinned in Task 1.
3. The user withdraws while the cloud job is queued: the applier never opens the form. Pinned in Task 2.
4. A board API answers 200 with zero postings during an outage: no job is closed. Pinned in Task 3.
5. Postmark posts a payload missing `MessageID`: 400, not 500 (no provider retry storm). Pinned in Task 4.

---

### Task 1: Approval invariants (D-07, D-08)

**Files:** Modify `server/src/services/submissions.ts` (`approveApplications`). Test: `server/test/submissions.int.test.ts` (`testDb("submissions")`).

- [ ] Failing tests: `only tailored drafts are approved` (drafts A with one resume line and B with `[]`, credits 5; `approveApplications(db, user, [A, B], "extension")` returns `[A]`, B stays `draft`); `concurrent approvals cannot overspend credits` (credits 1, two tailored drafts, two `approveApplications` calls started together; exactly one resolves `[id]`, the other rejects with status 402).
- [ ] Run `TEST_DATABASE_URL=postgres://kairos:kairos@localhost:55432/kairos_test npm test -w @auto-career/server -- test/submissions.int.test.ts`. Expected: both FAIL.
- [ ] Implement: first statement in the approve transaction is `select pg_advisory_xact_lock(hashtext(userId))`; the update's where adds `jsonb_array_length(resume_lines) > 0`.
- [ ] Run it. Expected: PASS.

### Task 2: Conditional claim for the cloud applier (D-11)

**Files:** Modify `server/src/services/submissions.ts` (new `claimForCloud`), `server/src/jobs/cloud-apply.ts:36-38`. Test: `server/test/submissions.int.test.ts`.

**Interfaces:** Produces `claimForCloud(db: Db, applicationId: string): Promise<boolean>` (one conditional `UPDATE ... WHERE status = 'approved' AND channel = 'cloud' RETURNING id`).

- [ ] Failing tests: `claims an approved cloud application once` (first call true and status `submitting`, second call false); `never claims a withdrawn application` (false, status stays `withdrawn`).
- [ ] Run. Expected: FAIL, `claimForCloud` not exported.
- [ ] Implement; `processCloudApply` returns `{ skipped: true }` when the claim is false, replacing the unconditional update.
- [ ] Run. Expected: PASS.

### Task 3: Empty board response closes nothing (D-19)

**Files:** Modify `server/src/jobs/poll-boards.ts` (extract and export `closeMissingJobs(db: Db, companyId: string, openIds: string[]): Promise<number>`). Test: `server/test/poll-boards.int.test.ts` (`testDb("poll_boards")`).

- [ ] Failing tests: `an empty board response closes nothing` (two open jobs, `closeMissingJobs(db, c, [])` returns 0, both open); `closes only postings missing from a non-empty board` (`["ext-a"]` closes `ext-b` only).
- [ ] Run. Expected: FAIL, not exported.
- [ ] Implement; `pollCompany` calls it. Ruling recorded: an empty board is treated as transient.
- [ ] Run. Expected: PASS.

### Task 4: Webhook hygiene (P-03, P-05)

**Files:** Modify `server/src/lib/logger.ts` (export `redactUrl(url: string): string`), `server/src/app.ts` (pinoHttp `serializers.req` uses it), `server/src/routes/webhooks.ts` (inbound `safeParse`, 400 `invalid_body`). Test: `server/test/webhook-hygiene.test.ts`.

- [ ] Failing tests: `redactUrl` of `/api/webhooks/inbound-email?token=abc&x=1` gives `/api/webhooks/inbound-email?token=[redacted]&x=1`, and a URL without a query is unchanged; supertest `POST /api/webhooks/inbound-email?token=test-inbound-secret` with `{}` returns 400 with `error.code === "invalid_body"`.
- [ ] Run `npm test -w @auto-career/server -- test/webhook-hygiene.test.ts`. Expected: FAIL.
- [ ] Implement.
- [ ] Run, then the whole suite with `TEST_DATABASE_URL`. Expected: new tests pass; failures outside these files are reported, not fixed.
