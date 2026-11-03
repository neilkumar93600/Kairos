# Agent spec: `reply-classifier` (model fallback behind the rules)

Revision 1, 2026-11-03 (WP-49). Status: design baseline (README section 2); **the model fallback is deferred**. Implements the `reply-classifier` rows of `01-architecture.md` B.6.12, B.9.2, B.9.5 and B.9.10, `03-agent-runtime.md` 3.3, 10.2 and 11.5, and `workers/10-inbound-email.md` steps A5 to A8 and 3.3, which own the flow around the call. Format follows `agents/01-resume-parser.md`.

**Built by.** WP-24 builds the rules path (the kept regex set, a rules golden file of at least 200 cases including the 40 "offer you an interview" cases, `stripQuoted`, the linker) and keeps a **disabled** model hook in `classifyEmail` step A. The model fallback itself is deferred to WP-40 with the trigger "`other` above 30% of visible replies" (README 8), measured over 14 days. **Today:** rules only. `services/email-classifier.ts:7-22` (`classifyByRules`, offer guard first) and `jobs/classify-email.ts:42` (`?? "other"`); no model call, no redaction of the inbox path, `redactEmailBody` (`llm/redact.ts:44`) unused.

Stakes: medium. A kind moves the application's stage forward and drives notifications; it never changes `status`, credits or billing (`03` 11.5). Model `claude-haiku-5-5`. Prompt version `reply-classifier@v1`.

---

## 1. The rules-first contract

| # | Rule |
|---|---|
| R1 | Rules always run first on the subject and the first 4,000 characters of the normalized body; first match wins in the order offer, rejection, assessment, interview, confirmation (`workers/10` 3.3, `RULES_VERSION` 1). A rule change needs a version bump, a green golden file and an owner review |
| R2 | The model runs only when the rules return null, the row is visible (not hidden as spam or a forwarding confirmation), `spam_score` is null or below 5, the agent is enabled, and the step deadline leaves at least 25 s (`workers/10` A7) |
| R3 | **Offer is rules-only.** A model reply of `offer` resolves to `other`; the raw value is kept as `inbound_emails.model_kind` evidence and counted `inbound.model_offer_rejected`. Only a rule-tagged offer can create an offer-pause candidate (`inbound_emails_offer_needs_rule_ck`, WP-33). This keeps the only path to a billing pause deterministic |
| R4 | A model kind with `confidence` below 0.6 (`MODEL_MIN_CONFIDENCE`) resolves to `other` |
| R5 | A resolved kind moves `applications.stage` forward only and writes one `application_events` row with `source: "model"`; the tracker projector (WP-21) reads it. It never touches `status`, `credit_ledger`, `subscriptions` or `approveCore` |
| R6 | Deferral (`rate_limited`, `budget_stopped`, `agent_disabled`, outage) leaves `kind` null for the reconciler's model-only redrive; a final failure (`schema_invalid` after repair, `refusal`, `injection_echo`) resolves to `other` |

---

## 2. Input

```ts
// server/src/agents/reply-classifier/schema.ts
export const ReplyClassifierInput = z.object({
  /** redactContact(subject), the user's name replaced by [candidate], cut to 300 characters. */
  subject: z.string().max(300),
  /** redactEmailBody(body, { name }): quoted history and signature dropped, contact data redacted, 550 tokens. */
  excerpt: z.string().min(1).max(1_650),
}).strict();
```

Never sent (B.9.5): the sender address, the user's name, attachments, quoted history, the linked application or company. Both fields are T2 and fenced together as `<<DATA kind=email ...>>`; the task line is fixed text. No user block.

---

## 3. Output

```ts
export const ReplyClassifierOutput = z.object({
  kind: z.enum(EMAIL_KINDS),          // confirmation, rejection, interview, offer, assessment, other
  confidence: z.number().min(0).max(1),
}).strict();
```

Snapshot plan: 0 `anyOf`; `minimum` and `maximum` move into the description. `offer` stays in the enum so the model can say what it thinks (evidence for R3 and the eval), not so it can act.

---

## 4. Prompt outline (`prompts/v1.md`)

| Section | Content |
|---|---|
| Role | Reply Classifier: tag one employer email the rules could not tag |
| Kinds | One definition and two contrasting examples each; "offer you an interview" and "extend an offer to interview" are `interview`; a scheduling question is `interview`, not `rejection`; newsletters and job alerts are `other` |
| Confidence | How sure, 0 to 1; below 0.6 is treated as `other`, so say so honestly |
| Data rules | `DATA_RULES` |
| Examples | Four short synthetic emails, one per hard boundary (interview against offer, rejection against reschedule, assessment against interview, recruiter newsletter) |

---

## 5. Routing and envelope

| Item | Value |
|---|---|
| Model, tier-up | Haiku, none |
| `onFailure` | `defer` (R6) |
| Thinking | Disabled |
| `max_tokens` | 160 |
| `maxInputTokens` | 1,600. Check: 1,600 x 0.10 + 160 x 0.50 = $0.00024 under $0.0006 |
| Timeout | 20 s, inside the step's 90 s model budget |
| Expected, max per call | $0.0002 / $0.0006 |
| Envelope | $1 a day (about 1,850 calls at base, $0.37) |
| Workspace, budget class, batch | `batch`, `pipeline`, `never` (personal email text) |
| Cache | static 5m; `user: null` |

The Free plan's pipeline cap ($0.05 a day) applies; `workers/10` AR-5 asks for an exemption so replies are never left unclassified for budget reasons. Settle it when the fallback is built.

---

## 6. Checks

`preCheck`: `excerpt` non-empty after redaction. `postValidate`: none beyond the schema. Echo canary as everywhere; a hit resolves to `other` and counts `inbound.injection_suspect`.

---

## 7. Evaluation

`server/evals/reply-classifier/cases.jsonl`. A case runs the whole rules-then-model path on synthetic mail. `EvalCase<{ subject: string; body: string }, ReplyClassifierExpect>`:

```ts
interface ReplyClassifierExpect {
  kind: EmailKind;                 // the resolved kind
  source: "rule" | "model";        // which path should decide it
}
```

| Slice | Count |
|---|---|
| Mail the rules tag (regression guard for R1) | 150 |
| Mail the rules miss (varied wording, other languages' templates in English, ATS notices) | 210 |
| "We would like to offer you an interview" and variants | 40 |
| **Total** | **400** |

| Metric | Pass bar (B.9.10) |
|---|---|
| Resolved `offer` on the 40 interview-offer cases; raw model `offer` on them | 0; 0 |
| Macro F1 on the rule-miss slice | at least 0.90 |
| Rejection precision on the rule-miss slice | at least 0.95 (a false rejection hides a live process) |
| Rule-tagged slice unchanged | 100% |

---

## 8. Rollout

When the trigger fires (WP-40): build the agent folder, move the registry entry from `PLANNED_AGENTS` to `AGENTS`, wire `redactEmailBody`, pass the eval, enable the hook for 10% of users for 7 days, then all. Rollback: `agent_disabled:reply-classifier` (unclassified mail falls back to `other`, as today).
