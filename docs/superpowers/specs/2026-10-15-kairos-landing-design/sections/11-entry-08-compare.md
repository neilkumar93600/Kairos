# Entry 08: Compared with typical auto-apply (`entry-08-compare`)

Section spec for the Kairos landing page. Tier: standard. Route: `/`, inside the `(landing)` route group and the `.lp` scope.

Sources used: `01-creative-direction.md` (CD), `02-design-system.md` (DS), `03-motion-system.md` (MS), `04-webgl-scene.md` (WS), `05-architecture.md` (AR), `06-copy-deck.md` (COPY). Section references such as "MS 3.3" point into those files. Where this spec departs from or adds to a sibling document, the departure is listed in section 2.3 (copy) or section 10.5 (system changes) so that the owners of those documents can accept or reject it.

---

## 1. Purpose and narrative beat

**Job of the section.** Contrast mechanisms with complaints people report about auto-apply tools in general, without naming a product and without comparing prices. It is the one place on the page where Kairos is set next to "everyone else", so it is also the place where an overstatement would cost the most trust. Every left-hand cell is therefore a reported complaint (never a claim about a specific product), and every right-hand cell is a mechanism that another entry demonstrates.

**Beat.** "Fair contrast: what people report, and what Kairos does instead." The page is a ledger. In entry 01 five reported problems were posted as open rows. Entry 08 is the reconciliation sheet: a five-row table, ruled line by line, that names the complaint and the mechanism side by side. Entry 08 settles nothing in the ledger and prints no receipt line. Its job is to let a skimming visitor see the whole argument on one screen, and to hand a sceptical visitor a link ("see 02", "see 03") to the proof.

**Signature moment (calm, exact, memorable).** The table is ruled by hand as you read it. Each row's top rule draws left to right in 600ms with the page's post curve, row after row from the top, 90ms apart. As each rule's leading edge crosses into the Kairos column, the Kairos cell inks from Sage 60 to Phosphor White. The reported complaint stays quiet; the mechanism comes up. This rhymes with the hero H1 ("Job applications you would sign." inks from Sage 60 to Phosphor White) and with every entry head (the rule draws, then stops). Nothing loops, nothing overshoots, the text is readable on every frame, and the sequence is over in about 0.8 to 1.05 seconds.

**Why it earns its place.** It is the only section whose motion is the argument: the page does its ruling in front of you, and the thing that lights up is the part that is Kairos.

| Property | Value |
| --- | --- |
| Entry number | 08 (tick 08 of 00 to 10 is the bright 8px tick in the head) |
| Section id / anchor | `data-section="entry-08-compare"`, element `id="entry-08"`, heading `id="entry-08-title"` |
| Scene state | `none` (`data-scene="none"`) |
| Scroll length | Target 80vh. Measured composition at 1440 by 900: about 746px of content (83vh) plus the 128px section pad, 874px (97vh) in total (deviation D-08-1) |
| Pin | None |
| Ledger effect | `ledgerStore.post("08")` only (rail and caption progress). No settle, no receipt line |

---

## 2. Content (final copy from 06-copy-deck.md, verbatim; flag any change you need and why)

### 2.1 Strings, as they must render

Keys are `landingCopy["entry-08-compare"].*` (COPY section 13). All text is server-rendered.

| Key | Element | Rendered text | Notes |
| --- | --- | --- | --- |
| `number` | M1 entry number | 08 | Real text, tabular, slashed zero |
| `eyebrow` | Eyebrow (Caption, uppercase) | Side by side | Uppercase by CSS only; the source string stays "Side by side" |
| `h2` | `<h2 id="entry-08-title">` | How it compares with typical auto-apply. | 40 characters. Expected wrap at 1440, 1024 and 390: "How it compares with / typical auto-apply." (COPY 19) |
| `caption` | `<table><caption>` | **Changed, see C1.** Deck text: "Left column: problems people report about auto-apply tools in general. We do not name products, and we do not compare prices here." Required text: "The reported problems are about auto-apply tools in general. We do not name products, and we do not compare prices here." | Visible, not hidden. 120 characters after the change |
| `headers[0]` | `<th scope="col">` | Topic | |
| `headers[1]` | `<th scope="col">` | What people report | |
| `headers[2]` | `<th scope="col">` | Kairos | |
| `mobileLabels[0]` | Label above the reported cell below 768px | People report | `aria-hidden` |
| `mobileLabels[1]` | Label above the Kairos cell below 768px | Kairos | `aria-hidden` |
| `rows[0].topic` | `<th scope="row">` | Which jobs get applications | |
| `rows[0].reported` | `<td>` | Matches that do not fit | |
| `rows[0].kairos` | `<td>` | Only jobs that pass your hard rules and fit bar, with a written reason for each skip | Followed by claim chip `see 02` |
| `rows[1].topic` | `<th scope="row">` | Resume changes | |
| `rows[1].reported` | `<td>` | Skills and metrics the person does not have | |
| `rows[1].kairos` | `<td>` | Each line cites a fact you confirmed | Followed by claim chip `see 03` |
| `rows[2].topic` | `<th scope="row">` | Before it sends | |
| `rows[2].reported` | `<td>` | A review step without an edit step | |
| `rows[2].kairos` | `<td>` | Edit every field and line, then approve one or a batch | No chip (see O1) |
| `rows[3].topic` | `<th scope="row">` | Replies | |
| `rows[3].reported` | `<td>` | Broad Gmail access | |
| `rows[3].kairos` | `<td>` | A forwarding address you control. No Gmail access | No chip (see O1) |
| `rows[4].topic` | `<th scope="row">` | What you pay for | |
| `rows[4].reported` | `<td>` | Charges after cancelling, and lost credits | |
| `rows[4].kairos` | `<td>` | One credit per submitted application. Failed submits cost nothing. Cancel from the Stripe portal any time | No chip (see O1) |

Claim chips (M5): visible text `see 02` and `see 03`. Link targets `#entry-02` and `#entry-03`. Accessible names are built from `shared.claimChipName` with the titles in `ledger-rail.entries` (02 Fit gate, 03 Truth lock); see C2 for the required output.

Copy rules that apply: no em dashes, no hype words, no product names, no price comparison, no invented number. The only figures in this section are the two chip numbers, which are entry numbers. There are no outcome claims about other tools: the left column is phrased as what people report.

### 2.2 Alternates not used

`h2Alt` ("What people report, and what Kairos does instead.") is not used. Reason: the eyebrow plus the "What people report" column header already say it, and the KEEP title is the one the facts file approved (facts 5.4).

### 2.3 Changes I need, and why

| # | Change | Why |
| --- | --- | --- |
| C1 | Replace the first sentence of `entry-08-compare.caption`. From "Left column: problems people report about auto-apply tools in general." To "The reported problems are about auto-apply tools in general." | The table has three columns and the leftmost is "Topic", so "Left column" is wrong. Below 768px there are no columns at all, so any positional wording breaks. The replacement keeps the meaning (reports, general, no product) and is 11 characters shorter. The second sentence is unchanged, as the brief for this section requires. Needs an edit in COPY section 13, in CD section 5.3 and in the claims lint list |
| C2 | `shared.claimChipName` must produce "See 02, Fit gate" (and "See 03, Truth lock"), not "See entry 02, Fit gate". Template: "See {NN}, {title}" | WCAG 2.5.3 (Label in Name, level A): the accessible name must contain the visible label "see 02". "See entry 02" does not contain it, so a voice-control user who says "click see 02" fails. This is a shared key used by all six chips, so the change must be made once in COPY section 18 and in CD M5. If the owners refuse, the visible chip text must become "see entry 02" instead; do not ship the mismatch |

### 2.4 Observations that need a product-owner decision (no change made)

