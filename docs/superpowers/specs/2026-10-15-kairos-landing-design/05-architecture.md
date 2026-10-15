# Kairos landing page: technical architecture

Date: 2026-10-15. Status: specification for implementation planning. Owner: architecture.

This document says how the landing page described in `01-creative-direction.md` (CD, "the Ledger") is built inside the existing `web/` Next.js app: which files exist, which components render on the server and which hydrate, which libraries load when, how one clock drives scroll, tweens and WebGL, how capabilities and preferences are detected, how the canvas mounts and fails, how shared components are reused without breaking `/pricing` and `/how-it-works`, how the app-wide token migration is sequenced, what the budgets are and how they are enforced, how the page is tested, and what can go wrong with Next.js 16 and React 19.

It is written after, and aligned with, `02-design-system.md` (DS), `03-motion-system.md` (MS) and `06-copy-deck.md` (COPY). Where those documents asked this one to decide something (DS Q3, DS Q5, DS Q10, MS section 15), the decision is in section 15. Section 14 lists every interface name in one place.

---

## 0. Inputs, verification and skills

### 0.1 Inputs read

| Input | Used for |
| --- | --- |
| `01-creative-direction.md` (all 912 lines) | Section ids, scene state ids, marks, motion grammar, tiers, store fields, budgets, checks |
| `02-design-system.md`, `03-motion-system.md`, `06-copy-deck.md` (interfaces, scope, motion runtime, copy keys) | Name alignment; the decisions they delegated here |
| `_research/code-inventory.md`, `_research/stack-feasibility.md`, `_research/facts.md` summary | Current files, boundaries, blast radius, pinned versions, measured sizes, what may be claimed |
| Repo files read directly | `web/package.json`, `web/next.config.ts`, `web/tsconfig.json`, `web/eslint.config.mjs`, `web/proxy.ts`, `web/app/layout.tsx`, `web/app/globals.css`, `web/app/(public)/layout.tsx`, `web/app/(public)/page.tsx`, `web/app/sitemap.ts`, `web/lib/site.ts`, `web/components/shared/{button,container,cta-band,faq-list,how-it-works-steps,logo,pricing-plans,section-heading}.tsx`, `web/components/layout/{navbar,footer}.tsx`, `web/components/landing/*`, `shared/src/plans.ts`, `server/src/services/stripe.ts`, `server/src/services/fit.ts`, root, server and extension `package.json` |

### 0.2 Facts checked online on 2026-10-15

| Fact | Source | Consequence here |
| --- | --- | --- |
| With `cacheComponents`, Next.js hides the previous route with React `<Activity mode="hidden">` instead of unmounting it; "Effects are cleaned up when a route is hidden, and recreated when it becomes visible again." | nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents | Every global side effect is created in an effect and undone in its cleanup (4.8) |
| Activity "keeps the DOM in the document (hidden with `display: none`)"; "Next.js preserves up to 3 routes"; broad `:root:has(...)` selectors are discouraged in favour of `data-*` attributes; Playwright `getByRole` filters hidden Activity content and raw locators do not; transient UI resets in a `useLayoutEffect` cleanup | nextjs.org/docs/app/guides/preserving-ui-state | Landing scope is a React-owned element (`.lp`, 1.3); tests use visibility-aware locators (10.1) |
| `ensureStatic` accepts `'auto' \| 'shell' \| 'prefetch' \| 'navigation' \| false`, requires `cacheComponents`, introduced in 16.4.0; `'navigation'` validates the complete server-rendered route in `next dev` and `next build`; exporting it from a Client Component throws | nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/ensureStatic | `web/app/(landing)/page.tsx` exports `ensureStatic = 'navigation'` and stays a Server Component |
| `ssr: false` with `next/dynamic` is not allowed in Server Components | nextjs.org/docs/app/guides/lazy-loading | Both lazy loaders (`SmoothScroll`, `StageLoader`) are Client Components |
| `next/image`: `priority` deprecated since 16.0.0 in favour of `preload`; `images.qualities` defaults to `[75]` | nextjs.org/docs/app/api-reference/components/image; version 16 upgrade guide | The landing ships no raster image in the page; the Open Graph image is a static file referenced by metadata |
| Next 16: Turbopack is the default for `next build` and a custom `webpack` config fails the build; `next lint` is removed; `next build` no longer prints `size` or `First Load JS`; Next no longer overrides `scroll-behavior: smooth` during navigation unless `<html data-scroll-behavior="smooth">` | nextjs.org/docs/app/guides/upgrading/version-16 | Shaders stay TypeScript strings; budgets are enforced by our own byte test (9.3); no global smooth scroll |
| `env` in `next.config.ts` still works (badge "Legacy"); values are inlined at build time | nextjs.org/docs/app/api-reference/config/next-config-js/env | `BUILD_DATE` is injected this way (2.6) |
| npm registry: `@playwright/test` 1.64.0 (2026-10-07) and 1.64.1 (2026-10-14); `@axe-core/playwright` 4.13.0; `vitest` 5.0.4 (already used by `server` and `extension`); `@lhci/cli` 0.15.1. The server already depends on `playwright-core` ^1.64.0 | registry.npmjs.org | Test tooling pins in 3.1 |
| Repository search for analytics SDKs | Local grep | None present (section 11) |

Facts inherited from `stack-feasibility.md` (verified there the same day) are not repeated: library versions, the GSAP licence, the Lenis and ScrollTrigger sync recipe, measured gzip sizes.

### 0.3 Skills applied

`nextjs-best-practices`, `react-best-practices`, `gsap-skills:gsap-react` and `web-performance-optimization` all loaded. Applied as guidance: Server Components by default with leaf client islands, error boundaries around lazy parts, dynamic imports for heavy components (Next skill); no barrel imports, conditional loading of heavy modules after hydration, minimal data across the server/client boundary, external store via `useSyncExternalStore`, primitive effect dependencies, deduplicated global listeners (React skill); `useGSAP` with a `scope`, `contextSafe` for later callbacks, no GSAP during SSR, `gsap.matchMedia` inside `useGSAP` (GSAP skill); measure first, explicit dimensions, lazy non-critical JavaScript, Lighthouse plus real byte counts (performance skill).

---

## 1. File and folder structure

### 1.1 Tree

Legend: `[S]` Server Component or server-only module, `[C]` Client Component (`"use client"`), `[M]` plain TypeScript module with no directive, `[CSS]`, `[D]` data, `[T]` test. Status: `(new)`, `(edit)`, `(move)`, `(delete)`. Owner documents in brackets where another document defines the internals.

```
web/
├─ app/
│  ├─ layout.tsx                                [S] (edit)  next/font Inter + Inter_Tight; <html data-lime-owner="hero" suppressHydrationWarning>;
│  │                                                        <head> inline MOTION_HEAD_SCRIPT [MS 7.4]
│  ├─ globals.css                               [CSS] (edit, prerequisite P2) [DS 1]
│  ├─ (landing)/                                            route group for "/" only
│  │  ├─ layout.tsx                             [S] (new)   <LandingShell>{children}</LandingShell>
│  │  └─ page.tsx                               [S] (move from (public)/page.tsx, rewritten) ensureStatic, metadata, JSON-LD, entries, colophon
│  └─ (public)/
│     ├─ layout.tsx                             [S] (unchanged) still serves /pricing, /how-it-works, /about, /blog, /careers, /contact
│     └─ page.tsx                               (delete) "/" now resolves to (landing)/page.tsx
├─ components/
│  ├─ layout/
│  │  └─ navbar.tsx                             [C] (edit)  variant="default" | "landing", caption and sheetExtra slots, lg breakpoint, <dialog> sheet
│  ├─ shared/
│  │  ├─ button.tsx                             [S] (edit, P2) tokenised hover, radii [DS]
│  │  ├─ logo.tsx                               [S] (edit, P2) data-logo-mark on the square, rx 0 [DS 6.12]
│  │  ├─ faq-list.tsx                           [S] (edit)  Faq.a widened from string to ReactNode
│  │  └─ pricing-plans.tsx                      [C] (edit, P2) Carbon interval segment, neutral badge; exports INTERVAL_LABEL and PER
│  └─ landing/
│     ├─ landing.css                            [CSS] (new) [DS 1.4] landing tokens on .lp, lp-* classes, custody rules
│     ├─ motion.css                             [CSS] (new) [MS 3.6] CSS presets (en-*, kt-*, ho-*, ex-*, mb-*, mi-*)
│     ├─ landing-shell.tsx                      [S] (new)   <div class="lp">: Navbar variant="landing", <main>, shared Footer; imports both CSS files
│     ├─ json-ld.tsx                            [S] (new)   FAQPage + Organization script element
│     ├─ entries/
│     │  ├─ entry.tsx                           [S] (new)   entry shell: number, graticule rule, eyebrow, H2, body, settlement line
│     │  ├─ entry-00-hero.tsx                   [S] (new)
│     │  ├─ entry-01-reported.tsx               [S] (new)
│     │  ├─ entry-02-fit-gate.tsx               [S] (new)
│     │  ├─ entry-03-truth-lock.tsx             [S] (new)
│     │  ├─ entry-04-approve.tsx                [S] (new)
│     │  ├─ entry-05-send-receipt.tsx           [S] (new)
│     │  ├─ entry-06-replies.tsx                [S] (new)
│     │  ├─ entry-07-billing.tsx                [S] (new)
│     │  ├─ entry-08-compare.tsx                [S] (new)
│     │  ├─ entry-09-questions.tsx              [S] (new)
│     │  ├─ entry-10-start.tsx                  [S] (new)
│     │  └─ colophon.tsx                        [S] (new)   section "footer": page receipt, clock line, Motion control
│     ├─ marks/
│     │  ├─ entry-rule.tsx                      [S] (new)   M1 + M2
│     │  ├─ posting-square.tsx                  [S] (new)   M3
│     │  ├─ chip.tsx                            [S] (new)   M4 CitationChip, M5 ClaimChip, M6 SampleChip
│     │  ├─ sample-frame.tsx                    [S] (new)   M6 dashed frame with the SAMPLE chip
│     │  ├─ perforation.tsx                     [S] (new)   M7
│     │  ├─ stamp.tsx                           [S] (new)   M9 signature box shell
│     │  └─ receipt-paper.tsx                   [S] (new)   mint paper: DOM poster, mini receipt, lane receipt, DOM receipt shell
│     ├─ islands/
│     │  ├─ motion-preference.tsx               [C] (new)   keeps html[data-motion] and envStore in sync (soft navigations)
│     │  ├─ smooth-scroll.tsx                   [C] (new)   [MS 5] lazy-loads @/lib/motion/desktop when desktop && Full
│     │  ├─ entry-poster.tsx                    [C] (new)   [MS 5.7] the post observer, every width and mode
│     │  ├─ lime-custody.tsx                    [C] (new)   [CD 3.3, DS 5.3] owner controller
│     │  ├─ settle-cell.tsx                     [C] (new)   entry 01 right cell
│     │  ├─ sample-run.tsx                      [C] (new)   entry 02 demo
│     │  ├─ citation-demo.tsx                   [C] (new)   entry 03 demo
│     │  ├─ approve-sample.tsx                  [C] (new)   entry 04 approve and Edit
│     │  ├─ receipt-slot.tsx                    [C] (new)   entry 05 receipt (approved or ghost), in-place approve, phone print-and-tear
│     │  ├─ billing-plans.tsx                   [C] (new)   entry 07 interval switch + cards + receipt calculator (one state)
│     │  ├─ odometer.tsx                        [C] (new)
│     │  ├─ approved-line.tsx                   [C] (new)   entry 10 body swap
│     │  ├─ ledger-rail.tsx                     [C] (new)   rail at 1280px and wider
│     │  ├─ entry-caption.tsx                   [C] (new)   navbar "05 / 10" caption, 1024 to 1279px
│     │  ├─ receipt-tape.tsx                    [C] (new)   48px tape below 1024px and its <dialog>
│     │  ├─ lane-receipt.tsx                    [C] (new)   ReceiptPaper + <ol> of printed lines in the lane (poster at 00, list from 01)
│     │  ├─ footer-clock.tsx                    [C] (new)
│     │  └─ motion-toggle.tsx                   [C] (new)   [MS 11.2] variants "full" and "compact"
│     └─ stage/                                             [owner of internals: 04-webgl-scene.md]
│        ├─ stage-loader.tsx                    [C] (new)   probe after idle, next/dynamic(..., { ssr: false }), error boundary
│        ├─ stage-error-boundary.tsx            [C] (new)   class component, demotes to tier 0
│        ├─ stage.tsx                           [C] (new, WebGL chunk) thin React wrapper
│        ├─ scene.ts                            [M] (new, WebGL chunk) vanilla three renderer, slip, print head, render, dispose
│        ├─ poses.ts                            [M] (new, WebGL chunk) SceneStateId to pose table, stateFor()
│        ├─ shaders.ts                          [M] (new, WebGL chunk) GLSL template strings
│        ├─ print-texture.ts                    [M] (new, WebGL chunk) CanvasTexture ring buffer
│        ├─ sampler.ts                          [M] (new, WebGL chunk) frame-time sampler and demotion
│        └─ palette.ts                          [M] (new)   palette array, imported by scene.ts and by its unit test
├─ lib/
│  ├─ motion/                                               [owner of internals: MS]
│  │  ├─ tokens.ts                              [M] (new)   DUR, EASE, EASE_CSS, STAGGER, DIST and constants [MS 2.6]
│  │  ├─ preference.ts                          [M] (new)   MOTION_STORAGE_KEY, MOTION_HEAD_SCRIPT, getEffectiveMotion, setMotion, subscribeMotion, completeAll
│  │  ├─ gsap.ts                                [M] (new, motion chunk) registers ScrollTrigger, SplitText, useGSAP once; re-exports
│  │  ├─ clock.ts                               [M] (new, motion chunk) startClock(), registerStage()
│  │  ├─ desktop.tsx                            [C] (new, motion chunk) default export DesktopMotion: Lenis, clock, title rise, stage timeline, anchors
│  │  ├─ scene-driver.ts                        [M] (new, motion chunk) ScrollTriggers writing sceneInput
│  │  ├─ stage-timeline.ts                      [M] (new, motion chunk) entry 05 pinned DOM timeline
│  │  ├─ title-rise.ts                          [M] (new, motion chunk) SplitText line rise (kt-line-rise)
│  │  └─ anchors.ts                             [M] (new, motion chunk) delegated anchor handler [MS 5.6]
│  └─ landing/
│     ├─ sections.ts                            [M] (new)   ENTRIES table: section ids, anchors, scene states
│     ├─ ledger-store.ts                        [M] (new)   ledgerStore, useLedger
│     ├─ env-store.ts                           [M] (new)   envStore, useEnv
│     ├─ scene-input.ts                         [M] (new)   sceneInput (per-frame mutable numbers)
│     ├─ capabilities.ts                        [M] (new)   probeTier, whenIdle
│     ├─ calculator.ts                          [M] (new)   computeReceipt (pure)
│     └─ format.ts                              [M] (new)   formatStamp, formatUsd, formatPerApp
├─ content/
│  ├─ landing-copy.ts                           [D] (new)   [COPY] landingCopy, keyed by section id plus meta, shared, scene
│  ├─ claims.ts                                 [D] (new)   claims register [CD 10.6]
│  └─ fit-sample.json                           [D] (new, generated by P1, committed)
├─ public/
│  └─ landing/
│     └─ og-kairos.png                          (new)       1200 by 630, at most 120 KB
├─ perf/
│  └─ budgets.json                              (new)       byte budgets read by e2e/budgets.spec.ts
├─ e2e/                                         [T] (new)   Playwright specs (10.2)
├─ test/                                        [T] (new)   Vitest unit tests (10.3)
├─ playwright.config.ts                         (new)
├─ vitest.config.ts                             (new)
├─ lighthouserc.json                            (new)
├─ LICENSES/gsap-standard-license-2026-10-15.txt  (new)     licence snapshot (stack research item 10)
├─ next.config.ts                               (edit)      env.BUILD_DATE
└─ package.json                                 (edit)      dependencies (3.1), scripts test, test:e2e, perf

shared/src/plans.ts                             (edit, P3)  adds creditsPerInvoice(planId, interval)
server/src/services/stripe.ts                   (edit, P3)  imports creditsPerInvoice from @auto-career/shared
server/scripts/build-landing-fit-sample.ts      (new, P1)
server/test/landing-fit-sample.test.ts          (new, P1)   drift test
```

