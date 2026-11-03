// Synthetic API fixtures and a Playwright route handler for the screenshot QA harness.
// Shapes come from shared/src/schemas.ts and web/hooks/*. Synthetic data only: no real people, emails or URLs.
// check-schemas.mjs parses these fixtures against the zod schemas.
// The resume suite routes (R1 to R4: /resumes, /templates, /profile/imports, /tracker, /contacts, /interviews) live in
// mock-suite.mjs and are served from handleApi below; suiteRespond is exported so tests can call them without a browser.

import { buildSuite, suiteRespond } from "./mock-suite.mjs";
export { suiteRespond };

const DAY = 86_400_000;
/** ISO timestamp `d` days (and `h` hours) before now. Negative d is the future. */
const ago = (d, h = 0) => new Date(Date.now() - d * DAY - h * 3_600_000).toISOString();

const PLANS = {
  free: { id: "free", name: "Free", tagline: "See it work on your own search.", priceUsd: { week: null, month: 0, quarter: null }, applicationsPerCycle: 25, resumeProfiles: 1, cloudApplier: false, priorityPolling: false, outcomeReport: false, coverLetters: false, answerMemory: false, highlighted: false, features: ["25 submitted applications, once", "Fit gate with reasons on every match", "Truth-locked resume tailoring"], aiDailyAllowance: { resumeSuggestions: 10, jobTailor: 5, applicationDrafts: 10, jobImports: 3, rehearsalTurns: 0 }, dailyModelSpendCapUsd: 0.05, dailyScoringCap: 20, matchCadenceMinutes: 60, autopilotDailySendCap: 0, interactiveSpendBackstopUsd: 0.62 },
  pro: { id: "pro", name: "Pro", tagline: "Applies even when your laptop is closed.", priceUsd: { week: 12, month: 39, quarter: 95 }, applicationsPerCycle: 1200, resumeProfiles: 3, cloudApplier: true, priorityPolling: false, outcomeReport: true, coverLetters: true, answerMemory: true, highlighted: true, features: ["1,200 submitted applications per 30 days", "Cloud applier", "3 resume profiles"], aiDailyAllowance: { resumeSuggestions: 120, jobTailor: 60, applicationDrafts: 120, jobImports: 40, rehearsalTurns: 20 }, dailyModelSpendCapUsd: 0.25, dailyScoringCap: 140, matchCadenceMinutes: 15, autopilotDailySendCap: 45, interactiveSpendBackstopUsd: 2.7 },
};

const TITLES = ["Software Engineer II", "Backend Engineer", "Full Stack Engineer", "Platform Engineer", "Software Engineer, Payments", "Data Engineer"];
const ATS = ["greenhouse", "lever", "ashby"];
const LOCS = ["Remote, US", "New York, NY", "Austin, TX", "Remote, Canada"];

const job = (n) => ({
  id: `job-${n}`,
  title: TITLES[n % TITLES.length],
  location: LOCS[n % LOCS.length],
  remote: n % 2 === 0,
  applyUrl: `https://boards.example.com/company-${100 + n}/jobs/${n}`,
  firstSeenAt: ago(1, n),
});
const company = (n) => ({ name: `Company ${100 + n}`, ats: ATS[n % ATS.length] });

const REASONS = [
  ["Title matches your target roles", "Remote friendly, matches your preference", "4 of 5 required skills are in your confirmed facts"],
  ["Seniority matches: mid-level", "Salary band is above your floor", "No excluded keywords in the posting"],
  ["Location matches: New York, NY", "3 of 4 required skills are in your confirmed facts"],
];

const match = (n, score) => ({ id: `m${n}`, score, reasons: REASONS[(n - 1) % REASONS.length], status: "new", createdAt: ago(0, n * 3), job: job(n), company: company(n) });

const row = (n, status, { submittedD = null, failure = null } = {}) => ({
  id: `app-${n}`,
  status,
  channel: status === "draft" ? null : n % 2 ? "cloud" : "extension",
  approvedAt: status === "draft" ? null : ago((submittedD ?? 1) + 0.1),
  submittedAt: status === "submitted" ? ago(submittedD ?? 1) : null,
  failureReason: failure,
  job: { id: job(n).id, title: job(n).title, location: job(n).location, applyUrl: job(n).applyUrl },
  company: company(n),
});

