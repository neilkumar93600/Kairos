# Kairos landing page: copy deck

Date: 2026-10-15. Status: complete copy for every word on `/`. Owner: copy. Companion to `01-creative-direction.md` (section ids, scene state ids, motion), `02-design-system.md` (tokens), `03-motion-system.md`, `04-webgl-scene.md` and `05-architecture.md`.

Inputs: `_research/facts.md` (the only permitted fact source, with its keys PRD, APP, PRC, BRIEF, SITE), `01-creative-direction.md` (CD), `server/src/services/fit.ts` (the real reason strings, lines 42 to 73), `shared/src/plans.ts` (plan prices, taglines and feature strings, gate P3), `web/lib/site.ts` (nav, footer, description, support email), `docs/pricing.md` (PRC).

Skills applied: `copywriting` (one promise per section, a CTA that names the action, no ad-to-page mismatch), `antislop:antislop-copywriting` (no fabricated specifics, no em dashes, no rule-of-three padding, every sentence names its actor) and `ux-copy` (buttons are verb plus object, errors say what happened and what to do next, status words carry the word). All three loaded.

---

## 0. How to read this deck

### 0.1 Keys

Every string has a key `{sectionId}.{element}`. Section ids are the exact ids from CD section 6 (`navbar`, `ledger-rail`, `entry-00-hero` to `entry-10-start`, `footer`) plus `meta` for the document head. The build reads these keys from one module, `web/content/landing-copy.ts`, which exports a frozen object `landingCopy` whose top-level keys are the section ids. Components never hold copy inline; every user-facing string on the landing resolves to a key in this deck, and the copy lint (CD 10.5) runs over that module.

Placeholders are written in braces and are the only dynamic text on the page:

| Placeholder | Filled by | Example |
| --- | --- | --- |
| `{approvedAt}` | `Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })` read in the Approve click handler and stored in `ledgerStore.approvedAt` (CD 2.3, 9.4) | 10/15/26, 2:02 PM |
| `{approvedTime}` | The same read, `timeStyle: "short"` only | 2:02 PM |
| `{skipped}`, `{below}`, `{kept}`, `{passed}`, `{n}` | `web/content/fit-sample.json` for the current control combination (prerequisite P1) | 31, 9, 4 |
| `{BUILD_DATE}` | `next.config.ts` `env` at build (CD 5.4) | 2026-10-15 |
| `{BUILD_YEAR}` | First four characters of `{BUILD_DATE}` | 2026 |
| `{N}` | Count of registered claims in `web/content/claims.ts` at build | 6 |
| `{HH:MM}` | Footer clock effect, once a minute, visitor's locale, `timeStyle: "short"` (CD 3.4) | 14:32 |
| `{price}`, `{credits}`, `{perApp}`, `{remaining}` | Receipt calculator pure function (CD 9.3) | $39.00, 1,200, $0.065, 600 |
| `{plan}`, `{interval}` | Current selection | Pro, Monthly |

### 0.2 Source brackets

Every number and every factual claim carries a trailing bracket naming its source so a reviewer can check it without opening this deck's inputs twice. Keys:

| Bracket | Means |
| --- | --- |
| `[PRD AC10]` | `docs/01-prd.md`, acceptance criterion 10 (via facts.md 1.1) |
| `[PRD core]` | PRD core features table (facts.md 2.1) |
| `[PRD problem]` | PRD problem section, user-reported complaints (facts.md 3.3) |
| `[APP]` | `docs/03-app-flow.md` (facts.md 1.1) |
| `[PRC Plans]`, `[PRC Rollover]`, `[PRC Billing]`, `[PRC Weekly]`, `[PRC Price research]` | `docs/pricing.md` sections |
| `[plans.ts {id}.{field}]` | `shared/src/plans.ts`, read verbatim (gate P3) |
| `[fit.ts L42]` | `server/src/services/fit.ts`, line number of the reason string |
| `[SITE]` | `web/lib/site.ts` |
| `[CD n.n]` | `01-creative-direction.md`, the section that fixed the wording or the mechanism |
| `[SAMPLE]` | A synthetic value that exists only inside a labelled demo; it is not a fact about the product and must sit under a SAMPLE chip and a dashed edge (CD 2.4) |
| `[ARITH]` | Arithmetic from bracketed figures; the formula is given |

### 0.3 Lime

Each section table has a Lime column. `LIME` marks the one button that may show the Lime Pulse fill, and only while it owns custody (CD 3.3). Every other button is Default or outlined. A viewport never contains two LIME-marked elements because custody is sequential; this deck lists, per section, which element is lime when that section fills the viewport.

### 0.4 Character counts and widths

Counts include spaces and punctuation. Widths assume the CD 8.2 scale: Inter Tight 400 at `--type-display-landing` for the H1 and at `--type-heading-landing` for H2s, tracking −0.025em and −0.02em, average advance about 0.46em after tracking. The desktop measure for H2s is 7 grid columns (696px at a 1280px container), the hero H1 measure is 8 columns (800px), and the phone measure is 358px (390px viewport, 16px gutters). Characters per line: about 17 for the H1 at 1440px (101px type), about 27 for H2s at 1440px (56px type), about 21 for H2s on a 390px phone (36px type), about 16 for the H1 on a 390px phone (48px type). Section 11 lists the expected line breaks. All H1 and H2 elements set `text-wrap: balance`. A widow is a last line holding one word of five characters or fewer; none of the headlines below produce one at 1440, 1024 or 390px under these assumptions, and the one borderline case (the hero H1 on a 390px phone) has a fix in section 11.

### 0.5 Characters that are allowed and banned

Allowed: the middle dot `·` (U+00B7) as the separator on receipt lines, chips and captions; the minus sign `−` (U+2212) on credit amounts; straight quotes in reason strings exactly as `fit.ts` emits them. Banned everywhere, including this deck: em dash (U+2014), en dash (U+2013), the hype list in facts.md 4.2, "No card" (gate G4), any competitor name, any count of users, any outcome rate.

---

## 1. Voice rules applied to every string

1. Calm, exact, accountable. Each sentence states a mechanism, a rule, a price or a labelled sample [CD 2.1].
2. Second person for the visitor, first person plural for the company, "Kairos" for the system [CD 2.2].
3. Headings are one sentence ending in a full stop. Body sentences average 15 words and never pass 30 [CD 2.2].
4. Status words carry the word: Submitted, Failed, Needs review, Approved, Kept, Skipped, Below your fit bar, Not saved [CD 2.2].
5. No fear urgency and no countdowns. Every time stamp records a decision [CD 1.4].
6. Attribute, never accuse: "Reported by people who used other tools." No product is named [CD 2.1].
7. Every sample is called a sample in words, on the surface where it appears [CD 2.4].

---

## 2. `meta`: document head and social

| Key | Element | Copy | Count | Source |
| --- | --- | --- | --- | --- |
| `meta.title` | `<title>` | Kairos: job applications you would sign | 39 chars | [CD 14] |
| `meta.description` | `<meta name="description">` | Kairos finds jobs that fit, tailors your resume from facts you confirmed, and sends only the applications you approve. | 118 chars | [SITE description] |
| `meta.ogTitle` | `og:title` | Job applications you would sign. | 32 chars | [CD 5.3] |
| `meta.ogDescription` | `og:description` | Kairos finds roles that fit, tailors your resume only from facts you confirmed, and sends nothing until you approve it. Every submitted application comes with a receipt. | 169 chars | [CD 5.3]; "submitted" per facts.md 1.6 |
| `meta.ogImageAlt` | `og:image:alt` and `twitter:image:alt` | A dark page with the headline Job applications you would sign and a pale sample receipt slip printed with the words KAIROS, RECEIPT, SAMPLE. | 143 chars | Describes the 1200 by 630 image in [CD 14] |
| `meta.ogSiteName` | `og:site_name` | Kairos | | [SITE name] |
| `meta.twitterCard` | `twitter:card` | summary_large_image | | |
| `meta.canonical` | `<link rel="canonical">` | `{siteConfig.url}/` | | [SITE url] |
| `meta.lang` | `<html lang>` | en | | |
| `meta.orgJsonLd.name` | `Organization` JSON-LD `name` | Kairos | | [SITE name] |
| `meta.orgJsonLd.legalName` | `legalName` | Gray Matter Labs | | [SITE company] |
| `meta.orgJsonLd.url` | `url` | `{siteConfig.url}` | | [SITE url] |
| `meta.orgJsonLd.email` | `email` | `{siteConfig.supportEmail}` | | [SITE supportEmail]; domain is PRD open question 1, so it is read from config and never typed here |
| `meta.faqJsonLd` | `FAQPage` JSON-LD | The six question and answer pairs in section 12 (`entry-09-questions`), copied from the same keys so they cannot drift | | [CD 5.3 entry 09] |

The `Organization` block carries no `aggregateRating`, no `review` and no `numberOfEmployees` [CD 14].

---

## 3. `navbar`

Lime in this viewport: `navbar.startFree` is LIME only while no in-page candidate is visible (CD 3.3 priority 5). Server HTML ships `data-lime-owner="hero"`, so on first paint the navbar button is Default.

