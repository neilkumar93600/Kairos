# Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-task `/onboarding` checklist with a goal-first wizard (goals, target, resume by upload/form/paste, rules, done) in its own full-screen layout, backed by new profile fields and endpoints.

**Architecture:** Shared zod contracts first, then one migration and three small server surfaces (`PUT /api/profile/onboarding`, `/api/profile/employments`, `PUT /api/profile/application-details`). The web wizard is a client component driven by one pure module (`web/lib/onboarding/flow.ts`) that decides which steps a user sees, where they open, and where they end; each step is its own component.

**Tech Stack:** Next.js 16 App Router (React 19), TanStack Query, Express 5, Drizzle + Postgres, zod 4, vitest, `@phosphor-icons/react`, Playwright (QA harness).

**Spec:** `docs/superpowers/specs/2026-11-10-onboarding-wizard-design.md`. Read it with this plan. Approved prototype: `.superpowers/brainstorm/12644-1794289461/content/onboarding-prototype.html`.

## Global Constraints

- Work in `C:\Users\Lenovo\Downloads\Kairos` (the owner runs `npm run dev:web` here). The tree holds unrelated uncommitted UI edits. Stage only the paths each task names, and never `git add -A`.
- No local Postgres: `*.int.test.ts` run only in CI. Locally, run unit tests, `npm run typecheck`, `npm run lint` and `npm run db:lint`.
- Truth lock: uploaded or pasted facts start unconfirmed; facts typed in the form start confirmed; every fact or employment write runs inside `asActor(tx, "user")`.
- `onboarding_step` stays forward-only (the `profiles_guard` trigger, D-30). Its value means "furthest step reached".
- Goals: `find | build | interview | look`. `look` is exclusive. Target roles: 1 to 5, each 2 to 80 characters. Target companies: 0 to 10, each 1 to 120 characters.
- Step order and values: `goals, target, resume, confirm-facts, rules, template, done`.
- Copy: sentence case, no em or en dashes, no "elevate/seamless/unleash". Icons from `@phosphor-icons/react`, no emoji.
- Visuals: tokens and fonts from `DESIGN.md` and `docs/DESIGN.md` (Urbanist; Instrument Serif only for the brief title). Motion uses transform and opacity only; under `prefers-reduced-motion` all of it is off. Targets are at least 44 px. No horizontal scroll at 360 px.
- No new runtime dependency.
- Application details are encrypted with `encrypt(json, { table: "profiles", id: userId, column: "sensitive_answers_enc" })` from `server/src/lib/crypto.ts`. They are never logged and never sent to a model.

## Review Focus

1. **Continue pressed twice on the resume step** must make one base resume, not two. Pinned in Task 9 (button disabled while pending; resume id kept in wizard state).
2. **Back to the resume step after a base resume exists, then Continue** must reuse that resume. Pinned in Task 6 (`nextAction` returns `reuse`).
3. **Reload during an upload** must resume polling the same import. Pinned in Task 9 (import id kept in `sessionStorage` under `kairos.onboarding.importId`).
4. **Chip input with case duplicates or past the cap** ("frontend developer" after "Frontend Developer", a 6th role) must be ignored. Pinned in Task 6 (`addChip`).
5. **An existing user on the old `confirm-facts` step with no goals** must open at the fact check as a Find user. Pinned in Task 6 (`openAt`).

---

### Task 1: Shared onboarding contracts

**Files:**
- Create: `shared/src/onboarding.ts`
- Modify: `shared/src/index.ts` (add `export * from "./onboarding";`)
- Test: `shared/test/onboarding.test.ts`

**Interfaces:**
- Produces:
  - `GOALS = ["find","build","interview","look"] as const`, `type Goal`
  - `ONBOARDING_STEPS = ["goals","target","resume","confirm-facts","rules","template","done"] as const`, `type OnboardingStep`
  - `onboardingUpdateSchema`: `{ goals?: Goal[] (1..4, unique, "look" alone or absent); targetRoles?: string[] (0..5, trimmed 2..80); targetCompanies?: string[] (0..10, trimmed 1..120); step?: OnboardingStep }`, at least one key
  - `employmentInputSchema`: `{ title 1..200, company 1..200, location ≤120 | null, startMonth "YYYY-MM" | null, endMonth "YYYY-MM" | null, isCurrent boolean, results: string[] (0..20, each 3..400) }`. Refinement: `!(isCurrent && endMonth)` and `startMonth <= endMonth`.
  - `applicationDetailsSchema`: `{ noticePeriod: "immediate"|"2_weeks"|"1_month"|"2_months_plus" | null, openToRelocation: boolean | null, expectedSalary: { amount: int 0..10_000_000, currency: 3-letter uppercase } | null }`
  - `type OnboardingState = { goals: Goal[]; targetRoles: string[]; targetCompanies: string[]; onboardingStep: OnboardingStep }`

