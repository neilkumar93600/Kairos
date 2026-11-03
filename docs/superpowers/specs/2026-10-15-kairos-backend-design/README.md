# Kairos backend design: master README

Written 2026-10-30 (WP-43 of the backend completion plan). Status: **in force**. This file is the entry point to the backend specification set in this directory: what was decided, which document wins when two disagree, what every file is, which work package builds which phase, and the one capacity table whose numbers govern the rest. It does not restate the designs; it points at them.

Evidence tags are the architecture's: **[V]** verified in a file or vendor document, **[est]** an estimate to be replaced by measurement, **[L]** assumed (an estimate, not a measurement).

## 1. The decision in force

ADR-001 Revision 3 (`01-architecture.md` A.11), **Accepted 2026-10-30 as the CTO-recommended default under the owner's delegation ("write all backend code"); the owner may revisit.** Path (c), the hybrid: keep the Express API, Better Auth and BullMQ; add durable guarantees (a DBOS seam, with a Postgres outbox fallback) only for approve, cloud send, settlement, Stripe ingest and offer pause. The plan that sequences the build is `docs/superpowers/plans/2026-10-30-backend-completion/` (`README.md` the CTO review, `decisions.md`, `work-packages.md`, `ciso.md`, `gap-map.md`).

| Decision | Value | Where it lands |
|---|---|---|
| Architecture path | (c) hybrid; secure closed beta in about 4 to 5 weeks, R1 server-side import in about 8 to 10, the paid-beta gate in about 16 to 20, Autopilot after that [L] | `01` A.11; WP-09, WP-45, WP-22 |
| Scale target, next 12 months | 10,000 registered users, 3,500 daily actives; 300 requests per second sustained, 600 tested ceiling; read p95 300 ms, write p95 500 ms, auth p95 800 ms; zero duplicate sends or charges under chaos; plan (not build) 100,000 users at 2,000 requests per second. "10K-1M requests per millisecond" is retired | section 6 below; WP-28, WP-37 |
| Cloud channel | Owner only (`OWNER_USER_IDS`) until WP-04 (applier containment) is accepted on staging and spike S-AP4 passes or is signed off; Pro and Max use the extension meanwhile | WP-00, WP-04 |
| Schema authority | The resume-suite PRD is authoritative for `resumes`, `resume_revisions`, imports, tracker tables, `application_events` and render timing (the sent snapshot is frozen and rendered at approval); one migration-numbering lane, allocated by the data lane (L4) alone; Postgres 17-compatible DDL until PG18 is confirmed | `02` banner, 7.1.7, 7.1.8, 7.3, 7.7, 14.3; `05` 9.2a; `workers/04`, `workers/05` amendments |
| Spent daily AI allowance | 429 `rate_limited` with `details.reason = "daily_allowance"` and `resetsAt`; 402 stays "not enough credits"; pipeline caps 0.05, 0.20, 0.25 and 0.50 USD a day by plan; interactive allowances from `shared/src/plans.ts` | `01` B.8.10; PRD 11 (amended) |
| Sign-in | Email with OTP, and Google; other providers hidden until configured (WP-38) | `05` 5.1 |
| Tax and currency | USD with Stripe Tax on (`automatic_tax`, billing address and tax-id collection, portal configured as code); the owner registers where thresholds require, with an accountant; multi-currency deferred; merchant of record and no-tax rejected | `01` A.11; WP-47 |

Non-negotiable invariants, unchanged: the truth lock (every AI-written resume line, answer or cover-letter sentence cites confirmed facts; never an invented number, employer, title, date, tool or scope); approve-before-send by default (Autopilot only opt-in); exactly-once credits (charge only for a submitted application, release or refund on failure); no CAPTCHA solving or bot-check evasion; the user's mailbox is never read; EEO, disability, veteran, visa, sponsorship and salary answers are never model output; the fit gate runs before any model call. They are enforced as listed in `01` B.16. The frozen web and extension contract (`server/test/helpers/frozen-routes.ts` and the contract tests) changes only additively; `extension/` is not modified.

## 2. How the documents relate