| Key | Element | Copy | Lime | Source and notes |
| --- | --- | --- | --- | --- |
| `navbar.logoAria` | `aria-label` on the logo link | Kairos, home | | Link to `/` |
| `navbar.wordmark` | Visible text beside the mark | Kairos | | [SITE name] |
| `navbar.links` | Nav links | How it works · Pricing · Blog · About | | [SITE publicNav], in that order, hrefs from config |
| `navbar.login` | Ghost button | Log in | | Links to `/login` |
| `navbar.startFree` | Button | Start free | LIME when owner | Links to `/sign-up` |
| `navbar.entryCaption` | Caption, 1024 to 1279px only, `aria-hidden="true"` | {NN} / 10 | | Current entry number from the rail observer; the rail is the accessible source [CD 5.4] |
| `navbar.menuButton` | `aria-label` on the menu button below 1024px | Menu | | `aria-expanded` reflects the sheet |
| `navbar.menuButtonClose` | Same button while the sheet is open | Close menu | | |
| `navbar.sheetTitle` | `<dialog aria-label>` | Site menu | | Native `<dialog>`, `data-lenis-prevent` |
| `navbar.sheetStartFree` | Button inside the sheet | Start free | LIME when owner | The same custody rule as the bar |
| `skip.main` | First skip link | Skip to main content | | Target `#main` |
| `skip.pricing` | Second skip link | Skip to pricing | | Target `#entry-07-billing` |

---

## 4. `ledger-rail`: rail (1280px and wider) and receipt tape (below 1024px)

| Key | Element | Copy | Source and notes |
| --- | --- | --- | --- |
| `ledger-rail.navAria` | `<nav aria-label>` | Page entries | [CD 5.4] |
| `ledger-rail.entries` | 11 link names, visible number plus hidden title revealed on hover or focus | 00 · Open / 01 · Reported / 02 · Fit gate / 03 · Truth lock / 04 · Approve / 05 · Send and receipt / 06 · Replies / 07 · Billing / 08 · Compare / 09 · Questions / 10 · Start | Each link's accessible name is "Entry {NN}, {title}", for example "Entry 05, Send and receipt". The active link carries `aria-current="true"` |
| `ledger-rail.currentSuffix` | Visually hidden suffix on the active link | , current | Read as "Entry 05, Send and receipt, current" |
| `ledger-rail.tapeLabel` | Tape `role="button"` accessible name | Sample receipt. Latest line: {latestLine}. Open the list of posted lines. | |
| `ledger-rail.tapeDefault` | Tape text before any line posts past 00 | 00 · Ledger opened | [CD 4.4] |
| `ledger-rail.tapeDialogTitle` | `<dialog aria-label>` | Posted lines and entries | |
| `ledger-rail.tapeListHeading` | Heading inside the dialog | Posted so far | |
| `ledger-rail.tapeEntriesHeading` | Second heading | Go to an entry | Followed by the 11 entry links above |
| `ledger-rail.tapeClose` | Close button | Close | |

---

## 5. `entry-00-hero`: Open

Lime in this viewport: `entry-00-hero.ctaPrimary` (priority 2, the server default owner). The navbar button is Default here.

| Key | Element | Copy | Count | Lime | Source and notes |
| --- | --- | --- | --- | --- | --- |
| `entry-00-hero.eyebrow` | Micro-label, Caption | For new grads, OPT and anyone between jobs | 43 | | [facts 5.1 KEEP]; segments in [PRD target users] |
| `entry-00-hero.h1` | H1, `--type-display-landing` | Job applications you would sign. | 32 | | [facts 5.1 KEEP]. Word spans for Ink (CD 8.2); the signature rule sits under "sign." |
| `entry-00-hero.h1Alt` | Alternate H1 (not shipped, for the G7 comprehension test) | Applications you approve first. | 31 | | Mechanism, no outcome |
| `entry-00-hero.subhead` | Lead, 20px | Kairos finds roles that fit, tailors your resume only from facts you confirmed, and sends nothing until you approve it. Every submitted application comes with a receipt. | 169 | | [facts 5.1 FIX applied: "submitted"]; receipt exists only for submitted applications [PRD user story 7, AC10] |
| `entry-00-hero.ctaPrimary` | Button, 48px pill | Start with 25 free applications | 31 | LIME | 25 credits at sign-up [PRD AC1]; "once" is stated in the microcopy of entry 10 and in plans.ts [plans.ts free.features[0]]. Links to `/sign-up` |
| `entry-00-hero.ctaSecondary` | Outlined button | See how it works | 16 | | Anchors to `#entry-02-fit-gate` [CD 5.3] |
| `entry-00-hero.microcopy` | 14px, Sage 60 | Credits are only used when an application actually goes through. | 64 | | [PRD AC10; PRC Value metric]. "No card" omitted until G4 |
| `entry-00-hero.microcopyChip` | Claim chip after the microcopy | see 07 | | | Accessible name: See entry 07, Billing and pricing. Registered claim 1 of 6 [CD 10.6] |
| `entry-00-hero.laneCaption` | 14px under the slip | Sample receipt. It prints as you read. | 39 | | [CD 5.3] |
| `entry-00-hero.posterAlt` | `alt` on the hero poster `<img>` | (empty string) | | | The lane's `<aside aria-label="Sample receipt">` already lists the printed lines, so the poster is decorative; a non-empty alt would announce the same text twice (CD 4.8) |
| `entry-00-hero.laneAsideAria` | `<aside aria-label>` | Sample receipt | | | [CD 4.8] |
| `entry-00-hero.laneAsideIntro` | First visually hidden sentence in the aside | This sample receipt prints one line for each part of this page. Nothing on it was sent to an employer. | 102 | | Text alternative for the WebGL scene; followed by the `<ol>` in section 15 |
| `entry-00-hero.miniReceiptHeader` | Below 1024px, DOM mini receipt first line | KAIROS · RECEIPT · SAMPLE | | | [CD 4.4] |
| `entry-00-hero.miniReceiptLine00` | Second line | 00 · Ledger opened | | | [CD 4.4] |

---

## 6. `entry-01-reported`: five debits

Lime in this viewport: none in page; `navbar.startFree` is LIME.

| Key | Element | Copy | Count | Source and notes |
| --- | --- | --- | --- | --- |
| `entry-01-reported.number` | Entry number | 01 | | |
| `entry-01-reported.eyebrow` | Caption | Reported by people who used other tools. Not measured by us. | 61 | [CD 2.4] |
| `entry-01-reported.h2` | H2 | Five things people report about auto-apply tools. | 49 | [CD 5.3]; the five rows are PRD complaints 1, 3, 2, 4 and 6 narrowed [PRD problem] |
| `entry-01-reported.h2Alt` | Alternate H2 | What people report, and where each is settled. | 45 | |
| `entry-01-reported.lead` | Body | Kairos was designed around these reports. Four are settled further down this page, where you can check each one. One stays open, and we say why. | 143 | [CD 2.1 lead with the promise] |
| `entry-01-reported.rows[0].text` | Row 01 | Matches that do not fit. | | [PRD problem 1] |
| `entry-01-reported.rows[1].text` | Row 02 | Resumes with skills and metrics the person does not have. | | [PRD problem 3] |
| `entry-01-reported.rows[2].text` | Row 03 | A review step without an edit step. | | [PRD problem 2] |
| `entry-01-reported.rows[3].text` | Row 04 | Hundreds of applications and zero interviews. | | [PRD problem 4], verbatim |
| `entry-01-reported.rows[4].text` | Row 05 | Charges after cancelling, and lost credits. | | [PRD problem 6], narrowed; refunds omitted (PRD open question 5) |
| `entry-01-reported.cellOpen` | Right cell, server and first client render | open · see {NN} | | Link to `#entry-{NN}-…`; accessible name "Open. See entry {NN}, {title}" |
| `entry-01-reported.cellSettled` | Right cell after the settling entry posts | settled in {NN} | | Phosphor White, filled posting square. Row 01 → 02, row 02 → 03, row 03 → 04, row 05 → 07 [CD 5.3] |
| `entry-01-reported.cellSettledStamp` | Row 03 only, after approval | settled in 04 · {approvedTime} | | [CD 5.3 entry 01] |
| `entry-01-reported.cellStaysOpen` | Row 04 for the whole page | open · see 06 | | Never changes [CD 1.2] |
| `entry-01-reported.squareAriaPosted` | Visually hidden text beside a filled square | Settled. | | Colour never carries meaning alone |
| `entry-01-reported.squareAriaOpen` | Beside an outlined square | Open. | | |
| `entry-01-reported.footnote` | 14px, Sage 60 | We do not name other products. | 30 | [CD 5.3] |

---

## 7. `entry-02-fit-gate`: fit gate and the sample run

Lime in this viewport: none in page; `navbar.startFree` is LIME. Every element inside the demo panel sits under the SAMPLE chip and the dashed edge (M6).

### 7.1 Copy

| Key | Element | Copy | Count | Source and notes |
| --- | --- | --- | --- | --- |
| `entry-02-fit-gate.number` | Entry number | 02 | | |
| `entry-02-fit-gate.eyebrow` | Caption | Fit gate | 8 | |
| `entry-02-fit-gate.h2` | H2 | A fit gate before anything else. | 32 | [facts 5.3 KEEP] |
| `entry-02-fit-gate.h2Alt` | Alternate H2 | Hard rules first. Every skip has a reason. | 42 | |
| `entry-02-fit-gate.body` | Body | Role, seniority, location, salary floor, visa needs and your exclude list are hard rules. A job that breaks one is dropped before any model reads it, and the rest come with written reasons. | 190 | [facts 5.3 KEEP]; rules map to [fit.ts L42 to L73] |
| `entry-02-fit-gate.body2` | Body | Jobs that miss a hard rule never cost a model call, and a skip never costs a credit. New postings come from public career pages on Greenhouse, Lever and Ashby. | 164 | Model call rule [facts 1.1, HIW step 02]; credit rule [PRC Value metric]; boards [PRD core row 1]. No polling speed is stated (facts 6.2) |
| `entry-02-fit-gate.settles` | Settlement line | Settles 01. You see each skip and the reason. | 44 | [CD 5.3] |

