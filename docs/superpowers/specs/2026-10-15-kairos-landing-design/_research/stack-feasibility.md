# Kairos landing page: stack feasibility research

Research date: 2026-10-15. Scope: the web/ Next.js app (Next 16.4, React 19.3, Tailwind 4) and the expressive landing page decided on 2026-10-15 (one WebGL centerpiece, smooth scroll, kinetic typography, scroll-driven storytelling, signed-in app unchanged).

## 0. How to read this document

Every claim carries a confidence tag so spec authors know what can be relied on.

| Tag | Meaning |
|---|---|
| V | Verified against an official page (nextjs.org, react.dev, gsap.com, r3f.docs.pmnd.rs, MDN, the library README) fetched on 2026-10-15, or against the npm registry on the same day. |
| M | Measured by us. We installed the exact versions in an isolated scratch folder and bundled tiny entry files with esbuild (minify, tree-shaking, `NODE_ENV=production`, ESM, browser conditions), then gzipped the output. React and react-dom were marked external for the numbers labelled "excl. React". Treat these as +/- 10 percent estimates: Turbopack's tree-shaking differs from esbuild's, and the real number must be re-measured with the Turbopack Bundle Analyzer (Next 16.4) on the first real build. |
| P | Engineering practice or inference, not confirmed by an official page. Flagged so it can be tested before it is locked into the spec. |
| U | Could not be verified from a current official source. A specific action to resolve it is listed in section 12. |

No web claim here is older than the sources named. Where a source was old (browser WebGL context limits), the section says so.

## 1. Executive recommendation

### 1.1 The minimal stack

Pin exact versions (no caret) for everything in the animation and WebGL group. three is a 0.x package whose minor releases can break, R3F 9.8.x only supports React `>=19 <19.4`, and `postprocessing` (if it is ever added) only supports three `<0.187`.

| Layer | Package | Pinned version | Where it loads | gzip cost (M, excl. React) | Verdict |
|---|---|---|---|---|---|
| Framework | next | 16.4.1 (repo pins 16.4.0; patch bump is optional) | n/a | n/a | Keep |
| UI runtime | react, react-dom | 19.3.1 (repo pins 19.3.0; R3F needs React 19.3 support only if R3F is used, and that arrived in R3F 9.8.0) | n/a | n/a | Keep |
| Tween engine | gsap | 3.15.0 | Landing chunk, after hydration | 27.8 kB (core) | Adopt |
| Scroll scrubbing | gsap/ScrollTrigger | included in gsap 3.15.0 | Landing chunk | +17.7 kB | Adopt |
| Kinetic type | gsap/SplitText | included in gsap 3.15.0 | Landing chunk | +3.1 kB | Adopt |
| React binding | @gsap/react (useGSAP) | 2.1.2 | Landing chunk | +0.4 kB | Adopt |
| Smooth scroll | lenis | 1.3.26 | Landing chunk | +5.4 kB (+0.7 kB for `lenis/react`, optional) | Adopt |
| 3D engine | three | 0.186.1 (types: @types/three 0.186.0) | Lazy WebGL chunk, after idle | 133 kB for a minimal WebGLRenderer, scene, camera, mesh, ShaderMaterial, Points, InstancedMesh | Adopt |
| 3D React binding | @react-three/fiber | 9.8.2 | Lazy WebGL chunk | 250 kB total including all of three (so +117 kB over minimal vanilla three) | Approved alternative, not the default (see 1.2) |
| 3D helpers | @react-three/drei | 10.7.9 | none | ~+1 kB for `shaderMaterial` when tree-shaken, but 21 runtime dependencies to install | Reject |
| Post-processing | @react-three/postprocessing 3.2.0 + postprocessing 6.39.5 | none | +26 kB, plus a three version ceiling (`<0.187`) | Reject |
| Component animation | motion (motion/react) | none | 45 kB (full `motion`), 31 kB (`LazyMotion` + `m`), 3.3 kB (`motion/mini`) | Reject for the landing page |

Total JS added for the landing page, excluding the framework:

| Variant | Initial landing chunk (gsap + ScrollTrigger + SplitText + useGSAP + lenis, measured as one bundle) | Lazy WebGL chunk | Total |
|---|---|---|---|
| A. Vanilla three (default) | 53.9 kB gzip (M) | ~135 kB gzip (M) | ~189 kB gzip |
| B. R3F 9.8.2 core only | 53.9 kB gzip | ~252 kB gzip (M) | ~306 kB gzip |

### 1.2 The one judgment call: vanilla three or R3F

The locked decision says "Three.js / React Three Fiber", so both are in scope. Measured facts:

1. `@react-three/fiber` imports the whole `three` namespace, so tree-shaking cannot drop unused three classes. `import * as THREE` is 191 kB gzip (M); R3F core is 250 kB gzip (M); a minimal vanilla scene is 133 kB gzip (M). R3F therefore costs about 117 kB gzip more than the vanilla minimum, for a single scene.
2. The page is driven by one GSAP ticker (section 6). Both Lenis and ScrollTrigger are imperative. The scene's inputs are a few numbers (scroll progress, section index, pointer, time) written into shader uniforms. That is the case where R3F's declarative scene graph earns the least.
3. R3F earns its bytes when the scene has many independently stateful React-driven objects, event handling on 3D objects, or several people editing the scene as JSX.

Recommendation: build the centerpiece in vanilla three behind one thin Client Component (about 60 lines of React: create renderer in an effect, dispose and `forceContextLoss()` in cleanup, expose `setProgress(t)` through a ref). Keep R3F 9.8.2 as the pre-approved fallback if the spec's centerpiece turns out to need a React-style scene graph; the R3F settings the spec would then use are in section 7.3. If the spec authors choose R3F, the lazy WebGL chunk budget in section 11 moves from 140 kB to 260 kB gzip.

### 1.3 What not to add

drei, postprocessing, motion, ScrollSmoother, Locomotive Scroll, Theatre.js, `@react-spring/three`, detect-gpu, Spline, Lottie, leva. Reasons are in section 10.

## 2. Version matrix (npm registry, 2026-10-15)

