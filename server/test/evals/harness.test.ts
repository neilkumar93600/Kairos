import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatReport, inputHash, runEval } from "../../evals/harness";
import { resumeTailor } from "../../src/agents/resume-tailor/spec";
import { fakeAnthropic } from "../../src/llm/testing";

const input = {
  facts: [
    { id: "f1", kind: "role", text: "Backend Engineer at Quillon Labs from 2021 to 2024" },
    { id: "f2", kind: "metric", text: "Cut invoice processing time by 30%" },
  ],
  job: { title: "Platform Engineer", companyName: "Fernwood Analytics", descriptionText: "Billing APIs on Kubernetes." },
};
const kase = { id: "resume-tailor-0001", agentId: "resume-tailor", tags: ["golden"], input, expect: { mustNotClaim: ["Kubernetes"] }, source: "synthetic", addedAt: "2026-11-03" };
const line = (text: string) => ({ lines: [{ id: "l1", section: "Experience", text, factIds: ["f2"] }] });
const good = line("Cut invoice processing time by 30%");
const invented = line("Cut invoice processing time by 45% on Kubernetes");
const reply = (json: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(json) }], stop_reason: "end_turn", usage: { input_tokens: 1_000, output_tokens: 100 } });

/** A one-agent eval directory: the tailor case, an optional fixture and optional negatives. */
function evalDir(o: { reply?: unknown; fixture?: Record<string, unknown>; negatives?: unknown[]; tags?: string[] } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "kairos-evals-"));
  mkdirSync(join(dir, "resume-tailor", "fixtures"), { recursive: true });
  writeFileSync(join(dir, "resume-tailor", "cases.jsonl"), `${JSON.stringify({ ...kase, tags: o.tags ?? kase.tags })}\n`);
  if (o.reply !== undefined) {
    const fixture = { caseId: kase.id, promptVersion: 1, promptSha256: resumeTailor.prompts[1]!.fingerprint, inputHash: inputHash(input), source: "hand_written", responses: [{ text: o.reply }], ...o.fixture };
    writeFileSync(join(dir, "resume-tailor", "fixtures", `${kase.id}.json`), JSON.stringify(fixture));
  }
  if (o.negatives) writeFileSync(join(dir, "resume-tailor", "negatives.jsonl"), o.negatives.map((n) => JSON.stringify(n)).join("\n"));
  return dir;
}
const fixtures = (dir: string) => runEval({ mode: "fixtures", dir, agents: ["resume-tailor"] });
const failures = (report: Awaited<ReturnType<typeof runEval>>) => report.results.flatMap((r) => r.failures);

