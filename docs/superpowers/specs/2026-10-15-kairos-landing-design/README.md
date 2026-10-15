# Kairos landing page: master design spec

Status: **drafted, for owner review.** Per-section critics and the five-lens audit (accessibility, performance, brand and truth, Awwwards juror, coherence) are pending and run after this review. Nothing has been built and no test has been run.

Date: 2026-10-15. Product: Kairos by Gray Matter Labs. Route: `/`.

This README is the entry point to the landing spec set. It summarises the 6 system documents and 14 section specs, records the locked decisions, and lists what the owner should check first. Where two documents disagree, this file names the conflict and the proposed resolution; it does not silently pick one.

---

## 1. Summary and locked decisions

Kairos is a fit-first job application agent: it applies only to jobs that fit, tailors resumes only from facts the user confirmed, and sends nothing until the user approves. The landing page has to convert anxious job seekers (OPT and STEM OPT students, new grads, laid-off tech workers, Indian job seekers applying to US roles) while the brand stays calm, exact and accountable. The goal is Awwwards Site of the Day calibre, with spectacle that serves trust.

The chosen concept, **The Ledger**, makes the page itself a ledger that writes itself as the visitor reads: eleven numbered entries (00 to 10), one WebGL thermal receipt slip that prints a line per entry, a stop at the moment of approval that only the visitor can release, and a single Mint Frost paper band where the slip becomes a readable DOM receipt.

### Decisions locked by the owner on 2026-10-15

| # | Decision | How the spec set applies it |
| --- | --- | --- |
| 1 | Expressive motion with exactly one WebGL centerpiece, smooth scroll, kinetic type and scroll-driven storytelling. Bans on 3D hero art, ambient loops and spring easing are amended for the landing only. Full reduced-motion support and low-end fallbacks are mandatory | One receipt slip in vanilla `three@0.186.1`; Lenis and GSAP ScrollTrigger at 1024px and wider only; the spring and loop bans are lifted but deliberately unused ("every motion ends"). Four quality tiers plus Reduced and no-JS variants in every section spec |
| 2 | Build on the existing Next.js route; rebuild the landing page and `web/components/landing/*`; migrate `web/app/globals.css` to the brief's dark phosphor tokens (app-wide, brief open item 2) | Same URL `/`, but the page file moves into a new `(landing)` route group (see review item R2). Token migration is prerequisite P2, its own change |
| 3 | Keep the brief's palette and type (Inter Tight display, Inter UI and body, Lime Pulse `#7fee64`) and add a Kairos-only signature motif so the site does not read as a clone of Modal | Kairos Marks M1 to M10 (entry numbers with graticule ticks, the post, posting squares, citation and claim chips, sample marks, perforation, signed numerals, the kairos stamp, lime custody). No new hues |

### Rules that still hold on the landing

Tone is calm, exact and accountable, with no hype words and no em dashes in user-facing copy. Every fact comes from the docs: no testimonials, user counts, logos, ratings, press or outcome metrics. Lime Pulse is a fill, never text, and at most one lime element is visible per viewport. Weights are 400 and 500 only. Body text is left-aligned. Status colours are used only for status words and small badges. Contrast meets WCAG 2.2 AA. Brief tokens are the base; every landing-only token is named and justified in [02-design-system.md](./02-design-system.md).

---

## 2. Concept and why it won

### Scoreboard

| Rank | Concept | Composite | Awwwards-weighted | Brand fit | Feasibility | File |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **The Ledger** | **8.19** | 7.93 | **9.17** | **8.00** | [concept-the-ledger.md](./_concepts/concept-the-ledger.md) |
| 2 | Signal from Noise | 7.71 | **8.02** | 8.67 | 5.83 | [concept-signal-from-noise.md](./_concepts/concept-signal-from-noise.md) |
| 3 | The Locked Trace (kairos-moment) | 7.32 | 7.48 | 7.50 | 6.67 | [concept-kairos-moment.md](./_concepts/concept-kairos-moment.md) |
| 4 | No Fact, No Line (truth-lock) | 7.11 | 7.52 | 8.17 | 4.83 | [concept-truth-lock.md](./_concepts/concept-truth-lock.md) |

### Why The Ledger won

- **Brand fit (9.17).** Kairos's real differentiator is accountability: a written reason for every skip, a citation for every resume line, a receipt for every submission and one ledger row per credit. The Ledger turns that into how the page behaves. It only moves forward (append-only), labels every sample, sends nothing, and refuses to print a number it has not measured.
- **Honest proof for a pre-launch product.** The proof is mechanisms, not claims. Five problems people report with other tools are posted as open "debit" rows in entry 01 and settled in writing further down. Row 04 ("Hundreds of applications and zero interviews") stays open for the whole page, because Kairos cannot promise interviews. That open row is the page's most persuasive honesty move.
- **Feasibility (8.00).** One mesh, no lights, no post-processing, at most 4 draw calls, and a DOM receipt that carries the same content at every tier. Signal from Noise scored slightly higher with jurors (8.02) but needed R3F and a particle system over budget (feasibility 5.83).
- **A signature that is not Modal's.** The receipt slip, the perforation, the graticule entry rule and the kairos stamp come from the product's own artefacts. "Kairos is Greek for the right moment. You choose it." ties the name to the approval moment, where the page stands completely still until the visitor presses Approve.

Full direction: [01-creative-direction.md](./01-creative-direction.md).

---

## 3. Page map

Scroll lengths are the creative direction's targets. Where a section spec measured its real height with final copy at 1440 by 900, the measured value is shown too. All 14 section specs exist; none is missing.

