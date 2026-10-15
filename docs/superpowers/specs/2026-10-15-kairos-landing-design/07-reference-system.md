# 07. Reference system: components, placement, imagery and motion

Status: **drafted, for owner review.** Date: 2026-10-15.

The owner shared four reference designs and asked that the Kairos landing follow them in **structure** (which components, where they sit, section order, spacing) and in **look** (light, warm, painted landscapes, grain gradients). This document turns the four teardowns into one layout system for Kairos. It replaces the dark "phosphor" look in [02-design-system.md](./02-design-system.md) for the landing only. The honesty rules, the copy in [06-copy-deck.md](./06-copy-deck.md) and the Ledger story beats in [01-creative-direction.md](./01-creative-direction.md) still apply.

Sources (read these for the raw measurements):

| Reference | Teardown | What the owner is responding to |
| --- | --- | --- |
| Liftoff (`images/3.png`) | [_references/liftoff.md](./_references/liftoff.md) | Page skeleton, serif and sans pairing, zig-zag steps joined by a drawn connector line, dark grain CTA card, two-column FAQ, serif closing over a glow |
| Nivara (`images/4.png`) | [_references/nivara.md](./_references/nivara.md) | Painted full-bleed hero and closing art, problem trio, bordered feature card with art, white mock-up and a floating stat card |
| AGNCE (`images/5.png`) | [_references/agnce.md](./_references/agnce.md) | Centred hero stack (pill, two-line H1, subline, one pill CTA) over a painted landscape in the lower 60 percent |
| Ironclad Labs (`images/2.png`) | [_references/ironclad-footer.md](./_references/ironclad-footer.md) | Light footer with a brand block, link columns, hairline, legal row and grainy painted hills in its lower half |

All sizes are CSS px at a 1440 px wide desktop unless a breakpoint is named. Breakpoints in this document: **1440** (desktop), **1024** (small laptop, landscape tablet), **768** (portrait tablet), **390** (phone). Values between breakpoints interpolate with `clamp()`.

---

## 0. The pattern in one paragraph

All four references share the same layout logic: **a quiet, single-axis page on warm off-white paper, where all richness lives in colour fields and painted art, and every section is a tight stack (pill, heading, subline, one action) separated by very large empty bands.** Art is full bleed and soft-edged at the top and bottom of the page (hero and closing), and hard-clipped inside rounded cards in the middle. Product is shown as small cropped UI cards floating on art, never as full screenshots. One dark button style carries every action. The type is a sans for explaining, with a serif reserved for the two or three emotional lines (Liftoff). The page begins in a painted landscape and ends in one.

For Kairos the system adds one idea of its own: **the page is one day.** The hero painting is a valley at dawn, the closing glow and footer hills are the same valley at dusk. "Kairos" is the right moment; the visitor scrolls through the day toward it. This gives the two paintings a reason to differ and a reason to be the same place.

---

## 1. Page map: archetypes in order

| # | Archetype (section 2) | Kairos content (from 01 and 06) | Source reference | Loud or quiet |
| --- | --- | --- | --- | --- |
| 0 | Nav | Logo, 3 anchor links, Log in, one primary button | AGNCE, Liftoff | Quiet |
| 1 | **A1 Centred art hero** | Entry 00: status pill, two-line serif H1, two-line subline, primary plus secondary action, dawn valley painting, two floating sample cards | AGNCE, Nivara, Liftoff hero cards | Loud |
| 2 | **A2 Commitment strip** (replaces the logo strip) | Three or four verifiable rules: fit threshold, confirmed facts only, nothing sent without approval, charged only for submissions that went through | Nivara and Liftoff logo slots, filled honestly | Quiet |
| 3 | **A3 Problem trio** | Entry 01: three reported complaints as numbered cards; the open-row sentence (row 04) as one line under the trio | Nivara problem section | Quiet |
| 4 | **A4 Section intro** then **A5 Zig-zag steps with connector** | "How Kairos works": step 1 fit gate (entry 02), step 2 truth lock (entry 03) | Liftoff "How it works" | Loud (colour panels) |
| 5 | **A6 Spotlight with floating cards** | Entry 04, the kairos moment: the Approve sample. The connector line from A5 enters its top edge and leaves its bottom edge | Nivara feature row, enlarged | Loud |
| 6 | **A5 continued** | Step 3 send and receipt (entry 05), step 4 replies and the open row (entry 06) | Liftoff | Loud |
| 7 | **A7 Dark grain CTA card** | "Kairos is Greek for the right moment. You choose it." plus the start action | Liftoff dark card | Loud (dark) |
| 8 | **A8 Pricing** | Entry 07: billing toggle, four plan cards, credit sentence | Liftoff toggle, Nivara card tones | Quiet |
| 9 | **A9 Two-column list** (compare variant) | Entry 08: typical auto-apply against Kairos, rows only | Liftoff FAQ frame | Quiet |
| 10 | **A9 Two-column FAQ** | Entry 09: six questions | Liftoff FAQ | Quiet |
| 11 | **A10 Art CTA band** | Entry 10: serif closing line, one button, dusk glow | Liftoff closing, Nivara closing | Loud |
| 12 | **A11 Art footer** | Brand block, real links only, hairline, legal row, grainy dusk hills | Ironclad | Quiet top, loud bottom |

Rhythm check: loud and quiet alternate except at 4 to 6, where the zig-zag and spotlight form one continuous "how it works" chapter joined by the connector line. That chapter is the page's centre of gravity, as in Liftoff.

Things from the dark spec this map drops (owner decisions, see section 10): the WebGL receipt slip, the ledger rail and receipt tape, entry rules with graticule ticks, the Mint Frost band and lime custody. The entry numbers survive as small step badges and as the `001` to `003` card indices.

---

## 2. Section archetypes

Each archetype gives its anatomy (what is inside, back to front), placement rules, spacing and the four breakpoints. Container names (`--c-wide`, `--c-main`, `--c-narrow`) are defined in section 3.

### A0. Nav

**Anatomy.** Logo lockup left; three text links centred on the viewport axis (How it works, Pricing, Questions; only anchors that exist); right cluster of a plain "Log in" text link and one primary pill button.

**Placement.** Spans `--c-wide` (1280). Transparent over the hero. After 24 px of scroll it gains `background: rgb(251 248 243 / 0.82)`, `backdrop-filter: blur(12px) saturate(1.2)` and a 1 px `--hairline` bottom border. Sticky, never hides.

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Height | 72 | 72 | 64 | 60 |
| Side gutter | 80 | 48 | 32 | 20 |
| Links | Centred, 15 px, 40 px gap | Centred, 15 px, 32 px gap | Hidden; menu button (44 x 44) | Hidden; menu button |
| Button | 44 px pill | 44 px pill | 44 px pill | 40 px pill, label shortened per 06 |

Menu sheet below 1024: full-width panel dropping from the nav, canvas fill, 56 px link rows with hairline separators, primary button full width at the bottom, focus trapped, Escape closes.

### A1. Centred art hero

