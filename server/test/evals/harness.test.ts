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
