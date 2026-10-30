// One recorded walk through every resume suite route (PRD section 11), in order, against fixtures("full").
// Used by check-schemas.mjs and shared/test/mock-contract.test.ts to parse every request and response with the shared
// zod schemas. The same list is meant to replay against the real routes later (WP-17 and up): `expect` is the status
// and, for errors, the code the real route must also answer. Bodies and paths may be functions of the walk so far.
//
// A case: { name, method, path, query?, body?, upload?, expect, code?, skipRequestCheck? }
//   path and body may be (ctx) => value; ctx.res[name] is the parsed JSON of an earlier case.

const TEXT = "Sample Applicant. Data Analyst at Sample Analytics Co, 2018 to 2020. Automated a weekly reporting pipeline that saved 6 hours a week. Built a churn dashboard used by the customer success team. Skills: SQL, Python, dbt. B.A. Statistics, Sample State University, 2018.";

const doc = (ctx) => {
  const { id, updatedAt, kind, libraryName, isDefault, targetRoles, baseResumeId, baseName, baseChanged, jobId, applicationId, readOnly, ...input } = structuredClone(ctx.res.getBackend.resume);
  void [id, updatedAt, kind, libraryName, isDefault, targetRoles, baseResumeId, baseName, baseChanged, jobId, applicationId, readOnly];
  return input;
};

