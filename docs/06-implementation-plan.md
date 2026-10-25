# 6. Kairos v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the working Kairos skeleton (API, worker, applier, extension, web shell) to a paid beta where a user can upload a resume, get fit-checked matches, review truth-locked drafts and have them submitted by the extension or the cloud applier.

**Architecture:** npm workspaces monorepo. `server/` is one Express 5 codebase with three entry points (`api`, `worker`, `applier`) on Railway with Railway Postgres and Redis. `web/` is Next.js 16 on Vercel and reaches the API through a same-origin `/api/*` rewrite. `extension/` is a Chrome MV3 extension whose `filler.js` bundle is also injected by the cloud applier.

**Tech Stack:** Node 22, TypeScript 5.9, Express 5.3, Better Auth 1.7, Drizzle ORM 0.45 + postgres.js, BullMQ 6, playwright-core 1.64, Stripe (stripe-node 23), Postmark, zod 4, Next.js 16.4, Tailwind 4, Vitest.

**Spec:** `docs/01-prd.md` (features, acceptance criteria), `docs/02-trd.md` (stack, security, deploy), `docs/03-app-flow.md`, `docs/04-ui-ux-brief.md`, `docs/05-backend-schema.md`, `docs/pricing.md`.

## Where the build stands (2026-10-13)

| Milestone | Status | Evidence |
| --- | --- | --- |
| 1. Project setup | Done | Workspaces, Dockerfiles, Railway configs, docker-compose, CI with no-push Docker builds, Dependabot, README (Task 1) |
| 2. Data and auth | Done except company seed | 17 tables migrated; sign-up → OTP → verify → sign-in → `/api/me` verified end to end; Task 2 adds the seed |
| 3. Core journey | Partly done | Polling, fit gate, tailoring, review, approve, extension and cloud submit, single charge all verified. Missing: resume files, tailored PDF, custom questions, claim lease, answer memory proposals, cover letters |
| 4. Secondary features | Not started | Outcome report, priority polling, rollover cap |
| 5. Quality | Partly done | 41 unit tests (server 35, extension 6). Fixed today: "pleased to offer you an interview" no longer tags an offer and pauses billing; production refuses to boot without an email token, so sign-up codes never fall back to the logs |
| 6. Release | Not started | |

Web pages: parked by owner decision on 2026-10-13. The route groups, layouts and restyled tokens stay as the skeleton. Tasks below change only the API, worker, applier and extension. Each task that needs a screen lists it under "Web, when unparked".

## Global Constraints

- Node `>=22`, npm `>=10`, npm workspaces only (no pnpm or yarn).
- Every database query filters by the session user id; never by an id taken from the request body.
- Truth lock: every resume line and cover letter paragraph cites at least one confirmed fact id owned by the user; violations return 422 `truth_lock` and nothing is stored.
- Credits: one credit is charged only when a submission reports `submitted`; `failed` is never charged; one grant per Stripe invoice; one charge per application.
- The fit gate runs before any model call. Defaults: `fitThreshold` 75, `maxApplicationsPerCompanyPer30Days` 2.
- Plan limits and prices come only from `shared/src/plans.ts`.
- The cloud applier runs only for plans with `cloudApplier: true` (Pro, Max).
- Never automate LinkedIn, never store employer passwords, never read a user's mailbox.
- Cost target: about $0.01 of model and compute per submitted application (TRD); every model call is logged with its cost.
- Schema changes go through `npm run db:generate -w @auto-career/server -- --name <name>`, so Drizzle's journal and snapshot stay in step. Never hand-write a migration file or edit an applied one.
- EEO, disability, veteran, gender, race, sexual orientation, salary and visa questions are never answered by a model.
- Copy: plain words, no em dashes.
- Secrets live in env vars only; `server/.env` is never committed or packaged.

## Review Focus

1. **A resume with no text layer** (scanned PDF, image-only DOCX, encrypted PDF). Expect 422 "We could not read text from this file. Upload a PDF exported from a document, or a DOCX." and no rows written. Pinned in Task 3.
2. **The same application sent from two browsers or tabs.** Expect one claim to succeed and the second to get 409, so the employer receives one application. Pinned in Task 7.
3. **A posting that closes between approval and sending** (board returns 404, or the form page says the job is closed). Expect `failed` with reason "This posting has closed", no charge, `jobs.closed_at` set. Pinned in Task 5.
4. **A sensitive question on the form** (EEO, disability, veteran, salary, visa). Expect no model call for it; EEO picks the "decline to self-identify" option when one exists; visa and salary come from preferences or stay blank, and a blank required answer blocks approval. Pinned in Task 6.
5. **An ATS changes its markup** so the filler finds fewer fields. Expect the filler to refuse to submit (already true) and an ops alert when a provider's failure rate passes 20% over an hour with at least 10 attempts. Pinned in Task 14.

