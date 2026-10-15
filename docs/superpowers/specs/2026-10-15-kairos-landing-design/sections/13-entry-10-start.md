# Entry 10: Start (your ledger)

Section id `entry-10-start`, anchor `#entry-10`, heading id `entry-10-title`, tier standard, scroll length about 100vh, WebGL state `slip-fresh`. Previous section: `entry-09-questions` (state `none`). Next section: `footer` (state `none`, opaque Void, covers the canvas).

Source documents used, named the way the other specs name them: CD = `01-creative-direction.md`, DS = `02-design-system.md`, MS = `03-motion-system.md`, GL = `04-webgl-scene.md`, ARCH = `05-architecture.md`, COPY = `06-copy-deck.md`. Sibling section specs consulted for hand-offs: `12-entry-09-questions.md` and `14-footer.md`.

Reading key: "u" is the entry's local scroll progress (a ScrollTrigger from `top 85%` to `bottom 15%`, MS 5.3). Viewport sizes are written width by height. All durations and curves are existing tokens from MS 2; no token is introduced by this section.

---

## 1. Purpose and narrative beat

**Job of the section.** Ask once. After nine entries that only showed, this is the single place the page asks the visitor to do something: start with 25 free applications. It must feel like the last line of a ledger being closed and the first line of the visitor's own ledger being opened, and it must not add pressure. Nothing here is a countdown, a scarcity claim or a discount.

**Beat (CD).** The sample ledger ends, and the visitor's own would begin with one row.

**How the section delivers the beat.**

1. The sample paper (everything the visitor watched print, including the 48 feed rows, the approval stamp and the filed receipt) lifts out of the lane and leaves. Nothing about the sample is kept on screen.
2. A new, short slip feeds up from the print head. Its header reads `KAIROS · AT SIGN-UP`. It prints exactly one line: `+25 credits · free grant · never expires`. This is the row that sign-up creates (PRD AC1), so it is a product guarantee, not sample data.
3. The slip takes the same pose as the hero slip (rotation 6, -14, 2 degrees). The page opened on a blank slip with one line, and it closes on a blank slip with one line. The hero line said "Ledger opened". This line is a credit, which is the first thing a real ledger would hold.
4. Then everything stops. The motion grammar of the page is that every move ends, and this is the last move. The remaining screen time is stillness around one lime button.

**Chronos and kairos echo.** Entry 04 was the kairos moment (the visitor chose when). Here the page repeats the visitor's own decision back to them if they made it: "You approved the sample at 2:02 PM." The time is the same value that was stamped in entry 04, read from the store, never recomputed.

**What this section does not do.** It settles no debit row, shows no SAMPLE chip, no claim chip, no posting square, no dashed edge and no price. It makes no claim beyond three facts already registered in the copy deck (25 free applications, free once, credits never expire). It adds no testimonials, counts or urgency.

---

## 2. Content (final copy from 06-copy-deck.md, verbatim; flags below)

All strings come from `landingCopy["entry-10-start"]` and `landingCopy.scene.lines`. Components hold no inline copy.

| Key | Element | Copy (verbatim) | Notes |
| --- | --- | --- | --- |
| `entry-10-start.number` | Entry number, M1 | 10 | Real text, Caption role |
| `entry-10-start.eyebrow` | Eyebrow, Caption role | Start | Uppercase by CSS, not in the string |
| `entry-10-start.h2` | H2 | Try it on 25 real applications. | 31 characters. Expected break at every width: "Try it on 25 / real applications." |
| `entry-10-start.body` | Body, server default | Every application waits for your approval. | Rendered on the server and for every visitor who has not approved |
| `entry-10-start.bodyApproved` | Body, replaces the default after the sample approval | You approved the sample at {approvedTime}. Every real application waits for you the same way. | Split once on `{approvedTime}`; see flag F2 |
| `entry-10-start.cta` | Primary action, `data-lime-candidate="closing"` | Start free | Links to `/sign-up`. The accessible name never changes with lime custody |
| `entry-10-start.microcopy` | 14px under the button | 25 submitted applications, free, once. The free credits never expire. | Source: plans.ts `free.features[0]`, PRC Rollover |
| `entry-10-start.laneCaption` | 14px under the fresh slip | A new slip. The first row of your own ledger. | Under the slip at 1024px and wider, under the mini slip below |
| `scene.lines.10header` (GL id `signup-header`) | Slip header | KAIROS · AT SIGN-UP | Printed on paper B, not marked SAMPLE |
| `scene.lines.10` (GL id `l10`) | Slip line | +25 credits · free grant · never expires | M8: signed, worded, tabular. Source: PRD AC1 and PRC Rollover |

Not used: `entry-10-start.h2Alt` ("Your first 25 applications are free.") stays in the copy module as the documented alternate and is not rendered.

Characters in the strings: U+00B7 middle dot as separator and the ASCII plus sign. No em dash or en dash appears in any string, and none appears in this document.

**Flags (changes or gaps this section needs, with the reason).**

| # | Flag | Reason and decision |
| --- | --- | --- |
| F1 | New copy key `entry-10-start.laneAsideAria` = "New slip at sign-up" (19 characters) | The fresh lane is a `complementary` landmark and needs a name. Entry 00 already has `laneAsideAria` ("Sample receipt"). Add the key to COPY section 15 and `landing-copy.ts` |
| F2 | The approved sentence needs a time-only formatter | COPY defines `{approvedTime}` as `Intl.DateTimeFormat(undefined, { timeStyle: "short" })` (example "2:02 PM"). ARCH 4.3.1 says one formatter, `formatStamp` (date and time), is used for entry 10. That would print "at 10/15/26, 2:02 PM", which breaks the sentence. Decision: add `formatApprovedTime(iso)` to `web/lib/landing/format.ts` and use it here. ARCH should be corrected |
| F3 | Sequence length differs between MS and GL | MS 9.8 says `sq-fresh` is "about 1.7s" with a 520ms paper advance. GL 5.5 is the owner of canvas timings and gives 3,160ms (lift 600, feed 900 with `--ease-feed`, flatten 120, print 1,040, hold 200, unflatten 600, less overlaps; see 6a). This spec follows GL. MS 9.8 should be corrected. Both are under the 5s limit of WCAG 2.2.2 and started by the visitor's scroll |
| F4 | Entry 09 spec (section 6d, row "Leaving to entry 10") says the lift starts when entry 10's top crosses `ENTRY_START` | Canonical (CD, MS 3.6, GL 5.5) is: the canvas fades in at `top 85%` and the lift starts at u = 0.20. This spec follows the canonical values. The entry 09 sentence should say "fade-in" for the 85% crossing |
| F5 | GL 8.5 lists the fallback for `slip-fresh` as "Lane receipt plus a new group" | At entry 10 the story lane (entries 00 to 06) has already scrolled away, so the entry has its own lane and shows only the fresh slip. The sample lines stay in the story lane list. See section 5 and flag F6 |
| F6 | `LaneReceipt` needs a `scope` prop (`"story"` or `"fresh"`), and `receipt-lines.ts` must keep `signup-header` and `l10` out of the story list | Otherwise the two sign-up lines would be appended to the `<ol id="receipt-lines">` that sits in the entry 00 to 06 lane, where they would render in the wrong place at tier 0 |
| F7 | `ReceiptTape` must ignore `10header` and `10` | The tape's accessible name is "Sample receipt. Latest line: ...". The sign-up row is not a sample line, and showing it in the tape would blur the end of the sample |
| F8 | Requirement on GL: paper A is a function of the entry, not of history | After `sq-fresh` has played, scrolling back to entries 00 to 06 must show paper A again (alpha 1, lift 0). Only entry 10 shows paper B. The append-only rule applies to printed lines, never to which paper is visible. See section 5 |

