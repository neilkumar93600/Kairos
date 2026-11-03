// Resume suite (R1 to R4) routes and sample data for the QA mock. Contract: shared/src/schemas-suite.ts, PRD
// docs/superpowers/specs/2026-10-29-resume-suite/README.md section 11. Synthetic data only.
//
// Unlike the legacy routes in mock-api.mjs these ARE stateful inside one fixtures() object, so the web can drive a
// whole flow (import, confirm, build, tailor, drag a card). The mock also enforces the rules the real server must:
// the truth lock (every line cites a confirmed fact), read-only sent snapshots, the 10 base resume limit, tracker
// stages owned by the pipeline, per-feature daily allowances (429 daily_allowance, never 402) and the insights gate.
//
// Mock-only conventions (the real routes ignore them):
//   GET  /resumes/:id/export?simulate=503      the renderer is down (the web falls back to browser print)
//   POST /profile/imports (file name has "scan" / "huge" / ends in .rtf)  422 no_text_layer / 413 / 415
//   POST /__mock/pipeline { itemId, event }    plays a server-side event so the automatic stage moves can be seen

const DAY = 86_400_000;
const STAGE_ORDER = ["saved", "drafting", "applied", "interviewing", "offer", "closed"];
const NOW = () => Date.now();

/* ---- templates (PRD 7.1). Every accent reaches 4.5:1 on white; the invariants test checks it. ---- */

const SWATCHES = ["#1F4E79", "#8B1E3F", "#1B6B3A", "#5B3A8C", "#8A4300", "#0F5C6B", "#3B3B98", "#7A1F1F"];
export const TEMPLATES = [
  { id: "kairos-single-v1", name: "Classic", atsSafe: true, accents: SWATCHES },
  { id: "modern", name: "Modern", atsSafe: true, accents: SWATCHES },
  { id: "serif", name: "Serif", atsSafe: true, accents: SWATCHES },
  { id: "compact", name: "Compact", atsSafe: true, accents: SWATCHES },
  { id: "executive", name: "Executive", atsSafe: true, accents: SWATCHES },
  { id: "minimal", name: "Minimal", atsSafe: true, accents: [] },
];

/* ---- small helpers, exported where a test pins them ---- */

/** `{Name} - {role} - Resume.{ext}`, ASCII-safe (PRD 7.3). */
export function asciiFileName(name, role, ext) {
  const clean = (s) => s.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  return [clean(name), clean(role), "Resume"].filter(Boolean).join(" - ") + `.${ext}`;
}