**Anatomy, back to front.**
1. Page canvas `--canvas`.
2. Painted landscape (raster, section 5.1), full bleed, masked so its top and bottom dissolve into the canvas.
3. Text scrim: a soft ellipse of canvas colour behind the copy, `radial-gradient(60% 45% at 50% 30%, rgb(251 248 243 / 0.85), transparent 70%)`. Invisible as a shape; it only protects contrast where the sky fade reaches the subline.
4. Copy stack, centred: status pill, H1 (serif, two lines, hard break), subline (sans, two lines), action row (primary pill plus a secondary ghost pill or text link).
5. Story cards: two floating sample cards on the painting's lower third, one in the left third and one in the right third, never over the copy column. Left card: a job with its fit result ("fit 86, passes your rules"). Right card: "Waiting for your approval" with a draft line and its citation. Both carry the Sample chip. Optional small chips between them (Liftoff's event chips): "Checked against your facts".

**Placement rules.**
- One centred axis. Copy column max 760 px; H1 measure 640 to 720 px; subline measure 560 px.
- Painting composition: open sky or water in the centre third, masses (ridges, trees) pushed to the outer thirds, horizon at about 45 percent of the art height. The focal point (sun on the river bend) sits on the centre axis below the action row, never behind letters.
- The art's top fade starts behind the lower half of the H1, so the subline and buttons sit on the faded sky (AGNCE, Nivara).
- Floating cards sit on colour transitions (Liftoff): left card where warm ground meets cool ridge, right card mirrored. Their tops align with each other; the right card is 24 px lower than the left so the pair does not read as a table.
- The first content below the hero (the commitment strip) starts below a 900 px fold at 1440; the floating cards must be fully above it.

**Vertical spec at 1440 x 900.**

| Element | y top | Height | Notes |
| --- | --- | --- | --- |
| Nav | 0 | 72 | Transparent |
| Status pill | 168 | 32 | 96 below the nav |
| H1 | 224 | about 164 | 24 below the pill; 2 lines at 80 px, line height 1.02 |
| Subline | 408 | about 56 | 20 below the H1; 18 px, line height 1.55 |
| Action row | 492 | 52 | 28 below the subline; 12 px gap between buttons |
| Art top fade starts | 340 | | Fully opaque by 560 (220 px fade) |
| Floating cards | 620 (left), 644 (right) | about 132 | Left card x 112 to 432; right card x 1008 to 1328 |
| Art bottom fade | 900 to 1000 | | Fades into the canvas |
| Hero block ends | 1000 | | Commitment strip begins 64 below |

**Breakpoints.**

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Hero height | 1000 | 920 | 900 | min(100svh + 160, 860) |
| Nav to pill | 96 | 88 | 72 | 40 |
| H1 size | 80 | 63 | 52 | 44 (2 or 3 lines; CTA must stay above the fold at 375 x 667) |
| Art band | y 340 to 1000, 2.2 : 1 crop | y 330 to 920 | y 360 to 900 | y 380 to bottom, portrait crop 4 : 5 |
| Floating cards | Two, outer thirds | Two, 280 wide, closer to edges (x 40 and right 40) | One card (the approval card), centred on the art, 320 wide | Moved out of the art: one card under the hero as a stacked sample, full width minus gutters |
| Buttons | Inline pair | Inline pair | Inline pair | Stacked, full width, primary first |

### A2. Commitment strip (the proof slot)

Both Nivara and Liftoff put borrowed trust (logos) right after the hero. Kairos has no customers, so the slot holds **rules the product enforces**, which a visitor can check against the rest of the page.

**Anatomy.** Caption line (14 px, `--muted`, centred, from 06). A single row of three or four items; each item is a 20 px line icon in `--ink-2` plus a 16 px / 500 label. Items are separated by 1 px vertical rules 24 px tall in `--rule`.

**Placement.** `--c-main`, centred, items spaced with `justify-content: center` and a 48 px gap. No marquee: three or four items fit, and an infinite loop would imply a long list that does not exist. Edge-fade masks are therefore not used.

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Layout | One row | One row, 32 px gap | 2 x 2 grid, rules removed, 24 px row gap | One column list, left-aligned, 16 px row gap, icon aligned to the first text line |
| Hero to strip | 64 | 56 | 48 | 40 |
| Strip to next section | 160 | 128 | 112 | 88 |

### A3. Problem trio

**Anatomy.**
1. Head row: eyebrow pill, then a two-line sans H2 on the left; a 3 to 4 line side paragraph on the right, top-aligned to the H2 cap line (Nivara).
2. Three equal cards (C1 quiet card, section 4): index `001` to `003` (12 px, `--muted`, tabular), a large line icon (96 px, 1.25 px stroke, `--ink-2`), title (20 px / 500) and a two to three line description (16 px, `--body`). Title and description are pinned to the bottom of the card; the icon floats in the upper half.
3. One sentence below the trio, left-aligned to the first card: the open-row honesty line from entry 01 ("Row 04 stays open..."), 16 px `--body`, with a hollow 8 px square before it.

**Placement.** `--c-main` (1120). Head row on the 12-column grid: H2 in columns 1 to 7, side paragraph in columns 9 to 12, right edge flush to the container.

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Head row | Split 7 / 4 columns | Split 7 / 5 | Stacked, paragraph 24 below the H2 | Stacked |
| Cards | 3 columns, 357 x 380, 24 gap | 3 columns, about 293 x 360, 20 gap | 1 column, horizontal card: icon 64 left, text right, auto height | 1 column, icon 56 above text, auto height |
| Card padding | 28 | 24 | 24 | 20 |
| Head to cards | 80 | 64 | 56 | 40 |

### A4. Section intro

The repeated head stack used by every section that is not the hero.

**Anatomy.** Eyebrow pill (optional) then H2 then subline then (optional) one control, such as the segmented toggle.

**Placement.** Centred by default (Liftoff, Nivara "Product" beat); left-aligned only when the section is a split (A3, A9). Max width 760, subline measure 560.

| Gap | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Pill to H2 | 24 | 24 | 20 | 16 |
| H2 to subline | 20 | 20 | 16 | 16 |
| Subline to control | 28 | 28 | 24 | 24 |
| Intro to content | 72 | 64 | 56 | 40 |

### A5. Zig-zag steps with connector path

The signature component of Liftoff, used for "How Kairos works".

**Anatomy, per step row.**
1. **Art panel** (C4, section 4): 4 : 3, radius 24. Background is either a crop of the dawn painting or a procedural grain gradient (section 5.2). At least one panel edge is near-canvas colour so the panel melts into the page.
2. **Sample UI card** (C3) inside the panel: white, radius 16, 72 percent of the panel width, showing one sentence of product state, built from the existing islands (see section 9). Optional ghost card peeking 12 px above it to imply a queue.
3. **Floating chip** (C3 small): a pill that hangs off the UI card's lower edge and crosses the panel boundary by 16 to 24 px (Liftoff "You shared Renee..."), for example "Not saved. Cites no confirmed fact."
4. **Text column** beside the panel: step badge (32 px circle, 1 px gradient ring, 14 px numeral), H3 (sans, 2 to 3 lines), body (2 to 3 lines), optional inline small button on the last step.
5. **Connector**: one SVG path that leaves the bottom centre of a panel, drops 48 px, turns with a 32 px radius, crosses the gutter on a shallow diagonal, turns again and enters the top centre of the next panel. Stroke 1.5 px, `stroke-linecap: round`, gradient from `--glow-periwinkle` to `--glow-coral` at 70 percent opacity. It is the only element that crosses the centre gutter.

