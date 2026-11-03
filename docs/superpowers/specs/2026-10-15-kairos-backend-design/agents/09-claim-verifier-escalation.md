# Agent spec: `claim-verifier-escalation` (the stronger second check, fail closed)

Revision 1, 2026-11-03 (WP-49). Status: design baseline (README section 2). Implements the `claim-verifier-escalation` rows of `01-architecture.md` B.9.2, B.9.6 and B.9.10 and `03-agent-runtime.md` 3.3, 9.4, 13.2 and 13.6. The wire format, verdict meanings, cache and shadow storage are those of `agents/08-claim-verifier.md` 3, 4 and 8; this file states only what differs.

**Built by.** WP-26, with the verifier. WP-41 calls it from prepare and `PATCH`; WP-36 reads the shadow audit (Autopilot freeze). **Today:** nothing exists; disabled planned entry in the registry (WP-49).

Stakes: high. Model `claude-sonnet-5-5`, effort low. Prompt version `claim-verifier-escalation@v1`.

---

## 1. Role and differences from `claim-verifier`

**Role.** Decide claims the verifier called `uncertain`, with a stronger model, and fail closed: anything it cannot decide is dropped.

| Aspect | `claim-verifier` | `claim-verifier-escalation` |
|---|---|---|
| Input | 1 to 40 claims | 1 to 15 `uncertain` claims, same schema (`ClaimVerifierInput`), same fact refs and target |
| Output | `ClaimVerifierOutput` | Same schema. `uncertain` is allowed but means "dropped as `unverified`" |
| On failure | Tier-up, then retry or 503 | `fail_closed`: the claim is dropped with rule `unverified`; never retried at the same call |
| Cache | Verdicts other than `uncertain` | Same: `supported`, `unsupported`, `contradicted` cached 24 h with `check_source = 'escalation'` |
| Who calls | Every path | Prepare, tailor route, drafts route and `PATCH`. **Not** builder suggestions: that route drops `uncertain` without escalation to bound latency (B.8.5 step 7) |

---

## 2. Callers, cap and the audit

| Caller | Context |
|---|---|
| `services/verify.ts` after a verifier call with `uncertain` items | `budgetClass` follows the caller; `call_kind` `primary` |
| Weekly shadow audit (WP-26 schedule; `03` 13.6): 2% of last week's `supported` prepare items re-judged | `call_kind = 'audit'`, `budgetClass: "ops"`; results stored as `verification_results` rows with `run_kind = 'audit'`, `check_source = 'audit'`, `outcome = 'audited'` |

**Daily cap** (B.9.6, `03` 9.4): escalated claims per UTC day at most 15% of the day's draft-size verifications; an email at 10%. Above the cap the call is refused before any spend and the claims are dropped `unverified`. The count comes from `llm_calls` (rows of this agent with `call_kind = 'primary'` against `claim-verifier` draft-size rows), read through the gateway's 10-second cached roll-up.

**Audit consequence.** An audit verdict of `unsupported` or `contradicted` on an item the verifier kept is an estimated false accept. Above 1% for a week the owner is paged and `ops_flags.autopilot_frozen` is set (B.9.6 control 5), which WP-36's guards read.

---

## 3. Prompt outline (`prompts/v1.md`)

The verifier's sections and examples, with three changes: the role says "you are the second, stronger check; your `uncertain` drops the claim, so use it only when the facts cannot settle it"; the examples are the hard ones (scope inflation, implied seniority, a number restated with a different unit); thinking `between_tools` with effort low lets the model reason before the verdict list.

---

## 4. Routing and envelope

| Item | Value |
|---|---|
| Model | `claude-sonnet-5-5`; no tier-up |
| `onFailure` | `fail_closed` (claim dropped `unverified`) |
| Thinking, effort | `between_tools`, low (S-A2 may change it, as a new prompt version) |
| `max_tokens` | 400 (15 verdicts of about 20 tokens plus overhead) |
| `maxInputTokens` | 2,500. Check: 2,500 x 2 + 400 x 10 = $0.009 under $0.012 |
| Timeout | 30 s; on `PATCH` the remaining part of the 8 s budget, else the edit is stored `stale` |
| Expected, max per call | $0.0045 / $0.012 |
| Envelope | $10 a day |
| Workspace, budget class, batch | `interactive`, follows the caller (audit `ops`), `never` |
| Cache | static 5m, `user: null` |

---

## 5. Checks

`preCheck`: at most 15 claims; the daily cap (section 2). `postValidate`: the verifier's V1 to V3.

---

## 6. Evaluation

`server/evals/claim-verifier-escalation/cases.jsonl`: the 60 hardest verifier cases (tag `hard`), chosen as the cases where Haiku's verdict was wrong or `uncertain` on the last verifier eval run, plus owner-labelled scope-inflation cases. Same `ClaimVerifierExpect`.

| Metric | Pass bar (B.9.10) |
|---|---|
| False accept | at most 0.5% |
| `uncertain` rate on gold-decidable claims | at most 15% (advisory: each one drops a true claim) |
| Injection claims judged supported without support | 0, three repeats |

---

## 7. Rollout

Built and gated with the verifier (WP-26). It runs in the same `verifier_mode` as the verifier on each path: in `shadow` its verdicts are recorded and drop nothing.
