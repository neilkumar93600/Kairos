# Section 01: Navbar (`navbar`, utility, 0vh)

Scope: the landing `<header>` rendered by `LandingShell` on route `/`. It is the landing variant of the shared `Navbar`. Everything here sits inside the `.lp` scope class. Other routes keep the default variant.

Source documents: 01-creative-direction.md (CD), 02-design-system.md (DS), 03-motion-system.md (MS), 04-webgl-scene.md, 05-architecture.md (AR), 06-copy-deck.md (CP). Names such as `--lp-navbar-h` and `ho-lime` are defined there and restated here so this file can be built on its own.

---

## 1. Purpose and narrative beat

The navbar is the header of the ledger: always present, quietly keeping count. It does three jobs.

1. Orientation: the logo, the four site links and Log in. At 1024 to 1279px it also prints the current entry as `05 / 10`.
2. An always-reachable sign-up: "Start free" is in the bar at every width.
3. The signature, lime custody. The page may show one lime fill per viewport. When no in-page action (Approve, hero CTA, Choose Pro, closing CTA) is visible, the navbar "Start free" owns the lime. When one of them scrolls into view, lime leaves the navbar (150ms), then arrives on the in-page button (150ms after a 150ms wait). The visitor never sees two green things, not even mid-transition.

The navbar never hides on scroll, never reacts to scroll direction, never fades in. It is readable at frame 0 and there is no preloader. The only motion it owns is the colour hand-over, the caption swap and the menu sheet.

Chronos and kairos note: the navbar carries no clock. It carries the count (`05 / 10`) and the right to act (the lime button), which is the page's quiet version of "the right moment".

---

## 2. Content

Copy is verbatim from 06-copy-deck.md section 3 (`navbar.*`) and the skip links. No changes to wording are needed.

| Key | Element | Final copy | Notes |
| --- | --- | --- | --- |
| `skip.main` | First skip link, first focusable element on the page | Skip to main content | Target `#main`. Rendered inside `<header>` before the logo |
| `skip.pricing` | Second skip link | Skip to pricing | Target `#entry-07-billing` |
| `navbar.logoAria` | `aria-label` on the logo link | Kairos, home | Link to `/` |
| `navbar.wordmark` | Visible text beside the mark | Kairos | From `siteConfig.name` |
| `navbar.links` | Nav links, this order | How it works · Pricing · Blog · About | From `siteConfig.publicNav`; render the array, never hard-code labels |
| `navbar.login` | Ghost button | Log in | Links to `/login` |
| `navbar.startFree` | Button | Start free | Links to `/sign-up`. `data-lime-candidate="navbar"` |
| `navbar.entryCaption` | Caption, 1024 to 1279px only, `aria-hidden="true"` | `{NN} / 10` | `NN` zero-padded, from `html[data-active-entry]`. Server value `00 / 10` |
| `navbar.menuButton` | Menu button name below 1024px | Menu | `aria-expanded` mirrors the sheet |
| `navbar.menuButtonClose` | Same control while the sheet is open | Close menu | |
| `navbar.sheetTitle` | `<dialog aria-label>` | Site menu | |
| `navbar.sheetStartFree` | Sheet button | Start free | `data-lime-candidate="navbar-sheet"` |

The compact Motion control (`MotionToggle variant="compact"`) is supplied by `LandingShell` through the `sheetExtra` slot. Its label comes from the copy deck footer/motion keys and is not redefined here.

Flags for the copy-deck owner (no wording change, structural only):

- F1. The deck lists the caption as one string `{NN} / 10`. The spaces around the slash are ordinary spaces, and the whole string is inside one element so that wrapping can never split it (`white-space: nowrap`).
- F2. The deck's sheet has no visible heading. This spec adds none: the dialog is named by `aria-label`. If a visible heading is later wanted it must reuse `navbar.sheetTitle`.

---

## 3. Layout structure

### 3.1 Bar geometry (all widths)

| Property | Value | Token or source |
| --- | --- | --- |
| Element | `<header data-section="navbar">`, `position: sticky; top: 0` | AR section 1 |
| Height | 64px, border-box including the 1px bottom border | `--lp-navbar-h` |
| Z-index | 40 | `--lp-z-navbar` |
| Inner container | max-width 1280px, centred, horizontal padding = grid margin (16px under 640, 24px at 640 to 1023, 32px at 1024 and up). Content width 1216px at 1280 and up | `--lp-container`, `--lp-margin` |
| Alignment | `display: flex; align-items: center; height: 100%` | |
| Hit targets | 44px minimum height, 8px minimum gap between neighbouring targets | `--lp-hit`, `--lp-hit-gap` (A16) |

The bar is not a CSS grid. A flex row with `margin-inline-start: auto` on the actions group is enough, and the link group is centred by a symmetric flex layout (see 3.2). The 12-column grid is used only to state where things land relative to the page columns.