**Placement rules.**
- `--c-narrow` (960), split 50 / 50 with a 48 px gutter: panel 456 x 342, text column 456.
- Panels alternate: step 1 left, step 2 right, (spotlight A6), step 3 left, step 4 right.
- Text is always left-aligned, inset 56 px from the panel edge on its side, vertically centred on the panel, measure 360 (H3) and 340 (body).
- Before the spotlight, the connector from step 2 runs to the spotlight card's top edge at the card's horizontal centre; after the spotlight, it leaves from the card's bottom centre into step 3. The thread therefore passes through the Approve moment.
- Optional segmented toggle in the A4 intro switches the step copy between "What Kairos does" and "What it refuses to do". Panels stay; only the sample card text and H3 or body swap. If 06 does not supply the refusal set, the toggle is omitted (no empty control).

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Container | 960 | 928 | 704 | 350 |
| Panel | 456 x 342 | 440 x 330 | Full width, 704 x 440 (16 : 10), stacked above text | Full width, 350 x 280 (5 : 4) |
| Text inset | 56 | 48 | 0 (text below panel, 24 gap) | 0 (20 gap) |
| Row gap (bridged by connector) | 144 | 128 | 96 | 72 |
| Connector | Zig-zag S-curves across the gutter | Same | Straight vertical line at x = 20 from the left edge, joining step badges like a timeline; badges move left of the H3 | Same as 768, x = 12 |
| UI card width | 72 percent of panel | 72 percent | 64 percent | 86 percent |

### A6. Spotlight with floating cards

Nivara's feature row, enlarged to one decisive moment. Used once, for entry 04 (Approve). It may be reused for entry 05's receipt if the owner wants a second spotlight; never more than two on the page.

**Anatomy.**
1. Outer card (C2): white `--surface`, 1 px `--hairline`, radius 28, no heavy shadow.
2. Art half: painting crop (the valley at mid-morning: higher sun, the same river) filling its half edge to edge, clipped by the card radius on its outer corners.
3. White mock-up panel: the approve sample island (`approve-sample.tsx` restyled), anchored to the card's outer edge and bleeding off it by 24 px, 70 percent of the art half wide.
4. Floating card (C3): straddles the join between the mock and the art (about 40 percent of its width over the art), 15 to 25 percent from the card top. Content: the signature box ("Approved by you, 14:32 your time") after approval, "Awaiting your approval" before. Sample chip.
5. Text half: eyebrow, serif H2 (this is one of the three serif moments), body, the Approve control lives in the mock, not here.

**Placement.** `--c-main` (1120), split 48 / 52 (art left, text right). Text block vertically centred, 72 px padding on the side nearest the art, 64 px on the outer side.

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Card | 1120 x 560 | 928 x 520 | 704, stacked: art 704 x 440 on top, text below with 40 padding | 350, art 350 x 360 on top, text 24 padding |
| Mock bleed | 24 off the outer edge | 24 | Bleeds off the bottom of the art, 16 | No bleed; inset 16, full art width minus 32 |
| Floating card | Straddles mock and art | Same | Overlaps the art's bottom edge by 24 into the text area | Below the mock, in normal flow, 16 gap |
| Card radius | 28 | 28 | 24 | 20 |

### A7. Dark grain CTA card

**Anatomy.** Contained card (C5) with a procedural mesh gradient and visible grain; centred serif H2 (two lines, white), one line of sub text, one inverse button (white fill, ink label). No trust line, no favicons.

**Placement.** `--c-narrow` (960), content centred, max text width 600. Text sits over the darkest part of the gradient (section 6 contrast rule); the bright periwinkle glow rises from the bottom centre below the button, and the olive corner sits top right away from text.

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Size | 960 x 380 | 928 x 360 | 704 x 360 | 350 x auto (about 400) |
| Padding | 96 vertical | 88 | 72 / 48 | 56 / 24 |
| H2 | 52 serif | 46 | 42 | 36 |
| H2 to sub / sub to button | 16 / 32 | 16 / 32 | 16 / 28 | 12 / 24 |
| Radius | 28 | 28 | 24 | 20 |
| Gap above and below | 144 | 128 | 112 | 88 |

### A8. Pricing

The references have no pricing; this archetype builds it from their parts so it does not look foreign.

**Anatomy.** A4 intro (centred) with the segmented toggle (Weekly, Monthly, Quarterly), then four plan cards (C6), then one credit sentence centred below. Each card: plan name (20 / 500), one-line purpose (15, `--muted`), price (Inter Tight 500, 48 px, tabular), period (15, `--muted`), hairline, feature list (15, `--body`, 12 px row gap, 16 px check icons), full-width button at the bottom (primary on the featured card, secondary on the others). No "Most chosen" badge (no customers to have chosen).

**Placement.** `--c-main` (1120), four equal columns with a 16 px gap (268 each). Buttons align to the card bottoms (cards stretch to equal height).

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Columns | 4 | 2 x 2 (4 x 220 is too narrow for the feature lists) | 2 x 2 | 1 column, Free first, 16 gap |
| Card padding | 28 | 28 | 24 | 24 |
| Toggle to cards | 56 | 48 | 48 | 32 |
| Featured card | 1 px `--ink` border plus a 4 px grain wash strip along its top edge | Same | Same | Same |

### A9. Two-column list (FAQ and compare)

**Anatomy, FAQ.** Left: sans H2 at section size, two lines, plus a short contact line under it. Right: native `<details>` rows. Each row: question 17 / 500 `--ink`, a 28 px circular icon (fill `--sunk`, plus or minus glyph 12 px) at the right edge, 1 px `--hairline` below. Answer 16 px `--body`, paragraphs 16 px apart, measure 600.

**Anatomy, compare variant.** Same left column. Right column is a list of rows; each row has a 15 px / 500 topic label above two sub-columns ("Typical auto-apply" in `--muted`, "Kairos" in `--ink`), hairline between rows. No product names, no prices.

**Placement.** `--c-narrow` (960), split about 1 : 2: left column 320, right column 600 starting at x = container left + 360. The right column's left edge is a shared x-line used again by the footer's link group start (Liftoff), so FAQ, compare and footer line up.

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Split | 320 / 600, 40 gap | 300 / 588 | Stacked: heading above, 32 gap | Stacked, 24 gap |
| Row height (closed) | 64 | 64 | 60 | 56 (min touch target 44 kept by the whole row being the summary) |
| Compare sub-columns | Side by side, 50 / 50 | Side by side | Side by side | Stacked inside each row, labels repeated |

