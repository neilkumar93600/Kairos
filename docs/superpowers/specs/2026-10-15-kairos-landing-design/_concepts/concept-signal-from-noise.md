# Concept: Signal from Noise

Kairos landing page creative direction. Date: 2026-10-15. Status: concept for review, one of several competing directions.

Inputs read for this concept: `docs/04-ui-ux-brief.md` (tokens, components, accessibility), `_research/facts.md` (claims and do-not-claim list), `_research/awwwards-references.md` (jury data, techniques, tier model), `_research/competitor-landings.md` (white space), `docs/01-prd.md` (acceptance criteria), `docs/03-app-flow.md` (flows), and `server/src/services/fit.ts` (the real hard-filter function and its reason strings).

Skills applied as guidance: `anthropic-skills:3d-scroll-website` (sticky canvas storytelling, RAF and ref-based hot updates, preload discipline, DPR-aware sizing, build order), `motion-graphics` (motion is the message, deterministic timelines, asset-first planning; its video render pipeline does not apply to a web page), `ui-ux-pro-max` (accessibility first, 44px touch targets, 150 to 300ms micro-interactions, reduced motion, one primary action per view). All three loaded.

---

## 1. Name and big idea

**Name:** Signal from Noise.

**Big idea (3 sentences):** Every posting Kairos reads arrives as one faint phosphor dash in a noisy field, and as the visitor scrolls, the field passes through the same hard rules and fit bar the product uses, so most dashes fall out and are filed in an orderly ledger under the written reason they were skipped. The few that remain resolve into match cards, cite confirmed facts, and then stop dead at a final gate that opens only when the visitor presses Approve. Noise becomes signal, signal waits for you, and nothing on the page is sent, counted or claimed that the page cannot show.

### Why only Kairos can own this

| Reason | Detail |
| --- | --- |
| The product's value is subtraction | Every reviewed competitor sells volume ("mass apply", "1,000+", "hundreds a week"). A page whose spectacle is postings being declined, with reasons, is the opposite of the category and only fits a fit-first product. |
| The skips are real product behavior | The reasons printed in the scene are the exact strings returned by `passesHardFilters` in `server/src/services/fit.ts`, for example "Title is more senior than you asked for" (PRD AC3) and "Posting says it does not sponsor visas" (AC4). The demo is a mechanism shown honestly, not a metaphor. |
| Dropped postings are filed, not destroyed | Showing the rejected majority as a tidy, readable ledger is the accountability brand made visible. No auto-apply tool can show its skip list, because it does not keep one. |
| The gate that waits | "Kairos" means the opportune moment, as opposed to "chronos", clock time. The field flows like clock time until the approval gate, where all motion stops and only the visitor's press moves the application forward. The name, the mechanism and the motion grammar are the same idea. |
| Honest proof by construction | The page runs a fixed synthetic sample through the same filter code at build time. Every number on screen is computed and labelled "Sample run". Pre-launch Kairos has no user counts; this page does not need any. |

---

## 2. Narrative arc

The page tells the lifecycle of one search: read, skip, score, match, cite, approve, send, receipt, reply. The competitor teardown warned against the generic "problem, three feature cards, testimonials, pricing" structure that all six competitors use; this arc follows one application instead.

### 2.1 Section map (desktop, 1024px and wider)

The canvas is one fixed, full-viewport element behind all sections. "Sticky" below means the copy panel is `position: sticky` inside a tall section, and a GSAP ScrollTrigger reads that section's progress (no GSAP pin spacers, so layout stays plain CSS).

| # | Anchor | Section | Section height | Copy panel | Canvas pose |
| --- | --- | --- | --- | --- | --- |
| 00 | `#top` | Hero | 100svh | Normal flow | P0 Ingest |
| 01 | `#noise` | The noise (problem) | 140vh | Normal flow | P1 Noise |
| 02 | `#rules` | Fit gate: your rules | 250vh | Sticky | P2 Hard gates |
| 03 | `#bar` | Fit gate: your bar, and the matches | 200vh | Sticky | P3 Score, then P4 Matches |
| 04 | `#truth` | Truth lock | 180vh | Sticky | P5 Facts |
| 05 | `#approve` | Review and approve (the kairos moment) | 120vh | Sticky | P6 Hold |
| 06 | `#send` | Send and receipt (Mint Frost band) | 3 cards at 70vh each | Stacking sticky cards | P7 Hand-off, then hidden |
| 07 | `#replies` | Replies and the offer pause | 110vh | Normal flow | P8 Echo |
| 08 | `#pricing` | Honest billing and pricing | auto (about 180vh) | Normal flow | P9 Rest |
| 09 | `#compare` | Compared with auto-apply tools | auto (about 110vh) | Normal flow | P9 Rest |
| 10 | `#faq` | Questions | auto | Normal flow | P9 Rest |
| 11 | `#start` | Closing call to action | 100svh | Normal flow | P10 Horizon |
| n/a | footer | Footer with the run ledger | auto | Normal flow | P10 holds, then hidden |

Sticky story sections: 4 (02 and 03 count as one continuous gate story, then 04, 05 and the 06 card stack). This respects the research rule of at most 4 pinned stories. Total sticky scroll length on desktop is 960vh.

### 2.2 Persistent chrome

**Navbar (all widths).** Brief spec: Carbon Veil at 85% opacity, 10px backdrop blur, 1px Phosphor Blue-Black bottom border, 64px tall. Left: the square lime logo mark (0px radius) and the word Kairos in Inter 16px 500. Center-left links: How it works (`#rules`), Pricing (`#pricing`), Blog, About. Right: "Start free".

The navbar "Start free" follows the **lime baton** rule (defined in section 5.7): it is lime only when no other lime element is in the viewport. When the hero CTA, the Approve demo button or the closing CTA is visible, the navbar button renders as the outlined button (transparent, 1px Phosphor White border), with a 300ms color transition. This fixes the three-lime first viewport found in the code inventory.

**Ledger rail (1024px and wider).** A fixed vertical index on the right edge, inside the page gutter.

| Viewport | Rail form |
| --- | --- |
| 1440px and wider | 152px wide. Each entry is a link: section number in tabular Inter 12px, then the label in Caption style, for example `02 YOUR RULES`. |
| 1024 to 1439px | 32px wide. Numbers only. The label appears in a tooltip on hover and on keyboard focus. |
| Below 1024px | Hidden. Replaced by the section sheet button (section 7.1). |

Active entry: Phosphor White text plus a 12px hairline tick to its left. Inactive: Moss 70 (`--label`). Active state comes from an IntersectionObserver with `rootMargin: "-45% 0px -45% 0px"`. Each entry is a real `<a href>` so the rail is also keyboard navigation. Lenis runs with `anchors: true` so links scroll smoothly, and instantly under reduced motion.

**Run ledger (1024px and wider).** A single Caption-style line fixed at the bottom left of the container, 24px above the viewport bottom, on Void with a 1px Phosphor Blue-Black top hairline:

`SAMPLE RUN   READ 1,200   SKIPPED 0   BELOW BAR 0   MATCHED 0   APPROVED 0   SENT 0`

Each number is an odometer (section 6.4) that advances as the story fires. `SENT` stays at 0 for the entire page, because nothing is ever sent from the landing page. `APPROVED` becomes 1 only if the visitor presses the Approve demo button. The run ledger hides while the pricing, comparison and FAQ sections are in view (they have their own numbers) and returns for the closing section. On screens below 1024px the same line appears inline at the top of each story section instead of fixed.

**Skip links.** First focusable elements on the page, visible on focus: "Skip to main content", "Skip the demo, go to pricing".

### 2.3 Section by section

Copy below is draft copy written to the tone rules: calm, exact, accountable, concrete verbs, no hype words, no em dashes. Lines marked KEEP are reused from `_research/facts.md` section 5. Placeholders in braces such as `{skipped}` are computed values from the sample run (section 3.6), never typed numbers.

#### 00 Hero

