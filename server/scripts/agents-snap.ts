import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { toStrictJsonSchema } from "../src/llm/schema";
import { AnswerDrafterOutput } from "../src/agents/answer-drafter/schema";
import { CoverLetterOutput } from "../src/agents/cover-letter-writer/schema";
import { FitScorerOutput } from "../src/agents/fit-scorer/schema";
import { ResumeParserOutput } from "../src/agents/resume-parser/schema";
import { ResumeTailorOutput } from "../src/agents/resume-tailor/schema";
import { ResumeWriterOutput } from "../src/agents/resume-writer/schema";

/**
 * Writes agents/<id>/schema.snap.json for every registered agent (03-agent-runtime.md 2.4 step 4).
 * Run: npm run agents:snap -w @auto-career/server. The registry test fails when the committed
 * snapshot differs from a fresh build, so a schema can only change through a reviewed commit that
 * also bumps the prompt version.
 *
 * Imports the output schemas directly, not the specs: the specs import the snapshots, so
 * generating them from the specs would be circular. The registry test asserts that the snapshot
 * of each spec equals toStrictJsonSchema(spec.output), which keeps the two honest.
 */
const here = join(import.meta.dirname ?? ".");

const outputs: Record<string, z.ZodType> = {
  "fit-scorer": FitScorerOutput,
  "resume-parser": ResumeParserOutput,
  "resume-tailor": ResumeTailorOutput,
  "resume-writer": ResumeWriterOutput,
  "answer-drafter": AnswerDrafterOutput,
  "cover-letter-writer": CoverLetterOutput,
};

for (const [id, schema] of Object.entries(outputs)) {
  const snap = JSON.stringify(toStrictJsonSchema(schema), null, 2) + "\n";
  const file = join(here, "..", "src", "agents", id, "schema.snap.json");
  writeFileSync(file, snap);
  console.log(`wrote ${file}`);
}