### 7.2 Demo panel: Sample run

| Key | Element | Copy | Source and notes |
| --- | --- | --- | --- |
| `entry-02-fit-gate.panelTitle` | Panel heading | Sample run | [CD 5.3] |
| `entry-02-fit-gate.sampleChip` | SAMPLE chip | SAMPLE | M6; accessible name "Sample data" |
| `entry-02-fit-gate.controlsLegend` | `<fieldset><legend>` | Sample rules | |
| `entry-02-fit-gate.seniorityLabel` | `<label>` for `<select>` | Seniority | |
| `entry-02-fit-gate.seniorityOptions` | Options | Entry · Mid · Senior | Default Entry [CD 5.3]; seniority rule [PRD AC3] |
| `entry-02-fit-gate.sponsorshipLegend` | Radio group legend | Needs visa sponsorship | [PRD AC4] |
| `entry-02-fit-gate.sponsorshipOptions` | Radios | Yes · No | Default Yes |
| `entry-02-fit-gate.capLabel` | `<label>` for `<select>` | Per-company limit | [PRD AC5] |
| `entry-02-fit-gate.capOptions` | Options | 2 in 30 days · 1 in 30 days · 3 in 30 days | Default "2 in 30 days" [PRD core, per-company cap default 2 per 30 days] |
| `entry-02-fit-gate.barLabel` | `<label>` for the range | Your fit bar (sample setting) | No product default is documented (facts 1.6), so the label says "sample setting" |
| `entry-02-fit-gate.barValueText` | `aria-valuetext` template | Fit bar {value}. {kept} of {passed} sample postings kept. | Range 50 to 95, step 5, default 70 [CD 5.3] |
| `entry-02-fit-gate.profileSummary` | `<details><summary>` | Rules in this sample | |
| `entry-02-fit-gate.profileBody` | Inside the disclosure | Entry-level software engineer roles, needs visa sponsorship, remote or New York or Austin, salary floor $85,000, one excluded company, at most 2 applications per company in 30 days. | [SAMPLE] profile from [CD 5.3]; the 2 per 30 days default is real [PRD core] |
| `entry-02-fit-gate.skipLedgerHeading` | Heading above the skip rows | Skipped by your rules | |
| `entry-02-fit-gate.skipRowName` | Row button accessible name template | {reason}. {n} postings. Show them. | `aria-expanded`; visible text is the reason and the count |
| `entry-02-fit-gate.skipRowNameOpen` | While expanded | {reason}. {n} postings. Hide them. | |
| `entry-02-fit-gate.skipReasons` | Visible row text, one per reason present in the result | Title does not match your roles [fit.ts L42] · Title is more senior than you asked for [fit.ts L46] · Title is more junior than you asked for [fit.ts L47] · Location is outside your list [fit.ts L53] · Company is on your exclude list [fit.ts L56] · Mentions excluded keyword "{keyword}" [fit.ts L60] · Posted salary is below your floor [fit.ts L63] · Posting says it does not sponsor visas [fit.ts L70] · You hit your per-company limit for the last 30 days [fit.ts L73] | Rendered from `fit-sample.json`, never typed in the component; the drift test (P1) guards them |
| `entry-02-fit-gate.skipRowCount` | Count cell | {n} | Odometer, 240ms; `tabular-nums slashed-zero` |
| `entry-02-fit-gate.skipPostingLine` | Expanded list item template | {id} · {company} · {title} · {reasons joined with " · "} | Example: 0417 · Company 022 · Senior Software Engineer · Title is more senior than you asked for · Posting says it does not sponsor visas [SAMPLE] |
| `entry-02-fit-gate.skipMore` | After five items | and {n} more | |
| `entry-02-fit-gate.skipFootnote` | Footnote in the panel | A posting can break more than one rule. Each skipped posting keeps every reason. | [CD 5.3]; `reasons: string[]` in [fit.ts L16] |
| `entry-02-fit-gate.belowBarRow` | One ledger row for postings that pass the rules but miss the bar | Below your fit bar | Count cell {below} [CD 5.3] |
| `entry-02-fit-gate.keptHeading` | Heading above the kept cards | Kept | Status word |
| `entry-02-fit-gate.keptCards[0]` | Card 1 | Company 014 · Software Engineer, Platform / fit 82 / Entry-level title, matches your roles / Posting says it sponsors visas / Asks for Kafka; your profile mentions RabbitMQ only | [SAMPLE]; the third line's pattern is kept from facts 5.2 |
| `entry-02-fit-gate.keptCards[1]` | Card 2 | Company 027 · Backend Engineer I / fit 76 / Remote, within your list / Posted salary is above your floor / Asks for Go; your profile lists TypeScript and Python only | [SAMPLE] |
| `entry-02-fit-gate.keptCards[2]` | Card 3 | Company 003 · Software Engineer, New Grad / fit 74 / New-grad title, matches your seniority / Austin, within your list / Asks for a year of React; your profile shows a course project only | [SAMPLE] |
| `entry-02-fit-gate.keptBadgeAria` | Visually hidden before each fit badge | Sample fit score | The badge is a neutral outline, never lime (A17) |
| `entry-02-fit-gate.keptMore` | After the cards | +{n} more in this sample | |
| `entry-02-fit-gate.runLine` | Caption inside the panel | Sample run · 48 synthetic postings · {skipped} skipped by your rules · {below} below your bar · {kept} kept · 0 sent from this page | 48 is the generator's fixed size [CD 10.4 P1]; "0 sent" is a page fact |
| `entry-02-fit-gate.caveat` | 14px, Sage 60 | This sample is synthetic. Your counts depend on your rules and on what employers post. | [CD 2.4] |
| `entry-02-fit-gate.footnoteReasons` | 14px, ships only when P1 passes | Hard-rule reasons are the product's own reason text, checked against its rule code. | [CD 5.3] |
| `entry-02-fit-gate.footnoteScores` | 14px, always | Scores and fit reasons in this sample were written by us to show the format. In the product, a model writes them from your confirmed profile. | [CD 5.3]; model scoring is [PRD core row 2] |
| `entry-02-fit-gate.liveRegion` | Polite live region, debounced 500ms | {ruleName} rule {on or off}. {n} postings skipped for {ruleShort}. {passed} pass all rules. | Example: Sponsorship rule on. 12 postings skipped for sponsorship. 9 pass all rules. |
| `entry-02-fit-gate.liveRegionBar` | After a fit bar change | Fit bar {value}. {kept} of {passed} sample postings kept. | Same text as `aria-valuetext` |

---

## 8. `entry-03-truth-lock`: truth lock

Lime in this viewport: none in page; `navbar.startFree` is LIME. The demo sits under SAMPLE and the dashed edge.

| Key | Element | Copy | Count | Source and notes |
| --- | --- | --- | --- | --- |
| `entry-03-truth-lock.number` | Entry number | 03 | | |
| `entry-03-truth-lock.eyebrow` | Caption | Truth lock | 10 | |
| `entry-03-truth-lock.h2` | H2 | Resumes that cannot make things up. | 35 | [facts 5.3 KEEP] |
| `entry-03-truth-lock.h2Alt` | Alternate H2 | Every tailored line cites a fact you confirmed. | 47 | [PRD core row 3] |
| `entry-03-truth-lock.body` | Body | You paste your resume once. Kairos splits it into facts, and you confirm or remove each one. Every tailored line has to cite facts you confirmed. A line that cites nothing cannot be saved; the editor lists it so you can fix or remove it, and your own edits go through the same check. | 283 | Paste only [APP first-use step 1]; confirm or remove [APP steps 2 to 3]; 422 `truth_lock` and the editor listing [PRD AC6; APP Edit draft]. Replaces the undocumented "removed before you review" (facts 1.6) |
| `entry-03-truth-lock.detail` | Body | You see every change as a diff, line by line. | 46 | [facts 5.3 KEEP] |
| `entry-03-truth-lock.settles` | Settlement line | Settles 02. No fact, no line. | 29 | [CD 5.3] |

### 8.1 Demo: sample diff and facts

| Key | Element | Copy | Source and notes |
| --- | --- | --- | --- |
| `entry-03-truth-lock.diffTitle` | Panel heading | Sample diff · resume v3 | [SAMPLE] |
| `entry-03-truth-lock.diff[0]` | Removed line | Worked on backend features for the billing team. | [SAMPLE]; from facts 5.2, contains no number |
| `entry-03-truth-lock.diff[1]` | Added line | Wrote backend services in TypeScript for the billing team | [SAMPLE]; chip `cites #07, #12` |
| `entry-03-truth-lock.diff[2]` | Removed line | Helped with deployments. | [SAMPLE] |
| `entry-03-truth-lock.diff[3]` | Added line | Maintained the deployment scripts for the billing service, 2023 to 2024 | [SAMPLE]; chip `cites #11, #14` |
| `entry-03-truth-lock.removedAria` | Visually hidden prefix on removed lines | Removed: | Strikethrough never carries meaning alone |
| `entry-03-truth-lock.addedAria` | Prefix on added lines | Added: | |
| `entry-03-truth-lock.chipSingle` | Citation chip, one fact | cites fact #{id} | M4; accessible name "Cites fact number {id}" |
| `entry-03-truth-lock.chipMany` | Citation chip, several | cites #{id}, #{id} | Accessible name "Cites facts number {id} and {id}" |
| `entry-03-truth-lock.factsTitle` | Facts column heading | Confirmed facts (sample) | |
| `entry-03-truth-lock.facts` | Four fact buttons | #07 · Role · sample / #11 · Dates · sample / #12 · Tool · sample / #14 · Tool · sample | [SAMPLE]; typed by kind only [CD 5.3] |
| `entry-03-truth-lock.factUsedBy` | Polite live region on fact focus | Fact #{id} is used by {n} lines. | |
| `entry-03-truth-lock.lineUses` | `aria-describedby` text on each added line | Cites facts {list}. | Example: Cites facts #07 and #12. |
| `entry-03-truth-lock.traceHint` | 14px below the diff, pointer devices | Hover or focus a line to see which facts it cites. | |
| `entry-03-truth-lock.traceHintTouch` | Same slot, coarse pointer | Tap a line to see which facts it cites. Tap again to clear. | [CD 9.1] |

