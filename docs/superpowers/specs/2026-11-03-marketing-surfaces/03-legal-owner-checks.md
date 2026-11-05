# 03 Legal pages: owner and counsel checks

FE-legal, 2026-11-05. The pages at `/terms`, `/privacy` and `/cookies` say only what the code does today (README D11). Each item below is something the code cannot answer. The pages are worded to stay true without it. Keep the visible draft note until counsel signs off.

## A. Facts only you can give

| # | Need | Why | Where the page stands today |
|---|---|---|---|
| A1 | Legal entity of Gray Matter Labs: full registered name, form, registration number, registered address | Terms and privacy must identify who the contract and the data controller are. CAN-SPAM also needs a postal address in every newsletter issue (WP-50 section 3) | Says "operated by Gray Matter Labs", from `siteConfig.company`, and gives no address |
| A2 | Governing law, courts or arbitration, and any consumer carve-outs | Cannot be guessed; the operator's and users' locations decide it | Terms, "Governing law", says plainly that it is not set |
| A3 | Named privacy contact: DPO or EU/UK representative if required, and the grievance officer the DPDP Act s. 13 calls for (WP-25 item 12) | The law may require a named person and address | Privacy, "Contact", says none is named yet |
| A4 | Confirm `hello@kairos.app` is live and read | It is the only address on all three pages, for refunds and privacy requests alike | Used from `siteConfig.supportEmail` |
| A5 | A copyright complaint channel, and a DMCA agent if needed | Terms sends these to the support address for now | Terms, "Contact" |

## B. Decisions on money

| # | Decision | Why | Where the page stands today |
|---|---|---|---|
| B1 | **A refund window: decided 2026-11-05 (D14).** 14 days from a charge with its credits unused; every other request reviewed by a person. Refunds are still done by hand, so someone must be ready to honour this. Counsel should check it against local consumer law |
| B2 | **Offer-based pausing.** Removed from the code on purpose (`server/src/jobs/classify-email.ts:32-33`, CISO mustFix 5). The replacement with confirmation and undo is not built | Change the page only when that flow ships | Says Kairos does not pause by itself; cancel it yourself |
| B3 | **Stale pause copy outside my files.** `docs/pricing.md:7,83`, `docs/01-prd.md:53,81,96`, `web/content/landing-copy.ts:187-189` (`guaranteeLive`, gated), `server/src/routes/notifications.ts:17` ("Offer detected: billing will pause"), and the portal button `web/components/dashboard/billing/plan-summary.tsx:62` ("Change, pause or cancel", while WP-10 step 8 does not list pause in the portal) | These contradict the legal text if they ship | Reported, not edited |
| B4 | **Credit rollover limit.** `web/components/pricing/pricing-copy.ts:44` and `docs/pricing.md:55` promise a limit of two invoices' worth, but nothing writes an `expiry` row (Task 12 is unbuilt), so unused credits never expire | Either build it or drop it from pricing | Terms, "Plans and credits", states both honestly |
| B5 | **Credits after a plan ends.** The code keeps them on the balance and they stay spendable (`availableCreditsNow` ignores the plan); pricing says they roll over "while you subscribe" | Decide what you intend | The pages promise nothing beyond "stay on your balance today" |
| B6 | **Portal settings** in Stripe's dashboard: cancel at period end, and downgrades at period end (WP-10 step 8) | "Your plan runs to the end of the period you paid for" is true only with that setting | Stated as fact; please confirm in live mode |
| B7 | **Liability cap and indemnity.** The draft sets no amount and no indemnity | Amounts and risk calls for counsel | Terms, "No guarantees and liability" |
| B8 | **EU withdrawal rights.** The refund skill's checklist flags the 14-day right to withdraw and the withdrawal button under Directive (EU) 2023/2673, deadline 19 June 2026. Checkout asks for no waiver and no withdrawal function exists | If you sell to EU consumers this may be a product gap, not only a text gap. Counsel to confirm | Page says only that legal rights are not limited |
| B9 | **Tax.** `STRIPE_AUTOMATIC_TAX` is off by default (`server/src/lib/env.ts:195`) | "Any tax we collect is added at checkout" is true on or off | Confirm when Stripe Tax is activated |

## C. Privacy values for counsel (WP-25 section 4, WP-50 section 4)

