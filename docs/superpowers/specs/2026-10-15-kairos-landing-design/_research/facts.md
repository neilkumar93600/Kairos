# Kairos landing page: content facts sheet

Date: 2026-10-15. Repo root: `C:\Users\Lenovo\Downloads\auto-career`. All source paths below are relative to the repo root.

Source keys used in this sheet:

| Key | File |
| --- | --- |
| PRD | `docs/01-prd.md` (last updated 2026-10-13) |
| APP | `docs/03-app-flow.md` (last updated 2026-10-13) |
| PRC | `docs/pricing.md` (last updated 2026-10-13) |
| BRIEF | `docs/04-ui-ux-brief.md` (last updated 2026-10-15) |
| SITE | `web/lib/site.ts` |
| HIW | `web/components/shared/how-it-works-steps.tsx` |
| PLANS-UI | `web/components/shared/pricing-plans.tsx` |
| CTA | `web/components/shared/cta-band.tsx` |
| FAQ-UI | `web/components/shared/faq-list.tsx` |
| L-HERO | `web/components/landing/hero.tsx` |
| L-MATCH | `web/components/landing/match-preview.tsx` |
| L-PROOF | `web/components/landing/proof-points.tsx` |
| L-COMP | `web/components/landing/comparison.tsx` |
| L-FAQ | `web/components/landing/landing-faq.tsx` |
| PAGE | `web/app/(public)/page.tsx` |

Not read in this pass: `shared/src/plans.ts` (named in PRC as the source of truth for plan prices and feature lists). The pricing UI renders plan features from that file, so the feature strings on the live page may differ from PRC. Check before copying any plan feature text.

---

## 1. Verified claims and numbers usable in landing copy

"Verified" here means the source document marks it as verified end to end or as covered by a unit test, or it is a plain statement of a rule in the product docs. Where a source gives a target or an estimate, it is labelled as such and must not be presented as a result.

### 1.1 Product behavior

| Claim | Exact figure or rule | Source | Status in source |
| --- | --- | --- | --- |
| Applies only to jobs that fit | Fit gate runs hard filters first, then a model score with written reasons | PRD (core features, row 2); HIW step 02 | Built (fit gate); unit tests AC3 to AC5 |
| Jobs that miss a hard rule never cost a model call | Hard filters run before any model | HIW step 02 | Stated as design rule; PRD says hard filters come first |
| Tailoring uses only confirmed facts | Every resume line cites a confirmed fact id | PRD (row 3, "Every resume line cites a confirmed fact"); AC6 | AC6 unit test on `enforceTruthLock`, route wired |
| Nothing is sent without approval | Every application waits in the review queue for approval | PRD (one-line idea); CTA body | Core product rule |
| Confirm facts first | Resume is split into facts; user confirms or removes each | APP (first-use journey, steps 2 to 3) | Designed flow |
| Free account setup | Sign-up creates profile, free plan, forwarding address and a +25 free credit ledger entry | PRD AC1 | Verified end to end |
| Unverified email is blocked | Protected API returns 403 `email_unverified` until the email code is entered | PRD AC2 | Stated acceptance criterion |
| Failed submits cost nothing | Extension reports `failed`: no credit charged, failure reason shown | PRD AC10; PRC "Billing rules"; L-PROOF; L-FAQ | Verified end to end |
| One credit per successful submission | A credit is spent only when a submission reports `submitted`, one ledger row per application | PRC "Value metric"; PRD core features | Enforced by a unique index (per PRC) |
| Duplicate submit reports charge once | Extension reports `submitted` twice: exactly one credit | PRD AC9 | Verified end to end |
| Billing pauses on offer | Forwarded email tagged `offer` pauses the active Stripe subscription (`pause_collection`) | PRD AC12; PRC "Billing rules"; L-PROOF | AC12 has no verification tag in PRD |
| Redelivered Stripe webhooks are ignored | Idempotent by `stripe_events` | PRD AC13 | Stated acceptance criterion |
| Per-company cap | At most 2 applications per company per 30 days by default | PRD core features (P1, "built"); AC5 | Built; unit test |
| Sponsorship filter | Postings that say they do not sponsor are dropped, for users who need sponsorship | PRD core features (P1, built in fit gate); AC4 | Built; unit test |
| Seniority filter | Title "Senior Software Engineer" dropped when seniority preference is entry | PRD AC3 | Unit test |
| Live form safety | Filler with submit = true does not click submit when required fields are empty; reports the count | PRD AC11 | Unit test and live Greenhouse, Lever and Ashby forms |
| Greenhouse custom-domain boards | Apply URLs point at the Greenhouse embed form | PRD AC15 | Unit test and live board |
| Honest sign-in | Email plus password, email OTP (6-digit code, typed in, no magic links), Google sign-in | PRD core features; APP (entry points) | Designed flow |
| Forwarding address for replies | No Gmail access needed; replies tagged to applications | PRD core features (row 6); L-FAQ | P0 |
| Receipt for every submission | Receipt saves each field sent, each answer, the resume version and the confirmation page | L-PROOF (proof point 3); PRD user story 7 | Designed; extension status not stated in PRD |
| Review-mode option | Review opens the filled form in front of the user and stops; user presses the employer's submit button | APP (alternate journeys) | Designed |
| Withdraw before send | A draft or approved application can be withdrawn before it is sent | APP (alternate journeys) | Designed |
| Pause or cancel any time | Cancel from the Stripe customer portal at any time; access runs to the end of the paid period | PRC "Billing rules" | Billing rule |

