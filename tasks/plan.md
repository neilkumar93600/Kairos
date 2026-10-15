# Implementation Plan: Kairos Logo System

## Overview

Replace the interim boxed `K` with a quiet, ownable logo system that expresses Kairos's core promise: trustworthy applications, deliberate timing, and user control. The process is wordmark-first. It will test typography in the real product context, refine one approved direction as exact vector artwork, and only then roll it out to the website and extension.

This is a plan only. It does not change `prompt.md`, the live logo, or any shipped icon.

## Direction Contract

### Brand idea

**Quiet editorial authority.** Kairos should feel like a document worth signing, not a bot that sprays applications.

### Recommended identity structure

- Primary logo: the full title-case word `Kairos`.
- Distinctive device: one custom capital `K`, derived from the wordmark rather than added as a separate illustration.
- Small mark: the approved `K` alone, only where the full word cannot fit.
- Colour: Aubergine Ink `#1b0624` on Linen `#f7f7f5`; reversed for dark contexts.
- Construction: exact vector paths with optical corrections and custom kerning. Generated raster text may inspire exploration but cannot be the final artwork.

### Avoid

- Generic app tiles, boxed initials, and an unrelated pictogram beside the name.
- Category tropes already owned by competitors: loops/arrows, birds, leaves, briefcases, magic wands, sparkles, green growth cues, cyan, and purple gradients.
- High-contrast fashion serifs, script flourishes, calligraphic swashes, heavy rounded SaaS lettering, or speed/motion marks.
- Hidden symbolism that weakens legibility at navbar and favicon sizes.

### Success criteria

- The wordmark is clearly readable at a 22 px navbar height and the `K` remains recognizable at 16 px.
- It feels calm, exact, human, and trustworthy beside the existing Linen/Aubergine interface and painted valley.
- It is distinguishable in silhouette from LoopCV, Jobright, AIApply, Massive, Sprout, Simplify, Teal, and Tsenta.
- It works in one colour, reversed, and without a containing square in normal lockups.
- The final production assets are deterministic SVG/vector artwork, not AI-generated lettering.

## Dependency Graph

```text
Name and positioning gate
    -> Three wordmark directions in real context
        -> Owner selects one direction
            -> Vector master and small-size K
                -> Website lockup
                -> App icons
                -> Extension icons
                    -> Documentation and final QA
```

## Task List

### Phase 1: Lock the brief

- [ ] Task 1: Record the name status and logo brief
- [ ] Task 2: Produce three contextual wordmark directions

### Checkpoint: Direction

- [ ] Owner confirms whether `Kairos` is the working name
- [ ] Owner selects exactly one wordmark direction, or gives one focused revision note
- [ ] No live asset has changed

### Phase 2: Build the approved system

- [ ] Task 3: Refine the selected wordmark and derive the `K` mark
- [ ] Task 4: Implement the website lockup
- [ ] Task 5: Export website and operating-system icons
- [ ] Task 6: Export Chrome extension icons

### Checkpoint: Production assets

- [ ] Full wordmark and small mark match the approved proof
- [ ] Every asset works in one colour and in reverse
- [ ] Navbar, footer, dashboard, favicon, and extension proofs are approved

### Phase 3: Document and verify

- [ ] Task 7: Update brand documentation after approval
- [ ] Task 8: Run visual, accessibility, and build QA

### Checkpoint: Complete

- [ ] The logo is legible at 16, 22, 28, 32, 48, 128, 180, and 512 px contexts
- [ ] Web lint, typecheck, tests, and production build pass
- [ ] Old explorations remain archived and are not confused with shipping assets
- [ ] `prompt.md` remains unchanged unless the owner separately lifts the hold

## Execution Notes

### Task 1 — Name and positioning gate

Treat `Kairos` as provisional until the owner decides to keep it and obtains any desired domain/trademark advice. Existing research found no exact auto-apply competitor with the name, but the name is crowded in technology and has an adjacent AI-talent use. This task is strategic screening, not legal clearance.

Deliverable: `docs/brand/logo-brief.md` containing the working-name status, brand idea, success criteria, competitor avoid-list, and the direction contract above.

### Task 2 — Three contextual directions

Create no more than three genuinely different title-case wordmark directions:

1. **Editorial humanist:** restrained serif influence, low-to-moderate contrast, sturdy at small sizes.
2. **Contemporary humanist:** open, precise sans forms with a distinctive but quiet `K`.
3. **Hybrid document mark:** mostly sans construction with subtle editorial terminals or proportions.

Show every direction in the same four proofs: the real 1440 px navbar, a 390 px mobile navbar, the footer, and monochrome/reversed small-size tests. Use identical colour and sizing so the decision is about letterforms, not presentation. Do not add standalone symbols during this stage.

Deliverable: one comparison board plus vector sketches under `docs/brand/exploration/`.

### Task 3 — Vector master

Refine only the approved direction. Correct kerning, stroke weight, joins, counters, and overshoots; then derive the standalone `K` from the exact same geometry. Test the wordmark at 22 and 28 px and the `K` at 16, 22, and 32 px before approval.

Deliverables: canonical wordmark and mark SVG sources under `docs/brand/source/`, plus a small-size proof sheet.

### Tasks 4–6 — Rollout

Implement the approved paths in `web/components/shared/logo.tsx`, preserving the accessible home label. Export the web app and Apple icons from the same master, then export the four extension sizes. Platform icon squares may use the required full-bleed Aubergine field; the normal logo lockup must not use a generic square container.

### Tasks 7–8 — Documentation and QA

Update `docs/DESIGN.md` only after approval so it records what actually shipped. Keep `prompt.md` on hold. Verify contrast, accessible naming, crop safety, pixel clarity, responsive placement, and production build health. Capture final navbar and footer proofs at 390, 768, and 1440 px.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The name changes after design work | High | Make the name-status decision the first gate; do not produce final assets before it |
| New concepts repeat earlier rejected ideas | High | Test letterform systems only; cap exploration at three clearly distinct directions |
| A refined wordmark fails at product sizes | High | Judge every direction in the actual navbar and at 16/22 px before approval |
| The icon and wordmark feel unrelated | Medium | Derive the small `K` directly from the approved wordmark geometry |
| AI-generated lettering contains malformed forms | Medium | Use generation only for mood exploration; redraw and ship deterministic vectors |
| Logo rollout creates inconsistent old assets | Medium | Maintain one vector master and export every raster size from it in one controlled pass |
| Similarity or trademark conflict appears later | High | Perform professional clearance before a public brand launch; do not treat competitor research as legal advice |

## Open Questions

- Is `Kairos` approved as the working name, or should naming be resolved before visual exploration?
- Which of the three typographic tones should be explored first: editorial humanist, contemporary humanist, or hybrid document mark?
- Is the immediate deliverable only a website wordmark, or should the first rollout also include the extension and social avatars?

## Definition of Done

The logo work is complete when one direction has explicit owner approval, the full wordmark and derived `K` are shipped from the same vector master across the website and extension, all small-size proofs remain legible, the application builds cleanly, and the final system is documented without altering the held prompt.
