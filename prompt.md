# Kairos landing: image prompts (gpt-image-2)

One image per website section, in page order. Each painting carries **that section's message about job applications**, told with one symbolic object in the same painted valley, so the page reads as one story from morning to evening:

> A path leads to an open door (the right job) → a gate lets only fitting job letters through → a resume pinned to its facts → a sealed letter waits on a bridge until you approve → a receipt is filed → replies arrive in a mailbox → at dusk the path reaches the door.

Generate each image with **gpt-image-2**, save it at the exact path shown, and the page picks it up with no code change (the build ships soft placeholders at these paths until you replace them). Save PNG; `next/image` converts to AVIF and WebP.

**What is not an image.** The three problem icons (#3), the product cards that float over the paintings (match card, sample run, refusal, Approve card, receipt rows, inbox rows), the pricing cards, the comparison, the FAQ and the commitment strip are real website UI built in code, so they stay sharp and true. The paintings sit behind or beside them.

## Style rules (from docs/DESIGN.md)

Source of truth: `docs/superpowers/specs/2026-10-15-kairos-landing-design/09-style-direction.md` (Duna primary). Every painting prompt below obeys these rules; if you change a prompt, keep them.

- **Palette:** only the `--art-*` hexes in 09 (dawn sky `#DCE7F2`, haze `#F6DCC8`, river `#E8A87C`, ridges `#9C8793`, meadow `#A9B48C`, glow periwinkle `#AAB6F2`, coral `#F08A5D`, amber `#F2B866`, olive `#A9A46A`, dusk `#6F74C9`, ember `#B4553A`) and the tints 08 section 3 derives from them, plus Linen `#f7f7f5` for fades into the page.
- **Look:** soft digital painting, flat colour fields, soft brush edges, no outlines, edges dissolving into off-white `#f7f7f5`. Grain is added in CSS, so do not paint film grain.
- **Never in a painting:** people, faces, hands, animals, readable text, logos, real brands or studios.
- **Art hues stay in the art.** They are never used for UI text, buttons, borders or badges.
- **Calm zones:** every layout note below marks where text or cards sit; keep those areas low in detail.
- **Frost needs colour to blur:** cards over art are frosted glass (docs/DESIGN.md, "Frosted glass layer"), so the calm zone under each card must keep soft colour variation (peach into sage into pale blue), not flat white and not a flat fill. Low in detail, but never flat; otherwise the frost reads as a grey box. No hard shapes, objects or readable edges there.
- **One valley.** All paintings are the same valley in the same style. Every painting after Scene A (#1) is an edit of Scene A.
- **Deviation V4 (owner-approved 2026-10-15):** Duna has one painted moment; this page uses several scenes of the one valley (Scene A, B, C and the step panels). Icons are not paintings: they are thin line icons drawn in code (#3).

**Shared style line (put this at the end of every painting prompt if you change one):** soft digital painting, flat colour fields, soft brush edges, no outlines, gentle atmospheric haze, muted warm palette of peach, dusty rose, sage and pale blue. No people, no faces, no hands, no animals, no readable text or logos on any paper, no dramatic clouds, not cartoon, not anime, nothing that imitates a specific studio.

**Keep them consistent.** Generate #1 first. Generate every other painting as an *edit* with `-i web/public/landing/art/scene-a-dawn-valley.png`, so the valley, palette and brushwork match.

## Quick reference (page order)

| # | Section on the website | File name | Save to | Generate at | Needed |
| --- | --- | --- | --- | --- | --- |
| 1 | Hero: "Job applications you would sign." | `scene-a-dawn-valley.png` | `web/public/landing/art/` | 3200 x 1600 | Yes |
| 2 | Hero on phones | `scene-a-dawn-valley-portrait.png` | `web/public/landing/art/` | 1088 x 1360 | Yes (crop of #1) |
| 3 | Problem trio: poor matches, invented resumes, no edit step | Three SVG line icons, drawn in code (slot names `problem-1-poor-matches`, `problem-2-invented-resume`, `problem-3-no-edit`; no PNG is generated) | in code | 96 px box each | Code, not generated |
| 4 | Step 1: fit before applying | `step-1-fit-gate.png` | `web/public/landing/art/` | 1536 x 1152 | Yes |
| 5 | Step 2: every line cites a real fact | `step-2-truth-lock.png` | `web/public/landing/art/` | 1536 x 1152 | Yes |
| 6 | Spotlight: nothing is sent until you approve | `scene-b-footbridge.png` | `web/public/landing/art/` | 2048 x 2048 | Yes |
| 7 | Step 3: a receipt for every application | `scene-c-noon-meadow.png` | `web/public/landing/art/` | 1600 x 1200 | Yes |
| 8 | Step 4: replies sorted for you | `step-4-replies.png` | `web/public/landing/art/` | 1536 x 1152 | Yes (loaded by the step 4 panel) |
| 9 | Dark call-to-action card (Aubergine Ink base) | `dark-card-night.png` | `web/public/landing/art/` | 2048 x 1152 | Optional (loaded by the dark card over its code mesh; the build's transparent placeholder leaves the mesh showing) |
| 10 | Closing: "Try it on 25 real applications." | `closing-dusk-door.png` | `web/public/landing/art/` | 3072 x 1024 | Yes (loaded by the closing band) |
| 11 | Footer | `footer-dusk-hills.png` | `web/public/landing/art/` | 3072 x 1024 | Superseded: the footer now uses the meadow video in `web/public/landing/footer/` |
| 12 | Link preview when the site is shared | `og-kairos.png` | `web/public/landing/` | 1536 x 816 → 1200 x 630 | Yes |
| 13 to 19 | Logo and icons (incl. `icon.svg` vector favicon, drawn in code) | see the logo section | `docs/brand/`, `web/public/brand/`, `web/app/`, `extension/icons/` | see below | Yes |

Paths are relative to the repo root `auto-career/`. Keep the file names: the code uses them. #4, #5, #8, #9 and #10 are new slots; they are wired into the page as soon as the files exist.

## How to run

Needs `OPENAI_API_KEY`, `pip install "openai>=1.55" "python-dotenv>=1.0"` and `gpt_image_cli.py` from the gpt-image-2 skill. Every `--quality high` call is billed by OpenAI; draft with `--quality low` first if you want.

```bash
python gpt_image_cli.py -p "<prompt>" -f web/public/landing/art/<file>.png --size <WxH> --quality high --background opaque
# every painting after #1 is an edit:  add  -i web/public/landing/art/scene-a-dawn-valley.png
```

In ChatGPT instead: attach #1 for every painting after it, paste the prompt, ask for the size shown, download to the path shown.

---

## 1. Hero: `scene-a-dawn-valley.png`

- **Section copy:** "Job applications you would sign." / "Kairos finds jobs that fit, writes only from facts you confirmed, and sends nothing until you approve."
- **Story:** the search begins. A path leads through the valley to one open door standing in the meadow: the job that fits, at the right moment (kairos).
- **Save to:** `web/public/landing/art/scene-a-dawn-valley.png` · `--size 3200x1600` · `--quality high`
- **Layout:** the top 45 percent is quiet sky (the headline sits on it). A white match card floats over the lower left, so keep that area calm. The door is the focal point, on the centre line about 60 percent down.

```text
Wide 2:1 landscape painting for a website hero banner. A quiet river valley at dawn seen from a low meadow. The upper 45 percent is an open, nearly empty sky grading from pale blue (#DCE7F2) at the top to warm peach haze (#F6DCC8) at the horizon, horizon at 45 percent of the height. A pale dirt footpath (#E9DCC9) enters from the lower left and winds toward the centre, where a single simple wooden door in a plain frame stands upright on its own in the meadow, slightly ajar, with warm golden morning light glowing through the gap; the door sits on the centre line about 60 percent down and is small in the frame, about 6 percent of the image height. Behind it the river bend catches the first sunlight (#E8A87C to #F0BF9A). Soft rounded ridges in mauve and dusty rose (#9C8793, #B89DA2) frame the left and right thirds, the right ridge slightly taller. A few soft trees at the far right edge. Meadow in sage and pale olive (#A9B48C to #C9CFA6). The lower left area is calm and low in detail. Soft digital painting, large flat colour fields, visible soft brush edges, no outlines, gentle morning mist. Calm, hopeful, quiet. No people, no animals, no buildings, no text or logos, no dramatic clouds, not cartoon, not anime.
```

- **Alt text:** "Painted valley at first light, a path leading to an open door in the meadow."

## 2. Hero on phones: `scene-a-dawn-valley-portrait.png`

- **Save to:** `web/public/landing/art/scene-a-dawn-valley-portrait.png` · 1088 x 1360
- **Best:** crop from #1 (centre, full height, then resize): `npm run art:crops -w @auto-career/web`.
- **If the crop is too tight:** edit with `-i` #1 and `--size 1088x1360`:

```text
Recompose this exact painting as a tall 4:5 portrait for a phone. Same valley, palette, brushwork and dawn light. Sky fills the top 40 percent and stays nearly empty. The path enters from the lower left corner and leads to the same small open door glowing with morning light, centred about 62 percent down. One ridge on each side, the right one taller. No people, animals, text or logos.
```

## 3. Problem trio: three line icons (code, not generated)

- **Section copy:** "What people report about auto-apply tools." Cards: "Poor matches", "Invented resumes", "No edit step".
- **Why not paintings:** Duna's icon rule is thin geometric line icons in Charcoal. These are **code, not generated**: nothing to run with gpt-image-2, no PNG to save.
- **Spec (all three):** inline SVG, 96 px box, 1.25 px stroke, round caps and joins, no fill, stroke Charcoal `#292421` (`--icon`), no gradients, no colour, no text. Cards are Paper White `#ffffff` on Linen `#f7f7f5` (09 section 8, A3).

| Card | Icon | Drawing |
| --- | --- | --- |
| 001 Poor matches | Target with the arrow landing outside it | Three concentric circles; an arrow whose tip rests just outside the outer ring, shaft trailing away |
| 002 Invented resumes | Page with one line struck through | A page outline with a folded corner and four text lines; one line crossed by a single straight stroke |
| 003 No edit step | Pencil held by a small padlock | A pencil on a diagonal; a small closed padlock (rounded body, arched shackle) clamped across its shaft |

- **Alt text:** decorative (empty alt); each card's words carry the meaning.

## 4. Step 1, fit before applying: `step-1-fit-gate.png`

- **Section copy:** step 1, "fit before applying": hard rules run before any model, every skip has a reason.
- **Story:** a small garden gate on the path. Many blank job letters drift toward it; only two pass through, the rest settle in the grass.
- **Save to:** `web/public/landing/art/step-1-fit-gate.png` · `--size 1536x1152` (4:3) · `--quality high` · edit with `-i` #1
- **Layout:** a white sample-run card covers the centre 60 percent; keep the gate in the right third.

```text
4:3 painting of the same valley as the reference, early morning. The pale footpath runs through a simple low wooden garden gate in the right third of the image, standing open. A loose drift of many small blank paper envelopes floats in the air toward the gate from the left; only two envelopes pass through the open gate and continue along the path, while the rest have settled gently in the grass before it. Soft mauve ridges in the distance, sage meadow, warm peach light. The centre 60 percent of the image is calm and low in detail because a card will sit on top. Soft digital painting, flat colour fields, soft brush edges, no outlines. No people, no readable text, no logos.
```

- **Alt text:** "A garden gate on the path lets two letters through while the rest settle in the grass."

## 5. Step 2, every line cites a real fact: `step-2-truth-lock.png`

- **Section copy:** step 2: every resume line cites a fact you confirmed; a line without a fact cannot be saved.
- **Story:** a simple outdoor writing table by the river. A resume page is held by thin threads to a few small pinned notes (the confirmed facts); one loose slip with no thread has blown away.
- **Save to:** `web/public/landing/art/step-2-truth-lock.png` · `--size 1536x1152` · `--quality high` · edit with `-i` #1
- **Layout:** the refusal card sits on the left half; keep the table on the right.

```text
4:3 painting of the same valley as the reference, mid-morning. On the right side, a simple wooden writing table stands in the meadow near the river. On it lies one sheet of paper with soft grey lines suggesting text (no readable letters); thin threads in ember (#B4553A) run from several of those lines to a few small paper notes pinned neatly to the table edge. A single loose paper slip with no thread is being lifted away by the breeze toward the left edge. A fountain pen rests beside the page. The left half of the image is calm sky and meadow, low in detail, because a card will sit there. Soft digital painting, flat colour fields, soft brush edges, no outlines, muted warm palette. No people, no readable text, no logos.
```

- **Alt text:** "A resume page on a table, its lines tied by threads to pinned notes."

## 6. Spotlight, nothing is sent until you approve: `scene-b-footbridge.png`

- **Section copy:** the serif spotlight line about approving; the Approve card stamps the visitor's own time.
- **Story:** the path crosses the river on a small footbridge. One sealed envelope rests on the bridge's middle plank, waiting. It goes nowhere until you approve: approving is crossing.
- **Save to:** `web/public/landing/art/scene-b-footbridge.png` · `--size 2048x2048` · `--quality high` · edit with `-i` #1
- **Layout:** a white mock-up panel covers the left 45 percent; a small floating card sits in the upper middle, so keep that band as sky or still water. The envelope on the bridge is the focal point (about 62 percent across, 55 percent down).

```text
Square 1:1 painting of the same river valley as the reference, later in the morning, clear pale blue sky (#CFE0F0) in the top third. A calm river runs from the lower left to the upper right. Slightly right of centre, a simple wooden plank footbridge without railings crosses it. Resting alone on the middle of the bridge, about 62 percent across and 55 percent down, is one cream envelope closed with a small ember (#B4553A) wax seal, waiting. The footpath leads onto the bridge from the lower left and continues up the far bank. Soft mauve ridges in the distance, trees only at the far left edge. The left 45 percent and the band across the upper middle are calm and low in detail. Soft digital painting, flat colour fields, soft brush edges, no outlines, muted palette of peach, sage, dusty rose. No people, no readable text, no logos.
```

- **Alt text:** "A sealed envelope waiting on a footbridge across the river."

## 7. Step 3, a receipt for every application: `scene-c-noon-meadow.png`

- **Section copy:** step 3: every submitted application gets a receipt of exactly what was sent.
- **Story:** noon. On a flat stone by the path, a small neat stack of filed paper receipts is held down by a smooth pebble.
- **Save to:** `web/public/landing/art/scene-c-noon-meadow.png` · `--size 1600x1200` · `--quality medium` · edit with `-i` #1
- **Layout:** the receipt card covers the centre 70 percent; put the stone and receipts in the lower right corner.

```text
4:3 close painted view of the same valley's meadow at noon, high bright sun, long grass in sage and pale gold. In the lower right corner, a flat grey stone beside the pale footpath holds a small neat stack of narrow paper receipts, squared and held down by a smooth round pebble. The centre 70 percent is an even, calm texture of sunlit grass because a card will sit on top. No horizon, no sky. Soft flat brushwork, soft brush edges, no outlines. No people, no readable text on the receipts, no logos.
```

- **Alt text:** decorative (empty alt); the receipt card on top carries the meaning.

## 8. Step 4, replies sorted for you: `step-4-replies.png`

- **Section copy:** step 4: replies arrive through your forwarding address and are tagged to the right application. "We cannot promise interviews."
- **Story:** afternoon. A simple post box at the end of the path; a few envelopes arrive, sorted into two small piles beside it.
- **Save to:** `web/public/landing/art/step-4-replies.png` · `--size 1536x1152` · `--quality high` · edit with `-i` #1
- **Layout:** the inbox card covers the left 60 percent; keep the post box on the right.

```text
4:3 painting of the same valley as the reference in warm late-afternoon light, longer shadows, slightly golden sky. On the right side, at the end of the pale footpath, stands a simple wooden post box on a post, its little door open. A few blank envelopes have arrived and rest beside it in two small tidy piles, one slightly larger than the other. The left 60 percent is calm meadow and sky, low in detail, because a card will sit there. Soft digital painting, flat colour fields, soft brush edges, no outlines, muted warm palette. No people, no readable text, no logos.
```

- **Alt text:** "A post box at the end of the path with envelopes sorted beside it."

## 9. Dark call-to-action card (optional): `dark-card-night.png`

- **Section copy:** one short line and one button on the page's only dark card (deviation V2).
- **Story:** the valley at night, everything quiet, one small warm light in the far distance: the one application that matters.
- **Save to:** `web/public/landing/art/dark-card-night.png` · `--size 2048x1152` (16:9) · `--quality high` · edit with `-i` #1. Optional: if you skip it, the page draws the same mesh in code.
- **Layout:** Linen text sits in the centre, so the centre must stay dark and plain (contrast). Base colour is Aubergine Ink `#1b0624` (09 L13), not a blue-black.

```text
16:9 painting of the same valley at night. The whole canvas is deep aubergine ink (#1b0624). Soft violet haze in #5A4F86 and #827BC8 rises from the bottom centre. A muted olive glow (#6E6A4E) in the top right corner, about a quarter of the frame, and a muted teal glow (#8FB0BA) in the bottom right corner, about a fifth of the frame. Ridges are dark silhouettes, barely lighter than the base. Far away on the horizon, a single small warm amber light (#F2B866), like a lit doorway. The centre of the image is dark, plain and calm so light text can sit on it with strong contrast. Soft digital painting, flat colour fields, soft edges, no outlines, no stars, no moon. No people, no text, no logos.
```

- **Alt text:** decorative (empty alt).

## 10. Closing, "Try it on 25 real applications.": `closing-dusk-door.png`

- **Section copy:** the big serif closing line and the final button.
- **Story:** dusk. The path from the hero has arrived: the same door now stands wide open, warm light pouring out across the grass. The day's search ends where it began.
- **Save to:** `web/public/landing/art/closing-dusk-door.png` · `--size 3072x1024` (3:1) · `--quality high` · edit with `-i` #1
- **Layout:** the headline and button sit in the centre of the upper half, so the upper 55 percent must be plain dusk sky. The image fades into the footer below.

```text
Wide 3:1 painting of the same valley at dusk. The upper 55 percent is plain, softly glowing dusk sky in periwinkle (#AAB6F2) blending to coral (#F08A5D) and amber (#F2B866) near the horizon, with no detail. In the lower centre, the pale footpath arrives at the same simple wooden door standing in the meadow, now wide open, warm golden light pouring out across the grass. Ridges in dusky violet and rose on both sides, the right one taller. Soft digital painting, flat colour fields, soft brush edges, no outlines. No people, no text, no logos.
```

- **Alt text:** "At dusk the path reaches the open door, light spilling across the meadow."

## 11. Footer (superseded: the footer now uses the meadow video in `web/public/landing/footer/`; prompt kept for reference): `footer-dusk-hills.png`

- **Save to:** `web/public/landing/art/footer-dusk-hills.png` · `--size 3072x1024` · `--quality high` · edit with `-i` #1 (the build crops it to 2880 x 840)
- **Layout:** nothing sits on the hills; the top 20 percent fades into the page colour.

```text
Wide 3:1 painting of the same valley after sunset, seen as layered rolling hills only, for the bottom of a website footer. The top 20 percent is plain Linen (#f7f7f5) with no detail, so it fades into the page. Four soft hill ridges back to front: dusk violet and periwinkle (#6F74C9 to #9AA3E6), dusty rose (#E9A0A8), olive (#A9A46A to #8E9358), and deep ember (#E07F5E to #B4553A) glowing in the lower corners. A thin warm horizon streak (#FFD8CC) between the olive and ember layers. Ridge profile low on the left, higher on the right. Softly blurred like hills in evening haze. No outlines, no sun, no trees, no people, no text, no logos.
```

- **Alt text:** decorative (empty alt).

## 12. Link preview: `og-kairos.png`

- **Save to:** `web/public/landing/og-kairos.png` · generate `--size 1536x816`, `--quality high`, edit with `-i` #1, then resize to 1200 x 630 (`npm run art:crops -w @auto-career/web`)
- **Text must be exact.** If the model misspells it, use the text-free variant and the build adds the text.

```text
1.88:1 website link preview image. The dawn valley painting from the reference, with the path and the small open door glowing on the right side, softly faded to Linen (#f7f7f5) across the upper left. In the upper left third, in a refined light serif typeface in Aubergine Ink (#1b0624), the headline on two lines: "Job applications" / "you would sign." Below it, smaller, clean sans-serif wordmark in Graphite (#444444): "Kairos". Nothing else written, no logos, no UI. Calm, premium, airy.
```

Text-free variant: `Same image, but the upper left 45 percent is plain Linen (#f7f7f5) with no text, no letters, no logos.`

- **Alt text:** "Kairos: Job applications you would sign."

---

## Logo and icons (13 to 19)

**Rules:** one colour, Aubergine Ink `#1b0624` on Linen `#f7f7f5`; the app icon is reversed, Linen on Aubergine Ink. No lime, no gradients. Thin, even, geometric strokes that read at 16 px. Meaning: *kairos* is "the right moment", and nothing is sent until you approve. The open door from the paintings is a natural mark.

| # | File | Save to | Size |
| --- | --- | --- | --- |
| 13 | `kairos-logo-concepts.png` (pick one, not shipped) | `docs/brand/` | 2048 x 2048 |
| 14 | `kairos-mark.png` | `web/public/brand/` | 1024 x 1024 |
| 15 | `kairos-logo.png` (mark + "Kairos") | `web/public/brand/` | 2048 x 512 |
| 16 | `icon.png` (favicon and app icon; delete `web/app/favicon.ico` after) | `web/app/` | 1024 → 512 |
| 17 | `apple-icon.png` | `web/app/` | 180 x 180, resized from #16 |
| 18 | `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png` | `extension/icons/` | resized from #16 |
| 19 | `icon.svg` (vector favicon, drawn in code from the chosen mark; code, not generated) | `web/app/` | vector, 32 x 32 viewBox |

### 13. `kairos-logo-concepts.png`

```text
Logo exploration sheet on Linen (#f7f7f5), a clean 2 by 2 grid of four square cells with generous margins, each showing one minimal brand mark for "Kairos", a calm, trustworthy job-application product (kairos is Greek for "the right moment"). Every mark is one colour, Aubergine Ink (#1b0624), thin even geometric strokes or simple solid shapes, no gradients, no shadows, readable at very small sizes. Option 1, top left: a simple door shape drawn as a thin rectangle, slightly open, with a small solid dot of light at the gap. Option 2, top right: a letter K whose lower diagonal becomes a short path ending in a small solid dot. Option 3, bottom left: a small circle resting exactly on a horizon line with one short tick above it. Option 4, bottom right: a single continuous line forming a signature loop that ends in a short check stroke. Under each mark, small clean sans-serif labels "1", "2", "3", "4". No other text.
```

### 14. `kairos-mark.png` (edit with `-i docs/brand/kairos-logo-concepts.png`)

```text
Take option <N> from the reference sheet and redraw it as one clean, centred brand mark on plain Linen (#f7f7f5). One colour, Aubergine Ink (#1b0624), perfectly even stroke weight, crisp geometric construction, about 60 percent of the canvas width, generous margins. No text, no grid, no shadow, no gradient. Must stay clear at 16 pixels.
```

### 15. `kairos-logo.png` (edit with `-i web/public/brand/kairos-mark.png`)

```text
Horizontal logo lockup on plain Linen (#f7f7f5): the mark from the reference on the left, and to its right the word "Kairos" in a clean modern geometric sans-serif, medium weight (500, matching the site's wordmark), slightly tight letter spacing, both in Aubergine Ink (#1b0624). Mark height equals the capital K height; gap equals half the mark width. Spell exactly "Kairos". Nothing else.
```

### 16. `icon.png` (edit with `-i web/public/brand/kairos-mark.png`, then resize to 512)

```text
App icon: the mark from the reference, centred, in Linen (#f7f7f5) on a solid Aubergine Ink (#1b0624) square filling the canvas edge to edge, no rounded corners. The mark fills about 56 percent of the square with a slightly heavier stroke so it survives at 16 pixels. Flat, no gradient, no shadow, no text.
```

#17 and #18 are resizes of #16. #19 is not generated: tell me which option you picked and I will redraw the mark as SVG in `web/components/shared/logo.tsx`, write `web/app/icon.svg` from the same paths, and add the icon resize step.

---

## Licence record

Add one line per file to `web/public/landing/art/LICENSE.md`: file name, tool (gpt-image-2), date, prompt number. Keep the full-size originals.