| | |
| --- | --- |
| Sees | Black canvas. On the left, the micro-label, the display statement and the subhead, left-aligned. On the right 60% of the viewport, faint dashes stream in from the left edge along three lanes for 2.4s, then stop. The run ledger's `READ` counter rolls from 0 to 1,200 in the same 2.4s. The lime CTA is the only lime element. |
| Feels | Quiet volume. A lot is arriving, and none of it is shouting. |
| Learns | What Kairos is in one sentence, and that the field is a sample run. |

Copy:

- Micro-label: `FOR NEW GRADS, OPT AND ANYONE BETWEEN JOBS` (KEEP)
- H1: "Job applications you would sign." (KEEP)
- Subhead: "Kairos reads new postings, skips the ones that do not fit and tells you why, tailors your resume only from facts you confirmed, and sends nothing until you approve it. Every submitted application ends in a receipt."
- Primary CTA (lime pill): "Start with 25 free applications" (KEEP)
- Secondary (outlined): "See how it works" (KEEP), links to `#rules`
- Microcopy under CTAs: "Credits are spent only when an application is submitted." ("No card" is withheld until confirmed, per facts.md 1.6.)
- Canvas legend chip, bottom right of the field, neutral outlined pill: "Sample run: 1,200 synthetic postings. Not live data."

The three lanes carry small Caption labels at their left edge: `GREENHOUSE`, `LEVER`, `ASHBY`. These are the supported public career boards (PRD row 1). No logos, no implied partnership.

#### 01 The noise (problem)

| | |
| --- | --- |
| Sees | The field widens to full width and thickens. Dashes tilt by up to 12 degrees in random directions. The copy column on the left is kept clear by the text-safe mask (section 3.5). The H2 "denoises" (section 6.2) as it enters. |
| Feels | Recognition. This is what a job search looks like from the inside. |
| Learns | The cost of applying by hand, and what people report about auto-apply tools, attributed as reports, no competitor named. |

Copy:

- Micro-label: `01 THE NOISE`
- H2: "Sending more was never the hard part."
- Body: "Applying by hand takes 15 to 30 minutes a form. Auto-apply tools made sending fast, and people who used them tell us what came back: matches that did not fit, resumes with skills they do not have, a review step with no way to edit, and charges after they cancelled."
- Closing line, Lead style: "Kairos starts from the other end. It decides what not to send."

Source notes: 15 to 30 minutes is PRD "Problem". The four reports are PRD competitor complaints 1, 3, 2 and 6, phrased as "people tell us".

#### 02 Fit gate: your rules (discovery and hard filters)

| | |
| --- | --- |
| Sees | Five thin vertical gate lines draw top to bottom across the field. As the visitor scrolls, the field flows left to right through them. At each gate, the dashes that fail that rule drop, rotate to horizontal and slide into a neat row at the bottom of the viewport: the skip ledger. Each row gets a DOM label with the reason string and a count. Gate labels sit at the top of each line in Caption style. |
| Feels | Relief and control. The noise is being handled, and handled visibly. |
| Learns | Hard rules run before any model. Which rules exist. That every skip has a written reason. |

Gates in order, with the real reason strings each one files under (from `passesHardFilters`):

| Gate | Caption label | Reason strings filed in this gate's rows |
| --- | --- | --- |
| G1 | `ROLE AND SENIORITY` | "Title does not match your roles", "Title is more senior than you asked for", "Title is more junior than you asked for" |
| G2 | `LOCATION` | "Location is outside your list" |
| G3 | `SALARY AND EXCLUDES` | "Posted salary is below your floor", "Company is on your exclude list", "Mentions excluded keyword "{keyword}"" |
| G4 | `SPONSORSHIP` | "Posting says it does not sponsor visas" |
| G5 | `PER-COMPANY CAP` | "You hit your per-company limit for the last 30 days" |

A posting that fails several rules drops at the first gate it fails in this order, and its probe tooltip lists every reason it failed. A footnote under the skip ledger says so: "A posting can break more than one rule. Each skipped posting keeps every reason."

Copy:

- Micro-label: `02 YOUR RULES`
- H2: "Most postings stop at your rules."
- Body: "Before any model reads a posting, Kairos checks it against the rules you set: role, seniority, location, salary floor, excluded companies and keywords, visa sponsorship, and at most 2 applications per company in 30 days. A posting that breaks a rule is skipped, and the reason is written down."
- Discovery caption (first 10% of the section): "New postings come from public career pages on Greenhouse, Lever and Ashby. Boards are checked every 30 minutes, every 5 on Max." (Build-status gate, section 8.3: polling interval is a design spec, so this line ships only once confirmed.)
- Hold caption (70% to 80% of the section): "No model has read any of these yet. Skipped postings never cost a model call."
- Sample profile disclosure (a native `<details>`): "Rules used in this sample: entry-level software engineer roles, needs sponsorship on OPT, remote or New York or Austin, salary floor $85,000, at most 2 applications per company in 30 days." These are sample settings, stated as sample.

#### 03 Fit gate: your bar, and the matches

| | |
| --- | --- |
| Sees | The survivors (about {passed} dashes) rise into a scatter whose height is their sample fit score from 0 to 100. A horizontal fit bar draws across the field with a DOM handle. Dashes below the bar dim and file into one more ledger row, "Below your fit bar". Dashes above the bar brighten to Phosphor White. Then the {matched} dashes above the bar grow into small rectangles and hand off to three DOM match cards, with a compact line "+{matched minus 3} more in this sample". |
| Feels | Agency. The visitor sets the bar and watches the result change. |
| Learns | The score comes with written reasons. The bar is the user's. Gaps are named plainly. |

Copy:

- Micro-label: `03 YOUR BAR`
- H2: "The rest face a bar you set."
- Body: "Postings that pass your rules get a fit score from 0 to 100 with up to four written reasons. Only the ones at or above your bar reach your matches. Raise the bar when your matches get noisy."
- Fit bar control label: "Your fit bar (sample)". Its value text: "Fit bar at 70 of 100. {matched} of {passed} postings kept." The number 70 is the sample's starting setting and is labelled as sample; no default bar is claimed (facts.md 1.6 removed "fit 75 of 100").
- Match card content (three cards, each labelled `SAMPLE MATCH` in Caption style, outlined neutral pill): synthetic company names in the form "Company 014" so they cannot be mistaken for real employers; a job title; the score in an outlined neutral badge "fit 82"; three reason lines, one of which names a gap plainly, following the PRD reason format, for example "Asks for Kafka; your profile mentions RabbitMQ only" (pattern KEEP from facts.md 5.2).
- Footnote: "Scores and reasons in this sample were written by us to show the format. In the product, a model writes them from your confirmed profile."

#### 04 Truth lock

| | |
| --- | --- |
| Sees | One match card moves to the left column and opens to show three tailored resume lines as a diff. On the right, the field reforms as a fact constellation: 18 small square anchors (0px radius, matching the icon rule) labelled `#01` to `#18`. Each resume line draws a 1px hairline to the fact it cites, and a citation chip "cites fact #12" snaps in beside the line. Then an interactive panel offers two candidate lines to add. |
| Feels | Safety. The resume cannot say anything the visitor did not confirm. |
| Learns | Paste once, confirm facts, every line cites a fact by number, uncited lines cannot be saved. |

Copy:

- Micro-label: `04 TRUTH LOCK`
- H2: "Every line cites a fact you confirmed."
- Body: "You paste your resume once. Kairos splits it into facts, and you confirm or remove each one. A tailored line has to cite a confirmed fact by number. A line that cites nothing cannot be saved, and the editor shows you which line and why." (Paste, not upload: facts.md 1.6. Refusal, not silent removal: PRD AC6, 422 `truth_lock`.)
- Interactive panel heading: "Try adding a line (sample)". Two choices, as native radio buttons plus an "Add line" default button:
  - "Built REST services in TypeScript for an internal billing tool" with chip "cites fact #07".
  - "Led a team of 6 engineers" with no citation.
- Result for the cited line: the line joins the diff, hairline draws to `#07`, inline success text in `--good`: "Saved. Cites fact #07."
- Result for the uncited line: the hairline extends, finds no anchor and retracts; inline error in `--bad` with `role="alert"`: "Not saved. This line cites no confirmed fact."