### 1.2 Files deleted

| File | Why |
| --- | --- |
| `web/app/(public)/page.tsx` | `/` moves to the `(landing)` route group (1.3) |
| `web/components/landing/hero.tsx` | Replaced by `entries/entry-00-hero.tsx` |
| `web/components/landing/match-preview.tsx` | Its content moves into entries 02 and 03 as labelled samples (inventory C1, C2) |
| `web/components/landing/proof-points.tsx` | Its four points become entries 02, 03, 05 and 07 |
| `web/components/landing/comparison.tsx` | Replaced by `entries/entry-08-compare.tsx` (inventory C5) |
| `web/components/landing/landing-faq.tsx` | Questions move to `landingCopy["entry-09-questions"].faq`; `FaqList` is called directly |
| `.animate-rise` keyframe in `globals.css` | Only `hero.tsx` and `match-preview.tsx` used it |

A grep confirmed that only `web/app/(public)/page.tsx` imports the five landing files.

### 1.3 Why a `(landing)` route group

DS 1.4 requires the scope class `.lp` on an ancestor of the navbar, `main` and the footer on `/` and asked this document how (DS Q3). The shared `(public)/layout.tsx` also renders `/pricing` and `/how-it-works`, so it cannot carry `.lp`. Options:

| Option | Problem |
| --- | --- |
| `.lp` on `<html>` from an inline script and an effect | Global state on an element React does not own for this purpose; must be removed on every Activity hide; a hard load of another route must never see it |
| `:root:has(...)` | Discouraged by the Next guide; keeps matching while the hidden landing stays in the DOM under Activity |
| A `(landing)` route group with its own layout (chosen) | None found. Both groups sit under the one root layout, so navigation between them stays a client navigation. The `.lp` element is React-owned and is hidden with the route by Activity, so nothing leaks to `/pricing`. The landing renders its own `Navbar variant="landing"` and its own `Footer` instance, so the shared navbar and footer on other routes are untouched |

The route stays `/`. The locked decision ("rebuild `web/app/(public)/page.tsx`") is honoured in substance: the same route is rebuilt in the same app; only the file's folder changes. The copy lint (CD 2.2 rule 1) covers `web/app/(landing)` instead of `web/app/(public)`.

```tsx
// web/app/(landing)/layout.tsx  [S]
import { LandingShell } from "@/components/landing/landing-shell";
export default function LandingLayout({ children }: LayoutProps<"/">) {
  return <LandingShell>{children}</LandingShell>;
}

// web/components/landing/landing-shell.tsx  [S]
import "./landing.css";
import "./motion.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { EntryCaption } from "./islands/entry-caption";
import { MotionToggle } from "./islands/motion-toggle";

export function LandingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp flex min-h-full flex-1 flex-col">
      <Navbar variant="landing" caption={<EntryCaption />} sheetExtra={<MotionToggle variant="compact" />} />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
```

### 1.4 Placement rules

1. Landing-only code lives in `web/components/landing/`, `web/lib/landing/`, `web/lib/motion/` and `web/content/`. Nothing in `components/shared/` or `components/layout/` imports from those folders; the navbar receives landing islands as props (`caption`, `sheetExtra`) from `LandingShell`.
2. Stateful `[M]` modules (`ledger-store.ts`, `env-store.ts`, `scene-input.ts`, `clock.ts`) are imported only by Client Components. A Server Component importing them would get a separate server instance. `sections.ts`, `format.ts`, `calculator.ts`, `tokens.ts` and `palette.ts` are pure and may be imported anywhere.
3. No barrel files. Every import names its file, so the motion and WebGL chunks stay separable.
4. Copy lives in `web/content/landing-copy.ts` (COPY section 0) and is rendered by Server Components. A Client Component receives the strings it needs as props, which keeps copy in the HTML (SEO, no-JS) and out of the JavaScript bundles. The only strings a client island may hold itself are the ones COPY marks as runtime templates (`{approvedAt}`, counts), and those are still read from `landingCopy` and passed in.
5. Landing CSS selectors are scoped under `.lp` (DS 1.4) or keyed on an `html[data-*]` attribute combined with `.lp`. Both CSS files stay loaded after navigating away (App Router keeps global CSS), so unscoped rules would leak; scoped rules are inert because `.lp` is hidden with the route.

---

## 2. Component tree, server and client boundaries

### 2.1 Tree

```
RootLayout [S] app/layout.tsx
  <html lang="en" data-lime-owner="hero" class="{inter} {interTight} h-full antialiased" suppressHydrationWarning>
  <head><script>MOTION_HEAD_SCRIPT</script></head>                          sets html[data-motion] before first paint [MS 7.4]
  <body class="flex min-h-full flex-col">
└─ LandingLayout [S] app/(landing)/layout.tsx
   └─ LandingShell [S]  <div class="lp ...">
      ├─ Navbar [C] variant="landing"                                     Start free: lp-btn data-lime-candidate="navbar"; sheet: "navbar-sheet"
      │   caption={EntryCaption [C]}  sheetExtra={MotionToggle [C] variant="compact"}
      ├─ <main id="main">
      │  └─ LandingPage [S] app/(landing)/page.tsx
      │     ├─ JsonLd [S]                                                 FAQPage + Organization
      │     ├─ <a class="lp-skip" href="#entry-00-title">, <a href="#entry-07-title">   skip links [S]
      │     ├─ MotionPreference [C]  LimeCustody [C]  EntryPoster [C]  SmoothScroll [C]   render nothing
      │     │                                                               SmoothScroll lazy-loads DesktopMotion [C, motion chunk]
      │     ├─ LedgerRail [C]                                              <nav aria-label="Page entries">, 1280px and wider
      │     ├─ ReceiptTape [C]                                             below 1024px, sticky under the navbar from entry 02
      │     ├─ <div data-story>                                            entries 00 to 06 share the receipt lane
      │     │  ├─ <aside data-lane class="lp-lane"> (sticky inner, columns 9 to 12, 1024px and wider)
      │     │  │  ├─ LaneReceipt [C]                                       ReceiptPaper [S] + <ol>: DOM poster at 00, visible list from 01 on tier 0
      │     │  │  └─ StageLoader [C] > StageErrorBoundary [C] > Stage [C, WebGL chunk] > fixed <canvas aria-hidden="true">
      │     │  ├─ Entry00Hero [S]        H1, subhead, CTAs (<Link class="lp-btn" data-lime-candidate="hero">), ReceiptPaper mini receipt [S],
      │     │  │                         lane caption with MotionToggle [C] variant="compact" at 1024px and wider
      │     │  ├─ Entry01Reported [S]    five rows, each with SettleCell [C]
      │     │  ├─ Entry02FitGate [S]     SampleFrame [S] > SampleRun [C]
      │     │  ├─ Entry03TruthLock [S]   SampleFrame [S] > CitationDemo [C]
      │     │  ├─ Entry04Approve [S]     SampleFrame [S] > ApproveSample [C] (data-lime-candidate="approve")
      │     │  ├─ Entry05SendReceipt [S] 200vh wrapper > sticky stage > ReceiptSlot [C] (data-slot="receipt"); mint flow below
      │     │  └─ Entry06Replies [S]     sample inbox [S], the open row [S]
      │     ├─ Entry07Billing [S]        sample credit ledger [S], BillingPlans [C] (Choose Pro: data-lime-candidate="pro"), notes [S]
      │     ├─ Entry08Compare [S]        real <table>; stacked pairs below 768px by CSS
      │     ├─ Entry09Questions [S]      FaqList [S] (shared)
      │     ├─ Entry10Start [S]          ApprovedLine [C], <Link class="lp-btn" data-lime-candidate="closing">, ReceiptPaper [S]
      │     └─ Colophon [S] (data-section="footer")  page receipt table [S], FooterClock [C], MotionToggle [C] variant="full"
      └─ Footer [S] (shared, unchanged)                                    siteConfig.footer link groups
```

### 2.2 What is server-rendered

Every heading, paragraph, table, list, chip, settlement line, price, FAQ answer, receipt row and link is in the prerendered HTML. The H1, subhead and hero CTA are readable at first paint with no JavaScript and no preloader (CD 5.4). Client islands receive their initial content from the server and change it only after hydration:

| Island | Server render and first client render (identical) | After mount |
| --- | --- | --- |
| `SettleCell` | `open · see NN`, a link to `#entry-NN` | Reads `ledgerStore.posted`; flips to `settled in NN` |
| `SampleRun` | Controls at the sample defaults; the default combination's results with every count printed | Recomputes on control change |
| `CitationDemo` | The diff, chips, facts, the two "Try adding a line" radios and the "Add line" button | Trace highlighting; save and refusal sequences |
| `ApproveSample` | Enabled "Approve sample draft" | Approve handler, stamp |
| `ReceiptSlot` | The ghost receipt with its in-place approve button | The approved receipt when `approvedAt` is set |
| `BillingPlans` | Monthly prices; calculator at Pro, Monthly, half the credits, 3 failed; computed rows | Interval and calculator changes |
| `ApprovedLine` | `entry-10-start.body` default sentence | The approved sentence with the stamp time |
| `LaneReceipt` | Header and line 00 on mint paper in the `slip-open` CSS pose | Appends printed lines |
| `FooterClock` | `KAIROS WHEN YOU APPROVE` alone | Prepends `CHRONOS {time} YOUR TIME · `, updated once a minute (hidden under Reduced, MS 11.1) |
| `LedgerRail`, `ReceiptTape`, `EntryCaption` | Links to all 11 entries; tape shows `ledger-rail.tapeDefault` | Active entry, latest line |
| `MotionToggle` | Rendered with `hidden` (MS 7.5) | Revealed, reflects `html[data-motion]` |

A visitor who approved and reloads sees the server default for one render and the approved state after mount, because the approval lives in `sessionStorage` and the server cannot know it. Every affected island is below the fold except none in the first viewport.

### 2.3 Section DOM contract

Every entry renders one `<section>` with this attribute set. Other documents select by these attributes and never hard-code ids; values come from `ENTRIES`.

```html
<section
  id="entry-02"                         anchor id: entry-NN
  data-section="entry-02-fit-gate"      section id from CD section 6, exact
  data-entry="02"                       two-digit entry number
  data-scene="slip-feed"                scene state id, or "none"
  aria-labelledby="entry-02-title"
  class="lp-entry"
>
  <h2 id="entry-02-title" tabindex="-1" data-split="lines" class="lp-heading">...</h2>
```

- `data-post` (`pending`, `live`, `instant`, or absent) is written on the section by `EntryPoster` (MS 5.7). Absent means final state (no JavaScript).
- The navbar is the landing `<header>`; the rail is `<nav aria-label="Page entries" data-section="ledger-rail">`; the colophon is `<section id="colophon" data-section="footer" aria-label="Page receipt">`.
- Entry 05 carries `data-scene="slip-tear"` in the HTML; the scene picks `slip-tear` or `ghost-path` from `ledgerStore.approvedAt`.
- `tabindex="-1"` on every H2 lets the anchor handler and skip links move focus to the heading (MS 5.6).

