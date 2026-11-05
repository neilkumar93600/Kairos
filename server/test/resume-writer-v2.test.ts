import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resumeSuggestionSchema, type FactKind, type ResumeInput, type ResumeLevel } from "@auto-career/shared";
import { fixSpellingViolation, refineViolation, shapeViolations } from "../src/agents/resume-writer/checks";
import { renderResumeWriterV2 } from "../src/agents/resume-writer/render";
import { ResumeWriterOutputV2, type ResumeWriterInputV2 } from "../src/agents/resume-writer/schema";
import { resumeWriterV2 } from "../src/agents/resume-writer/spec";
import { toStrictJsonSchema } from "../src/llm/schema";
import { resetBreakers } from "../src/llm/breaker";
import { Budget } from "../src/llm/budget";
import { configureGateway, rolloutVersion } from "../src/llm/gateway";
import { resetLimiter } from "../src/llm/limiter";
import { memorySpendStore } from "../src/llm/spend-store";
import { fakeAnthropic, type ScriptedResponse } from "../src/llm/testing";
import { headlineViolation, truthLockViolations, yearsOfExperience, type EmploymentDates, type ProfileFact } from "../src/services/resume-doc";
import { suggestEdits, type WriterRequest } from "../src/services/resume-writer";
import { configureVerify, type VerifyDeps } from "../src/services/verify";

process.env.USER_HASH_KEY ??= Buffer.alloc(32, 7).toString("base64");

const fact = (id: string, kind: FactKind, text: string, employmentId: string | null = null, confirmed = true) => ({ id, kind, text, sourceSpan: null, confirmed, employmentId });
const FACTS = [
  fact("f1", "role", "Backend Engineer at Initech from 2018 to 2024", "emp-1"),
  fact("f2", "metric", "Moved 12 services to Kubernetes", "emp-1"),
  fact("f3", "skill", "TypeScript"),
  fact("f4", "project", "Built a React dashboard"),
];
const ROLES: EmploymentDates[] = [{ id: "emp-1", confirmed: true, startMonth: "2018-01", endMonth: "2024-06", isCurrent: false }];

const resume: ResumeInput = {
  name: "Base resume",
  density: "comfortable",
  contact: { name: "Ada", email: "ada@example.com", phone: "", location: "", links: [] },
  sections: [
    { id: "sum", kind: "summary", title: "Summary", hidden: false, entries: [] },
    {
      id: "exp",
      kind: "experience",
      title: "Experience",
      hidden: false,
      entries: [
        {
          id: "e1",
          heading: "Backend Engineer",
          subheading: "Initech",
          meta: null,
          headingFactId: "f1",
          hidden: false,
          lines: [
            { id: "l1", section: "Experience", text: "Moved services to Kubernetes, which took a very long time overall", factIds: ["f2"] },
            { id: "l2", section: "Experience", text: "Moved 12 servises to Kubernetes", factIds: ["f2"] },
          ],
        },
      ],
    },
  ],
};

type Out = ResumeWriterOutputV2["suggestions"][number];
const s = (o: Partial<Out>): Out => ({ sectionId: "exp", entryId: "e1", lineId: "l1", action: "rewrite", after: "Moved 12 services to Kubernetes", why: "w", factIds: ["f2"], needsFact: null, tag: "use_your_numbers", priority: "high", appendYears: false, ...o });
const h = (o: Partial<Out>): Out => s({ sectionId: "headline", entryId: null, lineId: null, action: "add", after: "Backend Engineer · TypeScript", factIds: ["f1", "f3"], tag: "show_scope", ...o });

