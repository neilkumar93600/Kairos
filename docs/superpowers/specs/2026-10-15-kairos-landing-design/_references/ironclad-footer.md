# Reference teardown: "Ironclad Labs" footer

Source: `C:\Users\Lenovo\AppData\Local\Temp\claude\c--Users-Lenovo-Downloads-auto-career\24c3dc1a-8403-4858-89db-c83100d867d5\images\2.png`
Source size: 1200 x 740 px. All px values below are estimates scaled to a 1440 px desktop canvas (factor 1.2), unless marked "src" (source pixels).
Scope: footer only. The image shows no page above the footer and no CTA. The painted landscape is the footer's lower half.

---

## 1. Section order and jobs

| # | Section | Job for the visitor |
|---|---------|---------------------|
| 1 | Link band (brand block left, four link columns right) | Confirm who the company is, offer navigation, offer social follow |
| 2 | Hairline divider | Mark the end of navigation and start of legal |
| 3 | Legal row (copyright left, credit right) | Satisfy legal presence, sign the page |
| 4 | Painted landscape (full bleed, lower ~50% of the footer) | Atmosphere and brand sign-off; carries no information |

Reading order is strictly top-to-bottom, left-to-right. The landscape sits under the legal row, so the text never has to read over the colour-heavy art.

---

## 2. Component inventory and anatomy

### Section 1: link band

- **Logo lockup.** A solid black glyph (interlocking slanted blocks, about 24 src px square, about 28 px at 1440) followed by the wordmark "Ironclad Labs" in a semibold grotesk. Glyph and wordmark share one baseline, and the glyph's height matches the wordmark cap height.
- **Tagline.** Two-line sentence, 2 src lines, hard-broken at the natural measure of about 275 src px (about 330 px at 1440). Ends with a full stop. Uses a "name the product" pattern (`... using Ironclad Labs to simplify their workflow.`). This is the only body copy in the footer.
- **Social button row.** Four equal square icon buttons: X, Instagram, LinkedIn, YouTube. Outlined (1 px), transparent fill, small radius. No labels, no tooltips visible in the image.
- **Link columns (x4).** Each column is a heading plus a stacked list of text links. No icons, no arrows, no dividers between items.
  - Product: Features, Integrations, Pricing, Changelog, Roadmap, Security (6 links)
  - Company: About Us, Careers, Press Kit, Partners, Contact (5 links)
  - Resources: Blogs, Documentation, API Reference, Help Center, Community, Tutorials, Webinars (7 links)
  - Legal: Privacy Policy, Terms of Service, Cookie Policy, Compliance, Sitemap (5 links)

### Section 2: divider

- Single 1 px horizontal rule across the full container width (src x 66 to 1133). Mid-grey at low opacity.

### Section 3: legal row

- Left: copyright line, "© 2026 Nova, Inc. All rights reserved."
- Right: "Made with [heart] by Makora Studio", with the studio name as an underlined text link. Right-aligned to the container edge.

### Section 4: painted landscape

- Pure visual layer. Several overlapping hill ridges, a soft glowing streak, and grain. No text, buttons or cards sit on it.

---

## 3. Placement

- **Container.** Content spans src x 66 to 1133, which is 1067 src px, about 1280 px at 1440. Side gutters are about 80 px at 1440 (about 5.5% of the frame), so the container is 1280 px max with 80 px gutters. Left and right edges are shared by the logo, the divider and the legal row.
- **Alignment.** Brand block is left-aligned. Link columns are right-aligned as a group. The legal row is left-aligned on its left item and right-aligned on its right item. The painting is full bleed (edge to edge, no container).
- **Column split.** The brand block takes about 44% of the container width (src x 66 to about 474). The link group takes about 56% (src x 540 to 1133). Column starts are not on an equal grid: src x 540, 699, 846, 1026 (gaps of 159, 147 and 180 src px). The columns are content-width and separated by a fixed gap of about 84 to 89 src px (about 100 to 107 px at 1440), with the group pushed to the right edge. This looks like a flex row with `justify-content: space-between` or a fixed gap, not a 4-column grid.
- **Top alignment.** Logo and column headings share a top line (src y about 67 to 70). Both top-align; nothing is vertically centred.
- **Bottom of the left column.** Social buttons end at src y 210. The longest link column ends at src y 284. The two blocks do not share a bottom line.
- **Imagery relative to text.** Art starts at src y about 375 (about 51% of the frame height), below the legal row (src y 358). It is full bleed, sits behind nothing, and nothing floats over it.
- **Overlaps and layering.** None between text and art. The top pale ground and the art are one continuous surface: the art bleeds upward into the pale ground through a soft gradient. Text sits entirely on the pale zone.
- **Floating cards.** None. The footer does not use cards or floating elements.

