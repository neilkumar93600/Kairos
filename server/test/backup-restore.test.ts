import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { generateX25519Identity, identityToRecipient } from "age-encryption";
import { afterAll, describe, expect, it } from "vitest";
import { decryptVerified, pgRestoreArgs } from "../scripts/backup";
import { encryptFile } from "../src/pgbackup";

// The restore drill (R-DR-2, WP-13 acceptance): the owner's kit key decrypts last night's dump, both checksums match
// the manifest, and pg_restore loads it into a scratch database whose row counts are then compared with the manifest.

const tmp = mkdtempSync(join(tmpdir(), "kairos-restore-test-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

async function encrypted(identity: string) {
  const plain = Buffer.from(`PGDMP${"x".repeat(100_000)}`);
  const file = join(tmp, `in-${Math.random()}.dump`);
  writeFileSync(file, plain);
  const enc = await encryptFile(file, [await identityToRecipient(identity)]);
  const cipher = await buffer(enc.body);
  return { plain, cipher, ...enc.digests() };
}

describe("decryptVerified", () => {
  it("writes the plaintext when the key and both checksums match", async () => {
    const identity = await generateX25519Identity();
    const e = await encrypted(identity);
    const out = join(tmp, "ok.dump");
    await decryptVerified(Readable.from([e.cipher]), identity, { sha256: e.sha256, plainSha256: e.plainSha256 }, out);
    expect(readFileSync(out)).toEqual(e.plain);
  });

  it("refuses a download whose checksum is not the manifest's", async () => {
    const identity = await generateX25519Identity();
    const e = await encrypted(identity);
    await expect(decryptVerified(Readable.from([e.cipher]), identity, { sha256: "0".repeat(64), plainSha256: e.plainSha256 }, join(tmp, "bad.dump"))).rejects.toThrow(/checksum/);
  });

  it("refuses a key the dump was not encrypted to", async () => {
    const e = await encrypted(await generateX25519Identity());
    await expect(decryptVerified(Readable.from([e.cipher]), await generateX25519Identity(), e, join(tmp, "wrong.dump"))).rejects.toThrow();
  });
});

describe("pgRestoreArgs", () => {
  it("restores without the dump's grants (roles come from ops/provision-roles.sql) and stops at the first error", () => {
    expect(pgRestoreArgs("postgres://scratch", "/tmp/x.dump")).toEqual(["--dbname=postgres://scratch", "--no-owner", "--no-acl", "--exit-on-error", "--jobs=4", "/tmp/x.dump"]);
  });
});
