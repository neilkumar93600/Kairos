# Competitor Landing Teardown for the Kairos Landing Page

Date: 2026-10-15. Method: live fetch of each landing page's text and markup through WebFetch, plus one web search. Fetches return page text, not rendered pixels, so statements about motion and visual style are marked **observed** (stated in the fetched content) or **inferred** (deduced from asset names, status labels, duplicated DOM blocks). Nothing here has been verified in a browser at scroll; Section 6 lists what to confirm in a screen-recorded pass before design lock.

## 1. Coverage and reachability

| Competitor | URL tried | Result |
|---|---|---|
| Jobright | jobright.ai | Fetched. |
| Simplify | simplify.jobs | Fetched, but the result was markdown text only (no visuals, no CTA labels). |
| Teal | tealhq.com | **Blocked**: HTTP 403 on two attempts. Not reviewed. Only general knowledge applies and it is unverified here. |
| LoopCV | loopcv.pro | Fetched. |
| AIApply | aiapply.co | Fetched. |
| Sprout | usesprout.com | Fetched. |
| Massive | www.usemassive.com | **Unreachable**: DNS error (ENOTFOUND on the www host). A web search found only third-party coverage (a Substack post, a directory review, an app catalog listing). Third-party claims of "30,000 waitlist sign-ups" and "over 100k users" are unverified and are not used below. |
| Tsenta | tsenta.com | Fetched. |

Six of eight were reviewed from their own pages. Teal and Massive are skipped for the reasons above.

## 2. Per-competitor findings

### 2.1 Jobright

- **Hero message:** "No More Solo Job Hunting" with "Do it with AI" beneath. Subhead promises matched jobs, autofill, tailored resume and insider connections "in less than 1 min!". Primary CTA "Try For Free".
- **Visual style (observed/inferred):** Clean light product layout, feature screenshots, decorative SVG accents, short scannable structure. Motion not observable from text.
- **Motion:** No evidence of anything beyond standard section reveals.
- **How it proves claims:** Volume numbers ("3,000,000 trusted users", "8,000,000+ jobs", "400,000+ new jobs today"), outcome ratios ("3x interviews landed", "4X with referrals", "80% time saved"), first-name testimonials with job titles, Product Hunt badge, "featured by OpenAI" badge, a Trustpilot badge with no visible score, a named executive quote.
- **What feels untrustworthy:** "No.1" claims with no source. "Featured by OpenAI" implies an endorsement it does not explain. The same testimonials appear twice verbatim. The user count appears in two places with different wording. "Passes ATS", "no fake listings" and "in just 6 seconds" are unsubstantiated. The "Pricing" nav link leads to an employer page, so a job seeker cannot find a price.

### 2.2 Simplify

- **Hero message:** "Simplify - Your AI Job Search Partner"; "a personal AI talent agent for job seekers and an AI-native talent agency for companies."
- **Visual style/motion:** Not determinable from the fetched markdown.
- **How it proves claims:** Scope numbers only ("millions of openings", "100,000+ company career sites"), hand-curated new-grad and startup lists. No logos, testimonials, ratings or user counts appeared in the fetched content.
- **What feels untrustworthy:** Two audiences in one hero (seekers and companies) blurs who it serves. "Beat applicant tracking systems", "instantly" and "in one click" are unqualified. AI recruiter introductions are described with no criteria or limits. No pricing on the page.

### 2.3 LoopCV

