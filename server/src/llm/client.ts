import Anthropic from "@anthropic-ai/sdk";
import { env } from "../lib/env";

/**
 * SDK construction (03-agent-runtime.md 2.2). Only gateway.ts (and later batch.ts, drift.ts,
 * reconcile.ts) may import this module. maxRetries stays 0: the gateway owns retries so every
 * attempt gets its own llm_calls row.
 */
export type Workspace = "interactive" | "batch" | "evals" | "staging";

/** What every send returns after `.withResponse()` unwrapping; the fake in llm/testing.ts builds it too. */
export interface SentResponse {
  data: {
    content: { type: string; text?: string }[];
    stop_reason: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number | null;
      cache_creation_input_tokens?: number | null;
      cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number } | null;
    };
  };
  requestId: string | null;
  rateRemaining: { requests: number | null; inputTokens: number | null; outputTokens: number | null };
  /** The organization per-model request limit behind the remaining header, when it is sent. */
  rateLimitRequests: number | null;
  retryAfterSeconds: number | null;
}

/** The slice of the SDK the gateway uses; tests inject a fake with the same shape. */
export interface AnthropicLike {
  messages: {
    create(params: Record<string, unknown>, options?: { timeout?: number; signal?: AbortSignal }): Promise<SentResponse>;
  };
}

function keyFor(workspace: Workspace): string | undefined {
  const e = env();
  return workspace === "batch" ? e.ANTHROPIC_KEY_BATCH : workspace === "evals" ? e.ANTHROPIC_KEY_EVALS : e.ANTHROPIC_KEY_INTERACTIVE;
}

export function createAnthropicClient(workspace: Workspace): AnthropicLike {
  const e = env();
  if (e.NODE_ENV === "test" && e.ALLOW_LLM_NETWORK !== 1) {
    throw new Error("real Anthropic client constructed in tests; set ALLOW_LLM_NETWORK=1 only in evals and llm:record");
  }
  const key = keyFor(workspace) ?? e.ANTHROPIC_API_KEY;
  if (!key) throw new Error(`ANTHROPIC key for workspace ${workspace} is not set`);
  const client = new Anthropic({
    apiKey: key,
    baseURL: e.ANTHROPIC_BASE_URL, // undefined in production (env zod refuses any other value there)
    maxRetries: 0,
    timeout: 120_000,
  });
  return {
    messages: {
      async create(params, options) {
        const { data, response } = await client.messages
          .create(params as unknown as Anthropic.MessageCreateParamsNonStreaming, options)
          .withResponse();
        return {
          data,
          requestId: response.headers.get("request-id"),
          rateRemaining: {
            requests: numberHeader(response.headers.get("anthropic-ratelimit-requests-remaining")),
            inputTokens: numberHeader(response.headers.get("anthropic-ratelimit-input-tokens-remaining")),
            outputTokens: numberHeader(response.headers.get("anthropic-ratelimit-output-tokens-remaining")),
          },
          rateLimitRequests: numberHeader(response.headers.get("anthropic-ratelimit-requests-limit")),
          retryAfterSeconds: secondsHeader(response.headers.get("retry-after")),
        };
      },
    },
  };
}

function numberHeader(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function secondsHeader(value: string | null): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}
