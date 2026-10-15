# Kairos backend re-architecture: requirements and invariants register

Date: 2026-10-15 · Scope: backend only (`server/`, `shared/` additive types). `web/` and `extension/` are frozen.

Sources read in full:

| Short name | File |
| --- | --- |
| PRD | `docs/01-prd.md` (last updated 2026-10-13) |
| TRD | `docs/02-trd.md` (2026-10-13) |
| FLOW | `docs/03-app-flow.md` (2026-10-13) |
| SCHEMA | `docs/05-backend-schema.md` (2026-10-13) |
| PLAN | `docs/06-implementation-plan.md` (build status 2026-10-13) |
| PRICING | `docs/pricing.md` (2026-10-13) |
| DECISIONS | Locked decisions and invariants relayed in the 2026-10-15 task text (not a file in the repo) |

Stable id rules: FR-n, AC-n (PRD acceptance criteria, numbered as in PRD), T-n (PLAN tasks), NFR-n, INV-n, OQ-n. Ids never get reused. Where a source conflicts with another source, the conflict is listed in section 7 and is not silently resolved.

---

## 1. Functional requirements (FR)

Each FR states the behavior the backend must provide. The source column names the document section.

| ID | Requirement | Source |
| --- | --- | --- |
| FR-1 | Sign-up creates, in one transaction: the `user` and password `account`, a `profiles` row (onboarding_step `resume`, unique forwarding address `u-<id8>-<hex8>@replies.kairos.app`), a `subscriptions` row with plan `free`, and a `credit_ledger` row with reason `free_grant` and delta +25. An email OTP is sent. | SCHEMA "Authentication flow" 1; AC-1; PRD core features |
| FR-2 | Sign-in with email and password (10+ characters) and with Google OAuth when `GOOGLE_CLIENT_ID` is set. Password reset by 6-digit email OTP (`forget-password` type, then reset). No magic links. | TRD "Authentication and roles"; FLOW "Entry points" (OTP typed in) |
| FR-3 | Email verification is required before any session is granted for password sign-in. Protected API routes return 403 `email_unverified` for an unverified user. | AC-2; SCHEMA "Authentication flow" 2-3 |
| FR-4 | Sessions are database sessions with 30-day expiry, refreshed daily, cookie `better-auth.session_token` (Secure in production). | TRD "Authentication and roles"; SCHEMA 5 |
| FR-5 | Extension connection: the web app creates a 5-minute one-time token (cookie session), the extension verifies it and receives a bearer session token (`bearer` plugin). Endpoints: `one-time-token/generate`, `one-time-token/verify`. | TRD; SCHEMA "Authentication flow" 6 |
| FR-6 | Account deletion (`delete-user`) removes the user and cascades to profile, facts, applications, ledger, replies, sessions, subscriptions, and deletes stored files under `uploads/{userId}/` and `resumes/{userId}/` in the same request. | SCHEMA "Retention and deletion"; PLAN T-3 Step 1; FLOW "Delete account" |
| FR-7 | Resume intake, paste route: resume text of 200 to 60,000 characters is accepted, returns 202 and queues `parse-resume`. Errors are inline (plan limit, length). | FLOW "Actions" (Save resume); SCHEMA "Data validation" |
| FR-8 | Resume intake, file route (T-3): `POST /api/profile/resumes/upload`, multipart field `file` plus `name`, PDF or DOCX only, 5 MB limit, stored in a private S3-compatible bucket at `uploads/{userId}/{resumeProfileId}.{pdf|docx}`. A `.png` returns 415. A file with no text layer returns 422 `unreadable_resume` with message "We could not read text from this file. Upload a PDF exported from a document, or a DOCX." and writes no rows. | PLAN T-3 |
| FR-9 | Resume profiles per user are limited by plan: 1 (Free, Starter), 3 (Pro), 10 (Max). Exceeding returns 403. | PRICING "Plans"; FLOW "Blocked states"; SCHEMA 2 |
| FR-10 | Parsing turns resume text into `facts` (kind in role, project, skill, metric, education, certification; text 3 to 400 characters; `source_span` optional). Facts start unconfirmed. Only confirmed facts are used for tailoring and answers. The user can confirm, confirm all, or remove each fact. | SCHEMA "facts"; FLOW "First-use journey" 2 and "Actions" (Confirm fact) |
| FR-11 | Fit preferences (`preferencesSchema`): 1 to 10 roles, at least one seniority, work authorization, locations, salary floor, excludes, fit bar 50 to 95 (default 75), per-company cap 1 to 5 (default 2 per 30 days). Saving sets onboarding to `done`. | SCHEMA "Data validation"; PLAN Global Constraints; FLOW "First-use journey" 4 |
| FR-12 | Work authorization values: `citizen_or_pr`, `opt_stem_opt`, `needs_sponsorship_later`, `needs_sponsorship_now`. These drive the sponsorship filter and the fixed answer table. | PLAN T-6 table |
| FR-13 | Company polling: `poll-boards` reads public Greenhouse, Lever and Ashby boards (no keys), inserts new `jobs` by unique (company_id, external_id), sets `last_polled_at` and `last_poll_error`, sets `companies.active = false` on a 404 board, and queues `score-matches` per new job. Priority companies poll every 5 minutes, others every 30 minutes. | TRD "External services"; SCHEMA "companies", "jobs"; PRD core features |
| FR-14 | `apply_url` is normalized per ATS: Greenhouse embed form URL (not the employer careers page), Lever `/apply`, Ashby `/application`. | SCHEMA "jobs"; AC-15; TRD "Key technical decisions" |
| FR-15 | Job description HTML is stripped and entity-decoded into `description_text`. Salary is stored as yearly USD integers when the board publishes it. Closed postings set `closed_at`. | SCHEMA "jobs" |
| FR-16 | Company seed: `server/seeds/companies.json` (about 2,000 name, ats, board_token entries) is validated by fetching each board once; only boards returning 200 are inserted; upsert on (ats, board_token); `npm run db:seed`. | PLAN T-2; SCHEMA "Migration and seed data"; PRD open questions |
| FR-17 | Fit gate runs before any model call, per user and per job, in this order: (a) seniority: title more senior than preferences, (b) sponsorship: user needs sponsorship and posting says it cannot sponsor, (c) per-company cap: at most N applications to the same company in 30 days, (d) other hard filters (locations, excludes, salary floor, remote, roles). A job failing any hard filter is stored with `passed_filters = false` and a reason, and no model call is made. | PRD AC-3, AC-4, AC-5; PLAN Global Constraints; PRD core features "Fit gate" |
| FR-18 | Model fit score (fast tier) runs only for jobs that pass FR-17. It returns a score 0 to 100 and written `reasons` (string array). Matches store `score`, `reasons`, `passed_filters`. Only matches at or above the user's fit bar (default 75) get status `new` and reach the feed. | TRD "Data flow" 2; PLAN Global Constraints; SCHEMA "matches" |
| FR-19 | Match statuses: `new`, `queued`, `skipped`, `expired`. Skip removes a match from the feed. A match is unique per (user, job). | SCHEMA "matches", "Enums"; FLOW "Alternate journeys" (Skip) |
| FR-20 | Feed API lists matches for the session user with the fit reasons. | FLOW "Screen inventory" (`/matches`); PRD story 2 |
| FR-21 | Prepare draft: owner-only, from an owned match. Creates `applications` row (status `draft`, unique per (user_id, job_id)) and queues `tailor-application`. Buttons disabled while pending. | FLOW "Actions" (Prepare draft); SCHEMA "applications" |
| FR-22 | Truth-locked tailoring: `resume_lines` are JSON lines, each citing one or more confirmed fact ids owned by the same user. Lines that cite unknown or unowned ids are dropped or rejected; saving a draft with such a line returns 422 `truth_lock` and stores nothing. The verifier (INV-7) checks each cited line. | PRD AC-6; PRD goal (truth lock violations 0); PLAN Global Constraints; DECISIONS 4 |
| FR-23 | Custom question answers (T-6): for each form question the rules apply in this fixed order: (1) an approved saved answer with the same `questionKey`; (2) the sensitive table, with no model call; (3) model answer for text, textarea and select only, with facts passed as `{id, text}` and every returned `factIds` required to be in the confirmed set; a select answer must match an option or it is blank; file questions other than resume and cover letter stay blank. | PLAN T-6 "Fixed rules"; PLAN Review Focus 4; DECISIONS invariant "EEO ... never answered by a model" |
| FR-24 | Sensitive table (T-6): `workAuthorization` maps to "Authorized to work in the US?" and "Will you need sponsorship?" answers as listed in PLAN T-6 (citizen_or_pr: Yes/No; opt_stem_opt: Yes/Yes; needs_sponsorship_later: Yes/Yes; needs_sponsorship_now: No/Yes). EEO questions pick the option matching `/decline\|prefer not\|don.t wish\|not to (?:say\|disclose)/i`, else blank. Salary takes `salaryFloorUsd` as a whole number, else blank. | PLAN T-6 |
| FR-25 | Sensitive classification (`classifySensitive(label)`) returns `eeo`, `work_authorization`, `sponsorship`, `salary` or null. The table of test labels in PLAN T-5 is the minimum behavior: "Will you now or in the future require sponsorship?" gives `sponsorship`; "Are you legally authorized to work in the United States?" gives `work_authorization`; "Desired salary" gives `salary`; "Veteran status" gives `eeo`; "Why this team?" gives null. | PLAN T-5 |
| FR-26 | Required-answer gate: `missingRequired(questions, answers)` lists required questions with blank answers. Approval refuses with 422 `required_answers_missing` and `{ applicationIds }`, changing no status. | PLAN T-6 Interfaces, Review Focus 4 |
| FR-27 | Form question scanning (T-5): Greenhouse questions via `boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}?questions=true` (including `compliance` and `demographic_questions`); Lever and Ashby questions via queue `scan-form` run by the applier, using the filler's `window.__autoCareerScan`. A 404 from the questions endpoint, or a closed-page match, sets `jobs.closed_at`, moves the application to `failed` with reason "This posting has closed", expires the match and charges nothing. | PLAN T-5 |
| FR-28 | Saved answers (answer memory, T-8, plans with `answerMemory`: Starter, Pro, Max): after a successful submit, non-sensitive, non-profile answers are proposed as `approved = false` rows (unique (user_id, question_key), `onConflictDoNothing`). Labels containing the company name are skipped. An approved row is used on the next draft. `DELETE /api/profile/answers/:id` returns 404 for other users' rows. | PLAN T-8; SCHEMA "saved_answers" |
| FR-29 | Cover letters (T-9, Starter, Pro, Max): `writeCoverLetter` returns at most 4 paragraphs and 250 words, each with `factIds`; paragraphs failing the truth lock are dropped; stored as `applications.cover_letter`. Free plan never calls the model for a letter. A required letter on Free approval returns 422 `cover_letter_required` with the message "This form needs a cover letter. Write one, or upgrade to Starter for tailored letters." | PLAN T-9; PRICING "Plans" |
| FR-30 | Tailored resume PDF (T-4): `renderResumePdf` produces a one-page, single-column ATS-friendly PDF (name 18 pt, contact 10 pt, headings 11 pt, lines 10 pt, 0.6 in margins, Inter embedded) at storage key `resumes/{userId}/{applicationId}.pdf`, recorded as `receipt.resumeKey` on submit. `GET /api/extension/applications/:id/resume.pdf` is bearer-authenticated and owner-only (404 otherwise). The extension and the applier receive the bytes as `resumePdf: { fileName, bytesBase64 }`. | PLAN T-4 |
| FR-31 | Draft editing: `PATCH` of an application is allowed only while `draft`. Every edit re-runs the truth lock on resume lines and cover letter paragraphs. 422 responses list the offending lines. | FLOW "Actions" (Edit draft); SCHEMA "applications" authorization |
| FR-32 | Approval: `approveApplicationsSchema` takes at most 50 application ids and a channel (`extension` or `cloud`). Checks, in order: owner; status is `draft`; available credits (balance minus approved or submitting applications) are at least the number approved, else 402 with no status change; the cloud channel needs Pro or Max, else 403 "The cloud applier is on Pro and Max"; required answers (FR-26); cover letter (FR-29). Approved rows get `channel`, `approved_at` and status `approved`. | PRD AC-7, AC-8; SCHEMA "Business rules"; FLOW "Actions" (Approve) |
| FR-33 | Withdraw: the owner can withdraw an application before it is sent. Scope conflict between FLOW (draft or approved) and SCHEMA (owner while draft); see OQ-9. | FLOW "Alternate journeys"; SCHEMA "Authorization rules" |
| FR-34 | Extension claim lease (T-7): `POST /api/extension/claim` with `{ applicationId }` does one conditional `UPDATE ... WHERE status = 'approved' RETURNING id`, sets status `submitting` and `lease_expires_at = now() + 10 minutes`, returns 200 `{ claimed: true }`, or 409 `already_claimed`. The sweeper `expire-claims` runs every minute and moves expired leases to `failed` with reason "No report from the extension within 10 minutes. Check for the employer's confirmation email before you resend." and no charge. | PLAN T-7; PLAN Review Focus 2 |
| FR-35 | Resend: `POST /api/applications/:id/resend` moves `failed` to `approved` and returns 402 when no credits are available. | PLAN T-7 |
| FR-36 | Extension queue: `GET /api/extension/queue` lists approved applications for the side panel (Send or Review). Review mode fills and stops; the user presses the employer's submit button. | FLOW "Screen inventory", "Alternate journeys" |
| FR-37 | Submission report (`submissionReportSchema`): status `submitted` or `failed` with a reason. `submitted` writes exactly one `credit_ledger` row with reason `submission` and delta -1, guarded by the partial unique index on (application_id, reason), and sets `submitted_at` and receipt. `failed` writes no credit row and stores `failure_reason`. A second `submitted` report charges nothing more. | PRD AC-9, AC-10; SCHEMA "credit_ledger"; PLAN Global Constraints |
| FR-38 | Form filler (single bundle `extension/dist/filler.js`, used by the extension and by the cloud applier, unchanged in this program): it must refuse to click submit when required fields are empty and must report the count of empty required fields. | PRD AC-11; TRD "Key technical decisions"; DECISIONS 2 |
| FR-39 | Receipt: lists the filled fields, confirmation text, channel, `resumeKey` and the time. Shown on `/applications/[id]`. | SCHEMA "applications" (`receipt`); PRD core features; PRD story 7 |
| FR-40 | Cloud applier (Playwright headless Chromium, queue `cloud-apply`) runs only for approved applications on Pro and Max, with the browser closed. A challenged run (reCAPTCHA or any bot check) is marked `failed` with no charge; the user resends through the extension. No CAPTCHA solving, no evasion, no proxy rotation. | PRD core features "Cloud applier"; TRD "Known constraint found in testing"; DECISIONS invariants |
| FR-41 | Application status enum: `draft`, `approved`, `submitting`, `submitted`, `failed`, `refunded`, `withdrawn`. Transitions are owned by the backend; the client cannot set `submitted`. | SCHEMA "Enums" and "Authorization rules" |
| FR-42 | Closed posting handling: a board 404 or closed-page text during submit gives status `failed`, reason "This posting has closed", `jobs.closed_at` set, match `expired`, no charge. | PLAN Review Focus 3, T-5 |
| FR-43 | Credit ledger: `delta` is +grant or -1 per submission; balance is `SUM(delta)`; available is balance minus applications in `approved` or `submitting`. Ledger rows are never updated or deleted by any user path. | SCHEMA "credit_ledger"; SCHEMA "Authorization rules" |
| FR-44 | Credit reasons: `plan_grant`, `free_grant`, `submission`, `refund_failed_submit`, `admin_adjustment`, `expiry`. The existing enum is kept; `refund_failed_submit` is reserved for a failed submit that was charged in error. | SCHEMA "Enums" |
| FR-45 | Plans and billing: Stripe Checkout for plan upgrades (`/billing?checkout=success`), customer portal for change, pause or cancel, subscription state synced from Stripe webhooks. Plans: Free, Starter ($19 monthly, $6 weekly, $45 quarterly), Pro ($39, $12, $95), Max ($79, $25, $189). Monthly, weekly and quarterly intervals. | PRICING "Plans"; FLOW "Alternate journeys"; PLAN T-18 |
| FR-46 | Invoice grant (Stripe `invoice.paid`): credits granted per plan and interval: monthly = applications per 30 days (Starter 400, Pro 1,200, Max 3,000); weekly = `ceil(applicationsPerCycle × 7 / 30)` (Starter 94, Pro 280, Max 700); quarterly = three cycles (Starter 1,200, Pro 3,600, Max 9,000). Exactly one grant per Stripe invoice (partial unique on `stripe_invoice_id`). | PRD AC-14; PRICING "Weekly and quarterly math"; SCHEMA "credit_ledger" |
| FR-47 | Rollover cap (T-12): `rolloverExpiry(balanceAfterGrant, grant) = max(0, balanceAfterGrant - 2 × grant)`, where `grant = creditsPerInvoice(plan, interval)`. Excess is written as an `expiry` ledger row with the same invoice id, after the grant row. The free grant never expires. The unique index widens to (stripe_invoice_id, reason). | PLAN T-12; PRICING "Rollover" |
| FR-48 | Offer billing pause: when a forwarded email is classified `offer` (regex `pleased to offer`, genuine offer only), the active Stripe subscription is paused via `pause_collection`. "Offer you an interview" never tags `offer` and never pauses. | PRD AC-12; PRICING "Billing rules"; PLAN "Milestone 5" (fixed today) |
| FR-49 | Stripe webhook: signature verified on the raw body; each event id is recorded in `stripe_events` and a redelivered event is ignored (AC-13). Retention 90 days. | PRD AC-13; TRD "Security and privacy"; SCHEMA "stripe_events" |
| FR-50 | Reply tracking: Postmark inbound webhook `POST /api/webhooks/inbound-email` with a secret token compared in constant time; idempotent on `provider_message_id`; writes `inbound_emails`; the worker's `classify-email` tags `kind` (confirmation, rejection, interview, offer, assessment, other) with regex rules and links `application_id` by the forwarding address and the matching company or subject. The mailbox is never read. | TRD "Security and privacy"; SCHEMA "inbound_emails"; PLAN "Milestone 5"; DECISIONS invariants |
| FR-51 | Inbox API lists tagged replies for the session user, newest first; interviews are visible first in the UI (sort by meaning). | FLOW "Screen inventory" (`/inbox`); PRD story 8 |
| FR-52 | Weekly outcome report (T-10, Pro and Max only): `buildOutcomeReport(db, userId, weekStart)` returns submitted count, reply counts by kind, `callbackRate` (interview, assessment or offer replies linked to applications submitted in the 28 days before week end, divided by submitted), `byRole` (first matching `preferences.roles` entry, else "Other") and `byResume`. Served by `GET /api/reports/latest` and emailed Mondays at 13:00 UTC. | PLAN T-10; PRD core features (P1); PRICING "Plans" |
| FR-53 | Priority polling (T-11, Max): `refreshPriorityCompanies(db)` marks a company priority when an active Max subscriber has a `new` or `queued` match there from the last 14 days, or applied there in the last 30 days; cap 300 companies, most recent activity first; others set to `false`. Runs every 6 hours. | PLAN T-11; PRICING "Plans" (Max priority polling) |
| FR-54 | Dashboard read APIs used by the frozen web app, all owner-scoped: `GET /api/me`, `/api/profile`, `/api/profile/facts`, `/api/matches`, `/api/applications` (with `?status=`), `/api/applications/:id`, `/api/inbox`, `/api/credits`, `/api/extension/queue`. Exact request and response shapes are fixed by `web/lib/api.ts` and `web/hooks/*.ts` and `extension/src/lib/api.ts`. | FLOW "Screen inventory"; DECISIONS 2 |
| FR-55 | Contact form `POST /api/contact` (zod `contactMessageSchema`); 429 after 5 requests per hour per IP. Stored in `contact_messages`. | FLOW "Actions" (Contact); TRD "Rate limits" |
| FR-56 | Submission health (T-14): `checkSubmissionHealth` runs every 15 minutes per ATS provider; alert when attempts ≥ 10 and failure rate > 0.2 in the last hour; at most one ops email per provider per 6 hours (Redis key). | PLAN T-14; PLAN Review Focus 5 |
| FR-57 | Model cost logging (T-14): every model call logs `{ tier, model, inputTokens, outputTokens, usd }`. | PLAN T-14; PLAN Global Constraints; TRD "Performance" |
| FR-58 | Retention cleanup (T-14, daily): deletes closed jobs older than 180 days that no match or application references, and `stripe_events` older than 90 days. Returns `{ jobs, stripeEvents }`. | PLAN T-14; SCHEMA "Retention and deletion" |
| FR-59 | Health endpoint `GET /health` checks Postgres and Redis and is the api healthcheck on Railway. | TRD "Performance and reliability"; TRD "Railway setup" |
| FR-60 | Data export: a user requests a JSON export by email. Manual in v1; no export route. | SCHEMA "Retention and deletion" |
| FR-61 | Idempotency: one application per (user, job); one charge per application; one grant per invoice; one match per (user, job); one ledger refund and charge per application; one claim per application at a time; `jobs` unique on (company_id, external_id); job ids are idempotent per entity for BullMQ. | TRD "Data safety"; SCHEMA; PLAN Global Constraints |
| FR-62 | Queues and jobs: `poll-boards`, `score-matches`, `tailor-application`, `parse-resume`, `classify-email`, `cloud-apply` (existing), plus `scan-form`, `expire-claims`, `outcome-report`, `refresh-priority`, `submission-health` and `cleanup` (new, from PLAN). Each job has 3 attempts with exponential backoff. | TRD "Backend"; TRD "Performance"; PLAN T-5, T-7, T-10, T-11, T-14 |

