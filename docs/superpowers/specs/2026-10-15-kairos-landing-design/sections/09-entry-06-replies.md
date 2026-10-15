# Entry 06 "Replies and the open row": section specification

Section id `entry-06-replies`, anchor `#entry-06`, tier standard, scene state `slip-reply`, scroll length 90vh (a floor of `min-height: 90svh` at 1024px and wider; the real height is set by content). Previous entry: `entry-05-send-receipt` (mint band, WebGL `slip-tear` or `ghost-path`). Next entry: `entry-07-billing` (no WebGL).

Sources used: `01-creative-direction.md` (CD), `02-design-system.md` (DS), `03-motion-system.md` (MS), `04-webgl-scene.md` (WS), `05-architecture.md` (AR), `06-copy-deck.md` (CP). Section references such as "MS 3.3" mean section 3.3 of that document.

---

## 1. Purpose and narrative beat

**Purpose.** Explain reply tracking in two sentences of body copy and one demo, then state plainly the one thing the page cannot promise. The entry does two jobs in order:

1. Explain the mechanism. The visitor sets one forwarding filter. Replies about their applications arrive at a private address Kairos gives them. There is no Gmail login and no Gmail access. Each reply is tagged to the application it answers. A three-row sample inbox shows what "tagged" looks like.
2. Close the open debit. Entry 01 posted five reported problems as open rows. Four were settled in writing by entries 02, 03, 04 and 07. Row 04 ("Hundreds of applications and zero interviews") has an entry 01 cell that reads "open · see 06" and never changes. This entry is where "see 06" lands. It explains why row 04 stays open, in one sentence.

**Narrative beat.** The open row: the page states plainly what it cannot promise. Every earlier entry in the ledger ends with a filled posting square (a settlement). This entry ends with the only empty one. Accountability here means refusing to print a number that has not been measured.

**What the visitor should feel.** After a loud middle of the page (a 2.4 second feed, a refusal, an approval, a tear, a page that turns to paper), the screen goes quiet. There is a lot of black. One bright rule draws, one hollow square appears, and one sentence turns from soft green-grey to full Phosphor White, one clause at a time. Nothing else in the viewport moves. The visitor reads it and trusts the page more, because it is the one place where the page says no.

**Why this is the signature of the entry.** It is a restraint moment, not a spectacle. Its power comes from contrast with entries 02 to 05 (everything there was settled, filled, printed or torn) and from the fact that the sentence is readable from the first painted frame. The motion only changes how it arrives, never whether it can be read (MS principle P6).

**This entry settles nothing.** It renders no filled posting square and calls no `SettleCell`. Row 04 in entry 01 is a static cell, not an island, and it must still read "open · see 06" after this entry posts.

---

## 2. Content (final copy from 06-copy-deck.md, verbatim; flag any change you need and why)

Copy is read from `landingCopy["entry-06-replies"]` in `web/content/landing-copy.ts`. The component never writes a literal string. Keys, element roles and text are copied from CP section 11.

| Key | Element and role | Text (verbatim) |
| --- | --- | --- |
| `entry-06-replies.number` | Entry number in the entry head (M1), Caption | 06 |
| `entry-06-replies.eyebrow` | Eyebrow, Caption, uppercase | Replies |
| `entry-06-replies.h2` | H2, `lp-heading` | Replies come to an address you control. |
| `entry-06-replies.body` | Body, `lp-body` | You set one forwarding filter, and replies about your applications come to a private address we give you. No Gmail login, no Gmail access. Kairos tags each reply to the application it belongs to. |
| `entry-06-replies.body2` | Second body paragraph, `lp-body`. Ships only when reply tracking and AC12 are confirmed; otherwise the key is `undefined` and nothing renders | When a reply you forward is an offer, we pause your billing. |
| `entry-06-replies.inboxTitle` | Panel heading, h3, `lp-title` | Sample inbox |
| `entry-06-replies.inbox[0]` | Inbox row 1 | Reply · tagged to application 0233 |
| `entry-06-replies.inbox[1]` | Inbox row 2 | Interview request · tagged to application 0233 |
| `entry-06-replies.inbox[2]` | Inbox row 3 | Offer · billing paused |
| `entry-06-replies.inboxNote` | Note under the rows, 14px | Sample rows. Nothing here came from an employer. |
| `entry-06-replies.openRow` | The open row, Lead size, Phosphor White | Row 04 stays open. We cannot promise interviews, and we will not print a number we have not measured. We can show you every application, every skip and every reply. |
| `entry-06-replies.openRowSquareAria` | Visually hidden text before the open row | Open. |
| `shared.sampleChip` | SAMPLE chip text; accessible name "Sample data" | SAMPLE |
| `scene.lines.06` | Receipt line printed on the slip (and in the lane list and the mobile tape) | 06 · Reply tagged to its application |

Gated variants (gate G3, CP section 11):

- `body` becomes "... Reply tracking (in beta) tags each reply to the application it belongs to." The copy module resolves this at build. The component reads `c.body` and never branches.
- `body2` is omitted entirely (the key is absent, not an empty string). No empty paragraph and no leftover 16px gap may render.
- `inbox[2]` becomes "Offer · tagged to application 0233".

Applied rules: the middle dot U+00B7 is the only separator; there are no em or en dashes; the page prints no outcome numbers; the entry carries no claim chip and no number that is not a sample id. The id 0233 is a sample posting id and must exist as a PASS in `web/content/fit-sample.json` (see acceptance criterion 17), so the inbox id is the same id that entry 02's receipt feed prints as "PASS · 0233 · goes to scoring".

**Sentence structure of the open row.** The open row is exactly three sentences, split at ". " boundaries by the component: (1) "Row 04 stays open." (2) "We cannot promise interviews, and we will not print a number we have not measured." (3) "We can show you every application, every skip and every reply." A unit test asserts the split yields three sentences and that joining them with one space returns the copy string exactly.

### Changes and additions flagged

No copy string changes. The following non-copy changes are needed; each has a reason.

