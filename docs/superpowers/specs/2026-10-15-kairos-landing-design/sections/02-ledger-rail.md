# Section 02: Ledger rail and receipt tape (scroll progress)

Section id: `ledger-rail` (`data-section="ledger-rail"`). Tier: utility. WebGL state: none. Scroll length: 0vh (fixed chrome). Previous section: navbar. Next section: entry-00-hero. Date: 2026-10-15.

Skills applied: ui-ux-pro-max (touch targets, focus, navigation state, reduced motion) and baseline-ui (compositor-only animation, no custom easing beyond the project tokens, fixed z scale, `dvh` units, accessible primitives). Both loaded.

## 1. Purpose and narrative beat

This chrome answers two questions at every moment: which entry am I reading, and what has the ledger posted so far. It is the ledger's index.

- At 1280px and wider, a slim vertical rail in the right gutter lists the 11 entries (00 to 10). The current entry shows a filled posting square (M3) and `aria-current`.
- Below 1024px, a 48px receipt tape docks under the navbar from entry 02 onward. It shows the latest posted receipt line. It is the mobile counterpart of the WebGL receipt, which phones never see.
- Skip links ("Skip to main content", "Skip to pricing") are the first focusable elements in the document and belong to this chrome.
- From 1024 to 1279px neither the rail nor the tape is shown. The navbar entry caption (`05 / 10`, owned by the navbar spec) carries progress there.

Signature (mobile): each newly posted receipt line slides up into the tape over 600ms with `--ease-post`. The old line leaves upward as the new one arrives, like paper feeding past a print head. It ends and does nothing else. The tape's bottom edge is the M1 graticule: 11 ticks, the current entry's tick 8px tall and Phosphor White, so the tape is also a progress mark.

No lime lives here. The chrome never competes for lime custody.

## 2. Content (final copy from 06-copy-deck.md, verbatim; changes flagged)

All strings come from `landingCopy["ledger-rail"]` and `landingCopy.skip`. Nothing is new copy.

| Key | Element | Copy |
| --- | --- | --- |
| `skip.main` | Skip link 1 | Skip to main content |
| `skip.pricing` | Skip link 2 | Skip to pricing |
| `ledger-rail.navAria` | `<nav aria-label>` | Page entries |
| `ledger-rail.entries` | 11 rail and dialog entries | 00 · Open, 01 · Reported, 02 · Fit gate, 03 · Truth lock, 04 · Approve, 05 · Send and receipt, 06 · Replies, 07 · Billing, 08 · Compare, 09 · Questions, 10 · Start |
| (derived) | Link accessible name | Entry {NN}, {title}. Active link adds the hidden suffix `ledger-rail.currentSuffix` ", current" |
| `ledger-rail.tapeDefault` | Tape text before any line past 00 | 00 · Ledger opened |
| `ledger-rail.tapeLabel` | Tape button accessible name | Sample receipt. Latest line: {latestLine}. Open the list of posted lines. |
| `ledger-rail.tapeDialogTitle` | `<dialog aria-label>` | Posted lines and entries |
| `ledger-rail.tapeListHeading` | Dialog heading 1 | Posted so far |
| `ledger-rail.tapeEntriesHeading` | Dialog heading 2 | Go to an entry |
| `ledger-rail.tapeClose` | Close button | Close |
| `scene.lines.*` | Tape text and dialog list | Taken from `landingCopy.scene.lines` (for example "02 · Fit gate · hard rules first · every skip has a reason"). The 48 feed rows appear as the single summary item "Sample run: 48 postings, {skipped} skipped, {passed} passed" (copy key `receipt.feedSummary`) |

Rules for what the tape shows as the latest line:

1. Use the last id in `ledgerStore.printed` whose id is not a header (`header`, `filedHeader`, `10header`). Headers are listed in the dialog but never shown on the tape, because "KAIROS · RECEIPT · SAMPLE" is not a posted decision.
2. `feedRow` shows the feed summary string.
3. If nothing past `00` has printed, show `tapeDefault`.

