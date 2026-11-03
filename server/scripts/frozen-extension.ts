import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * INV-16: the Chrome extension is frozen, and the cloud applier injects its built filler unchanged.
 *   tsx scripts/frozen-extension.ts check            hash of extension/src against test/fixtures/frozen-extension.json
 *   tsx scripts/frozen-extension.ts check --filler   also builds the extension and checks the hash of dist/filler.js
 *   tsx scripts/frozen-extension.ts update           re-records both hashes (a deliberate, reviewed act)
 * The filler hash is only meaningful on the CI image (same Node and esbuild as the applier build), so the vitest
 * suite checks the source hash alone and the CI job adds --filler.
 */
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const RECORD = join(REPO, "server/test/fixtures/frozen-extension.json");

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]));
}

/** SHA-256 over every file's relative path and content, sorted, with CRLF read as LF so a Windows checkout matches CI. */
export function srcTreeSha256(dir: string): string {
  const hash = createHash("sha256");
  const files = filesUnder(dir).map((f) => relative(dir, f).split(sep).join("/")).sort();
  for (const file of files) {
    hash.update(`${file}\n`);
    hash.update(readFileSync(join(dir, file), "utf8").replaceAll("\r\n", "\n"));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function buildFillerSha256(): string {
  execFileSync("npm", ["run", "build", "-w", "@auto-career/extension"], { cwd: REPO, stdio: "inherit", shell: process.platform === "win32" });
  return createHash("sha256").update(readFileSync(join(REPO, "extension/dist/filler.js"))).digest("hex");
}

function main(args: string[]): number {
  const [command, ...flags] = args;
  const src = srcTreeSha256(join(REPO, "extension/src"));
  if (command === "update") {
    writeFileSync(RECORD, `${JSON.stringify({ srcSha256: src, fillerSha256: buildFillerSha256() }, null, 2)}\n`);
    console.log("frozen-extension.json updated");
    return 0;
  }
  if (command !== "check") {
    console.error("usage: frozen-extension.ts check [--filler] | update");
    return 2;
  }
  const recorded = JSON.parse(readFileSync(RECORD, "utf8")) as { srcSha256: string; fillerSha256: string };
  const problems: string[] = [];
  if (src !== recorded.srcSha256) problems.push(`extension/src changed (hash ${src}, recorded ${recorded.srcSha256})`);
  if (flags.includes("--filler")) {
    const filler = buildFillerSha256();
    if (filler !== recorded.fillerSha256) problems.push(`built filler.js changed (hash ${filler}, recorded ${recorded.fillerSha256})`);
  }
  for (const p of problems) console.error(`FROZEN EXTENSION: ${p}`);
  if (problems.length) console.error("The extension is frozen (INV-16). If the change is intended, run `npm run frozen:update -w @auto-career/server` and have the owner review it.");
  return problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
