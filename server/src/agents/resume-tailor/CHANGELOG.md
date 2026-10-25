# resume-tailor changelog

Newest first, one entry per version (03-agent-runtime.md 4.3).

## v1 (2026-10-24)
- Change: first version. Ports the inline `tailor.ts` system prompt (log name `tailor`) into the
  four-section prompt format with the shared DATA_RULES fence text. Legacy mode: no base resume.
- Why: P1 gateway migration (03-agent-runtime.md 4.7); version 1 reproduces today's prompt text and
  its eval run on the gateway is the baseline version 2 must beat.
- Eval: baseline pending; the golden set (200 cases, 40 adversarial) is authored with the eval
  harness in P3. Until then this version is covered by the recorded-fixture unit tests.
- Model: claude-haiku-5-5. Schema: unchanged from the `tailoredSchema` of services/tailor.ts.
- Rollout: active with `LLM_GATEWAY=anthropic`; the legacy client stays until P3.
