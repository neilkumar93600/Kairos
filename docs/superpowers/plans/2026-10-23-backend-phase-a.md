# Backend phase A: resume workspace + Anthropic (contract-fixed work)

Date: 2026-10-23. Owner: "continue making all backend feature".

Phase A is everything fixed by the web contract (`docs/superpowers/specs/2026-10-23-resume-workspace/README.md` §3, §6–8; zod at the end of `shared/src/schemas.ts`) and by owner decisions, and identical under any architecture the running re-arch spec picks. Phase B (queues, Autopilot, ghost signal, event ledger, digests, interview rehearsal, ATS adapters, Typst PDF, daily AI allowance) waits for that spec's decision.

Rules: TDD for logic; pure services with injected I/O and thin Express routes. No git commands. The checkout is shared with the frontend session on `frontend/all-pages`.

| Unit | Owner | Files | Done when |
|---|---|---|---|
| 0 Scaffold | main | `server/package.json` (+ `@anthropic-ai/sdk`), `lib/env.ts` + `.env.example` (ANTHROPIC_*), `db/schema/profile.ts` (`resumes`, `resume_revisions`), `db/schema/jobs.ts` (`jobs.source`), `drizzle/0001_*.sql` | typecheck green |
| A LLM client | agent | `services/llm.ts`, `test/llm.test.ts`, delete `ai/openrouter.ts`, tiers in `resume-parser.ts` / `tailor.ts` | `chatJson` on the Anthropic SDK, structured output, cached system prompt, usage + USD logged; tests pass |
| B F1 match score | agent | `services/job-fit.ts`, `services/skills-dictionary.ts`, `test/job-fit.test.ts` | Pure `computeJobFit` returns a `JobFit` (40/30/20/10; unverifiable leaves the denominator); tests pass |
| C Job import | agent | `services/job-url.ts`, `services/job-import.ts`, `routes/jobs.ts` (POST /import), `services/ats/*` if needed, `test/job-url.test.ts` | Greenhouse/Lever/Ashby URLs parsed; 422 `unsupported_board`, 404 `posting_not_found`; source `manual_url`; hard filters give `fit` |
| D Resume + writer | agent | `services/resume-doc.ts`, `services/resume-writer.ts`, `routes/resume.ts`, tests | GET/PUT /resume (default from facts, 422 `truth_lock` + `lineIds`, a revision per save), POST /resume/suggestions (Sonnet 5.5, verified factIds, `needsFact`, note → unconfirmed fact) |
| E Drafts | agent | `services/sensitive.ts`, `services/draft-writer.ts`, `routes/applications.ts` (POST /:id/drafts), tests | Answer or cover-letter draft from confirmed facts; sensitive → 422 `profile_only`; cover letters plan-gated |
| F Wire-up | main | `routes/index.ts`, `routes/jobs.ts` (GET /:jobId/fit, POST /:jobId/tailor) | All §6 routes mounted; full typecheck + tests green |
| G Review | agent, other model | whole phase A diff | Findings fixed |

## Status 2026-10-23

Units 0–G done. Cross-model review found 4 high, 5 medium and 5 low issues; 11 were fixed:
- structured-output schema via the SDK's `zodOutputFormat`
- PATCH truth lock confirmed-only
- the tailor worker never overwrites user lines
- sensitive-label gaps closed
- shared invented-details check for numbers and skills
- limits and timeouts
- untrusted fencing
- writer max_tokens raised
- imported companies active
- UUID lowercasing
- route integration tests (`test/routes.int.test.ts`, run with `TEST_DATABASE_URL` on kairos-test-pg:55432)

Server suite: 171 passed; the integration tests are skipped without `TEST_DATABASE_URL`.

Open, deliberately:
- **Enum values:** after the SDK's schema transform, `enum` is only checked in code, so an off-enum model reply fails the call. Re-add `enum` to the outgoing schema if this shows up in logs.
- **Invented-details check is strict:** a skill named only in the job title fails an answer. Loosen it if evals show good answers being refused.
- **Prompt caching:** only the system prompt (about 400 tokens, below the cacheable minimum) is marked. Move the confirmed-facts block into a cached system block when spend matters.
- **Duplicate note facts:** a retried note request saves a duplicate unconfirmed fact.
- **No live Anthropic call has run yet.** Smoke test once `ANTHROPIC_API_KEY` is set.

