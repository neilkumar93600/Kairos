// Parses the mock fixtures against the shared zod schemas. Run from the repo root: npx tsx web/scripts/qa/check-schemas.mjs
import { fixtures, fitFor, suggestionsFor } from "./mock-api.mjs";
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
process.exit(bad ? 1 : 0);
