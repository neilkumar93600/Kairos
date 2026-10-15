# Reference teardown: "AGNCE" hero

Source: `images/5.png` (hero only; nothing below the hero is shown in the reference).

Scale: the browser card is about 644 px wide inside a 736 px image. Treated as a 1440 px desktop, 1 image px is about 2.24 css px. Card height is about 407 image px, or about 911 css px, which suggests a 1440 x 900 viewport. All values are estimates with roughly plus or minus 10 to 15 percent error. Hex values are read by eye from the image.

## Quick spec (1440 css wide)

| Item | Value |
|---|---|
| Nav height | about 96 px, inset 40 px left and right |
| Trust pill | about 340 x 36 px, centred |
| H1 | 2 lines, about 74 px, weight 600, line-height 1.05, tracking about -0.03em |
| Subline | 2 lines, 18 px, line-height 1.5, measure about 560 px |
| Primary CTA | black pill, about 240 x 54 px, 16 px label |
| Art | full-bleed, bottom about 60 percent of the card, top edge fades to white |
| Columns | none, single centred stack |
| Floating cards, logos, icons, marquee in hero | none |

## 0. Frame

- Presentation canvas is flat grey, about #D9D9DB. It is not part of the design.
- The card sits at image x 46 to 690 and y 211 to 618.
- Corner radius about 20 css px.
- Edge: 1 px white inner edge with a light grey outer ring, about #E2E2E6.
- Shadow: a broad, soft, low-contrast drop shadow, roughly `0 30px 60px rgba(20,24,32,0.14)`.

## 1. Section order and the job of each

Only the hero is visible, so the order below is the full known order.

1. **Nav bar.** Orients the visitor, gives brand recognition, and offers one conversion path ("Get Started"). The four text links are secondary.
2. **Hero.** Makes the promise in one headline, adds a social-proof pill above it, gives a two-line product description, and offers one action ("Try It Free for 30 Days"). The painted landscape sets the mood.

Nothing below the hero is visible, so the reference gives no evidence for later sections. Do not infer a section order beyond these two.

## 2. Component inventory and anatomy

### 2.1 Nav bar (full card width, about 96 css tall)