- [ ] **Step 1: Write the failing tests** in `shared/test/onboarding.test.ts`:
  - `rejects look combined with another goal`: `onboardingUpdateSchema.safeParse({ goals: ["look","find"] }).success === false`
  - `accepts find and build`: success, and `data.goals` equals `["find","build"]`
  - `caps target roles at 5 and trims`: 6 roles fail; `["  Frontend Developer "]` parses to `["Frontend Developer"]`
  - `rejects an empty update`: `safeParse({}).success === false`
  - `rejects current job with an end month`: `employmentInputSchema.safeParse({ ..., isCurrent: true, endMonth: "2024-05" }).success === false`
  - `rejects start after end`: start `"2025-01"`, end `"2024-12"` fails
  - `application details accept nulls`: all three null succeeds; `currency: "inr"` fails
- [ ] **Step 2: Run** `npm test -w @auto-career/shared -- onboarding`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `shared/src/onboarding.ts` with the exports above (zod 4, matching the style of `schemas-suite.ts`), and add the barrel export.
- [ ] **Step 4: Run** `npm test -w @auto-career/shared -- onboarding && npm run typecheck -w @auto-career/shared`. Expected: PASS.
- [ ] **Step 5: Commit** `shared/src/onboarding.ts shared/src/index.ts shared/test/onboarding.test.ts`. Message: `feat(shared): onboarding wizard contracts`.

### Task 2: Migration and Drizzle schema

**Files:**
- Create: `server/drizzle/0019_onboarding_wizard.sql` (plus the journal entry under `server/drizzle/meta/`, as `npm run db:generate` produces it; hand-edit the SQL after generation as the other migrations do)
- Modify: `server/src/db/schema/profile.ts` (profiles table)
- Test: `server/test/onboarding.int.test.ts` (CI only)

**Interfaces:**
- Consumes: `GOALS`, `ONBOARDING_STEPS` (Task 1).
- Produces: `profiles.goals text[] not null default '{}'`, `profiles.targetRoles` (`target_roles text[]`, default `'{}'`), `profiles.targetCompanies` (`target_companies text[]`, default `'{}'`). `onboarding_step` defaults to `'goals'`.

- [ ] **Step 1: Write the failing integration tests** in `server/test/onboarding.int.test.ts`, following `parse-resume.int.test.ts` for setup:
  - `new profiles start at goals`: insert a user and profile with defaults. `onboarding_step === "goals"` and `goals` equals `[]`.
  - `step only moves forward under the new ranks`: set `rules`, then `target`; the value stays `rules`.
  - `old rows keep their meaning`: a row at `resume` can move to `confirm-facts`; `confirm-facts` cannot move back to `resume`.
  - `goals check rejects unknown values`: updating `goals` to `{"post"}` fails with constraint `profiles_goals_ck`.
  - `look is exclusive`: `{"look","find"}` fails with `profiles_goals_ck`.
- [ ] **Step 2: Write the migration** with these statements:
  - `ALTER TABLE profiles ADD COLUMN goals text[] NOT NULL DEFAULT '{}'`, and the same for `target_roles` and `target_companies`.
  - `profiles_goals_ck`: `goals <@ ARRAY['find','build','interview','look']::text[] AND cardinality(goals) <= 4 AND (NOT 'look' = ANY(goals) OR cardinality(goals) = 1)`.
  - `profiles_targets_ck`: `cardinality(target_roles) <= 5 AND cardinality(target_companies) <= 10`.
  - `CREATE OR REPLACE FUNCTION onboarding_rank(s text)` with ranks `goals 0, target 1, resume 2, confirm-facts 3, rules 4, template 5, done 6`.
  - Drop and re-add `profiles_onboarding_step_ck` with all seven values.
  - `ALTER COLUMN onboarding_step SET DEFAULT 'goals'`.
  - Update the comment above `profiles_guard` to list the new ranks.
