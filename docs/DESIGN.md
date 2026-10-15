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

Full-bleed closing painting (the door at dusk) behind the procedural dusk glow, whose Linen centre ellipse is the scrim behind the text. Serif closing line at `--t-closing`, a 16 px subline, one 56 px Espresso pill. Its lower edge fades into the footer so the two read as one sky.

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
- Thin, even, geometric strokes that stay legible at 16 px. Clear space equals half the mark width; the wordmark gap equals half the mark width.
- **Recommended mark: the open door** (`prompt.md` option 1): a thin rectangle standing slightly open with a small solid dot of light at the gap, the same door the paintings lead to. The K mark in the code today is interim until this mark is drawn.
- Lockup: mark plus the word "Kairos" in Inter 500, -0.022em, Aubergine Ink; 22 px mark in the nav, 28 px lockup in the footer.
- The shipped logo is SVG in `web/components/shared/logo.tsx`. Raster files from `prompt.md` (#13 to #15) are references for drawing it, not the shipped mark.
- Favicon and app icons: `web/app/icon.svg`, `web/app/icon.png` (512), `web/app/apple-icon.png` (180), all reversed (Linen mark on a full-bleed Aubergine square, no rounded corners, mark at about 56 percent with a slightly heavier stroke). Delete `web/app/favicon.ico` once `icon.png` exists.
- Extension icons: `extension/icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`, resized from `icon.png`.

### Open Graph

`web/public/landing/og-kairos.png`, 1200x630 (generated at 1536x816 as an edit of Scene A, then resized). The dawn valley with the path and the glowing door on the right, faded to Linen across the upper left. In the upper left third, the serif headline "Job applications / you would sign." in Aubergine Ink; below it the wordmark "Kairos" in a clean sans in Graphite `#444444`. Nothing else written. If the model misspells the text, use the text-free variant and let the build set the type. Alt text: "Kairos: Job applications you would sign."

### Procedural (code, not images)

- **Grain tile:** one inline SVG `feTurbulence` (fractalNoise, `baseFrequency` 0.85, 2 octaves, desaturated), 240 px tile, static, `soft-light`. Opacity: art panels 8 percent, closing glow 8, footer hills 12, dark card 14 (`overlay`), text zones 0.
- **Closing dusk glow:** layered `radial-gradient()`s on `::before`, no `filter: blur()`: periwinkle at 12% 70%, coral at 88% 65%, amber at 72% 90%, and a Linen ellipse at 50% 40% that clears the text zone. It frames the closing painting and stands in for it until the file exists.
- **Dark card mesh:** base Aubergine Ink `#1b0624`; mesh mid `#4a3a5c`; mesh bright `#6b5a86` rising from the bottom centre under the button; olive and dusk in the corners away from text; a darkening ellipse behind the text.
- **Footer video (V6, replaces the dusk-hills painting and the procedural hills):** owner-supplied files in `web/public/landing/footer/`: `meadow.mp4` (1920 x 1080, 1,193,372 bytes, about 1.2 MB), `meadow-poster.avif` (138,118 bytes) and `meadow-poster.webp` (103,652 bytes), downloaded from the footer spec URLs so the page makes no third-party requests. Loading: `preload="none"`; the poster `<picture>` shows first and the video starts only when the footer is within one viewport of the screen. It is paused, with the poster shown, under `prefers-reduced-motion`, under `html[data-motion="reduced"]` and by the footer pause button (WCAG 2.2.2). No grain on the footer.

## Layout

The marketing site is a single centred axis on Linen. Order: nav, centred art hero, commitment strip, problem trio, "how it works" intro, four zig-zag steps with the spotlight between steps 2 and 3, the dark CTA card, pricing, compare, FAQ, the closing art band and the footer. Loud (art) and quiet (plain Linen) sections alternate, except the steps and spotlight, which form one chapter joined by the connector line. Containers (owner, 2026-10-15): 1440 (`--c-wide`) for nav and footer, 1280 (`--c-main`) for the strip, trio, spotlight and pricing, 1120 (`--c-narrow`) for steps, dark card, FAQ and compare, 760 (`--c-copy`) for every heading stack. Only the hero painting, the closing band and the footer hills break the container. Grids: 12 columns at 1440 and 1024, 8 at 768, 4 at 390. Section intros are centred stacks (optional fact pill, H2, subline, one control) with 72 / 64 / 56 / 40 px to their content. The signed-in app uses the same canvas, cards and type with a 240 px sidebar, a header and Paper White panels; it has no art, no serif and no dark card.

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