---

## 3. Layout structure

### 3.1 Grid and placement by breakpoint

The landing grid is DS 4.1 (`.lp-container`, `.lp-grid`). Text is never placed in the lane columns. Spacing values are DS 4.3.

| Viewport | Columns, margin, gap | Head (number plus rule) | Text block | Slip or mini slip | Entry min-height |
| --- | --- | --- | --- | --- | --- |
| 1440 by 900 | 12, 32 inside a 1280 container (80px page margin each side), 32 | Cols 1 to 12, 32px tall | Cols 1 to 7 (x 112 to 808, 696px). Body measure 34rem (544px) | Lane cols 9 to 12 (x 944 to 1328, 384px). Canvas slip 301 by 677, centre y 482 | `calc(100svh - 64px)` = 836 |
| 1280 by 800 | 12, 32, 32 | Cols 1 to 12 | Cols 1 to 7 (x 32 to 728, 696px) | Lane x 864 to 1248 (384px). Slip 265 by 596, centre y 432 | 736 |
| 1024 by 768 | 12, 32, 32 (column 50.67px) | Cols 1 to 12 | Cols 1 to 7 (x 32 to 579, 547px) | Lane x 693 to 992 (299px). Slip 253 by 570, centre y 416 | 704 |
| 768 by 1024 | 8, 24, 24 (column 69px) | Cols 1 to 8 | Cols 1 to 8, stacked | DOM mini slip in the column below the microcopy, `width: min(100%, 400px)` | None (content height) |
| 640 by 900 | 8, 16, 20 (column 58.5px) | Cols 1 to 8 | Cols 1 to 8, stacked. CTA auto width | Same as 768 | None |
| 360 to 639 | 4, 16, 16 (column 70px at 360) | Cols 1 to 4 | Cols 1 to 4, stacked. CTA full width | DOM mini slip, full content width (328px at 360) | None |

Slip height is 2.25 times slip width (GL 5.1). The lane is the same grid columns that the story lane uses (ARCH 2.4), so the Stage's single `[data-lane]` measurement serves entry 10 too.

At 1280 and wider the ledger rail sits in the gutter (24px column at `right: 8px` from 1280 to 1439, `right: 24px` from 1440). It is outside the 1216px content box, so it never touches the lane. From 1024 to 1279 the navbar caption reads "10 / 10" (that component's job, not this section's).

### 3.2 Vertical rhythm (px)

| Gap | 1024 and wider | Below 1024 |
| --- | --- | --- |
| Section padding below content (`--section-pad-landing`) | 128 | 96 at 768 to 1023, 80 below 768 |
| Entry head row height (`--lp-head-h`) | 32 | 32 |
| Head to eyebrow | 40 | 32 |
| Eyebrow to H2 | 16 | 12 |
| H2 to body | 24 | 20 |
| Body to CTA | 40 | 32 |
| CTA to microcopy | 16 | 16 |
| Microcopy to mini slip | not applicable (lane is beside) | 32 |
| Mini slip to caption | not applicable | 12 |
| Slip bottom edge to caption top (canvas mode) | 16 | not applicable |

At 1024 and wider the section is a flex column with `min-height: calc(100svh - 64px)`. The head sits at the top. The text block has `margin-block: auto` so it is centred in the remaining space. This puts the text block, the CTA and the slip in one visual band at the docked position (section top at 64px), and it keeps the CTA clear of the very bottom edge.

Reserved heights, to prevent layout shift when the body text is swapped by `ApprovedLine`: the body paragraph has `min-height: 3lh` below 640px and `min-height: 2lh` from 640px up (the approved sentence is 95 characters, which is three lines in a 328px column at 18px and two lines in a 544px measure at 18 or 20px; the default sentence needs one or two). The microcopy has no reserved height (it is not swapped).

### 3.3 Fixed positions of the canvas-mode caption (1024px and wider)

The slip is viewport-fixed (GL 5.1): centre x is the lane centre, centre y is `64 + (100lvh - 64) / 2`. The caption must be under that rectangle for any scroll position, so in canvas mode it is `position: fixed` and positioned from the same formula.

| Viewport | Slip rectangle y (top to bottom) | Caption top (slip bottom + 16) | Caption bottom (20px line) | Fits in viewport |
| --- | --- | --- | --- | --- |
| 1024 by 768 | 131 to 701 | 717 | 737 | Yes |
| 1280 by 800 | 134 to 730 | 746 | 766 | Yes |
| 1440 by 900 | 143.5 to 820.5 | 836.5 | 856.5 | Yes |
| 1920 by 1080 | 205 to 939 | 955 | 975 | Yes |
| 1024 by 600 | 115 to 549 (slip 193 wide) | 565 | 585 | Yes |

CSS: `top: calc(64px + (100lvh - 64px) / 2 + 1.125 * var(--slip-w) + 16px)`, `width: 100cqw` (the lane aside is the query container), horizontal position left at its static value (`left: auto`), `--slip-w` as defined on the lane in GL 8.5: `min(85cqw, calc(0.36 * (100lvh - 64px)))`.

### 3.4 Wireframe, desktop (1440 by 900, docked position: section top at y 64)

```
 y
 0   +--------------------------------------------------------------------------------------------+
     | NAVBAR 64px   [K] Kairos    How it works  Pricing  Blog  About        Log in  [Start free] |  <- Start free is Default (not lime)
 64  +--------------------------------------------------------------------------------------------+
     |  x=112                                                         x=944                x=1328 |
 64  |  10 |-|-|-|-|-|-|-|-|-|-|================================================================| |  M1 head: tick 10 is 8px, Phosphor White
 96  |                                                                                            |
     |                                                                  .--- print head ---.      |
     |                                                                  |  KAIROS · AT      |      |
 277 |  START                                                           |  SIGN-UP          |      |  canvas slip 301 x 677
 293 |                                                                  |                   |      |  centre y 482, y 143.5 to 820.5
 309 |  Try it on 25                                                    |  +25 credits ·    |      |  pose (6,-14,2), fresh paper
     |  real applications.                                              |  free grant ·     |      |
 423 |                                                                  |  never expires    |      |
 447 |  Every application waits for                                     |                   |      |
     |  your approval.   (or the approved sentence, 2 lines)            |                   |      |
 507 |                                                                  |                   |      |
 547 |  [ Start free ]   <- the one lime element                        |                   |      |
 595 |  25 submitted applications, free, once.                          |                   |      |
 611 |  The free credits never expire.                                  '-------------------'      |
 631 |                                                                  A new slip. The first row  |  caption y 836 to 856
     |                                                                  of your own ledger.        |
 900 +--------------------------------------------------------------------------------------------+
        text cols 1 to 7 (112 to 808)       col 8 buffer (808 to 944)        lane cols 9 to 12
```

### 3.5 Wireframe, mobile (360 by 800, scrolled so the section fills the viewport)

