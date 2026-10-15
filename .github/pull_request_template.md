## What changed

<!-- One or two sentences. Link the task in docs/06-implementation-plan.md, e.g. "Task 6". -->

## How it was tested

<!-- Commands you ran and what they printed, or the manual steps for UI and extension changes. -->

## Checklist

- [ ] `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass
- [ ] New behavior has a test, including the failure case
- [ ] Every new query filters by the session user id
- [ ] Migrations only add (no drops or renames in the same release as the code change)
- [ ] No secrets, `.env` files or real user data in the diff
- [ ] Docs updated if a plan, price, route or table changed