const line = (id, section, text, factIds) => ({ id, section, text, factIds });
const entry = (id, heading, subheading, meta, headingFactId, lines) => ({ id, heading, subheading, meta, headingFactId, hidden: false, lines });

const FACTS_FULL = [
  { id: "f1", kind: "role", text: "Software Engineer at Company 101, 2022 to present", sourceSpan: "Software Engineer, Company 101 (2022 - Present)", confirmed: true },
  { id: "f2", kind: "role", text: "Junior Developer at Company 102, 2020 to 2022", sourceSpan: "Junior Developer, Company 102 (2020 - 2022)", confirmed: true },
  { id: "f3", kind: "metric", text: "Cut p95 API latency from 480 ms to 190 ms by adding a read-through cache", sourceSpan: "reduced p95 latency from 480ms to 190ms", confirmed: true },
  { id: "f4", kind: "project", text: "Built a webhook delivery service handling about 2 million events per week", sourceSpan: "webhook delivery service, ~2M events/week", confirmed: true },
  { id: "f5", kind: "skill", text: "TypeScript, Node.js, PostgreSQL, Redis", sourceSpan: "Skills: TypeScript, Node.js, PostgreSQL, Redis", confirmed: true },
  { id: "f6", kind: "education", text: "B.S. Computer Science, Sample State University, 2020", sourceSpan: "B.S. Computer Science, 2020", confirmed: true },
  { id: "f7", kind: "certification", text: "AWS Certified Developer Associate", sourceSpan: "AWS Certified Developer", confirmed: false },
  { id: "f8", kind: "metric", text: "Mentored 3 junior engineers through their first year", sourceSpan: "mentored three juniors", confirmed: false },
];

const PREFS = {
  roles: ["Software Engineer", "Backend Engineer"],
  seniority: ["entry", "mid"],
  locations: ["New York, NY", "Austin, TX"],
  remoteOk: true,
  workAuthorization: "citizen_or_pr",
  salaryFloorUsd: 110000,
  excludedCompanies: ["Company 999"],
  excludedKeywords: ["clearance"],
  fitThreshold: 75,
  maxApplicationsPerCompanyPer30Days: 2,
};

const resumeFull = () => ({
  id: "resume-1",
  updatedAt: ago(2),
  name: "Sample Applicant",
  density: "comfortable",
  contact: { name: "Sample Applicant", email: "sample.applicant@example.com", phone: "555-0100", location: "New York, NY", links: ["https://example.com/sample-applicant", "https://github.example.com/sample-applicant"] },
  sections: [
    { id: "s-summary", kind: "summary", title: "Summary", hidden: false, entries: [entry("e-sum", "", null, null, null, [line("l-sum", "summary", "Backend-leaning engineer with four years building APIs and event pipelines in TypeScript and PostgreSQL.", ["f1", "f5"])])] },
    { id: "s-skills", kind: "skills", title: "Skills", hidden: false, entries: [entry("e-skills", "", null, null, null, [line("l-skills", "skills", "TypeScript, Node.js, PostgreSQL, Redis", ["f5"])])] },
    {
      id: "s-exp", kind: "experience", title: "Experience", hidden: false,
      entries: [
        entry("e-exp1", "Software Engineer", "Company 101", "2022 to present", "f1", [
          line("l-exp1a", "experience", "Cut p95 API latency from 480 ms to 190 ms by adding a read-through cache.", ["f3"]),
          line("l-exp1b", "experience", "Built a webhook delivery service handling about 2 million events per week.", ["f4"]),
        ]),
        entry("e-exp2", "Junior Developer", "Company 102", "2020 to 2022", "f2", [line("l-exp2a", "experience", "Maintained internal admin tooling and fixed customer-reported bugs.", ["f2"])]),
      ],
    },
    { id: "s-edu", kind: "education", title: "Education", hidden: false, entries: [entry("e-edu", "Sample State University", "B.S. Computer Science", "2020", "f6", [])] },
  ],
});