| # | Change | Reason |
| --- | --- | --- |
| F1 | Open row uses Phosphor White at lead size (a modifier on `lp-lead`, class `lp-open-row`). DS 3.1 sets the lead role in Moss 80. | CP and CD both specify Phosphor White for this sentence. It is the page's most accountable line and gets the strongest text colour. |
| F2 | New posting square state `open`: 6px, 1px solid Phosphor White, transparent fill, never fills. DS 6.3 defines only posted (filled) and pending (Circuit Border outline). | Pending means "will settle". Open means "stays unsettled by design". Circuit Border on Void is 2.6:1 and would make the signature square nearly invisible. **Cross-section recommendation:** entry 01's row 04 cell should use the same `open` state, because that cell never changes. If the owner declines, entry 01 keeps `pending` and this entry still uses `open`. |
| F3 | One new CSS sequence id `sq-open-row`, built only from existing tokens plus two new landing-only tokens: `--stagger-sentence: 240ms` (reading cadence of three sentences, spread 480ms, inside the 500ms stagger cap in MS 2.3) and `--delay-open-ink: 300ms` (ink starts after the square lands). A third token `--delay-open-row` is an alias of `--delay-feed-stop` (200ms), the stillness before the post. All three are zeroed under reduced motion. | MS has no preset for a posted sentence. Reusing `kt-ink` is not possible because it is a first-paint keyframe on the hero H1. |
| F4 | Below 1024px `.lp-entry` needs `scroll-margin-top: 128px` (64px navbar + 48px tape + 16px air), not the 80px in DS 4.2. | The tape is sticky under the navbar from entry 02 on. At 80px the entry head would be hidden under the tape after an anchor jump (rail, "open · see 06" link, skip links). This affects every entry from 02, not only this one. |
| F5 | Entry 06 gets `padding-top: 64px` (48px below 1024px) instead of 0. | DS 4.2 assumes the previous entry's bottom padding is the gap, but entry 05 ends in a mint band with a perforated bottom edge. The gap between that edge and the entry 06 head row must be explicit Void. |
| F6 | The canvas fade-out threshold is entry 07 top at 70% of the viewport, not 85%. | WS 5.5 says 85%. MS 3.6 (`ex-canvas-out`) and MS 5.3 both say 70% and agree with each other. MS owns the ScrollTrigger table and 70% keeps the slip beside the open row for longer. WS should be updated to match. |
| F7 | A render-nothing client island `OpenRow` drives the post of the sentence and, only in modes where the scene driver is not running, prints line 06. | The open row needs its own trigger (it sits low in a tall entry) and the below-1024px, reduced and no-GSAP paths need something to call `ledgerStore.print("06")`. If AR/MS confirm that another module already prints 06 in those modes, delete the fallback in 6(a) step B and keep the rest. |
| F8 | Status words in the inbox are Phosphor White, not status colours. | A green "Offer" is the most persuasive pixel on the page and would imply a typical outcome. The page refuses to print an unmeasured number, so it also refuses to colour an unmeasured outcome. |

Considered and rejected: a recap line quoting row 04's text above the open row (the sentence is self-contained, entry 01's cell links here, and a repeat would add copy); a seventh claim chip (the claims register has exactly six); a "see 01" link inside the sentence (breaks the uniform Phosphor White line and adds a tab stop to an entry designed to have none).

---

## 3. Layout structure

### 3.1 Grid and placement by breakpoint

The entry uses `.lp-container` and `.lp-grid` (DS 4.1). The receipt lane exists only from 1024px; text never enters it.

| Viewport | Columns, gap, margin | Head, eyebrow, H2, body, body2 | Sample inbox panel | Open row | Lane (canvas) |
| --- | --- | --- | --- | --- | --- |
| 1440 and 1920 (container 1280, content 1216) | 12 cols, 32 gap, 32 margin | cols 1 to 7 (696px). Body max width `--measure-body` (34rem = 544px). H2 max width `--measure-title` (14em) | cols 1 to 7, 696px | cols 1 to 7, max width 544px | cols 9 to 12, 384px. Slip about 301 by 677 at 1440 by 900, scaled 0.92 |
| 1280 | same as 1440 | same | 696px | 544px | 384px. Slip 265 by 596 at 1280 by 800, scaled 0.92 |
| 1024 to 1279 | 12 cols, 32 gap, 32 margin; col width 50.7px at 1024 | cols 1 to 7, 547px | 547px (inner width 481px, rows stay on one line) | 544px | cols 9 to 12, 299px. Slip 253 by 570 at 1024 by 768, scaled 0.92. Navbar caption shows "06 / 10". No rail |
| 768 to 1023 | 8 cols, 24 gap, 24 margin; col width 69px at 768 | cols 1 to 8 with text capped at 34rem | max width 34rem (544px), left aligned | 544px | none. Receipt tape under the navbar, no canvas |
| 640 to 767 | 8 cols, 20 gap, 16 margin | content width 608 to 735px, capped at 34rem | min(34rem, 100%) | min(34rem, 100%) | none, tape |
| 360 to 639 | 4 cols, 16 gap, 16 margin; content 328px at 360 | full content width | full width (328px at 360), padding 20 | full width | none, tape |

### 3.2 Vertical rhythm (top to bottom)

All values are from DS 4.3 or the brief's 4px scale. "Desktop" means 1024px and wider.

| Gap | Desktop | Below 1024 |
| --- | --- | --- |
| Entry padding-top (F5) | 64 | 48 |
| Entry head (number plus graticule rule), height `--lp-head-h` | 32 | 32 |
| Head to eyebrow | 40 | 32 |
| Eyebrow (12px, line 16) to H2 | 16 | 12 |
| H2 to body | 24 | 20 |
| Body to body2 | 16 | 16 |
| Last body paragraph to panel | 48 | 32 |
| Panel to open row (air before the signature) | 96 | 64 |
| Open row hairline to first line of text | 24 | 20 |
| Open row to the end of the entry (`--section-pad-landing`) | 128 (1024+), 96 (768 to 1023), 80 (below 768) | |

Inside the sample inbox panel: padding 32 (20 below 768); panel heading `lp-title` (20px, line 30) with `padding-right: 88px` so it never meets the chip; heading to rows 16; each row `padding: 14px 0`, line height 24, so 52px per row plus its 1px bottom hairline; last row to note 16; note 14px with line height 20. Panel height at 1440 is about 302px (32 + 30 + 16 + 3 x 53 + 16 + 20 + 32 = 304).

Approximate entry height at 1440 by 900 (content plus padding): 1130px. The `min-height: 90svh` floor (810px at 900) is therefore not the binding constraint; it exists so that on very tall viewports the lane's sticky range still covers the whole entry.

### 3.3 ASCII wireframe: desktop 1440 (container 1280; not to scale)

```
 x=80                                                                                x=1360
 |  06  |--|--|--|--|--|--|[|]|--|--|--|--|--|--|--|                                 |   <- M1 head, 32px, tick 06 is 8px bright
 |                                                                                   |
 |  REPLIES                                              (cols 9-12 = receipt lane,  |
 |                                                         384px, canvas behind,     |
 |  Replies come to an                                     text never enters)        |
 |  address you control.                                                             |
 |                                                              +-----------+        |
 |  You set one forwarding filter, and replies about            | KAIROS    |        |
 |  your applications come to a private address we give         | RECEIPT   |        |
 |  you. No Gmail login, no Gmail access. Kairos tags           | SAMPLE    |        |
 |  each reply to the application it belongs to.                | ...       |        |
 |                                                              | 05 filed  |        |
 |  When a reply you forward is an offer, we pause your         | 06 Reply  |        |
 |  billing.                                      (if gated in) | tagged... |        |
 |                                                              +-----------+        |
 |  +- - - - - - - - - - - - - - - - - - - - - - - - -+         slip: pose          |
 |  : Sample inbox                          [ SAMPLE ] :         (4,-12,1) x 0.92    |
 |  :                                                  :         still, tilt off     |
 |  : Reply . tagged to application 0233               :                            |
 |  : ------------------------------------------------ :                            |
 |  : Interview request . tagged to application 0233    :                            |
 |  : ------------------------------------------------ :                            |
 |  : Offer . billing paused                            :                            |
 |  : ------------------------------------------------ :                            |
 |  : Sample rows. Nothing here came from an employer.  :                            |
 |  +- - - - - - - - - - - - - - - - - - - - - - - - -+   (dashed edge, 696px)      |
 |                                                                                   |
 |                         (96px of Void: the pause)                                 |
 |  ----------------------------------------------   <- 1px Phosphor White, 544px     |
 |  [ ] Row 04 stays open. We cannot promise interviews, and we will                 |
 |      not print a number we have not measured. We can show you                     |
 |      every application, every skip and every reply.                               |
 |                                                                                   |
 |                         (128px section pad)                                       |
```