- [ ] **Step 3: Mirror the columns and the checks** in `server/src/db/schema/profile.ts`: the `check()` entries, and the widened `profiles_onboarding_step_ck`.
- [ ] **Step 4: Run** `npm run db:lint -w @auto-career/server && npm run db:check -w @auto-career/server && npm run typecheck -w @auto-career/server`. Expected: no errors. (The integration tests run in CI.)
- [ ] **Step 5: Commit** the migration, its meta journal entry, `profile.ts` and the new test. Message: `feat(server): profile goals, targets and wider onboarding steps`.

### Task 3: Onboarding route, profile and me fields, preferences change

**Files:**
- Modify: `server/src/routes/profile.ts` (new `PUT /onboarding`; `PUT /preferences` stops writing `onboardingStep`)
- Modify: `server/src/lib/serializers.ts` (`PROFILE_COLUMNS` gains `goals`, `targetRoles`, `targetCompanies`)
- Modify: `server/src/routes/me.ts` (response gains `goals`, `targetRoles`, `targetCompanies`)
- Modify: `server/test/helpers/authz-matrix.ts` (add `"PUT /api/profile/onboarding"` with the `own(...)` pattern next to the contact entry)
- Test: `server/test/onboarding.int.test.ts` (extend)

**Interfaces:**
- Consumes: `onboardingUpdateSchema` (Task 1); the columns from Task 2.
- Produces: `PUT /api/profile/onboarding` → `200 { profile }`, where `profile` includes `goals, targetRoles, targetCompanies, onboardingStep`. `GET /api/me` adds `goals: Goal[]`, `targetRoles: string[]` and `targetCompanies: string[]`.

- [ ] **Step 1: Extend the integration tests:**
  - `PUT /api/profile/onboarding saves goals and targets`: the response `profile.goals` equals `["find","build"]` and `targetRoles` equals `["Frontend Developer"]`.
  - `a backward step is ignored, not an error`: `{ step: "target" }` after `rules` returns 200 with `onboardingStep: "rules"`.
  - `invalid body is 422`: `{ goals: ["look","find"] }` returns 422 `invalid_body`.
  - `saving preferences no longer finishes onboarding`: a profile at `rules` stays at `rules` after `PUT /api/profile/preferences`.
  - `GET /api/me exposes goals and targets`.
- [ ] **Step 2: Run** `npm test -w @auto-career/server -- authz-matrix`. Expected: FAIL ("mounted without an entry" once the route exists; add the route stub first if needed so the failure is the matrix).
- [ ] **Step 3: Implement** the route: `validateBody(onboardingUpdateSchema)`, a single `update(profiles).set({...body mapped to columns, updatedAt})` returning `PROFILE_COLUMNS`. Remove `onboardingStep: "done"` from the preferences route. Add the fields to `me.ts` and `PROFILE_COLUMNS`. Add the matrix entry.
- [ ] **Step 4: Run** `npm test -w @auto-career/server -- authz-matrix frozen && npm run typecheck -w @auto-career/server`. Expected: PASS.
- [ ] **Step 5: Commit**. Message: `feat(server): PUT /api/profile/onboarding and goal fields on me`.

### Task 4: Employments typed by the user

**Files:**
- Create: `server/src/routes/employments.ts` (router mounted at `/api/profile/employments` inside `server/src/routes/index.ts`, next to `/profile`, same `authed` middleware)
- Modify: `server/test/helpers/authz-matrix.ts` (4 entries)
- Test: `server/test/employments.int.test.ts`

**Interfaces:**
- Consumes: `employmentInputSchema` (Task 1); `profileFor(tx, userId, plan)` from `server/src/services/import/imports.ts`; `planFor` from `server/src/services/submissions.ts`; `asActor` from `server/src/lib/actor.ts`.
- Produces:
  - `GET /api/profile/employments` → `{ employments: Array<{ id, title, company, location, startMonth, endMonth, isCurrent, roleFactId: string | null, results: Array<{ factId, text }> }> }`. Only rows with `asserted_by = 'user'` are returned, newest first.
  - `POST /api/profile/employments` (body `employmentInputSchema`) → `201 { employment }` (same shape).
  - `PATCH /api/profile/employments/:id` (partial body) → `200 { employment }`. The role fact and the result facts are replaced, never edited in place. Facts already cited by a sent application are kept and unlinked (the existing `DELETE /facts/:id` cited check shows the pattern).
  - `DELETE /api/profile/employments/:id` → `204`.