### A10. Art CTA band (closing)

**Anatomy.** Full-bleed procedural dusk glow (section 5.2) about 560 px tall; centred serif closing line (two lines, the largest type on the page); 16 px sub line; one primary button. The glow's hottest colours sit outside the text's left and right edges; the centre is a near-canvas ellipse.

**Placement.** Centred, text max width 820. The glow's lower edge does not end: it fades into the footer's ground gradient, so the closing band and the footer read as one sky (Liftoff "ending in colour", Nivara CTA flowing into the footer).

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Gap above (from FAQ) | 200 | 160 | 128 | 96 |
| Band height | 560 | 520 | 480 | 440 |
| Closing type | 96 serif | 75 | 62 | 48 |
| Headline to sub / sub to button | 24 / 32 | 24 / 32 | 20 / 28 | 16 / 24 |
| Glow | Periwinkle left, coral and amber right | Same | Hot colours shifted below the text (side room is too small) | Below the text only |

### A11. Art footer

Ironclad's structure with Kairos content.

**Anatomy, top to bottom.**
1. **Link band.** Left brand block: logo lockup (glyph plus wordmark, 28 px tall), tagline (15 px, two lines, factual, no numbers), social row (41 px outlined squares, 6 px radius, 8 px gap) **only for accounts that exist at launch**; otherwise omitted. Right: link columns, content-width, fixed 96 px gap, pushed to the right edge, top-aligned to the logo. Columns (only pages that exist at launch): Product (How fit is decided, Approval, Pricing), Help (Questions, Contact), Legal (Privacy, Terms, Sending and approval policy). Column heading 15 / 500 `--ink`; links 15 / 400 `--body`; 32 px link pitch.
2. **Hairline**: 1 px `--rule`, full container width.
3. **Legal row**: copyright (14 px, `--muted`) left with the confirmed legal entity name; the Motion control (Full or Reduced) right.
4. **Dusk hills**: full-bleed grain landscape (section 5.2), starting 24 px below the legal row and running to the page bottom. Nothing sits on it.

**Placement.** `--c-wide` (1280) with 80 px gutters at 1440. Logo, hairline and legal row share the left and right edges. Brand block takes 40 percent; the link group starts at the A9 shared x-line when that falls inside the right 60 percent.

| | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| Footer top to logo | 80 | 72 | 64 | 56 |
| Layout | Brand left, 3 columns right | Brand left, 3 columns right, 64 gap | Brand on top; columns in a 3-column grid below, 40 gap | Brand on top; columns stacked 2 + 1 grid, 32 gap |
| Links to hairline | 64 | 56 | 48 | 40 |
| Hairline to legal text | 24 | 24 | 20 | 20 |
| Hills height | 420 | 340 | 280 | 200 |
| Grain | 5 percent on the text zone, 12 percent on the hills | Same | Same | Same |

---

## 3. Grid, containers, rhythm and spacing scale

### 3.1 Containers

The references use one dominant container each (Liftoff 900, Nivara 1120, Ironclad 1280). Kairos uses all three, each for one job, always centred:

| Token | Max width | Used by |
| --- | --- | --- |
| `--c-wide` | 1280 | Nav, footer |
| `--c-main` | 1120 | Commitment strip, problem trio, spotlight, pricing |
| `--c-narrow` | 960 | Zig-zag steps, dark CTA card, FAQ and compare |
| `--c-copy` | 760 | Hero and section intro stacks |
| `--measure` | 560 (subline), 600 (answers), 66ch max for any paragraph | Text |

Full bleed only: hero painting, closing glow, footer hills. Nothing else breaks the container.

### 3.2 Grid and gutters

| Breakpoint | Columns | Column gap | Side gutter | Notes |
| --- | --- | --- | --- | --- |
| 1440 | 12 | 32 | 80 (`--c-wide` exactly fills 1440 - 160) | Containers narrower than 1280 centre inside it |
| 1024 | 12 | 24 | 48 | `--c-main` and `--c-narrow` both become 928 |
| 768 | 8 | 24 | 32 | All containers become 704 |
| 390 | 4 | 16 | 20 | All containers become 350 |

### 3.3 Section rhythm

The references agree on the shape: **very large gaps between sections, tight steps inside them** (Nivara: block gaps 3 to 5 times the heading size; Liftoff: 130 to 170 between sections, 14 to 24 inside).

| Gap | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| `--gap-chapter`: between loud and quiet sections | 160 | 128 | 112 | 88 |
| `--gap-section`: between two quiet sections | 128 | 112 | 96 | 72 |
| `--gap-closing`: last content to closing band | 200 | 160 | 128 | 96 |
| `--gap-intro`: section intro to its content | 72 | 64 | 56 | 40 |
| Heading stack steps (pill, H, sub, action) | 24 / 20 / 28 | 24 / 20 / 28 | 20 / 16 / 24 | 16 / 16 / 24 |

Section spacing is applied as `padding-block` on the section, never as margins on children, so art bands can extend into it.

### 3.4 Spacing scale

4 px base: `4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 72, 80, 96, 112, 128, 144, 160, 200`. Inside components use 4 to 32; between components 40 to 96; between sections 72 to 200. Card padding: 20 (390), 24 (768), 28 (1024 and 1440); floating cards 16 to 20.

Estimated page height at 1440: about 7,600 px (hero 1000, strip 230, trio 760, steps chapter with spotlight 2,500, dark card 670, pricing 1,050, compare 560, FAQ 620, closing 760, footer 900, less overlaps). That is about 8.4 viewports, against about 16.5 for the dark spec (README R8), which also resolves the page-length risk.

---

## 4. Card system

Radius grows with element size (Liftoff); nested radius equals the outer radius minus the padding, never larger.

### 4.1 Radius scale

| Token | Value | Used by |
| --- | --- | --- |
| `--r-xs` | 6 | Sample chip, social squares, small tags |
| `--r-sm` | 12 | Floating cards, inputs, small UI cards |
| `--r-md` | 16 | Sample UI cards inside panels |
| `--r-lg` | 20 | Problem cards, pricing cards, all cards at 390 |
| `--r-xl` | 24 | Art panels, feature cards at 768 |
| `--r-2xl` | 28 | Spotlight card, dark CTA card |
| `--r-pill` | 9999 | Buttons, pills, toggle, icon circles |

### 4.2 Shadows

All shadows are warm (brown, not grey) and wide, from Nivara's floating cards.

| Token | Value | Used by |
| --- | --- | --- |
| `--sh-ring` | `0 0 0 1px rgb(24 21 31 / 0.06)` | Cards that need an edge without a border |
| `--sh-float` | `0 1px 2px rgb(40 28 20 / 0.06), 0 10px 30px rgb(120 90 60 / 0.12)` | Floating and sample UI cards |
| `--sh-lift` | `0 2px 4px rgb(40 28 20 / 0.06), 0 18px 40px rgb(120 90 60 / 0.16)` | Hover state of floating cards |
| `--sh-deep` | `0 30px 60px rgb(29 22 38 / 0.18)` | Dark CTA card only |

