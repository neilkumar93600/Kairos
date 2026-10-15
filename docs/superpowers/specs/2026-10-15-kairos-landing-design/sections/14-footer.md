# 14. Footer: colophon and page receipt

Section id `footer`, tier utility, scroll length about 60vh, WebGL state none. Previous section: `entry-10-start` (`slip-fresh`). Next section: none, end of page.

## 1. Purpose and narrative beat

The footer closes the page accountably. The page is a ledger that wrote itself as the visitor read; the footer is where it prints a receipt for itself. A small table states what the page contains and what it does not: how many claims it makes, that every demo is labelled sample data, that it holds no testimonials, logos or user counts, that prices are read from the plan file the app bills from, that the reason text is checked against the rule code, and when it was built. Nothing in the table is typed by hand. The claims count and the build date are generated at build, and a claims-register test fails the build if the count drifts.

Narrative beat: the colophon. The visitor has just been asked once (entry 10). The footer asks for nothing. It shows its own paperwork, then stops.

Signature moment: the page receipt posts its rows top to bottom under a perforation that draws left to right, and the last row, the build date, is stamped inside a signature box (Kairos mark M9). Above the receipt, the line `CHRONOS 14:32 YOUR TIME · KAIROS WHEN YOU APPROVE` shows the visitor's clock time, updated once a minute, next to the one phrase that is not on the clock. Chronos is clock time and keeps moving. Kairos is the right moment and is the visitor's. The footer is the only place where the page shows time passing, and it does so slowly and on the minute, never as a countdown.

Lime: the footer has no lime element. Lime custody passes from `closing` (entry 10 "Start free") to `navbar` when the closing CTA leaves the viewport, and the navbar "Start free" is the single lime element while the footer is on screen.

## 2. Content

All strings come from `06-copy-deck.md` section 16 (`footer.*`), served from `landingCopy.footer`. Verbatim:

| Key | Text | Rendered as |
|---|---|---|
| `footer.receiptCaption` | Receipt for this page | `<caption>` of the page receipt table, visible, Caption size |
| `footer.receipt[0]` | Claims on this page · {N} · each links to where the page shows it | Row 1. `{N}` is computed at build from `web/content/claims.ts` |
| `footer.receipt[1]` | Sample data · labelled on every demo | Row 2 |
| `footer.receipt[2]` | Testimonials, logos, user counts · none | Row 3 |
| `footer.receipt[3]` | Prices · read from the plan file the app bills from | Row 4 |
| `footer.receipt[4]` | Reason text · checked against the product's rule code | Row 5. Ships only when prerequisite P1 passes; otherwise the row is omitted |
| `footer.receipt[5]` | Built · {BUILD_DATE} | Row 6, inside the signature box. `{BUILD_DATE}` from `process.env.BUILD_DATE` |
| `footer.clockLine` | CHRONOS {HH:MM} YOUR TIME · KAIROS WHEN YOU APPROVE | Uppercase caption, `aria-hidden="true"` |
| `footer.clockLineServer` | KAIROS WHEN YOU APPROVE | Server-rendered text of the same element |
| `footer.kairosDefinition` | kairos (Greek): the right moment, as distinct from chronos, clock time. | Deep Fern, `aria-hidden="true"` |
| `footer.motionLegend` | Motion | `<legend>` |
| `footer.motionOptions` | Full · Reduced | Two radios, labels "Full" and "Reduced" |
| `footer.motionHelp` | Reduced turns off the receipt animation and the scroll effects. The page says the same things either way. | Help text |
| `footer.motionLive` | Motion set to {Full or Reduced}. | Polite live region |
| `footer.groups` | Product: How it works, Pricing, Blog. Company: About, Careers, Contact. Legal: Terms, Privacy, Cookies, Refunds | Link groups from `siteConfig.footer`, hrefs from config |
| `footer.contactLabel` / `footer.contactEmail` | Contact / `{siteConfig.supportEmail}` | `mailto:` link, never typed as a literal |
| `footer.company` | Kairos by Gray Matter Labs | Small text |
| `footer.copyright` | © {BUILD_YEAR} Gray Matter Labs | Small text |
| `footer.legalNote` | Legal pages are being reviewed and will be updated before launch. | Small text, Sage 40. Dropped when gate G8 passes |

