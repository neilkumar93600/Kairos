# R-DEPLOY-3: Hotfix

Trigger: a production bug that cannot wait for the next planned change, and that a rollback ([R-DEPLOY-1](R-DEPLOY-1.md)) does not fix (the bug is older than the last deploy). Last rehearsed: never.

## Symptoms

A Sentry issue or a user report about code that has been live for a while.

## Impact

Whatever the bug does. A rushed hotfix adds risk of its own, so keep it to the smallest change.

## Check

1. Find the deployed commit: the Sentry `release` tag, or the deployment on Railway.
2. Reproduce it in a test if at all possible. The fix ships with that test.

## Fix

1. Branch from the deployed commit: `git switch -c hotfix/<slug> <sha>`.
2. Make the smallest change that fixes it, plus the test.
3. From `server/`, run `npx tsc --noEmit`, `npx vitest run` and `npm run lint`. CI also runs the integration tests against Postgres.
4. Open a pull request into the branch Railway deploys from. Merge it once CI is green. Railway deploys it.
5. A schema change follows the expand-only rule. If it cannot, it is not a hotfix.

## Verify

- The deployment is `Active`, and the uptime checks and heartbeats are green.
- The Sentry issue stops receiving events from the new release. Mark it resolved "in the next release" so a recurrence reopens it.
- Watch for 15 minutes before calling it done.

## Escalate

If the fix touches money (`credit_ledger`, Stripe) or sending (approve, the applier), pause the affected path first (the kill switches in [incident.md](incident.md)), and treat the incident as SEV1.
