import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureGateway } from "../src/llm/gateway";
import { Budget } from "../src/llm/budget";
import { memorySpendStore } from "../src/llm/spend-store";
import { fakeAnthropic, type FakeAnthropic } from "../src/llm/testing";
import { resetBreakers } from "../src/llm/breaker";
import { resetLimiter } from "../src/llm/limiter";
import { draftAnswer } from "../src/services/draft-writer";

/**
 * The gateway spy of 03-agent-runtime 15.3 (INV-9): a sensitive or profile question never reaches the model, on the
 * gateway path with a full call context. Gate-failed scoring pairs are spied in scoring-controls.int.test.ts (INV-1).
 */
describe("gateway spy", () => {
  let fake: FakeAnthropic;
  beforeEach(() => {
    resetBreakers();
    resetLimiter();
    fake = fakeAnthropic([
      { content: [{ type: "text", text: JSON.stringify({ text: "I built it.", factIds: ["f1"] }) }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 } },
    ]);
    configureGateway({
      client: () => fake,
      budget: new Budget(memorySpendStore()),
      writeRow: async () => "x",
      sleep: async () => {},
      flags: () => ({ llmPaused: false, batchPaused: false, disabled: {}, promptPin: {} }),
    });
  });
  afterEach(() => configureGateway({ writeRow: async () => null }));

  const job = { title: "Engineer", company: "Acme", descriptionText: "Build APIs." };
  const facts = [{ id: "f1", kind: "role", text: "Built the billing API at Initech" }];
  const ctx = { userId: "u1", plan: "pro" as const, applicationId: "a1", jobId: "j1", budgetClass: "interactive" as const };

  it.each([
    "Are you legally authorized to work in the United States?",
    "Will you now or in the future require visa sponsorship?",
    "What is your gender?",
    "Veteran status",
    "Do you have a disability?",
    "Date of birth",
    "Email",
    "Phone number",
    "LinkedIn profile",
  ])("sends nothing for %j", async (label) => {
    await expect(draftAnswer({ label, job, facts }, { callCtx: ctx })).rejects.toMatchObject({ code: "profile_only" });
    expect(fake.requests).toHaveLength(0);
  });

  it("positive control: an ordinary question does reach the model, with the user's hash", async () => {
    await draftAnswer({ label: "Why do you want this job?", job, facts }, { callCtx: ctx });
    expect(fake.requests).toHaveLength(1);
    expect((fake.requests[0]!.metadata as { user_id?: string }).user_id).toMatch(/^[0-9a-f]{32}$/);
  });
});
