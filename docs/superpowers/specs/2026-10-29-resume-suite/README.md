# PRD: Kairos resume suite (versions, import, templates, smarter review, job tracker)

Status: **owner answered the open questions 2026-10-29 (D7 to D10); awaiting approval of the whole document.** Extends the resume workspace spec of 2026-10-23 (`../2026-10-23-resume-workspace/README.md`, "the workspace spec"). Everything in that spec stays binding unless this document changes it by name.

## 1. Why

The owner asked, again on 2026-10-29, for "resume making structure like Huntr and AI functions like Tsenta". The workspace spec built most of that already: the Huntr editor layout, the truth-locked AI rewriter and review, the deterministic match score, paste a job URL, and answer and cover letter drafts. A fresh read of huntr.co and tsenta.com on 2026-10-29 (public pages only, no account used) found what is still missing, and the owner picked all four remaining builds plus a web layout update, and asked that this PRD name every feature of both products.

What Kairos is for does not change: fit-first applying where nothing is sent without approval and nothing is written that the user has not confirmed. Huntr is the better resume tool; Tsenta is the faster pipeline. Kairos takes Huntr's structure and Tsenta's pipeline and refuses the parts of both that invent facts.

## 2. Decisions so far

| # | Decision | By | Date |
|---|----------|----|------|
| D1 | Build all four: (R1) resume versions and file import, (R2) templates with colours and DOCX export, (R3) AI review calibrated to experience level plus a headline generator, (R4) a Huntr-style job tracker with contacts and interviews | owner | 2026-10-29 |
| D2 | A resume tailored for a job is saved as its own version, linked to that job and shown on its tracker card (Huntr's model). Today it only lives inside the application draft | owner ("ok") | 2026-10-29 |
| D3 | The web layout is updated for the new pages (navigation, routes, workspace header and panels, phone layout) | owner | 2026-10-29 |
| D4 | This PRD lists every Huntr and Tsenta feature with its Kairos status (section 3) | owner | 2026-10-29 |
| D5 | The truth rules of the workspace spec (its section 3) stay binding on everything here | owner, 2026-10-23 | carried |
| D6 | The workspace spec's "one template" decision (its D4) is replaced by R2 | owner, by picking R2 | 2026-10-29 |
| D7 | Web first against the QA mock, then the server side on today's Express server (new migrations), as phase A went. A file storage bucket and the PDF renderer in the server image are approved | owner | 2026-10-29 |
| D8 | An import merges into the user's current resume profile: new facts join its fact bank, duplicates are skipped, nothing is deleted. Profiles stay as separate career tracks, each with its own base resumes | owner | 2026-10-29 |
| D9 | The extension's filler changes for the file name only: the upload is named `{Name} - Resume.pdf` in the chosen template. Uploads stay PDF only | owner | 2026-10-29 |
| D10 | Tracker Insights are Pro and Max only; the board, contacts, interviews and notes are on every plan | owner | 2026-10-29 |

Calls made by the author of this PRD, not the owner, are marked **[call]** where they appear and listed in section 13.

## 3. Feature inventory: every Huntr and Tsenta feature

Status: **Built** (in the repo today), **R1 to R4** (this PRD), **Later** (not now, no blocker), **Never** (conflicts with a Kairos rule; the reason is given).

### 3.1 Huntr (huntr.co, read 2026-10-29)

| Huntr feature | What it does | Kairos status |
|---|---|---|
| AI Resume Builder | Section accordion editor, live preview, AI generators | Built (`/resume`) |
| Import a resume | PDF or DOCX file fills the builder | R1 |
| LinkedIn Resume Builder | Import from LinkedIn | R1 through the user's own LinkedIn "Save to PDF" export. Importing by profile URL: **Never** (scraping, against LinkedIn's terms) |
| Resume Storage, multiple resumes | Unlimited base resumes, one per job type | R1 |
| Targeted Resume | A resume aimed at one job title | R1 (base resume with target roles) |
| Job-tailored resumes linked to the job | Each tailored copy is saved and linked to the job it went to | R1 (D2) |
| Named versions, compare, undo | Version history | Undo: Built. Named versions and compare: R1 |
| Resume Tailor | Keywords, responsibilities and qualifications matched to a posting, with suggestions | Built (F1 score, requirements covered or missing, keyword checklist) |
| Job Match Score | Score with poor, fair, great | Built (deterministic F1) |
| Resume Keyword Scanner, Job Keyword Finder | Keywords from a posting | Built (Job match panel) |
| AI Resume Review | Line by line with a plain reason and best-practice tag, bulk accept or reject | Built; tags, priority grouping and multi-select: R3 |
| Experience-level calibration | Review tuned to junior, mid or executive | R3 |
| Resume Checker | Score for spelling, length, metrics, repetition, clichés | Built (deterministic check); spelling, clichés, level-aware length and metric use: R3 |
| Resume Headline Generator | A headline line under the name | R3 |
| Resume Summary Generator | Summary from experience | Built ("Write from my facts") |
| Resume Bullet Generator | Achievement bullets | Built ("AI suggestions" per entry), truth-locked |
| Resume Skills Generator | Skills from keywords | Built ("Suggest skills from my facts") |
| AI Resume Rewriter | Rewrite a line | Built (rewriter dialog) |
| Resume Fixer, Resume Optimization, ChatGPT Resume Builder | Marketing names for review and rewrite | Built (same features) |
| "Use data and metrics" placeholders | Writes numbers the user never gave, or placeholders to fill | **Never** (truth rule 2) |
| 7 templates with colour choices | Cedar, Maple, Aspen, Spruce, Hemlock, Bonsai, Classic | R2 (Kairos's own templates, section 7) |
| PDF export | One-click PDF | Built (browser print); server renderer: R2 |
| DOCX export | Word file | R2 (Huntr's page names PDF only; the 10-23 teardown saw DOCX) |
| AI Cover Letters | From the resume and the posting | Built (draft from facts in the application editor) |
| Job Tracker, Kanban | Drag-and-drop stages | R4 |
| Activity timeline | Every step from saved to offer | R4 |
| Contact Tracker | Recruiters and hiring managers | R4 |
| Interview Tracker | Interview dates and details | R4 |
| Documents per job | Resume, cover letter and files kept with each job | R4 (resume version, cover letter, receipt); user file uploads: R4 phase 2 |
| Job Search Metrics | Progress numbers | R4 |
| Private notes, salary per job | Notes on a job | R4 |
| Map View | Employers on a map | Later (needs a geocoding service; low value next to the rest) |
| Job Clipper (Chrome) | Save a job from any site | Later (`extension/` stays frozen per the backend spec; R4 has "Add job" by URL or by hand) |
| Job Application Autofill | Fill forms in one click | Built (extension and cloud applier) |
| Interview Question Generator | Practice questions | Later (F9 interview rehearsal, already in plans as `rehearsalTurns`) |
| Free tools without signup | Lite generators on the marketing site | Later (marketing and SEO work) |
| Mobile app | iOS and Android | Later |
| Huntr for organizations | Bootcamps, universities, coaches | Later |

### 3.2 Tsenta (tsenta.com, read 2026-10-29)

| Tsenta feature | What it does | Kairos status |
|---|---|---|
| Watches 50,000+ career pages, 30+ ATSes | Discovery | Built for about 2,000 Greenhouse, Lever and Ashby boards; Workday and others: Later (F8) |
| Match % with explanation | Why a role fits | Built (fit gate, score and reasons) |
| Paste a job URL | Add one role | Built |
| Alerts on every channel | Email, web and push on a new match | Web: Built. Weekly report: Built. New-match email digest: Later (F6) |
| Reads the posting | Keywords, must-haves, disqualifiers | Built (fit gate and JD analysis) |
| Tailored resume per role | Keyword-aligned rewrite | Built; saved per job as its own version: R1 |
| Passes ATS | Parseable text, headings, fonts | Built (single-column template); every template ATS-safe with a text round-trip check: R2 |
| Review every change before it goes out | Before and after | Built (AI review and Suggested edits redlines) |
| Rewrites that add metrics | Its example adds "4M MAU" and "38%" to "Built features using React" | **Never** (truth rule 2) |
| Cover letter per role, with Ready, Default or Off | Per-application setting | Drafts: Built. Per-application setting: Later (small) |
| Answers open questions "in your voice" | Application answers | Built, truth-locked; EEO, visa, sponsorship and salary are never model output |
| Auto-apply, watch or unattended | Fills and submits | Built (extension and cloud applier, after approval) |
| Hands-off sending, "Submit all" | No per-application approval | Bulk approve: Built. Hands-off: specced as opt-in Autopilot in the backend spec, not in this PRD |
| Receipts | Every field and answer sent | Built. "Flag an answer to change next time": Later (small) |
| Tracker statuses Applied, Viewed, Replied, Interview | Status per application | Applied, Replied, Interview: R4. **Viewed: Never** (needs tracking links in the resume; skipped in the teardown for third-party privacy) |
| Tracker filters All, In flight, Needs you, Failed, Skipped | Filter chips | Built (Applications table); kept in the R4 table view |
| Reply routing | Recruiter mail matched to the application | Built (forwarding address) |
| Connects and reads the user's inbox, enters verification codes | Mailbox access | **Never** (Kairos never reads a mailbox). Verification codes: the extension asks the user |
| Drafts recruiter replies | Into the user's drafts folder | Later (drafted in Kairos for the user to copy; Kairos never sends email) |
| iMessage and WhatsApp, reply "yes" to apply | Messaging channel | Later (a "yes" would count as that one application's approval) |
| Chrome extension | Fills the form on the page | Built |
| MCP server and CLI | Agents apply through tool calls | Later |
| Mobile apps | iOS and Android | Later |
| Pay per application, free first 25 | Pricing | Built (credits) |

## 4. Goals, non-goals, anti-goals

**Goals**
- A user keeps several resumes (one per kind of role) and always knows which version went to which employer.
- A user with an existing resume file has a confirmed base resume in under five minutes, with nothing citable until they confirm it.
- Output looks designed and still parses in every ATS: every template, every format.
- Review advice fits the user's career stage instead of one rule for everyone.
- The tracker moves itself from real events (drafted, sent, replied) and the user can still organise it by hand.

**Non-goals (this PRD)**: Job Clipper, mobile apps, messaging channels, MCP and CLI, map view, interview rehearsal, more ATS coverage, Autopilot, calendar sync, two-column templates, recruiter reply drafts, a public free-tools section.

**Anti-goals (a failure even if it works)**
- Any line, headline, summary or skill that adds a number, employer, title, date, tool, degree or scope no cited confirmed fact contains. No placeholders such as "[X]%".
- Dragging a tracker card sends, approves, withdraws or pays for anything.
- The tracker shows "Applied" for a Kairos application without a submission report saying it was submitted.
- A template, colour or format that changes the words, their order or their parseability.
- Contacts used for outreach, enrichment or anything but the user's own reference.
- Reading the user's mailbox, scraping LinkedIn, or tracking whether a recruiter opened a resume.

## 5. Truth rules added by this PRD

The workspace spec's six rules hold. Added:

7. **Imports are unconfirmed.** Everything parsed from a file becomes facts with `asserted_by = 'import'` and `confirmed = false` (worker spec 11). A resume line built from an import can be saved only after its fact is confirmed. The user's own wording is kept as the fact text.
8. **Design never touches content.** Templates, accents, page size and density change only presentation. The rendered text layer of every PDF and DOCX must contain every line of the document in order (the round-trip check, section 7.4).
9. **Level calibration changes advice, not facts.** A "senior" review may favour scope and outcomes but can only use scope and outcomes that confirmed facts contain; otherwise it asks for a fact.
10. **Derived values cite their inputs.** A value computed in code from confirmed facts (for example "4 years" from role dates) may appear in a headline or summary only when the code computed it, and it cites the facts it came from. A model never computes or states one.
11. **Tracker truth.** Stages owned by Kairos's pipeline (Drafting, Applied) move only on real state. Automatic moves go forward only and never override a stage the user set later in the flow.
12. **Notes are private and not facts.** Tracker notes, salary text and contact notes are never read by any agent and never sent with an application.

## 6. R1: resume versions and file import

### 6.1 Concepts
- **Base resume**: a named resume the user edits directly ("Frontend", "Data analyst"). Optional **target roles** (strings from the user's preference roles or typed). Exactly one base resume per resume profile is the **default**. A base resume belongs to one resume profile and cites only that profile's facts (D8). A user with one profile never sees the word "profile" in the library; with more than one, the library and switcher group resumes by profile.
- **Tailored resume**: a copy of one base resume made for one job. It records `baseResumeId` (nullable once that base is deleted), `jobId`, and once queued `applicationId`. Editing it never changes the base. There is at most one active tailored resume per job per user.
- **Sent snapshot**: when an application is approved, the tailored resume document and the rendered file are frozen on the application. The receipt shows exactly that snapshot. After submission the tailored resume is read-only and offers "Duplicate as a new base resume" and "Tailor again" (a fresh copy).
- **Revision**: every save is a revision (exists today, newest N kept). New: a revision can be **named** ("Before rewrite for Stripe"), and an automatic named revision is saved before any "Accept all" in AI review and before any tailoring run (F4). Named revisions are never pruned. **[call]** Keep the 50 newest unnamed revisions and every named one.

### 6.2 Which base resume a draft starts from
When Kairos drafts an application from a match (the existing pipeline), the tailored copy starts from the base resume whose target roles best match the job title (case-insensitive token overlap, ties to the most recently edited), else from the default. The workspace shows "Started from {base name}" with "Use another base" (rebuilds the copy from the picked base; asks first if the copy has edits). **[call]**

Every draft, whether made by the pipeline or by the user, now has a tailored resume document, so it appears in the library and on its tracker card.

**[call]** The pipeline keeps today's behaviour: its tailoring (verified as today) is written into the copy, after a `before_tailor` named revision, and the user reviews the whole draft in the Review queue, which shows the copy's diff against its base. Suggestions the user asks for in the workspace stay proposals until accepted, as today. `applications.resume_lines` is derived from the tailored document on every save, so the extension queue, the cloud applier payload and `PATCH /applications/:id` keep working unchanged.

### 6.3 Base changes after a copy exists
Copies do not sync. If the base changed after the copy was made, the tailored workspace shows "Your base resume changed after this copy was made" with "Start over from the base" (makes a named revision first). **[call]**

### 6.4 Import
Sources: PDF, DOCX, a LinkedIn profile PDF (LinkedIn's own "Save to PDF"), and pasted text (exists). **Where it goes (D8):** into the resume profile the user is working in (the only one for most users). Each import is its own record with its own parse status, so a profile can hold several sources; a re-parse replaces only the unconfirmed facts that came from that import and never deletes a confirmed fact or another import's facts. Creating a new profile stays a separate, plan-gated action on Profile. Limits and the parsing pipeline are worker spec 11 (5 MB, magic bytes, macro check, capped extraction thread, contact data and sensitive lines removed before the model). A PDF without a text layer fails with "This PDF is a scanned image. Paste the text instead." Unsupported types fail before upload.

Flow (`/resumes/import`):
1. **Upload**: drop zone or file picker, or a "Paste text" tab. The parse runs in the background (202), the page shows progress in words ("Reading your resume", "Finding your roles"), and a reload resumes the same state.
2. **Confirm facts**: what was found, grouped by employment (role, company, dates), each line a fact with Confirm, Edit and Remove; "Confirm all in this role"; facts already in the bank are shown as "Already in your profile" and not duplicated (same text after whitespace and case normalisation, same employment). Contact details found in the file are offered for Profile, not stored as facts.
3. **Build**: "Create base resume" makes a new base resume from the confirmed facts in the file's section order, with the user's own wording as line text, named after the file or the most recent role title. Unconfirmed facts are listed as "N lines wait for your confirm" with a link back to step 2. The new resume opens in the workspace.

Entry points: onboarding (replaces the paste-only step), `/resumes` "New resume > Import a file", and Profile.

### 6.5 Limits
**[call]** Up to 10 base resumes per resume profile on every plan, tailored resumes unlimited (one per job). Resume profiles stay plan-gated as today (`resumeProfiles` 1, 1, 3, 10). Imports reuse the parse worker's own daily cap; no new paid gate.

### 6.6 Library page `/resumes` (layout in section 10.3)
- **Base resumes**: cards with a thumbnail of the top of page 1, name, target-role chips, "Default" badge, Resume check score, template name and last edited. Card menu: Open, Rename, Duplicate, Set as default, Edit target roles, Delete. The default cannot be deleted until another is default; the last base resume cannot be deleted.
- **Tailored for jobs**: a list with role and company, the base it came from, the tracker stage chip, match score, last edited and a lock icon once sent. Filters: stage and base; search by company or role. Rows open the workspace; sent rows open read-only.
- **Compare**: from any resume's History, pick two revisions or a tailored copy against its base; the centre shows the redline view the workspace already has (removals struck, insertions underlined), read-only.

## 7. R2: templates, colours and export

### 7.1 Templates
**[call]** Six templates at launch, all single-column and ATS-safe, differing in typography, header arrangement, heading style and accent use. Names are Kairos's own:

| Id | Name | Character |
|---|---|---|
| `kairos-single-v1` | Classic | Today's template (workspace spec section 8) |
| `modern` | Modern | Sans, accent name and rules, generous spacing |
| `serif` | Serif | Serif headings and body, hairline rules |
| `compact` | Compact | Dense type for long histories |
| `executive` | Executive | Larger name, headline prominent, summary first |
| `minimal` | Minimal | No rules, spacing only, no accent |

Every template: real text (no images of text), real list bullets, headings as headings, dates as plain text, no tables, columns, text boxes, icons or headshots. Each carries `atsSafe: true`; a later template with `atsSafe: false` (for example two columns) could only be downloaded, never uploaded by the applier. Source candidates: freehire's MIT Typst templates (F10), with attribution where code is reused.

### 7.2 Per-resume design settings
Stored on each resume document: `templateId`, `accent` (one of 8 swatches per template, or none), `pageSize` (`letter` or `a4`), `density` (exists). **[call]** The default page size comes from the profile location: United States and Canada get Letter, everyone else A4. Accent colours are used on the name, headings and rules only; body text stays near-black. A swatch used on text must reach 4.5:1 contrast on white, and no meaning may depend on colour (grayscale printing loses nothing). A tailored copy inherits its base's settings when made.

### 7.3 Export
- **PDF**: server-rendered per template (Typst, worker spec 05 section 3.9, generalised from one template id to the registry). The browser-print path stays as the fallback when the server answers 503, with a notice that the file came from the browser.
- **DOCX**: server-rendered from the same document. Word built-in heading styles, real numbered or bulleted lists, no tables or text boxes, fonts embedded or safe fallbacks. Library choice is left to the builder.
- **Copy as plain text**: the resume as text for pasting into application forms. **[call]**
- File name: `{Name} - {first target role or job title} - Resume.{ext}`, ASCII-safe.
- Multi-page documents are allowed (page length becomes a level-aware check in R3); the preview's page-break guide stays.

### 7.4 Round-trip check
For PDF and DOCX, the server extracts the text of the rendered file and checks that every line of the document's plain text appears in order after whitespace normalisation. A mismatch is a render error and no file is served (as worker spec 05 already requires for PDF).

### 7.5 Preview fidelity
The workspace preview stays HTML for speed, with one HTML renderer per template using the same tokens. Text is guaranteed identical by 7.4; small visual differences between preview and PDF are accepted. The builder may choose a different preview approach if it keeps editing instant.

### 7.6 The applier
The applier uploads the sent snapshot as a PDF in its template, named `{Name} - Resume.pdf` (ASCII-safe). This is the only change to the frozen extension filler (D9): the payload gains the file name next to `resumePdfUrl`, and the filler uses it instead of the hard-coded `resume.pdf`. DOCX is never uploaded; it is for the user's own downloads. The receipt names the version and template.

**[call]** Approval never waits on the renderer. The snapshot is frozen at approval and the file is rendered before the send, with the worker's normal retries; if it still cannot be rendered, the send fails clean and the credit is refunded, like any failed send.

## 8. R3: smarter AI review and headline

### 8.1 Experience level
Levels: **Early career** (intern, entry), **Mid-level** (mid), **Senior** (senior), **Lead or executive** (lead), from `SENIORITY_LEVELS`. The default is the highest level in the user's preferences; the AI review tab header shows "Reviewing as: Mid-level" with a switch. The choice is stored per resume. A tailored copy uses the job's seniority when the posting states one.

What the level changes (thresholds are **[call]**, informed by Huntr's published length data):

| Check or advice | Early career | Mid-level | Senior | Lead or executive |
|---|---|---|---|---|
| Page length warning above | 1 page | 2 pages | 2 pages | 3 pages |
| Lines per entry, two most recent roles | up to 5 | up to 6 | up to 6 | up to 6 |
| Lines per entry, older roles | up to 4 | up to 3 | up to 3 | up to 2 |
| Section order advice | Education and Projects before Experience when no full-time role fact exists | Experience first | Summary, then Experience | Headline and Summary required, then Experience |
| Review emphasis | Projects, coursework, skills shown in use | Outcomes per role | Scope, ownership, outcomes | Scope, teams, outcomes, leadership facts |

The Resume check stays deterministic; the level only changes its thresholds and which checks apply. The workspace spec's "one page at the chosen density" check is replaced by the level's page-length check.

### 8.2 New deterministic checks
- **Spelling**: native browser spellcheck on every editable field, plus a check for repeated words, double spaces and inconsistent date formats. Model spelling and grammar fixes come as review suggestions tagged "Fix spelling" (wording only, same facts).
- **Clichés**: a fixed list ("hard-working", "team player", "results-driven", "synergy" and so on), shown as a check with the lines named.
- **Metric use**: a line whose cited or linked facts include a metric fact that the line does not use is flagged "A number from your facts could go here"; a line with no metric fact available gets "If you have a number for this, add it as a fact". Never a placeholder.
- **Tense**: past roles in past tense, the current role in present (simple verb heuristics; advisory).

### 8.3 Review suggestions
Each suggestion gains a **tag** (one of: Lead with the result, Be concise, Stay relevant, Show scope, Use your numbers, Fix spelling, Remove filler) and a **priority** (high, medium, low). The AI review tab groups by Section or by Priority, and lists can be multi-selected for "Accept selected (N)" next to the existing per-section Accept all and Ignore all.

### 8.4 Headline
The resume header gains an optional **headline** under the name (for example "Frontend engineer · React, TypeScript · 4 years"). "Suggest a headline" returns up to three options, each citing its facts; years of experience, when used, is computed in code from confirmed role dates (rule 10). The headline renders in every template and is hidden when empty.

## 9. R4: job tracker

### 9.1 Items and stages
A **tracker item** is one job the user is following. It is created when the user saves a match ("Save to tracker" on match cards), when any application draft is created (pipeline or user), when a job is imported by URL, or when the user adds a job by hand ("Add job": a supported board URL imports as today; any other URL or none is tracking only, with title, company, location and link typed by the user, and cannot be sent by Kairos).

Stages: **Saved, Drafting, Applied, Interviewing, Offer, Closed**. Closed has a reason: rejected, withdrawn, not pursuing, or posting closed.

Automatic moves (forward only, rule 11):

| Event | Stage |
|---|---|
| Application draft created | Drafting |
| Submission report `submitted` | Applied |
| Submission `failed` or `refunded` | stays Drafting, card badge "Send failed, credit refunded" |
| Application withdrawn | Closed, withdrawn |
| Routed reply classified `interview` or `assessment` | Interviewing |
| Routed reply classified `offer` | Offer |
| Routed reply classified `rejection` | Closed, rejected |

User moves: any item can be dragged to Saved, Interviewing, Offer or Closed. Tracking-only items can also be moved to Applied ("Applied outside Kairos"). A Kairos application cannot be dropped into Drafting or Applied by hand: dropping shows "Approve it in the Review queue to send it". **[call]** While an application is approved or submitting, its card cannot be moved to Closed: dropping shows "It's approved to send. Withdraw it in the Review queue first", so a user never closes a job Kairos then applies to. Every drag has a keyboard and screen-reader path ("Move to…" in the card menu). Order within a column is the user's.

### 9.2 Board and card
Columns with counts; Closed is collapsed by default; archived items are hidden behind a filter. A card shows initials (no logo service, **[call]**), role, company, location, fit score when known, the resume version chip, the last activity in words ("Applied 3 days ago", "No reply in 14 days"), and the next interview date when one exists.

### 9.3 Job detail (`/applications/[id]` for Kairos applications, `/tracker/[itemId]` for items without one)
The existing application editor and receipt stay; the page gains tabs:
- **Overview**: the saved job description snapshot (kept even when the posting is taken down), link, location, salary text (user-entered, private), stage and its reason.
- **Timeline**: an append-only event list (F5 `application_events`): saved, drafted, resume version linked, approved, submitted (receipt link), failed, refunded, each routed reply with its kind, stage changed by the user, interview added, note added.
- **Documents**: the tailored resume version (opens the workspace or the sent snapshot), the cover letter, the receipt. Phase 2: user file uploads (PDF, DOCX, PNG, JPG; 5 MB each; worker 11's untrusted-file rules).
- **Contacts**: contacts linked to this job, add or link.
- **Interviews**: this job's interviews.
- **Notes**: private free text (rule 12).

### 9.4 Contacts
A per-user list: name, title, company, email, phone, LinkedIn URL, notes, and linked jobs. Added by hand, or suggested from a routed reply ("Add {sender} from {company} as a contact?", one click, never automatic). Search, edit and delete (hard delete). Contacts are the user's own reference: Kairos never messages, enriches or shares them, and they are deleted with the account.

### 9.5 Interviews
Per job: start date and time with time zone, duration, kind (phone, video, onsite, assessment, other), location or meeting link, linked contacts, notes and outcome. When a routed reply is classified as an interview, the job shows "This reply mentions an interview. Add the date?"; Kairos never guesses a date. Each interview downloads as an `.ics` file. Overview shows the next interview. Reminders are in-app (badge the day before); email reminders and calendar sync are Later.

### 9.6 Insights
A strip on `/tracker` over 30 days, 90 days or all time: applications sent, reply rate (applications with any reply other than a confirmation, divided by those submitted), interview rate, offers, median days to first reply, and a funnel by stage. **Reply rate by base resume** compares the user's versions. Below 5 sent applications in a group, counts are shown instead of percentages.

Insights are Pro and Max only (D10), gated by the existing `outcomeReport` plan flag **[call]** because they are built from the same numbers as the weekly report. On Free and Starter the strip shows a locked state that names the plan; the API answers 403 `forbidden` naming the plan, as for other plan gates.

### 9.7 Table view
The existing Applications table with its filter chips (All, In flight, Needs you, Failed, Skipped) becomes the Table view of `/tracker`, with a stage column added.

## 10. Web layout update

### 10.1 Navigation (desktop sidebar, `web/lib/site.ts` and `sidebar-nav.tsx`)

| Group | Today | After |
|---|---|---|
| Work | Overview, Matches, Review queue, Applications, Replies | Overview, Matches, Review queue, **Tracker**, Replies |
| About you | Resume, Profile, Preferences | **Resumes**, Profile, Preferences |
| Account | Billing, Settings | Billing, Settings |

Tracker replaces Applications (its table lives inside Tracker). New icon for Tracker (a kanban glyph from the Phosphor set already in use). Badge: Tracker shows the count of interviews in the next 7 days. Group sizes in `sidebar-nav.tsx` stay 5, 3, 2.

### 10.2 Routes

| Route | What |
|---|---|
| `/resumes` | Library (6.6) |
| `/resumes/[id]` | The workspace for one resume, base or tailored (today's `/resume`) |
| `/resumes/new?base=<id>&job=<jobId>` | Creates the tailored copy and redirects to it |
| `/resumes/import` | Import flow (6.4) |
| `/resume` | Redirects to the default base resume; `/resume?job=<jobId>` redirects through `/resumes/new` |
| `/tracker` | Board (default) or Table, `?view=board\|table`; tabs Jobs, Interviews, Contacts, Insights |
| `/tracker/[itemId]` | Detail for tracking-only items (9.3) |
| `/applications` | Redirects to `/tracker?view=table` |
| `/applications/[id]` | Kept (receipt links stay valid), extended with the 9.3 tabs |

### 10.3 Page layouts
- **Library**: page header "Resumes" with a primary "New resume" menu (From my facts, Duplicate an existing one, Import a file). Base resumes as a card grid (3 across from 1280, 2 from 768, 1 on phones), Tailored for jobs as a list beneath. Empty state: "Import your resume or start from your facts."
- **Workspace header** (changes to workspace spec 2.1): breadcrumb "Resumes / {name}" where the name opens a switcher (base resumes, then recent tailored copies); "History" opens a side sheet of revisions with Name this version, Restore and Compare; the primary action is an **Export** split button (PDF, with DOCX and Copy as text in its menu) in base mode, and Create draft or Open application in tailored mode; a "Started from {base}" chip in tailored mode.
- **Workspace Layout tab** (changes to workspace spec 2.2): Template gallery (thumbnails, 2 across), Accent swatches, Page size, Density, then the existing section order, rename and hide.
- **Workspace AI review tab**: the "Reviewing as" level switch, Group by Section or Priority, and multi-select.
- **Workspace Check panel**: level-aware checks with the new checks of 8.2.
- **Tracker**: tab row (Jobs, Interviews, Contacts, Insights); in Jobs, a Board or Table toggle, "Add job" primary button, filters (search, stage, base resume, archived), the Insights strip collapsible above the board; the board scrolls horizontally on desktop with fixed-width columns.
- **Overview** (`/dashboard`): a "Next interview" card when one exists, and the greeting's next action includes "No reply in 14 days" nudges after drafts and new matches.

### 10.4 Phones (390)
- Tab bar: **[call]** Overview, Matches, Queue, Tracker, and More; Replies moves into More, and More shows a dot when replies need action.
- Board: one column at a time under a scrollable row of stage chips with counts; "Move to…" replaces drag.
- Library: one column; Tailored for jobs as a list.
- Import: one step per screen.

### 10.5 Design system
Follow `docs/DESIGN.md` and the glass system already in the app (tokens, Urbanist tracking, reading measure, existing components such as `filter-chips.tsx`, panels and status chips). No new visual language.

### 10.6 Marketing site
Update the claims that change: the FAQ answer to "Can I upload my resume?" (now yes, PDF, DOCX or LinkedIn PDF), the How it works and Features copy for versions, templates and the tracker, and the plan feature lists (tracker on every plan; Insights listed under Pro and Max, D10). Keep the landing density rules (one headline up to 8 words, subline up to 20 words, one visual per section). **[call]** No new landing sections.

## 11. API contract (additive; zod in `shared/src/schemas.ts`)

Same error shape as today (`{ error: { code, message, details } }`). A spent daily AI allowance (F11) answers **429 `rate_limited`** with `details.reason = "daily_allowance"` and `details.resetsAt` (the next UTC midnight). 402 stays reserved for "not enough credits", which the frozen extension and web already read that way. *[Amended 2026-10-30, WP-43, decision "How are per-feature daily AI limits answered": 429 daily_allowance plus spec caps; this replaces the earlier 402 wording.]*

| Method and path | Request | Response | Errors |
|---|---|---|---|
| `GET /resumes` | `?kind=base\|tailored` | `{ resumes: ResumeSummary[] }` | |
| `POST /resumes` | `{ from: "facts" \| "duplicate", sourceId?, name, targetRoles? }` | `{ resume: Resume }` | 409 `limit_reached` |
| `GET /resumes/:id` | | `{ resume: Resume }` | 404 |
| `PUT /resumes/:id` | `ResumeInput` | `{ resume: Resume }` | 422 `truth_lock`, 409 `read_only` (sent) |
| `DELETE /resumes/:id` | | 204 | 409 `is_default`, 409 `last_base` |
| `POST /resumes/:id/default` | | `{ resume: Resume }` | |
| `GET /resumes/:id/revisions` | | `{ revisions: RevisionSummary[] }` | |
| `POST /resumes/:id/revisions` | `{ name }` | `{ revision }` | |
| `POST /resumes/:id/revisions/:revId/restore` | | `{ resume: Resume }` | |
| `GET /resumes/:id/export` | `?format=pdf\|docx\|txt` | file | 503 `service_unavailable` (PDF falls back to print) |
| `POST /resumes/tailor` | `{ jobId, baseResumeId? }` | `{ resume: Resume, suggestions: ResumeSuggestion[], fit: JobFit }` (the copy is saved, D2) | 404, 409 `exists` with its id |
| `POST /resumes/suggestions` | today's `SuggestionRequest` plus `resumeId`, `level?`, scope `headline` | `{ suggestions, factCreated }`; suggestions gain `tag` and `priority` | 429 (`rate_limited`, `details.reason = "daily_allowance"`; amended 2026-10-30, WP-43) |
| `GET /templates` | | `{ templates: { id, name, atsSafe, accents: string[] }[] }` | |
| `POST /profile/imports` | multipart file or `{ text }`, `resumeProfileId?` (default: the current profile, D8) | 202 `{ importId, parseStatus }` | 413, 415, 422 `no_text_layer` |
| `GET /profile/imports/:id` | | `{ parseStatus, facts: Fact[], duplicates: string[] }` | 404 |
| `POST /profile/facts/confirm` | `{ ids: string[] }` | `{ facts: Fact[] }` | |
| `GET /tracker` | `?view, stage, q, archived` | `{ items: TrackerItem[] }` | |
| `POST /tracker` | `{ matchId } \| { url } \| { manual: { title, company, location?, url? } }` | `{ item: TrackerItem }` | 422 `unsupported_board` only for `{ url }` when the user asked to import |
| `PATCH /tracker/:id` | `{ stage?, closedReason?, position?, notes?, salaryText?, archived? }` | `{ item }` | 409 `stage_owned_by_pipeline` |
| `GET /tracker/:id/events` | | `{ events: ApplicationEvent[] }` | |
| `GET /tracker/insights` | `?range=30d\|90d\|all` | `{ insights }` | 403 `forbidden` below Pro (D10) |
| `GET/POST/PATCH/DELETE /contacts[/:id]` | contact fields, `jobIds` | `{ contact(s) }` | |
| `GET /interviews` | `?from` | `{ interviews }` | |
| `POST/PATCH/DELETE /tracker/:id/interviews[/:iid]` | interview fields | `{ interview }` | |
| `GET /tracker/:id/interviews/:iid.ics` | | `text/calendar` | |

`GET /resume`, `PUT /resume` and `POST /jobs/:jobId/tailor` stay as aliases (the default base resume; tailor now saves the copy) until the web stops calling them.

Schema changes: `resumeSchema` gains `kind`, `isDefault`, `targetRoles`, `baseResumeId`, `jobId`, `applicationId`, `templateId`, `accent`, `pageSize`, `level`, `headline` (`{ text, factIds } | null`), `readOnly`; `resumeSuggestionSchema` gains `tag` and `priority`; `SUGGESTION_SCOPES` gains `headline`; new `trackerItemSchema`, `applicationEventSchema`, `contactSchema`, `interviewSchema`, `resumeSummarySchema`, `revisionSummarySchema`, `templateSchema`.

**Additions made while writing the contract (WP-16, `shared/src/schemas-suite.ts`, additive):** `PATCH /resumes/:id` `{ name?, targetRoles? }` (rename and target roles, 6.6); `GET /resumes/:id/revisions/:revId` returns the revision's document (Compare, 6.6); `GET /tracker/:id` returns the item with its private notes, saved posting text and contact ids (the `/tracker/[itemId]` page, 9.3); `POST /resumes/suggestions` requires `resumeId`; a spent daily AI allowance is `429 rate_limited` with `details { reason: "daily_allowance", feature, limit, used, resetsAt }` (decision on D-allowance; 402 stays "no credits"); `409 stage_owned_by_pipeline` carries `details.reason` (`approve_in_review_queue`, `withdraw_first`, `pipeline_stage`); `422 truth_lock` carries `details.lineIds` as on today's `PUT /resume`; `resumeSchema` keeps the new fields optional (the legacy `/resume` routes do not send them) and `resumeDetailSchema` makes them required for every `/resumes` route; the library name is `libraryName` on the detail and `name` on the summary and in request bodies, because the document's own `name` stays the person's name; `SUGGESTION_SCOPES` is unchanged (the Resume Writer agent reads it) and the new `RESUME_SUGGESTION_SCOPES` adds `headline`.

## 12. Data (backend)

- `resumes`: drop the unique index on `user_id`; add `kind`, `name`, `is_default` (one per resume profile, partial unique index), `target_roles text[]`, `base_resume_id` (self reference, set null on delete), `job_id`, `application_id`, `template_id`, `accent`, `page_size`, `level`, `archived_at`; partial unique index on (`user_id`, `job_id`) for active tailored copies. Existing rows become the default base resume of their profile.
- `resume_imports` (D8): `resume_profile_id`, `source_kind` (`pdf`, `docx`, `linkedin_pdf`, `text`), `file_key` (R2, nullable), `parse_status`, timestamps; facts record the `import_id` they came from. The parse job's "delete every fact in the slot on re-parse" becomes "replace the unconfirmed facts of this import".
- `resume_revisions`: add `name` (nullable) and `reason` (`edit`, `named`, `before_ai`, `before_tailor`, `restore`).
- `applications`: add `resume_snapshot jsonb` and `resume_file_key` (R2), written once at approval.
- `tracker_items`: `user_id`, `job_id` nullable, `application_id` nullable, manual `title`, `company`, `location`, `url`, `stage`, `stage_set_by` (`system` or `user`), `closed_reason`, `position` (fractional index), `notes`, `salary_text`, `archived_at`, timestamps.
- `application_events` (F5, append-only): `tracker_item_id`, `kind`, `source` (`system` or `user`), `payload jsonb`, `at`.
- `contacts`, `contact_jobs` (contact to tracker item), `interviews`.
- Uploads (R4 phase 2): object keys in R2 with per-user prefixes, the untrusted-file rules of worker 11.

Agents: the Resume Writer gains the `level` input, `tag` and `priority` outputs and the `headline` scope (new prompt version, eval set extended: invented-detail rate 0 at every level, refine compliance, tag accuracy on a labelled set). The verifier checks headlines like lines. No new agent.

## 13. Calls made by the PRD author (check these)

1. Up to 10 base resumes per resume profile on every plan; no new paid gate (6.5).
2. A pipeline draft starts from the base resume whose target roles best match the job title, else the default (6.2).
3. Tailored copies do not sync with later base edits; the user can start over from the base (6.3).
4. 50 unnamed revisions kept per resume; named ones never pruned (6.1).
5. Six single-column ATS-safe templates with Kairos's own names; no two-column template (7.1).
6. Default page size from profile location: Letter for the US and Canada, A4 elsewhere (7.2).
7. Copy as plain text added to export (7.3).
8. Level thresholds in the table in 8.1.
9. Card initials instead of company logos (9.2).
10. Phone tab bar: Tracker replaces Replies, which moves into More with a dot (10.4).
11. Tracker replaces Applications in the sidebar; `/applications/[id]` URLs stay (10.1, 10.2).
12. No new landing sections; only changed claims are updated (10.6).
13. The pipeline's tailoring is written into the tailored copy as today, and `applications.resume_lines` is derived from it (6.2).
14. A card cannot be moved to Closed while its application is approved or submitting (9.1).
15. Approval never waits on the renderer; a file that cannot be rendered fails the send clean with a refund (7.6).
16. Insights reuse the existing `outcomeReport` plan flag instead of a new one (9.6).

## 14. Build order and acceptance

Order: **R1, then R2, then R3, then R4**, with the web layout update landing in R1 (navigation, `/resumes`, workspace header) and R4 (Tracker). R4 needs R1 (cards link a version); R3's page-length rule needs R2's multi-page output.

How each release is built (D7): first the web screens against the QA mock (`web/scripts/qa/mock-api.mjs`, contract zod first in `shared/src/schemas.ts`), then the server side on today's Express server with new migrations (0003 and up), as phase A was. Infrastructure approved by D7: a storage bucket (R2) for rendered files and imports, and Typst plus the DOCX library in the server image.

Known divergence: section 12 differs from the re-architecture's `02-database.md` revision 2 (several `resumes` rows per profile instead of one per slot; `tracker_items`, contacts and interviews are new; `application_events` here is keyed by tracker item with a `payload`). When the re-architecture is approved, its `02-database.md` and `05-api.md` are amended to match this PRD; until then this PRD governs these tables on today's server.

*Resolved 2026-10-30 (WP-43): ADR-001 Revision 3 is accepted (path c, hybrid) and the owner decision "PRD authoritative, one numbering lane" is in force. `02-database.md` (7.1.7, 7.1.8, 7.3.1, 7.3.4, 7.7, 14.3), `05-api.md` (11), `workers/04` and `workers/05` carry dated amendments to this PRD's shapes; this PRD governs the resume, revision, import, tracker and application_events tables, and the sent snapshot is frozen and rendered at approval (7.6). Migration files take the next free number in merge order, allocated by the data lane only, and use Postgres 17-compatible DDL until PG18 is confirmed. See `../2026-10-15-kairos-backend-design/README.md` for the full map.*

Shared files: other sessions own parts of the server (at the time of writing `routes/profile.ts`, `services/submissions.ts` and `lib/auth.ts`). Before editing a server file, check that no other session is changing it; prefer new route and service files over edits to shared ones.

Frontend work loads the owner's frontend skill stack first (see project memory) and follows `docs/DESIGN.md`.

Acceptance (each release):
- **R1**: a user imports a DOCX, confirms facts, gets a base resume whose lines are their own words with every line citing a confirmed fact; creates a second base resume; a pipeline draft starts from the base with the matching target role; the tailored copy appears in the library and is read-only after send; the receipt shows the sent snapshot; History names, restores and compares.
- **R2**: all six templates render in the preview, PDF and DOCX; the round-trip check passes for each on the seeded fixtures; accents meet 4.5:1 on text; A4 and Letter both paginate correctly; the applier uploads the snapshot's template.
- **R3**: switching level changes the page-length and line checks as in 8.1 with no change to content; the eval shows invented-detail rate 0 at every level; suggestions carry tags and priorities and multi-select accept works; a suggested headline cites its facts and any year count is computed in code.
- **R4**: a draft creates a Drafting card; a submission moves it to Applied; an interview reply moves it to Interviewing; a user drag into Applied for a Kairos application is refused with the message in 9.1; every drag has a keyboard path; contacts and interviews save, delete and link; the `.ics` imports into Google Calendar and Outlook; insights show counts below 5.

## 15. Left to the builder
DOCX library, Typst template code, preview renderer approach within 7.5, fractional indexing method, cliché list contents, drag-and-drop library (or native), exact copy for empty states and errors within the product's voice, chart style for Insights within `dataviz` guidance and `docs/DESIGN.md`.
