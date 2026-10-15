# Concept: The Ledger

Kairos landing page creative direction. Written 2026-10-15 against `docs/04-ui-ux-brief.md` (tokens), `docs/01-prd.md`, `docs/03-app-flow.md`, `docs/pricing.md`, and the four research files in `_research/` (facts, code inventory, Awwwards references, competitor landings, stack feasibility). Every number, rule and copy line in this document traces to one of those files or is marked as sample data that the page itself labels as sample.

Skills loaded for this concept: `anthropic-skills:3d-scroll-website`, `motion-graphics`, `ui-ux-pro-max`. All three loaded. The 3D-scroll skill's frame-sequence pipeline and neumorphic system were treated as guidance only; the WebGL centerpiece here is a real-time scene, because it must respond to scroll position, pointer and a click (the approve action), which a pre-rendered sequence cannot do. The motion-graphics skill contributed the "motion is the message, and it ends" principle. ui-ux-pro-max contributed the accessibility and touch checklists applied in sections 7 and 9.

---

## 1. Name and big idea

**Name:** The Ledger.

**Big idea (three sentences):** Kairos is the only application agent in which every action leaves a signed, dated row: a receipt for every field it sent, a credit ledger with one row per submission, and a resume where every line cites a confirmed fact. The landing page is itself a ledger that writes itself as the visitor scrolls: each section posts an entry, every claim names its source or is labelled sample, and the one WebGL object is a single phosphor receipt that prints a line per section, is signed by the visitor's own approve action, tears along its perforation and becomes the first row of the credit ledger. Accountability is not a message on the page; it is the page's own behaviour.

**Why only Kairos can own it.** The competitor teardown shows the field selling volume ("mass apply", "1,000+", "hundreds a week") with feeds that tick forever, logo walls, unsourced percentages and hidden prices. None of them has the three artefacts this concept is built from, because none of them has the mechanisms behind the artefacts:

| Artefact on the page | Mechanism in the product | Source |
| --- | --- | --- |
| The receipt | Each submitted application saves every field sent, every answer, the resume version and the confirmation page | PRD user story 7; proof point 3 (KEEP) |
| The credit ledger with signed rows | One credit per `submitted` report, enforced by a unique index; failed submits charge nothing (AC10, verified); duplicate reports charge once (AC9, verified); a new account starts with a `+25` ledger entry (AC1, verified) | PRC "Value metric", PRD AC1, AC9, AC10 |
| The citation chip "cites fact #N" | Truth lock: a resume line that cites no confirmed fact cannot be saved (422 `truth_lock`), AC6 unit tested | PRD AC6, APP "Edit draft" |
| The written skip reason | Fit gate runs hard filters first and writes a reason for every drop, including "Title is more senior than you asked for" | PRD core features row 2, AC3 to AC5 |

A competitor copying this page would have to show a receipt it does not produce, a ledger it does not keep and citations it does not enforce. The concept is unforgeable for the same reason the product is trustworthy.

**The kairos idea inside the ledger.** Chronos counts time down; kairos records the moment a decision was right. Every timestamp on this page is a record of a decision (approved at, submitted at, offer received at), never a countdown or a deadline. The audience is already racing an OPT clock; the page never adds a second clock. The only live clock on the page is the one that stamps the visitor's own sample approval with their local time.

---

## 2. Narrative arc

The page is one ledger with twelve numbered entries (00 to 11) and a colophon footer. Entry numbers are the page's navigation (a fixed rail at 1280px and wider), its section headings, and the lines printed on the receipt. The arc follows the lifecycle of one application: open, hear the complaints, gate, cite, approve, send, receipt, replies, bill, compare, answer, start. Six debits are posted in entry 01; the later entries settle five of them explicitly and leave one open, in writing.

Layout at 1024px and wider: a 12-column grid inside the 1280px container (32px gutters). Text sits in columns 1 to 7. Columns 8 to 12 are the receipt lane, where the WebGL receipt lives in a fixed canvas (section 3). Below 1024px the page is one column and the receipt becomes a DOM component (section 7).

Every section follows the same anatomy, which is the motif in structural form:

```
[entry number 00]  [title line, Inter Tight 400]            [ledger rule to the right edge]
[eyebrow caption]
[body, max 65 characters per line, Sage 60]
[the entry's demo or table, with a SAMPLE DATA tag if any value is illustrative]
[settlement line, when applicable: "Settles 01"]
```

### 00 Navbar: the ledger header

- 64px tall, Carbon Veil at 85% with 10px backdrop blur, 1px Phosphor Blue-Black bottom border, as the brief specifies. Logo mark (square, 0px radius) left; How it works, Pricing, Blog, About centre-left in Inter 14px 500; "Log in" as a ghost button and "Start free" as the sign-up button on the right.
- "Start free" is lime only when no other lime element is in the viewport. At first paint the hero CTA is lime, so "Start free" renders as a Default button (Ground fill, Phosphor White text and border). The lime carry (section 4.4) hands the fill to the navbar when the hero CTA leaves the viewport. This enforces the brief's one-lime-per-viewport rule literally rather than by convention, and it fixes finding C1 from the code inventory.
- Below 1024px the links collapse into a menu button opening a native `<dialog>` sheet with `data-lenis-prevent`. The sheet's "Start free" follows the same lime rule.
- The navbar also hosts, at the far right on 1280px and wider, a small caption "Entry 00" that updates to the current entry as the visitor scrolls (`aria-live="off"`, purely visual; the rail carries the accessible state).

**What the visitor learns:** this site keeps count, and the one green thing on screen is always the one thing to do next.

### 01 Hero: "Open" (entry 00 on the receipt)

- Left (columns 1 to 7): micro-label "For new grads, OPT and anyone between jobs" (Caption, Moss 70). Display statement "Job applications you would sign." in Inter Tight 400 at `clamp(40px, 24px + 3.2vw, 64px)`, line-height 1.0, tracking -0.007em (the brief's -0.448px at 64px). Subhead in Moss 80 at 20px/1.5: "Kairos finds roles that fit, tailors your resume only from facts you confirmed, and sends nothing until you approve it. Every submitted application comes with a receipt." (the facts sheet's fix applied). Primary CTA, lime pill, 48px tall: "Start with 25 free applications". Secondary, outlined: "See how it works" (anchors to entry 02). Microcopy in Sage 60: "Credits are only used when an application actually goes through." The "No card" line is dropped until the product owner confirms it (facts sheet 1.6).
- Right (columns 8 to 12): the WebGL receipt in its hero pose, a blank thermal slip with the header printed: `KAIROS · RECEIPT · SAMPLE DATA` and one line, `00 · Ledger opened`. Under the canvas, in the DOM and visible, a caption: "Sample receipt. It prints as you read." This sentence tells the visitor the rules of the page in nine words.
- Kinetic type: the H1 reveals line by line (two lines on desktop, three on phones) with the Terminal Industries technique (section 6). 600ms after the last line lands, a 1px Phosphor White hairline draws under the word "sign." from left to right over 500ms, like a signature line. No other hero motion. The receipt does not idle.

