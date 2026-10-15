# Section spec: entry 07, Honest billing and pricing

Section id `entry-07-billing` · anchor `#entry-07` · heading `#entry-07-title` · tier standard · WebGL state `none` · scroll budget 200vh (a target, see 3.6) · previous `entry-06-replies` (`slip-reply`) · next `entry-08-compare` (`none`).

Source documents: 01-creative-direction (CD), 02-design-system (DS), 03-motion-system (MS), 04-webgl-scene (WS), 05-architecture (AR), 06-copy-deck (CP), `shared/src/plans.ts`, `docs/pricing.md`. References such as "CD 9.3" point at those files.

---

## 1. Purpose and narrative beat

**Purpose.** Make cost legible. A visitor who has watched one application move from fit gate to approval to receipt now learns exactly what a credit costs, what a failed submission costs (nothing), and what their own number of applications would cost. Every figure is either a launch price from `docs/pricing.md` (read from `shared/src/plans.ts` at build, gate P3), an arithmetic result of those prices, or a labelled sample.

**Beat: Settlement.** Every charge has a row, and you can read all of them. This entry settles entry 01 row 05 ("Charges after cancelling, and lost credits"). When entry 07 posts, that row flips from "open · see 07" to "settled in 07" and stays settled.

**What the visitor must leave knowing, in order:**

1. One credit is spent per submitted application. A failed submit, a duplicate report and an unused free grant never cost money (the sample credit ledger).
2. The four plans and the three billing intervals, with the full-use price per application: $0.048, $0.033, $0.026 at Monthly (and the Weekly and Quarterly equivalents).
3. What their own number costs, including the weak case (few applications, high price per application), shown next to the full-use price (the receipt calculator, the signature).
4. The launch-price, Stripe, USD, cancel and rollover rules.

**Signature moment: the receipt calculator.** Plan, interval, submitted and failed inputs produce ledger rows such as "Failed 3 × 0 credits · $0.00" and the price per submitted application at the visitor's own number (integer thousandths arithmetic), placed beside the full-use price. Every value rolls as an odometer in 240ms. A graticule ruler (the M1 motif) carries a single bright tick that slides to the visitor's usage share, so the visitor sees both the number and where it sits. The page prints the weak case at the same size as the strong case. That is the accountable gesture of this section: the pricing section refuses to show only the best number.

**Interaction model.** This entry is the page's only interactive pricing surface. Scroll never changes a price. Only the visitor's input changes values. There is no pin, no scrub and no WebGL.

---

## 2. Content (final copy from 06-copy-deck.md, verbatim; flag any change you need and why)

All strings live in `landingCopy["entry-07-billing"]` (`web/content/landing-copy.ts`). Plan names, taglines, prices, allowances and feature strings are read from `PLANS` in `@auto-career/shared`; the copy deck repeats them for review only and the file wins on any difference. Typographic rules: U+00B7 middle dot appears only in this document's tables as a cell separator, never as page text between words, except in the receipt notation the deck defines; U+2212 for negative credits; no em or en dashes.

### 2.1 Header block

| Key | Element | Copy |
| --- | --- | --- |
| `number` | Entry number (Caption) | 07 |
| `eyebrow` | Caption, uppercase | Pricing |
| `h2` | H2 | Pay for applications that went through. |
| `lead` | Lead (20px; 18px below 768) | One credit per application that actually went through. Failed submits cost nothing. Pause any time, and we pause for you when an offer email arrives. Weekly plans for searches that end fast. |
| `leadGated` | Lead when G3 says reply tracking is not live (build flag `FEATURES.replyTracking === false`) | One credit per application that actually went through. Failed submits cost nothing. Pause or cancel any time. Weekly plans for searches that end fast. |
| `leadChip` | Claim chip M5, inline after the sentence "Failed submits cost nothing." | see 05 (accessible name: See entry 05, Send and receipt) |
| `settles` | Settlement line, with a filled posting square before it | Settles 05. Every charge has a row, and you can read all of them. |

### 2.2 Sample credit ledger (dashed frame, SAMPLE chip)

| Key | Element | Copy |
| --- | --- | --- |
| `ledgerCaption` | `<caption>` | Sample credit ledger. Every credit movement is one row you can read in the app. |
| `ledgerHeaders` | `<th scope="col">`, four cells | Date · Entry · Credits · Note |
| `ledger[0]` | Row | sample · Free grant · +25 credits · never expires |
| `ledger[1]` | Row | sample · Submitted · −1 credit · receipt kept |
| `ledger[2]` | Row | sample · Failed submit · 0 credits · reason shown, nothing charged |
| `ledger[3]` | Row | sample · Duplicate report · 0 credits · charged once already |
| `shared.sampleChip` | Chip | SAMPLE (accessible name "Sample data") |

### 2.3 Interval switch and plan cards

| Key | Element | Copy |
| --- | --- | --- |
| `intervalLegend` | `<legend>` | Billing interval |
| `intervals` | Three radios, default Monthly | Weekly · Monthly · Quarterly |
| `intervalLive` | Polite live region after a change | Showing {interval} prices. ({interval} is the lowercase label: weekly, monthly, quarterly) |
| `perCycleLabel` | Allowance label, Monthly | submitted applications per 30 days |
| `perWeekLabel` | Allowance label, Weekly | submitted applications per week |
| `perQuarterLabel` | Allowance label, Quarterly | submitted applications per quarter |
| `fullUseLabel` | Label after the full-use figure | per application at full use |
| `proTag` | Neutral outlined tag on the Pro card | Sends with your laptop closed |
| `planCtaAria` | Accessible name template for paid plan buttons | {cta}, {price} {intervalWord} (example: Choose Pro, $39 a month) |
| `intervalWords` | Template words | a week · a month · a quarter |
| `resumeProfiles` | List row on every card | {n} resume profile(s): 1 resume profile, 1 resume profile, 3 resume profiles, 10 resume profiles |

| Plan | Price (Monthly) | CTA | Tagline | Feature strings rendered (verbatim from plans.ts, after the render rules in 2.7) |
| --- | --- | --- | --- | --- |
| Free | $0 | Start free (href `/sign-up`) | Try it on 25 real applications. | 25 submitted applications, once (shown as the allowance line) · Fit gate with reasons on every match · Truth-locked resume tailoring · Edit everything before it sends · Chrome extension apply · Reply tracking by forwarding · 1 resume profile |
| Starter | $19 | Choose Starter | For a steady search at your own pace. | Everything in Free · Tailored cover letters · Answer memory you approve · Failed submits refunded automatically (see flag F3) · 1 resume profile |
| Pro | $39 | Choose Pro (lime when it owns custody) | Applies even when your laptop is closed. | Everything in Starter · Cloud applier: sends approved applications with your browser closed · Weekly outcome report and targeting suggestions · 3 resume profiles |
| Max | $79 | Choose Max | For urgent searches: OPT clocks, layoffs. | Everything in Pro · Priority polling: new postings checked every few minutes · Priority support · 10 resume profiles |

Paid-plan allowance line (replaces the plans.ts string "400 submitted applications per 30 days" and its siblings): `{credits}` + one space + the interval label above. The three price rows by interval:

| Plan | Weekly | Weekly allowance | Weekly full use | Monthly | Monthly allowance | Monthly full use | Quarterly | Quarterly allowance | Quarterly full use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Starter | $6 | 94 | $0.064 | $19 | 400 | $0.048 | $45 | 1,200 | $0.038 |
| Pro | $12 | 280 | $0.043 | $39 | 1,200 | $0.033 | $95 | 3,600 | $0.026 |
| Max | $25 | 700 | $0.036 | $79 | 3,000 | $0.026 | $189 | 9,000 | $0.021 |

Free in the price slot: Monthly view `$0` with suffix `once`; Weekly and Quarterly views read `Monthly only` (deck 12.4, see flag F5). Allowances come from `creditsPerInvoice(planId, interval)` (prerequisite P3); full-use figures come from `computeReceipt` so cards, calculator and tests share one function.

### 2.4 Receipt calculator (dashed frame, SAMPLE chip)

| Key | Element | Copy |
| --- | --- | --- |
| `calcTitle` | H3 | Your receipt for one cycle |
| `calcIntro` | Body | Pick a plan and enter how many applications you expect to submit. The receipt shows what one cycle would cost and the price per submitted application at your number. |
| `calcPlanLabel` | `<label>` for the select | Plan (options Starter, Pro, Max; default Pro) |
| `calcIntervalNote` | 14px note | Uses the billing interval selected above. |
| `calcSubmittedLabel` | `<label>` for range and number | Submitted this cycle |
| `calcSubmittedValueText` | `aria-valuetext` on the range | {n} submitted applications |
| `calcFailedLabel` | `<label>` for number | Failed this cycle |
| `calcFailedHelp` | Help text, linked by `aria-describedby` | Failed submits are shown here so you can see that they cost $0.00. |
| `calcRows[0]` | Row | Plan charge · {price} (example $39.00) |
| `calcRows[1]` | Row | Credits included · {credits} (example 1,200) |
| `calcRows[2]` | Row | Submitted × 1 credit · {n} credits (1 credit at n = 1) |
| `calcRows[3]` | Row | Failed × 0 credits · $0.00 (changed, see C1: label renders as "Failed {f} × 0 credits") |
| `calcRows[4]` | Row | Credits remaining · {remaining} |
| `calcRows[5]` | Row, numeral size | Price per submitted application at your number · {perApp} |
| `calcRows[6]` | Row, numeral size, secondary colour | Price per application at full use · {fullUse} |
| `calcZero` | Replaces the value of row 5 when submitted is 0 | No submitted applications. You still pay the plan price. |
| `calcLive` | Polite live region, 500ms after input stops | {plan}, {interval}. {n} submitted. {perApp} per submitted application. Plan charge {price}. (at n = 0 the third sentence is `calcZero`) |
| `honesty` | Body under the calculator, outside the frame | The more of your credits you use, the lower the price per application. If you use few, it is higher. The calculator shows both. |

