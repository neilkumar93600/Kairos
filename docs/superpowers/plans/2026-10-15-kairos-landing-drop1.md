# Kairos Landing, Drop 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a viewable `/` landing page (dark ledger theme, all 14 sections with final copy, interactive demos, CSS motion, DOM receipt lane) so the owner can preview it on `localhost:3000` and give feedback.

**Architecture:** Next.js 16 App Router. `/` moves to a `(landing)` route group whose `LandingShell` scopes landing styles under `.lp`. Entries are Server Components fed by `web/content/landing-copy.ts`; behaviour lives in small client islands reading two `useSyncExternalStore` stores (`ledgerStore`, `envStore`). Drop 1 is the spec's build phases 0 to 2 (prerequisites, static page, islands and CSS motion). Drop 2 (after owner feedback) adds the GSAP/Lenis motion chunk, the WebGL receipt slip, the audit and hardening.

**Tech Stack:** Next.js 16.4.0, React 19.3.0, TypeScript 5.9, Tailwind CSS 4, Vitest 5.0.4 (web unit tests). No new runtime dependencies in Drop 1 (gsap, lenis and three arrive in Drop 2).

**Spec:** `docs/superpowers/specs/2026-10-15-kairos-landing-design/` — `README.md` (master), `01-creative-direction.md`, `02-design-system.md` (DS), `03-motion-system.md` (MS), `04-webgl-scene.md`, `05-architecture.md` (ARCH; file tree in 1.1, interfaces in 14), `06-copy-deck.md` (COPY), `sections/01..14-*.md`.

## Global Constraints

- Next.js 16 has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (`web/AGENTS.md`).
- Owner decisions applied as the README recommends: vanilla three later (Drop 2), `(landing)` route group, lime custody with a Phosphor White landing logo, DOM poster (no raster poster), `plans.ts` string fixes (README R6), gated "(in beta)" wording and no "No card" claim until the owner confirms (G3, G4), page length accepted.
- Copy comes only from `landingCopy` (verbatim from COPY). No em dashes. No testimonials, user counts, logos, ratings or outcome numbers. Every demo carries a SAMPLE chip, a dashed edge and synthetic names.
- Lime Pulse `#7fee64` is a fill, never text, and at most one lime element is visible per viewport (custody on `html[data-lime-owner]`).
- Font weights 400 and 500 only; numerals `tabular-nums slashed-zero`; body text left-aligned.
- Landing CSS is scoped under `.lp` or `html[data-*] .lp`. Landing code lives only in `web/components/landing/`, `web/lib/landing/`, `web/lib/motion/`, `web/content/` (ARCH 1.4).
- Server Components by default; islands receive copy as props. Stateful modules are imported only by Client Components.
- Readable at frame zero and without JavaScript. Under reduced motion every duration token is `0.01ms`.
- WCAG 2.2 AA contrast; focus is a 2px Phosphor White outline (Void on mint); touch targets 44px.
- Do not change the signed-in app beyond what the P2 token migration requires.

## Review Focus

1. JavaScript disabled: every entry, the receipt and the FAQ are readable and usable (native `<details>`), nothing is stuck invisible.
2. Reduced motion (OS setting or footer Motion control): every element in its final state, no transitions beyond 300ms colour.
3. 360px wide phone: no horizontal scroll; hero CTA bottom above 667px at 375 by 667.
4. Two lime fills on screen at once during a custody hand-over or after approval.
5. `sessionStorage` or `localStorage` unavailable (private mode, blocked storage): stores fall back to defaults without throwing.

Each line is pinned in the task that owns the code (T4 for 5, T6 for 4, T21 for 1 to 3).

---

## Wave 1: foundation (parallel; each task owns only its files)

### Task 1: P2 token migration and root layout

