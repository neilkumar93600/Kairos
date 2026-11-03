// Parses the mock fixtures and the resume suite walk against the shared zod schemas.
// Run from the repo root: npx tsx web/scripts/qa/check-schemas.mjs
// CI runs the same checks through shared/test/mock-contract.test.ts (npm test), which adds the rule tests.
import { fixtures, fitFor, suggestionsFor, suiteRespond } from "./mock-api.mjs";
import { SUITE_CASES, walk } from "./suite-cases.mjs";
import { RESUME_SUITE_ROUTES, apiErrorSchema } from "../../../shared/src/index.ts";
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
process.exit(bad ? 1 : 0);
