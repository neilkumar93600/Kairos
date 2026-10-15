# Entry 01: Reported (five debits)

Section id `entry-01-reported`. Anchor `#entry-01`. Heading id `entry-01-title`. Tier: standard. Scene state: `slip-recede`. Scroll length target: 90vh. Previous: `entry-00-hero` (`slip-open`). Next: `entry-02-fit-gate` (`slip-feed`).

Source documents (names used exactly): 01-creative-direction (CD), 02-design-system (DS), 03-motion-system (MS), 04-webgl-scene (WS), 05-architecture (AR), 06-copy-deck (COPY).

---

## 1. Purpose and narrative beat

**Job of the section.** Name five problems that people report with auto-apply tools, attribute them to "people who used other tools", never name a product, and promise that the rest of the page answers them in writing. It is the only place on the page where the visitor is shown a failure mode before being shown a feature. It earns trust by being the first thing on the page that Kairos does not flatter itself about: one of the five rows can never be settled.

**Narrative beat (CD).** Debits posted as open rows. The rest of the page settles them in writing, append-only.

**What the visitor should think.** "These are the exact things I was afraid of. This page keeps a record of whether it answers them."

**The signature moment, in one paragraph.** Each row's right-hand cell starts as `open · see NN` with an outlined posting square. When the entry that answers the row posts (the visitor scrolls entry 02, 03, 04 or 07 to 85% of the viewport), that row's cell cross-fades to `settled in NN` and its square fills Phosphor White. Settled rows never revert. Row 04 ("Hundreds of applications and zero interviews.") reads `open · see 06` for the whole page, because Kairos cannot promise interviews. A one-line balance under the rows, `Settled 0 of 5 · Open 5`, counts up as the page settles rows and stops at `Settled 4 of 5 · Open 1`. It never reaches 5 of 5, and that is the point. If the visitor approves the sample in entry 04 and scrolls back up, row 03 carries their own local time in a signature box: `settled in 04 · 2:02 PM`.

**Why it is calm.** Nothing is animated on entry except the ledger rules. Text is readable at frame 0. The only moments that move are caused by the visitor's own scrolling or pressing, each lasts 120ms to 600ms, and every one ends.

**Rows settled by which entry (fixed mapping, used by code and tests).**

| Row | Complaint | Settled by entry | Link target when open | Final state |
| --- | --- | --- | --- | --- |
| 01 | Matches that do not fit. | 02 Fit gate | `#entry-02` | settled in 02 |
| 02 | Resumes with skills and metrics the person does not have. | 03 Truth lock | `#entry-03` | settled in 03 |
| 03 | A review step without an edit step. | 04 Approve | `#entry-04` | settled in 04 (plus time if approved) |
| 04 | Hundreds of applications and zero interviews. | never | `#entry-06` | open · see 06 |
| 05 | Charges after cancelling, and lost credits. | 07 Billing | `#entry-07` | settled in 07 |

---

## 2. Content (final copy from 06-copy-deck.md, verbatim; changes flagged)

All strings come from `landingCopy["entry-01-reported"]` (COPY section 6). No em dashes or en dashes. The separator in cells is U+00B7 (middle dot) with a space on each side.

| Key | Element and tag | Final copy |
| --- | --- | --- |
| `number` | Entry number in the head, `<span>` | 01 |
| `eyebrow` | `<p class="lp-caption">`, uppercase | Reported by people who used other tools. Not measured by us. |
| `h2` | `<h2 id="entry-01-title" class="lp-heading">` | Five things people report about auto-apply tools. |
| `lead` | `<p class="lp-body">` | Kairos was designed around these reports. Four are settled further down this page, where you can check each one. One stays open, and we say why. |
| `rows[0].text` | Row 01 complaint | Matches that do not fit. |
| `rows[1].text` | Row 02 complaint | Resumes with skills and metrics the person does not have. |
| `rows[2].text` | Row 03 complaint | A review step without an edit step. |
| `rows[3].text` | Row 04 complaint | Hundreds of applications and zero interviews. |
| `rows[4].text` | Row 05 complaint | Charges after cancelling, and lost credits. |
| `cellOpen` | Cell, server render and first client render | open · see {NN} (rows 01, 02, 03, 05: 02, 03, 04, 07; row 04: 06) |
| `cellSettled` | Cell after the settling entry posts | settled in {NN} (02, 03, 04, 07) |
| `cellSettledStamp` | Row 03 only, after the visitor approved the sample | settled in 04 · {approvedTime} (for example "settled in 04 · 2:02 PM") |
| `cellStaysOpen` | Row 04, always | open · see 06 |
| `footnote` | `<p class="lp-small">`, Sage 60 | We do not name other products. |

Entry titles used inside accessible names (from `ledger-rail.entries`): 02 Fit gate, 03 Truth lock, 04 Approve, 06 Replies, 07 Billing.

### Flagged changes to the copy deck and sibling specs

| # | Change | Why | Who must update |
| --- | --- | --- | --- |
| F1 | Row 02 text: use the copy deck's "Resumes with skills and metrics the person does not have." The section brief abbreviates it to "Skills and metrics the person does not have." | The copy deck is the later, linted source. No change to COPY. | None |
| F2 | **Add** key `entry-01-reported.tally` = "Settled {n} of 5 · Open {m}" (n + m = 5; initial value "Settled 0 of 5 · Open 5"). | The balance line is what makes the page's refusal to reach 5 of 5 visible. Numerals follow M8 (tabular, slashed zero). If the product owner rejects it, delete the `SettleTally` element; nothing else depends on it. Passes the copy lint: no hype words, no dashes. | COPY section 6 |
| F3 | Replace the accessible-name rule `Open. See entry {NN}, {title}` with: visible cell text with the middle dot replaced by a comma, then the entry title. Examples: "open, see 02, Fit gate"; "settled in 04, Approve"; "settled in 04, 2:02 PM, Approve". Keys `squareAriaPosted` and `squareAriaOpen` are therefore not rendered (the words "open" and "settled" are already in the name and on screen). | WCAG 2.5.3 Label in Name: the name must contain the visible words. "See entry 02" does not contain the visible "see 02". The shared claim-chip name (`shared.claimChipName`) is unaffected. | COPY section 6 |
| F4 | Row 03 settles when **entry 04 posts** (a scroll event), like every other row. Pressing Approve does not settle it; it **adds the stamp** to the already settled cell. | CD table 5.3 says "settled in 04 (with the stamp time if approved)". MS section 9 line "Same frame as the click: Entry 01 row 03 settles" reads as if the click settles it. The CD reading is used because settling must mean "the answer has been posted on this page", which is the rule for all rows, and because "scroll never approves" is protected: the settle claims nothing about the visitor's approval. | MS 9.x (sq-approve table): reword to "row 03 gains the stamp" |
| F5 | `formatTime(iso)` is needed: `Intl.DateTimeFormat(undefined, { timeStyle: "short" })`, the `{approvedTime}` of COPY section 0. AR 4.x `format.ts` lists only `formatStamp`. | Row 03 and entries 04 and 10 print time only. | AR `web/lib/landing/format.ts` |