| Package | `latest` | Published | Peer dependencies (from registry) | Licence |
|---|---|---|---|---|
| next | 16.4.1 | 2026-10-14 | react `^18.2.0 \|\| ^19.0.0`, optional babel-plugin-react-compiler | MIT |
| react / react-dom | 19.3.1 | n/a | none | MIT |
| three | 0.186.1 | 2026-09-24 | none | MIT |
| @types/three | 0.186.0 | n/a | none | MIT |
| @react-three/fiber | 9.8.2 (alpha line: 10.0.0-alpha.5, not for production) | 2026-10-14 | react and react-dom `>=19 <19.4`, three `>=0.156` | MIT |
| @react-three/drei | 10.7.9 | 2026-09-25 | react `^19`, @react-three/fiber `^9.0.0`, three `>=0.159` | MIT |
| @react-three/postprocessing | 3.2.0 | 2026-10-10 | postprocessing `^6.36.0`, fiber `>=9.7.0` | MIT |
| postprocessing | 6.39.5 | 2026-09-09 | three `>= 0.168.0 < 0.187.0` | Zlib |
| gsap | 3.15.0 | 2026-04-13 | none | "Standard 'no charge' license" (https://gsap.com/standard-license) |
| @gsap/react | 2.1.2 | 2025-01-15 | gsap `^3.12.5`, react `>=17` | gsap standard licence |
| lenis | 1.3.26 (a 2.0.0-dev line exists; do not use) | 2026-08-05 | react `>=17` (only for `lenis/react`), optional vue and nuxt | MIT |
| motion | 14.2.0 (same version as framer-motion; `motion` is the current name) | 2026-10-13 | react `^18 \|\| ^19` | MIT |
| detect-gpu | 5.0.70 | n/a | none | MIT |
| babel-plugin-react-compiler | 1.0.0 | n/a | none | MIT |
| eslint-plugin-react-hooks | 7.1.1 | n/a | none | MIT |
| @tailwindcss/turbopack (already in the repo) | 4.3.3 | n/a | none | MIT |

All rows: V (npm registry).

React 19 compatibility summary: all of the above work with React 19.3 (V by peer ranges). One non-obvious pairing: R3F needed a release specifically for React 19.3; the R3F release notes state 9.8.0 "adds React 19.3 compatibility" and also say R3F "does not fully support all new React 19.3 APIs" (V, github.com/pmndrs/react-three-fiber/releases). R3F bundles its own reconciler so it does not depend on React internals at install time, but pin 9.8.2 and do not float to a React 19.4 until R3F's peer range allows it.

## 3. Measured bundle sizes (M)

Method: scratch folder with the exact versions above; one tiny entry per library; esbuild `bundle + minify + treeShaking`, `NODE_ENV=production`; gzip level default; brotli measured as a second column where it matters. "Excl. React" means react, react-dom, react-dom/client and the JSX runtime were external, which is the right number because Next already ships React in its shared chunk.

| Entry (what is imported) | Minified bytes | gzip bytes | brotli bytes |
|---|---|---|---|
| gsap core only (`gsap.to`) | 70,694 | 27,770 | 25,055 |
| gsap + ScrollTrigger | 115,231 | 45,432 | 40,702 |
| gsap + SplitText | 78,161 | 30,827 | 27,807 |
| gsap + DrawSVGPlugin | 74,878 | 29,417 | 26,439 |
| gsap + MorphSVGPlugin | 91,629 | 36,716 | 33,049 |
| gsap + Flip | 95,871 | 36,552 | 32,788 |
| gsap + ScrollTrigger + ScrollSmoother | 128,435 | 50,153 | 44,824 |
| gsap + CustomEase | 77,829 | 30,950 | n/m |
| gsap + Observer | 80,150 | 31,505 | n/m |
| gsap + ScrambleTextPlugin | 82,255 | 31,333 | n/m |
| @gsap/react `useGSAP` + gsap (excl. React) | 71,774 | 28,211 | n/m |
| **gsap + ScrollTrigger + SplitText + useGSAP + lenis (one bundle, excl. React)** | 142,344 | **53,855** | n/m |
| lenis (vanilla) | 18,623 | 5,416 | 4,885 |
| `lenis/react` `ReactLenis` (excl. React) | 20,217 | 6,095 | n/m |
| three, minimal vanilla (WebGLRenderer, Scene, PerspectiveCamera, Mesh, PlaneGeometry, ShaderMaterial, Color) | 529,174 | 133,126 | 109,525 |
| three, vanilla with Points, BufferGeometry, InstancedMesh, BoxGeometry | 534,489 | 134,319 | 110,471 |
| three, `import * as THREE` (worst case) | 742,855 | 191,067 | n/m |
| React component wrapping vanilla three (excl. React) | 529,335 | 133,229 | n/m |
| @react-three/fiber core: Canvas, useFrame, useThree (excl. React) | 927,559 | 250,057 | n/m |
| R3F + drei (`shaderMaterial`, `PerformanceMonitor`, `AdaptiveDpr`) | 930,356 | 251,241 | n/m |
| R3F + @react-three/postprocessing (EffectComposer, Bloom) | 1,024,289 | 275,823 | n/m |
| motion: `motion.div` (excl. React) | 134,586 | 45,419 | n/m |
| motion: `LazyMotion` + `domAnimation` + `m.div` (excl. React) | 86,144 | 31,233 | n/m |
| motion: `animate` from `motion/mini` | 8,396 | 3,344 | 3,046 |
| motion: `animate` from `motion` | 64,563 | 24,231 | 21,956 |
| detect-gpu (code only; benchmark data is fetched at runtime, see section 10) | 6,651 | 3,252 | 2,899 |
| react-dom client render alone (for scale; already in every Next page) | 223,435 | 69,237 | 59,440 |

Notes:

- The ScrollTrigger delta over gsap core is 17.7 kB gzip; SplitText is 3.1 kB; DrawSVG is 1.6 kB; MorphSVG is 8.9 kB; Flip is 8.8 kB; ScrollSmoother is 4.7 kB on top of ScrollTrigger. SplitText is small because the 3.13 rewrite is "50% smaller" (V, gsap.com/blog/3-13).
- Fonts (V for the CDN responses we fetched, latin subset, woff2, requested 2026-10-15): Inter at 400 and 500 is one 48,256 byte file (Google serves its variable file); Inter Tight requested as `wght@400;500` is a 33,332 byte file; Inter Tight as a full variable `wght@100..900` is 44,872 bytes. Asking `next/font` for explicit weights `["400","500"]` is therefore worth testing for Inter Tight (saves roughly 11.5 kB). Confirm in the build output (P).
- Lenis ships a 513 byte stylesheet (`lenis/dist/lenis.css`) that must be imported (V from the Lenis React README and the package contents).

## 4. Next.js 16.4 findings

Source set: nextjs.org blog index and the Next.js 16.4 post (published 2026-10-06), nextjs.org docs pages for reactCompiler, lazy-loading, view-transitions, font, cacheComponents, and the two prerender error pages. All V unless tagged.

### 4.1 Version and state of the platform

- Latest is 16.4.1 (published 2026-10-14). 16.4 itself shipped on 2026-10-06 with lazy server HMR, 20 to 25 percent smaller Turbopack disk cache, a shared Turbopack runtime chunk, shorter production CSS Module class names, export mangling, and React 19.3.
- Turbopack is stable and the default bundler since Next 16.0 (blog index: "Next.js 16: Cache Components, stable Turbopack ..."). The repo already configures it (`turbopack.rules` for CSS with `@tailwindcss/turbopack`, which exists on npm at 4.3.3).
- The repo's `next.config.ts` already sets `cacheComponents: true` and `partialPrefetching: true`. Next 16.4 says Cache Components will be the default in Next 17 and recommends it for every app. This matters for the landing page; see 4.6 and 4.7.
- New in 16.4 and useful here: the Turbopack Bundle Analyzer now has a route summary and bundle diffing. Use it to enforce the budgets in section 11 (V). `experimental.turbopackLazyDynamicImports` (dev only) is optional and not needed.
- AGENTS.md in web/ says to read `node_modules/next/dist/docs/`. node_modules is not installed, so the online docs above were used instead. Everything in this section was fetched online.

### 4.2 `'use client'` boundaries

- `app/(public)/page.tsx` stays a Server Component. It renders the static, indexable content (hero copy, pricing math, FAQ) so it is in the HTML for SEO, LCP and no-JS users.
- Anything that touches `window`, `document`, `useEffect`, three, gsap, Lenis or ScrollTrigger lives in a file marked `'use client'`. Rule of thumb for the spec: one Client Component per behavior (SmoothScroll, HeroType, Stage, section scrubbers), each receiving server-rendered children, so the server HTML is never gated on a client import.
- React 19.3 lets Server Components render a context directly from a `'use client'` module, with no wrapper Provider (V, react.dev 19.3 post). Useful if a `ScrollProgressContext` is shared by sections.

### 4.3 `next/dynamic` and `ssr: false`

- Verified rule (V, nextjs.org/docs/app/guides/lazy-loading): `ssr: false` is "not supported in Server Components" and errors with "`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component." Also: "When a Server Component dynamically imports a Client Component, automatic code splitting is currently not supported."
- Therefore the pattern is a small Client Component file whose only job is the dynamic import:

```tsx
// components/landing/stage/StageLoader.tsx
'use client'
import dynamic from 'next/dynamic'
const Stage = dynamic(() => import('./Stage'), { ssr: false, loading: () => null })
export function StageLoader(props: StageProps) { return <Stage {...props} /> }
```

  The Server Component page renders `<StageLoader />`. The poster image is a plain `<img>`/CSS background in the server HTML, not the `loading` fallback.
- Gate the import on idle and tier: do not render `<StageLoader />` until a small `useStageTier()` hook has run (section 8) and the page is idle. That keeps three out of the critical path (P).
- `React.lazy` + `Suspense` is the alternative, but it prerenders by default; `next/dynamic` with `ssr: false` is simpler for a WebGL module (V on the difference).

### 4.4 React Compiler status

- Stable since 16.0 as the top-level `reactCompiler` option (V, version history on the reactCompiler page). It needs `babel-plugin-react-compiler` (1.0.0 on npm). Next applies it via an SWC pre-pass only to files that look like components or hooks, with a small build-time cost. `compilationMode: 'annotation'` opts in per component with `"use memo"`; `"use no memo"` opts a component out.
- 16.4 adds an experimental Rust compiler (`experimental.turbopackRustReactCompiler`). Do not use it for a shipped page.
- The repo does not currently enable the compiler. Recommendation: leave it off for this work. The landing page's cost is in WebGL and GSAP, not React re-renders, and the compiler is an app-wide decision. If the team enables it later, add `"use no memo"` to the WebGL and GSAP client files and expect `eslint-plugin-react-hooks` 7.x `react-hooks/immutability` to complain about writes to objects obtained from hooks (inference, tag P; the rule is documented, the three.js interaction is not).

### 4.5 `next/font`

- `next/font/google` self-hosts at build time: "No requests are sent to Google by the browser" (V).
- For variable fonts you do not need `weight`; for non-variable fonts it is required. Use an underscore for multi-word names: `Inter_Tight` (V).
- The root layout today loads Inter with `weight: "400"` only (web/app/layout.tsx line 7). The brief needs Inter at 400 and 500 and Inter Tight at 400 and 500, and `ss01` on headings. Plan: `Inter({ subsets:["latin"], variable:"--font-inter", weight:["400","500"], display:"swap" })` and `Inter_Tight({ subsets:["latin"], variable:"--font-display", weight:["400","500"], display:"swap" })`. Map them in Tailwind 4 with `@theme inline { --font-sans: var(--font-inter); --font-display: var(--font-display); }` (V, exact pattern in the docs). Whether `ss01` is present in Google's latin subset of Inter Tight is not verified (U, action in section 12).
- `adjustFontFallback` defaults to true for Google fonts, which limits layout shift (V). This matters for SplitText: split after fonts are ready or use `autoSplit` (section 5.3).
- Preload rule (V): a font called in the root layout preloads on all routes. Fonts called in a page preload only on that route. If the display face ends up landing-only, call it in the `(public)` layout.

### 4.6 Cache Components and prerender gotchas (relevant because the repo has them on)

- Client Components that read `Date.now()`, `new Date()` or `Math.random()` during render, with no Suspense boundary above them, fail prerendering (V, nextjs.org/docs/messages/next-prerender-current-time-client and next-prerender-random-client). The fix is to read them in an effect or event handler, or wrap the component in Suspense with a fallback. For the landing page: never seed particles or timing during render. Create seeds inside the WebGL effect or in `useEffect`. Use `performance.now()` for elapsed time (V, the error page itself recommends it).
- Cache Components requires the Node.js runtime (V). Not a concern; the app has no edge routes.
- `ensureStatic = 'navigation'` (new in 16.4, V) can be exported from the landing route to fail the build if a dynamic component sneaks in. Recommended for the landing page (P: it is a marketing page and should stay static).

### 4.7 Activity: effects are cleaned up when a route is hidden

- With `cacheComponents`, Next keeps recently visited routes mounted in React `<Activity mode="hidden">` instead of unmounting them. "Effects are cleaned up when a route is hidden, and recreated when it becomes visible again" (V, cacheComponents page).
- Consequences for the landing page (P, derived from the above):
  1. Lenis, `gsap.ticker` callbacks, ScrollTrigger instances, `matchMedia` listeners and the WebGL renderer must all be created inside effects and destroyed in the cleanup, and be re-creatable without leaking. `useGSAP` does the GSAP part automatically. Lenis must be `destroy()`ed in cleanup; otherwise a hidden landing page keeps smoothing scroll on `/dashboard`.
  2. Do not mount Lenis in the root layout; mount it only in the landing route's client tree so the signed-in app keeps native scroll (matches the decision that the app stays utility-only).
  3. After the route becomes visible again call `ScrollTrigger.refresh()` once fonts and layout are stable.
  4. R3F 9.8.1 notes that Activity "now works across React DOM boundaries, including an Activity wrapping the Canvas" (V), so the R3F alternative is covered. Vanilla three needs the explicit dispose and recreate path above.

### 4.8 View Transitions

- React 19.3 ships `<ViewTransition>` and `addTransitionType` as stable (V, react.dev/blog/2026/09/09/react-19-3). In Next 16.4 App Router "view transitions work with no configuration"; route navigations are Transitions, so `<ViewTransition>` animates automatically (V, nextjs.org/docs/app/guides/view-transitions). `<Link transitionTypes={['nav-forward']}>` and `useRouter().push(href, { transitionTypes })` tag direction (V). An older `viewTransition` config page returns 404, so no flag should be needed (V that the page is gone; P that no flag is required, because the guide states it).
- Browser support: transition types and `view-transition-class` need Chromium 125+ and recent Safari and Firefox; without support the app works and the transitions simply do not animate (V). The guide notes "Some animations may behave differently in Safari" (V).
- Required CSS from the guide: `::view-transition { pointer-events: none; }`, and a `@media (prefers-reduced-motion: reduce)` block that sets `animation-duration: 0s !important` on `::view-transition-old(*)`, `-new(*)` and `-group(*)` (V).
- Landing-specific cautions (P):
  - Use View Transitions only for route changes (landing to `/sign-up`, `/login`), never for in-page scroll storytelling.
  - A transition snapshots the page, including the fixed WebGL canvas. Give the canvas wrapper a `view-transition-name` and set `animation: none` on its group so the stage does not cross-fade or flash during navigation, the same technique the guide uses for the header. Test in Safari.
  - Wrapper placement: the guide says to put the `<ViewTransition>` in each `page.tsx`, not the layout, because layouts persist and enter/exit never fire there (V).

## 5. GSAP findings

### 5.1 Licence status of every plugin (V)

- GSAP 3.13 (announced at gsap.com/blog/3-13) made the whole toolset free, including commercial use, after Webflow acquired GreenSock. The bonus plugins that used to need Club GSAP moved into the public npm package `gsap`. Club GSAP was discontinued (migration deadline 2025-06-01 per the post).
- Licence page (gsap.com/standard-license), as fetched: "All of GSAP including the plugins that were formerly 'members-only' like SplitText and MorphSVG can be used in commercial projects at no charge." and "Commercial usage is covered under the standard license." The npm `license` field is "Standard 'no charge' license".
- Restrictions in the licence: you may not use GSAP in tools that let people build visual animations without code if the tool helps create a product competing with Webflow's animation builder (without Webflow's written consent); no reverse engineering to build competing products; do not remove proprietary notices; Webflow owns the IP; Webflow may terminate for breach and may update the licence (continued use counts as acceptance). None of these affects a marketing site. The FAQ also says AI-generated GSAP code is not a prohibited use.
- Important distinction: free, not open source (not MIT). Record the licence URL and the fetch date (2026-10-15) in the repo so a later licence revision is noticed. The licence says revisions apply on continued use.
- Presence in the installed package (V by directory listing of `gsap@3.15.0`): CSSPlugin, CSSRulePlugin, CustomBounce, CustomEase, CustomWiggle, Draggable, DrawSVGPlugin, EaselPlugin, EasePack, Flip, GSDevTools, InertiaPlugin, MorphSVGPlugin, MotionPathHelper, MotionPathPlugin, Observer, Physics2DPlugin, PhysicsPropsPlugin, PixiPlugin, ScrambleTextPlugin, ScrollSmoother, ScrollToPlugin, ScrollTrigger, SplitText, TextPlugin. All import from `gsap/<Name>`.

