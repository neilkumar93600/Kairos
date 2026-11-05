# 02 Design direction: marketing surfaces

DS-direction, 2026-11-03. Read with `README.md` (contracts, ownership) and `01-marketing-brief.md` (copy). Builders follow this literally; where a value is missing, use the nearest token below and note it in `reviews.md`.

**Sources, in order of authority:** owner decisions D1 to D3 → shipped code (`web/app/globals.css`, `web/components/landing/landing.css`, `web/components/landing/motion.css`) → `docs/DESIGN.md` (latest dated section wins) → this file. Code beats DESIGN.md's Inter-era numbers: the font is Urbanist (`--font-ui`, `--font-head`), card radius is 20 px (`--r-card`), glass blur is 14 px below 768 and 24 px from 768 at saturate 125 percent (`--glass-blur`). Always write the token, never the number.

**Skills applied:** `awwwards` (one signature per surface, every still frame complete, hover answers in the motion verb), `taste-design` (no invented numbers, no filler copy, label above input, no spinners), `ui-ux-pro-max` (44 px targets, focus management, z-index scale, errors near the field), `senior-frontend` (server components by default, client islands only for state). Where they conflict with DESIGN.md, DESIGN.md wins; see section 6.

---

## 1. Concept and motion verb

**Idea.** The marketing surfaces are the paperwork around the painting: quiet sheets laid on the valley haze, and every signature moment is a line written in ink.

**Motion verb: "written in ink".** Lines and rules write left to right with `clip-path` (the existing `lp-sign` keyframes, `--dur-sign` 500 ms, `--ease-out`). Surfaces arrive by rising 12 to 16 px and fading (`lp-reveal`, `lp-enter`, `Reveal` + `.lp-post`). Nothing bounces, springs, zooms or scales from zero. Pages are still at rest (DESIGN.md P1 "every motion ends"): the only loops on these surfaces are the existing dark-card mesh drift and the owner's meadow video on the 404 and in the footer. That stillness is a decision, not a gap.

**Status-mark grammar (used by every form and status here).** Done: 8 px lime dot with its 1 px ink ring (`.lp-dot`) beside an ink word. Waiting or not yet: 8 px hollow ink square (`.lp-square-open`) beside the word. Neutral: the word in `--faint`, no mark. Never colour alone.

---

## 2. Global rules

### 2.1 Tokens cheat sheet (all defined on `.lp`; see 2.7 for portals)

| Role | Token / class | 390 | 768 | 1024 | 1280+ |
|---|---|---|---|---|---|
| Page h1 (inner) | `.lp-page-h1` (`--t-page`) | 40 | 52 | 60 | 72 |
| Serif H2 (dark band only) | `.lp-serif-h2` `--t-serif-h2` | 36 | 40 | 46 | 52 |
| H2 | `.lp-h2` `--t-h2` | 32 | 36 | 40 | 44 |
| H3 | `.lp-h3` `--t-h3` | 26 | 28 | 30 | 32 |
| H4 / card title | `.lp-h4` `--t-h4` | 20 | 20 | 22 | 24 |
| Lead | `.lp-lead` `--t-lead` | 18 | 18 | 20 | 20 |
| Body | `.lp-body` `--t-body` | 17 | 17 | 18 | 18 |
| Body small | `.lp-body-sm` `--t-body-sm` | 16 | 16 | 16 | 16 |
| UI label (nav size) | `font: 500 15px/1.3 var(--font-ui)` | 15 | 15 | 15 | 15 |
| Caption | `.lp-caption` `--t-caption` (Deep Ash) | 14 | 14 | 14 | 14 |
| Micro | `.lp-micro` `--t-micro` | 12, SAMPLE chip and indices only | | | |
| Large light numeral | `font: 300 40px/1 var(--font-head)`, tabular | hidden | hidden | 40 | 40 |

| Spacing / layout | 390 | 768 | 1024 | 1280+ |
|---|---|---|---|---|
| `--gutter` | 20 | 32 | 48 | 80 |
| `--gap-section` | 64 | 80 | 96 | 120 |
| `--gap-intro` | 40 | 56 | 64 | 72 |
| `--pad-card` | 24 | 24 | 32 | 32 |
| `--rest` (new, local: resting-card overlap, 2.8) | 48 | 72 | 88 | 96 |

Containers: `.lp-wrap--main` 1280, `--narrow` 1120, `--copy` 760; prose measure 36rem. Radii: `--r-input` 8, `--r-card` 20, `--r-media` 24, `--r-pill`. Inside components use 4 to 32 px steps of 4; between components 40 to 96; between sections `--gap-section` as `padding-block-start` on the section (`.lp-section`), never margins on children.

### 2.2 Focus, targets, text size

- **Focus ring:** `outline: 2px solid var(--ink); outline-offset: 3px` (already global and on `.lp :focus-visible`). On the dark band it is `--on-dark` (existing `.lp .lp-dark-card :focus-visible`). Inputs: border turns `--action` on focus, the ring adds on keyboard focus (shared `Field`/`Input` in `components/shared/field.tsx`, reuse it). Programmatic focus targets (h1 with `tabIndex={-1}`, sent-status blocks) get `:focus { outline: none }`. Never remove a ring without a replacement.
- **Hit targets:** every link and button at least 44 x 44 px (`min-block-size: 44px` with `inline-flex` centring, or a centred 44 x 44 `::before` on small visuals). At least 8 px between targets. Inline links inside prose are exempt (WCAG 2.5.8 inline exception) but keep their underline.
- **Text size:** nothing under 12 px; 12 px only for `.lp-micro` and the SAMPLE chip. Text at 14 px or smaller sits only on `.glass-panel` / `.lp-card` (strong glass), Paper or Bone, never directly on the haze or on `.glass-soft` (except Ink/Charcoal 14/500 in pills, which DESIGN.md allows).

### 2.3 Contrast pairs (WCAG 2.2, worst case over Ridge `#9c8793`)