`[ ]` is the hollow 6px posting square (Phosphor White outline). `. ` stands for the middle dot.

### 3.4 ASCII wireframe: mobile 360 (content 328px; not to scale)

```
 16                                    344
 | 06 |--|--|--|--|--|[|]|--|--|--|--|     <- head, 32px (11 ticks, 28px apart)
 |                                    |
 | REPLIES                            |
 | Replies come to an                 |     H2 36px, 2 lines
 | address you control.               |
 |                                    |
 | You set one forwarding filter,     |     body 16px, about 7 lines at 328px
 | and replies about your             |
 | applications come to a private     |
 | address we give you. No Gmail      |
 | login, no Gmail access. Kairos     |
 | tags each reply to the             |
 | application it belongs to.         |
 |                                    |
 | When a reply you forward is an     |     (if gated in)
 | offer, we pause your billing.      |
 |                                    |
 | +- - - - - - - - - - - - - - - -+  |     panel padding 20, dashed edge
 | : Sample inbox        [SAMPLE]  :  |
 | : Reply . tagged to application :  |     rows wrap naturally, 52px min
 | : 0233                          :  |
 | : ----------------------------- :  |
 | : Interview request . tagged to :  |
 | : application 0233              :  |
 | : ----------------------------- :  |
 | : Offer . billing paused        :  |
 | : ----------------------------- :  |
 | : Sample rows. Nothing here     :  |
 | : came from an employer.        :  |
 | +- - - - - - - - - - - - - - - -+  |
 |                                    |
 |            (64px Void)             |
 | ---------------------------------- |     1px Phosphor White, full width
 | [ ] Row 04 stays open. We cannot   |     lead 18px
 |     promise interviews, and we     |
 |     will not print a number we     |
 |     have not measured. We can      |
 |     show you every application,    |
 |     every skip and every reply.    |
 |            (80px section pad)      |
 [ tape: 06 . Reply tagged to its application ]   <- sticky 48px under navbar, from entry 02
```

---

## 4. Visual design

### 4.1 Tokens, type roles and surfaces

| Element | Role class | Face, size, weight, line, tracking | Colour (token, hex) | Surface | Contrast (DS section 9) |
| --- | --- | --- | --- | --- | --- |
| Entry number "06" | `lp-head-num` | Inter 12px, 500, 1.333, +0.6px, tabular slashed-zero | Moss 70 `--label` `#9cbf93` | Void | 10.29 (V3) |
| Graticule rule and ticks | `lp-head-rule`, `lp-head-tick` | 1px rule; 11 ticks 4px tall; tick 06 is 8px | Rule `--divider` `#1f2a33`; ticks `--border` `#485346`; current tick `--foreground` `#ddffdc` | Void | Decorative (V8, V9); tick 06 is Phosphor White, 19.41 |
| Eyebrow "Replies" | `lp-caption` uppercase | Inter 12px, 500, +0.6px | Moss 70 | Void | 10.29 |
| H2 | `lp-heading` | Inter Tight `ss01`, 400, `--type-heading-landing` (36 to 56px; 55.7px at 1440), 1.02, -0.02em, `text-wrap: balance`, max width `--measure-title` | Phosphor White `--foreground` | Void | 19.41 (V1) |
| Body and body2 | `lp-body` | Inter 16px, 400, 1.5, -0.022em, `text-wrap: pretty`, max width `--measure-body`, left aligned | Sage 60 `--body` `#8cab87` | Void | 8.29 (V2) |
| Sample panel | `lp-panel` via `SampleFrame` | radius 8px, `border: var(--sample-border)` (1px dashed Circuit Border), padding 32 (20 below 768) | fill Ground Iron `--surface` `#181818` | Void | n/a |
| SAMPLE chip | `lp-chip--sample` | Inter 12px, 500, uppercase, +0.6px, 24px pill, 1px Circuit Border, 16px from top and right (12px below 768) | Moss 70 | Ground | 8.70 (G3) |
| Panel heading | `lp-title` (h3) | Inter 20px, 500, 1.5, -0.018em | Phosphor White | Ground | 16.41 (G1) |
| Inbox row | `lp-inbox__row` | Inter 16px, 400, 24px line, -0.022em; 1px `--border` bottom hairline | Sage 60 (detail) | Ground | 7.01 (G2) |
| Inbox status word | `lp-inbox__status` | Inter 16px, **500** | Phosphor White (no status colour, F8) | Ground | 16.41 (G1) |
| Inbox note | `lp-small` | Inter 14px, 400, 20px line | Sage 60 | Ground | 7.01 (G2) |
| Open row text | `lp-lead lp-open-row__text` | Inter 18px below 768, 20px from 768; 400; 1.5; -0.018em; `text-wrap: pretty`; max width `--measure-body` | Phosphor White (F1). Ink start colour Sage 60 | Void | 19.41 final; 8.29 at the start of the ink |
| Open row hairline | `lp-open-row::before` | 1px, full measure | Phosphor White | Void | 19.41 |
| Open posting square | `lp-post lp-post--open` | 6px by 6px, radius 0, 1px solid, transparent fill, `box-sizing: border-box`, `vertical-align: 0.21em`, 8px right margin | border Phosphor White | Void | 19.41 (non-text needs 3) |

New pairings introduced by this entry: none. Every foreground and background above already appears in the DS contrast table; the open-square outline on Void reuses V1.

### 4.2 Motif usage

| Mark | Use in this entry |
| --- | --- |
| M1, M2 | Entry head with the current tick (index 06) 8px and bright; rule draws 600ms |
| M3 | One square only, in the `open` state (F2). No filled squares in this entry, on purpose |
| M4, M5 | None. No citation chip. No claim chip. The claims register gains no entry |
| M6 | The sample inbox: SAMPLE chip plus 1px dashed edge. The dashed edge is never the only signal: the chip text, the heading "Sample inbox", the accessible name beginning "Sample" and the note all carry it |
| M7 | None. The perforation lives only on the receipt, the mint band edges and above the footer. The band's bottom perforated edge is directly above this entry and must not be repeated here |
| M8 | The id 0233 and the "04" in "Row 04" use tabular slashed-zero (inherited from `.lp`) |
| M9, M10 | None. No stamp. No custody candidate |

### 4.3 Which element is this viewport's one lime element