### 2.5 Notes

| Key | Element | Copy |
| --- | --- | --- |
| `noteLaunch` | Body | Launch prices. They may change for new customers. Existing subscribers keep their price for at least 90 days after any change, with 30 days' notice. |
| `noteStripe` | Body | Billing is in US dollars through Stripe. Cancel any time from the Stripe customer portal; access runs to the end of the paid period. |
| `noteRollover` | Help text (14px) | Unused paid credits roll over while you subscribe, up to two invoices' worth. The free credits never expire. |
| `noteIndia` | Body, shown to every visitor | Prices are in US dollars for every country. Regional pricing for India is not in this version. |

### 2.6 Data-only strings used without a deck key

| String | Where | Source |
| --- | --- | --- |
| `/week`, `/month`, `/quarter`, `once` | Price suffix under each price numeral | `PER` map exported from `pricing-plans.tsx` (AR 7.1). Add to the deck as `entry-07-billing.priceSuffix` |
| Weekly, Monthly, Quarterly | Calculator header caption "{Plan} · {Interval}" | `INTERVAL_LABEL` export |
| Credits at the ruler ends | Caption numerals "0" and "{credits}" | computed |

### 2.7 Render rules for plans.ts strings (so the page never contradicts itself)

1. `features[0]` of every plan names its allowance and is interval specific ("400 submitted applications per 30 days"). At Weekly and Quarterly it would be false. The card therefore renders its own allowance line (2.3) and does not render `features[0]` for paid plans. Free keeps `features[0]` ("25 submitted applications, once") as its allowance line, because it never changes. A build-time test asserts `features[0]` starts with the formatted `applicationsPerCycle`.
2. Any string matching `/^\d+ resume profiles?$/` is dropped from the list and replaced by one uniform last row built from `resumeProfiles` ("1 resume profile", "3 resume profiles"), so all four cards carry it.
3. G3 gating (CD gate G3, wording "(in beta)" after the feature name). When a feature is not live at build, the string is rendered as follows and nothing else changes:

| Feature flag false | Rendered string |
| --- | --- |
| `FEATURES.cloudApplier` | Cloud applier (in beta): sends approved applications with your browser closed; `proTag` becomes "Sends with your laptop closed (in beta)" |
| `FEATURES.extension` | Chrome extension apply (in beta) |
| `FEATURES.replyTracking` | Reply tracking (in beta) by forwarding; lead uses `leadGated` |

### 2.8 Changes and flags (decisions needed from the copy owner)

| # | Type | Item | Why | Default if no decision |
| --- | --- | --- | --- | --- |
| C1 | Change | Calculator row 3 label: "Failed {f} × 0 credits" instead of "Failed × 0 credits". Value stays "$0.00". | With the deck's label the Failed input has no visible effect, which reads as a dead control. The count inside the label shows that the visitor's own failures were counted and cost $0.00. The CD phrase "Failed × 0 credits = $0.00" is the notation, not a mandatory glyph; the deck's " · " is two table cells. | Ship the change. The spoken form is "Failed 3 × 0 credits, $0.00". |
| C2 | Change | Paid cards do not render plans.ts `features[0]` (2.7 rule 1). | The string is hard-coded to 30 days and false at Weekly and Quarterly. | Ship. Prefer editing plans.ts later so the string is not interval specific. |
| C3 | Change | Resume-profile lines deduplicated (2.7 rule 2). | The deck wants a `resumeProfiles` row on every card, and plans.ts already contains "3 resume profiles" and "10 resume profiles". Rendering both prints the fact twice. | Ship. |
| F3 | Flag, blocking for copy | Starter feature "Failed submits refunded automatically" contradicts this entry. The ledger says failed submits cost 0 credits and "nothing charged"; "refunded" implies a charge then a refund, and a refund promise is not in the PRD (PRD open question 5, deck row 05 note). | Accountability: two sections must not describe the same event two ways. | Recommended: change the plans.ts string to "Failed submits are never charged" (the file wins, so edit the file). If it is not changed, the page ships the string verbatim and this flag stays open in the review. |
| F4 | Flag | `skip.pricing` in the deck targets `#entry-07-billing`; AR 3.x targets `#entry-07-title` and the section id is `entry-07`. | Focus must land on the heading (tabindex -1). | Use `#entry-07-title`. |
| F5 | Flag | "Monthly only" on the Free price slot at Weekly and Quarterly. Free has no billing interval, so the wording can read as if Free needs a monthly plan. | Clarity. | Ship the deck wording. Recommended alternative: keep "$0" and "once" in every view. Needs a one-line owner decision. |
| F6 | Flag | `proTag` ("Sends with your laptop closed") repeats the Pro tagline ("Applies even when your laptop is closed."). | Redundant on one card. | Ship both; the tag is a mechanism label required by CD 5.3 (A17 replaces "Most chosen"). |
| F7 | Flag (cross-document) | WS 4.x fades the canvas out when entry 07 top reaches 85%; MS 5.3 says 70%. | Two values for one trigger. | This section works with either (4.5 and 5.2). MS owns the trigger; reconcile in one of the two files. |
| F8 | New decorative visual, no new copy | The usage ruler (6.1 step 8) carries only numerals. | Shows where the visitor's number sits between 0 and full use. | Specified below. Cut it if a reviewer rejects it; nothing else depends on it. |

---

## 3. Layout structure

Grid, gutters and tokens come from DS 4.1 and 4.3. Entry 07 is a full-width entry (columns 1 to 12) and sits outside `[data-story]`, so no receipt lane exists beside it (AR 4.x: the lane `<aside>` is absolute inside `[data-story]`, which wraps entries 00 to 06 only).

### 3.1 Responsive summary

| Viewport | Columns, margin, gap | Header block | Ledger | Interval switch | Plan cards | Calculator panel | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440 and 1280 | 12 cols of 72px, gap 32, container 1280, content 1216 | Left cols 1 to 6 (592px): eyebrow, H2, lead, settles | Right cols 7 to 12 (592px), top aligned with the eyebrow | Inline: legend left, switch 3 × 120px | 4 cards, 3 cols each (280px), gap 32, padding 32, inner 216px | Cols 1 to 12 (1216px). Inside: grid 5fr / 7fr, gap 48 (inputs 460px, receipt 644px) | 2 columns (cols 1 to 6, 7 to 12) |
| 1024 to 1279 | 12 cols (50.7px at 1024), gap 32, margin 32, content 960 to 1215 | Cols 1 to 8, stacked above the ledger | Cols 1 to 12 below the header, 32px gap | Same | 2 × 2, 6 cols each (464px at 1024), padding 32 | Cols 1 to 12. Inside: 5fr / 7fr, gap 48 (inputs 353px, receipt 495px at 1024). Result pair stacks (container query, 3.4) | 2 columns |
| 768 to 1023 | 8 cols, gap 24, margin 24, content 720 to 975 | Full width, H2 max 14em | Full width | Same | 2 × 2, 4 cols each (348px at 768), padding 32 | Full width. Inside: one column, inputs then receipt. Result pair side by side (inner 656px) | 2 columns |
| 640 to 767 | 8 cols, gap 20, margin 16, content 608 to 735 | Full width | Full width, stacked rows (3.5) | Full width switch, segments equal | 1 column, padding 20 | One column, padding 20. Pair side by side (inner 568px, threshold 560) | 1 column |
| 360 to 639 | 4 cols, gap 16, margin 16, content 328 (at 360) | Full width | Full width, stacked rows | Full width switch, segments equal (3 × 106px) | 1 column in order Free, Starter, Pro, Max | One column, padding 20. Pair stacked | 1 column |

### 3.2 Type sizes at breakpoints (tokens in DS 3 and 2)

| Role | Token | 360 | 640 | 768 | 1024 | 1280 | 1440 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H2 `.lp-heading` | `--type-heading-landing` clamp(2.25rem, 1.5rem + 2.2vw, 3.5rem) | 36px | 38.1px | 40.9px | 46.5px | 52.2px | 55.7px |
| Price and result numerals `.lp-numeral` | `--type-numeral-landing` clamp(2.5rem, 1.75rem + 2.4vw, 4rem) | 40px | 43.4px | 46.4px | 52.6px | 58.7px | 62.6px |
| Lead `.lp-lead` | `--type-lead-landing` | 18px | 18px | 20px | 20px | 20px | 20px |
| Card title, allowance and full-use lines `.lp-title` | `--type-title-landing` | 20px / 500 | | | | | |
| Body, notes `.lp-body` | | 16px | | | | | |
| Table, labels, features, receipt rows `.lp-small` | | 14px | | | | | |
| Chips, captions `.lp-caption` | | 12px / 500 | | | | | |

At 360 the H2 (36px in a 328px measure) is expected to break into three balanced lines ("Pay for / applications that / went through."). That is acceptable under the deck rule (last line two words, longer than five characters). At 390 and wider it is two lines.

