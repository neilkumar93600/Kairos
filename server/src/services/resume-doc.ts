import type { FactKind, ResumeContact, ResumeEntry, ResumeInput, ResumeLine, ResumeSection, ResumeSectionKind } from "@auto-career/shared";
import { YEARS_SUFFIX } from "../agents/resume-writer/checks";
import { checkClaims, type ClaimRule } from "../llm/claims";

/** A profile fact as the API returns it (web/hooks/use-profile.ts `Fact`). */
export interface ProfileFact {
  id: string;
  kind: FactKind;
  text: string;
  sourceSpan: string | null;
  confirmed: boolean;
}

const DEFAULT_SECTIONS: [ResumeSectionKind, string, FactKind | null][] = [
  ["summary", "Summary", null],
  ["experience", "Experience", "role"],
  ["projects", "Projects", "project"],
  ["skills", "Skills", "skill"],
  ["education", "Education", "education"],
  ["certifications", "Certifications", "certification"],
];

/** An employment as the default document reads it (employments table, WP-17). */
export interface ProfileEmployment {
  id: string;
  title: string;
  company: string;
  datesText: string | null;
  confirmed: boolean;
}
/** The role dates a year count is computed from (employments table). */
export interface EmploymentDates {
  id: string;
  confirmed: boolean;
  startMonth: string | null;
  endMonth: string | null;
  isCurrent: boolean;
}

const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

/**
 * Years of experience (truth rule 10, resume-89): whole years of the months covered by confirmed roles, overlaps counted
 * once and gaps not at all, so it never overstates. Fails closed: a role with no start, or no end while not current, or
 * with no confirmed fact to cite, does not count. Null under one year or above the schema's 60. It cites one fact per
 * counted role, the role fact where there is one.
 */
export function yearsOfExperience(
  roles: readonly EmploymentDates[],
  facts: readonly { id: string; kind: string; confirmed: boolean; employmentId?: string | null }[],
  now: Date = new Date(),
): { value: number; factIds: string[] } | null {
  const nowEnd = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  const factIds: string[] = [];
  const spans: [number, number][] = [];
  for (const r of roles) {
    if (!r.confirmed || !r.startMonth || (!r.endMonth && !r.isCurrent)) continue;
    const mine = facts.filter((f) => f.confirmed && f.employmentId === r.id);
    const cite = mine.find((f) => f.kind === "role") ?? mine[0];
    if (!cite) continue;
    const start = monthIndex(r.startMonth);
    const end = Math.min(r.endMonth ? monthIndex(r.endMonth) + 1 : nowEnd, nowEnd);
    if (start >= end) continue;
    spans.push([start, end]);
    factIds.push(cite.id);
  }
  let months = 0;
  let upTo = -Infinity;
  for (const [start, end] of spans.sort((a, b) => a[0] - b[0])) {
    if (end > upTo) months += end - Math.max(start, upTo);
    upTo = Math.max(upTo, end);
  }
  const value = Math.floor(months / 12);
  return value >= 1 && value <= 60 ? { value, factIds } : null;
}

const LINE_KINDS = new Set<FactKind>(["role", "metric", "project"]);

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/**
 * The resume a user starts from, built from confirmed facts only. Ids derive from fact ids, so they are stable.
 * Each role, project, education and certification fact becomes an entry whose heading is the fact (headingFactId);
 * skills become one entry with a line per skill fact. Summary starts empty, and metric facts are left for the
 * Resume Writer to cite: a fact does not say which role it belongs to. Empty sections stay (the web shows them).
 * ponytail: entries capped at 30 and skill lines at 40, the schema limits; facts past that are dropped from the default.
 *
 * Employment-aware (resume-02, WP-17): a confirmed employment with confirmed facts under it becomes one Experience
 * entry, title, company and the dates as written, whose lines are its role, metric and project facts and whose heading
 * cites its first one. Facts under an employment leave their own sections; the rest behave as above.
 */
