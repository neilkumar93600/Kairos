> DRAFT from the CTO synthesis of run wf_eac5a5ef-3a0 (2026-10-30), before the critic revision; replaced when the revision lands.

# Work packages

Architecture recommendation: Path (c), the hybrid. Keep today's Express API, Better Auth and BullMQ workers, which are built and wired: about 7,400 server lines, 332 unit tests, the phase-A gateway, and the resume-suite D7 already builds here. Add a durable layer only where losing a step costs money or sends twice: approve, applyCloud, settlement, Stripe ingest and offer-pause. Do it in two steps. (1) Now, on today's stack: Postgres-backed reconcilers and sweepers (stuck submitting, approved without a job, draft without lines, unclassified mail, missing grants). These close the lost-enqueue and stuck-row holes within days, and they stay useful under any engine. (2) After the Railway half of spike S-D1 passes: a DBOS seam (server/src/durable/) for the money and sending workflows only, behind a flag per user, with the 1,000-approval chaos test as the exit. If S-D1 fails, use a Postgres outbox table drained by BullMQ (the pre-agreed pg-boss swap). Polling, scoring, parsing, tailoring and rendering stay on BullMQ until a measured load problem says otherwise. Redis decommission (P7) is deferred, not cancelled. What each path costs: (a) ADR-001 as written, P0 to P8. Working beta in about 4 months instead of about 6 to 8 weeks, and R1 to R4 built twice (once per D7, once ported). P1 alone bundles PG18, a driver swap, roles, DBOS, observability, backups and IaC into 2 weeks it cannot hold. It is the heaviest ops load for a solo founder, and it does nothing about the live risks (applier, spend, offer pause, sign-in) until P1 to P5. (b) Pure evolution on BullMQ. No checkpointed steps on the money path: approve then enqueue stays two writes healed only by sweepers, and settlement after a crash in the middle of a submit depends on hand-written phase logic. Acceptable for beta, weaker at 10k users and for Autopilot. (c) Hybrid. Two queue systems run for a while, and the single-store simplicity of ADR-001 (no Redis, one backup story) waits. That is a deliberate trade for shipping safely first. Rewrite ADR-001 as Revision 3 with this scope, then accept it.

## WP-00: Emergency containment (today)

- Effort: S; parallel group A; depends on: none
- Domains: api-auth-security, messaging, billing, applications
- Spec refs: CISO mustFix 1(step 1),2,5; messaging-27, billing-33, api-auth-security-36
- Needs owner: Set the Anthropic Console spend limit and alert; add OWNER_USER_IDS on sd1-api.

Owner-gate channel 'cloud' in approveApplications (submissions.ts:22) via OWNER_USER_IDS; delete the Stripe pause block in classify-email.ts:34-40 (keep the offer tag) and fix the refunds page copy; move the inbound token check into middleware before express.json with inflate:false and 403; truncate TextBody to 16 KB, compute inbox previews in SQL (left(text_body,280)); set allow_promotion_codes false (routes/billing.ts:35).

**Acceptance:** A Pro user approving cloud gets 403 while the owner succeeds; an offer email changes no Stripe state; a bad-token 50 KB gzip POST returns 403 without parsing; the inbox route selects no full bodies; checkout sessions have no promotion-code field.

## WP-01: CI truth and supply chain

- Effort: M; parallel group A; depends on: none
- Domains: tests, platform
- Spec refs: tests-05,10-13,18,20,39,42,44,45,v01,v04; platform-33,35,36,76; 06-infrastructure 3.2
- Needs owner: no

Postgres service in ci.yml with TEST_DATABASE_URL so all *.int.test.ts run as a required check; known-defect tests as it.fails; INV-5 failed-never-charged and Free-cloud-403 tests; gitleaks and osv-scanner jobs; actions pinned by SHA; .npmrc save-exact and exact pins; npm ci --ignore-scripts; server Dockerfile base pinned by digest; ESLint for server with boundary rules (SDK only in llm/, ledger writes only in credits).

**Acceptance:** A PR breaking the charge-once test fails CI; gitleaks and osv-scanner run on every PR; no caret ranges remain in server/package.json.

## WP-02: Working auth end to end (email+OTP, Google)

- Effort: M; parallel group A; depends on: none
- Domains: api-auth-security
- Spec refs: api-auth-security-01..06,10,15,63; platform-62; CISO shouldFix staging sign-in; 05-api 5.1
- Needs owner: Set Railway and Vercel env values, the Google console redirect URI and EXTENSION_ORIGIN; confirm the provider decision.

BETTER_AUTH_URL and WEB_ORIGIN equal the Vercel production origin; preview origins listed explicitly; Google redirect via the web origin; fail the Vercel production build if API_ORIGIN is unset; hide providers the API has not configured; account.accountLinking explicit and encryptOAuthTokens true; maxPasswordLength 128 and revokeSessionsOnPasswordReset; S-B1 header probe; scripts/smoke.mjs (sign up, verify OTP, sign in, GET /api/me through the Vercel URL); amend 05-api 5.1 (BETTER_AUTH_URL = web origin, API_PUBLIC_ORIGIN separate).

**Acceptance:** The smoke script passes against staging via the Vercel domain for email+OTP and Google; a pre-hijack test (unverified credential then Google) does not link; the web shows only configured providers.

## WP-03: Client IP, shared limiters, body caps