| Order | Section id | Name | Purpose | WebGL state | Scroll length | Pinned | Spec |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `navbar` | Navbar | Orientation and an always-reachable sign-up; `Start free` is lime only when it owns custody | none | 0vh (sticky chrome, 64px) | Sticky, never hides | [01-navbar.md](./sections/01-navbar.md) |
| 2 | `ledger-rail` | Ledger rail and receipt tape | Scroll progress and entry navigation: 11-link rail at 1280px and wider, 48px receipt tape below 1024px from entry 02 | none | 0vh (fixed chrome) | Fixed | [02-ledger-rail.md](./sections/02-ledger-rail.md) |
| 3 | `entry-00-hero` | Hero: Open | One-breath statement "Job applications you would sign." and the free start | `slip-open` | 100vh | No | [03-entry-00-hero.md](./sections/03-entry-00-hero.md) |
| 4 | `entry-01-reported` | Reported: five debits | Five reported problems posted as open rows, settled later; row 04 stays open | `slip-recede` | 90vh | No | [04-entry-01-reported.md](./sections/04-entry-01-reported.md) |
| 5 | `entry-02-fit-gate` | Fit gate and the sample run | Hard rules before any model; 48 synthetic postings through the real `passesHardFilters`; settles row 01 | `slip-feed` | 150vh target, about 250vh measured | No | [05-entry-02-fit-gate.md](./sections/05-entry-02-fit-gate.md) |
| 6 | `entry-03-truth-lock` | Truth lock | Every tailored line cites a confirmed fact; an uncited line cannot be saved; settles row 02 | `slip-cite` | 120vh target, about 147vh measured | No | [06-entry-03-truth-lock.md](./sections/06-entry-03-truth-lock.md) |
| 7 | `entry-04-approve` | Review and approve: the kairos moment | The page stands still until the visitor approves a sample; settles row 03 | `slip-hold` | 100vh | No | [07-entry-04-approve.md](./sections/07-entry-04-approve.md) |
| 8 | `entry-05-send-receipt` | Send and receipt: the paper band | How applications are sent and what a receipt holds; the slip tears and the page turns to Mint Frost paper | `slip-tear` or `ghost-path` | 260vh (200vh wrapper with 100vh sticky stage, plus the mint flow) | Yes, 100vh of pinned scroll at 1024px and wider | [08-entry-05-send-receipt.md](./sections/08-entry-05-send-receipt.md) |
| 9 | `entry-06-replies` | Replies and the open row | Reply tracking through a forwarding filter, no Gmail access; states plainly that row 04 stays open | `slip-reply` | 90vh | No | [09-entry-06-replies.md](./sections/09-entry-06-replies.md) |
| 10 | `entry-07-billing` | Honest billing and pricing | Exact launch prices, sample credit ledger, receipt calculator; settles row 05 | none | 200vh target, about 2,400px (267vh) measured | No | [10-entry-07-billing.md](./sections/10-entry-07-billing.md) |
| 11 | `entry-08-compare` | Compared with typical auto-apply | Mechanisms versus reported complaints, no products named, no price comparison | none | 80vh target, about 97vh measured | No | [11-entry-08-compare.md](./sections/11-entry-08-compare.md) |
| 12 | `entry-09-questions` | Questions | Six native `<details>` with matching FAQPage JSON-LD; plain limits | none | 90vh | No | [12-entry-09-questions.md](./sections/12-entry-09-questions.md) |
| 13 | `entry-10-start` | Start: your ledger | Ask once: "Try it on 25 real applications." A fresh slip prints the sign-up grant | `slip-fresh` | 100vh | No | [13-entry-10-start.md](./sections/13-entry-10-start.md) |
| 14 | `footer` | Footer: colophon and page receipt | The page prints a receipt for itself; CHRONOS and KAIROS clock line; Motion control | none | 60vh | No | [14-footer.md](./sections/14-footer.md) |

Target total: about 1,440vh. With the measured overshoots, about 1,650vh at 1440 by 900 (review item R8).

Anchors are `#entry-00` to `#entry-10`; headings are `entry-NN-title` with `tabindex="-1"`; `<main id="main">`. Each entry renders as `<section id data-section data-entry="NN" data-scene aria-labelledby class="lp-entry">` ([05-architecture.md](./05-architecture.md) section 2.3).

---

## 4. Whole-page scroll storyboard

The storyboard describes the desktop experience at tier 2 (1440 by 900, full motion). Phones, tier 0 and Reduced follow the same story with DOM equivalents (section 7 of this README).

