> FINAL CTO review of run wf_eac5a5ef-3a0 (2026-10-30), after the completeness-critic revision.

# Work packages

Architecture recommendation: Path (c), the hybrid, recorded as ADR-001 Revision 3 (WP-43). Keep today's Express API, Better Auth and BullMQ workers. They are built and wired: 7,363 lines in 107 files under server/src (measured 2026-10-30), 332 passing unit tests, the phase-A gateway, and the approved resume-suite D7 builds here. Add durable guarantees only where a lost step costs money or sends twice: approve, applyCloud, settlement, Stripe ingest and offer-pause. Do it in three steps. (1) Now, on today's stack: Postgres-backed reconcilers and sweepers (WP-09: stuck submitting, approved without a job, draft without lines, unclassified mail, missing grants, llm_calls partitions). Add worker and queue hardening on BullMQ (WP-45: per-queue concurrency, per-host and per-user limits, pool sizing, browser recycling, Redis noeviction check). These close the lost-enqueue and stuck-row holes within weeks and stay useful under any engine. (2) After the Railway half of spike S-D1 passes: a DBOS seam (server/src/durable/, WP-22) for the money and sending workflows only, behind a per-user flag, exiting on a 1,000-approval chaos test. If S-D1 fails, use a Postgres outbox drained by BullMQ (the pre-agreed pg-boss-style swap). (3) Polling, scoring, parsing, prepare, rendering and notify stay on BullMQ. The DBOS-only items (platform-02/03/06/07/08/13, scale-05/06/35/38) are either rebuilt on BullMQ in WP-45, WP-41 and WP-22, or explicitly deferred in WP-40. Redis decommission (P7) is deferred, not cancelled; its trigger is a measured load or operations problem. What each path costs: (a) ADR-001 as written, P0 to P8. Paid beta in about 6 to 7 months, and R1 to R4 built twice (once per D7, once ported). P1 alone bundles PG18, a driver swap, roles, DBOS, observability, backups and IaC into 2 weeks it cannot hold. It is the heaviest operations load for a solo founder, and it leaves the live risks (applier, spend, offer pause, sign-in) open until P1 to P5. (b) Pure evolution on BullMQ. No checkpointed steps on the money path: approve-then-enqueue stays two writes healed only by sweepers, and settlement after a crash in the middle of a submit depends on hand-written phase logic. Acceptable for a closed beta, weaker at 10k users and for Autopilot. (c) Hybrid. Two queue systems run for a while, and ADR-001's single-store simplicity (no Redis, one backup story) waits. That is a deliberate trade for shipping safely first. Estimated timing with AI agent lanes [L]: secure closed beta (waves 0 to B plus WP-09) in about 4 to 5 weeks; R1 server-side import in about 8 to 10 weeks; paid-beta gate (WP-37) in about 16 to 20 weeks; Autopilot after that. Owner review time is the binding constraint.

## WP-00: Emergency containment (today)

- Effort: S; parallel group 0; depends on: none
- Domains: api-auth-security, messaging, billing, applications, matching
- Spec refs: CISO mustFix 1(step 1),2,3(imported boards),5, small hygiene; messaging-27, v18; billing-33; api-auth-security-36; matching-84; resume-38
- Needs owner: Set the Anthropic Console spend limit and alert, and a Railway spend alert. Add OWNER_USER_IDS on sd1-api. Rotate INBOUND_WEBHOOK_SECRET in Postmark and Railway. Delete the local server/dump.rdb.

Owner-gate channel 'cloud' in approveApplications (submissions.ts:22) via OWNER_USER_IDS. Delete the Stripe pause block in classify-email.ts:34-40 (keep the offer tag) and fix the refunds page copy. Move the inbound token check into middleware before express.json, with inflate:false, 403 on failure and SHA-256 hashing of both sides before timingSafeEqual (webhooks.ts:17-21). Truncate TextBody to 16 KB and compute inbox previews in SQL (left(text_body,280)). Set allow_promotion_codes false (routes/billing.ts:35). Create imported companies with active:false (routes/jobs.ts:27-28), so pasted boards are no longer polled and scored for every user. Files: services/submissions.ts, jobs/classify-email.ts, routes/webhooks.ts (inbound), routes/inbox.ts, routes/billing.ts, routes/jobs.ts, web refunds page.

**Acceptance:** A Pro user approving cloud gets 403 while the owner succeeds. An offer email changes no Stripe state. A 50 KB gzip POST with a bad token returns 403 without parsing. The inbox route selects no full bodies. Checkout sessions have no promotion-code field. A newly imported board is stored inactive, and its postings trigger zero score-matches jobs.

## WP-01: CI truth and supply chain

- Effort: M; parallel group A; depends on: none
- Domains: tests, platform
- Spec refs: tests-02,05,10-13,18,20,39,42,44,45,52,55,v01,v04,v09; platform-31,33,35,36,76; 06-infrastructure 3.2
- Needs owner: no

Add a Postgres service to ci.yml with TEST_DATABASE_URL, so every *.int.test.ts runs as a required check. Mark known-defect tests as it.fails. Add the INV-5 failed-never-charged and Free-cloud-403 tests. Add a global network block in unit tests (undici MockAgent). Add a schema test that no mailbox scope or employer-password column exists (INV-6), and a CI check that fails any PR changing extension/src or the built filler hash (INV-16). Add gitleaks and osv-scanner jobs, pin actions by SHA, add .npmrc save-exact with exact pins, run npm ci --ignore-scripts, harden the api/worker Dockerfile (digest-pinned base, tini) and add server ESLint with boundary rules (SDK only in llm/, ledger writes only in credits). Files: .github/workflows/*, .npmrc, package.json files, server/Dockerfile, eslint config, server/test/*.

**Acceptance:** A PR that breaks the charge-once test fails CI. gitleaks and osv-scanner run on every PR. No caret ranges remain in server/package.json. A unit test that opens a socket fails. A PR touching extension/src fails the frozen-extension check.

## WP-02: Working auth end to end (email+OTP, Google)

- Effort: M; parallel group A; depends on: none
- Domains: api-auth-security
- Spec refs: api-auth-security-01..06,10,15,63; platform-62; CISO shouldFix staging sign-in and OAuth token encryption
- Needs owner: Set the Railway and Vercel env values, the Google console redirect URI and EXTENSION_ORIGIN. Confirm the provider decision.

Set BETTER_AUTH_URL and WEB_ORIGIN to the Vercel production origin and list preview origins explicitly. Route the Google redirect through the web origin. Fail the Vercel production build if API_ORIGIN is unset. Hide providers the API has not configured. Make account.accountLinking explicit and set encryptOAuthTokens true. Set maxPasswordLength 128 and revokeSessionsOnPasswordReset. Run the S-B1 header probe. Write scripts/smoke.mjs (sign up, verify OTP, sign in, GET /api/me through the Vercel URL). The 05-api 5.1 amendment is written in WP-43. Files: lib/auth.ts, web/next.config.ts, web auth components, scripts/smoke.mjs. No env.ts edits (values only).

**Acceptance:** The smoke script passes against staging through the Vercel domain for email+OTP and for Google. A pre-hijack test (unverified credential, then Google) does not link the accounts. The web shows only configured providers.

## WP-04: Applier containment

- Effort: L; parallel group A; depends on: WP-00
- Domains: applications, platform, api-auth-security
- Spec refs: CISO mustFix 1(2-7), shouldFix applier hygiene; applications-56,59,62,63,65,67,v01,v02,v07; platform-24,25,32,69,70,72; matching-18; tests-51,56,v02
- Needs owner: Run role provisioning as the Railway superuser. Remove the secrets from sd1-applier. Sign a risk acceptance if the sandbox fails.

Add envFor(role) schemas: the applier boots with only its DB URL, REDIS_URL, FILLER_SCRIPT_PATH and CHROMIUM_EXECUTABLE_PATH. This package also owns the env inventory additions (platform-25). Create the interim kairos_applier role via ops/provision-roles.sql. Build Lever and Ashby apply URLs from the validated token and posting id. Re-check https and the 5-host allowlist before goto. Add a page.route that aborts top-level navigation to other hosts. Launch with chromium.launch({chromiumSandbox:true}) and test it on Railway (S-AP4). Parse the result with submissionReportSchema, forcing applicationId to row.app.id. Add a 120 s outer race. Record post-click errors as needs_check, never resendable. Use coded failure reasons and never store err.message for users. Detect reCAPTCHA, hCaptcha and Turnstile and fail with no charge. Drop bypassCSP if addInitScript works on all three ATS. Add plan_lapsed and closed_at prechecks at claim. Add a browser disconnect handler. Use server time for submitted_at. Stop an extension 'failed' report from settling a cloud application that is submitting. Pin the applier image by digest and rebuild it on each Playwright release. Files: lib/env*.ts (split), jobs/cloud-apply.ts, applier.ts, services/ats/lever.ts, services/ats/ashby.ts, services/submissions.ts (report rules), Dockerfile.applier, ops/provision-roles.sql (applier part).

**Acceptance:** The SSRF fixture (internal host, metadata IP, javascript:) is refused. The applier container env holds no Stripe, Anthropic, Postmark, auth or webhook secret. The applier role cannot SELECT from user, session or credit_ledger beyond the granted columns. A challenge fixture fails with zero ledger rows. The web shows a catalog code, never raw exception text.

## WP-07: Truth lock and prompt redaction

- Effort: L; parallel group A; depends on: none
- Domains: llm-agents, resume, applications
- Spec refs: CISO mustFix 6,7, shouldFix re-parse; llm-agents-10,33,34,35,48,54; resume-06,19,44,55,59,63,64; applications-19,22; database-v09; api-auth-security-59
- Needs owner: Request ZDR and confirm the Anthropic DPA. Add Anthropic to the privacy notice.

Run inventedDetails on tailored lines (tailor.ts:54,73) and on PATCH and PUT line diffs. Add checkClaims v1: numbers, employers, titles, schools, dates, URLs, emails, phones and instruction phrases must appear in the cited facts. Run redactResumeHeader plus dropSensitiveLines (visa, work authorization, DOB, salary, government ids, disability, veteran status, gender, ethnicity) in processParseResume, with a seeded fail-closed test. Apply redactContact in the score and tailor prompt builders. Make the fence mandatory even without a userId. Fix the echo-canary false positives and the enum normalizer. On re-parse, delete only unconfirmed facts from the same import and move the onboarding step forward only. Block deleting a confirmed fact that is cited. Apply the gateway cover-letter caps (4 paragraphs, 250 words). Make the profile_only guard independent of answer.source. Files: services/tailor.ts, services/invented-details.ts to llm/claims.ts, llm/redact.ts, llm/fence.ts, llm/schema.ts, agents/*/render.ts, jobs/parse-resume.ts, services/draft-writer.ts, routes/applications.ts (PATCH and drafts guards), routes/resume.ts (PUT check), routes/profile.ts (fact delete).

