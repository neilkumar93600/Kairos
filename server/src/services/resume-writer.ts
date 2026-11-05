import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  FACT_KINDS,
  type FactKind,
  type ResumeInput,
  type ResumeLevel,
  type ResumeSection,
  type ResumeSectionKind,
  type ResumeSuggestion,
  type ResumeSuggestionRequest,
  type SuggestionRequest,
} from "@auto-career/shared";
import { UNTRUSTED_RULES, untrusted } from "../ai/untrusted";
import { HttpError } from "../lib/errors";
import { checkClaims } from "../llm/claims";
import { rolloutVersion, runAgent } from "../llm/gateway";
import { fixSpellingViolation, refineViolation, yearsSuffix } from "../agents/resume-writer/checks";
import type { ResumeWriterOutputV2 } from "../agents/resume-writer/schema";
import { resumeWriter, resumeWriterV2 } from "../agents/resume-writer/spec";
import { gatewayEnabled } from "../llm/wire";
import type { AgentCallContext } from "../agents/types";
import { chatJson } from "./llm";
import { yearsOfExperience, type EmploymentDates, type ProfileFact } from "./resume-doc";
import { topFacts } from "./job-fit";
import { requireVerifierOrShadow, verifyClaims } from "./verify";

export interface WriterContext {
  resume: ResumeInput;
  /** All of the user's facts. Only confirmed ones are shown to the model and may be cited. */
  facts: (ProfileFact & { employmentId?: string | null })[];
  /** The resume profile's employments: the only input of a headline's years (rule 10). */
  employments?: EmploymentDates[];
  job?: { title: string; company: string; descriptionText: string } | null;
}

export interface WriterDeps {
  chat?: typeof chatJson;
  /** Forces the gateway path with a call context (tests inject a fake through configureGateway). */
  callCtx?: AgentCallContext;
  /** Saves the user's note as an UNCONFIRMED fact and returns it. */
  createFact: (input: { kind: FactKind; text: string }) => Promise<ProfileFact>;
  /** The before_ai revision, once the request is known to reach the model. */
  beforeModel?: () => Promise<void>;
  /** The writer version a call gets with no pin or canary: 2 on /resumes/suggestions, 1 on the frozen /resume alias. */
  defaultVersion?: 1 | 2;
}

/** A request of either route: the legacy alias has no headline scope and no level. */
export type WriterRequest = Omit<SuggestionRequest, "scope"> & Pick<ResumeSuggestionRequest, "scope"> & { level?: ResumeLevel };

type Refine = NonNullable<SuggestionRequest["refine"]>;

// No length limits here: structured outputs drop them. Lengths are enforced in code below.
const modelSchema = z.object({
  suggestions: z.array(
    z.object({
      sectionId: z.string(),
      entryId: z.string().nullable(),
      lineId: z.string().nullable(),
      action: z.enum(["rewrite", "add", "remove"]),
      after: z.string().nullable(),
      why: z.string(),
      factIds: z.array(z.string()),
      needsFact: z.object({ kind: z.enum(FACT_KINDS), question: z.string() }).nullable(),
    }),
  ),
});
/** What either version returned. v1 has no tag, priority or appendYears. */
type ModelSuggestion = z.infer<typeof modelSchema>["suggestions"][number] & Partial<Pick<ResumeWriterOutputV2["suggestions"][number], "tag" | "priority" | "appendYears">>;

// Static, so the API caches it; everything per request goes in the user message.
const SYSTEM = `You are the Resume Writer for Kairos. You propose edits to the user's resume; nothing changes until the user accepts one.

Truth rules:
1. Every add or rewrite cites in factIds the ids of the facts it uses, copied exactly from the facts given. Cite at least one.
2. Never add a number, employer, title, date, tool, degree or scope that is not in the cited facts. You may rephrase, reorder, shorten and choose which facts to use.
3. When the best line would need a detail no fact gives (a count, a tool, a scope), do not write it: return needsFact {kind, question} with after null. The question asks for that one detail in under 15 words, for example "How many services moved?".

Edits:
- Touch only the sections, entries and lines shown, by the ids in square brackets.
- rewrite and remove need lineId; a rewrite's after is the full new line. add needs sectionId, the entryId it goes into (or null for the section's first entry) and lineId null. remove has after null and factIds [].
- A line is one resume bullet in plain words, no first person, at most 300 characters. why says in one short sentence what the edit improves.

Reply as JSON {"suggestions":[{"sectionId","entryId","lineId","action","after","why","factIds","needsFact"}]}.

${UNTRUSTED_RULES}`;