- Effort: M; parallel group B; depends on: WP-02
- Domains: api-auth-security, scale
- Spec refs: CISO mustFix 4, shouldFix x-vercel-id; api-auth-security-23..28,v01; platform-59,61,v08; database-30,92; scale-21,22
- Needs owner: Create KAIROS_EDGE_SECRET in Vercel and Railway.

web/proxy.ts sets x-kairos-edge (secret) and x-kairos-client-ip; Express strips both unless the secret matches (timingSafeEqual), otherwise uses the rightmost hop; Better Auth ipAddressHeaders and rateLimit.storage 'database'; Postgres rate_limits store (anon by client IP, signed-in by user 600/min, ai_burst, billing 10/10 min, webhook_ip, contact); per-email sign-in and OTP-send limits; sign-up per-IP daily cap; 413 above 64 KB or chunked bodies without a length on /api/auth; fix 05-api 5.5 (no x-vercel-id trust).

**Acceptance:** Forged x-vercel-id plus X-Forwarded-For sent direct to Railway cannot pick the IP; 300 signed-in users at 2 rps each see no 429; limits hold across 2 api replicas and a redeploy.

## WP-04: Applier containment

- Effort: L; parallel group A; depends on: none
- Domains: applications, platform, security
- Spec refs: CISO mustFix 1(2-7), shouldFix applier hygiene; applications-56,59,62,63,65,67,v02; platform-24,32,69,70,72; matching-18; tests-51,56,v02
- Needs owner: Run role provisioning as the Railway superuser; remove the secrets from sd1-applier; sign a risk acceptance if the sandbox fails.

envFor(role) schemas (the applier boots on its DB URL, REDIS_URL, FILLER_SCRIPT_PATH and CHROMIUM_EXECUTABLE_PATH only); interim kairos_applier role via ops/provision-roles.sql; Lever and Ashby apply URLs built from the validated token and posting id; https plus 5-host allowlist recheck before goto; page.route aborts top-level navigation to other hosts; chromium.launch({chromiumSandbox:true}) tested on Railway (S-AP4); submissionReportSchema parse with applicationId forced to row.app.id; 120 s outer race; post-click errors recorded as needs_check (never resendable); coded failure reasons; reCAPTCHA/hCaptcha/Turnstile detection fails with no charge; drop bypassCSP if addInitScript works on all three ATS; plan_lapsed and closed_at precheck at claim; browser disconnect handler; applier image digest-pinned and rebuilt on each Playwright release.

**Acceptance:** The SSRF fixture (internal host, metadata IP, javascript:) is refused; the applier container env holds no Stripe, Anthropic, Postmark, auth or webhook secret; the applier role cannot SELECT user, session or credit_ledger beyond the granted columns; a challenge fixture fails with zero ledger rows.

## WP-05: Tenant isolation matrix and response serializers

- Effort: M; parallel group B; depends on: WP-01, WP-07
- Domains: api-auth-security, tests
- Spec refs: CISO mustFix 11, shouldFix origin guard; api-auth-security-18,19,20,31,32,33; tests-23,26; billing-60
- Needs owner: no

CI test seeding users A and B: every route in routes/index.ts is called with B's session on A's ids (404, same body as a missing id) and with no session (401); fails when a route lacks a matrix entry. Pick-list serializers for /api/me, applications, profile, resumes and credits (no Stripe ids, no plan cost fields, no raw payloads); Cache-Control no-store on authenticated JSON; originGuard (05-api 5.6); http(s)-only URL fields; /health returns status only.

**Acceptance:** The matrix covers 100% of mounted routes; a seeded marker in internal columns never appears in any response; a cross-site POST with a cookie gets 403 origin_not_allowed.

## WP-06: AI spend ceilings and gateway live

- Effort: L; parallel group B; depends on: WP-07, WP-08
- Domains: llm-agents, resume, api-auth-security
- Spec refs: CISO mustFix 3; llm-agents-01,02,05,12,18,22,29,30,v01,v03,v08; resume-21..25,34; scale-15,23,v01,v02; api-auth-security-58
- Needs owner: Anthropic workspace keys and USER_HASH_KEY on Railway; approve the S-A1 spend; choose the 429 vs 402 decision.

Run the S-A1 live smoke, then LLM_GATEWAY=anthropic on staging and production; pass {userId, plan, jobId} from all six call sites; input zod parse and maxInputTokens in runAgent; consumeAllowance/refundAllowance on ai_usage per feature (429 daily_allowance); AgentError mapped to 503 ai_unavailable / 422 ai_refused / 429 service_budget; tier-up only on schema/max_tokens/refusal/overload; budget_stopped error code fix; limiter AIMD and empty-bucket fixes; remove the legacy key fallback; route the tailor route to Haiku resume-tailor; fact retrieval caps (60/25); gateway-spy test (no model call before the fit gate or on sensitive questions).

**Acceptance:** A scripted free account stops at its daily allowance with 429 across 2 replicas; every model call writes an llm_calls row with a user_hash; a budget refusal never tiers up; a spy test proves zero calls for gate-failed pairs.

## WP-07: Truth lock and prompt redaction

- Effort: L; parallel group A; depends on: none
- Domains: llm-agents, resume, applications
- Spec refs: CISO mustFix 6,7, shouldFix re-parse; llm-agents-10,33,34,35,48,54; resume-06,19,44,55,59,63,64; applications-19; database-v09; api-auth-security-59
- Needs owner: Request ZDR and confirm the Anthropic DPA; add Anthropic to the privacy notice.