#### 05 Review and approve (the kairos moment)

| | |
| --- | --- |
| Sees | Everything else in the field fades to 10% opacity and stops. One kept dash, enlarged to a card, waits at a single horizontal gate line drawn across the field. The DOM shows the draft summary: resume diff count, answers, why it matched. The Approve button is the only lime element in the viewport. If the visitor scrolls on without pressing it, the card stays at the gate. |
| Feels | The pause. For the first time on the page, nothing moves. The visitor is the only thing that can move it. |
| Learns | Approval is the one decision the product hands back. Edit anything first, approve one or a batch. |

Copy:

- Micro-label: `05 APPROVE`
- H2: "Nothing moves until you approve."
- Body: "Each draft shows its resume diff, every answer and why it matched. Edit any of it. Then approve one, or a batch." (HIW step 03, KEEP.)
- Demo button (lime pill): "Approve sample draft"
- Label beside it, Small style in `--body`: "Demo. Nothing is sent from this page."
- After press: the card passes the gate in 700ms, the gate line closes behind it, and an inline line prints in `--good`: "Approved at {local time}." The time is the visitor's real local time from `Intl.DateTimeFormat` with `timeStyle: "short"`, so the only timestamp on the page is a true one. The run ledger's `APPROVED` rolls to 1. `SENT` stays 0.
- If the visitor has not pressed Approve by the time section 06 starts, section 06's first card reads "Waiting for your approval. Nothing has been sent." with an outlined "Approve sample draft" button (the lime version is not repeated in that viewport; see the lime baton).

#### 06 Send and receipt (the single Mint Frost band)

| | |
| --- | --- |
| Sees | The approved card travels right and down off the dark field. The section background is the brief's one optional light band, Mint Frost `#def0dd`, with Void text. Three receipt slips stack as sticky cards. The canvas is hidden over this band. |
| Feels | Paper. The signal has become a document you can hold someone to. |
| Learns | How it sends (extension, or cloud applier on Pro and Max), what a receipt records, and the three billing rules that are verified end to end. |

Copy:

- Micro-label: `06 SEND AND RECEIPT`
- H2: "Sent through the employer's own form. Then a receipt."
- Body: "The Chrome extension fills the employer's form in your browser. On Pro and Max, the cloud applier can send approved applications with your laptop closed. Each submitted application saves a receipt: every field, every answer, the resume version and the confirmation page." (Build-status gate applies to the extension and the cloud applier, section 8.3.)
- Receipt slip 1, status word `Submitted`: rows "Fields sent 14", "Answers 7, all approved by you", "Resume version 3", "Confirmation page saved", "Cost 1 credit". Header `SAMPLE RECEIPT`.
- Receipt slip 2, status word `Failed`: "Required field empty: work authorization", "Cost 0 credits". Caption: "Failed submissions cost nothing. The reason is shown so you can fix it and send again." (PRD AC10, verified end to end.)
- Receipt slip 3, status word `Submitted` with note: "The extension reported this submission twice. Charged once." (PRD AC9, verified end to end.)

Receipt slip geometry: 8px radius, 1px `--on-mint-rule` border, 32px padding, a 12px torn-edge zigzag at the bottom drawn as an inline SVG mask (the only decorative edge on the page). Rows use `tabular-nums`, label left and value right.

#### 07 Replies and the offer pause

| | |
| --- | --- |
| Sees | Back on Void. A single dash travels from the right edge back to a small receipt icon on the left in 900ms, once, when the section enters: the echo. A DOM inbox row appears tagged to its application. Below it, a second row tagged `offer` and a line showing the subscription state changing from `Active` to `Paused`. |
| Feels | Closure without surveillance. |
| Learns | Replies arrive through a forwarding address. Kairos never needs Gmail access. Billing pauses when a forwarded email is an offer. |

Copy:

- Micro-label: `07 REPLIES`
- H2: "Replies come back to the application they belong to."
- Body: "Set one forwarding filter. Replies about your applications go to a private address, and Kairos tags each one to its application. Kairos never asks for your Gmail password or access. When a forwarded email is an offer, your subscription pauses."
- Build-status gate: reply tracking and the offer pause (AC12, no verification tag in the PRD) must be confirmed before this section ships as written.

#### 08 Honest billing and pricing

| | |
| --- | --- |
| Sees | Flat DOM on Void. The canvas is at rest (section 3.3, P9). An interval switch (Weekly, Monthly, Quarterly; active segment in Carbon fill, not lime). Four plan cards. A receipt calculator. One editorial bar chart of cost per application. |
| Feels | Nothing hidden. |
| Learns | Exact prices, allowances, cost per submitted application, and the billing rules. |

Copy:

- Micro-label: `08 BILLING`
- H2: "Pay for applications that went through." (KEEP)
- Lead: "One credit per submitted application. Failed submissions cost nothing. Cancel any time from the billing portal; access runs to the end of the period you paid for."
- Price note, Small style directly under the cards: "Launch prices. They may change for new customers. If they change, current subscribers get 30 days' notice and keep their price for at least 90 days." (PRC "Price research".)

Plan table (all values from `docs/pricing.md`):

| Plan | Weekly | Monthly | Quarterly | Applications | Cost per application, full monthly use |
| --- | --- | --- | --- | --- | --- |
| Free | n/a | $0 | n/a | 25, once | n/a |
| Starter | $6 for 94 | $19 for 400 | $45 for 1,200 | per cycle as listed | $0.048 |
| Pro | $12 for 280 | $39 for 1,200 | $95 for 3,600 | per cycle as listed | $0.033 |
| Max | $25 for 700 | $79 for 3,000 | $189 for 9,000 | per cycle as listed | $0.026 |

Feature lines per plan follow `shared/src/plans.ts` (the source of truth named in PRC; not yet read, so the implementer must copy strings from that file rather than from this concept).

**Receipt calculator.** One input: "Applications you expect to submit in 30 days" as a native `<input type="number" min="1" max="3000">` with a paired range slider. Output is a receipt-styled block:

| Row | Value |
| --- | --- |
| Smallest plan that covers it | for example "Starter, monthly" |
| Price | "$19.00" |
| Cost per submitted application at your number | price divided by the input, 3 decimals, for example 150 gives "$0.127" |
| Failed submissions | "$0.00" |

Pure function, no network call, tabular numerals, values roll with the odometer in 240ms, and instantly under reduced motion. A polite live region announces the final row once, 500ms after input stops.

**Editorial bar chart.** Three horizontal bars: Starter $0.048, Pro $0.033, Max $0.026 per application at full monthly use. Bars are Phosphor White at 1px outline with Ground fill (not lime), labelled with the value in text. Bars draw once on first view (`scaleX` 0 to 1, 600ms, `--ease-settle`, `transform-origin: left`) and then stay. A visually hidden `<table>` repeats the values. No competitor bars (facts.md 1.5: no competitor prices without a fresh check and legal review).

Lime in this section: only the recommended plan's CTA. "Most chosen" badge is removed (there are no customers to choose anything yet; it is an implied usage claim). The Pro card instead carries a neutral outlined tag "Sends with your laptop closed", which is a mechanism.

#### 09 Compared with auto-apply tools

| | |
| --- | --- |
| Sees | A two-column ledger table with Circuit Border row rules and no zebra stripes. Left column header: "What people report about auto-apply tools". Right column header: "What Kairos does". |
| Feels | Fair. The comparison is about mechanisms and reported experiences, not insults. |
| Learns | The difference in five rows. |

| Topic | What people report about auto-apply tools | What Kairos does |
| --- | --- | --- |
| Which jobs get applications | "Matches that did not fit" | Only postings that pass your rules and reach your fit bar, each with written reasons |
| Resume changes | "Skills and metrics I do not have" | Each line cites a fact you confirmed, or it cannot be saved |
| Before it sends | "A review step with no way to edit" | Edit every field and line, then approve |
| Replies | "Broad Gmail access" | A forwarding address. No Gmail access |
| Billing | "Charges after cancelling" | One credit per submitted application. Failed submissions cost nothing |

