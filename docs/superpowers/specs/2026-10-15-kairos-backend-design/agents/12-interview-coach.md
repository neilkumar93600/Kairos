# Agent spec: `interview-coach` (stub, deferred)

Revision 1, 2026-11-03 (WP-49). Status: **deferred** (WP-40, README 8: "Interview rehearsal F9 and `interview-coach`", trigger: an owner decision). Interview rehearsal is a non-goal of the resume-suite PRD (section 4), and `workers/13-interview-rehearsal.md` is deferred with it. This stub records the contract the future package starts from. Rows it carries forward: `01-architecture.md` B.8.9, B.9.2, B.9.5 and B.9.10, `03-agent-runtime.md` 3.3, 7.1, 11.5 and 13.2.

**Today:** no agent folder, no rehearsal routes or tables; a disabled planned entry in the registry (WP-49). `shared/src/plans.ts:125,152` already grants `rehearsalTurns` of 20 and 40 a day on Pro and Max, an allowance with nothing to spend it on.

| Item | Contract |
|---|---|
| Role | One bounded rehearsal turn: feedback on the user's answer and the next question, at most 8 questions a session, no tools, no loop (B.8.9) |
| Input | The job card's requirements (public), the relevant confirmed facts, the gap list (F1 `missing` and `unconfirmed` requirements first, then must-haves), and the transcript so far with the user's answers fenced as untrusted text. Never contact details, work authorization or salary (B.9.5) |
| Output | `{ feedback: { strengths[], gaps[], suggestion, factIds[] }, nextQuestion: { id, text, requirementIds[] } \| null }` |
| Checks | `factIds` are input facts; `requirementIds` are input requirements (question grounding 100%); `checkClaims` on the feedback against the cited facts, so it never states a user fact the facts lack; nothing it writes is sent to an employer or stored as a fact; transcripts deleted after 30 days |
| Model and envelope | Sonnet, no tier-up, `fail_closed` (route 503); `between_tools`, effort low; `max_tokens` 500, `maxInputTokens` 6,000, 60 s; expected $0.0075; `interactive` workspace and budget class; $12 a day; metered by `rehearsalTurns` |
| Cost check to fix when built | `03` 3.3's max of $0.015 fails the registry test: 6,000 x 2 + 500 x 10 = $0.017. Set `maxCostPerCallUsd` to at least $0.018, or `maxInputTokens` to 5,000 |
| Eval | 60 sessions; `expect: { requirementIds: string[], mustNotClaim: string[] }`; bars: every question grounded in a listed requirement (100%), zero invented user facts in feedback, rubric at least 4 of 5 |

When the trigger fires, the package writes the full spec in the format of `agents/01-resume-parser.md` from this table.
