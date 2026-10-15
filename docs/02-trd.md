# 2. Technical Requirements Document (TRD)

Kairos v1 · last updated 2026-10-13

## Platforms

- Web app and marketing site (desktop and mobile browsers)
- Chrome extension (Manifest V3, Chrome 120+)
- No native mobile app in v1

## Frontend and hosting

| Item | Choice |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack, `cacheComponents` and `partialPrefetching` on), React 19.3, TypeScript 5.9 |
| Styling | Tailwind CSS 4, tokens in `web/app/globals.css` (see 04-ui-ux-brief.md) |
| Data fetching | TanStack Query 5 in client components; every call goes to `/api/*` on the same origin |
| Auth client | `better-auth/react` with the email OTP and one-time token plugins |
| Route protection | `web/proxy.ts` (Next 16 renamed middleware to proxy): optimistic redirect when no session cookie. The API is the real authority. |
| Hosting | Vercel, project root `web/`, region `iad1` (US East, next to Railway) |
| API access | `next.config.ts` rewrites `/api/:path*` to `${API_ORIGIN}/api/:path*`, so cookies stay first-party and there is no CORS for the web app |

## Backend and database

| Item | Choice |
| --- | --- |
| Runtime | Node.js 22, ESM, TypeScript bundled with esbuild into `server/dist/` |
| API | Express 5.3 (`server/src/api.ts`) |
| Jobs | BullMQ 6 on Redis (`server/src/worker.ts`) |
| Cloud applier | Playwright 1.64 headless Chromium consuming the `cloud-apply` queue (`server/src/applier.ts`) |
| Database | Railway PostgreSQL, Drizzle ORM 0.45 with the postgres.js driver, SQL migrations in `server/drizzle/` |
| Cache and queues | Railway Redis |
| File storage | Private S3-compatible bucket (for example Cloudflare R2) for resume files and tailored PDFs; signed access only (implementation Task 3) |
| Hosting | Railway, one project, region US East, five services: `api`, `worker`, `applier`, `Postgres`, `Redis` |

One codebase, three processes: a modular monolith. `api`, `worker` and `applier` share `server/src/` and scale on their own.

## Authentication and roles

- Better Auth 1.7 mounted in Express at `/api/auth/*` (before `express.json()`).
- Methods: email + password (10+ characters) with required email verification by 6-digit OTP; Google OAuth when `GOOGLE_CLIENT_ID` is set; password reset by email OTP.
- Sessions: database sessions, 30-day expiry, refreshed daily, `better-auth.session_token` cookie (Secure in production).
- Extension: the web app generates a 5-minute one-time token, sends it to the extension through `externally_connectable`, and the extension trades it for a session token used as a bearer (`bearer` plugin).
- Roles: one role (user) in v1. Every query filters by the session user id. Admin tooling is a later task.

## External services and APIs

| Provider | Purpose | Limits and notes | Credentials owner |
| --- | --- | --- | --- |
| Greenhouse Job Board API | List jobs and form questions | Public GET, no key. Apply endpoint needs the employer's key, so we fill hosted forms. | none |
| Lever Postings API | List postings | Public GET; apply needs the employer's key | none |
| Ashby posting API | List postings | Public GET; rate-limited per IP | none |
| Stripe | Subscriptions, Checkout, customer portal, webhooks | Webhook signature required | Gray Matter Labs |
| Postmark | OTP and reset emails; inbound reply webhook | Inbound URL carries `?token=` secret | Gray Matter Labs |
| LLM provider (OpenAI-compatible) | Fit scoring (fast tier), tailoring and resume parsing (smart tier) | Provider and models set by env | Gray Matter Labs |
| Chrome Web Store | Extension distribution | Review on every release | Gray Matter Labs |

## Architecture

```
Browser ── Vercel (Next.js web) ── /api/* rewrite ──► Railway api (Express 5 + Better Auth)
                                                          │            │
Chrome extension ── bearer token ─────────────────────────┘            ├── Railway Postgres
   │ fills employer forms in the user's browser                        └── Railway Redis (BullMQ)
   ▼                                                                         │
Greenhouse / Lever / Ashby hosted forms ◄── Railway applier (Playwright) ◄───┤ cloud-apply queue
                                                                             │
Public job boards ──► Railway worker: poll-boards → score-matches → tailor-application
Postmark inbound ──► api /api/webhooks/inbound-email ──► worker: classify-email
Stripe ──► api /api/webhooks/stripe (subscriptions, invoice credits)
```

Data flow for one application:

1. `poll-boards` reads a public board and inserts new `jobs`, then queues `score-matches` per new job.
2. `score-matches` runs the hard filters per user, calls the fast model only for jobs that pass, and stores matches at or above the user's fit bar.
3. The user presses Prepare draft; the API creates an `applications` row (status `draft`) and queues `tailor-application`.
4. Tailoring writes truth-locked resume lines and answers. The user edits and approves (`approved`, channel `extension` or `cloud`).
5. The extension (or the applier) fills the employer's form, submits, and reports back. `recordSubmission` charges one credit only on success.
6. Replies forwarded to the user's address arrive through Postmark, get tagged, and link to the application.

## Security and privacy