**What the visitor feels:** stillness. A dark page, a sentence, a blank slip. **Learns:** the product's three rules in one breath, and that the page will show its work.

### 02 "Reported" (entry 01): the problem as six debits

- Title: "What people report about auto-apply tools." Eyebrow: "Reported by users of other tools. Not measured by us." This attribution line is mandatory; the PRD presents these as user reports and names no source in the repo.
- The six complaints from PRD "Problem" set as six ledger rows, each 32px tall with a Circuit Border rule, a two-digit tabular number, and the complaint in Body size:

| Row | Text |
| --- | --- |
| 01 | Matches that do not fit. |
| 02 | A review step without an edit step. |
| 03 | Resumes with skills and metrics the person does not have. |
| 04 | Hundreds of applications and zero interviews. |
| 05 | Broad Gmail access that ended in a locked Google account. |
| 06 | Charges after cancelling, lost credits and ignored refunds. |

- Each row's right-hand cell reads "open" in Sage 40 caption style. As the visitor reaches the later entries, the corresponding cell is updated to "settled in 02" and so on; if they scroll back up, the settled state stays (a ledger is append-only). Row 04 stays "open" for the whole page; entry 07 explains why.
- The receipt recedes to the right margin (section 3 pose P1) and prints nothing. The DOM does the posting here.
- No competitor is named. The copy uses "other tools" and "people report".

**Feels:** recognised, not sold to. **Learns:** Kairos knows exactly which six things went wrong for people, and will account for each.

### 03 "Fit gate" (entry 02): settles 01

- Title: "A fit gate before anything else." Body (proof point 1, KEEP): "Role, seniority, location, salary floor, visa needs and your exclude list are hard rules. A job that breaks one is dropped before any model reads it, and the rest come with written reasons." The "Default bar: fit 75 of 100" line is removed (no source).
- Demo: the fit gate (section 4.2). Eight sample job cards with a company name withheld ("Company withheld · sample"), generic titles, and three native controls that change which cards pass: Seniority (`<select>`: entry, mid, senior), Needs sponsorship (radio: yes, no), Locations (`<select multiple>` with three sample metros). A fit bar `<input type="range" min="50" max="95" step="5">` sets the model-score threshold. Dropped cards dim to 50% and print their reason chip. A polite live region reads "Showing 3 of 8 jobs. 5 dropped." The whole card carries a `SAMPLE DATA` tag.
- Reason strings are the documented ones only: "Title is more senior than you asked for" (PRD), "Posting says it does not sponsor" (sponsorship filter), "Outside your locations", "Below your salary floor", "Already applied twice at this company in 30 days" (per-company cap, PRD), "Fit below your bar". Sample fit scores on cards are shown as "fit 71" in a neutral outlined badge next to the SAMPLE tag; they never appear outside this labelled demo.
- Receipt prints: `02 · Fit gate · hard rules first, reasons written`.
- Settlement line under the demo: "Settles 01. You see each skip and the reason." Entry 01 row 01 flips to "settled in 02".

**Learns:** skips are as visible as applications, and skipping costs nothing (no model call).

### 04 "Truth lock" (entry 03): settles 03

- Title: "Resumes that cannot make things up." Body (proof point 2, fixed to the documented behaviour): "Each tailored line has to cite facts you confirmed. A line that cites nothing cannot be saved; the editor lists it so you fix or remove it, and your own edits go through the same check. You see every change as a diff, line by line."
- Demo: the citation thread (section 4.3). Left, a sample resume diff of four lines in Inter 16px: removed lines in Sage 40 with a 1px strikethrough in `--bad` at 60% (no red fill), added lines in Phosphor White. Each added line ends with a chip "cites fact #07" or "cites #07, #11". Right, the confirmed facts list: "#07 · Role · sample", "#11 · Dates · sample", "#12 · Tool · sample". No metrics, no company names, no percentages; the facts are typed by kind, not by content, so nothing reads as an outcome claim. Hover or focus on a line lights its facts and draws a hairline to them.
- Also shown: one line in the diff marked "not saved · cites nothing" in `--warn` with the word, demonstrating the 422 path honestly.
- Receipt prints: `03 · Resume v3 · every line cites a confirmed fact`.
- Settlement: "Settles 03. No fact, no line." Row 03 flips.

### 05 "Review and approve" (entry 04): settles 02

- Title: "Edit everything. Then approve one or a batch." Body (HIW step 03, KEEP): "Each application shows its resume diff, every answer and why it matched. Edit anything, then approve one or a batch." Add: "Nothing is sent until you approve it. You can withdraw a draft or an approved application before it is sent." (APP alternate journeys.)
- Demo: a compact review row (sample) with "7 answers ready · 0 guessed" (the KEEP idea from the match preview; counts labelled sample), an Edit (outlined) button and an Approve button. Approve is lime here, and it is the only lime element in this viewport; the lime carry removes lime from the navbar while this row is visible.
- Pressing Approve (section 4.5) signs the receipt: `04 · Approved by you · 2026-10-15 14:02` with the visitor's own local date and time from `Intl.DateTimeFormat`, and the button becomes a Default button reading "Approved · sample". The time is computed in the click handler, never during render (Cache Components prerender rule). If the visitor never presses it, scrolling past entry 04 prints `04 · Awaiting your approval` instead, and the line is never replaced (append-only).
- Settlement: "Settles 02. Review means edit, then approve." Row 02 flips.

**Feels:** the one moment the page asks for a decision, and the product's whole promise in one button. **Learns:** approval is the gate, and the timestamp is theirs.

### 06 "Send" (entry 05): the Chrome extension and the cloud applier

- Title: "Sent from your browser, through the employer's own form." Body (HIW step 04, KEEP): "The extension fills the employer's own form and saves a receipt. Pro and Max can also send with the laptop closed." Add the AC11 safety rule in plain words: "If a required field is empty, the extension does not press submit. It tells you how many fields need you."
- Demo: a static two-column diagram in DOM (no WebGL): "Chrome extension · all plans · your browser, your session" and "Cloud applier · Pro and Max · sends approved applications while your browser is closed". Supported boards listed by name only, with no partnership implied: "Public career pages on Greenhouse, Lever and Ashby."
- Copy gate before launch: the facts sheet lists the extension and the cloud applier as "build status not stated". The present tense is used because the PRD describes them as P0 features; the implementation plan must carry a checklist item to confirm both before the page ships, with the fallback wording "The extension fills the employer's own form (in beta)".
- Receipt prints: `05 · Submitted · employer form · fields saved`.

### 07 "Receipt" (entry 06): the centerpiece moment