inventedDetails on tailored lines (tailor.ts:54,73) and on PATCH and PUT line diffs; checkClaims v1 (numbers, employers, titles, schools, dates, URLs, emails, phones, instruction phrases must appear in the cited facts); redactResumeHeader plus dropSensitiveLines (visa, work authorization, DOB, salary, government ids, disability, veteran, gender, ethnicity) in processParseResume with a seeded fail-closed test; redactContact in the score and tailor prompt builders; fence mandatory without userId; fix echo-canary false positives and the enum normalizer; re-parse deletes only unconfirmed facts of the same import with a forward-only onboarding step; block deleting a cited confirmed fact; gateway cover-letter caps (4 paragraphs, 250 words); profile_only guard independent of answer.source.

**Acceptance:** Fixtures with an invented percentage, tool or employer are dropped on every path; the seeded sensitive-resume test sends none of those lines to the model; re-parsing after a confirm keeps confirmed facts.

## WP-08: Log and error hygiene

- Effort: S; parallel group A; depends on: none
- Domains: ops, platform
- Spec refs: CISO mustFix 9; platform-47,48,49; ops-70,71,v02; api-auth-security-21,22,37
- Needs owner: no

One pino err serializer (type, code, message up to the params line; drops params, query, cause bodies); REDACT_PATHS add *.text, *.textBody, *.sourceText, *.answers, *.resumeLines, *.coverLetter, *.messages, stripe-signature; URL query cut at '?'; request id echoed in x-request-id and the error envelope; userHash instead of raw userId in logs; coded failure_reason only (no err.message to users); seeded DrizzleQueryError case in log-redaction.test.ts.

**Acceptance:** The seeded failed-write test logs no resume text or EEO value; the failure reason the web shows is a catalog code.

## WP-09: Scheduled maintenance and reconcilers (BullMQ)

- Effort: M; parallel group C; depends on: WP-01, WP-11
- Domains: platform, applications, ops, messaging, database
- Spec refs: platform-12,v02,v09; ops-18,32,50,v04; database-88,v07,v08; messaging-08,v04; billing-67; applications-40,74
- Needs owner: no

Repeatable jobs: llm_calls_ensure_partitions daily, llm_cost_rollup_day every minute, drop_old nightly, a default-partition alert; stuck-submitting sweeper (older than 10 minutes moves to needs_check, credit released, no resend); approved-cloud-without-job re-enqueue honouring the plan precheck; draft-without-lines redrive; unclassified-inbound redrive (and enqueue on duplicate delivery); sign-up bootstrap reconciler (profile, subscription, free grant); session and verification sweep.

**Acceptance:** Killing the applier mid-run leaves no row in submitting after 11 minutes; deleting a Redis job after approve is healed within 5 minutes; partitions exist 6 weeks ahead.

## WP-10: Billing correctness on today's path

- Effort: M; parallel group B; depends on: WP-00
- Domains: billing
- Spec refs: CISO shouldFix promo; billing-02..08,10,11,20,21,24,33,35,36,46,51,52,61,v01,v04,v05,v08; tests-13
- Needs owner: Stripe test-mode webhook registration for the 9 event types; coupon allowlist; refund and dispute policy.

Grant only when amount_paid > 0 or the coupon is in STRIPE_GRANT_COUPONS; throw (Stripe retries) on an unmapped price or missing user, with customer-id fallback; erased user resolves to ignored; refetch outside the transaction; 409 to the portal on double checkout; idempotency keys customer:<userId> and per checkout, INLINE_REQUEST; refuse production boot with a live key but no webhook secret; STRIPE_WEBHOOK_SECRET_PREVIOUS and explicit 300 s tolerance; past_due_since with 7-day grace in planFor; payment_failed sync; charge.refunded and dispute alert-only events; 402 details {available, requested}; free grant amount from plans.ts with a one-free-grant unique index.

**Acceptance:** A $0 invoice grants nothing; an unknown price returns 500 and is retried; two concurrent checkouts create one customer; a past_due user loses cloud after 7 days; a wrong-signature test returns 400.

## WP-11: Minimum detection and incident runbook

- Effort: M; parallel group B; depends on: WP-08
- Domains: ops, platform
- Spec refs: CISO mustFix 10; platform-43,44,45,46,50,53,v05,v06,v16; ops-37,72,73,74,v03; scale-27,28
- Needs owner: Approve Sentry Team and an uptime vendor (about $50-$80 a month) and choose the paging channel.

Sentry in api, worker and applier (beforeSend scrubbing, release tags); an external uptime check on /health and /api/health plus a worker and applier heartbeat; internal /health for worker and applier; graceful drain with deadlines (25/30/170 s); HTTP keepAlive 65 s and headers 66 s; Railway log alerts on 5xx rate, auth 429 spikes, inbound 401/403 bursts, applier allowlist refusals and admin_adjustment ledger rows; Anthropic and Railway spend alerts; docs/runbook/incident.md (who decides, secret rotation order, log export, user notice, GDPR 72 h and DPDP timelines).

**Acceptance:** A forced 500 reaches Sentry with no PII; stopping the worker pages within 5 minutes; a SIGTERM during a request completes it; the runbook is reviewed by the owner.