None. There is no lime element in this entry. Per CP section 20 the navbar "Start free" owns lime for the whole of entry 06. The lime owner is the highest-priority candidate with any visible pixel among Approve, hero CTA, Choose Pro, closing CTA; by entry 06 none of those is visible (Approve and hero are far above, Choose Pro is deep in entry 07). If a short viewport shows Choose Pro at the very bottom, `LimeCustody` hands over from the navbar to Pro with the normal sequential 150ms + 150ms step. This entry must not add its own handler.

### 4.4 CSS (reference; lives in `landing.css`, all under `.lp`)

```css
/* Inbox */
.lp-inbox { list-style: none; margin: 16px 0 0; padding: 0; }            /* role="list" restores semantics in Safari */
.lp-inbox__row { padding: 14px 0; border-bottom: 1px solid var(--border);
  font: 400 16px/24px var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  letter-spacing: -0.022em; color: var(--body); text-wrap: pretty; }
.lp-inbox__status { font-weight: 500; color: var(--foreground); }
.lp-inbox__note { margin: 16px 0 0; font: 400 14px/20px var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  letter-spacing: -0.026em; color: var(--body); }

/* Open row */
.lp-open-row { position: relative; margin: 96px 0 0; padding-top: 24px; max-width: var(--measure-body); }
@media (max-width: 1023.98px) { .lp-open-row { margin-top: 64px; padding-top: 20px; } }
.lp-open-row::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 0;
  border-top: 1px solid var(--foreground); transform-origin: left; }     /* a border, so forced-colors keeps it */
.lp-open-row__text { color: var(--foreground); }
.lp-post--open { display: inline-block; width: 6px; height: 6px; box-sizing: border-box; margin-right: 8px;
  border: 1px solid var(--foreground); border-radius: 0; background: transparent; vertical-align: 0.21em; }

/* sq-open-row (motion.css). Absent attribute = final state (no JavaScript). */
.lp { --stagger-sentence: 240ms; --delay-open-ink: 300ms; --delay-open-row: var(--delay-feed-stop); }
[data-open-row="idle"] .lp-open-row::before { transform: scaleX(0); }
[data-open-row="idle"] .lp-post--open { border-color: transparent; }
[data-open-row="idle"] .lp-open-row__s { color: var(--body); }
[data-open-row="live"] .lp-open-row::before { transition: transform var(--dur-post) var(--ease-post) var(--delay-open-row); will-change: transform; }
[data-open-row="live"] .lp-post--open { transition: border-color var(--dur-colour) var(--ease-utility) var(--delay-open-row); }
[data-open-row="live"] .lp-open-row__s { transition: color var(--dur-ink) var(--ease-post)
  calc(var(--delay-open-row) + var(--delay-open-ink) + var(--i) * var(--stagger-sentence)); }
[data-open-row="instant"] * , [data-open-row="instant"] *::before { transition-duration: 0.01ms !important; transition-delay: 0s !important; }
@media (forced-colors: active) { .lp-post--open { border-color: CanvasText; } .lp-open-row::before { border-color: CanvasText; } }
```

The reduced-motion block (both the `prefers-reduced-motion` media rule and `html[data-motion="reduced"] .lp`) adds `--stagger-sentence: 0ms; --delay-open-ink: 0ms; --delay-open-row: 0ms;` to the existing zeroed tokens.

---

## 5. WebGL

### 5.1 Scene state

Single state id: `slip-reply` (WS 5.3). Values: camera (0, 0, 6) looking at the origin, fov 35; offset (0, 0, 0) from the lane-fit pose; rotation (4, -12, 1) degrees; scale 0.92 of lane-fit; `uCurl` 1 (0 at T1); `uLevel` 1.00; `uAlpha` A 1; `uPaperLen` A 2304; pointer tilt **off**; canvas visible.

Which paper: if the visitor approved and the tear happened (`ledgerStore.torn`), the lane shows the fresh paper (header `KAIROS · RECEIPT · SAMPLE`, then `05 · Receipt filed`, pre-printed). If the visitor never approved (`ghost-path`) there was no tear, so paper A continues with its lines through `05 · Not sent · waiting for your approval`. Line 06 prints onto whichever paper is current (WS delta D7).

### 5.2 Entry and exit

| Event | Trigger (ScrollTrigger id) | What happens | Preset | Reverse |
| --- | --- | --- | --- | --- |
| Enter | Entry 06 top reaches 70% of the viewport (`entry-06:canvas`, `start: "top 70%"`, `onEnter`) | Pose is set directly while the canvas is hidden. Canvas `opacity` 0 to 1, 400ms linear (240ms at T1). The upper part of the slip is hidden under the mint band's bottom edge for the first scrolled pixels, which is correct: the stage is `z-index: 0` and the band is content at `z-index: 1` | `en-canvas-return` | `onLeaveBack` fades out (`ex-canvas-out`) because the stage area is DOM again |
| Print line 06 | Entry 06 local progress `u` crosses 0.20 forward, once per page view (`entry-06:pose`) | Flatten 120ms (`--ease-post`), print the full-size row (head 420ms, paper 520ms), hold 200ms, unflatten 600ms. About 1.44s end to end | `em-print`, queue rule from WS 3.5 | Never un-prints. Pose scrubs, print stays |
| Pose | `entry-06:pose`, `start: "top 85%"`, `end: "bottom 15%"`, no scrub | `smoothstep` over `u` 0 to 0.25, `POSE_LAMBDA` approach, no overshoot | `ho-pose` | Scrubs back |
| Exit | Entry 07 top reaches 70% (`entry-07:canvas`, F6) | Opacity 1 to 0 over 400ms linear, then `visibility: hidden`, renderer stops invalidating | `ex-canvas-out` | Fades back in |

At 1440 by 900 the canvas fades in at about `u` 0.08, line 06 prints at `u` 0.20 (entry top near y = 413 px, so the H2 and body are on screen), the open row reaches the 70% line at about `u` 0.55 to 0.65, and the canvas fades out at about `u` 0.72. The exact `u` values vary with copy wrap; the triggers are positions, not `u` literals.

### 5.3 Layering and contrast

- Layer order (WS 6.1): canvas `z-index: var(--lp-z-canvas)` (0, fixed, `pointer-events: none`, `aria-hidden`), entry content `var(--lp-z-content)` (1, transparent over the lane), rail 20, tape 30, navbar 40, dialogs in the top layer.
- All text sits in cols 1 to 7 (cols 1 to 8 at most). The slip stays inside cols 9 to 12. The smallest horizontal gap is at 1024: text ends at x = 579px, the slip's left edge is at about x = 725px (146px clear).
- **Text never sits on the slip.** All entry 06 text is over Void (the canvas clears to transparent). The panel is over Ground Iron, which is a DOM fill. The text contrast table in 4.1 therefore applies unchanged. A Playwright lane-separation check (acceptance criterion 12) asserts that no entry 06 text rectangle intersects the slip rectangle.
- This entry owns no canvas pixels beyond the print of line 06.

---

## 6. Animation choreography