Changes flagged against the copy deck:

1. New string `footer.claimsToggle`: "Show the {N} claims". Row 1 promises that each claim links to where the page shows it, but the copy deck defines no list. A native `<details>` under row 1 lists each claim (its short text from `claims.ts`) as a link to its `#entry-NN` anchor. The `{N}` in row 1 and in the toggle are the same build-time value. Without this string the row's promise is unfulfilled.
2. `footer.receipt[0]` uses "Claims on this page · {N}"; the placeholder `{N}` must never be a literal in the repo. The claims-register test reads the rendered text and compares it with `claims.length`.
3. The footer logo is the Phosphor White landing mark, never lime (matches the navbar rule A11).
4. The Deep Fern definition fails text AA (4.25:1 on Void). It is kept because the creative direction locks it as decorative, and `aria-hidden` plus the identical sentence in entry 04 carry the meaning. Fallback if review rejects decorative-text exemption: change one token, `--footer-def: var(--muted)` (Sage 40, 4.69:1), with no layout change.
5. No new hype words and no em dashes. The separator is U+00B7 only.

## 3. Layout structure

The footer is a full-bleed `<footer>` on `--background` (Void). Its top edge is the perforation rule (M7, third permitted use). Inside, content uses `lp-container` (max 1280, content 1216 at 1440). Section padding uses `--section-pad-landing` for the top (128px desktop, 96px tablet, 80px mobile) and a fixed 48px bottom. At 1024px and wider the footer has `min-height: 60svh` with the bottom row pushed to the end (flex column, `justify-content: space-between`); below 1024px it is natural height so no empty void appears on phones.

### Desktop 1440 and 1280 (12 columns, gap 32px)

| Block | Columns | Notes |
|---|---|---|
| Clock line and definition | 1 to 12 | One row. Clock line left, definition below it, both left-aligned, max width 34rem |
| Page receipt | 1 to 6 (about 592px at 1440, 560 at 1280) | Table, 6 rows, row height 40px (rows are not interactive except row 1 toggle, which is 44px) |
| Link groups | 8 to 12 | Product cols 8 to 9, Company cols 10 to 11, Legal col 12. At 1280 a column is 72px, so Legal is 72px wide; "Refunds" and "Privacy" fit at 14px |
| Contact and Motion control | 8 to 12, under the link groups | Contact label and email, then Motion fieldset |
| Bottom row | 1 to 12 | Logo (24px mark), `footer.company`, `footer.copyright`, `footer.legalNote` |

Vertical rhythm (spacing scale 8px): top pad 128; clock line, 16 gap, definition; 48 gap; receipt and link area; 64 gap; 1px `--divider` hairline; 24 gap; bottom row; 48 bottom pad.

```
==================================================================  <- perforation rule, full bleed (draws L to R)
 (128px)
 CHRONOS 14:32 YOUR TIME · KAIROS WHEN YOU APPROVE
 kairos (Greek): the right moment, as distinct from chronos, clock time.

 Receipt for this page                       Product    Company    Legal
 +--------------------------------------+    How it    About      Terms
 | Claims on this page · 6    [Show]    |    works      Careers    Privacy
 | Sample data · labelled on every demo |    Pricing    Contact    Cookies
 | Testimonials, logos, user counts·none|    Blog                  Refunds
 | Prices · read from the plan file ... |
 | Reason text · checked against ...    |    Contact  hello@kairos.app
 | [ Built · 2026-10-15 ]  (sig. box)   |    Motion   (o) Full  ( ) Reduced
 +--------------------------------------+    Reduced turns off the receipt ...
 ------------------------------------------------------------------  hairline
 [K] Kairos by Gray Matter Labs   © 2026 Gray Matter Labs   Legal pages are ...
```

The "[Show]" is the `<details>` summary (see section 2, change 1). Numbers in the wireframe are illustrative; the real values are generated.

### Laptop 1024 (12 columns, gap 32, margin 32, column about 56px)