## WP-12: Database foundations: runner, roles, guards

- Effort: L; parallel group C; depends on: WP-01, WP-04
- Domains: database, platform
- Spec refs: CISO shouldFix roles, backstops; database-07..10,13,15,17..21,29,37,39,65,77,80,99,v01..v05,v10; platform-20,21,40,v10; billing-44,45,v02,v03; tests-41,48
- Needs owner: Superuser access for the role cutover on sd1; confirm the PgBouncer URL and Postgres version; migration numbering decision.

Per-file migration runner (advisory lock 7281551, lock_timeout 5 s with retries, '-- kairos:no-transaction', unpooled URL as kairos_migrator); expand-only linter, drizzle-kit check and an applied-hash check in CI; full ops/provision-roles.sql (migrator, api, worker, applier, readonly, metrics, backup) with a URL per process and per-role statement and idle timeouts; prepare:false if PgBouncer is in front; REVOKE UPDATE/DELETE on credit_ledger plus an immutability trigger; credit_ledger CHECKs and the invoice unique widened to (invoice, reason); status guard v1 and applications_approval_shape_ck; facts_guard with kairos.actor and asActor(); FK leading-column indexes; grant-matrix test T-12. Uses Postgres 17-compatible DDL until PG18 is confirmed.

**Acceptance:** A runtime role cannot UPDATE or DELETE credit_ledger; a worker-actor UPDATE setting facts.confirmed fails; an illegal status transition is rejected by the database; two concurrent deploys serialize migrations.

## WP-13: Postgres version, PITR, backups, restore drill

- Effort: M; parallel group C; depends on: WP-14
- Domains: database, platform, ops
- Spec refs: database-01..04,107; platform-18,22,v07; ops-62,63,65,66
- Needs owner: Paid Railway Postgres plan or PITR add-on; age key custody.

Run S-P1: confirm or move to PG18 on Railway with PITR on and pg_trgm and pg_stat_statements; parameters (max_connections 200, timeouts, autovacuum); nightly age-encrypted pg_dump of core tables to R2 plus a weekly full dump; a manifest check and backup-age alert; a timed restore drill with runbooks R-DR-1 and R-DR-2.

**Acceptance:** A restore of last night's dump into a scratch environment completes in under 60 minutes with matching row counts; PITR is confirmed in the Railway settings.

## WP-14: Object storage (R2) module

- Effort: M; parallel group B; depends on: WP-04
- Domains: platform, resume
- Spec refs: platform-64,78; resume-51; ops-64; CISO mustFix 8 (storage half)
- Needs owner: Cloudflare account, buckets and API tokens.

lib/storage.ts on @aws-sdk/client-s3: private buckets (uploads, renders, snapshots, backups), per-user key prefixes, tokens per bucket and process, lifecycle (renders 30 days, snapshots kept until erasure), an authorized download route with no-store, short presigned GETs for the applier only, prefix delete for erasure.

**Acceptance:** User B cannot fetch user A's object through any route; no public bucket exists; presigned URLs expire within 5 minutes.

## WP-15: Railway IaC and a production environment

- Effort: M; parallel group C; depends on: WP-11
- Domains: platform, ops, tests
- Spec refs: platform-28,29,39,41,v01,v12; ops-67; scale-01,v08,v09; tests-58,59,v06
- Needs owner: Railway production project and its cost; GitHub environments and secrets.

Move deploy config to IaC or the dashboard before 2026-12-01 (preDeploy migrate, healthchecks incl. worker and applier, ALWAYS restart, drain seconds 60/60/180, replica counts, NODE_OPTIONS heap per service); a separate production environment with sealed variables; release-branch promotion and a staging-gate workflow running the smoke script and the contract suite.

**Acceptance:** A config diff is visible in a PR; production deploys only via the promote workflow; the staging gate blocks on a failed smoke test.

## WP-16: R1-R4 shared contract and QA mock (D7 web-first)

- Effort: M; parallel group A; depends on: none
- Domains: resume, tests
- Spec refs: resume-79; tests-09,66; resume-suite README sections 11-12
- Needs owner: no

zod types in shared/ for /resumes, /resumes/:id/revisions, /resumes/tailor, /profile/imports, /templates, /resumes/:id/export, /tracker, contacts, interviews and insights; QA mock routes and fixtures with truth-lock enforcement; check-schemas in CI; shared plans.ts gets dailyScoringCap, matchCadenceMinutes and autopilotDailySendCap with an invariants test.

**Acceptance:** The web builds against the mock; check-schemas passes in CI; recorded mock fixtures later replay against the real routes.

## WP-17: R1 import pipeline and resume library

- Effort: XL; parallel group D; depends on: WP-05, WP-07, WP-12, WP-14, WP-16, WP-18
- Domains: resume, database, api-auth-security
- Spec refs: CISO mustFix 8; resume-56..58,60..62,65..67,70..77,v02..v05; database-112..116; api-auth-security-41,60; applications-88,89; tests-67
- Needs owner: Import limits for LinkedIn PDF exports; the over-slot-limit import rule.

