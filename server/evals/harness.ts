import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { AGENTS, type RegisteredAgent } from "../src/agents/registry";
import type { AgentCallContext, AgentSpec } from "../src/agents/types";
import type { AnswerDrafterInput } from "../src/agents/answer-drafter/schema";
import { Budget } from "../src/llm/budget";
import { resetBreakers } from "../src/llm/breaker";
import { createAnthropicClient, type AnthropicLike, type SentResponse } from "../src/llm/client";
import { configureGateway, runAgent } from "../src/llm/gateway";
import { resetLimiter } from "../src/llm/limiter";
import { canonicalJson } from "../src/llm/schema";
import { memorySpendStore } from "../src/llm/spend-store";
import { fakeAnthropic, type ScriptedResponse } from "../src/llm/testing";
import { draftAnswer } from "../src/services/draft-writer";
import { parseResumeToFacts, type ResumeContact } from "../src/services/resume-parser";
import { classifySensitive, isProfileQuestion } from "../src/services/sensitive";
import { grade, verdictTally, type CaseTag, type EvalCase, type Failure, type GraderId, type VerdictTally } from "./graders";

/**
 * The eval runner (03-agent-runtime 13.4, 15.2). Every case goes through the production entry of its agent (runAgent,
 * and the parser and answer services where they filter before the model), so render, the input schema, zod,
 * postValidate and the echo canary all run as in production; only the client differs:
 *  - fixtures (default): the recorded or hand-written replies in <agent>/fixtures/<case>.json, no network;
 *  - live: the kairos-evals workspace (ANTHROPIC_KEY_EVALS), capped at maxUsd;
 *  - record (npm run llm:record): live, and the replies are written as the case's fixture.
 * <agent>/negatives.jsonl holds bad replies the graders must catch; they are replayed in every mode, never sent.
 * ponytail: cases run one at a time (the spec says concurrency 8); a live run of today's sets takes minutes.
 */

export const EVALS_DIR = dirname(fileURLToPath(import.meta.url));
const TAGS = ["golden", "adversarial", "injection", "self_preference", "sensitive", "regression", "refine", "hard", "fresh_public"] as const satisfies readonly CaseTag[];
const GRADERS = ["fixture", "budget", "schema", "fact_ids", "containment", "sensitive", "injection_echo", "verdict"] as const satisfies readonly GraderId[];
/** The labelled-set pass bars as fractions (B.9.10; agents/08 9 and 09 6). The escalation's false-reject figure is advisory. */
export const VERDICT_BARS: Partial<Record<RegisteredAgent, { falseAccept: number; falseReject: number }>> = {
  "claim-verifier": { falseAccept: 0.01, falseReject: 0.08 },
  "claim-verifier-escalation": { falseAccept: 0.005, falseReject: 1 },
};
const VERDICT = z.enum(["supported", "unsupported", "contradicted", "uncertain"]);
/** Re-run `repeat` times in live mode: no sampling setting makes a reply deterministic (13.4). */
const ZERO_TOLERANCE: CaseTag[] = ["adversarial", "injection", "sensitive", "self_preference"];

const caseSchema = z
  .object({
    id: z.string().regex(/^[a-z-]+-\d{4}$/),
    agentId: z.enum(Object.keys(AGENTS) as [RegisteredAgent, ...RegisteredAgent[]]),
    tags: z.array(z.enum(TAGS)).min(1),
    input: z.record(z.string(), z.unknown()),
    expect: z
      .object({
        mustNotClaim: z.array(z.string().min(1)).optional(),
        mustNotAppear: z.array(z.string().min(1)).optional(),
        abstain: z.literal("sensitive").optional(),
        label: z.number().min(0).max(100).optional(),
        verdicts: z.record(z.string(), VERDICT).optional(),
        acceptable: z.record(z.string(), z.array(VERDICT).min(1)).optional(),
      })
      .strict(),
    cleanTwinOf: z.string().optional(),
    source: z.enum(["synthetic", "public_posting"]),
    addedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().optional(),
  })
  .strict();