---

## 2. Acceptance criteria (AC), verbatim from PRD "Acceptance criteria"

Copied exactly from `docs/01-prd.md` lines 85 to 99. The trailing markers are part of the PRD text.

- **AC-1.** Given a new account, when sign-up completes, then the user has a profile, a free plan, a forwarding address and a +25 free credit ledger entry. *(verified end to end)*
- **AC-2.** Given an unverified email, when the user signs in, then they are sent to the code screen and protected API routes return 403 `email_unverified`.
- **AC-3.** Given a job titled "Senior Software Engineer" and preferences seniority = entry, when the fit gate runs, then the job is dropped with reason "Title is more senior than you asked for". *(unit test)*
- **AC-4.** Given a user who needs sponsorship and a posting that says "unable to sponsor", when the fit gate runs, then the job is dropped. *(unit test)*
- **AC-5.** Given 2 applications to a company in the last 30 days and a cap of 2, when a new posting from that company arrives, then it is not matched. *(unit test)*
- **AC-6.** Given a tailored line citing a fact id the user does not own, when the draft is saved, then the API returns 422 `truth_lock` and nothing is stored. *(unit test on enforceTruthLock; route wired)*
- **AC-7.** Given 3 available credits, when the user approves 5 drafts, then the API returns 402 and no draft changes status.
- **AC-8.** Given a free-plan user, when they approve for the cloud channel, then the API returns 403 "The cloud applier is on Pro and Max". *(verified end to end)*
- **AC-9.** Given an approved application, when the extension reports `submitted` twice, then exactly one credit is charged. *(verified end to end)*
- **AC-10.** Given an approved application, when the extension reports `failed`, then no credit is charged and the failure reason is shown. *(verified end to end)*
- **AC-11.** Given a form with required fields the filler cannot answer, when the filler runs with submit = true, then it does not click submit and reports the count of empty required fields. *(unit test + live Greenhouse, Lever and Ashby forms)*
- **AC-12.** Given a forwarded email containing "pleased to offer", when it is classified, then it is tagged `offer` and an active Stripe subscription is paused.
- **AC-13.** Given a redelivered Stripe webhook, when it arrives, then it is ignored (stripe_events idempotency).
- **AC-14.** Given a weekly Starter invoice, when it is paid, then 94 credits are granted (400 × 7 / 30, rounded up). *(unit test)*
- **AC-15.** Given a Greenhouse board on a custom domain, when jobs are polled, then each apply URL points at the Greenhouse embed form, not the employer's careers page. *(unit test + live board)*