- **Logo wordmark**, left, inset 40 px. Text "AGNCE" in a thin, wide-tracked, custom-looking uppercase face. Colour about #2D6EDB. Width about 80 px, cap height about 16 px.
- **Link group**, centred on the card's vertical axis (not centred between logo and button). Four links: Features, Benefits, Pricing, About. Size about 15 px, weight 500, colour about #2B323D. Gap between links about 40 px.
- **Primary button**, right, inset 40 px. Pill, black (about #0B0B0C), white label 15 px weight 500. Size about 150 x 46 px.
- No visible bottom border, no sticky-bar background, no dropdown chevrons. The nav sits on the same near-white as the hero top.

### 2.2 Trust pill (centred, about 75 px below the nav)

- Container: pill, background about #E9EBEF, full radius, about 340 x 36 px.
- Avatar stack: two circles about 22 px, overlapped by about 6 px, with a thin white ring.
- Label: 14 px, weight 500, colour about #3E4652.
- Copy in the reference: "Trusted by 500+ Agencies Worldwide". This is a claim Kairos must not make (see section 9).

### 2.3 H1 (centred, two lines)

- Line 1: "Transform How You", colour about #323A46 (dark slate, not black).
- Line 2: "Run Your Agency", colour about #1E6AF0 (saturated blue).
- Same size and weight on both lines. The accent is colour only: no italics, no underline, no highlight shape.
- Line 1 is about 628 css px wide, so the H1 block is about 640 px wide, roughly 44 percent of the viewport.

### 2.4 Subline (centred, two lines)

- Copy in the reference: "Streamline invoicing, onboarding, client CRM, team operations, and commission tracking, all in one place."
- Colour about #3E4652, weight 400, about 18 px, line-height about 1.5.
- Measure about 550 css px, set by a max-width of about 560 px and a line break after the first clause group.

### 2.5 Primary CTA (centred, single)

- Black pill, about #0B0B0C, full radius, about 240 x 54 px.
- Label "Try It Free for 30 Days", white, 16 px, weight 500.
- Only one button in the hero. No secondary ghost button, no arrow icon, no text link.

### 2.6 Painted landscape (background, bottom about 60 percent of the card)

Layers, back to front:

1. Sky gradient, blue, from about #6FB5EE at the top of the art to a pale horizon near #D3E8F6.
2. Three cloud clusters. Left cluster sits about x 165 to 570 css, y 430 to 590 css. Right cluster sits about x 1130 to 1440 css, y 400 to 560 css. Small cloud wisps sit in between. Clouds are white with lilac-pink undersides (about #EBC9DA).
3. Distant mountains, pale blue-grey (about #B9CDE0 at 60 percent opacity), about x 230 to 565 css, y 710 to 780 css.
4. Mid tree cluster, about x 555 to 725 css, y 690 to 825 css.
5. Far-left tree mass, cropped by the card's left edge. Canopy is partly orange-tinted (about #C98A3D) and partly green (about #6F9E47). Spans about x 0 to 205 css.
6. Right tree group, about x 1120 to 1310 css, y 615 to 715 css.
7. Rolling foreground hill, lime at the top (about #A8CB68), mid green (about #8DB456), olive shadow at the base (about #5F8A3B), pale grass highlights (about #D9E8A6).
8. Barn with a dark roof, cropped by the right edge. Walls about #8A4B35, roof about #3D3A3F. Sits on the hill crest, about x 1300 to 1440 css, y 560 to 700 css.

Style: painterly, anime-like, with ink-style linework on trees and the barn. This is illustration, not photography.

## 3. Placement

- **Nav alignment.** Edge-aligned: logo to the left, button to the right, both inset 40 px. The link group is centred on the card axis, independent of the two edge items.
- **Hero alignment.** Fully centred on the card axis (image x about 368). Everything is stacked in one column, with no side-by-side split.
- **Container.** No visible grid. Each element has its own measure: H1 about 640 px, subline about 560 px, CTA sized to its label. Nav content spans the full width minus 40 px per side.
- **Column split.** None. The art is a background layer, not a column.
- **Vertical position.** Content block runs from about 175 css px below the card top (trust pill) to about 530 css px (CTA bottom). That puts the copy in the upper 58 percent of the card. The art starts at about 46 percent of the card height and runs to the bottom edge.
- **Overlaps and layering (back to front).** Art, then the sky fade, then the text. The sky fade runs behind the lower H1 and the subline, so the dark text sits on a white-to-blue transition. Clouds do not overlap text. Trees and the barn are cropped by the card's side edges on purpose (bleed). Nothing floats over the art.
- **Art alignment with text.** The horizon sits near CTA height. The tree and barn masses are pushed to the far left and right, which leaves open sky in the centre so the text has no competing detail. The barn is the only object near the right edge at mid height.

## 4. Spacing rhythm (css px at 1440)

| Gap | Estimate | Basis |
|---|---|---|
| Nav height | 96 | image about 43 px |
| Nav inset (left and right) | 40 | image about 19 px |
| Nav link gap | 40 | image about 18 px between words |
| Nav bottom to trust pill top | about 72 | image about 32 px |
| Trust pill bottom to H1 top | about 26 | image about 12 px |
| H1 line 1 baseline to line 2 baseline | about 75 | line-height about 1.05 at 74 px |
| H1 bottom to subline top | about 30 | image about 13 px |
| Subline line-height | about 27 | 1.5 at 18 px |
| Subline bottom to CTA top | about 26 | image about 12 px |
| Content block total | about 355 | pill top to CTA bottom |
| Art top fade length | about 150 | gradient from transparent to full art |

- Card padding: none. The card has no inner padding. The 40 px nav inset is the only horizontal inset.
- Section padding: not measurable beyond the hero. Treat the hero top as about 175 px of air above the content block, which is the main premium cue.

## 5. Typography

- Sans-serif throughout. No serif, no display face in the hero.
- **H1:** neo-grotesk, geometric or Inter-like (Inter Display, Geist or similar). Weight 600. About 74 px (range 68 to 80). Line-height about 1.05. Tracking about -0.03em. Sentence case, no uppercase.
- **Trust pill label:** 14 px, weight 500, no tracking.
- **Subline:** 18 px, weight 400, line-height 1.5, colour about #3E4652.
- **CTA label:** 16 px, weight 500.
- **Nav links:** 15 px, weight 500.
- **Logo:** custom thin uppercase wordmark with wide letter-spacing (about 0.08em), blue.
- No eyebrow in small caps. The pill does the eyebrow's job.
- Accent is colour only, on the second H1 line.

## 6. Colour and imagery

- **Page top:** near-white, about #FAFAFB. Nav and hero top share this background.
- **Text:** H1 about #323A46, subline about #3E4652, nav links about #2B323D.
- **Accent:** about #1E6AF0 on H1 line 2. Logo about #2D6EDB.
- **Primary button:** about #0B0B0C background, #FFFFFF label.
- **Trust pill:** about #E9EBEF background, no border.
- **Art fade:** a linear gradient mask from transparent to opaque over about 150 css px, blending the art into the near-white page at its top. Full width, no side fades. The art does not read as a boxed image because of this fade.
- **Grain or noise:** none visible. Texture comes from the painting itself.
- **Glows:** none in the hero.
- **Shadows:** only the outer card shadow (section 0).
- **Borders:** 1 px white inner edge on the card; the trust pill has none.
- **Radii:** card about 20 css, all pills and the CTA full radius.

## 7. Buttons, nav and footer

- **Buttons:** solid black pill in both the nav and the hero, white label, no border, no icon. One button style, used twice. No ghost or secondary style in the hero.
- **Nav:** transparent on the page background, links in dark slate, no underline visible, no sticky state visible, no icons.
- **Footer:** not in the reference. Not inferable.

## 8. Motion (inferred from a still, not verified)

- Clouds probably drift slowly, horizontal, on a long loop. Low confidence.
- Art may parallax on scroll, with the hill moving slower than the trees and barn. Low confidence.
- Button hover probably darkens slightly or lifts a few pixels. Unknown.
- No logo marquee, no animated counters, no typing effect is visible in the hero.

## 9. What makes it feel premium, and what to avoid

### Premium traits to keep

- Restraint: one headline, one line of accent colour, one button, one image. Nothing competes.
- The art dissolves into the page through a white-to-sky fade, so the illustration never reads as a box.
- Generous air above the content block, with the copy sitting in the upper half of the card.
- One black pill style for every action, consistent radius, one accent colour.
- A card shadow that is soft and low-contrast.
- Painterly warmth against a clean sans-serif. The contrast between a warm image and a precise type system is the core of the look.

### Avoid copying (for Kairos: pre-launch, calm, exact, accountable)

- **"Trusted by 500+ Agencies Worldwide" and the avatar stack.** This implies customers and a count. Kairos has no customers, so it may not show logos, testimonials, user counts or ratings. Keep the pill slot if useful, but fill it with a true, non-numeric status line (for example, the product stage or the fit rule). Or drop the pill.
- **"Try It Free for 30 Days".** This is a trial claim Kairos cannot make pre-launch, and it conflicts with the approve-first and honest-billing rules. Use a waitlist or fit-check action. Copy belongs to `06-copy-deck.md`.
- **Agency vocabulary.** "Agencies", "Run Your Agency", invoicing, commission tracking. Wrong audience. Kairos serves OPT and STEM OPT students, new grads and laid-off tech workers.
- **Ghibli-like art.** Imitating a recognisable studio look carries taste and rights risk. Use original painted art or licensed art with clear rights, and make sure the look fits the calm, exact voice.
- **Nav links to pages that do not exist.** Only keep links that point to real sections.
- **Pure-blue accent word in the headline as a default.** It is one option. Kairos can use a quieter accent (for example, the brand colour) if it fits the warm, calm direction better.

### Structure to transfer to the Kairos hero (for the next step, not a copy spec)

- Nav: logo, three or four links to sections that exist, one primary button.
- Hero: a status pill (no counts), a two-line H1 with the second line in accent, a two-line subline, one primary action, and a painted landscape covering the lower 55 to 60 percent of the frame, faded into the page top.
- Keep the spacing ratios from section 4 and the centred single stack.
