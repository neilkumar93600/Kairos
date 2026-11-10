/** Fill-in form (spec 5.3b): how typed entries become fact text, and where unsaved sections wait in sessionStorage. */

const join = (parts: Array<string | undefined>, sep = ", ") =>
  parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(sep);

/** "B.Tech Computer Science, Sample University, 2018 to 2022", plus ", grade 8.4" when a grade is given. */
export function educationFact(e: { school: string; degree: string; field?: string; start?: string; end?: string; grade?: string }): string {
  const start = e.start?.trim();
  const end = e.end?.trim();
  const years = start && end ? `${start} to ${end}` : start ? `from ${start}` : end;
  const grade = e.grade?.trim();
  return join([join([e.degree, e.field], " "), e.school, years, grade && `grade ${grade}`]);
}

/** One fact per group of up to 10 skills, joined with ", ". */
export function skillFacts(skills: string[]): string[] {
  const groups: string[] = [];
  for (let i = 0; i < skills.length; i += 10) {
    const text = skills.slice(i, i + 10).join(", ");
    // ponytail: a fact needs 3 characters, so a lone "Go" or "C" is named; rare enough not to rebalance the groups
    groups.push(text.length < 3 ? `Skills: ${text}` : text);
  }
  return groups;
}

/** "Languages: English, Hindi" as one skill fact (no language fact kind), or null when there are none. */
export function languagesFact(langs: string[]): string | null {
  return langs.length ? `Languages: ${langs.join(", ")}` : null;
}

/** "Job board: Built a search page (https://example.com)". */
export function projectFact(p: { name: string; what: string; link: string }): string {
  const link = p.link.trim();
  return join([p.name, p.what], ": ") + (link ? ` (${link})` : "");
}

/** "Cloud Practitioner, Sample Institute, 2023". */
export function certificationFact(c: { name: string; issuer: string; year: string }): string {
  return join([c.name, c.issuer, c.year]);
}

export function draftKey(section: string): string {
  return "kairos.onboarding.form." + section;
}
