# Kairos Backend: Stack Options Research (2026-10-16)

Scope: research input for the Kairos backend re-architecture. It covers every backend layer of a Node 22 TypeScript system on Railway serving about 10,000 users. It does not make the final architecture decision; each section ends with a recommendation and the condition that would change it, so the architecture document can adopt or override it. `web/` and `extension/` are frozen, so every option below is judged first on whether it can keep the existing HTTP contract (routes, request and response shapes, status codes, error codes, Better Auth cookie behavior) unchanged.

## 0. How to read this document

### 0.1 Evidence legend

Every factual claim carries one of these tags. Do not treat an `[E]` item as settled.

| Tag | Meaning |
| --- | --- |
| `[V]` | Verified on 2026-10-16 from the npm registry (version, license, release date, engines, dependencies) or from the vendor's own documentation or pricing page fetched during this research. |
| `[A]` | Reported by a search snippet or third-party aggregator. Plausible, but not confirmed on a primary page. Confirm before budgeting. |
| `[E]` | Engineering estimate or prior knowledge, not confirmed in this session. Measure or verify before committing. |
| `[D]` | Derived arithmetic from `[V]` list prices and the load model in section 1. Only as good as the assumptions in section 1. |

### 0.2 Headline recommendations

| Layer | Recommended | Runner-up | Confidence | Change the call if |
| --- | --- | --- | --- | --- |
| Runtime | Node 22.18+ now, plan Node 24 LTS before 2027-04 `[E]` | none | High | A required dependency drops Node 22. |
| API framework | Keep Express 5.3 for the migration; Fastify 5.12 if a rewrite is wanted | Hono 4.13 | Medium | The team wants generated OpenAPI from schemas (then Fastify with the zod type provider). |
| Queue and durable execution | DBOS Transact for TypeScript 5.3 on the existing Postgres, with human approval modeled as a database state, not a sleeping workflow | pg-boss 12.38 for plain jobs; BullMQ 6.3 if Redis stays anyway | Medium | The `recv` wait behavior or the missing-Conductor recovery gap (section 4.5) proves worse than expected in a spike. |
| ORM and query layer | Drizzle ORM 0.45.4 now, adopt 1.0 when it leaves release candidate | Kysely 0.29.6 | High | Drizzle 1.0 GA ships a breaking migration the team cannot absorb. |
| Postgres on Railway | Railway Postgres 18 with Railway's pgBackRest PITR; pgvector on a separate, rebuildable service or on a PITR-compatible image once verified | Managed Postgres off Railway (Neon, Crunchy, Supabase) | Medium | pgvector and PITR cannot coexist on one Railway image (open item in section 6.4). |
| Redis | Small Redis or Valkey for rate limiting and short caches only, or none if BullMQ is retired | Upstash fixed plan | Medium | BullMQ stays, or measured rate-limit write load exceeds what Postgres counters can carry. |
| Object storage | Cloudflare R2 through the S3 API | Railway Buckets | High | Data residency rules require everything on one provider. |
| PDF rendering | `@react-pdf/renderer` 4.9 from structured verified JSON, Playwright `page.pdf()` as fallback | pdfmake 0.3.11, Typst | Medium | ATS parse tests fail on react-pdf output. |
| Browser fleet | Dedicated applier service, one Chromium per replica, 4 contexts per replica, recycle browser every 25 jobs | Managed browser APIs (rejected on privacy and policy) | Medium | Measured RSS per context is above 600 MB. |
| Observability | OpenTelemetry SDK plus Sentry for errors and traces, `llm_calls` in Postgres for model traces, optional sampled export to Langfuse Cloud | Self-hosted Langfuse | Medium | The team wants prompt-playground and dataset UI badly enough to run five extra services. |
| Auth | Keep Better Auth, pin all `@better-auth/*` at 1.7.10 | Clerk, WorkOS | High | A security finding forces a hosted identity provider. |

## 1. Load model used for every cost and capacity figure

These are assumptions for comparing options, not product forecasts. The capacity document may replace them; every `[D]` figure below scales linearly with them.

| Quantity | Value | Reasoning |
| --- | --- | --- |
| Registered users at public beta | 10,000 | Locked decision 3. |
| Daily active users | 3,500 (35%) | Job-search tools have bursty weekday use. |
| Applications submitted per day, typical | 10,000 (1 per registered user per day) | Plan limits in `shared/src/plans.ts` bound this; 1 per day is a mid-range planning figure. |
| Applications submitted per day, design ceiling | 30,000 | Three times typical, used to check headroom. |
| Applications per month, typical / ceiling | 300,000 / 900,000 | 30-day month. |
| Model calls per submitted application | 5 (tailor, verify, answers, cover letter, one retry margin) | Pipeline agents from decision 4. |
| Fit-score calls per day, ceiling | 500,000 (10,000 users x cap of 50) | Per-user daily scoring cap, after pre-ranking has already cut candidates. |
| Durable steps (checkpoints) per application | 12 | Load facts, draft, verify, persist, render, store, wait gate, submit, report, charge, notify, close. |
| Cloud applies per day | 2,000 | About 1,000 Pro and Max users (10%) x 2 per day. |
| Cloud apply duration | 90 seconds of browser time | Form fill plus uploads on a typical ATS page. |
| Cloud apply peak concurrency | 20 contexts | 10 times the 2.1 average (2,000 x 90 s / 86,400 s). |
| Active job postings stored | 500,000 | About 50,000 new per day across polled boards. |
| API requests per second, average / peak | 25 / 150 | 2M requests per day, 6x burst. |

## 2. Runtime and language tooling

| Item | Version `[V]` | Note |
| --- | --- | --- |
| Node.js | 22 LTS (target 22.18 or later) | `pg-boss` 12.38.0 requires `>=22.12.0`; `graphile-worker` 0.18.0 requires `>=22.18.0`; `kysely` 0.29.6 requires `>=22.0.0`; the Better Auth CLI requires 22.12 or later. Pinning 22.18 or later satisfies all of them. |
| Node 22 end of life | 2027-04-30 `[E]` | Plan the Node 24 LTS move for Q1 2027 so the beta does not launch on a runtime near end of life. |
| TypeScript | `latest` tag is 7.0.2 (released 2026-07-08); 6.0.0-beta and 7.0.1-rc tags also exist | Version 7 is the native-compiler line. Confirm `drizzle-kit`, `tsx` 4.23.15 and `vitest` 5.0.5 work with it before upgrading; otherwise stay on the repo's current 5.x or 6.x. |
| zod | 4.6.7 | Used for strict agent output schemas and request validation. |
| Test | `vitest` 5.0.5, `testcontainers` 12.2.1 and `@testcontainers/postgresql` 12.2.1, `@electric-sql/pglite` 0.5.10 | Use real Postgres (Testcontainers) for queue, credit and uniqueness tests. PGlite is fine for pure query tests but does not cover extensions like pgvector reliably `[E]`. |

## 3. API framework: Express 5, Fastify 5, Hono

### 3.1 Facts

