# R-HEALTH-2: Worker or applier heartbeat missing

Trigger: the uptime vendor has had no ping on the `worker` or `applier` heartbeat for 5 minutes (A-AVAIL-3). Last rehearsed: never (rehearse on staging: stop the worker and time the page; acceptance asks for 5 minutes or less).

## Symptoms

The heartbeat monitor pages. Each process GETs its `HEARTBEAT_URL` once a minute, but only while its own checks pass: Postgres answers, its Redis connection is `ready`, and its BullMQ consumers are running. A missing ping means one of these:
- the process is down;
- a dependency is down;
- the vendor cannot be reached from Railway.

## Impact

- Worker: no polling, scoring, tailoring, resume parsing, reply tagging, cost roll-up or ledger watch. Approvals still work; drafts and matches stop appearing.
- Applier: approved cloud applications wait in the `cloud-apply` queue. Nothing is lost; they run when it is back.

## Check

1. **Railway, the service, Deployments.** Is it `Active`, crashed, or restarting in a loop?
2. **Logs:**
   - `health check failed` with `failed: [...]`: the dependency is named. Postgres goes to [R-PG-1](R-PG-1.md); Redis means checking the Redis service.
   - `heartbeat ping failed`: the process is healthy but cannot reach the vendor. Check the vendor's status. This is not an outage of ours.
   - `Invalid environment`: a variable is missing. On the applier, a forbidden secret was set (owner-actions/WP-04.md, step 1).
   - `chromium failed to launch` (applier): see S-AP4 in owner-actions/WP-04.md.
3. **The internal check** from another Railway service's shell: `curl http://<service>.railway.internal:<PORT>/health` returns 200 `ok`, 503 `degraded` or 503 `draining`.

## Fix

- Crashed or looping: fix the cause the log names, then redeploy. A bad deploy: [R-DEPLOY-1](R-DEPLOY-1.md).
- Stuck but `Active`: restart the deployment. A stalled job is retried by BullMQ once its lock expires (120 s for the applier).
- Redis down or out of memory: restart Redis and check that its eviction policy is `noeviction` (BullMQ needs it).

## Verify

- The heartbeat monitor shows pings again for 5 minutes.
- Worker: the log shows `polled board` lines again.
- Applier: the `cloud-apply` waiting count falls, or `cloud apply result` lines appear.

## Escalate

Railway status and support. If cloud sends were waiting for over 30 minutes, nothing has to be told to users. If they were waiting for over 24 hours, email the users whose applications waited.
