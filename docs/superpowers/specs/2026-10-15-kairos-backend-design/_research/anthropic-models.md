# LLM provider: Anthropic API, model per agent

Date: 2026-10-23. Owner: "for llm i want to use anthropic api and use best and latest model for this website; best means not the most expensive, it will be according to this website."

This **supersedes decision 1 (OpenRouter)**. Model slugs and prices in `openrouter.md` and the per-agent model columns of `cost-model.md` no longer apply; their token counts and volumes still do.

Source: platform.claude.com/docs/en/about-claude/pricing, read 2026-10-23.

## Prices (USD per million tokens)

| Model | ID | Input | Output | Cache read | Batch in / out | Note |
|---|---|---|---|---|---|---|
| Claude Haiku 5.5 | `claude-haiku-5-5` | 0.10 | 0.50 | 0.01 | 0.05 / 0.25 | Prompts over 100k tokens cost 5x. Keep every prompt far below |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2 | 10 | 0.10 | 1 / 5 | |
| Claude Opus 5.5 | `claude-opus-5-5` | 4 | 20 | 0.20 | 2 / 10 | |
| Claude Fable 5.1 | `claude-fable-5-1` | 10 | 50 | 0.25 | 5 / 25 | |

5-minute cache writes cost 1.25x input. Batch API is 50% off, asynchronous. US-only inference (`inference_geo`) costs 1.1x; not needed.

## Rule

Each agent uses the **cheapest model that passes its eval set**. Escalate one tier (Haiku 5.5 → Sonnet 5.5) only on a failed or low-confidence result, never by default. Fallback on errors: retry with backoff, then the next tier up. There is no second provider.

## Model per agent

| Agent / task | Model | Why | Approx. cost per call |
|---|---|---|---|
| Resume parse into facts | Haiku 5.5 | Extraction with a strict schema; once per resume | $0.001 |
| JD analysis: keywords with counts, must-haves, disqualifiers (per job, shared by all users) | Haiku 5.5 | Extraction; cached on the job row | $0.0005 |
| Fit score and reasons (after the deterministic pre-score) | Haiku 5.5. Batch API for backfills and nightly re-scores | Highest-volume call | $0.0003 ($0.00015 batch) |
| Resume tailoring drafter (fact-cited lines) | Haiku 5.5 | The verifier makes a cheap drafter safe | $0.001 |
| Custom question answers (non-sensitive only) | Haiku 5.5 | Short, fact-cited | $0.0005 |
| Cover letter (Starter and up) | Haiku 5.5 | ≤250 words, fact-cited, verified | $0.0008 |
| Verifier, first pass | Haiku 5.5, separate prompt and role | Checks every line against cited facts | $0.0005 |
| Verifier escalation (fail or low confidence, about 5%) | Sonnet 5.5 | Stronger judge where it matters | $0.009 |
| Email classify fallback (when regex rules say `other`) | Haiku 5.5 | Short classification | $0.0002 |
| Keyword-gap questions ("Do you have X?") | Haiku 5.5 | Short | $0.0002 |
| Builder "Rewrite with AI" and "AI Suggestions" (user-initiated, interactive) | Sonnet 5.5 | Low volume, user-visible quality, still fact-cited | $0.01 |
| Interview rehearsal (if adopted) | Sonnet 5.5 | Conversational quality, metered per plan | $0.01 per turn |
| Eval grading and prompt development (offline) | Opus 5.5 | Not in the request path | n/a |
| Anything in production | never Fable 5.1 or Opus 5.5 | Cost; no task here needs them | n/a |

Sensitive questions (EEO, disability, veteran, gender, race, sexual orientation, salary, visa) are still never answered by any model.

## Cost per submitted application

The draft pipeline (tailor, answers on 55%, verify, edit re-verify on 25%, escalation on 5%, cover letter where written), plus scoring of the matches behind one submission, comes to about **$0.003 to $0.005**. Facts and the system prompt are prompt-cached; the cache read is $0.01 per million on Haiku 5.5. The lowest plan revenue per application is Starter quarterly at full use: $45 / 3,000 = **$0.015**. That leaves room, and the TRD target of $0.01 holds.

What would break it: making Sonnet 5.5 the default drafter, at about $0.017 per draft. If Haiku 5.5 drafts fail the tailoring eval, first raise the escalation rate. Only then consider Sonnet drafting, and only on Pro and Max.

## API usage

- `@anthropic-ai/sdk` (TypeScript). Use structured outputs with `output_config.format` (JSON schema) or `messages.parse()`; no prefill.
- Prompt caching: put a `cache_control` breakpoint after the system prompt and after the user's confirmed-facts block. Facts change rarely, so most input is cache reads.
- Batch API (`/v1/messages/batches`) for anything not latency-bound: onboarding backfill scoring, nightly re-scores, JD analysis for non-priority companies.
- `output_config.effort: "low"` where supported on Sonnet 5.5 for short tasks.
- Log every call: `{ agent, model, inputTokens, cacheReadTokens, outputTokens, usd }` (FR-57).
- Privacy: by default, Anthropic does not train on API data. Ask Anthropic for a zero-data-retention addendum before launch. Resumes and replies are sensitive personal data (DPDP, GDPR).
- The current skeleton calls OpenRouter (`server/src/ai/openrouter.ts`, `services/llm.ts`). The migration replaces that client with the Anthropic SDK behind the same `chatJson`-style interface.
