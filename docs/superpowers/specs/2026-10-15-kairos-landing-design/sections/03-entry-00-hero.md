# Section spec: `entry-00-hero` (Hero: Open)

Section id `entry-00-hero`. Anchor `#entry-00`. Heading id `entry-00-title` (an H1, the only one on the page). Tier: signature. Scene state: `slip-open`. Scroll length: one viewport (`min-height: calc(100svh - 64px)` below the 64px navbar at 1024px and wider). Previous: `ledger-rail` (no WebGL). Next: `entry-01-reported` (`slip-recede`).

Sources: `01-creative-direction.md` (CD), `02-design-system.md` (DS), `03-motion-system.md` (MS), `04-webgl-scene.md` (WS), `05-architecture.md` (ARCH), `06-copy-deck.md` (COPY). Where those documents disagree, this spec names the conflict and states the value to build (section 10.4).

---

## 1. Purpose and narrative beat

**Purpose.** In one breath, tell the visitor what Kairos is: it finds roles that fit, it tailors only from facts you confirmed, and it sends nothing until you approve. Then offer the free start. Everything that carries meaning is server HTML and readable in the first painted frame. There is no preloader, no hidden start state and no entrance on the subhead, the buttons or the microcopy.

**Beat: open the ledger.** The page starts still. One sentence is written in ink, and a blank receipt slip stands in the right lane with its first line already printed.

**The signature moment, as the visitor sees it (1440 by 900, tier 2):**

1. Frame 0. The headline "Job applications you would sign." is already readable in Sage 60. The lime CTA, the subhead and a pale mint slip are all present.
2. 0 to 640ms. The five words take ink one after another, left to right, stepping from Sage 60 to Phosphor White (`kt-ink`). It reads like a pen moving across a line.
3. 700 to 1200ms. A 1px Phosphor White rule draws left to right under "sign." (`kt-sign-rule`). The sentence has now been signed.
4. Stillness. Nothing moves until the WebGL stage is ready.
5. When the stage is ready, but never before 1200ms: over 600ms the flat DOM slip dissolves into the identical WebGL slip, which differs only in that its top 22% curls forward like paper leaving a printer (`en-poster-to-canvas`). Nothing jumps, because both show the same pose, size and lines.
6. From then on the slip turns toward the pointer by at most 6 degrees, so moving toward the CTA turns the receipt toward it. When the pointer stops, the slip stops (`mi-tilt`, critically damped, no overshoot).

Every move ends within 2s of arrival and carries no information. The page is complete at frame 0, and the motion only shows it being signed.

---

## 2. Content (final copy from 06-copy-deck.md, verbatim; flag any change you need and why)

All strings resolve from `landingCopy["entry-00-hero"]` in `web/content/landing-copy.ts`. No copy is written inline in components.

| Key | Element | Copy | Lime |
| --- | --- | --- | --- |
| `entry-00-hero.eyebrow` | Micro-label (`<p>`, Caption, uppercase by CSS) | For new grads, OPT and anyone between jobs | |
| `entry-00-hero.h1` | `<h1 id="entry-00-title">` | Job applications you would sign. | |
| `entry-00-hero.subhead` | Lead `<p>` | Kairos finds roles that fit, tailors your resume only from facts you confirmed, and sends nothing until you approve it. Every submitted application comes with a receipt. | |
| `entry-00-hero.ctaPrimary` | `next/link` to `/sign-up` | Start with 25 free applications | LIME (server default owner) |
| `entry-00-hero.ctaSecondary` | Anchor | See how it works | |
| `entry-00-hero.microcopy` | Small `<p>` | Credits are only used when an application actually goes through. | |
| `entry-00-hero.microcopyChip` | Claim chip after the microcopy | see 07 | |
| `entry-00-hero.laneCaption` | 14px caption under the slip (1024px and wider) | Sample receipt. It prints as you read. | |
| `entry-00-hero.laneAsideAria` | `aria-label` of the lane `<aside>` | Sample receipt | |
| `entry-00-hero.laneAsideIntro` | First visually hidden sentence in the aside | This sample receipt prints one line for each part of this page. Nothing on it was sent to an employer. | |
| `entry-00-hero.miniReceiptHeader` | Mini receipt first line (below 1024px) | KAIROS · RECEIPT · SAMPLE | |
| `entry-00-hero.miniReceiptLine00` | Mini receipt second line | 00 · Ledger opened | |
| `scene.lines.header` / `scene.lines.00` | Lane receipt (DOM poster) rows | KAIROS · RECEIPT · SAMPLE / 00 · Ledger opened | |
| `entry-00-hero.h1Alt` | Not shipped (G7 test only) | Applications you approve first. | |

"No card" is withheld until gate G4 passes (COPY 0.5). If G4 passes, "No card." becomes the first sentence of `entry-00-hero.microcopy`. No other change is made here.

### 2.1 Flagged changes

| # | Item | Deck says | Build | Why |
| --- | --- | --- | --- | --- |
| F1 | `ctaSecondary` target | `#entry-02-fit-gate` | `href="#entry-02"` | ARCH 2.3 fixes anchor ids as `entry-NN`. `entry-02-fit-gate` is the `data-section` value, not an id, so the deck's link would go nowhere. MS 5.6 also uses `#entry-02` |
| F2 | `microcopyChip` accessible name | "See entry 07, Billing and pricing" | "See entry 07, Billing" | `shared.claimChipName` is "See entry {NN}, {title}" with titles from `ledger-rail.entries`, where 07 is "Billing". One template, no special case |
| F3 | `posterAlt` (empty `alt` on an `<img>`) | Present | Key unused | ARCH 6.1 and MS D7 replace the raster poster with a DOM poster, so there is no `<img>`. The DOM poster is the lane receipt itself (section 5.3) |
| F4 | H1 space between "would" and "sign." | Normal space | U+00A0 no-break space, inserted by the component, not by the copy module | Prevents a one-word last line "sign." at narrow widths (COPY 19 borderline case). The copy-equality test in `no-js.spec.ts` must normalise whitespace (`/\s+/g`, which matches U+00A0) |
| F5 | Compact Motion control label | Missing (MS open item O3) | New key `entry-00-hero.motionToggle` = "Reduce motion". After a change, announce `footer.motionLive` ("Motion set to {Full or Reduced}.") | MS 11.2 places a compact toggle in the hero lane caption row but no string exists. A toggle button keeps a constant label and reports state through `aria-pressed`. MS 11.2's own announcement strings ("Motion reduced.", "Motion on.") are dropped in favour of the deck's existing live string |
| F6 | `laneCaption` below 1024px | Not specified | Not rendered below 1024px | Below 1024px the mini receipt never prints further lines (the tape does that from entry 02), so "It prints as you read." would be untrue there. The mini receipt says SAMPLE in its own header and carries a visually hidden caption "Sample receipt" (`laneAsideAria`) |

No headline, subhead, CTA or microcopy text is changed.

---

## 3. Layout structure

### 3.1 DOM skeleton

```html
<div data-story>                                    <!-- entries 00 to 06 -->
  <aside data-lane class="lp-lane" aria-label="Sample receipt">   <!-- cols 9 to 12, >=1024 only -->
    <div class="lp-lane__sticky">                   <!-- sticky top 64px, height calc(100lvh - 64px) -->
      <!-- LaneReceipt [C]: the DOM poster and the AT text source, see 5.3 -->
    </div>
  </aside>
  <section id="entry-00" data-section="entry-00-hero" data-entry="00" data-scene="slip-open"
           aria-labelledby="entry-00-title" class="lp-entry lp-hero">
    <div class="lp-container"><div class="lp-grid lp-hero__grid">
      <div class="lp-head lp-hero__head">…00 + graticule…</div>
      <div class="lp-hero__lanecell"><div class="lp-hero__caption">…caption + compact toggle…</div></div>
      <p class="lp-caption lp-hero__label">…eyebrow…</p>
      <h1 id="entry-00-title" tabindex="-1" class="lp-display kt-ink lp-hero__h1">…5 word spans…</h1>
      <p class="lp-lead lp-hero__lead">…subhead…</p>
      <div class="lp-hero__ctas">…primary, secondary…</div>
      <p class="lp-small lp-hero__micro">…microcopy… <a class="lp-chip lp-chip--claim">see 07</a></p>
      <figure class="lp-hero__mini">…mini receipt, below 1024 only…</figure>
    </div></div>
  </section>
  …entries 01 to 06…
</div>
```

### 3.2 Grid, placement and spacing by breakpoint

The navbar is `position: sticky; top: 0`, 64px, in flow above `<main>`, so the hero starts at viewport y = 64 at scroll 0. Section `padding-top: 32px` at every width (DS 4.2). Section `padding-bottom: var(--section-pad-landing)` (80, 96 or 128px).