| # | Item | On the page | Depends on |
|---|---|---|---|
| C1 | Every retention period | 7, 30, 90, 120, 180 days and 12 months | The spec's defaults. `RETENTION_DAYS` can override them; if it does, change the page |
| C2 | Removal from backups and providers | Page words both as aims: "we aim ... within 24 hours" live (code pages an operator at 24 h, `server/src/jobs/erasure.ts:176-179`), "our target is 45 days" backups and providers | WP-25 item 6. Needs the R2 lifecycle rules (WP-14 step 2), Railway PITR and Postmark settings applied. Anthropic's 30 days assumes no zero-retention addendum |
| C3 | Uploaded files and rendered PDFs after 30 days | Page says "deleted with your account" (in code) and "our target is 30 days", true either way | **Bucket rules are owner actions**: `uploads-30d` (WP-17 section 4, supersedes WP-14 section 3) and `renders-30d` (WP-14 step 2). Once applied in production, the page can state 30 days as fact |
| C4 | Records kept after deletion (ledger hash, erased address hash, suppression hash) | Listed | WP-25 items 7, 8, 10: is a statutory period needed? |
| C5 | Access requests answered "within 30 days" | "aim to answer" | WP-25 item 13. Export is an operator script (`server/scripts/export-user.ts`); there is no self-serve export |
| C6 | Lawful bases (GDPR Art. 6), DPDP notice wording, California categories, transfer safeguards | Not on the page | Legal conclusions. The privacy skill's checklist expects EEA/UK and California supplements; add them from counsel's text |
| C7 | International transfers | "may process data outside your country" | Regions are not in code: Railway, Vercel, R2 and Anthropic regions, and any SCCs or DPAs signed. Also confirm where Redis runs (`REDIS_URL`); job payloads hold ids only |
| C8 | Minimum age | Terms: old enough to contract and apply. Privacy: no age check | Sign-up has no age gate. COPPA, GDPR and the DPDP under-18 consent rule may require one |
| C9 | No sale, no training | Stated as fact | No sale or training code exists. Confirm that matches your intent, and check Anthropic's current commercial terms; the page does not speak for Anthropic |
| C10 | Newsletter proof of consent | Double opt-in record, no IP | WP-50 section 4 asks whether that is enough |
| C11 | Log and error retention at Railway and Sentry | No period stated | Set in those dashboards; give me the numbers and I will add them |
| C12 | Automated decisions | Fit scores filter what is shown; you decide what is sent | Does the below-bar filter count as profiling that needs more notice? |

## D. Cookies

| # | Item | Finding |
|---|---|---|
| D1 | Is a banner needed? | It appears not for analytics or advertising, since there are none: no such scripts, no third-party requests and no cookies on public pages (checked in a browser on the dev server). One question for counsel: EU ePrivacy covers any browser storage, and `kairos.popup.newsletter`, `kairos:motion` and the banner key are conveniences, not strictly necessary. They hold no identifier and never leave the browser. I added no banner |
| D2 | Vercel dashboard | Confirm Web Analytics and Speed Insights stay off. The code has neither package, but the check above ran on localhost, not on Vercel |
| D3 | Dead code | `web/components/ui/sidebar.tsx:86` could set a `sidebar_state` cookie, but nothing mounts `SidebarProvider`. If that changes, add it to the page |

## E. Things that must change the pages when they ship

- **Autopilot.** `shared/src/plans.ts`, the schema and consent comments carry it, but nothing writes `approved_by = 'autopilot'`, so "nothing is sent without your approval" is true today. It needs new text in Terms and Privacy before it ships.
- **Offer pause flow** (B2), **rollover expiry** (B4), **any analytics**, **any new provider**, **newsletter issues** (none is sent yet, WP-50 section 3).
- **Newsletter section** assumes WP-50 merges with the D9 contract (a button on the confirm page). The `wp/50` branch as last read still confirms on `GET /confirm`. If that stays, fix the sentence.
- **`PRIVACY_NOTICE_VERSION`** (`server/src/lib/env.ts:318`, default `2026-10-30`): set it to the notice date on the api each time these pages change. The pages now say 2026-11-05.
- **Material changes.** No flow re-asks existing users to accept. The pages say the new version applies if they keep using the service. Counsel may want email notice or re-acceptance.