| Document | Role |
|---|---|
| The CTO plan (`docs/superpowers/plans/2026-10-30-backend-completion/`) | Decides **scope and order**: which packages, in which waves, with which owner decisions. It does not redesign |
| `01-architecture.md` (ADR-001, Revision 3) | The decision record and the target architecture (Part B), and the inventories (Part C) |
| `02` to `06`, `workers/`, `agents/`, `_db/` | The detailed designs that implement Part B. Header status "Proposed" in those files is superseded by ADR-001 Revision 3: they are the design baseline, with the amendments listed in section 9 |
| The resume-suite PRD (`../2026-10-29-resume-suite/README.md`, owner-approved 2026-10-29) | Authoritative for the resume library, versions, import, templates, review levels and the job tracker: their tables, routes and the render-at-approval rule. D7 builds it web-first against the QA mock, then on today's Express server |
| The resume workspace spec (`../2026-10-23-resume-workspace/README.md`) | Still binding for the truth rules (its section 3) and for the web contract (its sections 6 to 8), except where the PRD changes it by name (the PRD replaces its single template and its single resume per profile) |
| `_options/`, `_research/` | Inputs to the decision. Not specifications. `_research/anthropic-models.md` is binding for model choice and prices; `cost-model.md` is binding for volumes only |

**Precedence rule** (first match wins):

1. The invariants (`01` B.16, `_research/requirements.md` INV-n) and the owner decisions of section 1. No document overrides them.
2. A dated amendment (`[Amended 2026-10-30, ...]`) wins over the text it names. Amendments carry the decision they implement.
3. For the resume library, versions, imports, templates, tracker, `application_events` and sent-resume timing, the PRD wins; for the truth rules and the web contract of the workspace, the workspace spec wins; elsewhere in the web contract, the frozen code wins.
4. `02-database.md` wins over `01` B.10 and over the `_db/` domain drafts for the schema; `05-api.md` wins for HTTP; `06-infrastructure.md` wins for infrastructure, and its S-D1-corrected tables win over `01` where they differ; a worker spec wins for flow detail in its own domain; an agent spec under `agents/` wins over `01` B.9.2 and `03` 3.3 and 13.2 for its own agent's input, output, prompt, checks and eval format (*added 2026-11-03, WP-49*), while the worker or route spec that calls the agent keeps the flow around the call.
5. Where the plan and a specification disagree about **order or scope**, the plan wins; about **shape**, the specification (or the PRD where rule 3 applies) wins.

**Name map** (old name in files that were not edited, current name):

| Old | Current | Why |
|---|---|---|
| `applications.resume_pdf_key` | `applications.resume_file_key` | PRD 12; written once at approval by the render job, not by prepare |
| `application_events.detail`, keyed by `application_id` | `application_events.payload`, keyed by `tracker_item_id` with an `application_id` link | PRD 12 |
| `resumes.template` | `resumes.template_id` | PRD 7.2 |
| `resume_revisions.reason` `save`, `pre_ai`, `pre_autopilot` | `edit`, `before_ai`, `before_tailor` | PRD 12 |
| `TRUSTED_PROXY_HOPS_VERCEL`, the `x-vercel-id` test | removed; `KAIROS_EDGE_SECRET` and `x-kairos-edge` | CISO should-fix, `05` 5.5 |
| `BETTER_AUTH_URL` = the API origin | `BETTER_AUTH_URL` = the web origin; `API_PUBLIC_ORIGIN` separate | `05` 5.1, gap api-auth-security-02 |
| 402 for a spent allowance | 429 `daily_allowance` | PRD 11 amended |
| DBOS queue option `partitionQueue`, `concurrency` | partition key with `partitionConcurrency`; `globalConcurrency` | spike S-D1 |
| Rule names D1 to D9 (`01` B.5.1) versus D1 to D10 (PRD) and D4 (workspace) | Always cite the document: "rule D1 of B.5.1", "PRD D8", "workspace D4" | the numbers collide |

## 3. File index

