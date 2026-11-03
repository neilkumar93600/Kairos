import { afterEach, describe, expect, it, vi } from "vitest";

/** The gateway client reads only its workspace key (03-agent-runtime 16.1); constructing one opens no socket. */
describe("createAnthropicClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("never falls back to the legacy ANTHROPIC_API_KEY: a missing workspace key is an auth failure", async () => {
    vi.stubEnv("ALLOW_LLM_NETWORK", "1");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-legacy");
    vi.stubEnv("ANTHROPIC_KEY_INTERACTIVE", "sk-interactive");
    vi.stubEnv("ANTHROPIC_KEY_BATCH", "");
    vi.resetModules();
    const { createAnthropicClient } = await import("../../src/llm/client");
    expect(() => createAnthropicClient("batch")).toThrow(expect.objectContaining({ code: "auth", message: expect.stringContaining("ANTHROPIC_KEY_BATCH") }));
    expect(createAnthropicClient("interactive").messages.create).toBeTypeOf("function");
  });

  it("refuses a real client in tests without ALLOW_LLM_NETWORK", async () => {
    vi.stubEnv("ANTHROPIC_KEY_INTERACTIVE", "sk-interactive");
    vi.resetModules();
    const { createAnthropicClient } = await import("../../src/llm/client");
    expect(() => createAnthropicClient("interactive")).toThrow(/ALLOW_LLM_NETWORK/);
  });
});