- Title: "Every submitted application ends with a receipt you can open." Body (proof point 3, KEEP): "The extension fills the employer's own form in your browser and saves what it sent: each field, each answer, the resume version and the confirmation page."
- This is where the WebGL receipt comes forward, rotates flat and hands off to a real DOM `<table>` with the same lines (section 3, pose P4 and the 3D-to-2D hand-off). The table, captioned "Sample receipt", has rows: Form · Greenhouse (employer's own page); Fields sent · 14 · all shown to you first; Answers · 7 · 0 guessed; Resume · version 3 · 11 lines · 11 cite a confirmed fact; Confirmation page · saved; Credit · −1 · charged once. The numerals 14, 7, 11 are sample counts under the SAMPLE tag; "0 guessed" and "charged once" are mechanisms.
- As the visitor scrolls on, the receipt tears at its perforation (section 3). The body of the slip falls out of frame; the stub remains and travels to entry 08.
- The open debit: a settlement line reads "Row 04 stays open. We cannot promise interviews, and we will not print a number we have not measured. We can show you every application and every skip." This is the page's most accountable sentence and the one most unlike the field.

### 08 "Replies" (entry 07): settles 05

- Title: "Replies come to an address you control." Body (FAQ A5, KEEP): "You set one forwarding filter, and replies about your applications come to a private address we give you. No Gmail login, no Gmail access." Add the pause rule with its exact condition: "When a reply you forward is tagged as an offer, we pause your billing." (PRC billing rules, AC12; the facts sheet notes AC12 has no verification tag, so the implementation checklist confirms it before launch.)
- Demo: a three-row sample inbox list: "Reply · tagged to application · sample", "Interview request · tagged · sample", "Offer · billing paused · sample", each with the status word, never colour alone.
- Receipt stub (now flat) carries the line `07 · Reply tagged to this application`.
- Settlement: "Settles 05." Row 05 flips.

### 09 "Billing" (entry 08): settles 06, and the full price table

- Title: "Pay for applications that went through." (PAGE heading, KEEP.) Body (proof point 4, KEEP): "One credit per application that actually went through. Failed submits cost nothing. Pause any time, and we pause for you when an offer email arrives. Weekly plans for searches that end fast."
- The credit ledger (sample): a table with Circuit Border rules, header in Sage 40 caption, columns Date · Entry · Credits · Note. Rows: `2026-10-15 · Free grant · +25 · does not expire`, `2026-10-15 · Submitted · −1 · receipt #sample`, `2026-10-15 · Failed submit · 0 · reason shown, nothing charged`, `2026-10-15 · Duplicate report · 0 · charged once already`. Signed numerals carry the word in the Note column as well as the sign. The torn stub from entry 06 docks into a slot at the top of this table (section 3, pose P6) and prints `08 · −1 credit · receipt kept`.
- The price table: interval switch (Weekly, Monthly, Quarterly) with the active segment in Carbon fill, not lime (fixes C3). Four plan columns from PRC with the exact figures: Free $0 (25 submitted applications once, 1 resume profile); Starter $19 / $6 weekly / $45 quarterly (400 per 30 days, 94 per week, cover letters, answer memory, 1 profile); Pro $39 / $12 / $95 (1,200 per 30 days, 280 per week, cloud applier, weekly outcome report, 3 profiles); Max $79 / $25 / $189 (3,000 per 30 days, 700 per week, 5-minute polling, 10 profiles). Cost per application at full monthly use printed as a row: $0.048, $0.033, $0.026. Pro gets the Phosphor White border; its "Choose Pro" button is the one lime element in this viewport. Prices roll with the odometer treatment (section 6) on interval change.
- The receipt calculator (the Cerebrium borrow, truthful version): inputs Plan (select), Interval (the same switch), Submitted this cycle (range 0 to the plan allowance, step 10), Failed this cycle (range 0 to 50). Outputs as ledger rows: Plan charge (fixed: the plan price), Credits used (= submitted), Failed submits ($0.00, always), Credits remaining (= allowance − submitted), Cost per submitted application at your volume (= price ÷ submitted, shown as "n/a" at 0). Pure function, no network. Result changes tween over 240ms with `cubic-bezier(0.22, 1, 0.36, 1)`; instant under reduced motion. Help text beneath, in Sage 40 on Void: "Unused credits roll over up to two invoices' worth." (PRC rollover, help text only, as the facts sheet allows.)
- Footnotes in Body size, left-aligned: "Launch prices. They may change for new customers. Existing subscribers keep their price for at least 90 days after any change, with 30 days' notice." and "Billing is in US dollars through Stripe. Cancel any time from the Stripe customer portal; access runs to the end of the paid period." No INR, no refund promise beyond failed submits.
- Settlement: "Settles 06. Every charge has a row, and you can read all of them." Row 06 flips.

### 10 "Side by side" (entry 09): comparison with auto-apply tools

- Title: "How it compares with what people report." The "typical" column is rewritten so every cell is a reported complaint from PRD, not a claim about a named product (fixes C5):

| | People report with other tools | Kairos |
| --- | --- | --- |
| Which jobs get applications | Matches that do not fit | Only jobs that pass your hard rules and fit bar, with a written reason for each skip |
| Resume changes | Skills and metrics the person does not have | Each line cites a fact you confirmed |
| Before it sends | A review step without an edit step | Edit every field and line, then approve one or a batch |
| Replies | Broad Gmail access | A forwarding address you control |
| What you pay for | Charges after cancelling and lost credits | One credit per submission that went through. Failed submits cost nothing. Cancel from the Stripe portal any time |

- Table semantics kept (`thead`, `th scope`). Circuit Border rules, no zebra. The left column text sits in Sage 60; the Kairos column in Phosphor White. Below 768px the table keeps its `<table>` element inside the one sanctioned horizontal scroll container (`min-width: 560px`), with a 24px fade at the right edge as the affordance.
- No motion in this section beyond the entry rule draw. The receipt canvas is paused and hidden here (section 3).

### 11 "Questions" (entry 10): FAQ

- Native `<details>` list (reuse `faq-list.tsx`). Title: "What people ask before signing up." The five KEEP questions, with A3 corrected: "No. Tailored lines must cite facts from your confirmed profile. A line that cites nothing cannot be saved; the editor lists it so you can fix or remove it." A2 ("We do not promise it is undetectable; we make sure it is something you would have sent yourself.") is set in Phosphor White rather than Sage 60, because it is the page's strongest honesty line.
- Each `<summary>` is a 56px row with the question in Inter 16px 500 and a 1px rule; the open state changes only colour (300ms). No icon rotation.

### 12 "Start" (entry 11): closing call to action

- Title (CTA band, KEEP): "Try it on 25 real applications." Body: "Every application waits for your approval." ("No card" withheld pending confirmation.) Lime pill: "Start free". This is the one lime element; the navbar reverts to Default while it is visible.
- The receipt returns (pose P7) as a fresh slip with the header and one line: `11 · +25 · free submissions · do not expire`. That line is the AC1 ledger entry a new account receives, and the PRC rule that the free grant never expires.

### Footer: the colophon

- Four link groups from `siteConfig.footer`. Above them, a perforated hairline (the only dotted rule on the page besides the receipt itself).
- Colophon lines in Sage 60: "Page facts checked against the product documents on 2026-10-15." and "Prices on this page are launch prices." The "Motion: Full / Reduced" toggle (a real `<button aria-pressed>` pair) sits here and in the receipt lane's control row.
- A one-line definition in Deep Fern, decorative, carrying no claim: "kairos: the right moment, as against the clock." Deep Fern is allowed here because the brief reserves it for non-essential footer microcopy.
- Legal links to the existing `/terms`, `/privacy`, `/cookies`, `/refunds` routes.

### The ledger rail (1280px and wider)

A fixed rail at the left gutter, 12 entries of 28px each, each an `<a href="#entry-NN">` with the two-digit number in Caption style and the entry title revealed on hover or focus. The active entry is set by an `IntersectionObserver` with `rootMargin: "-45% 0px -45% 0px"`; its number turns Phosphor White and a 6px square (0px radius) fills beside it. `aria-current="true"` on the active link. Hidden below 1280px; the navbar's "Entry NN" caption and the mobile receipt tape (section 7) take over.

---

## 3. The single WebGL centerpiece: the receipt

### 3.1 What it is

One thermal-paper receipt slip, the proportion of 80mm paper: a plane 1.6 world units wide by 3.6 tall (so 2.25:1), subdivided 32 by 96 so it can bend gently and tear. It has a perforated top stub 0.5 units tall separated by a dotted perforation, a ruled body with 32px-equivalent line spacing (0.21 world units at the hero scale), and a torn bottom edge whose silhouette is a fixed noise profile baked into the alpha texture. Nothing else is in the scene: no particles, no environment, no floor, no second object. Camera: perspective, fov 35, at z = 6 looking at the origin.

Stack: vanilla three 0.186.1 behind a 60-line Client Component, loaded with `next/dynamic` and `ssr: false` from a client wrapper after `load` and idle (2s timeout), never before LCP, per the feasibility file's default recommendation. R3F 9.8.2 remains the approved alternative; nothing in this concept requires it. One fixed canvas, `position: fixed; inset: 0; height: 100lvh; pointer-events: none; z-index: 0`, rendered only when dirty from the shared `gsap.ticker`.

### 3.2 How it looks within the phosphor palette

- The paper is Phosphor White `#ddffdc` as an emissive surface: `emissive = #ddffdc`, `emissiveIntensity = 0.32`, base colour `#181818` (Ground Iron), roughness 0.92, metalness 0. The paper therefore glows from within at the brightness of a dim CRT, and it never exceeds the colour it is printed in. There is no bloom, no post-processing pass, no additive blending and no halo: "emissive, never neon" is implemented by the absence of any pass that spreads light beyond the surface.
- Lighting: one hemisphere light (sky `#1f2a33` Phosphor Blue-Black, ground `#000000`, intensity 0.6) and one directional light from the upper left (`#ddffdc`, intensity 0.35) so the bend reads as paper. Renderer `toneMapping = NoToneMapping`, `outputColorSpace = SRGBColorSpace`.
- Print: a `CanvasTexture` 1024 by 2304 px (RGBA, under the 2048-per-side limit on the long edge is not possible at this ratio, so the texture is 1024 by 2048 with the paper UV mapped to the top 2304/2304 crop; implementation detail: use 1024 by 2048 and map the full plane to it, the paper is 2.25:1 so the texture is 2:1 and the printed region never exceeds the plane). The 2D canvas draws the printed lines in Inter 400 at 44px (tabular numerals, slashed zero) in Void `#000000` on a transparent background, so the paper's own emissive colour shows between letters. Each posted line updates the texture once (`needsUpdate = true`), which is one 2D draw per section, not per frame.
- The print head: a uniform `uPrintY` clips the texture so that only lines above it are visible; a 0.03-unit band below `uPrintY` is darkened 18% to read as the thermal head's heat. When a line posts, `uPrintY` tweens down by one line height over 420ms with `power3.out` (GSAP's built-in curve closest to `cubic-bezier(0.22, 1, 0.36, 1)`), and the whole slip advances upward by the same distance over 520ms. That is the only time-based motion in the scene, and it ends.
- Edge treatment: the perforation is a row of alpha holes 1px wide at 4px spacing in the texture. The torn edge is the alpha silhouette. Fine lines are the reason `antialias` is off and the DPR formula rounds to 0.25 steps (feasibility 7.2).
- Shadows: none. The slip never casts or receives one; depth is read from the bend and the emissive falloff on the curved paper.

