# OpenRouter research for the Kairos backend

Date of research: 2026-10-15. Scope: backend only. Nothing under `web/` or `extension/` is touched by anything in this document.

## 0. How to read this document

Sources and confidence tags used throughout:

- **[docs]** read from openrouter.ai/docs pages on 2026-10-15 (api-reference, provider-routing, model-fallbacks, structured-outputs, prompt-caching, limits, errors, zdr, byok, latency, usage-accounting, embeddings API reference, Claude 5.5 migration guide, FAQ).
- **[catalog]** computed from the public JSON at `https://openrouter.ai/api/v1/models` (463 models, 33 of them embedding models via `/api/v1/embeddings/models`) and from `https://openrouter.ai/api/v1/endpoints/zdr` (957 zero-data-retention endpoints, each with its own price, quantization, context length, supported parameters and 1-day uptime). Both were downloaded on 2026-10-15. Prices are USD per million tokens (per 1M) unless stated.
- **[unverified]** not stated by the docs or the catalog; from general knowledge or inference, and must be confirmed in a spike before it is relied on.

The catalog changes daily. Every model slug in section 11 must be re-validated by a nightly "catalog drift" job (section 12.6), not trusted from this document.

Two facts about pricing that the rest of the document depends on:

1. The `pricing` object in `/api/v1/models` is the price of the cheapest endpoint for the model, not the price you pay under a zero-data-retention (ZDR) policy. Kairos will require ZDR on every call that carries resume, work-authorization or reply content. So the tables below show both the "catalog price" and the "cheapest ZDR endpoint that also supports structured outputs". The ZDR price is the one to budget with.
2. Several models in the catalog have mandatory reasoning (`reasoning.mandatory = true`). Their reasoning tokens are billed as output tokens. For those models the real cost per call is higher than input/output arithmetic suggests (section 11 includes the allowance used).

---

## 1. Chat completions API and differences from OpenAI

Endpoint: `POST https://openrouter.ai/api/v1/chat/completions`, header `Authorization: Bearer <key>`. [docs]

What is the same as OpenAI: request body (`model`, `messages`, `max_tokens`, `temperature`, `top_p`, `stop`, `seed`, `stream`, `tools`, `tool_choice`, `response_format`, `logprobs`), the `choices[].message` response shape, SSE streaming, `usage`. The official OpenAI SDK works by changing `baseURL` to `https://openrouter.ai/api/v1`. Our existing `chatJson` in `server/src/services/llm.ts` is already OpenAI-compatible, so the transport swap is a base URL and key change; the larger change is the added fields below.

Differences that matter for Kairos: [docs]

| Topic | OpenRouter behavior | Consequence for the design |
|---|---|---|
| Unsupported parameters | Silently ignored, not rejected, unless `provider.require_parameters = true`. | Always set `require_parameters: true` on structured calls, or a provider may drop `response_format` and return prose. |
| Extra request fields | `models` (fallback list), `route: "fallback"`, `provider` (routing preferences), `plugins` (for example `response-healing`), `session_id`, `user`, `trace`, `reasoning`, `verbosity`, `debug.echo_upstream_body` (streaming only). | The gateway wrapper owns these; agents never set them directly. |
| Extra response fields | `native_finish_reason`, `usage.cost` (credits, equals USD), `usage.is_byok`, `usage.cost_details.upstream_inference_cost`, `usage.prompt_tokens_details.{cached_tokens,cache_write_tokens}`, `usage.completion_tokens_details.reasoning_tokens`, top-level `model` = the model that actually served (important when a fallback fires), `provider` name. | Log `model`, `provider`, `usage.cost` on every call to the `llm_calls` table. |
| `choices` | Always an array. Normalized `finish_reason`: `stop`, `length`, `tool_calls`, `content_filter`, `error`. | Treat `length` as failure for JSON agents (truncated JSON). |
| Errors | HTTP 4xx for request-level problems; once generation starts the HTTP status can be 200 with an `error` object in the body (or an SSE `error` event). | The gateway must inspect the body for `error` even on HTTP 200, and must treat an empty `choices` as failure. |
| Tokens | Counted with each model's native tokenizer. | Token budgets are per model; do not reuse counts across families. The Haiku 5.5 tokenizer produces roughly 30% more tokens than Haiku 4.5 for the same text [docs]. |
| Assistant prefill | A trailing assistant message is treated as a prefill on most models, but Claude 5.5 models reject it [docs]. | Never rely on prefill for JSON; use `response_format`. |
| Sampling parameters | Claude 5.5 and Claude 5 Sonnet remove `temperature`, `top_p`, `top_k` (Haiku 5.5 rejects any `temperature` other than 1) [docs]. | Per-agent config must allow "no sampling parameters"; do not hard-code `temperature: 0`. Determinism comes from schema, evals and verifier, not temperature. |
| Forced tool use | Rejected on Opus 5.5 and Sonnet 5.5 [docs]. | Do not use "force a function call" as the structured output trick. Use `response_format: json_schema`. |

Headers: `HTTP-Referer` and `X-OpenRouter-Title` (or `X-Title`) are optional attribution headers; `X-OpenRouter-Categories` sets marketplace categories. `x-session-id` may carry the session id (body field wins). [docs]

Model slugs: use exact dated or versioned slugs (`anthropic/claude-haiku-5.5`). The docs also show moving aliases like `~anthropic/claude-sonnet-latest`; do not use them in production because a silent model change would invalidate evals and the cache prefix. Routing variants appended to a slug: `:nitro` (sort by throughput), `:floor` (sort by price, also allows flex tier), `:exacto`, plus catalog variants `:free` and `:batch`. [docs] Never use `:free` (free models may train on prompts, 20 RPM limits, see section 7).

Embeddings and rerank are separate endpoints (section 10).

---

## 2. Structured outputs

Request shape: [docs]

```json
{
  "model": "openai/gpt-6-luna",
  "messages": [ ... ],
  "response_format": {
    "type": "json_schema",
    "json_schema": { "name": "fit_score_v3", "strict": true, "schema": { "type": "object", "additionalProperties": false, "required": ["score"], "properties": { "score": { "type": "integer", "minimum": 0, "maximum": 100 } } } }
  },
  "provider": { "require_parameters": true, "zdr": true }
}
```

Facts:

- `type: "json_object"` is the weaker mode (valid JSON, no schema). Use `json_schema` always.
- `strict: true` asks providers that have native constrained decoding to enforce the schema exactly. Enforcement differs by provider; where there is no native mode the schema is only a strong hint. Strict modes restrict which JSON Schema features work (typically: every property in `required`, `additionalProperties: false`, limited `oneOf`, no recursive refs on some providers). Kairos schemas must therefore be written in the strict-compatible subset and validated again with zod after the call. [docs]
- Support is decided per endpoint, not per model, and can change over time. The signal is `structured_outputs` in the endpoint's `supported_parameters`. [docs, catalog]
- Without `provider.require_parameters: true`, `response_format` is only a soft routing preference and a provider that lacks it may be chosen. With it, the request fails with 404/503 "no provider meets requirements" instead of silently returning unstructured text. [docs]
- The `response-healing` plugin (`plugins: [{ "id": "response-healing" }]`) repairs malformed JSON (missing brackets, trailing commas, JSON wrapped in markdown) on non-streaming requests only; it cannot fix output truncated by `max_tokens`. Pricing for the plugin is not documented [docs]. Recommendation: use it as a cheap first repair step on models without native strict mode, but still validate with zod and do one bounded retry.
- Invalid JSON Schema returns an error; schemas are cached/compiled by some providers on first use, so the first call with a new schema version can be slower [unverified].
- Reasoning models: reasoning tokens count against `max_tokens`; if reasoning consumes the whole budget the response is HTTP 200 with `finish_reason: "length"` and empty content, and retrying with the same budget will not help [docs]. Set `max_tokens` at least (expected output + reasoning allowance) for reasoning models, and set `reasoning.effort` low for extraction.