const replyOf = (suggestions: Out[]): ScriptedResponse => ({ content: [{ type: "text", text: JSON.stringify({ suggestions }) }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });

interface Sent {
  messages: unknown;
  system: unknown;
}

/** A gateway on a fake client; returns the requests it received, and the verifier stands aside unless a test asks. */
function gateway(replies: Out[][], flags: { pin?: number; canary?: { version: number; percent: number } } = {}) {
  resetBreakers();
  resetLimiter();
  const client = fakeAnthropic(replies.map(replyOf));
  configureGateway({
    client: () => client,
    budget: new Budget(memorySpendStore()),
    writeRow: async () => "row",
    sleep: async () => {},
    flags: () => ({
      llmPaused: false,
      batchPaused: false,
      disabled: {},
      promptPin: (flags.pin ? { "resume-writer": flags.pin } : {}) as Record<string, number>,
      ...(flags.canary ? { promptCanary: { "resume-writer": flags.canary } } : {}),
    }),
  });
  return client as unknown as { requests: Sent[] };
}

const CTX = { userId: "u-writer", plan: "pro" as const };
const noteDeps = { createFact: async () => fact("n1", "metric", "note") };
const v2 = { ...noteDeps, defaultVersion: 2 as const, callCtx: CTX };
const run = (req: Partial<WriterRequest>, doc: ResumeInput = resume) =>
  suggestEdits({ scope: "line", lineId: "l1", ...req } as WriterRequest, { resume: doc, facts: FACTS as ProfileFact[], employments: ROLES }, v2);

beforeEach(() => {
  configureVerify({ mode: async () => "shadow", cacheGet: async () => new Map(), cachePut: async () => {}, callsToday: async () => ({ verifier: 0, escalation: 0, filledAt: 0 }), random: () => 0.5, now: () => 0, shadowBudgetMs: 10, enforceBudgetMs: 10 } satisfies Partial<VerifyDeps>);
});
afterEach(() => configureVerify());

describe("yearsOfExperience: computed in code from confirmed role dates (rule 10)", () => {
  const facts = [{ id: "a", kind: "role", confirmed: true, employmentId: "1" }, { id: "b", kind: "metric", confirmed: true, employmentId: "2" }];
  const role = (o: Partial<EmploymentDates>): EmploymentDates => ({ id: "1", confirmed: true, startMonth: "2018-01", endMonth: "2020-12", isCurrent: false, ...o });
  const NOW = new Date("2026-11-05T00:00:00Z");

  it("counts both end months, in whole years rounded down", () => {
    expect(yearsOfExperience([role({})], facts, NOW)).toEqual({ value: 3, factIds: ["a"] });
    expect(yearsOfExperience([role({ endMonth: "2020-11" })], facts, NOW)?.value).toBe(2);
  });

  it("counts overlaps once and gaps not at all, and cites each counted role", () => {
    expect(yearsOfExperience([role({}), role({ id: "2", startMonth: "2019-01", endMonth: "2021-12" })], facts, NOW)).toEqual({ value: 4, factIds: ["a", "b"] });
    expect(yearsOfExperience([role({ endMonth: "2018-12" }), role({ id: "2", startMonth: "2023-01", endMonth: "2023-12" })], facts, NOW)?.value).toBe(2);
  });

  it("a nested role adds nothing, and a current role runs to this month", () => {
    expect(yearsOfExperience([role({}), role({ id: "2", startMonth: "2019-01", endMonth: "2019-06" })], facts, NOW)?.value).toBe(3);
    expect(yearsOfExperience([role({ startMonth: "2024-11", endMonth: null, isCurrent: true })], facts, NOW)?.value).toBe(2);
  });

  it("fails closed: unconfirmed, undated, open-ended or uncited roles do not count, and under a year is null", () => {
    expect(yearsOfExperience([role({ confirmed: false })], facts, NOW)).toBeNull();
    expect(yearsOfExperience([role({ startMonth: null })], facts, NOW)).toBeNull();
    expect(yearsOfExperience([role({ endMonth: null })], facts, NOW)).toBeNull();
    expect(yearsOfExperience([role({ id: "nobody" })], facts, NOW)).toBeNull();
    expect(yearsOfExperience([role({})], [{ ...facts[0]!, confirmed: false }], NOW)).toBeNull();
    expect(yearsOfExperience([role({ endMonth: "2018-11" })], facts, NOW)).toBeNull();
    expect(yearsOfExperience([role({ startMonth: "2030-01", endMonth: null, isCurrent: true })], facts, NOW)).toBeNull();
  });
});

describe("refine compliance, one check per mode", () => {
  const t = (after: string, before: string | null = "Moved services", citedMetricTexts: string[] = []) => ({ before, after, citedMetricTexts });
  it("shorter and longer compare with the line replaced", () => {
    expect(refineViolation("shorter", t("Moved"))).toBeNull();
    expect(refineViolation("shorter", t("Moved servicez"))).toBe("refine_not_shorter");
    expect(refineViolation("longer", t("Moved services fast"))).toBeNull();
    expect(refineViolation("longer", t("Moved services"))).toBe("refine_not_longer");
  });
  it("result_first needs a number or a result verb in the first clause", () => {
    expect(refineViolation("result_first", t("Cut drop-off by building the flow"))).toBeNull();
    expect(refineViolation("result_first", t("12 services moved, with no downtime"))).toBeNull();
    expect(refineViolation("result_first", t("Worked on the flow, which cut drop-off"))).toBe("refine_not_result_first");
  });
  it("natural refuses a buzzword and first person", () => {
    expect(refineViolation("natural", t("Moved the services"))).toBeNull();
    expect(refineViolation("natural", t("Leveraged synergies across services"))).toBe("refine_not_natural");
    expect(refineViolation("natural", t("I moved the services"))).toBe("refine_not_natural");
  });
  it("use_numbers needs a number from a cited metric fact", () => {
    expect(refineViolation("use_numbers", t("Moved 12 services", null, ["Moved 12 services to Kubernetes"]))).toBeNull();
    expect(refineViolation("use_numbers", t("Moved services", null, ["Moved 12 services"]))).toBe("refine_no_number");
    expect(refineViolation("use_numbers", t("Moved 12 services", null, []))).toBe("refine_no_number");
  });
});

describe("Fix spelling: wording only, same facts", () => {
  it("accepts a small fix, refuses other citations, a rewrite and a changed number", () => {
    expect(fixSpellingViolation("Moved 12 servises", "Moved 12 services", ["f2"], ["f2"])).toBeNull();
    expect(fixSpellingViolation("Moved 12 servises", "Moved 12 services", ["f2"], ["f1"])).toBe("fix_spelling_citations");
    expect(fixSpellingViolation("Moved 12 servises", "Led a platform team", ["f2"], ["f2"])).toBe("fix_spelling_too_far");
    expect(fixSpellingViolation("Moved 12 services in all", "Moved 13 services in all", ["f2"], ["f2"])).toBe("fix_spelling_number");
  });
});

describe("v2 postValidate", () => {
  const input: ResumeWriterInputV2 = { scope: "line", refine: null, level: "mid", resumeView: "x", facts: FACTS.map(({ id, kind, text }) => ({ id, kind, text })), noteFact: null, job: null, headline: null, derived: [], maxSuggestions: 3 };
  const headlineInput = { ...input, scope: "headline" as const, derived: [{ label: "years_of_experience" as const, value: 6, factIds: ["f1"] }] };
  const codes = (x: Out[], i: ResumeWriterInputV2 = input) => shapeViolations({ suggestions: x }, i).map((v) => v.code);

  it("passes a good rewrite, remove, question and headline", () => {
    expect(codes([s({}), s({ action: "remove", after: null, factIds: [] }), s({ after: null, needsFact: { kind: "metric", question: "How many?" } })])).toEqual([]);
    expect(codes([h({ appendYears: true })], headlineInput)).toEqual([]);
  });

  it("refuses a stated year count in digits or words in a headline, however it is written", () => {
    for (const after of ["Engineer · 6 years", "Engineer, 5+ yrs", "Ten-year engineer", "Engineer · six years", "Engineer with over a decade"]) {
      expect(codes([h({ after })], headlineInput), after).toContain("model_stated_years");
    }
  });

  it("lets a line repeat a length its own cited fact states, but not one it does not", () => {
    const withFact = { ...input, facts: [...input.facts, { id: "f9", kind: "project", text: "Ran a 3 years contract" }] };
    expect(codes([s({ after: "Ran a 3 years contract", factIds: ["f9"] })], withFact)).toEqual([]);
    expect(codes([s({ after: "Moved services over 3 years" })], withFact)).toEqual(["model_stated_years"]);
  });

  it("refuses appendYears without a value, placeholders, and a misplaced tag or shape", () => {
    expect(codes([h({ appendYears: true })], { ...headlineInput, derived: [] })).toEqual(["append_without_value"]);
    for (const after of ["Cut costs by [X]%", "Led [number] engineers", "Cut costs by XX%", "Led {n} engineers"]) expect(codes([s({ after })]), after).toEqual(["placeholder"]);
    expect(codes([s({ lineId: null, action: "add", tag: "fix_spelling" })])).toEqual(["bad_tag"]);
    expect(codes([s({ lineId: null })])).toEqual(["bad_action_shape"]);
    expect(codes([s({ action: "remove", factIds: ["f2"], after: null })])).toEqual(["bad_action_shape"]);
    expect(codes([s({ after: "x", needsFact: { kind: "metric", question: "q" } })])).toEqual(["bad_action_shape"]);
    expect(codes([s({ after: null })])).toEqual(["bad_action_shape"]);
    expect(codes([s({ appendYears: true })])).toContain("bad_headline_shape");
    expect(codes([h({ sectionId: "exp" })], headlineInput)).toEqual(["bad_headline_shape"]);
    expect(codes([h({}), h({}), h({}), h({})], headlineInput)).toEqual(["bad_headline_shape"]);
  });
});

describe("v2 spec", () => {
  it("the committed snapshot is the output schema (npm run agents:snap)", () => {
    expect(resumeWriterV2.schemaSnapshot).toEqual(toStrictJsonSchema(ResumeWriterOutputV2));
  });
});

describe("v2 render", () => {
  const input: ResumeWriterInputV2 = { scope: "headline", refine: null, level: "senior", resumeView: "View", facts: [], noteFact: null, job: null, headline: "Old headline", derived: [{ label: "years_of_experience", value: 37, factIds: ["f1"] }], maxSuggestions: 3 };
  it("puts the level in the trusted task line, one text per level", () => {
    const tasks = (["early_career", "mid", "senior", "lead"] as ResumeLevel[]).map((level) => renderResumeWriterV2({ ...input, level }, CTX).task);
    expect(new Set(tasks).size).toBe(4);
    expect(tasks[2]).toContain("Level: senior.");
  });
  it("never renders the computed years, only that a value exists", () => {
    const r = renderResumeWriterV2(input, CTX);
    expect(JSON.stringify(r)).not.toContain("37");
    expect(r.task).toContain("A years-of-experience value is available.");
    expect(renderResumeWriterV2({ ...input, derived: [] }, CTX).task).toContain("No years-of-experience value is available.");
  });
  it("fences the current headline with the view, and failed claims in their own block with a fixed task line", () => {
    const r = renderResumeWriterV2({ ...input, doNotClaim: [{ text: "Led 40 engineers", rule: "number_not_in_facts" }] }, CTX);
    expect(r.task).not.toContain("Old headline");
    expect(r.task).not.toContain("Led 40");
    expect(r.task).toContain("apply rule 9");
    expect(r.untrusted.map((b) => b.label)).toEqual(["resume_lines", "claims"]);
    expect(r.untrusted[0]!.text).toContain("Current headline: Old headline");
    expect(r.untrusted[1]!.text).toContain("Led 40 engineers");
  });
  it("has the do-not-claim rule in the static prompt", () => {
    expect(resumeWriterV2.prompts[2]!.system).toContain("A claims block, when present");
  });
});

describe("suggestEdits on v2", () => {
  it("carries the tag and priority through, and fills `before` from the document", async () => {
    gateway([[s({})]]);
    const { suggestions } = await run({});
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ tag: "use_your_numbers", priority: "high", before: resume.sections[1]!.entries[0]!.lines[0]!.text });
    expect(resumeSuggestionSchema.safeParse(suggestions[0]).success).toBe(true);
  });

  it("sends the request's level, else the resume's, else mid", async () => {
    const task = (c: { requests: Sent[] }) => JSON.stringify(c.requests[0]!.messages);
    let c = gateway([[s({})]]);
    await run({ level: "lead" });
    expect(task(c)).toContain("Level: lead or executive.");
    c = gateway([[s({})]]);
    await run({}, { ...resume, level: "early_career" });
    expect(task(c)).toContain("Level: early career.");
    c = gateway([[s({})]]);
    await run({});
    expect(task(c)).toContain("Level: mid-level.");
  });

  for (const level of ["early_career", "mid", "senior", "lead"] as const) {
    it(`drops an invented detail at level ${level}, whatever the level asks for`, async () => {
      gateway([[s({ after: "Led 40 engineers moving 12 services to Kubernetes" }), s({ after: "Moved 12 services to Kubernetes at Globex Corp" }), s({})]]);
      const { suggestions } = await run({ level });
      expect(suggestions.map((x) => x.after)).toEqual(["Moved 12 services to Kubernetes"]);
    });
  }

  it("drops what breaks each refine mode", async () => {
    for (const [refine, bad, good] of [
      ["longer", "Moved 12 services", "Moved 12 services to Kubernetes, and moved them all with care, every one of the lot"],
      ["result_first", "Worked on Kubernetes services"],
      ["natural", "Leveraged Kubernetes for 12 services", "Moved 12 services to Kubernetes"],
      ["use_numbers", "Moved services to Kubernetes", "Moved 12 services to Kubernetes"],
    ] as const) {
      gateway([[s({ after: bad, factIds: ["f2"] }), ...(good ? [s({ after: good })] : [])]]);
      const { suggestions } = await run({ refine });
      expect(suggestions.map((x) => x.after), refine).not.toContain(bad);
    }
  });

  it("use_numbers with no metric fact asks one question, with no model call and no revision", async () => {
    const c = gateway([]);
    let snapshots = 0;
    const out = await suggestEdits(
      { scope: "line", lineId: "l1", refine: "use_numbers" },
      { resume, facts: FACTS.filter((f) => f.kind !== "metric") as ProfileFact[], employments: ROLES },
      { ...v2, beforeModel: async () => void snapshots++ },
    );
    expect(c.requests).toHaveLength(0);
    expect(snapshots).toBe(0);
    expect(out.suggestions).toHaveLength(1);
    expect(out.suggestions[0]).toMatchObject({ after: null, factIds: [], lineId: "l1", tag: "use_your_numbers", needsFact: { kind: "metric", question: "What number shows the result of this work?" } });
  });

  it("takes the before_ai revision once the request reaches the model, after the scope check", async () => {
    gateway([[s({})]]);
    let snapshots = 0;
    await suggestEdits({ scope: "line", lineId: "l1" }, { resume, facts: FACTS as ProfileFact[] }, { ...v2, beforeModel: async () => void snapshots++ });
    expect(snapshots).toBe(1);
    await expect(suggestEdits({ scope: "line", lineId: "nope" }, { resume, facts: FACTS as ProfileFact[] }, { ...v2, beforeModel: async () => void snapshots++ })).rejects.toMatchObject({ code: "invalid_scope" });
    expect(snapshots).toBe(1);
  });

  it("keeps Fix spelling to wording: same citations and close to the line, or it is dropped", async () => {
    gateway([[s({ lineId: "l2", tag: "fix_spelling" }), s({ lineId: "l2", tag: "fix_spelling", factIds: ["f2", "f1"] }), s({ lineId: "l2", tag: "fix_spelling", after: "Backend Engineer at Initech" , factIds: ["f2"] })]]);
    const { suggestions } = await run({ scope: "entry", sectionId: "exp", entryId: "e1", lineId: undefined });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ after: "Moved 12 services to Kubernetes", tag: "fix_spelling", factIds: ["f2"] });
  });

  it("caps by scope: 3 for a line, 8 for an entry, 20 for the resume", async () => {
    const many = (n: number) => Array.from({ length: n }, () => s({}));
    gateway([many(5)]);
    expect((await run({})).suggestions).toHaveLength(3);
    gateway([many(12)]);
    expect((await run({ scope: "entry", sectionId: "exp", entryId: "e1", lineId: undefined })).suggestions).toHaveLength(8);
    gateway([many(25)]);
    expect((await run({ scope: "resume", lineId: undefined })).suggestions).toHaveLength(20);
  });
});

