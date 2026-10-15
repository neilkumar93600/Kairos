# Section spec 12: entry-09-questions (Questions)

Tier: utility. Route: `/` (landing). Section id `entry-09-questions`, anchor `#entry-09`, scene state `none`, scroll length 90vh (a minimum height, content decides the real height).

Sources used: 06-copy-deck.md section 14, 02-design-system.md (tokens, `.lp-faq-q`), 03-motion-system.md (presets, tokens, `mi-details`, `kt-line-rise`, `kt-title-rise`), 05-architecture.md (section DOM contract, `FaqList`, `JsonLd`), and the existing `web/components/shared/faq-list.tsx`.

---

## 1. Purpose and narrative beat

Entry 09 removes the last doubts before the ask in entry 10. It does this by stating limits, not by selling. Each of the six answers says what Kairos does not do: it does not touch LinkedIn, does not promise to be undetectable, does not invent experience, does not charge for a failed submission, does not read Gmail, does not take file uploads in v1.

Narrative beat: "Doubts answered by stating what Kairos does not do." The page has no WebGL object here. The slip has been filed in entry 05 and the open row was stated in entry 06, so the page goes quiet on purpose. The reader gets plain text on a plain surface.

Signature moment: answer A2 ("We do not promise it is undetectable; we make sure it is something you would have sent yourself.") is the only answer set in Phosphor White at the lead size, it is open by default, and it is the only text on the page that gets a small signature rule drawn under it. Every other answer is Sage 60 and closed. The visitor sees one sentence that is brighter than everything around it, and it is the sentence that most marketing pages would never print. Calm and exact: one colour step, one 1px rule, no movement beyond that.

Why this is the right restraint: motion on this entry would compete with the claim being made. The honesty line is the spectacle. It is also the page's plainest line, so it must be readable at frame 0 and with all motion off.

Claims served: none new. Two answers carry claim chips back to the entries that demonstrate them (`see 03`, `see 05`), which are claims 3 and 4 of the six in the claims register.

---

## 2. Content (final copy from 06-copy-deck.md, verbatim)

All strings come from `landingCopy["entry-09-questions"]`. Nothing in the component is hard-coded. Use U+00B7 only as the deck allows; there are no em or en dashes in this section.

| Key | Element | Copy |
| --- | --- | --- |
| `number` | Entry number in the M1 head | 09 |
| `eyebrow` | Caption above the H2 | Questions |
| `h2` | H2 (id `entry-09-title`) | What people ask before signing up. |
| `faq[0].q` | Summary | Which job sites does it apply on? |
| `faq[0].a` | Answer, Sage 60 | Employer career pages on Greenhouse, Lever and Ashby. We do not automate LinkedIn, because its user agreement bans bots and it puts your account at risk. |
| `faq[1].q` | Summary | Will recruiters know I used it? |
| `faq[1].a` | Answer, Phosphor White, lead size, open by default | The application is submitted through the employer's own form with your details and answers you approved. We do not promise it is undetectable; we make sure it is something you would have sent yourself. |
| `faq[2].q` | Summary | Does it invent experience to match a job? |
| `faq[2].a` | Answer, Sage 60, then chip `see 03` | No. Tailored lines must cite facts from your confirmed profile. A line that cites nothing cannot be saved; the editor lists it so you can fix or remove it. |
| `faq[3].q` | Summary | What if a submission fails? |
| `faq[3].a` | Answer, Sage 60, then chip `see 05` | You keep the credit. The application shows why it failed so you can fix it and send again. |
| `faq[4].q` | Summary | Do you need my Gmail password or access? |
| `faq[4].a` | Answer, Sage 60 | No. You set one forwarding filter, and replies about your applications come to a private address we give you. |
| `faq[5].q` | Summary | Can I upload my resume? |
| `faq[5].a` | Answer, Sage 60 | Version 1 takes pasted text. |

Chip accessible names use the shared template `shared.claimChipName` = "See entry {NN}, {title}": "See entry 03, Truth lock" and "See entry 05, Send and receipt".

Changes and flags (none alter verbatim copy):

1. `h2Alt` ("Six questions, answered plainly.") is not used. The primary H2 is the deck's KEEP line and says what the reader is doing. Keep `h2Alt` in the deck as a reserve only.
2. `summaryAriaOpen` (", expanded") is dropped from the build. Native `<details>`/`<summary>` already exposes the expanded state in current NVDA, JAWS and VoiceOver, and the suffix would double-announce. Deck note 8 allows this. Re-add only if the 10.5 screen reader pass shows a gap.
3. Wording risk, not changed: `faq[3].a` begins "You keep the credit." In entry 07 the same fact is shown as "Failed × 0 credits = $0.00". "Keep" is correct (the credit is not spent) but a fast reader could take it as "I keep a credit I would have lost". The deck owner should confirm the wording; this spec uses it verbatim.
4. A2 must stay free of the word "undetectable" anywhere except inside the negation shown above. The copy lint already allows that one occurrence.