**Files:** Modify `web/app/globals.css`, `web/app/layout.tsx`, `web/components/shared/button.tsx`, `web/components/shared/logo.tsx`, `web/components/shared/pricing-plans.tsx`, `web/components/shared/faq-list.tsx`. Create `web/lib/motion/preference.ts`, `web/lib/motion/tokens.ts`.
**Spec:** DS 1 (token block, alias map), DS 11.5 (fonts), ARCH 2.7, ARCH 7, ARCH 8, MS 2.6 (tokens), MS 7.4 (head script).
**Produces:** dark `:root` + `@theme inline` tokens; `--font-inter`, `--font-inter-tight`; `MOTION_STORAGE_KEY`, `MOTION_HEAD_SCRIPT`, `getEffectiveMotion`, `setMotion`, `subscribeMotion`, `completeAll`; `DUR`, `EASE`, `EASE_CSS`, `STAGGER`, `DIST`; `INTERVAL_LABEL`, `PER` exported from pricing-plans; `Faq.a: ReactNode`.
- [ ] Apply the DS token block with the alias map so every existing page still compiles and renders dark.
- [ ] Root layout: Inter + Inter Tight via `next/font`, `data-lime-owner="hero"`, `suppressHydrationWarning`, inline `MOTION_HEAD_SCRIPT`.
- [ ] Head script reads `localStorage` inside try/catch (Review Focus 5).
- [ ] Check: `npx tsc --noEmit -p web/tsconfig.json` shows no errors in these files; `/pricing` and `/dashboard` still render.

### Task 2: Landing route, shell, CSS system, marks, entry shell, stubs

**Files:** Create `web/app/(landing)/layout.tsx`, `web/app/(landing)/page.tsx`, `web/components/landing/landing-shell.tsx`, `json-ld.tsx`, `landing.css`, `motion.css`, `marks/*.tsx` (entry-rule, posting-square, chip, sample-frame, perforation, stamp, receipt-paper), `entries/entry.tsx`, and a compiling stub for every entry, the colophon and every Drop 1 island named in ARCH 1.1. Delete `web/app/(public)/page.tsx`, `web/components/landing/{hero,match-preview,proof-points,comparison,landing-faq}.tsx`, the `.animate-rise` keyframe.
**Spec:** ARCH 1, 2 (2.3 section DOM contract, 2.6 page shape), DS 1.4, 2 to 8, MS 3.6 (CSS presets), CD marks M1 to M10.
**Produces:** `.lp` scope, `lp-*` classes, lane and grid classes, custody CSS, CSS presets; `<Entry>` shell props; `ReceiptPaper`; every stub at its final path and export name so Wave 2 replaces bodies only.
- [ ] Stubs render the server-side static content placeholder `null` or a minimal `<section>` with the correct `id`, `data-section`, `data-entry`, `data-scene`, `aria-labelledby`.
- [ ] Check: `/` renders the shell and navbar with no runtime error; tsc clean for these files.

### Task 3: Landing copy and claims register

**Files:** Create `web/content/landing-copy.ts`, `web/content/claims.ts`.
**Spec:** COPY (all sections; section 0 for key structure), CD 10.6 (claims).
**Produces:** `landingCopy` typed `as const`, keyed by section id plus `meta`, `shared`, `scene` (with `scene.lines` keyed by `PrintLineId`); `claims`.
- [ ] Transcribe verbatim; keep source brackets out of rendered strings but keep them as comments.
- [ ] Check: grep the file for the em dash character returns nothing.

### Task 4: Landing library, stores and unit tests

**Files:** Create `web/lib/landing/{sections,format,calculator,ledger-store,env-store,scene-input}.ts`, `web/vitest.config.ts`, `web/test/{calculator,format,ledger-store}.test.ts`; modify `web/package.json` (script `"test": "vitest run"`).
**Spec:** ARCH 4.3 (store contracts), ARCH 14.3, section 10 billing spec (calculator), COPY runtime templates.
**Produces:** `ENTRIES`, `EntryId`, `SceneStateId`; `formatStamp`, `formatUsd`, `formatPerApp`; `computeReceipt`; `ledgerStore`, `useLedger`, `LedgerState`, `PrintLineId`; `envStore`, `useEnv`, `EnvState`, `Tier`, `MotionMode`; `sceneInput`.
- [ ] Write failing tests first: failed submissions cost 0 credits; weekly grants `ceil(n*7/30)`; `approve()` first call wins; `post("03")` posts 00 to 02; storage that throws leaves defaults (Review Focus 5).
- [ ] Implement; check `npm test -w @auto-career/web` passes.

### Task 5: Prerequisites P1 and P3

**Files:** Modify `shared/src/plans.ts` (add `creditsPerInvoice(planId, interval)`, README R6 string fixes), `server/src/services/stripe.ts` (use it). Create `server/scripts/build-landing-fit-sample.ts`, `web/content/fit-sample.json` (generated), `server/test/landing-fit-sample.test.ts`.
**Spec:** ARCH 7.3, ARCH 10.4, README R6, section 05 fit-gate spec (sample run data shape), CD grafts (48 seeded synthetic postings, 18 control combinations).
- [ ] Failing test: drift test regenerates the sample in memory and compares it with the committed JSON.
- [ ] Implement generator using the real `passesHardFilters` from `server/src/services/fit.ts`; run it to write the JSON.
- [ ] Check: `npm test -w @auto-career/server` and `npm test -w @auto-career/shared` (if present) pass; existing billing test still green.