describe("eval on recorded fixtures (the default, no network)", () => {
  it("passes a good reply", async () => {
    const report = await fixtures(evalDir({ reply: good }));
    expect(failures(report)).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it("fails a reply that invents a detail: the CI gate on an invented-detail rate above 0", async () => {
    const report = await fixtures(evalDir({ reply: invented }));
    expect(report.passed).toBe(false);
    expect(failures(report)).toContainEqual({ grader: "containment", detail: "lines[0]: number_not_in_facts 45" });
    expect(failures(report)).toContainEqual({ grader: "containment", detail: 'lines[0]: mustNotClaim "Kubernetes"' });
  });

  it("fails a fixture recorded against another prompt, and says how to re-record", async () => {
    const report = await fixtures(evalDir({ reply: good, fixture: { promptSha256: "0".repeat(64) } }));
    expect(report.passed).toBe(false);
    expect(failures(report)[0]).toMatchObject({ grader: "fixture", detail: expect.stringContaining("npm run llm:record -- --agent resume-tailor --case resume-tailor-0001") });
  });

  it("fails a fixture whose case input changed after it was made, and a case with no fixture", async () => {
    expect(failures(await fixtures(evalDir({ reply: good, fixture: { inputHash: "1".repeat(64) } })))[0]).toMatchObject({ grader: "fixture" });
    expect(failures(await fixtures(evalDir()))[0]).toMatchObject({ grader: "fixture", detail: expect.stringContaining("no fixture") });
  });

  it("replays every negative and fails the run when a grader misses one", async () => {
    const caught = await fixtures(evalDir({ reply: good, negatives: [{ caseId: kase.id, failsOn: ["containment"], note: "invents 45%", responses: [{ text: invented }] }] }));
    expect(caught.passed).toBe(true);
    expect(caught.results.filter((r) => r.negative)).toHaveLength(1);

    const blind = await fixtures(evalDir({ reply: good, negatives: [{ caseId: kase.id, failsOn: ["containment"], note: "not actually bad", responses: [{ text: good }] }] }));
    expect(blind.passed).toBe(false);
    expect(failures(blind)).toEqual([{ grader: "containment", detail: "missed a bad output: not actually bad" }]);
  });

  it("runs a protected question with no fixture: production refuses it, and nothing may reach the client", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kairos-evals-"));
    mkdirSync(join(dir, "answer-drafter"), { recursive: true });
    const job = { title: "Platform Engineer", company: "Fernwood Analytics", descriptionText: "Billing APIs." };
    const protectedQ = { id: "answer-drafter-0001", agentId: "answer-drafter", tags: ["sensitive"], input: { label: "Will you require visa sponsorship?", facts: input.facts, savedAnswers: null, job }, expect: { abstain: "sensitive" }, source: "synthetic", addedAt: "2026-11-03" };
    writeFileSync(join(dir, "answer-drafter", "cases.jsonl"), `${JSON.stringify(protectedQ)}
`);
    const report = await runEval({ mode: "fixtures", dir, agents: ["answer-drafter"] });
    expect(failures(report)).toEqual([]);

    // The same case labelled as an ordinary question needs a fixture like any other.
    writeFileSync(join(dir, "answer-drafter", "cases.jsonl"), `${JSON.stringify({ ...protectedQ, tags: ["golden"], expect: {} })}
`);
    expect(failures(await runEval({ mode: "fixtures", dir, agents: ["answer-drafter"] }))[0]).toMatchObject({ grader: "fixture" });
  });

  it("rejects a malformed case file with its line number", async () => {
    const dir = evalDir({ reply: good });
    writeFileSync(join(dir, "resume-tailor", "cases.jsonl"), `${JSON.stringify(kase)}\n${JSON.stringify({ ...kase, id: "tailor-1" })}\n`);
    await expect(fixtures(dir)).rejects.toThrow(/cases\.jsonl:2/);
  });
});

describe("live and record modes (an explicit opt-in; here with a fake client)", () => {
  it("record writes a fixture the default run then passes on", async () => {
    const dir = evalDir();
    const recorded = await runEval({ mode: "record", dir, agents: ["resume-tailor"], liveClient: () => fakeAnthropic([reply(good)]) });
    expect(recorded.passed).toBe(true);
    expect(recorded.spentUsd).toBeGreaterThan(0);
    const fixture = JSON.parse(readFileSync(join(dir, "resume-tailor", "fixtures", `${kase.id}.json`), "utf8"));
    expect(fixture).toMatchObject({ caseId: kase.id, source: "recorded", promptVersion: 1, promptSha256: resumeTailor.prompts[1]!.fingerprint, inputHash: inputHash(input) });
    expect((await fixtures(dir)).passed).toBe(true);
  });

  it("stops before a case that could take spend past the cap, and sends nothing", async () => {
    const client = fakeAnthropic([reply(good)]);
    const report = await runEval({ mode: "live", dir: evalDir(), agents: ["resume-tailor"], maxUsd: 0.01, liveClient: () => client });
    expect(report.passed).toBe(false);
    expect(failures(report)[0]).toMatchObject({ grader: "budget" });
    expect(client.requests).toHaveLength(0);
  });

  it("repeats zero-tolerance cases", async () => {
    const client = fakeAnthropic([reply(good)]);
    await runEval({ mode: "live", dir: evalDir({ tags: ["injection"] }), agents: ["resume-tailor"], repeat: 3, liveClient: () => client });
    expect(client.requests).toHaveLength(3);
  });
});

describe("report", () => {
  it("prints one row per agent and every failure", async () => {
    const text = formatReport(await fixtures(evalDir({ reply: invented })));
    expect(text).toMatch(/\| resume-tailor \| 1 \| 0 \| 100% \| 0 \| 0 \| 0 \|/);
    expect(text).toContain("FAIL resume-tailor-0001 [containment] lines[0]: number_not_in_facts 45");
    expect(text).toContain("eval (fixtures): FAIL");
  });
});

describe("the labelled-set bars (WP-26)", () => {
  /** A live client for the verifier: every claim gets the verdict `judge` gives its text. */
  const judging = (judge: (text: string) => string) => () => ({
    messages: {
      async create(body: Record<string, unknown>) {
        const text = (body.messages as { content: { text: string }[] }[])[0]!.content.map((c) => c.text).join("\n");
        const verdicts = [...text.matchAll(/^\[(c\d\d)\] kind=\S+ cites=(\S+) :: (.*)$/gm)].map((m) => {
          const verdict = judge(m[3]!);
          return { claimId: m[1]!, verdict, factRef: verdict === "supported" || verdict === "contradicted" ? m[2]!.split(",")[0]! : null };
        });
        return {
          data: { content: [{ type: "text", text: JSON.stringify({ verdicts }) }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null } },
          requestId: "r",
          rateRemaining: { requests: 999, inputTokens: 999_999, outputTokens: 99_999 },
          rateLimitRequests: 2_000,
          retryAfterSeconds: null,
        };
      },
    },
  });

  it("the committed fixtures pass and report rates, flagged as plumbing only", async () => {
    const report = await runEval({ mode: "fixtures", agents: ["claim-verifier"] });
    expect(report.verdictBars).toEqual([expect.objectContaining({ agentId: "claim-verifier", falseAcceptRate: 0, falseRejectRate: 0, ok: true })]);
    expect(formatReport(report)).toMatch(/false accept 0\.0% \(bar 1\.0%\), false reject 0\.0% \(bar 8\.0%\): ok, from fixtures/);
  });

  it("a model that accepts everything is over the false-accept bar, and fails the injection slice one by one", async () => {
    const report = await runEval({ mode: "live", agents: ["claim-verifier"], liveClient: judging(() => "supported") as never });
    expect(report.verdictBars[0]).toMatchObject({ ok: false, falseRejectRate: 0 });
    expect(report.verdictBars[0]!.falseAcceptRate).toBeGreaterThan(0.01);
    expect(report.passed).toBe(false);
    expect(report.results.flatMap((r) => r.failures).some((f) => f.grader === "verdict")).toBe(true);
    expect(formatReport(report)).toContain("OVER THE BAR");
  });

  it("a model that rejects everything is over the false-reject bar", async () => {
    const report = await runEval({ mode: "live", agents: ["claim-verifier"], liveClient: judging(() => "unsupported") as never });
    expect(report.verdictBars[0]).toMatchObject({ ok: false, falseAcceptRate: 0, falseRejectRate: 1 });
  });

  it("a live run of a model at the labels passes the bars", async () => {
    const lines = readFileSync(new URL("../../evals/claim-verifier/cases.jsonl", import.meta.url), "utf8").split(/\r?\n/).filter(Boolean);
    const gold = new Map<string, string>();
    for (const line of lines) {
      const c = JSON.parse(line) as { input: { claims: { id: string; text: string }[] }; expect: { verdicts: Record<string, string> } };
      for (const claim of c.input.claims) gold.set(claim.text.replace(/\s+/g, " ").replace(/<<END DATA/gi, "\u00abDATA"), c.expect.verdicts[claim.id]!);
    }
    const report = await runEval({ mode: "live", agents: ["claim-verifier"], liveClient: judging((t) => gold.get(t) ?? "unsupported") as never });
    expect(report.verdictBars[0]).toMatchObject({ ok: true, falseAcceptRate: 0, falseRejectRate: 0 });
  });
});