### 3.3 Vertical rhythm inside the entry (DS 4.3 plus two sub-block gaps defined here)

| Gap | 1024 and wider | Below 1024 |
| --- | --- | --- |
| Head (32px) to eyebrow | 40 | 32 |
| Eyebrow to H2 | 16 | 12 |
| H2 to lead | 24 | 20 |
| Lead to settlement line | 24 | 20 |
| Header block to ledger (stacked layouts only) | 48 | 32 |
| Ledger or header block to interval switch (sub-block gap, defined here) | 64 | 48 |
| Interval switch to cards | 24 | 24 |
| Cards to calculator (sub-block gap) | 64 | 48 |
| Calculator frame to honesty line | 24 | 20 |
| Honesty line to notes | 48 | 32 |
| Notes to section end | `--section-pad-landing` (128 / 96 / 80) | |
| Touch target to touch target | 8 minimum | 8 |

### 3.4 Plan card anatomy (all four cards use CSS subgrid so rows align across cards)

Card: Ground Iron `#181818`, 1px solid Circuit Border (Pro: 1px solid Phosphor White), radius 8px (`rounded-card`), padding 32 (20 below 768), `display: grid; grid-template-rows: subgrid; grid-row: span 7` in the 4-up and 2 × 2 layouts; a plain stacked grid below 768. Row order and content:

| Row | Content | Style |
| --- | --- | --- |
| 1 | H3 plan name | `.lp-title` 20px / 500, Phosphor White. Pro only: the tag (below) |
| 2 | Tagline | `.lp-small` Sage 60, min-height 2 lines (2 × 20px) |
| 3 | Price: odometer numeral, then suffix on its own line | numeral `.lp-numeral` 400, Phosphor White, line-height 1.0, `min-height: 1em`; suffix `.lp-small` Sage 60 (`/month`, `once`). Free at Weekly or Quarterly: text `Monthly only` at 20px in the numeral box |
| 4 | Allowance line | `.lp-title` sentence: odometer count + label; label min-height 2 lines (40px) so a wrapped label never moves later rows |
| 5 | Full-use line (paid only) | odometer `$0.048` in `.lp-title`, then `.lp-small` Sage 60 label "per application at full use". Free: empty spacer of the same height |
| 6 | Feature list | `<ul>` of `.lp-small` Sage 60 items, 12px gap, Phosphor `Check` icon 16px regular in Phosphor White, 8px gap to text; last item is the resume-profile row |
| 7 | CTA | `.lp-btn`, full card width, 48px tall, pill radius, `margin-top: auto` |

Pro tag: neutral outlined pill (height 24, padding 4 12, 1px Circuit Border, Void fill, Caption text in Moss 70, not uppercase) positioned `top: -12px; left: 24px` so it straddles the card's top border like a legend. It adds no height to the row and cannot unbalance row 1. Its width at 12px/500 is about 214px; with `left: 24px` it fits inside the 280px card.

### 3.5 Sample credit ledger (table) behaviour by width

Frame: `SampleFrame` (`marks/sample-frame.tsx`): Ground Iron, `--sample-border` (1px dashed Circuit Border), radius 8px, padding 32 (20 below 768), SAMPLE chip straddling the top edge at `right: 24px`. Table inside: caption, a header row (Caption style, Moss 70 on Ground), four body rows with 1px Circuit Border bottom rules, row padding-block 16px (min height 52px).

| Width | Columns |
| --- | --- |
| 1280 and wider (inner 528px) | Date 72px · Entry 140px · Credits 92px right aligned · Note 224px (may wrap to two lines) |
| 640 to 1279 | `auto 1.2fr 0.8fr 2fr`, table fills the frame |
| Below 640 | Each row becomes a two-line grid: line 1 = Entry (left, Phosphor White) and Credits (right, tabular); line 2 = Date "sample" (Caption) and Note (Sage 60). The header row is visually hidden but remains in the DOM. Because `display: grid` on table parts drops table semantics in some engines, the markup restores them with `role="table"`, `role="row"`, `role="columnheader"`, `role="rowheader"` and `role="cell"` |

### 3.6 Calculator anatomy

Frame: `SampleFrame` as above, cols 1 to 12.

```
H3  Your receipt for one cycle                                                       (lp-title scale: 28px/400 Inter Tight, see 4.2)
calcIntro (body, 34rem measure)
+------------------------ controls (5fr) ---------+  +---------------- receipt (7fr) --------------------------+
| Plan            [ Pro                      v ]    |  | Pro . Monthly                          (Caption, data)    |
| Uses the billing interval selected above.         |  | Plan charge ........................ $39.00           |
|                                                   |  | Credits included ................... 1,200            |
| Submitted this cycle                              |  | Submitted x 1 credit ............... 600 credits    |
| [=========o----------------] [  600 ]             |  | Failed 3 x 0 credits ............... $0.00           |
|                                                   |  | Credits remaining .................. 600              |
| Failed this cycle                                 |  | 0 |--+--+--+--+--+--*--+--+--+--+--| 1,200  (ruler)  |
| [   3 ]                                           |  | Price per submitted    |  Price per application at   |
| Failed submits are shown here so you can see ...  |  | application at your    |  full use                    |
|                                                   |  | number                 |                              |
|                                                   |  | $0.065   (numeral)     |  $0.033   (numeral, Moss 80) |
+---------------------------------------------------+  +---------------------------------------------------+
honesty line (body, outside the frame)
```

(The dotted leaders in the sketch are only to show alignment; the real rows use 1px Circuit Border bottom rules and no leaders, because the dotted perforation is reserved for three places, DS 6.7.)

Receipt rows 0 to 4: `<dl>` with `<div class="lp-receipt-row">` groups, `dt` Sage 60 14px left, `dd` Phosphor White 14px right aligned, tabular slashed zero, min height 32px (`--rule-rhythm`), 1px bottom rule. The result pair (rows 5 and 6) is two more `div` groups in the same `<dl>`, laid out by a container query on `.lp-pair`: width 560px and up gives two columns (each row: label on top, numeral below, columns separated by a 32px gap and a 1px Circuit Border vertical rule); below 560px the two stack with a 24px gap. The pair block has `min-height: 72px` for its numeral line so the zero-state text (two 16px lines, 48px) never changes the block height.

Usage ruler (F8): a 16px tall `aria-hidden` element between row 4 and the pair. Base line 1px `--divider` (`#1f2a33`), 11 static ticks 4px tall in Circuit Border at `left: calc(i / 10 * (100% - 1px))`, and one moving tick 8px tall, 1px wide, Phosphor White, positioned with `translate: calc(var(--use) * (100cqw - 1px)) 0`. `--use` is `submitted / credits` as a decimal with four digits (0.5000). Caption numerals "0" (left) and the credits figure (right) sit 4px under the line.

### 3.7 ASCII wireframe, desktop (1440 by 900; container 1280, content 1216)

```
x=0 (content left edge)                                                                    x=1216
07 -------+-------+-------+-------+-------+-------+=======+-------+-------+-------+-------   <- lp-head, 32px, tick 07 is 8px bright
(40)
PRICING                                              | cols 7-12 (592px)
(16)                                                 |
Pay for applications                                 | +- - - - - - - - - - - - - - - - -[SAMPLE]+
that went through.                  (H2 56px)        | : Sample credit ledger. Every credit movement is :
(24)                                                 | : one row you can read in the app.               :
One credit per application that actually went       | : Date    Entry            Credits   Note       :
through. Failed submits cost nothing. (see 05)       | : [] sample Free grant      +25 credits never ex.:
Pause any time, and we pause for you when an         | : [] sample Submitted       -1 credit   receipt k:
offer email arrives. Weekly plans for searches       | : [] sample Failed submit  0 credits   reason s.:
that end fast.                       (cols 1-6, 592) | : [] sample Duplicate rep.  0 credits   charged o:
(24)                                                 | +- - - - - - - - - - - - - - - - - - - - - - - -+
[] Settles 05. Every charge has a row, and you can read all of them.
(64)
Billing interval   [ [] Weekly | Monthly | Quarterly ]   (switch 3 x 120px, 44px tall, Carbon active segment)
(24)
+------------+  +------------+  [Sends with your laptop closed]  +------------+
| Free       |  | Starter    |  +============+                    | Max        |
| Try it ... |  | For a st.. |  | Pro        |                    | For urgent |
| $0         |  | $19        |  | $39        |                    | $79        |
| once       |  | /month     |  | /month     |                    | /month     |
| 25 submit. |  | 400 submit.|  | 1,200 sub. |                    | 3,000 sub. |
|            |  | $0.048 per |  | $0.033 per |                    | $0.026 per |
| v Fit gate |  | v Everyth. |  | v Everyth. |                    | v Everyth. |
| v ...      |  | v ...      |  | v ...      |                    | v ...      |
| v 1 resume |  | v 1 resume |  | v 3 resume |                    | v 10 resum |
| (Start free)  | (Choose St.) | (Choose Pro) <- LIME owner      | (Choose Max)
+------------+  +------------+  +============+                    +------------+
(64)
+- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -[SAMPLE]+
: Your receipt for one cycle                                                                :
: calcIntro ...                                                                             :
: Plan [Pro v]                       |  Pro . Monthly                                       :
: Uses the billing interval ...      |  Plan charge $39.00 / Credits included 1,200 / ...   :
: Submitted [=====o====] [ 600 ]     |  Failed 3 x 0 credits $0.00 / Credits remaining 600  :
: Failed [ 3 ] help                  |  0 |--+--+--*--+--| 1,200                            :
:                                    |  $0.065 (your number)   |   $0.033 (full use)       :
+- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+
The more of your credits you use, the lower ... (honesty)
(48)
Launch prices. ... (cols 1-6)         |  Billing is in US dollars through Stripe. ... (cols 7-12)
Unused paid credits roll over ...     |  Prices are in US dollars for every country. ...
(128 section pad)
```