| File | Status after Revision 3 | What it holds |
|---|---|---|
| `README.md` | In force (this file) | Index, decisions, precedence, phase map, capacity table, deferrals |
| `01-architecture.md` | **ADR-001 Revision 3, Accepted 2026-10-30** | Part A the decision record (A.11 is Revision 3); Part B the target architecture (B.5 now covers the durable seam only); Part C inventories |
| `02-database.md` | Revision 2 (2026-10-25), **amended 2026-10-30** | The integrated schema, roles, indexes, retention, migrations. PRD tables and the numbering lane amended |
| `03-agent-runtime.md` | Baseline, unamended | The Anthropic gateway, agent definition, request policy, truth-lock layers, budgets. DBOS wording applies to the seam only; its steps run as BullMQ jobs elsewhere |
| `04-matching.md` | Baseline, unamended | Matching v2 (prefilter, F1, pacing, caps, scoring). Built on BullMQ (WP-23, WP-34) |
| `05-api.md` | Revision 1, **amended 2026-10-30** | The HTTP layer. 5.1 and 5.5 corrected; the PRD routes added in 9.2a |
| `06-infrastructure.md` | Revision 2 baseline, three env names amended | Railway, secrets, observability, DR, security, capacity plan. Its 9.2 and 9.3 are the corrected capacity sources |
| `agents/01-resume-parser.md` | Baseline | The only agent spec written; the other eight are WP-49 |
| `_db/*.md` (6 files) | Domain drafts, subordinate to `02` | Per-domain table designs. For resumes, revisions, events and imports `02` and the PRD supersede `_db/identity-profile.md` and `_db/applications.md` |
| `_options/*.md` (4 files) | Historical | The four candidate architectures that A.4 compares |
| `_research/*.md` (9 files) | Inputs | `as-built.md` (the skeleton as of 2026-10-15, defects D-nn, S-nn, P-nn), `requirements.md` (FR, NFR, INV, AC, OQ), `anthropic-models.md` (binding for models and prices), `cost-model.md` (volumes only; prices superseded), `openrouter.md` (superseded by decision A of 2026-10-23), `stack-options.md`, `integrations.md`, `huntr-tsenta-teardown.md` (F1 to F11), `spike-s-d1-local.md` (DBOS 5.3.0 local results, folded into `01` B.5) |
| `workers/01` to `workers/16` | Baseline, see below | One spec per worker or request-flow family |

| Worker spec | Built by | Note |
|---|---|---|
| `01-ingest-poller` | WP-23, WP-45 | Polling on BullMQ with ETag, host caps, close-only imported boards |
| `02-match-candidates`, `03-fit-scoring` | WP-06 (interim controls), WP-23, WP-34 | Scoring ceilings first, then the matching v2 pipeline |
| `04-prepare-application` | WP-41 | **Amended 2026-10-30**: BullMQ, tailored copy, no render in prepare |
| `05-resume-workspace` | WP-17, WP-19, WP-31, WP-39 | **Amended 2026-10-30**: many resumes per profile, PRD revisions, render at approval |
| `06-approval-autopilot` | WP-29, WP-32 (`approveCore`), WP-36 (Autopilot) | In the durable seam |
| `07-cloud-applier` | WP-04, WP-29, WP-19 | Containment first; reads the snapshot file |
| `08-submission-settlement` | WP-29, WP-22 | In the durable seam |
| `09-billing-events` | WP-10, WP-32, WP-47 | Stripe ingest in the seam |
| `10-inbound-email` | WP-24, WP-33 | Offer pause with a 48-hour undo |
| `11-resume-parse` | WP-17 | On the BullMQ parse queue; imports per `resume_imports` |
| `12-engagement-notify` | WP-35, WP-44 | |
| `13-interview-rehearsal` | Deferred (WP-40) | A PRD non-goal |
| `14-durable-ops` | WP-09 (reconcilers), WP-22, WP-45 | Reconcilers are the primary liveness path |
| `15-ops-monitors` | WP-11, WP-27 | |
| `16-housekeeping` | WP-09, WP-25 | Retention and erasure |

## 4. Phase calendar mapped to work packages

Revision 2's phases P0 to P8 (`01` B.14) are kept as the vocabulary for exit criteria. Under Revision 3 they are delivered by the packages below, in the plan's waves. Waves: 0 today; A security, truth lock, CI, contract, ADR; B limiters, ceilings, billing, detection, R2, crypto, agent specs; C isolation, reconcilers, database foundations, backups, IaC, evals, load test stage 0, queue hardening, tax; D resume import, durable seam, privacy, ops flags, API hygiene, schema expand, mail core; E matching interim, inbound messaging, verifier, settlement, digests; F renderer, tracker, writer v2, Stripe store-then-process, prepare v2; G offer pause, matching v2, paid-beta gate, templates; H Autopilot, contract migrations; I deferral register.

