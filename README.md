# Kairos

A fit-first AI job application agent. It applies only to jobs that fit, tailors resumes only from facts the user confirmed, and sends nothing until the user approves it.

Specs live in [`docs/`](docs): PRD, TRD, app flow, UI/UX brief, backend schema, implementation plan and pricing.

## Repository layout

```
auto-career/
├── web/                     Next.js 16 app (Vercel)
│   ├── app/
│   │   ├── (auth)/          login, sign-up, forgot-password, reset-password, verify-otp
│   │   ├── (legal)/         terms, privacy, cookies, refunds
│   │   ├── (public)/        about, how-it-works, pricing, blog, careers, contact
│   │   └── (dashboard)/     signed-in pages: dashboard, onboarding, matches, queue,
│   │                        applications, inbox, profile, preferences, billing, settings
│   ├── components/
│   │   ├── layout/          navbar, footer, header, sidebar
│   │   ├── shared/          pieces used on more than one page
│   │   ├── landing/         home page sections
│   │   └── <page>/          one folder per page (auth, pricing, blog, dashboard/queue, ...)
│   ├── hooks/               use-me, use-matches, use-applications, use-credits, ...
│   ├── lib/                 api, auth-client, extension, site, blog, utils (one file each)
│   └── proxy.ts             redirects signed-out visitors away from (dashboard) pages
├── server/                  Express 5 API, BullMQ worker, Playwright applier (Railway)
│   ├── src/
│   │   ├── routes/          every API route file (/api/me, /api/matches, /api/applications, ...)
│   │   ├── services/        fit gate, tailoring, credits, Stripe, ATS adapters, LLM
│   │   ├── jobs/            poll-boards, score-matches, tailor-application, classify-email, cloud-apply
│   │   ├── db/schema/       Drizzle tables
│   │   ├── middleware/      auth, validation, errors, rate limits
│   │   ├── lib/             auth, env, logger, redis, mailer
│   │   ├── api.ts           entry: HTTP API
│   │   ├── worker.ts        entry: queues and schedules
│   │   └── applier.ts       entry: cloud applier
│   ├── drizzle/             SQL migrations
│   ├── railway/             service configs: api.json, worker.json, applier.json
│   ├── Dockerfile           api and worker image
│   └── Dockerfile.applier   applier image (Playwright base)
├── extension/               Chrome MV3 extension; dist/filler.js is shared with the applier
├── shared/                  types, zod schemas and plans used by every package
├── docs/                    the six planning documents and pricing
├── .github/                 CI, Dependabot, pull request template
└── docker-compose.yml       local Postgres 17 and Redis 7
```

The web app has no API routes of its own. `web/next.config.ts` rewrites `/api/*` to the Express API, so the browser talks to one origin and auth cookies stay first-party.

## Local setup

Needs Node 22+, npm 10+ and Docker (or local Postgres and Redis).

```bash
npm ci
npm run infra:up                       # Postgres on 5432, Redis on 6379
cp server/.env.example server/.env     # fill in BETTER_AUTH_SECRET and any keys you have
cp web/.env.example web/.env.local
npm run db:migrate
```

Then, each in its own terminal:

```bash
npm run dev:api        # http://localhost:4000, health at /health
npm run dev:worker     # polling, scoring, tailoring, email tagging
npm run dev:applier    # cloud applier (needs Chromium; optional locally)
npm run dev:web        # http://localhost:3000
npm run dev:extension  # rebuilds extension/dist; load it unpacked from chrome://extensions
```

Without a Postmark token, emails (sign-up codes, reset codes) are written to the API log.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

CI runs the same commands on pushes to `main` and on every pull request, then builds both Docker images.

## Deploy

- **Web:** Vercel, root directory `web`. Set `API_ORIGIN`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_EXTENSION_ID`.
- **Backend:** Railway project with Postgres and Redis plugins and three services from this repo: `api` (`server/railway/api.json`, runs migrations before each deploy), `worker` (`server/railway/worker.json`) and `applier` (`server/railway/applier.json`). Variables are listed in `server/.env.example`.

Step-by-step instructions are in [`docs/02-trd.md`](docs/02-trd.md) under "Railway setup" and "Vercel setup".