### 3.8 ASCII wireframe, mobile (360 wide; content 328, margin 16)

```
07 --+--+--+--+--+==+--+--+--+--+--      (head)
PRICING
Pay for
applications that
went through.                  (H2 36px, 3 lines)
One credit per application that actually
went through. Failed submits cost nothing.
(see 05) Pause any time, and we pause ...
[] Settles 05. Every charge has a row,
and you can read all of them.
+- - - - - - - - - - - - - [SAMPLE]+
: Sample credit ledger. Every       :
: credit movement is one row ...    :
: Free grant            +25 credits :
: sample    never expires           :
: ---------------------------------  :
: Submitted              -1 credit  :
: sample    receipt kept            :
: (two more rows, same pattern)     :
+- - - - - - - - - - - - - - - - - -+
Billing interval
[ [] Weekly | Monthly | Quarterly ]   (full width, 44px)
+---------------------------------+
| Free                            |   cards stacked
| Try it on 25 real applications. |   Free, Starter, Pro, Max
| $0   once                       |
| 25 submitted applications, once |
| v ...                           |
| (Start free)                    |
+---------------------------------+
 ... Starter ... Pro (white border, tag on the border, LIME CTA when in view) ... Max
+- - - - - - - - - - - - - [SAMPLE]+
: Your receipt for one cycle        :
: intro                             :
: Plan [Pro v]                      :
: Submitted [====o=====] [ 600 ]    :
: Failed [ 3 ]                      :
: Plan charge              $39.00   :
: ... rows ...                      :
: 0 |--+--*--+--| 1,200              :
: Price per submitted application   :
: at your number                    :
: $0.065                            :
: Price per application at full use :
: $0.033                            :
+- - - - - - - - - - - - - - - - - -+
honesty line
four notes, one column
```

### 3.9 Height budget

At 1440 by 900 the natural content height is about 2,400px (head 72, header and ledger 380, gap 64, switch and gap 68, cards about 720, gap 64, calculator about 560, honesty 24 + 60, notes 48 + 200, section pad 128), which is about 2.7 viewport heights against the 200vh (1,800px) creative target. Nothing in the motion system depends on this height (no pin, no scrub, no `u`-driven pose), so CSS does not clamp it. The four notes are billing terms and must stay in this entry. If beta scroll depth at entry 07 is below 40% (CD 10 test 4), the lever the creative direction already allows is to merge entry 08 into the bottom of this entry.

---

## 4. Visual design

### 4.1 Surfaces, borders, tokens

| Element | Fill | Border | Radius | Text |
| --- | --- | --- | --- | --- |
| Page behind the section | Void `--background` `#000000` | none | | Phosphor White headings, Sage 60 body |
| Credit ledger frame | Ground Iron `--surface` | `--sample-border` (1px dashed Circuit Border) | 8px | Sage 60 body, Phosphor White entry names and credits |
| Plan cards | Ground Iron | 1px solid Circuit Border `--border` (Pro: 1px solid Phosphor White `--foreground`) | 8px | Phosphor White names and figures, Sage 60 taglines and features |
| Interval switch outer | Ground Iron | 1px solid Circuit Border | 8px, padding 4px | |
| Interval segment inactive | transparent | none | 6px | Sage 60 |
| Interval segment active | Carbon Veil `--surface-raised` `#212525`, never lime | none | 6px | Phosphor White, preceded by a filled 6px posting square |
| Calculator frame | Ground Iron | `--sample-border` | 8px | as above |
| Inputs, select | Ground Iron | 1px solid Fern Link `--link` | 8px | Phosphor White, 44px tall |
| Range | track 2px Fern Link, filled part Phosphor White, thumb 12 × 24px radius 0 with 2px Void outline | | | |
| Receipt rows | transparent on the frame | 1px bottom rule Circuit Border | 0 | |
| Pro tag | Void | 1px Circuit Border | 9999px | Moss 70, Caption |
| Notes | none | 1px top rule Circuit Border, padding-top 16px | | Sage 60 (14px for the rollover note) |

Mint Frost is NOT used in this section. Decision: the calculator output is a receipt in vocabulary but it stays on Ground Iron. Mint is reserved for entry 05's single band and for the one slip object (DS 5.4, CD A9); a second light surface here would weaken the tonal turn at entry 05 and would need `--on-mint-*` ink rules for every control. The dashed edge plus SAMPLE chip already mark the calculator as not real.

### 4.2 Type roles

