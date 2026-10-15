# Section spec 08: `entry-05-send-receipt` (Send and receipt: the paper band)

Tier: signature. Scene states: `slip-tear` (approved visitor) and `ghost-path` (visitor who has not approved). Scroll length: 260vh at 1440 by 900 (a 200vh stage wrapper with 100vh of pinned scroll, then about 60 to 77vh of mint flow). Previous section: `entry-04-approve` (`slip-hold`). Next section: `entry-06-replies` (`slip-reply`).

Sources this spec builds on, by short name: CD = `01-creative-direction.md` (4.6, 5.3 entry 05, 9.1, 9.2), DS = `02-design-system.md` (3, 4, 5.4, 6.11, 9.5), MS = `03-motion-system.md` (5.3 to 5.5, 9.6, 9.7, 9.9, 10), WS = `04-webgl-scene.md` (5.5 to 5.7, 6), AR = `05-architecture.md` (2.3, 4.3, 4.7), COPY = `06-copy-deck.md` (10, 17). Where this spec refines a sibling document, the refinement is listed in 10.4 with its reason. An engineer can build the section from this file alone.

---

## 1. Purpose and narrative beat

**Purpose.** Show how an application is sent and what Kairos keeps afterwards. The visitor must leave this entry knowing four facts:

1. The Chrome extension fills the employer's own form in the visitor's browser; the cloud applier sends approved applications on Pro and Max with the laptop closed.
2. Review mode fills the form and stops so the visitor presses submit; the extension never presses submit with an empty required field (PRD AC11).
3. Every submission leaves a receipt: the fields, the answers, the resume version, the confirmation page, the approval time and the one credit it cost.
4. A failed submit costs 0 credits (AC10) and a submission reported twice is charged once (AC9).

The entry settles no row in entry 01 (row 05 is settled in entry 07). Feature build status is gated by G3 and ships with "(in beta)" wording until confirmed (2.3).

**Narrative beat: proof.** Entry 04 was the only still moment on the page; the visitor chose when to approve. Entry 05 is the consequence, and it is the one place the page pins. The receipt slip stops printing, tears along its perforation with the page's only accelerating curve, glides to the centre of the screen, becomes a real DOM table, and then the page itself turns to paper around it. Nothing loops and nothing bounces: the tear is a single 700ms snap, the travel is scrubbed by the visitor's own scroll, and the paper band arrives and stays.

The honesty rule is physical here. A visitor who never approved gets no receipt: a dashed outline travels instead, and the slot says "No receipt yet. Nothing was sent." with an in-place Approve. The page never shows a receipt for something the visitor did not approve.

---

## 2. Content (final copy from 06-copy-deck.md, verbatim; flag any change you need and why)

All strings live in `landingCopy["entry-05-send-receipt"]` (`web/content/landing-copy.ts`) and in `landingCopy.scene.lines`. No string is typed into a component. U+00B7 (·) separates fields and U+2212 (−) is the minus sign. No em or en dashes.

### 2.1 Stage, receipt, slips and ghost

| Key | Element | Copy |
| --- | --- | --- |
| `number` | Entry number | 05 |
| `eyebrow` | Caption, uppercase by CSS | Send and receipt |
| `h2` | H2 (one element: on Void, then re-entering on mint) | Sent through the employer's own form. Then a receipt. |
| `receiptHeader` | Pre-printed header line on the receipt | KAIROS · RECEIPT · SAMPLE |
| `rows[0]` | Form | The employer's own page on Greenhouse |
| `rows[1]` | Fields sent | 14 · each shown to you first (sample count) |
| `rows[2]` | Answers | 7 · approved by you · 0 guessed (sample count) |
| `rows[3]` | Resume | Version 3 · every line cites a confirmed fact, followed by the M4 chip `cites #07, #11` |
| `rows[4]` | Confirmation page | Saved |
| `rows[5]` | Approved | `{approvedAt}` (from `formatStamp`), or the word `sample` when `approvedAt` is null |
| `rows[6]` | Credit | −1 credit · charged once |
| `receiptCaption` | `<caption>` of the receipt table | Sample receipt. This is what Kairos saves after a real submission. Nothing was sent from this page. |
| `slipAStatus` | Slip A status word | Failed |
| `slipALine` | Slip A line | Required field empty: work authorization · 0 credits |
| `slipACaption` | Slip A `<figcaption>` | Failed submits cost nothing. The reason is shown so you can fix it and send again. |
| `slipBStatus` | Slip B status word | Submitted |
| `slipBLine` | Slip B line | Reported twice · charged once · −1 credit |
| `slipBCaption` | Slip B `<figcaption>` | If the extension reports one submission twice, you are charged once. |
| `ghostTitle` | Ghost receipt title (h3) | No receipt yet. Nothing was sent. |
| `ghostBody` | Ghost receipt body | A receipt exists only after you approve and the application is submitted. Approve the sample to print one here. |
| `ghostApprove` | Ghost button | Approve sample draft |
| `rowPrintedLive` | Polite live region after the in-place approval | Approved. Sample receipt printed. |
| `shared.sampleChip` | SAMPLE chip on the receipt header and on each slip | SAMPLE (accessible name "Sample data") |

Row labels (Form, Fields sent, Answers, Resume, Confirmation page, Approved, Credit) are the `rows[n]` element names in COPY 10.1 and are stored as `rowLabels[0..6]` in the same object.

### 2.2 How it sends (normal flow on mint)

| Key | Element | Copy (G3 confirmed) | Gated variant (ships until G3 confirms) |
| --- | --- | --- | --- |
| `sendLead` | Lead | The extension fills the employer's own form in your browser and saves what it sent: each field, each answer, the resume version and the confirmation page. | The extension (in beta) fills the employer's own form in your browser and saves what it sent: each field, each answer, the resume version and the confirmation page. |
| `cellExtensionTitle` | Cell 1 title (h3) | Chrome extension · every plan | Chrome extension (in beta) · every plan |
| `cellExtensionBody` | Cell 1 body | Runs in your browser, in your session. | same |
| `cellCloudTitle` | Cell 2 title (h3) | Cloud applier · Pro and Max | Cloud applier (in beta) · Pro and Max |
| `cellCloudBody` | Cell 2 body | Sends approved applications while your laptop is closed. | same |
| `reviewMode` | Body | Prefer to press submit yourself? Review mode fills the form and stops, and you press the employer's submit button. | Prefer to press submit yourself? Review mode (in beta) fills the form and stops, and you press the employer's submit button. |
| `requiredFields` | Body | If a required field is empty, the extension does not press submit. It tells you how many fields need you. | same |
| `boards` | Body | Public career pages on Greenhouse, Lever and Ashby. We do not automate LinkedIn, because its user agreement bans bots. | same |

