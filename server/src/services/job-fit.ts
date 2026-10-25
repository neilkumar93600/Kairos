import type { JobFit, Seniority } from "@auto-career/shared";
import { findSkills } from "./skills-dictionary";

export interface JobFitInput {
  job: { id: string; title: string; companyName: string; descriptionText: string };
  facts: { id: string; kind: string; text: string; confirmed: boolean }[];
  /** Rendered plain text of the user's resume; may be empty. */
  resumeText: string;
  preferences: { roles: string[]; seniority: Seniority[] } | null;
}

export type JobRequirement = JobFit["requirements"][number];
type Requirement = Omit<JobRequirement, "status" | "factIds">;

const MAX_REQUIREMENTS = 15;
const WEIGHTS = { requirements: 40, keywords: 30, title: 20, seniority: 10 } as const;

const STOPWORDS = new Set(
  "the and for with you your our are will have has this that from into able all any can its not but who what when work working team experience years year strong good excellent ability including etc using use able must should also well such than then they their them more most other like per via".split(" "),
);

const REQUIRED_HEADING = /^(?:minimum |basic |required )?(?:requirements?|qualifications?|skills?(?: and| &) experience|required skills|what you(?:'|’)?ll need|what you need|what we(?:'|’)?re looking for|must[- ]haves?|you have|you(?:'|’)?ll have|about you|who you are|what you bring|your background)\b/i;
const NICE_HEADING = /^(?:nice[- ]to[- ]haves?|preferred(?: qualifications| skills)?|bonus(?: points)?|(?:it(?:'|’)?s )?a plus|pluses|extra credit)\b/i;
const OTHER_HEADING = /^(?:responsibilities|what you(?:'|’)?ll do|what you will do|the role|about the role|about us|about [a-z0-9 ]{1,30}|benefits|perks|compensation|salary|who we are|why join.*|our (?:team|mission|culture)|how to apply|equal opportunity.*)\b/i;
const BULLET = /^\s*(?:[-*•·–—]|\d+[.)])\s+/;
const FALLBACK = /experience (?:with|in)|proficien|knowledge of|\b\d+\s*\+?\s*years?\b/i;

function clean(line: string): string {
  return line.replace(BULLET, "").replace(/\s+/g, " ").trim().slice(0, 200);
}

/** A heading is a short non-bullet line that ends in ":" or matches a known heading phrase. */
function headingKind(line: string): "required" | "nice" | "other" | null {
  const t = line.replace(/^[#*_\s]+|[*_\s:]+$/g, "");
  if (!t || t.length > 60 || BULLET.test(line)) return null;
  const colon = /:\s*$/.test(line.trim());
  if (NICE_HEADING.test(t) && (colon || t.length <= 30)) return "nice";
  if (REQUIRED_HEADING.test(t) && (colon || t.length <= 40)) return "required";
  if (OTHER_HEADING.test(t) && (colon || t.length <= 40)) return "other";
  return colon ? "other" : null;
}

/**
 * Requirement lines from a posting, deterministic. Items under requirement-style headings are required, items under
 * nice-to-have headings are not; with no such heading, falls back to "experience with / proficient / N+ years" lines.
 * Required items come first, capped at 15, ids req-1.. in that order.
 */
export function extractRequirements(descriptionText: string): Requirement[] {
  const found: { text: string; required: boolean }[] = [];
  let mode: "required" | "nice" | null = null;
  for (const raw of descriptionText.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const kind = headingKind(raw);
    if (kind) {
      mode = kind === "other" ? null : kind;
      continue;
    }
    if (!mode) continue;
    const text = clean(raw);
    if (text.length >= 4) found.push({ text, required: mode === "required" });
  }
  if (found.length === 0) {
    for (const raw of descriptionText.split(/\r?\n/)) {
      const text = clean(raw);
      if (text.length >= 4 && FALLBACK.test(text)) found.push({ text, required: true });
    }
  }
  const ordered = [...found.filter((f) => f.required), ...found.filter((f) => !f.required)].slice(0, MAX_REQUIREMENTS);
  return ordered.map((f, i) => ({ id: `req-${i + 1}`, text: f.text, required: f.required }));
}

function significantWords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? [];
  return [...new Set(words.map((w) => w.replace(/^\.+|\.+$/g, "")).filter((w) => w.length >= 3 && !STOPWORDS.has(w)))];
}

const SENIORITY_ORDER: Seniority[] = ["intern", "entry", "mid", "senior", "lead"];

/** The seniority marker in a title, or null when there is none (an unmarked title cannot be judged). */
function titleSeniority(title: string): Seniority | null {
  const t = title.toLowerCase();
  if (/\b(intern|internship|co-?op)\b/.test(t)) return "intern";
  if (/\b(junior|jr\.?|entry[- ]level|entry|new grad|graduate)\b/.test(t)) return "entry";
  if (/\b(staff|principal|lead|head of|director|vp)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?)\b/.test(t)) return "senior";
  if (/\b(mid[- ]level|intermediate)\b/.test(t)) return "mid";
  return null;
}

const SENIORITY_WORDS = new Set(["senior", "junior", "staff", "principal", "lead", "intern", "internship", "entry", "level", "mid", "head", "associate"]);

interface Category {
  name: string;
  max: number;
  /** null means the category could not be evaluated and leaves the denominator. */
  points: number | null;
  reason: string | null;
  excluded: string;
}

/**
 * Deterministic job-match score (F1): no LLM, no I/O. Four weighted categories: Requirements Coverage 40, Keyword Match 30,
 * Job Title Match 20, Seniority Fit 10. Weights live here and ship in the response.
 *
 * THE RULE: a category that cannot be evaluated (no requirements, no keywords, no roles or role facts, no seniority
 * marker in the title) leaves the denominator and never scores zero. It is reported with `points: 0` and a `reason`;
 * evaluated categories carry `reason: null`. score = round(points of evaluated / max of evaluated * 100), 0 if none.
 *
 * Truth rule: only confirmed facts count toward points. Unconfirmed facts surface as `unconfirmed` requirements so the
 * user can confirm them, but never raise the score.
 */
export function computeJobFit(input: JobFitInput): JobFit {
  const { job, facts, resumeText, preferences } = input;
  const confirmed = facts.filter((f) => f.confirmed);
  const unconfirmed = facts.filter((f) => !f.confirmed);
  const skillsOf = new Map(facts.map((f) => [f.id, findSkills(f.text)]));

  const requirements: JobRequirement[] = extractRequirements(job.descriptionText).map((r) => {
    const skills = findSkills(r.text);
    const words = significantWords(r.text);
    const matches = (f: JobFitInput["facts"][number]) => {
      if (skills.some((s) => skillsOf.get(f.id)!.includes(s))) return true;
      if (words.length === 0) return false;
      const factWords = new Set(significantWords(f.text));
      return words.filter((w) => factWords.has(w)).length / words.length >= 0.5;
    };
    const hit = confirmed.filter(matches);
    if (hit.length) return { ...r, status: "covered", factIds: hit.map((f) => f.id) };
    const soft = unconfirmed.filter(matches);
    if (soft.length) return { ...r, status: "unconfirmed", factIds: soft.map((f) => f.id) };
    return { ...r, status: "missing", factIds: [] };
  });

  const resumeSkills = new Set(findSkills(resumeText));
  const keywords: JobFit["keywords"] = findSkills(job.descriptionText).map((term) => {
    const factIds = confirmed.filter((f) => skillsOf.get(f.id)!.includes(term)).map((f) => f.id);
    const status = resumeSkills.has(term) ? "in_resume" : factIds.length ? "has_fact" : "no_fact";
    return { term, status, factIds };
  });

  const categories: Category[] = [];

  // Requirements Coverage
  const required = requirements.filter((r) => r.required);
  const pool = required.length ? required : requirements;
  const covered = pool.filter((r) => r.status === "covered").length;
  categories.push({
    name: "Requirements Coverage",
    max: WEIGHTS.requirements,
    points: pool.length ? (covered / pool.length) * WEIGHTS.requirements : null,
    reason: null,
    excluded: "The posting lists no requirements we could read.",
  });

  // Keyword Match
  const kwHit = keywords.filter((k) => k.status !== "no_fact").length;
  categories.push({
    name: "Keyword Match",
    max: WEIGHTS.keywords,
    points: keywords.length ? (kwHit / keywords.length) * WEIGHTS.keywords : null,
    reason: null,
    excluded: "No known skills were found in the posting.",
  });

  // Job Title Match: a preferred role matching the title is full credit; a confirmed role fact alone is half.
  // ponytail: half credit for role-fact-only is a judgment call; tune with real data.
  const roles = (preferences?.roles ?? []).filter((r) => r.trim());
  const roleFacts = confirmed.filter((f) => f.kind === "role");
  const titleWords = significantWords(job.title);
  const coreTitle = titleWords.filter((w) => !SENIORITY_WORDS.has(w));
  const roleMatch = roles.some((role) => {
    const rw = significantWords(role);
    return rw.length > 0 && rw.every((w) => titleWords.includes(w));
  });
  const factMatch =
    coreTitle.length > 0 && roleFacts.some((f) => {
      const fw = new Set(significantWords(f.text));
      return coreTitle.every((w) => fw.has(w));
    });
  categories.push({
    name: "Job Title Match",
    max: WEIGHTS.title,
    points: roles.length || roleFacts.length ? (roleMatch ? WEIGHTS.title : factMatch ? WEIGHTS.title / 2 : 0) : null,
    reason: null,
    excluded: "You have no target roles or confirmed role facts to compare the title with.",
  });

  // Seniority Fit: exact level is full credit, one level away is half.
  const marker = titleSeniority(job.title);
  const wanted = preferences?.seniority ?? [];
  let senPoints: number | null = null;
  if (marker && wanted.length) {
    const gap = Math.min(...wanted.map((w) => Math.abs(SENIORITY_ORDER.indexOf(w) - SENIORITY_ORDER.indexOf(marker))));
    senPoints = gap === 0 ? WEIGHTS.seniority : gap === 1 ? WEIGHTS.seniority / 2 : 0;
  }
  categories.push({
    name: "Seniority Fit",
    max: WEIGHTS.seniority,
    points: senPoints,
    reason: null,
    excluded: !wanted.length ? "You have not set a seniority preference." : "The title has no seniority marker.",
  });

  const evaluated = categories.filter((c) => c.points !== null);
  const earned = evaluated.reduce((s, c) => s + (c.points ?? 0), 0);
  const possible = evaluated.reduce((s, c) => s + c.max, 0);
  const score = possible ? Math.round((earned / possible) * 100) : 0;
  const band: JobFit["band"] = score >= 75 ? "great" : score >= 50 ? "fair" : "poor";

  const parts: string[] = [];
  if (categories[0]!.points !== null) parts.push(`${covered} of ${pool.length} ${required.length ? "" : "nice-to-have "}requirements are covered by confirmed facts`);
  if (categories[1]!.points !== null) parts.push(`${kwHit} of ${keywords.length} keywords are in your resume or confirmed facts`);
  const basis = evaluated.length
    ? `Based on ${evaluated.length} of ${categories.length} checks: ${parts.length ? parts.join("; ") : "title and seniority only"}.`
    : "No checks could be evaluated, so there is no score.";

  return {
    jobId: job.id,
    title: job.title,
    company: job.companyName,
    score,
    basis,
    band,
    categories: categories.map((c) => ({
      name: c.name,
      points: c.points === null ? 0 : Math.round(c.points * 10) / 10,
      max: c.max,
      reason: c.points === null ? c.excluded : null,
    })),
    requirements,
    keywords,
  };
}
