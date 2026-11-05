# Kairos — Style Reference
> Duna with frosted glass: one painted valley over warm linen, and the few surfaces that float over the painting are neutral frosted glass; the page is a quiet document you would sign, and the painting is its only colour.

**Theme:** light (marketing site and signed-in app; there is no dark theme)

Values come from `docs/superpowers/specs/2026-10-15-kairos-landing-design/09-style-direction.md` (cited as 09), which wins on colour, radius, shadow and type. Placement and component sizes come from `07-reference-system.md` (07) and `08-restructure-plan.md` (08) in the same folder. Primary style: Duna, "Sunset watercolor on warm marble" (Refero, [styles.refero.design/style/8cf4a580-bfb6-4090-a899-f734ffe62370](https://styles.refero.design/style/8cf4a580-bfb6-4090-a899-f734ffe62370), saved as `docs/design-refs/duna.md`). Contrast ratios are computed with the WCAG 2.2 relative-luminance formula. HTML and CSS examples are reconstructions, not source components. Owner amendment 2026-10-15 (V5, V6): Duna stays the primary style and gains a frosted-glass layer for surfaces that sit over art; V6 is the owner-supplied footer (meadow video, glass wordmark, weight 600 in the footer only) (see "Frosted glass layer" below and 09 section 11). The former reference (Modal, dark phosphor) is archived at `docs/design-refs/modal.md`; only its lime status dot survives here.

Kairos reads like a calm editorial document laid on warm linen. The canvas is Linen `#f7f7f5`, cards are Paper White with a 1 px inset ring, and nested panels are Bone. Headings and the logo are Aubergine Ink, paragraphs are Graphite, and the only filled button colour is Espresso. The interface is 99 percent achromatic: one soft painted valley, seen at different hours from dawn to dusk, carries all the colour, and its hues never leak into the UI. Type is Inter Tight 400 for display and headings, Inter 400/500 for UI and body, and Instrument Serif 400 on exactly four lines that share a frame with art. Lime survives from the old phosphor system as one thing only: an 8 px status dot with a 1 px ink ring, always beside its word. Elevation is a hairline ring and a tint shift on Linen; where a surface floats over art it is neutral frosted glass (white at 64 to 78 percent, blurred backdrop, 1 px white edge, inner top highlight) with the one shadow token under it. Glass is never tinted with art hues or lime, and never used on flat Linen sections, where it would read as a grey box. This file governs the whole product, the marketing site and the signed-in app (owner decision 2026-10-15: the app follows the light palette; this supersedes the note in 09 section 2 that Modal stays the app reference).

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Linen | `#f7f7f5` | `--canvas` | Page background on every route, site and app. Every art fade ends in this colour. Never replaced by pure white as the base |
| Paper White | `#ffffff` | `--surface` | Cards, floating cards, plan cards, status pill, app panels, the inverse button on the dark card |
| Bone | `#edece7` | `--sunk` | Nested panels, SAMPLE chip, eyebrow pill, FAQ icon circle, toggle track; in the app the active nav item, hover wash and skeletons |
| Mist | `#eeeeee` | `--field` | Input fields only |
| Aubergine Ink | `#1b0624` | `--ink` | Headings, strong text, logo, links (underlined), featured-card border, focus ring, the lime dot's ring, the one dark card base. 17.8:1 on Linen |
| Espresso | `#160f0c` | `--action` | Primary button fill. Nothing else: not pills, not badges, not surfaces |
| Espresso Hover | `#2b211c` | `--action-hover` | Primary button hover fill only. White label 15.7:1 |
| Graphite | `#444444` | `--body` | Body text, input borders. 9.1:1 on Linen |
| Deep Ash | `#5e5566` | `--faint` (was `--muted` until 2026-10-15; shadcn owns `--muted`) | Captions, indices, SAMPLE chip text, legal row, neutral status words. Duna Warm Ash `#766a7c` darkened, same hue: 6.6:1 on Linen, 6.0:1 on Bone |
| Charcoal | `#292421` | `--icon` | Line icons, nav links, the step connector line. 14.3:1 on Linen |
| Stone | `#898683` | `--rule` | Hairline dividers, connector dashes, ghost-button borders on Linen and Paper only (3.4:1 and 3.6:1). Never text |
| Hairline | Stone at 40 percent | `--border` | Decorative card, table and row hairlines in the app. Never the only edge of a control |
| Ring | `inset 0 0 0 1px rgb(0 0 0 / 0.05)` | `--edge` (was `--ring` until 2026-10-15; shadcn owns `--ring`) | Every card edge. Utility `shadow-edge` |
| Glass | `rgb(255 255 255 / 0.64)` | `--glass` | Light glass, the default fill of surfaces over art. Ink 13.1:1, Graphite 6.7:1 over the darkest art behind a card (Ridge) |
| Glass Strong | `rgb(255 255 255 / 0.78)` | `--glass-strong` | Same blur. Required for text at 14 px or smaller (Graphite or Deep Ash) and for dense rows (receipt, inbox). Ink 15.3, Graphite 7.8, Deep Ash 5.7 over Ridge |
| Glass Edge | `rgb(255 255 255 / 0.60)` | `--glass-edge` | 1 px border of every glass surface |
| Glass Highlight | `inset 0 1px 0 rgb(255 255 255 / 0.70)` | `--glass-hi` | Inner top highlight; 0.85 on hover (`--glass-hi-hover`) |
| Nav Glass | `rgb(247 247 245 / 0.72)` | `--glass-nav` | Nav after scroll only; transparent at the top. Ink 13.6, Charcoal 10.9 over Ridge |
| Dark Glass | `rgb(27 6 36 / 0.42)` | `--glass-dark` | Chips and buttons inside the dark CTA card only. Linen text 7.2:1 over `#827BC8` |
| Dark Glass Edge | `rgb(255 255 255 / 0.14)` | `--glass-dark-edge` | 1 px border of dark glass |
| Glass Fallback | `rgb(255 255 255 / 0.94)` | `--glass-fallback` | Fill when `backdrop-filter` is unsupported. Ink 18.1, Deep Ash 6.7 |
| Lime Pulse | `#7fee64` | `--lime` | 8 px status dot only (passes, approved, live), with a 1 px `--ink` ring (13.0:1 against lime), always beside its word. 1.4:1 on Linen, so it never carries meaning alone |
| On Dark | `#f7f7f5` | `--on-dark` | Text on the dark card. 17.8:1 on `#1b0624` |
| On Dark Muted | `#c9bfcf` | `--on-dark-muted` | Secondary text on the dark card. 10.8:1 |
| Warn Amber | `#8a5a00` | `--warn` | App only: warning words and small badges. 5.5:1 on Linen, 5.9:1 Paper, 5.0:1 Bone |
| Error Red | `#a3261c` | `--bad` | App only: error and failed words, form errors, small badges. 6.9:1 on Linen, 7.4:1 Paper, 6.2:1 Bone |
| Danger Fill | `#a3261c` | `--danger-fill` | App only: the account-deletion button fill, white label 7.4:1 |

**Art tokens: art layers only.** These hexes live inside paintings and inside the `::before` and `::after` layers of art panels, the closing glow, the dark card mesh and the footer video haze. They never colour text, borders, buttons, badges, the connector or the toggle, and they are kept out of the Tailwind theme so no utility class can reach them.

| Name | Value | Token |
|------|-------|-------|
| Dawn sky | `#dce7f2` | `--art-sky` |
| Haze | `#f6dcc8` | `--art-haze` |
| River | `#e8a87c` | `--art-river` |
| Ridge | `#9c8793` | `--art-ridge` |
| Meadow | `#a9b48c` | `--art-meadow` |
| Periwinkle | `#aab6f2` | `--art-periwinkle` |
| Lilac | `#d8c8e8` | `--art-lilac` |
| Rose | `#eba9b4` | `--art-rose` |
| Coral | `#f08a5d` | `--art-coral` |
| Amber | `#f2b866` | `--art-amber` |
| Olive | `#a9a46a` | `--art-olive` |
| Dusk | `#6f74c9` | `--art-dusk` |
| Ember | `#b4553a` | `--art-ember` |
| Mesh mid | `#4a3a5c` | `--art-mesh-mid` |
| Mesh bright | `#6b5a86` | `--art-mesh-bright` |

## Tokens — Typography

### Inter Tight: display and heading face for section H2s, step H3s and prices. Weight 400 everywhere; hierarchy comes from size and tracking, never from weight. Tracking tightens only at display sizes. Duna's GT America `-0.06em` is re-tuned to `-0.045em` because Inter Tight is already narrow and its letters collide at the Duna value. · `--font-display`
- **Substitute:** stands in for GT America (Duna); falls back to Inter, then `ui-sans-serif, system-ui`
- **Weights:** 400, 500 (every step on the scale is 400)
- **Sizes:** 26, 28, 30, 32, 36, 40, 44, 48, 56, 64, 72
- **Line height:** 1.0, 1.1, 1.2
- **Letter spacing:** -0.045em on 72 px numerals, -0.035em on the 44 px H2, -0.025em on the 32 px H3
- **OpenType features:** `"ss01"` off; `"tnum"`, `"zero"` on numerals
- **Role:** Section H2 (`--t-h2`), step H3 (`--t-h3`), prices (`--t-numeral`). App page titles use `--t-h3`.

### Inter: UI and body face for nav, buttons, card titles, body copy, captions, labels, tables, forms and the footer. Regular (400) for paragraphs, medium (500) for card titles, questions, labels and buttons. Normal tracking at 18 px and below; slight negative tracking only on the lead and card titles. The 12 px uppercase micro style is the only positive tracking. · `--font-sans`
- **Substitute:** `ui-sans-serif, system-ui`
- **Weights:** 400, 500 (600 in the footer only: V6)
- **Sizes:** 12, 14, 15, 16, 17, 18, 20, 22, 24
- **Line height:** 1.2, 1.3, 1.4, 1.5, 1.6
- **Letter spacing:** -0.02em at 20 to 24 px card titles, -0.01em at 18 to 20 px lead, 0 for body and captions, +0.04em at 12 px uppercase
- **OpenType features:** `"cv11"` (single-storey a); `tabular-nums slashed-zero` on figures
- **Role:** Everything that explains. Body never under 16 px; no text anywhere under 12 px.

### Instrument Serif: the signature. Light, high-contrast display serif borrowed in role from Cora, used on exactly four lines that sit on or beside painted art: the hero H1, the spotlight H2, the dark card H2 and the closing line. Never body, nav, buttons, cards or anything under 36 px, and never in the signed-in app. Google Fonts, latin subset, `font-display: swap` with a metrics-matched fallback. · `--font-serif`
- **Substitute:** metrics-matched fallback, then `ui-serif, Georgia, serif`
- **Weights:** 400
- **Sizes:** 36, 40, 44, 46, 48, 52, 62, 63, 75, 80, 96
- **Line height:** 1.0, 1.02, 1.08
- **Letter spacing:** -0.015em on the hero, -0.01em on the serif H2 and the closing line
- **OpenType features:** none
- **Role:** Four art-sharing lines only (list above). The hero line is "Job applications you would sign.", so the serif reads as a signature.

### Type Scale

Sizes are px at 1440 / 1024 / 768 / 390. The code steps them at `min-width` 768, 1024 and 1280 (the 1440 column).

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| closing | Instrument Serif | 400 | 96 / 75 / 62 / 48 | 1.0 | -0.01em | `--t-closing` |
| hero | Instrument Serif | 400 | 80 / 63 / 52 / 44 | 1.02 | -0.015em | `--t-hero` |
| serif-h2 | Instrument Serif | 400 | 52 / 46 / 40 / 36 | 1.08 | -0.01em | `--t-serif-h2` |
| numeral | Inter Tight | 400 | 72 / 64 / 56 / 48 | 1.0 | -0.045em | `--t-numeral` |
| h2 | Inter Tight | 400 | 44 / 40 / 36 / 32 | 1.1 | -0.035em | `--t-h2` |
| h3 | Inter Tight | 400 | 32 / 30 / 28 / 26 | 1.2 | -0.025em | `--t-h3` |
| h4 | Inter | 500 | 24 / 22 / 20 / 20 | 1.3 | -0.02em | `--t-h4` |
| lead | Inter | 400 | 20 / 20 / 18 / 18 | 1.4 | -0.01em | `--t-lead` |
| body | Inter | 400 | 18 / 18 / 17 / 17 | 1.5 | 0 | `--t-body` |
| body-sm | Inter | 400 | 16 | 1.6 | 0 | `--t-body-sm` |
| caption | Inter | 400 / 500 | 14 (nav links 15) | 1.5 | 0 | `--t-caption` |
| micro | Inter, uppercase | 500 | 12 | 1.2 | +0.04em | `--t-micro` |

`--t-numeral` is for prices only, never invented metrics. `--t-micro` is for the SAMPLE chip and card indices only. In the app: page title `--t-h3`, panel title `--t-h4`, rows and forms `--t-body-sm`, metadata `--t-caption`.

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable and document-like. Per marketing section: one headline of 8 words or fewer, one subline of 20 words or fewer, one visual, at most one primary action.

### Spacing Scale

| Name | Value | Tailwind step |
|------|-------|---------------|
| 4 | 4px | `1` |
| 8 | 8px | `2` |
| 12 | 12px | `3` |
| 16 | 16px | `4` |
| 20 | 20px | `5` |
| 24 | 24px | `6` |
| 28 | 28px | `7` |
| 32 | 32px | `8` |
| 40 | 40px | `10` |
| 48 | 48px | `12` |
| 56 | 56px | `14` |
| 64 | 64px | `16` |
| 72 | 72px | `18` |
| 80 | 80px | `20` |
| 88 | 88px | `22` |
| 96 | 96px | `24` |
| 112 | 112px | `28` |
| 120 | 120px | `30` |
| 128 | 128px | `32` |
| 144 | 144px | `36` |
| 160 | 160px | `40` |

Inside components use 4 to 32, between components 40 to 96, between sections 64 to 160. Section spacing is `padding-block` on the section, never margins on children, so art can extend into it.

### Border Radius

| Element | Value |
|---------|-------|
| inputs, app nav items | 8px |
| cards (problem, floating, sample UI, app panels), landing plan-card inner panels | 16px |
| media (art panels, spotlight card, dark card, every image), landing plan cards and pricing banners | 24px |
| pills (buttons, badges, status pill, eyebrow pill, SAMPLE chip, toggle, step badges, FAQ icon) | 9999px |

Glass surfaces use the same radii: 16 for cards, 24 for panels, 9999 for pills. No fifth radius.

Nothing under 8 px. A nested radius equals the outer radius minus the padding, never larger.

### Shadows

| Name | Value | Token |
|------|-------|-------|
| ring | `inset 0 0 0 1px rgb(0 0 0 / 0.05)` | `--edge` |
| over-art | `0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.10)` | `--sh-over-art` |
| over-art hover | `0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.14)` | `--sh-over-art-hover` |
| glass | `inset 0 1px 0 rgb(255 255 255 / 0.70), 0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.10)` | `--sh-glass` (highlight plus `--sh-over-art`) |
| glass hover | `inset 0 1px 0 rgb(255 255 255 / 0.85), 0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.14)` | `--sh-glass-hover` |

### Layout

- **Page max-width (owner, 2026-10-15):** 1440px (`--c-wide`: nav, footer, page max width); 1280px (`--c-main`); 1120px (`--c-narrow`); 760px (`--c-copy`)
- **Side gutter:** 80 / 48 / 32 / 20px
- **Section gap:** 120 / 96 / 80 / 64px; closing gap 160 / 128 / 112 / 88px
- **Card padding:** 32px at 1024 and up, 24px below
- **Element gap:** 16px
- **Measure:** 560px for sublines, 600px for answers, 66ch for any paragraph

## Component library: shadcn (base-ui), themed to Duna

Generic controls (dialog, select, popover, menu, tabs, table, sidebar, toast and the rest) come from shadcn v4 with Base UI primitives (`web/components.json`: style `base-nova`, `@base-ui/react`, lucide icons), generated into `web/components/ui`. Those files keep shadcn's class names and are themed only through the variables below; landing and app components in `web/components/{landing,shared,layout,dashboard}` stay Duna-native. shadcn semantics win for shadcn names, Duna supplies every value (`web/app/globals.css`).

| shadcn variable | Duna value |
|-----------------|------------|
| `--background` | `--canvas` Linen `#f7f7f5` |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | `--ink` `#1b0624` |
| `--card`, `--popover` | `--surface` Paper White `#ffffff` |
| `--primary` / `--primary-foreground` | `--action` Espresso `#160f0c` / `--on-action` `#ffffff` |
| `--secondary`, `--muted`, `--accent` | `--sunk` Bone `#edece7` (surfaces) |
| `--muted-foreground` | `--faint` Deep Ash `#5e5566` |
| `--destructive` | `--bad` `#a3261c` |
| `--border` | Duna hairline, Stone at 40 percent |
| `--input` | `--body` Graphite `#444444` (input borders) |
| `--ring` | `--ink` (focus ring colour) |
| `--radius` | `1rem` (16 px card). The derived `rounded-sm` to `rounded-4xl` scale is for `components/ui` only; Duna code uses `rounded-input`, `rounded-card`, `rounded-media`, `rounded-pill` |
| `--sidebar` / `--sidebar-foreground` | `--canvas` / `--icon` Charcoal |
| `--sidebar-primary` / `--sidebar-primary-foreground` | `--action` / `--on-action` |
| `--sidebar-accent` / `--sidebar-accent-foreground` | `--sunk` / `--ink` (active item, App Shell) |
| `--sidebar-border` / `--sidebar-ring` | `--border` / `--ring` |
| `--chart-1` to `--chart-5` | shadcn neutral greys (achromatic, unchanged) |
| `--font-sans` / `--font-heading` | Inter / Inter Tight (Geist removed) |

Renamed Duna tokens (2026-10-15): `--muted` became `--faint` (Deep Ash; utility `text-faint`), `--ring` became `--edge` (the card edge box-shadow; utility `shadow-edge`). New: `--on-action` `#ffffff` (utility `text-on-action`). Removed: the legacy `--accent` (Espresso), `--accent-hover`, `--accent-ink` and `--accent-soft` aliases.

How the shared names are used now:
- Body and secondary text: `text-body` (Graphite). This is what the retired legacy `text-muted` meant.
- Captions, indices, legal: `text-muted-foreground` or `text-faint` (both Deep Ash).
- `bg-muted` is a Bone surface. Never write `text-muted`: it is now Bone text.
- `bg-accent` / `text-accent-foreground` are shadcn's hover and selected wash (Bone, ink), never a button fill.
- Primary button: `bg-action text-on-action hover:bg-action-hover`. Native checkbox and radio tint: `accent-action` (the base layer already sets it).
- No dark theme: shadcn's `.dark` block is removed, and `@custom-variant dark (&:is(.dark *))` stays so `dark:` utilities in `components/ui` never follow the OS setting. The body default text colour stays Graphite (shadcn's `text-foreground` on `body` was removed).

## Components

### Primary Filled Button
**Role:** Every primary action, site and app

Espresso `#160f0c` fill, white label (19.0:1), Inter 500, pill radius, no border, no shadow. Three sizes: 56 px tall with 28 px side padding and a 16 px label (hero and closing), 44 px with 20 px padding and a 15 px label (nav and inline), 36 px with 16 px padding and a 14 px label (dense app rows). Hover changes the fill to `--action-hover` `#2b211c` over 300 ms ease-out; nothing moves. Focus: 2 px `--ink` outline, 3 px offset. At most one per section; the landing hero has exactly one.

**Owner override (2026-10-29):** the hero CTA and the navbar "Start free" are the Rainbow Button (`components/shared/rainbow-button.tsx`, Magic UI's mechanism rebuilt in-house): Espresso face with the white label, 8 px radius, a 2 px rainbow ring on all four sides and a soft glow under it (opacity 0.5) in the valley's own hues at higher chroma (sky, haze, amber, meadow, lilac; interpolated in oklch so no stop mixes to olive), drifting over 2 s. Hover keeps the Espresso face and instead saturates the ring and glow and adds a hairline inner top highlight. They are the only two gradient surfaces on the site and the only place art hues touch UI; the face always covers the glow, so the label stays 19:1. Every button and button-like link lifts 2 px on hover (200 ms `--ease-out`) and presses to 97 percent, 95 percent for buttons 44 px tall and under (90 ms in, 320 ms back), filled buttons dipping slightly in brightness; one shared rule in `app/globals.css`, `data-no-press` opts out. Reduced motion keeps the colour change only: no lift, no press scale, the rainbow holds still.

### Ghost Button
**Role:** Secondary action

Over art: light glass (`--glass`, `blur(20px) saturate(140%)`, 1 px `--glass-edge`, `--glass-hi`), pill radius, `--ink` label in Inter 500 14 to 16 px (13.1:1 over Ridge), sizes as the primary. No Stone border on glass (Stone is only 2.5:1 there; the label and pill shape identify the control). Hover raises the highlight to 0.85 and fills `--glass-strong`. On plain Linen or Paper (no art behind) it is not glass: Paper White fill with the 1 px Stone border (3.6:1) and the same label.

### Inverse Button
**Role:** The one action on the dark card

Paper White fill, Espresso label (19.0:1), 56 px pill. Hover fill Bone `#edece7` (Espresso label 16.0:1). Used nowhere else. It stays solid: the dark card's glass is for chips and secondary surfaces, never for the one action.

### Quiet Button and Text Link
**Role:** Tertiary actions; inline links

Quiet button (app): no fill, `--ink` label, Bone wash on hover. Text link: `--ink`, 1 px underline at 3 px offset, 44 px hit area ("Log in", inline links). Links are never coloured; there is no link blue.

### Navigation Bar
**Role:** Marketing site navigation

Spans `--c-wide` 1440. Transparent over the hero sky at the top (no glass, no border); after 24 px of scroll it becomes nav glass: `--glass-nav` `rgb(247 247 245 / 0.72)`, `blur(16px) saturate(140%)`, a 1 px bottom border `rgb(255 255 255 / 0.5)` plus a hairline `rgb(27 6 36 / 0.06)` (as a second inset or a 1 px pseudo-element). Links Charcoal 10.9:1 and the logo 13.6:1 over Ridge scrolling behind. No drop shadow. The blur radius is never animated; only opacity and background colour change at the scroll threshold. Height 72 / 72 / 64 / 60. Logo (mark plus wordmark) in Aubergine Ink on the left, three links centred in Charcoal 15 px with 40 px gaps, "Log in" text link plus one 44 px Espresso pill on the right. Below 1024 the links fold into a 44 px menu button that opens a Linen sheet with 56 px rows and hairline separators.

### App Shell
**Role:** Signed-in layout

Linen canvas. A 240 px sidebar from 1024 up with the logo at the top and nav links in Inter 500 15 px Charcoal; the active item is a Bone fill with an 8 px radius and `--ink` text. A 1 px hairline (`--border`) separates the sidebar and the header from the content. Main area padding 16 / 24 / 40 px horizontally, 32 px vertically. Content sits in Paper White panels; no paintings, no serif and no ambient motion in the app.

### Status Pill
**Role:** One honest fact above the hero headline

32 px tall, 14 px side padding, light glass (`--glass`, `blur(20px) saturate(140%)`, 1 px `--glass-edge`, `--glass-hi`) over the hero sky, pill radius, `--ink` Inter 500 14 px (13.1:1 over Ridge, higher over the real sky), the lime dot 8 px before the text. Neutral frost only; the dot is the only colour. States a true fact only ("25 free applications"), never a count of users or a "trusted by" line. Espresso is never used for this pill, so Espresso stays CTA-only.

### Status Dot and Status Words
**Role:** Pass, approved, live, skipped, failed

The word carries the meaning; colour only supports it. Positive: the word in `--ink` with the 8 px lime dot and its 1 px ink ring. Open or not-yet: the word with a hollow 8 px square (1 px `--ink`). Neutral or skipped: the word in `--faint`. On the landing there is no red and no green text. In the app, warnings use `--warn` `#8a5a00` and errors use `--bad` `#a3261c`, as words and small badges only, never large areas.

### Eyebrow Pill and SAMPLE Chip
**Role:** A section fact; the label on every product mock

Eyebrow pill: 28 px tall, 12 px padding, Bone fill, `--faint` Inter 500 14 px, used only where it carries a fact. SAMPLE chip: 22 px tall, 8 px padding, Bone pill, `--faint` Inter 500 12 px uppercase with +0.04em tracking (6.0:1), top-right corner of every card that shows product state. A chip that sits directly on art (not inside a card) is a light glass pill instead (`--glass`, `--glass-edge`, `--glass-hi`) with `--ink` text (13.1:1 over Ridge), same size and tracking. Inside a glass card it stays a Bone pill.

### Badge
**Role:** Small status label in app tables and cards

Pill, 1 px border, 12 px text, 8 px by 2 px padding. Neutral: hairline border, `--faint` text. Positive: `--ink`. Warn and error: text in `--warn` or `--bad` with the border at 30 percent of the same colour.

### Centred Art Hero
**Role:** Above-the-fold statement on the landing

Full-bleed Scene A painting, masked so its top fades in behind the lower half of the H1 and its bottom dissolves into Linen. The status pill and the floating card are glass (see those components); the hero holds at most three glass surfaces. A text scrim, `radial-gradient(60% 45% at 50% 30%, rgb(247 247 245 / 0.85), transparent 70%)`, sits behind the copy so its worst background is haze `#f6dcc8` (Graphite 7.4:1). Centred stack in `--c-copy` 760: status pill, serif H1 at `--t-hero` in two lines, subline at `--t-lead` in Graphite (measure 560), one 56 px Espresso pill. One floating sample card in the left third of the painting, clear of the copy column. Hero block about 1000 px tall at 1440; at 390 the portrait crop is used and the card moves into normal flow under the hero.

### Floating Sample Card
**Role:** Product state shown over art

Strong glass (`--glass-strong`, `blur(20px) saturate(140%)`, 1 px `--glass-edge`), 16 px radius, `--sh-glass` (inner highlight plus `--sh-over-art`), 16 px padding, `--t-body-sm` lines, SAMPLE chip (Bone pill inside the card), synthetic names ("Company 014"), figures in `--ink` tabular. Strong rather than light because the lines are 14 to 16 px and the receipt and inbox rows are dense: Graphite 7.8:1 and Deep Ash 5.7:1 over Ridge. On fine pointers, hover lifts 3 px and switches to `--sh-glass-hover` (highlight 0.85, second shadow layer 0.14); no movement on coarse pointers. Real DOM, never an image. Falls back to solid Paper White with the ring (see Frosted glass layer). The same glass applies to the sample cards in the zig-zag panels and to the floating approval card at the spotlight; the approve mock that bleeds off the spotlight card is on Paper White and stays solid.

### Feature Card
**Role:** Problem trio and any quiet card on Linen

Paper White on Linen, the ring, 16 px radius, 32 px padding. Index (`001`) in `--faint` micro at the top, a 96 px Charcoal line icon with a 1.25 px stroke in the upper half, title at `--t-h4` and two or three lines of `--t-body-sm` in Graphite pinned to the bottom. No shadow, no border. Three columns with 24 px gaps; one column below 768.

### Commitment Strip
**Role:** The proof slot after the hero, filled with checkable rules instead of logos

One centred row in `--c-main`: a 14 px `--faint` caption, then three or four items, each a 20 px Charcoal line icon plus an `--ink` Inter 500 16 px label, separated by 24 px tall 1 px Stone rules and 48 px gaps. No logos, no marquee.

### Zig-zag Step Row with Connector
**Role:** The four "how it works" steps

`--c-narrow` 1120, split 50 / 50 with a 48 px gutter, panels alternating left and right. Art panel: 4:3, 24 px radius, the step's painting (see Brand assets), clipped by the radius. A strong-glass sample card (Floating Sample Card) covers about 72 percent of the panel; the panel's grain and painting sit behind it, so the frost has colour to blur. Text column: a 32 px step badge (Paper White circle, 1 px `--ink` ring, `--ink` 14 px tabular numeral), H3 at `--t-h3`, two or three lines of body. A 1.25 px Charcoal connector with round caps joins the panels and runs through the spotlight card; it draws on scroll. At 768 and below the connector becomes a straight vertical timeline line. No gradient rings, no coloured connector.

### Spotlight Card
**Role:** The approve moment

Paper White outer card, the ring, 24 px radius, 1120 by 560 at 1440, split 48 / 52 with art on the left. The art half is the Scene B footbridge painting. A white approve mock bleeds 24 px off the outer edge; a floating card with the lime "approved" dot straddles mock and art. Text half: serif H2 at `--t-serif-h2`, body in Graphite, 72 px padding toward the art and 64 px on the outer side.

### Dark CTA Card
**Role:** The one dark beat on the landing (deviation V2)

960 by 380, 24 px radius, base Aubergine Ink `#1b0624` with the procedural mesh (see Brand assets) and 14 percent grain in `overlay`. Serif H2 at `--t-serif-h2` in `--on-dark`, one line in `--on-dark-muted`, one Inverse Button. Text sits over the darkened centre ellipse. No shadow. One per page, landing only. Inner chips and secondary buttons (for example a small fact chip or a ghost link beside the Inverse Button) use dark glass: `--glass-dark` `rgb(27 6 36 / 0.42)`, `blur(16px)`, 1 px `--glass-dark-edge`, pill radius, Linen text (`--on-dark`, 7.2:1 even over the brightest mesh `#827BC8`). `--on-dark-muted` is not used inside dark glass: it is 4.4:1 over `#827BC8` (it passes at 6.0:1 over the real mesh bright `#6b5a86`, but the margin is thin). Dark glass appears nowhere outside this card.

### Plan Card and Billing Toggle
**Role:** Pricing

Landing (2026-10-15, owner references Roomservice, A/B card, "Built for Growth", "Flexible plans"; built in `web/components/landing/islands/billing-plans.tsx` and `.css`). A 24 px art banner (a `scene-a-dawn-valley.png` crop behind a Linen scrim) carries the H2 and subline on the left and the interval toggle on the right as light glass (Weekly / Monthly / Quarterly, Monthly default); below 768 it stacks, headline then toggle. Plan cards: Paper White, the ring, 24 px radius, 8 px padding, no shadow. An inner 16 px Bone panel holds the plan name at `--t-h4`, the `plans.ts` tagline, the price at `--t-numeral` Inter Tight 400 tabular in `--ink` with the period in `--faint` 16 px, the allowance line, a full-width button and a 14 px `--faint` caption (Free: "Never expires"; paid: price per application at full use). Below the panel: "What's included" (Inter 500 14 px `--ink`) and up to four `plans.ts` features with 20 px Phosphor light round checks in Charcoal; G3 features carry "(in beta)" after their name. The highlighted plan (Pro) shows `scene-b-footbridge.png` under strong frost whose top-right corner stays clear, a light-glass "Recommended" pill on that corner (never "Most popular"), and the section's only Espresso button; the other plans use outlined buttons on Paper White. Prices, periods, allowances and captions are read from `plans.ts` and change together with the toggle. Under the cards a 24 px pastel gradient banner holds one strong-glass bar with the guarantee line and a "See full pricing" text link. Four columns with 16 px gaps at 1280 and up, two by two from 768 to 1279, one column below 768 with the recommended plan first. The /pricing screen keeps the Bone-track toggle and solid cards.

### FAQ and Compare Rows
**Role:** Two-column lists

`--c-narrow`, heading column 320 and the list in the rest (the 1:2 frame of 08 1.9). Landing FAQ (2026-10-15, owner: "use shadcn components in faq section"): the shadcn Accordion (`components/ui/accordion.tsx`, Base UI), one row open at a time and collapsible, styled through className only. Rows separated by `--border` hairlines (above the list and under every row); question `--ink` Inter 500 16 px in a 56 / 64 px row; the 28 px Bone icon circle with a plus that turns to a minus when open (shadcn chevrons hidden); answer `--body` Inter 400 16 / 1.6, measure 600, 24 px below. Focus: 2 px `--ink` outline at 3 px. The panel height animation runs on `--dur-acc` and drops to 0.01 ms under `prefers-reduced-motion` and `html[data-motion="reduced"]`. Answers are rendered on the server and kept mounted (`keepMounted`, `hiddenUntilFound`): the HTML carries them for search engines, find-in-page opens the matching row after hydration (Base UI writes `hidden="until-found"` on the client; the server HTML has plain `hidden`), and with JavaScript off the rows do not open (accepted trade-off; the FAQPage JSON-LD in `json-ld.tsx` is unchanged and carries every answer). Keyboard: Tab to each question, Enter or Space toggles; Base UI 1.9 has no arrow-key roving between rows. The /pricing billing FAQ still uses the native `<details>` `FaqList`. Compare rows: topic label above two sub-columns, "Typical auto-apply" in `--faint`, Kairos in `--ink`. No product names.

### Closing Art Band
**Role:** The last action

Rebuilt 2026-10-30 (owner: "make landing page cta background image using in footer and for cta section"). Two columns on the haze from 1024 (text 5 of 12, the window 7 of 12 running to the viewport edge): the serif closing line at `min(--t-closing, 7.4cqi)`, the ApprovedLine subline and one 56 px Espresso pill with a label-roll hover. On the right the hero's app window (`AppMockup`, its own strong glass, no second frame) hangs from the ridge line and moves with scroll parallax (120 to −120 px; 48 to −24 below 768). In front of it the footer's dusk-hills painting (`footer-dusk-hills-2880x840.png`) runs full width across the bottom with its own parallax (200 to −200 px; 80 to −40 below 768), its sky masked out and its edges dissolving into Linen; the section runs 56 px under the footer (the colophon's `--ft-fade`) so Linen blends into the footer's paper with no seam. Below 1024: text, then the window in flow, then the band. Reduced motion: no transforms. Scripts off: the final frame. The door painting (`closing-dusk-door.png`) is no longer used on the landing.

### Footer
**Role:** Site footer

Owner-supplied footer (V6, 2026-10-15; spec `docs/superpowers/specs/2026-10-15-kairos-landing-design/10-footer-driftbar-spec.md`, built in `web/components/landing/entries/colophon.tsx`, `colophon.css` and `islands/footer-video.tsx`). Full viewport (viewport minus nav height), drawn on a 1440 x 672 canvas with a `--u` unit. Top is pale paper `#f1f1ee`, blended from Linen `#f7f7f5` over the first 48 px so no seam shows. Brand block: Kairos Logo, title "Job applications you would sign.", a short paragraph, a "Follow us" label with five 36u light-glass icon links (LinkedIn, X, Instagram, TikTok, YouTube; Phosphor light 18 px, 44 px hit area, 2 px ink focus ring, `siteConfig.social` with placeholder `#` hrefs to replace before launch), and the copyright line "© 2026 Kairos. A product of Gray Matter Labs." in Deep Ash. No CTA, no status chips, no Motion chip. Columns Product (How it works, Pricing, Blog), Company (About, Careers, Contact) and Legal (Terms, Privacy, Cookies, Refunds), real routes only. The lower half is the looping blue-hour meadow video fading into the paper through a haze gradient. At the bottom a giant frosted-glass "Kairos" wordmark sinks into lavender fog `#e2e3f1`. Footer text is ink `#0c0c0c`, body Graphite `#444444`, secondary and copyright Deep Ash `#5e5566`. Inter 600 is used for the footer title, column titles and wordmark only (owner exception, see Do's and Don'ts). The video is paused under `prefers-reduced-motion` and `html[data-motion="reduced"]`, and a small round light-glass pause/play button (32 px, 44 px hit area, bottom right above the fog, `aria-pressed`) lets the visitor stop or start it. This supersedes the earlier Linen link band with dusk hills.

### Input Field
**Role:** Every form field

Mist `#eeeeee` fill, 8 px radius, 1 px Graphite border, 44 px tall, `--ink` 16 px text, placeholder in `--faint` (6.1:1 on Mist). Focus: the border turns Espresso and keyboard focus adds the 2 px `--ink` ring at 3 px offset; no glow, no shadow. Error: border and message in `--bad`, message as a sentence.

### App Panel and Data Row
**Role:** Signed-in content

Paper White panel on Linen, the ring, 16 px radius, 24 px padding, panel title at `--t-h4`. Rows are separated by `--border` hairlines; primary text `--t-body-sm` in `--ink` or Graphite, metadata `--t-caption` in `--faint`, status as a word plus dot or badge at the row end. Interactive rows are at least 44 px tall.

### Danger Button
**Role:** Account deletion only

`--danger-fill` `#a3261c`, white label (7.4:1), pill, sizes as the primary. Never on the landing.

## Do's and Don'ts

### Do
- Use Linen `#f7f7f5` as the base of every page, site and app; Paper White is for cards on top of it.
- Use Espresso `#160f0c` as the only filled-button colour, one primary per section.
- Set display and headings in Inter Tight 400 and build hierarchy from size and tracking; keep body at Inter 400, 16 px or larger.
- Keep the UI 99 percent achromatic so the painting is the only saturated thing in view.
- Separate cards with the 1 px inset ring and tint on Linen; use `--sh-over-art` (inside `--sh-glass`) only for glass surfaces over art.
- Use weight 600 only in the footer (title, column titles, wordmark), per the owner footer spec (V6); everything else stays 400 and 500.
- Use frosted glass only where there is something to blur: painted art, the closing glow, the dark-card mesh, the footer video, and the nav over scrolled content.
- Keep glass neutral white (or neutral Linen for the nav, Aubergine for dark glass); use strong glass for any text at 14 px or smaller and for dense rows.
- Keep soft colour variation in the calm zone under every glass card, so the frost reads as frost; keep the zone low in detail so it stays legal.
- Count glass surfaces: at most 6 visible at once, blur 12 px below 768 px wide.
- Put the 8 px lime dot, with its 1 px ink ring, beside the word it marks.
- Label every product mock SAMPLE and use synthetic names; every number shown must be true or inside a SAMPLE card.
- Use exactly four radii: 8, 16, 24, pill.
- Generate every painting as an edit of Scene A so one valley and one brushwork run through the page.

### Don't
- Don't use `--art-*` hues on text, borders, buttons, badges, the connector or the toggle.
- Don't use the serif outside its four lines, under 36 px, or anywhere in the app.
- Don't put a shadow on anything that sits on Linen: buttons, plan cards, feature cards, the spotlight card and the dark card stay flat.
- Don't use glass on flat Linen sections: problem cards, plan cards, compare and FAQ stay solid Paper White with the 1 px ring (glass over a flat colour reads as a grey box). On landing pricing, glass sits only over that section's own art: the banner toggle, the recommended plan's frosted panel and pill, and the guarantee bar.
- Don't tint glass with art hues or lime; don't put glass behind long body text or on the Inverse Button; don't use dark glass outside the dark CTA card.
- Don't animate the blur radius, and don't stack glass on glass.
- Don't set Deep Ash or Graphite at 14 px or smaller on light glass; use strong glass.
- Don't set text in Stone `#898683` (3.4:1) or Duna Warm Ash `#766a7c` (4.3:1 on Bone); use `--faint` `#5e5566`.
- Don't use font weight 600 outside the footer. The owner footer spec sets the footer title, column titles and giant wordmark in Inter 600 (V6); everywhere else the 400 and 500 rule holds and hierarchy comes from size, tracking and colour.
- Don't add a second accent: no ember numerals, no blue links, no coloured accent word in a headline.
- Don't use lime as a button fill, a logo colour, a border or text.
- Don't place text on painted art outside a calm sky zone or a scrim.
- Don't show customer logos, testimonials, user counts, "trusted by" lines or invented metrics.
- Don't use gradient rings on badges or toggles, and don't put grain on text zones.
- Don't use pure white as a page background or pure black for text.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Linen Canvas | `#f7f7f5` | Page background for every route; the colour every painting fades into |
| 1 | Paper Card | `#ffffff` | Cards, floating cards, plan cards, app panels, button fills for ghost and inverse |
| 2 | Bone Panel | `#edece7` | Nested panels, chips, toggle track, active nav, skeletons |
| 3 | Mist Field | `#eeeeee` | Input fields only |
| 4 | Ink Card | `#1b0624` | The one dark CTA card on the landing, with its mesh |
| G1 | Light Glass | `rgb(255 255 255 / 0.64)`, `blur(20px) saturate(140%)` | Pills over art (status pill, SAMPLE chip on art, ghost buttons over art); never on Linen |
| G2 | Strong Glass | `rgb(255 255 255 / 0.78)`, same blur | Floating cards over art, any text at 14 px or smaller, dense rows |
| G3 | Nav Glass | `rgb(247 247 245 / 0.72)`, `blur(16px) saturate(140%)` | Nav after scroll |
| G4 | Dark Glass | `rgb(27 6 36 / 0.42)`, `blur(16px)` | Chips and buttons inside the dark CTA card only |

Glass levels sit over art and are not part of the Linen, Paper, Bone step; they never replace Level 1 on a Linen section.

## Elevation

- **Every card:** `inset 0 0 0 1px rgb(0 0 0 / 0.05)`
- **Glass surface over art:** `--sh-glass`: inner top highlight `inset 0 1px 0 rgb(255 255 255 / 0.70)` plus `0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.10)`, with the 1 px `--glass-edge` border instead of the ring
- **Glass surface, hover on fine pointers:** highlight raised to `0.85`, second shadow layer to `0.14`, 3 px lift on cards
- **Solid white card over art (fallback, or the approve mock):** the ring plus `--sh-over-art`
- **Scrolled nav:** no drop shadow; `rgb(247 247 245 / 0.72)`, 16 px blur with 140 percent saturation, 1 px bottom border `rgb(255 255 255 / 0.5)` plus a `rgb(27 6 36 / 0.06)` hairline
- **Focus:** 2 px `--ink` outline, 3 px offset; 2 px `--on-dark` on the dark card

The hairline ring is the elevation system on Linen. Depth comes from the step Linen, Paper, Bone and from white space. Over art, depth comes from the frost itself: the blurred painting behind the card, the white edge and the top highlight. The single shadow exists because an edge alone disappears into brushwork; it is never used on Linen.

## Frosted glass layer

Owner amendment 2026-10-15 (V5, ledger L18 in 09 section 11): Duna stays the primary style and gains a frosted-glass layer. Glass is a treatment for surfaces that float over art, not a new colour or a new theme.

**Where.** Only on surfaces that sit over something to blur: painted art, the closing glow, the dark-card mesh, the footer video, and the nav over scrolled content. Never on flat Linen sections. Problem cards, plan cards, compare and FAQ stay solid Paper White with the 1 px ring, because glass over a flat colour reads as a grey box.

**Recipes.**

| Variant | Fill | Backdrop | Border | Highlight and shadow | Radius |
|---------|------|----------|--------|----------------------|--------|
| Light glass (default) | `rgb(255 255 255 / 0.64)` | `blur(20px) saturate(140%)` | 1 px `rgb(255 255 255 / 0.60)` | `inset 0 1px 0 rgb(255 255 255 / 0.70)` plus `--sh-over-art` | 16 cards, 24 panels, 9999 pills |
| Strong glass | `rgb(255 255 255 / 0.78)` | same | same | same | same |
| Nav glass | transparent at the top; on scroll `rgb(247 247 245 / 0.72)` | `blur(16px) saturate(140%)` | bottom 1 px `rgb(255 255 255 / 0.5)` plus hairline `rgb(27 6 36 / 0.06)` | none | none |
| Dark glass (dark CTA card only) | `rgb(27 6 36 / 0.42)` | `blur(16px)` | 1 px `rgb(255 255 255 / 0.14)` | none | pill or 16 |

Strong glass is required for text at 14 px or smaller and for dense rows (receipt, inbox). Pills on art (hero status pill "25 free applications", SAMPLE chip on art, ghost buttons over art) are light glass, pill radius, `--ink` Inter 14/500 text.

**Neutral frost only.** Never tint glass with art hues or lime. Lime stays the 8 px status dot.

**Sanctioned decorative glass: the footer wordmark (V6).** The giant "Kairos" footer wordmark is frosted glass used as decoration, not as a surface: `background-clip: text` over a white-to-lavender gradient (`rgb(255 255 255 / .78)`, `rgb(214 218 246 / .36)` at 48 percent, `rgb(255 255 255 / .62)`), transparent text fill, two `drop-shadow` filters (a 1u white top edge and an 18u lavender glow) and no `-webkit-text-stroke`, because the letters overlap and a stroke would draw lines through them. It uses no `backdrop-filter`, so it does not count toward the six-surface limit, and it is `aria-hidden` (the logo carries the name). It sinks into the lavender fog `#e2e3f1`.

**Calm zones keep soft colour.** The area under a glass card must keep soft colour variation (peach into sage into pale blue), not a flat white or flat fill, otherwise the frost has nothing to blur and the card reads as a grey box. Keep that area low in detail so text stays legal.

**Contrast (WCAG 2.2).** Measured on glass composited over the darkest art tone that can sit behind a card, Ridge `#9C8793`. The blur averages the backdrop, so a flat composite is a fair model; saturate is ignored, which is why margins matter.

| Text | Light glass 0.64 (`#DBD4D8`) | Strong glass 0.78 (`#E9E5E7`) | Nav glass 0.72 (`#DED8DA`) |
|------|------------------------------|--------------------------------|-----------------------------|
| Ink `#1b0624` | 13.1 | 15.3 | 13.6 |
| Charcoal `#292421` | 10.5 | 12.3 | 10.9 |
| Graphite `#444444` | 6.7 | 7.8 | 6.9 |
| Deep Ash `#5e5566` | 4.9 | 5.7 | not used |

Deep Ash passes on light glass (4.86), but the margin is under 0.4 and `saturate(140%)` can deepen the backdrop, so Deep Ash and Graphite at 14 px or smaller go on strong glass (5.7 and 7.8). Dark glass: Linen `#f7f7f5` on `rgb(27 6 36 / 0.42)` over mesh bright `#827BC8` (composite `#574A83`) is 7.2:1; `--on-dark-muted` is 4.4:1 there and fails, so dark glass carries Linen text only (it is 6.0:1 over the real `#6b5a86`). Over the fallback fill `rgb(255 255 255 / 0.94)`: Ink 18.1, Deep Ash 6.7.

**Fallbacks.**
- `@supports not (backdrop-filter: blur(1px))`: fill `rgb(255 255 255 / 0.94)` (dark glass: `rgb(27 6 36 / 0.92)`), same border and shadow.
- `@media (prefers-reduced-transparency: reduce)`: solid Paper White for light and strong glass, solid `#1b0624` for dark glass, nav solid Linen; backdrop filter off.
- `forced-colors: active`: `Canvas` background, 1 px `CanvasText` border, backdrop filter off, shadows off.

**Performance.** At most 6 glass surfaces visible at once. Never animate the blur radius (animate transform and opacity only). Blur drops to 12 px below 768 px wide. Do not nest `backdrop-filter` elements, and keep the filter on the glass element itself, not on a large ancestor.

**Motion.** Unchanged. On fine pointers a hover on a glass card may raise the inner highlight to 0.85 and the second shadow layer to 0.14.

## Imagery

Imagery is one soft painted valley (river, rounded ridges, meadow, a pale footpath), always the same place, seen at a different hour in each section from dawn in the hero to dusk at the close. It is the only colour on the page and it carries the story: each painting holds one symbolic object for its section's message about job applications. Below and around the paintings the page is editorial UI: thin Charcoal line icons on white cards, real DOM product cards labelled SAMPLE floating over the art, prices in large tabular figures. Art is full bleed and soft-edged at the top and bottom of the page (hero, closing, footer) and hard-clipped by a 24 px radius inside cards in the middle. There is no photography, no stock imagery, no 3D, no product screenshots, no people and no logos. The signed-in app shows no paintings.

## Brand assets

This section governs every image, logo and icon Kairos ships. The generation brief is `prompt.md` at the repo root. **The file names and paths in `prompt.md` are binding:** a painting ships only under its listed name and path, the page picks it up with no code change, and the build shows a soft placeholder at that path until the file exists. Record every generated file in `web/public/landing/art/LICENSE.md` (file name, tool, date, prompt number) and keep the full-size originals.

### Paintings

- **One valley, one style.** Soft digital painting, large flat colour fields, visible soft brush edges, no outlines, gentle atmospheric haze, edges dissolving into Linen `#f7f7f5` where the art meets the page. Muted palette of peach, dusty rose, sage and pale blue, built from the `--art-*` hexes above. Not cartoon, not anime, nothing that imitates a specific studio, no dramatic clouds.
- **Scene A is the master.** `scene-a-dawn-valley.png` is generated first; every other painting is generated as an edit of it (`-i web/public/landing/art/scene-a-dawn-valley.png`) so ridges, palette and brushwork match.
- **One symbolic object per section.** Each section painting carries its section's meaning through a single object in the same valley.
- **Owner-approved deviation V6, owner-supplied footer (recorded 2026-10-15).** The footer is built from the owner's footer spec (`10-footer-driftbar-spec.md`) with Kairos adaptations: full-viewport pale paper top, a looping meadow video, a frosted-glass wordmark, Inter 600 in the footer only. It replaces the Linen link band, the dusk-hills painting and the procedural hills. It is the only video on the page and has a pause control (the round pause/play button). It does not permit a second video or another painting style elsewhere.
- **Owner-approved deviation V4 (recorded 2026-10-15).** Duna allows "one painted moment". Kairos keeps one valley and one style but paints several scenes, one per section. This extends 09's V1 (crops of one master) and does not permit a second style, a second place or a second palette.
- **Never in a painting:** people, faces, hands, animals, readable text or letters, logos, buildings beyond the listed objects.
- **Art hues never become UI colours.** A painting may not lend a colour to a button, link, badge, border or headline.
- **Text on art** sits only over a calm sky zone or the hero scrim. Each brief in `prompt.md` reserves the calm zone where cards or copy sit. Under a glass card that zone keeps soft colour variation (not flat white or a flat fill) so the frost reads, and stays low in detail.

| Section | File (in `web/public/landing/art/`) | Symbolic object | Hour |
|---------|--------------------------------------|-----------------|------|
| Hero (master) | `scene-a-dawn-valley.png` 3200x1600; `scene-a-dawn-valley-portrait.png` 1088x1360 crop for phones | A path leading to one open door standing in the meadow, light at the gap | Dawn |
| Step 1, fit before applying | `step-1-fit-gate.png` | A garden gate; two letters pass, the rest settle in the grass | Early morning |
| Step 2, every line cites a fact | `step-2-truth-lock.png` | A resume page tied by threads to pinned notes; one loose slip blows away | Mid-morning |
| Spotlight, nothing sent until you approve | `scene-b-footbridge.png` | A sealed envelope waiting on the footbridge | Late morning |
| Step 3, a receipt for every application | `scene-c-noon-meadow.png` | A small stack of receipts held by a pebble on a stone | Noon |
| Step 4, replies sorted | `step-4-replies.png` | A post box with envelopes in two piles | Late afternoon |
| Dark CTA card (optional) | `dark-card-night.png` | One small warm light far away, like a lit doorway | Night |
| Closing | `closing-dusk-door.png` | The same door, now wide open, light across the grass | Dusk |
| Footer (V6) | Looping video `web/public/landing/footer/meadow.mp4`, owner-supplied | Blue-hour meadow, lavender mist, fireflies | Blue hour |

The problem trio is not painted: its three icons are line icons drawn in code. The optional problem-trio still lifes listed in `prompt.md` (#3) are not used. If `dark-card-night.png` is used, its base stays at Aubergine Ink `#1b0624` and the zone under text is no lighter than `#4a3a5c` (On Dark 9.6:1).

Delivery: PNG masters, served through `next/image` as AVIF with WebP fallback. Only the hero is eager and preloaded (target about 110 KB AVIF at 1440); 08 section 9.1 holds the per-viewport budget. Each art box shows a gradient placeholder in the painting's own colours until the file decodes.

### Icons

Thin geometric line icons in Charcoal `#292421`, 1.25 px stroke, round caps and joins, drawn in code as inline SVG on a 24 px grid. The stroke stays 1.25 px at every size (`vector-effect: non-scaling-stroke`): 16 px in lists, 20 px in the commitment strip, 96 px in the problem trio. No painted, filled, duotone or 3D icons, and no friendly rounded icon sets. The problem-trio icons are line icons, not images. Phosphor (already a dependency) may supply app utility glyphs at weight `light` only. Icon-only buttons (menu, close) carry an accessible name.

### Logo

- One colour: Aubergine Ink `#1b0624` on Linen `#f7f7f5`. Reversed, Linen on Aubergine Ink, for the app icon and on the dark card. No lime, no gradients, no shadow.
- **The mark is Catch (owner, 2026-11-05; replaces the open door, which stays in the paintings):** a figure drawn as one sweeping line from back foot to reaching hand, with a single point just out of reach, because the legend says you catch Kairos as he passes. Filled and organic: limbs taper to fine ends and joins flow, with no strokes and no geometric construction. It faces right, towards the wordmark. Never mirror it, never let the hand touch the point, never add an outline, tile effect or second colour. Clear space equals half the mark width.
- Lockup: mark plus the word "Kairos" in Urbanist 500, -0.02em, Aubergine Ink; 28 px mark beside 20 px type in the nav.
- The shipped logo is SVG in `web/components/shared/logo.tsx` (`currentColor`, Ink by default); `web/public/brand/kairos-mark.svg` is the same drawing and is the source for the PNGs.
- At 32 px and below use the heavier cut (thicker limbs, a bigger point): `web/app/icon.svg` and `extension/public/kairos-mark.svg`. The favicon is Ink on transparent, switching to Linen in dark tabs. App icons `web/app/icon.png` (512) and `web/app/apple-icon.png` (180) are reversed: Linen mark on a full-bleed Aubergine square, no rounded corners (the OS masks it).
- Extension icons: `extension/public/icons/icon-16.png`, `icon-32.png` (heavier cut), `icon-48.png`, `icon-128.png`: Linen on an Aubergine tile with rounded corners, because the toolbar applies no mask.

### Open Graph

`web/public/landing/og-kairos.png`, 1200x630 (generated at 1536x816 as an edit of Scene A, then resized). The dawn valley with the path and the glowing door on the right, faded to Linen across the upper left. In the upper left third, the serif headline "Job applications / you would sign." in Aubergine Ink; below it the wordmark "Kairos" in a clean sans in Graphite `#444444`. Nothing else written. If the model misspells the text, use the text-free variant and let the build set the type. Alt text: "Kairos: Job applications you would sign."

### Procedural (code, not images)

- **Grain tile:** one inline SVG `feTurbulence` (fractalNoise, `baseFrequency` 0.85, 2 octaves, desaturated), 240 px tile, static, `soft-light`. Opacity: art panels 8 percent, closing glow 8, footer hills 12, dark card 14 (`overlay`), text zones 0.
- **Closing dusk glow:** layered `radial-gradient()`s on `::before`, no `filter: blur()`: periwinkle at 12% 70%, coral at 88% 65%, amber at 72% 90%, and a Linen ellipse at 50% 40% that clears the text zone. It frames the closing painting and stands in for it until the file exists.
- **Dark card mesh:** base Aubergine Ink `#1b0624`; mesh mid `#4a3a5c`; mesh bright `#6b5a86` rising from the bottom centre under the button; olive and dusk in the corners away from text; a darkening ellipse behind the text.
- **Footer video (V6, replaces the dusk-hills painting and the procedural hills):** owner-supplied files in `web/public/landing/footer/`: `meadow.mp4` (1920 x 1080, 1,193,372 bytes, about 1.2 MB), `meadow-poster.avif` (138,118 bytes) and `meadow-poster.webp` (103,652 bytes), downloaded from the footer spec URLs so the page makes no third-party requests. Loading: `preload="none"`; the poster `<picture>` shows first and the video starts only when the footer is within one viewport of the screen. It is paused, with the poster shown, under `prefers-reduced-motion`, under `html[data-motion="reduced"]` and by the footer pause button (WCAG 2.2.2). No grain on the footer.

## Layout

The marketing site is a single centred axis on Linen. Order: nav, centred art hero, commitment strip, problem trio, "how it works" intro, four zig-zag steps with the spotlight between steps 2 and 3, the dark CTA card, pricing, compare, FAQ, the closing art band and the footer. Loud (art) and quiet (plain Linen) sections alternate, except the steps and spotlight, which form one chapter joined by the connector line. Containers (owner, 2026-10-15): 1440 (`--c-wide`) for nav and footer, 1280 (`--c-main`) for the strip, trio, spotlight and pricing, 1120 (`--c-narrow`) for steps, dark card, FAQ and compare, 760 (`--c-copy`) for every heading stack. Only the hero painting, the closing band and the footer hills break the container. Grids: 12 columns at 1440 and 1024, 8 at 768, 4 at 390. Section intros are centred stacks (optional fact pill, H2, subline, one control) with 72 / 64 / 56 / 40 px to their content. The signed-in app uses the same canvas, cards and type with a 240 px sidebar, a header and Paper White panels; it has no art, no serif and no dark card.

## Glass everywhere (owner, 2026-10-23)

The owner's decision "Glassmorphism will be throughout website" supersedes every rule above that limits glass to surfaces over art, that keeps flat Linen sections solid, or that says the signed-in app has no glass. The rules:

- **Backdrop.** One fixed procedural valley haze (`.site-backdrop` in `web/app/globals.css`, rendered once in the root layout) sits behind every route: the valley's own hues (sky, haze, amber, meadow, lilac) as large soft radial glows on Linen. Paintings stay where they are and sit on top of it. Page wrappers that painted solid Linen (the `.lp` scope, layout shells) are transparent so the haze shows.
- **Surfaces become frosted glass.** `.glass-panel` (Glass Strong `rgb(255 255 255 / 0.78)`, blur 12 px below 768 and 20 px from 768, saturate 140 percent, 1 px Glass Edge, inner highlight plus the over-art shadow) for anything with text at 16 px or smaller or dense rows: app panels, sidebar, header, tab bar, sheets, menus, popovers, dialogs, command palette, plan cards, feature cards, forms, FAQ and compare blocks, blog cards. `.glass-soft` (Glass `0.64`) only for large type and for pills or chips that sit directly on art. The landing's existing `.lp .glass` and `FloatingCard` keep working and use the same tokens.
- **Stays solid.** Inputs (Mist), buttons (Espresso, Paper White inverse), chips and badges inside glass (Bone), the dark CTA card, tooltips (ink), the resume document preview (it is paper), the colophon's own video stage, and print output.
- **One blurred layer per surface.** Rows, list items and chips inside a glass panel are transparent or Bone; never glass on glass; at most about 8 glass surfaces in a viewport. Long lists get one glass panel, not glass rows (scroll performance on mid-range phones).
- **Fallbacks are mandatory** and already in the classes: no backdrop-filter gives Glass Fallback `0.94`; `prefers-reduced-transparency` gives solid Paper White; `forced-colors` gives Canvas; print gives white.
- **Contrast.** Text at 14 px or smaller sits only on `.glass-panel`. Text directly on the backdrop (page titles, section intros) keeps Ink and Graphite; the haze is light enough for Graphite at 7:1 or more.

### Synthex-inspired layer (owner, 2026-10-23)

The owner shared Dribbble "Synthex UI, Analytics SaaS Dashboard" (RonDesignLab) and chose: keep the Kairos palette and theme, take Synthex's layout and glass craft, switch the type to Urbanist, and adopt four patterns. This supersedes the Inter / Inter Tight type rules above.

- **Type.** Urbanist (Google Fonts, `--font-urbanist`) for UI, body, headings and figures; Instrument Serif keeps its four landing art lines. Weights: 300 only for large figures at 40 px and up, 400 for body and headings, 500 for labels, buttons and nav, 600 for the footer. Tabular figures on all numbers.
- **Milky glass.** Card radius 20 px; blur 24 px from 768 (14 px below), saturate 125 percent; Glass Edge at 0.55. Panels may nest one level as Bone or transparent blocks, never glass on glass.
- **Big figures and hatched charts.** Overview figures are large light numerals (Urbanist 300, 44 to 56 px, ink) over a small Deep Ash label. Charts: a dotted line (ink points, 1.5 px line) over a hatched area fill (1 px diagonal lines at 45 degrees, Stone at 45 percent), dashed hairline gridlines, and thin pill bars where a bar chart fits. Achromatic, real data only.
- **Floating stat tiles.** A small glass tile over a chart calls out one real figure (for example "3 drafts are waiting") with a close button; never an invented number.
- **Filter chips.** Pill dropdown chips above lists ("Status", "Board", "Date"), glass-soft on the backdrop, Bone when active, each opening a menu of the real values with counts. Superseded on 2026-10-29 by the glass filter bar below.

### Reference layer (owner, 2026-10-29)

The owner shared thirteen references (an AI-agency landing, a Framer SaaS template, a ticketing landing, a data-analytics landing, a payments landing over a painted meadow, a task dashboard over sky and hills, a fintech app site, two pricing cards, two profile pages, a counselling dashboard, a designer portfolio) and picked eight patterns. Every pattern below stays inside the rules above: Espresso is the only accent, the UI is achromatic, art hues never colour UI, Urbanist only, the glass rules hold, and nothing shows customer logos, testimonials, user counts or invented metrics.

**Not taken, by rule:** orange, blue, violet or teal buttons and glows; coloured or pill-highlighted words in headlines; logo clouds, testimonials, photos of people, "trusted by" lines; strikethrough discount prices; gradient rings, gradient borders and gradient CTA bases; percentages that are not real data; brand logos for the ATS boards (names in text with a neutral icon only).

**Marketing**

- **ATS hub.** A small figure: three Bone chips (Greenhouse, Lever, Ashby), each a neutral 16 px Phosphor light icon plus the name, wired by curved 1 px Stone connectors (dash 4 4) into a 56 px Paper White disc with the ring holding the Kairos mark in ink. Below it the existing line "We do not automate LinkedIn." Sits on `/how-it-works`; the landing strip uses the "ATS route" variant in "Landing v3". Below 768 the chips stack in one column and the connectors become straight vertical dashes. Idle motion: the dash offset drifts slowly along each connector toward the disc (one clock, paused off screen, none under reduced motion). `<figure>` with a `<figcaption>`; connectors `aria-hidden`.
- **Mini-UI cards.** (On the landing the trio is now one SAMPLE spreadsheet, see "Problem trio" in "Landing v3"; the stage vocabulary below lives on in the step and bento cards.) The problem trio's 96 px line icon zone becomes a 168 px stage (Bone, 12 px radius, inset in the card) holding a small SAMPLE snippet built from real UI primitives (status words, badges, a resume line, a send receipt), achromatic except the lime status dot, with the SAMPLE micro chip in its corner. The stage is `aria-hidden`; the card title and body carry the meaning. On fine pointers one micro-motion per stage on card hover (for example a cursor pressing a disabled Edit), 300 ms ease-out; none under reduced motion.
- **Pinned paper step cards.** On `/how-it-works` the step cards are paper: solid Paper White (paper is not glass), the ring plus the over-art shadow, 20 px radius, alternately rotated −1.5 and +1.2 degrees (±0.8 below 768), each with a 10 px ink pin (a disc with a 2 px Linen ring) at its top centre, joined by one dashed Stone connector. Hover on fine pointers settles the card to 0 degrees and lifts it 3 px ("settle like paper"), 300 ms ease-out. Rotation is static and stays under reduced motion; the hover settle does not.
- **Hero card stack.** The landing hero keeps its one Floating Sample Card on the left and gains up to two more strong-glass SAMPLE cards over the painting (a draft waiting for approval; a sent receipt), tilted −2 to +2 degrees, from 1024 only; below 1024 the hero keeps one card. No card covers the H1, the lead or the CTA, and none sits outside a calm sky or meadow zone.
- **Billing toggle saving.** The Quarterly segment carries a Bone micro chip "Save up to N%", N computed from `shared/src/plans.ts` (best quarterly saving against three monthly payments across paid plans, rounded down). Never hard-coded, never a strikethrough price.

**App**

- **Profile header.** `/profile` opens with a banner: a painting crop (the app's one art panel, owner 2026-10-29), 168 px tall (120 below 768), 20 px top radius, masked so it dissolves into the panel. An 88 px initials disc (Paper White, ink Urbanist 500, 4 px Linen ring) overlaps the banner's bottom-left by half its height, beside the name (`--t-h3`) and the email with a 16 px icon, and one quiet Edit action. Under it a stats row of real counts only (facts confirmed, facts waiting, resumes, applications sent), separated by vertical hairlines, numerals in the big-figure style at 32 to 40 px.
- **Details grid.** Contact fields and facts render as a grid (3 columns from 1024, 2 from 640, 1 below) of icon (20 px Phosphor light, `--icon`), Deep Ash caption label, ink value, and a state chip: "Confirmed" (Bone chip, lime dot with ink ring) or "Needs a fact" (hollow ink square). The chip carries the truth lock; nothing reads as confirmed unless the user confirmed it.
- **Match cards.** `/matches` is a card grid (2 columns from 1024, 1 below), one glass panel per card: role (`--t-h4`), company with board and location in Deep Ash, the fit badge ("Fit 82" with the lime dot when it passes the user's rules, a hollow square when it does not), up to three Bone reason chips plus a "+N" chip that expands the rest inline, and a footer with the posted date and the two actions (Queue as the Ghost button, Skip as the quiet button). No Espresso fill on cards: the page keeps at most one primary action.
- **Glass filter bar.** List filters live in one glass panel row: each filter (Status, Board, Date) is a labelled segment (Deep Ash caption over the ink value and a caret) separated by vertical hairlines, each opening the menu of real values with counts; a "Clear" quiet button appears when any filter is set. Below 640 the segments wrap two per row. Replaces the separate filter chips everywhere they were used.
- **Greeting header.** The overview's page title greets by first name and local time of day ("Good morning, Sam"), with the one-line status of the day beside or under it (the existing next-step sentence). Rendered after hydration so server and client never disagree; the route's metadata title stays "Overview".
- **Sign-in methods callout.** Settings gets one glass callout card listing Email and password, Google, Apple, GitHub and LinkedIn with their marks, each "Connected" (lime dot word) or a quiet Connect action, from the account's real linked accounts. Unlinking is offered only while another method stays linked.

### Landing v3 (owner, 2026-10-29)

The owner asked for a complete landing redesign from a second set of references (a fintech site over sky, a data-analytics landing with a dashboard hero and an integration hub, a ticketing landing with tilted step cards, a Framer SaaS template with pinned cards, a payments landing over a painted meadow, a task dashboard over hills). Owner choices: the Kairos app itself is the hero centrepiece; the warm dawn valley paintings and haze stay; a new section structure replaces the Ledger zig-zag; Instrument Serif keeps its lines. Everything in "Reference layer" above still holds. This supersedes the landing order in "Layout".

**Order.** Nav; hero (app mockup); ATS route strip; problem trio (one SAMPLE spreadsheet); three pinned step cards; feature bento (the resume suite); dark CTA card; pricing (raised recommended plan); two-column FAQ; closing band; footer. Removed from `/`: the five zig-zag steps, the spotlight and the compare table (the full compare stays on `/pricing`; the five steps stay on `/how-it-works`). Density budget per section is unchanged.

- **Hero app mockup.** Under the serif H1, lead and one Espresso CTA, a slice of the real Kairos app rises out of the valley painting: a strong-glass window (20 px radius, Glass Edge, over-art shadow, about 1040 px wide from 1280, 92 percent of the container from 768) whose bottom is cut off by the painting's meadow fade. Inside, built from the app's own primitives with SAMPLE data: a slim icon rail, the "Review queue" header with "3 drafts waiting", three draft rows (role and company, fit badge, status word) and a detail pane with two resume lines citing facts ("cites #03") and an Approve control drawn as the Ghost button (the page's Espresso stays the hero CTA). One SAMPLE chip on the window. The mockup is `role="img"` with an `aria-label` summarising it; nothing inside is focusable. Two tilted strong-glass SAMPLE cards float at its sides from 1024 (a fit card, a sent receipt). Below 768 the window shows a one-line header (title, "3 drafts waiting", the SAMPLE chip) and the three draft rows at full container width, and the side cards are hidden. Entrance: the window rises 24 px and fades in once (transform and opacity), none under reduced motion. The painting stays the LCP image. As built: the painting is anchored to the window's top edge so the sun sits just above it at every width, the door sits behind the frosted window (the sun and ridges in the V carry the composition), and between 1024 and 1399 the fit card drops below the rows instead of covering them. This supersedes the "Hero card stack" bullet in "Reference layer".
- **ATS route (landing strip, 2026-10-29).** Under the hero, centred in `--c-main`: a 15 px Deep Ash caption, then the 56 px Paper White disc with the Kairos mark in ink and one dashed 1 px Stone route running out of it through three Bone stops (Greenhouse, Lever, Ashby; 44 px pills, 17 to 18 px ink Inter 500 label, neutral 18 px Phosphor light browser icon, no brand logos), then the caption "We do not automate LinkedIn." A row from 768 (segments 40 to 112 px), one column below (the route runs down from the disc). Idle motion: the dashes drift outward from the disc, moving a gradient strip inside each clipped segment (transform only), one clock, paused off screen, none under reduced motion. `<figure>` with `<figcaption>`; segments `aria-hidden`. Only boards Kairos really covers are listed.
- **Problem trio (2026-10-29, resume suite PRD).** Label "The usual way", one H2, three pains of a job search done by hand: one resume for every job, applying blind, losing track. One visual: a single SAMPLE spreadsheet in one glass panel ("Job search": Company, Role, Resume, Fit, Status; five synthetic rows with the same `resume_final.pdf` on every row, a Bone "?" for every fit, and a status column of guesses and dashed blanks). Three 18 px ink pins with Linen numerals sit on the Resume, Fit and Status headers and match the 22 px pins of the three items (title at `--t-h4`, one line). From 1024 the intro and items take 5 of 12 columns on the left and the sheet 7 on the right; below 1024 intro, sheet, then the items (a row of three from 768). Role steps out below 640 and from 1024 to 1279. On fine pointers, hovering an item tints its column (colour only, no movement). The sheet is `role="img"` with an `aria-label`; the items carry the meaning. Replaces the three mini-UI cards.
- **Step cards.** Label "How it works", one H2, then three cards in a row from 1024 (one column below): each a glass panel, 20 px radius, hanging from a 10 px ink pin (2 px Linen ring) at its top centre and tilted −2, +1.5 and −1 degrees around it (`transform-origin` on the pin; half the tilt below 768). The middle card sits 40 px lower, so one dashed Stone thread through the three pins dips to it (an SVG behind the cards from 1024, drawn left to right on scroll; a vertical dashed line through the pins below 1024). One SAMPLE job (Data Engineer · Company 014) runs through all three stages: the fit gate passes it and skips two others; its own tailored copy ("Tailored copy", "Company 014 · from your Backend resume") with a resume line and the confirmed fact it cites; its receipt (approved, sent, confirmation page saved, one credit). Caption "Step 1" in Deep Ash micro plus one short line in ink. Scroll-driven entrance: each card swings from 2.5 times its tilt to its tilt as it enters (a registered `--swing` angle added to `rotate`). Hover on fine pointers settles the tilt to 0 and lifts 3 px. Reduced motion keeps the static tilt only. A quiet text link "See every step" to `/how-it-works`.
- **Feature bento (2026-10-29, the resume suite).** Label "What you get", one H2, then glass panels: from 1024 a tall card on the left (7 of 12, spanning two rows) and two stacked on the right; from 768 the tall card spans both columns over the other two; one column below. (1) Resumes for each kind of role: two base resumes and one job's saved copy as three fanned Paper White pages (abstract pill bars, never real type; footers "Data analyst", "Backend" with a Default badge, "Company 014" with a lock and "Sent") over a white template gallery of six thumbnails (Classic, Modern, Serif, Compact, Executive, Minimal) with an ink selection ring and PDF and DOCX chips. Hover spreads the fan, slides the ring to the next template and the front page changes layout with it. (2) A tracker that moves itself: a mini board (Drafting, Applied, and Interviewing from 1400) where the Company 014 card travels from Drafting to Applied as the card scrolls in and gains "Sent · moved by Kairos" with the lime dot; final state at rest, without view timelines and under reduced motion. (3) Review tuned to your level: "Reviewing as" with an Early, Mid, Senior, Lead switch over one suggestion (tag, priority, the struck old line, the new line with its fact chip); hover moves the level to Senior and the tag changes with it. Accent colours are not drawn (they would add hues to the page); templates differ by layout only. Every claim in this card set ships with R1 to R4 and is marked in `landing-copy.ts`.
- **Dark CTA card (2026-10-29).** Same surface, mesh, night painting and Inverse Button as "Dark CTA Card" above. From 1024 two columns: on the left a dark-glass pill with the word καιρός (`lang="el"`), the serif H2 start-aligned, the line in `--on-dark`, the Inverse Button and the dark-glass fact chip; on the right a dark-glass SAMPLE timeline card (16 px radius, Linen text only) of one application: 08:12 matched, 08:14 drafted, and "Now · Waiting for you" with a hollow Linen square, the lime dot on the two done rows. Below 1024 one centred column with the timeline under the button. The rows rise in one after another on scroll; none under reduced motion.
- **Pricing.** Plan cards are glass, four in a row from 1024 (two by two from 768); the recommended plan is raised 16 px from 1024 with the hover shadow and keeps its ink edge and "Recommended" pill. The billing toggle with its saving chip stays. A quiet link "Compare every plan" goes to `/pricing`.
- **FAQ.** Two columns from 1024: left the H2, one subline and a quiet "Contact us" link; right one glass panel of hairline-separated questions (native `details` or the existing accordion). One column below.

### Landing v3 mid-page chapter (owner, 2026-10-29)

The owner said "hero, footer, pricing, cta, and faq are fine" and asked for a complete redesign or upgrade of everything between the hero and the dark card, built to the awwwards, motion, ecc:motion-advanced and 3d-scroll-website bar, with Magic UI and Aceternity UI read as mechanism catalogues. Concept "Held" won the concept round (judges 139; runners-up The Signature Line 129, Schedule A 120, The Walk 106, Paper trail 99), with grafts from the runners-up listed below.

This replaces parts of "Landing v3" above: the "Step cards" and "Feature bento" bullets, and the middle of the Order line (ATS hub strip; problem trio; three tilted step cards; feature bento). On `/` it also replaces the "Mini-UI cards" pattern in "Reference layer" and the ATS hub idle drift. `/how-it-works` keeps the drift. Everything else in this file stands: palette, Urbanist, glass rules, density budget and truth rules.

**Point of view.** Kairos (καιρός) is the right moment, as against chronos, clock time. Other tools send on the clock. Kairos checks one application in front of you, stands it up and holds it until you press Approve. The visitor's press is the only real time shown anywhere on the page. The span tells four things in order: where it applies, what goes wrong with other tools (the clock), the three checks on one sheet that then waits (the signature), and what comes back after you approve (the clock runs again). The dark card then says "You choose it."

**Order** (the component names stay, the contents are rewritten): `Strip` (where it applies), `Entry01Reported` (what goes wrong), `EntrySteps` (the three checks, the signature), `EntryBento` (what you get), then `DarkCard`.

**One sample, everywhere.** All data is SAMPLE and synthetic, because the repo is public. The held application is the one open in the hero window: `hero.app.rows[0]` (Backend Engineer · Company 109 · Remote, Fit 86) and `hero.app.lines` ("Led the move of the payments API to an event queue." cites #03; "Wrote the on-call runbook the team still uses." cites #07). The new shared key `landingCopy.sample` holds the rest, so no section's data can drift from another's:

| Item | Value | Where it appears |
|---|---|---|
| Facts | Fact #03 · payments API; Fact #07 · on-call runbook | Chapter notes |
| Line with no fact | "Led a team of 12 engineers" | Problem panel (other tools send it); chapter (marked not saved) |
| Postings outside the rules | Night Auditor · Company 078 (Skipped · title); Sales Director · Company 107 (Skipped · location) | Problem panel (078 sent); chapter (both struck) |
| Only in the problem panel | Data Clerk · Company 212 | Problem panel |
| Only in the coda | the receipt, the replies and the credit rows of Company 109 | Coda panel |

#### 1. Where it applies (`Strip`)

- **Label:** Where it applies. **H2:** "Through the employer's own career page." **Subline:** "Kairos fills the Greenhouse, Lever or Ashby form with your details and the answers you approved." **Items:** the three board chips. **Visual:** the ATS hub figure. **Figcaption:** "We do not automate LinkedIn." **No CTA.**
- **Visual.** The existing ATS hub, geometry unchanged: three Bone chips (Greenhouse, Lever, Ashby, each with the neutral 16 px Phosphor light Browser icon), 1 px Stone dash-4-4 wires and the 56 px Paper White disc holding the Kairos mark. On `/` the figure drops its top caption, because the H2 says it, and the LinkedIn line becomes the `<figcaption>`. No glass, no painting.
- **Motion (Magic UI Animated Beam, rebuilt).** From 768 up, each wire gets a second path carrying one solid Charcoal 24 px dash (1.25 px, round caps). The dash travels from the Kairos disc out to the chip, because Kairos applies through the board. It moves by `stroke-dashoffset` from `-length` to `24px` over 1.6 s on `--ease-out`, then rests 0.8 s, so each wire runs a 2.4 s cycle, offset 0, 0.8 and 1.6 s on one clock. One dash is moving at any moment. This replaces the dash drift on those wires; a wire never runs both. Below 768 the straight rail keeps today's drift. Both run only under `html[data-motion="full"]` and the existing `data-live` observer, so they pause off screen. `stroke-dashoffset` on these three tiny paths is the one sanctioned non-transform property; the hub already animates it under the owner's 2026-10-29 approval. Reduced motion and scripts off: still dashed wires, no dash.
- **Layout.** 1440 and 1024: a centred `SectionIntro` in `--c-copy`, the 528 x 152 figure centred 48 px below, and the figcaption 16 px under it. 768: the same. 390: the intro, then the chips stacked on the vertical dashed rail with 16 px gaps and the disc 24 px below. Section spacing is the usual `lp-section` padding.
- **Glass in view:** 0, plus the nav.

#### 2. What goes wrong (`Entry01Reported`)

- **Pill:** Reported, not measured. **H2:** "What people report about auto-apply tools." **Subline:** "Each one is a check Kairos runs before anything is sent." **Items** (an ordered list with indices 001 to 003 in Deep Ash 14 px tabular, each an `lp-h4` title plus one `lp-body-sm` line): Poor matches, "Applications sent to jobs that do not fit."; Invented resumes, "Skills the person does not have."; No edit step, "A draft you cannot change." **No CTA.**
- **Visual: the clock rail.** One `.glass-panel` (20 px radius, 24 px padding; 16 px below 768), `aria-hidden`. Its header row reads "Sent today" (Ink 15 px 500) with the Bone SAMPLE chip. Inside is a vertical 1 px Stone rail, 12 px from the panel's inner left edge. It carries 4 px Stone tick hairlines every 24 px, which read as a ruler or clock face, with no times printed. Three Bone slips (8 px radius, 12 px 16 px padding, static tilts of −1, +0.8 and −0.5 deg) hang at even 120 px intervals (110 below 768), each with a 10 px ink pin on the rail:
  1. "Night Auditor · Company 078", then the hollow square and "Outside your rules".
  2. "Led a team of 12 engineers", with a 12 percent ink marker band under "12", then the hollow square and "No fact behind this".
  3. "Data Clerk · Company 212", with a dead "Edit" pill (Stone border, opacity 0.55), then the hollow square and "Sent before you read it".

  Slip text is 14 px Ink on Bone for the title and 12 px 500 for the status word. There is no lime anywhere in this panel. The slips are Bone because the Synthex layer allows one nested level inside glass, and paper inside glass would be two.
- **Motion (CSS scroll-driven, no island).** The rail draws top to bottom with the panel's view progress: `.lp-trace` is the existing `lp-draw` clip-path inset on `animation-timeline: view()`, range entry 10% to cover 50%. This is Aceternity Tracing Beam's line that extends with scroll, without the spring, the gradient or the dot. Each slip rises 16 px and fades in as it enters (`.lp-reveal`, `--i` 1 to 3), which is Magic UI Animated List's one-by-one arrival without the scale-from-zero spring. The marker band under "12" sweeps `scaleX` 0 to 1 from the left on its own view timeline, range cover 30% to cover 45%. This is Magic UI Highlighter's marker done as the en01 claim band, with no rough strokes and no colour. The panel itself does not move, so the blur never travels. Reduced motion, scripts off, or no support for `animation-timeline`: the rail is drawn, the slips are in place and the band is full.
- **Layout.** At 1440 (`--c-main` 1280) a two-column grid, `minmax(0,5fr) minmax(0,7fr)`, 64 px gap: the intro aligned start plus the items in the text column (about 507 px), and the panel in the other (about 709 x 440), top-aligned with the pill. At 1024 the same grid with a 48 px gap (367 / 513). At 768 one column: intro, items in a row of three (16 px gap), then the panel at full width. At 390: intro, items stacked 16 px apart, then the panel at full width, about 380 px tall.
- **Glass in view:** 1, plus the nav.

#### 3. The three checks: the signature (`EntrySteps`)

- **Pill:** How it works. **H2:** "Three checks before anything is sent." **Subline:** "The last check is yours: the application waits, untouched, until you approve it." **Items** (three captions in an ordered list, each a Deep Ash micro "Step n", one `lp-h3` line and one `lp-body-sm` line):
  1. "Jobs that break your rules are skipped." / "Role, location, salary and visa are hard rules, checked before any model runs."
  2. "Every resume line cites a fact you confirmed." / "A line with no confirmed fact behind it is not saved."
  3. "Sent only after you approve, with a receipt." / "Try it on the sample. Nothing is sent."

  **The one control** is the Ghost button "Approve sample" inside caption 3. "See every step" moves to the coda.
- **Visual: the stage.** A 24 px radius art panel with 8 percent grain and `--art-placeholder` behind the art, holding `step-2-truth-lock.png` (1536 x 1152). From 768 the panel is 4:3, the painting's own ratio, so nothing is cropped. Below 768 it is 3:4 with `object-position: 95% 50%`, keeping the desk, notes and pen. Over it is real DOM, placed in stage percentages so that each of the two geometry sets lands on the painted objects at every width. The whole stage is one `role="img"` with an `aria-label`, and nothing inside it is focusable.
  - **Sheet.** Paper White, 16 px radius, the ring plus `--sh-over-art`, 16 px padding (12 below 768). Standing, it sits at 34 percent of the stage width, with its bottom edge at y 77 percent and centred at x 62 percent, so it covers the painted resume while the painted pen stays visible below. Below 768: 58 percent wide, centred at x 43 percent, top at y 15 percent, bottom at y 77 percent. Content: the SAMPLE chip; "Backend Engineer" (15 px 500 Ink); "Company 109 · Remote" (13 px Deep Ash); the lime dot with "Fit 86 · passes your rules" (14 px tabular); the micro "Tailored resume"; the two cited lines at 14 px (12 below 768), each with a right-aligned Bone cite chip; the third line, "Led a team of 12 engineers", with an ink strike and below it the hollow square and "No fact behind this · not saved". A 1 px dashed Stone thread of 48 px (40 below 768) leaves the sheet's left edge and ends in a hollow square, reaching for a fact that is not there, towards the painted blowing slip. The foot row is a hairline, then the hollow square "Waiting for your approval" and a Ghost "Approve" span. After approval the foot reads the lime dot "Approved by you · 14:32" (the visitor's local time).
  - **Fact notes.** Two pinned paper notes laid over the painted notes: Paper White, 8 px radius, the ring plus `--sh-over-art`, a 10 px ink pin at the top centre, static tilts of −2 and +1.5 deg. Desktop: 16 percent of the stage wide, at x 82 to 98 / y 58 to 68 and x 83 to 99 / y 70 to 80. Each holds "Fact #03" (12 px 500), "payments API" (12 px Deep Ash) and the lime dot "Confirmed by you". Below 768 they are 88 px wide at x 74 to 99, showing only "Fact #03" and the lime dot "Confirmed".
  - **Threads.** One 1 px Charcoal quadratic per cited line, with round caps and a 12 px downward sag (8 px below 768). Each runs from the sheet's right edge at its chip to the note's pin. Each thread is its own small absolutely positioned SVG, sized from layout offsets, so it draws with clip-path.
  - **Skipped slips.** Two Paper White slips (8 px radius, ring plus over-art shadow, 22 percent of the stage wide; 46 percent below 768): "Night Auditor · Company 078" with a Deep Ash "Skipped · title", and "Sales Director · Company 107" with "Skipped · location". Their role lines are struck in ink. They rest set aside at the desk's front edge, left of the pen: desktop x 39 to 61, y 78 to 88, rotated −6 and −9 deg.

  The painting's own threads, cream notes and pen stay visible as the scene's echo. Every position is a starting value, to be tuned by up to 3 percent against a screenshot overlay.
- **Signature mechanism.** See "Signature moment" below.
- **Layout.**
  - 1440 (`--c-main` 1280): the centred intro, then the track, a 12-column grid. The stage is in columns 1 to 8 (845 x 634), `position: sticky` at `top: calc(var(--nav-h) + 24px)`, `align-self: start`, with `max-height: calc(100svh - var(--nav-h) - 48px)` and `aspect-ratio: 4/3`. The captions are in columns 9 to 12 with 32 px of start padding (about 380 px). Caption blocks have min-heights of 90svh, 90svh and 60svh, with their content vertically centred.
  - 1024 to 1279: stage in 7 of 12 columns (531 x 398), captions in 5.
  - 768 to 1023: one column. The stage, 4:3 at `min(100%, 640px)`, is visually first (sticky at `nav-h + 16px`), and the caption blocks (min-heights 60svh, 60svh, 45svh) scroll in the band below it.
  - 390: one column. The stage is 3:4 at the full container width, with height capped at 56svh (width follows), sticky at `nav-h + 8px`. Captions as at 768, with the line at 26 px.
  - DOM order at every width: intro, captions (with the button), stage. The stage is placed visually by the grid, and its sticky item has `align-self: start`. The track has no overflow clip and no transform on any ancestor.
  - Short viewports, `(max-height: 640px)` (this also covers 200 percent zoom): not sticky. The complete final sheet sits above the captions, blocks have natural height and nothing arms.
- **Glass in view:** 0, plus the nav. The captions sit on the haze in Ink and Graphite, and the sheet is paper.

#### 4. What you get (`EntryBento`)

- **Pill:** What you get. **H2:** "Everything that went out, and what came back." **Subline:** "The same sample application, after you approve it." **Items:** the three existing `bento.cards` (A receipt for every send; Replies, sorted; Credits only for sends that land), with their G3 "(in beta)" lines until G3 passes. Each item has a 10 px ink pin as its bullet, matching the panel's stations. **CTA:** the quiet link "See every step" to `/how-it-works`. On hover and focus-visible its 16 px Phosphor light arrow travels 4 px; the underline stays at rest.
- **Visual: the rail again.** One `.glass-panel` (20 px radius, 24 px padding; 16 below 768), `aria-hidden`, with the header "Backend Engineer · Company 109" and the SAMPLE chip. Inside, a 1.25 px Charcoal rail (ink this time, with no ticks) joins three stations. Each station has a 10 px pin, a label row and one Bone block (8 px radius, 12 px 16 px padding):
  1. Label: lime dot, "Approved by you", and " · {time}" once the visitor has approved. Block "Receipt": Form · Employer's page; Answers · 7 · approved by you; Resume · Lines you approved; then the lime dot "Confirmation page saved".
  2. Label: "Replies, sorted". Block: two 44 px rows, in final DOM order: "Are you free on Thursday?" with the lime dot "Interview"; "Thank you for applying" with the hollow square "Other".
  3. Label: "Credits". Block: Credit · −1 · charged once; then "A failed submit · 0 credits" in Deep Ash.

  Rows are 14 px Ink, labels 12 px Deep Ash on Bone (6.0:1).
- **Motion.**
  - The rail draws with scroll (`.lp-trace`, Tracing Beam idea), and the three stations rise in with `.lp-reveal` (`--i` 1 to 3).
  - The replies block plays Magic UI Animated List once it is 50 percent in view. The engine's `Reveal` writes `data-post` as pending, then live. The list starts translated up one row with both rows hidden. "Other" fades in at the top (0 to 300 ms). At 700 ms the list slides down one 44 px row (400 ms, `--ease-out`) while "Interview" fades in above it. The newest reply lands on top: sorting is shown, not stated. Transform and opacity only, no spring, no scale, no layout animation.
  - The approved time is a tiny client read of the existing ledger store.
  - Reduced motion and scripts off: the rail is drawn, both rows are in order and nothing moves.
- **Layout.** At 1440 a grid `minmax(0,5fr) minmax(0,7fr)` with a 64 px gap: text left (intro aligned start, items, link) and the panel right (about 709 px wide, about 600 tall). At 1024 a 48 px gap. At 768 and 390 one column: intro, items, link, then the panel at full width. The dark card follows at the usual section gap.
- **Glass in view:** 1, plus the nav.

**Glass budget across the span:** at most two panels plus the nav in any viewport (two sections meeting). There is no glass on glass, and no backdrop-filter element moves or sits under a transform.

#### Signature moment: how it works

1. **Engine.** `ScrollStage`, from `components/landing/motion/`, wraps the track. It owns one motion `useScroll({ target: track, offset: ["start 0.1", "end end"] })`. It writes `data-armed`, `data-active="0|1|2"` and `data-reached="0 1 2"`, a space-separated list matched with `~=`, onto the track element with `setAttribute`, only when a value changes and never through React state. Steps come from an IntersectionObserver on the three caption blocks (`[data-step]`), using a centre band (rootMargin `-45% 0px -45% 0px` from 1024) or a lower band below the stacked stage (`-78% 0px -16% 0px`). A block that has passed above the band also counts as reached, so a fast flick cannot skip a beat. This is Aceternity Sticky Scroll Reveal's active index without per-frame state.
2. **The rise (scrubbed: the only per-frame work).** The sheet's motion.div binds `useTransform(progress, [0, 0.18], ...)` to four values: `rotateX` 72 to 0 deg, `rotateZ` 18 to 0 deg, `scale` 0.66 to 1, and `x` 12% to 0%. It has `transform-origin: 50% 100%` under a 1100 px perspective (origin 60% 20%) on the stage's overlay layer. At progress 0 the sheet lies on the painted desk over the painted page; the painted page's top edge sits right of its bottom edge, so the Z turn is clockwise. Tune the sign and values against a screenshot. By 18 percent it stands. This is Container Scroll Animation's `rotate [20, 0]` with the angle widened to fit the painting, and without the 1.05 overshoot scale or the header translate. No `useSpring`, because Lenis supplies the smoothing. `will-change: transform` is set only while the track carries `data-live` and progress is under 0.2, so the resting sheet rasterises crisp text.
3. **The beats (discrete, time-based CSS transitions under `[data-armed]`, `--ease-out`).**
   - `data-reached~="0"` (fit gate): slip strikes draw with `clip-path: inset(0 100% 0 0)` to `inset(0)` (360 ms, the second 120 ms later); their status words fade in; at 480 ms both slips slide from under the sheet to their set-aside rest (about −96 px, +48 px; 400 ms); at 600 ms the sheet's fit line rises 8 px and fades in (300 ms).
   - `~="1"` (truth lock): line 1 writes by clip-path (400 ms), chip #03 appears at 400 ms, note #03 rises 8 px at 300 ms, thread 1 draws by clip-path at 500 ms (400 ms); line 2, chip #07, note #07 and thread 2 follow at 500, 900, 800 and 1000 ms; line 3 writes at 1100 ms, its strike draws at 1600 ms (360 ms) and the line settles to Deep Ash; the dashed thread draws outward at 1700 ms (300 ms); the square and "No fact behind this · not saved" fade in at 2000 ms.
   - `~="2"` (approval): the foot row rises 8 px and fades in (300 ms).
   - Captions: the active line is Ink and the others Deep Ash (`--dur-colour`); all Ink when not armed.
4. **The hold and the press.** Nothing scroll-driven happens after step 3. About 20svh, roughly 8 percent of the track, is left before the stage releases. The Ghost "Approve sample" in caption 3 (44 px, Paper White with the 1 px Stone border; Espresso stays on the hero CTA) is Aceternity Stateful Button rebuilt:
   - **idle:** "Approve sample".
   - **pending:** 600 ms, label "Approving", `aria-busy`, a 1 px ink hairline inside the pill's bottom growing `scaleX` 0 to 1 (0 ms under reduced motion).
   - **done:** the lime dot plus "Approved", `aria-disabled="true"`, focus kept.

   On done it calls `ledgerStore.approve(new Date().toISOString())`, the existing store. The sheet's foot swaps to `<Stamp>` "Approved by you · {formatTime}" (`lp-sign`, 500 ms), and the on-sheet Approve span fades out. The coda's first station and the closing band's existing `ApprovedLine` ("You approved the sample at {time}. Every real application waits the same way.") update from the same store. A polite live region says "Approved. Sample receipt updated. Nothing was sent." Approval persists for the session (sessionStorage), so a reload shows the done state. Scroll never triggers any of this.
5. **States.**

| State | Stage | Captions | Button |
|---|---|---|---|
| Full motion, tall viewport | rise scrubbed, beats by step | active Ink, others Deep Ash | works, 600 ms pending |
| Reduced (`html[data-motion="reduced"]`, or the media query unless Full was chosen) | final frame, standing; `transform: none !important` beats motion's inline style | all Ink | works, states instant |
| Scripts off | final frame from the server HTML (start states exist only under `[data-armed]`, which only the island writes); sticky still works in CSS | all Ink | hidden (`data-requires-js`) |
| Short viewport (max-height 640px) or 200 percent zoom | not sticky, final frame above the captions | all Ink | works |

   The final frame is the sheet standing; slips struck and set aside; the fit line; lines 1 and 2 with chips, notes and threads; line 3 struck with its dashed thread, square and status; and the foot reading "Waiting for your approval", or the signature once approved.
6. **Performance.**
   - One AVIF painting, about 90 KB at 845 w, lazy, with sizes `(min-width: 1280px) 845px, (min-width: 1024px) 50vw, (min-width: 768px) 640px, 100vw`. The hero stays the only eager image and the LCP.
   - One scroll listener, motion's, which can hand transform to ScrollTimeline. Four transform values on one element. Attribute writes at most three times per pass.
   - Thread geometry is measured from `offsetLeft`/`offsetTop` sums, which ignore transforms, on mount, on `ResizeObserver(stage)` and on `document.fonts.ready`.
   - No blur, filter, box-shadow or layout animation. CLS 0, because the stage has a fixed aspect and the overlay is absolute.
   - Target: compositor frames at 60 fps at 390 x 844 under 4x CPU throttle.

**Lenis.** Lenis smooth scroll runs on `/` only, through `SmoothScroll` (lerp 0.1, wheel only, never touch). It is off under reduced motion and stopped while `html[data-dialog]` is set. `position: sticky` and `useScroll` read native scroll, so behaviour is identical with Lenis off.

**Accessibility.**
- Each section is labelled by its H2.
- The panels and the stage are decorative or `role="img"`, and every fact they show is also in the visible text column.
- Status words always carry the dot or the square beside them.
- Text at 12 to 14 px sits only on Paper, Bone or strong glass.
- Focus ring: 2 px ink at 3 px. Hit areas: 44 px.
- `forced-colors`: CanvasText borders on the sheet, notes, slips, stage and Bone blocks, and threads stroked CanvasText.
- `prefers-reduced-transparency`: panels go solid Paper (existing class fallbacks).

**Truth check (docs/01-prd.md; resume-suite PRD R1 to R4 not built).**
- Shown claims, each built:
  - Greenhouse, Lever and Ashby through the employer's form, never LinkedIn.
  - Hard rules before any model (fit gate).
  - Every line cites a confirmed fact, and an uncited line is not saved but listed in the editor (truth lock).
  - Nothing is sent until approval.
  - The receipt keeps form, answers, resume lines and confirmation (extension, "(in beta)" until G3).
  - Replies filed to the application as interview or other (forwarding address, "(in beta)").
  - One credit per submission, and a failed submit costs nothing.
- Not shown or promised: named base resumes or versions, file import, templates or DOCX, level-calibrated review, the headline generator, the tracker, interviews, contacts and insights. There are no counts, logos, testimonials or metrics, and no times except the visitor's own press. The problem rail prints no times, and the panel is labelled "Reported, not measured".

**Rule breaks from the judging, and their fixes.**
- Fragment H2 "Applies through employer career pages on": now a real label, H2 and subline.
- "Other tools send by the clock." stated competitor behaviour as fact: the H2 is now the existing "What people report about auto-apply tools.", and "the clock" lives only in the unlabelled ticks.
- Fixed sample clock times: removed. The only time is the visitor's.
- Paper slips inside glass: the problem and coda blocks are Bone, one nested level.
- Two loops on one wire: the pulse replaces the drift on the curves, and the rail keeps only the drift.
- 24 percent dead hold: now about 8 percent, with a real press as the payoff.
- Decorative Approve span: a real click-only button, in reading order, with a live region.
- Thin fit-gate beat: ink strikes, then set aside.
- No negative proof on stage: the struck uncited line with its dashed thread to a hollow square.
- Half-written lines on a paused scroll: the beats are discrete time-based states, and only the rise is scrubbed.
- Two CTAs in one section: "See every step" moved to the coda.
- Coda thin on replies: the sorted list with the interview landing on top.
- Short laptops and 200 percent zoom: the non-sticky fallback.
- Data drift: `landingCopy.sample`.
- Matching the pose to the painting: two fixed-aspect geometry sets in stage percentages, with a 3 percent tuning allowance.
- Offset-path Safari risk: `stroke-dashoffset` on the existing wires.
- Sticky inside a clip: the track and its ancestors carry no overflow clip or transform; only the stage panel clips.

**Library mechanisms, by section.**
- Strip: Magic UI Animated Beam (pulse along a path).
- Problem: Aceternity Tracing Beam (the rail drawn by scroll); Magic UI Animated List (one-by-one arrival); Magic UI Highlighter (the marker band).
- Chapter: Aceternity Sticky Scroll Reveal (the stage and the active index); Container Scroll Animation (the rise); Tracing Beam (threads drawn); Magic UI Animated Beam (a path between two measured refs, recomputed by ResizeObserver, used for the threads); Highlighter rebuilt as an ink strike; Aceternity Stateful Button (Approve).
- Coda: Tracing Beam; Animated List (newest on top); Magic UI Interactive Hover Button (the arrow travel only).
- All are rebuilt in-house with motion/react and CSS on Kairos tokens. Neither library is a dependency.

**Not taken, by rule.**
- Every glow and gradient: Animated Beam's gradient head, Tracing Beam's coloured gradient and travelling dot, Border Beam, Shine, Spotlight and the rest.
- Springs and overshoot: Tracing Beam's `useSpring`, Animated List's 350/40 spring and scale-from-zero, Container Scroll's 1.05 scale, and the stamp press of 1.15 to 1.
- Sticky Scroll Reveal's 0.3 opacity on inactive text (fails contrast; Deep Ash instead) and its hidden-below-lg stage (the stage stays on phones).
- Highlighter's rough-notation dependency and sketch strokes.
- Stateful Button's spinner, green check and layoutId; Interactive Hover Button's 100x dot fill and text swap.
- Text Generate, Text Reveal and word-by-word scrubbed type: half-states and a low-contrast duplicate.
- The Compare slider (Paper trail): a second interactive control in the span, and it doubles the text.
- Lens: the threads already zoom into the citation.
- 3D card tilt: pointer tilt under backdrop blur costs frames.
- Dot and grid patterns: rails and grain are the only texture.
- Marquee, logo clouds, number tickers, stats, testimonials and device mockups.
- From the runners-up:
  - The Walk's four-painting walk: horizons do not match, about 480svh of scroll, and the footbridge painting would repeat just before pricing.
  - Paper trail's approval and stamp triggered by scroll: approval is the visitor's act.
  - The Signature Line's struck complaint titles: they read as "never happens".
  - Schedule A's numbered clauses: index collisions, and micro is reserved for chips and indices.
  - Dropping the uncited line off the sheet: the product's editor keeps listing it, so it stays struck.
  - Held's 4 px float during the hold: a third loop, and the threads would detach.
  - Parallax inside the stage: it would misalign the DOM notes from the painted ones.
- WebGL, canvas and frame sequences: none. The hero painting stays the LCP and the only eager image.

## Inner pages (2026-10-23)

Every route other than `/` follows the landing's system at a quieter scale. The landing keeps the one signature (the ledger story, the spotlight, the dark card); inner pages get the same craft in type, art and layout, not new spectacle.

**Marketing shell.** `(landing)`, `(public)` and `(legal)` all render in `LandingShell` (`web/components/landing/landing-shell.tsx`): the `.lp` scope, the landing Navbar (the current page's link is underlined, `aria-current="page"`) and the Colophon footer. Inside it, build with the `.lp` primitives (`lp-wrap--{main,narrow,copy}`, `lp-section`, `SectionIntro`, `lp-h2`, `lp-h3`, `lp-h4`, `lp-lead`, `lp-body`, `lp-caption`, `lp-micro`, `lp-pill`, `lp-chip`, `lp-card`, `lp-btn` and its modifiers, `glass`, `FloatingCard`, `lp-dot`, `lp-link`) instead of re-creating them in Tailwind. Page-specific CSS lives next to the page's component, scoped under `.lp`.

**Inner-page hero.** `PageHero` (`web/components/marketing/page-hero.tsx`): an optional fact pill (Bone, since it sits on Linen above the art), the h1 in Inter Tight 400 at 40 / 52 / 60 / 72 px (tracking −0.04em, never the serif), one lead line, at most one Espresso CTA, then the page's painting as a full-bleed band (260 / 360 / 420 / 480 px) that dissolves into Linen above and below. Up to two strong-glass FloatingCards may sit over the band (synthetic names, SAMPLE chip).

| Route | Painting (`/landing/art/`) | Why it fits |
|-------|-----------------------------|-------------|
| `/how-it-works` | `step-1-fit-gate.png` | The gate on the path: the first step |
| `/pricing` | `scene-b-footbridge.png` | The bridge you cross when you approve; the Pro card already uses it |
| `/about` | `scene-c-noon-meadow.png` | The stamp on the stone: an application you would sign |
| `/careers` | `footer-dusk-hills-2880x840.png` | Open horizon, a wide band crop |
| `/contact` | `step-4-replies.png` | The mailbox |
| `/blog`, `/blog/*` | Each post's own painting (`web/content/blog-meta.ts`) | No band: the paintings sit on the cover, the cards and the post's hero (see Blog below) |
| `/terms`, `/privacy`, `/cookies` | `footer-dusk-hills-2880x840.png` | Open horizon; its sky fades to Linen. A short band (150 / 190 / 230 / 260 px) so the text stays near the fold (owner reference, 2026-11-05) |
| `/login`, `/sign-up`, other auth | `scene-a-dawn-valley-portrait.png` | Portrait crop for the auth side panel |
| 404 | `/landing/footer/meadow.mp4` | The 404 is a standalone full-viewport scene on the footer's meadow video (poster under reduced motion), with no LandingShell, nav or footer. Geist Mono 600 sets the numerals and the message (owner reference, 2026-10-30), and the Kairos lockup is the only link. |

The error page (`error.tsx`) carries no painting. Legal pages (owner reference, 2026-11-05) use the short band above, then a two-column reading layout on `--c-narrow` with no card: a sticky Terms, Privacy, Cookies switch and contents list (the sidebar nav item: 8 px radius, Bone fill on the current section), and the long text directly on the haze. The 404 is the exception described in the table: a standalone scene on the footer's meadow video.

**Blog (owner references, 2026-11-05, spec D15).** Urbanist only. Each post has its own painting, chosen for its object, in `web/content/blog-meta.ts`, which holds no article text so client code can import it. `/blog`, on `--c-main`: breadcrumbs, h1 and lead; the newest post as a large painted cover beside a "Latest" list of the next four with tight-cropped thumbnails; a hairline; "All posts" with a search field (title, summary, category) and glass image cards; the newsletter card (`#newsletter`); the closing band. Text on a painting sits on a Charcoal scrim that passes 4.5:1 for Linen text even over pure white, with a masked blur over the painting; the chip on it is solid Paper White, never glass on glass. A post: a centred h1 and meta row, then three columns from 1200 px with hairlines between and no card: a sticky About column, the article with its painting and a pull quote copied exactly from the post, and the sticky `BlogSidebar`. From 900 to 1199 the article and sidebar; below 900 one column, article first. After the article: share row, "Written by the Kairos team" with the Catch mark, two related image cards, then the dark band. Cards lift 3 px (`.lp-lift`) and their image zooms to 1.03 on hover, on transform only and only under `html[data-motion="full"]`.

**Closing.** Pages that ask for sign-up (`/how-it-works`, `/pricing`, `/about`, `/careers`, `/blog`) end with the landing's closing band (`Entry10Start`), which keeps its serif line; it is the same element everywhere, not a new serif line. Legal pages and `/contact` end at the footer; blog posts end with the one dark CTA band (D8); the 404 has no shell at all (owner reference, 2026-10-30). On `/blog` and blog posts the band's line is set in Urbanist, not the serif (owner, D15).

**Density.** The landing budget holds per section (label of 1 to 3 words, headline of at most 8 words, one subline of at most 20 words, at most 3 short items, one visual, one CTA). Legal text and blog posts are exempt: they are long-form reading with a 66ch measure, 17 to 18 px body and 1.6 leading, in the centre column of the post layout and in the text column of the legal layout.

**Auth.** Split layout from 1024: the form column on Linen (form max 400 px) and the portrait painting in a 24 px-radius panel inset 16 px from the viewport edge, with one strong-glass card stating a true product rule. Below 1024 the painting is a short band above the form or is dropped; the form is never pushed below the fold on a 390 by 844 phone.

**App.** The signed-in app uses the App Shell and the shared primitives: `Panel` and `DataRow` (`components/shared/panel.tsx`), `StatusWord` and `APPLICATION_STATUS` (`components/shared/status.tsx`), `Badge`, `EmptyState` (see Empty states below), `Skeleton`, `PageTitle`, `Field`, `Button` and `ButtonLink`, plus `components/ui` (shadcn, Duna-themed) for dialogs, tabs, selects and tables. No serif and no ambient motion: colour changes over 300 ms ease-out only. One exception for glass and art (owner, 2026-10-23: "our website frosted glassmorphism theme"): the desktop sidebar is a frosted glass panel (`.glass-panel` in globals.css) over the site-wide valley haze, with no image (owner, 2026-10-23: the reference sidebar has none). Its measurements follow the owner's "slukh" reference: 260 px expanded, 76 px rail, 16 px padding, 40 px logo row, 44 px items with 4 px gaps, 12 px item padding, 20 px icons; no search row (Cmd or Ctrl K opens the page jumper); the collapse toggle is a 28 px disc on the panel's right edge under the logo. Content panels stay solid Paper White on Linen. Every list has a designed empty state, a skeleton that matches the loaded layout, and an inline error with a retry. Phones get a real navigation (the sidebar is desktop only).

**Empty states (owner reference, 2026-11-05, spec D16).** One component, `EmptyState` (`components/shared/empty-state.tsx`). Boxed: centred on Bone, square corners, framed by four 1 px dashed Stone guide lines (5 on, 5 off) that run 12 px past each corner and fade, clipped so they never add sideways scroll. `flat`: centred with no frame, for use inside a Panel. The title is a paragraph in Deep Ash with one phrase in Ink. A page-level empty state with a next action uses the Espresso button. The optional fan is three real links to blog posts (never decorative, never invented), each a painting fading into a Paper White card with the title clamped; the centre card is larger and on top, the side cards turn 10 degrees about their bottom edge. It appears on Matches, Preferences, Queue, Applications and blog no-results only. Under 600 px of box width it becomes a plain list of rows, because turned titles are not readable there. In the app the fan is static: hover or focus only brings a card to the front. Straighten on hover exists only under `.lp` with `html[data-motion="full"]`. No entrance animation. The extension side panel and the 404 keep their own screens.

**Extension side panel.** `extension/sidepanel.html` follows the App rules: light only, Linen canvas, Paper White rows with the 1 px ring, Urbanist (bundled; a panel page cannot load the site's fonts), Espresso on Send and a ghost button on Review, the hollow square for in progress and the lime dot with its word for done, Error Red words for failures. No art, glass or serif. It has to work at 320 px. Every state has its own screen: loading, not connected, empty, load error, queue, sending, review, submitted, failed, could not confirm, could not record. Tokens are copied by hand because the panel cannot import `globals.css`; change them together.

## Agent Prompt Guide

primary action: #160f0c (filled action)
Create a Primary Action Button: #160f0c background, #ffffff label in Inter 500, 9999px radius, 56px tall with 28px side padding in the hero, 44px with 20px padding in the nav. Use this filled treatment for every main CTA and for nothing else.

Create a Glass Surface (anything floating over art): background `rgb(255 255 255 / 0.64)` (`0.78` for text at 14px or smaller and dense rows), `backdrop-filter: blur(20px) saturate(140%)` (12px below 768px wide), `border: 1px solid rgb(255 255 255 / 0.60)`, `box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.70), 0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.10)`, radius 16 (cards), 24 (panels) or 9999 (pills). Neutral white only, no art hues, no lime fill. Never on flat Linen sections. Add the three fallbacks (`@supports not`, `prefers-reduced-transparency`, `forced-colors`).

## Quick Color Reference
- background: #f7f7f5 (Linen)
- surface: #ffffff (Paper White)
- nested surface: #edece7 (Bone)
- input: #eeeeee (Mist)
- text primary and headings: #1b0624 (Aubergine Ink)
- text body: #444444 (Graphite)
- text muted: #5e5566
- icons: #292421 (Charcoal)
- divider: #898683 (Stone, never text)
- primary action: #160f0c (Espresso, buttons only)
- status dot: #7fee64 (8 px, 1 px ink ring, beside its word)
- light glass: rgb(255 255 255 / 0.64), strong glass: rgb(255 255 255 / 0.78), edge rgb(255 255 255 / 0.60), blur 20px (16px nav and dark, 12px below 768px)
- nav glass: rgb(247 247 245 / 0.72); dark glass (dark card only): rgb(27 6 36 / 0.42)

## 3-5 Example Component Prompts

**1. Hero Section**: Full-bleed `scene-a-dawn-valley.png` behind a Linen #f7f7f5 page, masked to fade in behind the lower headline and dissolve into Linen at the bottom. Text scrim `radial-gradient(60% 45% at 50% 30%, rgb(247 247 245 / 0.85), transparent 70%)`. Centred stack, max width 760px: status pill (32px tall, light glass: `rgb(255 255 255 / 0.64)`, `backdrop-filter: blur(20px) saturate(140%)`, 1px `rgb(255 255 255 / 0.60)` border, `inset 0 1px 0 rgb(255 255 255 / 0.70)`, 8px #7fee64 dot with a 1px #1b0624 ring, "25 free applications" in Inter 500 14px #1b0624); 24px below, H1 "Job applications you would sign." in Instrument Serif 400, 80px, line height 1.02, -0.015em, #1b0624, two lines; 20px below, a 17-word subline in Inter 400 20px #444444, measure 560px; 28px below, one 56px #160f0c pill with a white Inter 500 16px label. One floating card in the left third over the meadow (keep soft peach-to-sage colour variation behind it): strong glass `rgb(255 255 255 / 0.78)`, `backdrop-filter: blur(20px) saturate(140%)`, 1px `rgb(255 255 255 / 0.60)` border, 16px radius, `inset 0 1px 0 rgb(255 255 255 / 0.70), 0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.10)`, 16px padding, SAMPLE chip (#edece7 pill) top right, line 1 "Software Engineer · Company 014" in Inter 500 15px #1b0624, line 2 a lime dot then "Fit 82 · passes your rules" in 14px #1b0624 tabular.

**2. Zig-zag Step Row**: 960px container, two 456px columns with a 48px gutter. Left: 4:3 art panel, 24px radius, `step-1-fit-gate.png` clipped by the radius; inside it a strong-glass sample card (`rgb(255 255 255 / 0.78)`, `blur(20px) saturate(140%)`, 1px `rgb(255 255 255 / 0.60)` border) at 72 percent width, 16px radius, highlight plus the over-art shadow, SAMPLE chip, four rows of 16px Inter. Right, inset 56px and vertically centred: a 32px #ffffff circle with a 1px #1b0624 ring and a 14px tabular "1"; 16px below, H3 in Inter Tight 400 32px, -0.025em, #1b0624; 16px below, two lines of Inter 400 18px #444444. A 1.25px #292421 line with round caps leaves the panel's bottom centre toward the next step.

**3. Dark CTA Card**: 960 by 380, 24px radius, base #1b0624. On `::before`: radial #6b5a86 rising from 50% 115%, #4a3a5c around it, olive and dusk in the far corners, a darkening ellipse at 50% 40% behind the text. On `::after`: the grain tile at 14 percent, overlay. Centred: two-line serif H2 in Instrument Serif 400 52px, line height 1.08, #f7f7f5; 16px below, one line in Inter 400 18px #c9bfcf; 32px below, a 56px #ffffff pill with a #160f0c Inter 500 16px label (solid, never glass). Optional fact chip beside it: dark glass `rgb(27 6 36 / 0.42)`, `blur(16px)`, 1px `rgb(255 255 255 / 0.14)` border, pill radius, Inter 500 14px #f7f7f5. No shadow.

**4. Plan Card Row**: 1120px container. Above it a 24px-radius art banner (dawn valley crop, Linen scrim on the left) with the H2 left and a light-glass segmented toggle right (active segment a #ffffff pill with the ring, Inter 500 15px #1b0624). Four equal columns, 16px gap. Each card #ffffff on #f7f7f5, 24px radius, `inset 0 0 0 1px rgb(0 0 0 / 0.05)`, 8px padding, no shadow; inside, a #edece7 panel with a 16px radius and 20px padding: plan name in Inter 500 24px #1b0624, tagline 16px #444444, price in Inter Tight 400 72px, -0.045em, tabular, #1b0624, read from `plans.ts`, period in Inter 16px #5e5566, the allowance line, a full-width outlined pill (#ffffff fill, 1px #898683 border) and a 14px #5e5566 caption. Below the panel "What's included" and four features with 20px light round checks. The highlighted plan's panel is the footbridge painting under strong frost (`rgb(255 255 255 / 0.78)`, blur 20px) with a light-glass "Recommended" pill on its clear top-right corner and the one 52px #160f0c pill.

**5. App Applications Panel**: #f7f7f5 canvas, 240px sidebar with the active item on #edece7 with an 8px radius. In the main area a #ffffff panel, 16px radius, the ring, 24px padding, title in Inter 500 24px #1b0624. Rows separated by Stone hairlines at 40 percent, at least 56px tall: company in Inter 500 16px #1b0624, role and date in Inter 400 14px #5e5566, status at the row end as a word: "Submitted" in #1b0624 with the lime dot, "Needs review" in #8a5a00, "Failed" in #a3261c. No paintings, no serif.

## Motion & Transition Philosophy

Motion is soft, ambient and never carries information. In the app it is utility only: colour, background and border changes over 300 ms ease-out, nothing moves. On the marketing site the vocabulary is small: cards over art float between -4 and +4 px over 7 s, offset so they never move together; art layers parallax up to 48 px at 1024 and wider; section intros and cards rise 16 px and fade in over 600 ms once, with a 70 ms stagger; the step connector draws as the visitor scrolls; the closing glow and dark card mesh drift up to 4 percent over 48 s; the approve card writes its signature line in over 500 ms. Easing tokens: `--ease-out cubic-bezier(0.22, 1, 0.36, 1)` for arrivals, `--ease-in-out cubic-bezier(0.45, 0, 0.55, 1)` for loops, `--ease-in cubic-bezier(0.55, 0, 1, 0.45)` for exits. No springs, no overshoot, transform and opacity only, at most two looping groups in view, loops paused off-screen. Every move has a reduced-motion fallback (the final state at frame 0), and the footer Motion control turns the loops off.

## The Valley Metaphor

The page is one day in one valley. It opens at dawn on a path leading to a door, crosses the morning and noon through a gate, a writing table, a footbridge and a post box, and ends at dusk with the same door standing open. Kairos is Greek for the right moment, and the visitor scrolls toward it. Everything around the painting behaves like a document worth signing: plain, exact, flat, in ink on linen. When in doubt, ask: "Would this look right as a printed agreement with one painting on its cover?" That rules out glowing text, coloured controls, gradient borders, stock photos, 3D renders, and any number that is not true.

## Similar Brands

- **Duna** (duna.com): the primary style; a single painted landscape over a quiet, achromatic editorial page, Espresso pills and hairline elevation
- **Cora** (cora.computer): painted sky with a light display serif and floating white UI; the source of the serif's role
- **Arva** (arva.com): bone-toned editorial canvas with a refined serif and generous document rhythm
- **Mercury** (mercury.com): a cinematic landscape hero over calm product UI, in a darker and colder register
- **Reworkd** (reworkd.ai): soft daylight fields with white product cards floating over them

## Quick Start

### CSS Custom Properties

```css
:root {
  color-scheme: light;

  /* Colors */
  --canvas: #f7f7f5;        /* Linen */
  --surface: #ffffff;       /* Paper White */
  --sunk: #edece7;          /* Bone */
  --field: #eeeeee;         /* Mist: inputs only */
  --ink: #1b0624;           /* Aubergine Ink */
  --action: #160f0c;        /* Espresso: button fill only */
  --action-hover: #2b211c;
  --body: #444444;          /* Graphite */
  --faint: #5e5566;         /* Deep Ash (shadcn owns --muted) */
  --icon: #292421;          /* Charcoal */
  --rule: #898683;          /* Stone: never text */
  --border: color-mix(in srgb, var(--rule) 40%, transparent);
  --lime: #7fee64;          /* 8 px status dot only */
  --on-dark: #f7f7f5;
  --on-dark-muted: #c9bfcf;
  --warn: #8a5a00;          /* app only */
  --bad: #a3261c;           /* app only */
  --danger-fill: #a3261c;   /* account deletion only */

  /* Art layers only: never text, borders, buttons, badges */
  --art-sky: #dce7f2;
  --art-haze: #f6dcc8;
  --art-river: #e8a87c;
  --art-ridge: #9c8793;
  --art-meadow: #a9b48c;
  --art-periwinkle: #aab6f2;
  --art-lilac: #d8c8e8;
  --art-rose: #eba9b4;
  --art-coral: #f08a5d;
  --art-amber: #f2b866;
  --art-olive: #a9a46a;
  --art-dusk: #6f74c9;
  --art-ember: #b4553a;
  --art-mesh-mid: #4a3a5c;
  --art-mesh-bright: #6b5a86;

  /* Typography: families */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-inter-tight), var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-instrument-serif), ui-serif, Georgia, serif;   /* four art lines only */

  /* Typography: scale (390 column; stepped up below) */
  --t-closing: 48px;
  --t-hero: 44px;
  --t-serif-h2: 36px;
  --t-numeral: 48px;
  --t-h2: 32px;
  --t-h3: 26px;
  --t-h4: 20px;
  --t-lead: 18px;
  --t-body: 17px;
  --t-body-sm: 16px;
  --t-caption: 14px;
  --t-micro: 12px;

  /* Radius */
  --r-input: 8px;
  --r-card: 16px;
  --r-media: 24px;
  --r-pill: 9999px;

  /* Elevation */
  --edge: inset 0 0 0 1px rgb(0 0 0 / 0.05);   /* card edge (shadcn owns --ring) */
  --sh-over-art: 0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.10);
  --sh-over-art-hover: 0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.14);

  /* Frosted glass: surfaces over art only, never on flat Linen sections */
  --glass: rgb(255 255 255 / 0.64);          /* light glass, default */
  --glass-strong: rgb(255 255 255 / 0.78);   /* text 14px or smaller, dense rows, floating cards */
  --glass-edge: rgb(255 255 255 / 0.60);
  --glass-blur: blur(12px) saturate(140%);   /* below 768px; 20px from 768 up, see the media query */
  --glass-hi: inset 0 1px 0 rgb(255 255 255 / 0.70);
  --glass-hi-hover: inset 0 1px 0 rgb(255 255 255 / 0.85);
  --sh-glass: var(--glass-hi), var(--sh-over-art);
  --sh-glass-hover: var(--glass-hi-hover), 0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.14);
  --glass-nav: rgb(247 247 245 / 0.72);      /* nav after scroll; transparent at top */
  --glass-nav-blur: blur(16px) saturate(140%);
  --glass-nav-edge: rgb(255 255 255 / 0.5);
  --glass-nav-hair: rgb(27 6 36 / 0.06);
  --glass-dark: rgb(27 6 36 / 0.42);         /* dark CTA card only */
  --glass-dark-blur: blur(16px);
  --glass-dark-edge: rgb(255 255 255 / 0.14);
  --glass-fallback: rgb(255 255 255 / 0.94);

  /* Layout */
  --c-wide: 1440px;          /* owner, 2026-10-15 */
  --c-main: 1280px;
  --c-narrow: 1120px;
  --c-copy: 760px;
  --measure: 560px;
  --gutter: 20px;
  --gap-section: 64px;
  --gap-closing: 88px;
  --gap-intro: 40px;
  --pad-card: 24px;

  /* Motion */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);
  --ease-in: cubic-bezier(0.55, 0, 1, 0.45);
  --ui-duration: 300ms;
}

@media (min-width: 768px) {
  :root {
    --gutter: 32px; --gap-section: 80px; --gap-closing: 112px; --gap-intro: 56px;
    --t-closing: 62px; --t-hero: 52px; --t-serif-h2: 40px; --t-numeral: 56px;
    --t-h2: 36px; --t-h3: 28px;
    --glass-blur: blur(20px) saturate(140%);   /* 12px below 768px */
  }
}
@media (min-width: 1024px) {
  :root {
    --gutter: 48px; --gap-section: 96px; --gap-closing: 128px; --gap-intro: 64px; --pad-card: 32px;
    --t-closing: 75px; --t-hero: 63px; --t-serif-h2: 46px; --t-numeral: 64px;
    --t-h2: 40px; --t-h3: 30px; --t-h4: 22px; --t-lead: 20px; --t-body: 18px;
  }
}
@media (min-width: 1280px) {
  :root {
    --gutter: 80px; --gap-section: 120px; --gap-closing: 160px; --gap-intro: 72px;
    --t-closing: 96px; --t-hero: 80px; --t-serif-h2: 52px; --t-numeral: 72px;
    --t-h2: 44px; --t-h3: 32px; --t-h4: 24px;
  }
}

body {
  background: var(--canvas);
  color: var(--body);
  font: 400 var(--t-body) / 1.5 var(--font-sans);
  font-feature-settings: "cv11" 1;
}
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }

/* Glass recipe (light; add .glass-strong for the 0.78 fill) */
.glass {
  background: var(--glass);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-edge);
  box-shadow: var(--sh-glass);
}
.glass-strong { background: var(--glass-strong); }
.glass:hover { box-shadow: var(--sh-glass-hover); }   /* fine pointers only */
.glass-dark {
  background: var(--glass-dark);
  -webkit-backdrop-filter: var(--glass-dark-blur);
  backdrop-filter: var(--glass-dark-blur);
  border: 1px solid var(--glass-dark-edge);
  color: var(--on-dark);
}
@supports not (backdrop-filter: blur(1px)) {
  .glass, .glass-strong { background: var(--glass-fallback); }
  .glass-dark { background: rgb(27 6 36 / 0.92); }
}
@media (prefers-reduced-transparency: reduce) {
  .glass, .glass-strong { background: var(--surface); -webkit-backdrop-filter: none; backdrop-filter: none; }
  .glass-dark { background: #1b0624; -webkit-backdrop-filter: none; backdrop-filter: none; }
}
@media (forced-colors: active) {
  .glass, .glass-strong, .glass-dark {
    background: Canvas; color: CanvasText; border: 1px solid CanvasText;
    box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none;
  }
}
```

### Tailwind v4

Art tokens and type sizes stay out of `@theme`: art hues must not become utilities, and a `--text-body` key would collide with the `body` colour utility. Glass tokens also stay out of `@theme` because they are composite values (alpha fills, blur plus saturate, multi-layer shadows) and are applied through the `.glass` classes or `var(--glass-*)` in the Quick Start block above.

```css
@theme {
  /* Colors */
  --color-canvas: #f7f7f5;
  --color-surface: #ffffff;
  --color-sunk: #edece7;
  --color-field: #eeeeee;
  --color-ink: #1b0624;
  --color-action: #160f0c;
  --color-action-hover: #2b211c;
  --color-body: #444444;
  --color-faint: #5e5566;          /* --faint; same colour as text-muted-foreground */
  --color-on-action: #ffffff;      /* label on Espresso */
  --color-icon: #292421;
  --color-rule: #898683;
  --color-lime: #7fee64;
  --color-on-dark: #f7f7f5;
  --color-on-dark-muted: #c9bfcf;
  --color-warn: #8a5a00;
  --color-bad: #a3261c;
  --color-danger-fill: #a3261c;

  /* Typography */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-inter-tight), var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-instrument-serif), ui-serif, Georgia, serif;

  /* Spacing: 4 px base, so p-4 = 16px */
  --spacing: 0.25rem;

  /* Border Radius */
  --radius-input: 8px;
  --radius-card: 16px;
  --radius-media: 24px;
  --radius-pill: 9999px;

  /* Shadows */
  --shadow-edge: inset 0 0 0 1px rgb(0 0 0 / 0.05);
  --shadow-over-art: 0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.10);
}
```