- **Hero message:** "Loopcv helps you get 3x more interviews using AI." Subhead: upload CV, choose job type, press Start, and it will "Mass Apply on your behalf Every Single Day". CTAs "Get started" and "Start for free".
- **Visual style (observed):** Light theme, dashboard screenshot, decorative shapes, emoji in headings (a rocket), bold section headers.
- **Motion (observed):** An animated GIF near the FAQ. Little else detectable.
- **How it proves claims:** "61% of users get an interview in the first 10 days", "25k+ jobseekers found their dream job", four unnamed avatars, Product Hunt and Fazier badges, a prize badge.
- **What feels untrustworthy:** The 61% figure has no sample, no definition of "interview". The FAQ says "Results vary by role, market, and CV quality" directly against a "3x" headline. "Mass Apply" and "Auto-Apply to 1,000+ Jobs" put volume above fit. "Employers see a normal application without an automation label" is a strong assurance with no support. Duplicate headings, typos, and an application cap hidden behind "plan limits".

### 2.4 AIApply

- **Hero message:** "Stop Applying for Weeks / Start Interviewing in Days." Subhead lists matching, resume and cover letter tailoring, auto-apply and live coaching. "Start now" repeats about a dozen times.
- **Visual style (observed/inferred):** Light layout, stacked avatars, mockups of a resume editor, application feed and interview chat. Duplicated logo and listing blocks suggest a marquee. Live-looking status labels ("Applying Now...", "Applied", "2 min ago") are probably illustrative.
- **Motion (inferred):** Scrolling logo marquee, ticking feed. An exit popup with a copy-to-clipboard coupon.
- **How it proves claims:** "Loved by 2,064,348 users" (false precision), "372,241+ roles applied to", "20M+ jobs", "61% in first 10 days" (the same stat LoopCV uses, again unsourced), "80% more likely" with no baseline, a "4.7 • 387 Ratings" badge with no platform, a logo strip of Google, Amazon and Meta under "Get hired by top companies worldwide".
- **What feels untrustworthy:** The logo strip implies hires that the page does not show. Testimonials include "I have not actually tried the service yet" and "I have not landed a role yet" (in-page evidence that undercuts the claims). Exit-intent urgency. Refunds are "case-by-case". Live interview coaching "through your earpiece" is ethically contested. No prices on the page. A real public figure's resume is used as the sample.

### 2.5 Sprout

- **Hero message:** "Stop applying. Start landing interviews." Subhead: "Sprout asks smart questions, writes your applications, and lets you review before send." Closest message to Kairos on approval. CTAs "Try Sprout" and "Get Started".
- **Visual style (observed/inferred):** Dashboard mockups with status tags, a swipe-card "Tinder for jobs" motif, a "Sprout AI Generating..." label. Live-updating UI implied.
- **Motion (inferred):** Animated cards and status changes. Cannot confirm.
- **How it proves claims:** "Used by 750,000+ job seekers", "Saves 20+ hours every week", "Rated 4.8/5 on the App Store" (repeated four times), "4.4/5 based on 25k+ reviews" with no store named, employer names (Barclays, Wesco, Capital One, NVIDIA, S&P Global) as plain text in quotes, a self-scored "Sprout vs. The Rest" table.
- **Pricing (observed):** $19.99 weekly for 50 applications, $39.99 monthly for 200, $79.99 quarterly for 600 with a struck-through $239.99 and "70% off" (the actual discount is about 67%, measured against 12 weeks of the weekly plan). "No upsells. No paywalls" sits beside hard caps. Cost per application is $0.40 on the weekly plan.
- **What feels untrustworthy:** Leftover template text ("To embed a Youtube video, add the URL to the properties panel."), typos ("Recieved", "nterview"), the same job in two different statuses, a possibly real name and email in a mockup, "Employers will know?" answered with a flat "No", "750,000+" next to "thousands of users".

### 2.6 Tsenta