const resumeEmpty = () => ({ id: "resume-2", updatedAt: ago(0), name: "New User", density: "comfortable", contact: { name: "New User", email: "new.user@example.com", phone: "", location: "", links: [] }, sections: [] });

export const fitFor = (jobId) => ({
  jobId,
  title: "Backend Engineer",
  company: "Company 102",
  score: 78,
  basis: "Requirements 28 of 40, keywords 24 of 30, title 18 of 20, seniority 8 of 10",
  band: "great",
  categories: [
    { name: "Requirements coverage", points: 28, max: 40, reason: "4 of 6 requirements are covered by confirmed facts" },
    { name: "Keyword match", points: 24, max: 30, reason: null },
    { name: "Job title", points: 18, max: 20, reason: null },
    { name: "Seniority", points: 8, max: 10, reason: null },
  ],
  requirements: [
    { id: "r1", text: "3+ years building backend services in TypeScript or Node.js", required: true, status: "covered", factIds: ["f1", "f5"] },
    { id: "r2", text: "Experience with PostgreSQL schema design", required: true, status: "covered", factIds: ["f5"] },
    { id: "r3", text: "Operated high-volume event or queue systems", required: true, status: "covered", factIds: ["f4"] },
    { id: "r4", text: "Mentoring or code review experience", required: false, status: "unconfirmed", factIds: ["f8"] },
    { id: "r5", text: "Kubernetes in production", required: false, status: "missing", factIds: [] },
  ],
  keywords: [
    { term: "TypeScript", status: "in_resume", factIds: ["f5"] },
    { term: "PostgreSQL", status: "in_resume", factIds: ["f5"] },
    { term: "Mentoring", status: "has_fact", factIds: ["f8"] },
    { term: "Kubernetes", status: "no_fact", factIds: [] },
  ],
});

export const suggestionsFor = (r) => {
  const sec = r.sections.find((s) => s.kind === "experience");
  const e = sec?.entries[0];
  const l = e?.lines[1];
  if (!sec || !e || !l) return [{ id: "sg-fact", sectionId: "s-exp", entryId: null, lineId: null, action: "add", before: null, after: null, why: "Your resume has no experience yet. Tell us about a role you held.", factIds: [], needsFact: { kind: "role", question: "What was your most recent job title and employer?" } }];
  return [
    { id: "sg-1", sectionId: sec.id, entryId: e.id, lineId: l.id, action: "rewrite", before: l.text, after: "Built a webhook delivery service that handles about 2 million events per week.", why: "Leads with the result and keeps the number from your confirmed fact.", factIds: ["f4"], needsFact: null },
    { id: "sg-2", sectionId: sec.id, entryId: e.id, lineId: null, action: "add", before: null, after: "Mentored 3 junior engineers through their first year.", why: "The posting asks for mentoring. This restates your unconfirmed fact; confirm it first.", factIds: ["f8"], needsFact: null },
    { id: "sg-3", sectionId: sec.id, entryId: e.id, lineId: l.id, action: "rewrite", before: l.text, after: null, why: "A number would make this stronger, but none is on file. How many events or customers did it handle?", factIds: [], needsFact: { kind: "metric", question: "How many events per week did the webhook service deliver, and by what share did failures drop?" } },
  ];
};

