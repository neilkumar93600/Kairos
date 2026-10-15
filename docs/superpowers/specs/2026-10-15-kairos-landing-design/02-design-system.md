# Kairos landing page: design system

Date: 2026-10-15. Status: final specification. Owner: design system. Companion to `01-creative-direction.md` (The Ledger). Sister documents: `03-motion-system.md`, `04-webgl-scene.md`, `05-architecture.md`, `06-copy-deck.md`.

This document defines every visual rule the landing page needs on top of `docs/04-ui-ux-brief.md`. It does not change copy (06), motion timing (03), the WebGL scene (04) or file architecture (05). Where it needs a decision from those documents it says so in section 12.

Contents:

1. Token architecture: the new `globals.css`, legacy aliases, landing-only tokens
2. Font loading
3. Type scale
4. Layout grid, section rhythm and spacing
5. Surfaces, borders, the one-lime checklist, the Mint Frost band
6. Kairos Marks as concrete visual rules, with do and don't
7. Product UI on the landing
8. Iconography and imagery
9. Contrast table
10. Brief amendments, ready to paste
11. Names other documents must use
12. Open questions and risks

Conventions. "Brief" means `docs/04-ui-ux-brief.md`. "Creative" means `01-creative-direction.md`. Hex values are from the brief unless marked derived. Every contrast ratio in section 9 was computed with the WCAG 2.2 relative luminance formula (script run on 2026-10-15), not copied from the brief. Pixel values assume a 16px root. Where the Creative already pins a token name or value, this document keeps it exactly and says so.

---

## 0. Decisions in one table

| # | Question | Decision |
| --- | --- | --- |
| 1 | App-wide tokens | `:root` and `@theme inline` in `web/app/globals.css` are replaced with the brief's dark phosphor tokens (section 1.2). `color-scheme: dark`. Light tokens are deleted. |
| 2 | Legacy utility names | The 14 existing token utilities keep working through a documented alias block (1.3) so the 56 files render dark with no component edits in the first commit. A codemod then removes the two aliases that changed meaning (`text-muted`, `text-subtle`). |
| 3 | Landing-only tokens | Names pinned by the Creative (`--type-display-landing`, `--ease-post`, `--receipt-paper` and so on) stay unchanged. They are declared only inside the scope class `.lp`, never on `:root`, never in `@theme`. Outside `.lp` they resolve to nothing, so the app cannot use them by accident. A CI grep blocks references outside landing files (1.5). New tokens added by this document use the `--lp-` prefix. |
| 4 | Fonts | `Inter_Tight` (400, 500) for h1 and h2 and landing display, `Inter` (400, 500) for UI and body, both loaded and preloaded in the root layout. `ss01` on Inter Tight headings, `cv11` on Inter, `tnum` and `zero` on all landing numerals. |
| 5 | Type | Three fluid steps (display, heading, numeral) from the Creative plus fixed steps for everything else. Weights never above 500. |
| 6 | Grid | 4 columns below 640, 8 from 640, 12 from 1024. Container 1280. Gutter 16 / 24 / 32. Section padding 80 / 96 / 128. |
| 7 | Mint Frost | Used. One band: entry 05. Also the receipt paper everywhere the receipt appears. |
| 8 | Lime | One element per viewport, enforced by the custody controller, a CSS rule set and a Playwright check (5.3). The custody buttons keep one pill shape in both states so the hand-over never morphs a shape (new amendment A19). |
| 9 | Product UI | Live DOM replicas built from the shared primitives and tokens, every one labelled SAMPLE. No screenshots on the landing. Screenshots remain required only where an image claims to be the real app (Chrome Web Store, press kit). |
| 10 | Icons | Phosphor Regular, 16 / 20 / 24px, used for the menu button, close and nothing decorative. The posting square replaces check marks. No emoji. |
| 11 | Imagery | One raster only: the AVIF poster of the WebGL scene. Open Graph image. No photos, illustration, gradients, grain or avatars. |

---

## 1. Token architecture

### 1.1 Principles

1. The brief's token table is the base. Names in `:root` are the brief's names (`--background`, `--surface`, `--surface-raised`, `--foreground`, `--body`, `--muted`, `--label`, `--lead`, `--link`, `--micro`, `--border`, `--divider`, `--accent`, `--accent-hover`, `--accent-ink`, `--good`, `--warn`, `--bad`, `--danger-fill`, `--mint`).
2. Tailwind utility names (`--color-*` in `@theme inline`) point at those variables, so one change in `:root` moves the whole app.
3. No hex value appears anywhere except `:root` and the landing scope block. Components never contain raw hex. The one existing offender is `bg-[#d8e61a]` in `button.tsx`, replaced by `bg-accent-hover`.
4. Landing-only tokens exist only inside `.lp`. They carry no new hue: every colour token is a new role for a brief hex.

### 1.2 The block that replaces `:root` and `@theme` in `web/app/globals.css`

Replace everything from the first comment through the closing brace of `@theme inline`, and the `h1, h2, h3, h4, strong, b, th` weight rule. Keep `@import "tailwindcss";` as the first line. Keep the `rise` keyframes and `.animate-rise` utility unchanged (the app keeps its single fade; the landing does not use it, see A4).

```css
@import "tailwindcss";

/*
 * Kairos tokens: dark phosphor system (docs/04-ui-ux-brief.md, open item 2).
 * Surfaces step up in value (Void, Ground, Carbon) and are separated by hairlines, not shadows.
 * Lime Pulse is a FILL. It is never text, never a border on a non-action, never a glow.
 */
:root {
  color-scheme: dark;

  /* Surfaces */
  --background: #000000;      /* Void Black: page canvas */
  --surface: #181818;         /* Ground Iron: cards, inputs, default button fill */
  --surface-raised: #212525;  /* Carbon Veil: navbar, active nav, wash cards, skeletons */
  --mint: #def0dd;            /* Mint Frost: one optional light band; receipt paper on the landing */

  /* Text */
  --foreground: #ddffdc;      /* Phosphor White: headings, icons, default button labels, focus ring */
  --body: #8cab87;            /* Sage 60: body text. 8.3:1 on Void, 7.0:1 on Ground */
  --muted: #677d64;           /* Sage 40: helper text, table headers. VOID ONLY (4.7:1; 4.0:1 on Ground) */
  --label: #9cbf93;           /* Moss 70: eyebrows, micro-labels */
  --lead: #aed2a4;            /* Moss 80: lead paragraphs, navbar links */
  --link: #859984;            /* Fern Link: inline links, input borders, link-chip borders */
  --micro: #697368;           /* Deep Fern: decorative footer microcopy only, never meaning */

  /* Lines */
  --border: #485346;          /* Circuit Border: card and table hairlines. Decorative (2.6:1) */
  --divider: #1f2a33;         /* Phosphor Blue-Black: navbar border, section dividers */

  /* Action */
  --accent: #7fee64;          /* Lime Pulse: fill only */
  --accent-hover: #6ddb57;    /* derived by darkening Lime Pulse (brief) */
  --accent-ink: #000000;      /* Void text on lime, 14.3:1 */

  /* Status words and small badges only */
  --good: #aed2a4;
  --warn: #e8b84a;
  --bad: #ff8a80;
  --danger-fill: #a3261c;     /* danger button fill only, with Phosphor White text */

  /* Shape and motion shared by the app and the landing */
  --r-card: 8px;
  --r-button: 12px;
  --r-pill: 9999px;
  --shadow-navbar: rgba(0, 0, 0, 0.1) 0 10px 15px -3px, rgba(0, 0, 0, 0.1) 0 4px 6px -4px;
  --ui-duration: 300ms;
  --ui-ease: ease-out;

  /* Legacy names kept so existing utilities keep resolving. See section 1.3. Delete after the codemod. */
  --obsidian: var(--surface-raised);
  --smoke: var(--surface-raised);
  --line: var(--border);
  --subtle: var(--muted);
  --accent-soft: var(--surface-raised);
}

@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-mint: var(--mint);
  --color-foreground: var(--foreground);
  --color-body: var(--body);
  --color-faint: var(--muted);      /* brief --muted. Named "faint" to avoid the legacy text-muted meaning */
  --color-label: var(--label);
  --color-lead: var(--lead);
  --color-link: var(--link);
  --color-micro: var(--micro);
  --color-border: var(--border);
  --color-divider: var(--divider);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-ink: var(--accent-ink);
  --color-good: var(--good);
  --color-warn: var(--warn);
  --color-bad: var(--bad);
  --color-danger-fill: var(--danger-fill);

  /* Legacy aliases (transitional) */
  --color-muted: var(--body);       /* LEGACY MEANING: secondary text. Sage 60, not the brief's --muted */
  --color-subtle: var(--muted);     /* LEGACY: captions and placeholders. Sage 40, audit the 5 uses */
  --color-line: var(--border);
  --color-obsidian: var(--surface-raised);
  --color-smoke: var(--surface-raised);
  --color-accent-soft: var(--surface-raised);

  --radius-card: var(--r-card);       /* different names on purpose: a theme variable cannot reference itself */
  --radius-button: var(--r-button);
  --radius-pill: var(--r-pill);

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-inter-tight), var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

@layer base {
  /* Tailwind 4 defaults unspecified borders to currentColor (Phosphor White). Make them hairlines. */
  *, ::before, ::after { border-color: var(--border); }

  html { background: var(--background); }

  body {
    background: var(--background);
    color: var(--body);
    font-family: var(--font-sans);
    font-weight: 400;
    font-feature-settings: "cv11" 1;     /* Inter single-storey a */
  }

  /* Display face on page and section titles; weight 400. Hierarchy comes from size and tracking. */
  h1, h2 {
    font-family: var(--font-display);
    font-weight: 400;
    font-feature-settings: "ss01" 1;
    color: var(--foreground);
  }
  /* Card titles and sub-headings are Inter 500 (brief: 500 for card titles). */
  h3, h4 { font-weight: 500; color: var(--foreground); }
  strong, b { font-weight: 500; }
  th { font-weight: 400; }

  ::selection { background: var(--foreground); color: var(--background); }  /* Void on Phosphor White, 19.4:1; never lime */

  :focus-visible { outline: 2px solid var(--foreground); outline-offset: 2px; }

  input[type="range"], input[type="radio"], input[type="checkbox"] { accent-color: var(--foreground); }  /* never the browser blue, never lime */

  html:has(.lp) { scroll-padding-top: 80px; }   /* WCAG 2.4.11: focused targets stay clear of the 64px navbar */
}

/* Motion is utility only in the app: colour changes, 300ms ease-out. */
@keyframes rise { from { opacity: 0; } to { opacity: 1; } }
.animate-rise { animation: rise 0.4s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .animate-rise { animation: none; }
  * { transition-duration: 0.01ms !important; }
}
```

Notes on the block:

- `--color-faint` carries the brief's `--muted` (Sage 40). It is named differently on purpose: the legacy utility `text-muted` has been used 81 times as secondary text on Ground cards, where Sage 40 would be 3.97:1 and fail. During migration `text-muted` therefore resolves to Sage 60 (`--body`). This is the only place where a legacy name and the brief name disagree, and it is called out in 1.3.
- The `@layer base` heading rule replaces the global `h1, h2, h3, h4, strong, b, th { font-weight: 400 }` rule. That rule blocked 500 titles. `th` stays 400 and is styled as a caption by the table component.
- The reduced-motion `transition-duration` line keeps the app's colour transitions from flashing; it does not touch the landing, whose durations are zeroed by token (1.4).
- `--ui-duration` and `--ui-ease` are the brief's 300ms ease-out. Components use `transition-colors duration-300 ease-out` (already true in `button.tsx`).