| # | Observation |
| --- | --- |
| O1 | Rows 2, 3 and 4 each have a demonstration (entries 04, 06 and 07) but carry no claim chip, because CD 10.6 fixes the chips at six and `claims.test.ts` counts six. This spec builds exactly two chips. Adding three more would change the footer's claim count and the register. |
| O2 | Entry 01 says "Five things people report" and posts five rows. This table lists five reported items, but "Broad Gmail access" (row 3) is not one of entry 01's five, and entry 01's "Hundreds of applications and zero interviews" is deliberately absent here (it stays open). A close reader may notice that the two lists differ. It is accurate (facts 5.4, PRD problem 5) and the eyebrow on entry 01 says "Not measured by us", so no change is made. If the owners want the lists to match, replace row 3's left cell, not the right. |

---

## 3. Layout structure: desktop 1440 and 1280, laptop 1024, tablet 768, mobile 360 to 640

The section is outside the receipt lane (`data-story` ends at entry 06), so it uses the full 12, 8 or 4 column grid with no lane reserved.

### 3.1 Container and rhythm

| Property | Value | Source |
| --- | --- | --- |
| Container | `.lp-container`, max 1280px, side margin 32px at 1024 and wider, 24px at 768 to 1023, 16px below 768 | DS 4.1 |
| Grid | 12 columns at 1024+ (gap 32), 8 columns at 640 to 1023 (gap 20 at 640 to 767, 24 at 768+), 4 columns below 640 (gap 16) | DS 4.1 |
| Section padding | Top 0 (previous entry's pad is the gap). Bottom `var(--section-pad-landing)`: 128px at 1024+, 96px at 768 to 1023, 80px below | DS 4.2 |
| `scroll-margin-top` | 80px at 1024+, 128px below (navbar 64 + tape 48 + 16) | DS 4.2, MS 5.6 |
| Section background | None (page Void `#000000`). No panel, no card, no fill | DS 5.1 |

### 3.2 Vertical stack (all widths)

| Order | Element | Gap above, 1024 and wider | Gap above, below 1024 |
| --- | --- | --- | --- |
| 1 | Entry head (M1: number plus graticule rule), 32px tall | 0 | 0 |
| 2 | Eyebrow (Caption) | 40 | 32 |
| 3 | H2 (`.lp-heading`) | 16 | 12 |
| 4 | Table caption (Body) | 24 | 20 |
| 5 | Table | 48 | 32 |

### 3.3 Desktop, 1440 and 1280 (identical: the container is 1280 at both)

Content width 1216px, columns 72px, gap 32px.

| Element | Columns | Width | Notes |
| --- | --- | --- | --- |
| Head, eyebrow, H2 | 1 to 7 | 696px | H2 `max-width: var(--measure-title)` (14em, about 780px at 56px) is wider than the span, so the span governs |
| Caption | 1 to 7, `max-width: var(--measure-body)` (34rem = 544px) | 544px | `text-align: left` is mandatory (the browser default for `<caption>` is centred) |
| Table | 1 to 12 | 1216px | `table-layout: fixed; width: 100%; border-collapse: collapse` |
| Column "Topic" | width 25% | 304px, text 272px | Cell padding `20px 32px 20px 0` |
| Column "What people report" | width 33.333% | 405px, text 373px | Same padding |
| Column "Kairos" | width 41.667% | 507px, text 507px | Right padding 0 |

Expected line counts at 1280 and wider: row 0 Kairos two lines (84 characters plus chip), row 1 one line plus chip, row 2 one line, row 3 one line, row 4 two lines. Reported cells are one line each. Row heights: 88, 64, 64, 64, 88px, header 40px. Table height 408px. These counts are expectations from Inter 16px at about 7.7px per character; verify at design lock (G-visual).

Measured content height at 1440 by 900: head 32 + 40 + eyebrow 16 + 16 + H2 114 (two lines at 55.7px by 1.02) + 24 + caption 48 (two lines) + 48 + table 408 = 746px. Plus the 128px pad = 874px, 97vh at 900. The CD target of 80vh is therefore exceeded by about 17vh; this is acceptable because the section has no pin and no scene, and it is reported as deviation D-08-1 in section 10.5.

Wireframe, 1440 by 900 (not to scale vertically; `#` marks the ticks, `[=]` the current tick):

```
|<----------------------------- 1280 container, 32px margins ------------------------------>|
 08  |----#----#----#----#----#----#----#----#--[=]--#----#--|        M1 head, 32px, rule draws
                                                                      (40)
 SIDE BY SIDE                                                         Caption, uppercase, Moss 70
                                                                      (16)
 How it compares with                                                 H2, 56px, cols 1-7
 typical auto-apply.
                                                                      (24)
 The reported problems are about auto-apply tools in                  <caption>, Body, Sage 60
 general. We do not name products, and we do not                      max 544px, left aligned
 compare prices here.
                                                                      (48)
 TOPIC               WHAT PEOPLE REPORT         KAIROS                thead, Caption (Sage 40;
                                                                      Kairos in Phosphor White)
 ---------------------------------------------------------------   <- rule 0 (draws, 600ms)
 Which jobs get      Matches that do not fit    Only jobs that pass your hard rules and
 applications                                   fit bar, with a written reason for each
                                                skip [see 02]
 ---------------------------------------------------------------   <- rule 1 (+90ms)
 Resume changes      Skills and metrics the     Each line cites a fact you confirmed [see 03]
                     person does not have
 ---------------------------------------------------------------   <- rule 2 (+180ms)
 Before it sends     A review step without      Edit every field and line, then approve one
                     an edit step               or a batch
 ---------------------------------------------------------------   <- rule 3 (+270ms)
 Replies             Broad Gmail access         A forwarding address you control. No Gmail access
 ---------------------------------------------------------------   <- rule 4 (+360ms)
 What you pay for    Charges after cancelling,  One credit per submitted application. Failed
                     and lost credits           submits cost nothing. Cancel from the Stripe
                                                portal any time
                                                                      (128 section pad)
 |<-- 304 --------->|<-- 405 ----------->|<-- 507 ------------->|
```

(In the wireframe the header words are shown uppercase for legibility. They are Caption style, which is not uppercase for table headers; see 4.2.)

### 3.4 Laptop, 1024 to 1279

12 columns, gap 32, margin 32, content 960 to 1215. Same structure and the same percentages, so the proportions hold.

| Element | Width at 1024 | Notes |
| --- | --- | --- |
| Head, eyebrow, H2, caption | Columns 1 to 7: 547px | H2 is 46.5px at 1024 (DS 3.2); caption 544px max |
| Table | 960px | Columns 240 / 320 / 400px; text widths 208 / 288 / 400px |
| Row heights | 64 to 112px | Kairos cells wrap to 2 or 3 lines (about 52 characters per line) |

The rail is hidden below 1280. The navbar shows the caption "08 / 10" from 1024 to 1279.

### 3.5 Tablet, 768 to 1023

8 columns, margin 24, gap 24, content 720 to 975. The table keeps three columns.

| Element | Width at 768 | Notes |
| --- | --- | --- |
| Head, eyebrow, H2, caption | Columns 1 to 8 (full): 720px | H2 40.9px at 768; caption max 544px |
| Column widths | 22% / 34% / 44% = 158 / 245 / 317px | Set by `col` classes inside `@media (min-width: 768px) and (max-width: 1023px)` |
| Cell padding | `20px 24px 20px 0`, last column right padding 0 | |
| Text widths | 134 / 221 / 317px | Topic wraps to two lines where needed; Kairos wraps to two or three lines |
| Section pad | 96px | |

No cell may overflow. Words that cannot break (the longest is "auto-apply" and "applications") are narrower than the narrowest text width (134px at 14px weight 500), so no `overflow-wrap` rescue is needed, but `overflow-wrap: break-word` stays on from `.lp`.

### 3.6 Mobile, 360 to 767 (stacked pairs, no horizontal scroll)

4 columns below 640 (gap 16, margin 16, content 328 at 360), 8 columns from 640 to 767 (content 608 to 735). The table is displayed as blocks; each row becomes one stacked group.

Per-row structure, top to bottom:

| Order | Element | Style | Spacing |
| --- | --- | --- | --- |
| 1 | Row rule (the posted rule) | 1px Circuit Border, full container width | At the very top of the row |
| 2 | Topic (`th scope="row"`) | Small 14px/20, weight 500, Moss 80 | 24px above (inside the row), 12px below |
| 3 | Label "People report" | Caption 12px/16, weight 500, +0.6px, Moss 70, not uppercase | 4px below |
| 4 | Reported text | Body 16px/24, Sage 60 | 16px below |
| 5 | Label "Kairos" | Caption, Moss 70 | 4px below |
| 6 | Kairos text plus chip | Body 16px/24, Phosphor White | 24px below (row bottom padding) |

Text blocks are capped at `max-width: var(--measure-body)` (544px) so a 735px-wide phone-landscape row does not run long lines. The table header row is removed visually (see section 8). The caption sits above, as on desktop.

Wireframe, 360 by 800:

```
|<------------ 328 content, 16px margins ------------>|
 08 |--#--#--#--#--#--#--#--#-[=]-#--#--|                M1 head (ticks 24-30px apart)
                                                         (32)
 SIDE BY SIDE
                                                         (12)
 How it compares with                                    H2 36px, 2 lines
 typical auto-apply.
                                                         (20)
 The reported problems are about auto-apply tools in
 general. We do not name products, and we do not
 compare prices here.                                    <caption>, 3 lines
                                                         (32)
 ------------------------------------------------------  <- rule 0
 Which jobs get applications                             Topic, 14px 500, Moss 80
 People report                                           Caption label
 Matches that do not fit                                 Sage 60
 Kairos                                                  Caption label
 Only jobs that pass your hard rules and fit bar,
 with a written reason for each skip [see 02]            Phosphor White
 ------------------------------------------------------  <- rule 1
 Resume changes
 People report
 Skills and metrics the person does not have
 Kairos
 Each line cites a fact you confirmed [see 03]
 ------------------------------------------------------
 ... three more rows ...
```

Estimated row height at 360: 24 + 20 + 12 + 16 + 4 + 24 to 48 + 16 + 16 + 4 + 24 to 72 + 24 = 184 to 240px. Five rows: about 1,050px. Section: about 1,480px plus 80px pad, about 2.3 viewports at 667px high. This is longer than the 80vh target by design; stacking costs height and no horizontal scroll is the requirement.

### 3.7 Breakpoint summary

| Width | Table form | Header row | Column widths | Rows' rule width |
| --- | --- | --- | --- | --- |
| 1024 and wider | 3 columns | Visible | 25 / 33.3 / 41.7% | Container width |
| 768 to 1023 | 3 columns | Visible | 22 / 34 / 44% | Container width |
| Below 768 | Stacked pairs | Visually hidden, still in the accessibility tree | n/a | Container width |

The breakpoint is `768px` exactly, written as `@media (max-width: 767.98px)` for the stacked form and `@media (min-width: 768px)` for the table form, so the two never both apply.

---

## 4. Visual design: tokens, type roles, surfaces, borders, motif usage, and the lime element

### 4.1 Surfaces and colour

| Item | Value | Token |
| --- | --- | --- |
| Page and section | Void `#000000` | `--background` |
| Table, cells, caption | Transparent on Void. No fill, no zebra, no card, no panel, no shadow | DS 5.1, 6.11 |
| Row rule | 1px Circuit Border `#485346` | `--border` |
| Head rule and ticks | As M1: 1px Phosphor Blue-Black `#1f2a33`, ticks Circuit Border 4px, current tick Phosphor White 8px | DS 6.1 |
| Chip border | 1px Fern Link `#859984` | `--chip-link-border` |
| Focus ring | 2px solid Phosphor White `#ddffdc`, 2px offset | `--foreground` |

No status colour is used. The reported cells are not red, struck through or dimmed below Sage 60: status colours are for status words only, and a complaint is not a status.

### 4.2 Type roles

| Element | Role (class) | Face and weight | Size / line height | Tracking | Colour (token) |
| --- | --- | --- | --- | --- | --- |
| Eyebrow | `.lp-caption` | Inter 500 | 12 / 16 | +0.6px, uppercase | Moss 70 `#9cbf93` (`--label`) |
| H2 | `.lp-heading` | Inter Tight 400, `ss01` | `--type-heading-landing` (36 to 56px; 40.9 at 768, 46.5 at 1024, 52.2 at 1280, 55.7 at 1440) / 1.02 | -0.02em | Phosphor White (`--foreground`) |
| Caption (table) | `.lp-body` | Inter 400 | 16 / 24 | -0.022em | Sage 60 `#8cab87` (`--body`) |
| Table header cells | `.lp-caption` | Inter 500 | 12 / 16 | +0.6px, not uppercase | Sage 40 `#677d64` (`--muted`) for "Topic" and "What people report"; Phosphor White for "Kairos" |
| Topic (`th scope="row"`) | `.lp-small` | Inter 500 | 14 / 20 | -0.026em | Moss 80 `#aed2a4` (`--lead`) |
| Reported cell | `.lp-body` | Inter 400 | 16 / 24 | -0.022em | Sage 60 (`--body`) |
| Kairos cell (final state) | `.lp-body` | Inter 400 | 16 / 24 | -0.022em | Phosphor White (`--foreground`) |
| Mobile labels | `.lp-caption` | Inter 500 | 12 / 16 | +0.6px, not uppercase | Moss 70 |
| Claim chip | `.lp-chip.lp-chip--claim` | Inter 500 | 12 / 16, 24px tall pill | +0.6px | Phosphor White |

Weights are 400 and 500 only. All numerals use `tabular-nums slashed-zero` (inherited from `.lp`). Body text is left-aligned everywhere; no numeric column exists here, so nothing is right-aligned. `text-wrap: balance` on the H2, `text-wrap: pretty` on the caption and cells.

### 4.3 Borders, radii, elevation

Hairline row rules only (no vertical rules, no outer border). Radius: chips 9999px, everything else 0 (no boxed elements). No elevation. No hover fill on rows: rows are not interactive (DS 6.13 and MS 6.1: cards and static rows have no hover).

### 4.4 Motif usage

| Mark | Use in this section |
| --- | --- |
| M1 entry head | Yes. Number 08, rule with 11 ticks, tick 08 bright. Owned by the entry shell |
| M2 the post | Yes, twice: the head rule (entry-level) and the five row rules (this section, `en-compare-post`) |
| M3 posting square | Not used. A square must sit beside a status word (settled, kept, posted); this section has none |
| M4 citation chip | Not used |
| M5 claim chip | Two: `see 02` in row 0, `see 03` in row 1 |
| M6 sample mark | Not used. The table is not a demo, takes no input and shows no sample data. A dashed edge here would wrongly say "not real yet" |
| M7 perforation | Not used (only the receipt, the mint band edges and the footer rule carry it) |
| M8 numerals | The chip ids and the head number only |
| M9 kairos stamp | Not used |
| M10 lime custody | Not a candidate (section 4.5) |

### 4.5 Lime in this viewport

None. This section contains no lime element and no `data-lime-candidate`. The navbar "Start free" owns lime for the whole of entry 08 (COPY 13, COPY 20), so each viewport that shows this section shows exactly one lime element, in the navbar. Claim chips are outlined (Fern Link border), never lime.

One transient case is allowed and does not break the rule: on a viewport taller than about 1,500px, the entry 07 "Choose Pro" button can still be in view while the entry 08 head is. Then `pro` owns lime and the navbar is in its Default style, as `LimeCustody` already decides (CD 3.3). Entry 08 takes no part in that logic.

### 4.6 New tokens or classes

| Name | Where | Why |
| --- | --- | --- |
| `--lp-compare-ink-delay: 100ms` | Declared on `.lp-compare` (inside `.lp`) only, never `:root` | At the table's proportions the rule's leading edge (ease-post, 600ms) reaches the Kairos column's left edge (58.3% of the table at 1024 and wider, 56% at 768) at about 97ms (computed from the cubic-bezier, section 6.2). The ink waits for it. A single local value is clearer than a global duration token. Set to `0ms` under `html[data-motion="reduced"]` |
| `.lp-compare`, `.lp-compare__rule`, `.lp-compare__label`, `.lp-compare__kairos`, `.lp-compare__topic` | `landing.css` | New `lp-` classes, reserved by DS 11.4's prefix rule. Please add them to DS 11.4 (change S-3 in section 10.5) |

No new colour, font, size or weight is introduced.

---

## 5. WebGL: scene state id(s), how each state is entered and left, DOM over canvas layering, and text contrast over the canvas

| Item | Value |
| --- | --- |
| Scene state id | `none` (`data-scene="none"`) |
| How `none` is entered | When entry 07's top crosses 70% of the viewport height scrolling down, `ex-canvas-out` runs (canvas wrapper opacity 1 to 0 over `--dur-handoff` 400ms, linear, then `visibility: hidden`). It is already finished before entry 08 arrives (entry 07 is 200vh long). Entry 08 does not trigger anything |
| How `none` is left | Scrolling down: entry 10's top crossing 85% runs `en-canvas-return` (WS: `slip-fresh`). Scrolling up: entry 07's top at 70% leaving back runs `en-canvas-return` for `slip-reply`. Entry 08 does not trigger either |
| Renderer state while here | Canvas `visibility: hidden`, no frames, GPU idle (MS 12.3, WS idle behaviour). `data-lane` does not exist in this part of the page |
| Layering | Nothing overlaps the canvas, because the canvas is hidden. The section sets no background and no `z-index` above `--lp-z-content`, so if the canvas ever returns while this section is on screen (a fast scroll-up from 10 to 06), it still sits behind the text as designed |
| Text contrast over the canvas | Not applicable: all text sits on Void. The pairings are in section 8.5 |
| Tier behaviour | Tier 0, 1 and 2 are identical here (no canvas, no DOM scene substitute) |

---

## 6. Animation choreography

### 6.1 Principles applied

- No section fade (A4): the section, caption, table header and cell text have no entrance.
- Only two things move: the head rule and title (entry-level, from the shell) and the five row rules (this section). Cell colour changes once (ink).
- Every move ends. No loop, spring or overshoot. Nothing reverses on scroll-up.
- Text is readable at frame 0 and at every frame (the ink starts from Sage 60, 8.29:1 on Void, and rises in luminance).
- Allowed properties only: `transform: scaleX` and `color` (MS 12.1).

### 6.2 (a) Entrance timeline

Time zero for the entry-level moves is the entry post (entry top crosses 85% of the viewport height, `ENTRY_START`). Time zero for the row moves is "row post": the moment a row's top edge crosses 85% of the viewport height (the same line, see 6.3). `k` is the row's index within the batch of rows that post in the same observer callback (0, 1, 2 ...), so rows that arrive together are 90ms apart and a row that arrives alone has `k = 0`.

| Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger | Preset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Head rule + tick 08 | `transform: scaleX`, origin left | 0 | 1 | 600ms (`--dur-post`) | 0 | `--ease-post` `cubic-bezier(0.22,1,0.36,1)` | Entry post | `en-post-rule` (shell) |
| Head ticks | `background-color` step (no tween) | transparent | Circuit Border / Phosphor White (current) | step | `calc(var(--i) * 60ms)` | none | Entry post | `en-post-rule` (shell) |
| H2 lines, 1024 and wider | `transform: translateY` inside masks | `115%` (`--rise-line`) | 0 | 700ms (`--dur-rise`) | 80ms + 70ms per line | `--ease-post` | Entry post | `kt-line-rise` |
| H2 whole title, below 1024 | `transform: translateY` | `115%` | 0 | 700ms | 80ms | `--ease-post` | Entry post | `kt-title-rise` |
| Eyebrow, caption, table header, topic and reported text | none | n/a | n/a | n/a | n/a | n/a | n/a | none (A4) |
| Row rule `i` (5 rules) | `transform: scaleX`, origin left | 0 | 1 | 600ms (`--dur-post`) | `calc(var(--k) * 90ms)` (`--stagger-compare`) | `--ease-post` | Row `i` post | `en-compare-post` |
| Kairos cell `i` text | `color` | Sage 60 `#8cab87` | Phosphor White `#ddffdc` | 360ms (`--dur-ink`) | `calc(var(--k) * 90ms) + 100ms` (`--lp-compare-ink-delay`) | `--ease-post` | Row `i` post | ink phase of `en-compare-post` (change M-1) |
| Claim chips | none | n/a | n/a | n/a | n/a | n/a | n/a | none; chips are present at frame 0 |
| Stacked rows below 768px | Same two moves per row | | | | | | | Same presets, same values |

Total length of the row sequence: the last of five rows in one batch ends rule at `4 * 90 + 600 = 960ms` and ink at `4 * 90 + 100 + 360 = 820ms`, so the sequence is over in 960ms. A single row alone takes 600ms. Both are far under the 4,500ms autoplay ceiling (MS 2.5, `MAX_AUTOPLAY_MS`).

Rule progress under `--ease-post` (computed from the bezier, y as a function of elapsed time within the rule):

| Elapsed (ms) | 0 | 62 | 79 | 97 | 144 | 225 | 390 | 600 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scaleX` | 0 | 0.41 | 0.50 | 0.58 | 0.75 | 0.90 | 0.99 | 1 |

The leading edge reaches the Kairos column (58.3% across) at about 97ms, which is where the 100ms ink delay comes from.

**Motion groups (MS 3.4).** The entry post (rule plus title lines) is one group. The row sequence (rules plus ink, however many rows) is one group. At most two groups run at once. Because a row reaches the 85% line at least 266px of scroll after the entry head, the two groups normally do not overlap at all; on a fast scroll they overlap as two, which is allowed. If the page already has two live groups when a row batch is about to start, the batch waits up to 300ms and then posts instantly (see 10.3, step 5).

### 6.3 Trigger and state machine (why rows post one at a time)

The CD says "rows post top to bottom". The table starts at least 266px below the entry head, so at the entry post it is still below the fold at every viewport up to about 1,350px high. Posting at the entry post would draw the rules unseen. MS 3.6 lists the trigger as "Entry 08 post"; this spec changes it to a per-row trigger (change M-1 in 10.5).

State is carried on each `<tr>` by `data-row-post`:

| Value | Meaning | Visual |
| --- | --- | --- |
| absent | Final state (no JavaScript, Reduced, or already posted and settled) | Rule `scaleX(1)`, Kairos text Phosphor White |
| `pending` | Below the post line at hydration | Rule `scaleX(0)`, Kairos text Sage 60 |
| `live` | Crossed the post line | Rule and ink transitioning to the final state |
| `instant` | In view or above at hydration, or flushed | Final state, transitions suppressed |

Rules:

1. At hydration, `ComparePoster` observes all five `<tr>` elements with one `IntersectionObserver`, `rootMargin: "0px 0px -15% 0px"`, `threshold: 0` (the same line as `ENTRY_START`).
2. First callback: a row whose bounding box intersects or lies above the viewport is left in its final state (no attribute, or `instant`). A row below the viewport gets `pending` and stays observed. Rows already in view never animate (MS 3.3).
3. Later callbacks: every newly intersecting row gets `--k` (its index among the rows that intersect in this callback, in DOM order) and becomes `live`, then is unobserved.
4. Monotonic: when entry 09 or later is posted in `ledgerStore`, or `section#entry-08` carries `data-post="instant"`, every remaining `pending` row becomes final at once (an anchor jump past the table, for example). Nothing stays hidden above the viewport.
5. After the last row has posted the observer disconnects.
6. A row that is `live` removes its `data-row-post` attribute on the `transitionend` of its rule (`propertyName === "transform"`), with a 1,200ms safety timeout, so the final state is the default again.
7. Scrolling up never reverses a row.

Hidden start states are applied by JavaScript only (never in server CSS), so a visitor with no JavaScript, or one whose script fails to load, sees a fully ruled table.

### 6.4 (b) Scroll-linked behaviour

There is none. This section has no scrubbed motion, no pin, no `scrub`, no snap and no GSAP. It uses CSS transitions plus one `IntersectionObserver`.

| Item | Value |
| --- | --- |
| ScrollTrigger | Only the shell's: `entry-08:title`, `start: "top 85%"`, `once: true`, `refreshPriority: 8` (title rise, 1024 and wider). No trigger is created for the table |
| Pin | None. Wrapper height equals content height |
| Scrub | None |
| Scene `u` | Not written (`data-scene="none"`) |
| Anchor / jump | A chip click is an anchor jump, handled by the delegated handler (MS 5.6): entries 02 and 03 are far more than two viewport heights above, so the jump is `immediate: true`; history gets `pushState`; focus moves to `#entry-02-title` or `#entry-03-title` |

Progress-to-value mapping (the only mapping is elapsed time after a row posts, because nothing is scrubbed):

| Row-local time after row post | Rule `scaleX` | Kairos text colour | State |
| --- | --- | --- | --- |
| 0ms (+ `k * 90ms` delay) | 0 | Sage 60 `#8cab87` | `live` begins |
| +97ms | 0.58 (edge at the Kairos column) | still Sage 60 (ink delay 100ms) | |
| +225ms | 0.90 | rising (about 35% of the way, linear in colour space) | |
| +390ms | 0.99 | about 80% of the way | |
| +460ms (100 + 360) | 1 (0.999+) | Phosphor White `#ddffdc` | ink done |
| +600ms | 1 | Phosphor White | rule done; `transitionend` clears the attribute |

### 6.5 (c) Micro-interactions

Only the two claim chips are interactive (MS 6.1, `mi-chip`). All hover rules sit in `@media (hover: hover) and (pointer: fine)`.

| State | Chip behaviour | Preset |
| --- | --- | --- |
| Rest | Transparent fill, 1px Fern Link border, Phosphor White text, no underline | `mi-chip` |
| Hover | Border to Phosphor White and text underlined (1px, 3px offset); `border-color` and `text-decoration-color` 300ms `--ease-utility` | `mi-chip` |
| Focus-visible | 2px solid Phosphor White outline, 2px offset; instant, never transitioned | `mi-focus` |
| Pressed (`:active`) | Colour holds at the hover value; no transform, no scale | `mi-chip` |
| Touch | No hover state is shown (hover rules are inside the media query); the 44px hit area gives the target | |
| Cursor | `cursor: pointer` on the chip; native cursor everywhere else | `mi-cursor` |

Rows, cells, the table and the caption have no hover, focus or press behaviour (static content; no row hover fill).

Hit area: the chip is visually 24px tall. A transparent `::before` with `inset: -10px 0` extends the hit area to 44px (A16) without changing layout. The two chips are in different rows at least 64px apart, so the 8px spacing rule is met by a wide margin.

### 6.6 (d) Hand-off to the next section

| From / to | What happens |
| --- | --- |
| Entry 07 into 08 | Entry 07's canvas fade-out has already finished. If "Choose Pro" owns lime when it leaves the viewport, lime goes pro to navbar (150ms out, 150ms in; `ho-lime`). Entry 08 reacts to neither |
| Within 08 | Entry post (head rule and title), then row posts as the table scrolls into view |
| Entry 08 into 09 | Nothing is retracted. Posted rows stay posted. Entry 09's own head rule draws when its top crosses 85% (128px of section pad after the table's last row). The visual rhyme is intentional: the table's last rule has just finished drawing, and 128px later another rule draws with the tick moved one place to 09. The navbar keeps lime. The rail and the "08 / 10" caption move to 09 in the same frame the shell updates `data-active-entry` |
| Scroll-up | Nothing reverses. If the visitor goes back up through the table, every rule stays drawn and every Kairos cell stays white |