### 3.3 Pointer response (fine pointers only)

When `(hover: hover) and (pointer: fine)` matches and the tier is 2, the slip rotates toward the pointer by at most 6 degrees on y and 3 degrees on x, approaching the target with a per-frame lerp factor of 0.06. On touch devices there is no pointer response. There is no idle sway, no breathing and no rotation loop: a receipt sits still. This also means WCAG 2.2.2 needs no pause control for the scene (nothing moves for more than 5 seconds on its own), but the page still ships the Motion toggle.

### 3.4 State by section

The scene reads one object `state = { entry, local, approved }` written by per-entry ScrollTriggers (`start: "top 55%"`, `end: "bottom 55%"`, `scrub: true`, `refreshPriority` = entry index). Poses are interpolated with `smoothstep` across the entry's local progress and then approached with a lerp of 0.12 per frame on desktop so wheel steps feel like paper, not a slideshow. Positions are world units; rotations in degrees (x, y, z).

| Pose | Entries | Position | Rotation | Scale | Opacity | What prints |
| --- | --- | --- | --- | --- | --- | --- |
| P0 Hero | 00 Open | (1.9, 0.1, 0) | (6, −14, 2) | 1.00 | 1.0 | Header and `00 · Ledger opened` on load, after the H1 reveal finishes (900ms after first paint) |
| P1 Recede | 01 Reported | (2.6, 0.6, −0.8) | (4, −24, 0) | 0.80 | 0.7 | Nothing. The DOM posts the six debits |
| P2 Posting | 02 Fit gate, 03 Truth lock, 04 Review, 05 Send | (2.1, 0.0, 0) | (3, −10, 0) | 0.92 | 1.0 | One line per entry at local 0.35; the slip advances one line height each time. Entry 04 prints the approve stamp on click (section 4.5) or `Awaiting your approval` at local 0.85 |
| P3 Approach | 06 Receipt, local 0.00 to 0.45 | to (0.9, 0.2, 0.6) | to (0, 0, 0) | to slot size | 1.0 | `06 · Receipt saved · open it any time` |
| P4 Hand-off | 06 Receipt, local 0.45 to 0.60 | matches `[data-slot="receipt"]` | (0, 0, 0) | slot | 1.0 to 0.0 | The canvas slip cross-fades out over the DOM `<table>` which fades in; 400ms, opacity only. From here the table is the authoritative content |
| P5 Tear | 06 Receipt, local 0.80 to 1.00 | body falls to y = −4.5 | body gains (0, 0, −9) | 1.0 | body 1.0 to 0 | The perforation splits: vertices below it follow a gravity curve `cubic-bezier(0.55, 0, 1, 0.45)` over 700ms; the stub stays |
| P6 Stub | 07 Replies, 08 Billing | (2.3, 0.4, 0) then docks into `[data-slot="ledger-stub"]` | (0, 0, 0) | 0.90 then slot | 1.0 | `07 · Reply tagged to this application`, then `08 · −1 credit · receipt kept` |
| Hidden | 09 Side by side, 10 Questions | off screen | | | 0 | Renderer stops invalidating; the canvas is `visibility: hidden` |
| P7 Fresh | 11 Start | (1.9, 0.1, 0) | (4, −10, 0) | 1.00 | 1.0 | A new slip with the header and `11 · +25 · free submissions · do not expire` |

