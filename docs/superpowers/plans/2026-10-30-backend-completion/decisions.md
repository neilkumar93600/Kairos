> DRAFT from the CTO synthesis of run wf_eac5a5ef-3a0 (2026-10-30), before the critic revision; replaced when the revision lands.

# Owner decisions

## Which architecture path completes the backend?

Recommended: **(c) Hybrid**. It ships a secure beta in about 6-8 weeks on code that is already wired, honours the approved D7, puts durable guarantees exactly where money and sending are, and keeps the operational load manageable for one person. Record it as ADR-001 Revision 3.

- (a) ADR-001 as written: DBOS re-architecture on PG18, phases P0-P8, about 16+ weeks. One store and no Redis, but the beta is about 4 months away and R1-R4 get built twice.
- (b) Evolve Express+BullMQ only: Fastest. Sweepers and an outbox give at-least-once behaviour, but the money and sending path has no checkpointed steps.
- (c) Hybrid: Keep Express, Better Auth and BullMQ. Add sweepers now, then DBOS (outbox fallback) only for approve, applyCloud, settle, Stripe and offer-pause, gated by S-D1 and a chaos test.

## What scale target replaces '10K-1M requests per millisecond'?

Recommended: **Product-derived 12-month target**. It is measurable and testable on Railway, sized from the real drivers (applications per day, model spend, queue lag), and leaves a 2x margin over the spec's own 150 rps peak.

- Literal: 10M-1B requests per second, about 15% to 15x Cloudflare's whole network; $4M-$390M a month in bandwidth alone. Not achievable or useful.
- Per-minute reading: 167-16,700 rps, which matches 10k-1M users; a fine long-range envelope but not a near-term commitment.
- Product-derived 12-month target: 10k users / 3,500 DAU, 300 rps sustained peak, 600 rps tested ceiling, read p95 300 ms, write p95 500 ms, zero double charges under chaos; plan (not build) for 100k at 2,000 rps.

## Who can use the cloud channel until the applier is contained (WP-04)?

Recommended: **Owner only**. It costs nothing, removes the largest expected loss ($10k-$225k a year), and still lets you test on your own accounts. Reopen once WP-04 passes on staging and S-AP4 either passes or is signed off.

- Owner only: Reject channel 'cloud' in approveApplications unless the user is in OWNER_USER_IDS; Pro and Max use the extension meanwhile.
- Pro and Max as today: Keeps the feature live; the unsandboxed browser holds every secret and has full database access.
- Off for everyone: Scale sd1-applier to zero until P5-level hardening.

## Which document owns the resumes, revisions and application_events schema, and who numbers migrations 0003+?

Recommended: **PRD authoritative, one numbering lane**. The PRD is owner-approved (2026-10-29) and the web builds against it first (D7); one numbering owner avoids colliding Drizzle journals.

- PRD authoritative, one numbering lane: Amend 02-database and worker 05 to the PRD shapes (many resumes per profile, named revisions, tracker-keyed events with an application_id link); the L4 lane alone allocates migration numbers in order, on Postgres 17-compatible DDL until PG18 is confirmed.
- Spec authoritative: One resume per slot, application-keyed events; the PRD R1/R4 is redesigned.
- Decide per release: Defer; risk of conflicting migrations and double work.

## How are per-feature daily AI limits answered and capped?

Recommended: **429 daily_allowance plus spec caps**. It avoids overloading 402, which the frozen extension and web treat as out of credits, and the spec caps keep cost per application near $0.008. Amend the PRD wording.

- 429 daily_allowance plus spec caps: 429 rate_limited with reason daily_allowance and resetsAt (402 stays 'no credits'); pipeline caps at 0.05/0.20/0.25/0.50 USD per day per plan; interactive allowances from plans.ts.
- 402 per PRD: Matches the PRD and workspace README, but frozen clients already read 402 as 'no credits'.
- Keep plans.ts caps 0.5/2/5/8: 10-16x the cost model; per-user ceilings stop protecting margin.

## Which sign-in methods must work at beta?

Recommended: **Email+OTP and Google; hide the rest**. It makes sign-in work end to end this week with what is already configured; extra providers become WP-38 when you have the developer accounts.

- Email+OTP and Google; hide the rest: Server-configured providers only; UI hides Apple, GitHub and LinkedIn until configured.
- All four providers: Needs an Apple Developer account (key rotation every 6 months), a GitHub OAuth app and a LinkedIn OIDC app plus account-linking tests (WP-38).
- Email only: Simplest; loses the Google conversion path.

