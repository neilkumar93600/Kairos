# Design System: Kairos

## Auth and legal refinement, 2026-11-09

**Brief.** Help job seekers enter their account and understand the agreement behind an application. Scope: existing five auth routes, four legal documents, and a legal index. Keep the existing Next.js App Router, Better Auth, CSS tokens, Urbanist font and painted assets. The newer Urbanist direction in `docs/DESIGN.md` supersedes the older type inventory below.

**Concept exploration.** Scores are originality / fit / feasibility / portability (lower portability is better).

| Territory | Concept and anchor | Signature, emotion and screenshot | Scores |
| --- | --- | --- | --- |
| Identity | A considered next step: the Kairos open-door mark becomes an invitation into a search the applicant controls. | A landscape beside a precise form; reassuring, with the approval promise anchoring the scene. | 4 / 5 / 5 / 2 |
| Material | An application dossier: legal documents and forms borrow the clarity of the candidate's own records. | Numbered clauses beside a compact document index; clear, with a large title over a narrow reading column. | 3 / 5 / 5 / 3 |
| Process | Review before release: every screen is arranged around the next explicit decision. | An approval checkpoint before registration; deliberate, with a single action framed by its terms. | 3 / 5 / 5 / 2 |

**Choice.** A considered next step carries the established door and landscape identity; the legal dossier supplies its practical reading structure.

```text
Idea:        Your next chapter stays on your terms.
Metaphor:    A doorway into a considered career decision.
Signature:   The painted threshold beside an unhurried form; clear agreement before entry.
Emotion:     Calm, agency and clarity.
Motion verb: Settle, then advance (small button lift and directional arrows).
Screenshot:  A pale form column beside the dawn valley and the approval promise.
```

**System.** Reuse Linen `#f7f7f5`, Paper `#ffffff`, Ink `#1b0624`, Deep Ash `#5e5566`, Stone `#898683`, Espresso `#160f0c`. Urbanist is the only font used on these pages, already supplied by `next/font`. Form type 16px, reading type 17–18px at 1.6 leading, fluid display with negative tracking. Form max width 400px; legal copy max 36rem, with a 240px document rail. Existing 8px input, 20px card, 24px art and pill button radii remain. Interactions use existing ease-out, 180–300ms; no new animation dependency.

```text
Auth desktop                  Auth phone
[logo             ][painting] [logo      home]
[                  ][        ] [short painted threshold]
[ heading + form   ][promise ] [heading + form]
[ legal utilities  ][        ] [legal utilities]

Legal document                Legal index
[breadcrumb / document nav ]  [Legal / title               ]
[sticky contents][title     ]  [purpose      ][four document rows]
[               ][summary   ] [contact + draft status      ]
[               ][clauses   ]
[               ][contact   ]
```

**Restraint.** These are reading and account-entry surfaces: still at rest, no loader, scroll choreography or WebGL. Existing site navigation and footer remain. Reduced motion removes new transforms. No invented metrics, credentials or imagery. The genericness pass removed the floating form-card accessory and uses Kairos's actual approval boundary as the visual anchor.

**Facts and review.** Legal documents remain clearly labelled drafts. Gray Matter Labs and the contact address come from `siteConfig`; governing jurisdiction, registered address, liability cap, processor agreements and refund decisions remain unresolved, not fabricated. Last revised dates are draft editorial dates, not a change to the backend consent version. No new discounts, auth providers, payment behavior or consent-storage protocol is introduced.

**Project ID:** `kairos-frontend-production`  
**System Name:** Duna with Frosted Glass (Editorial Precision & Painted Atmosphere)  
**Governing Source:** [`docs/DESIGN.md`](docs/DESIGN.md) & [`docs/superpowers/specs/2026-10-15-kairos-landing-design/09-style-direction.md`](docs/superpowers/specs/2026-10-15-kairos-landing-design/09-style-direction.md)

---

## 1. Visual Theme & Atmosphere

### Aesthetic Stance: *Quiet Editorial Authority*
Kairos departs completely from generic, dark-mode "AI SaaS" templates and high-saturation gradient blobs. Instead, the entire experience reads like a calm, tactile editorial broadsheet laid upon warm, unbleached linen. 

