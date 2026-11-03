# Agent spec: `resume-tailor` v2 (suggestion mode against a resume)

Revision 1, 2026-11-03 (WP-49). Status: design baseline (README section 2). Implements the `resume-tailor` rows of `01-architecture.md` B.8.5, B.9.2, B.9.7 and B.9.10, `03-agent-runtime.md` 3.3 and 13.2, `workers/04-prepare-application.md` step 3, and PRD 6.2 (the pipeline's tailoring is written into the tailored copy). Format follows `agents/01-resume-parser.md`. WP-49's package text does not list this agent, but WP-20 and WP-41 depend on it, so its acceptance needs it.

**Built by.** WP-41 (prepare pipeline, suggestion mode, truth repair) and the tailor route of WP-17 (`POST /resumes/tailor`, which saves the copy, PRD 11, with `tailor_cache`). **Today (v1, legacy mode):** input `{ facts[1..60], job: { title, companyName, descriptionText (20,000) } }`, output `{ lines: ResumeLine[1..60] }` (`agents/resume-tailor/schema.ts:4-20`), called only by `jobs/tailor-application.ts:30` with no call context. The tailor route does **not** use this agent: `routes/jobs.ts:112-124` calls `suggestEdits` (`resume-writer`, Sonnet) with scope `resume`. `services/tailor.ts:51` applies only the id check (`enforceTruthLock`), not `inventedDetails` (WP-07 adds it).

Stakes: high (lines go to employers). Model `claude-haiku-5-5`, tier-up `claude-sonnet-5-5`. Prompt version `resume-tailor@v2`.

---

## 1. Role and non-goals

**Role.** Given one resume (the base revision, or the user's default document) and one job card, propose up to 20 edits that make the resume fit the job using only the user's confirmed facts: `rewrite` a line toward a covered requirement, `add` a line from a fact the resume does not print yet, `remove` a line unrelated to the job.

| Not done here | Who does it |
|---|---|
| Lines for requirements the user has no fact for | The server adds a deterministic `needsFact` question for each required requirement F1 marks `missing` (B.8.5 step 3). A job keyword the user lacks becomes a question, never a line |
| Choosing which facts to send | Deterministic retrieval, at most 60 (B.9.7) |
| Verifying claims | Layers 1 to 3 after the call (B.9.6): ids owned and confirmed, `checkClaims`, `claim-verifier` |
| Applying edits, saving the copy, revisions | Prepare step 6 and the tailor route; `before_tailor` revision first (PRD 6.1) |
| Tags and priorities | Set by the server: tag `stay_relevant`; priority `high` when the suggestion covers a required requirement, else `medium` |
| A resume with no base | Legacy mode is retired. With no base resume, the server builds `defaultResume(facts, contact)` (`services/resume-doc.ts:30`) and tailors that document. PRD 6.2: every draft has a tailored copy |

---

## 2. Callers and volume

| Caller | Context |
|---|---|
| Prepare `generateAndVerify` (WP-41), skipped when the user's own lines landed first | `workspace: "interactive"`, `budgetClass: "pipeline"`, `onFailure` `tier_up_then_defer` |
| Prepare truth repair (`callKind: "truth_repair"`) with `doNotClaim` | Same; only the repaired items are re-verified |
| `POST /resumes/tailor` (and the `/api/jobs/:jobId/tailor` alias) on a `tailor_cache` miss | `budgetClass: "interactive"`, `feature: "jobTailor"`, `onFailure` `tier_up_then_fail` (503 `ai_unavailable`) |

About 1 call per prepared draft (`workers/04` 9), $0.00082 each.

---

## 3. Input

```ts
// server/src/agents/resume-tailor/schema.ts (v2)
const fact = z.object({ id: z.string(), kind: z.enum(FACT_KINDS), text: z.string().min(1).max(400) }).strict();

export const ResumeTailorInputV2 = z.object({
  /** The document rendered by the server with [s-...], [e-...] and [ln-...] id tags, as resume-writer's view. */
  resumeView: z.string().min(1).max(12_000),
  facts: z.array(fact).min(1).max(60),
  job: z.object({ title: z.string().max(200), companyName: z.string().max(200) }).strict(),
  card: z.object({
    summary: z.string().max(600),
    mustHaves: z.array(z.string().max(80)).max(8),
    /** F1 status per requirement; `missing` ones are left out, so the model is never asked to cover them. */
    requirements: z.array(z.object({
      ref: z.string(), text: z.string().max(200), required: z.boolean(), status: z.enum(["covered", "unconfirmed"]),
    }).strict()).max(25),
  }).strict(),
  /** Truth repair only: items the verifier or checkClaims dropped, with the failing rule. Held in memory, never stored. */
  doNotClaim: z.array(z.object({ text: z.string().max(400), rule: z.string().max(40) }).strict()).max(20).nullable(),
  maxSuggestions: z.number().int().min(1).max(20),
}).strict();
```

| Data | Trust | Where |
|---|---|---|
| Static `v2.md` | T0 | Breakpoint 1 |
| `facts` (sorted `(kind priority, id)`) | T2 | Per-user block, `userBlockNonce`, breakpoint 2, shared with `answer-drafter` and `cover-letter-writer` in the same draft |
| `maxSuggestions`, the repair notice | T1 | Task line |
| `resumeView`, `job`, `card`, `doNotClaim` | T2 | Fenced per call (`resume_lines`, `job_card`, `claims`) |

Never sent: contact details (the view omits the contact block), unconfirmed facts, the raw description, tracker notes, salary text, contacts (PRD rule 12).

---

## 4. Output

```ts
export const ResumeTailorOutputV2 = z.object({
  suggestions: z.array(z.object({
    action: z.enum(["rewrite", "add", "remove"]),
    sectionId: z.string(),
    entryId: z.string().nullable(),
    lineId: z.string().nullable(),
    after: z.string().max(400).nullable(),
    why: z.string().max(300),
    factIds: z.array(z.string()).max(8),
    /** Card requirement refs the edit serves; [] for remove. */
    requirementRefs: z.array(z.string()).max(4),
  }).strict()).max(20),
}).strict();
```

Snapshot plan: v2 `schema.snap.json` by `agents:snap`; 3 `anyOf` nodes; bounds in descriptions. `before` is not model output: the server copies it from the document by `lineId` (the same choice as `resume-writer`, `services/resume-writer.ts:177`).

---

## 5. Prompt outline (`prompts/v2.md`)

| Section | Content |
|---|---|
| Role | Resume Tailor: edit one resume toward one job using only confirmed facts. The user reviews every edit |
| Truth rules | Every `rewrite` and `add` cites at least one fact id; no number, employer, title, date, tool, degree or scope absent from the cited facts; never address a requirement the card does not list (missing ones were removed on purpose); never reuse a `doNotClaim` text or its failing detail; lines in plain words, no first person, at most 400 characters |
| Edits | When to rewrite, add, remove; one suggestion per line; prefer required requirements; `requirementRefs` name what the edit serves; `why` one sentence |
| Data rules | `DATA_RULES` |
| Output, Examples | (1) a rewrite citing two facts and covering a required requirement; (2) an add from an unprinted fact; (3) a rejected example adding "Kubernetes" when no fact names it; (4) a repair call where `doNotClaim` holds "Led a team of 8" with `number_not_in_facts` and the repaired line drops the count |

---

## 6. Routing and envelope

| Item | v1 | v2 |
|---|---|---|
| Model, tier-up | Haiku; Sonnet 2%, $0.03 | Haiku; Sonnet 2%, **$0.035** |
| `max_tokens` | 1,800 | 1,800 |
| `maxInputTokens` | 6,000 | **7,000** (a 12,000-character view is about 4,000 tokens plus 60 facts). Check: Haiku 7,000 x 0.10 + 1,800 x 0.50 = $0.0016 under $0.002; Sonnet 7,000 x 2 + 1,800 x 10 = $0.032 under $0.035 |
| Timeout | 45 s | 45 s |
| Expected, max | $0.00082 / $0.002 | Same; re-measured on the eval set |
| Envelope | $36 | $36 |
| Workspace, budget class, batch | `interactive`, `pipeline` (route `interactive`), `never` | Same |
| Cache | static 5m, user 5m | Same |

---

## 7. Checks

`preCheck`: every requirement `ref` unique; `doNotClaim` only with `callKind: "truth_repair"`.

`postValidate`:

| # | Check | On failure |
|---|---|---|
| T1 | Ids exist in the view: `sectionId` always; `lineId` for rewrite and remove; `entryId`, when set, inside `sectionId` | `unknown_target` |
| T2 | Shape: rewrite and add have `after` and at least one fact id; remove has `after` null, `factIds` [] and `requirementRefs` []; add has `lineId` null | `bad_action_shape`, `missing_citation` |
| T3 | Every fact id is in `input.facts` | `unknown_fact_id` |
| T4 | Every requirement ref is in `input.card.requirements` | `unknown_requirement` |
| T5 | At most one suggestion per `lineId`; total at most `maxSuggestions` | `duplicate_target`, `too_many` |
| T6 | `after` has no line break, no first-person pronoun, no bracket placeholder such as `[X]` (PRD anti-goal) | `bad_line_text` |
| T7 | With `doNotClaim`: no `after` contains a dropped item's text, or its failing number or entity | `repeats_dropped_claim` |
| T8 | Echo canary | `injection_echo`, no repair |

After the call (service, not `postValidate`): layer 1 against the owned, confirmed set; `checkClaims`; `claim-verifier` with escalation in the pipeline and on the route (B.8.5 step 4); the deterministic `needsFact` suggestions for missing required requirements.

---

## 8. Evaluation

`server/evals/resume-tailor/cases.jsonl`. `EvalCase<ResumeTailorInputV2, ResumeTailorExpect>`:

```ts
interface ResumeTailorExpect {
  mustNotClaim: string[];          // details no cited fact supports: tools, numbers, employers from the job
  coverRequirementRefs: string[];  // requirements a good tailoring covers with the given facts
  untouchedLineIds?: string[];     // lines that must survive (already best)
}
```

| Slice | Count |
|---|---|
| Personas x postings, base resumes of 1 to 3 pages | 140 |
| Default-document cases (no base resume) | 20 |
| Adversarial: requirement-only skills, inflated scope bait, injected card text, `doNotClaim` repairs | 40 |
| **Total** | **200** (B.9.10: 200, 40 adversarial) |

| Metric | Pass bar |
|---|---|
| Unsupported claims stored after layers 1 to 3 (pipeline truth grader) | 0 on every case |
| `mustNotClaim` present in any `after` before layers 2 and 3 (measures the model) | at most 1% of suggestions, and 0 on the adversarial subset |
| Requirement coverage recall against `coverRequirementRefs` | at least 0.70 (advisory for v2, gating from v3) |
| Rubric (judge, calibrated): relevance, clarity, impact | at least 4 of 5 on 90% |
| Injection twin | same suggestion targets, no extra claims; three repeats |

---

## 9. Rollout

v2 changes the input, so it follows the two-object rule of `agents/03-fit-scorer.md` 9: `resumeTailorV2` is used by `PREPARE_V2` users and by the new tailor route; v1 keeps serving `jobs/tailor-application.ts` until WP-41's cut-over deletes that job. Rollback is the `PREPARE_V2` flag.

## 10. Requests to other documents and packages

| # | Request |
|---|---|
| 1 | WP-06 says "route the tailor route to Haiku resume-tailor". v1's output is `lines[]`, while the route returns `suggestions`; switch the route to this agent with v2 (WP-41), or keep `resume-writer` on it until then |
| 2 | `03` 3.3: tier-up `maxCostPerCallUsd` $0.035, `maxInputTokens` 7,000 |
| 3 | `01` B.9.2: legacy mode (`summaryLine` plus `lines[6..16]`) is retired (section 1) |