---

## Milestone 1: Project setup

### Task 1: CI, Dependabot, pull request template, README

Status: done on 2026-10-13. Owner: ops agent · Depends on: nothing · Inputs: root `package.json` scripts · Output: CI on pushes to `main` and on pull requests · Done when: the workflow passes on a clean clone.

**Files:**
- Created: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.github/pull_request_template.md`, `README.md`
- Modified: `extension/build.mjs` (skips the `public/` copy when git has dropped the empty folder)

**Interfaces:**
- Produces: CI job names `checks` (typecheck, lint, test, build) used by branch protection.

- [x] **Step 1:** `ci.yml` runs on pushes to `main` and on `pull_request` with Node 22 and npm cache: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, with `API_ORIGIN=http://localhost:4000` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000` set for the web build; a second job builds both Dockerfiles without pushing.
- [x] **Step 2:** `dependabot.yml`: weekly npm updates for `/`, grouped minor and patch; weekly GitHub Actions updates; `playwright-core` ignored because its version must match the applier image tag.
- [x] **Step 3:** README covers the tree, local setup (`npm ci`, `npm run infra:up`, `npm run db:migrate`, the four `dev:*` scripts) and points to the TRD for Railway and Vercel.
- [x] **Step 4:** Run the same commands locally. Expected: all exit 0.
- [ ] **Step 5:** Commit `chore: add CI, dependabot and README`.

## Milestone 2: Data and auth

### Task 2: Company seed and `db:seed`

Owner: backend agent · Depends on: nothing · Inputs: PRD open question on the first 2,000 companies · Output: `companies` filled with live boards · Done when: seeding a fresh database inserts only boards that answered 200.

**Files:**
- Create: `server/seeds/companies.json`, `server/src/seed.ts`, `server/test/seed.test.ts`
- Modify: `server/package.json` (script `db:seed`), root `package.json` (script `db:seed`), `server/build.mjs` (entry `seed`)

**Interfaces:**
- Consumes: `atsAdapters[ats].fetchBoard(boardToken, fetchImpl?)` from `server/src/services/ats/index.ts`, `BoardNotFoundError` from `server/src/services/ats/types.ts`.
- Produces: `seedCompanies(db: Db, rows: SeedRow[], fetchImpl?: typeof fetch): Promise<{ inserted: number; skipped: string[] }>`, `SeedRow = { name: string; ats: AtsProvider; boardToken: string; careersUrl?: string }`.

- [ ] **Step 1: Write the failing test** `seedCompanies inserts live boards and skips 404s`: fake fetch returns 200 for `greenhouse/stripe`, 404 for `lever/gone`; expect `inserted === 1`, `skipped` equals `["lever/gone"]`; a second run inserts 0 (upsert on `(ats, board_token)`).
- [ ] **Step 2:** Run `npm test -w @auto-career/server -- test/seed.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `seedCompanies` with a concurrency of 8 and 250 ms spacing per provider; zod-validate the JSON file.
- [ ] **Step 4:** Run the test. Expected: PASS. Then `npm run db:seed` against local Postgres; expect a count line and no errors.
- [ ] **Step 5:** Commit `feat(server): seed companies from a checked list`.

## Milestone 3: Core user journey

### Task 3: Resume file upload, text extraction and storage

Owner: backend agent · Depends on: nothing · Inputs: PRD story 1, schema `resume_profiles.file_key` · Output: PDF or DOCX in, facts queued · Done when: Review Focus 1 passes and a real resume produces facts.

**Files:**
- Create: `server/src/lib/storage.ts`, `server/src/services/resume-file.ts`, `server/test/resume-file.test.ts`, `server/test/fixtures/resume.pdf`, `server/test/fixtures/resume.docx`, `server/test/fixtures/scanned.pdf`
- Modify: `server/src/routes/profile.ts` (new route), `server/src/lib/errors.ts` (add `unprocessable`), `server/src/lib/auth.ts` (delete the user's stored files when the account is deleted), `server/src/lib/env.ts` (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`), `server/.env.example`
- Dependencies: `multer@2`, `unpdf`, `mammoth`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

