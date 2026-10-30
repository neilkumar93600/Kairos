> FINAL CTO review of run wf_eac5a5ef-3a0 (2026-10-30), after the completeness-critic revision.

# CTO Review: Completing the Kairos backend
**Date:** 2026-10-30 (revision 2, after the completeness critique)
**Scope:** 12 verified domain gap maps (platform, database, llm-agents, matching, applications, billing, messaging, resume, api-auth-security, ops, tests, scale). The CISO sign-off (approve-with-conditions, 11 must-fix items). Spot checks of server/src/jobs/cloud-apply.ts:20-74, jobs/classify-email.ts:34-40, routes/webhooks.ts:71-73, services/tailor.ts:51-54, services/submissions.ts:21-23 and routes/jobs.ts:27-28 (imported companies inserted with active: true), all of which confirm the findings. Server size measured this pass: 7,363 lines in 107 files under server/src.
**Confidence tags:** [H] verified in code or the maps. [M] inferred from verified evidence. [L] assumed: an estimate, not a measurement.

## Bottom line
Don't build ADR-001 as written, and don't let real users in yet. By a hand count of the ~1,080 items in the 12 maps, about 5% are built and wired and about 20% are partial or diverging. Counting partial items at half, the backend is roughly 15% of the target design [M].

Four things are dangerous today and all four are cheap to fix:
- an unsandboxed browser that holds every secret;
- uncapped Sonnet and Haiku spend, which imported boards make worse;
- a forwarded email that can pause billing;
- a 50 MB unauthenticated parse.

Fix those today and this week, and make sign-in work from Vercel. Then finish the backend on today's Express and BullMQ stack, and bring in a durable engine only for the money and sending path (option c). Verdict: **SHARPEN**.

**What we know, with confidence**
- [H] The cloud applier runs Chromium with Playwright defaults, so the sandbox is off (cloud-apply.ts:21). It sets bypassCSP (:56) and navigates to an applyUrl that comes straight from the Lever or Ashby payload (:59). It trusts the report the page returns (:61-65). All of this runs with one env for every process and an owner-level database credential.
- [H] Spend controls do nothing today:
  - LLM_GATEWAY defaults to legacy (env.ts:48).
  - No caller passes userId.
  - llm_cost_daily is never rolled up.
  - score-matches makes one model call per user with preferences for every new job.
  - Any user's pasted board becomes an active, polled, all-user-scored company (routes/jobs.ts:27-28).
- [H] classify-email.ts:34-40 pauses Stripe collection on any email tagged offer. webhooks.ts:71 parses up to 50 MB before it checks the token.
- [H] The integration tests that prove the money invariants exist, but never run in CI: ci.yml has no Postgres service.
- [M] Sign-in from Vercel probably fails because of configuration, not code. BETTER_AUTH_URL and WEB_ORIGIN must equal the Vercel origin. Also, Better Auth's shared 'no-trusted-ip' bucket allows only 3 sign-ins per 10 s for the whole site.
- [L] Timelines, based on the package efforts in the plan:
  - secure closed beta in about 4 to 5 weeks;
  - R1 server-side import in about 8 to 10 weeks;
  - paid-beta gate in about 16 to 20 weeks;
  - Autopilot after that.
  The Team section shows the arithmetic.

**Why.** The spec is good, but its order is wrong for a system that is already running:
- The applier's protections are scheduled for P5, yet the applier is deployed now.
- File import and rendering (D7) land before the P3 parser limits.
- The prepare pipeline that feeds the applier and Autopilot (worker 04) has no home outside DBOS.
- P1 is overloaded.
- The spec's capacity numbers contradict each other: connections are given as 108, 118 or 134; checkpoint writes as 751k, 1.11M or 1.33M.
- There is no master README.

**How to act.** Wave 0 today (WP-00 plus Console actions). Wave A (security, truth lock, CI, contract, ADR Revision 3) this week. Then wave B: limiters, AI ceilings, billing, detection, R2, the crypto library, agent specs.

**Your decision.** Seven owner calls are listed at the end. Two of them unblock everything:
- accept path (c) as ADR-001 Revision 3;
- replace "10K-1M requests per millisecond" with a measurable target.

