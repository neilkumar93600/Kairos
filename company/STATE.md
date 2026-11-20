# State

_Updated 2026-11-20 by setup (company moved over from the clipping project). `/ceo` rewrites this every run._

**Phase:** 0 — Finish v1 and release
**Next milestone:** M0 — paid beta live + first paying user
**Bottleneck:** unknown until the first `/ceo` audit (T-001). Most of v1 is built; what stands between it and paying users has not been checked in this company yet.

## Metrics

| Metric | Now | Target |
|---|---|---|
| MRR | unknown — production not released as of 2026-11-05 | $10,000 |
| Paying users | unknown | ~325 |
| Signups (total) | unknown | ~11,000 |
| Activation (first application approved within 24 h) | — | ≥ 40% |
| Free → paid | — | ≥ 5% |
| ARPU | — | ≥ $31 |
| Unhappy churn | — | ≤ 10% / mo |
| Submit success on supported ATSs | — | ≥ 95% |
| Cost per submitted application | estimate ~$0.01 (`docs/pricing.md`), not measured | keeps gross margin ≥ 70% |

## Known facts (from repo and notes — re-check before acting)

- Local `main` in this checkout is 23 commits ahead of `origin/main` (onboarding wizard, merged 2026-11-10, not pushed). Its migration 0019 and integration tests were checked only by reading.
- This checkout also has ~30 modified and ~15 new uncommitted frontend files (auth, dashboard, landing, pricing, resume, shared components) as of 2026-11-20.
- Railway project `kairos`: `staging` built 2026-11-05 (api, worker, applier, Postgres, Redis, buckets, pgbackup); `production` environment empty as of 2026-11-05.
- Web: `kairos-seven-ashy.vercel.app` (README). Integration tests run only in CI on this machine (no local Postgres).
- Next product projects the founder approved (2026-11-10): ~50 resume templates in 12 categories, resume builder redesign, interview practice later.

## Decided

- Product scope, invariants and prices: `CLAUDE.md`, `docs/01`–`06`, `docs/pricing.md`.
- Logo: Catch is final (2026-11-05). Trademark search is the founder's.
- Refund terms live inside terms, privacy and cookies; `/refunds` redirects (2026-11-05).
- Company org: 102 agents adapted for Kairos on 2026-11-20 (`ROSTER.md`).

## Needs you

- Facts only you have: legal entity, postal address, governing law, whether hello@kairos.app is live, trademark search for "Kairos". Pages are worded to stay true without them.
- Go-ahead to push local `main` (23 commits) once T-001/T-002 say it is clean.

## Blockers

- None recorded yet — T-001 will list them.
