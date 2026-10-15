# Concept: Kairos Moment, "The Locked Trace"

Date: 2026-10-15. Status: creative direction for review, not a build spec. Inputs: `docs/04-ui-ux-brief.md`, `docs/DESIGN.md`, `docs/01-prd.md`, `docs/pricing.md`, and the four research files under `_research/`. Every copy line below is either marked KEEP in `_research/facts.md` or built from a fact that sheet verifies. Sample data on the page is always labelled "Sample data". Skills applied: `anthropic-skills:3d-scroll-website` (sticky scroll engine, RAF and ticking discipline, preload rules), `ui-ux-pro-max` (accessibility and animation checklists), `motion-graphics` (its render pipeline does not apply; its motion principles, causal motion that ends, do).

---

## 1. Name and big idea

**Name:** The Locked Trace.

**Big idea:** Chronos is a free-running oscilloscope sweep: the feed rolls past all day, hundreds of postings smear into one band, and nothing is ever held. Kairos is a triggered capture: the trace arms on your rules, locks the instant one posting passes them, holds until you approve, and then stops as a receipt. The page is one instrument moving from free run to lock to hold, and every motion on it ends.

**Why only Kairos can own it.** The name is the metaphor: kairos is the opportune moment, chronos is clock time, and the product's three rules (fit gate, truth lock, approval before send) are literally an instrument's trigger condition, measurement cursors and single-shot capture. Competitors sell volume with feeds that tick forever (see `_research/competitor-landings.md`, section 3); a trace that locks and stops is the visual opposite. Modal's style reference supplies the phosphor palette, but Modal's identity is a rotating 3D object and a centred hero; this concept uses a flat 2D instrument, left-aligned ledger typography, graticule dividers and citation chips, so the hue is shared and the form is not. Lando Norris (lime on near-black) has no instrument, no ledger and no receipt.

---

## 2. Narrative arc

The page tells the life of one application in the order the product runs it: the feed, the gate, the citation, the approval, the send, the receipt, the reply. Then it shows what that costs and what it is not. A fixed ledger rail on the right edge (desktop only) numbers the beats and doubles as navigation.

### 2.1 Section order and scroll budget (desktop, 1440 by 900 reference)