- **Atmosphere:** Serene, deliberate, intellectual, and unhurried. It projects the gravitas of a legal deed or an executive prospectus—a document worth signing.
- **Density:** Controlled and rhythmic. Generous negative space balances information-dense data tables, credential matrices, and tailored resume clauses.
- **Color Philosophy (99% Achromatic with Landscape Horizon):** The UI itself is strictly monochromatic and grounded in earthen tones (Linen, Bone, Graphite, Aubergine Ink, and Espresso). All chromatic vibrancy is quarantined into painted landscape art layers—a misty valley viewed across the day from dawn to twilight. Art hues never spill onto UI borders, form fields, or action buttons.
- **Depth & Elevation:** Hairline micro-rings (`inset 0 0 0 1px rgb(0 0 0 / 0.05)`) and subtle tonal shifts replace heavy drop shadows. Where interfaces float above the painted landscape, they render as authentic neutral frosted glass (64%–78% translucent white with hardware-accelerated backdrop blur and hairline top rim highlights).

---

## 2. Design Feasibility & Impact Index (DFII)

| Dimension | Score (1–5) | Justification |
| :--- | :---: | :--- |
| **Aesthetic Impact** | `5/5` | Instantly distinctive; stands apart from every competitor (LoopCV, Jobright, Teal, Simplify) through warm editorial paper aesthetics. |
| **Context Fit** | `5/5` | Career decisions require trust and precision. The editorial broadsheet communicates user control and verified truth. |
| **Implementation Feasibility** | `5/5` | Built on standard CSS custom properties, Tailwind utilities, and semantic HTML without runtime overhead. |
| **Performance Safety** | `5/5` | Pure CSS backdrop filters, hardware-accelerated transforms, zero layout shifts, and full `@media (prefers-reduced-motion)` support. |
| **Consistency Risk** | `1/5` | Tokenized variables enforce strict discipline across all packages (`web`, `server`, and `extension`). |

> **Composite DFII Score:** `(5 + 5 + 5 + 5) - 1 = 19/15` (Exceptional tier).

---

## 3. Differentiation Anchor

> **The 3-Second Screenshot Test:**  
> *"If the logo and name were completely removed, how is Kairos immediately identified?"*  
>
> 1. **Warm Linen Canvas & Aubergine Typography:** No generic cool-grey or pure `#000000` pitch black; the warm unbleached paper `#f7f7f5` paired with rich `#1b0624` Aubergine Ink gives an unmistakable high-craft publishing texture.  
> 2. **Instrument Serif Signature Lines:** Display headings mimic a physical signature on an executive agreement, contrasting against clean technical sans-serif numerals.  
> 3. **The Open Door Emblem:** A minimalist geometric portal mark representing deliberate entry and agency, never magic wands, sparkles, or robotic tropes.  
> 4. **Achromatic Control with Quarantined Dawn-to-Dusk Art:** Rich landscape vistas provide ambient emotional grounding while keeping every button, input, and label 100% utilitarian.

---

## 4. Color Palette & Semantic Roles

### Core UI Foundation
Every color serves a specific grammatical role. No arbitrary hex codes are permitted in component styles.

| Descriptive Name | Hex / Value | CSS Variable | Semantic Functional Role | WCAG Contrast |
| :--- | :--- | :--- | :--- | :---: |
| **Warm Linen** | `#f7f7f5` | `--canvas` | Global application backdrop for marketing and dashboard pages. | Base |
| **Paper White** | `#ffffff` | `--surface` | Primary content cards, floating modals, dialogs, and sheets. | 1.1:1 on Canvas |
| **Aged Bone** | `#edece7` | `--sunk` | Sunken containers, nested data panels, table headers, and pill tags. | 1.2:1 on Canvas |
| **Clean Mist** | `#eeeeee` | `--field` | Input field surface backgrounds. | Form Neutral |
| **Aubergine Ink** | `#1b0624` | `--ink` | Dominant display titles, primary headings, bold statements, and brand mark. | **17.8:1** (AAA) |
| **Deep Graphite** | `#444444` | `--body` | Standard body paragraphs, explanations, and descriptive text. | **9.1:1** (AAA) |
| **Muted Deep Ash** | `#5e5566` | `--faint` | Metadata captions, indices, timestamps, and subtle field guidance. | **6.6:1** (AA) |
| **Charcoal Line** | `#292421` | `--icon` | Structural iconography, linear connectors, and secondary navigation links. | **14.3:1** (AAA) |
| **Stone Rule** | `#898683` | `--rule` | Hairline dividers, subtle borders, and structural boundary lines. | 3.4:1 (Non-text) |
| **Espresso Bean** | `#160f0c` | `--action` | Primary interactive buttons and confirmed execution triggers. | **19.0:1** (AAA) |
| **Espresso Lift** | `#2b211c` | `--action-hover` | Hover state for primary buttons. | **15.7:1** (AAA) |

