# Resume workspace: Huntr's structure, Tsenta's AI, Kairos's truth lock

Status: **owner-approved direction, 2026-10-23; frontend in build, backend in spec.**

## 1. Decisions (owner, 2026-10-23)

| # | Question | Decision |
|---|----------|----------|
| D1 | Scope | Build the UI now on `frontend/all-pages` against the contract in section 6, served by the QA mock. The server endpoints and AI agents in section 7 join the backend re-architecture spec and wait for its approval. |
| D2 | AI writing | Strict truth lock. The AI rewrites only from confirmed facts and cites them. When a line would need something the user has not given (a number, a tool, a scope), it asks for a fact instead of writing one. Nothing it suggests is used until the user accepts it. |
| D3 | AI functions | All four: match score and keywords, before/after review, paste a job URL, answers and cover letter drafts. |
| D4 | Output | One ATS-safe single-column template with live preview and PDF. |
| D5 | Structure | Follow the owner's Huntr screenshots (2026-10-23): breadcrumb header, left panel with Editor / AI review / Layout tabs and a section accordion, centre preview with zoom, right panel with a score and Job match. |

Sources: the owner's four screenshots of Huntr's builder; Huntr `/product/ai-resume-builder`, `/product/resume-tailor`, `/product/ai-resume-review`; `tsenta.com`. Kairos already has fit-gated matches, approve before send, receipts and reply routing; those are not rebuilt.

Kairos differs from Huntr on purpose: Huntr's rewriter offers "Use data and metrics" and writes numbers the user never gave; Kairos uses only numbers that are in confirmed facts and otherwise asks for one. Huntr's Resume Score is an opaque AI score; Kairos's "Resume check" is a list of plain, deterministic checks computed in the browser. There are no templates gallery, upsell panels, Announce or feedback buttons.

## 2. One screen: `/resume` (new nav item "Resume" under "About you", before Profile)

The workspace has two modes on one route:
- **Base resume** (`/resume`): edits save to the base resume.
- **Tailoring** (`/resume?job=<jobId>`): opened from a match ("Tailor first"), from a pasted job URL, or from the Target job section. A banner names the job and says "Changes here go into this job's draft, not your base resume." Edits apply to a tailored copy that is never saved on its own; "Create draft" turns it into an application draft.

### 2.1 Header
Breadcrumb "Resume / Base resume" (or "Resume / Tailoring for {role} at {company}"), the resume name editable inline, Undo (last 20 edits, local), the saved state ("Saved" or "Saving…" or an error with Retry), and the one primary action: Download PDF in base mode, Create draft in tailoring mode.

### 2.2 Left panel (from 1280: 400 px, collapsible to a 56 px rail)
Tabs: **Editor**, **AI review**, **Layout**.
- **Editor**: an accordion of sections, each row with a plus or minus, the section name, and a badge: "AI" where the AI can help, "Empty" where it has no lines, "Hidden" where it is hidden. Sections: Target job, Contact, Summary, Skills, Experience, Projects, Education, Certifications, plus Add section (custom title, lines only).
  - Target job: pick one of your matches or paste a job URL (section 4); switches the workspace into tailoring mode.
  - Contact: name, email, phone, location and links (LinkedIn, GitHub, portfolio) from Profile, editable here and saved back to Profile.
  - Experience and Projects: Add entry, Sort (newest first), entry cards with title, company, location and dates, and a menu (edit, hide, move, remove). Inside an entry, each line is a card with its citation chips (the facts it rests on) and a menu (rewrite with AI, edit, move, remove). Under the lines: "+ Line" (you write it and pick the facts it cites) and "AI suggestions" (suggests lines from the facts linked to this entry).
  - Summary and Skills: "Write from my facts" and "Suggest skills from my facts".
  - In tailoring mode each entry shows the job-match chip ("Covers 3 of 8 requirements").
- **AI review**: one pass over the whole resume: suggestions grouped by section, each before/after with a why and the facts used, Accept, Edit then accept, Ignore, and per-section Accept all and Ignore all.
- **Layout**: section order (up and down buttons), rename, hide or show, and density (Comfortable or Compact). No template choice (D4).

### 2.3 Centre
Tabs: **Preview** and **Suggested edits**. Preview is the one template on a Paper White US Letter page with zoom out and in (75 to 125 percent) and a page-break guide; accepted suggestions show in place. Suggested edits is the same list as AI review, inline in the document as redlines: removals struck through, insertions underlined, each with Accept and Ignore.