Copy: H2 "How it compares with typical auto-apply." (KEEP). Caption under the table: "Left column: problems people report about auto-apply tools in general. We do not name products." Quotes in the left column are paraphrases of PRD complaints and are set in `--body`, not styled as testimonials (no avatars, no names).

#### 10 Questions

Native `<details>` list (reuse `faq-list.tsx`). H2 "What people ask before signing up." (KEEP). Questions and answers are facts.md 5.6 with its fixes applied; A3 becomes: "No. Tailored lines must cite facts from your confirmed profile. A line that cites nothing cannot be saved, and the editor shows you which one." Each answer that states a rule carries a claim chip (section 5.2) linking to the section that shows it, for example A4 links to `#send`.

Disclosure motion: the `<details>` content height is not animated (no layout animation). The marker is a 12px gate notch that closes (gap 6px to 0) over 240ms when open. Under reduced motion it changes instantly.

#### 11 Closing call to action

| | |
| --- | --- |
| Sees | The canvas returns. The whole skip ledger has settled into a low, quiet horizon band across the bottom 18% of the viewport, every skipped dash in its reason row. Above it, at the gate line, the kept dashes sit still. Left-aligned copy and the lime CTA. Nothing moves unless the pointer does. |
| Feels | Calm resolution. The noise is accounted for. |
| Learns | The next step costs nothing and sends nothing on its own. |

Copy:

- H2: "Try it on 25 real applications." (KEEP, denoise heading)
- Body: "Every one waits for your approval."
- CTA (lime pill): "Start free" (KEEP)
- Under it, Small: "25 submitted applications, free, once. The free credits never expire." (PRC "Rollover".)

#### Footer

- Top row: the final run ledger as a sentence in Lead style: "Sample run on this page: 1,200 synthetic postings read. {skipped} skipped, each with a reason. {belowBar} below the bar. {matched} matched. {approved} approved by you. 0 sent." `{approved}` is 0 or 1 depending on whether the visitor pressed Approve.
- Clock line, Caption style, `aria-hidden="true"`: `CHRONOS 14:32 YOUR TIME   KAIROS WHEN YOU APPROVE`. The time is the visitor's local time, updated once per minute.
- Motion control: "Motion: Full / Reduced" as a two-option radio group (section 7.2).
- Link columns: Product (How it works, Pricing, Chrome extension, Blog), Company (About, Contact), Legal (Terms, Privacy, Cookies, Refunds). Legal pages exist as routes; their content awaits legal review (PRD open question 5).
- Bottom line in `--micro` (decorative only): "Gray Matter Labs".

---

## 3. The single WebGL centerpiece: the Gate Field

### 3.1 What it is

One React Three Fiber canvas, fixed behind the page, drawing one `InstancedMesh` of 1,200 flat dashes (each dash is one synthetic posting) plus one `LineSegments` object for gates, the fit bar and citation hairlines. Two draw calls in total. No textures, no models, no post-processing.

Why real-time WebGL and not the frame-sequence technique from the 3d-scroll-website skill: the fit bar and the approval gate respond to the visitor's input, and the skill itself says to reach for real 3D when the scene must respond to interaction. The frame-sequence idea is still used for the static tier: T0 shows pre-rendered posters of each pose (section 7.3).

### 3.2 Look within the phosphor palette

The field reads as emissive because it is bright value on pure black, not because of bloom. Nothing glows.

| Element | Color (token) | Alpha | Shape |
| --- | --- | --- | --- |
| Incoming or noisy posting | `--label` `#9cbf93` | 0.35 | Dash 16px by 1.6px at 1440px width (0.18 by 0.018 world units) |
| Posting still in play during the gate story | `--body` `#8cab87` | 0.6 | Same dash, rotation settles to 0 degrees |
| Kept posting | `--foreground` `#ddffdc` | 0.92 | Dash, then grows to a rectangle with 8px corner radius in the SDF when it becomes a card |
| Skipped posting, filed | `--border` `#485346` | 0.55, then 0.3 at rest | Dash aligned in a ledger row |
| Gate lines, fit bar, citation hairlines | `--link` `#859984` | 0.7 | 1px lines |
| Fact anchors | `--foreground` | 0.92 | 6px squares, 0px radius |

Rules:

- Lime `#7fee64` never appears in the shader. The palette is a fixed uniform array without lime, which a unit test checks. This makes the one-lime-per-viewport rule independent of the scene.
- Renderer settings so token hexes render exactly: `THREE.ColorManagement.enabled = true`, `outputColorSpace = SRGBColorSpace`, `toneMapping = NoToneMapping`, normal alpha blending (not additive, which would turn dense regions into a glow).
- Fragment shader: a rounded-rectangle SDF with `fwidth`-based 1px antialiasing. Edge falloff never exceeds 1.5px, so there is no halo.
- Dashes, not dots or orbs. A dash reads as a line of text, so the field looks like a ledger being written rather than a starfield. This is the main formal difference from Modal's glowing cube and Lando Norris's lime-on-black spectacle.

### 3.3 Poses and state changes by section

The shader computes every dash's position for every pose from its per-instance attributes, so no per-pose buffers are uploaded and no per-dash JavaScript runs per frame. The JavaScript side only sets `uPoseA`, `uPoseB` and `uMix` (0 to 1) from the active section's scroll progress, plus the uniforms listed in 3.4.

Camera: perspective, 30 degree vertical field of view, positioned at z = 12. World field 16 units wide, 9 tall, 3 deep.

| Pose | Section | What the field does | Progress mapping | Instances visible (T2) |
| --- | --- | --- | --- | --- |
| P0 Ingest | 00 Hero | Dashes enter from the left along three lanes (y = 0.25, 0.5, 0.75 of the field height, plus or minus 0.12 jitter), occupying the right 60% of the viewport. Camera yaw minus 8 degrees for slight depth. After 2.4s (time based, once per page load) all motion ends. | Time: 0 to 2400ms, `--ease-settle` per dash with a stagger of `aSeed * 900ms` | 1,200 |
| P1 Noise | 01 Problem | Field spreads to full width and full depth, dashes rotate to `(aSeed - 0.5) * 24` degrees. Camera yaw eases to 0. | Scroll from section top at viewport bottom to section top at viewport top | 1,200 |
| P2 Hard gates | 02 Rules | Five gate lines draw at x = 20%, 35%, 50%, 65%, 80% of the field. Dashes flow left to right with scroll. Each dash with `aFailGate = k` drops at gate k: falls 0.6 units, rotates to 0 degrees, and slides into its reason row in the skip ledger band (bottom 18% of the viewport, rows 10px apart, dashes 4px apart within a row). | 0.00 to 0.10 gates draw; gate k fires over 0.10 + 0.12k to 0.22 + 0.12k; 0.70 to 1.00 hold | 1,200 |
| P3 Score | 03 Bar, first part | Passed dashes (`aFailGate = 6`) rise into a scatter: y = `aScore / 100` of the field height, x spread by seed. Fit bar line draws at y = `uFitBar`. Dashes below the bar dim and file into a "Below your fit bar" row; dashes above brighten. | 0.00 to 0.25 rise; 0.25 to 0.40 bar draws and the control activates; 0.40 to 0.75 filing scrubs | about {passed} active, rest filed |
| P4 Matches | 03 Bar, second part | The {matched} kept dashes grow into 1.6 by 0.9 unit rectangles and move to the screen positions of DOM card slots (hand-off, 3.6). | 0.75 to 1.00 | {matched} active |
| P5 Facts | 04 Truth lock | Kept rectangles except one fade out. 18 fact anchors appear in a 6 by 3 grid on the right half. Citation hairlines draw from DOM resume line anchors to fact anchors. | 0.00 to 0.30 anchors; 0.30 to 0.60 hairlines draw one by one; 0.60 to 1.00 interactive | 1 rectangle, 18 anchors |
| P6 Hold | 05 Approve | All filed dashes fade to 10% opacity. One card waits below a horizontal gate line at 55% of the viewport height. `uTime` stops advancing: the scene is completely still. On Approve, the card passes the gate over 700ms and the gate line closes (its center gap shrinks from 24px to 0). | 0.00 to 0.40 fade and freeze; approval is click-driven, never scroll-driven | 1 card |
| P7 Hand-off | 06 Send | The approved card translates toward the first receipt slip's slot and cross-fades out over 240ms as the DOM receipt takes its place. The canvas then fades to 0 over the Mint Frost band and stops rendering. If not approved, the card stays at the gate and fades with the field. | Section top at 80% of the viewport to section top at 30% | 1, then 0 |
| P8 Echo | 07 Replies | One dash travels from the right edge to the reply row's icon slot in 900ms, `--ease-settle`, once, when the section is 40% in view. | Time-based, once | 1 |
| P9 Rest | 08 to 10 | The field condenses into a single 1px vertical column of dashes along the ledger rail's x position at 20% opacity, renders one frame, and the render loop goes idle. Hidden entirely below 1024px. | Section top at 60% of the viewport | 1,200, static |
| P10 Horizon | 11 Closing, footer | Skip ledger rows re-form as a horizon band in the bottom 18% of the viewport. Kept dashes sit on a gate line at 62% height. Still, except pointer tilt. | Section top at 90% to 40% of the viewport | 1,200 |

