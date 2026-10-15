/**
 * Thin client for OpenRouter's chat completions endpoint (OpenAI-compatible, plus routing fields).
 * Every call asks for strict JSON-schema output, refuses providers that train on or retain prompts,
 * and returns OpenRouter's own cost figure so spend is recorded from the bill, not estimated.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  /** Primary model first, then fallbacks. OpenRouter tries them in order when one is down or refuses. */
  models: readonly string[];
  messages: ChatMessage[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  /** Opaque per-user id (never an email) so OpenRouter can attribute abuse reports. */
  user?: string;
}

export interface CompletionUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  costUsd: number;
}

export interface CompletionResult {
  content: string;
  /** The model that actually answered, which differs from models[0] after a fallback. */
  model: string;
  provider: string | null;
  generationId: string | null;
  finishReason: string | null;
  usage: CompletionUsage;
}

export interface ClientConfig {
  apiKey: string;
  baseUrl: string;
  /** Restrict routing to zero-data-retention endpoints. */
  requireZdr: boolean;
  appUrl: string;
  fetchImpl?: typeof fetch;
}

export class OpenRouterError extends Error {
  override name = "OpenRouterError";
  constructor(
    message: string,
    /** HTTP status, or 0 for network failures and timeouts. */
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

// 408 timeout, 429 rate limit, 5xx provider trouble. 400/401/402/403 will fail the same way again.
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export async function createCompletion(req: CompletionRequest, cfg: ClientConfig): Promise<CompletionResult> {
  const [primary, ...fallbacks] = req.models;
  if (!primary) throw new OpenRouterError("no model configured", 400, false);

  const body = {
    model: primary,
    ...(fallbacks.length ? { models: req.models } : {}),
    messages: req.messages,
    temperature: req.temperature,
    max_tokens: req.maxTokens,
    response_format: { type: "json_schema", json_schema: { name: req.schemaName, strict: true, schema: req.jsonSchema } },
    provider: {
      // Skip any endpoint that cannot honour strict structured output instead of silently ignoring it.
      require_parameters: true,
      data_collection: "deny",
      ...(cfg.requireZdr ? { zdr: true } : {}),
    },
    usage: { include: true },
    ...(req.user ? { user: req.user } : {}),
  };

  let res: Response;
  try {
    res = await (cfg.fetchImpl ?? fetch)(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
        "HTTP-Referer": cfg.appUrl,
        "X-Title": "Kairos",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(req.timeoutMs),
    });
  } catch (err) {
    throw new OpenRouterError(`request failed: ${err instanceof Error ? err.message : String(err)}`, 0, true);
  }

  const text = await res.text();
  if (!res.ok) throw new OpenRouterError(`OpenRouter ${res.status}: ${text.slice(0, 300)}`, res.status, RETRYABLE.has(res.status));

  let json: OpenRouterResponse;
  try {
    json = JSON.parse(text) as OpenRouterResponse;
  } catch {
    throw new OpenRouterError("OpenRouter returned a non-JSON body", 502, true);
  }
  // Upstream failures can arrive as a 200 with an error object.
  if (json.error) {
    const status = Number(json.error.code) || 502;
    throw new OpenRouterError(`OpenRouter error ${status}: ${String(json.error.message).slice(0, 300)}`, status, RETRYABLE.has(status));
  }
  const choice = json.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== "string" || content.length === 0) throw new OpenRouterError("OpenRouter returned no content", 502, true);

  return {
    content,
    model: json.model ?? primary,
    provider: json.provider ?? null,
    generationId: json.id ?? null,
    finishReason: choice?.finish_reason ?? null,
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      cachedTokens: json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      costUsd: json.usage?.cost ?? 0,
    },
  };
}

interface OpenRouterResponse {
  id?: string;
  model?: string;
  provider?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  error?: { code?: number | string; message?: string };
}
