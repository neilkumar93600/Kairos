// Parses the mock fixtures and the resume suite walk against the shared zod schemas.
// Run from the repo root: npx tsx web/scripts/qa/check-schemas.mjs
// CI runs the same checks through shared/test/mock-contract.test.ts (npm test), which adds the rule tests.
import { fixtures, fitFor, suggestionsFor, suiteRespond, onboardingRespond } from "./mock-api.mjs";
import { SUITE_CASES, walk } from "./suite-cases.mjs";
import { RESUME_SUITE_ROUTES, apiErrorSchema } from "../../../shared/src/index.ts";
import { onboardingUpdateSchema, employmentInputSchema, applicationDetailsSchema } from "../../../shared/src/onboarding.ts";
import { jobFitSchema, resumeSuggestionSchema, resumeSchema, applicationAnswerSchema, resumeLineSchema, preferencesSchema } from "../../../shared/src/schemas.ts";

let bad = 0;
const check = (name, schema, value) => {
  const r = schema.safeParse(value);
  if (!r.success) { bad++; console.error(`FAIL ${name}`, JSON.stringify(r.error.issues.slice(0, 3))); } else console.log(`ok   ${name}`);
};
for (const s of ["full", "empty"]) {
  const f = fixtures(s);
  check(`${s} resume`, resumeSchema, f.resume);
  check(`${s} fit`, jobFitSchema, fitFor("job-1"));
  suggestionsFor(f.resume).forEach((x) => check(`${s} suggestion ${x.id}`, resumeSuggestionSchema, x));
  if (f.profile.preferences) check(`${s} preferences`, preferencesSchema, f.profile.preferences);
  for (const d of Object.values(f.details)) {
    d.application.answers.forEach((a) => check(`${s} answer ${a.fieldKey}`, applicationAnswerSchema, a));
    d.application.resumeLines.forEach((l) => check(`${s} line ${l.id}`, resumeLineSchema, l));
  }
}

// Resume suite: replay the recorded cases and parse every request and response with the route table.
const toRegex = (p) => new RegExp("^" + p.replace(/\.ics$/, "\\.ics").replace(/:[a-zA-Z]+/g, "[^/]+") + "$");
const routeFor = (method, path) => {
  const hits = RESUME_SUITE_ROUTES.filter((r) => r.method === method && toRegex(r.path).test(path));
  return hits.find((r) => !r.path.includes(":")) ?? hits.sort((a, b) => b.path.length - a.path.length)[0];
};
const data = fixtures("full");
const out = await walk(SUITE_CASES, async (q) => {
  const r = suiteRespond({ method: q.method, path: q.path, query: new URLSearchParams(q.query), body: q.body ?? {}, upload: q.upload }, data);
  return r.json === undefined ? r : { ...r, json: JSON.parse(JSON.stringify(r.json)) };
});
const seen = new Set();
for (const { case: c, path, body, result } of out) {
  const route = routeFor(c.method, path);
  if (!route) { bad++; console.error(`FAIL ${c.name}: no route for ${c.method} ${path}`); continue; }
  seen.add(route.id);
  if (result.status !== c.expect) { bad++; console.error(`FAIL ${c.name}: status ${result.status}, wanted ${c.expect}`); continue; }
  if (route.request && !c.skipRequestCheck) check(`${c.name} request`, route.request, body);
  if (c.expect >= 400) check(`${c.name} error`, apiErrorSchema, result.json);
  else if (route.response !== "empty" && route.response !== "file") check(`${c.name} response`, route.response, result.json);
  else console.log(`ok   ${c.name} (${route.response})`);
}
for (const r of RESUME_SUITE_ROUTES) if (!seen.has(r.id)) { bad++; console.error(`FAIL no recorded case for route ${r.id}`); }

// Onboarding routes: the mock responses parse against the Task 1 schemas, and state changes stick in `data`.
const ob = fixtures("empty");
const call = (method, path, body = {}) => onboardingRespond({ method, path, body }, ob);
const want = (name, got, status) => { if (got?.status !== status) { bad++; console.error(`FAIL ${name}: status ${got?.status}, wanted ${status}`); return false; } return true; };
const put = call("PUT", "/profile/onboarding", { goals: ["find"], targetRoles: ["Backend Engineer"], targetCompanies: [], step: "target" });
if (want("onboarding put", put, 200)) {
  const p = put.json.profile;
  check("onboarding response", onboardingUpdateSchema, { goals: p.goals, targetRoles: p.targetRoles, targetCompanies: p.targetCompanies, step: p.onboardingStep });
  if (ob.me.onboardingStep !== "target" || ob.me.goals[0] !== "find") { bad++; console.error("FAIL onboarding put did not update me"); }
}
const job = { title: "Engineer", company: "Acme", location: null, startMonth: "2021-01", endMonth: null, isCurrent: true, results: ["Cut build time by 40 percent"] };
const made = call("POST", "/profile/employments", job);
if (want("employment post", made, 201)) {
  const e = made.json.employment;
  check("employment response", employmentInputSchema, { ...e, results: e.results.map((r) => r.text) });
  const upd = call("PATCH", `/profile/employments/${e.id}`, { title: "Senior Engineer" });
  if (want("employment patch", upd, 200) && upd.json.employment.title !== "Senior Engineer") { bad++; console.error("FAIL employment patch did not stick"); }
  want("employment delete", call("DELETE", `/profile/employments/${e.id}`), 204);
  if (call("GET", "/profile/employments").json.employments.length) { bad++; console.error("FAIL employment delete did not stick"); }
}
check("details get", applicationDetailsSchema, call("GET", "/profile/application-details").json.details);
const det = { noticePeriod: "1_month", openToRelocation: true, expectedSalary: { amount: 90000, currency: "USD" } };
const saved = call("PUT", "/profile/application-details", det);
if (want("details put", saved, 200)) check("details response", applicationDetailsSchema, saved.json.details);
process.exit(bad ? 1 : 0);
