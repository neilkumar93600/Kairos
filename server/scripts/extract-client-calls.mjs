// Lists every API call the shipped clients make, as "METHOD /api/path/:param", by reading their source (read-only).
// Used by test/client-calls.test.ts, which fails when a client calls a route the server no longer mounts (drift).
// ponytail: regex over source, not an AST. It sees api()/post()/put()/patch()/call() with a literal first argument; a call
// built any other way is invisible, and test/client-calls.test.ts asserts a minimum count so a pattern change is noticed.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set(["node_modules", ".next", "dist", "build", ".turbo"]);
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    if (SKIP.has(f)) return [];
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

// helper(<generics>)?( "path" | `path` ...
const CALL = /\b(api|post|put|patch|call)(?:<[^()]*?>)?\(\s*(?:"([^"]+)"|`((?:[^`$]|\$\{[^}]*\})*)`)/g;
const HELPER_METHOD = { post: "POST", put: "PUT", patch: "PATCH" };

/** The text between the call's parentheses, starting at its "(". */
function callArgs(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) return src.slice(open, i);
  }
  return src.slice(open);
}

/** @param {string} repoRoot the repository root; web/ and extension/src/ are read. */
export function extractClientCalls(repoRoot) {
  const calls = new Set();
  for (const file of [...walk(join(repoRoot, "web")), ...walk(join(repoRoot, "extension", "src"))]) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(CALL)) {
      const [, helper, plain, template] = m;
      // A ${...} glued to a segment (not after a "/") is a query string or suffix, not a path parameter.
      let path = (plain ?? template).replace(/\$\{[^}]*\}/g, ":param").replace(/([^/]):param/g, "$1").split("?")[0];
      // The web helper prefixes /api; the extension passes it in full. A template that is only a ${...} is not a path.
      if (!path.startsWith("/") ) continue;
      if (!path.startsWith("/api/")) path = `/api${path}`;
      const explicit = /method:\s*"([A-Z]+)"/.exec(callArgs(src, m.index + m[0].indexOf("(")))?.[1];
      calls.add(`${explicit ?? HELPER_METHOD[helper] ?? "GET"} ${path.replace(/\/$/, "")}`);
    }
  }
  return [...calls].sort();
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) {
  const root = new URL("../../", import.meta.url);
  console.log(JSON.stringify(extractClientCalls(root.pathname.replace(/^\/([A-Za-z]:)/, "$1")), null, 2));
}
