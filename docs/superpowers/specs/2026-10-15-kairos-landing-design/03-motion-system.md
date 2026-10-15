# Kairos landing page: motion system

Date: 2026-10-15. Status: specification for build. Owner: motion system.

Scope: `web/app/(public)/page.tsx`, `web/components/landing/**`, and the landing behaviour of the shared chrome (navbar, footer, rail, tape). The signed-in app and every other route keep the brief's utility-only motion (`docs/04-ui-ux-brief.md`, Motion section) unchanged.

Inputs: `01-creative-direction.md` (read in full; its section ids, scene state ids, Kairos Marks M1 to M10, motion grammar 3.5 and landing tokens 3.6 are used exactly), `docs/04-ui-ux-brief.md`, `_research/stack-feasibility.md`, `_research/awwwards-references.md`, `_research/code-inventory.md`.

Sibling documents written in parallel: `02-design-system.md` (colour, type and layout tokens), `04-webgl-scene.md` (the receipt scene), `05-architecture.md` (files, islands, store), `06-copy-deck.md` (strings). This document owns every duration, curve, stagger, trigger position, scroll rule, reduced-motion variant and motion check. Where it needs something from a sibling, section 15 lists it.

Skills applied (all five loaded): `motion` (universal performance rules: no allocation in per-frame callbacks, `will-change` only while a CSS transition runs, CSS keyframe animations self-promote; Motion for React itself is not used, see 8), `ecc:motion-foundations` (one token object as the single source, a `shouldAnimate` gate, SSR-safe initial states; its spring presets, `bounce` curve and press-scale are rejected because the brand bans springs and overshoot and brief rule A18 bans press transforms), `ecc:motion-advanced` (cleanup of every listener, pause on `visibilitychange`, interrupt-safe sequences; the cursor follower and shimmer loops are rejected), `ecc:motion-patterns` (stagger kept between 50 and 100ms for lists, reveals fire once; `AnimatePresence` does not apply), `gsap-skills:gsap-scrolltrigger` (ScrollTriggers only on top-level tweens and timelines, creation top to bottom with `refreshPriority`, never `scrub` and `toggleActions` together, no `markers` in production, `refresh()` after layout changes).

Verification made for this document on 2026-10-15:

| Item | Result | Source |
| --- | --- | --- |
| Lenis options `anchors` (boolean or ScrollToOptions, default false), `prevent`, `allowNestedScroll`, `autoResize` (default true), `lerp` (default 0.1), `smoothWheel`, `syncTouch` (default false), `respectReducedMotion` (default true), `autoRaf` (default false); `scrollTo` options `offset`, `duration`, `easing`, `immediate`, `lock`, `force`, `onComplete` | Verified | github.com/darkroomengineering/lenis README |
| Whether Lenis smooths keyboard scrolling | Not documented (README mentions only `wheel` and `touch` listeners). Treated as native; QA item Q14 confirms | same |
| SplitText `mask` wraps each piece in an extra clipping element; with a class name set, the mask gets that class plus `-mask`; `aria: "auto"` (default) puts `aria-label` on the parent and `aria-hidden` on pieces; `autoSplit` re-splits on font load and width change, animations must be created in `onSplit`, a returned tween is carried over; `revert()` restores the original `innerHTML` | Verified | gsap.com/docs/v3/Plugins/SplitText |
| ScrollTrigger `fastScrollEnd`, `refreshPriority`, `invalidateOnRefresh`, `ignoreMobileResize` | From the loaded `gsap-scrolltrigger` skill and GSAP docs knowledge; `fastScrollEnd` not re-fetched today (marked U in 5.3) | gsap.com/docs/v3/Plugins/ScrollTrigger |

---

## 1. Principles

Expressive motion is allowed on the landing (locked decision 1). These eight principles keep it calm, exact and accountable. Every preset in this document must satisfy all eight; QA item Q1 checks each preset against this list.

| # | Principle | What it means in practice |
| --- | --- | --- |
| P1 | **Every motion ends.** | No loops, no idle sway, no breathing, no marquees, no tickers, no shimmer. A motion has a start, a stated duration and a final state. The only continuous inputs are the visitor's own scroll and pointer, and those stop when the visitor stops. |
| P2 | **Motion records, it does not perform.** | Each move is one of the ledger verbs from creative direction 3.5: ink, post, print, feed, tear, travel, hand-off, retract, plus colour. A move that is not one of these is not allowed. Decorative motion without a ledger meaning is removed. |
| P3 | **The page only moves forward.** | Posted things never un-post (append-only, creative direction 4.5 and 9.4). Scrolling up does not reverse rules, titles, prints or the tear. Only poses (where the slip sits, how much mint covers the stage) are reversible, because a pose is a position, not a record. |
| P4 | **Nothing moves unless the visitor caused it.** | Every motion is triggered by the visitor's scroll position, pointer or an explicit action. The two exceptions are the first-paint ink on the hero headline (1.2s) and the poster-to-canvas cross-fade (600ms); both end within 2s of arrival and carry no information. |
| P5 | **Stillness is the signature.** | At entry 04 (`slip-hold`) nothing in the viewport moves on its own: no print, no tilt, no rise. The visitor's approval is the only thing that moves the story. Stillness is designed, not a missing animation. |
| P6 | **Readable at frame zero.** | No text is ever `opacity: 0` in server HTML. Headlines are readable in their first painted frame; body text never has an entrance. Kinetic type changes how a line arrives, never whether it can be read. |
| P7 | **No overshoot, no springs, no bounce.** | Curves are monotonic cubic-beziers (section 2.1). Per-frame smoothing uses critically damped exponential approach, which cannot overshoot. The `bounce` and spring presets from the motion skills are not used. Pressed buttons do not scale (brief rule A18). |
| P8 | **Reduced motion changes how, never what.** | Every preset has a reduced variant that delivers the same final state and the same words (section 10). A visitor who never sees any motion reads the same page. |

---

## 2. Tokens

### 2.1 Easing tokens

Five named curves plus two utility curves. The GSAP column gives the built-in GSAP ease that each cubic-bezier is the standard approximation of (the easings.net fits: easeOutQuint, easeInOutQuad, easeInOutCubic, easeInCirc, easeInExpo). Using the built-ins means no `CustomEase` plugin (3.2 kB saved). The maximum difference between each pair is a few hundredths of progress in mid-curve, which is not visible at these durations; QA item Q24 plots both to confirm.