Untrusted-file gate: 5 MB cap, magic bytes, extraction in a worker_thread (128 MB heap, 20 s kill), page and character caps, DOCX zip entry and ratio limits, no macros, XML with DTD and external entities off, scanned-PDF detection, fuzz corpus in CI. resume_imports with POST/GET /profile/imports and bulk confirm, facts.import_id and provenance, encrypted source. Multi-resume model (drop resumes_user_uq; kind, name, is_default, target_roles, base_resume_id, job_id; backfill), /resumes CRUD with /resume aliases, named revisions snapshot-before-change (before_ai, before_tailor), saved tailored copy per job, the pipeline starting from the best-matching base, and the sent snapshot frozen at approval.

**Acceptance:** A zip bomb, macro DOCX and hostile PDF are rejected within limits without killing the api; PRD R1 acceptance passes (DOCX import, confirmed-fact base, second base, tailored copy read-only after send, receipt shows the snapshot); the two-user matrix covers the new routes.

## WP-18: Encryption envelope and key custody

- Effort: M; parallel group C; depends on: WP-12
- Domains: database, messaging, resume
- Spec refs: CISO shouldFix encryption; database-33,34,84,v06; messaging-11,v10; platform-65; resume-57; api-auth-security-42; applications-12
- Needs owner: Who holds the second copy of DATA_KEKS and the backup key.

lib/crypto.ts: AES-256-GCM with versioned DATA_KEKS and row-bound AAD (table:id:column); dual-write and backfill for resume source_text and inbound text_body and preview, then drop the plaintext columns; a sensitive-answers encrypted store on the profile; an emergency kit and rotation runbook.

**Acceptance:** The plaintext columns are empty after the backfill; key rotation re-encrypts a test row; a lost-key drill follows the kit.

## WP-19: R2 renderer core, export and applier attach

- Effort: L; parallel group E; depends on: WP-14, WP-17, WP-04
- Domains: resume, applications, platform
- Spec refs: CISO mustFix 8 (rendering); resume-30,48..50,52,82,84,86,87,v01; applications-25,61,90; tests-61,v10; scale-51
- Needs owner: no

Typst pinned by SHA-256 in the worker image; a render queue on the worker (concurrency capped); user content passed as JSON sys.inputs only, --root set to a per-render temp directory, prlimit 256 MB, 10 s kill; the Classic template with A4 and Letter; resumePlainText shared by F1 and a text-layer round-trip check (unpdf); GET /resumes/:id/export (pdf, txt) with an ASCII-safe filename and no-store; snapshot PDF at approval with retries (render failure fails the send with no charge); the cloud applier attaches it via setInputFiles; the extension gets a short presigned URL.

**Acceptance:** 20 golden fixtures pass round-trip; a markup-injection fixture renders as text; a cloud send to the fake ATS uploads the snapshot PDF.

## WP-20: Eval harness and golden sets

- Effort: L; parallel group C; depends on: WP-06
- Domains: llm-agents, tests
- Spec refs: llm-agents-62,64,66,v07; tests-34,35,36,37; resume-v07; matching-v12
- Needs owner: Label about 100 cases per drafting agent (about 6 hours) and approve about $120 a month for evals.

server/evals with npm run eval: deterministic graders (schema validity, fact-id membership, number and entity containment, sensitive-question leakage, injection echo), golden sets seeded per agent (parser, tailor, writer, answer, letter, fit), recorded LLM fixtures (llm:record), and a path-triggered evals.yml with a $5 cap on the evals key.

**Acceptance:** A prompt change that raises the invented-detail rate above 0 fails CI; protected-question leakage is 0 across the set.

## WP-21: R4 job tracker

- Effort: XL; parallel group F; depends on: WP-17, WP-24
- Domains: resume, messaging, database
- Spec refs: resume-91..98,v10; database-117..123; messaging-60; applications-91; tests-70; llm-agents-73
- Needs owner: no

tracker_items (stage, fractional position, notes, salary_text, archive), application_events per the schema decision, contacts and contact_jobs (hard delete), interviews with .ics (escaped text, explicit time zone), insights gated by outcomeReport (counts under 5 hidden), forward-only automatic stage moves from drafts, submissions and routed replies; notes, salary and contacts are excluded from every prompt builder by a lint rule and a test; erasure and export inventory updated.

**Acceptance:** PRD R4 acceptance passes; a prompt-builder test proves tracker notes never reach runAgent; a drag into Applied is refused while approved or submitting.

## WP-22: Durable seam for money and sending (hybrid)

- Effort: L; parallel group D; depends on: WP-09, WP-12
- Domains: platform, applications
- Spec refs: platform-04,05,09,10,11,14,15,16,v03; ops-15,16,17,22,23,24,28,29; database-05,06,91; tests-57,v07
- Needs owner: Accept ADR-001 Revision 3 (path c) and the fallback trigger.

Run the Railway half of S-D1 (executor ids across redeploy, datasource behind PgBouncer, 50 crashes across 3 process types). If it passes: server/src/durable/ (launch per role, queues registered after launch, executor heartbeat, orphan recovery, WORKFLOW_SET_VERSION hash in CI, retention) scoped to money and sending, plus a kairos_dbos database and credentials. If it fails: a Postgres outbox drained by BullMQ (the pg-boss swap). Includes the process-kill chaos harness and a fake ATS.

**Acceptance:** The chaos harness runs 1,000 scripted approvals with random kills and one Postgres restart: every application terminal within 10 minutes, zero duplicate attempts, zero double charges.

## WP-23: Matching interim: scoring caps, prefilter, safe polling