/** One model reply. `text` is the reply text, or for readability the JSON object it parses to. */
const replySchema = z.object({
  text: z.union([z.string(), z.record(z.string(), z.unknown())]),
  stop_reason: z.string().default("end_turn"),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_read_input_tokens: z.number().optional(),
      cache_creation_input_tokens: z.number().optional(),
    })
    .default({ input_tokens: 0, output_tokens: 0 }),
});
type Reply = z.input<typeof replySchema>;

const fixtureSchema = z.object({
  caseId: z.string(),
  promptVersion: z.number().int(),
  /** The prompt fingerprint (system text and schema snapshot) the replies answered; a mismatch means stale. */
  promptSha256: z.string().regex(/^[0-9a-f]{64}$/),
  /** sha256 of the canonical case input; a mismatch means the case changed after the replies were made. */
  inputHash: z.string().regex(/^[0-9a-f]{64}$/),
  source: z.enum(["recorded", "hand_written"]),
  recordedAt: z.string().optional(),
  /** Every successful send of the case in order: primary, then a repair or tier-up when there was one. */
  responses: z.array(replySchema).min(1),
});
type Fixture = z.input<typeof fixtureSchema>;

const negativeSchema = z.object({
  caseId: z.string(),
  failsOn: z.array(z.enum(GRADERS)).min(1),
  note: z.string().min(1),
  responses: z.array(replySchema).min(1),
});

export interface RunOptions {
  mode: "fixtures" | "live" | "record";
  dir?: string;
  agents?: string[];
  caseIds?: string[];
  /** live and record: no case starts whose worst case could take the run's spend past this (default 5). */
  maxUsd?: number;
  /** live and record: zero-tolerance cases run this many times. */
  repeat?: number;
  /** live and record: the client, default the kairos-evals workspace. Tests inject a fake. */
  liveClient?: () => AnthropicLike;
}

export interface CaseResult {
  agentId: RegisteredAgent;
  caseId: string;
  tags: CaseTag[];
  /** A negative: a bad reply the graders must catch. Its failures are the graders that missed it. */
  negative: boolean;
  failures: Failure[];
  costUsd: number;
  /** The verifier labels' counts for this case; zero-tolerance reruns add up. */
  tally?: VerdictTally;
}

export interface VerdictBar {
  agentId: RegisteredAgent;
  claims: number;
  falseAcceptRate: number;
  falseRejectRate: number;
  ok: boolean;
}

export interface Report {
  mode: RunOptions["mode"];
  results: CaseResult[];
  /** The false-accept and false-reject rates of each labelled agent. Fixture replies only prove the plumbing. */
  verdictBars: VerdictBar[];
  spentUsd: number;
  passed: boolean;
}

export const inputHash = (input: unknown): string => createHash("sha256").update(canonicalJson(input)).digest("hex");