**Acceptance:** Fixtures with an invented percentage, tool or employer are dropped on every path. The seeded sensitive-resume test sends none of those lines to the model. Re-parsing after a confirm keeps the confirmed facts. A drafts call for 'Email' after a PATCH still returns 422 profile_only.

## WP-08: Log and error hygiene

- Effort: S; parallel group A; depends on: none
- Domains: ops, platform
- Spec refs: CISO mustFix 9, hygiene (poll errors); platform-47,48,49; ops-70,71,v02; api-auth-security-21,22,37; matching-11 (codes)
- Needs owner: no

Add one pino err serializer: keep type, code and the message up to the params line, and drop params, query and cause bodies. Add *.text, *.textBody, *.sourceText, *.answers, *.resumeLines, *.coverLetter, *.messages and stripe-signature to REDACT_PATHS. Cut URL queries at '?'. Echo the request id in x-request-id and in the error envelope. Log userHash instead of the raw userId. Store poll errors as short codes (poll-boards.ts:72). Add a seeded DrizzleQueryError case to log-redaction.test.ts. Coded failure reasons for the applier are in WP-04. Files: lib/logger.ts, middleware/error-handler.ts, jobs/poll-boards.ts (error code line), test/log-redaction.test.ts.

**Acceptance:** The seeded failed-write test logs no resume text and no EEO value. Every response carries x-request-id, and the error envelope includes it.

## WP-16: R1-R4 shared contract and QA mock (D7 web-first)

- Effort: M; parallel group A; depends on: none
- Domains: resume, tests
- Spec refs: resume-79; tests-09,66; matching-59; billing-26; resume-suite README sections 11-12
- Needs owner: no

