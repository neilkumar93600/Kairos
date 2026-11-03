import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { srcTreeSha256 } from "../scripts/frozen-extension";

// INV-16 (tests-55): the extension is frozen and the cloud applier runs extension/dist/filler.js as is. Any change to
// extension/src must be a deliberate act: re-record the hash with `npm run frozen:update -w @auto-career/server`.
const REPO = fileURLToPath(new URL("../../", import.meta.url));

function tree(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "frozen-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe("srcTreeSha256", () => {
  it("is the same for LF and CRLF checkouts of the same files", () => {
    expect(srcTreeSha256(tree({ "a.ts": "one\ntwo\n", "lib/b.ts": "x\n" }))).toBe(srcTreeSha256(tree({ "a.ts": "one\r\ntwo\r\n", "lib/b.ts": "x\r\n" })));
  });

  it("changes when a file's content, a file's name, or the file set changes", () => {
    const base = srcTreeSha256(tree({ "a.ts": "one\n" }));
    expect(srcTreeSha256(tree({ "a.ts": "two\n" }))).not.toBe(base);
    expect(srcTreeSha256(tree({ "b.ts": "one\n" }))).not.toBe(base);
    expect(srcTreeSha256(tree({ "a.ts": "one\n", "c.ts": "" }))).not.toBe(base);
  });
});

describe("the frozen extension", () => {
  it("extension/src matches the recorded hash", () => {
    const recorded = JSON.parse(readFileSync(join(REPO, "server/test/fixtures/frozen-extension.json"), "utf8")) as { srcSha256: string };
    expect(srcTreeSha256(join(REPO, "extension/src"))).toBe(recorded.srcSha256);
  });
});