- Rules: everything runs in one transaction under `asActor(tx, "user")`. Writes use `assertedBy: "user"` and `confirmed: true`, and `resumeProfileId = await profileFor(tx, me.id, plan)`, the default profile, because `documentFromFacts` reads employments by profile. `datesText` is `"Mon YYYY to Mon YYYY"`, or `"Mon YYYY to now"` when current. The role fact's text is `"{title} at {company}, {datesText}"`, and the role fact is created as kind `role`. Each results line becomes a `metric` fact with `employmentId` set.

- [ ] **Step 1: Write the failing integration tests:**
  - `POST creates a confirmed employment with its facts`: the response `results.length === 2`; in the database the employment has `confirmed = true` and `asserted_by = 'user'`, and both facts are confirmed and linked.
  - `the default resume lists bullets under the job`: after POST, `POST /api/resumes { from: "facts", name: "Main" }`; the document's experience entry has `heading === title` and 2 lines.
  - `PATCH replaces results`: from 2 lines to 1 line; `GET` shows 1 result.
  - `another user's id is 404` for PATCH and DELETE.
  - `isCurrent with endMonth is 422`.
- [ ] **Step 2: Run** `npm test -w @auto-career/server -- authz-matrix`. Expected: FAIL until the matrix entries exist.
- [ ] **Step 3: Implement** the router and mount it. Add the matrix entries.
- [ ] **Step 4: Run** `npm test -w @auto-career/server -- authz-matrix && npm run typecheck -w @auto-career/server && npm run lint -w @auto-career/server`. Expected: PASS.
- [ ] **Step 5: Commit**. Message: `feat(server): employments typed by the user, with linked facts`.

### Task 5: Application details

**Files:**
- Modify: `server/src/routes/profile.ts` (`GET` and `PUT /application-details`)
- Create: `server/src/services/application-details.ts`
- Modify: `server/test/helpers/authz-matrix.ts` (2 entries)
- Test: `server/test/application-details.test.ts` (unit: the merge function), extend `server/test/onboarding.int.test.ts` (route)

**Interfaces:**
- Consumes: `applicationDetailsSchema` (Task 1); `encrypt`, `decrypt` (`server/src/lib/crypto.ts`).
- Produces:
  - `export function mergeDetails(stored: Record<string, unknown> | null, patch: ApplicationDetails): Record<string, unknown>` in `server/src/services/application-details.ts`. It replaces only the three keys and keeps any other key already stored.
  - `PUT /api/profile/application-details` → `200 { details }`. `GET` → `{ details }`, with `null` fields when nothing is stored.

- [ ] **Step 1: Write the failing unit tests** in `server/test/application-details.test.ts`:
  - `keeps unrelated stored keys`: `mergeDetails({ eeo: "x", noticePeriod: "immediate" }, { noticePeriod: "1_month", openToRelocation: null, expectedSalary: null })` returns `{ eeo: "x", noticePeriod: "1_month", openToRelocation: null, expectedSalary: null }`.
  - `starts from nothing`: `mergeDetails(null, …)` returns exactly the three keys.
  - Integration test: `round trip`. PUT, then GET, returns the same values. The raw column is not valid JSON text (it is encrypted).
- [ ] **Step 2: Run** `npm test -w @auto-career/server -- application-details`. Expected: FAIL.
- [ ] **Step 3: Implement** `mergeDetails` and both routes. Read: decrypt and `JSON.parse`. Write: merge, `JSON.stringify`, encrypt, update. Add the matrix entries.
- [ ] **Step 4: Run** `npm test -w @auto-career/server -- application-details authz-matrix && npm run typecheck -w @auto-career/server`. Expected: PASS.
- [ ] **Step 5: Commit**. Message: `feat(server): encrypted application details`.

### Task 6: Wizard flow logic (pure)

**Files:**
- Create: `web/lib/onboarding/flow.ts`
- Test: `web/test/onboarding-flow.test.ts`