### 1.3 Legacy alias map and required component edits

Counts are occurrences found by grep over `web/app` and `web/components` on 2026-10-15.

| Legacy utility | Old value | New resolved value | Uses | Action |
| --- | --- | --- | --- | --- |
| `bg-background` | Bone | Void | 2 | none |
| `bg-surface` | White | Ground Iron | 11 | none |
| `text-foreground` | Ink | Phosphor White | 30 | none |
| `text-muted` | Ash | **Sage 60** (alias of `--body`) | 81 | codemod to `text-body`, then delete `--color-muted` so a stray use produces no class |
| `text-subtle` | Grey | **Sage 40** (alias of `--muted`) | 5 | audit each: on Void use `text-faint`; on Ground or Carbon use `text-body`; then delete `--color-subtle` |
| `border-line`, `divide-line`, `bg-line` | Hairline | Circuit Border | 46, 5, 4 | none (a codemod to `border-border` is optional) |
| `bg-smoke`, `bg-obsidian`, `bg-accent-soft` | Greys | Carbon Veil | 0, 0, 2 | none |
| `bg-accent`, `text-accent-ink`, `fill-accent`, `stroke-accent-ink` | Highlighter | Lime Pulse / Void | 6, 6, 1, 1 | audit every `bg-accent` against the brief's lime rules: Badge `accent` tone, pricing interval switch, "Most chosen", sidebar active item, primary button |
| `text-good`, `text-warn`, `text-bad` | Dark status | Light status on Void | 7, 2, 14 | none; verify none sits on Mint |
| `hover:bg-[#d8e61a]` (`button.tsx`) | Old hover | n/a | 1 | replace with `hover:bg-accent-hover` |
| `bg-bad text-white` (danger variant) | | n/a | 1 | replace with `bg-danger-fill text-foreground` |
| `rounded-[6px]` (buttons, badges) | 6px | n/a | several | buttons `rounded-button` (12px); badges `rounded-pill` |
| `rounded-2xl` (cards) | 16px | n/a | 2 | `rounded-card` (8px) |
| `ring-accent/20` (inputs) | Highlighter ring | n/a | 1 | `ring-label/35` plus 2px Phosphor White border (brief input focus) |
| `bg-background/85 backdrop-blur` (navbar) | Bone glass | n/a | 1 | `bg-surface-raised/85 backdrop-blur-[10px] shadow-[var(--shadow-navbar)] border-divider` |
| `text-[11px] tracking-[0.08em] uppercase` (SectionHeading eyebrow) | | n/a | 1 | caption style: 12px, `tracking-[0.6px]`, `text-label` |
| Logo SVG `rx="6"`, round linecaps | | n/a | 1 | `rx="0"`, square linecaps, see 6.12 |

The first commit therefore changes `globals.css`, `layout.tsx` (fonts), `button.tsx`, `badge.tsx`, `logo.tsx`, `navbar.tsx` and nothing else. Route-by-route visual review follows.

### 1.4 Landing-only tokens

Declared in `web/components/landing/landing.css`, imported once by the landing shell component (`LandingShell`, owner 05). The file is plain CSS (no `@apply`, no `@import "tailwindcss"`), so Tailwind passes it through. It is loaded after `globals.css` because the root layout imports `globals.css` first, so `@layer components` resolves to Tailwind's own layer order.

The scope class `.lp` must be present on an ancestor of the navbar, `main` and the footer on route `/`. How the layout achieves that is decided in 05. Everything below is inert on any element outside `.lp`.

```css
/* ===== Landing scope. Every token below exists only inside .lp. ===== */
.lp {
  /* Type (names pinned by the Creative: display, heading, numeral) */
  --type-display-landing: clamp(3rem, 1.25rem + 5.6vw, 6.5rem);   /* 48px to 104px */
  --type-heading-landing: clamp(2.25rem, 1.5rem + 2.2vw, 3.5rem); /* 36px to 56px */
  --type-numeral-landing: clamp(2.5rem, 1.75rem + 2.4vw, 4rem);   /* 40px to 64px */
  --type-lead-landing: 1.125rem;     /* 18px; 20px from 768 (set in the media query below) */
  --type-title-landing: 1.25rem;     /* 20px, weight 500 */
  --type-body-landing: 1rem;
  --type-small-landing: 0.875rem;
  --type-caption-landing: 0.75rem;
  --lh-display-landing: 0.95;
  --lh-heading-landing: 1.02;
  --lh-numeral-landing: 1;
  --tracking-display-landing: -0.025em;
  --tracking-heading-landing: -0.02em;
  --tracking-numeral-landing: -0.02em;
  --measure-body: 34rem;             /* 544px, about 65 characters of Inter 16px */
  --measure-title: 14em;

  /* Colour roles on Mint Frost (names pinned by the Creative) */
  --receipt-paper: var(--mint);      /* #def0dd */
  --on-mint-ink: #000000;            /* headings, figures: 17.6:1 */
  --on-mint-body: #181818;           /* body text: 14.9:1 */
  --on-mint-muted: #485346;          /* secondary text and rules: 6.8:1, AA on mint ONLY */
  /* New colour roles (not in the Creative): status words on mint. Hexes are the previous brief's dark
     status colours, which fail on Void but pass on mint. They colour words and small badges only. */
  --on-mint-good: #3d6b21;           /* 5.3:1 */
  --on-mint-warn: #8a5a00;           /* 5.0:1 */
  --on-mint-bad: #a3261c;            /* 6.2:1 */

  /* Sample and tear (pinned) */
  --sample-border: 1px dashed var(--border);
  --perforation: 1px dotted var(--border);       /* semantic name; drawn with --lp-perforation-image, see 6.7 */
  --chip-link-border: var(--link);   /* claim chips are links: 6.9:1, not Circuit Border */
  --lp-perforation-image: repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 4px);
  --lp-perforation-image-mint: repeating-linear-gradient(90deg, var(--on-mint-muted) 0 1px, transparent 1px 4px);
  --rule-rhythm: 32px;

  /* Motion curves and durations (pinned). Values from the Creative 3.5 and 3.6. */
  --ease-post: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-feed: cubic-bezier(0.45, 0, 0.55, 1);
  --ease-travel: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-tear: cubic-bezier(0.55, 0, 1, 0.45);
  --ease-retract: cubic-bezier(0.7, 0, 0.84, 0);
  --dur-ink: 360ms;
  --dur-print: 420ms;
  --dur-post: 600ms;
  --dur-tear: 700ms;
  --dur-handoff: 400ms;
  --lp-dur-custody: 150ms;           /* lime hand-over, each half */
  --lp-dur-retract: 240ms;
  --lp-dur-odometer: 240ms;

  /* Layout (receipt-lane and section-pad pinned) */
  --section-pad-landing: 80px;
  --receipt-lane: 1 / -1;            /* below 1024 the lane is not a column */
  --lp-container: 1280px;
  --lp-cols: 4;
  --lp-gap: 16px;
  --lp-margin: 16px;
  --lp-navbar-h: 64px;
  --lp-tape-h: 48px;
  --lp-hit: 44px;                    /* touch target, A16 */
  --lp-hit-gap: 8px;
  --lp-head-h: 32px;                 /* entry head row: number plus rule */

  /* Stacking */
  --lp-z-canvas: 0;
  --lp-z-content: 1;
  --lp-z-rail: 20;
  --lp-z-tape: 30;
  --lp-z-navbar: 40;
  --lp-z-dialog: 50;
  --lp-z-skip: 60;

  font-variant-numeric: tabular-nums slashed-zero;   /* A15: every numeral */
}

@media (min-width: 640px)  { .lp { --lp-cols: 8; --lp-gap: 20px; } }
@media (min-width: 768px)  { .lp { --lp-gap: 24px; --lp-margin: 24px; --section-pad-landing: 96px; --type-lead-landing: 1.25rem; } }
@media (min-width: 1024px) { .lp { --lp-cols: 12; --lp-gap: 32px; --lp-margin: 32px; --section-pad-landing: 128px; --receipt-lane: 9 / 13; } }

/* Reduced motion: one rule zeroes every named duration. The inline script sets data-motion before first paint. */
html[data-motion="reduced"] .lp {
  --dur-ink: 0ms; --dur-print: 0ms; --dur-post: 0ms; --dur-tear: 0ms; --dur-handoff: 0ms;
  --lp-dur-custody: 0ms; --lp-dur-retract: 0ms; --lp-dur-odometer: 0ms;
}
@media (prefers-reduced-motion: reduce) {          /* no-JavaScript fallback */
  html:not([data-motion]) .lp {
    --dur-ink: 0ms; --dur-print: 0ms; --dur-post: 0ms; --dur-tear: 0ms; --dur-handoff: 0ms;
    --lp-dur-custody: 0ms; --lp-dur-retract: 0ms; --lp-dur-odometer: 0ms;
  }
}
```

Justification of each landing-only token:

| Token group | Why it exists | Why it cannot be a brief token |
| --- | --- | --- |
| Display, heading, numeral, lead scales | Site of the Day scale; size is the main hierarchy lever when weights are capped at 500 | The brief's 64px display and 42px heading are the app-wide marketing scale (A1, A2) |
| `--on-mint-*` and `--receipt-paper` | The one light band and the receipt share one paper and one ink system | The brief has no text colours for Mint Frost at all |
| `--on-mint-good/warn/bad` | Receipt slips A and B carry the words Submitted and Failed on mint; the brief's status hexes fail there (the dark-theme `--good` `#aed2a4` is 1.40:1 on mint) | Status colours are defined for Void only |
| `--sample-border`, `--perforation` | The two meaning marks of the Ledger concept | They give the dashed and dotted lines one meaning on one page |
| `--ease-*`, `--dur-*` | Named moves from the motion grammar | The brief allows only 300ms colour transitions |
| `--section-pad-landing`, `--lp-*` layout | Expressive pacing and a 12-column lane layout | The brief fixes 80px sections and does not define a column grid |
| `--lp-z-*` | One stacking scale shared by canvas, rail, tape, navbar, dialogs | The app has no stacking scale |

### 1.5 Leak guard (enforcing "the app cannot use them by accident")

1. Scope: the tokens are declared on `.lp` only. An app component that wrote `var(--ease-post)` would get the guaranteed-invalid value and its declaration would be dropped, which is visible in review.
2. No `@theme` registration: Tailwind therefore generates no `ease-post`, `duration-ink` or similar utility. Landing components use the plain CSS classes in 6.14 and arbitrary values such as `duration-[var(--dur-post)]`.
3. CI grep (runs in the copy lint job, owner 05). It must return no lines:

```bash
rg -n --pcre2 "var\(--(type-[a-z]+-landing|lh-[a-z]+-landing|tracking-[a-z]+-landing|ease-(post|feed|travel|tear|retract)|dur-(ink|print|post|tear|handoff)|receipt-paper|receipt-lane|on-mint-[a-z]+|sample-border|perforation|rule-rhythm|section-pad-landing|measure-[a-z]+|lp-[a-z0-9-]+)" web \
  --glob '!web/components/landing/**' --glob '!web/app/(public)/page.tsx'
```