const SCOPE: Record<SuggestionRequest["scope"], string> = {
  resume: "Review the whole resume and suggest the edits that matter most.",
  section: "Improve this section: rewrite weak lines and add lines the facts support.",
  entry: "Improve this entry: rewrite weak lines and add lines from the facts that belong to it.",
  line: "Rewrite this one line. Give different rewrites, each a full replacement.",
  summary: "Write or improve the summary: one to three lines that sum up the user from the facts.",
  skills: "Suggest skills the facts show that this section lacks, one skill or a short group per line, and fix weak skill lines.",
};

const REFINE: Record<Refine, string> = {
  shorter: "Make every rewrite strictly shorter than the line it replaces: cut filler, keep the facts.",
  longer: "Make rewrites fuller with context the cited facts contain; never add anything they do not.",
  result_first: "Lead each line with the result or outcome, then how it was done.",
  natural: "Use plain, natural wording a person would say; no buzzwords or stacked adjectives.",
  use_numbers: "Use the numbers the cited facts contain. Never invent, round or estimate one; when a line needs a number no fact gives, return needsFact asking for it.",
};

const NOTE_KIND: Partial<Record<ResumeSectionKind, FactKind>> = {
  experience: "role",
  projects: "project",
  skills: "skill",
  education: "education",
  certifications: "certification",
};

/**
 * ponytail: deterministic, because the fact must exist (with an id to cite) before the model runs. A digit means a
 * metric (the rewriter asks for counts), else the scoped section's kind, else role. The user can recategorise in Profile.
 */
const noteKind = (note: string, section: ResumeSectionKind | null): FactKind =>
  /\d/.test(note) ? "metric" : ((section && NOTE_KIND[section]) ?? "role");

const factLine = (f: ProfileFact) => `[${f.id}] (${f.kind}) ${f.text}`;

/** The part of the resume a scope shows and may change. Ids that are not in the resume are a 422. */
function scopeView(doc: ResumeInput, req: WriterRequest): ResumeSection[] {
  const bad = (what: string) => new HttpError(422, "invalid_scope", `${what} is not in your resume`);
  const { scope } = req;
  // A headline targets no line; the model sees the role headings for recency only.
  if (scope === "headline") return doc.sections.filter((s) => !s.hidden && s.kind === "experience").map((s) => ({ ...s, entries: s.entries.filter((e) => !e.hidden).map((e) => ({ ...e, lines: [] })) }));
  if (scope === "resume") return doc.sections.filter((s) => !s.hidden).map((s) => ({ ...s, entries: s.entries.filter((e) => !e.hidden) }));
  if (scope === "summary" || scope === "skills") {
    const section = doc.sections.find((s) => s.kind === scope && (!req.sectionId || s.id === req.sectionId));
    if (!section) throw bad(`A ${scope} section`);
    return [section];
  }
  const sections = req.sectionId ? doc.sections.filter((s) => s.id === req.sectionId) : doc.sections;
  if (scope === "section") {
    if (!req.sectionId || !sections.length) throw bad("That section");
    return sections;
  }
  for (const s of sections)
    for (const e of s.entries) {
      if (scope === "entry" && e.id === req.entryId) return [{ ...s, entries: [e] }];
      if (scope === "line" && (!req.entryId || e.id === req.entryId)) {
        const line = e.lines.find((l) => l.id === req.lineId);
        if (line) return [{ ...s, entries: [{ ...e, lines: [line] }] }];
      }
    }
  throw bad(scope === "entry" ? "That entry" : "That line");
}

function renderView(view: ResumeSection[]): string {
  const cites = (ids: string[]) => (ids.length ? ` {cites ${ids.join(", ")}}` : "");
  return view
    .map((s) =>
      [
        `Section [${s.id}] ${s.title} (${s.kind})${s.entries.length ? "" : ", no entries yet"}`,
        ...s.entries.flatMap((e) => [
          `  Entry [${e.id}] ${[e.heading, e.subheading, e.meta].filter(Boolean).join(" | ") || "(no heading)"}${e.headingFactId ? ` {heading cites ${e.headingFactId}}` : ""}`,
          ...e.lines.map((l) => `    Line [${l.id}] ${l.text}${cites(l.factIds)}`),
        ]),
      ].join("\n"),
    )
    .join("\n");
}

interface Targets {
  sections: Set<string>;
  /** entry id to its section id */
  entries: Map<string, string>;
  lines: Map<string, { sectionId: string; entryId: string; text: string; factIds: string[] }>;
}