| Surface | Use for text | Ratios |
|---|---|---|
| Haze or Linen, no surface | Ink, Graphite, Charcoal, 15 px and up only | Ink 17.8, Graphite 9.1 (Linen) and 7+ (haze), Charcoal 14.3 |
| `.glass-panel`, `.lp-card` (strong glass) | Any text 12 px up | Ink 15.3, Graphite 7.8, Deep Ash 5.7, `--bad` 5.9 (computed: `#a3261c` on `#e9e5e7`) |
| `.glass-soft` (light glass) | Ink or Charcoal 14/500 up; Graphite 16 up; no Deep Ash | Ink 13.1, Charcoal 10.5, Graphite 6.7 |
| Bone inside glass | Ink, Graphite, Deep Ash | 16.2, 8.2, 6.0 |
| Mist input | Ink value, Deep Ash placeholder | placeholder 6.1 |
| Espresso button | `--on-action` white | 19.0 |
| Inverse button (dark band only) | Espresso on Paper, Bone on hover | 19.0, 16.0 |
| Dark band base and mesh | `--on-dark`; `--on-dark-muted` never on dark glass | 17.8, 10.8 |
| Dark glass (dark band only) | `--on-dark` only | 7.2 |

Non-text: input border Graphite 9.1:1; Stone (`--rule`) only for decorative hairlines, dashed paths and ghost borders on Paper/Linen.

### 2.4 Surfaces and glass budget

- Glass everywhere is the owner rule (DESIGN.md 2026-10-23): `.site-backdrop` haze sits behind every route, so `.glass-panel` on the haze is sanctioned. Use `.glass-panel` for any surface carrying 16 px text or smaller; `.glass-soft` only for pills and large type.
- **Never set `background`, `border` or `box-shadow` on a `.glass-panel` / `.glass-soft` element** (it breaks the no-blur, reduced-transparency, forced-colors and print fallbacks built into the class). Add radius and padding only.
- One blurred layer per surface: anything inside a glass surface is transparent, Bone or Paper. No glass on glass, no `backdrop-filter` on a dialog backdrop, no `backdrop-filter` element under a transform.
- At most 8 glass surfaces in view (6 is the target). One Espresso fill per section; Espresso only on buttons.

### 2.5 Z-index layers

| Layer | Value | Source |
|---|---|---|
| Page content, local stacks | auto, or 0 to 4 inside an `isolation: isolate` parent | existing sections |
| Top banner | auto (in flow, scrolls away, never fixed or sticky) | new |
| Blog reading-progress hairline | 39 | new (directly under the nav) |
| Navbar | 40 | `navbar.tsx` `z-40`, sticky |
| Newsletter popup backdrop and card | 50 | same as `components/ui/dialog.tsx` |
| Skip links | 60 | `--lp-z-skip` |
| Nav menu sheet | browser top layer | native `<dialog id="site-sheet">` |
| Toasts | not used on marketing surfaces (errors are inline) | sonner is app-only |

### 2.6 Motion and reduced motion

- Tokens only (no literal durations or curves in new CSS): `--ease-out` arrivals, `--ease-in` exits, `--dur-fade` 200, `--dur-lift` 200, `--dur-toggle` 280, `--dur-colour` 300 (never zeroed), `--dur-sign` 500, `--dur-rise` 600, `--stagger` 70, `--dist-rise` 12, `--dist-reveal` 16. All live in `motion.css` on `.lp` and drop to 0.01 ms under `html[data-motion="reduced"]` and under `prefers-reduced-motion` unless the visitor chose Full.
- Reuse before writing: `.lp-reveal` (scroll-driven rise), `.lp-enter`, `Reveal` + `.lp-post` (one-shot, time-based), `lp-sign` keyframes (left-to-right write), `.lp-lift`, `.lp-drift`, `.lp-pin`. No new keyframes are needed for anything in this file.
- Hidden start states exist only under `html[data-motion="full"]` or `[data-post="pending"]`, so scripts-off and reduced motion show the final frame. Anything scroll-driven that is not covered by the token swap must be listed in both reduced blocks (`html[data-motion="reduced"]` and the media-query backstop).
- Ink lines that carry meaning write **time-based once** (Reveal, `amount` 0.4), never scrubbed, so a paused scroll never shows a half-written line. The only scrubbed line is the blog reading-progress hairline, which is an indicator.
- Transform, opacity and clip-path only. One sanctioned exception: the top-banner collapse (3.1).

### 2.7 Implementation rules that affect the look