Changes flagged:

- F1. Copy deck says the tape has `role="button"`. Use a native `<button type="button" aria-haspopup="dialog">`. Same semantics, no ARIA needed. Accessible name is unchanged.
- F2. Copy deck targets skip links at `#main` and `#entry-07-billing`. Architecture targets `#entry-00-title` and `#entry-07-title`. Decision: "Skip to main content" targets `#main` (the `<main>` carries `tabindex="-1"`), and "Skip to pricing" targets `#entry-07-title`, the focusable H2. Entry anchors are `#entry-NN` (architecture 14.1), not `#entry-02-fit-gate`.
- F3. Architecture mounts `LedgerRail` and `ReceiptTape` inside `<main>` before `<div data-story>`. Move both to `LandingShell`, after `</main>` and before `<Footer />`, and move the skip links to be the first children of `.lp`, before `<Navbar>`. Reason: the rail would otherwise add 11 tab stops before the hero, and skip links inside `<main>` come after the navbar links they are meant to skip.
- F4. CD 5.4 says the tape is `position: sticky`. Sticky needs a containing block that spans entries 02 to 10, and no such wrapper exists. Use `position: fixed; top: 64px` with the docked and hidden states in section 6. Visual result is identical.
- F5. The rail link is 44px tall, not 28px (CD 5.4), to satisfy amendment A16. See section 3.
- F6. Architecture assigns no owner for the active-entry observer. Decision: `LedgerRail` owns it (section 10).

## 3. Layout structure

Tokens used: `--lp-navbar-h` 64px, `--lp-tape-h` 48px, `--lp-hit` 44px, `--lp-margin`, `--lp-z-rail` 20, `--lp-z-tape` 30, `--lp-z-navbar` 40, `--lp-z-dialog` 50, `--lp-z-skip` 60. Both elements are outside the grid (fixed), so they take no grid columns.

| Viewport | Rail | Tape | Skip links |
| --- | --- | --- | --- |
| 1440 and wider | Shown. Capsule 44px wide, `right: 16px` (inside the 80px gutter). Link pitch 44px | Hidden (`display: none`) | Top left at `top: 8px; left: 16px` when focused |
| 1280 to 1439 | Shown. Capsule 32px wide, `right: 0` (inside the 32px page margin, so it never covers content). Link pitch 44px | Hidden | Same |
| 1024 to 1279 | Hidden (`display: none`) | Hidden | Same |
| 768 to 1023 | Hidden | Shown from entry 02. Full viewport width, content aligned to the 24px margin. Text is normally one line | Same |
| 640 to 767 | Hidden | Shown, 16px margin | Same |
| 360 to 639 | Hidden | Shown, 16px margin. Text clamps to 2 lines | Same |

Rail geometry (1280 and wider):

- Vertical position: `top: calc(var(--lp-navbar-h) + (100svh - var(--lp-navbar-h)) / 2); transform: translateY(-50%)`, so it is centred in the area under the navbar.
- Link height: `clamp(32px, (100svh - 64px - 32px) / 11, 44px)`. At 720px viewport height it is 44px (rail 484px tall). Below about 600px of viewport height it shrinks to a floor of 32px, which still passes WCAG 2.5.8 (24px).
- Capsule: opaque Carbon Veil, 1px Circuit Border edge, radius `--r-pill`, 4px vertical padding.
- Each link: tabular two-digit number (12px) centred, with a 6px posting-square slot at its left (always reserved, so nothing shifts when it fills).
- Title label: a card that opens leftward from the capsule edge, `right: calc(100% + 8px)`, height 32px, padding 0 12px, 14px text, `--r-card`, Carbon Veil fill, 1px Circuit Border edge. It overlays content and takes no layout space.

Tape geometry (below 1024):

