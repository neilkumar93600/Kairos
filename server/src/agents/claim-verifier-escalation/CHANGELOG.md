# claim-verifier-escalation changelog

Newest first, one entry per version (03-agent-runtime.md 4.3).

## v1 (2026-11-03)
- Change: first version (WP-26). The verifier's wire format and rules, harder examples (scope inflation, units,
  implied seniority), "your uncertain drops the claim" (agents/09-claim-verifier-escalation.md 3).
- Why: decide the verifier's uncertain claims within a daily cap of 15% of verifier calls, failing closed.
- Eval: starter set in server/evals/claim-verifier-escalation (hand-written fixtures); false accept at most 0.5% by a
  live run only.
- Model: claude-sonnet-5-5, effort low, no tier-up, fail_closed.
- Rollout: follows the verifier's `verifier_mode:<path>`; builder suggestions never escalate.