**Interfaces:**
- Consumes: `Goal`, `OnboardingStep` (Task 1).
- Produces:
  - `type Source = "upload" | "form" | "paste" | "existing" | null`
  - `type WizardStep = "goals" | "target" | "source" | "upload" | "form" | "paste" | "rules" | "done"`. The template step belongs to project 2; leave a `// project 2: "template" slots in before "done"` marker in `stepsFor`.
  - `stepsFor(goals: Goal[], source: Source): WizardStep[]`
  - `countedSteps(steps: WizardStep[]): WizardStep[]` (drops `upload`, `form`, `paste`, `done`)
  - `openAt(data: { goals: Goal[]; targetRoles: string[]; onboardingStep: string; hasConfirmedFacts: boolean; hasBaseResume: boolean; hasPreferences: boolean }): { goals: Goal[]; step: WizardStep }`
  - `endFor(goals: Goal[]): { href: "/resume" | "/matches" | "/dashboard"; others: Goal[] }`
  - `addChip(list: string[], raw: string, max: number, minLen: number, maxLen: number): string[]`
  - `nextAction(state: { baseResumeId: string | null }): "create" | "reuse"`
  - `serverStepFor(step: WizardStep): OnboardingStep`. Maps `goals→goals`, `target→target`, `source|upload|form|paste→resume`, `rules→rules`, `done→done`. Used when saving the "furthest reached" value.

- [ ] **Step 1: Write the failing tests:**
  - `look alone goes straight to done`: `stepsFor(["look"], null)` equals `["goals","done"]`
  - `find with upload`: `stepsFor(["find"],"upload")` equals `["goals","target","source","upload","rules","done"]`
  - `build has no rules`: `stepsFor(["build"],"form")` equals `["goals","target","source","form","done"]`
  - `interview only`: `stepsFor(["interview"],null)` equals `["goals","target","source","done"]`
  - `counted steps for find`: `countedSteps(stepsFor(["find"],"upload"))` equals `["goals","target","source","rules"]`
  - `old confirm-facts user opens at the fact check as Find`: `openAt({ goals: [], targetRoles: [], onboardingStep: "confirm-facts", hasConfirmedFacts: false, hasBaseResume: false, hasPreferences: false })` equals `{ goals: ["find"], step: "upload" }`
  - `opens at the first missing step`: goals `["build"]`, roles `["X"]`, no base resume gives `step: "source"`
  - `done users open at goals with answers kept`: `onboardingStep: "done"` gives `step: "goals"`, with `goals` unchanged
  - `ends: build beats find beats interview`: `endFor(["find","build"])` equals `{ href: "/resume", others: ["find"] }`; `endFor(["interview","find"]).href === "/matches"`; `endFor(["look"]).href === "/dashboard"`
  - `addChip ignores case duplicates and the cap`: `addChip(["Frontend Developer"], " frontend developer ", 5, 2, 80)` returns the same list; at 5 items it returns the same list; `"A"` (shorter than 2) is ignored; the result is trimmed
  - `reuse an existing base resume`: `nextAction({ baseResumeId: "r1" }) === "reuse"`