### 8.2 Try adding a line (sample)

| Key | Element | Copy | Source and notes |
| --- | --- | --- | --- |
| `entry-03-truth-lock.tryLegend` | `<fieldset><legend>` | Try adding a line (sample) | |
| `entry-03-truth-lock.preset[0]` | Radio 1, with chip `cites fact #07` | Built REST services in TypeScript for an internal billing tool | [SAMPLE]; [CD 5.3] |
| `entry-03-truth-lock.preset[1]` | Radio 2, no chip | Led a team of 6 engineers | [SAMPLE]; the "6" is inside the refused line and never saved; it is a sample string under the dashed edge |
| `entry-03-truth-lock.addButton` | Default button | Add line | Verb plus object |
| `entry-03-truth-lock.resultSaved` | Inline `--good` text after preset 1 | Saved. Cites fact #07. | Status word first |
| `entry-03-truth-lock.resultRefused` | Inline `--bad` text, `role="alert"`, after preset 2 | Not saved. This line cites no confirmed fact. | Mirrors the 422 `truth_lock` behaviour [PRD AC6] |
| `entry-03-truth-lock.refusedLineAria` | `aria-label` on the split line while its letters fall | Led a team of 6 engineers. Not saved. | Full text kept for assistive technology [CD 5.3] |
| `entry-03-truth-lock.demoNote` | 14px beside the control | In the product, every tailored line carries the ids of the facts it uses. A save with a line that cites nothing is refused, and the editor lists that line. This demo shows the rule with two fixed examples; it does not judge your writing. | [CD 5.3] |

---

## 9. `entry-04-approve`: review and approve

Lime in this viewport: `entry-04-approve.approveButton` (priority 1). The navbar button is Default while any pixel of it is visible. After approval the button becomes Default and custody returns to the navbar.

| Key | Element | Copy | Count | Lime | Source and notes |
| --- | --- | --- | --- | --- | --- |
| `entry-04-approve.number` | Entry number | 04 | | | |
| `entry-04-approve.eyebrow` | Caption | Review and approve | 18 | | |
| `entry-04-approve.h2` | H2 | Edit anything. Then approve one or a batch. | 43 | | [PRD core, review and edit queue] |
| `entry-04-approve.h2Alt` | Alternate H2 | Nothing is sent until you approve it. | 37 | | [PRD one-line idea] |
| `entry-04-approve.body` | Body | Each application shows its resume diff, every answer and why it matched. Edit anything, then approve one or a batch. Nothing is sent until you approve it, and you can withdraw a draft or an approved application before it is sent. | 230 | | Queue contents and batch approval [facts 5.5 HIW step 03 KEEP]; withdraw before send [APP alternate journeys] |
| `entry-04-approve.panelTitle` | Demo heading | Sample draft · Software Engineer, Platform · Company 014 | | | [SAMPLE] |
| `entry-04-approve.rowDiff` | Row | Resume diff · 4 lines · each cites a fact | | | [SAMPLE] count; rule [PRD AC6] |
| `entry-04-approve.rowAnswers` | Row | 7 answers ready · 0 guessed | | | [SAMPLE] counts; the "0 guessed" idea is kept from facts 5.2 |
| `entry-04-approve.rowWhy` | Row | Why it matched · 3 reasons, written from the sample profile | | | [SAMPLE] |
| `entry-04-approve.editButton` | Outlined button | Edit | | | `aria-expanded`; expands one sample answer |
| `entry-04-approve.editLabel` | `<label>` for the text input | Earliest start date (sample answer) | | | [CD 5.3] |
| `entry-04-approve.editValue` | Default input value | Two weeks after an offer | | | [SAMPLE] |
| `entry-04-approve.editSave` | Default button | Save answer | | | Updates the row, prints nothing [CD 5.3] |
| `entry-04-approve.editSaved` | Polite live region | Answer saved in the sample draft. | | | |
| `entry-04-approve.approveButton` | Button, 48px | Approve sample draft | 20 | LIME | `data-lime-candidate="approve"` |
| `entry-04-approve.approveNote` | 14px beside the button | Demo. Nothing is sent from this page. | 37 | | [CD 5.3] |
| `entry-04-approve.kairosLine` | Body, Moss 70, under the button | Kairos is Greek for the right moment. You choose it. | 52 | | One of the four kairos placements [CD 3.4] |
| `entry-04-approve.approvedButton` | The same button after the press, `aria-disabled="true"` | Approved · sample | | | Default style, 50% opacity, focus stays on it |
| `entry-04-approve.approvedInline` | Inline `--good` text | Approved by you at {approvedTime}. | | | Time read in the click handler [CD 2.3] |
| `entry-04-approve.approvedLive` | Polite live region | Approved. Sample receipt updated. | | | |
| `entry-04-approve.settles` | Settlement line | Settles 03. Review means edit, then approve. | 44 | | [CD 5.3] |

---

## 10. `entry-05-send-receipt`: send and receipt (the Mint Frost band)

Lime in this viewport: none. Lime never appears on the Mint Frost band [CD 3.3]; the ghost receipt's Approve is outlined on mint, and the navbar button is LIME from stage progress 0.56 onward.

Gate G3 applies to the Chrome extension, the cloud applier, review mode, the receipt contents and the offer pause. Until each is confirmed live, the string in the "Gated variant" column ships instead.

### 10.1 Stage and receipt

| Key | Element | Copy | Count | Source and notes |
| --- | --- | --- | --- | --- |
| `entry-05-send-receipt.number` | Entry number | 05 | | |
| `entry-05-send-receipt.eyebrow` | Caption | Send and receipt | 16 | |
| `entry-05-send-receipt.h2` | H2, on Void then re-entering on mint | Sent through the employer's own form. Then a receipt. | 53 | Form [PRD core, Chrome extension apply]; receipt [PRD user story 7] |
| `entry-05-send-receipt.h2Alt` | Alternate H2 | Every submitted application leaves a receipt. | 45 | |
| `entry-05-send-receipt.receiptCaption` | `<table><caption>` | Sample receipt. This is what Kairos saves after a real submission. Nothing was sent from this page. | 100 | [CD 5.3] |
| `entry-05-send-receipt.receiptHeader` | Pre-printed header row | KAIROS · RECEIPT · SAMPLE | | [CD 4.4] |
| `entry-05-send-receipt.rows[0]` | Form | The employer's own page on Greenhouse | | [PRD core row 1]; one of the three supported boards |
| `entry-05-send-receipt.rows[1]` | Fields sent | 14 · each shown to you first (sample count) | | [SAMPLE] count; "shown to you first" is the review queue [PRD core] |
| `entry-05-send-receipt.rows[2]` | Answers | 7 · approved by you · 0 guessed (sample count) | | [SAMPLE] |
| `entry-05-send-receipt.rows[3]` | Resume | Version 3 · every line cites a confirmed fact | | Chip `cites #07, #11` [SAMPLE]; rule [PRD AC6] |
| `entry-05-send-receipt.rows[4]` | Confirmation page | Saved | | Receipt contents [facts 1.1, L-PROOF point 3] |
| `entry-05-send-receipt.rows[5]` | Approved | {approvedAt} | | Falls back to the word "sample" when the visitor has not approved |
| `entry-05-send-receipt.rows[6]` | Credit | −1 credit · charged once | | One credit per `submitted` report, unique index [PRC Value metric]; charged once [PRD AC9] |
| `entry-05-send-receipt.slipAStatus` | Compact slip A status word | Failed | | Status word |
| `entry-05-send-receipt.slipALine` | Slip A line | Required field empty: work authorization · 0 credits | | [SAMPLE] field; empty required field stops submit [PRD AC11]; 0 credits [PRD AC10] |
| `entry-05-send-receipt.slipACaption` | Caption | Failed submits cost nothing. The reason is shown so you can fix it and send again. | 83 | [PRD AC10, verified end to end] |
| `entry-05-send-receipt.slipBStatus` | Compact slip B status word | Submitted | | |
| `entry-05-send-receipt.slipBLine` | Slip B line | Reported twice · charged once · −1 credit | | [PRD AC9, verified end to end] |
| `entry-05-send-receipt.slipBCaption` | Caption | If the extension reports one submission twice, you are charged once. | 70 | [PRD AC9] |
| `entry-05-send-receipt.ghostTitle` | Ghost receipt text (not approved) | No receipt yet. Nothing was sent. | 33 | [CD 4.6] |
| `entry-05-send-receipt.ghostBody` | Ghost receipt body | A receipt exists only after you approve and the application is submitted. Approve the sample to print one here. | 111 | [PRD AC10; APP `/applications/[id]`] |
| `entry-05-send-receipt.ghostApprove` | Outlined-on-mint button | Approve sample draft | | Same handler as entry 04; approves in place, no scroll [CD 4.6] |
| `entry-05-send-receipt.rowPrintedLive` | Polite live region after the in-place approval | Approved. Sample receipt printed. | | |