| Revision 2 phase | Content (short) | Delivered by | Exit |
|---|---|---|---|
| (new) Wave 0 | Emergency containment | WP-00 | Cloud owner-only; no offer pause; inbound token checked first; imported boards inactive |
| P0 Safety net | Contract suite, integration tests in CI, invariant tests | WP-01, WP-05, WP-30 | Integration job required; known-defect tests as expected failures; two-user authorization matrix |
| P1 Foundations | Postgres, driver, roles, PITR, gateway, interim controls, limiter, redaction, observability, IaC | WP-02, WP-03, WP-06, WP-08, WP-11, WP-12, WP-13, WP-14, WP-15, WP-18, WP-22 (seam launch), WP-27, WP-28 (stage 0) | Sign-in works from Vercel; gateway carries all model calls with a cost row; caps on the old loop; restore drill timed |
| P2 Money, sending, truth | Credits, status guard, `approveCore`, attempts, settlement, Stripe, offer pause, inbound email, events | WP-10, WP-22, WP-29, WP-32, WP-33, WP-24, WP-42, WP-44 | Chaos test: 1,000 scripted approvals with kills, all terminal within 10 minutes, zero duplicate attempts, zero double charges |
| P3 Verifier, prepare v2, workspace | Verifier, `checkClaims`, prepare, resume suite R1 to R3 | WP-07, WP-16, WP-17, WP-19, WP-20, WP-26, WP-31, WP-41, WP-49 | Evals pass; zero unsupported claims in a 7-day sample; draft ready p95 under 60 s |
| P4 Matching v2 | Polling, prefilter, F1, pacing, scoring, digests | WP-23, WP-34, WP-35 | Shadow reproduces at least 90% of above-bar matches; superset property test green |
| P5 Applier hardening, then Autopilot | Egress guard, containment, browser pool, Autopilot | WP-04 (pulled forward to wave A), WP-45, WP-36 | 50 forced crashes with zero duplicate submissions; Autopilot only after the paid-beta gate and 14 days of verifier enforcement |
| Paid-beta gate | | WP-37 (with WP-13, WP-23, WP-25, WP-28, WP-29, WP-32) | 24 h at 1.5 times peak with chaos; SLOs met; zero double charges; connections at or under 160 of 200 |
| P6 Billing, replies, privacy | Reconciliation, replies, erasure, encryption, tax, tracker hooks | WP-18, WP-21 (R4), WP-24, WP-25, WP-32, WP-33, WP-35, WP-47, WP-46 (contract migrations) | Erasure drill within 24 h; billing integrity clean 14 days. Gate: before 1,000 active users |
| P7 Decommission Redis and BullMQ | | **Deferred** (WP-40) | Trigger in section 8 |
| P8 Load and launch gates | | WP-28 (stage 1), WP-37 (stage 2) | Capacity table reproduced within 25% |
| Phase 2 | Templates and DOCX, deferral register | WP-39, WP-40 | |
| Resume suite (PRD) | R1 versions and import; R2 templates and export; R3 smarter review; R4 tracker | R1: WP-16, WP-17; R2: WP-19, WP-39; R3: WP-31 (with WP-26); R4: WP-21 | PRD section 14 acceptance |

Packages that fit no Revision 2 phase are listed where they act: WP-00 (wave 0), WP-38 (extra sign-in providers, optional, after WP-02 and WP-03), WP-47 (tax) and WP-43 (this work). The plan has 49 packages, numbered WP-00 to WP-47 and WP-49 (there is no WP-48); every one is named in this section or in section 3. Spikes: S-D1 (Railway half) gates WP-22; S-P1 (Postgres 18 and PITR) is WP-13; S-B1 (Better Auth headers) is WP-02 and WP-03; S-A1 (Anthropic) is WP-06 and WP-20; S-AP1 to S-AP4 are WP-04, WP-29 and WP-45; S-F1 and S-I1 are WP-23 and WP-34; S-T1 is WP-19.

## 5. Migration numbering

One lane. Today's journal ends at `0002_platform_02_llm_ledger`; the next file is `0003`. The labels in `02-database.md` 14.3 are an apply order, not reserved names. Every migration, including the PRD lane (`resume_suite_01_versions`, `resume_suite_02_tracker_events`, `resume_suite_03_contacts_interviews`), takes the next free number in merge order, and the data lane alone allocates numbers and regenerates the Drizzle journal on rebase. DDL is Postgres 17-compatible until PG18 is confirmed on Railway (WP-13).

## 6. Master capacity table

