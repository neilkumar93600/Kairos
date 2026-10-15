# Reference teardown: "Nivara" landing page

Source image: `images/4.png` (984 x 1024 px composite). Two page columns sit side by side. The left column (x 58 to 513, about 455 px wide) is the top of the page. The right column (x 535 to 925, about 390 px wide) is its continuation.

## How the numbers were derived

- All sizes below are estimates at a 1440 px wide desktop.
- Left column scale is 1440 / 455 = x3.17. Right column scale is 1440 / 390 = x3.69.
- Cross-check: the feature-row container measures 352 px wide in the left column (1114 px at desktop) and 303 px wide in the right column (1119 px at desktop). So the two scales agree and the feature container is about 1120 px.
- Hex values are eyeballed from a compressed screenshot and are good to roughly +/- 6 per channel.
- Motion cannot be seen in a still image. Section 8 is inference only, and is labelled that way.

## 0. One-paragraph summary

A neutral near-white page (#F9F9F9). Almost all colour and warmth comes from two painted river-valley landscapes (the hero and the closing CTA) and from orange numerals on small floating stat cards. The page is a single centred rhythm: eyebrow pill, large slate sans headline, short grey subline, then one idea. Every proof block (the four feature rows) is a bordered white card. One half of that card is painted art. A white dashboard mock-up and a floating stat card sit on top of the art. The whole page is one sans-serif family at light-to-medium weight with tight tracking. Section spacing is very generous, about 160 to 250 px between blocks.

## 1. Section order and the job each section does

| # | Section | Job for the visitor |
|---|---|---|
| 0 | Nav (floats on the hero) | Brand, 3 anchor links, 2 CTAs. Always present. |
| 1 | Hero: trust pill, H1, subline, 2 buttons, painted valley | Say what it is in one sentence, offer two ways in, set the mood. The art does the emotional work. |
| 2 | Logo strip: "Built and trusted by teams at" + 8 logos | Social proof, immediately after the first promise. |
| 3 | Problem ("Why Nivara"): eyebrow, H2, side paragraph, 3 cards numbered 001 to 003 | Name the pain in three nouns: No Visibility, No impact measurement, No guidance. |
| 4 | Product intro: eyebrow, centred H2, subline | Hand-off from problem to solution. A pure heading beat with lots of air. |
| 5 | Feature rows x4, alternating art side | Show the product proving each promise. Each row is one heading, one sentence and one visual. Order: Usage Intelligence (art left), "See how your teams are adopting AI" (art right), Monitor the impact (art left), Understand your ROI on AI Spend (art right). |
| 6 | Integrations: eyebrow, H2, arc of 8 round icons around a painted pill, paragraph | Ecosystem fit ("it works with what you already use"). |
| 7 | Closing CTA: very large H2, subline, one black button, painted valley rising behind and below | Repeat the single action at the emotional peak. |
| 8 | Dark footer bar: logo, copyright, 4 round social buttons, email | Close. The only dark surface on the page. |

Notes on what is absent: there is no pricing, no FAQ and no testimonials. The page is short: 1 hero, 1 proof strip, 1 problem, 1 solution block with 4 rows, 1 integration beat, 1 CTA. The only objection handling is the problem trio.

## 2. Component inventory with anatomy

### Nav (section 0)
- Layout: logo left, 3 text links centred, 2 buttons right.
- Logo: a small orange/red chevron glyph plus the lowercase wordmark "nivara" in a sans at about 22 px, weight 500.
- Links: about 13 to 14 px, #1A1A1A, no underline.
- Buttons: a secondary outlined button ("Get Early Access") and a primary black button ("Book A Demo"). Both are about 40 to 44 px tall and about 8 to 10 px radius.
- The nav is transparent. It sits on the near-white top of the hero and has no visible bar or border.

### Hero (section 1)
1. Trust pill, centred. It reads "Backed by [accelerator mark]". It is a small white capsule with a 1 px #ECE7E3 border, about 36 px tall and 230 px wide, 12 px text, with a tiny orange logo chip.
2. H1, two lines, centred, slate.
3. Subline, two lines, centred, grey.
4. Button pair: black primary "Book A Demo" on the left, outlined secondary "Get Early Access" on the right. The secondary has a translucent light fill and a 1 px dark-grey border, so it reads over the mist.
5. Painted landscape: mauve mountains left and right, a pink-orange river winding to the foreground, golden grass banks, pale pink wildflowers in front. There is no frame and no card. The art is full-bleed, edge to edge, and the headline block sits in the sky area above and partly on top of the faded mountain tops.

### Logo strip (section 2)
- Caption line: "Built and trusted by teams at", centred, 14 px, #6B6B6B.
- A single row of 8 wordmarks in their original colours, not greyscale. They span about 1100 px, evenly spaced.
- The first and last logos are faded out (low opacity, soft edge). That is the visual signature of a mask-fade marquee.

### Problem (section 3)
1. Eyebrow pill, left aligned. It reads "Why Nivara". Fill #EFEFEF, no border, about 28 px tall, 11 to 12 px text, #666.
2. H2, two lines, left aligned. "AI is everywhere, but invisible."
3. Side paragraph, in the right column of a two-column row, top aligned with the first line of the H2. It is 4 lines, about 15 to 16 px, #4A4D55, about 345 px wide.
4. Card trio. Each card holds, from top to bottom:
   - an index "001" / "002" / "003" in tiny grey (about 11 px)
   - a large thin-line geometric icon (about 110 px): a crossed-out circle, stacked diamonds, a radiating starburst
   - a bold-ish title (about 22 px, weight 500)
   - a 3-line description (about 15 px, #5A5C62)

### Product intro (section 4)
- Eyebrow pill "Product" (centred), H2 in two lines (centred), subline in two lines (centred). There is no button.

### Feature row (section 5), the signature component
Outer card:
- A wide white-ish rounded rectangle, about 1120 x 450 px, #FCFCFC, 1 px #EDEDED border, radius about 24 px. No heavy shadow.

Inside it:
- A two-column split of about 47 / 53. The art half is about 47 percent. The text half is about 53 percent.
- **Art half:** a painted sunset landscape (peach, amber, mauve, soft teal) filling that half edge to edge, with the card's radius clipping the outside corners.
- **White mock-up panel:** a flat, near-white UI mock, about 70 percent of the art half wide. It is anchored to the outer edge of the card (the left edge for the art-left rows, the right edge for the art-right rows) and bleeds off that edge. It contains skeleton content: peach bars, grey blocks and a faded ghost stat such as "78%".
- **Floating stat card:** a white card with a 1 px border and a soft shadow. It overlaps the boundary between the white mock and the painted art, so it half sits on each. In row 3 a stack of three small stat cards does this job.
- **Text half:** the heading (about 32 px, near-black, weight 500, 1 or 2 lines) and a body paragraph (about 15 px, #555, 2 to 3 lines, about 300 px max width), with the block vertically centred and left aligned.

Floating stat card anatomy:
- A tiny micro-label ("Active Users", "OVERALL ADOPTION RATE"), 9 to 10 px, grey, sometimes uppercase with letter-spacing.
- A large orange numeral (689, 81%, +51%, 1416%). It is about 36 to 44 px and weight 500 to 600, in a warm orange (#E8963F, close to #F0A24C).
- A tiny grey caption (for example "689 / 850 engineers") with an optional micro-icon.
- Some cards also carry a small orange sparkline or "crown" mark.

### Integrations (section 6)
- Eyebrow pill "Integrations", centred H2 in two lines.
- A central painted stadium pill labelled "Catalyst" (white text over a cropped version of the same landscape art), about 330 x 110 px, fully rounded.
- Eight round icon buttons, 4 each side, each about 46 px, fill #EDEDED, a coloured or black glyph inside. They follow an arc: the outermost pair sits lowest, the pair next to the pill sits highest, so the whole row reads as a gentle arch around the pill.
- Very thin connector hairlines join the discs to the pill (nearly invisible).
- Behind the arc is a very large barely-visible ring (1 px, #EEE).
- Below is a centred 3-line paragraph, about 535 px wide.

### Closing CTA (section 7)
- A very large two-line H2 (centred), a 2-line subline, a single black button.
- The second painted valley (different composition: rolling golden hills, conifers, a pink river and distant blue-mauve ridges) rises from the bottom edge. Its top dissolves into a pink-cream haze that sits behind the button.

### Footer (section 8)
- A full-width dark bar, about 170 px tall, #2B2B2D.
- Left: logo in white, with the copyright line in grey underneath.
- Right: four circular icon buttons (about 40 px, fill #3A3A3D, white glyphs: X, LinkedIn, and two others), with a small underlined email address underneath.
- No link columns, no newsletter.

## 3. Placement

### Page frame
- Everything is centred on a single vertical axis. Nav, hero and CTA are fully centred. Section 3 is the one exception (left-aligned H2 with a right-hand side paragraph). Sections 4 and 6 are centred again.
- Container widths at 1440 px:
  - nav about 1350 px (44 px side padding)
  - problem section about 1170 px
  - feature rows about 1120 px
  - hero text column about 700 px (the H1 is about 684 px wide)
  - subline max about 520 to 540 px
  - integrations arc about 1000 px wide
- The two image bands (hero and CTA) are the only full-bleed elements. Everything else is contained.

### Hero layering (back to front)
1. Page background (#F9F9F9 at the very top).
2. Painted landscape. Its top edge starts roughly at the subline and dissolves upward into the page background with a vertical gradient. Its bottom edge dissolves into the page background again (a white mist over the foreground flowers). So the art has no hard edge at all.
3. Trust pill, H1, subline and buttons sit on top. The H1 sits in the clear sky zone above the mountains. The subline and buttons overlap the faded mountain tops. Contrast is protected because the mountains are heavily washed there.
4. Nav floats above everything.

Hero proportions at 1440 px: the art is roughly 1.9 : 1 (about 1440 x 760). The full hero including nav and caption runs about 1150 to 1200 px, so the foreground flowers and mist reach below a typical 900 px fold, and the logo strip is below the fold.

### Problem section split
- A 12-column grid in effect. H2 occupies the left 7 columns. The paragraph occupies the right 3 to 4 columns, top aligned to the H2 cap line, about 345 px wide, right edge flush to the container edge.
- The three cards are equal columns, about 380 x 400 px each, with 16 to 20 px gaps. They fill the 1170 px container exactly.

### Feature row placement
- Rows alternate sides: art left, art right, art left, art right. Text half is the opposite side.
- Vertical gap between rows: about 30 px. The four cards read as a single stack.
- In each row the white mock bleeds off the card's outer edge and the floating stat card straddles the inner join. So every row has an identical three-layer stack: painted art, then white mock, then floating card. The position of the mock varies (it hugs the top edge in row 1, it is inset from the top in row 2). That variation is deliberate so the rows do not feel copy-pasted.
- Floating cards sit at about 15 to 25 percent from the card's top, and straddle about 40 percent of their width over the painted area.
- The text block is optically centred in its half, with about 70 to 100 px of inner padding on the side nearest the art.

### Integrations
- Arc symmetric about the page centre. The painted pill is the focal point and sits slightly above the icons' baseline.

### Closing CTA
- H2, subline and button are all centred. The button lands in the pink haze zone that sits at the top of the art, so the button is over the lightest part of the painting. The art's lower half fills to the dark footer with no gap.

## 4. Spacing rhythm (1440 px estimates)

| Gap | Value |
|---|---|
| Nav height | about 80 px (44 px side padding) |
| Nav to trust pill | about 90 px |
| Trust pill to H1 | about 24 px |
| H1 to subline | about 24 px |
| Subline to buttons | about 24 to 28 px |
| Button gap (pair) | about 16 px |
| Button height | about 52 px, about 150 to 190 px wide, radius about 8 px |
| Hero text block to art edge | art starts roughly under the subline (overlap, no gap) |
| Logo caption to logos | about 30 px |
| Logo row to next section (Why) | about 180 px |
| Eyebrow pill to H2 | about 24 to 28 px |
| H2 to card grid (Problem) | about 90 px |
| Card inner padding | about 24 px |
| Card index to icon | about 30 px |
| Icon to title | about 60 to 70 px (title sits pinned to the lower third) |
| Problem cards to Product eyebrow | about 200 px |
| Product H2 to subline | about 24 to 28 px |
| Product subline to first feature row | about 100 px |
| Feature row height | about 450 px |
| Gap between feature rows | about 30 px |
| Floating stat card padding | about 20 px |
| Feature text to art | 70 to 100 px inner padding |
| Last feature row to Integrations eyebrow | about 240 px |
| Integrations arc to paragraph | about 40 px |
| Integrations paragraph to CTA H2 | about 290 px |
| CTA H2 to subline | about 24 px |
| CTA subline to button | about 30 px |
| CTA art height (visible) | about 650 to 700 px |
| Footer height | about 170 px, side padding about 70 to 90 px |

The takeaway is that block spacing is about 3 to 5 times the heading size, while the spacing inside a block is tight (24 px steps). Large empty bands between blocks are what makes the page read as calm.

## 5. Typography

One sans-serif family throughout. It looks like Inter or a close neo-grotesk. There is no serif anywhere and no display face.

| Role | Size | Weight | Line height | Tracking | Colour | Case |
|---|---|---|---|---|---|---|
| H1 (hero) | about 66 to 70 px | 400 to 500 | about 1.1 | about -0.03em | slate #3A3F4B | Sentence case |
| Section H2 (Problem, Product, Integrations) | about 50 to 54 px | 400 to 500 | about 1.15 | about -0.025em | slate #3A3F4B | Sentence case |
| CTA H2 | about 64 px | 400 to 500 | about 1.1 | about -0.03em | slate #3A3F4B | Sentence case |
| Feature heading | about 30 to 32 px | 500 | about 1.15 | about -0.02em | near-black #141414 | Sentence case |
| Card title (Problem) | about 22 px | 500 | 1.2 | -0.01em | #141414 | Sentence case |
| Body / subline | 15 to 18 px | 400 | 1.55 to 1.65 | 0 | #5A5C62 to #666 | Sentence case |
| Eyebrow pill | 11 to 12 px | 400 to 500 | n/a | 0 | #666 | Sentence case |
| Micro-label in stat card | 9 to 10 px | 500 | n/a | +0.04em | #8A8A8A | Uppercase for the main label |
| Stat numeral | 36 to 44 px | 500 to 600 | 1 | -0.02em | orange #E8963F | n/a |
| Index "001" | about 11 px | 400 | n/a | +0.05em | #9A9A9A | n/a |
| Buttons | 14 to 15 px | 500 | n/a | 0 | white or #141414 | Title Case ("Book A Demo") |

Accent treatment: headlines have no colour accents, no italic, no underlines. Colour accent appears only in the stat numerals (orange). Headline colour is a cool slate for section headings and near-black for smaller headings, so there are two ink tones.

Visual character: big light headings with tight tracking and a short measure (2 lines). Because the weight is light, the big type feels airy against the heavy painted art.

## 6. Colour and imagery

### Page tones
- Page: #F9F9F9 (neutral, very slightly cool), not cream.
- Problem cards: #F2F2F2, no border, no shadow. They are quieter than the page.
- Feature outer cards: #FCFCFC with 1 px #EDEDED.
- Floating cards: #FFFFFF with 1 px #EEE9E5.
- Pills: #EFEFEF (eyebrow) or white with a warm border (trust pill).
- Footer: #2B2B2D.
- Buttons: primary #0B0B0B, text white. Secondary: transparent / light with 1 px #3A3A3A border.
- Orange accent: #E8963F (numerals), pale peach #FBE3D4 (skeleton bars, sparkline).

### Painting palette
- Sky and haze: #F6DCC8, #F4C9A0.
- River and glow: #E8A87C, #E99B80, #F1B7A4 (pink).
- Grass: #D98F4E, #C97F3E.
- Mountains: mauve #9C8793, #8C7B91, distant #B9A6B4.
- Foreground flowers: #F2C9CC, #FFFFFF.
- CTA art adds conifer green-black #33463F, olive hills #A8A05A and cool blue ridges #A9B3C9.
- Style: soft digital painting, low contrast, no outlines, atmospheric perspective (far mountains almost the same value as the sky).

### How art meets the page
- Vertical white gradient masks at the top and bottom of both full-bleed paintings. Roughly the top 15 to 20 percent and the bottom 15 percent of each image are faded to the page colour. There is no hard crop line.
- On the CTA the fade at the top is warm (pink-cream), not white, so it carries a hint of the art's glow into the text zone.
- Inside the feature cards the art is hard-clipped by the card radius. So the soft fade is used only at full-bleed bands, and the hard clip is used for contained art.

### Grain and glow
- No visible film grain in this reference. It is smooth, not noisy. If Kairos wants grain, that comes from the other references, not this one.
- No coloured glows or orbs. The warmth is supplied by the painting itself.

### Shadows, borders and radii
- Floating cards: shadow about `0 10px 30px rgba(120, 90, 60, 0.12)` plus a 1 px hairline border, radius about 12 px.
- Feature outer cards: border only, no real shadow, radius about 24 px.
- Problem cards: no border, no shadow, radius about 12 px.
- Pills: fully rounded (999 px).
- Buttons: about 8 px radius (soft rectangle, not a pill).
- Icon discs: circle. Integration pill: stadium.

## 7. Buttons, nav and footer patterns

### Buttons
- Always as a pair in the hero: black solid first (primary), outlined second. Black primary is the only solid button on the whole page.
- The CTA at the bottom uses a single black button.
- Copy is Title Case and verb-first. Radius is a soft 8 px.
- On the near-white page, black plus slate headline gives the page its only high-contrast moment.

### Nav
- Logo left. Links centred as one tight group. Both buttons right, same pair as the hero (outlined plus black). The page therefore shows the same two CTAs in the nav and the hero.
- No sticky background is visible, so any sticky treatment is unknown.

### Footer
- Minimal. A dark bar beneath the painted CTA: logo, copyright, four round social buttons, one email link. There are no link columns.
- It acts as a "ground" under the painting. The art ends exactly at its top edge, so the dark bar reads like a horizon line.

## 8. Motion you can infer (not visible in a still)

These are inferences only.
- **Logo marquee:** the first and last logos fade out, which suggests an infinite horizontal scroll with edge masks.
- **Floating cards:** the stat cards straddle the join between art and mock, which suggests a small parallax or gentle float (a few px) and a hover lift (translateY about -4 px and a stronger shadow).
- **Hero art:** a slow vertical parallax or a very slow scale is likely, as the mist gradients hide the edges.
- **Scroll reveal:** each section is isolated by generous padding, which suggests a fade-up on entry.
- **Integrations arc:** the discs likely drift or orbit slightly, and the connectors likely draw in.
- **Buttons:** likely a subtle hover (inverted or slightly lifted).

## 9. What makes it feel premium, and what to avoid copying

### Why it feels premium
1. **Restraint.** There is one font, two ink colours, one accent colour (orange) and one black button.
2. **Painted art as the only decoration.** There are no icons-in-circles, gradients or glassmorphism on the page. The two paintings carry all the warmth.
3. **Soft-edged art.** The paintings fade into the page, so the hero has no hard "image box".
4. **Big, light headings** at 2 lines max, tight tracking, lots of air around them.
5. **Generous vertical rhythm.** Gaps between sections are 160 to 290 px.
6. **A repeated, layered component.** Art, then white mock, then floating stat card. It is the same recipe four times, with the side and the bleed varied, so it feels designed rather than templated.
7. **Calm problem trio.** Cards are almost the same tone as the page, with thin-line icons. They stay quiet so the art can speak later.
8. **Typographic hierarchy by tone.** Slate for big headings, near-black for small headings, grey for body.

### What not to copy (dishonest or irrelevant for a pre-launch Kairos)
- **Customer logo strip** ("Built and trusted by teams at": Uber, Oracle, UCLA and others). Kairos has no customers. Keep the strip's position and mask-fade style but fill it with something true, for example three or four plain-text commitments (fit-first, confirmed facts only, nothing sent until you approve).
- **"Backed by" investor or accelerator pill.** Do not imply any backing. Use a truthful pill such as "Pre-launch" or "Waitlist open".
- **Fabricated metrics on floating cards** (689 active users, 81% adoption, +51%, 1416% ROI). Kairos must not show invented outcomes. The floating-card slot should show real mechanics: a fit score for a sample posting, a confirmed-fact citation, an approval prompt. Mark any such card as a sample.
- **"50+ integrations" or named third-party app icons** around the pill. That implies partnerships. If an arc is used, put Kairos's own steps (find, check fit, tailor from confirmed facts, ask, send) around the pill instead.
- **"Book a demo" CTA language.** Kairos is not a demo-led B2B product. Use the real action (join the waitlist or start).
- **ROI claims,** since the ROI row promises a measurable return. Replace it with what Kairos actually guarantees.
- **Two-line orange numerals as proof.** Keep the orange (or warm) numeral style, but only for facts that are true by construction (for example "0 sent without approval").

### Pieces of structure that translate directly to Kairos
- Hero: eyebrow pill, 2-line H1, 2-line subline, black plus outlined button pair, soft-edged painted landscape filling the lower half.
- A problem trio (numbered, line-icon cards) for the anxious-job-seeker pains.
- Four alternating feature rows with the art / white mock / floating card stack, using the product's own UI states.
- A centred final CTA with a second painted band rising into a dark footer.
- Sections that Nivara lacks and Kairos needs: honest billing, FAQ and the Approve moment. Place them using the same pill, H2, subline pattern and the same container widths.