---

## 3. Implementation tasks (T-1 to T-18), from PLAN

Status is as stated in PLAN on 2026-10-13. "Open" means not marked done. Scope column: B = backend, F = touches `web/` or `extension/` (out of scope for this program; the backend part only may proceed).

| ID | Task | Intent | Status (2026-10-13) | Scope |
| --- | --- | --- | --- | --- |
| T-1 | CI, Dependabot, PR template, README | CI on push and PR with typecheck, lint, test, build, plus no-push Docker builds | Done (commit step 5 unchecked) | B |
| T-2 | Company seed and `db:seed` | Load about 2,000 live boards, validated by fetch, idempotent | Open (milestone 2 "except company seed") | B |
| T-3 | Resume file upload, text extraction, storage | PDF and DOCX in, text out, private bucket, delete on account deletion; web onboarding later | Open | B (web touchpoint later) |
| T-4 | Tailored resume PDF for both channels | One-page PDF per approved application, attached by extension and applier | Open | B + F (extension `attachFile`, `background.ts`, `messages.ts`) |
| T-5 | Form questions for every supported ATS | Store each form's questions, scan Lever and Ashby via applier, closed-posting handling | Open | B + F (`extension/src/scan.ts`, `filler.ts`) |
| T-6 | Answers for custom questions and the required-answer gate | Fixed sensitive rules, model for the rest, 422 `required_answers_missing` | Open | B (web later) |
| T-7 | Extension claim lease | One sender per application, 10-minute lease, sweeper, resend | Open | B + F (`extension/src/background.ts`) |
| T-8 | Answer memory proposals | Propose saved answers after submit; delete route | Open | B (web later) |
| T-9 | Cover letters on paid plans | Truth-locked letter, 4 paragraphs, 250 words; filler pastes or attaches | Open | B + F (`extension/src/filler.ts`) |
| T-10 | Weekly outcome report (Pro, Max) | Report build, Monday email, `GET /api/reports/latest` | Open (milestone 4 not started) | B |
| T-11 | Priority polling for Max users' companies | Companies with Max matches polled every 5 minutes, cap 300 | Open (milestone 4 not started) | B |
| T-12 | Credit rollover cap | Expiry rows, widened invoice unique index | Open (milestone 4 not started) | B |
| T-13 | Shared rate limits and the security pass | Redis rate-limit store, authorization matrix test, `npm audit --omit=dev` clean of high and critical, CSP in web config | Open (milestone 5 partly done) | B + F (CSP in `web/next.config.ts`; frozen, so the CSP part is deferred) |
| T-14 | Observability and the submission health alert | Sentry in api, worker and applier; LLM cost logs; health alert; retention cleanup | Open | B |
| T-15 | End-to-end journey test | Sign-up to submitted journey, in CI with Postgres and Redis containers | Open (depends on T-3 to T-7) | B |
| T-16 | Staging and production deploys with a rollback runbook | Railway staging and production, smoke script, rehearsed rollback | Open (milestone 6 not started) | B + ops (`scripts/smoke.mjs`, `docs/runbook.md`) |
| T-17 | Chrome Web Store submission | Production extension build, permissions, listing (unlisted for beta) | Open (milestone 6 not started) | F only (extension/); outside backend scope |
| T-18 | Launch gates and beta | Legal review, Stripe live mode, Postmark DKIM and inbound MX, 30 beta users, 14-day watch | Open (founder) | Business gate; backend part is Stripe and Postmark setup |