### 1.2 Discovery and supported employers

| Claim | Exact figure or rule | Source |
| --- | --- | --- |
| Supported boards | Public Greenhouse, Lever and Ashby career pages | PRD core features (row 1); L-FAQ |
| Board polling speed | New postings seen within 30 minutes; 5 minutes on Max | PRD core features (row 1); PRC plan table |
| Form-filling test coverage | Live tests on Greenhouse, Lever and Ashby forms | PRD AC11 |
| LinkedIn is not automated | LinkedIn Easy Apply is out of scope because its user agreement bans bots | PRD out of scope; L-FAQ |

Workday and iCIMS are not supported (see section 6).

### 1.3 Plans and prices (launch prices, see caveat)

Caveat for every price: PRC says "These are launch prices. Test them with the beta survey below before treating them as final." Use the prices with a note that they may change for new customers. Existing subscribers keep their price for at least 90 days after any change, with 30 days' notice (PRC "Price research").

| Plan | Monthly | Weekly | Quarterly | Submitted applications | Cost per application at full monthly use | Resume profiles |
| --- | --- | --- | --- | --- | --- | --- |
| Free | $0 | n/a | n/a | 25, once | n/a | 1 |
| Starter | $19 | $6 | $45 | 400 per 30 days | $0.048 | 1 |
| Pro | $39 | $12 | $95 | 1,200 per 30 days | $0.033 | 3 |
| Max | $79 | $25 | $189 | 3,000 per 30 days | $0.026 | 10 |

Source: PRC "Plans" table and "Weekly and quarterly math". The cost-per-application figures are arithmetic from the price and allowance (19/400, 39/1200, 79/3000), so they are safe as pricing math.

