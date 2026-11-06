# claim-verifier changelog

Newest first, one entry per version (03-agent-runtime.md 4.3).

## v1 (2026-11-03)
- Change: first version (WP-26). Wire format, verdict meanings, examples and checks as agents/08-claim-verifier.md 3 to 7.
- Why: truth-lock layer 3 for the tailor route, the drafts route and builder suggestions (B.9.6).
- Eval: starter labelled set in server/evals/claim-verifier (hand-written fixtures). The false-accept (at most 1%) and
  false-reject (at most 8%) bars are measured only by a live run: `npm run eval -- --live --agent claim-verifier`.
- Model: claude-haiku-5-5, tier-up claude-sonnet-5-5 on any failure. Schema: ClaimVerifierOutput (no free text).
- Rollout: `verifier_mode:<path>` defaults to shadow on every path; enforce after 7 days and the live eval bars.
  A v2 runs only as `prompt_shadow:claim-verifier`, never as a canary (03-agent-runtime 4.5).