| # | Section | Height | Instrument state | Visitor sees | Visitor feels | Visitor learns |
|---|---|---|---|---|---|---|
| 0 | Navbar | 64px fixed | n/a | Logo, four links, Login, "Start free" | Oriented in under 3 seconds | Where pricing and how it works are |
| 1 | Hero | 100vh | FREE RUN (calm) | Left: eyebrow, 2-line statement, subhead, two CTAs. Right: the instrument card, trace drifting slowly | Calm, exact; nothing is shouting | Fit first, facts only, nothing sent without approval, a receipt per submitted application |
| 2 | The problem: Chronos | 90vh | FREE RUN (dense) | The trace thickens into a band; large word pair "chronos" drifting and "kairos" locking; three attributed complaints | Recognised, not scolded | Hand applications take 15 to 30 minutes; people report mismatches, invented skills, no edit step, charges after leaving |
| 3 | How it works 01: Fit gate | 90vh | ARMED | A trigger level line appears on the trace; sample postings drop with written reasons as it rises | Control | Hard rules run first, then a scored fit with written reasons; drops never cost a model call |
| 4 | How it works 02: Truth lock | 90vh | TRIG'D (locked) | One stable waveform; measurement cursors drop onto it and each points at a resume line reading "cites fact #N" | Trust in what goes out under their name | Every line cites a confirmed fact; a line without one is refused on save and listed to fix |
| 5 | How it works 03: Review and approve | 90vh | HOLD | A sample review card with diff and answers; one Approve button (the viewport's lime); pressing it captures the trace | The one decision is theirs | Edit any field or line, approve one or a batch; nothing sends before this |
| 6 | How it works 04: Send and receipt | 90vh | STOP, then FLAT (hand-off to DOM) | The frozen trace flattens into a horizontal rule that becomes the top edge of a receipt card listing each field, answer, resume version, confirmation page | Accountability made physical | Extension fills the employer's own form in your browser; Pro and Max can send with the laptop closed; a receipt per submitted application |
| 7 | How it works 05: Replies | 70vh | FLAT with one blip (DOM SVG, canvas gone) | The flat rule gains a single mark; a forwarding address explanation | Relief: no Gmail login | Replies come to a private forwarding address you control; an offer email pauses billing |
| 8 | Honest billing and pricing | auto (about 160vh) | none | Receipt calculator, interval switch with odometer, four plan cards, billing rules, launch-price note | Nothing is hidden | Prices, allowances, cost per submitted application, failed submits cost nothing, pause on offer, weekly plans |
| 9 | Comparison with auto-apply | auto (about 90vh) | none | Two-column table: "What people report about auto-apply tools" versus "What Kairos does" | Fair, not snide | Six reported complaints and the mechanism that answers each |
| 10 | FAQ | auto | none | Five native `<details>` items | Doubts answered plainly | Boards supported, no undetectability claim, no invented experience, failed submits, no Gmail |
| 11 | Closing CTA | 70vh | Resting flat line (static SVG) and local clock | "Try it on 25 real applications." with the time where the visitor is | Ready | Start free; nothing sends without approval |
| 12 | Footer | auto | none | Ledger-style columns, Motion toggle, legal links | Finished, accounted for | Where terms, privacy, refunds live; how to reduce motion |

Total pinned story (sections 1 to 7): 100 + 5 by 90 + 70 = 620vh. Mobile cuts this to 100svh + 4 by 70svh (sections 3 and 4 merge, 6 and 7 merge) = 380svh; see section 7.

### 2.2 Beat-by-beat copy and layout

**Navbar (reuse `components/layout/navbar.tsx`, restyle).** Carbon Veil at 85% with 10px blur, 1px Phosphor Blue-Black bottom rule, 64px. Links: How it works, Pricing, Blog, About. Right: Login (ghost), "Start free". Lime custody rule (section 5.6): "Start free" renders as the Default button while the hero CTA or the sample Approve button is in view and becomes the lime pill otherwise.

**Hero.** Two-column grid at `lg` and up (7 by 5 of 12 columns, 48px gap); one column below `md`.

Left column (text present in server HTML, the LCP element):

- Eyebrow (caption, Moss 70): "For new grads, OPT and anyone between jobs"
- H1 (Inter Tight 400, see section 6): "Job applications you would sign."
- Subhead (Moss 80, 20px): "Kairos finds roles that fit, tailors your resume only from facts you confirmed, and sends nothing until you approve it. Every submitted application comes with a receipt."
- Primary CTA (lime pill): "Start with 25 free applications". Secondary (outlined): "See how it works" (anchors to section 3).
- Microcopy (Sage 60, 14px): "Credits are only used when an application actually goes through." The "No card" clause is dropped until the facts sheet confirms it.

Right column: the instrument card (section 3). Its readout reads FREE RUN with the plain words "Postings arrive all day. Most do not fit." A caption under the card: "Sample data. Illustrates how the fit gate, truth lock and approval work."

**The problem: Chronos.** Left column, three short blocks, each a 14px caption label and a 16px body:

- "15 to 30 minutes" / "Applying by hand takes 15 to 30 minutes per application, most of it retyping the same fields into the same forms."
- "People who tried auto-apply tools tell us about" / "matches that did not fit, resumes with skills they do not have, a review step with no edit step, and charges after they left."
- "One person's words" / "only about 1% of the jobs shown actually matched" (styled as a quotation with the attribution "a user describing another tool", per the PRD's attribution rule).

Right column: the instrument densifies to 12 drifting sweeps; the readout reads FREE RUN with "Hundreds of postings, none held." Above the instrument, the kinetic word pair (section 6.3): "chronos" drifts apart, "kairos" locks.

**How it works 01: Fit gate (ARMED).** Left: eyebrow "01 · Fit gate", H2 "A fit gate before anything else.", body (KEEP): "Role, seniority, location, salary floor, visa needs and your exclude list are hard rules. A job that breaks one is dropped before any model reads it, and the rest come with written reasons." Below: eight sample posting rows (Sample data) with a status word and a reason. Reason strings are the documented ones: "Title is more senior than you asked for", "Posting says it does not sponsor", "Second application to this company in 30 days", "Outside your locations". Right: the trigger level marker appears at the right edge of the instrument; interaction 4.1.

**How it works 02: Truth lock (TRIG'D).** Left: eyebrow "02 · Truth lock", H2 "Resumes that cannot make things up.", body: "Each tailored line has to cite facts you confirmed. A save that includes a line with no confirmed fact behind it is refused, and the edit screen lists that line for you to fix. Your own edits go through the same check." (Rewritten to the documented 422 behaviour.) Below: three sample resume lines, each with a chip "cites fact #7", "cites fact #12", "cites fact #3"; the fact text is sample and labelled. Right: cursors drop onto the locked trace; interaction 4.2.

**How it works 03: Review and approve (HOLD).** Left: eyebrow "03 · Review and approve", H2 "Four steps, and you stay in charge of each." is reserved for the steps summary; here the H2 is "You see every change before it leaves." Body (KEEP): "Each application shows its resume diff, every answer and why it matched. Edit anything, then approve one or a batch." Right: the instrument shrinks to 60% width and a sample review card sits beside it: a two-line diff, "7 answers ready · 0 guessed" (labelled sample), and one button "Approve" in lime. Interaction 4.3.

**How it works 04: Send and receipt (STOP, then FLAT).** Left: eyebrow "04 · Send and receipt", H2 "Proof for every application.", body (KEEP): "The extension fills the employer's own form in your browser and saves what it sent: each field, each answer, the resume version and the confirmation page." Second body: "Pro and Max can also send with the laptop closed." Right: the trace flattens and hands off to a DOM receipt card (interaction 4.3, phase 3). Receipt rows (sample): Employer form · Greenhouse; Fields sent · 14; Answers · 7; Resume version · v3; Confirmation · saved; Credit · 1.

**How it works 05: Replies.** Left: eyebrow "05 · Replies", H2 "Replies without a Gmail login.", body (KEEP A5 content): "You set one forwarding filter, and replies about your applications come to a private address we give you." Second body: "An offer email forwarded there pauses your billing." Right: the flat rule (SVG) gains one 2px mark labelled "reply tagged · sample".

**Honest billing and pricing.** Eyebrow "Pricing", H2 (KEEP) "Pay for applications that went through." Then, in order: the receipt calculator (interaction 4.4), the interval switch (Weekly, Monthly, Quarterly; active segment Carbon, odometer digits), four plan cards (reuse `pricing-plans.tsx` with the C3 lime fix), the footnote (KEEP) "You are only charged a credit when an application is actually submitted. Failed submits never count.", and the rules row: "One credit per submitted application." "Failed submits cost nothing." "Pause or cancel any time from the Stripe customer portal." "An offer email pauses billing." A dated caption: "Launch prices as of 2026-10-15. They may change for new customers." No competitor figures appear here.

**Comparison with auto-apply.** Eyebrow "Side by side", H2 "What people report, and what Kairos does instead." Table, Circuit Border row rules, caption header row:

| What people report about auto-apply tools | What Kairos does |
|---|---|
| Matches that do not fit | Hard rules first, then a scored fit with written reasons. You see each skip and why. |
| A review step without an edit step | Edit every field and line, then approve one or a batch. |
| Resumes with skills and metrics they do not have | Each line cites a fact you confirmed. A line without one is refused on save. |
| Hundreds of applications and zero interviews | We skip the jobs that do not fit, so your queue holds applications you would sign. |
| Broad Gmail access that ended in a locked Google account | A forwarding address you control. No Gmail login. |
| Charges after cancelling, lost credits and ignored refunds | One credit per submitted application. Failed submits cost nothing. Cancel any time; access runs to the end of the paid period. |

The left column is the PRD's reported complaints verbatim in sense, so finding C5 is resolved by attribution rather than by claim. No competitor is named.

**FAQ.** Reuse `landing-faq.tsx` with A3 changed to: "No. Tailored lines must cite facts from your confirmed profile. A save that includes a line with no fact behind it is refused, and the line is listed for you to fix."

**Closing CTA.** Full-width Void band. Left: H2 (KEEP) "Try it on 25 real applications.", body "Every application waits for your approval.", lime pill "Start free" (the navbar button reverts to Default here). Right: the resting trace as a static inline SVG (flat line with one held mark) and the clock line: "It is 14:32 where you are. Nothing sends until you approve it." The time uses `Intl.DateTimeFormat` with `timeStyle: "short"`, updates once a minute, and is `aria-hidden`; the sentence without the time is in the accessible text.

**Footer.** Four ledger columns from `siteConfig.footer` with a Circuit Border top rule carrying graticule ticks (section 5.3). A "Motion: Full / Reduced" toggle. Microcopy in Deep Fern: "Sample data on this page is labelled as such." Legal links. No clock here (the CTA already has it).

---

## 3. The single WebGL centerpiece: the instrument

### 3.1 What it is

A phosphor oscilloscope display rendered in one WebGL canvas, built with Three.js through React Three Fiber (per the locked decision), presented as a brief-standard content card: Ground Iron fill, 1px Circuit Border, 8px radius, 32px padding, no bezel, no knobs, no skeuomorphic chrome. A caption readout row sits above the screen: left, the mode word (FREE RUN, ARMED, TRIG'D, HOLD, STOP) followed by plain words; right, a time-base label ("10 min / div" in the hero and problem beats, replaced by "1 posting" once locked). The screen area is a 10 by 8 graticule. The trace is a single beam drawn with phosphor persistence.

The test the style reference sets, "would this look right on a high-end oscilloscope display", is applied literally: reference images are a Tektronix TDS and a Keysight InfiniiVision screen. Hairline graticule, thin beam, slow decay, no bloom.

### 3.2 How it looks within the phosphor palette

| Element | Colour | Notes |
|---|---|---|
| Screen background | `--background` #000000 | The card is Ground; the screen inset is Void, separated by a 1px Phosphor Blue-Black rule |
| Graticule minor lines | `--divider` #1f2a33 | 10 by 8 divisions |
| Graticule centre axes and edge ticks | `--border` #485346 | 4px ticks at each division, 8px at centre |
| Beam core | `--foreground` #ddffdc | 1.25px at DPR 1; never wider than 1.5px |
| Persistence ramp | 0.00 → #000000, 0.35 → #485346, 0.70 → #8cab87, 1.00 → #ddffdc | Intensity to colour map applied at composite time; this is the only place the trail colours exist |
| Trigger level marker and line | `--label` #9cbf93 | 1px dashed line, 8px dash, 6px gap; marker is a 10px right-pointing hairline triangle at the right edge |
| Measurement cursors | `--lead` #aed2a4 | 1px dashed vertical lines with a 6px cross at the waveform intersection |
| Held timestamp stamp | `--foreground` text on nothing | Caption type, tabular, slashed zero |
| Lime | none inside the canvas | The viewport's one lime element is always a DOM control |

"Emissive but never neon" is enforced by construction: there is no bloom pass and no additive glow sprite. The only light is the persistence buffer, which decays multiplicatively; a slow beam is brighter than a fast one, as on a real CRT, so the locked waveform reads brighter than the drifting band without any colour change.

### 3.3 Rendering model

- One `THREE.WebGLRenderer` via R3F `<Canvas frameloop="demand" dpr={[1, cap]}>` where cap is 2 on T2, 1.25 on T1.
- Trace geometry: an instanced quad strip of N segments (512 on T2, 256 on T1). The vertex shader evaluates the signal function per segment from uniforms, so no per-frame JavaScript touches the geometry. Beam width is `1.25 * dpr` px with a 3px distance-field falloff in the fragment shader.
- Persistence: two half-float render targets (RGBA16F, `EXT_color_buffer_half_float` on WebGL2) at `min(screen, 1280 by 720) * dpr`, ping-ponged each frame: `new = old * pow(uDecay, dt * 60) + beam`. Fallback to RGBA8 when half-float is unavailable (iOS Safari older than 17), with `uDecay` floored at 0.90 to avoid banding.
- Composite: a full-quad pass maps intensity to the ramp above and draws the graticule, trigger line and cursors in the same shader from uniforms (no extra draw calls).
- Draw calls per frame: 3 (beam into persistence, persistence decay, composite). Target frame time under 4ms on an integrated GPU at DPR 1.25.
- Render only when something changed: `invalidate()` is called from the scroll handler and from a 1200ms settle timer after the last uniform change, and the loop runs continuously only in FREE RUN and ARMED while the canvas is on screen (because the beam sweeps). HOLD, STOP and FLAT render on demand only.

### 3.4 Signal and sweep by state

The trace plots `y(x, t)` across a sweep of duration `T_sweep`. "Chronos" versus "kairos" is modelled by the trigger: an untriggered sweep starts at an arbitrary phase, so successive sweeps do not overlap and the persistence buffer shows a smeared band; a triggered sweep starts at the trigger crossing, so successive sweeps overlap and the trace sharpens. This is exactly how a real scope locks, and it needs no extra art.

| State | Mode word | Signal | Sweep | `uDecay` | Plain words in the readout |
|---|---|---|---|---|---|
| FREE RUN (calm) | FREE RUN | Sum of 3 sines, amplitudes 0.30, 0.14, 0.06 of screen height, frequencies 1.0, 2.3, 5.1 cycles per sweep, phases drifting at 0.05, 0.12, 0.21 rad/s, plus 1% noise | 6.0s, untriggered | 0.955 | "Postings arrive all day. Most do not fit." |
| FREE RUN (dense) | FREE RUN | 12 overlaid sweeps with independent phase offsets, amplitudes scaled 0.8 | 4.0s, untriggered | 0.975 (longer trail, thicker band) | "Hundreds of postings, none held." |
| ARMED | ARMED | Same 12 sweeps; those whose peak falls below `uTriggerLevel` fade to 0 alpha over 700ms as the level rises | 4.0s, trigger search on | 0.955 | "Waiting for a posting that passes your rules." |
| TRIG'D | TRIG'D | One sweep, the single signal above the level; `uLock` blends phase drift to 0 over the beat | 3.0s, triggered at the level crossing | 0.94 | "One posting passed. Every line below cites a confirmed fact." |
| HOLD | HOLD | Locked sweep continues; cursors attached | 3.0s, triggered | 0.94 | "Held for your approval. Nothing sends until you press Approve." |
| STOP | STOP | Sweep stops at the current phase; buffer frozen | none | 1.00 (no decay) | "Approved 14:32:07 · sample" |
| FLAT | STOP | `uAmplitude` 1 → 0 over 600ms; the frozen trace collapses to the centre line | none | 0.70 for 300ms to clear the ghost, then 1.00 | readout fades; the DOM receipt takes over |

### 3.5 Scroll mapping

Story progress `p` runs from 0 at the top of the hero to 1 at the bottom of section 7. GSAP ScrollTrigger with `scrub: true` writes `p` to a ref; the render loop lerps every uniform toward its target with factor 0.08 per frame (time-corrected), so Lenis smoothing and uniform smoothing do not stack into lag. Beat boundaries use `smoothstep` over the first 15% of each beat.

| Scroll range (vh from page top, desktop) | `p` | Transition |
|---|---|---|
| 0 to 100 | 0.000 to 0.161 | FREE RUN calm; pointer parallax active |
| 100 to 190 | 0.161 to 0.306 | Sweep count 3 → 12 over the first 30vh; `uDecay` 0.955 → 0.975 |
| 190 to 280 | 0.306 to 0.452 | Trigger line scales in from the right edge over 20vh (`scaleX` 0 → 1, origin right); `uTriggerLevel` follows the visitor's handle, default 0.62 of screen height; non-passing sweeps fade as they fall below it |
| 280 to 370 | 0.452 to 0.597 | `uLock` 0 → 1 over 30vh; cursors A and B drop from the top over 400ms each, 120ms apart, when `p` passes 0.50 |
| 370 to 460 | 0.597 to 0.742 | Card narrows to 60% over 20vh (CSS grid column change animated with `grid-template-columns` is not animatable; use `transform: scaleX` on the canvas wrapper and `translateX` on the review card instead); HOLD readout; at `p` = 0.72 or on Approve press, STOP |
| 460 to 550 | 0.742 to 0.887 | FLAT collapse over 600ms at `p` = 0.76; hand-off (section 4.3) completes by `p` = 0.84; canvas opacity 1 → 0 over 300ms and the canvas unmounts (context released) |
| 550 to 620 | 0.887 to 1.000 | DOM SVG flat line with the reply mark drawing in (`stroke-dashoffset`) over 500ms |

Below 1024px, the ranges compress proportionally to the 380svh mobile story and the same `p` thresholds apply.

### 3.6 Pointer behaviour (fine pointers only)

When `(hover: hover) and (pointer: fine)` matches and the state is FREE RUN or ARMED: the trace translates by up to ±4px horizontally and ±2px vertically toward the pointer, and the graticule by half that, eased with lerp 0.06. No rotation, no tilt (the instrument is flat). When TRIG'D or later, pointer parallax stops: a locked trace does not move for the pointer, which is itself a cue that the state changed.

### 3.7 Controls on the card

A control row sits under the screen inside the card: a "Pause motion" `<button aria-pressed>` (always present, because the sweep runs longer than 5 seconds, WCAG 2.2.2), and in beat 01 the trigger level `<input type="range">` (interaction 4.1). Pause sets the GSAP timeline `timeScale` to 0 over 600ms, freezes `uDecay` at 1.0 and stops invalidating; the choice persists in `localStorage` inside try/catch and is mirrored by the footer Motion toggle.

---

## 4. Signature interactions

### 4.1 The trigger level is the fit bar (scroll and pointer)

- **Base:** a native `<input type="range" min="0" max="100" step="1">` labelled "Fit bar", default 62, visually placed as the trigger marker on the instrument's right edge. `aria-valuetext` reads "Fit bar at 62. Showing 3 of 8 sample postings; 5 dropped." A polite live region repeats the count only when it changes.
- **Enhancement:** pointer drag directly on the marker (`cursor: ns-resize`, hit area 44 by 44px). Pointer `clientY` maps linearly to the range value; the range input stays the source of truth.
- **Effect:** `uTriggerLevel` follows the value with lerp 0.1. Sample sweeps whose peak is below the level fade over 700ms `cubic-bezier(0.22, 1, 0.36, 1)` and their row in the DOM list changes status word to "Dropped" with the reason in Sage 60. Hard-rule drops (seniority, sponsorship, cap, location) are immune to the level: they are dropped at any value, and the reason says so, which teaches the two-stage gate without a diagram.
- **Second control:** a checkbox "I need visa sponsorship", default off. Turning it on drops the two sample postings whose text says they do not sponsor, with the reason "Posting says it does not sponsor". Default off so the eight-row sample reads the same for everyone on first view.
- **Reduced motion:** values apply instantly; the poster frame for ARMED shows the default level.

### 4.2 Cursors that cite (hover, focus, tap)

- Three sample resume lines sit under the beat 02 heading. Each is a `<button aria-describedby>` whose description is the fact text ("Fact #12, confirmed by you on 2026-10-02: sample"). Hover or focus moves measurement cursor A to that line's x position on the locked trace over 240ms `cubic-bezier(0.22, 1, 0.36, 1)`, and the chip "cites fact #12" on the line fills Carbon Veil.
- Tap on touch does the same on first tap; a second tap toggles the fact text open under the line (`aria-expanded`).
- The relation is drawn, not implied: a 1px Fern Link connector runs from the chip to the card edge for 240ms and then holds as long as the line is focused. Leaving focus returns cursor A to its resting position over 240ms.
- Reduced motion: the cursor jumps; the connector appears without draw.

### 4.3 Approve is a single-shot capture (press, then hand-off)

Phase 1, press: the sample "Approve" button (lime, the viewport's one lime element) is a real `<button>`. On press it calls `lenis.scrollTo(captureAnchor, { duration: 0.9 })` so the scroll position and the instrument state stay one truth; keyboard users get the same result because the button is focusable. For visitors who never press, the capture happens when `p` crosses 0.72. Either way the trace enters STOP: the beam stops, decay goes to 1.0, and a caption stamp "Approved 14:32:07 · sample" sweeps in from the left over 300ms. The button label changes to "Approved" and loses lime (custody passes back to the navbar).

Phase 2, flatten: at `p` = 0.76 the amplitude collapses to the centre line over 600ms `cubic-bezier(0.16, 1, 0.3, 1)`.

Phase 3, hand-off (3D to DOM, after Oryzo's technique): an empty `<div data-slot="receipt-rule">` sits at the top edge of the receipt card. On resize and on `ScrollTrigger.refresh`, its `getBoundingClientRect()` is converted to the instrument's screen coordinates. Between `p` 0.78 and 0.84 the flat line interpolates position and width from the screen centre line to that slot using `smoothstep`. At 0.84 the DOM rule (1px Circuit Border with graticule ticks) is revealed under it, the canvas fades over 300ms and unmounts. The receipt card rows then sweep in left to right, 70ms apart. Nothing loops afterwards.

### 4.4 The receipt calculator (type and toggle)

- Inputs: plan (`<select>`: Starter, Pro, Max), cadence (`<fieldset>` radios: Weekly, Monthly, Quarterly), applications submitted this cycle (`<input type="number">`, clamped 0 to the allowance), failed attempts (`<input type="number">`, 0 to 999).
- Output as ledger rows in tabular figures: "Plan price", "Credits included", "Submitted × 1 credit", "Failed × 0 credits = $0.00", "Price per submitted application" (plan price divided by submitted count, or "n/a" at 0), and a final row "At full use" showing the documented $0.048, $0.033, $0.026 (monthly) so the visitor can check the arithmetic.
- Pure function of `docs/pricing.md` values: prices $19 / $39 / $79 monthly, $6 / $12 / $25 weekly, $45 / $95 / $189 quarterly; allowances 400 / 1,200 / 3,000 monthly, 94 / 280 / 700 weekly, 1,200 / 3,600 / 9,000 quarterly. No network call.
- A changed value tweens over 240ms `cubic-bezier(0.22, 1, 0.36, 1)` with an odometer roll per digit (each digit in a fixed-height column translated by `translateY`; the column set is `aria-hidden`; one visually hidden node holds the final value; a polite live region announces once after the roll). Reduced motion sets instantly.
- Caption under the calculator: "Launch prices as of 2026-10-15. Failed submissions cost nothing."

### 4.5 Beam-sweep type reveal (scroll)

Every heading and lead paragraph on the page enters with a left-to-right sweep instead of a fade-up: `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` over 700ms `cubic-bezier(0.22, 1, 0.36, 1)`, lines staggered 70ms via `animation-delay: calc(var(--i) * 70ms)`, with a 1px Phosphor White leading edge drawn as a `::after` pseudo-element that travels with the clip and fades in the last 100ms. Pure CSS, triggered by an `IntersectionObserver` that adds one class once (`once: true` semantics); text is in the HTML from the first byte. Under `prefers-reduced-motion: reduce` the animation is removed. This is the page's only entrance pattern; nothing on the page fades up.

---

## 5. The Kairos signature motif system: "readout"

The motif is the instrument's readout language applied to ordinary page furniture. It differs from Modal (rotating object, centred stacks, code windows) and from Tsenta (scrolling monospace logs) because it never scrolls, never loops and never uses monospace.

### 5.1 Typography

- Display and headings: Inter Tight 400, `ss01` on. Weight 500 only on card titles and the readout mode word.
- UI and body: Inter 400 and 500, `cv11` on.
- All numerals that are measurements, prices, counts, timestamps or fact ids use `font-variant-numeric: tabular-nums slashed-zero`. The slashed zero is the single most recognisable readout cue and costs nothing; it appears nowhere in Modal's reference.
- Readout labels (mode words, time base, eyebrows) use the caption style: 12px, uppercase, +0.6px tracking, Moss 70. Eyebrows on story beats carry a two-digit index and a middle dot: "01 · Fit gate".

### 5.2 Numerals and citations

- The citation chip: pill, 1px Circuit Border, 4px 12px padding, Inter 12px 500, text "cites fact #12" in Phosphor White with the numeral tabular and slashed. On focus or hover the fill becomes Carbon Veil (300ms colour only). It appears in beat 02, in the review card, in the receipt and in the comparison table, so the same object carries truth across the page.
- Credits are shown with a sign and a word, never a colour alone: "+25 credits · free grant", "−1 credit · submitted", "0 credits · failed". Status colours are limited to the status word.
- Timestamps are `HH:MM:SS` in tabular figures and always carry "· sample" on this page.

### 5.3 Dividers: the graticule rule

Section dividers are the brief's 1px Phosphor Blue-Black rule with a tick pattern: a `repeating-linear-gradient` of 1px Circuit Border ticks 4px tall every 10% of the container width, with an 8px tick at 50%, drawn as a `::before` on the section. The receipt card's top edge and the footer's top rule use the same pattern. One CSS rule, no images, and the page reads as one instrument from top to bottom.

### 5.4 Micro-labels

- Inside the instrument: mode words FREE RUN, ARMED, TRIG'D, HOLD, STOP are instrument vocabulary and always sit beside a plain sentence, so a visitor who has never seen an oscilloscope still reads the meaning.
- Outside the instrument: status words follow the brief exactly (Submitted, Needs review, Failed, Dropped). No instrument words leak into body copy.
- Every demo card carries the caption "Sample data" at its top right.

### 5.5 Cursor

The native system cursor everywhere. The trigger marker uses `cursor: ns-resize`; resume lines and buttons use `cursor: pointer`. No follower, no custom cursor, no cursor trail.

### 5.6 Transitions and the lime custody rule

- Entrances sweep left to right (4.5). Exits are 60% of the entrance duration and are plain opacity.
- State changes inside a card (status word, mode word) are a 120ms crossfade.
- Colour hovers are the brief's 300ms ease-out.
- **Lime custody:** the page has exactly one lime element at a time, and it is always the action that matters now. Three claimants in priority order: the sample Approve button (beat 03, while in view), the hero primary CTA (while in view), the navbar "Start free" (otherwise). An `IntersectionObserver` with `rootMargin: "-10% 0px -10% 0px"` and a 300ms hysteresis sets `data-lime-owner` on `<html>`; the non-owners render as Default buttons (Ground fill, Phosphor White border). The hand-over is a 300ms colour transition, so the lime appears to travel down the page with the visitor. This turns the brief's constraint into a visible idea: lime means "act", and the page always points at one act.

### 5.7 Ledger rail

Fixed at the right edge from 1024px up, 24px from the edge, vertically centred: eight `<a href="#...">` entries in caption style, "01 Chronos" through "08 Questions", each with a 4px tick. The active entry (set by `IntersectionObserver` with `rootMargin: "-45% 0px -45% 0px"`) is Phosphor White; the rest are Sage 40. Hidden below 1024px, where the beat eyebrows carry the index instead.

### 5.8 Landing-only token extensions

| Token | Value | Why it is needed and why it is safe |
|---|---|---|
| `--display-xl` | `clamp(44px, 6.4vw, 92px)`, line height 0.98, tracking −0.022em | The brief's 64px display is right for the app shell; an Awwwards hero needs more scale at 1440px and up. Weight stays 400; colour stays Phosphor White; left aligned. Landing only. |
| `--motion-sweep` | `700ms cubic-bezier(0.22, 1, 0.36, 1)` | The brief defines only the 300ms colour transition. Entrances need one named curve so every reveal shares a rhythm. |
| `--motion-settle` | `600ms cubic-bezier(0.16, 1, 0.3, 1)` | Used for the flatten and the hand-off, where a slower settle reads as "held". |
| `--persist-mid` | `#8cab87` (reuses Sage 60) | Named for the shader ramp so designers can tune the trail without touching the shader. Not a new hue. |
| `--graticule-tick` | `#485346` (reuses Circuit Border) | Named for the divider pattern. Not a new hue. |

No new hues are introduced. The brief's spring ban is lifted only inside the canvas, and this concept does not use springs even there: every curve above is a decelerating cubic, because an instrument settles, it does not bounce.

---

## 6. Typography moves for display type

### 6.1 Sizes

| Role | Desktop (≥1280) | Tablet (768 to 1279) | Phone (<768) | Line height | Tracking |
|---|---|---|---|---|---|
| Hero statement (H1) | `clamp(44px, 6.4vw, 92px)` | same clamp (about 50 to 80px) | `clamp(36px, 10vw, 44px)` | 0.98 | −0.022em |
| Section title (H2) | 42px | 36px | 30px | 1.05 | −0.008em |
| Kinetic word pair (problem beat) | 120px | 88px | 56px | 1.0 | animated, see 6.3 |
| Lead paragraph | 20px | 20px | 18px | 1.5 | −0.018em |
| Readout mode word | 12px caption | 12px | 12px | 1.33 | +0.6px, uppercase |
| Pricing figures | 42px tabular | 36px | 30px | 1.0 | −0.008em |

Max line length for body: 65 characters. Headlines wrap at a maximum of 18ch on desktop so the two-line hero statement holds its shape at every width.

### 6.2 Hero statement behaviour

"Job applications you would sign." is set as two lines with a manual break after "applications". Each line is a `span` in an `overflow: hidden` wrapper; on load the lines sweep in (4.5) at 0ms and 70ms. After the second sweep completes (at about 900ms), a 1px Phosphor White rule draws under the word "sign" from left to right over 400ms, like a signature line being ruled, and stays. The rule is a `::after` with `scaleX` from 0 to 1, `transform-origin: left`. Under reduced motion the text and the rule are simply present. The H1 is the LCP element and is never set to opacity 0.

### 6.3 Kinetic word pair: drift versus lock

In the problem beat, two display words sit above the instrument on the right column: "chronos" and "kairos", Inter Tight 400, 120px. They are the only split text on the page, and the split is by word, not letter, so screen readers read two words. Scroll drives two CSS custom properties through `p`:

- "chronos": `letter-spacing` eases from −0.02em to +0.08em across the beat, and its colour steps from Phosphor White to Sage 40, so the word loosens and recedes like an untriggered trace.
- "kairos": `letter-spacing` eases from +0.06em to −0.02em across the same range and its colour from Sage 40 to Phosphor White, so it tightens and sharpens as the trigger arms in the next beat.

Both words stay fully legible at every value. Under reduced motion both render in their end state, "kairos" tight and bright, "chronos" loose and recessed, so the meaning survives without motion.

### 6.4 Pricing figures

Plan prices roll as odometers on interval change (section 4.4 rules). Section titles and plan names sweep in once. Nothing else in pricing animates.

---

## 7. Mobile, reduced motion and low-end device stories

### 7.1 Mobile (below 1024px, designed as its own composition)

- Layout: single column. The instrument card becomes `position: sticky; top: 64px` with height `40svh` for the duration of the story; the text beats scroll beneath it. This is the Lando Norris lesson: the phone hero is composed for the phone, not shrunk.
- Story length: 100svh hero + four beats of 70svh (01 Fit gate; 02 Truth lock and 03 Approve merged, with the review card replacing the resume lines after the cursors drop; 04 Send and receipt with 05 Replies merged) = 380svh.
- Hero: eyebrow, H1 at `clamp(36px, 10vw, 44px)`, subhead 18px, one lime pill full width (44px tall), outlined secondary below it, then the instrument card. The navbar "Start free" is hidden on phones (the hero CTA and the hamburger menu carry it), which also satisfies lime custody without an observer at this width.
- Instrument: T1 tier by default (256 segments, DPR cap 1.25, persistence buffer at 640 by 400). Pointer parallax off. The trigger marker is replaced by the visible range input under the screen with 44px thumb hit area; dragging on the canvas does nothing (no gesture conflict with vertical scroll).
- Cursors that cite: tap behaviour per 4.2. Hit areas 44px tall.
- Receipt hand-off: same mechanism; the slot is the receipt card directly under the sticky instrument, so the line travels about 40svh downward.
- Ledger rail hidden; beat eyebrows carry the index. Comparison table renders as stacked pairs (caption "People report" and "Kairos does" above each cell) below `md`, so there is no horizontal scroll on the landing.
- Calculator inputs are 48px tall; `inputmode="numeric"` on number fields.
- Budgets: first-view JavaScript under 90KB gzipped; the WebGL chunk (about 160KB gzipped with Three and R3F) loads only after the hero is idle and only on T1 or T2. LCP target 1.8s on a mid-range Android over 4G.

### 7.2 Reduced motion (T0)

Triggered by `prefers-reduced-motion: reduce`, the footer or card Motion toggle, `Save-Data: on`, no WebGL2, or a lost context.

- The canvas is never mounted. In its place, five pre-rendered poster frames (SVG, about 12KB each, generated from the same signal function at build time so they match the shader exactly): FREE RUN calm, FREE RUN dense, ARMED at level 62, TRIG'D with cursors, STOP held. Section changes swap the `<img>` source instantly (no crossfade, because the brief removes fades under this setting). The FLAT and receipt beats show the DOM receipt directly.
- Lenis smoothing off (its default `respectReducedMotion`); anchors jump.
- Sweep reveals, the signature rule, the kinetic word pair, odometers and cursor movement are removed or set to end state; every value appears instantly.
- Trigger level and the sponsorship checkbox still work: the DOM list updates its status words; the poster for ARMED does not change with the level (noted in a caption: "Diagram shows the default fit bar").
- The Approve button still scrolls to the receipt; the stamp appears without a sweep.
- Everything reads, in order, with no interaction required.

### 7.3 Low-end devices (T1) and tier detection

| Tier | Condition | Experience |
|---|---|---|
| T0 Static | Any reduced-motion condition above, or no WebGL2, or `webglcontextlost` | Poster frames as in 7.2 |
| T1 Light | Touch primary input, or `navigator.hardwareConcurrency <= 4`, or `deviceMemory <= 4`, or R3F `PerformanceMonitor` `onDecline` fired twice | 256 segments, DPR cap 1.25, persistence buffer 640 by 400, parallax off, continuous loop only in FREE RUN and ARMED |
| T2 Full | Fine pointer, 55fps or better sustained for the first 2 seconds of the hero | 512 segments, DPR cap 2, persistence at min(screen, 1280 by 720), parallax on |

Detection runs once before the dynamic import; `PerformanceMonitor` may downgrade T2 to T1 at runtime (never upgrades, to avoid oscillation). The downgrade changes uniforms and the buffer size without remounting.

---

## 8. Performance approach, top risks and how to retire each

### 8.1 Performance approach

1. **Static first.** Every section is a Server Component. Three client islands only: the scroll and motion provider (Lenis plus GSAP ScrollTrigger), the instrument (dynamic import with `ssr: false` inside a client wrapper, per the Next.js lazy-loading rule), and the pricing island (calculator plus interval switch). The lime custody observer and the ledger rail are a fourth, tiny island (under 2KB).
2. **LCP is the H1.** Text is in the HTML, never at opacity 0; the canvas is not full viewport and starts as a `<img>` poster (AVIF or SVG, under 60KB) that cross-fades to the canvas over 600ms once the first frame renders.
3. **One clock.** Lenis runs from the GSAP ticker (`autoRaf: false`), ScrollTrigger updates on Lenis scroll, and the R3F loop is `frameloop="demand"` with `invalidate()` from the same ticker when uniforms changed. There is one requestAnimationFrame owner on the page.
4. **No React state in the hot path.** Scroll progress, uniforms and DOM transforms go through refs. React state is used only for the visible-set changes (status words, custody owner, calculator outputs).
5. **Idle load.** The WebGL chunk loads on `requestIdleCallback` with a 1200ms timeout fallback, after fonts and the poster. Shader compilation happens off the critical path and the canvas waits for the first `gl.getProgramParameter` success before cross-fading.
6. **Budgets (internal goals, after the Awwwards winner self-reports; the official good thresholds are looser):** LCP 1.5s desktop and 1.8s mobile, INP under 100ms, CLS under 0.05, total page weight under 2.5MB including fonts and posters, sustained 60fps on T2 and 55fps on T1 during the story, JavaScript under 90KB gzipped before the WebGL chunk and under 260KB gzipped in total.
7. **Fonts.** `next/font/google` for Inter Tight (400, 500) and Inter (400, 500) with `display: "swap"` and the automatic size-adjust fallback, subset latin. No weight above 500 is ever requested.
8. **Release the GPU.** The canvas unmounts after the hand-off at `p` = 0.84 and does not remount while scrolling back up until `p` falls below 0.80 (hysteresis), so the lower page never carries a WebGL context.

### 8.2 Top risks and retirement

| # | Risk | Why it matters | How to retire it |
|---|---|---|---|
| 1 | The instrument reads as sci-fi or neon rather than a precision display | Breaks "calm, exact"; fails the style reference's oscilloscope test | No bloom, beam core at most 1.5px, trail by persistence only, hairline graticule in Divider. Build a one-day shader prototype and judge it side by side with a Tektronix screen photograph before any other work. If it fails, cut persistence to 0.90 and remove the dense state. |
| 2 | The oscilloscope metaphor is opaque to anxious job seekers | Usability is 30% of the score and the audience is not engineers | Instrument words never appear without a plain sentence; the left column carries the whole story without the canvas. Test: five people, 10 seconds on the hero, asked "what does this do"; pass if four say fit, facts, approval or receipt. |
| 3 | A 620vh pinned story feels long | Scroll fatigue, especially on phones | Mobile story is 380svh with merged beats; every beat has a visible anchor in the ledger rail; measure scroll depth at beats 03 and 08 in beta and cut a beat if depth at 08 is under 40%. |
| 4 | Lime custody flickers at boundaries | Two lime elements visible breaks the brief's hardest rule | 300ms hysteresis, 10% root margins, and a Playwright check that screenshots every 100px of scroll at 1440 and 390 widths and counts elements with `data-lime-owner`. |
| 5 | Bundle weight of Three plus R3F for a 2D shader | WPO score and mobile LCP | Tree-shaken Three import of only `WebGLRenderer`, `WebGLRenderTarget`, `RawShaderMaterial`, `InstancedBufferGeometry` and `Scene`; if the chunk still exceeds 160KB gzipped, replace it with a raw WebGL2 module (two programs, two framebuffers, under 10KB) behind the same uniform interface. The decision locks one WebGL centerpiece; the library is an implementation choice. |
| 6 | Half-float render targets unavailable on some iOS versions | Persistence banding or a black screen | Capability check for `EXT_color_buffer_half_float`; fallback to RGBA8 with `uDecay` floored at 0.90; `webglcontextlost` drops to T0 and does not retry more than once. |
| 7 | Sample data read as real results | Violates the truth rule; the competitor file shows this exact failure on six sites | "Sample data" caption on every demo card; no fit scores shown as numbers; reasons use PRD strings; timestamps carry "· sample"; a release checklist item greps the landing for digits inside demo cards. |
| 8 | Copy claims drift from the docs ("No card", extension and cloud applier as live) | Legal and trust | Hero and CTA drop "No card" until confirmed; feature sentences use the KEEP wording that describes behaviour, not availability; the plan table shows plan features exactly as `docs/pricing.md` lists them. |
| 9 | Lenis and `position: sticky` or anchor links misbehave | Broken story and broken navigation | Lenis wraps native scroll so sticky and anchors work (verified in its README); set `anchors: true`, `data-lenis-prevent` on the calculator select and the mobile menu; test on iOS Safari with `syncTouch: false`. |
| 10 | Hero LCP delayed by the canvas or fonts | Core Web Vitals and the WPO sub-score | H1 never hidden, canvas not full viewport, poster as `<img>` with explicit dimensions, fonts via `next/font` with swap; Lighthouse in CI with a failing threshold at LCP 2.0s on the mobile profile. |

---

## 9. The case for each Awwwards criterion

**Design (40%).** One palette, one type family pair, one shape language (hairline, 8px cards, 12px buttons, pill only for the act), and one metaphor carried from the first pixel to the footer rule. The instrument is a content card, not a prop, so the page is one system rather than a hero stunt above a template. The graticule divider, slashed-zero tabular numerals and citation chips give the page a recognisable hand that no reference site has. The dense-to-locked trace is a strong image that costs no illustration and never leaves the brand's three adjectives.

**Usability (30%).** This is where the research says winners are weakest (mean 7.40) and where Kairos is built to score: the whole story reads without the canvas; every interaction has a native control as its base (range, checkbox, button, select, `<details>`); keyboard reaches everything with a visible 2px Phosphor White focus ring; a pause control and a site-wide Motion toggle exist; contrast is measured against the brief's values (body 8.3:1, lead 12.6:1, labels 10.3:1); the comparison table stacks on phones so nothing scrolls sideways; the ledger rail is navigation, not decoration; the lime always points at one action. Reduced-motion and T0 fallbacks are full experiences, not apologies.

**Creativity (20%).** The product's mechanism is the spectacle: the trigger level is the fit bar, measurement cursors are citations, single-shot capture is approval, and the trace literally becomes the receipt. The lime that travels down the page, the drift-versus-lock word pair, and a scroll story where every motion ends are ideas a juror has not seen in this category, and each one is an argument about the product rather than an effect.

**Content (10%).** Short declaratives, real numbers only where the docs supply them (15 to 30 minutes, 25 free applications, $19 / $39 / $79, $0.048 / $0.033 / $0.026, within 30 minutes and 5 on Max), attributed complaints instead of competitor attacks, a receipt calculator that lets the visitor check the arithmetic, and sample data that says it is sample. On a field where every competitor publishes unsourced percentages, the honesty is the content.

---

## Appendix A: What this concept deliberately does not do

- No 3D object, no rotation, no bezel or knobs; the instrument is flat.
- No lime inside the canvas, no lime text, no glow or bloom.
- No fade-up reveals, no spring or bounce anywhere, no infinite loops after the capture.
- No custom cursor, no preloader screen, no logo marquee, no testimonials, no counts, no competitor names.
- No monospace type and no scrolling logs, so it cannot be mistaken for Tsenta's terminal.
- No numbers inside demo cards that could be read as results.

## Appendix B: Dependencies this concept adds

`three`, `@react-three/fiber`, `@react-three/drei` (for `PerformanceMonitor` only; drop it and hand-roll a frame-time sampler if the import is heavy), `gsap` (core plus ScrollTrigger), `lenis`. All new; none is installed today (see `_research/code-inventory.md`, section 1). The raw WebGL2 fallback in risk 5 would remove the first three.
