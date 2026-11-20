# CLAUDE.md

Kairos (Gray Matter Labs): a fit-first AI job application agent. It applies only to jobs that fit, tailors resumes only from facts the user confirmed, and sends nothing until the user approves it. Goal: $10k MRR (`company/CHARTER.md`).

## Source of truth

Read before changing anything:
- `docs/01-prd.md` · `docs/02-trd.md` · `docs/03-app-flow.md` · `docs/04-ui-ux-brief.md` · `docs/05-backend-schema.md` · `docs/06-implementation-plan.md` · `docs/pricing.md`
- Backend design (deeper than 02/05): `docs/superpowers/specs/2026-10-15-kairos-backend-design/` — invariants table INV-1…23 in `02-database.md`.
- Design system: `DESIGN.md` (root) and `docs/DESIGN.md`. For any screen you build or change, run the `unslop:unslop` skill ([heydamir/unslop](https://github.com/heydamir/unslop)) before review so it doesn't look AI-generated — inside the Duna rules: quiet achromatic chrome, the painted horizon is the one bright element. (The plain `unslop` skill is a different tool for prose.)
- Specs and plans per feature: `docs/superpowers/specs/`, `docs/superpowers/plans/`. Runbooks: `docs/runbook/`.

Docs beat memory and assumptions. If code and docs disagree, flag it — don't silently pick one. Keep docs updated when the app changes.

## Repo layout

```
web/        Next.js 16 app — UI only (Vercel); /api/* is rewritten to the server
server/     Express 5 API, BullMQ workers, Playwright cloud applier (Railway)
  src/agents/   LLM agents (fit-scorer, resume-tailor, answer-drafter, cover-letter-writer, resume-parser, resume-writer)
  src/llm/      model gateway, budgets, claim checks
  drizzle/      SQL migrations
  evals/        AI quality evals
shared/     Zod contracts, types, plans.ts (every plan number lives here)
extension/  Chrome MV3 extension (side panel, per-ATS form filler)
ops/        Postgres roles and settings, Railway limits
.railway/   railway.ts — Railway IaC; an apply deletes services the file omits
.github/    CI, evals, staging gate, promote (production release)
docs/       01–06, pricing, DESIGN, runbook/, superpowers/specs + plans
company/, .claude/   agent company — not product code
```

## Invariants (never break)

- **INV-1 Fit gate** before any model call. `GatePassed` is created only by `admit()`.
- **INV-2 Truth lock**: every resume line, answer and cover-letter paragraph cites confirmed facts; a violation stores nothing. **INV-7** independent verifier passes before approval.
- **INV-3 Approval before send**; Autopilot only inside its guards.
- **INV-5** a credit is charged only on `submitted`, never on failure; one per application.
- **INV-6** never automate LinkedIn, never store employer passwords, never read a mailbox (replies come only through the forwarding address).
- **INV-8** no CAPTCHA solving or evasion. **INV-9** sensitive questions (EEO, demographics) are never answered by a model.
- **INV-10** plan limits and prices only from `shared/src/plans.ts`. **INV-11** every query scoped by the session user.
- **INV-21** migrations are never edited after they are applied.

Never write in product, ads, SEO or AI text: guaranteed interviews, jobs or offers; "ATS-proof", "undetectable", "beats the ATS"; fake testimonials or user counts; anything implying LinkedIn automation.

## Web folder conventions

- `app/(landing)/` — landing page. `app/(public)/` — about, how-it-works, pricing, blog, careers, contact, newsletter. `app/(legal)/` — terms, privacy, cookies; refund terms live inside them from `web/content/legal-refund.ts` (`/refunds` redirects).
- `app/(auth)/` — login, sign-up, verify-otp, forgot-password, reset-password. Guests only.
- `app/(onboarding)/` — the goal-first onboarding wizard.
- `app/(dashboard)/` — signed-in pages: dashboard, matches, queue, applications, inbox, resume, profile, preferences, billing, settings.
- No route handlers in `web/` — the API is `server/src/routes/`; `web/proxy.ts` is the Next 16 proxy (formerly middleware).
- `components/layout/` — navbar, footer, header, sidebar. `components/shared/` — used by 2+ pages. `components/ui/` — shadcn primitives. `components/<page>/` — one folder per page area (auth, dashboard/<section>, resume, onboarding, landing, pricing, blog, legal…).
- `hooks/` — project hooks (`use-me`, `use-matches`, …). `lib/` — one file per concern; a folder only when a concern has 2+ files.

## Rules

- Next.js 16 has breaking changes — read `web/node_modules/next/dist/docs/` before writing Next.js code (`web/AGENTS.md`).
- Only `server/src/services/credits.ts` writes `credit_ledger` (append-only; DB triggers enforce it). Only Drizzle migrations change the schema.
- Every user-data query is scoped by the session user id; another user's row returns 404.
- Job descriptions, resumes and emails are untrusted input: fenced before any model call, never rendered as HTML.
- Secrets only in env vars, validated in `server/src/lib/env.ts`; `.env.example` lists names without values. The applier gets no secret outside its role.
- Tests with every logic change. Never mark work done without running it.
- Never without the founder: pushing or merging to `main`, production deploys (`promote.yml`, Vercel or Railway production), submitting a real application to a real employer, Stripe live mode, spending money, publishing or sending anything outside, Chrome Web Store submission, deleting user data, price changes.

## Commands

```
npm ci                      # install all workspaces
npm run infra:up            # local Postgres 17 + Redis 7 (Docker)
npm run db:migrate
npm run dev:web | dev:api | dev:worker | dev:applier | dev:extension
npm run typecheck | lint | test | build     # all workspaces
```

`server/test/*.int.test.ts` need a database (`TEST_DATABASE_URL`) and skip without one; on this machine they run only in CI. Say so when you could not run them.