Important catalog finding for the ZDR requirement: [catalog]

| Model | Endpoints under ZDR | Of those, with `structured_outputs` |
|---|---|---|
| `anthropic/claude-haiku-5.5` | 6 (Google Vertex global/us/europe, Amazon Bedrock default/us-east-1/eu-west-1) | 3. The three Bedrock endpoints list `response_format` but NOT `structured_outputs`. With `require_parameters` and `zdr`, traffic can only land on Vertex. |
| `anthropic/claude-sonnet-5.5` | 4 | 3 |
| `anthropic/claude-sonnet-5` | 6 | 3 |
| `openai/gpt-6-luna` | 3 (all Azure: default, US, EU) | 3 |
| `openai/gpt-6-sol` | 3 (Azure) | 3 |
| `deepseek/deepseek-v4.1-flash` | 26 | 22 |
| `z-ai/glm-5.3-flash` | 30 | 26 |
| `google/gemini-4-argon` | 3 (Google Vertex) | 3 |

Operational rule: the gateway must call each agent with `require_parameters: true` AND `zdr: true` in a pre-flight "capability probe" (a tiny schema call per agent model) and store the result; a probe failure disables that model in the routing table and moves to the next fallback.

---

## 3. require_parameters

`provider.require_parameters` (boolean, default `false`) restricts routing to providers that support every parameter present in the request (including `response_format`, `tools`, `tool_choice`, `reasoning`, `max_tokens`, `verbosity`). With the default `false`, `tools`, `response_format` and `verbosity` act only as soft preferences between providers and never remove a provider from the candidate list. [docs]

Kairos rule: set `require_parameters: true` on every call that has a schema. Tradeoff: fewer eligible endpoints, which interacts with ZDR (section 5). The combination "ZDR + structured outputs + require_parameters" is the narrowest routing set; measure it before choosing models (the "SO+ZDR endpoints" column in section 11).

---

## 4. Model fallbacks and provider routing

### 4.1 Model fallbacks (`models` array)

[docs] Provide `models: ["primary", "fallback1", "fallback2"]`. OpenRouter tries them in order when the previous one returns an error. Fallback triggers on any error by default: context-length validation errors, moderation flags, rate limiting, provider downtime. The request is billed at the model that finally served it, and the response `model` field names it. If the last fallback also fails, that error is returned. On `/api/v1/messages` (Anthropic-style endpoint) the equivalent is `fallbacks`, max 3 entries, only `model` per entry, and it cannot be combined with `models`. With the OpenAI SDK pass `models` via `extra_body` (Python) or as a top-level property (TypeScript, needs a type-ignore). The docs do not state a maximum length for `models` on chat completions [unverified].

Design rules for Kairos:

1. Fallback must stay inside the same data policy. Because `provider.zdr: true` and `require_parameters: true` apply to the whole request, every model in `models` must have at least one ZDR+structured-outputs endpoint. The nightly drift job checks this.
2. A fallback model changes output behavior. The pipeline records `served_model` per call, and a verifier or eval gate decides whether the result is acceptable; fallback must not silently weaken the truth lock.
3. Fallbacks should come from a different provider family for outage resilience, but for the verifier it must remain a different family from the drafter (section 11.4).
4. Fallback is only for the same agent role. Quality-sensitive agents (tailoring, verifier) should have at most one fallback; cheap agents can have two.

### 4.2 Provider routing (`provider` object)

[docs] Defaults: load balancing prefers providers without significant outages in the last 30 seconds, then picks among those weighted by the inverse square of price (cheapest most likely), with the rest as fallbacks.

| Field | Type / default | Behavior | Kairos use |
|---|---|---|---|
| `order` | string[] | Try these provider slugs in order. Disables default load balancing and sticky routing. | Avoid, except when pinning to a ZDR Vertex endpoint is the only way to get structured outputs. |
| `allow_fallbacks` | boolean, `true` | `false`: use only listed providers, fail otherwise. | `true` everywhere. |
| `require_parameters` | boolean, `false` | See section 3. | `true` on schema calls. |
| `data_collection` | `"allow"` or `"deny"`, default `allow` | `deny` limits routing to providers that do not collect (store/train on) user data. | Set `deny` on every call, in addition to `zdr`. |
| `zdr` | boolean | `true` limits routing to ZDR endpoints. ORs with account and guardrail settings; a request can add ZDR but cannot remove enforcement set in the account. | `true` on every call with personal data. |
| `enforce_distillable_text` | boolean | Only models whose authors permit distillation of outputs. | Not needed. |
| `only` | string[] | Allow-list of provider slugs. | Use for emergency pinning only. |
| `ignore` | string[] | Skip-list; merged with account-wide ignores. | Ban providers that fail the privacy review (for example any provider that routes outside the US/EU). |
| `quantizations` | string[] such as `int4`, `int8`, `fp8`, `bf16` | Filter by quantization. | Use `["fp8","bf16"]` for the extraction and verifier agents when the cheapest ZDR endpoint is `fp4` (quality risk). |
| `sort` | `"price"`, `"throughput"`, `"latency"` or `{by, partition}` | Sorts providers; disables load balancing. `partition: "model"` (default) sorts within each model; `"none"` sorts across all listed models together. | `sort: "price"` for batch agents; default load balancing for interactive ones. |
| `max_price` | `{prompt, completion, request, image}` | Hard ceiling in USD per million tokens; the request fails if no provider is under it. | Per-agent cost guard so a price change cannot silently multiply cost. Set at 1.5 times the budgeted price. |
| `preferred_min_throughput` | number or `{p50,p75,p90,p99}` tokens/sec | Soft: slower endpoints are moved to the end of the list (not excluded). Rolling 5-minute window. | Useful for the interactive tailoring preview. |
| `preferred_max_latency` | number or percentile object, seconds | Soft, same semantics. | Same. |

Rules of thumb: [docs]

- `:floor` is a superset of `sort: "price"` and also makes flex-tier endpoints eligible; `:nitro` is a superset of `sort: "throughput"` plus priority-tier endpoints. Changing the variant suffix mid-conversation changes the sticky-routing key.
- Setting `provider.order` or `sort` turns off default load balancing and also disables sticky routing, which hurts prompt caching (section 6).
- `zdr` plus `require_parameters` plus `max_price` can leave no eligible endpoint; the failure is an HTTP error (503 "no available provider meets your routing requirements") and must be handled as a model-level failure that triggers the next fallback.

