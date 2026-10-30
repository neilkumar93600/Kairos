> DRAFT from the CTO synthesis of run wf_eac5a5ef-3a0 (2026-10-30), before the critic revision; replaced when the revision lands.

# CTO Review: Complete the Kairos backend
**Date:** 2026-10-30
**Scope:** 12 verified domain gap maps (platform, database, llm-agents, matching, applications, billing, messaging, resume, api-auth-security, ops, tests, scale), the CISO sign-off (approve-with-conditions, 11 must-fix), and spot checks of server/src/jobs/cloud-apply.ts:20-74, jobs/classify-email.ts:34-40, routes/webhooks.ts:71-73, services/tailor.ts:51-54 and services/submissions.ts:21-23, all of which confirm the CISO findings.
**Confidence tags:** 🟢 verified in code or maps · 🟡 medium (inferred from verified evidence) · 🔴 assumed (estimate, not measured).

## Bottom line
Do not build ADR-001 as written, and do not open the product to real users yet. The backend is a sound but thin skeleton, about 15 to 25% of the target design. Four things in it are dangerous today, and all four are cheap to fix: an unsandboxed browser that holds every secret, uncapped Sonnet and Haiku spend, a forwarded email that can pause billing, and a 50 MB unauthenticated parse. Fix those this week, make sign-in work from Vercel, and then finish the backend on today's Express and BullMQ stack. Bring in a durable engine only for the money and sending path (option c). Verdict: **SHARPEN**.

**What (with confidence)**
- 🟢 The cloud applier launches Chromium with Playwright defaults (sandbox off, cloud-apply.ts:21). It sets bypassCSP (:56), navigates to an applyUrl that comes straight from the Lever or Ashby payload (:59), and trusts the report the page returns (:61-65), all while holding one env for every process and an owner-level database credential.
- 🟢 Spend controls are inert. LLM_GATEWAY defaults to legacy (env.ts:48), no caller passes userId, llm_cost_daily is never rolled up, and score-matches makes one model call per user with preferences for every new job.
- 🟢 classify-email.ts:34-40 pauses Stripe collection on any email tagged offer. webhooks.ts:71 parses up to 50 MB before checking the token.
- 🟢 The integration tests that prove the money invariants exist but never run in CI (no Postgres service in ci.yml).
- 🟡 Sign-in from Vercel probably fails for configuration reasons, not code ones: BETTER_AUTH_URL and WEB_ORIGIN must equal the Vercel origin, and Better Auth's shared 'no-trusted-ip' bucket allows 3 sign-ins per 10 s for the whole site.
- 🔴 With AI agents working in parallel lanes, a secure beta-ready backend (auth, money, AI ceilings, detection, R1 import) takes about 6 to 8 weeks. The full backend (R2 to R4, durable money, matching v2, verifier) takes about 14 to 18 weeks. Autopilot comes last.

**Why.** The spec is good, but its order is wrong for a live system. The protections for the cloud applier are scheduled for P5, while the applier is already deployed. File import and rendering (D7) land before the P3 parser limits. Meanwhile the spec's own P1 is overloaded, and its capacity numbers contradict each other (connections 108/118/134; checkpoint writes 751k/1.11M/1.33M).

**How to act.** Follow the build plan below: wave A (security and auth) this week, wave B (limiters, isolation, AI ceilings, billing, detection) next, then data foundations and R1.

**Your decision.** Six owner calls are listed at the end. The two that unblock everything: accept path (c), and replace "10K-1M requests per millisecond" with a measurable target.