```
 +--------------------------------+  0
 | NAVBAR 64                      |
 +--------------------------------+  64
 | TAPE 48 (Sample receipt ...)   |
 +--------------------------------+  112
 |  16px                  16px    |
 |  10 |-|-|-|-|-|-|-|-|-|-|=====|  head 32
 |                                |
 |  START                         |
 |  Try it on 25                  |  36px type, 2 lines
 |  real applications.            |
 |  Every application waits for   |  18px lead, reserved 3 lines
 |  your approval.                |
 |  [        Start free        ]  |  48px, full width, lime owner
 |  25 submitted applications,    |
 |  free, once. The free credits  |
 |  never expire.                 |
 |  ..............................|  M7 perforated top of the paper
 |  : KAIROS · AT SIGN-UP         |  mint paper, 0 radius, 328px wide
 |  : +25 credits · free grant ·  |
 |  : never expires               |
 |  '-----------------------------'
 |  A new slip. The first row of  |  14px, Sage 60, on Void
 |  your own ledger.              |
 +--------------------------------+
```

---

## 4. Visual design

### 4.1 Tokens and roles

| Element | Role class | Face and size | Colour | Notes |
| --- | --- | --- | --- | --- |
| Entry number "10" | `.lp-caption` | Inter 12px 500, +0.6px, `tabular-nums slashed-zero` | Moss 70 `#9cbf93` on Void, 10.29:1 | Min width 2ch |
| Entry rule and ticks | `.lp-head-rule`, `.lp-head-tick` | 1px rule Phosphor Blue-Black; 11 ticks 4px tall Circuit Border | Tick 10 is 8px tall, Phosphor White | Decorative, `aria-hidden` |
| Eyebrow "Start" | `.lp-caption`, uppercase | Inter 12px 500 | Moss 70 | |
| H2 | `.lp-heading` | Inter Tight 400, `--type-heading-landing` (36px at 360, 46.5 at 1024, 55.7 at 1440, 56 cap), line height 1.02, -0.02em, `text-wrap: balance`, `max-width: var(--measure-title)` | Phosphor White, 19.41:1 | |
| Body | `.lp-lead` | Inter 400, 18px below 768, 20px from 768, line height 1.5, `max-width: var(--measure-body)` | Moss 80 `#aed2a4`, 12.55:1 | The role is reused from DS 3.1 (hero subhead); entry 10 has one sentence and the ask is the point of the screen, so the lead size is used instead of 16px body |
| Approved time | `<time>` inside the lead | Same size, `tabular-nums slashed-zero` | Phosphor White, 19.41:1 | A colour step from Moss 80. No box, no underline, no weight change |
| CTA | `.lp-btn` | Inter 500, 16px, 48px tall, 9999px radius, padding 0 24px | Lime state: Void on Lime Pulse, 14.32:1. Fallback: Phosphor White on Ground Iron, 16.41:1, 1px Phosphor White border | Owner only when `html[data-lime-owner="closing"]` |
| Microcopy | `.lp-small` | Inter 400, 14px, line height 1.43 | Sage 60 `#8cab87`, 8.29:1 | `max-width: var(--measure-body)` |
| Lane caption | `.lp-small` | Inter 400, 14px | Sage 60 on Void | Never over the slip: it sits below the slip rectangle |
| Mini or lane slip (DOM) | `ReceiptPaper` | Header Inter 12px 500 uppercase +0.08em `--on-mint-ink`; row Inter 14px 400 `--on-mint-body`, `tabular-nums slashed-zero`, rows at least 32px | Paper `--receipt-paper` (Mint Frost `#def0dd`), 0px radius | Ink 17.61:1, body 14.89:1 |

### 4.2 Surfaces, borders, motif usage

- **Page surface:** Void `#000000` for all text. No card, no panel, no Ground Iron surface other than the fallback state of the button.
- **Borders:** the head rule only. No hairline cards, no dashed edge anywhere in this section (dashed means sample or not real yet, and the sign-up row is a stated guarantee, not sample data; see 4.4).
- **M1/M2:** entry head with 11 ticks, tick 10 current (8px, Phosphor White, at `left: calc(100% - 1px)`), rule draws once.
- **M7:** the DOM slip carries its perforated top as part of `ReceiptPaper`, which is the receipt's own perforation (one of the three allowed places). Entry 10 draws no other perforation. The footer draws its own perforation rule below this section (footer spec); entry 10 must not draw a bottom rule.
- **M8:** `+25 credits` is signed and worded; `25` in the H2 and microcopy is tabular with slashed zero (no zero appears, but the class is inherited from `.lp`).
- **M10:** the CTA is the closing candidate.
- **Not used here:** M3 posting square, M4 and M5 chips, M6 sample mark, M9 box (the approved time is plain text, see 4.1).
- **Elevation, radius:** no shadow. The CTA is a pill (custody candidates are pills); the slip is 0px.

### 4.3 Which element is this viewport's one lime element

`entry-10-start.cta` ("Start free", `data-lime-candidate="closing"`), priority 4. The rule is DS 5.3: it is lime while any pixel of it is in the viewport and no higher-priority candidate (approve, hero, pro) is in the viewport. None of those can be on screen together with it (entry 07 is at least 170vh above). The navbar "Start free" renders its fallback (Default) style while the closing CTA is visible, and the menu sheet button follows the navbar rule.

At 1440 by 900 the CTA's top edge is about 483px below the section top (computed from 3.2 with a one-line default body; 2 lines of body adds nothing because the 2lh minimum is already reserved). It enters the viewport bottom edge when the section top is at about 417px, which is u of about 0.24, shortly after the lift starts (u 0.20, section top 472px). So the lime hand-over (navbar to closing) happens during or just after the sample paper has left, which is intended: lime arrives as the new slip starts to print. This relation depends on viewport height; no code depends on it.

On leaving, lime returns to the navbar when the CTA exits the viewport (footer spec): 150ms release, 150ms fill.

### 4.4 Why the fresh slip is not marked SAMPLE

The sample receipt carried "SAMPLE" in its header and the demos carried SAMPLE chips and dashed edges because their contents were synthetic. The sign-up slip prints a documented product rule (PRD AC1: sign-up posts a +25 credit ledger row; PRC: the free grant never expires). It is an illustration of a real guarantee, and the caption says it is the first row of "your own ledger", not a row that exists. Therefore: solid edge, no chip. The header `KAIROS · AT SIGN-UP` is the label that separates it from the sample, and it deliberately drops the word SAMPLE. If the product owner prefers a stricter reading (the row does not exist until sign-up), the fallback is to append `· EXAMPLE` to the header in both the canvas and the DOM. That is not specified as the default because it would add a string not present in the copy deck.

---

## 5. WebGL

### 5.1 State and transitions