function targetsOf(view: ResumeSection[]): Targets {
  const t: Targets = { sections: new Set(), entries: new Map(), lines: new Map() };
  for (const s of view) {
    t.sections.add(s.id);
    for (const e of s.entries) {
      t.entries.set(e.id, s.id);
      for (const l of e.lines) t.lines.set(l.id, { sectionId: s.id, entryId: e.id, text: l.text, factIds: l.factIds });
    }
  }
  return t;
}

const MAX_LINE = 300;
const MAX_HEADLINE = 160;
/** Per scope (05-resume-workspace 3.4 step 6). v1's input stops at 15, as it always did. */
const maxFor = (scope: WriterRequest["scope"], version: number) =>
  scope === "line" || scope === "headline" ? 3 : version === 1 ? 15 : scope === "resume" ? 20 : 8;

const tagsOf = (m: ModelSuggestion) => (m.tag && m.priority ? { tag: m.tag, priority: m.priority } : {});

/** Checks one model suggestion in code. Returns null to drop it: every check here fails closed. */
function verify(m: ModelSuggestion, t: Targets, citable: Map<string, ProfileFact>, refine?: Refine): ResumeSuggestion | null {
  let where: Pick<ResumeSuggestion, "sectionId" | "entryId" | "lineId" | "before">;
  if (m.action === "add") {
    if (!t.sections.has(m.sectionId) || (m.entryId !== null && t.entries.get(m.entryId) !== m.sectionId)) return null;
    where = { sectionId: m.sectionId, entryId: m.entryId, lineId: null, before: null };
  } else {
    // rewrite and remove take their section and entry from the line itself.
    const line = m.lineId === null ? undefined : t.lines.get(m.lineId);
    if (!line || m.lineId === null) return null;
    where = { sectionId: line.sectionId, entryId: line.entryId, lineId: m.lineId, before: line.text };
  }
  const base = { id: randomUUID(), ...where, why: m.why.trim().slice(0, 300), ...tagsOf(m) };
  if (m.action === "remove") return { ...base, action: "remove", after: null, factIds: [], needsFact: null };

  const factIds = [...new Set(m.factIds)];
  // Truth rule 3: a question carries no text the user could accept.
  if (m.needsFact)
    return {
      ...base,
      action: m.action,
      after: null,
      factIds: factIds.filter((id) => citable.has(id)),
      needsFact: { kind: m.needsFact.kind, question: m.needsFact.question.trim().slice(0, 200) },
    };

  const after = m.after?.trim() ?? "";
  if (!after || after.length > MAX_LINE) return null;
  // ponytail: text citing no fact, or any id that is not confirmed and owned, is dropped, not turned into a needsFact:
  // which detail is missing is unknown, so a question would be a guess. The model asks its own questions (rule 3).
  if (!factIds.length || factIds.some((id) => !citable.has(id))) return null;
  const cited = factIds.map((id) => citable.get(id)!);
  // Truth rule 2 (numbers, titles, entities, tools, links), checked here rather than trusted to the prompt.
  if (checkClaims(after, cited.map((f) => f.text)).length) return null;
  if (refineViolation(refine, { before: where.before, after, citedMetricTexts: cited.filter((f) => f.kind === "metric").map((f) => f.text) })) return null;
  if (m.tag === "fix_spelling" && (where.before === null || fixSpellingViolation(where.before, after, m.lineId ? t.lines.get(m.lineId)!.factIds : [], factIds))) return null;
  return { ...base, action: m.action, after, factIds, needsFact: null };
}

interface Derived {
  value: number;
  factIds: string[];
}

/**
 * A headline option (agents/05 4). The action and `before` come from the document, never the model. The model text is
 * checked as it was written, and the years are appended afterwards from the value code computed: nothing the model
 * says can change that number, and shapeViolations has already refused any year count it wrote.
 */
function verifyHeadline(m: ModelSuggestion, current: string | null, citable: Map<string, ProfileFact>, years: Derived | null): ResumeSuggestion | null {
  const base = {
    id: randomUUID(),
    sectionId: "headline",
    entryId: null,
    lineId: null,
    action: current === null ? ("add" as const) : ("rewrite" as const),
    before: current,
    why: m.why.trim().slice(0, 300),
    ...tagsOf(m),
  };
  const factIds = [...new Set(m.factIds)];
  if (m.needsFact) return { ...base, after: null, factIds: factIds.filter((id) => citable.has(id)), needsFact: { kind: m.needsFact.kind, question: m.needsFact.question.trim().slice(0, 200) } };
  const text = m.after?.trim() ?? "";
  if (!text || !factIds.length || factIds.some((id) => !citable.has(id))) return null;
  const cited = factIds.map((id) => citable.get(id)!);
  // "each a role and up to 3 skills from facts": it must cite the role it names.
  if (!cited.some((f) => f.kind === "role")) return null;
  if (checkClaims(text, cited.map((f) => f.text)).length) return null;
  if (!m.appendYears) return text.length > MAX_HEADLINE ? null : { ...base, after: text, factIds, needsFact: null };
  if (!years) return null;
  const after = text + yearsSuffix(years.value);
  if (after.length > MAX_HEADLINE) return null;
  return { ...base, after, factIds, needsFact: null, derived: [{ label: "Years of experience", value: years.value, factIds: years.factIds }] };
}

