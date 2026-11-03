---
title: "Kairos — Fit-First AI Job Application Agent"
description: "A fit-first AI job application agent that tailors resumes strictly from user-confirmed facts and requires user approval before dispatch."
tags:
  - ai-agent
  - nextjs
  - express
  - drizzle-orm
  - postgres
  - redis
  - bullmq
  - playwright
  - design-system
  - obsidian
aliases:
  - Kairos
  - Auto-Career
date: 2026-11-03
version: "0.1.0"
---

# Kairos

> **Quiet editorial authority.** A fit-first AI job application agent by Gray Matter Labs. It applies only to jobs that genuinely fit, tailors resumes exclusively from facts confirmed by the user, and sends nothing until the user inspects and approves it.

---

## Non-Negotiable Invariants

> [!important] The Three Immutable Principles
> 1. **Fit-First Gate**: Applications are never sprayed. Every vacancy is evaluated against user-defined criteria and ATS guidelines; low-confidence matches are gated before any tailoring occurs.
> 2. **Truth Lock**: The tailoring engine operates strictly on confirmed factual entries from the user profile. The system rejects hallucinations, fabricated credentials, and unverified achievements at the contract level.
> 3. **Approval Autopilot**: Zero unsolicited dispatches. Every resume revision and cover letter must be explicitly approved or queued by the user before submission.

---

## Semantic Design System

Kairos is designed as a calm, tactile editorial document laid on warm linen. The interface is 99% achromatic: a soft painted valley, transitioning from dawn to dusk, holds all illustrative color, while interactive layers remain quiet, disciplined, and readable.

> [!tip] Design Philosophy
> Inspired by the *Duna* visual language ("Sunset watercolor on warm marble"). The page reads like an authoritative physical document worth signing, paired with subtle frosted glass floating over artwork.

### Chromatic Architecture

