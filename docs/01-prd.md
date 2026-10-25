# 1. Product Requirements Document (PRD)

Kairos v1 · Gray Matter Labs · last updated 2026-10-13

## Product name and one-sentence idea

**Kairos**: an AI job application agent that applies only to jobs that fit, tailors resumes only from facts the user confirmed, and sends nothing until the user approves it.

## Target users

| Segment | Who they are | What they need |
| --- | --- | --- |
| US OPT and STEM OPT students and new grads | International students racing an OPT clock; apply to 200 to 400 jobs per cycle | Volume without spam, sponsorship-aware filtering, speed on new postings |
| Laid-off tech workers in the US | Mid-level engineers, PMs and analysts searching for 1 to 3 months | Fewer, better applications; billing that stops when they get the job |
| Indian job seekers applying to US-listed roles | Same tools, paying from India | The same product; regional pricing later |

## Problem and current workaround

Applying by hand takes 15 to 30 minutes per application, mostly retyping the same fields into Workday, Greenhouse and Lever forms. Auto-apply tools (Tsenta, LoopCV, Jobright, AIApply, Massive, Sprout) solve speed but users report:

- matches that do not fit ("only about 1% of the jobs shown actually matched")
- a review step without an edit step
- resumes with skills and metrics the user does not have
- hundreds of applications and zero interviews
- broad Gmail access that ended in a locked Google account
- charges after cancelling, lost credits and ignored refunds

Sources and figures: see the Kairos v1 build plan doc, sections "The pick" and "What users complain about".

## Goal and success measures

Goal: a paid beta where users trust what goes out under their name.

| Measure | Target for public launch | How we measure it |
| --- | --- | --- |
| Match approval rate | 70% of suggested matches are queued, not skipped | matches.status over 14 days |
| Submit success on supported ATSs | 95% of approved applications submit | applications submitted / (submitted + failed) |
| Truth lock violations reaching review | 0 | automated check on every tailored draft |
| Billing complaints | under 1% of paying users open a billing ticket | support tags |
| Free to paid conversion | measured in beta, no target yet | Stripe + ledger |

## Core features

| Feature | User benefit | Priority |
| --- | --- | --- |
| Job discovery from public Greenhouse, Lever and Ashby boards | Sees new postings within 30 minutes (5 on Max) | P0 |
| Fit gate: hard filters, then a model score with written reasons | Only jobs worth applying to reach the queue | P0 |
| Truth-locked tailoring | Every resume line cites a confirmed fact | P0 |
| Review and edit queue | Edit any field, line or cover letter, then approve one or a batch | P0 |
| Chrome extension apply | Fills the employer's own form in the user's browser; receipt saved | P0 |
| Cloud applier | Pro and Max: sends approved applications with the browser closed | P0 |
| Reply tracking by forwarding address | No Gmail access needed; replies tagged to applications | P0 |
| Honest billing | One credit per successful submission; failed submits free; auto-pause on offer | P0 |
| Email + password, email OTP, Google sign-in | Familiar sign-in that works | P0 |
| Answer memory | Answers to recurring questions saved after user approval | P1 |
| Weekly outcome report | Callback rate by role and resume; targeting suggestions | P1 |
| Per-company cap | At most 2 applications per company per 30 days by default | P1 (built) |
| Sponsorship filter | Skips postings that say they do not sponsor | P1 (built in fit gate) |
| Workday and iCIMS support | More employers covered | P2 |
| WhatsApp approvals | Approve matches from the phone | P2 |

## Out of scope for v1

- LinkedIn Easy Apply automation (LinkedIn's user agreement bans bots)
- Storing employer account passwords (Workday tenants)
- Emailing recruiters on the user's behalf
- Mobile apps
- Indian job boards (Naukri, Indeed India)

## User stories

1. As a new grad on OPT, I want to set my roles, seniority and visa needs once, so I only see jobs I could get.
2. As a job seeker, I want to see why each job matched, so I can trust the queue.
3. As a job seeker, I want to edit every answer and resume line before sending, so nothing goes out that I would not write.
4. As a job seeker, I want tailored lines to come only from my real experience, so I never have to defend an invented skill in an interview.
5. As a job seeker, I want approved applications to be sent from my browser, so I stay in control of my accounts.
6. As a Pro user, I want approved applications to send while my laptop is closed, so new postings get my application early.
7. As a job seeker, I want a receipt of every field that was sent, so I know exactly what each employer has.
8. As a job seeker, I want employer replies sorted by meaning, so I see interviews first.
9. As a paying user, I want to be charged only for applications that went through, so failures do not cost me.
10. As a user who got a job, I want billing to pause when the offer arrives, so I am not charged again.

## Acceptance criteria

1. Given a new account, when sign-up completes, then the user has a profile, a free plan, a forwarding address and a +25 free credit ledger entry. *(verified end to end)*
2. Given an unverified email, when the user signs in, then they are sent to the code screen and protected API routes return 403 `email_unverified`.
3. Given a job titled "Senior Software Engineer" and preferences seniority = entry, when the fit gate runs, then the job is dropped with reason "Title is more senior than you asked for". *(unit test)*
4. Given a user who needs sponsorship and a posting that says "unable to sponsor", when the fit gate runs, then the job is dropped. *(unit test)*
5. Given 2 applications to a company in the last 30 days and a cap of 2, when a new posting from that company arrives, then it is not matched. *(unit test)*
6. Given a tailored line citing a fact id the user does not own, when the draft is saved, then the API returns 422 `truth_lock` and nothing is stored. *(unit test on enforceTruthLock; route wired)*
7. Given 3 available credits, when the user approves 5 drafts, then the API returns 402 and no draft changes status.
8. Given a free-plan user, when they approve for the cloud channel, then the API returns 403 "The cloud applier is on Pro and Max". *(verified end to end)*
9. Given an approved application, when the extension reports `submitted` twice, then exactly one credit is charged. *(verified end to end)*
10. Given an approved application, when the extension reports `failed`, then no credit is charged and the failure reason is shown. *(verified end to end)*
11. Given a form with required fields the filler cannot answer, when the filler runs with submit = true, then it does not click submit and reports the count of empty required fields. *(unit test + live Greenhouse, Lever and Ashby forms)*
12. Given a forwarded email containing "pleased to offer", when it is classified, then it is tagged `offer` and an active Stripe subscription is paused.
13. Given a redelivered Stripe webhook, when it arrives, then it is ignored (stripe_events idempotency).
14. Given a weekly Starter invoice, when it is paid, then 234 credits are granted (1,000 × 7 / 30, rounded up). *(unit test)*
15. Given a Greenhouse board on a custom domain, when jobs are polled, then each apply URL points at the Greenhouse embed form, not the employer's careers page. *(unit test + live board)*

## Open questions

- Domain: is `kairos.app` available, or which domain do we use? All configs assume it.
- Which LLM provider and models for scoring and tailoring? Cost per application must stay near 1 cent.
- Seed list: which 2,000 companies first? Proposal: US tech and fintech boards on Greenhouse, Lever and Ashby with new-grad roles.
- Stripe account: is it active for USD subscriptions from your entity? INR pricing depends on it.
- Legal review of terms, privacy, cookies and refunds before launch.