export function defaultResume(
  facts: readonly (Pick<ProfileFact, "id" | "kind" | "text" | "confirmed"> & { employmentId?: string | null })[],
  contact: ResumeContact,
  employments: readonly ProfileEmployment[] = [],
): ResumeInput {
  const roles = employments
    .filter((e) => e.confirmed)
    .map((e) => ({ e, lines: facts.filter((f) => f.confirmed && f.employmentId === e.id && LINE_KINDS.has(f.kind)) }))
    .filter((r) => r.lines.length > 0);
  const placed = new Set(roles.flatMap((r) => r.lines.map((f) => f.id)));
  const confirmed = facts.filter((f) => f.confirmed && !placed.has(f.id));
  const sections = DEFAULT_SECTIONS.map(([kind, title, factKind]): ResumeSection => {
    const mine = confirmed.filter((f) => f.kind === factKind);
    if (kind === "experience" && roles.length) {
      const fromRoles: ResumeEntry[] = roles.map(({ e, lines }) => ({
        id: `entry-emp-${e.id}`,
        heading: clip(e.title, 200),
        subheading: clip(e.company, 200),
        meta: e.datesText ? clip(e.datesText, 120) : null,
        headingFactId: (lines.find((f) => f.kind === "role") ?? lines[0]!).id,
        hidden: false,
        lines: lines.slice(0, 40).map((f) => ({ id: `line-${f.id}`, section: title, text: clip(f.text, 400), factIds: [f.id] })),
      }));
      const rest = mine.map((f) => ({ id: `entry-${f.id}`, heading: clip(f.text, 200), subheading: null, meta: null, headingFactId: f.id, hidden: false, lines: [] }));
      return { id: `section-${kind}`, kind, title, hidden: false, entries: [...fromRoles, ...rest].slice(0, 30) };
    }
    const entries: ResumeEntry[] =
      kind !== "skills"
        ? mine.slice(0, 30).map((f) => ({ id: `entry-${f.id}`, heading: clip(f.text, 200), subheading: null, meta: null, headingFactId: f.id, hidden: false, lines: [] }))
        : mine.length
          ? [
              {
                id: "entry-skills",
                heading: "",
                subheading: null,
                meta: null,
                headingFactId: null,
                hidden: false,
                lines: mine.slice(0, 40).map((f) => ({ id: `line-${f.id}`, section: title, text: clip(f.text, 400), factIds: [f.id] })),
              },
            ]
          : [];
    return { id: `section-${kind}`, kind, title, hidden: false, entries };
  });
  return { name: "Base resume", density: "comfortable", contact, sections };
}

/** How a headline is named in truth_lock details: it has no id of its own and sits outside the sections. */
export const HEADLINE_ID = "headline";

/**
 * The truth lock for a whole document: ids of every part citing a fact that is not this user's AND confirmed.
 * The headline is reported as HEADLINE_ID.
 * Lines are reported by line id. An entry whose headingFactId fails is reported by its entry id (an entry has no
 * line to name; ids are unique across the document, so the web can match either). Hidden parts are checked too:
 * they can be shown again without another save.
 */
export function truthLockViolations(doc: ResumeInput, confirmedOwnedFactIds: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  if (doc.headline && doc.headline.factIds.some((id) => !confirmedOwnedFactIds.has(id))) out.add(HEADLINE_ID);
  for (const section of doc.sections)
    for (const entry of section.entries) {
      if (entry.headingFactId !== null && !confirmedOwnedFactIds.has(entry.headingFactId)) out.add(entry.id);
      for (const line of entry.lines)
        if (!line.factIds.length || line.factIds.some((id) => !confirmedOwnedFactIds.has(id))) out.add(line.id);
    }
  return [...out];
}

/** Identity of a line's content: the same id, text and citations means unchanged, so it is not checked again. */
export const lineKey = (l: ResumeLine): string => JSON.stringify([l.id, l.text, l.factIds]);

/**
 * checkClaims on every line that differs from `stored` and cites only facts in `confirmed` (id to text); lines citing
 * anything else already fail truthLockViolations. Returns line id to the first rule it breaks (05-api 11.1 step 2).
 */
