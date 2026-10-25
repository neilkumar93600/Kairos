import type { ClaudeModel } from "../agents/types";

/**
 * The only place prices live (03-agent-runtime.md 8.1). A price change is a code change with a
 * changelog line here; the cost unit test pins costOf against hand-computed values.
 */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

/** USD per million tokens. */
export const PRICE_TABLE: Record<ClaudeModel, ModelPrice> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite5m: 2.5, cacheWrite1h: 4 },
};

export const BATCH_DISCOUNT = 0.5; // Message Batches, applied to every token class [verify cache classes in S-A1]
export const HAIKU_LONG_PROMPT_TOKENS = 100_000; // above this Haiku 5.5 bills 5x; the gateway refuses such prompts
export const PRICES_AS_OF = "2026-10-23";

/** Token usage as the Anthropic Messages API reports it. */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number } | null;
}

/**
 * USD cost of one response from its token counts. When the per-TTL breakdown is absent, cache
 * writes are priced at the 5-minute rate.
 */
export function costOf(model: ClaudeModel, u: Usage, isBatch = false): number {
  const p = PRICE_TABLE[model];
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const write5m = u.cache_creation?.ephemeral_5m_input_tokens ?? u.cache_creation_input_tokens ?? 0;
  const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  // total input_tokens is the uncached remainder after the last breakpoint [V]
  const uncached = Math.max(0, u.input_tokens - cacheRead - write5m - write1h);
  const factor = isBatch ? BATCH_DISCOUNT : 1;
  const usd =
    (uncached * p.input +
      write5m * p.cacheWrite5m +
      write1h * p.cacheWrite1h +
      cacheRead * p.cacheRead +
      u.output_tokens * p.output) /
    1e6;
  return usd * factor;
}