describe("the headline scope", () => {
  const ask = (doc: ResumeInput = resume, extra: Partial<WriterRequest> = {}) => run({ scope: "headline", lineId: undefined, ...extra }, doc);

  it("appends the computed value, not the model's, and cites the role dates' facts in derived", async () => {
    const c = gateway([[h({ appendYears: true }), h({ after: "Backend Engineer" })]]);
    const { suggestions } = await ask();
    expect(suggestions[0]).toMatchObject({
      sectionId: "headline",
      entryId: null,
      lineId: null,
      action: "add",
      before: null,
      after: "Backend Engineer · TypeScript · 6 years",
      factIds: ["f1", "f3"],
      derived: [{ label: "Years of experience", value: 6, factIds: ["f1"] }],
    });
    expect(suggestions[1]!.after).toBe("Backend Engineer");
    expect(suggestions[1]!.derived).toBeUndefined();
    for (const x of suggestions) expect(resumeSuggestionSchema.safeParse(x).success).toBe(true);
    // The number never reached the model.
    expect(JSON.stringify(c.requests[0]!.messages)).not.toMatch(/\b6 years\b/);
  });

  it("is a rewrite of the stored headline, with `before` from the document", async () => {
    gateway([[h({ action: "add" })]]);
    const { suggestions } = await ask({ ...resume, headline: { text: "Old", factIds: ["f1"] } });
    expect(suggestions[0]).toMatchObject({ action: "rewrite", before: "Old" });
  });

  it("drops an option that cites no role, invents a detail, or runs past 160 characters with the years", async () => {
    gateway([[h({ factIds: ["f3"], after: "TypeScript" }), h({ after: "Backend Engineer · Rust", factIds: ["f1"] }), h({ after: `Backend Engineer ${"TypeScript ".repeat(14).trim()}`, appendYears: true })]]);
    expect((await ask()).suggestions).toEqual([]);
  });

  it("with no role fact asks for one, with no model call", async () => {
    const c = gateway([]);
    const out = await suggestEdits({ scope: "headline" }, { resume, facts: FACTS.filter((f) => f.kind !== "role") as ProfileFact[] }, v2);
    expect(c.requests).toHaveLength(0);
    expect(out.suggestions[0]).toMatchObject({ after: null, needsFact: { kind: "role" }, tag: "show_scope", priority: "high" });
  });

  it("refuses (503) when v1 serves the call, before any note is saved or anything sent: v1 cannot do it", async () => {
    const c = gateway([], { pin: 1 });
    let notes = 0;
    await expect(
      suggestEdits({ scope: "headline", note: "My note here" }, { resume, facts: FACTS as ProfileFact[] }, { createFact: async () => (notes++, fact("n1", "role", "x")), defaultVersion: 2, callCtx: CTX }),
    ).rejects.toMatchObject({ status: 503, code: "ai_unavailable" });
    expect(notes).toBe(0);
    expect(c.requests).toHaveLength(0);
  });

  it("layer 3 judges the model's words, without the years that come from role dates", async () => {
    const c = gateway([[h({ appendYears: true })]]);
    configureVerify({ mode: async () => "shadow", shadowBudgetMs: 2_000, cacheGet: async () => new Map(), cachePut: async () => {} });
    const { suggestions } = await ask();
    expect(suggestions[0]!.after).toBe("Backend Engineer · TypeScript · 6 years");
    // The fake has no verifier reply, so shadow lets it pass; what matters is what the verifier was asked.
    const sent = JSON.stringify(c.requests[1]!.messages);
    expect(sent).toContain("Backend Engineer · TypeScript");
    expect(sent).not.toContain("6 years");
  });
});