**Interfaces:**
- Produces: `unprocessable(code: string, message: string): HttpError` (status 422) in `lib/errors.ts`; `extractResumeText(file: { buffer: Buffer; mimetype: string }): Promise<string>` (throws `unprocessable("unreadable_resume", ...)`); `putObject(key: string, body: Buffer, contentType: string): Promise<void>`; `getObject(key: string): Promise<Buffer>`; `deleteUserObjects(userId: string): Promise<number>`; route `POST /api/profile/resumes/upload` (multipart field `file`, field `name`), 5 MB limit, PDF and DOCX only.
- Storage key: `uploads/{userId}/{resumeProfileId}.{pdf|docx}`. Bucket: any private S3-compatible bucket, for example Cloudflare R2 (see the TRD). Deleting an account removes everything under `uploads/{userId}/` and `resumes/{userId}/`.

- [ ] **Step 1: Write the failing tests:** `extracts text from a PDF` (fixture text contains the fixture's job title); `extracts text from a DOCX`; `rejects a scanned PDF` expecting code `unreadable_resume` and message "We could not read text from this file. Upload a PDF exported from a document, or a DOCX."; `rejects text under 200 characters` with the same code; `deleteUserObjects removes both prefixes` (in-memory S3 fake, 3 objects for the user and 1 for another user, expect 3 removed and the other kept).
- [ ] **Step 2:** Run `npm test -w @auto-career/server -- test/resume-file.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `extractResumeText` with `unpdf` (`extractText`, merged pages) and `mammoth.extractRawText`; normalize whitespace. In the route, store the file, insert the row with `fileKey`, queue `parse-resume` as the text route already does. Keep the existing text route for pasted resume text and tests.
- [ ] **Step 4:** Run the tests. Expected: PASS. Add an `app.test.ts` case: upload of a `.png` returns 415.
- [ ] **Step 5:** Commit `feat(server): accept PDF and DOCX resumes`.

Web, when unparked: the onboarding resume step posts the file to this route.

### Task 4: Tailored resume PDF for both channels

Owner: backend agent, then extension agent · Depends on: Task 3 (storage) · Inputs: `applications.resume_lines`, profile contact fields · Output: every approved application carries a one-page ATS-friendly PDF · Done when: the extension and the applier both attach it on a live Greenhouse form in dry-run mode.

**Files:**
- Create: `server/src/services/resume-pdf.ts`, `server/assets/Inter-Regular.ttf`, `server/test/resume-pdf.test.ts`
- Modify: `server/src/jobs/tailor-application.ts` (render after tailoring), `server/src/routes/extension.ts` (new route), `server/src/jobs/cloud-apply.ts`, `server/src/db/schema/applications.ts` (`Receipt.resumeKey?: string`), `server/Dockerfile` and `server/Dockerfile.applier` (copy `server/assets`), `extension/src/lib/messages.ts`, `extension/src/lib/fill.ts` (`attachFile`), `extension/src/filler.ts`, `extension/src/background.ts`, `extension/test/filler.test.ts`
- Dependencies: `pdf-lib`, `@pdf-lib/fontkit`

**Interfaces:**
- Produces: `renderResumePdf(input: { name: string; email: string; phone: string | null; city: string | null; links: string[]; lines: ResumeLine[] }): Promise<Uint8Array>`; storage key `resumes/{userId}/{applicationId}.pdf`, written to `receipt.resumeKey` on submit; route `GET /api/extension/applications/:id/resume.pdf` (bearer, owner only, 404 otherwise).
- Changes: `FillPayload.resumePdfUrl` is replaced by `resumePdf?: { fileName: string; bytesBase64: string }`. The background worker fetches the PDF with the bearer token and passes bytes; the applier reads the object and passes bytes. `attachFile(input, bytes, fileName)` builds the `File` through `DataTransfer`.

- [ ] **Step 1: Write the failing tests:** `renders one page for 12 lines` (load result with `PDFDocument.load`, expect `getPageCount() === 1`); `renders names with diacritics` (input "Zoë Ñúñez" does not throw); extension `attaches resume bytes to the resume input` (jsdom input `files[0].name === "Zoe-Nunez-Resume.pdf"`).
- [ ] **Step 2:** Run both test suites. Expected: FAIL.
- [ ] **Step 3:** Implement a single-column layout: name 18 pt, contact line 10 pt, section headings 11 pt, lines 10 pt, 0.6 in margins, Inter embedded through fontkit. File name `{First}-{Last}-Resume.pdf` with ASCII folding.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then a live dry run on `greenhouse/stripe` with `submit: false`; expected: the resume input shows the file.
- [ ] **Step 5:** Commit `feat: tailored resume PDF attached by extension and applier`.

### Task 5: Form questions for every supported ATS

Owner: backend agent + extension agent · Depends on: Task 4 (filler changes land first) · Inputs: live forms showed 10 (Greenhouse), 3 (Lever) and 7 (Ashby) required custom fields left empty · Output: each draft stores the form's questions · Done when: drafts for one job per ATS list every required field the live dry run reported.

**Files:**
- Generate: migration `questions` with `npm run db:generate -w @auto-career/server -- --name questions` (SQL plus `drizzle/meta` journal and snapshot)
- Create: `server/src/services/ats/questions.ts`, `server/src/jobs/scan-form.ts`, `server/test/questions.test.ts`, `server/test/fixtures/greenhouse-questions.json`, `extension/src/scan.ts`
- Modify: `shared/src/schemas.ts` (`formQuestionSchema`), `server/src/db/schema/applications.ts` (`questions jsonb not null default '[]'`), `server/src/jobs/queues.ts`, `server/src/jobs/tailor-application.ts`, `server/src/applier.ts` (consume `scan-form`), `extension/src/filler.ts` (set `window.__autoCareerScan` next to `window.__autoCareerFill`, so the applier image's single `filler.js` carries both)

**Interfaces:**
- Produces: `FormQuestion = { key: string; label: string; required: boolean; type: "text" | "textarea" | "select" | "multiselect" | "checkbox" | "file"; options: string[]; sensitive: SensitiveKind | null }`, `SensitiveKind = "eeo" | "work_authorization" | "sponsorship" | "salary"`; `fetchGreenhouseQuestions(boardToken: string, jobId: string, fetchImpl?): Promise<FormQuestion[]>` (GET `boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}?questions=true`, including `compliance` and `demographic_questions`); `classifySensitive(label: string): SensitiveKind | null`; `scanQuestions(doc: Document): FormQuestion[]` in the filler bundle; queue `scan-form` with data `{ applicationId }` run by the applier service for Lever and Ashby.
- Closed postings: a 404 from the questions endpoint or a closed-page text match sets `jobs.closed_at`, moves the application to `failed` with reason "This posting has closed" and expires the match.

- [ ] **Step 1: Write the failing tests:** `normalizes Greenhouse questions` (fixture yields the required "Location (City)" and an EEO gender select with `sensitive: "eeo"`); `classifySensitive` table: "Will you now or in the future require sponsorship?" → `sponsorship`, "Are you legally authorized to work in the United States?" → `work_authorization`, "Desired salary" → `salary`, "Veteran status" → `eeo`, "Why this team?" → `null`; `marks a closed posting failed without a charge` (fake fetch 404, expect status `failed`, ledger unchanged, `closed_at` set); extension `scanQuestions finds required custom fields` on a Lever-like jsdom form.
- [ ] **Step 2:** Run both suites. Expected: FAIL.
- [ ] **Step 3:** Implement. Field keys reuse the board's input `name` so the filler can target them; the filler gains a `name` lookup before its label lookup.
- [ ] **Step 4:** Run the tests. Expected: PASS. Run `npm run db:migrate` on a fresh database; expect both migrations to apply with no errors.
- [ ] **Step 5:** Commit `feat: fetch and scan application questions`.

### Task 6: Answers for custom questions, and the required-answer gate

Owner: backend agent (prompt work reviewed with senior-prompt-engineer) · Depends on: Task 5 · Inputs: `FormQuestion[]`, confirmed facts, saved answers, preferences · Output: drafts arrive with every answerable field filled · Done when: Review Focus 4 passes and approval refuses drafts with empty required answers.

**Files:**
- Create: `server/src/services/answers.ts`, `server/test/answers.test.ts`
- Modify: `server/src/jobs/tailor-application.ts`, `server/src/services/submissions.ts`, `server/test/app.test.ts`

**Interfaces:**
- Consumes: `FormQuestion`, `chatJson` (smart tier), `Preferences`.
- Produces: `answerQuestions(input: { questions: FormQuestion[]; facts: FactForTailoring[]; saved: SavedAnswer[]; prefs: Preferences; profile: ProfileContact }): Promise<ApplicationAnswer[]>`; `missingRequired(questions: FormQuestion[], answers: ApplicationAnswer[]): FormQuestion[]`; approval error `422 required_answers_missing` with `{ applicationIds: string[] }`.
- Fixed rules, in order: approved saved answer for the same `questionKey`; then the sensitive table below; then the model for text, textarea and select (select answers must be one of `options`, otherwise blank); file questions other than resume and cover letter stay blank.

| `workAuthorization` | Authorized to work in the US? | Will you need sponsorship? |
| --- | --- | --- |
| `citizen_or_pr` | Yes | No |
| `opt_stem_opt` | Yes | Yes |
| `needs_sponsorship_later` | Yes | Yes |
| `needs_sponsorship_now` | No | Yes |

EEO: the option matching `/decline|prefer not|don.t wish|not to (?:say|disclose)/i`, else blank. Salary: `salaryFloorUsd` formatted as a whole number, else blank.

- [ ] **Step 1: Write the failing tests:** `never calls the model for sensitive questions` (spy on `chatJson`, four sensitive questions, expect 0 calls); the four authorization rows above; `EEO picks the decline option`; `select answers outside the options are dropped`; `saved answer wins over the model`; route test `approve returns 422 required_answers_missing when a required answer is blank` and no status changes.
- [ ] **Step 2:** Run `npm test -w @auto-career/server -- test/answers.test.ts test/app.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. One model call per draft covering all non-sensitive questions, facts passed as `{id, text}`, answers returned with `factIds`; drop any answer whose `factIds` are not in the confirmed set.
- [ ] **Step 4:** Run the tests. Expected: PASS. Live dry run on the three boards; expected: required fields left empty drop from 10/3/7 to only the sensitive ones without a preference value.
- [ ] **Step 5:** Commit `feat(server): answer custom questions under fixed rules`.

