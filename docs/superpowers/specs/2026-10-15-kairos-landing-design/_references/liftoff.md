# Reference teardown: "Liftoff" full landing page

Source: `C:\Users\Lenovo\AppData\Local\Temp\claude\c--Users-Lenovo-Downloads-auto-career\24c3dc1a-8403-4858-89db-c83100d867d5\images\3.png`
Source size: 1200 x 4551 px. All px values below are estimates scaled to a 1440 px desktop canvas (factor 1.2), unless marked "src" (source pixels). Colours were sampled from the PNG, so they are within a few steps of the real tokens (JPEG-like softening on gradients).
Scope: the whole page, nav to legal row. The page is about 5460 px tall at 1440.

---

## 1. Section order and jobs

| # | Section | src y range | Job for the visitor |
|---|---------|-------------|---------------------|
| 0 | Nav bar | 0 to 50 | Brand, two links, log in, one primary action |
| 1 | Hero: serif headline, subline, one button, blurred colour band with floating profile cards | 160 to 590 | Say what it is in one sentence, show the product idea (people connect through people) as a picture, not a screenshot |
| 2 | Social proof: H2, subline, three rows of logos in a marquee | 720 to 1020 | Borrowed trust ("leaders from these companies use it") |
| 3 | Value trio: H2, subline, three icon + title + body columns | 1120 to 1410 | Name the three benefits in plain words (better fits, less noise, more warmth) |
| 4 | How it works: H2, subline, segmented toggle, then a zig-zag of four steps (cards and text) joined by a drawn connector line | 1540 to 3160 | Walk the visitor through the loop, end with an inline CTA on the last step |
| 5 | Dark gradient CTA card | 3285 to 3572 | Mid-page conversion for the second audience (hirers), with a trust line |
| 6 | FAQ, two columns | 3690 to 3910 | Answer objections; quiet, text only |
| 7 | Closing CTA: very large serif line over a full-bleed colour glow, one button | 4000 to 4260 | Emotional sign-off plus last conversion |
| 8 | Footer: logo + contact left, newsletter card right, legal row | 4340 to 4551 | Contact, newsletter, legal |

The page repeats one primary action ("Request access") four times: nav, hero, step 3, closing. The dark card uses a different action for the other audience. The page alternates "loud" and "quiet" bands: colour hero, plain logos, plain values, colourful step cards, dark card, plain FAQ, colour glow, plain footer.

---

## 2. Component inventory and anatomy

### 0. Nav
- Wordmark left ("LIFTOFF", heavy condensed grotesk, all caps, about 77 x 17 px).
- Two text links centred in the bar ("Hire with Liftoff", "About us"), 13 px regular, about 45 px apart.
- Right cluster: plain text link "Log in", then a dark filled button "Request access" (118 x 37 px, radius 10 px, fill `#1a1126`, white 13 px medium label).
- No border, no background change; the nav sits on the page colour.

### 1. Hero
- **H1**, serif, two lines, centred: "Find incredible people, / through people you trust." Hard line break after the comma.
- **Subline**, one line, sans, grey.
- **Primary button** "Request access" (140 x 48 px, radius 12 px, fill `#171226`).
- **Colour band** ("orb field"): one very wide horizontal smear of blurred colour behind the cards, spanning almost the full viewport (src x 60 to 1140, y 320 to 580). Left to right: mustard-gold `#a98322` core, warm orange `#f7b94c`, a peach/coral middle, lavender `#d3d6f9`, sky blue `#c4d9f4`. It reads like a long-exposure light streak. Edges fade to page colour with a very large blur (estimated 80 to 120 px).
- **Floating profile cards** (2): white, radius 12 px, about 211 x 95 px. Anatomy: 38 px circular photo, name (13 px semibold), role (11 px grey), then a sentence row with a muted lead-in and a bold object ("Hiring a **Head of Marketing**", "Interested in **Early stage AI**").
- **Floating avatars** (4): 38 px circles with a 16 px white "share" arrow badge on the lower-right edge.
- **Event chips** (2): small translucent cards (about 106 x 40 px, radius 6 px, white at about 70% with a peach tint from the band behind) with a 12 px icon and two short lines ("Shared / Amber's search", "Recommended / Daniel").
- The whole cluster tells a story left to right: hiring person, network relays the search, candidate on the right.