| | Express | Fastify | Hono |
| --- | --- | --- | --- |
| Version `[V]` | 5.3.0 | 5.12.7 | 4.13.13 with `@hono/node-server` 2.1.5 |
| License `[V]` | MIT | MIT | MIT |
| Validation and typing | Manual (zod middleware) | JSON Schema native; `fastify-type-provider-zod` 7.0.0 | `@hono/zod-openapi` 1.6.3, `hono-openapi` 1.3.5 |
| OpenTelemetry `[V]` | `@opentelemetry/instrumentation-express` through auto-instrumentations 0.81.0 | `@fastify/otel` 0.21.2 (first-party) | `@hono/otel` 1.2.0 |
| Logging | Add `pino` | Pino built in | Add `pino` |
| Throughput | Lowest of the three `[E]` | Highest on Node `[E]` | Close to Fastify on Node through the adapter, fastest on edge runtimes `[E]` (Hono's own page publishes only Deno, Workers and Bun numbers `[V]`) |
| Raw body for Stripe webhooks | `express.raw()` on the one route | Custom content-type parser or `addContentTypeParser` | `await c.req.text()` |
| Better Auth mount | `toNodeHandler(auth)` | Catch-all route calling `auth.handler` | `app.on(["GET","POST"], "/api/auth/*", c => auth.handler(c.req.raw))` |

### 3.2 Fit for this product

- At the load model (25 average, 150 peak requests per second), all three are more than sufficient. Throughput is not a selection criterion; a single 1 vCPU replica handles thousands of requests per second of simple JSON routes `[E]`.
- The hard constraint is contract compatibility: the frozen web app and extension depend on exact status codes and error codes (including `422 truth_lock`). Whatever the framework, the safety net is a recorded-contract test suite derived from `web/lib/api.ts`, `web/hooks/*.ts` and `extension/src/lib/api.ts`, run against the old and new servers before cutover.
- Express 5.3 is what runs today. Replacing it buys schema-driven validation, built-in structured logging and first-party tracing, but not a capability the product cannot live without.
- Fastify's lifecycle hooks (`onRequest`, `preValidation`, `onResponse`) map cleanly to the auth, plan-limit, idempotency-key and cost-guard middleware the architecture will need, and its schema serializer is useful for guaranteeing response shapes.
- Hono's advantage is portability to edge runtimes, which this Railway-hosted backend does not need.

### 3.3 Costs and risks

| Option | Cost | Risk |
| --- | --- | --- |
| Stay on Express 5.3 | Zero migration effort | No built-in schema or response validation, so contract drift is caught only by tests. |
| Move to Fastify 5.12 | About 1 to 2 engineer-weeks for around 40 routes plus contract tests `[E]` | Error-shape differences (Fastify's default 400 body) must be overridden with a custom `setErrorHandler`. Plugin encapsulation surprises for new engineers. |
| Move to Hono 4.13 | Same effort as Fastify | Node adapter is a thin layer over web-standard `Request` and `Response`; some Node-specific middleware does not apply. Smaller backend-on-Node community than Fastify `[E]`. |

### 3.4 Recommendation

Keep Express 5.3 through the data-layer and queue migrations (do not stack framework risk on top of engine risk). If the architecture document wants contract-first OpenAPI and typed responses, move to Fastify 5 as a separate, later milestone gated by the recorded-contract suite. Hono is not recommended here.

## 4. Job queues and durable execution

### 4.1 What the product actually needs

Derived from the pipeline in the project context (poll, pre-rank, score, tailor, verify, render, wait for the user, submit, charge).

1. Reliable background execution with retries and backoff, dead-letter inspection, and cron-style polling.
2. Fairness and caps: per-user daily scoring cap, per-provider LLM rate limits, per-ATS-host politeness for the applier, concurrency limits per queue.
3. Memoized steps. A retry of a tailoring workflow must not re-pay for the model call that already succeeded. This is the strongest argument for durable execution over plain job queues.
4. Idempotent identity: one application per (user, job); the same application approved from two tabs submits once.
5. A way to hold work for human approval for days, without holding memory or a connection per waiting application.
6. Observability: which application is stuck where, and how long each step took.

Important design finding that holds for every engine: the review and approval gap can last days and there may be tens of thousands of applications waiting at once (for example 3,500 daily active users x ~10 pending approvals). Model it as a database state (`applications.status = 'awaiting_review'`) and start a new short workflow when the user approves, using a deterministic workflow ID such as `submit:{applicationId}` as the idempotency key. Do not model it as a workflow parked on a long wait unless the engine proves it parks workflows out of process memory. For DBOS, the documented `recv` default timeout is 60 seconds and the docs recommend explicit timeouts `[V]`, which points to an in-process wait; whether a parked workflow occupies a worker concurrency slot must be confirmed in a spike `[E]`. Temporal, Inngest, Trigger.dev and Hatchet are designed to park waits outside worker memory `[E]`.

### 4.2 Candidate profiles

| | BullMQ | pg-boss | Graphile Worker | DBOS Transact | Inngest | Trigger.dev v4 | Hatchet | Temporal TS SDK |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Package version `[V]` | 6.3.15 | 12.38.0 | 0.18.0 | `@dbos-inc/dbos-sdk` 5.3.0 | `inngest` 4.24.0 | `@trigger.dev/sdk` 4.7.4 | `@hatchet-dev/typescript-sdk` 1.38.0 | `@temporalio/worker` 1.24.0 |
| SDK license `[V]` | MIT | MIT | MIT | MIT (Conductor client `@dbos-inc/dbos-enterprise` is under the DBOS Conductor Software License) | Apache-2.0 | MIT | MIT | MIT |
| Server license | Library only | Library only | Library only | Library only; Conductor proprietary `[A]` | Self-host exists; server license not confirmed `[E]` | Apache-2.0 `[V]` (pricing page) | MIT `[V]` | MIT `[A]` |
| State store | Redis | Postgres | Postgres | Postgres | Inngest service | Trigger platform (Postgres, Redis, more when self-hosted `[E]`) | Postgres, RabbitMQ optional `[V]` | Temporal server plus Postgres, Cassandra or MySQL `[E]` |
| Extra services to run | Redis | None | None | None (Conductor optional) | None if hosted; server if self-hosted | None if hosted; several if self-hosted | Engine plus API (hosted alternative exists) | Server cluster, or Temporal Cloud |
| Programming model | Jobs, flows | Jobs, queues, workflow dependencies | Tasks | Workflows and steps in plain TypeScript | Functions with `step.run` over HTTP | Tasks on managed or own workers | Tasks and durable tasks | Deterministic workflow code plus activities |
| Memoized steps | No (build by hand) | No (build by hand) | No | Yes (checkpoint per step) | Yes | Yes | Yes (durable tasks) | Yes (event history) |
| Cron | Job schedulers | Cron and RRULE `[V]` | Cron | Scheduled workflows | Yes | Yes | Yes `[V]` | Schedules |
| Concurrency and rate limits | Queue-level rate limit; per-group needs Pro `[E]` | Queue policies for rate limit, debounce, concurrency `[V]` | Named queues for serial execution `[E]` | Global and worker concurrency, rate limit, partitions, priority, dedup, delay `[V]` | Concurrency keys, throttle, debounce `[E]` | Queue and concurrency keys `[E]` | Keyed fair concurrency and dynamic per-user rate limits `[V]` | Task-queue level; fairness via design `[E]` |
| Human-in-the-loop | Build with DB state | Build with DB state | Build with DB state | `send` and `recv` with timeout, `setEvent` and `getEvent` `[V]` | `step.waitForEvent` `[E]` | Waitpoints, wait time not billed `[V]` partial | Durable event waits `[V]` | Signals, indefinite wait is cheap `[E]` |
| Exactly-once claim | At-least-once; stalled jobs can repeat `[E]` | At-least-once; atomic commit per job `[V]` | At-least-once `[E]` | Steps at least once; DB transactions exactly once via `transaction_completion` `[V]` | Steps at least once `[E]` | At least once `[E]` | At least once `[E]` | Activities at least once `[E]` |
| Observability | bull-board, Taskforce, own metrics | SQL on its tables | SQL on its tables | Conductor UI, `@dbos-inc/otel` 5.3.0 (MIT) `[V]` | Hosted dashboard, 24 hours of trace on Free, 7 days on Pro `[V]` | Hosted dashboard, 1 to 30 days of logs `[V]` | Dashboard, OpenTelemetry, Prometheus `[V]` | Web UI, mature metrics |
| Min Node `[V]` | 14.17 | 22.12 | 22.18 | 20 | 20 | 18.20 | 20 | 20.3 |

### 4.3 Cost at the load model `[D]`

Assumptions: 300,000 applications per month, 12 steps each, plus 300,000 scoring batch runs of about 3 steps. Total roughly 4.5 million step-level units per month, 13.5 million at the 900,000-application ceiling.

| Option | List price basis `[V]` | Typical month | Per application | Self-host alternative |
| --- | --- | --- | --- | --- |
| BullMQ (OSS) | Redis capacity only | About $5 to $10 (small Redis) | About $0.00003 | Same |
| pg-boss, Graphile Worker | Postgres capacity only | About $0 incremental | About $0 | Same |
| DBOS Transact OSS | Free; no per-checkpoint fee without Conductor | About $0 incremental, plus Postgres storage | About $0 | Same |
| DBOS Pro (Conductor) | $99 per month, 1M checkpoints, $50 per extra million | About $99 + 3.5M x $50/M = about $275 | About $0.0009 | Self-hosted Conductor is an Enterprise item |
| Inngest Pro | From $99 per month, 1M executions included, overage tiered $0.00005 falling to $0.000015 each; runs x (steps + 1) | About 4.5M executions: $99 + 3.5M x ~$0.00004 = about $240 | About $0.0008 | Self-host possible, license unconfirmed |
| Trigger.dev Pro | $50 per month, $0.000025 per run, compute per second (Small 1x $0.0000338 per second) | Runs about $110. Compute while awaiting model calls counts: 12 steps x ~10 s x $0.0000338 = about $0.004 per application, about $1,200 per month | About $0.004 | Self-host Apache-2.0 |
| Hatchet Cloud | Pay as you go: 1M runs free, then $30 per million | (4.5M - 1M) x $30/M = about $105 | About $0.0004 | MIT, engine on Railway about $50 to $80 per month `[D]` |
| Temporal Cloud | $50 per million Actions, $25 with self-service discount; roughly 40 to 45 Actions per application `[E]` | 13M Actions: about $340 to $675 plus storage | About $0.0011 to $0.0022 | Cluster ops cost, not recommended at this team size |

Reading the table against the roughly $0.01 per application target: compute-billed engines (Trigger.dev) can consume 40% of the budget before a single model token is paid for. Self-hosted library engines (DBOS OSS, pg-boss, BullMQ) are effectively free. Hosted per-step engines (Inngest, DBOS Pro, Hatchet Cloud, Temporal) sit between 4% and 22% of the budget.

### 4.4 Privacy fit

Hosted engines (Inngest, Trigger.dev Cloud, Hatchet Cloud, Temporal Cloud, DBOS Conductor) see step inputs and outputs unless payloads are encrypted or reduced to identifiers. Kairos step payloads would otherwise contain resume lines, fact text and form answers, which are sensitive under the India DPDP Act 2023 and GDPR. Library engines that store checkpoints in the product's own Postgres keep that data inside the existing processor boundary. DBOS Teams advertises a "metadata-only mode" `[V]` for Conductor, which suggests the default sends more than metadata to the hosted control plane; confirm before enabling Conductor. Whichever engine is chosen, step inputs and outputs should carry ids and hashes (fact ids, application id, artifact keys), never raw resume text.

### 4.5 DBOS Transact in detail (leading candidate)

Facts `[V]` unless marked.

- Workflows and steps are ordinary TypeScript functions. An interrupted workflow resumes from its last completed step. A custom workflow ID is an idempotency key: the same ID runs once, and by default returns the existing handle.
- Queues are registered after `DBOS.launch()` and stored in the system database. Features: `globalConcurrency`, `workerConcurrency`, `rateLimit` (global across processes), `priority` (lower runs first), `delaySeconds`, `deduplicationID` with `return-existing` policy, per-queue `timeoutMS`, and partitioned queues (`partitionConcurrency`, `partitionWorkerConcurrency`, `partitionRateLimit`, partition key required on enqueue). `listenQueues` lets CPU-heavy or browser workers dequeue only their own queues.
- Partitioned queues map directly onto Kairos needs: partition by ATS host for polite cloud applies, partition by user for per-user fairness.
- Transactions: `@dbos-inc/drizzle-datasource` 5.3.0 (MIT, peer `drizzle-orm`, depends on `pg`) runs a transaction that commits user writes and the DBOS checkpoint atomically, with a `transaction_completion` table for exactly-once database effects. Datasources also exist for Kysely, Prisma, Knex, node-postgres and postgres.js.
- Messaging: `send`/`recv` with topic and timeout, `setEvent`/`getEvent`. Sends from inside a workflow are exactly once; from ordinary code, pass an idempotency key.
- Steps are at least once; an uncaught exception puts a workflow in `ERROR` and it is not auto-recovered, so transient errors must be handled with step retries.
- Recent vendor activity: July 2026 notes list queryable workflow attributes, 20x faster durable streams and cooperative step timeouts; an August 2026 summary reports a tenfold throughput gain on partitioned queues `[A]`. The package shipped 5.3.0 on 2026-10-15, so it is actively maintained.
- Recovery without Conductor: on one server, a restart recovers that application's pending workflows. In a distributed deployment each executor needs a stable ID through `DBOS__VMID`; a restarted executor recovers only its own pending workflows, and other executors' workflows can be recovered through an admin endpoint `[A]`. Conductor automates this and detects dead executors. Conductor's source is proprietary and a production license key is reportedly required for self-hosted use `[A]`.

Risks specific to this product on Railway:

1. **Executor identity.** Railway replica IDs change on each redeploy, so `DBOS__VMID` cannot simply be the replica ID `[E]`. Options: run each worker service as a single replica with a fixed ID per service (horizontal scale then needs a per-replica fixed ID scheme), run a small recovery sweeper that lists `PENDING` workflows whose executor has not heartbeated and resumes them, or buy Conductor. This is the main open issue and should be the first spike.
2. **Parked-wait behavior** as described in 4.1. Avoided by the database-state design.
3. **System database growth.** About 12 checkpoints per application with JSON outputs could reach 50 to 60 KB per application, around 18 GB per month at 300,000 applications `[D]`. Keep outputs to ids and hashes, and add a retention job that deletes completed workflows older than 14 to 30 days `[E: confirm delete API]`.
4. **Single-vendor maturity.** DBOS Transact for TypeScript 5.x is younger than BullMQ and Temporal; the major version has moved quickly (v2.0 for TypeScript in early 2025, 5.3.0 by October 2026 `[A]`).
5. **Connection budget.** Each executor holds a pool plus listener connections; include them in the Postgres connection math in section 6.5.

### 4.6 The conservative alternatives

- **pg-boss 12.38.0.** Needs Node 22.12 or later and Postgres 13 or later `[V]`. Features: queues with rate-limit, debounce and concurrency policies, priority, retries with exponential backoff, dead-letter queues with redrive, cron and RRULE, job dependency workflows, pub/sub fan-out, `LISTEN/NOTIFY` delivery, `SKIP LOCKED` claiming, and transactional job creation with adapters for Drizzle, Knex, Kysely and Prisma `[V]`. No step memoization: model the pipeline as a state machine in Postgres where each stage is a job and results are written before the next job is enqueued in the same transaction. The README says the project is maintained by one person `[V]`, which is a bus-factor risk.
- **Graphile Worker 0.18.0.** Postgres-backed, cron, named queues for serial execution, dedup via job keys `[E]`. Smaller feature set than pg-boss; no rate-limit policy.
- **BullMQ 6.3.15** (what runs today). Mature, widely understood, flows for parent and child jobs, MIT. Needs Redis with `maxmemory-policy noeviction` and persistence, otherwise queued work can be lost `[E]`. At-least-once only. Per-group fairness is a BullMQ Pro feature `[E]`; Pro price not confirmed. Retaining it keeps two stateful systems (Postgres and Redis) in the critical path of every application.
- **Hatchet** (MIT, Postgres durability, TypeScript SDK 1.38.0). The strongest separately-run engine on features: durable event waits, keyed fair concurrency, dynamic per-user rate limits, child spawning, OpenTelemetry and Prometheus `[V]`. Tested to 10,000 tasks per second but uses more resources than Redis or RabbitMQ designs `[V]`. Cost is one more service to operate or a hosted plan at about $105 per month `[D]`. Pick it if DBOS's recovery model fails the spike.
- **Inngest, Trigger.dev, Temporal.** Not recommended as primary engine: Inngest and Trigger.dev move step data through a third-party service or require a heavy self-host; Trigger.dev compute billing breaks the cost target; Temporal Cloud is the most expensive and self-hosting its cluster is disproportionate for a 10,000-user beta.

### 4.7 Exactly-once reality

No engine gives exactly-once for a call to an external employer system. Every engine retries steps at least once. Therefore:

- The cloud-apply submit step must have `maxAttempts = 1`. After the final click, an ambiguous outcome (browser crash, timeout) moves the application to a `needs_check` state for reconciliation, never an automatic resubmit.
- Duplicate protection comes from database constraints, not the engine: unique (user_id, job_id) on applications; unique (application_id) on the credit charge; unique Stripe invoice id on grants; a `submission_attempts` row with a unique attempt key written before the click.
- DBOS's transaction exactly-once covers only database writes done inside a datasource transaction, which is exactly where credit charges and status changes live, so it is a real benefit, not a marketing point.

### 4.8 Recommendation and migration path

Primary: DBOS Transact 5.3 on a dedicated database (or schema) in the existing Railway Postgres, with the app tables in the same instance. Fallback: pg-boss with a hand-written stage state machine. Retain BullMQ only if the spike fails and the architecture decides to minimize change.

Mapping of the six existing queues:

| Queue today | Target | Notes |
| --- | --- | --- |
| `poll-boards` | Scheduled workflow, one child enqueue per board | Idempotent by (board id, poll window). |
| `score-matches` | Queue `score` with `workerConcurrency` and global `rateLimit` matching the OpenRouter budget | Per-user cap enforced by a database counter before enqueue, since the fit gate must run before any model call. |
| `tailor-application` | Workflow: load facts, tailor, verify, persist (transaction), render, store | Retries skip completed model steps. |
| `parse-resume` | Small workflow: extract text, parse, store | Hard limits on file size and parse time. |
| `classify-email` | Workflow: regex rules first, model only on ambiguity | Email text is untrusted input. |
| `cloud-apply` | Partitioned queue by ATS host, `listenQueues` only on applier replicas, submit step with one attempt | Pro and Max only, checked at enqueue and again at run time. |

Cutover: run both engines in parallel behind a feature flag per queue for one release, enqueue to DBOS and drain BullMQ, then remove Redis from the queue path. Use the application id as the workflow ID so a job double-enqueued during cutover runs once.

## 5. ORM and query layer

| | Drizzle ORM | Kysely | Prisma |
| --- | --- | --- | --- |
| Version `[V]` | 0.45.4 stable; 1.0.0-rc.4 exists on npm (released after beta.24); `drizzle-kit` 0.31.11 | 0.29.6 (0.30.0-beta.2 next), Node 22 or later | `@prisma/client` 7.10.0 (2026-08-25); the `prisma` CLI `latest` tag points at 8.0.0-rc.23 |
| License `[V]` | Apache-2.0 | MIT | Apache-2.0 |
| Style | SQL-like builder plus relational queries | Pure typed query builder | Schema-first client |
| Migrations | `drizzle-kit` generates SQL; the skeleton already uses SQL files in `server/drizzle/` | Built-in `Migrator`, hand-written | `prisma migrate` |
| pgvector | Native `vector` and `halfvec` columns and HNSW index helpers `[E]` | Raw `sql` fragments | Weak: `Unsupported("vector")` and raw queries |
| Partitioned tables | Not modeled; hand-written SQL migration | Same | Not modeled |
| DBOS data source | `@dbos-inc/drizzle-datasource` 5.3.0 | `@dbos-inc/kysely-datasource` 5.3.0 | `@dbos-inc/prisma-datasource` 5.3.0 |
| pg-boss adapters `[V]` | Yes | Yes | Yes |
| Better Auth adapter `[V]` | `@better-auth/drizzle-adapter` 1.7.10 | `@better-auth/kysely-adapter` 1.7.10 | `@better-auth/prisma-adapter` 1.7.10 |

Fit and risks:

- Drizzle matches the existing 17 tables and migrations, the Better Auth adapter already in use, and the DBOS and pg-boss integrations. Moving off it would be pure churn.
- Drizzle 1.0 is at release candidate, with relational queries v2 and a new migration engine. Staying on 0.45.4 is safe now; schedule the 1.0 upgrade after GA and avoid heavy use of the v1 relational query API so the upgrade stays small.
- Prisma's tag layout is a footgun (CLI `latest` is an 8.0 release candidate while the client `latest` is 7.10.0); avoid regardless.
- Driver: the skeleton uses `postgres` (postgres.js) 3.4.9. DBOS's Drizzle data source, pg-boss and Graphile Worker all use `pg` 8.23.1. If DBOS is adopted, move the application to `pg` so there is one driver and one pooling model.
- Partitioned tables (section 6.3) and pgvector indexes need hand-written SQL migrations; keep `drizzle-kit` for tables it can model and add numbered SQL files for the rest.

Recommendation: Drizzle ORM 0.45.4 with `pg`, SQL migrations for anything Drizzle cannot express, Kysely only as an escape hatch for complex reporting queries.

## 6. Postgres on Railway

### 6.1 Available facts

| Capability | Status | Source |
| --- | --- | --- |
| Railway plans and units | Pro $20 per month with $20 credit; vCPU $20 per month, RAM $10 per GB per month, volume $0.15 per GB per month, egress $0.05 per GB; per-service maxima on Pro: 1,000 vCPU, 1 TB RAM, 42 replicas, 1 TB volume | `[V]` Railway plan docs |
| Default Postgres | SSL image built on the official Docker image; major-version upgrades are a separate guide; default shared memory 64 MB, raise with `RAILWAY_SHM_SIZE_BYTES` | `[V]` |
| pgvector template | `pgvector/pgvector` image on PostgreSQL 18.4 with pgvector 0.8.6, vector, halfvec, sparsevec and bit types, HNSW and IVFFlat indexes; PG18 data volume must mount at `/var/lib/postgresql` | `[A]` search summary of the template page |
| pg_trgm | Listed in the separate "PostgreSQL Extensions" template (PG18 with pgvector, postgis, pg_trgm, pgmq, pg_cron, pgcrypto); also normally available as a contrib module in the official image `[E]` | `[A]` |
| High availability | An existing service can be converted to an HA cluster (Patroni, etcd, HAProxy) | `[V]` |
| Volume backups | Daily kept 6 days, weekly 27 days, monthly 89 days; restore creates a new volume | `[V]` |
| Point-in-time recovery | Supported. pgBackRest in the `postgres-ssl` image, enabled by `WAL_ARCHIVE_*` variables and a Railway bucket; weekly full plus daily differential backups; last 4 fulls kept, roughly 4 weeks of range; restore to any timestamp creates a new service and leaves the source untouched; no separate fee beyond bucket storage and upload egress; Postgres image must use a major tag such as `postgres-ssl:18` | `[V]` Railway PITR docs |
| PITR caveats | Window starts at the first base backup after enabling; if the bucket is unreachable a 5 GiB spool fills and WAL is dropped, truncating the window while the database stays up; residual RPO about 60 seconds (`archive_timeout`) plus failover detection; one read-write credential; cutover is manual | `[V]` |

### 6.2 pgvector and HNSW

HNSW and IVFFlat are available on Railway only through an image that bundles pgvector `[A]`. Sizing for the pre-ranking use: 500,000 active postings as 1024-dimension `halfvec` is about 1 GB of vectors plus an HNSW index of similar size `[D]`; 1536-dimension `vector` (float32) is about 3 GB `[D]`. Either fits in an 8 GB instance. Recommended settings `[E]`: `halfvec` columns, `hnsw` with `m = 16`, `ef_construction = 64`, cosine ops, query-time `hnsw.ef_search = 40`, and a filter-friendly pattern (filter by recency and location in SQL first, then order by distance) so pgvector's iterative index scans, introduced in the 0.8 line `[E]`, are not required.

### 6.3 pg_trgm, full text and partitioning

- `pg_trgm` is useful for company-name matching, duplicate posting detection and typo-tolerant search; use a GIN index on `lower(company_name)` `[E]`. Built-in `tsvector` full-text search covers keyword features without an extension.
- Declarative range partitioning by month is available in core Postgres. Candidates: `llm_calls` (about 15 million rows per month at the scoring ceiling `[D]`), `email_events`, `poll_runs` and posting history. Dropping an old partition deletes retention-expired data instantly with no vacuum cost, and supports privacy deletion windows. `pg_partman` is not in the default image `[E]`; a scheduled workflow that creates next month's partition and drops expired ones is a few dozen lines. `pg_cron` ships in the Extensions template `[A]` if the team prefers in-database scheduling.

### 6.4 Open item: PITR together with pgvector

Railway's PITR is documented for the `postgres-ssl` image family `[V]`. The pgvector and Extensions templates use different images `[A]`, and the docs do not say they can host PITR `[V]`. Three ways to close it, in preference order:

1. **Split the stores.** Primary transactional Postgres (users, facts, applications, credits, workflow state) on `postgres-ssl:18` with PITR. Embeddings live in a second, small pgvector service because they are derived data that can be rebuilt from posting text; its loss costs a re-embed, not user data. The cost is two services and a cross-database lookup (vector search returns posting ids; the primary database loads rows).
2. **Verify the combination.** Ask Railway support or test whether `WAL_ARCHIVE_*` works on an image that also has pgvector. If yes, run one database.
3. **Skip embeddings at first.** Pre-rank with SQL filters, trigram and full-text features, and add vectors when evals show a quality gain.

### 6.5 Connections, pooling, sizing

- Default `max_connections` is 100 `[E]`. Budget per replica: API 10, worker 10, applier 3, DBOS or pg-boss listener 2 to 3 each. Two API, two worker and three applier replicas use roughly 20 + 20 + 9 + 12 = 61 connections.
- Beyond roughly 8 replicas add PgBouncer. Transaction pooling breaks `LISTEN/NOTIFY` and session advisory locks, so engine listener connections must go direct and only request-path pools use PgBouncer `[E]`.
- Starting instance: 2 vCPU and 8 GB RAM, 100 GB volume, resize on measured buffer cache hit ratio. Railway bills metered use, not the limit, so the practical cost is the average actual usage `[V billing model, A rates]`.
- Backups: enable PITR on day one and also keep a weekly logical `pg_dump` to R2 as a recovery path that does not depend on Railway's tooling.

### 6.6 Alternatives outside Railway

Neon, Crunchy Bridge and Supabase provide managed PITR, pgvector and poolers without the image problem `[E]`. Costs and latency from Railway were not verified. Use them only if the Railway extension story in 6.4 cannot be closed.

### 6.7 Recommendation

Railway Postgres 18 with PITR enabled, split vector store unless the combination is verified, monthly partitions for high-volume append tables, explicit connection budgeting, and a nightly or weekly logical dump to R2.

## 7. Redis needs and alternatives

### 7.1 What Redis would be used for

| Need | Required? | Alternative without Redis |
| --- | --- | --- |
| Queue state (BullMQ) | Only if BullMQ stays | DBOS or pg-boss in Postgres |
| API rate limiting across replicas | Useful | Postgres counter table or Better Auth's database rate-limit storage `[V]`; at 25 average and 150 peak requests per second this is well within one Postgres |
| LLM token and request budgets across worker replicas | Useful | A `rate_limits` row with `INSERT ... ON CONFLICT DO UPDATE` per window; or the engine's own queue rate limit (DBOS `rateLimit`, `[V]`) |
| Short-lived cache (plan limits, board lists) | Nice to have | In-process LRU with 30 to 60 second TTL; data is mostly per user and cheap to read |
| Distributed locks | Avoid | Postgres advisory locks or unique constraints |
| Pub/sub for live updates | Only if a feature needs it | `LISTEN/NOTIFY` |

### 7.2 Options

| Option | Fact | Fit |
| --- | --- | --- |
| Redis 8 on Railway | Redis 8 is tri-licensed AGPLv3, RSALv2, SSPLv1 `[A]`; AGPL obligations matter only if the product modifies Redis and offers it as a service | Fine for internal use |
| Valkey | BSD-3-Clause fork of Redis 7.2.4, Linux Foundation governed, wire compatible with ioredis and node-redis `[A]` | Preferred if licence purity matters |
| Upstash | Free tier 500K commands per month; pay as you go $0.20 per 100K commands; fixed plans from $10 per month for 250 MB with no command billing `[V]` | Pay-as-you-go is a poor fit for BullMQ's polling; use a fixed plan if used at all |
| Library for limits | `rate-limiter-flexible` 11.2.2 (Redis, Postgres or memory backends), `@fastify/rate-limit` 11.2.1 `[V]` | Use `rate-limiter-flexible` with a Postgres or Redis store |
| Better Auth storage | `@better-auth/redis-storage` 1.7.10 exists for secondary storage `[V]`; 1.7 changed storage interface to require `increment` and `getAndDelete` and rate-limit storage to a `consume` method `[V]` | Only needed if sessions or rate limits move out of Postgres |
| Client | `ioredis` 6.0.0 `[V]`; BullMQ pins its own ioredis dependency range `[E]` | Check compatibility if mixing |

### 7.3 Recommendation

If DBOS or pg-boss replaces BullMQ, defer Redis entirely and use Postgres counters plus an in-process cache; add a small Valkey instance later if rate-limit writes show up in `pg_stat_statements`. If BullMQ stays, run a single Redis or Valkey with `noeviction`, AOF persistence on a volume, and keep it out of the credit and approval path (those must remain in Postgres).

## 8. Object storage and PDF rendering

### 8.1 Cloudflare R2 (recommended) `[V]`

| Item | Value |
| --- | --- |
| Storage | $0.015 per GB-month (Standard); Infrequent Access $0.01 per GB-month with 30-day minimum and $0.01 per GB retrieval |
| Operations | Class A (writes, lists) $4.50 per million; Class B (reads) $0.36 per million |
| Free tier per month | 10 GB, 1M Class A, 10M Class B |
| Egress | Free |
| Delete | Free |
| API | S3 compatible; use `@aws-sdk/client-s3` 3.1152.0 and presigned URLs |

Sizing `[D]`: 300,000 applications per month, about 120 KB of PDFs each (resume plus cover letter) is 36 GB of new data per month; keeping 12 months is 430 GB, about $6.50 per month. Operations are negligible at this volume. Store original resumes, rendered artifacts, failure screenshots (retention 14 days) and sampled LLM payloads (retention 14 to 30 days) under per-purpose prefixes with R2 lifecycle rules, and keep a `users/{userId}/` prefix so a deletion request removes everything with one prefix delete. Railway also offers Buckets (used by its PITR feature `[V]`); pricing was not confirmed, and they keep a single provider. Either is acceptable; R2 is recommended for its zero egress and separate failure domain from the primary platform.

### 8.2 PDF generation

| Option | Version `[V]` | Strengths | Weaknesses |
| --- | --- | --- | --- |
| `@react-pdf/renderer` | 4.9.0 (MIT) | No browser, pure Node, fast `[E]` (hundreds of milliseconds), real text layer for ATS, embeds fonts, maps naturally to structured JSON | Flexbox-like layout only, no arbitrary CSS, limited hyphenation |
| `pdfmake` | 0.3.11 (MIT) | Declarative document definition, tables, headers | Weaker typography control |
| Playwright `page.pdf()` | 1.64.1 (Apache-2.0) | Full HTML and CSS fidelity | Needs Chromium in the worker; cold start 1 to 2 seconds `[E]`; heavier memory |
| `pdf-lib` | 1.17.1 | Low-level editing, fill forms | Not a layout engine; no release since 2021 |
| Typst | Not in registry check | Best typography, fast `[E]` | Extra binary and template language |
| Gotenberg service | Not checked | Chromium and LibreOffice behind an HTTP API | One more service to run |

Fit: the truth lock gives a structural advantage to rendering from data. If the verified, fact-cited resume is a typed JSON document, the renderer cannot introduce a line that was not verified, and the same JSON can feed react-pdf and a DOCX renderer. Choose `@react-pdf/renderer` for resumes and cover letters, keep the template single column and text-only for ATS parsing, and test a corpus of parsed outputs (extract text back with `unpdf` and compare). Keep Playwright `page.pdf()` as a documented fallback if a template needs rich layout.

Resume ingestion (untrusted input): `unpdf` 1.9.0 (MIT, pdf.js based), `pdf-parse` 2.4.5 (Apache-2.0), `mammoth` 1.13.0 (BSD-2-Clause) for DOCX. Enforce a 10 MB size limit, a page limit, a parse timeout and a memory limit by running parsing as its own queue with low concurrency, because malformed documents are a denial-of-service vector.

## 9. Headless browser fleet for the cloud applier

### 9.1 Constraints from the product

Cloud apply is for Pro and Max only. No CAPTCHA solving, no stealth plugins, no proxy rotation, no fingerprint spoofing; a challenged run fails without a charge and the user resends through the extension. `extension/dist/filler.js` is injected unchanged. This rules out managed browser vendors whose value is stealth and CAPTCHA handling, and it keeps user data inside the product's own infrastructure. Browserless is available as a Railway template `[A]` but its license is source-available with commercial terms `[E]`; it is not needed.

### 9.2 Facts and measurements

| Item | Value |
| --- | --- |
| Playwright | 1.64.1 (Apache-2.0); `chromiumSandbox` defaults to false, which is typical for containers running as root; headless defaults to true `[V]` |
| Measured peak memory of an idle Chromium launched by Playwright | Windowed 1,094 MB, headless default 706 MB, headless minimal-flags 690 MB (one 2025 measurement, Python driver included) `[A]` |
| Contexts share one browser process; a browser crash kills all its contexts | `[A]` |
| Docker default `/dev/shm` is 64 MB and causes renderer crashes; use `--disable-dev-shm-usage` or a larger shm size; Railway exposes `RAILWAY_SHM_SIZE_BYTES` for databases and likely other services | `[A]`/`[V]` |
| Per-context incremental memory on a heavy ATS form page | About 150 to 350 MB, up to about 500 MB on very heavy pages `[E]`; must be measured |

### 9.3 Patterns

1. **Dedicated applier service.** Separate Railway service, separate image (Playwright base image, pinned to the same Playwright version as the npm package), `listenQueues` or its own queue so it never competes with LLM workers.
2. **One browser per replica, one context per job.** Fresh context per application (clean cookies and storage), closed in a `finally`. Contexts are lighter than browsers and start faster, at the cost of a shared crash domain. Recycle the browser after 25 jobs or when resident memory passes a threshold, and restart it on any `disconnected` event.
3. **Bounded concurrency.** 4 contexts per 2 vCPU, 4 GB replica: 0.7 GB browser baseline + 4 x 0.35 GB contexts + 0.3 GB Node = 2.4 GB, leaving headroom `[D]`. Concurrency set through the queue's `workerConcurrency`.
4. **Politeness by partition.** Partition key is the ATS host with a per-partition concurrency of 2 and a per-partition rate limit (DBOS `partitionConcurrency` and `partitionRateLimit` `[V]`), so one employer platform is never hammered.
5. **Hard timeouts.** 120 seconds per application (workflow `timeoutMS`), 30 seconds per navigation, a step-level cancel signal so a timed-out run closes its context.
6. **Evidence capture on failure only.** Screenshot plus a redacted DOM summary to R2 under a 14-day lifecycle; no video, no trace archives containing typed values.
7. **Graceful shutdown.** On `SIGTERM`, stop dequeuing, let in-flight applications finish up to a deadline, then mark the rest for requeue as pre-submit only. The drain window Railway grants must be confirmed `[E]`.
8. **Single submit attempt** as described in 4.7.
9. **Resource blocking.** Block images, media and fonts on application pages to save memory and time; this is not evasion because the user-visible behavior of the filled form is unchanged. Keep the default user agent and do not mask automation.

### 9.4 Replica sizing and cost `[D]`

- Average load: 2.1 concurrent contexts; peak 20. Five replicas of 2 vCPU and 4 GB give 20 context slots. Start with three replicas and add on queue wait time.
- Always-on idle cost per replica is about $8 per month (0.1 vCPU, 0.6 GB resident at Railway's metered rates $20 per vCPU, $10 per GB). Cost per application: about 0.5 vCPU x 90 s x $7.7e-6 + 0.5 GB x 90 s x $3.9e-6 = about $0.0005, plus baseline amortization, so roughly $0.001 per cloud apply. Within the $0.01 target by an order of magnitude.
- A managed-worker option such as Trigger.dev Medium 2x ($0.00017 per second) would cost about $0.015 per 90-second run `[D]`, above the whole per-application target. Not viable.

## 10. LLM client layer (affects stack choices)

OpenRouter is fixed by decision 1, so only the integration facts matter here.

| Item | Fact |
| --- | --- |
| Zero data retention | Enforced per request with `provider.zdr: true`, per account in privacy settings, or per guardrail (separate switches for Anthropic, OpenAI, Google, xAI, other); a request flag can only add enforcement; an endpoint with unclear policy is assumed to retain and train; list of ZDR endpoints at `/api/v1/endpoints/zdr` `[V]` |
| OpenRouter's own logging | Prompts and completions not logged unless the account opts in `[V]` |
| Fees | 5.5% (minimum $0.80) on card credit purchases; BYOK has no fee up to $25,000 per month of list-price inference, then 5% `[V]` |
| Fallbacks | Provider-level fallback is automatic on errors `[V]`; model-level fallback through the `models` array `[E]` |
| Client libraries | `openai` 7.34.0 pointed at the OpenRouter base URL; `@openrouter/ai-sdk-provider` 3.1.0 with `ai` 7.0.142; DBOS offers `@dbos-inc/vercel-ai` 0.5.4 for durable AI SDK calls `[V]` |

Recommendation: keep a single thin in-house `runAgent(role, input)` wrapper using the `openai` SDK, strict zod 4 schemas, `response_format` JSON schema, per-request `provider.zdr = true`, and explicit `models` fallbacks. No agent framework is required because orchestration is deterministic; adding one would add a dependency without a capability the pipeline needs.

## 11. Observability

### 11.1 Application telemetry

| Piece | Version `[V]` | Role |
| --- | --- | --- |
| `@opentelemetry/api` | 1.9.1 | Stable API |
| `@opentelemetry/sdk-node` | 0.223.0 | Bootstrap; experimental-line versions move often, so pin exactly |
| `@opentelemetry/auto-instrumentations-node` | 0.81.0 | HTTP, Express, pg, undici/fetch |
| `@opentelemetry/instrumentation-pg` | 0.75.0 | Query spans |
| `@opentelemetry/instrumentation-undici` | 0.33.0 | Spans for outbound `fetch` to OpenRouter and ATS hosts |
| `@fastify/otel` 0.21.2 or `@hono/otel` 1.2.0 | | Only if framework changes |
| `@dbos-inc/otel` | 5.3.0 (MIT) | Workflow spans and logs if DBOS is adopted |
| `pino` | 10.4.0 | JSON logs with request id, user id hash, workflow id |
| `@sentry/node` | 11.8.0 (MIT) | Errors, traces, release health; built on OpenTelemetry in current majors `[E]` |

Sentry pricing: Developer free (5k errors, 5M spans, 30-day lookback, one user); Team $26 per month billed annually with unlimited users; Business $80 per month `[V]`. Expect Team plus pay-as-you-go span overage; set trace sampling to 10% and sample 100% of errors. Railway appears to expose tracing configuration and trace listing tools (`set-service-tracing`, `list-traces` in its MCP tool set) `[E]`; confirm and use if it simplifies a collector.

Required trace attributes: `app.workflow_id`, `app.application_id`, `app.agent_role`, `app.prompt_version`, `app.model`, `app.fallback_used`, `app.tokens_in`, `app.tokens_out`, `app.cost_usd`. Never put resume text, answers or email bodies into span attributes.

### 11.2 LLM traces: Langfuse versus Postgres

| | Langfuse Cloud | Self-hosted Langfuse | `llm_calls` in Postgres (plus R2 payloads) |
| --- | --- | --- | --- |
| License | Product; client packages MIT (`@langfuse/client` and `@langfuse/otel` 6.0.0, `@langfuse/tracing` 6.0.0) | Open source with some Enterprise-only features `[V]` | Own code |
| Cost | Hobby free (50k units), Core $29 (100k units), Pro $199, overage $8 per 100k units falling to $6 `[V]`. At the scoring ceiling (15M units per month) overage is about $1,000 per month `[D]`; at 5% sampling about $100 `[D]` | Web and worker containers recommended at least 2 CPU and 4 GB each, at least two web instances, plus ClickHouse, Redis, Postgres and blob storage `[V]`; estimate $250 to $400 per month on Railway `[D]` | Storage only. Metadata about 1 KB per call; 15M calls per month is about 15 GB per month, handled by monthly partitions with 30 to 90 days detail and aggregated rollups beyond `[D]` |
| Privacy | Third-party subprocessor receives prompts; US, EU and Japan regions | Stays inside the product boundary | Stays inside the product boundary; full payload only for sampled or failed calls |
| Prompt and eval UI | Yes (playground, datasets, scores) | Yes | Build minimal views in SQL; offline eval runner writes `eval_runs` |
| Risk | Cost explosion at full volume; PII flowing out | Five-service operations burden, ClickHouse expertise | Less UI; more own code |

Recommendation: write every model call to `llm_calls` (role, prompt version, model, provider, token counts, latency, cost, cited fact ids, verifier verdict, error class, payload key or null). Store full request and response payloads only for a 2% random sample, all verifier rejections and all 422 truth-lock failures, with 14 to 30 day expiry in R2 and encryption. Cost alarms read from this table and from per-key OpenRouter spend limits `[E]`. Optionally export a 5% redacted sample to Langfuse Cloud through `@langfuse/otel` when the team wants its dataset and review UI; do not self-host Langfuse during beta. Keep prompts as versioned files in the repo with tests rather than in a vendor UI, so a prompt change is a reviewed commit.

## 12. Authentication

### 12.1 Better Auth 1.7

| Item | Fact |
| --- | --- |
| Version `[V]` | `better-auth` 1.7.10 (MIT, released 2026-10-15); all `@better-auth/*` packages at 1.7.10 including `drizzle-adapter`, `stripe`, `redis-storage`, `api-key`, `passkey`, `sso`, `scim`, `oauth-provider`, `mcp` |
| Upgrade guidance `[V]` | Upgrade `better-auth` and every `@better-auth/*` package together; most 1.7 changes are additive but some add columns or tables; the `auth` CLI needs Node 22.12 or later |
| Defect to check `[V]` | Databases that ran 1.7.0 to 1.7.2 may have an `issuer` column on `account` with a NOT NULL constraint and index that must be dropped; check for duplicate (providerId, accountId) pairs before upgrading |
| Proxy handling `[V]` | In 1.7 forwarded headers are ignored unless trusted-proxy handling is enabled. Kairos runs behind Railway's proxy and a Vercel rewrite, so client IP for rate limiting and canonical origin handling must be configured explicitly; test it |
| Storage interface `[V]` | Custom secondary storage must implement `increment` and `getAndDelete`; rate-limit storage uses a `consume` method |
| Stripe plugin | `@better-auth/stripe` exists, but Kairos needs one grant per Stripe invoice, rollover caps and billing pauses, so keep the product's own Stripe webhook handler (Stripe SDK `stripe` 23.0.0 `[V]`) and do not delegate billing logic to the plugin |

### 12.2 Alternatives

| Option | Fit |
| --- | --- |
| Clerk (`@clerk/backend` 3.23.2) | Hosted identity, per-user pricing at scale `[E]`; moves user identity to a third party and changes cookie and session behavior the frozen web app relies on. Rejected. |
| WorkOS (`@workos-inc/node` 11.0.0) | Hosted AuthKit, enterprise SSO focus `[E]`; same contract change; unnecessary for job seekers. Rejected. |
| Auth.js (`next-auth` 4.24.15, v5 still beta 5.0.0-beta.32; `@auth/core` 0.41.3) | Next.js centered; the backend is Express. Rejected. |
| Lucia | Last release 2024-10-20, deprecated. Rejected. |
| Supabase Auth, Neon Auth | Couple auth to a specific database vendor `[E]`. Rejected. |

Recommendation: keep Better Auth, upgrade to 1.7.10 as a pinned set, keep it on the existing Postgres through the Drizzle adapter, and run the schema and duplicate-account checks before the upgrade. Add contract tests for sign-in, session cookie, sign-out and the extension's token flow, since those are the highest-risk compatibility surface.

## 13. Infrastructure cost summary `[D]`

Typical month at 300,000 applications. Railway rates `[V]`: vCPU $20, GB $10, volume $0.15 per GB, egress $0.05 per GB; Pro plan $20. Usage figures are average metered usage, not limits.

| Component | Basis | Monthly |
| --- | --- | --- |
| Railway Pro plan | Fixed (includes $20 credit) | $20 |
| API, 2 replicas | 0.25 vCPU and 0.4 GB each | $18 |
| Worker, 2 replicas | 0.5 vCPU and 0.6 GB each | $32 |
| Applier, 3 replicas | 0.3 vCPU and 1.2 GB each | $54 |
| Postgres primary | 1.5 vCPU, 8 GB, 200 GB volume | $140 |
| PITR bucket | About 100 GB compressed WAL and backups | About $2 `[E]` |
| Separate pgvector service, if used | 0.5 vCPU, 3 GB, 20 GB volume | $43 |
| Redis or Valkey, if used | 0.1 vCPU, 0.3 GB | $5 |
| R2 | 430 GB plus operations | $10 |
| Sentry Team plus overage | | $50 |
| Langfuse Cloud sampled export, optional | Core plus overage | $60 |
| Egress | About 200 GB | $10 |
| Total, excluding model spend | | About $380 to $450 |

Per submitted application: about $0.0013 to $0.0015 for infrastructure at typical volume, about $0.004 at one third of typical volume. This leaves roughly 85 to 90% of the $0.01 target for model spend. A hosted per-step engine would add $0.0004 to $0.002 per application; a compute-billed engine would add about $0.004.

## 14. Risk register

| # | Risk | Layer | Severity | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | DBOS executor identity and recovery without Conductor on Railway | Queue | High | First spike: stable `DBOS__VMID` scheme or a PENDING-workflow sweeper; fallback pg-boss or Hatchet |
| 2 | DBOS `recv` wait holding a worker slot | Queue | High | Approval is a database state; new short workflow on approve |
| 3 | Duplicate employer submissions from engine retries | Queue and applier | High | One attempt on submit step; unique constraints; `needs_check` state |
| 4 | PITR and pgvector may not share an image | Postgres | Medium | Split stores or verify with Railway before launch |
| 5 | PITR window truncates silently if bucket is unreachable (5 GiB spool) | Postgres | Medium | Alert on pgBackRest archive lag; weekly logical dump to R2 |
| 6 | Step checkpoints containing resume text widen the sensitive-data footprint | Privacy | High | Ids and hashes only in step I/O; retention job; encrypt volume |
| 7 | Unbounded `llm_calls` growth | Postgres | Medium | Monthly partitions, rollups, drop old partitions |
| 8 | Better Auth 1.7 proxy-header change breaks IP rate limits or origin checks | Auth | Medium | Explicit trusted-proxy config; integration test behind the Vercel rewrite |
| 9 | Better Auth 1.7.0 to 1.7.2 schema leftovers | Auth | Medium | Inspect `account` for `issuer` column and duplicate pairs before upgrade |
| 10 | Drizzle 1.0 GA brings breaking relational query and migration changes | ORM | Low to medium | Stay on 0.45.4; minimize use of v1 relational queries |
| 11 | Single maintainer on pg-boss and Graphile Worker | Queue | Medium | Prefer DBOS or Hatchet as primary; keep the stage state machine portable |
| 12 | Chromium memory per context exceeds estimates | Applier | Medium | Measure before sizing; context cap and browser recycling |
| 13 | Third-party tracer receives prompts containing resumes | Privacy | High | Sample, redact, or keep traces in Postgres and R2 |
| 14 | Node 22 reaches end of life in April 2027 | Runtime | Low | Plan Node 24 migration in Q1 2027 |
| 15 | OpenRouter route without ZDR silently used | Privacy | High | `provider.zdr: true` on every request plus account-level guardrail |

## 15. Open items for spikes before the architecture is frozen

1. DBOS: stable executor ID on Railway, recovery sweeper, queue behavior with 10,000 pending `recv` waiters, system-database growth per 10,000 workflows, and a documented retention delete.
2. Railway Postgres: PITR enabled on the image that carries pgvector, or confirmation that the split-store design is needed; pg_trgm availability on the PITR image.
3. Applier: measured resident memory per context on three representative ATS forms (a Greenhouse-style, a Lever-style, a Workday-style page) and the SIGTERM drain window.
4. Better Auth 1.7.10: contract tests for cookie and session shape behind the same-origin rewrite; trusted-proxy configuration.
5. PDF: ATS text-extraction round trip for react-pdf output across 20 sample resumes.
6. Recorded-contract suite derived from `web/lib/api.ts`, `web/hooks/*.ts` and `extension/src/lib/api.ts`, replayed against old and new servers.

## 16. Sources

Registry data came from `registry.npmjs.org` on 2026-10-16 (versions, licenses, release dates, engines, dist-tags). Vendor pages fetched or searched:

- Railway plans and pricing: https://docs.railway.com/reference/pricing/plans
- Railway volume backups: https://docs.railway.com/volumes/backups
- Railway point-in-time recovery: https://docs.railway.com/volumes/point-in-time-recovery and template https://railway.com/deploy/postgres-pitr
- Railway PostgreSQL: https://docs.railway.com/databases/postgresql
- Railway pgvector and extensions templates: https://railway.com/deploy/pgvector and https://railway.com/deploy/postgresql-extensions
- DBOS workflow, queue, communication and transaction tutorials: https://docs.dbos.dev/typescript/tutorials/workflow-tutorial, https://docs.dbos.dev/typescript/tutorials/queue-tutorial, https://docs.dbos.dev/typescript/tutorials/workflow-communication, https://docs.dbos.dev/typescript/tutorials/transaction-tutorial
- DBOS pricing and recovery: https://dbos.dev/pricing and https://docs.dbos.dev/production/self-hosting/workflow-recovery
- Hatchet pricing and README: https://hatchet.run/pricing and https://github.com/hatchet-dev/hatchet
- Inngest pricing: https://www.inngest.com/pricing
- Trigger.dev pricing: https://trigger.dev/pricing
- Temporal pricing: https://temporal.io/pricing
- pg-boss: https://github.com/timgit/pg-boss
- Upstash pricing: https://upstash.com/pricing/redis
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Langfuse pricing and self-hosting: https://langfuse.com/pricing and https://langfuse.com/self-hosting
- Sentry pricing: https://sentry.io/pricing/
- Better Auth 1.7 upgrade guide: https://www.better-auth.com/docs/guides/1-7-upgrade-guide
- OpenRouter ZDR and FAQ: https://openrouter.ai/docs/guides/features/zdr and https://openrouter.ai/docs/faq
- Hono benchmarks page: https://hono.dev/docs/concepts/benchmarks
- Playwright memory footprint measurement: https://datawookie.dev/blog/2025/06/playwright-browser-footprint/
- Redis licensing background (search summary): Redis 8 AGPLv3 announcement coverage, May 2025
