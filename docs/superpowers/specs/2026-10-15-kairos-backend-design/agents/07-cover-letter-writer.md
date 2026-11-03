# Agent spec: `cover-letter-writer` v2 (at most four cited paragraphs)

Revision 1, 2026-11-03 (WP-49). Status: design baseline (README section 2). Implements the `cover-letter-writer` rows of `01-architecture.md` B.8.8, B.9.2, B.9.6 and B.9.10, `03-agent-runtime.md` 3.3 and 13.2, and `workers/04-prepare-application.md` step 3. Format follows `agents/01-resume-parser.md`.

**Built by.** WP-41 (prepare pipeline, truth repair) and the drafts route (`kind = "cover_letter"`, same package). WP-07 applies the 4-paragraph and 250-word caps to v1's gateway path first. **Today (v1):** input `{ facts[..60], job: { title, company, descriptionText (20,000) } }`, output `{ paragraphs[1..12]: { text (5,000), factIds } }` (`agents/cover-letter-writer/schema.ts:3-11`). The legacy branch of `services/draft-writer.ts` (lines 121-129) keeps at most 4 paragraphs and 250 words; the gateway branch (lines 100-105) does not, so `LLM_GATEWAY=anthropic` can return a 12-paragraph letter (gap llm-agents-48). The plan gate is in the route (`routes/applications.ts:119-121`, `coverLetters`).

Stakes: high. Model `claude-haiku-5-5`, tier-up `claude-sonnet-5-5`. Prompt version `cover-letter-writer@v2`.

---

## 1. Role and non-goals

**Role.** Write the body of a short cover letter (1 to 4 paragraphs, at most 250 words) in the user's voice about the fit between their confirmed facts and one job, each paragraph citing the facts it uses.

| Not done here | Who does it |
|---|---|
| Salutation, sign-off, the candidate's name or contact block | Nothing adds them: the letter fills a form field or is attached as plain paragraphs. Placeholders such as "[Your Name]" are refused |
| Praise of the company that no fact supports | Forbidden (v1 rule 4) |
| Deciding whether the plan includes letters | The route (`coverLetters`) and the prepare plan |
| Verification | Layers 1 to 3 after the call; paragraphs that fail are dropped, then one truth repair |

---

## 2. Callers

| Caller | Context |
|---|---|
| Prepare `generateAndVerify` (WP-41), only when the plan has `coverLetters` and the form has a letter field | `workspace: "interactive"`, `budgetClass: "pipeline"`, `onFailure` `tier_up_then_defer` |
| Prepare truth repair with `doNotClaim` | `callKind: "truth_repair"` |
| `POST /api/applications/:id/drafts` `kind = "cover_letter"` | `budgetClass: "interactive"`, `feature: "applicationDrafts"`, `onFailure` `tier_up_then_fail`; 422 `truth_lock` when no paragraph survives |

About 0.26 calls per prepared draft (`workers/04` 9).

---

## 3. Input

```ts
// server/src/agents/cover-letter-writer/schema.ts (v2)
export const CoverLetterInputV2 = z.object({
  facts: z.array(fact).min(1).max(60),          // B.9.7 retrieval: best coverage of the card's requirements
  job: z.object({ title: z.string().max(200), companyName: z.string().max(200) }).strict(),
  card: z.object({
    summary: z.string().max(600),
    mustHaves: z.array(z.string().max(80)).max(8),
    requirements: z.array(z.object({ text: z.string().max(200), required: z.boolean() }).strict()).max(12),
  }).strict(),
  doNotClaim: z.array(z.object({ text: z.string().max(700), rule: z.string().max(40) }).strict()).max(4).nullable(),
}).strict();
```

Facts are the shared per-user block; `job` and `card` are fenced (`job_card`), `doNotClaim` fenced (`claims`). The card replaces v1's raw description (B.9.5).

---

## 4. Output