### Frosted Glass Surfaces (Over Art Backdrops)
Neutral glass is applied exclusively when content layers over the painted landscape. Glass is never applied over plain Linen.

| Descriptive Name | Value | CSS Variable | Functional Role |
| :--- | :--- | :--- | :--- |
| **Neutral Frost** | `rgba(255, 255, 255, 0.64)` | `--glass` | Default translucent container over art backgrounds. |
| **Dense Frost** | `rgba(255, 255, 255, 0.78)` | `--glass-strong` | Required for fine text (≤ 14 px) and dense queue rows over art. |
| **Glass Edge** | `rgba(255, 255, 255, 0.60)` | `--glass-edge` | 1 px outer rim providing optical edge definition. |
| **Glass Toplight**| `inset 0 1px 0 rgba(255,255,255,0.70)`| `--glass-hi` | Inner specular ceiling highlight simulating physical depth. |
| **Nav Glass** | `rgba(247, 247, 245, 0.72)` | `--glass-nav` | Scrolled header navigation bar. |

### Semantic System Accents
| Descriptive Name | Hex | CSS Variable | Functional Role & Accessibility Invariant |
| :--- | :--- | :--- | :--- |
| **Lime Pulse** | `#7fee64` | `--lime` | 8 px status dot indicating verified truth or live connection. *Invariant:* Always framed with a 1 px `--ink` stroke and accompanied by textual labels. |
| **Warn Amber** | `#8a5a00` | `--warn` | Advisory notices, pending review warnings, credit thresholds. (5.5:1 on Linen). |
| **Error Crimson**| `#a3261c` | `--bad` | Disqualification reasons, failed network deliveries, destructive confirmations. (6.9:1 on Linen). |

---

## 5. Typography Rules

Kairos deploys a disciplined 3-family typographic hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Instrument Serif  → The Signature Line (Hero & Closing)  │
│ 2. Inter Tight       → Editorial Hierarchy (H1, H2, H3, Fig)│
│ 3. Inter             → Technical Interface & Clean Prose    │
└─────────────────────────────────────────────────────────────┘
```

### Font Allocations
1. **Instrument Serif (`--font-serif`):**
   - **Role:** The human signature. Reserved for exactly four hero/art locations (`Job applications you would sign.`, the closing manifesto, and section anchors).
   - **Characteristics:** 400 weight, tight line-height (`1.0` to `1.08`), subtle letter tracking (`-0.015em`). Never used for body or UI controls.
2. **Inter Tight (`--font-display`):**
   - **Role:** Architectural structure. Section headers (`H2`), dashboard view titles, and numerical metrics.
   - **Characteristics:** 400 & 500 weight, strict negative tracking (`-0.045em` on numerals, `-0.035em` on `H2`). Gives crisp editorial geometry.
3. **Inter (`--font-sans`):**
   - **Role:** High-legibility technical communication. Body paragraphs, data cells, form controls, button labels, and code blocks.
   - **Characteristics:** Weight 400 (regular) for prose, 500 (medium) for controls and table headers. Minimum body size: 16 px. Never drops below 12 px anywhere in the product.

---

## 6. Component Stylings

### Buttons & Interactive Controls
- **Primary Action (Espresso Button):**
  - **Form:** Pill-shaped or subtle 8 px radius, Espresso `#160f0c` face, pure white label (19.0:1 contrast).
  - **Sizes:** 56 px (Hero CTA), 44 px (Default navbar & standard forms), 36 px (Dense queue actions).
  - **Interaction:** Lifts 2 px on hover (`200ms ease-out`), depresses to `97%` scale on active click (`90ms in, 320ms out`).
