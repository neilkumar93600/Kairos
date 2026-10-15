# Entry 02: Fit gate and the sample run

Section id `entry-02-fit-gate`. Anchor `#entry-02`. Heading id `entry-02-title`. Tier: signature. Scene state: `slip-feed`. Scroll length target from the creative direction: 150vh (see change F12: the measured composition is longer). Previous: `entry-01-reported` (`slip-recede`). Next: `entry-03-truth-lock` (`slip-cite`).

Source documents (names used exactly): 01-creative-direction (CD), 02-design-system (DS), 03-motion-system (MS), 04-webgl-scene (WS), 05-architecture (AR), 06-copy-deck (COPY). Product code read for this spec: `server/src/services/fit.ts` (`passesHardFilters`, lines 39 to 77), `shared/src/schemas.ts` (`preferencesSchema`, `DEFAULT_PREFERENCES`), `shared/src/types.ts` (`SENIORITY_LEVELS`, `WORK_AUTHORIZATIONS`).

Skills applied as guidance: `anthropic-skills:3d-scroll-website` (direct DOM and uniforms for hot updates, no React state on scroll, DPR-aware canvas, passive listeners), `motion-graphics` (opening state, signature move, final hold as the three proof frames; nothing loops), `gsap-skills:gsap-scrolltrigger` (standalone triggers, `refreshPriority` in page order, no scrub plus toggleActions on one trigger, refresh after layout change). All three loaded.

---

## 1. Purpose and narrative beat

**Job of the section.** Prove the first promise of the page: Kairos applies only to jobs that fit. Show that hard rules (role, seniority, location, salary floor, visa needs, exclude list, per-company limit) run before any model reads a posting, that every skip carries a written reason in the product's own words, and that a skip never costs a credit. The proof is a working sample run: 48 synthetic postings checked by the real `passesHardFilters` function, which the visitor can re-run by changing four native controls.

**Narrative beat (CD).** Chronos, then the stop. The receipt feed rolls fast, like clock time: 48 compressed `SKIP` or `PASS` rows rush up the paper. Then it stops dead. After 200ms of complete stillness, one full-size line prints on a flattened slip: `02 · Fit gate · hard rules first · every skip has a reason`. The speed is the noise of the job market; the stop is the one sentence that matters.

**What the visitor should think.** "It told me why it skipped each job, in plain words, and it did not spend anything doing it. I can check it myself right here."

**Settlement.** Entry 02 settles row 01 of entry 01 ("Matches that do not fit."). The settlement line reads "Settles 01. You see each skip and the reason." When entry 02 posts, `ledgerStore.post("02")` runs and the entry 01 `SettleCell` for row 01 flips from `open · see 02` to `settled in 02` (owned by the entry 01 spec).

**The signature moment, in one paragraph.** At 1024px and wider with a WebGL tier, when the visitor has scrolled one fifth of the way through this entry, the slip in the receipt lane straightens (120ms), and 48 tiny rows feed up through its curl in 2,400ms on an ease-in-out curve: `SKIP · 0417 · Posting says it does not sponsor visas`, `PASS · 0233 · goes to scoring`, and so on, every reason string copied from the rule code. The feed decelerates and stops. Nothing moves for 200ms. Then the print head prints the 02 line in two rows at full size, holds flat for 200ms, and the slip eases back to its resting angle. The whole beat ends 4,440ms after it began and never replays. Later, each time the visitor changes a sample rule and pauses for 800ms, the slip prints one small row, `RULES CHANGED · SAMPLE RE-CHECKED`: the page records the visitor's own action on paper.

**Why it is calm.** The fast part is decorative texture in a separate lane, never behind text, and its content is fully available in the DOM skip ledger. Body text, controls and counts never animate in. The only DOM motion caused by the visitor is the 240ms odometer roll of counts they asked to change. Nothing loops; every move ends.

---

## 2. Content (final copy from 06-copy-deck.md, verbatim; changes flagged)

All strings come from `landingCopy["entry-02-fit-gate"]` (COPY section 7) and `landingCopy.scene.lines` (COPY section 17). Separator: U+00B7 middle dot with one space on each side. No U+2014 or U+2013 anywhere. Placeholders in braces are filled from `web/content/fit-sample.json` and the visitor's control state.

### 2.1 Entry text

| Key | Element and tag | Final copy |
| --- | --- | --- |
| `number` | Entry number in the head, `<span>` | 02 |
| `eyebrow` | `<p class="lp-caption">`, uppercase by CSS | Fit gate |
| `h2` | `<h2 id="entry-02-title" tabindex="-1">` | A fit gate before anything else. |
| `h2Alt` | Not rendered (kept in the deck as an alternate) | Hard rules first. Every skip has a reason. |
| `body` | `<p class="lp-body">` | Role, seniority, location, salary floor, visa needs and your exclude list are hard rules. A job that breaks one is dropped before any model reads it, and the rest come with written reasons. |
| `body2` | `<p class="lp-body">` | Jobs that miss a hard rule never cost a model call, and a skip never costs a credit. New postings come from public career pages on Greenhouse, Lever and Ashby. |
| `settles` | `<p class="lp-small">` with a posting square | Settles 01. You see each skip and the reason. |
| `caveat` | `<p class="lp-small">`, Sage 60 | This sample is synthetic. Your counts depend on your rules and on what employers post. |
| `footnoteReasons` | `<p class="lp-small">`, Sage 60 | Hard-rule reasons are the product's own reason text, checked against its rule code. |
| `footnoteScores` | `<p class="lp-small">`, Sage 60 | Scores and fit reasons in this sample were written by us to show the format. In the product, a model writes them from your confirmed profile. |

`footnoteReasons` "ships only when P1 passes". Because the whole entry ships only when P1 passes (CD gate G1) and the drift test runs in CI before every build, the sentence is rendered unconditionally whenever the entry renders. If the drift test fails, the build fails, so the sentence can never be shown over unverified data.

### 2.2 Demo panel: Sample run

| Key | Element | Final copy |
| --- | --- | --- |
| `panelTitle` | `<h3>` in the panel title row | Sample run |
| `sampleChip` | SAMPLE chip, visible text; hidden text "Sample data" | SAMPLE |
| `runLine` | `<p class="lp-caption">` directly under the title row | Sample run · 48 synthetic postings · {skipped} skipped by your rules · {below} below your bar · {kept} kept · 0 sent from this page |
| `controlsLegend` | `<fieldset><legend>` | Sample rules |
| `seniorityLabel` | `<label>` for `<select>` | Seniority |
| `seniorityOptions` | `<option>` × 3 | Entry · Mid · Senior (default Entry) |
| `sponsorshipLegend` | Nested `<fieldset><legend>` for the radio pair | Needs visa sponsorship |
| `sponsorshipOptions` | Two radios in a segmented switch | Yes · No (default Yes) |
| `capLabel` | `<label>` for `<select>` | Per-company limit |
| `capOptions` | `<option>` × 3 | 1 in 30 days · 2 in 30 days · 3 in 30 days (default "2 in 30 days"; order changed, F5) |
| `barLabel` | `<label>` for `<input type="range">` | Your fit bar (sample setting) |
| `barValueText` | `aria-valuetext` on the range | Fit bar {value}. {kept} of {passed} sample postings kept. |
| `profileSummary` | `<details><summary>` | Rules in this sample |
| `profileBody` | `<p>` inside the disclosure | Entry-level software engineer roles, needs visa sponsorship, remote or New York or Austin, salary floor $85,000, one excluded company, one excluded keyword, at most 2 applications per company in 30 days. (changed, F1) |
| `skipLedgerHeading` | `<h4>` | Skipped by your rules |
| `skipReasons` | Visible row text, one row per reason present in the current result, rendered from `fit-sample.json` | Title does not match your roles · Title is more senior than you asked for · Title is more junior than you asked for · Location is outside your list · Company is on your exclude list · Mentions excluded keyword "{keyword}" · Posted salary is below your floor · Posting says it does not sponsor visas · You hit your per-company limit for the last 30 days |
| `skipRowName` | Row button accessible name, collapsed | {reason}. {n} postings. Show them. |
| `skipRowNameOpen` | Row button accessible name, expanded | {reason}. {n} postings. Hide them. |
| `skipRowCount` | Count cell (odometer) | {n} |
| `skipPostingLine` | `<li>` in an expanded row | {id} · {company} · {title} · {reasons joined with " · "} |
| `skipMore` | Last `<li>` when a row has more than five postings | and {n} more |
| `skipFootnote` | `<p class="lp-small">` under the ledger | A posting can break more than one rule. Each skipped posting keeps every reason. |
| `belowBarRow` | Plain ledger row (not a button), count cell `{below}` | Below your fit bar |
| `keptHeading` | `<h4>` with a posting square | Kept |
| `keptCards[0]` | Card 1 | Company 014 · Software Engineer, Platform / fit 82 / Entry-level title, matches your roles / Posting says it sponsors visas / Asks for Kafka; your profile mentions RabbitMQ only |
| `keptCards[1]` | Card 2 | Company 027 · Backend Engineer I / fit 76 / Remote, within your list / Posted salary is above your floor / Asks for Go; your profile lists TypeScript and Python only |
| `keptCards[2]` | Card 3 | Company 003 · Software Engineer, New Grad / fit 74 / New-grad title, matches your seniority / Austin, within your list / Asks for a year of React; your profile shows a course project only |
| `keptBadgeAria` | Visually hidden text before each badge | Sample fit score |
| `keptMore` | `<p class="lp-small">` after the cards, only when n > 0 | +{n} more in this sample |
| `keptNone` | `<p class="lp-small">` in place of cards when no card is shown (new, F4) | No sample posting is at or above a fit bar of {value}. |
| `liveRegion` | Polite live region, sponsorship change | {ruleName} rule {on or off}. {n} postings skipped for {ruleShort}. {passed} pass all rules. (example: Sponsorship rule on. 12 postings skipped for sponsorship. 9 pass all rules.) |
| `liveRegionSeniority` | Polite live region, seniority change (new, F2) | Seniority set to {value}. {n} postings skipped for seniority. {passed} pass all rules. |
| `liveRegionCap` | Polite live region, limit change (new, F2) | Per-company limit set to {value}. {n} postings skipped for the per-company limit. {passed} pass all rules. |