Buttons, pills, problem cards, pricing cards and the spotlight card have no shadow.

### 4.3 Card types

| Type | Background | Border | Radius | Shadow | Where |
| --- | --- | --- | --- | --- | --- |
| C1 Quiet card | `--sunk` `#F3EEE7` | none | 20 | none | Problem trio |
| C2 Feature card | `--surface` `#FFFFFF` | 1 px `--hairline` | 28 | none | Spotlight |
| C3 Floating card | `#FFFFFF` | 1 px `--hairline` | 12 to 16 | `--sh-float` | Hero story cards, sample UI cards, chips over art |
| C4 Art panel | Painting crop or grain gradient | none | 24 | none | Step panels, spotlight art half |
| C5 Dark grain card | Mesh gradient on `--dark` `#1B1626` plus grain | none | 28 | `--sh-deep` | Dark CTA |
| C6 Plan card | `#FFFFFF` | 1 px `--hairline`; featured 1 px `--ink` | 20 | none | Pricing |
| C7 Frosted card | `rgb(255 255 255 / 0.62)` with `backdrop-filter: blur(14px)` | 1 px `rgb(255 255 255 / 0.7)` | 16 | `--sh-ring` | Rare: anything that sits on a glow (closing band) |

**Gradient-backed cards (C4, C5).** The gradient lives on a `::before` layer clipped by the card's `overflow: clip` and radius; the grain is a second `::after` layer (section 5.3). The content layer sits above both with `isolation: isolate`. At least one edge of a C4 panel ends in a near-canvas tint (`#F8F1EA`) so the panel melts into the page.

**Sample labelling.** Every UI card that shows product state carries the Sample chip (12 px / 500, uppercase, `--muted` on `--sunk`, `--r-xs`, 22 px tall) in its top-right corner and uses synthetic names ("Company 014"). The dashed "sample" edge from the dark spec is dropped: on floating white cards it reads as broken, and the chip already carries the meaning.

---

## 5. Imagery system

Two kinds of imagery, never mixed in one element: **painted landscapes** (raster) and **grain gradients** (procedural). At most four colour fields are visible in one viewport (Liftoff warning).

### 5.1 Painted landscapes (raster)

**What.** One original painting of one valley (river, soft ridges, meadow, distant mountains), in a soft digital-painting style with no outlines and strong atmospheric perspective. Not a studio pastiche: no Ghibli look, no barns or anime cloud stacks (AGNCE rights and taste risk). Art must be original or licensed with written rights; record the source in the repo next to the files.

**Where.**

| Use | Time of day | Format |
| --- | --- | --- |
| A1 hero | Dawn: cool sky `#DCE7F2` to haze `#F6DCC8`, peach river `#E8A87C`, mauve ridges `#9C8793`, sage meadow `#A9B48C` | Full bleed, soft-edged |
| A5 step panels 1 and 3 | Crops of the hero painting (river bend, meadow) | Clipped by radius 24 |
| A6 spotlight art half | Mid-morning crop: same valley, higher light | Clipped by radius 28 |
| A10 and A11 | Dusk, procedural (section 5.2), so only one painting master is needed | |

**How it fades into the page.** On the art element:

```css
mask-image: linear-gradient(to bottom,
  transparent 0%, #000 33%,      /* 220 px top fade at 1440, starting behind the lower H1 */
  #000 85%, transparent 100%);   /* 100 px bottom fade into the canvas */
```

No side fades: the painting runs edge to edge and its masses are cropped by the viewport on purpose. Contained crops (C4) use no mask; the card radius clips them.

**Crop and focal point.**
- Master: 3200 x 1600 (2 : 1), plus a portrait art-direction crop 1080 x 1350 (4 : 5) for 390, served with `<picture>` and a `media` query.
- Composition rule: centre third low-detail (sky, still water); masses in outer thirds; horizon at 45 percent of the art height; the focal point (sun glint on the river bend) on the centre axis, 60 percent down the art.
- `object-fit: cover`; `object-position`: `50% 60%` at 1440 and 1024, `50% 70%` at 768, `50% 55%` on the portrait crop.

**Production and delivery.**
- Commissioned painting, or AI-assisted generation that is then painted over and checked for rights, in layers: sky, far ridges, mid ridges, river and meadow, foreground grasses. Keep the layers: they enable parallax (section 8) without re-painting.
- Export AVIF (quality about 50) with a WebP fallback through `next/image`. Widths 640, 1080, 1600, 2400, 3200. Target about 110 KB for the 1440 hero file; each step-panel crop under 40 KB at 2x.
- Hero art: `priority` (preload, `fetchpriority="high"`), `sizes="100vw"`. Placeholder is a CSS gradient in the painting's own colours on the art container, so the first paint is already warm (no blur-up flash).
- If layered parallax is used, ship two layers only at 1024 and wider (sky plus ridges, foreground) as separate AVIFs with alpha; below 1024 ship the flattened file.

### 5.2 Procedural grain gradients (CSS and SVG)

Used for: the A5 panels without painting (steps 2 and 4), the A7 dark card, the A10 closing glow, the A11 dusk hills, the toggle ring glow and the featured pricing strip.

**Glow palette** (toned roughly a third below Liftoff and Ironclad, so the brand stays calm):

| Token | Hex | Role |
| --- | --- | --- |
| `--glow-periwinkle` | `#AAB6F2` | Cool side of every field |
| `--glow-lilac` | `#D8C8E8` | Cool transition |
| `--glow-rose` | `#EBA9B4` | Warm transition |
| `--glow-coral` | `#F08A5D` | Warm side, hot point |
| `--glow-amber` | `#F2B866` | Warm highlight |
| `--glow-olive` | `#A9A46A` | Earthy accent (dark card corner, footer mid ridge) |
| `--glow-dusk` | `#6F74C9` | Footer back ridge |
| `--glow-ember` | `#B4553A` | Footer foreground corners |

Every field contains at least one warm and one cool colour (Liftoff).

**Glows (panels, closing band).** Layered `radial-gradient()`s on a pseudo-element, softness built into the gradient stops, not `filter: blur()` (a 1440 x 560 blur repaints expensively). Example, closing band:

```css
.lp-glow-dusk::before {
  background:
    radial-gradient(40% 70% at 12% 70%, rgb(170 182 242 / 0.9), transparent 70%),
    radial-gradient(38% 65% at 88% 65%, rgb(240 138 93 / 0.85), transparent 70%),
    radial-gradient(30% 50% at 72% 90%, rgb(242 184 102 / 0.8), transparent 70%),
    radial-gradient(45% 40% at 50% 40%, var(--canvas), transparent 80%);  /* clear zone behind text */
}
```