## Scaling Cliff
**Current capacity [L], never measured; arithmetic shown**
- **API.** One api replica serves about 200 rps at about 5 ms CPU per request. Through the Vercel rewrite, though, the in-memory per-IP limiter (rate-limit.ts:7-19, trust proxy 1 at app.ts:22) probably puts every browser into one bucket of 120 requests per minute. That is about 2 rps for the whole site [M].
- **Scoring.** score-matches spends about 0.05 s of serial time per user with preferences, per job. With 3,000 jobs a day that is 150 s per user per day, against 4 slots × 86,400 s = 345,600 s. It saturates at about 2,300 such users.
- **Applier.** 2 contexts × 86,400 s ÷ 45 s per run ≈ 3,800 runs a day per replica.
- **Connections.** Today: 3 processes × pool 10 = 30. The growth topology (3 api + 4 worker + 8 applier = 15 processes) × 10 = 150. The maximum replica topology (6 + 8 + 16 = 30) × 10 = 300. That is against roughly 100 on Railway's default Postgres without PgBouncer tuning.

**Break points, in order**
1. Scoring fan-out spend: $206 to $413 a day at 10k users, with no cap. One large imported board alone costs $4k to $5k [M].
2. The shared IP limiter and the Better Auth bucket lock users out of sign-in on launch day [H].
3. Board polling has no ETag and no host caps, so Greenhouse throttles it. The applier's single Chromium has no crash reset [H].
4. The Anthropic Build tier caps spend at $1,000 a month against about $4,100 needed. That cap is reached at around 2,500 users [M].
5. At 10k users a single Postgres primary has only 1.3x CPU headroom, and needs a second database at about 25k users [L].

**What "10K-1M requests per millisecond" means**
- Taken literally it is 10 million to 1 billion requests per second.
- Demand derived from the product:
  - 10k users: 3,500 DAU × 617 requests a day ÷ 86,400 s × 6 (peak factor) ≈ 146 rps peak.
  - 100k users: 25,000 DAU ≈ 1,040 rps peak.
  - 1M users: 200,000 DAU ≈ 8,330 rps peak.
- So the literal ask is 1,200x to 120,000x real demand.
- For scale: Cloudflare publicly reports tens of millions of HTTP requests per second across its whole network [L, order of magnitude only].
- At 1M users the model bill alone is about $0.4M a month.
- Read per minute instead, it is 167 to 16,700 rps. The low end matches the 10k-user peak (146), and the high end is 2x the 1M-user peak. The unit was probably a slip.

**Recommended target**
- For the next 12 months: 10,000 registered users and 3,500 daily actives.
- Sustain 300 rps peak (2x derived demand), with a load-tested ceiling of 600 rps.
- p95 latency: reads under 300 ms, writes under 500 ms, auth under 800 ms.
- Zero duplicate sends or charges under chaos.
- Plan for 100k users at 2,000 rps (2x their derived 1,040 rps peak), but don't build for it yet.

**Capacity model at 10k users, growth topology**

| Resource | Demand | Limit | Conf. |
|---|---|---|---|
| API rps | 146 peak, 24 avg | about 600 (3 replicas × about 200) | [L] |
| Postgres connections | 15 processes; through PgBouncer the spec gives 108, 118 or 134 server connections (WP-43 reconciles; WP-28 measures) | max_connections 200, alert at 160 | [M] |
| DB writes/s | business rows about 17/s avg (1.5M/day); DBOS checkpoints add 13-15/s avg, 52-60 peak | spec trigger 400/s | [L] |
| Storage | matches about +55M rows/yr; llm_calls 260k rows/day (90 days kept); inbound bodies about 5 GB per 180 days; spec ceiling 108 GB in year one | 150 GB volume, alert at 70% | [L] |
| Anthropic | 225k calls/day, 800 RPM peak | fleet buckets 1,650 RPM (4×300 + 3×150); Build tier spend cap $1,000/mo vs about $4,100 | [M] |
| Email | 95k to 213k a month (06 vs workers/12, not reconciled) | Postmark; SES above about 100k | [L] |
| R2 | sent snapshots about 20k/day × about 100 KB ≈ 60 GB/month (about $1/month); renders kept 30 days | none at this scale | [L] |
| Redis | BullMQ only, under 100 MB | single instance, a single point of failure until WP-40 | [L] |

**Load-test gate**
- **Stage 0, now (WP-28):** k6 at 10/50/150/300 virtual users, a check of req.ip behind Vercel, and connection counts at 1 to 3 replicas.
- **Stage 1 (WP-28):** an Anthropic stub, a fake ATS, 10k seeded users, and reconciliation of the spec's connection and checkpoint budgets (database-14, scale-v07).
- **Stage 2 (WP-37), before paid beta:** 24 h at 1.5x peak with chaos.
- **Pass means:** SLOs met, zero double charges, every application terminal within 10 minutes, connections at or under 160 of 200.