| Breakpoint | Columns, gap, margin | Head row | Label, H1, lead | CTAs | Microcopy | Lane and receipt |
| --- | --- | --- | --- | --- | --- | --- |
| 1440 and 1280 | 12, gap 32, margin 32, col 72px, content 1216px (container 1280px, centred; 80px outside margin at 1440) | Cols 1 to 8 (800px), 32px tall | Label cols 1 to 7; H1 cols 1 to 8 (800px), 2 lines; lead cols 1 to 7, `max-width: var(--measure-body)` (544px), 3 or 4 lines | One row, left-aligned, gap 12px | One line, chip inline 8px after the text | Lane cols 9 to 12 (384px). Slip 301 by 677 at 1440 by 900, 265 by 596 at 1280 by 800. Caption under the slip. Rail fixed at right 24px (1440) or 8px (1280 to 1439) |
| 1024 to 1279 | 12, gap 32, margin 32, col 50.7px at 1024 | Cols 1 to 8 (629px at 1024) | Same columns; H1 629px measure, 2 lines at 77.3px | One row (about 498px wide incl. gap, inside 547px) | One line or two | Lane 299px at 1024. Slip 253 by 570 at 1024 by 768. No rail; navbar caption "00 / 10" |
| 768 to 1023 | 8, gap 24, margin 24 | Cols 1 to 8 | Label, H1 and lead cols 1 to 8; lead capped at 544px; H1 2 lines at 63 to 77px | One row | One line | No lane, no canvas. Mini receipt below the microcopy: `width: min(100%, 384px)`, height 320px |
| 640 to 767 | 8, gap 20, margin 16 | Cols 1 to 8 | Full width; H1 2 lines at 55.8 to 63px | One row if it fits (it does from 640: 498px inside 608px), else wraps | One line or two | Mini receipt `width: min(100%, 384px)`, height 200px |
| 360 to 639 | 4, gap 16, margin 16, content 328px at 360 | Cols 1 to 4 | Full width; H1 48px, 3 lines from 360 to about 389px ("Job / applications / you would sign."), 2 lines above; lead 18px | Stacked, each `width: 100%`, gap 12px | Wraps; chip stays with the last word | Mini receipt full column width, height 200px |

Vertical spacing (DS 4.3; values in px, desktop is 1024 and wider):

| Gap | 1024 and wider | Below 1024 |
| --- | --- | --- |
| Section top to head row | 32 | 32 |
| Head row height (`--lp-head-h`) | 32 | 32 |
| Head row to micro-label | 40 | 32 |
| Micro-label to H1 | 24 | 16 |
| H1 to lead | 32 | 24 |
| Lead to CTA row | 40 | 32 |
| CTA row to microcopy | 16 | 16 |
| Microcopy to mini receipt | n/a | 32 |
| Below the last element | `--section-pad-landing` 128 | 96 (768 to 1023), 80 (below 768) |

Vertical budget check (computed with DS 3.2 sizes):

| Viewport | H1 top | CTA row bottom | Microcopy bottom | Hero box | Result |
| --- | --- | --- | --- | --- | --- |
| 1440 by 900 | 208 | 639 (lead 4 lines) | 679 | 64 to 900 | Whole hero in the first viewport; entry 01 starts exactly at the fold |
| 1280 by 800 | 208 | 621 | 661 | 64 to 800 | Same |
| 1024 by 768 | 208 | 595 | 635 | 64 to 768 | Same |
| 375 by 667, 3-line H1 (micro-label wraps to 2 lines at 343px) | 208 | Primary CTA bottom 584 | after the secondary CTA | content height | Primary CTA above the fold with 83px to spare. The 48px display floor holds; DS Q4 and the COPY 19 clamp fallback (2.75rem) are not needed |
| 375 by 667, 2-line H1 | 208 | Primary CTA bottom 538 | | | Same |

### 3.3 The caption under the slip (1024px and wider)

The caption sits in `.lp-hero__lanecell` (grid column 9 / 13, grid row 1, `position: relative; height: 0; container-type: inline-size`). Its top is the hero grid's top, which is viewport y = 96 at scroll 0. The caption is positioned from the same formula the WebGL lane fit uses (WS 5.1), so it lands 12px under the slip at every viewport:

```css
.lp-hero__caption {
  --slip-w: min(85cqw, calc(0.36 * (100lvh - var(--lp-navbar-h))));
  position: absolute;
  left: calc((100cqw - var(--slip-w)) / 2);          /* slip's left edge */
  top: calc((100lvh - var(--lp-navbar-h)) / 2 + 1.125 * var(--slip-w) + 12px - 32px);
  width: calc(100cqw - (100cqw - var(--slip-w)) / 2);
}
```

Contents: the caption line (14px/20px, Sage 60), then 4px, then the compact Motion toggle, whose visible text box is 20px tall and whose hit area is 44px through a transparent `::before` with `inset: -12px 0` (the same technique as the claim chip, DS 6.5). The block is 44px of visible content. Its bottom lands at 876px (1440 by 900), 786px (1280 by 800) and 757px (1024 by 768), all above the fold.

### 3.4 Wireframe, desktop 1440 by 900 (scroll 0, tier 2)

```
x: 0    80 112                                         912 944                1328    1440
y=0   +--------------------------------------------------------------------------------------+
      | [K] Kairos   How it works  Pricing  Blog  About                Log in  ( Start free ) | navbar 64, Start free = Default
y=64  +--------------------------------------------------------------------------------------+
y=96  |      00 |#|....|....|....|....|....|....|....|....|....|      (rule ends at col 8)      |
y=128 |                                                     +------------------+              |
      |                                                     |   (curl, canvas) |       00 #   | rail (right 24)
y=168 |      FOR NEW GRADS, OPT AND ANYONE BETWEEN JOBS     |                  |       01 |   |
      |                                                     |  slip 301 x 677  |       02 |   |
y=208 |      Job applications                               |  pose (6,-14,2)  |       ..     |
      |      you would sign.                                | KAIROS·RECEIPT·  |       10 |   |
y=399 |                ''''''''  1px signature rule          |   SAMPLE         |              |
y=431 |      Kairos finds roles that fit, tailors your      | 00 · Ledger      |              |
      |      resume only from facts you confirmed, and      |   opened         |              |
      |      sends nothing until you approve it. Every      |                  |              |
      |      submitted application comes with a receipt.   |   (blank fed     |              |
y=591 |      [ Start with 25 free applications ] [See how it works]  paper)     |              |
y=655 |      Credits are only used when an application      |  .......perf.... |              |
      |      actually goes through.  (see 07)               |__________________| print head   |
y=832 |                                                     Sample receipt. It prints as you read.
y=856 |                                                     [] Reduce motion                    |
y=900 +---------------------------------------------- fold: entry 01 head starts here ---------+
       cols 1-8 text (H1 800px, lead 544px)       col 8 buffer   lane cols 9-12 (384px)
```

`[ ... ]` with a fill is the lime pill (the one lime element). `[See how it works]` is outlined. `( Start free )` in the navbar is the Default fallback. `#` on the rule is the 8px Phosphor White tick for entry 00. `[]` before "Reduce motion" is the 6px posting square showing the toggle state.

### 3.5 Wireframe, mobile 360 by 740

```
x: 0 16                                        344 360
y=0   +--------------------------------------------+
      | [K] Kairos                       [ Menu ]  |  navbar 64 (Start free in the bar, Default)
y=64  +--------------------------------------------+
y=96  |  00 |#|..|..|..|..|..|..|..|..|..|          |  head row 32, 11 ticks about 28px apart
y=160 |  FOR NEW GRADS, OPT AND ANYONE BETWEEN     |
      |  JOBS                                      |
y=208 |  Job                                       |  48px, line height 45.6
      |  applications                              |
      |  you would sign.                           |
      |            '''''''  signature rule         |
y=369 |  Kairos finds roles that fit, tailors      |  18px / 27px, 5 lines
      |  your resume only from facts you           |
      |  confirmed, and sends nothing until you    |
      |  approve it. Every submitted application   |
      |  comes with a receipt.                     |
y=536 |  [   Start with 25 free applications     ] |  48px, full width, lime
y=596 |  [          See how it works             ] |  48px, outlined
y=660 |  Credits are only used when an             |  14px
      |  application actually goes through.       |
      |  (see 07)                                  |
y=744 |  ::::::::::::::: perforation :::::::::::::  |
      |  KAIROS · RECEIPT · SAMPLE                 |  mini receipt, mint, 200px tall
      |  00 · Ledger opened                        |
      |                                            |
      |  __________________________________________|  print head hairline
y=944 +--------------------------------------------+
```

---

## 4. Visual design

### 4.1 Elements, roles and tokens

