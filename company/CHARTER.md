# Charter

## Mission

Job applications you would sign: Kairos applies only to jobs that fit, writes only what the candidate confirmed, and sends nothing without their approval.

## Goal

**$10,000 MRR as fast as possible.** Every task in `QUEUE.md` must move one of the levers below, or it waits.

## The math

Assumptions until launch. `/ceo` replaces them with real numbers once paying users exist. Prices are from `docs/pricing.md` / `shared/src/plans.ts`; everything else here is a guess.

| Input | Assumption | Why |
|---|---|---|
| Prices | Starter $19 / mo, Pro $39 / mo, Max $79 / mo (weekly and quarterly also sold) | `shared/src/plans.ts` |
| Plan mix | 60% Starter / 30% Pro / 10% Max | Pro's cloud applier is the main upgrade; Max is for heavy searchers |
| Blended ARPU | **≈ $31 per paying user / mo** | 0.6 × 19 + 0.3 × 39 + 0.1 × 79, monthly-equivalent |
| Paying users needed | **≈ 325** | $10,000 ÷ $31 |
| Free → paid | 5% | the free grant is 25 applications once — it runs out fast |
| Monthly churn | 30% total, of which ≤ 10% unhappy | searches last 1–3 months (PRD); billing pauses on an offer, so much churn is success |
| Signups needed | **≈ 11,000 over 6 months** (~90 / day by month 6) | ramp below |

### Ramp — target: 6 months after launch

| Month after launch | Paying users | MRR | New paid needed (growth + churn) | Signups needed at 5% |
|---|---|---|---|---|
| 1 | 40 | ~$1,200 | 40 | 800 |
| 2 | 90 | ~$2,800 | 62 | 1,240 |
| 3 | 150 | ~$4,700 | 87 | 1,740 |
| 4 | 210 | ~$6,500 | 105 | 2,100 |
| 5 | 270 | ~$8,400 | 123 | 2,460 |
| 6 | 325 | ~$10,100 | 136 | 2,720 |

<!-- ponytail: flat-rate model, no cohort lag, monthly-equivalent ARPU. Swap for cohort data after 60 days live. -->

High churn by design means acquisition never stops: at goal, ~100 users leave every month, most of them because they got a job. Track success churn (offer pause) and unhappy churn separately.

### Levers — pull the cheapest first

| Lever | Target | Why it matters | Owners |
|---|---|---|---|
| Activation — % of signups who approve their first application within 24 h | ≥ 40% (assumption) | nothing converts before the first approved application | onboarding-designer, review-queue-engineer, resume-engineer, ux-researcher |
| Free → paid | ≥ 5% | 6% instead of 5% = ~17% fewer signups needed | growth-hacker, billing-engineer, pricing-strategist |
| ARPU | ≥ $31 | more Pro (cloud applier) lifts it most | pricing-strategist, growth-hacker |
| Unhappy churn | ≤ 10% / mo | match quality and billing trust are the PRD's top complaints about rivals | ai-quality-evaluator, feedback-synthesizer, support-responder, customer-success-manager |
| Traffic — signups / day | ~90 / day by month 6 | the top of everything above | seo-strategist, ai-search-strategist, linkedin-strategist, reddit-community-builder, tiktok-strategist, youtube-strategist, partnerships-manager |
| Gross margin | ≥ 70% per paid plan | ~$0.01 model + compute per submitted application is an estimate (`docs/pricing.md`); measure it | finance-tracker, cost-optimizer |
| Submit success | ≥ 95% on supported ATSs (PRD) | failed submissions earn nothing and cost trust | applier-engineer, extension-engineer, ats-integration-engineer |

## Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Paid beta live | production release, extension live on the Chrome Web Store, Stripe live, first paying user |
| M1 | $1k MRR | ~32 paying |
| M2 | $3k MRR | ~97 paying |
| M3 | $5k MRR | ~161 paying |
| M4 | **$10k MRR** | ~325 paying |

## Plan by phase

**Phase 0 — Finish v1 and release (now → M0).** Close `docs/06-implementation-plan.md` (quality: security pass, observability, end-to-end journey; release: staging and production with rollback, Chrome Web Store, launch gates and beta). Ship what is built on local branches. In parallel: waitlist and beta survey, build-in-public on LinkedIn and X, comparison pages drafted.

