# 10. Footer spec (owner-supplied, 2026-10-15)

Owner instruction: "use below prompt for footer just change it icon according to kairos". The spec below is the owner's text, kept verbatim except that the two SVG paths for the Apple logo and the avatar are replaced by descriptions (both are removed in the Kairos version). The Kairos adaptations are listed first; everything not listed there is built literally.

## Kairos adaptations (apply on top of the verbatim spec)

| Spec element | Kairos version | Reason |
| --- | --- | --- |
| Single-file `index.html` | Build into the Next.js footer, `web/components/landing/entries/colophon.tsx` plus its own scoped CSS | Real site |
| "Driftbar" logo, black tile mark | Kairos `Logo` mark and wordmark (current `web/components/shared/logo.tsx` mark; it changes when the owner picks the new mark) | Brand |
| Giant "Driftbar" wordmark | "Kairos", same glass recipe and sizing logic (retune font-size so "Kairos" spans about 1200u) | Brand |
| `brand__title` "The calm bar for macOS" | "Job applications you would sign." | Kairos copy |
| `brand__text` | "Kairos finds jobs that fit, writes only from facts you confirmed, and sends nothing until you approve. Every application comes with a receipt." | Kairos copy |
| CTA Apple logo + "Get Driftbar today" | Kairos mark or a simple arrow icon + "Start with 25 free applications", linking to `/sign-up` | Brand |
| `brand__copy` "© 2026 Driftbar Inc. - Made in Lisbon." | "© 2026 Gray Matter Labs" | Truth (no invented location) |
| "Built with 💙 by Mira Okafor" + avatar | "Built by Gray Matter Labs" (no avatar, no invented person) | Truth |
| Chips "9,400 Macs in sync", "v1.8 · Shipped today", "Rated 4.8 avg" | "25 free applications" with the Kairos status dot (8 px lime `#7fee64` with 1 px ink ring); "Greenhouse · Lever · Ashby" with a path or route line icon; "Nothing sent without approval" with a check or seal line icon | Pre-launch: no invented metrics |
| Columns Menu / Essentials / From our team | Product (How it works, Pricing, Blog) / Company (About, Careers, Contact) / Legal (Terms, Privacy, Cookies, Refunds), real routes from `web/lib/site.ts` | Real links only |
| Body text `#6f6f6c` (4.46:1) and muted `#9c9c98` (2.4:1) on `#f1f1ee` | Kairos Graphite `#444444` for body, Deep Ash `#5e5566` for copyright and secondary text | WCAG 2.2 AA |
| Video and poster hotlinked from CloudFront, `preload="auto"` | Downloaded to `web/public/landing/footer/` (poster converted to AVIF or WebP, about 150 KB); video `preload="none"`, starts when the footer nears the viewport | Performance, no third-party requests |
| Autoplay loop with no control | Paused (poster shown) under `prefers-reduced-motion`, under `html[data-motion="reduced"]`, and by the footer Motion toggle (keep `MotionToggle` in the footer) | WCAG 2.2.2 Pause, Stop, Hide |
| Top edge | Blend from the page canvas `#f7f7f5` into `--paper` over the first 48px so no seam shows against the section above | Seamless page |

---

## Verbatim owner spec

Build a single-file `index.html` (inline CSS, no frameworks, no build step) that recreates the **Driftbar** footer **exactly** as specified. It is one full-viewport footer:
- a pale paper top holding a brand block and three link columns
- a looping video of a blue-hour meadow (lavender mist, fireflies, first stars) filling the lower half and fading into the paper
- a giant frosted-glass "Driftbar" wordmark sinking into lavender fog at the bottom

Follow every value literally.

### 1. Media (use these exact URLs)

```html
<div class="footer__stage" aria-hidden="true">
  <video class="footer__video"
    src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/4d01c727-d9c5-47c8-a778-35a451ffd39f.mp4"
    poster="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261014_121838_c97d0940-f430-4304-8573-4f47ee44f447.png"
    autoplay muted loop playsinline preload="auto"></video>
</div>
```

The video is 1920×1080 and loops seamlessly. It shows rolling grassy hills at blue hour: a grassy slope in the left foreground, misty hills receding to the right, a pink-violet horizon, a periwinkle sky with a few stars, and warm fireflies over the grass.

### 2. Font

**Inter** (variable, optical size 14–32, weight 400–700) for everything. Stack: `"Inter", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`, with antialiased font smoothing. (In the Next.js build, load it through `next/font`, not a Google Fonts link.)