---

## 3. Layout structure

The entry sits inside `[data-story]` (entries 00 to 06), beside the receipt lane. At 1024px and wider text uses grid columns 1 to 7 and the lane (columns 9 to 12) holds the canvas slip. The section never places anything in columns 8 to 12.

### 3.1 Vertical stack (all widths)

| Order | Block | Class | Gap below, 1024+ / below 1024 |
| --- | --- | --- | --- |
| 1 | Entry head: number plus graticule rule | `lp-head` (`--lp-head-h` 32px) | 40px / 32px (head to eyebrow) |
| 2 | Eyebrow | `lp-caption` | 16px / 12px |
| 3 | H2 | `lp-heading` | 24px / 20px |
| 4 | Lead | `lp-body` (`--measure-body` 34rem = 544px) | 48px / 32px |
| 5 | Debit list | `lp-debits` (`<ol>`) | 16px |
| 6 | Balance line | `lp-caption lp-debits__tally` | 16px |
| 7 | Footnote | `lp-small` | `--section-pad-landing`: 128px (1024+), 96px (768 to 1023), 80px (below 768) |

Section top padding 0 (the previous entry's bottom padding is the gap above the rule). `scroll-margin-top: 80px`.

### 3.2 Breakpoint table

| Viewport | Grid | Text/list width | Debit row grid | Row min-height | Notes |
| --- | --- | --- | --- | --- | --- |
| 1440 and 1280 | 12 cols, gap 32, margin 32, col 72 | cols 1 to 7 = 696px; lane cols 9 to 12 = 384px | `40px minmax(0,1fr) 184px`, column gap 16 | 64px (80px when the complaint wraps to 2 lines) | Complaint column 440px. Rail visible (fixed right). H2 on two lines |
| 1024 to 1279 | 12 cols, gap 32, margin 32, col 50.7 at 1024 | cols 1 to 7 = 547px at 1024; lane cols 9 to 12 = 299px | same | 64px / 80px | Complaint column 291px at 1024, usually two lines. Rail hidden; navbar shows "01 / 10" caption |
| 768 to 1023 | 8 cols, gap 24, margin 24 | `max-width: 696px`, left aligned (content width 720 to 975) | same | 64px / 80px | No lane, no canvas. Complaint column 440px at 768. Tape not yet shown (tape begins at entry 02) |
| 640 to 767 | 8 cols, gap 20, margin 16 | full content width 608 to 735, capped at 696px | same | 64px / 80px | |
| 360 to 639 | 4 cols, gap 16, margin 16 | 328px at 360 | `28px minmax(0,1fr)`, column gap 12; cell on its own line in column 2 | 64px, grows with content | Cell link keeps a 44px hit height. Rule ticks stay 11, spacing about 28px |

Row vertical padding is 16px top and bottom; a one-line complaint is 24px tall (16px/24px body), so the 64px min-height governs. Rows snap to the 8px grid; the "32px rhythm" in CD is met at the stack level, not per row. The cell column is 184px so the longest settled cell ("settled in 04 · 10:02 PM", about 177px at 12px/500 plus 14px for the square) never wraps on desktop. Below 640 it may wrap onto two lines without clipping.

### 3.3 Wireframe, desktop (1440 by 900, scrolled so the entry fills the viewport)

```
|<------------------------- container 1280 (content 1216) ------------------------->|
| 01  |--|--|--|[|]|--|--|--|--|--|--|   graticule rule, tick 01 is 8px Phosphor White |
|                                                                                       |
| REPORTED BY PEOPLE WHO USED OTHER TOOLS. NOT MEASURED BY US.     (cols 1-7)          |
|                                                                                       |
| Five things people report                                        +-----------------+ |
| about auto-apply tools.                                          |  receipt lane   | |
|                                                                  |  cols 9-12      | |
| Kairos was designed around these reports. Four are settled       |  canvas slip    | |
| further down this page, where you can check each one. One        |  slip-recede:   | |
| stays open, and we say why.                                      |  smaller, to    | |
|                                                                  |  the right,     | |
| ----------------------------------------------------------       |  turned away,   | |
| 01  Matches that do not fit.                    [] open · see 02 |  dim paper      | |
| ----------------------------------------------------------       |                 | |
| 02  Resumes with skills and metrics the        [] open · see 03  |                 | |
|     person does not have.                                        |                 | |
| ----------------------------------------------------------       |                 | |
| 03  A review step without an edit step.        [] open · see 04  |                 | |
| ----------------------------------------------------------       |                 | |
| 04  Hundreds of applications and zero         [] open · see 06   |                 | |
|     interviews.                                                  |                 | |
| ----------------------------------------------------------       |                 | |
| 05  Charges after cancelling, and lost         [] open · see 07  +-----------------+ |
|     credits.                                                                          |
| ----------------------------------------------------------                            |
|                          Settled 0 of 5 · Open 5   (aligned to the cell column)       |
| We do not name other products.                                                        |
```

`[]` is the outlined 6px posting square (open). After settling it is a filled square.

### 3.4 Wireframe, mobile (360 wide)

```
| 01 |--|--|--|[|]|--|--|--|--|--|--| |   head, 32px
|                                    |
| REPORTED BY PEOPLE WHO USED        |
| OTHER TOOLS. NOT MEASURED BY US.   |
|                                    |
| Five things people                 |   H2, 36px, 3 lines at 360
| report about                       |
| auto-apply tools.                  |
|                                    |
| Kairos was designed around these   |
| reports. Four are settled further  |
| down this page, where you can      |
| check each one. One stays open,    |
| and we say why.                    |
|                                    |
| ---------------------------------- |
| 01  Matches that do not fit.       |
|     [] open · see 02               |   cell on its own line, 44px hit
| ---------------------------------- |
| 02  Resumes with skills and        |
|     metrics the person does not    |
|     have.                          |
|     [] open · see 03               |
| ---------------------------------- |
| ... rows 03, 04, 05 ...            |
| ---------------------------------- |
|     Settled 0 of 5 · Open 5        |
| We do not name other products.     |
```

No lane, no canvas. The tape does not exist yet (it begins at entry 02).

---

## 4. Visual design

### 4.1 Tokens and type roles

| Element | Role/class | Face, size, weight | Colour (token) | Contrast on Void |
| --- | --- | --- | --- | --- |
| Number "01" | `lp-head-num` (Caption) | Inter 12px, 500, +0.6px, `tabular-nums slashed-zero` | Moss 70 `--label` #9cbf93 | 10.3:1 |
| Eyebrow | `lp-caption`, uppercase | Inter 12px/1.33, 500, +0.6px | Moss 70 `--label` | 10.3:1 |
| H2 | `lp-heading` | Inter Tight (`ss01`), 400, `--type-heading-landing` 36 to 56px, line height 1.02, -0.02em, `text-wrap: balance`, `max-width: var(--measure-title)` | Phosphor White `--foreground` #ddffdc | 19.4:1 |
| Lead | `lp-body` | Inter 16px/1.5, 400, -0.022em, `max-width: var(--measure-body)` | Sage 60 `--body` #8cab87 | 8.3:1 |
| Complaint | `lp-body` with `.lp-debit__text` colour override | Inter 16px/1.5, 400 | Phosphor White `--foreground` | 19.4:1 |
| Row number | `lp-caption` | as the head number | Moss 70 | 10.3:1 |
| Cell (open) | `lp-caption` as link, no uppercase | Inter 12px, 500, +0.6px | Fern Link `--link` #859984, 1px underline, 3px offset (`mi-link`) | 6.9:1 |
| Cell (settled) | same | same | Phosphor White, underline Phosphor White | 19.4:1 |
| Stamp (row 03, approved) | M9 inside the cell | Inter 12px, 500, time part only | Phosphor White inside a 1px Phosphor White box | 19.4:1 |
| Balance line | `lp-caption`, `tabular-nums slashed-zero`, no uppercase | Inter 12px, 500 | Moss 70 | 10.3:1 |
| Footnote | `lp-small` | Inter 14px/1.43, 400 | Sage 60 | 8.3:1 |

Weights are 400 and 500 only. No glow, no text shadow. Body text is left aligned. No new colour, no new token. The only new class names are the `lp-debit*` and `lp-settle*` family below, in `landing.css` under `.lp`.

### 4.2 Surfaces and borders

- Background Void `--background` (the section has no panel; it is the page).
- Row hairlines: 1px solid Circuit Border `--border` #485346, decorative. Drawn as `.lp-debit::before { height: 1px; transform-origin: left; }` at the row's top; the last row also gets a bottom hairline.
- The head rule is Phosphor Blue-Black #1f2a33 with 11 ticks per DS 6.1: ticks Circuit Border, 4px tall; the tick for entry 01 is 8px tall, Phosphor White.
- Balance line: top border 1px Circuit Border, 12px padding-top, placed in the cell column (grid column 3 at 640 and wider, column 2 below 640).
- Radius: 0 on everything here (hairlines and squares). The signature box uses a 1px border, radius 0.
- Elevation: none. This entry has no panels, no cards and no shadows.

### 4.3 Motif usage

| Mark | Use in this entry |
| --- | --- |
| M1 | Entry head "01" with tick 01 at 8px Phosphor White |
| M2 | The head rule draws over 600ms; the five row hairlines draw with 60ms stagger (section 6a) |
| M3 | One posting square per row, 6px, 8px gap before the cell word, outlined while open, filled Phosphor White when settled, 300ms colour fill |
| M5 | Not used. The cells are plain links, not claim chips (six claim chips are reserved for other entries) |
| M6 | Not used. These are reported complaints, not sample data |
| M8 | Entry number, row numbers, cell numbers and the balance line use tabular slashed-zero numerals ("0 of 5" shows a slashed zero) |
| M9 | Row 03 after approval: the time sits in a 1px Phosphor White signature box inside the cell. The stamp records a decision and never counts down |
| M7 | Not used (perforations appear only on the receipt, the mint band edges and above the footer) |

### 4.4 Lime

**No lime element is in this entry.** Lime custody sits with the navbar "Start free" (candidate `navbar`) while this entry is in view, because the hero CTA has left the viewport and the next in-page action (entry 04 Approve) is far below. The `LimeCustody` island performs the hand-over (150ms out, 150ms in) when the hero CTA leaves; this entry neither triggers nor blocks it. Cells, squares and stamps are never lime. Status colours (`--good`, `--warn`, `--bad`) are not used; "settled" is Phosphor White plus a filled square plus the word.

### 4.5 Composition notes

- The complaint is the largest, whitest text in each row. The cell is small, dim while open and white when settled, so as the visitor scrolls the right edge of the list visibly "fills in" row by row, with row 04 staying dim at the bottom of the filled column. This is the page's quietest chart.
- Alignment: the balance line shares the cell column's left edge, so the eye reads cells then total, as in a ledger.

---

## 5. WebGL

| Property | Value |
| --- | --- |
| Scene state | `slip-recede` (entry attribute `data-scene="slip-recede"`) |
| Pose (WS table) | position (+0.15, -0.06, -0.8) as fractions of lane width and viewport height and world units; rotation (4, -24, 0) degrees; scale 0.82; paper level `uLevel` 0.65 (mixed toward Ground Iron) |
| Prints | Nothing. No new receipt line is posted by this entry |
| Pointer tilt | Off |
| Entered from | `slip-open`, scrubbed over this entry's local progress `u` 0 to 0.25: `smoothstep`, then the per-frame approach (`POSE_LAMBDA` 7.7 on time, equivalent to the 0.12 lerp at 60fps). Scrubs back if the visitor scrolls up |
| Left to | `slip-feed`, owned by entry 02 from its `u` 0 to 0.25 (scale back to 0.96, level back to 1.00). The recede pose holds from `u` 0.25 until entry 02's `u` = 0, which is at `u` = H / (0.7 x vh + H) of this entry (H = entry height including bottom padding); about 0.59 at 1440 by 900 and about 0.56 at 1280 by 720 |
| Tier gating | Tier 2 and tier 1: the WebGL slip. Tier 0 (low, DOM motion) and static tier 0: the DOM lane receipt (`LaneReceipt`: header and "00 · Ledger opened" on mint paper) stays in its resting pose; WS marks this state's fallback "n/a, 0KB". This entry adds no requirement beyond that |
| Below 1024px | No lane, no canvas. The hero's mini receipt has scrolled away. Nothing replaces it here |

### DOM over canvas layering

- The canvas is the single fixed layer at `--lp-z-canvas`; this entry's text is at `--lp-z-content` above it. The lane aside (`[data-lane]`) occupies columns 9 to 12 only.
- Text in columns 1 to 7 can never overlap the slip: at 1280 by 800 the lane is 384px wide and the slip 265px wide. With the +0.15 offset (about +58px) and a -24 degree turn, the slip's projected box starts at least 117px inside the lane's left edge, i.e. at least 149px (117 plus the 32px column gap) to the right of column 7's right edge. This is asserted by the e2e check in section 11.
- Because there is no overlap, **no text in this entry sits over canvas pixels**, so no text-over-canvas contrast pairing exists. The only contrast that matters is text on Void, listed in 4.1. The dimmed paper (level 0.65) is a design choice so the lit slip does not compete with the five rows.
- The canvas is `aria-hidden`; the lane's `<aside aria-label="Sample receipt">` carries the text alternative for the whole scene (hero spec). This entry adds nothing to it.

---

## 6. Animation choreography

Principles in force (MS 1): every move ends, text is readable at frame 0, nothing fades in, the page only moves forward, at most 2 motion groups at once.

### 6a. Entrance timeline (entry post)

Trigger: `EntryPoster` marks the entry `data-post="pending"` at hydration only if its top is below 85% of the viewport; it sets `data-post="live"` when the top crosses 85% (`ENTRY_START`), then calls `ledgerStore.post("01")`. If the entry is in view or above at hydration it is `data-post="instant"` and never animates. No JavaScript: no `data-post`, final state.

The hidden start state applies only to the head rule, the tick of this entry stays visible at frame 0 as part of the rule, and the five row hairlines. Eyebrow, H2 words (a mask, see below), lead, complaints, cells, balance line and footnote are all present at frame 0.

| Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger | Preset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Head rule (with tick 01) | `transform` scaleX | 0 (origin left) | 1 | `--dur-post` 600ms | 0ms | `--ease-post` cubic-bezier(0.22,1,0.36,1) | `data-post="live"` | `en-post-rule` |
| Other 10 ticks | visibility (step) | hidden | shown | none (step) | `calc(var(--i) * 60ms)` | none | with the rule | `en-post-rule` (DS 6.2) |
| H2 lines (1024+; SplitText mask, `autoSplit`) | `yPercent` | 115 (`--rise-line`) | 0 | `--dur-rise` 700ms | 80ms delay, 70ms (`--stagger-line`) between the 2 lines; ends at 850ms | `--ease-post` | ScrollTrigger `entry-01:title`, `start: "top 85%"`, `once: true` | `kt-line-rise` |
| H2 whole title (below 1024; CSS) | `transform` translateY | 115% | 0 | 700ms | 80ms (`--delay-rise`) | `--ease-post` | `data-post="live"` | `kt-title-rise` |
| Row hairlines 1 to 5 | `transform` scaleX | 0 (origin left) | 1 | 600ms | starts at 240ms, then `calc(var(--i) * var(--stagger-row))` with `--i` 0 to 4 (60ms): last starts 480ms, ends 1080ms | `--ease-post` | `data-post="live"` | `en-post-rule` applied to `.lp-debit::before` (deviation D1) |
| Eyebrow, lead, complaints, cells, squares, balance, footnote | none | present | present | 0 | 0 | none | none | none (A4: body has no entrance) |

Motion groups running: the entry post is one group (head rule, ticks, title, row hairlines on one timeline or one state change). The `slip-open` to `slip-recede` pose scrub is pointer/scroll-following and does not count. Peak: 1 group.

**Deviation D1 (proposed).** MS 3.3 lists the entry rule only. Drawing the five row hairlines on the same `en-post-rule` preset costs one pseudo-element each, is CSS only, works at every width, and makes "debits posted as rows" literal without hiding any text. If rejected, remove `.lp-debit::before` animation and keep the hairlines static; nothing else changes.

### 6b. Scroll-linked behaviour

- **Pin:** none. **Scrub:** none on DOM. The only scrubbed object is the canvas pose (`ho-pose`), driven by `sceneInput.u` for this entry.
- **ScrollTriggers (1024+ with Full motion):** `entry-01:title` (title rise, above) with `refreshPriority: 1`. A scene driver trigger uses `trigger: #entry-01, start: "top 85%" (ENTRY_START), end: "bottom 15%" (ENTRY_END), scrub: true`, writes `sceneInput.entry = "01"` and `sceneInput.u`. Posting itself is done by `EntryPoster` at every width, not by ScrollTrigger.
- **Settling triggers (every width):** not scroll-linked; they are store-linked. Entry 02, 03, 04 and 07 each call `ledgerStore.post(NN)` when they cross 85%; `SettleCell` reads `posted`.

Progress-to-value mapping (values at 1440 by 900, H of about 916px including bottom padding, so entry 02 takes over at `u` about 0.59):

| Entry 01 `u` | Event | DOM | Canvas pose |
| --- | --- | --- | --- |
| below 0 | Hero is the active entry | Head rule hidden (scaleX 0) if the entry was below the fold at hydration; text readable | `slip-open` |
| 0 | Entry posts | Rule draws, H2 rises (80ms later), row hairlines stagger in | Pose scrub starts |
| 0 to 0.25 | Pose scrub | no change | scale 1.00 to 0.82; `uLevel` 1.00 to 0.65; x 0 to +0.15; y 0 to -0.06; z 0 to -0.8; rotation (6,-14,2) to (4,-24,0), all smoothstepped |
| 0.25 to about 0.59 | Reading the rows | All rows `open` unless the visitor has already posted later entries (reload, anchor jump) | `slip-recede` held, tilt off |
| about 0.59 (entry 02 `u` = 0) | Entry 02 posts | Row 01 swaps to `settled in 02`; tally becomes "Settled 1 of 5 · Open 4" | Starts blending toward `slip-feed` |
| 0.59 to 1.0 | Entry 01 leaves | Rows scroll off | `slip-feed` continues (entry 02) |
| Later: entry 03 posts | Row 02 settles (off screen, so instant) | tally 2 of 5 | n/a |
| Later: entry 04 posts | Row 03 settles (instant); if approved, the stamp is added | tally 3 of 5 | n/a |
| Later: entry 07 posts | Row 05 settles (instant) | tally "Settled 4 of 5 · Open 1" | no canvas |
| End of page | Row 04 still `open · see 06` | | |

### 6c. Settle choreography (the signature)

State source: `useLedger(s => s.posted.has(settlesIn))` and `useLedger(s => s.approvedAt)`. Server snapshot has an empty set, so first client render equals the HTML.

Three stacked texts per cell in one grid cell (`grid-area: 1 / 1`): open, settled and (row 03 only) stamped. The cell's width is always the widest text, so a swap causes zero layout shift (CLS 0). Only the active text is in the accessibility tree (the link carries one `aria-label`; the three spans are `aria-hidden`).

| Step | Element | Property | From | To | Duration | Easing | Condition | Preset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Old text | `opacity` | 1 | 0 | `--dur-swap` 120ms | `--ease-linear` | cell is in the viewport (`data-inview="true"`) | `kt-cell-swap` |
| 1 | New text | `opacity` | 0 | 1 | 120ms (simultaneous with the old text) | linear | same | `kt-cell-swap` |
| 2 | Posting square | `background-color` | transparent | Phosphor White (the 1px Circuit Border outline stays) | `--dur-colour` 300ms | `--ease-utility` | always transitions when in view | `en-post-square` |
| 3 | Underline and text colour | `color` | Fern Link | Phosphor White | 300ms | `--ease-utility` | in view | `mi-link` states |
| 4 | Balance line | text content | previous count | new count | none (instant) | none | always; scroll-caused numerals swap without a roll (MS 4.5) | none |
| 5 | Row 03 only, on Approve | stamped text appears | settled text | `settled in 04 · {approvedTime}` with the time in a 1px Phosphor White box | instant (row is off screen); if in view, 120ms swap | linear | `approvedAt` set | `kt-cell-swap` |

If the cell is not in the viewport when the state changes, `data-inview` is false, transitions are `none`, and the cell is simply in its new state when scrolled into view. This covers rows 02, 03 and 05 almost always, and row 01 when the visitor jumps by anchor.

Behaviour rules:
- Settled is monotonic: nothing in the code path sets a cell back to open. Row 04 has `settlesIn = null`, always renders the open text and never receives a swap.
- Interruption: if a second settle arrives during a running swap, the first completes instantly (MS 3.5); this is only theoretically possible because each entry settles a different row.
- Monotonic posting (MS 3.3): jumping to `#entry-07` posts 00 to 07 instantly (`data-post="instant"`); rows 01, 02, 03, 05 are settled with no transition.
- Reload mid-page: the ledger is rebuilt from the page's own posting (earlier entries post instantly on hydration). The approval stamp survives reload through `sessionStorage` (`kairos:landing:ledger:v1`); first render shows row 03 unstamped, then stamped after mount, off screen.

### 6d. Micro-interactions

| Target | Hover | Focus | Press |
| --- | --- | --- | --- |
| Cell link (all rows) | `mi-link`: text and underline go to Phosphor White, 300ms `--ease-utility`. No transform. The posting square does not change | `mi-focus`: the global 2px focus ring with 2px offset, radius 0; the link box is 44px tall with `padding-block: 13px` so the ring is not clipped | Colour holds; no scale, no movement |
| Complaint text, hairlines, balance, footnote | none (not interactive) | not focusable | none |
| Cursor | native cursor everywhere (MS: no custom cursor) | | |

Anchor behaviour: activating a cell link scrolls to the target entry with the standard anchor rule (`scroll-padding-top: 80px`, smooth scroll up to `SMOOTH_ANCHOR_MAX_VH` = 2 viewport heights, instant beyond), moves focus to the target H2 (`tabindex="-1"`). It does not change any ledger state by itself; the target entry posts through the ordinary posting rule, which is also what settles the row.

### 6e. Hand-off to the next section

1. As entry 02's top crosses 85%, entry 02 posts (its rule, its title).
2. In the same frame `ledgerStore.post("02")` runs; row 01 (usually still visible near the top of the viewport at that moment: at 1440 by 900 the five rows span roughly y 280 to 600) cross-fades to "settled in 02" and fills its square. The tally becomes "Settled 1 of 5 · Open 4".
3. The canvas begins to approach the `slip-feed` pose (scale 0.96, level 1.0) as entry 02's `u` rises through 0.25; the feed itself starts at entry 02 `u` 0.20.
4. Motion group count at this moment: entry 02 post (1) and the cell swap (1) = 2, the permitted maximum. The feed (`sq-feed-stop`) starts roughly 400px of scroll later, after the 120ms swap has ended, so a third group never overlaps.

The visitor therefore sees cause and effect on one screen: a new entry is posted at the bottom, and a debit is struck off at the top.

---

## 7. Reduced-motion, no-JS and low-tier variants

| Variant | Behaviour |
| --- | --- |
| **Reduced motion** (OS preference or the footer Motion control = Reduced; tokens zeroed to 0.01ms under `html[data-motion="reduced"] .lp`) | No hidden start state: rule, ticks and row hairlines are drawn at first paint. H2 not split, no rise. Cell swap is a one-frame change. Posting square colour fill is kept at 300ms (colour is not motion; MS `en-post-square` row). Canvas pose changes are cut to the target pose with no approach (WS idle rules). Balance line identical. Content, order and meaning are unchanged |
| **No JavaScript** | Server HTML shows the five rows with `open · see NN` links that work as in-page anchors (row 04 to `#entry-06`). No `data-post`, so no hidden state. The lead sentence is still true because the linked entries do settle them in writing. The balance line reads "Settled 0 of 5 · Open 5" (literally true: nothing has been posted); if the owner prefers, remove it with F2 |
| **Below 1024px** (no GSAP, no canvas) | `EntryPoster` handles posting; title rise by CSS (`kt-title-rise`); the rule and hairlines by CSS; swaps and squares by CSS. Nothing in the entry depends on GSAP |
| **Tier 1/2 WebGL unavailable or context lost** | Tier 0: DOM lane receipt stays at rest; entry 01 content and behaviour unchanged |
| **Save-Data or slow network** | Entry 01 has no assets; unaffected |
| **Fonts late** | `adjustFontFallback` fallbacks keep the line box within 1px; SplitText `autoSplit` re-splits the H2 if the font swaps before the rise, and uses final state if the rise has run |
| **Pointer-only, touch** | Cells have a 44px hit height and 8px spacing between hit areas (rows are 64px apart). No hover-only information exists |
| **Forced colours / high contrast** | Text uses system colours; hairlines and ticks use `CanvasText`-mapped borders; the posting square keeps a 1px border and fills with `CanvasText`, so open versus settled remains visible by shape as well as by the words |

---

## 8. Accessibility

**Landmarks and headings.** `<section id="entry-01" aria-labelledby="entry-01-title" data-section="entry-01-reported" data-entry="01" data-scene="slip-recede" class="lp-entry">` inside `<main id="main">`. One `<h2 id="entry-01-title" tabindex="-1">`. No h3. The debit list is `<ol class="lp-debits">` with five `<li>`; the numbers 01 to 05 are real text inside each item (not list markers), so order is exposed twice and consistently.

**Reading order (DOM).** Head (number real text; rule and ticks `aria-hidden`), eyebrow, H2, lead, list rows 01 to 05 (number, complaint, cell link), balance line, footnote.

**Focus order.** Navbar and hero controls, then the five cell links in row order, then entry 02. Nothing else in the entry is focusable. After an in-page jump to `#entry-01` (rail, tape or navbar caption), focus goes to the H2.

**Accessible names (flag F3).**

| State | Visible text | Link `aria-label` |
| --- | --- | --- |
| Row 01 open | open · see 02 | open, see 02, Fit gate |
| Row 02 open | open · see 03 | open, see 03, Truth lock |
| Row 03 open | open · see 04 | open, see 04, Approve |
| Row 04 always | open · see 06 | open, see 06, Replies |
| Row 05 open | open · see 07 | open, see 07, Billing |
| Row 01 settled | settled in 02 | settled in 02, Fit gate |
| Row 02 settled | settled in 03 | settled in 03, Truth lock |
| Row 03 settled | settled in 04 | settled in 04, Approve |
| Row 03 settled with stamp | settled in 04 · 2:02 PM | settled in 04, 2:02 PM, Approve |
| Row 05 settled | settled in 07 | settled in 07, Billing |

The visible words are always contained in the name (WCAG 2.5.3). The posting square and the signature box border are `aria-hidden` (decorative, redundant with the words). Colour is never the only carrier of state (WCAG 1.4.1): the words "open" and "settled" are on screen.

**Live regions.** None in this entry. Changes here are caused by scrolling, and announcing them would interrupt reading. The Approve action's own polite live region is in entry 04 and announces the approval; the stamp added to row 03 is not announced a second time.

**Screen-reader text for visuals.** The head rule and ticks are `aria-hidden`; the position of this entry is communicated by the real number "01" and the heading. The canvas is `aria-hidden`; the receipt `<aside>` provides the scene's text alternative.

**Contrast (WCAG 2.2 AA).** Every pairing is text on Void #000000: Phosphor White 19.4:1; Sage 60 8.3:1; Moss 70 about 10.3:1; Fern Link 6.9:1. No new pairing is introduced. Non-text: hairlines and the open-square outline use Circuit Border (about 2.6:1); they are decorative and the state they hint at is stated in text, so SC 1.4.11 does not apply to them. Focus ring: Phosphor White on Void, above 3:1.

**Target size (A16/WCAG 2.5.8).** Cell link box 44px tall minimum, 8px or more between neighbours. The cell column is at least 168px wide.

**Zoom and reflow.** At 320 CSS px (400% zoom) the row grid collapses to the two-column mobile layout; no horizontal scroll. Text spacing overrides do not clip: the rows have no fixed height, only `min-height`.

**Motion safety.** No flashing; the longest motion in the entry is 1080ms; no autoplay beyond the entry post.

---

## 9. Performance notes

- **What animates.** `transform: scaleX` on the head rule and 5 row hairlines (6 elements, compositor only); `transform: translateY` on the H2 mask inner (1 to 2 elements); `opacity` on at most 2 text spans per settle; `background-color` on 1 square per settle. No layout properties are animated. No `box-shadow`, no filter.
- **Layers.** At most 8 promoted layers during the post (rule, 5 hairlines, 2 title lines). `will-change: transform` is set only by the `data-post="pending"` selector and removed when the post ends (MS 13: at most `MAX_WILL_CHANGE` = 4 concurrently by policy; the 6 rule elements share one stagger and are released together as one group; if the policy cap is enforced strictly, apply `will-change` only to the head rule and the H2 inner, and let the five thin hairlines animate with transform alone).
- **Element count.** Roughly 70 DOM nodes: head 13 (rule, 11 ticks, number), eyebrow, H2 (plus about 4 split nodes before revert), lead, list with 5 rows of about 8 nodes (number, complaint, link, square, 3 stacked spans at most), balance, footnote.
- **JavaScript.** `SettleCell` x5 and `SettleTally` x1 share one module and one store subscription each through `useSyncExternalStore`. Selectors return booleans or strings, so scrolling causes **zero** React renders; renders occur only when an entry posts (4 times per visit) or on approval. Estimated size 1.2 KB gzip, inside the 20 KB islands budget. One shared `IntersectionObserver` (not one per cell) toggles `data-inview` with `rootMargin: "0px"`, `threshold: 0`.
- **CSS.** About 1.0 KB gzip added to `landing.css` and 0.4 KB to `motion.css`.
- **Assets.** None. No image, no icon file, no extra font, no new request. The posting square and the signature box are CSS borders and backgrounds.
- **CLS.** 0. Stacked texts fix the cell width; row height is `min-height` plus content, identical in all states; the balance line reserves one line.
- **LCP/INP.** The section is below the fold at load and never LCP. Interactions are links only. No handler does layout reads.
- **Canvas cost.** `slip-recede` prints nothing and the pose is held, so the renderer is idle between the 0 to 0.25 scrub and the next state; frames are drawn only while the pose is approaching its target (WS idle behaviour).

---

## 10. Implementation

### 10.1 Files

| Path | Type | Role |
| --- | --- | --- |
| `web/components/landing/entries/entry-01-reported.tsx` | Server component | Renders the whole entry from `landingCopy["entry-01-reported"]`; exports `Entry01Reported` |
| `web/components/landing/entries/entry.tsx` | Server component (shared, exists in AR) | Entry wrapper: `<section>` attributes (`id`, `data-section`, `data-entry`, `data-scene`, `aria-labelledby`), the M1 head, the kt-title mask markup. Reused, not modified |
| `web/components/landing/islands/settle-cell.tsx` | Client component | Exports `SettleCell` and `SettleTally` |
| `web/lib/landing/debits.ts` | Plain module (server and client) | `DEBITS` constant: `[{ row, settlesIn, seeEntry }, ...]`, and pure `isSettled(debit, posted)` and `settledCount(posted)`. One source of truth for rendering, tally and tests |
| `web/lib/landing/debits.test.ts` | Vitest | Mapping and monotonic behaviour (section 11) |
| `web/components/landing/landing.css` | CSS | `.lp-debits`, `.lp-debit`, `.lp-debit__num`, `.lp-debit__text`, `.lp-settle`, `.lp-settle__t`, `.lp-settle__stamp`, `.lp-debits__tally` |
| `web/components/landing/motion.css` | CSS | Hidden start state for `.lp-debit::before`, `.kt-cell-swap` rules, `[data-post]` rules for the hairlines |
| `web/lib/landing/format.ts` | Plain module (existing) | Add `formatTime(iso)` (flag F5) |
| `web/content/landing-copy.ts` | Copy | Add `entry-01-reported.tally` (flag F2) |

No new dependencies. GSAP is used only through the existing `kt-line-rise` and scene driver; this entry writes no GSAP code of its own.

### 10.2 Types and props

```ts
// web/lib/landing/debits.ts
import type { EntryId } from "@/lib/landing/sections";
export type DebitRow = "01" | "02" | "03" | "04" | "05";
export interface Debit {
  row: DebitRow;
  settlesIn: EntryId | null; // null: never settles (row 04)
  seeEntry: EntryId;         // link target: "02" "03" "04" "06" "07"
}
export const DEBITS: readonly Debit[] = [
  { row: "01", settlesIn: "02", seeEntry: "02" },
  { row: "02", settlesIn: "03", seeEntry: "03" },
  { row: "03", settlesIn: "04", seeEntry: "04" },
  { row: "04", settlesIn: null, seeEntry: "06" },
  { row: "05", settlesIn: "07", seeEntry: "07" },
] as const;
export const isSettled = (d: Debit, posted: ReadonlySet<EntryId>) =>
  d.settlesIn !== null && posted.has(d.settlesIn);
```

```tsx
// web/components/landing/islands/settle-cell.tsx  ("use client")
type SettleCellProps = {
  debit: Debit;            // from DEBITS
  seeTitle: string;        // "Fit gate" etc., from ledger-rail.entries
  openText: string;        // "open · see 02", {NN} already filled on the server
  settledText: string;     // "settled in 02"; for row 04 pass the same as openText
  stampedTemplate?: string; // row 03 only: "settled in 04 · {approvedTime}"
};
export function SettleCell(props: SettleCellProps): JSX.Element;

type SettleTallyProps = { template: string }; // "Settled {n} of 5 · Open {m}"
export function SettleTally(props: SettleTallyProps): JSX.Element;
```

Markup produced by `SettleCell`:

```html
<a class="lp-settle mi-link" href="#entry-02" data-state="open" data-inview="false"
   aria-label="open, see 02, Fit gate">
  <span class="lp-post lp-post--pending" aria-hidden="true"></span>
  <span class="lp-settle__t kt-cell-swap" data-on="true"  aria-hidden="true">open · see 02</span>
  <span class="lp-settle__t kt-cell-swap" data-on="false" aria-hidden="true">settled in 02</span>
</a>
```

Row 03 adds a third `lp-settle__t` for the stamp whose time is wrapped in `<span class="lp-stamp">` (1px Phosphor White box, 2px 6px padding, radius 0). `data-state` is `open`, `settled` or `stamped`. The square gets `lp-post` (filled) instead of `lp-post--pending` when settled.

Core CSS (token names only; values are the DS tokens):

```css
.lp-debits { list-style: none; margin: 0; padding: 0; max-width: 696px; }
.lp-debit { position: relative; display: grid; align-items: center; min-height: 64px;
  grid-template-columns: 40px minmax(0, 1fr) 184px; column-gap: 16px; padding-block: 16px; }
.lp-debit::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 1px;
  background: var(--border); transform-origin: left; }
.lp-debit:last-child { border-bottom: 1px solid var(--border); }
.lp-settle { display: grid; grid-template-columns: 6px 1fr; column-gap: 8px; align-items: center;
  min-height: 44px; font: 500 12px/1.33 var(--font-inter); letter-spacing: 0.6px; color: var(--link);
  text-decoration: underline; text-underline-offset: 3px; transition: color var(--dur-colour) var(--ease-utility); }
.lp-settle[data-state="settled"], .lp-settle[data-state="stamped"] { color: var(--foreground); }
.lp-settle__t { grid-area: 1 / 2; opacity: 0; }
.lp-settle__t[data-on="true"] { opacity: 1; }
.lp-settle[data-inview="true"] .lp-settle__t { transition: opacity var(--dur-swap) var(--ease-linear); }
.lp-post { width: 6px; height: 6px; border: 1px solid var(--border); box-sizing: border-box; }
.lp-settle[data-state="open"] .lp-post { background: transparent; }
.lp-settle:not([data-state="open"]) .lp-post { background: var(--foreground); border-color: var(--foreground); }
@media (max-width: 639px) {
  .lp-debit { grid-template-columns: 28px minmax(0, 1fr); column-gap: 12px; }
  .lp-settle { grid-column: 2; }
}
```

(The 6px square is drawn as a 6px box with a 1px border, as DS 6.3 specifies "1px solid Circuit Border, transparent fill"; the settled fill uses `background-color`, which is what transitions.)

Hidden start state (motion.css, JS-applied attribute only):

```css
[data-post="pending"] .lp-debit::before { transform: scaleX(0); }
[data-post="live"] .lp-debit::before { transform: none;
  transition: transform var(--dur-post) var(--ease-post)
  calc(240ms + var(--i) * var(--stagger-row)); }   /* --i set inline: 0 to 4 */
[data-post="instant"] * { transition-duration: 0.01ms !important; }
```

### 10.3 Server versus client

- `Entry01Reported`: server. It fills `{NN}` in the copy strings, passes plain strings to the islands, sets `style="--i:N"` on each `<li>`, and renders the H2 with the shared kt-title markup.
- `SettleCell`, `SettleTally`: client islands. Server render equals first client render (state `open`, count 0).
- `EntryPoster`, `SmoothScroll`, `LimeCustody`, the scene driver: unchanged and shared.

### 10.4 Presets and tokens used

Presets: `en-post-rule`, `en-post-square`, `kt-line-rise`, `kt-title-rise`, `kt-cell-swap`, `ho-pose` (canvas), `mi-link`, `mi-focus`. Not used: `en-row-print`, `en-compare-post`, `em-*`, `sq-*`.

Tokens: `--background`, `--foreground`, `--body`, `--label`, `--link`, `--border`, `--type-heading-landing`, `--lh-heading-landing`, `--tracking-heading-landing`, `--measure-title`, `--measure-body`, `--lp-head-h`, `--lp-hit`, `--lp-hit-gap`, `--section-pad-landing`, `--ease-post`, `--ease-linear`, `--ease-utility`, `--dur-post`, `--dur-rise`, `--dur-swap`, `--dur-colour`, `--stagger-row`, `--stagger-line`, `--delay-rise`, `--rise-line`. No new tokens.

### 10.5 Existing components reused

`Entry` wrapper, the M1 head component (`marks/`), `kt-title` mask markup, `EntryPoster`, `ledgerStore`/`useLedger`, `sections.ts` (`ENTRIES`, `EntryId`), `format.ts`. No shared app component from `web/components/shared/` is used.

---

## 11. Acceptance criteria

Each item is testable by Vitest (V), Playwright (E) or manual review (M).

**Content**
1. (E) The entry text matches `landingCopy["entry-01-reported"]` exactly: eyebrow, H2, lead, five complaints, footnote. (V) The copy contains no U+2014 or U+2013 and no product names.
2. (E) Server HTML (JavaScript disabled) contains the five rows, five links `open · see 02`, `03`, `04`, `06`, `07`, and each link navigates to its anchor.
3. (V) `DEBITS` maps rows to 02, 03, 04, none, 07; row 04's `seeEntry` is "06" and `settlesIn` is null.

**Settling behaviour**
4. (E) Scrolling so that `#entry-02` crosses 85% of the viewport turns row 01 into `settled in 02` with a filled square; rows 02 to 05 are unchanged. The balance reads "Settled 1 of 5 · Open 4".
5. (E) After scrolling past entry 07, rows 01, 02, 03 and 05 read `settled in NN`, row 04 reads `open · see 06`, and the balance reads "Settled 4 of 5 · Open 1". Row 04's text is never `settled`.
6. (E) Scrolling back up past entry 01 does not change any cell (append-only). (V) `isSettled` is monotonic for any growing `posted` set.
7. (E) Loading `/#entry-07` directly settles rows 01, 02, 03 and 05 on first visible paint with no running transition (`data-post="instant"`; computed transition duration at most 0.01ms).
8. (E) With `approvedAt` set (press Approve in entry 04), scrolling to entry 01 shows row 03 as `settled in 04 · {time}` where the time equals the stamp in entry 04, inside an element with a 1px Phosphor White border. Without approval the stamp is absent and row 03 still reads `settled in 04` after entry 04 posts.
9. (E) Pressing Approve does not alter rows 01, 02, 04 or 05 and does not change the balance count.
10. (E) Scrolling alone never produces the stamp.

**Layout**
11. (E, screenshot) At 1440, 1280, 1024, 768, 640 and 360 widths: no horizontal scroll; rows match section 3.2 (cell column 184px from 640 up, stacked cell below 640); complaint wraps without clipping.
12. (E) At 1280 by 800, the bounding box of every entry-01 text element ends at least 32px left of `[data-lane]`'s left edge, and in `slip-recede` the canvas slip's projected box (from `window.__kairosStage.bodyRect`) starts right of column 7's right edge.
13. (E) Cell link hit boxes are at least 44px tall, and vertical gaps between hit boxes are at least 8px.
14. (E) CLS caused by any cell state change is 0 (`layout-shift` observer).

**Motion**
15. (E) At hydration with the entry below the fold: `data-post="pending"`; the head rule and row hairlines are scaleX 0 while all text has opacity 1 and is visible (readable at frame 0); at 85% crossing: head rule transition 600ms with `--ease-post`, H2 rises with start 80ms and 70ms stagger, hairline transitions start at 240ms plus 60ms per row.
16. (E) Eyebrow, lead, complaints, cells, balance and footnote have no transform or opacity transition on entry.
17. (E) The cell swap runs 120ms linear on `opacity` only when `data-inview="true"`; otherwise no transition. The square fill runs 300ms.
18. (E) At no moment during the entry post plus a settle are more than 2 motion groups active (MS Q5 sampler).
19. (E) Reduced motion (emulated media or Motion control = Reduced): rule and hairlines are drawn at first paint, H2 is unsplit, swaps are instant, all content and states are identical, canvas pose cuts without easing.
20. (E, tier 2) `data-scene="slip-recede"` is active from entry 01 `u` 0 to entry 02 `u` 0; the pose values converge to scale 0.82, `uLevel` 0.65, rotation (4,-24,0) within 600ms of reaching `u` 0.25 and scrub back when scrolling up.

**Accessibility**
21. (E, axe) Zero violations; one h2 `#entry-01-title` with `tabindex="-1"`; the list is an `ol` with 5 items; the section is labelled by the h2.
22. (E) Every cell link's accessible name equals the table in section 8 and contains its visible text (label in name).
23. (E) Tab order inside the entry is exactly the five cell links in row order; focus ring is visible (2px) on each; activating a link moves focus to the target H2.
24. (E) No `aria-live` region is added or updated by this entry.
25. (M) With a screen reader, the list is announced as five items; each state ("open" or "settled") is audible without relying on colour.
26. (V) Contrast check on the six text pairings in 4.1 passes AA (4.5:1) using the tokens' hex values.

**Performance and robustness**
27. (E) Scrolling through the entry causes zero React renders of `SettleCell` and `SettleTally` except at entry posts (assert with `window.__kairos.renders`).
28. (E) With JavaScript disabled, no element in the entry has `opacity: 0` other than the stacked inactive texts, and no content is hidden.
29. (E) The entry adds no network request (no image, font or script of its own); the JS added for this entry is at most 1.5 KB gzip.
30. (E) Navigating to `/pricing` and back leaves the settled cells, balance and stamp in place without re-running any transition (Activity behaviour, AR `activity.spec.ts`).