---

## 7. Reduced-motion, no-JS and low-tier variants

| Context | Behaviour |
| --- | --- |
| Reduced (OS setting without a Full override, or the visitor chose Reduced) | `ComparePoster` does nothing: no `pending` state is ever applied. All five rules are drawn and all Kairos cells are Phosphor White from first paint. Title lines static (the shell). `--dur-post`, `--dur-ink`, `--stagger-compare` resolve to `0.01ms`/`0ms` as a second guard. Chip hover colour transition (300ms) is kept (colour is exempt, MS 10.1) |
| Switching to Reduced while rows are live | `ComparePoster` subscribes with `subscribeMotion`. On a change to Reduced it sets every `pending` and `live` row to its final state at once (the same effect as `completeAll()`), then disconnects |
| Switching back to Full | Nothing replays. Posted rows stay posted |
| No JavaScript | No `data-row-post` attribute ever exists, so the server CSS shows the final state: rules drawn, Kairos text white, chips present as plain links. The stacked pairs and the three-column table both work (they are CSS) |
| JavaScript fails after hydration | Rows left `pending` would be stuck at scaleX(0). Guard: `ComparePoster` wraps its observer setup in `try/catch` and, on any error, removes all `data-row-post` attributes |
| Tier 0, 1, 2 | Identical. No canvas dependency |
| `Save-Data` / slow CPU | Identical. The cost is five transforms and ten colour transitions |
| Forced colours (Windows High Contrast) | `@media (forced-colors: active) { .lp-compare__rule { background: CanvasText; } .lp-chip--claim { border-color: LinkText; } }`. System colours survive forced-colour mode where custom backgrounds do not, so the rules do not disappear |
| Print | Final state (no animation applies). Not a design target |
| Browser Back after a chip jump | Browser restores the previous scroll position for the pre-jump history entry; posted rows are still posted |