**Headroom after the plan:**
- api about 4x [L]; the spec's ">10x" is wrong.
- Apply slots: 32 against a 21.5 peak.
- Anthropic: a 1,650 against 800 RPM fleet ceiling, once the tier is raised.

## Tech Debt
tech_debt_analyzer.py takes no input file (it has no argparse and only prints a hardcoded demo), so no input JSON was written. The formula **priority = (severity 1-5 × blast radius 1-5) ÷ cost in engineer-days** was applied by hand:

| Debt item | Sev | Blast | Days | Score |
|---|---|---|---|---|
| Imported boards created active and scored for all users (jobs.ts:27-28) | 4 | 4 | 0.1 | 160 |
| Offer email pauses Stripe (classify-email.ts:34-40) | 4 | 4 | 0.25 | 64 |
| Cloud channel open to every paying user (interim owner gate) | 5 | 5 | 0.5 | 50 |
| Inbound webhook parses 50 MB before auth | 4 | 5 | 0.5 | 40 |
| Integration tests skipped in CI | 4 | 5 | 0.5 | 40 |
| tailor.ts skips inventedDetails | 5 | 4 | 0.5 | 40 |
| llm_calls partitions end about 2026-12-07, never scheduled | 3 | 3 | 0.5 | 18 |
| Stuck 'submitting' rows hold credits forever | 4 | 3 | 1 | 12 |
| AI spend ceilings (gateway on, userId, allowance) | 5 | 4 | 2 | 10 |
| Client IP and shared limiters | 4 | 5 | 2 | 10 |
| DB roles and append-only ledger | 4 | 5 | 3 | 6.7 |
| Full applier containment | 5 | 5 | 4 | 6.3 |
| Full DBOS re-architecture (ADR-001 P1-P8) | 3 | 5 | 60 | 0.25 |

- **Top item.** By risk: the applier. One renderer bug means a breach of every user's data plus the Stripe and Anthropic keys [H]. By score: the one-line imported-board fix, then deleting the offer pause.
- **Cost per week** (CISO estimates [L]):
  - Applier exposure: $10k to $225k expected loss a year, about $0.2k to $4.3k a week.
  - AI spend abuse: $5k to $50k a year. One scripted free account can burn $160 to $720 a day.
  - Both are near zero while there are no users. Both switch on the day the product launches.
- **Blocking dates:**
  - llm_calls partitions run out around 2026-12-07 [H] (WP-09).
  - The spec says Railway stops reading railway.json on 2026-12-01. It is tagged [V] there, but I could not check it against Railway's docs. WP-15 verifies it first and keeps the date as a safe target either way.
  - The Anthropic Build-tier cap starts to bind near 2,500 users [M].
- **Debt ratio.** For the next 6 to 8 weeks about 60% of capacity goes to risk and foundations. It should drop below 25% after wave D.

## Team
You are a solo founder working with AI agents, so the plan divides work into lanes and parallel groups rather than headcount.

**Lanes**
| Lane | Packages |
|---|---|
| L1 Security and auth | WP-00/02/03/04/05/08/38 |
| L2 Money and sending | WP-09/10/22/29/32/33/36/47 |
| L3 AI and truth | WP-06/07/20/26/31/41/49 |
| L4 Data and platform | WP-01/11/12/13/14/15/18/25/27/28/42/43/45/46; also merges every hub-file change |
| L5 Resume suite | WP-16/17/19/21/39 |
| L6 Matching and messaging | WP-23/24/34/35/44 |

**File ownership**
- Every package lists the files it owns. Within one parallel group, one package owns each logic file.
- Pairs that collide are run in sequence through dependsOn:
  - cloud-apply.ts: WP-04, then WP-29, then WP-19;
  - approveCore and credits: WP-29, then WP-32;
  - auth.ts: WP-02, then WP-03, then WP-09, then WP-38;
  - application_events DDL in WP-42, before its writers WP-24, WP-29, WP-41 and WP-21.