- **Hero message:** "Be the first to apply to every job that fits you. Hands off." Reassurance "Free to start. No card required." CTAs "Get started" and "See how it works". It says "fits you" but sells speed and volume.
- **Visual style (observed):** Minimal, monospace terminal logs, dashboard mockups, logo grids. The closest aesthetic neighbour to Kairos.
- **Motion (inferred):** Scrolling scan log with timestamps, status labels that cycle ("Reading job description...", "Tailoring resume", "Queued"), and a "preparing application..." receipt.
- **How it proves claims:** "50,000+ career pages", "30+ more ATSes" (the apply section says "nineteen ATSes covered"), "hundreds of applications a week", a "Where Tsenta users have been hired" logo wall, a Y Combinator badge, a dashboard mockup (47 applied, 8 replied, 4 interviews) not labelled as sample data.
- **Pricing (observed):** $19, $39, $99 per month for 600, 1,500, 4,500 applications. 25 free applications, "Pay only for jobs actually submitted" (ambiguous).
- **What feels untrustworthy:** Inconsistent ATS counts. An uncited "recruiters review the first 100 applications" premise driving urgency. "For the desperate, the laid-off, the OPT-clocked" exploits the exact audience Kairos serves. Mockup numbers read as results. In its favour: a candid FAQ (no sponsorship guarantee, no undetectability promise, email access optional, a founder contact).

## 3. Cross-competitor patterns

| Pattern | Who does it | Implication for Kairos |
|---|---|---|
| Headline promises an outcome (interviews, "3x") | Jobright, LoopCV, AIApply, Sprout | Kairos must not promise outcomes. It can promise process guarantees it controls. |
| Unsourced user counts and percentages | All six | Pre-launch Kairos has none, which is an advantage if it makes "no numbers we cannot show" visible. |
| Same stat reused across brands ("61% in 10 days") | LoopCV, AIApply | Shows these figures are template copy. Readers who compare tabs will notice. |
| Volume as the value ("1,000+", "hundreds a week", "mass apply") | LoopCV, Tsenta, Jobright, AIApply, Sprout | Kairos sells the opposite: fewer, fitting applications. |
| Logo walls implying hires | AIApply, Tsenta, Jobright | Kairos shows no customer logos. |
| Mockups with fake live data, unlabelled | AIApply, Sprout, Tsenta | Kairos can label its demos as sample data and win trust by doing so. |
| Light SaaS aesthetic, screenshots, avatars | Jobright, LoopCV, AIApply, Sprout | A dark, exact, ledger-like page is already visually distinct. Only Tsenta shares the terminal idea. |
| "Employers cannot tell" assurances | LoopCV, AIApply, Sprout, Tsenta (hedged) | Kairos should not make detection claims at all. |
| Prices hidden or conflicting | Jobright, Simplify, LoopCV, AIApply | Publish the full price table and the math. |
| Approval before send | Sprout only ("review before send") | Not owned by anyone; Sprout states it in one clause and then undermines it with volume pricing. |

## 4. White space Kairos can own

Facts below come from `docs/pricing.md` and the locked product definition. Anything about build status should be confirmed against the PRD before it appears as copy.

| Territory | What competitors do | What Kairos can own | Verbal proof (mechanism, not metric) | Visual proof |
|---|---|---|---|---|
| **Fit-first matching** | Say "jobs that fit" but lead with count (Tsenta) or "match" as a feature (Jobright). | The fit gate: Kairos declines most jobs and shows why. Rejections are as visible as applications. | "Kairos skips jobs that do not fit. You see each skip and the reason." | A single job card passing or failing a gate, with the reason written out. |
| **Truth-locked tailoring** | "Tailored resume" and "beats ATS" with no limits. | Every resume line cites a fact the user confirmed. Nothing is added that the user did not confirm. | "Every line on your resume cites a confirmed fact. No fact, no line." | Resume lines carrying citations such as "cites fact #12". |
| **Approval before sending** | Sprout mentions review in a clause. The rest are "hands off" or "mass apply". | The product sends nothing until the user approves it, and the page is built around that gate. | "Nothing is sent until you approve it." | A visible approve action as the only path to a send. |
| **Receipts** | Fake live feeds; Tsenta's "preparing application..." receipt is decoration. | A real receipt for every submission: what was sent, to whom, which facts it cited, and what it cost. | "Every application ends with a receipt you can open." | Ledger rows and receipt slips, sample data labelled as sample. |
| **Honest billing** | Hidden prices, "70% off" against a made-up anchor, case-by-case refunds, ambiguous "submitted". | Pay for submitted applications only. Failed submissions cost nothing. Billing pauses when an offer email arrives. Weekly billing for OPT clocks. Cost per application published. | "Failed submissions cost nothing." "Billing pauses when you get an offer." | The full price table with per-application math and the competitor comparison from `docs/pricing.md`, stated with date and source. |
| **No Gmail access** | Tsenta describes email access as optional; most say nothing. | A plain statement of what Kairos does not read. Confirm the exact current scope in the PRD before writing the final sentence. | "Kairos does not read your Gmail." (confirm wording against `docs/01-prd.md` and the offer-email mechanism in `docs/pricing.md`) | A short "what we never touch" list. |

