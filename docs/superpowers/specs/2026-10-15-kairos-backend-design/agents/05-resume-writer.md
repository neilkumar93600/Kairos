# Agent spec: `resume-writer` v2 (builder suggestions with level, tag, priority and headline)

Revision 1, 2026-11-03 (WP-49). Status: design baseline (README section 2). Implements the `resume-writer` rows of `01-architecture.md` B.8.5, B.9.2 and B.9.10, `03-agent-runtime.md` 3.3 and 13.2, and PRD R3 (`../2026-10-29-resume-suite/README.md` 5 rules 9 and 10, 8.1 to 8.4, 12). Format follows `agents/01-resume-parser.md`.

**Built by.** WP-31 (R3 writer v2): level input, tag and priority outputs, the headline scope with years computed in code, Fix-spelling suggestions, deterministic post-checks for every refine mode, the eval extended to every level. The verifier on suggestions arrives with WP-26. **Today (v1):** `server/src/agents/resume-writer/` on Sonnet with effort by scope (`spec.ts:22`); input `{ scope, refine, resumeView, facts[..60], noteFact, job, maxSuggestions }`, output `suggestions[]` without `before`, tag or priority (`schema.ts:19-32`). `services/resume-writer.ts#verify` (line 168) already fills `before` from the document (line 177), checks ids and citability, runs `inventedDetails` and the `shorter` rule (line 200); `longer` and `use_numbers` are not checked in code. `SUGGESTION_SCOPES` has no `headline`; WP-16 added `RESUME_SUGGESTION_SCOPES`, `RESUME_LEVELS`, `SUGGESTION_TAGS`, `SUGGESTION_PRIORITIES` and `resumeSuggestionSchema.tag`, `priority` and `derived` in `shared/src`.

Stakes: high (accepted lines become the resume). Model `claude-sonnet-5-5`, no tier above it in production. Prompt version `resume-writer@v2`.

---

## 1. Role and non-goals

**Role.** Propose edits to one scope of the user's resume (line, entry, section, summary, skills, the whole resume, or the headline), calibrated to the user's experience level, each tagged with what it improves and how much it matters, citing only confirmed facts or the user's own new note.

| Not done here | Who does it |
|---|---|
| Computing a derived value (years of experience) | Code, from confirmed role dates (PRD rule 10). The model only chooses whether to append it (section 4) |
| Applying an edit | The user accepts; `PUT /resumes/:id` with the document truth lock |
| Length, page and lines-per-entry thresholds by level, clichés, tense, repeated words | The deterministic Resume check (PRD 8.1, 8.2). The level changes only the advice the model gives |
| Verifying claims | Service checks and `claim-verifier` (B.8.5 steps 6 and 7; no escalation on this route) |
| Suggestions for a tailored copy that was sent | Refused by the route (409 `read_only`) |

---

## 2. Callers

`POST /resumes/suggestions` (and the `/api/resume/suggestions` alias) through `suggestEdits`: allowance `resumeSuggestions` (1 unit, 4 for scope `resume`), `before_ai` revision under the 10-minute rule, then the call. `budgetClass: "interactive"`, `workspace: "interactive"`, `onFailure: "fail_closed"` (503 `ai_unavailable`, allowance refunded). Latency target p50 6 s and p95 14 s for line, entry and headline; p95 30 s for resume (B.8.5).

---

## 3. Input

```ts
// server/src/agents/resume-writer/schema.ts (v2); additions to v1 marked
export const ResumeWriterInputV2 = z.object({
  scope: z.enum(RESUME_SUGGESTION_SCOPES),                  // v2: adds "headline"
  refine: z.enum(REFINE_OPTIONS).nullable(),
  level: z.enum(RESUME_LEVELS),                             // v2: the resume's stored level, or the request's
  resumeView: z.string().min(1).max(12_000),
  facts: z.array(fact).max(60),
  noteFact: fact.nullable(),
  job: z.object({ title: z.string().max(200), company: z.string().max(200), descriptionText: z.string().max(20_000) }).nullable(),
  /** v2, headline scope only: the current headline, or null. */
  headline: z.string().max(160).nullable(),
  /** v2, headline scope only: values computed in code (rule 10). Today one: years of experience. */
  derived: z.array(z.object({ label: z.literal("years_of_experience"), value: z.number().int().min(1).max(60), factIds: z.array(z.string()).min(1) }).strict()).max(1),
  maxSuggestions: z.number().int().min(1).max(20),
}).strict();
```

