# Awwwards reference research for the Kairos landing page

Research date: 2026-10-15. Method: live fetches of Awwwards pages (evaluation system, Sites of the Day archive pages 1 and 2, Sites of the Month, annual winners, 15 individual site pages), live fetches of several winning sites, official documentation (Lenis, GSAP, React Three Fiber, Next.js, web.dev, W3C WCAG 2.2), and web searches for trend material.

Evidence labels used throughout:

| Label | Meaning |
|---|---|
| Verified | Read directly on an Awwwards page, an official doc, or the live site during this research. |
| Reported | Stated by a third-party article. Treat as likely but not confirmed. |
| Reconstruction | My engineering design of how to achieve an effect that Awwwards lists only by name or tag. It is not a description of the winner's real code. |
| Unverified | A claim found online that I could not confirm. Do not rely on it. |

Important limit: Awwwards site pages list scores, tags, technologies and named "highlighted elements", but they do not explain implementation. Every "technique to borrow" below therefore separates what was verified from the reconstruction that makes it buildable.

---

## 1. Jury criteria, weights and what juries reward or punish

### 1.1 Official scoring (Verified, awwwards.com/about-evaluation)

| Criterion | Weight | Notes |
|---|---|---|
| Design | 40% | Largest share. |
| Usability | 30% | Second largest. Performance, responsiveness and accessibility are commonly read as part of it (interpretation by third parties, not official wording). |
| Creativity | 20% | |
| Content | 10% | |

Mechanics (Verified):

- At least 18 jurors score each approved site. The 3 scores furthest from the average are removed automatically, so a single hostile or ecstatic score cannot decide the outcome.
- Voting lasts 5 days. Only validated PRO users count among user votes. A high jury score plus at least 10 PRO votes can win Site of the Day before the 5 days end.
- Honorable Mention: jury score of 6.5 or more.
- Site of the Day (SOTD): highest scoring sites of the day. Awwwards states no numeric cutoff.
- Developer Award: SOTD winners are reviewed by a developer jury. A score above 7 earns the award. The dev jury scores six sub-criteria: Semantics/SEO, Animations/Transitions, Accessibility, WPO (web performance optimisation), Responsive Design, Markup/Meta-data (Verified from the sub-scores printed on each site page).
- Site of the Month: the eight highest scoring sites of a month are re-reviewed, and user votes carry extra weight.
- Site of the Year: all Sites of the Month are nominated plus others; announced in February of the next year.
- Mobile Excellence badge: Honorable Mention sites are checked by a mobile expert using WebPageTest, Lighthouse and PageSpeed Insights plus manual checks, across the home page and two random pages, scored on Mobile Friendliness, Performance, Best Practices/PWA and Usability. The pass mark is 70/100 (Reported, from the search summary of Awwwards and Google Developers Blog pages; the Awwwards mobile-award page itself did not print the criteria when fetched).

### 1.2 What the real scores look like (Verified, computed from 16 SOTD pages I fetched)

Sample: Cerebrium, Heron AI, Moto Finance, Butter, Sharplink, Ai in Design Report, Neutomni, SSTR, Lidar Drone Scanning, Milledollars, Oryzo AI, Terminal Industries, MindMarket, Navigate, Lando Norris, Messenger. This is a convenience sample of sites relevant to Kairos, not a random sample.

| Measure | Result in sample |
|---|---|
| Overall SOTD score range | 7.17 (SSTR) to 8.18 (Lando Norris, 2025 Site of the Year). Median about 7.6. |
| Mean Design | 7.66 |
| Mean Creativity | 7.75 |
| Mean Content | 7.62 |
| Mean Usability | 7.40 (lowest of the four in this sample) |
| Mean dev Accessibility | 6.90 (range 6.00 to 7.60; no site above 7.60) |
| Mean dev Markup/Meta-data | 7.00 |
| Dev Animations/Transitions | Always the strongest or near strongest sub-score, 7.20 to 9.00 |
| Awwwards user (PRO) average vs jury | Users scored 8.42 to 9.56 where printed, versus 7.4 to 7.9 for the jury. Users reward spectacle more than the jury does. |
| Spread of individual juror overalls on one site | Up to about 3 points (Messenger 5.60 to 9.30; Lando Norris 7.00 to 10.00). Polarising work still wins because extremes are trimmed. |

Reading for Kairos:

1. Usability is the weakest score even on winning sites. A page that is clearly usable on a mid-range phone beats a spectacular page on the 30% criterion, where the average winner is only 7.40.
2. Accessibility is the weakest developer sub-score on almost every winner (mean 6.90). A real, visible accessibility story (reduced motion, keyboard path, contrast, pause control, semantic markup) is an uncontested differentiator for the Developer Award and for the 30% usability criterion.
3. Content (10%) scores rise with real, specific, product-grounded copy. Terminal Industries and Cerebrium score 7.57 and 7.55; the tone of both is concrete numbers and short declaratives.
4. Webflow builds are accepted (Heron AI, Moto Finance, Neutomni, Lando Norris all Webflow with custom GSAP/Three code). A Next.js build is fine; what counts is custom craft, not the platform.

