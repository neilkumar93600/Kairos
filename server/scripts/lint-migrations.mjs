// Expand-only migration linter (06-infrastructure 3.7, 02-database 14.1; CI job `migrations`).
//   node scripts/lint-migrations.mjs [--base <git ref>]
// Lints every file in drizzle/. With --base it also fails when a migration that exists at <ref> was edited, renamed or
// deleted, or when an existing journal entry changed (INV-21: applied migrations are immutable).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Tables that may pass 100,000 rows (02-database 12.3): a new index on one is built CONCURRENTLY. */
const LARGE_TABLES = new Set([
  "facts", "resume_revisions", "jobs", "matches", "applications", "application_events", "submission_attempts",
  "credit_ledger", "inbound_emails", "llm_calls", "metrics_minute",
]);

/** The SQL with comments, string literals and dollar-quoted bodies blanked out, so only real statements are matched. */
export function stripSql(text) {
  let out = "";
  for (let i = 0; i < text.length; ) {
    const rest = text.slice(i);
    const dollar = /^\$([A-Za-z_]\w*)?\$/.exec(rest);
    let end;
    if (rest.startsWith("--")) end = text.indexOf("\n", i);
    else if (rest.startsWith("/*")) end = text.indexOf("*/", i) + 1;
    else if (rest.startsWith("'")) end = (/^'(?:[^']|'')*'/.exec(rest)?.[0].length ?? 0) - 1 + i;
    else if (dollar) end = text.indexOf(dollar[0], i + dollar[0].length) + dollar[0].length - 1;
    else {
      out += text[i++];
      continue;
    }
    if (end < i) end = text.length - 1; // unterminated: blank the rest
    out += " ";
    i = end + 1;
  }
  return out;
}

/** Splits on commas outside parentheses: the clauses of one ALTER TABLE. */
function clauses(statement) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < statement.length; i++) {
    if (statement[i] === "(") depth++;
    else if (statement[i] === ")") depth--;
    else if (statement[i] === "," && depth === 0) {
      parts.push(statement.slice(start, i));
      start = i + 1;
    }
  }
  return [...parts, statement.slice(start)];
}

const IDEMPOTENT = [
  /^create (unique )?index concurrently if not exists\b/,
  /^drop index concurrently if exists\b/,
  /^alter type \S+ add value if not exists\b/,
  /^alter table \S+ validate constraint\b/,
  /^analyze\b/,
];

/** Problems in one migration file; an empty list means it passes. */
export function lintMigration(tag, text) {
  const header = text.replace(/\r\n/g, "\n").split("\n");
  const noTransaction = /^-- kairos:no-transaction\b/.test(header[0] ?? "");
  const contract = header.slice(0, 5).some((l) => /^-- kairos:contract \S/.test(l));
  const backfilled = /^-- kairos:backfilled\b/m.test(text);
  const statements = stripSql(text)
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").replace(/"/g, "").trim().toLowerCase())
    .filter(Boolean);
  const created = new Set(statements.flatMap((s) => /^create (unlogged )?table (if not exists )?(?:public\.)?(\w+)/.exec(s)?.[3] ?? []));
  const problems = [];
  const contractOnly = (what) => {
    if (!contract) problems.push(`${what}: contract change; needs a '-- kairos:contract <reason>' header in a later release`);
  };

  for (const s of statements) {
    if (/\bdrop table\b/.test(s)) contractOnly("DROP TABLE");
    if (/\bdrop column\b/.test(s)) contractOnly("DROP COLUMN");
    if (/\balter column \S+ (set data )?type\b/.test(s)) contractOnly("ALTER COLUMN ... TYPE");
    if (/\brename\b/.test(s)) contractOnly("RENAME");
    if (/\bset not null\b/.test(s) && !backfilled) contractOnly("SET NOT NULL without a '-- kairos:backfilled' marker");
    if (s.startsWith("alter table")) {
      for (const c of clauses(s)) {
        const add = /^(?:alter table \S+ )?add column\b(.*)$/.exec(c.trim());
        if (add && /\bnot null\b/.test(add[1]) && !/\b(default|generated)\b/.test(add[1])) {
          contractOnly("ADD COLUMN ... NOT NULL without a DEFAULT");
        }
      }
    }
    const index = /^create (unique )?index (concurrently )?(?:if not exists )?\S+ on (?:only )?(?:public\.)?(\w+)/.exec(s);
    if (index && !index[2] && LARGE_TABLES.has(index[3]) && !created.has(index[3])) {
      problems.push(`CREATE INDEX on ${index[3]} (may pass 100,000 rows) needs CONCURRENTLY IF NOT EXISTS in a no-transaction file`);
    }
    if (!noTransaction && /\badd value\b/.test(s)) problems.push("ALTER TYPE ... ADD VALUE needs a '-- kairos:no-transaction' file of its own");
    if (!noTransaction && /\bconcurrently\b/.test(s)) problems.push("CONCURRENTLY needs '-- kairos:no-transaction' as the file's first line");
    if (noTransaction && !IDEMPOTENT.some((r) => r.test(s))) {
      problems.push(`a no-transaction file holds only idempotent statements (IF [NOT] EXISTS, VALIDATE): "${s.slice(0, 60)}"`);
    }
  }
  return problems.map((p) => `${tag}: ${p}`);
}

function git(cwd, ...args) {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout;
}

/** Edits to migrations that exist at `base`, which the deploy runner would refuse anyway (INV-21). */
export function lintAgainstBase(base, cwd) {
  const problems = git(cwd, "diff", "--name-status", "--diff-filter=MDR", base, "--", "drizzle/*.sql")
    .split("\n")
    .filter(Boolean)
    .map((line) => `${line.split("\t").slice(1).join(" -> ")}: applied migrations are never edited, renamed or deleted; add a new one`);
  const entries = (json) => JSON.parse(json).entries.map((e) => `${e.idx}:${e.tag}:${e.when}`);
  const before = entries(git(cwd, "show", `${base}:./drizzle/meta/_journal.json`));
  const now = entries(readFileSync(new URL("drizzle/meta/_journal.json", pathToFileURL(`${cwd}/`)), "utf8"));
  for (const [i, entry] of before.entries()) {
    if (now[i] !== entry) problems.push(`drizzle/meta/_journal.json: entry ${entry} changed; journal entries are append-only`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const problems = journal.entries.flatMap(({ tag }) => lintMigration(tag, readFileSync(new URL(`../drizzle/${tag}.sql`, import.meta.url), "utf8")));
  const at = process.argv.indexOf("--base");
  if (at > 0 && process.argv[at + 1]) problems.push(...lintAgainstBase(process.argv[at + 1], root));
  for (const p of problems) console.error(p);
  console.log(problems.length ? `${problems.length} migration problem(s)` : `${journal.entries.length} migrations pass`);
  process.exit(problems.length ? 1 : 0);
}