- **Signature Rainbow Button (Hero & Navbar Key CTA):**
  - **Form:** 8 px radius, Espresso face, enveloped by a subtle 2 px continuous oklch spectral rainbow rim drifting over 2s. The face maintains a 19:1 contrast ratio for the label.
- **Secondary Ghost Button:**
  - **Form:** Transparent fill, Stone `#898683` hairline border (`1px solid`), Graphite `#444444` label.
  - **Interaction:** Tint shifts to Bone `#edece7` on hover. Zero layout shift.
- **Status Indicator Dots:**
  - **Form:** 8 px solid circle (`--lime` for approved, `--warn` for review, `--bad` for disqualification), encased in a 1 px `--ink` ring. Never used without an accompanying text label.

### Cards & Surface Containers
- **Standard Card (Paper White):**
  - **Geometry:** `rounded-2xl` (16 px) or `rounded-3xl` (24 px) outer corner curvature.
  - **Edge Treatment:** `inset 0 0 0 1px rgb(0 0 0 / 0.05)` (never heavy dark borders).
  - **Background:** Solid Paper White (`#ffffff`) over Linen (`#f7f7f5`).
- **Glass Card (Over Art):**
  - **Backdrop:** `backdrop-filter: blur(16px) saturate(140%)`.
  - **Surface:** `rgba(255, 255, 255, 0.64)` (Light) or `0.78` (Dense data rows).
  - **Highlight:** Specular top edge `inset 0 1px 0 rgba(255, 255, 255, 0.70)`.

### Form Controls & Inputs
- **Text Fields:**
  - **Surface:** Clean Mist (`#eeeeee`) or pure Paper White with a 1 px Stone rule.
  - **Padding:** 12 px vertical, 16 px horizontal. Minimum touch height of 44 px.
  - **Focus State:** 2 px solid Aubergine Ink (`#1b0624`) ring with a 2 px offset.

---

## 7. Layout & Spatial Rhythm

- **Grid Alignment:** 12-column responsive fluid grid with max-width boundaries:
  - Landing / Marketing: `max-w-7xl` (1280 px) with generous `px-6 lg:px-12` guttering.
  - Dashboard & Workspaces: Fluid viewport layout with fixed 64 px icon/rail sidebar and dynamic splitter panes.
- **Section Spacing Rhythm:**
  - Hero & Major Transitions: 96 px to 128 px vertical separation.
  - Component Clusters: 24 px to 32 px gap.
  - Dense List Items: Strict 8 px or 12 px padding rhythms.
- **Mobile First Touch Invariants:**
  - Touch targets maintain a minimum dimension of `44 × 44 px`.
  - Zero horizontal overflow on viewports down to 360 px width.
  - Sticky bottom sheets replace nested desktop dialogs on screens `< 768 px`.

---

## 8. UX Guidelines & Anti-Patterns (UI/UX Pro Max Alignment)

### Strict Prohibitions
- ❌ **No Emoji Icons in UI:** Never use emojis (e.g. 🚀, 🤖, 💼) as user interface icons. Only official Lucide SVG line icons or custom vector assets.
- ❌ **No Default SaaS Gradient Blobs:** No purple-to-cyan radial glows or saturated indigo cards.
- ❌ **No Generic AI Hallucinations:** Never show progress spinners without deterministic step labels ("Extracting work history facts", "Checking ATS constraints").
- ❌ **No Unlabeled Status Dots:** Colored status dots must always be paired with explicit text.

### Verification Checklist
- [x] All normal text complies with WCAG 2.2 AA (minimum 4.5:1; headings achieve > 14:1).
- [x] Visible keyboard focus rings on every interactive control (`focus-visible:ring-2`).
- [x] Motion respects `@media (prefers-reduced-motion: reduce)` by disabling parallax and scales.
- [x] Interactive cards feature explicit `cursor-pointer` and stabilized hover states without layout shift.