Per-plugin decision for the landing page:

| Plugin | Licence | gzip delta (M) | Decision | Why |
|---|---|---|---|---|
| ScrollTrigger | free | +17.7 kB | Use | Scrubbed timelines, pinned sections, section progress. Core of the storytelling. |
| SplitText | free | +3.1 kB | Use | Accessible kinetic type: `aria-label` on the parent, `aria-hidden` on pieces, `autoSplit`/`onSplit()` re-split on resize and font load, `mask` for line reveals (V, 3.13 post). Hand-rolling this is more code and worse accessibility. |
| useGSAP (@gsap/react) | gsap standard licence | +0.4 kB | Use | Automatic revert in the Activity and Strict Mode lifecycle, scoped selectors, `contextSafe` for handlers. |
| ScrollSmoother | free | +4.7 kB over ScrollTrigger | Do not use | Needs a wrapper/content DOM structure and translates content, replacing native scroll. Lenis keeps native scroll and costs about the same (see section 10). |
| DrawSVGPlugin | free | +1.6 kB | Optional | Only if the Kairos motif draws strokes. CSS `stroke-dashoffset` with `pathLength="1"` gives the same effect at zero bytes; prefer CSS unless a scrubbed draw is needed. |
| MorphSVGPlugin | free | +8.9 kB | Do not use | Not needed by any seed idea; revisit only if the motif morphs. |
| CustomEase | free | +3.2 kB | Optional | Only if the spec needs exact cubic-bezier curves in GSAP. Built-in `power3.out`/`expo.out` or CSS `cubic-bezier()` cover most needs. |
| Flip | free | +8.8 kB | Do not use | No shared-layout animations on the landing page; View Transitions cover route-level morphs. |
| Observer, ScrollToPlugin, Draggable, Inertia, MotionPath, Physics, Pixi, Scramble, Text, GSDevTools | free | +3 to +4 kB each where measured | Do not use | No requirement. `lenis.scrollTo` handles anchor scrolling. Scramble-style text effects conflict with the "calm, exact" tone. |