- Effort: L; parallel group C; depends on: WP-06
- Domains: matching, llm-agents, scale
- Spec refs: CISO mustFix 3 (boards), shouldFix safe fetch; matching-02,08..14,27,28,43,49,55,59,60,61,69,84,86,v01,v02,v10,v14; llm-agents-31,v05; scale-08..12,v04..v06; database-v10
- Needs owner: Pin the per-plan caps; the source list for the about 2,000-company seed.

Imported companies created inactive (polled only to close stored jobs) with the jobImports allowance; eligibility (active 14 days, credits, billing not paused) plus dailyScoringCap and dailyModelSpendCapUsd enforced in user_daily_usage before each scoreFit, and a pause_scoring flag; a set-based SQL prefilter per job with paged users and F1 pre-rank floor 35 (20 at cold start); below_bar persistence; capped backfill on preference save and first confirmed resume; retryable AgentError becomes a delayed retry; safeFetchJson (https, exact hosts, redirect error, 2-24 MiB streamed cap, connect-time address check); ETag/304; per-host concurrency and 429/403 back-off with Retry-After; shrink guard and two-strike 404; reopen on conflict; Lever EU; due claim ORDER BY; NULLS LAST on imported matches; a companies seed script.

**Acceptance:** A 1,500-posting imported board triggers zero scoring calls; a 10k-user fixture scores at most the cap per user per day; a truncated listing closes nothing on first poll; the SSRF suite passes for board fetches.

## WP-24: Inbound messaging v2

- Effort: L; parallel group D; depends on: WP-10, WP-12
- Domains: messaging, applications
- Spec refs: messaging-03..06,09,10,12..17,20..26,31..35,v01..v03,v06,v07,v09,v13,v17,v19; platform-75
- Needs owner: The Postmark inbound domain (replies vs reply) and the S-G1 sample mail.

The inbound route moves to a path secret plus Basic auth with rotation; 400 rows per user per day flood cap; X-Spam-Score handling (restrict at 5, hide at 8); stripQuoted and original-sender extraction; a tiered domain-first linker with companies.domains; forward-only applications.stage and reply events; notifications table and routes; Gmail forwarding confirmation parser with a DKIM check (S-G1) and a status panel; rules golden file of at least 200 cases; integration tests.

**Acceptance:** 'Box' or 'Scale' substrings do not mislink; a spoofed Gmail confirmation without DKIM shows no link; 10 concurrent redeliveries store one row and one event.

## WP-25: Privacy: erasure, retention, scrubs, export

- Effort: L; parallel group D; depends on: WP-12, WP-14, WP-18
- Domains: database, billing, messaging, applications, ops
- Spec refs: CISO shouldFix deletion, scrub; database-81,95,100..106; billing-47..50; ops-51..57; applications-66,84,v06; messaging-38,v11; api-auth-security-52..55
- Needs owner: Counsel sign-off on retention periods, the backup tail and the grievance contact.

deletion_tasks workflow (sessions, Stripe cancel and customers.del, ledger archive keyed by a keyed userHash, batched delete, R2 prefix, contact_messages by email, llm_calls scrub, verify); a normalized-email tombstone checked before the free grant and replayed after restores; retention jobs (inbound bodies 180 days, hidden 30 days, contact 12 months, below_bar 30 days, jobs 180 days purge); sensitive-answer and receipt-value scrub 7 days after terminal status; redacted receipt evidence; an export-user script; stored consent records.

**Acceptance:** The erasure drill completes within 24 hours including a restore with tombstone replay; a re-sign-up with the same email gets no second free grant; scrubbed rows hold no EEO values.

## WP-26: Independent claim verifier

- Effort: L; parallel group E; depends on: WP-20
- Domains: llm-agents, applications, resume
- Spec refs: llm-agents-41,49,50,56,57,v02; applications-20,21,28; resume-20; tests-22
- Needs owner: no

claim-verifier (Haiku) and escalation (Sonnet, fail closed, 15% cap) agents with specs, strict schemas and verified_claims memo; truth repair with a doNotClaim list; prompt canary, shadow and model_pin; 7-day shadow then enforce on tailor, drafts and suggestions; a sync verifier on PATCH (8 s budget, stale on outage).

**Acceptance:** Shadow false-accept is at most 1% and false-reject at most 8% on the labelled set; enforce mode stores nothing unverified.

## WP-27: Ops flags, metrics and SLO plumbing

- Effort: L; parallel group D; depends on: WP-11, WP-12
- Domains: ops, platform, llm-agents, applications
- Spec refs: platform-52,53,56,57,v04,v15; ops-30,31,33,36,40,41,48; llm-agents-06,16,27; applications-53,87,v04,v05; scale-30..33
- Needs owner: no

ops_flags, feature_flags and ops_audit with a 10 s cache (pause_cloud_apply, pause_scoring, llm_paused, approvals_frozen, extension_only:<ats>, shed level); metrics_minute written by each job; route-group latency histograms and queue-lag gauges; SLO good/total counters and burn-rate alerts; hourly and nightly invariant checks (I-1..I-8, ledger drift, negative balance) that freeze approvals; a minimal admin surface (flags, request-info) behind ADMIN_USER_IDS with a fresh session.

**Acceptance:** Flipping pause_cloud_apply stops claims within 10 s without a deploy; an injected double charge freezes approvals and pages.

## WP-28: Load test stage 0 and stage 1

