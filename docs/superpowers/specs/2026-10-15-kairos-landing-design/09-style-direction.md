# 09. Style direction: which style reference owns the landing

Status: **drafted, for owner review.** Date: 2026-10-15.

Owner instruction: "can you make like this keep keep style reference as mention in design.md or look for better in https://styles.refero.design/".

This document decides the **style** (mood, tokens, type, surfaces, imagery rules). The **layout** stays as set in [07-reference-system.md](./07-reference-system.md) (archetypes A0 to A11 from Nivara, Liftoff, AGNCE and the Ironclad footer), and the content and density budget stay as set in [08-restructure-plan.md](./08-restructure-plan.md). Where this document and 07 disagree on a colour, radius, shadow or type value, this document wins. Where they disagree on placement or size of a component, 07 wins.

---

## 1. Research summary

**Method (Refero).** One primary style owns mood, density and structure. At most two details are borrowed, each narrowly. References are not averaged. Token roles are preserved (a CTA colour stays CTA-only). Imagery roles are preserved (an image-led style gets real or generated art, never CSS fakes).

**What was looked at.** The Refero home-page seeds (Superhuman, Notion, Intercom, Mercury, Wise, Ramp, Brex, Steep, Structured, Perplexity, Figma, Raycast, Resend, Dala, Slush, Duolingo, Ui, ORYZO AI) and searches on painted, illustrated and landscape styles were screened by their thesis line. Seven were scored in full against the owner's layouts; their DESIGN.md files are saved in `docs/design-refs/`.