### 5.2 `@gsap/react` (useGSAP) and Next.js

- `useGSAP` is a hook that wraps `useLayoutEffect`/`useEffect` with `gsap.context()`, an empty dependency array by default, optional `{ scope, dependencies, revertOnUpdate }`, and `contextSafe` for callbacks created after setup (V, gsap-react skill and gsap.com/resources/React).
- It must be registered: `gsap.registerPlugin(useGSAP)` before use (V).
- It is client-only. GSAP and ScrollTrigger must not execute during SSR; all calls live inside `useGSAP` or `useEffect`, never at module top level of a Server Component (V).
- Always pass a `scope`, otherwise class selectors can match outside the component (V).
- ScrollTriggers belong on top-level tweens or timelines only; do not nest them inside a parent timeline; create them top to bottom or set `refreshPriority` (V, gsap-scrolltrigger skill). With a long page assembled from independent client components, give each section's ScrollTrigger a `refreshPriority` equal to its section index (P).
- Registration helper: create one `lib/gsap.ts` (`'use client'`) that registers `ScrollTrigger`, `SplitText` and `useGSAP` once and re-exports `gsap`. Registering twice is harmless (P).

### 5.3 SplitText and fonts

- SplitText 3.13 rewrote the API: `autoSplit: true` with `onSplit(self)` re-splits when fonts load or the container resizes and cleans up and resumes animations; `mask: "lines"|"words"|"chars"` wraps pieces for clipped reveals; `deepSlice` handles nested inline elements; accessibility attributes are added automatically (V, 3.13 post).
- Breaking changes versus pre-3.13 SplitText (V): `position: "absolute"` removed, class numbering is per element, `lineThreshold` removed, function-based `specialChars` removed. Any code or example found online that uses these is stale.
- With `next/font` the fallback metrics are adjusted (4.5), so first paint is close to final, but still create SplitText with `autoSplit` and run the reveal inside `onSplit` so a late font swap cannot leave a broken line (P).

### 5.4 Reduced motion with GSAP

- `gsap.matchMedia()` accepts named conditions including `(prefers-reduced-motion: reduce)`, reverts animations and ScrollTriggers created in a handler automatically when a condition flips, re-runs the handler, and supports a returned cleanup (V, gsap.com/docs/v3/GSAP/gsap.matchMedia). `gsap.matchMediaRefresh` re-runs handlers if the user toggles an in-page motion setting.
- The docs page does not describe `contextSafe` or `useGSAP` use with `matchMedia`. `matchMedia` is a wrapper around `gsap.context`, so use one or the other per component, and call `matchMedia` inside `useGSAP` so the whole thing is reverted on unmount (P).