### 4.3 Presets and guardrails

Presets (server-side saved routing and model configs) and Guardrails (per-key or per-member policy: ZDR per model group, budgets) exist as API resources [docs: llms.txt index, SDK READMEs]. Guardrail fields `enforce_zdr_anthropic`, `enforce_zdr_openai`, `enforce_zdr_google`, `enforce_zdr_xai`, `enforce_zdr_other` set ZDR per model group; the old `enforce_zdr` is deprecated. Recommendation: put the production key under a guardrail that enforces ZDR for all groups, and also pass `zdr: true` in code (defense in depth, because the request flag cannot be overridden downward).

---

## 5. Data policies and zero data retention

What OpenRouter itself stores: [docs]

- Prompts and completions are not stored unless you opt in ("Private Input & Output Logging" in observability settings, off by default). Keep it off for the production key.
- A second opt-in ("OpenRouter use of inputs/outputs", gives a 1% discount) lets OpenRouter use your data. Keep it off.
- Even without opt-in, OpenRouter may sample a few prompts anonymously for categorization (stored without account link, categorized by a ZDR model). This is a residual risk to disclose in the DPA/privacy review; a mitigation is an Enterprise agreement [unverified whether Enterprise removes sampling].
- Per-request metadata (token counts, latency, model, cost) is stored; it excludes content.

Provider-side policies: [docs]

- Providers set their own retention and training policies. OpenRouter publishes a table per provider (retention days or zero, training yes/no). If it cannot establish an endpoint's policy it assumes the endpoint both retains and trains.
- `provider.data_collection: "deny"` and the account "no training" setting exclude providers that train; the account setting is separate for paid and free models.
- `provider.zdr: true` or account-wide ZDR (settings/privacy) or guardrail ZDR restricts routing to endpoints with zero retention. ZDR endpoints cannot train on data.
- Account-wide ZDR works per model group, and in practice removes first-party endpoints: Anthropic first-party removed (Bedrock and Vertex remain), OpenAI first-party removed (Azure remains), Google AI Studio removed (Vertex remains), xAI non-ZDR removed, all others non-ZDR removed. [docs]
- The list of ZDR endpoints is public JSON: `GET https://openrouter.ai/api/v1/endpoints/zdr` (fields: `model_id`, `provider_name`, `tag`, `quantization`, `pricing`, `context_length`, `supported_parameters`, `supports_implicit_caching`, `uptime_last_*`). The list updates automatically as provider policies change. [docs, catalog]
- In-memory provider prompt caching is not treated as retention, so cached endpoints remain usable under ZDR. [docs]
- ZDR covers inference routing only. Plugins and server tools (web search, web fetch, file parser) may use third parties with their own retention; with ZDR enforced, the Firecrawl engine is rejected. Kairos must not enable any OpenRouter plugin or server tool except `response-healing`, and must confirm that plugin's retention behavior before use (not documented) [unverified].
- BYOK keys follow the same ZDR rules; you may declare ZDR on a key if your own provider contract is ZDR. [docs]
- Private endpoints (your own provider account behind BYOK) can be declared ZDR; the declaration is an attestation that OpenRouter does not verify. [docs]
- EU data residency: generation stats report `data_region` (`global`, `europe`, `us`) and the ZDR list shows regional endpoints (for example Vertex `europe`, Bedrock `eu-west-1`, Azure `eu`, Mistral `eu`) at about 10% higher price than global endpoints in this catalog (for example Haiku 5.5: 0.10/0.50 global versus 0.11/0.55 regional) [catalog]. Use regional endpoints with `provider.only` or the `:eu` style tags for GDPR-bound users if the DPA requires it [unverified whether a request-level region switch exists beyond `only`/`order`].

Kairos policy implied by the above (for the data-minimization spec to adopt):

1. Every call: `provider: { zdr: true, data_collection: "deny", require_parameters: true, allow_fallbacks: true }`. Account-level ZDR on, guardrail on, logging opt-ins off.
2. Models and endpoints that have no ZDR endpoint (for example Qwen 3.7 Flash, `cohere/command-r7b`, all `:batch` variants in this catalog show zero ZDR endpoints) are excluded from candidate lists. [catalog]
3. Voyage embeddings (`voyageai/*`) have no ZDR endpoint on OpenRouter in the catalog; do not use them for resume or fact text via OpenRouter [catalog].

---

## 6. Prompt caching

Reporting: `usage.prompt_tokens_details.cached_tokens` (read hits) and `cache_write_tokens` (writes, only for models with write pricing). `usage.cost` already includes cache discounts. The `/generation` endpoint exposes `cache_discount`. [docs]

Per provider: [docs]

| Provider family | How to enable | Write cost | Read cost | Min prefix | TTL |
|---|---|---|---|---|---|
| Anthropic Claude | `cache_control: {type:"ephemeral"}` on content blocks (up to 4 breakpoints), or one top-level `cache_control` for automatic mode | 5-min write 1.25 times input; 1-hour write (`"ttl":"1h"`) 2 times input | 0.1 times input | 512 tokens on Claude 5.5 models (was 1024 on Sonnet 4/5, 4096 on Haiku 4.5) | 5 min default, 1 h optional |
| OpenAI (GPT-5 and later) | Automatic, no config | Free before GPT-5.6; GPT-5.6 and later charge 1.25 times input for writes (catalog shows write prices for `gpt-6-*`) | 0.25 or 0.5 times input depending on model (catalog: 0.1 times for `gpt-6-luna`) | 1024 tokens | in-memory; explicit mode (GPT-5.6+) via `prompt_cache_breakpoint` and `prompt_cache_options`, minimum TTL 30 min |
| DeepSeek | Automatic | Normal input price | 0.1 times | provider-defined | provider-defined |
| Google Gemini | Implicit (automatic, 2.5 series and newer); explicit with `cache_control` (only last breakpoint used) | Implicit: none; explicit: input price plus storage | 0.25 times (catalog shows 0.1 times for `gemini-4-argon`) | 1024 (Flash) to 4096 (Pro) | implicit about 3 to 5 minutes; explicit 5 minutes |
| xAI Grok, Moonshot, Z.ai | Automatic | Free | 0.2 to 0.25 times | provider-defined | provider-defined |
| Groq | Automatic, Kimi K2 only | Free | 0.5 times | | |
| Alibaba Qwen | Explicit `cache_control` only | 1.25 times | 0.1 times | | 5 minutes |

Sticky routing (what makes caching actually hit): [docs]

- OpenRouter keeps follow-up requests on the same provider endpoint so the provider's cache stays warm. The default sticky key is a hash of the first system/developer message plus the first user message; it activates after the first cache hit. If you send `session_id` (body or `x-session-id` header, up to 256 chars) it activates on any successful request. Expiry: 10 minutes of inactivity, reset by each successful request. If `prompt_cache_key` is present and no `session_id`, it is used as the key.
- Sticky routing is disabled if you set `provider.order`.
- Do not change model slug or routing variant between calls in a session; that changes the key.