One row per figure. Where the specification gives more than one value, the governing number is named with its source and the way it will be measured. Everything marked [est] or [L] is replaced by measurement; the owners of the measurement are WP-28 (stage 0 and 1), WP-22 (the durable seam) and WP-37 (stage 2).

| Figure | Competing values and where they come from | **Governing number** | Measured by |
|---|---|---|---|
| Users and demand | 10,000 registered, 3,500 DAU; 617 requests per DAU a day (stack-options); derived peak 146 rps (3,500 x 617 / 86,400 x 6) | **10,000 users, 3,500 DAU, derived peak 146 rps** [L] | Beta traffic |
| API load target | 25 average and 150 peak rps (`06` 1.2, `05` 19.4, tested at 225); the owner's "10K-1M per millisecond" (retired) | **300 rps sustained peak (2x derived), 600 rps tested ceiling.** The 150 and 225 figures are retired. Headroom is about 4x (3 replicas x about 200 rps over 146), not the ">10x" of `01` B.12.4 | k6 stage 0 at 10, 50, 150, 300 virtual users (WP-28); stage 2 at 1.5x peak plus a ramp to 600 (WP-37) |
| Latency SLOs | Reads 300 ms (`06`); no write, auth or AI SLO in the spec | **Read p95 300 ms, write p95 500 ms, auth p95 800 ms, AI routes 14 s** | WP-27, WP-28 |
| Postgres server connections | 108 of 200 (`01` B.4.2, self-run PgBouncer pools 15, 25, 4); 178 (`02` 4.4 as first written); 118 base and 134 growth (`06` 9.2, Railway-managed PgBouncer, `DEFAULT_POOL_SIZE` 20 per role); 134 (`workers/14`); about 194 of 200 at the replica maxima of `06` 1.3 (api 6, worker 8, applier 16) with the seam on | **Design ceiling 118 at base and 134 at growth (`06` 9.2, delta X1).** Before the seam exists the worst case is 74 (no direct DBOS pools, which are 44 base and 60 growth). Each replica beyond the growth topology of 3 api, 4 worker and 8 applier adds 4, 6 and 3 direct connections once the seam runs, so the replica maxima of `06` 1.3 are **not** a budget: growth beyond the topology needs PgBouncer pool or `max_connections` changes first. `max_connections` 200, alert at 160, pass criterion at most 160 [est] | Connection count at 1 to 3 replicas (WP-28 stage 0), 24 h run (WP-37) |
| Durable checkpoint writes | 751,000 a day, 37 per submitted application (`01` B.5.7, 3 fixed writes); 1.11 million, 55 (`06` 9.3, S-D1 corrected, omits `queueMatch`); 1.33 million, 66 (`workers/06` 9, adds `queueMatch`); 64 bottom-up (`_db/platform.md` 5.4); +30k, +14k, +7k from `03`, `07`, `08` | **For the full DBOS catalog of Revision 2: 1.33 million a day, 66 per submitted application** (the additions of `03`, `07`, `08` are about 4% and inside the S-D1 tolerance). **Under Revision 3 only the seam checkpoints:** approve and resend 37,000 + `applyCloud` 89,000 + `settleAttempt` 64,000 + Stripe and notify counted whole 104,000 = **at most about 294,000 a day (3.4 a second average, about 15 per submitted application)** [est, an upper bound]. The A-DUR-4 thresholds (target 60, alert 80) stay as the outer alert; WP-22 sets the seam's own thresholds from its first measurement. The 400 writes a second trigger of `01` A.7 is unchanged | `durable.checkpoint_writes_per_submitted` (WP-22), chaos run (WP-37) |
| Postgres CPU and storage | CPU about 2 vCPU average, 3 peak of 4 (`06` 9.2); storage 70 GB at month 6, 105 GB at month 12 (`06` 9.2) versus a 108 GB ceiling (`02` 12.3) | **4 vCPU and 16 GB at growth; 150 GB volume; alert at 70% (105 GB)**; the 108 GB figure is the cost-model ceiling, a realistic first year is 60 to 70 GB [est]. Business writes about 17 a second average (1.5 million rows a day) | Railway metrics, `metrics_minute` |
| API process | 0.5 vCPU, 0.75 GB expected (`01` B.4.1) versus 1 vCPU, 1 GB limit (`06` 1.2) | **0.5 vCPU expected (billed), 1 vCPU and 1 GB limit**; not a conflict | WP-28 |
| Applier | 600 MB per context, 4.0 GB total, zero headroom (`06` 1.2); about 400 MB, 2.4 GB (`workers/07`); 6 replicas x 3 contexts (cost model) versus 8 x 4 (`06`, `workers/07`) | **600 MB per context, 4 contexts per 4 GB replica, 8 replicas at growth** until spike S-AP1 measures; browser recycled every 25 contexts | WP-45, WP-04 (S-AP1) |
| Anthropic | 225,000 calls a day, 800 RPM peak; fleet buckets 1,650 RPM; Build tier cap $1,000 a month against about $4,100 needed | **Raise to the Scale tier before 2,500 users** (owner action) and sign zero data retention before beta; budget about $4,092 a month for models at 10,000 users | WP-06, usage report |
| Cost per submitted application | $0.0035 to $0.0038 and $1,586 a month for models (`cost-model.md`, OpenRouter, superseded); $0.0073 to $0.0079 and $4,092 (`01` B.12) | **$0.0079 baseline, internal target $0.008, hard ceiling $0.01** (`01` B.12.3, open question 16); per-day pipeline caps 0.05, 0.20, 0.25, 0.50 USD by plan | WP-06 (`llm_cost_daily`), 14 days of beta data |
| Email volume | 95,000 a month, $120 (`06` 11.3) versus 213,000, $260 (`workers/12` 9, counts hourly Autopilot mail at 3,500 a day) | **213,000 a month for provider sizing** until WP-35 and WP-44 measure; Postmark, SES above about 100,000 a month [L] | WP-44 |
| Renders | About 750 a day (`workers/05` sizing) | **About 20,750 a day**: one render of the frozen snapshot per submitted application (about 20,000, deduplicated by content hash) plus about 750 workspace renders | WP-19 render soak |
| R2 | Sent snapshots about 20,000 a day x about 100 KB | **About 60 GB a month (about $1 a month)**, kept until account erasure or the retention rule (`snapshots/` prefix, no 30-day lifecycle); previews and exports under `renders/` kept 30 days [L] | WP-14, WP-25 |
| Redis | BullMQ only | **Under 100 MB, one instance (a single point of failure until the deferral list is revisited), `maxmemory-policy noeviction` asserted at boot** | WP-45 |