Web, when unparked: the draft editor shows `sensitive` answers with a lock note and highlights blank required fields.

### Task 7: Extension claim lease

Owner: backend agent + extension agent · Depends on: nothing · Inputs: status `submitting` already exists · Output: one sender per application · Done when: Review Focus 2 passes.

**Files:**
- Generate: migration `claim_lease` with `npm run db:generate -w @auto-career/server -- --name claim_lease`
- Create: `server/test/claim.test.ts`
- Modify: `server/src/db/schema/applications.ts` (`lease_expires_at timestamptz`), `server/src/routes/extension.ts`, `server/src/routes/applications.ts` (resend), `server/src/worker.ts` (sweeper scheduler), `extension/src/background.ts`

**Interfaces:**
- Produces: `POST /api/extension/claim` body `{ applicationId }` → 200 `{ claimed: true }` and status `submitting` with a 10-minute lease, or 409 `already_claimed`; sweeper job `expire-claims` every minute moves expired extension leases to `failed` with reason "No report from the extension within 10 minutes. Check for the employer's confirmation email before you resend." (no charge); `POST /api/applications/:id/resend` moves `failed` to `approved` (402 when no credits are available).

- [ ] **Step 1: Write the failing tests:** `second claim gets 409`; `report after claim charges once`; `expired lease becomes failed and is not charged`; `resend re-approves a failed application`.
- [ ] **Step 2:** Run `npm test -w @auto-career/server -- test/claim.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the claim as one conditional `UPDATE ... WHERE status = 'approved' RETURNING id`. The extension claims before opening the tab and skips the item on 409.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: claim lease so each application is sent once`.

