import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { anthropicClient, chatJson, costUsd, LlmError } from "../src/services/llm";

const schema = z.object({ n: z.number() });

/** Fake Anthropic client: each call returns the next canned text. */
function fake(...texts: string[]) {
  const create = vi.fn(async () => ({
    content: [{ type: "text", text: texts.shift() ?? "" }],
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  }));
  return { client: { messages: { create } }, create };
}

const messages = [
  { role: "system" as const, content: "be terse" },
  { role: "user" as const, content: "hi" },
];

describe("chatJson", () => {
  it("parses valid JSON", async () => {
    const { client } = fake('{"n":1}');
    expect(await chatJson({ tier: "fast", messages, schema, client })).toEqual({ n: 1 });
  });

  it("throws LlmError on invalid JSON", async () => {
    const { client } = fake("not json");
    await expect(chatJson({ tier: "fast", messages, schema, client })).rejects.toBeInstanceOf(LlmError);
  });

  it("throws LlmError on schema mismatch", async () => {
    const { client } = fake('{"n":"x"}');
    await expect(chatJson({ tier: "fast", messages, schema, client })).rejects.toBeInstanceOf(LlmError);
  });

  it("sends system prompt as cached top-level system and maps other roles", async () => {
    const { client, create } = fake('{"n":1}');
    await chatJson({ tier: "fast", messages, schema, client });
    const p = (create.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(p.system).toEqual([{ type: "text", text: "be terse", cache_control: { type: "ephemeral" } }]);
    expect(p.messages).toEqual([{ role: "user", content: "hi" }]);
    expect((p.output_config as { format: { type: string } }).format.type).toBe("json_schema");
  });

  it("sends a strict-output schema without keywords structured output rejects", async () => {
    const limited = z.object({
      s: z.string().min(1).max(5),
      n: z.number().int().min(0).max(100),
      xs: z.array(z.object({ t: z.string().max(9) })).min(1).max(3),
    });
    const { client, create } = fake('{"s":"a","n":1,"xs":[{"t":"x"}]}');
    await chatJson({ tier: "fast", messages, schema: limited, client });
    const p = (create.mock.calls[0] as unknown[])[0] as { output_config: { format: { schema: unknown } } };
    const banned = new Set(["minLength", "maxLength", "maxItems", "minimum", "maximum", "$schema"]);
    const keys: string[] = [];
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === "object")
        for (const [k, child] of Object.entries(v)) {
          keys.push(k);
          walk(child);
        }
    };
    walk(p.output_config.format.schema);
    expect(keys.filter((k) => banned.has(k))).toEqual([]);
    expect(p.output_config.format.schema).toMatchObject({ type: "object", additionalProperties: false });
  });

  it("still enforces limits in code after the response", async () => {
    const { client } = fake('{"n":500}');
    await expect(chatJson({ tier: "fast", messages, schema: z.object({ n: z.number().int().max(100) }), client })).rejects.toBeInstanceOf(LlmError);
  });

  it("logs usage at info with the agent name", async () => {
    const { logger } = await import("../src/lib/logger");
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    try {
      const { client } = fake('{"n":1}');
      await chatJson({ tier: "fast", messages, schema, client, agent: "fit-score" });
      expect(info).toHaveBeenCalledWith(expect.objectContaining({ agent: "fit-score", model: "claude-haiku-5-5", inputTokens: 10 }), "llm call");
    } finally {
      info.mockRestore();
    }
  });

  it("maps tiers to models", async () => {
    const a = fake('{"n":1}');
    await chatJson({ tier: "fast", messages, schema, client: a.client });
    const b = fake('{"n":1}');
    await chatJson({ tier: "smart", messages, schema, client: b.client });
    expect((a.create.mock.calls[0] as unknown[])[0]).toMatchObject({ model: "claude-haiku-5-5" });
    expect((b.create.mock.calls[0] as unknown[])[0]).toMatchObject({ model: "claude-sonnet-5-5" });
  });

  it("escalates a failed fast response to smart once", async () => {
    const { client, create } = fake("garbage", '{"n":2}');
    const out = await chatJson({ tier: "fast", messages, schema, client, escalateOnInvalid: true });
    expect(out).toEqual({ n: 2 });
    expect(create).toHaveBeenCalledTimes(2);
    expect((create.mock.calls[1] as unknown[])[0]).toMatchObject({ model: "claude-sonnet-5-5" });
  });

  it("does not escalate by default", async () => {
    const { client, create } = fake("garbage", '{"n":2}');
    await expect(chatJson({ tier: "fast", messages, schema, client })).rejects.toBeInstanceOf(LlmError);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("builds the shared client with a 60 s timeout", () => {
    expect(anthropicClient("k").timeout).toBe(60_000);
  });

  it("throws LlmError when the API key is missing and no client is injected", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(chatJson({ tier: "fast", messages, schema })).rejects.toBeInstanceOf(LlmError);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});

describe("costUsd", () => {
  it("prices haiku and sonnet per million tokens", () => {
    const u = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000 };
    expect(costUsd("claude-haiku-5-5", u)).toBeCloseTo(0.1 + 0.5 + 0.01 + 0.125);
    expect(costUsd("claude-sonnet-5-5", u)).toBeCloseTo(2 + 10 + 0.1 + 2.5);
  });

  it("returns null for unknown models", () => {
    expect(costUsd("mystery", { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 })).toBeNull();
  });
});