## Scaling Cliff
- **Current capacity (🔴, never measured).** One api replica handles roughly 250 to 400 rps on simple JSON routes. But the in-memory, per-IP limiter (rate-limit.ts:7-19, trust proxy 1 at app.ts:22) probably puts every Vercel-proxied browser into one 120-per-minute bucket. In practice that is about 2 rps for the whole site 🟡. The worker's score-matches loop saturates at about 2,300 users with preferences. The applier runs 2 contexts per replica, about 3,800 runs a day. Pools of 10 per process across 18 possible processes give 180 connections against Postgres's default of about 100.
- **Break points, in order.** (1) Scoring fan-out spend: $206 to $413 a day at 10k users with no cap 🟡. (2) The shared IP limiter and Better Auth bucket lock out sign-in on launch day 🟢. (3) Board polling with no ETag and no host caps gets throttled by Greenhouse, and the applier's single Chromium has no crash reset 🟢. (4) Target design: the Anthropic Build tier caps spend at $1,000 a month against about $4,100 needed, reached around 2,500 users 🟡. (5) A single Postgres primary reaches 1.3x CPU headroom at 10k users and needs a second database at about 25k 🔴.
- **What "10K-1M requests per millisecond" means.** That is 10 million to 1 billion requests a second. For reference, Cloudflare's entire network averages about 60 to 70 million a second 🔴. A realistic product load is about 150 rps peak at 10k users, about 1,000 at 100k and about 8,300 at 1M, so the ask is 1,200x to 120,000x real demand. At 1M users the model bill alone is about $0.4M a month. Not sensible as a target. Read per minute instead, it gives 167 to 16,700 rps, which matches 10k to 1M users almost exactly. The unit was probably a slip.
- **Recommended target.** For the next 12 months: 10,000 registered users and 3,500 daily actives. Sustain 300 rps peak (2x the spec), with a load-tested ceiling of 600 rps. Read p95 under 300 ms, write p95 under 500 ms, auth p95 under 800 ms. Zero duplicate sends or charges under chaos. Plan, but do not build, for 100k users (2,000 rps).
- **Load-test gate.** Stage 0 runs now (WP-28): k6 at 10/50/150/300 virtual users on staging, plus a check of what req.ip is behind Vercel. Stage 1 runs at P1/P4: Anthropic stub, fake ATS, 10k seeded users. Stage 2 (WP-37) runs before paid beta: 24 hours at 1.5x peak with chaos (kill a replica every 10 minutes, one Postgres restart, a 429 storm). Pass means: SLOs met, zero double charges, every application terminal within 10 minutes, and connections at or under 160 of 200.
- **Headroom after the plan.** api about 4x 🔴 (the spec's ">10x" is wrong), apply slots 32 vs 21.5 at peak, Anthropic fleet ceiling 1,650 vs 800 RPM once the tier is raised.

## Tech Debt
The tech_debt_analyzer.py script takes no input file (no argparse; it only prints a hardcoded demo), so no input JSON was written. The formula **priority = (severity 1-5 x blast radius 1-5) / cost in engineer-days** was applied by hand:

| Debt item | Sev | Blast | Days | Score |
|---|---|---|---|---|
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

- **Top item.** By risk, the applier (one renderer bug means a breach of every user's data, plus the Stripe and Anthropic keys) 🟢. By score, deleting the offer pause (7 lines).
- **Cost per week (🔴, CISO estimates).** Applier exposure is $10k to $225k expected loss a year, about $0.2k to $4.3k a week. AI spend abuse is $5k to $50k a year, about $0.1k to $1k a week, and a single scripted free account can burn $160 to $720 a day. Both are near zero while the product has no users, and both turn on the day it launches.
- **Blocking dates.** Railway stops reading railway.json on 2026-12-01 [V, unverified] (WP-15). llm_calls partitions run out about 2026-12-07 🟢 (WP-09). The Anthropic Build-tier cap binds near 2,500 users 🟡.
- **Debt ratio.** For the next 6 weeks, about 60% of capacity goes to risk and foundations. It should fall under 25% after wave C.

## Team
You are a solo founder working with AI agents, so the plan splits work into lanes and parallel groups instead of headcount.
- **Lanes, each owning its files for a wave:** L1 Security and auth (WP-00/02/03/04/08/38). L2 Money and sending (WP-09/10/22/29/32/33). L3 AI and truth (WP-06/07/20/26/31). L4 Data and platform (WP-01/12/13/14/15/18/27). L4 alone allocates migration numbers. L5 Resume suite (WP-16/17/19/21/39). L6 Matching and messaging (WP-23/24/25/34/35).
- **Rules.** Packages in the same parallelGroup touch disjoint files. One pull request per package. The CI integration job is required. Every money, migration or security package gets an owner review. An agent never changes extension/.
- **Owner time is the real bottleneck 🔴:** about 4 to 6 hours a week for reviews, secrets and platform settings, plus about 6 hours once to label eval cases (WP-20). On-call: until paging exists, the cloud channel and Autopilot run only during hours you are reachable.
- **Bus factor is 1.** WP-11 (runbook) and WP-18 (emergency kit holding the key copies) are the mitigation.

## Build vs Buy
| Component | Decision | 3-year TCO (🔴) | Core or context |
|---|---|---|---|
| Durable execution | Postgres sweepers now; DBOS Transact (OSS library on own Postgres) for money and sending after S-D1; outbox plus BullMQ as fallback. Temporal Cloud rejected: $7k-$36k, a full rewrite, and data leaves the platform | about $0 license; 2-3 engineer-weeks; runs on existing Postgres | Context |
| Auth | Keep Better Auth (installed, working); add Postgres rate-limit storage and token encryption. Clerk would be about $2k-$7k a year at 10k-30k MAU plus a migration | $0 | Context |
| Email | Keep Postmark with two streams (transactional and broadcast). Switch to SES above about 100k messages a month | $4k-$9k | Context |
| Storage | Buy Cloudflare R2: private buckets, per-user prefixes, short presigned URLs | under $1.5k | Context |
| PDF/DOCX rendering | Build on Typst (OSS) in the worker, plus an MIT DOCX library. DocRaptor rejected: resume data would leave the platform, and rendering is product core | $0 license; worker CPU about $20-$40 a month | **Core** |
| Observability | Buy Sentry Team (with a $50 overage cap), an external uptime and heartbeat monitor, and Railway log alerts. Defer Grafana and OTel until WP-27 | about $2.7k-$4k | Context |
| Model provider | Buy Anthropic (single provider, owner decision). Raise to Scale or custom tier before 2,500 users; sign ZDR | about $49k a year at 10k users | Context (prompts and evals are core) |

## Reliability
**Proposed SLOs (30-day windows)**
- S1 API availability 99.5% (216-minute budget). 99.9% for approve, submission report, the Stripe webhook and the inbound webhook.
- Latency p95: reads 300 ms, writes 500 ms, auth 800 ms, AI routes 14 s.
- S3: 95% of drafts ready within 60 s. S4: 95% of approved cloud attempts started within 10 minutes. S5: 99.9% of attempts settled within 10 minutes. S7: 99.9% of Stripe events processed within 10 minutes. S8: 99% of replies classified within 10 minutes.
- Hard invariants (not SLOs): zero double charges, zero duplicate sends, zero negative balances, zero ledger drift.

**Error-budget policy**
- 50% of the S1 or S5 budget burned → only reliability work ships until the burn rate falls.
- 100% burned → roll back the last change, write a postmortem within 48 hours, and freeze features for 7 days.
- Any money-invariant breach → set approvals_frozen immediately and page.
- Revisit all values after 60 days of beta data.
- RTO 2 h and RPO 15 min, provided PITR is on (WP-13).

## Security
- **CISO status: approve-with-conditions 🟢.** Public launch, real user data in sd1, and cloud sends for anyone but you are blocked until the 11 must-fix items are closed and verified on staging.
- **Must-fix, mapped to packages:**
  1. Contain the applier → WP-00 (owner gate, today) and WP-04.
  2. Check the secret before parsing and cap request bodies → WP-00 and WP-03.
  3. AI spend ceilings → WP-06 and WP-23, plus the Console cap today.
  4. Client IP and limiter storage → WP-03.
  5. Remove the offer pause → WP-00.
  6. Redaction before Anthropic → WP-07.
  7. Truth lock on tailored lines → WP-07.
  8. Untrusted-file gate for R1/R2 → WP-17 and WP-19.
  9. Logs → WP-08.
  10. Detection and runbook → WP-11.
  11. Two-user authorization test → WP-05.
- **Should-fix items carried in:** DB roles and the append-only ledger (WP-12), the x-vercel-id design fix (WP-03), erasure and tombstones (WP-25), the $0-invoice grant (WP-00 and WP-10), OAuth token encryption (WP-02) and data encryption (WP-18), re-parse keeping confirmed facts (WP-07), safe fetch (WP-23), database backstops (WP-12), staging origins and account linking (WP-02), sensitive-answer scrub (WP-25), supply chain (WP-01/04), and the origin guard and serializers (WP-05).
- **Owner actions.** Request ZDR and confirm the Anthropic DPA. Name Anthropic as a sub-processor in the privacy notice. Sign a written risk acceptance if the S-AP4 sandbox test fails on Railway.

## Verdict
**SHARPEN** for "proceed to build as planned". The target security and data design is sound, and the CISO approves continuing. But the ADR-001 order (P0 to P8, DBOS first) leaves the live risks open for months, and it conflicts with D7. Re-scope to path (c), front-load the 11 must-fix items and working auth, then build.

## Next Steps
1. **Today:** Set a monthly spend limit and an alert in the Anthropic Console. Merge WP-00: gate the cloud channel to the owner, delete the offer pause, check the inbound token before parsing, turn promotion codes off. Set BETTER_AUTH_URL and WEB_ORIGIN to the Vercel production origin and the Google redirect URI to https://<web>/api/auth/callback/google. Confirm whether LLM_GATEWAY and PgBouncer are in use on sd1.
2. **This week:** Accept path (c) and the 10k-user / 300 rps target. Start wave A in parallel (WP-01, 02, 04, 07, 08, 16).
3. **Before any R1 server route merges:** WP-03, WP-05, WP-06 and WP-11 are done, the staging smoke passes (sign-up through the Vercel URL, then GET /api/me), and k6 stage 0 is green.

## Work packages
See workPackages. Groups A→G run roughly as waves; packages inside one group can run at the same time. Deliberately out of beta scope: interview rehearsal F9, the outcome-analyst email, extra ATS adapters F8, embeddings, and Redis decommission (WP-40).

## Decisions
See decisions (6): architecture path, scale target, cloud channel, schema and migration authority, AI allowance semantics, sign-in providers.
