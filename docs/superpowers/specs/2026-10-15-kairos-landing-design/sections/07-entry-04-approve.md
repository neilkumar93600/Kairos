# 07. Entry 04: Review and approve (the kairos moment)

Section id `entry-04-approve`, tier signature, scroll length about 100vh, WebGL state `slip-hold`. Previous section: `entry-03-truth-lock` (`slip-cite`). Next section: `entry-05-send-receipt` (`slip-tear` when approved, `ghost-path` when not).

Sources: `01-creative-direction.md` (CD) 3.2, 3.3, 3.4, 4.4, 4.5 and the entry 04 brief; `02-design-system.md` (DS) 3, 4, 5.3, 6; `03-motion-system.md` (MS) 1, 3, 5, 6, 9.5, 10; `04-webgl-scene.md` (GL) 3.5 to 3.7, 5.3 to 5.7, 7; `05-architecture.md` (AR) 2, 4.3, 5.4; `06-copy-deck.md` (COPY) section 9, 17, 18, 20.

## 1. Purpose and narrative beat

Purpose: turn the product's central rule, "nothing is sent until you approve it", into something the visitor does rather than reads. The entry shows one sample review row (resume diff, answers, why it matched), lets the visitor edit one sample answer, and offers one action: "Approve sample draft". Pressing it signs the page's sample ledger with the visitor's own local time. Scrolling never approves.

Narrative beat: kairos. Until now the page has moved with the visitor's scroll: rules drew, a slip printed 48 rows, a citation retracted. At entry 04, once the entry has posted, nothing in the viewport moves. The receipt slip stands flat and almost square to the viewer, with pointer tilt switched off and nothing printing. The story waits. The only thing that can move it forward is the visitor's press. That stillness is the design (MS P5). Kairos is the right moment, and here the visitor chooses it.

Signature moment: the press. In the click handler the page reads the visitor's clock once. The slip flattens, prints `04 · Approved by you`, then draws an ink signature box and prints the stamp inside it, for example `10/15/26, 2:02 PM`. The Approve button steps down to a quiet Default button reading "Approved · sample". The lime fill leaves it and, 150ms later, settles on the navbar "Start free". Entry 01 row 03 changes to `settled in 04 · 2:02 PM` with the same time. One press makes one move that ends, with one record of it. If the visitor scrolls past without pressing, the slip prints `04 · Awaiting your approval` once, and the page goes on to say "No receipt yet. Nothing was sent." in entry 05. The page never pretends the visitor approved.

Lime in this entry: `entry-04-approve.approveButton` while it is unapproved and any pixel of it is in the viewport (custody priority 1). After approval, the navbar "Start free".

## 2. Content (final copy from 06-copy-deck.md, verbatim; flag any change you need and why)

All strings are read from `landingCopy["entry-04-approve"]` in `web/content/landing-copy.ts`. Server Components render them; `ApproveSample` receives the strings it needs as props (AR 2, rule 4).

| Key | Text (verbatim) | Rendered as |
| --- | --- | --- |
| `entry-04-approve.number` | 04 | Entry number in the head row (M1) |
| `entry-04-approve.eyebrow` | Review and approve | Caption, uppercase by CSS `text-transform` (DS 3.1). The source string stays sentence case |
| `entry-04-approve.h2` | Edit anything. Then approve one or a batch. | `<h2 id="entry-04-title">` |
| `entry-04-approve.h2Alt` | Nothing is sent until you approve it. | Not rendered. Alternate kept for A/B in the copy module only |
| `entry-04-approve.body` | Each application shows its resume diff, every answer and why it matched. Edit anything, then approve one or a batch. Nothing is sent until you approve it, and you can withdraw a draft or an approved application before it is sent. | One `<p class="lp-body">` |
| `entry-04-approve.panelTitle` | Sample draft · Software Engineer, Platform · Company 014 | `<h3>` inside the sample panel |
| `entry-04-approve.rowDiff` | Resume diff · 4 lines · each cites a fact | Review row 1 |
| `entry-04-approve.rowAnswers` | 7 answers ready · 0 guessed | Review row 2, with the Edit button |
| `entry-04-approve.rowWhy` | Why it matched · 3 reasons, written from the sample profile | Review row 3 |
| `entry-04-approve.editButton` | Edit | Outlined button, `aria-expanded` |
| `entry-04-approve.editLabel` | Earliest start date (sample answer) | `<label>` of the text input |
| `entry-04-approve.editValue` | Two weeks after an offer | Default input value |
| `entry-04-approve.editSave` | Save answer | Default button |
| `entry-04-approve.editSaved` | Answer saved in the sample draft. | Polite status message |
| `entry-04-approve.approveButton` | Approve sample draft | Custody button, 48px, `data-lime-candidate="approve"` |
| `entry-04-approve.approveNote` | Demo. Nothing is sent from this page. | 14px text beside the button, also the button's `aria-describedby` |
| `entry-04-approve.kairosLine` | Kairos is Greek for the right moment. You choose it. | Body size, Moss 70, below the panel |
| `entry-04-approve.approvedButton` | Approved · sample | Button label after the press |
| `entry-04-approve.approvedInline` | Approved by you at {approvedTime}. | Visible stamp under the button |
| `entry-04-approve.approvedLive` | Approved. Sample receipt updated. | Polite status message |
| `entry-04-approve.settles` | Settles 03. Review means edit, then approve. | Settlement line with a posting square |
| `scene.lines.04approved` | 04 · Approved by you · {approvedAt} | Printed on the slip and in the lane list |
| `scene.lines.04awaiting` | 04 · Awaiting your approval | Printed once if the visitor scrolls past without approving |
| `entry-01-reported.cellSettledStamp` | settled in 04 · {approvedTime} | Entry 01 row 03 after approval |
| `shared.sampleChip` | SAMPLE | Chip on the panel, accessible name "Sample data" |
| `shared.postedAria` / `shared.pendingAria` | Posted. / Pending. | Visually hidden text beside the settlement square |

Placeholders: `{approvedAt}` is `formatStamp(iso)` (`Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })`). `{approvedTime}` is the same instant formatted with `{ timeStyle: "short" }` only. The time is read once, in the click handler, as `new Date().toISOString()`, and stored in `ledgerStore.approvedAt`. Rendering only formats it. Nothing reads the clock during render.

Flagged changes (each needs copy-owner or sibling-doc sign-off; the fallback is stated):

| # | Change | Why | Fallback if rejected |
| --- | --- | --- | --- |
| F1 | New key `entry-04-approve.answerPreview` = "Earliest start date · {value}", a line under review row 2 that shows the current sample answer | COPY says "Save answer" updates the row. Without a visible answer line there is nothing on the row to update, so the edit would look like it did nothing | No preview line. The saved value stays in the input when the region is reopened, and the polite message confirms the save |
| F2 | `approvedInline` is rendered inside an M9 signature box, with the status word "Approved" in `--good` and the rest in Phosphor White | Below 1024px there is no canvas and no lane, so the DOM stamp is the signature moment. M9 is the page's mark for a recorded decision. Status colour stays on the status word only | Plain inline `--good` text as in COPY |
| F3 | `{approvedTime}` gets its own formatter `formatStampTime(iso)` in `web/lib/landing/format.ts` | AR 4.3.1 lists only `formatStamp`, which yields date and time. COPY's `{approvedTime}` is the time alone | None needed; this is an addition |
| F4 | The Edit button becomes `aria-disabled="true"` after approval | An approved draft in the product is withdrawn before it is edited. Letting the demo edit an approved draft would show a flow that does not exist | Keep Edit enabled; editing after approval changes the preview but never `approvedAt` |