Interpolation between poses uses `--ease-gate` (`cubic-bezier(0.65, 0, 0.35, 1)`) applied in the shader to `uMix`, with a per-instance offset of `aSeed * 0.15` so dashes do not move in lockstep. Scroll-scrubbed poses follow scroll exactly in both directions; scrolling up reverses them.

### 3.4 Data and uniforms

Per-instance attributes (one interleaved `Float32Array`, 1,200 by 8 floats, 38.4 KB raw, about 14 KB gzip):

| Attribute | Range | Meaning |
| --- | --- | --- |
| `aSeed` | 0 to 1 | Deterministic jitter |
| `aLane` | 0, 1, 2 | Greenhouse, Lever, Ashby lane |
| `aFailGate` | 0 to 4, or 6 | First gate failed; 6 means passed all hard rules |
| `aReasonRow` | 0 to 10 | Row index in the skip ledger (one row per reason string) |
| `aRowIndex` | 0 to n | Position within its row |
| `aScore` | 0 to 100 | Sample fit score (passed postings only) |
| `aCardSlot` | -1 or 0 to 11 | Card slot for kept postings at the sample bar |
| `aChangedAt` | seconds | Time of the last interactive state change, for 420ms per-dash transitions |

Uniforms: `uPoseA`, `uPoseB`, `uMix`, `uTime`, `uFitBar` (0 to 1), `uPointer` (vec2, smoothed), `uTextMask` (vec4, the copy column rectangle in normalized device coordinates), `uHighlightRow` (-1 or a row index), `uRailX`, `uOpacity`, `uPalette[6]`.

### 3.5 Text-safe mask

Body text in Sage 60 is 8.3:1 on pure Void but drops below 4.5:1 if a 35% dash sits behind it. The shader multiplies alpha by `1.0 - smoothstep(0.0, 0.04, inside(uTextMask))`, so the field is fully transparent behind the copy column plus a 4% feather. `uTextMask` is read from the copy column's `getBoundingClientRect()` on resize and on each ScrollTrigger refresh. Headings in Phosphor White stay above 9:1 even in the feather. Poster frames for T0 are checked with an automated contrast scan at every text position (section 8.2).

### 3.6 DOM hand-off

Each section that receives a kept card contains empty `<div data-slot="match-0">` elements in the layout. On resize and refresh, the slot rectangle is converted to normalized device coordinates and unprojected to world space at z = 0. During the hand-off range the shader mixes the dash's pose position toward the slot position. When the dash arrives, the real DOM card cross-fades in over 240ms and the canvas rectangle fades out over the same 240ms. The DOM card is always the authoritative content (text, focus, screen readers); the canvas copy is `aria-hidden` decoration, so any misalignment is visible for at most 240ms.

### 3.7 Source of the sample (honest by construction)

1. Extract `passesHardFilters` and its regular expressions from `server/src/services/fit.ts` into `shared/src/fit-rules.ts` as a pure function with no import of `./llm`. The server imports it from there. The landing imports the same function.
2. A seeded build script, `web/scripts/build-gate-sample.ts`, generates 1,200 synthetic postings (titles from a fixed vocabulary, companies named "Company 001" to "Company 400", locations, salary ranges, description snippets that include or exclude sponsorship phrases), runs them through the shared function with the sample profile, sorts the results, and writes the binary attribute buffer plus a JSON summary of counts per reason.
3. The generator is tuned so every gate visibly drops at least 3% of postings, between 80 and 120 postings pass the hard rules, and exactly 12 are at or above the sample bar of 70. Those are design targets for a synthetic dataset; the page never states them as rates. All counts on screen are read from the JSON summary.
4. A unit test fails if the counts in the summary drift from what the shared function returns, and if any reason string in the summary is not produced by the shared function.

The page can then truthfully say, in the sample disclosure: "These skips come from the same rule code Kairos runs on real postings." That sentence ships only if step 1 is done.

---

## 4. Signature interactions

Five interactions. Each has a native HTML base that works without WebGL, without a pointer and under reduced motion; the canvas is the enhancement.

### 4.1 Set your rules (section 02)

A compact console under the copy panel with three native controls. Changing one re-runs the shared hard-filter function on the 1,200 sample postings in the browser (under 2ms) and updates the scene and the skip ledger counts.

| Control | Element | Options |
| --- | --- | --- |
| Seniority | `<select>` | Entry (sample default), Mid, Senior |
| Work authorization | Radio group | Needs sponsorship (sample default), Does not need sponsorship |
| Per-company cap | `<select>` | 2 per 30 days (sample default), 1, 3 |

Behavior:

- Dashes whose state changes get `aChangedAt = now` and move to their new pose over 420ms with `--ease-settle`. Unchanged dashes do not move.
- Skip ledger row counts roll with the odometer (240ms).
- A polite live region, debounced 500ms, announces: "Sponsorship rule on. {n} postings skipped for sponsorship. {passed} pass all rules."
- Under reduced motion: dashes jump to their new positions (T1 and T2) or the poster and counts update instantly (T0).
- Touch targets: 44px tall controls, 8px gaps.

### 4.2 Drag the fit bar (section 03)

The fit bar is a horizontal hairline across the field with a 44px by 44px DOM handle at its right end, showing the value in tabular Inter 14px.

- Base element: `<input type="range" min="0" max="100" step="5" value="70">` with `aria-label="Your fit bar (sample)"` and `aria-valuetext="Fit bar at 70 of 100. 12 of 104 postings kept."` (values computed).
- Pointer: dragging the handle or anywhere on the hairline within 12px moves the bar. A 4px movement threshold before the drag starts. Vertical page scroll is not blocked: the range has `touch-action: pan-y` and only horizontal intent moves it on touch (on desktop the bar moves vertically on screen; it is rendered rotated, but the input itself is a normal horizontal range in the console so keyboard arrows and screen readers behave normally).
- Keyboard: arrow keys step 5, Page Up and Page Down step 20, Home and End go to 0 and 100.
- Scene response: `uFitBar` updates in the same frame as the input event. Dashes crossing the bar get `aChangedAt` and brighten or dim over 420ms. The DOM counter updates synchronously in the input handler so INP stays under 100ms.
- The match cards below update: the three visible cards are the top three by score at the current bar; the "+n more" line updates.
- Scroll scrub only reveals the bar (0.25 to 0.40 of the section). Once the visitor touches the bar, scroll no longer changes its value.

### 4.3 Probe a skipped posting (sections 02, 03, 11)

Fine pointer only (`(hover: hover) and (pointer: fine)`). Hovering a filed dash in the skip ledger shows a DOM tooltip next to it:

`SKIPPED   Company 214 · Software Engineer II`
`Posting says it does not sponsor visas`
`Also: Location is outside your list`
`Sample posting 0417`