| Moment | WebGL slip | Type | Colour and lime |
| --- | --- | --- | --- |
| **Arrival (entry 00)** | A DOM poster of the slip is visible at frame 0 in the right lane (columns 9 to 12), posed `rotateX(-6deg) rotateY(-14deg) rotateZ(-2deg)`, with `KAIROS · RECEIPT · SAMPLE` and `00 · Ledger opened`. At `max(stageReady, FCP + 1200ms)` the poster fades out over 600ms onto an identical canvas. Pointer tilt up to 6 degrees (y) and 3 degrees (x), critically damped, fine pointers only | H1 "Job applications you would sign." at 48 to 104px. Words ink from Sage 60 to Phosphor White, 360ms each with a 70ms stagger, CSS only and readable at frame 0. A 1px signature rule draws under "sign." (500ms from 700ms) | Void Black page. The hero CTA "Start with 25 free applications" is the one lime fill. Logo is Phosphor White |
| **Entry 01** | Recedes to `slip-recede`: offset (+0.15, −0.06, −0.8), rotation (4, −24, 0), scale 0.82, paper level 0.65. Tilt off | Entry rule draws (600ms, `cubic-bezier(0.22,1,0.36,1)`); title rises. Five rows read `open · see NN` | Lime hands to the navbar `Start free` once the hero CTA leaves the viewport (150ms release, then 150ms fill) |
| **Entry 02** | Flattens to `slip-feed` (rotation (0, −6, 0), scale 0.96). At local progress 0.20 it feeds 48 SKIP or PASS rows in the product's own reason text over 2,400ms ("chronos"), stops dead for 200ms, then prints `02 · Fit gate · hard rules first · every skip has a reason`. Sequence ends at 4,440ms | Row 01 in entry 01 flips to `settled in 02` with a filled 6px posting square. Sample run demo with native controls and a dashed SAMPLE edge | Navbar keeps lime. Mono-chromatic phosphor greens; status words only in status colours |
| **Entry 03** | `slip-cite` (rotation (2, −10, 0)), prints `03` | The uncited preset "Led a team of 6 engineers" is refused: a thread reaches 70%, a lock bracket closes, the thread retracts in 240ms (`cubic-bezier(0.7,0,0.84,0)`), the letters fall 14px and fade, and "Not saved. This line cites no confirmed fact." is announced | Navbar keeps lime |
| **Entry 04: the kairos moment** | `slip-hold` (offset (−0.04, 0, 0.2), rotation (0, −4, 0), scale 1.00). Nothing moves; zero frames rendered at rest. On Approve the slip prints `04 · Approved by you` and the visitor's local date and time in a signature box (two-row print, 1,960ms). If the visitor scrolls past without approving, it prints `04 · Awaiting your approval` once | "Kairos is Greek for the right moment. You choose it." Row 03 settles | Lime moves to "Approve sample draft" while it is visible and unapproved; after approval it returns to the navbar |
| **Entry 05: the paper band** | 100vh of pinned scroll. At p=0.18 the slip tears along its perforation (700ms, `cubic-bezier(0.55,0,1,0.45)`); 0.25 to 0.50 it travels and flattens into the centred DOM slot; at 0.50 it cross-fades into the DOM receipt (400ms, opacity only); 0.56 to 0.90 a flat mint layer scales from the receipt's rectangle to cover the stage. Unapproved visitors get the ghost path: a dashed outline travels and the slot reads "No receipt yet. Nothing was sent." with an in-place Approve | H2 sits in columns 1 to 4; receipt table in 5 to 8; two verified slips (Failed for 0 credits; reported twice, charged once) in 9 to 12 | The page turns from Void to **Mint Frost `#def0dd`**, the single light band. On-mint ink is Void, body is Ground Iron, secondary is `--on-mint-muted` `#485346`. Navbar owns lime throughout; the ghost Approve is never lime |
| **Entry 06** | Canvas fades back in (400ms) as `slip-reply` on fresh paper (`05 · Receipt filed`) or on the original paper (`05 · Not sent · waiting for your approval`); prints `06 · Reply tagged to its application` | After a 200ms stillness, the open-row sentence posts with a hollow Phosphor White square: "Row 04 stays open. We cannot promise interviews, and we will not print a number we have not measured..." | Back on Void. No lime in the entry |
| **Entries 07 to 09** | Canvas fades out (400ms) when entry 07 reaches the viewport; scene `none` | Prices at 40 to 64px numerals; odometers roll in 240ms; compare rows post top to bottom with Kairos cells inking from Sage 60 to Phosphor White; FAQ A2 "We do not promise it is undetectable..." in Phosphor White | Lime moves to "Choose Pro" (Pro card has a Phosphor White border), then back to the navbar |
| **Entry 10** | Canvas fades in at the hero pose; the sample paper lifts out (600ms); a new slip headed `KAIROS · AT SIGN-UP` prints `+25 credits · free grant · never expires`, then stops | "Try it on 25 real applications." Body swaps to "You approved the sample at {time}..." for visitors who approved | Lime moves to the closing "Start free" |
| **Footer** | Opaque Void covers the canvas | Perforation draws; the page receipt posts; `CHRONOS 14:32 YOUR TIME · KAIROS WHEN YOU APPROVE` updates once a minute | Lime returns to the navbar |

Lime custody order (priority) is Approve, hero CTA, Choose Pro, closing CTA, navbar. The hand-over is sequential so two lime fills never coexist.

---

## 5. Design system summary

Source: [02-design-system.md](./02-design-system.md).

- **App tokens (P2).** A full dark `:root` and `@theme inline` block replaces the old light tokens in `globals.css`: `--background #000000` (Void Black), `--surface #181818` (Ground Iron), `--mint #def0dd` (Mint Frost), `--foreground #ddffdc` (Phosphor White), `--body #8cab87` (Sage 60, 8.3:1 on Void), `--border #485346` (Circuit Border, decorative), `--accent #7fee64` (Lime Pulse, fill only), plus label, lead, link, status and radius tokens. An alias map and an edit list keep the 56 files that use token utilities rendering during migration.
- **Landing-only tokens** live under the `.lp` scope class in `web/components/landing/landing.css`, never on `:root` or `@theme`. The creative direction's pinned names are unchanged; new names use the `lp-` prefix. A CI grep blocks leaks outside landing files.
- **Type.** `next/font` Inter and Inter Tight at 400 and 500, both preloaded (about 81 KB). `--type-display-landing` is `clamp(3rem, 1.25rem + 5.6vw, 6.5rem)` (48 to 104px, line height 0.95, −0.025em); headings 36 to 56px; numerals 40 to 64px. `ss01` on Inter Tight headings, `cv11` on Inter body, `tabular-nums slashed-zero` on all numerals.
- **Grid.** 4 columns below 640px (16px gap and margin), 8 columns from 640 to 1023px, 12 columns at 1024px and wider (32px gap and margin), 1280px container. Text in columns 1 to 7, H1 in 1 to 8, receipt lane in 9 to 12 (384px), receipt slot in 5 to 8. Section padding 128, 96 and 80px.
- **Lime checklist L1 to L10** and the CSS custody hand-over on `html[data-lime-owner]`.
- **Mint Frost** is used once as a band and again as receipt paper (`--receipt-paper`), so the canvas-to-DOM hand-off is seamless. On-mint status tokens `--on-mint-good #3d6b21`, `--on-mint-warn #8a5a00`, `--on-mint-bad #a3261c`.
- **Kairos Marks M1 to M10** as concrete geometry, with 18 do and don't rows. Dashed always means "sample or not real yet".
- **Product UI** is live DOM replicas built from shared primitives, each with a SAMPLE chip and synthetic names ("Company 014"). No screenshots on the landing. New gate G9: every replica is reviewed against the real screen before launch.
- **Contrast table** for every pairing, including navbar worst cases over the mint band.

---

## 6. Motion system summary

Source: [03-motion-system.md](./03-motion-system.md).