/** Best base for a job (PRD 6.2): case-insensitive token overlap of target roles with the title, ties to the most recent; else the default. */
export function bestBaseFor(bases, jobTitle) {
  const tokens = (s) => new Set(s.toLowerCase().split(/[^a-z0-9+#]+/).filter((t) => t.length > 1));
  const want = tokens(jobTitle);
  let best = null;
  let bestScore = 0;
  for (const b of bases) {
    const have = new Set(b.targetRoles.flatMap((r) => [...tokens(r)]));
    const score = [...want].filter((t) => have.has(t)).length;
    if (score > bestScore || (score > 0 && score === bestScore && best && b.updatedAt > best.updatedAt)) { best = b; bestScore = score; }
  }
  return best ?? bases.find((b) => b.isDefault) ?? bases[0];
}

/** Years of experience computed in code from confirmed role dates (truth rule 10); a model never states it. */
export function yearsOfExperience(facts, year = new Date().getFullYear()) {
  const roles = facts.filter((f) => f.confirmed && f.kind === "role");
  const spans = roles.map((f) => f.text.match(/(\d{4}) to (present|\d{4})/i)).filter(Boolean);
  if (!spans.length) return null;
  const start = Math.min(...spans.map((m) => Number(m[1])));
  const end = Math.max(...spans.map((m) => (m[2].toLowerCase() === "present" ? year : Number(m[2]))));
  return { value: Math.max(0, end - start), factIds: roles.map((f) => f.id) };
}

/** An .ics for one interview (RFC 5545: CRLF lines, UTC times, escaped text). */
export function icsFor(interview, title, company) {
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const end = new Date(new Date(interview.startsAt).getTime() + interview.durationMinutes * 60_000).toISOString();
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kairos//Interviews//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${interview.id}@kairos.example`, `DTSTAMP:${stamp(new Date(NOW()).toISOString())}`,
    `DTSTART:${stamp(interview.startsAt)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Interview: ${title} at ${company}`)}`,
    ...(interview.location ? [`LOCATION:${esc(interview.location)}`] : []),
    ...(interview.notes ? [`DESCRIPTION:${esc(interview.notes)}`] : []),
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

/** Lines that break the truth lock: no fact, an unknown fact or an unconfirmed fact. Same ids the real 422 returns. */
export function truthLockViolations(doc, facts) {
  const ok = new Set(facts.filter((f) => f.confirmed).map((f) => f.id));
  const bad = [];
  for (const s of doc.sections ?? []) for (const e of s.entries ?? []) for (const l of e.lines ?? []) {
    if (!l.factIds?.length || l.factIds.some((id) => !ok.has(id))) bad.push(l.id);
  }
  if (doc.headline && (!doc.headline.factIds?.length || doc.headline.factIds.some((id) => !ok.has(id)))) bad.push("headline");
  return bad;
}

const lines = (doc) => (doc.sections ?? []).flatMap((s) => (s.entries ?? []).flatMap((e) => e.lines));
/** Deterministic stand-in for the Resume check score. */
const checkScoreOf = (doc) => Math.min(100, 30 + lines(doc).length * 12 + (doc.headline ? 6 : 0));

function plainText(doc) {
  const out = [doc.name, doc.headline?.text, [doc.contact.email, doc.contact.phone, doc.contact.location].filter(Boolean).join(" | ")].filter(Boolean);
  for (const s of doc.sections) {
    if (s.hidden) continue;
    out.push("", s.title.toUpperCase());
    for (const e of s.entries) {
      if (e.hidden) continue;
      const head = [e.heading, e.subheading, e.meta].filter(Boolean).join(", ");
      if (head) out.push(head);
      for (const l of e.lines) out.push(s.kind === "summary" || s.kind === "skills" ? l.text : `- ${l.text}`);
    }
  }
  return out.join("\n") + "\n";
}

/* ---- fixtures ---- */

const STUB_JD = "We are hiring to own services that process customer events.\n\nRequirements:\n- 3+ years with TypeScript or Node.js\n- PostgreSQL schema design\n- Experience operating high-volume queues\n\nNice to have: Kubernetes, mentoring.";

/** Build the suite state next to fixtures(scenario). `b` carries what the legacy fixtures already define. */
export function buildSuite(b) {
  const { scenario, ago, facts, resume, applications, details, matches, inbox, jobFor, companyFor } = b;
  const full = scenario !== "empty";
  const jobs = {};
  for (let n = 1; n <= 13; n++) jobs[`job-${n}`] = { ...jobFor(n), company: companyFor(n).name };

  const meta = (over) => ({
    kind: "base", libraryName: "Backend", isDefault: false, targetRoles: [], baseResumeId: null, baseName: null, baseChanged: false,
    jobId: null, applicationId: null, readOnly: false, templateId: "kairos-single-v1", accent: null, pageSize: "letter", level: "mid", headline: null, ...over,
  });
  const profile = { id: "rp-1", name: "Main profile" };
  const resumes = [];
  const revisions = {};
  const addResume = (r, revs = []) => { resumes.push(r); revisions[r.id] = revs; return r; };
  const rev = (id, name, reason, d, document) => ({ id, name, reason, createdAt: ago(d), document });

  if (!full) {
    addResume({ ...structuredClone(resume), ...meta({ libraryName: "My resume", isDefault: true, level: "early_career" }), resumeProfileId: profile.id });
  } else {
    const backend = addResume({ ...structuredClone(resume), ...meta({ libraryName: "Backend", isDefault: true, targetRoles: ["Software Engineer", "Backend Engineer"], headline: { text: "Backend engineer · TypeScript, PostgreSQL", factIds: ["f1", "f5"] } }), resumeProfileId: profile.id },
      [rev("rev-b1", null, "edit", 2, null), rev("rev-b2", "Before rewrite for Company 102", "named", 6, null)]);
    for (const r of revisions[backend.id]) r.document = structuredClone(resume);
    const dataRes = structuredClone(resume);
    dataRes.sections = dataRes.sections.filter((s) => s.kind !== "summary");
    addResume({ ...dataRes, id: "resume-3", updatedAt: ago(5), ...meta({ libraryName: "Data engineer", targetRoles: ["Data Engineer"], pageSize: "letter" }), resumeProfileId: profile.id }, [rev("rev-d1", null, "edit", 5, dataRes)]);
    // Tailored copies: drafts for apps 1 to 3 are editable, the sent ones (4, 5) are frozen snapshots.
    for (const n of [1, 2, 3, 4, 5]) {
      const sent = n >= 4;
      const j = jobs[`job-${n}`];
      const doc = structuredClone(resume);
      addResume({ ...doc, id: `resume-t${n}`, updatedAt: ago(n), ...meta({ kind: "tailored", libraryName: `${j.title} at ${j.company}`, targetRoles: [], baseResumeId: "resume-1", baseName: "Backend", baseChanged: n === 2, jobId: j.id, applicationId: `app-${n}`, readOnly: sent }), resumeProfileId: profile.id },
        [rev(`rev-t${n}`, `Before tailoring for ${j.company}`, "before_tailor", n + 0.2, doc)]);
    }
  }

  /* tracker */
  const items = [];
  const events = {};
  const ev = (itemId, kind, source, payload, d) => { (events[itemId] ??= []).push({ id: `ev-${itemId}-${(events[itemId]?.length ?? 0) + 1}`, trackerItemId: itemId, kind, source, payload, at: ago(d) }); };
  const resumeFor = (appId, jobId) => resumes.find((r) => r.kind === "tailored" && (r.applicationId === appId || r.jobId === jobId));
  const itemBase = (id, over) => ({
    id, stage: "saved", stageSetBy: "system", closedReason: null, position: "", title: "", company: "", location: null, url: null, jobId: null, applicationId: null,
    applicationStatus: null, trackingOnly: false, matchScore: null, resumeId: null, resumeName: null, sendFailedRefunded: false, lastActivityAt: ago(1), nextInterviewAt: null,
    salaryText: null, archivedAt: null, createdAt: ago(10), notes: "", descriptionText: STUB_JD, contactIds: [], ...over,
  });
  const replyByApp = Object.fromEntries(inbox.filter((e) => e.applicationId).map((e) => [e.applicationId, e]));
  for (const [i, a] of applications.entries()) {
    const n = i + 1;
    const j = jobs[a.job.id];
    const reply = replyByApp[a.id];
    let stage = a.status === "submitted" ? "applied" : "drafting";
    let closedReason = null;
    if (reply?.kind === "interview" || reply?.kind === "assessment") stage = "interviewing";
    if (reply?.kind === "rejection") { stage = "closed"; closedReason = "rejected"; }
    const r = resumeFor(a.id, a.job.id);
    const it = itemBase(`ti-${n}`, {
      stage, closedReason, title: j.title, company: j.company, location: j.location, url: j.applyUrl, jobId: j.id, applicationId: a.id, applicationStatus: a.status,
      matchScore: 70 + ((n * 7) % 25), resumeId: r?.id ?? null, resumeName: r?.libraryName ?? null, sendFailedRefunded: a.status === "failed",
      lastActivityAt: a.submittedAt ?? ago(0.5 * n), createdAt: ago(10 - n * 0.5),
    });
    items.push(it);
    ev(it.id, "saved", "system", {}, 11 - n * 0.5);
    ev(it.id, "drafted", "system", {}, 10.5 - n * 0.5);
    if (r) ev(it.id, "resume_linked", "system", { resumeId: r.id, resumeName: r.libraryName }, 10.4 - n * 0.5);
    if (a.status !== "draft") ev(it.id, "approved", "system", { channel: a.channel }, (n % 5) + 1.2);
    if (a.status === "submitted") ev(it.id, "submitted", "system", { applicationId: a.id }, (n % 5) + 1);
    if (a.status === "failed") { ev(it.id, "failed", "system", { reason: a.failureReason }, 3); ev(it.id, "refunded", "system", {}, 3); }
    if (reply && reply.kind !== null) ev(it.id, "reply_routed", "system", { emailId: reply.id, replyKind: reply.kind, sender: reply.sender }, (n % 4) + 0.2);
    void details;
  }
  // Saved matches and one job the user tracks by hand (never sent by Kairos).
  matches.slice(0, 2).forEach((m, i) => {
    const it = itemBase(`ti-s${i + 1}`, { title: m.job.title, company: m.company.name, location: m.job.location, url: m.job.applyUrl, jobId: m.job.id, matchScore: m.score, lastActivityAt: ago(0.3 * (i + 1)), createdAt: ago(0.3 * (i + 1)) });
    items.push(it);
    ev(it.id, "saved", "user", {}, 0.3 * (i + 1));
  });
  if (full) {
    const it = itemBase("ti-m1", { stage: "applied", stageSetBy: "user", title: "Platform Engineer", company: "Company 314", location: "Remote, US", url: "https://careers.example.com/platform-engineer", trackingOnly: true, lastActivityAt: ago(4), createdAt: ago(5), salaryText: "$150k to $175k" , descriptionText: null });
    items.push(it);
    ev(it.id, "saved", "user", {}, 5);
    ev(it.id, "stage_changed", "user", { from: "saved", to: "applied", closedReason: null }, 4);
  }
  const cols = {};
  for (const it of items) { cols[it.stage] = (cols[it.stage] ?? 0) + 1; it.position = String(cols[it.stage]).padStart(4, "0"); }

  /* contacts and interviews */
  const t4 = items.find((i) => i.applicationId === "app-4");
  const contacts = full
    ? [
        { id: "ct-1", name: "Riley Recruiter", title: "Technical recruiter", company: "Company 104", email: "riley.recruiter@example.com", phone: null, linkedinUrl: null, notes: "Prefers mornings.", jobIds: [t4.id], createdAt: ago(3), updatedAt: ago(3) },
        { id: "ct-2", name: "Morgan Manager", title: "Engineering manager", company: "Company 104", email: null, phone: "555-0123", linkedinUrl: "https://linkedin.example.com/in/morgan-manager", notes: "", jobIds: [t4.id], createdAt: ago(2), updatedAt: ago(2) },
        { id: "ct-3", name: "Casey Contact", title: "Former colleague", company: "Company 200", email: "casey.contact@example.com", phone: null, linkedinUrl: null, notes: "Can refer.", jobIds: [], createdAt: ago(8), updatedAt: ago(8) },
      ]
    : [];
  if (full) t4.contactIds = ["ct-1", "ct-2"];
  const interviews = full
    ? [
        { id: "iv-1", trackerItemId: t4.id, startsAt: new Date(NOW() + 3 * DAY).toISOString(), timeZone: "America/New_York", durationMinutes: 30, kind: "video", location: "https://meet.example.com/abc-defg", contactIds: ["ct-1"], notes: "Intro call.", outcome: null, createdAt: ago(0.3) },
        { id: "iv-0", trackerItemId: t4.id, startsAt: new Date(NOW() - 2 * DAY).toISOString(), timeZone: "America/New_York", durationMinutes: 20, kind: "phone", location: null, contactIds: [], notes: "", outcome: "Moved to the next round", createdAt: ago(5) },
      ]
    : [];
  if (full) { t4.nextInterviewAt = interviews[0].startsAt; ev(t4.id, "interview_added", "user", { interviewId: "iv-1" }, 0.3); }

  /* insights are static sample numbers; the schema's own refinements check they are consistent */
  const insights = {
    "30d": { range: "30d", sent: 3, replies: 1, interviews: 1, offers: 0, replyRate: null, interviewRate: null, medianDaysToFirstReply: 2, lowSample: true, funnel: stageCounts(items), byResume: [{ resumeId: "resume-1", name: "Backend", sent: 3, replies: 1, replyRate: null }] },
    "90d": { range: "90d", sent: 12, replies: 5, interviews: 2, offers: 0, replyRate: 5 / 12, interviewRate: 2 / 12, medianDaysToFirstReply: 3, lowSample: false, funnel: stageCounts(items), byResume: [{ resumeId: "resume-1", name: "Backend", sent: 8, replies: 4, replyRate: 0.5 }, { resumeId: "resume-3", name: "Data engineer", sent: 4, replies: 1, replyRate: null }] },
    all: { range: "all", sent: 21, replies: 8, interviews: 4, offers: 1, replyRate: 8 / 21, interviewRate: 4 / 21, medianDaysToFirstReply: 4, lowSample: false, funnel: stageCounts(items), byResume: [{ resumeId: "resume-1", name: "Backend", sent: 15, replies: 7, replyRate: 7 / 15 }, { resumeId: "resume-3", name: "Data engineer", sent: 6, replies: 1, replyRate: 1 / 6 }] },
  };

  return { seq: 100, profile, jobs, resumes, revisions, imports: {}, items, events, contacts, interviews, insights, allowance: {}, fitFor: b.fitFor };
}

const stageCounts = (items) => STAGE_ORDER.map((stage) => ({ stage, count: items.filter((i) => i.stage === stage && !i.archivedAt).length }));

/* ---- request handling ---- */

const json = (body, status = 200, headers) => ({ status, json: body, headers });
const err = (status, code, message, details, headers) => json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status, headers);
const notFound = (what) => err(404, "not_found", `${what} not found`);
const invalid = (message) => err(422, "invalid_body", message);

const summaryOf = (s, r) => {
  const it = s.items.find((i) => i.applicationId && i.applicationId === r.applicationId) ?? s.items.find((i) => r.jobId && i.jobId === r.jobId);
  const j = r.jobId ? s.jobs[r.jobId] : null;
  return {
    id: r.id, name: r.libraryName, kind: r.kind, isDefault: r.isDefault, targetRoles: r.targetRoles, resumeProfileId: r.resumeProfileId, resumeProfileName: null,
    baseResumeId: r.baseResumeId, baseName: r.baseName, jobId: r.jobId, jobTitle: j?.title ?? null, company: j?.company ?? null, stage: it?.stage ?? null,
    matchScore: it?.matchScore ?? null, checkScore: checkScoreOf(r), templateId: r.templateId, readOnly: r.readOnly, updatedAt: r.updatedAt,
  };
};
/** The /resumes detail shape: the stored doc without the private resumeProfileId. */
const detailOf = ({ resumeProfileId, ...r }) => { void resumeProfileId; return structuredClone(r); };
const itemSummary = ({ notes, descriptionText, contactIds, ...i }) => { void notes; void descriptionText; void contactIds; return i; };

function nextId(s, prefix) { return `${prefix}-${++s.seq}`; }

function saveRevision(s, r, reason, name = null) {
  const { id, updatedAt, resumeProfileId, kind, libraryName, isDefault, targetRoles, baseResumeId, baseName, baseChanged, jobId, applicationId, readOnly, ...document } = r;
  void [id, updatedAt, resumeProfileId, kind, libraryName, isDefault, targetRoles, baseResumeId, baseName, baseChanged, jobId, applicationId, readOnly];
  const list = (s.revisions[r.id] ??= []);
  const rv = { id: nextId(s, "rev"), name, reason, createdAt: new Date(NOW()).toISOString(), document: structuredClone(document) };
  list.unshift(rv);
  // PRD 6.1 [call]: the 50 newest unnamed revisions and every named one are kept.
  let unnamed = 0;
  s.revisions[r.id] = list.filter((x) => x.name || ++unnamed <= 50);
  return rv;
}
const revisionSummary = ({ document, ...rv }) => { void document; return rv; };

/** Pull the editable document fields out of a PUT body (the contract is ResumeInput). */
const DOC_KEYS = ["name", "density", "contact", "sections", "templateId", "accent", "pageSize", "level", "headline"];

function allowance(data, feature, units = 1) {
  const limit = data.me.plan.aiDailyAllowance[feature] ?? 0;
  if (limit === 0) return { fail: err(403, "forbidden", "Your plan does not include this feature") };
  const s = data.suite;
  const used = s.allowance[feature] ?? 0;
  const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
  if (used + units > limit) return { fail: err(429, "rate_limited", "You have used today's allowance. It resets at 00:00 UTC.", { reason: "daily_allowance", feature, limit, used, resetsAt: tomorrow.toISOString() }) };
  s.allowance[feature] = used + units;
  return { headers: { "Kairos-Allowance": `feature=${feature};used=${used + units};limit=${limit};resets=${tomorrow.toISOString()}` } };
}

const SKILLS = (facts) => (facts.find((f) => f.confirmed && f.kind === "skill")?.text ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/** Suggestions for the R3 review. They cite confirmed facts only (or ask for one); a derived number is computed here. */
function suggest(data, doc, body, factCreated) {
  const confirmed = data.facts.filter((f) => f.confirmed);
  const level = body.level ?? doc.level ?? "mid";
  if (body.scope === "headline") {
    const role = confirmed.find((f) => f.kind === "role");
    if (!role) {
      return [{ id: "sg-h0", sectionId: "headline", entryId: null, lineId: null, action: "add", before: null, after: null, why: "A headline needs a role to name.", factIds: [], needsFact: { kind: "role", question: "What is your most recent job title?" }, tag: "show_scope", priority: "high" }];
    }
    const title = role.text.split(" at ")[0];
    const skills = SKILLS(data.facts);
    const skillFact = confirmed.find((f) => f.kind === "skill");
    const years = yearsOfExperience(data.facts);
    const base = { sectionId: "headline", entryId: null, lineId: null, action: doc.headline ? "rewrite" : "add", before: doc.headline?.text ?? null, needsFact: null, tag: "show_scope", priority: "medium" };
    const out = [];
    if (years) out.push({ ...base, id: "sg-h1", after: `${title} · ${skills.slice(0, 2).join(", ")} · ${years.value} years`, why: "Names your role, top skills and the years computed from your confirmed role dates.", factIds: [role.id, ...(skillFact ? [skillFact.id] : [])], derived: [{ label: "Years of experience", value: years.value, factIds: years.factIds }] });
    out.push({ ...base, id: "sg-h2", after: `${title} · ${skills.slice(0, 3).join(", ")}`, why: "Role and skills from your confirmed facts.", factIds: [role.id, ...(skillFact ? [skillFact.id] : [])] });
    out.push({ ...base, id: "sg-h3", after: title, why: "Your title alone, from your confirmed role.", factIds: [role.id], priority: "low" });
    return out.slice(0, 3);
  }
  const sec = doc.sections.find((s) => s.kind === "experience");
  const e = sec?.entries[0];
  const l = e?.lines[1] ?? e?.lines[0];
  if (!sec || !e || !l) {
    return [{ id: "sg-fact", sectionId: sec?.id ?? "s-exp", entryId: null, lineId: null, action: "add", before: null, after: null, why: "Your resume has no experience yet. Tell us about a role you held.", factIds: [], needsFact: { kind: "role", question: "What was your most recent job title and employer?" }, tag: "show_scope", priority: "high" }];
  }
  const jobTag = body.jobId ? "stay_relevant" : "lead_with_result";
  const out = [
    { id: "sg-1", sectionId: sec.id, entryId: e.id, lineId: l.id, action: "rewrite", before: l.text, after: "Built a webhook delivery service that handles about 2 million events per week.", why: "Leads with the result and keeps the number from your confirmed fact.", factIds: ["f4"], needsFact: null, tag: jobTag, priority: "high" },
    { id: "sg-2", sectionId: sec.id, entryId: e.id, lineId: null, action: "add", before: null, after: null, why: "The posting asks for mentoring. You have an unconfirmed note about it: confirm it in your profile and it can be used.", factIds: [], needsFact: { kind: "metric", question: "Did you mentor anyone? Add how many people and for how long, then confirm it." }, tag: "use_your_numbers", priority: "medium" },
    { id: "sg-3", sectionId: sec.id, entryId: e.id, lineId: l.id, action: "rewrite", before: l.text, after: "Cut p95 API latency from 480 ms to 190 ms with a read-through cache.", why: "Removes filler words; same fact, same numbers.", factIds: ["f3"], needsFact: null, tag: "remove_filler", priority: "low" },
  ];
  if (level === "lead" || level === "senior") out.splice(2, 0, { id: "sg-4", sectionId: sec.id, entryId: e.id, lineId: null, action: "add", before: null, after: null, why: "At this level reviewers look for scope and ownership. Add a fact about the size of the team or system you owned.", factIds: [], needsFact: { kind: "role", question: "How many engineers or services did you own or lead?" }, tag: "show_scope", priority: "high" });
  // The user's own note, restated: citable only for what it says, and it cannot be saved until the fact is confirmed.
  if (factCreated) out.unshift({ id: "sg-note", sectionId: sec.id, entryId: e.id, lineId: null, action: "add", before: null, after: factCreated.text, why: "Your note as a line. Confirm the fact in your profile before you save it.", factIds: [factCreated.id], needsFact: null, tag: "use_your_numbers", priority: "high" });
  return out;
}

function listBases(s, profileId) { return s.resumes.filter((r) => r.kind === "base" && r.resumeProfileId === profileId); }

function eventStage(s, it, to, closedReason, source = "system", kind = "stage_changed") {
  const from = it.stage;
  it.stage = to; it.closedReason = to === "closed" ? closedReason : null; it.stageSetBy = source;
  it.lastActivityAt = new Date(NOW()).toISOString();
  s.events[it.id] ??= [];
  s.events[it.id].push({ id: nextId(s, "ev"), trackerItemId: it.id, kind, source, payload: { from, to, closedReason: it.closedReason }, at: it.lastActivityAt });
}

/** PRD 9.1 automatic moves: forward only, and never over a later stage the user set. */
function pipelineEvent(s, it, event) {
  const forward = (to, reason = null) => { if (STAGE_ORDER.indexOf(to) > STAGE_ORDER.indexOf(it.stage)) eventStage(s, it, to, reason); };
  const log = (kind, payload = {}) => s.events[it.id].push({ id: nextId(s, "ev"), trackerItemId: it.id, kind, source: "system", payload, at: new Date(NOW()).toISOString() });
  s.events[it.id] ??= [];
  switch (event) {
    case "drafted": log("drafted"); forward("drafting"); break;
    case "submitted": log("submitted", { applicationId: it.applicationId }); it.applicationStatus = "submitted"; it.sendFailedRefunded = false; forward("applied"); break;
    case "failed": log("failed", { reason: "The form asked for a field Kairos could not fill." }); log("refunded"); it.applicationStatus = "failed"; it.sendFailedRefunded = true; break; // stays Drafting
    case "withdrawn": log("withdrawn"); it.applicationStatus = "withdrawn"; forward("closed", "withdrawn"); break;
    case "reply_interview": log("reply_routed", { replyKind: "interview" }); forward("interviewing"); break;
    case "reply_offer": log("reply_routed", { replyKind: "offer" }); forward("offer"); break;
    case "reply_rejection": log("reply_routed", { replyKind: "rejection" }); forward("closed", "rejected"); break;
    default: return false;
  }
  it.lastActivityAt = new Date(NOW()).toISOString();
  return true;
}

function importFacts(s, data, imp) {
  const dup = data.facts.find((f) => f.kind === "metric");
  const mk = (kind, text, employmentId) => ({ id: nextId(s, "if"), kind, text, sourceSpan: text, confirmed: false, assertedBy: "import", employmentId });
  imp.employments = [{ id: `${imp.id}-e1`, title: "Data Analyst", company: "Sample Analytics Co", dates: "2018 to 2020" }];
  imp.facts = [
    mk("role", "Data Analyst at Sample Analytics Co, 2018 to 2020", `${imp.id}-e1`),
    mk("metric", "Automated a weekly reporting pipeline that saved 6 hours a week", `${imp.id}-e1`),
    mk("project", "Built a churn dashboard used by the customer success team", `${imp.id}-e1`),
    mk("skill", "SQL, Python, dbt", null),
    mk("education", "B.A. Statistics, Sample State University, 2018", null),
  ];
  if (dup) imp.facts.push({ ...mk("metric", dup.text, null), id: dup.id, confirmed: dup.confirmed, assertedBy: "user" });
  imp.duplicates = dup ? [dup.id] : [];
  for (const f of imp.facts) if (!imp.duplicates.includes(f.id) && !data.facts.some((x) => x.id === f.id)) data.facts.push({ id: f.id, kind: f.kind, text: f.text, sourceSpan: f.sourceSpan, confirmed: false });
}

const KNOWN_BOARD = /boards\.example\.com/;

/**
 * Handle one request. `req`: { method, path (without /api), query (URLSearchParams), body, upload ({ fileName } for a
 * multipart file) }. Returns { status, json | file | none, headers } or null when the path is not a suite route.
 */
export function suiteRespond(req, data) {
  const { method, path: p, query, body = {} } = req;
  const s = data.suite;
  let x;
  const m = (re) => p.match(re);
  const resume = (id) => s.resumes.find((r) => r.id === id);
  const item = (id) => s.items.find((i) => i.id === id);

  /* mock-only: play a pipeline event on a tracker item */
  if (method === "POST" && p === "/__mock/pipeline") {
    const it = item(body.itemId);
    if (!it) return notFound("Tracker item");
    return pipelineEvent(s, it, body.event) ? json({ item: itemSummary(it) }) : invalid("Unknown event");
  }

  /* ---- templates ---- */
  if (method === "GET" && p === "/templates") return json({ templates: TEMPLATES });

  /* ---- resumes ---- */
  if (p === "/resumes" || p.startsWith("/resumes/")) {
    if (method === "GET" && p === "/resumes") {
      const kind = query.get("kind");
      return json({ resumes: s.resumes.filter((r) => !kind || r.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((r) => summaryOf(s, r)) });
    }
    if (method === "POST" && p === "/resumes") {
      if (!body.name || !["facts", "duplicate"].includes(body.from)) return invalid("Send from (facts or duplicate) and a name");
      const profileId = body.resumeProfileId ?? s.profile.id;
      if (listBases(s, profileId).length >= 10) return err(409, "limit_reached", "You can keep up to 10 base resumes per profile.");
      const now = new Date(NOW()).toISOString();
      let doc;
      let defaults = {};
      if (body.from === "duplicate") {
        const src = resume(body.sourceId);
        if (!src) return notFound("Resume");
        doc = structuredClone(src);
        defaults = { templateId: src.templateId, accent: src.accent, pageSize: src.pageSize, level: src.level };
      } else {
        const imp = body.importId ? s.imports[body.importId] : null;
        if (body.importId && !imp) return notFound("Import");
        const pool = (imp ? imp.facts : data.facts).filter((f) => f.confirmed);
        // The user's own wording is the line text; only confirmed facts can become lines (truth rules 1 and 7).
        const mkLine = (f, section) => ({ id: nextId(s, "l"), section, text: f.text, factIds: [f.id] });
        const sections = [];
        const roleFacts = pool.filter((f) => f.kind === "role");
        if (roleFacts.length) sections.push({ id: nextId(s, "s"), kind: "experience", title: "Experience", hidden: false, entries: roleFacts.map((f) => ({ id: nextId(s, "e"), heading: f.text.split(" at ")[0], subheading: f.text.split(" at ")[1]?.split(",")[0] ?? null, meta: f.text.match(/\d{4}.*$/)?.[0] ?? null, headingFactId: f.id, hidden: false, lines: pool.filter((g) => ["metric", "project"].includes(g.kind) && (imp ? g.employmentId === f.employmentId : f === roleFacts[0])).map((g) => mkLine(g, "experience")) })) });
        const skillFacts = pool.filter((f) => f.kind === "skill");
        if (skillFacts.length) sections.push({ id: nextId(s, "s"), kind: "skills", title: "Skills", hidden: false, entries: [{ id: nextId(s, "e"), heading: "", subheading: null, meta: null, headingFactId: null, hidden: false, lines: skillFacts.map((f) => mkLine(f, "skills")) }] });
        const eduFacts = pool.filter((f) => f.kind === "education");
        if (eduFacts.length) sections.push({ id: nextId(s, "s"), kind: "education", title: "Education", hidden: false, entries: eduFacts.map((f) => ({ id: nextId(s, "e"), heading: f.text, subheading: null, meta: null, headingFactId: f.id, hidden: false, lines: [] })) });
        doc = { name: data.resume.name, density: "comfortable", contact: structuredClone(data.resume.contact), sections };
      }
      const r = {
        ...doc, id: nextId(s, "resume"), updatedAt: now, kind: "base", libraryName: body.name, isDefault: false, targetRoles: body.targetRoles ?? [], baseResumeId: null, baseName: null,
        baseChanged: false, jobId: null, applicationId: null, readOnly: false, templateId: "kairos-single-v1", accent: null, pageSize: "letter", level: "mid", headline: null, ...defaults, resumeProfileId: profileId,
      };
      s.resumes.push(r); s.revisions[r.id] = []; saveRevision(s, r, "edit");
      return json({ resume: detailOf(r) }, 201);
    }
    if (method === "POST" && p === "/resumes/tailor") {
      const job = s.jobs[body.jobId];
      if (!job) return notFound("Job");
      const exists = s.resumes.find((r) => r.kind === "tailored" && r.jobId === job.id);
      if (exists) return err(409, "exists", "You already have a tailored resume for this job.", { resumeId: exists.id });
      const bases = listBases(s, s.profile.id);
      const base = body.baseResumeId ? bases.find((r) => r.id === body.baseResumeId) : bestBaseFor(bases, job.title);
      if (!base) return notFound("Base resume");
      const a = allowance(data, "jobTailor");
      if (a.fail) return a.fail;
      const app = data.applications.find((x) => x.job.id === job.id);
      const copy = {
        ...structuredClone(base), id: nextId(s, "resume"), updatedAt: new Date(NOW()).toISOString(), kind: "tailored", libraryName: `${job.title} at ${job.company}`, isDefault: false, targetRoles: [],
        baseResumeId: base.id, baseName: base.libraryName, baseChanged: false, jobId: job.id, applicationId: app?.id ?? null, readOnly: false,
      };
      s.resumes.push(copy); s.revisions[copy.id] = [];
      saveRevision(s, copy, "before_tailor", `Before tailoring for ${job.company}`);
      const it = s.items.find((i) => i.jobId === job.id);
      if (it) {
        it.resumeId = copy.id; it.resumeName = copy.libraryName;
        (s.events[it.id] ??= []).push({ id: nextId(s, "ev"), trackerItemId: it.id, kind: "resume_linked", source: "system", payload: { resumeId: copy.id, resumeName: copy.libraryName }, at: copy.updatedAt });
      }
      return json({ resume: detailOf(copy), suggestions: suggest(data, copy, { scope: "resume", jobId: job.id }, null), fit: { ...s.fitFor(job.id), title: job.title, company: job.company } }, 200, a.headers);
    }
    if (method === "POST" && p === "/resumes/suggestions") {
      const r = resume(body.resumeId);
      if (!r) return notFound("Resume");
      if (!["resume", "section", "entry", "line", "summary", "skills", "headline"].includes(body.scope)) return err(422, "invalid_scope", "Unknown scope");
      const a = allowance(data, "resumeSuggestions", body.scope === "resume" ? 4 : 1);
      if (a.fail) return a.fail;
      // A note is saved as an unconfirmed fact first; it can be cited only for what it says (spec 2.5).
      const factCreated = typeof body.note === "string" && body.note ? { id: nextId(s, "fn"), kind: "metric", text: body.note, sourceSpan: null, confirmed: false, assertedBy: "user" } : null;
      if (factCreated) data.facts.push({ id: factCreated.id, kind: factCreated.kind, text: factCreated.text, sourceSpan: null, confirmed: false });
      return json({ suggestions: suggest(data, r, body, factCreated), factCreated }, 200, a.headers);
    }
    if ((x = m(/^\/resumes\/([^/]+)$/))) {
      const r = resume(x[1]);
      if (!r) return notFound("Resume");
      if (method === "GET") return json({ resume: detailOf(r) });
      if (method === "PUT") {
        if (r.readOnly) return err(409, "read_only", "This resume was sent. Duplicate it to keep editing.");
        if (!body.name || !Array.isArray(body.sections) || !body.contact) return invalid("Send a ResumeInput");
        const bad = truthLockViolations(body, data.facts);
        if (bad.length) return err(422, "truth_lock", "Some lines cite facts that are not confirmed in your profile", { lineIds: bad });
        for (const k of DOC_KEYS) if (k in body) r[k] = structuredClone(body[k]);
        r.updatedAt = new Date(NOW()).toISOString();
        saveRevision(s, r, "edit");
        return json({ resume: detailOf(r) });
      }
      if (method === "PATCH") {
        if (r.readOnly) return err(409, "read_only", "This resume was sent. Duplicate it to keep editing.");
        if (body.name === undefined && body.targetRoles === undefined) return invalid("Send a name or target roles");
        if (body.name !== undefined) r.libraryName = String(body.name).trim();
        if (body.targetRoles !== undefined) r.targetRoles = body.targetRoles;
        r.updatedAt = new Date(NOW()).toISOString();
        return json({ resume: detailOf(r) });
      }
      if (method === "DELETE") {
        if (r.kind === "base") {
          if (r.isDefault) return err(409, "is_default", "Make another resume the default before deleting this one.");
          if (listBases(s, r.resumeProfileId).length <= 1) return err(409, "last_base", "You need at least one base resume.");
        }
        s.resumes.splice(s.resumes.indexOf(r), 1); delete s.revisions[r.id];
        for (const t of s.resumes) if (t.baseResumeId === r.id) t.baseResumeId = null; // set null on delete (PRD 6.1)
        for (const i of s.items) if (i.resumeId === r.id) { i.resumeId = null; i.resumeName = null; }
        return { status: 204 };
      }
    }
    if ((x = m(/^\/resumes\/([^/]+)\/default$/)) && method === "POST") {
      const r = resume(x[1]);
      if (!r) return notFound("Resume");
      if (r.kind !== "base") return err(409, "not_base", "Only a base resume can be the default.");
      for (const o of listBases(s, r.resumeProfileId)) o.isDefault = o === r;
      return json({ resume: detailOf(r) });
    }
    if ((x = m(/^\/resumes\/([^/]+)\/revisions$/))) {
      const r = resume(x[1]);
      if (!r) return notFound("Resume");
      if (method === "GET") return json({ revisions: (s.revisions[r.id] ?? []).map(revisionSummary) });
      if (method === "POST") {
        if (!body.name || !String(body.name).trim()) return invalid("Send a name");
        return json({ revision: revisionSummary(saveRevision(s, r, "named", String(body.name).trim())) }, 201);
      }
    }
    if ((x = m(/^\/resumes\/([^/]+)\/revisions\/([^/]+)$/)) && method === "GET") {
      const rv = (s.revisions[x[1]] ?? []).find((v) => v.id === x[2]);
      return rv && resume(x[1]) ? json({ revision: rv }) : notFound("Revision");
    }
    if ((x = m(/^\/resumes\/([^/]+)\/revisions\/([^/]+)\/restore$/)) && method === "POST") {
      const r = resume(x[1]);
      const rv = r && (s.revisions[r.id] ?? []).find((v) => v.id === x[2]);
      if (!rv) return notFound("Revision");
      if (r.readOnly) return err(409, "read_only", "This resume was sent. Duplicate it to keep editing.");
      saveRevision(s, r, "restore", `Before restoring ${rv.name ?? "an earlier version"}`); // never lose the current state
      for (const k of DOC_KEYS) if (k in rv.document) r[k] = structuredClone(rv.document[k]);
      r.updatedAt = new Date(NOW()).toISOString();
      return json({ resume: detailOf(r) });
    }
    if ((x = m(/^\/resumes\/([^/]+)\/export$/)) && method === "GET") {
      const r = resume(x[1]);
      if (!r) return notFound("Resume");
      const format = query.get("format");
      if (!["pdf", "docx", "txt"].includes(format)) return invalid("format must be pdf, docx or txt");
      if (query.get("simulate") === "503" && format !== "txt") return err(503, "service_unavailable", "The file renderer is busy. Try again, or use your browser's print.");
      const role = r.targetRoles[0] ?? (r.jobId ? s.jobs[r.jobId]?.title : "") ?? "";
      const filename = asciiFileName(r.name, role, format);
      const text = plainText(r);
      if (format === "txt") return { status: 200, file: { contentType: "text/plain; charset=utf-8", body: text, filename } };
      // Placeholder bytes: the mock does not render. The real route returns the rendered file after the round-trip check.
      return format === "pdf"
        ? { status: 200, file: { contentType: "application/pdf", body: `%PDF-1.4\n% mock render of ${r.templateId}\n${text}%%EOF\n`, filename } }
        : { status: 200, file: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: `PK mock docx ${r.templateId}\n${text}`, filename } };
    }
    return null;
  }

  /* ---- imports and fact confirmation ---- */
  if (method === "POST" && p === "/profile/imports") {
    const file = req.upload;
    if (file) {
      if (/huge/i.test(file.fileName)) return err(413, "payload_too_large", "Files can be up to 5 MB.");
      if (!/\.(pdf|docx)$/i.test(file.fileName)) return err(415, "unsupported_type", "Upload a PDF or DOCX, or paste the text.");
      if (/scan/i.test(file.fileName)) return err(422, "no_text_layer", "This PDF is a scanned image. Paste the text instead.");
    } else if (typeof body.text !== "string" || body.text.length < 200) return invalid("Paste at least 200 characters");
    const id = nextId(s, "imp");
    const sourceKind = file ? (/linkedin/i.test(file.fileName) ? "linkedin_pdf" : /\.docx$/i.test(file.fileName) ? "docx" : "pdf") : "text";
    s.imports[id] = { id, sourceKind, fileName: file?.fileName ?? null, polls: 0, employments: [], facts: [], duplicates: [] };
    return json({ importId: id, parseStatus: "pending" }, 202);
  }
  if (method === "GET" && (x = m(/^\/profile\/imports\/([^/]+)$/))) {
    const imp = s.imports[x[1]];
    if (!imp) return notFound("Import");
    // The first reads show progress in words; the third has the facts (a reload resumes the same state).
    const polls = imp.polls++;
    const base = { importId: imp.id, sourceKind: imp.sourceKind, fileName: imp.fileName, failureCode: null };
    if (polls === 0) return json({ ...base, parseStatus: "pending", progressText: "Reading your resume", employments: [], facts: [], duplicates: [], contact: null });
    if (polls === 1) return json({ ...base, parseStatus: "parsing", progressText: "Finding your roles", employments: [], facts: [], duplicates: [], contact: null });
    if (!imp.facts.length) importFacts(s, data, imp);
    return json({ ...base, parseStatus: "parsed", progressText: null, employments: imp.employments, facts: imp.facts, duplicates: imp.duplicates, contact: { name: "Sample Applicant", email: "sample.applicant@example.com", phone: "555-0100", location: "New York, NY", links: ["https://example.com/sample-applicant"] } });
  }
  if (method === "POST" && p === "/profile/facts/confirm") {
    if (!Array.isArray(body.ids) || !body.ids.length) return invalid("Send ids");
    const found = body.ids.map((id) => data.facts.find((f) => f.id === id));
    if (found.some((f) => !f)) return notFound("Fact");
    for (const f of found) f.confirmed = true;
    for (const imp of Object.values(s.imports)) for (const f of imp.facts) if (body.ids.includes(f.id)) f.confirmed = true;
    return json({ facts: found });
  }

  /* ---- tracker ---- */
  if (p === "/tracker" || p.startsWith("/tracker/")) {
    if (method === "GET" && p === "/tracker") {
      const stage = query.get("stage"), q = (query.get("q") ?? "").toLowerCase(), archived = query.get("archived") === "true";
      let list = s.items.filter((i) => (archived ? !!i.archivedAt : !i.archivedAt) && (!stage || i.stage === stage) && (!q || `${i.title} ${i.company}`.toLowerCase().includes(q)));
      list = query.get("view") === "table" ? list.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)) : list.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.position.localeCompare(b.position));
      return json({ items: list.map(itemSummary) });
    }
    if (method === "POST" && p === "/tracker") {
      let fields;
      if (body.matchId) {
        const mt = data.matches.find((mm) => mm.id === body.matchId);
        if (!mt) return notFound("Match");
        const dupe = s.items.find((i) => i.jobId === mt.job.id);
        if (dupe) return json({ item: structuredClone(dupe) }, 201); // idempotent
        fields = { title: mt.job.title, company: mt.company.name, location: mt.job.location, url: mt.job.applyUrl, jobId: mt.job.id, matchScore: mt.score };
      } else if (body.url) {
        if (!KNOWN_BOARD.test(body.url)) return err(422, "unsupported_board", "Kairos can import Greenhouse, Lever and Ashby postings. Add it by hand to track it.");
        const j = Object.values(s.jobs).find((jj) => jj.applyUrl === body.url) ?? s.jobs["job-12"];
        fields = { title: j.title, company: j.company, location: j.location, url: j.applyUrl, jobId: j.id };
      } else if (body.manual?.title && body.manual?.company) {
        fields = { title: body.manual.title, company: body.manual.company, location: body.manual.location ?? null, url: body.manual.url ?? null, trackingOnly: true, descriptionText: null };
      } else return invalid("Send matchId, url or manual");
      const now = new Date(NOW()).toISOString();
      const col = s.items.filter((i) => i.stage === "saved");
      const it = { id: nextId(s, "ti"), stage: "saved", stageSetBy: "system", closedReason: null, position: String(col.length + 1).padStart(4, "0"), location: null, url: null, jobId: null, applicationId: null, applicationStatus: null, trackingOnly: false, matchScore: null, resumeId: null, resumeName: null, sendFailedRefunded: false, lastActivityAt: now, nextInterviewAt: null, salaryText: null, archivedAt: null, createdAt: now, notes: "", descriptionText: STUB_JD, contactIds: [], ...fields };
      s.items.push(it);
      s.events[it.id] = [{ id: nextId(s, "ev"), trackerItemId: it.id, kind: "saved", source: "user", payload: {}, at: now }];
      return json({ item: structuredClone(it) }, 201);
    }
    if (method === "GET" && p === "/tracker/insights") {
      if (!data.me.plan.outcomeReport) return err(403, "forbidden", "Insights are on the Pro and Max plans.");
      const range = query.get("range") ?? "30d";
      if (!s.insights[range]) return invalid("range must be 30d, 90d or all");
      return json({ insights: { ...s.insights[range], funnel: stageCounts(s.items) } });
    }
    if ((x = m(/^\/tracker\/([^/]+)$/))) {
      const it = item(x[1]);
      if (!it) return notFound("Tracker item");
      if (method === "GET") return json({ item: structuredClone(it) });
      if (method === "PATCH") {
        if (!Object.keys(body).length) return invalid("Send at least one field");
        if (body.stage === "closed" && !body.closedReason) return invalid("Closing needs a reason");
        if (body.stage && body.stage !== it.stage) {
          const kairos = !!it.applicationId;
          if (kairos && (body.stage === "drafting" || body.stage === "applied")) return err(409, "stage_owned_by_pipeline", "Approve it in the Review queue to send it", { reason: "approve_in_review_queue" });
          if (!kairos && body.stage === "drafting") return err(409, "stage_owned_by_pipeline", "Drafting is set when Kairos drafts an application.", { reason: "pipeline_stage" });
          if (body.stage === "closed" && kairos && ["approved", "submitting"].includes(it.applicationStatus)) return err(409, "stage_owned_by_pipeline", "It's approved to send. Withdraw it in the Review queue first", { reason: "withdraw_first" });
          eventStage(s, it, body.stage, body.closedReason ?? null, "user");
        } else if (body.closedReason && it.stage === "closed") it.closedReason = body.closedReason;
        if (body.position !== undefined) it.position = body.position;
        if (body.salaryText !== undefined) it.salaryText = body.salaryText;
        if (body.archived !== undefined) it.archivedAt = body.archived ? new Date(NOW()).toISOString() : null;
        if (body.notes !== undefined && body.notes !== it.notes) {
          it.notes = body.notes;
          (s.events[it.id] ??= []).push({ id: nextId(s, "ev"), trackerItemId: it.id, kind: "note_added", source: "user", payload: {}, at: new Date(NOW()).toISOString() }); // never the text (rule 12)
        }
        return json({ item: structuredClone(it) });
      }
    }
    if ((x = m(/^\/tracker\/([^/]+)\/events$/)) && method === "GET") {
      const it = item(x[1]);
      return it ? json({ events: [...(s.events[it.id] ?? [])].sort((a, b) => b.at.localeCompare(a.at)) }) : notFound("Tracker item");
    }
    if ((x = m(/^\/tracker\/([^/]+)\/interviews$/)) && method === "POST") {
      const it = item(x[1]);
      if (!it) return notFound("Tracker item");
      if (!body.startsAt || !body.timeZone || !body.durationMinutes || !body.kind) return invalid("Send startsAt, timeZone, durationMinutes and kind");
      const iv = { id: nextId(s, "iv"), trackerItemId: it.id, startsAt: new Date(body.startsAt).toISOString(), timeZone: body.timeZone, durationMinutes: body.durationMinutes, kind: body.kind, location: body.location ?? null, contactIds: body.contactIds ?? [], notes: body.notes ?? "", outcome: body.outcome ?? null, createdAt: new Date(NOW()).toISOString() };
      s.interviews.push(iv);
      (s.events[it.id] ??= []).push({ id: nextId(s, "ev"), trackerItemId: it.id, kind: "interview_added", source: "user", payload: { interviewId: iv.id }, at: iv.createdAt });
      refreshNextInterview(s, it);
      return json({ interview: iv }, 201);
    }
    if ((x = m(/^\/tracker\/([^/]+)\/interviews\/([^/]+?)(\.ics)?$/))) {
      const it = item(x[1]);
      const iv = s.interviews.find((v) => v.id === x[2] && v.trackerItemId === x[1]);
      if (!it || !iv) return notFound("Interview");
      if (x[3] && method === "GET") return { status: 200, file: { contentType: "text/calendar; charset=utf-8", body: icsFor(iv, it.title, it.company), filename: `interview-${iv.id}.ics` } };
      if (method === "PATCH") { Object.assign(iv, ...["startsAt", "timeZone", "durationMinutes", "kind", "location", "contactIds", "notes", "outcome"].filter((k) => k in body).map((k) => ({ [k]: k === "startsAt" ? new Date(body[k]).toISOString() : body[k] }))); refreshNextInterview(s, it); return json({ interview: iv }); }
      if (method === "DELETE") { s.interviews.splice(s.interviews.indexOf(iv), 1); refreshNextInterview(s, it); return { status: 204 }; }
    }
    return null;
  }

  /* ---- contacts ---- */
  if (p === "/contacts" || p.startsWith("/contacts/")) {
    const linkable = (ids) => (ids ?? []).every((id) => item(id));
    const relink = (c) => { for (const i of s.items) i.contactIds = s.contacts.filter((k) => k.jobIds.includes(i.id)).map((k) => k.id); void c; };
    if (method === "GET" && p === "/contacts") {
      const q = (query.get("q") ?? "").toLowerCase(), jobId = query.get("jobId");
      return json({ contacts: s.contacts.filter((c) => (!q || `${c.name} ${c.company} ${c.title}`.toLowerCase().includes(q)) && (!jobId || c.jobIds.includes(jobId))) });
    }
    if (method === "POST" && p === "/contacts") {
      if (!body.name || !String(body.name).trim()) return invalid("Send a name");
      if (!linkable(body.jobIds)) return notFound("Tracker item");
      const now = new Date(NOW()).toISOString();
      const c = { id: nextId(s, "ct"), name: String(body.name).trim(), title: body.title ?? "", company: body.company ?? "", email: body.email ?? null, phone: body.phone ?? null, linkedinUrl: body.linkedinUrl ?? null, notes: body.notes ?? "", jobIds: body.jobIds ?? [], createdAt: now, updatedAt: now };
      s.contacts.push(c); relink(c);
      return json({ contact: c }, 201);
    }
    if ((x = m(/^\/contacts\/([^/]+)$/))) {
      const c = s.contacts.find((k) => k.id === x[1]);
      if (!c) return notFound("Contact");
      if (method === "GET") return json({ contact: c });
      if (method === "PATCH") {
        if (!linkable(body.jobIds)) return notFound("Tracker item");
        Object.assign(c, ...["name", "title", "company", "email", "phone", "linkedinUrl", "notes", "jobIds"].filter((k) => k in body).map((k) => ({ [k]: body[k] })), { updatedAt: new Date(NOW()).toISOString() });
        relink(c);
        return json({ contact: c });
      }
      if (method === "DELETE") { s.contacts.splice(s.contacts.indexOf(c), 1); relink(c); for (const v of s.interviews) v.contactIds = v.contactIds.filter((id) => id !== c.id); return { status: 204 }; } // hard delete
    }
    return null;
  }

  /* ---- interviews ---- */
  if (method === "GET" && p === "/interviews") {
    const from = query.get("from") ?? new Date(NOW()).toISOString();
    return json({ interviews: s.interviews.filter((v) => v.startsAt >= from).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((v) => { const it = item(v.trackerItemId); return { ...v, jobTitle: it.title, company: it.company }; }) });
  }
  return null;
}

function refreshNextInterview(s, it) {
  const now = new Date(NOW()).toISOString();
  it.nextInterviewAt = s.interviews.filter((v) => v.trackerItemId === it.id && v.startsAt >= now).map((v) => v.startsAt).sort()[0] ?? null;
}
