# resume-writer changelog

Newest first, one entry per version (03-agent-runtime.md 4.3).

## v2 (2026-11-05)
- Change: level input, tag, priority and appendYears outputs, the headline scope, Fix-spelling suggestions, and the
  do-not-claim rule in the static text (rule 9). A second spec object, `resumeWriterV2`, because the input changes
  (`agents/03-fit-scorer.md` 9); `schema.v2.snap.json` is its snapshot.
- Why: PRD R3 (WP-31). Years in a headline are computed in code and the model never sees the number.
- Eval: extended to all four levels, headline and Fix-spelling slices, a per-level invented-detail bar and tag accuracy.
  **The fixtures are hand written, so they prove the harness only. The real invented-detail rate needs a live run
  (`npm run eval -- --live --agent resume-writer`), which has not happened.**
- Model: claude-sonnet-5-5. max_tokens 800 for line and headline, 2,600 for entry, section, summary and skills, 4,000
  for resume (up to 20 suggestions); max cost $0.065.
- Rollout: `POST /resumes/suggestions` defaults to v2; the legacy `/resume/suggestions` stays on v1 until
  `prompt_canary:resume-writer` or `prompt_pin:resume-writer` moves it. A pin to 1 returns every call to v1, except
  the headline scope, which v1 cannot do and answers 503.

## v1 (2026-10-24)
- Change: first version. Ports the inline SYSTEM prompt of `services/resume-writer.ts` into the
  four-section prompt format; facts move into the cached per-user block, the view, note and job
  become fenced per-call blocks.
- Why: P1 gateway migration (03-agent-runtime.md 4.7); version 1 reproduces today's prompt text and
  its eval run on the gateway is the baseline version 2 must beat.
- Eval: baseline pending; the golden set (150 cases) is authored with the eval harness in P3.
- Model: claude-sonnet-5-5. Schema: unchanged from the `modelSchema` of services/resume-writer.ts.
- Rollout: active with `LLM_GATEWAY=anthropic`; the legacy client stays until P3.
