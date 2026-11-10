# Onboarding wizard: design

Date: 2026-11-10 · Status: draft for owner approval · Prototype: `.superpowers/brainstorm/12644-1794289461/content/onboarding-prototype.html` (local, gitignored; the owner approved its flow and look)

## 1. Intent

A new user lands on `/onboarding` right after verifying their email (or after Google sign-up). Today that page is a three-task checklist that assumes everyone wants Kairos to apply to jobs for them. The owner wants onboarding to start from what the person came to do, ask only what that needs, and end somewhere useful: a resume open in the builder, a matches feed, or the Overview.

Success: a user who only wants a resume never sees fit rules; a user who wants jobs leaves with a resume, rules and a target; nobody is forced through steps they did not choose, and anybody can stop and come back where they left off.

## 2. Scope and order

This document covers **project 1, the onboarding wizard**. The owner's request also contains three more projects, each to be designed separately, in this order:

1. **Onboarding wizard** (this document).
2. **Resume templates**: about 50 templates in twelve categories: Traditional, Modern, Minimal and simple, Professional and corporate, Executive, Creative, Aesthetic, Bold and graphic, Tech and IT, Student and fresher, Academic CV (multi-page, publications), and Skill-based and hybrid (career changers). Filters: safe for applications, with photo, one page, one or two columns, dark. Job shortcuts (teacher, nurse, chef, designer, sales) map a target position to suggested templates; they are not separate templates. Sources, 2026-11-10:
   - **The owner's references.**
   - **Pinterest survey.** The common styles were plain ATS-friendly one-column, minimal grey with photo, two-column sidebar, soft beige or pink "aesthetic" Canva-style, bold poster and infographic with skill bars and software icons, dark CVs, teal medical (nurse), sage or terracotta sidebars (teacher), and chef headers with photo.
   - **Novorésumé's gallery** (novoresume.com/resume-templates and /cv-templates). It groups templates by format (skill-based, hybrid, traditional), career stage (student, professional, executive), industry (IT, tech), style, photo, one page and region (UK, US). Its builder offers section reordering, extra fonts and themes, specialized sections (volunteer, conferences, publications, honours, hobbies), skill rating styles (bars, dots) and matching cover letters. These features are notes for projects 2 and 3, not commitments.

   Templates are Kairos's own designs in these styles, not copies of any pin or of Novorésumé's templates. Photos stay optional and off by default: recruiters, Novorésumé's own reviewers among them, warn against headshots on US resumes. Each template is a recipe (layout skeleton, type pair, colour theme, heading style) rather than a separate design; the gallery mockup `.superpowers/brainstorm/12644-1794289461/content/template-gallery.html` shows 42 generated from 10 skeletons. Includes the registry, the gallery with filters (safe for applications, photo, one or two columns) and the wizard's template step. Extends the suite PRD section 7 (`docs/superpowers/specs/2026-10-29-resume-suite/README.md`).
3. **Resume builder redesign**: three panels (sections editor left, page centre, templates/score right, both sides collapsible) after the owner's reference. Grows from today's `/resume` workspace, which already has a three-column collapsible layout.
4. **Interview practice**: later. Listed as F9/P6 in the backend gap map; no PRD yet.

The wizard's template step (5.5) depends on project 2: today no template besides the default (`kairos-single-v1`) renders, there is no `/api/templates` route, and the template schema has no category, thumbnail or description. **[call]** The template step is built in project 2, against that project's registry. This project leaves the slot in the step order (between Rules and Done) and nothing else. Until project 2 lands, "Build my resume" ends by opening the builder in the default template.

## 3. Goals, non-goals, anti-goals

Goals
- Ask what the user wants first; branch the rest on that answer.
- Two ways to give a resume: upload PDF/DOCX, or fill one complete form with everything job applications ask for. Pasting text stays as a small fallback.
- Every path except "Just look around" asks the desired position(s) and, optionally, target companies.
- Progress survives reloads and leaving: the server knows the current step.
- One visual system with the auth pages (form beside the painting).

Non-goals
- Employers or posting jobs (the owner dropped "Post a job").
- Interview practice itself (project 4).
- Building the nine templates or the new builder (projects 2 and 3).
- Analytics or A/B testing of the wizard.

Anti-goals (failure even if it works)
- A typed or uploaded line reaching a resume without being a confirmed fact (breaks the truth lock).
- A Creative template being sent to an employer by the applier.
- A long mandatory form standing between a user and the product: every step except step 1 can be skipped or left.