---

## 8. Accessibility

### 8.1 Landmark and heading structure

| Item | Value |
| --- | --- |
| Landmark | `<section id="entry-08" data-section="entry-08-compare" data-entry="08" data-scene="none" aria-labelledby="entry-08-title" class="lp-entry">` inside `<main id="main">` |
| Heading | One `<h2 id="entry-08-title" tabindex="-1" data-split="lines" class="lp-heading">`. The hero owns the only `<h1>`. There is no `<h3>`: topic labels are row headers, not headings |
| Table name | The `<caption>` is the table's accessible name |
| Navigation targets | `#entry-08` (rail, caption, search); the heading takes programmatic focus after a jump (MS 5.6). The rail link is "Entry 08, Compare" |

### 8.2 Table semantics

```html
<div class="lp-compare" data-compare>             <!-- container-type: inline-size -->
  <table role="table">
    <caption>The reported problems are about auto-apply tools in general. We do not name products, and we do not compare prices here.</caption>
    <colgroup><col class="lp-compare__col-topic"><col class="lp-compare__col-report"><col class="lp-compare__col-kairos"></colgroup>
    <thead role="rowgroup"><tr role="row">
      <th role="columnheader" scope="col">Topic</th>
      <th role="columnheader" scope="col">What people report</th>
      <th role="columnheader" scope="col">Kairos</th>
    </tr></thead>
    <tbody role="rowgroup">
      <tr role="row" data-row>
        <th role="rowheader" scope="row" class="lp-compare__topic"><span class="lp-compare__rule" aria-hidden="true"></span>Which jobs get applications</th>
        <td role="cell" data-label>
          <span class="lp-compare__label" aria-hidden="true">People report</span>Matches that do not fit
        </td>
        <td role="cell" class="lp-compare__kairos" data-claim="entry-08-compare.rows[0]">
          <span class="lp-compare__label" aria-hidden="true">Kairos</span>Only jobs that pass your hard rules and fit bar, with a written <span class="whitespace-nowrap">reason for each skip&nbsp;<a class="lp-chip lp-chip--claim" href="#entry-02" aria-label="See 02, Fit gate">see 02</a></span>
        </td>
      </tr>
      <!-- rows 1 to 4 follow the same pattern; only rows 0 and 1 carry data-claim and a chip -->
    </tbody>
  </table>
</div>
```