- **Eight principles:** every motion ends; motion records rather than performs; the page only moves forward; nothing moves unless the visitor caused it; stillness at the approve entry; readable at frame zero; no springs or overshoot; reduced motion changes how things move, never what the page says.
- **Grammar:** ink, post, print, feed, tear, travel, hand-off and retract, in four families (enter, emphasize, hand-off, exit). Arriving decelerates, leaving accelerates, moving between two places is symmetric.
- **Easing tokens** map to GSAP built-ins, so no CustomEase: `--ease-post cubic-bezier(0.22,1,0.36,1)` = `power4.out`; `--ease-feed (0.45,0,0.55,1)` = `power1.inOut`; `--ease-travel (0.65,0,0.35,1)` = `power2.inOut`; `--ease-tear (0.55,0,1,0.45)` = `circ.in`; `--ease-retract (0.7,0,0.84,0)` = `expo.in`; `--ease-utility cubic-bezier(0,0,0.58,1)`.
- **Durations** from 120ms (`--dur-swap`) to 2,400ms (`--dur-feed`); key values ink 360ms, print 420ms, sign 500ms, post 600ms, tear 700ms, rise 700ms. Staggers: word and line 70ms, row 60ms, compare 90ms, character 18ms.
- **Engine split:** CSS by default at every width; GSAP 3.15.0 with ScrollTrigger and SplitText plus Lenis 1.3.26 only at 1024px and wider with full motion. Motion for React is not used. `scrub: true` everywhere, CSS sticky is the only pin (one pin, 100vh maximum), no snapping.
- **Limits:** at most 2 simultaneous motion groups; longest automatic sequence about 3.9 to 4.4s (autoplay cap 4,500ms), so WCAG 2.2.2 needs no pause button, but the footer Motion control also stops the clock.
- **Reduced motion:** all duration tokens become 0.01ms under `prefers-reduced-motion: reduce` (unless the visitor chose Full) and under `html[data-motion="reduced"]`; colour transitions (300ms) are kept. The motion preference is stored in `localStorage["kairos:motion"]` and applied by a head script before paint.
- **Catalogue:** about 40 preset ids (`kt-*`, `en-*`, `em-*`, `ho-*`, `ex-*`, `mb-print-tear`, `mi-*`) and nine named sequences (`sq-hero-open`, `sq-feed-stop`, `sq-cite-save`, `sq-cite-refuse`, `sq-approve`, `sq-stage`, `sq-stage-dom`, `sq-ghost-approve`, `sq-fresh`). Section specs add `sq-open-row` and `en-tape-dock`.
- **QA:** a 27-item checklist with pass criteria; ten documented deviations from the creative direction.

---

## 7. WebGL centerpiece summary

Source: [04-webgl-scene.md](./04-webgl-scene.md).

- **Object:** one thermal receipt slip with a print head, on one fixed canvas, in vanilla `three@0.186.1`. R3F is not used (measured about 133 KB gzip for minimal vanilla three against about 250 KB for R3F 9.8.2); R3F remains the pre-approved fallback.
- **Geometry:** 3,180 vertices, 6,086 triangles and at most 4 draw calls at tier 2; 16 vertices at tier 1. No instances, particles, lights or post-processing.
- **Shaders:** palette-locked and unlit. Forward curl in the vertex shader; Lambert normalised so flat paper is exactly `#def0dd`; a 1 CSS px procedural perforation; interleaved-gradient-noise dither; a ring-buffer ink mask so printed lines are append-only. Text is drawn into a Canvas 2D texture with manual tabular digits and a drawn slashed zero.
- **Camera:** fixed at (0, 0, 6) looking at the origin, fov 35, with lane-fit formulas worked at five viewports.
- **States:** `slip-open`, `slip-recede`, `slip-feed`, `slip-cite`, `slip-hold`, `slip-tear`, `ghost-path`, `slip-reply`, `slip-fresh`, plus `none` for entries 07 to 09. Each has a state-table row (offset, rotation, scale, uniforms); poses blend at `POSE_LAMBDA` 7.7 per second.
- **Idle:** zero frames rendered at rest; every autonomous move ends in under 5s; the Motion control acts as pause.

### Quality tiers

| Tier | Who gets it | What they see |
| --- | --- | --- |
| T2 high | 1024px and wider, WebGL 2 without a performance caveat, no low-memory or low-texture signals | Full scene, DPR up to 2 within a 2.1 MP buffer, 60fps cap, curl, pointer tilt |
| T1 medium | `deviceMemory <= 2`, 4 or fewer cores with a coarse pointer, or `MAX_TEXTURE_SIZE < 4096` | Lite flat scene, 1.0 MP buffer, 30fps cap, no curl, no tilt |
| T0 low | Below 1024px, forced colours, Save-Data, no WebGL 2, or demoted by the runtime sampler (median frame above 24ms steps T2 to T1; above 34ms steps T1 to T0) | No WebGL chunk is requested; the visible DOM lane receipt and DOM print-and-tear carry the story |
| T0 static | Reduced motion | No WebGL and no DOM motion; every element in its final state |

Memory budgets: about 46 MB at T2 and 18 MB at T1, with ordered disposal and context-loss handling. Frame budgets at T2: 2.0ms GPU and 1.0ms stage CPU per frame (p95), leaving at least 10ms of each 16.7ms frame for the rest of the page.

---

## 8. Architecture and dependencies

Source: [05-architecture.md](./05-architecture.md).

- **Routing:** URL stays `/`; the page moves to `web/app/(landing)/page.tsx` with a `(landing)/layout.tsx` whose `LandingShell` applies `.lp` around navbar, main and footer, so no landing rule reaches `/pricing` or other public routes. The page exports `ensureStatic='navigation'`.
- **Rendering:** all copy, headings and tables are server-rendered from `web/content/landing-copy.ts` (`landingCopy`). There are 19 small client islands. No preloader.
- **Runtime:** one `gsap.ticker` per frame in the order Lenis, ScrollTrigger, GSAP tweens, then the stage (which renders only when something changed). Three state containers: `ledgerStore` (append-only story state, persisted in `sessionStorage`), `envStore` (device and preference facts) and `sceneInput` (per-frame numbers). Scrolling causes no React renders.
- **Canvas mounting:** `StageLoader` loads the WebGL chunk with `next/dynamic` and `ssr: false` after `load` plus idle, only when the probe returns tier 1 or 2. An error boundary drops to tier 0 on any failure.
- **Shared components:** `PricingPlans` is forked for the landing and its lime problems are fixed once for `/pricing` too; `FaqList` answers widen to `ReactNode`; the navbar gains `variant`, `caption` and `sheetExtra`. `comparison.tsx` is deleted (unverified competitor claims).
- **Analytics:** none. The repo has no analytics and the page sends no events.