const detailFor = (n, status, failure) => {
  const j = job(n);
  const draft = status === "draft";
  const lines = [
    line(`al-${n}-1`, "experience", "Cut p95 API latency from 480 ms to 190 ms by adding a read-through cache.", ["f3"]),
    line(`al-${n}-2`, "experience", "Built a webhook delivery service handling about 2 million events per week.", ["f4"]),
  ];
  const answers = [
    { fieldKey: "first_name", label: "First name", value: "Sample", source: "profile" },
    { fieldKey: "last_name", label: "Last name", value: "Applicant", source: "profile" },
    { fieldKey: "email", label: "Email", value: "sample.applicant@example.com", source: "profile" },
    { fieldKey: "why_company", label: `Why do you want to work at Company ${100 + n}?`, value: "I like building reliable event pipelines and your platform team ships exactly that kind of work.", source: "generated" },
    { fieldKey: "work_authorization", label: "Are you legally authorized to work in the United States?", value: "Yes", source: "profile" },
  ];
  return {
    application: {
      id: `app-${n}`,
      status,
      resumeLines: lines,
      answers,
      coverLetter: draft || status === "submitted" ? "Hello Company hiring team,\n\nI build backend services in TypeScript and PostgreSQL, and the role fits the work I have done on event delivery.\n\nThank you for your time.\nSample Applicant" : null,
      receipt: status === "submitted" ? { channel: n % 2 ? "cloud" : "extension", confirmationText: "Thank you for applying. We received your application.", filledFields: answers.map((a) => ({ fieldKey: a.fieldKey, label: a.label, value: a.value })) } : null,
      failureReason: failure,
      submittedAt: status === "submitted" ? ago(2) : null,
    },
    job: { title: j.title, location: j.location, applyUrl: j.applyUrl, descriptionText: "We are hiring a backend engineer to own services that process customer events.\n\nRequirements:\n- 3+ years with TypeScript or Node.js\n- PostgreSQL schema design\n- Experience operating high-volume queues\n\nNice to have: Kubernetes, mentoring." },
    companyName: `Company ${100 + n}`,
  };
};

const ent = (id, delta, reason, d, applicationId = null, note = null) => ({ id, delta, reason, applicationId, note, createdAt: ago(d, 1) });

const email = (id, sender, subject, kind, applicationId, d, preview) => ({ id, sender, subject, kind, applicationId, receivedAt: ago(d), preview });

const account = (id, providerId, userId, accountId) => ({ id, providerId, accountId, userId, scopes: providerId === "google" ? ["email", "profile", "openid"] : [], createdAt: ago(40), updatedAt: ago(40) });
const sessionFor = (user) => ({
  session: { id: "sess-1", userId: user.id, token: "mock", expiresAt: ago(-7), createdAt: ago(1), updatedAt: ago(1), ipAddress: null, userAgent: null },
  user: { ...user, emailVerified: true, image: null, createdAt: ago(40), updatedAt: ago(1) },
});

/** Fixtures for one scenario: "full" (mid-search Pro user) or "empty" (brand-new Free user). */
export function fixtures(scenario) {
  // Deep copy: the suite routes mutate their fixtures, and PLANS and FACTS_FULL are shared constants.
  const data = structuredClone(baseFixtures(scenario));
  data.suite = buildSuite({ scenario, ago, facts: data.facts, resume: data.resume, applications: data.applications, details: data.details, matches: data.matches, inbox: data.inbox, jobFor: job, companyFor: company, fitFor });
  return data;
}