## 4. The flow

Step 1 is multi-select. "Just look around" is exclusive: picking it clears the others, and picking another clears it.

| Step | Shown when | Required to continue |
|---|---|---|
| 1. Goals | always | at least one goal |
| 2. Target | any goal except "look" alone | at least one position (companies optional) |
| 3. Resume source | find, build or interview | a choice (interview-only users may skip) |
| 3a. Upload + check facts | source = upload | parse finished; confirming is encouraged, not forced |
| 3b. Fill in form | source = form | full name and one Experience or Education entry |
| 3c. Paste text | source = paste | existing 200-character minimum |
| 4. Rules | find | the preferences schema |
| 5. Template (project 2) | find or build, once project 2 ships | a template, or Skip |
| Done | always | none |

The progress bar counts steps 1, 2, 3, 4 and 5 as shown for that user; sub-steps 3a to 3c count as step 3. "Skip setup" (top right, every step) and "Skip this step" (steps 2, 4, 5) are always available. Back always returns to the previous step with its answers intact.

**Where each path ends.** **[call]** With several goals, the first that applies wins, in this order:
1. Build: `/resume` (the builder edits the default base resume, which the wizard's new resume becomes; see 5.3a).
2. Find: `/matches`.
3. Interview: `/dashboard` with an "Interview practice is coming" card that names their saved target.
4. Look around, or Skip setup: `/dashboard`; the setup checklist there offers to resume onboarding.

The Done card's primary button goes to the winner; each other chosen goal gets a plain link under it.

## 5. Steps in detail

Copy below is the approved prototype's; the builder may tighten it but must keep its rules (sentence case, no dashes, no filler verbs).

### 5.1 Goals
"What brings you to Kairos?" Four options as full-width rows (icon, title, one line, check): Find and apply to jobs; Build my resume; Prepare for interviews; Just look around. Buttons with `aria-pressed`. Saved to `profiles.goals` on Continue.

### 5.2 Target
"Which job are you going for?" Desired position: type and Enter to add a chip, up to 5, 2 to 80 characters each, with up to three suggestion chips. Companies: same pattern, optional, up to 10, 1 to 120 characters. Saved to `profiles.target_roles` and `profiles.target_companies`. Used later: target roles prefill `preferences.roles` in step 4 and become `targetRoles` of the base resume made in step 3; target companies are stored for interview prep and future matching. **[call]** Target companies do not change matching in this project.

### 5.3 Resume source
Two large choices, Upload a file (PDF or DOCX up to 5 MB) and Fill it in with us, plus a "Paste the text instead" link. A user who already has confirmed facts (an existing user resuming, see 7) sees "Use what you already added" as a third choice that skips to step 4.

### 5.3a Upload
Drop zone or file picker; `POST /api/profile/imports` (multipart, exists). Poll `GET /api/profile/imports/:id` and show progress in words ("Reading your resume", "Finding your roles"); a reload resumes the same import. Failure messages come from the server (scanned PDF, wrong type, too large) with "Paste the text instead" as the way out. When parsed, show the found facts with the existing fact list (Confirm, Edit, Remove, Confirm all). Continue then calls `POST /api/resumes` `{from: "facts", importId, name, targetRoles}` to make the base resume, then `POST /api/resumes/:id/default` so the builder (which edits the default base) opens it. **[call]** Running setup again makes a new base resume only if the user adds a resume again; the previous one stays in the library, and the per-profile base resume cap applies with the server's message. Unconfirmed facts stay unconfirmed and unused, as today.

### 5.3b Fill in the form
One page with a section rail on desktop (a select or progress chips on phone). Sections and where each field goes:

| Section | Fields | Stored as |
|---|---|---|
| Contact | full name, headline, email (read-only, from the account), phone, city, country | name on the account; headline on the base resume; phone, city, country via `PUT /api/profile/contact` |
| Links | LinkedIn, GitHub, portfolio | `PUT /api/profile/contact` |
| Work authorization | where you can work (the four `WORK_AUTHORIZATIONS`) | kept for step 4's `preferences.workAuthorization` |
| Experience (repeatable) | title, company, location, start, end or "current", results one per line | one confirmed `employments` row per job with its `role` fact and one linked `metric` fact per results line (new endpoint, 6.2) |
| Education (repeatable) | school, degree, field, start, end, grade (optional) | one `education` fact each |
| Skills | chips | one `skill` fact per group of up to 10 |
| Projects (repeatable) | name, link, what it did | one `project` fact each |
| Certifications (repeatable) | name, issuer, year | one `certification` fact each |
| Languages | chips | one `skill` fact, "Languages: …" **[call]** (no new fact kind) |
| Application details | notice period, open to relocation, expected salary | encrypted application answers (new endpoint, 6.2) |

Facts typed here are created confirmed (`POST /api/profile/facts`, `confirmed: true`, or the employment endpoint for jobs), because the user wrote them. Experience must go through employments: `defaultResume` (`server/src/services/resume-doc.ts`) only places metric facts under a job through an `employments` row, so loose facts would leave the builder with headings and no bullets. Employments and facts also let the form refill itself after Back or a reload. A section saves when the user leaves it or presses Continue; an unsaved section survives a reload in `sessionStorage`. Required: full name and at least one Experience or Education entry before Continue makes the base resume (`POST /api/resumes {from: "facts", name, targetRoles}`). **[call]** References are left out: they are rarely asked by application forms and sharing a third party's contact details needs their consent.

### 5.3c Paste
The existing `ResumeForm` (`POST /api/profile/resumes`), then the fact list as in 5.3a.

### 5.4 Rules (find only)
"Set the rules a job must pass." Locations (chips) with Remote OK, work authorization (prefilled from 5.3b if given), seniority, salary floor, fit bar. Roles come from step 2 and are not asked again. Excluded companies, excluded keywords and the per-company cap keep `DEFAULT_PREFERENCES` and stay editable in Preferences. Saves with `PUT /api/profile/preferences`.

### 5.5 Template (built in project 2)
Recorded here so the flow is complete. "Pick a look for your resume." A "Suggested for {first target role}" row, then the category chips and filters from the gallery mockup. Download-only templates carry a note: "For downloads and portfolios. When Kairos applies for you, it sends a version that is safe for applications." Picking sets `templateId` on the base resume. The primary button reads "Open in resume builder" when Build is a goal, otherwise "Continue". Skip keeps the default template.

### 5.6 Done
One card: title and line by path (see 4), then "next" items: Connect the browser extension (find only) and Set up reply forwarding, both linking to `/settings`, then one primary button to the path's destination.

## 6. Data and API

### 6.1 Profile fields (migration)
- `profiles.goals text[] not null default '{}'`, values `find | build | interview | look`, checked.
- `profiles.target_roles text[] not null default '{}'` (max 5) and `profiles.target_companies text[] not null default '{}'` (max 10).
- `profiles.onboarding_step`: widen the check to `goals, target, resume, confirm-facts, rules, template, done`; new default `goals`. Existing rows keep their value (see 7). The parse job's `resume → confirm-facts` move keeps working.
- **[call]** The step stays forward-only. The `profiles_guard` trigger (`server/drizzle/0007_profiles.sql`, decision D-30) silently drops backward writes on purpose, and it stays. `onboarding_step` therefore means "furthest step reached". The wizard works out where to open from saved data: goals, targets, whether a resume and facts exist, preferences. Back is client-side only. "Run setup again" opens step 1 with answers prefilled and never resets the server value.
- `PUT /api/profile/preferences` stops setting `onboarding_step = 'done'`; the wizard sets the step explicitly.

### 6.2 Endpoints
- `PUT /api/profile/onboarding` with any of `{goals, targetRoles, targetCompanies, step}`, validated by a new shared zod schema; returns the profile. `GET /api/me` and `GET /api/profile` expose `goals`, `targetRoles`, `targetCompanies` and `onboardingStep`.
- `POST /api/profile/employments` (and `PATCH`/`DELETE /api/profile/employments/:id`) writes one confirmed employment written by the user: title, company, location, start, end. It writes its `role` fact and its linked `metric` facts in one transaction. The database already allows such rows (`employments_guard`, migration 0016). `GET /api/profile/employments` returns them with their facts, for refilling the form.
- `PUT /api/profile/application-details` writes notice period, relocation and expected salary into `sensitive_answers_enc` (AES-256-GCM via `lib/crypto.ts`, never sent to a model), merging with what is there. Read back only to its owner.
- Existing and reused: `POST/GET /api/profile/imports`, `POST /api/profile/facts`, `POST /api/profile/facts/confirm`, `PUT /api/profile/contact`, `PUT /api/profile/preferences`, `POST /api/profile/resumes`, `POST /api/resumes`, `PATCH /api/resumes/:id`.
- The QA mock (`web/scripts/qa/mock-api.mjs`) gains the new routes so the screenshot harness covers every step.

## 7. Existing users and re-entry

- `done` users never see the wizard unless they open it from Profile or the checklist ("Run setup again" starts at step 1 with answers prefilled).
- Users on the old `resume` or `confirm-facts` step are treated as `goals = {find}` and resume at step 3 or 3a's fact check.
- Opening `/onboarding` resumes at the first step whose data is missing (see 6.1). The Overview setup checklist is rebuilt from goals: resume (find, build), rules (find), forwarding (always). **[call]** No extension item: the server has no "extension connected" signal, and an item that can never turn done would keep the checklist open forever. The Done card mentions the extension instead.
- Sign-in routing is unchanged: `/login` still goes to `next` or `/dashboard`.

## 8. Visual and interaction design

Approved concept: **the day rises as you answer.** The auth pages end on the dawn valley; onboarding keeps the same split (painting beside the form). The painting advances dawn (`scene-a-dawn-valley`) → morning (`scene-b-footbridge`) → noon (`scene-c-noon-meadow`) as the user moves through their steps. A frosted glass card on the painting, "Your brief", lists the answers as they are given (goals, position, companies, resume, rules, template); each new row settles in. On phones the painting is a 200 px band at the top and the brief is one line under the progress bar.

- Route group `(onboarding)` with its own layout (no dashboard sidebar or tab bar); URL stays `/onboarding`; `proxy.ts` already guards it.
- Tokens, Urbanist and Instrument Serif (the brief title only), buttons, inputs, glass and focus rings from `DESIGN.md` and `docs/DESIGN.md`. Icons from `@phosphor-icons/react`, which the app already uses; no emoji.
- Motion verb "settle, then advance": step content enters from the side it is going to (forward from the right, Back from the left), 550 ms with the project ease; painting cross-fades over 900 ms; brief rows settle from 10 px below. Transform and opacity only. `prefers-reduced-motion` removes all of it.
- One `h1` per step; focus moves to it on step change; options are buttons with `aria-pressed`; the progress bar has a text equivalent ("Step 2 of 5, Your target"); every target at least 44 px; no horizontal scroll at 360 px.
- The painting is decorative (`alt=""`) and served through `next/image` at the right size; the LCP element is the step heading. The source PNGs are 1.2 to 1.9 MB, so they need sized WebP/AVIF output.
- Sticky footer: Back (ghost), Skip this step (text), Continue (espresso pill, disabled until the step is ready).

## 9. Constraints

- Truth lock: resume lines cite confirmed facts only; uploaded facts start unconfirmed; typed facts start confirmed.
- ATS: only `atsSafe` templates are ever uploaded by the applier (suite PRD 7.1). Creative templates are `atsSafe: false`.
- Privacy: application details are encrypted at rest and excluded from model calls and from logs.
- Plan limits and rate limits are the server's (uploads: 10 an hour, 5 MB); the wizard shows the server's message.
- No new runtime dependency for motion.

## 10. Calls made (for the owner to check)

1. Goals are multi-select; "Just look around" is exclusive.
2. Target companies are saved but do not change matching yet.
3. Languages are stored as a skill fact; references are left out.
4. Typed facts are created confirmed; uploaded ones are not.
5. The template step is built in project 2 (30 to 50 templates, eight categories); this project leaves its slot.
6. Two-column, photo and timeline templates are download-only; the applier always sends a template that is safe for applications.
7. Interview-only users end on the Overview with an "Interview practice is coming" card.
8. Onboarding gets its own full-screen layout instead of the dashboard chrome.
9. Saving preferences no longer marks onboarding done; the wizard does.
10. Several goals: Build beats Find beats Interview for where the wizard ends; the others become links.
11. `onboarding_step` stays forward-only ("furthest reached"); the wizard opens at the first step with missing data.
12. Experience typed in the form becomes confirmed employments with linked facts (new endpoint), so the builder gets real bullets.
13. The wizard's resume becomes the default base resume, which is what the builder edits.
14. No extension item in the setup checklist until the server can tell when the extension is connected.

## 11. Left to the builder

Suggestion chip source for positions; exact form field order inside a section; whether paste goes through `POST /api/profile/imports` with text (returns an import id and avoids the Free plan's profile limit) or the existing `POST /api/profile/resumes`; if a Find user skipped the target step, the rules step asks for roles (preferences need at least one); how the brief card animates on reorder; component structure and state management; test split between unit and integration (integration tests run only in CI); the exact wording of server error messages shown in the wizard.