---

## 4. Non-functional requirements (NFR)

| ID | Category | Requirement | Source |
| --- | --- | --- | --- |
| NFR-1 | Latency | API read p95 under 300 ms for `/api/me`, `/api/matches`, `/api/applications`. | TRD "Performance and reliability targets" |
| NFR-2 | Freshness | New postings seen within 30 minutes; within 5 minutes for priority companies (Max). | PRD core features; TRD; PRICING |
| NFR-3 | Uptime | 99.5% for web and api. | TRD "Performance and reliability targets" |
| NFR-4 | Cost | About $0.01 of model and compute per submitted application (TRD target). Every model call is logged with its cost (FR-57). Target is validated in beta (OQ-7). | TRD; PLAN Global Constraints; PRICING "Cost floor"; DECISIONS 3 and invariants |
| NFR-5 | Capacity | Size for about 10,000 users at public beta, growth-ready: pre-ranking before any model call, per-user daily scoring caps, cost alarms, horizontally scalable workers, and real capacity numbers. | DECISIONS 3 |
| NFR-6 | Scalability | Workers scale horizontally; `api`, `worker` and `applier` scale independently. Rate-limit store moves to Redis when `api` runs more than one replica. | TRD "Backend and database"; TRD "Rate limits" |
| NFR-7 | Reliability | Jobs: 3 attempts, exponential backoff, idempotent job ids per entity. | TRD "Performance and reliability targets" |
| NFR-8 | Data safety | Railway Postgres daily backups. Unique keys make retries safe (FR-61). | TRD "Performance and reliability targets" |
| NFR-9 | Health | `GET /health` checks Postgres and Redis; Railway healthcheck. | TRD |
| NFR-10 | Deploy safety | Migrations are additive only (add, backfill, switch code, drop in a later release); a code rollback never needs a schema rollback. Pre-deploy runs `node dist/migrate.js`. | PLAN T-16; TRD "Railway setup" |
| NFR-11 | Security: authorization | Every query filters by the session user id; no route accepts a user id from the client. Unauthenticated calls return 401; other users' rows return 404. | TRD "Security and privacy"; SCHEMA "Authorization rules"; PLAN T-13 |
| NFR-12 | Security: transport and headers | `helmet` on the API; `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` on web; CSP per PLAN T-13. | TRD; PLAN T-13 |
| NFR-13 | Security: rate limits | Better Auth limiter on auth routes; 120 requests per minute per IP on `/api`; 5 per hour per IP on contact. | TRD "Rate limits" |
| NFR-14 | Security: secrets | Env vars only, validated at boot with zod (`server/src/lib/env.ts`). Production refuses to boot without `POSTMARK_SERVER_TOKEN`. Nothing secret in the web bundle. `server/.env` never committed. | TRD; PLAN Global Constraints |
| NFR-15 | Security: credentials | OTPs stored hashed; passwords hashed by Better Auth; extension bearer tokens are short-lived one-time exchanges. | TRD |
| NFR-16 | Security: logs | pino logs with redaction of cookies, authorization headers, passwords, OTPs and tokens. | TRD |
| NFR-17 | Security: dependencies | Known dev-only advisories (drizzle-kit's bundled esbuild, eslint-config-next's glob) are rechecked on each upgrade; `npm audit --omit=dev` shows no high or critical. | TRD; PLAN T-13 |
| NFR-18 | Security: webhooks | Stripe signature verified on the raw body. Postmark inbound secret compared in constant time. | TRD; PRD AC-13 |
| NFR-19 | Observability | Sentry from api, worker and applier; per-call LLM logs; submission health alert (FR-56). | PLAN T-14 |
| NFR-20 | Privacy: minimum data | Send only the minimum to model providers; prefer zero-data-retention and no-training routes. Job descriptions, form questions and emails are untrusted input. | DECISIONS invariants; TRD "Security and privacy" |
| NFR-21 | Privacy: sensitive data | Resumes, work authorization, contact details, answers and forwarded emails are sensitive. Records stay in Railway Postgres; files in a private S3-compatible bucket with signed access only. No third party gets more than its job needs. | TRD "Security and privacy"; DECISIONS invariants |
| NFR-22 | Privacy: regulation | India DPDP Act 2023 and GDPR apply. Privacy policy is a draft for legal review. | TRD; PRD open questions; PLAN T-18 |
| NFR-23 | Retention | Account, profile, facts, applications, receipts and replies: while the account exists. Jobs: indefinitely for dedupe; closed jobs older than 180 days and unreferenced are deleted. Sessions and verifications: until expiry. Stripe events: 90 days. Payment records: in Stripe, not in our database. | SCHEMA "Retention and deletion" |
| NFR-24 | Retention: files | Deleting an account deletes objects under `uploads/{userId}/` and `resumes/{userId}/`. | SCHEMA; PLAN T-3 |
| NFR-25 | Session | 30-day expiry, refreshed daily, Secure cookie in production. | TRD |
| NFR-26 | Compliance: data origin | Mailbox is never read; only the forwarding address receives replies. No Gmail OAuth. | PRD goal; TRD "Key technical decisions" |
| NFR-27 | Billing integrity | Credits charged only on `submitted`; failed never charged; one grant per invoice; one charge per application; rollover cap. | PRD; PLAN; PRICING |
| NFR-28 | Copy | Plain words in user-facing copy; no em dashes. | PLAN Global Constraints |
| NFR-29 | Schema change process | `npm run db:generate -w @auto-career/server -- --name <name>`; never hand-write or edit an applied migration. | PLAN Global Constraints; SCHEMA "Migration" |

