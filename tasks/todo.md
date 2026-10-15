# Kairos Logo Tasks

## Task 1: Record the name status and logo brief

**Description:** Convert the product promise and competitor research into a short decision brief, and record whether `Kairos` is approved, provisional, or being reconsidered.

**Acceptance criteria:**

- [ ] The brief states the brand idea, required attributes, and competitor tropes to avoid.
- [ ] The name status is explicit and does not claim legal clearance.
- [ ] `prompt.md` and all live logo assets remain unchanged.

**Verification:**

- [ ] Manual check: owner reviews and approves the direction contract.

**Dependencies:** None

**Files likely touched:**

- `docs/brand/logo-brief.md`

**Estimated scope:** Small: 1 file

## Task 2: Produce three contextual wordmark directions

**Description:** Draw three structurally different title-case wordmark directions and compare them in the real navbar, mobile navbar, footer, and small monochrome settings.

**Acceptance criteria:**

- [ ] Exactly three directions differ in letter construction, not merely weight or decoration.
- [ ] Every direction uses the same Aubergine/Linen colours and identical proof contexts.
- [ ] No standalone pictogram or generic app tile is introduced.

**Verification:**

- [ ] Manual check: inspect each direction at 100% scale at 16, 22, and 28 px.
- [ ] Manual check: owner selects one direction or provides one focused revision note.

**Dependencies:** Task 1

**Files likely touched:**

- `docs/brand/exploration/kairos-wordmark-directions.svg`
- `docs/brand/exploration/kairos-wordmark-contexts.png`

**Estimated scope:** Small: 2 files

## Checkpoint: Direction approved

- [ ] The working name and direction contract are approved.
- [ ] One wordmark direction is selected.
- [ ] No production file has changed.

## Task 3: Refine the vector master and derive the K mark

**Description:** Turn the selected direction into exact vector artwork, optically correct the wordmark, and derive a standalone `K` from the same geometry.

**Acceptance criteria:**

- [ ] The wordmark has final custom kerning and clean closed vector paths.
- [ ] The derived `K` is recognizable at 16 px and does not require a box.
- [ ] Normal and reversed proofs match in perceived weight.

**Verification:**

- [ ] Manual check: inspect outlines at high zoom for overlaps, stray points, and uneven joins.
- [ ] Manual check: inspect rasterized proofs at 16, 22, 28, and 32 px.

**Dependencies:** Task 2 and owner selection

**Files likely touched:**

- `docs/brand/source/kairos-wordmark.svg`
- `docs/brand/source/kairos-k.svg`
- `docs/brand/kairos-logo-size-proof.png`

**Estimated scope:** Medium: 3 files

## Task 4: Implement the website lockup

**Description:** Replace the interim boxed `K` component with the approved vector wordmark/mark while preserving links, accessible naming, and responsive sizing.

**Acceptance criteria:**

- [ ] Navbar, sidebar, header, and footer render the approved logo through the shared component.
- [ ] The link retains an accessible `Kairos home` label and a visible keyboard focus state.
- [ ] The 22 px navbar and 28 px footer presentations match the approved proof.

**Verification:**

- [ ] Tests pass: `npm test -- --run`
- [ ] Typecheck passes: `npm run typecheck`
- [ ] Manual check: review logo instances at 390, 768, and 1440 px widths.

**Dependencies:** Task 3

**Files likely touched:**

- `web/components/shared/logo.tsx`
- `web/app/globals.css`

**Estimated scope:** Small: 1–2 files

## Task 5: Export website and operating-system icons

**Description:** Export the approved `K` onto the platform icon field at the required sizes using the canonical vector master.

**Acceptance criteria:**

- [ ] The 512 px and 180 px raster icons are exported from the same master.
- [ ] The SVG and raster versions have safe margins and matching perceived weight.
- [ ] The 16 px browser presentation remains identifiable without fine detail collapsing.

**Verification:**

- [ ] Manual check: inspect icons at native size and against light/dark browser chrome.
- [ ] Build succeeds: `npm run build`

**Dependencies:** Task 3

**Files likely touched:**

- `web/app/icon.svg`
- `web/app/icon.png`
- `web/app/apple-icon.png`

**Estimated scope:** Medium: 3 files

## Task 6: Export Chrome extension icons

**Description:** Export the approved platform icon at Chrome's required sizes and confirm it remains identifiable in the extension toolbar.

**Acceptance criteria:**

- [ ] 16, 32, 48, and 128 px files all come from the approved master.
- [ ] The 16 px icon has no broken strokes or muddy antialiasing.
- [ ] The manifest continues to reference the correct files.

**Verification:**

- [ ] Manual check: inspect every PNG at native size.
- [ ] Build succeeds: run the extension build command documented by the repository.

**Dependencies:** Task 3

**Files likely touched:**

- `extension/icons/icon-16.png`
- `extension/icons/icon-32.png`
- `extension/icons/icon-48.png`
- `extension/icons/icon-128.png`

**Estimated scope:** Medium: 4 files

## Checkpoint: Production system complete

- [ ] The website and extension use one coherent logo system.
- [ ] Full and small marks match the approved direction.
- [ ] All target sizes have been visually checked.

## Task 7: Update brand documentation

**Description:** Record the approved construction, clear space, minimum sizes, colour modes, and misuse rules after the implementation matches the approved proof.

**Acceptance criteria:**

- [ ] Documentation describes the logo that actually shipped.
- [ ] Clear-space, minimum-size, colour, and reversal rules are explicit.
- [ ] `prompt.md` remains unchanged unless the owner separately lifts the hold.

**Verification:**

- [ ] Manual check: compare documentation examples against production assets.

**Dependencies:** Tasks 4–6

**Files likely touched:**

- `docs/DESIGN.md`
- `docs/brand/logo-brief.md`

**Estimated scope:** Small: 2 files

## Task 8: Run final visual and build QA

**Description:** Verify the logo across responsive layouts, colour modes, native icon sizes, accessibility checks, and the production toolchain.

**Acceptance criteria:**

- [ ] Final proofs cover navbar and footer at 390, 768, and 1440 px plus all icon sizes.
- [ ] There are no contrast, clipping, focus, accessible-name, or asset-reference regressions.
- [ ] Lint, typecheck, tests, and production build pass.

**Verification:**

- [ ] Tests pass: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] Typecheck passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`

**Dependencies:** Tasks 4–7

**Files likely touched:**

- `docs/brand/final/kairos-logo-responsive-proof.png`
- `docs/brand/final/kairos-logo-icon-proof.png`

**Estimated scope:** Small: 2 files

## Checkpoint: Ready to ship

- [ ] Every acceptance criterion above is met.
- [ ] Owner approves the final contextual proof.
- [ ] The held prompt has not been changed without separate approval.