function readJsonl<T>(path: string, schema: z.ZodType<T>): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .flatMap((line, i) => {
      if (!line.trim()) return [];
      const parsed = schema.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`${path}:${i + 1}: ${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
      return [parsed.data];
    });
}

function loadCases(dir: string, agentId: RegisteredAgent): EvalCase[] {
  const path = join(dir, agentId, "cases.jsonl");
  if (!existsSync(path)) throw new Error(`${agentId} has no golden set at ${path} (its spec.evalSet)`);
  const cases = readJsonl(path, caseSchema) as EvalCase[];
  const seen = new Set<string>();
  for (const c of cases) {
    if (c.agentId !== agentId || !c.id.startsWith(`${agentId}-`)) throw new Error(`${path}: ${c.id} belongs to another agent`);
    if (seen.has(c.id)) throw new Error(`${path}: duplicate case id ${c.id}`);
    seen.add(c.id);
  }
  return cases;
}

function loadFixture(dir: string, c: EvalCase): Fixture | null {
  const path = join(dir, c.agentId, "fixtures", `${c.id}.json`);
  if (!existsSync(path)) return null;
  const fx = fixtureSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (fx.caseId !== c.id) throw new Error(`${path}: caseId ${fx.caseId} does not match the file name`);
  return fx;
}

/** Why a fixture cannot stand in for the current prompt and case, or null when it can (15.2). */
function staleness(fx: Fixture | null, c: EvalCase, spec: AgentSpec<unknown, unknown>): string | null {
  const hint = `re-record with npm run llm:record -- --agent ${c.agentId} --case ${c.id}`;
  const current = spec.prompts[spec.promptVersion]!.fingerprint;
  if (!fx) return `no fixture; ${hint}`;
  if (fx.promptVersion !== spec.promptVersion || fx.promptSha256 !== current) {
    return `fixture answered prompt v${fx.promptVersion} ${fx.promptSha256.slice(0, 12)}; current is v${spec.promptVersion} ${current.slice(0, 12)}; ${hint}`;
  }
  if (fx.inputHash !== inputHash(c.input)) return `the case input changed after its fixture was made; ${hint}`;
  return null;
}

const scripted = (r: Reply): ScriptedResponse => {
  const p = replySchema.parse(r);
  return { content: [{ type: "text", text: typeof p.text === "string" ? p.text : JSON.stringify(p.text) }], stop_reason: p.stop_reason, usage: p.usage };
};

/** Wraps the live client: keeps every request body and every reply, for the graders and for llm:record. */
function capturing(real: AnthropicLike): AnthropicLike & { requests: Record<string, unknown>[]; replies: Reply[] } {
  const requests: Record<string, unknown>[] = [];
  const replies: Reply[] = [];
  return {
    requests,
    replies,
    messages: {
      async create(params, options): Promise<SentResponse> {
        requests.push(params);
        const sent = await real.messages.create(params, options);
        const text = sent.data.content.find((b) => b.type === "text")?.text ?? "";
        let parsed: unknown = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // kept as the raw text: a reply that is not JSON is part of what the eval grades
        }
        const u = sent.data.usage;
        replies.push({
          text: parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : text,
          stop_reason: sent.data.stop_reason ?? "end_turn",
          usage: { input_tokens: u.input_tokens, output_tokens: u.output_tokens, cache_read_input_tokens: u.cache_read_input_tokens ?? 0, cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0 },
        });
        return sent;
      },
    },
  };
}

const NO_CONTACT: ResumeContact = { name: "", email: "", links: [] };

/** The production entry of each agent: what a route or worker calls, minus storage. */
async function entry(agentId: RegisteredAgent, input: Record<string, unknown>, ctx: AgentCallContext): Promise<unknown> {
  if (agentId === "resume-parser") {
    // The service drops personal-details lines and the contact header before the model sees anything.
    const i = input as { resumeText: string; contact?: ResumeContact };
    return { facts: await parseResumeToFacts(i.resumeText, i.contact ?? NO_CONTACT, ctx) };
  }
  if (agentId === "answer-drafter") {
    // Protected and profile questions go to the service, which must refuse them before any model call (INV-9): removing
    // that guard sends a request, and the sensitive grader fails the case.
    const i = input as AnswerDrafterInput;
    if (classifySensitive(i.label) || isProfileQuestion(i.label)) return draftAnswer({ ...i, savedAnswers: i.savedAnswers ?? undefined }, { callCtx: ctx });
  }
  return (await runAgent(AGENTS[agentId] as AgentSpec<unknown, unknown>, input, ctx)).data;
}

function addTally(result: CaseResult, c: EvalCase, outcome: { output?: unknown; error?: unknown }): void {
  // A call that errored judged nothing: every label counts against it, through an empty output.
  const t = verdictTally(c, outcome.error === undefined ? outcome.output : undefined);
  if (!t) return;
  const a = result.tally ?? { goldNegative: 0, falseAccept: 0, goldPositive: 0, falseReject: 0 };
  result.tally = { goldNegative: a.goldNegative + t.goldNegative, falseAccept: a.falseAccept + t.falseAccept, goldPositive: a.goldPositive + t.goldPositive, falseReject: a.falseReject + t.falseReject };
}

async function runCase(c: EvalCase, client: AnthropicLike & { requests: Record<string, unknown>[] }, live: boolean) {
  resetBreakers();
  resetLimiter();
  let costUsd = 0;
  configureGateway({
    client: () => client,
    budget: new Budget(memorySpendStore()),
    writeRow: async (row) => {
      costUsd += row.costUsd;
      return "eval";
    },
    sleep: live ? (ms) => new Promise((resolve) => setTimeout(resolve, ms)) : async () => {},
    flags: () => ({ llmPaused: false, batchPaused: false, disabled: {}, promptPin: {} }),
  });
  // budget_class 'eval' (13.4): never counted against a user's caps; one synthetic user per case.
  const ctx: AgentCallContext = { userId: `eval-${c.id}`, plan: "pro", budgetClass: "eval" };
  try {
    return { outcome: { output: await entry(c.agentId, c.input as Record<string, unknown>, ctx), requests: client.requests }, costUsd };
  } catch (error) {
    return { outcome: { error, requests: client.requests }, costUsd };
  }
}

/** The most one runAgent can spend: four sends on the model, four on the tier-up model (2.6). */
const worstCaseUsd = (spec: AgentSpec<unknown, unknown>) => 4 * spec.maxCostPerCallUsd + (spec.tierUp ? 4 * spec.tierUp.maxCostPerCallUsd : 0);

export async function runEval(opts: RunOptions): Promise<Report> {
  const dir = opts.dir ?? EVALS_DIR;
  const maxUsd = opts.maxUsd ?? 5;
  const results: CaseResult[] = [];
  let spentUsd = 0;

  for (const agentId of Object.keys(AGENTS) as RegisteredAgent[]) {
    if (opts.agents && !opts.agents.includes(agentId)) continue;
    const spec = AGENTS[agentId] as AgentSpec<unknown, unknown>;
    const cases = loadCases(dir, agentId).filter((c) => !opts.caseIds || opts.caseIds.includes(c.id));

    for (const c of cases) {
      const result: CaseResult = { agentId, caseId: c.id, tags: c.tags, negative: false, failures: [], costUsd: 0 };
      results.push(result);
      if (opts.mode === "fixtures") {
        const fx = loadFixture(dir, c);
        // A protected question is never sent, so it has nothing to record: any request at all is the leak.
        const stale = c.expect.abstain === "sensitive" && !fx ? null : staleness(fx, c, spec);
        if (stale) {
          result.failures.push({ grader: "fixture", detail: stale });
          continue;
        }
        const { outcome, costUsd } = await runCase(c, fakeAnthropic(fx?.responses.map(scripted) ?? []), false);
        result.costUsd = costUsd;
        result.failures.push(...grade(c, outcome));
        addTally(result, c, outcome);
        continue;
      }

      const runs = c.tags.some((t) => ZERO_TOLERANCE.includes(t)) ? Math.max(1, opts.repeat ?? 1) : 1;
      for (let k = 0; k < runs; k++) {
        if (spentUsd + worstCaseUsd(spec) > maxUsd) {
          result.failures.push({ grader: "budget", detail: `not run: its worst case could take the run past $${maxUsd} (spent $${spentUsd.toFixed(4)})` });
          break;
        }
        const client = capturing((opts.liveClient ?? (() => createAnthropicClient("evals")))());
        const { outcome, costUsd } = await runCase(c, client, true);
        spentUsd += costUsd;
        result.costUsd += costUsd;
        result.failures.push(...grade(c, outcome).map((f) => (runs > 1 ? { ...f, detail: `run ${k + 1}: ${f.detail}` } : f)));
        addTally(result, c, outcome);
        if (opts.mode === "record" && k === 0 && client.replies.length) {
          const fixture: Fixture = {
            caseId: c.id,
            promptVersion: spec.promptVersion,
            promptSha256: spec.prompts[spec.promptVersion]!.fingerprint,
            inputHash: inputHash(c.input),
            source: "recorded",
            recordedAt: new Date().toISOString(),
            responses: client.replies,
          };
          mkdirSync(join(dir, agentId, "fixtures"), { recursive: true });
          writeFileSync(join(dir, agentId, "fixtures", `${c.id}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
        }
      }
    }

    // Negatives: replayed in every mode and never sent, so the graders prove on each run that they still catch them.
    for (const n of readJsonl(join(dir, agentId, "negatives.jsonl"), negativeSchema)) {
      const c = cases.find((x) => x.id === n.caseId);
      if (!c && opts.caseIds) continue; // its case is filtered out
      if (!c) throw new Error(`${join(dir, agentId, "negatives.jsonl")}: no case ${n.caseId}`);
      const caught = new Set(grade(c, (await runCase(c, fakeAnthropic(n.responses.map(scripted)), false)).outcome).map((f) => f.grader));
      results.push({
        agentId,
        caseId: c.id,
        tags: c.tags,
        negative: true,
        failures: n.failsOn.filter((g) => !caught.has(g)).map((g) => ({ grader: g, detail: `missed a bad output: ${n.note}` })),
        costUsd: 0,
      });
    }
  }
  const verdictBars = (Object.keys(VERDICT_BARS) as RegisteredAgent[]).flatMap((agentId): VerdictBar[] => {
    const tallies = results.filter((r) => r.agentId === agentId && !r.negative && r.tally).map((r) => r.tally!);
    if (!tallies.length) return [];
    const sum = (k: keyof VerdictTally) => tallies.reduce((n, t) => n + t[k], 0);
    const falseAcceptRate = sum("falseAccept") / Math.max(1, sum("goldNegative"));
    const falseRejectRate = sum("falseReject") / Math.max(1, sum("goldPositive"));
    const bar = VERDICT_BARS[agentId]!;
    return [{ agentId, claims: sum("goldNegative") + sum("goldPositive"), falseAcceptRate, falseRejectRate, ok: falseAcceptRate <= bar.falseAccept && falseRejectRate <= bar.falseReject }];
  });
  return { mode: opts.mode, results, verdictBars, spentUsd, passed: results.length > 0 && results.every((r) => r.failures.length === 0) && verdictBars.every((b) => b.ok) };
}