No user-facing copy is reworded.

## 3. Layout structure: desktop 1440 and 1280, laptop 1024, tablet 768, mobile 360 to 640. Grid columns, placement, sizes and spacing in tokens and px. Include an ASCII wireframe for desktop and one for mobile.

The entry is a `<section class="lp-entry">` inside `[data-story]` (entries 00 to 06 share the receipt lane). Its content sits in `.lp-container > .lp-grid`. Text and the demo use columns 1 to 7 at 1024px and wider. Column 8 is the buffer. Columns 9 to 12 belong to the sticky lane `<aside data-lane>`, which this entry does not render into.

### 3.1 Vertical stack (all widths)

| Order | Element | Gap above, 1024 and wider | Gap above, below 1024 |
| --- | --- | --- | --- |
| 1 | Head row: number `04` and graticule rule, tick 04 tall (`.lp-head`, 32px, `--lp-head-h`) | 0 (the previous entry's `--section-pad-landing` is the gap) | 0 |
| 2 | Eyebrow (`.lp-caption`, uppercase) | 40px | 32px |
| 3 | H2 (`.lp-heading`, `max-width: var(--measure-title)`) | 16px | 12px |
| 4 | Body (`.lp-body`, `max-width: var(--measure-body)`, 544px) | 24px | 20px |
| 5 | Sample panel (`.lp-panel`, dashed) | 48px | 32px |
| 6 | Kairos line (`.lp-body`, Moss 70) | 24px | 20px |
| 7 | Settlement line (`.lp-small`) | 32px | 24px |
| 8 | Bottom padding `--section-pad-landing` | 128px | 96px (768 to 1023), 80px (below 768) |

### 3.2 Inside the sample panel

| Part | Spec |
| --- | --- |
| Panel box | `border: var(--sample-border)` (1px dashed Circuit Border), radius 8px (`--r-card`), fill Ground Iron (`--surface`), padding 32px (20px below 768) |
| SAMPLE chip | Absolutely positioned 16px from the top and right (12px below 768), 24px tall pill |
| Panel title (h3) | `.lp-title` (Inter 500, 20px, line height 1.5), Phosphor White, `padding-right: 88px` so it never runs under the chip. It may wrap: 2 lines at 1024 to 1440, 3 lines at 360 |
| Review list | `<ul>` with 16px top margin. Three `<li>` rows, each `min-height: 48px`, `padding: 12px 0`, a 1px Circuit Border top hairline, and `display: flex; align-items: center; gap: 12px`. Row text `.lp-small` (14px, line height 1.43), Phosphor White, `flex: 1 1 auto` |
| Answer preview (F1) | Under row 2's text inside the same `<li>`: `.lp-small`, Sage 60, 4px top margin |
| Edit button | In row 2, right side, `flex: none`. Outlined (`mi-outlined`), 44px tall (`--lp-hit`), padding 0 16px, radius 12px (`--r-button`), 14px Inter 500 |
| Edit region | Directly under row 2, inside the list item, present only when open. Grid: label (12px gap) input (12px gap) Save button. At 640px and wider, input and Save sit on one row (`grid-template-columns: 1fr auto; column-gap: 12px`). Input is 44px tall, radius 8px, 1px Fern Link border, Ground fill, Phosphor White text, 16px type (no iOS zoom), `maxlength="60"`, `required`. Save is a Default button (`mi-default`), 44px tall, radius 12px |
| Approve bar | `[data-approve-bar]`, 24px top margin, 24px top padding, 1px Circuit Border top hairline. `display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px`. Contents: the Approve `.lp-btn` (48px tall, pill, padding 0 24px, auto width), then the note (`.lp-small`, Sage 60) |
| Stamp slot | `[data-stamp-slot]`, 12px below the approve bar, `min-height: 26px` reserved in server HTML so approval moves nothing below it. Empty before approval. After approval it holds the M9 box: inline-block, 1px Phosphor White border, radius 0, padding 4px 8px, `.lp-caption` type (12px, 500, +0.6px, not uppercase), `tabular-nums slashed-zero` |
| Status region | `<p role="status" class="lp-visually-hidden">` at the panel's end. It carries `editSaved` and `approvedLive` |

### 3.3 Per breakpoint

| Breakpoint | Columns used | Text and panel width | Notable placement |
| --- | --- | --- | --- |
| 1440 | 1 to 7 of 12 (container 1280 centred, 80px outer margin, 32px inner margin, 72px columns, 32px gaps) | 696px. Panel inner width 632px | Approve and the note sit on one line (about 218px plus 16px plus 262px). H2 at 55.7px in 2 lines ("Edit anything. Then approve / one or a batch."). Lane slip 301 by 677px in columns 9 to 12, offset 15px left by the pose. Ledger rail at `right: 24px` shows entry 04 as `aria-current` |
| 1280 | 1 to 7 of 12 (container 1216 content, 72px columns) | 696px. Panel inner 632px | Same as 1440. H2 at 52.2px. Slip 265 by 596px at 1280 by 800. Rail at `right: 8px` |
| 1024 | 1 to 7 of 12 (50.7px columns, 32px gaps) | 547px. Panel inner 483px | The note wraps under the button (`flex-wrap`). H2 at 46.5px in 2 lines. Slip 253 by 570px at 1024 by 768. No rail; the navbar caption reads `04 / 10` |
| 768 | 1 to 8 of 8 (24px margin, 24px gaps) | 720px full width; body capped at 544px. Panel inner 656px | No lane, no canvas. Receipt tape (48px, sticky at top 64px) is above the entry. Approve and the note on one line |
| 640 | 1 to 8 of 8 (16px margin, 20px gaps) | 608px. Panel inner 568px (32px padding at 640 to 767) | As 768 |
| 360 | 1 to 4 of 4 (16px margin, 16px gaps) | 328px. Panel inner 288px (20px padding) | Below 640px the Approve button is `width: 100%` and the note wraps under it. Edit stays at the right of row 2 ("7 answers ready · 0 guessed" is about 190px plus 70px for the button, which fits 288px). H2 at 36px in 3 lines. The edit region stacks input above a full-width Save |

### 3.4 Wireframe, desktop 1440 by 900 (entry posted, before approval)

```
 x=80                                                         x=776  x=880        x=1264+80
 |<----------- columns 1 to 7: 696px ---------------------->|  col 8 |<- lane 9-12: 384px ->|
 04  |----|----|----|----[|]---|----|----|----|----|----|    (rule to container edge, tick 04 tall)
                                                                      +-------------------+
 REVIEW AND APPROVE                                                   | KAIROS · RECEIPT  |
                                                                      | · SAMPLE          |
 Edit anything. Then approve                                          | 00 · Ledger opened|
 one or a batch.                              (55.7px, 2 lines)       | SKIP · 0417 · ... |
                                                                      | 02 · Fit gate ... |
 Each application shows its resume diff, every answer and             | 03 · Resume v3 ...|
 why it matched. Edit anything, then approve one or a batch.          |                   |
 Nothing is sent until you approve it, and you can withdraw...        |   slip-hold:      |
                                                                      |   flat, still,    |
 +- - - - - - - - - - - - - - - - - - - - - - - - - - - - - +          |   no tilt         |
 | Sample draft · Software Engineer, Platform      [SAMPLE] |         |                   |
 | · Company 014                                            |         |   (print head)    |
 |----------------------------------------------------------|         +===================+
 | Resume diff · 4 lines · each cites a fact                |
 |----------------------------------------------------------|
 | 7 answers ready · 0 guessed                      ( Edit )|
 | Earliest start date · Two weeks after an offer           |
 |----------------------------------------------------------|
 | Why it matched · 3 reasons, written from the sample...   |
 |----------------------------------------------------------|
 | (( Approve sample draft ))  Demo. Nothing is sent from   |
 |   ^ the one lime fill         this page.                 |
 | [stamp slot, 26px reserved]                              |
 +- - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
 Kairos is Greek for the right moment. You choose it.        (Moss 70)

 [] Settles 03. Review means edit, then approve.             (square filled on post)
```

After approval the button row reads `( Approved · sample )` at 50% opacity in Default style, and the stamp slot shows `[ Approved by you at 2:02 PM. ]` in a 1px Phosphor White box. In the lane, two new rows have printed: `04 · Approved by you` and the boxed `10/15/26, 2:02 PM`. The navbar "Start free" is now the one lime fill.

### 3.5 Wireframe, mobile 360 by 800 (before approval)

```
 |<-16->|<---------------- 328px ---------------->|<-16->|
 [ navbar 64px: logo            Log in   Start free  menu ]
 [ tape 48px:   03 · Resume v3 · every line cites a ... v ]
  04 |--|--|--|--[|]--|--|--|--|--|--|
  REVIEW AND APPROVE
  Edit anything. Then
  approve one
  or a batch.                          (36px, 3 lines)
  Each application shows its resume diff,
  every answer and why it matched. Edit
  anything, then approve one or a batch.
  Nothing is sent until you approve it, and
  you can withdraw a draft or an approved
  application before it is sent.
  +- - - - - - - - - - - - - - - - - - - - +
  | Sample draft · Software     [SAMPLE]  |
  | Engineer, Platform · Company          |
  | 014                                   |
  |---------------------------------------|
  | Resume diff · 4 lines · each cites a  |
  | fact                                  |
  |---------------------------------------|
  | 7 answers ready · 0 guessed  ( Edit ) |
  | Earliest start date · Two weeks after |
  | an offer                              |
  |---------------------------------------|
  | Why it matched · 3 reasons, written   |
  | from the sample profile               |
  |---------------------------------------|
  | ((      Approve sample draft       )) |
  | Demo. Nothing is sent from this page. |
  | [stamp slot]                          |
  +- - - - - - - - - - - - - - - - - - - - +
  Kairos is Greek for the right moment.
  You choose it.
  [] Settles 03. Review means edit, then
     approve.
```

## 4. Visual design: tokens, type roles, surfaces, borders, motif usage, and which element (if any) is this viewport's one lime element.

| Element | Type role | Colour token | Surface | Border |
| --- | --- | --- | --- | --- |
| Entry number `04` | Caption 12px 500, +0.6px | `--label` (Moss 70) | Void | none |
| Graticule rule | n/a | Rule `#1f2a33` (Phosphor Blue-Black), ticks `--border`, tick 04 `--foreground` 8px tall | Void | n/a |
| Eyebrow | Caption, uppercase | `--label` | Void | none |
| H2 | Heading, Inter Tight 400 `ss01`, `--type-heading-landing` (36 to 56px), line height 1.02, -0.02em, `text-wrap: balance` | `--foreground` | Void | none |
| Body | Body 16px/1.5, -0.022em, `text-wrap: pretty` | `--body` (Sage 60) | Void | none |
| Panel | n/a | n/a | `--surface` (Ground Iron) | `--sample-border`, radius 8px |
| SAMPLE chip (M6) | Caption, uppercase | `--label` | transparent | 1px `--border`, pill |
| Panel title | Title 20px 500 | `--foreground` | Ground | none |
| Review rows | Small 14px 400 | `--foreground`; answer preview `--body` | Ground | 1px `--border` top hairline |
| Edit (outlined) | Small 14px 500 | `--foreground` | transparent, hover `--surface-raised` | 1px `--foreground`, radius 12px |
| Input | 16px 400 | `--foreground` | `--surface` | 1px `--link`, radius 8px |
| Save (Default) | Small 14px 500 | `--foreground` | `--surface`, hover `--surface-raised` | 1px `--foreground`, radius 12px |
| Approve (owner) | `.lp-btn` 16px 500, -0.022em | `--accent-ink` on `--accent`; hover `--accent-hover` | lime fill | 1px `--accent`, pill, 48px |
| Approve (non-owner or approved) | `.lp-btn` | `--foreground` | `--surface` | 1px `--foreground` (DS L4: same size and shape, colour only changes). Approved: `opacity: 0.5` |
| Note | Small 14px | `--body` | Ground | none |
| Stamp (M9) | Caption 12px 500, +0.6px, not uppercase, tabular slashed numerals | "Approved" `--good`, rest `--foreground` | Ground | 1px `--foreground`, radius 0 |
| Kairos line | Body 16px | `--label` (Moss 70) | Void | none |
| Settlement line | Small 14px | `--body`; posting square (M3) 6px, outlined `--border` when pending, filled `--foreground` when posted, 8px before the text | Void | none |

Motif usage: M1 and M2 (head row and post), M3 (settlement square), M6 (the panel), M8 (numerals in "4 lines", "7 answers", "0 guessed", the stamp), M9 (the stamp, in the DOM and on the slip), M10 (lime custody). No M4 citation chip is used here; "each cites a fact" is the row's words, and entry 03 demonstrated the chip. No M5 claim chip and no M7 perforation in this entry.

Rules held:
- Weights are 400 and 500 only.
- Lime is a fill on one button, never text.
- Status colour (`--good`) is used only on the word "Approved".
- No glow, no shadow and no card hover.
- The panel itself is not interactive.

The one lime element: the Approve button while `ledgerStore.approvedAt` is null and any pixel of it is visible. The navbar "Start free" is Default during that time. After approval the navbar "Start free" is the one lime element, because the Approve button leaves candidacy (section 10, R1). The hero CTA, "Choose Pro" and the closing CTA are never visible in the same viewport as this entry at any listed breakpoint.

## 5. WebGL: scene state id(s), how each state is entered and left, DOM over canvas layering, and text contrast over the canvas.

State: `slip-hold`, from GL 5.3:
- Camera at (0, 0, 6), looking at the origin, fov 35.
- Offset (-0.04, 0, 0.2) from the lane fit: 4% of the lane width to the left, 0.2 units nearer.
- Rotation (0, -4, 0), the most frontal resting pose on the page. The slip faces the visitor like a page held out for signature.
- Scale 1.00, `uCurl` 1, `uLevel` 1.00, `uAlpha` 1, `uPaperLen` 2304.
- Pointer tilt off.
- Section attribute: `data-scene="slip-hold"`.

| Transition | Trigger and range | Easing | What changes | Reverse |
| --- | --- | --- | --- | --- |
| `slip-cite` to `slip-hold` (enter) | Entry 04 `u` 0 to 0.25 (about 383px of scroll at 1440 by 900) | `smoothstep(0, 0.25, u)`, then the frame-rate-independent approach `a = 1 - 0.88^(dt × 60)` | Offset x 0 to -0.04, z 0 to 0.2; rotation (2, -10, 0) to (0, -4, 0); scale 0.96 to 1.00. The tilt target becomes 0 as soon as entry 04's `u` exceeds 0, so any residual `slip-cite` tilt settles critically damped (about 1.1s) while the visitor is still scrolling | Scrubs back to `slip-cite` |
| Inside `slip-hold`, rest | `u` 0.25 to 1 | none | Nothing. The pose is constant and the stage renders zero frames once every component is within 1e-4 of its target (GL 7.1) | n/a |
| Approve press | Click (store appends `04approved`) | Flatten `f` 1 to 0 over 120ms, `--ease-post`; prints per GL 3.5 | `em-stamp`, see 6(a.2) | Never reverses (append-only) |
| Scrolled past unapproved | Store appends `04awaiting` (section 10, R2) | `em-print`, one row: 120ms flatten, 520ms paper, 200ms hold, 600ms return (1,440ms) | Prints `04 · Awaiting your approval` | Never un-prints |
| `slip-hold` to `slip-tear` or `ghost-path` (leave) | Entry 05 stage `p` 0 to 0.10 (90px at 1440 by 900) | Same smoothstep and approach | Lane pose (0, -6, 0) for `slip-tear`, (0, 0, 0) for `ghost-path`; scale 1.00 | Scrubs back to `slip-hold` |

Prints in this state:
- `l04-approved` is two rows. Row 1 is a full line, `04 · Approved by you`. Row 2 is the stamp row (GL 3.5 row type "Stamp row"): 108 texels tall, Inter 400 48px at T2, with the time `{approvedAt}` inset 24 texels. A 4-texel Void ink rectangle runs from row top + 12 to row top + 96. On paper the signature box is ink, because Phosphor White would vanish on Mint Frost (GL 3.6).
- `l04-awaiting` is one full row.
- Both are drawn from `getReceiptLines()` in `receipt-lines.ts`. The lane's `<ol id="receipt-lines">` renders the same entries, so the canvas and the accessible list never differ.
- If `04awaiting` printed first and the visitor approves later (from the entry 05 ghost receipt or by scrolling back), the slip shows both lines, because paper does not un-print. The DOM list shows the approved line in place of the awaiting line (AR 4.3.1).
- If the canvas is torn (`torn = true`) when the visitor scrolls back into entry 04, the lane shows the fresh paper (header and `05 · Receipt filed`) in the `slip-hold` pose. Any stamp still owed prints onto the fresh paper.

Layering (GL 6.1):
- The stage is `.stage-root`, `position: fixed`, z 0, `pointer-events: none`, `aria-hidden="true"`.
- Entry content is z 1 with a transparent background.
- The sample panel is opaque Ground Iron. The rail is z 40, the navbar z 50, dialogs in the top layer.
- At T1 and T2 the lane's DOM receipt list is visually hidden once `html[data-stage-ready="true"]` is set; it is still read by assistive technology.

Text contrast over the canvas:
- No text sits over the slip. Text and the panel stay in columns 1 to 7, and the slip stays in columns 9 to 12. At 1440 by 900 the slip is about 311px wide in this pose (z 0.2 enlarges the 301px lane fit by about 3%), and the -0.04 offset moves it 15px left. Its left edge therefore stays about 21px inside the lane ((384 - 311) / 2 - 15), and about 157px from the nearest text: two 32px gutters and column 8 (72px), plus those 21px.
- Everything outside the slip is transparent canvas over Void. Entry text keeps its brief contrast: Phosphor White 19.4:1, Moss 70 about 10.3:1, Sage 60 8.3:1.
- Ink on flat paper in `slip-hold` is Void on `#def0dd`, 17.6:1. The pose's lambert term clamps to 1, so blank paper equals `#def0dd` within 1 per channel (GL test 9).
- There is no lime anywhere in the canvas palette.

## 6. Animation choreography: (a) entrance timeline table with columns element, property, from, to, duration, delay or stagger, easing token, trigger; (b) scroll-linked behaviour: ScrollTrigger start and end, pin, scrub, and a progress-to-value mapping table; (c) micro-interactions: hover, focus, press; (d) hand-off to the next section. Reference preset ids from 03-motion-system.md.

### (a) Entrance timeline

a.1 The post. It fires when the entry's top crosses 85% of the viewport height (`EntryPoster`; the same line as `ENTRY_START`). It is one motion group.

| Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger | Preset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Entry number `04` | none | present | present | 0 | 0 | n/a | n/a | none |
| Graticule rule | `transform: scaleX()`, origin left | 0 | 1 | 600ms `--dur-post` | 0 | `--ease-post` | Entry post | `en-post-rule` |
| Ticks 00 to 10 | `visibility` (step) | hidden | visible | step | `calc(var(--i) * 60ms)`, i = 0 to 10 | n/a | Entry post | `en-post-rule` |
| H2 lines (1024 and wider) | `transform: translateY()` inside padded masks | 115% (`--rise-line`) | 0 | 700ms `--dur-rise` | 80ms `--delay-rise`, then 70ms `--stagger-line` (2 lines: 80 to 850ms) | `--ease-post` | ScrollTrigger `entry-04:title`, `once: true` | `kt-line-rise` |
| H2 whole (below 1024) | `transform: translateY()` in one mask | 115% | 0 | 700ms | 80ms | `--ease-post` | `data-post="live"` | `kt-title-rise` |
| Eyebrow, body, panel, kairos line, settlement text | none | present | present | 0 | 0 | n/a | n/a | none (MS 2.3 rule 3) |
| Settlement posting square | `background-color` | transparent | `--foreground` | 300ms `--dur-colour` | 0 | `--ease-utility` | Entry post | `en-post-square` |
| Entry 01 row 03 cell | text | `open · see 04` | `settled in 04` | 120ms cross-fade if in view, else instant | 0 | `--ease-linear` | Same frame as `ledgerStore.post("04")` | `kt-cell-swap` |
| Rail entry 04 / navbar caption | `color`, text | previous | `aria-current` styling / `04 / 10` | 300ms colour | 0 | `--ease-utility` | Active entry change | `mi-nav-link` |

After 920ms at most, nothing in the viewport moves until the visitor acts (MS P5, QA Q27).

a.2 The approval, `sq-approve`. The trigger is the visitor's click, Enter or Space on Approve; t = 0 is the click handler.

| Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger | Preset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Store | `approvedAt`, `printed` | null | ISO time; `04approved` appended | 0 | 0 | n/a | Click handler | n/a |
| Approve button label | text | Approve sample draft | Approved · sample | 0 (no motion) | 0 | n/a | Store change | none |
| Approve button | `background-color`, `border-color`, `color` | lime owner | Default fallback | 150ms `--lp-dur-custody` (`--dur-lime-step`) | 0 | `--ease-utility` | `html[data-lime-owner]` approve to navbar | `ho-lime` (out) |
| Approve button | `opacity` | 1 | 0.5 | 300ms `--dur-colour` | 0 | `--ease-utility` | `data-approve-state="approved"` | none (state change) |
| Navbar "Start free" | `background-color`, `border-color`, `color` | Default | lime | 150ms | 150ms | `--ease-utility` | Same owner change | `ho-lime` (in) |
| Slip | flatten factor `f` (rotation (0, -4, 0) times `f`) | 1 | 0 | 120ms | 0 | `--ease-post` | Stage sees `04approved` | `ho-pose` override |
| Slip row 1 `04 · Approved by you` | `uFeed` +108 texels; `uPrintY` to row end | current | +1 row | paper 520ms `--dur-paper`; ink edge 420ms `--dur-print` | 120ms | `--ease-post` | Same | `em-stamp` |
| Slip row 2 (signature box and time) | `uFeed`, `uPrintY` | +1 row | +2 rows | 520ms / 420ms | 640ms | `--ease-post` | Same | `em-stamp` |
| Slip | hold, then `f` | 0 | 1 | hold 200ms, return 600ms `--dur-post` | 1,160ms (hold), 1,360ms (return) | `--ease-post` | Same | `ho-pose` |
| DOM stamp (1024 and wider) | none | empty slot | M9 box with text | 0 | 0 | n/a | Store change | none (the slip is the one move) |
| DOM stamp (below 1024) | `opacity`, `transform: translateY()` | 0, 6px | 1, 0 | 240ms `--dur-row` | 0 | `--ease-post` | Store change | `en-row-print` |
| Lane list (tier 0, 1024 and wider) | new `<li>` `opacity`, `translateY` | 0, 6px | 1, 0 | 240ms | 0 | `--ease-post` | Store change | `en-row-print` |
| Receipt tape (below 1024) | old line `translateY` 0 to -100%; new line 100% to 0 | `03 · …` | `04 · Approved by you · {approvedAt}` | 600ms `--dur-post` | 0 | `--ease-post` | Store change | `kt-tape-line` |
| Entry 01 row 03 | text | `settled in 04` | `settled in 04 · {approvedTime}` | instant (off screen) | 0 | n/a | Store change | `kt-cell-swap` rule |
| Status region | text | empty | Approved. Sample receipt updated. | 0 | 0 | n/a | Click handler | none |

The canvas sequence ends at 1,960ms (GL 7.2). Motion groups in the viewport are at most 2: `em-stamp`, or `en-row-print` plus `kt-tape-line` below 1024. The `ho-lime` and opacity changes are colour-class changes and are not counted (MS 3.4).

If a print is already running when Approve is pressed (for example a late `l03` after a fast scroll), `em-stamp` waits for that print's current row to finish (at most 520ms), then runs. If more than two prints are queued, the stage replays them without a sweep (GL 3.5).

### (b) Scroll-linked behaviour

| ScrollTrigger id | Trigger | `start` | `end` | Mode | `refreshPriority` | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `entry-04:pose` | `section[data-entry="04"]` | `"top 85%"` | `"bottom 15%"` | `ScrollTrigger.create`, `onUpdate` writes `sceneInput` `u` for entry 04. No tween, no scrub, no `toggleActions` | 4 | Exists only at 1024px and wider with effective Full and tier 1 or 2 |
| `entry-04:title` | Same | `"top 85%"` | none | `once: true`, `onEnter` plays `kt-line-rise` | 4 | 1024px and wider, Full |

Pin: none. The entry scrolls in normal flow (the page's only pin is entry 05). Scrub: none; nothing in this entry is a scrubbed tween, and the scene smooths `u` itself with `POSE_LAMBDA` (7.7 per second). Snap: none. Lenis smooths wheel input as everywhere else (lerp 0.09). The Edit region's height change is picked up by the single `ResizeObserver` on `<main>`, which calls `ScrollTrigger.refresh()` debounced 200ms (MS 5.3 rule 9). This component never calls refresh itself.

Progress-to-value mapping (`s = smoothstep(0, 0.25, u)`; values are the blend target before the per-frame approach):

| `u` | `s` | Offset x (lane widths) | Offset z | Rotation x, y, z (deg) | Scale | Tilt | Prints |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.00 | 0.00 | 0.000 | 0.00 | 2.0, -10.0, 0 | 0.960 | target 0 from here | none |
| 0.0625 | 0.156 | -0.006 | 0.03 | 1.7, -9.1, 0 | 0.966 | 0 | none |
| 0.125 | 0.500 | -0.020 | 0.10 | 1.0, -7.0, 0 | 0.980 | 0 | none |
| 0.1875 | 0.844 | -0.034 | 0.17 | 0.3, -4.9, 0 | 0.994 | 0 | none |
| 0.25 to 1.00 | 1.00 | -0.040 | 0.20 | 0, -4, 0 | 1.000 | 0 | none on scroll; `04awaiting` only via R2 |

The awaiting print is not a ScrollTrigger threshold here. It comes from the store, written by `ApproveSample` when the approve bar leaves through the top of the viewport unapproved (R2). At 1440 by 900 that moment matches the creative direction's `u` of about 0.85.

### (c) Micro-interactions

| Element | Hover (fine pointer only) | Focus-visible | Press | Disabled or `aria-disabled` |
| --- | --- | --- | --- | --- |
| Approve, owner (`mi-lime`) | Fill `--accent-hover`, 300ms `--ease-utility` | `mi-focus`: 2px `--foreground` outline, 2px offset, instant | Colour holds; no scale or translate (P7); fires `sq-approve` on `click` (pointer, Enter, Space) | n/a |
| Approve, non-owner before approval (only during the 300ms hand-over into custody) | `--surface-raised` fill (never lime, DS L5) | `mi-focus` | Same handler; approval does not depend on custody | n/a |
| Approved button | none (`cursor: default`) | `mi-focus`; focus stays on it after the press | No effect (handler returns early) | `aria-disabled="true"`, opacity 0.5 |
| Edit (`mi-outlined`) | `--surface` fill, 300ms | `mi-focus` | Toggles the region. Opening moves focus to the input. The region's height is not animated | After approval: `aria-disabled="true"`, opacity 0.5 (F4) |
| Input (`mi-control`) | Border Fern Link to Moss 70, 300ms | 2px `--foreground` border plus 2px Moss 70 ring at 35%, instant | Enter submits Save; Escape closes without saving and returns focus to Edit | n/a |
| Save (`mi-default`) | `--surface-raised`, 300ms | `mi-focus` | Valid: store the value, update the preview, close, focus Edit, announce `editSaved`. Empty after trim: `reportValidity()`, focus stays in the input | n/a |
| Settlement line, kairos line, panel | none (not interactive) | n/a | n/a | n/a |

Cursor: native everywhere (`mi-cursor`). `cursor: pointer` on Edit, Save and Approve, and `cursor: default` on `aria-disabled` buttons. Approving with the Edit region open runs Save first. If the answer is empty, approval does not happen and the input reports its required state. A required answer is never empty when you approve, which mirrors the product rule that the extension never submits with an empty required field (AC11).

### (d) Hand-off to the next section

1. Lime. If the visitor approved, the navbar "Start free" already owns lime. If not, the Approve button owns it until its last pixel leaves the viewport. Then `LimeCustody` hands lime to the navbar (150ms out, 150ms in).
2. Awaiting line. Unapproved visitors get `04 · Awaiting your approval` printed once as the approve bar leaves the top (R2). The slip is still in `slip-hold`, flat for the print, so the line is read on an unrotated surface.
3. Entry 05 post. Entry 05's rule posts when its top crosses 85% (`en-post-rule`), which normally overlaps the bottom of entry 04. That is one group plus at most one canvas print, so the limit of 2 holds.
4. Scene. When entry 05's 200vh wrapper reaches the viewport top (stage `p` = 0), the stage timeline takes over. From `p` 0 to 0.10 the pose blends from `slip-hold` to the `slip-tear` lane pose (0, -6, 0) if `approvedAt` is set, or to `ghost-path` (0, 0, 0) if not. At `p` 0.05 it prints `05 · Submitted · employer form · fields saved` or `05 · Not sent · waiting for your approval`. The choice of path is made at `p` 0.18 from `ledgerStore.approvedAt`. This entry's only obligation is to have written that value, or not.
5. Scrolling back from entry 05 into entry 04 scrubs the pose back to `slip-hold`. Nothing un-prints, and the button keeps its approved or unapproved state.

## 7. Reduced-motion, no-JS and low-tier variants.

| Variant | What the visitor gets |
| --- | --- |
| Full, 1024px and wider, tier 2 | As section 6 |
| Full, tier 1 | As tier 2 at a 30fps frame cap. `uCurl` forced to 0 (flat paper). Print timings unchanged (dt-corrected). No tilt anywhere |
| Full, tier 0 at 1024px and wider (no WebGL or demoted) | No canvas. The lane shows `LaneReceipt`: mint paper, 0px radius, with the `<ol>` of printed lines in `--on-mint-body`, 14px, 32px rhythm. On approve, the `<li>` for `04 · Approved by you · {approvedAt}` appends with `en-row-print` (240ms). Its time is wrapped in the on-mint M9 box (1px `--on-mint-ink`, `--on-mint-ink` text). The DOM stamp in the panel appears without motion. `04awaiting` appends the same way and is replaced in place by the approved line if the visitor approves later |
| Full, below 1024px (phones, tablets) | No canvas, no lane, no GSAP, no Lenis. Title `kt-title-rise`. On approve, the panel stamp prints with `en-row-print` and the 48px tape slides to the new line with `kt-tape-line` (600ms). The tape dialog lists the line |
| Reduced (OS setting without a Full override, or Motion set to Reduced) | No WebGL chunk is downloaded and the lane shows `LaneReceipt` at 1024px and wider. The rule is drawn at first paint, the title is static and the settlement square is filled with its 300ms colour change (kept). On approve the label, stamp, lane `<li>` and tape line change in one frame. The lime swap is instant (`--dur-lime-step` zeroed). The 0.5 opacity uses `--dur-colour` (300ms, kept as a state-colour change). Same words, same final state (P8) |
| No JavaScript | No `html[data-motion]` attribute exists (the head script did not run). Every string is in the server HTML. The panel shows the three rows and the default answer preview. The approve bar shows only the note. One rule in `landing.css`, `html:not([data-motion]) .lp [data-requires-js] { display: none; }`, hides the Edit button, the edit region and the Approve button, because they cannot work without script and a dead button would mislead. The kairos line, settlement line and `open · see 04` cell remain. Lime: only the hero CTA (DS L8) |
| Approved earlier this session, then reload | First render equals the server render. After hydration `useSyncExternalStore` reads `sessionStorage["kairos:landing:ledger:v1"]` and the approved state applies in one frame with no motion. The canvas replays every printed line without a sweep. `LimeCustody` reads `approvedAt` before it first writes the owner, so the Approve button never flashes lime |
| `sessionStorage` unavailable (private mode, blocked) | The approval works for the page view. All reads and writes sit in `try/catch`, and a reload shows the unapproved state |
| Forced colours | The stage is hidden and the lane receipt shows (GL 6.3). The panel's dashed edge, the stamp box and the buttons use system colours. The SAMPLE chip text keeps the meaning |

## 8. Accessibility: landmark and heading level, focus order, aria, screen-reader text for visuals, contrast of any new pairing.

Landmarks and headings:
- The entry is `<section id="entry-04" data-section="entry-04-approve" data-entry="04" data-scene="slip-hold" aria-labelledby="entry-04-title" class="lp-entry">` inside `<main id="main">`.
- The title is `<h2 id="entry-04-title" tabindex="-1" data-split="lines">`, so rail links and anchors move focus to it (MS 5.6).
- The panel is `<div role="group" aria-labelledby="entry-04-panel-title">` with `<h3 id="entry-04-panel-title">`. The SAMPLE chip is `<span aria-label="Sample data">SAMPLE</span>` placed before the title in DOM order, so the group is announced as sample first.
- At 1024px and wider, SplitText runs with `aria: "auto"` so the H2 reads as one sentence (MS 4.2).

Focus order (Tab):
1. Edit
2. When the region is open: the input, then Save
3. Approve
4. The next entry's first control

The head row, eyebrow, body, rows, kairos line and settlement line are not focusable. No `tabindex` greater than 0. The focus ring is never obscured: `scroll-padding-top` is 80px at 1024px and wider and 128px below (navbar plus tape).

ARIA:

| Element | Attributes |
| --- | --- |
| Edit | `<button type="button" aria-expanded="false" aria-controls="entry-04-edit" data-requires-js>`; after approval `aria-disabled="true"` |
| Edit region | `<div id="entry-04-edit" hidden>` when closed (the `hidden` attribute, not CSS), holding `<label for="entry-04-answer">`, `<input id="entry-04-answer" type="text" required maxlength="60" autocomplete="off">` and Save `<button type="button">` |
| Approve | `<button type="button" class="lp-btn" data-lime-candidate="approve" aria-describedby="entry-04-approve-note" data-requires-js>`. After approval: label "Approved · sample", `aria-disabled="true"`, still focusable, focus kept. Custody never changes its name (`shared.limeOwnerAria`) |
| Note | `<p id="entry-04-approve-note">` |
| Status | One `<p role="status">` (polite) per panel, visually hidden, initially empty, set from event handlers only: `editSaved` or `approvedLive` (the latest replaces the earlier) |
| Stamp | Plain text inside `[data-stamp-slot]`, not a live region, so the approval is announced once, by the status region |
| Settlement square | `aria-hidden="true"` on the square, with visually hidden `Pending.` before the post and `Posted.` after it, beside the text |
| Head rule and ticks | `aria-hidden="true"` |
| Canvas | `aria-hidden="true"`; the lane `<aside aria-label="Sample receipt">` list carries the same lines. New prints are appended silently (COPY 17) |

Screen-reader text for visuals: the slip's stamp is in the lane list as `04 · Approved by you · {approvedAt}` and, before that, `04 · Awaiting your approval` if printed. The visual stillness has no text equivalent because it carries no information. The 0.5 opacity is conveyed by `aria-disabled` and by the visible stamp text (DS S5). The dashed edge is backed by the chip and the "Sample draft" title (DS 6.6).

Contrast of the pairings in this entry (WCAG relative luminance; Ground `#181818`, L 0.0091):

| Pairing | Ratio | Requirement | Result |
| --- | --- | --- | --- |
| Phosphor White `#ddffdc` text on Ground (title, rows, stamp text, Default buttons) | 16.4:1 | 4.5:1 | Pass |
| `--good` `#aed2a4` "Approved" on Ground | 11.2:1 | 4.5:1 | Pass (new pairing) |
| Phosphor White stamp box border on Ground | 16.4:1 | 3:1 non-text | Pass (new pairing) |
| Sage 60 `#8cab87` note and answer preview on Ground | 7.0:1 | 4.5:1 | Pass |
| Moss 70 `#9cbf93` SAMPLE chip on Ground | 8.7:1 | 4.5:1 | Pass |
| Moss 70 kairos line on Void | 10.3:1 | 4.5:1 | Pass |
| Sage 60 settlement line on Void | 8.3:1 | 4.5:1 | Pass |
| Void text on Lime `#7fee64` | 14.3:1 | 4.5:1 | Pass |
| Void text on `--accent-hover` `#6ddb57` | 11.9:1 | 4.5:1 | Pass |
| Lime fill against Ground panel (button boundary) | 12.1:1 | 3:1 non-text | Pass |
| Fern Link `#859984` input border on Ground | 5.8:1 | 3:1 non-text | Pass |
| Phosphor White focus outline on Ground or Void | 16.4:1 / 19.4:1 | 3:1 | Pass |
| `--on-mint-ink` stamp on Mint Frost (tier 0 lane list) | 17.6:1 | 4.5:1 | Pass |
| Approved button at 50% opacity | n/a | Exempt (inactive component); state also given in text | Pass by redundancy |

Touch targets: Edit, Save and Approve are at least 44px tall. Approve is 48px, and at least 8px separates hit areas (A16).

## 9. Performance notes: what animates, layer and element counts, asset list with formats and weight budgets.

What animates:
- On post: one `transform` (rule), 11 step `visibility` changes, two masked `transform` lines (GSAP SplitText) or one masked title (CSS), and one `background-color`. All are on the compositor-friendly allowlist (MS 13).
- On approve: `background-color`, `border-color` and `color` on two buttons, and `opacity` on one button.
- On the canvas: the flatten factor, `uFeed` and `uPrintY`, plus one 2D draw and one texture upload per printed row. That is two uploads for the stamp and one for the awaiting line.
- Below 1024px: one `opacity` and `transform` row and the tape's two `transform` lines.
- Nothing animates `height`, `width`, `top`, `left`, `filter` or `box-shadow`.

At rest: zero running animations, zero `requestAnimationFrame` work from this entry, and zero rendered canvas frames once the pose settles (GL 7.1, Q27). `will-change` is never set by this entry. The stage manages its own canvas, and SplitText's line masks get no `will-change` (MS 12.2 cap of 4 is untouched).

Element count: about 45 DOM nodes in the section closed, about 52 with the edit region open. No extra compositor layers beyond the shared fixed stage and navbar.

Interaction cost (INP target 100ms):
- The Approve handler does one `Date` read, one store write (one `sessionStorage.setItem` of under 1KB inside `try/catch`), one status text set and one React state update. Target under 8ms of script on a mid-range phone.
- Canvas work begins on the next `gsap.ticker` frame, not in the handler.
- `LimeCustody` re-evaluates from its cached intersection set (no layout read).

Assets: none. No images, icons, video or new fonts. The entry uses Inter 400 and 500 and Inter Tight 400, which are already preloaded.

| Item | Format | Budget |
| --- | --- | --- |
| `approve-sample.tsx` island | JS, in the islands chunk | 2.5KB gzip or less (counts toward the 20KB islands budget) |
| Entry CSS in `landing.css` and `motion.css` | CSS | 1.2KB gzip or less (counts toward the 25KB CSS budget) |
| Server HTML for the section | HTML | 4KB gzip or less (counts toward the 60KB HTML budget) |
| WebGL | Shared stage chunk | 0KB added; the stamp row type already exists in `print.ts` |

The entry is below the fold at every listed viewport, so it does not affect LCP. CLS is 0: the stamp slot is reserved, the label swap keeps the button size (DS L4 widths are fixed by the longer label: `min-width` set to the measured width of "Approve sample draft", 218px at 16px Inter 500), and the edit region's open and close are user-initiated.

## 10. Implementation: component files and paths, props, server or client, presets and tokens used, existing components reused.

| File | Kind | Responsibility |
| --- | --- | --- |
| `web/components/landing/entries/entry-04-approve.tsx` | Server Component | Renders `Entry` (shell) with number, eyebrow, H2, body, settlement line. Renders `SampleFrame` with the SAMPLE chip and h3, the three rows as server HTML, and `ApproveSample`. Renders the kairos line outside the frame |
| `web/components/landing/entries/entry.tsx` | Server, existing (new in AR) | Head row (`EntryRule`), eyebrow, `<h2 data-split="lines">`, body slot, settlement slot with `PostingSquare` |
| `web/components/landing/marks/sample-frame.tsx` | Server, reused | Dashed panel plus chip |
| `web/components/landing/marks/stamp.tsx` | Shared (no directive; usable from the client island) | M9 box: `<span class="lp-stamp" data-surface?>`; props `{ children: ReactNode; onMint?: boolean }` |
| `web/components/landing/marks/posting-square.tsx` | Server, reused | M3 |
| `web/components/landing/islands/approve-sample.tsx` | Client (`"use client"`) | Row 2's Edit, region, preview; approve bar; stamp slot; status region; R2 observer |
| `web/lib/landing/ledger-store.ts` | Module, existing | `approve(iso)` (first call wins), `print(id)` (idempotent), `useLedger(select)` |
| `web/lib/landing/format.ts` | Module, edit | Add `formatStampTime(iso)` (F3) beside `formatStamp(iso)` |
| `web/components/landing/islands/lime-custody.tsx` | Client, edit | R1 below |
| `web/components/landing/stage/receipt-lines.ts` | Module, existing | `l04-approved` (full row plus stamp row) and `l04-awaiting` |
| `web/components/landing/islands/lane-receipt.tsx` | Client, existing | Renders `04approved` with its time inside `<Stamp onMint>` |
| `web/content/landing-copy.ts` | Module, edit | Add `answerPreview` (F1) if approved |

`ApproveSample` props (strings come from `landingCopy`, never inline):

```ts
type Entry04Copy = (typeof landingCopy)["entry-04-approve"];
interface ApproveSampleProps {
  copy: Pick<Entry04Copy,
    | "rowAnswers" | "editButton" | "editLabel" | "editValue" | "editSave" | "editSaved"
    | "approveButton" | "approveNote" | "approvedButton" | "approvedInline" | "approvedLive"
    | "answerPreview">;   // "answerPreview" only if F1 is approved
}
```

State: `approvedAt` comes from `useLedger(s => s.approvedAt)`. Local React state holds `editOpen`, `answer` (initial `copy.editValue`) and `status`. The answer is not persisted (sample only). Attributes on the island root: `data-approve-state="idle" | "approved"` and `data-edit-open="true" | "false"` (CSS and test hooks).

Approve handler (the only place the clock is read):

```ts
function onApprove() {
  if (ledgerStore.getSnapshot().approvedAt) return;            // first press wins
  if (editOpen && !commitEdit()) return;                       // empty required answer blocks approval
  ledgerStore.approve(new Date().toISOString());
  ledgerStore.print("04approved");
  setStatus(copy.approvedLive);
}
```

Requirements on shared modules (these are additions; each is small):

- **R1, LimeCustody excludes a spent approve candidate.** `LimeCustody` subscribes to `ledgerStore` and drops `approve` from the candidate set while `approvedAt` is non-null. It recomputes the owner from its cached visibility map, sets `data-lime-handover` for 300ms, and writes `html[data-lime-owner]`. On mount it reads `approvedAt` before its first write. Reason: the button stays visible after approval, and an `IntersectionObserver` alone would keep it the owner. AR 5.4 does not cover this case.
- **R2, one owner for `04awaiting`.** `ApproveSample` runs one `IntersectionObserver` on `[data-approve-bar]` with `rootMargin` `-64px 0px 0px 0px` at 1024px and wider and `-112px 0px 0px 0px` below (navbar plus tape), `threshold: 0`. When an entry reports not intersecting with `boundingClientRect.bottom <= rootBounds.top`, `approvedAt` is null, and `04awaiting` is not in `printed`, it calls `ledgerStore.print("04awaiting")`, then disconnects. The first callback on mount covers reloads and anchor jumps past the entry. The stage prints whatever `printed` gains. Reason: it gives the same rule at every tier, width and motion mode, with one writer. This replaces the stage-side `u` 0.85 threshold in CD 4.5, GL 5.3 and MS 9.5. At 1440 by 900 the two fire within about 40px of scroll of each other. Owners of 04 and 03 need to remove the stage's own `u` 0.85 trigger.
- **R3, stamp timing reconciliation.** MS 9.5 times the stamp as one print step (120 to 640ms, total 1,440ms). GL 3.5 and 7.2 define `l04-approved` as a full row plus a stamp row (1,960ms). This spec follows GL, which owns the canvas: rows at 120 and 640ms, hold at 1,160ms, return 1,360 to 1,960ms. MS 9.5 should be updated to match.
- **R4, no-JS hide rule.** Add `html:not([data-motion]) .lp [data-requires-js] { display: none; }` to `landing.css`.

CSS for the approved button (in `landing.css`; extends the `.lp-btn` transition list, never `transition: all`):

```css
.lp [data-approve-state="approved"] .lp-btn[data-lime-candidate="approve"] {
  opacity: 0.5; cursor: default;
  transition: background-color var(--lp-dur-custody) ease-out, border-color var(--lp-dur-custody) ease-out,
              color var(--lp-dur-custody) ease-out, opacity var(--dur-colour) var(--ease-utility);
}
.lp [data-stamp-slot] { min-height: 26px; }
.lp [data-approve-bar] { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.lp [data-approve-bar] .lp-btn { min-width: 218px; }
@media (max-width: 639.98px) { .lp [data-approve-bar] .lp-btn { width: 100%; } }
```

Presets used:
- Entrance and post: `en-post-rule`, `en-post-square`, `kt-line-rise`, `kt-title-rise`, `kt-cell-swap`.
- Approval: `sq-approve`, `em-stamp`, `em-print`, `ho-lime`, `ho-pose`, `en-row-print`, `kt-tape-line`.
- Micro-interactions: `mi-lime`, `mi-default`, `mi-outlined`, `mi-control`, `mi-focus`, `mi-cursor`. `mi-tilt` is explicitly off.

Tokens used:
- Type and layout: `--type-heading-landing`, `--lh-heading-landing`, `--tracking-heading-landing`, `--type-body-landing`, `--type-small-landing`, `--type-caption-landing`, `--type-title-landing`, `--measure-body`, `--measure-title`, `--section-pad-landing`, `--receipt-lane`, `--lp-cols`, `--lp-gap`, `--lp-margin`, `--lp-head-h`, `--lp-hit`, `--lp-hit-gap`.
- Surfaces, radii and colour: `--sample-border`, `--r-card`, `--r-button`, `--r-pill`, `--surface`, `--surface-raised`, `--foreground`, `--body`, `--label`, `--link`, `--border`, `--good`, `--accent`, `--accent-hover`, `--accent-ink`, `--on-mint-ink`.
- Motion: `--lp-dur-custody` (`--dur-lime-step`), `--dur-colour`, `--dur-post`, `--dur-rise`, `--dur-row`, `--dur-print`, `--dur-paper`, `--rise-line`, `--delay-rise`, `--stagger-line`, `--dist-row`, `--ease-post`, `--ease-utility`, `--ease-linear`.

Existing components reused: `Entry`, `EntryRule`, `PostingSquare`, `SampleFrame`, `Stamp`, `LaneReceipt`, `ReceiptTape`, `SettleCell`, `LimeCustody`, `EntryPoster`. No shared app component (`button.tsx`) is used, because custody buttons are `.lp-btn`. No new dependency.

## 11. Acceptance criteria: a testable checklist.

Content and markup
- [ ] Every visible string equals its `landingCopy["entry-04-approve"]` key; the copy lint passes (no U+2014 or U+2013, no hype words, "Company 014" only inside the SAMPLE-chipped frame).
- [ ] The section has `id="entry-04"`, `data-section="entry-04-approve"`, `data-entry="04"`, `data-scene="slip-hold"`, `aria-labelledby="entry-04-title"`; the H2 has `tabindex="-1"`; the panel title is an h3.
- [ ] The kairos line is outside the dashed frame and the panel shows the SAMPLE chip with accessible name "Sample data".

Stillness (signature)
- [ ] Playwright at 1440 by 900, tier 2, Full: with the Approve button centred and 3s without input after the post completes, `document.getAnimations()` in the section is empty and `window.__kairosStage.stats` reports zero rendered frames (Q27).
- [ ] Pointer moves over the lane in `slip-hold` change no slip rotation (tilt off).
- [ ] Scrolling from entry 04 `u` 0.25 to the approve bar leaving the viewport prints nothing and never sets `approvedAt`.

Approval
- [ ] Pressing Approve (click, Enter and Space each tested) sets `ledgerStore.approvedAt` to an ISO string within 1s of the test clock and appends `04approved` exactly once; a second press changes nothing.
- [ ] The button reads "Approved · sample", has `aria-disabled="true"`, computed opacity 0.5, and keeps focus.
- [ ] The stamp slot shows "Approved by you at {formatStampTime(iso)}." inside a 1px box with radius 0; "Approved" computes to `--good`.
- [ ] The lane list (or the canvas texture, via `__kairosStage.printed`) contains `04 · Approved by you · {formatStamp(iso)}`, and the same string appears in entry 01 row 03 (time part), entry 05 and entry 10.
- [ ] The status region announces "Approved. Sample receipt updated." once (axe and a screen-reader smoke test).
- [ ] With a 3s-long `l03` print forced via `?stage-slow`, the stamp waits and then prints; total sequence after the press is no longer than 2,480ms.

Lime custody
- [ ] Before approval, with any pixel of Approve visible, exactly one element computes `background-color` `rgb(127, 238, 100)` or `rgb(109, 219, 87)` and it is Approve; the navbar "Start free" is Default.
- [ ] After approval, within 400ms, exactly one lime element exists and it is the navbar "Start free"; no frame during the hand-over shows two (sampled every animation frame).
- [ ] Reloading after approval never paints Approve lime (frame capture from hydration).

Not approved
- [ ] Scrolling the approve bar above the navbar without approving appends `04awaiting` exactly once (verified at 1440 by 900, 1024 by 768, 390 by 844, tier 0 and Reduced); scrolling back and forth does not repeat it.
- [ ] Jumping by anchor from entry 00 to entry 07 appends `04awaiting` and does not set `approvedAt`.
- [ ] Entry 05 then takes the `ghost-path` branch.

Edit
- [ ] Edit toggles `aria-expanded`; opening focuses the input; Escape closes and returns focus to Edit.
- [ ] Saving "Three weeks after an offer" updates the preview line, closes the region, focuses Edit and announces "Answer saved in the sample draft."; nothing prints on the slip and `printed` is unchanged.
- [ ] Saving or approving with an empty answer keeps the region open, focuses the input and leaves `approvedAt` null.
- [ ] After approval, Edit has `aria-disabled="true"` and does not open.

Layout
- [ ] At 1440, 1280, 1024, 768, 640, 390 and 360 px widths there is no horizontal scroll, no text overlaps the slip's rectangle (lane separation check), and the H2 breaks as COPY 19 lists.
- [ ] Approving changes no element's position below the stamp slot (layout shift score 0 in a trace).
- [ ] All interactive targets are at least 44 by 44px with at least 8px between hit areas.

Variants
- [ ] Reduced: no WebGL request is made; approval applies in one frame with identical final text; the lime swap has 0ms duration.
- [ ] No JavaScript: Edit, the edit region and Approve are not rendered visibly; every other string is present; only the hero CTA is lime on the page.
- [ ] Tier 0 at 1440: the lane list appends the approved line with its time in the on-mint stamp box.
- [ ] Below 1024: the tape shows `04 · Approved by you · {approvedAt}` after approval, with `kt-tape-line`.

Accessibility and performance
- [ ] axe reports zero violations for the section in idle, edit-open and approved states.
- [ ] Measured contrast matches the table in section 8 (automated check on computed colours).
- [ ] INP for the Approve press is 100ms or less on a 4x CPU-throttled Moto G Power profile.
- [ ] The `approve-sample.tsx` island adds no more than 2.5KB gzip (byte-count Playwright test), and no new network request occurs on approval.