4. Class names prefixed `lp-` are reserved for landing files by the same grep (`rg "className=.*\blp-"` outside the allowed paths).

---

## 2. Font loading

### 2.1 `web/app/layout.tsx`

```tsx
import { Inter, Inter_Tight } from "next/font/google";

// UI and body. Weight 400 for paragraphs, 500 for buttons, nav, card titles, FAQ questions.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// Display and headings (h1, h2, landing display). Weights 400 and 500; the landing uses 400.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// <html className={`${inter.variable} ${interTight.variable} h-full antialiased`}>
```

Rules:

| Rule | Value | Reason |
| --- | --- | --- |
| Export name | `Inter_Tight` (underscore) | next/font naming for multi-word families (verified in the stack research) |
| Weights | `["400","500"]` for both | The brief caps weight at 500. Measured on the Google CDN: Inter 400 and 500 is one 48 KB file, Inter Tight `wght@400;500` is one 33 KB file. These are the sizes the performance budget assumes. |
| Subsets | `["latin"]` only | Indian and US audiences write English in the UI; names with diacritics fall back to the metric-adjusted system face |
| `display` | `swap` | `optional` would leave the H1 in the fallback face for the whole first visit on a slow network. `adjustFontFallback` (the default) keeps the swap within about 1px of layout shift |
| Preload | Both fonts preload (the default for fonts called in the root layout) | Refines Creative 8.1, which preloaded only the display face. The hero subhead, both CTAs and the micro-label are Inter and are in the first viewport. Without the Inter preload they would swap after first paint and shift the CTA row. The cost is one extra 48 KB request in parallel with the 33 KB display font, inside the 1.0 MB first-load budget |
| Fonts per route | Root layout, so the app also gets Inter Tight on `h1` and `h2` | The brief assigns Inter Tight to headings app-wide |
| Variable axes | No `axes` option | `opsz` would grow the file. Revisit only if the 12px caption looks cramped |
| Body class | Remove the old comment about Lausanne | Obsolete |

### 2.2 OpenType features

| Feature | Where | How it is applied | Fallback if the subset lacks it |
| --- | --- | --- | --- |
| `ss01` (Inter Tight) | Display, h1, h2 | `font-feature-settings: "ss01" 1` on `h1, h2` (1.2) and on `.lp-display`, `.lp-heading` | Gate G2: if the latin subset served by next/font lacks the feature, headings render without it. No layout depends on it |
| `cv11` (Inter) | Body, UI | `font-feature-settings: "cv11" 1` on `body` | Same gate |
| `tnum` and `zero` | Every numeral on the landing | `font-variant-numeric: tabular-nums slashed-zero` on `.lp` (set once, inherited). Elsewhere in the app, `tabular-nums` on table and counter cells only | If `zero` is absent, use `tabular-nums` only; the "0 guessed" and "$0.00" rows then rely on the unit words, which are always present |
| Kerning, ligatures | Default on | `font-kerning: normal` | none |

`font-feature-settings` is an inherited property that replaces the parent value, so an element that sets `"ss01"` loses the inherited `"cv11"`. This is intended: Inter Tight does not need `cv11`. `font-variant-numeric` is a separate property and is not lost.

Verification (gate G2, build time): open DevTools Rendering, confirm `ss01`, `cv11`, `zero` and `tnum` change glyphs on the built page. Record the result in the PR.

### 2.3 The canvas cannot apply OpenType features

`CanvasRenderingContext2D` has no font-feature or numeric-variant setting. The WebGL receipt texture (04) therefore prints zeros without the slash, while the DOM receipt after the hand-off shows slashed zeros. The difference is one small glyph mark during a 400ms cross-fade. Decision for 04: accept it, and do not print the number 0 in a canvas line where the slash matters (the lines in Creative 4.4 contain `0417`, `0233` and `+25`; four-digit ids with a leading zero are the exposed case). If 04 wants exact parity, it may pre-render those few ids into the ring buffer from a hidden DOM element using `html-to-image`-free means only (no new dependency); otherwise leave as is. This is listed in section 12.

### 2.4 Fallback stack

`ui-sans-serif, system-ui, sans-serif` after the web font. `adjustFontFallback` creates `Inter Fallback` and `Inter Tight Fallback` from Arial with `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override`, so the first paint is within about 1px of the final line box. SplitText must run `autoSplit` so a late swap re-splits lines (03).

---

## 3. Type scale

All sizes are for the landing (`.lp`). Outside it, the brief's scale applies. Weight is never above 500. Colour names are brief names.

### 3.1 The scale

| Role | Class | Face | Weight | Size (min to max) | Line height | Tracking | Colour | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Display (hero H1) | `.lp-display` | Inter Tight, `ss01` | 400 | 48px to 104px: `var(--type-display-landing)` | 0.95 | -0.025em | Phosphor White | `text-wrap: balance`, max width 8 columns. Ink word steps start from Sage 60 |
| Heading (entry title, h2) | `.lp-heading` | Inter Tight, `ss01` | 400 | 36px to 56px: `var(--type-heading-landing)` | 1.02 | -0.02em | Phosphor White | `text-wrap: balance`, `max-width: var(--measure-title)` |
| Numeral (price, calculator result) | `.lp-numeral` | Inter Tight, `ss01` | 400 | 40px to 64px: `var(--type-numeral-landing)` | 1.0 | -0.02em | Phosphor White | Odometer columns have fixed height of 1em |
| Lead (hero subhead, open row) | `.lp-lead` | Inter | 400 | 18px below 768, 20px from 768 | 1.5 | -0.018em | Moss 80 | `max-width: var(--measure-body)` |
| Card or job title | `.lp-title` | Inter | 500 | 20px | 1.5 | -0.018em | Phosphor White | h3 |
| Body | `.lp-body` | Inter | 400 | 16px | 1.5 | -0.022em | Sage 60 | `max-width: var(--measure-body)`, left-aligned, no entrance animation, ever |
| Small (tables, labels, buttons) | `.lp-small` | Inter | 400 or 500 | 14px | 1.43 | -0.026em | Sage 60 or Phosphor White | |
| Caption (eyebrows, entry numbers, stamps, chips) | `.lp-caption` | Inter | 500 | 12px | 1.33 | +0.6px | Moss 70 | Uppercase for eyebrows and SAMPLE only. Entry numbers and chips are not uppercase |
| Receipt row (DOM) | `.lp-receipt-row` | Inter | 400 | 14px | 32px rhythm | 0 | `--on-mint-body` | `tabular-nums slashed-zero` |
| Primary action (all five custody CTAs) | `.lp-btn` | Inter | 500 | 16px | 1 | -0.022em | Void on lime, Phosphor White otherwise | 48px tall |
| Navbar link | `.lp-nav` | Inter | 500 | 14px | 1.43 | -0.026em | Moss 80, Phosphor White on hover | Sage 60 fails over the Mint band (section 9, N4) |
| FAQ question | `.lp-faq-q` | Inter | 500 | 16px | 1.5 | -0.022em | Phosphor White | 56px summary row |

Weight 500 appears only on: buttons, nav links, card titles, FAQ questions, chips (12px), captions. Headings and display are 400.

Reference CSS for the three fluid roles and the shared rules (the other roles follow the table):

```css
.lp-display { font: 400 var(--type-display-landing)/var(--lh-display-landing) var(--font-inter-tight), var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  font-feature-settings: "ss01" 1; letter-spacing: var(--tracking-display-landing); color: var(--foreground); text-wrap: balance; }
.lp-heading { font: 400 var(--type-heading-landing)/var(--lh-heading-landing) var(--font-inter-tight), var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  font-feature-settings: "ss01" 1; letter-spacing: var(--tracking-heading-landing); color: var(--foreground); text-wrap: balance; max-width: var(--measure-title); }
.lp-numeral { font: 400 var(--type-numeral-landing)/var(--lh-numeral-landing) var(--font-inter-tight), var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  font-feature-settings: "ss01" 1; letter-spacing: var(--tracking-numeral-landing); color: var(--foreground); }
.lp-body { font: 400 var(--type-body-landing)/1.5 var(--font-inter), ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.022em;
  color: var(--body); max-width: var(--measure-body); text-wrap: pretty; }
.lp-caption { font: 500 var(--type-caption-landing)/1.333 var(--font-inter), ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.6px; color: var(--label); }
```

### 3.2 Computed sizes at the six breakpoints

Formula: `size = clamp(min, a + b * vw, max)`, vw in px. Values are the clamp result in CSS pixels.

| Viewport | Display | Heading | Numeral | Lead | Body | Small | Caption |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 360 | 48.0 | 36.0 | 40.0 | 18 | 16 | 14 | 12 |
| 640 | 55.8 | 38.1 | 43.4 | 18 | 16 | 14 | 12 |
| 768 | 63.0 | 40.9 | 46.4 | 20 | 16 | 14 | 12 |
| 1024 | 77.3 | 46.5 | 52.6 | 20 | 16 | 14 | 12 |
| 1280 | 91.7 | 52.2 | 58.7 | 20 | 16 | 14 | 12 |
| 1440 | 100.6 | 55.7 | 62.6 | 20 | 16 | 14 | 12 |
| 1500 and wider | 104.0 (cap) | 56.0 (cap at 1455) | 64.0 (cap at 1500) | 20 | 16 | 14 | 12 |

Display reaches its 48px floor at 500px and its 104px cap at 1500px. Between 360 and 500 it does not scale, which is why the hero keeps the same measure on all phones.

### 3.3 Typographic details that prevent bugs

| Detail | Rule | Reason |
| --- | --- | --- |
| Line wrapping | `text-wrap: balance` on display, heading, lead; `text-wrap: pretty` on body | Avoids orphans without manual breaks |
| Hero H1 line count | Two lines from about 390px up, two or three at 360 to 389 | "Job applications" measures about 7.1em at -0.025em tracking, so it fits one line at 48px when the content width is 343px or more. The 375 by 667 fold budget in Creative 9.1 assumes three lines; design-lock must measure the real count and keep the primary CTA above the fold at 375 by 667 |
| Mask clipping | SplitText mask lines need room for descenders: `padding-bottom: 0.14em; margin-bottom: -0.14em` on the masked line box of `.lp-heading` | Line height 1.02 would clip the tails of g, y, p inside `overflow: hidden` |
| Signature rule under "sign." | A 1px Phosphor White `::after` on the word wrapper, `bottom: -0.16em`, `left: 0; right: 0` | With line height 0.95 the line box ends about 0.09em above the bottom of the g descender, so 0.16em clears it. Visual check at design lock |
| Tabular numerals in prose | Allowed. `tnum` makes the digit 1 slightly wider in running text | A15 prefers one rule over exceptions |
| Right alignment | Numeric columns in tables and the receipt may be right-aligned | This is table convention, not body text. Body text and headlines stay left-aligned (brief) |
| Hyphenation | `hyphens: manual`, `overflow-wrap: break-word` on `.lp` | Reason strings and ids must not hyphenate |
| Font smoothing | `antialiased` (already on `html`) | Light text on dark looks heavy otherwise |
| Minimum size | 12px (Caption). No text under 12px on the page, including chips and stamps | Readability |

---

## 4. Layout grid, section rhythm and spacing

### 4.1 Grid by breakpoint

The landing uses its own container class, `.lp-container`, not the shared `Container`, because the shared one switches gutter at 640 (`sm:px-6`) while the Creative sets 16px below 768.