Hand-off mechanics (the Oryzo borrow): each slot `<div data-slot>` is measured with `getBoundingClientRect()` on `ScrollTrigger.refresh` and on resize; the rectangle is converted to normalised device coordinates and unprojected at the slip's depth to a world position and scale. The slip is always `aria-hidden`; a visually hidden `<ol id="receipt-lines">` in the DOM mirrors every printed line from the same data array, and the entry 06 table is the readable version, so screen reader and no-JS users get the identical ledger.

Scrolling upward: the slip moves back through its poses, but printed lines never un-print. A ledger is append-only, and the texture is cheap to leave as it is. On a reload mid-page, lines up to the current entry print at once with no sweep.

### 3.5 Load sequence

1. Server HTML renders the hero text (the LCP element) and a poster of the slip in pose P0 as an `<img>` (AVIF about 40KB, WebP fallback) inside the fixed wrapper, with `fetchpriority="low"` and `decoding="async"`.
2. After `load` and `requestIdleCallback` (2s timeout), the tier probe runs (section 7). Tier 0 ends here; the poster stays.
3. Tier 1 or 2: the WebGL chunk loads, the renderer builds, `renderer.compileAsync` finishes, then the canvas cross-fades over the poster in 600ms (opacity only). The first printed line follows.
4. `webglcontextlost` with `preventDefault()`: stop rendering and show the poster. One restore attempt; a second loss pins the page to tier 0 for the session (`sessionStorage`, try/catch).

---

## 4. Signature interactions

### 4.1 The print head (scroll)

Trigger: each entry's ScrollTrigger reaches local progress 0.35 (the title has crossed 55% of the viewport). Effect: the receipt prints that entry's line (section 3.2) over 420ms while the slip advances 520ms; in the DOM, the entry's number posts (appears at once) and its ledger rule draws from left to right (`transform: scaleX(0) to scaleX(1)`, `transform-origin: left`, 600ms, `cubic-bezier(0.22, 1, 0.36, 1)`). On the mobile receipt tape (section 7) the new line slides up into the 48px strip with the same curve. Direction: posting happens on downward entry only; upward scroll never reverses a post. Reduced motion: the line appears at once, the rule is already drawn, nothing sweeps. Cost: one 2D canvas draw and one texture upload per entry; zero per-frame JavaScript per line.

### 4.2 The fit line (drag, keyboard, select)

Base: three native controls (Seniority select, Needs sponsorship radios, Locations multi-select) and a fit bar `<input type="range" min="50" max="95" step="5" value="70">` with `aria-valuetext="Fit bar 70. Showing 4 of 8 sample jobs"`. Enhancement on fine pointers: a horizontal hairline across the stacked cards that the visitor can drag vertically (`cursor: row-resize`), which writes to the same range input so there is one source of truth. Effect: cards that fail a hard rule or fall below the bar translate 8px right and dim to 50% over 300ms (`power2.out`), and a reason chip prints in Caption style with the documented reason text. Cards that pass stay at full brightness with the word "kept". Count announced through a polite live region, debounced to 400ms so a drag does not chatter. Hard rules are evaluated before the fit bar in the demo's code, in the same order as the product, and the card shows "dropped before scoring" for hard-rule drops, which makes the "never costs a model call" claim visible. All data is a 30-line array with a `SAMPLE DATA` tag on the card.

### 4.3 The citation thread (hover, focus)

Trigger: pointer over, or keyboard focus on, a tailored resume line in entry 03. Effect: every fact that line cites brightens from Sage 60 to Phosphor White over 300ms; a 1px SVG path (Phosphor White at 60%) draws from the line's chip to each fact over 300ms using `stroke-dasharray` and `pathLength="1"` (CSS only, no DrawSVG plugin). The line's chip gains a 1px Phosphor White border. Leaving or blurring reverses the colour change over 300ms and removes the path at once. Accessibility: each line is a `<button aria-describedby="fact-07 fact-11">` so screen readers announce the cited facts; the SVG is `aria-hidden`. Reduced motion: colour change still happens (300ms colour is utility motion, which the brief allows); the path appears without drawing. The one line that "cites nothing" is not focusable as a thread; it carries the status word "not saved" in `--warn`.

### 4.4 The lime carry (scroll, observed)

Rule: exactly one `[data-lime]` element is lime at any time. Candidates, in priority order: the hero CTA (entry 00), the Approve button (entry 04), the "Choose Pro" button (entry 08), the closing "Start free" (entry 11), and last the navbar "Start free". Mechanism: one `IntersectionObserver` with threshold 0 over the four in-page candidates; a tiny store holds `limeOwner`. When a higher-priority candidate is intersecting, it owns the fill and the navbar button is a Default button; when none is intersecting, the navbar owns it. Transition: colour and background-colour only, 300ms ease-out, as the brief's hover rule already prescribes; no scale, no glow. Edge handling: ownership changes only on an observer callback where the previous owner reports `isIntersecting: false`, so two lime elements never coexist for longer than one frame of colour transition, and the transition starts from Ground, so at no frame are two elements at full lime. Reduced motion: instant swap. Verification: a Playwright check counts visible lime fills at twelve scroll positions and fails on any count other than 1.

### 4.5 Approve, and the time stamp (click)