### 2.3 Printed receipt lines used by this entry

| Key (`PrintLineId`) | Exact text | Row type |
| --- | --- | --- |
| `feedRow` | `SKIP · {id} · {first reason}` or `PASS · {id} · goes to scoring`, 48 rows | Feed row |
| `02` | `02 · Fit gate · hard rules first · every skip has a reason` | Full line, wraps to two rows |
| `rulesChanged` | `RULES CHANGED · SAMPLE RE-CHECKED` | Feed row |
| `scene.feedSummary` (DOM only, F9) | Sample run: 48 postings, {skipped} skipped, {passed} passed | One `<li>` in the lane list |

`{first reason}` is `reasons[0]` in `fit.ts` order. `{skipped}` and `{passed}` in the feed summary are always the default combination's values, because the feed always prints the default combination (5.3).

### 2.4 Flagged changes

| # | Change | Why |
| --- | --- | --- |
| F1 | `profileBody` adds "one excluded keyword," after "one excluded company," | CD 10.4 requires every reachable rule string, including `Mentions excluded keyword "{keyword}"`, to appear at least twice in the default run. A keyword reason that the disclosed profile does not mention would be an undisclosed rule. The P1 generator uses the keyword `clearance` (9 characters, under the 16-character WS limit) |
| F2 | Two new live-region templates for seniority and the per-company limit | `liveRegion` speaks of a rule turning "on or off", which only fits the sponsorship Yes or No switch. Seniority and the limit are selects with three values |
| F3 | `liveRegionBar` is not used | The range carries `aria-valuetext` with the identical sentence; screen readers announce it on every keyboard step. A second polite announcement of the same text would double every step |
| F4 | New `keptNone` string | At fit bars 85 to 95 no authored card qualifies, and the Kept area would otherwise be an empty heading |
| F5 | Limit options render in numeric order 1, 2, 3 with 2 selected | The deck lists the default first as a convention; a select in non-numeric order reads as a mistake |
| F6 | P1 design target narrowed: "every rule string appears at least twice in the default combination" becomes "every string reachable under the default combination appears at least twice; `Title is more junior than you asked for` appears at least twice under Senior" | `fit.ts` line 47 can only fire when every selected seniority is senior or lead, so the junior string cannot occur under the default Entry. Mid triggers neither seniority rule (lines 44 to 47), so under Mid the seniority rows disappear; that is real product behaviour and is shown as it is |
| F7 | Each authored kept card carries `validIn` (the combinations where every one of its lines is true) | Card 3 says "matches your seniority" and card 1 says "Entry-level title". Under Mid or Senior those lines would be false while the posting still passes. A card is shown only where its lines hold; otherwise the posting counts in "+{n} more" |
| F8 | No visible change; the deck note "No product default is documented (facts 1.6)" is out of date | `shared/src/schemas.ts` sets `DEFAULT_PREFERENCES.fitThreshold = 75` and the schema range is 50 to 95. The locked sample default stays 70, and the label "(sample setting)" keeps it honest. The deck note should be corrected to cite the code default |
| F9 | The DOM summary of the feed uses the key `scene.feedSummary` | WS calls it `receipt.feedSummary`; COPY puts the text in the notes of `scene.lines.feedRow`. AR keys all scene copy under `landingCopy.scene` |
| F10 | Line ids follow AR `PrintLineId` (`feedRow`, `02`, `rulesChanged`) | WS uses `feed`, `l02`, `rules-changed` for the same lines. AR owns the store type; the Stage maps names internally |
| F11 | `sq-feed-stop` total is 4,440ms | MS 9.2 says about 3,920ms (it assumed a one-row 02 line); WS 3.5 says 4,560ms (it added the 120ms flatten after it had already overlapped the feed, and exceeds `MAX_AUTOPLAY_MS` 4,500). The 02 line wraps to two rows (WS 3.6), and the flatten overlaps the feed start (MS 9.2), giving 4,440ms (6.a) |
| F12 | Measured scroll length is about 250vh at 1440 by 900, not 150vh | Section 3.6 measures the composition with every deck string, 44px targets and DS spacing. The scene logic uses normalised `u`, so nothing breaks. The reviewer may recover about 280px by moving the three footnotes into the `Rules in this sample` disclosure; this spec does not do that because it would hide the honesty lines |
| F13 | In the visible tier 0 lane list, the feed is one plain `<li>` with no nested 48-row list | WS 3.7 nests the 48 rows in a `<details>`. In a sticky lane of fixed height that list would overflow, and the skip ledger in the demo already lists every posting with every reason. COPY 17 asks for exactly one grouped item |
| F14 | Consecutive `rulesChanged` lines show as one `<li>` in the DOM list | The paper prints each one (paper does not un-print); a screen reader list of eight identical items is noise |
| F15 | Feed rows render at about 10px on screen, below the DS 12px floor | They are decorative canvas texture, `aria-hidden`, printed over a moving surface, and every value is in the DOM ledger. The DS floor applies to DOM text |

---

## 3. Layout structure

### 3.1 Placement in the page

Entry 02 sits inside `[data-story]` (entries 00 to 06), so the receipt lane (`<aside data-lane>`, columns 9 to 12 at 1024px and wider, `position: sticky` child of height `calc(100lvh - 64px)`) is beside it. All entry content uses columns 1 to 7. Column 8 is an empty buffer. Text never enters the lane. Below 1024px the lane is `display: none`, and the 48px receipt tape (owned by the ledger-rail spec) becomes sticky under the navbar from the top of this entry.

Vertical order (every breakpoint): entry head (M1), eyebrow, H2, body, body2, sample panel, caveat, footnoteReasons, footnoteScores, settlement line. Inside the panel: title row, run line, controls fieldset, profile disclosure, skip ledger heading, skip rows, below-bar row, skip footnote, Kept heading, kept cards, keptMore or keptNone.

### 3.2 Desktop 1440 and 1280

Container 1280px centred (80px page margin outside it at 1440), 32px inner margins, 12 columns of 72px with 32px gaps. Content width of columns 1 to 7: 696px.