| Item | Value |
| --- | --- |
| State id | `slip-fresh` (`data-scene="slip-fresh"` on the section) |
| Previous state | `none` (entries 07 to 09: canvas `visibility: hidden`, zero renders) |
| Entered | Entry 10 top crosses 85% of the viewport. Canvas wrapper `opacity` 0 to 1 over 400ms linear (`en-canvas-return`; tier 1: 240ms). The pose is set directly while hidden: offset (0, 0, 0), rotation (6, -14, 2), scale 1.00, `uCurl` 1, `uLevel` 1.00, paper A in the lane with whatever has printed |
| Signature | At u = 0.20, once: `sq-fresh` (6a) |
| Pointer tilt | Eligible after the print ends, tier 2 and fine pointer only: up to 6 degrees on y and 3 on x, critically damped (`mi-tilt`). Off at tier 1 |
| Left, scrolling down | The footer is opaque Void at `--lp-z-content` and covers the lane; no authored transition. The stage renders zero frames once nothing changes |
| Left, scrolling up | Entry 10 top returns below 85%: `ex-canvas-out` (400ms linear, then `visibility: hidden`). Paper B stays as printed; the lift never reverses |
| Return after leaving | Entering entry 10 again shows paper B (header and line) in the lane pose, replayed without a sweep (GL 3.5); nothing prints again |
| Reload mid page | Print state comes from `ledgerStore.printed` (sessionStorage). If `10` is in `printed`, the canvas shows paper B immediately, no lift, no feed |
| Arrival by anchor or skip | `sq-fresh` plays once in full after the canvas fade-in, provided `10` is not in `printed`. The queue rule of GL 3.7 applies when more than two earlier prints are queued: all but the last print at once. The visitor never sees the earlier lines print in sequence on the way. Rule: `sq-fresh` plays if and only if `10` is not in `printed` |

Requirement on GL (flag F8): paper A visibility is derived from `sceneInput.entry` and `printed.includes("10")`. In entries 00 to 06 paper A is visible whatever has happened at entry 10; at entry 10, A is visible until the lift and gone after it, and B appears. Without this rule, a visitor who scrolls back to the hero after the lift would see an empty lane.

### 5.2 DOM over canvas, layering

| Layer | Element | z-index token | Notes |
| --- | --- | --- | --- |
| Canvas | `.stage-root` fixed, `pointer-events: none` | `--lp-z-canvas` (0) | One canvas for the whole page; nothing in this section creates a second |
| Text, CTA | The section's grid items | `--lp-z-content` | Cols 1 to 7 only. Column 8 is a buffer. Never over the slip |
| Fresh lane `<aside>` | `[data-lane]`, cols 9 to 12 | `--lp-z-content` | Holds the DOM slip and the caption |
| Caption (canvas mode) | `position: fixed` | `--lp-z-content` | Hidden until its conditions hold (5.3) |
| Rail, navbar | | `--lp-z-rail`, `--lp-z-navbar` | Above |
| Footer | opaque Void | `--lp-z-content`, later in DOM order | Covers canvas and caption |

Section 6 note on `contain`: the entry section must not have `transform`, `filter`, `contain: paint` or `content-visibility: auto`, because any of those would turn the fixed caption into a section-relative element.

### 5.3 Fresh lane DOM (the text alternative and the fallback)

```html
<aside data-lane class="lp-lane lp-start__lane" aria-label="New slip at sign-up" data-scope="fresh">
  <div class="lp-start__paper">            <!-- ReceiptPaper, visually hidden when html[data-stage-ready="true"] -->
    <ol>
      <li>KAIROS · AT SIGN-UP</li>
      <li>+25 credits · free grant · never expires</li>
    </ol>
  </div>
  <p class="lp-small lp-start__caption">A new slip. The first row of your own ledger.</p>
</aside>
```

