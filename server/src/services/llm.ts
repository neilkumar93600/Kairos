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

/**
 * Calls any OpenAI-compatible chat completions endpoint (set by LLM_BASE_URL) and returns
 * JSON validated against `schema`. Provider and models are env-configured, so switching
 * providers when cost per application moves is a config change.
 */
export async function chatJson<S extends z.ZodType>(opts: {
  tier: ModelTier;
  messages: ChatMessage[];
  schema: S;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}): Promise<z.infer<S>> {
  const e = env();
  if (!e.LLM_API_KEY) throw new LlmError("LLM_API_KEY is not set");
  const model = opts.tier === "fast" ? e.LLM_MODEL_FAST : e.LLM_MODEL_SMART;
  const started = Date.now();
  const res = await (opts.fetchImpl ?? fetch)(`${e.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${e.LLM_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new LlmError(`LLM request failed with ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  logger.debug({ model, ms: Date.now() - started, usage: body.usage }, "llm call");
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("LLM returned no content");
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new LlmError("LLM returned invalid JSON");
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new LlmError(`LLM JSON failed validation: ${parsed.error.message.slice(0, 300)}`);
  return parsed.data;
}