```css
.lp-container { width: 100%; max-width: var(--lp-container); margin-inline: auto; padding-inline: var(--lp-margin); }
.lp-grid { display: grid; grid-template-columns: repeat(var(--lp-cols), minmax(0, 1fr)); column-gap: var(--lp-gap); }
```

| Breakpoint | Columns | Margin (side gutter) | Column gap | Content width | Column width | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 360 (below 640) | 4 | 16 | 16 | 328 | 70 | One column of text; phone composition (Creative 9.1) |
| 640 to 767 | 8 | 16 | 20 | 608 to 735 | 58.5 at 640 | Two-column control rows allowed |
| 768 to 1023 | 8 | 24 | 24 | 720 to 975 | 69 at 768 | Tablet. No WebGL, no pin |
| 1024 to 1279 | 12 | 32 | 32 | 960 to 1215 | 50.7 at 1024 | Receipt lane appears. Rail hidden below 1280 |
| 1280 | 12 | 32 | 32 | 1216 | 72 | The container is exactly 1280 wide, margins are inside it |
| 1440 and wider | 12 | 32 (inside the container) | 32 | 1216 | 72 | The container stays 1280 and centres; page margin outside it is 80px at 1440, 320px at 1920. Full-bleed elements are the Mint Frost band, the perforated footer rule and nothing else |

Column spans at 1024 and wider (Creative 5.2):

| Element | Columns | Width at 1280 and wider | Width at 1024 |
| --- | --- | --- | --- |
| Body text and demos | 1 to 7 | 696px | 547px |
| Hero H1 | 1 to 8 | 800px | 629px |
| Buffer | 8 | not used by text | |
| Receipt lane (`--receipt-lane: 9 / 13`) | 9 to 12 | 384px | 299px |
| Receipt slot (entry 05) | 5 to 8 | 384px | 299px |
| Full-width entries (07, 08, 09) | 1 to 12 | 1216px | 960px |

Slip size in the lane (CSS side, must equal the WebGL measurement in Creative 4.1): the lane element has `container-type: inline-size` and the poster box is `width: min(85cqw, calc(0.36 * (100svh - 64px))); aspect-ratio: 1.6 / 3.6;`.

| Viewport | Lane width | Slip width | Slip height |
| --- | --- | --- | --- |
| 1024 by 768 | 299 | 253 | 570 |
| 1280 by 800 | 384 | 265 | 596 |
| 1440 by 900 | 384 | 301 | 677 |
| 1920 by 1080 | 384 | 326 | 734 |

(At 1920 by 1080 the width limit is `min(0.85 * 384 = 326, 0.36 * 1016 = 366)`, which is 326px, so the slip is 326 by 734.)

Below 1024 the lane does not exist. The hero shows the DOM mini receipt (mint paper, perforated top, 0px radius) in the normal column, max height 200px below 768 and 320px from 768 to 1023.

Rail and tape positions:

| Element | Position | Width |
| --- | --- | --- |
| Ledger rail (1280 and wider, `--lp-z-rail`) | `position: fixed; right: 8px` at 1280 to 1439, `right: 24px` from 1440; vertically centred | 24px column; title reveal opens leftward as a Carbon Veil card overlaying content |
| Receipt tape (below 1024) | `position: sticky; top: 64px`, height 48px, Ground Iron, 1px Circuit Border bottom | Full width |

### 4.2 Section rhythm

`--section-pad-landing` is 80px below 768, 96px from 768 to 1023 and 128px from 1024. It is the space below the content of each entry. The entry rule (graticule) is the divider and sits at the top of the next entry, so the whitespace above any rule is exactly one section pad.

```css
.lp-entry { padding-bottom: var(--section-pad-landing); scroll-margin-top: 80px; }
.lp-entry > .lp-head { margin-bottom: 40px; }                 /* 32px below 768 */
```