function baseFixtures(scenario) {
  if (scenario === "empty") {
    const me = { user: { id: "u2", email: "new.user@example.com", name: "New User" }, plan: PLANS.free, credits: { balance: 25, inFlight: 0, available: 25 }, onboardingStep: "resume", forwardingAddress: null, subscription: null };
    return {
      scenario,
      me,
      session: sessionFor(me.user),
      accounts: [account("acc1", "credential", "u2", "u2")],
      matches: [],
      applications: [],
      details: {},
      credits: { balance: 25, inFlight: 0, available: 25, entries: [ent("c1", 25, "free_grant", 0)] },
      inbox: [],
      profile: { phone: null, city: null, country: null, linkedinUrl: null, githubUrl: null, portfolioUrl: null, preferences: null, onboardingStep: "resume", forwardingAddress: "kairos-new0user@in.kairos.example" },
      facts: [],
      resume: resumeEmpty(),
    };
  }
  const applications = [
    row(1, "draft"), row(2, "draft"), row(3, "draft"),
    row(4, "submitted", { submittedD: 1 }), row(5, "submitted", { submittedD: 2 }), row(6, "submitted", { submittedD: 3 }), row(7, "submitted", { submittedD: 5 }), row(8, "submitted", { submittedD: 9 }),
    row(9, "failed", { failure: "The form asked for a field Kairos could not fill. Credit refunded." }),
    row(10, "submitting"),
  ];
  const details = Object.fromEntries(applications.map((a, i) => [a.id, detailFor(i + 1, a.status, a.failureReason)]));
  const me = { user: { id: "u1", email: "sample.applicant@example.com", name: "Sample Applicant" }, plan: PLANS.pro, credits: { balance: 1144, inFlight: 1, available: 1143 }, onboardingStep: "done", forwardingAddress: "kairos-7f3a9c@in.kairos.example", subscription: { status: "active", interval: "month", currentPeriodEnd: ago(-12), cancelAtPeriodEnd: false } };
  return {
    scenario,
    me,
    session: sessionFor(me.user),
    accounts: [account("acc1", "credential", "u1", "u1"), account("acc2", "google", "u1", "google-sample-123")],
    matches: [match(11, 91), match(12, 84), match(13, 77)],
    applications,
    details,
    credits: {
      balance: 1144, inFlight: 1, available: 1143,
      entries: [
        ent("c1", -1, "submission", 1, "app-4"), ent("c2", -1, "submission", 2, "app-5"), ent("c3", -1, "submission", 3, "app-6"),
        ent("c4", -1, "submission", 3, "app-9"), ent("c5", 1, "refund_failed_submit", 3, "app-9", "Submission failed, credit returned"),
        ent("c6", -1, "submission", 5, "app-7"), ent("c7", -1, "submission", 9, "app-8"),
        ent("c8", 1200, "plan_grant", 12, null, "Pro, monthly"), ent("c9", -50, "expiry", 12, null, "Unused free credits expired"), ent("c10", 25, "free_grant", 40),
      ],
    },
    inbox: [
      email("em1", "recruiting@company-104.example.com", "Interview invitation: Backend Engineer", "interview", "app-4", 0.3, "Hi Sample, we would like to set up a 30 minute call next week. Here are a few times that work for us."),
      email("em2", "no-reply@company-105.example.com", "Your application to Company 105", "confirmation", "app-5", 2, "Thanks for applying. We received your application and will review it shortly."),
      email("em3", "jobs@company-106.example.com", "Update on your application", "rejection", "app-6", 3, "Thank you for your interest. We have decided to move forward with other candidates."),
      email("em4", "talent@company-107.example.com", "Complete the coding assessment", "assessment", "app-7", 4, "Please finish the 60 minute online assessment within 5 days using the link below."),
      email("em5", "people@company-108.example.com", "Welcome to our hiring newsletter", null, null, 6, "Here is what is new on the team this month."),
    ],
    profile: { phone: "555-0100", city: "New York", country: "United States", linkedinUrl: "https://linkedin.example.com/in/sample-applicant", githubUrl: "https://github.example.com/sample-applicant", portfolioUrl: "https://example.com/sample-applicant", preferences: PREFS, onboardingStep: "done", forwardingAddress: "kairos-7f3a9c@in.kairos.example" },
    facts: FACTS_FULL,
    resume: resumeFull(),
  };
}

const NOT_FOUND = { error: { code: "not_found", message: "mock" } };

/**
 * Playwright handler for page.route("**\/api/**", ...). `data` is fixtures(); `report.unmocked` collects misses.
 * Mutations echo plausible results; they do not change `data`.
 */