- **Hub files** take small, append-only edits from several packages:
  - migrations, the Drizzle journal and db/schema/*.ts (split per domain in WP-12);
  - lib/env*.ts and .env.example;
  - routes/index.ts;
  - app.ts middleware order;
  - lib/errors.ts and middleware/error-handler.ts;
  - the worker.ts schedule list;
  - shared/src/plans.ts.

  These merge one pull request at a time through the L4 lane, which allocates migration numbers and regenerates the journal on rebase. Two packages in the same group never change the same table.

**Rules**
- One pull request per package.
- The CI integration job is a required check.
- Every money, migration or security package gets your review.
- No agent changes extension/.

**Capacity arithmetic [L]**
- Effort per package: S = 1-2 agent-days, M = 3-5, L = 6-10, XL = 12-20.
- Critical path to R1: WP-04 (L) → WP-12 (XL) → WP-17 (XL), about 8 to 10 weeks.
- Critical path to the paid-beta gate: WP-12 → WP-42 / WP-22 → WP-29 → WP-32 → WP-37, about 14 weeks at ideal parallelism. Budget 16 to 20 weeks because of review load.
- Waves 0 to C contain about 25 owner actions: secrets, platform settings, vendor sign-ups.
- Your time is the real bottleneck: about 4 to 6 hours a week, plus about 6 hours once to label eval cases (WP-20).
- On-call: until paging exists, the cloud channel and Autopilot run only during hours you are reachable.
- Bus factor is 1. WP-11 (runbook) and WP-18 (emergency kit with the key copies) are the mitigation.

## Build vs Buy
| Component | Decision | 3-year TCO [L] | Core or context |
|---|---|---|---|
| Durable execution | Postgres sweepers and BullMQ hardening now. DBOS Transact (OSS library on your own Postgres) for money and sending after S-D1, with outbox plus BullMQ as the fallback. Temporal Cloud rejected: $7k-$36k, a full rewrite, and data leaves the platform. | about $0 license; 2-3 engineer-weeks | Context |
| Auth | Keep Better Auth. Add database rate-limit storage and OAuth token encryption. Clerk would cost about $2k-$7k a year plus a migration. | $0 | Context |
| Email | Postmark with two streams. Switch to SES above about 100k messages a month. | $4k-$9k | Context |
| Storage | Cloudflare R2: private buckets, per-user prefixes, short presigned URLs. | under $1.5k | Context |
| PDF/DOCX | Build on Typst in the worker plus an MIT DOCX library. DocRaptor rejected: resume data would leave the platform. | worker CPU $20-$40/month | **Core** |
| Observability | Buy Sentry Team (with a $50 overage cap), an external uptime and heartbeat monitor, and Railway log alerts. metrics_minute and SLO counters are built in-house (WP-27). Grafana and OTel are deferred to WP-40 until there is sustained multi-replica load or SLO burn that metrics_minute can't explain. | about $2.7k-$4k | Context |
| Tax | Stripe Tax if decision 7 picks it (about 0.5% of volume); a merchant of record is the alternative. | volume-based | Context |
| Model provider | Anthropic. Raise to the Scale tier before 2,500 users and sign ZDR. | about $49k a year at 10k users | Context (prompts and evals are core) |

## Reliability
**Proposed SLOs (30-day windows)**
- **S1 API availability:** 99.5%, a 216-minute budget. 99.9% for approve, submission report, the Stripe webhook and the inbound webhook.
- **Latency p95:** reads 300 ms, writes 500 ms, auth 800 ms, AI routes 14 s.
- **Pipelines:**
  - S3: 95% of drafts ready within 60 s.
  - S4: 95% of approved cloud attempts started within 10 minutes.
  - S5: 99.9% of attempts settled within 10 minutes.
  - S7: 99.9% of Stripe events processed within 10 minutes.
  - S8: 99% of replies classified within 10 minutes.
- **Hard invariants, not SLOs:** zero double charges, zero duplicate sends, zero negative balances, zero ledger drift.

**Error-budget policy**
- At 50% of the S1 or S5 budget burned, only reliability work ships.
- At 100% burned: roll back, write a postmortem within 48 hours, and freeze features for 7 days.
- Any breach of a money invariant sets approvals_frozen and pages you.
- Revisit all values after 60 days of beta data.

**Recovery, stated honestly**
- RTO is 2 hours.
- RPO depends on what is in place:
  - With only nightly dumps (WP-13 before PITR is confirmed), RPO is 24 hours.
  - With Railway PITR confirmed on (WP-13), RPO is minutes.
  - The 2-minute money journal to R2 (WP-13, ops-39) brings ledger and application state to about 2 minutes even after a dump-only restore.
- Until WP-13's restore drill passes, do not promise any RPO.

## Security
**CISO status: approve-with-conditions [H].** Three things stay blocked until the 11 must-fix items are closed and verified on staging: public launch, real user data in sd1, and cloud sends for anyone but you.

**Must-fix, mapped to packages**
1. Contain the applier → WP-00 (owner gate) and WP-04.
2. Check the secret before parsing and cap bodies → WP-00 and WP-03.
3. AI spend ceilings → Console cap and imported boards inactive (WP-00); allowance, 14-day-active scoring and per-user spend stop (WP-06); close-only polling and the jobImports allowance (WP-23); the company activation admin route (WP-27).
4. Client IP and limiter storage → WP-03.
5. Remove the offer pause → WP-00.
6. Redaction before Anthropic → WP-07.
7. Truth lock on tailored lines → WP-07.
8. Untrusted-file gate → WP-17 and WP-19.
9. Logs → WP-08.
10. Detection and runbook → WP-11.
11. Two-user authorization test → WP-05.

**Should-fix items, carried into packages**
| Item | Package |
|---|---|
| DB roles and append-only ledger | WP-12 |
| x-vercel-id design fix | WP-03 plus the 05-api amendment in WP-43 |
| Erasure and tombstones | WP-25 |
| $0-invoice grant | WP-00 and WP-10 |
| OAuth token encryption | WP-02 |
| Data encryption | WP-18 library; WP-17 and WP-24 dual-write; WP-46 drops the plaintext |
| Re-parse keeps confirmed facts | WP-07 |
| Safe fetch | WP-23 |
| Database backstops | WP-12 |
| Staging origins and account linking | WP-02 |
| Sensitive-answer scrub | WP-25 |
| Supply chain | WP-01 and WP-04 |
| Origin guard and serializers | WP-05 |
| Small hygiene: token-length leak, dump.rdb, poll error codes, public /health detail | WP-00, WP-08, WP-11 |

**Your actions**
- Request ZDR and confirm the Anthropic DPA.
- Name Anthropic as a sub-processor in the privacy notice.
- Rotate INBOUND_WEBHOOK_SECRET.
- Sign a written risk acceptance if the S-AP4 sandbox test fails on Railway.

## Verdict
**SHARPEN** against "proceed to build as planned".
- The target security and data design is sound, and the CISO approves continuing.
- The ADR-001 order (P0 to P8, DBOS first) leaves the live risks open for months, and it conflicts with D7.
- Re-scope to path (c): front-load the 11 must-fix items and working auth, give the prepare pipeline and the BullMQ worker explicit owners, then build.

## Next Steps
1. **Today:**
   - Set a monthly spend limit and alert in the Anthropic Console, and a Railway spend alert.
   - Merge WP-00: owner-gate the cloud channel; delete the offer pause; check the inbound token (hashed compare) before parsing; create imported companies inactive; turn promotion codes off.
   - Set BETTER_AUTH_URL and WEB_ORIGIN to the Vercel production origin, and set the Google redirect URI to https://<web>/api/auth/callback/google.
   - Confirm whether LLM_GATEWAY and PgBouncer are in use on sd1.
2. **This week:**
   - Accept path (c), the 10k-user / 300 rps target and the schema-authority decision.
   - Start wave A in parallel: WP-01, 02, 04, 07, 08, 16, 43.
3. **Before any R1 server route merges:**
   - WP-03, WP-05, WP-06, WP-11 and WP-12 are done.
   - The staging smoke test passes: sign-up through the Vercel URL, then GET /api/me.
   - k6 stage 0 is green.

## Work packages
See workPackages. Groups 0 → I run roughly as waves, and packages within one group can run at the same time.

- **New in this revision:**
  - WP-41: the prepare pipeline v2 on BullMQ.
  - WP-42: schema expand for catalog, matching and the application lifecycle, ahead of WP-23 and WP-29.
  - WP-43: ADR-001 Revision 3, the master README and the spec amendments.
  - WP-44: outbound mail core, notifications and signed links, ahead of WP-24 and WP-29.
  - WP-45: worker and queue hardening on BullMQ.
  - WP-46: post-beta contract migrations, dropping the plaintext columns.
  - WP-47: tax and portal configuration.
  - WP-49: the missing agent specs.
- **Deliberately out of beta scope (WP-40), each with its trigger:**
  - interview rehearsal F9 (a PRD non-goal);
  - the outcome-analyst email;
  - the reply-classifier model fallback (rules-only classification ships);
  - extra ATS adapters F8;
  - embeddings;
  - Grafana and OTel;
  - the DBOS versions of the queue and workflow catalogs;
  - Redis decommission;
  - multi-currency.

## Decisions
See decisions. There are seven: architecture path, scale target, cloud channel, schema and migration authority, AI allowance semantics, sign-in providers, and tax and currency.