### 10.2 How it sends (normal flow on mint)

| Key | Element | Copy | Gated variant (G3) | Source |
| --- | --- | --- | --- | --- |
| `entry-05-send-receipt.sendLead` | Lead on mint | The extension fills the employer's own form in your browser and saves what it sent: each field, each answer, the resume version and the confirmation page. | The extension (in beta) fills the employer's own form in your browser and saves what it sent: each field, each answer, the resume version and the confirmation page. | [facts 5.3 L-PROOF point 3 KEEP] |
| `entry-05-send-receipt.cellExtensionTitle` | Paper cell 1 title | Chrome extension · every plan | Chrome extension (in beta) · every plan | [PRC Plans; plans.ts free.features[4]] |
| `entry-05-send-receipt.cellExtensionBody` | Cell 1 body | Runs in your browser, in your session. | same | [PRD core, Chrome extension apply] |
| `entry-05-send-receipt.cellCloudTitle` | Paper cell 2 title | Cloud applier · Pro and Max | Cloud applier (in beta) · Pro and Max | [PRC Plans; plans.ts pro.cloudApplier, max.cloudApplier] |
| `entry-05-send-receipt.cellCloudBody` | Cell 2 body | Sends approved applications while your laptop is closed. | same | [PRD core, cloud applier] |
| `entry-05-send-receipt.reviewMode` | Body | Prefer to press submit yourself? Review mode fills the form and stops, and you press the employer's submit button. | Prefer to press submit yourself? Review mode (in beta) fills the form and stops, and you press the employer's submit button. | [APP alternate journeys] |
| `entry-05-send-receipt.requiredFields` | Body | If a required field is empty, the extension does not press submit. It tells you how many fields need you. | same | [PRD AC11, unit test and live forms] |
| `entry-05-send-receipt.boards` | Body | Public career pages on Greenhouse, Lever and Ashby. We do not automate LinkedIn, because its user agreement bans bots. | same | [PRD core row 1; PRD out of scope] |
| `entry-05-send-receipt.settles` | None | | | Entry 05 settles no row; the settlement for row 05 is in entry 07 |

---

## 11. `entry-06-replies`: replies and the open row

Lime in this viewport: none in page; `navbar.startFree` is LIME. The inbox sits under SAMPLE and the dashed edge.

| Key | Element | Copy | Count | Gated variant (G3) | Source and notes |
| --- | --- | --- | --- | --- | --- |
| `entry-06-replies.number` | Entry number | 06 | | | |
| `entry-06-replies.eyebrow` | Caption | Replies | 7 | | |
| `entry-06-replies.h2` | H2 | Replies come to an address you control. | 39 | | [PRD core row 6] |
| `entry-06-replies.h2Alt` | Alternate H2 | Replies, tagged to the application they answer. | 47 | | |
| `entry-06-replies.body` | Body | You set one forwarding filter, and replies about your applications come to a private address we give you. No Gmail login, no Gmail access. Kairos tags each reply to the application it belongs to. | 194 | You set one forwarding filter, and replies about your applications come to a private address we give you. No Gmail login, no Gmail access. Reply tracking (in beta) tags each reply to the application it belongs to. | [facts 5.6 A5 KEEP; PRD core row 6 "No Gmail access needed"; PRD AC1 creates the forwarding address] |
| `entry-06-replies.body2` | Body, ships only if reply tracking and AC12 are confirmed | When a reply you forward is an offer, we pause your billing. | 59 | (omitted) | [PRD AC12; PRC Billing]. AC12 has no verification tag, so this is the only sentence that is dropped rather than labelled |
| `entry-06-replies.inboxTitle` | Demo heading | Sample inbox | | | |
| `entry-06-replies.inbox[0]` | Row | Reply · tagged to application 0233 | | | [SAMPLE] |
| `entry-06-replies.inbox[1]` | Row | Interview request · tagged to application 0233 | | | [SAMPLE]; the row shows a tag, never a rate |
| `entry-06-replies.inbox[2]` | Row | Offer · billing paused | | Offer · tagged to application 0233 | [SAMPLE]; the "billing paused" words ship only with `body2` |
| `entry-06-replies.inboxNote` | 14px under the inbox | Sample rows. Nothing here came from an employer. | 48 | | |
| `entry-06-replies.openRow` | Lead, Phosphor White, outlined posting square before it | Row 04 stays open. We cannot promise interviews, and we will not print a number we have not measured. We can show you every application, every skip and every reply. | 161 | | [CD 5.3]; no outcome data exists [facts 6.2] |
| `entry-06-replies.openRowSquareAria` | Visually hidden beside the outlined square | Open. | | | |

---

## 12. `entry-07-billing`: honest billing and pricing

Lime in this viewport: `entry-07-billing.plans.pro.cta` (priority 3). All other plan buttons are Default or outlined. The interval switch's active segment is Carbon Veil, never lime [CD 5.3].

Prices, taglines and feature strings are read from `shared/src/plans.ts` at build (P3). They are copied below so reviewers can read them in one place; if the file and this deck differ, the file wins and this deck is updated. Section 17 lists three strings in that file that conflict with the facts sheet and need a decision.

### 12.1 Copy

| Key | Element | Copy | Count | Source and notes |
| --- | --- | --- | --- | --- |
| `entry-07-billing.number` | Entry number | 07 | | |
| `entry-07-billing.eyebrow` | Caption | Pricing | 7 | [facts 5.7 KEEP] |
| `entry-07-billing.h2` | H2 | Pay for applications that went through. | 39 | [facts 5.7 KEEP] |
| `entry-07-billing.h2Alt` | Alternate H2 | One credit per submitted application. | 37 | [PRC Value metric] |
| `entry-07-billing.lead` | Lead | One credit per application that actually went through. Failed submits cost nothing. Pause any time, and we pause for you when an offer email arrives. Weekly plans for searches that end fast. | 190 | [facts 5.3 point 4 KEEP; PRD AC10; PRC Billing; PRC Weekly]. Claim chip `see 05` after "Failed submits cost nothing." (claim 2 of 6). The offer-pause clause is G3 gated: drop "and we pause for you when an offer email arrives" if reply tracking is not live |
| `entry-07-billing.leadGated` | Lead, G3 variant | One credit per application that actually went through. Failed submits cost nothing. Pause or cancel any time. Weekly plans for searches that end fast. | 150 | [PRC Billing] |
| `entry-07-billing.leadChip` | Claim chip | see 05 | | Accessible name: See entry 05, Send and receipt |
| `entry-07-billing.settles` | Settlement line | Settles 05. Every charge has a row, and you can read all of them. | 65 | [CD 5.3] |

### 12.2 Sample credit ledger

| Key | Element | Copy | Source |
| --- | --- | --- | --- |
| `entry-07-billing.ledgerCaption` | `<caption>` | Sample credit ledger. Every credit movement is one row you can read in the app. | [PRC Value metric, one ledger row per application; PRC Rollover, expiry rows the user can see] |
| `entry-07-billing.ledgerHeaders` | `<th>` | Date · Entry · Credits · Note | |
| `entry-07-billing.ledger[0]` | Row | sample · Free grant · +25 credits · never expires | [PRD AC1; PRC Rollover] |
| `entry-07-billing.ledger[1]` | Row | sample · Submitted · −1 credit · receipt kept | [PRC Value metric; PRD user story 7] |
| `entry-07-billing.ledger[2]` | Row | sample · Failed submit · 0 credits · reason shown, nothing charged | [PRD AC10] |
| `entry-07-billing.ledger[3]` | Row | sample · Duplicate report · 0 credits · charged once already | [PRD AC9] |

### 12.3 Interval switch and plan cards

| Key | Element | Copy | Lime | Source |
| --- | --- | --- | --- | --- |
| `entry-07-billing.intervalLegend` | Radio group legend | Billing interval | | |
| `entry-07-billing.intervals` | Radios | Weekly · Monthly · Quarterly | | [facts 5.7 KEEP]; default Monthly |
| `entry-07-billing.intervalLive` | Polite live region after a change | Showing {interval} prices. | | |
| `entry-07-billing.perCycleLabel` | Label under each allowance | submitted applications per 30 days | | [PRC Plans] |
| `entry-07-billing.perWeekLabel` | Weekly view | submitted applications per week | | Weekly grant `ceil(n × 7 / 30)` [PRC Weekly; PRD AC14] |
| `entry-07-billing.perQuarterLabel` | Quarterly view | submitted applications per quarter | | Three cycles at once [PRC Weekly] |
| `entry-07-billing.fullUseLabel` | Label on the per-application figure | per application at full use | | [ARITH] price ÷ allowance |

Plan cards, values at Monthly (Weekly and Quarterly values follow in 12.4):