- Effort: M; parallel group C; depends on: WP-03, WP-06
- Domains: scale, tests
- Spec refs: scale-47,v12; tests-60; 06-infrastructure 9.7
- Needs owner: Staging spend for the test window.

Stage 0: k6 at 10/50/150/300 virtual users on staging (me, matches, applications) with 100 seeded users, req.ip check behind Vercel, connection counts at 1-3 replicas. Stage 1: an Anthropic stub with recorded latency and 429/529 injection, a fake ATS for 10,000 boards with ETag and Retry-After, scoring replay at 1x/2x/4x, applier RSS per context. Results recorded in docs/runbook/capacity.md.

**Acceptance:** 300 rps for 10 minutes with read p95 under 300 ms and no 429 for signed-in users; worker pool sized to concurrency; the report is committed.

## WP-29: Submission attempts, settlement and extension leases

- Effort: L; parallel group E; depends on: WP-22
- Domains: applications, billing, database
- Spec refs: applications-01,03,30,35,37..44,54,55,57,60,72..81,86,v01,v07; database-11,64..67,69,71,73,94; api-auth-security-47,50,v06,v08; tests-19,27,28
- Needs owner: no

submission_attempts with one open attempt per application and a forward-only phase guard; claim_cloud_attempt and definer functions for the applier (replacing the interim role); settleAttempt decision table with closeByPhase; failure_code catalog with RESENDABLE and AMBIGUOUS sets; late confirmation (failed to submitted, charged once); a 10-minute session-bound extension lease, POST claim and release, report acceptance rules; return-to-draft after 14 days; resend with acknowledgement and signed links (action_tokens, LINK_SIGNING_KEY); approve checks (posting closed, company cap, facts drift, billing paused); queueMatch guards; server-time submitted_at.

**Acceptance:** 50 forced crashes at random phases produce zero duplicate submissions and zero charges for unreported attempts; two tabs cannot send the same item.

## WP-30: API hygiene and contract

- Effort: M; parallel group D; depends on: WP-03, WP-05
- Domains: api-auth-security, tests
- Spec refs: api-auth-security-13,16,29,44,45,48,49,v03,v04,v07,v09,v10; tests-07,08,25,29; platform-37
- Needs owner: no

Keyset cursors on lists; per-route deadlines and a large-body permit; /api/health alias with draining; X-Kairos-Client and contract headers allowed in CORS; fresh-session requirement for approve, billing and autopilot; session pruning; contract suite level 2 (recorded statuses, shapes and error codes); a client-call extractor that fails on drift.

**Acceptance:** Rows beyond 200 are reachable by cursor; a contract shape change on a frozen route fails CI.

## WP-31: R3 writer v2

- Effort: L; parallel group F; depends on: WP-20, WP-17
- Domains: resume, llm-agents
- Spec refs: resume-18,88..90,v08; llm-agents-46,71; tests-69
- Needs owner: no

resume-writer@v2: level input, tag and priority outputs, headline scope with years computed in code from employments, Fix-spelling suggestions; deterministic post-checks for every refine mode; eval extension at every level; level-aware checks where the server stores a score.

**Acceptance:** The eval invented-detail rate is 0 at every level; the headline cites facts and its year count matches the code value.

## WP-32: Stripe store-then-process and credit balances

- Effort: L; parallel group E; depends on: WP-22, WP-10
- Domains: billing, database
- Spec refs: billing-12..19,23,37..39,41,43,55..59,v07; database-75,76,79,82; tests-14
- Needs owner: no

stripe_events with a status machine, minimized payload and redrive; per-customer serialized processing with an ordering guard (stripe_event_created); daily billingReconcile (missing grants over 7 days, drift, double-live subscriptions, grace expiry, price drift against plans.ts); credit_balances cache with triggers and a lock order; rollover expiry capped at 2x the grant; operator CLI with ops_audit.

**Acceptance:** A recorded Stripe replay produces identical ledgers; 14 clean days on test clocks; /api/me p95 under 300 ms for a 40k-row ledger user.

## WP-33: Offer-pause candidates with a 48-hour undo

- Effort: M; parallel group F; depends on: WP-24, WP-32
- Domains: billing, messaging
- Spec refs: billing-31,53,54; messaging-27..30,v14; database-83
- Needs owner: Confirm the 48-hour window and whether a pause also stops applying.

offer_pause_candidates (rule-tagged offer, domain-linked to a submitted application, spam under 5, active subscription, one pending per user); notice email and in-app notification; a signed single-use undo link (GET shows, POST acts); an executor that pauses after 48 hours with idempotency key pause:<user>:<email>; a pause_offer_candidates kill switch; portal resume clears applications_paused_at.

**Acceptance:** A newsletter mentioning an 'offer letter' creates no candidate; an undo click within 48 hours leaves Stripe untouched.

## WP-34: Matching v2

- Effort: XL; parallel group F; depends on: WP-23, WP-26
- Domains: matching, llm-agents
- Spec refs: matching-03..07,15..26,29..37,39..40,44,47,48,50..51,53..54,56..58,62..68,70..74,76..78,80,v03..v09,v11..v13; llm-agents-43,44,60,v09; resume-28,40,43
- Needs owner: no

normalizePosting (hashes, hints, simhash), families, jd-analyst job cards (claim-or-wait, injection-safe), ghost evidence and verdicts, user_match_state with cohort cadence, pacing and diversity, express lane and priority refresh, nightly F1 rescore, reconcile on preference change, injection canary, matching observability and eval sets, shadow comparison at 90% or more before cut-over.