| Rank | Style | Thesis | Total /70 | Why it ranked here |
| --- | --- | --- | --- | --- |
| 1 | **Duna** ([style](https://styles.refero.design/style/8cf4a580-bfb6-4090-a899-f734ffe62370), duna.com) | Sunset watercolour on warm marble | **49** | Its hero *is* the Nivara/AGNCE hero: a full-bleed painted landscape fading into a quiet canvas, a centred stack, a pill CTA. Below the hero it is a calm, document-like page with hairlines instead of shadows. Best structure and brand fit |
| 2 | Wise ([style](https://styles.refero.design/style/367c0c6e-73a7-441c-a8ff-91d139ac60dc), wise.com) | Deep moss with lime voltage | 47 | Keeps a lime accent (continuity), but its 105 px ALL-CAPS weight-900 display type is loud, and it bans gradients and blurs, which removes the Liftoff glow layer |
| 3 | Cora ([style](https://styles.refero.design/style/1ab3cde9-0833-4e38-8ada-fc23156f730e), cora.computer) | Romantic sky painting with floating desk | 46 | Painted canvas plus a light serif plus floating white UI is very close to the owner's references. But it bans cropping the painting into cards (Nivara panels need that), and white-on-cerulean text and its greys fail contrast |
| 4 | Modal (current `docs/DESIGN.md`, modal.com) | Phosphor terminal in a darkened server room | 45 | Highest continuity, but its own rules forbid photography and painting, split layouts, gradients and shadows: every owner reference breaks it |
| 5 | Arva ([style](https://styles.refero.design/style/15846be3-8df8-42e4-a05c-d9395dcec369), arva.com) | Pastoral editorial magazine spread | 44 | Good serif and bone canvas, but photography only, no illustration, and an agtech identity |
| 6 | Mercury ([style](https://styles.refero.design/style/3172cd4d-118a-4a16-a259-6b634d32322e), mercury.com) | Alpine banking at blue hour | 43 | Cinematic landscape hero, but dark and cold, photography only, one CTA per page |
| 7 | Reworkd ([style](https://styles.refero.design/style/95913740-3ff7-45ec-a05b-4acf040850a0), reworkd.ai) | Soft daylight over a product | 41 | Fits Liftoff's aurora and UI cards, but forbids illustration and dark sections |

**Finalists:** Duna, Cora, and Modal as the keep option. Wise scores one point above Cora, but it is not a finalist: its loud display voice goes against "calm, exact, accountable", its flat rule removes Liftoff's glow, and its one advantage (lime) is kept here as a narrow borrow from Modal, where it already lives.

---

## 2. Decision

**Primary: Duna.** `docs/DESIGN.md` (Modal) is **not** kept as the landing style reference. It stays the reference for the app (07 D1: landing tokens live under `.lp`). Modal contributes one borrowed detail (the lime status dot).

### 2.1 Why Duna beats Modal for these layouts

| Owner layout need (07) | Modal says | Duna says |
| --- | --- | --- |
| Painted landscape hero fading into the page (AGNCE, Nivara) | "There is no photography; the visual system is rendered, geometric and emissive." Painting breaks the style | The full-bleed painted landscape that fades into the canvas *is* the hero component |
| Light warm canvas (Liftoff, Nivara, Ironclad) | Void `#000000` canvas, dark only | Linen `#f7f7f5` canvas, light only |
| Split feature rows, zig-zag steps (Nivara, Liftoff) | "No split layouts", at most 3 columns | No rule against it; 1200 px centred column, generous rhythm |
| White floating product cards | Flat dark cards, shadow only on the nav | Paper White cards on Linen with a 1 px ring; nearly the same object |
| One dark button for every action (all four references) | Lime pill is the hero CTA, Ground Iron button elsewhere | Espresso `#160f0c` is the only filled-button colour |
| Calm, exact, accountable voice for anxious users | Developer terminal; reads cold and technical | "A quiet, editorial compliance document": a page that reads like something you would sign, which is the hero line |

Duna's cost is continuity: it has no chromatic accent and no dark section. Both are handled with one borrow (lime status dot) and one documented deviation (the single dark card), below.

### 2.2 Why not Cora

Cora is the most romantic fit and carries a serif. It loses on three rules that the owner's layouts break: its painting may not be cropped into cards (Nivara and Liftoff panels need crops), its text sits on the painting with no scrim (white on `#117bc8` is about 4.5:1 and fails below 18 px), and its palette is locked to cerulean and navy, which would replace the warm dawn-to-dusk valley in 07 and 08. Cora contributes one borrowed detail (the light serif's role).

### 2.3 The serif and warm-canvas cliché

Warm cream plus a decorative serif is a cliché unless something justifies it. Here three things do: the owner's own references use it (Liftoff's serif headline on a warm canvas, AGNCE's centred display line); the canvas is Duna's Linen `#f7f7f5`, which is near-neutral, not cream; and the serif has a product reason, because the hero line is "Job applications you would sign." The serif is the signature, so it appears only where a signature would: four lines that share a frame with art. Everything that explains is Duna's sans.

---

## 3. Reference lock

| Field | Lock |
| --- | --- |
| **Primary** | Duna ("sunset watercolour on warm marble"), [styles.refero.design/style/8cf4a580-bfb6-4090-a899-f734ffe62370](https://styles.refero.design/style/8cf4a580-bfb6-4090-a899-f734ffe62370). Owns mood, palette, sans type, radius, elevation, density and imagery roles |
| **Preserve from Duna** | Linen canvas, never pure white as base. 99 percent achromatic UI: the painting is the only saturated thing. Espresso is the only filled-button colour. Pill buttons and tags. Soft radii (nothing under 8 px). Elevation by 1 px ring and tint, no drop shadows on the page. Weight 400 display with tight tracking at 44 px and up, normal tracking below 18 px. Thin-stroke geometric line icons in Charcoal. Painting hues never become UI colours |
| **Borrow only (1)** | From **Cora**: the *role* of a light display serif for headlines that sit on or beside painted art, never for body, nav, buttons or anything under 24 px. Face: Instrument Serif 400 (07 D5) |
| **Borrow only (2)** | From **Modal** (current DESIGN.md): Lime Pulse `#7fee64` as an 8 px status dot only (passes, approved, live status), always with a 1 px Aubergine Ink ring and always next to the word it marks |
| **Layout-driven deviations** (not borrows; required by 07, kept as narrow as possible) | **V1** One painting master recurs as crops inside cards (Nivara panels). Duna's "one painted moment" becomes "one painted valley": the hero is the moment, panels are windows onto the same painting. **V2** One dark surface on the page: the A7 CTA card (Liftoff). **V3** One shadow token, only for white cards floating over art, where a 1 px ring alone disappears into brushwork |
| **Role rules** | Espresso = filled action only (not pills, not badges, not surfaces). Aubergine Ink = text, headings, logo, 1 px emphasis borders, the one dark card surface. Lime = 8 px status dot only. Art tokens (`--art-*`) = only inside art layers (`::before` of C4, C5, A10, A11 and the raster paintings); never on text, borders, buttons, badges, the connector or the toggle. Serif = four lines only (section 5). Stone = dividers and decorative rules only, never text |
| **Media strategy** | (a) Painted landscapes, generated with an image model (for example gpt-image or Imagen) from the 08 §3 briefs, then checked and painted over where needed, rights recorded in `web/public/landing/art/LICENSE.md`; Duna's quality: soft watercolour and gouache washes, no outlines. (b) Code-native grain gradients (CSS radials plus the SVG `feTurbulence` tile from 07 §5.2) for panels without painting, the dark card, the closing glow and the footer hills. (c) Floating product cards: real DOM (the Drop 1 islands), white, labelled SAMPLE. No CSS fakes of paintings, no stock photos, no 3D |
| **Reject** | Modal's void canvas, phosphor-green type, lime CTA and 3D cube on the landing. Wise's weight-900 caps display. Cora's cerulean palette and text-on-painting without scrim. Duna's logo bar and Stat Display with invented metrics (6.2x, 22 percent). Any second accent colour (07's `--accent-ember`, `--accent-valley`). Gradient rings on step badges and toggles. Grain on text zones. Coloured accent words in headlines (07 D7 closes as No) |

### 3.1 Token commitments

| Token | Hex | Source | Role |
| --- | --- | --- | --- |
| `--canvas` | `#f7f7f5` | Duna Linen | Page background; every art fade ends in this colour |
| `--surface` | `#ffffff` | Duna Paper White | Cards, floating cards, plan cards, status pill |
| `--sunk` | `#edece7` | Duna Bone | Nested panels, sample chip, eyebrow pill, FAQ icon circle, toggle track |
| `--field` | `#eeeeee` | Duna Mist | Input fields only |
| `--ink` | `#1b0624` | Duna Aubergine Ink | Headings, strong text, logo, featured-card border, dark card base |
| `--action` | `#160f0c` | Duna Espresso | Primary button fill. Nothing else |
| `--body` | `#444444` | Duna Graphite | Body text, input borders |
| `--muted` | `#5e5566` | New, darkened from Duna Warm Ash `#766a7c` | Captions, indices, sample chip text, legal row. Warm Ash fails on Bone (4.3:1) and on the hero haze (3.9:1); this keeps its hue and passes everywhere |
| `--icon` | `#292421` | Duna Charcoal | Line icons, nav links, connector line |
| `--rule` | `#898683` | Duna Stone | Hairline dividers, the connector line's dashes, ghost-button borders on Linen and Paper only. Never text |
| `--ring` | `rgb(0 0 0 / 0.05)` inset 1 px | Duna elevation | Every card edge |
| `--lime` | `#7fee64` | Modal Lime Pulse | 8 px status dot with 1 px `--ink` ring |
| `--on-dark` | `#f7f7f5` | Linen on the dark card | Text on A7 |
| `--on-dark-muted` | `#c9bfcf` | New | Secondary text on A7 |
| `--art-*` | 07 §5.1 and §5.2 hexes (dawn sky `#DCE7F2`, haze `#F6DCC8`, river `#E8A87C`, ridges `#9C8793`, meadow `#A9B48C`, glow periwinkle `#AAB6F2`, coral `#F08A5D`, amber `#F2B866`, olive `#A9A46A`, dusk `#6F74C9`, ember `#B4553A`) | Kairos valley | Art layers only (role rule above). Renamed from `--glow-*` so a lint can forbid `--art-` outside art selectors |

Retired from 07 §6.1: `--canvas #FBF8F3`, `--ink #18151F`, `--ink-2`, `--body #4A4550`, `--muted #625C66`, `--hairline`, `--control`, `--accent-ember`, `--accent-valley`, `--dark #1B1626`.

---

## 4. Decision ledger

| # | Decision | Source | Rule or role | Why |
| --- | --- | --- | --- | --- |
| L1 | Primary style is Duna; Modal DESIGN.md is not kept for the landing | Refero scoreboard (49 vs 45) | One primary owns mood, density, structure | Duna's hero and quiet editorial body match the owner's layouts; Modal's own rules forbid painting, split rows and light canvas |
| L2 | Canvas Linen `#f7f7f5`, cards Paper White, nested Bone | Duna | Linen is never replaced by pure white as the base | Light warm canvas the references need, without drifting into cream |
| L3 | Espresso `#160f0c` is the only filled-button colour | Duna | CTA colour stays CTA-only; status pill and badges do not use it | One dark button for every action, as in all four references |
| L4 | Text and headings in Aubergine Ink `#1b0624`; body Graphite `#444444` | Duna | Ink for headings, Graphite for paragraphs | 17.8:1 and 9.1:1 on Linen; calm, near-black, not navy |
| L5 | `--muted` darkened to `#5e5566` | Duna Warm Ash, adjusted | Same hue, AA on every light surface | Warm Ash fails on Bone and haze; anxious readers get no grey-on-grey |
| L6 | No chromatic accent in UI; 07's ember and valley accents retired | Duna | Painting hues belong to the artwork only | Keeps the painting the single saturated moment; prices and fit numbers are set in Ink |
| L7 | Lime `#7fee64` survives as an 8 px status dot only | Modal (borrow 2) | Fill only, 1 px Ink ring, always beside its word | Brand continuity with the app at near-zero cost; 1.4:1 on white, so the ring and word carry meaning |
| L8 | Display serif (Instrument Serif 400) for four art-sharing lines | Cora (borrow 1); Liftoff layout | Serif only at 36 px and up, only on or beside art | The owner's Liftoff headline; the hero line is about signing, so the serif reads as a signature |
| L9 | Sans: Inter Tight 400 for display and headings, Inter 400/500 for UI and body (free substitutes for GT America) | Duna | Weight 400 display, 500 only for card headings and labels; tracking tight only at 44 px and up | Both faces are already loaded; no new font cost besides the serif |
| L10 | Radius: 8 inputs, 16 cards, 24 media, 9999 pills | Duna | Nothing under 8 px | Collapses 07's seven radii to four |
| L11 | Elevation by 1 px inset ring; one shadow token only over art | Duna; deviation V3 | `--sh-over-art` never on Linen | Floating cards need separation from brushwork; everywhere else the page stays flat |
| L12 | One painted valley recurs as crops in A5 and A6 | Deviation V1 | Same master, crops clipped at 24 px; no second painting style | Nivara's panels need art inside cards; one master keeps Duna's "one painted moment" spirit |
| L13 | One dark surface: the A7 CTA card on Aubergine Ink with grain mesh | Deviation V2; Liftoff layout | Only one per page; inverse button is Paper White with Espresso label | The owner's Liftoff dark card; a single dark beat keeps the page light-led |
| L14 | Art made by an image model from the 08 §3 briefs plus code-native grain gradients | Duna imagery role; 07 §5 | Image-led style gets real art; no CSS fakes of paintings | Preserves the imagery role; one raster master plus procedural dusk keeps weight down |
| L15 | Step badges, toggle and connector lose their gradient rings and colours | Duna | Art tokens never on UI | Connector becomes a 1.25 px Charcoal pen line; reads as a signature stroke across the page |
| L16 | Section gaps 120 / 96 / 80 / 64; closing gap 160 | Duna (80 to 120) | Generous, document-like rhythm | Matches the lower density the owner asked for without 07's 200 px gaps |
| L17 | Prices shown at 72 px Inter Tight 400 tabular | Duna Stat Display, repurposed | Only true numbers; never invented metrics | Keeps Duna's signature big-number moment without fabricating outcomes |

---

## 5. Type scale

Faces: **Instrument Serif 400** (Google Fonts, latin subset, `font-display: swap`, metrics-matched fallback). **Inter Tight 400/500** for display and headings, features `"ss01"` off, `"tnum" "zero"` on numerals. **Inter 400/500** for UI and body, `"cv11"`. GT America's `-0.06em` is re-tuned to `-0.045em` on Inter Tight, which is already narrow; at the Duna value its letters collide.

| Token | Face | 1440 | 1024 | 768 | 390 | Line height | Tracking | Use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `--t-closing` | Serif 400 | 96 | 75 | 62 | 48 | 1.0 | -0.01em | A10 closing line |
| `--t-hero` | Serif 400 | 80 | 63 | 52 | 44 | 1.02 | -0.015em | A1 H1 |
| `--t-serif-h2` | Serif 400 | 52 | 46 | 40 | 36 | 1.08 | -0.01em | A6 spotlight H2, A7 dark card H2 |
| `--t-numeral` | Inter Tight 400 | 72 | 64 | 56 | 48 | 1.0 | -0.045em | Prices only |
| `--t-h2` | Inter Tight 400 | 44 | 40 | 36 | 32 | 1.1 | -0.035em | Section H2 |
| `--t-h3` | Inter Tight 400 | 32 | 30 | 28 | 26 | 1.2 | -0.025em | Step H3 |
| `--t-h4` | Inter 500 | 24 | 22 | 20 | 20 | 1.3 | -0.02em | Card titles, plan names |
| `--t-lead` | Inter 400 | 20 | 20 | 18 | 18 | 1.4 | -0.01em | Sublines |
| `--t-body` | Inter 400 | 18 | 18 | 17 | 17 | 1.5 | 0 | Body |
| `--t-body-sm` | Inter 400 | 16 | 16 | 16 | 16 | 1.6 | 0 | Card body, FAQ answers, floating-card lines |
| `--t-caption` | Inter 400/500 | 14 | 14 | 14 | 14 | 1.5 | 0 | Captions, legal, nav links (15) |
| `--t-micro` | Inter 500 uppercase | 12 | 12 | 12 | 12 | 1.2 | +0.04em | SAMPLE chip, card indices only |

Serif lines, the complete list: hero H1, spotlight H2, dark card H2, closing line. No text under 12 px; no body under 16 px.

---

## 6. Colour tokens and WCAG AA pairings

Computed with the WCAG 2.2 relative-luminance formula. AA: 4.5:1 body text, 3:1 large text (24 px, or 18.66 px bold) and non-text boundaries.

| Foreground | Linen `#f7f7f5` | Paper `#ffffff` | Bone `#edece7` | Mist `#eeeeee` | Hero haze `#F6DCC8` | Hero sky `#DCE7F2` | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `--ink` `#1b0624` | 17.8 | 19.1 | 16.2 | 16.5 | 14.6 | 15.3 | Pass everywhere |
| `--action` `#160f0c` (as text) | 17.7 | 19.0 | 16.0 | 16.3 | 14.4 | 15.1 | Pass everywhere |
| `--icon` `#292421` | 14.3 | 15.3 | 13.0 | 13.2 | 11.7 | 12.2 | Pass everywhere |
| `--body` `#444444` | 9.1 | 9.7 | 8.2 | 8.4 | 7.4 | 7.8 | Pass everywhere |
| `--muted` `#5e5566` | 6.6 | 7.1 | 6.0 | 6.1 | 5.4 | 5.7 | Pass everywhere |
| Duna Warm Ash `#766a7c` (retired as text) | 4.8 | 5.1 | **4.3** | **4.4** | **3.9** | **4.1** | Fails on Bone, Mist and art; not used |
| `--rule` `#898683` | 3.4 | 3.6 | 3.1 | 3.1 | 2.8 | 2.9 | Non-text boundary on Linen, Paper, Bone only. **Never text** |
| `--lime` `#7fee64` as fill | 1.4 | 1.5 | | | | | Fails 3:1 alone, so the dot carries a 1 px `--ink` ring (13.0:1 against lime) and sits beside its word |

| Pair | Ratio | Verdict |
| --- | --- | --- |
| White label on `--action` (primary button) | 19.0 | Pass |
| `--ink` on `--lime` (if a glyph ever sits on lime) | 13.0 | Pass |
| `--on-dark` `#f7f7f5` on dark card base `#1b0624` | 17.8 | Pass |
| `--on-dark-muted` `#c9bfcf` on `#1b0624` | 10.8 | Pass |
| `--on-dark` on mesh mid `#4a3a5c` | 9.6 | Pass |
| `--on-dark` on mesh bright `#6b5a86` | 5.7 | Pass for body; still keep text over the darkened centre ellipse |
| Espresso label on Paper White inverse button | 19.0 | Pass |

Rules:
1. No text on painted art outside the hero scrim. Scrim: `radial-gradient(60% 45% at 50% 30%, rgb(247 247 245 / 0.85), transparent 70%)`; worst case under text is haze `#F6DCC8`.
2. Floating cards carry their own Paper White fill, so their text is measured against `#ffffff`.
3. Ghost buttons over art use `rgb(255 255 255 / 0.7)` plus 8 px backdrop blur behind a 1 px `--rule` border (3.6:1 against the fill).
4. Focus ring: 2 px `--ink`, 3 px offset on light surfaces; 2 px `--on-dark` on the dark card.
5. Status words (passes, skipped, refused) are words in `--ink` or `--muted` plus the lime dot or a hollow 8 px square. No red, no green text.

---

## 7. Surfaces, radius, shadow, density

| Item | Value |
| --- | --- |
| Radius | `--r-input 8`, `--r-card 16` (problem cards, plan cards, floating cards, sample UI cards), `--r-media 24` (art panels, spotlight card, dark card, every image), `--r-pill 9999` (buttons, status pill, eyebrow pill, SAMPLE chip, toggle, step badges, FAQ icon). Nested radius = outer minus padding |
| Ring | `box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.05)` on every card |
| `--sh-over-art` | `0 1px 2px rgb(27 6 36 / 0.06), 0 12px 32px rgb(27 6 36 / 0.10)`. Only on white cards placed over a painting or a grain panel. Hover (M4) may raise the second layer to 0.14; no movement on coarse pointers |
| Grain | Only inside art layers: panels 8 percent, closing glow 8, footer hills 12, dark card 14 (`overlay`). Text zones 0 |
| Containers | `--c-wide 1200` (nav, footer; Duna page width), `--c-main 1120`, `--c-narrow 960`, `--c-copy 760` |
| Section gap | 120 (1440), 96 (1024), 80 (768), 64 (390); closing gap 160 / 128 / 112 / 88 |
| Card padding | 32 (1440, 1024), 24 (768, 390) |
| Density per section | One headline (8 words or fewer), one subline (20 words or fewer), one visual, at most one primary action. Eyebrow pills only where they carry a fact (see 9.12) |

---

## 8. Mapping onto the 07 archetypes

| Archetype | What Duna changes |
| --- | --- |
| A0 Nav | `--c-wide` 1200. Scrolled state `rgb(247 247 245 / 0.82)` with blur and a 1 px `--rule` at 40 percent opacity. Links `--icon` 15 px. Primary pill Espresso. Logo glyph Aubergine Ink |
| A1 Centred art hero | Painting fades into Linen. Status pill Paper White with ring, `--ink` 14/500 text, lime dot (Duna's dark announcement pill is not used, so Espresso stays CTA-only). H1 serif. Subline `--t-lead` in `--body`. Primary 56 px Espresso pill. Floating cards Paper White, `--r-card`, `--sh-over-art`; the fit number in `--ink` tabular, not ember |
| A2 Commitment strip | Text in `--ink` 16/500, caption `--muted`, separators `--rule`. Icons Charcoal 1.25 px stroke. No logos (Duna's logo bar is rejected: no customers) |
| A3 Problem trio | Cards become Duna feature cards: Paper White on Linen, ring, `--r-card`, 32 padding (was `--sunk`, radius 20). Line icons Charcoal 1.25 px stroke at the 07 size. Index in `--muted` micro |
| A4 Section intro | H2 Inter Tight 400 at 44, -0.035em. Subline `--t-lead` |
| A5 Zig-zag steps | Panels `--r-media` 24; painting crops (steps 1, 3) or grain panels from `--art-*` (steps 2, 4). Sample cards Paper White over art with `--sh-over-art`. Step badge: Paper White circle, 1 px `--ink` ring, `--ink` numeral (no gradient ring). Connector: 1.25 px `--icon` line, round caps, drawn on scroll (M6), no gradient |
| A6 Spotlight | Outer card Paper White, ring, `--r-media` 24 (was 28). Art half is the mid-morning crop. Serif H2. Floating approval card with lime approved dot |
| A7 Dark grain CTA card | Deviation V2. Base `--ink` `#1b0624`; mesh from art tokens (`#4a3a5c` mid, `#6b5a86` rising under the button, olive and dusk corners), darkening ellipse behind text, grain 14 percent. Serif H2 in `--on-dark`. Inverse button Paper White, Espresso label. `--r-media` 24 |
| A8 Pricing | Plan cards Paper White, ring, `--r-card`; featured card 1 px `--ink` border, no grain strip. Prices `--t-numeral` 72 in `--ink`. Toggle: Bone track, active segment Paper White pill with ring and `--ink` 15/500 label (no gradient ring, no glow, not Espresso). One Espresso CTA under the cards |
| A9 FAQ and compare | Rows separated by 1 px `--rule` at 50 percent opacity; question `--ink` 18/500; icon circle Bone; answer `--body` 16. Compare: "Typical auto-apply" in `--muted`, Kairos in `--ink` |
| A10 Art CTA band | Procedural dusk glow from `--art-*`, centre ellipse in Linen. Serif closing line. One Espresso pill (Paper White frosted card only if the glow behind the button is hot) |
| A11 Art footer | Light Linen footer (Ironclad), no grain in the link band. Headings `--ink` 15/500, links `--body` 15. Hairline `--rule`. Legal `--muted` 14. Dusk hills baked AVIF from `--art-*`; their top fades into `#f7f7f5` |

Motion (07 §8) is unchanged. Duna has no motion rules; the owner's references set the vocabulary.

---

## 9. What this changes in 08-restructure-plan.md

08's sections, copy, word counts and reuse map stay. These style values change:

1. **Tokens.** 08 §4 "Visual system deltas" points to 07 §6.1; it now points to section 3.1 here. Canvas `#FBF8F3` becomes `#f7f7f5`, ink `#18151F` becomes `#1b0624`, body becomes `#444444`, muted becomes `#5e5566`; primary button fill becomes Espresso `#160f0c`.
2. **Accent row retired.** 08 §4 "Accent: `--accent-ember` for stat numerals, `--accent-valley` for links" is removed. Prices and the hero card's "fit 82" are `--ink`; links are `--ink` with underline.
3. **Display type.** 08 §4 "Inter Tight 500 for every other heading (H2 44, H3 30)" becomes Inter Tight **400**, H2 44 at -0.035em, H3 32 at -0.025em. Body moves from 16 to 18 px (Duna body). Serif moments unchanged (hero 80, spotlight and dark card 52, closing 96).
4. **Cards.** 08 §4 "radius scale 6 to 28" becomes 8 / 16 / 24 / pill. "Warm shadows `0 10px 30px rgb(120 90 60 / 0.12)`" becomes the 1 px ring everywhere, with `--sh-over-art` only on cards over art. Problem cards (08 §1.4, "`--sunk` fill, radius 20") become Paper White, ring, radius 16. SAMPLE chip becomes a pill on Bone with `--muted` text (5.98:1).
5. **Lime.** 08 §4 lime row stands (8 px fill only) with the ring rule added. **O5 default flips to No:** the nav and footer glyph is Aubergine Ink. A 28 px lime glyph on Linen is 1.4:1 and would be a second lime role. Owner may still say yes.
6. **Hero (08 §5).** Status pill fill `--surface` (unchanged); dot ring `--ink #1b0624`. Scrim colour `rgb(247 247 245 / 0.85)`. Primary button 56 px Espresso. Fit number in `--ink`, not `--accent-ember` (08 §5.3 left card line 2).
7. **Step badges and connector (08 §1.5).** Gradient rings and the periwinkle-to-coral connector gradient are replaced by a 1 px `--ink` ring and a 1.25 px Charcoal line.
8. **Pricing (08 §1.7).** Prices at 72 px Inter Tight 400 (was 48 px). Featured card loses the 4 px grain wash strip (07 A8). Toggle loses the gradient ring and glow (07 §7.4).
9. **Footer (08 §6).** Text-zone grain 5 percent becomes 0. Hills fade into `#f7f7f5` (was `#FBF8F3`). Container 1200 (was 1280; gutters grow at 1440).
10. **Illustration briefs (08 §3).** Add to the shared style line: "soft watercolour and gouache washes, edges dissolving into an off-white `#f7f7f5` page". Generation path: image model first (Scenes A and B), Scene C as a crop of A; layers kept for parallax. Palettes unchanged; their hexes are now `--art-*` tokens.
11. **Rhythm and height.** Section gaps fall to 120 / 96 / 80 / 64 and the closing gap to 160, so the 1440 page drops from about 8,900 px to about 8,300 px.
12. **Density (recommended, owner to confirm).** Eyebrow pills stay only where they carry a fact: hero status ("25 free applications") and problem trio ("Reported, not measured"). Drop "How it works", "The moment", "Pricing", "Side by side" and "Questions" pills; the headlines already say it. Saves 10 visible words and four components.
13. **07 decisions closed by this document.** D5 Instrument Serif: confirmed. D7 coloured accent word: **No** (art hues may not be UI colour).

---

## 10. Owner options

| Option | Style | What you get | Cost |
| --- | --- | --- | --- |
| **1 (recommended)** | Duna, [styles.refero.design/style/8cf4a580-bfb6-4090-a899-f734ffe62370](https://styles.refero.design/style/8cf4a580-bfb6-4090-a899-f734ffe62370) (duna.com) | A quiet, near-neutral page where the painted valley is the only colour, every action is one dark pill, and the serif appears only on the four art-sharing lines. Lime survives as the status dot | Leaves the dark phosphor look on the landing; needs one generated painting master |
| 2 | Cora, [styles.refero.design/style/1ab3cde9-0833-4e38-8ada-fc23156f730e](https://styles.refero.design/style/1ab3cde9-0833-4e38-8ada-fc23156f730e) (cora.computer) | A more romantic page: a painted sky as the canvas, a light serif throughout the headlines, a navy CTA | The cerulean palette replaces the warm valley; crops into cards break its rules; three contrast fixes needed |
| 3 | Keep Modal, `docs/DESIGN.md` (modal.com) | Full continuity with the app: dark canvas, phosphor type, lime CTA | Every owner reference breaks its rules (painting, light canvas, split rows, gradients); the landing would not look like the references |

---

## 11. Owner amendment: frosted glass (2026-10-15)

Owner instruction (verbatim): "little change in style reference the keep Duna just use and follow froster glassmophisem style with dune".

Reading: Duna stays the primary style (sections 2 and 3 stand unchanged). A frosted-glass layer is added on top of it for surfaces that float over art. `docs/DESIGN.md` and `docs/04-ui-ux-brief.md` carry the full tokens; this section is the decision record. Where this section and sections 3, 6 or 7 disagree on how a surface that floats over art is filled, edged or shadowed, this section wins. Everything else in 09 is unchanged.

### 11.1 Rules

1. **Where.** Only on surfaces that sit over something to blur: painted art, the closing glow, the dark-card mesh, the footer hills, and the nav over scrolled content. Never on flat Linen sections: problem cards, pricing cards, compare and FAQ stay solid Paper White with the 1 px ring, because glass over a flat colour reads as a grey box.
2. **Light glass (default).** `background: rgb(255 255 255 / 0.64)`; `backdrop-filter: blur(20px) saturate(140%)`; `border: 1px solid rgb(255 255 255 / 0.60)`; inner top highlight `inset 0 1px 0 rgb(255 255 255 / 0.70)`; outer shadow `--sh-over-art`; radius 16 for cards, 24 for panels, 9999 for pills.
3. **Strong glass.** `rgb(255 255 255 / 0.78)`, same blur. Required for text at 14 px or smaller and for dense rows (receipt, inbox).
4. **Nav glass.** Transparent over the hero sky at the top. On scroll: `rgb(247 247 245 / 0.72)`, `blur(16px) saturate(140%)`, bottom border `1px rgb(255 255 255 / 0.5)` plus a hairline `rgb(27 6 36 / 0.06)`.
5. **Dark glass** (inside the dark CTA card only): `rgb(27 6 36 / 0.42)`, `blur(16px)`, border `1px rgb(255 255 255 / 0.14)`, Linen text.
6. **Pills on art** (hero status pill "25 free applications", SAMPLE chip on art, ghost buttons over art): light glass, pill radius, `--ink` Inter 14/500 text.
7. **Neutral frost only.** Never tint glass with art hues or lime. Lime stays the 8 px status dot.
8. **Calm zones keep soft colour.** The area under a glass card keeps soft colour variation (not flat white, not a flat fill) so the frost reads. This amends the "calm zone" notes in the `prompt.md` briefs; it does not allow detail there.
9. **Fallbacks.** `@supports not (backdrop-filter: blur(1px))`: `rgb(255 255 255 / 0.94)`. `@media (prefers-reduced-transparency: reduce)`: solid Paper White (light) or `#1b0624` (dark). `forced-colors`: `Canvas` with a 1 px `CanvasText` border.
10. **Performance.** At most 6 glass surfaces visible at once. Never animate the blur radius. Blur is 12 px below 768 px wide.
11. **Motion unchanged.** Hover on glass cards may raise the inner highlight to 0.85 and the second shadow layer to 0.14.

### 11.2 Contrast on glass (WCAG 2.2)

Glass composited over the darkest art tone that can sit behind a card, Ridge `#9C8793`. The blur averages the backdrop, so a flat composite is a fair model; `saturate(140%)` is not modelled.

| Text | Light 0.64 (`#DBD4D8`) | Strong 0.78 (`#E9E5E7`) | Nav 0.72 (`#DED8DA`) | Fallback 0.94 (`#F9F8F9`) |
| --- | --- | --- | --- | --- |
| `--ink` `#1b0624` | 13.1 | 15.3 | 13.6 | 18.1 |
| `--icon` `#292421` | 10.5 | 12.3 | 10.9 | 14.5 |
| `--body` `#444444` | 6.7 | 7.8 | 6.9 | 9.2 |
| `--muted` `#5e5566` | **4.9** | 5.7 | not used | 6.7 |

Result: `--muted` passes AA on light glass (4.86:1) but with under 0.4 of margin, and `saturate` can only deepen the backdrop, so `--muted` and `--body` at 14 px or smaller are restricted to strong glass (5.7 and 7.8). Stone `--rule` is 2.5:1 on light glass and 2.9:1 on strong glass, so glass controls carry no Stone border; the label (13.1:1) and the pill shape identify the control. Dark glass `rgb(27 6 36 / 0.42)` over mesh bright `#827BC8` composites to `#574A83`: Linen 7.2:1 passes; `--on-dark-muted` `#c9bfcf` is 4.4:1 and fails, so dark glass carries Linen text only (over the real mesh bright `#6b5a86` it is 6.0:1). Over mesh mid `#4a3a5c` Linen stays above 9.

### 11.3 Ledger

| # | Decision | Source | Rule or role | Why |
| --- | --- | --- | --- | --- |
| L18 | Add a neutral frosted-glass layer for surfaces over art: light 0.64, strong 0.78, nav 0.72, dark 0.42; Duna remains primary. Deviation V5 | Owner amendment 2026-10-15 | Glass only where there is a painting, glow, mesh, hills or scrolled content to blur; never on flat Linen sections; never tinted; strong glass for text at 14 px or smaller; fallbacks for no backdrop-filter, reduced transparency, forced colours; max 6 glass surfaces, blur never animated | Floating cards and pills read as frosted panes over the valley instead of white stickers, while the achromatic, document-like page and the Espresso-only action rule stay intact. Amends L11 (shadow over art now sits under a glass pane, not only under a white card) |

### 11.4 What changes in earlier sections (pointers only)

Sections 3 to 8 are not rewritten. Read them with these substitutions: Paper White floating cards over art (A1, A5, A6) become strong glass; the status pill (A1) becomes light glass; ghost buttons over art (section 6 rule 3: `rgb(255 255 255 / 0.7)`, 8 px blur, Stone border) become light glass with no Stone border; the scrolled nav (A0: `rgb(247 247 245 / 0.82)`, Stone hairline) becomes nav glass; the A10 note "Paper White frosted card only if the glow behind the button is hot" is now simply light glass; A7 gains dark-glass chips. V3 (one shadow token) stands, and the token now sits under glass as `--sh-glass`.