- Sensitive data: resumes, work authorization, contact details, application answers, forwarded emails. Records stay in Railway Postgres; uploaded resumes and tailored PDFs go to a private S3-compatible bucket (for example Cloudflare R2), added in implementation Task 3. No third party gets more than its job needs.
- Access control: every route under `/api` except `/contact` and webhooks requires a verified session. Every query filters by `userId` from the session, never from the request body.
- Webhooks: Stripe signature verified on the raw body; replayed events ignored via `stripe_events`. Inbound email requires a secret token compared in constant time.
- Secrets: env vars only, validated at boot with zod (`server/src/lib/env.ts`). Production refuses to boot without `POSTMARK_SERVER_TOKEN`, because the mailer otherwise logs emails (and their codes) instead of sending them. Nothing secret in the web bundle.
- Headers: `helmet` on the API; `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` on the web app.
- Rate limits: Better Auth's own limiter on auth routes; `express-rate-limit` at 120 requests per minute per IP on `/api` and 5 per hour on the contact form. Move to a Redis store when `api` runs more than one replica.
- OTPs are stored hashed. Passwords are hashed by Better Auth.
- Logs: pino with redaction of cookies, authorization headers, passwords, OTPs and tokens.
- Deletion: Settings > Delete account removes the user; foreign keys cascade to profile, facts, applications, ledger and replies.
- Compliance: India's DPDP Act 2023 and the GDPR apply. Privacy policy is a draft for legal review.
- Known dev-only advisories: `npm audit` flags drizzle-kit's bundled esbuild and eslint-config-next's glob packages. Both are dev tools, not shipped in any image. Recheck on each upgrade.

## Performance and reliability targets

| Target | Value |
| --- | --- |
| API read latency | p95 under 300 ms for `/api/me`, `/api/matches`, `/api/applications` |
| Posting freshness | New postings seen within 30 minutes (5 minutes for priority companies) |
| Cost per submitted application (model + compute) | about 1 cent; tracked per call in logs |
| Uptime | 99.5% for web and api |
| Jobs | 3 attempts with exponential backoff; idempotent job ids per entity |
| Data safety | Railway Postgres daily backups; unique keys make retries safe: one application per (user, job), one charge per application, one grant per invoice |
| Health | `GET /health` checks Postgres and Redis; Railway uses it as the api healthcheck |

## Environments and delivery

| Environment | Web | Backend |
| --- | --- | --- |
| Local | `npm run dev:web` on :3000 | `npm run infra:up` (Postgres + Redis in Docker), `npm run dev:api`, `dev:worker`, `dev:applier` |
| Preview | Vercel preview per pull request | Railway `staging` environment |
| Production | Vercel production (`main`) | Railway `production` environment |

CI (`.github/workflows/ci.yml`) runs on pushes to `main` and on every pull request: `npm ci`, typecheck, lint, tests, build for every workspace, then a no-push build of both Docker images.

### Railway setup

1. Create a project in region US East. Add the Postgres and Redis plugins.
2. Add three services from the GitHub repo, each with root directory `/` and config file path:
   - `api` → `/server/railway/api.json` (Dockerfile `server/Dockerfile`, pre-deploy `node dist/migrate.js`, healthcheck `/health`)
   - `worker` → `/server/railway/worker.json` (same image, `node dist/worker.js`)
   - `applier` → `/server/railway/applier.json` (Dockerfile `server/Dockerfile.applier`, Playwright base image)
3. Set variables from `server/.env.example` on each service. Reference the plugins: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `REDIS_URL=${{Redis.REDIS_URL}}`.
4. Give `api` a public domain (e.g. `api.kairos.app`). `worker` and `applier` stay private.

### Vercel setup

1. Import the repo, set the root directory to `web`. Vercel installs from the repo root because it is an npm workspace.
2. Variables: `API_ORIGIN` (the Railway api URL), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_EXTENSION_ID`.
3. Set `BETTER_AUTH_URL` and `WEB_ORIGIN` on Railway to the Vercel production domain, since the browser reaches auth through the rewrite.

## Key technical decisions and tradeoffs

| Decision | Reason | Alternative considered |
| --- | --- | --- |
| Express API on Railway, Next.js only for UI | Long-running workers, queues and Playwright need a server; one backend for web and extension | Next.js route handlers on Vercel (no long jobs, no browser) |
| `/api` rewrite through Vercel | First-party cookies, no CORS, one origin for users | Separate `api.` subdomain with cross-site cookies |
| Better Auth | Open source, runs inside Express, sessions in our Postgres, OTP and one-time tokens built in | Clerk (paid per user, hosted UI), hand-rolled auth |
| Modular monolith with three entry points | One solo developer, shared types, independent scaling | Microservices |
| BullMQ on Redis | Retries, scheduling, concurrency, idempotent job ids | pg-boss on Postgres |
| Drizzle + SQL migrations | Typed queries, plain SQL migrations reviewed in PRs | Prisma |
| Fill hosted forms, never the apply APIs | Apply APIs need each employer's key | Partnering with each ATS |
| Greenhouse embed URL for applying | Custom-domain boards redirect the hosted page; the embed always serves the form | `absolute_url` (often the employer's site) |
| Extension first, cloud applier for Pro and Max | User's own browser avoids most bot checks and keeps control; cloud adds hands-off sending | Cloud only (CAPTCHAs, cost) |
| One filler bundle for both channels | `extension/dist/filler.js` runs in the content script and is injected by Playwright, so fixes land in both | Separate Playwright selectors |
| Forwarding address instead of Gmail OAuth | Gmail read scopes are restricted and need Google verification plus a yearly security assessment; users also distrust them | Gmail API |
| Credits charged on success only | Matches the promise; the partial unique index makes double charges impossible | Reserve-then-refund |
| Stripe only | Your choice; one provider for USD subscriptions | Razorpay + merchant of record |

### Known constraint found in testing

Greenhouse's form page loads reCAPTCHA. The extension path is unaffected in normal use (a real browser and a real user), but the cloud applier may be challenged. The applier marks such runs as failed (no charge) and the user can resend through the extension.