| Key | Plan | Price | Allowance | Per application at full use | Tagline (from plans.ts) | Features (from plans.ts, verbatim) | CTA | Lime |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `entry-07-billing.plans.free` | Free | $0 [plans.ts free.priceUsd.month] | 25, once [plans.ts free.applicationsPerCycle] | (none shown) | Try it on 25 real applications. [plans.ts free.tagline] | 25 submitted applications, once · Fit gate with reasons on every match · Truth-locked resume tailoring · Edit everything before it sends · Chrome extension apply · Reply tracking by forwarding [plans.ts free.features] | Start free | Default |
| `entry-07-billing.plans.starter` | Starter | $19 [plans.ts starter.priceUsd.month] | 400 [plans.ts starter.applicationsPerCycle] | $0.048 [ARITH 19/400 = 0.0475; PRC Plans] | For a steady search at your own pace. [plans.ts starter.tagline] | 400 submitted applications per 30 days · Everything in Free · Tailored cover letters · Answer memory you approve · Failed submits cost nothing [plans.ts starter.features] | Choose Starter | Default |
| `entry-07-billing.plans.pro` | Pro | $39 [plans.ts pro.priceUsd.month] | 1,200 [plans.ts pro.applicationsPerCycle] | $0.033 [ARITH 39/1200 = 0.0325; PRC Plans] | Applies even when your laptop is closed. [plans.ts pro.tagline] | 1,200 submitted applications per 30 days · Everything in Starter · Cloud applier: sends approved applications with your browser closed · Weekly outcome report and targeting suggestions · 3 resume profiles [plans.ts pro.features] | Choose Pro | LIME |
| `entry-07-billing.plans.max` | Max | $79 [plans.ts max.priceUsd.month] | 3,000 [plans.ts max.applicationsPerCycle] | $0.026 [ARITH 79/3000 = 0.0263; PRC Plans] | For searches that cannot wait. [plans.ts max.tagline] | 3,000 submitted applications per 30 days · Everything in Pro · Priority polling: new postings checked every 5 minutes · 10 resume profiles · Priority support [plans.ts max.features] | Choose Max | Default |

| Key | Element | Copy | Source |
| --- | --- | --- | --- |
| `entry-07-billing.proTag` | Neutral outlined tag on the Pro card (replaces "Most chosen") | Sends with your laptop closed | [PRC Upgrade triggers; A17: no usage badge because there are no customers yet] |
| `entry-07-billing.planCtaAria` | Accessible name template for plan buttons | {cta}, {price} {intervalWord} | Example: Choose Pro, $39 a month |
| `entry-07-billing.intervalWords` | Interval words for the template | a week · a month · a quarter | |
| `entry-07-billing.resumeProfiles` | Row on each card | {n} resume profile(s) | 1, 1, 3, 10 [plans.ts {id}.resumeProfiles] |

### 12.4 Prices by interval (from plans.ts, cross-checked with PRC)

| Plan | Weekly | Weekly credits | Weekly per application at full use | Quarterly | Quarterly credits | Quarterly per application at full use |
| --- | --- | --- | --- | --- | --- | --- |
| Starter | $6 [plans.ts starter.priceUsd.week] | 94 [PRC Weekly; PRD AC14] | $0.064 [ARITH 6/94 = 0.0638] | $45 [plans.ts starter.priceUsd.quarter] | 1,200 [PRC Weekly] | $0.038 [ARITH 45/1200 = 0.0375] |
| Pro | $12 [plans.ts pro.priceUsd.week] | 280 [PRC Weekly] | $0.043 [ARITH 12/280 = 0.0429] | $95 [plans.ts pro.priceUsd.quarter] | 3,600 [PRC Weekly] | $0.026 [ARITH 95/3600 = 0.0264] |
| Max | $25 [plans.ts max.priceUsd.week] | 700 [PRC Weekly] | $0.036 [ARITH 25/700 = 0.0357] | $189 [plans.ts max.priceUsd.quarter] | 9,000 [PRC Weekly] | $0.021 [ARITH 189/9000 = 0.021] |

Free shows "n/a" for Weekly and Quarterly because `priceUsd.week` and `priceUsd.quarter` are `null` [plans.ts free.priceUsd]. The card reads "Monthly only" in that slot.

### 12.5 Receipt calculator

| Key | Element | Copy | Source and notes |
| --- | --- | --- | --- |
| `entry-07-billing.calcTitle` | Heading | Your receipt for one cycle | |
| `entry-07-billing.calcIntro` | Body | Pick a plan and enter how many applications you expect to submit. The receipt shows what one cycle would cost and the price per submitted application at your number. | [CD 9.3] |
| `entry-07-billing.calcPlanLabel` | `<label>` for `<select>` | Plan | Options Starter · Pro · Max; default Pro |
| `entry-07-billing.calcIntervalNote` | 14px | Uses the billing interval selected above. | Shares the switch [CD 9.3] |
| `entry-07-billing.calcSubmittedLabel` | `<label>` for range plus number | Submitted this cycle | 0 to the plan's credits; default half |
| `entry-07-billing.calcSubmittedValueText` | `aria-valuetext` | {n} submitted applications | |
| `entry-07-billing.calcFailedLabel` | `<label>` for number | Failed this cycle | 0 to 99; default 3 |
| `entry-07-billing.calcFailedHelp` | Help text | Failed submits are shown here so you can see that they cost $0.00. | [PRD AC10] |
| `entry-07-billing.calcRows[0]` | Output row | Plan charge · {price} | Example $39.00 [plans.ts pro.priceUsd.month] |
| `entry-07-billing.calcRows[1]` | Output row | Credits included · {credits} | Example 1,200 [plans.ts pro.applicationsPerCycle] |
| `entry-07-billing.calcRows[2]` | Output row | Submitted × 1 credit · {n} credits | [PRC Value metric] |
| `entry-07-billing.calcRows[3]` | Output row | Failed × 0 credits · $0.00 | Always $0.00 [PRD AC10] |
| `entry-07-billing.calcRows[4]` | Output row | Credits remaining · {remaining} | Included minus submitted |
| `entry-07-billing.calcRows[5]` | Output row, `--type-numeral-landing` | Price per submitted application at your number · {perApp} | `Math.round(priceCents × 10 / submitted) / 1000` [CD 9.3]. Example at Pro, Monthly, 600 submitted: $0.065 [ARITH 3900 × 10 / 600 = 65 → 0.065] |
| `entry-07-billing.calcRows[6]` | Output row | Price per application at full use · {fullUse} | From the table in 12.3 and 12.4 |
| `entry-07-billing.calcZero` | Replaces row 5 when submitted is 0 | No submitted applications. You still pay the plan price. | [CD 9.3] |
| `entry-07-billing.calcLive` | Polite live region, 500ms after input stops | {plan}, {interval}. {n} submitted. {perApp} per submitted application. Plan charge {price}. | |
| `entry-07-billing.honesty` | Body under the calculator | The more of your credits you use, the lower the price per application. If you use few, it is higher. The calculator shows both. | [CD 5.3] |

### 12.6 Notes

| Key | Element | Copy | Source |
| --- | --- | --- | --- |
| `entry-07-billing.noteLaunch` | Body | Launch prices. They may change for new customers. Existing subscribers keep their price for at least 90 days after any change, with 30 days' notice. | [PRC Bottom line; PRC Price research] |
| `entry-07-billing.noteStripe` | Body | Billing is in US dollars through Stripe. Cancel any time from the Stripe customer portal; access runs to the end of the paid period. | [PRC Billing] |
| `entry-07-billing.noteRollover` | Help text (not a headline) | Unused paid credits roll over while you subscribe, up to two invoices' worth. The free credits never expire. | [PRC Rollover]; caps stay out of the copy per facts 1.3 |
| `entry-07-billing.noteIndia` | Body, shown to every visitor | Prices are in US dollars for every country. Regional pricing for India is not in this version. | [PRC Billing]; addresses the India segment without promising INR [facts 3.1, 6.1] |

---

## 13. `entry-08-compare`: compared with typical auto-apply

Lime in this viewport: none in page; `navbar.startFree` is LIME.

| Key | Element | Copy | Count | Source and notes |
| --- | --- | --- | --- | --- |
| `entry-08-compare.number` | Entry number | 08 | | |
| `entry-08-compare.eyebrow` | Caption | Side by side | 12 | [facts 5.4 KEEP] |
| `entry-08-compare.h2` | H2 | How it compares with typical auto-apply. | 40 | [facts 5.4 KEEP] |
| `entry-08-compare.h2Alt` | Alternate H2 | What people report, and what Kairos does instead. | 49 | |
| `entry-08-compare.caption` | `<table><caption>` | Left column: problems people report about auto-apply tools in general. We do not name products, and we do not compare prices here. | 131 | [CD 5.3]; competitor prices are internal only [facts 1.5] |
| `entry-08-compare.headers` | `<th scope="col">` | Topic · What people report · Kairos | | |
| `entry-08-compare.mobileLabels` | Caption labels above stacked cells below 768px | People report · Kairos | | [CD 5.3] |
| `entry-08-compare.rows[0]` | Which jobs get applications | Matches that do not fit · Only jobs that pass your hard rules and fit bar, with a written reason for each skip | | [PRD problem 1; fit.ts]. Chip `see 02` (claim 5 of 6), accessible name "See entry 02, Fit gate" |
| `entry-08-compare.rows[1]` | Resume changes | Skills and metrics the person does not have · Each line cites a fact you confirmed | | [PRD problem 3; PRD AC6]. Chip `see 03` (claim 6 of 6), accessible name "See entry 03, Truth lock" |
| `entry-08-compare.rows[2]` | Before it sends | A review step without an edit step · Edit every field and line, then approve one or a batch | | [PRD problem 2; PRD core review queue] |
| `entry-08-compare.rows[3]` | Replies | Broad Gmail access · A forwarding address you control. No Gmail access | | [PRD problem 5; PRD core row 6] |
| `entry-08-compare.rows[4]` | What you pay for | Charges after cancelling, and lost credits · One credit per submitted application. Failed submits cost nothing. Cancel from the Stripe portal any time | | [PRD problem 6 narrowed; PRC Value metric; PRD AC10; PRC Billing] |

