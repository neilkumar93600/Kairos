# Kairos

<p align="center">
  <img src="https://raw.githubusercontent.com/neilkumar93600/Kairos/main/web/public/apple-touch-icon.png" alt="Kairos Open Door Emblem" width="72" height="72" />
</p>

<h3 align="center">Quiet Editorial Authority</h3>

<p align="center">
  <strong>A fit-first AI job application agent. It applies only to jobs that fit, tailors resumes only from facts confirmed by the candidate, and dispatches nothing without explicit human approval.</strong>
</p>

<p align="center">
  <a href="https://kairos-seven-ashy.vercel.app"><img src="https://img.shields.io/badge/Production_Web-kairos--seven--ashy.vercel.app-1b0624?style=flat-square&logo=vercel" alt="Production Web App" /></a>
  <a href="https://github.com/neilkumar93600/Kairos/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/neilkumar93600/Kairos/ci.yml?branch=main&label=CI%20Checks&style=flat-square" alt="CI Status" /></a>
  <a href="DESIGN.md"><img src="https://img.shields.io/badge/Design_System-Duna_Frosted_Glass-8a5a00?style=flat-square" alt="Design System" /></a>
  <img src="https://img.shields.io/badge/Next.js-16_App_Router-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Express-5.x-lightgrey?style=flat-square&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/TypeScript-5.9_Strict-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-PostgreSQL_17-41b883?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/BullMQ-5.x-dc382d?style=flat-square&logo=redis" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Playwright-1.50-2eae42?style=flat-square&logo=playwright" alt="Playwright" />
</p>

---

## Executive Summary

Most "AI job application tools" are spray-and-pray spam engines: they scrape thousands of postings, hallucinate fake achievements to match keywords, and blast low-quality applications until candidate accounts are blacklisted by corporate ATS platforms.

**Kairos takes the opposite stance.** Designed with the gravity of an executive prospectus and the legal precision of a contract, Kairos operates as a disciplined, high-fidelity career proxy:

- **Selective Ingestion:** Ingests live postings directly from first-party company boards (Greenhouse, Lever, Ashby) with strict deduplication.
- **Pre-Scoring Fit Gate:** Discards low-match roles before any LLM tailoring runs, protecting candidate reputation and token budgets.
- **Cryptographic Truth Lock:** Synthesizes resumes and answers exclusively from user-verified profile facts. Fabrications are rejected at schema validation.
- **Dual Dispatch Paths:** Candidates can submit via an interactive Chrome Manifest V3 extension or delegate execution to an isolated cloud Playwright container.
- **Full Traceability:** Every submission generates an immutable receipt, field-level audit log, and credit ledger entry.

---

## Paradigm Comparison

| Dimension | Legacy "AI Job Bots" (Lazy Spray) | Kairos (Quiet Editorial Authority) |
| :--- | :--- | :--- |
| **Application Strategy** | Unfiltered volume; blasts 500+ generic applications/week | Highly targeted; applies only to verified high-fit roles |
| **Resume Tailoring** | Hallucinates metrics, technologies, and unverified titles | **Truth Lock:** Builds strictly from facts the candidate confirmed |
| **Candidate Agency** | Unattended auto-submits; candidate has no idea what was sent | **Human-in-the-Loop:** Every draft requires user review or calibrated autopilot |
| **ATS Compliance** | Obfuscated scrapers prone to CAPTCHA traps and bans | First-party Greenhouse, Lever, and Ashby adaptors |
| **Audit & History** | Ephemeral or non-existent submission records | Cryptographic submission receipts, full field diffs, and ledger logs |
| **Interface Tone** | High-saturation gradient blobs, gimmicky rocket emojis | Calm editorial broadsheet on warm unbleached linen |

---

## The Three Iron Invariants

> [!IMPORTANT]
> The Kairos codebase is architecturally governed by three non-negotiable guarantees enforced through PostgreSQL row-level check constraints, database triggers, and strict Zod runtime schemas.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             THE THREE IRON INVARIANTS                            │
├──────────────────────┬─────────────────────────────┬─────────────────────────────┤
│   1. THE FIT GATE    │      2. THE TRUTH LOCK      │   3. HUMAN-IN-THE-LOOP      │
│                      │                             │                             │
│ Never spray. Roles   │ No hallucinations. Tailored │ Zero unapproved sends.      │
│ below the user's fit │ resumes use only confirmed  │ Every application requires  │
│ threshold (default   │ facts from the user profile.│ explicit review or a user-  │
│ 75%) are disqualified│ Unverified claims fail at   │ configured autopilot rule.  │
│ before tailoring.    │ schema validation.          │ Receipts are immutable.     │
└──────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