Trigger: the Approve button in entry 04 (lime, 48px, the only lime element in view). Effect: the button becomes a Default button reading "Approved · sample" (disabled with `aria-disabled`, 50% opacity per the brief); the receipt prints `04 · Approved by you · 2026-10-15 14:02` where the date and time come from `new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })` in the click handler; the entry 01 row 02 flips to "settled in 04" with the same stamp in its Note cell; a polite live region says "Approved. Sample receipt updated." The stamp is formatted in the visitor's locale and zone, which is the kairos idea in one gesture: the moment is recorded, not counted. It is the only click-triggered change in the centerpiece, and the only place a visitor's own data appears on the page. If the visitor scrolls past without pressing, the receipt prints `04 · Awaiting your approval` at local progress 0.85 and the button stays live; pressing it afterward still updates the row and the live region, and prints the stamp as a new line (append-only).

---

## 5. The Kairos signature motif system: the posted line

Everything on the page is a line that has been posted, or is about to be. The motif has six expressions, and no new hue: every landing-only token below is a shape, rhythm or timing, so the brief's palette is untouched.

| Expression | Specification | Where |
| --- | --- | --- |
| Entry numbers | Two-digit tabular numerals in Caption style (Inter 12px, 500, +0.6px tracking, Moss 70), followed by a 1px Circuit Border rule that runs to the right edge of the container. The number is the first thing in every section, every receipt line and every ledger row | Section headings, the rail, receipt lines, ledger rows, the problem list |
| Signed, slashed numerals | `font-variant-numeric: tabular-nums slashed-zero` on every number (Inter's `tnum` and `zero` features). Quantities always carry a sign or a unit: `+25`, `−1`, `$0.00`, `0 guessed`, `14 of 14`. The slashed zero makes `$0.00` and `0 guessed` unmistakable and is a quiet tell that the whole site shares | Pricing, ledger, receipt, calculator, the fit count |
| Ledger rules and rhythm | Horizontal 1px Circuit Border rules on a 32px vertical rhythm inside tables, lists and the receipt (`--rule-rhythm: 32px`). Section dividers use Phosphor Blue-Black. One perforated rule (`1px dotted`, 4px period, `--perforation`) is used twice only: on the receipt and above the footer | All tables, the receipt, the footer |
| The posting square | A 6px square, 0px radius (the same geometry as the logo mark), Phosphor White when posted, outlined in Circuit Border when pending. It marks the active rail entry, a settled debit row and a kept job card, always beside a word (settled, kept, posted), never alone | Rail, entry 01 rows, fit gate cards |
| Citation and sample chips | Pill, 4px 12px padding, Inter 12px 500, transparent with 1px Circuit Border. Two texts only: `cites fact #NN` and `SAMPLE DATA`. The sample chip sits top-right of every demo without exception | Entry 03 lines, every demo card, the receipt header |
| Time stamps | `YYYY-MM-DD HH:MM` in Caption style, always a record (approved at, checked on), never a countdown. Real dates are real (the colophon's 2026-10-15); sample stamps sit under a sample chip | Receipt, ledger, colophon |

Cursor: native everywhere. The one cursor change is `row-resize` on the fit line handle. No follower, no custom glyph.

Transitions: the motif's motion vocabulary is three moves and nothing else. Post (a rule draws left to right, 600ms, `cubic-bezier(0.22, 1, 0.36, 1)`); print (the receipt head sweeps, 420ms, same curve); tear (the one gravity move, 700ms, `cubic-bezier(0.55, 0, 1, 0.45)`). Hover and focus are colour only at 300ms ease-out. Body text has no entrance animation anywhere; it is simply there, because a ledger does not fade in. This restraint is deliberate and is the counter to the "fade-up on everything" cliché the Awwwards research flags.

Landing-only tokens, named and justified:

| Token | Value | Justification |
| --- | --- | --- |
| `--rule-rhythm` | `32px` | The ledger line height; equals the brief's 32px spacing step |
| `--perforation` | `1px dotted var(--border)` with `background-size: 4px 1px` for the dotted pattern | The tear motif; uses the existing Circuit Border colour |
| `--ease-post` | `cubic-bezier(0.22, 1, 0.36, 1)` | One decelerating curve for post and print, so every landing move shares a rhythm |
| `--ease-tear` | `cubic-bezier(0.55, 0, 1, 0.45)` | The single accelerating curve, used once, for gravity |
| `--dur-post`, `--dur-print`, `--dur-tear` | `600ms`, `420ms`, `700ms` | Named so reduced motion can zero them in one rule |
| `--receipt-lane` | `span 5` of 12 columns at 1024px and wider | Layout only |

No new colours. The receipt's emissive paper is Phosphor White, its print is Void, its stub docks on Ground.

---

## 6. Typography moves for display type

Faces per the brief: Inter Tight 400 and 500 for display and headings with `ss01`; Inter 400 and 500 for everything else with `cv11`; `tnum` and `zero` on numerals (section 5). Weight 500 appears only on buttons, nav links, card titles and the FAQ questions. All text is left-aligned.

| Role | Size | Line height | Tracking | Behaviour |
| --- | --- | --- | --- | --- |
| Display (hero H1) | `clamp(40px, 24px + 3.2vw, 64px)` (40 at 390px, 64 at 1280px and up) | 1.0 | −0.007em | Line reveal: each line is a `<span>` inside an `overflow: hidden` wrapper; `translateY(105%)` to `0`, 700ms, `--ease-post`, `animation-delay: calc(var(--i) * 70ms)`. Built with SplitText 3.13 `mask: "lines"` and `autoSplit: true` so a late font swap re-splits cleanly; the H1 keeps its text content and SplitText adds `aria-hidden` to pieces. The signature underline under "sign." draws 600ms after the last line. Under reduced motion the H1 is static from first paint |
| Heading large (entry titles) | `clamp(30px, 20px + 1.75vw, 42px)` | 1.05 | −0.008em | Same line reveal, triggered by the entry's post (section 4.1), one or two lines only. Static under reduced motion |
| Pricing numerals | 42px, Inter Tight 400, `tnum zero` | 1.0 | −0.008em | Odometer on interval change: each digit sits in a fixed-height column and moves by `translateY` 360ms `--ease-post`; columns are `aria-hidden`, one visually hidden text node holds the final value, and a polite live region announces "Starter, 6 dollars per week" once after the roll. Instant text swap under reduced motion |
| Subheading (hero subhead, card titles) | 20px | 1.5 | −0.018em | No motion |
| Body | 16px, max 65 characters per line | 1.5 | −0.022em | No motion, ever |
| Small (tables, buttons, labels) | 14px | 1.43 | −0.026em | No motion |
| Caption (entry numbers, eyebrows, stamps) | 12px, uppercase for eyebrows only; entry numbers and stamps keep case | 1.33 | +0.05em | Appears at once when posted |
| Receipt print (in the texture) | 44px on the 1024px texture, which reads as about 14px on screen at the P2 scale | 32px rhythm | 0 | The print head sweep (section 3.2) |

Two kinetic moments only, hero and entry titles, plus the odometer on an explicit user action. Kinetic type is confined to lines, never letters, so screen readers and crawlers read whole sentences, and the H1 is the LCP element at first paint (never `opacity: 0` before JavaScript).

---

## 7. Mobile, reduced motion and low-end device stories

### 7.1 Mobile (below 1024px), designed as its own composition

- One column, 16px gutters (`Container` already provides this), no horizontal page scroll. The receipt lane disappears; there is no WebGL below 1024px at all, which is a decision, not a fallback: the phone version is not the desktop canvas shrunk.
- Hero: H1 at 40px, subhead 18px, the two CTAs stacked full width (48px tall), then the receipt poster as a static image 240px tall with the caption "Sample receipt. It prints as you read."
- The receipt tape: from entry 02 onward, a 48px strip pinned under the navbar (`position: sticky; top: 64px`), Ground fill, 1px Circuit Border bottom, showing the latest posted line in Inter 14px with its entry number. A new line slides up into the strip (600ms, `--ease-post`) when its entry posts; built with `@scroll-timeline`-free CSS (a class toggled by the same IntersectionObserver the rail uses) so it needs no GSAP on phones. Tapping the tape opens a native `<dialog>` listing every line posted so far (the same `<ol>` the desktop hides visually), with `data-lenis-prevent`. The tape is the mobile signature, the equivalent of Lando Norris's separately credited mobile element.
- Entry 06: the receipt `<table>` is the centerpiece on phones, full width, rows at 44px. The tear is replaced by the table's last row, "Credit · −1 · charged once", carrying the posting square.
- Demos: the fit gate's native controls stack; the drag line is not offered (coarse pointer), the range input is. The citation thread responds to tap (focus) and shows the connecting path only when the line is focused. Touch targets are 44px minimum, 8px apart.
- Pricing: plan cards stack; the interval switch is a 44px segmented control; the calculator sits below the cards.
- Lenis: `syncTouch: false`, so phones keep native momentum; Lenis only syncs ScrollTrigger. On phones the scroll-driven work is the tape, the posts and the rail-less active entry caption in the navbar.
- 768px to 1023px: the same one-column composition with 24px gutters and the poster at 320px tall.

### 7.2 Reduced motion (tier 0 by preference)

Triggered by `prefers-reduced-motion: reduce` or the page toggle (`data-motion="reduced"` on `<html>`, set by a 12-line inline script before first paint from `localStorage` in try/catch, so there is no flash). Lenis disables smoothing itself (`respectReducedMotion` default). GSAP work is wrapped in `gsap.matchMedia()` with the condition `(prefers-reduced-motion: no-preference)` plus a check on the `data-motion` attribute, so nothing scroll-linked is created, and `gsap.matchMediaRefresh()` runs when the toggle changes.

| Element | Reduced motion behaviour |
| --- | --- |
| H1 and entry titles | Static text, final position |
| Entry rules | Already drawn |
| Receipt (desktop) | The WebGL chunk is never downloaded. The poster shows in pose P0 for the hero; from entry 02 the lane shows the DOM receipt `<ol>` fully printed up to the current entry, updated instantly as entries enter |
| Lime carry | Instant swap, no transition |
| Fit gate, calculator, odometer | Instant state changes; live regions still announce |
| Citation thread | Colour change only (300ms is utility motion the brief allows); path appears without drawing |
| Tape (mobile) | Text swaps instantly |
| View Transitions on route change | `animation-duration: 0s` on the old, new and group pseudo-elements |

Everything readable, every control usable, same content and order. A Playwright check with `prefers-reduced-motion: reduce` asserts no `<canvas>` exists and all landing text is present.

### 7.3 Low-end devices (tiers 1 and 0 by capability)

Tier probe after idle (feasibility section 8): `webgl2` with `failIfMajorPerformanceCaveat: true` (null means tier 0), `saveData` (tier 0), `deviceMemory <= 2` or 4 cores or fewer on a coarse pointer (tier 1), `MAX_TEXTURE_SIZE < 4096` (tier 1), then a 45-frame runtime sampler: median above 24ms steps down a tier; at tier 1, median above 34ms or a third step-down in a session goes to tier 0 and unmounts the stage. Final tier persisted in `sessionStorage` (try/catch). No step-up within a session.

| Tier | Receipt experience |
| --- | --- |
| 2 Full | DPR up to 2 within a 2.1 MP drawing buffer, 60fps cap, pointer response, paper bend (32 by 96 plane), 1024 by 2048 texture |
| 1 Lite | DPR 1 within 1.0 MP, 30fps cap, no pointer response, flat plane (2 by 6 segments, so no bend; the tear becomes a straight split along the perforation with the same curve), 512 by 1024 texture, the hand-off crossfade shortened to 240ms |
| 0 Static | Poster plus the DOM receipt list, exactly as reduced motion, while the rest of the page keeps its DOM motion unless the user also prefers reduced motion |

Context loss: `webglcontextlost` with `preventDefault()`, poster shown, one restore, then tier 0 for the session. Resize: the renderer re-sizes only on width change or a height change over 25%, with `100lvh` so the address bar collapse does nothing.

---

## 8. Performance approach, top risks and how each is retired

### 8.1 Approach

- Architecture: Server Components by default. Client islands: `SmoothScroll` (Lenis plus the single `gsap.ticker` clock), `EntryScrubber` (one per entry, ScrollTrigger plus the post), `HeroType` (SplitText), `StageLoader` and `Stage` (the receipt), `FitGate`, `CitationThread`, `ApproveSample`, `LimeCarry`, `ReceiptCalculator`, `PricingPlans` (existing), `Navbar` (existing). Page exports `ensureStatic = 'navigation'`.
- Dependencies, pinned exactly per the feasibility file: `gsap@3.15.0` (core, ScrollTrigger, SplitText), `@gsap/react@2.1.2`, `lenis@1.3.26`, `three@0.186.1`, `@types/three@0.186.0`. Not added: drei, postprocessing, motion, detect-gpu, any Rive or Lottie runtime. R3F stays an approved fallback only.
- Budgets (gzip, verified with the Turbopack Bundle Analyzer on the first build): landing initial JS excluding framework 70KB or less; lazy WebGL chunk 140KB or less; fonts two files (about 33KB Inter Tight 400/500, about 48KB Inter 400/500), only the display face preloaded; poster 40KB AVIF; total transfer under 1.0MB. Core Web Vitals internal goals: LCP 1.5s, CLS 0.05, INP 100ms (official good thresholds 2.5s, 0.1, 200ms remain the floor).
- Render policy: one clock (Lenis raf, then ScrollTrigger update, then the stage if dirty), `lagSmoothing(0)`, dirty flag on scroll delta over 0.0005, pointer move while hovering, print in progress, or resize. At rest the GPU does nothing. The canvas pauses when off screen, when `document.hidden`, and across entries 09 and 10.
- Texture updates: one 2D draw and upload per posted line (at most 12 per visit), never per frame. Shader uniforms carry pose and `uPrintY`; no per-vertex JavaScript.
- LCP protection: the H1 is server HTML at full opacity; the poster `<img>` has `fetchpriority="low"`; the WebGL chunk loads after `load` and idle with a 2s timeout.
- Fonts: `next/font/google` self-hosted, `display: "swap"`, `adjustFontFallback` default; SplitText `autoSplit` re-splits on font load.
- Cleanup for Cache Components Activity: Lenis, ticker callbacks, ScrollTriggers, matchMedia listeners and the renderer are created in effects and destroyed in cleanup (`useGSAP` handles the GSAP part; the stage calls `dispose()` and `forceContextLoss()`); `ScrollTrigger.refresh()` on re-show.
- Verification kept small (one runnable check per guarantee, per the ponytail rule): Playwright for the lime count at twelve positions, reduced motion with no canvas, WebGL-disabled poster, and a copy lint that greps `components/landing` for em dashes, the banned-word list and the string "No card".

### 8.2 Top risks and retirements

| # | Risk | How it is retired |
| --- | --- | --- |
| 1 | Printed text on the receipt is illegible or shimmers at DPR 1 | Texture at 1024 by 2048 with 44px glyphs; `LinearMipmapLinearFilter`, anisotropy 4; DPR rounded to 0.25 steps; the slip is flat (rotation 0) whenever it carries lines the visitor must read, and the DOM table is authoritative from P4 onward. Test on a 1080p display at DPR 1 before lock |
| 2 | The centerpiece hurts LCP or counts as LCP itself | H1 is server HTML at opacity 1; the fixed canvas starts at opacity 0 and full-viewport elements are ignored by LCP anyway; the chunk loads after idle. Lighthouse in CI with a 1.5s LCP budget on a throttled profile |
| 3 | Two lime elements visible at once during the carry | Single `limeOwner` store, transitions start from Ground, ownership flips only after the prior owner reports not intersecting; the twelve-position Playwright count |
| 4 | Sample data is read as real output (the match-preview problem the facts sheet found) | `SAMPLE DATA` chip on every demo; no company names, no fit scores outside the labelled fit gate, no outcome numbers anywhere; facts typed by kind not content; "Not measured by us" on the complaints; copy lint for banned patterns |
| 5 | Build status of the extension, cloud applier and reply tracking is not confirmed and the page says "fills" in present tense | Launch checklist item with alternative wording per claim ("in beta"); the page carries a dated colophon so a later correction is visible |
| 6 | Smooth scroll fights keyboard, anchors or find-in-page | Lenis keeps native scroll, `anchors: true`, `respectReducedMotion` default, `data-lenis-prevent` on the dialog and selects; no pinned sections at all (the only sticky element is the fixed canvas and the mobile tape), so the page is plain document flow |
| 7 | The page reads as a Lando Norris or Modal clone (lime on near-black) | Form differs: a receipt object, slashed-zero signed numerals, perforation, posting squares, the ledger rail, and motion that ends. A side-by-side review against both sites is a design-lock gate |
| 8 | The tear and hand-off break on resize or when fonts shift layout | Slots measured on `ScrollTrigger.refresh` and resize; `ignoreMobileResize: true`; `100lvh`; the hand-off is opacity only so a one-frame mismatch is invisible |
| 9 | Low-end phones stutter on DOM posts | No WebGL below 1024px; posts are class toggles with CSS transforms; `content-visibility: auto` on entries 09 to 11; the tape is one element |
| 10 | GSAP licence or three minor-version drift | Exact pins; the licence text and fetch date stored in the repo; `npm ls three` single copy check |
| 11 | Visitor's local time stamp breaks prerendering | Time read only inside the click handler, never in render; `ensureStatic = 'navigation'` fails the build if anything dynamic leaks in |
| 12 | Awwwards jurors mark the page down for "too quiet" | Creativity is carried by one unmistakable object doing one unmistakable thing (printing, being signed, tearing, becoming a ledger row) plus the fit line and the citation thread. The restraint is the idea; the case is made in section 9 |

---

## 9. The case for each Awwwards criterion

**Design (40%).** A strict two-colour system (Phosphor White on Void, lime only as the single action) with a complete type scale in Inter Tight and Inter at two weights, every size and tracking specified, numerals tabular with slashed zeros, and a 32px ledger rhythm that runs through tables, lists, the receipt texture and the rail. The receipt is lit like paper, not like a screen, and its emissive paper is the same hex as the headings, so the 3D object and the typography are visibly one system. Hairlines carry structure instead of shadows. The page has one object, three motion moves and no decoration, which is where the sampled winners with the highest Design sub-scores (Lando Norris 8.12, MindMarket 8.09, Ai in Design Report 7.66) sit: strict palette, custom rhythm, one signature.

**Usability (30%).** The weakest jury score among winners (mean 7.40) and the clearest opening. Every demo has a native-control base (selects, radios, range, buttons, `<details>`, `<dialog>`) with pointer effects as enhancements; every interactive element keeps a visible 2px Phosphor White focus ring; live regions announce counts and state; the receipt is `aria-hidden` with a DOM mirror and an authoritative table; there are no pinned or hijacked sections, native scroll and anchors survive Lenis, the mobile layout is its own composition with 44px targets and a persistent receipt tape, and the Motion toggle is a real control in two places. Reduced motion is a first-class tier with identical content. The lime carry means a first-time visitor always sees exactly one green thing, which is always the next action. A dev-jury Accessibility score above the sample ceiling of 7.60 is a stated target, and the Playwright checks make it measurable.

**Creativity (20%).** The signature is not an effect but a behaviour: a receipt that prints itself as you read, is signed with your own clock, tears, and becomes the first row of the bill. The six-debit ledger that the page settles entry by entry, and openly leaves one unsettled, is a narrative structure no competitor uses (all six reviewed sites use problem, features, testimonials, pricing). The fit line turns the product's core rule into a thing you drag; the citation thread turns truth lock into a thing you can see. Scoring context: WebGL helped the top Creativity scores in the sample (Oryzo 8.35, Lando 8.71), and here the WebGL moment is confined to the one place where the page explains its mechanism, which is the Razorpay principle ("when everything around a moment is calm, motion becomes meaningful").

**Content (10%).** Every sentence is a mechanism, a rule, or a labelled sample, with the strongest line on the page a refusal: "We cannot promise interviews, and we will not print a number we have not measured." Prices are complete, dated, with per-application math and a calculator built from `docs/pricing.md`. The comparison table attributes every "other tools" cell to user reports. The FAQ states what the product does not do (LinkedIn, undetectability, Gmail). Winners with concrete, short declaratives (Terminal Industries 7.57, Cerebrium 7.55) score well on Content; this page goes further by refusing the baseline-free percentages that the research flagged on Terminal Industries and the fake reviews on Oryzo. For a pre-launch product, honesty is not only the brand; it is the only content that is true.