- Picking cost is constant: filed dashes sit on an analytic grid (row index and position in row), so the pointer position converts to a row and index with arithmetic, no raycast.
- The hovered dash brightens to `--body` at 0.9 alpha; its row brightens to 0.55 via `uHighlightRow`.
- Native cursor stays. No custom cursor, no follower.
- Keyboard and touch equivalent: every skip ledger row label in the DOM is a `<button aria-expanded>`. Focusing it sets `uHighlightRow`; activating it expands a list of the first 5 sample postings in that row with all their reasons, plus "and {n} more". This list is the primary, accessible version of the probe.

### 4.4 Cite or refuse (section 04)

Described in 2.3 section 04. Precise motion:

- Choosing the cited line and pressing "Add line": the line enters the diff with a 1px `--good` left rule; a hairline draws from the line's right edge to fact anchor `#07` over 420ms, `--ease-settle`; the chip "cites fact #07" moves 8px left into place over 240ms.
- Choosing the uncited line: the hairline draws 70% of the distance over 300ms, finds no anchor, and retracts over 240ms with `--ease-exit` (`cubic-bezier(0.4, 0, 1, 1)`). The line does not enter the diff. Error text appears below the control with `role="alert"`. No shake, no red flash, no bounce.
- Under reduced motion the hairline appears or does not appear instantly; the text result is identical.

### 4.5 Approve, the kairos moment (section 05)

- The only lime element in the viewport: "Approve sample draft", 48px tall lime pill.
- On press (click, tap, Enter or Space): the card passes the gate in 700ms with `--ease-settle`. The gate line's center gap closes from 24px to 0 over 240ms after the card passes. "Approved at {local time}." prints with a ledger tick underline. The run ledger `APPROVED` rolls 0 to 1. Focus stays on the button, which becomes a disabled-looking outlined button reading "Approved" with `aria-disabled="true"`.
- Not pressing it is a valid path. The page never auto-approves on scroll. Section 06 then shows the waiting state, which demonstrates "nothing is sent until you approve it" by the page's own behavior.
- The approval state persists for the session in `sessionStorage` inside try/catch, so the footer ledger stays consistent on reload.

---

## 5. The Kairos motif system: Ledger and Gate

The motif is built from two marks, the **gate notch** and the **citation mark**, and one grammar, **every motion ends in a ledger tick**. It is drawn from the product's mechanism (gates, reasons, citations, receipts), so it cannot be mistaken for Modal's cube-and-glow language, Lando Norris's lime spectacle, or Tsenta's scrolling terminal log.

### 5.1 The gate notch

A 1px horizontal hairline with a 12px gap, the gap bounded by two 6px vertical ticks. Geometry: line in `--divider` for section dividers, `--link` where it marks an interactive gate.

| Use | Form |
| --- | --- |
| Section dividers | Replaces the plain section hairline. The notch sits at the left container edge; the section number is set inside the gap, for example `02`, in tabular Inter 12px `--label`. |
| FAQ disclosure marker | Notch gap 6px when closed, 0 when open. |
| Approval gate in the scene | The same notch, large, drawn in the canvas. |
| Logo lockup spacing | The notch is the separator between the mark and the wordmark in the footer only. |

### 5.2 The citation mark and claim chips

- In the product demo: "cites fact #12" as an outlined pill (9999px radius, 1px Circuit Border, 4px 12px padding, Inter 12px 500, `tabular-nums`, Phosphor White text).
- On the page itself: six factual claims carry a claim chip that cites where the page shows them. For example the hero microcopy "Credits are spent only when an application is submitted." carries the chip `see 06`, linking to `#send`. The pricing lead "Failed submissions cost nothing." carries `see 06`. FAQ A3 carries `see 04`. The page holds itself to the same standard as the resume: claims cite their evidence.
- Chips are links with an accessible name such as "See section 06, Send and receipt".

### 5.3 Ledger numerals

- All numbers use `font-variant-numeric: tabular-nums`.
- Indices have leading zeros: `01`, `07`, `0417`.
- Credits are signed and worded: "+25 credits", "−1 credit", "0 credits". (The sign is U+2212 minus, not a dash.)
- Transformations use an arrow in micro-labels: `1,200 → 104 → 12`.
- Money always shows cents in receipts ("$19.00", "$0.00") and three decimals for per-application cost ("$0.048").

### 5.4 Micro-labels

Caption style (Inter 12px, uppercase, +0.6px tracking, `--label`), always in the form `{number} {NAME}` and optionally `· {state}`: `02 YOUR RULES · 5 GATES`, `SAMPLE RECEIPT`, `SAMPLE MATCH`. The word SAMPLE appears on every demo object. Sample labelling is part of the motif, not a disclaimer hidden in a footnote.

### 5.5 Cursor

The native cursor is kept everywhere (Awwwards guidance on custom cursors, and touch parity). The only pointer-specific affordance is the probe tooltip (4.3) and the fit bar handle, which shows `cursor: ns-resize` on desktop. No follower dots, no magnetic buttons.

### 5.6 Transitions: the ledger tick and the strike

- **Ledger tick:** when a meaningful item arrives (a skip ledger row, a receipt row, the approval line), a 1px underline in `--border` draws from 0 to 100% width over 240ms with `--ease-settle`, then stays. Motion ends in a mark. Items without meaning do not animate in at all; there is no fade-up on every element.
- **Strike and reason:** in DOM lists of skipped postings, the title gets a 1px `--muted` line drawn left to right over 320ms, then the reason prints after it in `--body` with a 60ms delay.
- **Section change:** the rail tick slides between entries over 300ms. No page-wide transitions, no wipes.

### 5.7 The lime baton

Exactly one lime element is visible at any scroll position. Every lime-capable element carries `data-lime`. A single IntersectionObserver tracks which `data-lime` elements are at least 20% in view; the highest priority one renders lime and the others render as outlined buttons, with a 300ms color transition.

| Priority | Element |
| --- | --- |
| 1 | Approve sample draft (section 05) |
| 2 | Hero CTA, recommended plan CTA, closing CTA (never in view together) |
| 3 | Navbar "Start free" |

The logo mark is lime but is 24px and part of the navbar; it counts as the navbar's lime element, so while the navbar CTA is outlined the logo stays lime and the rule holds: one lime element plus nothing else. If the reviewer reads the logo as a second lime element, the logo switches to a Phosphor White mark whenever a section CTA is lime. This is decided in review and tested automatically (section 8.2).

### 5.8 Chronos and kairos

The clock motif appears twice and nowhere else: the footer clock line, and the real approval timestamp in section 05. Both use the visitor's local time. Neither claims anything about when the product sends applications.

---

## 6. Typography moves

### 6.1 Named landing-only type extensions

The brief's scale stays the base for the app and for small landing text. The landing adds four named sizes, justified because the hero must hold its own against a full-viewport field and because, with weights capped at 500, size and tracking are the only hierarchy tools.

| Token | Value | Line height | Tracking | Weight | Use |
| --- | --- | --- | --- | --- | --- |
| `--type-display-landing` | `clamp(3rem, 1.6rem + 5.6vw, 7.5rem)` (48px at 375px, about 106px at 1440px, 120px at 1680px and wider) | 0.95 | −0.025em | 400, Inter Tight, `ss01` | Hero H1 only |
| `--type-heading-landing` | `clamp(2.25rem, 1.5rem + 2.4vw, 3.75rem)` (36px to 60px) | 1.02 | −0.02em | 400, Inter Tight, `ss01` | Section H2s |
| `--type-numeral-landing` | `clamp(2.5rem, 1.5rem + 3.2vw, 5rem)` (40px to 80px) | 1.0 | −0.02em | 400, Inter Tight, `tnum` | Large counters beside the skip ledger and the fit bar value |
| `--type-lead-landing` | `clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)` (20px to 24px) | 1.45 | −0.01em | 400, Inter | Hero subhead, lead paragraphs, footer ledger sentence |

H1 max width 14ch; H2 max width 18ch; body max width 62ch. All left-aligned.

### 6.2 Kinetic behaviors

