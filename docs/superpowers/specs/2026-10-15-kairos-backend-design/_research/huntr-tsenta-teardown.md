# Huntr × Tsenta teardown → Kairos combination

Date: 2026-10-23. Owner ask: "resume making structure like Huntr and AI function like Tsenta".

Sources: public pages only. huntr.co (`/`, `/product/ai-resume-builder`, `/product/resume-tailor`) and tsenta.com (`/`). Logged-in apps not inspected (no accounts made). REA browser capture failed ("provider is closing", 3 tries); Playwright used instead. Screenshots in `.playwright-mcp/` (gitignored): `huntr-tailor-hero.jpg`, `huntr-tailor-editor.jpg`, `huntr-builder.jpg`, `tsenta-hero.jpg`.

---

## 1. From Huntr: resume structure

### Builder

| Part | What Huntr does |
|---|---|
| Layout | Collapsible "Editor" panel left, live template preview right |
| Sections | Accordions: Summary, Work Experience, Education, Skills, Projects, Certifications, Links. Add, remove, reorder |
| Section header | Name, "AI" button, collapse (−) |
| Entry card | Title, company with logo, location, ⋯ menu. "+ Add Experience" above |
| Bullet | Own card. Hover toolbar: edit · "Rewrite with AI" · delete |
| Entry footer | "+ Achievement", "AI Suggestions" |
| Templates | 7 (Cedar, Maple, Aspen, Spruce, Hemlock, Bonsai, Classic), color customizable |
| Import / export | Import PDF, DOCX, LinkedIn. Export PDF and DOCX |
| Versions | Base resumes plus tailored copies linked to a job. Named versions, side-by-side compare, undo |

### Tailor (3 panes)

| Pane | Content |
|---|---|
| Left: suggestions | Group by Section or Priority. "Select N Suggestions". Card = action ("Add Skill: CLI Design") + reason + tags (Tailor Resume, Stay Relevant, Be Concise) + Ignore / Edit / Accept |
| Center: document | Resume with inline diff: green underline = added, red strikethrough = removed |
| Right: job | Title, company, Keyword Match score, keyword list with JD frequency count, checkbox, Add / Ok, grouped (Hard Skills, …) |

Score = Keyword match + Qualifications match + Responsibilities match, shown as a number and poor / fair / great.

### Tracker
Kanban job tracker, contacts, interview tracker, search metrics, Chrome job clipper.

---

## 2. From Tsenta: AI functions, against Kairos today

| Tsenta stage | What it does | Kairos today | Gap |
|---|---|---|---|
| 01 Find | Watches 50,000+ career pages, 30+ ATSes (Workday, Greenhouse, Lever, Ashby, …). Match % with explanation. Paste a job URL to add | Polls ~2,000 Greenhouse/Lever/Ashby boards (FR-13). Fit gate + model score + reasons (FR-17, FR-18) | Coverage (Workday + others), paste-URL intake, alerts by email/push |
| 02 Prep | Reads JD (keywords, must-haves, disqualifiers). Rewrites bullets for the role. ATS score /100 with checks (parseable text, semantic headings, standard fonts, all keywords). Diff review: "4 changes · nothing sent yet" → Edit / Approve & send | Truth-locked tailoring (FR-22), cover letter (FR-29), one-page PDF (FR-30), draft edit (FR-31) | JD analysis object, ATS score, line-level diff view |
| 03 Apply | Logs in, fills every field, answers open-ended questions "in your voice", uploads resume, submits. Receipt "6 of 6 fields · 0 skipped · 0 generic answers" | Extension + cloud applier (FR-34, FR-40), answer rules (FR-23), receipt (FR-39) | ATS logins, receipt counters, voice profile for open answers |
| 04 Track | Connected inbox routes recruiter mail to the application, moves status, drafts replies into user's drafts folder | Forwarding address + classify-email (FR-50), inbox (FR-51), weekly report (FR-52) | Auto status from replies, reply drafts |
| Channels | Web, Chrome autofill, iMessage "yes" to apply, mobile apps, MCP/CLI (`tsenta.apply`) | Web + extension | iMessage, mobile, MCP |
| Pricing | Pay per submitted application. Free 25; $19/600, $39/1,500, $99/4,500 per 30 days | Credits per submission. Free 25; $19/400, $39/1,200, $79/3,000 | Same model, Tsenta gives more applications per dollar |

Kairos already covers about 70% of Tsenta's pipeline. Huntr's builder is the bigger gap.

---

## 3. Conflicts with Kairos invariants

| Their behavior | Kairos rule | Resolution |
|---|---|---|
| Huntr suggests "Add Skill: CLI Design" from the JD, whether or not the user has it | Truth lock: every line cites confirmed facts (FR-22) | A keyword gap becomes a question, "Do you have CLI Design?". Yes → new fact, confirmed → usable. Never auto-added |
| Tsenta "Hands off", iMessage "yes" applies | Approve before send (INV) | Owner chose hands-off (2026-10-23): opt-in **Autopilot**. Approval stays the default. Autopilot sends only what passes every other invariant (threshold, truth lock + verifier, required answers, no model answer to sensitive questions, per-company and daily caps, credits). Auto-pauses on a failure spike; receipt + notification per send; off switch |
| Tsenta reads the inbox, enters verification codes | Mailbox never read (FR-50) | Keep forwarding address. Verification codes: the extension asks the user |
| Tsenta covers Workday (account creation, bot checks) | No CAPTCHA solving or evasion (FR-40) | Workday via extension only; a challenge fails clean, no charge |
| Builder is mostly UI | Backend-only program, `web/` and `extension/` frozen | Owner unfroze `web/` for builder + tailor screens (2026-10-23). `extension/` stays frozen. Spec defines routes; frontend plan follows |