Cache design rules that follow for Kairos (these feed the prompt-assembly spec):

1. Order every prompt: system role text (static, versioned) first, then the output schema description, then static few-shot examples, then per-user stable context (confirmed facts block for tailoring), then the per-job variable part last. Never put timestamps, request ids or user names before the variable part.
2. Put the Anthropic `cache_control` breakpoint at the end of the last stable block; use a second breakpoint after the user's confirmed-fact block (stable across all jobs for that user, so many calls reuse it within 5 minutes).
3. The roles run in batches per user (score 20 jobs in a row, tailor three applications), which fits the 5-minute TTL. Use `session_id = "<userId>:<agent>:<batchId>"` so all calls for a batch stick to one endpoint. For nightly bulk scoring, order jobs per user to keep the same prefix hot.
4. Check the minimum prefix: the system prompt plus schema for most agents will be 600 to 1500 tokens, above the 512 minimum for Claude 5.5 and the 1024 OpenAI minimum only if padded with examples. Measure `cached_tokens` per agent in staging; the target is above 60% of input tokens cached on scoring and verification.
5. Caching prices matter most for the verifier and tailoring agents, whose inputs are large and repeated. For OpenAI GPT-5.6+ models write cost is not free (1.25 times); for a prefix that is not reused within the TTL, caching costs more than not caching. The wrapper must support turning cache writes off per request [docs].
6. The ZDR endpoint list marks `supports_implicit_caching` per endpoint. For Azure `gpt-6-luna` it shows false while still listing cache read/write prices; verify real `cached_tokens` in a spike [catalog, unverified behavior].

---

## 7. Usage accounting, cost, and the generation endpoint

[docs] Usage is returned on every response automatically; the old `usage: {include: true}` and `stream_options.include_usage` flags are deprecated and have no effect. Streaming: usage arrives in the final SSE chunk (which, unlike OpenAI, has a non-empty `choices` with a content-free delta).

Response `usage` fields:

- `prompt_tokens`, `completion_tokens`, `total_tokens` (native tokenizer)
- `prompt_tokens_details.cached_tokens`, `.cache_write_tokens`, `.audio_tokens`, `.video_tokens`
- `completion_tokens_details.reasoning_tokens`, `.audio_tokens`, `.image_tokens`
- `cost` (credits, 1 credit = 1 USD)
- `is_byok`
- `cost_details.upstream_inference_cost` (the BYOK upstream charge; 0 or null for non-BYOK), `upstream_inference_prompt_cost`, `upstream_inference_completions_cost`, `server_tool_cost`

Generation stats: `GET https://openrouter.ai/api/v1/generation?id=gen-...` returns `total_cost`, `usage`, `cache_discount`, `tokens_prompt`/`tokens_completion` (OpenRouter-counted), `native_tokens_*` (provider-reported, including `native_tokens_cached`, `native_tokens_reasoning`), `latency`, `generation_time`, `moderation_latency` (ms), `model`, `provider_name`, `provider_responses` (includes failed fallback attempts), `finish_reason`, `native_finish_reason`, `is_byok`, `data_region`, `service_tier`, `session_id`, `external_user`, `app_id`. The docs do not say how long after completion the record becomes available [docs, delay unverified]; treat 404 right after a call as retryable for a few seconds. [docs]

Kairos implications:

- The synchronous `usage.cost` on the response is the source of truth for the per-call ledger; do not depend on the generation endpoint on the hot path. Use the generation endpoint only for a nightly reconciliation job that compares `sum(usage.cost)` in `llm_calls` against the OpenRouter activity/credit balance (alarm if drift exceeds 2%).
- Pass `user: "<hashedUserId>"` (an HMAC of the user id, not the email) so spend is attributable per end user in OpenRouter's own logs, and `session_id` as above. Do not put personal data into `user`, `session_id` or `trace` fields; these are metadata stored by OpenRouter.
- Retries and fallbacks: failed attempts can still be billed for prompt processing (no-content responses) [docs]. The `provider_responses` field of the generation record is the only place to see the cost of fallback attempts.

---

## 8. Rate limits, credits, key limits

[docs]

- Three families of limits: credit limits (HTTP 402), budget limits (HTTP 403), rate limits (HTTP 429).
- Paid models: there is no published fixed per-account requests-per-minute number. Limits come from the upstream provider capacity (429 with `metadata.provider_code`) and from OpenRouter platform protection (Cloudflare DDoS blocks for abusive volume). Capacity is global; creating more keys or accounts does not raise it. Limits differ by model, so spreading across models helps. Plan: ask OpenRouter (Enterprise/sales contact) for a written throughput commitment before the public beta, because at 10,000 users the burst is poll-driven (section 12.3) [unverified: whether higher guaranteed limits are offered].
- Free models (`:free`): 20 requests per minute; 50 per day if fewer than 10 credits ever purchased, 1000 per day with 10 or more. Not used by Kairos.
- Credits: pay-as-you-go balance; per-key credit limit with optional reset (`limit`, `limit_remaining`, `limit_reset`); `GET /api/v1/key` returns the key's limit, remaining, and daily/weekly/monthly usage. An in-flight budget estimates each paid request's maximum cost up front and holds it while the request runs: a 402 with `reason: in_flight_budget_exhausted` is transient (honor `Retry-After`), and `weight_exceeds_budget` means a single request is too large for the budget (lower `max_tokens` or add credits). Enterprise, subscription and invoice-billed accounts, and BYOK-only requests, are exempt from the in-flight budget.
- Budgets (403): guardrail budgets, workspace budgets, key limits, checked in that order; windows reset at 00:00 UTC (daily), Monday (weekly), 1st (monthly). There is no `Retry-After`; use `metadata.resets_at`.
- Low balance (single-digit dollars) or a key near its limit makes OpenRouter run extra database checks and expire caches more aggressively, which adds latency. Keep the balance high with auto top-up. [docs]
- Fees: card top-up fee 5.5% (minimum $0.80), crypto 5%; no markup on inference. [docs: FAQ]. For Kairos this means model spend is effectively 1.055 times provider list price on prepaid card credits; the cost model should use that multiplier or negotiate invoice billing.

Recommended key layout:

| Key | Purpose | Limits |
|---|---|---|
| `kairos-prod-api` | interactive paths (tailor preview, verifier on user approve) | daily key limit sized at 3 times expected daily spend |
| `kairos-prod-batch` | polling, pre-rank, scoring, parse, classify | daily limit; separate so a runaway batch cannot starve interactive calls |
| `kairos-staging`, `kairos-evals` | non-prod | small limits, ZDR still on if real data is ever used (it must not be) |

Cost alarms are built by Kairos itself (daily sum of `usage.cost` per agent, per user and per tier, alert at 80% of the budget envelope) plus the key limit as the hard stop.

---

## 9. Error codes and retry guidance

[docs] Error shape: `{ "error": { "code": number, "message": string, "metadata"?: object } }`. For request-level and credit errors the HTTP status equals `error.code`. For errors during generation the HTTP status is 200 and the error appears in the body or in an SSE event.

