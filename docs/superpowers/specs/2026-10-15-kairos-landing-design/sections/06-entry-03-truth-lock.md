# Entry 03 Truth lock: section specification

Section id `entry-03-truth-lock`, anchor `#entry-03`, tier standard, scene state `slip-cite`, nominal scroll length 120vh, previous `entry-02-fit-gate` (`slip-feed`), next `entry-04-approve` (`slip-hold`).

Source documents: `01-creative-direction.md` (CD), `02-design-system.md` (DS), `03-motion-system.md` (MS), `04-webgl-scene.md` (WS), `05-architecture.md` (AR), `06-copy-deck.md` (COPY). This file is self-contained for the build: every value an engineer needs is repeated here. Where a sibling document and this file disagree, section 2.4 lists the disagreement and says which value to build.

---

## 1. Purpose and narrative beat

**Job of this entry.** Prove one rule in the visitor's own hands: every tailored resume line cites a fact the person confirmed, and a line that cites nothing cannot be saved. The product behaviour behind it is documented (a save with an uncited line returns HTTP 422 `truth_lock`, stores nothing, and the edit screen lists the offending lines; resume input is paste only in v1). The demo mirrors that rule; it never calls a server and never judges the visitor's writing.

**Beat: Citation.** Where there is a fact, a line may exist. Where there is none, nothing connects. The visitor sees a four-line sample diff in which each added line ends in a "cites fact" chip, a list of four confirmed facts typed by kind, and a trace that works in both directions (line to facts, fact to lines). Then the visitor tries two fixed lines. The first is saved and a thread draws to its fact. The second is refused: a hairline thread reaches 70% of the way toward the facts, a small lock bracket closes around its tip, the thread withdraws, the line's letters fall one by one, and "Not saved. This line cites no confirmed fact." is announced.

**Why it is the page's calmest spectacle.** Nothing moves until the visitor presses Add line. The refusal is one hairline, one bracket and 20 falling letters, finished in 1,160ms, with no spring and no overshoot. The receipt in the lane does not react to the refusal: a refused line is never posted, so the receipt records only `03 · Resume v3 · every line cites a confirmed fact`. That silence is the point ("nothing connects").

**Ledger duty.** This entry settles debit row 02 ("Resumes with skills and metrics the person does not have.") in entry 01. It carries the settlement line "Settles 02. No fact, no line." It is the target of three claim chips elsewhere (`entry-01` row 02 cell `open · see 03`, `entry-08-compare.rows[1]` `see 03`, `entry-09-questions.faq[2]` `see 03`), so its H2 must be focusable (`tabindex="-1"`) and anchor jumps must land on it.

**Sample status.** Everything inside the panel is synthetic and labelled: SAMPLE chip, 1px dashed Circuit Border edge, accessible group name beginning "Sample". The ids `#07`, `#11`, `#12`, `#14` and the dates "2023 to 2024" are sample values, not facts about any real person.

---

## 2. Content

### 2.1 Entry copy (verbatim from COPY section 8)

| Key | Element | Copy (verbatim) |
| --- | --- | --- |
| `entry-03-truth-lock.number` | Entry number in the head | 03 |
| `entry-03-truth-lock.eyebrow` | Caption above the title (CSS uppercases it; source text stays as written) | Truth lock |
| `entry-03-truth-lock.h2` | H2 | Resumes that cannot make things up. |
| `entry-03-truth-lock.body` | Body paragraph 1 | You paste your resume once. Kairos splits it into facts, and you confirm or remove each one. Every tailored line has to cite facts you confirmed. A line that cites nothing cannot be saved; the editor lists it so you can fix or remove it, and your own edits go through the same check. |
| `entry-03-truth-lock.detail` | Body paragraph 2 | You see every change as a diff, line by line. |
| `entry-03-truth-lock.settles` | Settlement line (with a posting square before it) | Settles 02. No fact, no line. |
| `entry-03-truth-lock.h2Alt` | Not rendered. Kept in the copy file as the alternate H2 | Every tailored line cites a fact you confirmed. |

### 2.2 Demo copy: sample diff and facts (COPY 8.1)