Add zod types in shared/ for /resumes, /resumes/:id/revisions, /resumes/tailor, /profile/imports, /templates, /resumes/:id/export, /tracker, contacts, interviews and insights. Add QA mock routes and fixtures that enforce the truth lock. Run check-schemas in CI. Add dailyScoringCap, matchCadenceMinutes and autopilotDailySendCap to shared plans.ts, at the spec values, with an invariants test. Files: shared/src/schemas*.ts, shared/src/plans.ts, web/scripts/qa/*.

**Acceptance:** The web builds against the mock. check-schemas passes in CI. Recorded mock fixtures later replay against the real routes. The plans.ts invariants test pins the cap table.

## WP-43: ADR-001 Revision 3, master README and spec amendments

- Effort: M; parallel group A; depends on: none
- Domains: platform, database, scale
- Spec refs: platform specGaps (no README, spec drift, P1 overload); database-14,124; scale-v07; api-auth-security-02; 01-architecture B.5, B.14; critic gaps 6, 10, 12
- Needs owner: Approve ADR-001 Revision 3 and the PRD-authoritative schema decision.

Write ADR-001 Revision 3 (path c, the S-D1 fallback trigger, the deferral list). Add the missing spec README master: decision, phase calendar mapped to these packages, precedence rule, id index. Amend 02-database, 05-api and workers 04/05 to the PRD shapes (resumes, revisions, application_events, render at approval, migration numbering, database-124). Fix the 05-api 5.1 BETTER_AUTH_URL semantics and the 5.5 x-vercel-id client-IP design. Write the 429 daily_allowance wording into the PRD. Add one master capacity table that reconciles the connection budgets (108/118/134, database-14) and the checkpoint-write budgets (751k/1.11M/1.33M, scale-v07), to be measured in WP-28. Fold the S-D1 corrections into 01 B.5. Mark cost-model.md superseded for prices. Record the tax and currency decision. Files: docs/superpowers/specs/2026-10-15-kairos-backend-design/* and the resume-suite README.

**Acceptance:** ADR-001 shows status Accepted (Revision 3). README.md exists and maps every phase to work packages. No spec still tells builders to set BETTER_AUTH_URL to the API origin or to trust x-vercel-id. One capacity table names the governing number for each figure.

## WP-03: Client IP, shared limiters, body caps

- Effort: M; parallel group B; depends on: WP-02
- Domains: api-auth-security, scale
- Spec refs: CISO mustFix 4, shouldFix x-vercel-id; api-auth-security-23..28,43,55,v01; platform-59,61,v08; database-30,92 (rate_limits); scale-21,22; billing-06,v06; messaging-09,v12
- Needs owner: Create KAIROS_EDGE_SECRET in Vercel and Railway.

web/proxy.ts sets x-kairos-edge (a secret) and x-kairos-client-ip. Express strips both unless the secret matches (timingSafeEqual); otherwise it uses the rightmost hop. Set Better Auth ipAddressHeaders and rateLimit.storage 'database'. Add a Postgres rate_limits store, using a plain additive migration on today's runner: anonymous traffic keyed by client IP, signed-in traffic by user (600/min), plus billing 10/10 min, webhook_ip and contact classes. Add per-email sign-in and OTP-send limits and a per-IP daily sign-up cap. Return 413 above 64 KB, and for chunked bodies without a length, on /api/auth. The AI-route limiter swap is in WP-30. Files: app.ts (sole owner in B), middleware/rate-limit.ts, new middleware/client-ip.ts, web/proxy.ts, lib/auth.ts (rate-limit options).

**Acceptance:** A forged x-vercel-id plus X-Forwarded-For sent directly to Railway cannot choose the IP. 300 signed-in users at 2 rps each see no 429. Limits hold across 2 api replicas and a redeploy.

## WP-06: AI spend ceilings, interim scoring controls, gateway live

- Effort: L; parallel group B; depends on: WP-07, WP-08, WP-16
- Domains: llm-agents, resume, matching, api-auth-security
- Spec refs: CISO mustFix 3; llm-agents-01,02,05,12,17,18,22,25,29,30,59,v01,v03,v05,v08; resume-21..25,34,47; matching-60,61,v02; scale-12,15,v01,v02; tests-31; api-auth-security-58
- Needs owner: Anthropic workspace keys and USER_HASH_KEY on Railway. Approve the S-A1 spend. Confirm the 429 decision.

Run the S-A1 live smoke, then set LLM_GATEWAY=anthropic on staging and production. Pass {userId, plan, jobId} from all six call sites. Add the input zod parse and maxInputTokens to runAgent. Add consumeAllowance and refundAllowance on ai_usage per feature (429 daily_allowance), with Kairos-Allowance headers. Map AgentError to 503 ai_unavailable, 422 ai_refused and 429 service_budget. Tier up only on schema, max_tokens, refusal or overload. Fix the budget_stopped error code and the limiter AIMD and empty-bucket bugs. Implement the five budget scopes with a 10 s cache, with shed level from env until WP-27. Remove the legacy key fallback. Route the tailor route to Haiku resume-tailor. Cap fact retrieval at 60/25. Interim controls on the old scoring loop: only users active in the last 14 days with credits and billing not paused; dailyScoringCap and dailyModelSpendCapUsd checked in user_daily_usage before each scoreFit; a PAUSE_SCORING env switch; a retryable AgentError becomes a BullMQ delayed retry. Add dedicated tests for budget, limiter, breaker, ledger and spend-store, and a gateway-spy test. Files: llm/*, services/allowance.ts (new), services/fit.ts, resume-writer.ts, resume-parser.ts, jobs/score-matches.ts, AI route call sites in routes/resume.ts, jobs.ts and applications.ts (drafts).

**Acceptance:** A scripted free account stops at its daily allowance with 429 across 2 replicas. Every model call writes an llm_calls row with a user_hash. A budget refusal never tiers up. A spy test proves zero calls for gate-failed pairs and for sensitive questions. A 10k-user fixture scores at most the per-plan cap per user per day.

## WP-10: Billing correctness on today's path

- Effort: M; parallel group B; depends on: WP-00
- Domains: billing
- Spec refs: CISO shouldFix promo; billing-02..08,10,11,20,21,23,24,33,35,36,51,52,61,v01,v04,v05,v08; tests-13
- Needs owner: Register the Stripe test-mode webhook for the 9 event types. Set the coupon allowlist and the refund and dispute policy.

Grant credits only when amount_paid > 0 or the coupon is in STRIPE_GRANT_COUPONS. Throw (so Stripe retries) on an unmapped price or a missing user, with a customer-id fallback. An erased user resolves to ignored. Refetch outside the transaction. Send a double checkout to the portal with 409. Use idempotency keys customer:<userId> and per checkout, plus INLINE_REQUEST. Refuse production boot with a live key but no webhook secret. Support STRIPE_WEBHOOK_SECRET_PREVIOUS with an explicit 300 s tolerance. Add subscriptions.past_due_since (additive migration) with a 7-day grace in planFor, payment_failed sync, alert-only handling of charge.refunded and disputes, and 402 details {available, requested}. The free-grant amount and its unique index move to WP-09 and WP-12. Files: routes/billing.ts, services/billing-events.ts, services/stripe.ts, the Stripe part of routes/webhooks.ts, services/submissions.ts (planFor, 402 details).

**Acceptance:** A $0 invoice grants nothing. An unknown price returns 500 and is retried. Two concurrent checkouts create one customer. A past_due user loses cloud after 7 days. A wrong-signature test returns 400.

## WP-11: Minimum detection and incident runbook

- Effort: M; parallel group B; depends on: WP-08
- Domains: ops, platform
- Spec refs: CISO mustFix 10, hygiene (/health detail); platform-43,44,45,46,50,53,v05,v06,v16; ops-37,72,73,74,v03; scale-27,28; api-auth-security-44,v04
- Needs owner: Approve Sentry Team and an uptime vendor (about $50-$80 a month) and choose the paging channel.

Add Sentry to the api, worker and applier, with beforeSend scrubbing and release tags. Add an external uptime check on /health and /api/health, a worker and applier heartbeat, and an internal /health for the worker and the applier. The public /health returns status only. Graceful drain with deadlines of 25/30/170 s. HTTP keepAlive 65 s and headers 66 s. Railway log alerts on 5xx rate, auth 429 spikes, inbound 401/403 bursts, applier allowlist refusals and admin_adjustment ledger rows. Anthropic and Railway spend alerts. Write docs/runbook/incident.md: who decides, secret rotation order, log export, user notice, GDPR 72 h and DPDP timelines. Also write the P1 runbook set (R-HEALTH-1/2, R-PG-1/4, R-DEPLOY-1..3). The other runbooks are each owned by the package that creates the risk; the full catalogue is in WP-40. Files: api.ts, worker.ts, applier.ts (process shell), routes/health.ts, Sentry hook in middleware/error-handler.ts, docs/runbook/*.

**Acceptance:** A forced 500 reaches Sentry with no PII. Stopping the worker pages within 5 minutes. A SIGTERM during a request lets it complete. The owner has reviewed the runbook.

## WP-14: Object storage (R2) module

- Effort: M; parallel group B; depends on: WP-04
- Domains: platform, resume
- Spec refs: platform-64,78; resume-51; ops-64; CISO mustFix 8 (storage half)
- Needs owner: Cloudflare account, buckets and API tokens.

Add lib/storage.ts on @aws-sdk/client-s3 with private buckets (uploads, renders, snapshots, backups), per-user key prefixes, a token per bucket and process, and lifecycle rules (renders 30 days; snapshots kept until erasure). Add an authorized download route with no-store, short presigned GETs for the applier only, and prefix delete for erasure. Files: lib/storage.ts, routes/files.ts (new).

**Acceptance:** User B cannot fetch user A's object through any route. No public bucket exists. Presigned URLs expire within 5 minutes.

## WP-18: Encryption library and key custody

- Effort: M; parallel group B; depends on: WP-04
- Domains: database, platform
- Spec refs: CISO shouldFix encryption; database-33,v06; platform-30,65; api-auth-security-42
- Needs owner: Decide who holds the second copy of DATA_KEKS and the backup key.

Add lib/crypto.ts: AES-256-GCM with versioned DATA_KEKS and row-bound AAD (table:id:column), a rotation helper, an emergency kit and a rotation runbook. Library only, with no DDL. The encrypted columns are created in WP-12 (profiles.sensitive_answers_enc), WP-17 (resume source) and WP-24 (inbound body and preview), each of which does its own dual-write and backfill. Dropping the plaintext columns is in WP-46. Files: lib/crypto.ts, docs/runbook/keys.md.

**Acceptance:** A round-trip test and a wrong-AAD test pass. Key rotation re-encrypts a test row. A lost-key drill follows the kit.

## WP-49: Missing agent specs and registry entries

- Effort: M; parallel group B; depends on: WP-43
- Domains: llm-agents
- Spec refs: llm-agents specGaps (only resume-parser specced), 42..53; resume specGaps; messaging-18,54; critic gap 12
- Needs owner: no

Write agents/02+ specs in the 01-resume-parser.md format: strict schema, prompt outline, postValidate rules, eval case format, envelope. Covers jd-analyst (JobCard schema), fit-scorer v2 (mustHaveHits, reason grounding), answer-drafter v2 (answers[] with abstain), cover-letter-writer, claim-verifier and claim-verifier-escalation (claim and verdict wire format, shadow storage), resume-writer v2 (level, tag, priority, headline) and reply-classifier (rules-first contract). outcome-analyst and interview-coach get stub specs marked deferred. Settle the resume-parser shape conflict (line ranges vs offsets). Add registry stubs that stay disabled until their package lands. Files: docs/.../agents/*.md, server/src/agents/registry.ts (disabled entries).

**Acceptance:** Every agent that WP-20, WP-26, WP-31, WP-34 and WP-41 depend on has a spec with a schema snapshot plan and eval format. The registry test passes with the new disabled entries.

## WP-05: Tenant isolation matrix and response serializers

- Effort: M; parallel group C; depends on: WP-01, WP-03, WP-07
- Domains: api-auth-security, tests
- Spec refs: CISO mustFix 11, shouldFix origin guard and serializers; api-auth-security-18,19,20,31,32,33,v02; tests-23,26; billing-60
- Needs owner: no

Add a CI test that seeds users A and B and calls every route in routes/index.ts with B's session on A's ids (expect 404 with the same body as a missing id) and with no session (expect 401). It fails when a route has no matrix entry. Add pick-list serializers for /api/me, applications, profile, resumes and credits: no Stripe ids, no plan cost fields, no raw payloads. Send Cache-Control no-store on authenticated JSON. Add originGuard (05-api 5.6, mounted after WP-03's chain). Accept only http(s) in URL fields. Files: routes/me.ts, routes/credits.ts, routes/profile.ts, routes/applications.ts (GET serializers), new lib/serializers.ts, middleware/origin-guard.ts, test/authz-matrix.int.test.ts.

**Acceptance:** The matrix covers 100% of mounted routes. A seeded marker in internal columns never appears in any response. A cross-site POST carrying a cookie gets 403 origin_not_allowed.

## WP-09: Scheduled maintenance and reconcilers (BullMQ)

- Effort: M; parallel group C; depends on: WP-01, WP-11
- Domains: platform, applications, ops, messaging, database, billing
- Spec refs: platform-12,v02,v09; ops-18,32,50,v04; database-49 (R-1,R-2 session and unverified purge),88,v07,v08; messaging-08,20,v04; billing-46,67; applications-40,74; llm-agents-26,v04; scale-36,v03
- Needs owner: no

Add repeatable jobs in jobs/schedules.ts, registered through the worker.ts schedule list:
- llm_calls_ensure_partitions daily, llm_cost_rollup_day every minute, drop_old nightly, and an alert if the default partition holds rows.
- A stuck-submitting sweeper: rows older than 10 minutes become failed/unconfirmed, the credit is released, nothing is resent.
- Re-enqueue approved cloud applications that have no job, honouring the plan precheck.
- Redrive drafts without lines and unclassified inbound mail (and enqueue on duplicate delivery).
- A sign-up bootstrap reconciler: profile, subscription and free grant, idempotent by NOT EXISTS, amount from plans.ts. auth.ts calls bootstrapUser().
- Session and verification sweep, and purge of accounts left unverified for 14 days.
Files: jobs/schedules.ts and new reconciler jobs, lib/auth.ts (bootstrap hook).

**Acceptance:** Killing the applier mid-run leaves no row in submitting after 11 minutes. Deleting a Redis job after approve is healed within 5 minutes. Partitions exist 6 weeks ahead. A user created with the grant hook failing gets the free grant within 5 minutes, exactly once.

## WP-12: Database foundations: driver, runner, roles, guards, profile schema

- Effort: XL; parallel group C; depends on: WP-01, WP-04
- Domains: database, platform
- Spec refs: CISO shouldFix roles, backstops; database-07..10,12,13,15..21,24,29,31,32,37,39,40,65,66(v1),77,80,89,98,99,v01..v05,v10; platform-19,20,21,40,v10,v11; billing-44,45,v02,v03; messaging-40; tests-04,41,48,v03
- Needs owner: Superuser access for the role cutover on sd1. Confirm the PgBouncer URL and the Postgres version. Confirm the migration numbering decision.

Swap postgres.js for pg@8.23.1 (exact pin) with the drizzle node-postgres migrator and update the test harness. Add a per-file migration runner: advisory lock 7281551, lock_timeout 5 s with retries, '-- kairos:no-transaction' headers, the unpooled URL as kairos_migrator. Reorganize db/schema per domain so packages touch separate files. Add an expand-only linter, drizzle-kit check and an applied-hash check in CI. Write the full ops/provision-roles.sql (migrator, api, worker, applier, readonly, metrics, backup) with a URL per process, per-role statement and idle timeouts, kairos_api unable to UPDATE or DELETE inbound_emails, and prepare:false behind PgBouncer. REVOKE UPDATE and DELETE on credit_ledger and add an immutability trigger. Add the credit_ledger CHECKs, widen the invoice unique key to (invoice, reason), add the one-free-grant unique index, status guard v1 and applications_approval_shape_ck. Add facts_guard with kairos.actor and asActor(). Add the full profiles column set and guards (database-31, 32) and the same-owner triggers. Add FK leading-column indexes, the grant-matrix test T-12 and the FK-index check. Uses Postgres 17-compatible DDL until PG18 is confirmed. Files: db/client.ts, migrate.ts, db/schema/*, ops/provision-roles.sql, test/helpers/test-db.ts, scripts/lint-migrations.mjs.

**Acceptance:** A runtime role cannot UPDATE or DELETE credit_ledger. A worker-actor UPDATE that sets facts.confirmed fails. An illegal status transition is rejected by the database. Two concurrent deploys serialize migrations. Every closed set has a named CHECK (database-98). The FK-index query returns zero rows.

## WP-13: Postgres version, PITR, backups, money journal, restore drill

- Effort: M; parallel group C; depends on: WP-14
- Domains: database, platform, ops
- Spec refs: database-01..04,107; platform-18,22,66,v07; ops-39,62,63,65,66
- Needs owner: A paid Railway Postgres plan or the PITR add-on. Custody of the age key.

Run S-P1: confirm PG18 on Railway or move to it, with PITR on, pg_trgm and pg_stat_statements. Set parameters: max_connections 200, timeouts, autovacuum. Add a nightly age-encrypted pg_dump of the core tables to R2, a weekly full dump, a manifest check and a backup-age alert. Add the 2-minute money journal (ledger, applications status, stripe_events) to R2 with a cursor and journal-reconcile. Run a timed restore drill using runbooks R-DR-1 and R-DR-2. Files: ops/pgbackup/*, jobs/money-journal.ts, docs/runbook/R-DR-*.md.

**Acceptance:** Last night's dump restores into a scratch environment in under 60 minutes with matching row counts. PITR is confirmed in the Railway settings. After a dump-only restore, journal replay brings the ledger to within 2 minutes of the failure.

## WP-15: Railway IaC and a production environment

- Effort: M; parallel group C; depends on: WP-11
- Domains: platform, ops, tests
- Spec refs: platform-28,29,39,41,v01,v12; ops-67; scale-01,v08,v09; tests-58,59,v06
- Needs owner: Railway production project and its cost. GitHub environments and secrets.

First verify against Railway's docs the spec's claim that railway.json stops being read on 2026-12-01; keep that date as the target either way. Move deploy config to IaC or the dashboard: preDeploy migrate, healthchecks including worker and applier, ALWAYS restart, drain seconds 60/60/180, replica counts, and NODE_OPTIONS heap per service. Create a separate production environment with sealed variables. Add release-branch promotion and a staging-gate workflow that runs the smoke script and the contract suite. Files: .railway/*, ops/railway-limits.json, .github/workflows/staging-gate.yml and promote.yml.

**Acceptance:** A config diff is visible in a PR. Production deploys only through the promote workflow. The staging gate blocks on a failed smoke test. The deadline source is cited in the PR.

## WP-20: Eval harness and golden sets

- Effort: L; parallel group C; depends on: WP-06, WP-49
- Domains: llm-agents, tests
- Spec refs: llm-agents-62,64,66,v07; tests-33,34,35,36,37; resume-v07; matching-v12
- Needs owner: Label about 100 cases per drafting agent (about 6 hours) and approve about $120 a month for evals.

Add server/evals with npm run eval. Deterministic graders: schema validity, fact-id membership, number and entity containment, sensitive-question leakage, injection echo. Seed golden sets per agent (parser, tailor, writer, answer, letter, fit), with recorded LLM fixtures (llm:record). Add per-agent render and postValidate unit tests, and a path-triggered evals.yml with a $5 cap on the evals key. Files: server/evals/*, server/test/agents/*, .github/workflows/evals.yml.

**Acceptance:** A prompt change that raises the invented-detail rate above 0 fails CI. Protected-question leakage is 0 across the set. Every enabled agent has render and postValidate tests.

## WP-28: Load test stage 0 and stage 1, budget reconciliation

- Effort: M; parallel group C; depends on: WP-03, WP-06
- Domains: scale, tests
- Spec refs: scale-47,v12; tests-60; platform-42; database-14; scale-v07; 06-infrastructure 9.7
- Needs owner: Staging spend for the test window.

Stage 0: k6 at 10/50/150/300 virtual users on staging against /api/me, /api/matches and /api/applications with 100 seeded users. Check req.ip behind Vercel and count connections at 1 to 3 replicas. Stage 1: an Anthropic stub with recorded latency and 429/529 injection; a fake ATS serving 10,000 boards with ETag and Retry-After; scoring replay at 1x/2x/4x; applier RSS per context. Extend the local stack (docker-compose) with the stub, the fake ATS, Mailpit and MinIO. Measure the connection budget and checkpoint writes per application to settle WP-43's table (database-14, scale-v07). Record results in docs/runbook/capacity.md. Files: ops/k6/*, ops/fake-ats/*, ops/anthropic-stub/*, docker-compose.yml, docs/runbook/capacity.md.

**Acceptance:** 300 rps for 10 minutes with read p95 under 300 ms and no 429 for signed-in users. The worker pool is sized to its concurrency. Measured connection use is recorded against the 200 limit. The report is committed.

## WP-45: Worker and queue hardening on BullMQ

- Effort: M; parallel group C; depends on: WP-04, WP-11
- Domains: platform, scale, applications
- Spec refs: platform-02,03,06,13,68 (BullMQ form); scale-06,34,35,v06,v12; applications-58; ops-17,28; critic gap 6
- Needs owner: no

BullMQ equivalents of the spec's queue catalog, so the hybrid keeps fairness without DBOS:
- A per-queue config table (concurrency, attempts, backoff, lockDuration greater than the run timeout, removeOn*).
- BullMQ limiter per queue.
- Applier per-host concurrency (Greenhouse, Lever, Ashby: 8 each) and 240 starts/min.
- Per-user fairness for score and prepare jobs via per-user jobId dedupe and chunked fan-out.
- Due-poll claim ordered by priority and oldest due, bounded by pending depth.
- A browser pool with recycling every 25 contexts and a memory watchdog.
- Pool size matched to in-process concurrency (scale-v12).
- An assertion at boot that Redis runs with maxmemory-policy noeviction.
- One Redis connection per process role.
Files: jobs/queues.ts, worker.ts (concurrency block), applier.ts (worker options), jobs/browser-pool.ts (extracted from cloud-apply.ts), db/client.ts pool option.

**Acceptance:** One user with 500 pending score jobs does not delay another user's job by more than one chunk. A Greenhouse 429 storm does not stall Lever runs. The applier recycles its browser after 25 contexts with no failed runs. Boot fails if Redis evicts.

## WP-47: Tax, billing address and portal configuration

- Effort: M; parallel group C; depends on: WP-10
- Domains: billing
- Spec refs: billing-52 (dunning),63,64,65; billing specGaps (taxes, portal, proration)
- Needs owner: Tax decision, registrations with an accountant, Stripe Tax activation.

Implement decision 7. Stripe Checkout gets automatic_tax, billing_address_collection and tax_id_collection; prices are tax-exclusive in USD. The Customer Portal configuration (allowed plans, proration mode, cancel at period end, pause off) is kept as a checked-in script. Dunning emails come from Stripe's settings. Mid-cycle upgrade credit behaviour is documented. If a merchant of record is chosen instead, this package becomes the integration spike. Multi-currency is deferred to WP-40. Files: routes/billing.ts (checkout options), scripts/stripe-portal-config.ts, docs/runbook/billing.md.

**Acceptance:** A test-mode checkout from an EU address shows the computed tax. The portal configuration is reproducible from the script. Upgrade behaviour matches the documented rule.

## WP-17: R1 import pipeline, resume library and identity schema

- Effort: XL; parallel group D; depends on: WP-05, WP-07, WP-12, WP-14, WP-16, WP-18
- Domains: resume, database, api-auth-security
- Spec refs: CISO mustFix 8; resume-02,10,15,17,41,56..58,60..62,65..68,70..75,78,v04,v05; database-34,35,36,42,43,44,47(superseded),48,49(R-3),112..115; api-auth-security-41,60; tests-67; scale-52
- Needs owner: Import limits for LinkedIn PDF exports; the over-slot-limit import rule.

Untrusted-file gate: 5 MB cap, magic bytes, extraction in a worker_thread (128 MB heap, 20 s kill), page and character caps, DOCX zip entry and ratio limits, no macros, XML with DTDs and external entities off, scanned-PDF detection, and a fuzz corpus in CI.
resume_imports with POST/GET /profile/imports, bulk confirm, import allowances, facts.import_id and provenance (asserted_by), and an employments table. Encrypted source (source_text_enc) with dual-write and backfill.
Multi-resume model per the PRD: drop resumes_user_uq; add kind, name, is_default, target_roles, base_resume_id, job_id; backfill existing rows. The PRD supersedes database-47 slot routines.
/resumes CRUD with /resume aliases, version and document_hash. The default document is employment-aware. A note becomes an unconfirmed fact.
Named revisions snapshot before each change (before_ai, before_tailor), with revision functions as the only writers. Saved tailored copy per job. ResumeSummary with a stored Resume check score. Stuck-parse reconciler, parse status surface and parse metrics.
Files: routes/resumes.ts, routes/imports.ts (new), services/import/*, workers/extract-thread.ts, jobs/parse-resume.ts, services/resume-doc.ts, db/schema/resume.ts migrations, routes/index.ts mounts.

**Acceptance:** A zip bomb, a macro DOCX and a hostile PDF are rejected within limits without killing the api. PRD R1 acceptance passes: DOCX import, confirmed-fact base, second base, tailored copy read-only after send, receipt shows the snapshot. The two-user matrix covers the new routes. Plaintext source_text is empty after the backfill.

## WP-22: Durable seam for money and sending (hybrid)

- Effort: L; parallel group D; depends on: WP-09, WP-12, WP-45
- Domains: platform, applications
- Spec refs: platform-04,05,07(money subset),08,09,10,11,14,15,16,v03,v15; ops-15,16,17,22,23,24,26,27,28,29; database-05,06,91,104; tests-46(checkpoints),57,v07; scale-05(subset)
- Needs owner: Accept ADR-001 Revision 3 (path c) and the fallback trigger.

Run the Railway half of S-D1: executor ids across redeploy, datasource behind PgBouncer, 50 crashes across 3 process types. If it passes, build server/src/durable/: launch per role, queues registered after launch, executor heartbeat, orphan recovery, the WORKFLOW_SET_VERSION hash in CI, retention, plus a kairos_dbos database and its credentials, scoped to money and sending. Add admin read and resume routes for durable workflows (resume refuses applyCloud past the browser step) and a PII scan of the checkpoint tables. If S-D1 fails, use a Postgres outbox drained by BullMQ. Also build the process-kill chaos harness. Files: server/src/durable/*, ops/provision-dbos.sql, routes/admin/workflows.ts, ops/chaos/*.

**Acceptance:** The chaos harness runs 1,000 scripted approvals with random kills and one Postgres restart: every application terminal within 10 minutes, zero duplicate attempts, zero double charges. The checkpoint PII scan finds no seeded marker.

## WP-25: Privacy: erasure, retention, scrubs, export

- Effort: L; parallel group D; depends on: WP-12, WP-14, WP-18
- Domains: database, billing, messaging, applications, ops
- Spec refs: CISO shouldFix deletion, scrub; database-49(R-6,R-12),81,95,100..106; billing-47..50; ops-51..57; applications-66,84,v06; messaging-38,v11; api-auth-security-52..55; tests-49(T-DB-5)
- Needs owner: Counsel sign-off on retention periods, the backup tail and the grievance contact.

A deletion_tasks workflow: sessions, Stripe cancel and customers.del, ledger archive keyed by a keyed userHash, batched delete, R2 prefix, contact_messages by email, llm_calls scrub, verification. A normalized-email tombstone checked before the free grant and replayed after restores. Retention jobs: inbound bodies 180 days, hidden 30 days, contact 12 months, below_bar 30 days, jobs 180-day purge. A sensitive-answer and receipt-value scrub 7 days after terminal status, and redacted receipt evidence. An export-user script and stored consent records. Erasure-verification and orphan-upload reconcilers. Files: jobs/erasure*.ts, jobs/retention*.ts, scripts/export-user.ts, db/schema/privacy.ts migrations, lib/auth.ts delete hook (after WP-09).

**Acceptance:** The erasure drill (T-DB-5) completes within 24 hours, including a restore with tombstone replay. Re-signing up with the same email gets no second free grant. Scrubbed rows hold no EEO values.

## WP-27: Ops flags, metrics, SLO plumbing and minimal admin

- Effort: L; parallel group D; depends on: WP-11, WP-12
- Domains: ops, platform, llm-agents, applications, matching
- Spec refs: platform-52,53,56,57,v04; ops-30,31,33,36,40,41,48; llm-agents-06,16,27,28; scale-16,30..33; applications-53,70,87,v04,v05; matching-30,73; api-auth-security-46(minimal),v03; resume-53; tests-46(logs); database-40(scan),90,92
- Needs owner: no

ops_flags, feature_flags and ops_audit with a 10 s cache: pause_cloud_apply, pause_scoring, llm_paused, approvals_frozen, extension_only:<ats>, shed level. metrics_minute written by each job. Route-group latency histograms and queue-lag gauges, including applier run metrics and alerts A-SUB. SLO good/total counters and burn-rate alerts. LLM envelope alarms (80% half-rate, 100% page), escalation caps and cost-per-submission alerts. Hourly and nightly invariant checks (I-1..I-8, ledger drift, negative balance) that freeze approvals. A nightly cross-tenant scan and a log/Sentry PII scan. A minimal admin surface behind ADMIN_USER_IDS with a fresh session: flags, request-info, and company activate/deactivate with ops_audit. Workspace and parse metrics hooks. Files: lib/flags.ts, lib/metrics.ts, jobs/invariants.ts, routes/admin/*, db/schema/ops.ts migrations.

**Acceptance:** Flipping pause_cloud_apply stops claims within 10 s without a deploy. An injected double charge freezes approvals and pages. The owner can activate an imported company and the audit row is written.

## WP-30: API hygiene and contract

- Effort: M; parallel group D; depends on: WP-03, WP-05
- Domains: api-auth-security, tests
- Spec refs: api-auth-security-13,16,24,26,29,44,45,48,49,v03,v04,v07,v09,v10; tests-07,08,25,29; platform-37
- Needs owner: no

Keyset cursors on lists. Per-route deadlines and a large-body permit. A /api/health alias with draining. X-Kairos-Client and contract headers allowed in CORS. A fresh session required for approve, billing and Autopilot. Session pruning. The AI-route limiter (ai_burst) moved to the shared Postgres store. Contract suite level 2 (recorded statuses, shapes and error codes) and a client-call extractor that fails on drift. Files: list routes (cursor clauses), middleware/deadline.ts, middleware/require-auth.ts kinds, routes/resume.ts limiter import (after WP-06), test/contract*.ts, scripts/extract-client-calls.mjs.

**Deviation (recorded by WP-30-builder):** the 05-api 2.2 route registry was not built; `test/helpers/authz-matrix.ts` keeps its `Router.prototype.use` patch, because Express 5 keeps no readable mount path and a declarative wrapper would touch every router file other builders edit. The "every mounted route has an entry" guarantee stands. Credits entries and the inbox `applicationId` filter are not paginated or added here.

**Acceptance:** Rows beyond 200 are reachable by cursor. A shape change on a frozen route fails CI. The ai_burst limit holds across 2 replicas.

## WP-38: Additional sign-in providers (optional)

- Effort: M; parallel group D; depends on: WP-02, WP-03
- Domains: api-auth-security
- Spec refs: api-auth-security-07..10; platform-63
- Needs owner: Apple Developer, GitHub and LinkedIn app credentials; only if the decision chooses all four.

Apple (client-secret JWT rotation, form_post callback, trusted origin), GitHub (verified primary email only, user:email) and LinkedIn OIDC (no profile import). Env schema entries, account-linking tests per provider, and unlink and list-accounts flows. Files: lib/auth.ts (after WP-09), web sign-in methods.

**Acceptance:** Each provider signs in through the Vercel origin. An unverified provider email never links to an existing account.

## WP-42: Schema expand: catalog, matching and application lifecycle

- Effort: XL; parallel group D; depends on: WP-12, WP-13
- Domains: database, matching, applications
- Spec refs: database-50..54,59..61,63(job_fresh_at deferred to WP-34),64,65,67,69,71/118,73,97,116; matching-04,17,23,55,v07; applications-03,54,86,89; critic gap 2
- Needs owner: The schema-authority decision (application_events shape).

The L4 lane lands the DDL that E and F packages build on:
- companies: scheduling and host columns (next_poll_at, etag, error streaks, api_host/apply_host/api_region, domains, discovered_by, inactive_reason) with backfill B-5.
- jobs: title_lc, location_lc, hints, content_hash, simhash, visible_at, closed_by, apply_url hosts CHECK. Trigram and visible_open indexes built CONCURRENTLY.
- normalizePosting as a pure function for backfill B-6.
- matches: spec columns, the below_bar enum value (a no-transaction file), matches_status_guard and backfill B-10.
- applications: lifecycle columns (row_version, draft_state, stage, failure_code, attempt_no, current_attempt_id, terminal_at, scrub fields, resume_snapshot, resume_file_key) with the CHECK set added NOT VALID then validated, new indexes, submission_attempts, and application_events in the decided shape (tracker or application link) with a services/events.ts insert helper. Backfill B-8 maps existing drafts to draft_state.
- uuidv7 defaults, only if PG18 is confirmed.
Family columns and job_fresh_at are left to WP-34. Files: db/schema/catalog.ts, matching.ts, submission.ts migrations, services/events.ts, services/normalize-posting.ts.

**Acceptance:** Migrations apply from 0000 and upgrade a seeded copy of staging with lock waits under 5 s. Backfills are idempotent. The status and approval-shape guards reject illegal rows. The prefilter query plan uses the trigram index on a 500k-job seed.

## WP-44: Outbound mail core, notifications and signed links

- Effort: L; parallel group D; depends on: WP-12
- Domains: messaging, api-auth-security
- Spec refs: messaging-31,42,43,44,46,56,57,59,v07,v08; api-auth-security-50,v08; database-85(email_sends, notifications),94; applications-83 (producer API); critic gap 3
- Needs owner: A Postmark broadcast stream, ALERT_EMAIL_TO and CONTACT_ALERT_TO.

An email_sends claim-before-send ledger (10-minute lease, 5 attempts, Postmark Metadata duplicate search with a lease-only fallback) and a notify BullMQ queue with priorities (OTP and transactional never behind broadcasts). Two Postmark streams and tokens with timeouts and tracking off. notify-reconcile. A notifications table, GET /api/notifications and POST /api/notifications/read, and unreadNotifications in /api/me. Signed single-use links: action_tokens and LINK_SIGNING_KEY, GET shows, POST acts, link rate class. Bounce and complaint suppression. Files: lib/mailer.ts, jobs/notify.ts, routes/notifications.ts, lib/action-tokens.ts, routes/links.ts, db/schema/messaging.ts migrations.

**Acceptance:** A duplicate notify produces one email. A digest burst never delays an OTP by more than 30 s. A signed link works once and a scanner GET never mutates. A complained address receives no further mail.

## WP-23: Matching interim: prefilter, safe polling, imported boards

- Effort: L; parallel group E; depends on: WP-06, WP-27, WP-42, WP-45
- Domains: matching, llm-agents, scale
- Spec refs: CISO mustFix 3 (boards), shouldFix safe fetch; matching-02,08..14,27,28,43,49,55,63(M-1..4),69,82,83,84,85,86,87,v01,v10; llm-agents-31; scale-08..11,v04,v05; database-v10; tests-50(boards)
- Needs owner: Pin the per-plan caps. The source list for the roughly 2,000-company seed.

Imported companies (discovered_by=import) are polled only to close the jobs already stored, never to insert or score, until the owner activates them through the WP-27 admin route. Enforce the jobImports allowance. Add a set-based SQL prefilter per job (trigram on title_lc/location_lc and the visible window) with paged users, and an F1 pre-rank floor of 35 (20 at cold start). The family NOT EXISTS clause and the full superset property are left to WP-34. Persist below_bar results. Capped backfill on preference save and on the first confirmed resume. safeFetchJson: https, exact hosts, redirect error, 2-24 MiB streamed cap, connect-time address check. ETag/304. Per-host back-off on 429 and 403 honouring Retry-After. A shrink guard, two-strike 404, reopen on conflict, Lever EU. A board_requests queue for unsupported URLs. The import flow runs gate, then scorer, then below_bar. ATS detection for gh_jid employer links, without fetching the pasted URL. Catalog reconcilers M-1..M-4. A companies seed script. Files: jobs/score-matches.ts, jobs/poll-boards.ts, services/ats/*, services/safe-fetch.ts, services/job-import.ts, services/job-url.ts, routes/jobs.ts (import), scripts/seed-companies.ts.

**Acceptance:** A 1,500-posting imported board triggers zero scoring calls until it is activated. A 10k-user fixture scores at most the cap per user per day. A truncated listing closes nothing on the first poll. The SSRF suite passes for board fetches.

## WP-24: Inbound messaging v2

- Effort: L; parallel group E; depends on: WP-10, WP-18, WP-42, WP-44
- Domains: messaging, applications
- Spec refs: messaging-03..06,09..17,21..26,32..36,v01..v03,v06,v09,v10,v13,v17,v19; database-84,85(forwarding_verifications); platform-75; tests-53
- Needs owner: The Postmark inbound domain (replies vs reply) and the S-G1 sample mail.

The inbound route moves to a path secret plus Basic auth with rotation. A flood cap of 400 rows per user per day. X-Spam-Score handling (restrict at 5, hide at 8). stripQuoted and original-sender extraction. Encrypted body and preview (dual-write and backfill with lib/crypto). A tiered, domain-first linker using companies.domains. Forward-only applications.stage and reply events through services/events.ts. Rules-only classification: classifyEmail step A keeps a disabled model hook, and the reply-classifier fallback is deferred in WP-40. A Gmail forwarding confirmation parser with a DKIM check (S-G1), forwarding_verifications, a status panel and the forwarding_code email through WP-44. A rules golden file of at least 200 cases and integration tests. Files: routes/webhooks.ts (inbound), jobs/classify-email.ts, services/email-classifier.ts, services/linker.ts, routes/forwarding.ts, routes/inbox.ts.

**Acceptance:** 'Box' or 'Scale' substrings do not mislink. A spoofed Gmail confirmation without DKIM shows no link. 10 concurrent redeliveries store one row and one event. The text_body plaintext column is empty after the backfill.

## WP-26: Independent claim verifier

- Effort: L; parallel group E; depends on: WP-20, WP-49
- Domains: llm-agents, applications, resume
- Spec refs: llm-agents-41,49,50,56,57,v02; applications-20,21; resume-20; tests-22
- Needs owner: no

claim-verifier (Haiku) and escalation (Sonnet, fail closed, 15% cap) agents with strict schemas and a verified_claims memo. Truth repair with a doNotClaim list. Prompt canary, shadow and model_pin. A 7-day shadow, then enforce on tailor, drafts and suggestions, wired into the service functions only. The synchronous PATCH verifier is in WP-41. Files: agents/claim-verifier*, services/verify.ts, verification hooks in services/tailor.ts, draft-writer.ts and resume-writer.ts.

**Acceptance:** Shadow false-accept is at most 1% and false-reject at most 8% on the labelled set. Enforce mode stores nothing unverified.

## WP-29: Submission attempts, settlement and extension leases

- Effort: L; parallel group E; depends on: WP-22, WP-42, WP-44
- Domains: applications, billing, database
- Spec refs: applications-01,02(BullMQ id),30,35,37..44,57,60,72..81,83,v01,v07; matching-42,76,v14; database-11,69,94; api-auth-security-47,v06; tests-19,27,28
- Needs owner: no

submission_attempts with one open attempt per application and a forward-only phase guard. claim_cloud_attempt and definer functions for the applier, replacing the interim role. settleAttempt decision table with closeByPhase. A failure_code catalog with RESENDABLE and AMBIGUOUS sets. Late confirmation (failed to submitted, charged once). A 10-minute session-bound extension lease, POST claim and release, and report acceptance rules. Return-to-draft after 14 days. Resend with acknowledgement and signed links (WP-44). Notify emails for resend_available and return_to_draft. Approve checks: posting closed, company cap, facts drift, billing paused, and draft readiness (legacy lines/answers proxy until WP-41 sets draft_state). Write the resume_snapshot at approval. queueMatch guards and NULLS LAST on the feed. Server-time submitted_at. Files: services/submissions.ts, services/settle.ts, jobs/cloud-apply.ts, routes/applications.ts (approve, withdraw, resend), routes/extension.ts, routes/matches.ts.

**Acceptance:** 50 forced crashes at random phases produce zero duplicate submissions and zero charges for unreported attempts. Two tabs cannot send the same item. Approval writes a snapshot that later edits do not change.

## WP-35: Unsubscribe, digests and event emails

- Effort: L; parallel group E; depends on: WP-27, WP-44
- Domains: messaging
- Spec refs: messaging-47..52,55,58,v15,v16; database-46,86
- Needs owner: Consent defaults and the sender postal address.

One-click unsubscribe (List-Unsubscribe-Post, signed token, mail_opt_out), shipped before any broadcast, plus authenticated email preferences. Saved searches and digests (F6), reminders, and event emails on the WP-44 notify core. Contact form dedupe, with the alert sent through the queue. Files: routes/unsubscribe.ts, routes/preferences.ts, jobs/digest.ts, jobs/reminders.ts, routes/contact.ts, db/schema saved_searches migration.

**Acceptance:** No broadcast is sent to an opted-out user. A preference toggle stops the digest the same day. A contact retry creates no second row.

## WP-19: R2 renderer core, export and applier attach

- Effort: L; parallel group F; depends on: WP-04, WP-14, WP-17, WP-29
- Domains: resume, applications, platform
- Spec refs: CISO mustFix 8 (rendering); resume-30,48..50,52,82,84,86,87,v01; applications-25(at approval),61,90; tests-61,v10; scale-51
- Needs owner: no

Typst pinned by SHA-256 in the worker image. A render queue on the worker with concurrency capped. User content is passed only as JSON sys.inputs, with --root set to a per-render temp directory, prlimit 256 MB and a 10 s kill. The Classic template in A4 and Letter. resumePlainText shared by F1 and a text-layer round-trip check (unpdf). GET /resumes/:id/export (pdf, txt) with an ASCII-safe filename and no-store. Per the PRD, the snapshot written at approval (WP-29) is rendered at claim time with retries; a render failure fails the send with no charge. The cloud applier attaches the PDF with setInputFiles, and the extension gets a short presigned URL. Files: services/render.ts, jobs/render.ts, templates/*, routes/resumes.ts export handler, jobs/cloud-apply.ts precheck and attach, server/Dockerfile.

**Acceptance:** 20 golden fixtures pass the round trip. A markup-injection fixture renders as text. A cloud send to the fake ATS uploads the snapshot PDF.

## WP-21: R4 job tracker

- Effort: XL; parallel group F; depends on: WP-17, WP-24, WP-29
- Domains: resume, messaging, database
- Spec refs: resume-91..98,v10; database-117..123; messaging-60; applications-91; tests-70; llm-agents-73; scale-54
- Needs owner: no

tracker_items (stage, fractional position, notes, salary_text, archive). Contacts and contact_jobs (hard delete). Interviews with .ics (escaped text, explicit time zone). Insights gated by outcomeReport, with counts under 5 hidden. Forward-only automatic stage moves come from a tracker projector job that reads application_events, without editing the producers. A lint rule and a test keep notes, salary and contacts out of every prompt builder. The erasure and export inventory is updated. Files: routes/tracker.ts, routes/contacts.ts, routes/interviews.ts, jobs/tracker-projector.ts, db/schema/tracker.ts migrations.

**Acceptance:** PRD R4 acceptance passes. A prompt-builder test proves tracker notes never reach runAgent. A drag into Applied is refused while approved or submitting.

## WP-31: R3 writer v2

- Effort: L; parallel group F; depends on: WP-17, WP-20, WP-26
- Domains: resume, llm-agents
- Spec refs: resume-18,88..90,v08; llm-agents-46,71; tests-69; scale-53
- Needs owner: no

resume-writer@v2: level input, tag and priority outputs, a headline scope with years computed in code from employments, and Fix-spelling suggestions. Deterministic post-checks for every refine mode, the eval extended to every level, and level-aware checks where the server stores a score. Files: agents/resume-writer/*, services/resume-writer.ts.

**Acceptance:** The eval invented-detail rate is 0 at every level. The headline cites facts and its year count matches the computed value.

## WP-32: Stripe store-then-process and credit balances

- Effort: L; parallel group F; depends on: WP-10, WP-22, WP-29
- Domains: billing, database
- Spec refs: billing-12..19,37..39,41,43,55..59,v07; applications-36; database-75,76,79,82; tests-14,49(T-DB-2)
- Needs owner: no

stripe_events with a status machine, a minimized payload and redrive. Per-customer serialized processing with an ordering guard (stripe_event_created). A daily billingReconcile: missing grants over 7 days, drift, double-live subscriptions, grace expiry, price drift against plans.ts. A credit_balances cache with triggers and the lock order; approveCore moves from the advisory lock to the balance-row lock (applications-36, billing-38/39 owned here). Rollover expiry capped at 2x the grant. An operator CLI with ops_audit. The T-DB-2 lock-order interleaving test. Files: services/credits.ts, services/billing-events.ts, approveCore lock in services/submissions.ts (after WP-29), jobs/billing-reconcile.ts, scripts/ops-billing.ts.

**Acceptance:** A recorded Stripe replay produces identical ledgers. 14 clean days on test clocks. /api/me p95 under 300 ms for a user with a 40k-row ledger. 1,000 interleavings produce no deadlock.

## WP-41: Prepare pipeline v2 on BullMQ

- Effort: XL; parallel group F; depends on: WP-06, WP-07, WP-18, WP-20, WP-26, WP-29, WP-42, WP-49
- Domains: applications, llm-agents, resume
- Spec refs: applications-04..10,12,14..17,21..24,26..29,31..33; llm-agents-43,47,58; matching-48,v06; scale-38; resume-v02; critic gap 1
- Needs owner: Confirm that sensitive auto-fill stays blank when the profile store is empty.

Worker 04 behaviour on BullMQ, behind a per-user PREPARE_V2 flag:
- loadAndPlan gates before any model call: posting closed, fewer than 3 confirmed facts (needs_facts), pause_drafting, llm_paused, agent_disabled, shed level.
- Base resume read through immutable revisions (PRD: best-matching base, before_tailor revision, tailored copy).
- Greenhouse questions=true into form_questions, and scanForm for Lever and Ashby as an applier-side BullMQ job (4 global).
- The jd-analyst job card, claim-or-wait.
- A deterministic question plan: sensitive answers only from profiles.sensitive_answers_enc, never a model; profile and attachment answers from fields; saved answers; free text through one answer-drafter v2 call with abstain.
- resume-tailor suggestion mode, cover-letter-writer in the pipeline, and deterministic fact retrieval (60/25).
- One truth-repair pass, and a store-nothing-unless-verified transaction with a row_version check and facts_snapshot_hash.
- markReady, reverifyDraft and the POST /:id/prepare retry route.
- The PATCH synchronous verifier (8 s, stale on outage).
- Deferral and reconcile-prepare.
- Prepare metrics and alerts A-PREP.
- The sensitive backstop and a gateway-spy test.
No rendering here: the snapshot is rendered at approval per the PRD (WP-19). Files: jobs/prepare.ts (replaces tailor-application.ts), services/question-plan.ts, services/draft-writer.ts, agents/jd-analyst, agents/answer-drafter v2, services/ats/greenhouse.ts questions, jobs/scan-form.ts, routes/applications.ts (PATCH and prepare).

**Acceptance:** The gateway spy proves zero model calls before the gate and zero for sensitive questions. 95% of drafts are ready within 60 s on the stub. A draft with an unverifiable line stores nothing and shows draft_issue. Sensitive answers in drafts come only from the profile store.

## WP-33: Offer-pause candidates with a 48-hour undo

- Effort: M; parallel group G; depends on: WP-24, WP-29, WP-32, WP-35
- Domains: billing, messaging
- Spec refs: billing-31,53,54; messaging-27..30,v14; database-83
- Needs owner: Confirm the 48-hour window and whether a pause also stops applying.

offer_pause_candidates: a rule-tagged offer, domain-linked to a submitted application, spam score under 5, active subscription, one pending per user. A notice email and in-app notification through WP-44. A signed single-use undo link (GET shows, POST acts). An executor that pauses after 48 hours with idempotency key pause:<user>:<email>. A pause_offer_candidates kill switch. Resuming through the portal clears applications_paused_at. Files: jobs/offer-pause.ts, routes/offer-pause.ts, db/schema migration (offer_pause_candidates).

**Acceptance:** A newsletter mentioning an 'offer letter' creates no candidate. An undo click within 48 hours leaves Stripe untouched.

## WP-34: Matching v2

- Effort: XL; parallel group G; depends on: WP-23, WP-26, WP-41
- Domains: matching, llm-agents
- Spec refs: matching-05..07,15,16,19,21,22,24..26,29,32..37,39,40,44,47,50,51,53,54,56..58,62..68,70..74,76..78,80,v03..v05,v08,v09,v11,v13; llm-agents-44,60,v09; resume-28,40,43; database-57,62,63
- Needs owner: no

Job families (SimHash, family NOT EXISTS clause, the full superset prefilter property), ghost evidence and verdicts, user_match_state with cohort cadence, pacing and diversity, an express lane and priority refresh, nightly F1 rescore, reconcile on preference change, an injection canary, matching observability and eval sets, job_fresh_at, and matches_shadow with a shadow comparison at 90% or better before cut-over. Reuses the jd-analyst job cards from WP-41. Files: services/matching/*, jobs/candidate-tick.ts, jobs/rescore.ts, jobs/refresh-priority.ts, db/schema matching migrations.

**Acceptance:** The shadow reproduces at least 90% of old above-bar matches. Scoring calls per day are within 20% of the cost model. The prefilter superset property test passes.

## WP-37: Paid-beta load and chaos gate

- Effort: L; parallel group G; depends on: WP-13, WP-23, WP-25, WP-28, WP-29, WP-32
- Domains: scale, tests, ops
- Spec refs: platform-77; scale-18,20,29,43..48; tests-49(remaining),60; ops-78; llm-agents-70; database-109
- Needs owner: Anthropic Scale tier application and ZDR; staging spend for 24 hours.

Growth topology (3 api, 4 worker, 8 applier) for 24 hours at 1.5x peak with an 8-hour soak. Drives scripted approvals, 10,000 Stripe events plus a burst, and a Postmark inbound replay. Chaos: replica kills every 10 minutes, one Postgres restart, a 429 storm, an ATS 403 storm, a deploy mid-run. Measures p95 per route group, queue waits, connections, writes per second, checkpoint writes per application and cost per application. Includes the hot-query plan test T-DB-11 on a growth-size seed and the remaining cross-domain DB tests. Files: ops/k6/*, ops/chaos/*, docs/runbook/capacity.md.

**Acceptance:** S1-S9 met under load. Zero duplicates or double charges. Connections at or under 160 of 200. Numbers within 25% of the capacity model. The restore drill (WP-13) and the erasure drill (WP-25) passed within the last 30 days. The Anthropic tier and ZDR are confirmed in writing.

## WP-39: R2 templates and DOCX

- Effort: XL; parallel group G; depends on: WP-19
- Domains: resume
- Spec refs: resume-80,81,83,85,v09; tests-68
- Needs owner: DOCX library choice and template licensing (freehire MIT source).

Five more Typst templates (modern, serif, compact, executive, minimal) with accents at 4.5:1 contrast and A4 and Letter pagination. A GET /templates registry and per-resume design settings. A DOCX renderer (Word heading styles, real lists, no tables) with a round-trip check via mammoth. Export format docx. Files: templates/*, services/render-docx.ts, routes/templates.ts.

**Acceptance:** All six templates pass the golden round trip in PDF and DOCX at both page sizes. The contrast check passes for every swatch.

## WP-36: Autopilot (opt-in, guarded)

- Effort: XL; parallel group H; depends on: WP-25, WP-26, WP-27, WP-29, WP-34, WP-35, WP-41
- Domains: applications, llm-agents, messaging
- Spec refs: applications-45..52; llm-agents-65,74; matching-58; billing-26,30; messaging-50,51; ops-43,47; scale-37; tests-54
- Needs owner: Legal sign-off on the consent text; Starter eligibility; autopilotDailySendCap values.

autopilot_settings with consent_version and a fresh session. Match hand-offs from scoreUser and draft hand-offs from markReady. Ten guards in approveCore (verification, sensitive source, ghost, injection, freshness, daily cap, credits). A spread delay with send_not_before. An off switch that returns unclaimed approvals. Submission health per ATS with a spike pause and a global freeze. Hourly summary emails. Opens only after 14 days of verifier enforcement with shadow false-accept at or below 1%. Files: services/autopilot/*, routes/autopilot.ts, jobs/submission-health.ts.

**Acceptance:** Autopilot chaos: flipping the off switch during a burst returns unclaimed approvals to draft and releases credits. A test proves Autopilot is off by default for every new user.

## WP-46: Post-beta contract migrations

- Effort: L; parallel group H; depends on: WP-17, WP-24, WP-25, WP-37
- Domains: database
- Spec refs: database-55,108; platform-65 (contract step); messaging-v10 (drop); critic gap 8
- Needs owner: no

Contract releases after soak: drop the resume source_text and inbound text_body plaintext columns once the encrypted columns have been read-verified for 14 days; FK RESTRICT for jobs.company_id and applications.job_id; SET NOT NULL on backfilled columns; drop the superseded indexes. Each change ships behind the '-- kairos:contract' header with a restore rehearsal on a staging dump. Files: db/schema/* contract migrations.

**Acceptance:** No plaintext copy of resume source or reply bodies exists in the database. Restore rehearsal T-DB-4 passes on a staging dump before each release.

## WP-40: Post-beta backlog and explicit deferral register

- Effort: XL; parallel group I; depends on: WP-37
- Domains: ops, llm-agents, messaging, matching, platform, scale
- Spec refs: ops-01..14,44..46,75,76; llm-agents-32,38,51..53,61,v06; messaging-18,19,53,54,v05; matching-89,90,v15; platform-02,03,06,07,08,13,17,51,54,74; scale-05,06,35,38,43..45,50; billing-64
- Needs owner: Scope and timing per item.

Explicitly deferred, each with its trigger:
- Interview rehearsal F9 and interview-coach (ops-01..14; a PRD non-goal).
- The outcome-analyst weekly email (fix the PRD 'Built' status and the pricing-page claim meanwhile).
- The reply-classifier model fallback (trigger: 'other' above 30% of replies).
- Anthropic usage reconciliation, model drift checks and canary evals.
- Grafana, OTel and LLM spans (platform-51, 54, ops-75, llm-agents-38; trigger: sustained multi-replica load or unexplained SLO burn).
- The full runbook catalogue (ops-76, platform-74).
- Extra ATS adapters F8 and the dormant embeddings stage (trigger: F1 recall under 0.85).
- Multi-currency.
- The DBOS versions of the worker, applier, queue catalog, workflow catalog and schedules (platform-02, 03, 06, 07, 08, 13, scale-05, 06, 35, 38; their BullMQ equivalents are WP-45, WP-41 and WP-22).
- Redis and BullMQ decommission (platform-17).
- Read replica, HA and a second Postgres (scale-43..45; trigger: 25k users or 60% CPU).
- Plans beyond 50k users.

**Acceptance:** Each item gets its own ADR and package when its trigger fires. Until then the register is kept in the spec README (WP-43).