| Move | Where | Behavior | Values | Reduced motion |
| --- | --- | --- | --- | --- |
| K1 Ink-in | Hero H1 | Text is fully present and visible at first paint, so it is the LCP element. Each word's color moves from `--border` to `--foreground` in reading order, like a ledger line being written. Color only, no transform, no layout. | 400ms per word, 60ms stagger, `--ease-settle`, starts at first paint via CSS `animation` | Final color immediately |
| K2 Denoise | H2s of sections 01, 02, 03 and 11 | The heading has a real text node for screen readers (`.sr-only`) and an `aria-hidden` copy split into character spans. Each character starts at a seeded opacity between 0.15 and 0.5 (static noise, no flicker) and resolves to 1 in a seeded order as the heading moves from 85% to 45% of the viewport height. Opacity only, compositor-friendly. | Scroll-scrubbed, characters resolve in a window of 0.25 of the range each | Plain heading, no split |
| K3 Odometer | Run ledger, skip ledger counts, fit bar value, pricing | Each digit is a column of 0 to 9 in a fixed-height, `overflow: hidden` box; it moves by `translateY`. Columns are `aria-hidden`; one visually hidden node holds the value. | 240ms for counts, 360ms for prices, `--ease-settle`; the hero READ count rolls over 2400ms | Value set instantly |
| K4 Strike and reason | Skipped posting lists | See 5.6 | 320ms strike, 60ms delay, reason prints | Static strike and reason |
| K5 Citation snap | Truth lock lines | Chip moves 8px into place, hairline draws | 240ms chip, 420ms line | Instant |

Kinetic type is limited to these five moves. There is no letter scramble, no per-letter bounce, no marquee, no text glow, and no lime text.

---

## 7. Mobile, reduced motion and low-end devices

### 7.1 Mobile story (below 1024px)

