# Spike S-D1, local half: DBOS Transact 5.3.0 (2026-10-23)

Scope: the parts of S-D1 (ADR-001 B.13) that run without Railway. Harness: one Node process per run, so crashes are real process deaths (`process.exit(137)` inside a step), against Postgres 17 (pgvector image) on the local test container. Packages: `@dbos-inc/dbos-sdk@5.3.0` (npm `latest`), `@dbos-inc/drizzle-datasource@5.3.0`, `drizzle-orm@0.45`, `pg@8`. Business database `sd1_app`, system database `sd1_dbos`. Test workflow: transaction `txOne`, plain step `step2`, transaction `txThree`; every effect increments a counter row, so a duplicate execution is visible.

## Results

| # | Check | Result |
|---|---|---|
| 1 | Crash inside a step, relaunch with the same `executorID` | Recovered automatically at launch, status `SUCCESS`. `txOne` 1 run, `step2` 2 runs, `txThree` 1 run |
| 2 | Crash on executor `exec-b`, recover from a different executor | `listWorkflows({status:"PENDING"})` finds it with `executorId: "exec-b"`; `cancelWorkflow` then `resumeWorkflow` completes it (`SUCCESS`); transactions not repeated. The B.5.5 orphan procedure works as written |
| 3 | Same workflow id started twice at once | One execution; both handles return the result |
| 4 | `listenQueues: []` (api role) enqueues | Stays `ENQUEUED`; a process listening on the queue runs it. B.5.2 routing works |
| 5 | `forkWorkflow(id, 0, { applicationVersion: "v2" })` | New workflow id, version `v2`, replays from step 0, and business effects re-run (counter 2). Rule D1 (state-conditional workflows) is required for the B.5.5 version migration |
| 6 | `deleteWorkflows([id])` (retention) | Removes `workflow_status`, `operation_outputs` and `workflow_input` rows |
| 7 | Chaos: 20 workflows killed inside a step on 20 executors, one survivor recovers all | 20 of 20 `SUCCESS`; every transaction exactly once (0 duplicates); every plain step re-ran once |
| 8 | Checkpoint writes per workflow (row inserts, updates and deletes, both databases) | 2 transactions + 1 step: 11 direct, 12 queued |

Exactly-once transactions, read from the 5.3.0 source: the datasource writes `transaction_completion` inside the business transaction on the same client (`#recordOutput`), and deletes those rows when the workflow finishes (`deleteCompletedDataSourceCheckpoints`), because the system database's step checkpoint then covers them. The crash window between the business commit and the checkpoint is closed, and the app-side table stays near empty.

## Corrections the ADR needs (5.3.0 API as installed)

| ADR text | Reality in 5.3.0 | Change |
|---|---|---|
| B.5.3 `partitionQueue: true` | No such option. Any `partition*` limit (`partitionConcurrency`, `partitionWorkerConcurrency`, `partitionRateLimit`) partitions the queue, and every enqueue must then pass a partition key | Drop `partitionQueue`; keep the `partitionConcurrency` values |
| B.5.3 `concurrency` | Deprecated alias | Use `globalConcurrency` |
| Queue declaration (implied `new WorkflowQueue`) | `WorkflowQueue` is type-only; queues are database-backed: `await DBOS.registerQueue(name, options)` after `DBOS.launch()`, default `onConflict: update_if_latest_version` (safe for rolling deploys) | `durable/queues.ts` registers queues after launch; queue settings can change at runtime |
| B.5.5 retention "SDK garbage-collection function if S-D1 confirms it" | No garbage-collection call; `DBOS.deleteWorkflows(ids, deleteChildren?)` exists and works | Retention schedule: `listWorkflows` with `completedBefore` and a status filter, then `deleteWorkflows` in batches |
| B.5.5 step 4 "a supported recovery call for other executors" | `recoverPendingWorkflows(executorIDs)` exists only on the internal executor, not on `DBOS` | Keep cancel-and-resume (proven above) |
| Imports | The packages are CommonJS; named ESM imports fail at runtime under tsx (`does not provide an export named ...`) | `import dbosSdk from "@dbos-inc/dbos-sdk"; const { DBOS } = dbosSdk;` (or bundle with esbuild, which `server/build.mjs` already does) |
| B.5.7 "about three status rows per workflow" | About 6 fixed writes per workflow (status insert and updates, input row, output row), plus 1 per step and 2 per datasource transaction (completion insert, then delete) | Re-estimate: about 1.1 M writes a day instead of 751,000 (+48%), about 55 per submitted application instead of 37. Still about 13 writes per second on average, far below capacity. Set the unit-metric target to 60 and the alert to 80 |
| Dependencies | DBOS logs `pg` DeprecationWarning "client.query() when the client is already executing a query ... removed in pg@9.0" | Pin `pg@8` until DBOS supports 9 |

## Still open (needs Railway, owner approval for paid infrastructure)

- Executor ids from `RAILWAY_SERVICE_NAME` and `RAILWAY_REPLICA_ID` (env names), recovery after a rolling deploy with pending workflows.
- The datasource through PgBouncer in transaction mode (the system database stays direct, as B.5.2 says), and connection counts per process.
- The 50 forced crashes across api, worker and applier during scripted approvals and preparations (this local run did 20 on one workflow shape).
- Timing: every workflow terminal within 10 minutes under the chaos load.

## Verdict for the local half

Pass. Recovery, orphan recovery by another executor, deterministic ids, queue routing, version forks, deletion and exactly-once transactions all behave as B.5 assumes, with the API corrections above. The pg-boss fallback (B.5.9) is not needed on this evidence. The Railway half decides the hard gate.