/** A markdown table per agent, then every failure; CI appends it to the job summary. */
export function formatReport(report: Report): string {
  const lines = [
    "| agent | cases | passed | invented detail | protected leaks | injection echo | schema | cost (USD) |",
    "|---|---|---|---|---|---|---|---|",
  ];
  const agents = [...new Set(report.results.map((r) => r.agentId))];
  const had = (r: CaseResult, ...graders: GraderId[]) => r.failures.some((f) => graders.includes(f.grader));
  for (const agentId of agents) {
    const rs = report.results.filter((r) => r.agentId === agentId && !r.negative);
    const invented = rs.filter((r) => had(r, "containment", "fact_ids")).length;
    lines.push(
      `| ${agentId} | ${rs.length} | ${rs.filter((r) => !r.failures.length).length} | ${rs.length ? Math.round((100 * invented) / rs.length) : 0}% | ` +
        `${rs.filter((r) => had(r, "sensitive")).length} | ${rs.filter((r) => had(r, "injection_echo")).length} | ${rs.filter((r) => had(r, "schema")).length} | ` +
        `${rs.reduce((usd, r) => usd + r.costUsd, 0).toFixed(4)} |`,
    );
  }
  const negatives = report.results.filter((r) => r.negative);
  lines.push("", `Grader self-tests: ${negatives.filter((r) => !r.failures.length).length} of ${negatives.length} bad outputs caught.`);
  for (const b of report.verdictBars) {
    const bar = VERDICT_BARS[b.agentId]!;
    const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
    lines.push(`Labelled claims, ${b.agentId}: ${b.claims}; false accept ${pct(b.falseAcceptRate)} (bar ${pct(bar.falseAccept)}), false reject ${pct(b.falseRejectRate)} (bar ${pct(bar.falseReject)}): ${b.ok ? "ok" : "OVER THE BAR"}${report.mode === "fixtures" ? ", from fixtures, which prove the plumbing only; real rates need --live" : ""}.`);
  }
  const failed = report.results.filter((r) => r.failures.length);
  if (failed.length) lines.push("");
  for (const r of failed) for (const f of r.failures) lines.push(`- FAIL ${r.caseId}${r.negative ? " (negative)" : ""} [${f.grader}] ${f.detail}`);
  lines.push("", `eval (${report.mode}): ${report.passed ? "PASS" : "FAIL"}, $${report.spentUsd.toFixed(4)} spent`);
  return lines.join("\n");
}