export function handleApi(route, data, report) {
  const req = route.request();
  const url = new URL(req.url());
  const p = url.pathname.replace(/^\/api/, "").replace(/\/$/, "");
  const method = req.method();
  let body = {};
  try { body = req.postDataJSON() ?? {}; } catch { /* no body */ }
  const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
  const m = (re) => p.match(re);
  let x;

  // Resume suite routes first. A multipart upload carries only its file name into the mock.
  const multipart = (req.headers()["content-type"] ?? "").startsWith("multipart/");
  const upload = multipart ? { fileName: (req.postData() ?? "").match(/filename="([^"]+)"/)?.[1] ?? "upload.pdf" } : null;
  const hit = suiteRespond({ method, path: p, query: url.searchParams, body, upload }, data);
  if (hit) {
    if (hit.file) return route.fulfill({ status: hit.status, contentType: hit.file.contentType, headers: { "content-disposition": `attachment; filename="${hit.file.filename}"` }, body: hit.file.body });
    if (hit.json === undefined) return route.fulfill({ status: hit.status });
    return route.fulfill({ status: hit.status, contentType: "application/json", headers: hit.headers, body: JSON.stringify(hit.json) });
  }

  if (method === "GET") {
    if (p === "/me") return json(data.me);
    if (p === "/matches") return json({ matches: data.matches });
    if (p === "/applications") {
      const s = url.searchParams.get("status");
      return json({ applications: s ? data.applications.filter((a) => a.status === s) : data.applications });
    }
    if ((x = m(/^\/applications\/([^/]+)$/))) return data.details[x[1]] ? json(data.details[x[1]]) : json({ error: { code: "not_found", message: "Application not found" } }, 404);
    if (p === "/credits") return json(data.credits);
    if (p === "/inbox") return json({ emails: data.inbox });
    if (p === "/profile") return json({ profile: data.profile });
    if (p === "/profile/facts") return json({ facts: data.facts });
    if (p === "/resume") return json({ resume: data.resume });
    if ((x = m(/^\/jobs\/([^/]+)\/fit$/))) return json({ fit: fitFor(x[1]), matchId: data.matches[0]?.id ?? null });
    // Better Auth (1.7.x) client endpoints
    if (p === "/auth/get-session") return json(data.session);
    if (p === "/auth/list-accounts") return json(data.accounts);
  }

  if (method === "POST") {
    if (p === "/applications/approve") return json({ approved: body.applicationIds ?? [] });
    if (m(/^\/applications\/([^/]+)\/withdraw$/)) return json({ ok: true });
    if (m(/^\/applications\/([^/]+)\/drafts$/)) return json(body.kind === "cover_letter"
      ? { text: "Hello Company hiring team,\n\nI build backend services in TypeScript and PostgreSQL. The role fits the event delivery work I have done.\n\nSample Applicant", factIds: ["f1", "f4"] }
      : { text: "I like building reliable event pipelines, and your platform team ships that kind of work.", factIds: ["f4"] });
    if (m(/^\/matches\/([^/]+)\/queue$/)) return json({ applicationId: "app-1" });
    if (m(/^\/matches\/([^/]+)\/skip$/)) return json({ ok: true });
    if (p === "/resume/suggestions") {
      const note = typeof body.note === "string" ? body.note : null;
      const factCreated = note ? { id: "f-new", kind: "metric", text: note, sourceSpan: null, confirmed: false } : null;
      return json({ suggestions: suggestionsFor(data.resume), factCreated });
    }
    if ((x = m(/^\/jobs\/([^/]+)\/tailor$/))) return json({ resume: data.resume, suggestions: suggestionsFor(data.resume), fit: fitFor(x[1]) });
    if (p === "/jobs/import") return json({ jobId: "job-imported", matchId: "m-imported", fit: { passed: true, reasons: ["Title matches your target roles", "Remote friendly"] } });
    if (p === "/profile/facts") return json({ fact: { id: "f-added", kind: body.kind ?? "skill", text: body.text ?? "", sourceSpan: null, confirmed: body.confirmed ?? true } });
    if (p === "/profile/resumes") return json({ ok: true });
    if (p === "/billing/checkout") return json({ url: "https://checkout.example.com/session/mock" });
    if (p === "/billing/portal") return json({ url: "https://billing.example.com/portal/mock" });
    if (p === "/contact") return json({ ok: true });
    if (p === "/auth/sign-out") return json({ success: true });
  }

  if (method === "PUT") {
    if (p === "/resume") return json({ resume: { ...body, id: data.resume.id, updatedAt: new Date().toISOString() } });
    if (p === "/profile/preferences") return json({ ok: true });
  }

  if (method === "PATCH") {
    if (p === "/profile/preferences") return json({ ok: true });
    if ((x = m(/^\/profile\/facts\/([^/]+)$/))) return json({ fact: { ...(data.facts.find((f) => f.id === x[1]) ?? { id: x[1], kind: "skill", text: "", sourceSpan: null }), ...body } });
    if (m(/^\/applications\/([^/]+)$/)) return json({ ok: true });
  }

  if (method === "DELETE" && m(/^\/profile\/facts\/([^/]+)$/)) return route.fulfill({ status: 204 });

  report.unmocked.push(`${method} ${p}`);
  return json(NOT_FOUND, 404);
}