```ts
// web/lib/landing/sections.ts  [M]
export type EntryId = "00" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10";
export type SceneStateId =
  | "slip-open" | "slip-recede" | "slip-feed" | "slip-cite" | "slip-hold"
  | "slip-tear" | "ghost-path" | "slip-reply" | "slip-fresh";
export type EntrySectionId =
  | "entry-00-hero" | "entry-01-reported" | "entry-02-fit-gate" | "entry-03-truth-lock"
  | "entry-04-approve" | "entry-05-send-receipt" | "entry-06-replies" | "entry-07-billing"
  | "entry-08-compare" | "entry-09-questions" | "entry-10-start";
export type SectionId = "navbar" | "ledger-rail" | EntrySectionId | "footer";

export interface EntryDef {
  entry: EntryId;
  section: EntrySectionId;        // also the top-level key in landingCopy (COPY section 0)
  anchor: `entry-${EntryId}`;
  scene: SceneStateId | null;     // entry 05 lists "slip-tear"; "ghost-path" is chosen at runtime
  inStory: boolean;               // true for 00 to 06 (inside [data-story], beside the lane)
}

export const ENTRIES: readonly EntryDef[] = [
  { entry: "00", section: "entry-00-hero",         anchor: "entry-00", scene: "slip-open",   inStory: true },
  { entry: "01", section: "entry-01-reported",     anchor: "entry-01", scene: "slip-recede", inStory: true },
  { entry: "02", section: "entry-02-fit-gate",     anchor: "entry-02", scene: "slip-feed",   inStory: true },
  { entry: "03", section: "entry-03-truth-lock",   anchor: "entry-03", scene: "slip-cite",   inStory: true },
  { entry: "04", section: "entry-04-approve",      anchor: "entry-04", scene: "slip-hold",   inStory: true },
  { entry: "05", section: "entry-05-send-receipt", anchor: "entry-05", scene: "slip-tear",   inStory: true },
  { entry: "06", section: "entry-06-replies",      anchor: "entry-06", scene: "slip-reply",  inStory: true },
  { entry: "07", section: "entry-07-billing",      anchor: "entry-07", scene: null,          inStory: false },
  { entry: "08", section: "entry-08-compare",      anchor: "entry-08", scene: null,          inStory: false },
  { entry: "09", section: "entry-09-questions",    anchor: "entry-09", scene: null,          inStory: false },
  { entry: "10", section: "entry-10-start",        anchor: "entry-10", scene: "slip-fresh",  inStory: false },
] as const;
```

### 2.4 Lane structure (structure only; visual values are DS's)

- `[data-story]` wraps entries 00 to 06 and is `position: relative`. Its `<aside data-lane class="lp-lane">` is `position: absolute; inset-block: 0` over grid columns 9 to 12 (`--receipt-lane`), and the aside's single child is `position: sticky; top: var(--lp-navbar-h); height: calc(100lvh - var(--lp-navbar-h))`. Entries place text only in columns 1 to 8.
- The Stage measures `[data-lane]` for x and width only; y comes from the viewport. Entry 10 uses the same columns, so one measurement serves every pose.
- Entry 05's mint band is opaque and stacked above the lane, so the tier 0 lane receipt never shows through it.
- Below 1024px the aside is `display: none`; the hero shows the mini receipt and the tape is the progress chrome.
- Stacking order uses the DS z tokens (`--lp-z-canvas`, `--lp-z-content`, `--lp-z-rail`, `--lp-z-tape`, `--lp-z-navbar`, `--lp-z-dialog`, `--lp-z-skip`).

### 2.5 SEO, landmarks and focus

| Item | Implementation |
| --- | --- |
| Metadata | `export const metadata: Metadata` in `(landing)/page.tsx`, from `landingCopy.meta`: `title.absolute` (so the root template does not append), description from `siteConfig.description`, `alternates.canonical: "/"`, `openGraph.images: [{ url: "/landing/og-kairos.png", width: 1200, height: 630 }]` |
| JSON-LD | `JsonLd` renders one `<script type="application/ld+json">` containing `FAQPage` built from `landingCopy["entry-09-questions"].faq` and `Organization` from `siteConfig`, with no rating and no review. A unit test asserts the JSON-LD text equals the visible FAQ text |
| Headings | One H1 (entry 00). One H2 per entry. H3 for card and table titles. No skipped levels |
| Landmarks | `header` (navbar), `nav` (main links, page entries), `main`, `aside` (sample receipt), `footer` |
| Skip links | Plain anchors in the server HTML: "Skip to main content" to `#entry-00-title`, "Skip to pricing" to `#entry-07-title`. At 1024px and wider with Full, the delegated anchor handler in `anchors.ts` (MS 5.6) scrolls, focuses the heading and pushes history; elsewhere they are native |
| Scroll padding | MS 5.6 values: `scroll-padding-top` 80px at 1024px and wider, 128px below. `scroll-padding` only works on the scroll container (`html`), which a rule scoped to `.lp` cannot reach, and no `html` attribute is landing-specific. So `LimeCustody` writes `document.documentElement.style.scrollPaddingTop` in its layout effect (re-evaluated on the 1024px media query change) and clears it in cleanup |
| Internal links | `/pricing` and `/how-it-works` from the navbar and footer; entry 07 links to `/pricing` |
| Sitemap | `app/sitemap.ts` already lists `""`; unchanged |

### 2.6 `page.tsx` shape

```tsx
// web/app/(landing)/page.tsx  [S]
import type { Metadata } from "next";
import { landingCopy } from "@/content/landing-copy";
import { JsonLd } from "@/components/landing/json-ld";
// ...entry imports, island imports

export const ensureStatic = "navigation";
export const metadata: Metadata = { /* 2.5 */ };

export default function LandingPage() {
  return (
    <>
      <JsonLd />
      {/* skip links, render-nothing islands, rail, tape, story, entries 07 to 10, colophon */}
    </>
  );
}
```

`JsonLd` is the only place on the landing that writes raw text into a `<script>` element besides the root layout's head script. Safety rule for both: the text is a compile-time constant built from repository data (`landingCopy`, `siteConfig`, `MOTION_HEAD_SCRIPT`), never from a request, a query string, storage or user input; JSON-LD is serialised with `JSON.stringify(data).replace(/</g, "\\u003c")` so no `</script>` sequence can appear. A unit test asserts both properties. If a Content-Security-Policy is added later, both scripts need a hash entry (their text is static, so a hash is stable per build).

`BUILD_DATE` is defined in `next.config.ts` as `env: { BUILD_DATE: new Date().toISOString().slice(0, 10) }`, evaluated once when the config loads, and read as `process.env.BUILD_DATE` in `colophon.tsx`. No date is read during render, so the route stays static under `ensureStatic = 'navigation'`.

### 2.7 Root layout edits

```tsx
// web/app/layout.tsx  [S] (P2)
import { Inter, Inter_Tight } from "next/font/google";
import { MOTION_HEAD_SCRIPT } from "@/lib/motion/preference";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500"], display: "swap", preload: false });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", weight: ["400", "500"], display: "swap" });

<html lang="en" data-lime-owner="hero" className={`${inter.variable} ${interTight.variable} h-full antialiased`} suppressHydrationWarning>
  <head><script>{/* MOTION_HEAD_SCRIPT as the element's text */}</script></head>
```

- `data-lime-owner="hero"` is a static attribute in the server HTML on every route (DS L1, L8; MS 7.1). It is inert outside `.lp` because every custody rule targets `.lp-btn[data-lime-candidate]`. `LimeCustody` changes it on the landing and resets it to `hero` in its cleanup.
- `suppressHydrationWarning` covers `<html>`'s own attributes only; the head script sets `data-motion` before hydration, and the runtime sets `data-tier`, `data-stage` and `data-active-entry` after it.
- Inter Tight is preloaded (it sets the H1); Inter is not (CD 8.1). Both use the `next/font` variables DS 11.5 fixes: `--font-inter`, `--font-inter-tight`.

---

## 3. Dependencies and bundle budget per chunk

### 3.1 Pinned dependencies (exact, `--save-exact`)

| Package | Version | Type | Loaded in | Why |
| --- | --- | --- | --- | --- |
| `gsap` | 3.15.0 | dependency | motion chunk | Core, ScrollTrigger, SplitText. GSAP standard no-charge licence, snapshot in `web/LICENSES/` |
| `@gsap/react` | 2.1.2 | dependency | motion chunk | `useGSAP` |
| `lenis` | 1.3.26 | dependency | motion chunk | Wheel smoothing on native document scroll; `lenis/dist/lenis.css` imported by `desktop.tsx` |
| `three` | 0.186.1 | dependency | WebGL chunk | Vanilla renderer, one mesh |
| `@types/three` | 0.186.0 | devDependency | n/a | Types |
| `@playwright/test` | 1.64.0 | devDependency | n/a | Same minor as the server's `playwright-core` ^1.64.0, so the workspace holds one Playwright; 1.64.1 is one day old and is not taken |
| `@axe-core/playwright` | 4.13.0 | devDependency | n/a | Accessibility scans |
| `vitest` | 5.0.4 | devDependency | n/a | Same version as `server` and `extension` |
| `@lhci/cli` | 0.15.1 | devDependency | n/a | Lighthouse CI assertions |

Unchanged and reused: `next` 16.4.0, `react` and `react-dom` 19.3.0, `@phosphor-icons/react`, `clsx`, `tailwind-merge`, `@auto-career/shared`. The optional patch bump to `next` 16.4.1 and React 19.3.1 lands, if taken, as its own change before Phase 1.

Not added (reasons in `stack-feasibility.md` section 10): `@react-three/fiber`, `@react-three/drei`, `postprocessing`, `motion`, ScrollSmoother, GSAP CustomEase (MS uses GSAP built-in eases with a fidelity test, MS Q24), detect-gpu, any analytics SDK, any Lottie or Rive runtime, `client-only` (placement rule 1.4.2 instead).

```
npm i -w @auto-career/web --save-exact gsap@3.15.0 @gsap/react@2.1.2 lenis@1.3.26 three@0.186.1
npm i -w @auto-career/web --save-exact -D @types/three@0.186.0 @playwright/test@1.64.0 @axe-core/playwright@4.13.0 vitest@5.0.4 @lhci/cli@0.15.1
```

### 3.2 Chunks

| Chunk | Contents | Loaded when | Budget (gzip) | Basis |
| --- | --- | --- | --- | --- |
| Framework | Next runtime, React, React DOM | Every route | Not budgeted here. Measured once in Phase 0 on `/pricing` and stored as `frameworkBytes` in `web/perf/budgets.json`; the landing may exceed it by at most 5% | Shared with every route |
| Landing islands | Every `[C]` in `islands/`, `stage-loader.tsx`, `stage-error-boundary.tsx`, `lib/landing/*`, `lib/motion/tokens.ts`, `lib/motion/preference.ts`, `PLANS` | With the route, all viewports | 20 KB | About 17 KB estimated for 19 small islands; copy passed as props, not bundled |
| Motion | `gsap`, `ScrollTrigger`, `SplitText`, `@gsap/react`, `lenis`, `lib/motion/{gsap,clock,desktop,scene-driver,stage-timeline,title-rise,anchors}` | After hydration, only when `(min-width: 1024px)` and effective Full | 60 KB | Libraries measured at 53.9 KB; 6 KB of glue |
| WebGL | `three` subset, `stage.tsx`, `scene.ts`, `poses.ts`, `shaders.ts`, `print-texture.ts`, `sampler.ts` | After `load` + idle, only when the tier probe returns 1 or 2 | 140 KB | Minimal vanilla three measured at 133 KB |
| Sample data | `fit-sample.json`, compacted by the Server Component into props | Inline in the HTML's RSC payload, not a JS chunk | 4 KB of the HTML budget | 48 postings and 18 combinations as reason-code arrays |

Rules that keep chunks separate:

- `three` is imported only by files under `stage/` that are reachable solely through the `next/dynamic` import in `stage-loader.tsx`. `palette.ts` holds plain hex numbers and imports nothing.
- `gsap`, `lenis` and `@gsap/react` are imported only through `@/lib/motion/gsap` and only by files reachable solely through the `next/dynamic` import of `@/lib/motion/desktop` in `smooth-scroll.tsx`, plus the Stage. The Stage's time-based moves are GSAP tweens on plain scene objects (MS 8), so `stage.tsx` imports `@/lib/motion/gsap` and `@/lib/motion/clock`; the WebGL chunk can only mount after the motion chunk has loaded (both require desktop and Full), and the bundler places the shared GSAP modules in one chunk. The budget test asserts that the marker `ScrollTrigger` appears in exactly one downloaded script, which catches duplication.
- The budget test identifies chunks by marker strings that survive minification inside the libraries: `ScrollTrigger` for the motion chunk, `THREE.WebGLRenderer` for the WebGL chunk.

### 3.3 Totals per situation (gzip, JavaScript only, excluding framework)

| Situation | Budget | Composition |
| --- | --- | --- |
| Below 1024px, any motion setting | 20 KB | Islands |
| 1024px and wider, effective Reduced | 20 KB | Islands |
| 1024px and wider, Full, tier 0 | 80 KB | Islands + motion |
| 1024px and wider, Full, tier 1 or 2 | 220 KB | Islands + motion + WebGL |

These replace two figures in CD 10.3. "15 KB below 1024px" did not include the five interactive demos, the calculator and the stores; "70 KB at 1024px and wider" left 16 KB for all site code. The WebGL budget (140 KB) and the first-load transfer cap (1.0 MB) are unchanged.

---

## 4. One motion runtime

### 4.1 Who owns time

At 1024px and wider with effective Full there is exactly one `requestAnimationFrame` loop: `gsap.ticker`. Lenis runs with `autoRaf: false`; the stage never calls `renderer.setAnimationLoop`; CSS owns every preset MS 8 assigns to CSS. Below 1024px and under Reduced there is no JavaScript animation loop at all: `EntryPoster` toggles attributes and CSS does the rest (MS 12.3).

### 4.2 Frame order

```
gsap.ticker frame (time t, seconds)
 1. lenisTick   (gsap.ticker.add(cb, false, true): prioritized, first)
      lenis.raf(t * 1000)
        Lenis "scroll" event -> ScrollTrigger.update()
          scene-driver triggers write sceneInput.{entry, u, stageP}; sceneInput.version += 1
          stage-timeline (scrub: true) sets its progress
 2. GSAP root timeline renders running tweens (kt-line-rise, stage DOM timeline, canvas moves on scene objects)
 3. stageTick   (registered by registerStage, normal priority, after the root)
      if (stage.isDirty()) stage.render(t * 1000)
```

```ts
// web/lib/motion/clock.ts  [M, motion chunk]
import { gsap, ScrollTrigger } from "./gsap";
import type Lenis from "lenis";

export interface StageHandle { isDirty(): boolean; render(timeMs: number): void }

let stageTick: ((t: number) => void) | null = null;

export function startClock(lenis: Lenis): () => void {
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const lenisTick = (t: number) => lenis.raf(t * 1000);
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(lenisTick, false, true);
  return () => {
    gsap.ticker.remove(lenisTick);
    lenis.off("scroll", ScrollTrigger.update);
    if (stageTick) { gsap.ticker.remove(stageTick); stageTick = null; }
  };
}

/** The Stage mounts after idle, later than the clock, so it registers itself. Returns the unregister function. */
export function registerStage(stage: StageHandle): () => void {
  const tick = (t: number) => { if (stage.isDirty()) stage.render(t * 1000); };
  stageTick = tick;
  gsap.ticker.add(tick);
  return () => { gsap.ticker.remove(tick); if (stageTick === tick) stageTick = null; };
}
```

