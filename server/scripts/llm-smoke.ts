/**
 * S-A1 live smoke (01-architecture spike S-A1, 03-agent-runtime 17): one real call per registered agent through runAgent,
 * plus two repeat fit-scorer calls to see the prompt cache. Checks that every schema snapshot, thinking setting and
 * request shape is accepted, and prints tokens, cache reads and cost per call. Spends real money, so it refuses to run
 * unless ALLOW_LLM_NETWORK=1, and stops before any call that could take the total past LLM_SMOKE_MAX_USD (default 0.50).
 * Nothing is written to a database: the budget is in memory and the would-be llm_calls rows are printed.
 *
 *   Dry run, no network, no key (builds every request against a fake client):
 *     LLM_SMOKE_DRY=1 npm run llm:smoke -w @auto-career/server
 *   Live (the owner, with the staging workspace keys):
 *     ALLOW_LLM_NETWORK=1 ANTHROPIC_KEY_INTERACTIVE=... ANTHROPIC_KEY_BATCH=... USER_HASH_KEY=... npm run llm:smoke -w @auto-career/server
 *
 * Exit code 0 when every agent answered with a valid reply (live) or reached the client (dry run), 1 otherwise.
 */

const dry = process.env.LLM_SMOKE_DRY === "1";
if (!dry && process.env.ALLOW_LLM_NETWORK !== "1") {
  console.error("llm:smoke makes real Anthropic calls and spends money. Set ALLOW_LLM_NETWORK=1 to run it, or LLM_SMOKE_DRY=1 for a dry run.");
  process.exit(2);
}
const maxUsd = Number(process.env.LLM_SMOKE_MAX_USD ?? "0.50");

// env() parses the whole server schema; the smoke never touches these, so placeholders stand in when they are unset.
process.env.DATABASE_URL ??= "postgres://unused:unused@localhost:5432/unused";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.BETTER_AUTH_SECRET ??= "smoke-placeholder-secret-not-used-anywhere";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.WEB_ORIGIN ??= "http://localhost:3000";
process.env.INBOUND_WEBHOOK_SECRET ??= "smoke-placeholder";
process.env.NODE_ENV = "development"; // never production: the smoke must not look like a production process
process.env.LOG_LEVEL ??= "warn"; // the rows below say everything the per-call log lines would
if (dry) process.env.USER_HASH_KEY ??= Buffer.alloc(32, 9).toString("base64");

const { configureGateway, runAgent } = await import("../src/llm/gateway");
const { Budget } = await import("../src/llm/budget");
const { memorySpendStore } = await import("../src/llm/spend-store");
const { createAnthropicClient } = await import("../src/llm/client");
const { fakeAnthropic } = await import("../src/llm/testing");
const { AGENTS } = await import("../src/agents/registry");
type CallRow = import("../src/llm/ledger").CallRow;

const rows: CallRow[] = [];
configureGateway({
  budget: new Budget(memorySpendStore()),
  client: dry ? () => fakeAnthropic([{ status: 401, type: "authentication_error" }]) : (workspace) => createAnthropicClient(workspace),
  writeRow: async (row) => {
    rows.push(row);
    return String(rows.length);
  },
});