| Token | CSS value | GSAP name | Family | Use for | Never use for |
| --- | --- | --- | --- | --- | --- |
| `--ease-post` | `cubic-bezier(0.22, 1, 0.36, 1)` | `power4.out` | Decelerate | Anything arriving and settling: ink, rule draw (post), print, line rise, row print, odometer, path draw, tape line, bracket close, canvas pose ease-back | Leaving, tearing |
| `--ease-feed` | `cubic-bezier(0.45, 0, 0.55, 1)` | `power1.inOut` | Near-constant with soft ends | The receipt feed only (a printer feeds at a steady rate) | Any DOM element |
| `--ease-travel` | `cubic-bezier(0.65, 0, 0.35, 1)` | `power2.inOut` | Symmetric in-out | Moving between two places: slip travel, ghost outline travel, mint expansion, sample paper lift (entry 10), mobile mint expansion, Lenis anchor scroll | Arrivals with no origin on screen |
| `--ease-tear` | `cubic-bezier(0.55, 0, 1, 0.45)` | `circ.in` | Accelerate | The tear only: canvas tear and the mobile stub separation | Everything else |
| `--ease-retract` | `cubic-bezier(0.7, 0, 0.84, 0)` | `expo.in` | Hard accelerate | Refusal only: the citation thread retracting and the refused letters falling | Everything else |
| `--ease-utility` | `cubic-bezier(0, 0, 0.58, 1)` (the CSS `ease-out` keyword) | not used in GSAP | Utility | Colour, background-colour, border-colour, fill, stroke, text-decoration-colour (the brief's 300ms utility rule), lime hand-over steps | Transforms |
| `--ease-linear` | `linear` | `none` | Linear | Opacity cross-fades between identical geometry (poster to canvas, canvas to DOM receipt, canvas fade out and back, route change), scrubbed timelines whose segments carry their own mapped ease | Anything that moves |

Direction rule: arriving decelerates (`--ease-post`), leaving accelerates (`--ease-tear`, `--ease-retract`), moving between two visible places is symmetric (`--ease-travel`). A curve that fits none of these is not added; a new curve needs an entry in this table and a reason.

### 2.2 Duration tokens

All durations are named. The five tokens from creative direction 3.6 keep their names and values; the rest are added here. Reduced-motion zeroing is defined in 2.6.

| Token | Value | Used by preset ids | Zeroed under reduced motion |
| --- | --- | --- | --- |
| `--dur-swap` | 120ms | `kt-cell-swap`, the bracket close in `sq-cite-refuse` | Yes |
| `--dur-lime-step` | 150ms | `ho-lime` (each of its two steps) | Yes |
| `--dur-label` | 200ms | `en-rail-label` | Yes |
| `--dur-row` | 240ms | `en-row-print`, `kt-odometer`, `ex-retract`, `ho-route`, the citation saved row | Yes |
| `--dur-colour` | 300ms | Every utility colour transition (`mi-*`), `en-post-square`, `em-trace`, the hover path draw in `en-path-draw`, the ghost outline separation in `ho-ghost-outline` | **No** (colour is not motion; the separation and path draw use their own zeroed token under reduced, see 10) |
| `--dur-fall` | 320ms | `kt-letter-fall` (per glyph) | Yes |
| `--dur-ink` | 360ms | `kt-ink` (per word), `kt-odometer-price` | Yes |
| `--dur-handoff` | 400ms | `ho-canvas-dom`, `en-canvas-return`, `ex-canvas-out` (T1: 240ms) | Yes |
| `--dur-print` | 420ms | `em-print`, `em-stamp`, the saved path draw in `en-path-draw` | Yes |
| `--dur-sign` | 500ms | `kt-sign-rule` | Yes |
| `--dur-paper` | 520ms | Paper advance inside `em-print`, `em-stamp`, `sq-fresh` | Yes |
| `--dur-post` | 600ms | `en-post-rule`, `en-compare-post`, `kt-tape-line`, `en-poster-to-canvas`, `ex-slip-lift`, the mobile mint expansion in `mb-print-tear`, the canvas pose ease-back after a print | Yes |
| `--dur-rise` | 700ms | `kt-line-rise`, `kt-title-rise` | Yes |
| `--dur-tear` | 700ms | `ho-tear`, the stub separation in `mb-print-tear` | Yes |
| `--dur-feed` | 2400ms | `em-feed` | Yes |
| `--dur-route` | 240ms | `ho-route` | Yes |

Reduced value: `0.01ms`, not `0s`, so that `transitionend` and `animationend` still fire and no sequence that waits for one can hang.

### 2.3 Stagger and delay tokens

| Token | Value | Rule |
| --- | --- | --- |
| `--stagger-word` | 70ms | `kt-ink` (5 words, spread 280ms) |
| `--stagger-line` | 70ms | `kt-line-rise` (titles have at most 3 lines, spread at most 140ms) |
| `--stagger-row` | 60ms | `en-row-print` (DOM receipt has 7 rows, spread 360ms) |
| `--stagger-compare` | 90ms | `en-compare-post` (5 rows, spread 360ms) |
| `--stagger-char` | 18ms | `kt-letter-fall` only (21 visible glyphs, spread 360ms). The only stagger below 50ms; it is the page's single character split and reads as one falling line, not a list |
| `--delay-sign` | 700ms | `kt-sign-rule` start after first paint |
| `--delay-rise` | 80ms | Title rise start after the entry rule starts drawing |
| `--delay-feed-stop` | 200ms | The still pause between the end of `em-feed` and the full-size 02 print |

Stagger rules:

1. Order is always reading order: top to bottom, then left to right (`stagger: { each, from: "start" }` in GSAP; `--i` ascending in CSS). Never random, never from the centre, never from the end.
2. A stagger never exceeds 500ms of total spread. If a list would exceed it, the stagger shrinks so that `each = 500 / (count - 1)` with a floor of 50ms, and items beyond the 10th post together with the 10th.
3. Body text, captions, eyebrows, entry numbers, labels and status text are never staggered and never animated in.
4. Odometer digit columns move together (no stagger between digits), because a value is one fact.

### 2.4 Distance tokens

| Token | Value | Use |
| --- | --- | --- |
| `--dist-row` | 6px | `en-row-print` rise |
| `--dist-fall` | 14px | `kt-letter-fall` drop |
| `--dist-bracket` | 4px | Lock bracket halves closing in `sq-cite-refuse` |
| `--dist-receipt-up` | 8px | Mobile receipt lift in `mb-print-tear` |
| `--dist-stub` | 12px | Mobile stub drop in `mb-print-tear` |
| `--rise-line` | 115% | `kt-line-rise` and `kt-title-rise` start offset (`translateY`). Creative direction 8.2 says 105%; it becomes 115% because the mask is padded by 0.12em to keep descenders (4.3), and a 1.02em line inside a 1.14em mask needs at least 112% to start fully hidden |

### 2.5 Behaviour constants (TypeScript only)

| Constant | Value | Meaning |
| --- | --- | --- |
| `MOTION_BREAKPOINT` | `"(min-width: 1024px)"` | GSAP, Lenis and the canvas exist only at or above this width |
| `PIN_QUERY` | `"(min-width: 1024px) and (min-height: 640px)"` | The pinned stage exists only here (5.5) |
| `ENTRY_START` / `ENTRY_END` | `"top 85%"` / `"bottom 15%"` | Entry local progress `u` from 0 to 1 (creative direction 4.5) |
| `POSE_LAMBDA` | 7.7 per second | Scene pose approach, `x += (target - x) * (1 - exp(-POSE_LAMBDA * dt))`. Equals the creative direction's 0.12 per frame at 60fps, made frame-rate independent so T1 at 30fps moves at the same speed |
| `TILT` | `{ maxYDeg: 6, maxXDeg: 3, lambda: 6 }` | Pointer tilt, critically damped (creative direction 3.5) |
| `MAX_GROUPS` | 2 | Maximum simultaneous motion groups in the viewport (3.4) |
| `MAX_AUTOPLAY_MS` | 4500 | Hard cap on any sequence that runs without continuous input (11) |
| `DESIGN_AUTOPLAY_MS` | 3200 | Design target; only `sq-feed-stop` (about 3.9s) is allowed above it |
| `MAX_WILL_CHANGE` | 4 | Elements with `will-change` set at the same time (12.2) |
| `SMOOTH_ANCHOR_MAX_VH` | 2 | Anchor jumps up to 2 viewport heights are smooth; longer jumps are instant (5.6) |
| `MOTION_STORAGE_KEY` | `"kairos:motion"` | `localStorage` key for the Full or Reduced choice |

### 2.6 Where the tokens live

- **CSS custom properties** are declared on `:root` in `web/app/globals.css`, in the landing-only token block that `02-design-system.md` defines. They are inert on routes that do not use them. Durations, staggers and distances are zeroed in one rule pair:

```css
/* Reduced motion: OS preference (also covers no-JS), unless the visitor chose Full. */
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion="full"]) {
    --dur-swap: 0.01ms; --dur-lime-step: 0.01ms; --dur-label: 0.01ms; --dur-row: 0.01ms;
    --dur-fall: 0.01ms; --dur-ink: 0.01ms; --dur-handoff: 0.01ms; --dur-print: 0.01ms;
    --dur-sign: 0.01ms; --dur-paper: 0.01ms; --dur-post: 0.01ms; --dur-rise: 0.01ms;
    --dur-tear: 0.01ms; --dur-feed: 0.01ms; --dur-route: 0.01ms;
    --stagger-word: 0ms; --stagger-line: 0ms; --stagger-row: 0ms; --stagger-compare: 0ms;
    --stagger-char: 0ms; --delay-sign: 0ms; --delay-rise: 0ms; --delay-feed-stop: 0ms;
    --dist-row: 0px; --dist-fall: 0px; --dist-bracket: 0px; --dist-receipt-up: 0px;
    --dist-stub: 0px; --rise-line: 0%;
  }
}
/* Reduced motion chosen on the page. Same declarations as above. */
:root[data-motion="reduced"] { /* identical list */ }
```

  `--dur-colour` is not in the list (P8: colour changes still communicate state). A unit test asserts the two lists are identical.

- **TypeScript mirror**: `web/lib/motion/tokens.ts` exports `DUR` (seconds, for GSAP), `EASE` (`{ post: "power4.out", feed: "power1.inOut", travel: "power2.inOut", tear: "circ.in", retract: "expo.in", linear: "none" }`), `EASE_CSS` (the cubic-bezier strings), `STAGGER`, `DIST`, and the constants in 2.5. A unit test (`web/lib/motion/tokens.test.ts`) parses the `:root` block of `globals.css` and fails if any value differs from the mirror. No component file may contain a duration, curve or stagger literal; QA item Q2 greps for them.

---

## 3. Choreography grammar

### 3.1 The four families

Every preset belongs to exactly one family. The family fixes its curve direction and what it may animate.

| Family | Prefix | Meaning on a ledger | Curve | May animate | Examples |
| --- | --- | --- | --- | --- | --- |
| Enter | `en-`, `kt-` (kinetic type is a kind of enter) | A row or line is posted | `--ease-post` | `transform` (translate, scaleX), `opacity` (only from a non-zero or masked state), `color` for ink | `en-post-rule`, `kt-line-rise`, `en-row-print` |
| Emphasize | `em-` | Something already posted is pointed at or printed | `--ease-post`, `--ease-feed` | `color`, `background-color`, `border-color`, canvas uniforms | `em-trace`, `em-print`, `em-feed`, `em-stamp` |
| Hand-off | `ho-` | Custody or form passes from one thing to another | `--ease-travel` for movement, `--ease-linear` for cross-fades, `--ease-utility` for lime | `transform`, `opacity`, `background-color` (lime), canvas uniforms | `ho-lime`, `ho-canvas-dom`, `ho-slip-travel`, `ho-mint-expand` |
| Exit | `ex-` | A refusal, or paper leaving the lane | `--ease-retract`, `--ease-tear`, `--ease-travel` | `transform`, `opacity` | `ex-retract`, `ex-slip-lift`, `ex-canvas-out` |

Scroll-coupled scene work (`ho-pose`), mobile composites (`mb-`), micro-interactions (`mi-`) and named sequences (`sq-`) are listed in 3.6 and sections 6 and 9.

### 3.2 Hand-off rules

1. **Sequential when two states cannot coexist.** Lime custody (`ho-lime`) is out first, then in: the old owner's fill goes to its fallback over 150ms, then the new owner fills over 150ms after a 150ms delay. There is never a frame with two lime fills.
2. **Cross-fade only between identical geometry.** The poster and the canvas show the same slip in the same pose; the canvas slip and the DOM receipt occupy the same rectangle at the moment of hand-off (the slot is stationary because the stage is pinned). Two different shapes are never cross-faded; they travel instead.
3. **Travel is scroll-scrubbed when it crosses the layout**, so the visitor controls its speed and can stop it mid-way (`ho-slip-travel`, `ho-mint-expand`). Time-based travel is allowed only inside a fixed region (the tape strip, the lane, the mobile band intro).
4. **The DOM is authoritative after any hand-off.** Once the DOM receipt is in, the canvas never takes that role back in that entry.

### 3.3 Entry choreography (the post)

When an entry's top crosses 85% of the viewport height (`u = 0`), the entry posts. The post is one motion group:

| Time from post | What | Preset |
| --- | --- | --- |
| 0ms | Entry number appears (already present; no animation) | none |
| 0 to 600ms | Graticule rule draws left to right, `scaleX(0)` to `scaleX(1)`, origin left | `en-post-rule` |
| 0ms | The current-entry tick (8px, Phosphor White) is part of the rule and draws with it | `en-post-rule` |
| 80ms to 920ms | Title lines rise inside masks, 70ms apart (2 lines: ends at 850ms; 3 lines: 920ms) | `kt-line-rise` (1024px and wider) or `kt-title-rise` (below) |
| 0ms | Eyebrow, body, demo, table, settlement line: present, no entrance | none |
| 0 to 300ms | Settlement posting square in this entry (if any) fills | `en-post-square` |
| same frame | `ledgerStore.post(entryId)`; the entry 01 row this entry settles runs `kt-cell-swap` if that row is in the viewport, otherwise it changes instantly | `kt-cell-swap` |

Posting is **monotonic**: posting entry N first posts every earlier unposted entry instantly (no transition, `data-post="instant"`), then posts N live. This covers fast scrolls, anchor jumps and reloads mid-page with one rule.

The hidden start state (rule at `scaleX(0)`, title lines at `translateY(var(--rise-line))`) is applied only by JavaScript, only at hydration, and only to entries whose top is below 85% of the viewport at that moment. Entries in view or above are marked `data-post="instant"` and never animate.

### 3.4 Simultaneous motion limit

A **motion group** is one timeline, one CSS transition set triggered by one state change, or one canvas move (print, feed, tear, travel, lift). A staggered set counts as one group. Colour transitions (`--dur-colour`) do not count. Pointer tilt and pose smoothing do not count (they follow the visitor's input continuously).

**Rule: at most `MAX_GROUPS` = 2 motion groups are running in the viewport at any moment.**

Known worst cases and how they stay within the limit:

| Moment | Groups running | Count |
| --- | --- | --- |
| Hero first second | `sq-hero-open` (ink then sign rule, one timeline) | 1 |
| Hero after idle | `en-poster-to-canvas`, which waits until `sq-hero-open` has ended (7.1) | 1 |
| Entry 02 arrival | Entry post, then `sq-feed-stop` from `u = 0.20` | 2 at most |
| Entry 03 refusal | `sq-cite-refuse` (one CSS state machine) plus a possible entry post of entry 04 if the visitor scrolls during it | 2 at most |
| Entry 04 | Nothing automatic after the post (P5). On Approve: `em-stamp` (canvas) and `ho-lime` (colour, not counted) | 1 |
| Entry 05 pinned stage | The stage timeline (scrubbed; travel, H2 fade and mint expansion are all on it) plus one time-based move (`ho-tear` or `ho-canvas-dom`) | 2 |
| Entry 10 | `sq-fresh` (one canvas sequence) plus the entry post | 2 |

If a third group would start, the newest trigger waits until a group ends, up to 300ms; if it would still wait, it posts instantly. The Playwright sampler in Q5 enforces this.

### 3.5 Interruption and re-trigger

- A user action that re-triggers a running sequence (pressing "Add line" again, changing a control during an odometer roll) first jumps the running instance to its final state (`progress(1)` in GSAP; setting the final `data-*` state in CSS), commits its store write, then starts fresh. Sequences never stack and never reverse mid-flight.
- Scroll never interrupts a time-based move. A print, feed, tear or hand-off that has started finishes even if the visitor scrolls away; `fastScrollEnd` jumps it to the end if the visitor leaves the trigger range at high speed (5.3).
- Changing the Motion setting to Reduced while anything is running completes every running sequence instantly (`completeAll()`, 11.2) before the reduced variants take over.

### 3.6 Preset catalogue

Every preset has an id. A CSS preset is a class with the same name as its id (for example `.en-post-rule`), declared in `web/components/landing/motion.css`. A GSAP preset is a function of the same name in camelCase in `web/lib/motion/` (for example `ktLineRise`). Section specs reference these ids.

| Id | Family | Trigger | Animates | Duration, curve | Engine | Where |
| --- | --- | --- | --- | --- | --- | --- |
| `kt-ink` | Enter | First paint | `color` Sage 60 to Phosphor White per word | `--dur-ink`, `--ease-post`, `--stagger-word` | CSS keyframes | Entry 00 H1 |
| `kt-sign-rule` | Enter | First paint, after `--delay-sign` | `::after` `scaleX` 0 to 1 | `--dur-sign`, `--ease-post` | CSS keyframes | Under "sign." |
| `kt-line-rise` | Enter | Entry post, +80ms | Title lines `translateY(115%)` to 0 in masks | `--dur-rise`, `--ease-post`, `--stagger-line` | GSAP + SplitText | Every entry H2, 01 to 10, at 1024px and wider |
| `kt-title-rise` | Enter | Entry post, +80ms | Whole title `translateY(115%)` to 0 in one mask | `--dur-rise`, `--ease-post` | CSS transition | Every entry H2 below 1024px |
| `kt-letter-fall` | Exit | `sq-cite-refuse` step 5 | Glyph `translateY(0)` to 14px, `opacity` 1 to 0 | `--dur-fall`, `--ease-retract`, `--stagger-char` | CSS transition | Entry 03 refused line |
| `kt-odometer` | Emphasize | Visitor input changes a value | Digit column `translateY` | `--dur-row`, `--ease-post` | CSS transition | Entry 02 counts, entry 07 calculator |
| `kt-odometer-price` | Emphasize | Interval switch change | Digit column `translateY` | `--dur-ink`, `--ease-post` | CSS transition | Entry 07 plan prices |
| `kt-cell-swap` | Emphasize | Settling entry posts, row in view | Two stacked texts cross-fade (`opacity`) | `--dur-swap`, `--ease-linear` | CSS transition | Entry 01 right cells |
| `kt-tape-line` | Hand-off | New receipt line posted | Old line `translateY(0)` to `-100%`, new line `100%` to 0 | `--dur-post`, `--ease-post` | CSS transition | Mobile receipt tape |
| `en-post-rule` | Enter | Entry post | Rule `scaleX` 0 to 1, origin left | `--dur-post`, `--ease-post` | CSS transition | Every entry rule (M1, M2) |
| `en-post-square` | Enter | Entry post or settle | Posting square `background-color` transparent to Phosphor White | `--dur-colour`, `--ease-utility` | CSS transition | M3 squares |
| `en-row-print` | Enter | State change (approve, ghost approve, saved line, mobile band) | Row `opacity` 0 to 1 and `translateY(6px)` to 0 | `--dur-row`, `--ease-post`, `--stagger-row` | CSS transition | DOM receipt rows, compact slips, saved citation row |
| `en-compare-post` | Enter | Entry 08 post | Each row's top rule `scaleX` 0 to 1 | `--dur-post`, `--ease-post`, `--stagger-compare` | CSS transition | Entry 08 table rows |
| `en-poster-to-canvas` | Hand-off | Canvas compiled and first frame rendered, not before `sq-hero-open` ends | Canvas wrapper `opacity` 0 to 1 over the poster | `--dur-post` (600ms), `--ease-linear` | CSS transition | Lane, entry 00 |
| `en-canvas-return` | Enter | Entry 06 top at 70%; entry 10 top at 85% | Canvas wrapper `opacity` 0 to 1 | `--dur-handoff`, `--ease-linear` | CSS transition | Lane |
| `ex-canvas-out` | Exit | Entry 07 top at 70% (scrolling down); entry 10 top below 85% (scrolling up) | Canvas wrapper `opacity` 1 to 0, then `visibility: hidden` | `--dur-handoff`, `--ease-linear` | CSS transition | Lane |
| `en-path-draw` | Emphasize | Hover or focus on a line or fact (trace); saved line | SVG `stroke-dashoffset` 1 to 0 with `pathLength="1"` | Trace: `--dur-colour`; saved: `--dur-print`; `--ease-post` | CSS transition | Entry 03 |
| `en-rail-label` | Enter | Hover or focus on a rail link | Label `opacity` 0 to 1, `translateX(-4px)` to 0 | `--dur-label`, `--ease-post` | CSS transition | Ledger rail |
| `em-trace` | Emphasize | Hover or focus | Facts or lines `color` Sage 60 to Phosphor White | `--dur-colour`, `--ease-utility` | CSS transition | Entry 03 |
| `em-print` | Emphasize | Scene state reaches its print point | Canvas: one line printed, paper advances | `--dur-print` (head), `--dur-paper` (paper), `--ease-post` | GSAP on scene state | Receipt lines 02, 03, 04 pending, 05, 06 |
| `em-feed` | Emphasize | `slip-feed` at `u = 0.20` | Canvas `uFeed` and `uPrintY` across 48 pre-drawn rows | `--dur-feed`, `--ease-feed` | GSAP on scene state | Entry 02 |
| `em-stamp` | Emphasize | Approve click | Canvas: stamp line in the signature box | `--dur-print`, `--dur-paper`, `--ease-post` | GSAP on scene state | Entry 04 |
| `ho-pose` | Hand-off | Scroll (entry `u`) | Canvas slip position, rotation, scale, paper level | Smoothstep over `u` 0 to 0.25, `POSE_LAMBDA` approach | GSAP ScrollTrigger read by the scene | All scene states (values in `04-webgl-scene.md`) |
| `ho-lime` | Hand-off | Lime owner changes | `background-color`, `color`, `border-color` of the two candidates | 150ms out, then 150ms in, `--ease-utility` | CSS transition | All lime candidates |
| `ho-tear` | Hand-off | Stage `p` crosses 0.18 forward, approved | Canvas: perforation split, lift 4% of viewport height, curl to 0 | `--dur-tear`, `--ease-tear` | GSAP on scene state | Entry 05 |
| `ho-ghost-outline` | Hand-off | Stage `p` crosses 0.18 forward, not approved | Canvas: dashed outline separates from the slip | `--dur-colour` (300ms), `--ease-post` | GSAP on scene state | Entry 05 |
| `ho-slip-travel` | Hand-off | Stage `p` 0.25 to 0.50 | Canvas: slip (or ghost outline) lane to slot, rotation to zero, scale to slot fit | Scrubbed, segment mapped through `--ease-travel` | GSAP timeline, `scrub: true` | Entry 05 |
| `ho-canvas-dom` | Hand-off | Stage `p` crosses 0.50 forward | Canvas wrapper `opacity` 1 to 0; DOM receipt `opacity` 0 to 1 | `--dur-handoff` (T1: 240ms), `--ease-linear` | CSS transition | Entry 05 |
| `ho-mint-expand` | Hand-off | Stage `p` 0.56 to 0.90 | Mint layer `transform: translate() scale()` from the slot rectangle to identity | Scrubbed, mapped through `--ease-travel` | GSAP timeline, `scrub: true` | Entry 05 |
| `ho-route` | Hand-off | Route change to `/sign-up` or `/login` | View Transition root cross-fade | `--dur-route`, `--ease-linear` | CSS (View Transitions) | Landing exit |
| `ex-retract` | Exit | `sq-cite-refuse` step 4 | Citation path `stroke-dashoffset` from 0.30 back to 1 | `--dur-row`, `--ease-retract` | CSS transition | Entry 03 |
| `ex-stage-title` | Exit | Stage `p` 0.50 to 0.58 | Stage H2 `opacity` 1 to 0 | Scrubbed, linear | GSAP timeline | Entry 05 |
| `ex-slip-lift` | Exit | `slip-fresh` at `u = 0.20` | Canvas: sample paper slides up out of the lane | `--dur-post`, `--ease-travel` | GSAP on scene state | Entry 10 |
| `mb-print-tear` | Composite | Mobile receipt 50% in view | Rows print, stub separates, mint grows behind the receipt | See 9.9 | CSS transitions | Entry 05 below 1024px |
| `mi-*` | Micro | Hover, focus, press | See section 6 | `--dur-colour`, `--ease-utility` | CSS | Everywhere |
| `sq-*` | Sequences | See section 9 | Compositions of the presets above | See section 9 | Mixed | Named moments |

---

## 4. Kinetic typography

Three faces of kinetic type exist on the page and no others: ink (the hero H1), rise (entry titles) and fall (one refused sample line). Odometers are numeric, not typographic, and are specified with them for completeness. Kinetic type never splits a headline into characters, never scrambles, never types on, never changes letter-spacing or weight, and never animates body text.

### 4.1 `kt-ink` and `kt-sign-rule`: the LCP headline

The H1 is the Largest Contentful Paint element. It must paint in its first frame, readable, with no JavaScript.

Server markup (rendered by the hero Server Component; the five words are fixed copy):

```html
<h1 class="kt-ink">
  <span class="kt-ink__w" style="--i:0">Job</span>
  <span class="kt-ink__w" style="--i:1">applications</span>
  <span class="kt-ink__w" style="--i:2">you</span>
  <span class="kt-ink__w" style="--i:3">would</span>
  <span class="kt-ink__w kt-sign-rule" style="--i:4">sign.</span>
</h1>
```

Spans are `display: inline` (not `inline-block`), so `text-wrap: balance` and normal wrapping work and screen readers read one sentence. No `aria-label` is needed because the words are whole.

```css
.kt-ink { color: var(--foreground); }
.kt-ink__w {
  animation: kt-ink var(--dur-ink) var(--ease-post) calc(var(--i) * var(--stagger-word)) both;
}
@keyframes kt-ink { from { color: var(--body); } to { color: var(--foreground); } }

.kt-sign-rule { position: relative; }
.kt-sign-rule::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -0.06em; height: 1px;
  background: var(--foreground); transform-origin: left center;
  animation: kt-sign var(--dur-sign) var(--ease-post) var(--delay-sign) both;
}
@keyframes kt-sign { from { transform: scaleX(0); } to { transform: scaleX(1); } }
```

| Property | Value |
| --- | --- |
| Start colour | Sage 60 `#8cab87` (8.3:1 on Void). Readable at frame 0; never `opacity: 0`, never clipped, never offset |
| Timeline | Word 0: 0 to 360ms. Word 4: 280 to 640ms. Rule: 700 to 1200ms. All ends by 1.2s after first paint |
| Why `color` is allowed | It is a paint-only change on five words, no layout. It is the page's one animated non-compositor property besides utility colour (12.1) |
| LCP | A colour change does not create a new LCP entry; the H1 is reported at its first paint. See 7.3 for the poster size guard that keeps the H1 the largest candidate |
| Font swap | `next/font` metric-adjusted fallbacks make a late swap nearly invisible; the ink runs on whichever face is painted. No JavaScript waits for fonts |
| No JavaScript | Runs as written (CSS only) |
| Reduced motion | Tokens are zeroed, so the words and the rule are in their final state from the first frame |

### 4.2 `kt-line-rise`: entry titles at 1024px and wider

| Property | Value |
| --- | --- |
| Targets | The `h2` of entries 01 to 10, and the stage H2 re-entry on mint in entry 05 (9.6) |
| Markup | `<h2 class="kt-title"><span class="kt-mask"><span class="kt-mask__in">Title text.</span></span></h2>`. The same server markup serves both `kt-line-rise` and `kt-title-rise` |
| Split | `SplitText.create(".kt-mask__in", { type: "lines", linesClass: "kt-line", mask: "lines", autoSplit: true, aria: "auto", onSplit })`. Mask elements receive the class `kt-line-mask` (verified naming rule) |
| Descender guard | `.kt-line-mask { padding-bottom: 0.12em; margin-bottom: -0.12em; }` so the clipping box includes descenders (g, p, y) without changing layout. Without this, line-height 1.02 would clip descenders permanently |
| Start state | Lines at `yPercent: 115` (`--rise-line`), set inside `onSplit` only when the entry has `data-post="pending"` |
| Motion | `gsap.to(self.lines, { yPercent: 0, duration: DUR.rise, ease: EASE.post, stagger: STAGGER.line, delay: 0.08 })`, returned from `onSplit` so a re-split carries its progress |
| Trigger | `ScrollTrigger.create({ trigger: entryEl, start: ENTRY_START, once: true, onEnter: play })`, with `refreshPriority` equal to the entry index |
| After completion | `split.revert()` restores plain text (fewer nodes; the heading becomes a normal heading again; `autoSplit` stops watching) |
| Already posted | If the store says the entry is posted when `onSplit` runs (re-split, Activity re-creation), lines are set to final and no tween is created |
| Accessibility | `aria: "auto"` labels the `h2` with its own text while split; the revert removes the label. The heading text is never absent from the accessibility tree |
| Budget | Splitting runs once per title at hydration, about 0.5ms each, 11 titles at most |

### 4.3 `kt-title-rise`: entry titles below 1024px (no GSAP)

| Property | Value |
| --- | --- |
| Markup | Same as 4.2 |
| CSS | `[data-post="pending"] .kt-mask { overflow: clip; padding-bottom: 0.12em; margin-bottom: -0.12em; display: block; }` `[data-post="pending"] .kt-mask__in { display: block; transform: translateY(var(--rise-line)); }` `[data-post="live"] .kt-mask__in { display: block; transform: none; transition: transform var(--dur-rise) var(--ease-post) var(--delay-rise); }` |
| Trigger | `EntryPoster` sets `data-post="live"` (5.7) |
| Without JavaScript | No `data-post` attribute exists, so no hidden state exists |

### 4.4 `kt-letter-fall`: the refused line

The refused sample line is a fixed preset ("Led a team of 6 engineers"), so it is split on the server. SplitText is not needed for it, which lets the same code run below 1024px where GSAP is not loaded (creative direction 5.3 names SplitText for this; the behaviour is identical and the implementation is simpler).

| Property | Value |
| --- | --- |
| Markup | `<span class="kt-letter-fall" aria-label="Led a team of 6 engineers"><span aria-hidden="true"><span style="--i:0">L</span>...</span></span>`; spaces are plain text nodes and do not animate; 21 glyph spans |
| Motion | `[data-cite-state="refused"] .kt-letter-fall [style*="--i"] { transform: translateY(var(--dist-fall)); opacity: 0; transition: transform var(--dur-fall) var(--ease-retract) calc(var(--i) * var(--stagger-char)), opacity var(--dur-fall) var(--ease-retract) calc(var(--i) * var(--stagger-char)); }` |
| Timeline | Starts at step 5 of `sq-cite-refuse` (9.4); glyph 20 ends 360 + 320 = 680ms later |
| Layout | The line lives in a fixed-height slot (the "Try adding a line" pending slot), so the fall causes no layout shift |
| Reduced motion | The line disappears in one frame; the `role="alert"` text is identical |

### 4.5 `kt-odometer` and `kt-odometer-price`

| Property | Value |
| --- | --- |
| Structure | One column per digit position, each a stack of `0` to `9` at a fixed `1lh` height inside `overflow: clip`; columns `aria-hidden="true"`; separators (`$`, `,`, `.`) are static; one visually hidden node holds the full value |
| Width | Fixed column count per field (the field's maximum digit count); leading positions render blank, so the value never changes width (CLS 0) |
| Motion | `transform: translateY(calc(var(--d) * -1lh))`, `transition: transform var(--dur-row) var(--ease-post)` (prices: `--dur-ink`). All columns move together. A column moves directly to its digit; it never wraps or spins |
| When it rolls | Only in response to visitor input (controls in entry 02, the calculator and interval switch in entry 07). Numbers that change because of scroll (the navbar caption `05 / 10`, the rail) swap instantly |
| Announcement | A polite live region announces the final value 500ms after input stops (creative direction 9.3), never per digit |
| INP | The value updates in the input handler; the roll starts on the next frame. No layout read in the handler |

### 4.6 `kt-cell-swap` and `kt-tape-line`

- `kt-cell-swap`: the "open · see NN" and "settled in NN" texts are stacked in one grid cell (`grid-area: 1 / 1`), so the cell's width is the wider text's width from the start. On settle, the old text goes `opacity` 1 to 0 and the new text 0 to 1, simultaneously, `--dur-swap`, linear. It animates only if the row is in the viewport; otherwise it changes instantly. Row 04 never swaps.
- `kt-tape-line`: the 48px tape is `overflow: clip`. When a line posts, the old line moves `translateY(0)` to `translateY(-100%)` while the new line moves `translateY(100%)` to `translateY(0)`, both `--dur-post`, `--ease-post`, as one group. If another line posts during the move, the move completes instantly first (3.5).

---

## 5. Scroll conventions

### 5.1 Where smooth scroll exists

| Context | Scroll |
| --- | --- |
| Landing, 1024px and wider, effective motion Full, OS not set to reduce | Lenis smoothing on wheel |
| Landing, 1024px and wider, effective motion Full, OS set to reduce (visitor chose Full on the page) | Lenis mounted, but `respectReducedMotion` (default true) keeps smoothing off. The Full override restores the scene and kinetic type, never wheel smoothing, because smoothing is the motion most likely to trigger vestibular symptoms. |
| Landing, effective motion Reduced | Lenis not mounted. Native scroll |
| Landing, below 1024px | Lenis not loaded. Native scroll and native momentum |
| Every other route, the signed-in app | Native scroll. `SmoothScroll` is mounted only in the landing's client tree and destroyed in cleanup |

### 5.2 Lenis configuration

```ts
new Lenis({
  lerp: 0.09,                 // creative direction 10.1
  smoothWheel: true,
  syncTouch: false,           // native touch momentum; avoids iOS < 16 problems
  anchors: false,             // replaced by the anchor handler in 5.6 (deviation D3)
  autoRaf: false,             // driven by gsap.ticker, the page's only clock
  autoResize: true,           // ResizeObserver on content
  allowNestedScroll: false,
  prevent: (node) => node.closest("dialog, select, [data-lenis-prevent]") !== null,
  // respectReducedMotion: left at its default (true). Never set it to false.
})
```

- `lenis/dist/lenis.css` is imported by `SmoothScroll` (it sets `scroll-behavior: auto` on the smoothed root).
- The clock (`web/lib/motion/clock.ts`, `startClock(stage)`): `gsap.ticker.lagSmoothing(0)`; one ticker callback, added with `prioritize = true`, calls `lenis.raf(time * 1000)` first, then the stage renders only if dirty. `lenis.on("scroll", ScrollTrigger.update)` links Lenis to ScrollTrigger. Cleanup removes the ticker callback, the scroll listener and destroys Lenis.
- `data-lenis-prevent` is also set on the navbar menu sheet, the tape dialog, and any element with its own scroll.

### 5.3 ScrollTrigger conventions

| Use | Trigger element | `start` | `end` | Mode |
| --- | --- | --- | --- | --- |
| Entry local progress `u` (scene poses, prints) | Entry `section` | `"top 85%"` | `"bottom 15%"` | `ScrollTrigger.create` with `onUpdate` writing `u` to the scene state. No scrub, no tween attached; the scene smooths with `POSE_LAMBDA` |
| Print points (`u = 0.20`, `u = 0.85` for the pending stamp) | Derived from `u` | | | Forward threshold crossing, once per page view (append-only) |
| Title rise | Entry `section` | `"top 85%"` | none | `once: true`, `onEnter` plays |
| Pinned stage progress `p` | Entry 05 stage wrapper | `"top top"` | `"bottom bottom"` | One timeline, `scrub: true` |
| Time-based moves fired by `p` (0.05, 0.18, 0.50, 0.90) | Same as above | | | Forward threshold crossing in `onUpdate`, once |
| Canvas out at entry 07 / back at entry 06 | Entry 07 `section` | `"top 70%"` | none | `onEnter`: `ex-canvas-out`; `onLeaveBack`: `en-canvas-return` |
| Canvas back at entry 10 / out again | Entry 10 `section` | `"top 85%"` | none | `onEnter`: `en-canvas-return`; `onLeaveBack`: `ex-canvas-out` |

Rules for every ScrollTrigger on the page:

1. Created top to bottom; `refreshPriority` equals the entry index (00 to 10) so refresh order matches page order even when islands mount out of order.
2. Attached only to top-level tweens or timelines, or created standalone. Never inside a nested timeline.
3. `scrub` and `toggleActions` are never combined on one trigger.
4. `id` follows `entry-NN:purpose`, for example `entry-05:stage`, `entry-02:pose`.
5. `invalidateOnRefresh: true` on any trigger whose values come from measured rectangles (lane, slot).
6. `fastScrollEnd: true` on triggers that start time-based tweens, so a fast exit completes them instead of leaving them half-done (U: option semantics from the GSAP docs, not re-fetched today; Q16 confirms).
7. `markers` is never true outside local development.
8. `ScrollTrigger.config({ ignoreMobileResize: true })` once, at clock start.
9. Refresh: once after `document.fonts.ready`; once when the route becomes visible again after Activity hides it; and from one `ResizeObserver` on `<main>` whose content-box height change of more than 1px triggers `ScrollTrigger.refresh()` debounced 200ms. That one observer covers FAQ `<details>` toggles, skip-ledger row expansion, the entry 04 Edit expansion and late images, so no component calls refresh itself.

### 5.4 Scrub values

**`scrub: true` everywhere. No numeric scrub.**

- Lenis already smooths wheel input; a numeric scrub would add a second lag on top and make the page feel heavy.
- The canvas-to-DOM hand-off at `p = 0.50` needs the slip to be exactly at the slot when the cross-fade fires. A scrub lag would fire the cross-fade while the slip is still travelling.
- On touch at 1024px and wider (tablets in landscape) native momentum is already smooth.

### 5.5 Pin rules

| Rule | Value |
| --- | --- |
| How pinning is done | CSS `position: sticky; top: 0` on a 100vh stage inside a 200vh wrapper. Never ScrollTrigger `pin` (no pin spacer, no `pinType` issues, and the layout is known before JavaScript) |
| Number of pins | One, entry 05 |
| Pinned scroll length | Exactly 100vh (wrapper 200vh minus stage 100vh) |
| Maximum pinned scroll on the page | 100vh (about 7% of the 1,440vh page). A second pin needs a change to this document |
| When the pin exists | `PIN_QUERY` matches (`min-width: 1024px` and `min-height: 640px`) and `<html data-motion="full">`. Both are known before first paint, so the 200vh wrapper never appears or disappears after paint |
| When it does not | Below 1024px, below 640px of viewport height (the stage content does not fit), effective Reduced, no JavaScript (no `data-motion` attribute). The stage is then normal flow and `mb-print-tear` (below 1024px) or the static printed receipt (Reduced, no JavaScript) is used |
| Tier 0 by hardware (no WebGL) at 1024px and wider | The pin stays (removing it after the idle tier probe would shift the page by 100vh). The stage runs its DOM-only variant `sq-stage-dom` (9.6). Deviation D4 |
| Content during the pin | Fits 100vh minus the 64px navbar; every control in it (the ghost receipt's Approve) is reachable by Tab; focus inside the stage does not move the scroll |
| Without GSAP but with the pin (GSAP failed to load) | The stage's server markup is its final state (mint, receipt, H2 on mint), so a visitor scrolls 100vh over a still paper stage and nothing is missing |

### 5.6 Anchor links, skip links and keyboard

Deviation D3: creative direction 10.1 sets Lenis `anchors: true`. That would smooth-scroll a "see 07" chip from the hero across about 900vh, sweeping every print and the feed on the way. Instead, one delegated click handler in `SmoothScroll` (1024px and wider, Lenis active) handles `a[href^="#"]` on the landing:

| Jump distance | Behaviour |
| --- | --- |
| Up to `SMOOTH_ANCHOR_MAX_VH` (2 viewport heights), e.g. "See how it works" from the hero to `#entry-02` | `lenis.scrollTo(target, { offset: -80, duration: 0.9, easing: easeTravel })` where `easeTravel` is the JS form of `--ease-travel` |
| More than 2 viewport heights (skip links, rail links, most claim chips) | `lenis.scrollTo(target, { offset: -80, immediate: true })` |
| Both | `history.pushState(null, "", hash)` so Back works; after arrival, focus moves to the target's heading (`tabindex="-1"`, `focus({ preventScroll: true })`); entries passed over post instantly by the monotonic rule (3.3) |

Everywhere else (below 1024px, Reduced, no JavaScript) anchors are native and instant: `html { scroll-behavior: auto; }` on the landing. `scroll-padding-top` is 80px at 1024px and wider and 128px below (navbar 64px + tape 48px + 16px), so a focused or targeted element is never hidden under fixed chrome (WCAG 2.4.11).

Keyboard: Space, Page Up, Page Down, arrows, Home and End are native and not smoothed (Lenis documents only wheel and touch listeners; Q14 confirms). Find-in-page, focus-driven scrolling and screen reader virtual cursors use native scroll, which Lenis follows. Nothing intercepts keyboard scrolling.

### 5.7 Posting without GSAP: `EntryPoster`

`EntryPoster` is the single posting mechanism at every width. One `IntersectionObserver`, `rootMargin: "0px 0px -15% 0px"`, `threshold: 0`, so an entry posts when its top crosses 85% of the viewport height, the same line as `ENTRY_START`. On intersect it applies the monotonic rule, sets `data-post="live"` on the entry, calls `ledgerStore.post(entryId)`, and unobserves the entry. At 1024px and wider `kt-line-rise` uses its own ScrollTrigger at the same `start`; the two fire within one frame of each other, and the title starts 80ms after the rule anyway.

`data-post` values: absent (no JavaScript: final state), `pending` (hidden start state), `live` (transitioning to final), `instant` (final with transitions suppressed: `[data-post="instant"] * { transition-duration: 0.01ms !important; }`).

### 5.8 Snapping

None. No `scroll-snap-type` on the landing, no Lenis snap, no ScrollTrigger `snap`. Snapping takes control from the visitor, fights keyboard and find-in-page, and was the usability complaint the research found most often. The stage holds still because it is sticky, not because scroll snaps to it.

### 5.9 Scroll-direction behaviour

None. The navbar never hides, nothing reacts to scroll direction or velocity (other than `fastScrollEnd` completing a move), and nothing reverses on scroll-up except poses (P3).

---

## 6. Micro-interactions

All micro-interactions are CSS. Hover rules sit inside `@media (hover: hover) and (pointer: fine)` so tapping on touch never leaves a stuck hover state. Every transition lists its properties explicitly; `transition: all` is banned (Q3).

### 6.1 Buttons and links

| Id | Element | Rest | Hover | Focus-visible | Pressed (`:active`) | Disabled / `aria-disabled` |
| --- | --- | --- | --- | --- | --- | --- |
| `mi-lime` | Lime pill (any lime candidate while it owns custody) | `--accent` fill, `--accent-ink` text | Fill `--accent-hover`, 300ms `--ease-utility` | `mi-focus` | Colour holds (hover colour); no transform | 50% opacity, `cursor: default` |
| `mi-lime` (non-owner) | The same candidate when it does not own custody | Default button style (`mi-default`), or `mi-on-mint` on the mint band | As that style | `mi-focus` | Colour holds | As above |
| `mi-default` | Default button | Ground fill, Phosphor White text and 1px border | Carbon fill, 300ms | `mi-focus` | Colour holds | As above |
| `mi-outlined` | Outlined button ("See how it works", "Edit") | Transparent, 1px Phosphor White border | Ground fill, 300ms | `mi-focus` | Colour holds | As above |
| `mi-ghost` | Ghost button ("Log in") | No border | Carbon fill, 300ms | `mi-focus` | Colour holds | As above |
| `mi-on-mint` | Outlined button on the mint band (ghost receipt Approve, non-owner candidates on mint) | Transparent, 1px `--on-mint-ink` border, `--on-mint-ink` text | Fill `rgba(0,0,0,0.06)`, 300ms | `mi-focus` on-mint variant | Colour holds | As above |
| `mi-link` | Inline link | Fern Link text, 1px underline, 3px offset | Text and `text-decoration-color` to Phosphor White, 300ms | `mi-focus` | Colour holds | n/a |
| `mi-nav-link` | Navbar and footer links, rail links | Sage 60 (rail: Sage 60 number) | Phosphor White, 300ms | `mi-focus` | Colour holds | n/a |
| `mi-chip` | Claim chip `see NN` (a link) | Transparent, 1px Circuit Border, Phosphor White text | Border Phosphor White, 300ms | `mi-focus` | Colour holds | n/a |

Citation chips (M4), SAMPLE chips (M6) and status badges are not interactive and have no hover. Cards (kept cards, plan cards, sample panels) are not interactive and have no hover, lift, scale, glow or shadow; only the controls inside them respond.

Lime hand-over (`ho-lime`) and hover share `background-color`. During a hand-over `LimeCustody` sets `data-lime-handover` on `<html>` for 300ms; under that attribute, candidates use `transition-duration: var(--dur-lime-step)` and the incoming owner adds `transition-delay: var(--dur-lime-step)`. The five owner selectors are written out explicitly (`html[data-lime-owner="hero"] [data-lime-candidate="hero"]` and so on), because CSS cannot compare two attribute values.

### 6.2 Controls

| Id | Element | Behaviour |
| --- | --- | --- |
| `mi-control` | `<select>`, radio, number input, text input | Brief input spec. Border colour transitions 300ms on hover (Fern Link to Moss 70); focus is the brief's 2px Phosphor White border plus 2px Moss 70 ring at 35%, instant |
| `mi-control` (range) | `<input type="range">` | 44px thumb, Phosphor White thumb on a Circuit Border track; no animation of the thumb; the value change drives `kt-odometer` elsewhere |
| `mi-row-toggle` | Skip ledger row `<button aria-expanded>`, rail entries | Hover: row background Ground, 300ms. The disclosure icon swaps orientation instantly (no rotation). The expanded content is not height-animated; it is simply present (layout change is user-initiated, so it is outside CLS) |
| `mi-details` | FAQ `<details>` (reused `faq-list.tsx`) | Open state changes colour only, 300ms. Content height is never animated. The marker swaps instantly |
| `mi-trace` | Entry 03 line and fact buttons | Hover and focus run `em-trace` and `en-path-draw` (trace). Leaving clears them: colour back 300ms, path `stroke-dashoffset` back to 1 in 300ms with `--ease-post` (a clear is a reset, not a retraction; `--ease-retract` is reserved for refusals) |

### 6.3 Focus

`mi-focus`: `:focus-visible { outline: 2px solid var(--foreground); outline-offset: 2px; }`. On the Mint Frost band: `outline-color: var(--on-mint-ink)` (Phosphor White on mint fails 3:1). The outline appears and disappears instantly; it is never transitioned, so keyboard feedback is never late. `:focus` without `:focus-visible` shows no outline on pointer clicks. Focus is never obscured: `scroll-padding-top` (5.6) and the rail sits in the page gutter, outside content.

### 6.4 Cursor

`mi-cursor`: the native cursor everywhere. No replacement, no follower dot, no magnetic buttons, no hover-scaled cursor. `cursor: pointer` on buttons, links, chips, `summary`, radio labels and row buttons; `cursor: default` on `aria-disabled` buttons. No custom cursor on the canvas, which is `pointer-events: none`.

### 6.5 Pointer tilt

`mi-tilt`: the slip's only pointer response.

| Property | Value |
| --- | --- |
| Active when | `(hover: hover) and (pointer: fine)`, tier 2, scene state `slip-open`, `slip-cite`, `slip-reply` or `slip-fresh`, no print in progress (including the flatten windows) |
| Off in | `slip-hold` (P5), `slip-feed` while feeding, the entry 05 stage, tier 1, tier 0, Reduced, below 1024px |
| Input | `pointermove` on `window` (passive). Target is the pointer's offset from the lane centre divided by half the lane size, clamped to [-1, 1]. Outside the lane rectangle (cached at refresh) the target is 0 |
| Output | Rotation y up to 6 degrees, x up to 3 degrees, added to the pose |
| Smoothing | `x += (target - x) * (1 - exp(-6 * dt))`; critically damped, no overshoot; returns to 0 when the pointer leaves |
| Cost | Marks the stage dirty only while the smoothed value is more than 0.01 degrees from its target; the callback allocates nothing |

---

## 7. Page-load sequence

### 7.1 Desktop, tier 2, full motion (1440 by 900)

| Time | Event | What the visitor sees |
| --- | --- | --- |
| Before paint | An inline script in `<head>` (7.4) sets `<html data-motion>`. Server HTML carries `data-lime-owner="hero"` | Nothing yet |
| First paint (FCP, the LCP frame) | H1 painted in Sage 60 words; subhead, CTAs, lime hero CTA, micro-label, lane caption, the DOM poster receipt (7.3) | The full first viewport, readable |
| FCP + 0 to 640ms | `kt-ink` (CSS) | Words step to Phosphor White, left to right |
| FCP + 700 to 1200ms | `kt-sign-rule` (CSS) | A 1px rule draws under "sign." |
| Hydration (typically 300 to 900ms) | `EntryPoster` marks entries below the fold `pending`, those in view `instant`; `LimeCustody` starts; on `MOTION_BREAKPOINT` with Full: `import("@/lib/motion/desktop")` loads GSAP, ScrollTrigger, SplitText and Lenis (about 54 kB gzip), then `startClock`, title splits, ScrollTriggers | No visible change |
| `load` + `requestIdleCallback` (timeout 2000ms) | Tier probe (`04-webgl-scene.md`) | No visible change |
| Probe + chunk load + `renderer.compileAsync` + first rendered frame | The stage is ready | No visible change |
| `max(ready, FCP + 1200ms)` | `en-poster-to-canvas`: canvas wrapper `opacity` 0 to 1 over 600ms, linear, over the identical poster. Then the poster gets `visibility: hidden` (kept for context loss) | The slip gains depth and curl |
| After that | `mi-tilt` active | The slip follows the pointer within 6 degrees |

If the visitor has already scrolled past the hero when the stage is ready, the canvas fades in at the current scene state with every posted line already printed (no sweep).

### 7.2 Other contexts

| Context | Difference |
| --- | --- |
| Tier 1 | Same timeline; flat slip, no tilt; cross-fade still 600ms |
| Tier 0 at 1024px and wider (no WebGL, saveData, failed probe) | No chunk; the DOM poster stays; from entry 01 the lane shows the visible DOM receipt list (`04-webgl-scene.md`); all DOM motion and Lenis run |
| Below 1024px | No GSAP, no Lenis, no canvas. Ink and sign rule run (CSS); `EntryPoster` handles posting; the hero mini receipt is static DOM |
| Reduced (any width) | Final state at first paint; no GSAP or Lenis download; no canvas |

### 7.3 LCP guard: the poster must not out-size the H1

The creative direction specifies an `<img>` poster at about 301 by 677px at 1440 by 900 (about 204,000px² of displayed area). The H1 at 101px over two lines covers roughly 800 by 192px (about 154,000px²). Chromium reports the largest painted image or text block as LCP, so that image would become the LCP element, loaded at `fetchpriority="low"`, and a late-painting image would replace the H1 as LCP.

Requirement from the motion system: **the H1 must be the LCP element at every width.** The poster is therefore DOM, not an image: the same mint receipt component used as the tier-0 lane receipt and the mobile mini receipt (header `KAIROS · RECEIPT · SAMPLE` and line `00 · Ledger opened`), posed in the `slip-open` pose with a CSS 3D transform (`perspective(1200px) rotateX(6deg) rotateY(-14deg) rotateZ(2deg)`, values from `04-webgl-scene.md`). A colour block with small text is never an LCP image, and its text nodes are far smaller than the H1. The canvas cross-fades over it; only the curl (top 22% of the slip) differs during the 600ms fade. If `04-webgl-scene.md` keeps an image poster, its displayed area must be under 0.8 times the H1's text area at 1024, 1280 and 1440 widths, checked by Q8. This is open item O1.

### 7.4 The head script (no flash, no hydration warning)

In `web/app/layout.tsx`, before any stylesheet-dependent content, with `suppressHydrationWarning` on `<html>`:

```html
<script>(function(){var d=document.documentElement,m="full",r=function(){try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}};try{var s=localStorage.getItem("kairos:motion");m=s==="full"||s==="reduced"?s:(r()?"reduced":"full")}catch(e){m=r()?"reduced":"full"}d.setAttribute("data-motion",m)})();</script>
```

The source string is exported as `MOTION_HEAD_SCRIPT` from `web/lib/motion/preference.ts` so the test in Q7 can run it.

### 7.5 No JavaScript

- Every heading, rule and row is in its final state (no `data-post` attribute means no hidden state).
- `kt-ink` and `kt-sign-rule` still run (CSS), or are final under the OS reduce setting (the media-query block in 2.6 applies without the attribute).
- No pin (the pin requires `data-motion="full"`); entry 05 is normal flow with the printed receipt on mint.
- Only the hero CTA is lime (server owner).
- Anchors are native and instant. The Motion control is rendered `hidden` and revealed on hydration, because it cannot work without JavaScript; the OS setting still applies through CSS.

### 7.6 Slow network and failures

| Situation | Behaviour |
| --- | --- |
| JavaScript arrives late | The page is complete and static until hydration. At hydration only entries still below 85% of the viewport get a hidden state; everything already seen stays final |
| Desktop motion module arrives late | Same rule for titles; the pinned stage reads the current `p` on creation and marks any passed thresholds done instantly |
| WebGL chunk not compiled within 10,000ms of idle start | Abort; stay on the DOM poster and DOM receipt list for this page view (not stored, so the next visit tries again) |
| `saveData` | Tier 0 (no chunk). Lenis and DOM motion still run (they are already in the 54 kB module) |
| Context lost | Canvas wrapper to `opacity: 0` instantly, DOM receipt list visible; one restore attempt; a second loss pins the session to tier 0 (`04-webgl-scene.md`) |
| Fonts late | `next/font` swap with metric-adjusted fallback; `autoSplit` re-splits titles and carries their tween progress; one `ScrollTrigger.refresh()` after `document.fonts.ready` |

---

## 8. Engine split

**One-line rule: if it is driven by scroll progress, drives the canvas, or needs line splitting, it is GSAP (1024px and wider only); everything else, including every response to a click or input, is a CSS transition keyed off one state attribute.**

| Engine | Owns | Loaded |
| --- | --- | --- |
| CSS (transitions and keyframes) | `kt-ink`, `kt-sign-rule`, `kt-title-rise`, `kt-letter-fall`, `kt-odometer*`, `kt-cell-swap`, `kt-tape-line`, `en-post-rule`, `en-post-square`, `en-row-print`, `en-compare-post`, `en-path-draw`, `en-rail-label`, `em-trace`, `ho-lime`, `ho-canvas-dom`, `en-poster-to-canvas`, `en-canvas-return`, `ex-canvas-out`, `ex-retract`, `ho-route`, `mb-print-tear`, all `mi-*`, the DOM parts of `sq-cite-save`, `sq-cite-refuse`, `sq-approve`, `sq-ghost-approve` | Always (part of `motion.css`) |
| GSAP core + ScrollTrigger + SplitText + `@gsap/react` | `kt-line-rise`, `ho-pose`, the entry 05 stage timeline (`ho-slip-travel`, `ex-stage-title`, `ho-mint-expand`, threshold callbacks), time-based canvas moves (`em-print`, `em-feed`, `em-stamp`, `ho-tear`, `ho-ghost-outline`, `ex-slip-lift`) tweened on plain scene-state objects so they share the ticker | Dynamic import at 1024px and wider with effective Full |
| Lenis | Wheel smoothing (5.1) | Same module |
| three (vanilla) | Rendering the scene from state | Lazy chunk after idle, tiers 1 and 2 |
| Motion for React (`motion/react`) | Nothing. Not installed on the landing | Never |
| Web Animations API | Nothing directly | Never |

Why Motion for React is not used, despite the `ecc:motion-*` skills recommending it: GSAP is already required for scrubbed scroll and SplitText; a second tween engine would cost 31 to 45 kB gzip, double the places where reduced motion and Activity cleanup must be handled, and its main strengths (springs, layout animation, presence exits) are things this page deliberately does not do. The skills' structural advice is kept: one token source, a single gate for reduced motion, SSR-safe start states, cleanup of every listener.

GSAP usage rules:

- `web/lib/motion/gsap.ts` (`"use client"`) registers `ScrollTrigger`, `SplitText` and `useGSAP` once and re-exports them; nothing imports `gsap/*` directly.
- Every GSAP call lives inside `useGSAP(() => { ... }, { scope })` and inside one `gsap.matchMedia()` handler with conditions `{ desktop: "(min-width: 1024px)", osReduce: "(prefers-reduced-motion: reduce)" }`. The handler returns immediately unless `desktop` is true and `getEffectiveMotion()` (reads `data-motion`) is `"full"`. `gsap.matchMediaRefresh()` runs when the Motion control changes.
- Callbacks created later (click handlers that start canvas moves) are wrapped with `contextSafe`.
- No `Date.now()`, `new Date()` or `Math.random()` in render; times are read in handlers and effects; elapsed time uses the ticker's time.

---

## 9. Sequences

Named moments composed from presets. Times are from the trigger.

### 9.1 `sq-hero-open` (entry 00)

`kt-ink` 0 to 640ms, `kt-sign-rule` 700 to 1200ms, then (when ready) `en-poster-to-canvas` 600ms. Nothing else moves; the lime CTA has no entrance; the subhead and microcopy have no entrance.

### 9.2 `sq-feed-stop` (entry 02, `slip-feed`, the chronos then kairos beat)

| Time from `u = 0.20` | Step | Preset |
| --- | --- | --- |
| 0 to 120ms | Slip flattens to rotation (0, 0, 0) (feed rows are decorative, so the feed may start during the flatten) | `ho-pose` override |
| 0 to 2400ms | 48 compressed SKIP or PASS rows feed up through the curl. All 48 rows are drawn into the texture before the feed starts (one upload); the feed animates only `uFeed` and `uPrintY` | `em-feed` |
| 2400 to 2600ms | Complete stop. Nothing moves | `--delay-feed-stop` |
| 2600 to 3120ms | Full-size `02 · Fit gate · hard rules first · every skip has a reason` prints (head 420ms, paper 520ms) | `em-print` |
| 3120 to 3320ms | Flat hold | |
| 3320 to 3920ms | Ease back to the `slip-feed` resting pose | `ho-pose` |

About 3.9s in total: the page's longest automatic sequence, under `MAX_AUTOPLAY_MS` (4.5s) and the 5s of WCAG 2.2.2. Rule changes print `RULES CHANGED · SAMPLE RE-CHECKED` with `em-print` at feed-row size, debounced 800ms after the last control change; that is visitor-triggered.

### 9.3 `sq-cite-save` (entry 03, cited preset)

| Time | Step |
| --- | --- |
| 0ms (click) | `data-cite-state="saving"`. The line is inserted into the diff (layout change inside the input's 500ms window, outside CLS) and runs `en-row-print` (240ms); its 1px `--good` left rule is part of the row |
| 120 to 540ms | Path draws from the line to fact #07 (`en-path-draw`, saved variant, 420ms) |
| 540ms | `data-cite-state="saved"`; status line "Saved. Cites fact #07." appears in the panel's reserved status line (no motion) |

### 9.4 `sq-cite-refuse` (entry 03, uncited preset)

| Step | Time | What | Preset |
| --- | --- | --- | --- |
| 1 | 0ms (click) | `data-cite-state="refusing"` | |
| 2 | 0 to 300ms | Path reaches 70% of the way from the pending slot toward the facts (`stroke-dashoffset` 1 to 0.30) | `en-path-draw` with `--dur-colour`, `--ease-post` |
| 3 | 300 to 420ms | Lock bracket halves `[ ]` move 4px toward each other and close | `--dur-swap`, `--ease-post` |
| 4 | 420 to 660ms | Path retracts (`stroke-dashoffset` 0.30 to 1) | `ex-retract` |
| 4b | 420ms | `role="alert"` text "Not saved. This line cites no confirmed fact." is inserted in the reserved status line (announced at once) | |
| 5 | 480 to 1160ms | Letters fall | `kt-letter-fall` |
| 6 | 1160ms | `data-cite-state="refused"` complete; the pending slot shows its placeholder text (no motion) | |

All CSS, keyed off `data-cite-state` with `transition-delay` per step, so it runs identically below 1024px. Groups: 1.

### 9.5 `sq-approve` (entry 04)

| Time | Step | Preset |
| --- | --- | --- |
| 0ms (click handler) | Read local time; `ledgerStore.approve(time)`; button label becomes "Approved · sample", `aria-disabled="true"`, opacity to 0.5 (300ms, `--ease-utility`), focus stays; inline `--good` text and the polite live region "Approved. Sample receipt updated." appear (no motion) | |
| 0 to 150ms, 150 to 300ms | Lime leaves the button, then fills the navbar "Start free" | `ho-lime` |
| 0 to 120ms | Slip flattens from (0, -4, 0) | `ho-pose` override |
| 120 to 640ms | Stamp line `04 · Approved by you · {time}` prints inside its signature box | `em-stamp` |
| 640 to 840ms, 840 to 1440ms | Flat hold, then ease back to the `slip-hold` pose | `ho-pose` |
| Same frame as the click | Entry 01 row 03 gains the stamp (instant, it is off screen) | `kt-cell-swap` rule |

Scroll never approves. If the visitor scrolls past `u = 0.85` without approving, `em-print` prints `04 · Awaiting your approval` once.

### 9.6 `sq-stage` (entry 05, 1024px and wider, pinned)

One GSAP timeline of length 1, attached to the stage wrapper with `scrub: true` (5.3); threshold callbacks fire once, forward only.

| `p` | Approved (`slip-tear`) | Not approved (`ghost-path`) | DOM |
| --- | --- | --- | --- |
| 0.05 | `em-print`: `05 · Submitted · employer form · fields saved` | `em-print`: `05 · Not sent · waiting for your approval` | Stage H2 already posted on Void |
| 0.18 | `ho-tear` (700ms, time-based) | `ho-ghost-outline` (300ms, time-based) | |
| 0.25 to 0.50 | `ho-slip-travel` (scrubbed, `--ease-travel` mapped): lane to slot, rotation to (0, 0, 0), scale to slot fit | Ghost outline travels the same path | |
| 0.50 | `ho-canvas-dom` (400ms; T1 240ms): canvas out, DOM receipt in; then canvas `visibility: hidden` | Dashed DOM receipt in with "No receipt yet. Nothing was sent." and `mi-on-mint` Approve | |
| 0.50 to 0.58 | | | `ex-stage-title` (scrubbed opacity) |
| 0.56 to 0.90 | `ho-mint-expand`: the mint layer goes from `translate(slot centre minus stage centre) scale(slotW / stageW, slotH / stageH)` to identity | Same, from the dashed rectangle | Lime custody falls to the navbar (no lime on mint) |
| 0.90 | | | Stage H2 re-enters on mint in `--on-mint-ink` with `kt-line-rise`; the two compact slips post with `en-row-print`. Deviation D5: creative direction 4.6 starts this at 0.86, but the top-left corner (where the H2 sits) is covered by mint only at 0.90, and a black H2 rising over Void would be invisible |
| 1.00 | Pin releases; the rest of entry 05 scrolls in normal flow on mint | | |

Reversibility: after the hand-off, scrolling back below 0.50 keeps the DOM receipt in the slot and the canvas hidden for the rest of entry 05 (append-only). `ho-mint-expand` and `ex-stage-title` remain scrubbed and reversible (they are poses). `will-change: transform` is set on the mint layer and the DOM receipt while the stage trigger is active and removed on leave.

`sq-stage-dom` (tier 0 at 1024px and wider, pin present): no canvas. At 0.05 the DOM receipt's rows are already printed in the slot at `opacity: 0`; at 0.50 the DOM receipt fades in (`ho-canvas-dom`, DOM half only); 0.56 to 0.90 `ho-mint-expand`; 0.90 H2 re-entry. The lane shows the DOM receipt list throughout.

### 9.7 `sq-ghost-approve` (entry 05, approve in place)

On click: `ledgerStore.approve(time)`; the dashed edge becomes solid (border-style is not animated; it changes in the same frame); "No receipt yet" is replaced by the receipt table, whose seven rows run `en-row-print` (60ms stagger, 240ms each, 600ms total); the Approved row shows the local time. No scroll happens. The canvas prints the stamp the next time it is visible (instantly, no sweep).

### 9.8 `sq-fresh` (entry 10, `slip-fresh`)

`en-canvas-return` (400ms) when entry 10 top reaches 85%. At `u = 0.20`: `ex-slip-lift` (600ms, `--ease-travel`), then the new slip feeds up from the head with its header `KAIROS · AT SIGN-UP` (paper advance 520ms, `--ease-post`), then `em-print` of `+25 credits · free grant · never expires` (520ms). About 1.7s. Then still.

### 9.9 `mb-print-tear` (entry 05, below 1024px)

The band is split so that body text is never on the wrong background: the H2 stays on Void above the band; the receipt sits in a band intro region (`[data-band-intro]`) that contains only the receipt; the band content below the intro is mint from the start, with the perforated edge at the intro's bottom. Deviation D6 (creative direction 9.1 scales the whole band, which would leave dark on-mint text sitting on Void for up to 1.9s).

| Time from the receipt being 50% in view (`IntersectionObserver`, `threshold: 0.5`) | Step |
| --- | --- |
| 0 to 600ms | Seven rows print (`en-row-print`) |
| 600 to 1300ms | The perforated stub separates: receipt `translateY(-8px)`, stub `translateY(12px)` and `opacity` to 0 (`--dur-tear`, `--ease-tear`) |
| 1300 to 1900ms | A mint layer in the intro region scales from the receipt's rectangle to the intro's full width and height (`--dur-post`, `--ease-travel`), joining the mint band below; the perforated edge moves to the intro's top in the same frame the layer completes |

`data-band` values: `idle`, `printing`, `torn`, `paper`. Ghost state as on desktop. Under Reduced: final state (`paper`) from the start.

---

## 10. Reduced-motion matrix

Columns: **Full** is the desktop tier 2 behaviour; **Below 1024px** is the phone and tablet portrait composition with full motion; **Reduced** applies at any width when the OS asks for reduced motion (and the visitor has not chosen Full) or the visitor chose Reduced. The canvas tier differences follow in 10.2.

### 10.1 DOM and scroll presets

| Preset | Full | Below 1024px | Reduced |
| --- | --- | --- | --- |
| `kt-ink` | 5 words, 360ms each, 70ms stagger | Same | Final colour at first paint |
| `kt-sign-rule` | 500ms from 700ms | Same | Rule present at first paint |
| `kt-line-rise` | SplitText line rise, 700ms, 70ms stagger | Not used (`kt-title-rise`) | Not created; titles static |
| `kt-title-rise` | Not used | Whole-title rise, 700ms | Not applied; titles static |
| `kt-letter-fall` | 21 glyphs, 18ms stagger, 320ms | Same | Line removed in one frame; same alert text |
| `kt-odometer` / `kt-odometer-price` | 240ms / 360ms roll | Same | Instant value; live region still announces |
| `kt-cell-swap` | 120ms cross-fade when in view | Same | Instant text change |
| `kt-tape-line` | n/a | 600ms slide | Instant text change |
| `en-post-rule` | 600ms draw | Same | Drawn from first paint |
| `en-post-square` | 300ms colour fill | Same | 300ms colour fill (colour is kept) |
| `en-row-print` | 240ms, 60ms stagger | Same | Rows present |
| `en-compare-post` | 600ms, 90ms stagger | Same | Rules present |
| `en-path-draw` | 300ms trace, 420ms saved | Same | Path appears without drawing |
| `en-rail-label` | 200ms opacity and 4px slide | n/a (rail at 1280px and wider) | Instant |
| `em-trace` | 300ms colour | Same | 300ms colour (kept) |
| `ho-lime` | 150ms out, 150ms in | Same | Instant swap |
| `ex-retract` | 240ms | Same | Path disappears in one frame |
| `ex-stage-title`, `ho-slip-travel`, `ho-mint-expand`, `sq-stage` | Pinned, scrubbed | No pin (`mb-print-tear`) | No pin; entry 05 in normal flow: Void header, mint band, receipt printed |
| `mb-print-tear` | n/a | 1.9s composite | Final `paper` state |
| `ho-route` | 240ms cross-fade | Same | `animation-duration: 0s` on `::view-transition-old(*)`, `::view-transition-new(*)`, `::view-transition-group(*)` |
| `mi-*` hover and focus | 300ms colour | Same (hover only with a fine pointer) | 300ms colour (kept) |
| `mi-tilt` | Active on tier 2 | n/a | Off |
| Lenis | Wheel smoothing | Not loaded | Not mounted |
| Anchors | Smooth up to 2 viewports, instant beyond | Instant | Instant |
| Footer clock | Updates once per minute | Same | Shows only "KAIROS WHEN YOU APPROVE"; does not update (11.1) |

### 10.2 Canvas presets by tier

| Preset | T2 Full | T1 Lite | T0 (motion allowed, no WebGL) | Reduced |
| --- | --- | --- | --- | --- |
| `en-poster-to-canvas` | 600ms over the DOM poster | Same | No canvas; DOM poster stays | No canvas; the DOM poster stays in its static CSS pose (a still pose is not motion) |
| `ho-pose` | Smoothstep plus `POSE_LAMBDA` | Same at 30fps (dt-corrected, same speed) | DOM receipt list in the lane, updated as entries post | DOM receipt list, updated instantly |
| `em-print`, `em-stamp` | 420ms head, 520ms paper | Same at 30fps | Line appended to the DOM list with `en-row-print` | Line appended instantly |
| `em-feed` | 2400ms, 48 rows | Same at 30fps, half-size texture | DOM list appends the 02 line only (the 48 rows are not shown in the lane; the skip ledger in the demo holds them) | Same as T0, instant |
| `ho-tear` | Perforation split, lift, curl relax | Straight split, no curl | `sq-stage-dom` | No pin, no tear; printed receipt on mint |
| `ho-ghost-outline` | 300ms | Same | DOM ghost receipt fades in at `p = 0.50` | Dashed ghost receipt present |
| `ho-canvas-dom` | 400ms | 240ms | DOM half only | n/a |
| `ex-slip-lift`, `sq-fresh` | 600ms lift, feed, print | Same at 30fps | DOM list: fresh header and the +25 line appended with `en-row-print` | Appended instantly |
| `en-canvas-return`, `ex-canvas-out` | 400ms | 240ms | n/a | n/a |
| `mi-tilt` | On (fine pointer) | Off | n/a | Off |

Rule: the WebGL chunk is never downloaded under Reduced (Q6).

---

## 11. Pause, stop and hide (WCAG 2.2.2) and the Motion control

### 11.1 What the criterion covers here

WCAG 2.2.2 (Level A) requires a way to pause, stop or hide moving, blinking or scrolling content that starts automatically, lasts more than 5 seconds and is shown alongside other content, and likewise for auto-updating content.

| Content | Starts automatically? | Duration | Treatment |
| --- | --- | --- | --- |
| All presets and sequences | Triggered by scroll or input; treated as automatic to be safe | Longest is `sq-feed-stop` at about 3.9s; every other sequence is under 2s | Under 5s by design. `MAX_AUTOPLAY_MS` = 4500 is enforced by Q5. No loops exist, so no motion can exceed its stated duration |
| Scrubbed stage and poses | No; they move only while the visitor scrolls | Unbounded but continuous input | Not automatic movement |
| Pointer tilt | No; follows the pointer | | Not automatic movement |
| Footer clock line (`aria-hidden`) | Yes | Updates once per minute indefinitely | Auto-updating content: the Motion control is its stop mechanism. Under Reduced it shows only the server text "KAIROS WHEN YOU APPROVE" and stops updating (a frozen time would be inaccurate, so the time is hidden rather than frozen) |
| Receipt tape | No; changes when the visitor scrolls | | Not automatic |

Because nothing on the page moves automatically for more than 5 seconds, the criterion is met without a pause button. The Motion control (11.2) is provided anyway, as the site-wide setting route of WCAG 2.3.3 and as the stop mechanism for the clock.

### 11.2 The Motion control (`MotionToggle`)

| Property | Value |
| --- | --- |
| Footer instance (`variant="full"`) | A labelled radio pair inside a `<fieldset>` with legend "Motion": "Full" and "Reduced". 44px targets, 8px apart |
| Early instance (`variant="compact"`) | At 1024px and wider: a text button in the hero lane caption row, after "Sample receipt. It prints as you read." Below 1024px: in the navbar menu sheet. `aria-pressed` reflects Reduced. Label text from `06-copy-deck.md` (open item O3). Reason: a visitor who needs reduced motion should find the switch before the story starts, not in the footer |
| Initial state | Reflects `<html data-motion>` (the OS setting unless a stored choice exists) |
| On change | Write `localStorage["kairos:motion"]` in try/catch; call `completeAll()` (every running GSAP tween and timeline to `progress(1)`, every CSS sequence to its final `data-*` state, store writes committed); set `data-motion`; call `gsap.matchMediaRefresh()`; mount or destroy Lenis; if Reduced, unmount the stage and free the renderer; if Full and at 1024px and wider, load the desktop module and run the tier probe. Announce "Motion reduced." or "Motion on." in a polite live region |
| Layout | The pinned stage wrapper height changes with the setting; that layout change follows the visitor's input and is outside CLS; the `<main>` ResizeObserver refreshes ScrollTrigger |
| No JavaScript | Rendered with `hidden` and revealed on hydration |
| Module | `web/lib/motion/preference.ts` exports `MOTION_STORAGE_KEY`, `MOTION_HEAD_SCRIPT`, `getEffectiveMotion()`, `setMotion(value)`, `subscribeMotion(callback)`, `completeAll()` |

---

## 12. Performance rules

### 12.1 Animated properties allowlist

| Property | Where | Why allowed |
| --- | --- | --- |
| `transform` (translate, scale, scaleX) | All moving presets | Compositor-only |
| `opacity` | Cross-fades, row print, letter fall | Compositor-only |
| `color`, `background-color`, `border-color`, `text-decoration-color`, `fill`, `stroke` | Utility colour, `kt-ink`, `ho-lime`, `en-post-square`, `em-trace` | Paint only, no layout; the brief's utility motion |
| `stroke-dashoffset` | `en-path-draw`, `ex-retract` | Paint on a small SVG (under 400 by 200px) |
| Canvas uniforms | Scene | GPU |

Banned: `width`, `height`, `top`, `left`, `right`, `bottom`, `margin`, `padding`, `font-size`, `letter-spacing`, `font-weight`, `line-height`, `border-width`, `box-shadow`, `filter`, `backdrop-filter`, `clip-path` and `mask` animation, `transition: all`. Content height of disclosures is never animated. Q3 greps the landing CSS and GSAP calls against this list.

### 12.2 `will-change` policy

- Never in a stylesheet rule that is always active.
- CSS keyframe animations (`kt-ink`, `kt-sign-rule`) need none; the browser promotes them.
- CSS transitions on transforms: `will-change: transform` is added by the state change that starts the transition (the same attribute selector) and removed when the state settles (`data-post="live"` becomes no attribute on `transitionend` of the last element).
- The stage's mint layer and DOM receipt carry `will-change: transform, opacity` only while `entry-05:stage` is active.
- GSAP tweens use its default `force3D: "auto"` (promotes during the tween, releases after).
- At most `MAX_WILL_CHANGE` (4) elements at once. The fixed canvas wrapper needs none.

### 12.3 Offscreen and idle

- The canvas renders only when dirty (`04-webgl-scene.md`); at rest the GPU does nothing. The ticker's idle cost (Lenis `raf` with no velocity) stays under 0.3ms per frame.
- The canvas is `visibility: hidden` and never dirty through entries 07 to 09, after the entry 05 hand-off, when `document.hidden`, and when its wrapper is fully transparent.
- Once-only triggers are killed after firing (`once: true`); `EntryPoster` unobserves posted entries; the observer disconnects when all eleven have posted.
- `visibilitychange` to hidden: no work is scheduled. On return, `lagSmoothing(0)` lets any running tween jump to its end state instead of replaying; nothing catches up visibly.
- Below 1024px there is no requestAnimationFrame loop at all; motion is CSS plus one IntersectionObserver.

### 12.4 Frame budget

| Budget | Value |
| --- | --- |
| Main thread per frame while scrolling (Lenis, ScrollTrigger, scene CPU, style, paint) | 8ms or less on a mid-range laptop at 60Hz; scene CPU 3ms or less |
| GPU per rendered frame | 8ms or less on T2; 16ms or less on T1 (30fps cap) |
| Render rate cap | 60fps on T2 (on 120Hz displays render every second frame), 30fps on T1 |
| Long tasks after hydration | None over 50ms; SplitText splits under 6ms total; one texture draw plus upload per print event under 4ms on T2 |
| Texture uploads | One per print event. The 48-row feed is one print event: all rows are drawn before the feed starts, and the feed moves uniforms only (open item O2 for `04-webgl-scene.md`, which currently says one upload per printed line; 48 uploads of a 1024 by 2304 RGBA texture in 2.4s is about 450MB of transfer) |
| Per-frame callbacks | No object allocation, no `getBoundingClientRect`, no `forEach` with fresh closures; rectangles are measured on refresh only |
| INP | 100ms or less: input handlers update state synchronously and start CSS transitions; no layout reads in handlers |
| CLS | 0.05 or less: no layout animation; fixed-width odometers; reserved status lines; the pin decided before paint |
| Navbar blur | `backdrop-filter: blur(10px)` is re-rasterised while content scrolls under it. On `<html data-tier="1">` the navbar uses an opaque Carbon Veil at 96% with no blur |

### 12.5 Cleanup and Activity

Everything created in an effect is destroyed in its cleanup: Lenis, ticker callbacks, ScrollTriggers, SplitText instances (reverted), matchMedia handlers, observers, pointer listeners, the renderer (`dispose()` and `forceContextLoss()`). When the `cacheComponents` Activity behaviour hides and re-shows the route, every island re-creates from `ledgerStore` and prints posted lines at once. Exactly one Lenis instance and one clock may exist (Q22).

---

## 13. Motion QA checklist

Each item names a check and its pass criterion. Automated items run in CI (Playwright, Vitest); manual items are signed off before design lock.

| # | Check | How | Pass criterion |
| --- | --- | --- | --- |
| Q1 | Principles review | Manual: each preset in 3.6 against P1 to P8 | Every preset passes all eight |
| Q2 | No motion literals | CI grep over `web/components/landing/**` and `web/lib/motion/**` (excluding `tokens.ts`) for `cubic-bezier(`, `\d+ms`, `duration:\s*\d`, `stagger:\s*\d`, `ease:\s*"` | Zero matches |
| Q3 | Property allowlist | CI grep of landing CSS for `transition` and `animation` property lists and of GSAP calls for animated keys | Only properties in 12.1; no `transition: all` |
| Q4 | Token parity | Vitest `tokens.test.ts` | CSS `:root` values equal the TS mirror; the two reduced blocks are identical |
| Q5 | Duration and concurrency | Playwright at 1440 by 900 with `NEXT_PUBLIC_E2E=1` (exposes `window.__kairosMotion = { gsap, ScrollTrigger }`): scroll the page in 100px steps and act on every control; every 50ms sample `document.getAnimations()` running entries and active GSAP tweens whose targets intersect the viewport, grouped by trigger | No group runs longer than 4500ms; never more than 2 groups at once |
| Q6 | Reduced motion | Playwright with `reducedMotion: "reduce"` at 1440 and 390 | No `<canvas>`; no WebGL chunk, GSAP or Lenis request; no running animation except colour; all landing text present; entry 05 not pinned |
| Q7 | Motion toggle | Playwright: choose Reduced mid-feed (entry 02), then Full; also OS reduce with stored Full | Feed completes instantly and the 02 line is present; reduced variants apply; Full restores the scene; with OS reduce plus Full, Lenis smoothing stays off; head script output matches the stored value with no flash (first frame screenshot) |
| Q8 | LCP | Lighthouse and a PerformanceObserver at 1024, 1280, 1440 and 390, simulated mid-range Android on 4G | LCP element is the H1 at every width; LCP 1.5s or less desktop, 2.5s or less mobile; H1 has no `opacity: 0` in server HTML |
| Q9 | No JavaScript | Playwright `javaScriptEnabled: false` | Every title `transform: none`; every rule `scaleX(1)`; entry 05 in normal flow; only the hero CTA lime; Motion control hidden |
| Q10 | CLS | Full-page scroll trace at 1440 and 390 | CLS 0.05 or less |
| Q11 | INP | Playwright interaction timing on every control | 100ms or less |
| Q12 | Frames | Chrome performance trace of a full scroll at 1440 by 900, T2, 4x CPU throttle off and on | No dropped-frame run longer than 3 frames outside the first canvas compile; no long task over 50ms after hydration |
| Q13 | Pin | Playwright at 1440 by 900, 1024 by 600, 1023 by 900 | Stage pinned for exactly 900px of scroll at 1440 by 900; not pinned at 600px height or below 1024px width |
| Q14 | Keyboard and find | Manual and Playwright: Space, Page Down, arrows, Home, End through the page; Ctrl+F for a word in entry 07; Tab through every control | Native stepping (not smoothed); find lands with the match visible; focused elements are never under the navbar or tape |
| Q15 | Anchors | Playwright: "See how it works" from the hero; "Skip to pricing"; a rail link; then Back | Short jump is smooth (about 0.9s), long jumps are instant; target heading is focused; Back returns to the previous position |
| Q16 | Jump posting | Playwright: from the top, activate "Skip to pricing" | Entries 00 to 06 are posted with no running animation 100ms after arrival; the feed sweep is never visible |
| Q17 | Append-only | Playwright: scroll to entry 06, then back to the top; reload at entry 05 | No line un-prints; the tear does not reverse; on reload, posted lines appear without a sweep |
| Q18 | Lime count | Creative direction 3.3 check (100px steps, 1440 by 900 and 390 by 844, 400ms wait) | Never more than one visible element with background `rgb(127, 238, 100)`, including during hand-overs |
| Q19 | Touch hover | Playwright with `hasTouch: true`, tap every button | No hover style persists after a tap |
| Q20 | Focus | axe-core plus manual at 375, 768, 1024, 1440 | Every focusable element shows the 2px outline, on mint in `--on-mint-ink`; outline appears without delay |
| Q21 | Background tab | Manual: switch tabs during `sq-feed-stop`, return after 10s | No replay; final state shown |
| Q22 | Lifecycle | Playwright: navigate to `/pricing` and back three times; resize from 1440 to 900 and back | `ScrollTrigger.getAll()` count equals the first-load count; one `html.lenis` instance; below 1024px `ScrollTrigger.getAll().length` is 0 and no ticker callback is registered |
| Q23 | Descenders | Screenshot every entry title at 390, 1024 and 1440 during and after the rise | No clipped descenders |
| Q24 | Curve fidelity | Vitest: sample each GSAP built-in and its cubic-bezier at 101 points | Maximum absolute difference under 0.05 of progress |
| Q25 | Browsers | Manual: Safari 60fps cap, macOS Low Power Mode (30fps), iPad landscape, Firefox, Chrome | Stage hand-off aligns within 2px; no pin jitter; no sequence longer than specified |
| Q26 | Vestibular review | Manual, OS reduce off: one reviewer scrolls the page slowly and quickly | Nothing moves without scroll or input except `sq-hero-open` and the poster cross-fade; no parallax on text; no motion larger than the slip travel |
| Q27 | Stillness | Playwright at entry 04 with the viewport centred on the Approve button, 3s without input | Zero running animations and zero rendered canvas frames |

---

## 14. Deviations from `01-creative-direction.md`

Each is a change in implementation or timing; none changes copy, ids or scene states.

| # | Creative direction says | This document specifies | Reason |
| --- | --- | --- | --- |
| D1 | Line rise starts at `translateY(105%)` | 115%, with a 0.12em padded mask | Descenders would otherwise be clipped permanently; 105% would show the top of the line inside the padded mask |
| D2 | Letter fall uses SplitText `type: "chars"` | Server-split character spans animated by CSS | The string is a fixed preset; the same code works below 1024px where GSAP is not loaded |
| D3 | Lenis `anchors: true` | `anchors: false` plus a delegated handler: smooth up to 2 viewports, instant beyond, focus moved, history kept | A smooth scroll across 900vh sweeps every print and the feed and takes several seconds |
| D4 | Tier 0 puts entry 05 in normal flow | Tier 0 by hardware keeps the pin with `sq-stage-dom`; only Reduced, small viewports and no JavaScript remove it | The tier is known only after idle; removing a 100vh pin then would shift the page |
| D5 | Stage H2 re-enters at `p` 0.86 | 0.90 | The H2's corner is covered by mint only at 0.90 |
| D6 | Mobile mint band scales from the receipt to full width | Mint grows inside a receipt-only intro region; band content below is mint from the start | Dark on-mint body text would otherwise sit on Void during the 1.9s sequence |
| D7 | Hero poster is an AVIF `<img>` | DOM receipt posed with CSS 3D (7.3) | The image would be larger than the H1 and become the LCP element |
| D8 | Pose lerp 0.12 per frame | `POSE_LAMBDA` 7.7 per second, dt-corrected | Same feel at 60fps; correct speed at 30fps on T1 |
| D9 | One texture upload per printed line | One upload per print event; the feed is one event | Bandwidth (12.4) |
| D10 | A Motion toggle in the footer | Footer plus a compact early instance (hero lane caption at 1024px and wider, menu sheet below) | Reach the setting before the story starts |

---

## 15. Interfaces for sibling documents

| Document | Must use or provide |
| --- | --- |
| `02-design-system.md` | Declares the tokens in 2.1 to 2.4 with these exact names and values in the landing token block of `globals.css`, plus the reduced block in 2.6. Defines `--on-mint-ink` used by `mi-focus` on mint |
| `04-webgl-scene.md` | Uses `EASE` and `DUR` from `web/lib/motion/tokens.ts` for every time-based canvas move; uses `POSE_LAMBDA` and `TILT`; fires `em-print`, `em-feed`, `em-stamp`, `ho-tear`, `ho-ghost-outline`, `ho-slip-travel`, `ex-slip-lift` at the trigger points in 9; renders from `startClock(stage)`'s ticker only; resolves O1 (poster) and O2 (feed upload) |
| `05-architecture.md` | Places `web/lib/motion/tokens.ts`, `gsap.ts`, `clock.ts`, `preference.ts`, `desktop.ts` (the dynamic-import entry that starts the clock, title rises, stage timeline and anchor handler) and `web/components/landing/motion.css`; islands `SmoothScroll`, `EntryPoster`, `LimeCustody`, `MotionToggle` (variants `full`, `compact`), `ReceiptTape`, `FooterClock`, `StageLoader`, `Stage`; the head script in `web/app/layout.tsx` with `suppressHydrationWarning`; `ledgerStore` methods `post`, `approve`, and the flags `feedDone`, `torn` |
| `06-copy-deck.md` | Provides the compact Motion control label (O3) and the live-region strings "Motion reduced." and "Motion on." |

### 15.1 Open items

| # | Item | Owner |
| --- | --- | --- |
| O1 | Confirm the DOM poster (7.3), or keep an image poster under 0.8 times the H1 text area at 1024, 1280 and 1440 | `04-webgl-scene.md` |
| O2 | Feed rows pre-drawn into one texture upload (12.4) | `04-webgl-scene.md` |
| O3 | Copy for the compact Motion control and its announcements | `06-copy-deck.md` |
| O4 | Confirm on the first spike: Lenis leaves keyboard scrolling native (Q14); `fastScrollEnd` semantics (Q16); the SplitText mask class `kt-line-mask` (Q23) | Web owner |