### Pinned dependencies (exact, `--save-exact`)

| Package | Version | Type | Loaded in |
| --- | --- | --- | --- |
| `gsap` | 3.15.0 | dependency | Motion chunk (core, ScrollTrigger, SplitText) |
| `@gsap/react` | 2.1.2 | dependency | Motion chunk (`useGSAP`) |
| `lenis` | 1.3.26 | dependency | Motion chunk |
| `three` | 0.186.1 | dependency | WebGL chunk |
| `@types/three` | 0.186.0 | devDependency | Types |
| `@playwright/test` | 1.64.0 | devDependency | E2E (matches the server's `playwright-core` ^1.64.0) |
| `@axe-core/playwright` | 4.13.0 | devDependency | Accessibility scans |
| `vitest` | 5.0.4 | devDependency | Unit tests (same as `server` and `extension`) |
| `@lhci/cli` | 0.15.1 | devDependency | Lighthouse CI |

Unchanged: `next` 16.4.0, `react` and `react-dom` 19.3.0, `@phosphor-icons/react`, `clsx`, `tailwind-merge`, `@auto-career/shared`. Not added: `@react-three/fiber`, `@react-three/drei`, `postprocessing`, `motion`, ScrollSmoother, CustomEase, detect-gpu, analytics SDKs, Lottie or Rive.

### Blocking prerequisites

| # | Prerequisite | Blocks |
| --- | --- | --- |
| P1 | `server/scripts/build-landing-fit-sample.ts` runs 48 seeded synthetic postings through the real `passesHardFilters` under all 18 control combinations and writes `web/content/fit-sample.json`; a server drift test fails if the JSON differs | Entry 02 and the receipt feed. Without P1, entry 02 does not ship |
| P2 | `globals.css` migrated to the dark phosphor tokens, the `#d8e61a` hover in `button.tsx` replaced by `--accent-hover`, button radius 12px, fonts in `layout.tsx` | Everything |
| P3 | Landing pricing reads prices and feature strings from `shared/src/plans.ts`; add `creditsPerInvoice(planId, interval)` | Entry 07 |
| P4 | A single copy of `three` in the workspace (`npm ls three`) | Stage |

### Build order

Phase 0 prerequisites and test harness; Phase 1 static page (shippable); Phase 2 islands and CSS motion; Phase 3 motion chunk; Phase 4 WebGL stage; Phase 5 hardening, real-device passes (iPhone Safari 17 and 18, mid-range Android, pre-M1 Mac), NVDA and VoiceOver, and gates G2 to G9. The page is shippable at the end of every phase from Phase 1.

---

## 9. Budgets

### Performance

| Metric | Budget |
| --- | --- |
| LCP | 1.5s or less desktop, 2.5s or less mobile; the LCP element is the H1 at every width |
| CLS | 0.05 or less; 0 during a scripted full-page scroll at 1440 by 900 and 390 by 844 |
| TBT | 50ms or less desktop, 150ms or less mobile |
| INP (lab) | 100ms or less for every scripted interaction under 4x CPU throttling |
| Long tasks after hydration | None above 50ms (one shader compile window under 120ms at T2) |
| JS gzip per chunk | Islands 20 KB, motion 60 KB, WebGL 140 KB |
| JS gzip per situation | 20 KB below 1024px or Reduced; 80 KB at 1024px+ tier 0; 220 KB at 1024px+ tier 1 or 2 |
| HTML / CSS / fonts | 60 KB / 25 KB / 85 KB (2 woff2 files) |
| Images | 0 raster images on the page if the DOM poster is confirmed (review item R5) |
| First-load transfer | 1.0 MB desktop tier 2; 500 KB at 390 by 844 |
| Third-party requests | 0 |
| Renders at rest | 0 over 2s |

Next.js 16 no longer prints bundle sizes, so a Playwright test counts the bytes actually downloaded; Lighthouse CI asserts LCP, CLS, TBT, byte weight, accessibility 0.95 or more and SEO 0.95 or more.

### Accessibility

- WCAG 2.2 AA contrast for every pairing (computed table in 02 section 9); focus is a 2px Phosphor White outline, Void on mint.
- Touch targets 44px with 8px spacing (two documented exceptions: contiguous 44px rail links and 56px FAQ rows).
- Everything readable at frame zero and without JavaScript; native controls (`<details>`, `<dialog>`, `<select>`, range); skip links "Skip to main content" and "Skip to pricing"; live regions for refusals, approval and calculator results; a text alternative for every printed receipt line.
- Reduced motion and the footer Motion control (Full or Reduced) honoured everywhere; forced-colours variants specified; NVDA and VoiceOver passes before launch.

### Quality tiers

See section 7. Every scene state has a DOM fallback rendered from the same receipt-line data, so no tier loses content.

---

## 10. Brief amendments for the landing only

Paste the block below into `docs/04-ui-ux-brief.md` after "Conflicts resolved" and before "Open items", and mark open item 2 as resolved by [02-design-system.md](./02-design-system.md) section 1.2. The wording is taken from 02 section 10 with two edits, both marked in review items: the file path follows the `(landing)` route group, and A7 follows the DOM poster decision. If the owner rejects either decision, restore the original wording in 02.

```markdown
## Landing amendments (route `/` only)

The signed-in app and every other route keep this brief exactly. The amendments below apply to the landing page
(`web/app/(landing)/page.tsx` and `web/components/landing/**`) and are scoped by the `.lp` class. Landing-only
tokens are declared in `web/components/landing/landing.css`, not in `globals.css`.

| # | Brief rule | Landing amendment | Why |
| --- | --- | --- | --- |
| A1 | Display 64px / 1.0, -0.448px | `--type-display-landing`: clamp(3rem, 1.25rem + 5.6vw, 6.5rem), 48 to 104px, line height 0.95, -0.025em | Award-scale hero; weights stay 400 and 500 so size carries hierarchy |
| A2 | Heading large 42px | `--type-heading-landing` 36 to 56px; prices use `--type-numeral-landing` 40 to 64px | Entry titles must hold against the receipt lane |
| A3 | Motion is utility only: 300ms ease-out on colour | Adds the named moves ink, post, print, feed, tear, travel, hand-off and retract, with named curves, scroll-linked scene poses and kinetic type. Every move ends | Locked decision: expressive landing |
| A4 | Page sections fade in once | Sections do not fade. Entry rules draw, titles below the fold rise, body text has no entrance | Fade-up on everything is a cliche |
| A5 | No springs, no infinite or ambient animation | The ban is lifted for the landing and deliberately unused: no springs, no overshoot, no loops. Pointer tilt is critically damped and reactive only | "Every motion ends" is the brand idea |
| A6 | No 3D hero art; no hero imagery in v1 | One WebGL receipt object in the hero lane and through the story | Locked decision: exactly one WebGL centerpiece |
| A7 | Not used: 3D renders | A DOM replica of the WebGL scene's first state is its loading and tier-0 state; no raster render ships on the page | Keeps LCP on text |
| A8 | Real screenshots, not mockups | Interactive DOM demos are allowed when each carries a SAMPLE chip, a dashed edge and synthetic names. Real screenshots remain required wherever an image claims to be the app | Pre-launch honesty |
| A9 | Mint Frost is one optional band | Still one band (entry 05). Mint Frost is also the receipt paper in every receipt | The receipt and the band are one paper |
| A10 | Circuit Border never carries meaning | Unchanged on Void and Ground (the dashed sample edge is always accompanied by text). On the Mint band only, `#485346` is `--on-mint-muted` for secondary text and rules (6.8:1) | Passes AA on mint |
| A11 | Lime roles: the logo and the navbar sign-up | The landing logo is Phosphor White. Navbar "Start free" is lime only when it owns lime custody | A permanently lime logo or CTA would break one lime element per viewport |
| A12 | Radii: 0px for icons and the logo only | 0px also for receipt paper, mint cells, posting squares, the signature box and the range thumb | Paper has square corners |
| A13 | Section rhythm 80px with a hairline top border | `--section-pad-landing`: 128px desktop, 96px tablet, 80px mobile. The divider is the entry rule with graticule ticks | Pacing and progress |
| A14 | Landing screen note: match card, proof points, steps | Hero right side is the receipt lane; match-card content moves into entries 02 and 03; order follows the one-application ledger | The narrative follows one application |
| A15 | `tabular-nums` for tables and counters | `tabular-nums slashed-zero` on all numerals | `$0.00` and `0 guessed` must be unmistakable |
| A16 | Touch targets at least 40px | 44px with 8px spacing | A tightening |
| A17 | Badge: lime fill for the one live state | No lime badges on the landing; "Most chosen" is removed | There are no customers yet to have chosen anything |
| A18 | Active (pressed): no transform | Unchanged; listed to confirm no press scale is added | Brief rule kept |
| A19 | Radii: 9999px only for the lime primary CTA, tags and link chips; Default button 12px | The five lime-custody buttons keep one 9999px pill shape, 48px height and 1px border in both states. The non-owner state is a Ground fill with a Phosphor White border, not a 12px Default button | A hand-over that changed radius would morph the shape; colour must be the only change |
| A20 | Status colours are defined for Void | On the Mint band, status words use `--on-mint-good #3d6b21`, `--on-mint-warn #8a5a00`, `--on-mint-bad #a3261c` (5.3, 5.0 and 6.2:1) | The brief's light status hexes fail on mint |
| A21 | Focus: 2px Phosphor White outline | On Mint Frost the outline is Void | Phosphor White is 1.1:1 on mint |
| A22 | Empty states use a dashed Circuit Border box | On the landing a dashed Circuit Border edge means "sample or not real yet", always with a SAMPLE chip or an equivalent text label | One meaning for the dashed line |
| A23 | Card padding 32px | Demo panels and cards use 20px below 768px | 32px leaves 264px of 328px at 360 |
| A24 | Link chips use the standard border | Claim chips (links) use a Fern Link border (6.9:1) instead of Circuit Border (2.6:1) | A link affordance must meet 3:1 |

## Clarifications that apply app-wide

| # | Clarification |
| --- | --- |
| C1 | Navbar link text is Moss 80, not Sage 60. Over a light band the navbar composite is `#3d4341`, where Sage 60 is 3.99:1. |
| C2 | Unspecified borders default to Circuit Border (a base rule overrides Tailwind 4's currentColor default). |
| C3 | Native form accents (`accent-color`) are Phosphor White, never lime and never the browser blue. |
| C4 | `::selection` is Void on Phosphor White. |
| C5 | h1 and h2 use Inter Tight 400 with `ss01`; h3 and h4 use Inter 500. The global `h1 to h4` weight-400 rule is removed. |
| C6 | Sage 40 (`--muted`, utility `text-faint`) is used on Void only. The legacy utility `text-muted` is migrated to `text-body` (Sage 60). |
| C7 | The logo glyph is a K (the mark in the repo), not an A. The mark has 0px radius and square linecaps. |
| C8 | Inter and Inter Tight both preload from the root layout (about 81 KB). |
```

---

## 11. What to review first

Most consequential first. Each item says what was decided, why it matters and what the alternative is.

| # | Decision or risk | Why it matters | Proposed resolution |
| --- | --- | --- | --- |
| R1 | **Vanilla three instead of React Three Fiber.** Locked decision 1 says "Three.js / React Three Fiber". Every document builds on vanilla `three@0.186.1` behind a thin `Stage` component | Saves about 117 KB gzip and keeps one GSAP ticker driving the scene. If you meant R3F specifically, the WebGL budget (140 KB) and the frame loop change | Confirm vanilla three. R3F stays the documented fallback |
| R2 | **Page file moves to a `(landing)` route group.** Locked decision 2 names `web/app/(public)/page.tsx` | The URL is unchanged, but the folder differs from what you locked. It is the only clean way to wrap navbar and footer in `.lp` without affecting `/pricing` | Confirm the move |
| R3 | **Lime custody and a Phosphor White logo (A11, gate G5).** The navbar "Start free" is lime only when no in-page CTA is visible | Conversion: the sign-up button is not always the brightest thing on screen. Brand: it is the only way to keep one lime element per viewport | Confirm; if rejected, the creative direction's 3.3 fallback adds a `logo` custody value with no structural change |
| R4 | **Prerequisites P1 to P4 block shipping.** P1 needs the owner of `server/src/services/fit.ts` | Without P1 entry 02, the receipt feed and the most distinctive moment do not ship | Assign P1 and P3 owners before Phase 0 |
| R5 | **Poster: DOM or AVIF.** 05, 03 and the hero spec use a DOM poster; 04 still specifies an 816 by 1648 AVIF (40 KB) and a poster render script, and 02 lists one poster raster | An image poster is larger than the H1 and can become the LCP element | Adopt the DOM poster everywhere and delete the AVIF rows from 04 and 02 |
| R6 | **Strings in `shared/src/plans.ts` that the page renders verbatim.** "Failed submits refunded automatically" (contradicts AC10, nothing is ever charged); "checked every few minutes" (docs say 5 minutes); Max tagline "For urgent searches: OPT clocks, layoffs." (adds a second clock); feature lines whose build status is unknown | Truth rule: the pricing cards would print things the docs do not support | Fix at the source before Phase 1; proposed wording is in 06 section 22 |
| R7 | **Gates G3 and G4.** Build status of the extension, cloud applier, review mode, receipts, reply tracking and the offer pause; whether "No card" is true | Decides whether entries 05 and 06 ship with "(in beta)" wording, and whether the offer-pause sentence appears | Provide status; until then the gated wording ships |
| R8 | **Page length.** Measured heights overshoot targets in entries 02 (about 250vh against 150vh), 03 (147 against 120), 07 (267 against 200) and 08 (97 against 80); total about 1,650vh | A long page risks drop-off before pricing. Nothing breaks technically, since no pin depends on these lengths | Accept, or ask the copy owner to cut entries 02 and 07 |
| R9 | **The pinned stage at entry 05.** The most complex sequence (tear, travel, cross-fade, mint expansion) and the only pin | Highest build and QA cost; also the riskiest on Safari | Keep, with the documented short-window and fit-check fallbacks to normal flow |
| R10 | **Tier 0 at 1024px and wider in entry 05.** 04 says normal flow with no pin; 05 (D7) and the entry 05 spec keep the CSS pin with a DOM-only stage | The tier is known only after idle, so removing a pin then would shift the page | Follow 05 and the entry 05 spec; update 04 section 8.3 |
| R11 | **Raised JS budgets.** 20 KB below 1024px and 80 KB at 1024px and wider at tier 0, against the creative direction's 15 and 70 KB | The original figures did not include the demos, calculator and stores | Accept |
| R12 | **Claim chip accessible names fail WCAG 2.5.3 Label in Name.** "See entry 02, Fit gate" does not contain the visible "see 02" (raised by entries 01, 08 and 09) | Accessibility audit failure | Change `shared.claimChipName` to "See {NN}, {title}" |
| R13 | **Timing conflicts between 03 and 04.** `sq-feed-stop` 3,920ms vs 4,560ms (entry 02 reconciled at 4,440ms, under the 4,500ms cap); `sq-fresh` 1.7s vs 3,160ms (entry 10 follows 04); approval stamp 1,440ms vs 1,960ms (entry 04 follows 04); canvas fade-out at entry 07 top 85% vs 70% (entries 06 and 07 use 70%) | Implementers would build different timelines | Accept the section specs' choices and update 03 and 04 |
| R14 | **Naming drift between 04 and 05.** Attribute `data-stage-tier` vs `data-tier`; session keys `kairos-stage-tier` vs `kairos:landing:tier:v1`; line ids `l04-approved` vs `04approved`; files `print.ts` and `tier.ts` vs `print-texture.ts`, `sampler.ts` and `capabilities.ts` | Breaks the interfaces between documents | 05 (architecture) is canonical for names; update 04 section 13 |
| R15 | **Entry 05 citation chip "cites #07, #11"** conflicts with entry 03's sample facts (`#07, #12` and `#11, #14`) | A truth-lock demo with an inconsistent citation undermines the point | Align entry 05 to entry 03's data |
| R16 | **Hero H1 on a 390px phone** may break into three lines | The CTA must stay above the fold at 375 by 667 | The hero spec measured the CTA bottom at 584px and keeps the 48px floor; the 44px fallback is documented in 02 Q4 |
| R17 | **Smaller cross-document fixes:** navbar button 44px vs A19's 48px; `scroll-margin-top` 128px below 1024px once the tape exists; ledger rail needs a Carbon Veil backing and Moss 80 numbers over mint; row 03 settles when entry 04 posts, not at the click; `LimeCustody` drops Approve once approved | Each is small, and each is flagged in its section spec | Accept as flagged |

---

## 12. Status

| Item | State |
| --- | --- |
| Creative direction, design system, motion system, WebGL scene, architecture, copy deck | Drafted |
| 14 section specs | Drafted, all present |
| Owner review | **Next step** (this document) |
| Per-section critics | Pending, after the owner review |
| Five-lens audit (accessibility, performance, brand and truth, Awwwards juror, coherence) | Pending, after the critics |
| Prerequisites P1 to P4 | Not started |
| Gates G1 to G9 | Open |
| Implementation | Not started; no code written, no tests run |

---

## 13. Open questions for the product owner

1. Confirm vanilla three in place of React Three Fiber (R1).
2. Confirm the `(landing)` route group (R2).
3. Confirm lime custody and the Phosphor White landing logo, or choose the `logo` custody fallback (R3, G5).
4. Who owns P1 (the fit sample generator in `server/`) and P3 (`creditsPerInvoice` in `shared/src/plans.ts`)?
5. Approve the `plans.ts` string fixes: "Failed submits cost nothing" (or "Failed submits are never charged"), "checked every 5 minutes", and "For searches that cannot wait." for the Max tagline. These are shared with `/pricing`.
6. G3: which features are live: Chrome extension, cloud applier (Pro and Max), review mode, receipt contents, reply tracking, the offer pause? Should plan feature strings carry "(in beta)"?
7. G4: is "No card" true for the free path? It is omitted everywhere until confirmed.
8. Accept the on-mint status colours (A20) and the Fern Link border on claim chips (A24)?
9. Keep custody buttons as 9999px pills in both states (A19)?
10. Moss 80 navbar links apply to the app navbar too (C1). Accept?
11. "Monthly only" on the Free card at Weekly and Quarterly can read as if Free needs a monthly plan. Keep the deck wording?
12. Entry 06 inbox status words are neutral Phosphor White, not status colours, so a green "Offer" does not imply an outcome. Accept?
13. Entry 08: rows 2 to 4 have demonstrations but no claim chip because the direction fixes chips at six. Add chips, or keep six?
14. Outside the landing: `CtaBand` says "No card." and `HowItWorksSteps` says "Upload your resume."; both conflict with G4 and paste-only v1. Fix in P2?
15. `/pricing` shows two lime elements in one viewport (navbar CTA and "Choose Pro"). It needs its own decision under the brief.
16. G6 (side-by-side review against Modal, Lando Norris and Tsenta), G7 (five-person ten-second comprehension test) and G8 (legal review of comparison wording and policy pages): who runs them and when?

---

## 14. File index

### System documents

| File | Contents |
| --- | --- |
| [01-creative-direction.md](./01-creative-direction.md) | Concept, Kairos Marks M1 to M10, motion grammar, entries, amendments A1 to A17, prerequisites P1 to P4, gates G1 to G8 |
| [02-design-system.md](./02-design-system.md) | Tokens, fonts, type scale, grid, surfaces, lime checklist, marks geometry, contrast table, amendments A1 to A24 and C1 to C8, questions Q1 to Q11 |
| [03-motion-system.md](./03-motion-system.md) | Principles, easing and duration tokens, presets, scroll conventions, sequences, reduced-motion matrix, QA checklist |
| [04-webgl-scene.md](./04-webgl-scene.md) | Scene graph, geometry, GLSL, print texture, camera, state table, tiers, loading, memory, frame budgets, tests |
| [05-architecture.md](./05-architecture.md) | Folders, component tree, dependencies, chunks, runtime, detection, canvas mounting, P2 migration, budgets, testing, risks, build order |
| [06-copy-deck.md](./06-copy-deck.md) | Every string keyed by section id, receipt lines, live regions, FAQ, headline widths, lime by viewport, copy lint, open questions |

### Section specs

| File | Section |
| --- | --- |
| [sections/01-navbar.md](./sections/01-navbar.md) | Navbar |
| [sections/02-ledger-rail.md](./sections/02-ledger-rail.md) | Ledger rail and receipt tape |
| [sections/03-entry-00-hero.md](./sections/03-entry-00-hero.md) | Entry 00, Hero |
| [sections/04-entry-01-reported.md](./sections/04-entry-01-reported.md) | Entry 01, Reported |
| [sections/05-entry-02-fit-gate.md](./sections/05-entry-02-fit-gate.md) | Entry 02, Fit gate |
| [sections/06-entry-03-truth-lock.md](./sections/06-entry-03-truth-lock.md) | Entry 03, Truth lock |
| [sections/07-entry-04-approve.md](./sections/07-entry-04-approve.md) | Entry 04, Approve |
| [sections/08-entry-05-send-receipt.md](./sections/08-entry-05-send-receipt.md) | Entry 05, Send and receipt |
| [sections/09-entry-06-replies.md](./sections/09-entry-06-replies.md) | Entry 06, Replies |
| [sections/10-entry-07-billing.md](./sections/10-entry-07-billing.md) | Entry 07, Billing |
| [sections/11-entry-08-compare.md](./sections/11-entry-08-compare.md) | Entry 08, Compare |
| [sections/12-entry-09-questions.md](./sections/12-entry-09-questions.md) | Entry 09, Questions |
| [sections/13-entry-10-start.md](./sections/13-entry-10-start.md) | Entry 10, Start |
| [sections/14-footer.md](./sections/14-footer.md) | Footer and colophon |

### Concepts and research

| File | Contents |
| --- | --- |
| [_concepts/concept-the-ledger.md](./_concepts/concept-the-ledger.md) | Winning concept |
| [_concepts/concept-signal-from-noise.md](./_concepts/concept-signal-from-noise.md) | Runner-up |
| [_concepts/concept-kairos-moment.md](./_concepts/concept-kairos-moment.md) | Third |
| [_concepts/concept-truth-lock.md](./_concepts/concept-truth-lock.md) | Fourth |
| [_research/facts.md](./_research/facts.md) | Facts sheet drawn from the PRD, app flow, brief and pricing docs |
| [_research/code-inventory.md](./_research/code-inventory.md) | Existing web code inventory |
| [_research/stack-feasibility.md](./_research/stack-feasibility.md) | Stack measurements (three vs R3F, GSAP, Lenis) |
| [_research/awwwards-references.md](./_research/awwwards-references.md) | Award references |
| [_research/competitor-landings.md](./_research/competitor-landings.md) | Competitor landing review |

### Upstream product documents

[docs/01-prd.md](../../../01-prd.md), [docs/03-app-flow.md](../../../03-app-flow.md), [docs/04-ui-ux-brief.md](../../../04-ui-ux-brief.md), [docs/DESIGN.md](../../../DESIGN.md), [docs/pricing.md](../../../pricing.md).