### 2. Social proof
- **H2**, sans semibold, two lines: "Exceptional leaders are / using Liftoff to connect."
- **Subline**, two lines, grey.
- **Logo marquee**: three rows, about 9 logos visible per row, monochrome near-black, each logo about 24 px tall. Rows are offset so logos do not line up vertically. Left and right edges fade to page colour (logos at the edges are at about 30% opacity).

### 3. Value trio
- **H2**, sans semibold, two lines ("Hiring and networking / that feels human.").
- **Subline**, one line.
- **Three columns**, each: a blurred colour orb (about 84 px, soft radial gradient: pink-red, periwinkle, orange) with a 1.5 px line icon in near-black centred on it (sparkles, heart, smiley, about 29 px); a 15 px semibold title; a two-line 12.5 px grey body. No card, no border.

### 4. How it works
- **H2** single line ("How Liftoff works"), **subline** two lines.
- **Segmented toggle**: pill container about 250 x 58 px with a 1.5 px gradient border (orange to lavender to orange) and a faint outer glow; active segment is a dark pill (`#171226`, about 120 x 36 px) with white label; inactive label is dark text on white. Switches the steps between audiences ("For connecting", "For hiring").
- **Step rows** (four tiles in a zig-zag):
  - **Gradient art panel**: about 450 x 336 px, radius about 17 px. Each panel is a soft mesh gradient with one saturated corner fading to warm white: panel 1 hot pink `#f83b7d` top-left to lilac `#d5c4e4` top-right to cream `#ebe8e1` bottom; panel 2 orange `#ff6622` left to sky `#cadcf4` right; panel 3 lavender/peach; panel 4 orange `#fd8247` bottom-left to lilac `#dbcaec` right. Panels have no border and the gradient dissolves into the page colour at one or two edges, so the panel reads as a glow, not a box.
  - **Product UI cards** inside each panel: white, radius 14 px, about 333 px wide, soft shadow, sometimes stacked (a ghost card peeking above the front card to imply a feed). They contain realistic fragments: interest chips (pill tags in lilac `#e5e3f6`), a list with small brand icons and avatar stacks, a notification header ("Jamie Lewis shared with you"), a large role title, an action row with an arrow ("I know a potential fit"), a profile with "Context from you" quote bubble, a thank-you message.
  - **Floating overlap chip**: in panel 3 a small pill ("You shared Renee with 6 people" with an avatar and arrow) hangs off the lower-left edge of the UI card and crosses the panel boundary by about 20 px.
  - **Text block** beside each panel: step badge (29 px circle, 1 px gradient ring, numeral 13 px), H3 sans semibold two or three lines, body two lines grey. Step 3 adds a small dark button "Request access".
  - **"OR" divider**: between the two right-hand step variants (2a and 2b), a 1 px hairline across the text column with a small grey "OR" label near its left end. Steps 2a and 2b share the badge "2".
  - **Connector line**: a 2 px stroke that leaves the bottom-centre of one panel, drops about 50 px, turns with a 30 to 36 px radius, runs at a shallow diagonal across the gutter, turns again and enters the top-centre of the next panel. Its colour is a gradient (pale blue near panel 1, warm peach near later panels), at about 60% opacity. Between 2a and 2b it is a short straight vertical stroke.