| Entry | Padding top | Padding bottom | Min height (1024 and wider) |
| --- | --- | --- | --- |
| 00 Hero | 32px below the navbar (the head row sits there) | `--section-pad-landing` | `calc(100svh - 64px)` |
| 01 to 04, 06 to 10 | 0 (the previous entry's bottom pad is the gap) | `--section-pad-landing` | content height; vh budgets in Creative 6 are targets for the finished composition, not CSS |
| 05 Send and receipt | Stage wrapper 200vh, sticky stage 100vh | Mint band ends in a perforated edge | see 5.4 |
| Footer | 64px | 64px | content |

### 4.3 Vertical spacing inside an entry

All values come from the brief's 4px scale (4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 96, 128, 160).

| Gap | Desktop (1024 and wider) | Below 1024 |
| --- | --- | --- |
| Entry head (number plus rule) height | 32 (`--lp-head-h`) | 32 |
| Head to eyebrow | 40 | 32 |
| Eyebrow to title | 16 | 12 |
| Title to body | 24 | 20 |
| Paragraph to paragraph | 16 | 16 |
| Body to demo or table | 48 | 32 |
| Demo to settlement line | 32 | 24 |
| Gap between sibling elements in a row or stack | 20 (brief element gap) | 20 |
| Chip to chip | 8 | 8 |
| Touch target to touch target | 8 minimum (`--lp-hit-gap`) | 8 |
| Hero: micro-label to H1 | 24 | 16 |
| Hero: H1 to subhead | 32 | 24 |
| Hero: subhead to CTA pair | 40 | 32 |
| Hero: CTA to microcopy | 16 | 16 |

Panel and card padding:

| Surface | Desktop | Below 768 |
| --- | --- | --- |
| Content card (pricing cards, kept cards) | 32 | 20 (A23) |
| Sample panel (dashed) | 32 | 20 (A23) |
| Compact rows (skip ledger, credit ledger, FAQ summary) | 16 to 20 vertical, min height 32 (`--rule-rhythm`); FAQ summary 56 | same |
| DOM receipt paper | 24 vertical, 20 horizontal | same |

---

## 5. Surfaces, borders, lime, Mint Frost

### 5.1 Surfaces on the landing

| Level | Token | Hex | Landing use |
| --- | --- | --- | --- |
| 0 | Void | `#000000` | Page canvas. All body copy sits on Void. Text never enters the receipt lane |
| 1 | Ground Iron | `#181818` | Sample panels, kept cards, pricing cards, inputs, selects, the mobile tape, Default button fill |
| 2 | Carbon Veil | `#212525` | Navbar (85% with 10px blur), active segment of switches, hover fill, rail title card, wash callouts, skeleton blocks |
| 3 | Mint Frost | `#def0dd` | Entry 05 band; receipt paper everywhere (canvas, DOM receipt, mobile mini receipt, tier-0 lane receipt) |
| 4 | Lime Pulse | `#7fee64` | The single custody action fill |

Elevation: none, except the navbar shadow token. No other `box-shadow` exists on the landing. Overlays (menu sheet, tape dialog) use a scrim of `rgba(0,0,0,0.6)` and a Ground Iron panel with a 1px Circuit Border; they have no shadow.

### 5.2 Borders and rules

| Kind | Spec | Use |
| --- | --- | --- |
| Hairline | 1px solid Circuit Border | Cards, tables, row rules, chips, skip ledger |
| Divider | 1px solid Phosphor Blue-Black `#1f2a33` | Navbar bottom border only on the landing (the graticule replaces section dividers) |
| Input border | 1px solid Fern Link | Inputs, selects, segmented control outer edge (non-text contrast 5.8:1 on Ground) |
| Emphasis border | 1px solid Phosphor White | Pro card, Default and Outlined buttons, the signature box (M9), the signature rule under "sign." |
| Sample edge | `--sample-border` (1px dashed Circuit Border) | Every demo, the sample receipt, sample cards. Never the only signal (6.6) |
| Perforation | `--lp-perforation-image` (1px tall, 1px on, 3px off) | Exactly three places (6.7) |
| Focus | 2px Phosphor White outline, 2px offset; on Mint Frost, 2px Void | Every interactive element |
| Radius | Cards and inputs 8px (`rounded-card`); buttons that are not custody CTAs 12px; pills and chips 9999px; 0px for the logo, icons, posting squares, receipt paper, mint cells, the signature box and the range thumb | Brief plus A12 |

### 5.3 One lime element per viewport: the enforceable checklist

Definition. A "lime element" is any element whose computed `background-color` is `rgb(127, 238, 100)` or `rgb(109, 219, 87)` (Lime Pulse or its hover) and whose bounding box intersects the viewport. Lime used as a border colour counts as lime if the border is wider than 1px (none exist). The favicon, extension icons and Open Graph image are outside the page and are exempt (Creative 3.3).

Who may be lime, in priority order (Creative 3.3, attribute `data-lime-candidate`):

| Priority | Value | Element | Lime when |
| --- | --- | --- | --- |
| 1 | `approve` | "Approve sample draft" (entry 04) | any pixel of it is in the viewport |
| 2 | `hero` | "Start with 25 free applications" | any pixel in the viewport and no higher candidate is |
| 3 | `pro` | "Choose Pro" | as above |
| 4 | `closing` | "Start free" (entry 10) | as above |
| 5 | `navbar` | Navbar "Start free" | no candidate 1 to 4 is visible |
| n/a | `navbar-sheet` | Menu sheet "Start free" | the sheet is open and the owner is `navbar` (see rule L7) |

Rules (each one is a pass or fail item in review and in the Playwright check):

| # | Rule |
| --- | --- |
| L1 | The owner is written to `html[data-lime-owner]` (`hero` in server HTML; `menu` is not a value). CSS paints lime only where `data-lime-candidate` equals the owner. Every other candidate renders in its fallback style (L4). |
| L2 | Lime is a fill. It is never a text colour, an icon colour, a link colour, a stroke on a non-button, a gradient stop, a glow, a drop shadow, a `text-shadow`, a `::selection` colour, a scrollbar colour, a focus ring, an `accent-color` or a caret colour. |
| L3 | These are never lime on the landing: the logo mark (Phosphor White, A11), badges and chips (A17), the active segment of any switch, the active rail entry, the Pro card, posting squares, the range thumb, the checked radio, links, the receipt, any pixel in the WebGL canvas or poster, any element inside the Mint Frost band. |
| L4 | Fallback style of a custody candidate: Ground Iron fill, 1px Phosphor White border, Phosphor White text, same 9999px radius, same 48px height, same padding, same 1px border width as the lime state (the lime state's border is lime-coloured), so the hand-over changes colour only and never size or shape (A19). On the Mint Frost band the fallback is outlined: transparent fill, 1px `--on-mint-ink` border, `--on-mint-ink` text. |
| L5 | Hover: owner goes to `--accent-hover` (11.9:1 for Void text). A non-owner fallback goes to Carbon Veil on Void and Ground, and to `--on-mint-body` fill with `--receipt-paper` text on mint. A non-owner never turns lime on hover. |
| L6 | Hand-over is sequential: the old owner transitions to its fallback over 150ms; the new owner waits 150ms and then transitions to lime over 150ms. Two lime fills therefore never coexist, including mid-transition. Under reduced motion both durations are 0ms. |
| L7 | While the menu sheet is open, the navbar bar button renders its fallback and the sheet button (`navbar-sheet`) is lime iff the owner is `navbar`. CSS: `html:has(dialog[open]) [data-lime-candidate="navbar"] { fallback }`. This avoids two lime fills with the scrim between them. |
| L8 | Without JavaScript, `data-lime-owner="hero"` is in the server HTML, so only the hero CTA is lime and the others are in fallback style. |
| L9 | Skeleton and loading states of lime buttons render the fallback style, never a lime shimmer. |
| L10 | The Playwright check (Creative 10.5) must match both `rgb(127, 238, 100)` and `rgb(109, 219, 87)` and must also fail if any computed `color`, `border-color`, `outline-color`, `fill`, `stroke` or `box-shadow` of any visible element equals either value, except `background-color` and `border-color` of the single owner button. It runs at 1440 by 900 and 390 by 844, 100px scroll steps, 400ms wait per step, plus once with the menu sheet open at 390. |

CSS that implements L1, L4, L5, L6 (placed in `landing.css`; `.lp-btn` is the class on all five candidates):

```css
.lp-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 48px; padding: 0 24px; border-radius: var(--r-pill);
  font: 500 1rem/1 var(--font-inter), ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.022em;
  border: 1px solid var(--foreground); background: var(--surface); color: var(--foreground);
  transition: background-color var(--lp-dur-custody) ease-out, border-color var(--lp-dur-custody) ease-out, color var(--lp-dur-custody) ease-out;
  transition-delay: 0ms;
}
.lp-btn:hover { background: var(--surface-raised); }
html[data-lime-owner="approve"] .lp-btn[data-lime-candidate="approve"],
html[data-lime-owner="hero"]    .lp-btn[data-lime-candidate="hero"],
html[data-lime-owner="pro"]     .lp-btn[data-lime-candidate="pro"],
html[data-lime-owner="closing"] .lp-btn[data-lime-candidate="closing"],
html[data-lime-owner="navbar"]  .lp-btn[data-lime-candidate="navbar"],
html[data-lime-owner="navbar"]  dialog[open] .lp-btn[data-lime-candidate="navbar-sheet"] {
  background: var(--accent); border-color: var(--accent); color: var(--accent-ink);
  transition-delay: var(--lp-dur-custody);              /* wait for the old owner to release */
}
html[data-lime-owner="approve"] .lp-btn[data-lime-candidate="approve"]:hover,
html[data-lime-owner="hero"]    .lp-btn[data-lime-candidate="hero"]:hover,
html[data-lime-owner="pro"]     .lp-btn[data-lime-candidate="pro"]:hover,
html[data-lime-owner="closing"] .lp-btn[data-lime-candidate="closing"]:hover,
html[data-lime-owner="navbar"]  .lp-btn[data-lime-candidate="navbar"]:hover,
html[data-lime-owner="navbar"]  dialog[open] .lp-btn[data-lime-candidate="navbar-sheet"]:hover {
  background: var(--accent-hover); border-color: var(--accent-hover);
}
html:has(dialog[open]) .lp-btn[data-lime-candidate="navbar"] { background: var(--surface); border-color: var(--foreground); color: var(--foreground); }
[data-surface="mint"] .lp-btn { background: transparent; border-color: var(--on-mint-ink); color: var(--on-mint-ink); }
[data-surface="mint"] .lp-btn:hover { background: var(--on-mint-body); color: var(--receipt-paper); }
```

A non-owner keeps the Carbon Veil hover from `.lp-btn:hover`; the owner hover rule above has higher specificity, so a non-owner can never turn lime on hover (L5).

### 5.4 Is Mint Frost used? Yes, as one band and as the receipt paper

| Property | Spec |
| --- | --- |
| Where | Entry 05 only (from the end of the pinned stage through the end of "How it sends"), plus the receipt object wherever it appears (canvas slip, DOM receipt, mobile mini receipt, tier-0 lane receipt, footer none) |
| Background | `var(--mint)` `#def0dd`, full bleed (viewport width), no gradient |
| Edges | Top and bottom edges carry the perforation (`--lp-perforation-image-mint`) in `--on-mint-muted`, 1px tall, at the exact band boundary. Radius 0 |
| Scope attribute | The band root has `data-surface="mint"` and `color-scheme: light` so native controls and scrollbars inside render light |
| Ink | Headings and figures `--on-mint-ink`; body `--on-mint-body`; secondary text and rules `--on-mint-muted`. Sage 60, Moss, Fern and Phosphor White are not used on mint (they measure 1.1 to 2.6:1) |
| Links | Text in `--on-mint-ink`, 1px underline, offset 3px. No colour-only links |
| Focus | 2px Void outline, 2px offset |
| Buttons | Outlined-on-mint (L4). Never lime (L3) |
| Status words | `--on-mint-good`, `--on-mint-warn`, `--on-mint-bad` with the word always present |
| Borders | 1px `--on-mint-muted` for cell rules; dashed variant for the ghost receipt |
| Radius | 0px for paper, cells and the stub; 0px for the compact slips |
| Entry transition | The flat mint layer scales from the receipt rectangle (04 and 03 own the timing). Text colours flip when the layer passes behind them, and the H2 re-enters already in `--on-mint-ink` (Creative 4.6) |
| Boundary visibility | Mint against Void is 17.6:1, so the band edge is unmistakable; the perforation is decoration |
| Why one band | A second light band would dilute the tonal turn that makes entry 05 the page's proof moment. The Creative also needs the receipt and the band to be the same paper |

Overlay on the band: the navbar stays Carbon Veil 85% over whatever is behind it. Over mint the composite is `#3d4341`, so every navbar text colour must be chosen for that worst case (section 9, N rows).

---

## 6. Kairos Marks as concrete visual rules

M1 to M10 are defined by the Creative. This section gives the exact geometry, colours and states, then the do and don't list. All marks use brief hexes only.

### 6.1 M1 entry head: number and graticule rule

```
 05   |-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
      ticks 00   01    02    03    04  [05]    06    07    08    09    10
```

| Property | Value |
| --- | --- |
| Row | `display: flex; align-items: center; gap: 16px; height: var(--lp-head-h)` (32px) |
| Number | Two digits, Caption (Inter 12px, 500, +0.6px, Moss 70 `#9cbf93`), `tabular-nums slashed-zero`, leading zero always, `min-width: 2ch` |
| Rule | Flex 1 to the container's right edge; 1px tall; Phosphor Blue-Black `#1f2a33` (1.4:1, decorative); vertically centred in the row |
| Ticks | 11 ticks, 1px wide, one per entry 00 to 10, at `left: calc(i / 10 * (100% - 1px))` for i = 0 to 10; centred vertically on the rule; Circuit Border `#485346`, 4px tall |
| Current tick | The tick for this entry: 8px tall, Phosphor White `#ddffdc` |
| Meaning | Every divider is a progress mark: the tall bright tick says which entry this is. A screen reader gets `aria-hidden` on rule and ticks; the number is real text and the entry `h2` carries the label |
| At 360 | Ticks stay at 11 positions; spacing is 30px at 328 content width (rule width about 280px, so 28px). Minimum gap between ticks is 24px, above the 1px tick width with no collision |
| Hero | Has the head too ("00"), 32px below the navbar |

### 6.2 M2 the post

The rule draws left to right on entry, `transform: scaleX(0)` to `scaleX(1)`, `transform-origin: left`, `var(--dur-post)` (600ms), `var(--ease-post)`, once. Ticks switch on with a step delay of `calc(var(--i) * 60ms)` (no tween), so they follow the line. The number is visible at once. The final state is the CSS default; the hidden start state is applied by JavaScript only to heads that are below the viewport at hydration. Heads already in view never animate. Reduced motion: drawn, no transition.

### 6.3 M3 posting square

| Property | Value |
| --- | --- |
| Size | 6px by 6px, radius 0 |
| Posted, kept, settled | Fill Phosphor White |
| Pending, open | 1px solid Circuit Border, transparent fill |
| Position | Immediately before the word (8px gap), vertically centred to the cap height, never alone, never replaces a word |
| Where | Entry 01 right cells, kept job cards, the active rail entry, the active segment of switches, entries in the tape dialog |
| Change | Fill 300ms colour transition (`--ui-duration`); no scale |

### 6.4 M4 citation chip

| Property | Value |
| --- | --- |
| Shape | Pill, `border-radius: 9999px`, height 24px, padding 4px 12px |
| Type | Inter 12px, 500, no uppercase, Phosphor White |
| Fill and border | Transparent; 1px Circuit Border |
| Content | `cites fact #07` or `cites #07, #11` (ids are tabular) |
| State | Non-interactive when inside a line; the line is the button. Highlighted state (when its fact is focused) changes the border to Phosphor White over 300ms |
| Placement | Ends the line, 8px after the last word, wraps with it |

### 6.5 M5 claim chip

Same pill as M4 with two differences that make it a link: the border is Fern Link `#859984` (`--chip-link-border: var(--link)`, 6.9:1, passing the 3:1 non-text rule that the Circuit Border cannot), and the text underlines on hover and focus. Text `see 05`. Accessible name "See entry 05, Send and receipt". Visual height 24px; a transparent `::before` with `inset: -10px 0` extends the hit area to 44px (A16) without moving neighbours (8px minimum spacing is measured between hit areas). Used on exactly six claims (Creative 10.6).

### 6.6 M6 sample mark

| Property | Value |
| --- | --- |
| Chip | `SAMPLE`, Inter 12px, 500, uppercase, +0.6px, Moss 70 (8.7:1 on Ground), pill, 1px Circuit Border, 24px tall |
| Position | Top right inside the panel, 16px from the top and right edges (12px below 768) |
| Edge | `border: var(--sample-border)` on the panel, radius 8px |
| Fill | Ground Iron |
| Rule | The dashed edge is never the only signal. The chip text, an accessible name that begins with "Sample" and the run line carry the meaning, because Circuit Border measures 2.2:1 on Ground and the brief forbids it from carrying meaning alone |
| Dashed means | Sample, or not real yet (ghost receipt outline). Nothing else on the page is dashed, including focus rings, dividers and decoration |

### 6.7 M7 perforation

| Property | Value |
| --- | --- |
| Drawing | A 1px tall block with `background-image: var(--lp-perforation-image)` (1px on, 3px off, repeating). A real `border-style: dotted` would give a 2px period, so the gradient is the implementation of "1px dotted at a 4px period" |
| Colour | Circuit Border on Void or Ground; `--on-mint-muted` on mint |
| Where | Exactly three places: the receipt (canvas and DOM, at the stub line), the top and bottom edges of the Mint Frost band, the rule above the footer |
| Not allowed | As a table rule, a card edge, a list divider or any decoration elsewhere |
| The tear line | On the DOM receipt the perforation sits 8px above the bottom edge with a 28px stub below it; on tear the stub translates 12px down and fades |

### 6.8 M8 signed, tabular, slashed numerals

| Rule | Detail |
| --- | --- |
| Feature | `font-variant-numeric: tabular-nums slashed-zero` on `.lp` |
| Credits | Signed and worded: `+25 credits`, `−1 credit`, `0 credits`. The minus is U+2212 |
| Money on receipts and the calculator | Two decimals: `$19.00`, `$0.00` |
| Price per application | Three decimals: `$0.048` |
| Ids | `#07`, `0417` |
| Colour | Credit signs are not coloured on the landing. A debit of one credit for a submitted application is normal, so `--bad` would mislead. Only status words (Submitted, Failed, Needs review, Not saved) take status colours |
| Alignment | Numeric table columns right-aligned; everything else left |
| Odometer | Digit columns are fixed 1ch wide and 1em tall, `translateY` only, `aria-hidden`; one visually hidden node holds the value |

### 6.9 M9 kairos stamp

| Property | Value |
| --- | --- |
| Box | Inline-block, 1px solid Phosphor White, radius 0, padding 4px 8px |
| Type | Caption size, Inter 12px, 500, not uppercase, `tabular-nums slashed-zero`, Phosphor White |
| On mint | 1px `--on-mint-ink` box, `--on-mint-ink` text |
| Content | A recorded time such as `Approved by you at 14:02`. Never a countdown, never "ago", never a running clock |
| Time source | Click handler or build-time constant, never render (01 section 3.4) |

### 6.10 M10 lime custody visuals

Covered in 5.3. The only visual addition: a custody candidate's label never changes while ownership moves, so the text does not reflow; only colour changes.

### 6.11 Supporting components that use the marks

| Component | Spec |
| --- | --- |
| Segmented switch (interval, sponsorship Yes or No, Motion Full or Reduced) | Outer: Ground fill, 1px Circuit Border, radius 8px, padding 4px. Segment: 44px tall minus padding = 36px visible, hit area 44px via a pseudo-element; text Inter 14px 500; inactive Sage 60 on Ground (7.0:1); active Carbon Veil fill, Phosphor White text, preceded by a filled posting square (M3). Radios are native `input[type=radio]` visually hidden; the label is the segment |
| Range | Track 2px Fern Link; filled part Phosphor White; thumb 12px by 24px, radius 0, Phosphor White, 2px Void outline so it reads over the filled track; the `<input>` is 44px tall; `accent-color: var(--foreground)` fallback; focus ring on the thumb |
| Select | `appearance: none`; Ground fill; 1px Fern Link; radius 8px; 44px tall; padding 0 40px 0 12px; caret is an inline SVG data URI in Phosphor White; focus as inputs (2px Phosphor White border plus 2px Moss 70 ring at 35%) |
| Number input | Same as select without the caret; `inputmode="numeric"` |
| Skip ledger row | 32px minimum, 1px Circuit Border bottom, row is a `<button aria-expanded>` with the posting square before the reason string, the count right-aligned in tabular numerals |
| Kept card | Ground fill, dashed edge, radius 8px, padding 32px (20 below 768); title Inter 20px 500; badge neutral outlined (`fit 82`, SAMPLE context); reasons Sage 60 14px |
| Diff line | Removed: Sage 40 with 1px strike in `--bad` at 60% (on Void only; Sage 40 is 4.7:1 there; if the diff sits on Ground, use Sage 60 plus the strike); Added: Phosphor White with the M4 chip |
| Credit ledger and tables | Circuit Border row rules, no zebra, header row in Sage 40 caption style on Void (on Ground use Moss 70) |
| FAQ summary | 56px tall, Inter 16px 500, plus sign drawn with two 1px bars that become a minus when open; open state changes colour only (Phosphor White to Moss 80) |
| Tape | 48px, Ground fill, 1px Circuit Border bottom, line in Inter 14px Sage 60 with the posting square before it |
| Rail | 24px column; numbers Caption Sage 60; active Phosphor White with a filled posting square |
| Receipt (DOM) | Mint paper, 0 radius, perforated top and stub line, header `KAIROS · RECEIPT · SAMPLE` Inter 12px 500 uppercase +0.08em in `--on-mint-ink`, rows min 32px with 1px `--on-mint-muted` rules, labels Caption in `--on-mint-muted`, values 14px `--on-mint-body`, width 384px at 1280 and wider (columns 5 to 8), full content width below 1024 up to 400px |

### 6.12 Logo

The landing logo is the existing 22px K mark with `rx="0"` and square linecaps: fill Phosphor White, glyph Void (A11). The brief's text calls the glyph an "A"; the file draws a K, which is the correct initial for Kairos, so the K stays and the brief text is corrected in A-list item C7. The wordmark "Kairos" is Inter 16px 500, Phosphor White, tracking -0.022em. The lime logo is kept for the favicon, extension icons and Open Graph image only.

### 6.13 Do and don't

| # | Do | Don't |
| --- | --- | --- |
| 1 | Show every number with its unit or sign: `−1 credit`, `$0.00`, `0 guessed` | Show bare numerals, or put a number in a decorative counter |
| 2 | Draw the entry rule once, left to right, then leave it | Loop, pulse or scrub a rule, or animate a rule in reverse |
| 3 | Use the posting square beside a word | Use a check mark, a tick icon or a coloured dot as a status symbol |
| 4 | Put `SAMPLE` plus a dashed edge on every demo | Show a real-looking metric, employer name or fit score without both |
| 5 | Name synthetic employers `Company 014` | Use a real company, a logo wall or a plausible fake brand |
| 6 | Use dashed only for sample or not-yet-real | Use dashed for dividers, focus, decoration |
| 7 | Use the dotted perforation in its three places | Use it as a table rule, a card edge or a background pattern |
| 8 | Keep the receipt flat, rectangular, 0px radius, with an unglowing mint paper | Add a drop shadow, glow, bloom, rounded corners, gradient or tilt while text is readable |
| 9 | Make lime a flat fill on one button at a time | Put lime on text, a logo, an icon, a chip, a border, a glow, a gradient or two buttons at once |
| 10 | Let Sage 60 step to Phosphor White for ink on the H1 (colour only) | Use gradient text, text outline, text glow, or lime words in the headline |
| 11 | Use Phosphor White on Void for headings and let size carry hierarchy | Use weight 600 or 700, or small caps, for emphasis |
| 12 | Left-align all copy; right-align numeric table columns | Centre headlines or body, or centre a hero stack |
| 13 | Show one honest open row (04) in an unsettled state | Mark all five rows settled, or hide the open one |
| 14 | Use the K logo mark in Phosphor White on the landing | Show a lime logo in the navbar next to an in-page lime button |
| 15 | Print status words with the colour: `Failed`, `Submitted` | Use colour alone, or use a green or red fill area |
| 16 | Use cards with a 1px hairline and no shadow | Stack double-bezel shells, glassmorphism panels, neon outlines |
| 17 | Keep motion to the named moves, each ending | Add idle sway, marquee, aurora, floating particles, cursor followers |
| 18 | Use native controls styled with tokens | Replace `select`, `range` and `details` with div widgets |

---

## 7. Product UI on the landing

### 7.1 Decision

Use live DOM replicas, built from the shared primitives and tokens, not screenshots and not the real dashboard components. Each replica is a static, props-driven demo component that renders the same markup patterns the app uses (table, row, badge, button, diff line), fed by synthetic data or by the generated `web/content/fit-sample.json` (P1).

| Option | Verdict | Reason |
| --- | --- | --- |
| Screenshots of the real app | Rejected for the landing | The app UI is still being built and a screenshot goes stale at every change; a screenshot cannot be interactive, cannot be reduced to text for screen readers, cannot respond to the Motion control, costs LCP and bytes (an AVIF per demo at 2x), and the demos need controls (range, selects, presets) |
| Importing the real dashboard components | Rejected | They fetch with react-query, need auth context and would add client JavaScript the mobile budget (15 KB) cannot afford |
| Live DOM replicas from shared primitives | Chosen | Text is real, crisp at any DPR, interactive, themable by token, measurable by axe, free of image weight, and honest when every one is labelled SAMPLE (A8) |

Constraints that keep replicas honest:

1. Every replica shows only controls and columns that exist in the product's spec (PRD, APP). A demo may not show a feature that has no row in `docs/01-prd.md`.
2. Every replica carries M6 (SAMPLE chip, dashed edge, accessible name beginning "Sample") and uses synthetic names (`Company 014`).
3. Replicas use the same classes as the app for shared primitives (`Button`, `Badge`, `Field`) so a token change updates both. They live in `web/components/landing/` and never import from `web/components/dashboard/`.
4. A parity review compares each replica with its real screen before launch (new gate G9 in section 12).
5. Where an image claims to be the real app (Chrome Web Store listing, press kit, any "this is the app" image), real screenshots are required (A8).

### 7.2 Replica map

| Entry | Replicates | Built from | Synthetic elements | Not shown |
| --- | --- | --- | --- | --- |
| 02 Sample run | Matches screen (list rows, fit badge) and the hard-rule filter | Panel, select, segmented radios, range, skip ledger row, kept card, Badge neutral | 48 postings from `fit-sample.json`, fit scores, reason lines for kept cards (labelled as written by us) | Real employers, real salary data, any rate or count presented as a result |
| 03 Truth lock | Application draft (resume diff with `cites N facts`) | Diff line, citation chip, facts list, radio presets, button | Four-line diff, four facts typed by kind | Metrics, employer names, free-text input |
| 04 Approve | Review queue row | Panel, diff summary, Button outlined, lime candidate button | One sample draft row, one editable answer | A bulk bar, a real queue |
| 05 Receipt | Sent application receipt table | Mint receipt table, compact slips, status words | Sample counts "14 fields", "7 answers" labelled sample | A real confirmation page |
| 06 Replies | Inbox | Three rows with status words | Application ids 0233 | Real sender names |
| 07 Billing | Billing credit ledger and plan cards | Table, segmented switch, plan cards (forked from `pricing-plans.tsx`), calculator | Dates shown as "sample" | Real invoices |
| 08 Compare | None (table) | Table | none | none |

### 7.3 Chrome around demos

No fake browser window, no traffic-light dots, no window title bar (the differentiation test against Modal bans code windows). A demo is a panel with a title row: left a Small title ("Sample run"), right the SAMPLE chip, then content. The panel header has a 1px Circuit Border bottom rule only when the panel has more than one section.

---

## 8. Iconography and imagery

### 8.1 Icons

| Rule | Spec |
| --- | --- |
| Library | `@phosphor-icons/react` (already a dependency). Server Components import from the SSR entry (`@phosphor-icons/react/dist/ssr`, verify the path against the installed version); client components from the main entry |
| Weight and size | Regular weight, 16 / 20 / 24px, stroke inherits `currentColor` |
| Allowed on the landing | Menu button (`List`, 24), close (`X`, 24), external-link marker (`ArrowUpRight`, 16) beside any link that leaves the site. Nothing else |
| Replaced by marks | Check marks in feature lists (use plain rows with hairline separators), status dots (use the posting square), arrow glyphs in CTAs (none; the label is enough), chevrons on `details` (use the CSS plus and minus bars) |
| Colour | Phosphor White, or Sage 60 for quiet affordances. Never lime. Never in Mint ink except where the mint band needs the external-link marker (then `--on-mint-ink`) |
| Targets | An icon-only control is 44 by 44px and has an `aria-label` |
| No feature-card icons | The page has no icon row, no icon-above-title grid, no emoji, no illustration |
| Inline SVG | Allowed for the logo, the citation trace path (1px stroke, `vector-effect: non-scaling-stroke`, Phosphor White at 60%), the lock bracket, the FAQ plus and minus, and the select caret |

### 8.2 Imagery

| Item | Policy |
| --- | --- |
| Hero poster | The only raster on the page. AVIF at most 40 KB with WebP fallback, explicit width and height, `fetchpriority="low"`, `decoding="async"`, rendered in the lane box. `alt=""` and `aria-hidden="true"`: the lane's `<aside aria-label="Sample receipt">` carries the same content as text |
| Open Graph image | 1200 by 630, Void, 64px Phosphor White headline, the receipt slip, the lime mark in one corner (brief). Not part of the page |
| Photography, stock, avatars, team photos | None |
| Illustration, isometric icons, 3D renders other than the single WebGL scene and its poster | None (A7 allows the poster only) |
| Gradients, mesh backgrounds, aurora, glow, bloom, film grain and noise overlays | None. The page is flat Void, Ground, Carbon and Mint |
| Logos of other companies, "as seen in" strips, customer logos | None, and the footer says so |
| Backgrounds | Solid colours only. No background images except the perforation and caret data URIs |
| Video | None |
| Cursor | Native. No follower, no custom glyph |
| Product screenshots | None on the landing (7.1) |
| Favicon and extension icons | Lime K mark (outside the page) |

---

## 9. Contrast table

Ratios computed with the WCAG 2.2 formula on 2026-10-15. "Req" is the requirement for the usage: 4.5 for normal text, 3 for large text (24px or 19px bold, which on this page means display, heading and numeral) and for non-text UI boundaries. "Decor" means the pairing never carries meaning and is exempt, which is a rule for the design, not an exemption from review. "Forbidden" means the pairing must not be used for text anywhere on the landing.

### 9.1 Text and UI on Void `#000000`

| ID | Foreground | Background | Landing use | Size | Req | Ratio | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1 | Phosphor White `#ddffdc` | Void | H1, H2, numerals, titles, button label | 16 to 104 | 4.5 | 19.41 | Pass |
| V2 | Sage 60 `#8cab87` | Void | Body, small, hero ink start state | 14 to 16 | 4.5 | 8.29 | Pass |
| V3 | Moss 70 `#9cbf93` | Void | Eyebrows, entry numbers, captions | 12 | 4.5 | 10.29 | Pass |
| V4 | Moss 80 `#aed2a4` | Void | Lead, navbar links | 14 to 20 | 4.5 | 12.55 | Pass |
| V5 | Sage 40 `#677d64` | Void | Table headers, removed diff lines, helper text | 12 to 14 | 4.5 | 4.69 | Pass (Void only) |
| V6 | Fern Link `#859984` | Void | Inline links, range track, chip border (link) | 14 to 16 | 4.5 and 3 | 6.89 | Pass |
| V7 | Deep Fern `#697368` | Void | Footer kairos definition (`aria-hidden`) | 12 | n/a | 4.25 | Decor only. Fails text AA, so it never carries meaning |
| V8 | Circuit Border `#485346` | Void | Hairlines, perforation, dashed edge, chip border (citation) | n/a | 3 | 2.60 | Decor. Never the only signal |
| V9 | Phosphor Blue-Black `#1f2a33` | Void | Navbar border, entry rule | n/a | n/a | 1.44 | Decor |
| V10 | Lime `#7fee64` | Void | Custody button boundary vs page | n/a | 3 | 14.32 | Pass |
| V11 | Good `#aed2a4` | Void | Status word "Submitted", "Saved" | 14 | 4.5 | 12.55 | Pass |
| V12 | Warn `#e8b84a` | Void | Status word "Needs review" | 14 | 4.5 | 11.39 | Pass |
| V13 | Bad `#ff8a80` | Void | Status words "Failed", "Not saved" | 14 to 16 | 4.5 | 9.20 | Pass |
| V14 | Void | Phosphor White | `::selection` | any | 4.5 | 19.41 | Pass |

### 9.2 On Ground Iron `#181818` (cards, panels, inputs, Default button, tape)

| ID | Foreground | Background | Landing use | Size | Req | Ratio | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | Phosphor White | Ground | Card titles, Default and fallback custody button label, card figures | 14 to 20 | 4.5 | 16.41 | Pass |
| G2 | Sage 60 | Ground | Card body, kept-card reasons, inactive segment | 14 to 16 | 4.5 | 7.01 | Pass |
| G3 | Moss 70 | Ground | SAMPLE chip, panel captions, headers | 12 | 4.5 | 8.70 | Pass |
| G4 | Moss 80 | Ground | Panel leads | 14 to 20 | 4.5 | 10.62 | Pass |
| G5 | Sage 40 | Ground | not used | n/a | 4.5 | 3.97 | **Forbidden** on Ground |
| G6 | Fern Link | Ground | Input and select borders, link chip border | n/a | 3 | 5.82 | Pass |
| G7 | Circuit Border | Ground | Card hairline, dashed edge, citation chip border | n/a | 3 | 2.20 | Decor. Meaning is always also in text |
| G8 | Good / Warn / Bad | Ground | Status words inside panels | 14 | 4.5 | 10.62 / 9.63 / 7.78 | Pass |
| G9 | Lime | Ground | Custody button (when the button sits on a Ground card, e.g. Choose Pro) vs card | n/a | 3 | 12.10 | Pass |
| G10 | Void | Lime | Custody label | 16 | 4.5 | 14.32 | Pass |
| G11 | Void | Accent hover `#6ddb57` | Custody label on hover | 16 | 4.5 | 11.92 | Pass |

### 9.3 On Carbon Veil `#212525` (hover fills, active segment, rail card)

| ID | Foreground | Background | Landing use | Size | Req | Ratio | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Phosphor White | Carbon | Active segment, hover label, rail card title | 14 | 4.5 | 14.32 | Pass |
| C2 | Sage 60 | Carbon | Rail card secondary text | 12 to 14 | 4.5 | 6.11 | Pass |
| C3 | Moss 70 | Carbon | Rail card number | 12 | 4.5 | 7.59 | Pass |
| C4 | Moss 80 | Carbon | Nav link on hover fill | 14 | 4.5 | 9.26 | Pass |
| C5 | Fern Link | Carbon | Focus-ring input border on Carbon | n/a | 3 | 5.08 | Pass |
| C6 | Sage 40 | Carbon | not used | n/a | 4.5 | 3.46 | **Forbidden** |
| C7 | Circuit Border | Carbon | none | n/a | n/a | 1.92 | Decor, not used for any boundary |
| C8 | Bad | Carbon | Not used | 14 | 4.5 | 6.78 | Pass, not needed |

### 9.4 Navbar (Carbon Veil at 85% over the page, worst cases)

The navbar background is the composite of Carbon Veil at 85% and whatever is behind it. Over Void it is `#1c1f1f`; over Mint Frost (the page scrolled through the band) it is `#3d4341`.

| ID | Foreground | Background | Landing use | Size | Req | Ratio | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N1 | Phosphor White | `#1c1f1f` (over Void) | Wordmark, hover label | 14 to 16 | 4.5 | 15.34 | Pass |
| N2 | Phosphor White | `#3d4341` (over Mint) | Wordmark, hover label | 14 to 16 | 4.5 | 9.34 | Pass |
| N3 | Moss 80 | `#1c1f1f` | Nav links, Log in | 14 | 4.5 | 9.92 | Pass |
| N4 | Moss 80 | `#3d4341` | Nav links over the band | 14 | 4.5 | 6.04 | Pass |
| N5 | Sage 60 | `#3d4341` | not used | 14 | 4.5 | 3.99 | **Forbidden** (this is why nav links are Moss 80, not Sage 60) |
| N6 | Moss 70 | `#3d4341` | Caption "05 / 10" | 12 | 4.5 | 4.95 | Pass |
| N7 | Lime | `#1c1f1f` / `#3d4341` | Navbar CTA boundary when it owns custody | n/a | 3 | 11.32 / 6.89 | Pass |

### 9.5 On Mint Frost `#def0dd` (entry 05 band and every receipt)

| ID | Foreground | Background | Landing use | Size | Req | Ratio | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | `--on-mint-ink` `#000000` | Mint | H2, figures, receipt header, links, focus ring, outlined button | 12 to 56 | 4.5 | 17.61 | Pass |
| M2 | `--on-mint-body` `#181818` | Mint | Receipt rows, band body copy | 14 to 16 | 4.5 | 14.89 | Pass |
| M3 | `--on-mint-muted` `#485346` | Mint | Receipt labels, captions, rules, perforation, dashed edge | 12 to 14 | 4.5 | 6.77 | Pass (on mint only) |
| M4 | `--on-mint-good` `#3d6b21` | Mint | Word "Submitted" | 14 | 4.5 | 5.30 | Pass |
| M5 | `--on-mint-warn` `#8a5a00` | Mint | Word "Needs review" if shown | 14 | 4.5 | 4.97 | Pass |
| M6 | `--on-mint-bad` `#a3261c` | Mint | Word "Failed" | 14 | 4.5 | 6.18 | Pass |
| M7 | Mint | `--on-mint-body` `#181818` | Hover fill of outlined-on-mint button | 14 to 16 | 4.5 | 14.89 | Pass |
| M8 | Mint | Void | Band edge against the page | n/a | 3 | 17.61 | Pass |
| M9 | Mint | Ground | Mint receipt on a Ground panel | n/a | 3 | 14.89 | Pass |
| M10 | Fern Link | Mint | not used | any | 4.5 | 2.56 | **Forbidden** |
| M11 | Sage 60 | Mint | not used | any | 4.5 | 2.12 | **Forbidden** |
| M12 | Phosphor White | Mint | not used | any | 4.5 | 1.10 | **Forbidden** |
| M13 | Moss 70 / Moss 80 / Good `#aed2a4` | Mint | not used | any | 4.5 | 1.71 / 1.40 / 1.40 | **Forbidden** |

Printed lines in the WebGL texture use Void ink on the flat mint face (17.6:1). Where the paper curls toward Circuit Border the ink falls to about 2.7:1; this is why lines are only printed on a flattened slip (04).

### 9.6 Interactive state pairings

| ID | State | Pairing | Ratio | Result |
| --- | --- | --- | --- | --- |
| S1 | Focus ring on Void or Ground | 2px Phosphor White vs Void / Ground | 19.41 / 16.41 | Pass (3:1 needed) |
| S2 | Focus ring on mint | 2px Void vs Mint | 17.61 | Pass |
| S3 | Default button hover | Phosphor White on Carbon | 14.32 | Pass |
| S4 | Input focus | 2px Phosphor White border plus Moss 70 ring at 35% on Ground | 16.41 | Pass |
| S5 | Disabled | 50% opacity, exempt from AA; `aria-disabled` plus visible text elsewhere ("Approved by you at 14:02") conveys the state | n/a | Pass by redundancy |
| S6 | Pro card border | Phosphor White vs Void | 19.41 | Pass |
| S7 | Range thumb | Phosphor White vs Ground | 16.41 | Pass |
| S8 | Hero ink, frame 0 | Sage 60 on Void (before stepping to Phosphor White) | 8.29 | Pass; readable before any animation |
| S9 | Danger fill (app only, not on the landing) | Phosphor White on `#a3261c` | 6.81 | Pass |

### 9.7 Rules derived from the table

1. Sage 40 appears only on Void. Never on Ground, Carbon or any card.
2. Deep Fern, Circuit Border and Phosphor Blue-Black never carry meaning. The dashed sample edge, the perforation and the citation chip border are therefore always accompanied by text.
3. On the Mint band only the six on-mint tokens are used for text, rules and status.
4. Navbar text is Moss 80 or Phosphor White.
5. Any new pairing needs a row in this table before use.

---

## 10. Brief amendments, ready to paste

Paste the following section into `docs/04-ui-ux-brief.md` after "Conflicts resolved" and before "Open items". A1 to A18 restate the Creative's amendments in brief-ready wording; A19 to A24 are new in this document; C1 to C8 are app-wide clarifications that are not landing exceptions. Also mark open item 2 as resolved by `docs/superpowers/specs/2026-10-15-kairos-landing-design/02-design-system.md` section 1.2.

```markdown
## Landing amendments (route `/` only)

The signed-in app and every other route keep this brief exactly. The amendments below apply to the landing page
(`web/app/(public)/page.tsx` and `web/components/landing/**`) and are scoped by the `.lp` class. Landing-only
tokens are declared in `web/components/landing/landing.css`, not in `globals.css`.

| # | Brief rule | Landing amendment | Why |
| --- | --- | --- | --- |
| A1 | Display 64px / 1.0, -0.448px | `--type-display-landing`: clamp(3rem, 1.25rem + 5.6vw, 6.5rem), 48 to 104px, line height 0.95, -0.025em | Award-scale hero; weights stay 400 and 500 so size carries hierarchy |
| A2 | Heading large 42px | `--type-heading-landing` 36 to 56px; prices use `--type-numeral-landing` 40 to 64px | Entry titles must hold against the receipt lane |
| A3 | Motion is utility only: 300ms ease-out on colour | Adds the named moves ink, post, print, feed, tear, travel, hand-off and retract, with named curves, scroll-linked scene poses and kinetic type. Every move ends | Locked decision: expressive landing |
| A4 | Page sections fade in once | Sections do not fade. Entry rules draw, titles below the fold rise, body text has no entrance | Fade-up on everything is a cliche |
| A5 | No springs, no infinite or ambient animation | The ban is lifted for the landing and deliberately unused: no springs, no overshoot, no loops. Pointer tilt is critically damped and reactive only | "Every motion ends" is the brand idea |
| A6 | No 3D hero art; no hero imagery in v1 | One WebGL receipt object in the hero lane and through the story | Locked decision: exactly one WebGL centerpiece |
| A7 | Not used: 3D renders | A pre-rendered poster of the WebGL scene is its loading and tier-0 state | Keeps LCP on text |
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

## 11. Names other documents must use

### 11.1 CSS custom properties (app-wide, in `:root`)

`--background`, `--surface`, `--surface-raised`, `--mint`, `--foreground`, `--body`, `--muted`, `--label`, `--lead`, `--link`, `--micro`, `--border`, `--divider`, `--accent`, `--accent-hover`, `--accent-ink`, `--good`, `--warn`, `--bad`, `--danger-fill`, `--r-card`, `--r-button`, `--r-pill`, `--shadow-navbar`, `--ui-duration`, `--ui-ease`. Legacy: `--obsidian`, `--smoke`, `--line`, `--subtle`, `--accent-soft`.

Tailwind utilities: `bg-background`, `bg-surface`, `bg-surface-raised`, `bg-mint`, `text-foreground`, `text-body`, `text-faint`, `text-label`, `text-lead`, `text-link`, `text-micro`, `border-border`, `border-divider`, `bg-accent`, `bg-accent-hover`, `text-accent-ink`, `text-good`, `text-warn`, `text-bad`, `bg-danger-fill`, `rounded-card`, `rounded-button`, `rounded-pill`, `font-sans`, `font-display`. Legacy kept during migration: `text-muted`, `text-subtle`, `border-line`.

### 11.2 Landing tokens (only inside `.lp`)

Pinned by the Creative: `--type-display-landing`, `--type-heading-landing`, `--type-numeral-landing`, `--rule-rhythm`, `--sample-border`, `--perforation`, `--receipt-paper`, `--on-mint-ink`, `--on-mint-body`, `--on-mint-muted`, `--ease-post`, `--ease-feed`, `--ease-travel`, `--ease-tear`, `--ease-retract`, `--dur-ink`, `--dur-print`, `--dur-post`, `--dur-tear`, `--dur-handoff`, `--receipt-lane`, `--section-pad-landing`.

Added here: `--type-lead-landing`, `--type-title-landing`, `--type-body-landing`, `--type-small-landing`, `--type-caption-landing`, `--lh-display-landing`, `--lh-heading-landing`, `--lh-numeral-landing`, `--tracking-display-landing`, `--tracking-heading-landing`, `--tracking-numeral-landing`, `--measure-body`, `--measure-title`, `--on-mint-good`, `--on-mint-warn`, `--on-mint-bad`, `--lp-perforation-image`, `--lp-perforation-image-mint`, `--lp-dur-custody` (150ms), `--lp-dur-retract` (240ms), `--lp-dur-odometer` (240ms), `--lp-container`, `--lp-cols`, `--lp-gap`, `--lp-margin`, `--lp-navbar-h`, `--lp-tape-h`, `--lp-hit`, `--lp-hit-gap`, `--lp-head-h`, `--lp-z-canvas`, `--lp-z-content`, `--lp-z-rail`, `--lp-z-tape`, `--lp-z-navbar`, `--lp-z-dialog`, `--lp-z-skip`, `--chip-link-border`.

### 11.3 Scope and state attributes

| Name | Meaning |
| --- | --- |
| `.lp` | Landing scope class; must wrap navbar, main and footer on `/` |
| `html[data-lime-owner]` | Values: `approve`, `hero`, `pro`, `closing`, `navbar`. Server default `hero` |
| `[data-lime-candidate]` | Values: `approve`, `hero`, `pro`, `closing`, `navbar`, `navbar-sheet` |
| `html[data-motion]` | `full` or `reduced`; zeroes the named durations |
| `[data-surface="mint"]` | Mint Frost band and receipt scope (ink tokens, `color-scheme: light`) |
| `[data-lane]`, `[data-slot="receipt"]` | Lane and slot measured by the scene (Creative 4.1, 4.6) |
| `[data-claim]` | Claim register hook (Creative 10.5) |

### 11.4 Landing CSS classes (reserved, prefix `lp-`)

`lp-container`, `lp-grid`, `lp-entry`, `lp-head`, `lp-head-num`, `lp-head-rule`, `lp-head-tick` (with `aria-current` or `data-current` on the current one), `lp-display`, `lp-heading`, `lp-numeral`, `lp-lead`, `lp-title`, `lp-body`, `lp-small`, `lp-caption`, `lp-receipt-row`, `lp-nav`, `lp-faq-q`, `lp-btn`, `lp-chip` (modifiers `lp-chip--cite`, `lp-chip--claim`, `lp-chip--sample`), `lp-post` (posting square, modifier `lp-post--pending`), `lp-stamp`, `lp-panel` (sample panel), `lp-seg` (segmented switch), `lp-range`, `lp-select`, `lp-lane`, `lp-poster`, `lp-mint` (band), `lp-receipt`, `lp-perf` (perforation rule), `lp-tape`, `lp-rail`.

### 11.5 Component and file paths

`web/app/globals.css` (app-wide tokens), `web/components/landing/landing.css` (landing tokens and classes), `web/components/landing/landing-shell.tsx` (adds `.lp`), `web/app/layout.tsx` (fonts). Font CSS variables: `--font-inter`, `--font-inter-tight`. Tailwind font utilities: `font-sans`, `font-display`.

### 11.6 Type roles and fixed values for copy and motion

Type role ids: display, heading, numeral, lead, title, body, small, caption, receipt-row, button, nav, faq-question. Hero H1 colour start state: Sage 60 `#8cab87`. Ink end: Phosphor White `#ddffdc`. Entry head height: 32px. Touch target: 44px with 8px gap.

### 11.7 Section ids (unchanged from the Creative)

`navbar`, `ledger-rail`, `entry-00-hero`, `entry-01-reported`, `entry-02-fit-gate`, `entry-03-truth-lock`, `entry-04-approve`, `entry-05-send-receipt`, `entry-06-replies`, `entry-07-billing`, `entry-08-compare`, `entry-09-questions`, `entry-10-start`, `footer`. Scene state ids: `slip-open`, `slip-recede`, `slip-feed`, `slip-cite`, `slip-hold`, `slip-tear`, `ghost-path`, `slip-reply`, `slip-fresh`.

---

## 12. Open questions and risks

| # | Item | Needed from | Default if unanswered |
| --- | --- | --- | --- |
| Q1 | Canvas cannot render `zero` or `tnum` (2.3). Accept the difference between canvas and DOM zeros during the hand-off? | 04 WebGL | Accept; do not print `0` in a canvas line where the slash matters |
| Q2 | Does `Inter_Tight` in Google's latin subset keep `ss01`, and do Inter and Inter Tight keep `zero` and `cv11`? (gate G2) | Build check | Render without `ss01` and `slashed-zero`; copy already carries units |
| Q3 | Mechanism for wrapping navbar, main and footer in `.lp` on `/` while `(public)/layout.tsx` is shared by other routes | 05 | A `(landing)` route group with its own layout is the cleanest. A fallback is the same attribute set on `<html>` by the inline script when the pathname is `/` |
| Q4 | Hero H1 line count at 360 to 389 (2.3 and 3.3) decides whether the CTA stays above the fold at 375 by 667 | Design lock measurement | If three lines push the CTA below the fold, the display floor drops from 48px to 44px (0.25rem lower in `clamp`), which is a change to the pinned token and needs Creative sign-off |
| Q5 | Phosphor `dist/ssr` import path and tree-shaking in the installed version | 05 | Fall back to inline SVG for the three allowed icons |
| Q6 | Mint band status tokens (A20) are new colour roles built from old brief hexes | Product owner | If rejected, drop status colours on the band and use the words only, in `--on-mint-ink` |
| Q7 | Claim chips with a Fern Link border (A24) differ from the Creative's "same pill" | Creative owner | Keep: a link affordance needs 3:1 |
| Q8 | Custody buttons keep the pill shape when not lime (A19) | Product owner | Keep; otherwise the hand-over would morph shape |
| Q9 | Navbar link colour Moss 80 (C1) changes the app navbar too | Product owner | Keep; the app and landing share one navbar |
| Q10 | The existing `PricingPlans` component (shared with `/pricing`) has a lime interval switch, a lime "Most chosen" badge and `rounded-2xl` cards | 05 | Fix once for both routes per the migration table; the landing forks the card markup but reuses the data from `shared/src/plans.ts` |
| Q11 | G9 (new gate): each product replica reviewed against the real screen before launch; any control without a PRD row is removed | Web owner | Required before launch |

Risks and mitigations:

| Risk | Mitigation |
| --- | --- |
| Two fonts preloaded add 81 KB to first load | Within the 1.0 MB budget; LCP stays on text. Measure with the bundle analyzer on the first build |
| Dark migration changes 30 routes at once | The alias block keeps every utility resolving; review routes in the order auth, public, legal, dashboard; the first commit touches six files only |
| Sage 40 slipping onto cards through the legacy `text-subtle` alias | Audit of the five uses is part of the first commit; contrast row G5 and C6 are marked Forbidden for review |
| Two lime elements through an edge case (menu sheet, partial visibility) | Rules L7 and L10, plus the Playwright check with the sheet open |
| Perforation and dashed edge rendering differ between browsers | The perforation uses a gradient (identical everywhere); the dashed edge uses `border-style: dashed`, whose dash length varies slightly by engine, which is acceptable for a decorative edge that always carries a text label |
| Canvas slip colour and DOM receipt colour drift | Both use `--receipt-paper` / `#def0dd`; the 04 palette test asserts that hex |