**Dark card mesh (C5).** Base `#1B1626`; radials: `#5A4F86` at 50% 115%, `#827BC8` at 50% 130% (the glow rising under the button), `#6E6A4E` at 100% 0% (olive corner, 25 percent size), `#8FB0BA` at 100% 100% (teal, 20 percent size); a darkening ellipse `rgb(27 22 38 / 0.6)` at 50% 40% behind the text.

**Footer hills.** Authored as one SVG: four ridge paths stacked back to front (dusk violet `#6F74C9` to `#9AA3E6`, rose `#E9A0A8`, olive `#A9A46A` to `#8E9358`, ember `#E07F5E` to `#B4553A` in the corners), each with a vertical `linearGradient` fill, a horizon streak (`#FFD8CC` core, 40 px blur) between the olive and ember ridges, and the top ridge fading into the footer ground (`#FBF8F3` to blush `#F7E6E4`) over 64 px. The SVG's `feGaussianBlur` (stdDeviation 10 to 18 per ridge) is applied at author time and **baked to an AVIF** (2880 x 840, about 60 KB): crisp, cheap and identical in every browser. Grain is added live in CSS, not baked, so it stays sharp at every DPR.

**Grain.** One SVG noise tile, inlined as a data URI, reused everywhere:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
  <feColorMatrix type="saturate" values="0"/></filter>
  <rect width="100%" height="100%" filter="url(#n)"/>
</svg>
```

Applied as `background-image` on an `::after` layer with `mix-blend-mode: soft-light` and `background-size: 240px`, `pointer-events: none`. Opacity per surface:

| Surface | Grain opacity |
| --- | --- |
| Text zones (footer link band, anywhere body text sits) | 0 to 5 percent |
| A5 gradient panels, A10 closing glow | 8 percent |
| A11 hills | 12 percent |
| A7 dark card | 14 percent (`mix-blend-mode: overlay`) |

Grain is static. Animated grain is not used (flicker, vestibular risk, constant repaints).

**Shader?** Not used. Every field above is CSS, SVG or a baked AVIF; there is no WebGL on this page. A shader version of the footer hills (slow ridge drift) is possible later at 1024 and wider, with the AVIF as the fallback, but nothing in the references requires it.

---

## 6. Colour

### 6.1 Tokens

Warm paper and violet-black ink from Liftoff; Nivara's warm-brown shadows; one warm accent for numerals; Kairos lime kept only as a tiny status fill so the brand mark survives the move to light.

| Token | Hex | Role |
| --- | --- | --- |
| `--canvas` | `#FBF8F3` | Page background (warm paper; between Liftoff `#FFFAF6` and Nivara `#F9F9F9`) |
| `--surface` | `#FFFFFF` | Cards |
| `--sunk` | `#F3EEE7` | Quiet cards, eyebrow pills, icon circles |
| `--hairline` | `#E6DFD5` | Card borders, FAQ rules (decorative) |
| `--rule` | `#D8CFC3` | Footer hairline, strip separators (decorative) |
| `--control` | `#8C8378` | Borders that identify a control: secondary button, social squares, inputs (3:1 or better) |
| `--ink` | `#18151F` | Headings, primary button fill, strong text |
| `--ink-2` | `#2E2A35` | Large headings when a softer tone is wanted, icons |
| `--body` | `#4A4550` | Body text |
| `--muted` | `#625C66` | Captions, indices, secondary labels |
| `--accent-ember` | `#A4501C` | Stat numerals and the one optional accent word |
| `--accent-valley` | `#2C5AA0` | Text links inside body copy (optional; ink with underline is the default) |
| `--lime` | `#7FEE64` | Fill only: the 8 px "passes" dot and the approved state dot. Never text, never a button fill |
| `--dark` | `#1B1626` | Dark CTA card base |
| `--on-dark` | `#F7F3EE` | Text on the dark card |
| `--on-dark-muted` | `#C9C1D2` | Secondary text on the dark card |

Status words (pass, skip, refused) keep the brief's semantic roles but use light-surface values defined in 02; they appear only as words and small badges.

### 6.2 Contrast (WCAG 2.2 AA), computed

Computed with the WCAG relative luminance formula. AA needs 4.5:1 for body text, 3:1 for text 24 px and larger (or 18.66 px bold) and for control boundaries.