### Task 6: Core islands

**Files:** Create `web/components/landing/islands/{motion-preference,entry-poster,lime-custody}.tsx`.
**Spec:** ARCH 4.6 (posting), ARCH 5.4 (custody wiring), DS 5.3 and L1 to L10, MS 5.7, MS 7.1.
- [ ] Custody: sequential 150ms release then 150ms fill; never two owners; Approve dropped once approved (Review Focus 4).
- [ ] Check: tsc clean for these files.

## Wave 2: sections (parallel; each task owns only its files; reads its own section spec)

| Task | Section spec | Files owned | Model tier |
| --- | --- | --- | --- |
| 7 | `sections/01-navbar.md` | `web/components/layout/navbar.tsx`, `islands/entry-caption.tsx`, `islands/motion-toggle.tsx`, the Navbar line in `landing-shell.tsx` | utility |
| 8 | `sections/02-ledger-rail.md` | `islands/ledger-rail.tsx`, `islands/receipt-tape.tsx` | utility |
| 9 | `sections/03-entry-00-hero.md` | `entries/entry-00-hero.tsx`, `islands/lane-receipt.tsx` | signature |
| 10 | `sections/04-entry-01-reported.md` | `entries/entry-01-reported.tsx`, `islands/settle-cell.tsx` | standard |
| 11 | `sections/05-entry-02-fit-gate.md` | `entries/entry-02-fit-gate.tsx`, `islands/sample-run.tsx` | signature |
| 12 | `sections/06-entry-03-truth-lock.md` | `entries/entry-03-truth-lock.tsx`, `islands/citation-demo.tsx` | standard |
| 13 | `sections/07-entry-04-approve.md` | `entries/entry-04-approve.tsx`, `islands/approve-sample.tsx` | signature |
| 14 | `sections/08-entry-05-send-receipt.md` | `entries/entry-05-send-receipt.tsx`, `islands/receipt-slot.tsx` | signature |
| 15 | `sections/09-entry-06-replies.md` | `entries/entry-06-replies.tsx` | standard |
| 16 | `sections/10-entry-07-billing.md` | `entries/entry-07-billing.tsx`, `islands/billing-plans.tsx`, `islands/odometer.tsx` | standard |
| 17 | `sections/11-entry-08-compare.md` | `entries/entry-08-compare.tsx` | utility |
| 18 | `sections/12-entry-09-questions.md` | `entries/entry-09-questions.tsx` | utility |
| 19 | `sections/13-entry-10-start.md`, `sections/14-footer.md` | `entries/entry-10-start.tsx`, `islands/approved-line.tsx`, `entries/colophon.tsx`, `islands/footer-clock.tsx` | standard |

Each section task:
- [ ] Implement sections 2 to 4, 7 and 8 of its spec (content, layout at every breakpoint, visual design, reduced-motion and no-JS variants, accessibility) and the CSS-engine parts of section 6. GSAP-engine motion, the pinned GSAP stage and the WebGL scene states are Drop 2: keep their DOM hooks (`data-*` attributes from ARCH 14.2) in place.
- [ ] Check: tsc clean for its files; its section renders at `/` with no console error.

## Wave 3: integration and verification (sequential)

### Task 20: Integrate
- [ ] Apply every cross-file request from Waves 1 and 2; `npm run typecheck -w @auto-career/web`, `npm run lint -w @auto-career/web`, `npm test -w @auto-career/web`, `npm test -w @auto-career/server` all green; `/`, `/pricing`, `/how-it-works`, `/dashboard` render without errors.

### Task 21: Visual and behaviour QA
- [ ] Screenshot `/` at 1440 by 900, 1024 by 768 and 390 by 844; compare each section with its spec's layout and visual sections; fix deviations.
- [ ] Check Review Focus 1 to 4 in the browser (JavaScript disabled, reduced motion, 360px, lime count per viewport) and fix failures.

### Task 22: Owner preview hand-off
- [ ] Final screenshots per section for the owner; list what is Drop 2.