## 7. Open confirmations carried by this revision

These are defaults the revision implements; none blocks the build. The plan's owner-actions files list the exact steps.

1. Sent-snapshot retention: the snapshot PDF and `resume_snapshot` are kept until account erasure. Counsel review of receipt retention (DPDP, GDPR) is open (`02` 19, the retention and legal open questions).
2. `BETTER_AUTH_URL` is the Vercel production origin; the Google redirect URI is `https://<web origin>/api/auth/callback/google` (WP-02).
3. `KAIROS_EDGE_SECRET` is created in Vercel and Railway (WP-03).
4. The remaining open questions at the end of `01-architecture.md` keep their stated defaults; question 7 is closed.

## 8. Deferral register

Each item gets its own ADR and package when its trigger fires (WP-40). The first two rows are the cost of path (c).

| Item | Trigger that brings it back |
|---|---|
| DBOS versions of the worker, applier, queue catalog, workflow catalog and schedules | A measured load or operations problem that BullMQ hardening cannot fix |
| Redis and BullMQ decommission (P7) | Same as above; deferred, not cancelled |
| Grafana, OpenTelemetry, LLM spans | Sustained multi-replica load, or SLO burn that `metrics_minute` cannot explain |
| Interview rehearsal F9 and `interview-coach` | Owner decision (a PRD non-goal) |
| The `outcome-analyst` weekly email | Owner decision; fix the PRD "Built" status and the pricing-page claim meanwhile |
| The reply-classifier model fallback | `other` above 30% of replies |
| Anthropic usage reconciliation, model drift checks, canary evals | After the paid-beta gate |
| Extra ATS adapters F8; the dormant embeddings stage | F1 pre-rank recall below 0.85 for two weekly evals (`01` A.7) |
| The full runbook catalogue | After the paid-beta gate |
| Multi-currency (billing-64) | Demand data from the paid beta |
| Read replica, HA and a second Postgres | 25,000 users, primary CPU above 60% for 7 days, or read p95 above 300 ms with CPU above 70% for a week (`01` A.7) |
| Plans beyond 50,000 users | Owner decision |

## 9. Amendment log (WP-43, 2026-10-30)

