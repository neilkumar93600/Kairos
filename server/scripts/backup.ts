import { spawn } from "node:child_process";
import { createHash, type Hash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { text } from "node:stream/consumers";
import { pathToFileURL } from "node:url";
import { Decrypter, generateX25519Identity, identityToRecipient } from "age-encryption";
import pg from "pg";
import { backupsStorage, countMismatches, countRows, latestKey, type Manifest } from "../src/lib/backups";

/**
 * The owner's backup tools (docs/runbook/R-DR-2.md, owner-actions/WP-13.md). Git Bash, from server/. The age private
 * key is read from AGE_IDENTITY (`read -rs AGE_IDENTITY && export AGE_IDENTITY`), never from an argument, and never
 * printed except by keygen, whose output goes straight to the clipboard.
 *
 *   npx tsx scripts/backup.ts keygen | clip
 *       a new age identity (AGE-SECRET-KEY-1...) on stdout; its public key (age1...) on stderr
 *   npx tsx scripts/backup.ts recipient
 *       the public key of AGE_IDENTITY, to compare with BACKUP_AGE_RECIPIENTS and a manifest's recipients
 *   npx tsx scripts/backup.ts restore [core|full|backups/<kind>/kairos-<stamp>.manifest.json]
 *       downloads the dump (default: the latest core), checks its sha256, decrypts it with AGE_IDENTITY, checks the
 *       plaintext's sha256, pg_restores it into RESTORE_DATABASE_URL and compares every table's row count with the
 *       manifest. Needs the R2_* backups variables and pg_restore 18 on PATH. Exit 0 only when every count matches.
 */

const tap = (hash: Hash) =>
  new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      hash.update(chunk);
      controller.enqueue(chunk);
    },
  });

/** Decrypts `body` to `out` (mode 0600). Throws, leaving no usable file, unless both checksums are the manifest's. */
export async function decryptVerified(body: Readable, identity: string, expect: Pick<Manifest, "sha256" | "plainSha256">, out: string): Promise<void> {
  const [cipherHash, plainHash] = [createHash("sha256"), createHash("sha256")];
  const d = new Decrypter();
  d.addIdentity(identity);
  try {
    const plain = await d.decrypt((Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>).pipeThrough(tap(cipherHash)));
    await pipeline(Readable.fromWeb(plain.pipeThrough(tap(plainHash)) as unknown as NodeReadableStream<Uint8Array>), createWriteStream(out, { mode: 0o600 }));
    const [sha256, plainSha256] = [cipherHash.digest("hex"), plainHash.digest("hex")];
    if (sha256 !== expect.sha256) throw new Error(`the download's checksum ${sha256} is not the manifest's ${expect.sha256}`);
    if (plainSha256 !== expect.plainSha256) throw new Error(`the decrypted dump's checksum ${plainSha256} is not the manifest's ${expect.plainSha256}`);
  } catch (err) {
    await rm(out, { force: true });
    throw err;
  }
}

export function pgRestoreArgs(url: string, file: string): string[] {
  return [`--dbname=${url}`, "--no-owner", "--no-acl", "--exit-on-error", "--jobs=4", file];
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

async function restore(which = "core"): Promise<number> {
  const identity = process.env.AGE_IDENTITY;
  const url = process.env.RESTORE_DATABASE_URL;
  if (!identity || !url || url === process.env.DATABASE_URL) {
    console.error("Set AGE_IDENTITY (read -rs AGE_IDENTITY && export AGE_IDENTITY) and RESTORE_DATABASE_URL (the scratch database, not DATABASE_URL).");
    return 2;
  }
  const store = backupsStorage();
  const started = Date.now();
  const key = which === "core" || which === "full" ? latestKey(which) : which;
  const mf = await store.get(key);
  if (!mf) throw new Error(`no manifest at ${key}`);
  const manifest = JSON.parse(await text(mf.body)) as Manifest;
  const dump = await store.get(manifest.object);
  if (!dump) throw new Error(`the manifest's dump ${manifest.object} is gone (lifecycle: core 7 days, full 28)`);
  const file = join(tmpdir(), `kairos-restore-${Date.now()}.dump`);
  try {
    console.error(`downloading and decrypting ${manifest.object} (${manifest.bytes} bytes, snapshot ${manifest.snapshotAt})`);
    await decryptVerified(dump.body, identity, manifest, file);
    console.error(`checksums match; pg_restore into the scratch database (${Math.round((Date.now() - started) / 1000)} s so far)`);
    await run("pg_restore", pgRestoreArgs(url, file));
  } finally {
    await rm(file, { force: true });
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const mismatches = countMismatches(manifest.rows, await countRows(client, Object.keys(manifest.rows)).finally(() => client.end()));
  const minutes = ((Date.now() - started) / 60_000).toFixed(1);
  for (const m of mismatches) console.log(`MISMATCH ${m}`);
  console.log(
    mismatches.length
      ? `FAIL: ${mismatches.length} of ${Object.keys(manifest.rows).length} tables differ from the manifest (${minutes} minutes)`
      : `PASS: ${Object.keys(manifest.rows).length} tables match the manifest; restore took ${minutes} minutes. Next: journal-replay --since ${manifest.snapshotAt}`,
  );
  return mismatches.length ? 1 : 0;
}

async function main([command, arg]: string[]): Promise<number> {
  if (command === "keygen") {
    const identity = await generateX25519Identity();
    console.error(`public key (BACKUP_AGE_RECIPIENTS): ${await identityToRecipient(identity)}`);
    process.stdout.write(identity);
    return 0;
  }
  if (command === "recipient") {
    if (!process.env.AGE_IDENTITY) {
      console.error("Set AGE_IDENTITY first: read -rs AGE_IDENTITY && export AGE_IDENTITY");
      return 2;
    }
    console.log(await identityToRecipient(process.env.AGE_IDENTITY.trim()));
    return 0;
  }
  if (command === "restore") return restore(arg);
  console.error("usage: npx tsx scripts/backup.ts keygen | recipient | restore [core|full|<manifest key>]");
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err: Error) => {
    console.error(`failed: ${err.message}`);
    process.exit(1);
  });
}