// Synthetic, non-personal inputs: no real person, employer or contact detail is sent.
const facts = [
  { id: "f1", kind: "role", text: "Backend Engineer at Example Co from 2022 to 2025" },
  { id: "f2", kind: "metric", text: "Billing API served 40,000 invoices a month" },
  { id: "f3", kind: "skill", text: "TypeScript and PostgreSQL" },
];
const posting = "We build payment APIs in TypeScript on PostgreSQL. You have two or more years of backend experience and care about reliability.";
const inputs: Record<keyof typeof AGENTS, unknown> = {
  "fit-scorer": {
    profileSummary: facts.map((f) => `- (${f.kind}) ${f.text}`).join("\n"),
    job: { title: "Backend Engineer", companyName: "Sample Payments", location: "Remote", remote: true, descriptionText: posting },
  },
  "resume-parser": {
    resumeText: "Experience\nBackend Engineer, Example Co (2022 to 2025)\n- Built a billing API in TypeScript serving 40,000 invoices a month\nSkills: TypeScript, PostgreSQL",
  },
  "resume-tailor": { facts, job: { title: "Backend Engineer", companyName: "Sample Payments", descriptionText: posting } },
  "resume-writer": {
    scope: "line",
    refine: null,
    resumeView: "Section [exp] Experience (experience)\n  Entry [e1] Backend Engineer | Example Co {heading cites f1}\n    Line [l1] Worked on billing {cites f2}",
    facts,
    noteFact: null,
    job: null,
    maxSuggestions: 3,
  },
  "answer-drafter": {
    label: "Why are you interested in this role?",
    facts,
    savedAnswers: null,
    job: { title: "Backend Engineer", company: "Sample Payments", descriptionText: posting },
  },
  "cover-letter-writer": { facts, job: { title: "Backend Engineer", company: "Sample Payments", descriptionText: posting } },
};

const ctx = { userId: "s-a1-smoke-user", plan: "pro" as const };
const runs: (keyof typeof AGENTS)[] = [...(Object.keys(AGENTS) as (keyof typeof AGENTS)[]), "fit-scorer", "fit-scorer"];
let failed = 0;
const spent = () => rows.reduce((usd, r) => usd + r.costUsd, 0);

for (const id of runs) {
  const spec = AGENTS[id];
  // Worst case of one runAgent: four sends on the model, four on the tier-up model (2.6).
  const worst = 4 * spec.maxCostPerCallUsd + (spec.tierUp ? 4 * spec.tierUp.maxCostPerCallUsd : 0);
  if (spent() + worst > maxUsd) {
    console.error(`stop: ${id} could take spend past LLM_SMOKE_MAX_USD=${maxUsd} (spent ${spent().toFixed(4)}, worst case ${worst.toFixed(4)})`);
    failed += 1;
    break;
  }
  const before = rows.length;
  try {
    // One userId throughout, so the repeat fit-scorer calls send a byte-identical cached prefix (7.1).
    const out = await runAgent(spec as (typeof AGENTS)["fit-scorer"], inputs[id] as never, ctx);
    console.log(`ok    ${id.padEnd(20)} ${out.model}  tieredUp=${out.tieredUp}  attempts=${out.attempts}`);
  } catch (err) {
    const code = (err as { code?: string }).code ?? "error";
    const reachedClient = rows.length > before || code === "auth";
    if (dry && reachedClient && code === "auth") {
      console.log(`dry   ${id.padEnd(20)} request built and handed to the client`);
    } else {
      failed += 1;
      console.log(`FAIL  ${id.padEnd(20)} ${code}`);
    }
  }
  for (const r of rows.slice(before)) {
    console.log(
      `      ${r.status.padEnd(14)} ${r.model}  in=${r.inputTokens} cacheRead=${r.cacheReadTokens} cacheWrite=${r.cacheWriteTokens} out=${r.outputTokens}` +
        `  usd=${r.costUsd.toFixed(6)}  kind=${r.callKind}  userHash=${r.userHash ? "yes" : "no"}  request=${r.providerRequestId ?? "-"}${r.errorCode ? `  error=${r.errorCode}` : ""}`,
    );
  }
}

const scorer = rows.filter((r) => r.agentId === "fit-scorer" && r.status === "ok");
const cacheShare = (r: CallRow) => r.cacheReadTokens / Math.max(1, r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens);
if (scorer.length >= 2) console.log(`fit-scorer cache share on the repeat calls: ${scorer.slice(1).map((r) => (cacheShare(r) * 100).toFixed(0) + "%").join(", ")} (S-A1 target at least 55%)`);
console.log(`${dry ? "dry run" : "live"}: ${rows.length} rows, $${spent().toFixed(6)} spent, ${failed ? `${failed} FAILED` : "all agents passed"}`);
process.exit(failed ? 1 : 0);