/** What layer 3 judges: the model's own words. The appended years come from role dates, not from the cited facts. */
const claimText = (s: ResumeSuggestion): string => (s.derived?.length ? s.after!.slice(0, -yearsSuffix(Number(s.derived[0]!.value)).length) : s.after!);

/** The deterministic answer when the model has nothing true to say: no spend, no model text (workers/05 3.4 step 7). */
function askFirst(req: WriterRequest, view: ResumeSection[], citable: Map<string, ProfileFact>, doc: ResumeInput, version: number): ResumeSuggestion | null {
  const tags = (tag: "show_scope" | "use_your_numbers", priority: "high" | "medium") => (version === 2 ? { tag, priority } : {});
  const facts = [...citable.values()];
  if (req.scope === "headline" && !facts.some((f) => f.kind === "role")) {
    return {
      id: randomUUID(),
      sectionId: "headline",
      entryId: null,
      lineId: null,
      action: doc.headline ? "rewrite" : "add",
      before: doc.headline?.text ?? null,
      after: null,
      why: "A headline needs a role to name.",
      factIds: [],
      needsFact: { kind: "role", question: "What is your most recent job title?" },
      ...tags("show_scope", "high"),
    };
  }
  if (req.refine === "use_numbers" && !facts.some((f) => f.kind === "metric")) {
    const section = view[0];
    if (!section) return null;
    const entry = req.scope === "line" || req.scope === "entry" ? section.entries[0] : undefined;
    const line = req.scope === "line" ? entry?.lines[0] : undefined;
    return {
      id: randomUUID(),
      sectionId: section.id,
      entryId: entry?.id ?? null,
      lineId: line?.id ?? null,
      action: line ? "rewrite" : "add",
      before: line?.text ?? null,
      after: null,
      why: "No fact gives a number for this yet.",
      factIds: [],
      needsFact: { kind: "metric", question: "What number shows the result of this work?" },
      ...tags("use_your_numbers", "medium"),
    };
  }
  return null;
}

/**
 * The Resume Writer (Sonnet tier): proposals for one scope of the resume, from confirmed facts only, verified in code.
 * A `note` is saved first as an unconfirmed fact and returned as `factCreated`. It is the one unconfirmed fact a
 * suggestion may cite: the web holds Accept until the user confirms it with one click (spec 2.5), and PUT /resume
 * rejects any line citing it until then, so truth rule 1 holds where a line is used.
 */