- Box: `position: fixed; top: 64px; left: 0; right: 0; height: 48px; overflow: clip`; Ground Iron fill; 1px Circuit Border bottom edge.
- Inside: padding `0 var(--lp-margin)`. Row: 6px posting square, 8px gap, text window (flex 1, `min-width: 0`), 8px gap, 16px chevron icon (decorative, `aria-hidden`).
- Text window: 48px tall, holds two absolutely positioned line boxes, each `display: flex; align-items: center`. Text is 14px / 18px, clamp to 2 lines, top padding 4px, so the text block is 36px tall and leaves the bottom 8px for ticks.
- Ticks: 11 ticks, 1px wide, anchored to the bottom edge, positioned at `left = (i / 10) * 100%` of the inner width (margin to margin). Height 4px Circuit Border; the current entry's tick is 8px and Phosphor White.
- The whole tape is the button (48px tall, full width). No other control sits inside it.
- Because the tape is fixed, it does not reserve space. `scroll-padding-top` is 128px below 1024px (64 navbar + 48 tape + 16), set by the motion system, so anchors and focused elements are never hidden. Entry 02 onward is the only region where this matters; the extra padding on entries 00 and 01 is harmless.

Dialog (tape): native `<dialog>`, bottom sheet. Width 100% below 640px; `max-width: 560px` centred from 640px. `max-height: 80dvh`, `overflow-y: auto`, padding 16px, Ground Iron fill, 1px Circuit Border top edge, top corners `--r-button` (12px). Backdrop: Void at 60%.

ASCII wireframe, desktop 1440 (rail at right, hover state shown on entry 03):

```
|<------------------------------ 1440 ------------------------------>|
| navbar 64px                                                        |
|                                                                    |
|  hero / entries (container 1280, margin 80)               +----+   |
|                                                           | 00 |   |
|                                         +--------------+  | 01 |   |
|                                         | Truth lock   |<-| 02 |   |
|                                         +--------------+  |[]03|<- current: filled square
|                                                           | 04 |      + Phosphor White
|                                                           | 05 |   |
|                                                           | .. |   |
|                                                           | 10 |   |
|                                                           +----+   |
|                                                       right: 16px   |
```

ASCII wireframe, mobile 360 (tape docked under navbar, inside entry 02 or later):

```
+--------------------------------------+  0
| navbar 64px                          |
+--------------------------------------+ 64
|[] 02 · Fit gate · hard rules first · |
|   every skip has a reason          ^ |  tape 48px (Ground Iron)
|  ' ' ' ' ' | ' ' ' ' ' '             | 112  ticks 4px, current 8px white
+--------------------------------------+
| entry content (16px margin)          |
```

## 4. Visual design

| Role | Rail | Tape |
| --- | --- | --- |
| Surface | Carbon Veil `--surface-raised` #212525, opaque | Ground Iron `--surface` #181818 |
| Edge | 1px Circuit Border `--border` #485346 (decorative) | 1px Circuit Border bottom |
| Number (inactive) | Sage 60 `--body` #8cab87, 12px, weight 500, +0.6px tracking, tabular slashed-zero | n/a |
| Number (current) | Phosphor White `--foreground` #ddffdc | n/a |
| Latest line | n/a | Phosphor White, 14px, weight 400 |
| Posting square (M3) | 6px, Phosphor White, filled on current only | 6px, Phosphor White, filled |
| Graticule ticks (M1) | n/a (the rail is the index) | 4px Circuit Border; current 8px Phosphor White |
| Label card | Carbon Veil, Phosphor White 14px text, Circuit Border edge | n/a |
| Skip link | Phosphor White fill, Void text, 16px weight 500, radius `--r-button`, 44px tall, 16px horizontal padding | same |

Rules:

- The rail is a self-contained capsule so it reads identically over Void, the WebGL area, and the Mint Frost band. No on-mint token swap is needed, and no `data-band` coupling exists.
- Marks used: M1 (ticks), M3 (posting square). M7 perforation is not used here (it is limited to the receipt, the mint band edges and the footer).
- Weights 400 and 500 only. No glow, no gradient, no shadow.
- Lime: none. This section is never the one lime element of a viewport. Skip links use Phosphor White, not lime.
- Radii: capsule `--r-pill`; label card `--r-card`; dialog top `--r-button`.