---

## 5. Invariants (INV)

These must survive any re-architecture. Each carries a check that a reviewer can apply.

| ID | Invariant | Check |
| --- | --- | --- |
| INV-1 | The fit gate runs before any model call. Only matches at or above the user's threshold (default 75) are queued. The per-company cap (default 2 per 30 days) and the sponsorship filter apply. | No LLM call for a job failing FR-17; test with spy on the model client. |
| INV-2 | Truth lock: every resume line, answer and cover-letter paragraph cites confirmed fact ids owned by the user. Violations return 422 `truth_lock` and store nothing. | AC-6 and FR-22 tests; verifier (INV-7) on every stored draft. |
| INV-3 | Nothing is sent before the user approves it. | Submission routes accept only `approved` or `submitting` rows; the cloud applier and extension queue only read approved rows. |
| INV-4 | One application per (user, job). The same application sent from two tabs submits once. | Unique (user_id, job_id); claim lease (FR-34) with 409; charge guard (FR-37). |
| INV-5 | Credits: charged only when a submission reports `submitted`; `failed` never charged; one grant per Stripe invoice; one charge per application; rollover cap applies; billing pauses on a genuine offer email and never on "offer you an interview". | AC-7, AC-9, AC-10, AC-12, AC-13, AC-14; FR-46, FR-47, FR-48. |
| INV-6 | Never automate LinkedIn. Never store employer passwords. Never read a user's mailbox (forwarding address only). | Code review gate; no LinkedIn adapter; no password fields in schema. |
| INV-7 | An independent verifier agent checks that every tailored line, answer and cover-letter paragraph is supported by the facts it cites before it is stored (strengthens INV-2). The verifier is part of the new design, not a replacement for the deterministic truth lock. | Verifier eval set; deterministic check still runs first. |
| INV-8 | No CAPTCHA solving, no bot-detection evasion, no proxy rotation. A challenged cloud run fails without charge; the user resends through the extension. | FR-40 test; code review. |
| INV-9 | EEO, disability, veteran, gender, race, sexual orientation, salary and visa questions are never answered by a model. | FR-23 and FR-25 tests with spy on model client (0 calls for sensitive questions). |
| INV-10 | Plan limits and prices come only from `shared/src/plans.ts`. The cloud applier runs only for plans with `cloudApplier: true` (Pro, Max). | Grep for hard-coded limits; FR-32 tests. |
| INV-11 | Every database query filters by the session user id, never by a request-body id. Every row except `companies`, `jobs`, `stripe_events` and `contact_messages` belongs to one user. | NFR-11 authorization matrix test (T-13). |
| INV-12 | Stripe webhooks: raw-body signature verified; replays ignored via `stripe_events`. | AC-13 test. |
| INV-13 | `credit_ledger` rows are never updated or deleted by a user path. | Route inventory; FR-43. |
| INV-14 | Job descriptions, form questions and emails are untrusted input. They never change system instructions; model output is validated against a strict schema before use. | Prompt-injection test cases in each agent eval set. |
| INV-15 | Privacy: send the minimum to model providers; prefer zero-data-retention and no-training routes. | Provider contract and config check per model route. |
| INV-16 | `extension/dist/filler.js` is the one filler bundle, unchanged in this program; applier improvements happen around it. | Diff check: no change under `extension/`. |
| INV-17 | Frontend freeze: no file under `web/` or `extension/` is created, edited or deleted; every route, request shape, response shape, status code and error code used by `web/lib/api.ts`, `web/hooks/*.ts` and `extension/src/lib/api.ts` stays backward compatible. New capabilities are new routes or optional response fields only. `shared/` gains only additive, non-breaking types. | Diff check; contract test against the three client files. |
| INV-18 | Credits-based approval: approving N drafts needs available credits ≥ N, else 402 with no status change. | AC-7 test. |
| INV-19 | A cloud channel approval needs Pro or Max; a Free user approving cloud gets 403. | AC-8 test. |
| INV-20 | Secrets are env-only; production refuses to boot without the Postmark token. | Boot test. |
| INV-21 | Migrations: never edit an applied migration; add a new one through Drizzle. | Review gate; NFR-29. |
| INV-22 | Credit balance is derived: `balance = SUM(delta)`; available excludes approved and submitting applications. | Ledger query test. |
| INV-23 | Closed postings never charge: a closed posting during submit yields `failed` with the closed reason. | FR-42 test. |