The task line (T1, written by code) carries the scope text, the refine text and the level emphasis from PRD 8.1: early career "projects, coursework, skills shown in use"; mid-level "outcomes per role"; senior "scope, ownership, outcomes"; lead "scope, teams, outcomes, leadership". Facts, the view, the note and the job are fenced as in v1 (`render.ts`). The derived value is **not** rendered: the model sees only "a years-of-experience value is available" or not, so it cannot copy or alter the number.

Never sent: contact details, unconfirmed facts other than the note, tracker notes, salary text and contacts (PRD rule 12).

---

## 4. Output

```ts
export const ResumeWriterOutputV2 = z.object({
  suggestions: z.array(z.object({
    sectionId: z.string(),                 // "headline" for the headline scope
    entryId: z.string().nullable(),
    lineId: z.string().nullable(),
    action: z.enum(["rewrite", "add", "remove"]),
    after: z.string().nullable(),
    why: z.string(),
    factIds: z.array(z.string()),
    needsFact: z.object({ kind: z.enum(FACT_KINDS), question: z.string() }).nullable(),
    tag: z.enum(SUGGESTION_TAGS),          // v2
    priority: z.enum(SUGGESTION_PRIORITIES), // v2
    appendYears: z.boolean(),              // v2: headline only; true asks the server to append the derived years
  }).strict()),
}).strict();
```

Snapshot plan: v2 `schema.snap.json` by `agents:snap`; 4 `anyOf` nodes as in v1; lengths stay out of the schema and are enforced by the service, as v1 does (`schema.ts:18`).

Server mapping to `resumeSuggestionSchema`: `id` a fresh ULID; `before` from the document (`lineId`), or the current headline for a headline `rewrite`; for `appendYears: true` the server appends ` · {value} years` to `after` and sets `derived: [{ label: "Years of experience", value, factIds }]` (the shape of the WP-16 QA mock, `web/scripts/qa/mock-suite.mjs:292-294`). Headline suggestions use `sectionId: "headline"`, `entryId` and `lineId` null, `action` `add` (no headline yet) or `rewrite`.