New pairings (all computed from the palette; AA needs 4.5:1 text, 3:1 non-text):

| Pairing | Ratio |
| --- | --- |
| Sage 60 on Carbon Veil | 6.1:1 |
| Phosphor White on Carbon Veil | 14.3:1 |
| Phosphor White on Ground Iron | 16.4:1 |
| Sage 60 on Ground Iron | 7.0:1 |
| Void on Phosphor White (skip link) | 18.4:1 |
| Current tick, Phosphor White on Ground Iron | 16.4:1 (non-text, 3:1 required) |

## 5. WebGL

Scene state: none. This chrome has no state id and does not drive the stage.

- Layering: canvas `--lp-z-canvas` 0, content 1, rail 20, tape 30, navbar 40, dialog 50, skip links 60. The canvas has `pointer-events: none`, so rail and tape always receive input.
- The rail never overlaps the receipt lane: lane is grid columns 9 to 12 inside the container, and the rail sits in the margin or gutter. The label card overlays content only while hovered or focused.
- Text contrast over the canvas: not applicable. Both elements are opaque, so contrast is independent of what renders behind them.
- The tape has no canvas to cooperate with: below 1024px there is no WebGL. Its lines come from the DOM store (`ledgerStore.printed`), which the DOM mini receipt and `mb-print-tear` write.

## 6. Animation choreography

### (a) Entrance timeline

| Element | Property | From | To | Duration | Delay or stagger | Easing | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rail | none | n/a | n/a | n/a | n/a | n/a | Present at first paint; no entrance |
| Rail label card (`en-rail-label`) | opacity, translateX | 0, -4px | 1, 0 | `--dur-label` 200ms | none | `--ease-post` | Hover or `:focus-visible` on a rail link |
| Tape dock (`en-tape-dock`, new preset) | transform translateY | -100% (hidden behind navbar) | 0 | `--dur-row` 240ms | none | `--ease-post` | Active entry becomes 02 or later |
| Tape undock (`en-tape-dock`, reversed) | transform translateY | 0 | -100% | 240ms | none | `--ease-retract` | Active entry returns to 00 or 01 |
| Tape line swap (`kt-tape-line`) | transform translateY (both lines) | new 100% to 0; old 0 to -100% | as given | `--dur-post` 600ms | none, one group | `--ease-post` | A new receipt line is posted |
| Tick change | height, color | 4px / Circuit Border | 8px / Phosphor White (and previous reverses) | instant | none | none | Active entry changes (instant swap, per motion rule that scroll-driven numbers do not animate) |
| Tape dialog open | opacity, translateY | 0, 16px | 1, 0 | 240ms | none | `--ease-post` | Tap on the tape (`@starting-style`) |
| Tape dialog close | opacity | 1 | 0 | 240ms | none | `--ease-retract` | Close, Escape, backdrop, or link |
| Skip link | none | n/a | n/a | instant | none | none | `:focus` shows it with no transition |

The only motion group moving at once is the tape line swap (limit is 2 groups). When a swap is in flight and another line posts, the in-flight swap completes instantly, then the new one starts (motion rule 3.5). A line never queues.

`en-tape-dock` is the one addition to the 03-motion-system preset catalogue (Enter family). It uses existing tokens only. `will-change: transform` is set on the two line boxes only while `data-state` is `entering` or `leaving`, and removed on `transitionend`.

### (b) Scroll-linked behaviour

No ScrollTrigger, no pin, no scrub, no Lenis dependency. All scroll awareness uses one `IntersectionObserver`.