Gated variants are stored as `{key}Gated` (the deck's own pattern, as in `entry-07-billing.leadGated`).

### 2.3 Printed receipt lines used here (`landingCopy.scene.lines`)

| Key | Line | When |
| --- | --- | --- |
| `05approved` | 05 · Submitted · employer form · fields saved | Stage `p` crosses 0.05 with `approvedAt` set |
| `05notApproved` | 05 · Not sent · waiting for your approval | Stage `p` crosses 0.05 with `approvedAt` null |
| `filedHeader` | KAIROS · RECEIPT · SAMPLE | Fresh paper after the tear (canvas only) |
| `05filed` | 05 · Receipt filed | Fresh paper after the tear (canvas only) |

### 2.4 Flagged changes

| # | Change | Why |
| --- | --- | --- |
| C1 | Add `receiptCaptionGated`: "Sample receipt (in beta). This is what Kairos saves after a real submission. Nothing was sent from this page." | COPY 10 says G3 covers "the receipt contents" but gives no gated string for the table. This follows the deck's own "(in beta)" pattern and adds no claim. Needs copy owner sign-off |
| C2 | `h2` line breaks differ from COPY 19 on the pinned stage: the H2 is limited to columns 1 to 4 so it stays 24px clear of the slip's travel path (WS 6.3). Expected `text-wrap: balance` result: 4 lines at 1440 ("Sent through the / employer's own / form. Then a / receipt."), 4 lines at 1280, 5 lines at 1024. In normal flow (below 1024, Reduced, no JavaScript) COPY 19's breaks hold | Layout constraint, not a copy change. COPY 19 should record the stage widths |
| C3 | `h2Alt` is not used | The primary H2 fits every layout |

---

## 3. Layout structure

### 3.1 DOM skeleton (all widths)

```html
<section id="entry-05" data-section="entry-05-send-receipt" data-entry="05"
         data-scene="slip-tear" aria-labelledby="entry-05-title" class="lp-entry lp-entry--stage">
  <div class="lp-stage-wrap" data-stage="entry-05">                 <!-- 200vh when pinned, else auto -->
    <div class="lp-stage">                                           <!-- sticky 100vh when pinned -->
      <div class="lp-mint-layer" aria-hidden="true"></div>           <!-- desktop pinned only -->
      <div class="lp-container lp-grid lp-stage-grid">
        <div class="lp-stage-title" data-stage-title>                <!-- head + eyebrow + H2 -->
          <EntryRule entry="05" />  <p class="lp-caption">…eyebrow</p>
          <h2 id="entry-05-title" tabindex="-1" data-split="lines" class="lp-heading">…</h2>
        </div>
        <div class="lp-band-intro" data-band-intro>                  <!-- below 1024: full-bleed intro -->
          <div class="lp-mint-layer lp-mint-layer--intro" aria-hidden="true"></div>
          <div data-slot="receipt" class="lp-slot"><ReceiptSlot /></div>
        </div>
        <div class="lp-stage-slips" data-stage-slips> <figure>A</figure> <figure>B</figure> </div>
      </div>
    </div>
  </div>
  <div class="lp-mint" data-surface="mint" data-band-flow> … how it sends … <Perforation /> </div>
  <div class="lp-band-after" aria-hidden="true"></div>                <!-- Void spacer, 64px / 48px -->
</section>
```

The section is full-bleed (the Mint Frost band is one of the two full-bleed elements, DS 4.1). Inner content uses `.lp-container`. `.lp` sets `overflow-x: clip` so the full-bleed band never adds horizontal scroll; full-bleed backgrounds use `width: 100%` of the section, never `100vw` (which includes the classic scrollbar on Windows).

The selector `[data-stage="entry-05"]` (this wrapper) must always be written with its value, because `<html data-stage="live">` (AR) uses the same attribute name.

### 3.2 Modes

| Mode | Condition (all known before first paint) | Wrapper | Stage |
| --- | --- | --- | --- |
| Pinned | `PIN_QUERY` `(min-width: 1024px) and (min-height: 640px)` matches and `html[data-motion="full"]` | `height: 200vh` | `position: sticky; top: 0; height: 100vh; overflow: clip` |
| Normal flow | Anything else (below 1024, below 640px tall, Reduced, no JavaScript) | `height: auto` | `position: relative`, content height |

### 3.3 Desktop 1440 and 1280 (pinned)

Grid: 12 columns, 72px columns, 32px gaps, 32px margins inside a 1280px container (DS 4.1). Column x positions at 1440 (container starts at 80): col 1 starts 112, col 4 ends 496, col 5 starts 528, col 8 ends 912, col 9 starts 944, col 12 ends 1328. At 1280 subtract 80.

| Element | Columns | Width | Vertical placement |
| --- | --- | --- | --- |
| Stage | Full bleed | 100% of section | 100vh, sticky; content area starts below the 64px navbar (`--lp-navbar-h`) |
| Title group | 1 to 4 | 384px | Top: `calc(var(--lp-navbar-h) + 32px)` = 96px. Entry head 32px (`--lp-head-h`); head to eyebrow 40px; eyebrow to H2 16px. At 1440 the H2 starts at y 200 and ends near y 427 (4 lines at 55.7px, line height 1.02) |
| Receipt slot `[data-slot="receipt"]` | 5 to 8 | 384px | Centred in the area below the navbar: `align-self: center` in a grid row that spans `calc(100vh - 64px)`. Reference measurement at 1440 by 900: height 468px, top 248, bottom 716 |
| Compact slips A and B | 9 to 12 | 384px each, stacked, 20px gap | Top aligned with the slot top. Each slip about 81px plus a 2-line caption; the stack is about 280px |
| Mint layer | Full stage | 100% by 100vh | `position: absolute; inset: 0; transform-origin: 50% 50%` |
| Flow (how it sends) | Lead, paragraphs 1 to 7; cells 1 to 4 and 5 to 8 | 696px text measure (`--measure-body` 34rem caps paragraphs) | Padding top 64px, bottom `--section-pad-landing` (128px); lead to cells 48px; cells to paragraphs 32px; paragraph gap 16px |
| Void spacer after the band | Full bleed | | 64px |

Receipt internals at 1280 and wider: padding 24px; top edge perforation (1px); header line 32px (`KAIROS · RECEIPT · SAMPLE` left, SAMPLE chip right); seven rows, each a label (Caption, 12px, 16px line) stacked above its value (14px, 20px line) with 2px between and 8px padding top and bottom, divided by 1px `--on-mint-muted` rules; the caption (12px, 16px lines) 12px below the last row; a 1px perforation at the bottom (the torn edge on desktop). Rows are at least 32px tall (DS 6.11).

Ledger rail: fixed at `right: 24px` (1440) or `right: 8px` (1280); it sits over the full-bleed mint from about p 0.83. See 10.4 X3 for its backing.

### 3.4 Laptop 1024 to 1279 (pinned when at least 640px tall)

Same placement as 3.3 with 50.7px columns at 1024: title group, slot and slips are each 299px wide. The H2 is 46.5px and takes 5 lines (about 237px). The ledger rail is hidden; the navbar shows the entry caption "05 / 10".

Receipt rows below 1280px use 4px padding top and bottom instead of 8px, so the receipt is about 552px tall at 1024 by 640, which leaves 24px inside the 576px content area. The stage runs a fit check on every ScrollTrigger refresh: if `slotRect.height > stageHeight - 64 - 24` or the title group's bottom exceeds `stageHeight - 24` (for example under text-only zoom), it disarms (10.3) and sets `data-stage-fit="false"` on the wrapper, which switches CSS to normal flow. This is the only case where entry 05 changes height after paint, and it only happens when the content cannot fit a pinned frame.

### 3.5 Tablet 768 to 1023 (normal flow)

8 columns, 69px at 768, 24px gaps and margins. No pin and no canvas.

| Element | Columns | Width | Spacing |
| --- | --- | --- | --- |
| Title group | 1 to 8 | H2 `max-width: var(--measure-title)` (14em, about 573px at 40.9px) | Head to eyebrow 32px, eyebrow to H2 12px; 2 lines |
| Band intro | Full bleed | | Padding 32px top and bottom; H2 to intro 32px |
| Receipt | 1 to 6 | 400px (cap) | Left aligned. A 24px stub sits below its bottom perforation (it tears away) |
| Mint band content | Full bleed background, content in the container | | Padding top 32px, bottom 96px |
| Slips | 1 to 4 and 5 to 8, side by side | 348px each | 20px gap; 32px below them to the lead |
| Cells | 1 to 4 and 5 to 8 | 348px each | Lead to cells 32px |
| Paragraphs | 1 to 7 | | 16px apart |
| Void spacer | | | 48px |

### 3.6 Mobile 360 to 640 (normal flow)

4 columns below 640 (16px gutter and gap), 8 columns from 640 (16px gutter, 20px gap). The receipt tape (48px, Ground Iron) stays sticky under the navbar.

| Element | Width at 360 | Spacing |
| --- | --- | --- |
| Title group | 328px; H2 36px, 3 lines | Head 32px; head to eyebrow 32px; eyebrow to H2 12px |
| Band intro | Full bleed | 32px from the H2; padding 32px 16px |
| Receipt | 328px (full content width, cap 400px) | Padding 20px; rows with 6px padding; 24px stub |
| Mint band content | Full bleed | Padding 32px 16px 80px |
| Slips | 328px each, stacked | 20px gap; 32px to the lead |
| Cells | Stacked, full width | 20px gap |
| Void spacer | | 48px |

From 640 to 767 the receipt is 400px wide and the slips sit side by side as at 768.

### 3.7 Wireframe: desktop 1440 by 900, pinned, p = 1.00 (approved visitor)

```
x: 0    112          496 528               912 944              1328   1440
y  +------------------------------------------------------------------------+
0  | NAVBAR 64px, Carbon Veil 85%   K Kairos  links ...   Log in [Start free]L|  L = the one lime fill
64 +------------------------------------------------------------------------+
   | MINT FROST: mint layer at identity, full bleed                    rail : |
96 |      05 -+-+-+-+-+-#-+-+-+-+-                                      00 : |
   |      (graticule, tick 05 = 8px)                                    .. : |
168|      SEND AND RECEIPT                                              05#: |
200|      Sent through the                                                  |
248|      employer's own     .:.:.:.:.:.:.:.:.:.:.:.:  .:.:.:.:.:.:.:.:.:.: |
   |      form. Then a       KAIROS · RECEIPT · SAMPLE [SAMPLE] | Failed  [SAMPLE] |
   |      receipt.           Form                      | Required field empty:  |
   |                         The employer's own page   | work authorization ·   |
   |                         on Greenhouse             | 0 credits              |
   |                         Fields sent               +------------------------+
   |                         14 · each shown to you    Failed submits cost
   |                         first (sample count)      nothing. The reason ...
   |                         Answers  ...              .:.:.:.:.:.:.:.:.:.:.:
   |                         Resume  Version 3 ...     | Submitted  [SAMPLE]    |
   |                         [cites #07, #11]          | Reported twice ·       |
   |                         Confirmation page  Saved  | charged once · −1 credit|
   |                         Approved  10/15/26, 2:32 PM+------------------------+
   |                         Credit  −1 credit · ...   If the extension reports
   |                         Sample receipt. This is   one submission twice ...
716|                         .:.:.:.:.:.:.:.:.:.:.:.:
900+------------------------------------------------------------------------+
   (pin releases; "How it sends" scrolls up on the same mint, then a perforated
    bottom edge and 64px of Void before entry 06)

Same viewport at p = 0.35 (travel): Void background; title group at left in
Phosphor White; the canvas slip (torn, flat) is moving from cols 9-12 toward
cols 5-8; the slot is empty; the lane printer head and stub stay at the right.
```

### 3.8 Wireframe: mobile 360, normal flow, after the print-and-tear

```
+------------------------------+
| NAVBAR 64        [Start free]L|  L = lime (no candidate is in this entry)
| TAPE 48  # 05 · Submitted ...|
+------------------------------+
| 05 -+-+-+-+-+-#-+-+-+-+-     |  Void
| SEND AND RECEIPT             |
| Sent through the             |
| employer's own form.         |
| Then a receipt.              |
|-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.|  perforated band edge (at the intro top after the tear)
| .:.:.:.:.:.:.:.:.:.:.:.:.:.  |  band intro: mint layer has grown to full width
| KAIROS · RECEIPT · SAMPLE  []|  receipt (mint paper, 1px hairline on mint)
| Form                         |
| The employer's own page on   |
| Greenhouse                   |
| ... 7 rows ...               |
| Sample receipt. This is what |
| Kairos saves after a real    |
| submission. Nothing was sent |
| from this page.              |
| .:.:.:.:.:.:.:.:.:.:.:.:.:.  |  torn edge (stub has dropped away)
|                              |  MINT band content
| | Failed [SAMPLE]          | |
| | Required field empty: ...| |
| Failed submits cost nothing. |
| | Submitted [SAMPLE]       | |
| | Reported twice · ...     | |
| If the extension reports ... |
| The extension fills the ...  |  lead
| | Chrome extension · ...   | |
| | Cloud applier · ...      | |
| Prefer to press submit ...   |
| If a required field is ...   |
| Public career pages on ...   |
|-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.|  bottom perforation
| 48px Void                    |
+------------------------------+
```

---

## 4. Visual design

### 4.1 Surfaces

| Surface | Value | Where |
| --- | --- | --- |
| Void | `--background` `#000000` | Stage before p 0.56; the title area in normal flow; the spacer after the band |
| Mint Frost | `--mint` / `--receipt-paper` `#def0dd` | Mint layer, band intro, band content, receipt paper, slip paper. No gradient. `color-scheme: light` and `data-surface="mint"` on the band root |
| Receipt and slips | Mint paper, radius 0 (A12) | Perforated top edge; desktop receipt also has a perforated bottom (torn) edge |
| Receipt on the band | Adds `box-shadow: inset 0 0 0 1px var(--on-mint-muted)` (no layout change) while `data-band="paper"` or in normal flow on mint | Without it the receipt would vanish into the band; on Void the mint against Void boundary is 17.6:1 so no hairline is drawn there |
| Ghost receipt | No paper. Edge: 1px dashes 6px on, 4px off, drawn with four `repeating-linear-gradient` backgrounds (90deg for top and bottom, 180deg for the sides) so it matches the canvas ghost outline exactly. Colour Fern Link `--link` on Void, `--on-mint-muted` on mint | The slot keeps the full receipt size in the ghost state (5.4, 10.4 X4) |

### 4.2 Type roles

| Element | Class | Size at 1440 / 1024 / 360 | Colour on Void | Colour on mint |
| --- | --- | --- | --- | --- |
| Entry number "05" | `.lp-caption` | 12px | `--label` (Moss 70) | `--on-mint-muted` |
| Eyebrow | `.lp-caption`, uppercase | 12px, +0.6px | `--label` | `--on-mint-muted` |
| H2 | `.lp-heading` | 55.7 / 46.5 / 36px, line height 1.02, -0.02em, weight 400, `ss01` | `--foreground` (Phosphor White) | `--on-mint-ink` |
| Receipt header | Inter 12px 500, uppercase, +0.08em | 12px | | `--on-mint-ink` |
| Receipt row label | `.lp-caption` | 12px | | `--on-mint-muted` |
| Receipt row value | `.lp-receipt-row` | 14px, 20px line, tabular slashed zero | | `--on-mint-body` |
| Receipt caption | `.lp-caption`, sentence case | 12px | | `--on-mint-muted` |
| Ghost title (h3) | `.lp-title` | 20px 500 | `--foreground` | `--on-mint-ink` |
| Ghost body | `.lp-small` | 14px | `--body` (Sage 60) | `--on-mint-body` |
| Slip status word | `.lp-small` 500 | 14px | | Failed `--on-mint-bad` `#a3261c`; Submitted `--on-mint-good` `#3d6b21` |
| Slip line | `.lp-receipt-row` | 14px | | `--on-mint-body` |
| Slip caption | `.lp-small` | 14px | | `--on-mint-body` |
| Lead | `.lp-lead` | 20 / 20 / 18px | | `--on-mint-body` |
| Cell title (h3) | `.lp-title` | 20px 500 | | `--on-mint-ink` |
| Cell body, paragraphs | `.lp-body` | 16px | | `--on-mint-body` |

Weights are 400 and 500 only. Every numeral uses `font-variant-numeric: tabular-nums slashed-zero` (A15) so "0 credits" and "−1 credit" read exactly. Text is left aligned.

### 4.3 Borders and rules

Receipt row rules and cell borders: 1px `--on-mint-muted`. Cells: 0 radius, 1px border, padding 24px (20px below 768). Slips: 1px `--on-mint-muted` border, 0 radius, perforated top, padding 16px 20px.

### 4.4 Kairos Marks used

| Mark | Use here |
| --- | --- |
| M1 graticule | Entry head: "05", then the 11-tick rule; tick index 5 is 8px tall. On Void: rule `--border`, current tick `--foreground`. On mint: rule `--on-mint-muted`, current tick `--on-mint-ink` |
| M2 post | The rule draws when entry 05 posts (6a) |
| M4 citation chip | `cites #07, #11` on the Resume row. On mint: 1px `--on-mint-ink` box, `--on-mint-ink` text (DS 6.11) |
| M6 sample mark | SAMPLE chip on the receipt header and both slips; "SAMPLE" in the receipt header text; the dashed edge is reserved for the ghost in this entry (10.4 X4) |
| M7 perforation | Receipt top and bottom edges, slip top edges, the band's top edge (normal flow only) and bottom edge. Drawn with `--lp-perforation-image` on Void and `--lp-perforation-image-mint` on mint (1px on, 3px off) |
| M8 signed numerals | `−1 credit`, `0 credits`, `0 guessed` |
| M10 lime custody | See 4.6 |

### 4.5 Landing-only extensions introduced by this section

All are scoped inside `.lp` in `landing.css`, use the `lp-` prefix and add no hue.

| Name | Value | Justification |
| --- | --- | --- |
| `--lp-stage-ink`, `--lp-stage-muted`, `--lp-stage-rule`, `--lp-stage-tick` | Void state: `--foreground`, `--label`, `--border`, `--foreground`. Mint state: `--on-mint-ink`, `--on-mint-muted`, `--on-mint-muted`, `--on-mint-ink` | One element (the title group) changes surface mid-scroll; switching four aliases on `[data-title]` flips every colour in the same frame |
| `--lp-ghost-dash` | `6px` on, `4px` off | Matches the WebGL ghost outline (WS 4.5: 1px dashes, 6 on, 4 off) |

### 4.6 The one lime element

Navbar "Start free" owns lime for the whole entry at every width. No `[data-lime-candidate]` exists inside entry 05: the ghost Approve is never a candidate, because it starts on Void and ends on mint, where lime is forbidden (L3), and a lime-to-outlined flip on the same button at p 0.56 would read as a state change. `LimeCustody` therefore hands lime to the navbar as soon as entry 04's Approve leaves the viewport, before p 0. Navbar lime over mint composites to `#3d4341` (N7, 6.89:1 boundary).

---

## 5. WebGL

### 5.1 State ids

The section HTML carries `data-scene="slip-tear"`. `stateFor()` (`stage/poses.ts`) returns `slip-tear` when `ledgerStore.approvedAt` is set and `ghost-path` when it is null, evaluated at the forward crossing of p 0.18.

### 5.2 Entering and leaving

| Transition | Trigger | What happens |
| --- | --- | --- |
| `slip-hold` to `slip-tear` or `ghost-path` | Stage p 0 to 0.10 (90px at 900 tall) | Pose blend into the lane pose: rotation (0, −6, 0) for `slip-tear`, (0, 0, 0) for `ghost-path` |
| Print | p crosses 0.05 forward | `em-print` of `05approved` or `05notApproved` (two rows, about 1,960ms) |
| Tear (`slip-tear`) | p crosses 0.18 forward, once | `ho-tear`: lift `0.04 × viewport height` (36px at 900), curl 1 to 0, 700ms, `--ease-tear`; `ledgerStore.tear()` at the end. T1: straight split, no curl. A running print completes at once when the tear starts |
| Ghost separation (`ghost-path`) | p crosses 0.18 forward, once | `ho-ghost-outline`: dashed outline alpha 0 to 1 and offset (−12, −12) CSS px, 300ms, `--ease-post`. No tear |
| Travel | p 0.25 to 0.50, scrubbed | `ho-slip-travel`: `kt = easeTravel((p − 0.25) / 0.25)`; body (or ghost outline) moves from the lane to `slotRect`, rotation to 0, scale to slot fit, paper length to the slot aspect (WS 5.6). A tear still running at 0.25 completes at once |
| Hand-off | p crosses 0.50 forward | `ho-canvas-dom`: canvas wrapper opacity 1 to 0, 400ms linear (T1 240ms), then `visibility: hidden`; the DOM slot sets `data-shown` in the same frame and fades in over the same duration |
| Leaving to entry 06 | `entry-06-replies` top reaches 70% of the viewport | Canvas fades in (400ms linear) in `slip-reply`, with fresh paper (`filedHeader`, `05filed`) only if `torn` (WS D7) |
| Scrolling back above p 0.50 after the hand-off | | Canvas fades back in over 400ms in the lane pose: fresh paper if torn, the original paper otherwise; no second tear or travel. The DOM receipt or ghost stays in the slot (10.4 X1) |
| Approved at the ghost, then scrolling back above 0.18 | Next forward crossing of 0.18 | The approved sequence runs (prints, tear, travel). The DOM receipt fades out over 400ms at the tear and back in at the 0.50 hand-off, so only one receipt is ever visible (10.4 X8) |

### 5.3 Layering

| Layer | Element | z-index |
| --- | --- | --- |
| Canvas | `.stage-root` (fixed, `pointer-events: none`, `aria-hidden="true"`) | `--lp-z-canvas` (0) |
| Lane | `<aside data-lane>` sticky inner | `--lp-z-content` (1) |
| Stage and flow | `.lp-stage`, `.lp-mint` (`position: relative` or sticky) | `calc(var(--lp-z-content) + 1)` (2), `isolation: isolate`, so the opaque mint covers the lane and its tier-0 receipt list |
| Rail, tape, navbar, dialogs | | 20, 30, 40, 50 |

The stage background is transparent until the mint layer covers it, so the canvas shows through on Void.

### 5.4 Text contrast over the canvas

- The canvas clears to transparent and paper alpha is 0 outside the slip, so every pixel behind the title group is Void: Phosphor White 19.4:1, Moss 70 caption and Sage 60 body meet AA (WS 6.3).
- The title group (columns 1 to 4) stays at least 24px clear of the union of the slip's rectangles for p 0.25 to 0.50 (it ends at x 496 at 1440; the slot starts at 528). Checked at p 0.25, 0.375 and 0.50.
- Ink on the canvas slip is Void on Mint Frost (17.6:1 flat, 9.7:1 on the darkest curl). The canvas is `aria-hidden`; the DOM receipt and lane list are the text of record.
- No glow, bloom, emissive term or lime in the canvas (palette unit test).

---

## 6. Animation choreography

Preset ids are from MS 4. Tokens are from MS 2 (`web/lib/motion/tokens.ts`). Every move ends; nothing loops; no spring or overshoot.

### 6a. Entrance timeline

| Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Entry rule (`en-post-rule`) | `transform: scaleX`, origin left | 0 | 1 | `--dur-post` 600ms | 0 | `--ease-post` | `EntryPoster`: entry 05 top crosses 85% (`data-post="live"`) |
| H2 lines (`kt-line-rise`, 1024+) | `translateY` in padded masks | `--rise-line` 115% | 0 | `--dur-rise` 700ms | `--delay-rise` 80ms, `--stagger-line` 70ms | `--ease-post` | Same post |
| H2 (`kt-title-rise`, below 1024) | `translateY` in one mask | 115% | 0 | 700ms | 80ms | `--ease-post` | Same post |
| Eyebrow, entry number, all body text | none | | | | | | Static (A4) |
| Canvas 05 line (`em-print`) | Canvas texture and paper advance | | | head `--dur-print` 420ms, paper `--dur-paper` 520ms; about 1,960ms for two rows | | `--ease-post` | p crosses 0.05 |
| Canvas tear (`ho-tear`) | Canvas uniforms `liftY`, `uCurl` | 0, 1 | 36px equivalent, 0 | `--dur-tear` 700ms | | `--ease-tear` | p crosses 0.18, approved |
| Ghost outline (`ho-ghost-outline`) | Canvas `uAlpha`, offset | 0, (0,0) | 1, (−12,−12)px | 300ms | | `--ease-post` | p crosses 0.18, not approved |
| Canvas wrapper (`ho-canvas-dom`) | `opacity` | 1 | 0 | `--dur-handoff` 400ms (T1 240ms) | | `--ease-linear` | p crosses 0.50 |
| DOM slot content (`ho-canvas-dom`) | `opacity` | 0 | 1 | 400ms (T1 240ms) | same frame as the canvas | `--ease-linear` | p crosses 0.50 (`data-shown`) |
| Surface flip (`data-band` idle to paper) | colours, button style, receipt hairline | Void set | Mint set | instant (0ms) | | none | p crosses 0.56 (reversible set) |
| Title colour (`data-title` void to mint) | `--lp-stage-*` aliases | Void set | Mint set | instant | | none | p crosses 0.74 (reversible set, while the group is at opacity 0) |
| Stage post group (`sq-stage` 0.90): H2 lines | `translateY` | 115% | 0 | 700ms | 70ms line stagger | `--ease-post` | p crosses 0.90 forward, first time |
| Stage post group: slips A, B (`en-row-print`) | `opacity`, `translateY` | 0, `--dist-row` 6px | 1, 0 | `--dur-row` 240ms | start at 420ms into the group, `--stagger-row` 60ms; ends at 780ms | `--ease-post` | Same group (one GSAP timeline, so the pinned stage never runs more than `MAX_GROUPS` 2: the scrub plus this group) |
| Ghost approve in place (`sq-ghost-approve`): 7 receipt rows | `opacity`, `translateY` | 0, 6px | 1, 0 | 240ms each | 60ms stagger; 600ms total | `--ease-post` | Click on "Approve sample draft" |

Mobile and tablet (`mb-print-tear`, below 1024, full motion). Clock starts when the receipt is 50% in view (`IntersectionObserver`, `threshold: 0.5`):

| Time | Element | Property | From | To | Duration | Easing | `data-band` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 to 600ms | 7 receipt rows (`en-row-print`) | `opacity`, `translateY` | 0, 6px | 1, 0 | 240ms, 60ms stagger | `--ease-post` | `printing` |
| 600 to 1,300ms | Receipt | `translateY` | 0 | −8px (`--dist-receipt-up`) | 700ms | `--ease-tear` | `torn` |
| 600 to 1,300ms | Stub | `translateY`, `opacity` | 0, 1 | 12px (`--dist-stub`), 0 | 700ms | `--ease-tear` | `torn` |
| 1,300 to 1,900ms | Intro mint layer | `transform: translate() scale()` | receipt rectangle | identity (intro full width and height) | `--dur-post` 600ms | `--ease-travel` | `paper` when it completes; the perforation moves from the intro bottom to the intro top in that frame |

Ghost on mobile: no rows and no tear (there is no paper). At 50% in view the intro mint layer grows from the ghost rectangle (600ms, `--ease-travel`); colours flip to the mint set in the first frame, because the layer starts exactly behind the ghost. `data-band` goes `idle` to `paper`.

### 6b. Scroll-linked behaviour

One ScrollTrigger, created by `stage-timeline.ts` (motion chunk, 1024px and wider, effective Full, pinned mode):

| Option | Value |
| --- | --- |
| `id` | `entry-05:stage` |
| `trigger` | `[data-stage="entry-05"]` |
| `start` / `end` | `"top top"` / `"bottom bottom"` (exactly 100vh of travel) |
| `pin` | none. The pin is CSS `position: sticky` (MS 5.5) |
| `scrub` | `true` (no numeric lag, so the slip is exactly on the slot at 0.50) |
| `refreshPriority` | 5 |
| `invalidateOnRefresh` | `true` (slot and stage rectangles are measured) |
| `fastScrollEnd` | `true` |
| `onUpdate` | Writes `sceneInput.stageP = self.progress` and bumps `sceneInput.version` (this replaces a separate scene-driver trigger, 10.4 X6); fires forward-crossing events once |
| `onToggle` | Adds `will-change: transform` to the mint layer and `will-change: opacity` to the slot while active; removes both on leave |

The scrubbed timeline has length 1, so a tween placed at position 0.50 runs at p 0.50.

Progress-to-value mapping at 1440 by 900 (scroll px = p × 900). Mint layer start transform: `translate(dx, dy) scale(sx, sy)` with `dx = slotCx − stageCx`, `dy = slotCy − stageCy`, `sx = slotW / stageW`, `sy = slotH / stageH`. Reference values (slot 384 by 468 at top 248): dx 0, dy 32px, sx 0.2667, sy 0.52. `k = easeTravel(t)`, `t = (p − 0.56) / 0.34`, `easeTravel` = power2.inOut.

| p | Scroll px | Canvas (approved) | Canvas (ghost) | Title group opacity | Mint layer (k, translateY, scaleX, scaleY) | Slot | Slips group opacity | Attributes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.00 | 0 | Lane pose blend starts | Same | 1 | hidden (`opacity: 0`, start transform) | hidden | 0 | `data-band="idle"`, `data-title="void"` |
| 0.05 | 45 | Prints `05approved` | Prints `05notApproved` | 1 | | | | |
| 0.18 | 162 | Tear, 700ms | Ghost separates, 300ms | 1 | | | | |
| 0.25 | 225 | Travel starts (kt 0) | Outline travel starts | 1 | | | | |
| 0.375 | 338 | kt 0.5 | kt 0.5 | 1 | | | | |
| 0.50 | 450 | At slot (kt 1); fade out 400ms | Same | 1 | | `data-shown`, fade in 400ms | | |
| 0.54 | 486 | hidden | hidden | 0.5 | | shown | | |
| 0.56 | 504 | | | 0.25 | k 0, 32px, 0.2667, 0.52; layer `opacity: 1` | | | `data-band="paper"` |
| 0.58 | 522 | | | 0 | k 0.007 | | | |
| 0.65 | 585 | | | 0 | k 0.140, 27.5px, 0.369, 0.587 | | | |
| 0.73 | 657 | | | 0 | k 0.500, 16px, 0.633, 0.760 | | | |
| 0.74 | 666 | | | 0 | k 0.553 | | | `data-title="mint"` |
| 0.81 | 729 | | | 0 | k 0.860, 4.5px, 0.897, 0.933 | | | |
| 0.86 | 774 | | | 0, or ramp to 1 if posted | k 0.972 | | 0, or ramp if posted | |
| 0.90 | 810 | | | 1 | k 1, identity | | 1 | Stage post group (first time) |
| 1.00 | 900 | | | 1 | identity | | 1 | Pin releases |

Rules that make the reverse direction exact:

1. Scrubbed (reversible poses): canvas travel until the hand-off, title group opacity (0.50 to 0.58: 1 to 0; 0.86 to 0.90: 0 to 1), slips group opacity (0.86 to 0.90: 0 to 1), mint layer transform (0.56 to 0.90), the `data-band` set at 0.56 and the `data-title` set at 0.74.
2. Once, forward only (events in `onUpdate`): prints at 0.05, tear or ghost separation at 0.18, `data-shown` at 0.50, the stage post group at 0.90. They are never reversed.
3. Before the stage post group has played, the mint-state title and the slips are held at their start state (lines at 115% in their masks, slips at opacity 0 and 6px down) by `[data-stage-armed]:not([data-posted])`; so the 0.86 to 0.90 ramp reveals nothing on the first pass and the 0.90 group performs the entrance. After it has played (`data-posted` set on the stage), the ramp is a plain fade, so scrolling back and forth never re-runs or snaps the rise.
4. At 0.86 the mint edges are within 2.8% of the stage edges (about 15px at 1440), so the title group (x 112, y 96) and the slips (right edge 1328) are fully on mint whenever they are visible in mint colours. Verified by a Playwright pixel probe (11).
5. On mount mid-range (reload, Activity show, anchor jump), every event whose point is behind the current p applies instantly with no animation, and the poses take their scrubbed values.

`sq-stage-dom` (tier 0 by hardware at 1024 and wider): the same trigger and timeline without canvas work. At 0.05 the receipt (or ghost) is in the slot at `opacity: 0`; at 0.50 it fades in; 0.56 to 0.90 the mint expands; 0.90 the post group. The lane shows the DOM receipt list throughout, under the opaque mint from 0.56.

Fit and arming: on create, `stage-timeline.ts` runs the fit check (3.4), then sets `data-stage-armed`, `data-band="idle"` and `data-title="void"` on `.lp-stage`, and removes `data-surface`. On dispose (route change, Reduced chosen, viewport below 1024) it reverts all four, which restores the server's final state.

### 6c. Micro-interactions

The only interactive element in the entry is the ghost "Approve sample draft" button (48px tall, at least 44px hit area, 8px clear of other targets). The citation chip and SAMPLE chips are labels, not controls.

| State | On Void (p 0.50 to 0.56, preset `mi-default`) | On mint (preset `mi-on-mint`) |
| --- | --- | --- |
| Rest | Ground Iron fill, 1px Phosphor White border, Phosphor White text, radius `--r-pill` (L4) | Transparent fill, 1px `--on-mint-ink` border, `--on-mint-ink` text |
| Hover | Carbon Veil fill, 300ms `--ease-utility` (colour only) | `--on-mint-body` fill, `--receipt-paper` text, 300ms (DS L5; 14.89:1, 10.4 X2) |
| Focus visible (`mi-focus`) | 2px solid `--foreground` outline, 2px offset, instant | 2px solid `--on-mint-ink` outline, 2px offset, instant |
| Press | Colour holds; no scale | Colour holds; no scale |
| Never | Lime, glow, scale, shadow | Same |

Focus reveal: if the button receives focus while the slot is not yet shown (p below 0.50), `ReceiptSlot` dispatches `kairos:reveal-slot` on the slot element. `stage-timeline.ts` listens and runs the 0.50 hand-off immediately (canvas out, slot in, ghost travel completed), without moving the scroll. A keyboard user therefore never focuses an invisible control, and screen reader users keep full access because the slot is hidden by `opacity` only, never by `visibility`, `display` or `inert`.

### 6d. Hand-off to the next section

1. At p 1.00 the pin releases and the stage scrolls up with the page; "How it sends" follows on the same mint with no seam (the stage ends fully mint and the flow begins mint).
2. The band ends with its bottom perforation and a 64px Void spacer (48px below 1024), so entry 06's graticule rule does not sit flush against the perforation.
3. Entry 06 posts with `en-post-rule` when its top crosses 85%.
4. When entry 06's top reaches 70% of the viewport, the canvas fades in (400ms linear) in `slip-reply`. The opaque band is still covering the upper part of the lane, so the slip appears from under the departing paper as the band scrolls off: the paper slides off the printer. Fresh paper shows only if `torn`.
5. Lime stays with the navbar until entry 07's Choose Pro enters.

---

## 7. Reduced-motion, no-JS and low-tier variants

| Variant | Condition | Behaviour |
| --- | --- | --- |
| T2 Full | 1024+, pinned, WebGL tier 2 | Everything in 5 and 6 |
| T1 Lite | Tier 1 | Same stage; tear is a straight split with no curl; hand-off cross-fade 240ms; 30fps cap |
| T0 by hardware, 1024+ | No WebGL2, context lost twice, sampler demotion | Pin kept (the tier is known only after idle). `sq-stage-dom` (6b). Lane shows the DOM receipt list |
| Desktop, viewport under 640px tall | Width 1024+, height below 640, Full | Normal flow, desktop columns (title 1 to 8 on Void; band: receipt 1 to 4, slips 5 to 8, flow below). `mb-print-tear` runs time-based. The canvas runs `ex-canvas-out` when entry 05's top reaches 70% and `en-canvas-return` at entry 06; the canvas never tears here, but `ReceiptSlot` calls `ledgerStore.tear()` after the DOM tear when approved, so entry 06 shows fresh paper truthfully |
| Below 1024, Full | Phones and tablets | `mb-print-tear` (6a). No canvas |
| Reduced | OS setting without a "Full" override, or "Reduced" chosen | No pin, no canvas, no timers. Normal flow in the final `paper` state from first paint: Void title, band with the perforated top edge, receipt (or ghost) printed, stub absent, slips present. In-place approval swaps the ghost for the receipt instantly; the live region still announces. Durations are zeroed by the token rule |
| No JavaScript | No `data-motion` attribute | Same as Reduced. The server renders the ghost (the server cannot know an approval). Its Approve button is inert without JavaScript, exactly like entry 04's; the sentence `sendLead` still lists what a receipt holds |
| Motion chunk failed, pinned | GSAP did not load | The server markup is the final state (no `data-stage-armed`): the 100vh sticky stage is fully mint with the H2 on mint, the receipt or ghost and both slips, so the visitor scrolls 100vh over a complete, still paper stage |
| Forced colours | `forced-colors: active` | Canvas hidden (T0). Perforations, dashes and the mint layer are backgrounds and disappear; the receipt and slips keep `border: 1px solid CanvasText` via a forced-colours rule; the ghost uses `border: 1px dashed CanvasText` |
| Fit check failed | 3.4 | Normal flow with `mb-print-tear` |

Store writes by variant: wherever the Stage is not mounted (T0, below 1024, Reduced, short desktop), `ReceiptSlot` calls `ledgerStore.print("05approved")` or `print("05notApproved")` once, when the receipt first becomes 50% visible, and `ledgerStore.tear()` after a DOM tear when approved. All calls are idempotent.

---

## 8. Accessibility

- **Landmark and headings.** `<section aria-labelledby="entry-05-title">` is a named region. One H2 (`#entry-05-title`, `tabindex="-1"` for the anchor handler), the same element in both colour states. H3s: the ghost title, "Chrome extension · every plan", "Cloud applier · Pro and Max".
- **DOM order equals reading order** at every width: entry number, eyebrow, H2, slot (receipt table or ghost), slip A, slip B, lead, cell 1, cell 2, review mode, required fields, boards.
- **Receipt.** A real `<table>`: the header line is a `<p>` above it inside the paper; `<caption>` holds `receiptCaption` (CSS `caption-side: bottom`); each row is `<tr><th scope="row">Form</th><td>…</td></tr>`. The citation chip's accessible text is its visible text.
- **Ghost and reserved receipt.** The slot stacks the ghost and the receipt in one grid cell so it always has the receipt's size. The inactive one has `hidden` semantics through `inert` plus `visibility: hidden` (it is not presented at all), and the active one is the only one in the accessibility tree. Before the hand-off, the active one is at `opacity: 0` but fully readable by assistive technology.
- **Slips.** Each is a `<figure>` whose `<figcaption>` is the slip caption; the status word is text, never colour alone.
- **Focus order.** The ghost Approve is the only tab stop in the entry. After it is pressed, focus moves to the receipt `<table tabindex="-1">` with `focus({ preventScroll: true })`, and `rowPrintedLive` ("Approved. Sample receipt printed.") is announced by a visually hidden `<p role="status" aria-live="polite">` 300ms after the click. In the approved state the entry has no tab stops.
- **Focus is never obscured or invisible.** Focus reveal (6c). The navbar (64px) and tape (48px) never cover the button: on the pinned stage the slot is centred below the navbar; in normal flow `scroll-padding-top` (80px desktop, 112px below 1024) applies.
- **Aria for visuals.** Canvas `aria-hidden="true"`; mint layers, perforations, the graticule ticks and the Void spacer `aria-hidden="true"`. Stage motion is never announced.
- **Motion.** The longest automatic sequence here is 1.9s (mobile) or 0.78s (stage post group), within the page's 3.9s maximum (MS 12); the footer Motion control applies.
- **Contrast of every pairing in this entry.**

| Text or object | Background | Ratio | Needs |
| --- | --- | --- | --- |
| H2, ghost title (Phosphor White) | Void | 19.4:1 | 4.5 |
| Ghost body (Sage 60) | Void | 8.3:1 | 4.5 |
| Number and eyebrow (Moss 70 `#9cbf93`) | Void | 10.29:1 (DS V3) | 4.5 |
| Ghost dashed edge (Fern Link) | Void | 6.9:1 | 3 (non-text) |
| H2, header, chips, cell titles (`--on-mint-ink`) | Mint | 17.61:1 | 4.5 |
| Rows, body, captions in body style (`--on-mint-body`) | Mint | 14.89:1 | 4.5 |
| Labels, receipt caption, rules, hairline, dashes (`--on-mint-muted`) | Mint | 6.77:1 | 4.5 |
| "Submitted" (`--on-mint-good`) | Mint | 5.30:1 | 4.5 |
| "Failed" (`--on-mint-bad`) | Mint | 6.18:1 | 4.5 |
| Button hover text (`--receipt-paper` on `--on-mint-body`) | | 14.89:1 | 4.5 |
| Band edge (Mint against Void) | | 17.6:1 | 3 |
| Navbar links (Moss 80) over the band | `#3d4341` composite | 6.04:1 | 4.5 |
| Navbar lime CTA boundary over the band | `#3d4341` | 6.89:1 | 3 |
| Rail numbers over the band (Moss 80, with the backing in 10.4 X3) | `#3d4341` composite | 6.04:1 | 4.5 |

---

## 9. Performance notes

| Topic | Rule |
| --- | --- |
| Animated properties | `transform` (mint layers, H2 lines, slips, mobile receipt and stub) and `opacity` (title group, slot, slips group, canvas wrapper). Colour flips are attribute swaps with no transition. Nothing animates layout, `width`, `height`, `top`, `filter` or `box-shadow` |
| will-change | Mint layer (`transform`) and slot (`opacity`) only, and only while `entry-05:stage` is active: 2 of the page's `MAX_WILL_CHANGE` 4 |
| Mint layer | One empty `div` with a solid background. Non-uniform scale of a solid colour has no raster cost. One full-viewport compositor layer while active (about 5.2MB of GPU memory at 1440 by 900 and DPR 1, 20.7MB at DPR 2), released on leave |
| Containment | `.lp-stage { contain: layout paint; overflow: clip; }` in pinned mode |
| Script per frame | `onUpdate` does three comparisons and two writes; under 0.2ms. No React render on scroll: `ReceiptSlot` renders only on store changes (approval) |
| Measurement | `slotRect` and stage size are read on ScrollTrigger refresh only (fonts ready, resize, the `<main>` ResizeObserver), never per frame |
| Element count | About 110 elements in the section (receipt table 7 rows, two slips, ghost, flow); 2 mint layer elements (one is `display: none` per mode) |
| Assets | None. No images, video, SVG files or new fonts. 0KB of media |
| JavaScript | `ReceiptSlot` island at most 2.5KB gzip inside the 20KB islands budget; `stage-timeline.ts` at most 3KB gzip inside the 60KB motion chunk. No new dependency |
| Frame budget | The stage scroll sustains 60fps at T2 with the canvas travel (WS frame budgets) and needs no canvas work after p 0.50 (the canvas is hidden and stops rendering) |
| CLS | 0 in every mode except the fit-check fallback (3.4), which only occurs when content cannot fit a pinned frame |

---

## 10. Implementation

### 10.1 Files

| Path | Kind | Responsibility |
| --- | --- | --- |
| `web/components/landing/entries/entry-05-send-receipt.tsx` | Server | Section markup (3.1), title group, slips, flow, G3 string selection. Exports `Entry05SendReceipt()` with no props |
| `web/components/landing/islands/receipt-slot.tsx` | Client | `ReceiptSlot()`: ghost or receipt from `useLedger((s) => s.approvedAt)`; in-place approve; focus reveal; live region; `mb-print-tear` driver below 1024 and in the short-desktop variant; store writes in 7 |
| `web/components/landing/marks/receipt-paper.tsx` | Server | `ReceiptPaper` shell reused for the receipt and the slips: props `variant: "receipt" \| "slip"`, `stub?: boolean`, `tornEdge?: boolean`, `children` |
| `web/components/landing/marks/entry-rule.tsx` | Server | `EntryRule entry="05"`; colours from `--lp-stage-rule` and `--lp-stage-tick` inside the title group |
| `web/components/landing/marks/chip.tsx` | Server | `CitationChip` (`cites #07, #11`), `SampleChip` |
| `web/components/landing/marks/perforation.tsx` | Server | `Perforation surface="void" \| "mint"` |
| `web/lib/motion/stage-timeline.ts` | Module, motion chunk | `createStageTimeline(root: HTMLElement): () => void` (6b): trigger `entry-05:stage`, scrubbed timeline, events, arming, fit check, `kairos:reveal-slot` listener, `sq-stage-dom` when `envStore` tier is 0 |
| `web/components/landing/landing.css` | CSS | Modes (3.2), grid areas per breakpoint, `--lp-stage-*` aliases, ghost dashes, `[data-band]` and `[data-title]` rules, forced-colours rules |
| `web/components/landing/motion.css` | CSS | `en-row-print`, `mb-print-tear` transitions keyed on `[data-band]` |
| `web/content/landing-copy.ts` | Module | Strings in 2, `{key}Gated` variants, and `export const GATES = { G3: { extension: false, cloudApplier: false, reviewMode: false, receiptContents: false } } as const`. False ships the gated wording (10.4 X10) |

### 10.2 `ReceiptSlot` behaviour

```ts
"use client";
// web/components/landing/islands/receipt-slot.tsx (shape)
export function ReceiptSlot(): React.JSX.Element {
  const approvedAt = useLedger((s) => s.approvedAt);   // null on the server and first client render
  // render: grid cell with <Ghost/> and <Receipt approvedAt={approvedAt ? formatStamp(approvedAt) : copy.sampleWord}/>
  // the inactive child gets inert + visibility:hidden; the active child is the slot's only content
  // onApprove: ledgerStore.approve(new Date().toISOString()); then focus the table (preventScroll), live region after 300ms
  // onFocusCapture: if (!slotEl.hasAttribute("data-shown")) slotEl.dispatchEvent(new CustomEvent("kairos:reveal-slot"))
  // below 1024 or short desktop with Full motion: one IntersectionObserver (threshold 0.5) drives data-band
  //   idle -> printing -> torn -> paper with setTimeout(DUR.row + 5 * STAGGER.row), setTimeout(DUR.tear);
  //   if the receipt is already above the viewport at mount, set "paper" at once (append-only)
}
```

`data-band`, `data-shown`, `data-title`, `data-posted` and `data-stage-armed` are written directly on elements React renders without those attributes, so React never overwrites them. `data-band` lives on `.lp-stage` (pinned) or `[data-band-intro]` (normal flow).

### 10.3 Presets and tokens used

Presets: `en-post-rule`, `kt-line-rise`, `kt-title-rise`, `em-print`, `ho-tear`, `ho-ghost-outline`, `ho-slip-travel`, `ho-canvas-dom`, `ex-stage-title`, `ho-mint-expand`, `en-row-print`, `sq-stage`, `sq-stage-dom`, `sq-ghost-approve`, `mb-print-tear`, `mi-default`, `mi-on-mint`, `mi-focus`.

Tokens: `--background`, `--mint`, `--receipt-paper`, `--foreground`, `--body`, `--label`, `--border`, `--link`, `--on-mint-ink`, `--on-mint-body`, `--on-mint-muted`, `--on-mint-good`, `--on-mint-bad`, `--lp-perforation-image`, `--lp-perforation-image-mint`, `--type-heading-landing`, `--section-pad-landing`, `--lp-navbar-h`, `--lp-head-h`, `--lp-hit`, `--lp-hit-gap`, `--lp-z-*`, `--r-pill`, `--ease-post`, `--ease-tear`, `--ease-travel`, `--ease-linear`, `--ease-utility`, `--dur-row`, `--dur-rise`, `--dur-post`, `--dur-tear`, `--dur-handoff`, `--dur-colour`, `--stagger-row`, `--stagger-line`, `--delay-rise`, `--dist-row`, `--dist-receipt-up`, `--dist-stub`, `--rise-line`, plus the new `--lp-stage-*` and `--lp-ghost-dash` (4.5). TypeScript: `DUR`, `EASE`, `STAGGER`, `DIST`, `PIN_QUERY` from `web/lib/motion/tokens.ts`.

Reused: `ledgerStore`, `useLedger`, `formatStamp`, `envStore`, `sceneInput`, `EntryPoster`, `LimeCustody`, the `Stage`. No shared component from `web/components/shared/` is used; nothing outside the landing changes except the rail note (X3).

### 10.4 Decisions that refine sibling documents

| # | Topic | Decision | Reason |
| --- | --- | --- | --- |
| X1 | Canvas after the hand-off when scrolling back | Follow WS 5.6 (canvas fades back in the lane) over MS 9.6 ("hidden for the rest of entry 05") | WS owns the canvas; the lane and slot do not overlap, so both objects can be shown honestly |
| X2 | `mi-on-mint` hover | DS L5 (`--on-mint-body` fill, `--receipt-paper` text) over MS 7 (6% black fill) | DS owns colour and lists the pairing (M7, 14.89:1) |
| X3 | Rail over the band | `.lp-rail` gets a permanent Carbon Veil 85% backing with 10px blur (32px wide, `--r-pill`) and Moss 80 numbers (Phosphor White active) | Sage 60 rail numbers measure 3.99:1 on the `#3d4341` composite (DS N5) and about 1.1:1 directly on mint |
| X4 | Ghost size | The ghost reserves the full receipt rectangle; the dashed edge belongs to the ghost only; the approved receipt on mint gets the 1px hairline | No layout shift on in-place approval; the mint layer and canvas travel target one rectangle in both states |
| X5 | Mint-state title and slips on reverse | Scrubbed fade 0.86 to 0.90 after first posting, gated by `data-posted` | MS 9.6 defines the forward pass only; this keeps the reverse pass free of dark text on Void and of re-running entrances |
| X6 | ScrollTrigger ownership | One trigger `entry-05:stage` in `stage-timeline.ts`, which also writes `sceneInput.stageP` | AR 4.4 and MS 5.3 each create one; one trigger cannot drift from the other |
| X7 | Line ids | Use AR's `PrintLineId` keys (`05approved`, `05notApproved`, `filedHeader`, `05filed`); WS ids `l05-submitted`, `l05-not-sent`, `fresh-header`, `l05-filed` map one to one | AR owns the store type |
| X8 | One receipt at a time | On a second pass after a ghost approval, the DOM receipt fades out at the tear and back in at the hand-off | Prevents a canvas slip travelling onto a visible DOM copy of itself |
| X9 | `data-stage` attribute | Always qualify: `[data-stage="entry-05"]` and `html[data-stage="live"]` | WS and AR use one name for two things |
| X10 | Gate selection | `GATES` constant in `landing-copy.ts`, default false | No gate mechanism exists in AR; false is the honest default |
| X11 | Fit check | Disarm to normal flow when content cannot fit the pinned frame | Text-only zoom and long localised strings |
| X12 | Short desktop with canvas | Canvas out at entry 05, DOM print-and-tear, `tear()` from the DOM | MS 5.5 leaves 1024+ under 640px tall unspecified for Full motion |

---

## 11. Acceptance criteria

Copy and content

- [ ] Every visible string matches `landingCopy["entry-05-send-receipt"]` and `scene.lines`; a lint finds no U+2014 or U+2013 and no hype word from COPY's lint table in the section.
- [ ] With `GATES.G3.*` false, the lead, both cell titles, review mode and (if C1 is approved) the receipt caption show "(in beta)"; with them true, the plain strings show.
- [ ] The Approved row shows `formatStamp(approvedAt)`, identical to the entry 04 stamp and entry 01 row 03 text, or `sample` when null.
- [ ] Credit text uses U+2212; every numeral renders with `tabular-nums slashed-zero` (computed style check).

Layout

- [ ] At 1440 by 900 and 1280 by 800 pinned: the wrapper is 200vh and the stage 100vh; the slot is columns 5 to 8 (x 528 to 912 at 1440) and vertically centred below the navbar within 1px; the title group ends at least 24px left of the slot.
- [ ] At 1024 by 640 the receipt fits with at least 12px above and below inside the area under the navbar; with 200% text-only zoom the fit check sets `data-stage-fit="false"` and the section is in normal flow.
- [ ] At 768, 640 and 360 there is no horizontal scroll (`scrollWidth === clientWidth`), the receipt is at most 400px wide, and the order is title, receipt, slip A, slip B, lead, cells, paragraphs.
- [ ] The band is full bleed at every width and never uses `100vw`.

Stage motion (Playwright, `NEXT_PUBLIC_E2E=1`, `NEXT_PUBLIC_STAGE_DEBUG=1`)

- [ ] Approved visitor: `__kairosStage.printed()` gains `05approved` after p 0.05; `ledgerStore.torn` is true after p 0.18 plus 700ms; `__kairosStage.state()` is `slip-tear`.
- [ ] Not approved: `05notApproved` printed, `state()` is `ghost-path`, `torn` stays false, and after p 0.50 the slot shows "No receipt yet. Nothing was sent."
- [ ] At p 0.50 the canvas wrapper and slot opacities cross within the same frame; `__kairosStage.bodyRect()` equals the slot rectangle within 1 CSS px at p 0.50.
- [ ] The mint layer transform at p 0.56 maps exactly onto the slot rectangle (within 1px) and is the identity at p 0.90.
- [ ] Pixel probe: whenever the title group or slips are visible in mint colours, the pixels at their four corners are `#def0dd`; whenever the title group is visible in Void colours, its corners are `#000000`.
- [ ] Scrolling 1.00 to 0.40 to 1.00 never re-runs `kt-line-rise` or the slip print (no running tweens on those targets during the second pass), and printed lines and `torn` never revert.
- [ ] Reload at p 0.70: no tween runs during replay; slot shown; mint layer at the scrubbed value.
- [ ] Exactly one ScrollTrigger has an id starting with `entry-05:`; `ScrollTrigger.getAll().length` is unchanged after three route round trips.
- [ ] No more than 2 motion groups run at once in the stage (instrumented count).

Ghost approval

- [ ] Clicking "Approve sample draft" on the ghost sets `approvedAt`, swaps the ghost for the receipt in the same frame without changing the slot's size (bounding box identical), prints 7 rows in 600ms, moves focus to the table without scrolling (`scrollY` unchanged), and announces "Approved. Sample receipt printed." once.
- [ ] After a ghost approval, scrolling back above p 0.18 and forward again runs the tear and travel, and at no frame are both the canvas slip and the DOM receipt visible at full opacity over the slot.
- [ ] Tabbing to the ghost button before p 0.50 reveals the slot without changing `scrollY`; the focused button is visible with a 2px outline.

Lime and contrast

- [ ] At every sampled scroll position in entry 05 (p 0 to 1 in 0.05 steps, plus the flow), exactly one element has a lime computed background, and it is the navbar "Start free".
- [ ] axe-core reports no contrast violations in entry 05 at p 0.30, 0.55 and 1.00 and in normal flow; the rail numbers over the band compute to Moss 80 on the backing.
- [ ] No text in the section has a `text-shadow`, glow or weight other than 400 or 500.

Variants

- [ ] `reducedMotion: "reduce"`: no `<canvas>`, no WebGL chunk request, wrapper `height: auto`, receipt or ghost present, stub absent, all text present.
- [ ] JavaScript disabled: the stage is normal flow, the ghost and all flow text are in the HTML, and the page has no horizontal scroll.
- [ ] Motion chunk blocked while pinned: the stage shows the final mint state with the H2 in `--on-mint-ink`.
- [ ] Tier 0 forced (`?stage-tier=0`) at 1440 by 900: pin present, `sq-stage-dom` runs, no canvas exists.
- [ ] Below 1024 with full motion: `data-band` goes `idle`, `printing`, `torn`, `paper` at about 0, 600, 1,300 and 1,900ms after the receipt is 50% visible; the stub ends at opacity 0; the perforation ends at the intro top.
- [ ] `forcedColors: "active"`: receipt and slips keep visible 1px borders; the ghost keeps a dashed border.

Accessibility and performance

- [ ] The section is a region named by its H2; heading levels are h2 then h3 with no skips; the receipt is a `<table>` with a `<caption>` and row headers.
- [ ] The section requests no image, video or font beyond the page's shared fonts; `ReceiptSlot` is at most 2.5KB gzip and `stage-timeline.ts` at most 3KB gzip.
- [ ] A scripted scroll through entry 05 at 1440 by 900 records CLS 0 and no long task over 50ms; `will-change` is absent from the mint layer and slot outside the stage range.