---

## 6. Open questions (OQ)

| ID | Question | Source | Status |
| --- | --- | --- | --- |
| OQ-1 | Domain: is `kairos.app` available, or which domain do we use? All configs assume it. | PRD open questions | Open |
| OQ-2 | LLM provider: the provider is now decided as OpenRouter (2026-10-15 decision 1). Which model per agent (fit scoring, tailoring, verifier, answers, cover letter, resume parse, email classify) and which fallbacks, from the current catalog, is open. | PRD open questions; DECISIONS 1 | Partly decided; per-agent model choice open |
| OQ-3 | Seed list: which 2,000 companies first? Proposal: US tech and fintech boards on Greenhouse, Lever and Ashby with new-grad roles. | PRD open questions | Open |
| OQ-4 | Stripe account: is it active for USD subscriptions from the company entity? INR pricing depends on it. | PRD open questions; PRICING | Open |
| OQ-5 | Legal review of terms, privacy, cookies and refunds before launch. | PRD open questions; PLAN T-18 | Open |
| OQ-6 | Object storage provider: any private S3-compatible bucket, for example Cloudflare R2. Which one is chosen is not stated. | TRD; PLAN T-3 | Open |
| OQ-7 | Cloud applier share of compute cost: "to be measured in beta". The $0.01 target includes it. | PRICING "Cost floor" | Open (measure in beta) |
| OQ-8 | Launch prices: confirm with the Van Westendorp survey (at least 30 beta users, split by segment) before treating them as final. | PRICING "Price research" | Open |
| OQ-9 | Withdraw scope: FLOW allows withdrawing a draft or an approved application before it is sent; SCHEMA authorization allows owner updates only while `draft`. Which is the rule? | FLOW; SCHEMA | Open (conflict) |
| OQ-10 | Weekly outcome report for Starter: PRD lists it as P1 without a plan gate; PRICING and PLAN T-10 restrict it to Pro and Max. | PRD core features; PRICING; PLAN T-10 | Open (conflict) |
| OQ-11 | Greenhouse reCAPTCHA: how often the cloud applier is challenged in production, and whether that rate changes which channel is offered. | TRD "Known constraint found in testing" | Open (measure) |
| OQ-12 | Data export: manual by email in v1. Whether a self-service export route is needed before public beta. | SCHEMA "Retention and deletion" | Open |
| OQ-13 | Sponsorship phrase list: the fit gate needs the exact phrases that count as "unable to sponsor". No list is given in the docs. | PRD AC-4; PLAN | Open |
| OQ-14 | Postmark inbound: the TRD puts a secret `?token=` in the inbound URL. Whether to move the secret into a header or path that is less likely to be logged is not decided. | TRD "External services" | Open |