| Element | Role | Face, weight, size | Colour |
| --- | --- | --- | --- |
| Entry number | Caption | Inter 500, 12px, +0.6px, tabular slashed zero | Moss 70 |
| Eyebrow | Caption uppercase | Inter 500, 12px, +0.6px | Moss 70 |
| H2 | `.lp-heading` | Inter Tight 400, `ss01`, 36 to 56px, line-height 1.02, -0.02em, `text-wrap: balance`, max-width 14em | Phosphor White |
| Lead | `.lp-lead` | Inter 400, 18 / 20px, 1.5, measure 34rem | Moss 80 |
| Settlement line | `.lp-body` | Inter 400, 16px | Phosphor White (the page's confirmation, not secondary text) |
| Claim chip | M5 | Inter 500, 12px | Phosphor White text, Fern Link border |
| Plan name, allowance, full-use figure | `.lp-title` | Inter 500, 20px, 1.5 | Phosphor White |
| Price numeral, result numerals | `.lp-numeral` | Inter Tight 400, `ss01`, 40 to 64px, line-height 1.0, -0.02em | Phosphor White (your number), Moss 80 (full-use numeral in the pair) |
| Calculator H3 | | Inter Tight 400, 28px, 1.1, -0.02em (landing-only size, see below) | Phosphor White |
| Tagline, features, table, receipt rows, labels, notes | `.lp-small` / `.lp-body` | Inter 400, 14 / 16px | Sage 60 (values Phosphor White) |
| Buttons | `.lp-btn` | Inter 500, 16px, -0.022em | Void on lime; Phosphor White on Ground otherwise |
| SAMPLE chip | M6 | Inter 500, 12px, uppercase, +0.6px | Moss 70 on Ground (8.70:1) |

The calculator H3 uses 28px Inter Tight 400. This is one added landing-only size: DS has no role between 20px title and 36px heading, and a calculator title at 36px would compete with the entry H2. Name it `--type-subheading-landing: 1.75rem` in `landing.css` under `.lp` and justify it as "subhead inside a demo frame; fixed, not fluid". If DS owners refuse, fall back to `.lp-title` (20px / 500) with no layout change.

All numerals: `font-variant-numeric: tabular-nums slashed-zero` (inherited from `.lp`, A15). No weight above 500. Body is left aligned. No text colour is lime and no status colours are used in this entry (event names such as "Failed submit" stay neutral; the status colours are reserved for status words).

### 4.3 Motif usage

| Mark | Where in this entry |
| --- | --- |
| M1 + M2 | Entry head: number 07, graticule rule, 11 ticks, tick 07 is 8px Phosphor White. Draws on post (600ms). The usage ruler in the calculator reuses M1 geometry with a moving tick |
| M3 posting square | Filled before "Settles 05." (fills on post), before each ledger row's Date cell (row 0 fills on post, rows 1 to 3 are filled from first paint), and before the active interval segment label (filled) |
| M4 | Not used (no citations in this entry) |
| M5 claim chip | `see 05` in the lead |
| M6 | Credit ledger frame and calculator frame: dashed edge plus SAMPLE chip. Plan cards are real prices and use solid edges |
| M7 perforation | Not used here |
| M8 | All numerals tabular slashed zero; credits always carry a sign or a unit (+25 credits, −1 credit, 0 credits); "$0.00" printed in full |
| M9 | Not used |
| M10 lime custody | `Choose Pro` is candidate priority 3 |

### 4.4 The one lime element

`entry-07-billing.plans.pro.cta` (`<a class="lp-btn" data-lime-candidate="pro">`, 48px tall, full card width) is lime while it owns custody, which is whenever any pixel of it is inside the viewport and no priority 1 or 2 candidate is (DS 5.3, L1 to L10). Everything else here is non-lime: the other three plan buttons use the L4 fallback (Ground fill, 1px Phosphor White border, Phosphor White text), the active interval segment is Carbon Veil, the Pro card border is Phosphor White, the range thumb and checked radio are Phosphor White, the usage tick is Phosphor White. The navbar "Start free" uses its fallback while the Pro CTA is visible. At widths below 768 the Pro CTA is the third card button; it still owns custody when visible.

Viewports in which no CTA is visible (header, ledger, calculator, notes) show the lime on the navbar button. At 1440 by 900 the Pro CTA and the calculator are never both fully visible, so the lime never has to be taken from a control the visitor is using.

---

## 5. WebGL

**Scene state id: `none`** (`data-scene="none"` on `section#entry-07`). No canvas content belongs to this entry, the canvas does not render for it, and no element in this section reads `sceneInput`.

| Event | What happens | Owner | Specified in |
| --- | --- | --- | --- |
| Scrolling forward from entry 06 (`slip-reply`) | Entry 07 top reaches 70% of the viewport: `ex-canvas-out`, canvas wrapper opacity 1 to 0 over `--dur-handoff` (400ms), `--ease-linear`, then `visibility: hidden`; the clock stops rendering the stage | Stage and MS 5.3 (WS says 85%, flag F7) | MS 5.3, WS 4.5 |
| Scrolling back to entry 06 | `onLeaveBack`: `en-canvas-return`, the canvas fades back in 400ms, rendering resumes, the pose is already `slip-reply` | Stage | MS 5.3 |
| Tier 0 or Reduced (no canvas) | The tier-0 DOM lane receipt belongs to `[data-story]` and scrolls out with entry 06; entry 07 adds nothing | Lane | AR 4.x |
| Context loss | Irrelevant to this entry; the DOM content is independent | | |

**DOM over canvas layering.** Section content is `z-index: var(--lp-z-content)`; the fixed canvas is `var(--lp-z-canvas)` (below it). The canvas fades out in the first 400ms of entry 07's approach, so the slip can still be partially visible in the lane columns (9 to 12) while entry 07's top edge is crossing the lower third of the viewport.

**Text contrast over the canvas.** No text is ever drawn over canvas pixels in this section:

| Content crossing the lane columns during the fade | Surface under the text | Result |
| --- | --- | --- |
| Entry head rule and ticks (full width) | Rule is decorative, 1px | Not text |
| H2, eyebrow, lead, settlement line | Confined to columns 1 to 6 (1280 and wider) or 1 to 8 (below), never under the lane (columns 9 to 12 start at x = 832 inside the container) | No overlap |
| Credit ledger (columns 7 to 12) | Opaque Ground Iron frame, above the canvas | Text on Ground: Phosphor White 16.41:1, Sage 60 7.01:1 |
| Cards, calculator | Opaque Ground Iron, above the canvas | Same |

If the 400ms fade overlaps the ledger frame, the slip simply disappears behind the opaque frame; the visual check (acceptance item 11) is that no slip pixel shows through a gap between frame and text.

---

## 6. Animation choreography

Presets are from MS 3.6. Easing tokens: `--ease-post` cubic-bezier(0.22,1,0.36,1); `--ease-utility` cubic-bezier(0,0,0.58,1); `--ease-linear` linear. Durations: `--dur-post` 600ms, `--dur-rise` 700ms, `--dur-row` 240ms, `--dur-ink` 360ms, `--dur-colour` 300ms, `--dur-swap` 120ms, `--dur-handoff` 400ms.

Principle for this entry: sections do not fade (A4). The rule draws, the title rises if it is below the fold, and everything else is simply present. Everything that moves after that moves because the visitor touched a control.

### 6.1 (a) Entrance timeline

Trigger: the entry's top crosses 85% of the viewport height (`EntryPoster`, MS 5.7). Only entries below the viewport at hydration get the hidden start state (`data-post="pending"`); entries already in view are `instant` and never animate. Posting is monotonic (MS 3.3).

| # | Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger | Preset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Entry rule (including the 8px bright tick 07) | `transform: scaleX`, origin left | 0 | 1 | 600ms | 0 | `--ease-post` | Entry top crosses 85% | `en-post-rule` |
| 2 | The other 10 ticks | visibility (step, no tween) | off | on | 0 | `calc(var(--i) * 60ms)`, last tick at 600ms | none | with the rule | `en-post-rule` |
| 3 | H2 lines (2, or 3 at 360) | `transform: translateY` inside a padded mask | 115% | 0 | 700ms | starts at 80ms, 70ms between lines; two lines end at 850ms, three at 920ms | `--ease-post` | with the rule | `kt-line-rise` at 1024 and wider with Full motion (SplitText); `kt-title-rise` (whole title, CSS) below 1024 |
| 4 | Settlement posting square (before "Settles 05.") | `background-color` | transparent | Phosphor White | 300ms | 0 | `--ease-utility` | with the rule | `en-post-square` |
| 5 | Ledger row 0 posting square | `background-color` | transparent | Phosphor White | 300ms | 0 | `--ease-utility` | with the rule | `en-post-square` |
| 6 | Entry 01 row 05 cell ("open · see 07" to "settled in 07") | `opacity` of two stacked texts | 1 / 0 | 0 / 1 | 120ms | 0 | `--ease-linear` | `ledgerStore.post("07")` in the same frame; instant if row 05 is off screen | `kt-cell-swap` (owned by entry 01) |
| 7 | Canvas | `opacity` | 1 | 0 | 400ms | 0 | `--ease-linear` | Entry top crosses 70% | `ex-canvas-out` (stage-owned) |
| 8 | Eyebrow, lead, chip, settlement text, ledger, switch, cards, calculator, honesty line, notes | none | | | | | | | none (no entrance, ever) |

Groups running at the post: the post itself (1 to 6, one group) and the canvas fade (1 group). Maximum 2 (MS 3.4). Colour fills do not count. If the visitor lands on the entry by anchor or reload, all of this is `instant` and the store is posted monotonically.

### 6.2 (b) Scroll-linked behaviour

There is no pin, no scrub and no `u`-driven value in this entry.

| ScrollTrigger / observer | id | start | end | Mode | Action |
| --- | --- | --- | --- | --- | --- |
| Title rise (desktop, GSAP) | `entry-07:title` | `"top 85%"` | none | `once: true` | `onEnter` plays `kt-line-rise` (only if `data-post="pending"`) |
| Entry post (all widths) | `EntryPoster` observer | top crosses 85% | | once | sets `data-post="live"`, calls `ledgerStore.post("07")` |
| Canvas out / return | `entry-07:canvas` | `"top 70%"` | none | none | `onEnter`: `ex-canvas-out`; `onLeaveBack`: `en-canvas-return` (created by the stage module, listed here for completeness) |
| Lime custody | `LimeCustody` intersection observer | any pixel of the Pro CTA in the viewport | | continuous | owner `pro` when visible and no priority 1 or 2 candidate is visible; otherwise `navbar` |

`refreshPriority` is 7 on each trigger created for this entry; `invalidateOnRefresh` is not needed (no measured rectangles).

Progress-to-value mapping. Scroll position changes no value. The only continuous mapping in this section is input-to-value, shown here with the Pro, Monthly plan (credits 1,200, price 3,900 cents) because it is also the test vector table:

| Submitted | `--use` (ruler tick) | Price per submitted application | Full use | Remaining |
| --- | --- | --- | --- | --- |
| 0 | 0.0000 | "No submitted applications. You still pay the plan price." | $0.033 | 1,200 |
| 1 | 0.0008 | $39.000 | $0.033 | 1,199 |
| 120 | 0.1000 | $0.325 | $0.033 | 1,080 |
| 300 | 0.2500 | $0.130 | $0.033 | 900 |
| 600 (default) | 0.5000 | $0.065 | $0.033 | 600 |
| 900 | 0.7500 | $0.043 | $0.033 | 300 |
| 1,200 | 1.0000 | $0.033 | $0.033 | 0 |

Formula (pure integer arithmetic, no floats): `perAppThousandths = floor((priceCents * 20 + submitted) / (submitted * 2))` (round half up of `priceCents * 10 / submitted`), shown as `$` + whole dollars + `.` + three digits. Examples: Pro Monthly 600: floor((78,000 + 600) / 1,200) = 65 → $0.065. Starter Weekly 47: floor((12,000 + 47) / 94) = 128 → $0.128 (full use $0.064). Max Quarterly 100: floor((378,000 + 100) / 200) = 1,890 → $1.890 (full use $0.021).

### 6.3 Input-driven choreography (the signature)

Calculator and interval changes are visitor input. All run in CSS, with no GSAP, so the same code serves every width and the motion chunk is not required.

| # | Trigger | Element | Property | From | To | Duration | Easing | Preset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Any calculator input change | Every odometer in the receipt (plan charge, credits, submitted, failed count, remaining, your number, full use) | column `translate`/`transform: translateY(calc(var(--d) * -1lh))` | old digit | new digit (direct, never wraps) | 240ms | `--ease-post` | `kt-odometer` |
| 2 | Same | Usage tick | `translate` along the ruler | old `--use` | new `--use` | 240ms | `--ease-post` | `kt-odometer` (applied to one extra element; no new preset) |
| 3 | Same | `calcLive` | text | | new sentence | n/a | | debounced 500ms after the last input |
| 4 | Interval switch change | Selected segment | `background-color`, `color`, posting square fill | | | 300ms | `--ease-utility` | `mi-nav-link` colour transition plus `en-post-square` |
| 5 | Same | Card price, allowance count and full-use figures | odometer columns | old | new | 360ms | `--ease-post` | `kt-odometer-price` |
| 6 | Same | Card labels (per 30 days, per week, per quarter), price suffix, ARIA names | text | | | instant | | none |
| 7 | Same | Calculator values (they depend on the interval) | odometer columns | | | 240ms | `--ease-post` | `kt-odometer` |
| 8 | Same | `intervalLive` | text | | | immediate | | none |
| 9 | Plan select change | Same as 1 to 3; the range max, number max and default (when untouched) update | | | | 240ms | | `kt-odometer` |
| 10 | Odometer retarget | A roll in progress when the next input arrives | transition retargets from the current position to the new digit | | | restarts at 240ms | | CSS transition semantics; see below |

Interruption rule. MS 3.5 says a re-trigger first jumps the running instance to its end. For odometers driven by a dragged range that would produce hard jumps, so this section documents a deliberate reading: a CSS transition retargets from its current value, never queues and never stacks, and ends 240ms after the last input. A column can only change direction if the visitor changes direction.

Odometer structure (extends MS 4.5, no conflict): one `<span class="od">` per number; inside it one `<span class="od__col" style="--d:N">` per digit position and static `<span>` for `$`, `,` and `.`. Each column is a single element whose `::before` holds a newline-separated stack `" \A 0 \A 1 ... 9"` with `white-space: pre; line-height: inherit`, so one column is one DOM node (about 64 nodes for the whole section, not 700). Slot 0 is blank, digits are slots 1 to 10, so a column that becomes visible rolls from blank to its digit. Column width is `1ch`, valid because the section uses tabular numerals. Two options added by this section: `align="end"` plus `width="fixed"` for right aligned values (blank leading columns keep their width), and `align="start"` plus `width="fit"` for left aligned numerals (blank leading columns collapse to `inline-size: 0` instantly so there is no gap between `$` and the first digit). A separator comma is visible only when the digit group to its left is non-blank (visibility toggles instantly; its width is reserved in fixed mode). The integer part of a money value always shows at least one digit ("$0.065").

### 6.4 (c) Micro-interactions

All hover rules sit inside `@media (hover: hover) and (pointer: fine)`. All colour transitions are 300ms `--ease-utility`; focus rings are instant (`mi-focus`). No `transition: all`.

| Control | Hover | Focus-visible | Pressed | Notes |
| --- | --- | --- | --- | --- |
| Interval segment (label of a visually hidden native radio) | Text Sage 60 to Phosphor White (`mi-nav-link`) | 2px Phosphor White outline, 2px offset, drawn on the segment via `:has(input:focus-visible)` | Colour holds | Active segment: Carbon Veil, white text, filled square. Arrow keys move the selection (native radio group) |
| `Choose Pro` (owner) | Fill to `--accent-hover` (`mi-lime`) | `mi-focus` | Colour holds, no transform | Non-owner: `mi-default` (hover Carbon Veil) |
| `Choose Starter`, `Choose Max`, `Start free` | Carbon Veil fill (`mi-default`) | `mi-focus` | Colour holds | |
| Claim chip `see 05` | Border to Phosphor White, text underline (`mi-chip`) | `mi-focus`, hit area 44px via `::before { inset: -10px 0 }` | Colour holds | Link to `#entry-05` |
| Select, number inputs | Border Fern Link to Moss 70 (`mi-control`) | 2px Phosphor White border + 2px Moss 70 ring at 35%, instant | | Disabled before hydration: 50% opacity |
| Range | none | Focus ring on the thumb | | Thumb has no animation; the value drives the odometers |
| Plan cards, ledger rows, notes, frames | none (no hover, lift, scale, glow or shadow) | | | Cards are not interactive |

### 6.5 (d) Hand-off to the next section

1. **Lime.** When the Pro CTA's last pixel leaves the viewport (scrolling down) and entry 08 contains no candidate, ownership returns to `navbar`: the Pro CTA fades to its fallback over 150ms, then the navbar button fills lime after a 150ms delay over 150ms (`ho-lime`, sequential, two lime fills never coexist). Scrolling up reverses the same hand-over.
2. **Posting.** Entry 08's top crosses 85% of the viewport: its rule draws (600ms) and its table rows post top to bottom (`en-compare-post`, 90ms stagger). Entry 07 stays in its final state; nothing here is revisited.
3. **Canvas.** Already hidden. Entry 08 is also `none`, so the canvas stays hidden until entry 10.
4. **Ledger store.** Entry 01 row 05 is already settled. The mobile receipt tape does not receive a new line for entry 07 (no printed line exists for it, `PrintLineId`), but the tape dialog's entry list shows 07 as posted.

---

## 7. Reduced-motion, no-JS and low-tier variants

### 7.1 Reduced motion (OS preference or the footer Motion control)

`html[data-motion="reduced"] .lp` zeroes every duration token (MS 10.1). Result for this entry:

| Preset | Reduced behaviour |
| --- | --- |
| `en-post-rule`, ticks | Rule drawn from first paint |
| `kt-line-rise`, `kt-title-rise` | Not created; the H2 is static |
| `en-post-square` | 300ms colour fill is kept (colour is not motion) |
| `kt-cell-swap` | Instant text change |
| `kt-odometer`, `kt-odometer-price` | Instant value, including the usage tick; `calcLive` and `intervalLive` still announce |
| `ex-canvas-out` | No canvas exists (the WebGL chunk never downloads) |
| `ho-lime` | Instant swap |
| `mi-*` hover and focus | 300ms colour transitions are kept |

Under Reduced the page says exactly the same words. Lenis is not mounted; native scroll.

### 7.2 No JavaScript

| Part | Behaviour |
| --- | --- |
| All server markup | Final state (no `data-post` attribute): rule drawn, H2 plain text, settlement square filled, ledger rows complete, claim chip a working anchor |
| Plan cards | Server-rendered at Monthly. Radios and calculator controls render `disabled` (React `disabled={!hydrated}`) so nothing looks broken |
| Calculator | Server-renders the default receipt (Pro, Monthly, 600 submitted, 3 failed): $39.00, 1,200, 600 credits, Failed 3 × 0 credits · $0.00, 600, $0.065, $0.033. Controls stay disabled |
| Weekly and Quarterly prices | `<noscript>` renders a plain table: caption `Billing interval`, columns Plan, Weekly, Monthly, Quarterly, cells "{price} for {credits}" (for example "$12 for 280"), Free "Monthly only" in its Weekly and Quarterly cells. This reuses the CD plan table wording |
| Lime | `data-lime-owner="hero"` in server HTML means no lime in this entry; the Pro CTA renders in the L4 fallback style (L8) |
| Links | CTAs are plain anchors: `/sign-up`, `/sign-up?plan={id}&interval={week|month|quarter}` |

### 7.3 Device tiers

Entry 07 contains no canvas or tier-dependent code, so tiers 0, 1 and 2 are identical here. Below 1024 GSAP and Lenis are not loaded: the title rise is the CSS `kt-title-rise` driven by the post observer, and every other move in this entry is CSS. At 1024 and wider with Full motion, the only GSAP in the entry is the title SplitText. `prefers-reduced-data` or `saveData`: no change (no assets).

### 7.4 Forced colors and zoom

`@media (forced-colors: active)`: dashed and solid edges use `CanvasText`; filled posting squares use `background: CanvasText` with `forced-color-adjust: none`; the usage tick uses `CanvasText`; the active segment gains a 2px `Highlight` outline so it does not rely on fill. At 400% zoom (320 CSS px) there is no horizontal scroll: the ledger stacks, cards stack, the pair stacks, the switch segments are equal width.

---

## 8. Accessibility

### 8.1 Landmarks and headings

`<section id="entry-07" data-section="entry-07-billing" data-entry="07" data-scene="none" aria-labelledby="entry-07-title" class="lp-entry">` inside `<main id="main">`. Headings: `h2#entry-07-title` (tabindex -1, `data-split="lines"`), `h3` for each plan name, `h3` for the calculator title. No `h4`. The graticule head is `aria-hidden`; the entry number is real text and is not in the heading.

### 8.2 DOM and focus order

1. Claim chip `see 05` (link, in the lead).
2. Interval radios (one tab stop; arrow keys move within the group).
3. Free, Starter, Pro, Max CTAs in that order, which is also the visual order at every width (a 2 × 2 grid reads left to right, top to bottom).
4. Calculator: Plan select, Submitted range, Submitted number, Failed number.
5. No other tab stops. The ledger table, rows, notes and the ruler are not focusable.

Focus is never obscured: below 1024 the sticky navbar (64px) plus receipt tape (48px) cover 112px, but the global `scroll-padding-top` is 80px (DS). Set `.lp-heading { scroll-margin-top: 128px }` below 1024 so the focused H2 of a skip link ("Skip to pricing", target `#entry-07-title`) is never under the tape (WCAG 2.4.11).

### 8.3 Names, roles and states

| Element | Markup | Accessible name or text |
| --- | --- | --- |
| Interval group | `<fieldset><legend>Billing interval</legend>` + three `input[type=radio][name=interval]` visually hidden, label = segment | "Billing interval, Weekly, radio 1 of 3" etc. |
| Plan list | `<ul>` of `<li>`, each `<li>` contains the card | Plan names are h3 |
| Price numeral | Odometer columns `aria-hidden="true"` + one visually hidden node with the formatted value (`$39`); the suffix is separate text | Read as "$39 /month" |
| Allowance and full-use lines | Same pattern; the sentence reads "1,200 submitted applications per 30 days" and "$0.033 per application at full use" | |
| Paid CTA | `<a>` with `aria-label="{cta}, {price} {intervalWord}"`; visible text is "{cta}" (label starts with the visible text, WCAG 2.5.3) | "Choose Pro, $39 a month" |
| Free CTA | No aria-label, visible text "Start free" | The price template does not apply to Free |
| Pro tag | Plain text after the h3 in DOM order, CSS-positioned onto the border | Read as part of the card |
| Credit ledger | `<table>` with visible `<caption>`, `<th scope="col">` for Date, Entry, Credits, Note, and `<th scope="row">` for the Entry cell of each row | Mobile stacked variant restores roles (3.5) |
| Ledger posting squares | `aria-hidden="true"` (decorative; deviation from `shared.postedAria`, because "Posted." four times adds noise and the row is already a record) | |
| Settlement square | Followed by visually hidden "Settled." (`shared.postedAria` pattern) | "Settled. Settles 05. Every charge has a row..." |
| SAMPLE chip | Text "SAMPLE", `aria-label="Sample data"` | |
| Calculator | `<form onSubmit={preventDefault} role="group" aria-labelledby="calc-title">` | |
| Plan select | Native `<select>` + `<label for>` "Plan" | |
| Submitted | `<input type=range min=0 max={credits} step=1>` and `<input type=number inputmode=numeric min=0 max={credits}>`, both `aria-labelledby="calc-submitted-label"`; range has `aria-valuetext="{n} submitted applications"` | |
| Failed | `<input type=number inputmode=numeric min=0 max=99>` with `aria-describedby` to the help text | |
| Result rows | `<dl>` > `<div>` > `<dt>`/`<dd>`; NOT `<output>` (its implicit `role=status` would announce every roll) | "Failed 3 × 0 credits, $0.00" |
| Live regions | Two `role="status"` polite nodes: `intervalLive` (immediate) and `calcLive` (500ms debounce). Odometers inside this entry are created with `announce={false}` so `shared.odometerLive` does not double announce | A weekly switch announces "Showing weekly prices." then, 500ms later, the calculator sentence |

Validation: number inputs accept typing; the computation clamps to range immediately (empty counts as 0) and the field text is corrected to the clamped value on blur (inline validation on blur, not per keystroke). No error text is shown because clamping is the only failure and it is visible.

### 8.4 Contrast of pairings used (ratios from DS 9)

| Pairing | Use | Ratio | Req | Result |
| --- | --- | --- | --- | --- |
| Phosphor White on Void | H2, numerals | 19.41 | 3 (large) | Pass |
| Moss 80 on Void | Lead | 12.55 | 4.5 | Pass |
| Moss 70 on Void | Eyebrow, number, captions | 10.29 | 4.5 | Pass |
| Sage 60 on Void | Body, notes | 8.29 | 4.5 | Pass |
| Phosphor White on Ground Iron | Names, figures, values | 16.41 | 4.5 | Pass |
| Sage 60 on Ground Iron | Taglines, features, labels, inactive segment | 7.01 | 4.5 | Pass |
| Moss 70 on Ground Iron | Table header, SAMPLE chip, Pro tag (on Void) | 8.70 | 4.5 | Pass |
| Moss 80 on Ground Iron | Full-use numeral in the result pair (large) | 10.62 | 3 | Pass |
| Phosphor White on Carbon Veil | Active segment | 14.32 | 4.5 | Pass |
| Fern Link on Ground Iron | Input and select borders, claim-chip border (on Void 6.89) | 5.82 | 3 | Pass |
| Phosphor White (tick, Pro border) on Ground Iron | Non-text | 16.41 | 3 | Pass |
| Void on Lime / on Accent hover | Choose Pro label | 14.32 / 11.92 | 4.5 | Pass |
| Lime Pulse against Ground Iron | Button boundary | 12.10 | 3 | Pass |
| Circuit Border on Ground Iron | Card hairline, dashed edge, ticks | 2.20 | decorative | Never the only signal; meaning is always also text (SAMPLE chip, labels) |

New pairings introduced by this section: none. Sage 40 is not used on Ground Iron (it fails there, DS G5): the table header row uses Moss 70 on the frame.

### 8.5 Other

Touch targets: radio segments 44px tall (36px visible plus pseudo-element), select 44px, number inputs 44px, range input 44px, CTAs 48px, claim chip hit area 44px; 8px minimum between targets. Text spacing overrides (line-height 1.5, letter-spacing 0.12em) do not clip: odometer columns use `1lh` and wrap in `overflow: clip` boxes whose height follows the line height.

---

## 9. Performance notes

| Item | Budget or count |
| --- | --- |
| Animated properties | `transform` and `translate` (odometer columns, usage tick, rule `scaleX`), `opacity` (canvas, owned by the stage), `background-color` and `color` (segments, squares, lime). No layout property is animated |
| Concurrent layers | At rest none. During a roll: at most the seven to ten calculator columns that actually change digits, plus up to 12 card columns on an interval change; `will-change` is not set (MS policy: at most 4 and never on odometers); the browser promotes transitioning transforms for their 240 to 360ms |
| Element count (whole entry) | About 300 DOM elements: head 14, header block 10, ledger 45, switch 12, four cards 4 × 22 = 88 (including 18 `Check` SVGs), calculator 60, odometer columns about 64, notes 12 |
| Odometer cost | One DOM node per digit column (CSS stack in `::before`), not eleven; about 64 nodes in total |
| JS | Island code for this entry (`billing-plans.tsx`, `odometer.tsx`, `calculator.ts`, `format.ts`) at most 4.5 KB gzip, inside the 20 KB islands budget (AR 3.3). `PLANS` and `creditsPerInvoice` from `@auto-career/shared` add about 1.2 KB, already shipped for `/pricing` |
| State | One `useReducer` in `BillingPlans`; cards are `React.memo` and depend on `interval` only, so dragging the range re-renders the calculator subtree only. No stores, no storage |
| INP | Every control (interval radio, plan select, range drag, number inputs) has an `event` timing entry of 100ms or less at 4× CPU throttle (AR budgets). Handlers only set state; no layout reads |
| CLS | 0. Fixed-size odometer boxes, reserved 2-line label heights, `min-height: 72px` on the result pair, no content inserted above existing content by input |
| Assets | None. No images, no video, no new fonts, no raster icons. 18 Phosphor `Check` icons (16px, regular, inline SVG, about 0.5 KB gzip total) |
| HTML | The entry contributes at most 14 KB of the 60 KB page HTML budget (about 3.5 KB gzip) |
| CSS | At most 3 KB gzip of the 25 KB total, in `landing.css` and `motion.css` |
| Server work | `computeReceipt` for the default state runs at build/request time; the noscript table and default receipt cost no client JS |

---

## 10. Implementation

### 10.1 Files

| Path | Kind | Purpose |
| --- | --- | --- |
| `web/components/landing/entries/entry-07-billing.tsx` | Server | Renders `<Entry id="07" scene="none">`: head, H2, lead (with `ClaimChip`, G3 variant), settlement line (`PostingSquare` + text), ledger (`SampleFrame` + `<table>`), `<BillingPlans>`, honesty line, notes, `<noscript>` table |
| `web/components/landing/islands/billing-plans.tsx` | Client | One state for interval + calculator; `SegmentedSwitch`, `PlanCard` (memo), `ReceiptCalculator`; the `pro` lime candidate |
| `web/components/landing/islands/odometer.tsx` | Client | Shared with entry 02. Props below |
| `web/lib/landing/calculator.ts` | Pure module | `computeReceipt`, `fullUseThousandths` |
| `web/lib/landing/format.ts` | Pure module | `formatUsd(cents)`, `formatPerApp(thousandths)`, `formatCredits(n)` (fixed `en-US`) |
| `web/lib/landing/calculator.test.ts` | Vitest | Test vectors in 11 |
| `shared/src/plans.ts` | Shared | Add `creditsPerInvoice(planId, interval)` (prerequisite P3); server `stripe.ts` imports it |
| `web/components/landing/landing.css` | CSS | Rules for `.lp-plans`, `.lp-plan`, `.lp-seg`, `.lp-calc`, `.lp-receipt`, `.lp-pair`, `.lp-use`, `.lp-notes`, `.od`; token `--type-subheading-landing` |
| `web/components/landing/motion.css` | CSS | `kt-odometer`, `kt-odometer-price` transitions; no new presets |

### 10.2 Props and types

```ts
// calculator.ts (pure)
export type CalcPlanId = "starter" | "pro" | "max";
export interface ReceiptInput { plan: CalcPlanId; interval: BillingInterval; submitted: number; failed: number }
export interface ReceiptResult {
  priceCents: number;               // PLANS price * 100 for the interval
  credits: number;                  // creditsPerInvoice(plan, interval)
  submitted: number;                // clamped to [0, credits]
  failed: number;                   // clamped to [0, 99]
  failedCents: 0;                   // always 0 (PRD AC10)
  remaining: number;                // credits - submitted
  perAppThousandths: number | null; // null when submitted === 0
  fullUseThousandths: number;       // round-half-up(priceCents * 10 / credits)
  use: number;                      // submitted / credits, 0..1, four decimals
}
export function computeReceipt(i: ReceiptInput): ReceiptResult;

// billing-plans.tsx
export interface BillingPlansProps {
  copy: BillingPlansCopy;           // strings from landingCopy["entry-07-billing"] used by the island
  features: { cloudApplier: boolean; extension: boolean; replyTracking: boolean }; // G3
}

// odometer.tsx
export interface OdometerProps {
  value: number;                    // integer in the smallest unit (cents, thousandths, or a plain count)
  intDigits: number;                // maximum integer digit columns
  decimals?: number;                // 0, 2 or 3
  prefix?: string;                  // "$"
  group?: boolean;                  // thousands comma, en-US
  preset: "row" | "price";          // kt-odometer (240ms) | kt-odometer-price (360ms)
  align?: "start" | "end";          // default "end"
  width?: "fixed" | "fit";          // default "fixed"; "fit" collapses blank leading columns
  announce?: boolean;               // default true; entry 07 passes false
}
```

State: `{ interval: BillingInterval; plan: CalcPlanId; submitted: number; failed: number; touched: boolean }`, defaults `month`, `pro`, `floor(credits / 2)`, `3`, `false`. On plan or interval change: if `touched` is false, `submitted` resets to `floor(newCredits / 2)`; otherwise it is clamped to `newCredits`. Maximum digits: card price 3, allowance 4, card full-use `$` + 1 + 3 decimals, plan charge 3 + 2, credits 4, submitted 4, failed 2, remaining 4, your number 3 + 3 (up to `$189.000`), calculator full use 1 + 3.

### 10.3 Server or client

`entry-07-billing.tsx`, the ledger, notes, claim chip and noscript table are Server Components. `BillingPlans` and `Odometer` are the only client code (AR lists `BillingPlans` and `Odometer` as islands 12 and 13). `Link` from `next/link` for CTAs. The server passes `copy` and `features` as serialisable props; `PLANS` is imported directly inside the island.

### 10.4 Presets, tokens, components reused

Presets: `en-post-rule`, `kt-line-rise`, `kt-title-rise`, `en-post-square`, `kt-cell-swap` (entry 01), `kt-odometer`, `kt-odometer-price`, `ex-canvas-out` / `en-canvas-return` (stage), `ho-lime`, `mi-lime`, `mi-default`, `mi-chip`, `mi-control`, `mi-nav-link`, `mi-focus`.

Tokens: `--type-heading-landing`, `--type-numeral-landing`, `--type-lead-landing`, `--type-title-landing`, `--type-subheading-landing` (new, under `.lp`), `--measure-title`, `--measure-body`, `--sample-border`, `--rule-rhythm`, `--section-pad-landing`, `--lp-hit`, `--lp-hit-gap`, `--lp-dur-odometer`, `--lp-dur-custody`, `--dur-post`, `--dur-rise`, `--dur-row`, `--dur-ink`, `--dur-colour`, `--dur-handoff`, `--ease-post`, `--ease-utility`, `--ease-linear`; colour tokens `--background`, `--surface`, `--surface-raised`, `--foreground`, `--body`, `--label`, `--lead`, `--link`, `--border`, `--divider`, `--accent`, `--accent-hover`, `--accent-ink`.

Reused components: `Entry` (`entries/entry.tsx`), `EntryRule`, `PostingSquare`, `ClaimChip` and `SampleChip` (`marks/chip.tsx`), `SampleFrame`, `Odometer` (shared with entry 02), `LimeCustody` (owner of `data-lime-owner`), `EntryPoster`, `PLANS`, `getPlan`, `BillingInterval` (`@auto-career/shared`), `INTERVAL_LABEL` and `PER` (exported from `shared/pricing-plans.tsx`, AR 7.1). Not reused: `PricingPlans` (forked, AR 7.2: the calculator must share the interval), `CtaBand`.

### 10.5 Edge cases the engineer must handle

1. Typing `1e3`, negative numbers, decimals or an empty string in the number inputs: parse with `Number.parseInt(value, 10)`, treat `NaN` as 0, clamp, never store a float.
2. Range max changes when plan or interval changes while the thumb is dragged: clamp and let the browser re-position.
3. `submitted === 0` renders `calcZero` in place of the row 5 value, hides the number odometer for that row, and `calcLive` replaces its third sentence with `calcZero`.
4. `submitted === 1` prints "1 credit" (singular) in row 2.
5. Free is not a calculator option, so the Free card never appears in the calculator.
6. Server and client must format with the same fixed locale (`en-US`) to avoid hydration mismatches.
7. G3 flags are build-time constants read on the server; the island receives them as props.

---

## 11. Acceptance criteria

**Content and copy**

- [ ] 1. Every string in 2.1 to 2.5 renders verbatim from `landingCopy["entry-07-billing"]`, except the three listed changes C1 to C3. No em or en dash appears in the entry (copy lint).
- [ ] 2. Prices, taglines and feature strings equal `PLANS` in `shared/src/plans.ts`; a test fails the build if the entry's rendered text differs from the file, except the render rules in 2.7.
- [ ] 3. `creditsPerInvoice` returns 94, 280, 700 (week), 400, 1,200, 3,000 (month) and 1,200, 3,600, 9,000 (quarter).
- [ ] 4. With the G3 flags false, the strings in 2.7 table render and `leadGated` replaces `lead`.

**Math (Vitest, `calculator.test.ts`)**

- [ ] 5. Full-use values: Monthly $0.048, $0.033, $0.026; Weekly $0.064, $0.043, $0.036; Quarterly $0.038, $0.026, $0.021.
- [ ] 6. The table in 6.2 (Pro Monthly) matches exactly, including 1 submitted → $39.000, 120 → $0.325, 900 → $0.043, and 0 submitted → `perAppThousandths === null`.
- [ ] 7. Starter Weekly 47 → $0.128; Max Quarterly 100 → $1.890; round half up: Starter Monthly 400 → $0.048 (47.5 rounds to 48), Pro Monthly 1,200 → $0.033 (32.5 rounds to 33).
- [ ] 8. `failedCents` is 0 for every `failed` from 0 to 99; inputs outside range are clamped; no function uses floating-point division for money.

**Layout (Playwright screenshots + DOM assertions)**

- [ ] 9. At 1440 and 1280 the header block is cols 1 to 6 and the ledger cols 7 to 12; cards are four across at 280px; the rail does not overlap the container. At 1024: ledger below header, cards 2 × 2. At 768: cards 2 × 2, calculator one column. At 360, 390, 640: cards stacked in order Free, Starter, Pro, Max; no horizontal scroll at any width from 320 to 1920.
- [ ] 10. The ledger is a single `<table>` at every width; below 640 rows are two-line blocks and the roles `table`, `row`, `columnheader`, `rowheader`, `cell` exist.
- [ ] 11. No slip pixel is visible through a gap around the ledger or cards when the canvas is mid-fade at entry 07 (visual check at 1440 by 900 at the moment the entry top crosses 70%). Text sits only on Void or Ground Iron.
- [ ] 12. The Pro card has a 1px Phosphor White border and the tag straddles the top border; the other cards have Circuit Border. No element in the entry has `rgb(127,238,100)` or `rgb(109,219,87)` as colour, border, outline, fill or stroke except the Pro CTA's `background-color` and `border-color` while `data-lime-owner="pro"`.

**Lime custody**

- [ ] 13. With the Pro CTA in view, `html[data-lime-owner="pro"]` and exactly one lime element exists (the check runs at 1440 by 900 and 390 by 844, 100px steps, 400ms waits). When the CTA leaves, ownership moves to `navbar` with a 150ms release and a 150ms delayed fill. The active interval segment is Carbon Veil (`rgb(33,37,37)`), never lime.

**Motion**

- [ ] 14. On first scroll into the entry (not at hydration in view) the rule draws in 600ms with `cubic-bezier(0.22,1,0.36,1)`, the H2 rises (two lines end at 850ms) at 1024 and wider, or as one block below 1024, and no other element has an entrance (no opacity animation on lead, ledger, cards, calculator or notes).
- [ ] 15. When entry 07 posts, entry 01 row 05 shows "settled in 07" and never reverts; row 04 stays open.
- [ ] 16. Changing any calculator input rolls every dependent odometer in 240ms (`getAnimations()` shows `translate`/`transform` transitions of 240ms with the post curve); the usage tick translates in 240ms; the interval switch rolls card figures in 360ms and calculator figures in 240ms.
- [ ] 17. At most 2 motion groups run at the post (MS Q5 sampler); no `transition: all`; no animated layout property.
- [ ] 18. `prefers-reduced-motion: reduce` or Motion = Reduced: rule drawn at first paint, H2 static, odometers and tick jump instantly, canvas absent, all text present; the live regions still announce.

**Accessibility**

- [ ] 19. One `h2` and two kinds of `h3` (plan names, calculator title); no skipped levels. `#entry-07-title` receives focus from "Skip to pricing" and is not covered by the navbar or tape at 360 and 1440.
- [ ] 20. Tab order is: claim chip, interval radios, four CTAs, select, range, submitted number, failed number. The radio group moves with arrow keys. Every control shows a visible 2px Phosphor White focus ring with 2px offset (this entry has no Mint Frost surface).
- [ ] 21. Accessible names: `Choose Pro, $39 a month` at Monthly and `Choose Pro, $12 a week` at Weekly; the Free button is named "Start free". The range has `aria-valuetext` "600 submitted applications" at the default.
- [ ] 22. A screen reader hears one announcement after an interval switch ("Showing weekly prices.") and one calculator sentence 500ms after the last input; odometer columns are not announced; the result rows are not wrapped in `<output>`.
- [ ] 23. All pairings in 8.4 meet WCAG 2.2 AA; touch targets are at least 44px with 8px between them; at 400% zoom the entry reflows without horizontal scroll; forced-colors mode keeps all edges, squares and the active segment visible.

**Resilience**

- [ ] 24. With JavaScript disabled: Monthly cards, the default receipt and all copy render; controls are disabled; the noscript table lists every plan at Weekly, Monthly and Quarterly.
- [ ] 25. CLS in the entry is 0 during a scripted session that switches interval, changes plan and drags the range from 0 to max; INP for each of those inputs is 100ms or less at 4× CPU throttle; the entry adds no network request and no image.
- [ ] 26. Server and client render the same text for the default state (no hydration warning in the console).