| Code | Meaning | Retry? | Kairos handling |
|---|---|---|---|
| 400 | Invalid or missing parameters (including unsupported reasoning settings such as disabling mandatory reasoning, or invalid schema) | No | Bug; fail the job, alert. |
| 401 | Invalid or disabled key | No | Page the on-call; circuit-break all LLM queues. |
| 402 | Insufficient credits or in-flight budget | Only if `limit_source = openrouter_in_flight_budget` and `Retry-After` present; otherwise add credits | Pause queues, alert. |
| 403 | Permission, guardrail block, or moderation flag (`metadata.reasons`, `flagged_input`, `provider_name`); also budget caps | Moderation: no (but a different model may pass: fallback is triggered); budget: wait until `resets_at` | Treat as `llm_blocked`; never auto-retry on the same model. |
| 408 | Timeout | Yes, with backoff | |
| 429 | Rate limited (platform or provider; `metadata.provider_code`) | Yes, honor `Retry-After` | Per-queue concurrency backoff. |
| 502 | Chosen model down or invalid upstream response | Yes (fallback `models` usually handles it) | |
| 503 | No provider meets routing requirements | Not by waiting; fix routing, or let the next model in `models` run | Alert when seen on a primary route; usually means ZDR+schema+max_price cannot be met. |
| 200 with `error` body | Failure after generation began | Check body; retry | Always check `error` and empty `choices`. |
| 200 with `finish_reason: "length"` and empty content | Reasoning ate the budget | No (same budget will fail again) | Increase `max_tokens` or lower effort. |

Streaming: once tokens have been sent, a failure is delivered as an SSE `error` event with `finish_reason: "error"`; provider failover happens only before any token reaches the client. Kairos agents should not stream (all are JSON-schema calls whose output is validated as a whole); non-streaming also enables response healing. [docs]

Retry policy proposed for the gateway: at most 2 retries per model attempt on 408/429/502/5xx-with-body-error, exponential backoff starting at 500 ms with full jitter, capped at 8 s, honoring `Retry-After`; fallback via the `models` array rather than app-level retries when the failure is model-level; at most 1 re-ask on schema-validation failure (with the validation error appended); no retry on 400/401/403-moderation. All retries are made under one BullMQ job and one idempotency key so a retry never double-charges the user or double-writes artifacts.

Idempotency: no idempotency-key header is documented for chat completions [docs]. A retry after an ambiguous failure can double-bill tokens; accept this cost and make the Kairos side idempotent (keyed by `agent_run_id`).

---

## 10. Latency overhead, embeddings, BYOK

### 10.1 Latency

- The docs claim the gateway is "heavily optimized" (Cloudflare Workers at the edge, edge-cached key and user data) but publish no millisecond figure [docs]. A commonly quoted figure of tens of milliseconds added is [unverified]; measure p50/p95 gateway overhead in a staging spike by comparing time-to-first-byte via OpenRouter against a direct provider call.
- New region or cold cache: the first 1 to 2 minutes can be slower; low balance adds latency (section 8).
- Failures add retry latency to the affected request; OpenRouter tracks provider failures and routes around them. [docs]
- Soft knobs: `preferred_max_latency` and `preferred_min_throughput` (percentile forms), `session_id` for KV-cache pinning (about 10 minutes), static prefixes.
- Catalog `latency_last_30m` and `throughput_last_30m` were null for the ZDR endpoint rows at fetch time, so per-model speed numbers could not be captured; the model pages on openrouter.ai show them [catalog].
- Kairos agents are asynchronous BullMQ jobs, not interactive chat, so an extra 100 to 300 ms is immaterial. The only interactive call is the tailoring preview and the on-approve verification, budgeted at 10 s p95 end to end.

### 10.2 Embeddings

OpenRouter does offer embeddings. [docs]

- Endpoint: `POST https://openrouter.ai/api/v1/embeddings`. Body: `model`, `input` (string, array of strings, token arrays, or multimodal content parts), optional `encoding_format` (`float` or `base64`), `dimensions` (integer; honored only by models that support it), `input_type` (`search_query` or `search_document`; honored by models that support it), `provider` (same routing preferences, including `zdr`, `data_collection`, `only`, `order`, `sort`, `max_price`), `session_id`, `user`, `trace`. Streaming not supported. Batching by array is recommended; the maximum batch size is not documented [unverified; use batches of 64 inputs]. Response: `data[].embedding`, `usage.prompt_tokens`, `usage.cost`.
- Rerank endpoint also exists: `POST /api/v1/rerank` (`model`, `query`, `documents`, `top_n`), for example `cohere/rerank-v3.5`. Not on the Kairos critical path (the pre-rank uses embeddings plus rules), but available if the scoring evals show a precision gap.
- Embedding models in the catalog (33 total; selected rows; price per 1M input tokens; ZDR status from the ZDR endpoint list): [catalog]

| Slug | Catalog price | ZDR endpoint(s) and price | Context | Notes |
|---|---|---|---|---|
| `qwen/qwen3-embedding-8b` | 0.010 | Nebius 0.010, DeepInfra US 0.010, SiliconFlow fp8 0.040 | 32,768 | Multilingual, supports variable output dimensions (up to 4096 per the model card) [unverified here]. Best value. |
| `qwen/qwen3-embedding-4b` | 0.020 | DeepInfra US 0.020 | 32,768 | 2560 dimensions per model card [unverified here]. |
| `openai/text-embedding-3-small` | 0.020 | Azure 0.020 | 8,192 | 1536 dimensions, truncatable via `dimensions`; most battle-tested [unverified dims here]. |
| `perplexity/pplx-embed-v1-0.6b` | 0.004 | Perplexity int8 0.004 | 32,000 | Cheapest ZDR; new model, validate retrieval quality in evals. |
| `perplexity/pplx-embed-v1-4b` | 0.030 | Perplexity int8 0.030 | 32,000 | |
| `openai/text-embedding-3-large` | 0.130 | Azure 0.130 | 8,192 | Probably unnecessary. |
| `google/gemini-embedding-001` | 0.150 | Vertex us-central1 0.150 | 20,000 | |
| `google/gemini-embedding-2` | 0.200 | Vertex us/eu/global 0.200 to 0.220 | 8,192 | |
| `mistralai/mistral-embed-2312` | 0.100 | Mistral zdr 0.100, eu 0.110 | 8,192 | |
| `voyageai/voyage-4-lite` / `voyage-4` / `voyage-4-large` | 0.020 / 0.060 / 0.120 | none listed | 32,000 | No ZDR endpoint on OpenRouter; excluded for personal text. |
| `baai/bge-m3`, `thenlper/*`, `intfloat/*`, `sentence-transformers/*`, `baai/bge-*` | 0.005 to 0.010 | none listed | 512 to 8,194 | No ZDR endpoint on OpenRouter. |
| `*:free` embedding models | 0 | none | | Free embedding models state that requests may be retained and used for training; never use. |