| Element | Columns | Width | Spacing |
| --- | --- | --- | --- |
| Entry head (number plus graticule) | 1 to 12 | 1216 | Height 32 (`--lp-head-h`); the rule runs to the container's right edge |
| Eyebrow | 1 to 7 | auto | 40 below the head |
| H2 | 1 to 7, `max-width: var(--measure-title)` (14em, 780px at 1440; capped by 696) | 696 | 16 below eyebrow; 2 lines ("A fit gate before / anything else.") at 55.7px (1440) and 52.2px (1280) |
| Body, body2 | 1 to 7, `max-width: var(--measure-body)` 544px | 544 | 24 below H2; 16 between paragraphs |
| Sample panel | 1 to 7 | 696 (inner 630 after 32px padding and 1px borders) | 48 below body2 |
| Panel title row | inside panel | 630 | Height 24; title left, SAMPLE chip right, chip 16px from the panel top and right edges |
| Run line | inside panel | 630 | 20 below title row; 2 lines of 16px |
| Controls fieldset | inside panel, 2 by 2 grid, `grid-template-columns: 1fr 1fr`, column gap 24, row gap 20 | 303 per cell | 20 below run line; legend 16 tall plus 12 gap; each cell is label (20) + 8 + control (44) |
| Grid cells in DOM order | Row 1: Seniority select, Needs visa sponsorship switch. Row 2: Per-company limit select, fit bar range | | |
| Profile disclosure | inside panel | 630 | 16 below controls; summary row 44 tall |
| Skip ledger heading | inside panel | 630 | 24 below disclosure; 20 tall, 8 below |
| Skip rows | inside panel | 630 | 44 tall each (12 vertical padding, 20px line), 1px Circuit Border bottom rule; square, 8 gap, reason left; count right-aligned in a 2-digit column 24px wide; disclosure glyph 12px at the far right, 12 gap |
| Below-bar row | inside panel | 630 | Same 44px row, no glyph, preceded by a 1px Circuit Border top rule (a second rule above it separates the score stage from the rule stage) |
| Skip footnote | inside panel | 630 | 12 below the last row; 1 line |
| Kept heading | inside panel | 630 | 24 below footnote; 20 tall, 8 below |
| Kept cards | inside panel, stacked, gap 12 | 630 (inner 564) | Each 166 tall at one-line titles: 32 padding, title 30, 12, three reason lines of 20, 32 padding |
| keptMore | inside panel | 630 | 12 below last card |
| Caveat and footnotes | 1 to 7 | 696 | 16 below the panel; 8 between |
| Settlement line | 1 to 7 | auto | 32 below the last footnote |
| Bottom pad | | | `--section-pad-landing` 128 |

At 1280 every width is the same as 1440 (the container is 1280 at both); only the H2 size (52.2px) and the lane slip size (265 by 596) differ.

### 3.3 Laptop 1024

12 columns, 32px margins and gaps, column 50.7px. Columns 1 to 7: 547px. Panel inner width: 481px. Controls grid stays 2 by 2 (cells 228px). H2 46.5px, 2 lines. Kept card titles wrap to two lines (card 196 tall); the fit badge is an inline element at the end of the title and wraps with it. Skip reasons stay on one line (the longest, "You hit your per-company limit for the last 30 days", measures about 326px at 14px). Lane: 299px wide, slip 253 by 570. The navbar shows the caption `02 / 10` (1024 to 1279px).

### 3.4 Tablet 768

8 columns, 24px margins and gaps; content 720px. No lane, no canvas, no GSAP. Entry content spans columns 1 to 8 (720px), body text still capped at 544px. Panel inner width: 720 − 64 − 2 = 654px; controls grid 2 by 2. Kept cards one per row, 32px padding (DS A23 switches to 20px only below 768). H2 40.9px. The receipt tape is sticky at `top: 64px` above the entry head; `scroll-padding-top` is 128px.

### 3.5 Mobile 360 to 640

4 columns below 640 (16px margins and gaps, content 328px at 360); 8 columns from 640 (20px gaps, 16px margins). Everything is one column.

| Element | 360 | 640 |
| --- | --- | --- |
| Head to eyebrow / eyebrow to title / title to body | 32 / 12 / 20 | same |
| H2 | 36px, 2 lines | 38.1px, 2 lines |
| Body | 328 wide, 5 and 4 lines | 544 max |
| Body to panel | 32 | 32 |
| Panel padding | 20 (inner 286) | 20 (inner 566) |
| Controls | 1 column, 4 stacked cells, 16 apart | 2 by 2 grid, 20 gap |
| Skip rows | min 44 tall; reason wraps to 2 lines (64 tall) where needed; count stays top-aligned right | one line |
| Kept cards | padding 20; titles wrap to 2 lines | padding 20 |
| Demo to settlement | 24 | 24 |
| Bottom pad | 80 | 80 (96 from 768) |

The range input is full width; selects are full width of their cell; the segmented switch is full width with two equal segments. No horizontal scroll at any width: every row uses `min-width: 0` and `overflow-wrap: break-word`; ids and reason strings never hyphenate (`hyphens: manual`).

### 3.6 Measured heights (estimate for design lock, F12)

| Viewport | Entry height | In viewport heights | Pose blend span (u 0 to 0.25) | Feed start (u 0.20): scroll past start, entry top position |
| --- | --- | --- | --- | --- |
| 1440 by 900 | about 2,240px | 2.49 | 718px | 574px, entry top at 191px |
| 1280 by 800 | about 2,232px | 2.79 | 698px | 558px, entry top at 122px |
| 1024 by 768 | about 2,420px | 3.15 | 739px | 591px, entry top at 62px |
| 768 by 1024 | about 2,350px | 2.29 | no scene | no scene |
| 360 by 740 | about 2,800px | 3.78 | no scene | no scene |

Formula: u range R = H + 0.70 × viewport height; blend span = 0.25 R; feed start = 0.20 R past the moment the entry top is at 85% of the viewport. These figures are recomputed at design lock from the real DOM, and the Playwright check in 11 asserts the behaviour at u, not at pixels.

### 3.7 Wireframe, desktop 1440 by 900 (state just after the feed stops; counts illustrative)

```
|<------------------------- container 1280, margins 32 ------------------------->|
|<---------------- cols 1-7: 696 ---------------->| c8 |<---- lane cols 9-12: 384 ---->|
 02  |-----|-----|=====|-----|-----|-----|-----|-----|-----|-----|-----|  (tick 02 is 8px, Phosphor White)
                                                      |                              |
 FIT GATE                                             |        ._________.           |
 A fit gate before                                    |       /  (curl)   \          |
 anything else.                                       |      | SKIP·0412·Lo |        |
                                                      |      | PASS·0415·go |        |
 Role, seniority, location, salary floor, visa        |      | SKIP·0417·Po |        |
 needs and your exclude list are hard rules. ...      |      |              |        |
                                                      |      | 02 · Fit gate ·      |
 Jobs that miss a hard rule never cost a model ...    |      | hard rules first ·   |
                                                      |      | every skip has a ... |
 + - - - - - - - - - - - - - - - - - - - - - - - +    |      |..............| perforation
 ' Sample run                          ( SAMPLE ) '   |      |__ print head __|      |
 ' Sample run · 48 synthetic postings · 38        '   |    slip 301 x 677, flat      |
 ' skipped by your rules · 6 below your bar · ... '   |                              |
 ' SAMPLE RULES                                   '
 ' Seniority               Needs visa sponsorship '
 ' [ Entry          v ]    [ # Yes  |    No     ] '
 ' Per-company limit       Your fit bar (sample   '
 ' [ 2 in 30 days   v ]    setting)           70  '
 '                         |=========[]---------| '
 ' > Rules in this sample                         '
 ' Skipped by your rules                          '
 ' # Title does not match your roles          6 v '
 ' # Title is more senior than you asked for  5 v '
 ' # Location is outside your list            4 v '
 ' # Company is on your exclude list          2 v '
 ' # Mentions excluded keyword "clearance"    2 v '
 ' # Posted salary is below your floor        5 v '
 ' # Posting says it does not sponsor visas  12 v '
 ' # You hit your per-company limit for ...   3 v '
 ' ---------------------------------------------- '
 '   Below your fit bar                         6 '
 ' A posting can break more than one rule. ...    '
 ' # Kept                                         '
 ' + - - - - - - - - - - - - - - - - - - - - - +  '
 ' ' Company 014 · Software Engineer, Platform ' '
 ' '   ( fit 82 )                              ' '
 ' ' Entry-level title, matches your roles     ' '
 ' ' Posting says it sponsors visas            ' '
 ' ' Asks for Kafka; your profile mentions ... ' '
 ' + - - - - - - - - - - - - - - - - - - - - - +  '
 '   (cards 2 and 3 identical in structure)       '
 ' +1 more in this sample                         '
 + - - - - - - - - - - - - - - - - - - - - - - - +
 This sample is synthetic. Your counts depend on ...
 Hard-rule reasons are the product's own reason text ...
 Scores and fit reasons in this sample were written by us ...

 # Settles 01. You see each skip and the reason.
```

Legend: `- -` dashed edge (M6); `#` a 6px posting square (M3); `[]` the range thumb; `( )` pills; `v` the row disclosure glyph. The badge sits inline at the end of the title line when it fits (it does at 1440); it is drawn on the next line here only for width.

### 3.8 Wireframe, mobile 360 by 740 (counts illustrative)

