# Kairos pricing

Last updated 2026-10-23 (Starter raised from 400 to 1,000 applications, owner decision) · Source of truth in code: `shared/src/plans.ts`

## Bottom line

Four plans, and you pay for one thing: an application that actually went through. Free gives 25 submitted applications once. Starter is $19 a month for 1,000, Pro is $39 for 1,200 and adds the cloud applier, Max is $79 for 3,000 and adds 5-minute polling of the companies you target. Weekly and quarterly billing exist for people on a short clock (OPT) or a long search. Failed submissions cost nothing, and billing pauses itself when an offer email arrives.

These are launch prices. Test them with the beta survey below before treating them as final.

## Value metric

| Option | Verdict | Why |
| --- | --- | --- |
| Successful submissions per cycle (chosen) | Yes | It is what users are buying, it scales with how hard they search, and charging only on success is the promise competitors break |
| Flat unlimited subscription | No | Heavy users would cost more than they pay, and "unlimited" pushes the spray-and-pray behavior users complain about |
| Per seat | No | One person, one search |
| Per outcome (interview) | Not yet | Measurable only through forwarded replies, which many users will not set up; revisit after beta |

The model is a subscription with a usage allowance. A credit is spent only when a submission reports `submitted` (one ledger row per application, enforced by a unique index).

## Plans

| | Free | Starter | Pro | Max |
| --- | --- | --- | --- | --- |
| Monthly | $0 | $19 | $39 | $79 |
| Weekly | | $6 | $12 | $25 |
| Quarterly | | $45 | $95 | $189 |
| Submitted applications | 25 once | 1,000 / 30 days | 1,200 / 30 days | 3,000 / 30 days |
| Cost per application at full use (monthly) | | $0.019 | $0.033 | $0.026 |
| Resume profiles | 1 | 1 | 3 | 10 |
| Chrome extension apply | Yes | Yes | Yes | Yes |
| Cloud applier (browser closed) | | | Yes | Yes |
| Tailored cover letters | | Yes | Yes | Yes |
| Answer memory | | Yes | Yes | Yes |
| Weekly outcome report | | | Yes | Yes |
| Priority polling (5 minutes) | | | | Yes |

### Upgrade triggers

Each paid step has one reason to move up, not a pile of features:

- Free to Starter: the 25 run out, and cover letters unlock.
- Starter to Pro: the cloud applier. Sending while the laptop is closed is the main thing Starter users cannot do.
- Pro to Max: priority polling. Being among the first applicants on a new posting at a target company.

### Weekly and quarterly math

- Weekly price is set so four weeks cost more than a month (Starter $6 a week is about $26 a month), which keeps monthly the default while letting someone with three weeks left on OPT pay only for those weeks.
- Weekly invoices grant `ceil(applicationsPerCycle × 7 / 30)` credits: Starter 234, Pro 280, Max 700.
- Quarterly is about 20% off three months (Starter $45 vs $57, Pro $95 vs $117, Max $189 vs $237) and grants three cycles at once: 3,000, 3,600 and 9,000.

### Rollover

Unused paid credits roll over while the subscription is active, up to two invoices' worth of the plan's grant: on monthly billing Starter keeps up to 2,000, Pro 2,400 and Max 6,000; on weekly billing 468, 560 and 1,400; on quarterly billing 6,000, 7,200 and 18,000. Anything above that expires when the next invoice is paid, with an `expiry` ledger row the user can see. The free grant never expires. Build: Task 12 in `docs/06-implementation-plan.md`.

## Competitor benchmarks

Collected on 2026-10-13 from public pages and reviews ([Scoutify's Tsenta review](https://scoutify.com/blog/tsenta-review/), [Sprout review](https://scoutify.com/blog/sprout-review/)); check again before launch.

| Product | Price | Allowance | Per application |
| --- | --- | --- | --- |
| Tsenta | $19 / $39 / $99 per month | 600 / 1,500 / 4,500 | $0.032 / $0.026 / $0.022 |
| Scoutify (Sniper) | $25 per week | up to 500 per week | $0.05 |
| Sprout | $19.99 per week | 50 | $0.40 |
| Kairos | $19 / $39 / $79 per month | 1,000 / 1,200 / 3,000 | $0.019 / $0.033 / $0.026 |

Positioning: at the entry price Kairos gives more than Tsenta (1,000 against 600 for $19, owner decision 2026-10-23). Pro and Max keep fewer applications per dollar on purpose: the fit gate drops jobs that do not fit, so a user needs fewer submissions to reach the same number of interviews, and failed ones are free. Max is priced below Tsenta's top plan because 3,000 fit-checked applications a month is already more than most searches need.

## Cost floor

| Item | Estimate | Note |
| --- | --- | --- |
| Model and compute per submitted application | about $0.01 | TRD target; model calls logged per call (Task 14) |
| Cloud applier share of that compute | to be measured in beta | One headless Chromium page per application |
| Max user at full use | about $30 on $79 | If the 1 cent target holds; watch in beta |

Estimates, not measurements. Replace them with the beta's logged costs.

## Billing rules users can rely on

- Charged only for applications that went through; failed submissions cost nothing.
- Billing pauses when an offer email arrives at the forwarding address (Stripe `pause_collection`).
- Cancel from the Stripe customer portal at any time; access runs to the end of the paid period.
- One processor: Stripe, USD. Regional pricing for India is out of scope for v1.

## Price research for the beta

Run the Van Westendorp survey with at least 30 beta users after their first week, split by segment (OPT and new grads, laid-off US workers, India-based applicants). Below 30 responses per segment, read the result as direction only.

1. At what monthly price would Kairos be so cheap that you would doubt it works?
2. At what monthly price would it be a bargain?
3. At what monthly price would it start to feel expensive, though you would still consider it?
4. At what monthly price would it be too expensive to consider?

Read the range of acceptable prices from where the curves cross, compare it with the prices above, and change prices for new customers only. Existing subscribers keep their price for at least 90 days after any change, with 30 days' notice.

Signals to act on during beta:

- More than 40% of Free users upgrade: prices are probably low; test +20% on Starter for new sign-ups.
- Almost nobody moves past Starter: the cloud applier is not a strong enough trigger; revisit what Pro adds.
- Monthly churn above 5%: fix fit quality and reply tracking before touching price.