### Task 8: Answer memory proposals

Owner: backend agent · Depends on: Task 6 · Inputs: submitted applications' answers · Output: recurring answers proposed for the user to approve · Done when: approving a proposal fills that question on the next draft.

**Files:**
- Create: `server/src/services/answer-memory.ts`, `server/test/answer-memory.test.ts`
- Modify: `server/src/services/submissions.ts` (call after a successful submit), `server/src/jobs/tailor-application.ts` (use `questionKey`), `server/src/routes/profile.ts` (add `DELETE /api/profile/answers/:id`)

**Interfaces:**
- Produces: `questionKey(label: string): string` (lowercase, strip punctuation, collapse spaces, max 200 characters); `proposeSavedAnswers(tx: Tx, userId: string, answers: ApplicationAnswer[], companyName: string): Promise<number>`, inserting `approved: false` rows with `onConflictDoNothing`. Runs only when `getPlan(plan).answerMemory` (Starter, Pro, Max). Skips sensitive answers, profile fields, and labels containing the company name. `DELETE /api/profile/answers/:id` removes one of the user's rows (404 for anyone else's).

- [ ] **Step 1: Write the failing tests:** `questionKey("Are you authorized to work in the U.S.?") === questionKey("are you authorized to work in the US")`; `skips labels that name the company` ("Why Stripe?" with company Stripe → 0 rows); `does not overwrite an approved answer`; `free plan gets no proposals`; route test `delete of another user's answer returns 404`.
- [ ] **Step 2:** Run the suite. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the suite. Expected: PASS.
- [ ] **Step 5:** Commit `feat(server): propose saved answers after a submit`.