1. **The Fit Gate (INV-1):**  
   Every job posting passes through SQL-level prefilters (seniority, location, remote preference, salary floor, company exclusion, sponsorship requirements) and rubric-based fit scoring. Postings falling below the candidate's score threshold are gated immediately with transparent reasoning.
2. **The Truth Lock (INV-2):**  
   Resume bullet points and application answers must point to verified fact identifiers (`factIds`) confirmed by the candidate during onboarding or library review. The engine will throw a validation fault if any synthesized sentence lacks a parent fact link.
3. **Human-in-the-Loop Agency (INV-3):**  
   Submissions never happen without express intent. Candidates inspect the tailored resume diff and generated answers in their review queue. An approval transition is required to move applications from `draft` to `approved` before the dispatcher touches an ATS endpoint.

---

## Architecture & Data Pipeline

```mermaid
flowchart TD
    subgraph S1 ["1. Board Ingestion & Prefilter"]
        P[ATS Board Poller] -->|Greenhouse / Lever / Ashby| JC[(Job Catalog)]
        JC --> PRE[SQL Trigram & Hard Prefilter]
        PRE -->|Mismatched Title / Location| EXCL[Filtered Out]
        PRE -->|Eligible Candidates| MQ[Scoring Queue]
    end

    subgraph S2 ["2. Fit Gate & Truth-Lock Tailoring"]
        MQ --> SCORER[Fit Scorer Worker]
        SCORER -->|Score < Threshold| REJ[Marked Below Bar]
        SCORER -->|Score ≥ Threshold| TAILOR[Tailoring Engine]
        U[(User Profile & Facts)] -->|Verified Facts Only| TAILOR
        TAILOR -->|Zod Schema Validation| DRAFT[Pending Application Draft]
    end

    subgraph S3 ["3. Candidate Review & Dispatch"]
        DRAFT --> QUEUE[Candidate Review Queue]
        QUEUE -->|Reject / Skip| ARCH[Archived]
        QUEUE -->|Approve Draft| DISP{Dispatch Coordinator}
        DISP -->|Interactive Browser Session| EXT[Chrome Extension MV3]
        DISP -->|Automated Background Job| CLOUD[Playwright Cloud Applier]
    end

    subgraph S4 ["4. Verification, Receipt & Tracker"]
        EXT & CLOUD --> ATTEMPT[ATS Submission Attempt]
        ATTEMPT -->|Confirmation Captured| RECEIPT[Cryptographic Receipt]
        RECEIPT --> LEDGER[(Credit Ledger & Usage Meter)]
        RECEIPT --> TRACKER[Application Tracker & Inbox Classifier]
    end
```

---

## Monorepo Layout

Kairos is structured as an npm workspaces monorepo:

```text
Kairos/
├── web/                       Next.js 16 (App Router) frontend deployed on Vercel
│   ├── app/
│   │   ├── (auth)/            Login, sign-up, password reset, OTP verification
│   │   ├── (dashboard)/       Dashboard, matches feed, review queue, applications, profile, settings
│   │   ├── (landing)/         Editorial landing page with interactive scroll stage & bento showcases
│   │   ├── (legal)/           Terms of service, privacy policy, cookie policy, refund policy
│   │   └── (public)/          About, how it works, pricing calculator, blog, careers, contact
│   ├── components/            Frosted glass primitives, preference forms, resume builder, data tables
│   ├── hooks/                 Client state hooks (use-me, use-matches, use-applications, use-resume)
│   └── proxy.ts               First-party reverse proxy for cross-domain session preservation
├── server/                    Express 5 API, BullMQ 5 background workers, Playwright applier (Railway)
│   ├── src/
│   │   ├── routes/            REST API endpoints (/api/me, /api/matches, /api/resumes, /api/billing)
│   │   ├── services/          Fit evaluation, LLM client, tailoring, Stripe billing, ATS adaptors
│   │   ├── jobs/              Board polling, match scoring, tailoring, cloud auto-apply
│   │   ├── db/schema/         Drizzle PostgreSQL schema definitions, triggers, and invariants
│   │   └── middleware/        Better Auth session guard, CSRF validation, rate limiting, audit logger
│   ├── drizzle/               Production SQL migrations (0000_init through 0017_facts_import_indexes)
│   └── Dockerfile*            Hardened Alpine & Playwright container images with pinned SHA digests
├── extension/                 Chrome Manifest V3 extension for client-side ATS auto-fill
│   ├── src/                   Background worker, DOM field scrapers, sandboxed form filler
│   └── dist/                  Compiled extension bundle ready for unpackaged developer loading
├── shared/                    Shared isomorphic contracts, plans, Zod schemas, and TypeScript types
├── docs/                      System architecture specifications, PRDs, TRDs, and operational runbooks
│   ├── 01-prd.md              Product Requirements Document
│   ├── 02-trd.md              Technical Requirements Document
│   ├── DESIGN.md              Comprehensive design token dictionary and visual guidelines
│   └── runbook/               Disaster recovery, incident response, key rotation, and deployment procedures
├── ops/                       PostgreSQL role provisioning (`ops/provision-roles.sql`), Railway templates
├── .railway/railway.ts        Declarative Infrastructure as Code (IaC) configuration for Railway
├── DESIGN.md                  Root semantic design system reference (Stitch / Design Systems Lead standard)
└── docker-compose.yml         Local developer stack (PostgreSQL 17 on :5432 & Redis 7 on :6379)
```

