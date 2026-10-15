# Concept: "No Fact, No Line" (truth-lock)

Kairos landing page, creative concept 1 of the set. Date: 2026-10-15. Status: specification for review, not code.

Inputs read for this concept: `docs/04-ui-ux-brief.md`, and the four research files in `_research` (facts sheet, code inventory, Awwwards references, competitor landings). Every number, rule and claim below traces to those files. Where a value is a design starting point to be tuned by eye, the text says "starting value".

Skills consulted as guidance only: `anthropic-skills:3d-scroll-website` (its frame-sequence default was rejected in favour of live WebGL, because this page needs a scene that responds to input, which is the skill's own exception rule; its RAF, direct-DOM, passive-listener and preload rules were kept), `motion-graphics` (used for easing vocabulary and "motion that ends" discipline; its video pipeline does not apply), `ui-ux-pro-max` (used for the accessibility, touch, animation and layout checklists). All three loaded.

---

## 0. One-screen summary

| Item | Decision |
| --- | --- |
| Name | **No Fact, No Line** (working title "Cited") |
| Hero statement | "No fact, no line." |
| Centerpiece | **The Fact Field**: one persistent WebGL scene of confirmed facts (square points), a draft column of resume lines, and hairline citation threads between them. It changes role section by section: constellation, failure, ledger diagram, gate, lock, latch, receipt, and back to a completed constellation. |
| Signature motif | **The Cite Thread**: a 1px thread from a numbered fact to the line that uses it, plus the **notch** (a 12px opening in every divider), `#NN` ledger numerals, dashed borders for anything that is sample data or not yet real, and `[n]` footnotes so the page cites its own claims. |
| Signature interactions | Cite-trace (hover, focus, tap), the Lock Bench (type an invented claim and watch it be refused), the Fit Bar (range input that drops jobs with reasons), Approve latch (the story refuses to send until you approve), the Receipt Calculator (pricing as a printed slip). |
| Lime | Used as a fill only, and only on the element that asks for a decision. A small "lime baton" controller hands it between the hero CTA, the approve latch, the pricing CTA and the closing CTA, with the navbar CTA as the default holder. At most one lime element is ever visible. |
| Motion philosophy | Causal and finite. Things connect, get checked, get approved, become receipts, then stop. No idle loops, no tickers, no marquees. |
| Tiers | T2 full WebGL, T1 light WebGL, T0 static SVG diagrams (also the first paint and the reduced-motion experience). |
| Architecture | Server Components for all copy and structure. Three client islands: scroll provider (Lenis + GSAP), stage canvas (R3F), and the interactive widgets (Lock Bench, Fit Bar, Receipt Calculator, lime baton). |

---

## 1. Name, big idea and why only Kairos can own it

### 1.1 Big idea (three sentences)

Every line Kairos writes for you has to point at a fact you confirmed, so the whole landing page is built as a field of numbered facts and the visible threads that connect them to a resume. A thread is the product's data model made visible: where there is a fact, a line may exist, and where there is none, nothing connects and nothing is sent. The page then holds itself to the same rule, with a footnote on every claim and a receipt for the page at the bottom.

### 1.2 Why only Kairos could own it

1. **It is literally the product mechanism.** The PRD says every resume line cites a confirmed fact id (core feature row 3), and a save that cites a fact the user does not own returns 422 `truth_lock` and stores nothing (AC6). The existing preview already used the phrase "cites fact #12". No competitor reviewed (Jobright, Simplify, LoopCV, AIApply, Sprout, Tsenta) claims or can claim this; their tailoring is described as "rewritten freely" or "beats ATS" with no limit.
2. **It converts a trust problem into a visual.** The audience is anxious about what goes out under their name. A line with no thread is a line they cannot defend. The visitor sees that in one glance, without reading a claim.
3. **It resists the clone problem.** The Modal-derived palette (near-black, phosphor, lime) is shared with Modal and, in form, with Lando Norris (lime #D2FF00 on #111112). This concept differs in form, not hue: threads, notches, citation numerals, dashed sample marks, receipt slips, and lime that appears only where a human decision is needed. A glowing cube, a centered hero and a lime headline word are all absent.
4. **It makes honesty the spectacle.** The competitor teardown shows every rival uses unsourced numbers, fake live feeds and logo walls. A pre-launch product has no proof of that kind, so the concept turns the absence into a feature: sample data is dashed and labelled, claims carry footnotes, and the footer prints a receipt for the page itself.

### 1.3 The brand test applied to the concept

| Brand word | How the concept satisfies it | Where a hazard was removed |
| --- | --- | --- |
| Calm | Finite motion, one idea per screen, no loops, no neon, left-aligned text, restrained palette | Idle breathing and ambient particles were removed. The scene is still unless scroll or input moves it |
| Exact | Every number is arithmetic from `docs/pricing.md` or a labelled sample. Threads are drawn between real ids | The old "fit 86", "31%" and "75 of 100" are not used |
| Accountable | Footnotes, sample labels, approval ghost path, receipts, "page receipt" in the footer | Competitor names, outcome rates, user counts and testimonials are absent by rule |

---

## 2. Guardrails that shape every section

### 2.1 Rules that still hold, and how this concept enforces them

| Rule | Enforcement in this concept |
| --- | --- |
| No em dashes in user-facing copy | Copy deck in section 3 contains none. A lint step (`grep` for U+2014 and U+2013 in `web/app/(public)/page.tsx` and `web/components/landing/**`) fails the build |
| Weights 400 and 500 only | Inter Tight 400 for display and headings; Inter 400 body, 500 for buttons and chips. No weight animation (changing weight reflows text) |
| Body text left-aligned | Every text block is left-aligned in a centered container. The scene is composed to the right of the text, never behind it |
| Lime is fill only, one per viewport | See the lime baton in 2.2. The logo mark on the landing page is Phosphor White, not lime (see 2.3) |
| No glow or neon on text | No text-shadow, no blur on type. Glow exists only as a faint halo sprite on scene points, never on text, and is capped (section 4.3) |
| Status colors only for status words and small badges | Scene uses no status hues. "Rejected", "Submitted", "Needs review" are DOM words with a status color; the scene shows a break in a thread, not a red shape |
| No invented proof | Sample data is dashed and labelled "Sample". No quotes, counts, logos, ratings, press or outcome metrics anywhere |
| Contrast AA | All text uses brief tokens whose ratios are in the brief. Scene composition keeps nodes out of the text column so text always sits on pure Void |
| Reduced motion | Section 8.2. Reduced motion changes how things move, never what the page says |

### 2.2 The lime baton (landing-only mechanism)

Problem: the hero CTA, the navbar "Start free", the approve latch in the scene, the pricing CTA and the closing CTA could each be lime. The code inventory found three lime elements in the first viewport of the current page. The brief allows one.

Rule: exactly one element holds lime at a time. A 40-line client island (`LimeBaton`) observes four named slots with `IntersectionObserver` (threshold 0.6) and writes `data-lime="<slot>"` on `<html>`. The first slot in this priority order that is in view wins: `latch`, `heroCta`, `pricingCta`, `closingCta`. If none is in view, the navbar CTA holds lime.

| Viewport | Lime holder | Navbar "Start free" state |
| --- | --- | --- |
| Hero | Hero CTA "Start with 25 free applications" | Default (Ground fill, Phosphor White border) |
| Problem, Method A, Bench | Navbar CTA | Lime |
| Approve latch in view | The latch square drawn in the scene (and its DOM twin button stays Default style) | Default |
| Pricing, with the Pro plan CTA in view | Pro plan CTA | Default |
| Compare, FAQ | Navbar CTA | Lime |
| Closing CTA | Closing "Start free" | Default |

No-JavaScript default: `data-lime="heroCta"` is written in the server HTML, so the first viewport is correct before any script runs. CSS: `:root[data-lime="heroCta"] [data-lime-slot="heroCta"] { background: var(--accent); color: var(--accent-ink); }` and the equivalent for the other slots. Transition 300ms ease-out on `background-color`, matching the brief.

Justification: the brief's lime semantics are "act" or "this is on". Handing lime along the page means lime always marks the one place the visitor should act or decide, and the approve latch is the clearest instance, because approval is the product's central human action.

### 2.3 Logo on the landing page

The brief lists the logo as a lime use. The user's rule limits lime to one element per viewport, so a lime logo in the navbar would permanently occupy the slot. Decision for the landing: the navbar logo is the same square mark in Phosphor White fill with a Void glyph. The lime version stays in the favicon, extension icons and the OG image, where no viewport is shared. This is flagged in the risk register for the product owner to confirm.

### 2.4 Landing-only token extensions (named and justified)

The brief's tokens are the base. These are the only additions, all applying to `web/app/(public)` and nowhere in the signed-in app. No new hues are introduced.

| Token | Value | Justification |
| --- | --- | --- |
| `--text-display-xl` | `clamp(3.5rem, 2.2rem + 6.4vw, 9.5rem)`, line-height 0.92, tracking −0.03em, Inter Tight 400 | The brief caps Display at 64px. An Awwwards-calibre hero needs poster-scale type. Size is the only hierarchy lever left under the 400/500 rule |
| `--text-heading-xl` | `clamp(2.5rem, 1.6rem + 3.2vw, 4.5rem)`, line-height 1.0, tracking −0.025em | Section titles above the brief's 42px for the scroll-story sections only |
| `--thread` | Moss 70 `#9cbf93` at 60% alpha, 1px | The motif line. Reuses an existing color. Active state: Phosphor White `#ddffdc` at 90%, 2px |
| `--sample-border` | `1px dashed var(--border)` | Reuses the brief's dashed empty-state treatment. Meaning on this page: sample data or not yet real |
| `--notch-w` | 12px | Width of the opening in section dividers |
| `--ease-settle` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrances, thread draws, line reveals. Amends the brief's "300ms ease-out only" for the landing |
| `--ease-inout` | `cubic-bezier(0.65, 0, 0.35, 1)` | Scene state changes, latch travel |
| `--ease-snap` | `cubic-bezier(0.7, 0, 0.84, 0)` | A refused thread retracting (fast ease-in, no overshoot) |
| Durations | 160, 240, 360, 480, 700, 1100 ms | Micro, control, tween, thread draw, reveal, anchor travel |
| Stagger | 40ms (chips, rows), 70ms (headline lines) | Matches the research reconstruction of Terminal Industries' reveal |
| `--stage-h-mobile` | `clamp(220px, 34svh, 340px)` | Height of the docked canvas band below `lg` |

The amendment of spring easing is not used. There is no overshoot anywhere. The centerpiece uses critically damped smoothing only (section 4.7).

---

## 3. Narrative arc

### 3.1 Overview table

Sections are numbered like ledger entries (`#01`). The numerals are the page's navigation system (ledger rail on wide screens, section labels everywhere).

| # | Section | Job in the story | Visitor feels | Visitor learns | Scene state (key) | Desktop height |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Hero: "No fact, no line." | Show the rule before explaining it | Curiosity, then relief | Lines connect to facts; an invented line has nowhere to connect | K0, K1 | 100svh (min 720px) |
| 02 | Problem: "Your name goes on every line." | Name the four reported failures | Recognition, mild alarm, held calmly | These failures are lines or jobs with no source | K2 | ~120svh |
| 03 | Method A: confirm, fit, cite | First three steps of one application's life | Order, control | Facts first, jobs gated with reasons, lines cited | K3, K4, K5 | 3 beats × 100svh |
| 04 | Lock Bench (hands-on) | Let the visitor attack the rule | Agency, then trust | An invented claim is refused and nothing is added | K6 | ~110svh |
| 05 | Method B: approve, send, receipt and replies | Rest of the lifecycle | Safety | Nothing leaves without approval; a receipt follows; replies return; an offer pauses billing | K7, K8, K9 | 3 beats × 100svh |
| 06 | Billing and pricing | Make cost legible | Fairness | One credit per submitted application, failures free, the price per application at your usage | K10 (scene away) | ~190svh |
| 07 | Comparison | Contrast mechanisms with reported complaints | Clarity | What Kairos does differently, without naming anyone | none | ~110svh |
| 08 | Questions | Remove last doubts | Reassurance | Honest limits (LinkedIn, detection, upload) | none | ~100svh |
| 09 | Close: "Try it on 25 real applications." | Ask once | Readiness | The free start and the approval promise | K11 | 100svh |
| nav, footer | Chrome | Orientation, honesty, brand idea | Orientation | What kairos means; what this page cites | n/a | fixed, ~420px |

Total desktop length is about 17 screens. Mobile is shorter (no extra scroll length for beats; see 8.1).

### 3.2 Chrome: navbar, ledger rail, skip links

**Navbar** (all pages already share it; the landing uses the brief spec): Carbon Veil at 85% with 10px backdrop blur, 64px tall, bottom border Phosphor Blue-Black, left-aligned logo mark and wordmark, links How it works, Pricing, Blog, About, a Sign in link, and "Start free". Landing-only behaviour: the Start free button follows the lime baton (2.2). The bottom border is a `--divider` hairline that carries the first notch, 12px wide, directly under the logo mark, so the motif is present from the first pixel. There is no hide-on-scroll; it stays, because the CTA must stay reachable.

**Ledger rail** (≥1280px only): fixed at the right gutter, vertically centered, 9 entries `01` to `09` in caption style (12px, +0.6px tracking, tabular numerals). The active entry reads `03 METHOD` in Phosphor White; inactive entries show only the numeral in Sage 60 (8.3:1, passes). Between entries a 1px Phosphor Blue-Black hairline; the portion of that hairline above the current scroll position is drawn in Moss 70, which makes the rail a progress indicator. Every entry is an anchor link; active state is set by `IntersectionObserver` with `rootMargin: "-45% 0px -45% 0px"`. Hidden below 1280px. Not in the accessibility tree as navigation duplicate: it is a `nav` with `aria-label="Page sections"` and `aria-current="location"` on the active link, and the skip links below give keyboard users a faster path.

**Skip links** (first focusable elements): "Skip to main content", "Skip the walkthrough" (jumps to `#06` Billing), "Skip to pricing". Visible on focus as Default buttons.

### 3.3 #01 Hero: "No fact, no line."

**Layout (desktop ≥1024px).** 12-column container, max 1280px, gutters 32px. Left, columns 1 to 6: eyebrow, H1, subhead, two CTAs, microcopy, and a sample caption. Right, columns 6 to 12: the Fact Field in its resting oblique pose. The headline's second line overlaps column 6 slightly at the largest sizes; the nodes never enter columns 1 to 5, so text always sits on Void.

**Copy.**

| Element | Text | Notes |
| --- | --- | --- |
| Eyebrow (caption style) | `#01  FOR NEW GRADS, OPT AND ANYONE BETWEEN JOBS` | KEEP from the current page |
| H1 | No fact, no line. | Display XL. Two lines: "No fact," and "no line." |
| Subhead (20px lead, Moss 80) | Every line on your resume cites a fact you confirmed. Kairos finds roles that fit, and sends nothing until you approve it. | Carries the fit-first and approval promises; clarifies "line" |
| Primary CTA (lime, hero slot) | Start with 25 free applications | KEEP. 25 submitted applications once (PRC) |
| Secondary CTA (outlined) | See how it works | Anchors to `#03` |
| Microcopy (Sage 60, 14px) | Credits are only used when an application actually goes through. | Drops "No card" until confirmed (facts sheet 1.6). If confirmed, prepend "No card." |
| Scene caption (below canvas, 12px, Sage 60, dashed chip "Sample") | An invented line, "Led a migration to Kafka", has no fact to cite. | Appears with the one-time rejection sequence; static text under reduced motion |
| Canvas controls (bottom-left of stage, 44px targets) | `Replay`, `Pause motion`, `Reduce motion` | `Pause motion` is a toggle button (`aria-pressed`). See 8.3 |

Browser title and meta description keep the existing brand line: "Kairos: job applications you would sign" and the `siteConfig.description`.

**Kinetic sequence (first load, motion allowed).**

| t (ms) | Event |
| --- | --- |
| 0 | HTML is painted. Inline SVG poster of the field is already visible in the stage (T0 diagram, see 8.2). H1 lines start `rise` (CSS only): each line is `overflow: hidden`, inner `translateY(105%) → 0`, 700ms `--ease-settle`, line 2 delayed 70ms. Text is in the HTML, so it is the LCP element and readable without JavaScript |
| 0 to 300 | Eyebrow opacity 0 → 1, 300ms linear |
| 420 | Subhead, CTAs, microcopy opacity 0 → 1, 400ms. No transform |
| 900 | Cite chip `cites fact #12` (caption style, 1px Circuit Border pill, Moss 70 text) attaches to the comma of "fact," by a 1px thread drawn in 480ms |
| ~1200 (after canvas ready, requestIdleCallback with 1200ms timeout) | Canvas cross-fades over the poster in 600ms. Facts appear in 3 waves (8 per wave, 40ms stagger, scale 0.4 → 1 and opacity 0 → 1, 360ms) |
| ~1700 | The chip's thread continues as an SVG overlay path across the gap to the projected screen position of node #12, drawn in 700ms. The same thread then enters the scene and meets bar 4 |
| ~2200 | Bars 1 to 9 receive their threads one at a time, 120ms apart, 480ms each (threads grow from the fact to the bar) |
| ~3400 | One-time rejection: a tenth bar (outlined, dashed) slides in from the right over 240ms, extends a thread toward the field for 360ms, stops at the lock plate (a small bracket pair `[ ]` that closes), retracts in 160ms with `--ease-snap`, and the bar fades out in 240ms. The caption appears. Ends. Nothing loops |

Visitor-controlled: `Replay` replays 3400 to 4400 only. If the visitor scrolls, hovers a node or presses a key before 3400, the rejection is skipped and available through `Replay`.

**Scroll-out (0 to 60vh).** The headline parts: line 1 translates `−8vh`, line 2 `−2vh`, both opacity 1 → 0 between 40vh and 90vh. The remaining draft threads draw (scene K0 → K1). The eyebrow and CTAs scroll at 1:1 (never parallaxed; a moving CTA is a usability cost).

**Cite-trace in the hero.** Hovering or focusing "fact," (it is a link to `#04`, the Lock Bench) lights node #12 and its bar. This teaches the main interaction in the first viewport without a tutorial.

**Accessibility.** The H1 is real text. The canvas is `aria-hidden="true"`. The chip is a button with `aria-label="Cites fact 12: Built an invoice retry service during the internship. Sample data."`

### 3.4 #02 Problem: "Your name goes on every line."

**Layout.** Left columns 1 to 6: caption `#02  THE PROBLEM`, H2 in Heading XL, one paragraph. Below, a four-row ledger (full-width rows with Circuit Border rules, no cards, no zebra). Right: scene K2.

**Copy.**

H2: Your name goes on every line.

Paragraph: People tell us what goes wrong with auto-apply tools: jobs that do not fit, skills and metrics they never had, a review step with no way to edit, and charges after they leave. [1] Each of these is a line, or a job, with nothing behind it.

Ledger rows (each: `#` numeral, reported problem in Phosphor White 20px, one-line mechanism in Sage 60, link "See the fix" to the beat):

| Row | Reported problem | Kairos answer line | Links to |
| --- | --- | --- | --- |
| 02.1 | Jobs that do not fit | Hard rules first, then a fit bar with written reasons. | `#03` beat 2 |
| 02.2 | Skills and metrics you never had | Every line cites a fact you confirmed. | `#03` beat 3, `#04` |
| 02.3 | A review step with no edit step | Edit any field or line, then approve. | `#05` beat 1 |
| 02.4 | Charges after you leave | One credit per submitted application. Failed submits cost nothing. Billing pauses on an offer. | `#06` |

Footnote [1]: "Reports from job seekers about auto-apply tools. We name no tool and publish no rate." (Facts sheet 3.3: attribute to users, do not name competitors, do not quote the 1% figure.)

**Scene K2 (failure state).** The field desaturates: confirmed nodes drop from Phosphor White to Sage 60. Four of the nine bars lose their threads and render as dashed outlines. A few job points hang unsorted near the field. Hovering or focusing a ledger row highlights its counterpart in the scene (row 02.1 lights the unsorted jobs, row 02.2 the dashed bars, row 02.3 a closed bracket pair drawn around the draft column with no way in, row 02.4 a ghost price slip at the bottom). The scene shows the problem, not any named product; it is labelled by the caption "Illustration of the reported problems. Not any product's output."

**Kinetic.** H2 uses line-mask reveal on enter. As the heading crosses viewport center its color steps from Sage 60 to Phosphor White over a 40vh scroll window (the "confirmation tint": the heading is read, then confirmed). Rows reveal with a notch-draw: the row's top rule draws outward from the notch in 600ms `--ease-settle`, 40ms stagger.

**Feeling.** The section ends the fear without softening it: the next section opens with "Kairos starts with the facts."

### 3.5 #03 Method A: confirm, fit, cite

Three beats, each a 100svh block of ordinary document flow. The text sits in columns 1 to 5, vertically centered. The canvas does the pinning (it is fixed), so there is no scroll hijack and no CSS pin. Each beat has a ledger caption `#03.1`, `#03.2`, `#03.3`. Intro line above beat 1 (Heading, 30px): "Four steps, and you stay in charge of each." (KEEP from the page; the four steps become six beats across `#03` and `#05`, so the intro reads "Six steps, and you stay in charge of each." Use the six-step wording.)

#### Beat 03.1 Confirm your facts

Copy: **Confirm your facts.** Paste your resume. We split it into facts, and you confirm each one. Nothing you did not confirm is ever used. [2]

Footnote [2]: "Version 1 takes pasted text. Facts are numbered so a resume line can point at them." (Fixes "Upload" to "Paste", facts sheet 1.6.)

Scene K3: the draft column at the right becomes a "paste block" of twelve line bars. As scroll progresses 0 → 1 across the beat, the bars split into small squares that travel to the field and settle as hollow nodes (unconfirmed). From 0.35 to 0.9 the nodes fill solid one by one, in id order, as if confirmed. A DOM counter in the text column, tabular numerals, reads `Facts confirmed: 17 of 24`, computed from progress (`Math.round(p * 24)`). Caption chip (dashed): "Sample profile".

Interaction: the 24 facts are also a keyboard-reachable list: a `<details>` labelled "Show the 24 sample facts" containing a list of buttons (roving tabindex). Activating one highlights its node (cite-trace, section 5.1).

#### Beat 03.2 Set the fit bar

Copy: **Set the fit bar.** Roles, seniority, locations, visa needs, a salary floor and a fit threshold. A job that breaks a hard rule is dropped before any model reads it. [3] The rest get a score and written reasons.

Footnote [3]: "Hard rules run first (role, seniority, location, salary floor, visa needs, exclude list). Source: product spec."

Scene K4: 48 sample job points (squares, 4px) enter from the upper right, pass a gate frame (hairline rectangle with a notch on its left side), and sort into lanes: kept (stay on the line), dropped by a hard rule (fall to lower left, Sage 40 at 35% alpha), below the bar (fall to lower right, Sage 60 at 50%). Camera moves to frontal over the first 30% of the beat.

Interaction: the Fit Bar (section 5.3), a native range input in the text column.

Sample data label: dashed chip "Sample: 48 made-up postings".

#### Beat 03.3 Cite every line

Copy: **Cite every line.** Each tailored line carries the ids of the facts it uses. A line that cites a fact you do not have is refused, and the edit screen shows which line it was. [4]

Footnote [4]: "A save that cites an unknown fact id returns an error and stores nothing. The edit screen lists the line. Source: product spec."

Scene K5: camera frontal. The bars hand off to DOM: at progress 0.15 to 0.35 the nine bars cross-fade (240ms) into nine sample draft lines set in Inter 16px (the sample lines are real text in a `ul` with `aria-label="Sample draft, 9 lines"`). Each line ends with a cite chip (`cites #08, #12`). Threads draw from fact nodes to the line ends in the order of the lines (120ms stagger, 480ms each). The thread endpoints are DOM-aligned: the scene computes the line end positions from `getBoundingClientRect()` on layout, resize and font load, so threads meet text exactly. This is the 3D to 2D hand-off (research: Oryzo).

At progress 0.7, one more line tries to enter (the orphan "Led a migration to Kafka") and is refused, with the same sequence as the hero but at legible scale; the DOM line text falls (see 7.3) and a status word "Not allowed" appears in `--bad` with an icon-free badge. Below it, a link: "Try it yourself" to `#04`.

Sample draft lines (all labelled sample, no outcome metrics):

| Line | Cites |
| --- | --- |
| Built an invoice retry service in TypeScript during a billing-team internship. | #08, #11, #12 |
| Wrote integration tests for payment webhooks. | #13 |
| Used RabbitMQ queues in the internship project. | #14 |
| Designed PostgreSQL schemas for a Node.js service. | #09, #10 |
| Led a capstone team of three and presented it at a campus demo day. | #15, #16 |
| Built a budgeting app with a team of four at a hackathon. | #17 |
| Built React front ends against a REST API. | #18, #19 |
| Teaching assistant for intro programming for one semester. | #07 |
| BS in Computer Science, 2025. | #01 |

### 3.6 #04 The Lock Bench

**Purpose.** The only place the visitor can try to break the rule. It is the page's signature hands-on moment and the strongest answer to "does it invent experience?".

**Layout.** Caption `#04  THE LOCK`. H2 (Heading XL): Try to get a claim past the lock. Left, columns 1 to 5: the form (label, text input, "Check line" button, three preset chips, result region, and the demo note). Right: scene K6, a flat frontal diagram of the 24 facts with DOM hit buttons, the draft column, and the lock plate.

**Copy.**

| Element | Text |
| --- | --- |
| Label | A line for your resume |
| Helper text | Type a claim, or pick one. The lock checks it against 24 sample facts. |
| Button | Check line |
| Presets | `Built an invoice retry service in TypeScript` / `Led a capstone team of three` / `Led a migration to Kafka` / `Cut failed charges by 40%` |
| Result, accepted | Accepted. This line cites fact #12 and fact #08. |
| Result, refused | Refused. No fact in this sample mentions Kafka. Nothing was added. (The sample profile mentions RabbitMQ, fact #14.) |
| Result, refused (number) | Refused. No fact in this sample has a figure like 40%. Nothing was added. |
| Demo note (12px, Sage 60, dashed chip "Demo") | This demo compares the words of your claim with the 24 sample facts. The real lock checks that every resume line cites facts you have confirmed. [5] |

Footnote [5]: "In the product, each tailored line carries fact ids. A save that cites an id you do not own is refused and nothing is stored."

The honesty of the demo is the point: the demo note is on screen next to the input, not behind a tooltip. The demo never implies that Kairos reads arbitrary text for truth. It demonstrates the rule: a line needs a fact.

**Scene K6 (frontal diagram).** The field is flat, nodes spaced at least 40px apart (Poisson-disc layout with a seeded generator so the layout is stable), each node overlaid by a 28×28 minimum DOM button (WCAG 2.5.8 target size) labelled "Fact 12: Built an invoice retry service during the internship". The draft column holds the nine sample lines in miniature and an empty tenth slot. Full interaction design in section 5.2.

### 3.7 #05 Method B: approve, send, receipt and replies

Same scroll-stage structure as Method A: three beats, text in columns 1 to 5.

#### Beat 05.1 Review and approve

Copy: **Review every draft, then approve.** Each application shows its resume diff, every answer and why it matched. Edit anything, then approve one or a batch. [6] Kairos is Greek for the right moment. You choose it.

Footnote [6]: "Nothing is sent until you approve it. You can withdraw a draft or an approved application before it is sent."

Scene K7: the nine cited lines gather into a single slip (outlined rectangle, serrated bottom edge, like a thermal receipt) at center. Below the slip, a track (56 × 20px hairline) with a square knob. The knob is the **latch**, drawn in Lime Pulse: this is the one lime element in this viewport (the navbar is Default via the lime baton). DOM twin: a Default-style button "Approve this application (sample)" under the beat copy. Pressing the button or activating the latch with Space or Enter slides the knob across the track in 240ms `--ease-inout`; the slip's status word changes from `Needs review` (`--warn`) to `Approved` (`--good`), and the lime hands back to the navbar once the latch scrolls out of view.

Edge case, deliberate: if the visitor scrolls past without approving, the story does not pretend. See 5.4.

#### Beat 05.2 Send

Copy: **Send from your browser.** The extension fills the employer's own form and saves a receipt. Pro and Max can also send with the laptop closed. [7]

Footnote [7]: "Greenhouse, Lever and Ashby career pages. We do not automate LinkedIn, because its user agreement bans bots."

A segmented control (two native radio buttons styled as a Default button group) switches the scene between `Your browser` and `Cloud, laptop closed (Pro and Max)`. Scene K8: the slip travels along a hairline path (900ms, `--ease-inout`) into a window frame (hairline rectangle with a title bar line) where nine rows of a form fill left to right, 60ms stagger. The cloud variant uses a frame with no title bar. The status word `Submitted` (`--good`) appears at the end. If the sample was not approved, the same animation plays as a dashed ghost path and the slip stays put (5.4).

Build-status gate: facts sheet 6.1 says to hold "extension" and "cloud applier" as live until verified. The copy above describes the design, as the current page does, and the launch checklist in section 12 blocks shipping this beat as written until build status is confirmed; the fallback copy is "Beta" wording named there.

#### Beat 05.3 Receipt and replies

Copy: **Keep the receipt. Hear back without handing over your inbox.** Every submitted application saves a receipt: each field sent, each answer, the resume version and the confirmation page. [8] Replies come back through a forwarding address you control, with no Gmail login. [9] If a forwarded email says you have an offer, billing pauses. [10]

Footnotes: [8] "Receipts exist for submitted applications, not for drafts." [9] "You set one forwarding filter. Replies about your applications go to a private address we give you." [10] "A forwarded email classified as an offer pauses the active subscription."

Scene K9: the slip becomes a receipt strip that prints downward in 12 rows as scroll progresses (scrubbed, reversible). Each row has a thread to the fact numeral it used, shown in a margin column of `#NN` chips. After row 12, a second thread enters from the right edge toward the receipt's foot, labelled in the DOM "Reply, via your forwarding address". Last, two short vertical bars (a pause mark, 2px wide) appear beside the plan label and the DOM caption reads "Billing paused" with a status badge.

Receipt rows (sample): Employer's form, 14 fields sent (sample), Answers approved by you, Resume version, Confirmation page, Cited facts, Credits used: 1, Status: Submitted. "14 fields" is a sample count shown inside a dashed "Sample" receipt.

### 3.8 #06 Billing and pricing: "Pay for applications that went through."

The scene dims out here. Over the first 30vh of the section the canvas opacity goes 1 → 0 (500ms `--ease-inout`), then the render loop stops (`frameloop="never"`). Body content is flat DOM, per the Sharplink lesson (no WebGL behind tables).

**Layout.** Caption `#06  BILLING`. H2 (KEEP): Pay for applications that went through. Left column intro; below, two stacked blocks: the Receipt Calculator (section 5.5) and the plan table.

**Copy.**

Intro: One credit per submitted application. A failed submit costs nothing, and a duplicate report charges once. [11] If a forwarded email says you have an offer, we pause billing. [10] Cancel any time from the Stripe customer portal.

Plan table: reuse the existing `PricingPlans` component (shared with `/pricing`) so prices have one source of truth in `shared/src/plans.ts`. The landing wraps it; changes needed there are flagged in section 12: the accent badge "Most chosen" becomes a neutral outline badge on the landing so it does not take lime, and the Pro CTA is the `pricingCta` lime slot.

Pricing facts used (PRC): Free 25 submitted applications once, 1 resume profile. Starter $19 monthly, $6 weekly, $45 quarterly, 400 per 30 days. Pro $39, $12, $95, 1,200. Max $79, $25, $189, 3,000. Launch-price note beneath: "Launch prices. They may change for new customers." [12] Footnote [12]: "Prices are in US dollars through Stripe. Regional pricing is not part of version 1."

Cost per application at full use (shown on each plan card and in the calculator): monthly $0.048, $0.033, $0.026; weekly $0.064, $0.043, $0.036; quarterly $0.038, $0.026, $0.021. Footnote [13]: "Price divided by credits per period. For example, $39 / 1,200 = $0.0325, shown as $0.033. Weekly credits are 94, 280 and 700. Quarterly credits are 1,200, 3,600 and 9,000."

Honesty line directly under the calculator: "The more of your credits you use, the lower the price per application. If you use few, it is higher. The calculator shows both." This is the exactness the page can own.

No competitor prices, no discount anchors, no "70% off".

### 3.9 #07 Comparison: "How it compares with typical auto-apply."

The H2 is KEEP, but the column header changes from "typical" to what is reported, so the page never states a fact about a named or unnamed product it cannot source.

**Layout.** A real `<table>` with a `<caption>` ("What people report about auto-apply tools, and what Kairos does instead"), `<thead>`, row headers. Three columns: Topic (Sage 60 caption), `What people report` (Sage 60), `Kairos` (Phosphor White). Each Kairos cell ends with a cite mark `[n]` linking to the footnote. Each row's top rule carries a notch and, in the Kairos column, a short thread glyph (decorative SVG, `aria-hidden`) leaving from the notch to the cell, to carry the motif without clutter.

| Topic | What people report | Kairos |
| --- | --- | --- |
| Which jobs get applications | Matches that do not fit | Only jobs that pass your hard rules and fit bar. Each skip has a reason you can read. [3] |
| Resume changes | Skills and metrics you do not have | Each line cites a fact you confirmed. [4] |
| Before it sends | A review step without an edit step | Edit every field and line, then approve. [6] |
| Replies | Broad Gmail access | A forwarding address you control. [9] |
| What you pay for | Charges after cancelling, lost credits, ignored refunds | Credits only for submitted applications. Billing pauses on an offer email. [10] [11] |
| Volume | A race to send more | Kairos skips jobs that do not fit, so you may use fewer credits than your plan allows. |

Under the table, one sentence: "We name no other product, and we do not compare prices here." This preempts the legal question and reads as accountable. Footnote on the section: "Reports from job seekers, not measurements of any product." (the same [1]).

**Motion.** Rows reveal top to bottom with the notch-draw (600ms, 40ms stagger). No scene. The table is fully static after reveal.

### 3.10 #08 Questions

KEEP the existing five Q&As with the facts-sheet fixes, and add three. Native `<details>` elements (the existing `FaqList` pattern, which is the right accessible choice). Each summary row has the `#08.n` numeral on the left and a 24px plus/minus drawn as two hairlines.

| Q | A |
| --- | --- |
| Which job sites does it apply on? | Employer career pages on Greenhouse, Lever and Ashby. We do not automate LinkedIn, because its user agreement bans bots and it puts your account at risk. |
| Will recruiters know I used it? | The application is submitted through the employer's own form with your details and answers you approved. We do not promise it is undetectable; we make sure it is something you would have sent yourself. |
| Does it invent experience to match a job? | No. Every tailored line has to cite a fact from your confirmed profile. A line that cites a fact you do not have is refused, and the edit screen shows which line it was. |
| What does the lock actually check? (new) | Each resume line carries the ids of the facts it uses. If an id is not in your confirmed profile, the save is refused and nothing is stored. |
| Can I upload my resume? (new) | Version 1 takes pasted text. |
| What if a submission fails? | You keep the credit. The application shows why it failed so you can fix it and send again. |
| Do you need my Gmail password or access? | No. You set one forwarding filter, and replies about your applications come to a private address we give you. |
| Do I need a card to start? (new, only after confirmation) | Include only once the product owner confirms the free path skips a card. Until then this row is omitted. |

Motion: opening a row draws a 1px thread from the numeral to the answer's first line (240ms `--ease-settle`) and expands height with `grid-template-rows: 0fr → 1fr` (300ms), no layout thrash. Closed rows have no animation. A FAQ JSON-LD block mirrors the visible Q&A exactly.

### 3.11 #09 Close: "Try it on 25 real applications."

**Layout.** Caption `#09  START`. Left: H2 (Heading XL): Try it on 25 real applications. Body: Every application waits for your approval. CTA "Start free" (lime, closing slot) and a text link "Read the questions again" to `#08`. Right: scene K11.

**Scene K11.** The canvas returns (opacity 0 → 1 over 600ms when the section top reaches 85% of the viewport) and re-forms the oblique hero pose. The difference from the hero: all nine bars are threaded, the orphan slot is empty, and a small receipt strip rests below the column. The field settles in about 1.4s (facts 360ms, threads 480ms with 120ms stagger) and stops. The visual rhyme tells the story: the same field, now complete.

The headline echo: the small caption above the CTA repeats "No fact, no line." in Heading (30px) as a quiet closing line, not a second hero.

### 3.12 Footer

Standard footer from `components/layout`, restyled to the brief, with four additions.

1. **The word.** "kairos (Greek): the right moment, as distinct from chronos, clock time." Caption style above the link columns.
2. **The time line.** "It is 14:32 where you are. Nothing sends until you say so." The time is `Intl.DateTimeFormat(undefined, { timeStyle: "short" })`, updated once per minute, in a `<time>` element wrapped in `aria-hidden="true"` (the sentence stays readable without the number). Server renders the sentence without the time ("Nothing sends until you say so.") to avoid a hydration mismatch, and the client adds the time. This is the Moto Finance clock idea, used for the kairos meaning rather than decoration. It makes no claim about product timing.
3. **The page receipt.** A small ledger block with a dashed top rule: `Claims on this page: N`, `With a footnote: N`, `Customer quotes: none yet`, `User counts: none yet`. N is computed at build from `[data-claim]` elements and footnote anchors; a unit test fails the build if the two numbers differ or if a `[data-claim]` has no footnote target. This is the accountable mirror of the truth lock, applied to the page itself.
4. **Motion setting.** A `Motion: Full / Reduced` segmented control (native radios) stored in `localStorage` inside try/catch, applied as `data-motion` on `<html>` before first paint by a tiny inline script.

Links: Product (How it works, Pricing, Blog, About), Legal (Terms, Privacy, Cookies, Refunds), Contact (the address from `siteConfig.supportEmail`, never hardcoded, because the domain is an open question in the PRD). A giant wordmark is not used; the closing scene is the sign-off.

---

## 4. The single WebGL centerpiece: the Fact Field

### 4.1 What it is

One `<canvas>` rendered with React Three Fiber, mounted once, never unmounted, never duplicated. It draws a small, exact diagram that behaves like a sculpture: 24 sample facts, 48 sample job postings, a draft column of up to 10 resume bars, a few dozen citation threads, a gate frame, a lock plate, a latch, a receipt slip and a window frame. All shapes are 2D primitives placed in a shallow 3D volume, so the 3D to 2D to 3D change is a camera and rotation move, not a model swap. There are no textures, no GLTF models, no HDRIs and no post-processing in T1; the entire scene is geometry, a few small shaders, and numbers.

### 4.2 Anatomy

| Element | Count (T2 / T1) | Geometry | Draw calls | Meaning |
| --- | --- | --- | --- | --- |
| Fact nodes | 24 / 24 | Instanced quads rendered as square points, 7px (9px when active), size-attenuated | 1 | One confirmed fact each |
| Node halos | 24 / 0 | Instanced soft quads, 3× node size, alpha ≤ 0.12, Moss 70 | 1 | The only "emissive" cue; absent in T1 |
| Job points | 48 / 24 | Instanced quads, 4px | 1 | Sample postings |
| Draft bars | 10 / 10 | Instanced quads, 4px tall, widths 1.4 to 2.2 units | 1 | Resume lines (slot 10 is the refusal slot) |
| Citation threads | up to 36 / up to 24 | Instanced ribbons: each is a 24-segment strip built in the vertex shader from four Bézier control points; screen-space width 1.5px | 1 | The motif |
| Gate frame and lock plate | 2 | Line segments (LineSegments with a basic ShaderMaterial) | 1 | Hairline frames with a notch |
| Slip | 1 | Closed line loop with serrated bottom | 1 | The application/receipt |
| Window frame | 1 | Line loop with optional title bar | 1 | Browser or cloud |
| Latch | 1 | Track (line) plus a 16px square knob in Lime Pulse | 1 | Approval |
| Ambient dust | 0 | none | 0 | Removed (no ambient motion) |

Total: at most 10 draw calls, under 6,000 triangles. No overdraw beyond the halos.

### 4.3 Look within the phosphor palette: emissive, never neon

Palette lock: every material has no vertex colors and no textures. Its fragment shader takes two uniforms, `uColorA` and `uColorB`, set from this fixed table, and outputs only `mix(uColorA, uColorB, t)` where `t` comes from a state value. Nothing else can reach the screen, so the scene cannot drift off-palette by accident.

| Role | Token | Hex |
| --- | --- | --- |
| Canvas clear color | Void Black | `#000000` |
| Confirmed fact (solid) | Phosphor White | `#ddffdc` |
| Unconfirmed fact (hollow) | Sage 60 | `#8cab87` |
| Thread (resting) | Moss 70 at 60% alpha | `#9cbf93` |
| Thread (active) | Phosphor White at 90% alpha | `#ddffdc` |
| Dropped job, dimmed fact | Sage 40 | `#677d64` |
| Gate frame, window frame, slip | Fern Link | `#859984` |
| Halo | Moss 70 at 12% alpha | `#9cbf93` |
| Latch knob | Lime Pulse (fill, only when the baton owner is `latch`) | `#7fee64` |

Rules that keep it from reading as neon:

1. **Brightness ceiling.** No fragment is brighter than `#ddffdc`. Halos cap at alpha 0.12. No bloom, no UnrealBloom, no additive stacking above that cap.
2. **No colored light.** There are no lights. Everything is unlit shader output.
3. **No gradients as decoration.** The only gradient is the halo falloff, which is a distance function on a small sprite, not a background.
4. **Dither.** A 1/255 blue-noise offset is added in the fragment shader so dark falloffs do not band on 8-bit displays.
5. **Square, not round.** Points are squares, echoing the brief's 0px-radius icon rule and distinguishing the scene from the round glowing orbs of most "AI" sites.
6. **Palette test.** A Playwright screenshot test samples frames at 12 scroll positions and fails if any non-black pixel falls outside the green-sage family (hue 95° to 135°) other than pixels inside the latch's bounding box.

### 4.4 Coordinate system and camera

Starting values for a 1440 × 900 viewport. One world unit equals about 100px at z = 0. Camera: PerspectiveCamera, fov 28°, position z = 18.05, which gives a world viewport height of 9 units at z = 0. The scene group offset shifts the composition into columns 6 to 12 (group x = +2.9 on desktop, 0 on mobile where the canvas band is already sized to the stage).

| Pose | Group rotation (y, x) | Used in | Pointer parallax |
| --- | --- | --- | --- |
| Oblique | −0.42 rad (−24°), −0.10 rad (−6°) | K0, K1, K11 | ±0.10 rad on fine pointers |
| Semi | −0.22 rad, −0.05 rad | K2 | ±0.05 rad |
| Frontal | 0, 0 | K3 to K9 | none (±0.02 rad only in K6) |

Facts have z in [−1.2, 1.2] from a seeded generator, so the oblique pose shows depth and the frontal pose collapses it. x and y are Poisson-disc samples with minimum separation 0.42 units, so node buttons are always at least 40px apart in the frontal pose. Nodes never occupy x < 0.4 (columns 1 to 5), which keeps the text column on pure Void.

### 4.5 Scene state table (desktop; mobile mapping in 8.1)

State keyframes K0 to K11. `u` is the beat progress 0 to 1 once the beat's text block spans the viewport. States cross-mix during the last 25% of the previous block and the first 25% of the next.

| Key | Anchor | Facts | Jobs | Draft bars | Threads | Other | Camera |
| --- | --- | --- | --- | --- | --- | --- | --- |
| K0 Rest | Page load | 24 solid, Phosphor White | hidden | 9 bars, outlined, short | 0 drawn (grow in per the hero sequence) | Lock plate hidden | Oblique |
| K1 Complete | Hero exit (60vh) | 24 solid | hidden | 9 bars filled | 9 threads drawn | Lock plate visible at bar 10 slot | Oblique |
| K2 Failure | `#02` centered | 24 at Sage 60 | 14 jobs hang unsorted left of the field | 5 threaded, 4 dashed with no thread | 5 | none | Semi |
| K3 Confirm | `#03.1` | 24 hollow → solid, by `u` | hidden | 12 paste bars split into squares, then bars hidden | 0 | none | Frontal over first 30% of beat |
| K4 Gate | `#03.2` | 24 solid, dimmed to 50% | 48 flow through the gate; lanes by bar and hard rules | hidden | 0 | Gate frame with notch at x = +1.2 | Frontal |
| K5 Lock | `#03.3` | 24 solid | hidden | 9 bars hand off to DOM lines at `u` 0.15 to 0.35 | 9 draw in order; refusal at `u` 0.7 | Lock plate visible | Frontal |
| K6 Bench | `#04` centered | 24 solid with DOM buttons | hidden | 9 miniature lines plus empty slot 10 | 9 plus live results | Lock plate | Frontal |
| K7 Approve | `#05.1` | 24 dimmed to 50% | hidden | 9 gather into the slip | threads fade to 15% | Slip, track and latch; latch lime only if baton owner is `latch` | Frontal |
| K8 Send | `#05.2` | 24 dimmed to 30% | hidden | slip travels into the frame | none | Window frame (browser) or frameless variant (cloud); ghost path if not approved | Frontal |
| K9 Receipt | `#05.3` | 24 at 50%, numerals via DOM chips | hidden | slip becomes a printing receipt of 12 rows | one thread per row to a fact; return thread for the reply | Pause mark near the plan label at `u` > 0.85 | Frontal |
| K10 Away | `#06` start + 30vh | opacity 0 | | | | `frameloop="never"` after fade | any |
| K11 Re-form | `#09` top at 85vh | 24 solid | hidden | 9 filled bars | 9 threads | Receipt strip below the column; no orphan | Oblique |

### 4.6 The state shader pattern

Each instanced layer reads a small set of per-instance attributes (`aHome`, `aLane`, `aDelay`, `aState`) and a handful of shared uniforms (`uProgress[12]` as a `Float32Array`, `uPointer`, `uTime` only for tween timing, `uResolution`). Positions are computed in the vertex shader from `mix(aHome, aLane, ease(clamp((uProgress[k] - aDelay) * 4.0)))`, so the CPU does no per-point work per frame. Thread geometry is the same: four control points per instance, a draw parameter, and a state float. The CPU writes at most 12 floats and two vec2s per frame.

### 4.7 Smoothing and the render loop

1. **Frame loop on demand.** `frameloop="demand"`. The scroll handler, pointer handler, tween ticker and state changes call `invalidate()`. When nothing moves, no frames are drawn and the GPU is idle. This is why the scene has no idle motion: the architecture and the brand rule agree.
2. **Damping.** Critically damped smoothing, `x += (target − x) * (1 − exp(−λ · dt))`, with λ = 6 for camera rotation and λ = 9 for element progress. No springs, no overshoot.
3. **One clock.** Lenis is driven by the GSAP ticker (`gsap.ticker.add(t => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`), and Lenis scroll events call `ScrollTrigger.update`. R3F reads the same scroll numbers through a mutable `sceneBus` object and does not own a second clock.
4. **Pause rules.** The loop stops when the tab is hidden, when the canvas is off screen (observed with `IntersectionObserver`), when `frameloop` is set to `never` in K10, and when the visitor pressed `Pause motion`.

### 4.8 How it changes state as you scroll (the story in one paragraph)

At the top, the field is an oblique constellation of facts with threads drawing to a column of resume lines, and one invented line is refused. Scrolling parts the headline and completes the threads. In the problem section, the field dims and four lines lose their threads: the failures people report. The first method beat re-confirms the facts, the second filters jobs through a gate with reasons, and the third flattens the whole field into a legible diagram where every line visibly cites facts. The Lock Bench keeps the diagram flat and lets the visitor attack it. The second method group collapses the lines into an application slip, offers a lime latch that only the visitor can move, sends the slip through a window, and prints a receipt whose rows point back to the facts. The field then fades away for the money section, where only flat DOM is used, and returns at the close in the oblique pose, finished.

---

## 5. Signature interactions

Five interactions. Each has a pointer, keyboard, touch and reduced-motion description.

### 5.1 Cite-trace (the keystone)

**Trigger.** Hover, focus or tap on any of: a draft line, a cite chip, a fact node's DOM button, a fact list item, or the word "fact," in the hero H1.

**Behavior.** The relation is bidirectional.

| From | Result |
| --- | --- |
| A line | Its threads rise to 2px and Phosphor White 90% (160ms `--ease-settle`). Cited facts scale 1 → 1.5 (180ms). All other threads fall to 15% alpha. The chip text expands from `cites #12` to `cites fact #12: Built an invoice retry service during the internship` |
| A fact | Every line that cites it lights; the others dim. A caption in the stage corner reads "Used by 3 lines" (tabular numerals, updated in a polite live region on focus) |
| Pointer leaves or focus moves | Reverse in 160ms |

**Reach thread (pointer-only, fine pointers).** Inside the stage region only, a 1px Moss 70 hairline follows from the nearest fact node to the pointer, length capped at 160px, fading with distance. It is the cursor motif and does not replace the system cursor. It is drawn in the scene (a single line segment), not in DOM, and is absent on touch devices and under reduced motion.

**Keyboard.** Draft lines and fact buttons are two roving-tabindex groups. Arrow keys move within a group, Tab moves between groups, Escape clears the trace, Enter pins it. Focus ring: 2px Phosphor White outline, 2px offset.

**Touch.** Tap toggles a pinned trace; tapping empty space clears it. Targets are at least 44px for lines and 28px for node buttons (WCAG 2.2 target size minimum is 24px).

**Reduced motion.** Threads change color and width instantly; no scale, no draw.

**Why it works.** It is the product explained by touching it, with no copy.

### 5.2 The Lock Bench

**Trigger.** The visitor types or picks a claim and presses "Check line" (or Enter in the input).

**Sequence (accepted line).**

| t (ms) | Event |
| --- | --- |
| 0 | Button label becomes "Checking" for 120ms (static text, no spinner) |
| 120 | A new bar slides into slot 10 of the draft column (240ms, `--ease-settle`) |
| 360 | A thread draws from each matched fact to the bar (480ms, 60ms stagger when two facts). Matched nodes scale to 1.5 for 360ms |
| 840 | The cite chip appears: `cites #12, #08`. The result region updates: "Accepted. This line cites fact #12 and fact #08." |

**Sequence (refused line).**

| t (ms) | Event |
| --- | --- |
| 0 | "Checking" for 120ms |
| 120 | The bar enters slot 10 (200ms) |
| 320 | A thread leaves the field toward the bar for 360ms and stops at the lock plate (brackets `[ ]` close over it) |
| 680 | The thread retracts in 160ms with `--ease-snap`. The bar is not connected |
| 840 | The line's letters fall out of the column: each character `translateY 0 → 14px`, opacity 1 → 0, 18ms stagger, 320ms (GSAP SplitText on this one short string only, `aria-hidden` on the split spans; the original text is kept in `aria-label` on the parent) |
| 1160 | The result region updates and a `Rejected` badge (`--bad` word, 1px border) shows. The bar is removed. Nothing remains in the draft |

**Matching rule (demo only).** Tokenise the claim; lowercase; drop a fixed stopword list; apply a light stem (`ing`, `ed`, `s`). Each remaining token that is a technology, an employer, a number or a proper noun must appear in at least one of the 24 sample facts, otherwise the claim is refused and the first unmatched token is named in the reason. Tokens that are plain verbs do not decide the result. The facts carry keyword lists. Accepted claims cite every fact that contributed a matched token, up to three. The matching table for the four presets is fixed so the demo is deterministic for them:

| Preset | Result | Cited |
| --- | --- | --- |
| Built an invoice retry service in TypeScript | Accepted | #12, #08 |
| Led a capstone team of three | Accepted | #15 |
| Led a migration to Kafka | Refused: "Kafka" not in any fact. Mentions RabbitMQ (#14) | none |
| Cut failed charges by 40% | Refused: no fact has a figure like 40% | none |

The reason text for a free-form refusal is: "Refused. No fact in this sample mentions {token}. Nothing was added."

**Keyboard.** Native `<form>`. Enter submits. The result region is `role="status"` with `aria-live="polite"`. Preset chips are buttons that fill the input and submit. The Rejected badge carries the word, never color alone.

**Touch.** Input at least 44px tall, font-size 16px so iOS does not zoom.

**Reduced motion.** No slide, no draw, no falling letters: the bar appears with its chip or does not appear, and the result text updates. The information content is identical.

**Honesty guard.** The demo note sits beside the input at all times, and the sample is labelled. The refusal copy says "in this sample", never "Kairos knows this is false".

### 5.3 The Fit Bar

**Trigger.** A native `<input type="range" min="40" max="95" step="5" value="70">` in beat 03.2 with a visible label "Fit bar (sample)" and a value read-out.

**Behavior.** The gate separates jobs in two stages, mirroring the documented order: hard rules first, then the model score with written reasons. The 11 hard-rule drops are fixed (4 seniority, 4 sponsorship, 2 location, 1 company cap) and never move. The 37 remaining sample jobs carry scores `[94, 92, 91, 89, 88, 86, 85, 84, 82, 81, 80, 78, 77, 76, 75, 73, 72, 71, 70, 68, 67, 66, 64, 63, 61, 60, 58, 57, 55, 54, 52, 51, 49, 47, 45, 42, 40]`. Moving the bar sends jobs under it to the lower-right lane in a cascade ordered by score, 320ms each with 12ms stagger.

| Fit bar | Kept | Below the bar | Hard rules (fixed) |
| --- | --- | --- | --- |
| 40 | 37 | 0 | 11 |
| 45 | 35 | 2 | 11 |
| 50 | 32 | 5 | 11 |
| 55 | 29 | 8 | 11 |
| 60 | 26 | 11 | 11 |
| 65 | 22 | 15 | 11 |
| 70 (initial) | 19 | 18 | 11 |
| 75 | 15 | 22 | 11 |
| 80 | 11 | 26 | 11 |
| 85 | 7 | 30 | 11 |
| 90 | 3 | 34 | 11 |
| 95 | 0 | 37 | 11 |

The initial value of 70 is a demo setting, not a product default. The page never says 75 or any default (the facts sheet found no source for 75).

**Read-out.** Visible text: "48 sample postings. 11 dropped by a hard rule. 18 below your bar of 70. 19 kept." Tabular numerals. The range input has `aria-valuetext="Bar 70: 19 kept, 18 below the bar, 11 dropped by a hard rule"`. A polite live region repeats the sentence after the visitor stops moving the control for 600ms.

**Reasons.** A list under the read-out shows three written reasons for the item the visitor last focused (the lanes are also keyboard-reachable). Sample reasons: "Three years of TypeScript, which the role asks for first." / "Posting says it does not sponsor visas. Dropped by a hard rule." / "Title is more senior than you asked for. Dropped by a hard rule." / "Asks for Kafka; your facts mention RabbitMQ only." The third phrase is the PRD wording; the others follow the same register.

**Pointer drag (enhancement).** The visitor can also drag a horizontal fit line across the scene lanes; it writes to the same range value. Without a fine pointer, only the range input is used.

**Reduced motion.** Lane changes are instant.

### 5.4 The approval latch and the ghost path

**Trigger.** The DOM button "Approve this application (sample)" or the latch in the scene (Space or Enter when focused; the scene latch has a DOM hit area equal to the button).

**Behavior.** Press: knob slides along the 56px track in 240ms `--ease-inout`. The slip's status word changes `Needs review` → `Approved`. The slip is now "armed" and the send animation in beat 05.2 plays at its natural scroll position.

**The story refuses to proceed without approval.** If the visitor reaches beat 05.2 without approving, the slip stays at center and the send path draws as a dashed hairline ghost (dashed means not real yet), with a status line: "Nothing leaves until you approve it. This is the path it would take." Beat 05.3's receipt reads "No receipt yet. Nothing was sent." with a Default button "Approve the sample". This demonstrates the product rule inside the page, without trapping the visitor, because the full animation is still visible as a ghost and the button is one press away.

**Lime.** The knob is the lime holder (2.2). It is a flat square fill. It has no glow. When the baton leaves it, it fades to Phosphor White over 300ms.

**Reduced motion.** The knob jumps to the end; the slip state changes; the ghost path is a static dashed line.

**Why it matters.** The most important promise of the product (nothing is sent until you approve it) is made as an experience: the visitor controls the one lime thing on the page.

### 5.5 The Receipt Calculator

**Purpose.** Cerebrium's "Transparent Pricing" calculator was the research benchmark. Ours is built only from `docs/pricing.md` arithmetic, with no network call, and renders as a printed slip.

**Controls (left, native inputs).**

| Control | Type | Values | Rule |
| --- | --- | --- | --- |
| Plan | Radio group, button style | Free, Starter, Pro, Max | Default Pro |
| Billing | Radio group | Weekly, Monthly, Quarterly | Disabled for Free with the reason in helper text |
| Applications that submit | `<input type="range">` plus `<input type="number">` kept in sync | 0 to the plan's credits for the period | Default: half the credits |
| Applications that fail | `<input type="number">` | 0 to 99 | Default 3 |

**Credits per period (PRC).**

| Plan | Weekly | Monthly | Quarterly | Price weekly | Price monthly | Price quarterly |
| --- | --- | --- | --- | --- | --- | --- |
| Free | n/a | 25 once | n/a | $0 | $0 | n/a |
| Starter | 94 | 400 | 1,200 | $6 | $19 | $45 |
| Pro | 280 | 1,200 | 3,600 | $12 | $39 | $95 |
| Max | 700 | 3,000 | 9,000 | $25 | $79 | $189 |

**The slip (right, DOM).** Carbon Veil fill, 8px radius, a serrated top and bottom edge drawn with a CSS mask (`radial-gradient` teeth, 8px), 32px padding, dashed top rule. Rows in 14px Inter with tabular numerals:

| Row | Example value (Pro, monthly, 600 submitted, 3 failed) |
| --- | --- |
| Plan and period | Pro, monthly |
| Plan price | $39.00 |
| Credits included | 1,200 |
| Submitted applications | 600 × 1 credit |
| Failed submits | 3 × 0 credits |
| Credits used | 600 |
| Charged for failures | $0.00 |
| Price per submitted application at this usage | $0.065 |
| Price per application at full use | $0.033 |

Math: price per submitted application at your usage = `Math.round(priceDollars * 1000 / submitted) / 1000`; at full use = the same with `credits`. Integer math on thousandths avoids float rounding (for example 45000/1200 = 37.5 rounds to 38, giving $0.038). If `submitted` is 0 the row reads "No submitted applications. You still pay the plan price." Plan price and credits are never hidden.

Footer lines on the slip: "Launch prices. They may change for new customers. [12]" and "Sample usage. Your numbers will differ."

**Print animation.** On first view the rows type in top to bottom, 60ms stagger, 240ms each (opacity and `translateY 6px → 0`). On input change, only changed numbers update, as an odometer: each digit in a fixed-height column moves by `translateY` in 360ms `--ease-settle`. The odometer columns are `aria-hidden`; one visually hidden text node holds the final value; a polite live region announces "Pro, monthly: 600 submitted, $0.065 per submitted application" 600ms after the last change.

**Reduced motion.** Values change instantly; rows render at once.

**Why it earns trust.** It shows the weak case (low usage means a higher price per application) next to the best case, which no competitor reviewed does.

---

## 6. The signature motif system: the Cite Thread

The motif is a system, not a decoration. Every element below has a meaning and a rule.

### 6.1 Components

| Component | Definition | Meaning | Where |
| --- | --- | --- | --- |
| **Fact numeral** | `#NN`, tabular, Inter 12px weight 500, Moss 70 | An id that something can cite | Chips, rail, section captions, lists |
| **Cite chip** | 1px Circuit Border pill, 4px 12px padding, Moss 70 text `cites #12`; expands to `cites fact #12: {text}` on trace | A line has a source | Draft lines, hero, receipt rows |
| **Thread** | 1px Moss 70 at 60% alpha; active 2px Phosphor White at 90%; quadratic Bézier, control offset 45% of horizontal distance, ±0.4 unit vertical | A relationship: this uses that | Scene and DOM SVG overlays |
| **Notch** | A 12px opening in a 1px divider, 4px square Phosphor White "fact dot" in the opening | The kairos moment: the line opens where the thread passes | Every section divider, the navbar border, table row rules |
| **Ledger numeral** | `#01` to `#09`, `#03.1` style sub-ids | Everything on the page is an entry | Section captions, rail |
| **Dashed border** | 1px dashed Circuit Border | Sample data or not yet real. Never used for real data | Sample chips, ghost path, demo note, empty states |
| **Page footnote** | `[n]` after a claim, link to a footnote at the section end | The page cites its own claims | Every `data-claim` |
| **Reach thread** | Hairline from nearest node to pointer | The field reaches for you | Stage only, fine pointers |
| **Slip** | Rectangle with serrated edge | An application or a receipt | Scene K7 to K9, calculator |

### 6.2 Typography

Display and headings carry the motif through the line-mask reveal (a line "rises through" a gate) and, in the hero only, through one attached cite chip. Body copy never carries decorative marks. Cite numerals and captions are Inter with `font-variant-numeric: tabular-nums` so ids stay aligned. Footnote markers are Inter 12px, superscript-aligned with `vertical-align: 0.35em`, in `--label` Moss 70 (10.3:1 on Void), 24px minimum hit area via padding.

### 6.3 Numerals

Tabular everywhere numbers sit in a column or change: the rail, the calculator, the fit read-out, the receipt, the counters. Large numerals (prices) use Inter Tight 400 at Heading XL scale. Ids are always two digits (`#01`). Counters use `Math.round` and never show decimals except in prices.

### 6.4 Dividers and transitions

Every section top border is a Phosphor Blue-Black hairline with one notch aligned to the left column edge plus 8.333% of the container (the start of column 2). On entering the viewport (`IntersectionObserver`, threshold 0.15) the hairline draws outward from the notch in both directions, `scaleX 0 → 1`, 600ms `--ease-settle`, once. The thread from the section caption passes through the notch into the section. This is the section-to-section transition: a line opens, then content enters. There are no cross-fades between sections and no page-level transitions.

Anchor travel (rail, skip links, CTA "See how it works"): `lenis.scrollTo(target, { duration: 1.1, easing: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2 })`. During travel the rail's progress hairline draws in step.

Route navigation (to `/pricing`, `/how-it-works`): a 240ms opacity cross-fade using the browser default, because the signed-in-app-style shared pages keep utility-only motion. A View Transition enhancement (`<ViewTransition>` in React 19.2 or the CSS View Transition API) is possible, but its Next.js 16 flag and behavior are not verified locally (no node_modules), so verify at nextjs.org/docs before use. If unavailable, nothing is lost.

### 6.5 Cursor

The system cursor is never replaced. Interactive elements use `cursor: pointer`. The only pointer-linked effect is the stage-only reach thread (5.1). Touch devices have none.

### 6.6 Micro-labels

All micro-labels are caption style (12px, +0.6px, uppercase) and begin with a ledger numeral: `#03.2  SET THE FIT BAR`. Sample content carries a dashed chip reading `Sample`. Demo content carries a dashed chip reading `Demo`. There is no label that is only a color.

### 6.7 Brand idea: kairos

The Greek idea (the right moment, not clock time) is expressed in three places and never more: the approve beat ("Kairos is Greek for the right moment. You choose it."), the notch (the opening in the line), and the footer time line. It is not used as a decorative stand-in for chronology.

---

## 7. Typography moves

### 7.1 Faces and settings

Inter Tight for display and headings (weights 400 and 500, `ss01` on headings), Inter for body and UI (400 and 500, `cv11`), per the brief. Landing-only: the code inventory found the app loads Inter at weight 400 only and has a global rule forcing h1 to h4 to weight 400; both must change as part of the `globals.css` migration (brief open item 2). Loaded with `next/font` only; preload the 400 file for Inter Tight and Inter, and lazy-load the 500 files.

### 7.2 Scale on the landing

| Role | Size | Line height | Tracking | Use |
| --- | --- | --- | --- | --- |
| Display XL | `clamp(56px, 35.2px + 6.4vw, 152px)` | 0.92 | −0.03em | Hero H1 only |
| Heading XL | `clamp(40px, 25.6px + 3.2vw, 72px)` | 1.0 | −0.025em | `#02` to `#09` H2s |
| Heading | 30px (24px mobile) | 1.2 | −0.36px | Beat titles, sub-intros |
| Lead | 20px | 1.5 | −0.36px | Hero subhead |
| Body | 16px | 1.5 | −0.352px | Paragraphs, 65ch max |
| Small | 14px | 1.43 | −0.364px | Microcopy, calculator rows |
| Caption | 12px | 1.33 | +0.6px, uppercase | Section labels, chips |

Resolved sizes: at 390px wide the hero H1 is about 60px; at 1280px about 117px; at 1440px about 127px; capped at 152px from about 1800px. Display XL "no line." at 60px is about 235px wide, which fits a 358px mobile column.

### 7.3 Kinetic behaviors (and the one rule behind them)

Rule: type moves only to show cause. The words stay in the HTML as whole text; there is no letter splitting of headings (SEO, screen readers and Reduce Motion all depend on it). Only the refused claim string in the Lock Bench is split into characters, because it is short and the falling letters are the point.

| Behavior | Where | Mechanism | Timing |
| --- | --- | --- | --- |
| Line rise | Hero H1 and every H2 | Per-line `overflow: hidden` wrapper, inner `translateY(105%) → 0` | 700ms `--ease-settle`, 70ms stagger |
| Attached cite chip | Hero H1 only | SVG thread from the comma of "fact," to a chip, then on to the scene | 480ms then 700ms |
| Headline parting | Hero scroll-out | Scroll-scrubbed `translateY` of the two lines, `−8vh` and `−2vh`, and opacity 1 → 0 from 40vh to 90vh | scrub |
| Confirmation tint | Each H2 | Color from Sage 60 to Phosphor White as the heading crosses viewport center, over a 40vh scroll window | scrub |
| Falling letters | Lock Bench refusal | GSAP SplitText (free in GSAP 3.13 and later; confirm the licence text when installing), `translateY 0 → 14px`, opacity 1 → 0 | 18ms stagger, 320ms |
| Odometer | Calculator values | Fixed-height digit columns, `translateY` | 360ms `--ease-settle` |
| Counter | `#03.1` facts confirmed | Text content `Math.round(p * 24)` | scrub |

Not used, with reasons: weight animation (changes advance widths and reflows lines, which would shift layout and break the 400/500 discipline), animated letter-spacing (reflow), per-letter reveal on headings (accessibility and crawlability), marquee text (loops).

### 7.4 Text and canvas cooperation

Composition keeps every node out of the text column. Where a thread crosses text (the hero chip thread and the beat 03.3 cite lines), the thread passes behind the type at 60% alpha with a 4px Void knockout under glyph boxes, so contrast is never worse than text on Void.

---

## 8. Mobile, reduced motion and low-end devices

### 8.1 Mobile story (below 1024px)

The mobile page is its own composition, as the Lando Norris jury notes suggest, not the desktop canvas scaled down.

1. **No pins and no scroll hijack.** Native scroll everywhere. Lenis is off below 1024px (`syncTouch: false` is the default and native momentum is kept; Lenis is only created on `(hover: hover) and (pointer: fine)`).
2. **Docked stage band.** The canvas is `position: fixed` and sized `width: 100vw; height: var(--stage-h-mobile)` (`clamp(220px, 34svh, 340px)`), docked below the 64px navbar. In sections `#01` to `#05` it is visible; in `#06` to `#08` it slides up out of view (`translateY(-100%)`, 300ms) and the loop stops; at `#09` it returns. Because the band is opaque Void with the field drawn inside it, text scrolls beneath it and the effect is a sticky visual with scrolling text.
3. **Hero order.** Visual order: navbar, stage band, eyebrow, H1, subhead, CTA. DOM order: navbar, eyebrow, H1, subhead, CTA, stage. This keeps the H1 first for LCP and screen readers. On phones shorter than 740px the band is capped at 30svh so the CTA is still above the fold.
4. **Beat changes are discrete, not scrubbed.** Each beat block uses an `IntersectionObserver` (threshold 0.5) to set the scene key; the scene tweens between keys in 600ms. Scrubbing a docked band under a moving thumb is noisy and costs battery.
5. **Fewer elements.** T1 composition: 24 facts, 24 jobs, 9 bars, up to 24 threads. Nodes are 8px so targets can reach 44px through padding on the DOM buttons.
6. **Lock Bench on mobile.** The input is 16px text and 48px tall. The 24 facts are shown as a list of buttons under the band rather than as overlays on nodes (the band is too small for 24 labelled targets). Tapping a fact highlights its node.
7. **Fit Bar.** The range input spans full width with a 44px thumb target. Lane reasons show as a short list.
8. **Receipt Calculator.** Controls stack above the slip; the slip is full width.
9. **Pricing.** Plans stack in one column in the order Free, Starter, Pro, Max.
10. **Ledger rail** is hidden; the section caption (with its `#NN`) in each section is the only orientation, plus the Skip links.
11. **Gutters** 16px at 375, 24px at 768, 32px at 1024 and up, per the brief.

### 8.2 Reduced-motion story

Triggered by `prefers-reduced-motion: reduce`, the footer `Motion: Reduced` setting, `Save-Data`, or `Pause motion`. The page stays complete and still. The rule: reduced motion changes how things move, never what the page says.

| Area | Under reduced motion |
| --- | --- |
| Hero | H1, subhead and CTAs are visible immediately. No line rise. The chip and its thread are static. The stage shows the T0 SVG diagram, with the refused line drawn once as a broken thread |
| Smooth scroll | Lenis is not created (or `respectReducedMotion` leaves it off). Anchor links jump |
| Scene | T0: six inline SVG diagrams, one per key beat: Field (K0/K11), Failure (K2), Facts (K3), Gate (K4), Lock (K5/K6), Send and receipt (K7 to K9). Swapped by section with no animation (the `<picture>` slot changes `hidden` attributes instantly) |
| Threads | Drawn complete; no draw animation |
| Section dividers | Drawn complete; no outward draw |
| Lock Bench | Same logic, instant outcome: SVG shows or hides the added bar and the thread, result text updates |
| Fit Bar | Instant lane changes |
| Latch | Instant move |
| Receipt Calculator | Instant values, rows rendered at once |
| FAQ | Opens with no height animation |
| Headings | No line rise, no confirmation tint scrub (final color applied) |
| Footer time | Updates still occur (it is text, not motion) |

The five T0 SVGs are authored (not exported screenshots), around 6 to 10KB each, with `<title>` and `<desc>` text and no inline raster. They are also the first-paint poster for all users and the fallback when WebGL is unavailable. Under `data-motion="reduced"` the canvas is never loaded, which removes the Three.js chunk for those users.

Meeting WCAG: SC 2.2.2 (no auto-playing motion over 5s without pause: the page has none, and `Pause motion` exists anyway), SC 2.3.3 (the footer toggle is a site-wide setting), SC 2.5.8 (target size), SC 2.4.11 (focus not obscured: the navbar is 64px and `scroll-padding-top: 80px` is set).

### 8.3 Low-end device story

Tiers come from the research playbook, with this page's specifics.

| Tier | Condition | Experience |
| --- | --- | --- |
| **T0 Static** | No WebGL2; or reduced motion; or `Save-Data: on`; or `webglcontextlost` (not retried more than once); or two PerformanceMonitor declines at T1; or the visitor chose Reduced | Inline SVG diagrams as above. All text, forms, calculator and Lock Bench work |
| **T1 Light** | Touch device; or `navigator.hardwareConcurrency <= 4`; or `navigator.deviceMemory <= 4`; or one PerformanceMonitor decline at T2 | WebGL, `dpr` capped at 1.25, no halos, 24 jobs, up to 24 threads, no dither, no reach thread, discrete beat changes |
| **T2 Full** | Fine pointer, hardware concurrency above 4, and the first 40 frames after canvas ready have a median frame time under 18ms | WebGL, `dpr` up to 2 (adaptive 1.5 to 2 with `PerformanceMonitor`), halos, 48 jobs, pointer parallax, reach thread |

Detection steps: (1) pre-WebGL checks (`prefers-reduced-motion`, `Save-Data`, `data-motion`), (2) create a WebGL2 context probe, (3) choose the starting tier from the table, (4) after ready, measure 40 frames and demote one tier if the median frame time exceeds 22ms, (5) demote again if two `onDecline` events fire in 4 seconds. No external GPU-detection package (the `detect-gpu` library fetches a benchmark file from a CDN, which adds a third-party request and a privacy surface).

Further low-end rules: the canvas chunk loads only after the hero text has painted and the browser is idle; it is never preloaded on `Save-Data` or on `effectiveType` 2g or 3g where exposed; the render loop pauses when the tab is hidden or the canvas is off screen; there are no textures to decode, so memory stays small; context loss shows the T0 SVG for the current beat.

Motion control surfaces: the hero stage has `Pause motion` and `Reduce motion` buttons (44px targets); the footer has `Motion: Full / Reduced`. All call one function `setMotion(mode)`, which sets `data-motion` on `<html>`, writes `localStorage` in try/catch, and stops or starts the scene.

---

## 9. Performance and architecture

### 9.1 File and island plan (Next.js 16.4 App Router)

All files under `web/`. Reuse and fork decisions follow the code inventory.

| File | Kind | Notes |
| --- | --- | --- |
| `app/(public)/page.tsx` | Server Component | Composes sections; no client code except islands |
| `components/landing/hero.tsx` | Server | Replaces the current hero. Contains the SVG poster slot and H1 markup with CSS animations |
| `components/landing/problem.tsx` | Server | Ledger rows |
| `components/landing/method-a.tsx`, `method-b.tsx` | Server | Beat blocks (text), with data attributes `data-beat="03.2"` for the observer |
| `components/landing/lock-bench.tsx` | Client island | Form, matching function, result region |
| `components/landing/fit-bar.tsx` | Client island | Range input, read-out, reasons |
| `components/landing/approve-latch.tsx` | Client island | DOM twin of the latch |
| `components/landing/billing.tsx` | Server wrapper | Wraps the reused `components/shared/pricing-plans.tsx` |
| `components/landing/receipt-calculator.tsx` | Client island | Pure function plus UI |
| `components/landing/comparison.tsx` | Server (fork) | Real `<table>` |
| `components/landing/landing-faq.tsx` | Server (reuse, copy fixed) | Uses `components/shared/faq-list.tsx` |
| `components/shared/cta-band.tsx` | Reuse | Accepts `data-lime-slot="closingCta"` |
| `components/landing/stage/scroll-provider.tsx` | Client island | Lenis + GSAP wiring; created only when motion is allowed and the device has a fine pointer |
| `components/landing/stage/stage-client.tsx` | Client wrapper | Does `next/dynamic(() => import("./fact-field"), { ssr: false })`. `ssr: false` is only allowed inside a Client Component |
| `components/landing/stage/fact-field.tsx` | Client, lazy | The R3F scene |
| `components/landing/stage/scene-bus.ts` | Module | Mutable state shared by scroll code, DOM islands and the scene |
| `components/landing/stage/diagrams/*.tsx` | Server | The five T0 SVG diagrams |
| `components/landing/lime-baton.tsx` | Client island | 40 lines |
| `components/landing/footer-extras.tsx` | Client islands (time, motion toggle) and server (page receipt) | Page receipt computed at build |
| `lib/landing/facts.ts`, `jobs.ts`, `claims.ts` | Data | Sample facts, sample jobs, claim and footnote register |

Libraries (verify exact current versions on npm and against React 19.3 and Next 16.4 peer ranges when installing, because node_modules is not installed locally): `three`, `@react-three/fiber` v9 line (React 19 compatible), `gsap` (ScrollTrigger and SplitText plugins), `lenis`. No `@react-three/drei` and no postprocessing library; the few helpers needed are written in-file. No animation library other than GSAP for DOM.

The `cacheComponents` setting and `LayoutProps<"/">` typing noted in the code inventory still apply. Next.js 16 has breaking changes versus older versions; confirm every API (`next/dynamic`, `next/font`, route typing) against nextjs.org/docs at implementation time.

### 9.2 Loading sequence and budgets

| Phase | What loads | Budget |
| --- | --- | --- |
| HTML | All copy, nav, hero, T0 SVG poster, inline critical CSS | HTML under 80KB gzipped |
| Fonts | Inter Tight 400 and Inter 400 preloaded, `font-display: swap`, size-adjust fallback to remove shift | Two files, about 45KB total |
| First JS | React and the three small islands that hydrate on interaction | Under 110KB gzipped before the canvas |
| Idle | Scroll provider and canvas chunk (three core, R3F, field, GSAP + ScrollTrigger, Lenis) | Canvas chunk under 280KB gzipped |
| After ready | Canvas cross-fades in over the poster in 600ms | No layout shift (the stage slot has fixed dimensions) |
| Always | No images in the landing hero; no video; no GLTF; no textures | Total page weight under 1.2MB, well under the 3MB award-site figure |

Internal targets (Reported figures from award writeups, adopted as goals, not guarantees; the official good thresholds are looser at LCP 2.5s, INP 200ms, CLS 0.1): LCP at most 1.5s on a mid-range phone on 4G, CLS at most 0.02, INP at most 100ms, sustained 60fps on T2 and 30fps or better on T1, main-thread work per frame under 6ms.

The H1 is the LCP element: it is server-rendered text, animated with a clipped `transform` (not `opacity: 0`, because Chromium LCP ignores elements with `opacity: 0`), and the full-viewport canvas never becomes the LCP candidate because it is faded in after the text has painted.

### 9.3 Scroll code rules (from the 3D-scroll skill, applied)

1. One RAF clock (the GSAP ticker). No second RAF loop.
2. Passive scroll listeners where native listeners are used.
3. Hot updates (canvas uniforms, overlay label transforms, odometers) write through refs, never React state. React state only for discrete results (Lock Bench outcome, plan choice, fit bar value).
4. Overlay labels (fact numerals, chips) are DOM nodes whose `transform` is updated from projected node positions inside the same RAF; layout reads are batched before writes.
5. Layout reads for DOM-aligned threads (beat 03.3) happen on mount, resize (debounced to 150ms), font load and `ScrollTrigger.refresh`, not per frame.
6. ScrollTrigger is used without pins. The only scroll-linked work is `scrub` values written to `sceneBus`. This removes pin spacer layout shifts.

### 9.4 Testing and verification plan

| Check | Tool | Pass criterion |
| --- | --- | --- |
| Lime count | Playwright, 40 scroll positions on desktop and mobile | Never more than one element with the accent fill; latch pixel box counts as one and excludes the navbar CTA at that moment |
| Palette lock | Playwright screenshot histogram | No non-black pixel outside the sage family except in the latch box |
| Em dash lint | grep in CI | Zero U+2014 or U+2013 in landing files |
| Footnote integrity | Unit test on `claims.ts` and rendered DOM | Every `[data-claim]` has a footnote target; page receipt numbers match |
| Accessibility | axe-core in Playwright; manual NVDA and VoiceOver passes; keyboard-only walkthrough of every interaction | Zero critical axe issues; all five interactions complete by keyboard |
| Reduced motion | Playwright with `reducedMotion: "reduce"` | No canvas request is made; T0 diagrams render; page content parity |
| Performance | Lighthouse CI and WebPageTest on a throttled mid-range Android | Budgets in 9.2 |
| Frame time | `PerformanceObserver` long-frame logging in a dev overlay | Median under 18ms at T2, under 33ms at T1 |
| Context loss | Force `WEBGL_lose_context` | T0 diagram appears; no retry loop |
| Hydration | Production build (`next build && next start`) | No hydration warnings; the footer time line is client-added |

### 9.5 Risk register

| # | Risk | Likelihood | Impact | How it is retired |
| --- | --- | --- | --- | --- |
| R1 | Lime baton fails and two lime elements show together, violating a locked rule | Medium | High | Server-rendered default (`data-lime="heroCta"`), Playwright lime-count test at 40 positions, a CSS fallback where all slots are non-lime unless `data-lime` matches. Scene latch lime is gated on the same attribute |
| R2 | The Lock Bench is read as Kairos "detecting lies" | Medium | High | Demo chip, note beside the input, "in this sample" wording, deterministic presets, footnote [5] stating the real rule. Legal and product review of the exact strings before ship |
| R3 | Extension, cloud applier, receipts or reply tracking copy describes features whose build status is not stated (facts sheet 6.1) | High | High | Claims register (section 12) marks each; launch gate: confirm in the repo or switch beats 05.2 and 05.3 to "In the beta" wording. The scene needs no change because it shows the designed flow, labelled Sample |
| R4 | Scroll performance on mid-range phones (WebGL behind scrolling text) | Medium | High | Docked band with discrete beat changes, T1 limits, `frameloop="demand"`, adaptive DPR, device lab testing before launch, automatic demotion to T0 |
| R5 | LCP regression from fonts, canvas or animation | Medium | High | Text-first HTML, clipped transform animation, SVG poster, canvas after idle, Lighthouse CI budget |
| R6 | Accessibility regression (the weakest award criterion for winners; mean developer score 6.90 in the research sample) | Medium | High | Canvas `aria-hidden`; every interaction has DOM controls; skip links; roving tabindex; live regions; tested with real screen readers; footer motion toggle |
| R7 | Visual overlap with Modal or Lando Norris (lime on near-black) | Medium | Medium | Differentiation by form (threads, notches, dashed samples, slips, lime only at decisions), side-by-side review against those two sites before sign-off |
| R8 | Three or R3F peer-dependency break with React 19.3 or Next 16.4 | Low to medium | Medium | Pin exact versions at install; CI smoke test of production build; fallback plan is plain `three` mounted in a `useEffect` (the scene is data-driven so the R3F layer is thin) |
| R9 | Scope: this is the heaviest concept (scene, five interactions, T0 diagrams, footnote system) | High | Medium | Staged build order in section 13: static page and T0 diagrams first, then DOM interactions, then WebGL. The page is a complete, shippable landing at each stage |
| R10 | Inter Tight does not carry Goga's forms (brief open item 3) | Medium | Low | The concept is built on size, tracking and color, so it does not depend on a specific display glyph shape; review in the first browser pass |
| R11 | Sample data mistaken for results | Medium | High | Dashed `Sample` chips on every sample surface, caption on the hero and Fit Bar, no outcome metrics anywhere |
| R12 | Logo not lime on the landing (decision for the product owner) | Certain | Low | Flagged in 2.3. If rejected, the logo becomes a baton participant (it would hold lime in every viewport, which would end the baton for the page) |
| R13 | Competitor comparison draws legal concern | Low | Medium | No names, no prices, wording is "what people report", closing sentence "We name no other product, and we do not compare prices here." |

---

## 10. The case for each Awwwards criterion

Awwwards weights: Design 40, Usability 30, Creativity 20, Content 10. In the 16 recent Site of the Day pages sampled in the research, overall scores ran 7.17 to 8.18; the weakest jury score was Usability (mean 7.40) and the weakest developer sub-score was Accessibility (mean 6.90, none above 7.60). The concept is built to win on the two criteria where winners are weakest. No award is promised; the targets are an overall jury score of 7.5 or more and the Developer Award (developer score above 7).

### 10.1 Design (40%)

| Argument | Evidence in the concept |
| --- | --- |
| A single, strict visual language | One palette, one motif (the thread), square geometry, hairline structure. Every element obeys the same rules, which is what keeps dense scroll stories coherent |
| Poster-scale typography with discipline | Display XL at up to 152px in two weights with size and color as the only hierarchy levers, line-mask reveals and one attached cite chip |
| A hero that is a diagram, not an illustration | The scene explains the mechanism; the depth in the oblique pose flattens into a legible diagram in the working beats (3D to 2D to 3D, the 2026 reference pattern) |
| Restraint | Lime appears once at a time. No glow on type. No idle motion. Calm is a design decision here, and it differentiates from neon AI sites |
| Craft details | Notched dividers, serrated slips, dashed samples, tabular numerals, odometer digits, reach thread, DOM-aligned thread endpoints |
| Original despite the shared palette | Distinct from Modal and from Lando Norris by form |

### 10.2 Usability (30%)

| Argument | Evidence |
| --- | --- |
| Native scroll, no hijack, no pins | The canvas is fixed and scroll-driven; text is ordinary document flow; keyboard PageDown, anchors and find-in-page all work |
| One obvious primary action | One lime element at a time, always the next best action. The CTA is reachable at every scroll position (the navbar holds it by default) |
| Every interactive demo has a base that works without a pointer | Native `<input>`, `<form>`, radios, `<details>`; pointer drag and 3D are enhancements |
| Honest, fast | Text paints first; the canvas is optional; T0, T1, T2 tiers; mobile gets its own composition |
| Orientation | `#NN` ledger numerals on every section, a rail on wide screens, skip links, footnotes next to claims |
| Accessibility as a visible feature | Pause and Reduce motion controls at the stage and in the footer, live regions, 24px+ targets, focus not obscured, real tables. Winners average 6.90 on developer accessibility; this is where the page can lead |
| Forms and feedback | Inline results, error text with a recovery path ("Refused. No fact in this sample mentions Kafka. Nothing was added."), labels not placeholders |

### 10.3 Creativity (20%)

| Idea | Why it is new |
| --- | --- |
| The page obeys its own product rule | Footnotes on every claim and a build-time page receipt turn "accountable" into a mechanism a visitor can inspect |
| The story refuses to send without approval | The ghost path and the empty receipt demonstrate the central promise as an experience, and the lime latch is the one lime object on screen |
| The Lock Bench | The visitor is invited to break the product's key rule, and the failure is staged as a letter-by-letter fall |
| Palette-locked shaders | The scene can emit only token colors; this is both a creative constraint and a guard against neon |
| Lime as a baton | Color as a pointer to the next decision, not as decoration |
| Sample data as a visual language | Dashes mean "not real yet", a rule the visitor learns in the first viewport and sees reused throughout |
| Motion that ends | In a field of looping tickers and marquees, a page that finishes its gestures reads as deliberate |

### 10.4 Content (10%)

| Argument | Evidence |
| --- | --- |
| Specific, grounded copy | Hard rules named, receipt contents named, credits and prices computed, caveats stated (LinkedIn, detection, paste-only, launch prices) |
| No fabricated proof | Zero testimonials, counts, logos, ratings, press or outcome numbers; the footer says so in a ledger line |
| Pricing as honest arithmetic | Per-application cost at full use and at the visitor's own usage, derived from `docs/pricing.md` |
| Sourced comparison without names | Reported complaints from users versus mechanisms, plus a plain statement that no other product is named |
| Consistent voice | Calm, exact, accountable; concrete verbs; no em dashes; no hype words |

### 10.5 Developer Award angle

Semantics and SEO: one H1, ordered headings, real tables, native details/summary, FAQ JSON-LD that mirrors visible text, `SoftwareApplication` structured data with offers that match the launch-price note and no rating. Animations: all driven by transform and opacity, `frameloop="demand"`. Accessibility: section 8.2 and the testing plan. WPO: budgets in 9.2. Responsive: separate mobile composition. Markup and metadata: landmarks, canonical, Open Graph image (1200 × 630, Void, "No fact, no line." in 64px Phosphor White, the thread motif, lime mark in one corner as the brief specifies).

---

## 11. What this concept deliberately does not do

1. No preloader screen or percentage counter. The poster is the loader.
2. No custom cursor replacement and no follower dot.
3. No marquee, ticker, rotating hero object or ambient loop.
4. No horizontal scroll hijack and no CSS or GSAP pins.
5. No logo wall, user count, rating, testimonial, press badge or competitor name.
6. No lime text, glow on type, gradient hero or neon.
7. No letter-split headings.
8. No claims about undetectability, interview rates, speed measurements or sponsorship guarantees.
9. No Workday, iCIMS, LinkedIn automation, Gmail access, mobile apps, INR pricing or WhatsApp in copy.

---

## 12. Claims register and open checks

Every `[data-claim]` on the page maps to a footnote and to a source. Statuses: **Documented** (stated in the product docs), **Arithmetic** (computed from documented numbers), **Gate** (must be confirmed before it ships as written).

| Footnote | Claim | Source | Status |
| --- | --- | --- | --- |
| [1] | People report auto-apply problems (jobs that do not fit, invented skills and metrics, no edit step, charges after leaving) | PRD "Problem", attributed to user reports; facts sheet 3.3 | Documented as reports; no tool named, no rate |
| [2] | Facts are split from pasted text and confirmed; unconfirmed facts are never used | APP first-use journey steps 1 to 3; PRD core features | Documented. Wording uses "Paste" (v1 is paste-only) |
| [3] | Hard rules run before any model; the rest get a score and reasons | PRD core features row 2; HIW step 02 | Documented |
| [4] | A save citing an unknown fact id is refused and nothing is stored; the edit screen lists the line | PRD AC6; APP "Edit draft" | Documented |
| [5] | The Lock Bench is a demo of the rule | This page | Demo label |
| [6] | Nothing is sent until you approve it; withdraw before send | PRD one-line idea; APP alternate journeys | Documented |
| [7] | Extension fills the employer's own form; Pro and Max can send with the browser closed; boards are Greenhouse, Lever, Ashby; LinkedIn is not automated | PRD core features; PRC; FAQ A1 | **Gate**: extension and cloud applier build status not stated (facts sheet 6.1) |
| [8] | A receipt saves each field sent, each answer, the resume version and the confirmation page; exists for submitted applications | L-PROOF point 3; PRD AC10 | **Gate**: check against the built receipt |
| [9] | Replies return through a forwarding address; no Gmail login | PRD core features row 6; FAQ A5 | **Gate**: reply tracking build status not stated |
| [10] | A forwarded email classified as an offer pauses billing | PRD AC12; PRC "Billing rules" | **Gate**: AC12 has no verification tag; depends on reply tracking |
| [11] | One credit per submitted application; failed submits cost nothing; duplicate reports charge once | PRD AC9, AC10; PRC | Documented, verified end to end |
| [12] | Plans, prices, allowances; launch prices may change for new customers; USD via Stripe | PRC "Plans", "Price research", "Billing rules" | Documented |
| [13] | Cost per application and weekly or quarterly grants | PRC "Weekly and quarterly math" | Arithmetic |
| [14] | 25 free applications at sign-up | PRD AC1; PRC | Documented |

Open checks before shipping copy:

1. Confirm whether "No card" is true for the free path. Until confirmed it is omitted everywhere (hero microcopy, closing band, FAQ).
2. Confirm build status for the Chrome extension, cloud applier, receipts and reply tracking. If any is not shipped at launch, switch beats 05.2 and 05.3 to "In the beta" wording and keep the designed-flow diagrams labelled Sample.
3. Confirm that "Most chosen" refers to Pro in the plan data, and adopt the neutral badge on the landing.
4. Read `shared/src/plans.ts` (the facts sheet did not) and make the plan-feature strings on the page match it.
5. Confirm the support email domain (PRD open question 1) and use `siteConfig.supportEmail`.
6. Legal pass on Terms, Privacy, Cookies, Refunds wording before linking them as live policy (PRD open question 5).
7. Product-owner decision on the Phosphor White logo on the landing (2.3) and the brief's provenance check (brief open item 1).
8. Confirm the GSAP SplitText licence terms and the current package versions at install time.

---

## 13. Suggested build order (each step is shippable)

1. **Tokens and type.** Migrate `globals.css` to the brief's tokens plus the landing-only extensions; load Inter Tight and Inter; remove the global h1 to h4 weight-400 rule; neutralize the hardcoded `#d8e61a` hover in `button.tsx`.
2. **Static landing.** Sections `#01` to `#09` in Server Components with all copy, the footnote system, the page receipt, the notch dividers, the comparison table, the FAQ, and the five T0 SVG diagrams. This is a complete, accessible landing page with no JavaScript animation.
3. **DOM interactions.** Lock Bench, Fit Bar (with T0 diagrams updating), Receipt Calculator, Cite-trace on SVG, lime baton, ledger rail, motion toggle.
4. **Kinetic type and reveals.** Line rise, confirmation tint, notch-draw, attached cite chip.
5. **Scroll provider.** Lenis and GSAP wiring behind the motion check.
6. **The Fact Field.** Scene bus, T1 first, then T2 upgrades (halos, parallax, reach thread), DOM-aligned thread overlays, tier detection and demotion.
7. **Polish and audit.** Lime-count and palette tests, axe, screen-reader passes, device lab, Lighthouse CI, OG image.
