import { PRICE_TABLE } from "./prices";
import type { ClaudeModel } from "../agents/types";

/**
 * Conservative token estimate for Claude 5.5 tokenizers: one token per 3 UTF-8 bytes (9.2).
 */
export const estimateInputTokens = (parts: string[]): number =>
  Math.ceil(parts.reduce((n, p) => n + Buffer.byteLength(p, "utf8"), 0) / 3);

/** Worst case: every input token uncached, every output token used. */
export const estimateCallUsd = (inputTokens: number, maxTokens: number, model: ClaudeModel): number =>
  (inputTokens * PRICE_TABLE[model].input + maxTokens * PRICE_TABLE[model].output) / 1e6;

/** Requests the gateway refuses outright: far above the 100k tokens where Haiku 5.5 bills 5x. */
export const MAX_PROMPT_TOKENS = 50_000;
