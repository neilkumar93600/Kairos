> FINAL CTO review of run wf_eac5a5ef-3a0 (2026-10-30), after the completeness-critic revision.

# Owner decisions

## Which architecture path completes the backend?

Recommended: **(c) Hybrid**. Secure closed beta in about 4-5 weeks on wired code, honours the approved D7, puts durable guarantees exactly on money and sending, and keeps operations manageable for one person. Recorded as ADR-001 Revision 3 in WP-43.

- (a) ADR-001 as written: DBOS re-architecture on PG18, phases P0-P8. One store and no Redis, but paid beta about 6-7 months away and R1-R4 built twice.
- (b) Evolve Express+BullMQ only: Fastest. Sweepers and an outbox give at-least-once, but the money and sending path has no checkpointed steps.
- (c) Hybrid: Keep Express, Better Auth and BullMQ; sweepers and BullMQ hardening now (WP-09, WP-45); DBOS (outbox fallback) only for approve, applyCloud, settle, Stripe and offer-pause, gated by S-D1 and a chaos test (WP-22). DBOS-only catalog items rebuilt on BullMQ or deferred in WP-40.

### ADR-001 Revision 3, as built (WP-22, 2026-11-05)

Decided by the coordinator under the owner's delegation; the owner may revisit it.

- **Path (c), the hybrid, is accepted**, with the outbox as its durable seam. Express, Better Auth and BullMQ stay. Durable guarantees sit only on money and sending.
- **The seam is a Postgres outbox drained by BullMQ, not DBOS.** A row is written in the transaction of the business change (`server/src/durable/outbox.ts`), a worker loop drains it with `FOR UPDATE SKIP LOCKED`, the job id is the row's stable key, and delivery is at least once to idempotent consumers. No new dependency, no `kairos_dbos` database, no `ops/provision-dbos.sql`.
- **Why the fallback.** The plan built DBOS only after the Railway half of S-D1 passed. That half could not be run (no Railway access from the build), and no result is recorded anywhere, so the gate is unmet.
- **What S-D1 showed.** The local half passed (`_research/spike-s-d1-local.md`: recovery, orphan recovery by another executor, exactly-once transactions). The Railway half was not run: executor ids across a redeploy, the datasource behind PgBouncer, the 50 forced crashes across process types. So this is not a finding against DBOS. It is a decision not to wait on an unmet gate when Postgres and BullMQ are already here.
- **What would justify revisiting DBOS** (each with the Railway half of S-D1 run first, and its own ADR):
  - a duplicate send or a double charge in production traced to hand-written phase logic that a checkpointed step would have prevented;
  - more than 2 stuck-work incidents in a month that the sweep did not heal within 15 minutes (A.11's trigger, now pointed the other way);
  - a money or sending flow whose steps cannot be expressed as a business column plus a re-runnable consumer, for example long fan-outs with per-step memoization;
  - a decision to retire Redis (B.14 P7), which would remove what the outbox drains into.
- **What it relies on.** BullMQ's `completed` state is the row's completion, read by the sweep every minute. That holds only while nothing but age removes a completed job: an outbox-fed queue keeps them 2 hours with no count (`completedRetention`, `jobs/queues.ts`, pinned by a test). A count would evict finished work, the sweep would read it as lost, and five such reads would mark a finished row dead.
- **Not yet shown.** The 1,000-approval chaos acceptance has not run: it needs a real Postgres and Redis (`.github/workflows/chaos.yml`, by hand). WP-29 versioned the key by attempt (`apply-<id>-<n>`, the previous release's `apply-<id>` still honoured), so "completed means done" holds per attempt, and the real no-second-send invariant is `mark_browser_launched` on the attempt row.

## What scale target replaces '10K-1M requests per millisecond'?

Recommended: **Product-derived 12-month target**. Measurable on Railway, derived from real drivers (DAU x requests per DAU x peak factor, applications per day, model RPM), with a 2x margin over the spec's own 150 rps.

- Literal: 10M-1B requests per second, the order of Cloudflare's whole network or more; 1,200x-120,000x derived demand. Not achievable or useful.
- Per-minute reading: 167-16,700 rps: matches the 10k-user peak (146 rps) and is 2x the 1M-user peak (8,330 rps); fine as a long-range envelope, not a near-term commitment.
- Product-derived 12-month target: 10k users / 3,500 DAU; 300 rps sustained peak (2x derived 146), 600 rps tested ceiling; read p95 300 ms, write p95 500 ms; zero double charges under chaos; plan (not build) 100k users at 2,000 rps (2x their derived 1,040).

## Who can use the cloud channel until the applier is contained (WP-04)?

Recommended: **Owner only**. Costs nothing, removes the largest expected loss ($10k-$225k a year), and still lets you test on your own accounts. Reopen once WP-04 passes on staging and S-AP4 either passes or is signed off.

- Owner only: Reject channel 'cloud' in approveApplications unless the user is in OWNER_USER_IDS; Pro and Max use the extension meanwhile.
- Pro and Max as today: Keeps the feature live; the unsandboxed browser holds every secret and full database access.
- Off for everyone: Scale sd1-applier to zero until WP-04 lands.

## Which document owns the resumes, revisions and application_events schema (and render timing), and who numbers migrations 0003+?

Recommended: **PRD authoritative, one numbering lane**. The PRD is owner-approved (2026-10-29) and the web builds against it first (D7); one numbering owner avoids colliding Drizzle journals and lets WP-17, WP-19, WP-41 and WP-42 run without contradictions.

- PRD authoritative, one numbering lane: Amend 02-database, 05-api and workers 04/05 to the PRD (many resumes per profile, named revisions, events keyed by tracker item with an application_id link, snapshot frozen and rendered at approval); L4 alone allocates migration numbers, Postgres 17-compatible DDL until PG18 is confirmed (WP-43, WP-42).
- Spec authoritative: One resume per slot, application-keyed events, render in prepare; the PRD R1/R4 is redesigned.
- Decide per release: Defer; risk of conflicting migrations and double work.

## How are per-feature daily AI limits answered and capped?

Recommended: **429 daily_allowance plus spec caps**. Avoids overloading 402, which the frozen extension and web treat as out of credits, and keeps cost per application near $0.008. WP-43 amends the PRD wording.

- 429 daily_allowance plus spec caps: 429 rate_limited with reason daily_allowance and resetsAt (402 stays 'no credits'); pipeline caps 0.05/0.20/0.25/0.50 USD per day per plan; interactive allowances from plans.ts.
- 402 per PRD: Matches the PRD and workspace README, but frozen clients already read 402 as 'no credits'.
- Keep plans.ts caps 0.5/2/5/8: 10-16x the cost model; per-user ceilings stop protecting margin.

## Which sign-in methods must work at beta?

Recommended: **Email+OTP and Google; hide the rest**. Makes sign-in work end to end this week with what is configured; the extra providers become WP-38 once you have the developer accounts.

- Email+OTP and Google; hide the rest: Server-configured providers only; UI hides Apple, GitHub and LinkedIn until configured.
- All four providers: Needs an Apple Developer account (key rotation every 6 months), a GitHub OAuth app and a LinkedIn OIDC app plus account-linking tests (WP-38).
- Email only: Simplest; loses the Google conversion path.

## How are tax and currency handled when the paid beta charges customers in several countries?

Recommended: **USD, Stripe Tax on (WP-47)**. Stripe is already integrated, so this is configuration plus a small checkout change; multi-currency (billing-64) is deferred to WP-40 until there is demand data.

- USD, Stripe Tax on (WP-47): automatic_tax, billing address and tax-id collection, portal configuration as code; you register where thresholds require, with an accountant.
- Merchant of record: Paddle or Lemon Squeezy collects and remits tax; higher fees (about 5%) and a billing migration away from today's Stripe code.
- No tax collection; US-only paid beta: Defers the work but limits the market and leaves a compliance risk if non-US users pay anyway.