### 1.3 What juries reward and punish (mixed evidence)

| Statement | Source and label |
|---|---|
| Navigation understandable by a first-time visitor in about 3 seconds | utsubo.com guide, Reported |
| A hero that hitches near 40fps "reads as broken"; jank costs more usability than animation earns creativity | hontran.dev, Reported (author is a developer who also sells services) |
| Rewarded: custom type, intentional palette, hover and transition micro-detail, one signature moment, scroll used to control pacing, real copy | utsubo.com, Reported |
| Penalised: template or page-builder look, desktop-first design with weak mobile, slow load, stock photography, lorem ipsum or "coming soon", machine-translated copy, inner pages that do not match the home page, creativity that undermines usability | utsubo.com, Reported |
| Award-winner performance targets: LCP under 1.5s, CLS under 0.05, INP under 100ms, page weight under 3MB, sustained 60fps | utsubo.com, Reported (vendor self-reporting; the official web.dev "good" thresholds are looser: LCP 2.5s, INP 200ms, CLS 0.1, Verified) |
| Mobile should be designed in parallel, tested on real mid-range devices, with touch replacing hover on purpose | utsubo.com, Reported |
| "Default Lenis scroll" is a common creative trope that jurors discount | hontran.dev, Reported |
| Sites often need "mid-to-high 8s" for SOTD | hontran.dev, Unverified. The fetched data contradicts it: 15 of 16 sampled SOTD winners scored below 7.95 overall. |
| "61 percent of Q1 2026 SOTD winners are immersive 3D", "Three.js powers 29 of 47 winners", "judges now evaluate HTML fallbacks" | digitalstrategyforce.com, Unverified (the article's sources do not support its numbers). Not to be cited in the specification. |

Sampled technology mix (Verified from site pages): 8 of 16 list WebGL or Three.js (Cerebrium, Oryzo, Lando Norris, Messenger, Butter, Lidar Drone, Sharplink, Moto Finance); 10 of 16 list GSAP; 4 of 16 are built on Webflow; 2 use Vue; Terminal Industries (CSS, Vue, Vercel; dev score 7.89) has no WebGL at all. WebGL helps Creativity scores (Oryzo 8.35, Lando 8.71, Messenger 8.23) but is not required to win.

---

## 2. Fifteen 2025 and 2026 winners and the one technique to borrow from each

All are Awwwards Site of the Day unless stated. Scores are Verified from the site's Awwwards page. "Technique" separates what was observed from the reconstruction.

| # | Site and URL | Award and scores | Why it is relevant |
|---|---|---|---|
| 1 | Cerebrium, https://cerebrium.ai/ | SOTD 2026-09-10, 7.39 overall; Dev Award 7.50 (Accessibility 7.60, Responsive 8.20, Animations 8.20, WPO 7.00) | AI infrastructure, dark with WebGL, several highlighted elements are interactive data or product UI (WebGL globe, pricing calculator) |
| 2 | Lidar Drone Scanning, https://drone.riotters.com/ | SOTD 2026-10-06, 7.68; Dev 7.34 (Accessibility 7.20) | Real-data point cloud in WebGL, Next.js, near-monochrome palette |
| 3 | Oryzo AI, https://oryzo.ai/ | SOTD 2026-04-13, 7.86; Site of the Month Apr 2026; Dev 7.87 (WPO 8.60, Animations 8.60) | The 2026 reference for one 3D object carried through a whole scroll story |
| 4 | Lando Norris, https://landonorris.com/ | SOTD 2025-11-17, 8.18; Site of the Year 2025; Dev 7.58 | Lime #D2FF00 on near-black #111112, the closest palette precedent to Kairos |
| 5 | Messenger, https://messenger.abeto.co/ | SOTD 2025-11-10, 7.92; Developer Site of the Year 2025; Dev 8.21 (WPO 8.80, Animations 9.00, Accessibility 7.60) | WebGL plus WebSockets with the best performance score in the sample |
| 6 | Terminal Industries, https://terminal-industries.com | SOTD 2025-09-03, 7.68; Site of the Month Sep 2025; Dev 7.89 | B2B SaaS, no WebGL, built on CSS, Vue and Vercel |
| 7 | Heron AI, https://heronaiapp.com/ | SOTD 2026-10-12, 7.70; Dev 7.01 (Accessibility 6.80) | An AI agent that acts only on approval; closest product analogue to Kairos |
| 8 | Butter, https://www.butter.video/ | SOTD 2026-09-28, 7.50; Dev 7.22 (Animations 8.20) | AI-era product site, WebGL, React and p5.js, product UI as the page |
| 9 | Moto Finance, https://www.moto-card.com/ | SOTD 2026-09-24, 7.30; Dev 7.20 | Fintech, Webflow, GSAP and Three.js |
| 10 | Sharplink, https://www.sharplink.com/ | SOTD 2026-08-27, 7.38; Dev 7.42 (WPO 7.80) | Institutional finance by Studio Freight, the makers of Lenis |
| 11 | Navigate, https://nvg8.io/ | SOTD 2025-04-16, 7.93; Site of the Month Apr 2025; Dev 7.67 | Data platform with "Pause Loops" named as a highlighted element |
| 12 | MindMarket, https://mindmarket.com/ | SOTD 2025-12-29, 7.85; Site of the Month Dec 2025; Dev 7.55 | Scroll storytelling with stacking cards |
| 13 | Ai in Design Report 2026, https://stateofaidesign.com/ | SOTD 2026-08-26, 7.40; Dev 7.23 | AI subject matter, data told as editorial charts |
| 14 | SSTR Friction Reduction, https://sstr.tech/en/ | SOTD 2026-08-16, 7.17; Dev 7.58 (Accessibility 7.00, WPO 7.80) | Technical B2B, Astro with GSAP, minimal and exact tone |
| 15 | Neutomni, https://neutomni.com/ | SOTD 2026-10-13, 7.38; Dev 7.12 (Accessibility 6.40, the lowest in the sample) | Pricing animation as a highlighted element; also a caution about accessibility |

### 2.1 Technique detail per site

**1. Cerebrium: the transparent pricing calculator**

- Verified: the pricing page has a calculator headed "Transparent Pricing". Inputs: number of requests per month, average runtime in seconds, hardware (CPU only through H200/B200), GPU count, vCPUs, memory. Outputs: an estimated monthly cost and a per-second breakdown for GPU, CPU and memory with a total rate per second. The copy says "Only pay for what you use". The home page uses short declarative headlines with real numbers (2 to 4 second cold starts, 2,500+ GPUs).
- Borrow for Kairos: a "receipt calculator" in the pricing section built only from `docs/pricing.md` math. Inputs: plan (Starter $19, Pro $39, Max $79), billing cadence (weekly, monthly, quarterly), applications submitted. Outputs as ledger rows: plan price, applications included, cost per submitted application at full use ($0.048, $0.033, $0.026), and "failed submissions: $0.00". The calculation is a pure function with no network call. Numbers use tabular figures; a result change tweens over 240ms with `cubic-bezier(0.22, 1, 0.36, 1)`. Respect reduced motion by setting the value instantly.
- Why it earns points: it is proof by mechanism, which matches the "no invented metrics" rule.

**2. Lidar Drone Scanning: real units and confidence inline**

- Verified: the page text carries specific measured claims ("up to 240,000 pts/s", "plus or minus 2 cm", "raw data to deliverable in under 20 minutes") and sample risk cards that print their own confidence ("87% confidence", "tracked at 3 cm per week"). A content switcher swaps four use cases (Energy, Infrastructure, Industry, Geospatial). Technologies: WebGL, Three.js, Next.js. Palette #dfe5e8 and #28363e.
- Borrow for Kairos: the WebGL centerpiece is a field of points where each point is a job posting. On scroll, points sort into "kept" and "dropped" and each one can show a written reason, for example "Title is more senior than you asked for" (this exact reason string exists in `docs/01-prd.md`). The data is a small fixed array in the repo, and the number of kept points is a computed result, not an invented statistic.
- Reconstruction: use one `THREE.Points` or an `InstancedMesh` of about 1,200 small quads on desktop and about 400 on mid-range phones; a per-instance attribute `state` (0 pending, 1 kept, 2 dropped) drives position and opacity in the vertex shader from one `uProgress` uniform, so no per-frame JavaScript per point is needed.

**3. Oryzo AI: one object persisting across sections, with a 3D to 2D to 3D hand-off**

- Verified: highlighted elements are "3D to 2D to 3D Transition", "Reveal Transition", "Gallery Transition", "WebGL Sketches Interaction" and "Footer Interactive Particles". Technologies: WebGL, Three.js, GSAP. The page is a deadpan single story: sincere intro, escalating absurdity, a reveal in the footer that the product does not exist. It ends with an explicit disclaimer. Lusion's blog says the seamless transitions between very different layouts were the hardest part, especially responsiveness (Verified, BTS Part 1 text). Lusion built it with Houdini and Redshift for the renders (Reported, BTS Part 2 summary).
- Do not copy: the fake reviews, fake ratings and fake persona testimonials. They work only because the page is satire. Kairos has a hard "no invented proof" rule.
- Borrow for Kairos: the hand-off mechanism. The single object (a résumé page or ledger slip) stays alive between sections, moving between a world-space pose and a slot inside the DOM layout.
- Reconstruction: for each section place an empty `<div data-slot="resume-A">`. On resize and on `ScrollTrigger.refresh`, read `getBoundingClientRect()`, convert the rectangle to normalised device coordinates, and unproject to a world position and scale at the object's depth using the camera. During the scroll range between two slots, mix transform A to transform B with `smoothstep`, and rotate from the 3D pose to `rotation = (0,0,0)` when arriving at a 2D slot so text on the object is readable and the object can be hidden from the accessibility tree while the real DOM text next to it stays authoritative.

**4. Lando Norris: lime on near-black with separate mobile and desktop moments**

- Verified: the palette is #D2FF00 and #111112. SOTD scores: Design 8.12, Usability 7.90 (highest usability in the sample), Creativity 8.71, Content 8.18. Two "Great element" highlights are credited, one from the mobile layout and one from the desktop layout. Platform Webflow Enterprise with GSAP and WebGL. Reported stack: GSAP ScrollTrigger and SplitText, three.js, Rive, Lenis, Taxi.js (Colorlib and the Lenis showcase).
- Borrow for Kairos: design the mobile hero as its own composition. The jury credited mobile as a separate great element, and Usability was the highest score in the sample. For Kairos that means the phone version of the centerpiece is not the desktop canvas shrunk: it is a vertical composition with a lower point count and a static first frame.
- Caution: this is the closest palette precedent (acid lime on near-black). The Kairos signature motif must therefore differ in form (ledger and receipt geometry, fact-citation chips), not only in hue.

**5. Messenger: configuration UI that changes the live scene**

- Verified: highlighted elements are "Character Navigation", "NPCs" and "Character Configuration" and one mobile "Great element". Technologies: Three.js, WebGL, WebSockets. Dev scores WPO 8.80, Animations 9.00, Responsive 8.40.
- Borrow for Kairos: the interactive "fit gate" demo. Three hard-filter controls (seniority, work authorisation need, location) change the scene live. Choosing "needs sponsorship" drops the points whose posting says it does not sponsor, with the reason shown. It uses real filter types from `docs/01-prd.md`.
- Reconstruction: controls are native `<select>` and radio inputs so keyboard and screen readers work. A change sets a target state array; the shader moves each point to its kept or dropped position over 700ms using an `easeOutCubic` curve.

**6. Terminal Industries: CSS-only staggered line reveal, and a calculator with a sample result**

- Verified: dev score 7.89 with Accessibility 7.00 and WPO 8.20, technologies CSS, Vue and Vercel only. The hero tagline reveals line by line. A "Yard Efficiency Calculator" shows a sample output with an email capture for a custom analysis.
- Verified weakness to avoid: its metrics are large percentages without stated baselines ("50% more throughput", "85% faster") and the page gives two different accuracy figures (99% in one place, 50% improvement in another). Kairos must show only the pricing math and mechanisms it can derive from the docs.
- Borrow for Kairos: the line-by-line reveal built without any JavaScript animation library. Each line is a `span` inside an `overflow: hidden` wrapper, with `transform: translateY(105%)` resolving to `0` using a CSS animation, `animation-delay: calc(var(--i) * 70ms)`, `duration 700ms`, `cubic-bezier(0.22, 1, 0.36, 1)`. The text is present in HTML from the first byte, so it is the LCP element and is readable without JavaScript. Under `prefers-reduced-motion: reduce` the animation is removed and lines show at once.

**7. Heron AI: the hero is the mechanism, and approval is the stated product rule**

- Verified (live): the hero is an interactive floor plan with the instruction "Click and drag your mouse to see violations" and code callouts such as IBC 1015.3. Copy states: "Every action is shown to you first so nothing happens without your say-so." Sequence: Observe, Advise, Act, Learn. Technologies: GSAP, Webflow, Canvas API. Scores: Creativity 7.85, Usability 7.48, Accessibility 6.80 (weak).
- Weakness to avoid: its copy says both "edits automatically" after approval and "shown to you first" per action, without saying which.
- Borrow for Kairos: a drag-to-reveal threshold interaction. A stack of eight sample job cards; dragging a "fit line" across them marks cards below the line as dropped and prints a reason chip. Make it keyboard-operable with a native `<input type="range">` with step 1 to 10, an `aria-valuetext` such as "Showing 4 of 8 jobs, 4 dropped", and a polite live region for the count. Pointer drag is the enhancement, the range input is the base.

**8. Butter: the product interface is the page**

- Verified: tags WebGL, React, p5.js, Filters and Effects. Highlighted elements are Footer, Navigation, Timeline and Home, all shown as video. Dev Animations 8.20, Accessibility 6.60.
- Borrow for Kairos: use the scroll progress itself as a visible ledger rail. A narrow fixed rail at the viewport edge shows entries numbered like ledger lines (`01 Fit gate`, `02 Truth lock`, `03 Approval`), with the current section highlighted. It replaces a generic progress bar and doubles as navigation (anchor links).
- Reconstruction: each entry is an `<a href="#section">`; the active state is set by `IntersectionObserver` with `rootMargin: "-45% 0px -45% 0px"`. The rail is hidden below 1024px, where a bottom sheet menu replaces it. The evidence is only the highlighted element names, so this is an inference.

**9. Moto Finance: ambient live clocks as quiet proof of "always running"**

- Verified (live source): the header shows live clocks for four time zones (CEST, GST, EDT, AEST). The pricing panel shows real numbers ($2,500 annual or $250 monthly). Technologies GSAP, Three.js, Webflow. Weakness: the page source shows a typo ("Transaction Successfull") and no `prefers-reduced-motion` reference.
- Borrow for Kairos: a small clock motif that supports the "kairos, the right moment" idea. A footer or header line showing the visitor's local time and the time in a second zone, using `Intl.DateTimeFormat` with `timeStyle: "short"`. It updates once per minute (not every second), is `aria-hidden="true"`, and does not claim anything about product behaviour. Do not claim the product sends applications at a particular time unless `docs/` confirms it.

**10. Sharplink: 3D confined to page headers, on-demand rendering**

- Verified: highlighted elements "3D Page Headers", "Home Page Scroll", "Footer Animation", "Team Modal". Technologies GSAP, Three.js, Vue. Dev WPO 7.80, Animations 7.80. Studio Freight is the maker of Lenis.
- Borrow for Kairos: keep WebGL out of body copy and tables. The 3D scene lives in the hero band and the footer only; mid-page content is flat DOM. Render with `frameloop="demand"` in React Three Fiber and call `invalidate()` from the scroll handler so the GPU is idle when the user is reading. Confirmed in the React Three Fiber scaling docs (Verified).

**11. Navigate: "Pause Loops" as a designed feature**

- Verified: "Pause Loops" (three videos) is a highlighted element, alongside Character Animations and Custom Icons. Dev Accessibility 6.60 despite that.
- Borrow for Kairos: any ambient motion longer than 5 seconds gets a visible pause control, as required by WCAG 2.2.2 Pause, Stop, Hide (Verified in the W3C Understanding document: content that starts automatically, lasts over 5 seconds and shows beside other content needs a mechanism).
- Reconstruction: a `<button aria-pressed>` labelled "Pause motion" at the corner of the centerpiece. On press, set `timeScale` to 0 with `gsap.to(tl, { timeScale: 0, duration: 0.6, ease: "power2.out" })` so the loop settles gently instead of freezing, then stop invalidating the canvas. Persist the choice in `localStorage` inside try/catch.

**12. MindMarket: cards that stack as the user scrolls**

- Verified: highlighted elements "Cards stack on scroll", "Path scroll with Rive animations", "Playful hover interaction". Technologies GSAP, Figma, DatoCMS. Two-colour palette #8ED462 and #F5E211. Design 8.09.
- Borrow for Kairos: the "how it works" steps as stacking receipts. Each step card is `position: sticky; top: calc(96px + var(--i) * 20px)`. The card behind scales to `0.96` and fades to `0.7` brightness as the next one covers it.
- Reconstruction with no JavaScript: use CSS scroll-driven animation (`animation-timeline: view()`) as the progressive enhancement and plain stacked cards in normal flow as the fallback inside `@supports not (animation-timeline: view())` and inside `prefers-reduced-motion: reduce`. Total pinned scroll length is kept to 3 cards times 70vh.

**13. Ai in Design Report 2026: charts as editorial objects**

- Verified: highlighted elements "Editorial Chart", "Editorial Charts (Stats)", "Chapters Header Animation". Built with Figma and Framer. Design 7.66 is the highest sub-score; Creativity 7.14 the lowest, so the win came from craft rather than spectacle.
- Borrow for Kairos: the pricing comparison drawn as one editorial SVG bar chart, with every bar labelled with its real value from `docs/pricing.md` (cost per application at full use: Starter $0.048, Pro $0.033, Max $0.026). Bars draw once, left to right, on first view (`scaleX` from 0 to 1 over 600ms, `transform-origin: left`), then stay static. The numbers are in text, not only in the graphic, and a visually hidden `<table>` repeats them. Publish competitor figures only if the user approves, because they are estimates in the docs.

**14. SSTR: islands of JavaScript on an otherwise static page**

- Verified: Astro, GSAP, Barba.js. Highlighted: Preloader, Barba.js transitions, Contact page. Dev WPO 7.80, Semantics/SEO 7.60, Markup 7.40 (the best markup score among the 2026 sites sampled). Description: "Editorial minimalism that speaks the engineer's language."
- Borrow for Kairos: the architecture. In Next.js App Router, every landing section is a Server Component by default and only three leaves are Client Components: the WebGL centerpiece, the calculator, and the motion/scroll provider. This keeps first-load JavaScript small, which supports WPO and Semantics scores. In Next.js, `next/dynamic` with `ssr: false` is allowed only inside a Client Component (Verified in the Next.js lazy-loading guide, last updated 2026-03-10), so the centerpiece needs a small client wrapper file that does the dynamic import.

**15. Neutomni: a pricing animation, and the accessibility warning**

- Verified: highlighted elements include "Pricing Animation", "Loader Animation", "CTA Animation". GSAP on Webflow. Creativity 7.69 but dev Accessibility 6.40, the lowest in the sample.
- Borrow for Kairos: the billing toggle (weekly, monthly, quarterly, from `docs/pricing.md`) switches prices with an odometer roll. Each digit sits in a fixed-height column and moves by `translateY` in 360ms with `cubic-bezier(0.22, 1, 0.36, 1)`. The column set is `aria-hidden`; a single visually hidden text node holds the final value, and a polite live region announces "Starter, $19 per month" once after the roll ends.
- Lesson: its high animation score did not rescue accessibility. Avoid unlabelled animated controls.

### 2.2 Supplementary reference (award not confirmed)

Razorpay Sprint26 (Awwwards case study, 2026-08-31, https://www.awwwards.com/razorpay-sprint26-the-future-of-payments.html). The page does not name an award, so it is not counted among the 15. It is the most relevant statement about trust and spectacle in fintech (Verified text): in-house team, two colours (#0039FF and #151515), more than 100 scroll and click triggers built as Rive state machines, Three.js for the spatial layer, and the line "When everything around a moment is calm, motion becomes meaningful." Borrow the principle: spectacle only in the one place where the page explains the mechanism, calm everywhere else. A Rive state machine that responds to input state (not only scroll position) is also worth considering for small product diagrams, but it adds a runtime and is outside the "one WebGL centerpiece" budget unless the specification allocates it.

---

## 3. 2026 trend signals and the clichés juries are tired of

Evidence here is weaker than in sections 1 and 2, because the trend articles found are mostly agency marketing. Each item carries a label.

### 3.1 Signals supported by the winners themselves (Verified in section 2 data)

| Signal | Evidence |
|---|---|
| Story-driven single objects and one signature moment, not many effects | Oryzo AI (Site of the Month), Lando Norris (Site of the Year), Messenger |
| The product or its data is the spectacle | Cerebrium pricing calculator and interactive globe, Lidar point cloud with confidence values, Heron interactive floor plan |
| Footer as a designed moment | The "Footer Design" tag or "Footer Animation" element appears on Heron AI, Sharplink, Neutomni, Oryzo (interactive particles), Butter and SSTR |
| Narrow, strict palettes of 1 to 2 colours | Lando Norris (lime and near-black), Neutomni (red and white), Razorpay (blue and near-black), Milledollars (one colour) |
| Editorial minimal tone with technical vocabulary | SSTR, Ai in Design Report, Terminal Industries |
| Rive and state-machine illustration beside WebGL | Lando Norris (reported), MindMarket, Razorpay |
| Dev jury rewards low-weight animation quality | Animations/Transitions is the top dev sub-score on almost every winner |

### 3.2 Signals reported by trend articles (Reported)

- The single floating 3D object in an otherwise static hero is described as dated (Buzz Interactive). A scroll-driven journey in which the object changes role is the stronger pattern, which agrees with Oryzo.
- Kinetic typography is "everywhere as a demo, rarely in production" and is hard on screen readers and crawlers when text is split into letters. Advice: use it in the hero only and keep the text readable without animation (StudioMeyer, an agency with a marketing motive; it labels its piece an editorial assessment).
- 3D needs optimised assets, a device budget and an accessible fallback (StudioMeyer). Showit claims extensive 3D slows sites without improving conversions; its 40 percent bounce figure has no source, so do not cite it.
- Bento layouts and dark mode keep winning; anti-grid brutalism (monospace, hairline borders, zero radius) rises as a counter-movement.
- Glassmorphism survives only in narrow uses such as navigation bars and modals.

### 3.3 Clichés to avoid on the Kairos landing

These mix verified observations from the winners with Reported opinions. I mark my own judgement where no source exists.

| Cliché | Basis |
|---|---|
| Default Lenis feel with fade-up on every element | Reported (hontran.dev: jurors discount "default Lenis scroll"); the third-party skill file the search surfaced also lists fade-up-on-everything. Use a deliberate scroll curve and reveal only what carries meaning. |
| Purple-to-blue aurora gradient backgrounds and neon glows | Reported by a tool author; also banned by the Kairos brief (no glow on text, lime only as a fill). |
| Bounce or spring overshoot on UI controls | Reported; the brief previously banned spring easing and the amendment applies only to the centerpiece. |
| Preloaders that only show a percentage counter | Reported (same skill file). The winners' preloaders (Neutomni, SSTR, Milledollars, Heron AI) are highlighted elements, so a preloader is not penalised in itself; a counter that hides content is. |
| Custom cursors on content pages | Awwwards' own cursor article counsels restraint and notes custom cursors do not work on touch (Reported). Kairos should not replace the system cursor. |
| Single floating hero object with no story | Reported (Buzz Interactive). |
| Stock photography, lorem ipsum, "coming soon" blocks | Reported as penalised (utsubo.com). Kairos uses real product screenshots, per `docs/04-ui-ux-brief.md`. |
| Large unsourced percentages (50 percent more, 85 percent faster) and fake reviews | Verified on Terminal Industries (numbers with no baseline, two inconsistent accuracy figures) and Oryzo AI (a 4.9 rating from 364 reviews that is satire). Both break the Kairos truth rule. |
| Horizontal scroll hijack used for ordinary text content | My judgement; no source. It fails keyboard and touch users and disrupts reading. |
| Marquees of logos for a pre-launch product | My judgement; Kairos has no customers to show. |

---

## 4. Preloaders, smooth scroll, cursor effects and reduced motion without hurting usability

### 4.1 Preloaders

What winners do (Verified): Neutomni, Milledollars, SSTR and Heron AI all have a preloader or loader listed as a highlighted element, so a well-made loader is rewarded.

What Kairos should do:

1. Do not gate the page. The headline, subhead and primary call to action are in server-rendered HTML and visible at first paint. Chromium LCP ignores elements with opacity 0 and elements that cover the full viewport (Verified, web.dev LCP article), so a hero that starts at `opacity: 0` until JavaScript runs, or a full-viewport canvas, either delays LCP or is never counted; the H1 and subhead should be the LCP element and must not be hidden.
2. The WebGL canvas loads after first paint. A static poster frame of the centerpiece (an AVIF or WebP at about 60 KB) shows first; when the 3D assets and shader compile finish, the canvas cross-fades in over 600ms. The loader is the poster itself, not a separate screen.
3. If a branded intro is wanted, make it a 900ms "ledger line draws" sequence on the first visit only (flag in `sessionStorage` inside try/catch), skipped on revisit, with a Skip control reachable by keyboard, and never longer than 1.5s. A loading animation that is the only content on the page is exempt from WCAG 2.2.2 (Verified), but it should still end quickly.
4. Under `prefers-reduced-motion: reduce`, `Save-Data: on`, or no WebGL support, skip the intro entirely.
5. Use `next/dynamic(() => import("./Centerpiece"), { ssr: false })` only inside a Client Component wrapper, because `ssr: false` is rejected in Server Components (Verified, Next.js docs). Load it when the hero is idle (`requestIdleCallback` with a 1.2s timeout fallback).

### 4.2 Smooth scroll

Verified facts from the Lenis README: Lenis wraps native scroll, so `position: sticky`, anchor links and keyboard scrolling keep working. `respectReducedMotion` is on by default and disables smoothing and makes programmatic scrolls instant when the user prefers reduced motion; scroll events still fire so WebGL and DOM stay in sync. Defaults: `lerp 0.1`, `duration 1.2` (ignored when `lerp` is set), `smoothWheel true`, `syncTouch false` (touch uses native momentum), `anchors false`. Known limits: no native CSS scroll-snap, smoothing stops over iframes, Safari caps at 60fps, nested scrollers need `data-lenis-prevent`.

Recommended Kairos configuration (design choice built on those facts):

| Setting | Value | Reason |
|---|---|---|
| `lerp` | 0.09 | Close to the default, slightly heavier, tuned by feel |
| `smoothWheel` | true | Desktop wheel only |
| `syncTouch` | false | Native momentum on phones and fewer iOS problems |
| `anchors` | true | Needed so in-page links like `#pricing` work |
| `autoRaf` | false | Drive Lenis from the GSAP ticker to have one clock |
| `respectReducedMotion` | true (leave default) | Do not override |
| Nested scrollers (menus, modals, calculator listbox) | `data-lenis-prevent` | Avoids scroll traps |

GSAP integration snippet (Verified from the Lenis README):

```js
const lenis = new Lenis({ lerp: 0.09, anchors: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

Rules: no scroll hijacking of the keyboard; the document keeps native scrollbar; pinned sections never exceed 4 in the page; every pinned story has the same content available as unpinned flow below 1024px or when reduced motion is on.

### 4.3 Cursor effects

Awwwards' own cursor article advises restraint and says custom cursors do not work on mobile (Reported). The Kairos landing therefore:

- Keeps the native cursor everywhere, with no replacement and no follower dot on content.
- Allows one pointer-reactive effect on the centerpiece only, and only when `(hover: hover) and (pointer: fine)` matches: the object eases toward the pointer with `lerp 0.06` and a maximum rotation of 6 degrees. On touch devices it reacts to scroll only.
- Meets WCAG 2.2 target size minimum of 24 by 24 CSS px for all pointer targets (Verified, SC 2.5.8), and uses 44px for primary buttons.
- Never hides focus: every interactive element keeps a visible focus ring with 3:1 contrast against both adjacent colours.

### 4.4 Reduced motion and low-end fallback (tier model)

WCAG facts (Verified): SC 2.2.2 requires a pause, stop or hide mechanism for automatic movement that lasts over 5 seconds beside other content. SC 2.3.3 (AAA) says motion triggered by interaction should be possible to turn off, and lists `prefers-reduced-motion` as a sufficient technique, with a site-wide setting also sufficient. GSAP `matchMedia` accepts named conditions including `(prefers-reduced-motion: reduce)` and reverts animations and ScrollTriggers automatically when the condition changes. React Three Fiber supports `frameloop="demand"`, `invalidate()`, `PerformanceMonitor` with `onIncline` and `onDecline`, and `dpr` bounds.

Proposed tier model for the Kairos centerpiece:

| Tier | Condition | Experience |
|---|---|---|
| T0 Static | No WebGL2, or `prefers-reduced-motion: reduce`, or `Save-Data`, or the visitor chose "Reduce motion" in the page toggle, or the GPU context is lost | Poster image and a pre-rendered sequence of 5 key frames swapped by section (CSS scroll snap not required); all text, forms and calculator work |
| T1 Light | Touch device, or `navigator.hardwareConcurrency <= 4`, or `PerformanceMonitor` declined twice | Canvas with about 400 points, `dpr` capped at 1.25, no post-processing, `frameloop="demand"` |
| T2 Full | Fine pointer, desktop-class GPU, and 55fps or better sustained for the first 2 seconds | About 1,200 points, `dpr` up to 2 (cap 2, as GPU fill cost rises quickly), subtle pointer response |

Implementation notes:

- `gsap.matchMedia()` with conditions `{ reduce: "(prefers-reduced-motion: reduce)", fine: "(hover: hover) and (pointer: fine)" }`. The handler builds only T2 motion when `!reduce`; the same handler returns a cleanup. Hontran's Iventions write-up also wraps its heavy WebGL choreography in `(prefers-reduced-motion: no-preference)` (Reported).
- Pause the render loop when the canvas is off screen (`IntersectionObserver`), when the tab is hidden, and when the user pressed "Pause motion". Lazy-initialise WebGL when the section is within 1 viewport of entering (Reported technique from the Iventions case study).
- Handle `webglcontextlost` by switching to T0 and not retrying more than once.
- Page-level toggle: "Motion: Full / Reduced" in the footer and in the centerpiece control row, stored in `localStorage` (try/catch), applied as `data-motion="reduced"` on `<html>` before first paint with a tiny inline script so there is no flash. This satisfies the site-wide setting route in SC 2.3.3.
- Measure and gate on real metrics: official good thresholds are LCP at most 2.5s, INP at most 200ms, CLS at most 0.1 at the 75th percentile (Verified, web.dev). Because Awwwards winners self-report tighter figures (LCP 1.5s, INP 100ms, CLS 0.05, page weight under 3MB), adopt those as internal budgets (Reported targets, set as Kairos goals, not as guarantees).

### 4.5 What this means for the Kairos specification (summary of research outputs)

1. Spend the 30% Usability weight and the weak accessibility benchmark as the differentiator: ship the full tier model, a pause control, a Reduced motion toggle and keyboard-operable versions of every interactive demo.
2. Make the one WebGL centerpiece prove the product mechanism (jobs enter, the fit gate drops some with written reasons, kept ones carry fact citations), as Heron, Lidar and Cerebrium do with their own domains.
3. Use no fabricated proof. Oryzo's fake reviews and Terminal Industries' baseline-free percentages are examples of what not to borrow.
4. Differentiate from Lando Norris and Modal by form: ledger lines, receipts, "cites fact #12" chips and a clock motif, not by a different hue.
5. Build the page as mostly Server Components with three client islands, which matches the SSTR and Sharplink performance pattern and the Next.js lazy-loading rules.

---

## 5. Sources

Verified pages read in this research:

- Awwwards evaluation system: https://www.awwwards.com/about-evaluation/
- Awwwards Sites of the Day archive: https://www.awwwards.com/websites/sites_of_the_day/ (pages 1 and 2), Sites of the Month: https://www.awwwards.com/websites/sites_of_the_month/, annual winners: https://www.awwwards.com/annual-awards/winners
- Awwwards site pages for Cerebrium, Heron AI, Moto Finance, Butter, Sharplink, Ai in Design Report 2026, Neutomni, SSTR, Lidar Drone Scanning, Milledollars, Oryzo AI, Terminal Industries, MindMarket, Navigate, Lando Norris and Messenger (https://www.awwwards.com/sites/<slug>)
- Awwwards blog (Razorpay Sprint26): https://www.awwwards.com/razorpay-sprint26-the-future-of-payments.html
- Live sites: https://cerebrium.ai/, https://cerebrium.ai/pricing, https://www.moto-card.com/, https://terminal-industries.com, https://heronaiapp.com/, https://drone.riotters.com/, https://oryzo.ai/
- Lenis README: https://github.com/darkroomengineering/lenis
- GSAP matchMedia: https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- React Three Fiber scaling performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- Next.js lazy loading: https://nextjs.org/docs/app/guides/lazy-loading
- web.dev LCP and Core Web Vitals: https://web.dev/articles/lcp, https://web.dev/articles/vitals
- W3C WCAG 2.2 Understanding: 2.2.2 Pause Stop Hide, 2.3.3 Animation from Interactions, 2.5.8 Target Size Minimum
- Lusion: https://lusion.co/projects/oryzo_ai/ and https://blog.lusion.co/oryzo-bts-part-1-7-concept-and-creative-direction

Third-party articles (Reported, commercial authors, use with care):

- https://www.hontran.dev/blog/awwwards-judging-criteria
- https://www.hontran.dev/blog/best-award-winning-websites-2026
- https://www.hontran.dev/blog/iventions-award-winning-events-website-case-study
- https://www.utsubo.com/blog/award-winning-website-design-guide
- https://studiomeyer.io/en/blog/webdesign-trends-2026-reality-check
- Search summaries of Buzz Interactive, Showit, Colorlib, Lenis showcase (Lando Norris) and Awwwards' custom-cursor article

Not relied upon (statistics unsupported): https://digitalstrategyforce.com/journal/why-are-immersive-experiences-dominating-the-2026-awwwards/

Gaps: the Awwwards Mobile Excellence criteria page did not print its rubric when fetched, so the 70/100 pass mark and the four mobile categories come from search summaries. Lusion's BTS parts 3 to 7, which probably cover the WebGL implementation, were not retrieved. Codrops' May 2026 GSAP case study returned HTTP 403.