```ts
export const CoverLetterOutputV2 = z.object({
  paragraphs: z.array(z.object({
    text: z.string().trim().min(20).max(700),
    factIds: z.array(z.string()).min(1).max(8),
  }).strict()).min(1).max(4),
}).strict();
```

Snapshot plan: 0 `anyOf`; `maxItems` 4 and the lengths move into descriptions and zod enforces them, so a fifth paragraph is a `schema_invalid` repair. Stored: `applications.cover_letter` (paragraphs joined by a blank line) and `cover_letter_citations` (`workers/04` request) with each paragraph's fact ids.

---

## 5. Prompt outline (`prompts/v2.md`)

| Section | Content |
|---|---|
| Role | Cover Letter Writer, as v1, at most 4 paragraphs and 250 words, strongest first |
| Truth rules | v1 rules 1 to 5, plus: no greeting, sign-off, name or placeholder; the company name and job title may be named, nothing else about the company unless a fact says it; repeat no `doNotClaim` text |
| Shape | Opening: why this role, from a fact; one or two paragraphs mapping facts to required requirements; an optional short close without a sign-off |
| Data rules | `DATA_RULES` |
| Output, Examples | v1's example; a rejected "I have always admired your culture"; a repair example where a dropped paragraph's invented number is removed |

---

## 6. Routing and envelope

| Item | Value (v1 unchanged) |
|---|---|
| Model, tier-up | Haiku; Sonnet 2%, `minDailyAllowance` 20, $0.02 |
| `max_tokens` | 1,000 |
| `maxInputTokens` | 5,000. Check: Haiku 5,000 x 0.10 + 1,000 x 0.50 = $0.001 under $0.0015; Sonnet 5,000 x 2 + 1,000 x 10 = $0.020, equal to $0.02 |
| Timeout | 45 s |
| Expected, max per call | $0.0006 / $0.0015 |
| Envelope | $7.50 a day |
| Workspace, budget class, batch | `interactive`, `pipeline` (route `interactive`), `never` |
| Cache | static 5m, user 5m |

---

## 7. Checks

`postValidate`:

| # | Check | On failure |
|---|---|---|
| CL1 | Every fact id is in `facts` (v1) | `unknown_fact_id` |
| CL2 | Total words at most 250 | `too_long` (repair) |
| CL3 | No line that is only a greeting or sign-off ("Dear ...", "Sincerely", "Best regards", "Thank you for your consideration" alone); no bracket placeholder | `salutation`, `placeholder` |
| CL4 | No URL, email or phone | `contact_in_letter` |
| CL5 | With `doNotClaim`: no paragraph repeats a dropped text or its failing number or entity | `repeats_dropped_claim` |
| CL6 | Echo canary | `injection_echo` |

After the call: layer 1, `checkClaims` per paragraph (company name and job title allowed, `agents/06-answer-drafter.md` request 2), `claim-verifier` per paragraph with escalation, then one truth repair for dropped paragraphs. If none survives: prepare stores no letter (the field stays empty and `draft_issue` names it); the route returns 422 `truth_lock`.

---

## 8. Evaluation

`server/evals/cover-letter-writer/cases.jsonl`. `EvalCase<CoverLetterInputV2, CoverLetterExpect>` with `interface CoverLetterExpect { mustNotClaim: string[]; maxWords: 250 }`.

| Slice | Count |
|---|---|
| Personas x postings (thin, typical and fact-rich users) | 70 |
| Injection in card text or facts, with clean twins | 30 |
| **Total** | **100** |

| Metric | Pass bar |
|---|---|
| Unsupported claims stored after layers 1 to 3 | 0 on every case |
| Over 250 words or over 4 paragraphs after post-checks | 0 |
| Rubric (judge): specific to the job, plain, no flattery, user's voice | at least 4 of 5 on 90% |
| Injection twin | no extra claims; three repeats |

---

## 9. Rollout

v2 changes the input (card instead of description): two-object rule of `agents/03-fit-scorer.md` 9. Until WP-41, v1 runs with WP-07's caps; `cover_letter_citations` lands with WP-41.