### 5. Dark CTA card
- Contained card, not full bleed: 900 x 344 px, radius about 26 px.
- Background: grainy mesh gradient. Deep aubergine `#1d152a` top-left, dark violet across the top, periwinkle `#827bc8` glowing up from the bottom centre, khaki/olive `#757154` in the top-right corner, misty teal `#9ebcc6` bottom-right. Visible fine grain.
- Content centred: serif H2 in white, two lines ("Access exceptional / talent with Liftoff."); a trust line with three 17 px square brand favicons then grey-white text "Trusted by fast-growing teams like Ramp, Loom, and Substack"; a white button with dark label (252 x 48 px, radius 10 px).

### 6. FAQ
- Left column: H2 "Frequently / asked questions", sans semibold, 24 px, two lines.
- Right column: accordion. Each row: question 14.5 px semibold, a 19 px circular icon button (light grey fill `#f1ece9`, plus or minus glyph) at the right edge, a 1 px rule `#f1ece9` below. The open item shows three short paragraphs of grey body text, 14 px, with 18 px paragraph gaps. Only three questions are shown.

### 7. Closing CTA
- Very large serif line, two lines, centred ("Networking / without the noise.").
- One dark button (same as hero).
- **Glow band** behind it: full bleed, about 420 px tall, periwinkle `#abb9f6` on the left, coral `#f17c47` and amber `#f1b464` on the right, with a lighter, almost white centre so the headline stays readable. The band fades to page colour above and below and its lower edge runs under the footer.

### 8. Footer
- Left column: wordmark (larger than nav, about 100 px wide), "Get in touch" 12.5 px semibold, email address 12.5 px.
- Right column: newsletter card (574 x 151 px, radius about 17 px, fill a frosted pinkish white `#f6eced` that lets the glow show through, 1 px faint border). Contents: a tiny abstract illustration (orange dot, olive dot, blue-violet gradient pill) top-left, title "Subscribe to our Substack, Warm Intro" 17 px semibold, one-line grey description, right arrow at the right edge, vertically centred to the title.
- Legal row: copyright starts at the newsletter card's left edge (not the logo's), Privacy Policy and Terms of Service right-aligned with a small dot separator, all 12.5 px grey.
- No link columns, no social icons, no divider.

---

## 3. Placement

- **Container**: 900 px wide (src 750, x 225 to 975), centred, 270 px side margins at 1440. Every text block, panel, card, FAQ and footer column sits inside it. Only the hero colour band, the logo marquee and the closing glow break out to full bleed.
- **Nav**: logo on the container's left edge, button on its right edge; centre links centred on the viewport.
- **Hero**: everything centred on one axis. H1 measure about 523 px (line 2 is the longer line). The cards cluster is wider than the text (about 700 px) and its visual centre sits slightly left of the page centre because the left card is bigger and the band's hottest part (gold/orange) is left of centre. The floating cards sit on the band's vertical centre line; the band is about 3x the cards' height so colour shows above and below every card.
- **Layering in the hero**: page colour, then blurred band, then avatars and event chips (no shadow, translucent), then the two white profile cards (front-most, light shadow). The cards are placed on the band's colour transitions (left card on the gold-to-orange edge, right card on the lavender-to-blue edge), so each card has a different tint glowing around it.
- **Logo rows**: full bleed, each row centred on the page, with a horizontal mask fading the outer 120 px on each side.
- **Value trio**: three equal columns, centres 312 px apart, the trio block about 830 px wide, text centred under each orb.
- **How it works**: the container splits 50/50 (450 + 450). Panels alternate: step 1 left, steps 2a and 2b right, step 3 left. The text column on the opposite half is indented about 53 px from the panel edge and is vertically centred on the panel. When the panel is on the right, the text starts at the container's left edge (left-aligned, not right-aligned). Text measure is about 290 px for H3 and 250 px for body: short lines.
- **Connector**: always joins the horizontal centres of two consecutive panels; it is the only element that crosses the gutter between halves, so it visually stitches the zig-zag into one path.
- **Dark CTA card**: full container width, content centred.
- **FAQ**: two columns at about 1:2. Left heading block 312 px from container left edge to the accordion (heading column about 260 px, accordion 588 px). Heading top aligns with the first question's baseline row.
- **Closing CTA**: centred. Line 1 spans about 315 px at 1440 (src 470 to 732), line 2 about 460 px (src 410 to 792). The glow's hottest colours sit outside the text's left and right edges, never behind the letters.
- **Footer**: two columns at the same split as the FAQ (left 312 px, right 588 px starting at the same x as the accordion and the newsletter card). This shared right column line (src x 485 to 497) ties FAQ, newsletter and copyright together.

