# R-HEALTH-1: API unavailable or a high 5xx rate

Triggers: an uptime check on `https://<api>/health` or `https://<web>/api/health` fails for 3 minutes (A-AVAIL-1), or the Sentry 5xx alert on `kairos-server` fires (A-AVAIL-2). Last rehearsed: never (rehearse on staging before launch).

## Symptoms

- The uptime vendor pages with one or both checks down.
- The checks answer `503 {"status":"degraded"}` or `{"status":"draining"}`, or time out.
- Sentry shows a burst of `unhandled error` events tagged `service:api`.

## Impact

The web app and the extension cannot sign in, read or approve. Stripe and Postmark retry their webhooks, so nothing is lost while they keep retrying (Stripe for up to 3 days).

## Check

1. **Which check failed?**
   - Only `/api/health` (through Vercel): the API is fine; look at the Vercel deployment and the `/api` rewrite (`API_ORIGIN`).
   - Both checks: it is the API. Go on.
2. **Railway, `sd1-api`, Deployments.** Is the latest deployment `Active`, crashed or restarting? Did a deploy happen just before? If so, go to [R-DEPLOY-1](R-DEPLOY-1.md) now.
3. **Logs.** Search for `health check failed`; the line names the failed dependency (`database`, `redis`). The response never names it.
   - `database`: [R-PG-1](R-PG-1.md).
   - `redis`: check the Redis service on Railway (status, memory, restarts).
4. **A 5xx spike without a failed check:** open the top Sentry issue. Its frames name the source line, and its `requestId` tag finds the log lines (`"requestId":"<id>"`). A boot error (`Invalid environment: ...`) means a variable is missing or invalid: fix it in Railway.
5. **CPU or memory pinned** in the Railway metrics: there is too little capacity for the load. Is the traffic legitimate? If not, see the `auth_rate_limited` signal in [incident.md](incident.md).

## Fix

- A bad deploy: [R-DEPLOY-1](R-DEPLOY-1.md).
- A crash loop on boot: fix the named variable and redeploy.
- Load: raise the replicas of `sd1-api` (Settings > Replicas), or resize the instance.
- A dependency down: its runbook.

## Verify

- Both uptime checks are green for 10 minutes.
- No new 5xx events in Sentry for 10 minutes.
- Sign in on the web app and load the dashboard.

## Escalate

Railway status page (status.railway.com) and Railway support if the platform is the cause. Post on the Kairos status page while it lasts. If it is down for over 30 minutes, also email affected paying users.
