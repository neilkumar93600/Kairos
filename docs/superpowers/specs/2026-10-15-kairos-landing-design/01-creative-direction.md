# Kairos landing page: final creative direction

Date: 2026-10-15. Status: final direction for the design and build specs. Owner: creative direction.

Inputs: `docs/04-ui-ux-brief.md` (tokens and rules), `docs/01-prd.md`, `docs/03-app-flow.md`, `docs/pricing.md`, the five research files in `_research/` (facts, code inventory, Awwwards references, competitor landings, stack feasibility), the four concepts in `_concepts/`, the judge scoreboard and the three judges' notes, and `server/src/services/fit.ts` (the real hard-filter function and its reason strings).

Skills applied as guidance (all four loaded): `product-skills:landing-page-generator` (SEO checklist, performance targets, one primary action, above-the-fold CTA at 375px), `landing:landing` (initial animation states set before reveal to prevent a flash, one entrance timeline, inline-only discipline), `high-end-visual-design` (macro whitespace, custom easing curves, transform and opacity only, blur only on fixed elements), `ui-ux-pro-max` (accessibility first, 44px targets, tabular numerals, reduced motion, no horizontal scroll). Where a skill conflicts with a locked decision, the locked decision wins: Inter and Inter Tight stay (that skill bans Inter), cards stay flat 8px hairline cards (no double-bezel shells), the navbar keeps the brief's 64px full-width spec (no floating pill), and no fade-up is applied to every element.