export const SUITE_CASES = [
  /* R1: library */
  { name: "listAll", method: "GET", path: "/resumes", expect: 200 },
  { name: "listTailored", method: "GET", path: "/resumes", query: { kind: "tailored" }, expect: 200 },
  { name: "getBackend", method: "GET", path: "/resumes/resume-1", expect: 200 },
  { name: "getMissing", method: "GET", path: "/resumes/nope", expect: 404, code: "not_found" },
  { name: "listTemplates", method: "GET", path: "/templates", expect: 200 },
  { name: "putValid", method: "PUT", path: "/resumes/resume-1", body: (c) => ({ ...doc(c), templateId: "modern", accent: "#1F4E79", pageSize: "a4", level: "senior" }), expect: 200 },
  { name: "putTruthLock", method: "PUT", path: "/resumes/resume-1", body: (c) => { const d = doc(c); d.sections[0].entries[0].lines[0].factIds = ["f8"]; return d; }, expect: 422, code: "truth_lock" },
  { name: "putReadOnly", method: "PUT", path: "/resumes/resume-t4", body: (c) => doc(c), expect: 409, code: "read_only" },
  { name: "patchRename", method: "PATCH", path: "/resumes/resume-3", body: { name: "Data and analytics", targetRoles: ["Data Engineer", "Analytics Engineer"] }, expect: 200 },
  { name: "createDuplicate", method: "POST", path: "/resumes", body: { from: "duplicate", sourceId: "resume-3", name: "Data copy" }, expect: 201 },
  { name: "setDefault", method: "POST", path: (c) => `/resumes/${c.res.createDuplicate.resume.id}/default`, expect: 200 },
  { name: "deleteDefault", method: "DELETE", path: (c) => `/resumes/${c.res.createDuplicate.resume.id}`, expect: 409, code: "is_default" },
  { name: "setDefaultBack", method: "POST", path: "/resumes/resume-1/default", expect: 200 },
  { name: "deleteCopy", method: "DELETE", path: (c) => `/resumes/${c.res.createDuplicate.resume.id}`, expect: 204 },
  /* revisions */
  { name: "listRevisions", method: "GET", path: "/resumes/resume-1/revisions", expect: 200 },
  { name: "nameRevision", method: "POST", path: "/resumes/resume-1/revisions", body: { name: "Before rewrite for Stripe" }, expect: 201 },
  { name: "getRevision", method: "GET", path: (c) => `/resumes/resume-1/revisions/${c.res.nameRevision.revision.id}`, expect: 200 },
  { name: "restoreRevision", method: "POST", path: (c) => `/resumes/resume-1/revisions/${c.res.nameRevision.revision.id}/restore`, expect: 200 },
  /* R2: export */
  { name: "exportTxt", method: "GET", path: "/resumes/resume-1/export", query: { format: "txt" }, expect: 200 },
  { name: "exportPdf", method: "GET", path: "/resumes/resume-1/export", query: { format: "pdf" }, expect: 200 },
  { name: "exportDocx", method: "GET", path: "/resumes/resume-1/export", query: { format: "docx" }, expect: 200 },
  { name: "exportDown", method: "GET", path: "/resumes/resume-1/export", query: { format: "pdf", simulate: "503" }, expect: 503, code: "service_unavailable", skipRequestCheck: true },
  /* R3: tailor and suggestions */
  { name: "tailor", method: "POST", path: "/resumes/tailor", body: { jobId: "job-12" }, expect: 200 },
  { name: "tailorAgain", method: "POST", path: "/resumes/tailor", body: { jobId: "job-12" }, expect: 409, code: "exists" },
  { name: "tailorMissingJob", method: "POST", path: "/resumes/tailor", body: { jobId: "job-999" }, expect: 404, code: "not_found" },
  { name: "suggestLine", method: "POST", path: "/resumes/suggestions", body: { resumeId: "resume-1", scope: "line", lineId: "l-exp1b" }, expect: 200 },
  { name: "suggestHeadline", method: "POST", path: "/resumes/suggestions", body: { resumeId: "resume-1", scope: "headline", level: "senior" }, expect: 200 },
  { name: "suggestNote", method: "POST", path: "/resumes/suggestions", body: { resumeId: "resume-1", scope: "entry", note: "Led the migration of 12 services to the new queue." }, expect: 200 },
  /* R1: import, confirm, build */
  { name: "importText", method: "POST", path: "/profile/imports", body: { text: TEXT }, expect: 202 },
  { name: "importFile", method: "POST", path: "/profile/imports", upload: { fileName: "sample-resume.docx" }, expect: 202, skipRequestCheck: true },
  { name: "importScanned", method: "POST", path: "/profile/imports", upload: { fileName: "scanned-resume.pdf" }, expect: 422, code: "no_text_layer", skipRequestCheck: true },
  { name: "importBadType", method: "POST", path: "/profile/imports", upload: { fileName: "resume.rtf" }, expect: 415, code: "unsupported_type", skipRequestCheck: true },
  { name: "importHuge", method: "POST", path: "/profile/imports", upload: { fileName: "huge.pdf" }, expect: 413, code: "payload_too_large", skipRequestCheck: true },
  { name: "importRead1", method: "GET", path: (c) => `/profile/imports/${c.res.importText.importId}`, expect: 200 },
  { name: "importRead2", method: "GET", path: (c) => `/profile/imports/${c.res.importText.importId}`, expect: 200 },
  { name: "importRead3", method: "GET", path: (c) => `/profile/imports/${c.res.importText.importId}`, expect: 200 },
  { name: "importMissing", method: "GET", path: "/profile/imports/none", expect: 404, code: "not_found" },
  { name: "confirmImported", method: "POST", path: "/profile/facts/confirm", body: (c) => ({ ids: c.res.importRead3.facts.filter((f) => !c.res.importRead3.duplicates.includes(f.id)).map((f) => f.id) }), expect: 200 },
  { name: "buildFromImport", method: "POST", path: "/resumes", body: (c) => ({ from: "facts", name: "Analyst", importId: c.res.importText.importId, targetRoles: ["Data Analyst"] }), expect: 201 },
  /* R4: tracker */
  { name: "trackerBoard", method: "GET", path: "/tracker", query: { view: "board" }, expect: 200 },
  { name: "trackerTable", method: "GET", path: "/tracker", query: { view: "table", q: "company 10" }, expect: 200 },
  { name: "trackerArchived", method: "GET", path: "/tracker", query: { archived: "true" }, expect: 200 },
  { name: "trackerGet", method: "GET", path: "/tracker/ti-4", expect: 200 },
  { name: "trackerSaveMatch", method: "POST", path: "/tracker", body: { matchId: "m13" }, expect: 201 },
  { name: "trackerManual", method: "POST", path: "/tracker", body: { manual: { title: "Staff Engineer", company: "Company 777", location: "Remote, US" } }, expect: 201 },
  { name: "trackerBadUrl", method: "POST", path: "/tracker", body: { url: "https://example.org/jobs/1" }, expect: 422, code: "unsupported_board" },
  { name: "dragOk", method: "PATCH", path: "/tracker/ti-s1", body: { stage: "interviewing", position: "0009" }, expect: 200 },
  { name: "dragIntoApplied", method: "PATCH", path: "/tracker/ti-1", body: { stage: "applied" }, expect: 409, code: "stage_owned_by_pipeline" },
  { name: "dragCloseApproved", method: "PATCH", path: "/tracker/ti-10", body: { stage: "closed", closedReason: "not_pursuing" }, expect: 409, code: "stage_owned_by_pipeline" },
  { name: "dragDraftingTrackingOnly", method: "PATCH", path: "/tracker/ti-m1", body: { stage: "drafting" }, expect: 409, code: "stage_owned_by_pipeline" },
  { name: "noteAndSalary", method: "PATCH", path: "/tracker/ti-4", body: { notes: "Ask about the on-call rota.", salaryText: "$140k to $160k" }, expect: 200 },
  { name: "archiveItem", method: "PATCH", path: "/tracker/ti-s2", body: { archived: true }, expect: 200 },
  { name: "events", method: "GET", path: "/tracker/ti-4/events", expect: 200 },
  { name: "insights30", method: "GET", path: "/tracker/insights", query: { range: "30d" }, expect: 200 },
  { name: "insights90", method: "GET", path: "/tracker/insights", query: { range: "90d" }, expect: 200 },
  /* contacts and interviews */
  { name: "contactsList", method: "GET", path: "/contacts", expect: 200 },
  { name: "contactCreate", method: "POST", path: "/contacts", body: { name: "Jordan Hiring", title: "Recruiter", company: "Company 105", email: "jordan.hiring@example.com", jobIds: ["ti-5"] }, expect: 201 },
  { name: "contactGet", method: "GET", path: (c) => `/contacts/${c.res.contactCreate.contact.id}`, expect: 200 },
  { name: "contactPatch", method: "PATCH", path: (c) => `/contacts/${c.res.contactCreate.contact.id}`, body: { notes: "Replied within a day.", jobIds: ["ti-5", "ti-6"] }, expect: 200 },
  { name: "contactDelete", method: "DELETE", path: (c) => `/contacts/${c.res.contactCreate.contact.id}`, expect: 204 },
  { name: "contactMissing", method: "GET", path: "/contacts/none", expect: 404, code: "not_found" },
  { name: "interviewCreate", method: "POST", path: "/tracker/ti-5/interviews", body: { startsAt: "2026-11-12T15:00:00.000Z", timeZone: "America/New_York", durationMinutes: 45, kind: "onsite", location: "1 Example Way, New York, NY", contactIds: ["ct-1"], notes: "Bring ID; ask for Riley." }, expect: 201 },
  { name: "interviewPatch", method: "PATCH", path: (c) => `/tracker/ti-5/interviews/${c.res.interviewCreate.interview.id}`, body: { durationMinutes: 60, outcome: "Went well" }, expect: 200 },
  { name: "interviewIcs", method: "GET", path: (c) => `/tracker/ti-5/interviews/${c.res.interviewCreate.interview.id}.ics`, expect: 200 },
  { name: "interviewsList", method: "GET", path: "/interviews", query: { from: "2026-01-01T00:00:00.000Z" }, expect: 200 },
  { name: "interviewDelete", method: "DELETE", path: (c) => `/tracker/ti-5/interviews/${c.res.interviewCreate.interview.id}`, expect: 204 },
];

/** Replay a case list through `call({ method, path, query, body, upload })` -> { status, json?, file? } and collect results. */
export async function walk(cases, call) {
  const ctx = { res: {} };
  const out = [];
  for (const c of cases) {
    const path = typeof c.path === "function" ? c.path(ctx) : c.path;
    const body = typeof c.body === "function" ? c.body(ctx) : c.body;
    const r = await call({ method: c.method, path, query: c.query ?? {}, body, upload: c.upload });
    if (r.json !== undefined) ctx.res[c.name] = r.json;
    out.push({ case: c, path, body, result: r });
  }
  return out;
}