| Swatch | Color Name | Hex / Value | Token | Functional Role |
| :--- | :--- | :--- | :--- | :--- |
| ![#f7f7f5](https://via.placeholder.com/15/f7f7f5/f7f7f5.png) | **Linen** | `#f7f7f5` | `--canvas` | Ground canvas across all routes; warm, restful base. |
| ![#ffffff](https://via.placeholder.com/15/ffffff/ffffff.png) | **Paper White** | `#ffffff` | `--surface` | Primary cards, panels, modal sheets, and active surfaces. |
| ![#edece7](https://via.placeholder.com/15/edece7/edece7.png) | **Bone** | `#edece7` | `--sunk` | Sunken containers, nested chips, inactive toggles, skeletons. |
| ![#1b0624](https://via.placeholder.com/15/1b0624/1b0624.png) | **Aubergine Ink** | `#1b0624` | `--ink` | Primary headings, logo wordmark, focus rings (17.8:1 contrast). |
| ![#160f0c](https://via.placeholder.com/15/160f0c/160f0c.png) | **Espresso** | `#160f0c` | `--action` | Primary interactive buttons and high-intent action pills. |
| ![#2b211c](https://via.placeholder.com/15/2b211c/2b211c.png) | **Espresso Hover** | `#2b211c` | `--action-hover` | Deep roasted hover state for primary action buttons. |
| ![#444444](https://via.placeholder.com/15/444444/444444.png) | **Graphite** | `#444444` | `--body` | High-legibility body text, input borders (9.1:1 contrast). |
| ![#7fee64](https://via.placeholder.com/15/7fee64/7fee64.png) | **Lime Pulse** | `#7fee64` | `--lime` | 8px status indicator dot (verified, live, approved) with ink ring. |

### Materials, Depth & Elevation

- **Frosted Glass (`--glass`)**: `rgba(255, 255, 255, 0.64)` with `backdrop-filter: blur(16px)` and a `1px` translucent edge (`--glass-edge`). Used exclusively for surfaces floating over art.
- **Strong Glass (`--glass-strong`)**: `rgba(255, 255, 255, 0.78)` for dense information blocks (inbox, receipts, audit logs) to maintain WCAG 2.2 AA legibility.
- **Top Specular Highlight (`--glass-hi`)**: `inset 0 1px 0 rgba(255, 255, 255, 0.70)` producing physical rim lighting.
- **Hairline Shadow Edge (`--edge`)**: `inset 0 0 0 1px rgba(0, 0, 0, 0.05)` providing subtle physical separation without heavy drop shadows.

### Typography & Geometry

- **Display & Headings**: `Inter Tight` (weight 400). Letter-spacing tightened proportionally (`-0.035em` to `-0.045em`) for editorial elegance.
- **UI & Body**: `Inter` (weight 400 regular, 500 medium). Clean, balanced, neutral metrics.
- **Art Accents**: `Instrument Serif` (weight 400 italic) on select reflective headline moments paired with landscape artwork.
- **Shape Language**: 
  - Pill-shaped (`rounded-full`) for high-intent actions.
  - Subtly rounded geometry (`rounded-2xl` / 16px) for cards and modals.
  - Open door emblem ($\Pi$ frame) representing opportunity, clarity, and arrival.

---

## Monorepo Architecture

```text
kairos/
├── web/                     Next.js 16 (App Router, React 19, Tailwind CSS v4) on Vercel
│   ├── app/
│   │   ├── (auth)/          login, sign-up, forgot-password, reset-password, verify-otp
│   │   ├── (legal)/         terms, privacy, cookies, refunds
│   │   ├── (public)/        about, how-it-works, pricing, blog, careers, contact
│   │   └── (dashboard)/     dashboard, matches, queue, applications, inbox, profile, settings
│   ├── components/          atomic UI components, glass panels, bento grid, motion stages
│   ├── hooks/               use-me, use-matches, use-applications, use-credits
│   └── proxy.ts             first-party reverse proxy for auth session continuity
├── server/                  Express 5 API, BullMQ Worker, Playwright Cloud Applier on Railway
│   ├── src/
│   │   ├── routes/          API route handlers (/api/me, /api/matches, /api/applications, ...)
│   │   ├── services/        fit gate, tailoring, credits, Stripe, ATS adapters, LLM clients
│   │   ├── jobs/            poll-boards, score-matches, tailor-application, cloud-apply
│   │   ├── db/schema/       Drizzle ORM table definitions (Postgres 17/18)
│   │   ├── middleware/      auth guards, rate limiting, request tracing, error catalog
│   │   ├── api.ts           HTTP API entry point
│   │   ├── worker.ts        BullMQ queue coordinator and cron schedules
│   │   └── applier.ts       automated headless browser worker
│   ├── drizzle/             immutable SQL migrations (0000_init through 0017_facts_import)
│   ├── Dockerfile           production multi-stage image for API and worker
│   └── Dockerfile.applier   Playwright-enabled image for cloud applier
├── shared/                  universal Zod schemas, contract types, plan tier definitions
├── extension/               Chrome MV3 companion extension sharing the filler engine
├── docs/                    comprehensive PRDs, TRDs, runbooks, and design specifications
├── ops/                     database roles, connection pool budgets, and IaC toolchains
├── .railway/railway.ts      declarative Railway infrastructure-as-code
└── docker-compose.yml       local Postgres 17 and Redis 7 stack
```

> [!note] Single-Origin Architecture
> The Next.js frontend contains no bespoke server routes. `web/next.config.ts` proxies `/api/*` requests directly to the Express backend. This guarantees that HTTP-only authentication cookies remain strictly first-party across all user sessions.

---

## Local Development

### Prerequisites

- **Node.js**: `>= 22.0.0`
- **npm**: `>= 10.0.0`
- **Docker**: Docker Desktop / Colima for Postgres 17 and Redis 7

### Quickstart

1. **Clone & Install Dependencies**:
   ```bash
   npm ci
   ```

2. **Start Infrastructure**:
   ```bash
   npm run infra:up
   ```

3. **Configure Environment Files**:
   ```bash
   cp server/.env.example server/.env
   cp web/.env.example web/.env.local
   ```

4. **Execute Database Migrations**:
   ```bash
   npm run db:migrate
   ```

5. **Run Development Services**:
   ```bash
   npm run dev:api        # Express API on http://localhost:4000
   npm run dev:worker     # BullMQ background workers
   npm run dev:web        # Next.js web application on http://localhost:3000
   npm run dev:extension  # Build Chrome MV3 extension in watch mode
   ```

> [!tip] Local Mail Sink
> Without a configured Postmark token, transactional emails (magic sign-in links, one-time passwords, verification codes) are written cleanly to the API console output.

---

## Verification & Quality Gates

> [!note] Comprehensive Test Suite
> Every pull request and push to `main` must clear all 4 verification gates before deployment.

```bash
# 1. Typecheck all workspaces
npm run typecheck

# 2. Lint architectural boundaries & code rules
npm run lint

# 3. Execute unit and contract test suite (>1,540 tests)
npm test

# 4. Production workspace build
npm run build
```

---

## Production Deployment

- **Web Frontend**: Hosted on [Vercel](https://vercel.com) with automatic preview deployments and edge caching.
- **Backend Infrastructure**: Deployed to [Railway](https://railway.app) via declarative Infrastructure-as-Code (`.railway/railway.ts`).
  - `api`: Auto-scales with pre-deploy migration runner and graceful termination hooks.
  - `worker`: Dedicated BullMQ worker pool executing matching, parsing, and scoring jobs.
  - `applier`: Isolated container running Chromium with strict network boundaries.

---

## Documentation Index

- [[docs/DESIGN.md|Design Reference]] — Complete design tokens, color scales, components, and layout rhythm.
- [[docs/02-trd.md|Technical Requirements]] — Complete TRD covering authentication, ATS adaptors, and job queueing.
- [[docs/runbook/incident.md|Incident Response Runbook]] — Emergency procedures, service recovery, and operational playbooks.
- [[docs/superpowers/plans/2026-10-30-backend-completion/README.md|Backend Architecture]] — 50-work-package re-architecture spec and audit logs.