| Key | Element | Copy (verbatim) |
| --- | --- | --- |
| `shared.sampleChip` | SAMPLE chip, top right of the panel; accessible name "Sample data" | SAMPLE |
| `entry-03-truth-lock.diffTitle` | `h3` of the panel and accessible name of the panel group | Sample diff · resume v3 |
| `entry-03-truth-lock.diff[0]` | Removed line | Worked on backend features for the billing team. |
| `entry-03-truth-lock.diff[1]` | Added line, chip `cites #07, #12` | Wrote backend services in TypeScript for the billing team |
| `entry-03-truth-lock.diff[2]` | Removed line | Helped with deployments. |
| `entry-03-truth-lock.diff[3]` | Added line, chip `cites #11, #14` | Maintained the deployment scripts for the billing service, 2023 to 2024 |
| `entry-03-truth-lock.removedAria` | Visually hidden prefix on removed lines | Removed: |
| `entry-03-truth-lock.addedAria` | Visually hidden prefix on added lines | Added: |
| `entry-03-truth-lock.chipSingle` | Chip with one fact; accessible name "Cites fact number {id}" | cites fact #{id} |
| `entry-03-truth-lock.chipMany` | Chip with several facts; accessible name "Cites facts number {id} and {id}" | cites #{id}, #{id} |
| `entry-03-truth-lock.factsTitle` | `h3` above the facts | Confirmed facts (sample) |
| `entry-03-truth-lock.facts` | Four fact buttons | #07 · Role · sample / #11 · Dates · sample / #12 · Tool · sample / #14 · Tool · sample |
| `entry-03-truth-lock.factUsedBy` | Polite live region when a fact is focused or pinned | Fact #{id} is used by {n} lines. |
| `entry-03-truth-lock.lineUses` | Visually hidden text referenced by `aria-describedby` on each added line | Cites facts {list}. (example: Cites facts #07 and #12.) |
| `entry-03-truth-lock.traceHint` | 14px hint under the diff, fine pointer | Hover or focus a line to see which facts it cites. |
| `entry-03-truth-lock.traceHintTouch` | Same slot, coarse pointer | Tap a line to see which facts it cites. Tap again to clear. |

### 2.3 Demo copy: Try adding a line (COPY 8.2)

| Key | Element | Copy (verbatim) |
| --- | --- | --- |
| `entry-03-truth-lock.tryLegend` | `legend` of the `fieldset` | Try adding a line (sample) |
| `entry-03-truth-lock.preset[0]` | Radio 1, with chip `cites fact #07` | Built REST services in TypeScript for an internal billing tool |
| `entry-03-truth-lock.preset[1]` | Radio 2, no chip | Led a team of 6 engineers |
| `entry-03-truth-lock.addButton` | Button | Add line |
| `entry-03-truth-lock.resultSaved` | Status after preset 1 | Saved. Cites fact #07. |
| `entry-03-truth-lock.resultRefused` | Alert after preset 2 | Not saved. This line cites no confirmed fact. |
| `entry-03-truth-lock.refusedLineAria` | `aria-label` of the split line while its letters fall | Led a team of 6 engineers. Not saved. |
| `entry-03-truth-lock.demoNote` | 14px note beside the control | In the product, every tailored line carries the ids of the facts it uses. A save with a line that cites nothing is refused, and the editor lists that line. This demo shows the rule with two fixed examples; it does not judge your writing. |

Shared strings used here: `shared.postedAria` ("Posted.") beside the filled settlement square, `shared.pendingAria` ("Pending.") if the square is rendered outlined before the post, `shared.sampleChip`.

### 2.4 Flags: changes and additions needed (build these; copy owner to ratify)

| # | Flag | What to build | Why |
| --- | --- | --- | --- |
| F1 | `factUsedBy` reads "Fact #07 is used by 1 lines." for every fact at load (each sample fact is used by exactly one line) | Add key `entry-03-truth-lock.factUsedByOne` = "Fact #{id} is used by 1 line." and use it when n is 1. Keep `factUsedBy` for n of 0 or 2 or more | Grammar. After the cited preset is saved, #07 is used by 2 lines |
| F2 | MS 9.4 step 6 says the pending slot "shows its placeholder text" but COPY has no such key | Add `entry-03-truth-lock.slotPlaceholder` = "Your line would appear here." (14px, Sage 60) | The slot needs words when empty, and the words must not be a lorem or a fake line |
| F3 | Preset 2 differs from preset 1 only by the absence of a chip, which a screen reader cannot perceive | Add key `entry-03-truth-lock.preset[1].noCiteAria` = "Cites no fact." as visually hidden text after the preset 2 label text | WCAG 1.3.1: information carried by absence must have a text equivalent |
| F4 | A second press of Add line with the cited preset would duplicate the line | Add key `entry-03-truth-lock.resultAlreadyAdded` = "Already added. Cites fact #07." Status only; no motion, no second row | Idempotent demo |
| F5 | COPY colours the whole result string with `--good` or `--bad` | Build: only the status word ("Saved." or "Not saved.") takes the status colour; the remainder ("Cites fact #07." or "This line cites no confirmed fact.") is Phosphor White. The text of each string is unchanged | DS 6.8: status colours are for status words only |
| F6 | CD 5.3 sets removed lines in Sage 40. DS 6.11 says Sage 40 is forbidden on Ground (3.97:1) and the SampleFrame is Ground | Build removed lines in Sage 60 (7.01:1 on Ground) with the 1px strike in `--bad` at 60%, plus the visually hidden "Removed:" prefix | Contrast |
| F7 | MS 4.4 says the refused string has 21 glyph spans. "Led a team of 6 engineers" has 25 characters, 5 of them spaces, so 20 glyphs (indexes 0 to 19) | Build 20 spans. Last glyph starts 480 + 19 × 18 = 822ms and ends 1,142ms, so the 1,160ms `refused` mark in MS 9.4 still holds. MS 4.4's "glyph 20 ends 680ms later" becomes "glyph 19 ends 662ms later" | Arithmetic |
| F8 | MS 4.4 puts `aria-label` on a plain `span`; labels on generic elements are ignored by several screen readers | Add `role="img"` to that span | Valid naming |
| F9 | COPY `entry-05-send-receipt.rows[3]` shows chip `cites #07, #11` and CD 5.3 once said the diff cites `#07, #11`; this entry's chips are `#07, #12` and `#11, #14` | Not built here. Entry 05's copy owner should use `cites #07, #12` or drop the chip, so the page never shows two different citation sets for the same v3 diff | Consistency of a page whose subject is accountability |
| F10 | MS and CD say the 120vh scroll length; the composed content is taller (about 1,330px, 147vh at 1440 by 900, section 3.4) | Do not pad or clamp to reach 120vh. `u` for this entry is measured from the real element height | DS 4.2 says vh budgets are targets, not CSS |

No other string may be added, shortened or reworded. No em or en dash may appear in any user-facing string in this entry (U+2014 and U+2013 are banned; the middle dot U+00B7 is allowed).

---

## 3. Layout structure

### 3.1 Grid facts used here (from DS 4.1)

| Viewport | Columns | Margin | Gap | Content width | Column width |
| --- | --- | --- | --- | --- | --- |
| 1440 | 12 | 32 (inside the 1280 container; page margin outside is 80) | 32 | 1216 | 72 |
| 1280 | 12 | 32 (inside 1280) | 32 | 1216 | 72 |
| 1024 | 12 | 32 | 32 | 960 | 50.67 |
| 768 | 8 | 24 | 24 | 720 | 69 |
| 640 to 767 | 8 | 16 | 20 | 608 to 735 | 58.5 at 640 |
| 360 to 639 | 4 | 16 | 16 | 328 at 360 | 70 at 360 |

At 1024 and wider, text and demos sit in columns 1 to 7 (696px at 1280 and wider, 547px at 1024). Column 8 is a buffer. The receipt lane is columns 9 to 12 (384px at 1280 and wider, 299px at 1024). Text never enters the lane. Below 1024 there is no lane and no canvas.

### 3.2 Placement by breakpoint

| Viewport | Head, eyebrow, H2, body | Panel (SampleFrame) | Panel inner grid | Lane and slip | Fixed chrome |
| --- | --- | --- | --- | --- | --- |
| 1440 | Columns 1 to 7. H2 55.7px, balanced 2 lines. Body measure 34rem (544px) | Columns 1 to 7: 696px wide, padding 32, inner 632 | `[diff 396][strip 48][facts 188]` | Lane cols 9 to 12, 384px. Slip 301 by 677 (sticky, `slip-cite`) | Rail at `right: 24px` |
| 1280 | Same. H2 52.2px | 696px wide, same | Same | Lane 384px. Slip 265 by 596 | Rail at `right: 8px` |
| 1024 | Columns 1 to 7 (547px). H2 46.5px | 547px, padding 32, inner 483 | `[diff 287][strip 40][facts 156]` | Lane 299px. Slip 253 by 570 | Navbar caption "03 / 10" (no rail) |
| 768 | Full 8 columns (720px); body keeps 544px measure. H2 40.9px | `min(100%, 704px)`: 704px, padding 32, inner 640 | `[diff 404][strip 48][facts 188]` side by side | None | Tape 48px under the navbar |
| 640 to 767 | Full width (608 to 735px). H2 38.1px to 40.9px | 100% width, padding 20 | Stacked (below) | None | Tape |
| 360 to 639 | Full width (328px at 360). H2 36px (clamp floor) | 100% width, padding 20, inner 288 | Stacked: `[main 1fr = 264][strip 24]` | None | Tape |

Stacked arrangement (below 768): panel order is diff block, facts block, Try block, demo note, single column. The citation strip is a 24px column to the right of the diff and facts blocks only (the Try block and the note span the full inner width). DOM order is identical at every width: diff block, facts block, Try block, note.

### 3.3 Spacing (DS 4.3, extended to the panel)

| Gap | Desktop (1024 and wider) | Below 1024 |
| --- | --- | --- |
| Entry head height (number plus graticule rule), `--lp-head-h` | 32 | 32 |
| Head to eyebrow | 40 | 32 |
| Eyebrow to H2 | 16 | 12 |
| H2 to body | 24 | 20 |
| Paragraph to paragraph | 16 | 16 |
| Body to panel | 48 | 32 |
| Panel to settlement line | 32 | 24 |
| Section bottom padding `--section-pad-landing` | 128 (96 at 768 to 1023) | 80 below 768 |
| Panel padding | 32 | 20 below 768 |
| Panel header row (h3 plus SAMPLE chip) height, then gap below | 24, then 20 | 24, then 16 |
| Row gap in the diff list, in the facts list, between radios | 8 | 8 |
| Diff block to Try block | 32 | 24 |
| Hint, margin above | 12 | 12 |
| Facts title to list | 12 | 12 |
| Legend to radios | 12 | 12 |
| Radios to action row | 16 | 16 |
| Button to status text | 16 | 16 |
| Demo note, margin above when stacked | n/a (right column) | 20 |
| Chip to text | 8 | 8 |

Every interactive row is at least 44px tall with 8px between rows (A16). `scroll-margin-top: 80px` on the section; the root `scroll-padding-top` is 80px at 1024 and wider and 128px below (tape).

### 3.4 Heights

Estimated at 1440 by 900: head 72, eyebrow 32, H2 138, body 208, panel about 696, settlement line 52, bottom padding 128, total about 1,330px (147vh). Phone (360): about 2,000px. Nothing is pinned. `ScrollTrigger` `u` is derived from the measured height plus 0.70 of the viewport height (WS 5.2), so no height is forced.

### 3.5 ASCII wireframe, desktop 1440 (container 1280, content 1216, 12 columns of 72 with 32 gaps)

```
 col:   1   2   3   4   5   6   7 | 8 |  9   10   11   12
 +-------------------------------------------------------------------+
 | 03  |----|----|--[|]--|----|----|----|----|----|----|----|----|   |  <- head: number + graticule rule (11 ticks, tick 03 is 8px, bright), 32px
 +-------------------------------------------------------------------+
   40px
   TRUTH LOCK                                    (eyebrow)           +-------------------+
   16px                                                              |  RECEIPT LANE     |
   Resumes that cannot                           (H2, 55.7px)        |  cols 9-12, 384px |
   make things up.                                                   |  sticky inner     |
   24px                                                              |  canvas slip      |
   You paste your resume once. Kairos splits it  (body, 544px)       |  slip-cite pose   |
   into facts, and you confirm or remove each                        |  rot (2,-10,0)    |
   one. Every tailored line ... same check.                          |  scale 0.96       |
   16px                                                              |                   |
   You see every change as a diff, line by line.                     |  prints l03 at    |
   48px                                                              |  u 0.20:          |
   +- - - - - - - - - - - - - - - - - - - - - - - - - - -+          |  "03 · Resume v3  |
   ' Sample diff · resume v3                    [SAMPLE]  '          |   every line cites|
   ' +----------------------------+  :  +---------------+ '          |   a confirmed     |
   ' | Removed: Worked on backend |  :  | Confirmed     | '          |   fact"           |
   ' | features for the billing...|  :  | facts (sample)| '          |                   |
   ' | Added: Wrote backend ...   |--+--| #07 Role      | '          |                   |
   ' |   [cites #07, #12]         |  :  | #11 Dates     | '          |                   |
   ' | Removed: Helped with ...   |  :  | #12 Tool      | '          |                   |
   ' | Added: Maintained the ...  |--+--| #14 Tool      | '          |                   |
   ' |   [cites #11, #14]         |  :  +---------------+ '          |                   |
   ' | Your line would appear here|--.  (strip 48px:       '          |                   |
   ' | Hover or focus a line ...  |  :   citation paths)   '          +-------------------+
   '                                                       '
   ' Try adding a line (sample)               In the product, every  '
   ' ( ) Built REST services ... [cites #07]  tailored line carries   '
   ' (o) Led a team of 6 engineers            the ids ... it does not '
   ' [ Add line ]  Not saved. This line ...   judge your writing.     '
   +- - - - - - - - - - - - - - - - - - - - - - - - - - -+
   32px
   [ ] Settles 02. No fact, no line.            (square is filled when posted)
   128px
```

### 3.6 ASCII wireframe, mobile 360 (content 328, panel padding 20, inner 288)

```
 +--------------------------------+
 | navbar 64px                    |
 +--------------------------------+
 | tape 48px (sticky)             |
 +--------------------------------+
   03 |--|--|--[|]--|--|--|--|     <- head 32px
   32px
   TRUTH LOCK
   12px
   Resumes that cannot              (36px)
   make things up.
   20px
   You paste your resume once ...   (16px/24, 328 wide)
   ...
   16px
   You see every change as ...
   32px
 +- - - - - - - - - - - - - - - - +
 ' Sample diff · resume v3 [SAMPLE]'   h3 + chip, 24px
 ' 16px                            '
 ' | Removed: Worked on ...  |  :  '   main 264 | strip 24
 ' | Added: Wrote backend ...|--+  '
 ' |   [cites #07, #12]      |  :  '
 ' | Removed: Helped with ...|  :  '
 ' | Added: Maintained ...   |--+  '
 ' |   [cites #11, #14]      |  :  '
 ' | Your line would appear..|--.  '
 ' | Tap a line to see which |  :  '
 ' | facts it cites. Tap ...  |  :  '
 ' Confirmed facts (sample)    :  '
 ' [ #07 · Role · sample    ]-'  :  '
 ' [ #11 · Dates · sample   ]-'  :  '
 ' [ #12 · Tool · sample    ]-'  :  '
 ' [ #14 · Tool · sample    ]-'     '
 ' 24px                            '
 ' Try adding a line (sample)      '   full inner width 288
 ' ( ) Built REST services ... [cites fact #07]
 ' (o) Led a team of 6 engineers   '
 ' [ Add line ]                    '
 ' Not saved. This line cites no   '
 ' confirmed fact.                 '
 ' 20px                            '
 ' In the product, every tailored  '
 ' line carries ...                '
 +- - - - - - - - - - - - - - - - +
   24px
   [ ] Settles 02. No fact, no line.
   80px
```

### 3.7 Panel internals

The panel (`SampleFrame`) contains the header row, then the `CitationDemo` root `div.lp-cite` (position relative). `.lp-cite` is a CSS grid.

| Layout | `grid-template-columns` | Areas |
| --- | --- | --- |
| 1280 and wider, and 768 to 1023 | `minmax(0,1fr) 48px 188px` | row 1: `diff . facts`; row 2: `try . note` |
| 1024 to 1279 | `minmax(0,1fr) 40px 156px` | same |
| Below 768 | `minmax(0,1fr) 24px` | rows: `diff strip`, `facts strip`, `try try`, `note note` |

The `note` area is `align-self: end` on desktop so its last line aligns with the bottom of the Try block. The strip is an inline `<svg class="lp-cite__strip" aria-hidden="true" focusable="false">`, placed in the gutter column (desktop) or the 24px column (stacked), spanning the rows of the diff and facts blocks, `pointer-events: none`, `overflow: visible`, width and height equal to its grid cell (read by the layout effect). It is the only SVG in the entry and its area is at most 48 by 560px.

---

## 4. Visual design

### 4.1 Surfaces and borders

| Element | Fill | Border | Radius |
| --- | --- | --- | --- |
| Section background | Void `#000000` | none | n/a |
| Panel (`SampleFrame`) | Ground Iron `#181818` | `--sample-border` (1px dashed Circuit Border `#485346`) | 8px (`rounded-card`) |
| Added line, hover or lit | Carbon Veil `#212525` | 1px transparent at rest, no change | 8px |
| Fact button | transparent | 1px Fern Link `#859984`; lit: 1px Phosphor White `#ddffdc` | 8px |
| Preset label | transparent; checked: Carbon Veil | 1px Fern Link; checked: 1px Phosphor White | 8px |
| Slot | transparent, with a 1px solid Circuit Border top hairline (solid, not dashed; dashed means sample and the panel edge already says it) | none | 0 |
| Citation chip (M4) | transparent | 1px Circuit Border; lit: 1px Phosphor White | 9999px, 24px tall |
| Add line button | Ground Iron | 1px Phosphor White | 12px, 44px tall |
| Posting square (M3) in the settlement line | filled Phosphor White when posted; outlined 1px Circuit Border before | none | 0, 6 by 6px |
| Strip paths | none | stroke 1px Phosphor White at 60% (`#8ea38e` over Ground, 6.58:1) | n/a |
| Lock bracket | none | stroke 1px Phosphor White | n/a |

Elevation: none. No `box-shadow` anywhere in the entry. No glow, no gradient.

### 4.2 Type roles (weights 400 and 500 only; DS 3.1)

| Element | Class | Face | Weight | Size | Line height | Tracking | Colour |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Entry number | `.lp-caption` | Inter | 500 | 12px | 1.33 | +0.6px | Moss 70 `#9cbf93` |
| Eyebrow | `.lp-caption` plus `text-transform: uppercase` | Inter | 500 | 12px | 1.33 | +0.6px | Moss 70 |
| H2 | `.lp-heading` | Inter Tight, `ss01` | 400 | `--type-heading-landing` (36 to 56px) | 1.02 | -0.02em | Phosphor White |
| Body and detail | `.lp-body` | Inter | 400 | 16px | 1.5 | -0.022em | Sage 60 `#8cab87` |
| Panel `h3` (diff title, facts title) and `legend` | `.lp-small` | Inter | 500 | 14px | 1.43 | -0.026em | Phosphor White |
| Added line text | `.lp-body` | Inter | 400 | 16px | 1.5 | -0.022em | Phosphor White |
| Removed line text | `.lp-body` | Inter | 400 | 16px | 1.5 | -0.022em | Sage 60, 1px strike (`text-decoration-color: color-mix(in srgb, var(--bad) 60%, transparent)`) |
| Chip | `.lp-caption` without uppercase | Inter | 500 | 12px | 1.33 | +0.6px | Phosphor White |
| Fact button text | `.lp-small` | Inter | 400 (id in 500) | 14px | 1.43 | -0.026em | Sage 60; lit Phosphor White |
| Hint, slot placeholder, demo note | `.lp-small` | Inter | 400 | 14px | 1.43 | -0.026em | Sage 60 |
| Preset label text | `.lp-small` | Inter | 400 | 14px | 1.43 | -0.026em | Phosphor White |
| Add line label | `.lp-small` | Inter | 500 | 14px | 1 | -0.026em | Phosphor White |
| Status word | `.lp-small` | Inter | 500 | 14px | 1.43 | -0.026em | `--good` `#aed2a4` or `--bad` `#ff8a80` |
| Status remainder | `.lp-small` | Inter | 400 | 14px | 1.43 | -0.026em | Phosphor White |
| Settlement line | `.lp-small` | Inter | 500 | 14px | 1.43 | -0.026em | Phosphor White |

All numerals (ids `#07`, "2023 to 2024", the 6 in "Led a team of 6 engineers") inherit `tabular-nums slashed-zero` from `.lp` (A15). Text is left-aligned. Nothing is centred.

### 4.3 Landing-only tokens added by this entry (named and justified)

Declared on `.lp-cite` inside `.lp` (never `:root`), prefixed `--lp-cite-`, per the DS leak rule.

| Token | Value | Reduced value | Justification |
| --- | --- | --- | --- |
| `--lp-cite-t-trace` | 120ms | 0ms | Offset before the saved path starts drawing (MS 9.3) |
| `--lp-cite-t-bracket` | 300ms | 0ms | Offset of the lock bracket in the refusal (MS 9.4 step 3) |
| `--lp-cite-t-retract` | 420ms | 0ms | Offset of the thread retracting (MS 9.4 step 4) |
| `--lp-cite-t-fall` | 480ms | 0ms | Offset of the first falling glyph (MS 9.4 step 5) |
| `--lp-cite-gutter` | 48px; 40px at 1024 to 1279; 24px below 768 | n/a | Width of the strip column |
| `--lp-cite-facts-w` | 188px; 156px at 1024 to 1279 | n/a | Width of the facts column |
| `--lp-cite-bracket-scale` | 1; 0.75 below 768 | n/a | Bracket must fit the 24px strip when stacked |

Reduced rule: `html[data-motion="reduced"] .lp-cite { --lp-cite-t-trace: 0ms; --lp-cite-t-bracket: 0ms; --lp-cite-t-retract: 0ms; --lp-cite-t-fall: 0ms; }` and the no-JavaScript media-query twin that DS 1.4 uses for the other tokens. MS tokens used unchanged: `--dur-swap` 120ms, `--dur-row` 240ms, `--dur-colour` 300ms, `--dur-fall` 320ms, `--dur-print` 420ms, `--dur-post` 600ms, `--dur-rise` 700ms, `--stagger-char` 18ms, `--dist-fall` 14px, `--dist-bracket` 4px, `--ease-post`, `--ease-retract`, `--ease-utility`.

### 4.4 Motif usage

| Mark | Use in this entry |
| --- | --- |
| M1 and M2 | Head row "03" with the graticule rule; the rule draws once over 600ms at the post; the 03 tick is 8px and Phosphor White, the other ten are 4px Circuit Border |
| M3 | One posting square before "Settles 02. No fact, no line." It fills when the entry posts (the same event that flips the entry 01 row 02 cell). It is also drawn before the checked preset label (an extension of the DS 6.3 list, which names "active segment of switches"; a radio group is such a switch) |
| M4 | The citation chip on each added line and on preset 1. Highlight state (a fact or the line is traced) changes the border to Phosphor White over 300ms |
| M6 | SAMPLE chip, dashed panel edge, accessible name beginning "Sample". Nothing else in the entry is dashed. Focus rings are solid |
| M7 | Not used (perforation appears only on the receipt, the mint band edges and above the footer) |
| M8 | Signed tabular numerals: ids `#07`, dates, the sample "6". No credit amounts appear here |
| M9, M10 | Not used |

### 4.5 Lime

Nothing in this entry is lime and nothing here is a custody candidate. "Add line" is a Default (Ground fill, Phosphor White border) button. The one lime element in any viewport showing this entry is the navbar "Start free" (owner `navbar`), because no in-page custody action is visible. When the "Approve sample draft" button of entry 04 enters the viewport the owner changes to `approve` with the 150ms plus 150ms hand-over; if that happens while the visitor is mid-demo, the demo is unaffected. Status colours (`--good`, `--bad`) are used only on the two status words, never on rules, brackets, paths or backgrounds. The path, bracket and thread are never coloured by status.

---

## 5. WebGL

**Scene state id:** `slip-cite` (section carries `data-scene="slip-cite"`). The entry owns no canvas code.

| Aspect | Value |
| --- | --- |
| Entered | From `slip-feed` as `entry-03-truth-lock` local progress `u` goes 0 to 0.25, scrubbed: rotation (0, -6, 0) to (2, -10, 0), scale stays 0.96, `uLevel` 1.00, offset (0, 0, 0), `uCurl` 1. The applied pose follows the target with the frame-rate-independent lerp (0.12 per frame at 60fps), no overshoot |
| Print | `l03` = `03 · Resume v3 · every line cites a confirmed fact` prints once when `u` first crosses 0.20 going forward (`em-print`: flatten 120ms, head 420ms, paper advance 520ms, `--ease-post`, then 200ms hold, then rotation returns over 600ms). It never reverses |
| Left | Into `slip-hold` when `entry-04-approve` `u` goes 0 to 0.25 (offset (-0.04, 0, 0.2), rotation (0, -4, 0), scale 1.00). The scrub is reversible except the print |
| Demo coupling | None. Saving, refusing, tracing and pinning never write `ledgerStore` and never change the canvas. A refused line prints nothing |
| Layering | Canvas is a fixed, `aria-hidden` layer at `--lp-z-canvas` (0) clipped to the lane (columns 9 to 12). Entry content is at `--lp-z-content` (1) in columns 1 to 7. They cannot overlap at 1024 and wider (column 8 is a buffer). The strip SVG and bracket live inside the panel, above panel content, below nothing else |
| Text over canvas | None. No DOM text is ever placed over the canvas (DS 5.1). The only text on the canvas is the printed receipt line, ink on Mint Frost (at least 14.9:1, WS contrast guarantees) |
| Below 1024, tier 0, Reduced | No canvas. The DOM lane receipt (1024 to wider, tier 0) appends the `l03` row with `en-row-print`; below 1024 the 48px tape updates its latest line when entry 03 posts (owner: ledger rail spec). Section layout is identical in every tier |

Row 02 stays settled. The canvas pose relative to entry 02's feed is not this section's concern.

---

## 6. Animation choreography

All values are tokens from MS. CSS is the engine for everything inside the panel (it must run identically below 1024px where GSAP is not loaded). GSAP is used only for the title split at 1024 and wider and for the scene scrub, both owned by the system, not by this file.

### 6a. Entrance timeline

Trigger for rows 1 to 7: `EntryPoster` marks the section `data-post="live"` when the section top reaches 85% of the viewport (`rootMargin: "0px 0px -15% 0px"`). The hidden start state exists only if the section was below 85% at hydration; otherwise the section is `data-post="instant"` and nothing animates. Posting is monotonic (MS 3.3).

| # | Element | Property | From | To | Duration | Delay or stagger | Easing token | Preset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Graticule rule | `transform: scaleX`, origin left | 0 | 1 | 600ms (`--dur-post`) | 0 | `--ease-post` | `en-post-rule` |
| 2 | 11 ticks | visibility step (no tween) | hidden | shown | 0 | `calc(var(--i) * 60ms)`, i = 0 to 10, last at 600ms | none | `en-post-rule` |
| 3 | Entry number "03" | none | visible | visible | 0 | 0 | n/a | none |
| 4 | H2 lines at 1024 and wider (2 lines) | `transform: translateY` inside a mask | 115% | 0 | 700ms (`--dur-rise`) | +80ms, 70ms between lines; ends at 850ms | `--ease-post` | `kt-line-rise` (SplitText `lines`, mask, `autoSplit`) |
| 5 | H2 below 1024 (one mask) | `transform: translateY` | 115% | 0 | 700ms | +80ms | `--ease-post` | `kt-title-rise` |
| 6 | Settlement posting square | `background-color` | transparent (1px Circuit Border outline) | Phosphor White | 300ms (`--dur-colour`) | +600ms (after the rule is drawn) | `--ease-utility` | `en-post-square` |
| 7 | Entry 01 row 02 right cell | `opacity` cross-fade between "open · see 03" and "settled in 03" | 1 / 0 | 0 / 1 | 120ms (`--dur-swap`) | 0, only if the cell is in view, else instant | `--ease-linear` | `kt-cell-swap` (owned by entry 01) |
| 8 | Canvas pose | scene pose | `slip-feed` | `slip-cite` | scrubbed over `u` 0 to 0.25 | n/a | smoothstep plus lerp | `ho-pose` |
| 9 | Canvas line `l03` | printed row | absent | printed | 420ms head, 520ms paper | at `u` 0.20, once | `--ease-post` | `em-print` |

Not animated, by rule (A4): eyebrow, body, detail, the panel, the diff, the facts, the Try block, the demo note and the settlement text. They are in their final state at first paint. No fade, no rise, no stagger on any of them.

Hidden start state (JS only, only for pending entries): rule `scaleX(0)`, H2 mask content `translateY(115%)`, settlement square outlined. Without JavaScript none exists.

### 6b. Scroll-linked behaviour

| Item | Value |
| --- | --- |
| Pin | None |
| Section-owned ScrollTriggers | None |
| Scene ScrollTrigger (system-owned) | id `entry-03:scene`, `start: "top 85%"`, `end: "bottom 15%"`, `scrub: true`, `refreshPriority: 3`, created once per `[data-scene]` element at 1024px and wider with Full motion |
| `u` length | section height plus 0.70 of the viewport height. At 1440 by 900 with the estimated 1,330px section that is 1,960px, so 0.25 is 490px and 0.20 is 392px |
| Pin-free scrub | `ho-pose` only. Nothing in the panel is scroll-linked; scroll never saves, refuses or traces anything |

Progress-to-value mapping (rotation in degrees of the lane slip; `s = smoothstep(0, 0.25, u)`; rotation x = 2s, rotation y = -6 - 4s; scale 0.96; target pose, before the 0.12 lerp):

| `u` | `s` | Rotation x | Rotation y | Event |
| --- | --- | --- | --- | --- |
| 0.0000 | 0.000 | 0.00 | -6.00 | Entry top at 85% of viewport; `slip-feed` pose; section posts (rule, title) |
| 0.0625 | 0.156 | 0.31 | -6.62 | |
| 0.1250 | 0.500 | 1.00 | -8.00 | |
| 0.1875 | 0.844 | 1.69 | -9.38 | |
| 0.2000 | 0.896 | 1.79 | -9.58 | `l03` prints (forward only, once) |
| 0.2500 | 1.000 | 2.00 | -10.00 | `slip-cite` rest pose; nothing changes until entry 04 `u` > 0 |
| 0.25 to 1.00 | 1.000 | 2.00 | -10.00 | Visitor reads and uses the demo; canvas idle (zero frames at rest) |

Reverse scroll scrubs the pose back; `l03` stays printed (append-only).

### 6c. Micro-interactions

Hover styles apply only under `@media (hover: hover) and (pointer: fine)`. Focus is `mi-focus`: `:focus-visible { outline: 2px solid var(--foreground); outline-offset: 2px; }`, instant on and off, never transitioned. No scale, no lift, no cursor effects anywhere.

| Element | Hover | Focus | Press | Preset |
| --- | --- | --- | --- | --- |
| Added line button | Background transparent to Carbon Veil, 300ms `--ease-utility`; the facts it cites go Sage 60 to Phosphor White and their border Fern Link to Phosphor White (300ms); the edges to those facts draw (`stroke-dashoffset` 1 to 0, 300ms, `--ease-post`) | Same as hover, plus focus ring | Instant: Carbon Veil background and Phosphor White chip border; toggles the pin (`aria-pressed`) | `mi-trace`, `em-trace`, `en-path-draw` |
| Fact button | Border to Phosphor White, text to Phosphor White (300ms); every line citing it gets Carbon Veil background and Phosphor White chip border; edges draw | Same, plus focus ring; polite live region announces `factUsedBy` or `factUsedByOne` | Toggles the pin | `mi-trace`, `em-trace`, `en-path-draw` |
| Un-trace (leave, blur, unpin) | Colours return in 300ms; each path returns `stroke-dashoffset` 0 to 1 in 300ms with `--ease-post` (a reset, not a retraction; `--ease-retract` is reserved for refusals) | n/a | n/a | `mi-trace` |
| Preset label (radio) | Border Fern Link to Phosphor White, 300ms | `label:has(input:focus-visible)` gets the focus ring | Checked: Carbon Veil fill and a filled posting square before the text, instant | `mi-control` |
| Add line button | Background Ground to Carbon Veil, 300ms; border stays Phosphor White | Focus ring | Instant, no transform; `aria-disabled` is never used, a repeat press re-runs the sequence per the interruption rule (6e) | `mi-default` |
| Chip (inside a line) | Not interactive; follows its line | n/a | n/a | `mi-chip` |
| SAMPLE chip, hint, note, slot | Not interactive | n/a | n/a | none |

Trace rules. State is `pinned` (set by press, cleared by press on the same control or `Escape` while focus is inside the panel), `hover`, `focus`. The traced item is `pinned ?? hover ?? focus`. Two simultaneous paths from one line to two facts use channel offsets of -4px and +4px so they never overlap. Pinned traces persist across blur. Pressing Add line clears any pin and hover trace first.

### 6d. Signature sequences

**`sq-cite-save` (preset 1, "Built REST services in TypeScript for an internal billing tool")**

| Time | What | Property | Duration and easing |
| --- | --- | --- | --- |
| 0ms (press) | `data-cite-state="saving"`; new `li` is inserted after diff[3] with a 1px `--good` left rule; it enters with `en-row-print` (`opacity` 0 to 1, `translateY` 6px to 0) | transform, opacity | 240ms `--dur-row`, `--ease-post` |
| 120 to 540ms | Path draws from the new line to fact #07; the new line becomes the pinned trace (fact #07 lit) | `stroke-dashoffset` 1 to 0 | 420ms `--dur-print`, `--ease-post`, delay `--lp-cite-t-trace` |
| 540ms | `data-cite-state="saved"`; status "Saved." (`--good`) plus " Cites fact #07." appears in the reserved status line; no motion; fact #07 used-by count becomes 2 | none | n/a |

The status line has a reserved height of 24px so the text never shifts layout. The row insertion grows the diff block by one row; that layout change is user-initiated within 500ms of input and outside CLS.

**`sq-cite-refuse` (preset 2, "Led a team of 6 engineers"): the signature moment**

| Step | Time | What | Property | Duration and easing | Preset |
| --- | --- | --- | --- | --- | --- |
| 1 | 0ms (press) | `data-cite-state="refusing"`. Any pin is cleared. The slot swaps its placeholder for the candidate line (instant, full opacity). A thread starts at the slot's right edge | none | 0 | none |
| 2 | 0 to 300ms | Thread draws toward the facts and stops 70% of the way along its path | `stroke-dashoffset` 1 to 0.30 | 300ms `--dur-colour`, `--ease-post` | `en-path-draw` |
| 3 | 300 to 420ms | Lock bracket `[ ]` appears centred on the thread's tip and closes: each half moves 4px toward the other (gap 20px to 12px) | `opacity` 0 to 1 (120ms linear) and `transform: translate` ±4px to 0 | 120ms `--dur-swap`, `--ease-post` | none (`--dist-bracket`) |
| 4 | 420 to 660ms | Thread withdraws through the closed bracket | `stroke-dashoffset` 0.30 to 1 | 240ms `--dur-row`, `--ease-retract` | `ex-retract` |
| 4b | 420ms | `role="alert"` text inserted: "Not saved." (`--bad`) plus " This line cites no confirmed fact." Announced at once | none | 0 | none |
| 5 | 480 to 1,142ms | The 20 glyphs fall and fade, left to right, 18ms apart; spaces do not animate | `transform: translateY` 0 to 14px (`--dist-fall`), `opacity` 1 to 0 | 320ms `--dur-fall` each, `--ease-retract`, delay `calc(var(--lp-cite-t-fall) + var(--i) * var(--stagger-char))` | `kt-letter-fall` |
| 6 | 1,160ms | `data-cite-state="refused"`. The slot shows its placeholder again (the line is already invisible). The bracket stays closed as a resting mark until the next Add line, a trace, or `Escape` | none | 0 | none |

Total 1,160ms, one animation group (MS 3.4). The sequence ends and nothing loops. Geometry of the thread and bracket is in 6f.

### 6e. Interruption, retrigger, scroll

- Pressing Add line while a sequence runs first jumps the running sequence to its final state (state set to `saved` or `refused`, status written, timers cleared), then starts the new one. For a repeat refusal: set `data-cite-state="idle"` (all refusal rules use `transition: none; animation: none` in `idle`, so letters, thread and bracket reset instantly), force a reflow (`void root.offsetWidth`), then set `refusing`. The alert node is remounted with a new React `key` per run so the same sentence is announced again.
- Scroll never interrupts a running sequence. If a second group starts (for example entry 04 posts during the refusal), the two-group limit holds and neither waits.
- Changing Motion to Reduced while a sequence runs calls the final-state jump immediately (`subscribeMotion` listener).

### 6f. Geometry of the thread and the bracket (CitationDemo measures; CSS draws)

A layout effect (after mount only, so the server and first client render match) measures and writes `d` for each path inside the strip SVG, whose local origin is its top-left corner. It re-runs from one `ResizeObserver` on `.lp-cite` (batched in `requestAnimationFrame`), after `document.fonts.ready`, and after a line is inserted.

- Desktop and tablet (strip between diff and facts, width w = 48 or 40): `M 0 y1 H xm V y2 H w`, with `xm = w / 2 + offset`. `y1` is the vertical centre of the source (line button, or the slot), `y2` the vertical centre of the target (fact button; for the refusal, the vertical centre of the whole facts list). Offsets: -4px for the first cited fact and +4px for the second when a line cites two; 0 otherwise.
- Stacked (strip 24px wide at the right of the main column): `M 0 y1 H xm V y2 H 0`, with `xm = 12 + offset`. Source and target both end at the strip's left edge (the right edge of the line and fact buttons).
- Every path has `pathLength="1"`, `stroke-dasharray: 1`, base `stroke-dashoffset: 1`. Edges that can exist are pre-rendered once measured: line d1 to #07 and #12, line d3 to #11 and #14, the saved line to #07 (rendered only after it exists), and one `data-edge="refuse"` path. Drawn state is `data-on="true"` (offset 0).
- Bracket position: the tip is `getPointAtLength(0.7 * getTotalLength())` of the refuse path. Rotation is 0 when the tangent (difference between the points at 0.69 and 0.71 of the length) is vertical and 90 degrees when horizontal. The bracket group is translated to the tip and scaled by `--lp-cite-bracket-scale`. Each half is a 6 by 14px 1px stroke (`[` and `]`), open gap 20px, closed gap 12px.

---

### 6g. Hand-off to the next section

| Hand-off | Trigger | Value |
| --- | --- | --- |
| Canvas pose | `entry-04-approve` `u` 0 to 0.25 (about 383px of scroll at 1440 by 900) | `slip-cite` to `slip-hold`: offset (-0.04, 0, 0.2), rotation (0, -4, 0), scale 0.96 to 1.00, pointer tilt off, nothing prints on scroll in entry 04 |
| Lime custody | Any pixel of the entry 04 "Approve sample draft" button enters the viewport | `navbar` button returns to its fallback over 150ms, then the Approve button turns lime over 150ms (`ho-lime`). The demo here has no lime and is unaffected |
| Ledger rail, tape, caption | Entry 04 posts at 85% | Active entry becomes 04. The tape's latest line is `03 · Resume v3 · every line cites a confirmed fact` until entry 04 prints |
| Demo state | Visitor scrolls on | Nothing resets. State is local to the island and lost on reload; it is never written to `sessionStorage` or `ledgerStore` |
| Running refusal at hand-off | Entry 04 posts while a refusal runs | Both run (limit 2 groups). Entry 04's rule draws and title rises; the refusal completes in its own time |

---

## 7. Reduced-motion, no-JS and low-tier variants

### 7.1 Reduced motion (OS setting, or "Reduced" in the footer Motion control; `html[data-motion="reduced"]`)

| Item | Behaviour |
| --- | --- |
| Entry rule, ticks, H2 | Drawn and in place at first paint; no `data-post` hidden state; no SplitText |
| Settlement square | Filled at 300ms colour transition only if it is not yet posted when seen (colour is kept under Reduced) |
| Trace | Colour changes keep their 300ms (colour is not motion). Paths appear and disappear in one frame with no draw (`stroke-dashoffset` 0 or 1 set with `transition: none`) |
| Save | Row appears in place, no `en-row-print`; the path appears drawn; state goes to `saved` at once; status text identical |
| Refusal | State goes `refusing` then `refused` in the same frame. No thread, no bracket (`display: none` under Reduced), no letter fall (the candidate line is not shown). The alert text is identical and announced immediately. The Add line button can be pressed again and re-announces |
| Canvas | Not loaded. DOM lane list appends the `l03` row without animation. `ho-pose` is not applied |

### 7.2 No JavaScript

The server HTML already contains the full entry: H2, body, detail, panel header, the four diff lines with chips, the four facts, the hint (fine-pointer variant visible), the Try fieldset, the demo note and the settlement line with the square rendered filled (final state, absent `data-post`). The Try `fieldset` is rendered with the `disabled` attribute and enabled in an effect on mount, so a no-JS visitor sees inert controls beside the demo note, which already states the rule in words. There are no strip paths, no bracket and no status text. Nothing is hidden by default, so nothing needs JavaScript to be readable.

### 7.3 Below 1024px

No GSAP, no Lenis, no canvas. `kt-title-rise` (CSS, whole title in one mask) replaces `kt-line-rise`; `EntryPoster` provides the post for the rule and square. The panel demo is unchanged except for the stacked layout and the touch hint ("Tap a line to see which facts it cites. Tap again to clear."). Tap on a line or fact toggles the pin. Hover styles do not apply on touch.

### 7.4 Canvas tiers (1024 and wider)

| Tier | Entry 03 behaviour |
| --- | --- |
| T2 (WebGL, full) | Pose scrub, `l03` print as in section 5 |
| T1 (lite) | Same at 30fps, straight paper; the section is unaffected |
| T0 (no WebGL, motion allowed) | DOM lane receipt appends `l03` with `en-row-print`; the section is unaffected |
| Canvas context loss | Lane falls back to the DOM receipt list; the section is unaffected |

### 7.5 Other

- `save-data` and low-end devices change nothing in this section (no assets).
- `forced-colors: active`: path and bracket strokes use `CanvasText`, chip and fact borders use `ButtonText`, the strike uses `CanvasText`; status words keep their text and rely on the words "Saved." and "Not saved." for meaning.
- Print stylesheet: not specified for the landing.

---

## 8. Accessibility

### 8.1 Landmarks, headings and names

| Element | Markup |
| --- | --- |
| Section | `<section id="entry-03" data-section="entry-03-truth-lock" data-entry="03" data-scene="slip-cite" aria-labelledby="entry-03-title" class="lp-entry">` (a named region) |
| H2 | `<h2 id="entry-03-title" tabindex="-1" data-split="lines" class="lp-heading">`; receives focus on anchor jumps from claim chips (`see 03`) |
| Head rule and ticks | `aria-hidden="true"`; the number "03" is real text |
| Panel | `div role="group" aria-labelledby="entry-03-diff-title"`. The group name is "Sample diff · resume v3", which begins with "Sample" |
| Panel headings | `h3#entry-03-diff-title` (diff title) and `h3` "Confirmed facts (sample)". No heading levels are skipped |
| SAMPLE chip | Accessible name "Sample data" |
| Diff list | `ol` with `aria-label` equal to the diff title; one `li` per line; the slot is a final `li` |
| Removed line | Plain `li` (not interactive) containing `<span class="sr-only">Removed: </span>` then the text. The strike is decoration |
| Added line | `li > button type="button" aria-pressed="false|true" aria-describedby="{id of uses text}"` containing `<span class="sr-only">Added: </span>`, the text, and the chip with `aria-hidden="true"` (the description supplies the citation, so it is not read twice) |
| Uses text | `<span id hidden>Cites facts #07 and #12.</span>` (`hidden` elements can be referenced by `aria-describedby`) |
| Facts | `ul > li > button type="button" aria-pressed` with visible text "#07 · Role · sample" as the accessible name |
| Try block | `fieldset` with `legend` "Try adding a line (sample)"; two native `input type="radio" name="entry-03-preset"` inside `label`s. Preset 1 label contains the chip (not hidden; its accessible name "Cites fact number 07" is part of the label). Preset 2 label ends with the visually hidden "Cites no fact." (flag F3) |
| Add line | `<button type="button">Add line</button>`. Never `aria-disabled`. Not a form submit |
| Settlement line | The square sits beside the words; a visually hidden "Posted." (`shared.postedAria`) follows it |

### 8.2 Live regions (all present in the server HTML, empty, so changes are announced)

| Region | Markup | Content |
| --- | --- | --- |
| Fact use | `<p class="sr-only" role="status" aria-live="polite">` | `factUsedByOne` or `factUsedBy`, written on fact focus or pin, not on hover |
| Save result | `<p class="lp-cite__status" role="status" aria-live="polite">` | "Saved. Cites fact #07." or "Already added. Cites fact #07." |
| Refusal | `<p class="lp-cite__status" role="alert">` | "Not saved. This line cites no confirmed fact." |

The save and refusal paragraphs overlap in one reserved 24px slot (only one has text). The previous message is cleared when Add line is pressed. The refusal element is remounted per run (new `key`).

### 8.3 Focus order and keyboard

Tab order (identical to DOM and visual order): added line 1, added line 2, [saved line if present], fact #07, #11, #12, #14, checked preset radio (arrow keys move within the group), Add line. Removed lines, hint, slot, note and chips are not tab stops. `Enter` or `Space` on a line or fact toggles its pin. `Escape` clears a pin only while focus is inside the panel and does not stop propagation otherwise. After pressing Add line, focus stays on the button; nothing moves focus. There are no focus traps.

All targets are at least 44px tall with at least 8px between neighbours. Chips are not targets.

### 8.4 Screen-reader text for visuals

| Visual | Text equivalent |
| --- | --- |
| Citation threads and strip | Decorative (`aria-hidden`); meaning is carried by `aria-describedby` on lines and the polite fact-use region |
| Lock bracket | Decorative; the refusal alert carries the meaning |
| Strike on removed lines | The visually hidden "Removed:" prefix |
| Refused line while it falls | `role="img" aria-label="Led a team of 6 engineers. Not saved."` on the wrapper; the 20 glyph spans are `aria-hidden` |
| Missing chip on preset 2 | "Cites no fact." |
| Lane canvas | `aria-hidden`; the lane `aside aria-label="Sample receipt"` carries the printed lines as a list (system-owned) |
| Posting square | Hidden-text pair "Posted." / "Pending." |

### 8.5 Contrast of every pairing used (computed against WCAG relative luminance)

| Pairing | Ratio | Requirement | Result |
| --- | --- | --- | --- |
| Phosphor White `#ddffdc` on Ground `#181818` (added lines, h3, legend, labels) | 16.41:1 | 4.5:1 | Pass |
| Phosphor White on Carbon Veil `#212525` (hover and checked rows) | 14.32:1 | 4.5:1 | Pass |
| Sage 60 `#8cab87` on Ground (body-size removed lines, hint, note, rest facts, slot text) | 7.01:1 | 4.5:1 | Pass |
| Sage 60 on Carbon Veil (removed line never sits on Carbon; hint and facts can) | 6.11:1 | 4.5:1 | Pass |
| Sage 60 on Void (body, detail) | 8.29:1 | 4.5:1 | Pass |
| Moss 70 `#9cbf93` on Void (number, eyebrow) | 10.29:1 | 4.5:1 | Pass |
| Moss 70 on Ground (SAMPLE chip text) | 8.70:1 | 4.5:1 | Pass |
| `--good` `#aed2a4` on Ground ("Saved.") | 10.62:1 | 4.5:1 | Pass |
| `--bad` `#ff8a80` on Ground ("Not saved.") | 7.78:1 | 4.5:1 | Pass |
| Fern Link `#859984` border on Ground (fact and preset borders, non-text) | 5.82:1 | 3:1 | Pass |
| Phosphor White at 60% (`#8ea38e`) path on Ground | 6.58:1 | 3:1 (not required; decorative) | Pass |
| Phosphor White bracket stroke on Ground | 16.41:1 | 3:1 | Pass |
| Strike `--bad` at 60% (`#a35c56`) on Ground | 3.57:1 | decorative, plus text prefix | Pass |
| Circuit Border on Ground (dashed panel edge, chip border, slot hairline) | 2.20:1 | decorative; never the only signal | Allowed (DS rule) |

Forbidden here, by DS: Sage 40 on Ground or Carbon; Deep Fern for any text; lime for anything.

### 8.6 Other

- No colour-only meaning: saved and refused differ by the words "Saved." and "Not saved."; lit versus unlit facts differ by border colour and the described citation text; the checked preset has a posting square in addition to its fill.
- Zoom to 200% and 400% reflow: the stacked layout covers narrow widths; no horizontal scroll at 320px (the longest unbreakable token is the 63-character sentence, which wraps at spaces; ids never hyphenate).
- Text spacing override (WCAG 1.4.12): rows grow; none has a fixed height except the slot (min-height, not height) and the 24px status line (min-height).
- The demo does not time out; there is no time limit.

---

## 9. Performance notes

| Topic | Spec |
| --- | --- |
| What animates | `transform` and `opacity` (row insertion, 20 letters, bracket halves, H2 mask content); `stroke-dashoffset` on at most 7 paths in a strip at most 48 by 560px (paint-only, far under the MS 400 by 200px-equivalent paint budget in area); `background-color`, `color`, `border-color` for traces. No layout property animates |
| Layers | At most 4 `will-change` hints (MS cap): set only by the state change that starts a sequence and removed on `transitionend` of the last glyph. The 20 glyph spans rely on the browser promoting transitions at start; no permanent hints |
| Element counts | Server DOM for the panel about 95 elements (4 diff lines plus slot, 4 facts, 2 presets, 20 glyph spans in a hidden wrapper, chips, labels, status). Client adds one SVG (up to 7 paths plus a 2-half bracket group) |
| Measurements | One `ResizeObserver` callback (batched in `requestAnimationFrame`) does all `getBoundingClientRect` reads in one pass, then all writes. No work on scroll. `document.fonts.ready` triggers one re-measure |
| JavaScript | `CitationDemo` island target 3 KB gzip (limit 4 KB) inside the 20 KB island budget. No animation library. `web/lib/landing/citation.ts` is pure and shared by the island and its test |
| CSS | About 2 KB gzip of `lp-cite` rules in `landing.css` and `motion.css` (part of the 25 KB CSS budget) |
| Assets | None. No image, no font file, no icon file, no video. The SVG is inline and generated |
| Network | No request from the demo. The chip text, ids and presets ship in the HTML |
| CLS | 0. Status line and slot have reserved min-heights; the row insertion on save is user-initiated; the H2 mask reserves its box (`padding-bottom: 0.12em; margin-bottom: -0.12em`) |
| INP | Add line handler does synchronous state writes and attribute changes only (target under 50ms); timers use `setTimeout`, cleared on unmount |
| Offscreen | CSS transitions stop with the page; the canvas pauses outside its range (system) |

---

## 10. Implementation

### 10.1 Files

| Path | Kind | Purpose |
| --- | --- | --- |
| `web/components/landing/entries/entry-03-truth-lock.tsx` | Server component `Entry03TruthLock` | Renders the section DOM contract, `Entry` shell (head, eyebrow, H2, body, detail), `SampleFrame`, `CitationDemo`, settlement line |
| `web/components/landing/islands/citation-demo.tsx` | Client component `CitationDemo` (`"use client"`) | State, trace, save and refuse sequences, geometry. Props below |
| `web/lib/landing/citation.ts` | Pure module | `canSave`, `factsOf`, `linesCiting`, `edgePath`, `bracketPose`, constants `CITE_SAVE_END_MS = 540`, `CITE_REFUSE_END_MS = 1160` |
| `web/lib/landing/citation.test.ts` | Vitest | Unit tests (11.3) |
| `web/content/truth-lock-sample.ts` | Data | Ids only: facts `07 Role`, `11 Dates`, `12 Tool`, `14 Tool`; lines `d0 removed`, `d1 added cites [07,12]`, `d2 removed`, `d3 added cites [11,14]`; presets `p0 cites [07]`, `p1 cites []`. Text always comes from `landingCopy["entry-03-truth-lock"]` |
| `web/content/landing-copy.ts` | Copy | Add keys F1 to F5 (section 2.4) |
| `web/components/landing/landing.css` | CSS | `.lp-cite` block: grid, rows, chips, strip, status, tokens `--lp-cite-*` |
| `web/components/landing/motion.css` | CSS | `data-cite-state` machine, trace transitions, letter fall, reduced rules |
| `web/e2e/landing-entry-03.spec.ts` | Playwright | Section 11 checks |

### 10.2 Props and boundaries

```ts
// entry-03-truth-lock.tsx  [S]
export function Entry03TruthLock(): JSX.Element;   // reads landingCopy["entry-03-truth-lock"] and shared

// citation-demo.tsx  [C]
export interface CitationDemoProps {
  copy: CitationCopy;   // the demo keys of landingCopy["entry-03-truth-lock"]: diff, facts, chips, presets, results, aria, notes (a serialisable subset, so the whole copy file is not shipped to the client)
}
export function CitationDemo(props: CitationDemoProps): JSX.Element;

// citation.ts  [M]
export type CiteState = "idle" | "saving" | "saved" | "refusing" | "refused";
export function canSave(cites: readonly string[]): boolean;                 // true only if cites is non-empty and every id is in FACTS
export function factsOf(lineKey: string): readonly string[];
export function linesCiting(factId: string, extraLines?: readonly { key: string; cites: readonly string[] }[]): readonly string[];
export function edgePath(a: { y1: number; y2: number; w: number; stacked: boolean; offset: number }): string; // "M 0 y1 H xm V y2 H w|0"
export function bracketPose(path: SVGPathElement): { x: number; y: number; rotate: 0 | 90 };
```

The island is the only client code in the entry. It holds React state `{ cite: CiteState, checked: "p0" | "p1", saved: boolean, pinned, hover, focus, status, alertKey }`. It never imports `ledgerStore`. It decides refusal by `canSave(preset.cites)`, not by a hard-coded id, so the rule shown is the rule coded. It reads `getEffectiveMotion()` and `subscribeMotion` from `web/lib/motion/preference.ts` to short-circuit to final states. The root carries `data-cite-state`, and each lit line, fact and chip carries `data-lit="true"`; paths carry `data-edge` and `data-on`. All colour and draw transitions are CSS; React only flips attributes.

Server-render parity: the first client render equals the server HTML (no strip paths, no status text, fieldset disabled, state `idle`). Use `useId` for `aria-describedby` ids. Do not use `Math.random`, `Date` or `window` during render.

### 10.3 Presets and tokens used

Presets: `en-post-rule`, `en-post-square`, `kt-line-rise`, `kt-title-rise`, `en-row-print`, `en-path-draw`, `em-trace`, `ex-retract`, `kt-letter-fall`, `ho-pose` (system), `em-print` (system), `ho-lime` (observed only), `mi-trace`, `mi-chip`, `mi-control`, `mi-default`, `mi-focus`, sequences `sq-cite-save`, `sq-cite-refuse`.

Tokens: `--type-heading-landing`, `--lh-heading-landing`, `--tracking-heading-landing`, `--measure-body`, `--measure-title`, `--sample-border`, `--section-pad-landing`, `--lp-head-h`, `--lp-hit`, `--lp-hit-gap`, `--lp-z-content`, `--ease-post`, `--ease-retract`, `--ease-utility`, `--ease-linear`, `--dur-swap`, `--dur-row`, `--dur-colour`, `--dur-fall`, `--dur-print`, `--dur-post`, `--dur-rise`, `--stagger-char`, `--dist-fall`, `--dist-bracket`, `--rise-line`, plus section 4.3 additions. Colour tokens: `--background`, `--surface`, `--surface-raised`, `--foreground`, `--body`, `--label`, `--link`, `--border`, `--good`, `--bad`.

### 10.4 Existing and planned components reused

| Component | Source | Use |
| --- | --- | --- |
| `Entry` shell | `entries/entry.tsx` (AR 1.1) | Head (M1, M2), eyebrow, H2 with mask markup, section DOM contract |
| `SampleFrame` | `marks/sample-frame.tsx` | Dashed Ground panel with SAMPLE chip at top right. Needs a heading slot (`headingId`, `heading`) rendering `role="group" aria-labelledby`; if the final prop names differ, keep this behaviour |
| `CitationChip`, `SampleChip` | `marks/chip.tsx` | M4 and M6. Chip takes `ids: string[]`, builds the visible text from `chipSingle` or `chipMany` and sets its accessible name; accepts `hidden` for the in-button case |
| `PostingSquare` | `marks/posting-square.tsx` | Settlement line and checked preset |
| `Button` | `components/shared/button.tsx` | Add line: `variant="secondary"` (Ground fill, Phosphor White border after P2) with `className="h-11 px-5 rounded-button hover:bg-surface-raised"`. Not `primary` (lime) |
| `EntryPoster`, `SettleCell`, scene driver, lane receipt | system | Posting, row 02 flip, pose and print. This entry adds no code to them |
| `cn` | `lib/utils` | Class merge |

Dependencies on other changes: P2 (token migration of `button.tsx`) before the Add line button can be built to spec; `fit-sample.json` is not needed here.

### 10.5 CSS contract (selectors the engineer writes)

```css
/* landing.css */
.lp-cite { position: relative; display: grid; grid-template-columns: minmax(0,1fr) var(--lp-cite-gutter) var(--lp-cite-facts-w); column-gap: 0; }
.lp-cite__strip { grid-column: 2; grid-row: 1; pointer-events: none; overflow: visible; }
.lp-cite__edge { fill: none; stroke: color-mix(in srgb, var(--foreground) 60%, transparent); stroke-width: 1; stroke-dasharray: 1; stroke-dashoffset: 1;
  transition: stroke-dashoffset var(--dur-colour) var(--ease-post); }
.lp-cite__edge[data-on="true"] { stroke-dashoffset: 0; }

/* motion.css */
.lp-cite[data-cite-state="saving"] .lp-cite__edge[data-speed="saved"] { transition-duration: var(--dur-print); transition-delay: var(--lp-cite-t-trace); }
.lp-cite__edge[data-edge="refuse"] { stroke-dashoffset: 1; }
.lp-cite[data-cite-state="refusing"] .lp-cite__edge[data-edge="refuse"] {
  animation: cite-thread-in var(--dur-colour) var(--ease-post) forwards,
             cite-thread-out var(--dur-row) var(--ease-retract) var(--lp-cite-t-retract) forwards; }
@keyframes cite-thread-in  { from { stroke-dashoffset: 1; }    to { stroke-dashoffset: 0.30; } }
@keyframes cite-thread-out { from { stroke-dashoffset: 0.30; } to { stroke-dashoffset: 1; } }

.lp-cite__bracket { opacity: 0; transition: none; }
.lp-cite__bracket [data-half="l"] { transform: translateX(calc(var(--dist-bracket) * -1)); }
.lp-cite__bracket [data-half="r"] { transform: translateX(var(--dist-bracket)); }
.lp-cite[data-cite-state="refusing"] .lp-cite__bracket,
.lp-cite[data-cite-state="refused"]  .lp-cite__bracket { opacity: 1; transition: opacity var(--dur-swap) linear var(--lp-cite-t-bracket); }
.lp-cite[data-cite-state="refusing"] .lp-cite__bracket [data-half],
.lp-cite[data-cite-state="refused"]  .lp-cite__bracket [data-half] { transform: none; transition: transform var(--dur-swap) var(--ease-post) var(--lp-cite-t-bracket); }

.kt-letter-fall [style*="--i"] { display: inline-block; }
.lp-cite[data-cite-state="refusing"] .kt-letter-fall [style*="--i"],
.lp-cite[data-cite-state="refused"]  .kt-letter-fall [style*="--i"] {
  transform: translateY(var(--dist-fall)); opacity: 0;
  transition: transform var(--dur-fall) var(--ease-retract) calc(var(--lp-cite-t-fall) + var(--i) * var(--stagger-char)),
              opacity   var(--dur-fall) var(--ease-retract) calc(var(--lp-cite-t-fall) + var(--i) * var(--stagger-char)); }

html[data-motion="reduced"] .lp-cite .lp-cite__bracket,
html[data-motion="reduced"] .lp-cite .lp-cite__edge[data-edge="refuse"] { display: none; }
```

Note on the thread animation: `cite-thread-in` holds 0.30 (fill `forwards`) through the 120ms pause until `cite-thread-out` takes over at 420ms; in `idle` and `refused` the animation is removed and the base offset 1 applies, which is the same value, so there is no visible change at 1,160ms.

---

## 11. Acceptance criteria

### 11.1 Content and structure

- [ ] The section has `id="entry-03"`, `data-section="entry-03-truth-lock"`, `data-entry="03"`, `data-scene="slip-cite"`, `aria-labelledby="entry-03-title"`, and the H2 has `tabindex="-1"`.
- [ ] All strings in 2.1 to 2.3 appear verbatim in the server HTML (disable JavaScript and assert with `toHaveText`), plus the F1 to F5 additions. `h2Alt` is absent from the DOM.
- [ ] No string in the entry contains U+2014 or U+2013 (lint over `landing-copy.ts` and a DOM text scan).
- [ ] The panel has the SAMPLE chip (accessible name "Sample data"), a computed `border-style: dashed`, and a group name beginning "Sample".
- [ ] The panel is the only element in the entry with a dashed border; focus rings, slot hairline, chips and dividers are solid.
- [ ] There is no testimonial, count, logo, rating or metric in the entry. The only digits are sample ids, "2023 to 2024", the "6" of the refused preset, "02", "03" and "07".
- [ ] DOM order is: diff block, facts block, Try block, note, at every width.

### 11.2 Layout and visual (Playwright with viewports 1440x900, 1280x800, 1024x768, 768x1024, 390x844, 360x640)

- [ ] At 1440 and 1280 the panel box is 696px wide; diff column 396px; strip 48px; facts 188px. At 1024 the panel is 547px (545 to 549), strip 40px, facts 156px. At 768 the panel is 704px. At 360 the panel is 328px and the main column 264px.
- [ ] H2 computed font-size: 55.7px (55 to 56) at 1440, 52.2px (51.5 to 53) at 1280, 46.5px (46 to 47) at 1024, 40.9px (40.5 to 41.5) at 768, 36px at 360. Weight 400. H2 renders on 2 lines at 1440, 1024 and 390 with the break after "cannot".
- [ ] Computed font-weight of every text node in the entry is 400 or 500.
- [ ] No horizontal scroll (`document.documentElement.scrollWidth <= clientWidth`) at 360, 390 and 768.
- [ ] Every interactive element has a bounding box of at least 44px high, and the gap between neighbouring interactive boxes is at least 8px.
- [ ] No element in the entry has a computed `background-color` of `rgb(127, 238, 100)` or `rgb(109, 219, 87)`, and none has such a `color`, `border-color`, `outline-color`, `fill`, `stroke` or `box-shadow` value (DS L10). The Add line button is not lime when the owner is `navbar`, `approve` or any other.
- [ ] The section contains no `box-shadow` other than `none`, no gradient, and no `text-shadow`.
- [ ] Removed lines have computed colour `rgb(140, 171, 135)` and a line-through; added lines `rgb(221, 255, 220)`.
- [ ] The 03 tick of the head is 8px tall and Phosphor White; the other ten are 4px.
- [ ] At 1440 the canvas lane (columns 9 to 12) and the panel do not intersect (bounding boxes).

### 11.3 Unit tests (`citation.test.ts`)

- [ ] `canSave(["07"])` is true; `canSave([])` is false; `canSave(["99"])` is false; `canSave(["07","99"])` is false.
- [ ] `linesCiting("07")` is `["d1"]` at load and `["d1","p0"]` once the preset is saved.
- [ ] `factsOf("d1")` is `["07","12"]`; `factsOf("d3")` is `["11","14"]`.
- [ ] `edgePath` returns `"M 0 40 H 24 V 120 H 48"` for `{ y1: 40, y2: 120, w: 48, stacked: false, offset: 0 }` and `"M 0 40 H 12 V 120 H 0"` for the stacked equivalent; offsets of -4 and +4 shift `xm` by exactly 4.
- [ ] The preset list contains exactly two presets and the second has no cites.

### 11.4 Motion (Playwright, Full motion, 1440x900, with `window.__kairosMotion` when `NEXT_PUBLIC_E2E=1`)

- [ ] Scrolling the section top above 85% of the viewport sets `data-post` to `live` once; the rule's computed transform goes from `scaleX(0)` to `scaleX(1)` over 600ms (+/- 60ms); the H2 content finishes by 850ms (+/- 80ms).
- [ ] Body, detail, panel, diff and facts have computed `opacity: 1` and no transform at all times (no entrance).
- [ ] A scroll-through never changes `data-cite-state` (stays `idle`) and never writes to `ledgerStore` (`window.__kairos.ledger` unchanged apart from `posted` and `printed`).
- [ ] Hover (and focus) on added line 1 turns facts #07 and #12 to Phosphor White (300ms +/- 40) and sets `data-on="true"` on exactly the two paths for d1; leaving reverses both in 300ms. Hover on fact #07 lights d1 only and the chip border of d1 becomes Phosphor White.
- [ ] Pressing Add line with preset 1: within 100ms `data-cite-state` is `saving` and a new `li` exists; at 540ms (+/- 60) it is `saved`; status text equals "Saved. Cites fact #07."; fact #07 is pinned and its use region reads "Fact #07 is used by 2 lines." on focus. Pressing again shows "Already added. Cites fact #07." and adds no second row.
- [ ] Pressing Add line with preset 2, sampled at 100ms steps: 0 to 300ms the refuse path `stroke-dashoffset` falls from 1 to 0.30 (reads 0.30 +/- 0.03 at 300ms); the bracket is invisible before 300ms, visible with halves translated ±4px at 300ms and at `transform: none` by 420ms; the offset returns to 1 by 660ms (+/- 60); the alert text is present at 420ms (+/- 60); the 20 glyphs reach `opacity: 0` by 1,142ms (+/- 80); `data-cite-state` is `refused` at 1,160ms (+/- 80). The bracket remains visible after `refused`.
- [ ] Glyph count in the refused line wrapper is exactly 20 and the wrapper has `role="img"` and `aria-label="Led a team of 6 engineers. Not saved."`.
- [ ] The retraction uses `cubic-bezier(0.7, 0, 0.84, 0)` (assert the computed `animation-timing-function` of `cite-thread-out`), and the glyph transitions use the same curve, 320ms each, 18ms apart in delay.
- [ ] Pressing Add line twice in 300ms leaves one completed sequence in `refused` (no stacked states, no leftover glyph opacity) and re-announces the alert (the alert node `key` changes).
- [ ] The entry never runs more than 2 animation groups at once while entry 04 posts during a refusal.
- [ ] Canvas: at `u` = 0.25 the applied rotation is (2, -10, 0) within 0.05 degrees; `l03` is in `printed` exactly once after scrolling through, back and forward.
- [ ] Changing Motion to Reduced during a refusal makes the state `refused` in the same frame.

### 11.5 Reduced motion, no JavaScript, tiers

- [ ] With `reducedMotion: "reduce"`: no `<canvas>` exists, H2 is in place without SplitText nodes, pressing Add line with preset 2 reaches `refused` in under 50ms with the alert text present and no bracket or thread visible; the trace changes colour in 300ms and shows paths without a draw (`transition-duration` of `stroke-dashoffset` is 0.01ms or less).
- [ ] With JavaScript disabled: all copy is present and readable; the Try `fieldset` is `disabled`; nothing is `hidden` except the F-listed elements that are empty by design; no console error.
- [ ] Below 1024 (390x844): no GSAP chunk, no canvas request; title rise uses CSS; the touch hint is visible and the fine-pointer hint is not in the accessibility tree (`display: none`).
- [ ] Tap on added line 1 sets `aria-pressed="true"` and draws the strip paths; a second tap clears them; tap on a fact does the same.

### 11.6 Accessibility

- [ ] axe-core reports no violations in the section at 1440 and 390 (rules for names, roles, contrast, targets).
- [ ] Tab order is: added line 1, added line 2, fact #07, #11, #12, #14, the checked radio, Add line (and the saved line between line 2 and the facts after saving). Arrow keys change the radio.
- [ ] Removed lines expose "Removed:" and added lines expose "Added:" in their accessible text; each added line has `aria-describedby` resolving to "Cites facts #07 and #12." or "Cites facts #11 and #14."; their chips are `aria-hidden`.
- [ ] The refusal text is the only element with `role="alert"` in the entry, and it is empty until the refusal. The save status is `role="status"`.
- [ ] Contrast ratios in 8.5 hold when measured on rendered colours (tolerance 0.05).
- [ ] The focus ring is a solid 2px Phosphor White outline with 2px offset on every interactive element, appears with no transition, and is never clipped by the panel (the panel has no `overflow: hidden`).
- [ ] Following the claim chip `see 03` from entry 01, 08 or 09 lands with the H2 focused and visible below the navbar (and the tape below 1024).
- [ ] At 200% and 400% zoom (viewport 320 wide equivalent) no content is lost and no horizontal scroll occurs.

### 11.7 Performance

- [ ] CLS contributed by the section is 0 (entering the section, hydration, the save, the refusal).
- [ ] `CitationDemo` and `citation.ts` add 4 KB gzip or less to the islands chunk; no new network request occurs from the section.
- [ ] No more than 4 `will-change` declarations are present at once; none after a sequence ends.
- [ ] During a refusal, no frame exceeds 16.7ms on the CI reference profile (4x CPU throttle: no long task over 50ms).
- [ ] Section DOM contains no more than 130 elements in the panel after hydration, and exactly one `<svg>` in the entry.