**Acceptance:** Shadow reproduces at least 90% of old above-bar matches; scoring calls a day are within 20% of the cost model; the prefilter superset property test passes.

## WP-35: Outbound mail pipeline, unsubscribe and digests

- Effort: L; parallel group F; depends on: WP-24, WP-27
- Domains: messaging
- Spec refs: messaging-42..44,46..52,55,57,59,v08,v15,v16; database-85,86,46
- Needs owner: Consent defaults, sender postal address, CONTACT_ALERT_TO and ALERT_EMAIL_TO.

email_sends claim-before-send ledger with notify jobs and a reconcile; two Postmark streams with timeouts and tracking off; one-click unsubscribe (List-Unsubscribe-Post, signed token, mail_opt_out) shipped before any broadcast; saved searches and digests (F6), reminders, event emails; contact form dedupe with an alert through the queue; bounce and complaint suppression.

**Acceptance:** No broadcast is sent to an opted-out user; one OTP is never delayed more than 30 s by a digest burst; a duplicate notify produces one email.

## WP-36: Autopilot (opt-in, guarded)

- Effort: XL; parallel group G; depends on: WP-26, WP-29, WP-25, WP-27
- Domains: applications, llm-agents, messaging
- Spec refs: applications-45..52; llm-agents-65,74; matching-58; billing-26,30; messaging-50,51; ops-43,47; tests-54
- Needs owner: Consent text legal sign-off; Starter eligibility; autopilotDailySendCap values.

autopilot_settings with consent_version and a fresh session; match and draft hand-offs; ten guards in approveCore (verification, sensitive source, ghost, injection, freshness, daily cap, credits); spread delay with send_not_before; off switch returning unclaimed approvals; submission-health per ATS with a spike pause and global freeze; hourly summary emails. Opens only after 14 days of verifier enforcement with shadow false-accept at or below 1%.

**Acceptance:** Autopilot chaos: the off switch during a burst returns unclaimed approvals to draft and releases credits; Autopilot is off by default for every new user (test).

## WP-37: Paid-beta load and chaos gate

- Effort: L; parallel group G; depends on: WP-29, WP-32, WP-23, WP-28
- Domains: scale, tests, ops
- Spec refs: platform-77; scale-18,20,29,43..46,48; tests-60; ops-78; llm-agents-70
- Needs owner: Anthropic Scale tier application and ZDR; staging spend for 24 hours.

Growth topology (3 api, 4 worker, 8 applier) for 24 hours at 1.5x peak with an 8-hour soak, the scripted approvals driver, 10,000 Stripe events plus a burst, Postmark inbound replay, chaos (replica kills every 10 minutes, one Postgres restart, 429 storm, ATS 403 storm, a deploy mid-run); measure p95 per route group, queue waits, connections, checkpoint writes per application and cost per application.

**Acceptance:** S1-S9 met under load; zero duplicates or double charges; connections at or under 160 of 200; numbers within 25% of the capacity model; Anthropic tier and ZDR confirmed in writing.

## WP-38: Additional sign-in providers (optional)

- Effort: M; parallel group B; depends on: WP-02, WP-03
- Domains: api-auth-security
- Spec refs: api-auth-security-07..10; platform-63
- Needs owner: Apple Developer, GitHub and LinkedIn app credentials; only if the decision chooses all four.

Apple (client-secret JWT rotation, form_post callback, trusted origin), GitHub (verified primary email only, user:email) and LinkedIn OIDC (no profile import); env schema entries; account-linking tests per provider; unlink and list-accounts flows.

**Acceptance:** Each provider signs in through the Vercel origin; unverified provider emails never link to an existing account.

## WP-39: R2 templates and DOCX

- Effort: XL; parallel group F; depends on: WP-19
- Domains: resume
- Spec refs: resume-80,81,83,85,v09; tests-68
- Needs owner: DOCX library choice and template licensing (freehire MIT source).

Five more Typst templates (modern, serif, compact, executive, minimal) with accents at 4.5:1 contrast and A4 and Letter pagination; GET /templates registry and per-resume design settings; a DOCX renderer (Word heading styles, real lists, no tables) with a round-trip check via mammoth; export format docx.

**Acceptance:** All six templates pass golden round-trip in PDF and DOCX at both page sizes; the contrast check passes for every swatch.

## WP-40: Post-beta backlog (explicitly deferred)

- Effort: XL; parallel group H; depends on: WP-37
- Domains: ops, llm-agents, messaging, matching, platform, scale
- Spec refs: ops-01..14,44..46; llm-agents-32,51..53,61,v06; messaging-18,19,53,54,v05; matching-89,90,v15; platform-17; scale-43..45,50
- Needs owner: Scope and timing per item.

Interview rehearsal F9 and interview-coach, the outcome-analyst weekly report email (fix the PRD and pricing claim meanwhile), the reply-classifier model fallback, Anthropic usage reconciliation, model drift checks, extra ATS adapters F8, the dormant embeddings stage, Redis and BullMQ decommission, read replica and second Postgres triggers, plans beyond 50k users.

**Acceptance:** Each item gets its own ADR and package when its trigger fires (PRD release, measured recall under 0.85, 25k users, and so on).

