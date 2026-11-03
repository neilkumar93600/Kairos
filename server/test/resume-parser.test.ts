import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Budget } from "../src/llm/budget";
import { configureGateway } from "../src/llm/gateway";
import { memorySpendStore } from "../src/llm/spend-store";
import { fakeAnthropic, type FakeAnthropic } from "../src/llm/testing";
import { resetBreakers } from "../src/llm/breaker";
import { resetLimiter } from "../src/llm/limiter";
import { kept, leaks, profile, resumeText } from "./fixtures/sensitive-resume";

const chatJson = vi.hoisted(() => vi.fn());
vi.mock("../src/services/llm", () => ({ chatJson }));
const { parseResumeToFacts } = await import("../src/services/resume-parser");

const reply = { facts: [{ kind: "skill", text: "TypeScript", sourceSpan: "TypeScript" }] };

/** The seeded fail-closed test (CISO mustFix 6): no contact or personal-details line reaches the model, on either path. */
function expectRedacted(sent: string) {
  for (const leak of leaks) expect(sent, leak).not.toContain(leak);
  for (const line of kept) expect(sent).toContain(line);
}

describe("parseResumeToFacts redaction", () => {
  beforeEach(() => chatJson.mockReset());

  it("sends none of the seeded lines on the legacy path", async () => {
    chatJson.mockResolvedValue(reply);
    await parseResumeToFacts(resumeText, profile);
    expectRedacted(JSON.stringify(chatJson.mock.calls[0]![0].messages));
  });

  describe("on the gateway path", () => {
    let fake: FakeAnthropic;
    beforeEach(() => {
      resetBreakers();
      resetLimiter();
      fake = fakeAnthropic([
        { content: [{ type: "text", text: JSON.stringify(reply) }], stop_reason: "end_turn", usage: { input_tokens: 500, output_tokens: 100 } },
      ]);
      configureGateway({
        client: () => fake,
        budget: new Budget(memorySpendStore()),
        writeRow: async () => "call-1",
        sleep: async () => {},
        flags: () => ({ llmPaused: false, batchPaused: false, disabled: {}, promptPin: {} }),
      });
    });
    afterEach(() => configureGateway({ writeRow: async () => null }));

    it("sends none of the seeded lines", async () => {
      expect(await parseResumeToFacts(resumeText, profile, { userId: "u1" })).toEqual(reply.facts);
      expect(fake.requests).toHaveLength(1);
      expectRedacted(JSON.stringify(fake.requests[0]));
    });
  });
});