### 3.2 Breakpoint table

| Width | Visible in bar, left to right | Menu button | Caption | Rail |
| --- | --- | --- | --- | --- |
| 1280 and up (1440 reference) | Logo + wordmark · links (4) · Log in · Start free | no | no (the rail at the right gutter shows position) | yes |
| 1024 to 1279 (1024 reference) | Logo + wordmark · links (4) · caption · Log in · Start free | no | yes | no |
| 640 to 1023 (768 reference) | Logo + wordmark · Start free · menu button | yes, 44 by 44 | no | no (tape from entry 02) |
| 360 to 639 | Logo + wordmark · Start free · menu button | yes, 44 by 44 | no | no (tape from entry 02) |

Below 1024px the link group and Log in move into the sheet. "Start free" stays in the bar because the sign-up must always be reachable.

### 3.3 Placement and sizes

Desktop, 1440 wide (content 1216, left edge x=112 inside the 1280 container, which starts at x=80):

| Element | Position | Size and spacing |
| --- | --- | --- |
| Logo link | flush left of the content box | Mark 24 by 24 (square, radius 0), 8px gap, wordmark text. Link hit area 44px high, padding-inline 0 on the left so the mark aligns to the page margin |
| Links group | centred in the bar via `margin-inline: auto` between logo and actions | `gap: 8px` between links; each link `min-height: 44px; padding-inline: 12px` (visual spacing 24px between words) |
| Entry caption | between links and actions, only 1024 to 1279 | `margin-inline: 16px 8px`; text only, not interactive |
| Actions group | flush right | Log in (ghost) 44px high, padding-inline 16px; 8px gap; Start free 44px high, padding-inline 20px |

At 1280 the links group does not need to shrink: logo about 100px, links about 330px, actions about 230px, total under 700 of 1216. At 1024 (content 960px) the same plus the caption (about 56px) totals under 800. No truncation, no wrapping, `white-space: nowrap` on every item.

Tablet 768 and mobile 360 to 639 (content width 720 at 768 minus margins, 328 at 360):

| Element | Position | Size and spacing |
| --- | --- | --- |
| Logo link | left | Mark 24, gap 8, wordmark. At 360 the whole link is about 92px wide |
| Start free | `margin-inline-start: auto` | 44px high, padding-inline 16px (about 108px wide at 360), label 14px |
| Menu button | right of Start free, 8px gap | 44 by 44, icon 20px, square hit target, right edge on the margin |

Width check at 360: 92 + 8 + 108 + 8 + 44 = 260 of 328. 68px of slack, so the layout holds down to a 320px viewport (260 of 288) without wrapping.

### 3.4 ASCII wireframes

Desktop 1440 (bar is 64px high; `●` marks the one lime fill owner when the navbar has custody):

```
|<-------------------------------- 1440 ------------------------------------>|
|  x=112                                                          x=1328    |
+----------------------------------------------------------------------------+
| [K] Kairos      How it works  Pricing  Blog  About       Log in  (Start free)|  64px, Carbon Veil 85%, blur 10
+----------------------------------------------------------------------------+  1px Phosphor Blue-Black
  logo 24+8       links, Moss 80, 14px/500, 44px targets   ghost   pill 44px high
                                                            1024-1279 only: ... About   05 / 10   Log in  (Start free)
```

Mobile 360:

```
+-----------------------------------+
| [K] Kairos          (Start free) [=]|  64px
+-----------------------------------+
  16px margin                  16px margin
  logo 92px    pill ~108px  menu 44x44
```

Sheet open at 360 (dialog fills the viewport; its top row repeats the bar so nothing jumps):

```
+-----------------------------------+
| [K] Kairos                      [x]|  64px, same positions; [x] = Close menu
+-----------------------------------+
| How it works                       |  56px rows, 1px Phosphor Blue-Black between
| Pricing                            |
| Blog                               |
| About                              |
+-----------------------------------+
| Log in                  (outlined) |  full-width, 48px
| (Start free)                       |  full-width, 48px; lime only if the owner is "navbar"
+-----------------------------------+
| Motion: Full / Reduced   (compact) |  from sheetExtra
+-----------------------------------+
```

### 3.5 Offsets the navbar imposes on the page

- `html:has(.lp) { scroll-padding-top: 80px }` (64px bar plus 16px). Below 1024px the tape adds 48px from entry 02, and MS section 5.6 sets 128px there. This spec keeps 80px as the base and repeats the 128px rule for widths under 1024 (flag F3 below).
- The hero "head row" sits 32px below the bar (DS section 7). The navbar is `sticky`, not `fixed`, so it occupies layout height; the hero's `100vh` is `calc(100svh - 64px)` as DS states.

---

## 4. Visual design