describe("version selection (agents/03 9)", () => {
  const v1Reply = { sectionId: "exp", entryId: "e1", lineId: "l1", action: "rewrite", after: "Moved 12 services to Kubernetes", why: "w", factIds: ["f2"], needsFact: null };
  const sentSchema = (c: { requests: Sent[] }) => JSON.stringify((c.requests[0] as unknown as { output_config: unknown }).output_config);

  it("the new route defaults to v2, the legacy alias to v1", async () => {
    let c = gateway([[s({})]]);
    expect((await suggestEdits({ scope: "line", lineId: "l1" }, { resume, facts: FACTS as ProfileFact[] }, v2)).suggestions[0]!.tag).toBe("use_your_numbers");
    expect(sentSchema(c)).toContain("appendYears");
    c = gateway([[v1Reply as Out]]);
    const legacy = await suggestEdits({ scope: "line", lineId: "l1" }, { resume, facts: FACTS as ProfileFact[] }, { ...noteDeps, callCtx: CTX });
    expect(sentSchema(c)).not.toContain("appendYears");
    expect(legacy.suggestions[0]!.tag).toBeUndefined();
  });

  it("a pin moves both ways, and never renders one version's input under the other's text", async () => {
    let c = gateway([[v1Reply as Out]], { pin: 1 });
    await suggestEdits({ scope: "line", lineId: "l1" }, { resume, facts: FACTS as ProfileFact[] }, v2);
    expect(sentSchema(c)).not.toContain("appendYears");
    expect(JSON.stringify(c.requests[0]!.messages)).not.toContain("Level:");
    c = gateway([[s({})]], { pin: 2 });
    await suggestEdits({ scope: "line", lineId: "l1" }, { resume, facts: FACTS as ProfileFact[] }, { ...noteDeps, callCtx: CTX });
    expect(sentSchema(c)).toContain("appendYears");
  });

  it("a canary moves its share of users, and a pin beats it", () => {
    gateway([], { canary: { version: 2, percent: 100 } });
    expect(rolloutVersion("resume-writer", 1, { userId: "u" })).toBe(2);
    gateway([], { canary: { version: 2, percent: 0 } });
    expect(rolloutVersion("resume-writer", 1, { userId: "u" })).toBe(1);
    expect(rolloutVersion("resume-writer", 1, {})).toBe(1);
    gateway([], { pin: 1, canary: { version: 2, percent: 100 } });
    expect(rolloutVersion("resume-writer", 2, { userId: "u" })).toBe(1);
  });

  it("the legacy client is always v1", async () => {
    const chat = (async () => ({ suggestions: [v1Reply] })) as never;
    const out = await suggestEdits({ scope: "line", lineId: "l1" }, { resume, facts: FACTS as ProfileFact[] }, { ...noteDeps, chat, defaultVersion: 2 });
    expect(out.suggestions[0]!.tag).toBeUndefined();
  });
});

