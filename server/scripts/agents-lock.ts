import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { AGENTS } from "../src/agents/registry";

/**
 * Regenerates agents/prompts.lock.json (03-agent-runtime.md 4.4). Run:
 * npm run agents:lock -w @auto-career/server. The registry test fails when a fingerprint of an
 * existing version changes: an edit must create a new version, so a version number always
 * identifies one exact prompt.
 */
const here = join(import.meta.dirname ?? ".");

const lock: Record<string, { active: number; versions: Record<string, string> }> = {};
for (const [id, spec] of Object.entries(AGENTS)) {
  lock[id] = {
    active: spec.promptVersion,
    versions: Object.fromEntries(Object.entries(spec.prompts).map(([v, p]) => [v, p.fingerprint])),
  };
}
const file = join(here, "..", "src", "agents", "prompts.lock.json");
writeFileSync(file, JSON.stringify(lock, null, 2) + "\n");
console.log(`wrote ${file}`);