Recommendation: embeddings stay on OpenRouter (one key, one ledger, ZDR by flag) using `qwen/qwen3-embedding-8b` as the primary model and `openai/text-embedding-3-small` (Azure ZDR) as a different-vendor fallback, with the constraint that vectors from different models are never mixed: every embedding row stores `embedding_model` and `dims`, a fallback model writes to a separate column or index version, and a re-embed job exists for model changes. If a direct embeddings provider is later preferred: Voyage AI direct has a zero-retention option by contract request [unverified]; OpenAI direct offers zero-data-retention only by approval [unverified]. Cost is negligible either way: 100,000 job descriptions per day at 600 tokens is 60M tokens per day, about $0.60 per day on `qwen3-embedding-8b`.

### 10.3 BYOK (bring your own key)

[docs]

- Keys are added in the workspace under integrations (OpenAI, Azure, AWS Bedrock, Google Vertex, Anthropic, Fireworks, and others on the integrations page). Stored encrypted.
- Fee: BYOK usage is billed at 5% of what the same model and provider would cost on OpenRouter, deducted from OpenRouter credits. A free allowance exists (the docs state $25,000 per month of list-price inference on pay-as-you-go, custom for Enterprise) [docs, as stated].
- Priority: prioritized keys are tried before OpenRouter's shared endpoints; "fallback" keys after. Each prioritized key has a shared-capacity setting: use shared capacity as fallback (default), never for models this key applies to, or never for any model on that provider.
- Data policy (ZDR, `data_collection`) still applies to BYOK endpoints, and a key can declare ZDR if your own agreement is ZDR.
- BYOK spend does not count toward guardrail/workspace budgets unless "Include BYOK spend" is enabled.
- Kairos use: BYOK is a scale and compliance lever, not a launch requirement. At 10,000 users the expected monthly model spend is far below the free allowance, so BYOK would cost nothing in fees; it is useful if (a) a provider enterprise agreement gives higher rate limits or contractual ZDR for Anthropic via Bedrock/Vertex or OpenAI via Azure than the shared pool, or (b) OpenRouter shared capacity throttles. Keep the code path identical: the gateway sends the same request; only the OpenRouter workspace configuration changes. Set "never use shared capacity" on a BYOK key only after the BYOK provider quota is confirmed to cover peak load.

---

## 11. Model shortlists per role class (as of 2026-10-15)

Reading guide:

- "Catalog" price is the model's headline price. "ZDR+SO route" is the cheapest endpoint that is both on the ZDR list and has `structured_outputs`; budget with this one. All prices USD per 1M tokens. "Cached read" is the cache-read price on that route; "cache write" is shown only where nonzero.
- "AA" is the Artificial Analysis intelligence index shown in the catalog's `benchmarks` field; it is a rough, shared yardstick, not a Kairos eval result. Every pick must be re-ranked by the Kairos eval sets.
- "Mand. reasoning" means the model always reasons and bills reasoning tokens as output; the per-call allowance used in the cost table is stated.
- Per-call cost columns use assumptions listed under each table. They are illustrations, not budget numbers; the cost spec owns the budget.
- Context length is the catalog context; some models have tiered pricing above a prompt-length threshold (noted).

### 11.1 Class A: cheap extraction and classification

Uses: resume parsing to structured facts, job description field extraction (salary, sponsorship, location, seniority), email tagging (interview / rejection / offer / ack), form-question typing. Inputs 1 to 4k tokens, outputs 100 to 600 tokens, high volume.

| Slug | Catalog in/out | ZDR+SO route (provider, quant) | Route in / out | Cached read | Context | SO on ZDR route | ZDR endpoints (SO) | Mand. reasoning | AA |
|---|---|---|---|---|---|---|---|---|---|
| `openai/gpt-6-luna` | 0.10 / 0.50 (above 272k prompt: 0.20 / 0.75) | Azure default (also US/EU at +10%) | 0.10 / 0.50 | 0.010 (write 0.125) | 1,050,000 | Yes | 3 (3) | No | 38.1 |
| `anthropic/claude-haiku-5.5` | 0.10 / 0.50 (above 100k prompt: 0.50 / 2.50) | Google Vertex global | 0.10 / 0.50 | 0.010 (write 0.125, 1-h write 0.20) | 1,000,000 | Yes on Vertex; NO on Bedrock | 6 (3) | No (adaptive; can be disabled at effort high or below) | 43.4 |
| `deepseek/deepseek-v4.1-flash` | 0.011 / 0.72 (cheapest endpoint is OpenInference fp4, lowest uptime) | Decart fp4 (also InferenceNet fp8 0.10 / 0.76, Crusoe fp8 0.29 / 1.20) | 0.09 / 0.18 | 0.018 | 1,048,576 | Yes | 26 (22) | No | 39.5 |
| `google/gemma-4-26b-a4b-it` | 0.09 / 0.30 | DeepInfra fp8 (also CoreWeave bf16 0.10 / 0.30 with cache read 0.05) | 0.07 / 0.34 | none (CoreWeave: 0.05) | 262,144 | Yes | 11 (7) | No | 16.7 |
| `openai/gpt-oss-120b` | 0.15 / 0.60 | CoreWeave fp4 (also Crusoe bf16 0.05 / 0.25, DekaLLM bf16 0.03 / 0.18) | 0.03 / 0.17 | 0.030 | 131,072 | Yes | 24 (18) | Yes (low effort available) | 11.6 |

Floor option if only cost matters: `mistralai/mistral-nemo` (DekaLLM fp8 0.018 / 0.030, 131k context, SO yes, 4 SO+ZDR endpoints, no AA score, weakest of the group) [catalog]. `meta-llama/llama-3.1-8b-instruct` has only 1 SO+ZDR endpoint at 0.22 / 0.22 and is not recommended.

Illustrative call: 3,000 input tokens (1,500 cached), 400 output tokens: `gpt-6-luna` $0.00036; `claude-haiku-5.5` $0.00036; `deepseek-v4.1-flash` (Decart) $0.00023; `gemma-4-26b` $0.00035; `gpt-oss-120b` $0.00029 including an 800-token reasoning allowance. All are about $0.0003 per extraction.

Notes: for the email classifier, regex rules stay as the first pass and the model only handles the ambiguous remainder; for DeepSeek, require `quantizations: ["fp8","bf16"]` or accept fp4 only after the extraction eval passes; Haiku 5.5 on Bedrock cannot do strict schemas, so `require_parameters` routes it to Vertex only (single-provider risk).

### 11.2 Class B: mid-tier scoring

Uses: fit score with rubric and rationale on the survivors of pre-ranking, sponsorship-signal reading, per-question answer-type decisions. Inputs 2 to 4k tokens (profile summary cached, job variable), outputs 100 to 300 tokens.

