import { describe, expect, it } from "vitest";
import { BATCH_DISCOUNT, costOf, HAIKU_LONG_PROMPT_TOKENS, PRICE_TABLE } from "../../src/llm/prices";

/** Pins costOf against hand-computed values (03-agent-runtime.md 8.1). */
describe("costOf", () => {
  it("prices uncached input and output", () => {
    // 1,000 uncached Haiku input + 100 output = (1000 * 0.1 + 100 * 0.5) / 1e6
    const usd = costOf("claude-haiku-5-5", { input_tokens: 1000, output_tokens: 100 });
    expect(usd).toBeCloseTo((1000 * 0.1 + 100 * 0.5) / 1e6, 12);
  });

  it("treats reported input_tokens as the uncached remainder after cache classes", () => {
    // The API reports total input including cache classes [V]; costOf subtracts them.
    // uncached 300, read 500, write 200: (300*0.1 + 500*0.01 + 200*0.125 + 100*0.5)/1e6
    const usd = costOf("claude-haiku-5-5", {
      input_tokens: 1000,
      output_tokens: 100,
      cache_read_input_tokens: 500,
      cache_creation_input_tokens: 200,
    });
    expect(usd).toBeCloseTo((300 * 0.1 + 500 * 0.01 + 200 * 0.125 + 100 * 0.5) / 1e6, 12);
  });

  it("prices 1-hour cache writes at 2x when the per-TTL breakdown is present", () => {
    // uncached 300, 5m write 200, 1h write 500: (300*0.1 + 200*0.125 + 500*0.2 + 100*0.5)/1e6
    const usd = costOf("claude-sonnet-5-5", {
      input_tokens: 1000,
      output_tokens: 100,
      cache_creation_input_tokens: 700,
      cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 500 },
    });
    expect(usd).toBeCloseTo((300 * 2 + 200 * 2.5 + 500 * 4 + 100 * 10) / 1e6, 12);
  });

  it("applies the batch discount to every token class", () => {
    const u = { input_tokens: 1000, output_tokens: 100 };
    expect(costOf("claude-haiku-5-5", u, true)).toBeCloseTo(costOf("claude-haiku-5-5", u) * BATCH_DISCOUNT, 15);
  });

  it("never prices a negative uncached remainder", () => {
    const usd = costOf("claude-haiku-5-5", {
      input_tokens: 100,
      output_tokens: 10,
      cache_read_input_tokens: 500,
      cache_creation_input_tokens: 500,
    });
    expect(usd).toBeGreaterThanOrEqual(0);
  });

  it("keeps the 100k Haiku long-prompt boundary in the table", () => {
    expect(HAIKU_LONG_PROMPT_TOKENS).toBe(100_000);
    expect(PRICE_TABLE["claude-sonnet-5-5"].output).toBe(10);
  });
});
