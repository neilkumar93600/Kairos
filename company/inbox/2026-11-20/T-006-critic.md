# T-006 critic pre-mortem — critic (fable), 2026-11-20

**VERDICT: go-with-changes**

Verified: 9 conflicts real; main's 0019_onboarding on neither origin/main nor BC; ci.yml triggers only push main + pull_request; promote.yml / staging-gate.yml manual only; wp/32 in E:/download/auto-career — 6 commits not in BC, 0029 collision (meta snapshot + journal), 2 uncommitted files in wp-32 worktree.

## BLOCKERS (applied by CEO to the plan)

1. **Add T-006.9 — finish + merge wp/32 (billing-engineer, opus).** CTO audit wrong: WP-32 and Task 12 rollover exist on wp/32 (41 files: submissions.ts, settle.ts, webhooks.ts, billing-events.ts, credits.ts, worker.ts, queues.ts, schedules.ts) — overlaps .3 and .5 OWNS. .9 owns the wp-32 worktree/branch: commit the 2 uncommitted files with tests for the rollover cap moment; re-merge onto integrate/backend-e2e after .1; regenerate migration as 0031_wp32_billing; BC's 0029_wp19_render_failed byte-identical. wp/32 isn't in Downloads/Kairos — `git fetch E:/download/auto-career wp/32`. Before renumbering, confirm wp/32's 0029 never applied anywhere incl. staging (INV-21). Waves: 1 .1 · 2 .9/.2/.4 · 3 .3 (0032 on WP-32)/.5/.6 · 4 .7. Drop "WP-33 without WP-32" and the "rollover not doing" line.
2. **T-006.3 OWNS:** add `jobs/classify-email.ts` (offer tag; line 21 "candidate flow not built here"), `lib/action-tokens.ts` (`offer_pause_undo` lifetime is 7d at :30 vs plan 48h — change or enforce 48h in the undo route and say so), `test/helpers/authz-matrix.ts`, `test/authz-matrix.int.test.ts`, `test/fresh-matrix.test.ts`, `shared/src`. Remove `routes/webhooks.ts`, `services/billing-events.ts` (now .9). Stripe pause call only in the executor after 48h, behind a `lib/flags.ts` kill switch default OFF.
3. **T-006.2 no production code.** Seam exists (`services/ats/types.ts:85` `opts.fetcher`; browser route guard pattern in `cloud-apply.browser.test.ts`). Remove poll-boards.ts and services/ats/** from OWNS; done when `git diff --stat -- server/src` empty. Fake forms served at real ATS hostnames via test routes (`isInternalTarget` blocks localhost — correct).
4. **T-006.5 Chromium plan backwards.** Browser tests skip when CI set; Chromium installed locally (`%LOCALAPPDATA%\ms-playwright\chromium-1254`). Split: `applier-fake-ats.browser.test.ts` runs here (form fill proven this run) + `*.int.test.ts` for settlement in CI. Done also requires empty diff on `isInternalTarget`, `isAllowedApplyUrl`, the `context.route` guard; no test host added to the allow list. Wave-3 settlement bugs → TO applier-engineer (owns submissions.ts then).
5. **Renumber method (.1; same for .9 → 0031, .3 → 0032):** take BC's 0019–0029 .sql + meta snapshots as-is; delete main's 0019_onboarding_wizard.sql + snapshot; `npx drizzle-kit generate --name onboarding_wizard` → 0030; diff vs original onboarding SQL, port only hand-written parts (checks, backfills) into the .sql; never hand-edit snapshot JSON. Done when `npx drizzle-kit generate && test -z "$(git status --porcelain drizzle)"`, `node scripts/lint-migrations.mjs --base origin/main`, and `git diff origin/backend/complete -- server/drizzle/00{19..29}* server/drizzle/meta/00{19..29}*` empty.
6. **Worktrees lack CLAUDE.md and company/ (untracked).** Briefs give absolute paths `c:/Users/Lenovo/Downloads/Kairos/CLAUDE.md`, `.../company/inbox/...`. No checkout/stash/reset in the main tree; never `git add` those paths. Founder's uncommitted web work (~32 modified, 1 deleted) is NOT in integrate/backend-e2e.
7. **"End to end" unprovable as planned.** 52 `*.int.test.ts` + journey need PG + Redis; docker.exe installed, daemon off; docker-compose.yml has postgres:17 + redis:7. NEEDS-HUMAN #0: start Docker Desktop (local, no spend). Else final claim = "unit + browser green; int tests and journey unverified until CI".

## WARNINGS

- `server/.env` → `localhost:5433/auto_career` (founder's dev DB). If onboarding 0019 applied there, integration-branch migrations fail; recreating it needs founder OK.
- .4: journey CI job calls .7's script → move job to .7 OWNS. `lint-migrations --base ${{ github.event.before }}` gets all-zero sha on first push of a new branch — handle before adding `integrate/**` trigger.
- .7: recorded LLM stub via `configureGateway` (`llm/gateway.ts:101`); `git diff -- server/src` empty. Verifier still shadow (WP-26): journey INV-2 proves citations, not verifier enforcement — report must not claim otherwise.
- Models: opus on .1/.3/.5/.9 right; fable reviews give independence; .7 on sonnet is the weak spot → opus or fable R4.
- Cap: .9 + review = 16 → defer .8, fold .9 review into R2 → 14.
- wp/32 review log (8ed3af8) — R2 must check findings closed.
- wp/51 needs owner OAuth keys; out of this run.
- Rollback: all local — delete integrate/backend-e2e, revert per-wave merges; main untouched.

## QUESTIONS

1. Founder: start Docker Desktop locally?
2. Founder: local `auto_career` DB (:5433) — recreate allowed?
3. Founder/devops: which branch built Railway staging 2026-11-05; any 0029 (wp19 or wp32) in its `__drizzle_migrations`? Read-only, needed before .9 renumbers.
4. CFO/founder: ship offer pause with Stripe pause off (applications pause only) until founder enables billing pause?

```
TASK: T-006 (critic pre-mortem)
PEER NOTES: cto — audit says WP-32 and rollover (Task 12) missing; both exist on unmerged wp/32 (43d5286, de2e900 in E:/download/auto-career); plan requires .5 browser test in CI where cloud-apply.browser.test.ts skips on CI.
NEEDS-HUMAN: start Docker Desktop; auto_career DB recreate?; staging __drizzle_migrations check; offer-pause Stripe switch default; later push integrate/backend-e2e, PR to main, staging deploy.
MRR LEVER: activation
```