### 2.4 Right panel (from 1280: 360 px, collapsible)
Tabs: **Check** and **Job match**.
- **Check**: the Resume check: a number out of 100 with its basis, from deterministic checks only: every line cites a confirmed fact; contact complete; one page at the chosen density; no line over 2 printed lines; no repeated opening verb across 3 lines in a row; no section left empty but visible; dates present on every entry. Each failing check names the lines and links to them.
- **Job match** (tailoring mode; in base mode it asks you to pick a target job): the deterministic match score (no LLM; backend teardown F1: Requirements coverage 40, Keyword match 30, Job title 20, Seniority 10) with its band in words (poor, fair, great) and the four categories as rows with points, maximum and reason; then the job's requirements (required first) each marked Covered (with the facts, click to highlight lines), Unconfirmed (a fact exists but is not confirmed: Confirm), or Missing (no fact: "If this is true, add it as a fact"). Then keywords from the posting as a checklist: a keyword you have a confirmed fact for gets "Add to skills"; one you do not gets "Add as a fact if true". The score is never called a chance of an interview.

### 2.5 AI rewriter (dialog from a line's "Rewrite with AI")
Left: the original line and its facts. Centre: up to three suggestions, each with the facts it cites; "Use this" replaces the line (undoable). Right: "Not what you want?" with chips **Shorter**, **Longer**, **Lead with the result**, **More natural**, **Use numbers from my facts** (disabled with the reason when no metric fact is linked), and "Or say it in your own words" (a text box; whatever you type is saved as a new fact, unconfirmed until you confirm it here with one click, because only facts can be cited). Then Rewrite. A suggestion that needs a missing detail shows the question ("How many services moved?") and "Add this fact" instead of "Use this". Loading shows skeleton suggestion cards, not a spinner.

### 2.6 Phones (390)
One column; a segmented control switches Edit, Preview and Match; the header action stays in a sticky bar above the app tab bar; the rewriter is a full-height sheet.

## 3. Truth rules (binding on every screen and agent)

1. Every resume line, summary, skill and cover-letter sentence the AI proposes cites at least one confirmed fact id; an unconfirmed fact can be cited only after the user confirms it.
2. The AI never adds a number, employer, title, date, tool, degree or scope that no cited fact contains. It may rephrase, reorder, shorten and choose which facts to use.
3. When the best line would need a missing detail, the suggestion carries `needsFact` and no text the user can accept.
4. Suggestions are proposals. The base resume and every draft change only when the user accepts.
5. The job-match score is deterministic, counts confirmed facts only and shows its categories; the Resume check is deterministic and states each check.
6. EEO, disability, veteran, visa, sponsorship and salary answers are never model output.