Same arrangement. Receipt cols 1 to 6 (about 376px; long rows wrap to two lines, row height auto with 8px vertical padding, min 40px). Link groups: Product cols 8 to 9, Company 10 to 11, Legal 12 (56px wide, "Refunds" at 14px is about 52px, fits; if overflow occurs at 1024 the Legal group drops to cols 8 to 9 on a second row). Rail is not present at this width (rail is 1280 and up).

### Tablet 768 (8 columns, gap 24, margin 24)

Single flow with two-column pairs: clock line and definition cols 1 to 8; receipt cols 1 to 8 (full width, about 720px); below it a 3-column link grid (each group 2 cols, Legal 2 cols plus Contact in the fourth slot cols 7 to 8) ; Motion fieldset cols 1 to 8; bottom row cols 1 to 8 stacked. Top pad 96px. The receipt tape (48px sticky) is not visible in the footer (tape stops after entry 10); scroll-padding is unaffected.

### Mobile 360 to 640 (4 columns, gap 16, margin 16)

Everything cols 1 to 4, single column. Order: clock line, definition, receipt, link groups (2 columns of 2 columns each at 360: Product and Company on one row, Legal and Contact on the next), Motion fieldset, bottom row. Top pad 80px, bottom pad 48px plus `env(safe-area-inset-bottom)`. Receipt rows wrap; row labels may break after the U+00B7 separator, so set each side of the separator in its own `<span>` with the left part on one line when possible and `text-wrap: pretty`. Link targets are 44px tall with 8px gaps.

```
=========================  <- perforation
 (80px)
 CHRONOS 14:32 YOUR TIME ·
 KAIROS WHEN YOU APPROVE
 kairos (Greek): the right
 moment, as distinct from
 chronos, clock time.

 Receipt for this page
 +---------------------+
 | Claims on this page |
 | · 6      [Show]     |
 | Sample data ·       |
 | labelled on every.. |
 | Testimonials, ...   |
 | Prices · read ...   |
 | Reason text · ...   |
 | [Built · 2026-10-15]|
 +---------------------+
 Product        Company
 How it works   About
 Pricing        Careers
 Blog           Contact

 Legal          Contact
 Terms          hello@kairos.app
 Privacy
 Cookies
 Refunds
 Motion  (o) Full ( ) Reduced
 Reduced turns off ...
 ---------------------------
 [K] Kairos by Gray Matter Labs
 © 2026 Gray Matter Labs
 Legal pages are being ...
```

Clock line at 360px wraps after the middle dot; the clock text uses `text-wrap: balance`.

## 4. Visual design

