# resume-writer changelog

Newest first, one entry per version (03-agent-runtime.md 4.3).

## v1 (2026-10-24)
- Change: first version. Ports the inline SYSTEM prompt of `services/resume-writer.ts` into the
  four-section prompt format; facts move into the cached per-user block, the view, note and job
  become fenced per-call blocks.
- Why: P1 gateway migration (03-agent-runtime.md 4.7); version 1 reproduces today's prompt text and
  its eval run on the gateway is the baseline version 2 must beat.
- Eval: baseline pending; the golden set (150 cases) is authored with the eval harness in P3.
- Model: claude-sonnet-5-5. Schema: unchanged from the `modelSchema` of services/resume-writer.ts.
- Rollout: active with `LLM_GATEWAY=anthropic`; the legacy client stays until P3.