### 4.1 Tokens

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Bar fill | `--surface-raised` (Carbon Veil) at 85% | `#212525` / 0.85 | `background: color-mix(in srgb, var(--surface-raised) 85%, transparent)` |
| Blur | none token | `backdrop-filter: blur(10px)` | Tier 2 and 0 only; see 7 and 9 |
| Bottom border | `--divider` (Phosphor Blue-Black) | `#1f2a33`, 1px | The only divider on the landing outside the graticule |
| Shadow | `--shadow-navbar` | brief value | The only box-shadow permitted on the landing |
| Logo mark | `--foreground` (Phosphor White) | `#ddffdc` | `.lp [data-logo-mark] { fill: var(--foreground) }` (A11) |
| Wordmark | Inter Tight 500, 20px, line-height 1, tracking -0.02em, `--foreground` | | Same family as display type; this spec chooses the 20px size because DS has no wordmark role |
| Links, Log in | `.lp-nav`: Inter 500, 14px/1.43, tracking -0.026em, `--lead` (Moss 80 `#aed2a4`) | | Hover and focus text: `--foreground` |
| Caption | `.lp-caption`: Inter 500, 12px/1.33, +0.6px, `--label` (Moss 70 `#9cbf93`), tabular slashed-zero, not uppercase | | |
| Start free | `.lp-btn` with `data-lime-candidate="navbar"` | | Fallback or lime, see 4.2 |
| Focus ring | 2px solid `--foreground`, offset 2px | | `mi-focus`, never transitioned |

Weights are 400 and 500 only. No text shadow, no glow.

### 4.2 The Start free button (custody)

| State | Fill | Border | Text | When |
| --- | --- | --- | --- | --- |
| Fallback (default) | `--surface` Ground Iron `#181818` | 1px `--foreground` | `--foreground` | Any time `html[data-lime-owner]` is not `navbar`, which includes first paint (`hero` in server HTML), no JavaScript, and while the sheet is open (rule L7) |
| Owner | `--accent` `#7fee64` | 1px `--accent` | `--accent-ink` `#000000` | `html[data-lime-owner="navbar"]` and no dialog open |
| Owner hover | `--accent-hover` | `--accent-hover` | `--accent-ink` | |
| Fallback hover | `--surface-raised` | unchanged | unchanged | Never lime on hover |

Shape never changes between states: radius `--r-pill` 9999px, height 44px, same padding, same 1px border. Only colours change, so the hand-over cannot shift layout (A19, DS rule L4). The navbar button is 44px high rather than DS's 48px default `.lp-btn` height, because a 48px button leaves only 8px above and below in a 64px bar and crowds the border. Override with `.lp-nav-actions .lp-btn { min-height: var(--lp-hit); padding-inline: 20px }` (16px under 1024). This is deviation D1; it applies equally to both states.

### 4.3 Which element is this viewport's one lime element

The navbar's Start free is lime only when `data-lime-owner="navbar"`. At scroll 0 the hero CTA owns lime, so the bar shows the fallback. The logo is never lime. No other element in the bar is lime. Lime is never text, an icon, a focus ring or a border on anything other than the owner button.

### 4.4 Motif usage

- M1 graticule: the navbar does not draw a graticule, because the hero head row directly below it carries `00` and the first rule. Adding a second would double the motif.
- M10 lime custody: owned here (the destination of the hand-over).
- The entry caption `05 / 10` echoes M1's number-first reading and uses M8 numerals (tabular, slashed zero).

### 4.5 Contrast (computed in DS section 9.4)

The bar composite is `#1c1f1f` over Void and `#3d4341` over the Mint Frost band.

| Pair | Over Void | Over mint composite | Req | Result |
| --- | --- | --- | --- | --- |
| Phosphor White wordmark | 15.34 | 9.34 | 4.5 | Pass |
| Moss 80 links and Log in | 9.92 | 6.04 | 4.5 | Pass |
| Moss 70 caption | not below 4.95 | 4.95 | 4.5 | Pass |
| Lime button boundary against bar | 11.32 | 6.89 | 3 | Pass |
| Void text on lime | 14.3 | 14.3 | 4.5 | Pass |
| Sage 60 | | 3.99 | | Forbidden in the bar |

No new pairing is introduced. Open item F4: MS section 7 (`mi-nav-link`) still lists Sage 60 as the resting link colour. DS C1 supersedes it. Use Moss 80 and fix MS.

---

## 5. WebGL

State ids: none. The navbar has `data-scene` unset (`webgl: none`).

