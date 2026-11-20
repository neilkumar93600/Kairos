# T-006 plan — cto (opus), 2026-11-20

## 1. Gap audit (origin/backend/complete + local main)

"Done" = in branch history; confidence medium unless a file is cited.

| docs/06 task | Status | Evidence |
|---|---|---|
| 1 CI | done | `ci.yml` runs PG+Redis for `*.int.test.ts` |
| 2 Company seed | done | `server/scripts/seed-companies.ts`, `db:seed` |
| 3 Resume upload/extract | done | `services/import/{pdf,docx,extract}.ts`, `jobs/parse-resume.ts` (`wp/17-contract` parked) |
| 4 Tailored PDF | done | `services/render.ts`, `jobs/render.ts`, applier attach (WP-19) |
| 5 Form questions per ATS | partial | answer-drafter reads form questions; GH `questions=true` + Lever/Ashby scan = WP-41, not built |
| 6 Answers + required-answer gate | done | answer-drafter; gate in `services/submissions.ts` |
| 7 Extension claim lease | partial | server done (`0027_wp29_attempt_functions.sql`); WP-29 note: "two tabs not met on frozen extension" |
| 8 Answer memory proposals | missing | no code |
| 9 Cover letters | partial | agent exists; pipeline wiring = WP-41 |
| 10 Weekly outcome report | unverified | `jobs/digest.ts`, weekly-report fields |
| 11 Max 5-min polling | done | `poll-boards.ts:21-22` |
| 12 Credit rollover cap | missing | promised `docs/pricing.md:53-55`; no rollover/expiry in `credits.ts`/`plans.ts` |
| 13 Rate limits/security | done | `middleware/rate-limit.ts`, `client-ip.ts` |
| 14 Observability | done | `lib/sentry.ts`, `metrics.ts`, `slo.ts`, `jobs/alerts.ts` |
| 15 E2E journey | missing | no journey test, no fake employer form fixtures (only board JSON + `fake-browser.ts`) |
| 16 Deploys | partial | staging built 2026-11-05; Railway "plan (staging)" fails on PR #19; production empty |
| 17–18 Web Store, launch gates | not started | |

WPs in history: 00–27, 29, 30, 31, 35, 42, 43, 44, 45, 47, 49, 50. Missing: WP-28 (load, needs staging), WP-32 (Stripe store-then-process), WP-33 (offer pause — `classify-email.ts:21` "not built here"; schema has `applicationsPausedAt`, `offer_pause_undo`, `offer_pause_notice`), WP-34, 36, 37, 39, 41, 46. Partial: WP-26 (claim verifier shadow on every path), WP-31 (live eval pending).

## 2. Micro-tasks

Each in its own worktree on a branch from `integrate/backend-e2e`; CEO merges accepted branches locally before the next wave. Nobody pushes.