Next.js check made for this document: `ensureStatic = 'navigation'` exists as a route segment config introduced in Next.js 16.4.0, requires `cacheComponents` (which the repo enables), and fails the build if dynamic content enters the route. Source: [ensureStatic reference](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/ensureStatic), [Next.js 16.4 release post](https://nextjs.org/blog/next-16-4), [Keeping pages static](https://nextjs.org/docs/app/guides/keeping-pages-static). Fetched 2026-10-15.

---

## 0. Decision summary

| Item | Decision |
| --- | --- |
| Winner | **The Ledger** (concept id `the-ledger`), composite 8.19, the top of the scoreboard |
| Override | None. The two judges who ranked Signal from Noise first both recommended building it "with the Ledger's" usability base, receipt and open row. Choosing the Ledger and grafting Signal from Noise's honest-proof mechanism reaches the same page with the Ledger's feasibility (8.00 against 5.83), its no-pin usability baseline and its single-object WebGL, which is what the composite rewards |
| What the Ledger lacked, and how it is fixed | Display type capped at 64px (now up to 104px), a quiet scene (now a paper slip that feeds, prints the skip run, is signed, tears and opens into the page's one Mint Frost band), no centerpiece on phones (now a DOM print-and-tear moment), paraphrased reason strings (now the exact `fit.ts` strings, generated from the function and drift-tested) |
| WebGL centerpiece | One thermal receipt slip, vanilla three 0.186.1, one fixed canvas, lazy after idle, desktop and tablet-landscape (1024px and wider) only |
| Pinned scroll | One pinned stage (entry 05, Send and receipt), 100vh of pinned scroll on desktop. 0vh below 1024px and under reduced motion |
| Total length | About 1,440vh at a 1440 by 900 viewport; capped at 1,500vh |
| Lime | One element at a time, handed down the page by the lime custody controller. The landing logo is Phosphor White |

---

## 1. Concept name and big idea

### 1.1 Name

**The Ledger.**

### 1.2 Big idea

Kairos is the only application agent in which every action leaves a signed, dated row: a reason for every skip, a citation for every resume line, a receipt for every submission and one ledger row per credit. The landing page is itself a ledger that writes itself as the visitor reads: eleven numbered entries post in order, five reported problems are posted as open rows and settled in writing one by one, and one honestly stays open because Kairos cannot promise interviews. The one WebGL object is a thermal receipt slip that prints a line for each entry, runs a real sample of postings through the product's own rule text, waits without moving until the visitor approves, is signed with the visitor's own local time, tears along its perforation and opens into the page's single paper band, where it becomes the receipt you can read.

Accountability is not a message on the page. It is how the page behaves: it only moves forward, it labels every sample, it never sends anything, and it refuses to print a number it has not measured.

### 1.3 Why only Kairos can own it

| Artefact on the page | Mechanism in the product | Source |
| --- | --- | --- |
| A written reason for every skip | Hard filters run before any model; each drop returns a reason string | PRD core features row 2, AC3 to AC5; `passesHardFilters` in `server/src/services/fit.ts` |
| "cites fact #07" on every tailored line | A save with a line that cites no confirmed fact returns 422 `truth_lock` and stores nothing | PRD AC6; APP "Edit draft" |
| Nothing moves until you approve | Every application waits in the review queue for approval; drafts and approved items can be withdrawn before send | PRD one-line idea; APP alternate journeys |
| The receipt | Each submitted application saves every field sent, every answer, the resume version and the confirmation page | PRD user story 7; proof point 3 |
| The credit ledger | One credit per `submitted` report (unique index); failed submits charge nothing (AC10, verified); duplicate reports charge once (AC9, verified); sign-up posts a +25 row (AC1, verified) | PRC "Value metric"; PRD AC1, AC9, AC10 |

The competitor review found every reviewed site selling volume ("mass apply", "1,000+"), with fake live feeds, unsourced percentages and hidden prices. None can show a skip list, a citation, a receipt or a per-credit ledger, because none keeps them. A copy of this page would have to show artefacts the copier does not produce.

### 1.4 The kairos idea

Chronos is clock time; kairos is the right moment. On this page, chronos is the feed: postings arrive all day and the receipt feeds fast when the sample run prints. Kairos is the stop: the feed halts, one kept line prints at full size, and later the whole scene stands still until the visitor presses Approve. Every timestamp on the page records a decision (approved at, built on), never a countdown. The audience is already racing an OPT clock, so the page never adds a second one.

---

## 2. Voice

### 2.1 Register

Calm, exact, accountable. The page reads like a well-kept ledger written by someone who expects to be checked. It explains a mechanism, names what it does not do, and labels anything illustrative as a sample.

| Principle | In practice |
| --- | --- |
| Mechanism before benefit | "A job that breaks one is dropped before any model reads it" rather than "find better jobs" |
| Concrete verbs | approve, cite, skip, post, settle, submit, tag, pause, refuse, withdraw |
| Real numbers or none | 25, $19, $0.048, 2 per company in 30 days, 15 to 30 minutes. No rates, no counts of users, no outcomes |
| Say what it does not do | No LinkedIn automation, no undetectability promise, no Gmail access, paste only in v1, no interview promise |
| Attribute, never accuse | "People report", "reported by people who used other tools". No product is named |
| Lead with the promise, then the problem | Entry 01 opens with "Kairos was designed around these reports" before listing them |

### 2.2 Sentence rules

1. No em dashes and no en dashes anywhere in user-facing copy (a CI lint fails on U+2014 and U+2013 in `web/app/(public)` and `web/components/landing`). Use a full stop, a comma, a colon or "to" for ranges. The minus sign in credit amounts is U+2212 (−), which the lint allows.
2. Short declaratives. Headings are one sentence ending in a full stop. Body sentences average 15 words and never exceed 30.
3. Second person for the visitor ("you approve"), first person plural for the company ("we pause your billing"), product name for the system ("Kairos tags each reply").
4. No hype words: revolutionary, seamless, effortless, supercharge, unlock, dream job, best, #1, game-changing, magic, AI-powered as a selling point.
5. No fear-based urgency: no "don't miss out", "last chance", "before it's too late", no countdowns.
6. Status words always carry the word, never only a colour: Submitted, Failed, Needs review, Approved, Kept, Skipped, Below your fit bar, Not saved.
7. Body text is left-aligned. Nothing is centred.

### 2.3 Numbers, signs and times

| Kind | Format | Example |
| --- | --- | --- |
| Credits | Signed and worded | +25 credits, −1 credit, 0 credits |
| Money on receipts and the calculator | Two decimals | $19.00, $0.00 |
| Price per application | Three decimals, integer thousandths arithmetic | $0.048 |
| Ids | Two or four digits with leading zeros | #07, 0417 |
| Entry numbers | Two digits | 00 to 10 |
| Time stamps | Visitor's locale via `Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })`, read in an event handler or effect only | 2026-10-15 14:02 (format varies by locale) |
| Sample values | Always under a SAMPLE chip or inside a dashed border | fit 82 |

All numerals use `font-variant-numeric: tabular-nums slashed-zero`.

### 2.4 Sample and attribution labelling

- Every demo surface carries a `SAMPLE` chip at its top right and a 1px dashed Circuit Border edge. Dashed means "sample or not real yet" everywhere on the page and nowhere else.
- Synthetic employers are named "Company 001" to "Company 040" so they cannot be read as real employers.
- Reported complaints carry the line "Reported by people who used other tools. Not measured by us."
- The fit-gate sample carries "This sample is synthetic. Your counts depend on your rules and on what employers post." No headline, CTA or receipt line states a sample count.

### 2.5 Voice examples

| Use | Do not use | Why |
| --- | --- | --- |
| Job applications you would sign. | Land your dream job 10x faster. | Mechanism and accountability, not a promise of outcome |
| Nothing is sent until you approve it. | Fully automated, hands-free applying. | The product's central rule |
| We cannot promise interviews, and we will not print a number we have not measured. | Get more interviews. | No outcome data exists |
| Failed submits cost nothing. | Risk-free. | Exact rule (AC10) instead of a vague guarantee |
| Reported by people who used other tools. | Unlike [competitor], we... | No names, attribution only |

---

## 3. The Kairos signature motif system: Kairos Marks

### 3.1 Principle

Everything on the page is a line that has been posted, is waiting to be posted, or is labelled as a sample. The marks below are drawn from the product's own artefacts (entries, reasons, citations, receipts, ledger rows), so the page shares Modal's hues through the brief but not its forms: no rotating object, no centred stack, no code windows, no glow.

### 3.2 The marks

| # | Mark | Specification | Where it appears |
| --- | --- | --- | --- |
| M1 | Entry number and graticule rule | Two-digit tabular number in Caption size (Inter 12px, weight 500, +0.6px tracking, Moss 70 `#9cbf93`), followed by a 1px Phosphor Blue-Black `#1f2a33` rule to the container's right edge. The rule carries 11 ticks, one per content entry, evenly spaced, 4px tall in Circuit Border `#485346`; the tick at this entry's index is 8px tall in Phosphor White `#ddffdc`. Every section rule is therefore also a progress mark ("you are at entry 05 of 10") | Top of every content entry, the receipt lines, the rail, the mobile tape |
| M2 | The post | The entry rule draws left to right when the entry enters: `transform: scaleX(0)` to `scaleX(1)`, `transform-origin: left`, 600ms, `--ease-post`, once. The number appears at once | Every entry |
| M3 | Posting square | 6px square, 0px radius (the logo mark's geometry). Filled Phosphor White when posted, 1px Circuit Border outline when pending. Always beside a word (settled, kept, posted), never alone | Entry 01 rows, kept job cards, the active rail entry |
| M4 | Citation chip | Pill (9999px radius), 4px 12px padding, Inter 12px 500, transparent fill, 1px Circuit Border, Phosphor White text: `cites fact #07` or `cites #07, #11` | Entry 03 resume lines, the receipt table's resume row |
| M5 | Claim chip | Same pill, text `see 05`, a link to the entry that demonstrates the claim, accessible name "See entry 05, Send and receipt". Used on six claims only (listed in 10.6) | Hero microcopy, pricing lead, FAQ answers 3 and 4, compare table Kairos column (two rows) |
| M6 | Sample mark | `SAMPLE` chip (same pill, Moss 70 text) at top right plus a 1px dashed Circuit Border edge (`--sample-border`) | Every demo, the sample receipt, sample cards |
| M7 | Perforation | `1px dotted` Circuit Border with a 4px period (`--perforation`). Used in exactly three places: the receipt (canvas and DOM), the top and bottom edges of the Mint Frost band, and the rule above the footer | Receipt, entry 05 band edges, footer |
| M8 | Signed slashed numerals | `tabular-nums slashed-zero` on every number; quantities always carry a sign or a unit | Pricing, ledger, receipt, calculator, run line |
| M9 | Kairos stamp | A time stamp that records a decision, set in Caption size inside a 1px Phosphor White ruled box (the signature box), never a countdown | The approve stamp on the receipt and in entry 01 row 03; the build date in the footer |
| M10 | Lime custody | The single lime fill travels to the one action that matters now (3.3) | Hero CTA, Approve sample draft, Choose Pro, closing Start free, navbar Start free |

### 3.3 Lime custody

Rule: exactly one element shows the Lime Pulse `#7fee64` fill at any scroll position, and it is always the next action.

| Priority | Candidate | Attribute |
| --- | --- | --- |
| 1 | "Approve sample draft" (entry 04) | `data-lime-candidate="approve"` |
| 2 | Hero "Start with 25 free applications" (entry 00) | `data-lime-candidate="hero"` |
| 3 | "Choose Pro" (entry 07) | `data-lime-candidate="pro"` |
| 4 | Closing "Start free" (entry 10) | `data-lime-candidate="closing"` |
| 5 | Navbar "Start free" (default owner) | `data-lime-candidate="navbar"` |

- Mechanism: one client island (`LimeCustody`, about 40 lines) runs one `IntersectionObserver` with `threshold: 0` over candidates 1 to 4. The owner is the highest-priority candidate with any visible pixel; if none is visible, the navbar owns lime. The owner is written as `data-lime-owner` on `<html>`; CSS paints `[data-lime-candidate]` lime only when it matches the owner. Every non-owner renders in its fallback style (Default button on Void, outlined-on-mint on the Mint Frost band).
- Hand-over is sequential so two lime fills never coexist: the old owner transitions `background-color` to its fallback over 150ms, then the new owner transitions to lime over 150ms (`ease-out`). Under reduced motion the swap is instant.
- Server HTML ships `data-lime-owner="hero"` so the first viewport is correct before any JavaScript runs. Without JavaScript, only the hero CTA is ever lime.
- Lime never appears on the Mint Frost band (low boundary contrast against mint) and never inside the WebGL canvas (the shader palette has no lime; a unit test checks the palette array).
- Logo decision: on the landing the navbar logo mark is Phosphor White fill with a Void glyph (same square, 0px radius). A lime logo is visible in every viewport and would make every in-page lime a second lime element. Lime stays on the favicon, extension icons and Open Graph image. This needs the product owner's confirmation (launch gate G5). Fallback if rejected: the lime logo becomes the default owner in place of the navbar CTA (which then stays a Default button permanently), and the logo turns Phosphor White over 150ms whenever an in-page candidate owns lime.
- Verification: a Playwright check scrolls 1440 by 900 and 390 by 844 viewports in 100px steps, waits 400ms at each step, and fails if more than one visible element computes to `rgb(127, 238, 100)` as its background colour.

### 3.4 Chronos and kairos, in exactly four places

| Place | Text | Time source |
| --- | --- | --- |
| Entry 02, under the receipt feed | None in copy. The fast feed then the stop is the visual statement | n/a |
| Entry 04, under the Approve button | "Kairos is Greek for the right moment. You choose it." | n/a |
| Receipt line 04 after approval | `04 · Approved by you · {local date and time}` | Click handler |
| Footer clock line (`aria-hidden="true"`) | `CHRONOS {14:32} YOUR TIME · KAIROS WHEN YOU APPROVE` | Effect, updated once per minute; server renders `KAIROS WHEN YOU APPROVE` alone to avoid a hydration mismatch |

Plus the footer definition line in Deep Fern (decorative only): "kairos (Greek): the right moment, as distinct from chronos, clock time."

### 3.5 Motion grammar

Every motion on the landing is one of these moves, and every one ends. There are no loops, no idle sway, no breathing, no marquees and no tickers.

| Move | What | Duration | Curve |
| --- | --- | --- | --- |
| Ink | Hero words step from Sage 60 to Phosphor White | 360ms per word, 70ms stagger | `--ease-post` |
| Post | Entry rule draws left to right | 600ms | `--ease-post` |
| Print | Receipt print head advances one line | 420ms (paper advance 520ms) | `--ease-post` |
| Feed | Receipt feeds the sample run | 2,400ms once | `--ease-feed` |
| Tear | Perforation splits, the slip separates | 700ms once | `--ease-tear` |
| Travel | Slip moves to a DOM slot, mint layer scales | Scroll-scrubbed (pinned stage) | `--ease-travel` applied to mapped progress |
| Hand-off | Canvas to DOM cross-fade | 400ms | linear opacity cross-fade (opacity only, a fade is perceived evenly) |
| Retract | A refused citation thread pulls back | 240ms | `--ease-retract` |
| Colour | Hover, focus, status changes | 300ms (lime hand-over 150ms + 150ms) | `ease-out`, the brief's utility rule |

No spring and no overshoot anywhere, including the canvas. Pointer tilt uses critically damped smoothing (`x += (target − x) * (1 − exp(−λ·dt))`, λ = 6), which cannot overshoot. Body text never has an entrance animation; it is simply there.

### 3.6 Landing-only tokens (named and justified)

These apply to `web/app/(public)/page.tsx` and `web/components/landing/**` only. No new hue is introduced; colour tokens below are new roles for existing brief hexes.

| Token | Value | Justification |
| --- | --- | --- |
| `--type-display-landing` | `clamp(3rem, 1.25rem + 5.6vw, 6.5rem)` (48px at 390, 77px at 1024, 92px at 1280, 101px at 1440, 104px cap) | The brief's 64px display reads as a template at Site of the Day scale; with weights capped at 500, size is the main hierarchy lever |
| `--type-heading-landing` | `clamp(2.25rem, 1.5rem + 2.2vw, 3.5rem)` (36px to 56px) | Entry titles above the brief's 42px so the ledger structure carries at distance |
| `--type-numeral-landing` | `clamp(2.5rem, 1.75rem + 2.4vw, 4rem)` (40px to 64px) | Plan prices and the calculator result |
| `--rule-rhythm` | `32px` | Ledger row height in tables, lists and the DOM receipt; equals the brief's 32px spacing step |
| `--sample-border` | `1px dashed var(--border)` | The brief's dashed empty-state box, given one meaning on this page: sample or not real yet |
| `--perforation` | `1px dotted var(--border)`, 4px period | The tear motif |
| `--receipt-paper` | `var(--mint)` `#def0dd` | The receipt object (canvas and DOM). Reuses Mint Frost so the receipt and the band are the same paper |
| `--on-mint-ink` | `#000000` | Headings and figures on mint (about 17.4:1) |
| `--on-mint-body` | `#181818` | Body text on mint (about 14.9:1) |
| `--on-mint-muted` | `#485346` | Secondary text and rules on mint (about 6.8:1, AA for text on mint only) |
| `--ease-post` | `cubic-bezier(0.22, 1, 0.36, 1)` | One decelerating curve for ink, post and print |
| `--ease-feed` | `cubic-bezier(0.45, 0, 0.55, 1)` | Near-constant velocity with soft start and stop: a printer feeds at a steady rate |
| `--ease-travel` | `cubic-bezier(0.65, 0, 0.35, 1)` | Slip travel and mint expansion |
| `--ease-tear` | `cubic-bezier(0.55, 0, 1, 0.45)` | The single accelerating curve, used for the tear only |
| `--ease-retract` | `cubic-bezier(0.7, 0, 0.84, 0)` | Refused thread pulling back, fast and without overshoot |
| `--dur-ink`, `--dur-print`, `--dur-post`, `--dur-tear`, `--dur-handoff` | `360ms`, `420ms`, `600ms`, `700ms`, `400ms` | Named so reduced motion zeroes them in one rule |
| `--receipt-lane` | grid columns 9 to 12 at 1024px and wider | Layout: the canvas lane; text never enters it |
| `--section-pad-landing` | `128px` at 1024px and wider, `96px` at 768 to 1023px, `80px` below 768px | Expressive pacing on desktop; mobile keeps the brief's 80px section gap |

### 3.7 Differentiation test (design-lock gate)

| Reference | What it owns | How Kairos differs in form |
| --- | --- | --- |
| Modal (source of `DESIGN.md`) | Glowing rotating cube, centred hero, code windows, lime headline words | Flat paper receipt that never rotates on its own, left-aligned ledger typography, entry rules, citation and sample chips, no glow, no lime text |
| Lando Norris (lime `#D2FF00` on `#111112`) | Lime as spectacle, full-bleed motion | Lime only as one action fill at a time, motion that ends, a paper band |
| Tsenta (nearest category neighbour) | Scrolling terminal log | No monospace, no scrolling log; rows are posted once and stay |

A side-by-side screenshot review against these three at 1440 and 390 widths is a design-lock gate.

---

## 4. The WebGL centerpiece: the receipt

### 4.1 What it is

One thermal-paper receipt slip emerging from a printer mouth at the bottom of the receipt lane. Nothing else is in the scene except the print head hairline: no particles, no floor, no environment, no second object.

| Property | Value |
| --- | --- |
| Geometry | Plane 1.6 by 3.6 units (2.25:1, the proportion of 80mm paper). T2: 32 by 96 segments; T1: 2 by 48 segments |
| Curl | The top 22% of the slip bends back around a horizontal axis, radius 0.6 units, up to 38 degrees, computed in the vertex shader (paper memory). T2 only; T1 is flat |
| Print head | A hairline quad 1.1 times the slip width and 1 CSS pixel tall at the slip's lower edge, colour `mix(Void, Phosphor White, 0.6)`. Paper below the head is clipped, so the slip appears to emerge from a slot |
| Perforation | A row of alpha gaps 1 texture pixel wide at a 4px period, one line above the print head |
| Camera | Perspective, fov 35 degrees, z = 6, looking at the origin |
| Placement | Measured, not hard-coded: the slip is centred on the `[data-lane]` element (grid columns 9 to 12). On-screen slip width = `min(0.85 × laneWidth, 0.36 × (innerHeight − 64))`; height = 2.25 × width. At 1440 by 900 that is about 301 by 677px. The lane rectangle is measured on `ScrollTrigger.refresh`, on resize, and after fonts load, then unprojected to world space at z = 0 |
| Stack | `three@0.186.1` (vanilla), one thin Client Component (`Stage`, about 60 lines of React), loaded by `StageLoader` with `next/dynamic(..., { ssr: false })` from a Client Component after `load` and idle (2s timeout). No R3F, no drei, no postprocessing |
| Canvas | One fixed canvas: `position: fixed; inset: 0; height: 100lvh; pointer-events: none; z-index: 0`. Content sits above at `z-index: 1`. The canvas renders only when dirty, from the shared `gsap.ticker` |

### 4.2 Look: paper, not a screen

The slip is lit like paper on a dark desk, not like a glowing panel.

- Unlit, palette-locked shader. The fragment shader may only output `mix(uColorA, uColorB, t)` from a fixed palette uniform array: Void `#000000`, Ground Iron `#181818`, Circuit Border `#485346`, Fern Link `#859984`, Phosphor White `#ddffdc`, Mint Frost `#def0dd`. Lime is not in the array; a unit test asserts it.
- Paper colour: `mix(Circuit Border, Mint Frost, shade)` where `shade` is `0.62 + 0.38 × max(dot(normal, L), 0)` with a fixed light direction from the upper left. The flat front face reads as Mint Frost; the curl darkens toward Circuit Border. The paper is never brighter than Mint Frost. There are no lights, no emissive term, no bloom, no additive blending, no shadows and no post-processing pass.
- Back face (visible in the curl): `mix(Ground Iron, Circuit Border, shade)`.
- Ink: the print texture's alpha mixes the paper colour toward Void. Ink is never coloured.
- Renderer: `NoToneMapping`, `outputColorSpace = SRGBColorSpace`, `antialias: false` (edges smoothed in the shader with `fwidth`), `alpha: true`, `powerPreference: "default"`, a 1/255 blue-noise dither on the curl gradient to avoid banding.
- Brightness discipline: the slip is the brightest object on the page, so the H1 is set in Phosphor White at display size and the slip sits in its own lane, never behind text.

### 4.3 Print texture

| Tier | Texture | Full-size line | Feed row | Header |
| --- | --- | --- | --- | --- |
| T2 (requires `MAX_TEXTURE_SIZE` of 4096 or more) | `CanvasTexture` 1024 by 2304, RGBA, mapped 1:1 to the 1.6 by 3.6 plane, `LinearMipmapLinearFilter`, anisotropy 4, `RepeatWrapping` on v | Inter 400, 48px glyphs on a 108px rhythm (about 14px on a 32px rhythm on screen at 301px slip width), `tnum` and `zero` | Inter 400, 34px on a 60px rhythm (decorative, about 10px on screen) | Inter 500, 40px, uppercase, +0.08em |
| T1 | 512 by 1152, same mapping, every size halved | 24px on 54px | 17px on 30px | 20px |

- The 2D canvas draws text only after `document.fonts.load('400 48px Inter')` resolves.
- The texture is a ring buffer: a uniform `uFeed` offsets v; each new line is drawn at row `(feedRows) mod rowsPerTexture`, then `needsUpdate = true`. That is one 2D draw and one upload per printed line, never per frame.
- `uPrintY` clips everything below the newest line; a 0.03-unit band directly above the print head is darkened 18% (the thermal head's heat mark).
- The slip is flat (rotation 0, 0, 0) for 120ms before, during, and 200ms after every full-size print, then eases back to its resting pose over 600ms. Lines the visitor might read are never printed on a rotated surface.

### 4.4 Printed lines (exact strings)

| Entry | Line | When |
| --- | --- | --- |
| Header | `KAIROS · RECEIPT · SAMPLE` | Pre-printed (also in the poster) |
| 00 | `00 · Ledger opened` | Pre-printed (also in the poster) |
| 01 | none | The DOM posts the reported rows |
| 02 feed | 48 rows, one per sample posting, in posting order: `SKIP · 0417 · Posting says it does not sponsor visas` or `PASS · 0233 · goes to scoring` | Feed, once, at entry 02 local progress 0.20 |
| 02 | `02 · Fit gate · hard rules first · every skip has a reason` | 200ms after the feed stops |
| 02 on rule change | `RULES CHANGED · SAMPLE RE-CHECKED` (feed-row size) | Debounced 800ms after a control change |
| 03 | `03 · Resume v3 · every line cites a confirmed fact` | Entry 03 local 0.20 |
| 04 approved | `04 · Approved by you · {local date and time}` inside the signature box | Click handler |
| 04 not approved | `04 · Awaiting your approval` | Entry 04 local 0.85, once, if not approved |
| 05 approved | `05 · Submitted · employer form · fields saved` | Pinned stage progress 0.05 |
| 05 not approved | `05 · Not sent · waiting for your approval` | Pinned stage progress 0.05 |
| After the tear | New paper: header, then `05 · Receipt filed` | Pre-printed on the fresh paper |
| 06 | `06 · Reply tagged to its application` | Entry 06 local 0.20 |
| 10 | New slip, header `KAIROS · AT SIGN-UP`, line `+25 credits · free grant · never expires` | Entry 10 local 0.20 |

Reason strings in feed rows are the exact strings `passesHardFilters` returns, read from the generated sample file (10.4): "Title does not match your roles", "Title is more senior than you asked for", "Title is more junior than you asked for", "Location is outside your list", "Company is on your exclude list", `Mentions excluded keyword "{keyword}"`, "Posted salary is below your floor", "Posting says it does not sponsor visas", "You hit your per-company limit for the last 30 days". A posting that fails several rules prints its first reason; the DOM keeps every reason.

### 4.5 Scene states

Local progress `u` for an entry runs from 0 (entry top at 85% of the viewport height) to 1 (entry bottom at 15%). Poses blend in with `smoothstep` over `u` 0 to 0.25 and are approached with a per-frame lerp of 0.12 on desktop. Positions are relative to the lane-fit pose: x and y as fractions of the lane width and viewport height, z in world units; rotations in degrees (x, y, z); scale 1.00 is the lane-fit size.

| State id | Entries | Position (x, y, z) | Rotation | Scale | Paper level | What happens | Ends |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `slip-open` | 00 Hero | (0, 0, 0) | (6, −14, 2) | 1.00 | 1.00 | Canvas cross-fades over the poster (600ms, opacity) showing the identical pre-printed header and line 00. Pointer tilt on T2 (max 6 degrees on y, 3 on x) | At rest; moves only with the pointer |
| `slip-recede` | 01 Reported | (+0.15, −0.06, −0.8) | (4, −24, 0) | 0.82 | 0.65 (mixed toward Ground Iron) | Recedes so the DOM debit rows lead. Prints nothing | Scrubbed pose, reversible |
| `slip-feed` | 02 Fit gate | (0, 0, 0) | (0, −6, 0) | 0.96 | 1.00 | At `u` 0.20 the 48-row sample run prints over 2,400ms (`--ease-feed`) while the paper advances; rows scroll up through the curl. 200ms pause, then the full-size 02 line prints | Still after about 3s; under the 5s threshold of WCAG 2.2.2 |
| `slip-cite` | 03 Truth lock | (0, 0, 0) | (2, −10, 0) | 0.96 | 1.00 | Prints line 03 at `u` 0.20 (flattening rule applies) | Still |
| `slip-hold` | 04 Approve | (−0.04, 0, 0.2) | (0, −4, 0) | 1.00 | 1.00 | Complete stillness: pointer tilt off, nothing prints on scroll. On Approve, the stamp prints inside its signature box. At `u` 0.85 without approval, prints `04 · Awaiting your approval` | Still |
| `slip-tear` | 05 Send and receipt (approved) | Lane, then the `[data-slot="receipt"]` rectangle | (0, −6, 0) to (0, 0, 0) | 1.00 to slot fit | 1.00 | See 4.6 | Canvas hidden after the hand-off |
| `ghost-path` | 05 Send and receipt (not approved) | Lane, then the slot | (0, 0, 0) | slot fit | 1.00 | Prints `05 · Not sent`; no tear; a dashed receipt outline (1px dashes, 6px on and 4px off, Fern Link) separates from the slip and travels to the slot | Canvas hidden after the hand-off |
| `slip-reply` | 06 Replies | (0, 0, 0) | (4, −12, 1) | 0.92 | 1.00 | Canvas fades in (400ms) when entry 06 top reaches 70% of the viewport, showing the fresh paper (header, `05 · Receipt filed`); prints line 06 at `u` 0.20 | Still |
| `slip-fresh` | 10 Start | (0, 0, 0) | (6, −14, 2) | 1.00 | 1.00 | Canvas fades in (400ms) when entry 10 top reaches 85%. At `u` 0.20 the sample paper lifts and slides up out of the lane (600ms, `--ease-travel`), a new slip feeds up from the head with header `KAIROS · AT SIGN-UP` and prints the +25 line. The page's sample ledger ends; the visitor's would begin with one row | Still |

Canvas hidden (`visibility: hidden`, renderer stops invalidating): during entry 05 after the hand-off, and through entries 07, 08 and 09.

Append-only rule: scrolling up moves the slip back through poses, but printed lines never un-print and the tear never reverses. After the tear, earlier poses show the fresh paper (header and `05 · Receipt filed`). On reload mid-page, every line up to the current entry prints at once with no sweep.

### 4.6 The pinned stage: tear, hand-off and the paper band (entry 05, 1024px and wider)

Entry 05 is a 200vh wrapper containing a 100vh `position: sticky; top: 0` stage. Stage progress `p` runs from 0 (wrapper top at the viewport top) to 1 (wrapper bottom at the viewport bottom), so the stage is pinned for exactly 100vh of scroll. The receipt slot `[data-slot="receipt"]` is centred over grid columns 5 to 8 (384px wide at 1440) and vertically centred; it is stationary while pinned, which is why the hand-off can align exactly.

| `p` | Approved visitor (`slip-tear`) | Not approved (`ghost-path`) | DOM |
| --- | --- | --- | --- |
| 0.00 to 0.15 | Slip in the lane prints the 05 line at 0.05 | Prints `05 · Not sent · waiting for your approval` at 0.05 | Entry rule, number and H2 on Void, top left |
| 0.18 | Tear fires once (time-based, 700ms, `--ease-tear`): the perforation splits at the head, the torn slip lifts 4% of the viewport height and its curl relaxes to 0 | No tear; the dashed outline separates from the slip (300ms) | |
| 0.25 to 0.50 | Travel (scrubbed through `--ease-travel`) from the lane to the slot; rotation to (0, 0, 0); scale to slot fit | The outline travels the same path | H2 fades out over 0.50 to 0.58 (opacity) |
| 0.50 | Hand-off fires once: canvas slip cross-fades out while the DOM receipt (mint paper, 0px radius, perforated edges, table) cross-fades in, 400ms, opacity only. From here the DOM is the receipt | The dashed DOM receipt fades in with "No receipt yet. Nothing was sent." and an outlined-on-mint "Approve sample draft" button | Canvas set to `visibility: hidden` |
| 0.56 to 0.90 | A flat mint layer (an empty `div`, `background: var(--mint)`) scales from the slot rectangle to cover the whole stage: `transform: scale()` from the slot's centre, scrubbed through `--ease-travel`. The receipt stays fixed in the centre; the page turns to paper around it | Same expansion from the dashed rectangle | Lime custody drops to the navbar |
| 0.86 to 1.00 | | | H2 re-enters on mint in `--on-mint-ink` with the line rise (700ms); the two compact slips (Failed, Reported twice) post beside the receipt (desktop) with the receipt row print (60ms stagger, 240ms each) |
| After 1.00 | The pin releases; the rest of entry 05 (how it sends) scrolls in normal flow on the mint band, which ends with a perforated bottom edge back to Void | | |

Pressing the in-place "Approve sample draft" on the ghost receipt approves in place (no scrolling): the DOM receipt prints its rows top to bottom (60ms stagger, 240ms each), the Approved row shows the local time, and the same store update prints the stamp line on the WebGL slip the next time it is visible.

### 4.7 Load sequence

1. Server HTML renders the hero text (the LCP element at full opacity) and the hero poster: an `<img>` of the slip in `slip-open` with the header and line 00 printed (AVIF at most 40KB, WebP fallback, explicit width and height, `fetchpriority="low"`, `decoding="async"`) inside the lane.
2. After `load` and `requestIdleCallback` (2s timeout), the tier probe runs (8.3). Tier 0 ends here.
3. Tier 1 or 2: the WebGL chunk loads, the renderer builds, `renderer.compileAsync(scene, camera)` resolves, then the canvas cross-fades over the poster in 600ms.
4. `webglcontextlost`: `preventDefault()`, stop rendering, show the DOM receipt list in the lane; one restore attempt; a second loss pins the session to tier 0 (`sessionStorage`, in try/catch).

### 4.8 Accessibility of the scene

The canvas is `aria-hidden="true"`. The lane contains `<aside aria-label="Sample receipt">` with an `<ol>` of every printed line from the same data array as the texture. On tiers 1 and 2 the list is visually hidden but available to assistive technology; on tier 0 it is the visible lane receipt (mint paper, perforated top, 14px lines on a 32px rhythm). Prints are never announced; only explicit actions (approve, rule changes, calculator) use polite live regions.

---

## 5. Narrative arc

### 5.1 The arc in one table

The page follows the life of one application: open, hear what went wrong elsewhere, gate, cite, approve, send and file the receipt, hear back, pay, compare, ask, start. Five problems are posted open in entry 01; four are settled in later entries; one stays open in writing.

| Entry | Beat | Visitor sees | Visitor feels | Visitor learns |
| --- | --- | --- | --- | --- |
| 00 Hero | Open | A large sentence inking in, a pale receipt slip in the right lane with one line printed | Stillness and precision | The three rules in one breath, and that the page shows its work |
| 01 Reported | Debits posted | Five ledger rows, each "open" | Recognised, not sold to | Kairos was designed around these reports and will account for each |
| 02 Fit gate | Chronos, then the stop | The receipt feeds 48 sample rows fast, then stops and prints one line; a skip ledger with real reasons | Relief: the noise is handled visibly | Hard rules first, written reasons, skips cost nothing |
| 03 Truth lock | Citation | A resume diff where each line cites a fact; a line without one is refused and falls apart | Safety | No fact, no line |
| 04 Approve | Kairos | The scene goes completely still; one lime button | The one decision is theirs | Edit anything, approve one or a batch, withdraw before send |
| 05 Send and receipt | Proof | The slip tears, travels, and the page turns to paper around it | Accountability made physical | How it sends, what a receipt holds, failed and duplicate rules |
| 06 Replies | The open row | A sample inbox, then the one unsettled row explained | Respect | Forwarding address, no Gmail access, offer pause, no interview promise |
| 07 Billing | Settlement | Credit ledger, prices, a calculator that shows the weak case | Nothing hidden | Exact prices and per-application math |
| 08 Compare | Fair contrast | Five rows of reported problems against mechanisms | Fair | The difference, without names |
| 09 Questions | Doubts | Six plain answers | Reassured | Limits stated plainly |
| 10 Start | Your ledger | A fresh slip printing +25 credits | Ready, unpressured | The next step costs nothing and sends nothing by itself |

### 5.2 Layout frame (1024px and wider)

12-column grid inside the 1280px container, 32px column gap, 32px side gutters. Text and demos in columns 1 to 7, hero H1 in columns 1 to 8, receipt lane in columns 9 to 12 (`--receipt-lane`). Column 8 is a buffer; text never enters the lane, so body copy always sits on pure Void. Entries 07 to 09 (canvas hidden) use the full 12 columns. Every entry follows one anatomy:

```
[entry number] [graticule rule to the right edge]
[eyebrow caption]
[entry title, --type-heading-landing]
[body, max 65 characters per line]
[demo or table, SAMPLE chip and dashed edge when illustrative]
[settlement line, when the entry settles a reported row]
```

### 5.3 Entry by entry

#### Entry 00 Hero ("Open")

- Micro-label (Caption, Moss 70): "For new grads, OPT and anyone between jobs"
- H1 (`--type-display-landing`, Inter Tight 400, Phosphor White, `text-wrap: balance`, max width 8 columns): "Job applications you would sign." Two lines at 1024px and wider, three on phones.
- Subhead (20px, Moss 80, max 52ch): "Kairos finds roles that fit, tailors your resume only from facts you confirmed, and sends nothing until you approve it. Every submitted application comes with a receipt."
- Primary CTA (lime pill, 48px, initial lime owner): "Start with 25 free applications"
- Secondary (outlined, 48px): "See how it works", anchors to `#entry-02`
- Microcopy (14px, Sage 60): "Credits are only used when an application actually goes through." with claim chip `see 07`. "No card" is withheld until confirmed (gate G4).
- Lane: the slip in `slip-open`; under it, 14px Sage 60: "Sample receipt. It prints as you read."
- Kinetic: Ink on the H1 from first paint (CSS only), then the signature rule under "sign." (8.2). Nothing else moves except the pointer tilt on T2.

#### Entry 01 Reported ("Debits")

- Eyebrow: "Reported by people who used other tools. Not measured by us."
- Title: "Five things people report about auto-apply tools."
- Lead: "Kairos was designed around these reports. Four are settled further down this page, where you can check each one. One stays open, and we say why."
- Five rows, 32px rhythm, Circuit Border rules, two-digit number, complaint in Body size, right cell in Caption:

| Row | Complaint | Right cell (server and first client render) | After the settling entry posts |
| --- | --- | --- | --- |
| 01 | Matches that do not fit. | open · see 02 | settled in 02 |
| 02 | Resumes with skills and metrics the person does not have. | open · see 03 | settled in 03 |
| 03 | A review step without an edit step. | open · see 04 | settled in 04 (with the stamp time if approved) |
| 04 | Hundreds of applications and zero interviews. | open · see 06 | stays "open · see 06" |
| 05 | Charges after cancelling, and lost credits. | open · see 07 | settled in 07 |

- Under the rows (14px, Sage 60): "We do not name other products."
- Settling: when an entry posts, its row's cell cross-fades (120ms) to "settled in NN" in Phosphor White and the posting square fills (300ms). Settled state is read from the ledger store (9.4), so it never reverts. Without JavaScript, the "open · see NN" links remain and work.
- Source notes: PRD "Problem" complaints 1, 3, 2, 4 and 6, the last narrowed to what the page proves (refund policy awaits legal review, PRD open question 5). Complaint 5 (broad Gmail access) is not posted as a debit, to avoid front-loading fear; it is answered in entries 06 and 08.

#### Entry 02 Fit gate ("Chronos, then the stop")

- Title (KEEP): "A fit gate before anything else."
- Body (KEEP): "Role, seniority, location, salary floor, visa needs and your exclude list are hard rules. A job that breaks one is dropped before any model reads it, and the rest come with written reasons."
- Second body: "Jobs that miss a hard rule never cost a model call, and a skip never costs a credit. New postings come from public career pages on Greenhouse, Lever and Ashby."
- Demo panel (dashed edge, `SAMPLE` chip, title "Sample run"):

| Control | Element | Options (sample default first) |
| --- | --- | --- |
| Seniority | `<select>` | Entry, Mid, Senior |
| Needs visa sponsorship | Radio group | Yes, No |
| Per-company limit | `<select>` | 2 in 30 days, 1 in 30 days, 3 in 30 days |
| Your fit bar (sample setting) | `<input type="range" min="50" max="95" step="5" value="70">` | `aria-valuetext="Fit bar 70. {kept} of {passed} sample postings kept."` |

- Sample profile disclosure (native `<details>`, summary "Rules in this sample"): "Entry-level software engineer roles, needs visa sponsorship, remote or New York or Austin, salary floor $85,000, one excluded company, at most 2 applications per company in 30 days."
- Skip ledger: one row per reason string present in the current result, with a count (odometer, 240ms) and a `<button aria-expanded>` that lists up to 5 sample postings in that row with every reason each one failed, then "and {n} more". Footnote: "A posting can break more than one rule. Each skipped posting keeps every reason."
- Kept cards: up to 3 sample match cards (dashed edge, Ground fill, 8px radius, 32px padding): "Company 014 · Software Engineer, Platform"; neutral outlined badge "fit 82"; two or three reason lines, one naming a gap plainly ("Asks for Kafka; your profile mentions RabbitMQ only"); then "+{n} more in this sample". Postings that pass the hard rules but fall under the bar are listed in one ledger row labelled "Below your fit bar" (the page's label for the score stage).
- Run line (Caption, inside the panel): "Sample run · 48 synthetic postings · {skipped} skipped by your rules · {below} below your bar · {kept} kept · 0 sent from this page"
- Caveat (14px, Sage 60): "This sample is synthetic. Your counts depend on your rules and on what employers post."
- Footnote (14px, Sage 60): "Hard-rule reasons are the product's own reason text, checked against its rule code. Scores and fit reasons in this sample were written by us to show the format; in the product, a model writes them from your confirmed profile." The first sentence ships only when prerequisite P1 passes in CI (10.4).
- Polite live region (debounced 500ms): "Sponsorship rule on. {n} postings skipped for sponsorship. {passed} pass all rules."
- Settlement line: "Settles 01. You see each skip and the reason."

#### Entry 03 Truth lock ("Citation")

- Title (KEEP): "Resumes that cannot make things up."
- Body: "You paste your resume once. Kairos splits it into facts, and you confirm or remove each one. Every tailored line has to cite facts you confirmed. A line that cites nothing cannot be saved; the editor lists it so you can fix or remove it, and your own edits go through the same check."
- Detail (KEEP): "You see every change as a diff, line by line."
- Demo (dashed edge, `SAMPLE`): left, a four-line sample diff in Inter 16px. Removed lines in Sage 40 with a 1px strikethrough in `--bad` at 60%; added lines in Phosphor White, each ending with a citation chip (`cites fact #07`, `cites #07, #11`). Right, the confirmed facts typed by kind, not content: "#07 · Role · sample", "#11 · Dates · sample", "#12 · Tool · sample", "#14 · Tool · sample". No metrics, employer names or percentages.
- Citation trace (both directions): hovering or focusing a line brightens its facts (Sage 60 to Phosphor White, 300ms) and draws a 1px SVG path (Phosphor White at 60%, `stroke-dasharray` with `pathLength="1"`, 300ms); focusing a fact lights every line that cites it and shows "Used by {n} lines" in a polite live region. Lines and facts are `<button>` elements; lines use `aria-describedby` pointing at their facts.
- "Try adding a line (sample)": two radio options and a Default "Add line" button. Presets only, no free text.

| Option | Result |
| --- | --- |
| "Built REST services in TypeScript for an internal billing tool" (chip `cites fact #07`) | The line joins the diff with a 1px `--good` left rule; the path draws to #07 (420ms, `--ease-post`); inline `--good` text: "Saved. Cites fact #07." |
| "Led a team of 6 engineers" (no chip) | A path reaches 70% of the way toward the facts (300ms), meets a small lock bracket `[ ]` that closes, and retracts (240ms, `--ease-retract`); the line's letters fall 14px and fade (SplitText `type: "chars"` on this one string, 18ms stagger, 320ms, pieces `aria-hidden`, full text kept in `aria-label`); inline `--bad` text with `role="alert"`: "Not saved. This line cites no confirmed fact." |

- Demo note (14px, Sage 60, beside the control): "In the product, every tailored line carries the ids of the facts it uses. A save with a line that cites nothing is refused, and the editor lists that line. This demo shows the rule with two fixed examples; it does not judge your writing."
- Settlement line: "Settles 02. No fact, no line."

#### Entry 04 Review and approve ("Kairos")

- Title: "Edit anything. Then approve one or a batch."
- Body: "Each application shows its resume diff, every answer and why it matched. Edit anything, then approve one or a batch. Nothing is sent until you approve it, and you can withdraw a draft or an approved application before it is sent."
- Demo review row (dashed edge, `SAMPLE`): "Sample draft · Software Engineer, Platform · Company 014"; "Resume diff · 4 lines · each cites a fact"; "7 answers ready · 0 guessed"; outlined "Edit" button that expands one editable sample answer ("Earliest start date", a text input; saving updates the row and prints nothing); lime "Approve sample draft" (48px, priority 1 lime candidate).
- Beside the button (14px, Sage 60): "Demo. Nothing is sent from this page."
- Under the button (Body, Moss 70): "Kairos is Greek for the right moment. You choose it."
- The scene is completely still in `slip-hold`. Scroll never approves.
- On press: the button becomes a Default button reading "Approved · sample" with `aria-disabled="true"` and 50% opacity; focus stays on it; inline `--good` text "Approved by you at {14:02}."; polite live region "Approved. Sample receipt updated."; the receipt prints the stamp; entry 01 row 03 settles with the time; lime custody returns to the navbar. The approval is stored for the session (9.4).
- Settlement line: "Settles 03. Review means edit, then approve."

#### Entry 05 Send and receipt ("Proof", the Mint Frost band)

- Stage (Void): entry rule, number and H2 "Sent through the employer's own form. Then a receipt."
- Pinned stage behaviour: 4.6.
- DOM receipt on mint (table semantics, `<caption>`): "Sample receipt. This is what Kairos saves after a real submission. Nothing was sent from this page."

| Row | Value |
| --- | --- |
| Form | The employer's own page on Greenhouse |
| Fields sent | 14 · each shown to you first (sample count) |
| Answers | 7 · approved by you · 0 guessed (sample count) |
| Resume | Version 3 · every line cites a confirmed fact (chip `cites #07, #11`) |
| Confirmation page | Saved |
| Approved | {local date and time}, or "sample" |
| Credit | −1 credit · charged once |

- Compact slip A, status word Failed: "Required field empty: work authorization · 0 credits". Caption: "Failed submits cost nothing. The reason is shown so you can fix it and send again." (AC10, verified end to end.)
- Compact slip B, status word Submitted: "Reported twice · charged once · −1 credit". Caption: "If the extension reports one submission twice, you are charged once." (AC9, verified end to end.)
- Ghost state (not approved): the receipt slot is a dashed receipt reading "No receipt yet. Nothing was sent." with an outlined-on-mint "Approve sample draft" button (approves in place, no scroll).
- How it sends (normal flow on mint after the pin):
  - Lead: "The extension fills the employer's own form in your browser and saves what it sent: each field, each answer, the resume version and the confirmation page."
  - Two columns (0px radius paper cells, `--on-mint-muted` rules): "Chrome extension · every plan · runs in your browser, in your session" and "Cloud applier · Pro and Max · sends approved applications while your laptop is closed".
  - "Prefer to press submit yourself? Review mode fills the form and stops, and you press the employer's submit button."
  - "If a required field is empty, the extension does not press submit. It tells you how many fields need you." (AC11.)
  - "Public career pages on Greenhouse, Lever and Ashby. We do not automate LinkedIn, because its user agreement bans bots."
- Build-status gate G3 applies to the extension, the cloud applier, review mode and the receipt contents; fallback wording adds "(in beta)" after the feature name.
- Band edges: perforated top and bottom (`--perforation` drawn in `--on-mint-muted`).

#### Entry 06 Replies ("The open row")

- Title: "Replies come to an address you control."
- Body (KEEP A5 content): "You set one forwarding filter, and replies about your applications come to a private address we give you. No Gmail login, no Gmail access. Kairos tags each reply to the application it belongs to."
- Second body (gated, G3): "When a reply you forward is an offer, we pause your billing."
- Sample inbox (dashed edge, `SAMPLE`), three rows with status words: "Reply · tagged to application 0233"; "Interview request · tagged to application 0233"; "Offer · billing paused".
- The open row (Lead size, Phosphor White, preceded by an outlined posting square): "Row 04 stays open. We cannot promise interviews, and we will not print a number we have not measured. We can show you every application, every skip and every reply."

#### Entry 07 Billing and pricing ("Settlement")

- Title (KEEP): "Pay for applications that went through."
- Lead (KEEP point 4): "One credit per application that actually went through. Failed submits cost nothing. Pause any time, and we pause for you when an offer email arrives. Weekly plans for searches that end fast." Claim chip `see 05` after "Failed submits cost nothing."
- Credit ledger (sample, table): columns Date · Entry · Credits · Note. Rows: "Free grant · +25 credits · never expires"; "Submitted · −1 credit · receipt kept"; "Failed submit · 0 credits · reason shown, nothing charged"; "Duplicate report · 0 credits · charged once already". Dates are rendered as "sample". The first row posts (posting square) when the entry enters.
- Interval switch: Weekly, Monthly, Quarterly; active segment Carbon Veil fill, not lime; prices roll as odometers (360ms) on change.
- Plans (values from `docs/pricing.md`; feature strings must be read from `shared/src/plans.ts`, gate P3):

| Plan | Weekly | Monthly | Quarterly | Submitted applications | Full-use price per application (monthly) | Resume profiles |
| --- | --- | --- | --- | --- | --- | --- |
| Free | n/a | $0 | n/a | 25, once | n/a | 1 |
| Starter | $6 for 94 | $19 for 400 | $45 for 1,200 | per cycle as listed | $0.048 | 1 |
| Pro | $12 for 280 | $39 for 1,200 | $95 for 3,600 | per cycle as listed | $0.033 | 3 |
| Max | $25 for 700 | $79 for 3,000 | $189 for 9,000 | per cycle as listed | $0.026 | 10 |

- Pro card: Phosphor White 1px border; neutral outlined tag "Sends with your laptop closed" (mechanism); "Choose Pro" is the priority 3 lime candidate. The "Most chosen" badge is removed on the landing (there are no customers yet; it implies usage).
- Receipt calculator (9.3).
- Honesty line under the calculator: "The more of your credits you use, the lower the price per application. If you use few, it is higher. The calculator shows both."
- Notes (Body size): "Launch prices. They may change for new customers. Existing subscribers keep their price for at least 90 days after any change, with 30 days' notice." and "Billing is in US dollars through Stripe. Cancel any time from the Stripe customer portal; access runs to the end of the paid period." Help text: "Unused credits roll over up to two invoices' worth."
- Settlement line: "Settles 05. Every charge has a row, and you can read all of them."

#### Entry 08 Compare ("Fair contrast")

- Title (KEEP): "How it compares with typical auto-apply."
- Caption: "Left column: problems people report about auto-apply tools in general. We do not name products, and we do not compare prices here."

| Topic | What people report | Kairos |
| --- | --- | --- |
| Which jobs get applications | Matches that do not fit | Only jobs that pass your hard rules and fit bar, with a written reason for each skip (`see 02`) |
| Resume changes | Skills and metrics the person does not have | Each line cites a fact you confirmed (`see 03`) |
| Before it sends | A review step without an edit step | Edit every field and line, then approve one or a batch |
| Replies | Broad Gmail access | A forwarding address you control. No Gmail access |
| What you pay for | Charges after cancelling, and lost credits | One credit per submitted application. Failed submits cost nothing. Cancel from the Stripe portal any time |

- Real `<table>`, `<thead>`, `<th scope>`, Circuit Border rules, no zebra; left column Sage 60, Kairos column Phosphor White. Below 768px each row stacks as a pair with "People report" and "Kairos" Caption labels above each cell. No horizontal scroll.

#### Entry 09 Questions

- Title (KEEP): "What people ask before signing up." Native `<details>` (reuse `faq-list.tsx`); 56px summary rows, question in Inter 16px 500; open state changes colour only (300ms); content height is not animated.

| Question | Answer |
| --- | --- |
| Which job sites does it apply on? | Employer career pages on Greenhouse, Lever and Ashby. We do not automate LinkedIn, because its user agreement bans bots and it puts your account at risk. |
| Will recruiters know I used it? | The application is submitted through the employer's own form with your details and answers you approved. We do not promise it is undetectable; we make sure it is something you would have sent yourself. (Set in Phosphor White.) |
| Does it invent experience to match a job? | No. Tailored lines must cite facts from your confirmed profile. A line that cites nothing cannot be saved; the editor lists it so you can fix or remove it. (`see 03`) |
| What if a submission fails? | You keep the credit. The application shows why it failed so you can fix it and send again. (`see 05`) |
| Do you need my Gmail password or access? | No. You set one forwarding filter, and replies about your applications come to a private address we give you. |
| Can I upload my resume? | Version 1 takes pasted text. |

- A `FAQPage` JSON-LD block mirrors the visible text exactly.

#### Entry 10 Start ("Your ledger")

- Title (KEEP): "Try it on 25 real applications."
- Body: "Every application waits for your approval." If the visitor approved the sample, an effect replaces it with: "You approved the sample at {14:02}. Every real application waits for you the same way."
- Lime pill "Start free" (priority 4 candidate).
- Under it (14px, Sage 60): "25 submitted applications, free, once. The free credits never expire."
- Lane: `slip-fresh` prints `+25 credits · free grant · never expires` on a new slip headed `KAIROS · AT SIGN-UP` (AC1: sign-up posts a +25 ledger row; PRC: the free grant never expires).

### 5.4 Chrome

**Navbar.** The brief's spec: 64px, Carbon Veil at 85% with 10px backdrop blur, 1px Phosphor Blue-Black bottom border, the navbar shadow. Left: Phosphor White logo mark (landing) and "Kairos" in Inter 16px 500. Links from `siteConfig.publicNav` (How it works, Pricing, Blog, About) in Inter 14px 500. Right: "Log in" (ghost) and "Start free" (lime only when it owns custody, otherwise Default). From 1024 to 1279px a Caption "05 / 10" shows the current entry. Below 1024px the links collapse into a menu button opening a native `<dialog>` sheet with `data-lenis-prevent`; the sheet's Start free follows custody. The navbar never hides on scroll. `scroll-padding-top: 80px` keeps focused targets clear of it (WCAG 2.4.11).

**Ledger rail and receipt tape (scroll progress).** At 1280px and wider: a fixed rail in the right page gutter, 11 links (`00` to `10`), 28px each, two-digit Caption numbers in Sage 60, the entry title revealed on hover or focus; the active entry is Phosphor White with a filled posting square and `aria-current="true"`, set by an `IntersectionObserver` with `rootMargin: "-45% 0px -45% 0px"`. It is a `<nav aria-label="Page entries">`. Below 1024px: the receipt tape, a 48px strip `position: sticky; top: 64px` from entry 02 onward, Ground Iron fill, 1px Circuit Border bottom, showing the latest posted line in Inter 14px; a new line slides up into it (600ms, `--ease-post`); tapping opens a native `<dialog>` listing every posted line and links to all 11 entries. One chrome element on phones.

**Skip links.** First focusable elements, visible on focus as Default buttons: "Skip to main content", "Skip to pricing".

**Footer.** Perforated rule above. Then:
1. Page receipt (Caption labels, Body values, a ledger table): "Claims on this page · {N} · each links to where the page shows it" (N computed at build from the claims register); "Sample data · labelled on every demo"; "Testimonials, logos, user counts · none"; "Prices · read from the plan file the app bills from"; "Reason text · checked against the product's rule code" (only when P1 passes); "Built · {BUILD_DATE}".
2. Clock line (3.4) and the kairos definition line in Deep Fern.
3. "Motion: Full / Reduced" radio pair (9.5).
4. Link groups from `siteConfig.footer` (Product, Company, Legal), contact from `siteConfig.supportEmail` (never hard-coded; the domain is PRD open question 1). Legal links to `/terms`, `/privacy`, `/cookies`, `/refunds`.

`BUILD_DATE` is injected at build through `next.config.ts` `env` (`new Date().toISOString().slice(0, 10)` evaluated when the config loads), so the date is static output and true at every build. No date is read during render.

**Preloader.** None. The hero headline, subhead and CTA are server HTML, readable at first paint; the poster is the loader.

**Cursor.** The native cursor everywhere, with no replacement, follower or custom glyph.

---

## 6. Final ordered section list

| Order | Id | Name | Tier | WebGL state | Scroll length (vh, 1440 by 900) | Pins |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `navbar` | Navbar | utility | none | 0 (fixed chrome) | No |
| 2 | `ledger-rail` | Ledger rail and receipt tape (scroll progress) | utility | none | 0 (fixed chrome) | No |
| 3 | `entry-00-hero` | Hero: Open | signature | `slip-open` | 100 | No |
| 4 | `entry-01-reported` | Reported: five debits | standard | `slip-recede` | 90 | No |
| 5 | `entry-02-fit-gate` | Fit gate and the sample run | signature | `slip-feed` | 150 | No |
| 6 | `entry-03-truth-lock` | Truth lock | standard | `slip-cite` | 120 | No |
| 7 | `entry-04-approve` | Review and approve: the kairos moment | signature | `slip-hold` | 100 | No |
| 8 | `entry-05-send-receipt` | Send and receipt: the paper band | signature | `slip-tear` / `ghost-path` | 260 (200 stage wrapper + 60 mint flow) | Yes, 100vh |
| 9 | `entry-06-replies` | Replies and the open row | standard | `slip-reply` | 90 | No |
| 10 | `entry-07-billing` | Honest billing and pricing | standard | none | 200 | No |
| 11 | `entry-08-compare` | Compared with typical auto-apply | standard | none | 80 | No |
| 12 | `entry-09-questions` | Questions | utility | none | 90 | No |
| 13 | `entry-10-start` | Start: your ledger | standard | `slip-fresh` | 100 | No |
| 14 | `footer` | Footer: colophon and page receipt | utility | none | 60 | No |

Total: about 1,440vh at 1440 by 900, capped at 1,500vh. Below 1024px, entries take their content height (no pins).

**Pinned scroll budget: 100vh on desktop (about 7% of the page), 0vh below 1024px and under reduced motion.** Justification:

1. Usability is 30% of the jury score and the weakest jury criterion among sampled winners (mean 7.40); the juror flagged a 960vh sticky story as fatigue. One pin keeps the page as plain document flow, so keyboard Page Down, anchors, find-in-page and the skip links behave normally.
2. The one pin is where a fixed frame is mechanically required: the 3D to DOM hand-off needs a stationary slot to align with, and the paper band expansion needs the receipt to hold still while the page changes around it.
3. Every other scroll-driven effect runs on the fixed canvas with no pin spacer, so no other entry adds scroll length beyond its content.
4. Test: a keyboard user reaches pricing in under 10 seconds from the top (skip link or rail); if beta scroll depth at entry 07 is under 40%, merge entry 08 into the bottom of entry 07 and shorten entry 03's demo.

---

## 7. Signature interactions (summary of behaviour; full copy is in 5.3)

| Interaction | Entry | Native base | Enhancement | Reduced motion |
| --- | --- | --- | --- | --- |
| Sample run controls | 02 | `<select>`, radios, `<input type="range">`, `<details>`, row `<button aria-expanded>` | Odometer counts, a receipt feed row on change | Instant values; live region still announces |
| Citation trace and refusal | 03 | `<button>` lines and facts, radios, "Add line" button | SVG path draw, lock bracket, letter fall | Colour change only; path appears without drawing; no letter fall; same text result |
| Approve sample draft | 04, 05 ghost | `<button>` | Stamp print, lime hand-over, settled row | Instant |
| Receipt calculator | 07 | `<select>`, radios, range plus number input | Odometer (240ms) | Instant |
| Interval switch | 07 | Radio group | Price odometer (360ms) | Instant |
| Lime custody | all | Server default owner | Sequential hand-over | Instant swap |

Each control is at least 44px tall with 8px between targets, keeps a 2px Phosphor White focus outline at a 2px offset, and has a visible label.

---

## 8. Typography

### 8.1 Faces and features

Inter Tight 400 and 500 for display and headings with `ss01`; Inter 400 and 500 for UI and body with `cv11`; `tnum` and `zero` on all numerals. Weight 500 only on buttons, nav links, card titles and FAQ questions. Loaded with `next/font/google` (`Inter` and `Inter_Tight`, `weight: ["400", "500"]`, `subsets: ["latin"]`, `display: "swap"`); only the display face is preloaded on the landing. The global `h1` to `h4` weight-400 rule is removed in the token migration so card titles can use 500.

### 8.2 Scale

| Role | Size | Line height | Tracking | Colour | Kinetic behaviour |
| --- | --- | --- | --- | --- | --- |
| Display (hero H1) | `--type-display-landing` | 0.95 | −0.025em | Phosphor White | **Ink**: server-rendered word spans step from Sage 60 (8.3:1, readable at frame 0) to Phosphor White, 360ms each, 70ms stagger, `--ease-post`, CSS from first paint. **Signature rule**: 1px Phosphor White `::after` under "sign.", `scaleX` 0 to 1, 500ms, starting at 700ms. Both end by 1.2s. Never `opacity: 0`, never clipped |
| Entry title (H2) | `--type-heading-landing` | 1.02 | −0.02em | Phosphor White | **Line rise**: SplitText `type: "lines"`, `mask: "lines"`, `autoSplit: true`; `translateY(105%)` to 0, 700ms, `--ease-post`, 70ms stagger, once when the entry top crosses 85% of the viewport. The hidden start state is applied by JavaScript only to titles below the viewport at hydration; titles already in view never animate |
| Plan prices, calculator result | `--type-numeral-landing` | 1.0 | −0.02em | Phosphor White | **Odometer**: fixed-height digit columns translated with `translateY`; columns `aria-hidden`; one visually hidden node holds the value; a polite live region announces once after the roll |
| Lead (hero subhead, open row) | 20px (18px below 768px) | 1.5 | −0.018em | Moss 80 | None |
| Card title, job title | 20px, weight 500 | 1.5 | −0.018em | Phosphor White | None |
| Body | 16px, max 65ch | 1.5 | −0.022em | Sage 60 | None, ever |
| Small (tables, buttons, labels) | 14px | 1.43 | −0.026em | Sage 60 or Phosphor White | None |
| Caption (eyebrows, entry numbers, stamps) | 12px; uppercase for eyebrows only | 1.33 | +0.6px | Moss 70 | Appears at once when posted |
| DOM receipt rows | 14px, `tnum zero` | 32px rhythm | 0 | `--on-mint-body` | Row print: 60ms stagger, 240ms (opacity and `translateY(6px)` to 0) |
| Refused sample line | 16px | 1.5 | −0.022em | Phosphor White | Letter fall (5.3, entry 03), the page's only character split |

Kinetic type stays on lines and words, never on headline letters, so screen readers and crawlers read whole sentences. With JavaScript disabled, every heading is plain text in its final state.

---

## 9. Mobile, reduced motion and low-end devices

### 9.1 Mobile (below 1024px), its own composition

| Aspect | Below 768px | 768 to 1023px |
| --- | --- | --- |
| WebGL | None, by decision: protects LCP, battery and iOS context loss, and the phone page is composed for the phone rather than shrunk | None |
| Motion engine | GSAP and Lenis are not loaded. Motion is CSS transitions toggled by one `IntersectionObserver` ("post observer"); native scroll | Same |
| Gutters | 16px | 24px |
| Hero | Micro-label, H1 at 48px (three balanced lines), subhead 18px, both CTAs stacked full width at 48px. At 375 by 667 the primary CTA's bottom edge sits about 485px down, above the fold. Below: a DOM mini receipt (mint paper, perforated top, 0px radius, max height 200px) showing the header and line 00 | Mini receipt 320px tall |
| Receipt tape | Sticky 48px strip from entry 02 (5.4) | Same |
| Entry 02 | Controls stacked; range full width with a 44px thumb; skip ledger rows as buttons; kept cards stacked | Two-column controls |
| Entry 03 | Diff above facts; tap a line to trace (focus), tap again to clear | Side by side |
| Entry 05 signature | **DOM print and tear**: when the receipt is 50% in view, rows print top to bottom (60ms stagger, 240ms), then the perforated stub at its bottom separates: the receipt moves up 8px and the stub moves down 12px and fades (700ms, `--ease-tear`); then the mint band behind it scales from the receipt's rectangle to full width (600ms, `--ease-travel`, time-based, once). Ghost state as on desktop | Same |
| Compare | Stacked pairs, no horizontal scroll | Table |
| Pricing | Cards stacked in the order Free, Starter, Pro, Max; 44px interval switch; calculator below the cards | Two columns |
| Lime custody | Same rule and observer; navbar Start free sits in the menu sheet and the bar | Same |

### 9.2 Reduced motion (tier 0 by preference)

Triggered by `prefers-reduced-motion: reduce` or by choosing "Reduced" in the Motion control. The choice is stored in `localStorage` (try/catch) and applied as `data-motion="reduced"` on `<html>` by a 12-line inline script before first paint, so there is no flash. An explicit "Full" choice overrides the OS setting (the site-wide setting route of WCAG 2.3.3). GSAP work lives inside `gsap.matchMedia()` with the condition `(prefers-reduced-motion: no-preference)` plus a check of `data-motion`; `gsap.matchMediaRefresh()` runs when the toggle changes. Lenis keeps `respectReducedMotion` at its default.

| Element | Behaviour |
| --- | --- |
| Hero H1 and signature rule | Final colour and rule present from first paint |
| Entry titles and rules | Static, already drawn |
| Receipt (1024px and wider) | WebGL chunk never downloads. The hero shows the poster; from entry 01 the lane shows the visible DOM receipt list, updated instantly as entries are reached |
| Entry 05 | No pin. Void header, then the mint band in normal flow with the receipt printed; ghost and approve logic unchanged |
| Lime custody | Instant swap |
| Demos, calculator, odometers | Instant values; live regions still announce |
| Citation trace | Colour only (300ms utility motion); path appears without drawing; no letter fall |
| Mobile tape | Text swaps instantly |
| View Transitions on route change | `animation-duration: 0s` on `::view-transition-old(*)`, `-new(*)` and `-group(*)` |

Rule: reduced motion changes how things move, never what the page says. A Playwright check with `reducedMotion: "reduce"` asserts no `<canvas>` exists, no WebGL chunk is requested and all landing text is present.

### 9.3 Receipt calculator (entry 07) specification

| Input | Element | Values |
| --- | --- | --- |
| Plan | `<select>` | Starter, Pro (default), Max |
| Interval | Shares the interval switch | Weekly, Monthly (default), Quarterly |
| Submitted this cycle | `<input type="range">` plus `<input type="number" inputmode="numeric">`, kept in sync | 0 to the plan's credits for the period; default half |
| Failed this cycle | `<input type="number">` | 0 to 99; default 3 |

| Output row | Rule |
| --- | --- |
| Plan charge | Plan price for the interval |
| Credits included | 94, 280, 700 weekly; 400, 1,200, 3,000 monthly; 1,200, 3,600, 9,000 quarterly |
| Submitted × 1 credit | Equals the input |
| Failed × 0 credits | Always $0.00 |
| Credits remaining | Included minus submitted |
| Price per submitted application at your number | `Math.round(priceCents * 10 / submitted) / 1000` dollars; at 0 submitted: "No submitted applications. You still pay the plan price." |
| Price per application at full use | Monthly $0.048, $0.033, $0.026; weekly $0.064, $0.043, $0.036; quarterly $0.038, $0.026, $0.021 |

Pure function, no network call, tabular numerals, values roll in 240ms (instant under reduced motion), polite live region 500ms after input stops. A single unit test checks the full-use table and the zero case.

### 9.4 Ledger state (stateless components, one store)

All "what has happened" state lives in one external store, `ledgerStore` (module scope, read with `useSyncExternalStore`): `posted: Set<entryId>`, `feedDone: boolean`, `approvedAt: string | null`, `torn: boolean`. It is persisted to `sessionStorage` in try/catch. Components and the scene derive from it and never keep their own copies, so the `cacheComponents` Activity behaviour (effects cleaned up when the route is hidden, recreated when visible) cannot desync them: on recreation the scene reads the store and prints every posted line at once with no sweep. Server render and first client render use the no-JavaScript defaults ("open · see NN", default copy); the store applies after mount.

### 9.5 Low-end devices (tiers)

Tier probe after idle, evaluated in order, first match wins:

| Tier | Entry conditions | Receipt experience |
| --- | --- | --- |
| T0 Static | Viewport below 1024px; reduced motion or `data-motion="reduced"`; `navigator.connection.saveData`; no WebGL2; `getContext('webgl2', { failIfMajorPerformanceCaveat: true })` returns null; context lost twice; sampler demotion from T1 | Poster in the hero, visible DOM receipt list in the lane, entry 05 in normal flow; all DOM motion still runs unless reduced motion is on |
| T1 Lite | `deviceMemory` of 2 or less; 4 cores or fewer with a coarse pointer; `MAX_TEXTURE_SIZE` below 4096; sampler median above 24ms on T2 | DPR 1 within a 1.0MP drawing buffer, 30fps cap, flat plane (no curl), 512 by 1152 texture, no pointer tilt, tear becomes a straight split, hand-off cross-fade 240ms |
| T2 Full | Everything else | DPR up to 2 within a 2.1MP drawing buffer (`dpr = min(devicePixelRatio, 2, sqrt(2.1e6 / (cssWidth × cssHeight)))`, rounded to 0.25 steps), 60fps cap, curl, pointer tilt, 1024 by 2304 texture |

Runtime sampler: the first 45 rendered frames; a median above 24ms steps down one tier; at T1 a median above 34ms, or a third step-down in one session, goes to T0 and unmounts the stage. The final tier is stored in `sessionStorage` (try/catch). No step-up within a session. Resize re-sizes the renderer only on a width change or a height change above 25% (`100lvh`, `ScrollTrigger.config({ ignoreMobileResize: true })`).

---

## 10. Performance and engineering guardrails

### 10.1 Architecture

- `web/app/(public)/page.tsx` is a Server Component exporting `ensureStatic = 'navigation'` (verified, see the header note). Every entry is a Server Component; client islands are leaves: `SmoothScroll` (Lenis plus the single `gsap.ticker` clock, 1024px and wider only), `EntryPoster` (per-entry ScrollTriggers writing to the store), `HeroInk` (none needed: CSS), `StageLoader` and `Stage`, `SampleRun`, `CitationDemo`, `ApproveSample`, `LimeCustody`, `ReceiptCalculator`, `PricingPlans` (existing, lime fix applied once for `/` and `/pricing`), `ReceiptTape` (below 1024px), `MotionToggle`, `FooterClock`.
- One clock: `gsap.ticker` drives `lenis.raf(time * 1000)` first, then ScrollTrigger (via `lenis.on("scroll", ScrollTrigger.update)`), then the stage renders only if dirty (scroll delta above 0.0005 of the page, pointer move over the lane on T2, a print or feed in progress, a tier frame interval elapsed during a timed move, or a resize). `gsap.ticker.lagSmoothing(0)`. At rest the GPU does nothing. The stage also pauses when `document.hidden`, when the canvas is hidden, and through entries 07 to 09.
- Lenis: `lerp: 0.09`, `smoothWheel: true`, `syncTouch: false`, `anchors: true`, `autoRaf: false`, `respectReducedMotion` default; mounted only in the landing route's client tree and destroyed in cleanup, so the signed-in app keeps native scroll. `lenis/dist/lenis.css` imported by `SmoothScroll`. `data-lenis-prevent` on dialogs and selects.
- Cleanup: Lenis, ticker callbacks, ScrollTriggers, matchMedia handlers and the renderer are created in effects and destroyed in cleanup (`useGSAP` with a `scope`; the stage calls `dispose()` and `forceContextLoss()`); `ScrollTrigger.refresh()` runs once when the route becomes visible again and fonts are ready.
- No `Date.now()`, `new Date()` or `Math.random()` during render. Seeds and times are read in effects and handlers. `performance.now()` for elapsed time.
- View Transitions only for route changes (landing to `/sign-up` and `/login`); the canvas wrapper gets a `view-transition-name` with `animation: none` on its group.

### 10.2 Dependencies (exact pins)

`gsap@3.15.0` (core, ScrollTrigger, SplitText), `@gsap/react@2.1.2`, `lenis@1.3.26`, `three@0.186.1`, `@types/three@0.186.0` (dev). Not added: R3F, drei, postprocessing, motion, detect-gpu, ScrollSmoother, any Rive or Lottie runtime. The GSAP licence text and its fetch date are saved in the repo.

### 10.3 Budgets (gzip, verified with the Turbopack Bundle Analyzer on the first build)

| Budget | Value |
| --- | --- |
| Landing initial JS excluding the framework, 1024px and wider | 70KB or less (libraries measured at 53.9KB) |
| Landing initial JS below 1024px | 15KB or less (no GSAP, no Lenis) |
| Lazy WebGL chunk | 140KB or less |
| Fonts | Two files: Inter Tight 400/500 (about 33KB), Inter 400/500 (about 48KB) |
| Hero poster | 40KB AVIF |
| Total first-load transfer | Under 1.0MB |
| LCP (internal goal) | 1.5s desktop, 2.5s mid-range Android on 4G; the H1 is the LCP element |
| CLS | 0.05 or less (fixed lane boxes, fixed digit widths, metric-adjusted font fallbacks, no layout animation) |
| INP | 100ms or less (counters update in input handlers) |
| Frame rate | 60fps T2, 30fps T1, 0fps at rest |
| Drawing buffer | 2.1MP T2, 1.0MP T1 |

### 10.4 Blocking prerequisites

| # | Prerequisite | Owner | Blocks |
| --- | --- | --- | --- |
| P1 | `server/scripts/build-landing-fit-sample.ts`: imports `passesHardFilters` from `server/src/services/fit.ts` directly (no refactor of `fit.ts` or move to `shared/`), generates 48 seeded synthetic postings ("Company 001" to "Company 040", fixed vocabularies), runs them under all 18 combinations of the three sample controls, and writes `web/content/fit-sample.json` (postings, reasons per combination, sample scores labelled as written by us). A server test re-runs the script and fails if the JSON differs or contains a reason string the function cannot produce. Design targets for the generator: every rule string appears at least twice in the default combination, 8 to 12 postings pass the hard rules, and 3 to 5 sit at or above the sample bar of 70. The page never states these as rates | Owner of `server/src/services/fit.ts` | Entry 02 and the receipt feed. Without P1, entry 02 does not ship |
| P2 | `web/app/globals.css` migrated to the brief's tokens plus the landing-only tokens (brief open item 2), the `#d8e61a` hover in `button.tsx` replaced by `--accent-hover`, button radius 12px, `layout.tsx` fonts as in 8.1 | Web owner | Everything |
| P3 | Read `shared/src/plans.ts`; the landing pricing reads prices and feature strings from it, not from this document | Web owner | Entry 07 |
| P4 | Single copy of three in the workspace (`npm ls three`) | Web owner | Stage |

### 10.5 Checks (one runnable check per guarantee)

| Check | Pass criterion |
| --- | --- |
| Lime count (Playwright, 100px steps, 1440 by 900 and 390 by 844) | Never more than one visible element with `rgb(127, 238, 100)` background |
| Reduced motion (Playwright) | No canvas, no WebGL chunk request, all text present |
| WebGL disabled (Playwright) | Poster and DOM receipt list render |
| Copy lint (CI grep over landing files) | No U+2014 or U+2013, no banned hype words, no "No card" until G4 |
| Fit sample drift (server test, P1) | JSON matches `passesHardFilters` output |
| Claims register (unit test) | Every `[data-claim]` has a `see` target or a source note; footer N matches |
| Palette lock (unit test plus Playwright histogram at 12 scroll positions) | Shader palette has no lime; canvas pixels are Void or within hue 95 to 135 degrees |
| Lane separation (Playwright at 1024, 1280, 1440) | No text bounding box intersects the lane rectangle |
| Legibility sign-off (manual) | Printed receipt lines readable on a 1080p display at DPR 1 and on a DPR 2 display before design lock |
| Accessibility | axe-core with zero critical issues at 375, 768, 1024, 1440; keyboard-only completion of every interaction; NVDA and VoiceOver passes |

### 10.6 Claim chips

Six claims carry a `see NN` chip, registered in `web/content/claims.ts`: hero microcopy (see 07), pricing lead "Failed submits cost nothing" (see 05), FAQ A3 (see 03), FAQ A4 (see 05), compare row 1 (see 02), compare row 2 (see 03).

---

## 11. Brief rules amended for the landing

The signed-in app and every other route keep `docs/04-ui-ux-brief.md` exactly. These amendments apply to `/` only.

| # | Brief rule | Amendment for the landing | Why |
| --- | --- | --- | --- |
| A1 | Typography: Display 64px / 1.0, −0.448px, landing hero only | `--type-display-landing` `clamp(3rem, 1.25rem + 5.6vw, 6.5rem)`, line height 0.95, −0.025em | Award-level hero scale; weights stay 400 and 500, so size and tracking carry hierarchy |
| A2 | Typography: Heading large 42px for marketing section titles | `--type-heading-landing` 36px to 56px; prices use `--type-numeral-landing` 40px to 64px | Entry titles must hold against the receipt lane and large display type |
| A3 | Motion: utility only, 300ms ease-out on colour properties | Adds the named moves and curves in 3.5 (ink, post, print, feed, tear, travel, hand-off, retract), scroll-linked scene poses and kinetic type | Locked decision 1: expressive landing. Every move still ends |
| A4 | Motion: page sections fade in once (opacity only) | Sections do not fade in at all; entry rules draw and titles below the fold rise; body text has no entrance | Fade-up on everything is a cliché juries discount; a ledger posts, it does not fade |
| A5 | Motion: no springs or bouncy easing; no infinite or ambient animation | The locked decision lifts both bans for the landing; this direction uses neither. No springs, no overshoot, no loops; pointer tilt is critically damped and reactive only | "Every motion ends" is the brand idea; the amendment is available but deliberately unused |
| A6 | Reference products, Avoid: 3D hero art; Conflicts table: hero imagery none in v1 | One WebGL receipt object in the hero lane and through the story | Locked decision 1: exactly one WebGL centerpiece |
| A7 | Assets: not used in v1: 3D renders | The hero poster is a pre-rendered still of the WebGL scene, used as its loading and tier-0 state | A poster keeps LCP on text and gives no-WebGL visitors the same image |
| A8 | Assets: product screenshots from the real app, not mockups | Interactive DOM demos are allowed when every one carries a SAMPLE chip and a dashed edge and uses synthetic names; real screenshots remain required wherever an image claims to be the app (Chrome Web Store, any "this is the app" image) | Pre-launch honesty: demos show mechanisms, labelled as samples, never as output |
| A9 | Colour: Mint Frost is one optional light band on a marketing page | Still one band (entry 05). Mint Frost is also the receipt paper (`--receipt-paper`) in the canvas, the DOM receipt, the mobile mini receipt and the tier-0 lane receipt | The receipt and the band are the same paper, which makes the hand-off seamless |
| A10 | Accessibility text rule: Circuit Border never carries meaning | On the Mint Frost band only, `#485346` is `--on-mint-muted` for secondary text and rules (about 6.8:1 on mint) | It passes AA on mint; on Void the original rule holds |
| A11 | Lime Pulse roles: the logo and the navbar sign-up; Navbar: "Start free" is the one lime element on marketing pages | Logo mark is Phosphor White on the landing; navbar "Start free" is lime only when it owns custody; lime travels to the one current action (3.3) | The locked one-lime-per-viewport rule is stricter than the brief's role list; a permanently visible lime logo or navbar CTA would break it whenever an in-page action is lime. Product-owner gate G5 |
| A12 | Radii: 0px for icons and the logo mark only | 0px also for receipt paper (canvas, DOM receipt, mint cells) | Paper has square corners; the perforation carries the edge |
| A13 | Layout: section rhythm 80px with a Phosphor Blue-Black hairline top border | `--section-pad-landing` 128px desktop, 96px tablet, 80px mobile; the divider is the graticule entry rule (M1) | Expressive pacing and a divider that doubles as progress |
| A14 | Screen notes, Landing: hero right side is a match card with fit reasons and a truth-locked diff, then proof points, steps, comparison, pricing, FAQ, CTA | Hero right side is the receipt lane; the match card content moves into entries 02 and 03; the order follows the ledger arc in 5.1 | The narrative follows one application; the old order is the generic structure all competitors use |
| A15 | Typography: numbers in tables and counters use `tabular-nums` | All numerals use `tabular-nums slashed-zero` | The slashed zero makes `$0.00` and `0 guessed` unmistakable and is a quiet site-wide tell |
| A16 | Accessibility: touch targets at least 40px | 44px on the landing, 8px apart | Tighter, per touch guidance; not a loosening |
| A17 | Badge: lime fill for a live or active state that is the screen's one lime element | No lime badges on the landing; the "Most chosen" badge is removed | No customers exist to have chosen anything; lime is reserved for actions |
| A18 | Interaction states: Active (pressed) no transform | Unchanged. Listed to confirm that no press scale is added despite the skills' guidance | Brief rule kept |

---

## 12. Must-fix resolution log

### 12.1 The Ledger (the winner): every must-fix from all three judges

| Judge | Must-fix | Resolution |
| --- | --- | --- |
| Juror | Hero H1 capped at 64px | A1: up to 104px with Ink and the signature rule |
| Juror, brand, engineering | Texture spec contradicts itself (1024 by 2304 versus 1024 by 2048) | 4.3: 1024 by 2304 on T2 (requires `MAX_TEXTURE_SIZE` 4096 or more), 512 by 1152 on T1, mapped 1:1 to the 2.25:1 plane |
| Juror | Pose P2 rotates the slip while it prints readable lines | 4.3: the slip is flat for 120ms before, during and 200ms after every full-size print, then eases back over 600ms |
| Juror | Section numbers and entry numbers off by one | One numbering, 00 to 10, everywhere: ids `entry-NN`, headings, rail, tape, receipt lines, settlement references |
| Juror, brand, engineering | Comparison table scrolls sideways on phones | Entry 08: stacked pairs below 768px |
| Juror, engineering | No WebGL below 1024px, so phone jurors never see the centerpiece | 9.1: DOM mini receipt in the hero, the receipt tape, and a DOM print-and-tear plus paper-band moment at entry 05 |
| Juror | Navbar logo lime status not addressed | 3.3: Phosphor White logo on the landing, gate G5, explicit fallback |
| Juror | First viewport very still; poster must show the printed header | 4.7: the poster shows the header and line 00; the canvas takes over the identical state; Ink and the signature rule give the first second of motion |
| Brand | Reason strings paraphrased but called documented | 4.4 and P1: exact `fit.ts` strings generated from the function, drift-tested |
| Brand | Debit 06 claims a refund settlement the page cannot support | Entry 01 row 05 narrowed to "Charges after cancelling, and lost credits"; refunds not mentioned; settlement limited to what entry 07 proves |
| Brand | Six debits front-load fear | Entry 01 leads with the promise; five rows; the Gmail row moves to entries 06 and 08; row 04 stays open |
| Brand | Dated colophon goes stale | 5.4: `BUILD_DATE` injected at build; the page receipt only states what checks enforce |
| Brand | Hero 64px too timid | A1 |
| Brand | "Paper glows from within" risks kitsch | 4.2: unlit paper, no emissive term, never brighter than Mint Frost, hairline print head |
| Engineering | Verify receipt legibility at DPR 1 | 10.5 legibility sign-off; flat printing; mipmaps and anisotropy 4; DPR in 0.25 steps; the DOM is authoritative from the hand-off |
| Engineering | `ensureStatic = 'navigation'` may be invented | Verified on nextjs.org on 2026-10-15 (introduced in 16.4.0, requires `cacheComponents`); kept |
| Engineering | Use vanilla three with the shared ticker, 140KB budget | 4.1, 10.2, 10.3 |
| Engineering | Twelve entries is long | Eleven content entries (Send and Receipt merged), 1,500vh cap, skip links, rail and tape, a merge rule tied to beta scroll depth (6) |
| Engineering | Stateful debit rows could desync under Activity | 9.4: one store, derived components, append-only |

### 12.2 Must-fixes inherited by grafted ideas

| Source | Issue | Resolution in this direction |
| --- | --- | --- |
| Signal from Noise | 960vh sticky story | Not grafted; one 100vh pin total |
| Signal from Noise | Lime logo plus lime CTA in the first viewport | Phosphor White logo (3.3) |
| Signal from Noise | R3F over budget | Vanilla three |
| Signal from Noise | Fixed run ledger over body copy (WCAG 2.4.11) and reads as gamified counters | The run line is an inline caption inside entry 02 only, with "Sample run" first |
| Signal from Noise | "Same rule code" depends on a server refactor | P1 imports the function from the server package directly; the sentence ships only when the drift test passes |
| Signal from Noise | Numeric fit scores read as real | Every sample card has the dashed edge as well as the SAMPLE chip |
| Signal from Noise | Headline "Most postings stop at your rules" implies a rate | Not used; no headline, CTA or receipt line states a count |
| Signal from Noise | Pricing chart shows only the best case | The calculator shows cost at the visitor's number and the honesty line names the weak case |
| Truth-lock | Lime latch drawn inside the canvas | Lime is only ever a DOM button; the shader palette has no lime |
| Truth-lock | Free-text Lock Bench implies Kairos judges meaning | Two fixed presets only, with a note that the demo does not judge writing |
| Truth-lock | Footnotes on every claim add noise; "product spec" cannot be checked | Six claim chips linking to on-page demonstrations |
| Truth-lock | "Customer quotes: none yet" reads as a promise | "Testimonials, logos, user counts · none" |
| Truth-lock | Comparison row "Volume: a race to send more" unsourced | Not used |
| Kairos Moment | Auto-approves on scroll | Not grafted; scroll never approves |
| Kairos Moment | Quotes the 1% figure | Not used |
| Kairos Moment | Letter-spacing animation reflows; `lenis.scrollTo` on click | Not grafted; Approve changes state in place |

---

## 13. Grafts

### 13.1 Taken

| From | Idea | Where |
| --- | --- | --- |
| Signal from Noise | Sample run through the product's real `passesHardFilters`, with exact reason strings and computed counts labelled "Sample run" | Entry 02, receipt feed, P1 |
| Signal from Noise | Skip ledger rows with keyboard-reachable buttons listing every reason per posting | Entry 02 |
| Signal from Noise | "0 sent from this page" as the brand promise in a number | Entry 02 run line, entry 05 caption |
| Signal from Noise | The approval gate never opens on scroll, and the next section waits with "Nothing was sent" | Entries 04 and 05 |
| Signal from Noise | One Mint Frost paper band for the receipts | Entry 05 |
| Signal from Noise | Three receipt slips: submitted, failed (0 credits), reported twice (charged once) | Entry 05 |
| Signal from Noise | Claim chips that link a claim to the entry that shows it | M5, 10.6 |
| Signal from Noise | Sample profile disclosed in a native `<details>` | Entry 02 |
| Signal from Noise | Footer clock line "CHRONOS ... YOUR TIME · KAIROS WHEN YOU APPROVE" | Footer |
| Truth-lock | Preset-only refusal: the thread reaches, the lock bracket closes, it retracts, the letters fall | Entry 03 |
| Truth-lock | Ghost path when not approved ("No receipt yet. Nothing was sent.") | Entry 05, `ghost-path` |
| Truth-lock | Footer page receipt backed by a claims-register test, stated flatly | Footer, 10.5 |
| Truth-lock | Palette-locked shader (mix of token colours only) and a hue-histogram test | 4.2, 10.5 |
| Truth-lock | Dashed border as the page's language for sample or not yet real | M6 |
| Truth-lock | "Kairos is Greek for the right moment. You choose it." at the approve beat | Entry 04 |
| Truth-lock | Bidirectional citation trace; "Can I upload my resume?" FAQ | Entries 03 and 09 |
| Kairos Moment | Slashed-zero tabular numerals site-wide | M8, A15 |
| Kairos Moment | Graticule tick dividers, here as the per-entry progress rule | M1 |
| Kairos Moment | Lime custody as a visible idea | M10, 3.3 |
| Kairos Moment | The trigger idea as chronos versus kairos: a fast feed, then a stop | Entry 02 feed |
| Kairos Moment | "Failed × 0 credits = $0.00" calculator row; closing line with the visitor's local time | 9.3, entry 10 |

### 13.2 Declined

| From | Idea | Why declined |
| --- | --- | --- |
| Signal from Noise | 1,200-dash instanced field as the centerpiece | A second visual system; the page has one WebGL object, the receipt |
| Signal from Noise | Denoise character-split headings | Many spans, duplicated text for screen readers, cost for little meaning |
| Truth-lock | Fact-field constellation hero and reach thread | Reads as a stock network graph; more chrome in the first viewport |
| Truth-lock | "No fact, no line." as the H1 | Cryptic in the first three seconds; kept as entry 03's settlement line |
| Kairos Moment | Oscilloscope instrument and persistence buffers | Opaque to anxious job seekers; half-float targets unreliable on older iOS; continuous loops |

---

## 14. Launch gates and open items

| Gate | Item | Until confirmed |
| --- | --- | --- |
| G1 | P1 to P4 complete | Entry 02 does not ship (P1); pricing does not ship (P3) |
| G2 | Inter Tight `ss01` and Inter or Inter Tight `zero` present in the latin subsets served by `next/font` | Use `tabular-nums` without `slashed-zero` and headings without `ss01` |
| G3 | Build status of the Chrome extension, cloud applier, review mode, receipt contents, reply tracking and the offer pause (AC12) | Add "(in beta)" after each feature name in entries 05 and 06; drop the offer-pause sentence if reply tracking is not live |
| G4 | "No card" for the free path | Omitted everywhere |
| G5 | Phosphor White logo on the landing; the brief's provenance check (brief open item 1) | Fallback in 3.3 |
| G6 | Side-by-side review against Modal, Lando Norris and Tsenta at 1440 and 390 | Design not locked |
| G7 | Five-person ten-second comprehension test on the hero and entry 02: pass if four of five name fit, facts, approval or receipt, and none states a sample count as a Kairos result | Rework labels before launch |
| G8 | Legal review of the comparison wording and of the policy pages before they are linked as live (PRD open question 5) | Compare caption stays; legal links remain but carry no new promises |

SEO and metadata (from the landing-page-generator checklist): one H1; ordered headings; `<title>` "Kairos: job applications you would sign"; meta description from `siteConfig.description`; canonical URL; Open Graph image 1200 by 630 (Void, 64px Phosphor White headline, the receipt slip, the lime mark in one corner as the brief specifies); `FAQPage` and `Organization` JSON-LD mirroring visible text, with no rating; landmarks (`header`, `nav`, `main`, `aside` for the lane, `footer`); internal links to `/pricing` and `/how-it-works`.

---

## 15. The case for each Awwwards criterion

**Design (40%).** A strict system: Phosphor White on Void, one lime action at a time, one paper colour for the receipt and the band, two faces at two weights with a full fluid scale, slashed-zero numerals, a 32px ledger rhythm through tables, receipts and the rail, hairlines instead of shadows. One object, lit like paper, doing one unmistakable thing, and one tonal turn when the page becomes paper around the receipt.

**Usability (30%).** The opening the research found (jury mean 7.40, developer accessibility mean 6.90, none above 7.60). Native controls under every demo, live regions, 44px targets, a visible focus ring, one 100vh pin and otherwise plain document flow, skip links, a rail and a phone tape, a Motion toggle in two places, a complete reduced-motion page with identical content, a text H1 that is readable at frame 0, and lime that always points at the next action.

**Creativity (20%).** The signature is a behaviour, not an effect: a receipt that feeds a real sample of skips in the product's own words, stops, waits without moving for your approval, is signed with your clock, tears, and turns the page to paper. A narrative that posts five reported problems and openly leaves one unsettled.

**Content (10%).** Every sentence is a mechanism, a rule, a price or a labelled sample. The strongest line is a refusal: "We cannot promise interviews, and we will not print a number we have not measured." Prices are complete with per-application arithmetic and a calculator that shows the weak case. No testimonials, logos, user counts, outcome rates or competitor names, and the footer says so.
