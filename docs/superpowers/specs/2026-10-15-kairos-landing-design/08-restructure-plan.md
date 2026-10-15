# 08. Restructure plan: Kairos on the reference structure, at reference density

Status: **drafted, for owner review.** Date: 2026-10-15.

This document maps the Kairos landing onto the layout system in [07-reference-system.md](./07-reference-system.md) (archetypes A0 to A11) and applies the owner's density rule: **the number of sections stays; the amount of information in each one drops to what the references carry.** The story beats come from [01-creative-direction.md](./01-creative-direction.md), the facts and most strings from [06-copy-deck.md](./06-copy-deck.md). Where a 06 string is too long for the budget, a shorter string is written from the same bracketed fact and the source key is named so the copy module can be updated in one place.

Density budget, applied to every section below: pill eyebrow 1 to 3 words; headline at most 8 words; one subline at most 20 words; at most 3 items (title at most 4 words plus a line at most 12 words); one visual; at most one CTA; about 30 to 45 visible words. Interactive demos stay only as one card with at most one control and about 25 words inside. Each section states its count. Words inside a visual (a floating card or a demo) count in the same total and are listed as "card words" so the split shows. Every section total is 45 or fewer. Sections under 30 words are chrome or a single line (nav, strip, dark card, closing).

All sizes are CSS px at 1440 wide unless a breakpoint is named. Breakpoints: 1440, 1024, 768, 390 (as in 07).

---

## 0. Summary of the change

| | Dark spec (01 to 06) | This plan |
| --- | --- | --- |
| Visible words on the page (excluding hidden FAQ answers) | about 3,900 | about 530 in all, of which about 115 sit inside visuals |
| Sections | 11 entries plus nav, rail, footer | 16 sections, each with its own count in section 1: nav, hero, strip, problem trio, how-it-works intro, steps 1 to 4, spotlight, dark CTA card, pricing, compare, FAQ, closing, footer |
| Proof per section | Paragraphs, ledger rows, tables, settlement lines | One floating product card or one painted panel |
| Page height at 1440 | about 16.5 viewports | about 8,900 px, about 10 viewports |
| Numbered ledger entries, settlement lines, open-row cells, claim chips, the page receipt | Present | Removed. The entry numbers survive only as the step badges 1 to 4 and card indices 001 to 003 |
| Interactive demos | 5 (sample run, citation demo, approve, calculator, ghost receipt) | 3, each one card with one control: the sponsorship radio pair, "Try a line without a fact", Approve. The calculator leaves the landing (it stays on /pricing) |