The phone page is its own composition, not the desktop canvas shrunk (the lesson of Lando Norris's separately credited mobile element).

| Aspect | Below 768px | 768 to 1023px |
| --- | --- | --- |
| Tier ceiling | T1 (400 rendered dashes) | T1 |
| Flow direction | Top to bottom. Gates are horizontal lines; dashes fall through them; the skip ledger is a band of short columns at the bottom of the canvas. | Left to right as on desktop |
| Canvas placement | `position: sticky; top: 64px` inside each story section, height 52svh. Copy sits below the canvas in normal flow, never over it, so text never needs the mask. | Sticky, 56svh, copy below |
| Scroll coupling | No scrub. Each beat is a block; when it is 50% in view (IntersectionObserver), the canvas tweens to that pose over 700ms, time-based. Scrolling back reverses to the previous pose. | Same |
| Hero | H1 at 48px over pure Void at the top; the field is a separate band below the CTAs (30svh) that ingests 400 dashes over 2.4s. The CTA is above the fold at 375 by 667. | Same, field 36svh |
| Fit bar | The range input sits under the canvas, full width, thumb 44px. | Same |
| Probe | Not available; the skip ledger row buttons are the interface. | Same |
| Approve | Full-width 48px lime pill. | Same |
| Rail | Replaced by a section sheet button fixed at bottom right (48px, outlined, label `03 / 11`), opening a native `<dialog>` with the section list. The dialog has `data-lenis-prevent`. | Same |
| Run ledger | Inline at the top of each story section, wrapping to two lines if needed. | Same |
| Receipt stack | Cards in normal flow, no sticky stacking. | Sticky stacking at `top: calc(80px + var(--i) * 16px)` |
| Smooth scroll | Native touch momentum (`syncTouch: false`). | Same |

Rendered dashes on T1 are a deterministic 1-in-3 subsample of the 1,200 records; all counters still read from the full sample, and the legend chip still says 1,200. Displayed counts never depend on the device.

### 7.2 Reduced-motion story

Triggered by `prefers-reduced-motion: reduce`, or by choosing "Reduced" in the page's Motion control (footer, and a small control row at the top right of the canvas area reading "Motion: Full / Reduced" plus "Pause motion"). The choice is stored in `localStorage` inside try/catch and applied as `data-motion="reduced"` on `<html>` by a tiny inline script before first paint, so there is no flash. An explicit "Full" choice overrides the OS setting, which satisfies the site-wide setting route of WCAG 2.3.3.

What changes:

- Tier T0: the canvas is not loaded. Each story section shows its pre-rendered poster (section 7.3) as a static image with width and height set.
- Lenis does not smooth (its `respectReducedMotion` default); anchor jumps are instant.
- No sticky story sections: every beat is normal flow, so the page is shorter and reads like a document.
- K1 to K5 show final states. Odometers set values instantly. Bar chart bars are drawn from the start.
- All five interactions still work and produce the same text results instantly. The fit bar and rules console update counts and the DOM skip ledger immediately.
- Nothing on the page moves by itself. The hero ingest (2.4s) is under the 5s threshold of WCAG 2.2.2 anyway, and no motion on the page loops, but the "Pause motion" button is still provided on T1 and T2: it stops `uTime`, stops invalidating the canvas and freezes the current pose.

### 7.3 Low-end device story (tier model)

| Tier | Entry conditions (first match wins, evaluated in this order) | Experience |
| --- | --- | --- |
| T0 Static | Reduced motion active; `Save-Data: on` (`navigator.connection.saveData`); no WebGL2; `navigator.deviceMemory <= 2`; `webglcontextlost` fired; T1 fell below 30fps for 3s | Seven AVIF posters (P0, P1, P2 hold, P3 at the sample bar, P5, P6, P10), each at most 45 KB at 1600px wide and 18 KB at 800px wide, served with `srcset`. Interactions run on DOM only. |
| T1 Light | Viewport below 1024px; coarse pointer; `hardwareConcurrency <= 4`; `deviceMemory <= 4`; `PerformanceMonitor` declined twice on T2 | 400 rendered dashes, `dpr` clamped to [1, 1.25], no pointer tilt, `frameloop="demand"` |
| T2 Full | Fine pointer, desktop-class GPU, sustains 55fps or better over the first 2s after reveal | 1,200 dashes, `dpr` clamped to [1, 2], pointer tilt in P0, P1 and P10 (max 6 degrees, smoothing factor 0.06 per frame, critically damped, no overshoot) |

Posters are generated by `web/scripts/render-gate-posters.ts`, which opens the real scene in a headless browser at fixed poses and saves frames, so T0 shows exactly what T2 would show at rest. This is the frame-sequence idea from the 3d-scroll-website skill, reduced to seven frames.

Switching tiers mid-session cross-fades canvas and poster over 300ms and never retries a lost context more than once.

---

## 8. Performance, risks and how to retire them

### 8.1 Performance approach

**Architecture.** Every section is a Server Component. Four client islands:

| Island | Contents | Loads |
| --- | --- | --- |
| `GateFieldLoader` | A small client wrapper that calls `next/dynamic(() => import("./gate-field"), { ssr: false })` (allowed only inside a Client Component in Next.js; verify against nextjs.org/docs for 16.x before building) | After first paint, on `requestIdleCallback` with a 1200ms timeout, and only for T1 or T2 |
| `StoryController` | Lenis, GSAP core and ScrollTrigger, the lime baton, the rail observer, the run ledger | After hydration |
| `GateConsole` | Rules console, fit bar, truth-lock panel, Approve demo | Hydrates with the page; works without the canvas |
| `ReceiptCalculator` | Pricing calculator and interval switch | Hydrates when the pricing section is within one viewport |

Shared state between the console and the canvas is a tiny external store read with `useSyncExternalStore`, written by input handlers and read by the canvas in its frame callback, so slider movement never re-renders React trees.

**One clock.** Lenis is driven from the GSAP ticker (`autoRaf: false`, `gsap.ticker.add((t) => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`, `lenis.on("scroll", ScrollTrigger.update)`), with `lerp: 0.09`, `smoothWheel: true`, `syncTouch: false`, `anchors: true`. The canvas uses `frameloop="demand"` and the ticker calls `invalidate()` only while scroll velocity is non-zero, a timed transition is running, or the pointer moved in a tilt pose. When the visitor stops to read, the GPU does no work.

**GPU budget.** Two draw calls. No textures, no shadows, no post-processing, no transparency sorting (dashes are flat at a few z depths and order does not matter visually). Shader programs compiled during idle with `gl.compile(scene, camera)` before the canvas is revealed; the poster shows until then and cross-fades out over 600ms.

**Render pause.** The loop stops when the canvas is fully hidden (P7 over the Mint band, P9 rest), when the tab is hidden (`visibilitychange`), and when "Pause motion" is on.

**Budgets (internal targets, tighter than the official web.dev "good" thresholds of LCP 2.5s, INP 200ms, CLS 0.1).**

| Metric | Budget | How it is met |
| --- | --- | --- |
| LCP | 1.5s desktop, 2.5s on a mid-range Android on 4G | H1 is server-rendered text visible at first paint (K1 changes color only). Canvas never covers the H1 and loads after paint. |
| CLS | 0.05 or lower | Posters and canvas have fixed boxes. Odometers have fixed digit widths. No layout animation anywhere. Fonts via `next/font` with metric-adjusted fallbacks. |
| INP | 100ms or lower | Counters update synchronously in input handlers; the filter re-run takes under 2ms; scene updates in the next frame. |
| First-load JavaScript | 110 KB gzip or less, excluding the centerpiece chunk | Server Components, three small islands at first load |
| Centerpiece chunk | 200 KB gzip or less (three.js tree-shaken, R3F, shaders, sample buffer of about 14 KB) | Loaded on idle, T1 and T2 only |
| Frame rate | 60fps sustained on T2 test hardware; T1 at 50fps or better on a Pixel 6a class phone | Shader-driven motion, 2 draw calls, DPR clamps, `PerformanceMonitor` bounds 45 to 58 |
| Page weight | 1.2 MB or less on first load, including fonts and the hero poster | No images except posters; two font families, Latin subset, weights 400 and 500 only |

**Fonts.** `next/font/google` for Inter Tight (400, 500, `ss01`) and Inter (variable, `cv11`), Latin subset, `display: "swap"`. The global `h1` to `h4` weight-400 rule found in the code inventory stays, since display and headings use 400; card titles use 500 via a class.

### 8.2 Top risks and how to retire each

| # | Risk | Retire it by |
| --- | --- | --- |
| 1 | Visitors read the sample counts as product statistics ("Kairos keeps 1% of jobs"), which would break the truth rule in spirit. | SAMPLE label on every demo object and on the legend chip; counts shown as computed tokens only; the sentence "This sample is synthetic. Your counts depend on your rules and on what employers post." under the skip ledger; no count ever appears in a headline. Retire with a 5-person comprehension test: if any participant states a sample count as a Kairos result, rework the labels before launch. |
| 2 | The demo's reason strings drift from the product's. | Extract `passesHardFilters` into `shared/` (3.7) and add a unit test that fails if the sample summary contains a reason the shared function cannot produce. If the extraction is not done, the sentence "same rule code" is removed. |
| 3 | Copy claims features whose build status is unconfirmed (Chrome extension, cloud applier, reply tracking, offer pause, polling interval). | Build-status gate (8.3). |
| 4 | Long sticky story (960vh on desktop) hurts usability, the 30% criterion. | Ledger rail and skip links ("Skip the demo, go to pricing"); sticky stories off below 1024px and under reduced motion; test that a keyboard user reaches pricing in under 10 seconds via the rail and that End and Page Down work everywhere. If test participants report fatigue, cut section 02 to 200vh and 04 to 150vh. |
| 5 | Body text over the field fails contrast. | Text-safe mask (3.5); copy below the canvas on mobile; automated pixel sampling of each T0 poster at every text rectangle with a 4.5:1 floor, plus axe runs in Playwright at 375, 768, 1024 and 1440px. |
| 6 | A second lime element appears in a viewport. | Lime baton (5.7); shader palette without lime plus a unit test; a Playwright test that scrolls in steps of 50% of the viewport height and fails if more than one visible element computes to `#7fee64` background (logo handling as decided in review). |
| 7 | Jank on mid-range Android or older laptops. | Tier model with `PerformanceMonitor`; test on a Pixel 6a class phone and a 4-core integrated-GPU laptop; WebPageTest on a Moto G class profile; frame-time trace in Chrome DevTools must show no long tasks over 50ms during scroll. |
| 8 | DOM and canvas hand-off misaligns after resize, font swap or address-bar collapse. | Slots recomputed on `ResizeObserver` and `ScrollTrigger.refresh`; `svh` units on mobile; DOM card authoritative with a 240ms cross-fade so misalignment can never persist. |
| 9 | Next.js 16 API drift (dynamic imports, `cacheComponents` prerendering, typed routes). | Read nextjs.org/docs for 16.x before building; the canvas island touches browser APIs only in effects; `next build && next start` is the test target, not dev mode. |
| 10 | The page reads as a Modal or Tsenta derivative. | Dashes not orbs, no cube, no glow, no scrolling monospace log; the motif is gates, filed reasons, citations and receipts; one Mint Frost paper band. Review side by side with Modal, Lando Norris and Tsenta screenshots at design lock. |
| 11 | The Approve demo is mistaken for a real send. | Button text "Approve sample draft", the adjacent line "Demo. Nothing is sent from this page.", and `SENT 0` staying at 0 everywhere. |
| 12 | WebGL context loss or shader compile failure. | `webglcontextlost` handler switches to T0 once; compile errors caught in an error boundary around the canvas that renders the poster. |

### 8.3 Build-status gate for copy

Every copy string that describes a feature whose status the PRD leaves as "Not stated" carries a `requiresStatus` key in the content file. The landing build fails if any `requiresStatus` key is not marked confirmed in `web/content/feature-status.ts`. Unconfirmed features either drop from the copy or ship with a neutral outlined "Beta" tag, decided per feature by the product owner. Keys: `extension_apply`, `cloud_applier`, `reply_tracking`, `offer_pause`, `polling_interval`, `no_card_signup`.

---

## 9. The case for each Awwwards criterion

### Design (40%)

- A strict palette from the brief with no new hues: near-black, phosphor greens, one lime fill, one Mint Frost paper band. Juries reward narrow palettes (Lando Norris, Neutomni, Razorpay).
- A formal language owned by the product: dashes that file into ledger rows, gate notches, citation marks, receipt slips with a torn edge. Every visual element maps to a product mechanism.
- Large Inter Tight display at weight 400 against a quiet field, hierarchy from size and tracking only, all text left-aligned.
- One signature moment (the stillness at the approval gate) instead of many effects, matching the 2026 signals from Oryzo, Messenger and Razorpay ("When everything around a moment is calm, motion becomes meaningful").
- A mobile composition designed separately (vertical flow), not a scaled desktop.

### Usability (30%)

This is where winners are weakest (sample mean 7.40; dev Accessibility mean 6.90, none above 7.60), so it is the biggest opportunity.

- Native cursor, native scrollbar, real links in the rail, skip links, keyboard paths for every demo, 44px targets.
- Every interactive demo has a native HTML base (select, radio, range, button) and a live region; the canvas is decoration over it.
- Visible Motion control with Full and Reduced, and a Pause motion button; reduced motion gives a complete, shorter, document-like page.
- LCP-safe hero, three-tier fallback, no layout animation, an idle GPU while reading.
- The lime baton makes the next action unambiguous at every scroll position.

### Creativity (20%)

- The fit gate as physics: the story's spectacle is the product declining work, which no job tool has shown.
- The approval gate that will not open on scroll. The page demonstrates "nothing is sent until you approve it" by refusing to continue the story on its own.
- The skip ledger: rejected items are filed with reasons rather than vanishing, and can be probed one by one.
- Denoising headings and ink-in display type that express the concept in type without hurting screen readers.
- The real approval timestamp and the chronos and kairos clock line tie the name to the interaction.

### Content (10%)

- Every sentence is a mechanism, a rule or a price from the docs: hard filters before any model call, citations by fact number, 422-style refusal, failed submissions cost nothing, duplicate reports charged once, per-application cost math.
- The dataset runs through the product's own rule code and every number is computed and labelled as sample.
- Honest absence: no testimonials, no logos, no user counts, no competitor names, no outcome rates. The comparison table attributes complaints to "what people report" and makes no claims about named products.
- Copy follows the register the competitor review identified as open: "We skip the jobs that do not fit." "Nothing moves until you approve."