Principles that apply (MS section 1): every motion ends (P1); nothing moves unless the visitor caused it (P4); stillness is a feature (P5); readable at frame zero (P6); body text has no entrance; no springs or overshoot (P7). Eyebrow, body, body2, the panel, its rows and its note have **no entrance at all**. Only the title, the rule, the one square and the sentence colour animate.

### (a) Entrance timeline

Step A is the entry post (shared by all entries). Step B is the print of line 06. Step C is the signature, `sq-open-row`. Times are relative to each step's own trigger.

| # | Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Graticule rule (M1) | `transform: scaleX` | 0 (origin left) | 1 | `--dur-post` 600ms | 0 | `--ease-post` | `EntryPoster`: entry top crosses 85% of viewport. Preset `en-post-rule` |
| A2 | Rule ticks | step on (no tween) | off | on | none | `calc(var(--i) * 60ms)`; tick 06 at 360ms | none | Same trigger, follows the line |
| A3 | H2 lines, 1024px and wider | `transform: translateY` inside masks | 115% | 0 | `--dur-rise` 700ms | starts +80ms (`--delay-rise`), 70ms between lines; 2 lines end at 850ms | `--ease-post` | Same trigger. Preset `kt-line-rise` (GSAP SplitText) |
| A3b | H2 whole title, below 1024px | `transform: translateY` in one mask | 115% | 0 | 700ms | +80ms | `--ease-post` | `data-post="live"`. Preset `kt-title-rise` (CSS) |
| A4 | Eyebrow, body, body2, panel, rows, note | none | present | present | 0 | 0 | none | Rendered in server HTML. No entrance |
| A5 | Posting square for a settlement | none | none | none | 0 | 0 | none | This entry settles nothing. `SettleCell` for row 04 is never run (it never swaps) |
| B1 | Canvas | `opacity` | 0 | 1 | `--dur-handoff` 400ms (T1 240ms) | 0 | `--ease-linear` | Entry top at 70%. Preset `en-canvas-return` (desktop tier 1 and 2 only) |
| B2 | Slip | print row, paper advance | blank | `06 · Reply tagged to its application` | head 420ms, paper 520ms, flatten 120ms before, unflatten 600ms after | none | `--ease-post` | `u` crosses 0.20. Preset `em-print`, `ledgerStore.print("06")` |
| B2t | Tier 0 lane list, desktop | `opacity` and `translateY` | 0 and 6px | 1 and 0 | `--dur-row` 240ms | none | `--ease-post` | `ledgerStore.print("06")`. Preset `en-row-print` |
| B2m | Mobile tape, below 1024 | `translateY` of old and new line | 0 / 100% | -100% / 0 | `--dur-post` 600ms | none | `--ease-post` | `ledgerStore.print("06")`. Preset `kt-tape-line` |
| C0 | Open row | none (stillness) | n/a | n/a | `--delay-open-row` 200ms | n/a | n/a | `OpenRow` sets `data-open-row="live"` (see conditions below) |
| C1 | Open row hairline | `transform: scaleX` | 0 (origin left) | 1 | `--dur-post` 600ms | 200ms | `--ease-post` | `data-open-row="live"`. Presets `sq-open-row`, `en-post-rule` |
| C2 | Open square | `border-color` | transparent | Phosphor White | `--dur-colour` 300ms | 200ms | `--ease-utility` | Same. Preset `en-post-square` (outline variant; it never fills) |
| C3 | Sentence 1 "Row 04 stays open." | `color` | Sage 60 `#8cab87` | Phosphor White `#ddffdc` | `--dur-ink` 360ms | 200 + 300 = 500ms | `--ease-post` | Same |
| C4 | Sentence 2 | `color` | Sage 60 | Phosphor White | 360ms | 500 + 240 = 740ms | `--ease-post` | Same |
| C5 | Sentence 3 | `color` | Sage 60 | Phosphor White | 360ms | 740 + 240 = 980ms, ends at 1,340ms | `--ease-post` | Same |

**Trigger conditions for step C (the `OpenRow` island).**