---

## Semantic Design System: "Duna with Frosted Glass"

Kairos features a bespoke visual identity documented in [`DESIGN.md`](DESIGN.md) and [`docs/DESIGN.md`](docs/DESIGN.md). The design prioritizes calm intellectual gravitas over hyperactive gamification.

### Visual Foundations

- **Aesthetic Stance:** Editorial broadsheet laid on warm unbleached linen with hairline micro-borders.
- **DFII Score:** **`19/15`** (Aesthetic Impact: 5, Context Fit: 5, Feasibility: 5, Performance: 5, Consistency Risk: 1).
- **The 99% Achromatic Rule:** All interactive surfaces, inputs, buttons, and text are strictly neutral. Chromatic color is quarantined exclusively to panoramic painted horizon illustrations representing dawn-to-dusk progression.
- **Material Elevation:** Translucent neutral frosted glass (`backdrop-filter: blur(16px)`) with specular hairline top highlights (`inset 0 1px 0 rgba(255, 255, 255, 0.70)`) floating over art layers.

### Core Color Palette

| Token | Name | Value | Role & Contrast Invariant |
| :--- | :--- | :--- | :--- |
| `--canvas` | **Warm Linen** | `#f7f7f5` | Global application backdrop for all routes. |
| `--surface` | **Paper White** | `#ffffff` | Primary cards, modal dialogs, and slide-over sheets. |
| `--sunk` | **Aged Bone** | `#edece7` | Sunken containers, nested metric blocks, and disabled states. |
| `--ink` | **Aubergine Ink** | `#1b0624` | Primary brand wordmark, headings, and active focus rings (**17.8:1 contrast**). |
| `--body` | **Deep Graphite** | `#444444` | High-legibility prose, descriptions, and list items (**9.1:1 contrast**). |
| `--action` | **Espresso Bean** | `#160f0c` | Primary interactive buttons, pills, and high-intent triggers (**19.0:1 contrast**). |
| `--lime` | **Lime Pulse** | `#7fee64` | 8 px status indicator for verified facts and connected integrations. |
| `--warn` | **Amber Caution**| `#8a5a00` | Quota notifications and human-review alerts (**5.5:1 contrast**). |
| `--bad` | **Crimson Alert**| `#a3261c` | Disqualification badges and destructive actions (**6.9:1 contrast**). |

### Typographic Hierarchy

1. **Instrument Serif (`--font-serif`):** The signature line. Used for authoritative hero statements (`"Job applications you would sign."`) and section manifesto anchors.
2. **Inter Tight (`--font-display`):** Structural geometry. Used for section headers (`H2`, `H3`), view titles, and tabular metric figures with negative letter-tracking (`-0.045em`).
3. **Inter (`--font-sans`):** High-readability technical interface. Used for body text, data cells, button labels, and code blocks. Strictly maintains a minimum 16 px size for prose.

---

## Local Development Quickstart

### Prerequisites

- **Node.js:** `>= 22.0.0` (check with `node -v`)
- **npm:** `>= 10.0.0`
- **Docker Desktop:** for running local PostgreSQL 17 and Redis 7 containers

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/neilkumar93600/Kairos.git
cd Kairos

# Install root and workspace dependencies
npm ci
```

### 2. Start Local Infrastructure

Launch PostgreSQL 17 and Redis 7 via Docker Compose:

```bash
npm run infra:up
```

*Verifying services:*
- PostgreSQL runs at `localhost:5432` (User: `kairos`, Database: `kairos_dev`)
- Redis runs at `localhost:6379`

### 3. Environment Configuration

Copy the sample environment templates:

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env.local
```

Key configuration variables:

| Variable | Workspace | Purpose | Default / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `server` | Pooled connection for API & workers | `postgres://kairos:kairos@localhost:5432/kairos_dev` |
| `DATABASE_UNPOOLED_URL` | `server` | Direct unpooled connection for migrations | `postgres://kairos:kairos@localhost:5432/kairos_dev` |
| `REDIS_URL` | `server` | BullMQ queue connection | `redis://localhost:6379` |
| `BETTER_AUTH_SECRET` | `server` | Session encryption key | Secure 32-character hex secret |
| `API_ORIGIN` | `web` | Express API endpoint | `http://localhost:4000` |
| `NEXT_PUBLIC_SITE_URL` | `web` | Web client domain | `http://localhost:3000` |

### 4. Run Database Migrations

Apply the complete migration suite (from baseline schema to full indexes):

```bash
npm run db:migrate
```

### 5. Launch Development Services

Run individual development servers in dedicated terminal tabs:

```bash
# Terminal 1: Express REST API (port 4000)
npm run dev:api

# Terminal 2: BullMQ Job Worker (ingestion, scoring, tailoring)
npm run dev:worker

# Terminal 3: Next.js 16 Web Frontend (port 3000)
npm run dev:web

# Terminal 4: Headless Playwright ATS Applier (optional)
npm run dev:applier

# Terminal 5: Chrome Extension MV3 Builder (optional)
npm run dev:extension
```

Visit [`http://localhost:3000`](http://localhost:3000) in your browser.

---

## Verification & Quality Gates

The monorepo enforces automated quality gates run across all packages before code is pushed to `main`:

```bash
# 1. Type check all workspaces (zero TS errors across shared, web, server, extension)
npm run typecheck

# 2. Lint architectural boundaries and code style
npm run lint

# 3. Execute unit and contract test suites
npm test

# 4. Production bundle compilation
npm run build
```

### Test Suite Summary

- **`@auto-career/shared`:** 4 test files, 76 passed tests (contract tests, plan definitions, Zod schema validation).
- **`@auto-career/web`:** 9 test files, 48 passed tests (render tests, proxy authentication, scroll stage calculations).
- **`@auto-career/extension`:** 1 test file, 6 passed tests (DOM filler, field scrapers, messaging).
- **`@auto-career/server`:** Comprehensive suite covering unit tests, service logic, BullMQ workers, and PostgreSQL integration tests.

---

## Production Deployment

### Frontend (`web`) on Vercel

The Next.js 16 frontend is deployed to Vercel with automatic edge caching and preview environments:
- **Framework Preset:** Next.js
- **Root Directory:** `web`
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Environment Settings:** `API_ORIGIN` points to the Railway production API instance.

### Backend Infrastructure on Railway

The backend architecture is declared entirely as code in [`.railway/railway.ts`](.railway/railway.ts):
- **Staging & Production Environments:** Isolated environments with separate databases and Redis instances.
- **Database:** Managed PostgreSQL 17 with point-in-time recovery (PITR) and automated backups.
- **Microservices:**
  - `api`: Express HTTP server running pre-deployment database migration gates (`npx tsx src/migrate.ts`).
  - `worker`: Scalable worker pool consuming BullMQ queues for board polling, scoring, and tailoring.
  - `applier`: Isolated container running Chromium with strict sandboxing for automated submissions.

---

## Documentation Index

Comprehensive engineering and product documentation is maintained in [`docs/`](docs):

| Document | Description |
| :--- | :--- |
| [`docs/01-prd.md`](docs/01-prd.md) | Product Requirements Document: market context, user personas, core loops, and monetization. |
| [`docs/02-trd.md`](docs/02-trd.md) | Technical Requirements Document: system architecture, API contracts, ATS adaptors, and data models. |
| [`DESIGN.md`](DESIGN.md) | Root Semantic Design System specification (Stitch / Design Systems Lead standard). |
| [`docs/DESIGN.md`](docs/DESIGN.md) | In-depth styling reference: full color palettes, CSS variables, typography scales, and motion rules. |
| [`docs/runbook/incident.md`](docs/runbook/incident.md) | Emergency response procedures, severity levels, communication protocols, and recovery playbooks. |
| [`docs/runbook/key-rotation.md`](docs/runbook/key-rotation.md) | Procedures for rotating JWT secrets, Stripe webhook secrets, and database credentials. |
| [`docs/runbook/disaster-recovery.md`](docs/runbook/disaster-recovery.md) | Database restore procedures, Redis cache recovery, and cold-start verification. |

---

## Contributing & License

1. Only pull requests passing all 4 quality gates (`typecheck`, `lint`, `test`, `build`) will be considered.
2. Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) standards.
3. Keep changes aligned with the Three Iron Invariants and the Duna Design System.

Private repository. Copyright &copy; 2026 Gray Matter Labs. All rights reserved.
