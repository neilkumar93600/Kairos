# R-DEPLOY-1: Roll back a deploy

Trigger: health, Sentry or a user report goes bad within an hour of a deploy, or a post-deploy check fails. Last rehearsed: never (rehearse on staging before launch: deploy a harmless commit, then roll it back).

## Symptoms

The problem starts at a deploy. Sentry's `release` tag on the new issues is the deployed commit SHA, the same one Railway shows on the deployment.

## Impact

Whatever the bad commit broke. Rolling back takes about a minute per service.

## Check

1. Railway > the service > Deployments: the active deployment's commit and time. Compare it with the time the first alert or Sentry event arrived.
2. Did the deploy run a migration (`sd1-api` pre-deploy log: `migrations applied`)? Migrations are additive only (expand, never drop or rename in the same release), so the previous code runs on the new schema. If a migration did something else, go to [R-DEPLOY-2](R-DEPLOY-2.md) instead.
3. Which services took the commit? The api and the worker share an image and deploy together; the applier has its own.

## Fix

1. For each affected service: Deployments, the last good deployment, the three-dot menu, **Rollback** [verify the menu label]. Do the api first, then the worker, then the applier.
2. Revert the bad commit on the deploy branch (`git revert <sha>`, push) so the next push does not ship it again. Rollback does not change the branch.
3. Note the SHAs and times in the incident note.

## Verify

- The rolled-back deployment is `Active`, and its healthcheck passed.
- The uptime checks and the heartbeats are green.
- The Sentry issues tagged with the bad release stop receiving events.

## Escalate

If rolling back does not clear it, the cause is not the deploy: go back to the alert's runbook ([R-HEALTH-1](R-HEALTH-1.md), [R-HEALTH-2](R-HEALTH-2.md)).