```
|<----------- 360: margins 16, content 328 ----------->|
| [ # 02 · Fit gate · hard rules first · every ... ]   |  <- receipt tape, 48px, sticky at top 64
 02 |--|--|==|--|--|--|--|--|--|--|--|
 FIT GATE
 A fit gate before
 anything else.
 Role, seniority, location, salary
 floor, visa needs and your exclude
 list are hard rules. A job that ...
 + - - - - - - - - - - - - - - - - +
 ' Sample run           ( SAMPLE ) '
 ' Sample run · 48 synthetic       '
 ' postings · 38 skipped by your   '
 ' rules · 6 below your bar · ...  '
 ' SAMPLE RULES                    '
 ' Seniority                       '
 ' [ Entry                     v ] '
 ' Needs visa sponsorship          '
 ' [ # Yes        |       No     ] '
 ' Per-company limit               '
 ' [ 2 in 30 days              v ] '
 ' Your fit bar (sample setting) 70'
 ' |============[]---------------| '
 ' > Rules in this sample          '
 ' Skipped by your rules           '
 ' # Title does not match your   6 '
 '   roles                       v '
 ' # Posting says it does not   12 '
 '   sponsor visas               v '
 '   ...                           '
 '   Below your fit bar          6 '
 ' # Kept                          '
 ' + - - - - - - - - - - - - - + '
 ' ' Company 014 · Software     ' '
 ' ' Engineer, Platform (fit 82)' '
 ' ' Entry-level title, matches ' '
 ' ' your roles                 ' '
 ' + - - - - - - - - - - - - - + '
 ' +1 more in this sample          '
 + - - - - - - - - - - - - - - - - +
 This sample is synthetic. ...
 # Settles 01. You see each skip and
   the reason.
```

---

## 4. Visual design

### 4.1 Tokens and type roles

| Element | Type role (DS 3.1) | Colour token | Surface |
| --- | --- | --- | --- |
| Entry number | `.lp-caption`, `tabular-nums slashed-zero` | Moss 70 `--label` | Void |
| Graticule rule, ticks | M1 | Rule `#1f2a33` (`--divider`), ticks `--border`, current tick `--foreground` 8px | Void |
| Eyebrow | `.lp-caption`, uppercase | `--label` | Void |
| H2 | `.lp-heading` (36 to 56px, line height 1.02, -0.02em, `ss01`), weight 400 | `--foreground` | Void |
| Body, body2 | `.lp-body` 16px | `--body` (Sage 60) | Void |
| Panel | Ground Iron `--surface`, `border: var(--sample-border)`, `rounded-card` 8px, padding 32 (20 below 768) | | Ground |
| Panel title | `.lp-small` weight 500 | `--foreground` | Ground |
| SAMPLE chip | M6: Inter 12px 500 uppercase +0.6px, pill 24px tall, 1px `--border` | `--label` (8.70:1 on Ground) | Ground |
| Run line | `.lp-caption` (12px, 500, +0.6px, not uppercase) with M8 numerals | `--label` | Ground |
| Legend "Sample rules" | `.lp-caption`, uppercase | `--label` | Ground |
| Control labels | `.lp-small` 500 | `--foreground` | Ground |
| Selects | DS 6.11 Select: `appearance: none`, Ground fill, 1px `--link` (Fern Link) border, 8px radius, 44px tall, padding 0 40px 0 12px, Phosphor White caret SVG | text `--foreground` 14px | Ground |
| Sponsorship switch | DS 6.11 Segmented: outer Ground, 1px `--border`, 8px radius, 4px padding; segments 36px visible, 44px hit; inactive Sage 60; active Carbon Veil `--surface-raised` fill, Phosphor White text, filled posting square before the word | | Ground |
| Fit bar range | DS 6.11 Range: 44px tall input, 2px Fern Link track, Phosphor White filled part, thumb 12 by 24, radius 0, Phosphor White with 2px Void outline; visible value right of the label, `.lp-small` 500 Phosphor White, `aria-hidden` | | Ground |
| Disclosure summary | `.lp-small` 500, 44px row, plus sign of two 1px bars that becomes a minus | `--foreground`, open `--lead` (Moss 80) | Ground |
| Profile body | `.lp-small` | `--body` | Ground |
| Skip ledger heading, Kept heading | `.lp-small` 500 (h4) | `--foreground` | Ground |
| Skip row reason | `.lp-small` 400 | `--foreground` | Ground; hover Carbon Veil |
| Skip row count | `.lp-small` 500, right-aligned, odometer | `--foreground` | Ground |
| Expanded posting lines | `.lp-small` | `--body` | Ground |
| Below-bar row label and count | `.lp-small` | label `--body`, count `--foreground` | Ground |
| Skip footnote, keptMore, keptNone | `.lp-small` | `--body` | Ground |
| Kept card | Ground fill, `--sample-border`, 8px radius, padding 32 (20 below 768), no shadow, no hover | | Ground on Ground |
| Kept card title | `.lp-title` (20px 500) | `--foreground` | Ground |
| Fit badge | Pill 24px tall, padding 4px 10px, 1px `--border`, Inter 12px 500, M8 numerals; never lime, never a status colour | `--foreground` | Ground |
| Kept reasons | `.lp-small` | `--body` | Ground |
| Caveat, footnotes | `.lp-small` | `--body` | Void |
| Settlement line | `.lp-small` with M3 square | `--foreground` text, square `--foreground` when posted | Void |

No status colours are used in this entry. `SKIP` and `PASS` appear only on the canvas paper (Void ink on mint). Font weights are 400 and 500 only.

### 4.2 Motif usage