---

## 14. `entry-09-questions`: questions

Lime in this viewport: none in page; `navbar.startFree` is LIME. The same six pairs feed the `FAQPage` JSON-LD (`meta.faqJsonLd`).

| Key | Element | Copy | Count | Source and notes |
| --- | --- | --- | --- | --- |
| `entry-09-questions.number` | Entry number | 09 | | |
| `entry-09-questions.eyebrow` | Caption | Questions | 9 | [facts 5.6 KEEP] |
| `entry-09-questions.h2` | H2 | What people ask before signing up. | 34 | [facts 5.6 KEEP] |
| `entry-09-questions.h2Alt` | Alternate H2 | Six questions, answered plainly. | 32 | |
| `entry-09-questions.faq[0].q` | Question | Which job sites does it apply on? | 33 | [facts 5.6 KEEP] |
| `entry-09-questions.faq[0].a` | Answer | Employer career pages on Greenhouse, Lever and Ashby. We do not automate LinkedIn, because its user agreement bans bots and it puts your account at risk. | 151 | [facts 5.6 KEEP; PRD core row 1; PRD out of scope] |
| `entry-09-questions.faq[1].q` | Question | Will recruiters know I used it? | 31 | [facts 5.6 KEEP] |
| `entry-09-questions.faq[1].a` | Answer, set in Phosphor White | The application is submitted through the employer's own form with your details and answers you approved. We do not promise it is undetectable; we make sure it is something you would have sent yourself. | 198 | [facts 5.6 KEEP, the strongest honesty line]; no undetectability claim [facts 6.2] |
| `entry-09-questions.faq[2].q` | Question | Does it invent experience to match a job? | 41 | [facts 5.6 KEEP] |
| `entry-09-questions.faq[2].a` | Answer | No. Tailored lines must cite facts from your confirmed profile. A line that cites nothing cannot be saved; the editor lists it so you can fix or remove it. | 154 | [PRD AC6; APP Edit draft]; replaces "removed before you review" (facts 1.6). Chip `see 03` (claim 3 of 6) |
| `entry-09-questions.faq[3].q` | Question | What if a submission fails? | 27 | [facts 5.6 KEEP] |
| `entry-09-questions.faq[3].a` | Answer | You keep the credit. The application shows why it failed so you can fix it and send again. | 90 | [facts 5.6 KEEP; PRD AC10]. Chip `see 05` (claim 4 of 6) |
| `entry-09-questions.faq[4].q` | Question | Do you need my Gmail password or access? | 40 | [facts 5.6 KEEP] |
| `entry-09-questions.faq[4].a` | Answer | No. You set one forwarding filter, and replies about your applications come to a private address we give you. | 110 | [facts 5.6 KEEP; PRD core row 6] |
| `entry-09-questions.faq[5].q` | Question | Can I upload my resume? | 23 | [CD 5.3] |
| `entry-09-questions.faq[5].a` | Answer | Version 1 takes pasted text. | 28 | [APP first-use step 1: paste only; PDF and DOCX upload are in the implementation plan, not promised here] |
| `entry-09-questions.summaryAriaOpen` | Visually hidden suffix on an open `<summary>` | , expanded | Native `<details>` already exposes state; this is a fallback for older assistive technology and may be dropped if testing shows duplication |

---

## 15. `entry-10-start`: start

Lime in this viewport: `entry-10-start.cta` (priority 4). The navbar button is Default while it is visible.

| Key | Element | Copy | Count | Lime | Source and notes |
| --- | --- | --- | --- | --- | --- |
| `entry-10-start.number` | Entry number | 10 | | | |
| `entry-10-start.eyebrow` | Caption | Start | 5 | | |
| `entry-10-start.h2` | H2 | Try it on 25 real applications. | 31 | | [facts 5.7 KEEP; plans.ts free.tagline]; 25 [PRD AC1] |
| `entry-10-start.h2Alt` | Alternate H2 | Your first 25 applications are free. | 36 | | [PRD AC1] |
| `entry-10-start.body` | Body, default | Every application waits for your approval. | 42 | | [PRD one-line idea]; "No card" omitted (G4) |
| `entry-10-start.bodyApproved` | Body, replaces the default after the sample approval | You approved the sample at {approvedTime}. Every real application waits for you the same way. | | | [CD 5.3]; time from the store |
| `entry-10-start.cta` | Button, 48px pill | Start free | 10 | LIME | `data-lime-candidate="closing"`; links to `/sign-up` |
| `entry-10-start.microcopy` | 14px, Sage 60 | 25 submitted applications, free, once. The free credits never expire. | 70 | | [plans.ts free.features[0]; PRC Rollover] |
| `entry-10-start.laneCaption` | 14px under the fresh slip | A new slip. The first row of your own ledger. | 45 | | [PRD AC1 posts the +25 row at sign-up] |

---

## 16. `footer`: colophon and page receipt

Lime in this viewport: none in page; `navbar.startFree` is LIME.

| Key | Element | Copy | Source and notes |
| --- | --- | --- | --- |
| `footer.receiptCaption` | `<table><caption>` of the page receipt | Receipt for this page | |
| `footer.receipt[0]` | Row | Claims on this page · {N} · each links to where the page shows it | N from `web/content/claims.ts` at build; enforced by the claims-register test [CD 10.5] |
| `footer.receipt[1]` | Row | Sample data · labelled on every demo | [CD 2.4] |
| `footer.receipt[2]` | Row | Testimonials, logos, user counts · none | [facts 6.2] |
| `footer.receipt[3]` | Row | Prices · read from the plan file the app bills from | [plans.ts header comment; P3] |
| `footer.receipt[4]` | Row, ships only when P1 passes | Reason text · checked against the product's rule code | [CD 10.4 P1] |
| `footer.receipt[5]` | Row | Built · {BUILD_DATE} | Injected at build [CD 5.4] |
| `footer.clockLine` | Caption, `aria-hidden="true"`, uppercase | CHRONOS {HH:MM} YOUR TIME · KAIROS WHEN YOU APPROVE | Server renders "KAIROS WHEN YOU APPROVE" alone; the effect prepends the clock [CD 3.4] |
| `footer.clockLineServer` | Server-rendered text of the same element | KAIROS WHEN YOU APPROVE | Avoids a hydration mismatch |
| `footer.kairosDefinition` | Deep Fern, decorative | kairos (Greek): the right moment, as distinct from chronos, clock time. | [CD 3.4] |
| `footer.motionLegend` | `<fieldset><legend>` | Motion | [CD 9.2] |
| `footer.motionOptions` | Radios | Full · Reduced | |
| `footer.motionHelp` | Help text | Reduced turns off the receipt animation and the scroll effects. The page says the same things either way. | [CD 9.2: reduced motion changes how things move, never what the page says] |
| `footer.motionLive` | Polite live region after a change | Motion set to {Full or Reduced}. | |
| `footer.groups` | Link group titles and links | Product: How it works · Pricing · Blog / Company: About · Careers · Contact / Legal: Terms · Privacy · Cookies · Refunds | [SITE footer], verbatim, hrefs from config |
| `footer.contactLabel` | Caption before the email link | Contact | |
| `footer.contactEmail` | Link text and `mailto:` | `{siteConfig.supportEmail}` | [SITE supportEmail]; never typed as a literal (PRD open question 1) |
| `footer.company` | Small text | Kairos by Gray Matter Labs | [SITE name, company] |
| `footer.copyright` | Small text | © {BUILD_YEAR} Gray Matter Labs | Year from `{BUILD_DATE}` |
| `footer.legalNote` | Small text, Sage 60 | Legal pages are being reviewed and will be updated before launch. | PRD open question 5; states the status plainly instead of promising terms. Drop when G8 passes |

---

## 17. WebGL scene: text alternative and every printed line

The canvas is `aria-hidden="true"`. The lane's `<aside aria-label="Sample receipt">` carries `entry-00-hero.laneAsideIntro` (section 5) and then an `<ol>` built from the same array that drives the print texture, so what a screen reader hears is exactly what is printed [CD 4.8]. Lines are appended as the `ledgerStore` posts entries and are never removed (append-only, CD 4.5). Prints are not announced; the list updates silently.

| Key | Line (exact string) | When it is appended | Source |
| --- | --- | --- | --- |
| `scene.lines.header` | KAIROS · RECEIPT · SAMPLE | Pre-printed | [CD 4.4] |
| `scene.lines.00` | 00 · Ledger opened | Pre-printed | [CD 4.4] |
| `scene.lines.feedRow` | SKIP · {id} · {first reason} or PASS · {id} · goes to scoring | 48 rows at `slip-feed`, from `fit-sample.json`; the `<ol>` groups them under one item reading "Sample run: 48 postings, {skipped} skipped, {passed} passed" so a screen reader is not given 48 items | [CD 4.4]; reason strings [fit.ts L42 to L73] |
| `scene.lines.02` | 02 · Fit gate · hard rules first · every skip has a reason | 200ms after the feed | [CD 4.4] |
| `scene.lines.rulesChanged` | RULES CHANGED · SAMPLE RE-CHECKED | Debounced 800ms after a control change | [CD 4.4] |
| `scene.lines.03` | 03 · Resume v3 · every line cites a confirmed fact | `slip-cite` at local progress 0.20 | [CD 4.4] |
| `scene.lines.04approved` | 04 · Approved by you · {approvedAt} | Approve click handler, inside the signature box | [CD 4.4] |
| `scene.lines.04awaiting` | 04 · Awaiting your approval | `slip-hold` at local progress 0.85 if not approved, once | [CD 4.4] |
| `scene.lines.05approved` | 05 · Submitted · employer form · fields saved | Pinned stage progress 0.05, approved | [CD 4.4] |
| `scene.lines.05notApproved` | 05 · Not sent · waiting for your approval | Pinned stage progress 0.05, not approved | [CD 4.4] |
| `scene.lines.filedHeader` | KAIROS · RECEIPT · SAMPLE | Fresh paper after the tear | [CD 4.4] |
| `scene.lines.05filed` | 05 · Receipt filed | Fresh paper after the tear | [CD 4.4] |
| `scene.lines.06` | 06 · Reply tagged to its application | `slip-reply` at local progress 0.20 | [CD 4.4] |
| `scene.lines.10header` | KAIROS · AT SIGN-UP | `slip-fresh`, new slip | [CD 4.4] |
| `scene.lines.10` | +25 credits · free grant · never expires | `slip-fresh` at local progress 0.20 | [PRD AC1; PRC Rollover] |