---

## 3. Layout structure

Section DOM contract (from 05-architecture): `<section id="entry-09-questions" data-section="entry-09-questions" data-entry="09" data-scene="none" aria-labelledby="entry-09-title" class="lp-entry">`. The section sits inside `<main id="main">`, inside `.lp`.

Shared values: container `--lp-container` 1280px; section padding block `--section-pad-landing` (128px at 1024 and wider, 96px at 640 to 1023, 80px below 640); `min-height: 90svh`; background `--background` (no band, no surface change); no canvas behind it. The M1 head row is `--lp-head-h` (32px) tall with 48px space below at 1024+, 40px at 640 to 1023, 32px below 640.

Two regions in the body: Title block (eyebrow, H2) and FAQ list. The list never exceeds 696px wide, and no answer exceeds its measure.

| Viewport | Grid | Head (number + rule) | Title block | FAQ list |
| --- | --- | --- | --- | --- |
| 1440 and 1280 | 12 cols, col 72px, gap 32, content 1216 | cols 1-12 | cols 1-5 (488px). H2 at `--type-heading-landing` (56px at 1440, about 52px at 1280). Two lines, `text-wrap: balance`, `max-inline-size: var(--measure-title)` (14em) | cols 6-12 (696px). Answers `max-inline-size: var(--measure-body)` (34rem = 544px) except A2 (see below) |
| 1024 | 12 cols, col about 50.7px, gap 32, margin 32, content 960 | cols 1-12 | cols 1-5 (about 381px). H2 about 43px, two or three lines | cols 6-12 (about 547px). Answers 34rem, which is fully inside the column |
| 768 | 8 cols, gap 24, margin 24, content 720 | cols 1-8 | cols 1-8, stacked above the list. H2 at about 38px, `max-inline-size: 14em` | cols 1-8 (720px). Answers 34rem (544px), left aligned, empty space to the right is accepted |
| 640 to 767 | 8 cols, gap 20, margin 16 | cols 1-8 | cols 1-8 | cols 1-8, answers 34rem |
| 360 to 639 | 4 cols, gap 16, margin 16 | cols 1-4 | cols 1-4, H2 36px, `max-inline-size: 14em` (about 3 lines at 360) | cols 1-4, answers full column width (328px at 360), 16px body, line height 1.5 |

Spacing inside the section:

| Gap | 1024+ | 640 to 1023 | below 640 |
| --- | --- | --- | --- |
| Head row to title block | 48px | 40px | 32px |
| Eyebrow to H2 | 16px | 16px | 12px |
| Title block to list (stacked layouts only) | n/a | 40px | 32px |
| Summary row | min-height 56px, block padding 16px, inline padding 0 | same | same |
| Summary to its answer | 0 above (the answer starts after 4px) and 24px below the answer | same | same |
| Answer to chip | 12px, chip on its own line after the answer | same | same |
| List top and bottom | 1px `--border` hairline above first row and below last row, 1px `--border` between rows | same | same |

The list sits so its top hairline aligns with the top of the eyebrow, at 1024 and wider. Use `align-items: start` and no sticky behaviour (the only pin on the page is entry 05).

A2 is set at the lead size, so it needs its own measure: `max-inline-size: 26em` (about 570px at the lead size) on 1024+ and the full column below. This is a named landing-only exception to `--measure-body`, justified because it is the signature line. It still has 45 to 60 characters per line.

ASCII wireframe, desktop (1440, content 1216 wide, not to scale):

```
 [09]  |  .  .  .  .  .  .  .  .  .  ||  .      <- M1: number + graticule rule, 11 ticks, tick 09 is 8px Phosphor White
 ----------------------------------------------------------------------------------------------
 QUESTIONS                          |---------------------------------------------------------|
                                    | Which job sites does it apply on?                     + |
 What people ask                    |---------------------------------------------------------|
 before signing up.                 | Will recruiters know I used it?                       - |
                                    |                                                         |
 (cols 1-5, 488px)                  |   The application is submitted through the employer's   |
                                    |   own form with your details and answers you approved.  |
                                    |   We do not promise it is undetectable; we make sure    |
                                    |   it is something you would have sent yourself.         |   <- Phosphor White, lead size
                                    |   ______                                                |   <- 1px signature rule, 48px
                                    |---------------------------------------------------------|
                                    | Does it invent experience to match a job?             + |
                                    |---------------------------------------------------------|
                                    | What if a submission fails?                           + |
                                    |---------------------------------------------------------|
                                    | Do you need my Gmail password or access?              + |
                                    |---------------------------------------------------------|
                                    | Can I upload my resume?                               + |
                                    |---------------------------------------------------------|
                                    | (cols 6-12, 696px)
```