- Observer: targets the 11 entry sections (`#entry-00` to `#entry-10`), `rootMargin: "-45% 0px -45% 0px"`, `threshold: 0`. The entry intersecting the 10% centre band is active. If two intersect, the later entry in document order wins. If none intersects (for example in the footer), the previous value is kept.
- Output: `ledgerStore.setActive(id)` and `document.documentElement.dataset.activeEntry = id`. The navbar caption and the rail read from here too.
- The observer runs at every width, including 1024 to 1279px, where neither element is displayed, because the navbar caption depends on it.

| Input (active entry) | Rail | Tape |
| --- | --- | --- |
| 00 to 01 | Link for that entry current | Docked state off (hidden, `visibility: hidden` after 240ms, so unfocusable) |
| 02 to 10 | Link for that entry current | Docked; tick index 02 to 10 is the tall white tick |
| Footer in view | Entry 10 stays current | Docked, stays as is |
| Scrolling up | Reverses exactly | Undocks when active returns to 01 |

Rail values by state:

| State | Number color | Square | `aria-current` | Hidden suffix |
| --- | --- | --- | --- | --- |
| Not current | Sage 60 | none | absent | none |
| Current | Phosphor White | 6px filled Phosphor White | `"true"` | ", current" |

### (c) Micro-interactions

| Control | Hover | Focus | Press |
| --- | --- | --- | --- |
| Rail link (`mi-nav-link`, `en-rail-label`) | Number to Phosphor White (`--dur-colour` 300ms); label card appears | 2px Phosphor White outline, inset (offset -2px) so the capsule never clips it; label card appears; no transition on the outline | Background Ground Iron #181818 for the press, no scale, no layout change |
| Tape button | Background Carbon Veil, 300ms (fine pointers only) | 2px Phosphor White inset outline | Background Carbon Veil; chevron unchanged; dialog opens on `click` |
| Dialog entry link | Row background Carbon Veil, 300ms | 2px Phosphor White outline | same as hover |
| Dialog Close | `mi-default` | `mi-focus` | `mi-default` |
| Skip link | n/a | Appears instantly, 2px Void inner ring on Phosphor White so the ring stays visible | Native activation |

Rail click: plain `<a href="#entry-NN">`. At 1024px and wider with full motion, `anchors.ts` handles it (smooth for jumps of 2 viewport heights or less, instant for longer jumps) and then focuses the entry's H2 (`#entry-NN-title`, `tabindex="-1"`). Below that, and with Reduced motion or no JS, the jump is native and instant.

### (d) Hand-off to the next section

Nothing is handed off, because the rail and tape do not own scenes or lime. Two subtle relationships:

- At first paint the rail already shows 00 as current beside the hero, so the visitor sees the ledger's index before the hero finishes inking.
- The tape's first appearance (entry 02) coincides with the receipt's feed-and-stop beat. The tape shows the feed summary line, then `02 · Fit gate · …` 200ms later, mirroring the slip.

## 7. Reduced-motion, no-JS and low-tier variants

| Variant | Behaviour |
| --- | --- |
| Reduced motion (`html[data-motion="reduced"]` or OS setting without the Full override) | Duration tokens resolve to 0.01ms. The tape line swap is an instant text change, the dock and the dialog are instant, the label card has no translate, anchors jump instantly. Content, order and state are identical |
| No JavaScript | Rail: rendered as plain links to `#entry-NN`; no `aria-current`, no active state, no labels beyond CSS `:hover` and `:focus-visible` (which still work). Tape: rendered with the `hidden` attribute and removed on mount, so no dead control appears. Skip links work natively. Page is fully usable by scrolling |
| Low tier (T0, no WebGL) | No effect. This chrome never depended on WebGL |
| Slow network, before hydration | Rail and tape ship in the server HTML in their default states (`tapeDefault`, no active entry). The tape is hidden by CSS, so there is no layout shift (fixed positioning) |
| Motion toggle | Flipping `html[data-motion]` takes effect on the next event; an in-flight line swap completes instantly (`completeAll`) |
| Save-Data or low memory | No difference |
| Print | Rail, tape and dialog are `display: none` in `@media print` |

## 8. Accessibility

Landmarks and headings:

- Rail: `<nav aria-label="Page entries">` containing a `<ul>` of 11 `<li><a>`. Distinct from the navbar's navigation landmark and the footer navs.
- Tape: no landmark. It is a `<button>` in a plain wrapper.
- Dialog: native `<dialog aria-label="Posted lines and entries">`, opened with `showModal()`. It contains two `<h2>` ("Posted so far", "Go to an entry"). They do not break the page's heading outline because the modal is its own context, and the H1 is not inside it.
- There is no H1 or H2 in the rail or tape themselves.

Focus order (DOM order): skip link 1, skip link 2, navbar controls, `<main>` content (entries 00 to 10), rail links (1280px and wider only), tape button (below 1024px only, when docked), footer. The hidden elements are removed from the tab order with `display: none` (breakpoints) or `visibility: hidden` (undocked tape).

Screen-reader behaviour:

- Rail link accessible name: "Entry 05, Send and receipt" (with ", current" appended for the active link). Visible text "05" is contained in the name (WCAG 2.5.3). The visible number, square and label card are `aria-hidden`; the name comes from a visually hidden span.
- The tape button has `aria-label` from `ledger-rail.tapeLabel`, updated whenever the latest line changes. There is no live region on the tape, because it changes as a result of the visitor's own scrolling, and the hero's `<aside aria-label="Sample receipt">` already lists printed lines. This avoids up to 15 announcements.
- The chevron, ticks and posting squares are `aria-hidden`. The tick position conveys nothing that "current" does not.
- Dialog: native focus trap and `Escape`; focus lands on Close (first focusable), and returns to the tape button on close. Entry links carry `aria-current="true"` for the current entry. The posted-lines `<ol>` lists each line as plain text; the feed rows collapse to the one summary item.
- Skip links: visible on focus, 44px tall, first in DOM. "Skip to main content" focuses `<main id="main" tabindex="-1">`. "Skip to pricing" focuses `#entry-07-title`.

Targets and contrast:

- Rail targets: 44px tall; 32px wide at 1280 to 1439 (cannot be 44 without covering the 32px page margin) and 44px wide from 1440. Adjacent targets touch with no gap, because the pitch equals the height. Deviation from A16's 8px spacing, accepted: the 24px minimum of WCAG 2.5.8 is exceeded, and the rail is a secondary index (the page also has skip links and keyboard scrolling). Flag for the design-system owner.
- Tape: 48px by full width. Dialog rows: 44px tall with 8px gaps. Close: 44px.
- Contrast pairs in section 4 all pass AA.
- Focus is never obscured: scroll-padding is 80px at 1024px and wider and 128px below.

Other:

- Colour is never the only signal: the current entry has a filled square, white text and `aria-current`.
- The dialog does not auto-open and is not triggered by scroll.
- Text scaling: the tape text clamps at 2 lines with the full text one tap away. At 200% text size the tape stays 48px; if it overflows, the clamp trims and the dialog holds the full line.

## 9. Performance notes

- Animated properties: `transform` and `opacity` only. Colour transitions are 300ms and local to small controls. Nothing animates layout.
- Elements: rail about 35 nodes (11 links, 11 labels, squares); tape about 25 nodes; dialog contents are rendered only while open, up to roughly 50 nodes at that moment.
- One `IntersectionObserver` with 11 targets and no scroll listeners. Per-scroll main-thread cost is zero outside callbacks.
- `will-change: transform` only on the tape line boxes during the 600ms swap (maximum 2 elements, within the global cap of 4).
- `backdrop-filter` is not used on the rail, the tape or the dialog; the dialog backdrop is a flat 60% Void.
- Assets: none. The chevron is one 16px inline SVG path. No images, no new fonts.
- JS budget: this section adds at most 3 KB gzip to the 20 KB islands budget. It is part of the always-loaded island chunk, never the motion or WebGL chunks, because it must work with Reduced motion and on phones.
- CLS: both elements are `position: fixed`, so they cause zero layout shift. The tape has a constant 48px height.
- INP: opening the dialog is a single `showModal()` call; measured interaction target is 100ms or less under 4x CPU throttle.