- Real `<table>`, `<thead>`, `<tbody>`, `<th scope>` on every header cell. Row headers are the topics.
- **Explicit ARIA roles are added on purpose.** Below 768px the table parts become `display: block`. Safari with VoiceOver, and some older Chromium builds, drop table semantics when `display` is changed. The explicit roles restore them. They are redundant on desktop and harmless; the lint rule `no-redundant-roles` must be disabled on these lines with a comment explaining this.
- The header row stays in the accessibility tree below 768px. It is hidden visually with the standard visually-hidden pattern (`position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap`), never `display: none`.
- The mobile labels ("People report", "Kairos") are `aria-hidden="true"`, because the column headers already name each cell for screen readers. Their `display` is `none` at 768px and wider.
- The row rules are `aria-hidden="true"` and empty.
- The last word before each chip and the chip are wrapped together in `white-space: nowrap` so the chip never sits alone on a new line.

### 8.3 Focus order and keyboard

| Order | Stop |
| --- | --- |
| 1 | (Previous entry's controls) |
| 2 | Chip `see 02` in row 0 |
| 3 | Chip `see 03` in row 1 |
| 4 | (Entry 09 FAQ summaries) |

The table, rows and cells are not focusable (`tabindex` is never set on them). Tab order equals visual order at every width because the DOM order is topic, reported, Kairos in both layouts. Enter activates a chip. Focus after an anchor jump lands on the target heading, not on the chip. Focus rings are never clipped: the chip sits inside a `td` with no `overflow` set, and the 2px outline plus 2px offset is within the 8px gutter.

### 8.4 Screen-reader text

| Visual | Non-visual equivalent |
| --- | --- |
| Rules and ticks | `aria-hidden`; nothing announced |
| Ink colour change | Nothing announced (no content change) |
| Chip `see 02` | Link named "See 02, Fit gate" (after C2). Visible text "see 02" is contained in the name |
| Stacked layout | Same reading order and the same header association as the table form |
| Table | Announced as "table, 3 columns, 5 rows" with the caption as its name (varies by screen reader) |

No live region is used. Posting is silent: it adds no content.

### 8.5 Contrast of every pairing (all on Void `#000000`; none is new)

Ratios are from DS section 9.1.

| ID | Foreground | Use here | Size | Required | Ratio | Result |
| --- | --- | --- | --- | --- | --- | --- |
| V1 | Phosphor White `#ddffdc` | H2, Kairos cells (final), chips, focus ring | 12 to 56 | 4.5 (3 large; 3 non-text) | 19.41 | Pass |
| V2 | Sage 60 `#8cab87` | Caption, reported cells, Kairos cells before the ink | 16 | 4.5 | 8.29 | Pass |
| V3 | Moss 70 `#9cbf93` | Eyebrow, mobile labels | 12 | 4.5 | 10.29 | Pass |
| V4 | Moss 80 `#aed2a4` | Topic cells | 14 | 4.5 | 12.55 | Pass |
| V5 | Sage 40 `#677d64` | Table header cells ("Topic", "What people report") | 12 | 4.5 | 4.69 | Pass, on Void only. Never move this table onto Ground Iron |
| V6 | Fern Link `#859984` | Chip border | n/a | 3 (non-text) | 6.89 | Pass |
| V8 | Circuit Border `#485346` | Row rules | n/a | decorative | 2.60 | Decor. No meaning rides on the rule: row boundaries are also carried by the cell structure and the 20px padding |
| V9 | Phosphor Blue-Black `#1f2a33` | Head rule | n/a | decorative | 1.44 | Decor |

**Ink in transit.** The colour moves monotonically from Sage 60 (8.29:1) to Phosphor White (19.41:1) in sRGB; luminance increases monotonically, so every intermediate frame is at least 8.29:1. No frame fails.

Other checks: target size (WCAG 2.5.8 / A16) met by the 44px chip hit area; reflow (1.4.10) met at 320 CSS px by the stacked form; text spacing (1.4.12) met because row heights are `auto`; no content depends on colour alone (the Kairos column is also labelled by its header or its mobile label); `prefers-reduced-motion` honoured (section 7).

---

## 9. Performance notes

| Item | Value |
| --- | --- |
| What animates | 5 row rules (`transform`) and up to 5 Kairos cells (`color`). Nothing else. No layout property, no filter, no `clip-path` |
| Concurrent animations | Up to 10 small transitions in one batch, lasting at most 960ms |
| Layers | The rules are 1px-tall elements. Up to 5 promoted layers of at most 1216 by 1px (about 5 KB each). `will-change` is not used on them: MS 12.2 caps simultaneous `will-change` at 4 and a 1px layer gains nothing. This is deviation D-08-2 |
| DOM size | About 60 elements: 1 wrapper, 1 table, 3 `col`, 4 header cells, 5 rows with 15 cells, 5 rules, 10 mobile labels, 2 chips |
| JavaScript | One island `ComparePoster`, renders `null`. Target 0.6 KB gzip or less inside the islands chunk (budget 20 KB). No GSAP, no SplitText for the table. The H2 uses the shell's existing title rise |
| Main-thread work | One `IntersectionObserver` with 5 targets and a callback of a few lines: far under 1ms. No `getBoundingClientRect` in a scroll handler |
| CSS | About 1.3 KB gzip added (layout 0.9, motion 0.4), within the 25 KB CSS budget |
| Assets | None. No image, icon, font file or SVG. (Fonts are the page's Inter and Inter Tight, already loaded) |
| CLS | 0. Transform and colour only; the hidden start state is applied only to rows below the fold; mobile labels switch by media query, not by script |
| LCP | Not affected. This section is far below the first viewport |
| INP | Chip activation only; the anchor handler is the shell's |
| Network | No requests |

---

## 10. Implementation

### 10.1 Files

| Path | Kind | Action |
| --- | --- | --- |
| `web/components/landing/entries/entry-08-compare.tsx` | Server component | New (AR 1.1 already lists it) |
| `web/components/landing/islands/compare-poster.tsx` | Client island | New. Renders `null` |
| `web/components/landing/landing.css` | CSS | Add the `.lp-compare*` layout rules (10.4) |
| `web/components/landing/motion.css` | CSS | Add the `en-compare-post` rules (10.4) |
| `web/content/landing-copy.ts` | Content | Add `landingCopy["entry-08-compare"]` with keys in section 2.1, with C1 applied |
| `web/content/claims.ts` | Content | Two entries: `entry-08-compare.rows[0]` (target `02`) and `entry-08-compare.rows[1]` (target `03`). The register stays at six claims in total |
| `web/components/landing/comparison.tsx` | Old component | **Delete.** It carries unverified claims about other tools ("Rewritten freely by AI", "Credits, even for failed submits", inventory finding C5) and a `min-w-[640px]` horizontal scroll |
| `web/lib/landing/sections.ts` | Existing | No change. The `ENTRIES` row for 08 already has `scene: null` |

### 10.2 Components and props

**`Entry08Compare`** (server). No props. Reads `landingCopy["entry-08-compare"]` and `landingCopy["ledger-rail"].entries`. Renders, inside the shared `Entry` shell (`entries/entry.tsx`: number, graticule rule, eyebrow, H2, children), the `.lp-compare` wrapper and table of section 8.2. The shell is told `entry="08"`, `section="entry-08-compare"`, `scene="none"`. The shell must accept arbitrary children after the H2 (this section has no body paragraph; the caption lives inside the table). Rows are rendered by mapping `rows`; the chip is rendered only when `row.claim` is defined.

```ts
type CompareRow = {
  topic: string;
  reported: string;
  kairos: string;
  claim?: { id: string; to: "02" | "03" };   // id is the claims.ts key; rendered as data-claim
};
```

**`ClaimChip`** (reused from `marks/chip.tsx`, server). Props used: `to` (entry number string, builds `href="#entry-" + to`, visible text `see ` + to, and the accessible name from `shared.claimChipName` and the `ledger-rail.entries` title). No new props.

**`ComparePoster`** (client). No props. Behaviour:

1. On mount, `const motion = getEffectiveMotion()`. If `"reduced"`, return without touching the DOM.
2. Query `[data-compare] tbody tr`. Create the observer (rootMargin `0px 0px -15% 0px`).
3. First callback: partition rows into "in view or above" (final, untouched) and "below" (set `data-row-post="pending"`, keep observing).
4. Later callbacks: sort intersecting entries by DOM order; for each set `--k` to its index in the batch, then set `data-row-post="live"` and `unobserve`. If two motion groups are already live (count elements matching `[data-post="live"], [data-row-post="live"]` outside this table, or ask the group registry of MS 3.4 if it exists), delay the batch by up to 300ms, then post it as `instant`.
5. On `transitionend` of a rule (`propertyName === "transform"`), remove the row's `data-row-post`. A 1,200ms timeout removes it regardless.
6. Subscribe to the ledger (`useLedger` selecting `posted`, or `ledgerStore` subscription): when entry `09` or higher is in `posted`, or `#entry-08[data-post="instant"]`, set every remaining `pending` row to final and disconnect.
7. `subscribeMotion`: on a change to `"reduced"`, do the same flush. Return the unsubscribe function.
8. Cleanup on unmount: `observer.disconnect()`, unsubscribe, clear timeouts, remove every `data-row-post` it set (so Activity re-creation starts from a clean DOM and the final state).
9. The whole setup is in `try/catch`; on error remove every `data-row-post` and return.

The component is mounted once in `Entry08Compare`, as a sibling after the table wrapper.

### 10.3 Server and client split

| Part | Rendering |
| --- | --- |
| Section, shell, H2, caption, table, rules, labels, chips | Server. Fully present in the prerendered HTML (the final state) |
| `ComparePoster` | Client, `"use client"`, no props, no initial render output, no hydration mismatch possible |
| Lenis / GSAP | Not used by this section |

### 10.4 CSS contract

```css
/* landing.css (layout) */
.lp-compare { container-type: inline-size; --lp-compare-ink-delay: 100ms; }
.lp-compare table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.lp-compare caption { caption-side: top; text-align: left; max-width: var(--measure-body);
  padding-bottom: 48px; font: 400 var(--type-body-landing)/1.5 var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  letter-spacing: -0.022em; color: var(--body); text-wrap: pretty; }
.lp-compare__col-topic  { width: 25%; }
.lp-compare__col-report { width: 33.333%; }
.lp-compare__col-kairos { width: 41.667%; }
.lp-compare th, .lp-compare td { vertical-align: baseline; text-align: left; font-weight: 400; }
.lp-compare thead th { font: 500 12px/16px var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.6px; color: var(--muted); padding: 0 var(--lp-gap) 12px 0; }
.lp-compare thead th:last-child { color: var(--foreground); padding-right: 0; }
.lp-compare tbody th, .lp-compare tbody td { position: relative; padding: 20px var(--lp-gap) 20px 0; }
.lp-compare tbody td:last-child { padding-right: 0; color: var(--foreground); }
.lp-compare__topic { font: 500 14px/20px var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  letter-spacing: -0.026em; color: var(--lead); }
.lp-compare__rule { position: absolute; top: 0; left: 0; width: 100cqw; height: 1px;
  background: var(--border); transform-origin: left; pointer-events: none; }
.lp-compare__label { display: none; }
@media (min-width: 768px) and (max-width: 1023.98px) {
  .lp-compare__col-topic { width: 22%; } .lp-compare__col-report { width: 34%; } .lp-compare__col-kairos { width: 44%; }
  .lp-compare caption { padding-bottom: 32px; }
}
@media (max-width: 767.98px) {
  .lp-compare caption { padding-bottom: 32px; }
  .lp-compare colgroup { display: none; }
  .lp-compare table, .lp-compare tbody, .lp-compare tr, .lp-compare tbody th, .lp-compare tbody td { display: block; }
  .lp-compare thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .lp-compare tbody th { padding: 24px 0 12px; }
  .lp-compare tbody td { padding: 0 0 16px; max-width: var(--measure-body); }
  .lp-compare tbody td:last-child { padding-bottom: 24px; }
  .lp-compare__label { display: block; margin-bottom: 4px; font: 500 12px/16px var(--font-inter), ui-sans-serif, system-ui, sans-serif;
    letter-spacing: 0.6px; color: var(--label); }
}
@media (forced-colors: active) { .lp-compare__rule { background: CanvasText; } .lp-chip--claim { border-color: LinkText; } }

/* motion.css (en-compare-post) */
.lp-compare__kairos { transition: color var(--dur-ink) var(--ease-post)
  calc(var(--k, 0) * var(--stagger-compare) + var(--lp-compare-ink-delay)); }
.lp-compare__rule { transition: transform var(--dur-post) var(--ease-post) calc(var(--k, 0) * var(--stagger-compare)); }
tr[data-row-post="pending"] .lp-compare__rule { transform: scaleX(0); }
tr[data-row-post="pending"] .lp-compare__kairos { color: var(--body); }
tr[data-row-post="instant"] * { transition-duration: 0.01ms !important; transition-delay: 0ms !important; }
html[data-motion="reduced"] .lp-compare { --lp-compare-ink-delay: 0ms; }
```

Notes: the `.lp-compare__rule` lives in the first cell (`th scope="row"`) and is as wide as the whole wrapper (`100cqw`), so the three cells share one continuous rule that grows left to right. If it were drawn per cell, three segments would grow at once and the sweep would be lost. The same markup works in the stacked form, where the `th` is the full width. Reduced motion zeroes `--dur-post`, `--dur-ink` and `--stagger-compare` through the global block (MS 2.2); the explicit `html[data-motion="reduced"]` rule above removes the extra 100ms delay.

### 10.5 System changes this section asks for

| # | Document | Change |
| --- | --- | --- |
| M-1 | `03-motion-system.md` 3.6, 5.7 and 10.1 | `en-compare-post`: trigger becomes "row post" (each `tr` top crosses 85%), not "Entry 08 post"; "Animates" gains "Kairos cell `color` Sage 60 to Phosphor White, `--dur-ink`, delayed `--stagger-compare * k + 100ms`". Add `data-row-post` to the attribute list. Reduced column stays "Rules present", add "Kairos text final" |
| M-2 | `03-motion-system.md` 12.2 | Note that the five compare rules are exempt from the `will-change` pattern (1px layers) |
| S-1 | `06-copy-deck.md` 13, 18 and `01-creative-direction.md` 5.3, M5 | Apply C1 and C2 |
| S-2 | `05-architecture.md` 1.1 | Add `islands/compare-poster.tsx` to the island list (renders `null`); the island count goes from 19 to 20 |
| S-3 | `02-design-system.md` 11.4 | Add `lp-compare`, `lp-compare__rule`, `lp-compare__label`, `lp-compare__kairos`, `lp-compare__topic`; add the local token `--lp-compare-ink-delay` |
| D-08-1 | `01-creative-direction.md` 6 | Scroll length: measured about 97vh at 1440 by 900 including the section pad (content 746px, 83vh). Accept; the section has no pin or scene, so the extra length costs nothing |
| D-08-2 | (this document) | No `will-change` on the rules, see section 9 |

### 10.6 Existing code reused

`Entry` shell, `ClaimChip`, `EntryPoster` (entry post), the shell's title rise (`kt-line-rise` / `kt-title-rise`), `landingCopy`, `claims.ts`, `ENTRIES`, the motion tokens (`--dur-post`, `--dur-ink`, `--ease-post`, `--stagger-compare`), `getEffectiveMotion` and `subscribeMotion` from `lib/motion/preference.ts`, and the ledger store for the monotonic flush. Nothing from the old `comparison.tsx` survives except the idea of a real table.

---

## 11. Acceptance criteria

Each item is testable. "At 1440" means a 1440 by 900 viewport, "at 360" means 360 by 800, unless stated.

**Content and truth**

1. The rendered table has exactly 5 body rows, 3 header cells and the strings of section 2.1 character for character (with C1 applied to the caption). Grep of the section text finds no em dash, no en dash, no product name, no currency symbol and no word "cheaper" or "free" beyond the table strings.
2. Exactly two links exist inside the table: `href="#entry-02"` and `href="#entry-03"`. Each has `data-claim` on its cell, the ids exist in `claims.ts`, and the footer claim count is unchanged at six.
3. The old `comparison.tsx` is deleted and no import of it remains.

**Structure and accessibility**

4. `table > caption` is visible, left-aligned (`getComputedStyle(caption).textAlign === "left"`), and its text equals the C1 string. Axe reports no violations on the section at 1440, 768 and 360.
5. Every header cell has `scope`; row headers have `scope="row"`. At 360 the table parts compute `display: block` and the accessibility tree still reports a table with 3 columns and 5 rows (Playwright accessibility snapshot, Chromium and WebKit).
6. The header row is visually hidden at 360 (box 1 by 1px) and present in the tree. The mobile labels are `aria-hidden` and `display: none` at 768 and wider.
7. Chip accessible names are "See 02, Fit gate" and "See 03, Truth lock" and contain the visible text "see 02" / "see 03" case-insensitively. The chip box plus pseudo-element hit area is 44px tall at least.
8. Tab order inside the section is chip 02, then chip 03. Focus rings are 2px solid `rgb(221, 255, 220)` with 2px offset, visible and unclipped.
9. Activating `see 02` (click and Enter) scrolls to entry 02 (`#entry-02` within 80px of the viewport top), moves focus to `#entry-02-title`, and pushes a history entry. Browser Back returns to a scroll position where the table is in the viewport, with every rule still drawn.

**Layout**

10. No horizontal scroll: `document.documentElement.scrollWidth <= clientWidth` at 320, 360, 390, 640, 767, 768, 1024, 1280, 1440 and 1920.
11. At 768 and above the section shows a 3-column table with column widths within 2px of 22 / 34 / 44% at 768 to 1023 and 25 / 33.3 / 41.7% at 1024 and above. At 767 and below it is stacked pairs.
12. At 1440, the table is 1216px wide, the text columns start at x offsets 0, 304 and 709 (within 2px) of the table's left edge, and the Kairos column's text width is 507px.
13. Spacing at 1440: head to eyebrow 40px, eyebrow to H2 16px, H2 to caption 24px, caption to table 48px. At 360: 32, 12, 20, 32px.
14. At 360 each row follows the order topic, "People report" label, reported text, "Kairos" label, Kairos text; the gap between the reported text and the next label is 16px.
15. The H2 wraps to "How it compares with / typical auto-apply." at 1440, 1024 and 390 (two lines, no one-word last line).
16. No element in the section computes `background-color: rgb(127, 238, 100)`; the section contains no `[data-lime-candidate]`. At 1440, scrolling in 100px steps with 400ms waits through the section, at most one lime element is ever visible, and while this section fills the viewport that element is the navbar button.

**Motion**

17. Fresh load at the top of the page, then scroll until the table header is at 40% of the viewport: every `.lp-compare__rule` ends with `transform: matrix(1, 0, 0, 1, 0, 0)`, and the last one ends within 1,200ms of its row crossing the 85% line. Each Kairos cell ends at `rgb(221, 255, 220)`.
18. Timing probe: sample the first row's rule `scaleX` at 100ms and 300ms after it goes `live`. Expected 0.4 to 0.8 at 100ms and at least 0.85 at 300ms. Rule `n` starts `n * 90ms` after rule 0 when they post in the same batch (start times within 40ms).
19. At no sampled frame is any Kairos cell text darker than Sage 60: computed contrast against Void is at least 8.29:1 at 20 sampled frames.
20. Rows already in the viewport at load (reload with the table on screen) carry no `pending` state and do not animate. Rows below get `pending` and animate when they cross 85%. Reloading mid-table leaves rows above the viewport drawn.
21. An anchor jump from the hero to `#entry-09` leaves all 5 rules drawn and all Kairos cells white when the visitor scrolls back up (monotonic flush).
22. Scrolling up through the table never changes a rule or a colour (no `data-row-post` appears after the first pass).
23. Motion groups: during a fast scroll through entries 08 and 09, the Q5 sampler never records more than 2 running motion groups.
24. Animated properties on the section, across a full pass, are only `transform` (on `.lp-compare__rule`) and `color` (Kairos cells and chips) plus the shell's title and head moves. Grep of the section CSS finds no `transition: all`, no `will-change` and no property outside the allowlist of MS 12.1.
25. The island adds at most 0.6 KB gzip to the islands chunk; no new network request occurs in this section; CLS from the section is 0.

**Reduced motion, no JavaScript, forced colours**

26. With `prefers-reduced-motion: reduce` (and no Full override): at first paint all rules are `scaleX(1)`, Kairos cells are Phosphor White, and no `data-row-post` is ever set. Chip hover still changes the border colour over 300ms.
27. With JavaScript disabled: the table renders ruled and white-inked in both layouts (768 and 360), and both chips work as plain anchors.
28. Switching the Motion control to Reduced while rows are `live` completes them immediately (within one frame) and disables further posting.
29. With `forced-colors: active` emulated, the row rules remain visible and chip borders use `LinkText`.

**Hand-off**

30. While entry 08 is on screen the canvas wrapper computes `visibility: hidden` and `html[data-lime-owner]` is `navbar` (except in the tall-viewport case in 4.5). Entry 08 sets neither.
31. After the visitor passes into entry 09, `data-active-entry` becomes `09` in the same frame the shell updates, the rail and the "08 / 10" caption follow, and the table's rules do not change.