export function claimViolations(doc: ResumeInput, confirmed: ReadonlyMap<string, string>, stored: ResumeInput | null): Record<string, ClaimRule> {
  const lines = (d: ResumeInput) => d.sections.flatMap((s) => s.entries.flatMap((e) => e.lines));
  const before = new Set(stored ? lines(stored).map(lineKey) : []);
  const out: Record<string, ClaimRule> = {};
  for (const line of lines(doc)) {
    if (before.has(lineKey(line)) || !line.factIds.every((id) => confirmed.has(id))) continue;
    const [claim] = checkClaims(line.text, line.factIds.map((id) => confirmed.get(id)!));
    if (claim) out[line.id] = claim.rule;
  }
  return out;
}

/**
 * checkClaims on a headline that changed. Its trailing " · N years" is not a claim of the cited facts: it is valid only
 * when N is what code computes from role dates today (rule 10), whoever typed it. Null when the headline is fine.
 */
export function headlineViolation(doc: ResumeInput, confirmed: ReadonlyMap<string, string>, stored: ResumeInput | null, years: number | null): ClaimRule | null {
  const h = doc.headline;
  if (!h || !h.factIds.every((id) => confirmed.has(id))) return null;
  if (stored?.headline && stored.headline.text === h.text && stored.headline.factIds.join() === h.factIds.join()) return null;
  const stated = h.text.match(YEARS_SUFFIX);
  if (stated && Number(stated[1]) !== years) return "number_not_in_facts";
  const [claim] = checkClaims(stated ? h.text.slice(0, stated.index) : h.text, h.factIds.map((id) => confirmed.get(id)!));
  return claim?.rule ?? null;
}

export interface ProfileContactUpdate {
  phone: string | null;
  city: string | null;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

/**
 * The profile fields a saved resume writes back (architecture B.8.3), because application forms are filled from the
 * profile. Location becomes city, minus the ", <country>" the default document appended; links are sorted by host.
 * ponytail: a link removed from the resume stays on the profile, since forms may still need it.
 */
export function profileContactFrom(contact: ResumeContact, country: string | null): ProfileContactUpdate {
  const location = contact.location.trim();
  const suffix = country ? `, ${country}` : "";
  const city = suffix && location.toLowerCase().endsWith(suffix.toLowerCase()) ? location.slice(0, -suffix.length).trim() : location;
  const out: ProfileContactUpdate = { phone: contact.phone.trim() || null, city: city || null };
  for (const raw of contact.links) {
    const url = toUrl(raw);
    if (!url) continue;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) out.linkedinUrl ??= url.href;
    else if (host === "github.com") out.githubUrl ??= url.href;
    else out.portfolioUrl ??= url.href;
  }
  return out;
}

/** A resume link as an absolute http(s) URL; bare "github.com/x" gets https. Anything unparseable is skipped. */
function toUrl(raw: string): URL | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

/**
 * What prints, in print order: the one view the template (templates/classic.typ) and resumePlainText both read, so they
 * cannot disagree about a line. Hidden parts and empty ones are gone. Design never touches content (PRD rule 8).
 */
export interface PrintView {
  name: string;
  headline: string | null;
  contact: string;
  sections: { title: string; entries: { heading: string; lines: string[] }[] }[];
}

export function printView(doc: ResumeInput): PrintView {
  const { name, email, phone, location, links } = doc.contact;
  return {
    name: name.trim(),
    headline: doc.headline?.text ?? null,
    contact: [email, phone, location, ...links].map((c) => c.trim()).filter(Boolean).join(" | "),
    sections: doc.sections
      .filter((s) => !s.hidden)
      .map((s) => ({
        title: s.title,
        entries: s.entries
          .filter((e) => !e.hidden)
          .map((e) => ({ heading: [e.heading, e.subheading, e.meta].filter(Boolean).join(" | "), lines: e.lines.map((l) => l.text) }))
          .filter((e) => e.heading || e.lines.length),
      }))
      .filter((s) => s.entries.length),
  };
}

/** The document as plain text (resume-30): F1's resumeText, the txt export, and the lines the PDF's text layer must hold in order. */
export function resumePlainText(doc: ResumeInput): string {
  const v = printView(doc);
  return [v.name, v.headline, v.contact, ...v.sections.flatMap((s) => [s.title, ...s.entries.flatMap((e) => [e.heading, ...e.lines])])].filter(Boolean).join("\n");
}
