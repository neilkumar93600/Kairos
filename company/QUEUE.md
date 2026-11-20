# Queue

Status: `todo` · `in-flight` · `in-review` · `needs-human` · `blocked` · `done`. Priority: P0 / P1 / P2 (see CHARTER). Only `/ceo` edits this file. Micro-tasks from heads use the parent ID: T-001.1, T-001.2…

| ID | P | Task | Owner | Status | Evidence / notes |
|---|---|---|---|---|---|
| T-001 | P0 | Audit v1 against `docs/06-implementation-plan.md` Tasks 1–18, the backend work packages and the latest CI run; list what blocks M0 and fill this queue | cto + cpo (plan mode) | todo | First `/ceo` cycle. Read CI on GitHub for integration tests; local runs skip them |
| T-006 | P0 | Backend works end to end on one integration branch (ingest → gate → tailor → approve → extension/cloud submit → credits → replies), agents on task-fitted models | cto (plan) → team | in-flight | 2026-11-20 founder request. PR #19 `origin/backend/complete` (129 commits, CI green except Railway plan) unmerged; local main +23 onboarding commits; 9 merge conflicts from migration 0019 clash |
| T-006.1 | P0 | Integration branch `integrate/backend-e2e`: local main + origin/backend/complete, 9 conflicts, onboarding migration → 0030 | database-engineer (opus) | in-flight | Wave 1, worktree `Downloads/kairos-wt/integrate`. Plan + critic: `company/inbox/2026-11-20/T-006-{cto-plan,critic}.md` |
| T-006.9 | P0 | Finish wp/32 (store-then-process, balance cache, rollover; 2 uncommitted files), migration → 0031, merge into integration | billing-engineer (opus) | todo | Wave 2. Critic blocker 1. Branch in `E:/download/auto-career`. Needs staging migration check first |
| T-006.2 | P0 | Fake-ATS harness: boards + employer form pages, fails closed | ats-integration-engineer (sonnet) | todo | Wave 2 |
| T-006.3 | P0 | WP-33 offer pause on top of WP-32 (48h undo, Stripe pause behind kill switch, default off), migration 0032 | billing-engineer (opus) | todo | Wave 3 (moved after .9) |
| T-006.4 | P1 | Railway plan (staging) failure; `integrate/**` CI trigger; journey CI job | devops-automator (sonnet) | todo | Wave 2. Plan only, never apply |
| T-006.5 | P0 | Cloud applier submits to 3 fake forms; one charge; challenge free | applier-engineer (opus) | todo | Wave 3 |
| T-006.6 | P0 | Extension claim lease + filler on 3 fake forms; two tabs submit once | extension-engineer (sonnet) | todo | Wave 3 |
| T-006.7 | P0 | Scripted end-to-end journey asserting each invariant | e2e-tester (opus) | todo | Wave 4. Upgraded to opus (critic). Owns the journey CI job |
| T-006.8 | P2 | Docs match code: docs/06 status, e2e runbook, decisions | tech-writer (haiku) | todo | Deferred to next run (dispatch cap) |
| T-002 | P1 | Review, test and commit the uncommitted frontend work in this checkout (~30 modified, ~15 new files) on a feature branch | cto → code-reviewer, accessibility-tester | todo | `git status` on 2026-11-20. Do not push |
| T-003 | P1 | Resume templates: ~50 in 12 categories, filters, ATS-safe variant; fills the wizard's template step | cpo → resume-engineer, ui-designer | todo | Founder-approved order 2026-11-10; spec in `docs/superpowers/specs/2026-11-10-onboarding-wizard-design.md` (project 2) |
| T-004 | P1 | Facts for legal pages and trademark: legal entity, address, governing law, mailbox, trademark search | human | needs-human | Owed since 2026-11-05 |
| T-005 | P1 | Push local `main` (23 commits ahead of origin) | human | needs-human | After T-001/T-002 confirm CI-ready |
