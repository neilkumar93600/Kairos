# Agent spec: `outcome-analyst` (stub, deferred)

Revision 1, 2026-11-03 (WP-49). Status: **deferred** (WP-40, README 8: "the `outcome-analyst` weekly email", trigger: an owner decision). This stub records the contract the future package starts from; it is not a build target. Rows it carries forward: `01-architecture.md` B.9.2, B.9.5, B.9.10 and B.9.11, `03-agent-runtime.md` 3.3, 11.5 and 13.2.

**Today:** no agent folder; a disabled planned entry in the registry (WP-49). Product claims run ahead of the build: `shared/src/plans.ts:114,122` sets `outcomeReport: true` on Pro with the bullet "Weekly outcome report and targeting suggestions", and `web/components/pricing/plan-comparison.tsx:25` shows it on the pricing page. WP-40 asks to correct the PRD status and the pricing claim until this ships; `docs/01-prd.md:56` lists it as P1.

| Item | Contract |
|---|---|
| Role | Turn the deterministic weekly report into 1 to 3 targeting suggestions |
| Input | The report as numbered metrics only: `{ metrics: { id: "m1".."m40", label, value: number, unit }[], roleLabels: string[] }`. Never names, email text, facts or employer names (B.9.5) |
| Output | `{ suggestions[1..3]: { text (240 characters), metricIds[1..] } }` |
| Checks | Every number in a suggestion appears in a cited metric's value; every `metricIds` entry exists; no URL; rendered as plain text in the email (`03` 11.5) |
| Model and envelope | Haiku, no tier-up, `defer` then skip this week's suggestions (the report is sent without them); `max_tokens` 600, `maxInputTokens` 2,000, 20 s, $0.0004 / $0.001, $0.20 a day; `batch` workspace, `pipeline` |
| Batch | **Never.** `03` 3.3 wins over B.9.11's "Always": the report is per-user personal data and the Batch API is outside zero data retention. Settled here under README rule 4 |
| Eval | 50 synthetic reports; `expect: { metricIds: string[] }`; bars: every number grounded in a cited metric (100%), rubric at least 4 of 5 on 90% |
| Shed | Level 1 sends the report without suggestions (`03` 9.5) |

When the trigger fires, the package writes the full spec in the format of `agents/01-resume-parser.md` from this table.