| Slug | Catalog in/out | ZDR+SO route | Route in / out | Cached read | Context | SO | ZDR endpoints (SO) | Mand. reasoning | AA |
|---|---|---|---|---|---|---|---|---|---|
| `openai/gpt-6-luna` | 0.10 / 0.50 | Azure | 0.10 / 0.50 | 0.010 | 1,050,000 | Yes | 3 (3) | No | 38.1 |
| `anthropic/claude-haiku-5.5` | 0.10 / 0.50 | Vertex global | 0.10 / 0.50 | 0.010 | 1,000,000 | Yes (Vertex) | 6 (3) | No | 43.4 |
| `xiaomi/mimo-v2.6-flash` | 0.14 / 0.28 | DeepInfra fp8 | 0.133 / 0.266 | 0.003 | 1,048,576 | Yes | 5 (4) | No | 37.9 |
| `deepseek/deepseek-v4-flash-0731` | 0.016 / 0.64 | DeepInfra fp8 (16 SO+ZDR endpoints in total) | 0.06 / 0.18 | 0.015 | 1,048,576 | Yes | 20 (16) | No | 34.3 |
| `z-ai/glm-5.3-flash` | 0.15 / 0.50 | DeepInfra fp4 (26 SO+ZDR endpoints in total) | 0.075 / 0.25 | 0.015 | 1,048,576 | Yes | 30 (26) | Yes (about 1,000-token allowance) | 41.8 |

Alternates that also pass the filters: `mistralai/mistral-large-4-0` (Mistral ZDR route 0.68 / 2.09, cache read 0.07, AA 38.4, EU vendor, only 2 ZDR endpoints), `google/gemini-3.8-flash` (Vertex flex 0.375 / 1.875, standard 0.75 / 3.75, mandatory reasoning, AA 40.9), `qwen/qwen3.8-27b` (Near AI fp8 0.04 / 1.35, context 262k on that route, AA 33.7), `openai/gpt-5.6-luna` (0.20 / 1.20, dominated by `gpt-6-luna` in this catalog).

Illustrative call: 2,500 input tokens (1,500 cached), 200 output tokens: `gpt-6-luna` $0.00021; `haiku-5.5` $0.00021; `mimo-v2.6-flash` $0.00019; `deepseek-v4-flash-0731` $0.00012; `glm-5.3-flash` $0.00040 (with allowance). About $0.0002 per scored job, so even 20 scored jobs per user per day is about $0.004 per user per day.

### 11.3 Class C: strong drafting (resume line tailoring, answers, cover letter)

Inputs 4 to 8k tokens (confirmed-fact block cached), outputs 800 to 2,000 tokens, quality-critical, user waits for the preview.

| Slug | Catalog in/out | ZDR+SO route | Route in / out | Cached read / write | Context | SO | ZDR endpoints (SO) | Mand. reasoning | AA |
|---|---|---|---|---|---|---|---|---|---|
| `anthropic/claude-sonnet-5.5` | 2.00 / 10.00 | Vertex global (also Bedrock) | 2.00 / 10.00 | 0.10 / 2.50 | 1,000,000 | Yes (3 of 4 ZDR endpoints) | 4 (3) | Yes; adaptive effort low to max, default high; disabling returns 400 | 56.0 |
| `anthropic/claude-sonnet-5` | 2.00 / 10.00 | Vertex global | 2.00 / 10.00 | 0.20 / 2.50 | 1,000,000 | Yes | 6 (3) | No | 38.2 |
| `openai/gpt-6-sol` | 2.00 / 10.00 (above 272k prompt: 4.00 / 15.00) | Azure | 2.00 / 10.00 | 0.20 / 2.50 | 1,050,000 | Yes | 3 (3) | No | 47.6 |
| `google/gemini-4-argon` | 2.00 / 10.00 | Vertex global | 2.00 / 10.00 | 0.10 / 0.188 | 1,048,576 | Yes | 3 (3) | Yes | 52.6 |
| `z-ai/glm-5.3` | 0.11 / 4.80 | Sail Research US fp8 (27 SO+ZDR endpoints in total) | 0.15 / 3.40 | 0.14 | 1,048,576 | Yes | 35 (27) | Yes | 44.8 |

Alternates: `moonshotai/kimi-k3` (0.41 / 14.90 on Wafer, output price high, AA 43.6), `openai/gpt-5.6-terra` (2.00 / 12.00, AA 42.1), `deepseek/deepseek-v4-pro-0813` (best ZDR route Sail Research 0.896 / 0.99, cache read 0.187, AA 36.0, 10 SO+ZDR endpoints), `x-ai/grok-4.7` (2.00 / 6.00, xAI only, mandatory reasoning, AA 46.4).

Illustrative call: 6,000 input tokens (4,000 cached), 1,500 output tokens:

| Model | Cost per draft | Includes |
|---|---|---|
| `claude-sonnet-5.5` | $0.039 | 2,000-token reasoning allowance |
| `gemini-4-argon` | $0.039 | 2,000-token reasoning allowance |
| `claude-sonnet-5` | $0.020 | no reasoning |
| `gpt-6-sol` | $0.020 | no reasoning |
| `glm-5.3` (Sail) | $0.013 | 2,000-token reasoning allowance |

Cost finding that the architecture and cost specs must address: one draft by any $2 / $10 model costs 2 to 4 times the whole TRD target of $0.01 per submitted application. Options, to be decided in the cost spec: (a) draft with a mid-priced model (`glm-5.3` about $0.013, or `gpt-6-luna` at about $0.003 if evals show it meets the truth-lock and quality bars), (b) draft only the lines that need rewriting (bullets, not the whole resume) so outputs are under 500 tokens, (c) use the strong model only for the cover letter and free-text answers on Pro/Max and a mid model for resume bullets, or (d) revise the target to a justified figure such as $0.03 to $0.05 per submitted application, which is still small against a per-credit price. The research shows the $0.01 target is only reachable if the drafter is a Class B/C-cheap model or the strong drafter is used sparingly.

### 11.4 Class D: independent verifier (different model family from the drafter)

Task: given a drafted line/answer/paragraph and the confirmed facts it cites, output per-claim verdicts (`supported`, `unsupported`, `contradicted`) with the supporting fact id. Inputs 2 to 5k tokens, outputs 100 to 400 tokens. The verifier must be from a different family (different training lineage and vendor) than the drafter so the same blind spot does not approve its own error. Pairing rule for the routing table: `family(verifier) != family(drafter)` asserted at config load and in the fallback chain.

| Slug | Family | Catalog in/out | ZDR+SO route | Route in / out | Cached read | Context | SO | ZDR endpoints (SO) | Mand. reasoning | AA |
|---|---|---|---|---|---|---|---|---|---|---|
| `openai/gpt-6-luna` | OpenAI | 0.10 / 0.50 | Azure | 0.10 / 0.50 | 0.010 | 1,050,000 | Yes | 3 (3) | No | 38.1 |
| `anthropic/claude-haiku-5.5` | Anthropic | 0.10 / 0.50 | Vertex global | 0.10 / 0.50 | 0.010 | 1,000,000 | Yes | 6 (3) | No | 43.4 |
| `google/gemini-3.8-flash` | Google | 0.75 / 3.75 | Vertex global flex | 0.375 / 1.875 | 0.037 | 1,048,576 | Yes | 3 (3) | Yes | 40.9 |
| `deepseek/deepseek-v4-flash-0731` | DeepSeek | 0.016 / 0.64 | DeepInfra fp8 | 0.06 / 0.18 | 0.015 | 1,048,576 | Yes | 20 (16) | No | 34.3 |
| `z-ai/glm-5.3-flash` | Z.ai | 0.15 / 0.50 | DeepInfra fp4 | 0.075 / 0.25 | 0.015 | 1,048,576 | Yes | 30 (26) | Yes | 41.8 |