- [ ] **Step 2: Run** `npm test -w @auto-career/web -- onboarding-flow`. Expected: FAIL.
- [ ] **Step 3: Implement** `flow.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**. Message: `feat(web): onboarding flow logic`.

### Task 7: Web data layer and QA mock

**Files:**
- Create: `web/hooks/use-onboarding.ts`
- Modify: `web/hooks/use-me.ts` (`Me` gains `goals`, `targetRoles`, `targetCompanies`), `web/hooks/use-profile.ts` (`Profile` the same)
- Modify: `web/scripts/qa/mock-api.mjs` (the three new route groups, held in `data`; the `empty` scenario `me` gains `goals: []`, `targetRoles: []`, `targetCompanies: []`, `onboardingStep: "goals"`)
- Test: `npx tsx web/scripts/qa/check-schemas.mjs` (extend it to parse the mock `employments` and `onboarding` responses with the Task 1 schemas)

**Interfaces:**
- Consumes: the Task 3 to 5 endpoints; the existing `/profile/imports` and `/resumes` routes, which `mock-suite.mjs` already serves.
- Produces, from `useOnboarding()`. Every mutation invalidates `["me"]`, `["profile"]` and `["facts"]`; employment mutations also invalidate `["employments"]`.
  - `save: Mutation<OnboardingUpdate>` (`PUT /profile/onboarding`)
  - `employments: Query<Employment[]>`, plus mutations `addEmployment`, `updateEmployment({ id, ...patch })` and `removeEmployment(id)`
  - `saveDetails: Mutation<ApplicationDetails>`
  - `startImport: Mutation<{ file?: File; text?: string; name: string }, { importId: string }>` (multipart for a file, JSON for text)
  - `pollImport(importId): Query`, with `refetchInterval: 1500` while the status is not `parsed` or `failed`
  - `createBase: Mutation<{ name: string; targetRoles: string[]; importId?: string }, { id: string }>` (`POST /resumes`, then `POST /resumes/:id/default`)

- [ ] **Step 1: Extend `check-schemas.mjs`** so the new mock routes parse against the Task 1 schemas. Run `npx tsx web/scripts/qa/check-schemas.mjs`. Expected: FAIL (routes missing).
- [ ] **Step 2: Add the mock routes and the hook.**
- [ ] **Step 3: Run** `npx tsx web/scripts/qa/check-schemas.mjs && npm run typecheck -w @auto-career/web`. Expected: PASS.
- [ ] **Step 4: Commit**. Message: `feat(web): onboarding data hooks and QA mock routes`.

### Task 8: Wizard shell, layout and the first two steps

**Files:**
- Create: `web/app/(onboarding)/layout.tsx`, `web/app/(onboarding)/onboarding/page.tsx`
- Delete: `web/app/(dashboard)/onboarding/page.tsx`
- Create: `web/components/onboarding/wizard.tsx` (state, step switch, footer), `web/components/onboarding/art-pane.tsx` (three scenes and the brief card), `web/components/onboarding/progress.tsx`, `web/components/onboarding/chips-input.tsx`, `web/components/onboarding/steps/goals.tsx`, `web/components/onboarding/steps/target.tsx`, `web/components/onboarding/onboarding.css`

**Interfaces:**
- Consumes: `stepsFor`, `countedSteps`, `openAt`, `addChip`, `serverStepFor` (Task 6); `useOnboarding().save` (Task 7); `useMe`.
- Produces: the `Wizard` context `{ state, setGoals, setTargets, setSource, setBaseResumeId, next(), back(), skipStep(), skipSetup() }` that the step components use. Every step component has the props `{ onReady(ready: boolean): void }`.

Layout and look follow spec section 8 and the approved prototype. Specifics:
- The art uses `next/image` with `/landing/art/scene-a-dawn-valley.png`, `scene-b-footbridge.png` and `scene-c-noon-meadow.png`, `alt=""`, `sizes="(min-width: 900px) 42vw, 100vw"`. Only the first has `priority`.
- The scene index is `Math.min(2, Math.round(index / (steps.length - 1) * 2))`. The cross-fade is 900 ms.
- The brief card title "Your brief" is in Instrument Serif, with rows that settle in.
- Step enter: 550 ms. It comes from the right going forward and from the left on Back.
- On a step change, focus moves to the step's `h1` (`tabIndex={-1}`).
- The progress label reads "Step {n} of {total}" plus the step name.
- Footer: Back (ghost, hidden on the first step), "Skip this step" (on `target` and `rules`), and Continue (espresso pill, disabled until `onReady(true)`).
- "Skip setup" sets `goals: ["look"]` and step `done`, then goes to `/dashboard`.
- On Continue, the shell calls `save.mutateAsync` with the step's answers and `step: serverStepFor(next)`.
- Copy for both steps is exactly the prototype's (spec 5.1 and 5.2). The position suggestions are a static list of 12 common titles, filtered by the typed prefix, at most 3 shown.

- [ ] **Step 1: Run the screenshot harness first.** `npx next dev -p 4410` in `web/`, in the background, then `node web/scripts/qa/shots.mjs --routes /onboarding --scenario empty`. Expected: the route renders the old checklist. Note the shot path.
- [ ] **Step 2: Implement** the layout, shell, art pane, progress, chips input and the two steps.
- [ ] **Step 3: Verify** with `npm run typecheck -w @auto-career/web && npm run lint -w @auto-career/web`, then the same shots command at desktop and mobile. Expected:
  - no console errors or `unmocked` routes
  - `overflow:false` at 390 px
  - the shots show the goals step beside the dawn painting
- [ ] **Step 4: Commit** the files above. Message: `feat(web): onboarding wizard shell, goals and target steps`.

### Task 9: Resume source, upload and paste

**Files:**
- Create: `web/components/onboarding/steps/source.tsx`, `web/components/onboarding/steps/upload.tsx`, `web/components/onboarding/steps/paste.tsx`
- Test: `web/test/onboarding-upload.test.ts` (the pure helper below)

**Interfaces:**
- Consumes: `startImport`, `pollImport`, `createBase` (Task 7); `nextAction` (Task 6); the existing `FactList` (`web/components/dashboard/profile/fact-list.tsx`); `setBaseResumeId` and `setSource` (Task 8).
- Produces: `export function phaseLabel(progress: string | null, polls: number): string` in `upload.tsx`. It returns the server's `progress` label (`GET /profile/imports/:id` sends "Reading your resume" while pending and "Finding your roles" while parsing). It falls back to "Reading your resume" when the label is null. After 40 polls it returns "This is taking longer than usual. You can leave and come back." Pasted text goes through `POST /profile/imports` as JSON `{ text, name }`; the route accepts it next to multipart.

Behaviour:
- **Source step:** two choice buttons and a "Paste the text instead" link. A user with confirmed facts also gets the "Use what you already added" choice (source `existing`).
- **Upload step:**
  - Accepts `.pdf,.docx` up to 5 MB. The size check happens before upload, with the message "This file is over 5 MB. Upload a smaller one or paste the text."
  - Stores the import id in `sessionStorage["kairos.onboarding.importId"]` and resumes polling it on load.
  - Server error messages are shown as they come, with a "Paste the text instead" action.
  - When parsed, it shows `FactList`.
- **Continue on upload or paste:** if `nextAction` returns `create`, it calls `createBase({ name: fileName or "Main resume", targetRoles, importId })`, then `setBaseResumeId`. The button is disabled while pending.
- **Paste:** uses `startImport({ text, name })`, then the same fact check.

- [ ] **Step 1: Write the failing tests:** `phaseLabel("Finding your roles", 3) === "Finding your roles"`, `phaseLabel(null, 0) === "Reading your resume"`, and `phaseLabel("Finding your roles", 41)` starts with "This is taking longer".
- [ ] **Step 2: Run** `npm test -w @auto-career/web -- onboarding-upload`. Expected: FAIL.
- [ ] **Step 3: Implement** the three steps.
- [ ] **Step 4: Verify** with the unit tests, typecheck, and the shots harness, adding a Playwright pass that does the following:
  - picks Find, adds a role and continues
  - chooses Upload and sets a small PDF fixture through the file input
  - waits for the fact list, double-clicks Continue, and asserts the mock received exactly one `POST /resumes`
  - reloads mid-parse and asserts polling resumes on the same import id

  Put this pass in `web/scripts/qa/onboarding.mjs`, next to `shots.mjs`, reusing `fixtures` and `handleApi`. Expected: all assertions hold, with no console errors.
- [ ] **Step 5: Commit**. Message: `feat(web): onboarding resume upload and paste`.

### Task 10: Fill-in form

**Files:**
- Create: `web/components/onboarding/steps/form.tsx`, plus `web/components/onboarding/form/` with one component per section: `contact.tsx`, `links.tsx`, `work-auth.tsx`, `experience.tsx`, `education.tsx`, `skills.tsx`, `projects.tsx`, `certifications.tsx`, `languages.tsx`, `details.tsx`
- Test: `web/test/onboarding-form.test.ts`

**Interfaces:**
- Consumes: `PUT /profile/contact` (existing `useProfileActions` pattern), `addFact` (existing), `addEmployment`, `updateEmployment` and `removeEmployment`, `saveDetails`, `createBase` (Task 7).
- Produces:
  - `export function educationFact(e: { school: string; degree: string; field?: string; start?: string; end?: string; grade?: string }): string`, for example `"B.Tech Computer Science, Sample University, 2018 to 2022"`, plus `", grade 8.4"` when a grade is given
  - `export function skillFacts(skills: string[]): string[]` (groups of up to 10 joined with ", ")
  - `export function languagesFact(langs: string[]): string | null` (`"Languages: English, Hindi"`, or `null` when the list is empty)
  - `export function draftKey(section: string): string` → `"kairos.onboarding.form." + section`

Behaviour:
- Sections and field mapping exactly as in the spec table in 5.3b.
- Each section saves when the user leaves it, through the rail, Next section or Continue. An unsaved section is kept in `sessionStorage` under `draftKey` and cleared on save.
- Work authorization is kept in wizard state for the rules step.
- Required before Continue: full name, and at least one experience or education entry. Then `createBase`, guarded by `nextAction`.
- The section rail is desktop only (≥900 px); phones get a section select.

- [ ] **Step 1: Write the failing tests** for `educationFact`, `skillFacts` (23 skills give 3 facts, the last holding 3), `languagesFact([])` (returns `null`) and `draftKey("experience")`.
- [ ] **Step 2: Run** `npm test -w @auto-career/web -- onboarding-form`. Expected: FAIL.
- [ ] **Step 3: Implement** the step and its sections.
- [ ] **Step 4: Verify** with the unit tests, typecheck, lint, and an extension to `web/scripts/qa/onboarding.mjs` that does the following:
  - picks Build, chooses the form
  - fills contact, one job with two result lines, and one education entry
  - continues, and asserts the mock received one `POST /profile/employments` with `results.length === 2`, then one `POST /resumes`
  - reloads mid-section and asserts the unsaved field is restored
- [ ] **Step 5: Commit**. Message: `feat(web): onboarding fill-in resume form`.

### Task 11: Rules, done, and routing out

**Files:**
- Create: `web/components/onboarding/steps/rules.tsx`, `web/components/onboarding/steps/done.tsx`
- Modify: `web/components/dashboard/preferences/preferences-form.tsx` only if a `compact` prop is the smallest way to reuse it. Otherwise compose `rules.tsx` from its field components.
- Delete: `web/components/dashboard/onboarding/onboarding-flow.tsx` (and its CSS, if any) once nothing imports it

**Interfaces:**
- Consumes: `savePreferences` (existing), `endFor` (Task 6), `save` (Task 7), wizard state (Task 8).
- Produces: none for later tasks.

Behaviour:
- **Rules:** locations (chips) with Remote OK, work authorization (prefilled from the form), seniority, salary floor and fit bar. Roles come from `targetRoles`; if the user has none, a roles field is shown first. Everything else is `DEFAULT_PREFERENCES`.
- **Done:**
  - Saves `step: "done"`.
  - Title and line per `endFor(goals).href`: `/resume` "Opening the resume builder", `/matches` "Your first matches are on the way", interview only "Interview practice is coming", `/dashboard` "Look around first".
  - Next items: Connect the browser extension (Find only) and Set up reply forwarding, both linking to `/settings`.
  - The primary button goes to `href`, and each goal in `others` gets a plain link.

- [ ] **Step 1: Extend `web/scripts/qa/onboarding.mjs`** with three paths:
  - find+build: the done screen's primary link is `/resume`, with a "Go to matches" link
  - interview only: the primary link is `/dashboard`
  - look: Skip setup lands on `/dashboard`

  Run it. Expected: FAIL (steps missing).
- [ ] **Step 2: Implement** both steps and remove the old flow.
- [ ] **Step 3: Verify** with `node web/scripts/qa/onboarding.mjs` (PASS), plus typecheck and lint.
- [ ] **Step 4: Commit**. Message: `feat(web): onboarding rules and done steps`.

### Task 12: Overview checklist from goals, interview card, final QA

**Files:**
- Modify: `web/components/dashboard/overview/setup-checklist.tsx`, `web/components/dashboard/overview/overview-panel.tsx` (or wherever the panel mounts)
- Create: `web/components/dashboard/overview/interview-card.tsx`

**Interfaces:**
- Consumes: `useMe` (`goals`, `targetRoles`, `targetCompanies`, `onboardingStep`).
- Produces: none.

Behaviour:
- **Checklist items:**
  - Resume, for find or build. Done when a confirmed fact exists. Links to `/onboarding`.
  - Rules, for find. Done when preferences exist. Links to `/onboarding`.
  - Forwarding, always. Unchanged.
  - No extension item.
- **Panel visibility:** shown while any listed item is open. When `onboardingStep !== "done"`, a "Continue setup" link to `/onboarding` sits at the top.
- **Interview card:** shown when `goals` includes `interview`: "Interview practice is coming", naming `targetRoles[0]` and up to two companies.
- **Run setup again:** a plain "Run setup again" link to `/onboarding` in the Profile page header (`web/components/dashboard/profile/profile-header.tsx`), for users whose step is `done` (spec 7).

- [ ] **Step 1: Write the QA expectations:** extend `onboarding.mjs`. After the interview-only path, `/dashboard` shows the card with the saved role. After find+build with everything done, the checklist is gone. Run it. Expected: FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Full verification:**
  - `npm test -w @auto-career/shared && npm test -w @auto-career/web && npm test -w @auto-career/server` (unit tests)
  - `npm run typecheck && npm run lint`
  - `node web/scripts/qa/onboarding.mjs`
  - `node web/scripts/qa/shots.mjs --routes /onboarding,/dashboard --scenario both`

  Read every new shot at desktop and 390 px; check reduced motion with `--force-prefers-reduced-motion`; check keyboard focus on step change. Expected: all pass, with no overflow and no console errors.
- [ ] **Step 4: Commit**. Message: `feat(web): goal-aware setup checklist and interview card`.