## 4. Paste a job URL
An input with one button on `/matches` (above the feed) and in the Target job section: accepts Greenhouse, Lever and Ashby posting URLs (checked in the browser before sending). On success it opens `/resume?job=<jobId>`. Errors in words: not a supported board, posting not found or closed, or below your fit bar (with the fit gate's reasons and "Tailor anyway", because the user picked this job by hand).

## 5. Answers and cover letter drafts (existing application editor `/applications/[id]`)
Each open-ended answer gets "Draft from my facts"; the cover letter gets "Draft cover letter". Drafts arrive as before/after in place with the facts used; the user accepts or edits. EEO, disability, veteran, visa or sponsorship and salary questions show "AI never drafts this answer" instead of a draft button (true whether the value came from the profile, a saved answer or the user's edit).

## 6. API contract (web side; zod in `shared/src/schemas.ts`, additive)

All paths under `/api`, same error shape as today (`{ error: { code, message, details } }`).

| Method and path | Request | Response | Errors |
|-----------------|---------|----------|--------|
| `GET /resume` | | `{ resume: Resume }` (default sections when none exists) | |
| `PUT /resume` | `ResumeInput` | `{ resume: Resume }` | 422 `truth_lock`, `details.lineIds` |
| `POST /resume/suggestions` | `{ scope: "resume" \| "section" \| "entry" \| "line" \| "summary" \| "skills", sectionId?, entryId?, lineId?, jobId?, refine?: "shorter" \| "longer" \| "result_first" \| "natural" \| "use_numbers", note? }` | `{ suggestions: ResumeSuggestion[], factCreated: Fact \| null }` (`note` becomes an unconfirmed fact) | 429 `rate_limited` |
| `POST /jobs/import` | `{ url }` | `{ jobId, matchId: string \| null, fit: { passed, reasons: string[] } }` | 422 `unsupported_board`, 404 `posting_not_found` |
| `GET /jobs/:jobId/fit` | | `{ fit: JobFit }` | 404 |
| `POST /jobs/:jobId/tailor` | | `{ resume: Resume, suggestions: ResumeSuggestion[], fit: JobFit }` (nothing saved) | 404 |
| `POST /applications/:id/drafts` | `{ kind: "answer", fieldKey } \| { kind: "cover_letter" }` | `{ text, factIds: string[] }` | 422 `profile_only` |

Create draft in tailoring mode uses the existing endpoints: `POST /matches/:matchId/queue` (or, for an imported job with no match, the same call with the match created by the import), then `PATCH /applications/:id` with the accepted `resumeLines` (the truth lock is already enforced there), then navigate to `/applications/[id]`.

`jobFitSchema` also carries optional `band` and `categories` (`{ name, points, max, reason }`) for the F1 score.

Types: `resumeSchema` (`id`, `name`, `updatedAt`, `density`, `contact` `{ name, email, phone, location, links[] }`, `sections[]`), `resumeSectionSchema` (`id`, `kind`: summary, skills, experience, projects, education, certifications, custom; `title`; `hidden`; `entries[]`), `resumeEntrySchema` (`id`, `heading`, `subheading` nullable, `meta` nullable, `headingFactId` nullable, `hidden`, `lines`: `resumeLineSchema[]`), `resumeSuggestionSchema` (`id`, `sectionId`, `entryId` nullable, `lineId` nullable for a new line, `action`: rewrite, add, remove; `before` nullable, `after` nullable, `why`, `factIds`, `needsFact` nullable `{ kind, question }`), `jobFitSchema` (`jobId`, `title`, `company`, `score` 0 to 100, `basis`, `requirements[]` `{ id, text, required, status: covered | unconfirmed | missing, factIds }`, `keywords[]` `{ term, status: in_resume | has_fact | no_fact, factIds }`).

## 7. Backend (joins the re-architecture spec; not built in this round)

7.1 **Agents** (one role each, versioned prompt, strict schema, eval set): Resume Writer (suggestions for the scopes in section 6 from confirmed facts plus the current text and an optional refine), JD analysis (requirements, keywords and disqualifiers from a posting; the backend teardown's `analyze-jd`), the deterministic F1 match score in code (no model), Draft Writer (answers and cover letters from facts and saved answers; refuses protected questions). The independent verifier already in the re-architecture spec checks every proposed line, summary and cover-letter sentence against its cited facts and drops anything unsupported before it reaches the user.
7.2 **Storage**: `resumes` (one base resume per profile slot, document JSONB validated by `resumeSchema`); job imports reuse the job and match tables with `source = "manual_url"`.
7.3 **PDF**: a server renderer for the section 8 template (`GET /resume/pdf`, and per application the file the applier uploads), replacing the v1 browser print.
7.4 **Evals**: invented-detail rate 0 on a seeded set (lines adding a number, tool or employer not in their facts), protected-question leakage 0, coverage-judge agreement on labelled postings, rewrite refine compliance (shorter is shorter).

## 8. Template
One single-column document: name, one contact line, then sections in the user's order. Inter, 10.5 pt body on 1.3 leading (Compact 10 pt on 1.25), 12 pt section headings with a hairline, entry heading line with dates right-aligned as plain text, real bullets as list items. No columns, tables, icons or images. Margins 0.6 in. v1 PDF: a print stylesheet plus `window.print()`, so the preview is exactly what prints.

## 9. Alignment with the backend spec

The backend session's teardown (`docs/superpowers/specs/2026-10-15-kairos-backend-design/_research/huntr-tsenta-teardown.md`, same day) owns the server design: Anthropic API (Haiku 5.5 default), F1 deterministic score, F3 fact provenance, F4 revisions, F7 URL to ATS detection, F10 Typst templates, F11 daily AI allowance with 402, and opt-in Autopilot with guards (approval stays the default). Section 7 above is input to that spec, not a competing design. Open differences for the owner and the backend spec: one template in this web round (teardown plans several, Typst, PDF and DOCX); tailored edits saved into the application draft here (teardown plans tailored resume documents and named versions); a typed note saved as an unconfirmed fact needing one confirm click (F3 would allow user-asserted text directly).

## 10. Build in this round
- Contract (lead): zod schemas in `shared/src/schemas.ts`, hooks `web/hooks/use-resume.ts`, `use-jobs.ts`, `use-drafts.ts`, QA fixtures.
- W1 workspace: `/resume` (header, three panels, editor, preview, check, job match, AI rewriter and review), nav item, print stylesheet.
- W2 entry points: paste a job URL on `/matches`, "Tailor first" on match cards, draft buttons in the application editor.
- Backend: handed to the backend spec session (section 9); no file of this round lands in its folder.