| Mark | Where in this entry |
| --- | --- |
| M1 entry head | "02" plus the 11-tick graticule; tick 02 is 8px Phosphor White |
| M2 post | The rule draws on post (`en-post-rule`) |
| M3 posting square | Before each skip reason (filled: the skip is posted), before "Kept" (filled), before the active sponsorship segment (filled), before the settlement line (outlined until post, then filled). Not before "Below your fit bar" (it is a subtotal, not a posted decision) |
| M6 sample mark | Panel and each kept card: dashed edge; one SAMPLE chip on the panel (cards inherit the panel's chip; a chip per card would be noise) |
| M8 numerals | Run line counts, row counts, fit badges, posting ids, `$85,000` |
| M7, M9, M10 | Not used here (no perforation in the DOM, no stamp, no in-page lime) |

### 4.3 The one lime element

None in the entry. Per COPY 7, the navbar "Start free" owns lime custody (`html[data-lime-owner="navbar"]`) while this entry fills the viewport, because no in-page candidate (`approve`, `hero`, `pro`, `closing`) is in view. Every element in the panel is Phosphor White, Fern Link, Circuit Border or Carbon Veil. The canvas palette contains no lime (WS palette lock).

---

## 5. WebGL

### 5.1 State ids

This entry owns one state, `slip-feed`, declared as `data-scene="slip-feed"` on the section. Rest pose (WS 5.3): camera (0, 0, 6) looking at the origin, fov 35; offset (0, 0, 0) from the lane-fit pose; rotation (0, -6, 0) degrees; scale 0.96 × `laneScale`; `uCurl` 1; `uLevel` 1.00; `uAlpha` 1; paper A, `uPaperLen` 2304. Pointer tilt: off for the whole state.

### 5.2 Entering and leaving

| Transition | Trigger and range | Easing | Changes | On reverse scroll |
| --- | --- | --- | --- | --- |
| `slip-recede` to `slip-feed` | Entry 02 `u` 0 to 0.25 | `smoothstep(0, 0.25, u)` then the 0.12-per-frame lerp (`POSE_LAMBDA` 7.7/s, frame-rate independent) | Offset (+0.15, -0.06, -0.8) to (0, 0, 0); rotation (4, -24, 0) to (0, -6, 0); scale 0.82 to 0.96; `uLevel` 0.65 to 1.00 | Pose scrubs back toward `slip-recede`; printed rows stay |
| Feed beat (`sq-feed-stop`) | Entry 02 `u` crosses 0.20 forward, once per page view, when `ledgerStore` has not printed `feedRow` | Time based, 6.a | Flatten factor, `uFeed`, `uPrintY` | Never reverses, never replays |
| Rule-change print | 800ms after the last control change in the panel, only after `feedDone`, at most 8 per session | `em-print` at feed-row size | One 60-texel row | Not applicable |
| `slip-feed` to `slip-cite` | Entry 03 `u` 0 to 0.25 (starts when entry 03's top crosses 85%, at entry 02 u about 0.78 at 1440 by 900) | Same blend | Rotation (0, -6, 0) to (2, -10, 0) | Scrubs back |

The scene's target state is the highest entry whose `u` is above 0 (WS 5.4), so `slip-feed` holds from entry 02 u 0.25 until entry 03 posts. If entry 03 posts while `sq-feed-stop` is still running (fast scroll), the sequence is not interrupted: the flatten factor keeps rotation at zero until the sequence's own return step, the pose blend toward `slip-cite` proceeds on position and scale, and the entry 03 print (`03`) waits in the print queue until 4,440ms has elapsed. A `fastScrollEnd` exit (the visitor leaves the entry's trigger range at high speed) jumps `sq-feed-stop` to its final state instantly: all 48 rows and the 02 line on paper, `feedDone` true.

### 5.3 What the feed prints

- Always the default combination (Entry, Yes, 2 in 30 days) from `fit-sample.json`, in posting order. The server markup also starts at the default, and the feed fires before the panel is in view in normal reading (the panel top is still below the viewport at u 0.20 on every desktop size in 3.6).
- If the combination is not the default when the feed starts (the visitor tabbed into a control first, or arrived by an anchor and changed a control within the same frame), the feed still prints the default rows, and `rulesChanged` is queued to print immediately after the 02 line (no 800ms wait). The paper then records truthfully that the rules changed after the starting run.
- Row text: `SKIP · {id} · {reasons[0]}` or `PASS · {id} · goes to scoring`. Font 34px Inter 400 at T2, shrinking in 2px steps to a 26px floor if the row exceeds 896 texels (WS 3.6). Never wrapped, never truncated.
- The 48 rows are written into the ring-buffer texture in batches of two as the paper advances (WS 3.5: 24 uploads, at most one per frame). The rows run past the 2,304-texel paper window, so the header and line 00 scroll off through the curl; this is intended (it is a receipt).

### 5.4 Who calls the store

| Situation | `print("feedRow")` | `markFeedDone()` | `print("02")` | `print("rulesChanged")` |
| --- | --- | --- | --- | --- |
| Stage mounted (tier 1 or 2) | Stage, at feed start (t = 0) | Stage, at t = 2,400ms | Stage, at the start of the 02 print (t = 2,600ms), so the DOM list is never behind the paper | `SampleRun` requests it (debounced 800ms); the Stage prints it when it observes the new entry in `printed` |
| No Stage (tier 0, below 1024px, Reduced) | `EntryPoster`, in the same tick it posts entry 02 | Same tick | Same tick | `SampleRun`, debounced 800ms |
| Tier still unknown (probe pending at 1024px and wider) | Deferred: `EntryPoster` subscribes to `envStore` and, when the tier resolves to 0, prints the lines of every posted entry at once. When it resolves to 1 or 2, the Stage derives them on mount without a sweep (AR 4.3.3) | | | |

This is the one interface addition this section asks of AR: `EntryPoster` prints `feedRow` and `02` on posting entry 02 when no Stage will exist. The 8-per-session cap on `rulesChanged` lives in `ledgerStore.print` (later calls are ignored), so the DOM list and the paper agree.

### 5.5 DOM over canvas layering

| Layer | z token | Pointer | Content |
| --- | --- | --- | --- |
| Fixed `<canvas aria-hidden="true">` | `--lp-z-canvas` (0) | `pointer-events: none` | The slip, drawn only inside the lane rectangle; the rest of the canvas is transparent (`alpha: true`) over the Void page |
| Lane `<aside data-lane aria-label="Sample receipt">` | `--lp-z-content` (1) | none needed | `LaneReceipt`: the DOM poster (`visibility: hidden` after the canvas fade-in, kept for context loss) and the `<ol id="receipt-lines">`, visually hidden at tiers 1 and 2, visible on mint paper at tier 0 |
| Entry content | `--lp-z-content` (1) | normal | Columns 1 to 7 only |
| Tape, navbar | `--lp-z-tape` (30), `--lp-z-navbar` (40) | normal | Below 1024px and always |

### 5.6 Text contrast over the canvas

No DOM text overlaps canvas pixels: entry text is confined to columns 1 to 7, the slip is confined to columns 9 to 12, and column 8 is a buffer (DS 4.1). On the paper, ink is Void on the flat Mint Frost face (17.61:1). The 02 line prints only on a flattened slip (flatten factor 0), so readable lines never sit on the darkened curl. Feed rows pass through the curl, where ink falls to about 2.7:1; they are decorative and `aria-hidden`, and every value is in the DOM skip ledger (F15).

---

## 6. Animation choreography

### 6.a Entrance timeline

Times are from the trigger named in the last column. Durations, curves and staggers are tokens only (MS 2); no literal appears in component code.

| Element | Property | From | To | Duration | Delay or stagger | Easing token | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Graticule rule (`en-post-rule`) | `transform: scaleX` (origin left) | 0 | 1 | `--dur-post` 600ms | 0 | `--ease-post` | `EntryPoster`: entry top crosses 85% (`data-post="live"`) |
| Ticks 00 to 10 | visibility step (no tween) | hidden | shown | step | `calc(var(--i) * 60ms)` | none | Same |
| H2 lines (`kt-line-rise`, 1024px and wider) | `transform: translateY` inside padded masks | 115% (`--rise-line`) | 0 | `--dur-rise` 700ms | 80ms (`--delay-rise`), then `--stagger-line` 70ms (2 lines, ends at 850ms) | `--ease-post` | ScrollTrigger `entry-02:title`, `start: "top 85%"`, `once: true` |
| H2 (`kt-title-rise`, below 1024px) | `transform: translateY` of the whole title | 115% | 0 | `--dur-rise` 700ms | 80ms | `--ease-post` | `data-post="live"` |
| Settlement square (`en-post-square`) | `background-color` | transparent | `--foreground` | `--dur-colour` 300ms | 0 | `--ease-utility` | Post |
| Entry 01 row 01 cell (`kt-cell-swap`) | `opacity` of two stacked texts | `open · see 02` | `settled in 02` | `--dur-swap` 120ms | 0 | `--ease-linear` | `ledgerStore.post("02")`, only if the row is in the viewport |
| Eyebrow, body, panel, controls, rows, cards, footnotes | none | | | | | | Present from first paint |
| Canvas pose (`ho-pose`) | position, rotation, scale, `uLevel` | `slip-recede` | `slip-feed` | scroll | u 0 to 0.25 | smoothstep + `POSE_LAMBDA` | `entry-02:pose` |
| Flatten factor `f` | multiplies rotation | 1 | 0 | 120ms | t = 0 | `--ease-post` | u crosses 0.20 (`sq-feed-stop` step 1) |
| Feed (`em-feed`) | `uFeed` +2,880 texels; `uPrintY = uFeed - PRINT_GAP` each frame | | | `--dur-feed` 2,400ms | t = 0 | `--ease-feed` | Same |
| Stop | nothing moves | | | `--delay-feed-stop` 200ms | t = 2,400 | | |
| 02 line, row 1 (`em-print`) | `uFeed` +108 (paper), `uPrintY` to row end (head) | | | paper `--dur-paper` 520ms, head `--dur-print` 420ms | t = 2,600 | `--ease-post` | |
| 02 line, row 2 (`em-print`) | same | | | 520ms / 420ms | t = 3,120 | `--ease-post` | |
| Flat hold | `f` stays 0 | | | 200ms | t = 3,640 | | |
| Return (`ho-pose`) | `f` | 0 | 1 (rotation back to (0, -6, 0)) | `--dur-post` 600ms | t = 3,840 | `--ease-post` | Sequence ends at t = 4,440ms |
| Lane list rows, tier 0 (`en-row-print`) | `opacity`, `translateY` | 0, 6px (`--dist-row`) | 1, 0 | `--dur-row` 240ms | `--stagger-row` 60ms (summary, then 02) | `--ease-post` | Post (no Stage) |
| Tape line, below 1024px (`kt-tape-line`) | `translateY` old line 0 to -100%, new line 100% to 0 | | | `--dur-post` 600ms | 0 | `--ease-post` | `print("02")` |

Motion groups (MS 3.4): the post (rule, title, square, cell swap) is one group; `sq-feed-stop` is the second. That is the documented maximum of 2. `sq-feed-stop` is the page's single sequence above `DESIGN_AUTOPLAY_MS` (3,200ms) and stays under `MAX_AUTOPLAY_MS` (4,500ms) and the 5s of WCAG 2.2.2 (F11).

### 6.b Scroll-linked behaviour

| Trigger id | Created by | Trigger element | start | end | Pin | Scrub | Other options | Writes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `entry-02:pose` | `web/lib/motion/scene-driver.ts` | `section[data-section="entry-02-fit-gate"]` | `"top 85%"` | `"bottom 15%"` | none | none (standalone `ScrollTrigger.create`, scene smooths with `POSE_LAMBDA`) | `refreshPriority: 2`, `invalidateOnRefresh: true`, `fastScrollEnd: true` | `sceneInput.u` (and `entry` when this is the highest posted entry), `version++` |
| `entry-02:title` | `web/lib/motion/title-rise.ts` | same section | `"top 85%"` | none | none | none | `once: true`, `refreshPriority: 2`, `onEnter` plays `kt-line-rise` | none |
| Post observer | `EntryPoster` (IntersectionObserver, `rootMargin: "0px 0px -15% 0px"`) | same section | top at 85% | | | | Unobserves after posting | `data-post`, `ledgerStore.post("02")` |

There is no pin and no snap in this entry. Layout changes from row expansion, the disclosure, and font loading are picked up by the single `<main>` ResizeObserver (MS 5.3 rule 9), which calls `ScrollTrigger.refresh()` debounced 200ms; no component in this entry calls refresh.

Progress-to-value mapping (1440 by 900, H = 2,240px, R = 2,870px):

| u | Scroll past start | Entry top from viewport top | Scene and DOM |
| --- | --- | --- | --- |
| 0.00 | 0px | 765px | Post: rule draws, title rises, square fills, `ledgerStore.post("02")`; pose blend starts at 0 |
| 0.10 | 287px | 478px | Blend `smoothstep` = 0.352 |
| 0.20 | 574px | 191px | Blend 0.896; `sq-feed-stop` starts (once) |
| 0.25 | 718px | 47px | Blend 1.0; rest pose `slip-feed` |
| 0.25 to 0.78 | 718 to 2,240px | 47 to -1,475px | Held still (no renders once the pose has settled) |
| 0.78 | 2,240px | -1,475px (entry bottom at 765px) | Entry 03 posts; scene target becomes `slip-cite` |
| 1.00 | 2,870px | entry bottom at 135px | Trigger end |

Reverse scroll: the pose scrubs back toward `slip-recede` through u 0.25 to 0; nothing un-prints; the title and rule stay final; `sq-feed-stop` never replays.

### 6.c Micro-interactions

| Element | Preset | Hover (fine pointer only) | Focus-visible | Press | Other |
| --- | --- | --- | --- | --- | --- |
| Seniority, limit selects | `mi-control` | Border Fern Link to Moss 70, `--dur-colour` 300ms | 2px Phosphor White border plus 2px Moss 70 ring at 35%, instant | Native picker | Change recomputes in the input handler |
| Sponsorship segments | `mi-control` (segmented) | Inactive segment text Sage 60 to Phosphor White, 300ms | `mi-focus` outline on the active segment's label (radio is visually hidden, focus mirrored with `:has(:focus-visible)`) | Active fill Carbon Veil and square fill swap, 300ms colour | Arrow keys move between Yes and No (native radio group) |
| Fit bar | `mi-control` (range) | none | `mi-focus` on the thumb | Native drag; no thumb animation | Arrow keys step 5; Home 50; End 95 |
| Profile disclosure | `mi-details` | Summary text to Phosphor White, 300ms | `mi-focus` | Marker swaps plus to minus instantly; content not height-animated | |
| Skip row button | `mi-row-toggle` | Row fill Carbon Veil (F17: MS says Ground, which is invisible on the Ground panel), 300ms | `mi-focus` outline, 2px offset inside the panel | Glyph swaps orientation instantly (no rotation); list appears with no height animation | Enter and Space toggle |
| Row counts, run line numbers | `kt-odometer` | | | | Roll `--lp-dur-odometer` 240ms, `--ease-post`, all digit columns together; only after visitor input |
| Panel, kept cards, chips, badges | none | No hover, lift, scale, glow or shadow | | | Not interactive |
| Cursor | `mi-cursor` | Native; `cursor: pointer` on summary, row buttons, segment labels, selects | | | |

Rows that appear or disappear when a reason enters or leaves the result change instantly, with no entrance; the rows keep the fixed `fit.ts` order (lines 42 to 73), so remaining rows never reorder.

### 6.d Hand-off to the next section

The entry 03 graticule is the divider: it sits 128px (`--section-pad-landing`) below the settlement line and draws when entry 03's top crosses 85%, with tick 03 bright. On the canvas, `slip-feed` hands to `slip-cite` over entry 03 u 0 to 0.25 (rotation (0, -6, 0) to (2, -10, 0), scale stays 0.96), and the `03` line prints at entry 03 u 0.20, queued behind `sq-feed-stop` if it is still running. Lime custody does not change (navbar keeps it). Below 1024px the tape line changes from the 02 line to the 03 line with `kt-tape-line` when entry 03 posts.

---

## 7. Reduced-motion, no-JS and low-tier variants

| Context | Canvas | Feed beat | DOM | Lane or tape |
| --- | --- | --- | --- | --- |
| Full, T2 (1024px and wider) | 60fps, curl on, tilt off in this state | As specified, 4,440ms | Rule draws, title rises (SplitText), odometers roll | Lane list visually hidden (screen readers only) |
| Full, T1 | 30fps, half-size texture (feed rows 17px on a 30-texel rhythm), `uCurl` 0 (flat paper), same timings (dt-corrected) | Same | Same | Same |
| Full, T0 at 1024px and wider (no WebGL, `saveData`, failed probe, chunk timeout) | None; DOM poster stays | None | Same as T2 | Visible lane list on mint paper: the feed summary `<li>` and the 02 `<li>` append with `en-row-print` (240ms, 60ms stagger) on post |
| Below 1024px | None | None | Title uses `kt-title-rise` (CSS); odometers roll | Tape slides in the 02 line (`kt-tape-line`, 600ms) |
| Reduced (any width) | Not downloaded (Q6) | None | Rule drawn and title static from first paint; odometers change instantly; colour transitions (300ms) kept | Lane list (1024px and wider) or tape (below) updates instantly |
| No JavaScript | None | None | No `data-post` attribute, so every element is final. The panel renders the default combination's results with every count. The controls fieldset is rendered `disabled` and enabled after hydration, so a visitor without JavaScript never changes a control that does nothing; results remain fully readable | Lane: static DOM poster; tape: `ledger-rail.tapeDefault` |
| Stage ready after the visitor passed u 0.20 | Fades in (600ms) with the 48 rows and the 02 line already on paper (no sweep) | Skipped | | |
| Context lost during the feed | Canvas wrapper to `opacity: 0` instantly; the DOM list (already holding `feedRow` and `02` because the Stage printed at their start) becomes visible | The store is completed instantly (`markFeedDone`, `print("02")` if missing) | | On restore, paper is redrawn at final state, no sweep |
| Background tab during the feed | `lagSmoothing(0)` lets the tween jump to its end on return | Final state shown | | |
| Motion switched to Reduced during the feed | `completeAll()` jumps the sequence to its final state and commits the store writes, then the Stage unmounts | | Odometers snap | |

Odometer under Reduced: `--lp-dur-odometer` is zeroed, so values change in one frame; the live region still announces after 500ms.

---

## 8. Accessibility

### 8.1 Landmarks and headings

- `<section id="entry-02" data-section="entry-02-fit-gate" data-entry="02" data-scene="slip-feed" aria-labelledby="entry-02-title" class="lp-entry">` inside `<main id="main">`.
- `<h2 id="entry-02-title" tabindex="-1">` "A fit gate before anything else." (one H2 per entry).
- Panel: `<section class="lp-panel" aria-labelledby="entry-02-run-title">` with `<h3 id="entry-02-run-title">Sample run</h3>`; its accessible name begins with "Sample" (DS M6).
- `<h4>` for "Skipped by your rules" and "Kept". Kept cards are `<li>` items of a `<ul aria-labelledby="entry-02-kept-title">`; their titles are text in `<p class="lp-title">`, not headings, so the outline stays at four levels.
- The entry head rule and ticks are `aria-hidden="true"`; the number "02" is real text.

### 8.2 Focus order

1. (H2 is programmatically focusable only, for anchors and skip links.)
2. Seniority select.
3. Needs visa sponsorship radio group (one tab stop; arrows switch).
4. Per-company limit select.
5. Fit bar range.
6. "Rules in this sample" summary.
7. Each skip row button, top to bottom (the below-bar row is not focusable).
8. Next focusable element is in entry 03.

DOM order equals visual order at every breakpoint (the 2 by 2 grid fills row by row in the same order). Expanding a row does not move focus. Every target is at least 44px tall with 8px between hit areas (A16).

### 8.3 ARIA and screen-reader text

| Element | Markup |
| --- | --- |
| SAMPLE chip | `<span class="lp-chip lp-chip--sample"><span aria-hidden="true">SAMPLE</span><span class="sr-only">Sample data</span></span>` |
| Controls | `<fieldset disabled?>` with `<legend>Sample rules</legend>`; selects and range with `<label for>`; sponsorship as a nested `<fieldset>` with `<legend>Needs visa sponsorship</legend>` and two native radios |
| Range | `min="50" max="95" step="5" value="70"`, `aria-valuetext` from `barValueText`, updated in the input handler. The visible number beside the label is `aria-hidden` |
| Skip row | `<button type="button" aria-expanded="false" aria-controls="entry-02-skip-{code}" aria-label="{skipRowName}">`; the label contains the visible reason and count in the same order (WCAG 2.5.3) |
| Expanded list | `<ul id="entry-02-skip-{code}">` with up to five `skipPostingLine` items, then `skipMore`; rendered only while expanded |
| Odometer | Digit columns `aria-hidden="true"`; one visually hidden node holds the value |
| Fit badge | `<span class="sr-only">Sample fit score</span>` then `<span>fit 82</span>` |
| Live region | One `<p class="sr-only" aria-live="polite" aria-atomic="true">` inside the panel, written 500ms after the last sponsorship, seniority or limit change, with `liveRegion`, `liveRegionSeniority` or `liveRegionCap`. Range changes rely on `aria-valuetext` (F3) |
| Canvas | `aria-hidden="true"`. Its text alternative is the lane `<aside aria-label="Sample receipt">` list: one `<li>` "Sample run: 48 postings, {skipped} skipped, {passed} passed", then one `<li>` with the 02 line, then at most one `<li>` "RULES CHANGED · SAMPLE RE-CHECKED" per run of repeats (F14). Prints are not announced |
| Settlement line | Plain text; the posting square is `aria-hidden` |

### 8.4 Contrast of the pairings used

No new pairing is introduced. All are in DS 9: Phosphor White on Ground 16.41:1 (G1); Sage 60 on Ground 7.01:1 (G2); Moss 70 on Ground 8.70:1 (G3); Fern Link border on Ground 5.82:1 (G6, non-text); Phosphor White and Sage 60 on Carbon Veil 14.32:1 and 6.11:1 (C1, C2, row hover and active segment); range thumb 16.41:1 (S7); focus ring 16.41:1 on Ground (S1); Void ink on mint 17.61:1 (paper). Circuit Border dashed edges (2.20:1 on Ground) are decorative; the meaning is always in the SAMPLE chip, the panel name and the run line.

---

## 9. Performance notes

### 9.1 What animates

| Thing | Property | Compositor or paint |
| --- | --- | --- |
| Graticule rule | `transform: scaleX` | Compositor |
| H2 lines | `transform: translateY` (GSAP `force3D: "auto"`) | Compositor, promoted only during the 700ms rise; `split.revert()` afterwards |
| Settlement square, row hover, segment, focus-adjacent colours | `background-color`, `color`, `border-color` | Paint only, small areas |
| Odometers | `transform: translateY` on digit columns | Compositor; no `will-change` (24 columns at most would exceed `MAX_WILL_CHANGE` 4, and 240ms transitions promote themselves) |
| Canvas | `uFeed`, `uPrintY`, flatten factor, pose uniforms | GPU; at most one texture upload per frame during the feed (24 in 2.4s); zero renders at rest |

Nothing animates `height`, `width`, `top`, `margin`, `padding`, `box-shadow`, `filter` or `clip-path`. Row expansion and the disclosure are instant layout changes caused by input (outside CLS).

### 9.2 Counts

| Item | Count |
| --- | --- |
| DOM nodes in the entry (default state, rows collapsed) | About 260 |
| Additional nodes per expanded row | At most 7 |
| Skip rows | At most 9 rendered (8 in the default combination) plus the below-bar row |
| Kept cards | At most 3 |
| Odometer columns | 2 per count: up to 9 row counts plus 3 run-line counts, so at most 24 |
| ScrollTriggers owned by this entry | 2 (`entry-02:pose`, `entry-02:title`) |
| Event listeners | Delegated `change` and `input` on the panel root (one each), `click` on the ledger root (one) |
| Timers | One 500ms live-region debounce, one 800ms `rulesChanged` debounce; both cleared on unmount |

### 9.3 Interaction cost

`computeRun` iterates 48 postings and at most 9 reason codes per call: under 0.1ms. It runs in the input handler; the odometer starts on the next frame (INP target 100ms). No layout is read in the handler.

### 9.4 Assets and budgets

| Asset | Format | Budget | Where it loads |
| --- | --- | --- | --- |
| `web/content/fit-sample.json` | JSON, compacted (reason codes as 9-bit masks) | 4 KB gzip of the HTML/RSC budget (AR 3.2) | Imported by the Server Component and passed as props; never a JS chunk |
| `SampleRun` island plus `fit-run.ts` | JS | 3 KB gzip, counted in the 20 KB islands budget | With the route, all viewports |
| Feed rows and 02 line | Drawn into the existing print texture | 0 additional bytes and 0 additional MB of GPU memory | WebGL chunk (tiers 1 and 2) |
| Images, video, icons | none | 0 | The select caret is a CSS data URI already in `landing.css`; the disclosure glyph is CSS |
| Fonts | none new | 0 | Inter 400 and 500 from the root layout |

---

## 10. Implementation

### 10.1 Files

| Path | Kind | Responsibility |
| --- | --- | --- |
| `web/components/landing/entries/entry-02-fit-gate.tsx` | Server Component (new) | Renders the `Entry` shell with the head, eyebrow, H2, body paragraphs; the `SampleFrame` panel wrapping `SampleRun`; caveat, footnotes and the settlement line. Imports `fit-sample.json` and passes it to `SampleRun` |
| `web/components/landing/entries/entry.tsx` | Server Component (existing in AR) | Section DOM contract (AR 2.3), `EntryRule`, `data-split="lines"` on the H2 |
| `web/components/landing/marks/sample-frame.tsx` | Server Component (AR) | Dashed Ground panel, title row with `<h3>` and `SampleChip` |
| `web/components/landing/marks/chip.tsx` | Server Component (AR) | `SampleChip` |
| `web/components/landing/marks/posting-square.tsx` | Server Component (AR) | M3 square, `filled` prop |
| `web/components/landing/islands/sample-run.tsx` | Client Component (AR, new) | Controls, run line, skip ledger, below-bar row, kept cards, live region, `rulesChanged` request |
| `web/components/landing/islands/odometer.tsx` | Client Component (AR) | Reused for every count |
| `web/lib/landing/fit-run.ts` | Module (new; not listed in AR 1.1) | Pure `comboIndex` and `computeRun`, unit-testable without React |
| `web/test/fit-run.test.ts` | Vitest (new) | The one runnable check for `computeRun` (11) |
| `web/content/fit-sample.json` | Data (AR, generated by P1, committed) | Postings, reason strings, 18 combinations, authored cards |
| `server/scripts/build-landing-fit-sample.ts` | Script (P1) | Imports `passesHardFilters` from `server/src/services/fit.ts` and writes the JSON |
| `server/test/landing-fit-sample.test.ts` | Server test (P1) | Drift test |
| `web/content/landing-copy.ts` | Data | Adds `liveRegionSeniority`, `liveRegionCap`, `keptNone` and `scene.feedSummary`; edits `profileBody` (F1) |
| `web/components/landing/islands/entry-poster.tsx` | Client Component (AR) | Adds the no-Stage print of `feedRow` and `02` on posting entry 02 (5.4) |
| Stage files (`stage/scene.ts`, `stage/print-texture.ts`, `stage/poses.ts`) | WebGL chunk (WS) | Own `sq-feed-stop`'s canvas steps; read `fit-sample.json` rows through `receipt-lines` |

### 10.2 Data contract

```ts
// web/lib/landing/fit-run.ts  [M]
export type Seniority = "entry" | "mid" | "senior";
export type Sponsorship = "yes" | "no";
export type Cap = 1 | 2 | 3;

export interface FitSample {
  version: 1;
  reasons: string[];                 // exact fit.ts strings in fit.ts order; index = reason code (max 9)
  postings: { id: string; company: string; title: string; score: number }[]; // 48, posting order; score written by us
  combos: number[][];                // 18 arrays of 48 bitmasks; bit c set = reason code c; 0 = passes
  cards: { id: string; title: string; lines: [string, string, string]; validIn: number[] }[]; // the 3 authored cards
}

export const comboIndex = (s: Seniority, v: Sponsorship, c: Cap) =>
  ["entry", "mid", "senior"].indexOf(s) * 6 + (v === "yes" ? 0 : 3) + (c - 1);

export interface RunResult {
  skipped: number; passed: number; kept: number; below: number;
  rows: { code: number; count: number; postings: number[] }[]; // codes present, fit.ts order
  cards: FitSample["cards"];         // kept, valid in this combo, score descending, at most 3
  more: number;                      // kept - cards.length
}
export function computeRun(sample: FitSample, combo: number, bar: number): RunResult;
```

Rules inside `computeRun`: `skipped` = postings with a non-zero mask; `passed` = 48 − `skipped`; `kept` = passed postings with `score >= bar`; `below` = `passed − kept`; each row counts every posting whose mask has that bit (so row counts can sum to more than `skipped`, which `skipFootnote` explains); `cards` are authored cards whose posting is kept and whose `validIn` contains `combo`.

P1 generator inputs (fixed, so the JSON is reproducible): roles `["Software Engineer", "Backend Engineer"]` (so "Backend Engineer I" matches `titleMatchesRole`), locations `["New York", "Austin"]`, `remoteOk: true`, `salaryFloorUsd: 85000`, one excluded company (`"Company 031"`), `excludedKeywords: ["clearance"]`; seniority Entry, Mid, Senior map to `["entry"]`, `["mid"]`, `["senior"]`; sponsorship Yes maps to `workAuthorization: "needs_sponsorship_now"`, No to `"citizen_or_pr"`; the limit maps to `maxApplicationsPerCompanyPer30Days` 1, 2 or 3 against a fixed synthetic count of recent applications per company (0 to 3). Postings use ids of four digits and companies "Company 001" to "Company 040". The three authored cards are postings at companies 014, 027 and 003 with scores 82, 76 and 74, which pass in the default combination; cards 1 and 3 are valid only where seniority is Entry, card 2 wherever it passes (F7). Design targets: 8 to 12 postings pass the default hard rules; 3 to 5 score 70 or more; every reachable string appears at least twice (F6).

### 10.3 `SampleRun` props and state

```ts
interface SampleRunProps {
  sample: FitSample;                               // from fit-sample.json
  copy: (typeof landingCopy)["entry-02-fit-gate"]; // strings passed as props, not bundled
}
// state: seniority ("entry"), sponsorship ("yes"), cap (2), bar (70), open: Set<number>, enabled (false until mounted)
```

- First client render equals the server render (defaults, `enabled = false` so the fieldset is `disabled`); a mount effect sets `enabled = true`.
- One delegated `change` handler (selects, radios) and one `input` handler (range) on the panel root update state; results come from `computeRun` in render (pure, cheap).
- Live region: a 500ms timeout reset on each rule change writes the matching template.
- `rulesChanged`: an 800ms timeout reset on any control change calls `ledgerStore.print("rulesChanged")` only when `ledgerStore.getSnapshot().feedDone` is true; if the feed is not done yet, it sets a pending flag that the Stage or `EntryPoster` honours right after `02` prints (5.3).
- Cleanup clears both timeouts. No `Date`, `Math.random` or storage access in render.
- No GSAP import; the island works at every width.

### 10.4 Presets and tokens used

Presets: `en-post-rule`, `kt-line-rise`, `kt-title-rise`, `en-post-square`, `kt-cell-swap` (in entry 01), `kt-odometer`, `ho-pose`, `em-feed`, `em-print`, `sq-feed-stop`, `en-row-print` (tier 0 lane), `kt-tape-line` (below 1024px), `mi-control`, `mi-details`, `mi-row-toggle`, `mi-focus`, `mi-cursor`.

Tokens: `--type-heading-landing`, `--lh-heading-landing`, `--tracking-heading-landing`, `--measure-title`, `--measure-body`, `--section-pad-landing`, `--lp-head-h`, `--lp-hit`, `--lp-hit-gap`, `--sample-border`, `--surface`, `--surface-raised`, `--foreground`, `--body`, `--label`, `--lead`, `--link`, `--border`, `--divider`, `--r-card`, `--r-pill`, `--ease-post`, `--ease-feed`, `--ease-utility`, `--ease-linear`, `--dur-post`, `--dur-rise`, `--dur-row`, `--dur-colour`, `--dur-swap`, `--dur-feed`, `--dur-print`, `--dur-paper`, `--delay-rise`, `--delay-feed-stop`, `--stagger-line`, `--stagger-row`, `--dist-row`, `--rise-line`, `--lp-dur-odometer`, `--lp-z-canvas`, `--lp-z-content`.

Reused existing components: `Entry`, `EntryRule`, `SampleFrame`, `SampleChip`, `PostingSquare`, `Odometer`, `EntryPoster`, `LaneReceipt`, `ReceiptTape` (all from AR 1.1). The old `web/components/landing/match-preview.tsx` is deleted (AR 1.2); its match-card content lives here as the kept cards.

---

## 11. Acceptance criteria

Content and data

- [ ] Every visible string matches `landingCopy["entry-02-fit-gate"]` exactly, including F1 to F4; a copy-lint grep finds no U+2014, U+2013 or hype words in the entry files.
- [ ] `server/test/landing-fit-sample.test.ts` passes: re-running the P1 script reproduces `fit-sample.json` byte for byte, and every string in `reasons` is producible by `passesHardFilters`.
- [ ] The default combination has 48 postings, 8 to 12 passing, 3 to 5 at score 70 or above; each reachable reason string appears at least twice; under Senior, "Title is more junior than you asked for" appears at least twice.
- [ ] `web/test/fit-run.test.ts`: for all 18 combinations and bars 50 to 95, `skipped + passed = 48`, `kept + below = passed`, every row count equals the number of masks with that bit, cards are only those whose `validIn` contains the combination, and `more = kept − cards.length`.
- [ ] Server HTML (JavaScript disabled) shows the default run line with real numbers, every default skip row and count, the three kept cards (or fewer if the data says so), and a `disabled` controls fieldset.

Behaviour

- [ ] Changing any control updates counts in the same frame as the input event (INP 100ms or less in the Playwright trace) and rolls odometers in 240ms; under Reduced they change in one frame.
- [ ] Rows appear and disappear without reordering; their order is the `fit.ts` order.
- [ ] Mid seniority shows no seniority rows; Senior shows the junior row.
- [ ] At fit bar 85 or more the Kept area shows `keptNone` with the current value when no authored card qualifies.
- [ ] The run line always ends with "0 sent from this page".
- [ ] Posting entry 02 flips entry 01 row 01 to `settled in 02` and it never reverts.

Scene (Playwright with `NEXT_PUBLIC_STAGE_DEBUG=1`, 1440 by 900, T2)

- [ ] `window.__kairosStage.state` is `slip-feed` between entry 02 u 0.25 and entry 03 u 0.
- [ ] Crossing u 0.20 forward starts the feed once: `ledgerStore.printed` gains `feedRow` at t = 0 and `02` at t = 2,600ms (±50ms); `feedDone` is true at t = 2,400ms (±50ms); the stage stops rendering by t = 4,440ms (+100ms).
- [ ] During t = 2,400 to 2,600ms the frame sampler records no uniform change.
- [ ] Scrolling up and down again never replays the feed; reloading after it shows the final paper with no animation.
- [ ] With `?stage-slow`, a control change followed by 800ms of no input prints exactly one `rulesChanged`; a ninth request in a session prints nothing; the DOM list shows one `rulesChanged` item.
- [ ] The palette histogram at three scroll positions inside the entry contains no lime pixels.
- [ ] `fastScrollEnd`: an instant jump from entry 01 to entry 04 leaves `feedRow` and `02` in `printed` and no tween running.

Variants

- [ ] Reduced: no canvas element, no WebGL chunk request, rule and title final at first paint, lane list contains the feed summary and 02 items.
- [ ] Tier 0 at 1024px and wider: the lane list shows the summary and 02 rows with `en-row-print` on post.
- [ ] 390 by 844 and 360 by 740: no horizontal scroll (document `scrollWidth` equals `clientWidth`), the tape shows the 02 line after the post, every control is 44px tall or more with 8px spacing.

Lime and visual

- [ ] The lime-count Playwright check (100px steps) finds at most one lime element in every viewport of this entry, and that element is the navbar "Start free".
- [ ] Every demo surface has the dashed edge and the panel's accessible name begins with "Sample".
- [ ] No text in the entry is below 12px, and font weights are 400 or 500 only.

Accessibility

- [ ] axe reports no violations for the entry in default, expanded-row and Reduced states.
- [ ] Tab order is: Seniority, sponsorship, limit, fit bar, disclosure, skip rows; the below-bar row and cards are not focusable.
- [ ] Each skip row button exposes `aria-expanded` and an accessible name containing its visible reason and count.
- [ ] The live region announces once, 500ms after the last rule change, using the template for the control that changed; range changes announce only through `aria-valuetext`.
- [ ] Focus outlines are 2px Phosphor White with a 2px offset and are never clipped by the panel.

Performance

- [ ] `fit-sample.json` adds 4 KB gzip or less to the HTML; the `SampleRun` island adds 3 KB gzip or less to the islands chunk (budget test).
- [ ] During the feed at T2, main-thread work stays under 8ms per frame and texture uploads are at most one per frame.
- [ ] CLS for a load that scrolls through the entry without input is 0.05 or less; no layout property is animated (Q3 grep).