### Positioning statement

For anxious applicants on a deadline, Kairos is the application agent that applies only where you fit, writes only from facts you confirmed, and sends nothing without your approval. Every send ends in a receipt.

### Verbal register to own (versus the field)

| Field says | Kairos says |
|---|---|
| "3x more interviews" | "25 free applications. Nothing sends without you." |
| "Hands off" | "Hands on the one decision that matters: approve." |
| "Beats ATS" | No claim. |
| "Employers cannot tell" | No claim. |
| "Mass apply to 1,000+ jobs" | "We skip the jobs that do not fit." |
| "Loved by 2,064,348 users" | No count until it exists. Show the product's own records instead. |
| "70% off" | A flat table: price, applications, cost per application. |

### Visual register to own

- The field is light, screenshot-led and friendly. Kairos is dark, exact and document-like: ledgers, receipts, citations, a gate. Tsenta's terminal log is the only near neighbour, so Kairos must not rely on monospace scrolling logs as its signature.
- Counter-move on mockups: label every sample as sample data. The visible honesty is itself the differentiator.
- Counter-move on motion: the competitors' motion is feeds that tick forever. Kairos motion should be causal (a thing passes the gate, is cited, is approved, becomes a receipt), then stop. Motion that ends reads as accountable. Motion that loops reads as simulated activity.
- The "kairos" idea (the right moment, versus clock time) suits a gate that opens only on your approval. Use it as the metaphor, not as decoration.

## 5. Pricing comparison (published numbers only)

From `docs/pricing.md` (competitor figures there come from earlier research; the Sprout and Tsenta rows match this review's fetch).

| Product | Price | Applications | Cost per application |
|---|---|---|---|
| Tsenta | $19 / $39 / $99 per month | 600 / 1,500 / 4,500 | $0.032 / $0.026 / $0.022 |
| Sprout | $19.99 weekly | 50 | $0.40 |
| Sprout (monthly, this review) | $39.99 | 200 | about $0.20 |
| Kairos | $19 / $39 / $79 per month | 400 / 1,200 / 3,000 | $0.048 / $0.033 / $0.026 |

Kairos is not the cheapest per application. The page should not claim to be. The claim it can defend is a different one: it charges only for applications that were submitted, and every one has a receipt.

## 6. Risks and items to confirm

1. Teal and Massive were not reviewed from their own pages. If needed, do a browser pass.
2. Motion and visual descriptions are inferred from text. Before design lock, screen-record each reviewed site at desktop and phone width to check marquees, tickers, scroll behaviour and load weight.
3. Competitor numbers on live pages change. Date any comparison shown on the Kairos page, and link to the competitor's own pricing page.
4. Do not copy the structure "problem, solution, three feature cards, testimonials wall, pricing". All six use it. The Kairos page should be organised around the lifecycle of one application: match, gate, cite, approve, send, receipt.
5. Any claim about Gmail, email reading or data handling must be checked against the PRD and the implemented scope before it ships.
6. Avoid naming competitors in hero copy. Name them only in a dated, sourced pricing comparison.
