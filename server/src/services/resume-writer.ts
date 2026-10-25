import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  FACT_KINDS,
  type FactKind,
  type ResumeInput,
  type ResumeSection,
  type ResumeSectionKind,
  type ResumeSuggestion,
  type SuggestionRequest,
} from "@auto-career/shared";
import { UNTRUSTED_RULES, untrusted } from "../ai/untrusted";
import { HttpError } from "../lib/errors";
import { inventedDetails } from "./invented-details";
import { runAgent } from "../llm/gateway";
import { resumeWriter } from "../agents/resume-writer/spec";
import { gatewayEnabled } from "../llm/wire";
import type { AgentCallContext } from "../agents/types";
import { chatJson } from "./llm";
import type { ProfileFact } from "./resume-doc";

export interface WriterContext {
  resume: ResumeInput;
  /** All of the user's facts. Only confirmed ones are shown to the model and may be cited. */
  facts: ProfileFact[];
  job?: { title: string; company: string; descriptionText: string } | null;
}

export interface WriterDeps {
  chat?: typeof chatJson;
  /** Forces the gateway path with a call context (tests inject a fake through configureGateway). */
  callCtx?: AgentCallContext;
  /** Saves the user's note as an UNCONFIRMED fact and returns it. */
  createFact: (input: { kind: FactKind; text: string }) => Promise<ProfileFact>;
}

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
type ModelSuggestion = z.infer<typeof modelSchema>["suggestions"][number];

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
function scopeView(doc: ResumeInput, req: SuggestionRequest): ResumeSection[] {
  const bad = (what: string) => new HttpError(422, "invalid_scope", `${what} is not in your resume`);
  const { scope } = req;
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
  lines: Map<string, { sectionId: string; entryId: string; text: string }>;
}

function targetsOf(view: ResumeSection[]): Targets {
  const t: Targets = { sections: new Set(), entries: new Map(), lines: new Map() };
  for (const s of view) {
    t.sections.add(s.id);
    for (const e of s.entries) {
      t.entries.set(e.id, s.id);
      for (const l of e.lines) t.lines.set(l.id, { sectionId: s.id, entryId: e.id, text: l.text });
    }
  }
  return t;
}

/** Checks one model suggestion in code. Returns null to drop it. */
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
  const base = { id: randomUUID(), ...where, why: m.why.trim().slice(0, 300) };
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
  if (!after || after.length > 400) return null;
  // ponytail: text citing no fact, or any id that is not confirmed and owned, is dropped, not turned into a needsFact:
  // which detail is missing is unknown, so a question would be a guess. The model asks its own questions (rule 3).
  if (!factIds.length || factIds.some((id) => !citable.has(id))) return null;
  // Truth rule 2 for numbers and tools, checked here rather than trusted to the prompt.
  if (inventedDetails(after, factIds.map((id) => citable.get(id)?.text ?? "")).length) return null;
  if (refine === "shorter" && where.before !== null && after.length >= where.before.length) return null;
  return { ...base, action: m.action, after, factIds, needsFact: null };
}

/**
 * The Resume Writer (Sonnet tier): proposals for one scope of the resume, from confirmed facts only, verified in code.
 * A `note` is saved first as an unconfirmed fact and returned as `factCreated`. It is the one unconfirmed fact a
 * suggestion may cite: the web holds Accept until the user confirms it with one click (spec 2.5), and PUT /resume
 * rejects any line citing it until then, so truth rule 1 holds where a line is used.
 */
export async function suggestEdits(
  req: SuggestionRequest,
  ctx: WriterContext,
  deps: WriterDeps,
): Promise<{ suggestions: ResumeSuggestion[]; factCreated: ProfileFact | null }> {
  const view = scopeView(ctx.resume, req); // before the note is saved: a bad request creates nothing
  const factCreated = req.note
    ? await deps.createFact({ kind: noteKind(req.note, req.scope === "resume" ? null : (view[0]?.kind ?? null)), text: req.note })
    : null;
  const confirmed = ctx.facts.filter((f) => f.confirmed);
  const citable = new Map([...confirmed, ...(factCreated ? [factCreated] : [])].map((f) => [f.id, f]));
  const max = req.scope === "line" ? 3 : 15;

  const parts = [
    `Task: ${SCOPE[req.scope]} At most ${max} suggestions.`,
    req.refine ? `Style: ${REFINE[req.refine]}` : "",
    `Facts (confirmed, cite by id):\n${confirmed.map(factLine).join("\n") || "(none)"}`,
    factCreated
      ? `The user's own words, saved as fact ${factCreated.id}. Cite it only for what it says; the user confirms it before a line citing it is kept.\n${untrusted("note", factLine(factCreated), 700)}`
      : "",
    `Resume:\n${renderView(view)}`,
    ctx.job ? `Target job. Favour what it asks for, using only the facts:\n${untrusted("job", `${ctx.job.title} at ${ctx.job.company}\n\n${ctx.job.descriptionText}`, 6000)}` : "",
  ];
  const out =
    // The gateway path (LLM_GATEWAY=anthropic): suggestions come back and the same verify()
    // pipeline below applies the truth rules in code.
    deps.callCtx || (!deps.chat && gatewayEnabled())
      ? await runAgent(
          resumeWriter,
          {
            scope: req.scope,
            refine: req.refine ?? null,
            resumeView: renderView(view),
            facts: confirmed.map((f) => ({ id: f.id, kind: f.kind, text: f.text })),
            noteFact: factCreated ? { id: factCreated.id, kind: factCreated.kind, text: factCreated.text } : null,
            job: ctx.job ? { title: ctx.job.title, company: ctx.job.company, descriptionText: ctx.job.descriptionText } : null,
            maxSuggestions: max,
          },
          deps.callCtx ?? {},
        ).then((r) => ({ suggestions: r.data.suggestions }))
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
    .map((m) => verify(m, targets, citable, req.refine))
    .filter((s): s is ResumeSuggestion => s !== null)
    .slice(0, max);
  return { suggestions, factCreated };
}