Web, when unparked: Settings > Answers lists proposals with Approve (`PATCH`, exists) and Delete (added here).

### Task 9: Cover letters on paid plans

Owner: backend agent · Depends on: Tasks 4 and 6 · Inputs: `Plan.coverLetters`, form questions · Output: a truth-locked letter when the form asks for one · Done when: Free drafts never call the model for a letter and paid drafts cite facts in every paragraph.

**Files:**
- Create: `server/src/services/cover-letter.ts`, `server/test/cover-letter.test.ts`
- Modify: `server/src/jobs/tailor-application.ts`, `server/src/services/submissions.ts` (required-letter gate), `extension/src/filler.ts` (paste into a textarea, else attach a PDF rendered by Task 4's renderer)

**Interfaces:**
- Produces: `writeCoverLetter(facts: FactForTailoring[], job: { title: string; companyName: string; descriptionText: string }): Promise<{ paragraphs: { text: string; factIds: string[] }[] }>`, at most 4 paragraphs and 250 words; paragraphs failing the truth lock are dropped; stored as `applications.cover_letter` text.
- Free plan with a required letter field: approval returns 422 `cover_letter_required` with "This form needs a cover letter. Write one, or upgrade to Starter for tailored letters."

- [ ] **Step 1: Write the failing tests:** `free plan never calls the model`; `drops a paragraph citing an unknown fact`; `caps at 250 words`; route test for `cover_letter_required`.
- [ ] **Step 2:** Run the suite. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the suite. Expected: PASS.
- [ ] **Step 5:** Commit `feat: truth-locked cover letters on paid plans`.

**Milestone 3 checkpoint:** run the full journey on the local stack against one live posting per ATS in review mode (`submit: false`): upload → facts confirmed → match → draft → approve → fill. Record any field left empty in `docs/02-trd.md` under "Known constraint found in testing".

## Milestone 4: Secondary features

### Task 10: Weekly outcome report (Pro, Max)

Owner: backend agent · Depends on: nothing · Output: Monday email and `GET /api/reports/latest` · Done when: report numbers match a seeded week.

**Files:** Create `server/src/services/outcome-report.ts`, `server/src/jobs/outcome-report.ts`, `server/src/routes/reports.ts`, `server/test/outcome-report.test.ts`; modify `server/src/routes/index.ts`, `server/src/worker.ts` (scheduler `0 13 * * 1` UTC), `server/src/lib/mailer.ts`.

**Interfaces:** `buildOutcomeReport(db: Db, userId: string, weekStart: Date): Promise<OutcomeReport>`, `OutcomeReport = { submitted: number; replies: Record<EmailKind, number>; callbackRate: number; byRole: { role: string; submitted: number; callbackRate: number }[]; byResume: { resumeProfileId: string; name: string; submitted: number; callbackRate: number }[] }`. A callback is an `interview`, `assessment` or `offer` reply linked to an application submitted in the 28 days before the week ends. Role bucket is the first matching entry of `preferences.roles`, else "Other". Sent only when `getPlan(plan).outcomeReport`.

- [ ] **Step 1:** Failing test `10 submitted, 2 interview and 1 assessment replies give callbackRate 0.3`; `Starter users get no report`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(server): weekly outcome report`.

### Task 11: Priority polling for Max users' companies

Owner: backend agent · Depends on: nothing · Output: companies relevant to Max users polled every 5 minutes · Done when: a seeded Max match flips its company to priority within one run.

**Files:** Create `server/src/jobs/refresh-priority.ts`, `server/test/refresh-priority.test.ts`; modify `server/src/worker.ts` (scheduler every 6 hours).

**Interfaces:** `refreshPriorityCompanies(db: Db): Promise<{ priority: number }>`. A company is priority when an active Max subscriber has a `new` or `queued` match there from the last 14 days, or applied there in the last 30 days. Cap 300 companies, most recent activity first. Others are set back to `false`.

- [ ] **Step 1:** Failing tests `marks a Max user's matched company`, `ignores Pro users`, `caps at 300`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement as one `UPDATE companies SET priority = (id IN (...))`. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(server): priority polling for Max`.

### Task 12: Credit rollover cap

Owner: backend agent · Depends on: nothing · Inputs: `docs/pricing.md` rollover rule · Output: unused paid credits roll over up to two cycles' worth · Done when: the invoice handler writes an `expiry` row for the excess.

**Files:** Modify `server/src/db/schema/billing.ts` (widen `credit_ledger_invoice_uq` from `stripe_invoice_id` to `(stripe_invoice_id, reason)`, so a grant and an expiry can share an invoice), `server/src/routes/webhooks.ts` (invoice paid), `server/src/services/stripe.ts`; generate migration `ledger_invoice_reason`; add tests to `server/test/billing.test.ts`.

**Interfaces:** `rolloverExpiry(balanceAfterGrant: number, grant: number): number` returns the credits to expire, `max(0, balanceAfterGrant - 2 * grant)`, where `grant = creditsPerInvoice(plan, interval)`. Capping by the invoice's own grant keeps a fresh quarterly grant whole. The expiry row uses reason `expiry` and the same invoice id, so a redelivered webhook writes nothing. The free grant is never expired.

- [ ] **Step 1:** Failing tests: Starter monthly with 1,500 left plus a 1,000 grant expires 500; Starter quarterly with 500 left plus a 3,000 grant expires 0; Starter weekly with 300 left plus a 234 grant expires 66; Pro with 100 left expires 0; redelivery writes no second row.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(server): cap credit rollover at two invoices of credits`.

## Milestone 5: Quality

### Task 13: Shared rate limits and the security pass

Owner: backend agent with senior-security review · Depends on: nothing · Done when: the authorization matrix test passes for every route and `npm audit --omit=dev` shows no high or critical advisories.

**Files:** Modify `server/src/middleware/rate-limit.ts` (`rate-limit-redis` store on the shared ioredis client, prefix `rl:`), `web/next.config.ts` (Content-Security-Policy); create `server/test/authz.test.ts`.

**Interfaces:** CSP: `default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; frame-src https://js.stripe.com https://checkout.stripe.com; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'`.

- [ ] **Step 1:** Failing test: for every route in `docs/05-backend-schema.md`'s authorization matrix, user B reading or changing user A's record gets 404 and the row is unchanged; unauthenticated calls get 401.
- [ ] **Step 2:** Run. Expected: FAIL on routes not yet covered. **Step 3:** Fix any route that leaks. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `test(server): authorization matrix and shared rate limits`.

### Task 14: Observability and the submission health alert

Owner: ops agent · Depends on: nothing · Done when: an injected error appears in Sentry from each of api, worker and applier, and the health job emails ops in a seeded failure spike.

**Files:** Create `server/src/lib/sentry.ts`, `server/src/jobs/submission-health.ts`, `server/src/jobs/cleanup.ts`, `server/test/submission-health.test.ts`, `server/test/cleanup.test.ts`; modify `server/src/api.ts`, `server/src/worker.ts`, `server/src/applier.ts`, `server/src/services/llm.ts`, `server/src/lib/env.ts` (`SENTRY_DSN`, `OPS_ALERT_EMAIL`).

**Interfaces:** `checkSubmissionHealth(db: Db, now: Date): Promise<{ provider: AtsProvider; attempts: number; failureRate: number; alert: boolean }[]>`, run every 15 minutes, alert when attempts ≥ 10 and failure rate > 0.2 in the last hour, at most one email per provider per 6 hours (Redis key). `llm.ts` logs `{ tier, model, inputTokens, outputTokens, usd }` per call. Retention from `docs/05-backend-schema.md`: `cleanup(db: Db, now: Date): Promise<{ jobs: number; stripeEvents: number }>` runs daily, deleting closed jobs older than 180 days that no match or application references, and `stripe_events` older than 90 days.

- [ ] **Step 1:** Failing tests: 12 Lever attempts with 4 failed → alert; 5 attempts all failed → no alert; second spike within 6 hours → no second email; cleanup keeps a 200-day-old closed job that an application references and deletes an unreferenced one.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(ops): Sentry, cost logs, submission health alert and retention cleanup`.

### Task 15: End-to-end journey test

Owner: QA agent · Depends on: Tasks 3 to 7 · Done when: `npm run test:e2e -w @auto-career/server` passes locally and in CI with Postgres and Redis service containers.

**Files:** Create `server/e2e/journey.test.ts`, `server/e2e/fixture-form/` (a static Greenhouse-shaped form with a confirmation page), `server/vitest.e2e.config.ts`; modify `server/package.json` (script `test:e2e`: `vitest run --config vitest.e2e.config.ts`), `server/src/lib/mailer.ts` (`MAILER=memory` keeps OTPs in process for tests), `.github/workflows/ci.yml` (e2e job).

- [ ] **Step 1:** Write the journey: sign up → read OTP → verify → upload fixture resume → confirm facts → seed a company and job pointing at the fixture form → score → prepare draft → approve on `cloud` for a seeded Pro user → run the applier once. Assert: application `submitted`, exactly one `submission` ledger row, receipt lists the resume and every required field.
- [ ] **Step 2:** Run. Expected: FAIL until Tasks 3 to 7 are in. **Step 3:** Fix what it finds. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `test: end-to-end application journey`.

Web, when unparked: add an axe check over `/`, `/pricing`, `/login`, `/dashboard`, `/queue` (no serious or critical violations) and keyboard-only completion of approve.

## Milestone 6: Release

### Task 16: Staging and production deploys with a rollback runbook

Owner: ops agent · Depends on: Tasks 1, 13, 14 · Done when: staging passes the smoke script and a rollback was rehearsed once.

**Files:** Create `scripts/smoke.mjs`, `docs/runbook.md`.

- [ ] **Step 1:** Create Railway `staging` and `production` environments and Vercel preview and production as written in the TRD; add the bucket and `SENTRY_DSN`.
- [ ] **Step 2:** `scripts/smoke.mjs <web-url> <api-url>` checks `GET <api-url>/health` is 200, `GET <web-url>/api/me` is 401 (proves the rewrite), and `GET <web-url>/pricing` is 200 and shows the four plan names from `shared/src/plans.ts`. Expected: "smoke ok".
- [ ] **Step 3:** Runbook: Vercel instant rollback; Railway redeploy of the previous deployment per service; migrations are additive only (add columns, backfill, switch code, drop in a later release), so a code rollback never needs a schema rollback; how to pause the `cloud-apply` queue.
- [ ] **Step 4:** Rehearse: deploy, roll back, roll forward on staging. Record the times in the runbook.
- [ ] **Step 5:** Commit `chore: smoke test and runbook`.

### Task 17: Chrome Web Store submission

Owner: extension agent + founder · Depends on: Tasks 4 to 7 · Done when: the listing is published (unlisted for beta) and the production web app connects to it.

- [ ] **Step 1:** Production build with `API_BASE=https://kairos.app` and `externally_connectable` matching `https://kairos.app/*` only; remove localhost.
- [ ] **Step 2:** Write the permission justifications (`storage`, `sidePanel`, `tabs`, `alarms`, and the four ATS host patterns: `job-boards.greenhouse.io`, `boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`) and the privacy practices answers to match the privacy policy.
- [ ] **Step 3:** Icons at 16, 48 and 128 px in `extension/public/` (referenced from `manifest.json`), screenshots at 1280×800 in the reference style, short description under 132 characters.
- [ ] **Step 4:** Submit as unlisted; set `NEXT_PUBLIC_EXTENSION_ID` on Vercel when the id is issued.

### Task 18: Launch gates and beta

Owner: founder · Depends on: Tasks 16 and 17 · Done when: every gate below is checked.

- [ ] Legal review of terms, privacy, cookies and refunds (DPDP Act 2023 and GDPR notes in the TRD).
- [ ] Stripe live mode: products and prices for Starter, Pro and Max at week, month and quarter as in `shared/src/plans.ts`; `STRIPE_PRICES` set; portal allows cancel and plan change; webhook endpoint registered.
- [ ] Postmark: sending domain with DKIM and Return-Path verified; inbound domain MX for forwarding addresses.
- [ ] Beta: 30 or more users from the target segments; run the Van Westendorp survey in `docs/pricing.md` after their first week.
- [ ] Watch for 14 days: PRD success measures, Sentry, submission health alerts, cost per submitted application.

---

## Before moving to the next milestone

Run the app on the local stack, check the milestone's PRD acceptance criteria, and write any unresolved issue at the end of this file with the date and the owner.