---

## 4. Proposed combination

1. **Builder = Huntr layout over Kairos facts.** Each bullet is a fact; a resume is an ordered selection of confirmed facts plus a template. "Rewrite with AI" rewrites wording but keeps the fact citation.
2. **Tailor = Huntr 3 panes, Tsenta prep brain.** JD analysis (keywords, must-haves, disqualifiers) feeds the right pane. Fact-cited suggestions with reasons fill the left pane. The center pane shows the diff. ATS score and 3-part match score sit on top.
3. **Pipeline = Tsenta 4 stages, already mostly built.** Add paste-URL intake, receipt counters, reply-driven status, more ATS coverage later.
4. **Approval by default, Autopilot opt-in.** "Approve & send" ends prep, as in Tsenta's own UI; Autopilot skips the click under the guards in section 3.

### New backend surface (additive)
- `resume_documents` (base or tailored, job link, template, section order, parent version) and `resume_versions` (snapshot, name, created_at)
- Multi-template render: PDF + DOCX
- `analyze-jd` agent: keywords with counts, must-haves, disqualifiers
- Match score: keyword / qualifications / responsibilities, 0–100 plus band
- `suggest-edits` agent: fact-cited suggestions with reason and tags; verifier as today
- ATS lint: parseable, headings, fonts, keyword coverage
- Import: LinkedIn (profile PDF export) alongside PDF and DOCX
- Paste-a-job-URL intake: Greenhouse, Lever and Ashby first

---

## 5. From freehire (github.com/strelov1/freehire, MIT, Go + SvelteKit), 2026-10-23

Owner asked which freehire tools and features to use. Read from the repo (`docs/features.md` and package AGENTS.md files). The code is Go, so ideas and algorithms are ported to TypeScript, with MIT attribution where code or templates are reused.

### Adopt (spec these)

| # | Feature | freehire behavior | Kairos use |
|---|---|---|---|
| F1 | Deterministic match score (`internal/candidate/cvmatch`) | No LLM. Four categories with server-owned weights: Requirements Coverage 40, Keyword Match 30, Job Title Match 20, Seniority Fit 10. An unverifiable input leaves the denominator, never the numerator; unavailable categories are reported with a reason. Scored on the rendered text layer of the tailored CV and recomputed after every save | Powers the Huntr right-pane score live and for free. Also the pre-rank before the Haiku fit score (cost lever) |
| F2 | Ghost-job signal (`internal/job/ghost`) | Verdict `none` / `possible` / `likely`, computed on read. Structural criteria: evergreen or repost pattern, absent from the employer's own ATS board. Outcome criteria: silent applications and user reports from at least 2 distinct people (privacy and abuse gate). Structural evidence alone never reaches `likely`. Evidence is shown, not just the flag | Fit gate skips `likely` ghosts. Autopilot never sends to `possible` or `likely`. The UI shows the reasons |
| F3 | Experience bank provenance (`internal/candidate/experience`) | Employments with evidence atoms; each atom records who asserted it (user or model). Only user-asserted atoms may enter a CV | Facts gain `asserted_by` and an `employment_id`. Builder sections are employments with their facts. Matches the truth lock |
| F4 | Revisioned CV editing (`internal/candidate/cvedit`) | One writer for CV changes. Every edit is revisioned and undoable. Autopilot tailoring snapshots before running | `resume_versions` snapshot before any AI or Autopilot run. Undo |
| F5 | Append-only application event ledger and reminders (`appevent`, `engage/reminder`) | One history per application (sent, answered, advanced, gone quiet). Reminders for silence or an ageing saved job | `application_events` table feeds the timeline, tracker stages and "no reply in N days" nudges |
| F6 | Saved searches with digests (`search/savedsearch`, `engage/notify`) | Subscribe to a search; email or Telegram digest of what is new | Email digest of new matches (Tsenta "pinged on every channel"). Telegram later |
| F7 | Paste a careers or job URL and detect the ATS (`internal/ingest/boardresolve`) | Works out which ATS a URL runs on and whether the board is covered | Paste-a-job-URL intake. Unknown boards go to a review queue |
| F8 | ATS adapters as a porting reference (`internal/ingest/sources`, about 300 adapters) | Workday, SmartRecruiters, iCIMS, BambooHR, Breezy, Avature and more | Phase 2 coverage beyond Greenhouse, Lever and Ashby. Port only adapters for public JSON or HTML job boards |
| F9 | Interview rehearsal preset | Mock interview bound to one vacancy the user applied to (the server verifies the binding). Questions come from the gap between the requirements and the experience bank | One bounded feature on Sonnet 5.5, metered per plan. Not a general chat agent |
| F10 | Typst CV templates marked ATS-safe or not | Templates rendered by Typst; each flagged for ATS survival and headshot | Candidate source for the builder's templates (MIT). Keep an `atsSafe` flag per template |
| F11 | Per-feature daily AI allowance with HTTP 402 | A spent allowance is refused, never degraded | Same pattern as the cost model's daily caps; reuse the 402 shape |

### Skip

| Feature | Why |
|---|---|
| Gmail connect | Kairos never reads a mailbox. The forwarding address equals freehire's hosted address |
| Tracer links (rewrite CV links to learn when recruiters open them) | Tracks third parties (recruiters) and adds GDPR/DPDP consent questions. Revisit after beta |
| General in-app chat agent with tools | Kairos rule: no open-ended autonomous loops. Only F9 as a bounded feature |
| Referrals, market analytics, collections, Telegram channel ingestion, keyless public API | Off the core job of fit-first applying. Not now |
