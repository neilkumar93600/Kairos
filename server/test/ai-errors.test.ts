import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AgentError, type BudgetRefusal } from "../src/llm/errors";
import { LlmError } from "../src/services/llm";
import { errorHandler } from "../src/middleware/error-handler";

/** 03-agent-runtime 5.5 and 9.3 (llm-agents-30, v03): a model failure is never a 500 "something went wrong". */
function appThrowing(err: Error) {
  const app = express();
  app.get("/x", () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

const budget = (scope: BudgetRefusal["scope"], retryAfter: BudgetRefusal["retryAfter"] = "now") =>
  new AgentError("budget_stopped", "resume-writer refused by budget scope", false, undefined, { scope, retryAfter });

describe("AgentError over HTTP", () => {
  it.each([
    ["overloaded after retries", new AgentError("overloaded", "x", true)],
    ["limiter timeout", new AgentError("limiter_timeout", "x", true)],
    ["circuit open", new AgentError("circuit_open", "x", false)],
    ["auth", new AgentError("auth", "x", false)],
    ["schema invalid after repair", new AgentError("schema_invalid", "x", false)],
    ["a per-call cost refusal", budget("call")],
    ["the legacy client", new LlmError("LLM request failed")],
  ])("%s answers 503 ai_unavailable", async (_name, err) => {
    const res = await request(appThrowing(err)).get("/x");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("ai_unavailable");
    expect(res.body.error.message).toBe("The writing assistant is busy. Try again in a minute.");
  });

  it("a refusal answers 422 ai_refused", async () => {
    const res = await request(appThrowing(new AgentError("refusal", "resume-writer: model refused", false))).get("/x");
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: "ai_refused", message: "The assistant could not write this one. Try a different line or add a fact." });
  });

  it.each(["user_pipeline", "user_interactive"] as const)("a %s budget stop answers 429 daily_allowance with resetsAt", async (scope) => {
    const res = await request(appThrowing(budget(scope, "next_utc_day"))).get("/x");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("rate_limited");
    expect(res.body.error.details.reason).toBe("daily_allowance");
    expect(res.body.error.details.resetsAt).toMatch(/T00:00:00\.000Z$/);
  });

  it.each(["agent", "global", "shed"] as const)("a %s budget stop answers 429 service_budget", async (scope) => {
    const res = await request(appThrowing(budget(scope))).get("/x");
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: "rate_limited", details: { reason: "service_budget" } });
  });

  it("never echoes the internal message", async () => {
    const res = await request(appThrowing(new AgentError("overloaded", "fit-scorer: overloaded at claude-haiku-5-5", true))).get("/x");
    expect(JSON.stringify(res.body)).not.toContain("fit-scorer");
  });
});