## Alignment with ADR-001 (01-architecture.md, postgres-durable on DBOS, phases P0–P8)

Done without schema changes: GET /resume stores the default idempotently, PUT /resume writes contact back to profiles (B.8.3), and GET /jobs/:jobId/fit returns an optional `matchId`. Suite: 239 unit tests and 10 integration tests green.

Ownership agreed with the billing session (auto-career-81):
- **Billing session:** P0 (contract suite, invariant tests), P1 database foundations (PG18, pg driver, PgBouncer, roles, DBOS) and P2 (money, sending and truth).
- **This session:** P1 Anthropic gateway and usage tables (llm_calls, llm_cost_daily, user_daily_usage, ai_usage), and the P3 workspace deltas (employments and provenance, revision reasons and coalescing, checkClaims, claim-verifier, tailor cache, Typst PDF, jd-analyst and job cards).

Both wait for 02-database.md and 03-agent-runtime.md before writing schema. Whoever runs `drizzle-kit generate` next announces it first.

## Status 2026-10-24 (P1 gateway and usage tables)

The P1 runtime scope of `03-agent-runtime.md` 17 is implemented on `frontend/all-pages`, uncommitted:

- `drizzle/0002_platform_02_llm_ledger.sql` (custom migration): partitioned `llm_calls` (with the additive columns `call_kind`, `budget_class`, `trace_id`, `batch_id`; the DDL's `provider_request_id` carries the request id the runtime's 8.2 calls `request_id`), `llm_cost_daily`, `user_daily_usage`, `ai_usage`, `kairos_jsonb_add`, the partition and roll-up functions. Applied to a scratch `postgres:17`: insert into the partition, roll-up, `user_daily_usage` upsert, `ai_usage`, `llm_calls_drop_old_partitions()` and the erasure scrub all probed. Role grants ship with `ops/provision-roles.sql` as planned.
- `server/src/llm/`: gateway, client, schema (strict schemas keep enums; `$schema` and unsupported bounds dropped), prices, estimate, budget (Postgres store + memory store, 10 s cache, per-call cap parameterized for tier-up), ledger (row + spend counters in one transaction, 3 retries, `llm_ledger_write_failed`), limiter, breaker, fence (`DATA_RULES`, nonce fencing, echo canary), redact, errors, spend-store, testing (`FakeAnthropic`). telemetry, reconcile, batch, drift, allowance and claims land with their phases (P3/P4/P6).
- `server/src/agents/`: types, registry, prompt-asset, and the six migrated agents at v1 (`fit-scorer`, `resume-tailor`, `resume-parser`, `resume-writer`, `answer-drafter`, `cover-letter-writer`) with `prompts/v1.md`, `CHANGELOG.md`, `schema.snap.json`, and `prompts.lock.json`. `npm run agents:snap` / `agents:lock` run through `node --import tsx --import ./scripts/md-register.mjs` so the scripts can load the `.md` prompt files.
- `LLM_GATEWAY=anthropic` wiring in `fit`, `tailor`, `resume-parser`, `resume-writer` and `draft-writer`; the legacy `chatJson` path stays (removed in P3). `plans.ts` gained `aiDailyAllowance`, `dailyModelSpendCapUsd` and `interactiveSpendBackstopUsd` ([est] pending owner).
- Suite: 392 tests green including the 60 integration tests; 88 new tests cover the gateway (request shape, breakpoints, retries, repair with paths and codes only, tier-up, budget rows, single-flight, kill switches), registry checks (3.4), strict schemas, fence, redact and prices.

Deviations, recorded in code: the fingerprint covers system text + schema snapshot (render.ts source is not embeddable by esbuild; render unit tests cover it instead); `render` takes the call context so the stable per-user fence nonce can be derived; ops flags read through injectable providers until the control-plane migration (`platform_01_control_plane`) lands; the interactive backstop is a flat `plans.ts` field until allowances (F11) arrive in P3. No live Anthropic call has run yet: set `ANTHROPIC_KEY_INTERACTIVE`, `ANTHROPIC_KEY_BATCH` and `USER_HASH_KEY`, flip `LLM_GATEWAY=anthropic`, and run the S-A1 smoke.