Pairings (the default recommendation of this research, to be confirmed by the evals): drafter Anthropic Sonnet (5 or 5.5) with verifier `gpt-6-luna` and fallback verifier `deepseek-v4-flash-0731`; drafter OpenAI (`gpt-6-sol`/`gpt-6-luna`) with verifier `claude-haiku-5.5` and fallback `glm-5.3-flash`; drafter `glm-5.3` with verifier `gpt-6-luna` or `claude-haiku-5.5`. Never allow the fallback chain of the verifier to include the drafter's family. Because the verifier output feeds a hard gate (422 truth_lock on any unsupported claim), measure false-accept and false-reject rates on a labeled adversarial set before choosing; a stronger verifier (for example Sonnet-class from the other family) can be reserved for claims the cheap verifier marks "uncertain".

Illustrative call: 3,500 input tokens (1,500 cached), 300 output tokens: `gpt-6-luna` $0.00036; `haiku-5.5` $0.00036; `deepseek-v4-flash-0731` $0.00020; `glm-5.3-flash` $0.00050; `gemini-3.8-flash` flex $0.00324 (reasoning allowance of 1,000 tokens included). Verification is cheap enough to run on every line and to run twice (two verifiers) on the final artifact.

### 11.5 Class E: embeddings

See the table in section 10.2. Shortlist (all have ZDR endpoints): 

| Slug | Price per 1M input | ZDR route | Context | Role |
|---|---|---|---|---|
| `qwen/qwen3-embedding-8b` | 0.010 | Nebius or DeepInfra US | 32,768 | Primary for job and fact embeddings (pre-rank) |
| `openai/text-embedding-3-small` | 0.020 | Azure | 8,192 | Different-vendor fallback and sanity baseline |
| `qwen/qwen3-embedding-4b` | 0.020 | DeepInfra US | 32,768 | Smaller-dimension option for index size |
| `perplexity/pplx-embed-v1-0.6b` | 0.004 | Perplexity int8 | 32,000 | Cheapest; evaluate before trusting |
| `google/gemini-embedding-001` | 0.150 | Vertex us-central1 | 20,000 | Premium option if retrieval evals show a gap |

Best no-retention alternative outside OpenRouter, if OpenRouter embeddings ever fall short: [unverified] Voyage AI direct with a zero-retention agreement, or Azure OpenAI embeddings directly under the Azure data-processing terms.

---

## 12. Recommendations for the gateway design (inputs to the architecture spec)

1. **One `LlmGateway` module** is the only code that talks to OpenRouter. Signature in terms of an `AgentCall { agentId, promptVersion, model, fallbacks, schema, maxTokens, reasoningEffort?, sessionId, userHash, cacheBreakpoints }` returning `{ data, usage: { cost, cachedTokens, cacheWriteTokens, reasoningTokens }, servedModel, provider }`. It enforces the per-call provider block of section 5, validates JSON with zod, does at most one repair re-ask, and writes an `llm_calls` row with `usage.cost`.
2. **Provider block defaults**: `{ zdr: true, data_collection: "deny", require_parameters: true, allow_fallbacks: true, max_price: { prompt: 1.5 * budgeted, completion: 1.5 * budgeted } }`. Add `quantizations` per agent where fp4 endpoints are not acceptable.
3. **Throughput and burst**: platform limits for paid models are unpublished. Use per-queue BullMQ rate limiters (requests per second per queue) and global concurrency, back off on 429 honoring `Retry-After`, and request a written throughput commitment from OpenRouter before beta. Spread agents over different models and providers (Class A on DeepInfra/Azure/Vertex, Class D on a different vendor) so one provider's 429 does not stall the pipeline.
4. **Budgets**: per-user daily scoring cap and per-agent daily dollar envelope enforced before the call from `llm_calls`; key-level OpenRouter limit as the hard stop; alert at 80% of the daily envelope; a nightly job reconciles `sum(usage.cost)` against the OpenRouter balance change.
5. **Observability fields to persist per call**: agent id, prompt version, requested model, served model, provider, input/output/cached/reasoning tokens, cost, latency, finish reason, retry count, fallback used, schema validation result, `session_id`, hashed user id.
6. **Nightly catalog drift job**: download `/api/v1/models` and `/api/v1/endpoints/zdr`; for each configured slug assert it still exists, still has at least 2 endpoints that are ZDR and `structured_outputs`, price is within +25% of the stored price, context length is unchanged, `expiration_date` is null, and the family constraint holds; open an alert and auto-disable a failing primary (fall to the next in the chain) rather than paging.
7. **Reasoning settings per agent**: set `reasoning.effort` low (or disable where allowed) for Classes A, B and D; leave drafting at the lowest effort that passes evals; size `max_tokens` as expected output plus reasoning allowance; never treat `finish_reason: "length"` as success.
8. **Do not use**: OpenRouter plugins or server tools (except `response-healing` after confirming its data handling), `:free` variants, `:batch` variants (no ZDR endpoint in this catalog), moving `~...-latest` aliases, `provider.order` (kills load balancing and sticky routing) except for temporary pinning, logging opt-ins.
9. **Prompt-injection posture at the gateway**: job descriptions, form questions and emails are untrusted. The gateway wraps them in a delimited, labeled block, never in `system`, and every schema output is re-validated (enum-restricted fields, citations must exist in the fact set) outside the model. No agent receives tools in the OpenRouter sense except where retrieval is explicitly justified; `tool_choice: required` is not used (rejected by Claude 5.5 models anyway).

---

## 13. Open items to settle in a spike before the specs freeze

| Item | Why | How |
|---|---|---|
| Gateway overhead and p95 latency under ZDR+schema routing | The docs give no number | 200 calls to each shortlisted model; compare to direct provider |
| Real cache hit rates on Azure `gpt-6-luna` and Vertex Haiku/Sonnet | Catalog flags `supports_implicit_caching = false` on these ZDR routes, yet lists cache prices | Send the same 1,500-token prefix 20 times with a fixed `session_id`; read `cached_tokens` |
| Whether Vertex-only routing for Haiku 5.5 strict schemas gives acceptable availability | Bedrock endpoints lack `structured_outputs` | 7-day uptime sample; define fallback to `gpt-6-luna` |
| Throughput commitment | Paid-model limits unpublished | Written answer from OpenRouter sales/support |
| Response-healing plugin data handling | Plugin retention is not documented | Ask support; otherwise skip the plugin and rely on one re-ask |
| Retention sampling disclosure | Residual anonymous sampling of prompts | Review privacy policy; consider Enterprise terms; record in the DPA |
| Embedding dimensions and quality of `qwen3-embedding-8b` versus `text-embedding-3-small` | Dimension and quality numbers not in the catalog | Retrieval eval on 500 labeled (user, job) pairs; pick index dimension (for example 1024 via Matryoshka truncation if supported) |
| Region pinning for EU users | Request-level region switch not documented | Test `provider.only` with regional tags (`google-vertex/europe`, `azure/eu`, `amazon-bedrock/eu-west-1`) |