---

## 4. Spacing rhythm (1440 px estimates)

| Relationship | Estimate |
|---|---|
| Footer top to logo top | about 80 px |
| Logo bottom to tagline top | about 24 px |
| Tagline bottom to social row top | about 44 px |
| Column heading (centre) to first link (centre) | about 48 px |
| Link pitch (centre to centre) | about 32 px (about 20 px line, about 12 px gap) |
| Link group bottom to divider | about 60 px |
| Divider to legal text (centre) | about 28 px |
| Legal text to top of painting | about 14 px |
| Social button square | about 41 px, gap about 7 px |
| Card padding | not applicable (no cards) |

Rhythm: the link list is airy (32 px pitch) against a tight tagline (20 px line). The vertical gap between the link group and the divider is roughly twice the link pitch, which gives the nav a clear end.

---

## 5. Typography

Everything is sans-serif. Letterforms look like Inter or a close neo-grotesk. No serif in the footer.

| Role | Weight | Size (1440 est.) | Line height | Tracking | Case | Colour |
|---|---|---|---|---|---|---|
| Wordmark ("Ironclad Labs") | 600 | about 30 px | about 1.1 | about -0.02em | Title | near-black |
| Tagline | 400 | about 15 px | about 20 px (1.35) | 0 | Sentence | grey, about 75% black |
| Column heading | 500 | about 17 px | about 1.3 | 0 | Title (sentence style in content) | near-black |
| Link | 400 | about 15 px | about 20 px | 0 | Sentence | grey, about 75% black |
| Copyright / credit | 400 | about 14 px | about 1.3 | 0 | Sentence | grey, about 70% black |

Accents: the only accent is an underline on "Makora Studio". There are no coloured words, no small-caps, no uppercase labels and no eyebrows.

---

## 6. Colour and imagery

### Backgrounds (hex estimates)

- Top-left ground: `#E7EEF8` (pale cool blue-grey)
- Top-right ground: `#EEF2F8`
- Mid band (src y about 290 to 340): `#F4F0F2` (warm neutral transition)
- Pink band (src y about 340 to 400): `#F7E4E8` (blush)
- The ground moves from cool at top to warm at the horizon. This is a vertical gradient with no hard seams.

### Painted art (bottom half, src y 375 to 740)

Layered ridges, each a soft, blurred gradient rather than a crisp silhouette:

- Back ridge, violet to blue: `#6F74E4` at the crest, `#5C6BD8` mid, fading into the pink ground at the top edge.
- Right back ridge, blue: `#6E86E0`, fading to `#A9B6F0` at the far right.
- Left magenta sweep: `#E8389F` to `#F0509F`, sweeping from the left edge up to about src x 300.
- Middle olive band: `#B9B76A` highlight to `#8E9A4F` shadow, sitting between the violet and the red.
- Bright horizon streak: `#FFD0C4` core with `#FF8A6A` falloff, running roughly left to right across src y 650 to 700.
- Foreground: coral-orange `#F0603F` to deep red-brown `#B23E2C` and `#7E2E22` at the bottom corners.

Fade-in: the art's top edge is faded upward into the pink ground over about 40 to 60 src px (about 50 to 70 px at 1440). The crest of the violet ridge dissolves into `#F7E4E8`. There is no visible horizon line.

### Grain and noise

- Grain is heavy and uniform across the whole footer, including the pale top ground, not only the art. At a 1200 px frame it reads as roughly 1 to 2 px monochrome noise.
- Estimated amplitude: about 8% luminance noise on the pale ground, about 14% on the art.
- Implementation hint: an SVG `feTurbulence` noise layer (baseFrequency about 0.8) at about 6 to 10% opacity over the whole footer, plus a second pass at about 14% over the art only.

### Glow, shadow, border, radius

- Glow: the horizon streak has a bloom (Gaussian blur about 30 to 60 px at 1440). No glow on text.
- Shadows: none.
- Borders: social buttons only, 1 px, mid-grey about `#8A8A8E`. Divider is a 1 px hairline, about `#B5B5B8` on the pale ground.
- Radius: social buttons about 6 px at 1440 (5 src px). Nothing else is rounded.