ASCII wireframe, mobile (360, one column, margin 16):

```
 [09]  ' ' ' ' ' ' ' ' ' | ' '        <- M1 head, tick 09 current
 ------------------------------------
 QUESTIONS

 What people ask before
 signing up.

 ------------------------------------
 Which job sites does it apply    +
 on?
 ------------------------------------
 Will recruiters know I used      -
 it?
   The application is submitted
   through the employer's own
   form with your details and
   answers you approved. We do
   not promise it is undetectable;
   we make sure it is something
   you would have sent yourself.
   ______
 ------------------------------------
 Does it invent experience to     +
 match a job?
 ------------------------------------
 What if a submission fails?      +
 ------------------------------------
 Do you need my Gmail password    +
 or access?
 ------------------------------------
 Can I upload my resume?          +
 ------------------------------------
```

On mobile the receipt tape (48px, sticky under the 64px navbar) is present. The section needs `scroll-margin-top` on the H2: 128px below 1024 (64 + 48 + 16) and 80px at 1024 and wider.

---

## 4. Visual design

Tokens used (all from 02-design-system.md; no new tokens are introduced by this section):

| Role | Token | Value and note |
| --- | --- | --- |
| Section surface | `--background` (Void) | No band. Everything on Void |
| Number "09" | `--label` via `.lp-head-num`, tabular slashed-zero | M1 |
| Graticule rule | `--divider` (Phosphor Blue-Black) hairline, ticks `--border`; current tick (index 9 of 0 to 10) 8px, `--foreground` | M1, M2 |
| Eyebrow | `.lp-caption`, `--label` | "Questions", 400, uppercase not required |
| H2 | `.lp-heading`, `--type-heading-landing`, `--lh-heading-landing`, `--tracking-heading-landing`, `--foreground`, Inter Tight 400, `ss01` | 36 to 56px |
| Summary text | `.lp-faq-q`: Inter 500, 16px, line height 1.5, tracking -0.022em, `--foreground` | 56px min row. Matches the DS table |
| Marker | `+` (closed) and U+2212 `−` (open), `--muted` (Sage 40) | Void only, 4.7:1. Hover and open: `--foreground` |
| Row hairlines | `--border` (Circuit Border) | Decorative; meaning never rests on them |
| Answer (A1, A3 to A6) | `.lp-body`, `--type-body-landing`, `--body` (Sage 60), 400, `--measure-body` | 8.3:1 on Void |
| Answer A2 | `--type-lead-landing`, `--foreground` (Phosphor White), 400, `--lh-body`, measure 26em | About 19:1 on Void |
| Signature rule | 1px tall, 48px wide, `--foreground`, left aligned, 12px below the A2 text | Echoes the hero "sign." rule (kt-sign-rule) |
| Claim chips | `.lp-chip--claim` (M5): mono-weight 500 12px label, 1px `--chip-link-border`, `--link` text colour as the DS defines, 0px radius per amendment A12 is for receipt paper only; chip uses `--r-pill` per DS | Hit area padded to 44px high via pseudo element, visual height 24px |
| Focus ring | `:focus-visible` 2px `--foreground`, offset 2px | Global |

Type roles: eyebrow = caption, H2 = heading-landing, question = faq-q (title role at 16px), answer = body, A2 = lead. Weights are 400 and 500 only. Hierarchy comes from size, colour and tracking. Body text is left aligned. No `text-wrap: pretty` on the A2 line (use `balance` for the H2 and `pretty` for the other answers).

Motif use:

| Mark | Use here |
| --- | --- |
| M1 and M2 | Entry head: "09" and a rule with 11 ticks, tick 09 current. The rule draws left to right, 600ms |
| M5 | Two claim chips, one after A3 and one after A4 |
| M8 | The number "09" uses tabular slashed-zero numerals |
| M3, M4, M6, M7, M9, M10 | Not used. This entry is not a demo, so there is no SAMPLE chip or dashed edge. The perforation appears only above the footer |

Lime: no element in this section is lime. In this viewport the one lime element is `navbar.startFree`, because no in-page action is in view (LimeCustody, order: Approve, hero CTA, Choose Pro, closing CTA, navbar). When the entry-10 closing CTA enters the viewport at the bottom of this section's scroll, custody hands over from navbar to closing (150ms + 150ms) by the existing LimeCustody island; this section does nothing to cause it. No status colours, no glow, no neon.

---

## 5. WebGL

Scene state id: `none` (`data-scene="none"`). Entry 09 is the last of three consecutive entries (07, 08, 09) with no scene state.

Entry and exit:

| Transition | Trigger | Behaviour |
| --- | --- | --- |
| Entering from entry 08 | Both are `none` | No scene change. The canvas keeps rendering nothing and, per 04-webgl-scene, draws zero frames at rest |
| Leaving to entry 10 (`slip-fresh`) | Entry 10 section top crosses `ENTRY_START` ("top 85%") | The stage begins its 600ms sample-paper lift and the new slip feed. This is driven by the stage from entry 10's scroll position, not by anything in entry 09. Entry 09 must not set, or listen for, any scene input |

Layering: nothing in this section sits over the canvas. The canvas (`--lp-z-canvas`) is fixed behind content (`--lp-z-content`), but in state `none` it shows no object, so the section's own `--background` is the only thing behind the text. The section must have an opaque `--background` so the canvas cannot show through on tier 1 and 2 devices during the stage's fade-out and fade-in around the section.

Text contrast over the canvas: not applicable, since no slip is drawn behind this text. The contrast guarantees in section 8 hold against Void alone.

Receipt lane: at 1024 and wider the `[data-lane]` column exists on other entries. Entry 09 does not render a lane column or an empty placeholder; the list uses cols 6-12 and the space is left empty by design.

---

## 6. Animation choreography

Principles that apply: sections do not fade; body text has no entrance; every move ends; at most two simultaneous motion groups; no springs, no loops. This is the quietest entry on the page.

### 6a. Entrance timeline

Trigger for all rows: the section's `data-post` goes from `pending` to `live` when the section top crosses 85% of the viewport (`ENTRY_START`, ScrollTrigger id `entry-09:post`, once). Delays are measured from that moment. Without GSAP (below 1024px, or no JS), the same states are driven by CSS on `[data-post="live"]`.

| Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Entry rule `.lp-head-rule` (preset `en-post-rule`) | `transform: scaleX` (origin left) | 0 | 1 | `--dur-post` 600ms | 0ms | `--ease-post` | `data-post=live` |
| Current tick (09) | `transform: scaleY` (origin bottom) | 0 | 1 | `--dur-label` 200ms | 0ms, runs with the rule | `--ease-post` | `data-post=live` |
| H2 at 1024 and wider (`kt-line-rise`) | `translateY` inside padded mask | 115% | 0 | `--dur-rise` 700ms | `--delay-rise` 80ms, lines 70ms apart (2 lines end at 850ms) | `--ease-post` | `data-post=live` |
| H2 below 1024 (`kt-title-rise`) | `translateY` of whole title inside mask | 115% | 0 | 700ms | 80ms | `--ease-post` | `data-post=live` |
| Eyebrow, summaries, answers A1 and A3 to A6, chips | none | n/a | n/a | n/a | n/a | n/a | Static. Visible at first paint |
| A2 text colour (`kt-ink` applied to one block, not split by word) | `color` | `--body` (Sage 60) | `--foreground` (Phosphor White) | `--dur-ink` 360ms | `--delay-sign` 700ms | `--ease-utility` | `data-post=live` |
| A2 signature rule (`kt-sign-rule`) | `transform: scaleX` (origin left) | 0 | 1 | `--dur-sign` 500ms | 1060ms (700 + 360, after the ink completes) | `--ease-post` | `data-post=live` |

Group count: rule and tick (group 1, 0 to 600ms); title (group 2, 80 to 850ms); A2 ink and sign rule (group 1 again, from 700ms). At no point are more than two groups moving.

States at rest and fallbacks: when `data-post` is absent, the final state applies (rule drawn, title in place, A2 Phosphor White, signature rule drawn). When `data-post="pending"` (set by the head script only for full motion), A2 reads Sage 60 and the signature rule has `scaleX(0)`. Text is readable in every state; the only thing "missing" in the pending state is a colour step and a hairline.

If the visitor arrives with the section already past the trigger (anchor `#entry-09`, reload mid-page, or rapid scroll), the ScrollTrigger sets `data-post="instant"`: all final values apply with zero duration. The page only moves forward; scrolling back up never replays or reverses.

Opening and closing a row: no animation of height. The answer is shown and hidden by the native `<details>` behaviour. Only the marker and the summary colour change (see 6c). This follows `mi-details`: "Open state changes colour only, 300ms. Content height is never animated."

### 6b. Scroll-linked behaviour

None. There is no pin, no scrub, no snap and no ScrollTrigger on a progress value. The only scroll-tied logic is the one-time state change below and the shared chrome.

| Scroll position (section relative) | Value |
| --- | --- |
| Section top below 85% of viewport | `data-post="pending"` (full motion only) |
| Section top crosses 85% of viewport (ScrollTrigger `entry-09:post`, start `top 85%`, end `bottom 15%`, `once`, `scrub` off) | `data-post="live"`; timeline in 6a plays once |
| Landed by anchor or jump past the trigger | `data-post="instant"` |
| Section midline crosses the viewport midline | Shared chrome only: `html[data-active-entry="09"]`, the rail marks 09 as `aria-current="location"`, the navbar caption (1024 to 1279) reads "09 / 10", the tape shows the latest posted line. Entry 09 posts no new receipt line |
| Section bottom passes the viewport top | Entry 10 owns the state |