export async function suggestEdits(
  req: WriterRequest,
  ctx: WriterContext,
  deps: WriterDeps,
): Promise<{ suggestions: ResumeSuggestion[]; factCreated: ProfileFact | null }> {
  const view = scopeView(ctx.resume, req); // before the note is saved: a bad request creates nothing
  const viaGateway = Boolean(deps.callCtx) || (!deps.chat && gatewayEnabled());
  // Which object serves this call (agents/03 9). The legacy client only knows the v1 prompt and output.
  const version = viaGateway ? rolloutVersion(resumeWriter.id, deps.defaultVersion ?? 1, deps.callCtx ?? {}) : 1;
  // v1 has no headline scope, and years must never come from a prompt that does not forbid them: refuse before any write.
  if (req.scope === "headline" && version !== 2) throw new HttpError(503, "ai_unavailable", "The writing assistant is busy. Try again in a minute.");
  // The legacy client has no layer 3: enforce refuses here, before the note and before any spend.
  if (!viaGateway) await requireVerifierOrShadow("suggestions");
  const factCreated = req.note
    ? await deps.createFact({ kind: noteKind(req.note, req.scope === "resume" ? null : (view[0]?.kind ?? null)), text: req.note })
    : null;
  // The model sees at most 60 confirmed facts, the ones the target job needs most (resume-22); any confirmed fact stays citable.
  const confirmed = ctx.facts.filter((f) => f.confirmed);
  const shown = topFacts(confirmed, ctx.job ? `${ctx.job.title}\n${ctx.job.descriptionText}` : null, 60);
  const citable = new Map([...confirmed, ...(factCreated ? [factCreated] : [])].map((f) => [f.id, f]));
  const max = maxFor(req.scope, version);
  const asked = askFirst(req, view, citable, ctx.resume, version);
  if (asked) return { suggestions: [asked], factCreated };
  await deps.beforeModel?.();
  const level: ResumeLevel = req.level ?? ctx.resume.level ?? "mid";
  const currentHeadline = ctx.resume.headline?.text ?? null;
  // Rule 10: only code computes this, only for the headline, only from confirmed roles with confirmed facts under them.
  const years = req.scope === "headline" ? yearsOfExperience(ctx.employments ?? [], ctx.facts) : null;
  const shared = {
    refine: req.refine ?? null,
    // Clipped to the input schema (the gateway refuses anything longer); the render cuts the view deeper.
    resumeView: (renderView(view) || "(no roles yet)").slice(0, 12_000),
    facts: shown.map((f) => ({ id: f.id, kind: f.kind, text: f.text })),
    noteFact: factCreated ? { id: factCreated.id, kind: factCreated.kind, text: factCreated.text.slice(0, 400) } : null,
    job: ctx.job ? { title: ctx.job.title.slice(0, 200), company: ctx.job.company.slice(0, 200), descriptionText: ctx.job.descriptionText.slice(0, 20_000) } : null,
    maxSuggestions: max,
  };

  const parts = [
    `Task: ${SCOPE[req.scope as SuggestionRequest["scope"]]} At most ${max} suggestions.`,
    req.refine ? `Style: ${REFINE[req.refine]}` : "",
    `Facts (confirmed, cite by id):\n${shown.map(factLine).join("\n") || "(none)"}`,
    factCreated
      ? `The user's own words, saved as fact ${factCreated.id}. Cite it only for what it says; the user confirms it before a line citing it is kept.\n${untrusted("note", factLine(factCreated), 700)}`
      : "",
    `Resume:\n${renderView(view)}`,
    ctx.job ? `Target job. Favour what it asks for, using only the facts:\n${untrusted("job", `${ctx.job.title} at ${ctx.job.company}\n\n${ctx.job.descriptionText}`, 6000)}` : "",
  ];
  const out: { suggestions: ModelSuggestion[] } =
    // The gateway path (LLM_GATEWAY=anthropic): suggestions come back and the same verify()
    // pipeline below applies the truth rules in code.
    viaGateway
      ? version === 2
        ? await runAgent(
            resumeWriterV2,
            { ...shared, scope: req.scope, level, headline: currentHeadline, derived: years ? [{ label: "years_of_experience" as const, value: years.value, factIds: years.factIds }] : [] },
            deps.callCtx ?? {},
          ).then((r) => r.data)
        : await runAgent(resumeWriter, { ...shared, scope: req.scope as SuggestionRequest["scope"] }, deps.callCtx ?? {}).then((r) => r.data)
      : await (deps.chat ?? chatJson)({
          tier: "smart",
          agent: "resume-writer",
          schema: modelSchema,
          // 15 suggestions with why and factIds run past 2000 tokens; a truncated reply is invalid JSON and loses them all.
          maxTokens: req.scope === "line" ? 800 : 4000,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: parts.filter(Boolean).join("\n\n") },
          ],
        });

  const targets = targetsOf(view);
  const suggestions = out.suggestions
    .map((m) => (req.scope === "headline" ? verifyHeadline(m, currentHeadline, citable, years) : verify(m, targets, citable, req.refine)))
    .filter((s): s is ResumeSuggestion => s !== null)
    .slice(0, max);
  if (!viaGateway) return { suggestions, factCreated };
  // Layer 3 on text the user could accept. Suggestions neither escalate nor repair: the user is waiting on a Sonnet
  // call already (agents/09 1), and a dropped suggestion costs only a shorter list.
  const { dropped } = await verifyClaims(
    suggestions.flatMap((s) => (s.after === null || s.needsFact ? [] : [{ key: s.id, kind: "resume_line" as const, text: claimText(s), factIds: s.factIds }])),
    new Map([...citable].map(([id, f]) => [id, f.text])),
    { path: "suggestions", target: null, ctx: deps.callCtx ?? {}, escalate: false },
  );
  const drop = new Set(dropped.map((d) => d.key));
  return { suggestions: suggestions.filter((s) => !drop.has(s.id)), factCreated };
}