This settles the `before` conflict of gap-map specGaps: B.9.2 lists `before` as model output; the model never echoes it, the server fills it (as for the parser's spans).

---

## 5. Prompt outline (`prompts/v2.md`)

| Section | Content |
|---|---|
| Role | As v1: a strict editor with one source, the confirmed facts |
| Truth rules | v1 rules 1 to 5, plus: (6) the level changes what you favour, never what you may claim; a senior review may stress scope only when a fact states it, else ask with `needsFact` (PRD rule 9); (7) never write a number of years of experience; set `appendYears` when a years value is available and the headline should show it (PRD rule 10); (8) no placeholders such as "[X]%" |
| Tags | One per suggestion, from the seven PRD 8.3 tags, with one line each on when it applies; `fix_spelling` only for a `rewrite` that changes spelling or grammar and nothing else |
| Priority | `high` for edits that change what a screener sees first (missing outcomes, the summary, the top lines of recent roles), `medium` for most, `low` for polish |
| Headline | At most 3 options, each a role and up to 3 skills from facts, at most 160 characters, separated by " · " |
| Data rules | `DATA_RULES` |
| Output, Examples | v1's three examples with tags and priorities, plus a headline example with `appendYears: true`, and a senior-level example that returns `needsFact` for team size |

---

## 6. Routing and envelope

| Item | Value (v1 unchanged unless marked) |
|---|---|
| Model | `claude-sonnet-5-5`; tier-up none; `onFailure: "fail_closed"` |
| Thinking, effort | `between_tools`; effort `low` for line, entry and **headline** (v2), `medium` otherwise |
| `max_tokens` | 800 for line, entry and headline; 2,600 otherwise |
| `maxInputTokens` | 12,000. Check: 12,000 x 2 + 2,600 x 10 = $0.050, equal to the $0.05 max |
| Timeout | 60 s |
| Expected, max per call | $0.0112 blended / $0.05 |
| Envelope | $50 a day |
| Workspace, budget class, batch | `interactive`, `interactive`, `never` |
| Cache | static 5m, user 5m |

---

## 7. Checks

`postValidate` (pure):

| # | Check | On failure |
|---|---|---|
| W1 | Fact ids in `facts` or equal to `noteFact.id` (v1) | `unknown_fact_id` |
| W2 | Action shape: rewrite and remove need `lineId`; add has `lineId` null; remove has `after` null and `factIds` []; `needsFact` set means `after` null | `bad_action_shape` |
| W3 | Headline scope: every suggestion has `sectionId` "headline", `entryId` and `lineId` null, at most 3; other scopes never use "headline" and always have `appendYears` false | `bad_headline_shape` |
| W4 | `appendYears` true only when `derived` holds a years value | `append_without_value` |
| W5 | **No model-stated years.** No `after` matches `\b\d+\s*\+?\s*(years?|yrs?)\b` | `model_stated_years` |
| W6 | `tag = fix_spelling` only with `action = rewrite` | `bad_tag` |
| W7 | No bracket placeholder (`[X]`, `[number]`) in `after` | `placeholder` |
| W8 | Echo canary | `injection_echo` |

Service checks in `verify()` (a failing suggestion is dropped, not repaired): ids exist in the document (v1); citable facts (v1); `checkClaims` against the cited facts (v1 uses `inventedDetails`; WP-07 moves it to `llm/claims.ts`); refine compliance for every mode (`shorter` shorter than `before`, `longer` longer, `use_numbers` contains a number from a cited `metric` fact, `result_first` and `natural` judged in evals only); `fix_spelling` keeps the line's own fact ids and changes at most 15% of characters (normalized edit distance) with no new number, entity or skill; `after` at most 300 characters for lines and 160 for headlines. Then `claim-verifier` on every suggestion with text (WP-26).

---

## 8. Evaluation

`server/evals/resume-writer/cases.jsonl`. `EvalCase<ResumeWriterInputV2, ResumeWriterExpect>`:

```ts
interface ResumeWriterExpect {
  scope: string;
  level: ResumeLevel;
  refine?: RefineOption;
  mustNotClaim: string[];
  needsFactExpected: boolean;
  tags?: SuggestionTag[];      // labelled tags for the target, for tag accuracy
  headlineYears?: number;      // the code-computed value, headline cases
}
```

| Slice | Count |
|---|---|
| v1 builder cases (scopes x refine options), level `mid` | 150 |
| The same 10 seed resumes at each of the four levels | 40 |
| Headline cases (with and without derived years, no role fact) | 20 |
| Fix-spelling cases | 20 |
| **Total** | **230** |

| Metric | Pass bar |
|---|---|
| Invented-detail rate (a line adding a number, tool or employer not in its facts), at every level | 0 (WP-31 acceptance) |
| Refine compliance after post-checks | 100% |
| Model-stated years; headline year count equal to `headlineYears` after the server appends | 0; 100% |
| Tag accuracy against labels | at least 0.80 |
| Rubric (judge) | at least 4 of 5 on 90% |
| Injection twin (note or view carrying instructions) | unchanged targets, no extra claims |

---

## 9. Rollout

v2 changes input and output, so it follows the two-object rule of `agents/03-fit-scorer.md` 9: `resumeWriterV2` serves `POST /resumes/suggestions`; the legacy `/resume/suggestions` alias passes `level` from the stored resume and maps tags through. Drafting agents may canary (`03` 4.5): 10% for 3 days, then 100%, gated on the edit-acceptance rate not dropping by more than 5 points. Rollback is the route's version switch.
