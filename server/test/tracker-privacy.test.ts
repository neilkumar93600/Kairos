import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Rule 12 (PRD 5; llm-agents-73): tracker notes, salary text, the contacts and the interviews never reach a model. This is the
 * boundary "lint": eslint.config.mjs is protected, so it runs as a test in every build. It walks every source file a model call
 * can read from, starting at each file that names runAgent or chatJson and at every agent and gateway module, follows the relative
 * imports, and fails if any of that code names the private tables or columns. What a prompt builder cannot name it cannot send;
 * ops/provision-roles.sql backs it up in the database, where the worker role cannot select those columns at all.
 */
const SRC = fileURLToPath(new URL("../src/", import.meta.url));

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const sources = walk(SRC).filter((f) => f.endsWith(".ts"));
const read = (f: string) => readFileSync(f, "utf8");
/** Comments may talk about the rule. */
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");

const imports = (f: string) =>
  [...code(f).matchAll(/from\s+"(\.[^"]+)"|import\("(\.[^"]+)"\)/g)]
    .map((m) => resolve(dirname(f), m[1] ?? m[2]!))
    .flatMap((p) => [`${p}.ts`, join(p, "index.ts")].filter(existsSync));

/** The schema barrel declares every table; declaring is not reading, and a file that reads a table has to name it. */
const isSchema = (f: string) => relative(SRC, f).replace(/\\/g, "/").startsWith("db/schema/");

function promptSide(): Set<string> {
  const roots = sources.filter((f) => {
    const rel = relative(SRC, f).replace(/\\/g, "/");
    return rel.startsWith("agents/") || rel.startsWith("llm/") || rel === "services/llm.ts" || /\b(runAgent|chatJson)\(/.test(code(f));
  });
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f) || isSchema(f)) continue;
    seen.add(f);
    stack.push(...imports(f));
  }
  return seen;
}

/** Writes an item and reads nothing private: recordEvent links an application's card. It may name the table, never the private text. */
const ITEM_LINK_ONLY = new Set(["services/events.ts"]);
// `contacts` and `interviews` are ordinary words (a local in llm/claims.ts is one): as tables, they are an import from the schema or a name in SQL.
const PRIVATE_TEXT = /\b(salaryText|salary_text|contactJobs|contact_jobs|interviewContacts|interview_contacts|notes)\b|import\s*\{[^}]*\b(contacts|interviews)\b[^}]*\}\s*from\s*"[^"]*db\/schema|\b(from|join|into|update)\s+"?(contacts|interviews)\b/i;
const TRACKER_TABLES = /\b(trackerItems|tracker_items|jobSnapshot)\b/;

describe("rule 12: the prompt side of the code cannot name the tracker's private data", () => {
  const files = [...promptSide()];

  it("walks the real thing: every agent, every model caller, and what they import", () => {
    const rel = files.map((f) => relative(SRC, f).replace(/\\/g, "/"));
    for (const f of ["agents/registry.ts", "llm/gateway.ts", "services/tailor.ts", "services/fit.ts", "services/draft-writer.ts", "services/resume-writer.ts", "services/verify.ts", "services/resume-parser.ts"]) expect(rel).toContain(f);
    expect(rel.length).toBeGreaterThan(30);
    expect(rel).not.toContain("routes/tracker.ts");
    expect(rel).not.toContain("routes/contacts.ts");
    expect(rel).not.toContain("routes/interviews.ts");
    expect(rel).not.toContain("services/tracker.ts");
  });

  it("no file there names the private tables or columns", () => {
    const leaks = files.filter((f) => PRIVATE_TEXT.test(code(f))).map((f) => relative(SRC, f).replace(/\\/g, "/"));
    expect(leaks).toEqual([]);
  });

  it("no file there reads tracker_items, but for the one that links a card", () => {
    const named = files.filter((f) => TRACKER_TABLES.test(code(f))).map((f) => relative(SRC, f).replace(/\\/g, "/"));
    expect(named.filter((f) => !ITEM_LINK_ONLY.has(f))).toEqual([]);
  });

  it("the check can fail: it sees the names in the files that do hold them", () => {
    expect(PRIVATE_TEXT.test(code(join(SRC, "routes/tracker.ts")))).toBe(true);
    expect(TRACKER_TABLES.test(code(join(SRC, "routes/tracker.ts")))).toBe(true);
    expect(PRIVATE_TEXT.test(code(join(SRC, "routes/contacts.ts")))).toBe(true);
    expect(PRIVATE_TEXT.test(code(join(SRC, "routes/interviews.ts")))).toBe(true);
  });
});