Tier 0 (poster and visible DOM receipt list): the same `<ol>` is the visible receipt in the lane, on mint paper, with the header above it [CD 4.8]. Its visible heading is `entry-00-hero.laneAsideAria` ("Sample receipt").

Image alt text summary:

| Image | `alt` | Why |
| --- | --- | --- |
| Hero poster (`slip-open` still) | (empty) | Decorative duplicate of the aside's text (section 5) |
| Open Graph image | `meta.ogImageAlt` | Social cards have no aside |
| Logo mark | (empty); the link carries `navbar.logoAria` | The link name is the accessible name |
| No other images exist on the landing | | A8 forbids mockups; demos are DOM |

---

## 18. Shared state strings and live regions

| Key | Where | Copy | Notes |
| --- | --- | --- | --- |
| `shared.sampleChip` | Every demo surface | SAMPLE | Accessible name "Sample data" |
| `shared.claimChipName` | Every `see NN` chip | See entry {NN}, {title} | Titles from `ledger-rail.entries` |
| `shared.postedAria` | Beside every filled posting square | Posted. | Also "Settled." in entry 01 and "Kept." on kept cards |
| `shared.pendingAria` | Beside every outlined posting square | Pending. | |
| `shared.limeOwnerAria` | None | | Lime is visual only; the accessible name of a button never changes with custody |
| `shared.odometerLive` | After any odometer settles | {label} {value}. | One announcement, after the roll [CD 8.2] |
| `shared.dialogClose` | Every native dialog | Close | |
| `shared.externalLinkSuffix` | Visually hidden on any link that leaves the site | , opens in the same tab | The landing opens no new tabs; this key exists so no component invents one |

---

## 19. Headline widths and line breaks

Assumptions are in 0.4. "Lines" is the expected count with `text-wrap: balance`; "Break" is where the balanced break is expected to fall. A reviewer checks each in the browser at 1440, 1024 and 390px during the legibility sign-off (CD 10.5).

| Key | Headline | Chars | 1440px (lines, break) | 1024px | 390px | Widow risk |
| --- | --- | --- | --- | --- | --- | --- |
| `entry-00-hero.h1` | Job applications you would sign. | 32 | 2: Job applications / you would sign. | 2: same | 3: Job / applications / you would sign. | Borderline on phones: "Job applications" is 16 chars against a 16-char measure. If the browser breaks it as "Job applications / you would / sign.", the fix is to lower the clamp minimum from 3rem to 2.75rem below 420px (44px type, about 17.7 chars per line), which yields 2 lines. Decide in `02-design-system.md` |
| `entry-00-hero.h1Alt` | Applications you approve first. | 31 | 2: Applications you / approve first. | 2 | 2: Applications / you approve first. | None |
| `entry-01-reported.h2` | Five things people report about auto-apply tools. | 49 | 2: Five things people report / about auto-apply tools. | 2 | 3: Five things people / report about / auto-apply tools. | None |
| `entry-02-fit-gate.h2` | A fit gate before anything else. | 32 | 2: A fit gate before / anything else. | 2 | 2: A fit gate before / anything else. | None |
| `entry-03-truth-lock.h2` | Resumes that cannot make things up. | 35 | 2: Resumes that cannot / make things up. | 2 | 2: Resumes that cannot / make things up. | None |
| `entry-04-approve.h2` | Edit anything. Then approve one or a batch. | 43 | 2: Edit anything. Then approve / one or a batch. | 2 | 3: Edit anything. Then / approve one / or a batch. | None; last line is three words |
| `entry-05-send-receipt.h2` | Sent through the employer's own form. Then a receipt. | 53 | 2: Sent through the employer's / own form. Then a receipt. | 2 | 3: Sent through the / employer's own form. / Then a receipt. | None |
| `entry-06-replies.h2` | Replies come to an address you control. | 39 | 2: Replies come to an / address you control. | 2 | 2: Replies come to an / address you control. | None |
| `entry-07-billing.h2` | Pay for applications that went through. | 39 | 2: Pay for applications / that went through. | 2 | 2: Pay for applications / that went through. | None |
| `entry-08-compare.h2` | How it compares with typical auto-apply. | 40 | 2: How it compares with / typical auto-apply. | 2 | 2: How it compares with / typical auto-apply. | None |
| `entry-09-questions.h2` | What people ask before signing up. | 34 | 2: What people ask / before signing up. | 2 | 2: What people ask / before signing up. | None |
| `entry-10-start.h2` | Try it on 25 real applications. | 31 | 2: Try it on 25 / real applications. | 2 | 2: Try it on 25 / real applications. | None |

Rule for any future headline: keep H2s at 55 characters or fewer and the H1 at 34 or fewer, end with a full stop, and never let the last balanced line be one word of five characters or fewer.

---

## 20. Lime ownership by viewport (summary)

| Viewport filled by | Lime element | Everything else |
| --- | --- | --- |
| Hero (00) | `entry-00-hero.ctaPrimary` | Navbar Start free is Default |
| 01, 02, 03 | `navbar.startFree` | No in-page lime |
| 04 (until approved) | `entry-04-approve.approveButton` | Navbar Default |
| 04 (after approval) | `navbar.startFree` | Approve button is Default at 50% |
| 05 | `navbar.startFree` from stage progress 0.56 | Ghost Approve is outlined on mint; lime never on mint |
| 06 | `navbar.startFree` | |
| 07 | `entry-07-billing.plans.pro.cta` | Other plan CTAs Default; interval switch Carbon Veil |
| 08, 09 | `navbar.startFree` | |
| 10 | `entry-10-start.cta` | Navbar Default |
| Footer | `navbar.startFree` | |

---

## 21. Copy lint (what CI greps for in `web/content/landing-copy.ts`)

| Check | Fails on |
| --- | --- |
| Dashes | U+2014, U+2013 anywhere |
| Hype | revolutionary, seamless, effortless, supercharge, unlock, dream job, best, #1, game-changing, magic, AI-powered, 10x, guaranteed, undetectable (outside `entry-09-questions.faq[1].a`, where it is negated) |
| Gate G4 | the string "No card" |
| Competitors | Tsenta, LoopCV, Jobright, AIApply, Massive, Sprout, Scoutify, Simplify, Teal |
| Outcomes | interview rate, callback rate, "% of", "users have", "trusted by" |
| Urgency | don't miss, last chance, before it's too late, limited time |
| Boards not supported | Workday, iCIMS, LinkedIn (outside the two sentences that say it is not automated) |
| Samples | Any `fit {n}` or `Company {nnn}` string outside a component that renders the SAMPLE chip |

---

## 22. Open questions for the owners

1. `shared/src/plans.ts` `starter.features[4]` reads "Failed submits refunded automatically". The facts sheet says failed submits are never charged [PRD AC10], so there is nothing to refund, and refund wording awaits legal review (PRD open question 5). Proposed replacement in the file: "Failed submits cost nothing". Until changed, the card shows the file's string (P3).
2. `shared/src/plans.ts` `max.features[2]` reads "Priority polling: new postings checked every few minutes". PRC and the PRD say 5 minutes on Max. Proposed replacement: "Priority polling: new postings checked every 5 minutes". The landing never states polling speed elsewhere (facts 6.2 forbids presenting it as measured), so the card line should either carry the documented spec or drop the number.
3. `shared/src/plans.ts` `max.tagline` reads "For urgent searches: OPT clocks, layoffs." The direction says the page never adds a second clock to an audience already racing one [CD 1.4]. Proposed replacement: "For searches that cannot wait." Product owner to decide; the file is shared with `/pricing`.
4. `plans.ts free.features` lists "Chrome extension apply" and "Reply tracking by forwarding", and `pro.features` lists "Weekly outcome report and targeting suggestions". All three are G3 or P1 items whose build status is not stated. The "(in beta)" fallback in this deck covers entries 05 and 06 but cannot edit plan feature strings; the owner should add "(in beta)" in the file or confirm the status.
5. Gate G4 ("No card"): if confirmed, add "No card." as the first sentence of `entry-00-hero.microcopy` and of `entry-10-start.body`, and remove the lint rule.
6. Hero H1 on a 390px phone: see section 19. The design system owner decides between a 2.75rem clamp minimum below 420px and accepting three balanced lines.
7. `footer.legalNote` should be removed once G8 passes; until then it states the review status rather than implying finished terms.
8. `entry-09-questions.summaryAriaOpen` may double-announce on modern screen readers; drop it if the NVDA and VoiceOver passes (CD 10.5) show duplication.