| Foreground | on `--canvas` | on `--surface` | on `--sunk` | on hero haze `#F6DCC8` | on sky `#DCE7F2` | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `--ink` `#18151F` | 17.0 | 18.0 | 15.6 | 13.7 | 14.4 | Pass everywhere |
| `--ink-2` `#2E2A35` | 13.2 | 14.0 | 12.1 | 10.7 | 11.2 | Pass everywhere |
| `--body` `#4A4550` | 8.8 | 9.3 | 8.1 | 7.1 | 7.4 | Pass everywhere |
| `--muted` `#625C66` | 6.1 | 6.5 | 5.6 | 4.9 | 5.2 | Pass everywhere (keep at 14 px or more) |
| `--accent-ember` `#A4501C` | 5.3 | 5.6 | 4.9 | 4.3 | 4.5 | Body size passes on canvas, surface, sunk and sky; on haze large text only (numerals are 40 px) |
| `--accent-valley` `#2C5AA0` | 6.4 | 6.8 | 5.9 | 5.2 | 5.5 | Pass everywhere |
| `--control` `#8C8378` | 3.5 | 3.7 | 3.2 | 2.8 | 3.0 | Control boundaries on canvas, surface and sunk only; not over art |
| `#8A8390` (Liftoff-style faint grey) | 3.5 | 3.7 | 3.2 | 2.8 | 2.9 | **Fails for text.** Not used for any text (Liftoff's 12.5 px grey body is the anti-pattern) |
| White on `--ink` (primary button) | | | | | | 18.0, pass |
| `--ink` on `--lime` | | | | | | 12.3, pass (only if lime ever carries a glyph) |
| `--on-dark` on `--dark` | | | | | | 16.0, pass |
| `--on-dark-muted` on `--dark` | | | | | | 10.1, pass |
| `--on-dark` on `#5A4F86` (mid mesh) | | | | | | 6.6, pass |
| `--on-dark` on `#827BC8` (bright glow) | | | | | | 3.4: **large text only**, so no text may sit over the bright glow; it stays below the button |

Rules that follow from the table:
1. No text sits directly on painted art below the faded sky zone. Hero copy sits on the scrim (section A1) where the background is at worst haze `#F6DCC8`.
2. Floating cards over art carry their own white background, so their contrast is computed against `--surface`.
3. The secondary button over the hero art uses `rgb(255 255 255 / 0.6)` plus an 8 px backdrop blur so its label is on near-white, and its 1 px `--control` border is backed by that fill (3.7:1).
4. Focus ring: 2 px `--ink` outline with a 3 px offset on light surfaces (17:1); 2 px `--on-dark` on the dark card.

---

## 7. Type, buttons, pills, nav and footer

### 7.1 Type pairing

Serif for feeling, sans for explaining (Liftoff). Three serif moments only: hero H1, the spotlight and dark-card H2s, the closing line. Everything else is sans.

| Role | Face |
| --- | --- |
| Display serif | **Instrument Serif 400** (Google Fonts, one weight, about 25 KB woff2, latin subset). Elegant high contrast, narrow set that fits two-line headlines at 80 to 96 px. Alternative: **Fraunces** variable (opsz 144, weight 400, SOFT 50, WONK 0), heavier file (about 60 KB) but softer and warmer; choose it if Instrument Serif reads too fashionable |
| Headings sans | Inter Tight 500 (already loaded, `ss01`) |
| UI and body | Inter 400 and 500 (already loaded, `cv11`) |
| Numerals | Inter Tight 500, `tabular-nums slashed-zero` |

Weights stay 400 and 500 (brief rule). Sentence case and full stops on headlines. No coloured accent words by default; the serif and sans switch carries emphasis. If the owner wants AGNCE's coloured second line, use `--accent-ember` or `--ink-2` on line 2 of the hero only, never both a serif and a colour accent in other sections.

### 7.2 Size scale

| Token | Face | 1440 | 1024 | 768 | 390 | Line height | Tracking | CSS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `--t-closing` | Serif | 96 | 75 | 62 | 48 | 1.0 | -0.015em | `clamp(3rem, 1.5rem + 5vw, 6rem)` |
| `--t-hero` | Serif | 80 | 63 | 52 | 44 | 1.02 | -0.015em | `clamp(2.75rem, 1.25rem + 4.2vw, 5rem)` |
| `--t-serif-h2` | Serif | 52 | 46 | 40 | 36 | 1.08 | -0.01em | `clamp(2.25rem, 1.5rem + 2.1vw, 3.25rem)` |
| `--t-h2` | Inter Tight 500 | 44 | 40 | 35 | 32 | 1.1 | -0.025em | `clamp(2rem, 1.35rem + 1.8vw, 2.75rem)` |
| `--t-h3` | Inter Tight 500 | 30 | 28 | 26 | 24 | 1.2 | -0.015em | `clamp(1.5rem, 1.15rem + 0.9vw, 1.875rem)` |
| `--t-h4` | Inter 500 | 20 | 20 | 19 | 18 | 1.3 | -0.005em | |
| `--t-numeral` | Inter Tight 500 | 48 | 44 | 40 | 40 | 1.0 | -0.02em | Prices, stat numerals |
| `--t-lead` | Inter 400 | 18 | 18 | 17 | 17 | 1.55 | 0 | Sublines |
| `--t-body` | Inter 400 | 16 | 16 | 16 | 16 | 1.6 | 0 | Body, answers |
| `--t-small` | Inter 400 or 500 | 14 | 14 | 14 | 14 | 1.5 | 0 | Captions, legal, nav links at 15 |
| `--t-micro` | Inter 500, uppercase | 12 | 12 | 12 | 12 | 1.2 | +0.06em | Sample chip, card indices only |

No text below 12 px anywhere; body copy never below 14 px.

### 7.3 Buttons

One dark button style carries every primary action (all references). Pills, not soft rectangles: AGNCE's pill matches the existing A19 decision to keep CTAs as 9999 px pills.

| Variant | Fill | Label | Border | Height and padding | Hover | Use |
| --- | --- | --- | --- | --- | --- | --- |
| Primary | `--ink` | White 16 / 500 | none | 52 high, 0 28 padding (hero, closing, cards); 44 high, 0 20 (nav, inline) | Fill `--ink-2`, translateY(-1px), 160 ms | One per block |
| Secondary | `rgb(255 255 255 / 0.6)` plus 8 px backdrop blur | `--ink` 16 / 500 | 1 px `--control` | Same as primary | Fill white | Hero pair, non-featured plan cards |
| Inverse | White | `--ink` | none | 52 high | Fill `#EFEAF4` | Dark CTA card only |
| Text link | none | `--ink` 15 / 500 | Underline on hover, 1 px, 3 px offset | 44 px hit area | Underline draws | "Log in", "See how it works" |

Rules: at most one primary per section; the hero may pair it with one secondary; no icon-only buttons except the menu button and social squares (each with an accessible name). Touch targets 44 px with 8 px spacing.

### 7.4 Pills and controls

| Pill | Size | Fill and border | Text | Notes |
| --- | --- | --- | --- | --- |
| Status pill (hero) | 32 tall, 14 padding | `--surface` with 1 px `--hairline` | 14 / 500 `--ink-2` | Optional 8 px `--lime` dot with a 1 px `--ink` ring before the text. Honest status only (for example pre-launch or waitlist state from 06), never counts or "trusted by" |
| Eyebrow pill | 28 tall, 12 padding | `--sunk`, no border | 13 / 500 `--muted` (5.6:1) | Section intros |
| Sample chip | 22 tall, 8 padding | `--sunk` | 12 / 500 uppercase `--muted` | Every sample card |
| Step badge | 32 circle | `--surface`, 1 px gradient ring (amber to lilac) | 14 / 500 tabular `--ink` | A5 |
| Segmented toggle | 52 tall container, 6 padding | `--surface`, 1 px gradient ring (`--glow-amber` to `--glow-lilac` to `--glow-amber`), outer glow `0 0 24px rgb(242 184 102 / 0.30)` | Active segment: `--ink` pill, white 15 / 500; inactive: `--ink` on white | Native radio inputs underneath; arrow keys move selection |
| FAQ icon | 28 circle | `--sunk` | 12 px plus or minus glyph | Part of the `<summary>` |

### 7.5 Nav and footer

Specified in A0 and A11. Shared rules: nav and footer use only real destinations; no social links to accounts that do not exist; no "Trusted by" or user-count tagline; the legal entity in the copyright is confirmed by the owner; the footer Motion control replaces the dark spec's clock line.

---

## 8. Motion vocabulary

The references imply a soft, ambient, scroll-aware motion style. Every item below has a reduced-motion fallback, and every looping item stops when its element is off-screen (IntersectionObserver sets `animation-play-state: paused`) or when the visitor chooses Reduced in the footer.

Engines: CSS by default (`@keyframes`, transitions, scroll-driven animations with `animation-timeline: view()` where supported). The existing GSAP ScrollTrigger dependency is used only as the fallback for scroll-linked items (M2, M6) in browsers without scroll-driven animations, at 1024 px and wider. No Lenis smooth scroll is required by this system; it can stay off.

Easing tokens: `--ease-out cubic-bezier(0.22, 1, 0.36, 1)` (arrivals), `--ease-in-out cubic-bezier(0.45, 0, 0.55, 1)` (loops and drifts), `--ease-in cubic-bezier(0.55, 0, 1, 0.45)` (exits).

| # | Move | Where | Spec | Reduced motion |
| --- | --- | --- | --- | --- |
| M1 | Soft float | Hero story cards, spotlight floating card, step floating chips | `translateY` between -4 and +4 px, 7 s, `--ease-in-out`, `alternate infinite`; each card offset by -1.75 s so they never move in sync | Static at 0 |
| M2 | Parallax on art layers | Hero painting layers; step panel crops | Far ridges 0.06x scroll, foreground 0.14x, capped at 48 px total travel; panels' inner art moves 24 px inside its clip as the panel crosses the viewport. Transform only | None; layers flattened in place |
| M3 | Hero story sequence | Hero cards and chips | One-shot on load after the H1 is painted: left card 0 ms, chip 200 ms, right card 400 ms; each `opacity 0 to 1` plus `translateY 12 to 0`, 600 ms `--ease-out`. Content is in the HTML and visible without JavaScript; the sequence is gated by a `js` class on `<html>` | Final state at frame 0 |
| M4 | Hover lift | Floating cards, plan cards, step panels' UI card | `translateY(-3px)` plus `--sh-lift`, 200 ms `--ease-out`; fine pointers only (`@media (hover: hover)`) | Shadow change only, no movement |
| M5 | Reveal rise | Section intros, cards, plan cards (not body paragraphs) | `opacity 0 to 1`, `translateY 16 to 0`, 600 ms `--ease-out`, 70 ms stagger within a group, once, triggered at 85 percent of the viewport | Visible at frame 0 |
| M6 | Connector draw | A5 connector path | `stroke-dashoffset` from path length to 0, scrubbed by scroll across the gap between two panels; the next panel's UI card rises (M5) as the line reaches it | Path fully drawn |
| M7 | Gradient drift | A10 closing glow, A7 dark card, A5 gradient panels | The gradient layer translates up to 4 percent and rotates up to 3 degrees, 48 s `alternate infinite` `--ease-in-out`; at most two drifting fields per viewport | Static |
| M8 | Toggle slide | Segmented toggles | Active pill `translateX`, 280 ms `--ease-out`; swapped copy cross-fades 200 ms | Instant swap |
| M9 | Accordion | FAQ `<details>` | Answer height via `grid-template-rows: 0fr to 1fr`, 280 ms `--ease-out`; icon plus rotates to minus, 200 ms | Instant |
| M10 | Marquee | Not used by default (see A2). If the owner adds more than five commitment items, the strip becomes a marquee: 40 s per loop, edge masks 120 px, pauses on hover and focus | Static wrapped list |
| M11 | Nav state | Nav background and border appear after 24 px of scroll | 200 ms colour and opacity | Instant |
| M12 | Approve stamp | Spotlight floating card on Approve | The signature line writes in (clip-path reveal, 500 ms), card swaps its label; the connector line below the card draws from this moment (Kairos's one story beat kept from the Ledger) | Final state, announced by the live region |

Rules: no springs or overshoot; nothing autoplaying longer than 5 s carries information (floats and drifts are decorative, and the footer Motion control pauses them, satisfying WCAG 2.2.2); at most two looping groups visible at once; transform and opacity only, so motion never triggers layout. This deliberately relaxes the dark spec's "every motion ends" principle for M1 and M7; the owner's references depend on ambient float and drift (section 10, decision D4).

---

## 9. Mapping to the Drop 1 build

The Drop 1 components in `web/components/landing/` are mostly reusable inside the new frame; the frame and skin change, not the logic.

| Drop 1 piece | New home | Change |
| --- | --- | --- |
| `entries/entry-00-hero.tsx`, `islands/entry-poster.tsx` | A1 hero | Replace receipt lane and poster with the painting and two floating cards |
| `entries/entry-01-reported.tsx`, `islands/settle-cell.tsx` | A3 problem trio | Five rows become three cards plus the open-row line; settle cells retire unless the owner keeps the debit metaphor |
| `islands/sample-run.tsx` | A5 step 1 UI card | Restyle as a C3 card inside a painted panel; show 4 to 6 rows, not 48 |
| `islands/citation-demo.tsx` | A5 step 2 UI card plus floating refusal chip | Light skin |
| `islands/approve-sample.tsx`, `islands/approved-line.tsx` | A6 spotlight mock and floating card | Light skin; M12 |
| `islands/receipt-slot.tsx`, `islands/lane-receipt.tsx` | A5 step 3 UI card | Receipt shown as a white card, no mint band, no tear |
| `entries/entry-06-replies.tsx` | A5 step 4 | Text column plus a small inbox card |
| `islands/billing-plans.tsx`, `islands/odometer.tsx` | A8 pricing | C6 cards, segmented toggle with gradient ring |
| `entries/entry-08-compare.tsx` | A9 compare variant | 1 : 2 frame |
| `entries/entry-09-questions.tsx` | A9 FAQ | Same `<details>`, new row style |
| `entries/entry-10-start.tsx` | A10 closing | Serif line over dusk glow |
| `entries/colophon.tsx`, `islands/motion-toggle.tsx`, `islands/motion-preference.tsx` | A11 footer | Keep the Motion control in the legal row; drop the clock |
| `islands/ledger-rail.tsx`, `islands/receipt-tape.tsx`, `islands/lime-custody.tsx`, `marks/entry-rule.tsx`, `marks/perforation.tsx` | Retired | Not part of the reference structure |
| `marks/chip.tsx`, `marks/sample-frame.tsx` | Sample chip, C3 card | Light skin; dashed edge removed |

---

## 10. Decisions for the owner

| # | Decision | Proposed |
| --- | --- | --- |
| D1 | This system replaces the dark phosphor look for the landing only (the app keeps its own tokens) | Yes; the landing tokens live under `.lp` as before |
| D2 | Drop the WebGL receipt slip, ledger rail, Mint band and lime custody | Yes: none appears in any reference, and the Approve moment survives as the spotlight (A6) and the connector line passing through it |
| D3 | Raster art returns to the page (README budget said 0 images). The hero painting will likely become the LCP element | Accept; revise LCP budget to 2.0 s desktop and 2.5 s mobile, with a preloaded 110 KB AVIF and a gradient placeholder |
| D4 | Ambient loops (float, drift) relax "every motion ends" | Accept with the limits in section 8 and the footer Motion control |
| D5 | Serif face: Instrument Serif or Fraunces | Instrument Serif |
| D6 | Painting source: commissioned illustrator or AI-assisted with paint-over | Commission if budget allows; either way record rights in the repo |
| D7 | Accent word in the hero H1 (AGNCE) | Off by default; ember on line 2 if wanted |
| D8 | Hero status pill wording and the primary action (waitlist or start) | Owned by 06; must be true on launch day |
| D9 | Footer social row | Only if real accounts exist; otherwise omitted |
| D10 | Legal entity name in the copyright | Owner to confirm |

## 11. Do not copy (consolidated)

From all four teardowns: customer logo strips and "leaders are using" lines; "Trusted by", "Backed by" and avatar-stack pills; user counts and "500+" or "thousands" claims; fabricated metrics on floating cards (every number shown must be true by construction or labelled sample); photo avatars with names that read as real users; "Request access" scarcity and "Book a demo" language; free-trial claims; "50+ integrations" icons; nav, footer and social links to pages or accounts that do not exist; template copyright names and third-party studio credits; low-contrast grey body text; a recognisable studio art style; and the references' exact palettes and wordmarks. Borrow the method, not the identity.