- The `<ol>` is rendered by `LaneReceipt scope="fresh"` from `receipt-lines.ts` (the same source as the canvas texture), so a screen reader hears what is printed. Both items exist in the server HTML (no-JavaScript final state). Prints are never announced; there is no live region.
- **Canvas mode** (`html[data-stage-ready="true"]`, 1024px and wider, tier 1 or 2): the paper wrapper gets the visually-hidden pattern (still read by assistive technology). The caption becomes `position: fixed` as in 3.3 with `visibility: hidden`. It becomes visible only when both hold: the section has `data-window="on"` (written by the `entry-10:pose` ScrollTrigger's `onToggle`, true between `top 85%` and `bottom 15%`) and the aside has `data-printed="true"` (written by `LaneReceipt` when `printed` includes `10`, which GL records at the start of the line print, t = 1,200ms). It appears in one frame with no transition (a step, not an entrance), so the caption never fades in. This keeps the caption from announcing a "new slip" over a sample paper that has not left.
- **DOM mode** (tier 0, below 1024px, Reduced, no JavaScript): the paper is in normal flow and visible, the caption is in normal flow under it, and nothing is fixed. At 1024px and wider the aside occupies cols 9 to 12, top-aligned with the eyebrow row. Below 1024px it is a normal block below the microcopy (3.1).

### 5.4 Text contrast over the canvas

All body text sits on pure Void (the canvas clears to transparent outside the slip; GL 6.3). Measured on Void: H2 19.41:1, lead 12.55:1, microcopy and caption 8.29:1, eyebrow and number 10.29:1. No text is placed over mint paper except the DOM slip's own ink (17.61:1 and 14.89:1). The buffer column and the lane inset (the slip is at most 85% of lane width) keep at least 114px (1024) and 136px (1440) between text and the slip's silhouette at any tilt.

---

## 6. Animation choreography

### 6a. Entrance timeline

Times are relative to the trigger of each row. "Post" is the entry post: `EntryPoster` sets `data-post="live"` when the section top crosses 85% of the viewport (MS 5.7). Start state is applied by script only when the section is below 85% at hydration; a section already in view is `data-post="instant"` and never animates. Without JavaScript nothing is hidden.

| # | Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Entry rule (`en-post-rule`) | `transform: scaleX`, origin left | 0 | 1 | 600ms (`--dur-post`) | 0 | `--ease-post` | Post |
| 2 | Ticks 00 to 10 | Visibility step (no tween) | hidden | shown | 0 | `calc(var(--i) * 60ms)`; tick 10 at 600ms | none | Post |
| 3 | Number "10", eyebrow | none | | | | | | Visible at once |
| 4 | H2, 1024px and wider (`kt-line-rise`) | `yPercent` per line in masks | 115 | 0 | 700ms (`--dur-rise`) | Delay 80ms (`--delay-rise`), stagger 70ms (`--stagger-line`) | `--ease-post` | `entry-10:title`, `top 85%`, `once` |
| 5 | H2, below 1024px (`kt-title-rise`) | `translateY` of the whole title in one mask | 115% | 0 | 700ms | Delay 80ms | `--ease-post` | `data-post="live"` |
| 6 | Body, CTA, microcopy | none | | | | | | Body text has no entrance (A4) |
| 7 | Canvas wrapper (`en-canvas-return`) | `opacity` | 0 | 1 | 400ms (`--dur-handoff`); tier 1: 240ms | 0 | `--ease-linear` | `entry-10:pose` start, `top 85%`, tier 1 or 2 |
| 8 | Paper A lift (`ex-slip-lift`, canvas) | Position y of paper A, upward | 0 | +1.15 slip heights | 600ms (`--dur-post`) | t = 0 | `--ease-travel` | u crosses 0.20, once |
| 9 | Paper A alpha | `uAlpha` | 1 | 0 | 360ms | t = 240ms (ends at 600ms) | linear | Same sequence |
| 10 | Paper B feed (canvas) | Paper B advance from the print head, 0 to 216 texels | 0 | 216 | 900ms | t = 300ms (ends at 1,200ms) | `--ease-feed` | Same sequence; `ledgerStore.print("10header")` at t = 300ms |
| 11 | Flatten (`f`) | Pose and tilt factor | 1 | 0 | 120ms | t = 1,200ms | `--ease-post` | Same sequence |
| 12 | Print `+25 credits ...` (`em-print`, two rows) | Head advance 420ms, paper advance 520ms per row | | | 1,040ms for both rows | Step starts at t = 1,200ms; `print("10")` is recorded then; flatten takes the first 120ms, so ink starts at t = 1,320ms and ends at 2,360ms | `--ease-post` | Same sequence |
| 13 | Caption (canvas mode) | Visibility step | hidden | visible | 0 | At the start of the print (t = 1,200ms) | none | `printed` includes `10` and `data-window="on"` |
| 14 | Hold | none | | | 200ms | After the print | | |
| 15 | Unflatten | Pose and tilt factor | 0 | 1 | 600ms | After the hold | `--ease-post` | Same sequence |
| 16 | DOM slip rows (`en-row-print`), tier 0 and below 1024px | `opacity` and `translateY` | 0 and 6px | 1 and 0 | 240ms (`--dur-row`) | Header at 0, line at 60ms (`--stagger-row`) | `--ease-post` | `IntersectionObserver` threshold 0.5 on the slip, once; calls `print("10header")` then `print("10")` |
| 17 | Caption (DOM mode) | none | | | | | | Present from first paint; step-hidden only in canvas mode |
| 18 | Lime hand-over (`ho-lime`) | `background-color`, `border-color`, `color` | fallback | lime | 150ms out (navbar), 150ms in (CTA, delayed 150ms) | Sequential | `--ease-utility` | `LimeCustody` observes the CTA entering the viewport |

Canvas sequence total (rows 8 to 15): 300 + 900 = 1,200ms to the feed end; 1,200 + 120 + 1,040 + 200 + 600 = 3,160ms (flag F3). The print line is two rows (GL 3.5 B layout), hence 1,040ms. Rows 9 and 10 overlap row 8 (the lift) on purpose: the old paper is leaving as the new paper arrives.

**Motion groups running at once (MS 3.4 limit is 2).** The entry post (rows 1 to 5) counts as one, `sq-fresh` as one; the canvas fade-in (row 7) finishes 400ms after the post and `sq-fresh` waits for u = 0.20, which is about 293px of scroll later at 1440 by 900. If a fast scroll would start a third group, the newest trigger waits up to 300ms and otherwise posts instantly (MS 3.4). The lime hand-over is colour only and is not counted.

**Interruption.** Scroll never interrupts `sq-fresh`; once started it finishes even if the visitor scrolls away (`fastScrollEnd: true` completes it if the visitor leaves the range at speed). Switching the Motion control to Reduced completes it at once (`completeAll()`), and the stage unmounts.

### 6b. Scroll-linked behaviour

No pin, no scrub, no snapping. The section is normal flow.

**ScrollTriggers (1024px and wider, effective Full motion, GSAP loaded).** All use `refreshPriority: 10`.

| id | Trigger element | start | end | Mode | What it does |
| --- | --- | --- | --- | --- | --- |
| `entry-10:title` | `#entry-10` | `top 85%` | none | `once: true` | Plays `kt-line-rise` |
| `entry-10:pose` | `#entry-10` | `top 85%` | `bottom 15%` | Standalone, `onUpdate` writes `u` to `sceneInput`; `onToggle` writes `data-window`; `fastScrollEnd: true`; `invalidateOnRefresh: true` | Canvas return, threshold at u 0.20, caption window |

Below 1024px no GSAP is loaded: `EntryPoster` handles the post and the title (`kt-title-rise`), and one `IntersectionObserver` (threshold 0.5) drives the slip rows.

**Progress to value mapping (1440 by 900, section height 836px, range length 1,466px = 836 + 0.70 x 900; other viewports scale with the same formula).**

| u | Section top (px from viewport top) | Canvas | Scene | DOM | Lime owner |
| --- | --- | --- | --- | --- | --- |
| below 0 | above 765 | Hidden (`none`) | | Section not yet posted | Navbar |
| 0 | 765 | Fades in over 400ms | Paper A in lane, pose (6, -14, 2) | Rule draws, H2 rises | Navbar |
| 0.10 | 618 | Visible | Hold | Complete | Navbar |
| 0.20 | 472 | | `sq-fresh` starts: lift, feed | Caption still hidden | Navbar |
| 0.24 | about 417 | | Feed in progress | CTA enters viewport | Hand-over to closing (150 + 150ms) |
| 0.25 | 399 | | Pose blend complete (nothing left to blend) | | Closing |
| 0.41 | 164 | | Print ends at t = 2,360ms, hold, then unflatten; ends at 3,160ms (about 1.2 seconds of normal scrolling after the start) | Caption visible since t = 1,200ms | Closing |
| 0.50 to 1.00 | 33 to -701 | Still. Tilt follows the pointer (tier 2, fine pointer) | Zero frames at rest | `data-window` on until u = 1 | Closing until the CTA leaves the viewport |
| above 1 | below -701 | Covered by the opaque footer | | Caption hidden by `data-window="off"` | Navbar after the CTA leaves |

(The u values for the print end are indicative; the sequence is time-based and does not depend on scroll after it starts.)

### 6c. Micro-interactions

All CSS, hover rules inside `@media (hover: hover) and (pointer: fine)`, no `transition: all`.

| Element | Hover | Focus-visible | Press | Disabled |
| --- | --- | --- | --- | --- |
| CTA as owner (`mi-lime`) | Fill `--accent-hover` `#6ddb57` (Void label 11.92:1), 300ms `--ease-utility` | `mi-focus`: 2px Phosphor White outline, 2px offset, instant | Colour holds, no transform, no scale | n/a |
| CTA as non-owner (`mi-default`) | Fill Carbon Veil, 300ms. Never turns lime on hover (DS L5) | Same outline | Colour holds | n/a |
| Navbar "Start free" (not part of this section) | Per navbar spec | | | |
| Slip (canvas) | Pointer tilt (`mi-tilt`): critically damped, up to 6 and 3 degrees, only after the print, tier 2, fine pointer | n/a (not interactive) | n/a | |
| Caption, microcopy, H2, body, `<time>` | none | none | none | |

The slip has no hover or click response of its own and the canvas never captures pointer events, so the CTA is always the only target.

### 6d. Hand-off to the next section

1. **Lime.** When the CTA leaves the viewport (scrolling into the footer), `LimeCustody` hands lime to the navbar: closing releases over 150ms, navbar fills over 150ms after a 150ms delay. The footer takes no part (footer spec).
2. **Canvas.** The footer is an opaque Void surface at `--lp-z-content` later in the DOM, so it covers the lane. No transition is authored for this hand-off. The stage keeps its final `slip-fresh` pose and stops rendering when nothing changes. Scrolling back up uncovers the same still pose.
3. **Perforation.** The footer's own M7 rule draws left to right (600ms, `--ease-post`) when the footer top reaches 85% of the viewport. Entry 10 ends with its 128px bottom padding and draws nothing at its bottom edge, so the footer's perforation reads as the tear line under the last entry.
4. **Rail and tape.** The rail's current entry stays 10. The tape stops after entry 10 (footer spec).
5. **Focus.** Focus order continues from the CTA to the footer's first focusable item.

---

## 7. Reduced-motion, no-JS and low-tier variants

| Condition | H2 and rule | Slip | Caption | Lime | Notes |
| --- | --- | --- | --- | --- | --- |
| Full motion, tier 2, 1024px and wider | Rule draws, H2 line rise | Canvas: lift, feed, print, tilt | Fixed, step reveal at print start | Hand-over 150 + 150ms | The designed experience |
| Tier 1 (medium device) | Same | Canvas at 30fps, no curl, no tilt, half-size texture; fade 240ms; same timings (dt-corrected) | Same | Same | GL 8.3 |
| Tier 0 by hardware (no WebGL 2 or software renderer) at 1024px and wider, motion allowed | Same | DOM slip in the lane columns, in flow; rows print with `en-row-print` at 50% in view; no lift (the story lane left with entry 06) | In flow under the slip, present from first paint | Same | The WebGL chunk is never downloaded |
| Below 1024px | Rule draws, `kt-title-rise` (no GSAP, no Lenis) | DOM slip below the microcopy; rows print at 50% in view | In flow under the slip | Same (one `IntersectionObserver`) | Phone composition (CD 9.1) |
| Reduced (OS or Motion control) at any width | Rule drawn, title static, no mask, no transform | DOM slip with both rows present at first paint; no canvas chunk is downloaded | In flow | Instant swap (durations 0) | Colour hover transitions (300ms) are kept |
| Reduced chosen while `sq-fresh` is running | | Every running tween jumps to its end (`completeAll()`), the stage unmounts, `data-stage-ready` is removed, the DOM slip becomes visible | | | GL 7.3 |
| No JavaScript | Everything in final state; no `data-post`, no hidden start state | DOM slip with both rows | In flow | `data-lime-owner="hero"` is in the server HTML, so the closing CTA renders its fallback style (Ground fill, white border) and only the hero CTA is lime. The link still works | DS L8. The default body sentence is shown; the approved sentence cannot be known on the server |
| Forced colors | Text in system colours | Canvas hidden, DOM slip shown with a 1px `CanvasText` border added in the forced-colors block so the paper edge remains visible | In flow | Lime is dropped by the browser; the button keeps its 1px border | The button must keep `border: 1px solid` |
| WebGL error or context lost | | Error boundary demotes to tier 0 and the DOM slip appears; on context loss the stage restores and replays without a sweep from `ledgerStore` | Rules above | | GL 11 |
| Save-Data or `prefers-reduced-data` | | Tier 0 (GL 8.2 row 4) | | | |
| Print stylesheet | Visible | DOM slip visible, canvas absent | Visible | Button visible with its border | |

---

## 8. Accessibility

**Landmarks and headings.** `<section id="entry-10" data-section="entry-10-start" aria-labelledby="entry-10-title">` is a region inside `<main id="main">`. The H2 is `id="entry-10-title" tabindex="-1" data-split="lines"`; `SplitText` is configured with `aria: "auto"` and the split is reverted after the rise, so the heading text is never absent from the accessibility tree. The fresh lane is an `<aside aria-label="New slip at sign-up">` (complementary landmark, name from flag F1). Heading levels: one H2 in the section, no H3.

**Focus order.** H2 (programmatic focus target only, reached by anchor or skip link; focus moves there with `preventScroll`), then the CTA link, then the next page stop (the footer). The aside has no focusable content. DOM order is: head, eyebrow, H2, body, CTA, microcopy, aside. Visual order at 1024px and wider puts the aside on the right by grid placement without changing DOM order. `scroll-padding-top` is 80px at 1024 and wider, 128px below, so the focused CTA is never hidden under the navbar or tape (WCAG 2.4.11).

**CTA.** A native `<a href="/sign-up">` (Next.js `Link`) with visible text "Start free"; 48px tall (target size above the 44px landing minimum, A16); at least 8px from any other target; `aria-describedby="entry-10-micro"` pointing at the microcopy so a screen reader hears "25 submitted applications, free, once. The free credits never expire." after the name. The navbar has a second link with the same name and URL; that is acceptable (different landmarks, same destination). The accessible name never changes with lime custody. Route change uses `ho-route` (240ms cross-fade, 0s under Reduced).

**Approved sentence.** Swapped by `ApprovedLine` after mount from the store. It is not a live region, because it is page content that appears on hydration and the visitor already heard the approval announced in entry 04. The time is `<time dateTime="{iso}">{formatApprovedTime(iso)}</time>` so the value is machine readable. No colour-only meaning: the time is also in the words.

**Screen-reader text for visuals.** The canvas (`aria-hidden="true"`) has no alternative of its own. The text alternative is the aside's `<ol>` (two items, exactly the printed strings). The DOM mini slip is the same list. The posting of the row is never announced. The decorative rule and ticks are `aria-hidden`. The number "10" is real text per DS 6.1; the H2 carries the label.

**Motion safety.** No flashing; the longest automatic sequence is 3,160ms and is started by the visitor's scroll (WCAG 2.2.2 not triggered). The Motion control (hero lane caption and footer) pauses and stops it (completes it and unmounts the stage). Nothing blocks input during the sequence; the CTA stays operable.

**Contrast of every pairing used (no new pairing; each row exists in DS 9).**

| Pairing | Use | Ratio | DS row |
| --- | --- | --- | --- |
| Phosphor White on Void | H2, `<time>` | 19.41 | V1 |
| Moss 80 on Void | Body | 12.55 | V4 |
| Moss 70 on Void | Number, eyebrow | 10.29 | V3 |
| Sage 60 on Void | Microcopy, caption | 8.29 | V2 |
| Void on Lime `#7fee64` | CTA label | 14.32 | G10 |
| Void on `#6ddb57` | CTA label on hover | 11.92 | G11 |
| Phosphor White on Ground Iron | CTA fallback label | 16.41 | G1 |
| Lime against Void | CTA boundary (non-text, 3:1 needed) | 14.32 | V10 |
| Phosphor White outline against Void | Focus ring | 19.41 | S1 |
| `--on-mint-ink` on Mint Frost | Slip header | 17.61 | M1 |
| `--on-mint-body` on Mint Frost | Slip line | 14.89 | M2 |

Forbidden pairings that must not appear here: Sage 60, Moss, Fern or Phosphor White on the mint slip (DS M10 to M13).

---

## 9. Performance notes

**What animates (allowlist, MS 12.1).** `transform` (rule `scaleX`, title mask `translateY`, row `translateY`), `opacity` (DOM rows, canvas wrapper), and colour (`ho-lime`, hover). The canvas animates uniforms only. Nothing animates `width`, `height`, `margin`, `top`, `font-size` or `box-shadow`. The caption's `visibility` step and the body swap are not animations.

**Layers and element counts.**

| Item | Count |
| --- | --- |
| DOM nodes added by this section | About 35 (head 14 with ticks, text 6, lane 8, slip rows 4) |
| Composited layers while animating | At most 3: rule, H2 mask lines (2 to 3 short-lived), canvas wrapper |
| `will-change` | None in stylesheets. Set by the state change on the rule and H2 mask while `data-post="live"` and removed on `transitionend`; at most `MAX_WILL_CHANGE` (4) page-wide |
| Canvas | The page's one canvas; this section adds a 1024 by 512 RGBA texture B at tier 2 (about 2MB of GPU memory) or 512 by 256 at tier 1 (about 0.5MB), created lazily at u 0.20 or when the canvas next shows, and kept until dispose |
| Draw calls added | None beyond the 4 at tier 2 in GL 3 (paper B shares the printer group) |
| Texture uploads | One for the header and line of B (one print event), under 4ms at tier 2 |
| Frames | Rendered only while dirty; after the sequence and the tilt settle, zero frames |
| Long tasks | None over 50ms. `SplitText` on one title, about 0.5ms |
| CLS | 0 from this section: body `min-height` reserves the approved sentence's lines; the caption in canvas mode is fixed (no flow); the slip rows have fixed row height of at least 32px |
| INP | The CTA is a link; no handler on press |

**Assets.** None. No image, no SVG, no icon, no font beyond the two already loaded (Inter Tight and Inter, 400 and 500). The perforation is a CSS gradient. No new network request originates in this section other than the `/sign-up` navigation (prefetch is the framework default). Weight budgets for this section: HTML 3KB gzip or less, CSS 1.5KB gzip or less (`.lp-start*`), `ApprovedLine` island 0.6KB gzip or less, the `LaneReceipt scope="fresh"` addition 0.5KB gzip or less. The shared 20KB island budget (ARCH 1) is not threatened.

---

## 10. Implementation

### 10.1 Files

| Path | Kind | Status | Contents |
| --- | --- | --- | --- |
| `web/components/landing/entries/entry-10-start.tsx` | Server component | New | Composition (10.2) |
| `web/components/landing/islands/approved-line.tsx` | Client component | New | Body paragraph with the approved swap (10.3) |
| `web/components/landing/islands/lane-receipt.tsx` | Client component | Edit | Add `scope` prop (10.4) |
| `web/lib/landing/format.ts` | Module | Edit | Add `formatApprovedTime(iso: string): string` |
| `web/components/landing/landing.css` | CSS | Edit | `.lp-start`, `.lp-start__body`, `.lp-start__lane`, `.lp-start__paper`, `.lp-start__caption` and their canvas-mode and forced-colors variants |
| `web/content/landing-copy.ts` | Copy module | Edit | Add `entry-10-start.laneAsideAria` (flag F1) |
| `web/lib/motion/scene-driver.ts` | Module | Edit | `entry-10:pose` trigger gets `onToggle` writing `data-window` on the section |
| `web/lib/landing/ledger-store.ts` | Module | No change | `print("10header")` and `print("10")` already exist as `PrintLineId` |
| `web/components/landing/islands/receipt-tape.tsx` | Client component | Edit | Skip `10header` and `10` (flag F7) |
| `web/components/landing/stage/receipt-lines.ts` | Module | Edit | Keep `signup-header` and `l10` out of the story list; export them for `scope="fresh"` (flag F6) |

No new design token, no new preset id, no new dependency.

### 10.2 Composition (illustrative; adapt prop names to the actual `Entry` and `ReceiptPaper`)

```tsx
// web/components/landing/entries/entry-10-start.tsx   (Server Component)
import Link from "next/link";
import { landingCopy } from "@/content/landing-copy";
import { Entry } from "./entry";
import { ApprovedLine } from "../islands/approved-line";
import { LaneReceipt } from "../islands/lane-receipt";

export function Entry10Start() {
  const c = landingCopy["entry-10-start"];
  const [before, after] = c.bodyApproved.split("{approvedTime}");
  return (
    <Entry id="entry-10" section="entry-10-start" entry="10" scene="slip-fresh"
           eyebrow={c.eyebrow} title={c.h2} className="lp-start">
      <div className="lp-start__body">
        <ApprovedLine id="entry-10-body" defaultText={c.body} before={before} after={after} />
        <Link href="/sign-up" className="lp-btn" data-lime-candidate="closing"
              aria-describedby="entry-10-micro">{c.cta}</Link>
        <p id="entry-10-micro" className="lp-small">{c.microcopy}</p>
      </div>
      <LaneReceipt scope="fresh" ariaLabel={c.laneAsideAria} caption={c.laneCaption} />
    </Entry>
  );
}
```

`Entry` supplies the `<section>` attributes of ARCH 2.3, the M1/M2 head (`EntryRule` with the current tick at index 10), the eyebrow, the H2 with `data-split="lines"` and the mask markup `<h2 class="kt-title"><span class="kt-mask"><span class="kt-mask__in">...</span></span></h2>`, and `padding-bottom: var(--section-pad-landing)`.

### 10.3 `ApprovedLine`

| Aspect | Spec |
| --- | --- |
| Props | `{ id: string; defaultText: string; before: string; after: string }` |
| Render | `<p id={id} className="lp-lead">`. First render (server and client) is `defaultText` |
| State | `useLedger((s) => s.approvedAt)` through the store's `getServerSnapshot` (null), so hydration matches |
| After mount, if `approvedAt` is set | `{before}<time dateTime={approvedAt}>{formatApprovedTime(approvedAt)}</time>{after}` where `before` ends with "at " and `after` begins with ". Every real" |
| Updates | Instant swap, no animation, no live region |
| Height | CSS `min-height: 3lh` below 640px, `2lh` from 640px |
| Size | Client island of about 25 lines |

### 10.4 `LaneReceipt scope="fresh"`

| Aspect | Spec |
| --- | --- |
| Props | `{ scope: "fresh"; ariaLabel: string; caption: string }` (the existing `"story"` usage is unchanged) |
| Renders | The `<aside data-lane class="lp-lane lp-start__lane" aria-label data-scope="fresh">` of 5.3, `ReceiptPaper` (mint, 0 radius, perforated top, no stub) with the `<ol>` of `signup-header` and `l10` from `receipt-lines.ts`, then the caption `<p>` |
| Container | `container-type: inline-size` on the aside and `--slip-w: min(85cqw, calc(0.36 * (100lvh - 64px)))` |
| Writes | `data-printed="true"` on the aside when `printed` includes `10` |
| DOM print (tier 0, below 1024px, Reduced excepted) | An `IntersectionObserver` (threshold 0.5, once) calls `ledgerStore.print("10header")` then `print("10")`; the `en-row-print` class is applied to the rows by CSS from the `printed` state. Under Reduced the rows are present at first paint and the observer is not created |
| Canvas mode | When `html[data-stage-ready="true"]`, the observer is not created (the stage calls `print`); the paper wrapper is visually hidden and the caption is fixed |

### 10.5 Existing parts reused

`Entry`, `EntryRule` (M1, M2), `ReceiptPaper` (M7 perforated top), `LimeCustody` (reads `[data-lime-candidate="closing"]`, writes `html[data-lime-owner]`), `EntryPoster`, `SmoothScroll` and `DesktopMotion` (title rise, ScrollTrigger registration), `StageLoader` and `Stage` (the one canvas), `ledgerStore` and `useLedger`, `Link` from `next/link`. `CtaBand` is not used (it is not a custody candidate and it prints "No card." by default).

### 10.6 Presets and tokens used

Presets: `en-post-rule`, `kt-line-rise`, `kt-title-rise`, `en-canvas-return`, `ex-slip-lift`, `em-print`, `en-row-print`, `ho-lime`, `ho-route`, `mi-lime`, `mi-default`, `mi-focus`, `mi-tilt`, `sq-fresh`.

Tokens: `--dur-post`, `--dur-rise`, `--dur-handoff`, `--dur-row`, `--dur-colour`, `--lp-dur-custody`, `--delay-rise`, `--stagger-line`, `--stagger-row`, `--ease-post`, `--ease-travel`, `--ease-feed`, `--ease-linear`, `--ease-utility`, `--type-heading-landing`, `--type-lead-landing`, `--type-small-landing`, `--type-caption-landing`, `--measure-title`, `--measure-body`, `--section-pad-landing`, `--receipt-paper`, `--on-mint-ink`, `--on-mint-body`, `--lp-head-h`, `--lp-navbar-h`, `--lp-hit`, `--lp-z-canvas`, `--lp-z-content`, `--accent`, `--accent-hover`, `--accent-ink`, `--surface`, `--foreground`, `--body`, `--label`.

### 10.7 Key CSS (reference)

```css
.lp-start { display: flex; flex-direction: column; }
@media (min-width: 1024px) {
  .lp-start { min-height: calc(100svh - var(--lp-navbar-h)); position: relative; }
  .lp-start__body { margin-block: auto; grid-column: 1 / 8; }
  .lp-start__lane { grid-column: 9 / 13; container-type: inline-size; }
}
.lp-start__body > .lp-lead { min-height: 3lh; }
@media (min-width: 640px) { .lp-start__body > .lp-lead { min-height: 2lh; } }
.lp-start__body .lp-btn { margin-top: 40px; }
@media (max-width: 639px) { .lp-start__body .lp-btn { width: 100%; } }
@media (min-width: 1024px) {
  html[data-stage-ready="true"] .lp-start__paper { /* visually-hidden pattern */ }
  html[data-stage-ready="true"] .lp-start__caption {
    position: fixed; visibility: hidden; inline-size: 100cqw;
    top: calc(64px + (100lvh - 64px) / 2 + 1.125 * var(--slip-w) + 16px);
  }
  html[data-stage-ready="true"] .lp-start[data-window="on"] .lp-start__lane[data-printed="true"] .lp-start__caption { visibility: visible; }
}
@media (forced-colors: active) { .lp-start__paper { border: 1px solid CanvasText; } }
```

---

## 11. Acceptance criteria

Run at 1440 by 900 and 390 by 844 unless stated. "Tier 2" means `?stage-tier=2` with NEXT_PUBLIC_STAGE_DEBUG=1.

**Content**

- [ ] The H2 reads exactly "Try it on 25 real applications." and breaks as "Try it on 25 / real applications." at 1440, 1024 and 390.
- [ ] Without approval the body reads exactly "Every application waits for your approval."
- [ ] After approving the sample in entry 04 (or with `kairos:landing:ledger:v1` containing `approvedAt`), the body reads "You approved the sample at {time}. Every real application waits for you the same way." where `{time}` equals the time in entry 04's stamp (time part only) and is inside a `<time>` with a valid `datetime`.
- [ ] The microcopy reads exactly "25 submitted applications, free, once. The free credits never expire."
- [ ] The CTA reads "Start free", is an `<a>` to `/sign-up`, and has `aria-describedby` resolving to the microcopy.
- [ ] No em dash or en dash appears in the section's rendered text, and none in `landing-copy.ts` for this section. No "No card" string appears.
- [ ] No SAMPLE chip, claim chip, posting square, dashed border or price is present in the section.

**Layout**

- [ ] At 1440 by 900 the text block occupies x 112 to 808 and the lane x 944 to 1328; no text pixel lies inside the slip rectangle (x 985 to 1287, y 143 to 821) at any scroll position.
- [ ] At 1280 by 800 and 1024 by 768 the same check passes with the rectangles in 3.1 and 3.3.
- [ ] The captions' bounding boxes in canvas mode match 3.3 within 2px at all five listed viewports and stay inside the viewport.
- [ ] Below 1024 there is no lane and no horizontal scroll; the mini slip is below the microcopy; at 390 the CTA is full width and 48px tall.
- [ ] Tick 10 of the head is 8px tall and Phosphor White; the other ticks are 4px.
- [ ] The section has no `transform`, `filter`, `contain: paint` or `content-visibility` on itself or an ancestor within `<main>`.
- [ ] Changing the approval state before hydration causes no layout shift above 0.01 for this section (CLS check with the stored approval).

**Lime**

- [ ] While the CTA is in the viewport, exactly one element has `background-color` of `rgb(127, 238, 100)` or `rgb(109, 219, 87)`: the CTA. The navbar button is in its fallback style.
- [ ] When the CTA first enters the viewport the navbar releases within 150ms and the CTA is lime 150ms later; at no sampled frame are both lime.
- [ ] When the CTA leaves the viewport scrolling down, lime returns to the navbar with the same 150 plus 150ms sequence.
- [ ] No-JavaScript: the CTA is in fallback style and only the hero CTA is lime.
- [ ] No computed `color`, `border-color` (wider than 1px), `outline-color`, `fill`, `stroke` or `box-shadow` in this section equals a lime value.

**Motion, tier 2**

- [ ] The canvas fades in over 400ms (+/- 40ms) when the section top crosses 85% of the viewport.
- [ ] Nothing prints before u = 0.20. At u = 0.20 paper A lifts (600ms) and paper B feeds; `ledgerStore.printed` gains `10header` and then `10` in that order.
- [ ] The sequence ends within 3,160ms (+/- 150ms) of its start, and no frame renders afterwards except tilt or scroll.
- [ ] The caption is hidden until the line starts printing, becomes visible in a single frame (no opacity transition), and stays visible while `data-window="on"`.
- [ ] Pointer tilt does not move the slip during the sequence and is limited to 6 degrees (y) and 3 degrees (x) afterwards.
- [ ] Scrolling to the footer and back does not replay the sequence; reloading with `10` in `printed` shows paper B with no lift or feed.
- [ ] Jumping from the top with the rail link `10` plays the sequence once after the canvas fade-in, and earlier prints do not play in sequence.
- [ ] After the sequence, scrolling to entry 00 shows paper A again (flag F8).
- [ ] No more than two motion groups run at once during the sequence (MS Q5 sampler).
- [ ] Tier 1: same timings at 30fps, no curl, no tilt, fade 240ms.

**Variants**

- [ ] Reduced: no canvas request is made, the DOM slip shows both lines at first paint, the rule is drawn, the title is static, lime swaps instantly, hover colour still transitions in 300ms.
- [ ] Switching to Reduced during the sequence completes it in the same frame, unmounts the stage, and shows the DOM slip.
- [ ] Below 1024: the slip rows print (`en-row-print`, 240ms, 60ms stagger) once when 50% in view; no GSAP or Lenis chunk is requested.
- [ ] Forced colors: the canvas is hidden, the DOM slip has a visible edge, the CTA keeps its border.
- [ ] Context loss mid-sequence restores or demotes without a blank lane and without replaying.

**Accessibility**

- [ ] The section is a labelled region; the H2 has `tabindex="-1"`; following `#entry-10` moves focus to the H2 and the H2 is not hidden under the navbar (scroll-padding).
- [ ] Tab order inside the section is: CTA only; the aside has no tab stop.
- [ ] The aside is named "New slip at sign-up" and its `<ol>` has exactly two items with the exact strings from the copy deck, in canvas mode (visually hidden) and DOM mode (visible).
- [ ] There is no `aria-live` region in the section.
- [ ] The CTA hit area is at least 44 by 44px with 8px or more to the nearest target.
- [ ] axe reports no violations on the section; all contrast pairs match the table in section 8.
- [ ] The tape does not show the sign-up lines.

**Performance**

- [ ] The section adds no network request except the navigation; no image or font is loaded for it.
- [ ] Section HTML at most 3KB gzip, `.lp-start*` CSS at most 1.5KB gzip, `ApprovedLine` at most 0.6KB gzip.
- [ ] Trace of the sequence at tier 2: main thread under 8ms per frame, GPU under 8ms, no long task over 50ms.