---

## 4. Spacing rhythm (px at 1440)

| Gap | Value |
|-----|-------|
| Nav height | 60 |
| Nav bottom to H1 top | about 130 |
| H1 bottom to subline | 14 |
| Subline to button | 22 |
| Button to top of colour band | about 0 (band starts at the button's bottom edge; its blur rises behind the button) |
| Colour band height | about 312 |
| Hero band bottom to next H2 | about 170 |
| H2 bottom to subline | 20 to 24 |
| Subline to logo rows | 58 |
| Logo row pitch | 77 |
| Logo rows to next H2 | 130 |
| Value subline to orb row | about 80 |
| Orb to title | about 16 |
| Title to body | 6 |
| Value trio to "How it works" H2 | about 160 |
| Subline to toggle | 24 |
| Toggle to first panel | 59 |
| Panel to text column (horizontal) | 53 |
| Badge to H3 | 14 |
| H3 to body | 18 |
| Vertical gap between zig-zag panels | about 150 (bridged by the connector) |
| Gap between stacked step 2a and 2b panels | about 72 |
| Last step panel to dark card | 150 |
| Dark card internal padding | about 90 top and bottom |
| Dark card H2 to trust line | 14; trust line to button 34 |
| Dark card to FAQ | about 140 |
| FAQ row height (closed) | 60 |
| FAQ to closing headline | about 225 |
| Closing headline to button | 26 |
| Closing button to footer logo | about 110 |
| Newsletter card padding | about 22 horizontal, 24 vertical |
| Footer content to legal row | about 46 |
| Legal row to page bottom | about 45 |

Rule of thumb: section-to-section gaps are 130 to 170 px; heading-to-subline is about 20 px; subline-to-action is about 24 px. Within cards the padding is 16 to 22 px. The page breathes a lot vertically but packs each section's own elements tightly.

---

## 5. Typography

| Role | Face | Size at 1440 | Weight | Line height | Tracking | Notes |
|------|------|--------------|--------|-------------|----------|-------|
| Hero H1 | Serif (transitional, high contrast, sturdy; similar to Tiempos Headline, Signifier or Gelica) | about 50 px | Medium to semibold | about 1.05 | about -0.02 em | Sentence case, hard line break, ends with full stop |
| Closing headline | Same serif | about 64 px | Medium | about 1.1 | about -0.02 em | Largest type on the page |
| Dark card H2 | Same serif, white | about 36 px | Medium | 1.1 | -0.01 em | |
| Section H2 | Sans (neo-grotesk; similar to Inter Display, Söhne or Geist) | about 38 px | Semibold (600) | about 1.1 | about -0.03 em | Sentence case, always ends with a full stop except "How Liftoff works" |
| Step H3 | Sans | about 24 px | Semibold | 1.2 | -0.02 em | Two or three short lines |
| FAQ heading | Sans | about 24 px | Semibold | 1.2 | -0.02 em | |
| Subline / body | Sans | 15 px (hero), 14 to 14.5 px elsewhere | Regular | 1.45 | 0 | Grey `#4d4747` to `#6b6463` |
| Value title | Sans | 15.5 px | Semibold | 1.3 | 0 | |
| Small body (value, card) | Sans | 12.5 px | Regular | 1.45 | 0 | Lighter grey `#8a8483` |
| Nav and buttons | Sans | 13 to 14 px | Medium (500) | 1 | 0 | |
| UI card text | Sans | 11 to 13 px; role titles in cards 20 px semibold | | | | Muted prefix + bold object pattern |
| Wordmark | Heavy condensed grotesk, all caps | | Black | | Slightly tight | |

Accent treatments: no coloured words, no italics. Emphasis comes from the serif/sans switch (serif = emotional statements at the top, middle and end; sans = explanatory headings) and from bold objects inside sentences in the UI cards. Ink is a near-black with a violet cast (estimate `#16121f`).

---

## 6. Colour and imagery

- **Page background**: warm off-white `#fffaf6`, drifting slightly pinker (`#fff9f9`, `#fff7f8`) in the middle sections. No section has its own background fill except the dark card.
- **Primary dark**: `#171226` to `#1a1126` (violet-black) for buttons and the active toggle.
- **Imagery**: there is no photography or illustration except avatars. All "art" is blurred colour fields: the hero band, the value orbs, the step panels, the dark card, the closing glow, the newsletter illustration. The palette rotates through gold, orange, coral, hot pink, lilac, periwinkle and sky blue, and every field contains at least one warm and one cool colour.
- **Fades**: colour fields have no hard edges except the step panels and the dark card. The hero band and closing glow fade into the page on all sides through very large blur (gaussian, 80 to 120 px). The step panels have rounded edges but their gradients end in near-page-colour cream on one side, so they melt in.
- **Grain**: clearly visible on the dark card; faint on the closing glow and step panels. Monochrome noise at about 4 to 8% opacity, fine (1 px).
- **Glows**: the toggle has a soft coloured outer glow matching its gradient ring. The value orbs are themselves glows.
- **Shadows**: white cards use a very soft, wide shadow (estimate `0 8px 24px rgba(40,20,60,0.08)` plus a 1 px `rgba(0,0,0,0.04)` ring). Buttons have no shadow.
- **Borders**: almost none. Hairlines `#f1ece9` only in the FAQ and the OR divider; 1 px gradient ring on the toggle and step badges; a faint 1 px edge on the newsletter card.
- **Radii**: buttons 10 to 12 px (not full pill); toggle full pill; profile cards 12 px; UI cards 14 px; step panels 17 px; newsletter card 17 px; dark card 26 px; chips 6 px; tags full pill. Radius grows with element size.

---

## 7. Buttons, nav and footer patterns

- **One button style dominates**: dark violet-black fill, white medium label, radius 10 to 12 px, 48 px tall in the hero and closing, 37 to 40 px in nav and steps. Only exception: the white button on the dark card (inverted). No secondary or ghost buttons anywhere; "Log in" is a plain text link.
- **Single CTA per block**: the hero has one button, not a pair. Each section offers at most one action.
- **Nav**: logo left, two links centred, log in + button right. No dropdowns. Probably sticky (not visible in a static capture).
- **Footer**: minimal and short (about 250 px). It sits partly on the closing glow, so the page ends in colour rather than a grey slab. The newsletter is a card, not a bare input, and links out (arrow) instead of collecting an email inline.

---

## 8. Motion that can be inferred

- **Logo marquee**: three rows scrolling horizontally, probably alternating direction or speed (rows are offset; edge masks are a marquee tell). Slow, about 30 to 60 s per loop.
- **Hero cards**: likely a gentle idle float (2 to 6 px vertical drift, staggered phases) and possibly a sequenced reveal that plays the story: left card, share arrow avatars, "Shared" chip, "Recommended" chip, right card. The colour band may slowly drift or breathe.
- **Value orbs**: probably a slow hue or scale pulse.
- **Toggle**: the dark pill slides between segments; step content swaps (crossfade) for the other audience.
- **Connector line**: very likely drawn on scroll (stroke-dashoffset tied to scroll progress), leading the eye from step to step. Panels and their UI cards likely rise and fade in as the line arrives.
- **UI cards inside panels**: likely small staged entrances (ghost card then front card; chip slides out from the edge).
- **Dark card and closing glow**: possible slow gradient drift; grain is static.
- **Hover**: buttons likely darken or lift 1 to 2 px; FAQ rows toggle with a height animation and plus-to-minus icon swap.

---

## 9. What makes it premium, and what not to copy

### Why it feels premium
1. **Restraint in layout, richness only in colour.** One centred axis, one container, one button style, almost no borders. All the "wow" is in the blurred colour fields, which are cheap to render and hard to make look bad.
2. **Serif for feeling, sans for explaining.** Three serif moments (hero, dark card, closing) bracket the page; everything between is calm sans. That rhythm gives it an editorial voice.
3. **Product shown as stories, not screenshots.** UI fragments are cropped to the one sentence that matters ("Amber is hiring for Head of Marketing at AI Startup") and floated on art. The visitor reads the product's outcome without parsing a dashboard.
4. **A drawn path through the steps.** The connector line turns a list of features into one journey, which also makes the zig-zag feel intentional.
5. **Generous vertical air, tight local grouping.** 130 to 170 px between sections, 14 to 24 px inside them.
6. **Warm, not white.** `#fffaf6` paper plus violet-black ink is softer than pure white and black, which suits an anxious audience.
7. **Ending in colour.** The closing glow running under the footer means the last thing on screen is atmosphere, not a link dump.

### What Kairos should borrow (structure)
- Section order: hero with one CTA and a story cluster, a proof band, a value trio, a toggled "how it works" zig-zag with a connector line, a dark CTA card, a two-column FAQ, a big serif closing over a glow, a short footer with one card.
- The hero story cluster maps well to Kairos: a job card on the left ("Senior Data Analyst, fit 0.82"), a "Checked against your facts" chip, a "Waiting for your approval" chip, and a "Sent after you approved" card on the right. Same anatomy (muted lead-in + bold object), same placement on colour transitions.
- The toggle maps to Kairos audiences or modes (for example "Students on OPT" / "Laid-off engineers", or "What Kairos does" / "What it refuses to do").
- The zig-zag steps map to the Ledger entries (fit gate, truth lock, approve, receipt), with the connector line as the ledger thread.
- The FAQ split and the footer newsletter card can be copied nearly as is.

### What to avoid copying (honesty and fit)
- **The logo marquee and its headline** ("Exceptional leaders are using ..."). Kairos has no customers; showing company logos would imply endorsement that does not exist. Replace the slot with something verifiable: the rules Kairos follows (for example "Applies only above your fit threshold", "Never writes a fact you did not confirm", "Sends nothing until you approve"), or the job sources and standards it works with, labelled as sources, not customers. If logos of job boards are shown at all, the label must say "Searches listings from", never "Trusted by".
- **The dark card's trust line** ("Trusted by fast-growing teams like Ramp, Loom, and Substack" with favicons). Drop it or replace it with a factual line (price, cancellation, data handling).
- **Real-looking people in the UI cards.** Liftoff uses photo avatars with names. For Kairos use clearly sample data (initials or abstract avatars, "Sample run" label) so nothing reads as a testimonial or a real user's outcome.
- **"Request access" scarcity language** works for an invite-only network; for Kairos use the real action (join the waitlist, or start) and do not imply exclusivity or demand that is not real.
- **Pure decorative orbs on every section.** The value trio orbs are pretty but content-free; Kairos could keep them only if the icon carries meaning, and should not stack more than about four colour fields on one screen, or the calm brand voice turns into noise.
- **Low-contrast grey body text** (`#8a8483` at 12.5 px on `#fffaf6` is close to the WCAG AA limit). Kairos should keep small body text at `#5e5856` or darker and at least 14 px.
- The heavy condensed wordmark and the exact orange-pink-lilac palette are Liftoff's identity; borrow the method (warm plus cool blurred fields on warm paper), not the exact colours.