## 10. Implementation

Files and rendering:

| Path | Kind | Notes |
| --- | --- | --- |
| `web/components/landing/islands/ledger-rail.tsx` | Client island | Props: none. Renders the nav. Mounts the active-entry observer (always, at every width). Exports `LedgerRail` |
| `web/components/landing/islands/receipt-tape.tsx` | Client island | Props: none. Button, line swap, ticks, `<dialog>`. Exports `ReceiptTape` |
| `web/components/landing/islands/skip-links.tsx` | Server component (no state) | Two `<a class="lp-skip">`. Not an island. Props: none; text from `landingCopy.skip` |
| `web/lib/landing/active-entry.ts` | Module | `observeActiveEntry(onChange)` returns a disposer. Idempotent. Writes `ledgerStore.setActive` and `html[data-active-entry]` |
| `web/lib/landing/tape-line.ts` | Module | `latestTapeLine(printed, copy)` implementing the section 2 rules; pure, unit tested |
| `web/components/landing/landing.css` | Styles | `.lp-rail`, `.lp-rail__link`, `.lp-rail__label`, `.lp-tape`, `.lp-tape__window`, `.lp-tape__line`, `.lp-tape__ticks`, `.lp-skip` (all already reserved lp- classes: `lp-rail`, `lp-tape`) |
| `web/components/landing/motion.css` | Styles | `en-rail-label`, `en-tape-dock`, `kt-tape-line` |
| `web/components/landing/landing-shell.tsx` | Edit | Skip links first; then Navbar; `<main>`; then `<LedgerRail />` and `<ReceiptTape />`; then Footer (see F3) |

Data contracts (existing store names from the architecture):

- Reads `ledgerStore.active`, `ledgerStore.printed`, `ledgerStore.posted` via `useLedger`. Reads `landingCopy["ledger-rail"]`, `landingCopy.scene.lines`, `landingCopy.skip`.
- Writes only `ledgerStore.setActive` (rail). The tape writes nothing.

Component behaviour details:

- Tape state: `docked = active >= "02"`. Line swap uses two keyed line elements with `data-state="current|entering|leaving"`. On a new line: mount `entering` at `translateY(100%)`, next frame set `current`/`leaving` classes so the transition runs, remove `leaving` on `transitionend` (with a `setTimeout(650)` safety fallback). If a swap is in flight, snap it first.
- Tape button `aria-label` interpolates `{latestLine}`.
- Dialog: open with `showModal()`, set `document.documentElement.dataset.dialog = "tape"` to lock page scroll (CSS `html[data-dialog] { overflow: hidden }`), clear on `close`. Close on backdrop click by comparing the click target to the dialog element. Clicking an entry link calls `dialog.close()` and lets the default hash navigation proceed. `data-lenis-prevent` on the dialog. `useLayoutEffect` cleanup closes the dialog on unmount (global side-effect table, architecture 724).
- Rail `aria-current` is rendered from React state only after mount; server HTML has none.
- Both islands call `hidden` removal after mount so no-JS shows no dead controls.

Existing pieces reused: `ledgerStore`, `landingCopy`, the `lp-` classes, tokens `--surface`, `--surface-raised`, `--border`, `--foreground`, `--body`, `--ease-post`, `--ease-retract`, `--dur-label`, `--dur-row`, `--dur-post`, `--dur-colour`, `--lp-*` size and z tokens, presets `mi-nav-link`, `mi-focus`, `mi-default`, `en-rail-label`, `kt-tape-line`. New preset: `en-tape-dock`. No new dependencies.

Open questions for the owners of other docs: (1) design-system: accept the 44px rail pitch with no gap (A16 deviation) and the Phosphor White skip link; (2) motion-system: add `en-tape-dock`; (3) architecture: move the mount points per F3 and name `active-entry.ts` as the owner of `setActive`.