- Entering and leaving: the navbar has no state of its own. It is present for every scene state, including `slip-hold` and `slip-tear`.
- Layering: DOM over canvas. The canvas is at `--lp-z-canvas` (0), content at `--lp-z-content`, the rail at `--lp-z-rail`, the tape at `--lp-z-tape`, the navbar at `--lp-z-navbar` (40), dialogs at `--lp-z-dialog`, skip links at `--lp-z-skip`. The canvas is `position: fixed` and starts at `top: 64px` (the receipt lane sticky child uses `top: var(--lp-navbar-h)`), so the bar never overlaps the slip's drawn region; the 85% bar still blends with whatever scrolls beneath it.
- Text contrast over the canvas: the bar is not drawn over canvas pixels in the lane except for the tilt margin; where it overlaps any scene content the composite stays between `#1c1f1f` and `#3d4341`, which section 4.5 already covers. The navbar shows no text over the canvas without the Carbon Veil backing.
- Context loss, tier 0, or Reduced: the navbar is unaffected.
- The canvas must not intercept the bar's pointer events: the canvas has `pointer-events: none`, and the bar sits above it in the stacking order.

---

## 6. Animation choreography

### 6.1 (a) Entrance timeline

The navbar has no entrance. It is in the server HTML, fully painted, with `data-lime-owner="hero"` so the button is in fallback style at first paint. Nothing fades, slides or draws on load. The table lists every timed event the navbar has.

| Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Whole bar | none | n/a | n/a | 0 | none | n/a | Load. Painted at frame 0 (no preloader) |
| Start free, old owner side (button is leaving lime) | `background-color`, `border-color`, `color` | lime / `--accent-ink` | fallback colours | 150ms (`--dur-lime-step`) | 0ms | `--ease-utility` | `html[data-lime-owner]` leaves `navbar`. Preset `ho-lime` |
| Start free, incoming owner | same three | fallback | lime | 150ms | 150ms delay | `--ease-utility` | `html[data-lime-owner]` becomes `navbar`. Preset `ho-lime` |
| Entry caption number | text swap | previous `NN` | new `NN` | 0 (instant) | none | n/a | `html[data-active-entry]` changes. MS 3.4: scroll-driven numbers swap instantly |
| Sheet panel open | `opacity`, `transform: translateY` | 0, -6px (`--dist-row`) | 1, 0 | 240ms (`--dur-row`) | none | `--ease-post` | Menu button pressed, `dialog.showModal()` |
| Sheet panel close | `opacity` | 1 | 0 | 120ms (`--dur-swap`) | none | `--ease-utility` | Close, Escape, link, backdrop, resize to 1024 or wider. Script sets `data-closing`, then calls `dialog.close()` after 120ms |
| Sheet lime transfer | same as ho-lime | | | 150ms + 150ms | | `--ease-utility` | Sheet opens or closes while owner is `navbar`: bar button goes to fallback at once (rule L7), sheet button fills lime after 150ms. Reverse on close |
| Menu icon swap (List to X) | none | | | 0 | | | Instant swap, the label changes with it |

Rules: motion on the navbar uses only `opacity`, `transform` and colour properties; no `blur()` is animated; no `will-change` anywhere on the bar. The hand-over is a CSS transition, driven by the attribute on `<html>`. No GSAP runs here, so the navbar works at every width and tier.

### 6.2 (b) Scroll-linked behaviour