**Phase 1 — Beta launch (M0 → M1).** Disclosed posts in OPT, new-grad and layoff communities, LinkedIn launch, university international-student offices. Fix whatever beta users hit, daily. Test prices with the beta survey (`docs/pricing.md`).

**Phase 2 — Compound (M1 → M3).** Comparison pages ("Tsenta alternative", "LoopCV alternative"), AI-search visibility, weekly outcome report (Pro, Max), referral credits, upgrade prompts when the free 25 run out.

**Phase 3 — Scale (M3 → M4).** Partner program for career coaches, bootcamps and student communities; quarterly-plan push; regional pricing for India (PRD: later); retention work on top unhappy-churn reasons; Workday and iCIMS if terms allow.

## Org

```
Founder (you)
├── Board ............ CEO · CFO · CPO · CMO · CTO · General Counsel perspectives + critic
└── CEO .............. main session, /ceo — the only one who talks to you
    ├── CTO .......... engineering (24) · testing (8) · security (3)
    ├── CPO .......... product (8) · design (5) · customer (3)
    ├── CMO .......... marketing (22) · brand (3)
    ├── CFO .......... finance (9)
    ├── General Counsel legal (7)
    ├── Critic ....... challenges big plans before they run
    └── HR Director .. hr (2) — watches every agent
```

102 agents + the CEO. Full list and status: `ROSTER.md`.

- **How work flows:** you ask the CEO → the CEO splits it into one objective per department → each head returns micro-tasks with exclusive file ownership → the CEO dispatches them in waves → heads review their team's output → HR scores everyone → the CEO reports back to you.
- **Why the CEO dispatches:** subagents can't start other agents, so heads plan and review, and the CEO (main session) runs everyone.
- **Where things live:** who owns what → `ROSTER.md`. Agent reports → `inbox/`. Board memos → `board/`. HR scorecard and archived agent configs → `hr/`.

## Operating rules

1. `/ceo <request>` handles anything you ask. `/ceo` with no request runs the daily cycle — scan → triage → fix → analyze → plan.
2. Priority: **P0** broken core flow, an invariant broken (fit gate, truth lock, approval, credits), money wrong, security hole, data loss. **P1** blocks the next milestone. **P2** everything else.
3. Done means evidence: test output, numbers, links. No evidence, not done.
4. Max 15 agent dispatches per `/ceo` run — heads, critic, reviews and HR included (cost cap). Change the number here if needed.
5. **Needs a human — never done unattended:** pushing or merging to `main`, production deploys, submitting a real application to a real employer, Chrome Web Store submission, spending money, publishing or sending anything outside (posts, emails, DMs), Stripe live mode, deleting user data, price changes, legal documents. Agents draft; a human approves.

## HR policy

1. **Strike** = one verified problem with an agent's work, from: a peer note with evidence, a head's REWORK or REJECT, a P0/P1 bug traced to its task, or a guardrail breach. `performance-auditor` checks the evidence; unverified notes don't count.
2. **Suspend** when any of: 3 strikes from 2+ different sources in 14 days · 2 P0 bugs in 14 days · any guardrail breach (immediately). Suspended agents get no work; their head reassigns open tasks.
3. **Rehire:** HR names the root cause; `agent-recruiter` writes the replacement config. The CEO archives the old file to `hr/archive/<agent>-<date>.md`, installs the new one, status `probation`. The `## Company rules` and `## Project context` sections must stay identical.
4. **Probation:** 14 days with no strikes → `active`. Any strike → suspended again, and the founder decides whether to merge, split or drop the role.
5. **Fair play:** bad-faith or repeatedly unverified peer notes are a strike against the writer. Overlapping OWNS is a planning failure — fix the head's plan, not the agent.
6. Every HR action goes in the ledger and the CEO's report. The founder can roll back any rehire from the archive.

## Board

Meets at each milestone, monthly, and whenever the CEO escalates (pricing, pivots, big spend, anything irreversible). Runs `c-level-agents:boardroom` with CEO, CFO, CPO, CMO, CTO and General Counsel perspectives plus a critic. Memos go to `board/`. The board advises; the founder decides anything irreversible.
