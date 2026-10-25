import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

export type ModelTier = "fast" | "smart";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class LlmError extends Error {
  override name = "LlmError";
}

/** The slice of the Anthropic client we use; tests inject a fake. */
export interface LlmClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<{
      content: { type: string; text?: string }[];
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number | null;
        cache_creation_input_tokens?: number | null;
      };
    }>;
  };
}

/** USD per million tokens. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
};

/** Dollar cost of one call from token counts, or null for a model not in the price table. */
export function costUsd(
  model: string,
  u: { input: number; output: number; cacheRead: number; cacheWrite: number },
): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1e6;
}

/** The production client: the SDK retries 429/5xx twice; a call that hangs fails after 60 s. */
export const anthropicClient = (apiKey: string) => new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });

let shared: Anthropic | undefined;
function sharedClient(): Anthropic {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) throw new LlmError("ANTHROPIC_API_KEY is not set");
  return (shared ??= anthropicClient(key));
}

async function callOnce<S extends z.ZodType>(
  client: LlmClient,
  model: string,
  opts: { messages: ChatMessage[]; schema: S; maxTokens?: number; agent?: string },
): Promise<z.infer<S>> {
  const system = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => ({ type: "text" as const, text: m.content, cache_control: { type: "ephemeral" as const } }));
  const messages = opts.messages.filter((m) => m.role !== "system") as {
    role: "user" | "assistant";
    content: string;
  }[];
  // The SDK's helper makes the schema strict-output safe: additionalProperties false, and limits it cannot send
  // (minLength, maximum, maxItems, $schema...) moved into descriptions. safeParse below still enforces them.
  // ponytail: SDK 1.1.0's transform also moves string `enum` into the description, so enums are checked in code, not
  // decoded; an off-enum reply fails the call. Re-attach enums after the transform if that shows up in the logs.
  const { type, schema } = zodOutputFormat(opts.schema);
  const started = Date.now();
  let res;
  try {
    res = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 1500,
      ...(system.length ? { system } : {}),
      messages,
      // output_config.format is typed in SDK 1.1.0: native JSON-schema output, no forced-tool workaround needed.
      output_config: { format: { type, schema } },
    });
  } catch (err) {
    throw new LlmError(`LLM request failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300));
  }
  const u = {
    input: res.usage.input_tokens,
    output: res.usage.output_tokens,
    cacheRead: res.usage.cache_read_input_tokens ?? 0,
    cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
  };
  // info, not debug: these lines are the per-agent cost log (FR-57) and must reach production logs.
  logger.info(
    {
      agent: opts.agent ?? null,
      model,
      ms: Date.now() - started,
      inputTokens: u.input,
      cacheReadTokens: u.cacheRead,
      cacheWriteTokens: u.cacheWrite,
      outputTokens: u.output,
      usd: costUsd(model, u),
    },
    "llm call",
  );
  const text = res.content.find((b) => b.type === "text");
  if (!text?.text) throw new LlmError("LLM returned no content");
  let json: unknown;
  try {
    json = JSON.parse(text.text);
  } catch {
    throw new LlmError("LLM returned invalid JSON");
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new LlmError(`LLM JSON failed validation: ${parsed.error.message.slice(0, 300)}`);
  return parsed.data;
}

/**
 * Calls the Anthropic Messages API and returns JSON validated against `schema`.
 * System messages are sent as a cached top-level `system` block. With `escalateOnInvalid`,
 * a fast-tier response that fails validation is retried once on the smart tier.
 */
export async function chatJson<S extends z.ZodType>(opts: {
  tier: ModelTier;
  messages: ChatMessage[];
  schema: S;
  maxTokens?: number;
  /** Names the caller in the cost log, e.g. "tailor". */
  agent?: string;
  client?: LlmClient;
  escalateOnInvalid?: boolean;
}): Promise<z.infer<S>> {
  const e = env();
  const client = opts.client ?? sharedClient();
  const model = opts.tier === "fast" ? e.ANTHROPIC_MODEL_FAST : e.ANTHROPIC_MODEL_SMART;
  try {
    return await callOnce(client, model, opts);
  } catch (err) {
    if (!(opts.escalateOnInvalid && opts.tier === "fast" && err instanceof LlmError)) throw err;
    // ponytail: escalates on any LlmError (incl. transport); narrow to validation errors if that gets costly
    return callOnce(client, e.ANTHROPIC_MODEL_SMART, opts);
  }
}