### 3. Tokens and unit system

```css
:root {
  --paper: #f1f1ee;
  --ink: #0c0c0c;
  --body: #6f6f6c;
  --muted: #9c9c98;
  --wordmark: #efefeb;
  --mist: #e2e3f1; /* pale lavender the blue-hour meadow fades into */
}
```

The footer is drawn on a **1440 × 672 canvas**. Every desktop size below is `calc(N * var(--u))`, written as `N u`:

```css
.footer {
  --u: min(100vw / 1440, 100vh / 672);
  --u: min(100vw / 1440, 100svh / 672);
  position: relative; height: 100vh; height: 100svh;
  background: var(--paper); overflow: hidden; isolation: isolate;
}
```

### 4. Structure (exact DOM order)

```
footer.footer
  div.footer__stage[aria-hidden] > video.footer__video
  p.footer__wordmark[aria-hidden]   "Driftbar"
  div.footer__fog[aria-hidden]
  div.footer__content
    div.brand
      a.brand__logo[href="#"][aria-label="Driftbar home"] > span.brand__mark + "Driftbar"
      h2.brand__title    "The calm bar for macOS"
      p.brand__text      "Driftbar gathers music, tasks, meetings, weather, search, focus timers, quick notes, and more handy widgets into one calm floating bar just above your Mac Dock."
      a.brand__cta[href="#"] > Apple-logo svg + "Get Driftbar today"
      p.brand__copy      "© 2026 Driftbar Inc. - Made in Lisbon."
      p.brand__by        "Built with " span.brand__heart[aria-label="love"] "💙" " by " span.brand__author > (span.brand__avatar[aria-hidden] > svg) "Mira Okafor"
      ul.brand__status   (chips, below)
    nav.col.col--menu[aria-label="Menu"]          h3.col__title "Menu"          ul.col__list: Tour, Showcase, Q&A, Licence, Journal
    nav.col[aria-label="Essentials"]              h3.col__title "Essentials"    ul.col__list: Support, Up next, Privacy notice, Usage guidelines, Manage licences
    nav.col[aria-label="From our team"]           h3.col__title "From our team" ul.col__list: Clipnest.io, Tallyo.io, Pinwell.io, Glyfo.co, Shelfmark.app, Wireloom.com, Gridcraft.app
```

Every link is `<li><a href="#">…</a></li>`.

**Status chips (original):**
```html
<ul class="brand__status" aria-label="Driftbar status">
<li class="chip"><span class="chip__dot" aria-hidden="true"></span>9,400 Macs in sync</li>
<li class="chip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>v1.8 · Shipped today</li>
<li class="chip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8Z" /></svg>Rated 4.8 avg</li>
</ul>
```

### 5. Desktop styles

**Stage and video**
- `.footer__stage`: absolute, `inset:0`, z-index 0.
- `.footer__video`: block, 100% × 100%, `object-fit:cover; object-position:50% 100%; transform:translateY(9%)`.
- `.footer__stage::after` (haze so the copy stays readable): absolute, `inset:0`, `linear-gradient(to bottom, var(--paper) 0%, rgb(241 241 238 / .96) 26%, rgb(241 241 238 / .72) 44%, rgb(241 241 238 / 0) 70%)`.

**Wordmark, frosted glass**
- Position: absolute, `left:50%; bottom:-2u; transform:translateX(-50%)`, z-index 1, margin 0.
- Type: `font-size:390u` (makes "Driftbar" span about 1200u), weight 600, `line-height:.74`, `letter-spacing:-0.045em`, no wrap, `pointer-events:none; user-select:none`.
- Glass fill, clipped to the letters:
  ```css
  color: rgb(232 234 250 / .4);
  background: linear-gradient(to bottom, rgb(255 255 255 / .78), rgb(214 218 246 / .36) 48%, rgb(255 255 255 / .62));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 -1u 0 rgb(255 255 255 / .55)) drop-shadow(0 0 18u rgb(190 200 255 / .45));
  ```
  Do **not** use `-webkit-text-stroke`: the letters overlap slightly and a stroke would draw lines through the overlaps.

**Fog**
- `.footer__fog`: absolute at the bottom (`inset:auto 0 0`), z-index 2, `height:17%`, no pointer events.
- Background: `linear-gradient(to top, var(--mist) 0%, rgb(226 227 241 / .6) 30%, rgb(226 227 241 / 0) 100%)`.