| Rule | Exact figure | Source |
| --- | --- | --- |
| Weekly grant | `ceil(applicationsPerCycle × 7 / 30)`: Starter 94, Pro 280, Max 700 credits | PRC; PRD AC14 (94 credits, unit test) |
| Quarterly grant | Three cycles at once: 1,200, 3,600 and 9,000 | PRC |
| Quarterly discount | About 20% off three months: Starter $45 vs $57, Pro $95 vs $117, Max $189 vs $237 | PRC |
| Rollover cap (monthly) | Starter 800, Pro 2,400, Max 6,000 (two invoices' worth) | PRC "Rollover" |
| Rollover cap (weekly) | 188, 560, 1,400 | PRC "Rollover" |
| Rollover cap (quarterly) | 2,400, 7,200, 18,000 | PRC "Rollover" |
| Free credits never expire | The free grant never expires | PRC "Rollover" |
| Payment processor | Stripe, USD only; regional pricing for India is out of scope for v1 | PRC "Billing rules" |

Rollover caps are an internal rule. Use them in help text only, not as a headline promise.

### 1.4 Plan features (as documented)

| Feature | Free | Starter | Pro | Max | Source |
| --- | --- | --- | --- | --- | --- |
| Chrome extension apply | Yes | Yes | Yes | Yes | PRC plan table |
| Cloud applier (browser closed) | No | No | Yes | Yes | PRC |
| Tailored cover letters | No | Yes | Yes | Yes | PRC |
| Answer memory | No | Yes | Yes | Yes | PRC |
| Weekly outcome report | No | No | Yes | Yes | PRC (note: PRD lists it as P1, see section 6) |
| Priority polling (5 minutes) | No | No | No | Yes | PRC |

### 1.5 Competitor benchmarks (internal only)

PRC "Competitor benchmarks" lists Tsenta, Scoutify (Sniper) and Sprout prices, allowances and per-application costs, collected on 2026-10-13 from public pages and third-party reviews, with a note to check again before launch. Do not put competitor prices or names in landing copy without a fresh check and legal review. The positioning line in PRC ("the same entry price as Tsenta with fewer applications per dollar on purpose") is internal reasoning, not a claim to publish.

### 1.6 Facts in the current landing code that need a check

| Copy | Problem | Source |
| --- | --- | --- |
| "Upload your resume." (HIW step 01) | v1 is paste-only. APP says "paste resume text (PDF and DOCX upload come in the implementation plan)". | HIW; APP first-use step 1 |
| "Default bar: fit 75 of 100." (L-PROOF) | No document gives 75 as the default fit bar. APP lists "fit bar" as a field without a default. | L-PROOF; APP step 4 |
| "Lines that cite nothing are removed before you see the draft" (L-PROOF) and "Lines that do not are removed before you review." (L-FAQ) | Docs say a save with an unknown fact id returns 422 `truth_lock`, stores nothing, and the edit screen lists the offending lines. Removal before review is not documented. | PRD AC6; APP Actions table ("Edit draft") |
| "No card." (L-HERO, CTA) | No document states that sign-up skips a card. The free path is implied (Free plan at $0, no Stripe step in the primary journey). Confirm before keeping. | APP primary journey; PRC plan table |
| "Every application comes with a receipt." (L-HERO) | Receipts exist only for submitted applications. Drafts do not have one. Tighten to "every submitted application". | PRD AC10; APP `/applications/[id]` |
| "Posting sponsors visas; your OPT runs through 2027." "Built the invoice retry service that cut failed charges by 31%." "fit 86." "Larkfield Health". (L-MATCH) | Illustrative data about a made-up company and a made-up user. The brief allows only real product screenshots, not mockups. See section 6. | BRIEF "Assets needed" |
| "Pay for applications that went through." (PAGE heading) | Fine as a heading. Keep the qualifier that prices are launch prices nearby. | PRC |
| Hero "Start with 25 free applications" vs PRC | PRC says "25 submitted applications once". "Start with" implies the 25 are granted up front, which matches AC1. Keep, but use "25 submitted applications" if the copy needs precision. | PRC; PRD AC1 |

---

## 2. Features by priority and by plan, as documented

### 2.1 Core features by priority (PRD "Core features")

| Priority | Feature | User benefit (PRD wording) | Build status in PRD |
| --- | --- | --- | --- |
| P0 | Job discovery from public Greenhouse, Lever and Ashby boards | Sees new postings within 30 minutes (5 on Max) | Not stated |
| P0 | Fit gate: hard filters, then a model score with written reasons | Only jobs worth applying to reach the queue | Not stated (unit tests exist for filters) |
| P0 | Truth-locked tailoring | Every resume line cites a confirmed fact | Route wired; AC6 unit test |
| P0 | Review and edit queue | Edit any field, line or cover letter, then approve one or a batch | Not stated |
| P0 | Chrome extension apply | Fills the employer's own form in the user's browser; receipt saved | Not stated |
| P0 | Cloud applier | Pro and Max: sends approved applications with the browser closed | Not stated |
| P0 | Reply tracking by forwarding address | No Gmail access needed; replies tagged to applications | Not stated |
| P0 | Honest billing | One credit per successful submission; failed submits free; auto-pause on offer | AC9, AC10 verified end to end |
| P0 | Email + password, email OTP, Google sign-in | Familiar sign-in that works | Not stated |
| P1 | Answer memory | Answers to recurring questions saved after user approval | Not stated |
| P1 | Weekly outcome report | Callback rate by role and resume; targeting suggestions | Not stated |
| P1 | Per-company cap | At most 2 applications per company per 30 days by default | Built |
| P1 | Sponsorship filter | Skips postings that say they do not sponsor | Built (in fit gate) |
| P2 | Workday and iCIMS support | More employers covered | Not built |
| P2 | WhatsApp approvals | Approve matches from the phone | Not built |

Note: "Not stated" means the PRD does not say whether the feature is built. Do not write "available now" for those rows until the build status is confirmed.

### 2.2 Plan-to-feature map

See the table in section 1.4. Also: Free is 25 submitted applications once; Starter is 400 per 30 days and adds cover letters and answer memory; Pro is 1,200 per 30 days and adds the cloud applier, the weekly outcome report and 3 resume profiles; Max is 3,000 per 30 days, adds 5-minute polling and 10 resume profiles (PRC).

### 2.3 Upgrade triggers (PRC, internal reasoning)

- Free to Starter: the 25 run out, and cover letters unlock.
- Starter to Pro: the cloud applier. Sending while the laptop is closed is the main thing Starter users cannot do.
- Pro to Max: priority polling. Being among the first applicants on a new posting at a target company.

These can inform comparison copy ("Pro sends with the laptop closed"). They are not claims about results.

### 2.4 Out of scope for v1 (PRD)

LinkedIn Easy Apply automation; storing employer account passwords (Workday tenants); emailing recruiters on the user's behalf; mobile apps; Indian job boards (Naukri, Indeed India).

---

## 3. Audience segments and pains

### 3.1 Segments (PRD "Target users", BRIEF "Audience and tone")

| Segment | Who they are | What they need | Pain in their words or the docs |
| --- | --- | --- | --- |
| US OPT and STEM OPT students and new grads | International students racing an OPT clock; apply to 200 to 400 jobs per cycle | Volume without spam, sponsorship-aware filtering, speed on new postings | Time pressure on the OPT clock; need to know a posting sponsors |
| Laid-off tech workers in the US | Mid-level engineers, PMs and analysts searching for 1 to 3 months | Fewer, better applications; billing that stops when they get the job | Hundreds of applications and zero interviews; billing after the job is found |
| Indian job seekers applying to US-listed roles | Same tools, paying from India | The same product; regional pricing later | Paying from India in USD; INR pricing is out of scope for v1 |

Shared emotional state (BRIEF): job seekers under time pressure, anxious about what goes out under their name.

### 3.2 Manual application pain (PRD "Problem")

- Applying by hand takes 15 to 30 minutes per application, mostly retyping the same fields into Workday, Greenhouse and Lever forms.

### 3.3 Competitor complaints (PRD "Problem", about Tsenta, LoopCV, Jobright, AIApply, Massive and Sprout)

The PRD says users report these problems with auto-apply tools:

1. Matches that do not fit. Quoted in PRD: "only about 1% of the jobs shown actually matched".
2. A review step without an edit step.
3. Resumes with skills and metrics the user does not have.
4. Hundreds of applications and zero interviews.
5. Broad Gmail access that ended in a locked Google account.
6. Charges after cancelling, lost credits and ignored refunds.

Attribution rule: PRD presents these as reports from users, and the source of the figures is an external build-plan doc that is not in this repo. In copy, say "users report" or "people tell us". Do not name competitors in copy. The PRD names six tools; the landing page should not name any of them without legal review.

---

## 4. Tone and copy rules, and banned patterns

### 4.1 Rules that still hold (BRIEF, plus the user's locked rules for the landing)

- Three adjectives: calm, exact, accountable. The interface reads like a well-kept ledger, not a growth-hack tool.
- Concrete verbs and real numbers. Name the action (approve, submit, cite, pause).
- No hype words. No em dashes in any user-facing copy.
- Body text left-aligned. Never center body text or headlines.
- Honest proof only: mechanisms, guarantees, receipts, pricing math. Never invent testimonials, user counts, customer logos, ratings, press mentions or outcome metrics.
- Be exact about what the product does not do. The FAQ already does this for LinkedIn and for "undetectable" (L-FAQ answer 2: "We do not promise it is undetectable").
- Lime Pulse is a fill, never text. At most one lime element visible per viewport.
- Status words (Submitted, Needs review, Failed) carry the word, never only the color.
- Font weights 400 and 500 only (BRIEF). Hierarchy comes from size, tracking and color.

### 4.2 Banned patterns (for this sheet's copy review)

Banned on the landing page, drawn from the rules above:

| Pattern | Examples to avoid | Why |
| --- | --- | --- |
| Hype adjectives and superlatives | revolutionary, game-changing, seamless, effortless, supercharge, unlock your dream job, the best, #1 | Conflicts with calm, exact, accountable |
| Unsourced numbers | "10x more interviews", "3 times the callbacks", "95% of users", "thousands of applications" | No measured outcome exists |
| Testimonial-style quotes | "Got my offer in two weeks" | Invented testimonials are banned |
| Certainty about detection | "undetectable", "recruiters will never know" | L-FAQ says we do not promise this |
| Fear-based urgency | "Don't miss out", "last chance", "apply before it's too late" | Audience is already anxious; the brief asks for calm |
| Guarantees beyond the docs | "Guaranteed interview", "money back if you don't get hired" | No guarantee exists in the docs; refund terms await legal review (PRD open question 5) |
| Naming competitors | Tsenta, LoopCV, Jobright, AIApply, Massive, Sprout, Scoutify | Legal and tone risk; benchmark data is unverified |
| Lime text, glow, neon | Lime headline words, text-shadow glow | BRIEF bans lime as text and glow |
| Em dashes | Any em dash in copy | User rule |
| Gradients as decoration | Gradient hero backgrounds | BRIEF "Avoid: gradients" (Stripe docs row) |

### 4.3 Writing patterns that already work (keep the style)

- Short declarative headings: "Job applications you would sign." "Pay for applications that went through." "Four steps, and you stay in charge of each."
- Side-by-side contrast with "typical auto-apply" (comparison table), phrased as mechanisms, not insults.
- Plain statement of what is not done ("We do not automate LinkedIn, because its user agreement bans bots and it puts your account at risk.").

---

## 5. Current landing copy inventory

Lines marked KEEP are safe to reuse verbatim. Lines marked FIX need the change in the notes before reuse. All text is copied verbatim from the files.

### 5.1 `web/components/landing/hero.tsx`

| Element | Verbatim text | Status |
| --- | --- | --- |
| Eyebrow | For new grads, OPT and anyone between jobs | KEEP |
| H1 | Job applications you would sign. | KEEP |
| Subhead | Kairos finds roles that fit, tailors your resume only from facts you confirmed, and sends nothing until you approve it. Every application comes with a receipt. | FIX: "Every application" to "Every submitted application" |
| Primary CTA | Start with 25 free applications | KEEP (check against PRC wording) |
| Secondary CTA | See how it works | KEEP |
| Microcopy | No card. Credits are only used when an application actually goes through. | FIX: confirm "No card" (section 1.6) |

### 5.2 `web/components/landing/match-preview.tsx`

Illustrative only. Content is made up and is not a real product screenshot. Replace with a real capture (BRIEF requires real screenshots) or label it "Example" on the page.

| Element | Verbatim text | Status |
| --- | --- | --- |
| Company line | Larkfield Health · Brooklyn, NY | REPLACE (fictional company) |
| Job title | Software Engineer, Platform | REPLACE |
| Fit badge | fit 86 | REPLACE with real data |
| Reason lines | "Three years of TypeScript services, which the role asks for first" / "Posting sponsors visas; your OPT runs through 2027" / "Asks for Kafka; your profile mentions RabbitMQ only" | The third line's pattern (a gap named plainly) is worth keeping; the others are invented |
| Diff | "- Worked on backend features for the billing team." / "+ Built the invoice retry service that cut failed charges by 31%." | REPLACE: the "31%" figure is invented |
| Citation | cites fact #12 (role at Corvid Labs) and #14 (metric) | KEEP the pattern "cites fact #N", not the content |
| Footer line | 7 answers ready · 0 guessed | KEEP the idea ("0 guessed"); numbers are illustrative |

### 5.3 `web/components/landing/proof-points.tsx`

| Element | Verbatim text | Status |
| --- | --- | --- |
| Eyebrow | What is different | KEEP |
| H2 | Built for the complaints people have about auto-apply tools. | KEEP |
| Intro | Wrong jobs, words you never wrote, no way to edit, and charges after you left. We designed each part around one of those. | KEEP |
| Point 1 title | A fit gate before anything else | KEEP |
| Point 1 body | Role, seniority, location, salary floor, visa needs and your exclude list are hard rules. A job that breaks one is dropped before any model reads it, and the rest come with written reasons. | KEEP |
| Point 1 detail | Default bar: fit 75 of 100. Raise it when your queue gets noisy. | FIX: no source for 75 |
| Point 2 title | Resumes that cannot make things up | KEEP |
| Point 2 body | Each tailored line has to cite facts you confirmed. Lines that cite nothing are removed before you see the draft, and your own edits go through the same check. | FIX: "removed before you see the draft" is not documented; docs say a save returns 422 |
| Point 2 detail | You see every change as a diff, line by line. | KEEP |
| Point 3 title | Proof for every application | KEEP |
| Point 3 body | The extension fills the employer's own form in your browser and saves what it sent: each field, each answer, the resume version and the confirmation page. | KEEP (receipt contents from L-PROOF; check against the built receipt) |
| Point 3 detail | Replies come back through a forwarding address. No Gmail login. | KEEP |
| Point 4 title | Billing you can read | KEEP |
| Point 4 body | One credit per application that actually went through. Failed submits cost nothing. Pause any time, and we pause for you when an offer email arrives. | KEEP |
| Point 4 detail | Weekly plans for searches that end fast. | KEEP |

### 5.4 `web/components/landing/comparison.tsx`

| Element | Verbatim text | Status |
| --- | --- | --- |
| Eyebrow | Side by side | KEEP |
| H2 | How it compares with typical auto-apply. | KEEP |
| Row 1 | Which jobs get applications / Anything with a keyword match / Only jobs that pass your hard rules and fit bar | FIX: "Anything with a keyword match" is a claim about other products; soften to "Often anything that matches a keyword" or cite the complaint |
| Row 2 | Resume changes / Rewritten freely by AI / Each line cites a fact you confirmed | FIX: competitor claim unsourced |
| Row 3 | Before it sends / Review, often without editing / Edit every field and line, then approve | KEEP the Kairos column; the "typical" column matches the PRD complaint "a review step without an edit step" |
| Row 4 | Replies / Full Gmail access / A forwarding address you control | KEEP the Kairos column; "Full Gmail access" matches the PRD complaint |
| Row 5 | What you pay for / Credits, even for failed submits / Only submissions that went through | FIX: PRD complaint is "charges after cancelling, lost credits and ignored refunds"; "credits for failed submits" is not stated |

### 5.5 `web/components/shared/how-it-works-steps.tsx` (used on landing and /how-it-works)

| Step | Title | Body (verbatim) | Status |
| --- | --- | --- | --- |
| 01 | Confirm your facts | Upload your resume. We split it into facts, and you confirm each one. Nothing you did not confirm is ever used. | FIX: "Upload" to "Paste" (v1 is paste-only) |
| 02 | Set the fit bar | Roles, seniority, locations, visa needs and a fit threshold. Jobs that miss a hard rule never cost a model call. | KEEP |
| 03 | Review every draft | Each application shows its resume diff, every answer and why it matched. Edit anything, then approve one or a batch. | KEEP |
| 04 | Send from your browser | The extension fills the employer's own form and saves a receipt. Pro and Max can also send with the laptop closed. | KEEP |

### 5.6 `web/components/landing/landing-faq.tsx`

| Element | Verbatim text | Status |
| --- | --- | --- |
| Eyebrow | Questions | KEEP |
| H2 | What people ask before signing up. | KEEP |
| Q1 | Which job sites does it apply on? | KEEP |
| A1 | Employer career pages on Greenhouse, Lever and Ashby. We do not automate LinkedIn, because its user agreement bans bots and it puts your account at risk. | KEEP |
| Q2 | Will recruiters know I used it? | KEEP |
| A2 | The application is submitted through the employer's own form with your details and answers you approved. We do not promise it is undetectable; we make sure it is something you would have sent yourself. | KEEP (strongest honesty line on the page) |
| Q3 | Does it invent experience to match a job? | KEEP |
| A3 | No. Tailored lines must cite facts from your confirmed profile. Lines that do not are removed before you review. | FIX: "removed before you review" (section 1.6) |
| Q4 | What if a submission fails? | KEEP |
| A4 | You keep the credit. The application shows why it failed so you can fix it and send again. | KEEP |
| Q5 | Do you need my Gmail password or access? | KEEP |
| A5 | No. You set one forwarding filter, and replies about your applications come to a private address we give you. | KEEP |

### 5.7 `web/components/landing/` pricing and CTA (shared components used by the landing)

| File | Element | Verbatim text | Status |
| --- | --- | --- | --- |
| `web/app/(public)/page.tsx` | Section eyebrow / heading (How it works) | How it works / Four steps, and you stay in charge of each. | KEEP |
| `web/app/(public)/page.tsx` | Section eyebrow / heading (Pricing) | Pricing / Pay for applications that went through. | KEEP |
| `web/components/shared/pricing-plans.tsx` | Footnote | You are only charged a credit when an application is actually submitted. Failed submits never count. | KEEP |
| `web/components/shared/pricing-plans.tsx` | Badge on highlighted plan | Most chosen | KEEP (confirm it is Pro in data) |
| `web/components/shared/pricing-plans.tsx` | Plan CTA | Start free (Free), Choose {plan name} (paid) | KEEP |
| `web/components/shared/pricing-plans.tsx` | Interval labels | Weekly, Monthly, Quarterly | KEEP |
| `web/components/shared/cta-band.tsx` | Default H2 | Try it on 25 real applications. | KEEP |
| `web/components/shared/cta-band.tsx` | Default body | No card. Every application waits for your approval. | FIX: confirm "No card" |
| `web/components/shared/cta-band.tsx` | Button | Start free | KEEP |
| `web/components/shared/faq-list.tsx` | Component | Native `<details>` FAQ list; no copy | Keep the native pattern |

### 5.8 `web/lib/site.ts`

| Field | Verbatim text | Status |
| --- | --- | --- |
| `description` | Kairos finds jobs that fit, tailors your resume from facts you confirmed, and sends only the applications you approve. | KEEP as meta description |
| `supportEmail` | hello@kairos.app | CHECK: domain is an open question (PRD open question 1) |
| Public nav | How it works / Pricing / Blog / About | KEEP |
| Footer legal | Terms / Privacy / Cookies / Refunds | Pages exist as routes; content needs legal review (PRD open question 5) |

### 5.9 Problems noticed in passing

- Two lime elements can appear in one viewport on the landing: the hero primary CTA and the Approve chip in the match preview. BRIEF allows one. The pricing "Most chosen" badge and its plan button are both lime in `pricing-plans.tsx`. Keep one lime element per viewport.
- `match-preview.tsx` and `pricing-plans.tsx` use token names (`bg-accent-soft`, `text-subtle`, `text-good`, `text-warn`, `text-bad`, `bg-background`) that the BRIEF token list does not define in this form. Check when the tokens are migrated.

---

## 6. Do-not-claim list

Do not write any of the following on the landing page or in listing copy. Items are grouped by reason.

### 6.1 Not built, or not in v1

| Do not claim | Reason | Source |
| --- | --- | --- |
| Support for Workday | P2, not built | PRD core features |
| Support for iCIMS | P2, not built | PRD core features |
| LinkedIn Easy Apply automation or "applies on LinkedIn" | Out of scope; bans bots | PRD out of scope; L-FAQ A1 |
| Storing employer passwords (including Workday tenants) | Out of scope | PRD out of scope |
| Emailing recruiters on the user's behalf | Out of scope | PRD out of scope |
| Mobile apps (iOS, Android) | Out of scope | PRD out of scope |
| WhatsApp approvals | P2, not built | PRD core features |
| Indian job boards (Naukri, Indeed India) | Out of scope | PRD out of scope |
| Regional INR pricing | Out of scope for v1; Stripe USD only | PRC "Billing rules" |
| Resume upload (PDF or DOCX) | Paste only in v1 | APP first-use journey |
| Gmail login or Gmail access | Forwarding filter only | PRD core features; L-FAQ A5 |
| Weekly outcome report as live | P1; PRC lists it on Pro and Max, but build status is not stated | PRD; PRC |
| Answer memory as live | P1; build status not stated | PRD |
| Cloud applier as live (until verified) | P0; build status not stated | PRD |
| Chrome extension as live (until verified) | P0; the Chrome Web Store listing is an entry point, but build status is not stated | APP entry points; PRD |
| Reply tracking as live (until verified) | P0; build status not stated | PRD |

### 6.2 Unproven: results, counts and outcomes

| Do not claim | Reason | Source |
| --- | --- | --- |
| Interview or callback rates of any kind | No measured data; the weekly outcome report is not yet live | PRD; PRC |
| "Fewer applications to reach the same number of interviews" | PRC states it as positioning reasoning, not as a measured result | PRC "Positioning" |
| "70% of suggested matches are approved", "95% of approved applications submit" | These are launch targets, not results | PRD success measures |
| "Sees new postings within 30 minutes" as a measured speed | It is a design spec; no latency measurement is in the docs | PRD core features |
| "Free to paid conversion" figures | No target; measured in beta | PRD success measures |
| User counts, waitlist sizes, beta sizes | None documented | (none) |
| Testimonials, quotes, ratings, reviews, star scores | None exist; invented ones are banned | BRIEF; user rule |
| Customer logos or "trusted by" lines | None exist | BRIEF; user rule |
| Press mentions, "featured on" badges | None documented; Product Hunt and BetaList are planned entry points only | APP entry points |
| Cost per application of $0.01 as a fact | Estimate; PRC says "Estimates, not measurements" | PRC "Cost floor" |
| "Max user at full use costs about $30" | Estimate | PRC "Cost floor" |
| Undetectable applications, or that recruiters will not know | L-FAQ A2 says it does not promise this | L-FAQ A2 |
| Match quality numbers such as "only 1% of jobs matched" as Kairos's own rate | That figure is a complaint about other tools | PRD problem section |
| Specific resume effect numbers ("cut failed charges by 31%", "increased callbacks") | Invented in the current preview | L-MATCH |

### 6.3 Pricing and billing claims to hold back

| Do not claim | Reason | Source |
| --- | --- | --- |
| Final prices | Launch prices; beta survey will test them | PRC "Bottom line" |
| Competitor prices or allowances | Collected from third-party reviews; recheck before launch and legal review | PRC "Competitor benchmarks" |
| Refund terms beyond "failed submits cost nothing" | Refund policy awaits legal review | PRD open question 5; PRD AC10 |
| A money-back guarantee of any kind | Not in docs | PRD |
| Rollover amounts as a headline promise | Internal rule; use in help text only | PRC "Rollover" |
| "Billing stops the moment you get a job" as exact | The docs say billing pauses when an offer email arrives at the forwarding address; a user must forward it; this depends on reply tracking, which must be verified | PRC "Billing rules"; PRD AC12 |
| Free plan requires no card | Implied, not stated; confirm | APP primary journey |

### 6.4 Brand and legal

| Do not claim | Reason | Source |
| --- | --- | --- |
| Any competitor name in copy | Legal and tone; benchmark data unverified | PRC; BRIEF |
| The domain kairos.app or the email hello@kairos.app as live | Domain availability is an open question | PRD open question 1; `web/lib/site.ts` |
| Any policy promise beyond the billing rules | Legal review of terms, privacy, cookies and refunds is pending | PRD open question 5 |
| A visual identity borrowed from another company | BRIEF provenance check: DESIGN.md came from another company's public product; the product owner must confirm the adoption | BRIEF "Provenance check" |
| "Trusted by" or affiliation with any employer board (Greenhouse, Lever, Ashby) | Kairos only reads their public career pages; no partnership is documented | PRD core features |
| Sponsorship guarantees (for example "we will find you a sponsor") | Kairos only skips postings that say they do not sponsor; it does not find sponsors | PRD core features (sponsorship filter) |
| "Undetected" or "invisible" applying | See section 6.2 | L-FAQ A2 |

---

## Summary of fixes needed in current copy

1. Hero subhead: "Every application" to "Every submitted application".
2. Hero and CTA: confirm "No card" before keeping it.
3. How it works step 01: "Upload your resume" to paste.
4. Proof point 1: remove "Default bar: fit 75 of 100" unless the default is confirmed.
5. Proof point 2 and FAQ A3: replace "removed before you see the draft" and "removed before you review" with the documented 422 behavior, or confirm the product removes lines.
6. Match preview: replace the invented company, user, metric and fit score, or label it "Example".
7. Comparison: soften competitor claims and make the "typical" column match the reported complaints.
8. Lime rule: keep one lime element per viewport.