---

## 7. Buttons, nav and footer patterns

- **Social buttons.** 41 px square, transparent fill, 1 px border, about 6 px radius, icon about 19 px, icon stroke about 1.5 px, near-black. Four in a row, about 7 px gap. Icon-only: no visible text labels.
- **Nav.** Plain text links in four columns. Headings are the same sans at a heavier weight. No active state is visible. No hover state is visible in a still.
- **Legal row.** Left copyright, right credit. The credit link is underlined. No separate legal nav.
- **Logo.** Glyph plus wordmark as one lockup, top-left, the first thing the eye lands on.
- **Newsletter.** None in this image.
- **Primary button.** None in the footer.

---

## 8. Motion (inferred from a still; not verified)

The image is a single frame, so motion is inferred:

- **Art drift.** The hill ridges very likely drift slowly (a gradient-position or blur-offset animation over tens of seconds), and the streak likely shifts. Treat as an inference.
- **Grain.** Animated grain (a shifting noise offset at a stepped rate) is common in this style. Possible, unconfirmed.
- **Link hover.** Probably a colour shift to full black or an underline draw. Unconfirmed.
- **Social hover.** Probably a fill or a 1 to 2 px lift. Unconfirmed.
- **No marquee, no parallax on text, no floating cards** are visible in this footer.

For Kairos: any motion here should be slow and optional. Respect `prefers-reduced-motion` by freezing the art and the grain.

---

## 9. What makes it feel premium, and what to avoid

### Why it works

- **Hairline plus landscape.** The text zone is calm and quiet; the painting does all the emotional work below a single 1 px line. The split is a clear hierarchy.
- **Tonal transition instead of a colour block.** The footer ground moves from cool to warm to art without a hard seam, so the page feels continuous.
- **Restraint in type.** Three sizes (about 30, 17, 15 px), one family, two weights. Nothing is uppercase, nothing is tracked out.
- **Scale and edges.** The logo and the link group anchor the two ends of the row. Right-aligned columns and right-aligned credit close the composition.
- **Short link lists.** Five to seven links per column. Nothing is padded.
- **Grain as material.** It makes the gradient feel printed or photographic instead of digital.

### Patterns to adapt (and how)

- Logo lockup top-left, tagline below, social row below that. Keep this order.
- Right-aligned link group with a fixed gap, top-aligned to the logo.
- Single hairline, then a legal row, then the painting. Keep the painting below the legal row, not behind text.
- Grain over the whole footer, heavier over the art.

### Do not copy (dishonest or wrong for a pre-launch Kairos)

- **"Join thousands of companies already using ... to simplify their workflow."** This is a user-count claim. Kairos has no customers yet, so no such number, company count, or "trusted by" line. Replace with a factual, scoped sentence (for example: what Kairos does and does not do, in calm exact words).
- **Social links to accounts that do not exist.** Ship only real accounts. If none exist yet, drop the row; the structure holds without it.
- **Link items that point to nothing.** Changelog, Press Kit, Webinars, Partners, Integrations, Roadmap, Community, Blogs. Include only pages that will exist at launch.
- **Template leftovers.** The copyright names "Nova, Inc." while the brand is "Ironclad Labs". Kairos must use its own legal entity name consistently (confirm the entity with the owner).
- **Third-party credit.** "Made with heart by [studio]" credits a design agency. Only include a credit if it is true for Kairos and the owner wants it.
- **Saturated multicolour art.** The magenta, violet, olive and red are loud for a brand that is calm and exact. If the owner wants the warmth, tone the saturation down roughly a third and keep the grain.
- **Heavy grain on body text.** The text here sits on the cleaner pale top. Keep grain off text zones or reduce it there.

### Notes for Kairos (adaptation, not copy)

- Column ideas that fit the product (confirm each exists at launch): Product (How fit is decided, Approval, Truth lock, Pricing), Resources (Sample run, Receipts, Help), Legal (Privacy, Terms, Sending and approval policy, Cookies).
- Tagline: a factual one-liner in the brand voice, with no numbers.
- Art: use an original landscape or abstract gradient, toned for calm. Do not reuse this image.
- Type: sans for the footer. A serif is acceptable only for the wordmark if the brand uses one elsewhere.