- One CSS file per component, `@layer components`, every selector under `.lp`, class prefix as listed per surface. Do not edit `globals.css`, `landing.css`, `motion.css` or `components/ui/*`.
- **Portals leave `.lp`.** Base UI mounts dialogs in `<body>`, outside LandingShell, where `--t-*`, `--dur-*`, `.lp-btn` transitions and `.lp :focus-visible` do not resolve. The popup must render `DialogPortal` with `className="lp"` (Base UI's portal renders a `div` and takes `className`). Do not use `DialogContent` (its portal is outside `.lp`, and it brings `zoom-in-95` and a blurred black overlay).
- Hover styles only under `@media (hover: hover) and (pointer: fine)`. Press feedback comes free from the shared rule in `globals.css` for every `button` and `.lp-btn`; do not restate it.
- Server components by default; client islands only for: banner dismiss, newsletter form, popup, the about sign-off `Reveal`, the 404 pause control.

### 2.8 Inner-page pattern: the resting card

On pages whose first content block is a card (blog index, contact), that block pulls up into the bottom of the PageHero painting band by `--rest` (48 / 72 / 88 / 96 px) so its frost blurs real paint instead of flat haze: `margin-block-start: calc(-1 * var(--rest)); position: relative; padding-block-start: 0` on the section. The overlap stays inside the band's own bottom fade (the band mask runs 78 to 100 percent). Tune `object-position` of the painting so the zone under the card is calm and low in detail (DESIGN.md calm-zone rule); check by screenshot at 390 and 1440.

---

## 3. Components (FE-components)

### 3.1 Top banner · `TopBanner` · prefix `tb-`

- **Where:** LandingShell, after the skip links, before `<Navbar>`. Every marketing route; never on the 404, auth or app (they have no LandingShell).
- **Layout (same at 390 / 768 / 1440):** `aside.tb` labelled from copy. Outer `display: grid; grid-template-rows: 1fr`; inner `.tb-in` with `min-block-size: 0; overflow: clip`; fixed `block-size: 48px`, `padding-inline: var(--gutter)`, content centred on the page axis. No fill: the haze shows through. Pill max width: 100 percent at 390, 640 px at 768, 720 px at 1440.
- **Classes:** pill = `.lp-pill.glass-soft.tb-pill` (light glass, exactly like the PageHero fact pill), `min-block-size: 36px; padding-inline: 14px 4px; gap: 8px`. Children in order: `.lp-dot` (only when the copy states something live; the current "On the blog" copy gets none), one link `a.tb-link`, close `button.tb-x`. The link wraps everything the visitor reads: `span.tb-text` (`banner.text`), `span.tb-label` (`banner.link.label`), Phosphor `ArrowRight` 16 px `weight="light"`; `min-inline-size: 0`, and `.tb-text` carries `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` as a safety net.
  - Below 768: `.tb-label` is hidden; `.tb-text` is underlined (1 px, 3 px offset) and the arrow follows it.
  - 768 and up: `.tb-text` is plain Ink, 8 px gap, then `.tb-label` underlined, then the arrow.
  - The link's accessible name is text plus label at every width, so it never reads as a bare "Read the post".
- **Close:** 28 px visual disc, transparent, Phosphor `X` 16 px light in `--icon`, centred 44 x 44 `::before` hit area, `aria-label` from copy, `data-requires-js` (hidden with scripts off).
- **Type:** pill text and link Urbanist 500 14 px Ink (13.1:1 on light glass).
- **No layout shift:** the server always renders the band. A tiny inline `<script>` placed directly after the band (a static string built at build time with `JSON.stringify(id)`, the same pattern as `MOTION_HEAD_SCRIPT`) runs before first paint: `try{if(localStorage.getItem("kairos.banner."+ID))document.documentElement.setAttribute("data-tb-off","")}catch(e){}`. CSS: `html[data-tb-off] .tb { display: none }`. `<html>` already carries `suppressHydrationWarning`. Never render the banner client-only.
- **States:** rest; link hover (fine pointer) and focus-visible: arrow travels 4 px, underline stays (the InlineCta treatment, 3.5); close hover: `background: var(--sunk)` on the disc; focus-visible: ink ring on link and close; active: shared press; scripts off: no close button; dismissed: gone on this and every later page view for that id.
- **Motion:** dismiss is the one sanctioned layout animation here (user-caused, once, 48 px, CLS-exempt): pill `opacity: 0` and the band `grid-template-rows: 0fr`, both over `--dur-toggle` `--ease-out`; then set `data-tb-off`. Reduced: instant (tokens zero). After dismiss move focus to the first link in the navbar (`[data-section="navbar"] a`), never to `<body>`.
- **Signature:** the band folds away instead of snapping; the navbar glides up 48 px in the same 280 ms.
- **Print:** `display: none`.
- **Copy budget (MKT):** `text` 40 characters max (fits a 390 pill untruncated), `link.label` 14 max, a true fact, no user counts. The shipped copy (38 + 13) fits.

### 3.2 Breadcrumbs · `Breadcrumbs` · prefix `bc-`

- **Where:** about, blog index, blog post, contact, newsletter, the three legal pages. Not `/`, not the 404. First item is Home (label from copy), last item is the current page.
- **Build:** use `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink` from `components/ui/breadcrumb.tsx`, styled only through `className` and `bc-` CSS. Render the current item as a plain `<span aria-current="page">`, not `BreadcrumbPage` (it adds `role="link" aria-disabled`, which reads as a broken link). Separators are your own `<li role="presentation" aria-hidden="true">`.
- **Layout:** one row, `display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-block-size: 44px; min-inline-size: 0`. Each link `display: inline-flex; align-items: center; min-block-size: 44px`. Current item `min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` (only the current item ever truncates; the h1 below repeats it in full).
  - In a PageHero (about, blog index, contact): centred (`justify-content: center`), above the fact pill; 12 px to the pill at 390, 16 px from 768; 20 / 24 px to the h1 when there is no pill.
  - On the blog post, legal and newsletter pages: start-aligned, 16 px above the title or sheet.
- **Type:** ancestors Urbanist 400 15 px Graphite, underline 1 px at 3 px offset in `currentColor`; current Urbanist 500 15 px Ink, no underline. 15 px, so it may sit directly on the haze (2.2).
- **Separator (signature):** a 16 x 1 px dashed path, `background: repeating-linear-gradient(90deg, var(--rule) 0 3px, transparent 3px 6px)`, `flex: none`, vertically centred. It is the valley's footpath and the ATS route's dashed connector: the trail you walked to get here.
- **States:** hover (fine pointer): ancestor text turns Ink and the underline goes to 2 px over `--dur-colour`; focus-visible: ink ring; current: not focusable. No motion; reduced motion is identical.
- **JSON-LD:** `BreadcrumbList` from the same items, absolute URLs.

### 3.3 CTA, dark · `CtaBand variant="dark"` · prefix `cta-`

- **Where:** at most one per page, only on pages without `Entry10Start` and never on `/` (the landing has its own `DarkCard`). In this set: the blog post only, after the article, before the footer.
- **Layout:** `section.lp-section` (plus `padding-block-end: var(--gap-section)` as the last section) > `.lp-wrap.lp-wrap--narrow` > `.lp-dark-card.lp-drift.cta-dark`. Reuse `.lp-dark-card` for surface, mesh, grain, padding and colours (56/24 at 390, 72/48 at 768, 88/64 at 1024, 96/64 at 1280). Procedural mesh only: no night painting on inner pages (bytes, and it keeps the landing's card unique).
  - 390: one centred column. H2, 16 px, body, 32 px, primary full width, 8 px, secondary link centred.
  - 768 and 1440: centred column, actions in one centred row (primary, then the secondary link, gap 24 px).
- **Type:** heading `h2.lp-serif-h2` (`--t-serif-h2`, `max-inline-size: 11em`): the dark card H2 is one of DESIGN.md's four serif roles, reused as the same element, never a new serif line. Body `.lp-lead` in `--on-dark` (`max-inline-size: 32ch`).
- **Actions:** primary `.lp-btn.lp-btn--inverse.lp-btn--lg` (56 px, the only Inverse button in the set). Secondary (optional) is a text link in `--on-dark`, underlined, 44 px tall; never a second button.
- **States:** primary hover Bone fill (existing), lift and press (shared); focus-visible `--on-dark` ring; secondary hover underline 2 px.
- **Motion:** wrapper `.lp-reveal` (scroll-driven rise); mesh `lp-drift` (the band's one loop; reduced: off, existing). Nothing else.
- **Signature:** inherited from the landing card; adding anything would make it a second, competing dark card.
- **Copy budget:** heading 8 words, body 20 words, one button label of 2 to 3 words.

### 3.4 CTA, quiet · `CtaBand variant="quiet"` · prefix `cta-`

- **Where:** the newsletter status page (confirmed state). Available elsewhere, but never on a page that already ends with `Entry10Start`.
- **Layout:** `section.lp-section` > `.lp-wrap` (`--narrow`, or `--copy` when it follows a copy-width sheet) > `div.cta-quiet`: no surface (sits on the haze), `position: relative`, `border-block-end: 1px solid var(--border)`, `padding-block: 40px` (390), 48 (768), 56 (1024+).
  - 390: single column, start-aligned. Heading, 12 px, body, 24 px, primary full width, 8 px, secondary link.
  - 768 and 1440: `grid-template-columns: minmax(0, 1fr) auto; column-gap: 48px; align-items: end`. Text left; actions right in one row (secondary link, then primary, gap 24 px).
- **Type:** heading `h2.lp-h3`; body `.lp-body` Graphite, `max-inline-size: 46ch`.
- **Actions:** primary `.lp-btn` (52 px, Espresso, the section's one fill); secondary `.lp-link`, 44 px.
- **States:** primary hover `--action-hover`, lift 2 px, press (shared); link hover underline 2 px; focus-visible ink ring.
- **Signature, the signature line:** the band's top edge is a 1 px `--ink` rule (`::before`, full width) that writes left to right once when the band is 40 percent in view: wrap the band in `Reveal`; `[data-post="pending"] .cta-quiet::before { clip-path: inset(0 100% 0 0) }`, `[data-post="live"] .cta-quiet::before { animation: lp-sign var(--dur-sign) var(--ease-out) both }`. Scripts off and reduced: drawn.
- **Copy budget:** heading 8 words, body 20 words.

### 3.5 Inline CTA · `InlineCta` · prefix `cta-`

- **Where:** blog sidebar, newsletter status page, optionally once inside a blog post body as its own paragraph-level block (never mid-sentence).
- **Look:** the landing's "See every step" link (`.enb-more` in `entry-bento.css`); copy its rules into `cta.css` as `.cta-inline`, do not import the bento file. `.lp-link`, Urbanist 500 16 px Ink, `display: inline-flex; align-items: center; gap: 8px; min-block-size: 44px`, Phosphor `ArrowRight` 16 px `weight="light"` from `@phosphor-icons/react/ssr`, `aria-hidden`.
- **States:** hover (fine pointer) and focus-visible: the arrow travels 4 px (`translate: 4px 0`, `--dur-colour`, `--ease-out`), the underline stays 1 px. Reduced: no travel; the underline goes to 2 px instead.
- **Signature:** the arrow travel is the system's one link gesture; the banner reuses it.
- **Copy budget:** 2 to 4 words, a verb first ("Read the notes").

### 3.6 Newsletter form · `NewsletterForm` · prefix `nl-`

**Placement rule:** `card` stands on its own (it is the surface). `inline` and `compact` have no surface and must sit inside a strong-glass parent (sidebar panel, popup, studio card, status sheet), because their label, caption and errors are 14 px.

| Variant | Used on | Surface | Heading |
|---|---|---|---|
| `card` | blog index (`source="blog-index"`, `id="newsletter"` on the card) | `.glass-panel`, `--r-media`, padding 24 (390), 32 (768), 40 (1024), 48 (1280) | own `h2.lp-h3` plus `.lp-body-sm` lead |
| `inline` | about, inside the studio card (`source="about"`) | none; `border-block-start: 1px solid var(--border); padding-block-start: 32px` | own `h3.lp-h4` plus `.lp-body-sm` lead |
| `compact` | blog sidebar (`"blog-post"`), popup (`"popup"`) | none | none (the parent supplies it) |

**Layout.**
- Field block: visible `<label>` Urbanist 500 14 px Ink, 8 px, row (input + button), 12 px, caption `.lp-caption` (Deep Ash 14 px, the true frequency and "unsubscribe in one click"), message line.
- `card`, 390: stacked: heading, 8, lead, 24, field block with input and button stacked (gap 8), both full width. 768: input and button in one row (`grid-template-columns: minmax(0, 1fr) auto; gap: 8px`). 1024 and up: the card is two columns, `minmax(0, 5fr) minmax(0, 7fr)`, column gap 48 (64 at 1280), text left, field block right, `align-items: end`.
- `inline`: stacked below a container width of 480 px, row above it (`container-type: inline-size` on the form). Max width 36rem.
- `compact`: always stacked, input and button full width.
- Controls: input = shared `Input` (Mist, 8 px radius, 1 px Graphite border, 44 px, 16 px Ink text). Button = `.lp-btn.nl-btn` overridden to the 44 px size (`min-block-size: 44px; padding-inline: 20px; font-size: 15px`), so input and button share one height in a row.
- Input attributes: `type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck={false} required maxLength={254}`, id from `useId()` (sidebar and popup can coexist on one page).
- Honeypot `website`: inside `<div aria-hidden="true" class="nl-hp">`, input `tabIndex={-1} autoComplete="off"`; `.nl-hp { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%) }`. Takes no space, never visible.

**States (one live region per form: `p.nl-msg aria-live="polite"` under the row).**

| State | Look | Focus and ARIA |
|---|---|---|
| idle | as above | none |
| invalid (client check or 400) | input border `--bad`; sentence in `--bad` 14 px in `.nl-msg`, saying how to fix it | focus the input; `aria-invalid`, `aria-describedby` the message |
| submitting | button label swaps to the pending label; a 1 px `rgb(255 255 255 / 0.6)` hairline inside the pill's bottom (inset 20 px, 8 px up) grows `scale: 0 1` to `1 1` over `--dur-sign` from the left; `cursor: progress` | form `aria-busy="true"`; button `aria-disabled="true"`, never `disabled` (focus stays on it) |
| sent (202) | see "sent" below | focus the sent block (`tabIndex={-1}`, `:focus { outline: none }`); it has `role="status"` |
| rate-limited (429) | input keeps its value; sentence in `--bad` in `.nl-msg`; button usable again | focus stays on the button |
| network error | same as 429 with its own sentence and "try again" wording | focus stays on the button |
| disabled | not used | |

- **No width jump:** both button labels sit in one grid cell (`.nl-btn-label { display: inline-grid }`, each `span { grid-area: 1 / 1 }`, the inactive one `visibility: hidden`), so the pill is always as wide as the longer label.
- **Sent, without layout shift:** the field block and the sent block share one grid cell (`.nl-stack { display: grid }`, both children `grid-area: 1 / 1`). On sent, the field block gets `visibility: hidden` and `inert`; the sent block shows, vertically centred, so the card keeps its height. Sent block: hollow square + "Check your inbox to confirm" (Urbanist 500 16 px Ink), then the address echoed back as `.lp-caption` ("Sent to {email}", plain text), then a quiet text button "Use a different email" (`.lp-link`, 44 px) that restores the form with the value cleared and focuses the input. It is a hollow square, not lime, because a double opt-in is not finished until the visitor clicks the mail.
- **Hover/focus:** button hover `--action-hover`, lift and press (shared); input focus per 2.2.
- **Motion and signature:** the sent line writes in with `lp-sign` (`html[data-motion="full"] .nl-sent__line { animation: lp-sign var(--dur-sign) var(--ease-out) both }`): the visitor's address is the signature on the page. Reduced: instant. No spinner anywhere.
- **Copy budget:** heading 6 words, lead 16 words, button 1 word plus pending form ("Subscribe" / "Subscribing"), caption 12 words, every error one sentence with the fix.

### 3.7 Newsletter popup · `NewsletterPopup` · prefix `nlp-`

- **When (D3, design-relevant parts):** only `/blog`, `/blog/*`, `/about`; not before 10 s on the page; desktop on exit intent (pointer leaves through the top edge), touch at 60 percent scroll depth; at most once per 30 days (write the timestamp when it opens, so a reload does not reopen it); never if `kairos.newsletter.subscribed` is set; never while the nav sheet is open (`dialog#site-sheet[open]`).
- **Build:** `Dialog` (Base UI) > `DialogPortal className="lp"` > `DialogPrimitive.Backdrop className="nlp-backdrop"` + `DialogPrimitive.Popup className="glass-panel nlp"`; `DialogTitle`, `DialogDescription`, `DialogClose` for the parts.
- **Backdrop:** `position: fixed; inset: 0; z-index: 50; background: color-mix(in srgb, var(--canvas) 40%, transparent)`. No blur on the backdrop (the card's own frost blurs the page; a blurred backdrop would stack glass).
- **Card layout:**
  - 390: docked, `position: fixed; inset-inline: 12px; inset-block-end: calc(12px + env(safe-area-inset-bottom))`, `max-block-size: calc(100svh - 24px); overflow-y: auto`. Art band 96 px. Body padding 20 px top, 24 px sides and bottom.
  - 768: centred without transforms, `position: fixed; inset: 0; margin: auto; block-size: fit-content; inline-size: 440px`. Art band 128 px. Body padding 32.
  - 1440: `inline-size: 480px`, art band 144 px, body padding 32 / 40 / 40.
  - All: `.glass-panel`, `border-radius: var(--r-media)`, `overflow: clip`, `z-index: 50`.
- **Content order:** art band, title `h2.lp-h3`, 8 px, description `.lp-body-sm` Graphite (`max-inline-size: 36ch`), 20 px, `NewsletterForm variant="compact" source="popup"`, 12 px, the decline text button (`popup.decline`; `.lp-link` style on a `button`, Urbanist 500 15 px, 44 px tall, start-aligned).
- **Art band (signature):** `.lp-art.lp-grain` holding `next/image` `fill` of `/landing/art/step-4-replies.png` (the post box at the end of the path, envelopes sorted in two piles), `sizes="(min-width: 1280px) 480px, (min-width: 768px) 440px, 100vw"`, `alt=""`, `object-position` on the post box, `mask-image: linear-gradient(to bottom, #000 55%, transparent)` so the paint dissolves into the frost. Mounted only when the popup opens. The `--art-placeholder` gradient shows until it decodes.
- **Close:** top-right of the art band, 12 px inset: a solid Paper White 36 px disc (`background: var(--surface); box-shadow: var(--edge), var(--sh-over-art)`), Phosphor `X` 18 px light in `--icon`, 44 x 44 `::before` hit area, labelled. Solid paper, never glass (no glass on glass).
- **Focus:** `initialFocus` is the popup element itself (`tabIndex={-1}`), so screen readers hear title and description and no phone keyboard pops; Tab order: close, input, submit, decline. On close, return focus to the element that was focused before it opened. Esc, close, decline and a backdrop click all dismiss.
- **States:** form states per 3.6. After sent, the decline button relabels to `popup.close`; the popup never closes itself; `onSubscribed` writes the subscribed flag.
- **Motion:** enter: card from `opacity: 0; transform: translateY(var(--dist-reveal))` (24 px when docked at 390) to rest over `--dur-toggle` `--ease-out`; backdrop opacity over `--dur-fade`. Exit faster: opacity and `translateY(8px)` over `--dur-fade` `--ease-in`. Use Base UI's `[data-starting-style]` / `[data-ending-style]`. Reduced: tokens zero (the portal carries `.lp`), so it appears and leaves instantly. No zoom, no scale.
- **Copy budget:** title 6 words, description 20 words, a neutral decline (the shipped "No thanks" is fine). No confirmshaming, no counts, no countdowns.

### 3.8 Blog sidebar · `BlogSidebar` · prefix `bs-`

- **Where:** blog post only.
- **Layout:**
  - 390 and 768: after the article sheet in the same `.lp-wrap--copy` column, 24 px below it. The CTA block (3) is hidden below 1024, because the dark band follows directly.
  - 1024: the post becomes a grid in `.lp-wrap--narrow`: `grid-template-columns: minmax(0, 1fr) 280px; column-gap: 32px`.
  - 1280 and up: `minmax(0, 760px) 320px; column-gap: 40px` (exactly 1120).
  - Sticky from 1024 only where it fits: `@media (min-width: 1024px) and (min-height: 820px) { position: sticky; inset-block-start: calc(var(--nav-h) + 24px); align-self: start }`. Shorter viewports: static. Never an inner scroll area.
- **Surface:** `aside.bs.glass-panel` labelled, `border-radius: var(--r-media)`, padding 24. Three blocks separated by `--border` hairlines, 24 px above and below each hairline. Block headings `h2` in Urbanist 500 15 px Ink.
  1. **Recent:** up to 3 posts, excluding the current one. Each row: title Urbanist 500 16 px Ink (two-line clamp) over `.lp-caption` meta (date · minutes, tabular); the whole row is the target through the title link's `::after` (the `.blog-link` pattern); rows at least 44 px, 12 px apart.
  2. **Newsletter:** `NewsletterForm variant="compact" source="blog-post"`; heading and one `.lp-body-sm` line above it.
  3. **CTA:** heading, one 15 px Graphite line, `InlineCta` to `/sign-up`. The sidebar's only Espresso is the newsletter button.
- **Signature, the rail:** the Recent list hangs on a 1 px Charcoal rail 5 px in from the block's start edge, one `.lp-pin` (10 px ink disc, 2 px Linen ring) per post centred on its title's first line: the landing's rail and pin vocabulary, posts as stations. Static.
- **States:** row hover (fine pointer): title underline 1 px at 4 px offset; focus-visible: ink ring on the title link; form states per 3.6.
- **Motion:** none of its own (a moving sticky glass panel would re-blur every frame).

---

## 4. Pages (FE-pages, FE-legal)

Every page below keeps LandingShell (banner, nav, footer) except the 404. New page CSS goes next to the page's components (`components/about/about.css`, `components/contact/contact.css`, `components/blog/blog.css`, `components/legal/legal.css`); `components/marketing/company/company.css` is unowned, so do not edit it. Every page has exactly one h1.

**PageHero needs one slot:** `crumbs?: ReactNode`, rendered first inside `.lp-page-hero__copy`. The file is outside every owner list; see section 7.

### 4.1 About

- **Order and layout:** PageHero (noon meadow, existing FloatingCard) with crumbs → rules (`.co-frame` 1:2, `.glass-panel` rows) → "does not do" (the three `.lp-card` feature cards, one column below 1024, three from 1024) → studio card → `Entry10Start`. Rhythm: centred hero, start-aligned frame, grid, split card, closing band.
- **Studio card:** `.lp-card.co-studio`, two columns from 1024 (existing: text left, facts right 360 px). Add the sign-off (below) under the text column, and the `inline` newsletter as a full-width last row (`grid-column: 1 / -1`), source `about`. At 390 and 768: text, sign-off, facts, newsletter, stacked with 28 px gaps.
- **Signature, the sign-off:** the about page ends like a signed letter. Under the studio text, 32 px down: a 1 px `--ink` rule, 160 px wide at 390 and 200 px from 768, then 12 px, the sign-off name (Urbanist 500 15 px Ink) and a `.lp-caption` role line under it. The rule writes in left to right once via `Reveal` + `lp-sign` (pattern in 3.4). The sign-off names the team or studio, never an invented person.
- **Type:** h1 `.lp-page-h1`; section H2s `.lp-h2`; rows `.lp-h4` + `.lp-body-sm`; studio heading `.lp-h3`.
- **States:** links per 2.2; newsletter per 3.6.
- **Motion:** existing `.lp-reveal` on intros, rows and cards; FloatingCard float and lift (existing); the sign-off write. Reduced: final frames.
- **Popup:** allowed here (D3).

### 4.2 Blog index

- **Order and layout:** PageHero (writing desk, no cards) with crumbs → featured post card (resting card, 2.8) → rows panel → newsletter `card` → `Entry10Start`.
  - Container `.lp-wrap--main` (1280). Featured `.blog-featured.glass-panel`, rows `.blog-rows.glass-panel` (existing), 16 px apart. Newsletter card `var(--gap-intro)` below the rows, same container width.
  - 390: everything one column; rows stack date over title (existing). 768+: rows use the 200 px date column (existing). 1024+: newsletter card goes two-column (3.6).
- **Signature, the resting card:** the featured post rests on the lower edge of the desk painting, overlapping it by `--rest`, so the first glass on the page frosts real paint. `.blog-list` gets `margin-block-start: calc(-1 * var(--rest))` and drops its top padding.
- **Type:** featured title `.lp-h2` (max 20ch), summary `.lp-lead`, meta `.lp-caption` tabular; row titles `.lp-h4`, summaries `.lp-body-sm`.
- **States:** row and featured hover (fine pointer): title underline 1 px at 5 px offset (existing `.blog-link`); the whole row is the target; focus-visible ring on the title link. There is no empty state: posts are static content, and an empty list fails the build review.
- **Motion:** featured card and newsletter card `.lp-reveal`; rows do not animate (long lists stay still).
- **Popup:** allowed.

### 4.3 Blog post

- **Order and layout:** `article.post`: crumbs (Home, Blog, title) replace the "Back to blog" link → sheet (`.post__sheet.glass-panel`, existing) and sidebar (3.8) → dark CtaBand (3.3) → footer.
  - 390: `.lp-wrap--copy`; sheet padding 28/20 (existing); sidebar below, without its CTA block.
  - 768: same column; sheet padding 48 (existing).
  - 1024: grid per 3.8 inside `.lp-wrap--narrow`; sheet padding 40 so the prose keeps about 536 px.
  - 1440: 760 px article column, 320 px sidebar; prose capped at 36rem (existing).
- **Signature, reading progress:** a 2 px `--ink` hairline fixed directly under the nav: `position: fixed; inset-inline: 0; inset-block-start: var(--nav-h); block-size: 2px; z-index: 39; pointer-events: none`, `aria-hidden`. It is a child of `article.post`, never inside the glass sheet (a `backdrop-filter` ancestor would trap `position: fixed`). Driven with no script: `timeline-scope: --post-read` on `.post`, `view-timeline-name: --post-read` on `.prose`, and on the bar `animation: lp-sign linear both; animation-timeline: --post-read; animation-range: contain 0% contain 100%`. Hidden (`display: none`) without `animation-timeline` support, under both reduced-motion selectors, and in print. This is the one scrubbed line in the set.
- **Type:** title `.post__title` (`--t-h2`, 48 at 1024+, existing); prose 17/18 px at 1.6, Graphite, 36rem; prose h2 `--t-h3`, h3 `--t-h4`; links Ink underlined.
- **States:** prose links hover underline 2 px; older/newer nav (existing) title underline on hover; sidebar and form per 3.6 and 3.8.
- **Motion:** the progress hairline; the dark band's reveal and drift. The sheet does not move.
- **Popup:** allowed (it never shows once subscribed from the sidebar).

### 4.4 Contact

- **Order and layout:** PageHero (post box, existing) with crumbs → `.co-contact` (form card + facts aside, existing grid: one column below 1024, `7fr 5fr` from 1024) → footer (`co-section--end`).
- **Signature, the resting card:** the contact section is a resting card (2.8): it pulls up by `--rest` so the form card (and from 1024 the aside) frost the lower edge of the post-box painting. Put the override in `contact.css`.
- **Type:** form title `.lp-h4`; labels 14/500 Ink; facts `dt` `.lp-caption`, `dd` 16 px Ink (existing).
- **States:** existing contact form states (inline errors in `--bad`, 429 sentence, sending label). Sent: keep the lime dot "Message sent" (the message really is sent) and add the write-in: `html[data-motion="full"] .co-sent__title { animation: lp-sign var(--dur-sign) var(--ease-out) both }`.
- **Motion:** card `.lp-reveal`; the sent write-in.
- **No popup, no newsletter, no CTA band** (D3; DESIGN.md: contact ends at the footer).

### 4.5 Newsletter status page · `/newsletter?status=` · prefix `nls-`

- **Layout:** `section.nls` with `padding-block: calc(var(--nav-h) + 40px) var(--gap-section)`, `.lp-wrap--copy`. Crumbs (Home, Newsletter) → sheet `.glass-panel`, `--r-media`, padding 28/20 (390), 48 (768), 56 (1280). Inside: status rail, 32 px, h1, 16 px, `.lp-lead` (measure 560), 32 px, next action. No painting, no PageHero. `robots: noindex`.
- **Type:** h1 with class `.lp-h2`; rail labels Urbanist 500 14 px Ink; captions `.lp-caption`.
- **Signature, the opt-in rail:** two stations in one row at every width: `display: grid; grid-template-columns: auto minmax(32px, 1fr) auto; align-items: center; gap: 12px`. Station = mark + label ("Email sent", "Confirmed", labels from copy). Line between them: 1 px `--icon` solid when confirmed; a dashed Stone path (the breadcrumb dash) when not.

| `status` | Rail | Content | Next action |
|---|---|---|---|
| `confirmed` | dot, solid line, dot | h1 and lead from copy | `InlineCta` to `/blog`; then `CtaBand quiet` below the sheet (`.lp-wrap--copy`, `--gap-intro` above) |
| `invalid` | dot, dashed line, hollow square "Not confirmed" | expired or used link, say what to do | `InlineCta` to `/blog#newsletter` (no form here: the `source` enum has no value for this page) |
| `unsubscribed` | no rail; the status word in `--faint` | plain confirmation, no guilt | `InlineCta` to `/blog` |
| missing or unknown | no rail | neutral "Newsletter" heading and one line | `InlineCta` to `/blog#newsletter` |

- **Motion:** confirmed only: the solid line writes in once on arrival (`html[data-motion="full"] .nls-rail__line { animation: lp-sign var(--dur-sign) var(--ease-out) 200ms both }`): the visitor caused it by clicking the mail. Scripts off and reduced: drawn.
- **No popup** (not on the allowlist), no banner change.

### 4.6 Legal pages (terms, privacy, cookies; refund terms inside each, README D10) · FE-legal · `legal.css`

> **Superseded by README D12 (owner reference, 2026-11-05).** Keep this block for the numeral idea and the states only; the layout, sheet and widths below no longer apply. `web/components/legal/legal.css` is the source.

- **Layout:** existing `LegalDocument`. Crumbs (Home, page title) go at the top of `.legal__head`, start-aligned, 16 px above the title.
  - 390: one column; mobile contents `details.glass-panel`; sheet padding 4/20/8 (existing), raise the inline padding to 24.
  - 768: sheet padding 32 inline.
  - 1024+: grid `200px minmax(0, calc(36rem + 168px))`, column gap 64; the sheet grows by 72 px to hold the numeral column; sheet padding 16 48 20 (existing).
- **Signature, hand-set clause numerals:** each section is numbered with a CSS counter on `.legal__doc` (`counter-reset: clause`), no markup change. Write the content twice so screen readers skip it where supported: `content: counter(clause, decimal-leading-zero); content: counter(clause, decimal-leading-zero) / "";`.
  - Below 1024: the numeral sits on its own line above the h2, Urbanist 500 14 px Deep Ash tabular, 8 px gap.
  - 1024 and up: each section is `display: grid; grid-template-columns: 56px minmax(0, 1fr); column-gap: 16px`; the numeral hangs in column 1 at Urbanist 300 40 px, line-height 1, Deep Ash, tabular, nudged to sit on the h2's cap line; h2 and paragraphs in column 2.
  - The desktop contents list repeats the numbers: a 28 px tabular Deep Ash 14 px column before each link (counter on `.legal__toc-d ol`). The existing current-section ink bar stays.
  - Numerals print (useful in a printed agreement).
- **Type:** title (existing `--t-hero` size, Urbanist 400, never the serif); h2 Urbanist 500 24 px; body 17/18 px at 1.6 Graphite, 36rem; meta `.lp-caption`.
- **States:** contents links hover underline 2 px, active opacity 0.7 (existing); details summary focus ring (existing).
- **Motion:** none beyond the existing CSS-only section marker (opacity only). The page is a still document.
- **No popup, no newsletter, no CTA.**

### 4.7 404 · FE-pages · `not-found.{tsx,css}`

- **Keep the owner's scene as built** (DESIGN.md "Inner pages", owner reference 2026-10-30): full-viewport meadow video with the poster behind it, Geist Mono 600 numerals with the white gradient, the 1 px white rule, the one-line message, the Kairos lockup as the only link. No LandingShell, banner, crumbs or popup. Keep every number in `not-found.css` (logo top 80 / 32 px; numerals 295.751 px, `clamp(140px, 52vw, 200px)` at 640 and below; message 24 px, 16 to 20 px at 640 and below; content width 483 px). 768 uses the desktop values (483 px fits).
- **Add, for WCAG 2.2.2 (required):** a pause/play control, because the video autoplays and loops. Reuse the footer's `.ft__vctl` look (32 px round, `rgb(255 255 255 / 0.55)` fill, 1 px `rgb(12 12 12 / 0.12)` border, Phosphor `Pause` / `Play` 16 px light in Ink, centred 44 x 44 `::before`, `aria-pressed`, label from copy) at `inset-inline-end: 24px; inset-block-end: calc(24px + env(safe-area-inset-bottom))` (16 px at 640 and below). A tiny client island; it renders nothing under reduced motion (the video is already removed there).
- **Add:** `padding-block: 4px` on `.nf__logo` so the only link is at least 44 px tall.
- **Contrast check (required before merge):** measure white against the poster under the message box at 390 and 1440. The message is large text at 24 px (3:1 needed) but normal text at 16 to 20 px (4.5:1 needed). If it fails, add a glyph shadow to `.nf__msg` only, `text-shadow: 0 1px 2px rgb(27 6 36 / 0.35), 0 0 24px rgb(27 6 36 / 0.25)`, and note it for the owner. Never an overlay, tint, blur or card.
- **Signature:** the unbroken scene itself; nothing else is added. Motion: the video only; reduced shows the poster (existing).

---

## 5. Do not

- Add colours, fonts or paintings. Geist Mono stays 404-only; Instrument Serif appears only in the dark band H2 and `Entry10Start`, never in the banner, popup, sidebar, newsletter, legal, blog or about titles.
- Use art hues on UI, or lime as anything but the 8 px ringed dot beside its word. Show a lime dot for a newsletter signup before confirmation (that is the hollow square).
- Fill anything but buttons with Espresso, or put two Espresso buttons in one section. Use the Inverse button outside the dark band.
- Stack glass on glass, blur a dialog backdrop, set `background`/`border`/`box-shadow` on `.glass-panel` elements, or put 14 px text on the haze or on `.glass-soft` (Ink pill text excepted).
- Use `DialogContent` for the popup, render a portal outside `.lp`, or use `BreadcrumbPage` (role=link).
- Make the popup full-screen, darker than Linen at 40 percent, auto-focus its input, show it on pricing, auth, legal, contact, the app or the 404, or show it more than once in 30 days.
- Use springs, overshoot, scale-from-zero, zoom-in modals, shimmer skeletons, spinners or perpetual loops. Animate blur, width, height or position (the banner collapse is the one exception). Scrub a meaning-carrying line with scroll (only the reading-progress bar is scrubbed).
- Write literal durations, curves or hex values in component CSS; use tokens.
- Show toast-only errors, confirmshaming dismiss copy ("No, I like bad applications"), subscriber counts, testimonials, countdowns, "trusted by" lines or invented frequencies.
- Render the banner client-only, or let any surface shift layout on load.
- Use em or en dashes in visible copy, or text under 12 px anywhere.
- Edit `globals.css`, `landing.css`, `motion.css`, `components/ui/*` or `company.css`; ask the coordinator.

---

## 6. Conflicts resolved (DESIGN.md or the owner wins)

| Source says | Resolution |
|---|---|
| Brief: "frosted glass only over art" | DESIGN.md "Glass everywhere" (owner, 2026-10-23) and the shipped `.site-backdrop`: `.glass-panel` on the haze is sanctioned; the 14 px rule (2.2) carries the contrast risk. |
| DESIGN.md: Inter / Inter Tight, 16 px card radius, 20 px blur | Code wins: Urbanist, `--r-card` 20, `--glass-blur` 14/24 at 125 percent. Tokens only. |
| DESIGN.md: dark CTA card "one per page, landing only" | README contract adds `CtaBand dark`. Allowed at most once per page, never with `Entry10Start` and never on `/`; in this set only the blog post. Flagged for the owner (section 7). |
| Brief example: "art haze behind a 404 glass card" | Owner's 404 reference (DESIGN.md, 2026-10-30) says nothing sits between video and copy. Kept; only the WCAG pause control and the hit-area fix are added. |
| awwwards: an idle loop on the concept; taste-design: perpetual micro-interactions | DESIGN.md P1 "every motion ends". Pages are still at rest; life comes from hover, the ink writes and the existing mesh/video loops. Recorded as a decision. |
| taste-design / ui-ux-pro-max: spring physics | Banned (DESIGN.md: no springs, no overshoot). `--ease-out` / `--ease-in` only. |
| taste-design: no centred hero, no three equal cards | DESIGN.md's inner-page hero is centred and the feature-card trio is sanctioned. Kept where they exist; no new trios added. |
| ui-ux-pro-max: modal scrim 40 to 60 percent black | D3: backdrop no heavier than Linen at 40 percent. |
| ui-ux-pro-max / taste-design: shimmer skeletons | Brief: static Bone skeletons, no shimmer. None needed here: no async lists. |
| awwwards: GSAP, Lenis, one ticker | The project's engine is motion/react plus CSS scroll timelines; Lenis runs on `/` only. Nothing here needs JS animation. |
| ui-ux-pro-max `--design-system` generator | Not run: DESIGN.md fixes the system, so generic recommendations would be overridden line by line. |

---

## 7. Open items for the coordinator

1. **PageHero `crumbs` slot.** `components/marketing/page-hero.tsx` is in no owner list. One optional prop rendered first in `.lp-page-hero__copy`. Suggest FE-components.
2. **Newsletter `source` for the status page.** The enum (`popup | blog-index | blog-post | about`) has no value for `/newsletter`, so the invalid state links to `/blog#newsletter` instead of hosting a form. Add `"newsletter-page"` in WP-50 only if the owner wants a form there.
3. **Dark CtaBand on inner pages** conflicts with DESIGN.md "landing only". This file allows it once, on blog posts. Owner to confirm, or the blog post ends with the quiet band instead.
4. **404 pause control** is an accessibility fix (WCAG 2.2.2) the owner's reference lacked; it reuses the footer's control, so it adds no new look.
5. **Caption truth.** The newsletter caption states a sending frequency; MKT and BE must agree on a real one before it ships.
6. **QA at 390 x 844 on `/`:** with the 48 px banner, the hero CTA must stay above the fold. If it does not, report it to the coordinator before changing the hero or the banner.