MS 5.2 writes the clock as `startClock(stage)`; because the Stage mounts after the clock, the same clock is exposed as `startClock(lenis)` plus `registerStage(stage)`. The behaviour MS specifies (Lenis first, then render only if dirty, one ticker) is unchanged.

```tsx
// web/lib/motion/desktop.tsx  [C, motion chunk] (shape)
"use client";
import "lenis/dist/lenis.css";
import Lenis from "lenis";
import { useGSAP, gsap } from "./gsap";
import { startClock } from "./clock";
import { createSceneDriver } from "./scene-driver";
import { createStageTimeline } from "./stage-timeline";
import { createTitleRise } from "./title-rise";
import { installAnchors } from "./anchors";
import { getEffectiveMotion } from "./preference";

export default function DesktopMotion({ scope }: { scope: React.RefObject<HTMLElement | null> }) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add({ desktop: "(min-width: 1024px)", osReduce: "(prefers-reduced-motion: reduce)" }, (ctx) => {
      if (!ctx.conditions?.desktop || getEffectiveMotion() !== "full") return;
      const lenis = new Lenis({ /* MS 5.2 options */ autoRaf: false });
      const stop = startClock(lenis);
      const root = scope.current!;
      const disposers = [createSceneDriver(root), createStageTimeline(root), createTitleRise(root), installAnchors(root, lenis)];
      return () => { disposers.forEach((d) => d()); stop(); lenis.destroy(); };
    });
    return () => mm.revert();
  }, { scope });
  return null;
}
```

```tsx
// web/components/landing/islands/smooth-scroll.tsx  [C, islands chunk]
"use client";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { useEnv } from "@/lib/landing/env-store";
const DesktopMotion = dynamic(() => import("@/lib/motion/desktop"), { ssr: false, loading: () => null });

export function SmoothScroll() {
  const desktop = useEnv((e) => e.desktop);
  const motion = useEnv((e) => e.motion);
  const scope = useRef<HTMLElement | null>(null);   // set in an effect to document.querySelector("#main")
  return desktop && motion === "full" ? <DesktopMotion scope={scope} /> : null;
}
```

ScrollTriggers are created top to bottom inside one handler, with `refreshPriority` equal to the entry index and ids `entry-NN:purpose` (MS 5.3). One `ResizeObserver` on `<main>` refreshes ScrollTrigger (MS 5.3 rule 9); no component calls refresh itself.

### 4.3 The three state containers

| Container | Holds | Changes | Read by | Subscription |
| --- | --- | --- | --- | --- |
| `ledgerStore` (`web/lib/landing/ledger-store.ts`) | What has happened in the story (append-only), plus the active entry | A few times per visit; `active` on entry changes | Islands, Stage, lane receipt, tape, rail, caption | `useSyncExternalStore` via `useLedger(selector)` |
| `envStore` (`web/lib/landing/env-store.ts`) | Device and preference facts | Rarely | Loaders, islands, Stage | `useSyncExternalStore` via `useEnv(selector)` |
| `sceneInput` (`web/lib/landing/scene-input.ts`) | Per-frame numbers: progress, pointer, measured rectangles | Every scrolled frame | Stage only, inside its tick | None: a plain mutable object with a `version` counter |

Per-frame values never pass through React state, so scrolling causes zero React renders.

#### 4.3.1 `ledgerStore`

```ts
// web/lib/landing/ledger-store.ts  [M]
import type { EntryId } from "./sections";

/** Keys of landingCopy.scene.lines (COPY section 17). "feedRow" stands for the whole 48-row feed event. */
export type PrintLineId =
  | "header" | "00" | "feedRow" | "02" | "rulesChanged" | "03"
  | "04approved" | "04awaiting" | "05approved" | "05notApproved"
  | "filedHeader" | "05filed" | "06" | "10header" | "10";

export interface LedgerState {
  readonly posted: ReadonlySet<EntryId>;     // CD 9.4: entry has posted (rule drawn)
  readonly printed: readonly PrintLineId[];  // ordered, append-only; "rulesChanged" may repeat
  readonly feedDone: boolean;                // CD 9.4
  readonly approvedAt: string | null;        // CD 9.4: ISO 8601 from new Date().toISOString() in the click handler
  readonly torn: boolean;                    // CD 9.4
  readonly active: EntryId;                  // the entry on the reading line (rootMargin -45% 0px -45% 0px); view state, not persisted
}

export const ledgerStore: {
  subscribe(listener: () => void): () => void;
  getSnapshot(): LedgerState;          // same object until a change
  getServerSnapshot(): LedgerState;    // module constant: the no-JS defaults
  post(entry: EntryId): void;          // idempotent; monotonic (posting N posts every earlier entry, MS 3.3)
  print(line: PrintLineId): void;      // idempotent except "rulesChanged"
  markFeedDone(): void;
  approve(isoTime: string): void;      // first call wins
  tear(): void;
  setActive(entry: EntryId): void;
};
export function useLedger<T>(select: (s: LedgerState) => T): T;  // select returns a primitive or a stored reference
```

- Server snapshot: `{ posted: new Set(), printed: ["header", "00"], feedDone: false, approvedAt: null, torn: false, active: "00" }`, created once at module scope (a fresh object per call makes `useSyncExternalStore` loop).
- Persistence: every change except `setActive` writes `sessionStorage["kairos:landing:ledger:v1"]` as JSON inside `try/catch`; the first client `getSnapshot()` reads it. A parse error or missing storage leaves the defaults.
- Append-only: no un-post, un-print, un-approve or un-tear. This is what makes Activity hide and show, reloads and scrolling up safe (CD 4.5).
- `approvedAt` is stored as ISO and displayed with `formatStamp(iso)` (`Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })`), which produces COPY's `{approvedAt}` value. One formatter is used by the DOM stamp, the canvas stamp, entry 01 row 03, entry 05 and entry 10, so all five show the same string.
- `04awaiting` then `04approved` can both exist (awaiting printed first, approval later from the ghost receipt). The DOM list shows the later line in place of the earlier; the canvas shows both, because paper does not un-print.

#### 4.3.2 `envStore`

```ts
// web/lib/landing/env-store.ts  [M]
export type Tier = 0 | 1 | 2;
export type MotionMode = "full" | "reduced";

export interface EnvState {
  readonly motion: MotionMode;          // effective: stored choice, else the OS preference (MS getEffectiveMotion)
  readonly desktop: boolean;            // (min-width: 1024px)
  readonly pin: boolean;                // MS PIN_QUERY: (min-width: 1024px) and (min-height: 640px)
  readonly wide: boolean;               // (min-width: 1280px), the rail
  readonly finePointer: boolean;        // (hover: hover) and (pointer: fine)
  readonly saveData: boolean;           // navigator.connection?.saveData === true
  readonly tier: Tier | null;           // null until the probe has run
  readonly tierReason: string | null;   // "viewport", "reduced-motion", "save-data", "no-webgl2", "texture-size",
                                        // "device-memory", "cores-coarse", "stored", "sampler", "context-lost-twice",
                                        // "chunk-error", "init-error", "init-timeout", "full"
}

export const envStore: {
  subscribe(listener: () => void): () => void;
  getSnapshot(): EnvState;
  getServerSnapshot(): EnvState;   // { motion: "reduced", desktop: false, pin: false, wide: false, finePointer: false, saveData: false, tier: null, tierReason: null }
  refresh(): void;                 // re-reads media queries and preference; called by MotionPreference
  setTier(tier: Tier, reason: string): void;  // never raises within a session, except after Reduced to Full (5.3)
};
export function useEnv<T>(select: (s: EnvState) => T): T;
```

The server snapshot is the most conservative state (reduced, not desktop, no tier), so the first client render mounts nothing heavy, and the real values arrive in the first render after hydration.

#### 4.3.3 `sceneInput`: how scroll progress reaches the WebGL scene

```ts
// web/lib/landing/scene-input.ts  [M]
import type { EntryId } from "./sections";
export interface Rect { x: number; y: number; w: number; h: number }   // CSS pixels, viewport coordinates

export const sceneInput = {
  entry: "00" as EntryId,      // scene entry: the last entry whose top has crossed 85% (CD 4.5); differs from ledgerStore.active by design
  u: 0,                        // local progress of the active entry: 0 at top 85%, 1 at bottom 15% (CD 4.5)
  stageP: 0,                   // entry 05 pinned stage progress 0 to 1 (CD 4.6)
  pointerX: 0, pointerY: 0,    // -1 to 1 across the lane; written only on tier 2 with a fine pointer
  lane: null as Rect | null,   // [data-lane], measured on ScrollTrigger refresh (fonts ready, resize, ResizeObserver)
  slot: null as Rect | null,   // [data-slot="receipt"] while entry 05 is pinned
  viewportH: 0,
  version: 0,                  // incremented by every writer; the Stage is dirty when it differs from the last rendered version
};
```

| Field | Writer | When |
| --- | --- | --- |
| `entry`, `u` | `scene-driver.ts`: one `ScrollTrigger.create` per entry (`start: "top 85%"`, `end: "bottom 15%"`, `onUpdate` writes `u`), MS 5.3 | Scrolled frames |
| `stageP` | `scene-driver.ts`: trigger `entry-05:stage` on the 200vh wrapper (`start: "top top"`, `end: "bottom bottom"`) | Scrolled frames inside the wrapper |
| `pointerX`, `pointerY` | `stage.tsx`: one passive `pointermove` listener on `window`, active only when `tier === 2 && finePointer` | Pointer moves |
| `lane`, `slot`, `viewportH` | `scene-driver.ts` in `ScrollTrigger.addEventListener("refresh", ...)` | Rarely |

The Stage maps `(sceneInput.entry, ledgerStore.approvedAt)` to a `SceneStateId` with `stateFor()` in `stage/poses.ts`: entries 00 to 04 and 06 use `ENTRIES[].scene`; entry 05 uses `slip-tear` when approved and `ghost-path` otherwise; entries 07 to 09 hide the canvas; entry 10 uses `slip-fresh`. Poses, blending, print thresholds and timed moves are defined in `04-webgl-scene.md` and MS 9.

Printing is derived, not commanded: on each frame the Stage computes which lines should exist from `ledgerStore` and `sceneInput`, starts the print move for those not yet on its paper, and calls `ledgerStore.print(id)` once each. When the Stage is recreated (Activity show, tier change, context restore) it reads `printed` and draws every line at once with no sweep (CD 4.5, MS 7.1).

### 4.4 Dirty-flag rendering

The Stage is dirty when `sceneInput.version` changed since its last render, a timed move or pose blend is still running (blend not within 0.001 of its target), or a resize happened. On tier 1 it also skips when less than 33.3 ms passed since the last render; on tier 2 above 60 Hz it renders every second frame (MS 12.4). It is never dirty when `document.hidden`, when the canvas is `visibility: hidden`, or through entries 07 to 09. At rest the GPU does nothing.

### 4.5 Kinetic type and CSS presets

All CSS presets live in `web/components/landing/motion.css` under `.lp`; GSAP presets live in `web/lib/motion/` as camelCase functions; durations, curves and staggers come only from the tokens MS 2 defines (MS Q2 greps for literals). This document fixes only where they load:

| Engine | Loaded | Examples |
| --- | --- | --- |
| CSS (`motion.css`) | Always, every width | `kt-ink`, `kt-sign-rule`, `en-post-rule`, `kt-title-rise`, `kt-letter-fall`, `kt-odometer`, `ho-lime`, `mb-print-tear`, `en-poster-to-canvas` |
| GSAP + SplitText (motion chunk) | 1024px and wider, Full | `kt-line-rise`, `ho-pose`, the entry 05 stage timeline, canvas moves on scene objects |

### 4.6 Posting (`EntryPoster`)

`EntryPoster` is the single posting mechanism at every width and in every mode (MS 5.7): one `IntersectionObserver`, `rootMargin: "0px 0px -15% 0px"`, `threshold: 0`; the monotonic rule (posting entry N first posts every earlier entry with `data-post="instant"`); `data-post="live"` on the entry; `ledgerStore.post(entry)`; unobserve once posted; disconnect when all eleven have posted. At hydration it marks entries below 85% `pending` and entries in view or above `instant`.

The active entry is a separate concern, because posting is monotonic and the active entry moves both ways. One second observer, owned by `EntryPoster` and kept for the page's lifetime, uses `rootMargin: "-45% 0px -45% 0px"` (the reading line, CD 5.4), calls `ledgerStore.setActive(entry)` and writes `html[data-active-entry="NN"]`. `LedgerRail` (`aria-current`), `EntryCaption` ("05 / 10"), `ReceiptTape` and the lane receipt CSS all read that one value, so there is exactly one source for "which entry am I reading".

### 4.7 Entry 05 pin

The pin is CSS `position: sticky` inside a 200vh wrapper, never a ScrollTrigger pin (MS 5.5). The 200vh height applies when `html[data-motion="full"]` and the `PIN_QUERY` media query match, both known before first paint, so the wrapper never changes height after paint. Hardware tier 0 at 1024px and wider keeps the pin and runs the DOM-only stage variant (MS D4). Below 1024px, below 640px of height, under Reduced and without JavaScript, the wrapper is `height: auto`. The server markup of the stage is its final state (mint, receipt, H2 on mint), so a failed motion chunk leaves a still, complete paper stage. `stage-timeline.ts` scrubs the DOM side from `stageP`; the one-shot events (`p` 0.05, 0.18, 0.50, 0.90) fire once in the trigger's `onUpdate`, and the tear is recorded with `ledgerStore.tear()`.

### 4.8 Teardown on route change and under Activity

Leaving `/` for `/pricing` hides the `(landing)` layout and page with `display: none` and runs every effect cleanup; returning re-runs the effects with state intact. Each global side effect has one owner and one undo:

| Global side effect | Owner | Created in | Undone in |
| --- | --- | --- | --- |
| `gsap.ticker` callbacks, ScrollTriggers, SplitText instances, tweens, `gsap.matchMedia` handlers | `DesktopMotion` | `useGSAP` + `mm.add` | `mm.revert()` and the handler's returned cleanup |
| Lenis instance, `html.lenis` classes | `DesktopMotion` | Same | `lenis.destroy()` |
| Delegated anchor click listener | `anchors.ts` via `DesktopMotion` | Same | Returned disposer |
| `<main>` ResizeObserver | `scene-driver.ts` | Same | Returned disposer |
| WebGL renderer, geometry, material, textures, `pointermove`, `webglcontextlost` and `webglcontextrestored` listeners, `registerStage` | `Stage` | `useEffect` | `dispose()` on every GPU object, `renderer.forceContextLoss()`, listener removal, unregister |
| `html[data-lime-owner]` value changes | `LimeCustody` | `useLayoutEffect` (before paint) | Cleanup resets it to `hero` (the root layout's static value) |
| `html.style.scrollPaddingTop` | `LimeCustody` | `useLayoutEffect` | Cleanup sets it to `""` |
| `html[data-active-entry]` | `EntryPoster` | `useEffect` | Cleanup removes it |
| `html[data-tier]`, `html[data-stage]` | `StageLoader`, `Stage` | `useEffect` | Cleanup removes them |
| IntersectionObservers (post, custody, rail, tape) | Each island | `useEffect` | `disconnect()` |
| `matchMedia` and `storage` listeners | `MotionPreference` | `useEffect` | `removeEventListener` |
| Footer clock interval | `FooterClock` | `useEffect` | `clearInterval` |
| Open `<dialog>` (tape, navbar sheet) | Each island | User action | `useLayoutEffect` cleanup calls `dialog.close()` |
| `html[data-motion]` | Head script, `MotionPreference`, `setMotion` | Pre-paint, effect, handler | Not removed: it is set on every route by the root layout's head script, and only `.lp` rules read it |

On re-show, `DesktopMotion` refreshes ScrollTrigger after `document.fonts.ready` (MS 5.3 rule 9) and the Stage rebuilds from `ledgerStore` without sweeps. Next keeps up to three hidden routes; the landing frees its renderer and ticker work on hide, so a hidden landing costs only DOM. MS Q22 checks that `ScrollTrigger.getAll().length` and the Lenis instance count return to their first-load values after three round trips.

---

## 5. Capability and preference detection

### 5.1 Signals

| Signal | Read with | Read where and when | Effect |
| --- | --- | --- | --- |
| Stored motion choice | `localStorage["kairos:motion"]` (`MOTION_STORAGE_KEY`), in `try/catch` | Head script before first paint; `MotionPreference` on mount; `storage` event | Overrides the OS preference (WCAG 2.3.3 site setting) |
| OS reduced motion | `matchMedia("(prefers-reduced-motion: reduce)")` with a `change` listener | Same | Effective Reduced when no stored choice |
| Desktop | `matchMedia("(min-width: 1024px)")` with `change` | `MotionPreference` | Gates the motion chunk and WebGL |
| Pin | `matchMedia("(min-width: 1024px) and (min-height: 640px)")` | `MotionPreference` (CSS uses the same query) | Entry 05 pin |
| Wide | `matchMedia("(min-width: 1280px)")` | `MotionPreference` | Rail versus navbar caption |
| Fine pointer | `matchMedia("(hover: hover) and (pointer: fine)")` | `MotionPreference` | Pointer tilt on tier 2 only |
| Save-Data | `navigator.connection?.saveData` (Chromium only; absent means false) | `MotionPreference` | Tier 0 |
| WebGL2 without a major performance caveat | `canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true, powerPreference: "low-power" })`, then `getExtension("WEBGL_lose_context")?.loseContext()` | `probeTier()` after `load` + idle | `null` means tier 0 |
| `MAX_TEXTURE_SIZE` | `gl.getParameter(gl.MAX_TEXTURE_SIZE)` from the probe context | `probeTier()` | Below 4096 means tier 1 |
| Device memory | `navigator.deviceMemory` (absent means unknown, never low) | `probeTier()` | 2 or less means tier 1 |
| Cores with coarse pointer | `navigator.hardwareConcurrency <= 4 && matchMedia("(pointer: coarse)").matches` | `probeTier()` | Tier 1 |
| Runtime frame time | `sampler.ts`, first 45 rendered frames | Stage | Median above 24 ms demotes one tier; at tier 1 above 34 ms, or a third demotion, goes to tier 0 |
| Context loss | `webglcontextlost` on the canvas | Stage | First: stop, show the lane receipt, one restore. Second: tier 0, stored |
| Stored tier | `sessionStorage["kairos:landing:tier:v1"]`, in `try/catch` | `probeTier()` | Skips the probe on reload |
| E2E override | `window.__KAIROS_TIER__` (0, 1 or 2), honoured only when `process.env.NEXT_PUBLIC_E2E === "1"` at build time | `probeTier()` | Lets CI force tier 2 under SwiftShader; removed from production builds by dead-code elimination |

### 5.2 Order of evaluation (first match wins, CD 9.5)

```ts
// web/lib/landing/capabilities.ts  [M]
export async function probeTier(env: EnvState): Promise<{ tier: Tier; reason: string }>;
//  1. !env.desktop                           -> 0 "viewport"
//  2. env.motion === "reduced"               -> 0 "reduced-motion"
//  3. env.saveData                           -> 0 "save-data"
//  4. stored tier in sessionStorage          -> stored value, "stored"
//  5. e2e override (e2e builds only)         -> override, "e2e"
//  6. WebGL2 probe returns null              -> 0 "no-webgl2"
//  7. MAX_TEXTURE_SIZE < 4096                -> 1 "texture-size"
//  8. deviceMemory <= 2                      -> 1 "device-memory"
//  9. cores <= 4 and coarse pointer          -> 1 "cores-coarse"
// 10. otherwise                              -> 2 "full"

export function whenIdle(cb: () => void): () => void;
//  After window "load" (or immediately if document.readyState === "complete"), then
//  requestIdleCallback(cb, { timeout: 2000 }), falling back to setTimeout(cb, 200) where it is missing (Safari).
//  Returns a cancel function used by effect cleanups.
```

### 5.3 Flow to components

```
Head script (root layout, every hard load)
  html[data-motion] = stored choice, else OS preference                  [MS 7.4]
        |
MotionPreference (mount; soft navigations; media query and storage changes)
  envStore.refresh(): motion, desktop, pin, wide, finePointer, saveData
  re-applies html[data-motion] (soft navigations skip the head script)
        |
        +--> CSS (.lp): html[data-motion="full"] enables kt-ink, en-post-rule, kt-title-rise; "reduced" zeroes durations [DS 1.4]
        +--> SmoothScroll: desktop && motion === "full"  -> mount DesktopMotion (motion chunk); otherwise unmount it
        +--> StageLoader: desktop && motion === "full" -> whenIdle -> probeTier -> envStore.setTier -> html[data-tier]
        |        tier >= 1 -> mount <Stage tier={tier}/> (WebGL chunk); tier 0 or null -> render nothing
        +--> Stage: sampler or context loss -> envStore.setTier(lower) -> StageLoader unmounts or remounts lighter
        +--> MotionToggle: setMotion(value) [MS 11.2] -> localStorage, completeAll(), html[data-motion],
                 gsap.matchMediaRefresh(), envStore.refresh() -> loaders react
```

Rules:

- No component reads `window`, `matchMedia`, `localStorage`, `sessionStorage` or `navigator` during render. Reads happen in the head script, in effects or in event handlers, which keeps prerendering valid and the first client render identical to the server render.
- Tier never rises within a session, with one exception: when the visitor switches Reduced to Full and the stored tier's reason is `reduced-motion`, the probe runs again.
- Under effective Reduced nothing from the motion or WebGL chunks downloads. Lenis's own `respectReducedMotion` stays at its default as a second guard (MS 5.1).

### 5.4 Lime custody wiring

| Situation | Mechanism | Result |
| --- | --- | --- |
| Server HTML, every route | Root layout renders `<html data-lime-owner="hero">` | Hero lime and navbar fallback on `/` from first paint; inert elsewhere (no `.lp-btn` outside `.lp`) |
| No JavaScript | Same attribute, nothing changes it | Only the hero CTA is lime (DS L8) |
| Scrolling | `LimeCustody` runs one `IntersectionObserver` (`threshold: 0`) over candidates `approve`, `hero`, `pro`, `closing`; the highest-priority visible one owns lime, else `navbar`; it writes `html[data-lime-owner]` | Exactly one lime fill; the 150ms + 150ms hand-over is CSS (DS 5.3, MS 3.2) |
| Soft navigation into `/` | The attribute is already `hero`; the observer's first callback corrects it | Correct within one frame of the first observation |
| Leaving `/` | `useLayoutEffect` cleanup resets the attribute to `hero` | Nothing changes on other routes |
| Menu sheet open | DS L7 rule (`html:has(dialog[open]) .lp-btn[data-lime-candidate="navbar"]`) | This `:has()` is local to `.lp` buttons and is evaluated only while a dialog is open, so the Next guidance against broad global `:has()` is respected in intent |

---

## 6. Canvas mounting strategy

### 6.1 Sequence

1. Server HTML: hero text (H1, subhead, CTAs) and `LaneReceipt`, whose server output is the DOM poster: a `ReceiptPaper` holding `scene.lines.header` and `scene.lines.00`, posed in `slip-open` with a CSS 3D transform (MS 7.3, MS D7). There is no raster poster, so the H1 stays the LCP element at every width.
2. Hydration: islands mount; `MotionPreference` fills `envStore`; `SmoothScroll` starts loading the motion chunk when `desktop && motion === "full"`.
3. `StageLoader` waits for `whenIdle()`, runs `probeTier()`, writes the tier to `envStore` and `html[data-tier]`.
4. Tier 1 or 2: `StageLoader` renders `<StageErrorBoundary><Stage tier={tier} /></StageErrorBoundary>`, where `Stage = dynamic(() => import("./stage"), { ssr: false, loading: () => null })` is declared at module scope of the Client Component `stage-loader.tsx`. Rendering waits until the motion chunk is ready (`registerStage` needs the ticker); `StageLoader` reads that readiness from a module flag set by `DesktopMotion`.
5. `Stage` creates the scene, waits for `document.fonts.load("400 48px " + interFamily)` before the first texture draw, awaits `renderer.compileAsync(scene, camera)`, renders one frame, registers with the clock, then runs `en-poster-to-canvas` no earlier than FCP + 1200 ms (MS 7.1). After the fade it sets `html[data-stage="live"]`; CSS then hides the DOM poster (`visibility: hidden`, kept for context loss) and makes the lane `<ol>` visually hidden but still read by assistive technology (CD 4.8).
6. If the scene is not ready within 10,000 ms of the idle start, `Stage` aborts with `setTier(0, "init-timeout")` for this page view, not stored (MS 7.6).
7. Tier 0: nothing else loads. The DOM poster stays at entry 00; from entry 01 the lane receipt list is visible (`html[data-active-entry]` not `00`).

`interFamily` is read from the CSS variable `next/font` sets (`getComputedStyle(document.documentElement).getPropertyValue("--font-inter")`), because `next/font` renames the family to a hashed name and the literal `"Inter"` would silently fall back to a system font in the 2D canvas.

### 6.2 `stage-loader.tsx`

```tsx
"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { envStore, useEnv } from "@/lib/landing/env-store";
import { probeTier, whenIdle } from "@/lib/landing/capabilities";
import { StageErrorBoundary } from "./stage-error-boundary";

const Stage = dynamic(() => import("./stage"), { ssr: false, loading: () => null });

export function StageLoader() {
  const desktop = useEnv((e) => e.desktop);
  const motion = useEnv((e) => e.motion);
  const tier = useEnv((e) => e.tier);

  useEffect(() => {
    if (!desktop || motion !== "full") return;
    let cancelled = false;
    const cancelIdle = whenIdle(() => {
      probeTier(envStore.getSnapshot()).then(({ tier, reason }) => {
        if (cancelled) return;
        envStore.setTier(tier, reason);
        document.documentElement.dataset.tier = String(tier);
      });
    });
    return () => { cancelled = true; cancelIdle(); delete document.documentElement.dataset.tier; };
  }, [desktop, motion]);

  if (!desktop || motion !== "full" || tier === null || tier === 0) return null;
  return <StageErrorBoundary><Stage tier={tier} /></StageErrorBoundary>;
}
```

### 6.3 Stage contract (internals owned by 04-webgl-scene.md)

```ts
// stage/stage.tsx: default export
export default function Stage(props: { tier: 1 | 2 }): React.JSX.Element;   // <canvas aria-hidden="true" data-stage-canvas>

// stage/scene.ts
export interface Scene {
  render(timeMs: number): void;
  resize(cssW: number, cssH: number, dpr: number): void;
  setLines(printed: readonly PrintLineId[], instant: boolean): void;
  dispose(): void;   // disposes every GPU object, then renderer.forceContextLoss()
}
export function createScene(canvas: HTMLCanvasElement, opts: { tier: 1 | 2; fontFamily: string; palette: readonly number[] }): Promise<Scene>;

// stage/poses.ts
export function stateFor(entry: EntryId, approved: boolean): SceneStateId | null;   // null hides the canvas
```

- One canvas: `position: fixed; inset: 0; height: 100lvh; pointer-events: none`, z-index `--lp-z-canvas`. It renders inside `.lp`, so Activity hides it with the route.
- Renderer: `antialias: false`, `alpha: true`, `powerPreference: "default"`, `preserveDrawingBuffer: false`, `stencil: false`, `NoToneMapping`, `SRGBColorSpace`.
- DPR: tier 2 `min(devicePixelRatio, 2, sqrt(2.1e6 / (cssW * cssH)))`; tier 1 `min(devicePixelRatio, 1, sqrt(1.0e6 / (cssW * cssH)))`; both rounded down to 0.25 steps.
- Resize only on a width change or a height change above 25%.
- Strict Mode in development runs the effect twice. `createScene` is awaited behind an `alive` flag; a scene that resolves after cleanup is disposed at once, so two contexts never coexist.

### 6.4 Error handling and fallback

| Failure | Detection | Handling |
| --- | --- | --- |
| WebGL chunk fails to download | `next/dynamic` rejects and React throws to the nearest boundary | `StageErrorBoundary.componentDidCatch` calls `envStore.setTier(0, "chunk-error")` and renders `null`; DOM poster and lane list remain |
| Error during render or in an effect | Error boundary (React routes effect errors to boundaries) | Same, reason `init-error` |
| Async failure (`compileAsync` rejects, fonts never resolve within 3 s) | `try/catch` in the effect | `setTier(0, "init-error")` |
| Not ready within 10 s of idle start | Timer in the effect | `setTier(0, "init-timeout")`, not stored |
| Context lost, first time | `webglcontextlost` with `event.preventDefault()` | Stop rendering, remove `html[data-stage]` (DOM receipt visible again), rebuild once on `webglcontextrestored` |
| Context lost, second time | Counter in the Stage | `setTier(0, "context-lost-twice")`, stored in `sessionStorage` |
| Sampler demotion | `sampler.ts` | `setTier(lower, "sampler")`; tier 1 remounts lighter; tier 0 unmounts |
| Motion set to Reduced | `envStore.motion` | `completeAll()` first (MS 11.2), then `StageLoader` and `SmoothScroll` unmount their children |

`StageErrorBoundary` is a small class component (React has no hook for error boundaries). It never shows a message: a failed decoration is silent and the content is unaffected.

---

## 7. Reusing and forking shared components

### 7.1 Decisions

| Component | Used today by | Landing decision | Change to the shared file | Effect on other routes |
| --- | --- | --- | --- | --- |
| `Container` | Many | Not needed: DS defines `lp-container` (1280px, DS gutters) for the landing grid | None | None |
| `ButtonLink` / `Button` | Many, incl. auth and dashboard | Not used on the landing. Custody candidates are `next/link` elements with class `lp-btn` and `data-lime-candidate` (DS 5.3), so the shared variants never decide landing colour | P2 only: `hover:bg-[#d8e61a]` becomes the `--accent-hover` token; radii and focus ring per DS (inventory C4, C7) | Visual change on every route, accepted in P2 (brief open item 2) |
| `FaqList` | `/pricing`, formerly `/` | Reused in entry 09; DS styles it through `.lp` (`lp-faq-q`) | `Faq.a` widens from `string` to `ReactNode`, so answers can end with a claim chip (`see 03`, `see 05`); entry 09 passes the plain answer text separately to `JsonLd` | None: `/pricing` passes strings, which are valid `ReactNode` |
| `SectionHeading` | Many | Not used (the entry shell has its own anatomy) | None | None |
| `HowItWorksSteps` | `/how-it-works`, formerly `/` | Not used; the ledger arc replaces the four steps | None | `/how-it-works` unchanged (its "Upload your resume" text is flagged in 16) |
| `CtaBand` | `/pricing`, `/about`, `/how-it-works`, formerly `/` | Not used; entry 10 needs a custody candidate, the approved-line swap and the lane receipt | None | Unchanged (its "No card." default is flagged in 16) |
| `PricingPlans` | `/pricing`, formerly `/` | Forked into `islands/billing-plans.tsx`: the landing needs one state shared by the interval switch, the cards, the odometer prices and the calculator, the `pro` candidate, and no "Most chosen" badge (CD A17) | P2 fixes the shared lime violations once (inventory C3, DS Q10): active interval segment Carbon Veil, "Most chosen" a neutral outlined badge. It also exports `INTERVAL_LABEL` and `PER` for the fork | `/pricing` loses two lime fills, which the brief requires anyway |
| `Navbar` | `(public)`, `(legal)`, now `(landing)` | Reused with `variant="landing"` | New props `variant?: "default" \| "landing"`, `caption?: ReactNode`, `sheetExtra?: ReactNode`. Landing variant: Start free as `lp-btn` with `data-lime-candidate="navbar"`, sheet button `navbar-sheet`, `caption` rendered at 1024 to 1279px, `sheetExtra` inside the sheet, `data-lenis-prevent` on the sheet. Both variants: collapse breakpoint `md` becomes `lg` (CD 5.4), and the mobile menu becomes a native `<dialog>` opened with `showModal()`, closed on link click and in a `useLayoutEffect` cleanup | Default variant: only the breakpoint, the dialog and the P2 token colours change, all brief-conformant |
| `Logo` | Navbar, footer, sidebar, header, auth layout | Reused | P2 (DS 6.12): `rx="0"`, square linecaps, `data-logo-mark` on the square. The landing turns it Phosphor White with `.lp [data-logo-mark] { fill: var(--foreground) }` | Off the landing the logo stays lime (brief role) |
| `Footer` | `(public)`, `(legal)`, now `(landing)` | Reused unchanged under `Colophon`; inside `.lp` its logo follows the landing rule above | None | None |

### 7.2 Why fork `PricingPlans` instead of wrapping it

Wrapping works for styling but not for `PricingPlans`, whose interval state is private while the calculator needs the same interval. A fork of about 120 lines that reuses `PLANS`, `creditsPerInvoice`, `INTERVAL_LABEL` and `PER` is less code than lifting state into the shared component and threading props through `/pricing`.

### 7.3 Plan data (prerequisite P3)

`shared/src/plans.ts` has prices and 30-day grants, but the calculator also needs the weekly and quarterly grants (94, 280, 700 and 1,200, 3,600, 9,000), which exist today only inside `server/src/services/stripe.ts` as `Math.ceil((perCycle * 7) / 30)` and `perCycle * 3`. P3 moves that function to `shared/src/plans.ts` as `creditsPerInvoice(planId: PlanId, interval: BillingInterval): number` and the server imports it. The landing then reads every price, grant and feature string from `@auto-career/shared`, so the page and billing cannot drift. A unit test asserts the nine values.

---

## 8. Prerequisite P2: the `globals.css` token migration

### 8.1 Why it is separate

The landing depends on the brief's dark phosphor tokens, but `globals.css` serves every route: 56 files use token utilities and 30 routes change (inventory section 4). P2 lands as its own change, reviewed and merged before Phase 1, so no landing diff is also a dashboard diff. DS 1.3 fixes its first commit to six files: `globals.css`, `layout.tsx` (fonts), `button.tsx`, `badge.tsx`, `logo.tsx`, `navbar.tsx`.

### 8.2 Scope

1. `globals.css`: the brief's `:root` values and new roles, the `@theme inline` alias block that keeps every existing utility resolving, `--font-sans` and `--font-display` mapped to `--font-inter` and `--font-inter-tight`, the base layer rules (DS 1). Values and the alias table belong to DS.
2. Remove the global `h1, h2, h3, h4, strong, b, th { font-weight: 400 }` rule; `ss01` on display headings, `cv11` on body (DS 1, inventory F4 to F6).
3. `app/layout.tsx`: the font setup and `<html>` attributes in 2.7 (the head script itself arrives in Phase 2 with `preference.ts`; P2 adds only `suppressHydrationWarning` and `data-lime-owner`).
4. `button.tsx`, `badge.tsx`, `logo.tsx`, `navbar.tsx`: tokenised hover, radii, focus ring (C4, C7), no lime on active states (C3), logo geometry (DS 6.12), navbar colours (DS C1).
5. Follow-up commits in the same change: `sidebar-nav.tsx` and `pricing-plans.tsx` lime fixes (C3); the audit of `text-subtle` uses DS lists.
6. Add the reduced-motion View Transition guard from the Next guide to `globals.css` (harmless while no `<ViewTransition>` exists).

### 8.3 Affected pages

All 30 routes in `code-inventory.md` section 4: `/`, `/how-it-works`, `/pricing`, `/about`, `/blog`, `/blog/[slug]`, `/careers`, `/contact`, `/terms`, `/privacy`, `/cookies`, `/refunds`, `/login`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-otp`, `/dashboard`, `/matches`, `/queue`, `/applications`, `/applications/[id]`, `/inbox`, `/profile`, `/preferences`, `/billing`, `/settings`, `/onboarding`, the 404 page and the error boundary, through `app/layout.tsx`, the group layouts, `components/layout/*` and `components/shared/*`.

### 8.4 Visual check

| Step | What | Pass |
| --- | --- | --- |
| 1 | Before P2, `e2e/routes-visual.spec.ts` captures full-page screenshots of every public, legal and auth route at 1440 by 900 and 390 by 844 (the "before" set, attached to the P2 review, not committed as baselines) | Set exists |
| 2 | Dashboard routes: a Playwright `setup` project signs up a throwaway account against the local stack (`npm run infra:up`, `npm run dev:api`, `npm run dev:web`) and stores `storageState`; the same spec captures the 12 dashboard routes. If the local stack cannot run, the reviewer runs step 5 by hand on those routes | Set exists, or checklist recorded |
| 3 | After P2, the same spec produces the "after" set; the reviewer compares every pair (DS order: auth, public, legal, dashboard) | Every difference is an intended token change |
| 4 | Automated: axe-core on every captured route reports zero contrast violations; the lime check (CD 3.3 method, DS L10 colours) reports at most one lime element per viewport on every route; a grep finds no `#d8e61a`, `#e4f222`, `text-white` or `bg-[#` under `web/app` and `web/components` | All pass |
| 5 | Manual per route: visible focus ring on every interactive element; status words readable; no lime text; skeletons visible on Void; `--danger-fill` only on account deletion | Signed off in the review |
| 6 | After merge, the "after" screenshots of `/pricing` and `/how-it-works` become committed baselines for regression in every later phase (10.2) | Committed |

---

## 9. Performance budgets and enforcement

### 9.1 Budgets

| Metric | Budget | Measured by |
| --- | --- | --- |
| LCP, desktop | 1.5 s or less (Lighthouse desktop preset); the LCP element is the H1 at 1024, 1280, 1440 (MS Q8) | LHCI + `e2e/budgets.spec.ts` (PerformanceObserver `largest-contentful-paint`, element check) |
| LCP, mobile | 2.5 s or less (Lighthouse mobile preset: simulated slow 4G, 4x CPU); the LCP element is the H1 at 390 | Same |
| CLS | 0.05 or less in both presets; 0 during a scripted full-page scroll at 1440 by 900 and 390 by 844 | LHCI + `budgets.spec.ts` (`layout-shift`) |
| TBT | 150 ms or less mobile, 50 ms or less desktop | LHCI |
| INP (lab) | Every scripted interaction (fit bar range, Seniority select, sponsorship radio, Approve, Edit, calculator number input, interval switch, FAQ toggle, tape dialog, Motion control) has an `event` timing entry of 100 ms or less under 4x CPU throttling | `budgets.spec.ts` (`event`, `durationThreshold: 16`) |
| Long tasks after hydration | None above 50 ms on desktop tier 0 and mobile (MS 12.4); on tier 2 none above 50 ms except one shader compile window, which must stay under 120 ms | `budgets.spec.ts` (`longtask`) |
| JS gzip per chunk | Islands 20 KB, motion 60 KB, WebGL 140 KB | `budgets.spec.ts` |
| JS gzip per situation | Section 3.3 | Same |
| Framework JS | `frameworkBytes` + 5% | Same |
| HTML document (includes the inline RSC payload and sample data) | 60 KB gzip | Same |
| CSS total (globals, landing, motion) | 25 KB gzip | Same |
| Fonts | 2 woff2 files, 85 KB total | Same |
| Images in the landing page | 0 raster images (the poster is DOM); inline SVG only | Same (no `image` responses) |
| Open Graph image | 120 KB | `test/assets.test.ts` |
| Total first-load transfer | 1.0 MB desktop tier 2; 500 KB at 390 by 844 | `budgets.spec.ts` + LHCI `total-byte-weight` |
| Third-party requests | 0 | `budgets.spec.ts` (every request host equals the test origin) |
| WebGL drawing buffer | 2.1 MP tier 2, 1.0 MP tier 1 | `e2e/webgl.spec.ts` (`canvas.width * canvas.height`) |
| Renders at rest | 0 over 2 s (MS Q27 at entry 04) | `webgl.spec.ts` through the e2e render counter |

### 9.2 Lighthouse CI

`web/lighthouserc.json` collects `http://localhost:3100/` three times per preset against `next start` and asserts, at `error` level: `largest-contentful-paint`, `cumulative-layout-shift`, `total-blocking-time`, `total-byte-weight` with the values above, `categories:accessibility >= 0.95` and `categories:seo >= 0.95`. Lighthouse's headless Chromium has no GPU, so on desktop it measures tier 0 (the probe fails the performance-caveat check); the tier 2 cost is covered by the Playwright budget and long-task checks.

### 9.3 Byte budget test

Next 16 no longer prints `First Load JS`, so the gate counts what the browser downloads. `e2e/budgets.spec.ts`, per situation in 3.3: loads `/` at the right viewport, `reducedMotion` and tier override; waits for `load`, then 5 s; collects every response's `request.sizes().responseBodySize` (encoded bytes); classifies scripts by marker (`ScrollTrigger` for the motion chunk, `THREE.WebGLRenderer` for the WebGL chunk, scripts also present on `/pricing` as framework, the rest as islands); asserts `ScrollTrigger` appears in exactly one script; compares with `web/perf/budgets.json`. The Turbopack Bundle Analyzer in Next 16.4 is the diagnosis tool when the test fails, not the gate.

### 9.4 CI order

```
npm run lint -w @auto-career/web
npm run typecheck -w @auto-career/web
npm run test -w @auto-career/web            # Vitest: unit, tokens, copy lint, claims, palette, calculator, assets
npm run test -w @auto-career/server         # includes the P1 fit-sample drift test
NEXT_PUBLIC_E2E=1 npm run build -w @auto-career/web
npm run test:e2e -w @auto-career/web        # Playwright against next start -p 3100
npm run perf -w @auto-career/web            # lhci autorun
```

New scripts in `web/package.json`: `"test": "vitest run"`, `"test:e2e": "playwright test"`, `"perf": "lhci autorun"`. The production build runs without `NEXT_PUBLIC_E2E`, which removes the test hooks by dead-code elimination; the CI build differs only by those branches. LHCI runs against the same e2e build (the hooks add under 200 bytes and do nothing unless a test sets them).

---

## 10. Testing

### 10.1 Configuration

`web/playwright.config.ts`:

| Project | Device | Viewport | Notes |
| --- | --- | --- | --- |
| `desktop-chromium` | Desktop Chrome | 1440 by 900 | Launch args `--use-angle=swiftshader --enable-unsafe-swiftshader` so WebGL exists; specs that need the scene force the tier with `page.addInitScript(() => { window.__KAIROS_TIER__ = 2 })`, because SwiftShader fails `failIfMajorPerformanceCaveat` by design (which the default-path specs rely on) |
| `laptop-chromium-1280`, `laptop-chromium-1024` | Desktop Chrome | 1280 by 800, 1024 by 768 | Rail and caption boundaries, pin at the 1024 edge |
| `mobile-chromium` | Pixel 7 descriptor | 390 by 844 (375 by 667 inside `mobile.spec.ts`) | `isMobile`, `hasTouch` |
| `mobile-webkit` | iPhone 13 descriptor | 390 by 844 | WebKit layout, `lvh`, sticky tape |
| `desktop-webkit`, `desktop-firefox` | Desktop Safari, Firefox | 1440 by 900 | Smoke and no-JS specs only |

`webServer`: `npm run start -- -p 3100` after the e2e build; `reuseExistingServer: !process.env.CI`. Screenshot defaults: `animations: "disabled"`, `caret: "hide"`, `maxDiffPixelRatio: 0.01`, masks on `[data-mask]` (the footer clock and every stamp time carry `data-mask`). Every locator uses `getByRole`, `getByLabel` or `.filter({ visible: true })`, because Activity keeps hidden routes, and the landing's second navbar instance, in the DOM.

E2E hooks, present only when `NEXT_PUBLIC_E2E === "1"`: `window.__kairosMotion = { gsap, ScrollTrigger }` (MS Q5), `window.__kairos = { ledger: ledgerStore, env: envStore, renders: () => number, contexts: () => number }`, `window.__KAIROS_TIER__` (read once by `probeTier`).

### 10.2 Playwright specs (`web/e2e/`)

| Spec | Checks |
| --- | --- |
| `smoke.spec.ts` | `/` returns 200; one `h1`; the 11 `section[data-entry]` in order with the `ENTRIES` ids, anchors, `data-section` and `data-scene` values; CTA `href`s are `/sign-up` or plan URLs; no console or page errors; no failed requests; the JSON-LD parses and its answers equal the visible FAQ text |
| `no-js.spec.ts` (`javaScriptEnabled: false`) | Every string in `landingCopy` (flattened, templates excluded) is in the DOM; only the hero CTA computes to a lime background; titles `transform: none`, rules `scaleX(1)`; entry 05 in normal flow; `<details>` work; every `open · see NN` link reaches its entry; no `canvas`; Motion control hidden (MS Q9) |
| `reduced-motion.spec.ts` (`reducedMotion: "reduce"`) at 1440 and 390 | No `canvas`; no script containing `ScrollTrigger`, `lenis` or `THREE.WebGLRenderer`; no `html.lenis`; entry 05 not pinned; all text present; storing "Full" then reloading loads the motion chunk and keeps Lenis smoothing off (MS 5.1, Q6, Q7) |
| `motion-toggle.spec.ts` | At 1440 by 900, Full, tier 2: Reduced mid-feed completes the feed and removes the canvas, `html.lenis` and `data-stage`; text unchanged; choice persists across reload; the head script output matches the stored value on the first frame (MS Q7) |
| `mobile.spec.ts` at 390 by 844 and 375 by 667 | `scrollWidth <= clientWidth` at 20 positions; hero CTA bottom edge at or above 667px at 375 by 667; no script containing `ScrollTrigger`, `lenis` or `THREE.WebGLRenderer`; tape appears from entry 02 and its dialog lists all entries; compare table renders as stacked pairs; every interactive element at least 44 by 44px and 8px from neighbours; entry 05 reaches its printed and torn end state (`mb-print-tear`) |
| `lime.spec.ts` | CD 3.3 method with DS L10 colours at 1440 by 900 and 390 by 844 (100px steps, 400ms wait), plus the open sheet at 390; and: after a soft navigation from `/` to `/pricing`, the default navbar CTA on `/pricing` is lime |
| `activity.spec.ts` | Approve on `/`, follow the navbar link to `/pricing`: `html[data-lime-owner="hero"]`, no `html.lenis`, no `data-stage`, `window.__kairos.contexts()` is 0, no visible canvas; go back: stamp, settled row 03 and printed lines present without re-animation, canvas rebuilt; three round trips leave `ScrollTrigger.getAll().length` at its first-load value (MS Q22) |
| `lane.spec.ts` at 1024, 1280 and 1440 | No text node box intersects the `[data-lane]` rectangle (CD 10.5) |
| `webgl.spec.ts` (tier forced 2, then 1) | Canvas appears after idle and the DOM poster is then hidden; drawing buffer within budget; 0 renders over 2 s at rest; palette histogram at 12 scroll positions (Void or hue 95 to 135 degrees, CD 10.5); `WEBGL_lose_context.loseContext()` shows the lane receipt; a second loss stores tier 0 and a reload requests no WebGL chunk |
| `a11y.spec.ts` | axe-core with zero critical and zero serious violations at 375, 768, 1024 and 1440, in Full, Reduced and approved states; keyboard path: "Skip to pricing" focuses the entry 07 heading; the sample run works with arrow keys; Approve works with Enter and Space; the citation trace works on focus; the tape dialog traps and returns focus |
| `visual.spec.ts` | One element screenshot per `data-section` (14 sections) at 1440 by 900 and 390 by 844 under `reducedMotion: "reduce"` (deterministic final states, tier 0), plus approved variants of entries 01, 04, 05 and 10, plus three tier 2 canvas screenshots (`slip-open`, `slip-hold` after approval, `slip-fresh`) at `maxDiffPixelRatio: 0.02` |
| `routes-visual.spec.ts` | P2 before and after sets (8.4), then the regression guard for `/pricing` and `/how-it-works` in every later phase |
| `motion-qa.spec.ts` | MS Q5, Q13, Q15, Q16, Q17, Q19, Q27 (owned by MS; listed here so the harness includes them) |
| `budgets.spec.ts` | Section 9 |

### 10.3 Unit tests (`web/test/`, Vitest, Node environment)

| Test | Checks |
| --- | --- |
| `calculator.test.ts` | Full-use table (monthly $0.048, $0.033, $0.026; weekly $0.064, $0.043, $0.036; quarterly $0.038, $0.026, $0.021); the zero-submitted text; failed rows always $0.00; integer thousandths arithmetic |
| `plans.test.ts` | `creditsPerInvoice`: 94/280/700, 400/1,200/3,000, 1,200/3,600/9,000 |
| `tokens.test.ts` (MS Q4) | The `.lp` token block in `landing.css` equals `web/lib/motion/tokens.ts`; the reduced blocks are identical (15.2 C1 fixes the file and selector it parses) |
| `palette.test.ts` | `stage/palette.ts` holds exactly the six CD 4.2 colours and not `0x7fee64` |
| `ledger-store.test.ts` | Append-only; idempotent post and print; monotonic post; first approve wins; works with a throwing `sessionStorage`; server snapshot referentially stable |
| `sections.test.ts` | 11 entries; unique ids; anchors `entry-NN`; scene ids valid; every `section` is a top-level key of `landingCopy` |
| `claims.test.ts` | Every `data-claim` id in entry files exists in `claims.ts` with a `see` target or a source note; six claims carry `see` chips (CD 10.6); the footer count equals `claims.length` |
| `copy-lint.test.ts` | COPY section 21 over `web/content/landing-copy.ts`, plus U+2014 and U+2013 over `web/components/landing/**` and `web/app/(landing)/**` |
| `scene-lines.test.ts` | `landingCopy.scene.lines` match CD 4.4; feed reasons in `fit-sample.json` are a subset of the `fit.ts` strings |
| `scripts.test.ts` | JSON-LD contains no rating and no `</script`; `MOTION_HEAD_SCRIPT` sets only `data-motion` and reads only `localStorage["kairos:motion"]` and the media query |
| `assets.test.ts` | File-size budgets in 9.1 |

### 10.4 Server test (prerequisite P1)

`server/test/landing-fit-sample.test.ts` re-runs `server/scripts/build-landing-fit-sample.ts` in memory and fails if the output differs from `web/content/fit-sample.json` or contains a reason string `passesHardFilters` cannot produce (CD 10.4 P1).

---

## 11. Analytics

None. A search for `analytics`, `posthog`, `gtag`, `plausible`, `umami`, `segment`, `mixpanel`, `@vercel/analytics` and `speed-insights` in `web`, `shared` and `server/src` found no analytics code; the only hit is the cookies page sentence "If we add product analytics, we will list the cookies here and ask for consent where the law requires it." The landing sends no events and makes no third-party requests (9.1 enforces zero). If analytics is added later, the five CTAs are already uniquely identified by `data-lime-candidate` (`hero`, `approve`, `pro`, `closing`, `navbar`), so no new attributes are needed now.

---

## 12. Risks specific to Next.js 16 and React 19

| # | Risk | Where it bites | Mitigation |
| --- | --- | --- | --- |
| R1 | Activity keeps the hidden landing in the DOM (`display: none`) and runs effect cleanups; side effects created outside effects leak into other routes | Navigation away from `/` | Ownership table 4.8; `activity.spec.ts` |
| R2 | Up to three hidden routes are preserved; a WebGL context kept while hidden wastes GPU memory and counts against the browser's context cap | Back and forth navigation | `dispose()` + `forceContextLoss()` in cleanup; one canvas; `contexts()` hook test |
| R3 | Global `:has()` selectors keep matching hidden-route content | Landing scope | `.lp` is a React-owned element inside the hidden route (1.3) |
| R4 | Raw Playwright locators match hidden Activity content and the landing's own second navbar | All e2e specs | `getByRole` and `.filter({ visible: true })` only |
| R5 | `ensureStatic = 'navigation'` fails the build if request-time work enters the route (cookies, headers, uncached fetch, a request-dependent promise passed to a Client Component) | Any later edit | Intended guard. The landing reads no request data; `BUILD_DATE` is inlined by `env` |
| R6 | Client Components that call `Date.now()`, `new Date()` or `Math.random()` during render fail prerendering | Clock, stamps, seeds | Times in effects and handlers only; sample data pre-generated by P1; the ticker's time for elapsed time |
| R7 | `useSearchParams()` in a Client Component needs a Suspense boundary to prerender | A tempting `?tier=` or `?motion=` override | No search params on the landing; overrides are a build-gated `window` property and the stored preference |
| R8 | `ssr: false` is illegal in Server Components | Both lazy loaders | Declared at module scope of Client Components (`smooth-scroll.tsx`, `stage-loader.tsx`) |
| R9 | Turbopack is the default and a custom `webpack` config fails `next build` | GLSL or asset loaders | Shaders are TypeScript template strings; no loaders; the existing `turbopack.rules` for CSS is kept |
| R10 | `next build` no longer reports bundle sizes | Budgets | Playwright byte test (9.3) |
| R11 | `next/image` `priority` is deprecated; `images.qualities` defaults to `[75]` | Any future raster image | The landing has none; the Open Graph image is a static file referenced by metadata |
| R12 | Next no longer overrides `scroll-behavior: smooth` during navigation | Global smooth-scroll CSS would make route changes scroll visibly | `scroll-behavior: auto` on the landing (MS 5.6); no global smooth scroll |
| R13 | React hydration warns when `<html>` attributes differ from the server render | Head script and runtime set attributes on `<html>` | `suppressHydrationWarning` on `<html>` (its own attributes only) |
| R14 | Inline `<script>` elements inserted by React during client rendering do not execute; the head script runs only on hard loads | Soft navigation into `/` | `MotionPreference` re-applies `data-motion` in a layout effect; the root layout's head runs on every hard load of any route, so the attribute is usually already right |
| R15 | `useSyncExternalStore` loops or throws if a snapshot function returns a new object each call | Stores | Snapshots replaced only on change; server snapshots are module constants; unit-tested |
| R16 | Strict Mode in development runs effects twice | Two WebGL contexts, two Lenis instances | Cancellable async scene creation; full cleanup; verified in `next dev` before Phase 4 ends |
| R17 | `eslint-plugin-react-hooks` 7 (with `eslint-config-next` 16) includes compiler-derived rules (refs read during render, mutation of hook values, setState in effects) | Stage, runtime, stores | Three objects live in effect closures; `sceneInput` is a module object, not a hook value; refs read only in effects and handlers; any disable comment names the rule and the reason |
| R18 | React Compiler, if enabled app-wide later, memoises imperative components | Stage and motion files | Not enabled. If it is, add `"use no memo"` to `stage.tsx`, `desktop.tsx` and `smooth-scroll.tsx` |
| R19 | `env` in `next.config.ts` is marked Legacy | `BUILD_DATE` | Still documented and inlined; if removed later, the build script sets `NEXT_PUBLIC_BUILD_DATE` instead |
| R20 | View Transitions animate once a `<ViewTransition>` exists; a fixed-canvas snapshot can flash in Safari | Future route transitions | Not used on the landing in this release; the reduced-motion guard is already in `globals.css` |
| R21 | R3F peers on React `<19.4` | Only if R3F replaces vanilla three | Not used; recorded so a React bump is checked if the fallback is ever taken |
| R22 | The GSAP licence is free but not open source and may be revised on continued use | Legal | Snapshot in `web/LICENSES/` with the fetch date; re-read at every GSAP upgrade |
| R23 | `next/font` renames font families with a hash | Canvas text in the print texture | Family read from `--font-inter` at runtime (6.1) |
| R24 | Moving `/` into `(landing)` creates a second instance of `Navbar` and `Footer` in the hidden route | Memory, duplicate landmarks in the DOM | Hidden content is removed from the accessibility tree by `display: none`; at most three routes are kept |
| R25 | Two pages resolving to `/` (`(public)/page.tsx` and `(landing)/page.tsx`) fail the build | Phase 1 move | The move deletes the old file in the same commit |
| R26 | Partial Prefetching prefetches the landing's static output from other pages' links | None harmful | Prefetch carries HTML and RSC payload, not the lazy chunks, which load only on `/` after hydration or idle |

---

## 13. Build order sketch

Phases only; the implementation plan breaks each into tasks. From Phase 1 on, the page is shippable at the end of every phase.

| Phase | Content | Exit checks |
| --- | --- | --- |
| 0. Prerequisites and harness | Vitest, Playwright and LHCI configs; `perf/budgets.json` with `frameworkBytes` measured on `/pricing`; P2 "before" set captured, then P2 merged on its own; P3 (`creditsPerInvoice`); P1 (fit sample generator, JSON, drift test); dependencies installed with exact pins; P4 (`npm ls three` shows one copy); GSAP licence snapshot | P2 visual check signed off (8.4); `plans.test.ts` and the P1 drift test green; lint and typecheck green |
| 1. Static page | `(landing)` route group, `LandingShell`, `(public)/page.tsx` deleted; `page.tsx` with `ensureStatic`, metadata, `JsonLd`; all eleven entries, the colophon and the marks as Server Components with final copy from `landingCopy`; `landing.css` (tokens, grid, lane, custody CSS); navbar variant, logo and FAQ list edits; old landing files deleted | `smoke`, `no-js`, static `a11y`, `copy-lint`, `claims`, `scripts`, `sections`, `scene-lines`, `routes-visual` for `/pricing` and `/how-it-works`, LHCI both presets |
| 2. Islands and CSS motion | Stores, `preference.ts` + head script, `tokens.ts`, `MotionPreference`, `MotionToggle`, `LimeCustody`, `EntryPoster`, `SettleCell`, `SampleRun`, `CitationDemo`, `ApproveSample`, `ReceiptSlot` (incl. `mb-print-tear`), `BillingPlans`, `Odometer`, `ApprovedLine`, `LedgerRail`, `EntryCaption`, `ReceiptTape`, `LaneReceipt`, `FooterClock`; `motion.css` presets | `lime`, `mobile`, `reduced-motion`, keyboard `a11y`, `activity` (minus WebGL), `calculator`, `ledger-store`, `tokens`, islands budget 20 KB, INP |
| 3. Motion chunk | `SmoothScroll`, `desktop.tsx`, `gsap.ts`, `clock.ts`, `scene-driver.ts`, `title-rise.ts`, `anchors.ts`, `stage-timeline.ts` with the DOM-only stage variant (works at tier 0, MS D4) | Motion budget 60 KB; `motion-toggle`; `activity` (Lenis cleanup, Q22); CLS 0 in the scripted scroll; MS Q5, Q13, Q15, Q16, Q17 |
| 4. WebGL stage | `capabilities.ts` probe; `StageLoader`, `StageErrorBoundary`, `Stage`, `scene.ts`, `poses.ts`, `shaders.ts`, `palette.ts`, `print-texture.ts`, `sampler.ts`; the nine scene states; tear, hand-off and paper band on the pinned stage; context-loss path | `webgl`, `palette`, WebGL budget 140 KB, long tasks, `activity` (contexts 0), `lane`, canvas snapshots, legibility sign-off at DPR 1 and 2 (CD 10.5), MS Q27 |
| 5. Hardening and launch gates | Full budget run; LHCI at error level; real-device pass on iPhone (Safari 17 and 18), a mid-range Android (Chrome), a pre-M1 Mac (Safari) for sticky and pin behaviour; NVDA and VoiceOver passes; visual baselines locked; gates G2 to G9 resolved or their fallbacks applied | Every check in sections 9 and 10 green; gate log complete |

---

## 14. Interfaces other documents must use

### 14.1 Identifiers

- Section ids (`data-section`): `navbar`, `ledger-rail`, `entry-00-hero`, `entry-01-reported`, `entry-02-fit-gate`, `entry-03-truth-lock`, `entry-04-approve`, `entry-05-send-receipt`, `entry-06-replies`, `entry-07-billing`, `entry-08-compare`, `entry-09-questions`, `entry-10-start`, `footer`.
- Anchor ids `entry-00` to `entry-10`; heading ids `entry-NN-title`; colophon `id="colophon"`; `<main id="main">`.
- Entry numbers (`data-entry`, `EntryId`): `"00"` to `"10"`.
- Scene state ids (`SceneStateId`, `data-scene`): `slip-open`, `slip-recede`, `slip-feed`, `slip-cite`, `slip-hold`, `slip-tear`, `ghost-path`, `slip-reply`, `slip-fresh`; `data-scene="none"` on entries 07 to 09.
- Print line ids (`PrintLineId`, the keys of `landingCopy.scene.lines`): `header`, `00`, `feedRow`, `02`, `rulesChanged`, `03`, `04approved`, `04awaiting`, `05approved`, `05notApproved`, `filedHeader`, `05filed`, `06`, `10header`, `10`.
- Copy: `landingCopy` in `web/content/landing-copy.ts`, keys `{sectionId}.{element}` plus `meta`, `shared`, `scene` (COPY section 0). FAQ items `landingCopy["entry-09-questions"].faq[]` with `{ q, a }`. Claims: `claims` in `web/content/claims.ts`, referenced by `data-claim="<id>"`. Sample data: `web/content/fit-sample.json`.

### 14.2 DOM attributes, classes and storage

- On `<html>`: `data-lime-owner` (`approve`, `hero`, `pro`, `closing`, `navbar`; server default `hero`), `data-motion` (`full`, `reduced`), `data-tier` (`0`, `1`, `2`), `data-stage="live"`, `data-active-entry="NN"`.
- Scope: `.lp` on the `LandingShell` root, wrapping the landing navbar, `main` and footer.
- Custody candidates: `.lp-btn[data-lime-candidate]` with `approve`, `hero`, `pro`, `closing`, `navbar`, `navbar-sheet`.
- Entry state: `data-post` (`pending`, `live`, `instant`, absent).
- Layout and scene hooks: `[data-story]`, `[data-lane]`, `[data-slot="receipt"]`, `[data-stage-canvas]`, `[data-surface="mint"]`, `[data-split="lines"]`, `[data-mask]`, `[data-logo-mark]`, `[data-lenis-prevent]`, `[data-claim]`.
- Storage keys: `localStorage["kairos:motion"]`, `sessionStorage["kairos:landing:ledger:v1"]`, `sessionStorage["kairos:landing:tier:v1"]`.
- Build and test flags: `process.env.BUILD_DATE`, `process.env.NEXT_PUBLIC_E2E`, `window.__KAIROS_TIER__`, `window.__kairos`, `window.__kairosMotion`.

### 14.3 Modules and exports

- `web/lib/landing/sections.ts`: `ENTRIES`, `EntryDef`, `EntryId`, `EntrySectionId`, `SectionId`, `SceneStateId`.
- `web/lib/landing/ledger-store.ts`: `ledgerStore` (`post`, `print`, `markFeedDone`, `approve`, `tear`, `setActive`), `useLedger`, `LedgerState`, `PrintLineId`.
- `web/lib/landing/env-store.ts`: `envStore` (`refresh`, `setTier`), `useEnv`, `EnvState`, `Tier`, `MotionMode`.
- `web/lib/landing/scene-input.ts`: `sceneInput`, `Rect`.
- `web/lib/landing/capabilities.ts`: `probeTier`, `whenIdle`.
- `web/lib/landing/format.ts`: `formatStamp(iso)`, `formatUsd(cents)`, `formatPerApp(thousandths)`.
- `web/lib/landing/calculator.ts`: `computeReceipt(input)`.
- `web/lib/motion/clock.ts`: `startClock(lenis)`, `registerStage(stage)`, `StageHandle`. `web/lib/motion/desktop.tsx`: default export `DesktopMotion`. `web/lib/motion/preference.ts`: `MOTION_STORAGE_KEY`, `MOTION_HEAD_SCRIPT`, `getEffectiveMotion`, `setMotion`, `subscribeMotion`, `completeAll`. `web/lib/motion/tokens.ts`: `DUR`, `EASE`, `EASE_CSS`, `STAGGER`, `DIST`. `web/lib/motion/gsap.ts`: `gsap`, `ScrollTrigger`, `SplitText`, `useGSAP`.
- `web/components/landing/stage/scene.ts`: `createScene`, `Scene`. `stage/poses.ts`: `POSES`, `stateFor`. `stage/palette.ts`: `PALETTE`.
- `shared/src/plans.ts`: `creditsPerInvoice(planId, interval)` (new), `PLANS`, `PlanId`, `BillingInterval`. `web/components/shared/pricing-plans.tsx`: `INTERVAL_LABEL`, `PER` (newly exported).
- `web/components/layout/navbar.tsx`: `Navbar` props `variant?: "default" | "landing"`, `caption?: ReactNode`, `sheetExtra?: ReactNode`.
- Component files: exact paths in 1.1. Island component names: `MotionPreference`, `SmoothScroll`, `EntryPoster`, `LimeCustody`, `SettleCell`, `SampleRun`, `CitationDemo`, `ApproveSample`, `ReceiptSlot`, `BillingPlans`, `Odometer`, `ApprovedLine`, `LedgerRail`, `EntryCaption`, `ReceiptTape`, `LaneReceipt`, `FooterClock`, `MotionToggle` (`variant="full" | "compact"`), `StageLoader`, `StageErrorBoundary`, `Stage`, `LandingShell`, `JsonLd`, `ReceiptPaper`.

### 14.4 Fonts and CSS files

- `next/font` variables `--font-inter`, `--font-inter-tight`; Tailwind `--font-sans`, `--font-display` (DS 11.5).
- `web/components/landing/landing.css` (DS: tokens on `.lp`, `lp-*` classes, custody rules) and `web/components/landing/motion.css` (MS: preset classes), both imported by `landing-shell.tsx`.

---

## 15. Decisions delegated by sibling documents, and conflicts resolved

### 15.1 Delegated decisions

| Asked by | Question | Decision |
| --- | --- | --- |
| DS Q3 | How `.lp` wraps navbar, `main` and footer on `/` | `(landing)` route group with `LandingShell` (1.3) |
| DS Q5 | Phosphor icon import path and tree-shaking | Import named icons from `@phosphor-icons/react/dist/ssr` in Server Components and from `@phosphor-icons/react` in Client Components, one icon per import, never the package root object; the islands budget test catches regressions. If the SSR path does not resolve in the installed version, use the inline SVG fallback DS names |
| DS Q10 | Shared `PricingPlans` lime | Fixed once in P2 for `/pricing`; the landing forks the markup and reuses data (7.1) |
| MS 15 | Placement of motion modules and islands | `web/lib/motion/*` and the islands as listed in 1.1; head script in the root layout with `suppressHydrationWarning` (2.7) |
| MS O1 | DOM poster or image poster | DOM poster, adopted architecture-wide (6.1); `04-webgl-scene.md` keeps the pose values |

### 15.2 Conflicts between sibling documents

| # | Conflict | Resolution |
| --- | --- | --- |
| C1 | DS 1.4 declares landing tokens on `.lp` in `landing.css`; MS 2.6 declares motion tokens on `:root` in `globals.css` and zeroes them with `:root[data-motion="reduced"]` | Tokens live on `.lp` in `landing.css` (DS is the token owner). A `:root` rule cannot override a value declared on `.lp`, so MS's reduced blocks must be written as `html[data-motion="reduced"] .lp { ... }` and `@media (prefers-reduced-motion: reduce) { html:not([data-motion="full"]) .lp { ... } }`, with MS's full variable list. MS's `tokens.test.ts` parses the `.lp` block of `landing.css` |
| C2 | MS 5.2 names `startClock(stage)`; the Stage mounts after the clock | `startClock(lenis)` plus `registerStage(stage)` in the same module, same behaviour (4.2) |
| C3 | MS 7.4 shows the head script with storage key `kairos:motion`; CD 9.2 speaks of `localStorage` generally | `kairos:motion` everywhere; the other storage keys follow the same `kairos:` prefix (14.2) |

### 15.3 Departures from the creative direction

| # | CD statement | This document | Reason |
| --- | --- | --- | --- |
| D1 | Build target `web/app/(public)/page.tsx` | Same route `/`, file in `web/app/(landing)/page.tsx` | `.lp` must wrap the navbar and footer without touching other public routes (1.3) |
| D2 | Initial JS 15 KB below 1024px, 70 KB at 1024px and wider | 20 KB and 80 KB (3.3) | The CD figures did not include the demos, calculator and stores |
| D3 | Hero poster AVIF at `fetchpriority="low"` | DOM poster (MS D7) | An image poster out-sizes the H1 and becomes the LCP element; DOM saves 40 KB |
| D4 | `EntryPoster` as per-entry ScrollTriggers | One `EntryPoster` island with an IntersectionObserver at every width, plus `scene-driver.ts` in the motion chunk | Settled rows are content state and must work on phones without GSAP (MS 5.7) |
| D5 | View Transitions for landing to `/sign-up` and `/login` | Not used in this release | A fixed-canvas snapshot risks a Safari flash; nothing in the story depends on it |
| D6 | Footer holds the page receipt, clock and Motion control | `Colophon` section (`data-section="footer"`) directly above the shared `Footer` inside `.lp` | The shared footer serves every public and legal route |
| D7 | Tier 0 puts entry 05 in normal flow | Hardware tier 0 keeps the CSS pin with the DOM-only stage (MS D4) | The tier is known only after idle; removing a 100vh pin then would shift the page |

---

## 16. Open questions for the product owner

1. `shared/src/plans.ts` lists "Failed submits refunded automatically" (Starter), while AC10 says failed submits are never charged. Entry 07 renders feature strings from this file (P3), so the string should be corrected at the source before Phase 1 (COPY section 22 item 1 proposes "Failed submits cost nothing").
2. `CtaBand` (on `/pricing`, `/about`, `/how-it-works`) says "No card." and `HowItWorksSteps` (on `/how-it-works`) says "Upload your resume." Both conflict with gate G4 and with paste-only v1. They are outside the landing; their owner should decide whether P2 fixes them.
3. On `/pricing` the navbar CTA and "Choose Pro" are both lime in one viewport. The landing solves this with custody; `/pricing` needs its own decision under the brief.
4. Gate G5 (Phosphor White logo on the landing) is one CSS rule scoped to `.lp`; if the owner rejects it, the CD 3.3 fallback adds a `logo` custody value with no structural change.
