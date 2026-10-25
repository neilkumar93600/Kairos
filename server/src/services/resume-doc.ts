import type { FactKind, ResumeContact, ResumeEntry, ResumeInput, ResumeSection, ResumeSectionKind } from "@auto-career/shared";

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

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/**
 * The resume a user starts from, built from confirmed facts only. Ids derive from fact ids, so they are stable.
 * Each role, project, education and certification fact becomes an entry whose heading is the fact (headingFactId);
 * skills become one entry with a line per skill fact. Summary starts empty, and metric facts are left for the
 * Resume Writer to cite: a fact does not say which role it belongs to. Empty sections stay (the web shows them).
 * ponytail: entries capped at 30 and skill lines at 40, the schema limits; facts past that are dropped from the default.
 */
export function defaultResume(facts: readonly Pick<ProfileFact, "id" | "kind" | "text" | "confirmed">[], contact: ResumeContact): ResumeInput {
  const confirmed = facts.filter((f) => f.confirmed);
  const sections = DEFAULT_SECTIONS.map(([kind, title, factKind]): ResumeSection => {
    const mine = confirmed.filter((f) => f.kind === factKind);
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

/**
 * The truth lock for a whole document: ids of every part citing a fact that is not this user's AND confirmed.
 * Lines are reported by line id. An entry whose headingFactId fails is reported by its entry id (an entry has no
 * line to name; ids are unique across the document, so the web can match either). Hidden parts are checked too:
 * they can be shown again without another save.
 */
export function truthLockViolations(doc: ResumeInput, confirmedOwnedFactIds: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  for (const section of doc.sections)
    for (const entry of section.entries) {
      if (entry.headingFactId !== null && !confirmedOwnedFactIds.has(entry.headingFactId)) out.add(entry.id);
      for (const line of entry.lines)
        if (!line.factIds.length || line.factIds.some((id) => !confirmedOwnedFactIds.has(id))) out.add(line.id);
    }
  return [...out];
}

/**
 * The plain text layer of what prints: visible sections and entries in order, contact left out. Feeds the deterministic
 * match score and the resume check.
 */
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

export function renderResumeText(doc: ResumeInput): string {
  return doc.sections
    .filter((s) => !s.hidden)
    .map((s) => {
      const body = s.entries
        .filter((e) => !e.hidden)
        .flatMap((e) => [[e.heading, e.subheading, e.meta].filter(Boolean).join(" | "), ...e.lines.map((l) => `- ${l.text}`)])
        .filter(Boolean);
      return body.length ? [s.title, ...body].join("\n") : "";
    })
    .filter(Boolean)
    .join("\n\n");
}