**Content grid**
- `.footer__content`: relative, z-index 3. Grid columns `440u 240u 240u 1fr`, `align-items:start`. Width `1440u`, `margin:0 auto`, padding `86u 100u 0 160u`.

**Brand block**
- `.brand__logo`: inline-flex, centred, gap `10u`, `17u`, weight 500, letter-spacing −0.02em.
- `.brand__mark`: a `30u` square with radius `8u`; background `linear-gradient(to bottom, #2b2b2b, #0a0a0a 55%)`, shadow `0 1u 2u rgb(0 0 0 / .25)`; `::after` white pill: left and right 13%, bottom 14%, height 19%, radius 999px.
- `.brand__title`: margin-top `19u`, `20u`, weight 600, line-height 1.2, −0.045em.
- `.brand__text`: max-width `412u`, margin-top `18u`, `--body` colour, `13.7u`, line-height 1.43, −0.012em.
- `.brand__cta`: inline-flex, gap `6u`, height `32.5u`, margin-top `20u`, padding `0 16u 0 15u`, radius `7u`, black, white text; `11.8u`, weight 500, −0.01em; icon svg `13u` with margin-top `−1.5u`; hover background `#262626` and `translateY(-1px)` (.2s).
- `.brand__copy`: margin-top `23u`, `--muted`, `12.2u`, letter-spacing .01em.
- `.brand__by`: flex, centred, gap `5u`, margin-top `21u`, `11.8u`, weight 500, −0.01em. `.brand__heart` .95em. `.brand__author` inline-flex, gap `6u`, margin-left `5u`. `.brand__avatar` `23u` circle on `#e3e3e0`.
- `.brand__status`: flex, wrap, gap `8u`, margin-top `16u`.
- `.chip`: inline-flex, gap `6u`, height `25u`, padding `0 10u`, `1px solid rgb(12 12 12 / .12)`, radius 999px, `rgb(255 255 255 / .55)` background; `10.8u`, weight 500, −0.01em, no wrap; chip svg `11u`, no fill, `stroke:currentColor`, stroke-width 2, round caps and joins; `.chip__dot` a `6u` circle in `#2fb36a` with ring `0 0 0 2.5u rgb(47 179 106 / .18)`.

**Link columns**
- `.col__title`: `16u`, weight 600, line-height 1, −0.045em.
- `.col__list`: grid, gap `20.5u`, margin-top `24u`, `13.7u`, line-height 1.24, letter-spacing .022em, colour `#161616`.
- The Menu column's list: gap `15u`, margin-top `21u`, weight 500, −0.025em, `--ink`.
- Links fade to opacity .55 on hover (.2s).

### 6. Tablet (768–1023px)

- `--u: min(100vw / 1040, 100svh / 672)`.
- Columns `400u 190u 210u 1fr`, width `1040u`, padding `64u 40u 0`.
- Brand text max-width `350u`.
- Wordmark `286u`, bottom `10u`.

### 7. Mobile (≤767px)

- Footer: `--u:1px`; flex column, `height:auto; min-height:100svh`.
- Haze: `linear-gradient(to bottom, var(--paper) 0%, rgb(241 241 238 / .95) 50%, rgb(241 241 238 / .8) 68%, rgb(241 241 238 / 0) 90%)` (runs further down because the blue-hour hills are darker).
- Content: grid columns `auto auto auto`, `justify-content:space-between`; gaps column 12px, row 36px; width 100%, padding `40px 20px 0`, margin-bottom `max(34vw, 150px)`; `.brand` spans all columns.
- Brand block: title 21px; text max-width 34em, 14px; CTA height 38px, padding `0 18px 0 16px`, radius 8px, 13px, svg 14px; copy and credit line 12.5px; chips height 28px, 12px.
- Columns: titles 15px; all lists gap 14px, margin-top 20px, 13px, letter-spacing 0, no wrap.
- Wordmark `bottom:5vw; font-size:27vw`; fog height 7%.
- Below 360px: columns become `1fr 1fr`.

### 8. Motion

The only motion is the looping video and the hover transitions. Under `prefers-reduced-motion: reduce`, turn off the CTA and link transitions.

### 9. Acceptance check (original, read with the Kairos adaptations)

At 1440×900: top left the logo tile and name; the brand block with title, three-line grey paragraph and the black CTA; below them the copyright, the credit line and three chips; columns starting at x≈600, 840 and 1080; lower half the blue-hour meadow with fireflies fading into the paper; a giant frosted-glass wordmark spanning roughly x 140–1320, sinking into lavender fog at the bottom edge.