| ID | Agent | Model | Goal | OWNS | Depends | Done when | Wave |
|---|---|---|---|---|---|---|---|
| T-006.1 | database-engineer | opus | `integrate/backend-e2e` = local main + merge origin/backend/complete; resolve 9 conflicts; renumber onboarding → `0030_onboarding_wizard` via drizzle-kit + hand edits | whole worktree | — | typecheck/lint/test green; migration lint; `drizzle-kit check`; `git diff origin/backend/complete -- server/drizzle/00{19..29}*` empty; both route mounts, shared exports, authz entries present; skipped int tests listed | 1 |
| T-006.2 | ats-integration-engineer | sonnet | Fake-ATS harness: GH/Lever/Ashby boards + fake employer form pages per ATS (incl. challenge page + sensitive question), served by interception | `server/test/fake-ats/**`, `server/test/fixtures/ats-forms/**`; `poll-boards.ts`, `services/ats/**` only for a test seam | .1 | fails closed on unrouted host; no allowlist/`safe-fetch.ts` change; seam defaults to prod; unit green | 2 |
| T-006.3 | billing-engineer | opus | WP-33 offer pause: candidates → notice → single-use 48h undo → executor (key `pause:<user>:<email>`), kill switch; resume clears `applications_paused_at` | `server/drizzle/0031_*`+meta, `db/schema/billing.ts`, `ops/provision-roles.sql`, `jobs/offer-pause.ts`, `routes/offer-pause.ts`, `routes/index.ts`, `jobs/{queues,schedules,notify}.ts`, `worker.ts`, `lib/flags.ts`, `services/stripe.ts`, `routes/webhooks.ts`, `services/billing-events.ts` | .1 | tests: newsletter "offer letter" → no candidate; undo <48h never calls Stripe (mocked); idempotent pause; resume clears; green. If WP-32 needed, report | 2 |
| T-006.4 | devops-automator | sonnet | Diagnose + fix Railway "plan (staging)"; add `integrate/**` CI trigger, Chromium for applier int tests, guarded `journey` job | `.github/workflows/**`, `.railway/**` | .1 | cause with log evidence fixed or NEEDS-HUMAN; plan only, never apply; actionlint clean | 2 |
| T-006.5 | applier-engineer | opus | Cloud applier submits approved apps to all 3 fake forms: receipt, one charge; challenge/failure free; INV-8 | `applier.ts`, `jobs/{cloud-apply,browser-pool,apply-gate}.ts`, `services/submissions.ts`, `server/test/applier-fake-ats.int.test.ts` | .2 | int test green with real Chromium in CI; unit green locally; settlement bugs → billing-engineer | 3 |
| T-006.6 | extension-engineer | sonnet | Extension path: claim lease, fill 3 fake forms (jsdom), report submitted, receipt; two-tab submits once (INV-4) | `extension/**`, `server/src/routes/extension.ts`, `server/test/extension*.test.ts` | .2 | filler tests on 3 fixtures; two-tab int test one submit/one charge; frozen-extension green | 3 |
| T-006.7 | e2e-tester | sonnet | Full scripted journey (poll → gate → score/tailor with recorded LLM stub + verifier → approve → cloud + extension submit → receipt → charge → failed free → forwarded reply → offer → pause on fake clock) | `server/test/journey/**`, `test:journey` script in `server/package.json`, `server/scripts/e2e-journey.ts` | .3, .5, .6 | each step asserts INV-1/2/3/4/5/6/8/9/10; cannot reach non-routed host; CI-only parts listed | 4 |
| T-006.8 | tech-writer | haiku | Docs match code | `docs/06-implementation-plan.md` status, `docs/runbook/e2e-journey.md`, backend-completion `decisions.md` | .1–.7 | docs/06 matches audit; runbook commands; renumber + offer-pause defaults recorded | 4 |

Reviews: R1 code-reviewer (fable) on .1, blocks wave 2 · R2 code-reviewer (fable) on .3 + .5 · R3 appsec-reviewer (fable) on .2, .3, .5, .6 · R4 code-reviewer (sonnet) on .4, .6, .7, .8.

CTO calls (overridable): offer-pause window 48h; pause also stops new sends (`submissions.ts:221` already skips paused users); WP-33 on today's webhook path without WP-32; no ATS allowlist change — fake ATS by interception only.

## 3. Not doing this run

Verifier shadow → enforce (needs ai-quality-evaluator read of live evals; first next run) · WP-41 + docs/06 Tasks 5, 9 · rollover cap (Task 12, money promise — next) and answer memory (Task 8) · WP-32 unless T-006.3 proves needed · WP-28/37 load tests and staging journey (founder-gated deploy) · real-Chrome extension load · WP-34/36/39/46, parked `wp/17-contract`.

## 4. NEEDS-HUMAN

1. Push `integrate/backend-e2e` (with `integrate/**` CI trigger, or push + draft PR) — int tests and journey run only in CI (`ci.yml` triggers: push main, pull_request).
2. Merge into `main` / supersede PR #19.
3. Staging deploy of the integration branch; Railway token if the plan failure needs it.
4. Optional: override offer-pause defaults.

```
TASK: T-006 (plan)
DONE: gap audit + 8-task / 4-wave plan with models, reviews, OWNS. Read-only.
FOUND: root CLAUDE.md describes a clipping website [CEO: stale — CLAUDE.md was rewritten for Kairos before this run; verified 2026-11-20] · non-main push runs no CI (ci.yml 3-6) · claim verifier shadow on every path (WP-26) · rollover cap promised, not built · extension two-tab lease unproven (WP-29) · WP-33 lists WP-32 as dependency — T-006.3 confirms
TO database-engineer: wave 1 owns whole worktree; never edit applied 0019–0029; renumber only onboarding
TO billing-engineer: offer-pause 48h, pause stops sends, Stripe mocked; report if resume needs WP-32
TO ats-integration-engineer: harness fails closed on unrouted requests; no allowlist/safe-fetch changes
TO devops-automator: never Railway apply; plan only
PEER NOTES: none
NEEDS-HUMAN: push integrate/backend-e2e; PR into main; staging deploy + Railway token; optional offer-pause override
NEXT: ai-quality-evaluator reviews live evals → verifier enforce; then billing-engineer rollover cap
MRR LEVER: activation
```
