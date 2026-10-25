import type { AnthropicLike, SentResponse } from "./client";

/**
 * The fake Anthropic client (03-agent-runtime.md 15.2). Importable only from server/test/** and
 * server/evals/** (a lint rule forbids it in src); unit tests never touch the network.
 */

export interface ScriptedError {
  status: number;
  type?: string;
  retryAfter?: number;
  /** The send throws after this many milliseconds. */
  timeoutMs?: number;
}

export interface ScriptedResponse {
  content: { type: "text"; text: string }[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
  };
}

export type Scripted = ScriptedResponse | ScriptedError;

const isResponse = (s: Scripted): s is ScriptedResponse => (s as ScriptedResponse).content !== undefined;

export interface FakeAnthropic extends AnthropicLike {
  /** The bodies of every create() call, in order, for request-shape assertions. */
  requests: Record<string, unknown>[];
}

/**
 * Answers each call from the script in order; wraps around when exhausted. Scripted errors throw an
 * SDK-shaped error (status, error.type, headers) so classifyError sees what the real client throws.
 */
export function fakeAnthropic(script: Scripted[]): FakeAnthropic {
  const requests: Record<string, unknown>[] = [];
  let cursor = 0;
  return {
    requests,
    messages: {
      async create(params) {
        requests.push(params);
        const item = script[cursor % Math.max(1, script.length)];
        cursor += 1;
        if (!item) throw sdkError(500, "api_error");
        if (!isResponse(item)) {
          if (item.timeoutMs) {
            const err = new Error("Request timed out");
            err.name = "AbortError";
            throw err;
          }
          throw sdkError(item.status, item.type ?? "api_error", item.retryAfter);
        }
        return {
          data: {
            content: item.content,
            stop_reason: item.stop_reason,
            usage: {
              input_tokens: item.usage.input_tokens,
              output_tokens: item.usage.output_tokens,
              cache_read_input_tokens: item.usage.cache_read_input_tokens ?? 0,
              cache_creation_input_tokens: item.usage.cache_creation_input_tokens ?? 0,
              cache_creation: item.usage.cache_creation ?? null,
            },
          },
          requestId: "req_fake_0001",
          rateRemaining: { requests: 999, inputTokens: 999_999, outputTokens: 99_999 },
          rateLimitRequests: 2_000,
          retryAfterSeconds: null,
        } satisfies SentResponse;
      },
    },
  };
}

function sdkError(status: number, type: string, retryAfter?: number): Error & { status: number; error: { type: string }; headers: Record<string, string> } {
  const err = new Error(`${status} ${type}`) as Error & { status: number; error: { type: string }; headers: Record<string, string> };
  err.status = status;
  err.error = { type };
  err.headers = retryAfter ? { "retry-after": String(retryAfter) } : {};
  return err;
}