---

## 7. Conflicts and gaps found while reading

1. **Withdraw rule.** FLOW says draft or approved can be withdrawn; SCHEMA allows owner update only while `draft`. See OQ-9.
2. **Weekly outcome report gate.** PRD lists it as P1 with no plan gate; PRICING and PLAN gate it to Pro and Max. See OQ-10.
3. **Priority polling wording.** PRD says "5 on Max" minutes for new postings; TRD says "5 minutes for priority companies"; PRICING says "5-minute polling of the companies you target". Treated as one behavior: priority companies (FR-53) polled every 5 minutes.
4. **Sponsorship filter phrases.** The fit gate's "unable to sponsor" test has no phrase list (OQ-13).
5. **Sensitive answer table.** PLAN T-6 answers "Authorized to work in the US?" and "Will you need sponsorship?" by fixed table. This is a deterministic rule, not a model answer; consistent with INV-9.
6. **Secret in URL.** Postmark inbound uses `?token=` in the URL (OQ-14).
7. **Costs in PRICING are per application at full use, and are revenue per application**, not cost. Cost target is NFR-4 (about $0.01).
8. **Frontend items inside the backend plan.** T-4, T-5, T-6, T-7, T-9 and T-13 name `extension/` or `web/` files. Under INV-17 these parts are deferred or re-scoped. The backend part of each task remains in scope.
9. **Status of T-1.** Marked Done, but its commit step (step 5) is unchecked.
10. **Model provider.** PRD and TRD say "provider and models set by env" and an open OpenAI-compatible endpoint. DECISIONS 1 selects OpenRouter. The docs predate that decision (OQ-2).