| Element | Class and role | Type | Colour (token, hex) | Contrast |
| --- | --- | --- | --- | --- |
| Entry number "00" | `lp-head-num`, Caption | Inter 12px/16px, 500, +0.6px, tabular slashed zero | `--label` Moss 70 #9cbf93 on Void | 10.29:1 (V3) |
| Graticule rule | `lp-head-rule`, M1 | 1px | Phosphor Blue-Black #1f2a33 (`--divider`) | Decor (V9) |
| Ticks 00 to 10 | `lp-head-tick`, M1 | 1px by 4px; tick 00 1px by 8px | Circuit Border #485346; tick 00 Phosphor White #ddffdc | Decor |
| Micro-label | `lp-caption`, uppercase via `text-transform` | Inter 12px/16px, 500, +0.6px | `--label` Moss 70 | 10.29:1 |
| H1 | `lp-display kt-ink` | Inter Tight 400, `ss01`, `--type-display-landing` clamp(3rem, 1.25rem + 5.6vw, 6.5rem) = 48 to 104px, line height 0.95, -0.025em, `text-wrap: balance` | Frame 0 `--body` Sage 60 #8cab87, final `--foreground` Phosphor White | 8.29:1 at frame 0 (S8), 19.41:1 final (V1) |
| Signature rule | `::after` on the "sign." span | 1px line, from `left: 0` to `right: 0` of the span, `bottom: -0.16em` (clears the g descender at line height 0.95, DS 3.3) | `--foreground` | Decor; drawn as `border-top`, see 7.4 |
| Lead | `lp-lead` | Inter 400, 18px (below 768) or 20px, line height 1.5, -0.018em, `text-wrap: balance` | `--lead` Moss 80 #aed2a4 | 12.55:1 (V4) |
| Primary CTA (owner) | `lp-btn`, `data-lime-candidate="hero"` | Inter 500 16px, -0.022em; 48px tall, padding 0 24px, radius `--r-pill` 9999px, 1px border | Fill `--accent` #7fee64, border same, text `--accent-ink` Void | 14.32:1 label (G10); 14.32:1 boundary on Void (V10) |
| Primary CTA (non-owner fallback) | same | same | Fill `--surface` Ground Iron #181818, 1px `--foreground` border, `--foreground` text | 16.41:1 (G1) |
| Secondary CTA | `lp-btn lp-btn--outlined` (not a custody candidate) | Inter 500 16px; 48px tall; radius `--r-button` 12px (DS 5.2: non-custody buttons are 12px) | Transparent, 1px `--foreground` border, `--foreground` text | 19.41:1 |
| Microcopy | `lp-small` | Inter 400 14px/20px, -0.026em | `--body` Sage 60 | 8.29:1 (V2) |
| Claim chip "see 07" | `lp-chip lp-chip--claim`, M5 | Inter 500 12px, 24px tall, padding 4px 12px, pill | Text `--foreground`; border `--chip-link-border` (Fern Link #859984) | Text 19.41:1; border 6.89:1 (V6) |
| Lane caption | `lp-small` | Inter 400 14px/20px | `--body` Sage 60 on Void | 8.29:1 |
| Compact Motion toggle | text button | Inter 400 14px/20px; 1px underline in `--link`, offset 3px; 6px posting square 8px before the text | Text `--foreground`; square outlined Circuit Border (Full) or filled Phosphor White (Reduced) | 19.41:1 |
| Lane receipt and mini receipt | `lp-receipt`, receipt paper | see 4.3 | `--receipt-paper` Mint Frost #def0dd; ink `--on-mint-ink` Void | 17.61:1 (M1) |

Weights used: 400 (H1, lead, body, microcopy, caption line) and 500 (label, number, buttons, chip, receipt header). Nothing heavier. No glow, shadow or gradient on any hero element. All copy is left-aligned.

### 4.2 Surfaces and motif usage

- The page canvas behind the hero is Void. All hero text sits on pure Void. Text never enters columns 9 to 12, except the lane caption, which sits under the slip and never on it.
- M1 graticule: the hero carries the head "00" with tick 00 as the current tick. At 1024px and wider the head row spans columns 1 to 8 only, so the rule never crosses the slip (see 10.4, item R5).
- M2 post: not animated in the hero. The hero is in view at hydration, so `EntryPoster` marks it `data-post="instant"` and the rule is drawn from first paint (MS 3.3).
- M5 claim chip: "see 07" is registered claim 1 of 6 in `web/content/claims.ts` (`data-claim="entry-00-hero.microcopyChip"`).
- M6 sample mark: the receipt names itself SAMPLE in its header row, and the caption says "Sample receipt." No dashed edge is drawn on the slip. The canvas slip has none and the DOM poster must stay identical to it, and DS 6.6 requires words to carry the meaning anyway.
- M7 perforation: on the receipt only (the lane receipt near its bottom, the mini receipt along its top), per DS 6.7.
- M10 lime custody: this viewport's one lime element is the hero CTA "Start with 25 free applications". The navbar "Start free" renders its Default fallback. No other candidate (approve, pro, closing) can be in this viewport. The logo mark is Phosphor White (`.lp [data-logo-mark] { fill: var(--foreground) }`).

### 4.3 The receipt object (DOM)

One component, `ReceiptPaper`, draws all three receipts in this section. All geometry for the lane variant is in container units of the slip width W (`container-type: inline-size` on the paper, so 100cqw = W). It is derived from the WebGL texture (WS 3.5: 1024 texels across W; at `slip-open` the header's top sits 30% down the slip).

| Part | Lane variant (`variant="lane"`, 1024px and wider) | Mini variant (`variant="mini"`, below 1024px) |
| --- | --- | --- |
| Box | `width: var(--slip-w)`, `height: calc(2.25 * var(--slip-w))`, radius 0, `background: var(--receipt-paper)`, no border | `width: min(100%, 384px)`, height 200px (below 768) or 320px (768 to 1023), radius 0, padding 24px 20px |
| Pose | `transform: translate(-50%, -50%) rotateX(-6deg) rotateY(-14deg) rotateZ(-2deg)` from centre, positioned at the centre of `.lp-lane__sticky` (see 5.4 for the sign conversion and the perspective) | None (flat) |
| Header row | Top 67.5cqw, row height 11.72cqw (120 texels); Inter 500 uppercase, tracking 0.08em; `font-size: max(12px, 3.906cqw)`; left inset 6.25cqw; baseline 7.62cqw below the row top | `lp-caption` 12px/16px 500 uppercase +0.6px, `--on-mint-ink`; row height 32px (`--rule-rhythm`) |
| Line row | Top 79.22cqw, row height 10.55cqw (108 texels); Inter 400; `font-size: max(12px, 4.6875cqw)`; baseline 7.03cqw below the row top | `lp-receipt-row` Inter 400 14px, row height 32px, `--on-mint-body` |
| Ink colour | `--on-mint-ink` #000000 for both rows (the texture prints Void ink) | Header `--on-mint-ink`, line `--on-mint-body` #181818 (14.89:1, M2) |
| Perforation | A 1px row centred 3.125cqw above the bottom edge (WS `PERF_Y`), `background-image: var(--lp-perforation-image-mint)` (1px on, 3px off) | A 1px row along the top edge, same image |
| Heat band | Bottom 1.875cqw (WS `HEAT_H`), `color-mix(in srgb, var(--receipt-paper) 82%, #000)` = #b6c5b5 | None |
| Print head | `::after`, 1px tall, `width: 110cqw; left: -5cqw`, at the bottom edge, `background: var(--link)` Fern Link (6.89:1 on Void) | 1px Fern Link line at the bottom edge, `width: 100%` (no overhang, so there is no horizontal overflow at 360px) |
| Curl | None. The canvas alone has the curl in the top 22% | None |

Baseline placement: rows use `line-height: 1` and `position: absolute; top: calc(rowTop + baseline - 0.8633em)`. 0.8633em is the baseline position of Inter at line height 1 (ascent 0.96875em, descent 0.2421875em), so the DOM baseline matches the texture baseline within 1px. Visual check: WS test 17 at 1440 by 900 and 1920 by 1080.

The 12px floor is DS 3.3 (no text under 12px). Without it the header would compute 9.9px at 1024 by 768 and 11.8px at 1440 by 900. See 10.4, item R3, for the matching WebGL change.

---

## 5. WebGL

### 5.1 State and pose

| Property | `slip-open` value (WS 5.3) |
| --- | --- |
| Section attribute | `data-scene="slip-open"` on `#entry-00` |
| Camera | `PerspectiveCamera(35, innerWidth / Hc, 0.1, 20)` at (0, 0, 6) looking at (0, 0, 0); `Hc` = canvas CSS height = 100lvh |
| Lane fit | `W = min(0.85 × laneWidth, 0.36 × (Hc − 64))`, height 2.25W, centre `cx` = lane centre, `cy = 64 + (Hc − 64) / 2` |
| Offset | (0, 0, 0) from lane fit |
| Rotation (x, y, z), Euler XYZ | (6, −14, 2) degrees. The face is turned toward the text column |
| Scale, paper level | 1.00, `uLevel` 1.00 |
| Curl | `uCurl` 1 at T2 (38 degrees maximum, top 22%); 0 at T1 |
| Printed | `header`, `l00` pre-printed; `uFeed = 1613`, `uPrintY = 228` |
| Pointer tilt | T2 with `(hover: hover) and (pointer: fine)` only, after the poster fade ends |
| Renders | 0 frames at rest. Frames only during the fade, while tilt is settling, or when the next entry's `u` changes |

### 5.2 How the state is entered and left

| Transition | Trigger | Behaviour |
| --- | --- | --- |
| Enter (load) | `StageLoader` probes after `load` plus `requestIdleCallback` (2000ms timeout); tier 1 or 2 loads the WebGL chunk; `Stage` draws texture A from `ledgerStore.printed`, awaits `document.fonts.load` and `renderer.compileAsync`, and renders one frame | At `max(stageReady, FCP + 1200ms)`, `en-poster-to-canvas` runs (6a). If the scene is not ready within 10,000ms of idle start, the stage aborts to tier 0 for this view and the DOM poster simply stays |
| Enter (scroll back up from entry 01) | Entry 01 `u` falls below 0.25 | The pose scrubs back to `slip-open` through `smoothstep`, approached with `POSE_LAMBDA` 7.7/s. Printed lines never un-print (append-only) |
| Enter (reload mid-page, then scroll up) | Same | The canvas shows every posted line, already printed, with no sweep |
| Leave | Entry 01 top crosses 85% of the viewport (`u₀₁ = 0`) | Blend toward `slip-recede` over `u₀₁` 0 to 0.25 (6b). Tilt target goes to 0 as soon as `slip-recede` is the target state |

### 5.3 DOM over canvas layering

| Layer | Element | z-index token | Notes |
| --- | --- | --- | --- |
| 0 | `<canvas data-stage-canvas aria-hidden="true">`, `position: fixed; inset: 0; height: 100lvh; pointer-events: none` | `--lp-z-canvas` 0 | Clears to transparent; paper alpha 0 outside the slip |
| 1 | `[data-lane]` aside, the lane receipt (the DOM poster) | `--lp-z-content` 1 | Above the canvas, so the poster covers the canvas until it fades out |
| 1 | Hero text, CTAs, caption | `--lp-z-content` 1 | Columns 1 to 8, and the caption under the slip |
| 20 | Ledger rail | `--lp-z-rail` | 1280px and wider |
| 40 | Navbar | `--lp-z-navbar` | Sticky |

The lane receipt is both the DOM poster and the assistive-technology source (ARCH 2.2: "Header and line 00 on mint paper in the `slip-open` CSS pose; appends printed lines"). Structure:

```html
<aside data-lane class="lp-lane" aria-label="Sample receipt">
  <div class="lp-lane__sticky">
    <div class="lp-receipt lp-receipt--lane" data-receipt-poster>
      <p class="lp-sr-only">This sample receipt prints one line for each part of this page. Nothing on it was sent to an employer.</p>
      <p class="lp-receipt__header">KAIROS · RECEIPT · SAMPLE</p>
      <ol id="receipt-lines" class="lp-receipt__rows"><li>00 · Ledger opened</li></ol>
    </div>
  </div>
</aside>
```

The canvas never takes focus or pointer events. Once `html[data-stage="live"]` is set (after the fade), CSS applies the visually-hidden pattern to `[data-receipt-poster]` (clip, 1px box, `opacity: 0` already) so the `<ol>` stays in the accessibility tree. When the context is lost, `data-stage` is removed and the poster is visible again in its pose, within 100ms (WS test 12).

### 5.4 CSS pose identical to the camera

The DOM poster must match the canvas frame exactly, except for the curl, or the cross-fade would show a double image.

1. **Sign conversion.** three.js is y-up and CSS is y-down. Flipping y negates rotations about x and z and keeps rotations about y, and the order X, Y, Z is preserved. So three's (6, −14, 2) is CSS `rotateX(-6deg) rotateY(-14deg) rotateZ(-2deg)`. MS 7.3 writes `rotateX(6deg) … rotateZ(2deg)`; those signs are wrong (10.4, R2).
2. **Perspective distance.** The camera is 6 world units from the z = 0 plane, and `k = 3.78359 / Hc` world units per CSS px, so the distance is `6 / k = 1.58579 × Hc`. On `.lp-lane__sticky`: `perspective: calc(1.58579 * 100lvh)` (1427px at 900px tall). MS 7.3's fixed 1200px would differ by up to 10px at the slip's edges.
3. **Perspective origin.** The camera looks from the viewport centre, not from the slip's centre. At 1440 by 900 the slip sits 416px right of the camera axis, which shifts its near and far edges by about 10px compared with an on-axis view. `LaneReceipt` therefore writes two custom properties on `.lp-lane__sticky`, from one `ResizeObserver` on the lane and on `resize`: `--lp-persp-x = (innerWidth / 2 − laneRect.left) px` and `--lp-persp-y = (Hc / 2 − 64) px`. It uses `perspective-origin: var(--lp-persp-x, 50%) var(--lp-persp-y, 50%)`. The server default (50% 50%) is seen only before hydration or without JavaScript, when no canvas exists to match.
4. **Shade.** At this pose the WS Lambert term is 0.9927, so blank paper renders within 1 level per channel of #def0dd. A flat `--receipt-paper` fill is exact.

### 5.5 Text contrast over the canvas

- No text overlaps the slip at rest or at maximum tilt. The text column ends at column 8 (x = 912 at 1440), and the 32px column gap separates it from the lane. At rest the slip's left edge sits 41px (1440 by 900), 59px (1280 by 800) and 23px (1024 by 768) inside the lane's left edge. The rest rotation and any tilt only move the far (left) edge further right, apart from a tilt toward the right edge, whose worst case is the unrotated rectangle (the same margins).
- The caption block's text starts 24px below the slip's resting bottom edge. The worst-case corner excursion at maximum tilt is about 13px, so at least 11px of Void remains between paper and caption text.
- Outside the slip the canvas is transparent, so every hero text pairing is its Void pairing (section 4.1).
- Ink on the slip: Void on flat Mint Frost 17.61:1; on the curl's darkest paper (shade 0.62) 9.7:1 (WS 6.3). The canvas is `aria-hidden`; the DOM list is authoritative.
- No lime pixel exists in the canvas or in the DOM poster (DS L3; palette unit test).

---

## 6. Animation choreography

Preset ids are from MS 3.6. All entrance motion in this section is CSS, at every width, with no JavaScript.

### 6a. Entrance timeline (`sq-hero-open`, times from first paint)

| Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H1 word 0 "Job" (`kt-ink`) | `color` | `--body` #8cab87 | `--foreground` #ddffdc | `--dur-ink` 360ms | 0ms | `--ease-post` cubic-bezier(0.22, 1, 0.36, 1) | First paint (CSS keyframes) |
| H1 word 1 "applications" | `color` | same | same | 360ms | 70ms (`--stagger-word`) | `--ease-post` | First paint |
| H1 word 2 "you" | `color` | same | same | 360ms | 140ms | `--ease-post` | First paint |
| H1 word 3 "would" | `color` | same | same | 360ms | 210ms | `--ease-post` | First paint |
| H1 word 4 "sign." | `color` | same | same | 360ms | 280ms (ends 640ms) | `--ease-post` | First paint |
| Signature rule (`kt-sign-rule`) | `transform` | `scaleX(0)`, origin left | `scaleX(1)` | `--dur-sign` 500ms | `--delay-sign` 700ms (ends 1200ms) | `--ease-post` | First paint |
| Lane receipt, DOM poster (`en-poster-to-canvas`) | `opacity` | 1 | 0 | `--dur-post` 600ms | Starts at `max(stageReady, FCP + 1200ms)` | `--ease-linear` | `Stage` ready, tier 1 or 2 only |
| Lane receipt | visually hidden | visible | hidden (still read by AT) | 0ms | On `transitionend` of the fade | n/a | Sets `html[data-stage="live"]` |
| Canvas slip (`mi-tilt`) | `rotation.y`, `rotation.x` added to the pose | 0 | up to ±6 deg (y), ±3 deg (x) | Continuous, settles in about 1.1s | Enabled after the fade | Critically damped: `t += (target − t) × (1 − e^(−6·dt))` | `pointermove` on `window` |
| Head row, micro-label, lead, CTAs, microcopy, chip, caption, toggle, mini receipt | none | n/a | n/a | n/a | n/a | n/a | Present and final at first paint |

Motion groups: one (the ink and sign timeline), then one (the fade). The fade never overlaps the ink (MS 3.4). Longest automatic motion: 1200ms (`MAX_AUTOPLAY_MS` 4500).

CSS (in `web/components/landing/motion.css`; the MS 4.1 block with the corrections in 10.4):

```css
.kt-ink { color: var(--foreground); }
.kt-ink__w { animation: kt-ink var(--dur-ink) var(--ease-post) calc(var(--i) * var(--stagger-word)) both; }
@keyframes kt-ink { from { color: var(--body); } to { color: var(--foreground); } }

.kt-sign-rule { position: relative; }
.kt-sign-rule::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -0.16em; height: 0;
  border-top: 1px solid var(--foreground); transform-origin: left center;
  animation: kt-sign var(--dur-sign) var(--ease-post) var(--delay-sign) both;
}
@keyframes kt-sign { from { transform: scaleX(0); } to { transform: scaleX(1); } }

/* No replay after the first run in this document (soft navigation back to "/"). */
.lp-hero[data-inked] .kt-ink__w,
.lp-hero[data-inked] .kt-sign-rule::after { animation: none; }

/* Reduced motion: final state at frame 0, with no delayed step. */
:root[data-motion="reduced"] .kt-ink__w,
:root[data-motion="reduced"] .kt-sign-rule::after { animation: none; }
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion="full"]) .kt-ink__w,
  :root:not([data-motion="full"]) .kt-sign-rule::after { animation: none; }
}

[data-receipt-poster] { transition: opacity var(--dur-post) var(--ease-linear); }
html[data-stage-fading] [data-receipt-poster] { opacity: 0; }
html[data-stage="live"] [data-receipt-poster] { opacity: 0; clip-path: inset(50%); width: 1px; height: 1px; overflow: hidden; }
```

`data-inked`: `EntryPoster` adds one `animationend` listener on `#entry-00`. When `event.animationName === "kt-sign"` it sets `data-inked` on that section and removes the listener. Activity preserves the section's DOM across soft navigations, so returning to `/` does not re-ink. A full reload inks again, which is correct for a new arrival. `data-stage-fading` is set by `Stage` when the fade starts and removed at `transitionend`, when `data-stage="live"` is set.

H1 markup (server, `entry-00-hero.tsx`). The spans are `display: inline`, so balancing and reading order are normal:

```html
<h1 id="entry-00-title" tabindex="-1" class="lp-display kt-ink lp-hero__h1">
  <span class="kt-ink__w" style="--i:0">Job</span> <span class="kt-ink__w" style="--i:1">applications</span>
  <span class="kt-ink__w" style="--i:2">you</span> <span class="kt-ink__w" style="--i:3">would</span>&nbsp;<span
  class="kt-ink__w kt-sign-rule" style="--i:4">sign.</span>
</h1>
```

The component splits `landingCopy["entry-00-hero"].h1` on spaces, so the words are not hard-coded, and joins the last two words with U+00A0 (F4). A build-time assertion fails if the split does not yield exactly 5 words ending in "sign.".

### 6b. Scroll-linked behaviour

| Property | Value |
| --- | --- |
| Pin | None |
| Scrub | None in this section. Pose progress is read from `u` and smoothed by `POSE_LAMBDA` (MS 5.3) |
| ScrollTrigger `entry-00:pose` | Created by `web/lib/motion/scene-driver.ts` (motion chunk, 1024px and wider, Full): `ScrollTrigger.create({ id: "entry-00:pose", trigger: "#entry-00", start: "top 85%", end: "bottom 15%", refreshPriority: 0, onUpdate: s => { sceneInput.u[0] = s.progress; sceneInput.version++ } })` |
| Hero's own `u₀₀` | Already 0.478 at scroll 0 (1440 by 900, because the hero top sits above 85%). It drives no value: `slip-open` prints nothing and has no in-state motion |
| What moves while the hero is in view | Entry 01's `u₀₁`, from scroll y = 135px (entry 01 top at 765px = 85% of 900) |
| Lenis | Active at 1024px and wider with Full (wheel smoothing only); native scroll otherwise |

Progress-to-value mapping while the hero is on screen (1440 by 900; entry 01 height about 810px, so its `u` range is 810 + 630 = 1440px; `s = smoothstep(0, 0.25, u₀₁)`; values are targets, which the pose approaches at λ = 7.7/s):

| Scroll y | `u₀₁` | `s` | Offset x (lane fraction, px) | Offset y (Hc fraction, px; negative is down) | z | Rotation (x, y, z) | Scale | `uLevel` | Tilt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 to 135 | 0 | 0 | 0, 0 | 0, 0 | 0 | (6, −14, 2) | 1.000 | 1.000 | On (T2) |
| 225 | 0.0625 | 0.156 | 0.023, +9.0 | −0.009, −8.4 | −0.125 | (5.69, −15.56, 1.69) | 0.972 | 0.945 | Target 0 |
| 315 | 0.125 | 0.500 | 0.075, +28.8 | −0.030, −27.0 | −0.400 | (5.00, −19.00, 1.00) | 0.910 | 0.825 | Target 0 |
| 405 | 0.1875 | 0.844 | 0.127, +48.6 | −0.051, −45.6 | −0.675 | (4.31, −22.44, 0.31) | 0.848 | 0.705 | Target 0 |
| 495 and later | 0.25 | 1 | 0.150, +57.6 | −0.060, −54.0 | −0.800 | (4, −24, 0) | 0.820 | 0.650 | Off |

Scrolling back up runs the same table in reverse. Poses reverse; printed lines and the ink do not.

### 6c. Micro-interactions

All hover rules sit inside `@media (hover: hover) and (pointer: fine)`. No transform on press anywhere. Focus is `mi-focus`: `outline: 2px solid var(--foreground); outline-offset: 2px`, instant, never transitioned.

| Element | Preset | Rest | Hover | Focus-visible | Pressed |
| --- | --- | --- | --- | --- | --- |
| Primary CTA, owner | `mi-lime` | `--accent` fill and border, `--accent-ink` text | `--accent-hover` #6ddb57, 300ms `--ease-utility` | `mi-focus` | Hover colour holds |
| Primary CTA, non-owner (only if custody moved while it is still partly visible) | `mi-default` | Ground Iron fill, 1px Phosphor White border, Phosphor White text | Carbon Veil #212525, 300ms (never lime) | `mi-focus` | Holds |
| Secondary "See how it works" | `mi-outlined` | Transparent, 1px Phosphor White border | Ground Iron fill, 300ms | `mi-focus` | Holds |
| Claim chip "see 07" | `mi-chip` | Transparent, 1px Fern Link border, Phosphor White text | Border to Phosphor White and the text underlines (1px, offset 3px), 300ms | `mi-focus`, and the underline shows | Holds |
| Compact Motion toggle | `mi-link` | Phosphor White text, Fern Link underline | Underline to Phosphor White, 300ms | `mi-focus` | Holds; on activation the posting square fills (300ms colour, kept under Reduced) |
| Canvas slip | `mi-tilt` | Pose only | Follows the pointer: `nx = clamp((clientX − slipCentreX) / (innerWidth / 2), −1, 1)`, `ny = clamp((clientY − slipCentreY) / (Hc / 2), −1, 1)`; target `y = 6·nx`, `x = 3·ny` degrees, so the face turns toward the pointer | n/a | n/a |
| Cursor | `mi-cursor` | Native everywhere; `cursor: pointer` on buttons, links and the chip | | | |

Custody transitions: the base `.lp-btn` transition is `background-color, border-color, color` at `--dur-colour` 300ms `--ease-utility` (hover). While `html[data-lime-handover]` is set (300ms, by `LimeCustody`), candidates use `--dur-lime-step` 150ms and the incoming owner waits 150ms (MS 6.1). DS 5.3's snippet uses 150ms for every transition. Build MS's two-speed version (10.4, R6).

Clicking the CTAs and chip:

- Primary: a normal navigation to `/sign-up`.
- Secondary: `#entry-02` is about 1.8 viewports away at 1440 by 900, under `SMOOTH_ANCHOR_MAX_VH` (2). At 1024px and wider with Full it is `lenis.scrollTo(target, { offset: -80, duration: 0.9, easing: easeTravel })`. Entry 01 posts instantly on the way (monotonic rule), `history.pushState` runs, and focus moves to `#entry-02-title` with `preventScroll`. Elsewhere the jump is native and instant.
- Chip "see 07": more than 2 viewports, so the jump is instant at every width. Focus moves to `#entry-07-title`.

### 6d. Hand-off to entry 01

| Order | What | Detail |
| --- | --- | --- |
| 1 | Entry 01 posts | At scroll y = 135 (1440 by 900): its head rule draws (`en-post-rule`, 600ms) and its title rises (`kt-line-rise`, from +80ms). Owned by the entry 01 spec |
| 2 | Slip recedes | Pose blend as in 6b, scroll y 135 to 495. The receding slip makes room for the debit rows. The tilt eases to 0 |
| 3 | Lime leaves the hero | `LimeCustody` hands lime to the navbar when the last pixel of the hero CTA leaves the viewport (scroll y ≈ 640 at 1440 by 900, ≈ 584 at 375 by 667). `ho-lime`: the hero CTA goes to its fallback over 150ms, then the navbar "Start free" fills over 150ms. Two lime fills never coexist |
| 4 | Tier 0 lane receipt | Stays in its `slip-open` CSS pose. From entry 01 on, its `<ol>` gains lines as entries post (as specified in the entry 01 spec). The poster and the lane list are the same element, so nothing is swapped |
| 5 | Below 1024px | The mini receipt scrolls away with the hero. Nothing replaces it until the tape appears at entry 02 |

---

## 7. Reduced-motion, no-JS and low-tier variants

### 7.1 Variant matrix

| Context | Ink and sign rule | Lane at 1024px and wider | Tilt | Lime | Anchors |
| --- | --- | --- | --- | --- | --- |
| Full, tier 2 | 1.2s CSS sequence | DOM poster, then a 600ms fade to the canvas with curl | On (fine pointer) | Hero CTA; 150 + 150ms hand-overs | Smooth up to 2 viewports, else instant |
| Full, tier 1 (`deviceMemory <= 2`, coarse pointer with ≤4 cores, or max texture < 4096) | Same | Fade to a flat canvas slip (no curl), so the frames are identical through the whole fade | Off | Same | Same |
| Full, tier 0 by hardware (no WebGL 2, `saveData`, forced colours, two context losses, 10s init timeout, chunk error) | Same | DOM poster stays in its pose for the whole visit; no WebGL chunk is requested | Off | Same | Same (Lenis still runs) |
| Reduced (OS setting without a stored "Full", or the visitor chose Reduced) | `animation: none`: Phosphor White and the drawn rule at frame 0 | DOM poster in its static pose (a still pose is not motion); no GSAP, Lenis or WebGL download | Off | Instant swap | Native, instant |
| Below 1024px (any motion setting) | Runs with Full, final with Reduced | No lane. Mini receipt, flat, static | n/a | Same rule; instant under Reduced | Native, instant |
| No JavaScript | CSS still runs (or is final under the OS reduce query, because the head script did not run) | DOM poster at `perspective-origin: 50% 50%`; no canvas | Off | Only the hero CTA is lime (server `data-lime-owner="hero"`) | Native |
| Forced colours (`forced-colors: active`) | Rule visible in `CanvasText` (it is a border, not a background) | Stage hidden; receipt gets `border: 1px solid CanvasText` and `transform: none` | Off | System colours | Native |

### 7.2 Switching the Motion control while in the hero

Activating "Reduce motion":

1. `completeAll()` runs: the poster fade jumps to its end if running, and the ink jumps to final (`animation: none` applies).
2. `data-motion="reduced"` is set and `localStorage["kairos:motion"]` is written (in try/catch).
3. The stage unmounts. `data-stage` is removed, so the DOM poster is visible again in its static pose.
4. `footer.motionLive` is announced in a polite live region.

Switching back to Full re-runs the probe and, on tier 1 or 2, the canvas fades in over the poster again (600ms). The ink does not replay (`data-inked`).

### 7.3 Slow network

- Hydration is late: the hero is complete and static, and lime is correct from server HTML.
- Fonts are late: `next/font` metric-adjusted fallbacks; the ink runs on whatever face is painted, and no JavaScript waits for fonts.
- The WebGL chunk is slow: the DOM poster stays. If the visitor has scrolled past the hero by the time the stage is ready, the canvas fades in at the current state with every posted line already printed (no sweep).

---

## 8. Accessibility

**Landmarks and heading.** The hero is `<section id="entry-00" aria-labelledby="entry-00-title">` inside `<main id="main">`. The `<h1 id="entry-00-title" tabindex="-1">` is the page's only H1. There is no H2 or H3 in this section. The lane is `<aside aria-label="Sample receipt">`, a sibling of the hero inside `[data-story]`, rendered at 1024px and wider (`display: none` below). The mini receipt is `<figure>` with a visually hidden `<figcaption>Sample receipt</figcaption>`, rendered below 1024px only (`display: none` at 1024px and wider), so assistive technology never meets two receipts.

**Reading order.** "00" (real text, as in every entry head; the rule and ticks are `aria-hidden="true"`), micro-label, H1 (read as one sentence; the word spans are inline), lead, primary CTA, secondary CTA, microcopy with "See entry 07, Billing", then (1024px and wider) the caption and the "Reduce motion" toggle, then the aside: the intro sentence, "KAIROS · RECEIPT · SAMPLE", list item "00 · Ledger opened".

**Focus order.** Skip links ("Skip to main content" to `#entry-00-title`, "Skip to pricing" to `#entry-07-title`), then the navbar (logo, links, Log in, Start free; or Menu below 1024px), then the rail links at 1280px and wider, then primary CTA, secondary CTA, "see 07" chip and "Reduce motion" (1024px and wider). Then entry 01. The H1 is not in the tab order (`tabindex="-1"`, programmatic focus only). `scroll-padding-top` is 80px at 1024px and wider and 128px below, so focused targets never sit under the navbar (WCAG 2.4.11).

**ARIA.**

| Element | Attributes |
| --- | --- |
| Primary CTA | Plain link, name "Start with 25 free applications". Custody never changes its name or role (`shared.limeOwnerAria` is empty) |
| Secondary CTA | `<a href="#entry-02">`, name "See how it works" |
| Claim chip | `<a href="#entry-07" aria-label="See entry 07, Billing" data-claim="entry-00-hero.microcopyChip">see 07</a>` |
| Compact Motion toggle | `<button type="button" aria-pressed="false" hidden>` in server HTML, revealed on hydration. Name "Reduce motion"; `aria-pressed` is `true` when Reduced. The posting square is `aria-hidden` |
| Head rule and ticks | `aria-hidden="true"` |
| Canvas | `aria-hidden="true"`, `pointer-events: none`, not focusable |
| Lane receipt | Real text; the intro sentence uses `lp-sr-only`; prints are appended silently (no live region) |
| Live region | One polite region (shared with the footer control) announces `footer.motionLive` after a toggle change |

**Screen-reader text for visuals.** The WebGL slip and the DOM poster are represented by the aside's text: `laneAsideIntro`, then the header, then the `<ol>`. The ink and the signature rule carry no information and have no text alternative.

**Contrast of new pairings.** All pairings are in DS 9. The one pairing this spec adds is the heat band (#b6c5b5) behind no text (decor). Summary: H1 frame 0 8.29:1, final 19.41:1; lead 12.55:1; label and number 10.29:1; microcopy and caption 8.29:1; chip border 6.89:1; CTA label 14.32:1; receipt ink 17.61:1 (lane) and 14.89:1 (mini line); print head on Void 6.89:1; focus ring 19.41:1.

**Targets.** CTAs 48px tall; chip and toggle 44px hit areas through `::before`; at least 8px between hit areas (the chip sits on the microcopy line, which is not interactive). Stacked phone CTAs have a 12px gap.

**Motion.** Nothing moves for more than 1.2s without input; there are no loops. The Motion control is reachable before the story starts (here at 1024px and wider, in the menu sheet below).

---

## 9. Performance notes

| Item | Budget or fact |
| --- | --- |
| What animates | 5 `color` keyframes (paint only, five text runs), 1 `transform` on `::after` (compositor), 1 `opacity` transition on the poster (compositor), canvas uniforms (GPU). Nothing animates width, height, position, font, filter, clip or mask (MS 12.1) |
| LCP | The H1 is server text painted at FCP. The poster is a background-coloured block with small text nodes and is not an image candidate. At 1024px and wider the H1 (about 800 by 191px at 1440) is the largest text block. On 360 to 414px phones the five-line lead (about 328 by 135px) can be marginally larger than the three-line H1. Both paint in the same frame, so LCP time equals FCP either way. Targets: LCP ≤ 1.5s desktop, ≤ 2.5s mobile |
| CLS | 0 from this section. Fixed 48px button heights; the caption block is absolutely positioned; the Motion toggle's reveal adds content without moving any existing element; fonts use metric-adjusted fallbacks |
| Layers | Navbar (backdrop blur), poster (3D transform, about 301 by 677 CSS px, about 3.3MB at DPR 2 while composited), canvas (fixed). `will-change: opacity` is set on the poster only during the fade (by `data-stage-fading`) and removed after; it counts toward `MAX_WILL_CHANGE` 4 |
| Element count | Section ≤ 40 elements (5 H1 spans, 11 ticks, 2 CTAs, chip, caption block, mini receipt ≤ 6). Lane receipt at entry 00 ≤ 8 elements |
| Assets | No raster images on the landing (ARCH budget: 0 `image` responses). Fonts via `next/font`, both preloaded: Inter Tight 400 (display, about 33KB woff2) and Inter 400/500 (about 48KB), inside the 85KB font budget. The WebGL poster files `receipt-slip-open.avif` and `.webp` are not produced (10.4, R1) |
| HTML | The hero's share of the 60KB gzip HTML budget is about 4KB (copy, 11 tick spans, receipt rows) |
| JavaScript | The hero ships no island of its own. It relies on `EntryPoster` (adds one `animationend` listener, under 0.2KB), `LimeCustody`, `LaneReceipt` (adds the perspective-origin observer, under 0.4KB) and `MotionToggle`, all inside the 20KB islands budget. The motion chunk (60KB) and WebGL chunk (140KB) load only at 1024px and wider with Full, after idle |
| GPU | 0 renders at rest. The fade is 600ms of frames (at most 36 at T2, 18 at T1). Tilt renders only while the smoothed value is more than 0.01 degrees from its target (about 1.1s per pointer move). Frame budget ≤ 16.7ms at T2, 33.3ms at T1 |
| Fill | The canvas covers the viewport, but the paper alpha is 0 outside the slip. No post-processing (0 passes) |

---

## 10. Implementation

### 10.1 Files

| Path | Kind | Change | Responsibility here |
| --- | --- | --- | --- |
| `web/app/(landing)/page.tsx` | Server | New (moved from `(public)/page.tsx`) | Renders `<div data-story>` with the lane aside, `<Entry00Hero />` first, then entries 01 to 06 |
| `web/components/landing/entries/entry-00-hero.tsx` | Server | New | The whole section markup (3.1); splits the H1 into word spans; renders `EntryRule`, `ClaimChip`, `ReceiptPaper variant="mini"`, and the caption with `<MotionToggle variant="compact" />` |
| `web/components/landing/marks/entry-rule.tsx` | Server | New | `EntryRule({ entry: EntryId })`: number, rule, 11 ticks, current tick |
| `web/components/landing/marks/chip.tsx` | Server | New | `ClaimChip({ to: EntryId, claimId: string })`: builds `href="#entry-NN"` and the name from `shared.claimChipName` |
| `web/components/landing/marks/receipt-paper.tsx` | Server | New | `ReceiptPaper({ variant: "lane" \| "mini" \| "slot", header: string, children })`: paper, rows, perforation, heat band, head (4.3) |
| `web/components/landing/islands/lane-receipt.tsx` | Client | New | Renders `ReceiptPaper variant="lane"` with `data-receipt-poster`, the intro and `<ol id="receipt-lines">`; appends lines from `useLedger`; writes `--lp-persp-x` and `--lp-persp-y` (5.4) |
| `web/components/landing/islands/motion-toggle.tsx` | Client | New | `MotionToggle({ variant: "full" \| "compact", label?: string })`; compact renders the 44px text button with `aria-pressed` |
| `web/components/landing/islands/entry-poster.tsx` | Client | New | Adds the `kt-sign` `animationend` listener that sets `data-inked` (6a) |
| `web/components/landing/stage/stage.tsx`, `scene.ts`, `poses.ts` | Client, WebGL chunk | New | `slip-open` pose, poster fade start (`data-stage-fading`), `data-stage="live"`, tilt (WS internals) |
| `web/lib/motion/scene-driver.ts` | Motion chunk | New | `entry-00:pose` ScrollTrigger (6b) |
| `web/components/landing/landing.css` | CSS | New | `.lp-hero*` layout block (10.3), `.lp-receipt*`, `.lp-lane__sticky` perspective |
| `web/components/landing/motion.css` | CSS | New | `kt-ink`, `kt-sign-rule`, `en-poster-to-canvas` and their reduced and inked overrides (6a) |
| `web/content/landing-copy.ts` | Data | New | Adds `entry-00-hero.motionToggle` (F5) |
| `web/components/landing/hero.tsx`, `match-preview.tsx` | | Delete | Replaced (ARCH 1.2) |

`Entry00Hero` takes no props. It reads `landingCopy["entry-00-hero"]`, `landingCopy.shared` and `ENTRIES[0]` on the server, so copy stays in HTML and out of client bundles.

### 10.2 Reused

`next/link` for the primary CTA. The shared `Logo` (P2 edit, Phosphor White on the landing) and `Navbar variant="landing"` with `caption={<EntryCaption />}` and `sheetExtra={<MotionToggle variant="compact" />}`. No shared `Button`, `Container`, `SectionHeading` or `CtaBand` (ARCH 7.1).

### 10.3 Layout CSS (landing.css)

```css
.lp-hero { padding-top: 32px; }
.lp-hero__head, .lp-hero__label, .lp-hero__h1, .lp-hero__lead,
.lp-hero__ctas, .lp-hero__micro, .lp-hero__mini { grid-column: 1 / -1; }
.lp-hero__label { margin-top: 32px; text-transform: uppercase; }
.lp-hero__h1    { margin-top: 16px; }
.lp-hero__lead  { margin-top: 24px; max-width: var(--measure-body); }
.lp-hero__ctas  { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; }
.lp-hero__ctas > .lp-btn { width: 100%; }
.lp-hero__micro { margin-top: 16px; }
.lp-hero__mini  { margin-top: 32px; }
.lp-hero__lanecell { display: none; }

@media (min-width: 640px) {
  .lp-hero__ctas { flex-direction: row; flex-wrap: wrap; }
  .lp-hero__ctas > .lp-btn { width: auto; }
}
@media (min-width: 1024px) {
  .lp-hero { min-height: calc(100svh - var(--lp-navbar-h)); }
  .lp-hero__head  { grid-column: 1 / 9; }
  .lp-hero__label { grid-column: 1 / 8; margin-top: 40px; }
  .lp-hero__h1    { grid-column: 1 / 9; margin-top: 24px; }
  .lp-hero__lead  { grid-column: 1 / 8; margin-top: 32px; }
  .lp-hero__ctas  { grid-column: 1 / 8; margin-top: 40px; }
  .lp-hero__micro { grid-column: 1 / 8; }
  .lp-hero__mini  { display: none; }
  .lp-hero__lanecell { display: block; grid-column: 9 / 13; grid-row: 1; position: relative;
                       height: 0; container-type: inline-size; }
}
.lp-lane__sticky { position: sticky; top: var(--lp-navbar-h); height: calc(100lvh - var(--lp-navbar-h));
  perspective: calc(1.58579 * 100lvh);
  perspective-origin: var(--lp-persp-x, 50%) var(--lp-persp-y, 50%); container-type: inline-size; }
.lp-receipt--lane { --slip-w: min(85cqw, calc(0.36 * (100lvh - var(--lp-navbar-h))));
  position: absolute; left: 50%; top: 50%; width: var(--slip-w); height: calc(2.25 * var(--slip-w));
  transform: translate(-50%, -50%) rotateX(-6deg) rotateY(-14deg) rotateZ(-2deg); }
```

`.lp-receipt--lane` uses the sticky box as its `cqw` container (lane width), so `--slip-w` equals the WebGL `W`. Its rows use their own `cqw`, so the paper is also a container (`container-type: inline-size` on an inner wrapper that fills the paper).

### 10.4 Presets, tokens and resolved conflicts

Presets: `sq-hero-open`, `kt-ink`, `kt-sign-rule`, `en-poster-to-canvas`, `mi-tilt`, `mi-lime`, `mi-default`, `mi-outlined`, `mi-chip`, `mi-link`, `mi-focus`, `mi-cursor`, `ho-lime`, `ho-pose` (leaving).

Tokens: `--background`, `--foreground`, `--body`, `--label`, `--lead`, `--link`, `--border`, `--divider`, `--surface`, `--surface-raised`, `--accent`, `--accent-hover`, `--accent-ink`, `--chip-link-border`, `--receipt-paper`, `--on-mint-ink`, `--on-mint-body`, `--on-mint-muted`, `--lp-perforation-image-mint`, `--type-display-landing`, `--lh-display-landing`, `--tracking-display-landing`, `--type-lead-landing`, `--measure-body`, `--r-pill`, `--r-button`, `--lp-navbar-h`, `--lp-head-h`, `--lp-hit`, `--lp-hit-gap`, `--section-pad-landing`, `--rule-rhythm`, `--dur-ink`, `--dur-sign`, `--dur-post`, `--dur-colour`, `--dur-lime-step`, `--stagger-word`, `--delay-sign`, `--ease-post`, `--ease-linear`, `--ease-utility`, `--lp-z-canvas`, `--lp-z-content`. New tokens: none. New custom properties: `--slip-w` (local), `--lp-persp-x`, `--lp-persp-y` (written by `LaneReceipt`).

| # | Conflict | Sources | Build |
| --- | --- | --- | --- |
| R1 | Poster: AVIF `<img>` (CD 4.7, DS 8.2, WS 8.5) or DOM | MS 7.3 and D7, ARCH 6.1 | DOM poster (the lane receipt). The H1 stays the LCP candidate and 40KB is saved. WS test 17 compares the DOM poster with the canvas instead of an image |
| R2 | CSS pose signs | MS 7.3 `rotateX(6deg) … rotateZ(2deg)` | `rotateX(-6deg) rotateY(-14deg) rotateZ(-2deg)`, perspective `1.58579 × 100lvh`, origin at the viewport centre (5.4). MS 7.3 should be corrected |
| R3 | Receipt type under 12px at 1024 to 1440 | DS 3.3 floor vs WS 3.5 glyph sizes | DOM rows use `max(12px, …cqw)`. WS owner: set texture glyph sizes to `max(40, ceil(12 × 1024 / W))` texels (header) and `max(48, ceil(12 × 1024 / W))` (full line) at draw time, so the canvas matches |
| R4 | Who fades | MS 7.1 "canvas opacity 0 to 1 over the poster" vs WS 9.1 "poster fades out over the canvas" | The poster fades out (the canvas is at z 0 under the content layer, so fading the canvas in would be invisible until a pop) |
| R5 | Graticule crossing the slip | DS 6.1 (rule to the container's right edge) | Hero head row ends at column 8 at 1024px and wider. The same problem affects entries 01 to 06, whose rules would draw a 1px line across the slip; DS owner to decide for all story entries |
| R6 | Lime button transition speed | DS 5.3 (150ms always) vs MS 6.1 (300ms hover, 150ms + 150ms during hand-over) | MS 6.1 |
| R7 | Tilt input | MS 6.5 (lane-relative, 0 outside the lane) vs WS 5.4 (window-relative to the slip centre) | WS 5.4, so the slip turns toward the pointer anywhere on the page, including the CTA |
| R8 | Root attribute names | WS `data-stage-ready`, `data-stage-tier` vs ARCH `data-stage="live"`, `data-tier` | ARCH names |
| R9 | Signature rule offset | MS 4.1 `bottom: -0.06em` vs DS 3.3 `-0.16em` | `-0.16em` (clears the g descender). Drawn with `border-top` so forced colours keep it |
| R10 | Slip height unit | DS `100svh` vs WS `100lvh` | `100lvh` in every lane formula (equal on desktop; matches `Hc`) |
| R11 | Reduced-motion ink | MS relies on zeroed durations, but zeroed durations with an unzeroed stagger or delay would leave words Sage 60 for up to 280ms and the rule hidden for 700ms | `animation: none` under Reduced (6a) |

---

## 11. Acceptance criteria

(U) Vitest, (E) Playwright, (L) Lighthouse CI, (M) manual.

1. (E, no JS) The section has `id="entry-00"`, `data-section="entry-00-hero"`, `data-entry="00"`, `data-scene="slip-open"`, `aria-labelledby="entry-00-title"`; the H1 text, normalised for whitespace, equals `landingCopy["entry-00-hero"].h1`; every string in section 2 (except F3) is in the DOM.
2. (E, no JS) The hero CTA computes `background-color: rgb(127, 238, 100)`; the navbar "Start free" does not; no other element in the first viewport has a lime background, colour, border, outline, fill, stroke or shadow (DS L10), at 1440 by 900 and 390 by 844.
3. (E) At frame 0 (screenshot within 16ms of FCP, `animation` paused at 0) every H1 word computes `color: rgb(140, 171, 135)` and is fully opaque, unclipped and untransformed; at 1300ms every word computes `rgb(221, 255, 220)` and the rule's `::after` computes `matrix(1, 0, 0, 1, 0, 0)`.
4. (E) Word `--i` values are 0 to 4, `animation-delay` is 0, 70, 140, 210 and 280ms, and the rule's delay is 700ms with duration 500ms.
5. (E, `reducedMotion: "reduce"`, and separately `data-motion="reduced"` from localStorage) At frame 0 words are Phosphor White and the rule is drawn; no `<canvas>` exists; no request matches the WebGL or motion chunk.
6. (E) After `animationend` of `kt-sign`, `#entry-00` has `data-inked`; navigating to `/pricing` and back does not restart `kt-ink` (`getAnimations()` on the words is empty).
7. (E) The H1 renders on 2 lines at 1440, 1280, 1024 and 768 widths, on 2 or 3 lines at 360 to 389, and no line consists of "sign." alone at any width from 320 to 1920 in 10px steps.
8. (E) At 375 by 667 the primary CTA's bottom edge is ≤ 667px at scroll 0; at 1440 by 900, 1280 by 800 and 1024 by 768 the microcopy's bottom is above the fold and entry 01's top is at or below the fold.
9. (E) At 1024, 1280 and 1440 every hero text box ends left of column 9 (x ≤ lane left − 32px), except the caption block, which lies inside the lane; `scrollWidth <= clientWidth` at 360, 390, 768 and 1024.
10. (E, tier forced 2) The canvas appears after idle, never earlier than FCP + 1200ms; the poster's opacity runs 1 to 0 over 600 ± 50ms with a linear curve; afterwards `html[data-stage="live"]` is set, the poster is visually hidden, and `#receipt-lines` is still in the accessibility tree with "00 · Ledger opened".
11. (E, tier forced 2, SwiftShader, 1440 by 900 and 1920 by 1080) A screenshot of the lane with the canvas only and one with the DOM poster only differ by ≤ 1% of pixels outside the top 22% of the slip (curl region excluded); with tier 1 forced the whole slip matches within 1%.
12. (E) `window.__kairosStage.bodyRect` at rest and at maximum tilt (pointer at the window's left and right edges, then top and bottom) starts at or right of the lane's left edge (`[data-lane]` rect) at 1024, 1280 and 1440 widths, and ends at least 8px above the caption's first text line.
13. (E, tier 2, fine pointer) Moving the pointer to the CTA turns the slip so its rotation y decreases (toward −20); 1.2s after the pointer stops, the stage reports 0 renders over the next 2s.
14. (E, tier 2) At rest, with no pointer movement, `renders` stays constant for 2s (0 frames at rest).
15. (E) Scrolling to y = 495 at 1440 by 900 converges the pose to scale 0.82, rotation (4, −24, 0) and `uLevel` 0.65 within 600ms; scrolling back to 0 returns to (6, −14, 2) and scale 1.00, with header and line 00 still printed.
16. (E) Scrolling until the hero CTA leaves the viewport makes the navbar "Start free" lime, and at no 16ms sample during the hand-over are two elements lime.
17. (E) "See how it works" at 1440 by 900 with Full scrolls smoothly (900 ± 100ms) to `#entry-02`, focuses `#entry-02-title` and pushes `#entry-02`; at 390 by 844 the jump is instant; "see 07" is instant at all widths and focuses `#entry-07-title`.
18. (E, axe) No violations in the hero at 1440 by 900 and 390 by 844; one `h1`; the claim chip's accessible name is "See entry 07, Billing"; the toggle has `aria-pressed` and name "Reduce motion".
19. (E) Tab order from the page top: skip links, navbar controls, rail links (1280 and wider), primary CTA, secondary CTA, chip, "Reduce motion" (1024 and wider), then the first focusable element of entry 01. Every focus ring is visible and not covered by the navbar.
20. (E) Pressing "Reduce motion" sets `html[data-motion="reduced"]`, writes `localStorage["kairos:motion"] = "reduced"`, removes the canvas within 100ms, shows the DOM poster in its pose, sets `aria-pressed="true"` and announces "Motion set to Reduced."
21. (E) Every interactive hero element has a hit area ≥ 44 by 44px and ≥ 8px from neighbouring hit areas, at 390 by 844 and 1440 by 900.
22. (E, `forcedColors: "active"`) The stage is hidden, the receipt has a visible border and no transform, and the signature rule is visible.
23. (E, WebGL disabled) Tier 0: the DOM poster stays in its pose, no WebGL chunk is requested, and all hero text and behaviour are unchanged.
24. (U) `computeSlipWidth(laneW, Hc)` returns 253.4, 265.0, 301.0 and 326.4 for the four WS 5.1 viewports, and the caption `top` formula gives 12px below the slip bottom at each.
25. (U) The CSS pose string generated from the WS `slip-open` rotation equals `rotateX(-6deg) rotateY(-14deg) rotateZ(-2deg)`, and the inverse conversion round-trips.
26. (L) Desktop: LCP ≤ 1.5s, CLS ≤ 0.05, TBT ≤ 50ms; mobile: LCP ≤ 2.5s, TBT ≤ 150ms; the LCP element is the H1 at 1440 and 1024, and the H1 or the lead at 390.
27. (U) Copy lint passes over `entry-00-hero` keys: no U+2014 or U+2013, no hype words, no "No card".
28. (M) A vestibular review at 1440 by 900 and on a phone confirms that nothing moves after 1.2s without input, apart from the single poster fade and pointer-following tilt.
