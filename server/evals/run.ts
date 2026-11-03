/**
 * npm run eval (03-agent-runtime 13.4). Grades every golden case of every registered agent.
 *
 *   npm run eval                                   recorded fixtures, no network, no key (CI on every agent change)
 *   npm run eval -- --agent resume-tailor --case resume-tailor-0003
 *   ALLOW_LLM_NETWORK=1 ANTHROPIC_KEY_EVALS=... npm run eval -- --live [--repeat 3] [--max-usd 5]
 *   ALLOW_LLM_NETWORK=1 ANTHROPIC_KEY_EVALS=... npm run llm:record -- --agent <id> [--case <id>]
 *
 * --live and --record spend real money in the kairos-evals workspace, so they refuse to run without ALLOW_LLM_NETWORK=1,
 * and no case starts whose worst case could take the run past --max-usd (default 5). Exit 0 when every case and every
 * negative passed, 1 when any failed, 2 on a usage error.
 */
import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    agent: { type: "string", multiple: true },
    case: { type: "string", multiple: true },
    live: { type: "boolean", default: false },
    record: { type: "boolean", default: false },
    repeat: { type: "string" },
    "max-usd": { type: "string" },
  },
});
const mode = values.record ? "record" : values.live ? "live" : "fixtures";
if (mode !== "fixtures") {
  if (process.env.ALLOW_LLM_NETWORK !== "1") {
    console.error(`--${mode} calls the Anthropic API and spends money. Set ALLOW_LLM_NETWORK=1 to run it; plain npm run eval needs no network.`);
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_KEY_EVALS) {
    console.error(`--${mode} runs in the kairos-evals workspace: set ANTHROPIC_KEY_EVALS (never a production key).`);
    process.exit(2);
  }
}

// env() parses the whole server schema; the eval touches none of these, so placeholders stand in when they are unset.
process.env.DATABASE_URL ??= "postgres://unused:unused@localhost:5432/unused";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.BETTER_AUTH_SECRET ??= "eval-placeholder-secret-not-used-anywhere";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.WEB_ORIGIN ??= "http://localhost:3000";
process.env.INBOUND_WEBHOOK_SECRET ??= "eval-placeholder";
// Under NODE_ENV=test the real client refuses to exist without ALLOW_LLM_NETWORK=1 (15.1): a second lock on spend.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL ??= "warn";
// Fixed, so the per-user fence nonces and user hashes of the synthetic eval users are the same on every machine.
process.env.USER_HASH_KEY ??= Buffer.alloc(32, 20).toString("base64");

const { formatReport, runEval } = await import("./harness");
const report = await runEval({
  mode,
  agents: values.agent,
  caseIds: values.case,
  repeat: values.repeat ? Number(values.repeat) : undefined,
  maxUsd: values["max-usd"] ? Number(values["max-usd"]) : undefined,
});
const text = formatReport(report);
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Evals (${mode})\n\n${text}\n`);
process.exit(report.passed ? 0 : 1);