- ScrollTrigger: none, no pin, no scrub. The bar is `position: sticky` and never moves.
- Driver: the `LimeCustody` island runs one `IntersectionObserver` over the four in-page candidates (`approve`, `hero`, `pro`, `closing`) and writes `html[data-lime-owner]`. Required options for this section to be correct: `threshold: 0` and `rootMargin: "-64px 0px 0px 0px"` at 1024 and wider; `"-112px 0px 0px 0px"` below 1024 once the tape is shown (64 + 48). Without the negative top margin a candidate that is hidden under the bar would still count as visible and the visitor would see no lime at all. AR section 806 currently states `threshold: 0` only; this is requirement F5.
- Priority when several candidates are visible: `approve` > `hero` > `pro` > `closing`; none visible means `navbar`.
- The caption is driven by the same observer family that sets `html[data-active-entry]` (the rail's observer); the navbar island only reads the attribute.

Progress-to-value mapping (scroll position, 1440 by 900; mobile values noted where they differ):

| Page state | Visible candidate | `data-lime-owner` | Start free (bar) | Caption (1024 to 1279) |
| --- | --- | --- | --- | --- |
| Load, scroll 0 | hero CTA | `hero` | fallback | 00 / 10 |
| Hero CTA scrolled under the bar | none | `navbar` | lime | 00 / 10 until entry 01 reaches the active line, then 01 / 10 |
| Entries 01, 02, 03 | none | `navbar` | lime | 01 to 03 |
| Entry 04, any pixel of "Approve sample draft" visible | approve | `approve` | fallback | 04 / 10 |
| Entry 04 after Approve pressed | approve button becomes Default | `navbar` | lime | 04 / 10 |
| Entry 05 pinned stage | none (ghost Approve and DOM Approve are outlined, never candidates) | `navbar` | lime | 05 / 10 |
| Entries 06 | none | `navbar` | lime | 06 / 10 |
| Entry 07, "Choose Pro" visible | pro | `pro` | fallback | 07 / 10 |
| Entry 07 after Pro leaves | none | `navbar` | lime | 07 to 09 |
| Entry 10, closing "Start free" visible | closing | `closing` | fallback | 10 / 10 |
| Footer | none | `navbar` | lime | 10 / 10 |

Open item F6: CP section 10 says that in entry 05 the navbar is lime "from stage progress 0.56 onward", which implies it is not lime from the end of entry 04 to progress 0.56. The general rule gives the navbar custody as soon as Approve leaves the viewport, which is earlier. Recommendation: keep the general rule (one rule, no special case) and read "0.56" as the latest point. The over-mint composite for a lime border is 6.89:1 (N7), so it passes everywhere. The copy deck line should be edited to say "from the moment no candidate is visible".

Fast scrolling: owner changes apply on the observer callback and CSS retargets in flight. A button that turns lime waits 150ms, so if the owner changes again inside that wait the pending fill never starts. Therefore two lime fills never coexist at any instant. `data-lime-handover` is set on `<html>` for 300ms after each change so the shared transition rules apply (MS section 7).

### 6.3 (c) Micro-interactions

| Element | Preset | Rest | Hover | Press | Focus (`mi-focus`) |
| --- | --- | --- | --- | --- | --- |
| Logo link | `mi-nav-link` (wordmark) | `--foreground` | no change (the logo is already full white) | none | 2px `--foreground` outline, offset 2px, instant |
| Nav link | `mi-nav-link` | `--lead` | `--foreground`, 300ms `--ease-utility`; no underline | colour holds | as above |
| Log in | `mi-ghost` | no border, `--lead` text | `--surface-raised` fill, `--foreground` text, 300ms | colour holds | as above |
| Start free, fallback | `mi-default` | see 4.2 | Carbon `--surface-raised`, 300ms | colour holds | as above |
| Start free, owner | `mi-lime` | lime | `--accent-hover`, 300ms | colour holds | outline is `--foreground`, never lime |
| Menu button | `mi-ghost` (icon) | `--foreground` icon, transparent | `--surface-raised`, 300ms | colour holds | as above |
| Sheet links | `mi-nav-link` | `--foreground` 16px/500 | `--surface-raised` row fill, 300ms | colour holds | as above |

No scale, no translate, no ripple, no custom cursor. Hover feedback begins within one frame. `cursor: pointer` on links and buttons. Press has no layout movement.

The current-page link: the nav links point to other routes, so none carries `aria-current` on `/`. The landing's in-page position is shown by the caption and rail, not by the nav links.

### 6.4 (d) Hand-off to the next section

The next section in DOM order is the ledger rail and tape (`webgl: none`). They share one source of truth, `html[data-active-entry]`, written by the rail's observer. The bar hands the viewer to them in two ways:

- The tape appears below 1024px from entry 02 as a sticky 48px strip directly under the bar's bottom border, so the two read as one 112px header. The tape's first position is `top: var(--lp-navbar-h)`. The bar's border is the only line between them; the tape adds none on top.
- At 1280 and wider the caption is hidden and the fixed rail takes over position display; at 1024 to 1279 the caption stands in for the rail. The two never show together.

The hero below begins 32px under the bar. Lime moves from the hero CTA to the bar via `ho-lime` when the CTA scrolls beneath it, which is the first visible event of the signature.

---

## 7. Reduced-motion, no-JS and low-tier variants

| Condition | Behaviour |
| --- | --- |
| `prefers-reduced-motion: reduce` or `html[data-motion="reduced"]` (the Motion toggle) | `--dur-lime-step`, `--dur-row`, `--dur-swap` resolve to 0.01ms. Lime changes in one frame with no wait, sheet appears and disappears at once, hover colour change (300ms `--dur-colour`) is kept because it is a colour change under the 2.3.3 guidance, per MS. Order is still sequential (old owner off, new owner on in the same frame). No information changes |
| No JavaScript | Server HTML: `data-lime-owner="hero"`, bar button in fallback. Only the hero CTA is lime. The bar has no custody ever (L8). Links and Log in work. Below 1024px the menu button is hidden and replaced by an inline link row that wraps beneath the logo: a `<noscript><style>` rule sets `.lp-nav-menu-btn { display: none }` and `.lp-nav-links { display: flex }` with `flex-wrap: wrap` and the header height becomes `auto` (min 64px). The caption shows `00 / 10` only if the viewport is 1024 to 1279; that static value is acceptable because the caption is `aria-hidden` |
| Tier 1 (`html[data-tier="1"]`) | Navbar uses an opaque Carbon Veil at 96% and `backdrop-filter: none`, per MS section 13. Contrast is unchanged or better |
| Tier 0 | Same as tier 1. Blur may be restored if a frame sampler shows no cost, but the default is opaque |
| `forced-colors: active` | Fallback button has a 1px system border; owner state relies on the border and `Canvas`/`Highlight`, which is acceptable because lime is decorative and the label is the same |
| Dialog unsupported | All supported browsers have `<dialog>`. If `showModal` is missing, the menu button is not rendered and the link row from the no-JS rule shows |
| Slow network | Fonts use `display: swap`. The bar's layout does not depend on font widths (no wrapping, 44px targets), so CLS from swap is 0 |
| Print | Bar is `display: none` in print CSS |

---

## 8. Accessibility

Landmarks and structure:

- `<header>` is the page banner landmark. It contains `<nav aria-label="Main">` for the four links. Below 1024px the same `<nav>` element is inside the dialog; only one copy of the links is in the DOM at a time per breakpoint is not required, but the hidden copy must be `display: none` (not just visually hidden) so screen readers never read it twice.
- No headings in the navbar. The first heading on the page is the hero `h1`.
- The `main` landmark is `<main id="main">`.

Focus order, desktop: skip to main content, skip to pricing, logo link, How it works, Pricing, Blog, About, Log in, Start free, then main content. Mobile: skip links, logo, Start free, Menu button, then main content.

Skip links: visually hidden until focused, then positioned at `top: 8px; left: 8px`, 44px high, Ground Iron fill, 1px `--foreground` border, `--foreground` text, `--lp-z-skip`. They never carry lime.

Sheet (native `<dialog>`):

- Opened with `showModal()`, so the rest of the page is inert, focus is trapped and Escape closes it natively. `aria-label="Site menu"`.
- Menu button: `aria-expanded`, `aria-controls` = dialog id, name "Menu". Inside the dialog the close control uses the name "Close menu" and occupies the exact position of the menu button. Because the modal makes the bar inert, the close control must be inside the dialog.
- On open, focus moves to the close button; on close, focus returns to the menu button (`dialog.close()` plus `menuButton.focus()` on the `close` event).
- Backdrop: `rgba(0,0,0,0.6)`. Clicking the backdrop closes it (compare `event.target === dialog`).
- The dialog carries `data-lenis-prevent` so wheel and touch scroll inside the sheet are native, and `overscroll-behavior: contain`.
- It closes on any link click, and on `matchMedia("(min-width: 1024px)")` becoming true.

Screen-reader text for visuals:

- Logo mark: decorative, `aria-hidden="true"` on the SVG; the link name is `navbar.logoAria`, so the visible wordmark is also hidden from the accessibility tree (`aria-hidden` on the wordmark span) to avoid "Kairos, home Kairos". The visible text still passes WCAG 2.5.3 Label in Name because the accessible name begins with the visible label "Kairos".
- Entry caption: `aria-hidden="true"`. The rail (`<nav aria-label="Page entries">` with `aria-current`) is the accessible source. Do not add `aria-live` to the caption.
- Lime state: colour is never the only signal because the label "Start free" is constant. Owner changes are not announced.
- Menu icons: SVGs are `aria-hidden`; the buttons carry the names above.

Target size (WCAG 2.5.8, and the 44px landing standard): every control is at least 44 by 44px with 8px between neighbours. Focus is never obscured (2.4.11): `scroll-padding-top` of 80px (128px under 1024 with the tape) keeps focused targets clear of the 64px bar.

Contrast: see 4.5. Focus ring 2px Phosphor White against `#1c1f1f` is 15.34:1; over the mint composite `#3d4341` it is 9.34:1. The band does not change the navbar's own focus colour because the bar is outside `[data-surface="mint"]`.

Keyboard: Tab and Shift+Tab only. No roving tabindex, no arrow key handling. Enter and Space activate buttons natively. Space/Page keys on the page are untouched.

---

## 9. Performance notes

- Animates: three colour properties on one button, plus `opacity` and one `transform` on the sheet panel while it opens. Nothing animates during scroll.
- Elements: the bar has at most 14 DOM nodes at 1280 and up (header, container, logo link, SVG, wordmark, nav, 4 links, caption, actions, 2 actions) and the sheet adds about 12 on demand. The sheet content can be rendered always, hidden by the closed dialog (`display: none`), at no paint cost.
- Layers: one compositor layer for the sticky bar with `backdrop-filter` (tier 2). `will-change` is not used. The blur is on a surface 64px high by full width, never animated, which is within the budget in MS section 13 (the "no large blur" rule is about full-screen surfaces).
- JS: `Navbar` is a client component (state for the sheet). The island code is under 1.5 KB gzip beyond the shared Navbar. `EntryCaption` is about 0.4 KB. `LimeCustody` is shared with the page and counted in the 20 KB islands budget. No library loads for the navbar.
- Reflow: the caption is reserved at a fixed width (`min-width: 4.5ch`, tabular numerals) so number swaps never shift neighbours.
- Observers: one `IntersectionObserver` (shared), plus one `matchMedia` for the sheet auto-close. Both disconnect on unmount (AR side-effect table).
- Assets: no images. The logo is the existing inline SVG (about 300 bytes). Icons come from the existing `@phosphor-icons/react` `List` and `X` in their regular weight, tree-shaken (about 0.6 KB each) or replaced by two inline SVGs of 20px if the package is not already in the landing chunk. Fonts are the two shared `next/font` files already preloaded (Inter Tight and Inter at 400/500); the navbar adds no font file.
- Budgets: navbar CSS inside the 25 KB CSS budget, at most 1.2 KB gzip. Zero requests of its own.

---

## 10. Implementation

Files and paths (relative to `web/`):

| File | Type | Change |
| --- | --- | --- |
| `components/layout/navbar.tsx` | Client component, edit | Add `variant?: "default" \| "landing"`, `caption?: ReactNode`, `sheetExtra?: ReactNode`. `default` keeps today's markup, with the DS tokenised colours (first commit, AR P2). `landing` renders the structure in this spec, replaces the inline mobile panel with a `<dialog>`, and breaks at `lg` (1024px), not `md` |
| `components/landing/landing-shell.tsx` | Server | Wraps `<div class="lp">`, renders `<Navbar variant="landing" caption={<EntryCaption />} sheetExtra={<MotionToggle variant="compact" />} />`, `<main id="main">`, the footer |
| `components/landing/islands/entry-caption.tsx` | Client | Reads `html[data-active-entry]` through `useLedger` (`active`). Renders `<span class="lp-caption lp-nav-caption" aria-hidden="true">{NN} / 10</span>`. Hidden by CSS outside 1024 to 1279 so no JS media query is needed |
| `components/landing/islands/lime-custody.tsx` | Client, shared | Observer with the `rootMargin` in 6.2; sets `data-lime-owner` and `data-lime-handover` |
| `components/landing/landing.css` | CSS | `.lp-btn` custody rules (DS section 5.3), `.lp-nav*` classes, `.lp-sheet` dialog, skip links, tokens `--lp-navbar-h`, `--lp-hit`, `--lp-z-*` |
| `components/landing/motion.css` | CSS | `ho-lime`, `mi-*` presets, reduced-motion zeroing |
| `components/shared/logo.tsx` | Reused | `data-logo-mark` on the square; the landing turns it white by CSS only (A11) |
| `components/shared/button.tsx` | Reused | `ButtonLink` gains a `className` pass-through and a `data-lime-candidate` pass-through; on the landing it renders `lp-btn` styles |
| `lib/site.ts` | Reused | `siteConfig.name`, `siteConfig.publicNav` |
| `app/layout.tsx` | Edit | `<html data-lime-owner="hero" suppressHydrationWarning>` plus the head script from MS |

Props of the landing navbar: `variant`, `caption`, `sheetExtra`. State: `open` (boolean) in the component; the dialog is controlled through a ref (`showModal`, `close`) and synchronised with the native `close` event. Do not store `open` in `ledgerStore`.

CSS classes: `lp-nav`, `lp-nav-bar`, `lp-nav-links`, `lp-nav-actions`, `lp-nav-caption`, `lp-nav-menu-btn`, `lp-sheet`, `lp-btn`, `lp-skip`.

Attributes: `data-section="navbar"` on `<header>`; `data-lime-candidate="navbar"` and `"navbar-sheet"`; `data-closing` on the dialog; `data-lenis-prevent` on the dialog.

Presets: `ho-lime`, `mi-nav-link`, `mi-ghost`, `mi-default`, `mi-lime`, `mi-focus`. Tokens: `--lp-navbar-h`, `--lp-hit`, `--lp-hit-gap`, `--lp-margin`, `--lp-z-navbar`, `--lp-z-dialog`, `--lp-z-skip`, `--surface-raised`, `--divider`, `--shadow-navbar`, `--foreground`, `--lead`, `--label`, `--accent`, `--accent-hover`, `--accent-ink`, `--dur-lime-step` (alias `--lp-dur-custody`), `--dur-row`, `--dur-swap`, `--dist-row`, `--ease-utility`, `--ease-post`.

Tailwind notes: use `h-dvh` for the dialog height, never `h-screen`; use `size-6` for the 24px mark and `size-11` (44px) for the menu button. Z-index uses the named tokens only. Do not add `tracking-*` utilities; the tracking is part of `.lp-nav`.

Rules for the implementer:

1. Never gate the hand-over on a JS timer. The two 150ms steps are CSS (`transition-delay` on the incoming owner).
2. The lime selectors are the five written-out rules in DS section 5.3. Do not use `:has()` anywhere except the one open-dialog rule (L7).
3. Do not add scroll listeners, a "hide on scroll down" behaviour or a shrink-on-scroll header.

Deviations and open flags (summary):

| ID | Item | Proposed resolution |
| --- | --- | --- |
| D1 | Navbar button height 44px instead of the 48px `.lp-btn` default | Keep 44; same in both states |
| F3 | `scroll-padding-top` is 80px at 1024+ and 128px below with the tape; the section brief states only 80px | Keep both, as MS 5.6 |
| F4 | MS `mi-nav-link` says Sage 60 | Use Moss 80 per DS C1 and fix MS |
| F5 | AR describes `threshold: 0` only for LimeCustody | Add the negative top `rootMargin` of 64px (112px with the tape) |
| F6 | CP says navbar is lime from stage progress 0.56 | Use the general rule; edit CP and MS wording |

---

## 11. Acceptance criteria

Layout and content

- [ ] The bar is 64px high including its 1px `--divider` bottom border at every width, and stays `position: sticky; top: 0` through the whole page, including the pinned stage.
- [ ] At 1440 and 1280: logo, four links in the order How it works, Pricing, Blog, About, Log in, Start free; no caption, no menu button.
- [ ] At 1279 and 1024: the same plus a caption reading `NN / 10`; no menu button.
- [ ] At 1023, 768, 390 and 360: only logo, Start free and a 44 by 44 Menu button are visible; the links are not in the accessibility tree until the sheet opens.
- [ ] No horizontal scroll and no wrapping at 320, 360, 390, 768, 1024, 1280, 1440 and 1920.
- [ ] Every control is at least 44 by 44px with at least 8px to its neighbour.
- [ ] Copy matches `navbar.*` exactly. No em dash appears.
- [ ] The logo mark is Phosphor White (`#ddffdc`) on the landing and has no lime on the landing at any state.

Lime custody

- [ ] With JavaScript disabled, the first paint shows the hero CTA lime and the navbar button in fallback style.
- [ ] At scroll 0 (1440 by 900 and 390 by 844) the navbar button is fallback; once the hero CTA is fully under the bar, it is lime.
- [ ] With the hero CTA partly behind the bar (visible area zero after the bar offset), the navbar is lime and the hero button is not.
- [ ] Scrolling through the page in 100px steps with 400ms waits, exactly one element has the lime background (`rgb(127, 238, 100)` or `rgb(109, 219, 87)`) at every step, at both viewports. No lime appears in any text, border (except the owner), outline, fill of other elements, shadow, icon or canvas pixel.
- [ ] During a hand-over, sampled every frame, there is no frame where two elements are lime; the outgoing fill ends within 150ms; the incoming fill begins no earlier than 150ms after the change and ends by 300ms.
- [ ] The navbar button's width, height and border-box do not change between fallback and lime (0px difference).
- [ ] Pressing Approve in entry 04 sends lime to the navbar (sequentially), and entry 05 through 06 keep it there.
- [ ] Hover never turns a non-owner lime; the owner hover is `--accent-hover`.
- [ ] Under reduced motion both transitions are 0.01ms and still ordered (old off, new on).
- [ ] With the sheet open at 390 wide, the bar button is fallback and the sheet button is lime iff the owner is `navbar`; there is never more than one lime fill.

Menu sheet

- [ ] The menu button toggles `aria-expanded`; the dialog is opened with `showModal`; Escape, the close button, the backdrop and any link close it.
- [ ] Focus lands on "Close menu" on open and returns to "Menu" on close.
- [ ] Resizing from 1023 to 1024 with the sheet open closes it.
- [ ] Scrolling inside the sheet does not scroll the page (`data-lenis-prevent`, `overscroll-behavior: contain`).
- [ ] The compact Motion toggle appears in the sheet and flips `html[data-motion]`.

Caption

- [ ] The caption shows only between 1024 and 1279, is `aria-hidden`, and updates instantly to the active entry (`05 / 10` while entry 05 is active).
- [ ] The caption does not move any neighbouring element when its digits change.

Accessibility

- [ ] Tab order is skip main, skip pricing, logo, links, Log in, Start free (desktop); skip links, logo, Start free, Menu (mobile).
- [ ] Skip links appear on focus and activate to `#main` and `#entry-07-billing`; the targeted heading is not hidden under the bar.
- [ ] Focus ring is 2px Phosphor White with a 2px offset on every control and is never lime.
- [ ] Contrast checks N1 to N7 pass with the bar over Void and over the Mint Frost band.
- [ ] The accessible name of the logo link is "Kairos, home" with no duplicated word.
- [ ] axe reports zero violations on the header at 1440 and 390 with the sheet closed and open.

Performance and robustness

- [ ] The navbar adds no network request, no font file and no `will-change`.
- [ ] No ScrollTrigger and no scroll listener belongs to the navbar; `ScrollTrigger.getAll()` contains no navbar id.
- [ ] CLS contributed by the header is 0.
- [ ] On `data-tier="1"` the bar has no `backdrop-filter` and is opaque at 96%.
- [ ] After a soft navigation to `/pricing` the default (non-landing) navbar renders with its own lime "Start free", and returning to `/` restores the correct owner without re-running any entrance.