| File | Section | Amendment | Decision |
|---|---|---|---|
| `01-architecture.md` | header, A.1, A.6, A.7, new A.11, B.4.2, B.5, B.5.2, B.5.3, B.5.5, B.5.7, B.5.8, B.5.9, B.6.4 to B.6.6, B.8.7, B.12, B.13, B.14, open question 7 | ADR-001 Revision 3; S-D1 corrections; render at approval | Path (c); PRD authoritative; allowance 429 |
| `02-database.md` | banner, 1, 4.4, 7.1.3 to 7.1.5, 7.1.7, 7.1.8, 7.3.1, 7.3.4, new 7.7, 11, 12.2, 14.3 | PRD table shapes and the numbering lane | PRD authoritative, one numbering lane |
| `05-api.md` | banner, 4.4, 5.1, 5.5, 9.2a, 10.5, 11, 12.3, env table, tests | Web-origin `BETTER_AUTH_URL`; edge-secret client IP; PRD routes; snapshot file | Sign-in; CISO should-fix; PRD authoritative |
| `06-infrastructure.md` | 1.4, 4.2 | Env names and the `BETTER_AUTH_URL` value | Same as `05` |
| `workers/04-prepare-application.md` | Amendments table | No render in prepare; tailored copy; BullMQ | PRD authoritative; path (c) |
| `workers/05-resume-workspace.md` | Amendments table | Many resumes per profile; PRD revisions; render at approval | PRD authoritative |
| `_research/cost-model.md` | banner | Superseded for prices | |
| `../2026-10-29-resume-suite/README.md` | 11, 14 | 402 changed to 429 `daily_allowance`; divergence resolved | 429 daily_allowance |
| `../2026-10-23-resume-workspace/README.md` | note on F11 | 402 wording replaced | 429 daily_allowance |

## 10. Id index

| Id family | Meaning | Defined in |
|---|---|---|
| `INV-n`, `FR-n`, `NFR-n`, `AC-n`, `OQ-n` | Invariants, functional and non-functional requirements, acceptance criteria, open questions of the requirements | `_research/requirements.md` |
| `D-nn`, `S-nn`, `P-nn` | Skeleton defects, scale findings and privacy findings | `_research/as-built.md` |
| `A.n`, `B.n`, `C.n`, `R1` to `R17`, spikes `S-D1`, `S-P1`, `S-A1`, `S-A2`, `S-T1`, `S-F1`, `S-C1`, `S-B1`, `S-AP1` to `S-AP3`, `S-I1`, `S-G1` | ADR sections, architecture sections, risks and spikes | `01-architecture.md` (B.13 for risks and spikes) |
| `SC-n`, `SP-n`, `RL-n`, `OM-n` (rows of A.8) | Judge must-fix items by lens (scale and cost, security and privacy, reliability, operability and migration) and how each is resolved | `01-architecture.md` A.8 |
| `R-n`, `V2-n`, `T-DB-n`, `Q-DB-n` | Merge conflicts, revision 2 changes, database tests, database open questions | `02-database.md` |
| `A-n` (decisions), `AR-n`, `F-n`, `DB-n` | API decisions, architecture changes, findings, database requests | `05-api.md` |
| `X-n`, `S-INF-n`, `R-PG-n`, `R-NET-n`, `R-DR-n`, `R-DBOS-n`, `A-PG-n`, `A-DUR-n` | Infrastructure deltas, spikes, runbooks, alerts | `06-infrastructure.md` |
| `A-PREP-n`, `A-WS-n`, `A-AUTO-n`, `A-SUB-n` | Alerts of the worker specs | `workers/04`, `05`, `06`, `08` |
| `F1` to `F11` | The freehire items (deterministic score, ghost signal, provenance, revisions, events, digests, URL intake, adapters, rehearsal, Typst, allowances) | `_research/huntr-tsenta-teardown.md` section 5; landed in `01` A.10 |
| `D1` to `D10` (PRD), `R1` to `R4` (PRD releases) | Resume-suite decisions and releases | `../2026-10-29-resume-suite/README.md` |
| `<domain>-nn`, `<domain>-vnn` | Verified gap-map items (spec versus code, with path and line evidence) | `docs/superpowers/plans/2026-10-30-backend-completion/gap-map.md` |
| `WP-nn` | Work packages, waves A to I | `docs/superpowers/plans/2026-10-30-backend-completion/work-packages.md` |