| Element | Token and value |
|---|---|
| Footer surface | `--background` (Void #000000), opaque, `z-index: var(--lp-z-content)` so it fully covers the fixed canvas |
| Perforation rule | `--lp-perforation-image` (1px on, 3px off, 4px period), 1px tall, full bleed, in `--border` (Circuit Border #485346) |
| Hairline above bottom row | 1px `--divider` (#1f2a33) |
| Clock line | Caption role: `--type-caption-landing` (0.75rem), weight 500, uppercase, tracking 0.08em, `--label` (Moss 70, 10.29:1) for "CHRONOS HH:MM YOUR TIME ·" and `--foreground` (Phosphor White) for "KAIROS WHEN YOU APPROVE" so the phrase that is the visitor's carries the brightest value |
| Definition | `--type-caption-landing`, weight 400, `--micro` (Deep Fern #697368), decorative, `aria-hidden` |
| Receipt caption | Caption role, `--label` |
| Receipt rows | `--type-small-landing` (0.875rem), weight 400, `--body` (Sage 60, 8.29:1); left part of each row `--body`, right-of-separator values in `--foreground`; tabular slashed-zero numerals (M8) on `{N}` and the date |
| Row dividers | 1px `--divider` between rows; no outer card, no fill, radius 0 (A12: paper edges are carried by perforation, here the top rule) |
| Posting square (M3) | 6px square before each receipt row label, `--border` outline (unfilled) before posting, filled `--foreground` once posted; decorative, `aria-hidden` |
| Signature box (M9) | 1px `--foreground` box around "Built · {BUILD_DATE}", padding 4px 8px, radius 0; Caption size |
| Link group titles | Caption role, `--label`, uppercase, tracking 0.08em |
| Links | `--type-small-landing`, `--body`, hover `--foreground` (`mi-nav-link`), 44px tall hit area |
| Motion fieldset | Radio inputs native, accent colour `--foreground`; legend Caption in `--label`; help text `--body`. Sage 40 (`--muted`) is used only for `legalNote`, which sits on Void |
| Logo | Landing mark, Phosphor White, 24px |

Font weights 400 and 500 only. No glow, no gradient, no lime. Body text left-aligned. Status colours are not used in the footer.

## 5. WebGL

Scene state id: none. The footer carries `data-scene="none"`.

- Entry: when `entry-10-start` ends, the scene holds the final `slip-fresh` pose. As the footer's top edge rises over the fixed canvas, the opaque Void footer simply covers the lane. There is no transition authored for this section; no hand-off animation is needed because the footer is opaque.
- Leave: scrolling back up uncovers the `slip-fresh` pose unchanged (append-only; nothing prints on the way back).
- Layering: canvas at `--lp-z-canvas`, footer at `--lp-z-content` with an opaque background, so no text is ever drawn over the canvas. Contrast over the canvas is therefore not applicable; all footer contrast is measured against Void.
- While the footer covers more than the lane, the stage renders zero frames (the scene is at rest). The stage's own offscreen rule applies when the footer fully covers the canvas.

## 6. Animation choreography

Footer motion is CSS only at every width (no GSAP, no scroll scrub). It is triggered once by the existing `EntryPoster` island, which sets `data-post="live"` when the footer's top edge crosses 85% of the viewport height (same threshold as `ENTRY_START`, `top 85%`). Without JS the attribute is absent and the footer renders in its final state.

### (a) Entrance timeline

| Element | Property | From | To | Duration | Delay or stagger | Easing | Trigger |
|---|---|---|---|---|---|---|---|
| Perforation rule inner strip (clipped by a wrapper with `overflow: hidden`) | transform translateX | -100% | 0 | `--dur-post` 600ms | 0 | `--ease-post` | `data-post="live"`; preset `en-post-rule` |
| Clock line and definition | none | final | final | 0 | none | none | Not animated; readable at first paint |
| Receipt caption | none | final | final | 0 | none | none | Not animated |
| Receipt rows 1 to 5 (or 1 to 4 when P1 omits row 5) | transform translateY and opacity | 6px (`--dist-row`), 0 | 0, 1 | `--dur-row` 240ms | 200ms + 60ms (`--stagger-row`) per row | `--ease-post` | `data-post="live"`; preset `en-row-print` |
| Posting square per row | background fill | outline | filled | `--dur-swap` 120ms | with its row, +120ms | `--ease-utility` | preset `en-post-square` |
| Build date row (signature box) | border-colour | `--border` | `--foreground` | `--dur-colour` 300ms | starts when the last row ends (about 800ms) | `--ease-utility` | preset `em-stamp` |
| Link groups, Motion control, bottom row | none | final | final | 0 | none | none | No entrance (A4: body text has no entrance) |

Total sequence about 1.1s, one motion group at a time with at most two overlapping (rule and rows), within `MAX_GROUPS 2`. Row opacity starts at 0 only when `data-post="pending"` is set by the island after hydration; the server never renders pending, so no text is invisible at first paint.

### (b) Scroll-linked behaviour

None. There is no ScrollTrigger, no pin and no scrub in the footer. The only scroll dependency is the one-time `data-post` flip. Mapping:

| Footer top edge position | State |
|---|---|
| Below 85% of viewport height | `data-post="pending"` (only after hydration, and only when the footer starts below the fold) |
| At or above 85% | `data-post="live"`, sequence runs once, then the attribute is removed at the end |
| Page loaded already scrolled to the footer (anchor or reload) | `data-post="instant"`: final state, no animation |

The clock updates on its own timer: it computes the time to the next minute boundary and uses one `setTimeout`, then repeats per minute. It runs only while the footer is within 1 viewport of the screen (IntersectionObserver with `rootMargin: 100% 0px`) and while `document.visibilityState` is visible. On becoming visible again it refreshes immediately.

### (c) Micro-interactions

| Element | Hover | Focus | Press |
|---|---|---|---|
| Footer links, email | Colour `--body` to `--foreground`, 300ms, `mi-nav-link` | `mi-focus`: 2px `--foreground` outline, offset 2px | Colour holds, no scale |
| Claims `<details>` summary | Colour to `--foreground`, 300ms (`mi-details`) | `mi-focus` | Native toggle; list items appear with no animation |
| Claims list links | `mi-link` (underline offset change, 300ms colour) | `mi-focus` | None |
| Motion radios | `mi-control`: label to `--foreground` | `mi-focus` on the radio | Native; selection applies immediately (see below) |
| Logo | None | `mi-focus` | None |

Selecting a Motion radio calls `setMotion`, updates `html[data-motion]`, announces `footer.motionLive` in a polite live region, and persists to `localStorage["kairos:motion"]` in try/catch.

### (d) Hand-off to the next section

There is no next section. The page ends at the footer's bottom edge. Hand-offs into the footer:

- Lime (`ho-lime`): when the entry-10 closing CTA leaves the viewport, lime passes to the navbar "Start free" in 150ms + 150ms. The footer takes no part.
- Canvas: covered by the opaque footer (section 5).
- Tape and rail: the receipt tape is hidden after entry 10; the rail's current entry stays 10.

## 7. Reduced-motion, no-JS and low-tier variants

| Condition | Behaviour |
|---|---|
| `prefers-reduced-motion: reduce` or Motion set to Reduced | `data-post` is set to `instant`; the rule, rows, squares and stamp render in their final state. The clock shows the time once at hydration and does not update (the toggle also stops the clock, per motion system 12). Hover colour transitions stay at 300ms (`--dur-colour` is not zeroed) |
| No JavaScript | Server HTML is complete: clock line reads "KAIROS WHEN YOU APPROVE" alone; receipt rows, link groups, contact and legal links render; the Motion fieldset renders but is inert, so it is hidden with a `<noscript>` rule (`.lp-motion-control { display: none }` inside `<noscript><style>`). The claims `<details>` works natively |
| Tier 0 or 1 (no WebGL, or low device) | Identical. The footer does not use WebGL. The DOM rows motion is the same CSS. If frame sampling lowers the tier, nothing in the footer changes |
| Save-data or slow network | Identical. No images or extra fonts are loaded by the footer |
| Print stylesheet | Footer visible; perforation printed as a dotted rule; clock line hidden |

## 8. Accessibility

- Landmark: `<footer>` is the page `contentinfo` landmark (a direct child of the `.lp` shell, outside `<main>`). It needs no `aria-label` because there is one per page.
- Headings: link groups sit in `<nav aria-label="Footer">`, each group titled by an `<h2 class="lp-caption">` (Product, Company, Legal). Entry sections also use H2 and the footer is a sibling region, so no level is skipped. The receipt is a labelled table, not a heading. The colophon id is `colophon` on the footer's receipt wrapper for deep links.
- Focus order: receipt claims summary, Product links, Company links, Legal links, contact email, Motion radios, then (end of page). The clock line and definition are not focusable. Visual order equals DOM order at every width (do not use `order` utilities to reorder).
- Page receipt: a real `<table>` with `<caption>` (visible), `<tbody>` rows, each row `<th scope="row">` for the left phrase and `<td>` for the value; the build date in `<time datetime="{BUILD_DATE}">` inside the signature box. Because the copy deck writes each row as one string, the left/right split by U+00B7 is done in markup by the component from a typed `{label, value}` pair, and the test asserts the concatenation equals the copy-deck string.
- Clock line: `aria-hidden="true"`, since it is decorative and updating text would otherwise be announced. It contains no information that is not available elsewhere (entry 04 says "Kairos is Greek for the right moment. You choose it.").
- Deep Fern definition: `aria-hidden="true"`.
- Motion control: `<fieldset><legend>Motion</legend>` with two native radios `name="motion"`, visible labels, `aria-describedby` pointing at the help text; changes are announced via `role="status"` / `aria-live="polite"`. It supports keyboard with arrow keys (native radio behaviour). Target size: each radio row is 44px high with 8px spacing (A16).
- Targets: every link and the `<details>` summary has a 44px minimum hit area and 8px spacing.
- Contrast on Void: Phosphor White 19.41:1; Sage 60 8.29:1; Moss 70 10.29:1; Sage 40 4.69:1 (Void only); Circuit Border rule and hairlines are decorative and carry no meaning on their own (text accompanies each); Deep Fern 4.25:1 (decorative, `aria-hidden`; see flagged change 4). Focus ring Phosphor White on Void 19.41:1 (WCAG 2.4.11 and 1.4.11 pass).
- Colour is not the only signal: posting squares are decorative; the posted/unposted state is not meaningful content.
- Skip links: the footer is the destination of no skip link; `colophon` is a deep-link anchor only.

## 9. Performance notes

- Animated properties: `transform` and `opacity` for rows and the rule strip; `border-color` for the stamp (small, local, one element); `background-color` for 6px squares. Nothing animates layout.
- `will-change`: none permanently. `will-change: transform` is set on the rule strip and the rows only while `data-post="live"`, and removed on completion (within `MAX_WILL_CHANGE 4`).
- Elements: about 6 receipt rows, 6 squares, 1 rule strip animated: 13 animated elements, all within one section, finishing in about 1.1s. Total footer DOM about 70 nodes.
- JavaScript: `FooterClock` (about 0.4 KB gzip), `MotionToggle` footer instance (about 0.6 KB), and reuse of `EntryPoster`. All inside the 20 KB islands budget. No GSAP, no images, no web fonts beyond the page's Inter and Inter Tight.
- Assets: none. The perforation is a CSS gradient; no SVG or raster.
- Build-time data: `N` from `claims.ts` and `BUILD_DATE`/`BUILD_YEAR` from env are inlined into server HTML; no runtime fetch.
- The clock timer fires at most once a minute and only while the footer is near the viewport.
- CLS: the receipt rows reserve their height in the pending state (they move by transform only); the clock text lives on a fixed-height line (`min-height: 1.5em`); the prefix appears at the start of the line, and nothing else shares that line, so no layout shift is reported.

## 10. Implementation

Files and paths:

| File | Kind | Purpose |
|---|---|---|
| `web/components/landing/entries/colophon.tsx` | Server component | Whole footer markup: rule, clock line, definition, receipt, link groups, contact, Motion slot, bottom row. Reads `landingCopy.footer`, `siteConfig`, `claims`, `process.env.BUILD_DATE` |
| `web/components/landing/islands/footer-clock.tsx` | Client island | `FooterClock({ serverText })`: inserts `CHRONOS {HH:MM} YOUR TIME · ` before the server text, per-minute timer, offscreen and visibility pausing, honours reduced motion |
| `web/components/landing/islands/motion-toggle.tsx` | Client island (shared) | `MotionToggle({ variant: "full" })` renders the fieldset in the footer; the same component with `variant="compact"` lives in the hero lane and navbar sheet |
| `web/components/landing/islands/entry-poster.tsx` | Client island (reused) | Sets `data-post` on elements with `data-section="footer"` using the 85% threshold |
| `web/components/landing/landing.css` and `web/components/landing/motion.css` | CSS | Classes `lp-footer`, `lp-perf`, `lp-receipt-row`, `lp-post`, `lp-stamp`, `lp-caption`; presets `en-post-rule`, `en-row-print`, `en-post-square`, `em-stamp`, `mi-nav-link`, `mi-focus`, `mi-details`, `mi-control` |
| `web/content/claims.ts` | Data | Source of `N` and of the claims list |
| `web/content/landing-copy.ts` | Data | Adds `footer.claimsToggle` |
| `web/components/landing/colophon.test.tsx` and the claims-register test | Tests | See section 11 |

Server or client: `colophon.tsx` is a server component; only `FooterClock`, `MotionToggle` and the already-present `EntryPoster` are client islands.

Props and types:

```ts
// footer-clock.tsx
type FooterClockProps = { serverText: string }; // "KAIROS WHEN YOU APPROVE"
// colophon.tsx data shape
type ReceiptRow = { label: string; value: string; stamp?: boolean };
```

Tokens used: `--background`, `--foreground`, `--body`, `--muted`, `--label`, `--micro`, `--border`, `--divider`, `--perforation`, `--lp-perforation-image`, `--type-small-landing`, `--type-caption-landing`, `--section-pad-landing`, `--lp-hit`, `--lp-hit-gap`, `--lp-z-content`, `--dur-post`, `--dur-row`, `--dur-swap`, `--dur-colour`, `--stagger-row`, `--dist-row`, `--ease-post`, `--ease-utility`. No new landing tokens are introduced; `--footer-def` is mentioned only as the optional fallback alias.

Existing components reused: `siteConfig` (`web/lib/site.ts`, groups and `supportEmail`), `Logo` (`web/components/shared/logo.tsx`, landing variant Phosphor White), `Container` (replaced by `lp-container` in the landing), and the existing `web/components/layout/footer.tsx` is not modified for other routes; the landing renders `colophon.tsx` in its place through the `(landing)` layout. `LandingShell` provides the `.lp` scope.

## 11. Acceptance criteria

- [ ] The footer is the last element in `.lp`, outside `<main>`, with `data-section="footer"`, and is a single `contentinfo` landmark.
- [ ] With JavaScript disabled, all receipt rows, link groups, contact, legal links and the sentence "KAIROS WHEN YOU APPROVE" are visible; the Motion fieldset is hidden.
- [ ] The receipt rows match `landingCopy.footer.receipt[0..5]` exactly after concatenating label, U+00B7 and value; row 5 is absent when P1 has not passed.
- [ ] `{N}` in row 1 and in the claims toggle equals `claims.length` from `claims.ts`; changing `claims.ts` without rebuilding fails the claims-register test.
- [ ] `{BUILD_DATE}` equals `process.env.BUILD_DATE`; no hand-typed date appears in source (grep test).
- [ ] The email link `href` equals `mailto:` plus `siteConfig.supportEmail`; the literal address appears nowhere in `colophon.tsx`.
- [ ] Link groups render Product, Company and Legal with the exact labels and hrefs from `siteConfig.footer`.
- [ ] No em dash (U+2014) or en dash (U+2013) in the footer's rendered text.
- [ ] No lime colour (`#7fee64`) is used in any footer element; at the footer viewport exactly one element has the lime fill, and it is the navbar "Start free".
- [ ] The perforation rule is 1px tall with a 4px period and draws left to right in 600ms with `cubic-bezier(0.22,1,0.36,1)` when the footer top reaches 85% of the viewport; it runs once.
- [ ] Receipt rows post top to bottom with a 60ms stagger starting 200ms after the trigger; each moves 6px and fades in over 240ms; the build date box turns Phosphor White at the end.
- [ ] At first paint (before hydration) no footer text has opacity below 1.
- [ ] Loading the page with a `#colophon` hash or reloading while scrolled to the footer shows the final state with no animation.
- [ ] The clock line shows `CHRONOS HH:MM YOUR TIME · KAIROS WHEN YOU APPROVE` in 24-hour local time after hydration, updates at each minute boundary (within 1s), and stops updating when the tab is hidden or the footer is more than one viewport away.
- [ ] With Reduced motion on, the clock displays the time once and never updates, the sequence is skipped, and all text is identical to Full motion.
- [ ] The clock line and the definition both have `aria-hidden="true"`; the definition is rendered in Deep Fern.
- [ ] The Motion fieldset has two native radios; selecting one sets `html[data-motion]`, stores `kairos:motion`, and announces "Motion set to Full." or "Motion set to Reduced." in a polite live region; storage failure does not throw.
- [ ] All interactive footer targets are at least 44px high with at least 8px between targets at 360, 768, 1024 and 1440 widths.
- [ ] No horizontal scroll at 360px; the receipt and clock line wrap.
- [ ] Contrast checks pass: Phosphor White, Sage 60, Moss 70 and Sage 40 text on Void each at 4.5:1 or higher; focus ring visible on every control.
- [ ] Footer adds no more than 1.2 KB gzip of JavaScript, no network requests, and a layout shift contribution of 0.
- [ ] `data-scene="none"` is set; the canvas is fully covered by the opaque footer and renders no frames while it is covered.
- [ ] Layout matches the wireframes at 1440, 1280, 1024, 768 and 360 widths (grid columns and spacing in section 3).