describe("the headline in the document truth lock", () => {
  const confirmed = new Map(FACTS.map((f) => [f.id, f.text]));
  const doc = (text: string, factIds = ["f1", "f3"]): ResumeInput => ({ ...resume, headline: { text, factIds } });

  it("names an unconfirmed citation", () => {
    expect(truthLockViolations(doc("x", ["f1", "nope"]), new Set(confirmed.keys()))).toContain("headline");
    expect(truthLockViolations({ ...resume, sections: [], headline: { text: "x", factIds: ["f1"] } }, new Set(confirmed.keys()))).toEqual([]);
  });

  it("accepts text its facts contain, with the years code computes", () => {
    expect(headlineViolation(doc("Backend Engineer · TypeScript"), confirmed, null, null)).toBeNull();
    expect(headlineViolation(doc("Backend Engineer · TypeScript · 6 years"), confirmed, null, 6)).toBeNull();
    expect(headlineViolation(doc("Backend Engineer · 1 year"), confirmed, null, 1)).toBeNull();
  });

  it("refuses any other year count, and no count when none is computed, even typed by the user", () => {
    expect(headlineViolation(doc("Backend Engineer · 7 years"), confirmed, null, 6)).toBe("number_not_in_facts");
    expect(headlineViolation(doc("Backend Engineer · 6 years"), confirmed, null, null)).toBe("number_not_in_facts");
    expect(headlineViolation(doc("Backend Engineer with 9 years of TypeScript"), confirmed, null, 6)).toBe("number_not_in_facts");
  });

  it("refuses an invented detail, and leaves an unchanged headline alone (the count ages with time)", () => {
    expect(headlineViolation(doc("Backend Engineer · Rust"), confirmed, null, null)).toBe("skill_not_in_facts");
    const stored = doc("Backend Engineer · 6 years");
    expect(headlineViolation(stored, confirmed, stored, 7)).toBeNull();
  });
});