1. On hydration, if the open row's top is below 85% of the viewport height and `printed` does not contain `"06"`, set `data-open-row="idle"` on the open row element (hidden start state, applied by JavaScript only, MS 3.3 rule). Otherwise set `data-open-row="instant"` (the final state with transitions suppressed). This covers reload mid-page, anchor jumps and bfcache restores. With no JavaScript the attribute never exists and the final state shows.
2. One `IntersectionObserver` on the open row with `rootMargin: "0px 0px -30% 0px"` and `threshold: 0` (the row's top crosses 70% of the viewport).
3. Start condition: the row has crossed 70% **and** `ledgerStore.printed` contains `"06"` (the slip, tape or lane list has printed its line first, so the sentence is the second thing to happen, as the signature requires). If `"06"` is still not printed 1,200ms after the row crosses, start anyway so the sentence is never withheld.
4. Starting means: set `data-open-row="live"`; when the last transition ends (about 1,340ms after live), set `data-open-row="done"` and remove `will-change`. Then disconnect observers. The state never reverts, whatever the scroll direction (append-only, MS P3).
5. Fallback print (F7), only when the scene driver is not running (`env.desktop === false`, or effective motion is Reduced): a second observer on the sample inbox panel with `threshold: 0.5` calls `ledgerStore.print("06")` the first time half of the panel is visible. `print` is idempotent. In desktop Full mode the observer is not created, and the scene driver prints at `u` 0.20.
6. If effective motion switches to Reduced while `live`, set `instant` at once (`completeAll()`, MS 3.5).

**Motion group count (MS 3.4, limit 2).** Step A is one group, step C is one group (all of C1 to C5 share one state change). If the visitor scrolls fast enough that the entry 07 post fires during step C, the entry 07 post waits up to 300ms; if still blocked it posts instantly.

**Total unattended duration:** step C is 1.34s after a 200ms pause; step B2 is about 1.44s. Both are under `MAX_AUTOPLAY_MS` (4,500ms) and `DESIGN_AUTOPLAY_MS` (3,200ms). Neither loops.

### (b) Scroll-linked behaviour

No pin, no scrub, no snapping, no parallax. All ScrollTriggers are created top to bottom with `refreshPriority` 6 and ids `entry-NN:purpose`. Entry 06 never uses `scrub` together with `toggleActions`.

| Trigger id | Element | start | end | Mode | Drives |
| --- | --- | --- | --- | --- | --- |
| `entry-06:pose` | `section#entry-06` | `top 85%` | `bottom 15%` | standalone, `onUpdate` writes `u` | scene pose and the print point `u` = 0.20 |
| `entry-06:title` | the section | `top 85%` | none | `once: true`, `onEnter` plays | `kt-line-rise` (1024px and wider) |
| `entry-06:canvas` | the section | `top 70%` | none | `onEnter`: `en-canvas-return`; `onLeaveBack`: `ex-canvas-out` | canvas fade |
| `entry-07:canvas` (owned by entry 07) | `section#entry-07` | `top 70%` | none | `onEnter`: `ex-canvas-out`; `onLeaveBack`: `en-canvas-return` | canvas leaves |

The open row is **not** a ScrollTrigger. It is an IntersectionObserver in the island (position-based, runs at every width, no GSAP).

Progress-to-value mapping (desktop Full, 1440 by 900; all values approximate except the thresholds):

| Entry 06 `u` | Entry top on screen | Scene and DOM |
| --- | --- | --- |
| 0.00 | y = 765 (85%) | Entry posts: rule draws, title rises. Canvas hidden |
| about 0.08 | y = 630 (70%) | Canvas fades in over 400ms, pose already `slip-reply` |
| 0.00 to 0.25 | | Pose blends by `smoothstep`; `POSE_LAMBDA` 7.7 approach |
| 0.20 | y = 413 | Line 06 prints (about 1.44s, the slip flattens while it prints) |
| about 0.55 to 0.65 | open row top at y = 630 | `OpenRow` starts `sq-open-row` (if 06 is printed) |
| about 0.72 | entry 07 top at y = 630 | Canvas fades out over 400ms |
| 1.00 | bottom at 15% | nothing |

### (c) Micro-interactions

This entry has **no interactive controls by design**, so the whole section is a pass-through for keyboard users (zero tab stops). The sample inbox rows are not buttons and have no hover, cursor, focus or press states; a row that looks tappable but does nothing would be a false affordance in a section about honesty.

| Interaction | Behaviour | Preset |
| --- | --- | --- |
| Hover on any element | No change. `cursor` stays default. Nothing is a link or button | none |
| Focus | The H2 has `tabindex="-1"` and receives programmatic focus after an anchor jump (rail, tape dialog, "open · see 06" from row 04, skip links). It shows the standard 2px Phosphor White outline with 4px offset on `:focus-visible` | `mi-focus` |
| Press | None | none |
| Text selection | `::selection` Void on Phosphor White (19.41:1), global | none |
| Incoming link | The entry 01 row 04 cell "open · see 06" links to `#entry-06`. After the jump, scroll position puts the head 80px (128px below 1024) below the viewport top (`scroll-margin-top`, F4) and focus lands on the H2. The sentence is below the fold on most viewports and posts when scrolled to | `ho-route` is not involved; the anchor handler (MS 5.6) applies |

### (d) Hand-off to the next section

1. **Canvas.** When entry 07's top reaches 70% of the viewport, the stage fades out (`ex-canvas-out`, 400ms linear, then `visibility: hidden`); entries 07, 08 and 09 have no canvas. Scrolling back up past that line fades it back in with the printed lines intact.
2. **Lime.** Navbar "Start free" owns lime throughout entry 06. When "Choose Pro" first shows a pixel in entry 07, `LimeCustody` hands over in two steps (navbar out 150ms, Pro in after a further 150ms). Entry 06 contributes no code to this.
3. **Ledger chrome.** At entry 07 the rail's `aria-current` and the navbar caption (`06 / 10` to `07 / 10`, 1024 to 1279px) swap instantly. The tape keeps showing "06 · Reply tagged to its application" until a newer line prints (the next print is at entry 10).
4. **Story.** The sentence is the last thing that moves in the story arc (the `[data-story]` container ends with this entry). Entry 07 starts a plain full-width composition with its own rule drawing at the 85% line.
5. **Previous entry.** The mint band's bottom perforated edge is the previous visual. Entry 06 starts on Void 64px below it (F5), and the slip emerges from under the band as described in 5.2.

---

## 7. Reduced-motion, no-JS and low-tier variants

| Variant | What the visitor gets |
| --- | --- |
| **No JavaScript** | Everything in the entry is server HTML: head with the drawn rule and bright tick 06, eyebrow, H2, body (and body2 when shipped), the sample panel with three rows and the note, the open row with its hairline, its hollow square and all three sentences in full Phosphor White. No `data-open-row` attribute exists, so no hidden start state exists. The lane shows the server-rendered receipt (poster or list). Row 04's "open · see 06" link works as a plain anchor |
| **Reduced motion** (OS setting not overridden, or the footer control set to Reduced) | `kt-line-rise` and `kt-title-rise` are not created (title static). `en-post-rule` is drawn at first paint. `OpenRow` sets `data-open-row="instant"` at mount: the hairline, the square and the three-sentence colour are final at once (all durations, staggers and delays are 0.01ms or 0ms). No WebGL chunk is downloaded. Line 06 appears in the lane list instantly (or the tape, below 1024px) via the idempotent fallback print. Colour hover/focus transitions keep their 300ms (not applicable here: nothing is interactive). Wording is identical to Full |
| **Tier 0, motion allowed** (no WebGL, desktop) | No canvas. The DOM `LaneReceipt` shows line 06 appended with `en-row-print` (240ms, 6px rise) when printed. The open row runs `sq-open-row` exactly as in Full. The poster/list is the only slip |
| **Tier 1 (lite)** | Canvas at 30fps with `uCurl` 0, half-size texture. Fade 240ms instead of 400ms. `em-print` runs with the same timings, dt-corrected. Open row identical |
| **Tier 2** | As specified in 5 and 6 |
| **Below 1024px, full motion** | No lane and no canvas. Titles use `kt-title-rise`. The tape slides the new line in with `kt-tape-line` (600ms) when "06" prints. The open row runs `sq-open-row` (CSS only, no GSAP) |
| **Print / forced colours** | The hairline is a border and the square's border switches to `CanvasText`, so both survive Windows high contrast mode |

The hidden idle start state keeps layout unchanged (colour, border colour and `scaleX` only), so there is no layout shift in any variant.

---

## 8. Accessibility

### 8.1 Structure

- Landmark: `<section id="entry-06" data-section="entry-06-replies" data-entry="06" data-scene="slip-reply" aria-labelledby="entry-06-title" class="lp-entry">` inside `<main id="main">`. Because the section has an accessible name it is exposed as a region; that is consistent with every other entry.
- Headings: H2 `id="entry-06-title"` with `tabindex="-1"` and `data-split="lines"` (SplitText sets `aria: "auto"`; the heading's text is never missing from the accessibility tree). The panel heading "Sample inbox" is an H3. The open row is a `<p>`. There is no H4.
- The sample panel is a `<div role="group" aria-labelledby="entry-06-inbox-title">`, so its accessible name is "Sample inbox". The SAMPLE chip has the accessible name "Sample data".
- The inbox is `<ul class="lp-inbox" role="list">` with three `<li>`. Each row's text is one contiguous run: `<span class="lp-inbox__status">Reply</span> · tagged to application <span>0233</span>`. A screen reader reads "Reply, tagged to application 0233" (the middle dot is usually skipped; the words carry the meaning).
- The open square is `aria-hidden="true"`; the visually hidden text "Open." (`entry-06-replies.openRowSquareAria`) sits immediately before the first sentence in the same paragraph, so the paragraph reads "Open. Row 04 stays open. We cannot promise ...". The three sentence spans are inline and have no roles.
- The hairline and the ticks are `aria-hidden` and are pseudo-elements or presentational.
- The canvas is `aria-hidden`; the equivalent text is the line in the lane `<aside aria-label="Sample receipt">` (`<ol id="receipt-lines">`), which receives "06 · Reply tagged to its application" when it prints. On phones the same text is in the tape and its dialog.

### 8.2 Focus order and live regions

- The entry has **zero tab stops**. The next tab stop after the navbar, rail and earlier entries is the first control in entry 07 (the interval switch). The H2 is focusable only programmatically.
- No live region in this entry. The sentence is already in the document and is not announced when its colour changes (announcing static text would be noise). Polite announcements of printed lines, if any, belong to the tape and lane components.
- The open row's text never changes, so there is no content update to announce.

### 8.3 Contrast and size

All pairings are listed in 4.1; all pass WCAG 2.2 AA (smallest ratio on text is 7.01:1, on Sage 60 over Ground Iron). Body and inbox text are 16px or larger, the note is 14px, captions are 12px (the minimum on the page). The open square is 6px but its meaning is also present as text ("Open." and "Row 04 stays open."), so no meaning depends on the square (1.4.11 is met by the 19.41:1 outline anyway). Colour is not the only carrier of meaning: the inbox statuses are words, not colours.

### 8.4 Other criteria

- Text spacing: no fixed heights on text containers. Rows grow with 200% line height or letter spacing overrides.
- Zoom and reflow: at 320 CSS px and 400% zoom there is no horizontal scroll; the panel and rows wrap.
- Target size (2.5.8): no interactive targets in the entry. The tape and rail targets are specified elsewhere.
- Motion: no flashing, no content longer than 5 seconds, nothing auto-updates (WCAG 2.2.2 and 2.3.1).
- Language: `lang="en"` inherited. The copy contains no abbreviations that need expansion.

---

## 9. Performance notes

| Item | Value |
| --- | --- |
| What animates | Hairline `transform: scaleX` (compositor), square `border-color` and three `color` transitions (paint of about 1,600 px squared of text, no layout), H2 line rise (transform), canvas opacity and one print (WebGL, owned by WS) |
| Layout work | None. All geometry is fixed in server HTML; the idle state changes no box size. CLS contribution 0 |
| `will-change` | Set only on the hairline while `live` and removed at `done` (1 of the 4 allowed at any time, `MAX_WILL_CHANGE`) |
| Compositor layers added | At most 1 (the hairline) for 1.4 seconds; the canvas layer is owned by the stage |
| Element count | About 55 DOM nodes: head 14, eyebrow 1, H2 1 (+ split lines at runtime, 2 to 3), body 1 to 2, panel about 18, open row 7 |
| JavaScript | Island `OpenRow`: one `IntersectionObserver` (two only in the fallback modes), one `ledgerStore` subscription, no timers except one 1,200ms safety timeout, no `requestAnimationFrame`, no scroll listener. Budget 1.0 KB gzip, counted inside the 20 KB island chunk. No layout reads in handlers |
| CSS | About 1.5 KB gzip across `landing.css` and `motion.css` (inside the 25 KB CSS budget) |
| HTML | About 4 KB uncompressed for the whole entry (inside the 60 KB HTML budget) |
| Assets | None. No images, no SVG, no new fonts (Inter and Inter Tight at 400 and 500 are already preloaded). No video |
| Network | No requests are made by this entry |
| WebGL cost | Zero extra cost beyond the stage budget: one print of one row; the renderer stops requesting frames when the pose settles (zero frames at rest) |
| INP | Not applicable (no handlers on user input) |

---

## 10. Implementation

### 10.1 Files

| Path | Kind | Change |
| --- | --- | --- |
| `web/components/landing/entries/entry-06-replies.tsx` | Server component (new) | Composes the entry. Exports `Entry06Replies` |
| `web/components/landing/islands/open-row.tsx` | Client island (new) | Renders `null`. Props `{ rowId: string; inboxId: string }`. Implements the trigger logic in 6(a) steps 1 to 6 and the fallback print |
| `web/components/landing/marks/posting-square.tsx` | Server (edit) | Add `state: "posted" \| "pending" \| "open"`. `open` renders the `lp-post lp-post--open` square with `aria-hidden` |
| `web/components/landing/landing.css` | CSS (edit) | Add the `lp-inbox*`, `lp-open-row*` and `lp-post--open` rules from 4.4 and the `scroll-margin-top` change (F4) |
| `web/components/landing/motion.css` | CSS (edit) | Add the `sq-open-row` rules from 4.4 and the three new tokens, plus their reduced-motion zeroing |
| `web/content/landing-copy.ts` | Content (read only) | Keys listed in section 2. `body2` must be `string \| undefined` |
| `web/components/landing/entries/entry-06-replies.test.tsx` | Vitest (new) | Sentence split, no empty `body2` paragraph, row 04 cell untouched, no tab stops |
| `web/e2e/landing-entry-06.spec.ts` | Playwright (new) | Acceptance criteria 6 to 16 |

### 10.2 Component structure

```tsx
// entry-06-replies.tsx  [S]
import { landingCopy } from "@/content/landing-copy";
import { Entry } from "./entry";
import { SampleFrame } from "../marks/sample-frame";
import { PostingSquare } from "../marks/posting-square";
import { OpenRow } from "../islands/open-row";

const c = landingCopy["entry-06-replies"];
const sentences = splitSentences(c.openRow);      // /(?<=\.)\s+/ ; throws at build if length !== 3

export function Entry06Replies() {
  return (
    <Entry entry="06" section="entry-06-replies" scene="slip-reply"
           eyebrow={c.eyebrow} title={c.h2}>       {/* no settlement prop: this entry settles nothing */}
      <p className="lp-body">{c.body}</p>
      {c.body2 ? <p className="lp-body">{c.body2}</p> : null}

      <SampleFrame titleId="entry-06-inbox-title" title={c.inboxTitle} headingLevel={3} id="entry-06-inbox">
        <ul className="lp-inbox" role="list">
          {c.inbox.map((row) => <li key={row} className="lp-inbox__row"><InboxText text={row} /></li>)}
        </ul>
        <p className="lp-inbox__note">{c.inboxNote}</p>
      </SampleFrame>

      <p id="entry-06-open-row" className="lp-lead lp-open-row">
        <PostingSquare state="open" />
        <span className="sr-only">{c.openRowSquareAria}</span>
        <span className="lp-open-row__text">
          {sentences.map((s, i) => <span key={i} className="lp-open-row__s" style={{ "--i": i } as React.CSSProperties}>{s}{" "}</span>)}
        </span>
      </p>
      <OpenRow rowId="entry-06-open-row" inboxId="entry-06-inbox" />
    </Entry>
  );
}
```

`InboxText` splits a row at its first " · " so the first part is wrapped in `lp-inbox__status` (weight 500, Phosphor White) and the rest stays Sage 60 (the numeric id keeps tabular figures from `.lp`). It is a three-line helper in the same file. If `Entry` or `SampleFrame` already expose different prop names, adapt the names but keep the rendered DOM contract in section 8.

### 10.3 Server or client

Server: the entry, the posting square, all copy. Client: only `OpenRow` (and, outside this file, `EntryPoster`, `ReceiptTape`, `LaneReceipt`, `LimeCustody`, the stage). The entry exports no `"use client"` and passes only strings to the island.

### 10.4 Presets, tokens and existing components

- Presets used: `en-post-rule`, `en-post-square` (outline variant), `kt-line-rise`, `kt-title-rise`, `kt-tape-line`, `en-row-print`, `en-canvas-return`, `ex-canvas-out`, `em-print`, `ho-pose`, `mi-focus`; new: `sq-open-row`.
- Tokens used: `--measure-body`, `--measure-title`, `--type-heading-landing`, `--section-pad-landing`, `--sample-border`, `--lp-head-h`, `--lp-navbar-h`, `--lp-tape-h`, `--lp-z-canvas`, `--lp-z-content`, `--dur-post`, `--dur-ink`, `--dur-colour`, `--dur-rise`, `--dur-row`, `--dur-handoff`, `--ease-post`, `--ease-utility`, `--ease-linear`, `--delay-rise`, `--delay-feed-stop`, `--foreground`, `--body`, `--label`, `--border`, `--divider`, `--surface`; new and landing-only: `--stagger-sentence`, `--delay-open-ink`, `--delay-open-row` (justification in F3).
- Existing components reused: `Entry`, `EntryRule`, `SampleFrame`, `SampleChip`, `PostingSquare`, `EntryPoster`, `LimeCustody`, `LaneReceipt`, `ReceiptTape`, `ledgerStore` (`print`, `printed`), `envStore`, `subscribeMotion`, `completeAll`.
- Not used: `ClaimChip`, `CitationChip`, `Stamp`, `Perforation`, `ReceiptPaper`, `SettleCell`, `Odometer`, any shared `Button`.

---

## 11. Acceptance criteria

Run at 1440 by 900 unless stated. "Final state" means hairline drawn, square outlined in Phosphor White, all three sentences computed `color` `rgb(221, 255, 220)`.

1. **Copy.** Every string in section 2 renders verbatim (text-content assertion against `landingCopy["entry-06-replies"]`). The page text of the entry has no em dash (U+2014), no en dash (U+2013), and no lime-coloured text.
2. **Gate behaviour.** With gate G3 on the body shows the "(in beta)" variant; with AC12 unconfirmed `body2` is absent: the DOM contains no empty `<p>` and the gap from body to panel is 48px (32px below 1024), not 64px (48px).
3. **Structure.** Exactly one `h2#entry-06-title[tabindex="-1"]`, exactly one `h3` ("Sample inbox"), a `role="group"` named "Sample inbox", a `ul[role="list"]` with exactly 3 `li`. No `h4`. No `button`, `a`, `input`, `select`, `summary` or `[tabindex="0"]` inside the entry (zero tab stops).
4. **Sample labelling.** The panel shows a SAMPLE chip (accessible name "Sample data") and a 1px dashed border (`border-style: dashed`). The note "Sample rows. Nothing here came from an employer." is present. No element in the entry shows a real company name, logo, rate or outcome number.
5. **No settlement.** The entry contains no filled posting square. After the entry posts, entry 01's row 04 cell still reads "open · see 06", its square is outlined, and `ledgerStore.posted` contains "06" without any change to that cell. Rows 01, 02, 03 and 05 are unaffected.
6. **Open square.** Computed style of `.lp-post--open`: width 6px, height 6px, `border: 1px solid rgb(221, 255, 220)`, background transparent, border-radius 0, and it remains transparent-fill after `done`. The paragraph's accessible text starts with "Open. Row 04 stays open."
7. **Frame zero.** With JavaScript disabled, or with a screenshot taken before hydration, the open row's three sentences are readable and meet 4.5:1; at no point is any text `opacity: 0` or `visibility: hidden`.
8. **Sequence timing (Full motion).** Scroll until the open row crosses the 70% line with line 06 printed. Recorded timeline: `data-open-row` becomes `live`; hairline `scaleX` goes 0 to 1 starting at 200ms and ending at 800ms; the square's border becomes opaque by 500ms; sentence 1 starts changing at 500ms, sentence 2 at 740ms, sentence 3 at 980ms, all complete by 1,340ms (tolerance 80ms); `data-open-row` becomes `done`. No other element in the viewport changes during 0 to 1,340ms except at most the canvas settling (zero frames at rest).
9. **Order.** In a run where line 06 has not printed when the row crosses 70%, step C does not start until `printed` contains "06", or 1,200ms after the crossing, whichever is first.
10. **Append-only.** Scroll up past the row and back down: the state stays `done`, nothing replays, no transition runs. Reload at the open row: `data-open-row="instant"`, final state at first paint, no animation.
11. **Reduced motion.** With `prefers-reduced-motion: reduce` (and with the footer control on Reduced): no `kt-line-rise`, final state at first paint, `getAnimations()` on the entry returns no running animation, no request for the WebGL chunk, and line 06 is in `#receipt-lines` (or the tape) within 100ms of the panel being half visible. Wording identical to Full.
12. **Lane separation.** At 1024, 1280 and 1440 widths, no text rectangle of the entry intersects the slip's bounding rectangle; the minimum horizontal clearance at 1024 by 768 is at least 120px.
13. **Canvas.** The canvas is `visibility: hidden` before entry 06's top reaches 70% and visible at 400ms (+/- 50ms) after; line 06 prints once when `u` crosses 0.20; the canvas is hidden again after entry 07's top crosses 70%; `window.__kairosStage.printed` contains "06" exactly once; the slip pose is `slip-reply` with tilt zero.
14. **Single lime.** In a viewport showing only entry 06, exactly one element has the lime fill and it is the navbar "Start free"; this entry contains no `[data-lime-candidate]` element.
15. **Hand-off.** Entry 06 top has `padding-top` 64px (48px below 1024). The previous element is the mint band; the first pixel row of the head sits on Void. At 360 by 800, after jumping to `#entry-06`, the H2 is not covered by the navbar plus tape (`scroll-margin-top` is 128px).
16. **Mobile.** At 360 by 800 (below 1024): no canvas element exists, no horizontal scrollbar, the tape shows "06 · Reply tagged to its application" after the fallback print and the old line leaves over 600ms, rows wrap without clipping, and the inbox row heights are at least 52px.
17. **Data parity.** `0233` is a posting id in `web/content/fit-sample.json` whose default-combination result is PASS (so the inbox id and the receipt feed's "PASS · 0233 · goes to scoring" are the same id). If the sample file changes, the build test fails until the copy deck and this entry agree.
18. **Contrast.** An automated check of computed colours over their backgrounds finds no text pair below 4.5:1 (smallest expected: Sage 60 on Ground Iron, 7.01:1) and the open square outline is at least 3:1.
19. **Forced colours.** Under `forced-colors: active`, the hairline and the square are visible (CanvasText).
20. **Budgets.** `OpenRow` is at most 1.0 KB gzip; entry 06 adds at most 1.5 KB gzip of CSS and at most 4 KB of HTML; CLS for the entry is 0; no more than 1 element has `will-change` set by this entry at any time.
