# 4. UI and UX Design Brief

Kairos v1 · last updated 2026-10-15

Style reference: `docs/DESIGN.md` ("Kairos — Style Reference", Duna with frosted glass, light; owner amendment 2026-10-15, deviation V5). The previous Modal-based reference is archived at `docs/design-refs/modal.md`. Visual tokens (color, type, radii, spacing, surfaces, elevation, motion, components) come from DESIGN.md, and the single source of truth for every value is `docs/superpowers/specs/2026-10-15-kairos-landing-design/09-style-direction.md`. Product, copy and accessibility rules from the earlier brief still apply wherever DESIGN.md is silent. The deviations and rule changes are listed in [Conflicts resolved](#conflicts-resolved). Tokens live in `web/app/globals.css`; the migration is being applied in the current rebuild.

**Provenance.** The landing direction was chosen from Refero research (09): seven styles were scored against the owner's reference layouts (Nivara, Liftoff, AGNCE, Ironclad footer). Duna is the primary style; two narrow borrows are kept (Cora's role for a light display serif, Modal's lime as a status dot). Values are adapted, not copied: Inter faces replace GT America, `--faint` is darkened to pass contrast, and the lime and the serif roles are narrower than in either source. The owner approved the light style on 2026-10-15; the dark theme is retired for the whole app.

## Audience and tone

Job seekers under time pressure: OPT students, new grads, people recently laid off. They are anxious about what goes out under their name.

Three adjectives: **calm, exact, accountable.** The interface reads like a quiet, editorial compliance document, something you would sign. Copy uses concrete verbs and real numbers, no hype words, no em dashes.

## Reference products

| Reference | Borrow | Avoid |
| --- | --- | --- |
| Duna (`docs/DESIGN.md`) | Linen canvas, near-achromatic UI, Espresso as the only filled-button colour, pill buttons, 1 px ring instead of shadows, one painted moment | Duna's logo bar and invented stat metrics, dark announcement pill, any colour taken from the painting |
| Nivara, Liftoff, AGNCE (owner layouts) | Centred painted hero, zig-zag steps with painting crops in cards, one dark CTA card, art closing band | Gradient rings, coloured accent words, text on art without a scrim |
| Ironclad | Light footer with a hairline and quiet link columns | Dense link walls |
| Linear | Dense, quiet dashboard lists; state shown by one small signal | Nothing here conflicts |
| Stripe docs | Tight display leading, generous whitespace | Gradients in the app |

## Color palette

Light theme only. The whole app follows this palette (dark theme retired). Surfaces step Linen, Paper White, Bone and are separated by a 1 px ring, not shadows. Contrast is measured with the WCAG 2.2 formula.

| Token | Value | Name | Role | Contrast on Linen |
| --- | --- | --- | --- | --- |
| `--canvas` | `#f7f7f5` | Linen | Page background. Never replaced by pure white | n/a |
| `--surface` | `#ffffff` | Paper White | Cards, plan cards, floating cards, status pill | 1.1 (edge carried by ring) |
| `--sunk` | `#edece7` | Bone | Nested panels, SAMPLE chip, eyebrow pill, toggle track, active sidebar item | 1.1 (edge carried by ring) |
| `--field` | `#eeeeee` | Mist | Input fields only | 1.1 |
| `--ink` | `#1b0624` | Aubergine Ink | Headings, strong text, logo, icons, featured-card border, the one dark card | 17.8 |
| `--action` | `#160f0c` | Espresso | Filled button fill. Nothing else | 17.7 |
| `--body` | `#444444` | Graphite | Body text, input borders | 9.1 |
| `--faint` (was `--muted`) | `#5e5566` | Deep Ash (Duna Warm Ash `#766a7c`, darkened) | Captions, table headers, helper text, legal row | 6.6 |
| `--icon` | `#292421` | Charcoal | Line icons, nav links | 14.3 |
| `--rule` | `#898683` | Stone | Dividers, decorative rules, ghost-button borders on Linen and Paper. **Never text** | 3.4 |
| `--edge` (was `--ring`) | `rgb(0 0 0 / 0.05)` | Ring | 1 px inset edge on every card (`shadow-edge`) | n/a |
| `--glass` | `rgb(255 255 255 / 0.64)` | Light glass | Fill of pills over art (status pill, SAMPLE chip on art, ghost buttons over art). Over art only | Ink 13.1, Graphite 6.7, Deep Ash 4.9 over Ridge |
| `--glass-strong` | `rgb(255 255 255 / 0.78)` | Strong glass | Floating cards over art; required for text at 14 px or smaller and dense rows (receipt, inbox) | Ink 15.3, Graphite 7.8, Deep Ash 5.7 over Ridge |
| `--glass-edge` | `rgb(255 255 255 / 0.60)` | Glass edge | 1 px border of every glass surface | n/a |
| `--glass-nav` | `rgb(247 247 245 / 0.72)` | Nav glass | Navbar after scroll (blur 16 px, saturate 140 percent) | Ink 13.6, Charcoal 10.9 over Ridge |
| `--glass-dark` | `rgb(27 6 36 / 0.42)` | Dark glass | Chips inside the dark CTA card only (blur 16 px, 1 px edge `rgb(255 255 255 / 0.14)`) | Linen 7.2 over `#827BC8` |
| `--lime` | `#7fee64` | Lime Pulse | Status dot only (see rule below) | 1.4 |
| `--good` | `#1b0624` | Aubergine Ink (status) | Status word: Submitted, credit +, always with the lime dot | 17.8 |
| `--warn` | `#8a5a00` | (status) | Status word: Needs review, Pending | 5.5 |
| `--bad` | `#a3261c` | (status) | Status word: Failed, credit − | 6.9 |
| `--danger-fill` | `#a3261c` | (status) | Danger button fill with white label (7.4:1). Account deletion only | n/a |
| `--on-dark` | `#f7f7f5` | Linen | Text on the dark card (17.8:1 on `#1b0624`) | n/a |
| `--on-dark-muted` | `#c9bfcf` | (derived) | Secondary text on the dark card (10.8:1) | n/a |
| `--art-*` | 09 section 3.1 hexes | Valley hues | Inside art layers only. Never text, border, button, badge or icon | n/a |

**Status-dot rule (replaces the lime rule):** lime `#7fee64` is an 8 px dot with a 1 px `--ink` ring, always beside the word it marks (approved, live, passes). It is never text, a button, a border, a fill of a larger shape, or the logo. Lime on Linen is 1.4:1, so the ring (13.0:1 against lime) and the word carry the meaning.

**Status words:** the app needs failures to be readable, so `--good`, `--warn` and `--bad` colour words and small badges only, never large areas, and always with the word (and the dot or a hollow square where space allows). Good is an Aubergine Ink word plus the lime dot (09 section 6, rule 5), not a green colour. Measured on Linen, Paper, Bone: good 17.8, 19.1, 16.1; warn 5.5, 5.9, 5.0; bad 6.9, 7.4, 6.2. All pass AA. The landing uses no red or green text: its status words are `--ink` or `--faint` plus the lime dot or a hollow 8 px square (09 section 6, rule 5).

**Retired tokens:** Void, Ground Iron, Carbon Veil, Phosphor White, the Sage and Moss text scale, Fern Link, Deep Fern, Circuit Border, Phosphor Blue-Black, Mint Frost, lime as a fill for buttons, `--accent`, `--accent-hover`, `--accent-ink`. `--obsidian` and `--smoke` become `--sunk`.

## Typography

- **Headings and display:** Inter Tight, weights 400 and 500 (heading weight 400; 500 only for card titles and labels). Features `"tnum" "zero"` on numerals. Tracking is tight only at 44 px and up (the Duna `-0.06em` is re-tuned to `-0.045em` on Inter Tight, which is already narrow).
- **UI and body:** Inter, weights 400 and 500. 500 for buttons, nav and card titles; 400 for paragraphs. Enable `cv11`.
- **Display serif:** Instrument Serif 400, **four lines on the landing only**: hero H1, spotlight H2, dark-card H2, closing line. At 36 px and up, only on or beside art. Never in the app, body, nav or buttons.
- No weight above 500, except Inter 600 in the footer (title, column titles, giant wordmark), per the owner footer spec (V6). Hierarchy comes from size, tracking and colour. No text under 12 px, no body under 16 px on the landing.
- Numbers in tables and counters use `tabular-nums`.

| Role | Face | Size / line height (desktop) | Tracking | Use |
| --- | --- | --- | --- | --- |
| Closing | Serif 400 | 96 / 1.0 | -0.01em | Landing closing line |
| Hero | Serif 400 | 80 / 1.02 | -0.015em | Landing H1 |
| Serif H2 | Serif 400 | 52 / 1.08 | -0.01em | Spotlight H2, dark-card H2 |
| Numeral | Inter Tight 400 | 72 / 1.0 | -0.045em | Landing prices only, true numbers |
| H2 | Inter Tight 400 | 44 / 1.1 | -0.035em | Landing section titles (mobile 32) |
| H3 | Inter Tight 400 | 32 / 1.2 | -0.025em | Landing step titles; app page titles at 30 (24 on mobile) |
| H4 | Inter 500 | 24 / 1.3 | -0.02em | Dialog titles, card titles, plan names |
| Lead | Inter 400 | 20 / 1.4 | -0.01em | Sublines (18 on mobile) |
| Body | Inter 400 | 18 / 1.5 (landing), 16 / 1.5 (app) | 0 | Paragraphs, max 65 characters per line |
| Body small | Inter 400 | 16 / 1.6 | 0 | Card body, FAQ answers |
| Caption | Inter 400/500 | 14 / 1.5 | 0 | Tables, form labels, buttons, helper text, nav links |
| Micro | Inter 500 uppercase | 12 / 1.2 | +0.04em | SAMPLE chip, card indices, table headers |

Landing sizes step down at 1024, 768 and 390 as listed in 09 section 5.

## Spacing, shape, and layout tokens

- **Spacing scale (base 4 px):** 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 80, 96, 120, 160.
- **Radii (four values):** `--r-input` 8 (inputs, selects, textareas), `--r-card` 16 (content cards, plan cards, floating cards, tables), `--r-media` 24 (art panels, spotlight card, dark card, every image), `--r-pill` 9999 (every button, tag, badge, SAMPLE chip, toggle, step badge). Nothing under 8 px. Nested radius is outer minus padding.
- **Card padding:** 32 px (1440, 1024), 24 px (768, 390). Compact rows (tables, list items) 16 to 20 px.
- **Element gap:** 16 px. **Section gap (landing):** 120 / 96 / 80 / 64 by breakpoint; closing gap 160 / 128 / 112 / 88.
- **Containers (set by the owner, 2026-10-15):** `--c-wide` 1440 (nav, footer, page max width), `--c-main` 1280, `--c-narrow` 1120, `--c-copy` 760. App page max width 1440. Gutters 16 px mobile, 24 px tablet, 32 px desktop.

## Surfaces and elevation

| Level | Token | Value | Use |
| --- | --- | --- | --- |
| 0 | Linen | `#f7f7f5` | Page canvas, full-bleed bands |
| 1 | Paper White | `#ffffff` | Content cards, plan cards, floating cards, status pill |
| 2 | Bone | `#edece7` | Nested panels, active sidebar item, wash callouts, toggle track |
| 3 | Mist | `#eeeeee` | Input fields only |
| 4 | Aubergine Ink | `#1b0624` | The one dark CTA card on the landing. Not used in the app |
| G1 / G2 | Light / strong glass | `rgb(255 255 255 / 0.64)` / `0.78`, `blur(20px) saturate(140%)` | Surfaces over art only (landing). Never on Linen sections, never in the app |
| G3 | Nav glass | `rgb(247 247 245 / 0.72)`, `blur(16px) saturate(140%)` | Navbar after scroll |
| G4 | Dark glass | `rgb(27 6 36 / 0.42)`, `blur(16px)` | Chips inside the dark CTA card only |

**Elevation:** a 1 px inset ring, `box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.05)`, on every card on Linen. One shadow token exists, `--sh-over-art: 0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.10)`, and only under surfaces floating over a painting or grain panel on the landing (glass cards, or the solid fallback). Never on Linen, never in the app. Glass surfaces use `--sh-glass` (the same shadow plus the inner top highlight `inset 0 1px 0 rgb(255 255 255 / 0.70)`) and a 1 px `--glass-edge` border instead of the ring; hover on fine pointers raises the highlight to 0.85 and the second shadow layer to 0.14.

**Frosted glass rules (V5).**
- Where: only on surfaces that sit over something to blur: painted art, the closing glow, the dark-card mesh, and the nav over scrolled content. Problem cards, plan cards, compare and FAQ stay solid Paper White with the ring, because glass over a flat colour reads as a grey box. On the landing pricing section glass appears only over its own art: the interval toggle on the banner painting, the recommended plan's frosted panel and pill, and the guarantee bar on its gradient.
- Neutral frost only: never tinted with art hues or lime. Lime stays the 8 px status dot.
- Radii: 16 cards, 24 panels, 9999 pills.
- Calm zones under glass cards keep soft colour variation (not flat white or a flat fill), so the frost reads.
- Sanctioned decorative glass (V6): the giant footer "Kairos" wordmark is frosted glass via `background-clip: text` and two drop-shadows, with no `backdrop-filter` and no text stroke, `aria-hidden`; it does not count toward the six-surface limit.
- Fallbacks: `@supports not (backdrop-filter: blur(1px))` gives `rgb(255 255 255 / 0.94)`; `prefers-reduced-transparency: reduce` gives solid Paper White (light) or `#1b0624` (dark); `forced-colors` gives `Canvas` with a 1 px `CanvasText` border.
- Performance: at most 6 glass surfaces visible at once, never animate the blur radius, blur 12 px below 768 px wide. Motion is unchanged. Grain lives only inside art layers (panels 8 percent, closing glow 8, dark card 14; text zones 0).

## Components

**Component source.** Generic controls (dialog, select, popover, menu, tabs, table, sidebar, toast and similar) come from shadcn v4 on Base UI (`web/components.json`, style `base-nova`, generated into `web/components/ui`) and are themed to Duna through CSS variables only; see DESIGN.md "Component library: shadcn (base-ui), themed to Duna" for the token mapping. Landing and app-specific components stay Duna-native in `web/components/{landing,shared,layout,dashboard}`. Text utilities: `text-body` for Graphite, `text-muted-foreground` or `text-faint` for Deep Ash; `bg-muted` and `bg-accent` are Bone surfaces; Espresso buttons use `bg-action text-on-action`.

| Component | Spec |
| --- | --- |
| Primary button (Espresso pill) | `--action` fill, white label (Inter 500, 14 to 16 px, 19.0:1). Pill radius, 44 px tall in the app, 56 px in the landing hero, 24 px horizontal padding. No shadow, no border. **One per screen.** Hover: fill shifts to `--action-hover` `#2b211c`. |
| Default button | Paper White fill, `--ink` label and 1 px `--rule` border (Inter 500, 14 px). Pill radius, 40 to 44 px tall. Hover: Bone fill. |
| Outlined button | Transparent, 1 px `--rule` border, `--ink` label. Pill radius. Hover: Bone fill. Secondary of a pair, such as Skip beside Prepare draft. Over art: light glass (`--glass`, `blur(20px) saturate(140%)`, `--glass-edge`, pill radius, `--ink` 14/500, no Stone border); on plain Linen or Paper it is a Paper White pill with the Stone border. |
| Ghost button | No border, `--ink` label. Hover: Bone fill. |
| Danger button | `--danger-fill` with white label. Account deletion only. |
| Inverse button | Paper White fill, Espresso label (19.0:1). Only on the dark CTA card. |
| Input / select / textarea | Mist fill, 1 px `--body` border, 8 px radius, `--ink` text. Focus: border shifts to `--action` plus the 2 px `--ink` focus ring, 3 px offset. Label above (`--ink` 14/500), helper or error below, 8 px gaps. No shadow. |
| Content card | Paper White fill, ring, 16 px radius, 32 px padding. No shadow. |
| Wash card | Bone fill, 16 px radius, no ring. Empty states use a dashed 1 px `--rule` box instead. |
| Badge / tag | Pill, 4 px 12 px padding, Inter 12 px 500. Neutral: Bone fill, `--faint` text (6.0:1). Status: word in a status colour (or `--ink`) on Paper or Bone, with the 8 px dot. Never filled with Espresso or lime. |
| Tables | 1 px `--rule` row rules at 50 percent opacity, no zebra stripes. Header row in `--faint` micro style. Numbers use `tabular-nums`. |
| Sidebar nav item | 8 px radius. Active: Bone fill with `--ink` label. Inactive: `--icon` label. Not Espresso, so it does not compete with the screen's primary action. |
| Navbar | Transparent over the hero sky; once scrolled, nav glass `rgb(247 247 245 / 0.72)` with `blur(16px) saturate(140%)`, bottom border `rgb(255 255 255 / 0.5)` plus a `rgb(27 6 36 / 0.06)` hairline, no drop shadow, 64 px tall, container 1440 (`--c-wide`). Links `--icon` 15 px. "Start free" is the one Espresso pill. Logo in `--ink`. |
| Status pill (landing hero) | Light glass over the hero sky (`--glass`, `--glass-edge`, `inset 0 1px 0 rgb(255 255 255 / 0.70)`), pill radius, `--ink` 14/500 (13.1:1), lime dot with ink ring. Copy: "25 free applications". |
| Eyebrow pill | Bone, `--ink` 12/500. Only where it carries a fact. |
| SAMPLE chip | Inside a card: Bone pill, `--faint` 12 px uppercase (6.0:1). Directly on art: light glass pill with `--ink` text (13.1:1). |
| Floating sample card (landing, over art) | Strong glass, 16 px radius, `--glass-edge`, `--sh-glass`, 16 px padding. Hover on fine pointers: highlight 0.85, second shadow layer 0.14, 3 px lift. Real DOM, SAMPLE chip. Solid Paper White with the ring in the fallbacks. |
| Dark-card chips and secondary buttons | Dark glass (`--glass-dark`, blur 16 px, 1 px `rgb(255 255 255 / 0.14)`), pill radius, Linen text. The Inverse button stays solid Paper White. |
| Footer (V6, owner-supplied) | Full viewport minus nav height. Pale paper `#f1f1ee` top blended from Linen over 48 px. Brand block (Logo, title, paragraph, "Follow us" with five icon links LinkedIn / X / Instagram / TikTok / YouTube on placeholder `#` hrefs from `siteConfig.social`, and "© 2026 Kairos. A product of Gray Matter Labs."; no CTA, no chips, no Motion chip), Product / Company / Legal columns with real routes, looping meadow video (`web/public/landing/footer/`, `preload="none"`, plays near the viewport, paused by reduced motion; round pause/play button bottom right), giant frosted-glass "Kairos" wordmark sinking into lavender fog `#e2e3f1`. Text ink `#0c0c0c`, Graphite, Deep Ash. Inter 600 for title, column titles and wordmark only. |
| Problem, plan, compare, FAQ cards | Not glass. Paper White, ring, no blur. |
| Landing FAQ (2026-10-15) | shadcn Accordion (Base UI) in the two-column 1:2 frame: one row open at a time, collapsible, `--border` hairlines, question Inter 500 16 px `--ink`, 28 px Bone plus icon that turns to a minus, answer Graphite 16 / 1.6. Answers stay in the server HTML (kept mounted, hidden until found after hydration) for SEO and find-in-page; with JavaScript off the rows do not open (accepted trade-off). FAQPage JSON-LD unchanged. No height animation under reduced motion. /pricing keeps the native `<details>` list. |
| Landing pricing (2026-10-15) | 24 px art banner (`scene-a-dawn-valley.png` crop, Linen scrim) with the H2 and subline left and a light-glass Weekly / Monthly / Quarterly toggle right (stacked below 768). Four plan cards: Paper White, ring, 24 px radius, 8 px padding; an inner 16 px Bone panel holds name, tagline, price (`--t-numeral`, period in `--faint`), allowance, a full-width button and a 14 px caption; below it "What's included" and up to four `plans.ts` features with 20 px Phosphor light round checks, "(in beta)" after G3 features. The highlighted plan (Pro) shows `scene-b-footbridge.png` under strong frost (clear top-right corner) with a light-glass "Recommended" pill and the section's one Espresso button; other plans use outlined buttons on Paper White. No shadow. 4 columns at 1280+, 2 by 2 at 768 to 1279, 1 column below 768 with Pro first. Under the cards a 24 px pastel gradient banner with one strong-glass bar: the guarantee line and a "See full pricing" link. |

## Layout rules

- **App:** left-aligned inside a centred container. Never centre body text or headlines in the app.
- **Landing:** follows the Nivara and Liftoff references. Heroes, section intros and the closing CTA are centred, with art. The old "never centre headlines" rule applies to the app, not to the landing hero, section intros or closing CTA. Body paragraphs stay left-aligned inside cards.
- Landing density, per section: at most a short pill, an 8-word headline, a 20-word subline, one visual, one CTA.
- Landing pricing shows plan cards only (no comparison table there), each with its own button; only the recommended plan's is Espresso. The full comparison lives on the pricing screen.
- Landing rhythm: section gaps 120 / 96 / 80 / 64. Zig-zag step rows and split feature rows are allowed. Card grids never exceed three columns.
- App section rhythm: 32 to 48 px between blocks; 1 px `--rule` hairline at 50 percent between major sections.
- Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Below `md` every layout is one column. The dashboard sidebar hides below `lg`.

## Screen notes

One Espresso primary per screen. Nothing else on a screen is filled with Espresso.

| Screen | Hierarchy |
| --- | --- |
| Landing | Status pill ("25 free applications") → serif H1 → 20 px subline → Espresso primary → painted valley hero with floating sample cards (real DOM, labelled SAMPLE). Then commitment strip, problem trio, four zig-zag steps, spotlight on approval, one dark CTA card, plan cards, FAQ, art closing band, then the full-viewport footer (paper top, link columns, looping meadow video, frosted-glass wordmark). |
| Pricing | Interval switch (Bone track, active segment Paper White pill with ring) → four plan cards (Pro with a 1 px `--ink` border; its "Upgrade" is the screen's one Espresso button, other plans use default buttons) → comparison table → billing FAQ. |
| Auth | Split: form left on Linen, one reassurance sentence right on Bone. The Espresso element is the submit button. |
| Matches | List rows: company · location · age in `--faint` caption; job title 20 px; reasons as short lines; fit badge neutral; Skip (outlined) and Prepare draft (Espresso, the one primary). |
| Review queue | Checkbox list with bulk bar on top. "Approve selected" is the one Espresso button. |
| Application | Draft: answers, resume lines with "cites N facts", cover letter, Save (default button). Sent: receipt table of every field plus the confirmation text. |
| Billing | Current plan, upgrade buttons (Espresso on the one recommended plan only), credit ledger with dated rows and signed numbers. Signs carry the word as well as the colour. |

## Accessibility

- **Contrast (measured, WCAG 2.2):** `--ink` on Linen 17.8:1, on Paper 19.1, on Bone 16.2. `--body` on Linen 9.1, Paper 9.7, Bone 8.2. `--faint` on Linen 6.6, Paper 7.1, Bone 6.0, Mist 6.1. `--icon` on Linen 14.3. White on Espresso 19.0. Espresso on Paper White (inverse button) 19.0. On the dark card: `--on-dark` 17.8, `--on-dark-muted` 10.8. Status words 5.0 to 7.4:1 on Linen, Paper and Bone. Duna Warm Ash `#766a7c` is not used for text (4.3:1 on Bone).
- **Contrast on glass (measured, WCAG 2.2):** glass composited over the darkest art tone that can sit behind a card, Ridge `#9C8793` (the backdrop blur averages, so a flat composite is a fair model; saturate is not modelled). Light glass 0.64 (`#DBD4D8`): Ink 13.1, Charcoal 10.5, Graphite 6.7, Deep Ash 4.9. Strong glass 0.78 (`#E9E5E7`): Ink 15.3, Charcoal 12.3, Graphite 7.8, Deep Ash 5.7. Nav glass 0.72 (`#DED8DA`): Ink 13.6, Charcoal 10.9, Graphite 6.9. Dark glass `rgb(27 6 36 / 0.42)` over `#827BC8` (`#574A83`): Linen 7.2, `--on-dark-muted` 4.4 (fails), so dark glass carries Linen text only. Fallback fill `rgb(255 255 255 / 0.94)`: Ink 18.1, Deep Ash 6.7. Deep Ash passes on light glass but with a margin under 0.4, so Deep Ash and Graphite at 14 px or smaller are restricted to strong glass. Stone is 2.5:1 on light glass and 2.9:1 on strong glass, so glass controls carry no Stone border; the label and the pill shape identify the control.
- **Text rule:** Stone (`--rule`) and lime never carry text or meaning. `--faint` is the lightest text colour. No text on painted art outside the hero scrim.
- **Lime** is never text, never a button, never a border. The status dot always has a 1 px `--ink` ring and its word.
- **Non-text contrast:** input borders use `--body` (9.1:1). `--rule` is 3.4:1 on Linen and 3.6:1 on Paper, so it meets 3:1 for ghost-button borders on those surfaces; decorative hairlines may be lighter.
- **Keyboard:** every action is a real button or link. Visible focus: 2 px `--ink` outline, 3 px offset on light surfaces; 2 px `--on-dark` on the dark card.
- **Forms:** labels tied to inputs with `htmlFor`. Errors use `role="alert"`. Required fields are marked in text, not only colour.
- **Touch targets:** at least 40 px tall.
- **Motion:** respects `prefers-reduced-motion`; see Motion.
- **Looping video (WCAG 2.2.2 Pause, Stop, Hide):** the footer meadow video is muted, decorative (`aria-hidden`) and loops, so it needs a pause control. The round pause/play button in the footer stage (bottom right, above the fog) is that control; the video is also paused (poster shown) under `prefers-reduced-motion` and `html[data-motion="reduced"]`, and it only plays while the footer is near the viewport. Footer text is ink `#0c0c0c`, Graphite `#444444` and Deep Ash `#5e5566` over the paper haze, never over the video itself.
- **Status:** never relies on colour alone. Status badges always carry the word.

## Interaction states

| State | Treatment |
| --- | --- |
| Hover | Colour change only, 300 ms ease-out in the app. Espresso primary lightens to `--action-hover` `#2b211c`. Default and outlined fill Bone. Ghost fills Bone. |
| Focus | 2 px `--ink` outline, 3 px offset. |
| Active (pressed) | No transform. Colour holds. |
| Disabled | 50 percent opacity, no pointer events. |
| Loading | Static skeleton blocks in Bone matching the final layout (no pulse or shimmer loop). Button label changes to "…ing". |
| Empty | Dashed `--rule` box, one sentence on how to fill it, one action. |
| Error | Inline text in `--bad` under the field or block, with the word. Never a toast-only error. |
| Success | Short inline confirmation ("Saved", "Copied") in `--good`. |

## Motion

- **App:** utility only. 300 ms ease-out on color, background-color, border-color, fill, stroke and text-decoration-color, all together. Page sections fade in once (opacity only). No springs or bouncy easing. No infinite or ambient animation in the app.
- **Landing:** the motion vocabulary in 07 section 8 (M1 to M12): soft float, art parallax, hero story sequence, hover lift (fine pointers only), reveal rise, connector draw, gradient drift, toggle slide, accordion, nav state, approve stamp. Transform and opacity only, no springs. Nothing autoplaying longer than 5 s carries information; the footer Motion control pauses ambient float, drift and the looping footer meadow video (WCAG 2.2.2); at most two looping groups visible at once.
- **Reduced motion:** every landing motion is gated by `prefers-reduced-motion` and lands in the static final state at frame 0 (content is in the HTML and visible without JavaScript). In the app, fades are removed.

## Assets needed

Source of truth: `prompt.md` at the repo root (prompts, sizes, alt text). Paths are relative to the repo root. Generate scene A first; every other painting is an **edit** of it, so one valley and one style carry the whole page. Each painting carries its section's meaning (owner-approved deviation V4: several scenes of one valley).

| # | Asset | File | Path | Size |
| --- | --- | --- | --- | --- |
| 1 | Hero painting (master, Scene A) | `scene-a-dawn-valley.png` | `web/public/landing/art/` | 3200 x 1600 |
| 2 | Hero on phones (crop of #1) | `scene-a-dawn-valley-portrait.png` | `web/public/landing/art/` | 1088 x 1360 |
| 3 | Step 1, fit gate | `step-1-fit-gate.png` | `web/public/landing/art/` | 1536 x 1152 |
| 4 | Step 2, truth lock | `step-2-truth-lock.png` | `web/public/landing/art/` | 1536 x 1152 |
| 5 | Spotlight, footbridge (Scene B) | `scene-b-footbridge.png` | `web/public/landing/art/` | 2048 x 2048 |
| 6 | Step 3, noon meadow (Scene C) | `scene-c-noon-meadow.png` | `web/public/landing/art/` | 1600 x 1200 |
| 7 | Step 4, replies | `step-4-replies.png` | `web/public/landing/art/` | 1536 x 1152 |
| 8 | Closing, dusk door | `closing-dusk-door.png` | `web/public/landing/art/` | 3072 x 1024 |
| 9 | Open Graph image | `og-kairos.png` | `web/public/landing/` | 1536 x 816, resized to 1200 x 630 |
| 10 | Logo concept sheet (pick one, not shipped) | `kairos-logo-concepts.png` | `docs/brand/` | 2048 x 2048 |
| 11 | Logo mark | `kairos-mark.png` | `web/public/brand/` | 1024 x 1024 |
| 12 | Logo lockup | `kairos-logo.png` | `web/public/brand/` | 2048 x 512 |
| 13 | Favicon and app icon (delete `web/app/favicon.ico` after) | `icon.png` | `web/app/` | 1024, resized to 512 |
| 14 | Apple icon | `apple-icon.png` | `web/app/` | 180 x 180 |
| 15 | Extension icons | `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png` | `extension/icons/` | resized from #13 |
| 16 | Footer video (owner-supplied, V6; replaces `footer-dusk-hills.png`) | `meadow.mp4` | `web/public/landing/footer/` | 1920 x 1080, 1.2 MB |
| 17 | Footer video poster (V6) | `meadow-poster.avif`, `meadow-poster.webp` | `web/public/landing/footer/` | 138 KB AVIF, 104 KB WebP |

`footer-dusk-hills.png` and its 2880 x 840 crop are no longer used by the footer (superseded; see `prompt.md` #11). The footer video loads with `preload="none"`, starts when the footer is within one viewport, and is paused under `prefers-reduced-motion`, `html[data-motion="reduced"]`, with a pause/play button for the visitor.

Optional (code fallback exists):

- Problem-trio paintings `problem-1-poor-matches.png`, `problem-2-invented-resume.png`, `problem-3-no-edit.png` in `web/public/landing/art/`, 1024 x 1024. Default is thin Charcoal line icons drawn in code, not images. The same applies to the UI icons.
- Dark card art `dark-card-night.png` in `web/public/landing/art/`, 2048 x 1152. Default is the procedural dark-card mesh on Aubergine Ink with grain.
- Procedural, no file: grain tile (SVG `feTurbulence`), dusk glow behind the closing line.

Rules:

- **Logo and icons are in ink** (`#1b0624` on Linen, or Linen on an Aubergine Ink square for the app icon). No lime, no gradients. The open door mark (option 1 on the concept sheet) is recommended: it echoes the paintings and reads at 16 px. The mark is redrawn as SVG in `web/components/shared/logo.tsx` once an option is picked.
- **Product UI on the landing is real DOM**, labelled SAMPLE with a chip, never a screenshot or painting of UI.
- **Real app screenshots are still required** for the Chrome Web Store listing (review queue and receipt), taken from the real app, not mockups.
- Record each generated file in `web/public/landing/art/LICENSE.md` (file, tool, date, prompt number).
- **Not used:** stock photos, 3D renders, isometric icons, avatars, customer logos.

## Conflicts resolved

### Duna reference vs Kairos

| Topic | Duna says | Resolution in Kairos |
| --- | --- | --- |
| V1, painting crops in cards | One painted hero moment, nothing else painted | The hero is the moment; Nivara-style panels are crops of the same valley master, clipped at 24 px. No second painting style. |
| V2, one dark surface | No dark sections | One dark CTA card (Aubergine Ink with grain mesh) on the landing, as in Liftoff. Inverse button is Paper White with an Espresso label. |
| V3, one shadow token | No shadow beyond the 1 px ring | `--sh-over-art` only for Paper White cards floating over art, where a ring alone disappears into brushwork. Never on Linen, never in the app. |
| V4, several scenes of one valley | A single illustration | Several scenes (dawn, footbridge, noon, afternoon, dusk) edited from one master, each carrying its section's meaning. Owner approved. |
| Accent colour | None | None in UI. Lime survives only as an 8 px status dot with an ink ring, beside its word. |
| Display face | GT America | Inter Tight 400/500 headings, Inter 400/500 body. Instrument Serif 400 on four art lines only. |
| Logo bar, stat display | Customer logos, 6.2x and 22 percent | Not used: no customers yet, no invented metrics. Stat display is repurposed for true prices only. |
| Warm Ash text | `#766a7c` | Darkened to `#5e5566` (4.3:1 on Bone otherwise). |
| Announcement pill | Dark pill | Light-glass status pill (white 64 percent, blur, white edge), so Espresso stays filled-button only. |
| V5, frosted glass layer (owner amendment 2026-10-15) | Paper White cards with a 1 px ring; no blur, no translucency | Duna stays primary; surfaces that float over art (floating sample cards, hero status pill, SAMPLE chip on art, ghost buttons over art, scrolled nav, dark-card chips) become neutral frosted glass: white 64 percent (78 percent for text at 14 px or smaller and dense rows), `blur(20px) saturate(140%)`, 1 px white edge, inner top highlight, `--sh-over-art` under it. Never on flat Linen sections (problem, pricing, compare, FAQ stay solid). Neutral frost only. Fallbacks for no backdrop-filter, reduced transparency and forced colours; at most 6 glass surfaces at once, blur 12 px below 768 px, blur never animated. Contrast figures in Accessibility. |
| V6, owner-supplied footer (2026-10-15) | Light Linen link band with dusk hills | Full-viewport footer from the owner's spec: pale paper `#f1f1ee` top blended from Linen over 48 px, brand block, Product / Company / Legal columns, a looping blue-hour meadow video, a giant frosted-glass "Kairos" wordmark sinking into lavender fog `#e2e3f1`. Inter 600 allowed in the footer only. Video paused by reduced motion, with a pause/play button (WCAG 2.2.2). Owner approved. |

### Brief rules that changed

| Topic | Earlier brief | Now |
| --- | --- | --- |
| Theme | Dark phosphor, light retired | Light only; dark retired for the whole app. |
| Hero alignment | Never centre headlines | Centred on the landing hero, section intros and closing CTA; left-aligned in the app. |
| Primary action | One lime pill per screen | One Espresso pill per screen. |
| Lime | "Act" or "on" fill, one per screen | 8 px status dot with ink ring only. |
| Status colours | Recalibrated for dark | Recalibrated for light: good is an Aubergine Ink word plus the lime dot; warn `#8a5a00` and bad `#a3261c` colour words and small badges in the app only; the landing uses no red or green text. |
| Radii | 0 / 8 / 12 / pill | 8 / 16 / 24 / pill. Buttons are pills. |
| Elevation | Navbar shadow only | 1 px ring on Linen; over art, frosted glass with one `--sh-over-art` shadow (V5). |
| Imagery | None in v1: no illustrations | Painted valley art on the landing only; app stays art-free. Product UI is real DOM. |
| Motion | No ambient animation anywhere | App unchanged; landing uses ambient float and drift with a pause control and reduced-motion gating. |
| Page width, gap, grid | 1280 px, 20 px gap, 80 px sections | 1440 px (`--c-wide`, owner 2026-10-15), 16 px gap, 120 / 96 / 80 / 64 sections. Zig-zags and three-column cards stay allowed. |
| Font weight | No weight above 500 | 400 and 500 everywhere; Inter 600 in the footer only (title, column titles, wordmark), per the owner footer spec (V6). |
| Typography | Inter Tight with `ss01`, display 64 | Inter Tight 400/500 without `ss01`, display set by the serif on the landing; sizes per the table above. |

## Open items

1. Generate the art per `prompt.md` (start with `scene-a-dawn-valley.png`, then edit the rest from it), and add licence lines.
2. Pick the logo option from the concept sheet (door mark recommended) and redraw it as SVG.
3. `web/app/globals.css` migration to these tokens: being applied in the current rebuild; confirm complete and that `--art-*` is lint-restricted to art selectors.
4. Trademark check on the name "Kairos" before launch.
5. Capture real app screenshots for the Chrome Web Store listing.
6. Owner to confirm the density option in 09 section 9.12 (drop four eyebrow pills).