The five Ledger ideas the page still carries, one per structural slot: **fit before applying** (step 1), **every resume line cites a real fact** (step 2), **nothing is sent until you approve** (the hero subline, the spotlight and the dark card), **a receipt for every submitted application** (step 3), **a credit used only for applications that went through** (pricing; the plan price itself is charged on the plan's schedule, so the page never says "you are only charged when it goes through").

---

## 1. The page, section by section

Word counts: "copy" is what a visitor reads in the section's text stack; "card" is text inside the visual.

### 1.1 Nav (A0)

**Purpose.** Orientation and one action. **Reuse:** `landing-shell.tsx` header (restyle); copy keys `navbar.*` in 06 §3.

| Element | Copy | Words |
| --- | --- | --- |
| Logo | Kairos (glyph plus wordmark, 28 px tall) | 1 |
| Links | How it works · Pricing · Blog (the first three entries of `siteConfig.publicNav`, which also lists About; all four routes exist in `web/app/(public)`) | 5 |
| Right cluster | Log in (text link) · Start free (primary 44 px pill) | 4 |

Copy: 10 words. Delta from 07 A0: the links are three real routes in `site.ts`, not in-page anchors. About is left out of the landing nav for the density budget and stays in the footer (the other public pages show all four `publicNav` entries, so this is a deliberate difference, not a match). The entry caption "{NN} / 10" is dropped (no entries).

```
1440                                                                 390
┌──────────────────────────────────────────────────────────────┐    ┌───────────────────────┐
│ ◼ Kairos     How it works  Pricing  Blog   Log in [Start free] │    │ ◼ Kairos   [Start] ≡ │
└──────────────────────────────────────────────────────────────┘    └───────────────────────┘
 72 tall, 80 gutters, transparent over the hero                      60 tall, 20 gutters
```

### 1.2 Hero (A1, centred art hero)

**Purpose.** State the three rules in one breath and show one product card floating on the dawn valley. **Reuse:** `entry-00-hero.tsx` (rewrite), `marks/chip.tsx` SampleChip (restyle). The match card is a C3 `floating-card.tsx` built from the `sample-run.tsx` row styling. Hero detail in section 5.

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Status pill | 25 free applications | 3 | [PRD AC1]; replaces `entry-00-hero.eyebrow` (43 chars). Owner decision O1 |
| H1 (serif, 2 lines) | Job applications you would sign. | 5 | `entry-00-hero.h1`, verbatim |
| Subline (2 lines) | Kairos finds jobs that fit, writes only from facts you confirmed, and sends nothing until you approve. | 17 | Shortened from `entry-00-hero.subhead` (169 chars, 27 words); same facts |
| Primary | Start with 25 free applications | 5 | `entry-00-hero.ctaPrimary` |
| Secondary | None. One CTA per section, so "See how it works" is dropped | 0 | `entry-00-hero.ctaSecondary`, not rendered |

Copy: 30 words. Card words: 10 (section 5.3). Section total: 40. The microcopy line "Credits are only used when..." and its claim chip move to `/pricing`; the lane caption is dropped.

```
1440 x 900 (hero block 1000 tall)                    390 (hero min(100svh + 160, 860))
┌──────────────────────────────────────────────┐      ┌─────────────────────────┐
│ nav                                          │      │ nav                     │
│                                              │      │                         │
│              ( 25 free applications )        │      │  ( 25 free applications)│
│                                              │      │  Job applications       │
│          Job applications                    │      │  you would sign.        │
│          you would sign.                     │      │  Kairos finds jobs ...  │
│                                              │      │  until you approve.     │
│   Kairos finds jobs that fit, writes only    │      │ [Start with 25 free ...]│
│   from facts you confirmed, and sends        │      │                       │
│   nothing until you approve.                 │      │ ~~~~~ sky fade ~~~~~~~~ │
│     [Start with 25 free applications]│  │ ░░ dawn valley 4:5 ░░░░ │
│ ~~~~~~~~~~~~~~ art top fade (y 340 to 560) ~~~~~~~~~~ │  │ ░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░ dawn valley, 2.2 : 1 ░░░░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░┌────────────┐░░░░░░░░░ ☼ ░░░░░░░┌────────────┐░░░ │  └─────────────────────────┘
│ ░░│ SAMPLE     │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ┌─────────────────────────┐
│ ░░│ match card │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │ SAMPLE  match card      │
│ ░░└────────────┘░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │ (one card, in flow)     │
│ ~~~~~~~~~~~~~~ art bottom fade (900 to 1000) ~~~~~~~~ │  └─────────────────────────┘
└──────────────────────────────────────────────┘
```

### 1.3 Commitment strip (A2, the honest proof slot)

**Purpose.** Where the references put customer logos, Kairos puts a verifiable fact about where it applies. **Reuse:** new, about 30 lines of server markup.

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Caption (14 px `--muted`) | Applies through employer career pages on | 6 | [PRD core row 1] |
| Items (16 px / 500, separated by 24 px rules) | Greenhouse · Lever · Ashby | 3 | [PRD core row 1]. Plain text, no third-party logos and no "works with" or "partner" wording; the names say where jobs are found and applied, not that those companies endorse Kairos. Workday and iCIMS are not supported and are never named as supported [facts 6] |
| Trailing line (14 px) | We do not automate LinkedIn. | 5 | [PRD out of scope], shortened from `entry-09-questions.faq[0].a` |

Copy: 14 words. No marquee (three items). No icons: each item is a 20 px line-icon "browser window" glyph in `--ink-2`, the same glyph for all three, so none reads as a logo.

```
1440                                                      390
          Applies through employer career pages on         Applies through employer
     ▭ Greenhouse   │   ▭ Lever   │   ▭ Ashby               career pages on
            We do not automate LinkedIn.                     ▭ Greenhouse
                                                             ▭ Lever
  64 below the hero, 160 above the next section              ▭ Ashby
                                                             We do not automate LinkedIn.
```

### 1.4 Problem trio (A3)

**Purpose.** Entry 01's five reported complaints become three cards. The two that are dropped here are answered where the page deals with them: "zero interviews" by the honesty sentence in step 4 ("We cannot promise interviews."), and "charges after cancelling" by the Billing row in the compare section. **Reuse:** `entry-01-reported.tsx` (rewrite as three C1 cards); `settle-cell.tsx`, `open-row.tsx`, `debits.ts` retire.

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Pill | Reported, not measured | 3 | `entry-01-reported.eyebrow`, cut to three words; it now carries the note the footnote held |
| H2 (sans, left) | What people report about auto-apply tools. | 6 | Shortened from `entry-01-reported.h2` (49 chars) |
| Card 001 | **Poor matches** / Applications sent to jobs that do not fit. | 2 + 8 | `rows[0]` "Matches that do not fit." [PRD problem 1]. "Never" is dropped: the PRD source is a reported share, not an absolute |
| Card 002 | **Invented resumes** / Skills the person does not have. | 2 + 6 | `rows[1]` [PRD problem 3] |
| Card 003 | **No edit step** / A draft you cannot change. | 3 + 5 | `rows[2]` [PRD problem 2] |
| Footnote | Removed. The pill carries "not measured", and one subline per section is the budget | 0 | |

Copy: 35 words (pill 3, H2 6, cards 26). Visual: one row of three 96 px line icons, one per card (1.25 px stroke, `--ink-2`): a target with the arrow outside it; a page with a line struck through; a locked pencil. No side paragraph (07 A3 had one; the budget removes it, so the H2 sits alone in columns 1 to 7).

```
1440 (--c-main 1120)                                   390
( Reported )                                            ( Reported )
What people report about                                What people report
auto-apply tools.                                       about auto-apply tools.
┌───────────┐ ┌───────────┐ ┌───────────┐              ┌─────────────────────┐
│001        │ │002        │ │003        │              │001  ◎  Poor matches │
│    ◎      │ │    ▤      │ │    ✎      │              │ Applications sent to│
│           │ │           │ │           │              │ jobs that do not fit│
│Poor       │ │Invented   │ │No edit    │              ├─────────────────────┤
│matches    │ │resumes    │ │step       │              │002  ▤  Invented ... │
│Applications│ │Skills the │ │A draft you│              ├─────────────────────┤
│sent to jobs│ │person does│ │cannot     │              │003  ✎  No edit step │
│that do not │ │not have.  │ │change.    │
│fit.       │ │           │ │           │              └─────────────────────┘
└───────────┘ └───────────┘ └───────────┘
357 x 380 cards, 24 gap, radius 20, --sunk fill
```

### 1.5 How it works: intro (A4) and the chapter

**Purpose.** The page's centre of gravity: four steps joined by one drawn connector line, with the Approve spotlight between steps 2 and 3. The chapter is six sections (this intro, then 1.5.1 to 1.5.5), each budgeted on its own. **Reuse:** new `section-intro.tsx` (replaces `entries/entry.tsx`).

| Element | Copy | Words |
| --- | --- | --- |
| Pill | How it works | 3 |
| H2 (sans, centred) | Fit, cite, approve, receipt. | 4 |
| Subline | Each application passes a fit gate, cites your facts and waits for approval. Submitted ones leave a receipt. | 18 |

Copy: 25 words. "Submitted ones" is deliberate: a receipt exists only for a submitted application, not for a draft or a skip [PRD AC10; facts 1.6]. No toggle: 06 supplies no "what it refuses" set, so per 07 A5 the control is omitted.

Each step and the spotlight below is its own section with its own count (1.5.1 to 1.5.5); each takes a full row and about one viewport on phones.

#### 1.5.1 Step 1. Fit gate (A5, panel left)

**Reuse:** `sample-run.tsx` (rewrite compact: one control, 5 rows, one count line; `fit-run.ts` `computeRun` unchanged), `fit-sample.json`.

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Badge | 1 | | |
| H3 | A fit gate before anything else. | 6 | `entry-02-fit-gate.h2`, verbatim |
| Body | Role, location, salary and visa are hard rules. Break one and it is skipped. | 14 | Shortened from `entry-02-fit-gate.body`; rules map to [fit.ts L42 to L73]. Seniority and the exclude list are left out for the budget |

Copy: 20 words (H3 6, body 14). Card (C3, 72 percent of the panel, on a dawn-painting crop): SAMPLE chip; one control, the radio pair **Needs visa sponsorship: Yes · No** (`entry-02-fit-gate.sponsorshipLegend`, `sponsorshipOptions`); three rows from the sample in posting order: the first skip shows its full reason as `{id} · Skipped · {reason}`, using the exact `fit.ts` string (the 06 example **0417 · Skipped · Posting says it does not sponsor visas** must be checked against `fit.ts` L42 to L73), then **0233 · Passes** and **0309 · Skipped**; the count line **48 postings · {skipped} skipped · {passed} pass** (from `runLine`). Seniority, cap and bar are fixed at the 06 sample settings (Entry, 2 in 30 days, 70). The 70 is a sample setting, not a product default (no document gives a default fit bar [facts 1.6; 06 `barLabel`]), so no visible text calls it one, and "{passed} pass" means passes the hard rules and the sample bar, as in 06 `liveRegion`. Card words: 25 (chip 1, control 5, rows 9 + 2 + 2, count line 6). Section total: 6 + 14 + 25 = 45. The floating **Skips cost nothing** chip is dropped (the pricing subline says it).

#### 1.5.2 Step 2. Truth lock (A5, panel right)

**Reuse:** `citation-demo.tsx` (rewrite compact: 467 lines to about 120; keep the refusal animation and the `role="alert"` result, drop the trace paths, the facts column and the radio presets).

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Badge | 2 | | |
| H3 | Resumes that cannot make things up. | 6 | `entry-03-truth-lock.h2`, verbatim |
| Body | Each line cites a fact you confirmed, or it is not saved. | 12 | Shortened from `entry-03-truth-lock.body` [PRD AC6] |

Copy: 18 words (H3 6, body 12). Card (C3 on a grain-gradient panel, periwinkle to rose): SAMPLE chip; one added line **Wrote backend services in TypeScript for the billing team** with chip `cites #07, #12` (`diff[1]`); one button **Try a line without a fact** (the 06 `preset[1]` string "Led a team of 6 engineers" appears for 320 ms, falls and fades). Card words: 25 (SAMPLE 1, line 9, cite chip 3, button 6, result chip 6). The removed-line diff and the Resume v3 header are dropped for the budget. Section total: 43. Floating chip (appears after the press, otherwise shows the saved state): **Not saved. Cites no confirmed fact.** (`resultRefused`, 6 words).

#### 1.5.3 Spotlight. Approve (A6)

**Reuse:** `approve-sample.tsx` (restyle, compact: title row, two fact rows, Approve; the Edit expander stays in the code and is not visible on the card, because a second visible control breaks the one-control rule), `approved-line.tsx` (keep), `ledger-store.ts` `approvedAt` (keep), `marks/stamp.tsx` (restyle as the signature line).

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Eyebrow pill | The moment | 2 | New |
| H2 (serif; one of three serif moments) | Nothing is sent until you approve it. | 7 | `entry-04-approve.h2Alt`, verbatim [PRD one-line idea] |
| Body | Edit anything. Approve one or a batch. Withdraw before it sends. | 11 | Shortened from `entry-04-approve.body` [APP alternate journeys] |

Copy: 20 words (pill 2, H2 7, body 11). Mock (white panel bleeding 24 px off the card's left edge, 70 percent of the art half): SAMPLE chip, which reads **SAMPLE · NOTHING SENT**; **Software Engineer · Company 014**; **4 lines · each cites a fact**; **7 answers · 0 guessed**; primary button **Approve sample draft**, the only control. Mock words: 20 (chip 3, title 4, lines 6, answers 4, button 3). Section total: 20 + 20 + 3 (floating card) = 43. Floating card straddling mock and art: **Awaiting your approval**, after the press **Approved by you · {approvedTime}** with the lime approved dot (M12). The connector line enters the card's top centre from step 2 and leaves its bottom centre toward step 3 (07 A5 placement rule).

```
1440 (--c-main 1120 x 560, radius 28)
┌────────────────────────────────────────────────────────────────────────┐
│░░ painted footbridge, mid-morning ░░░│                                  │
│┌──────────────────┐░░░░░░░░░░░░░░░░░│  ( The moment )                  │
││SAMPLE            │░░┌─────────────┐░│                                  │
││Software Engineer ·│░░│ Awaiting    │░│  Nothing is sent                 │
││Company 014       │░░│ your        │░│  until you approve it.           │
││                  │░░│ approval    │░│                                  │
││4 lines · each cites a fact │░░└─────────────┘░│  Edit anything.                  │
││                  │░░░░░░░░░░░░░░░░░│  Approve one or a batch.         │
││7 answers·0 guessed│░░░░░░░░░░░░░░░░░│  Withdraw before it sends.       │
││[Approve sample draft]│░░░░░░░░░░░░░░│  (the one control)               │
││SAMPLE · NOTHING SENT │░░░░░░░░░░░░░░│                                  │
│└──────────────────┘░░░░░░░░░░░░░░░░░│                                  │
└────────────────────────────────────────────────────────────────────────┘
 48 / 52 split; mock bleeds 24 off the left edge; text padded 72 / 64
```

#### 1.5.4 Step 3. Send and receipt (A5, panel left)

**Reuse:** `receipt-slot.tsx` (restyle as a plain white C3 card, no mint, no tear, no perforation; reads `approvedAt`), `lane-receipt.tsx` retires.

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Badge | 3 | | |
| H3 | Sent through the employer's form. Then a receipt. | 8 | Shortened from `entry-05-send-receipt.h2` |
| Body | Kairos saves every field, answer, resume version and confirmation page. Failed submits cost nothing. | 14 | `sendLead` shortened; [PRD user story 7; PRD AC10] |

Copy: 22 words (H3 8, body 14). Card (C3 on a dawn-painting crop, the meadow): SAMPLE chip and **Receipt** header; three rows: **Form · the employer's page**; **Answers · 7 · approved by you**; **Credit · −1 · charged once** (`rows[0]`, `rows[2]`, `rows[6]`, each cut; the Resume row is dropped because step 2 proves it). When the visitor has approved, the Answers row reads **Approved · {approvedAt}** (M12 continuity). Card words: 15 (SAMPLE 1, Receipt 1, rows 13). Floating chip: **Failed · 0 credits** (3 words, `slipAStatus` plus [PRD AC10]). Gate G3 covers this whole step, not only the H3: the extension and the receipt contents are "designed, build status not stated" [facts 1.1]. Until each is confirmed live, ship the 06 `sendLead` gated wording, which labels the extension, and use this body instead: "The extension (in beta) saves every field, answer, resume version and confirmation page. Failed submits cost nothing." (15 words; the section total becomes 41). The H3 stays as written, because "Sent through the employer's form" describes the design and the beta label sits in the body next to the claim it qualifies. The card's three rows and the "Failed · 0 credits" chip carry the SAMPLE chip, so they stay.

#### 1.5.5 Step 4. Replies and the open row (A5, panel right)

**Reuse:** `entry-06-replies.tsx` (rewrite as a step row with a small inbox card); the open-row sentence stays as plain text.

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Badge | 4 | | |
| H3 | Replies come to an address you control. | 7 | `entry-06-replies.h2`, verbatim |
| Body | Replies are tagged to their application. We cannot promise interviews. | 10 | Shortened from `entry-06-replies.body` [PRD core row 6]; the second sentence is the honesty line from `entry-06-replies.openRow` |
| Marker | 8 px hollow square before the body's second sentence (the honesty line). No separate line | 0 | |

Gate G3 (reply tracking, build status not stated): until confirmed live, the first body sentence ships as "Reply tracking (in beta) tags each reply to its application." (10 words instead of 6, section total 35), per the `entry-06-replies.body` gated variant. The honesty sentence is never gated.

Copy: 17 words (H3 7, body 10). Card (C3 on a grain-gradient panel, lilac to amber): SAMPLE chip; three rows **Reply · tagged to 0233**, **Interview request · tagged to 0233**, **Offer · tagged to 0233** (`inbox[0..2]`, the G3-gated variant of row 3). The "Sample inbox" header is dropped. Card words: 14. Section total: 31. No floating chip here: the body's second sentence is the honesty line, and a chip would compete with it.

Placement at 1440 (the ASCII sketch is retired because its copy changed; the text above is authoritative): the intro is centred; steps 1 to 4 are A5 rows at 960 wide, panels 456 x 342 and a row gap of 144, alternating panel left, right, left, right; the spotlight is A6 at 1120 wide between steps 2 and 3. The connector enters each panel at its top centre and leaves at its bottom centre (07 A5). Build it without measuring: because panels are fixed-size and the row gap is a token, the connector is one inline SVG per row gap (not one page-long overlay), `viewBox` equal to the gap box (960 x 144 at 1440), `preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`, `aria-hidden`, `pointer-events: none`. At 1024 and 768 the same segments rescale with the container; the segments next to the spotlight are 1120 / 928 wide and end at the card's centre line. With scroll-driven animations unsupported, or below 1024, or in Reduced, every segment renders fully drawn (no JavaScript fallback below 1024). At 390 the panels stack full width (350 x 280), text sits below each panel (20 gap), and the connector becomes a straight 1.5 px line at x = 12 joining the badges, which move left of the H3.

### 1.6 Dark grain CTA card (A7)

**Purpose.** The kairos line, said once, on the page's only dark surface. **Reuse:** new (about 40 lines plus the C5 CSS).

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| H2 (serif, white, 2 lines) | Kairos is Greek for the right moment. | 7 | `entry-04-approve.kairosLine`, first sentence [CD 3.4] |
| Sub (`--on-dark`, 18 px) | You choose it. Nothing is sent until you do. | 9 | Second sentence plus [PRD one-line idea]. Not `--on-dark-muted`: that token is 10.1:1 on `--dark` but only 4.16:1 on the mid mesh `#5A4F86`, which fails AA for 18 px text. `--on-dark` is 6.56:1 there. Text never sits over `#827BC8` (3.38:1) |
| Inverse button | Start with 25 free applications | 5 | `entry-00-hero.ctaPrimary` |

Copy: 21 words. No trust line, no favicons (07 §11).

```
1440 (--c-narrow 960 x 380, radius 28)              390 (350 x ~400)
┌──────────────────────────────────────────┐        ┌─────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ olive ▓▓ │        │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓   Kairos is Greek for the    ▓▓▓▓▓▓ │        │ ▓ Kairos is Greek   │
│ ▓▓▓      right moment.           ▓▓▓▓▓▓ │        │ ▓ for the right     │
│ ▓▓▓ You choose it. Nothing is sent ▓▓▓▓ │        │ ▓ moment.           │
│ ▓▓▓        until you do.         ▓▓▓▓▓▓ │        │ ▓ You choose it ... │
│ ▓▓▓ [Start with 25 free applications] ▓ │        │ ▓ [Start with 25 ...]│
│ ▓▓▓▓▓▓ periwinkle glow rising ▓▓▓▓▓▓▓▓▓ │        │ ▓▓▓▓ glow ▓▓▓▓▓▓▓▓▓ │
└──────────────────────────────────────────┘        └─────────────────────┘
```

### 1.7 Pricing (A8)

**Purpose.** "A credit is used only for applications that went through", with the real prices and what each buys. **Reuse:** `billing-plans.tsx` (restyle: C6 cards, gradient-ring toggle; price, suffix and allowance read per interval from `plans.ts`; no feature lists and no calculator on the landing), `odometer.tsx` (keep), `calculator.ts` (keep), `format.ts` (keep).

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Pill | Pricing | 1 | `entry-07-billing.eyebrow` |
| H2 (sans, centred) | Pay for applications that went through. | 6 | `entry-07-billing.h2`, verbatim |
| Subline | One credit per submitted application. Failed submits cost nothing. | 9 | `leadGated` shortened [PRC Value metric; PRD AC10]. "Pause any time" is dropped here; the cancel promise moves to the compare Billing row |
| Toggle | Weekly · Monthly · Quarterly | 3 | `intervals` |
| Calculator line | Removed from the landing. The range and sentence live on `/pricing` | 0 | `calcRows[5]`, `computeReceipt` |
| Credit sentence | Removed from the landing; `noteRollover` moves to `/pricing` [PRC Rollover] | 0 | |

Copy: section total 43 (pill 1, H2 6, sub 9, toggle 3, caption 2, plan cards 20, CTA 2). Cards (four C6, 268 wide, 16 gap): plan name, price (48 px tabular) with a period suffix, one allowance line, hairline. Free: **Free · $0 · 25 applications, once** (5 words). Free does not change with the toggle: `plans.ts` sells it once and has no weekly or quarterly price for it (null). Paid: name, price, suffix and allowance are read from `shared/src/plans.ts` for the selected interval (P3), never typed, 5 words each: Monthly **Starter $19 / month · 400 applications**, **Pro $39 · 1,200**, **Max $79 · 3,000**; Weekly **$6 · 94**, **$12 · 280**, **$25 · 700** with "/ week"; Quarterly **$45 · 1,200**, **$95 · 3,600**, **$189 · 9,000** with "/ quarter" [PRC Plans; PRC weekly and quarterly math; PRD AC14 checks the weekly 94]. The toggle must change price, suffix and allowance together: changing only the period word would show $19 beside "a week", which is a false price. A price with no allowance beside it also fails "exact", so each paid card states what it buys. The 06 §22 conflicts stand. The caption **Launch prices.** sits under the cards (14 px `--muted`), because PRC calls these launch prices to be tested with the beta survey [facts 1.3]; the full note (`noteLaunch`) stays on `/pricing`. No feature lists (full lists are on `/pricing`), no taglines, no "Most chosen", and no `proTag` (**Sends with your laptop closed**, 5 words, is dropped for the budget). Pro keeps the `highlighted` flag from `plans.ts` as a 1 px `--ink` border only, with no label and no wording that says it is the popular or recommended plan. One CTA for the section: **Start free**; the plan cards carry no buttons. Confirm that paid plans are chosen after sign-up; if they are not, per-plan Choose buttons return and the section goes to about 49 words. The full launch-price, Stripe and India notes (`noteLaunch`, `noteStripe`, `noteIndia`) move to `/pricing`, which exists; only the two-word "Launch prices." caption stays here.

```
1440 (--c-main 1120)                                    390
                 ( Pricing )                              ( Pricing )
     Pay for applications that went through.              Pay for applications
  One credit per submitted application. Failed ...        that went through.
         [ Weekly | ●Monthly | Quarterly ]                One credit per ...
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Free   │ │Starter │ │Pro ▌   │ │Max     │
│ $0     │ │ $19    │ │ $39    │ │ $79    │
│ 25 apps│ │/ month │ │/ month │ │/ month │
│ once   │ │400 apps│ │1,200   │ │3,000   │
└────────┘ └────────┘ └────────┘ └────────┘
  Launch prices.
  Toggle: [Weekly | Monthly | Quarterly] changes price, suffix and allowance.
  No features, no per-plan buttons.
                  [ Start free ]   (the one CTA)
```

### 1.8 Compare (A9, compare variant)

**Purpose.** The fair contrast, four rows, no names. **Reuse:** `entry-08-compare.tsx` (restyle to the 1 : 2 frame; rows cut from five to four), `compare-poster.tsx` retires.

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Pill | No products named | 3 | Replaces `entry-08-compare.eyebrow` ("Side by side"). It carries the accountability that `entry-08-compare.caption` held ("We do not name products"), so the visitor sees it without a footnote |
| H2 (left column) | How it compares with typical auto-apply. | 6 | `entry-08-compare.h2`, verbatim |
| Column labels | People report · Kairos | 3 | `mobileLabels` |
| Row Jobs | Matches that do not fit · Only jobs past your rules | 1 + 5 + 5 | `rows[0]`, cut |
| Row Resume | Skills they do not have · Every line cites a fact | 1 + 5 + 5 | `rows[1]`, cut |
| Row Billing | Charges after cancelling · Cancel any time. Failed submits cost nothing. | 1 + 3 + 7 | `rows[4]` [PRD problem 6 narrowed; PRC Billing: cancel from the Stripe portal any time; PRD AC10]. The Kairos cell answers the complaint it sits beside (cancelling), which "Charged only when it went through" did not |

Copy: 45 words (pill 3, H2 6, column labels 3, rows 33). Three rows, under the owner's four-row cap. The footnote is dropped: the pill says no products are named, and the left label says "People report", so the left column is attributed as reports, not as measured facts. The Review row is dropped because the spotlight proves edit, then approve. The Replies row (`rows[3]`) is dropped because step 4 shows it. The table is the visual.

```
1440 (--c-narrow 960: left 320, right 600 at x + 360)     390 (stacked)
( No products named )          People report      Kairos      ( No products named )
How it compares with    Jobs   Matches that do    Only jobs past your
typical auto-apply.            not fit            rules
                        ─────────────────────────────────────
                        Resume Skills they do     Every line cites a fact
                               not have
                        ─────────────────────────────────────
                        Billing Charges after     Cancel any time. Failed
                                cancelling        submits cost nothing.
```

### 1.9 FAQ (A9, two-column)

**Purpose.** Six plain answers, collapsed. **Reuse:** `entry-09-questions.tsx` (restyle rows; same `<details>`; same six pairs feed `json-ld.tsx`, keep).

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| Pill | Questions | 1 | `entry-09-questions.eyebrow` |
| H2 (left column) | What people ask before signing up. | 6 | `entry-09-questions.h2`, verbatim |
| Contact line (14 px) | Something else? {supportEmail} | 2 plus the address | `footer.contactEmail` [SITE] |
| Questions (closed rows) | Which job sites does it apply on? · Will recruiters know I used it? · Does it invent experience? · What if a submission fails? · Do you need Gmail access? · Can I upload my resume? | 7 + 6 + 4 + 5 + 4 + 5 = 31 | `faq[0..5].q`, shortened (dropped "to match a job", "my Gmail password or"); `json-ld.tsx` must use the same text |

Copy visible closed: 41 words (pill 1, H2 6, contact 3, questions 31). Six questions stay because the FAQ answer rule presumes a list; this is the one section above the three-item cap, and the owner's FAQ rule governs it. Answers (hidden until opened) are `faq[0..5].a` verbatim; the longest (`faq[1].a`) is 34 words, so all six are inside the 40-word answer cap. The claim chips `see 03` and `see 05` in answers 3 and 4 are dropped (no entries to point to).

```
1440 (--c-narrow 960)                                        390
( Questions )              Which job sites does it apply on?    ⊕   ( Questions )
What people ask            ──────────────────────────────────        What people ask
before signing up.         Will recruiters know I used it?      ⊕   before signing up.
                           ──────────────────────────────────        Something else? hello@...
Something else?            Does it invent experience?        ⊕   Which job sites ...   ⊕
{supportEmail}             ──────────────────────────────────        ───────────────────
                           What if a submission fails?          ⊕   Will recruiters ...   ⊕
                           ──────────────────────────────────        ...
                           Do you need Gmail access?    ⊕
                           ──────────────────────────────────
                           Can I upload my resume?              ⊕
```

### 1.10 Closing (A10, art CTA band)

**Purpose.** End in colour, at dusk, with the one free action. **Reuse:** `entry-10-start.tsx` (rewrite: serif line over the dusk glow; no slip), `approved-line.tsx` for the approved variant of the subline.

| Element | Copy | Words | Source |
| --- | --- | --- | --- |
| H2 (serif, 96 px, 2 lines) | Try it on 25 real applications. | 6 | `entry-10-start.h2`, verbatim |
| Subline (`--ink`, 18 px) | Every application waits for your approval. The free credits never expire. | 11 | `entry-10-start.body` plus `microcopy` second sentence. Colour is `--ink`, not `--body`: `--body` is only 3.76:1 on the coral `#F08A5D` that the glow reaches (4.73:1 on periwinkle, 5.24:1 on amber), while `--ink` is 7.3:1 on coral and 9.2:1 on periwinkle. The text stack still sits inside the canvas-coloured clear ellipse, so this is the worst case, not the expected one |
| Subline, approved variant | You approved the sample at {approvedTime}. Every real application waits the same way. | 14 | `bodyApproved`, shortened |
| Primary | Start free | 2 | `entry-10-start.cta` |

Copy: 19 words (22 in the approved variant).

```
1440 (full bleed, 560 tall; glow periwinkle left, coral and amber right)
   ≈≈≈≈≈≈≈≈≈                                                        ≈≈≈≈≈≈≈≈≈
  ≈≈≈≈≈≈≈≈≈≈≈            Try it on 25                              ≈≈≈≈≈≈≈≈≈≈≈
  ≈≈≈≈≈≈≈≈≈≈≈          real applications.                          ≈≈≈≈≈≈≈≈≈≈≈
   ≈≈≈≈≈≈≈≈≈    Every application waits for your approval.          ≈≈≈≈≈≈≈≈≈
                        The free credits never expire.
                              [ Start free ]
   ~~~~~~~~~~~~~~ glow fades into the footer ground, no hard edge ~~~~~~~~~~~~~
390: 440 tall, 48 px serif, hot colours moved below the button.
```

### 1.11 Footer (A11, art footer)

Detail in section 6. Copy: 35 words (logo 1, tagline 8, headings and links 15, copyright 4, Motion control 3, legal note 4 while G8 is open). **Reuse:** `colophon.tsx` (rewrite), `motion-toggle.tsx` and `motion-preference.tsx` (keep), `footer-clock.tsx` retires.

---

## 2. Honest replacements for the references' dishonest patterns

| Reference pattern | Why Kairos cannot use it | What sits in the slot |
| --- | --- | --- |
| Logo marquee, "leaders are using" (Liftoff), logo strip (Nivara) | No customers; third-party wordmarks imply partnership | A2 commitment strip: "Applies through employer career pages on Greenhouse · Lever · Ashby. We do not automate LinkedIn." Plain text, one neutral glyph, no marquee |
| "Trusted by 500+ agencies" pill with avatars (AGNCE), "Backed by" pill (Nivara) | Counts and backers do not exist | Hero status pill "25 free applications", a fact from [PRD AC1], with the 8 px lime dot. Owner may swap to "Pre-launch" (O1) |
| Floating stat cards with 689, 81%, +51% (Nivara) | No measured outcomes | Floating cards show mechanics, labelled SAMPLE: a fit result that passes the rules, a receipt with its credit row, an approval stamp with the visitor's own time |
| Photo avatars with names (Liftoff) | Would read as real users | Synthetic employers "Company 014", no people, no faces anywhere on the page |
| "Trusted by" favicon row in the dark card (Liftoff) | Same | Nothing under the button |
| Testimonials | None exist | None. The honesty line under step 4 ("We cannot promise interviews.") and the compare pill "No products named" carry the accountability instead |
| "Join thousands of companies" footer tagline (Ironclad) | User count | "Fit-first job applications, sent only when you approve." (the same string as section 6). No numbers |
| Social squares to accounts that do not exist (Ironclad) | Dead links | Omitted until accounts exist (D9) |
| "Try it free for 30 days" (AGNCE), "Request access" scarcity (Liftoff) | Not the offer | "Start with 25 free applications", "Start free"; the 25 and "once" are true [PRD AC1; plans.ts free.features[0]] |
| "50+ integrations" orbit (Nivara) | Three boards, not fifty | The strip names the three |

Numbers that remain on the page and why each is allowed: 25 (free grant, AC1), 48 (fixed sample size, labelled sample), plan prices and allowances for the selected interval (read from `plans.ts`, P3: monthly 19, 39, 79 and 400, 1,200, 3,000; weekly 6, 12, 25 and 94, 280, 700; quarterly 45, 95, 189 and 1,200, 3,600, 9,000; all [PRC Plans], launch prices), −1 and 0 credits (billing rules AC9, AC10), fit 82 and application 0233 (inside SAMPLE cards).

---

## 3. Illustration briefs

Three painted scenes and two procedural treatments. One valley, one day: dawn (hero), mid-morning (spotlight), noon meadow (step 3 panel, optional), dusk (closing glow and footer hills, procedural). Style for all paintings: soft digital painting, no outlines, strong atmospheric perspective, large flat colour fields with visible soft brush edges, **no** anime cloud stacks, barns, cottages, figures or animals; nothing a viewer could attribute to a studio. Record the licence or commission contract next to the files in `web/public/landing/art/LICENSE.md`. Keep layered source files (sky, far ridges, mid ridges, water and path, foreground grasses) so parallax (07 M2) needs no repaint.

### 3.1 Scene A: First light on the valley path (hero)

| | |
| --- | --- |
| Meaning | Kairos is the right moment: the first light reaching a path that leads somewhere specific |
| Placement | A1 hero, full bleed, y 340 to 1000 at 1440, masked top and bottom (07 §5.1) |
| Master | 3200 x 1600 (2 : 1); art-direction portrait crop 1080 x 1350 (4 : 5) for 390 |
| Crop at 1440 | 2.2 : 1, `object-position: 50% 60%` |
| Focal point | The sun's first glint on the river bend, exactly on the centre axis, 60 percent down the art (about y 740 on the page), below the action row and right of the floating card |
| Composition | Horizon at 45 percent of the art height. A pale footpath enters from the lower left foreground (x 10 to 30 percent) and curves toward the river bend at centre. Ridges and a stand of three or four trees in the outer thirds (x 0 to 25 and 75 to 100 percent); the right ridge is slightly taller than the left so the pair does not mirror |
| Calm area | The top 45 percent (sky) and the centre third from y 0 to 55 percent carry no detail: the H1 lower half and subline sit on the faded sky |
| Palette | Sky `#DCE7F2` to haze `#F6DCC8`; sun core `#FBE9CF`; river `#E8A87C` to `#F0BF9A` where the light hits; far ridges `#9C8793`; mid ridges `#B89DA2`; meadow `#A9B48C` to `#C9CFA6`; path `#E9DCC9` |
| Floating-card zones | Left card x 112 to 432, y 620 to 752: must sit where warm meadow meets the cool left ridge (a colour transition, Liftoff). No right card: the right ridge's foot stays painted at low detail. Keep brush detail low inside the card rectangle plus 24 px around it |
| Prompt | "Wide painted landscape of a quiet river valley at dawn, viewed from a low meadow. A pale dirt footpath enters at the lower left and curves toward a bend in the river at the centre, where the first sunlight glints on the water. Soft rounded ridges in mauve and dusty rose on the left and right, taller on the right, with a small stand of trees at the far right edge. The upper half is an open, nearly empty sky grading from pale blue at the top to warm peach haze at the horizon. Flat soft colour fields, visible soft brush edges, no outlines, no clouds with hard edges, no buildings, no people, no animals. Muted warm palette: peach, dusty rose, sage green, pale blue. Calm, still, slightly misty. 2:1 aspect, horizon at 45 percent, centre of the image kept simple." Negative: cartoon, anime, outlines, barn, cottage, people, animals, saturated, dramatic clouds, lens flare. |

### 3.2 Scene B: The footbridge, mid-morning (spotlight)

| | |
| --- | --- |
| Meaning | The decision point: the path crosses the river on a small footbridge. Approving is crossing |
| Placement | A6 spotlight, the art half (about 538 x 560 at 1440, radius 28 on the outer corners), `object-fit: cover`, `object-position: 60% 50%` so the bridge sits right of centre, under the floating card |
| Master | 1800 x 1800 (1 : 1), so the 768 crop (704 x 440, about 1.6 : 1) and the 390 crop (350 x 360) both work |
| Focal point | The bridge's far end where the path continues, at 62 percent x, 55 percent y |
| Composition | Same valley, higher sun, no haze: the ridges from Scene A seen from closer. The river runs from lower left to upper right; a plain plank footbridge (no railing ornament, no roof) crosses it right of centre. Trees only at the far left edge |
| Calm area | The left 45 percent from y 15 to 85 percent: the white mock-up panel covers it (bleeding 24 px off the card), so detail there is wasted. The band between x 45 and 75 percent, y 15 to 35 percent, carries the floating card: keep it sky or still water |
| Palette | Same as A with the haze removed: sky `#CFE0F0`, water `#D7B9A6` with `#F2D9C4` highlights, grass `#A9B48C` to `#8FA07A`, bridge planks `#C9B59A`, ridges `#9C8793` |
| Prompt | "Square painted landscape of a quiet river valley in mid-morning light. A simple wooden plank footbridge without railings crosses a calm river slightly right of centre; a pale footpath leads onto it from the lower left and continues up a gentle grass slope beyond. Soft mauve ridges in the distance, a few trees only at the far left edge. Clear pale blue sky filling the top third. Soft digital painting, flat colour fields, no outlines, no people, no buildings, muted warm palette of peach, sage and dusty rose. Calm and still. 1:1 aspect." Negative as Scene A. |

### 3.3 Scene C: Noon meadow (step 3 panel, optional)

Use a crop of Scene A's meadow (x 55 to 95 percent, y 55 to 95 percent, scaled to 912 x 684 at 2x) unless budget allows a third painting. If painted: 1600 x 1200 (4 : 3), high sun, grass and the path only, no horizon, no ridges; the receipt card covers the centre 72 percent, so the painting is a texture of light on grass with the path crossing the lower left corner. Prompt: "Close painted view of a sunlit meadow at noon, long grass in sage and pale gold, a pale footpath crossing the lower left corner, no horizon, no sky, no objects, soft flat brushwork, no outlines, calm and bright." Step 1's panel is a crop of Scene A's river bend (x 30 to 70, y 50 to 90 percent).

### 3.4 Procedural: dusk glow (closing band) and dusk hills (footer)

The same valley at dusk, built from CSS and one SVG so only one painting master is required (07 §5.2 has the code). Summary of the treatment:

- **Closing glow** (A10): layered `radial-gradient()`s on `::before`, no `filter: blur()`. Periwinkle `#AAB6F2` at 12% 70%; coral `#F08A5D` at 88% 65%; amber `#F2B866` at 72% 90%; a canvas-coloured ellipse at 50% 40% clears the text zone. Grain 8 percent (`soft-light`). Drift M7: translate up to 4 percent, rotate up to 3 degrees, 48 s alternate. Lower edge open into the footer.
- **Footer hills** (A11): one SVG, four ridge paths back to front (dusk violet `#6F74C9` to `#9AA3E6`, rose `#E9A0A8`, olive `#A9A46A` to `#8E9358`, ember `#E07F5E` to `#B4553A` in the corners), vertical gradient fills, a horizon streak `#FFD8CC` with 40 px blur between olive and ember, `feGaussianBlur` 10 to 18 per ridge baked to AVIF 2880 x 840 (about 60 KB). Grain 12 percent added live in CSS. The top ridge fades into the footer ground (`#FBF8F3` to blush `#F7E6E4`) over 64 px. The ridge silhouettes repeat Scene A's left-low, right-high profile so the page ends where it began. Hills height 420 at 1440, 200 at 390. Nothing sits on the hills.
- **Grain tile**: one inline SVG `feTurbulence` (baseFrequency 0.85, 2 octaves, desaturated), 240 px tile, static; opacity 0 to 5 percent on text zones, 8 percent on panels and the glow, 12 percent on the hills, 14 percent (`overlay`) on the dark card.
- **Dark card mesh** (A7): base `#1B1626`; `#5A4F86` and `#827BC8` rising from bottom centre under the button; olive `#6E6A4E` top right (25 percent size); teal `#8FB0BA` bottom right (20 percent); darkening ellipse behind the text. No shader; WebGL is gone from the page.

---

## 4. Visual system deltas from the dark spec

| Area | 02/03 (dark "phosphor") | This plan (light, 07 tokens) |
| --- | --- | --- |
| Canvas | Void `#000000`, Ground Iron `#181818` | `--canvas #FBF8F3` warm paper; `--surface #FFFFFF`; `--sunk #F3EEE7` |
| Ink | Phosphor White `#ddffdc`, Moss, Sage | `--ink #18151F`, `--body #4A4550`, `--muted #625C66` (all AA on every light surface, 07 §6.2) |
| Display type | Inter Tight 400, 48 to 104 px | **Instrument Serif 400** for three moments only (hero 80, spotlight and dark card 52, closing 96); Inter Tight 500 for every other heading (H2 44, H3 30); Inter 400/500 for body and UI |
| Cards | Flat, 8 px radius, 1 px hairline on Ground, dashed "sample" edge | Radius scale 6 to 28 growing with size; white C3 floating cards with warm shadows `0 10px 30px rgb(120 90 60 / 0.12)`; quiet `--sunk` C1 cards without borders; dashed edge dropped, the SAMPLE chip alone carries the meaning |
| Primary CTA | Lime Pulse `#7fee64` pill, one at a time (lime custody) | `--ink` pill, white label, 52 px; same style for every primary action; lime custody retired |
| Lime | The single travelling action fill, the logo mark | **Survives as fill only, 8 px:** the dot in the hero status pill, the "passes" dot on the hero match card and sample-run pass rows, the approved dot on the spotlight floating card. Never text, never a button, never a border. The nav logo mark may stay lime (it is now the only lime larger than 8 px and no longer competes with a lime button); owner confirms (O5) |
| Mint Frost band, perforation, receipt paper, entry rules, graticule ticks, posting squares | Core marks | Retired. The 8 px hollow square survives once, before the honesty line in step 4 |
| Imagery | README budget 0 raster images; DOM and WebGL only | Raster paintings return (Scenes A to C), AVIF with WebP fallback; only the hero art is eager and preloaded (art-directed, see section 9.1 for the per-viewport weights and the page image budget); procedural grain gradients for the rest |
| Accent | None besides lime | `--accent-ember #A4501C` for stat numerals only (prices); `--accent-valley #2C5AA0` optional for body links |
| Motion | "Every motion ends": ink, post, print, feed, tear, travel, hand-off; one pinned stage; Lenis | Soft ambient vocabulary M1 to M12 (07 §8): float, parallax, reveal, connector draw, gradient drift, approve stamp; no pinned stage, no Lenis; CSS first with GSAP ScrollTrigger only as the fallback for M2 and M6 at 1024 and wider |

**What in 02-design-system.md is replaced for the landing route:** §1 token architecture (the `.lp` landing tokens are now 07 §6.1), §3 type scale (07 §7.2), §4 grid, rhythm and spacing (07 §3), §5 surfaces, borders, lime, Mint Frost (07 §4 and §6; Mint Frost removed), §6 Kairos Marks (M1, M2, M3, M5, M7, M10 retire; M4 citation chip, M6 sample chip without the dashed edge, M8 signed numerals and M9 the stamp survive restyled), §7 product UI on the landing (now C3 cards on art), §8 iconography and imagery (raster allowed under 07 §5), §9 contrast table (07 §6.2). §2 font loading stays and gains Instrument Serif (one weight, latin subset, `font-display: swap` with a metrics-matched fallback). The app-wide clarifications in §10 are untouched.

**What in 03-motion-system.md is replaced:** §1 principles ("every motion ends" relaxed for M1 and M7 under the footer Motion control), §2 tokens (durations for print, feed, tear, travel and hand-off go; the three easing curves `--ease-out`, `--ease-in-out`, `--ease-in` from 07 §8 replace the five), §3 choreography grammar, §4 kinetic typography (Ink retired; the H1 is static and is the intended LCP element, see section 9.1 for what keeps it so), §5 scroll conventions (no pinned stage; scroll-driven animations with `animation-timeline: view()` for M2, M5, M6), §7 page-load sequence (no WebGL tiers; M3 story sequence after the H1 paints), §8 engine split, §9 sequences, §10 reduced-motion matrix (07 §8's fallback column). §6 micro-interactions, §11 pause/stop/hide and the Motion control, §12 performance rules and §13 the QA checklist stay, with the canvas rows removed. **04-webgl-scene.md is retired in full.** 05-architecture.md keeps its static-route, copy-module and lint rules; its scene, rail and lime sections retire.

---

## 5. Hero detail

### 5.1 Copy stack (centred, `--c-copy` 760)

| Element | Spec |
| --- | --- |
| Status pill | 32 tall, 14 px padding, `--surface` with 1 px `--hairline`, 14 / 500 `--ink-2`; 8 px `--lime` dot with a 1 px `--ink` ring, then "25 free applications". y 168 (96 below the nav) |
| H1 | Instrument Serif 400, 80 px, line height 1.02, tracking −0.015em, `--ink`, two lines with a hard break after "applications"; measure 640 to 720; `text-wrap: balance`. y 224, about 164 tall. No colour accent on line 2 by default (D7). Fallback if Instrument Serif is rejected: Inter Tight 500 at 72 px, tracking −0.03em (the AGNCE "tight sans" reading) |
| Subline | Inter 400, 18 px, line height 1.55, `--body`, measure 560, two lines. y 408 |
| Action row | 28 below the subline, y 492: one primary pill 52 tall, 0 28 padding, `--ink`, "Start with 25 free applications". No secondary pill (one CTA per section) |
| Text scrim | `radial-gradient(60% 45% at 50% 30%, rgb(251 248 243 / 0.85), transparent 70%)` behind the stack, so the subline and buttons sit on at worst haze `#F6DCC8` (body text 7.1:1) |

At 390: pill y 100 (40 below the nav), H1 44 px (three balanced lines are acceptable; the 2.75rem clamp minimum below 420 px gives two), subline 17 px, the primary button full width, its bottom edge above 667 px at 375 x 667.

### 5.2 Art

Scene A (3.1): full bleed, y 340 to 1000 at 1440 (2.2 : 1 crop), `mask-image: linear-gradient(to bottom, transparent 0%, #000 33%, #000 85%, transparent 100%)`, `object-position: 50% 60%`. The top fade therefore starts behind the lower half of the H1 and is opaque by y 560, just under the action row. Delivery, LCP and layout-shift rules are in section 9.1 (art-directed `<picture>`, fixed-ratio box, gradient placeholder, fade-in). The mask sits on a static wrapper and the parallax layers move inside it, so the mask never moves with the transform. Parallax (M2): far ridges 0.06x, foreground 0.14x, capped at 48 px, 1024 and wider only. Mobile text-over-art rule: at 390 the portrait art starts at y 380 while the subline can run to about y 390, so the scrim stays on at all widths and the top 120 px of the portrait crop is painted as plain sky `#DCE7F2` with no detail.

### 5.3 One floating product card, exact placement over the art

The card is C3: white, 1 px `--hairline`, radius 16, `--sh-float`, 16 px padding, SAMPLE chip top right (22 tall), M1 float ±4 px over 7 s, M3 entrance at 0 ms. It is the hero's only visual card (the second card and the centre chip are dropped for the one-visual budget).

| Card | Box at 1440 | Where on the painting | Content (14 px lines, 20 px rhythm) | Card words |
| --- | --- | --- | --- | --- |
| Match card | x 112 to 432 (320 wide), y 620 to 752 (132 tall) | Foot of the left ridge, where sage meadow meets mauve | Line 1 (15 / 500 `--ink`): **Software Engineer · Company 014**. Line 2: 8 px `--lime` dot, **Fit 82 · passes your rules** (the fit number in `--accent-ember` tabular). No third line | 10 (incl. SAMPLE chip) |

Rule: the card stays in the left third, clear of the copy column and the sun glint. At 1024: 280 wide at x 40, y 600. At 768: centred on the art, 320 wide, y 620. At 390: the card leaves the art and sits in normal flow 24 px under the hero, full width minus 20 px gutters.

### 5.4 Hero word count

Copy 30 (pill 3, H1 5, subline 17, CTA 5); card words 10 (SAMPLE 1, line 1 4, line 2 5). Total 40. Nothing else is in the hero: no secondary button, no centre chip, no microcopy, no lane caption, no claim chip.

---

## 6. Footer detail (Ironclad structure, Kairos content)

Container `--c-wide` 1280, 80 px gutters at 1440. Text zone grain 5 percent; hills 12 percent.

| Band | Spec |
| --- | --- |
| Link band (y 80 from the footer top) | **Left brand block (40 percent):** logo lockup (lime glyph if O5 is yes, otherwise `--ink`; wordmark Inter Tight 500, 28 px tall); 24 below, tagline Inter 400, 15 px, two lines, `--body`: "Fit-first job applications, sent only when you approve." (8 words, no numbers). No social row (D9). **Right link group**, content-width columns with a fixed 96 px gap, pushed to the right edge, top-aligned to the logo, from `siteConfig.footer` verbatim: **Product**: How it works · Pricing · Blog; **Company**: About · Careers · Contact; **Legal**: Terms · Privacy · Cookies · Refunds. All ten routes exist in `web/app/(public)` and `web/app/(legal)`. Column heading 15 / 500 `--ink`; links 15 / 400 `--body`, 32 px pitch, heading to first link 48 px (Ironclad rhythm) |
| Hairline | 1 px `--rule #D8CFC3`, full container width, 64 below the last link |
| Legal row (24 below the hairline) | Left, 14 px `--muted`: "© {BUILD_YEAR} Gray Matter Labs" (`footer.copyright`; legal entity per D10). Centre, 14 px `--muted`, only while G8 is open: "Legal pages under review." (`footer.legalNote`, shortened). Right: the Motion control (`motion-toggle.tsx`, compact variant, "Motion: Full · Reduced") |
| Dusk hills | Start 24 below the legal row; 420 tall at 1440; the baked AVIF from 3.4 plus live grain. Nothing sits on them |

Dropped from the dark footer: the page receipt table, the chronos clock line, the kairos definition line, the contact caption (the email moved to the FAQ's left column).

```
1440                                                                     390
┌─────────────────────────────────────────────────────────────────────┐  ┌──────────────────┐
│ ◼ Kairos                      Product       Company      Legal      │  │ ◼ Kairos         │
│ Fit-first job applications.   How it works  About        Terms      │  │ Fit-first job... │
│ sent only when you approve.   Pricing       Careers      Privacy    │  │                  │
│                              Blog          Contact      Cookies    │  │ Product  Company │
│                                                          Refunds    │  │ How it w. About  │
│ ──────────────────────────────────────────────────────────────────  │  │ Pricing  Careers │
│ © 2026 Gray Matter Labs   Legal pages under review.  Motion: Full · Reduced │  │ Blog     Contact │
│                                                                     │  │ Legal            │
│ ~~~~~ ground fades to blush ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ │  │ Terms  Privacy   │
│ ▒▒▒▒▒▒▒▒ violet back ridge ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │  │ Cookies Refunds  │
│ ▓▓▓▓▓ rose ▓▓▓▓▓▓▓▓▓▓ ─── horizon streak ─── ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ──────────────── │
│ ████ olive ████████████████████████████████████████████████████████ │  │ © 2026 Gray M... │
│ ██████ ember corners ███████████████████████████████████████████████ │  │ Motion: Full·Red.│
└─────────────────────────────────────────────────────────────────────┘  │ ▒▒▒ hills 200 ▒▒ │
                                                                         └──────────────────┘
```

---

## 7. Reuse map: every Drop 1 file

Keep = logic and markup stay, tokens change through CSS. Restyle = same component, new classes and trimmed props. Rewrite = new markup, same data. Delete = not in the reference structure.

### `web/components/landing/`

| File | Action | Note |
| --- | --- | --- |
| `landing-shell.tsx` | Restyle | Remove the rail, tape, lime custody and stage mounts; keep the skip links, header and `main` |
| `landing.css` | Rewrite | 07 §6.1 tokens under `.lp`, containers, radius and shadow scales, grain tile |
| `motion.css` | Rewrite, but keep three things | M1 to M12 keyframes, reduced-motion and Motion-control overrides. Keep (a) the `kt-odometer` rules and the `--dur-*` token swap on `.lp` that `odometer.tsx` relies on for its reduced-motion behaviour, (b) the rule that hidden start states exist only under a JavaScript-written attribute (`data-post="pending"`), so M3 and M5 content is visible with scripts off, (c) the `html[data-motion="reduced"]` selector as the single reduced-motion switch. `MotionPreference` writes that attribute from the stored choice, else `prefers-reduced-motion`; every new M-rule must be gated on it (and on the media query as a first-paint backstop), otherwise the footer Motion control would not stop CSS-only loops such as M1 and M7 |
| `json-ld.tsx` | Keep | Same six FAQ pairs; `og:image:alt` text updates to describe the light page |
| `entries/entry.tsx` | Rewrite | Becomes `section-intro.tsx` (pill, H2, subline, optional control) plus `step-row.tsx` (badge, H3, body, panel, connector anchor) |
| `entries/entry-00-hero.tsx`, `.css` | Rewrite | A1 with Scene A and one floating card |
| `entries/entry-01-reported.tsx`, `.css` | Rewrite | A3 trio; the five-row table and settle cells go |
| `entries/entry-02-fit-gate.tsx` | Rewrite | Step 1 row |
| `entries/entry-03-truth-lock.tsx` | Rewrite | Step 2 row |
| `entries/entry-04-approve.tsx` | Rewrite | A6 spotlight |
| `entries/entry-05-send-receipt.tsx`, `.css` | Rewrite | Step 3 row; the 200vh pinned stage, mint band, compact slips and "how it sends" columns go |
| `entries/entry-06-replies.tsx`, `.css` | Rewrite | Step 4 row with the honesty line |
| `entries/entry-07-billing.tsx` | Restyle | A4 intro plus `BillingPlans`; drop the credit ledger table and the three notes (moved to `/pricing`) |
| `entries/entry-08-compare.tsx` | Restyle | 1 : 2 frame, three rows, no chips |
| `entries/entry-09-questions.tsx`, `.css` | Restyle | New row style (28 px icon circle), same `<details>` |
| `entries/entry-10-start.tsx`, `.css` | Rewrite | A10 serif closing over the dusk glow |
| `entries/colophon.tsx`, `.css` | Rewrite | A11 footer |
| `islands/approve-sample.tsx` | Restyle plus cut (217 lines) | Compact rows; Edit stays in code but not visible on the card (1.5.3). Same `approve` store write. Remove the R2 `IntersectionObserver` that prints `04awaiting`, the `stampPrinted` rAF state and the `DESKTOP` match (they exist for the retired ledger print lines), and the `ledgerStore.print` calls. Keeps `JS_ONLY` so the button is hidden without script. Its Tailwind classes (`lp-btn`, `border-border`) must be re-pointed at the 07 tokens |
| `islands/approved-line.tsx` | Keep | Drives the closing subline and the spotlight's approved time |
| `islands/billing-plans.tsx`, `.css` | Restyle plus cut (356 lines) | C6 cards (name, price, period), gradient-ring toggle; no feature lists, no calculator on the landing. Remove the calculator half of the reducer, the `PostingSquare` and `Check` imports (posting-square is deleted) and `calculator.ts` calls except `creditsPerInvoice` for the allowance line. It already reads `PLANS` from `@auto-career/shared` (`shared/src/plans.ts`, which has `priceUsd` per interval with `null` for Free weekly and quarterly, and `highlighted` on Pro), so the interval-aware price needs no new data. Re-check its dependency on `@/components/shared/pricing-plans` (`PER`) |
| `islands/citation-demo.tsx`, `.css` | Rewrite | Compact: one button, one refusal; about 120 lines |
| `islands/compare-poster.tsx` | Delete | |
| `islands/entry-caption.tsx` | Delete | No entries |
| `islands/entry-poster.tsx` | Delete | No slip |
| `islands/footer-clock.tsx` | Delete | |
| `islands/lane-receipt.tsx`, `.css` | Delete | |
| `islands/ledger-rail.tsx`, `.module.css` | Delete | |
| `islands/lime-custody.tsx` | Delete | |
| `islands/motion-preference.tsx` | Keep | |
| `islands/motion-toggle.tsx` | Keep | Compact variant in the legal row |
| `islands/odometer.tsx` | Keep | Prices and the sample-run counts |
| `islands/open-row.tsx` | Delete | The honesty line is static text |
| `islands/receipt-slot.tsx` | Rewrite (not restyle) | The 181-line file is built around the retired band: it queries `[data-band-intro]` and `.en05-layer`, drives the mint/tear states and imports `Perforation` and `ReceiptPaper`, which this plan deletes. Keep only: read `approvedAt`, three rows, the in-place approve is dropped (the spotlight owns Approve), the `rowPrintedLive` live region becomes a plain `role="status"` line. Target about 50 lines |
| `islands/receipt-tape.tsx`, `.module.css` | Delete | |
| `islands/sample-run.tsx` | Rewrite | Compact: one radio pair, three rows (one with its full reason), one count line; `computeRun` unchanged. The current file (325 lines) imports `PostingSquare` and has four controls and a card grid; none of that carries over. Keep the `useHydrated` gate and the debounced live region |
| `islands/settle-cell.tsx` | Delete | |
| `marks/chip.tsx` | Restyle | `SampleChip` and `CitationChip` keep (light skin); `ClaimChip` deleted |
| `marks/entry-rule.tsx` | Delete | |
| `marks/perforation.tsx` | Delete | |
| `marks/posting-square.tsx` | Delete | Replaced by the 8 px lime dot (CSS only) and the single hollow square in step 4 (CSS only) |
| `marks/receipt-paper.tsx` | Delete | |
| `marks/sample-frame.tsx` | Rewrite | Becomes `floating-card.tsx` (C3) with the chip slot; dashed edge gone |
| `marks/stamp.tsx` | Restyle | The signature line inside the spotlight floating card |

### `web/lib/landing/`

| File | Action | Note |
| --- | --- | --- |
| `sections.ts` | Restyle | Keep the ids as copy keys and anchors; drop `SceneStateId`, `scene` and `inStory` |
| `env-store.ts` | Restyle | Keep `MotionMode`; drop `Tier` |
| `scene-input.ts` | Delete | |
| `calculator.ts` | Keep | |
| `format.ts` | Keep | |
| `debits.ts` | Delete | |
| `fit-run.ts` | Keep | |
| `use-hydrated.ts` | Keep | |
| `ledger-store.ts` | Restyle | Keep `approvedAt` and its session persistence; drop `printed`, `feedDone`, `RULES_CHANGED_MAX` and the print-line ids. Consider renaming to `approve-store.ts` |

### `web/content/`

| File | Action | Note |
| --- | --- | --- |
| `landing-copy.ts` | Rewrite | New top-level keys (`hero`, `strip`, `problems`, `howItWorks`, `step1` to `step4`, `spotlight`, `darkCard`, `pricing`, `compare`, `faq`, `closing`, `footer`, `nav`, `meta`); strings from this document; the copy lint (06 §21) still runs on it |
| `fit-sample.json` | Keep | |
| `claims.ts` | Delete | No claim chips and no page receipt; remove the claims-register test with it |

---

## 8. Open decisions for the owner

| # | Decision | Proposed default |
| --- | --- | --- |
| O1 | Hero status pill: "25 free applications" (a fact) or a launch-state pill such as "Pre-launch" or "Waitlist open" (must be true on launch day; D8) | "25 free applications". If the primary action is a waitlist rather than sign-up, the pill becomes "Waitlist open" and both primary buttons read "Join the waitlist" |
| O2 | Spotlight art: commission Scene B (the footbridge) or crop Scene A | Commission B; it is the one place the painting carries the Approve meaning. If budget allows only one master, crop A's river bend at `object-position: 65% 55%` |
| O3 | Compare at 45 words with three rows (Jobs, Resume, Billing), or the four-row version at about 56 words | Three rows, to meet the 45 budget; the owner's four-row cap stays as a maximum |
| O4 | Pricing calculator on the landing (one range plus one line), or none (the full one lives on `/pricing`) | None. A range is a second control, and the line is extra words. The "if you use few, it is higher" case moves to `/pricing`. The owner may reinstate one 7-word line |
| O5 | Lime logo mark in the nav and footer, now that no lime button competes with it | Yes, lime glyph; lime stays fill-only everywhere else |
| O6 | Pricing cards show plan, price, period and the application allowance only: no features, no per-plan buttons, and Free is shown as a card | Yes, to meet the 45 budget. The allowance stays because a price without what it buys is not exact. Feature lists (up to four per card) would add about 45 words; confirm that paid plans are chosen after sign-up (see 1.7) |
| O7 | Hero has one floating card and one CTA (07 A1 had two cards and a secondary button) | One card and one CTA. The owner may add the second card if the hero budget is raised |

Carried over unchanged from 07 §10: D3 (raster art and the LCP budget of 2.0 s desktop, 2.5 s mobile), D5 (Instrument Serif), D6 (painting source and rights record), D9 (no social row until accounts exist), D10 (legal entity in the copyright).

---

## 9. Feasibility and accessibility gates

Added after a feasibility review. Each item is a build requirement; the numbers are targets to verify, not measurements.

### 9.1 Hero LCP, image weights and layout shift

**Which element is the LCP.** The painting (about 1440 x 655 at 1440, 350 x 437 at 390) is far larger than the H1 (about 700 x 164), so by default the browser reports the painting as the LCP element, which contradicts "the H1 is the LCP". To keep the headline as the LCP:

1. The painting paints under a CSS-gradient placeholder in its own colours (gradients are not LCP candidates) and fades in from `opacity: 0` once decoded (`img.decode()` then a class, 400 ms). Chrome does not report zero-opacity images as LCP candidates. The Reduced fallback is the same image at full opacity with no transition, which is allowed to become the LCP.
2. Verify with a trace on a throttled mobile profile (4x CPU, Slow 4G) in the performance gate. If the painting is still reported as LCP, keep the fade and accept the painting as LCP under the D3 budget (2.0 s desktop, 2.5 s mobile, p75 field), because the page must ship either way. Do not delay the image to game the metric: it loads at `fetchpriority="high"` in the background.
3. The H1 text must be in the server HTML and visible with scripts off. Instrument Serif is preloaded (`<link rel="preload" as="font" type="font/woff2" crossorigin>`, latin subset, about 25 KB), `font-display: swap`, with a fallback face adjusted by `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override` to the Instrument Serif metrics so the swap moves no line (the H1 is `text-wrap: balance` with a hard break, so a width mismatch would otherwise re-wrap it).

**Art-directed delivery.** `next/image` does not do art direction, so the hero uses a hand-written `<picture>` with an AVIF `<source media="(max-width: 767px)" srcset="hero-p-780.avif 780w, hero-p-1080.avif 1080w">`, the same for WebP, then the landscape sources, plus matching `<link rel="preload" as="image" imagesrcset imagesizes media>` tags for each media branch, so a phone never downloads the landscape file. `sizes="100vw"`. Explicit `width` and `height` on the `<img>`.

**Weights (AVIF q about 50, WebP fallback about 1.4x).** Painted soft-brush art compresses worse than flat vector, so these are targets to hit in the first export, not guarantees; if the first export misses, reduce detail in the outer thirds before raising quality.

| Asset | Served at | Target AVIF | Loading |
| --- | --- | --- | --- |
| Hero landscape, DPR 1 at 1440 | 1600 w | 120 KB or less | eager, preloaded |
| Hero landscape, DPR 2 | 2400 w | 200 KB or less | eager, preloaded (selected by `srcset`) |
| Hero landscape at 1024 and 768 | 1080 w | 80 KB or less | eager |
| Hero portrait, 390 at DPR 2 and 3 | 780 w and 1080 w | 70 KB and 110 KB or less | eager |
| Step 1 and 3 panels (crops, 2x) | 912 x 684 | 40 KB or less each | lazy |
| Scene B (spotlight) | 700 w (390 and 768), 1080 w (1440) | 45 KB and 70 KB or less | lazy |
| Footer hills | 1440 w, 780 w (390) | 35 KB and 15 KB or less (the 2880 x 840 master, about 60 KB, is served only at DPR 2 desktop) | lazy |

Page image budget: 350 KB or less at DPR 1 desktop, 250 KB or less on a DPR 2 phone, counting everything a visitor loads by scrolling to the footer. Only the hero art is eager. Smooth gradients band under AVIF at q50: encode the footer hills at q60 or add a baked 1-bit dither, and rely on the live 12 percent grain to hide the rest.

**No layout shift.** The hero art box has a fixed height per breakpoint (1000, 920, 900 and `min(100svh + 160, 860)`, as in 07 A1) and the picture is absolutely positioned inside it, so nothing below moves when it loads. Every other image has `width` and `height` or an `aspect-ratio` (4 : 3 panels, 1 : 1 Scene B, footer hills fixed at 420, 340, 280 and 200). The page CLS target is 0.02 or less.

### 9.2 Contrast gates

The tokens in 07 §6.2 cover flat surfaces. Text over gradients is where AA gets lost, so:

1. The two checked failures are fixed above: dark-card sub text uses `--on-dark`, and the closing subline uses `--ink`.
2. Text over a gradient or painting is tested on rendered pixels, not tokens. The accessibility gate screenshots the hero, the dark card and the closing band at 1440 and 390 in Full and Reduced, samples the background under each text box (worst pixel of the box, grain included) and fails the build below 4.5:1 for text under 24 px (18.66 px bold) and below 3:1 above that.
3. The lime dot is 1.47:1 on white. It never carries meaning alone: the hero pill, the "Fit 82 · passes your rules" line and the approved line all say the state in text. Keep the 1 px `--ink` ring on every lime dot, not only the pill's.
4. Focus rings are 2 px `--ink` with a 3 px offset on light surfaces and `--on-dark` on the dark card; they stay visible on the white floating cards over art.

### 9.3 Reduced motion for every motion

Each motion has a defined end state when Reduced is chosen (OS setting or the footer Motion control, both writing `html[data-motion="reduced"]`):

| Motion | Where | Reduced |
| --- | --- | --- |
| M1 float, M7 drift | Hero card, spotlight card, chips, glow, dark card | Static; loops also pause when off screen |
| M2 parallax | Hero art | Layers flattened |
| M3, M5 entrances | Hero card, cards, plan cards | Final state at first paint |
| M6 connector | Step connectors | Fully drawn |
| M8 toggle slide, odometer | Pricing, sample-run counts | Instant (the odometer already goes to 0.01 ms through the duration tokens) |
| M9 accordion | FAQ | Instant |
| M12 approve stamp | Spotlight card | Final state, announced by the live region |
| Refusal animation (320 ms line fall) | Step 2 card | `citation-demo.tsx` already skips it when `getEffectiveMotion() === "reduced"` and shows the result chip; keep that branch in the rewrite |
| Hero image fade-in (9.1) | Hero | No fade |
| Menu sheet slide | Nav below 1024 | Instant |

WCAG 2.2.2: nothing auto-plays for more than 5 seconds as information, and the loops are decorative. The Motion control is in the footer, so the OS setting is the first-class path; if the owner wants it earlier, add a compact Motion control to the mobile menu sheet. With Reduced active, no content waits for a scroll trigger.

### 9.4 No horizontal scroll

1. Full-bleed bands use `width: 100%` (never `100vw`, which includes the scrollbar and overflows on Windows) and the band wrapper has `overflow: clip`. The drifting glow (translate 4 percent, rotate 3 degrees) and the parallax layers live inside that clipped wrapper.
2. `main` carries `overflow-x: clip` as a safety net, not as the fix. `overflow: hidden` on `body` is not used, because it breaks `position: sticky` on the nav.
3. The only deliberate overhangs are the spotlight mock (24 px off the card edge) and step chips (16 to 24 px off the panel edge). Both are at most half the side gutter wherever they overhang (1440: 160, 1024: 48). At 768 and 390 nothing overhangs sideways: chips overlap the panel's bottom edge vertically only, and the mock is inset. The spotlight card therefore cannot use `overflow: clip` on its outer element; clip the art half only.
4. At 390: pricing is a single column; the compare rows stack; footer link groups are a 2 + 1 grid; the legal row wraps (copyright, legal note, Motion control, each on its own 44 px line). "Start with 25 free applications" on a full-width 17 px button wraps to two lines rather than clipping.
5. Test: Playwright at 320, 375, 390, 768, 1024 and 1440 asserting `document.documentElement.scrollWidth <= clientWidth`, also at 200 percent text zoom and in Reduced.

### 9.5 Mobile wireframes for the sections that lacked them

390 wide, 20 gutters, 350 content.

```
Step row (1 of 4)               Spotlight                    Pricing (Free first)
┌─────────────────┐             ┌─────────────────┐          ( Pricing )
│ panel 350 x 280 │             │ painting 350x360│          Pay for applications
│ ┌─card 86%────┐ │             ├─────────────────┤          that went through.
│ │ SAMPLE ...  │ │             │ mock, inset 16  │          One credit per ...
│ └─────────────┘ │             │ [Approve sample]│          [Weekly|Monthly|Qtr]
│  chip inside    │             │ Awaiting your   │          ┌───────────────┐
└─────────────────┘             │ approval (flow) │          │ Free  $0      │
 20 gap                         │ ( The moment )  │          │ 25 apps, once │
 (1) A fit gate before          │ Nothing is sent │          ├───────────────┤
 anything else.                 │ until you       │          │ Starter $19   │
 Role, location ...             │ approve it.     │          │ /month 400    │
 line at x=12 joins badges      └─────────────────┘          ├─ Pro (ink) ───┤
                                                             └───────────────┘
 Toggle: 3 segments, 44 tall, one row, 350 wide               Launch prices. [Start free]
```

Pricing at 1024 and 768 is 2 x 2 (07 A8). At 1024 four columns would be 220 wide; "$189 / quarter" at 48 px is about 150 px wide and fits, but the allowance line would wrap, so 2 x 2 is kept.

### 9.6 Smaller feasibility notes

1. Nav below 1024: the menu is a client island. Without JavaScript the three links are not reachable from the header, so Start free stays visible at 390 and the footer carries every route. The sheet closes on Escape and on link press, traps focus while open, and returns focus to the menu button.
2. The hero scrim is plain CSS, so it applies in every mode.
3. Instrument Serif is used at 52 px and up only, so the serif never renders small on a phone.
4. The commitment strip glyph is one inline SVG used three times, so it makes no request. Hero, strip, trio, steps and spotlight text are server-rendered; the client islands are sample-run, citation-demo, approve-sample, receipt-slot, billing-plans, the nav sheet, motion-toggle and motion-preference.
5. In section 7, `receipt-slot.tsx`, `approve-sample.tsx` and `billing-plans.tsx` are cuts or rewrites, not restyles; plan the build effort accordingly.