## 6. Lenis, ScrollTrigger and the render loop on one ticker

### 6.1 What the sources say

- Lenis README (V): to sync with ScrollTrigger, call `lenis.on('scroll', ScrollTrigger.update)`, add `lenis.raf` to `gsap.ticker` with the time multiplied by 1000 (GSAP's ticker is in seconds, Lenis expects milliseconds), and call `gsap.ticker.lagSmoothing(0)` "to avoid scroll-animation delay".
- Lenis React README (V): `autoRaf` is an option, not a prop (`options={{ autoRaf: false }}`); the instance is on `ref.current.lenis`; call `lenisRef.current?.lenis?.raf(time * 1000)` inside a function registered with `gsap.ticker.add`, and remove it with `gsap.ticker.remove` in the effect cleanup. Import `lenis/dist/lenis.css`. `root` makes the instance available to `useLenis` anywhere.
- Lenis limitations list (V): no CSS scroll-snap (use `lenis/snap`); capped at 60 fps in Safari and 30 fps in low power mode; smooth scrolling does not work over iframes; `position: fixed` may lag on pre-M1 macOS Safari; `syncTouch` may misbehave on iOS below 16 (leave it at its default false); nested scroll containers need `data-lenis-prevent` or `allowNestedScroll`.
- Lenis wraps native scroll, so `position: sticky` and ScrollTrigger pinning keep working (V, README statement; pin-specific behavior not explicitly documented, so test it, P).
- Lenis reduced motion (V): `respectReducedMotion` defaults to true; smoothing is disabled and programmatic scrolls jump instantly. Lenis keeps running so WebGL and DOM sync still works, and the preference updates live. `lenis.prefersReducedMotion` exposes the state. Do not set `respectReducedMotion: false`.
- R3F hooks docs (V): `useThree().advance(timestamp: number, runGlobalEffects?: boolean)` "Advance one tick, given that `frameloop === 'never'`"; `invalidate()` "Request a new render, given that `frameloop === 'demand'`" and does not render immediately, it only requests a frame, so many calls collapse into one render (R3F scaling-performance page).
- ScrollTrigger config (V): `ScrollTrigger.config({ ignoreMobileResize: true })` stops a refresh on vertical resizes of 25 percent of the viewport height on touch-only devices (the iOS address-bar collapse), at the cost of slightly off trigger positions.

### 6.2 The architecture (P, assembled from the V pieces above)

One clock. `gsap.ticker` is the only requestAnimationFrame loop on the landing page. Order matters inside a frame:

1. Lenis updates the scroll position (`lenis.raf`).
2. ScrollTrigger reads that position and updates scrubbed timelines (driven by `lenis.on('scroll', ScrollTrigger.update)`).
3. The WebGL stage reads its inputs (progress, pointer, time) and renders if anything changed.

```ts
// lib/landing-clock.ts  ('use client' module, called from one effect)
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

export function startClock(stage: { render(timeMs: number): void; isDirty(): boolean }) {
  gsap.ticker.lagSmoothing(0)
  const lenis = new Lenis({ autoRaf: false })        // respectReducedMotion stays true
  const onScroll = () => ScrollTrigger.update()
  lenis.on('scroll', onScroll)
  const tick = (timeS: number) => {
    lenis.raf(timeS * 1000)                          // 1. scroll first
    if (stage.isDirty()) stage.render(timeS * 1000)  // 3. render only when needed
  }
  gsap.ticker.add(tick, false, true)                 // prioritize so Lenis runs before other callbacks
  return () => { gsap.ticker.remove(tick); lenis.off('scroll', onScroll); lenis.destroy() }
}
```

Notes on this sketch:
- The third argument of `gsap.ticker.add(callback, once, prioritize)` puts the callback first in the ticker's list. This is documented GSAP behavior but was not re-fetched today (P). If prioritizing is not wanted, registering Lenis before any ScrollTrigger exists achieves the same order.
- `lagSmoothing(0)` disables GSAP's catch-up after a long frame. This is what the Lenis README recommends for scroll sync. The trade-off: after a tab switch or a long task, animations jump rather than ease. For a scroll-driven page that is the correct behavior.
- If R3F is used, set `<Canvas frameloop="never">` and call `advance(timeMs)` from the same `tick`, instead of letting R3F run its own requestAnimationFrame. The unit R3F expects for `advance(timestamp)` is documented only as `number`; R3F's internal loop passes the requestAnimationFrame timestamp in milliseconds (U, confirm in a 10-line test). Do not depend on R3F's clock for uniforms; derive time from the ticker.
- `frameloop="demand"` with `invalidate()` from the ticker callback is the equivalent R3F-native approach (V for `invalidate`); either works. Use "never" plus `advance` if there is an ambient loop that must also respect the tier's frame cap, because the callback already decides whether to render.
- Dirty-flag rule (P): the stage renders when (a) scroll progress changed by more than 0.0005 of the page, (b) the pointer moved while hovering the stage, (c) a time-based ambient layer is enabled and the tier's frame interval elapsed (16.7 ms for tier 2, 33.3 ms for tier 1), or (d) a resize happened. Otherwise skip, so a page at rest costs about zero GPU.
- Pause when the stage is not visible: a ScrollTrigger `onToggle` on the section that owns the stage (or an IntersectionObserver) sets `visible=false`, and `isDirty()` returns false. Also skip when `document.hidden` (P).

### 6.3 Why not ScrollSmoother, `lenis` autoRaf, or R3F's own loop

- ScrollSmoother is free and would need no separate proxy for ScrollTrigger, but it requires a fixed wrapper with a transformed content element and replaces native scrolling (V, gsap-plugins and scrolltrigger skills; the pinType caveat is documented there). Native scroll is better for anxious users on slow phones, for find-in-page, anchors and accessibility tooling (P).
- `autoRaf: true` makes Lenis run its own requestAnimationFrame loop, which would be a second clock racing GSAP's.
- R3F's default `frameloop="always"` runs a third loop.

### 6.4 Pinning and Lenis (P)

ScrollTrigger pins with `position: fixed` plus a spacer under native scroll, which Lenis leaves intact. Keep `pinType` at its default and test on iOS Safari. If pins shake on a given browser, ScrollTrigger documents `pinType: "fixed"` or `"transform"` as the switch (V, scrollerProxy section of the gsap-scrolltrigger skill). Avoid `scrollerProxy` entirely with Lenis because Lenis scrolls the real document.

## 7. WebGL specifics

### 7.1 One persistent fixed canvas versus several canvases

Decision: one canvas, fixed to the viewport, behind the content, for the whole landing page (P, supported by V facts below).

Facts:
- Browsers cap live WebGL contexts per page and drop the oldest when the cap is exceeded, logging "Too many active WebGL contexts. Oldest context will be lost". The figures we found (the sources are 2016 to 2021 and secondary; no current official page was found): WebKit recycles at 16 active contexts; Chrome 16 per domain on desktop and 8 per domain on Android (a Mozilla bug comment citing Chromium); Firefox is far higher. Tag U for current numbers; the design must not depend on them, which a single canvas guarantees.
- Each canvas also owns its own renderer, programs, buffers and textures; nothing is shared between contexts. The spec already says exactly one centerpiece.

Design:
- A `position: fixed; inset: 0; height: 100lvh; pointer-events: none; z-index: 0` wrapper holds the canvas. Section backgrounds above it are transparent where the stage should show through. The server HTML renders a poster (an AVIF/WebP still or CSS gradient) in the same wrapper so there is no empty box before WebGL arrives; the canvas fades in on top (P).
- Use `lvh`, not `vh` or `dvh`, so the canvas does not resize when the iOS or Android address bar collapses. Resize the renderer only when the width changes or the height changes by more than 25 percent (the same threshold ScrollTrigger uses for `ignoreMobileResize`), because iOS has a history of memory growth when canvases are resized repeatedly (WebKit and Apple forum reports from iOS 14.2; reported fixed in iOS 14.3; tag V for existence of the report, U for current behavior).
- Scene state is one scalar `progress` in [0, 1] plus a few section anchors; per-section ScrollTriggers set tween targets on a shared `state` object, and the stage reads it. No per-section canvases.
- If a second WebGL surface is ever proposed, reject it. `drei <View>` (several viewports through scissor tests on one canvas) is the workaround, but it requires drei and R3F and adds complexity (P).

### 7.2 `frameloop`, rendering policy and DPR

| Setting | Recommendation | Basis |
|---|---|---|
| Loop owner | The shared `gsap.ticker` (section 6) | P |
| R3F frameloop | `"never"` with `advance()` from the ticker, or `"demand"` with `invalidate()` | V for the API semantics |
| Vanilla three | Do not call `renderer.setAnimationLoop`; call `renderer.render(scene, camera)` from the ticker when dirty | P |
| DPR | `dpr = min(devicePixelRatio, tierMaxDpr, sqrt(pixelBudget / (cssWidth * cssHeight)))` | P |
| Tier 2 (full) | `tierMaxDpr = 2`, `pixelBudget = 2.1e6` drawing-buffer pixels (about 1080p at 1x) | P |
| Tier 1 (lite) | `tierMaxDpr = 1`, `pixelBudget = 1.0e6`, 30 fps cap | P |
| `antialias` | `false`; do edge smoothing in the shader or with a higher DPR on small canvases | P (MDN lists fill-rate as the mobile bottleneck and recommends a smaller back buffer, V) |
| `powerPreference` | `"high-performance"` is R3F's default (V). For a decorative canvas prefer `"default"` so laptops stay on the integrated GPU (P) | |
| `alpha` | `true` only if the stage must composite over page backgrounds; otherwise paint the page background colour into the canvas. MDN notes `alpha: false` "can be expensive on some platforms" (V), so test both | |
| `preserveDrawingBuffer` | `false` | P (standard; MDN best-practices page does not discuss it, V) |
| Shadow maps, MSAA render targets, float render targets | Not used. MDN warns many mobile GPUs cannot render to RGBA32F (V). | |

Back-buffer sizing: MDN recommends rendering into a smaller back buffer and upscaling as the first quality/speed lever and warns that `canvas.width = width * devicePixelRatio` "will cause moire artifacts with non-integer values of devicePixelRatio" (V). So when the formula yields a fractional DPR on a canvas with fine lines, round to 0.25 steps (P).

Adaptive step-down at runtime: R3F offers `PerformanceMonitor` and `performance.regress` (V), but they live in drei and R3F's state. A 30-line custom sampler is enough in either variant (section 8).

### 7.3 If R3F is chosen (settings the spec would use)

```tsx
<Canvas
  frameloop="never"
  dpr={[1, tier.maxDpr]}                 // R3F default is [1, 2]; V
  gl={{ antialias: false, alpha: true, powerPreference: 'default', stencil: false, depth: true }}
  flat                                    // NoToneMapping; V (flat prop)
  fallback={<Poster />}                   // shown when WebGL is unsupported; V
  eventSource={undefined}                 // canvas is pointer-events none; read pointer from window instead
  resize={{ scroll: false, debounce: { scroll: 0, resize: 100 } }}
>
```

- `resize.scroll: false` matters: R3F's default `resize` options include `scroll: true` with a 50 ms debounce (V), which re-measures on scroll. A fixed canvas never moves.
- R3F 9.8.1 disposes renderers when a Canvas unmounts in more cases and does not reset runtime settings on re-render (V, release notes).
- Peer pairing: `react >=19 <19.4`. With React 19.3.1 this resolves.

### 7.4 iOS Safari and low-memory Android: known limits

What the sources support (V where the page is cited, otherwise P):

| Risk | Evidence | Mitigation |
|---|---|---|
| Context loss when the tab is backgrounded | WebKit bug 261331 (iPadOS 17 beta regression; "context lost" after returning to Safari); three.js forum advises listening to `webglcontextlost` and `webglcontextrestored` and recreating GPU resources; a Unity thread reports it fixed in iOS 17.1. Present-day behavior on iOS 18 and later was not found (U). | Add `webglcontextlost` listener (call `preventDefault()` so restore can fire). On loss: stop rendering, show the poster. On restore: rebuild once, otherwise stay on the poster. Never reload the page. |
| Canvas memory cap | An old WebKit bug logs a total-canvas-memory warning at 384 MB on iOS 12 (V that the bug exists). A commonly quoted iOS limit of about 4096 by 4096 canvas pixels (16.7 MP) was not found in a source (U). | Pixel budget in 7.2 keeps the drawing buffer at 2.1 MP or less, far from either figure. |
| Memory growth on repeated canvas resize | Apple Developer Forums report on iOS 14.2 (fixed in 14.3, per the reporter). | `lvh` sizing and the 25 percent resize threshold (7.1). |
| Active context cap | WebKit 16 (2016 change), Chrome Android 8 per domain (secondary sources, U for today). | One canvas only. |
| Address-bar collapse changes the viewport height during scroll | ScrollTrigger refresh jumps; documented option `ignoreMobileResize` (V). | `ScrollTrigger.config({ ignoreMobileResize: true })`, `lvh`. |
| Low Power Mode and Safari frame caps | Lenis README: capped at 60 fps in Safari, 30 fps in low power mode (V). | The frame-time sampler (section 8.3) steps down a tier; do not assume 60 fps. |
| Programmatic scroll on iOS | Lenis `syncTouch` may misbehave below iOS 16 (V). | Leave `syncTouch` false. Touch devices keep native momentum scrolling, which ScrollTrigger reads directly. |
| Shader precision and fill rate | MDN: do work in the vertex shader where possible; `mediump` can corrupt rendering on some mobile hardware; avoid RGB8 textures; compressed textures save bandwidth (V). | Fragment shader in `highp` unless tested per device; no float render targets; textures at most 2048 px on a side and RGBA; one or two textures total. |
| Shader compile jank on first frame | MDN: use `KHR_parallel_shader_compile`, compile all then link all, avoid querying `COMPILE_STATUS` unless linking fails, avoid `getError` (V). | three already uses parallel compile where present; call `renderer.compileAsync(scene, camera)` before fading the canvas in (P). |
| Low-memory Android | No authoritative per-device numbers found (U). Chrome Android is documented in secondary sources as 8 contexts per domain. | Tier detection (section 8) sends devices with `deviceMemory <= 2`, or 4 cores or fewer on a coarse pointer, to tier 1; `failIfMajorPerformanceCaveat` sends software-rendered contexts to tier 0. |

## 8. Device capability detection without heavy libraries

### 8.1 What each signal is worth

| Signal | Availability | Use |
|---|---|---|
| `matchMedia('(prefers-reduced-motion: reduce)')` | All current browsers (V, MDN/GSAP docs) | Tier 0 for the WebGL and for all scroll-linked motion. Mandatory. |
| `navigator.connection.saveData` / `effectiveType` | Chromium only (P; MDN page not fetched) | If `saveData` is true, tier 0. Otherwise ignore. |
| `navigator.deviceMemory` | Chromium only; secure context only; coarsened to powers of two within implementation limits (V, MDN: marked not Baseline; Safari and Firefox not supported, from general knowledge since the MDN table was collapsed) | A hint. `<= 2` means tier 1. Absence means unknown, never "low". |
| `navigator.hardwareConcurrency` | Broadly available, may be capped or rounded by privacy features (P) | With `(pointer: coarse)` and `<= 4`, treat as tier 1 candidate. |
| `matchMedia('(pointer: coarse)')`, `(hover: none)` | All current browsers (P) | Disable pointer-parallax; reduce effects on touch. |
| WebGL probe: `canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true, powerPreference: 'low-power' })` | Standard context attribute; MDN best-practices page does not discuss it (V that it is silent), spec behavior known (P) | Returns `null` when the browser would fall back to a software renderer. `null` means tier 0. Release the probe context immediately with `getExtension('WEBGL_lose_context')?.loseContext()` (V: MDN advises eager loss when done). |
| `gl.getParameter(gl.MAX_TEXTURE_SIZE)` and `MAX_VERTEX_TEXTURE_IMAGE_UNITS` | WebGL standard (P) | `< 4096` means tier 1. |
| `WEBGL_debug_renderer_info` | Browsers increasingly mask or restrict it (P) | Do not rely on it. |
| Runtime frame-time sampling | Always available | The best signal; see 8.3. |

### 8.2 Tiers

| Tier | Who | Behavior |
|---|---|---|
| 0 Static | Reduced motion, `saveData`, no WebGL2, `failIfMajorPerformanceCaveat` failure, context lost twice, or sampler found the device unusable | No WebGL chunk is downloaded. Poster image in the stage wrapper. Content is complete and readable. CSS-only reveals; kinetic type renders final text with no animation. Lenis smoothing off (it does this itself under reduced motion). |
| 1 Lite | `deviceMemory <= 2`, or 4 cores or fewer with a coarse pointer, or `MAX_TEXTURE_SIZE < 4096`, or sampler median above 24 ms | WebGL with DPR 1, 1.0 MP budget, 30 fps cap, scroll-driven only (no ambient loop), reduced instance count. |
| 2 Full | Everything else | DPR up to 2 within the 2.1 MP budget, ambient loop allowed, 60 fps cap. |

### 8.3 Runtime sampler (P, about 30 lines, replaces detect-gpu and PerformanceMonitor)

- After the first render, collect frame deltas for the first 45 rendered frames. If the median is above 24 ms, step down one tier. If, at tier 1, the median of the next 45 frames is above 34 ms, or three step-downs happen in one session, switch to tier 0: unmount the stage, free the renderer, show the poster.
- Step-up is not attempted within a session (prevents oscillation, the problem R3F's `PerformanceMonitor` solves with bounds).
- Run the tier probe in `requestIdleCallback` (fall back to `setTimeout 200`) after load, never in the render path. Persist the final tier in `sessionStorage` (wrapped in try/catch) so a reload does not repeat the probe (P).
- The reduced-motion preference changes live (Lenis already follows it, V). Subscribe to the `change` event on the media query and drop to tier 0 immediately.

### 8.4 Why not detect-gpu

detect-gpu 5.0.70 is 3.3 kB gzip of code, but by default it downloads GPU benchmark JSON from `https://unpkg.com/detect-gpu@5.0.70/dist/benchmarks` at runtime (verified in the shipped bundle via the `benchmarksURL` default). That adds a third-party request to a page whose promise is accountability, needs a `connect-src` entry if a CSP is added, and can be self-hosted only by copying 713 kB of data into `public/` (M, size on disk). The sampler above gives a better signal for this page's actual workload and costs nothing (P).

## 9. Motion library (motion/react)

- `motion` 14.2.0 is the current package name (the Motion docs MCP server says `framer-motion` is the former name and `motion/react` is the React entry). React 18 and 19 are supported (V, peer range).
- Measured: `motion.div` 45.4 kB gzip excl. React; `LazyMotion` with `domAnimation` and `m` 31.2 kB; `animate` from `motion/mini` 3.3 kB; `animate` from `motion` 24.2 kB (M).
- Decision: do not add it for the landing page. GSAP already covers sequenced, scrubbed and kinetic animation; CSS covers hover and focus transitions; React `<ViewTransition>` covers route-level and Suspense-reveal transitions (V, section 4.8). Having two tween engines on one page doubles the places where reduced motion and cleanup must be handled.
- If the signed-in app later needs layout or gesture animation (utility-only motion), that is a separate decision there. If any small imperative animation is ever needed outside GSAP's scope, `motion/mini`'s `animate` at 3.3 kB is the cheapest option (M).

## 10. Rejected libraries and why

| Library | Cost or issue | Verdict |
|---|---|---|
| @react-three/drei 10.7.9 | 21 runtime dependencies installed (including hls.js, @mediapipe/tasks-vision, troika-three-text, three-stdlib, camera-controls, three-mesh-bvh, stats-gl); `sideEffects: false` and tree-shaking keep what you import small (measured +1 kB for `shaderMaterial`, `PerformanceMonitor`, `AdaptiveDpr`), but the install surface and the temptation to import heavy helpers (`Environment`, `Text`, `useGLTF`) is the cost. Its peer range ties to R3F 9 and three `>=0.159`. | Reject. A `shaderMaterial` equivalent is about 15 lines in the project. If one helper is truly needed later, import it from its subpath and re-measure. |
| @react-three/postprocessing + postprocessing | +26 kB gzip (M) and every extra full-screen pass multiplies fill-rate on phones (MDN: fill-rate is the mobile bottleneck, V). `postprocessing` 6.39.5 peers on three `<0.187`, which blocks upgrading three past 0.186.x until that library updates (V). | Reject. Put any grain, vignette or tone adjustment into the single fragment shader of the stage. |
| motion / framer-motion | 31 to 45 kB gzip (M) duplicating GSAP and CSS. | Reject for the landing page. |
| GSAP ScrollSmoother | Requires a wrapper/content structure and replaces native scroll (V). | Reject in favor of Lenis. |
| Locomotive Scroll, `@studio-freight/lenis` | Older and heavier alternatives or the former package name of Lenis. | Reject. Current package is `lenis`. |
| GSAP MorphSVG, Flip, DrawSVG, CustomEase, Observer, Scramble | See the plugin table in 5.1. | Not needed; DrawSVG and CustomEase are optional pending the motif spec. |
| detect-gpu | Runtime fetch from unpkg (section 8.4). | Reject. |
| Theatre.js, `@react-spring/three`, leva, r3f-perf | Larger surface, a second timeline model, or dev-only tools. | Reject. Use `Stats` from three/addons in development only if needed, behind a dev flag. |
| Spline, Lottie, rive | Third-party runtimes and opaque assets; large; conflict with the "exactly one WebGL centerpiece" decision and with truthful, inspectable motion. | Reject. |
| React Compiler (for this milestone) | App-wide, little benefit for imperative code (section 4.4). | Leave off. |
| `@react-three/fiber` 10 alpha | `10.0.0-alpha.5` is experimental and WebGPU-oriented (V release notes). | Reject. |
| three WebGPURenderer | Experimental in the version we checked (the three skill describes it as an alternative with TSL, WebGL remains the default). | Reject. Use WebGLRenderer for broad iOS and Android coverage. |

## 11. Budgets recommended for the spec

All figures gzip, measured after Turbopack build with the Bundle Analyzer (Next 16.4). These are recommendations (P).

| Budget | Value | Rationale |
|---|---|---|
| Landing route initial JS excluding framework (gsap + ScrollTrigger + SplitText + useGSAP + lenis + site code) | 70 kB or less | Measured library total is 53.9 kB, leaving about 16 kB for site code. |
| Lazy WebGL chunk, vanilla three | 140 kB or less | Measured 133 to 135 kB for the minimal set. |
| Lazy WebGL chunk, R3F variant | 260 kB or less | Measured 250 to 252 kB. |
| Fonts | 2 files, about 33 kB (Inter Tight 400/500) plus about 48 kB (Inter 400/500) in woff2 | Measured from Google CDN. Preload only the face used above the fold (hero display face). |
| WebGL chunk start | After `load` and idle, with a 2 s timeout; never before LCP | Keeps the hero text and poster as the LCP element. |
| Drawing buffer | 2.1 MP (tier 2), 1.0 MP (tier 1) | Section 7.2. |
| Frame cap | 60 fps tier 2, 30 fps tier 1, 0 fps at rest (dirty flag) | Section 6.2. |

## 12. Open verification items (do these on the first implementation spike)

| # | Item | How to resolve | Tag |
|---|---|---|---|
| 1 | Real Turbopack sizes for the three variants | `next build` with the Turbopack Bundle Analyzer; compare with section 3 | M to V |
| 2 | R3F `advance()` timestamp unit | 10-line test; log `state.clock.elapsedTime` for `advance(1000)` | U |
| 3 | `ss01` available in Google's latin Inter Tight subset; static 400/500 request returns the expected 33 kB file under `next/font` | Build, inspect `.next/static/media`, check the feature in DevTools | U |
| 4 | ScrollTrigger pin behavior with Lenis on iOS Safari 17 and 18 and Android Chrome | Test page with one pinned section; try `pinType: "fixed"` if it jitters | P |
| 5 | View Transition snapshot of the fixed WebGL wrapper in Safari and Chrome | Navigate landing to `/sign-up` with and without `view-transition-name` on the stage wrapper | P |
| 6 | Context loss and restore behavior on current iOS | Background and foreground Safari on a real device; confirm poster fallback and optional restore | U |
| 7 | `failIfMajorPerformanceCaveat` returning `null` on a software-rendered setup | Chrome with `--disable-gpu` and Firefox with software WebGL | P |
| 8 | `eslint-plugin-react-hooks` 7.x immutability rule on three objects (only if the Compiler is ever enabled) | Enable the rule locally on the stage files | P |
| 9 | One copy of three in the workspace | `npm ls three` shows a single version; the monorepo uses workspaces (`@auto-career/shared` is `"*"`), and a second copy produces the console warning "Multiple instances of Three.js being imported" (P) | P |
| 10 | GSAP licence snapshot | Save the licence page text and date in the repo; recheck at each GSAP upgrade | V |

## 13. Install and configuration changes the implementation will need

```
npm i gsap@3.15.0 @gsap/react@2.1.2 lenis@1.3.26 three@0.186.1 --save-exact
npm i -D @types/three@0.186.0 --save-exact
# R3F alternative only:
# npm i @react-three/fiber@9.8.2 --save-exact
```

- `next.config.ts`: no change is required for any of these packages (they ship ESM; `transpilePackages` is not needed). Add `export const ensureStatic = 'navigation'` to the landing route (4.6). If the app-wide React Compiler decision is made later, see 4.4.
- CSS: import `lenis/dist/lenis.css` from the client component that creates Lenis (it is 513 bytes). It sets `html.lenis, html.lenis body { height: auto }` and the stopped, prevent and iframe rules. Add the View Transition reduced-motion block and `::view-transition { pointer-events: none }` to the global CSS when View Transitions are used (V).
- Shader sources: keep GLSL as template-literal exports in `.ts` files. This needs no loader configuration under Turbopack, and the repo already customizes `turbopack.rules` only for CSS (P).
- `app/layout.tsx`: replace the single-weight Inter with the Inter and Inter Tight setup in 4.5.
- Tests worth keeping from this work (ponytail rule: one runnable check, not a suite): a Playwright check that, with `prefers-reduced-motion: reduce`, no canvas element is present in the DOM and all landing text is readable; and with WebGL disabled the poster renders. These are the two guarantees the decision makes mandatory.

## 14. Source list

Official docs and registry pages fetched on 2026-10-15:

- nextjs.org: blog index; /blog/next-16-4; /docs/app/guides/lazy-loading; /docs/app/guides/view-transitions; /docs/app/api-reference/components/font; /docs/app/api-reference/config/next-config-js/reactCompiler; /docs/app/api-reference/config/next-config-js/cacheComponents; /docs/messages/next-prerender-current-time-client; /docs/messages/next-prerender-random-client
- react.dev: /blog/2026/09/09/react-19-3
- gsap.com: /standard-license; /blog/3-13; /docs/v3/Plugins/ScrollTrigger/static.config(); /docs/v3/GSAP/gsap.matchMedia()
- github.com: pmndrs/react-three-fiber releases; darkroomengineering/lenis README and packages/react/README.md
- r3f.docs.pmnd.rs: /api/canvas; /api/hooks; /advanced/scaling-performance
- developer.mozilla.org: Navigator.deviceMemory; WebGL best practices
- registry.npmjs.org: next, react, three, @types/three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, postprocessing, gsap, @gsap/react, lenis, motion, framer-motion, detect-gpu, babel-plugin-react-compiler, eslint-plugin-react-hooks, @tailwindcss/turbopack
- WebKit bugzilla 261331, 195325; Apple Developer Forums thread 668999; three.js forum "Context Lost when backgrounding Safari on iOS 17"; WebKit layout tests for max active contexts; Mozilla bugzilla 1748592 (secondary sources for WebGL context limits, dated 2016 to 2021)
- Skills consulted for guidance only: gsap-react, gsap-scrolltrigger, threejs-fundamentals, nextjs-best-practices (all four loaded successfully)
