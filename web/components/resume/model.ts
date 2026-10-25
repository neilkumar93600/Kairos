import type { Resume, ResumeEntry, ResumeInput, ResumeLine, ResumeSection, ResumeSuggestion } from "@auto-career/shared";
import type { Fact } from "@/hooks/use-profile";

/*
 * Pure document model for the resume workspace (spec 2026-10-23-resume-workspace). Every edit returns a new Resume, so
 * the undo stack is a list of snapshots. Nothing here talks to the network.
 */

export type FactMap = Map<string, Fact>;
export const newId = () => crypto.randomUUID();

const move = <T,>(list: T[], i: number, by: number) => {
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

export function editSection(doc: Resume, sectionId: string, fn: (s: ResumeSection) => ResumeSection): Resume {
  return { ...doc, sections: doc.sections.map((s) => (s.id === sectionId ? fn(s) : s)) };
}

export function editEntry(doc: Resume, sectionId: string, entryId: string, fn: (e: ResumeEntry) => ResumeEntry): Resume {
  return editSection(doc, sectionId, (s) => ({ ...s, entries: s.entries.map((e) => (e.id === entryId ? fn(e) : e)) }));
}

export const moveSection = (doc: Resume, id: string, by: number): Resume => ({
  ...doc,
  sections: move(doc.sections, doc.sections.findIndex((s) => s.id === id), by),
});

export const moveEntry = (doc: Resume, sectionId: string, entryId: string, by: number) =>
  editSection(doc, sectionId, (s) => ({ ...s, entries: move(s.entries, s.entries.findIndex((e) => e.id === entryId), by) }));

export const moveLine = (doc: Resume, sectionId: string, entryId: string, lineId: string, by: number) =>
  editEntry(doc, sectionId, entryId, (e) => ({ ...e, lines: move(e.lines, e.lines.findIndex((l) => l.id === lineId), by) }));

export const removeLine = (doc: Resume, sectionId: string, entryId: string, lineId: string) =>
  editEntry(doc, sectionId, entryId, (e) => ({ ...e, lines: e.lines.filter((l) => l.id !== lineId) }));

export const setLine = (doc: Resume, sectionId: string, entryId: string, lineId: string, patch: Partial<ResumeLine>) =>
  editEntry(doc, sectionId, entryId, (e) => ({ ...e, lines: e.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }));

export const blankEntry = (over: Partial<ResumeEntry> = {}): ResumeEntry => ({
  id: newId(),
  heading: "",
  subheading: null,
  meta: null,
  headingFactId: null,
  hidden: false,
  lines: [],
  ...over,
});

/** Adds a line to the entry, or to the section's first entry, creating one for summary and skills when none exists. */
export function addLine(doc: Resume, sectionId: string, entryId: string | null, text: string, factIds: string[]): Resume {
  const section = doc.sections.find((s) => s.id === sectionId);
  if (!section) return doc;
  const line: ResumeLine = { id: newId(), section: section.title, text, factIds };
  const target = section.entries.find((e) => e.id === entryId) ?? section.entries[0];
  if (target) return editEntry(doc, sectionId, target.id, (e) => ({ ...e, lines: [...e.lines, line] }));
  return editSection(doc, sectionId, (s) => ({ ...s, entries: [blankEntry({ lines: [line] })] }));
}

/** Newest first by the latest year in the dates; "present" counts as now; undated entries go last. Stable. */
export function sortNewestFirst(entries: ResumeEntry[]) {
  const key = (e: ResumeEntry) => {
    const meta = e.meta ?? "";
    if (/\b(present|now|current)\b/i.test(meta)) return 9999;
    return Math.max(-1, ...(meta.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number));
  };
  return [...entries].sort((a, b) => key(b) - key(a));
}

export interface LineAt {
  section: ResumeSection;
  entry: ResumeEntry;
  line: ResumeLine;
}

export function locateLine(doc: Resume, lineId: string): LineAt | null {
  for (const section of doc.sections)
    for (const entry of section.entries) {
      const line = entry.lines.find((l) => l.id === lineId);
      if (line) return { section, entry, line };
    }
  return null;
}

const allLines = (doc: Resume): LineAt[] =>
  doc.sections.flatMap((section) => section.entries.flatMap((entry) => entry.lines.map((line) => ({ section, entry, line }))));

/** Lines that print: visible sections, visible entries, in document order. */
export function visibleLines(doc: Resume): LineAt[] {
  return doc.sections
    .filter((s) => !s.hidden)
    .flatMap((section) => section.entries.filter((e) => !e.hidden).flatMap((entry) => entry.lines.map((line) => ({ section, entry, line }))));
}

export const toInput = (doc: Resume): ResumeInput => ({ name: doc.name, density: doc.density, contact: doc.contact, sections: doc.sections });

/** What Create draft sends to PATCH /applications/:id: the printed lines, each labelled with its section's title. */
export const toDraftLines = (doc: Resume): ResumeLine[] => visibleLines(doc).map(({ section, line }) => ({ ...line, section: section.title }));

/* ---- suggestions ---- */

export type AcceptState = "ok" | "needs_fact" | "unconfirmed";

export const unconfirmedIds = (ids: string[], facts: FactMap) => ids.filter((id) => !facts.get(id)?.confirmed);

/**
 * Truth rules 1 and 3: a suggestion with needsFact, or with no text or no cited fact, has nothing to accept; one that
 * cites a fact the user has not confirmed waits for the confirmation. Removals cite nothing and are always acceptable.
 */
export function acceptState(s: ResumeSuggestion, facts: FactMap): AcceptState {
  if (s.action === "remove") return "ok";
  if (s.needsFact || !s.after?.trim() || s.factIds.length === 0) return "needs_fact";
  return unconfirmedIds(s.factIds, facts).length ? "unconfirmed" : "ok";
}

export function applySuggestion(doc: Resume, s: ResumeSuggestion, text = s.after ?? ""): Resume {
  if (s.action === "add") return addLine(doc, s.sectionId, s.entryId, text, s.factIds);
  const at = s.lineId ? locateLine(doc, s.lineId) : null;
  if (!at) return doc;
  if (s.action === "remove") return removeLine(doc, at.section.id, at.entry.id, at.line.id);
  return setLine(doc, at.section.id, at.entry.id, at.line.id, { text, factIds: s.factIds.length ? s.factIds : at.line.factIds });
}

/** Merge new suggestions into the pool: same id replaces, the rest append. */
export function mergeSuggestions(pool: ResumeSuggestion[], incoming: ResumeSuggestion[]) {
  const ids = new Set(incoming.map((s) => s.id));
  return [...pool.filter((s) => !ids.has(s.id)), ...incoming];
}

/* ---- Resume check: deterministic, from the document and the facts only (truth rule 5) ---- */

/** Printed page at US Letter with 0.6in margins: 9.8in of content at 96 px per inch. */
export const PAGE_CONTENT_PX = 9.8 * 96;

export interface Measure {
  pages: number;
  /** Lines that print on more than two lines. */
  longLineIds: string[];
}

export type CheckTarget = { label: string; lineId?: string; sectionId?: string; entryId?: string; contact?: boolean };

export interface Check {
  id: string;
  label: string;
  /** pending: still measuring or loading facts. none: nothing to inspect yet. Neither counts toward the score. */
  status: "pass" | "fail" | "pending" | "none";
  detail: string;
  targets: CheckTarget[];
}

const clip = (t: string, n = 48) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lineTarget = ({ section, line }: LineAt): CheckTarget => ({ label: `${section.title}: ${clip(line.text)}`, lineId: line.id, sectionId: section.id });
const openingWord = (t: string) => (t.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
const DATED = new Set<ResumeSection["kind"]>(["experience", "projects", "education", "certifications"]);

export function resumeCheck(doc: Resume, facts: FactMap | null, measure: Measure | null) {
  const lines = visibleLines(doc);
  const checks: Check[] = [];
  const add = (id: string, label: string, fail: CheckTarget[] | null, ok: string, bad: string) =>
    checks.push({ id, label, status: fail === null ? "pending" : fail.length ? "fail" : "pass", detail: fail === null ? "Checking" : fail.length ? bad : ok, targets: fail ?? [] });
  // Line checks pass on an empty page without inspecting anything; they wait for the first line instead.
  const lineCheck = (id: string, label: string, fail: CheckTarget[] | null, ok: string, bad: string) =>
    lines.length ? add(id, label, fail, ok, bad) : checks.push({ id, label, status: "none", detail: "No lines to check yet.", targets: [] });

  // Lines, and entry headings that rest on a fact: PUT /resume rejects either when the fact is not confirmed.
  const uncited = facts
    ? [
        ...allLines(doc).filter(({ line }) => !line.factIds.length || unconfirmedIds(line.factIds, facts).length).map(lineTarget),
        ...doc.sections.flatMap((s) =>
          s.entries
            .filter((e) => e.headingFactId && !facts.get(e.headingFactId)?.confirmed)
            .map((e) => ({ label: `${s.title} heading: ${clip(e.heading || "Untitled entry")}`, sectionId: s.id, entryId: e.id })),
        ),
      ]
    : null;
  lineCheck("cited", "Every line cites a confirmed fact", uncited, "Each printed line and heading rests on facts you confirmed.",
    `${plural(uncited?.length ?? 0, "line or heading", "lines or headings")} cite${uncited?.length === 1 ? "s" : ""} a fact you have not confirmed, or no fact.`);

  const missing = (["name", "email", "phone", "location"] as const).filter((k) => !doc.contact[k].trim());
  add("contact", "Contact is complete", missing.length ? [{ label: `Contact: add ${missing.join(", ")}`, contact: true }] : [],
    "Name, email, phone and location are all there.", `Missing ${missing.join(", ")}.`);

  const density = doc.density === "compact" ? "Compact" : "Comfortable";
  add("page", "Fits on one page", measure && (measure.pages > 1 ? [{ label: "The whole document" }] : []), `One page at ${density} density.`,
    `Runs to ${plural(measure?.pages ?? 0, "page")} at ${density} density. Hide or shorten lines${doc.density === "compact" ? "" : ", or switch to Compact"}.`);

  const long = measure && lines.filter(({ line }) => measure.longLineIds.includes(line.id));
  lineCheck("length", "No line runs past two printed lines", long && long.map(lineTarget), "Every line prints on one or two lines.",
    `${plural(long?.length ?? 0, "line")} print${long?.length === 1 ? "s" : ""} on three lines or more.`);

  // Three lines in a row inside one section that open with the same word. Skills are terms, not sentences.
  const repeated = new Set<string>();
  for (const section of doc.sections) {
    if (section.kind === "skills") continue;
    const run = lines.filter((l) => l.section.id === section.id);
    for (let i = 2; i < run.length; i++) {
      const w = openingWord(run[i].line.text);
      if (w && w === openingWord(run[i - 1].line.text) && w === openingWord(run[i - 2].line.text))
        [run[i - 2], run[i - 1], run[i]].forEach((l) => repeated.add(l.line.id));
    }
  }
  const rep = lines.filter(({ line }) => repeated.has(line.id));
  lineCheck("verbs", "No opening word repeats three lines in a row", rep.map(lineTarget), "Openings vary from line to line.",
    `${plural(rep.length, "line")} open with the same word as the two before or after.`);

  const empty = doc.sections.filter((s) => !s.hidden && !s.entries.some((e) => !e.hidden && (e.lines.length || e.heading.trim())));
  add("empty", "No empty section is visible", empty.map((s) => ({ label: `${s.title} is empty`, sectionId: s.id })), "Every visible section has content.",
    `${plural(empty.length, "section")} would print with no content. Add lines or hide ${empty.length === 1 ? "it" : "them"}.`);

  const undated = doc.sections
    .filter((s) => !s.hidden && DATED.has(s.kind))
    .flatMap((s) => s.entries.filter((e) => !e.hidden && !e.meta?.trim()).map((e) => ({ label: `${s.title}: ${clip(e.heading || "Untitled entry")}`, sectionId: s.id, entryId: e.id })));
  add("dates", "Every entry has dates", undated, "Each role, project, degree and certificate shows its dates.", `${plural(undated.length, "entry", "entries")} ha${undated.length === 1 ? "s" : "ve"} no dates.`);

  const counted = checks.filter((c) => c.status === "pass" || c.status === "fail");
  const passed = counted.filter((c) => c.status === "pass").length;
  const pending = checks.filter((c) => c.status === "pending").length;
  if (!lines.length) return { score: null, basis: "No score until the page has lines that cite your facts", checks };
  return {
    score: counted.length ? Math.round((passed / counted.length) * 100) : null,
    basis: `${passed} of ${counted.length} checks pass${pending ? `, ${pending} still measuring` : ""}`,
    checks,
  };
}