The ScrollTrigger is created only at 1024px and wider with full motion, via `desktop.ts`. `refreshPriority` equals the entry index. Below 1024px the same `data-post` change is made by the shared IntersectionObserver in the EntryPoster/entry island, no GSAP.

### 6c. Micro-interactions

| Element | Hover (fine pointer) | Focus (keyboard) | Press / open |
| --- | --- | --- | --- |
| Summary row (`mi-details`, `mi-row-toggle`) | Question colour stays `--foreground`; marker colour `--muted` to `--foreground`, `--dur-colour` 300ms, `--ease-utility`; cursor pointer | 2px `--foreground` outline, offset 2px, around the full row; marker as on hover | Marker swaps `+` to U+2212 instantly (no rotate); marker colour `--foreground` while open; no transform, no scale, no layout shift |
| Claim chip (`mi-chip`) | Border and text to `--foreground`, 300ms | Same 2px ring | Navigates (see below). No scale |
| A2 | No hover effect (it is text) | Part of the summary/answer region; no extra stop | n/a |
| Touch | Tap on the full row toggles it; there is no hover dependency | n/a | Press shows the colour state for 120ms (`--dur-swap`) |

A2 is open by default through the `open` attribute on its `<details>`. The six `<details>` elements are independent. Do not use the `name` attribute for exclusive grouping, because opening another question would close A2 and remove the honesty line from view. A visitor may close A2; it does not reopen on its own.

Chip behaviour: each chip is an `<a href="#entry-03">` or `<a href="#entry-05">`. The anchor jump follows `anchors.ts`: jumps longer than `SMOOTH_ANCHOR_MAX_VH` (2 viewport heights) are instant, then focus moves to the target heading (`#entry-03-title`, `tabindex="-1"`). Scrolling back up to the chip's origin does not alter any posted state.

### 6d. Hand-off to the next section

Entry 09 hands off by finishing. There is no exit animation (`ex-*` presets are not used). The sequence at the boundary is:

1. The visitor scrolls past the last row's closing hairline. The bottom padding (128/96/80px) is the pause.
2. Entry 10's head rule starts to draw when entry 10's top reaches 85% of the viewport. The stage begins the `slip-fresh` pose from the same position (webgl: `none` to `slip-fresh`), as set out in entry 10's own spec.
3. LimeCustody hands the single lime fill from the navbar to the closing CTA, 150ms + 150ms, when the closing CTA enters the viewport. Entry 09 has no lime and contributes no candidate attribute.

Presets referenced: `en-post-rule`, `kt-line-rise`, `kt-title-rise`, `kt-ink`, `kt-sign-rule`, `mi-details`, `mi-row-toggle`, `mi-chip`, `mi-focus`, `mi-link`. Tokens: `--dur-post`, `--dur-label`, `--dur-rise`, `--delay-rise`, `--dur-ink`, `--delay-sign`, `--dur-sign`, `--dur-colour`, `--dur-swap`, `--ease-post`, `--ease-utility`.

---

## 7. Reduced-motion, no-JS and low-tier variants

| Condition | Behaviour |
| --- | --- |
| `prefers-reduced-motion: reduce` or `html[data-motion="reduced"]` (the footer toggle) | Durations resolve to 0.01ms. Rule is drawn, title is in place, A2 is Phosphor White and its signature rule is drawn at once. `--dur-colour` is not zeroed by design, so hover colour changes still ease over 300ms (a colour change is allowed under reduced motion). No GSAP SplitText is created; the H2 is plain text |
| No JavaScript | Everything is server-rendered. `<details>` works natively, A2 is open by the `open` attribute, `data-post` is absent so the final state shows, the FAQ JSON-LD is in the HTML, chips are plain anchors. No motion at all |
| Below 1024px (any tier) | `kt-title-rise` in CSS instead of `kt-line-rise`; no GSAP loaded for this section |
| Tier 0, 1, 2 (WebGL tiers) | Identical. There is no WebGL here, so the section never changes with the tier. Data-saver (`saveData`) changes nothing here either |
| Print | Not specified for the landing. Do not add print styles |
| `forced-colors: active` | Hairlines and ticks use `CanvasText`/`ButtonBorder` through system colour mapping; the A2 emphasis is carried by size and the signature rule as a `border-top` (not a background) so it survives |
| Text-only zoom 200% | Rows grow in height; no fixed heights, only `min-height` |

The A2 emphasis does not rely on colour alone: it is also larger (lead size), open by default and underlined by the signature rule. This satisfies "color is not the only indicator".

---

## 8. Accessibility

Landmark and headings:

| Item | Spec |
| --- | --- |
| Landmark | `<section aria-labelledby="entry-09-title">` inside `<main id="main">`. Section is a region by name |
| Heading | One `<h2 id="entry-09-title" tabindex="-1">`. No h3: the questions are `<summary>` text, which is the right pattern for native disclosure and matches `/pricing` |
| Skip links | None added; the shared "Skip to main content" and "Skip to pricing" cover the page |

Focus order: ledger-rail and tape chrome come first in the DOM as established elsewhere, then within this section: (H2 is not a stop) summary 1, summary 2 (A2 open, contains no interactive content), summary 3, then if opened its chip, summary 4, then its chip, summary 5, summary 6. Chips live inside answers, so they are focusable only when their row is open (closed `<details>` content is not in the tab order). Visual order equals DOM order at every breakpoint; the layout uses grid placement without `order`.

ARIA and semantics:

1. Use native `<details>` and `<summary>`. No `role`, no `aria-expanded`, no JS toggling. No `aria-controls`.
2. Marker spans are `aria-hidden="true"`; the open/closed state is announced by the browser.
3. M1 head (`.lp-head`) is `aria-hidden="true"`: number, rule, ticks are decorative. Rail and navbar caption carry the entry position as text. Do not repeat "Entry 09" in the heading.
4. Chips: `<a class="lp-chip lp-chip--claim" href="#entry-03" aria-label="See entry 03, Truth lock">see 03</a>` and likewise for 05. The visible text is "see 03", so the accessible name begins differently from the visible label; this is allowed here because the name contains the visible text "03". Check with Label in Name (WCAG 2.5.3): the visible words "see 03" must be contained in the name. They are not, as written ("See entry 03" does not contain the string "see 03"). Fix: set the accessible name to "see 03, Truth lock" using the template `shared.claimChipName` adapted, or keep "See entry 03, Truth lock" and set visible text "see entry 03". This section follows the deck: visible "see 03"; name "see 03, entry 03 Truth lock". Flag for the deck owner to confirm one pattern for all six chips (the deck's template begins "See entry"), since this affects all claim chips on the page.
5. The signature rule and the A2 emphasis are decorative or typographic and need no text alternative.
6. No `role="alert"` or live region in this section. Nothing here updates after load.
7. JSON-LD is a `<script type="application/ld+json">`, not visible and not announced.

Contrast (WCAG 2.2 AA), on `--background` (Void) except where noted:

| Pair | Ratio | Result |
| --- | --- | --- |
| Phosphor White `#ddffdc` on Void (H2, summaries, A2) | about 19:1 | AA and AAA |
| Sage 60 `#8cab87` on Void (answers) | 8.3:1 | AA and AAA |
| Sage 40 `#677d64` on Void (closed marker) | 4.7:1 | AA, Void only, so the list must not sit on `--surface` |
| Hover/open marker Phosphor White on Void | about 19:1 | Pass |
| Circuit Border `#485346` hairlines | 2.6:1 | Decorative, not required (meaning is carried by text and marker) |
| Focus ring Phosphor White on Void, 2px | about 19:1 | Pass (3:1 required) |
| Chip border and text | per DS chip table | Pass; text is 12px so it must be 4.5:1 and uses `--link`/`--foreground` per DS |

There are no new colour pairings. A2's Phosphor White on Void is already in the DS table.

Target sizes: each summary is a full-width row, at least 56px tall, so it exceeds the 44px landing minimum (A16) by 12px. The rows are contiguous and share a 1px hairline, so they do not have the 8px gap between targets that A16 asks for between separate controls. This is a deliberate, named exception for disclosure lists: the rows are larger than the minimum, and WCAG 2.5.8 (24px) is met in every direction. The two chips are 24px visual height with a padded 44px hit area and at least 8px between them and any other target (they are in different rows and open only after the row is expanded).

Screen-reader reading order for a visitor: "Questions" caption, heading level 2 "What people ask before signing up.", then six disclosure buttons; the first reads as "Which job sites does it apply on?, collapsed", the second reads as expanded and then the A2 text. A2 is the first answer a screen-reader user hears in full.

---

## 9. Performance notes

| Item | Budget |
| --- | --- |
| New client JavaScript | 0 KB. The section is a server component. The `data-post` change reuses the shared entry island and `desktop.ts` already loaded for every entry |
| New CSS | Up to 1.2 KB gzip in `landing.css` and `motion.css` (rows, marker, A2 emphasis, signature rule) |
| Images, fonts, icons | None. No SVG, no raster. Markers are text glyphs. Uses Inter and Inter Tight already preloaded; U+2212 exists in Inter |
| JSON-LD | About 1.4 KB raw in the HTML, escaped (`<` as `<`) |
| DOM size | About 45 elements: head (13 ticks and rule), eyebrow, H2 with mask wrappers, 6 details, 6 summaries, 6 markers, 6 answer paragraphs, 2 chips, 1 signature rule |
| Animated properties | `transform` (title rise, rule `scaleX`, tick `scaleY`, signature rule `scaleX`) and `color` (A2 ink, hover) only. Never height, width, margin, or opacity of the whole section |
| `will-change` | Set only on the H2 mask inner, the rule, and the signature rule while the timeline plays (3 elements, under `MAX_WILL_CHANGE` 4), and removed on completion |
| Layers | No permanent compositing layers. The section is ordinary flow content |
| Longest sequence | A2 ink and signature rule end at 1560ms from trigger, once. Below the 4.5s `MAX_AUTOPLAY_MS`, so WCAG 2.2.2 needs no pause control |
| LCP/CLS | Not an LCP candidate. Layout is fixed before the animation (masks reserve space), so CLS is zero. A2 being open by default is in the first HTML, so opening does not shift layout after load |
| Rendering | `content-visibility: auto` with `contain-intrinsic-size: auto 900px` on the section is allowed and safe here (no sticky or pin inside) |

---

## 10. Implementation

Files and ownership:

| Path | Kind | Notes |
| --- | --- | --- |
| `web/components/landing/entries/entry-09-questions.tsx` | New, server component | Renders `Entry` shell, title block, `FaqList` (landing variant), `JsonLd` |
| `web/components/landing/entries/entry.tsx` | Existing (foundation) | Provides the `<section>` contract, the M1 head and the `data-post` handling. Props used: `id="entry-09-questions"`, `number="09"`, `scene="none"`, `titleId="entry-09-title"` |
| `web/components/landing/json-ld.tsx` | Existing (foundation) | Called as `<JsonLd type="FAQPage" items={faqPlain} />` where `faqPlain` is built from `landingCopy["entry-09-questions"].faq` with the plain answer strings |
| `web/components/shared/faq-list.tsx` | Edit (shared) | See below |
| `web/components/landing/marks/claim-chip.tsx` | Existing (foundation), else create | `<ClaimChip to="03" />`, `<ClaimChip to="05" />`. Renders the anchor, the visible "see NN", and the accessible name |
| `web/components/landing/landing.css` | Edit | Adds `.lp-faq-*`, `.lp-honesty` and `.lp-honesty__rule` rules under `.lp` |
| `web/components/landing/motion.css` | Edit | Adds the `[data-post="pending"]` and `[data-post="live"]` rules for A2 ink and the signature rule |
| `web/content/landing-copy.ts` | Existing | Keys listed in section 2 |
| `web/content/claims.ts` | Existing | Claims 3 (`entry-09-questions.faq[2]`) and 4 (`entry-09-questions.faq[3]`) are registered with `data-claim` |

`FaqList` change (backwards compatible with `/pricing`; the file currently takes `{ q: string; a: string }` and uses legacy `divide-line` and `text-muted` classes):

```tsx
export interface Faq {
  q: string;
  a: ReactNode;          // already widened by the architecture doc
  open?: boolean;        // render <details open>
  emphasis?: boolean;    // adds data-emphasis="true" to the item; the CSS styles it
}
export function FaqList({ items, variant = "default" }: { items: Faq[]; variant?: "default" | "landing" }) { /* ... */ }
```

For `variant="landing"`: the wrapper carries `class="lp-faq"`, each `<details>` carries `class="lp-faq-item"` plus `data-emphasis` when set, the `<summary>` carries `class="lp-faq-q"`, the marker is `<span class="lp-faq-mark" aria-hidden="true">` and the answer is `<div class="lp-faq-a">`. The default variant is exactly today's markup, so `/pricing` is untouched. The marker text switches through CSS (`details[open] .lp-faq-mark::before { content: "\2212"; }`), not through state, so the component stays a server component. Do not add keys other than `item.q`.

Component outline (server):

```tsx
// entry-09-questions.tsx (server component, no "use client")
const c = landingCopy["entry-09-questions"];
const items: Faq[] = c.faq.map((f, i) => ({
  q: f.q,
  open: i === 1,
  emphasis: i === 1,
  a: (
    <>
      {i === 1 ? <p className="lp-honesty">{f.a}<span className="lp-honesty__rule" aria-hidden="true" /></p> : <p>{f.a}</p>}
      {i === 2 && <ClaimChip to="03" />}
      {i === 3 && <ClaimChip to="05" />}
    </>
  ),
}));
// <Entry ...><header>eyebrow + <h2 id="entry-09-title" data-split="lines">{c.h2}</h2></header>
//   <FaqList variant="landing" items={items} /></Entry>
// <JsonLd type="FAQPage" items={c.faq} />
```

Key CSS (inside `.lp`):

```css
.lp-honesty { color: var(--foreground); font-size: var(--type-lead-landing); max-inline-size: 26em; }
.lp-honesty__rule { display: block; inline-size: 48px; block-size: 1px; margin-block-start: 12px; background: var(--foreground); transform-origin: left; }
[data-post="pending"] .lp-honesty { color: var(--body); }
[data-post="pending"] .lp-honesty__rule { transform: scaleX(0); }
[data-post="live"] .lp-honesty { transition: color var(--dur-ink) var(--ease-utility) var(--delay-sign); }
[data-post="live"] .lp-honesty__rule { transition: transform var(--dur-sign) var(--ease-post) calc(var(--delay-sign) + var(--dur-ink)); }
```

(Note that `pending` sets the start state and `live` swaps the target; the transition properties on `live` run from the `pending` values to the final ones. `instant` and absent use the final values with no transition.)

The JSON-LD builder takes plain strings from `c.faq[n].a`, which already exclude chip text, and a unit test (Vitest) asserts that for each item the text content of the rendered answer, with `[data-claim-chip]` removed and whitespace collapsed, equals the JSON-LD `acceptedAnswer.text`. The same test asserts exactly six `Question` entries.

Presets and tokens used: see 6d. Existing components reused: `Entry`, `FaqList`, `JsonLd`, `ClaimChip`, the M1 head mark. No new client islands.

---

## 11. Acceptance criteria

Content and structure
- [ ] The section renders exactly six `<details>` in the order of the copy deck, with the question and answer text identical to `landingCopy["entry-09-questions"]` (no hard-coded strings).
- [ ] The H2 reads "What people ask before signing up." and has `id="entry-09-title"` and `tabindex="-1"`; the section has `aria-labelledby="entry-09-title"` and `data-scene="none"`.
- [ ] No em dash or en dash appears in the section's rendered text or JSON-LD, and "undetectable" appears only inside the negation in A2.
- [ ] A2 (`faq[1]`) has the `open` attribute in server HTML; the other five do not; opening one does not close another (no `name` attribute).
- [ ] Chips `see 03` and `see 05` appear only after A3 and A4, link to `#entry-03` and `#entry-05`, and have an accessible name that contains their visible text (Label in Name check).
- [ ] The `FAQPage` JSON-LD is present in the initial HTML with six questions whose answer text equals the DOM text (chips excluded), and `<` is escaped.

Visual
- [ ] A2 is `--foreground` at the lead size; A1 and A3 to A6 are `--body`; no other text in the section is Phosphor White except the H2, summaries and markers.
- [ ] No lime element is inside the section at any scroll position; at the section midline exactly one lime element is visible in the viewport (navbar `Start free`).
- [ ] Font weights computed on every text node are 400 or 500.
- [ ] Layout matches section 3 at 1440, 1280, 1024, 768, 640 and 360 with no horizontal scroll; the list is cols 6-12 at 1024+ and full width below; the H2 is at most 3 lines at 1024 and at 360.
- [ ] The section has `min-height: 90svh`, padding block 128/96/80px by breakpoint, and an opaque `--background`.

Motion
- [ ] On first view with full motion at 1440, the rule draws in 600ms, the H2 rises 80 to 850ms, A2 ink starts at 700ms for 360ms, the signature rule draws from 1060ms for 500ms, and nothing else moves. Playwright timing tolerance is 60ms.
- [ ] Scrolling back up and down does not replay the sequence; arriving by `#entry-09` shows the final state immediately (`data-post="instant"`).
- [ ] No animated property other than `transform` and `color` is used; no height transition on `<details>`; `will-change` is cleared after the sequence.
- [ ] With `prefers-reduced-motion: reduce` or the footer toggle set to Reduced, the final state shows at once, no SplitText elements are created, and hover colour still changes over 300ms.
- [ ] With JavaScript disabled, A2 is open and Phosphor White, the signature rule is visible, details toggle, and the JSON-LD is present.

Accessibility
- [ ] Summaries are reachable by Tab in visual order, show a 2px Phosphor White ring with 2px offset, and toggle with Enter and Space; chips are in the tab order only when their row is open.
- [ ] A screen reader announces each summary with its expanded or collapsed state exactly once (no `, expanded` suffix).
- [ ] The M1 head is `aria-hidden`; no element in the section has `role="alert"` or a live region.
- [ ] All text meets 4.5:1 on Void; the closed marker (Sage 40) is only used on Void; the focus ring meets 3:1.
- [ ] Each summary is at least 56px tall and chips have a hit area of at least 44px.
- [ ] Jumping via a chip moves focus to the target heading and the browser Back button returns to the chip's position.

Performance
- [ ] The section adds 0 KB of JavaScript and under 1.2 KB gzip of CSS, no image requests, and causes a CLS contribution of 0.
- [ ] The section's DOM is under 60 elements and its longest animation is under 2s.