## 11. Acceptance criteria

- [ ] `getComputedStyle` shows the rail visible at 1280 and 1440 widths, and `display: none` at 1279, 1024 and below. The tape is `display: none` at 1024 and above and visible (after entry 02) at 1023, 768, 640 and 360.
- [ ] Rail has 11 links in order 00 to 10, each with accessible name "Entry NN, {title}"; the active one also has "current" and `aria-current="true"`. Exactly one link has `aria-current` at any time after hydration.
- [ ] Scrolling so the centre band sits in entry 05 makes the entry 05 link current within one frame of the observer firing; scrolling back to entry 04 reverses it.
- [ ] At 1280px width the rail's bounding box is within the right 32px margin (right edge at 1280, left edge at or beyond 1248). At 1440 it is within the 80px gutter.
- [ ] Rail link height is 44px at 720px viewport height and never below 32px at any height; width is 32px at 1280 to 1439 and 44px from 1440.
- [ ] Hover or focus on a rail link shows its title label (opacity 1) within 200ms; the label is `aria-hidden`; keyboard focus shows the same label and a visible 2px outline.
- [ ] Contrast measured in a browser: Sage 60 on Carbon Veil at least 6.0:1, Phosphor White on Ground Iron at least 16:1, skip link text at least 18:1.
- [ ] No element in this section uses the lime fill, a font weight other than 400 or 500, a glow, a gradient or a shadow.
- [ ] At 390px, scrolling to entry 01 shows no tape (`visibility: hidden`, not in the tab order); scrolling to entry 02 docks it under the 64px navbar (top 64px, height 48px) over 240ms.
- [ ] Tape text before any line past 00 is exactly "00 · Ledger opened". After the feed prints it shows "Sample run: 48 postings, {skipped} skipped, {passed} passed" with real numbers, then "02 · Fit gate · hard rules first · every skip has a reason" about 200ms later. Header lines never appear on the tape.
- [ ] When a new line posts, the old line translates 0 to -100% and the new line 100% to 0 simultaneously over 600ms with `cubic-bezier(0.22, 1, 0.36, 1)`; only `transform` changes. If a second line posts mid-swap, the first completes instantly and no more than 2 line elements ever exist.
- [ ] The tape ticks are 11 in number; the tick for the active entry is 8px and Phosphor White, others 4px and Circuit Border.
- [ ] Tape `aria-label` equals the copy template with the current line substituted and contains the visible text. No `aria-live` region exists on the tape.
- [ ] Tapping the tape opens the native dialog (`dialog.open === true`), focus moves to Close, Escape and backdrop click close it, and focus returns to the tape button. Page scroll is locked while open.
- [ ] The dialog lists every printed line in order (feed rows collapsed to one item) and 11 entry links; each link row is 44px tall with 8px gaps; the current entry has `aria-current`. Choosing a link closes the dialog and scrolls to the entry with the heading in view below the 112px of fixed chrome.
- [ ] Tab order on a fresh load at 1440: skip link 1, skip link 2, navbar, main content, rail, footer. The rail is never before the hero in tab order.
- [ ] "Skip to main content" moves focus to `<main>`; "Skip to pricing" moves focus to the entry 07 H2; both skip links are hidden until focused and are not lime.
- [ ] With `prefers-reduced-motion: reduce` (and with the Motion control set to Reduced): the line swap, dock, label card and dialog complete in 0.01ms; text and state are identical to Full.
- [ ] With JavaScript disabled: rail links navigate natively; no tape or other dead control is visible; skip links work.
- [ ] axe-core reports zero critical or serious violations at 375, 768, 1024 and 1440 in Full, Reduced and approved states.
- [ ] Layout: horizontal scroll width never exceeds viewport width at 360, 390, 640, 768; CLS contribution of this section is 0.
- [ ] The section adds 3 KB gzip or less to the island chunk, loads no GSAP, Lenis or three code, and runs one `IntersectionObserver`.
